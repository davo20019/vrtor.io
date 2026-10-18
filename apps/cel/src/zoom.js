// Close-ups of what's too small to see even at 150,000 times: a stretch of DNA, a ribosome making a protein, and
// a patch of the cell membrane, each to scale at its own (larger) magnification, given in content.js. They're
// parts like any other (they can be held), hidden until a card asks for one.
import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, Vector3 } from '@babylonjs/core';
import { PARTS } from './content.js';
import { TAU, mat, placeAt, random, randomDir, scatter, shell, smooth, tubes, wobble } from './geo.js';

const BASE_COLORS = { A: '#e5534b', T: '#4c8be8', G: '#f2c84b', C: '#53c26a' };
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };

function merge(name, list, material) {
  const m = Mesh.MergeMeshes(list, true, true);
  m.name = name;
  m.material = material;
  return m;
}

/** DNA at 60 million times: 2 nm wide (0.12 m), 0.34 nm a base pair (2 cm), a turn every 10.5 pairs. */
function dna(scene, parts, show) {
  const id = parts.add({ key: 'zoom-dna', name: PARTS['zoom-dna'].name, parent: null, cell: 'zoom', grab: true });
  const t = parts.nodes[id].t;
  const seq = 'ATGCGTACCTAGGCATTCAGCTAG';
  const rise = 0.0204, r = 0.06, turn = TAU / 10.5;
  const offset = (144 * Math.PI) / 180;          // the two strands' gap: the major and minor grooves
  const y0 = (-(seq.length - 1) * rise) / 2;
  const strand = (a0) => {
    const pts = [];
    for (let i = -0.5; i <= seq.length - 0.5; i += 0.25) {
      const a = a0 + i * turn;
      pts.push(new Vector3(r * Math.cos(a), y0 + i * rise, r * Math.sin(a)));
    }
    return pts;
  };
  const backbone = mat(scene, 'dna-backbone', { color: '#d9dde6', rough: 0.35, glow: 0.15 });
  const meshes = [tubes('dna-backbone', scene, [strand(0), strand(offset)], { radius: 0.0075, tessellation: 8, material: backbone })];
  const sugars = [];
  const byBase = { A: [], T: [], G: [], C: [] };
  [...seq].forEach((base, i) => {
    const y = y0 + i * rise;
    const a1 = i * turn, a2 = a1 + offset;
    const p1 = new Vector3(r * Math.cos(a1), y, r * Math.sin(a1));
    const p2 = new Vector3(r * Math.cos(a2), y, r * Math.sin(a2));
    for (const p of [p1, p2]) {
      const s = MeshBuilder.CreateIcoSphere(`dna-p-${i}-${sugars.length}`, { radius: 0.011, subdivisions: 2 }, scene);
      s.position = p;
      sugars.push(s);
    }
    // The pair meets a little off the axis, on the minor groove's side.
    const mid = p1.add(p2).scale(0.5).scale(0.35);
    for (const [from, b] of [[p1, base], [p2, PAIR[base]]]) {
      const len = Vector3.Distance(from, mid);
      const c = MeshBuilder.CreateCylinder(`dna-b-${i}-${b}`, { height: len, diameter: 0.011, tessellation: 8 }, scene);
      c.position = from.add(mid).scale(0.5);
      const dir = mid.subtract(from).normalize();
      const axis = Vector3.Cross(Vector3.Up(), dir);
      c.rotationQuaternion = axis.lengthSquared() < 1e-9 ? Quaternion.Identity() : Quaternion.RotationAxis(axis.normalize(), Math.acos(Vector3.Dot(Vector3.Up(), dir)));
      byBase[b].push(c);
    }
  });
  meshes.push(merge('dna-sugars', sugars, mat(scene, 'dna-sugar', { color: '#aeb5c4', rough: 0.4 })));
  for (const [b, list] of Object.entries(byBase)) if (list.length) meshes.push(merge(`dna-${b}`, list, mat(scene, `dna-${b}`, { color: BASE_COLORS[b], rough: 0.4, glow: 0.12 })));
  for (const m of meshes) {
    m.parent = t;
    parts.claim(m, id);
    m.metadata.shown = () => show.has('zoom-dna');
  }
  return id;
}

