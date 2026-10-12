// VRtor Cybertruck (/cyb): a full-size model of the stainless steel pickup,
// built in assets-src/cybertruck with the building-3d-replicas skill, on a turntable in a showroom
// (showroom.js). Walk around it,
// sit in the driver's seat or the back seat, and take the wheel covers off. From a seat, take the
// self-driving ride: the truck drives itself down Highway 1 in Big Sur (bigsur.js, drive.js). On the
// way it stops when asked (or when a door's button is pressed), and you can step out onto the road.
// Flat screens: an orbit camera (in a seat it turns in place) and an HTML card (M or Menu brings it
// back). Headset: walk and teleport round the showroom; the card's buttons move you into a seat, and
// A, X or the menu button opens and closes it (xr-shell's menu.js keeps it in view). Other visitors show up as
// avatars and can talk (presence, from xr-shell).
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Constants,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FreeCamera,
  Frustum,
  HemisphericLight,
  ImageProcessingConfiguration,
  KhronosTextureContainer2,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
  Plane,
  PointerEventTypes,
  Quaternion,
  MeshBuilder,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {
  createCard,
  createMenuControls,
  createPresence,
  createXr,
  continueInVr,
  mountPresenceControls,
  orbitPose,
  presenceCard,
  startHeadsetLog,
  xrPose,
  xrSupported,
} from '@vrtor/xr-shell';
import { buildBigSur, fetchBigSur } from './bigsur.js';
import { createDrive } from './drive.js';
import { createYokeControls } from './yoke.js';
import { createScreen } from './screen.js';
import { createLoaderStrip, drawLoader } from './loader.js';
import { createShowroom } from './showroom.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
// Self-hosted KTX2 transcoders (public/ktx2), for Big Sur's aerial photos.
const ktx2 = (file) => new URL(`${BASE}ktx2/${file}`, location.href).href;
KhronosTextureContainer2.URLConfig = {
  ...KhronosTextureContainer2.URLConfig,
  jsDecoderModule: ktx2('babylon.ktx2Decoder.js'),
  jsMSCTranscoder: ktx2('msc_basis_transcoder.js'),
  wasmMSCTranscoder: ktx2('msc_basis_transcoder.wasm'),
  wasmZSTDDecoder: ktx2('zstddec.wasm'),
};
const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'),
  pct: $('.loading-pct'),
  card: $('.card'),
  kicker: $('.card-kicker'),
  title: $('.card-title'),
  body: $('.card-body'),
  fact: $('.card-fact'),
  actions: $('.card-actions'),
  art: $('.card-art'),
  vr: $('[data-enter-vr]'),
  menu: $('[data-menu]'),
  hint: $('.hint'),
};

const SKY_TOP = Color3.FromHexString('#7fa6cf');
const SKY_HORIZON = Color3.FromHexString('#dfe7ee');
const SKY_BELOW = Color3.FromHexString('#8d8f8c');
/** Mid-afternoon sun, high and off to the front left, so the steel catches it. */
const TO_SUN = new Vector3(-0.45, 0.75, 0.48).normalize();
/** Big Sur: the afternoon sun over the sea, to the south-west. */
const TO_SUN_BIGSUR = new Vector3(-0.6, 0.62, -0.5).normalize();
/** The coast's haze: distant ridges and the sea's horizon fade into it. */
const HAZE = Color3.FromHexString('#cfd9e0');
/** Far enough for the horizon from Hurricane Point; logarithmic depth keeps near and far sharp. */
const FAR = 200000;

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
// Dashboards and ridges 40 km off share one depth buffer: every material writes logarithmic depth.
scene.onNewMaterialAddedObservable.add((m) => { m.useLogarithmicDepth = true; });
/** Behind the showroom's walls (seen only from outside it); on the road the haze. */
const SHOWROOM_CLEAR = Color4.FromColor3(Color3.FromHexString('#1b1e22'));
scene.clearColor = SHOWROOM_CLEAR;
// Fog is always on, thin to nothing in the showroom: switching it on for the coast would recompile
// every material in the scene on the ride's first frame.
const FOG_BIGSUR = 0.00004;
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogColor = HAZE;
scene.fogDensity = 0;
scene.ambientColor = new Color3(0.3, 0.3, 0.32);
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.0;

const camera = new ArcRotateCamera('orbit', -2.3, 1.25, 9, new Vector3(0, 0.9, 0), scene);
camera.minZ = 0.02;
camera.maxZ = FAR;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);
/** In a seat the camera turns in place around a point just ahead of the eyes. */
const LOOK_AHEAD = 0.05;
function setCameraInPlace(inPlace) {
  camera.lowerBetaLimit = 0.05;
  camera.upperBetaLimit = inPlace ? Math.PI - 0.05 : 1.5;
  camera.lowerRadiusLimit = inPlace ? 0.01 : 3;
  camera.upperRadiusLimit = inPlace ? 0.6 : 30;
}
setCameraInPlace(false);

// ---------------------------------------------------------------- the surroundings

