// The pyramid's outside, course by course from Petrie's levels (survey.js).
//
// Today: the casing is gone and the core stands as steps, one course of blocks each. Two versions of it share one
// layout of blocks (the same seeded lengths and recesses), so they agree:
//   - the far shell: every course on every face in runs of a few blocks, one mesh, always drawn, and the floor you
//     can teleport onto. It sits a little behind the blocks so they cover it where both are drawn.
//   - the blocks: each block with its worn edges, made only in the chunks within reach of you, and dropped behind.
// As built: the smooth casing of fine white limestone over the same core, to the apex.
import { Vector3 } from '@babylonjs/core';
import { Geo, fbm, hash, noise2 } from './geom.js';
import { ENTRANCE, S, TUNNEL, casingHalf, coreRecess } from './survey.js';

// Faces, as seen from outside: outward normal (nx, nz) and the along direction (tx, tz) running left to right.
export const FACES = [
  { name: 'north', nx: 0, nz: 1, tx: 1, tz: 0 },
  { name: 'east', nx: 1, nz: 0, tx: 0, tz: -1 },
  { name: 'south', nx: 0, nz: -1, tx: -1, tz: 0 },
  { name: 'west', nx: -1, nz: 0, tx: 0, tz: 1 },
];

const TILE = 2; // metres per repeat of the stone textures
const SHELL_BEHIND = 0.4; // how far the far shell sits behind the blocks' front faces
const CHUNK_COURSES = 6;
const CHUNK_LEN = 12;
const NEAR = 42; // blocks are made within this distance of you…
const FAR = 58; // …and dropped beyond this

/** Where a point on face f, `u` along it and `s` out from the centre, is in the world. */
function world(f, u, s, y) {
  return [f.nx * s + f.tx * u, y, f.nz * s + f.tz * u];
}

/** The half-width of the core at the top of course k, before any wear: the casing line, less the casing. */
export function coreHalf(k) {
  const y = S.levels[k + 1];
  const h = casingHalf(y);
  return h - coreRecess(y, h, h);
}

/**
 * Where the north face is opened: the blocks there stand further back. Round the entrance they were taken down to the
 * chevrons; at Al-Ma'mun's tunnel they were broken out. Returns how much further back, or 0.
 */
function cut(fi, u, y0, y1) {
  if (fi !== 0) return 0;
  const ch = chevrons();
  const y = (y0 + y1) / 2;
  // The gable and the passage's mouth under it: a triangle on the passage's line, cleared to behind the chevrons.
  if (y > ch.mouthFloor - 0.3 && y < ch.top + 0.4) {
    const hw = y < ch.spring ? ch.mouthHalf : Math.max(0, (ch.top - y) / Math.tan(ENTRANCE.chevron.angle)) + 0.15;
    if (Math.abs(u - ENTRANCE.x) < hw) return ch.depth;
  }
  // The tunnel's mouth: a ragged hole round its bore.
  const t = TUNNEL;
  if (Math.abs(u - t.x) < t.width / 2 + 0.5 && y > t.floor - 0.4 && y < t.floor + t.height + 0.5) return 2.6;
  return 0;
}

let chev = null;
/** The chevron gable's layout on the face (survey.js ENTRANCE; spec.md, "Chevrons"). */
export function chevrons() {
  if (chev) return chev;
  const c = ENTRANCE.chevron;
  const A = c.angle;
  // Thickness square to the slope, from the published lengths: top = soffit + w (cot A + tan A), with a level bed
  // and an upright butment (P §34): 0.76 m for the lower pair, 0.83 m for the upper.
  const k = 1 / Math.tan(A) + Math.tan(A);
  const lower = { soffit: c.lower.soffit, w: (167.7 * 0.0254 - c.lower.soffit) / k };
  const upper = { soffit: c.upper.soffit, w: (185 * 0.0254 - c.upper.soffit) / k };
  const spring = c.spring;
  const rise = lower.soffit * Math.sin(A);
  const lowerApex = spring + rise + lower.w / Math.cos(A);
  const top = lowerApex + upper.w / Math.cos(A);
  const h = casingHalf(spring);
  const face = h - coreRecess(spring, ENTRANCE.x, h) - 0.3;
  chev = { A, lower, upper, spring, rise, lowerApex, top, face, depth: 1.6, mouthHalf: 1.0, mouthFloor: 15.0 };
  return chev;
}

