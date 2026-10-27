// The room: the painting as the Louvre shows it in the Salle Daru (room 702, Denon wing, first floor). A matte
// terracotta-red wall, the gilt frame on a dark base, waxed parquet, a low cord in front, and daylight from the glass
// roof. From photographs (assets-src/sacre/refs/SOURCES.md): the frame's visible width (360 mm) and the wall colour
// are read from them; the hanging height (the sight's bottom about 1 m up), the room's size, the cord's distance and
// the skylight are estimated (assets-src/sacre/spec.md).
//
// Frame: metres, up +y, the wall's face at z = 0, the viewer starting at +z looking at -z, the floor at y = 0.
import { Color3, DynamicTexture, MeshBuilder, PBRMaterial, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';

// The canvas: 9.79 x 6.21 m (Louvre); the frame shows 9.756 x 6.176 m of it and stands 115 mm out from the wall.
export const SIGHT = { width: 9.756, height: 6.176 };
export const FRAME = { reach: 0.36, back: 0.115 };
const SIGHT_BOTTOM = 1.0;
// The middle of the canvas's front.
export const HANG = new Vector3(0, SIGHT_BOTTOM + SIGHT.height / 2, FRAME.back);

export const ROOM = { width: 30, depth: 16, height: 12 };

export function createRoom(scene) {
  const wallMat = new PBRMaterial('wall', scene);
  wallMat.albedoColor = Color3.FromHexString('#6a2c20');
  wallMat.metallic = 0;
  wallMat.roughness = 0.95;
  wallMat.albedoTexture = paintTexture(scene);

  const { width: RW, depth: RD, height: RH } = ROOM;
  // The room as a box seen from inside; its floor 10 cm under the parquet so the two never share a plane.
  const box = MeshBuilder.CreateBox('room', { width: RW, height: RH + 0.1, depth: RD, sideOrientation: 1 }, scene);
  box.position.set(0, (RH + 0.1) / 2 - 0.1, RD / 2);
  box.material = wallMat;
  box.isPickable = false;
  box.receiveShadows = true;

  // The wall's paint is laid in courses; their joints show as faint horizontal lines (photographs).
  const jointMat = new PBRMaterial('joint', scene);
  jointMat.albedoColor = Color3.FromHexString('#5e2c22');
  jointMat.roughness = 0.95;
  jointMat.metallic = 0;
  const joints = [];
  for (const y of [SIGHT_BOTTOM + SIGHT.height + FRAME.reach + 0.18, SIGHT_BOTTOM + SIGHT.height * 0.33]) {
    const j = MeshBuilder.CreateBox('wall-joint', { width: RW, height: 0.006, depth: 0.004 }, scene);
    j.position.set(0, y, 0.002);
    j.material = jointMat;
    j.isPickable = false;
    joints.push(j);
  }

  // The dark base the frame stands on: a plinth running the frame's width, its height read from the photographs
  // (about 30 cm under the frame), its depth estimated.
  const plinth = MeshBuilder.CreateBox('plinth', { width: SIGHT.width + 2 * FRAME.reach, height: 0.3, depth: 0.14 }, scene);
  plinth.position.set(0, SIGHT_BOTTOM - FRAME.reach + 0.02 - 0.15, 0.07);
  const pm = new PBRMaterial('plinth', scene);
  pm.albedoColor = Color3.FromHexString('#2a1a10');
  pm.roughness = 0.6;
  pm.metallic = 0;
  plinth.material = pm;
  plinth.receiveShadows = true;
  plinth.isPickable = false;

  // The skylight: the room is lit through its glass roof. A bright panel in the ceiling, what the gilt reflects.
  const sky = MeshBuilder.CreatePlane('skylight', { width: RW * 0.7, height: RD * 0.55 }, scene);
  sky.position.set(0, RH - 0.02, RD * 0.45);
  sky.rotation.x = Math.PI / 2;
  const sm = new StandardMaterial('skylight', scene);
  sm.emissiveColor = Color3.FromHexString('#e9ecef');
  sm.disableLighting = true;
  sky.material = sm;
  sky.isPickable = false;
  // Its glazing bars.
  const barMat = new StandardMaterial('glazing', scene);
  barMat.diffuseColor = Color3.FromHexString('#3b3d40');
  barMat.specularColor = Color3.Black();
  for (let k = -5; k <= 5; k++) {
    const b = MeshBuilder.CreateBox('glazing-bar', { width: 0.08, height: 0.06, depth: RD * 0.55 }, scene);
    b.position.set((k * RW * 0.7) / 11, RH - 0.06, RD * 0.45);
    b.material = barMat;
    b.isPickable = false;
  }

  const floor = MeshBuilder.CreateGround('floor', { width: RW, height: RD }, scene);
  floor.position.z = RD / 2;
  const fm = new PBRMaterial('floor', scene);
  fm.albedoTexture = parquetTexture(scene);
  fm.albedoTexture.uScale = RW / 2;
  fm.albedoTexture.vScale = RD / 2;
  fm.albedoTexture.anisotropicFilteringLevel = 8; // seen at a glancing angle: without it the boards shimmer
  fm.metallic = 0;
  fm.roughness = 0.32; // waxed
  floor.material = fm;
  floor.receiveShadows = true;

  // A low cord on short brass posts in front of the painting (photographs); its distance from the wall estimated.
  const brass = new PBRMaterial('brass', scene);
  brass.albedoColor = Color3.FromHexString('#c9a35a');
  brass.metallic = 1;
  brass.roughness = 0.3;
  const cordMat = new PBRMaterial('cord', scene);
  cordMat.albedoColor = Color3.FromHexString('#5a1414');
  cordMat.metallic = 0;
  cordMat.roughness = 0.8;
  const CORD_Z = 0.75, POST_H = 0.45;
  const half = SIGHT.width / 2 + FRAME.reach;
  const xs = [];
  for (let k = 0; k <= 6; k++) xs.push(-half + (2 * half * k) / 6);
  const barrier = [];
  xs.forEach((x, k) => {
    const p = MeshBuilder.CreateCylinder('post', { height: POST_H, diameter: 0.035 }, scene);
    p.position.set(x, POST_H / 2, CORD_Z);
    p.material = brass;
    const foot = MeshBuilder.CreateCylinder('post-foot', { height: 0.02, diameter: 0.16 }, scene);
    foot.position.set(x, 0.01, CORD_Z);
    foot.material = brass;
    barrier.push(p, foot);
    if (k) {
      const span = x - xs[k - 1];
      const c = MeshBuilder.CreateTube('cord', { path: sag(xs[k - 1], x, POST_H - 0.02, CORD_Z, 0.06), radius: 0.008, tessellation: 8 }, scene);
      c.material = cordMat;
      barrier.push(c);
    }
  });

  // A bench in the middle of the room, as there is one for this painting.
  const bench = MeshBuilder.CreateBox('bench', { width: 3.2, height: 0.08, depth: 0.55 }, scene);
  bench.position.set(0, 0.44, 7.5);
  const bm = new PBRMaterial('bench', scene);
  bm.albedoColor = Color3.FromHexString('#3a2a1e');
  bm.roughness = 0.55;
  bm.metallic = 0;
  bench.material = bm;
  const benchLegs = [-1.4, 1.4].map((x) => {
    const l = MeshBuilder.CreateBox('bench-leg', { width: 0.08, height: 0.4, depth: 0.5 }, scene);
    l.position.set(x, 0.2, 7.5);
    l.material = bm;
    return l;
  });
  for (const m of [...barrier, bench, ...benchLegs]) m.isPickable = false;

  return {
    floors: [floor],
    shadowReceivers: [box, plinth, floor],
    shadowCasters: [plinth, bench, ...benchLegs],
    skyCentre: sky.position.clone(),
  };
}

/** The cord's path between two posts, hanging in a shallow curve. */
function sag(x0, x1, y, z, depth) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new Vector3(x0 + (x1 - x0) * t, y - depth * 4 * t * (1 - t), z));
  }
  return pts;
}

