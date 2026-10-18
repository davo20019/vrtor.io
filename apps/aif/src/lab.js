// The lab: a bright room with the four stations around the visitor and the board on the far wall.
//
//   board (on the wall, z = 3.9)            what the machine sees, for every step
//   sorting table (-2.3, 1.6)  machine (0, 2.0)  landscape table (2.5, 1.6)
//                         you start at (0, -0.6)
import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

export const STATIONS = {
  intro: { stand: new Vector3(0, 0, -0.6), look: new Vector3(0, 1.4, 2.6) },
  sort: { stand: new Vector3(-2.3, 0, 0.75), look: new Vector3(-2.3, 0.85, 1.6), center: new Vector3(-2.3, 0, 1.6) },
  machine: { stand: new Vector3(0, 0, 0.95), look: new Vector3(0, 1.3, 2.4), center: new Vector3(0, 0, 2.0) },
  landscape: { stand: new Vector3(2.5, 0, 0.45), look: new Vector3(2.5, 0.9, 1.6), center: new Vector3(2.5, 0, 1.6) },
};
export const SORT_TABLE_TOP = 0.8;
export const LANDSCAPE_TABLE_TOP = 0.72;

export function mat(scene, name, hex, { spec = 0.08, emissive = null, alpha = 1 } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(spec, spec, spec);
  if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
  if (alpha < 1) m.alpha = alpha;
  return m;
}

/**
 * A flat sign: text on a plane `w` by `h` metres, front facing -Z (towards the visitor), unlit so it
 * reads the same in any light. Returns { mesh, set(text) }.
 */
export function makeLabel(scene, text, { w = 0.4, h = 0.1, size = 64, color = '#1d232b', bg = null, weight = 600, align = 'center', px = 512 } = {}) {
  const tex = new DynamicTexture(`label-${text}`, { width: px, height: Math.round((px * h) / w) }, scene, true);
  tex.hasAlpha = !bg;
  const m = new StandardMaterial(`label-${text}`, scene);
  m.diffuseTexture = tex;
  m.emissiveColor = Color3.White();
  m.disableLighting = true;
  m.useAlphaFromDiffuseTexture = !bg;
  m.backFaceCulling = true;
  const mesh = MeshBuilder.CreatePlane(`label-${text}`, { width: w, height: h }, scene);
  mesh.material = m;
  mesh.isPickable = false;
  const set = (t) => {
    const ctx = tex.getContext();
    const { width, height } = tex.getSize();
    ctx.clearRect(0, 0, width, height);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const lines = String(t).split('\n');
    const lh = size * 1.2;
    lines.forEach((line, i) => ctx.fillText(line, align === 'left' ? 24 : width / 2, height / 2 + (i - (lines.length - 1) / 2) * lh));
    tex.update();
  };
  set(text);
  return { mesh, set };
}

/** A table: a top and four legs. `round` makes a round top on one central column. */
function table(scene, name, { w, d, top, round = false, wood }, at) {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const meshes = [];
  if (round) {
    const t = MeshBuilder.CreateCylinder(`${name}-top`, { diameter: w, height: 0.04, tessellation: 64 }, scene);
    t.position.y = top - 0.02;
    const col = MeshBuilder.CreateCylinder(`${name}-col`, { diameter: 0.14, height: top - 0.04, tessellation: 24 }, scene);
    col.position.y = (top - 0.04) / 2;
    const foot = MeshBuilder.CreateCylinder(`${name}-foot`, { diameter: 0.6, height: 0.03, tessellation: 32 }, scene);
    foot.position.y = 0.015;
    meshes.push(t, col, foot);
  } else {
    const t = MeshBuilder.CreateBox(`${name}-top`, { width: w, depth: d, height: 0.04 }, scene);
    t.position.y = top - 0.02;
    meshes.push(t);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = MeshBuilder.CreateBox(`${name}-leg`, { width: 0.05, depth: 0.05, height: top - 0.04 }, scene);
      leg.position.set(sx * (w / 2 - 0.06), (top - 0.04) / 2, sz * (d / 2 - 0.06));
      meshes.push(leg);
    }
  }
  for (const m of meshes) {
    m.parent = root;
    m.material = wood;
    m.isPickable = false;
  }
  return { root, meshes };
}