// ---------------------------------------------------------------- the layout of blocks

const rows = new Map();

/**
 * Course k of face fi: blocks of seeded length from corner to corner. Each has a recess behind the core line
 * (weathering, and stone taken), a tint, and the depth of its top.
 */
export function row(fi, k) {
  const key = fi * 1000 + k;
  let r = rows.get(key);
  if (r) return r;
  const f = FACES[fi];
  const half = coreHalf(k);
  // The first course goes down to the rock the pavement was laid on, where the ground is today.
  const y0 = k === 0 ? -S.pavement.thick - 0.05 : S.levels[k], y1 = S.levels[k + 1];
  const h = y1 - y0;
  const blocks = [];
  let u = -half - S.cornerOverlap;
  let i = 0;
  while (u < half + S.cornerOverlap) {
    // Core blocks are about as long as they are tall, or up to twice that (spec.md, "Core blocks").
    const len = Math.min(half + S.cornerOverlap - u, h * (0.9 + 1.1 * hash(fi, k, i, 1)) + 0.3);
    const mid = u + len / 2;
    const rec = recess(fi, k, i, mid, (y0 + y1) / 2, half);
    const tint = 0.84 + 0.18 * hash(fi, k, i, 3) + 0.12 * (fbm(mid, y0, 9, 40 + fi) - 0.5);
    const back = cut(fi, mid, y0, y1);
    blocks.push({ u0: u, u1: u + len, rec: rec + back, tint: back ? tint * 0.9 : tint, sag: 0.04 * hash(fi, k, i, 5) });
    u += len;
    i++;
  }
  r = { fi, k, y0, y1, half, blocks };
  rows.set(key, r);
  return r;
}

/** How far a block stands back from the core line. */
function recess(fi, k, i, u, y, half) {
  // The hollowing of the faces, measured from the corners (survey.js, coreRecess).
  const hc = casingHalf(y);
  let r = coreRecess(y, u, hc) - coreRecess(y, hc, hc);
  r += 0.02 + 0.16 * hash(fi, k, i, 7) ** 2;
  // Blocks taken out: in patches, more often low down (easiest to reach) and along the ridges.
  const corner = half - Math.abs(u);
  const patch = fbm(u + fi * 300, y * 2.2, 7, 11);
  const low = Math.max(0, 1 - y / 40) * 0.12;
  const ridge = Math.max(0, 1 - corner / 5) * 0.35;
  if (patch + low + ridge > 0.82 && hash(fi, k, i, 9) > 0.35) r += 0.5 + 0.7 * hash(fi, k, i, 13);
  // The ridges are rounded off: the corner blocks are broken back further, the nearer the corner.
  r += Math.max(0, 2.5 - corner) * (0.25 + 0.3 * noise2(y, fi, 3, 19));
  return r;
}

// ---------------------------------------------------------------- one block, worn

const AO_FRONT = 0.62; // the foot of a riser, in the corner under the tread above
const AO_BACK = 0.72; // the back of a tread, against the riser behind
const JOINT = 0.3; // how dark a joint is at its deepest

/**
 * A block of course `rw`. Its front stands `b.rec` behind the core line, a few centimetres narrower than its slot
 * (the joints), lumpy, leaning back at the top and worn round at its top and sides; its top runs back under the
 * next course as the tread. `plain`: the far shell's version, a flat front and the tread only.
 */