/** A ribosome at 10 million times: about 25 nm (0.25 m) across, reading messenger RNA and making a protein. */
function ribosome(scene, parts, show) {
  const id = parts.add({ key: 'zoom-ribosome', name: PARTS['zoom-ribosome'].name, parent: null, cell: 'zoom', grab: true });
  const t = parts.nodes[id].t;
  const large = shell('ribo-large', scene, { r: new Vector3(0.12, 0.095, 0.11), seg: 40, rings: 28, deform: wobble(0.12, 5), material: mat(scene, 'ribo-large', { color: '#4f7fd8', rough: 0.55 }) });
  large.position.y = 0.045;
  const small = shell('ribo-small', scene, { r: new Vector3(0.115, 0.05, 0.085), seg: 36, rings: 22, deform: wobble(0.15, 9), material: mat(scene, 'ribo-small', { color: '#9cc0f2', rough: 0.55 }) });
  small.position.y = -0.075;
  // The messenger RNA threads between the two subunits; the new protein comes out of the top.
  const rnd = random(5);
  const mrna = [];
  for (let k = 0; k <= 24; k++) {
    const x = -0.32 + (0.64 * k) / 24;
    mrna.push(new Vector3(x, -0.03 + 0.012 * Math.sin(k * 1.3), 0.012 * Math.cos(k * 0.9)));
  }
  const rna = tubes('mrna', scene, [smooth(mrna, 3)], { radius: 0.0065, tessellation: 8, material: mat(scene, 'mrna', { color: '#ff9a3c', rough: 0.4, glow: 0.2 }) });
  const beads = [];
  let p = new Vector3(0.01, 0.12, 0);
  const colors = ['#ef6f6c', '#f5c25d', '#7fcf8a', '#c79bf0', '#68c3e8'];
  const chain = [];
  for (let k = 0; k < 14; k++) {
    const s = MeshBuilder.CreateIcoSphere(`aa-${k}`, { radius: 0.013, subdivisions: 2 }, scene);
    s.position = p.clone();
    chain.push({ s, c: colors[k % colors.length] });
    p = p.add(new Vector3((rnd() - 0.5) * 0.03, 0.022, (rnd() - 0.5) * 0.03));
  }
  const byColor = {};
  for (const { s, c } of chain) (byColor[c] ??= []).push(s);
  const meshes = [large, small, rna, ...Object.entries(byColor).map(([c, list]) => merge(`aa-${c}`, list, mat(scene, `aa-${c}`, { color: c, rough: 0.45, glow: 0.1 })))];
  for (const m of meshes) {
    m.parent = t;
    parts.claim(m, id);
    m.metadata.shown = () => show.has('zoom-ribosome');
  }
  return id;
}

