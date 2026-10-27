// Blood moving through the heart, along the paths assets-src/heart/flow.py traced: from the venae cavae through
// the right heart to the lungs, and from the pulmonary veins through the left heart to the aorta and its branches.
// Each stretch moves its blood on its own clock and at its measured peak velocity (assets-src/heart/refs/
// literature.md, Chiang 1989): veins and atria all the time, a little faster while the ventricles contract and
// when the atrioventricular valves open; ventricular filling with the E and A waves while the mitral or tricuspid
// valve is open; ejection while the aortic or pulmonary valve is open. Blood waits behind a shut valve. Venous
// blood is dark red, arterial bright red (oxygenated blood is the brighter one; neither is blue).
import { Color3, MeshBuilder, PBRMaterial } from '@babylonjs/core';

const PEAK = {   // mm/ms (= m/s)
  venous: { v_in_e: 0.57, v_in_a: 0.40, v_out: 0.74, artery: 0.74 },
  arterial: { v_in_e: 0.87, v_in_a: 0.61, v_out: 0.77, artery: 1.06 },
};
const COUNT = { venous: 260, arterial: 420 };
const COLOR = { venous: '#4a0d1a', arterial: '#a8070f' };

const gauss = (t, at, w) => Math.exp(-(((t - at) / w) ** 2));
/** Blood speed (mm/ms) on a stretch at cycle time t, given the valves' openings. */
function speed(kind, blood, t, w) {
  const p = PEAK[blood];
  const eject = t > 30 && t < 330 ? Math.sin(Math.PI * Math.pow(Math.min(1, (t - 30) / 290), 0.7)) : 0;
  const open = blood === 'arterial' ? w.open_av : w.open_pv;
  const inflowOpen = blood === 'arterial' ? w.open_mv : w.open_tv;
  const E = gauss(t, 430, 45);
  const A = gauss(t, 735, 35);
  switch (kind) {
    case 'vein': return 0.12 + 0.18 * eject + 0.12 * E;
    case 'atrium': return 0.06 + 0.1 * eject + 0.2 * E * inflowOpen + 0.15 * A * inflowOpen;
    case 'v_in': return inflowOpen > 0.05 ? (p.v_in_e * E + p.v_in_a * A) * 0.6 + 0.04 : 0;
    case 'v_out': return open > 0.05 ? p.v_out * eject * open : 0;
    default: return open > 0.05 ? p.artery * eject * open + 0.03 : 0.03;   // arteries: forward in systole, barely in diastole
  }
}

export async function createBlood(scene, parent, url) {
  const data = await (await fetch(url)).json();
  const paths = data.paths.map((p) => {
    const n = p.pts.length;
    const pts = new Float32Array(p.pts.flat()); const dv = new Float32Array(p.dv.flat()); const da = new Float32Array(p.da.flat());
    const s = new Float32Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[3 * i] - pts[3 * i - 3], pts[3 * i + 1] - pts[3 * i - 2], pts[3 * i + 2] - pts[3 * i - 1]);
    // a frame per point for the lateral offset within the lumen
    const nx = new Float32Array(3 * n); const bx = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      const j = Math.min(i + 1, n - 1); const k = Math.max(i - 1, 0);
      let tx = pts[3 * j] - pts[3 * k], ty = pts[3 * j + 1] - pts[3 * k + 1], tz = pts[3 * j + 2] - pts[3 * k + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ax = Math.abs(ty) < 0.9 ? 0 : 1, ay = Math.abs(ty) < 0.9 ? 1 : 0;
      let ux = ty * 0 - tz * ay, uy = tz * ax - tx * 0, uz = tx * ay - ty * ax;
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      nx.set([ux, uy, uz], 3 * i); bx.set([ty * uz - tz * uy, tz * ux - tx * uz, tx * uy - ty * ux], 3 * i);
    }
    return { blood: p.blood, kind: p.kind, r: p.r, pts, dv, da, s, n, length: s[n - 1], nx, bx };
  });
  const groups = {};
  for (const blood of ['venous', 'arterial']) {
    const mine = paths.filter((p) => p.blood === blood);
    const mesh = MeshBuilder.CreateIcoSphere(`blood-${blood}`, { radius: 1.1, subdivisions: 1 }, scene);
    const mat = new PBRMaterial(`blood-${blood}`, scene);
    mat.albedoColor = Color3.FromHexString(COLOR[blood]);
    mat.emissiveColor = Color3.FromHexString(COLOR[blood]).scale(0.25);
    mat.metallic = 0; mat.roughness = 0.45; mat.environmentIntensity = 0.35;
    mesh.material = mat; mesh.parent = parent; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true;
    const n = COUNT[blood]; const m = new Float32Array(16 * n);
    for (let i = 0; i < n; i++) { m[16 * i] = m[16 * i + 5] = m[16 * i + 10] = m[16 * i + 15] = 1; }
    mesh.thinInstanceSetBuffer('matrix', m, 16, false);
    const parts = Array.from({ length: n }, () => spawn(mine, true));
    groups[blood] = { mesh, m, parts, paths: mine };
  }
  function spawn(mine, anywhere) {
    const p = mine[Math.floor(Math.random() * mine.length)];
    const a = Math.random() * Math.PI * 2; const r = Math.sqrt(Math.random()) * 0.7;
    return { p, s: anywhere ? Math.random() * p.length : Math.random() * 6, i: 0, u: Math.cos(a) * r, v: Math.sin(a) * r };
  }
  let visible = false;
  for (const g of Object.values(groups)) g.mesh.setEnabled(false);
  return {
    get visible() { return visible; },
    show(on) { visible = on; for (const g of Object.values(groups)) g.mesh.setEnabled(on); },
    /** dt: ms of cycle time since the last frame; state: cycle.js's at(). */
    update(dt, state) {
      if (!visible) return;
      const w = state.weights; const t = state.t;
      const wv = w.vsys; const wa = w.afill;
      for (const g of Object.values(groups)) {
        const { m } = g;
        g.parts.forEach((q, k) => {
          let p = q.p;
          while (q.i < p.n - 2 && p.s[q.i + 1] < q.s) q.i++;
          q.s += speed(p.kind[q.i], p.blood, t, w) * dt;
          if (q.s >= p.length) { Object.assign(q, spawn(g.paths, false)); p = q.p; }
          while (q.i < p.n - 2 && p.s[q.i + 1] < q.s) q.i++;
          const i = q.i; const f = Math.min(1, Math.max(0, (q.s - p.s[i]) / ((p.s[i + 1] - p.s[i]) || 1)));
          const r = p.r[i] * (q.u * 0 + 1);
          for (let c = 0; c < 3; c++) {
            const at = (a) => a[3 * i + c] * (1 - f) + a[3 * i + 3 + c] * f;
            m[16 * k + 12 + c] = at(p.pts) + wv * at(p.dv) + wa * at(p.da) + (p.nx[3 * i + c] * q.u + p.bx[3 * i + c] * q.v) * r;
          }
        });
        g.mesh.thinInstanceBufferUpdated('matrix');
      }
    },
  };
}
