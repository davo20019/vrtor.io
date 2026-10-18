// The two cells, built part by part to scale (geo.js UM: 150,000 times life size):
//
//   Animal cell: a sphere 20 µm across (3 m here), its nucleus 6 µm in the middle with its double envelope, pores,
//   nucleolus and 46 strands of chromatin; rough ER in stacked sheets round the nucleus, smooth ER tubes off its
//   edge, a Golgi stack and the centrosome beside it, mitochondria, lysosomes, peroxisomes, vesicles, ribosomes
//   free and on the ER, and the three fibres of the cytoskeleton.
//
//   Plant cell: a rounded box 40 x 25 x 25 µm (6 x 3.75 x 3.75 m) in a cellulose wall with plasmodesmata through
//   it, a central vacuole filling most of it (dented round what's pressed against it), the nucleus pressed to the
//   back wall, chloroplasts lying flat against the walls, and the rest in the thin layer of cytoplasm between.
//
// Both are cut away (their quadrant x > 0, z > 0 is missing, turned to face the viewer) so you can see and walk in.
// "Whole" closes them. Mitochondria, chloroplasts and the plant's nucleus open when you look inside them.
import { Matrix, Mesh, MeshBuilder, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import { PARTS } from './content.js';
import { TAU, UM, cap, cutCurve, fromCut, mat, pillow, placeAt, random, randomDir, scatter, shell, smooth, superPoint, superScale, tubes, turnTo, wobble } from './geo.js';

/** Shared switches the meshes' `shown()` read: the cells cut open or whole. */
export const VIEW = { cut: true };

const HALF = Math.PI / 2;
/** Where the cut-away quadrant faces, in a cell's own frame. */
const OPENING = new Vector3(1, 0, 1).normalize();

function palette(scene) {
  return {
    membrane: mat(scene, 'membrane', { color: '#f0a27c', rough: 0.42, sheen: 0.3 }),
    cytoplasm: mat(scene, 'cytoplasm', { color: '#bfe4f2', rough: 0.2, alpha: 0.16, glow: 0.3 }),
    envelope: mat(scene, 'envelope', { color: '#9465c4', rough: 0.4 }),
    nucleoplasm: mat(scene, 'nucleoplasm', { color: '#d2b9ec', rough: 0.25, alpha: 0.32, glow: 0.25 }),
    nucleolus: mat(scene, 'nucleolus', { color: '#4a2673', rough: 0.6 }),
    chromatin: mat(scene, 'chromatin', { color: '#7457d8', rough: 0.45, glow: 0.15 }),
    pore: mat(scene, 'pore', { color: '#3b2155', rough: 0.5 }),
    roughEr: mat(scene, 'rough-er', { color: '#5592dc', rough: 0.38 }),
    ribosome: mat(scene, 'ribosome', { color: '#1f2a44', rough: 0.6 }),
    smoothEr: mat(scene, 'smooth-er', { color: '#7fd1bd', rough: 0.38 }),
    golgi: mat(scene, 'golgi', { color: '#ea6aa8', rough: 0.38 }),
    vesicle: mat(scene, 'vesicle', { color: '#f5b8d6', rough: 0.35 }),
    secretory: mat(scene, 'secretory', { color: '#f6c86a', rough: 0.35 }),
    mitoOuter: mat(scene, 'mito-outer', { color: '#e15b33', rough: 0.4 }),
    mitoInner: mat(scene, 'mito-inner', { color: '#f6a467', rough: 0.4 }),
    cristae: mat(scene, 'cristae', { color: '#ec8a4e', rough: 0.4 }),
    mitoMatrix: mat(scene, 'mito-matrix', { color: '#7d2614', rough: 0.5 }),
    lysosome: mat(scene, 'lysosome', { color: '#c6d94a', rough: 0.45 }),
    peroxisome: mat(scene, 'peroxisome', { color: '#86cf7c', rough: 0.3, alpha: 0.62, glow: 0.2 }),
    peroxCore: mat(scene, 'perox-core', { color: '#2b6534', rough: 0.4 }),
    centriole: mat(scene, 'centriole', { color: '#f1e39b', rough: 0.4, glow: 0.15 }),
    pcm: mat(scene, 'pcm', { color: '#f7efcf', rough: 0.3, alpha: 0.2, glow: 0.3 }),
    microtubule: mat(scene, 'microtubule', { color: '#9cd8ff', rough: 0.4, glow: 0.35 }),
    actin: mat(scene, 'actin', { color: '#ff8c8c', rough: 0.4, glow: 0.3 }),
    intermediate: mat(scene, 'intermediate', { color: '#d9b98a', rough: 0.45, glow: 0.2 }),
    wall: mat(scene, 'wall', { color: '#a5c25e', rough: 0.85 }),
    plasmo: mat(scene, 'plasmo', { color: '#4d6a1e', rough: 0.6 }),
    tonoplast: mat(scene, 'tonoplast', { color: '#7db5ea', rough: 0.15, alpha: 0.3, glow: 0.15 }),
    sap: mat(scene, 'sap', { color: '#a7d3f7', rough: 0.1, alpha: 0.14, glow: 0.3 }),
    chloroOuter: mat(scene, 'chloro-outer', { color: '#3c9a37', rough: 0.4 }),
    stroma: mat(scene, 'stroma', { color: '#b3dc8f', rough: 0.45 }),
    grana: mat(scene, 'grana', { color: '#1f6e24', rough: 0.45, glow: 0.05 }),
    starch: mat(scene, 'starch', { color: '#f1eedb', rough: 0.6 }),
  };
}

// ---------------------------------------------------------------- shared templates (cloned per organelle)

function merge(name, list, material) {
  const m = Mesh.MergeMeshes(list.filter(Boolean), true, true);
  m.name = name;
  if (material) m.material = material;
  return m;
}

/** A mitochondrion 0.8 x 2.4 µm, its long axis z: closed, and opened lengthwise (the top half off) to show inside. */
function mitoTemplate(scene, M) {
  const r = new Vector3(0.4, 0.4, 1.2).scale(UM);
  const closed = shell('mito-closed', scene, { r, seg: 22, rings: 14, material: M.mitoOuter });
  const outer = shell('mito-open', scene, { r, p1: 0, seg: 26, rings: 16, thickness: 0.006, material: M.mitoOuter });
  const ri = r.subtract(new Vector3(0.015, 0.015, 0.015));
  const inner = shell('mito-inner', scene, { r: ri, p1: 0, seg: 24, rings: 12, material: M.mitoInner });
  const parts = [];
  // Cristae: shelves of inner membrane across the mitochondrion, from alternate sides.
  for (let i = 0; i < 7; i++) {
    const z = -0.135 + i * 0.045;
    const rc = ri.x * Math.sqrt(Math.max(0, 1 - (z / ri.z) ** 2)) * 0.96;
    const side = i % 2 ? 1 : -1;
    parts.push(pillow(`crista-${i}`, scene, (u, v) => {
      const a = Math.PI + v * Math.PI;
      let x = side * 0.3 * rc + u * rc * Math.cos(a);
      let y = u * rc * Math.sin(a);
      const d = Math.hypot(x, y);
      if (d > 0.93 * rc) { x *= (0.93 * rc) / d; y *= (0.93 * rc) / d; }
      return new Vector3(x, Math.min(y, -0.002), z);
    }, { h: 0.004, nu: 8, nv: 12, bulge: (u) => Math.sqrt(Math.max(0, 1 - u * u)) * 0.8 + 0.2 }));
  }
  const cristae = merge('mito-cristae', parts, M.cristae);
  // The matrix's granules: its own ribosomes and two rings of its DNA.
  const rnd = random(77);
  const bits = [];
  for (let i = 0; i < 12; i++) {
    const s = MeshBuilder.CreateIcoSphere(`mg-${i}`, { radius: 0.0032, subdivisions: 1 }, scene);
    s.position.set((rnd() - 0.5) * 0.06, -0.01 - rnd() * 0.025, (rnd() - 0.5) * 0.24);
    bits.push(s);
  }
  for (let i = 0; i < 2; i++) {
    const t = MeshBuilder.CreateTorus(`mdna-${i}`, { diameter: 0.018, thickness: 0.0022, tessellation: 14 }, scene);
    t.position.set((i - 0.5) * 0.02, -0.02, (i - 0.5) * 0.12);
    bits.push(t);
  }
  const matrix = merge('mito-matrix', bits, M.mitoMatrix);
  return { r, closed, outer, inner, cristae, matrix };
}

/** A chloroplast 5 x 3 x 1.5 µm, long along x, flat in y: closed, and opened (the top half off). */
function chloroTemplate(scene, M) {
  const r = new Vector3(2.5, 0.75, 1.5).scale(UM);
  const closed = shell('chloro-closed', scene, { r, seg: 28, rings: 16, material: M.chloroOuter });
  const outer = shell('chloro-open', scene, { r, p1: 0, seg: 30, rings: 16, thickness: 0.01, material: M.chloroOuter });
  const ri = r.subtract(new Vector3(0.014, 0.014, 0.014));
  const stroma = shell('chloro-stroma', scene, { r: ri, p1: 0, seg: 28, rings: 12, material: M.stroma });
  // A granum: eight thylakoid discs stacked like coins, 0.5 µm across.
  const profile = [new Vector3(0, 0, 0)];
  for (let d = 0; d < 8; d++) {
    const y0 = d * 0.0075;
    profile.push(new Vector3(0.033, y0 + 0.0008, 0), new Vector3(0.0375, y0 + 0.0024, 0), new Vector3(0.0375, y0 + 0.0052, 0), new Vector3(0.033, y0 + 0.0068, 0));
  }
  profile.push(new Vector3(0, 0.06, 0));
  // As many stacks as fit on the floor of the opened half, 0.08 m (0.5 µm) apart.
  const spots = [];
  const base = -0.062;
  for (let x = -0.32; x <= 0.321; x += 0.08) {
    for (let z = -0.2; z <= 0.201; z += 0.08) {
      const jx = x + (((Math.round(x * 100) * 7 + Math.round(z * 100) * 3) % 5) - 2) * 0.003;
      const ok = [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => superScale(ri, 1, 1, new Vector3(jx + a * 0.038, base, z + b * 0.038)) < 0.985);
      if (ok) spots.push(new Vector3(jx, base, z));
    }
  }
  const grana = spots.map((p, i) => {
    const g = MeshBuilder.CreateLathe(`granum-${i}`, { shape: profile, tessellation: 12, cap: Mesh.NO_CAP }, scene);
    g.position.copyFrom(p);
    g.scaling.y = 0.75 + ((i * 7) % 5) * 0.08;
    return g;
  });
  // Stroma lamellae: flat sheets joining neighbouring grana.
  const sheets = [];
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const d = Vector3.Distance(spots[i], spots[j]);
      if (d > 0.085 || (i + j) % 2) continue;
      const b = MeshBuilder.CreateBox(`lam-${i}-${j}`, { width: d, height: 0.0028, depth: 0.016 }, scene);
      b.position = spots[i].add(spots[j]).scale(0.5).add(new Vector3(0, 0.024 + (i % 3) * 0.008, 0));
      b.rotation.y = -Math.atan2(spots[j].z - spots[i].z, spots[j].x - spots[i].x);
      sheets.push(b);
    }
  }
  const thylakoids = merge('chloro-thylakoids', [...grana, ...sheets], M.grana);
  const starch = merge('chloro-starch', [
    Object.assign(MeshBuilder.CreateSphere('st-0', { diameterX: 0.08, diameterY: 0.035, diameterZ: 0.05, segments: 10 }, scene), { position: new Vector3(-0.12, -0.05, 0.1) }),
    Object.assign(MeshBuilder.CreateSphere('st-1', { diameterX: 0.065, diameterY: 0.03, diameterZ: 0.045, segments: 10 }, scene), { position: new Vector3(0.17, -0.05, -0.09) }),
  ], M.starch);
  return { r, closed, outer, stroma, thylakoids, starch };
}