function skyTexture(below, horizon) {
  const tex = new DynamicTexture('sky', { width: 4, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  // The dome samples this bottom-up: the ground side first.
  g.addColorStop(0, below.toHexString());
  g.addColorStop(0.48, below.toHexString());
  g.addColorStop(0.51, horizon.toHexString());
  g.addColorStop(0.72, SKY_TOP.toHexString());
  g.addColorStop(1, SKY_TOP.toHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}
const skyTextures = { plaza: skyTexture(SKY_BELOW, SKY_HORIZON), bigsur: skyTexture(HAZE, HAZE) };

function skyDome() {
  const dome = MeshBuilder.CreateSphere('sky', { diameter: 1500, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const mat = new StandardMaterial('sky', scene);
  mat.disableLighting = true;
  mat.fogEnabled = false;
  mat.emissiveTexture = skyTextures.plaza;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  return dome;
}

// The sky is for the road; the truck is shown indoors.
const sky = skyDome();
sky.setEnabled(false);
const showroom = createShowroom(scene);
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.diffuse = Color3.FromHexString('#e6eef6');
hemi.groundColor = Color3.FromHexString('#8a8780');
hemi.specular = Color3.Black();
hemi.intensity = 0.7;
const sun = new DirectionalLight('sun', TO_SUN.scale(-1), scene);
sun.position = TO_SUN.scale(30);
sun.intensity = 2.0;
const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.bias = 0.0015;
shadows.normalBias = 0.02;
sun.autoCalcShadowZBounds = true;
/** In the showroom the shadow is drawn once; a door, window, gate or cover that moves asks for it again. */
let shadowStale = false;
const shadowMoved = () => { shadowStale = true; };
scene.onBeforeRenderObservable.add(() => {
  if (!shadowStale) return;
  shadowStale = false;
  shadows.getShadowMap().resetRefreshCounter();
});

// Brushed stainless is metallic: it shows whatever surrounds it, so the scene needs an environment.
// A probe renders the showroom (or the road) once into a cube map for every metal surface to reflect.
const probe = new ReflectionProbe('env', 128, scene);
probe.position = new Vector3(0, 1.0, 0);
probe.renderList.push(...showroom.envMeshes);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.9;

// ---------------------------------------------------------------- the truck

let truck = null;
/** Where the truck is: in the showroom it stands on the turntable; on the road the ride moves it. */
const pose = new TransformNode('truck-pose', scene);
pose.rotationQuaternion = Quaternion.Identity();
pose.position.y = showroom.plinthTop;
/** Seat eye points in the truck's frame, from the model's json. */
const eyes = {};
let covers = [];
/** Doors by key (fl, rl, fr, rr): their hinge node, how far they open, and how far open they are now. */
const doors = {};
/** Pick targets (bigger than the 3 cm buttons, so a controller ray finds them) -> door key. */
const doorTargets = new Map();

async function loadTruck() {
  const info = await (await fetch(`${BASE}models/cybertruck.json`)).json();
  // The stable model path is cached for an hour; select the rebuilt corner immediately.
  const container = await LoadAssetContainerAsync(`${BASE}models/cybertruck.glb?v=8fac356f6f3f`, scene, {
    onProgress: (e) => e.lengthComputable && (ui.pct.textContent = `${Math.round((e.loaded / e.total) * 100)}%`),
  });
  container.addAllToScene();
  const root = container.meshes[0];
  root.parent = pose;
  for (const n of [...container.transformNodes, ...container.meshes]) n.computeWorldMatrix(true);
  for (const m of container.meshes) {
    if (m.getTotalVertices() > 0) shadows.addShadowCaster(m, false);
  }
  // The cabin's baked light (assemble.py) comes as each cabin material's occlusion map: it dims the sun and
  // the sky light too, not just the reflections, so the cabin is shaded as the real one is.
  // The probe's cube map isn't prefiltered: brushed metal read its plain mips, which show as blocky steps
  // wherever the surroundings change brightness. Filtering it per pixel blurs it smoothly, as a real
  // brushed finish does; 8 samples is enough for it and cheap enough for Quest.
  for (const mat of container.materials) {
    if (mat.name === 'windshield_clear') {
      // Clear head-on, with stronger reflections at the windshield's shallow viewing angle.
      mat.useLinearAlphaFresnel = true;
      mat.backFaceCulling = true;
    }
    if (mat.ambientTexture) mat.ambientTextureImpactOnAnalyticalLights = 1;
    if (mat.metallic >= 0.5 && !mat.reflectionTexture) {
      mat.realTimeFiltering = true;
      mat.realTimeFilteringQuality = Constants.TEXTURE_FILTERING_QUALITY_LOW;
    }
  }
  // The json is in glTF's frame; the loader's root turns that into Babylon's.
  // In the truck's own frame (the pose node's), wherever the pose stands now.
  const world = root.getWorldMatrix().multiply(Matrix.Invert(pose.computeWorldMatrix(true)));
  for (const [k, p] of Object.entries(info.seatEyes)) eyes[k] = Vector3.TransformCoordinates(Vector3.FromArray(p), world);
  covers = container.transformNodes.filter((n) => n.name.startsWith('cover_')).concat(container.meshes.filter((m) => m.name.startsWith('cover_')));
  const byName = (name) => container.transformNodes.find((n) => n.name === name) ?? container.meshes.find((m) => m.name === name);
  setUpDoors(container, info);
  setUpWindows(byName);
  setUpTonneau(container, info);
  setUpHinged(container, info);
  shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  return { root, info, byName };
}


// ---------------------------------------------------------------- doors

const GLOW = Color3.FromHexString('#ffb020');
const DOOR_SECONDS = 1.1;

/** Each door swings on its hinge node; its outside button (on the pillar behind it) and the button on its
 *  inside handle open and close it. */
function setUpDoors(container, info) {
  const byName = (name) => container.transformNodes.find((n) => n.name === name) ?? container.meshes.find((m) => m.name === name);
  for (const [key, d] of Object.entries(info.doors ?? {})) {
    const node = byName(d.node);
    if (!node) continue;
    node.rotationQuaternion ??= Quaternion.Identity();
    doors[key] = { node, rest: node.rotationQuaternion.clone(), open: (d.openDeg * Math.PI) / 180, t: 0, target: 0, buttons: [] };
    for (const name of d.buttons) {
      const button = byName(name);
      if (!button) continue;
      button.material = button.material.clone(`${name}-mat`);   // its own, so it can glow on its own
      doors[key].buttons.push(button);
      // A 12 cm invisible box round the button is what the pointer actually hits.
      const target = MeshBuilder.CreateBox(`${name}-target`, { size: 0.12 }, scene);
      target.visibility = 0;
      target.isPickable = true;
      target.setParent(null);
      target.position.copyFrom(button.getBoundingInfo().boundingBox.centerWorld);
      target.setParent(button);
      doorTargets.set(target, key);
      doorTargets.set(button, key);
    }
  }
}

function toggleDoor(key) {
  const d = doors[key];
  if (!d) return;
  // It won't open a door while it's moving: it stops in its lane first, then opens it.
  if (ride.world === 'bigsur' && !ride.drive.stopped) {
    stopHere(() => {
      d.target = 1;
      render();
    });
    return;
  }
  d.target = d.target > 0.5 ? 0 : 1;
  render();
}

function setDoorsAll(open) {
  if (open && ride.world === 'bigsur' && !ride.drive.stopped) return stopHere(() => setDoorsAll(true));
  for (const d of Object.values(doors)) d.target = open ? 1 : 0;
  render();
}

// ---------------------------------------------------------------- windows

/** Top to bottom or back (estimate: about what owners' videos show). */
const WINDOW_SECONDS = 3.2;
/** Each door's glass by door key. u is how far down (0 up, 1 down); dir is +1 lowering, -1 raising, 0 still.
 *  The pane slides down along its own slant into the door, and what's gone below the door's top edge is cut
 *  away (a clip plane on its own copy of the glass material), so it never shows through the door. */
const panes = {};
/** The switches by key ('window:fl'...; 'window:driver' is the four on the driver's door). */
const windowButtons = {};

function setUpWindows(byName) {
  for (const key of Object.keys(doors)) {
    const pane = byName(`door_${key}_glass`);
    if (!pane?.getTotalVertices?.()) continue;
    const door = doors[key].node;
    // The pane in its door's frame (millimetres, the door closed): its slant, and how far it has to drop.
    const toDoor = pane.computeWorldMatrix(true).multiply(Matrix.Invert(door.computeWorldMatrix(true)));
    const pos = pane.getVerticesData('position');
    const pts = [];
    for (let i = 0; i < pos.length; i += 3) pts.push(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), toDoor));
    const y0 = Math.min(...pts.map((q) => q.y)), y1 = Math.max(...pts.map((q) => q.y));
    const mean = (sel) => sel.reduce((a, q) => a.addInPlace(q), Vector3.Zero()).scaleInPlace(1 / sel.length);
    const low = mean(pts.filter((q) => q.y < y0 + 25)), high = mean(pts.filter((q) => q.y > y1 - 25));
    const down = low.subtract(high);
    down.z = 0;                                          // straight down its slant, not along the door
    down.normalize();
    pane.material = pane.material.clone(`${pane.name}-mat`);
    panes[key] = {
      pane, door, mat: pane.material, rest: pane.position.clone(),
      down, travel: (y1 - y0) / -down.y, belt: y0 - 0.5, u: 0, dir: 0, last: -1,
    };
  }
  // Raise and lower: the one switch on each passenger's door, and the driver's four.
  for (const k of Object.keys(panes)) {
    const name = `door_${k}_int_switch`;
    const button = byName(name);
    if (!button) continue;
    button.material = button.material.clone(`${name}-mat`);
    const id = k === 'fl' ? 'window:driver' : `window:${k}`;
    windowButtons[id] = [button];
    const target = MeshBuilder.CreateBox(`${name}-target`, { size: k === 'fl' ? 0.1 : 0.06 }, scene);
    target.visibility = 0;
    target.isPickable = true;
    target.setParent(null);
    target.position.copyFrom(button.getBoundingInfo().boundingBox.centerWorld);
    target.setParent(button);
    doorTargets.set(target, id);
    doorTargets.set(button, id);
  }
}

/** Which of the driver's four keys a press landed on: the outer column works the left windows, the inner
 *  the right; the front row the front ones (Owner's Manual, Windows). */
function driverKey(pick) {
  const button = windowButtons['window:driver']?.[0];
  if (!button || !pick?.pickedPoint) return 'fl';
  const door = doors.fl.node;
  const local = Vector3.TransformCoordinates(pick.pickedPoint, Matrix.Invert(door.computeWorldMatrix(true)));
  const mid = Vector3.TransformCoordinates(button.getBoundingInfo().boundingBox.centerWorld, Matrix.Invert(door.computeWorldMatrix(true)));
  // The door's frame is glTF's: +z ahead, and the left door's outside is toward +x.
  const outer = local.x > mid.x, front = local.z > mid.z;
  return `${front ? 'f' : 'r'}${outer ? 'l' : 'r'}`;
}

/** 'down', 'up' or 'toggle'. Like the real one-touch switch, a press while it moves stops it. */
function windowPress(key, which = 'toggle') {
  const w = panes[key];
  if (!w) return;
  if (w.dir) w.dir = 0;
  else if (which === 'down') w.dir = w.u < 1 ? 1 : 0;
  else if (which === 'up') w.dir = w.u > 0 ? -1 : 0;
  else w.dir = w.u <= 0 ? 1 : w.u >= 1 ? -1 : -w.last;
  if (w.dir) w.last = w.dir;
  render();
}

const anyWindowDown = () => Object.values(panes).some((w) => w.u > 0 || w.dir > 0);

/** The touchscreen's one control for all four: down if they're all up, else all up. */
function setWindowsAll(down) {
  for (const w of Object.values(panes)) {
    w.dir = down ? (w.u < 1 ? 1 : 0) : w.u > 0 ? -1 : 0;
    if (w.dir) w.last = w.dir;
  }
  render();
}

function windowsState() {
  const ws = Object.values(panes);
  if (ws.some((w) => w.dir > 0)) return 'Opening';
  if (ws.some((w) => w.dir < 0)) return 'Closing';
  if (ws.every((w) => w.u <= 0)) return 'Up · tap to open';
  return ws.every((w) => w.u >= 1) ? 'Down · tap to close' : 'Part open · tap to close';
}

/** How far down each window is, 0 to 1, for the cabin's sound. */
const windowOpenings = () => Object.fromEntries(Object.entries(panes).map(([k, w]) => [k, w.u]));

const beltPoint = new Vector3(), beltNormal = new Vector3();
scene.onBeforeRenderObservable.add(() => {
  const step = engine.getDeltaTime() / 1000 / WINDOW_SECONDS;
  for (const w of Object.values(panes)) {
    if (w.dir) {
      w.u = Math.min(1, Math.max(0, w.u + w.dir * step));
      if (w.u === 0 || w.u === 1) {
        w.dir = 0;
        render();
      }
      w.pane.position.copyFrom(w.rest).addInPlace(w.down.scale(w.u * w.travel));
      w.pane.setEnabled(w.u < 1);
      shadowMoved();
    }
    if (w.u <= 0) {
      w.mat.clipPlane = null;
      continue;
    }
    // The door's top edge, wherever the door and the truck are now.
    const m = w.door.computeWorldMatrix(true);
    Vector3.TransformCoordinatesFromFloatsToRef(0, w.belt, 0, m, beltPoint);
    Vector3.TransformNormalFromFloatsToRef(0, -1, 0, m, beltNormal);
    w.mat.clipPlane = Plane.FromPositionAndNormal(beltPoint, beltNormal.normalize());
  }
});

// ---------------------------------------------------------------- the powered tonneau cover

/** Full travel, either way. */
const TONNEAU_SECONDS = 16;
/** The cover over the bed: its slats run forward along a track into the canister behind the cab and coil up
 *  there (the model's json: tonneau.path). u is how far open (0 shut, 1 open); dir is +1 opening, -1 closing,
 *  0 still. As on the truck (Owner's Manual, Cargo Bed), a press while it moves stops it, and it only moves
 *  in Park: the switch on the left sail by the tail light, or Controls > Tonneau on the touchscreen. */
const tonneau = { slats: [], u: 0, dir: 0, last: -1, buttons: {}, lights: null, lightsOn: null, path: null };

function setUpTonneau(container, info) {
  const t = info.tonneau;
  if (!t) return;
  const byName = (name) => container.transformNodes.find((n) => n.name === name) ?? container.meshes.find((m) => m.name === name);
  tonneau.path = t;
  tonneau.slats = t.slats.map((name, i) => ({ node: byName(name), at: t.closedArc[i] })).filter((s) => s.node);
  // The model's nodes are in millimetres under its root (scaled 0.001); the json's path is in metres.
  const s0 = tonneau.slats[0];
  tonneau.unit = s0 ? s0.node.position.y / pointOnTrack(s0.at).y : 1000;
  for (const [which, name] of Object.entries({ open: t.buttons.open, close: t.buttons.close })) {
    const button = byName(name);
    if (!button) continue;
    button.material = button.material.clone(`${name}-mat`);
    const key = `tonneau:${which}`;
    tonneau.buttons[key] = [button];
    // Smaller targets than the doors': the two keys are 48 mm apart.
    const target = MeshBuilder.CreateBox(`${name}-target`, { size: 0.05 }, scene);
    target.visibility = 0;
    target.isPickable = true;
    target.setParent(null);
    target.position.copyFrom(button.getBoundingInfo().boundingBox.centerWorld);
    target.setParent(button);
    doorTargets.set(target, key);
    doorTargets.set(button, key);
  }
  const lights = byName(t.lights);
  if (lights) {
    lights.material = lights.material.clone('bed-lights-mat');
    tonneau.lights = lights.material;
    tonneau.lightsOn = lights.material.emissiveColor.clone();
  }
  placeSlats();
}

/** The track at arc length a (metres): its point on the centreline and its heading there. */
function pointOnTrack(a) {
  const { path, arc } = tonneau.path;
  a = Math.min(Math.max(a, 0), arc[arc.length - 1] - 1e-6);
  let lo = 1, hi = arc.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] < a) lo = mid + 1;
    else hi = mid;
  }
  const [z0, y0] = path[lo - 1], [z1, y1] = path[lo];
  const k = (a - arc[lo - 1]) / Math.max(arc[lo] - arc[lo - 1], 1e-9);
  return { z: z0 + (z1 - z0) * k, y: y0 + (y1 - y0) * k, angle: Math.atan2(-(y1 - y0), z1 - z0) };
}