function block(g, f, rw, b, prev, next, behind = 0, plain = false) {
  const { half, fi, k } = rw;
  // Each riser starts a little below the tread it stands on, so no slit opens between them at a grazing look.
  const y0 = k === 0 ? rw.y0 : rw.y0 - 0.08;
  const y1 = rw.y1 - b.sag;
  const h = y1 - y0;
  const id = Math.round(b.u0 * 10);
  const R = (n) => hash(fi, k, id, n);
  const s = half - b.rec - behind;
  const t = b.tint;
  const lo = t * AO_FRONT, hi = t;
  const sNext = k + 1 < S.levels.length - 1 ? coreHalf(k + 1) : 0;
  // Far enough back to pass under the next course however far its blocks stand back.
  const back = Math.max(0, sNext - 3.6);
  const P = (u, ss, y) => world(f, u, ss, y);
  const along = (p) => (p[0] * f.tx + p[2] * f.tz) / TILE;
  const out = (p) => (p[0] * f.nx + p[2] * f.nz) / TILE;
  const uvF = (pts) => pts.map((p) => [along(p), p[1] / TILE]);
  const uvT = (pts) => pts.map((p) => [along(p), out(p)]);
  const cl = (u, d) => Math.max(-d, Math.min(d, u));

  // The underside, seen where the course below stands further back.
  const under = (ua, ub, sf, d) => {
    const q = [P(ua, sf, y0), P(ub, sf, y0), P(ub, sf - d, y0), P(ua, sf - d, y0)];
    g.face(q, [0, -1, 0], (p) => [along(p), out(p)], () => lo * 0.6);
  };
  if (plain) {
    const q = [P(b.u0, s, y0), P(b.u1, s, y0), P(b.u1, s, y1), P(b.u0, s, y1)];
    g.quad(q[0], q[1], q[2], q[3], uvF(q), [lo, lo, hi, hi]);
    under(b.u0, b.u1, s, 1.6);
    const tq = [P(cl(b.u0, s), s, y1), P(cl(b.u1, s), s, y1), P(cl(b.u1, back), back, y1), P(cl(b.u0, back), back, y1)];
    g.quad(tq[0], tq[1], tq[2], tq[3], uvT(tq), [hi, hi, t * AO_BACK, t * AO_BACK]);
    for (const [side, nb] of [[-1, prev], [1, next]]) {
      const deeper = nb ? Math.max(0, nb.rec - b.rec) : 1.2;
      if (deeper < 0.01) continue;
      const ue = side < 0 ? b.u0 : b.u1;
      let sq = [P(ue, s - deeper, y0), P(ue, s, y0), P(ue, s, y1), P(ue, s - deeper, y1)];
      if (side > 0) sq = [sq[1], sq[0], sq[3], sq[2]];
      g.quad(sq[0], sq[1], sq[2], sq[3], sq.map((p) => [out(p), p[1] / TILE]), [lo * 0.85, lo * 0.85, t * 0.85, t * 0.85]);
    }
    return;
  }

  // The joints: each block a little narrower than its slot. At the row's ends (the ridges) no gap.
  const gl = prev ? 0.012 + 0.05 * R(31) : 0;
  const gr = next ? 0.012 + 0.05 * R(32) : 0;
  const u0 = b.u0 + gl, u1 = b.u1 - gr;
  const ct = 0.05 + 0.17 * R(21) ** 1.5; // the top arris, worn round
  const cs = 0.03 + 0.09 * R(22); // the side arrises
  const lean = 0.12 * R(23) * h; // the top of the face stands back from its foot
  const bulge = (R(24) - 0.5) * 0.08; // the face is not flat
  const um = u0 + (u1 - u0) * (0.35 + 0.3 * R(25));
  const ym = y0 + h * (0.4 + 0.25 * R(26));
  const sTop = s - lean;
  // Front: 2 x 2 patches, the middle pushed out or in.
  const sx = (fy) => s - lean * fy;
  const F = [
    [P(u0 + cs, s, y0), P(um, s, y0), P(u1 - cs, s, y0)],
    [P(u0 + cs, sx(0.45), ym), P(um, sx(0.45) + bulge, ym), P(u1 - cs, sx(0.45), ym)],
    [P(u0 + cs, sTop, y1 - ct), P(um, sTop + bulge * 0.4, y1 - ct), P(u1 - cs, sTop, y1 - ct)],
  ];
  const shade = (row) => (row === 0 ? lo : row === 1 ? (lo + hi) / 2 : hi);
  for (let r = 0; r < 2; r++) {
    for (let cIdx = 0; cIdx < 2; cIdx++) {
      const q = [F[r][cIdx], F[r][cIdx + 1], F[r + 1][cIdx + 1], F[r + 1][cIdx]];
      g.quad(q[0], q[1], q[2], q[3], uvF(q), [shade(r), shade(r), shade(r + 1), shade(r + 1)]);
    }
  }
  under(u0, u1, s, 1.6);
  // The worn top arris, sloping back to the tread.
  const sT = sTop - ct;
  let q = [F[2][0], F[2][2], P(u1 - cs, sT, y1), P(u0 + cs, sT, y1)];
  g.quad(q[0], q[1], q[2], q[3], uvT(q), hi);
  // The tread: back under the next course; each face's treads stop at the diagonals so the four faces tile each
  // course's square without overlap. Sand gathers at the back.
  q = [P(cl(u0 + cs, sT), sT, y1), P(cl(u1 - cs, sT), sT, y1), P(cl(u1 - cs, back), back, y1), P(cl(u0 + cs, back), back, y1)];
  const sand = [t * 1.05, t * 1.0, t * 0.9];
  g.quad(q[0], q[1], q[2], q[3], uvT(q), [hi, hi, sand.map((v) => v * AO_BACK), sand.map((v) => v * AO_BACK)]);
  // The sides: a worn arris, then the face of the joint going back into the dark.
  for (const [side, nb] of [[-1, prev], [1, next]]) {
    const ue = side < 0 ? u0 : u1, ui = ue - side * cs;
    const deeper = nb ? Math.max(0, nb.rec - b.rec) : 1.2;
    const depth = Math.max(0.3, deeper + 0.05);
    let a = [P(ue, s - cs, y0), P(ui, s, y0), P(ui, sTop, y1 - ct), P(ue, sTop - cs, y1 - ct)];
    if (side > 0) a = [a[1], a[0], a[3], a[2]];
    g.quad(a[0], a[1], a[2], a[3], uvF(a), [lo, lo, hi, hi]);
    let tr = [P(ue, sTop - cs, y1 - ct), P(ui, sTop, y1 - ct), P(ui, sT, y1)];
    if (side > 0) tr = [tr[1], tr[0], tr[2]];
    g.tri(tr[0], tr[1], tr[2], uvT(tr), hi);
    // Into the joint. Where the neighbour stands well back, this side is in the open and stays lit.
    const dark = deeper > 0.25 ? 0.8 : JOINT;
    let sq = [P(ue, s - cs - depth, y0), P(ue, s - cs, y0), P(ue, sTop - cs, y1 - ct), P(ue, sTop - cs - depth, y1 - ct)];
    if (side > 0) sq = [sq[1], sq[0], sq[3], sq[2]];
    const cIn = t * dark, cOut = lo * 0.85;
    const cols = side > 0 ? [cOut, cIn, cIn, cOut] : [cIn, cOut, cOut, cIn];
    g.quad(sq[0], sq[1], sq[2], sq[3], sq.map((p) => [out(p), p[1] / TILE]), cols);
  }
  // The back of the joint on the left: mortar and rubble in the dark, so the far shell never shows through.
  if (prev && gl > 0) {
    const d = s - cs - 0.3;
    const jq = [P(b.u0 - 0.04, d, y0), P(u0 + 0.01, d, y0), P(u0 + 0.01, d, y1), P(b.u0 - 0.04, d, y1)];
    g.quad(jq[0], jq[1], jq[2], jq[3], uvF(jq), t * JOINT * 0.8);
  }
}