/** A centriole: nine triplets of microtubules in a ring, 0.22 µm wide and 0.47 µm long, along y. */
function centrioleMesh(scene, name, M) {
  const list = [];
  const R = 0.0165;
  for (let i = 0; i < 9; i++) {
    const a = (i * TAU) / 9;
    const ring = new Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
    const tangent = new Vector3(-Math.sin(a), 0, Math.cos(a));
    const inward = ring.normalizeToNew().scale(-1);
    const w = tangent.scale(Math.cos(0.75)).add(inward.scale(Math.sin(0.75)));
    for (let j = 0; j < 3; j++) {
      const c = MeshBuilder.CreateCylinder(`${name}-${i}-${j}`, { height: 0.07, diameter: 0.0044, tessellation: 6 }, scene);
      c.position = ring.add(w.scale((j - 1) * 0.0043));
      list.push(c);
    }
  }
  return merge(name, list, M.centriole);
}

// ---------------------------------------------------------------- building helpers

function builder(scene, parts, cell) {
  const nodes = parts.nodes;
  return {
    nodesRef: nodes,
    /** A part from content.js's text `key`, under `parent`. */
    node(key, parent, opts = {}) {
      return parts.add({ key, name: PARTS[key]?.name ?? key, parent, cell, ...opts });
    },
    /** Puts mesh in part `id` (moving with it); `shown()` decides when it's drawn. */
    put(mesh, id, shown = null, extra = {}) {
      if (!mesh) return null;
      mesh.parent = nodes[id].t;
      parts.claim(mesh, id);
      Object.assign(mesh.metadata, extra);
      if (shown) mesh.metadata.shown = shown;
      mesh.isPickable = true;
      return mesh;
    },
    at(id, position, rotation = null) {
      const t = nodes[id].t;
      t.position.copyFrom(position);
      if (rotation) t.rotationQuaternion.copyFrom(rotation);
      return t;
    },
  };
}

