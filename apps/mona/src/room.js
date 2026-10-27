// The room: the painting as the Louvre shows it in the Salle des États since 2019. Its own wall in midnight blue
// ("a very dense shade of blue enriched with subtle variations of black", Louvre press release, 2019); the
// steel case (Goppion, 2005), 2.2 m wide, 4.6 m high and 0.6 m deep, behind anti-reflective laminated glass, its
// front shelf holding the conservation units and the lights; waxed parquet; visitors held back by two lines of
// stanchions. Measured: the case's size. Estimated: the hanging height, how far the case stands out of its wall,
// the shelf's size and the stanchions' distance (assets-src/monalisa/spec.md).
//
// Frame: metres, up +y, the wall's face at z = 0, the viewer starting at +z looking at -z, the floor at y = 0.
import { Color3, DynamicTexture, MeshBuilder, PBRMaterial, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';

export const CASE = { width: 2.2, height: 4.6, depth: 0.6, out: 0.15, bottom: 0.25 };
// The middle of the panel, inside the case: "high on a separate wall" (Louvre). Height estimated from photos.
export const HANG = new Vector3(0, 1.9, -(CASE.depth - CASE.out) + 0.09);

export function createRoom(scene) {
  const blue = Color3.FromHexString('#141c2b');
  const wallMat = new PBRMaterial('wall', scene);
  wallMat.albedoColor = blue;
  wallMat.metallic = 0;
  wallMat.roughness = 0.93;
  wallMat.albedoTexture = plasterTexture(scene);

  // The separate wall: 9 m wide, 6 m high, with the case let into it.
  const W = 9, H = 6, T = 0.8;
  const cx0 = -CASE.width / 2, cx1 = CASE.width / 2;
  const cy0 = CASE.bottom, cy1 = CASE.bottom + CASE.height;
  const pieces = [
    ['wall-left', (cx0 - -W / 2), H, -W / 2 + (cx0 + W / 2) / 2, H / 2],
    ['wall-right', (W / 2 - cx1), H, cx1 + (W / 2 - cx1) / 2, H / 2],
    ['wall-top', CASE.width, H - cy1, 0, cy1 + (H - cy1) / 2],
    ['wall-bottom', CASE.width, cy0, 0, cy0 / 2],
  ];
  const walls = pieces.map(([name, w, h, x, y]) => {
    const p = MeshBuilder.CreateBox(name, { width: w, height: h, depth: T }, scene);
    p.position.set(x, y, -T / 2);
    p.material = wallMat;
    // No shadows: only the case light casts them, and these faces are outside its shadow map.
    p.isPickable = false;
    return p;
  });

  // The case: a steel box standing a little out of the wall, lined inside in the same blue; the painting hangs on
  // its back.
  const steel = new PBRMaterial('case-steel', scene);
  steel.albedoColor = Color3.FromHexString('#191b1f');
  steel.metallic = 0.15;
  steel.roughness = 0.6; // satin, powder-coated
  steel.environmentIntensity = 0.2; // the room probe is coarse; on a matte case it showed as blocks
  const inner = CASE.depth - CASE.out;
  const back = MeshBuilder.CreatePlane('case-back', { width: CASE.width, height: CASE.height }, scene);
  back.position.set(0, cy0 + CASE.height / 2, -inner);
  back.rotation.y = Math.PI;
  back.material = wallMat;
  back.receiveShadows = true;
  const sides = [
    ['case-left', 0.02, CASE.height, CASE.depth, cx0 - 0.01, cy0 + CASE.height / 2],
    ['case-right', 0.02, CASE.height, CASE.depth, cx1 + 0.01, cy0 + CASE.height / 2],
  ].map(([n, w, h, d, x, y]) => {
    const s = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    s.position.set(x, y, CASE.out - CASE.depth / 2);
    s.material = steel;
    return s;
  });
  const lid = MeshBuilder.CreateBox('case-top', { width: CASE.width + 0.04, height: 0.02, depth: CASE.depth }, scene);
  lid.position.set(0, cy1 + 0.01, CASE.out - CASE.depth / 2);
  lid.material = steel;
  // The front: a narrow steel surround round the glass.
  const rim = 0.06;
  const surround = [
    ['case-rim-l', rim, CASE.height, -CASE.width / 2 + rim / 2, cy0 + CASE.height / 2],
    ['case-rim-r', rim, CASE.height, CASE.width / 2 - rim / 2, cy0 + CASE.height / 2],
    ['case-rim-t', CASE.width, rim, 0, cy1 - rim / 2],
  ].map(([n, w, h, x, y]) => {
    const b = MeshBuilder.CreateBox(n, { width: w, height: h, depth: 0.03 }, scene);
    b.position.set(x, y, CASE.out - 0.015);
    b.material = steel;
    return b;
  });
  // The front shelf: the case's conservation units and lights, a dark ledge across its foot.
  const shelfH = 0.9, shelfOut = 0.32;
  const shelf = MeshBuilder.CreateBox('case-shelf', { width: CASE.width, height: shelfH, depth: CASE.depth + shelfOut }, scene);
  shelf.position.set(0, cy0 + shelfH / 2, CASE.out + shelfOut - (CASE.depth + shelfOut) / 2);
  shelf.material = steel;
  // A slit of light along its top edge, behind the glass.
  const slit = MeshBuilder.CreateBox('case-light', { width: CASE.width - 0.2, height: 0.012, depth: 0.05 }, scene);
  slit.position.set(0, cy0 + shelfH + 0.006, -0.05);
  const sm = new StandardMaterial('case-light', scene);
  sm.emissiveColor = Color3.FromHexString('#fff0da');
  sm.disableLighting = true;
  slit.material = sm;

  // The glass: laminated, anti-reflective. Nearly invisible, a faint reflection of the room.
  const glass = MeshBuilder.CreatePlane('case-glass', { width: CASE.width - 2 * rim, height: CASE.height - shelfH - rim }, scene);
  glass.position.set(0, cy0 + shelfH + (CASE.height - shelfH - rim) / 2, CASE.out - 0.02);
  glass.rotation.y = Math.PI;
  const gm = new PBRMaterial('case-glass', scene);
  gm.albedoColor = Color3.FromHexString('#0b0f12');
  gm.metallic = 0;
  gm.roughness = 0.04;
  gm.alpha = 0.05;
  gm.metallicF0Factor = 0.12; // the anti-reflective coat: well under 1 % reflection, against plain glass's 4 %
  gm.useSpecularOverAlpha = true;
  gm.useRadianceOverAlpha = true;
  gm.backFaceCulling = false;
  glass.material = gm;
  glass.isPickable = false;

  // The room around: further walls and a ceiling, the painting the brightest thing in it.
  const box = MeshBuilder.CreateBox('room', { width: 26, height: 9, depth: 26, sideOrientation: 1 }, scene);
  box.position.set(0, 4.5, 12); // its far wall behind the painting's own wall
  const bm = new PBRMaterial('room', scene);
  bm.albedoColor = Color3.FromHexString('#121722');
  bm.metallic = 0;
  bm.roughness = 0.95;
  box.material = bm;
  box.isPickable = false;

  const floor = MeshBuilder.CreateGround('floor', { width: 26, height: 26 }, scene);
  floor.position.z = 12.9;
  const fm = new PBRMaterial('floor', scene);
  fm.albedoTexture = parquetTexture(scene);
  fm.albedoTexture.uScale = 13;
  fm.albedoTexture.vScale = 13;
  fm.metallic = 0;
  fm.roughness = 0.32; // waxed
  floor.material = fm;

  // Two lines of stanchions with black belts, making the lane up to the painting. Distance estimated.
  const post = new PBRMaterial('stanchion', scene);
  post.albedoColor = Color3.FromHexString('#b9b2a4');
  post.metallic = 1;
  post.roughness = 0.3;
  const belt = new PBRMaterial('belt', scene);
  belt.albedoColor = Color3.FromHexString('#101010');
  belt.metallic = 0;
  belt.roughness = 0.7;
  const posts = [];
  for (const x of [-1.6, 1.6]) {
    let prev = null;
    for (let k = 0; k < 4; k++) {
      const z = 2.6 + k * 1.8;
      const p = MeshBuilder.CreateCylinder(`post-${x}-${k}`, { height: 0.95, diameterTop: 0.05, diameterBottom: 0.05 }, scene);
      p.position.set(x, 0.475, z);
      p.material = post;
      const foot = MeshBuilder.CreateCylinder(`foot-${x}-${k}`, { height: 0.03, diameter: 0.34 }, scene);
      foot.position.set(x, 0.015, z);
      foot.material = post;
      if (prev) {
        const b = MeshBuilder.CreateBox(`belt-${x}-${k}`, { width: 0.004, height: 0.05, depth: 1.8 }, scene);
        b.position.set(x, 0.9, (prev + z) / 2);
        b.material = belt;
        posts.push(b);
      }
      posts.push(p, foot);
      prev = z;
    }
  }
  // Across the front of the lane, the line nobody may cross.
  const front = MeshBuilder.CreateBox('belt-front', { width: 3.2, height: 0.05, depth: 0.004 }, scene);
  front.position.set(0, 0.9, 2.6);
  front.material = belt;
  posts.push(front);
  for (const m of [...posts, ...sides, ...surround, lid, shelf, slit, back]) m.isPickable = false;

  // The room's ceiling lamp, lit from inside: what the gilt and varnish reflect.
  const lamp = MeshBuilder.CreateCylinder('lamp', { height: 0.12, diameter: 0.18 }, scene);
  lamp.position.set(0, 7.9, 3.5);
  const lm = new StandardMaterial('lamp', scene);
  lm.emissiveColor = Color3.FromHexString('#fff1dc');
  lm.disableLighting = true;
  lamp.material = lm;
  lamp.isPickable = false;

  return {
    floors: [floor],
    walls,
    lampPosition: lamp.position.clone(),
    shelfLight: new Vector3(0, cy0 + shelfH + 0.02, -0.05),
  };
}

/** Matte paint over plaster: faint mottling with darker, near-black variations. */
function plasterTexture(scene) {
  const t = new DynamicTexture('plaster', { width: 512, height: 512 }, scene, true);
  const g = t.getContext();
  const img = g.createImageData(512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 512 * 512; i++) {
    const v = 226 + rnd() * 29;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Broad, soft darker patches.
  for (let k = 0; k < 40; k++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.05)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  t.update();
  t.uScale = 4;
  t.vScale = 3;
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