/** The membrane at 10 million times: two layers of phospholipids (8 cm thick), proteins in it, sugars on top. */
function membrane(scene, parts, show) {
  const id = parts.add({ key: 'zoom-membrane', name: PARTS['zoom-membrane'].name, parent: null, cell: 'zoom', grab: true });
  const t = parts.nodes[id].t;
  const half = 0.2, step = 0.0125;
  const channelAt = new Vector3(0.06, 0, -0.04);
  const proteinAt = new Vector3(-0.09, 0, 0.07);
  const clear = (x, z) => Math.hypot(x - channelAt.x, z - channelAt.z) > 0.042 && Math.hypot(x - proteinAt.x, z - proteinAt.z) > 0.05;
  const heads = [], tails = [];
  const rnd = random(3);
  for (const side of [1, -1]) {
    for (let x = -half; x <= half; x += step) {
      for (let z = -half; z <= half; z += step) {
        const jx = x + (rnd() - 0.5) * 0.003, jz = z + (rnd() - 0.5) * 0.003;
        if (!clear(jx, jz)) continue;
        heads.push(placeAt(new Vector3(jx, side * 0.034, jz)));
        tails.push(placeAt(new Vector3(jx, side * 0.016, jz), new Vector3(0, side, 0), 1, rnd() * TAU));
      }
    }
  }
  const head = MeshBuilder.CreateIcoSphere('lipid-head', { radius: 0.0062, subdivisions: 1 }, scene);
  const tailA = MeshBuilder.CreateCylinder('tail-a', { height: 0.026, diameter: 0.0032, tessellation: 4 }, scene);
  tailA.position.x = 0.0022;
  const tailB = tailA.clone('tail-b');
  tailB.position.x = -0.0022;
  tailB.rotation.z = 0.12;
  const tail = Mesh.MergeMeshes([tailA, tailB], true, true);
  const meshes = [
    scatter('lipid-heads', head, heads, mat(scene, 'lipid-head', { color: '#f2a07b', rough: 0.45 })),
    scatter('lipid-tails', tail, tails, mat(scene, 'lipid-tail', { color: '#f3e2a6', rough: 0.5 })),
  ];
  // A channel protein: a barrel with a hole through it, from one side to the other.
  const ring = [new Vector3(0.012, -0.055, 0), new Vector3(0.036, -0.05, 0), new Vector3(0.04, 0, 0), new Vector3(0.036, 0.05, 0), new Vector3(0.012, 0.055, 0), new Vector3(0.012, -0.055, 0)];
  const channel = MeshBuilder.CreateLathe('channel', { shape: ring, tessellation: 24 }, scene);
  channel.position = channelAt;
  channel.material = mat(scene, 'channel', { color: '#9b6ad6', rough: 0.45, glow: 0.1 });
  // A protein across the membrane with a chain of sugars on its outside (a glycoprotein).
  const protein = shell('glycoprotein', scene, { r: new Vector3(0.042, 0.06, 0.038), seg: 28, rings: 20, deform: wobble(0.14, 2), material: mat(scene, 'membrane-protein', { color: '#5aa6d6', rough: 0.5 }) });
  protein.position = proteinAt;
  const sugar = [];
  let p = proteinAt.add(new Vector3(0, 0.065, 0));
  for (let k = 0; k < 7; k++) {
    const s = MeshBuilder.CreateIcoSphere(`sugar-${k}`, { radius: 0.008, subdivisions: 1 }, scene);
    s.position = p.clone();
    sugar.push(s);
    if (k === 3) {
      const br = MeshBuilder.CreateIcoSphere('sugar-b', { radius: 0.008, subdivisions: 1 }, scene);
      br.position = p.add(new Vector3(0.016, 0.004, 0));
      sugar.push(br);
    }
    p = p.add(new Vector3((rnd() - 0.5) * 0.012, 0.014, (rnd() - 0.5) * 0.012));
  }
  // A protein on the inside surface, and cholesterol among the tails.
  const inner = shell('peripheral-protein', scene, { r: new Vector3(0.04, 0.025, 0.035), seg: 24, rings: 16, deform: wobble(0.12, 7), material: mat(scene, 'peripheral', { color: '#e07fb3', rough: 0.5 }) });
  inner.position.set(-0.08, -0.058, -0.1);
  const chol = [];
  for (let k = 0; k < 30; k++) {
    const x = (rnd() - 0.5) * 0.36, z = (rnd() - 0.5) * 0.36;
    if (!clear(x, z)) continue;
    const c = MeshBuilder.CreateCapsule(`chol-${k}`, { radius: 0.0028, height: 0.022, tessellation: 6 }, scene);
    c.position.set(x + 0.006, (k % 2 ? 1 : -1) * 0.018, z + 0.006);
    chol.push(c);
  }
  meshes.push(channel, protein, merge('sugars', sugar, mat(scene, 'sugar', { color: '#f6e86a', rough: 0.45, glow: 0.1 })), inner, merge('cholesterol', chol, mat(scene, 'cholesterol', { color: '#fff5c9', rough: 0.45 })));
  for (const m of meshes) {
    m.parent = t;
    parts.claim(m, id);
    m.metadata.shown = () => show.has('zoom-membrane');
  }
  return id;
}

export function buildZoom(scene, parts) {
  /** Which close-ups are out. */
  const show = new Set();
  const ids = { 'zoom-dna': dna(scene, parts, show), 'zoom-ribosome': ribosome(scene, parts, show), 'zoom-membrane': membrane(scene, parts, show) };
  return { ids, show };
}