// ---------------------------------------------------------------- the far shell

/** Runs of about 6 m on each course, at the mean recess of their blocks: the far view and the floor. */
export function buildShell(scene) {
  const g = new Geo();
  const top = S.levels.length - 1;
  for (let fi = 0; fi < 4; fi++) {
    const f = FACES[fi];
    for (let k = 0; k < top; k++) {
      const rw = row(fi, k);
      const runs = [];
      let cur = null;
      for (const b of rw.blocks) {
        if (!cur || b.u0 - cur.u0 > 6 || Math.abs(b.rec - cur.rec) > 0.4) {
          cur = { u0: b.u0, u1: b.u1, rec: b.rec, tint: b.tint, n: 1 };
          runs.push(cur);
        } else {
          cur.u1 = b.u1;
          cur.rec = (cur.rec * cur.n + b.rec) / (cur.n + 1);
          cur.tint = (cur.tint * cur.n + b.tint) / (cur.n + 1);
          cur.n++;
        }
      }
      runs.forEach((run, i) => block(g, f, rw, { ...run, sag: 0.02 }, runs[i - 1], runs[i + 1], SHELL_BEHIND, true));
    }
  }
  // The top platform: the last course's surface, made by the four faces' treads meeting in the middle.
  return g.mesh('core-shell', scene);
}