/** A shallow woven basket for one kind of fruit. */
function basket(scene, name, at, tint) {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const wall = MeshBuilder.CreateCylinder(`${name}-wall`, { diameterTop: 0.36, diameterBottom: 0.28, height: 0.1, tessellation: 40, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, scene);
  wall.position.y = 0.05;
  const floor = MeshBuilder.CreateDisc(`${name}-floor`, { radius: 0.14, tessellation: 40 }, scene);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = 0.004;
  const rim = MeshBuilder.CreateTorus(`${name}-rim`, { diameter: 0.36, thickness: 0.018, tessellation: 40 }, scene);
  rim.position.y = 0.1;
  const weave = mat(scene, `${name}-weave`, '#b98a52', { spec: 0.04 });
  const band = mat(scene, `${name}-band`, tint, { spec: 0.1 });
  for (const m of [wall, floor]) {
    m.parent = root;
    m.material = weave;
  }
  rim.parent = root;
  rim.material = band;
  // Clicking (or pointing at) any part of the basket picks it.
  for (const m of [wall, floor, rim]) m.metadata = { basket: name };
  return { root, meshes: [wall, floor, rim] };
}

export function createLab(scene) {
  const floorMat = mat(scene, 'floor', '#d9cbb6', { spec: 0.05 });
  const wallMat = mat(scene, 'wall', '#eef0f2', { spec: 0.02 });
  const wood = mat(scene, 'wood', '#a87f57', { spec: 0.12 });
  const pale = mat(scene, 'pale', '#f7f4ee', { spec: 0.05 });

  const floor = MeshBuilder.CreateGround('floor', { width: 11, height: 10 }, scene);
  floor.position.z = 1.0;
  floor.material = floorMat;
  // A soft rug under the stations, so where to stand reads at a glance.
  const rug = MeshBuilder.CreateDisc('rug', { radius: 3.4, tessellation: 72 }, scene);
  rug.rotation.x = Math.PI / 2;
  rug.position.set(0, 0.003, 1.2);
  rug.material = mat(scene, 'rug', '#c9d6dc', { spec: 0 });
  rug.isPickable = true;

  const walls = [];
  const wall = (w, h, pos, rotY) => {
    const m = MeshBuilder.CreatePlane('wall', { width: w, height: h }, scene);
    m.position.copyFrom(pos);
    m.rotation.y = rotY;
    m.material = wallMat;
    m.isPickable = false;
    walls.push(m);
  };
  wall(11, 4.2, new Vector3(0, 2.1, 4.0), 0);
  wall(10, 4.2, new Vector3(-5.5, 2.1, 1.0), -Math.PI / 2);
  wall(10, 4.2, new Vector3(5.5, 2.1, 1.0), Math.PI / 2);
  wall(11, 4.2, new Vector3(0, 2.1, -4.0), Math.PI);
  const ceiling = MeshBuilder.CreatePlane('ceiling', { width: 11, height: 10 }, scene);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.set(0, 4.2, 1.0);
  ceiling.material = mat(scene, 'ceiling', '#f6f7f8', { spec: 0 });
  ceiling.isPickable = false;
  // Long ceiling lights, lit by their own glow.
  const glow = mat(scene, 'glow', '#ffffff', { emissive: '#fff8ec' });
  for (const x of [-2.4, 0, 2.4]) {
    const lamp = MeshBuilder.CreateBox('lamp', { width: 0.24, depth: 4.2, height: 0.04 }, scene);
    lamp.position.set(x, 4.17, 1.2);
    lamp.material = glow;
    lamp.isPickable = false;
  }

  const sortTable = table(scene, 'sort-table', { w: 1.7, d: 0.75, top: SORT_TABLE_TOP, wood }, STATIONS.sort.center);
  const landTable = table(scene, 'land-table', { w: 2.0, top: LANDSCAPE_TABLE_TOP, round: true, wood: pale }, STATIONS.landscape.center);

  const top = STATIONS.sort.center.add(new Vector3(0, SORT_TABLE_TOP, 0));
  const baskets = {
    apple: basket(scene, 'apple', top.add(new Vector3(-0.62, 0, 0)), '#c8323a'),
    orange: basket(scene, 'orange', top.add(new Vector3(0.62, 0, 0)), '#f08a1c'),
  };
  const signs = {};
  for (const [kind, text] of [['apple', 'Apples'], ['orange', 'Oranges']]) {
    const s = makeLabel(scene, text, { w: 0.34, h: 0.09, size: 76, color: '#ffffff', bg: kind === 'apple' ? '#b8323a' : '#e07a12', weight: 700 });
    s.mesh.position.copyFrom(baskets[kind].root.position.add(new Vector3(0, 0.34, 0.12)));
    signs[kind] = s;
  }

  return {
    floors: [floor, rug],
    envMeshes: [floor, ...walls],
    baskets,
    shadowReceivers: [floor, rug, ...sortTable.meshes, ...landTable.meshes],
  };
}