/** Matte paint: faint mottling and the roller's soft streaks. */
function paintTexture(scene) {
  const t = new DynamicTexture('paint', { width: 512, height: 512 }, scene, true);
  const g = t.getContext();
  const img = g.createImageData(512, 512);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 512 * 512; i++) {
    const v = 232 + rnd() * 23;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 40; k++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.04)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  t.update();
  t.uScale = 8;
  t.vScale = 4;
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Waxed oak parquet in straight courses of boards, one repeat per 2 m. */
function parquetTexture(scene) {
  const S = 1024;
  const t = new DynamicTexture('parquet', { width: S, height: S }, scene, true);
  const g = t.getContext();
  g.fillStyle = '#2b1d12';
  g.fillRect(0, 0, S, S);
  const rows = 16;
  const B = S / rows;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < S) {
      const L = 220 + rnd() * 200;
      const l = 70 + rnd() * 30;
      g.fillStyle = `rgb(${l + 34},${l + 14},${l - 12})`;
      g.fillRect(x + 1, r * B + 1, L - 2, B - 2);
      g.globalAlpha = 0.07;
      for (let k = 0; k < 8; k++) { g.fillStyle = rnd() > 0.5 ? '#000' : '#fff'; g.fillRect(x, r * B + rnd() * B, L, 1 + rnd() * 2); }
      g.globalAlpha = 1;
      x += L;
    }
  }
  t.update();
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}