// ---------------------------------------------------------------- the blocks near you

/** Makes and drops chunks of blocks as you move. Call update(eye) a few times a second. */
export function createBlocks(scene, material, shadowOf = null) {
  const live = new Map();
  const top = S.levels.length - 1;
  const chunks = [];
  for (let fi = 0; fi < 4; fi++) {
    const f = FACES[fi];
    for (let k0 = 0; k0 < top; k0 += CHUNK_COURSES) {
      const k1 = Math.min(top, k0 + CHUNK_COURSES);
      const half = coreHalf(k0) + S.cornerOverlap;
      for (let u = -half; u < half; u += CHUNK_LEN) {
        const um = Math.min(half, u + CHUNK_LEN);
        const ym = (S.levels[k0] + S.levels[k1]) / 2;
        const sm = coreHalf(Math.floor((k0 + k1) / 2));
        const c = world(f, (u + um) / 2, sm, ym);
        chunks.push({ key: `${fi}:${k0}:${u.toFixed(1)}`, fi, k0, k1, u0: u, u1: um, centre: new Vector3(...c) });
      }
    }
  }

  function make(ch) {
    const g = new Geo();
    const f = FACES[ch.fi];
    for (let k = ch.k0; k < ch.k1; k++) {
      const rw = row(ch.fi, k);
      const bl = rw.blocks;
      for (let i = 0; i < bl.length; i++) {
        const b = bl[i];
        const mid = (b.u0 + b.u1) / 2;
        if (mid < ch.u0 || mid >= ch.u1) continue;
        block(g, f, rw, b, bl[i - 1], bl[i + 1]);
      }
    }
    const m = g.mesh(`blocks-${ch.key}`, scene);
    m.material = material;
    m.isPickable = false;
    m.receiveShadows = true;
    m.freezeWorldMatrix();
    m.alwaysSelectAsActiveMesh = false;
    return m;
  }

  let enabled = true;
  return {
    chunks,
    get count() {
      return live.size;
    },
    setEnabled(on) {
      enabled = on;
      for (const m of live.values()) m.setEnabled(on);
    },
    /** One chunk made per call at most, the nearest first, so a frame never stalls. */
    update(eye) {
      if (!enabled) return;
      let best = null, bestD = NEAR;
      for (const ch of chunks) {
        const d = Vector3.Distance(eye, ch.centre);
        const m = live.get(ch.key);
        if (m && d > FAR) {
          m.dispose();
          live.delete(ch.key);
        } else if (!m && d < bestD) {
          best = ch;
          bestD = d;
        }
      }
      if (best) live.set(best.key, make(best));
    },
    dispose() {
      for (const m of live.values()) m.dispose();
      live.clear();
    },
  };
}

// ---------------------------------------------------------------- as built

/**
 * The casing as finished: four smooth faces of fine limestone to the apex, a course line at each of Petrie's levels,
 * and the doorway left open on the north face.
 */