const cutOnly = () => VIEW.cut;
const wholeOnly = () => !VIEW.cut;

/** A surface's outward normal at p (numerically, from superScale). */
function normalAt(r, e1, e2, p) {
  const e = 1e-3;
  const f = (q) => superScale(r, e1, e2, q);
  return new Vector3(
    f(p.add(new Vector3(e, 0, 0))) - f(p.add(new Vector3(-e, 0, 0))),
    f(p.add(new Vector3(0, e, 0))) - f(p.add(new Vector3(0, -e, 0))),
    f(p.add(new Vector3(0, 0, e))) - f(p.add(new Vector3(0, 0, -e))),
  ).normalize();
}
/** Takes p straight out (or in) from the centre onto the superellipsoid. */
const onto = (r, e1, e2, p) => p.scale(1 / superScale(r, e1, e2, p));

/** A random point on a rounded box's faces (spread by area), on the surface of radii r. */
function boxPoint(rnd, r, e) {
  const areas = [r.y * r.z, r.y * r.z, r.x * r.z, r.x * r.z, r.x * r.y, r.x * r.y];
  let k = rnd() * areas.reduce((a, b) => a + b, 0), f = 0;
  while (k > areas[f]) k -= areas[f++];
  const s = () => (rnd() * 2 - 1) * 0.92;
  const p = [
    new Vector3(r.x, s() * r.y, s() * r.z), new Vector3(-r.x, s() * r.y, s() * r.z),
    new Vector3(s() * r.x, r.y, s() * r.z), new Vector3(s() * r.x, -r.y, s() * r.z),
    new Vector3(s() * r.x, s() * r.y, r.z), new Vector3(s() * r.x, s() * r.y, -r.z),
  ][f];
  return onto(r, e, e, p);
}

/** Is p inside the ellipsoid with centre c, rotation q and radii r (padded by pad)? */
function inEllipsoid(p, c, q, r, pad = 0) {
  const local = p.subtract(c).applyRotationQuaternion(Quaternion.Inverse(q));
  return (local.x / (r.x + pad)) ** 2 + (local.y / (r.y + pad)) ** 2 + (local.z / (r.z + pad)) ** 2 < 1;
}

// ---------------------------------------------------------------- the nucleus (both cells)

/**
 * `mode` 'wedge': cut with the cell (the animal's, in the middle of its cell); 'half': whole, opening its top
 * half when you look inside (the plant's, off to one side).
 */
function buildNucleus(scene, b, M, parent, { r, centre, mode, rnd, strands }) {
  const id = b.node('nucleus', parent, { grab: true, openable: mode === 'half' });
  b.at(id, centre);
  const n = () => b.nodesRef[id];
  const isOpen = () => n().opened;
  const R = new Vector3(r, r, r);
  const env = b.node('envelope', id);
  const envT = 0.022;
  const nucleolusR = 1 * UM * 0.95;
  const nucleolusC = mode === 'wedge' ? Vector3.Zero() : new Vector3(0.09, -0.19, 0.05);
  const lumpy = wobble(0.09, 3);

  if (mode === 'wedge') {
    b.put(shell('envelope-cut', scene, { r: R, t0: HALF, seg: 64, rings: 40, thickness: envT, material: M.envelope }), env, cutOnly);
    b.put(shell('envelope-whole', scene, { r: R, seg: 56, rings: 36, material: M.envelope }), env, wholeOnly);
  } else {
    b.put(shell('envelope-whole', scene, { r: R, seg: 56, rings: 36, material: M.envelope }), env, () => !isOpen());
    b.put(shell('envelope-open', scene, { r: R, p1: 0, seg: 60, rings: 22, thickness: envT, material: M.envelope }), env, isOpen);
  }

  // Nuclear pores: rings through the envelope.
  const pores = b.node('pores', env);
  const poreAt = (keep) => {
    const list = [];
    for (let i = 0; i < 900 && list.length < 380; i++) {
      const d = randomDir(rnd);
      const p = d.scale(r + 0.002);
      if (keep(p)) list.push(placeAt(p, d, 1, rnd() * TAU));
    }
    return list;
  };
  const torus = () => MeshBuilder.CreateTorus('pore', { diameter: 0.018, thickness: 0.0065, tessellation: 6 }, scene);
  if (mode === 'wedge') {
    b.put(scatter('pores', torus(), poreAt((p) => fromCut(p) > 0.015), M.pore), pores);
  } else {
    b.put(scatter('pores-whole', torus(), poreAt(() => true), M.pore), pores, () => !isOpen());
    b.put(scatter('pores-open', torus(), poreAt((p) => p.y < -0.012), M.pore), pores, isOpen);
  }

  // The nucleolus: lumpy, dense, no membrane.
  const nuc = b.node('nucleolus', id, { grab: true });
  b.at(nuc, nucleolusC);
  const NR = new Vector3(nucleolusR, nucleolusR, nucleolusR);
  if (mode === 'wedge') {
    b.put(shell('nucleolus', scene, { r: NR, t0: HALF, seg: 40, rings: 28, deform: lumpy, material: M.nucleolus }), nuc);
    for (const th of [0, HALF]) {
      b.put(cap(`nucleolus-cap-${th}`, scene, th, cutCurve(NR, 1, 1, th, { deform: lumpy })), nuc, cutOnly, { cap: true }).material = M.nucleolus;
    }
  } else {
    b.put(shell('nucleolus', scene, { r: NR, seg: 32, rings: 22, deform: lumpy, material: M.nucleolus }), nuc, isOpen);
  }

  // Chromatin: the DNA, as loose strands winding through the nucleus.
  const keep = mode === 'wedge' ? (p) => fromCut(p) > 0.02 : (p) => p.y < -0.03;
  const ok = (p) => p.length() < r - envT - 0.03 && Vector3.Distance(p, nucleolusC) > nucleolusR + 0.03 && keep(p);
  const paths = [];
  for (let s = 0; s < strands; s++) {
    let p = null;
    for (let k = 0; k < 60 && !p; k++) {
      const q = randomDir(rnd).scale(rnd() * (r - 0.06));
      if (ok(q)) p = q;
    }
    if (!p) continue;
    const pts = [p];
    let dir = randomDir(rnd);
    for (let i = 0; i < 26; i++) {
      let next = null;
      for (let k = 0; k < 10 && !next; k++) {
        const d = dir.scale(0.7).add(randomDir(rnd).scale(0.7)).normalize();
        const q = p.add(d.scale(0.032));
        if (ok(q)) { next = q; dir = d; }
      }
      if (!next) break;
      pts.push((p = next));
    }
    if (pts.length > 3) paths.push(smooth(pts, 2));
  }
  const chrom = b.node('chromatin', id, { grab: true });
  b.put(tubes('chromatin', scene, paths, { radius: 0.0055, tessellation: 4, material: M.chromatin }), chrom, mode === 'wedge' ? null : isOpen);

  if (mode === 'wedge') {
    const np = b.node('nucleoplasm', id);
    const RI = new Vector3(r - envT, r - envT, r - envT);
    for (const th of [0, HALF]) {
      const m = cap(`nucleoplasm-${th}`, scene, th, cutCurve(RI, 1, 1, th, { n: 48 }), cutCurve(NR, 1, 1, th, { deform: lumpy }), { material: M.nucleoplasm });
      b.put(m, np, cutOnly, { cap: true });
    }
  }
  return id;
}

