// VRtor Cybertruck (/cyb): a full-size model of the stainless steel pickup,
// built in assets-src/cybertruck with the build-3d-model skill, on a turntable in a showroom
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
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  KhronosTextureContainer2,
  LoadAssetContainerAsync,
  Matrix,
  Mesh,
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
import { buildBigSur } from './bigsur.js';
import { createDrive } from './drive.js';
import { createScreen } from './screen.js';
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
  const container = await LoadAssetContainerAsync(`${BASE}models/cybertruck.glb`, scene, {
    onProgress: (e) => e.lengthComputable && (ui.pct.textContent = `${Math.round((e.loaded / e.total) * 100)}%`),
  });
  container.addAllToScene();
  const root = container.meshes[0];
  root.parent = pose;
  for (const n of [...container.transformNodes, ...container.meshes]) n.computeWorldMatrix(true);
  for (const m of container.meshes) {
    if (m.getTotalVertices() > 0) shadows.addShadowCaster(m, false);
  }
  // The json is in glTF's frame; the loader's root turns that into Babylon's.
  // In the truck's own frame (the pose node's), wherever the pose stands now.
  const world = root.getWorldMatrix().multiply(Matrix.Invert(pose.computeWorldMatrix(true)));
  for (const [k, p] of Object.entries(info.seatEyes)) eyes[k] = Vector3.TransformCoordinates(Vector3.FromArray(p), world);
  covers = container.transformNodes.filter((n) => n.name.startsWith('cover_')).concat(container.meshes.filter((m) => m.name.startsWith('cover_')));
  setUpDoors(container, info);
  shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  const byName = (name) => container.transformNodes.find((n) => n.name === name) ?? container.meshes.find((m) => m.name === name);
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
  }
});

let hovered = null;
function hover(key) {
  if (key === hovered) return;
  for (const k of [hovered, key]) {
    if (!k || !doors[k]) continue;
    for (const b of doors[k].buttons) b.material.emissiveColor = k === key ? GLOW : Color3.Black();
  }
  hovered = key;
  canvas.style.cursor = key && !inXr() ? 'pointer' : '';
}

scene.onPointerObservable.add((info) => {
  const pick = info.pickInfo;
  const key = doorTargets.get(pick?.pickedMesh) ?? null;
  const xrPointer = info.event?.pointerType === 'xr';
  const sitTo = seatTargets.get(pick?.pickedMesh) ?? null;
  if (info.type === PointerEventTypes.POINTERMOVE) {
    hover(key);
    hoverSpot(sitTo ? pick.pickedMesh : null);
    // The centre screen's buttons light up under the pointer too.
    const onScreen = screen?.hover(pick) ?? false;
    if (!inXr()) canvas.style.cursor = key || sitTo || onScreen ? 'pointer' : '';
    return;
  }
  const press = (xrPointer && info.type === PointerEventTypes.POINTERDOWN) || (!xrPointer && info.type === PointerEventTypes.POINTERTAP);
  if (!press) return;
  if (key) toggleDoor(key);
  else if (sitTo) sitIn(sitTo);
  else screen?.tap(pick);
});

// ---------------------------------------------------------------- the centre screen

/** The touchscreen (screen.js): on from the start, parked in the showroom, the road and map on the ride. */
let screen = null;
/** The light bar front and back, and the cabin's ambient strips: their materials and how they glow. */
const glows = { lights: [], ambient: [], lightsOn: true, colour: 0 };
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
  glows.lights = ['light_front', 'light_rear'].flatMap(meshes).map(own).filter(Boolean);
  glows.ambient = truck.root.getChildMeshes().filter((m) => /(^|_)int_ambient/.test(m.name)).map(own).filter(Boolean);
}

function applyGlows() {
  for (const g of glows.lights) g.mat.emissiveColor = glows.lightsOn ? g.rest.clone() : Color3.Black();
  const { color } = AMBIENT[glows.colour];
  for (const g of glows.ambient) g.mat.emissiveColor = color ? color.scale(Math.max(g.rest.r, g.rest.g, g.rest.b) || 1) : g.rest.clone();
}

/** The screen's big button: start the ride from a seat, drive on after a stop, drive it again. */
function screenAction() {
  if (seat === 'outside') return null;
  if (ride.world === 'showroom') return { label: 'Start self-driving', onClick: startRide };
  if (ride.world === 'loading') return { label: 'Getting the road ready…', disabled: true };
  const st = ride.drive.state;
  if (st.done) return { label: 'Drive it again', onClick: againRide };
  if (st.paused) return { label: ride.drive.stopped ? 'Drive on' : 'Stopping…', disabled: !ride.drive.stopped, onClick: driveOn };
  return null;
}

/** The screen's Controls panel. */
function screenControls() {
  return [
    { label: 'Doors', value: anyDoorOpen() ? 'Open · tap to close' : 'Closed · tap to open', active: anyDoorOpen(), onClick: () => setDoorsAll(!anyDoorOpen()) },
    { label: 'Lights', value: glows.lightsOn ? 'On' : 'Off', active: glows.lightsOn, onClick: () => ((glows.lightsOn = !glows.lightsOn), applyGlows()) },
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
      ? 'Built from the maker’s dimensions and photos. No door handles: press the black button on the pillar behind a door, then step in where it says Sit here.'
      : 'The dash shelf, the yoke, the touchscreen and the glass roof. Tap Start self-driving on the screen for 5 km of Highway 1 in Big Sur.',
    fact: inXr()
      ? menuFact
      : '5.68 m long, 2.03 m wide without its mirrors, 1.79 m high, on 35-inch tyres.',
    actions,
  };
}