export function buildCasing(scene) {
  const g = new Geo();
  const top = S.levels.length - 1;
  // Above the last surviving course the courses are unknown: carry on at the last course's height to the apex.
  const levels = [...S.levels];
  const last = levels[top] - levels[top - 1];
  while (levels[levels.length - 1] + last < S.apex) levels.push(levels[levels.length - 1] + last);
  levels.push(S.apex);
  const door = { x: ENTRANCE.x, y0: 668.2 * 0.0254, width: 41.53 * 0.0254, height: 47.24 * 0.0254 / Math.cos(26.52 * Math.PI / 180) };
  for (let fi = 0; fi < 4; fi++) {
    const f = FACES[fi];
    for (let k = 0; k < levels.length - 1; k++) {
      const y0 = levels[k], y1 = levels[k + 1];
      const h0 = casingHalf(y0), h1 = casingHalf(y1);
      const s0 = h0, s1 = h1;
      const P = (u, s, y) => world(f, u, s, y);
      const uv = (pts) => pts.map((p) => [(p[0] * f.tx + p[2] * f.tz) / TILE, p[1] / TILE]);
      const joint = 0.004; // the fine joint between courses, a few millimetres
      const shade = 0.96 + 0.05 * hash(fi, k, 77);
      // On the north face, leave the doorway open.
      if (fi === 0 && y1 > door.y0 && y0 < door.y0 + door.height) {
        const segs = [[-h0, door.x - door.width / 2], [door.x + door.width / 2, h0]];
        for (const [a, bb] of segs) {
          const a1 = Math.max(a, -h1), b1 = Math.min(bb, h1);
          const q = [P(a, s0, y0), P(bb, s0, y0), P(b1, s1, y1), P(a1, s1, y1)];
          g.quad(q[0], q[1], q[2], q[3], uv(q), shade);
        }
        continue;
      }
      const q = [P(-h0, s0, y0), P(h0, s0, y0), P(h1, s1, y1 - joint), P(-h1, s1, y1 - joint)];
      g.quad(q[0], q[1], q[2], q[3], uv(q), shade);
      const jq = [P(-h1, s1, y1 - joint), P(h1, s1, y1 - joint), P(h1, s1 - 0.003, y1), P(-h1, s1 - 0.003, y1)];
      g.quad(jq[0], jq[1], jq[2], jq[3], uv(jq), 0.55);
    }
  }
  return g.mesh('casing', scene);
}

// ---------------------------------------------------------------- the north face today: entrance, casing, stair

/**
 * The two pairs of chevron blocks over the original entrance and the masonry round the passage's mouth; the casing
 * stones still in place at the foot of the north face, on their pavement; today's stair to Al-Ma'mun's tunnel.
 */