/** Rough ER: stacks of curved sheets round the nucleus, studded with ribosomes on both faces. */
function buildRoughEr(scene, b, M, parent, { centre, stacks, rnd, ribTemplate }) {
  const id = b.node('rough-er', parent, { grab: true });
  const sheets = [];
  const ribs = [];
  const h = 0.011;
  stacks.forEach((s, si) => {
    for (let k = 0; k < s.n; k++) {
      const rr = s.r + k * 0.048;
      const seed = si * 3.1 + k;
      const f = (u, v) => {
        const th = s.t0 + (s.t1 - s.t0) * u;
        const ph = s.p0 + (s.p1 - s.p0) * v;
        const rad = rr * (1 + 0.03 * Math.sin(7 * u + 3 * v + seed) + 0.015 * Math.sin(13 * v + seed));
        return centre.add(superPoint(new Vector3(rad, rad, rad), 1, 1, th, ph));
      };
      sheets.push(pillow(`rer-${si}-${k}`, scene, f, { h, nu: 18, nv: 12 }));
      for (let i = 0; i < 120; i++) {
        const u = 0.06 + rnd() * 0.88, v = 0.06 + rnd() * 0.88;
        const p = f(u, v);
        const out = p.subtract(centre).normalize();
        const bulge = Math.sqrt(Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
        const side = rnd() < 0.5 ? 1 : -1;
        ribs.push(placeAt(p.add(out.scale(side * (h * bulge + 0.006))), out, 1, rnd() * TAU));
      }
    }
  });
  b.put(merge('rough-er', sheets, M.roughEr), id);
  const rid = b.node('er-ribosomes', id);
  b.put(scatter('er-ribosomes', ribTemplate(), ribs, M.ribosome), rid);
  return id;
}

/** Golgi stack: `n` curved cisternae along local y, budding vesicles at the rims. */
function buildGolgi(scene, b, M, parent, { at, axis, n, rc, rnd, key = 'golgi' }) {
  const id = b.node(key, parent, { grab: true });
  b.at(id, at, turnTo(axis));
  const sacs = [];
  const gap = 0.024;
  const curve = 0.9;
  for (let k = 0; k < n; k++) {
    const yk = (k - (n - 1) / 2) * gap;
    const R = rc * (0.75 + 0.3 * Math.sin((Math.PI * (k + 0.5)) / n));
    sacs.push(pillow(`golgi-${k}`, scene, (u, v) => {
      const a = v * TAU;
      const rho = u * R * (1 + 0.07 * Math.sin(3 * a + k));
      return new Vector3(rho * Math.cos(a), yk - curve * rho * rho + 0.004 * Math.sin(5 * a + k), rho * Math.sin(a));
    }, { h: 0.0065, nu: 10, nv: 26, bulge: (u) => Math.sqrt(Math.max(0, 1 - u * u)) * (0.55 + 1.2 * u ** 6) }));
  }
  b.put(merge(key, sacs, M.golgi), id);
  const ves = [];
  const count = Math.round(4.5 * n);
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rnd() * n);
    const yk = (k - (n - 1) / 2) * gap;
    const R = rc * (0.75 + 0.3 * Math.sin((Math.PI * (k + 0.5)) / n)) + 0.016;
    const a = rnd() * TAU;
    const s = MeshBuilder.CreateIcoSphere(`gv-${i}`, { radius: 0.0075 + rnd() * 0.004, subdivisions: 2 }, scene);
    s.position.set(R * Math.cos(a), yk - curve * R * R + (rnd() - 0.5) * 0.01, R * Math.sin(a));
    ves.push(s);
  }
  const vid = b.node('golgi-vesicles', id);
  b.put(merge('golgi-vesicles', ves, M.vesicle), vid);
  return id;
}

function addMito(scene, b, tpl, group, p, q, i) {
  const id = b.node('mitochondrion', group, { grab: true, openable: true, name: 'Mitochondrion' });
  b.at(id, p, q);
  const isOpen = () => b.nodesRef[id].opened;
  const outer = b.node('mito-outer', id);
  b.put(tpl.closed.clone(`mito-${i}-closed`), outer, () => !isOpen());
  b.put(tpl.outer.clone(`mito-${i}-open`), outer, isOpen);
  const inner = b.node('mito-inner', id);
  b.put(tpl.inner.clone(`mito-${i}-inner`), inner, isOpen);
  b.put(tpl.cristae.clone(`mito-${i}-cristae`), inner, isOpen);
  const matrix = b.node('mito-matrix', id);
  b.put(tpl.matrix.clone(`mito-${i}-matrix`), matrix, isOpen);
  return id;
}

function addPeroxisome(scene, b, M, group, p, rnd, i) {
  const id = b.node('peroxisome', group, { grab: true });
  b.at(id, p);
  const r = 0.042 + rnd() * 0.01;
  b.put(MeshBuilder.CreateSphere(`perox-${i}`, { diameter: r * 2, segments: 12 }, scene), id).material = M.peroxisome;
  const core = MeshBuilder.CreateBox(`perox-core-${i}`, { size: r * 0.7 }, scene);
  core.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  b.put(core, id).material = M.peroxCore;
  return id;
}

const ribosomeTemplate = (scene) => () => MeshBuilder.CreateIcoSphere('ribosome', { radius: 0.0058, subdivisions: 1 }, scene);

// ---------------------------------------------------------------- the animal cell

export const ANIMAL = { r: 10 * UM, nucleus: 3 * UM };