function render() {
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

/** world: showroom, loading or bigsur. Big Sur loads the first time a ride is asked for. */
const ride = { world: 'showroom', bigsur: null, drive: null, loading: null, progress: 0, error: null, lastMs: 0, afterStop: null };

function loadBigSur() {
  ride.loading ??= buildBigSur(scene, (f) => {
    ride.progress = f;
    render();
  }).then((world) => {
    ride.bigsur = world;
    // Made in the showroom, while the truck stands unturned on the turntable: the yoke and screen are measured there.
    ride.drive = createDrive(scene, { pose, truckInfo: truck.info, nodes: truck.byName, screen, road: world.road });
    return world;
  });
  return ride.loading;
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
  scene.fogMode = big ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE;
  scene.fogColor = HAZE;
  scene.fogDensity = 0.00004;
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
  probe.renderList.push(...(big ? [sky, ...ride.bigsur.root.getChildMeshes()] : showroom.envMeshes));
  probe.cubeTexture.resetRefreshCounter();
  updateTeleport();
}

/** Teleport in the showroom, and on the road when you're standing on it (never out of a moving truck). */
function updateTeleport() {
  const teleport = rig?.xr.teleportation;
  if (!teleport) return;
  const roadFloors = ride.bigsur?.ground ?? [];
  if (ride.world === 'bigsur') {
    for (const m of showroom.floors) teleport.removeFloorMesh(m);
    for (const m of roadFloors) teleport.addFloorMesh(m);
  } else {
    for (const m of roadFloors) teleport.removeFloorMesh(m);
    for (const m of showroom.floors) teleport.addFloorMesh(m);
  }
  if (ride.world === 'bigsur' && seat !== 'outside') teleport.detach();
  else teleport.attach();
}

/** Moves the viewer into `name`'s seat (or outside) after `change` runs, behind a fade in the headset. */
async function arrive(name, change) {
  if (inXr()) {
    // Worked out while the view is dark, after the change: the truck may have moved by then.
    const feet = new Vector3();
    const look = new Vector3();
    const where = () => {
      const e = eyeOf(name);
      feet.copyFrom(e.eye);
      // Outside you stand on the ground at your own height; in a seat your eyes go to the seat's.
      feet.y -= name === 'outside' ? OUTSIDE.eye.y : rig.camera.realWorldHeight || 1.6;
      look.copyFrom(e.look);
    };
    await rig.moveTo(feet, look, () => {
      change?.();
      where();
    });
  } else {
    change?.();
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
  ride.error = null;
  cardOpen = true;
  render();
  try {
    await loadBigSur();
  } catch (err) {
    console.error('[cyb] Big Sur could not load', err);
    ride.world = 'showroom';
    ride.loading = null;
    ride.error = 'Big Sur could not load. Try again.';
    render();
    return;
  }
  // It won't drive with a door open.
  if (anyDoorOpen()) {
    setDoorsAll(false);
    await new Promise((r) => setTimeout(r, DOOR_SECONDS * 1000 + 100));
  }
  await arrive(seat, () => applyWorld('bigsur'));
  cardOpen = !inXr();
  render();
  setTimeout(() => {
    if (ride.world !== 'bigsur') return;
    ride.drive.start(performance.now() / 1000);
    render();
  }, 1500);
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
    return { kicker, title: 'Getting the road ready', body: `Loading 5 km of the Big Sur coast: ${Math.round(ride.progress * 100)}%`, actions: [] };
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
    doorsOpen: Object.entries(doors).filter(([, d]) => d.target > 0.5).map(([k]) => k).join(',') }));
  truck = await loadTruck();
  // Only the door buttons take the pointer: from a seat, the dash and yoke would catch every press
  // meant for the card.
  screen = createScreen(scene, truck.byName('int_screen'), { controls: screenControls, action: screenAction });
  screen.show(true);
  scene.onBeforeRenderObservable.add(() => screen.tick(engine.getDeltaTime() / 1000));
  setUpGlows();
  setUpSeatSpots();
  for (const m of truck.root.getChildMeshes()) m.isPickable = doorTargets.has(m) || screen.meshes.includes(m);
  // The card draws over the cabin, so it's never lost inside the dash.
  for (const panel of card.panels) for (const m of [panel.mesh, ...panel.mesh.getChildMeshes()]) m.renderingGroupId = 1;
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
      rig = await createXr(scene, { floorMeshes: showroom.floors, start: { position: new Vector3(eye.x, 0, eye.z), lookAt: look } });
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
      if (inXr()) rideStep();
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
window.__cyb = { scene, camera, sitIn, startRide, endRide, stopHere, stepOutOnRoad, driveOn, open, close, ride, pose, toggleCovers, toggleDoor, setDoorsAll, get doors() { return doors; }, get eyes() { return eyes; }, get truck() { return truck; }, get screen() { return screen; } };