function placeSlats() {
  const shift = tonneau.u * tonneau.path.travel;
  for (const s of tonneau.slats) {
    const p = pointOnTrack(s.at + shift);
    s.node.position.set(0, p.y * tonneau.unit, p.z * tonneau.unit);
    s.node.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), p.angle);
  }
  // Bed lights on Auto: lit while the bed is open.
  updateBedLights();
}

/** Bed lights on Auto (Owner's Manual, Lights): lit while the tonneau or the tailgate is open. */
function updateBedLights() {
  const on = tonneau.u > 0.01 || (hinged.tailgate?.t ?? 0) > 0.01;
  tonneau.lights?.emissiveColor.copyFrom(on ? tonneau.lightsOn : Color3.Black());
}

const tonneauLocked = () => ride.world === 'bigsur' && !ride.drive?.stopped;

/** 'open', 'close' (the switch's keys) or 'toggle' (the touchscreen). */
function tonneauPress(which) {
  if (!tonneau.slats.length || tonneauLocked()) return;
  if (tonneau.dir) {
    tonneau.dir = 0;                                   // a second press stops it where it is
  } else if (which === 'open') {
    if (tonneau.u < 1) tonneau.dir = 1;
  } else if (which === 'close') {
    if (tonneau.u > 0) tonneau.dir = -1;
  } else {
    tonneau.dir = tonneau.u <= 0 ? 1 : tonneau.u >= 1 ? -1 : -tonneau.last;
  }
  if (tonneau.dir) tonneau.last = tonneau.dir;
  render();
}

function tonneauState() {
  if (tonneau.dir > 0) return 'Opening · tap to stop';
  if (tonneau.dir < 0) return 'Closing · tap to stop';
  if (tonneau.u <= 0) return 'Closed · tap to open';
  if (tonneau.u >= 1) return 'Open · tap to close';
  return `Stopped ${Math.round(tonneau.u * 100)}% · tap to ${tonneau.last > 0 ? 'close' : 'open'}`;
}

scene.onBeforeRenderObservable.add(() => {
  if (!tonneau.dir) return;
  tonneau.u = Math.min(1, Math.max(0, tonneau.u + (tonneau.dir * engine.getDeltaTime()) / 1000 / TONNEAU_SECONDS));
  if (tonneau.u === 0 || tonneau.u === 1) {
    tonneau.dir = 0;
    render();
  }
  placeSlats();
  shadowMoved();
});

// ---------------------------------------------------------------- the tailgate, the under-bed lid, the outlet cover

/** How long each takes, open or shut: the tailgate drops on its struts, the others go by hand. */
const HINGE_SECONDS = { tailgate: 1.8, bedlid: 1.0, outlet_cover: 0.5 };
/** By key (tailgate, bedlid, outlet_cover): the node, its axis and opening angle (the model's json), t now. */
const hinged = {};
/** The tailgate's two struts: drawn each frame between a point on the body and one on the gate. */
const struts = [];

function setUpHinged(container, info) {
  const byName = (name) => container.transformNodes.find((n) => n.name === name) ?? container.meshes.find((m) => m.name === name);
  for (const [key, h] of Object.entries(info.hinged ?? {})) {
    const node = byName(h.node);
    if (!node) continue;
    node.rotationQuaternion ??= Quaternion.Identity();
    hinged[key] = { node, rest: node.rotationQuaternion.clone(), axis: Vector3.FromArray(h.axis), open: (h.openDeg * Math.PI) / 180, t: 0, target: 0 };
    // The part itself is what you press: the lid and the cover open and shut by hand, the tailgate shuts by hand.
    for (const m of node.getChildMeshes()) doorTargets.set(m, `hinge:${key}`);
  }
  // The tailgate's key on the switch (the third, nearest the tail light) drops it.
  const name = info.tonneau?.buttons?.tailgate;
  const button = name && byName(name);
  if (button) {
    button.material = button.material.clone(`${name}-mat`);
    tonneau.buttons['tailgate:open'] = [button];
    const target = MeshBuilder.CreateBox(`${name}-target`, { size: 0.05 }, scene);
    target.visibility = 0;
    target.isPickable = true;
    target.setParent(null);
    target.position.copyFrom(button.getBoundingInfo().boundingBox.centerWorld);
    target.setParent(button);
    doorTargets.set(target, 'tailgate:open');
    doorTargets.set(button, 'tailgate:open');
  }
  const mat = new StandardMaterial('strut', scene);
  mat.diffuseColor = Color3.FromHexString('#2a2a2c');
  mat.specularColor = new Color3(0.4, 0.4, 0.4);
  const root = byName('cybertruck'), gate = hinged.tailgate?.node;
  for (const [side, s] of Object.entries(info.struts ?? {})) {
    if (!root || !gate) continue;
    const mesh = MeshBuilder.CreateCylinder(`strut-${side}`, { height: 1, diameter: 0.016, tessellation: 10 }, scene);
    mesh.material = mat;
    mesh.rotationQuaternion = Quaternion.Identity();
    mesh.isPickable = false;
    mesh.setEnabled(false);
    // Anchors in millimetres: on the body in the root's frame, on the gate in the tailgate node's.
    struts.push({ a: { node: root, at: Vector3.FromArray(s.body) }, b: { node: gate, at: Vector3.FromArray(s.gate) }, mesh });
  }
}

const bedOpen = () => (hinged.tailgate?.t ?? 0) > 0.9 || tonneau.u > 0.3;

/** A press on a hinged part, or the tailgate's key. */
function hingePress(key) {
  const h = hinged[key];
  if (!h) return;
  if (key === 'tailgate') {
    if (h.target > 0.5) h.target = 0;                 // lifted shut by hand; it has no handle to open it
  } else if (bedOpen() || h.target > 0.5) {
    h.target = h.target > 0.5 ? 0 : 1;               // reached from the open bed (manual: open the tailgate first)
  }
  render();
}

function setTailgate(open) {
  const h = hinged.tailgate;
  if (!h || (open && tonneauLocked())) return;
  h.target = open ? 1 : 0;
  render();
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000;
  for (const [key, h] of Object.entries(hinged)) {
    if (h.t === h.target) continue;
    const step = dt / HINGE_SECONDS[key];
    h.t = h.target > h.t ? Math.min(h.target, h.t + step) : Math.max(h.target, h.t - step);
    const e = h.t * h.t * (3 - 2 * h.t);
    h.node.rotationQuaternion = h.rest.multiply(Quaternion.RotationAxis(h.axis, h.open * e));
    if (key === 'tailgate') updateBedLights();
    shadowMoved();
    if (h.t === h.target) render();
  }
  // Every frame while the gate is down, so they follow the truck on the road too.
  const down = (hinged.tailgate?.t ?? 0) > 0.02;
  for (const s of struts) {
    s.mesh.setEnabled(down);
    if (!down) continue;
    const a = Vector3.TransformCoordinates(s.a.at, s.a.node.computeWorldMatrix(true));
    const b = Vector3.TransformCoordinates(s.b.at, s.b.node.computeWorldMatrix(true));
    const d = b.subtract(a);
    const len = d.length();
    s.mesh.position.copyFrom(a.add(b).scale(0.5));
    s.mesh.scaling.set(1, len, 1);
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), d.scale(1 / len), s.mesh.rotationQuaternion);
  }
});

// ---------------------------------------------------------------- getting in through an open door

/** Which seat each door opens onto. */
const DOOR_SEAT = { fl: 'driver', fr: 'passenger', rl: 'rear', rr: 'rear' };
/** "Sit here" spots, one per door, shown in the doorway while it's open and you're outside. */
const seatSpots = [];
const seatTargets = new Map();