function buildAnimal(scene, parts, M, T) {
  const cell = 'animal';
  const b = builder(scene, parts, cell);
  const rnd = random(11);
  const R = ANIMAL.r;
  const wob = wobble(0.03, 1);
  const memT = 0.025;
  const id = b.node('animal-cell', null);
  const root = parts.nodes[id].t;

  // The membrane, and the cytoplasm's faces on the cut.
  const mem = b.node('membrane', id, { boundary: true, anchor: superPoint(new Vector3(R, R, R), 1, 1, HALF + 0.35, 0.55).scale(1.0) });
  const RV = new Vector3(R, R, R);
  b.put(shell('membrane-cut', scene, { r: RV, t0: HALF, seg: 96, rings: 60, thickness: memT, deform: wob, material: M.membrane }), mem, cutOnly);
  b.put(shell('membrane-whole', scene, { r: RV, seg: 80, rings: 52, deform: wob, material: M.membrane }), mem, wholeOnly);

  const nC = new Vector3(0, 0.04, 0);
  const NR = new Vector3(ANIMAL.nucleus, ANIMAL.nucleus, ANIMAL.nucleus);
  const cyto = b.node('cytoplasm', id, { anchor: new Vector3(1.05, -0.55, 0) });
  const RIN = new Vector3(R - memT, R - memT, R - memT);
  for (const th of [0, HALF]) {
    const inner = cutCurve(NR, 1, 1, th, { n: 48 }).map((p) => p.add(nC));
    b.put(cap(`cytoplasm-${th}`, scene, th, cutCurve(RIN, 1, 1, th, { n: 64, deform: wob }), inner, { n: 64, material: M.cytoplasm }), cyto, cutOnly, { cap: true });
  }

  const nucleus = buildNucleus(scene, b, M, id, { r: ANIMAL.nucleus, centre: nC, mode: 'wedge', rnd, strands: 46 });
  const nId = (key) => parts.nodes.find((n) => n.cell === cell && n.key === key).id;
  parts.nodes[nId('nucleolus')].anchor = new Vector3(0.09, 0, 0);
  parts.nodes[nucleus].anchor = new Vector3(0.3, 0.3, 0);
  parts.nodes[nId('chromatin')].anchor = new Vector3(0.12, -0.25, -0.2);

  buildRoughEr(scene, b, M, id, {
    centre: nC, rnd, ribTemplate: ribosomeTemplate(scene),
    stacks: [
      { t0: 1.75, t1: 3.0, p0: -0.65, p1: 0.45, r: 0.52, n: 4 },
      { t0: 3.15, t1: 4.35, p0: -0.25, p1: 0.85, r: 0.535, n: 4 },
      { t0: 4.5, t1: 6.15, p0: -0.95, p1: 0.05, r: 0.52, n: 4 },
      { t0: 2.2, t1: 3.7, p0: 0.62, p1: 1.15, r: 0.53, n: 3 },
      { t0: 4.9, t1: 6.1, p0: 0.3, p1: 0.95, r: 0.545, n: 3 },
    ],
  });
  parts.nodes[nId('rough-er')].anchor = superPoint(new Vector3(0.62, 0.62, 0.62), 1, 1, 2.0, -0.1).add(nC);

  // The Golgi apparatus and the centrosome, side by side next to the nucleus.
  const G = new Vector3(-0.55, 0.25, -0.8).normalize().scale(0.93);
  buildGolgi(scene, b, M, id, { at: G, axis: G.scale(-1), n: 6, rc: 0.17, rnd });
  const C = new Vector3(-0.12, 0.44, -0.66);
  const cs = b.node('centrosome', id, { grab: true });
  b.at(cs, C);
  const c1 = b.node('centriole', cs, { grab: true });
  b.put(centrioleMesh(scene, 'centriole-1', M), c1);
  const c2 = b.node('centriole', cs, { grab: true });
  b.at(c2, new Vector3(0, -0.012, 0.045), Quaternion.RotationAxis(Vector3.Right(), HALF));
  b.put(centrioleMesh(scene, 'centriole-2', M), c2);
  const pcm = b.node('pcm', cs);
  b.put(MeshBuilder.CreateSphere('pcm', { diameter: 0.15, segments: 12 }, scene), pcm).material = M.pcm;

  // Where things already are (centre, radius): nothing else goes there.
  const taken = [{ p: nC, r: 0.73 }, { p: G, r: 0.27 }, { p: C, r: 0.11 }];
  const free = (p, r) => taken.every((t) => Vector3.Distance(p, t.p) > t.r + r);
  const inside = (p, r) => p.length() + r < R * 0.955 && fromCut(p) > r + 0.02;

  // Smooth ER: tubes branching off the edge of the rough ER.
  const ser = [];
  const ok = (p) => inside(p, 0.02) && Vector3.Distance(p, nC) > 0.6 && Vector3.Distance(p, G) > 0.3 && Vector3.Distance(p, C) > 0.15;
  for (let i = 0; i < 34; i++) {
    let p;
    if (ser.length && rnd() < 0.45) {
      const from = ser[Math.floor(rnd() * ser.length)];
      p = from[Math.floor(rnd() * from.length)];
    } else {
      p = superPoint(new Vector3(0.74, 0.74, 0.74), 1, 1, 4.6 + rnd() * 1.45, -1.0 + rnd() * 0.85).add(nC);
    }
    const pts = [p];
    let dir = p.subtract(nC).normalize();
    for (let k = 0; k < 7; k++) {
      const d = dir.scale(0.55).add(randomDir(rnd).scale(0.85)).normalize();
      const q = p.add(d.scale(0.065));
      if (!ok(q)) continue;
      pts.push((p = q));
      dir = d;
    }
    if (pts.length > 2) ser.push(smooth(pts, 4));
  }
  const serId = b.node('smooth-er', id, { grab: true });
  b.put(tubes('smooth-er', scene, ser, { radius: 0.0068, tessellation: 5, material: M.smoothEr }), serId);
  parts.nodes[serId].anchor = ser[0][Math.floor(ser[0].length / 2)];

  // Vesicles: from the ER to the Golgi, and from the Golgi out to the membrane (one joining it).
  const vg = b.node('vesicles', id, { grab: true });
  const small = [], big = [];
  const gd = G.normalizeToNew();
  for (let i = 0; i < 12; i++) {
    const p = gd.scale(0.74 + rnd() * 0.08).add(randomDir(rnd).scale(0.06)).add(nC);
    const s = MeshBuilder.CreateIcoSphere(`tv-${i}`, { radius: 0.008, subdivisions: 2 }, scene);
    s.position = p;
    small.push(s);
  }
  let placedBig = 0;
  for (let i = 0; i < 80 && placedBig < 8; i++) {
    const rr = 0.02 + rnd() * 0.016;
    const p = gd.add(randomDir(rnd).scale(0.5)).normalize().scale(1.05 + rnd() * 0.3);
    if (!inside(p, rr) || !free(p, rr)) continue;
    const s = MeshBuilder.CreateIcoSphere(`sv-${i}`, { radius: rr, subdivisions: 2 }, scene);
    s.position = p;
    big.push(s);
    taken.push({ p, r: rr });
    placedBig++;
  }
  const fuse = MeshBuilder.CreateSphere('sv-fusing', { diameter: 0.06, segments: 12, slice: 0.6 }, scene);
  const fuseAt = new Vector3(-0.45, 0.62, -1.18).normalize();
  fuse.position = fuseAt.scale(R - memT - 0.004);
  fuse.rotationQuaternion = turnTo(fuseAt.scale(-1));
  big.push(fuse);
  b.put(merge('vesicles-small', small, M.vesicle), vg);
  b.put(merge('vesicles-secretory', big, M.secretory), vg);

  // Mitochondria.
  const mg = b.node('mitochondria', id);
  let first = null;
  for (let i = 0, placed = 0; i < 4000 && placed < 26; i++) {
    const p = randomDir(rnd).scale(0.9 + rnd() * 0.36);
    if (!inside(p, 0.19) || !free(p, 0.19)) continue;
    const q = Quaternion.RotationYawPitchRoll(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    const m = addMito(scene, b, T.mito, mg, p, q, `a${placed}`);
    first ??= p;
    taken.push({ p, r: 0.19 });
    placed++;
  }
  parts.nodes[mg].anchor = first;

  // Lysosomes and peroxisomes.
  const lg = b.node('lysosomes', id);
  first = null;
  for (let i = 0, placed = 0; i < 3000 && placed < 11; i++) {
    const r = 0.04 + rnd() * 0.028;
    const p = randomDir(rnd).scale(0.8 + rnd() * 0.55);
    if (!inside(p, r) || !free(p, r)) continue;
    const l = b.node('lysosome', lg, { grab: true });
    b.at(l, p);
    b.put(shell(`lysosome-${placed}`, scene, { r: new Vector3(r, r, r), seg: 16, rings: 12, deform: wobble(0.08, placed), material: M.lysosome }), l);
    first ??= p;
    taken.push({ p, r });
    placed++;
  }
  parts.nodes[lg].anchor = first;
  const pg = b.node('peroxisomes', id);
  first = null;
  for (let i = 0, placed = 0; i < 3000 && placed < 7; i++) {
    const p = randomDir(rnd).scale(0.8 + rnd() * 0.5);
    if (!inside(p, 0.06) || !free(p, 0.06)) continue;
    addPeroxisome(scene, b, M, pg, p, rnd, `a${placed}`);
    first ??= p;
    taken.push({ p, r: 0.06 });
    placed++;
  }
  parts.nodes[pg].anchor = first;

  // The cytoskeleton.
  const sk = b.node('cytoskeleton', id);
  const mt = [];
  for (let i = 0; i < 200 && mt.length < 70; i++) {
    const d = randomDir(rnd);
    const bc = Vector3.Dot(C, d), cc = C.lengthSquared() - (R * 0.93) ** 2;
    const s = -bc + Math.sqrt(bc * bc - cc);
    const bend = randomDir(rnd).scale(0.07);
    const pts = [];
    let good = true;
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const p = C.add(d.scale(0.06 + (s - 0.06) * t)).add(bend.scale(Math.sin(Math.PI * t)));
      if (fromCut(p) < 0.012 || Vector3.Distance(p, nC) < 0.49) { good = false; break; }
      pts.push(p);
    }
    if (good) mt.push(pts);
  }
  const mtId = b.node('microtubules', sk);
  b.put(tubes('microtubules', scene, mt, { radius: 0.0034, tessellation: 4, material: M.microtubule }), mtId);
  parts.nodes[mtId].anchor = mt[0][8];
  const ac = [];
  for (let i = 0; i < 1500 && ac.length < 560; i++) {
    const d = randomDir(rnd);
    const t = Vector3.Cross(d, randomDir(rnd)).normalize();
    const a = wob(d.scale(R - memT - 0.012));
    const e = wob(d.add(t.scale(0.07 + rnd() * 0.05)).normalize().scale(R - memT - 0.012));
    if (fromCut(a) < 0.012 || fromCut(e) < 0.012) continue;
    ac.push([a, e]);
  }
  const acId = b.node('actin', sk);
  b.put(tubes('actin', scene, ac, { radius: 0.0022, tessellation: 3, material: M.actin }), acId);
  parts.nodes[acId].anchor = ac[0][0];
  const inf = [];
  for (let i = 0; i < 200 && inf.length < 22; i++) {
    const d = randomDir(rnd);
    const pts = [];
    let good = true;
    for (let k = 0; k <= 8; k++) {
      const rr = 0.47 + (R * 0.93 - 0.47) * (k / 8);
      const p = nC.add(d.scale(rr)).add(randomDir(rnd).scale(k && k < 8 ? 0.04 : 0));
      if (fromCut(p) < 0.015 || Vector3.Distance(p, G) < 0.28) { good = false; break; }
      pts.push(p);
    }
    if (good) inf.push(smooth(pts, 3));
  }
  const ifId = b.node('intermediate', sk);
  b.put(tubes('intermediate', scene, inf, { radius: 0.0032, tessellation: 4, material: M.intermediate }), ifId);
  parts.nodes[ifId].anchor = inf[0][Math.floor(inf[0].length * 0.7)];

  // Free ribosomes, alone and in strings (polysomes).
  const ribs = [];
  const mitoTaken = taken.slice(3);
  const clear = (p) => inside(p, 0.01) && Vector3.Distance(p, nC) > 0.74 && mitoTaken.every((t) => Vector3.Distance(p, t.p) > t.r);
  for (let i = 0; i < 4000 && ribs.length < 700; i++) {
    const p = randomDir(rnd).scale(0.75 + rnd() * 0.68);
    if (clear(p)) ribs.push(placeAt(p, randomDir(rnd)));
  }
  for (let i = 0, made = 0; i < 400 && made < 50; i++) {
    const c = randomDir(rnd).scale(0.8 + rnd() * 0.55);
    const ax = randomDir(rnd), u = Vector3.Cross(ax, randomDir(rnd)).normalize(), v = Vector3.Cross(ax, u);
    const string = [];
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9;
      string.push(c.add(u.scale(Math.cos(a) * 0.018)).add(v.scale(Math.sin(a) * 0.018)).add(ax.scale(k * 0.008)));
    }
    if (!string.every(clear)) continue;
    for (const p of string) ribs.push(placeAt(p, ax));
    made++;
  }
  const rbId = b.node('ribosomes', id);
  b.put(scatter('ribosomes', ribosomeTemplate(scene)(), ribs, M.ribosome), rbId);
  parts.nodes[rbId].anchor = ribs[3].getTranslation();

  return { id, root, centre: Vector3.Zero(), size: R * 2 };
}

