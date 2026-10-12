// The showroom the truck is shown in: a bright hall with the truck on a low turntable plinth in the
// middle, a clear walkway all round, a marked space for a future exploded parts view, and the doorway
// to the self-driving ride. Everything is drawn here (no files to load) and kept small for Quest: a few
// hundred triangles of walls and plinths and a handful of canvas textures, 1024 px at most.
//
// Frame: metres, the truck's frame. Up +y, the truck's nose +z, the floor at y = 0. The truck stands
// on the plinth, PLINTH_TOP above the floor.
import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';

/** How high the turntable lifts the truck off the walkway. */
export const PLINTH_TOP = 0.1;
const PLINTH_R = 3.8;                 // the truck's corners (mirrors out) reach 3.1 m from its centre
/**
 * One tone for the walls and ceiling, near the floor's and just under the light over the truck, as in a
 * photo studio: the steel reflects all of them, and any step in brightness between them shows on its faces.
 */
const HALL_TONE = '#e1e0dc';
/** The soft light over the truck: across (x) and along (z), the truck being 2.4 m wide and 5.7 m long. */
const CANOPY = { w: 6.4, d: 9.6 };
const HALL = { x0: -10, x1: 16, z0: -11, z1: 11, h: 6 };
/** The parts space, beside the truck on its right (+x): room for a truck's worth of parts laid out (disassembly.js:
 *  68 parts take about 31 m² with room round each). Its near edge 3.5 m from the turntable's, a full walkway. */
const PARTS = { x: 10.3, z: 0, w: 6.0, d: 9.6, h: 0.1 };
/** The doorway to the self-driving ride, in the wall ahead of the truck, so the driver's seat faces it. */
const DOOR = { w: 5.2, h: 3.2 };

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function flat(scene, name, color, { emissive = null, specular = 0.04, power = 64 } = {}) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(specular, specular, specular);
  mat.specularPower = power;
  if (emissive) mat.emissiveColor = Color3.FromHexString(emissive);
  return mat;
}

/** A material that only glows: light fittings, the LED ring, signs. */
function glow(scene, name, color, texture = null) {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  // With a texture the colour stays black: Babylon adds the two.
  mat.emissiveColor = texture ? Color3.Black() : Color3.FromHexString(color);
  if (texture) mat.emissiveTexture = texture;
  return mat;
}

function canvasTexture(scene, name, w, h, draw, { mipmaps = true } = {}) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, mipmaps);
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.update();
  tex.hasAlpha = false;
  return tex;
}

/** Pale polished concrete in 2 m bays, one bay per tile. Light, as in a real showroom: the steel's lower
 * faces look down at it, so a dark floor would show as dark doors. */