function setUpSeatSpots() {
  for (const [key, name] of Object.entries(DOOR_SEAT)) {
    if (!doors[key] || !eyes[name]) continue;
    const spot = MeshBuilder.CreatePlane(`sit-${key}`, { width: 0.6, height: 0.15 }, scene);
    const tex = new DynamicTexture(`sit-${key}`, { width: 512, height: 128 }, scene, true);
    tex.hasAlpha = true;
    const draw = (lit) => {
      const c = tex.getContext();
      c.clearRect(0, 0, 512, 128);
      c.fillStyle = lit ? '#ffb020' : 'rgba(12,13,18,0.88)';
      c.beginPath();
      c.roundRect(4, 4, 504, 120, 60);
      c.fill();
      c.lineWidth = 6;
      c.strokeStyle = '#ffb020';
      c.stroke();
      c.font = '700 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = lit ? '#14100a' : '#fff';
      c.fillText(name === 'rear' ? 'Sit in the back' : 'Sit here', 256, 68, 470);
      tex.update();
    };
    draw(false);
    const mat = new StandardMaterial(`sit-${key}`, scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.fogEnabled = false;
    spot.material = mat;
    spot.billboardMode = Mesh.BILLBOARDMODE_Y;
    spot.renderingGroupId = 1;                       // seen through the body, from wherever you stand
    spot.parent = pose;
    // Over the seat, in the doorway's side of it: a little below where the eyes would be.
    const eye = eyes[name];
    const side = key[1] === 'l' ? -1 : 1;
    spot.position.set(name === 'rear' ? side * Math.max(0.3, Math.abs(eye.x)) : eye.x, eye.y - 0.25, eye.z);
    spot.setEnabled(false);
    seatSpots.push({ key, name, spot, draw });
    seatTargets.set(spot, name);
  }
}

let litSpot = null;
function hoverSpot(mesh) {
  const s = seatSpots.find((x) => x.spot === mesh) ?? null;
  if (s === litSpot) return;
  litSpot?.draw(false);
  s?.draw(true);
  litSpot = s;
}

scene.onBeforeRenderObservable.add(() => {
  const outside = seat === 'outside' && ride.world !== 'loading';
  for (const s of seatSpots) s.spot.setEnabled(outside && doors[s.key].t > 0.85);
});

const anyDoorOpen = () => Object.values(doors).some((d) => d.target > 0.5);

scene.onBeforeRenderObservable.add(() => {
  const step = engine.getDeltaTime() / 1000 / DOOR_SECONDS;
  for (const d of Object.values(doors)) {
    if (d.t === d.target) continue;
    d.t = d.target > d.t ? Math.min(d.target, d.t + step) : Math.max(d.target, d.t - step);
    const e = d.t * d.t * (3 - 2 * d.t);                    // ease in and out
    d.node.rotationQuaternion = d.rest.multiply(Quaternion.RotationAxis(Vector3.Up(), d.open * e));
    shadowMoved();
  }
});

let hovered = null;
function hover(key) {
  if (key === hovered) return;
  for (const k of [hovered, key]) {
    const buttons = k && (doors[k]?.buttons ?? tonneau.buttons[k] ?? windowButtons[k]);
    if (!buttons) continue;
    for (const b of buttons) b.material.emissiveColor = k === key ? GLOW : Color3.Black();
  }
  hovered = key;
  canvas.style.cursor = key && !inXr() ? 'pointer' : '';
}

let yokeActive = false;
let screenHeld = false;
function letGoOfScreen(pick) {
  screenHeld = false;
  camera.inputs.attached.pointers?.attachControl(true);
  screen.up(pick);
}
scene.onPointerObservable.add((info) => {
  const pick = info.pickInfo;
  const key = doorTargets.get(pick?.pickedMesh) ?? null;
  const xrPointer = info.event?.pointerType === 'xr';
  const sitTo = seatTargets.get(pick?.pickedMesh) ?? null;
  const yokeKey = yokeControls?.targets.get(pick?.pickedMesh) ?? null;
  if (info.type === PointerEventTypes.POINTERMOVE) {
    hover(key);
    hoverSpot(sitTo ? pick.pickedMesh : null);
    yokeControls?.hover(yokeKey);
    // The centre screen's buttons light up under the pointer too.
    const onScreen = screen?.hover(pick) ?? false;
    if (!inXr()) canvas.style.cursor = key || sitTo || yokeKey || onScreen ? 'pointer' : '';
    return;
  }
  // The screens' buttons go on down and up, not on Babylon's tap, which a press longer than a moment or
  // a finger that slides a few pixels never makes. While one is held, the view doesn't turn under it.
  if (!xrPointer && info.type === PointerEventTypes.POINTERDOWN) {
    if (screenHeld) letGoOfScreen(null);               // an up that never came (the pointer cancelled)
    if (!key && !sitTo && !yokeKey && screen?.down(pick)) {
      screenHeld = true;
      camera.inputs.attached.pointers?.detachControl();
    }
    return;
  }
  if (!xrPointer && info.type === PointerEventTypes.POINTERUP) {
    // Picked again here, on the screens alone: Babylon skips the pick on an up that moved.
    if (screenHeld) letGoOfScreen(scene.pick(scene.pointerX, scene.pointerY, (m) => screen.meshes.includes(m)));
    return;
  }
  const press = (xrPointer && info.type === PointerEventTypes.POINTERDOWN) || (!xrPointer && info.type === PointerEventTypes.POINTERTAP);
  if (!press) return;
  if (yokeKey) yokeControls.press(yokeKey);
  else if (key?.startsWith('tonneau:')) tonneauPress(key.slice(8));
  else if (key === 'tailgate:open') setTailgate(true);
  else if (key?.startsWith('hinge:')) hingePress(key.slice(6));
  else if (key === 'window:driver') windowPress(driverKey(pick));
  else if (key?.startsWith('window:')) windowPress(key.slice(7));
  else if (key) toggleDoor(key);
  else if (sitTo) sitIn(sitTo);
  else if (xrPointer) screen?.tap(pick);
});

// ---------------------------------------------------------------- mirrors

/**
 * The rear-view and door mirrors show what's behind: a small camera at each glass looks back, and its picture is
 * drawn on the glass (the model's mirror_glass and door_f*_mirrorglass carry UVs across each pane). A render
 * target draws every mesh it's given, so each mirror is given only what's inside its own view; and they take
 * turns, one a frame, only while you're in a seat: about a fifth of a second view's cost, not three.
 */
const MIRRORS = [
  // name, picture size, vertical field of view, and how far it's turned out from straight back (radians, + to the truck's left)
  // The cab's back wall is solid in the model, so the rear-view looks down a little, at the back seats and whoever sits there.
  { name: 'int_mirror_glass', w: 448, h: 100, fov: 0.2, out: 0, down: 0.1 },
  { name: 'door_fl_mirrorglass', w: 224, h: 224, fov: 0.36, out: 0.14, down: 0.06 },
  { name: 'door_fr_mirrorglass', w: 224, h: 224, fov: 0.36, out: -0.14, down: 0.06 },
];
const mirrors = [];
let mirrorTurn = 0;
const asDrawn = new ImageProcessingConfiguration();
asDrawn.toneMappingEnabled = false;

function setUpMirrors(byName) {
  const skip = new Set();
  for (const spec of MIRRORS) {
    const glass = byName(spec.name);
    if (!glass?.getTotalVertices?.()) continue;
    skip.add(glass);
    const cam = new FreeCamera(`${spec.name}-cam`, Vector3.Zero(), scene, false);
    cam.fov = spec.fov;
    cam.minZ = 0.05;
    cam.maxZ = FAR;                                  // the scene's far: every material writes logarithmic depth by it
    const rtt = new RenderTargetTexture(`${spec.name}-view`, { width: spec.w, height: spec.h }, scene, false);
    rtt.activeCamera = cam;
    rtt.refreshRate = 1;
    rtt.clearColor = scene.clearColor;
    const planes = Frustum.GetPlanes(Matrix.Identity());
    rtt.renderListPredicate = (m) => m.isEnabled() && m.isVisible && !skip.has(m) && m.renderingGroupId === 0 && m.name !== 'xr-fade' && m.isInFrustum(planes);
    rtt.onBeforeRenderObservable.add(() => {
      rtt.clearColor = scene.clearColor;
      Frustum.GetPlanesToRef(cam.getTransformationMatrix(true), planes);
    });
    const mat = new StandardMaterial(`${spec.name}-mat`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    // The texture is added to the emissive colour, so that stays black; the level dims it instead (a mirror
    // gives back a little less than it gets). The picture was tone-mapped when it was drawn: not again here.
    mat.emissiveColor = Color3.Black();
    mat.emissiveTexture = rtt;
    rtt.level = 0.92;
    rtt.wrapV = Texture.WRAP_ADDRESSMODE;            // the panes' v runs down: turn the picture the right way up
    rtt.vScale = -1;
    mat.imageProcessingConfiguration = asDrawn;
    glass.material = mat;
    mirrors.push({ spec, glass, cam, rtt });
  }
}

/** Each frame: one mirror's camera moves to its glass, looking back from the truck, and it draws. */
scene.onBeforeRenderObservable.add(() => {
  const list = scene.customRenderTargets;
  for (const m of mirrors) {
    const i = list.indexOf(m.rtt);
    if (i >= 0) list.splice(i, 1);
  }
  if (!mirrors.length || seat === 'outside') return;
  const m = mirrors[mirrorTurn++ % mirrors.length];
  const world = pose.computeWorldMatrix(true);
  const back = Vector3.TransformNormal(new Vector3(0, 0, -1), world).normalize();
  const up = Vector3.TransformNormal(Vector3.Up(), world).normalize();
  const turn = Quaternion.RotationAxis(up, -m.spec.out);
  const dir = back.applyRotationQuaternion(turn);
  dir.addInPlace(up.scale(-m.spec.down)).normalize();
  const at = m.glass.getBoundingInfo().boundingBox.centerWorld;
  m.cam.position.copyFrom(at).addInPlace(dir.scale(0.03));
  m.cam.upVector.copyFrom(up);
  m.cam.setTarget(at.add(dir));
  list.push(m.rtt);
});

// ---------------------------------------------------------------- the centre screen

/** The touchscreen (screen.js): on from the start, parked in the showroom, the road and map on the ride. */
let screen = null;
/** The yoke's horn, turn signals and high beam (yoke.js), live in the driver's seat. */
let yokeControls = null;
/** The light bar front and back, and the cabin's ambient strips: their materials and how they glow. */
const glows = { lights: [], ambient: [], rear: {}, lightsOn: true, highBeam: false, colour: 0 };
/** The gear, set from the screen while parked in the showroom (on the road the drive is in D until it arrives). */
let gear = 'P';
const GEARS = ['P', 'R', 'N', 'D'];
const REAR_RED = new Color3(2.2, 0.03, 0.015);      // a lit brake or turn lamp: far brighter than the tail strip
const REVERSE_WHITE = new Color3(2.4, 2.4, 2.4);
const AMBIENT = [
  { name: 'White', color: null },
  { name: 'Amber', color: new Color3(1, 0.55, 0.12) },
  { name: 'Blue', color: new Color3(0.2, 0.45, 1) },
  { name: 'Red', color: new Color3(1, 0.12, 0.1) },
  { name: 'Purple', color: new Color3(0.6, 0.2, 1) },
  { name: 'Off', color: Color3.Black() },
];

/** Each glowing part gets its own material (they may share one with the rest of the truck). */
function setUpGlows() {
  const own = (m) => {
    if (!m?.material) return null;
    m.material = m.material.clone(`${m.name}-glow`);
    return { mat: m.material, rest: m.material.emissiveColor?.clone() ?? Color3.White() };
  };
  const meshes = (name) => truck.root.getChildMeshes().filter((m) => m.name === name || m.name.startsWith(`${name}_primitive`));
  glows.lights = meshes('light_front').map(own).filter(Boolean).map((g) => ({ ...g, front: true }));
  // The rear lamps, one part per function (cybertruck.json "lights"): the tail strip in three, the end caps, the
  // brake bar, the red lamps under the tailgate, the reverse lamps.
  for (const n of ['light_rear_l', 'light_rear_r', 'gate_light', 'light_cap_l', 'light_cap_r', 'gate_brake', 'light_low', 'light_reverse']) {
    glows.rear[n] = meshes(n).map(own).filter(Boolean);
  }
  glows.ambient = truck.root.getChildMeshes().filter((m) => /(^|_)int_ambient/.test(m.name)).map(own).filter(Boolean);
}

/** Braking: on the road while it slows or stands in D (the car holds the brake), and in the showroom out of P
 *  and N (shifting takes a foot on the brake, and it stays there: the truck doesn't creep in the showroom). */
function braking() {
  if (ride.world === 'bigsur' && ride.drive) {
    const c = ride.drive.car.state;
    return !ride.drive.state.done && (c.v < 0.3 || c.ax < -0.8);
  }
  return gear === 'R' || gear === 'D';
}

/** The rear lamps each frame, as the real truck does them (The Drive, The Autopian; c006 lit, c080 braking): with
 *  the lights on, a thin strip across the band and the lamps under the tailgate. Braking, the strip's middle goes
 *  out and the end caps fill solid red with a bar in the middle; a turn signal or the hazards flash the caps (red,
 *  as on US trucks). In R the reverse lamps beside the plate. */
function applyRear() {
  const set = (name, color) => {
    for (const g of glows.rear[name] ?? []) g.mat.emissiveColor = color;
  };
  const tail = (name) => (glows.lightsOn ? glows.rear[name]?.[0]?.rest ?? Color3.Black() : Color3.Black());
  const brake = braking();
  for (const side of ['l', 'r']) {
    const signalling = yokeControls && (yokeControls.hazard || yokeControls.signal === (side === 'l' ? 'left' : 'right'));
    const on = signalling ? yokeControls.blink(side === 'l' ? 'left' : 'right') : brake;
    set(`light_cap_${side}`, on ? REAR_RED : Color3.Black());
    set(`light_rear_${side}`, on ? REAR_RED : tail(`light_rear_${side}`));
  }
  set('gate_light', brake ? Color3.Black() : tail('gate_light'));
  set('gate_brake', brake ? REAR_RED : Color3.Black());
  set('light_low', brake ? REAR_RED : tail('light_low'));
  set('light_reverse', gear === 'R' && ride.world === 'showroom' ? REVERSE_WHITE : Color3.Black());
}

function applyGlows() {
  // High beam (the yoke's key): the light bar brighter.
  for (const g of glows.lights) g.mat.emissiveColor = glows.lightsOn ? g.rest.scale(g.front && glows.highBeam ? 1.8 : 1) : Color3.Black();
  const { color } = AMBIENT[glows.colour];
  for (const g of glows.ambient) g.mat.emissiveColor = color ? color.scale(Math.max(g.rest.r, g.rest.g, g.rest.b) || 1) : g.rest.clone();
}

/**
 * The windows, each tinted as the new truck's glass is (the model's materials carry the factory light transmission:
 * front side glass 72%, rear side 23%, roof 3%; each door pane has its own copy, for its clip plane). From outside
 * they show as they are. From a seat the eye has adjusted to the tint, so the view out is kept close to clear: no
 * pane is darker than 0.35. The B-pillar glass between the doors is opaque black and stays so.
 */
let roofGlass = null;
const restAlpha = new Map();
function updateGlass() {
  const alpha = (mat) => {
    if (!restAlpha.has(mat)) restAlpha.set(mat, mat.alpha);
    return seat === 'outside' ? restAlpha.get(mat) : Math.min(restAlpha.get(mat), 0.35);
  };
  if (roofGlass) roofGlass.alpha = alpha(roofGlass);
  for (const w of Object.values(panes)) w.mat.alpha = alpha(w.mat);
}

/** The screen's big button: start the ride from a seat, drive on after a stop, drive it again. */
function screenAction() {
  if (seat === 'outside') return null;
  if (ride.world === 'showroom') return { label: 'Start self-driving', onClick: startRide };
  if (ride.world === 'loading') return null;
  const st = ride.drive.state;
  if (st.done) return { label: 'Drive it again', onClick: againRide };
  if (st.paused) return { label: ride.drive.stopped ? 'Drive on' : 'Stopping…', disabled: !ride.drive.stopped, onClick: driveOn };
  return null;
}

/** The screen's Controls panel. */
function screenControls() {
  return [
    { label: 'Doors', value: anyDoorOpen() ? 'Open · tap to close' : 'Closed · tap to open', active: anyDoorOpen(), onClick: () => setDoorsAll(!anyDoorOpen()) },
    { label: 'Windows', value: windowsState(), active: anyWindowDown(), onClick: () => setWindowsAll(!anyWindowDown()) },
    { label: 'Tailgate', value: tonneauLocked() ? 'Shift to Park to open' : (hinged.tailgate?.target ?? 0) > 0.5 ? 'Open · lift it to close' : 'Closed · tap to open', active: (hinged.tailgate?.target ?? 0) > 0.5, disabled: tonneauLocked() || (hinged.tailgate?.target ?? 0) > 0.5, onClick: () => setTailgate(true) },
    { label: 'Tonneau', value: tonneauLocked() ? 'Shift to Park to open' : tonneauState(), active: tonneau.u > 0 || tonneau.dir !== 0, disabled: tonneauLocked(), onClick: () => tonneauPress('toggle') },
    { label: 'Lights', value: glows.lightsOn ? 'On' : 'Off', active: glows.lightsOn, onClick: () => ((glows.lightsOn = !glows.lightsOn), applyGlows()) },
    { label: 'Hazards', value: yokeControls?.hazard ? 'Flashing' : 'Off', active: !!yokeControls?.hazard, disabled: !yokeControls, onClick: () => yokeControls?.setHazard(!yokeControls.hazard) },
    ...(ride.world === 'showroom' ? [{ label: 'Gear', value: gear === 'P' ? 'Park · tap to shift' : `${gear} · tap to shift`, active: gear !== 'P', onClick: () => (gear = GEARS[(GEARS.indexOf(gear) + 1) % GEARS.length]) }] : []),
    { label: 'Ambient light', value: AMBIENT[glows.colour].name, active: AMBIENT[glows.colour].name !== 'Off', onClick: () => ((glows.colour = (glows.colour + 1) % AMBIENT.length), applyGlows()) },
  ];
}

// ---------------------------------------------------------------- seats and the card

const SEATS = {
  driver: { label: "Driver's seat", look: (e) => e.add(new Vector3(0, -0.15, 3)) },
  passenger: { label: 'Passenger seat', look: (e) => e.add(new Vector3(0, -0.15, 3)) },
  rear: { label: 'Back seat', look: (e) => e.add(new Vector3(0, -0.2, 3)) },
};
/** Outside: off the front left corner, where the light bar and the flank both show. */
const OUTSIDE = { eye: new Vector3(-3.6, 1.6, 4.4), look: new Vector3(0, 0.9, 0) };
let seat = 'outside';
let cardOpen = true;
let rig = null;
const card = createCard(scene, { name: 'cyb-card' });
const inXr = () => !!rig?.inXr();
/** Other visitors (see xr-shell's presence.js); in the headset, `people` shows their page of the card. */
let presence = null;
let people = false;
const action = (label, onClick, primary = false) => ({ label, onClick, primary });

function eyeOf(name) {
  if (name === 'outside' && ride.world === 'bigsur') {
    // Standing on the road off the truck's front left corner, wherever it stopped.
    const turn = Matrix.RotationY(ride.drive.state.heading);
    const ground = pose.position;
    const eye = ground.add(Vector3.TransformNormal(new Vector3(OUTSIDE.eye.x, 0, OUTSIDE.eye.z), turn));
    eye.y = ground.y + OUTSIDE.eye.y;
    return { eye, look: ground.add(new Vector3(0, OUTSIDE.look.y, 0)) };
  }
  if (name === 'outside') return OUTSIDE;
  const m = pose.computeWorldMatrix(true);
  const eye = eyes[name];
  return { eye: Vector3.TransformCoordinates(eye, m), look: Vector3.TransformCoordinates(SEATS[name].look(eye), m) };
}

async function sitIn(name) {
  if (ride.world === 'loading') return;
  // In a seat the ride is one tap away: its download starts now, so it's often ready by then.
  if (name !== 'outside') fetchRide();
  if (name === 'outside' && ride.world === 'bigsur') return stepOutOnRoad();
  seat = name;
  updateTeleport();
  const { eye, look } = eyeOf(name);
  if (inXr()) {
    // Seated or standing, the eyes end up at the seat's eye height (arrive() works it out after the
    // fade, so on the road it's where the seat is by then).
    await arrive(name);
  } else {
    flyTo(eye, look, name !== 'outside');
  }
  render();
}

function toggleCovers() {
  const on = !covers[0]?.isEnabled();
  for (const c of covers) c.setEnabled(on);
  render();
}

function content() {
  if (people && presence) {
    const page = presenceCard(presence, action, () => ((people = false), render()));
    if (presence.state.joined) page.actions.push(action('Back', () => ((people = false), render())));
    return page;
  }
  if (ride.world !== 'showroom') return rideContent();
  const menuFact = 'Left stick: walk. Right stick: forward to teleport, left or right to turn. A or X opens and closes this menu. B or Y joins other visitors, then turns your mic on and off.';
  const coversOn = covers[0]?.isEnabled() ?? true;
  const actions = [
    // The way forward last (on the right): one primary button, the ride.
    ...(seat !== 'outside' ? [{ label: 'Step out', onClick: () => sitIn('outside') }] : []),
    { label: anyDoorOpen() ? 'Close doors' : 'Open doors', onClick: () => setDoorsAll(!anyDoorOpen()) },
    { label: (hinged.tailgate?.target ?? 0) > 0.5 ? 'Close the tailgate' : 'Open the tailgate', onClick: () => setTailgate((hinged.tailgate?.target ?? 0) < 0.5) },
    { label: tonneau.dir ? 'Stop the cover' : tonneau.u > 0 ? 'Close the bed' : 'Open the bed', onClick: () => tonneauPress(tonneau.dir ? 'stop' : tonneau.u > 0 ? 'close' : 'open') },
    { label: coversOn ? 'Wheel covers off' : 'Wheel covers on', onClick: toggleCovers },
    ...(seat !== 'driver' ? [{ label: "Driver's seat", onClick: () => sitIn('driver') }] : []),
    ...(seat !== 'rear' ? [{ label: 'Back seat', onClick: () => sitIn('rear') }] : []),
    { label: 'Start self-driving', primary: true, onClick: startRide },
  ];
  if (rig && !inXr()) actions.push({ label: 'Enter VR', primary: true, onClick: enterVr });
  if (inXr() && presence?.state.status === 'online') {
    const s = presence.state;
    const open = () => ((people = true), render());
    actions.push(s.joined ? action(`People · ${s.here}`, open) : action(s.online > 1 ? `Join ${s.online - 1} here` : 'Join others', () => (presence.join(), open())));
  }
  if (inXr()) actions.push({ label: 'Close', onClick: close });
  const where = seat === 'outside' ? 'Walk around it' : `In the ${SEATS[seat].label.toLowerCase()}`;
  if (ride.error) actions.unshift({ label: ride.error, onClick: startRide });
  return {
    kicker: 'Full size',
    title: where,
    body: seat === 'outside'
      ? 'Built from the maker’s dimensions and photos. No door handles: press the black button on the pillar behind a door, then step in where it says Sit here. The cover over the bed rolls into its canister: use the switch on the left by the tail light, or Controls on the touchscreen. Its third key drops the tailgate; inside are the outlets and a compartment under the floor.'
      : seat === 'driver'
        ? 'The dash shelf, the yoke, the touchscreen and the glass roof. Press the yoke’s centre pad for the horn; the keys on its left pod work the turn signals and the high beam. Tap Start self-driving on the screen for 5 km of Highway 1 in Big Sur.'
        : 'The dash shelf, the yoke, the touchscreen and the glass roof. Tap Start self-driving on the screen for 5 km of Highway 1 in Big Sur.',
    fact: inXr()
      ? menuFact
      : '5.68 m long, 2.03 m wide without its mirrors, 1.79 m high, on 35-inch tyres.',
    actions,
  };
}

function render() {
  updateGlass();
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: [] });
    placeCard();
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
  ui.menu.hidden = cardOpen;
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact ?? '';
  ui.fact.hidden = !data.fact;
  ui.art.hidden = !data.loader;
  ui.actions.replaceChildren(
    ...data.actions.map((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      b.className = a.primary ? 'btn btn-primary' : 'btn';
      b.addEventListener('click', a.onClick);
      return b;
    }),
  );
}