export function buildNorthFace(scene, mats) {
  const core = new Geo(), fine = new Geo(), floor = new Geo();
  const ch = chevrons();
  const X = ENTRANCE.x;
  const T = 2;
  const uvF = (p) => [p[0] / T, p[1] / T];
  const uvS = (p) => [p[2] / T, p[1] / T];
  const uvT = (p) => [p[0] / T, p[2] / T];
  const depth = ENTRANCE.chevron.thick;
  const z0 = ch.face, z1 = ch.face - depth;
  const cA = Math.cos(ch.A), sA = Math.sin(ch.A);

  /** A prism from an x-y outline (four points), from the face back by `d`. */
  function prism(geo, pts, zf, d, tint) {
    const back = zf - d;
    const P = (q, z) => [q[0], q[1], z];
    geo.face(pts.map((q) => P(q, zf)), [0, 0, 1], uvF, () => tint);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      // The edge's outward normal in x-y: pick the side away from the outline's centre.
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      let n = [b[1] - a[1], -(b[0] - a[0]), 0];
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      if (n[0] * mx + n[1] * my < 0) n = [-n[0], -n[1], 0];
      const l = Math.hypot(n[0], n[1]) || 1;
      n = [n[0] / l, n[1] / l, 0];
      geo.face([P(a, zf), P(b, zf), P(b, back), P(a, back)], n, Math.abs(n[1]) > 0.7 ? uvT : uvS, () => tint * (n[1] < -0.5 ? 0.7 : 0.95));
    }
  }

  // The chevrons: per side, the lower block then the upper resting on it.
  for (const s of [-1, 1]) {
    const lo = ch.lower, up = ch.upper;
    const Sp = [X + s * lo.soffit * cA, ch.spring];
    const Ap = [X, ch.spring + ch.rise];
    const Eo = [Sp[0] + (s * lo.w) / sA, ch.spring];
    const Em = [X, ch.lowerApex];
    // A few centimetres of joint at the butment and between the pairs, so each block reads as itself.
    const j = (q, dx, dy) => [q[0] + s * dx, q[1] + dy];
    prism(core, [Sp, Eo, j(Em, 0.03, -0.03), j(Ap, 0.03, 0)], z0, depth, 1.0);
    const Sp2 = [X + s * up.soffit * cA, ch.lowerApex - up.soffit * sA];
    const Eo2 = [Sp2[0] + (s * up.w) / sA, Sp2[1]];
    const Em2 = [X, ch.top];
    prism(core, [j(Sp2, 0, 0.03), j(Eo2, 0, 0.03), j(Em2, 0.03, 0), j(Em, 0.03, 0.04)], z0 + 0.04, depth, 1.04);
  }
  // Behind the gable's opening, the masonry the North Face Corridor lies in (SP23): a wall 0.84 m back.
  fine.rect([0, 0, z0 - ENTRANCE.nfc.behind], [1, 0, 0], [0, 1, 0], X - ch.lower.soffit * cA, X + ch.lower.soffit * cA, ch.spring, ch.spring + ch.rise, [0, 0, 1], { cell: 2, uv: uvF, col: () => 0.62 });

  // The mouth: the masonry round the passage, from below its floor to the chevrons' bed, with the passage through it.
  {
    const D = 26.52 * Math.PI / 180;
    const yF = 668.2 * 0.0254 - (4010.0 * 0.0254 - z0) * Math.tan(D);
    const hv = 47.24 * 0.0254 / Math.cos(D);
    const w = 41.53 * 0.0254;
    const hw = ch.mouthHalf + 0.15;
    const yb = ch.mouthFloor - 0.15;
    core.rect([0, 0, z0], [1, 0, 0], [0, 1, 0], X - hw, X + hw, yb, ch.spring, [0, 0, 1], { cell: 1.2, holes: [{ u0: X - w / 2, u1: X + w / 2, v0: yF, v1: yF + hv }], uv: uvF, col: (p) => 0.9 + 0.1 * hash(Math.round(p[0] * 2), Math.round(p[1] * 2)) });
    for (const sx of [-1, 1]) core.rect([X + sx * hw, 0, 0], [0, 0, 1], [0, 1, 0], z0 - ch.depth, z0, yb, ch.spring, [sx, 0, 0], { cell: 1.2, uv: uvS, col: () => 0.8 });
    core.rect([0, ch.spring, 0], [1, 0, 0], [0, 0, 1], X - hw, X + hw, z0 - ch.depth, z0, [0, 1, 0], { cell: 2, uv: uvT, col: () => 0.9 });
    // Where you can stand in front of it.
    floor.rect([0, yF, 0], [1, 0, 0], [0, 0, 1], X - 1.6, X + 1.6, z0, z0 + 1.2, [0, 1, 0], { cell: 4, uv: () => [0, 0] });
    core.rect([0, yF, 0], [1, 0, 0], [0, 0, 1], X - hw, X + hw, z0, z0 + 1.1, [0, 1, 0], { cell: 1.2, uv: uvT, col: () => 0.85 });
  }

  // The casing stones in place at the middle of the north side, on their pavement (P §26, §27).
  {
    const c = S.casingStones;
    const zf = S.half;
    const run = 1.495 / S.tan;
    let u = c.u0;
    let i = 0;
    while (u < c.u1 - 0.3) {
      const l = Math.min(c.u1 - u, 1.6 + 1.4 * hash(i, 91));
      const a = u + 0.003, b = u + l - 0.003;
      const t = 0.92 + 0.08 * hash(i, 92);
      const top = c.height - 0.02 * hash(i, 93);
      fine.face([[a, 0, zf], [b, 0, zf], [b, top, zf - run], [a, top, zf - run]], [0, Math.cos(S.slope), Math.sin(S.slope)], uvF, () => t);
      fine.face([[a, top, zf - run], [b, top, zf - run], [b, top, zf - c.bottom], [a, top, zf - c.bottom]], [0, 1, 0], uvT, () => t * 0.95);
      for (const [x, n] of [[a, [-1, 0, 0]], [b, [1, 0, 0]]]) fine.face([[x, 0, zf], [x, top, zf - run], [x, top, zf - c.bottom], [x, 0, zf - c.bottom]], n, uvS, () => t * 0.8);
      u += l;
      i++;
    }
    // The pavement in front of them, 0.53 m thick, broken off irregularly (estimated extent, spec.md).
    const pv = S.pavement;
    const zA = zf + pv.beyond + 2.2;
    fine.rect([0, 0, 0], [1, 0, 0], [0, 0, 1], c.u0 - 1, c.u1 + 1.5, zf - 0.2, zA, [0, 1, 0], { cell: 1.5, uv: uvT, col: (p) => 0.85 + 0.1 * hash(Math.round(p[0]), Math.round(p[2])) });
    fine.rect([0, 0, zA], [1, 0, 0], [0, 1, 0], c.u0 - 1, c.u1 + 1.5, -pv.thick, 0, [0, 0, 1], { cell: 1.5, uv: uvF, col: () => 0.75 });
    for (const [x, n] of [[c.u0 - 1, [-1, 0, 0]], [c.u1 + 1.5, [1, 0, 0]]]) fine.rect([x, 0, 0], [0, 0, 1], [0, 1, 0], zf - 0.2, zA, -pv.thick, 0, n, { cell: 1.5, uv: uvS, col: () => 0.72 });
    floor.rect([0, 0, 0], [1, 0, 0], [0, 0, 1], c.u0 - 1, c.u1 + 1.5, zf + 0.1, zA, [0, 1, 0], { cell: 4, uv: () => [0, 0] });
  }

  // Today's way up: a stone stair from the ground to the tunnel's mouth, with a landing.
  {
    const t = TUNNEL;
    const h = casingHalf(t.floor + 1);
    const zTop = h - coreRecess(t.floor + 1, t.x, h) + 0.4;
    const yTop = t.floor;
    const yBot = -S.pavement.thick;
    const n = Math.ceil((yTop - yBot) / 0.18);
    const rise = (yTop - yBot) / n, tread = 0.38;
    const x0 = t.x - 1.1, x1 = t.x + 1.1;
    const zLand = zTop + 1.8;
    core.rect([0, yTop, 0], [1, 0, 0], [0, 0, 1], x0, x1, zTop - 0.2, zLand, [0, 1, 0], { cell: 1, uv: uvT, col: () => 0.95 });
    floor.rect([0, yTop, 0], [1, 0, 0], [0, 0, 1], x0, x1, zTop - 0.2, zLand, [0, 1, 0], { cell: 4, uv: () => [0, 0] });
    for (let i = 0; i < n; i++) {
      const y = yTop - i * rise;
      const za = zLand + i * tread, zb = za + tread;
      core.rect([0, y - rise, 0], [1, 0, 0], [0, 0, 1], x0, x1, za, zb, [0, 1, 0], { cell: 3, uv: uvT, col: () => 0.92 });
      core.rect([0, 0, zb], [1, 0, 0], [0, 1, 0], x0, x1, y - 2 * rise, y - rise, [0, 0, 1], { cell: 3, uv: uvF, col: () => 0.75 });
      for (const [x, nn] of [[x0, [-1, 0, 0]], [x1, [1, 0, 0]]]) core.rect([x, 0, 0], [0, 0, 1], [0, 1, 0], za, zb, yBot, y - rise, nn, { cell: 3, uv: uvS, col: () => 0.8 });
    }
    // The stair as one slope to walk on.
    const zEnd = zLand + n * tread;
    const L = Math.hypot(zEnd - zLand, yTop - yBot);
    floor.rect([0, yTop, zLand], [1, 0, 0], [0, -(yTop - yBot) / L, (zEnd - zLand) / L], x0, x1, 0, L, [0, 1, 0], { cell: 4, uv: () => [0, 0] });
  }

  const meshes = [];
  for (const [geo, mat, name] of [[core, mats.core, 'north-core'], [fine, mats.fine, 'north-fine']]) {
    const m = geo.mesh(name, scene);
    m.material = mat;
    m.isPickable = false;
    m.receiveShadows = true;
    m.freezeWorldMatrix();
    meshes.push(m);
  }
  const f = floor.mesh('north-floors', scene);
  f.isVisible = false;
  f.isPickable = true;
  f.freezeWorldMatrix();
  return { meshes, floor: f };
}