function floorTexture(scene) {
  return canvasTexture(scene, 'showroom-floor', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#cac8c3';
    ctx.fillRect(0, 0, w, h);
    // Soft cloudiness, then a fine speckle, so it reads as ground and polished stone, not paint.
    for (let i = 0; i < 90; i++) {
      const v = 192 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgba(${v},${v - 1},${v - 4},0.12)`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 70, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 3000; i++) {
      const v = 172 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgb(${v},${v - 1},${v - 4})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    ctx.strokeStyle = '#aeaca7';            // the saw cut between bays
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  });
}

/**
 * The light over the truck, as car studios and showrooms hang it: one big diffuser, brightest in two long
 * bands down the truck's length (they draw the highlights along its creases), dimming softly to the edges
 * so its reflection is a smooth gradient, not a hard-edged box. u across the truck, v along it.
 */
function canopyTexture(scene) {
  return canvasTexture(scene, 'showroom-canopy', 256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ecebe7';
    ctx.fillRect(0, 0, w, h);
    // Soft fall-off to every edge.
    const edge = (g, x, y, ww, hh) => { ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh); };
    const fade = 64, dim = 'rgba(196,196,192,0.8)', clear = 'rgba(196,196,192,0)';
    let g = ctx.createLinearGradient(0, 0, fade, 0); g.addColorStop(0, dim); g.addColorStop(1, clear); edge(g, 0, 0, fade, h);
    g = ctx.createLinearGradient(w, 0, w - fade, 0); g.addColorStop(0, dim); g.addColorStop(1, clear); edge(g, w - fade, 0, fade, h);
    g = ctx.createLinearGradient(0, 0, 0, fade); g.addColorStop(0, dim); g.addColorStop(1, clear); edge(g, 0, 0, w, fade);
    g = ctx.createLinearGradient(0, h, 0, h - fade); g.addColorStop(0, dim); g.addColorStop(1, clear); edge(g, 0, h - fade, w, fade);
    // The two bands, soft-sided, over the truck's shoulders.
    for (const cx of [w * 0.32, w * 0.68]) {
      g = ctx.createLinearGradient(cx - 18, 0, cx + 18, 0);
      g.addColorStop(0, 'rgba(255,255,253,0)');
      g.addColorStop(0.5, 'rgba(255,255,253,1)');
      g.addColorStop(1, 'rgba(255,255,253,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 18, fade * 0.6, 36, h - fade * 1.2);
    }
  });
}

function signTexture(scene, name, w, h, lines, { bg = '#15191d', fg = '#f4f4f2' } = {}) {
  return canvasTexture(scene, name, w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of lines) {
      ctx.fillStyle = l.color ?? fg;
      ctx.font = `${l.weight ?? 500} ${l.size}px ${FONT}`;
      if (l.spacing) ctx.letterSpacing = `${l.spacing}px`;
      ctx.fillText(l.text, w / 2, l.y);
      ctx.letterSpacing = '0px';
    }
  });
}

function plane(scene, name, w, h, mat, parent, pos, rotY = 0) {
  const m = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  m.material = mat;
  m.position.copyFrom(pos);
  m.rotation.y = rotY;
  m.parent = parent;
  m.isPickable = false;
  return m;
}

/**
 * Builds the showroom into `scene`.
 * - `root`: everything here hangs off it.
 * - `setVisible(on)`: show or hide the whole hall (the test drive hides it while on the track).
 * - `floors`: what people stand on: the walkway, the plinth top and the parts plinth. Pass to the
 *   teleport and to presence, so others see you standing on whichever you're over.
 * - `envMeshes`: what the steel should reflect: render these into the environment probe.
 * - `spawnPoint`: `{ position, lookAt }`, on the walkway off the truck's front left corner, facing it.
 * - `partsArea`: `{ centre, width, depth, top }`, the empty plinth kept for the exploded parts view.
 * - `plinthTop`: the height the truck stands at.
 */
export function createShowroom(scene) {
  const root = new TransformNode('showroom', scene);
  const envMeshes = [];
  const floors = [];
  const { x0, x1, z0, z1, h } = HALL;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;

  // ---- floor
  const floorTex = floorTexture(scene);
  floorTex.wrapU = floorTex.wrapV = Texture.WRAP_ADDRESSMODE;
  floorTex.uScale = W / 2;
  floorTex.vScale = D / 2;
  floorTex.anisotropicFilteringLevel = 4;
  const floorMat = flat(scene, 'showroom-floor', '#ffffff', { specular: 0.22, power: 90 });
  // Lifted to the walls' tone, so the line where they meet doesn't show as a step across the steel.
  floorMat.emissiveColor = new Color3(0.18, 0.18, 0.18);
  floorMat.diffuseTexture = floorTex;
  const floor = MeshBuilder.CreateGround('showroom-floor', { width: W, height: D }, scene);
  floor.position.set(cx, 0, cz);
  floor.material = floorMat;
  floor.receiveShadows = true;
  floor.parent = root;
  floors.push(floor);
  envMeshes.push(floor);

  // ---- walls, facing in (one-sided, so from outside the hall you look in through them). Plain and evenly
  // lit, no panel seams: the steel's sides reflect them, and seams would show as lines down the doors.
  // Lit by wall washers, not the sun: all four walls the same tone, wherever the sun is set. Under the sun
  // the wall facing away from it went dark grey, and the truck's rear quarters showed it as a dark patch.
  const wallMat = glow(scene, 'showroom-wall', HALL_TONE);
  const wall = (name, len, pos, rotY) => {
    const m = plane(scene, name, len, h, wallMat, root, pos, rotY);
    envMeshes.push(m);
    return m;
  };
  wall('showroom-wall-back', W, new Vector3(cx, h / 2, z0), Math.PI);
  wall('showroom-wall-left', D, new Vector3(x0, h / 2, cz), -Math.PI / 2);
  wall('showroom-wall-right', D, new Vector3(x1, h / 2, cz), Math.PI / 2);
  // The front wall has the doorway in it: three pieces round the opening.
  wall('showroom-wall-front-l', -DOOR.w / 2 - x0, new Vector3((x0 - DOOR.w / 2) / 2, h / 2, z1), 0);
  wall('showroom-wall-front-r', x1 - DOOR.w / 2, new Vector3((x1 + DOOR.w / 2) / 2, h / 2, z1), 0);
  const lintel = wall('showroom-wall-front-top', DOOR.w, new Vector3(0, (h + DOOR.h) / 2, z1), 0);
  lintel.scaling.y = (h - DOOR.h) / h;

  // A skirting strip along every wall, where the walls meet the floor: mid grey, not black, so it doesn't
  // draw a dark line along the reflection.
  const skirtMat = flat(scene, 'showroom-skirt', '#8f918f');
  for (const [name, len, pos, rotY] of [
    ['back', W, new Vector3(cx, 0.06, z0 + 0.01), Math.PI],
    ['left', D, new Vector3(x0 + 0.01, 0.06, cz), -Math.PI / 2],
    ['right', D, new Vector3(x1 - 0.01, 0.06, cz), Math.PI / 2],
    ['front-l', -DOOR.w / 2 - x0, new Vector3((x0 - DOOR.w / 2) / 2, 0.06, z1 - 0.01), 0],
    ['front-r', x1 - DOOR.w / 2, new Vector3((x1 + DOOR.w / 2) / 2, 0.06, z1 - 0.01), 0],
  ]) plane(scene, `showroom-skirt-${name}`, len, 0.12, skirtMat, root, pos, rotY);

  // ---- ceiling: pale, so the hood and roof (which face it) read as bright steel
  const ceilMat = glow(scene, 'showroom-ceiling', HALL_TONE);
  const ceiling = MeshBuilder.CreatePlane('showroom-ceiling', { width: W, height: D }, scene);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.set(cx, h, cz);
  ceiling.material = ceilMat;
  ceiling.parent = root;
  ceiling.isPickable = false;
  envMeshes.push(ceiling);

  // Over the truck: one big soft light, a little larger than the turntable, as car studios and showrooms
  // hang it. It's what the hood, roof and upper sides reflect, so they show the steel's own tone.
  const canopy = MeshBuilder.CreatePlane('showroom-canopy', { width: CANOPY.w, height: CANOPY.d }, scene);
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, h - 0.04, 0);
  canopy.material = glow(scene, 'showroom-canopy', '#ffffff', canopyTexture(scene));
  canopy.parent = root;
  canopy.isPickable = false;
  envMeshes.push(canopy);
  // Over the rest of the hall: a grid of square panels.
  const lightMat = glow(scene, 'showroom-light', '#fbfaf6');
  for (let x = x0 + 3; x <= x1 - 2; x += 4) {
    for (let z = z0 + 2.5; z <= z1 - 2; z += 4) {
      if (Math.abs(x) < CANOPY.w / 2 + 1 && Math.abs(z) < CANOPY.d / 2 + 1) continue;
      const m = MeshBuilder.CreateBox(`showroom-panel-${x}-${z}`, { width: 1.2, height: 0.04, depth: 1.2 }, scene);
      m.position.set(x, h - 0.02, z);
      m.material = lightMat;
      m.parent = root;
      m.isPickable = false;
      envMeshes.push(m);
    }
  }

  // ---- the turntable plinth: light grey, as showroom turntables are. The lower half of the body looks
  // down at it, so a dark one turns the doors charcoal.
  const plinthMat = flat(scene, 'showroom-plinth', '#bcbcb8', { specular: 0.18, power: 120 });
  const plinth = MeshBuilder.CreateCylinder('showroom-plinth', { diameter: 2 * PLINTH_R, height: PLINTH_TOP, tessellation: 96 }, scene);
  plinth.position.y = PLINTH_TOP / 2;
  plinth.material = plinthMat;
  plinth.receiveShadows = true;
  plinth.parent = root;
  floors.push(plinth);
  envMeshes.push(plinth);
  // A brushed steel band round its edge, and a glowing line where it meets the floor.
  const band = MeshBuilder.CreateCylinder('showroom-plinth-band', { diameter: 2 * PLINTH_R + 0.02, height: PLINTH_TOP * 0.6, tessellation: 96, cap: Mesh.NO_CAP }, scene);
  band.position.y = PLINTH_TOP * 0.55;
  band.material = flat(scene, 'showroom-plinth-band', '#9ea2a6', { specular: 0.6, power: 40 });
  band.parent = root;
  band.isPickable = false;
  const led = MeshBuilder.CreateCylinder('showroom-plinth-led', { diameter: 2 * PLINTH_R + 0.03, height: 0.012, tessellation: 96, cap: Mesh.NO_CAP }, scene);
  led.position.y = 0.008;
  led.material = glow(scene, 'showroom-plinth-led', '#cfe6ff');
  led.parent = root;
  led.isPickable = false;

  // ---- the parts space: a low plinth the truck's parts are laid out on (disassembly.js), its edge marked, and a
  // stand saying how. Light
  // grey like the turntable: the truck's right side looks straight at it, and a dark one shows as a dark
  // band along the doors.
  const partsMat = flat(scene, 'showroom-parts', '#a9a8a4', { specular: 0.05 });
  const parts = MeshBuilder.CreateBox('showroom-parts', { width: PARTS.w, height: PARTS.h, depth: PARTS.d }, scene);
  parts.position.set(PARTS.x, PARTS.h / 2, PARTS.z);
  parts.material = partsMat;
  parts.parent = root;
  floors.push(parts);
  envMeshes.push(parts);
  // A dashed outline on its top, drawn in the plinth's own proportions.
  const outlineTex = canvasTexture(scene, 'showroom-parts-top', 512, Math.round((512 * PARTS.d) / PARTS.w / 4) * 4, (ctx, w, hh) => {
    ctx.fillStyle = '#a9a8a4';
    ctx.fillRect(0, 0, w, hh);
    ctx.strokeStyle = '#e0a12c';
    ctx.lineWidth = 8;
    ctx.setLineDash([36, 24]);
    ctx.strokeRect(30, 30, w - 60, hh - 60);
  });
  const partsTop = MeshBuilder.CreateGround('showroom-parts-top', { width: PARTS.w, height: PARTS.d }, scene);
  partsTop.position.set(PARTS.x, PARTS.h + 0.002, PARTS.z);
  const partsTopMat = flat(scene, 'showroom-parts-top', '#ffffff', { specular: 0.2 });
  partsTopMat.diffuseTexture = outlineTex;
  partsTop.material = partsTopMat;
  partsTop.parent = root;
  partsTop.isPickable = false;
  // The stand: a slim post with a sign on it, at the walkway edge nearest the truck, facing it.
  const standX = PARTS.x - PARTS.w / 2 - 0.6, standZ = 2.6;
  const post = MeshBuilder.CreateBox('showroom-parts-post', { width: 0.06, height: 1.2, depth: 0.06 }, scene);
  post.position.set(standX, 0.6, standZ);
  post.material = flat(scene, 'showroom-post', '#26292c', { specular: 0.3 });
  post.parent = root;
  post.isPickable = false;
  const partsSign = signTexture(scene, 'showroom-parts-sign', 1024, 512, [
    { text: 'IN THE SERVICE MANUAL’S ORDER', size: 44, y: 120, weight: 600, spacing: 6, color: '#f2b544' },
    { text: 'See every part', size: 120, y: 260, weight: 500 },
    { text: 'Menu, then Take it apart: tap a part', size: 46, y: 390, weight: 400, color: '#b9bec4' },
  ]);
  const panel = MeshBuilder.CreatePlane('showroom-parts-sign', { width: 1.0, height: 0.5 }, scene);
  panel.material = glow(scene, 'showroom-parts-sign', '#ffffff', partsSign);
  panel.position.set(standX, 1.35, standZ);
  panel.rotation.set(-0.2, Math.atan2(standX, standZ), 0);   // turned to the truck, leaning back
  panel.parent = root;
  panel.isPickable = false;
  const back = MeshBuilder.CreateBox('showroom-parts-sign-back', { width: 1.04, height: 0.54, depth: 0.03 }, scene);
  back.material = post.material;
  back.parent = panel;
  back.position.z = 0.017;
  back.isPickable = false;

  // ---- the doorway to the self-driving ride, straight ahead of the truck
  // A lit recess behind the opening, a closed roller door at its far end, a lit frame and the sign. Light,
  // like a lit loading bay, and in the steel's reflection: it's straight ahead of the truck, and a dark
  // opening there showed as a dark smudge on the body.
  const recessMat = glow(scene, 'showroom-recess', '#b4b5b2');
  recessMat.backFaceCulling = false;
  const recessDepth = 1.5;
  const recessParts = [
    ['floor', DOOR.w, recessDepth, new Vector3(0, 0.001, z1 + recessDepth / 2), Math.PI / 2, 0],
    ['ceil', DOOR.w, recessDepth, new Vector3(0, DOOR.h, z1 + recessDepth / 2), -Math.PI / 2, 0],
    ['left', recessDepth, DOOR.h, new Vector3(-DOOR.w / 2, DOOR.h / 2, z1 + recessDepth / 2), 0, -Math.PI / 2],
    ['right', recessDepth, DOOR.h, new Vector3(DOOR.w / 2, DOOR.h / 2, z1 + recessDepth / 2), 0, Math.PI / 2],
  ];
  for (const [name, w, hh, pos, rx, ry] of recessParts) {
    const m = MeshBuilder.CreatePlane(`showroom-recess-${name}`, { width: w, height: hh }, scene);
    m.material = recessMat;
    m.position.copyFrom(pos);
    m.rotation.set(rx, ry, 0);
    m.parent = root;
    m.isPickable = false;
    envMeshes.push(m);
  }
  // The far end: a closed roller door with daylight under and round it.
  const rollerTex = canvasTexture(scene, 'showroom-roller', 256, 256, (ctx, w, hh) => {
    ctx.fillStyle = '#b7babd';
    ctx.fillRect(0, 0, w, hh);
    for (let y = 0; y < hh; y += 16) {
      ctx.fillStyle = '#a2a6aa';
      ctx.fillRect(0, y, w, 3);
      ctx.fillStyle = '#c9ccce';
      ctx.fillRect(0, y + 3, w, 2);
    }
  });
  const roller = MeshBuilder.CreatePlane('showroom-roller', { width: DOOR.w, height: DOOR.h }, scene);
  roller.position.set(0, DOOR.h / 2, z1 + recessDepth);
  const rollerMat = flat(scene, 'showroom-roller', '#ffffff', { specular: 0.1 });
  rollerMat.diffuseTexture = rollerTex;
  rollerMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  roller.material = rollerMat;
  envMeshes.push(roller);
  roller.parent = root;
  roller.isPickable = false;
  // Daylight showing under the door.
  const daylight = MeshBuilder.CreatePlane('showroom-daylight', { width: DOOR.w, height: 0.05 }, scene);
  daylight.position.set(0, 0.025, z1 + recessDepth - 0.01);
  daylight.material = glow(scene, 'showroom-daylight', '#fff3d6');
  daylight.parent = root;
  daylight.isPickable = false;
  // A lit frame round the opening.
  const frameMat = glow(scene, 'showroom-door-frame', '#f2b544');
  for (const [name, w, hh, x, y] of [
    ['top', DOOR.w + 0.16, 0.08, 0, DOOR.h + 0.04],
    ['l', 0.08, DOOR.h, -DOOR.w / 2 - 0.04, DOOR.h / 2],
    ['r', 0.08, DOOR.h, DOOR.w / 2 + 0.04, DOOR.h / 2],
  ]) {
    const m = MeshBuilder.CreatePlane(`showroom-door-${name}`, { width: w, height: hh }, scene);
    m.position.set(x, y, z1 - 0.005);
    m.material = frameMat;
    m.parent = root;
    m.isPickable = false;
    envMeshes.push(m);
  }
  // The sign, on the closed door itself: that's what the windscreen frames from the driver's seat.
  const trackSign = signTexture(scene, 'showroom-track-sign', 1024, 256, [
    { text: 'HIGHWAY 1 · BIG SUR', size: 76, y: 98, weight: 600, spacing: 8 },
    { text: 'Take a seat inside for the self-driving ride', size: 46, y: 196, weight: 400, color: '#f2b544' },
  ]);
  const sign = MeshBuilder.CreatePlane('showroom-track-sign', { width: 4.0, height: 1.0 }, scene);
  sign.position.set(0, 2.0, z1 + recessDepth - 0.02);
  sign.material = glow(scene, 'showroom-track-sign', '#ffffff', trackSign);
  sign.parent = root;
  sign.isPickable = false;
  // Not in the steel's reflection: it's dark, straight ahead, and blurred it showed as a smudge on the body.
  // The steel shows the lit roller door behind it instead.
  // Two lines on the floor from the turntable to the doorway: the way the truck goes out.
  const laneMat = flat(scene, 'showroom-lane', '#e9e7e1', { specular: 0.1 });
  for (const x of [-DOOR.w / 2 + 0.4, DOOR.w / 2 - 0.4]) {
    const len = z1 - PLINTH_R - 0.3;
    const lane = MeshBuilder.CreateGround(`showroom-lane-${x}`, { width: 0.1, height: len }, scene);
    lane.position.set(x, 0.002, z1 - len / 2);
    lane.material = laneMat;
    lane.receiveShadows = true;
    lane.parent = root;
    lane.isPickable = false;
  }

  // One draw call per material: merge the fixed pieces that share one (the light fittings, the skirting,
  // the recess, the door frame...). The floors stay separate: the teleport and presence look them up.
  const byMaterial = new Map();
  for (const m of root.getChildMeshes()) {
    if (floors.includes(m)) continue;
    byMaterial.set(m.material, [...(byMaterial.get(m.material) ?? []), m]);
  }
  for (const group of byMaterial.values()) {
    if (group.length < 2) continue;
    const reflected = group.some((m) => envMeshes.includes(m));
    for (const m of group) if (envMeshes.includes(m)) envMeshes.splice(envMeshes.indexOf(m), 1);
    const merged = Mesh.MergeMeshes(group, true, true);
    merged.name = group[0].material.name;
    merged.parent = root;
    merged.isPickable = false;
    if (reflected) envMeshes.push(merged);
  }
  for (const m of root.getChildMeshes()) m.freezeWorldMatrix();

  const spawnPoint = { position: new Vector3(-3.6, 0, 4.4), lookAt: new Vector3(0, 0.9, 0) };
  return {
    root,
    floors,
    envMeshes,
    spawnPoint,
    plinthTop: PLINTH_TOP,
    partsArea: { centre: new Vector3(PARTS.x, PARTS.h, PARTS.z), width: PARTS.w, depth: PARTS.d, top: PARTS.h },
    setVisible(on) {
      root.setEnabled(on);
    },
  };
}