/** In a seat the card comes in close, in front of the dash; in a seat on the road it rides along in the cabin. */
function placeCard() {
  const plane = card.panels[0].mesh;
  const parent = ride.world === 'bigsur' && seat !== 'outside' ? pose : null;
  if (plane.parent !== parent) plane.setParent(parent);
  card.place(rig.headPosition(), rig.headForward(), null, seat !== 'outside' ? { distance: 0.62, drop: 0.12 } : undefined);
}

function open() {
  cardOpen = true;
  render();
}

function close() {
  cardOpen = false;
  render();
}

// Flat screens: glide the camera to a seat's eye (turning in place there) or back outside.
let flight = null;
function flyTo(eye, look, inPlace) {
  const target = inPlace ? eye.add(look.subtract(eye).normalize().scale(LOOK_AHEAD)) : look;
  const off = eye.subtract(target);
  const radius = off.length();
  setCameraInPlace(inPlace);
  flight = { target, radius, alpha: Math.atan2(off.z, off.x), beta: Math.acos(Math.max(-1, Math.min(1, off.y / radius))) };
}
canvas.addEventListener('pointerdown', () => (flight = null));
canvas.addEventListener('wheel', () => (flight = null), { passive: true });
scene.onBeforeRenderObservable.add(() => {
  if (inXr() || !flight) return;
  const k = Math.min(1, engine.getDeltaTime() / 250);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  let da = flight.alpha - camera.alpha;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  camera.alpha += da * k;
  camera.beta += (flight.beta - camera.beta) * k;
  camera.radius += (flight.radius - camera.radius) * k;
  if (Math.abs(da) < 0.002 && Vector3.Distance(camera.target, flight.target) < 0.002 && Math.abs(flight.radius - camera.radius) < 0.002) flight = null;
});