// ---------------------------------------------------------------- the plant cell

export const PLANT = { r: new Vector3(20, 12.5, 12.5).scale(UM), e: 0.22, wall: 0.06 };

function buildPlant(scene, parts, M, T) {
  const cell = 'plant';
  const b = builder(scene, parts, cell);
  const rnd = random(29);
  const E = PLANT.e;
  const RW = PLANT.r;
  const off = (r, d) => r.subtract(new Vector3(d, d, d));
  const RM = off(RW, PLANT.wall + 0.003);
  const memT = 0.018;
  const RMI = off(RM, memT);
  const layer = 2.2 * UM;               // the cytoplasm between the membrane and the vacuole
  const EV = 0.35;
  const RV = off(RMI, layer);
  const id = b.node('plant-cell', null);
  const root = parts.nodes[id].t;
  /** A surface `depth` in from the membrane's inner face. */
  const depthR = (depth) => off(RMI, depth);
  const at = (depth, p) => onto(depthR(depth), E, E, p);
  const nId = (key) => parts.nodes.find((n) => n.cell === cell && n.key === key).id;

  // Cell wall, with plasmodesmata through it.
  const wall = b.node('cell-wall', id, { boundary: true, anchor: onto(RW, E, E, new Vector3(-1.4, 1.9, 1.9)) });
  b.put(shell('wall-cut', scene, { r: RW, e1: E, e2: E, t0: HALF, seg: 120, rings: 60, thickness: PLANT.wall, material: M.wall }), wall, cutOnly);
  b.put(shell('wall-whole', scene, { r: RW, e1: E, e2: E, seg: 100, rings: 52, material: M.wall }), wall, wholeOnly);
  const pd = [];
  for (let i = 0; i < 2000 && pd.length < 160; i++) {
    const p = boxPoint(rnd, off(RW, PLANT.wall / 2), E);
    if (fromCut(p) < 0.03) continue;
    pd.push(placeAt(p, normalAt(RW, E, E, p)));
  }
  const pdId = b.node('plasmodesmata', wall);
  b.put(scatter('plasmodesmata', MeshBuilder.CreateCylinder('pd', { height: PLANT.wall + 0.03, diameter: 0.012, tessellation: 6 }, scene), pd, M.plasmo), pdId);
  parts.nodes[pdId].anchor = pd[5].getTranslation();

  // Cell membrane, pressed against the wall.
  const mem = b.node('membrane', id, { boundary: true, anchor: onto(RM, E, E, new Vector3(-0.6, -1.9, 1.9)) });
  b.put(shell('pmembrane-cut', scene, { r: RM, e1: E, e2: E, t0: HALF, seg: 112, rings: 56, thickness: memT, material: M.membrane }), mem, cutOnly);

  // What's in the cytoplasm, placed first, so the vacuole can make room for it.
  const pushers = [];      // ellipsoids the vacuole stays out of: { c, q, r }
  const solids = [];       // what else can't overlap: { c, q, r }
  const clashes = (c, q, r, gap = 0.02) => solids.some((s) => Vector3.Distance(c, s.c) < Math.max(r.x, r.y, r.z) + Math.max(s.r.x, s.r.y, s.r.z) * 0.85 + gap);
  const extremes = (c, q, r) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([x, y, z]) => c.add(new Vector3(x * r.x, y * r.y, z * r.z).applyRotationQuaternion(q)));
  const fits = (c, q, r) => extremes(c, q, r).every((p) => superScale(RMI, E, E, p) < 0.992 && fromCut(p) > 0.03);
  /** A frame lying flat on the wall at p: y into the cell (the side that opens, facing you inside), x along it. */
  const flat = (p, spin) => {
    const n = normalAt(RMI, E, E, p).scale(-1);
    return Quaternion.RotationAxis(n, spin).multiply(turnTo(n));
  };

  // The nucleus, pressed against the back wall, its rough ER on the side facing the vacuole.
  const nR = 3.5 * UM;
  const nC = new Vector3(-1.15, -0.3, -(RMI.z - nR - 0.05));
  const nucleus = buildNucleus(scene, b, M, id, { r: nR, centre: nC, mode: 'half', rnd, strands: 30 });
  pushers.push({ c: nC, q: Quaternion.Identity(), r: new Vector3(nR + 0.17, nR + 0.17, nR + 0.17) });
  solids.push({ c: nC, q: Quaternion.Identity(), r: new Vector3(nR + 0.16, nR + 0.16, nR + 0.16) });
  buildRoughEr(scene, b, M, id, {
    centre: nC, rnd, ribTemplate: ribosomeTemplate(scene),
    stacks: [
      { t0: HALF - 0.95, t1: HALF + 0.5, p0: -0.55, p1: 0.6, r: 0.565, n: 3 },
      { t0: HALF + 0.7, t1: HALF + 1.9, p0: -0.25, p1: 0.75, r: 0.57, n: 3 },
    ],
  });
  parts.nodes[nId('rough-er')].anchor = nC.add(superPoint(new Vector3(0.62, 0.62, 0.62), 1, 1, HALF - 0.2, 0.0));
  parts.nodes[nucleus].anchor = new Vector3(0.35, 0.3, 0.25);

  // Chloroplasts, lying flat against the walls.
  const cr = T.chloro.r;
  const cg = b.node('chloroplasts', id);
  const chloros = [];
  for (let i = 0; i < 6000 && chloros.length < 24; i++) {
    const p = at(0.03 + cr.y, boxPoint(rnd, RMI, E));
    const q = flat(p, rnd() * TAU);
    if (!fits(p, q, cr) || clashes(p, q, cr, 0.04)) continue;
    const cid = b.node('chloroplast', cg, { grab: true, openable: true });
    b.at(cid, p, q);
    const isOpen = () => parts.nodes[cid].opened;
    const env = b.node('chloro-envelope', cid);
    const k = chloros.length;
    b.put(T.chloro.closed.clone(`chloro-${k}-closed`), env, () => !isOpen());
    b.put(T.chloro.outer.clone(`chloro-${k}-open`), env, isOpen);
    b.put(T.chloro.stroma.clone(`chloro-${k}-stroma`), b.node('stroma', cid), isOpen);
    b.put(T.chloro.thylakoids.clone(`chloro-${k}-thyl`), b.node('thylakoids', cid), isOpen);
    b.put(T.chloro.starch.clone(`chloro-${k}-starch`), b.node('starch', cid), isOpen);
    chloros.push(p);
    solids.push({ c: p, q, r: cr });
    pushers.push({ c: p, q, r: cr.add(new Vector3(0.04, 0.04, 0.04)) });
  }
  parts.nodes[cg].anchor = chloros[0];

  // Mitochondria, peroxisomes and Golgi stacks in the same thin layer.
  const mr = T.mito.r;
  const mg = b.node('mitochondria', id);
  let first = null;
  for (let i = 0, placed = 0; i < 6000 && placed < 14; i++) {
    const p = at(0.15, boxPoint(rnd, RMI, E));
    // Long axis (z) along the wall, the side that opens facing into the cell.
    const q = flat(p, rnd() * TAU);
    if (!fits(p, q, mr) || clashes(p, q, mr)) continue;
    addMito(scene, b, T.mito, mg, p, q, `p${placed}`);
    first ??= p;
    solids.push({ c: p, q, r: mr });
    pushers.push({ c: p, q, r: mr.add(new Vector3(0.04, 0.04, 0.04)) });
    placed++;
  }
  parts.nodes[mg].anchor = first;

  const gr = new Vector3(0.11, 0.08, 0.11);
  let golgiFirst = null;
  for (let i = 0, placed = 0; i < 4000 && placed < 5; i++) {
    const p = at(0.17, boxPoint(rnd, RMI, E));
    const n = normalAt(RMI, E, E, p);
    const q = turnTo(n);
    if (!fits(p, q, gr) || clashes(p, q, gr)) continue;
    const gid = buildGolgi(scene, b, M, id, { at: p, axis: n, n: 5, rc: 0.085, rnd });
    golgiFirst ??= gid;
    solids.push({ c: p, q, r: gr });
    pushers.push({ c: p, q, r: gr.add(new Vector3(0.03, 0.03, 0.03)) });
    placed++;
  }

  const pg = b.node('peroxisomes', id);
  first = null;
  const pr = new Vector3(0.055, 0.055, 0.055);
  for (let i = 0, placed = 0; i < 3000 && placed < 6; i++) {
    const p = at(0.12, boxPoint(rnd, RMI, E));
    if (!fits(p, Quaternion.Identity(), pr) || clashes(p, Quaternion.Identity(), pr)) continue;
    addPeroxisome(scene, b, M, pg, p, rnd, `p${placed}`);
    first ??= p;
    solids.push({ c: p, q: Quaternion.Identity(), r: pr });
    pushers.push({ c: p, q: Quaternion.Identity(), r: pr.add(new Vector3(0.03, 0.03, 0.03)) });
    placed++;
  }
  parts.nodes[pg].anchor = first;

  // The central vacuole: most of the cell, pushed in round everything in the cytoplasm.
  const dent = (p) => {
    let v = p;
    for (const s of pushers) {
      const inv = Quaternion.Inverse(s.q);
      const local = v.subtract(s.c).applyRotationQuaternion(inv);
      const k = Math.hypot(local.x / s.r.x, local.y / s.r.y, local.z / s.r.z);
      if (k >= 1 || k === 0) continue;
      v = s.c.add(local.scale(1 / k).applyRotationQuaternion(s.q));
    }
    return v;
  };
  const vac = b.node('vacuole', id, { boundary: true, anchor: superPoint(RV, EV, EV, Math.PI * 0.95, 0.45) });
  b.put(shell('vacuole', scene, { r: RV, e1: EV, e2: EV, t0: HALF, seg: 150, rings: 84, deform: dent, material: M.tonoplast }), vac);
  const sap = b.node('cell-sap', vac);
  for (const th of [0, HALF]) {
    b.put(cap(`sap-${th}`, scene, th, cutCurve(RV, EV, EV, th, { n: 64 }), null, { n: 64, material: M.sap }), sap, cutOnly, { cap: true });
  }
  const cyto = b.node('cytoplasm', id, { anchor: new Vector3(2.75, -0.7, 0) });
  for (const th of [0, HALF]) {
    b.put(cap(`pcytoplasm-${th}`, scene, th, cutCurve(RMI, E, E, th, { n: 80 }), cutCurve(RV, EV, EV, th, { n: 64 }), { n: 80, material: M.cytoplasm }), cyto, cutOnly, { cap: true });
  }

  // Cortical ER: a net of tubes between the organelles and the vacuole.
  const erD = layer - 0.045;
  const net = [];
  for (let i = 0; i < 70; i++) {
    let p = at(erD, boxPoint(rnd, RMI, E));
    if (net.length && rnd() < 0.5) {
      const from = net[Math.floor(rnd() * net.length)];
      p = from[Math.floor(rnd() * from.length)];
    }
    const pts = [p];
    let dir = Vector3.Cross(normalAt(RMI, E, E, p), randomDir(rnd)).normalize();
    for (let k = 0; k < 6; k++) {
      const n = normalAt(RMI, E, E, p);
      let d = dir.scale(0.6).add(randomDir(rnd).scale(0.6));
      d = d.subtract(n.scale(Vector3.Dot(d, n))).normalize();
      const q = at(erD, p.add(d.scale(0.14)));
      if (fromCut(q) < 0.03) break;
      pts.push((p = q));
      dir = d;
    }
    if (pts.length > 2) net.push(smooth(pts, 4));
  }
  const serId = b.node('smooth-er', id, { grab: true });
  b.put(tubes('smooth-er', scene, net, { radius: 0.0065, tessellation: 5, material: M.smoothEr }), serId);
  parts.nodes[serId].anchor = net[0][2];

  // The cytoskeleton: hoops of microtubules round the cell just under the membrane, and actin cables.
  const sk = b.node('cytoskeleton', id);
  const hoopR = depthR(0.024);
  const hoops = [];
  for (let x = -RMI.x * 0.9; x <= RMI.x * 0.9; x += 0.14) {
    let run = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * TAU;
      const d = new Vector3(0, Math.cos(a), Math.sin(a));
      let lo = 0, hi = 3;
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (superScale(hoopR, E, E, new Vector3(x, d.y * mid, d.z * mid)) < 1) lo = mid; else hi = mid;
      }
      const p = new Vector3(x, d.y * lo, d.z * lo);
      if (fromCut(p) < 0.012) {
        if (run.length > 1) hoops.push(run);
        run = [];
      } else run.push(p);
    }
    if (run.length > 1) hoops.push(run);
  }
  const mtId = b.node('microtubules', sk);
  b.put(tubes('pmicrotubules', scene, hoops, { radius: 0.0034, tessellation: 4, material: M.microtubule }), mtId);
  parts.nodes[mtId].anchor = hoops[Math.floor(hoops.length / 2)][20];
  const cables = [];
  for (let c = 0; c < 12; c++) {
    const a0 = rnd() * TAU;
    let run = [];
    for (let k = 0; k <= 30; k++) {
      const x = -RMI.x * 0.85 + (2 * RMI.x * 0.85 * k) / 30;
      const a = a0 + 0.25 * Math.sin(k * 0.5 + c);
      const p = at(layer - 0.07, new Vector3(x, Math.cos(a), Math.sin(a)));
      if (fromCut(p) < 0.02) {
        if (run.length > 1) cables.push(smooth(run, 3));
        run = [];
      } else run.push(p);
    }
    if (run.length > 1) cables.push(smooth(run, 3));
  }
  const acId = b.node('actin', sk);
  b.put(tubes('pactin', scene, cables, { radius: 0.0042, tessellation: 4, material: M.actin }), acId);
  parts.nodes[acId].anchor = cables[0][Math.floor(cables[0].length / 2)];

  // Free ribosomes in the cytoplasm.
  const ribs = [];
  for (let i = 0; i < 5000 && ribs.length < 650; i++) {
    const p = at(0.03 + rnd() * (layer - 0.06), boxPoint(rnd, RMI, E));
    if (fromCut(p) < 0.015 || solids.some((s) => inEllipsoid(p, s.c, s.q, s.r, 0.01))) continue;
    ribs.push(placeAt(p, randomDir(rnd)));
  }
  const rbId = b.node('ribosomes', id);
  b.put(scatter('pribosomes', ribosomeTemplate(scene)(), ribs, M.ribosome), rbId);
  parts.nodes[rbId].anchor = ribs[3].getTranslation();
  parts.nodes[golgiFirst].anchor = Vector3.Zero();

  return { id, root, centre: Vector3.Zero(), size: RW.x * 2 };
}

// ---------------------------------------------------------------- both

export function buildCells(scene, parts) {
  const M = palette(scene);
  const T = { mito: mitoTemplate(scene, M), chloro: chloroTemplate(scene, M) };
  const animal = buildAnimal(scene, parts, M, T);
  const plant = buildPlant(scene, parts, M, T);
  for (const t of [...Object.values(T.mito), ...Object.values(T.chloro)]) {
    if (t instanceof Mesh) {
      t.setEnabled(false);
      t.isPickable = false;
    }
  }
  return { animal, plant, M, OPENING };
}