// ---------------------------------------------------------------- the self-driving ride

/**
 * world: showroom, loading or bigsur. Big Sur downloads once you take a seat (or ask for the ride),
 * and is built the first time a ride is asked for. bytes: the download so far; built: 0 to 1.
 */
const ride = { world: 'showroom', bigsur: null, drive: null, fetching: null, loading: null, bytes: { loaded: 0, total: 0 }, built: 0, shown: -1, error: null, lastMs: 0, afterStop: null };

/** The whole wait as 0 to 1: the download is most of it, building the rest. */
function rideProgress() {
  const { loaded, total } = ride.bytes;
  return 0.85 * (total ? loaded / total : 0) + 0.15 * ride.built;
}

/** How much of the download has come, in MB, once its size is known. */
function downloadDetail() {
  const { loaded, total } = ride.bytes;
  if (!total) return '';
  return loaded < total ? `${(loaded / 1e6).toFixed(1)} of ${(total / 1e6).toFixed(1)} MB` : 'building the road';
}

/** The headset's loader, over the card (loader.js). */
let loaderStrip = null;
let loaderDrawn = 0;
/**
 * While the ride loads: the truck driving down the coast over the card (the headset's, or the page's),
 * and the real truck's light bar and cabin strips breathing, as if it's waking up.
 */
scene.onBeforeRenderObservable.add(() => {
  const loading = ride.world === 'loading';
  if (!loading) {
    if (loaderDrawn) {
      loaderDrawn = 0;
      loaderStrip?.hide();
      applyGlows();
    }
    return;
  }
  const now = performance.now();
  // 30 times a second is plenty for the drawing.
  if (now - loaderDrawn < 33) return;
  loaderDrawn = now;
  const progress = rideProgress();
  if (inXr() && card.visible) loaderStrip?.show(progress);
  else loaderStrip?.hide();
  if (!inXr() && !ui.card.hidden && !ui.art.hidden) {
    const c = ui.art;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) Object.assign(c, { width: w, height: h });
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    drawLoader(ctx, 0, 0, w, h, { progress, t: now / 1000 });
  }
  const breath = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((now / 1000) * 3));
  for (const g of glows.lights) g.mat.emissiveColor = g.rest.scale(breath);
  for (const g of glows.ambient) g.mat.emissiveColor = (AMBIENT[glows.colour].color ?? g.rest).scale(breath);
});

/** The card and the screen follow the loading, a percent at a time. */
function showProgress() {
  screen?.refresh();
  const pct = Math.round(rideProgress() * 100);
  if (ride.world !== 'loading' || pct === ride.shown) return;
  ride.shown = pct;
  if (cardOpen) render();
}

function fetchRide() {
  ride.fetching ??= fetchBigSur((bytes) => {
    ride.bytes = bytes;
    showProgress();
  }).catch((err) => {
    ride.fetching = null;
    throw err;
  });
  // A download started early that fails is tried again when the ride is asked for.
  ride.fetching.catch(() => {});
  return ride.fetching;
}

function loadBigSur() {
  ride.loading ??= fetchRide().then((files) => buildBigSur(scene, files, (f) => {
    ride.built = f;
    showProgress();
  })).then((world) => {
    ride.bigsur = world;
    // Made in the showroom, while the truck stands unturned on the turntable: the yoke and screen are measured there.
    ride.drive = createDrive(scene, { pose, truckInfo: truck.info, nodes: truck.byName, screen, road: world.road, windows: windowOpenings });
    return world;
  });
  return ride.loading;
}

/** Resolves on the first frame the coast's meshes are all ready to draw, or after 3 s regardless. */
function coastReady() {
  const meshes = ride.bigsur.root.getChildMeshes();
  const t0 = performance.now();
  return new Promise((resolve) => {
    const obs = scene.onAfterRenderObservable.add(() => {
      if (performance.now() - t0 < 3000 && !meshes.every((m) => m.isReady(true))) return;
      scene.onAfterRenderObservable.remove(obs);
      resolve();
    });
  });
}

/** Shows one world or the other: the showroom, or the coast with its haze and afternoon sun. */
function applyWorld(to) {
  const big = to === 'bigsur';
  ride.world = to;
  ride.bigsur.root.setEnabled(big);
  showroom.setVisible(!big);
  sky.setEnabled(big);
  scene.clearColor = big ? Color4.FromColor3(HAZE) : SHOWROOM_CLEAR;
  sky.material.emissiveTexture = big ? skyTextures.bigsur : skyTextures.plaza;
  scene.fogDensity = big ? FOG_BIGSUR : 0;
  if (big) ride.drive.reset();
  else ride.drive.park();
  const toSun = big ? TO_SUN_BIGSUR : TO_SUN;
  sun.direction = toSun.scale(-1);
  sun.position = pose.position.add(toSun.scale(30));
  // The truck moves on the road, so its shadow is drawn every frame there.
  const map = shadows.getShadowMap();
  map.refreshRate = big ? 1 : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  map.resetRefreshCounter();
  // The steel reflects whichever world it's in.
  probe.position = pose.position.add(new Vector3(0, 1, 0));
  probe.renderList.length = 0;
  probe.renderList.push(...(big ? [sky, ...ride.bigsur.root.getChildMeshes().filter((m) => !m.isBlocked)] : showroom.envMeshes));
  probe.cubeTexture.resetRefreshCounter();
  updateTeleport();
}

/** Which world's floors teleport lands on now. */
let teleportFloors = 'showroom';

/** Teleport in the showroom, and on the road when you're standing on it (never out of a moving truck). */
function updateTeleport() {
  updateGlass();
  const teleport = rig?.xr.teleportation;
  if (!teleport) return;
  // Swapped only when the world changes: adding a floor it already has would list it twice.
  const want = ride.world === 'bigsur' ? 'road' : 'showroom';
  if (want !== teleportFloors) {
    const [out, into] = want === 'road' ? [showroom.floors, ride.bigsur.ground] : [ride.bigsur?.ground ?? [], showroom.floors];
    for (const m of out) teleport.removeFloorMesh(m);
    for (const m of into) teleport.addFloorMesh(m);
    teleportFloors = want;
  }
  if (ride.world === 'bigsur' && seat !== 'outside') teleport.detach();
  else teleport.attach();
}

/**
 * In a seat in the headset the eyes stay at the seat's eye point: sit down or stand up in the room after
 * taking it (a drop or rise of more than EYE_DRIFT m, held for EYE_SETTLE s) and the view moves back to it,
 * so you're never left down in the cushion or up through the roof. Leaning in to look at something is
 * shorter or smaller than that and is left alone. `base` is the head's height in the room at the seat's eye.
 */
const EYE_DRIFT = 0.25;
const EYE_SETTLE = 1.2;
const eyeLevel = { base: 0, since: 0 };
function keepEyeLevel() {
  if (seat === 'outside') return void (eyeLevel.base = 0);
  const h = rig.camera.realWorldHeight;
  if (!h) return;
  if (!eyeLevel.base) return void ((eyeLevel.base = h), (eyeLevel.since = 0));
  const drift = h - eyeLevel.base;
  if (Math.abs(drift) < EYE_DRIFT) return void (eyeLevel.since = 0);
  const now = performance.now() / 1000;
  if (!eyeLevel.since) eyeLevel.since = now;
  if (now - eyeLevel.since < EYE_SETTLE) return;
  rig.camera.position.y -= drift;
  eyeLevel.base = h;
  eyeLevel.since = 0;
}

/** Moves the viewer into `name`'s seat (or outside) after `change` runs (and settles), behind a fade in the headset. */
async function arrive(name, change) {
  if (inXr()) {
    // Worked out while the view is dark, after the change: the truck may have moved by then.
    const feet = new Vector3();
    const look = new Vector3();
    const where = () => {
      const e = eyeOf(name);
      feet.copyFrom(e.eye);
      // Outside you stand on the ground at your own height; in a seat your eyes go exactly to the seat's
      // (eyeHeight 0 below), whether you sit or stand in the room and whatever the headset knows of it yet.
      if (name === 'outside') feet.y -= OUTSIDE.eye.y;
      look.copyFrom(e.look);
    };
    await rig.moveTo(feet, look, async () => {
      await change?.();
      where();
    }, name === 'outside' ? {} : { eyeHeight: 0 });
    eyeLevel.base = 0;
  } else {
    await change?.();
    const { eye, look } = eyeOf(name);
    flyTo(eye, look, name !== 'outside');
    // Straight there, no glide across the map.
    camera.target.copyFrom(flight.target);
    camera.alpha = flight.alpha;
    camera.beta = flight.beta;
    camera.radius = flight.radius;
    flight = null;
  }
}

async function startRide() {
  if (ride.world !== 'showroom') return;
  // From outside, it seats you at the wheel first.
  if (seat === 'outside') await sitIn('driver');
  ride.world = 'loading';
  gear = 'P';                                      // the ride shifts itself into D
  ride.error = null;
  ride.shown = -1;
  cardOpen = true;
  render();
  try {
    await loadBigSur();
  } catch (err) {
    console.error('[cyb] Big Sur could not load', err);
    ride.loading = null;
    ride.built = 0;
    if (ride.world !== 'loading') return;
    ride.world = 'showroom';
    ride.error = 'Big Sur could not load. Try again.';
    render();
    return;
  }
  // Cancelled while it loaded: it's kept, for the next time.
  if (ride.world !== 'loading') return;
  // It won't drive with a door open.
  if (anyDoorOpen()) {
    setDoorsAll(false);
    await new Promise((r) => setTimeout(r, DOOR_SECONDS * 1000 + 100));
  }
  await arrive(seat, async () => {
    applyWorld('bigsur');
    // Behind the fade, until the coast draws complete (it was prepared ahead, so this is short).
    await coastReady();
  });
  cardOpen = !inXr();
  render();
  setTimeout(() => {
    if (ride.world !== 'bigsur') return;
    ride.drive.start(performance.now() / 1000);
    render();
  }, 1500);
}

/** Back to the showroom while it loads; the loading carries on, for the next time. */
function cancelRide() {
  if (ride.world !== 'loading') return;
  ride.world = 'showroom';
  render();
}

/** Stops the truck in its lane, then runs `then` (open a door, step out). */
function stopHere(then) {
  if (ride.world !== 'bigsur') return;
  ride.afterStop = then ?? null;
  ride.drive.pause();
  if (ride.drive.stopped) runAfterStop();
  cardOpen = true;
  render();
}

function runAfterStop() {
  const then = ride.afterStop;
  ride.afterStop = null;
  then?.();
  render();
}

/** Out of the stopped truck onto Highway 1: its driver's door opens and you stand by its front corner. */
async function stepOutOnRoad() {
  if (ride.world !== 'bigsur' || seat === 'outside') return;
  if (!ride.drive.stopped) return stopHere(stepOutOnRoad);
  if (doors.fl && doors.fl.target < 0.5) {
    doors.fl.target = 1;
    await new Promise((r) => setTimeout(r, DOOR_SECONDS * 700));
  }
  seat = 'outside';
  updateTeleport();
  await arrive('outside');
  cardOpen = true;
  render();
}

/** Back in a seat with the doors shut, it drives on from where it stopped. */
async function driveOn() {
  if (ride.world !== 'bigsur' || !ride.drive.state.paused) return;
  if (seat === 'outside') {
    seat = 'driver';
    updateTeleport();
    await arrive('driver');
  }
  if (anyDoorOpen()) {
    setDoorsAll(false);
    await new Promise((r) => setTimeout(r, DOOR_SECONDS * 1000 + 100));
  }
  ride.drive.resume(performance.now() / 1000);
  cardOpen = !inXr();
  render();
}

function againRide() {
  if (seat === 'outside') seat = 'driver';
  updateTeleport();
  setDoorsAll(false);
  arrive(seat, () => ride.drive.reset()).then(() => {
    ride.drive.start(performance.now() / 1000);
    render();
  });
}

async function endRide(name = seat) {
  if (ride.world !== 'bigsur') return;
  ride.afterStop = null;
  ride.drive.stop();
  seat = name;
  await arrive(name, () => applyWorld('showroom'));
  cardOpen = true;
  render();
}

/** One step of the ride; the viewer goes with the truck: their head in the headset, the camera on screens. */
function rideStep() {
  if (ride.world !== 'bigsur' || !ride.drive) return;
  const now = performance.now() / 1000;
  const dt = ride.lastMs ? Math.min(0.1, now - ride.lastMs) : 0;
  ride.lastMs = now;
  const wasDone = ride.drive.state.done;
  const { delta, dyaw } = ride.drive.update(dt, now);
  if (ride.afterStop && ride.drive.stopped) runAfterStop();
  if (seat === 'outside') {
    // Standing on the road: the truck is stopped, nothing to carry.
  } else if (inXr()) {
    const cam = rig.camera;
    Vector3.TransformCoordinatesToRef(cam.position, delta, cam.position);
    if (dyaw) {
      const e = cam.rotationQuaternion.toEulerAngles();
      Quaternion.FromEulerAnglesToRef(e.x, e.y + dyaw, e.z, cam.rotationQuaternion);
    }
  } else {
    Vector3.TransformCoordinatesToRef(camera.target, delta, camera.target);
    camera.alpha -= dyaw;
    if (flight) {
      Vector3.TransformCoordinatesToRef(flight.target, delta, flight.target);
      flight.alpha -= dyaw;
    }
  }
  sun.position.copyFrom(pose.position).addInPlace(TO_SUN_BIGSUR.scale(30));
  if (!wasDone && ride.drive.state.done) {
    cardOpen = true;
    render();
  }
  // The card's title follows the truck from Stopping to Stopped.
  const halted = ride.drive.stopped;
  if (halted !== ride.wasStopped) {
    ride.wasStopped = halted;
    if (cardOpen) render();
  }
}
scene.onBeforeRenderObservable.add(() => {
  if (!inXr()) rideStep();
  else if (ride.world !== 'bigsur') ride.lastMs = 0;
});

function rideContent() {
  const kicker = 'Self-driving ride · Highway 1, Big Sur';
  const closeAction = inXr() ? [{ label: 'Close', onClick: close }] : [];
  if (ride.world === 'loading') {
    const { loaded, total } = ride.bytes;
    const downloading = !total || loaded < total;
    return {
      kicker,
      title: `Getting the road ready · ${Math.round(rideProgress() * 100)}%`,
      body: downloading
        ? `Downloading 5 km of the Big Sur coast: its ground and aerial photos${total ? `, ${downloadDetail()}` : ''}. It’s only downloaded once.`
        : 'Building the road, the hills and the sea. Nearly there.',
      fact: 'The ride starts by itself when it’s ready.',
      actions: [{ label: 'Cancel', onClick: cancelRide }],
      loader: true,
    };
  }
  const st = ride.drive.state;
  const doorAction = { label: anyDoorOpen() ? 'Close doors' : 'Open doors', onClick: () => setDoorsAll(!anyDoorOpen()) };
  const credits = 'A simulation, not the maker’s software. Ground and photos: USGS 3DEP and USDA NAIP. Road: © OpenStreetMap contributors.';
  if (seat === 'outside') {
    return {
      kicker,
      title: 'Standing on Highway 1',
      body: 'Walk round the truck on the real road: the ocean on one side, the hills on the other. Get back in when you’re ready to drive on.',
      fact: inXr() ? 'Left stick: walk along the road. Right stick: forward to teleport. A or X opens and closes this menu.' : credits,
      actions: [
        { label: 'Back to the showroom', onClick: () => endRide('outside') },
        ...(st.done ? [{ label: 'Drive it again', onClick: againRide }] : []),
        doorAction,
        st.done ? { label: "Driver's seat", primary: true, onClick: () => sitIn('driver') } : { label: 'Get in and drive on', primary: true, onClick: driveOn },
        ...closeAction,
      ],
    };
  }
  const seats = [
    ...(seat !== 'driver' ? [{ label: "Driver's seat", onClick: () => sitIn('driver') }] : []),
    ...(seat !== 'passenger' ? [{ label: 'Passenger seat', onClick: () => sitIn('passenger') }] : []),
    ...(seat !== 'rear' ? [{ label: 'Back seat', onClick: () => sitIn('rear') }] : []),
  ];
  if (st.done) {
    return {
      kicker,
      title: 'Arrived at the Little Sur River',
      body: 'Five kilometres from Bixby Creek Bridge, over Hurricane Point and down to the river mouth. Step out and look round.',
      actions: [
        { label: 'Back to the showroom', onClick: () => endRide() },
        { label: 'Step out', onClick: stepOutOnRoad },
        { label: 'Drive it again', primary: true, onClick: againRide },
        ...closeAction,
      ],
    };
  }
  if (st.paused) {
    const stopped = ride.drive.stopped;
    return {
      kicker,
      title: stopped ? 'Stopped on Highway 1' : 'Stopping',
      body: stopped
        ? 'It has stopped in its lane. Open a door, step out onto the road and walk round the truck, then get back in and it drives on.'
        : 'It won’t open a door while it’s moving: it’s slowing to a stop in its lane.',
      fact: credits,
      actions: [
        ...(stopped ? [doorAction, { label: 'Step out', onClick: stepOutOnRoad }] : []),
        { label: 'End the ride', onClick: () => endRide() },
        { label: 'Drive on', primary: true, onClick: driveOn },
        ...closeAction,
      ],
    };
  }
  return {
    kicker,
    title: st.running ? 'Driving itself south' : 'Ready',
    body: 'From Bixby Creek Bridge over Hurricane Point to the Little Sur River: 5 km of the real road, on its real heights. Stay seated and let it drive, or stop to get out; the centre screen shows the lane, the path it plans and the map.',
    fact: inXr() ? 'A or X opens and closes this menu. Press a door’s button to stop and open it.' : credits,
    actions: [
      ...seats,
      ...(st.running ? [{ label: 'Stop here', onClick: () => stopHere() }] : []),
      { label: 'End the ride', primary: true, onClick: () => endRide() },
      ...closeAction,
    ],
  };
}

async function start() {
  // Before createXr: the headset rig starts the log too, and only the first start's state() is kept.
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), seat, xr: inXr(), covers: covers[0]?.isEnabled(),
    world: ride.world, s: ride.drive ? Math.round(ride.drive.state.s) : undefined, v: ride.drive ? +ride.drive.state.v.toFixed(1) : undefined,
    tonneau: +tonneau.u.toFixed(2), tailgate: +(hinged.tailgate?.t ?? 0).toFixed(2),
    doorsOpen: Object.entries(doors).filter(([, d]) => d.target > 0.5).map(([k]) => k).join(',') }));
  truck = await loadTruck();
  // Only the door buttons, the screens and (from the driver's seat) the yoke's controls take the pointer:
  // the rest of the dash would catch presses meant for the card.
  screen = createScreen(scene, truck.byName('int_screen'), {
    controls: screenControls,
    action: screenAction,
    loading: () => (ride.world === 'loading' ? { progress: rideProgress(), detail: downloadDetail() } : null),
    gear: () => gear,
  });
  screen.show(true);
  setUpMirrors(truck.byName);
  scene.onBeforeRenderObservable.add(() => screen.tick(engine.getDeltaTime() / 1000));
  setUpGlows();
  scene.onBeforeRenderObservable.add(applyRear);
  yokeControls = createYokeControls(scene, truck.byName, truck.info, {
    onHighBeam: (on) => {
      glows.highBeam = on;
      if (on) glows.lightsOn = true;               // the high beam brings the lights on with it
      applyGlows();
      if (cardOpen) render();
    },
  });
  roofGlass = truck.root.getChildMeshes().find((m) => m.name === 'roof_glass')?.material ?? null;
  setUpSeatSpots();
  for (const m of truck.root.getChildMeshes()) m.isPickable = doorTargets.has(m) || screen.meshes.includes(m);
  if (yokeControls) {
    yokeControls.active = false;
    scene.onBeforeRenderObservable.add(() => {
      yokeControls.tick(engine.getDeltaTime() / 1000);
      const driving = seat === 'driver';
      if (driving !== yokeActive) yokeControls.active = yokeActive = driving;
    });
  }
  // The card draws over the cabin, so it's never lost inside the dash.
  for (const panel of card.panels) for (const m of [panel.mesh, ...panel.mesh.getChildMeshes()]) m.renderingGroupId = 1;
  loaderStrip = createLoaderStrip(scene, card.panels[0].mesh);
  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'cyb',
    // On the road you're somewhere else: area 1, so the showroom doesn't see you floating in it.
    getPose: () => {
      const p = inXr() ? xrPose(rig) : orbitPose(camera, showroom.floors);
      return p && { ...p, area: ride.world === 'bigsur' ? 1 : 0 };
    },
    onChange: (state) => {
      refreshBar(state);
      if (inXr() && cardOpen) card.setContent({ ...content(), tools: [] });
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  const { eye, look } = eyeOf('outside');
  const off = eye.subtract(look);
  camera.target.copyFrom(look);
  camera.radius = off.length();
  camera.alpha = Math.atan2(off.z, off.x);
  camera.beta = Math.acos(off.y / off.length());

  try {
    if (await xrSupported()) {
      // A copy: teleport keeps the list it's given as its own and changes it (updateTeleport).
      rig = await createXr(scene, { floorMeshes: [...showroom.floors], start: { position: new Vector3(eye.x, 0, eye.z), lookAt: look } });
    }
  } catch (err) {
    console.warn('[cyb] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.02;
    rig.camera.maxZ = FAR;
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
    presence.attachXr(rig.xr);
    // The ride steps first in each headset frame, before the camera takes its pose from the moved
    // reference space: done later, the head would trail the cabin by a frame (35 cm at 55 mph).
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (!inXr()) return;
      rideStep();
      keepEyeLevel();
    }, undefined, true);
    let framesSinceEnter = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      framesSinceEnter = entered ? 0 : -1;
      if (!entered) render();
    });
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (framesSinceEnter < 0 || ++framesSinceEnter < 6) return;
      framesSinceEnter = -1;
      // The session starts you standing outside; already in a seat (or out on the road), you're put back there.
      if (seat !== 'outside' || ride.world === 'bigsur') arrive(seat);
      cardOpen = true;
      render();
    });
    // A, X or the menu button: the card in front of you, or away when it's already there.
    createMenuControls(scene, rig, card, { open, close });
  }

  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  ui.menu.disabled = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[cyb] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}
ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
ui.menu.addEventListener('click', open);
addEventListener('keydown', (e) => {
  if (inXr() || e.target.closest?.('input, textarea')) return;
  if (e.key === 'Escape' && cardOpen) close();
  // M: the menu, open or closed.
  if (e.key === 'm' || e.key === 'M') (cardOpen ? close : open)();
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[cyb]', err);
  ui.pct.textContent = 'The truck could not load. Reload to try again.';
});

// For automated checks in a browser.
window.__cyb = { get yoke() { return yokeControls; }, controls: screenControls, mirrors, scene, camera, sitIn, startRide, endRide, stopHere, stepOutOnRoad, driveOn, open, close, ride, pose, toggleCovers, toggleDoor, setDoorsAll, tonneauPress, tonneau, hinged, setTailgate, hingePress, get doors() { return doors; }, get eyes() { return eyes; }, get truck() { return truck; }, get screen() { return screen; } };
