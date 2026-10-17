// VRtor Roadster (/rds): a full-size model of the second-generation Roadster revealed on 15 October 2026,
// built in assets-src/roadster with the building-3d-replicas skill, on a turntable in a dark studio
// (studio.js). Walk round it, open its scissor doors and raise its wing.
// Flat screens: an orbit camera, set views, and an HTML card (About brings it back). Headset: walk and
// teleport round the studio; A, X or the menu button opens and closes the card. Other visitors show up as
// avatars and can talk (presence, from xr-shell).
import {
  ArcRotateCamera,
  Color3,
  Constants,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  PointerEventTypes,
  Quaternion,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {
  continueInVr,
  createCard,
  createMenuControls,
  createPresence,
  createXr,
  mountPresenceControls,
  orbitPose,
  presenceCard,
  roomsCard,
  startHeadsetLog,
  xrPose,
  xrSupported,
} from '@vrtor/xr-shell';
import { createStudio, TABLE_TOP } from './studio.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
/** The model's version: its files are cached for an hour at a stable path, so the app asks for this one. */
const MODEL_V = '20261016c';
/** Seconds for a door to open or shut. */
const DOOR_SECONDS = 1.4;
/** The turntable's speed, rad/s: once round in about 50 s. */
const TURN_SPEED = 0.125;

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'),
  pct: $('.loading-pct'),
  retry: $('[data-retry]'),
  card: $('.card'),
  kicker: $('.card-kicker'),
  title: $('.card-title'),
  body: $('.card-body'),
  fact: $('.card-fact'),
  actions: $('.card-actions'),
  vr: $('[data-enter-vr]'),
  bar: $('.bar'),
  doors: $('[data-doors]'),
  wing: $('[data-wing]'),
  turn: $('[data-turn]'),
  menu: $('[data-menu]'),
  views: [...document.querySelectorAll('[data-view]')],
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor.set(0.04, 0.05, 0.06, 1);
scene.ambientColor = new Color3(0.25, 0.25, 0.27);
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.0;

/** Looking at the front left three-quarter, as the reveal photos do. */
const HOME = { alpha: Math.PI / 2 + 0.8, beta: 1.22, radius: 8.2, target: new Vector3(0, 0.62, 0) };
const camera = new ArcRotateCamera('orbit', HOME.alpha, HOME.beta, HOME.radius, HOME.target.clone(), scene);
camera.minZ = 0.02;
camera.maxZ = 200;
camera.lowerRadiusLimit = 2.2;
camera.upperRadiusLimit = 16;
camera.lowerBetaLimit = 0.03;
camera.upperBetaLimit = 1.52;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);
// Desktop and phone only: the headset keeps its own MSAA layer, and the materials tone-map themselves.
const pipeline = new DefaultRenderingPipeline('sharp-view', false, scene, [camera]);
pipeline.imageProcessingEnabled = false;
pipeline.samples = engine.webGLVersion > 1 ? 4 : 1;
pipeline.fxaaEnabled = pipeline.samples < 2;

// ---------------------------------------------------------------- the studio

const studio = createStudio(scene);
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.diffuse = Color3.FromHexString('#dfe6ee');
hemi.groundColor = Color3.FromHexString('#2a2c30');
hemi.specular = Color3.Black();
hemi.intensity = 0.55;
/** A key light high over the front left, so the shoulders and the hood's facets read. */
const TO_KEY = new Vector3(-0.35, 0.85, 0.4).normalize();
const key = new DirectionalLight('key', TO_KEY.scale(-1), scene);
key.position = TO_KEY.scale(20);
key.intensity = 1.7;
const shadows = new ShadowGenerator(2048, key);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.bias = 0.0015;
shadows.normalBias = 0.02;
key.autoCalcShadowZBounds = true;
/** The shadow is drawn once; a door or the turntable moving asks for it again. */
let shadowStale = false;
const shadowMoved = () => { shadowStale = true; };
scene.onBeforeRenderObservable.add(() => {
  if (!shadowStale) return;
  shadowStale = false;
  shadows.getShadowMap().resetRefreshCounter();
});

// White paint and gold glass show what surrounds them: the studio rendered once into a cube map.
const probe = new ReflectionProbe('env', 256, scene);
probe.position = new Vector3(0, 1.0, 0);
probe.renderList.push(...studio.envMeshes);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 1.0;

// ---------------------------------------------------------------- the car

/** The car stands on the turntable and turns with it. */
const pose = studio.table;
/** Doors by node name (door_l, door_r): node, axis, how far it opens, and how far open it is now (0..1). */
const doors = {};
/** The active rear wing: the same kind of mover as a door (node, axis, angle, 0..1); null until the model loads. */
let wing = null;
let turning = false;

async function loadCar() {
  const info = await (await fetch(`${BASE}models/roadster.json?v=${MODEL_V}`)).json();
  const container = await LoadAssetContainerAsync(`${BASE}models/roadster.glb?v=${MODEL_V}`, scene, {
    onProgress: (e) => e.lengthComputable && (ui.pct.textContent = `${Math.round((e.loaded / e.total) * 100)}%`),
  });
  container.addAllToScene();
  const root = container.meshes[0];
  root.parent = pose;
  root.position.y = TABLE_TOP;
  for (const m of container.meshes) {
    if (m.getTotalVertices() > 0) shadows.addShadowCaster(m, false);
  }
  // The probe's cube map isn't prefiltered: glossy paint read its plain mips, which band where the light
  // panels' edges are. Filtering per pixel blurs them as a real finish does; LOW is cheap enough for Quest.
  for (const mat of container.materials) {
    if (mat.realTimeFiltering === undefined) continue;
    mat.realTimeFiltering = true;
    mat.realTimeFilteringQuality = Constants.TEXTURE_FILTERING_QUALITY_LOW;
  }
  // The doors' nodes sit on their hinges, so turning the node about the json's axis swings the door.
  // The axis is in glTF's frame, which is the node's own (the loader's root does the change to Babylon's).
  for (const [name, d] of Object.entries(info.doors ?? {})) {
    const node = container.transformNodes.find((n) => n.name === name);
    if (!node) continue;
    node.rotationQuaternion ??= Quaternion.Identity();
    const meshes = new Set(node.getChildMeshes());
    doors[name] = { node, axis: Vector3.FromArray(d.axis).normalize(), open: (d.openDeg * Math.PI) / 180, t: 0, target: 0, meshes };
  }
  if (info.wing) {
    const node = container.transformNodes.find((n) => n.name === info.wing.node);
    if (node) {
      node.rotationQuaternion ??= Quaternion.Identity();
      wing = { node, axis: Vector3.FromArray(info.wing.axis).normalize(), open: (info.wing.openDeg * Math.PI) / 180, t: 0, target: 0, meshes: new Set(node.getChildMeshes()) };
    }
  }
  shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  return { root, info, meshes: container.meshes.filter((m) => m.getTotalVertices() > 0) };
}

const doorsOpen = () => Object.values(doors).some((d) => d.target > 0.5);
function setDoors(open) {
  for (const d of Object.values(doors)) d.target = open ? 1 : 0;
  render();
}
const wingUp = () => !!wing && wing.target > 0.5;
function setWing(up) {
  if (wing) wing.target = up ? 1 : 0;
  render();
}
function toggleDoor(name) {
  if (name === 'wing') return setWing(!wingUp());
  const d = doors[name];
  if (!d) return;
  d.target = d.target > 0.5 ? 0 : 1;
  render();
}
const ease = (t) => t * t * (3 - 2 * t);
function moveDoors(dt) {
  let moving = false;
  for (const d of [...Object.values(doors), ...(wing ? [wing] : [])]) {
    if (d.t === d.target) continue;
    const step = dt / DOOR_SECONDS;
    d.t = d.target > d.t ? Math.min(d.target, d.t + step) : Math.max(d.target, d.t - step);
    Quaternion.RotationAxisToRef(d.axis, d.open * ease(d.t), d.node.rotationQuaternion);
    moving = true;
  }
  if (moving) shadowMoved();
}
/** Which door a picked mesh belongs to, if any. */
function doorOf(mesh) {
  for (const [name, d] of Object.entries(doors)) if (d.meshes.has(mesh)) return name;
  if (wing?.meshes.has(mesh)) return 'wing';
  return null;
}

// ---------------------------------------------------------------- views (flat screens)

const VIEWS = {
  home: HOME,
  front: { alpha: Math.PI / 2, beta: 1.45, radius: 7.2, target: new Vector3(0, 0.55, 0) },
  side: { alpha: Math.PI, beta: 1.45, radius: 8.6, target: new Vector3(0, 0.55, 0) },
  rear: { alpha: -Math.PI / 2, beta: 1.42, radius: 7.2, target: new Vector3(0, 0.6, 0) },
  top: { alpha: Math.PI, beta: 0.03, radius: 9.5, target: new Vector3(0, 0.6, 0) },
};
let flight = null;
function fly(name) {
  const v = VIEWS[name];
  // The views are of the car, wherever the turntable has turned it.
  flight = { ...v, alpha: v.alpha - pose.rotation.y };
}
function flyStep(dt) {
  if (!flight) return;
  const k = Math.min(1, dt / 0.12);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  const da = Math.atan2(Math.sin(flight.alpha - camera.alpha), Math.cos(flight.alpha - camera.alpha));
  camera.alpha += da * k;
  camera.beta += (flight.beta - camera.beta) * k;
  camera.radius += (flight.radius - camera.radius) * k;
  if (Math.abs(da) < 0.001 && Math.abs(flight.beta - camera.beta) < 0.001 && Math.abs(camera.radius - flight.radius) < 0.01) flight = null;
}
canvas.addEventListener('pointerdown', () => (flight = null));
/** Portrait screens fit the car's length across; landscape ones its height. */
function fitCamera() {
  camera.fovMode = innerWidth < innerHeight ? ArcRotateCamera.FOVMODE_HORIZONTAL_FIXED : ArcRotateCamera.FOVMODE_VERTICAL_FIXED;
  camera.fov = innerWidth < innerHeight ? 1.0 : 0.8;
}
fitCamera();
/**
 * How far (view units at the target) puts the car in the middle of the space the card leaves: to its right on a
 * wide screen, above it on a narrow one.
 */
function cardShift() {
  const r = ui.card.getBoundingClientRect();
  const aspect = engine.getAspectRatio(camera);
  const tan = camera.radius * Math.tan(camera.fov / 2);
  const halfW = camera.fovMode === ArcRotateCamera.FOVMODE_HORIZONTAL_FIXED ? tan : tan * aspect;
  if (innerWidth > 760) return { x: (((r.right + innerWidth) / 2 - innerWidth / 2) / (innerWidth / 2)) * halfW, y: 0 };
  const halfH = halfW / aspect;
  return { x: 0, y: ((innerHeight / 2 - Math.max(60, r.top) / 2) / (innerHeight / 2)) * halfH * 0.9 };
}
canvas.addEventListener('wheel', () => (flight = null), { passive: true });

// ---------------------------------------------------------------- the card

let rig = null;
let presence = null;
let panel = null;
let busy = true;
let cardOpen = true;
/** Which page of the card: intro, sizes, people, rooms. */
let page = 'intro';
const inXr = () => !!rig?.inXr();
const action = (label, onClick, primary = false) => ({ label, onClick: () => { if (!busy) onClick(); }, primary });
const doorAction = (primary = true) => action(doorsOpen() ? 'Close doors' : 'Open doors', () => setDoors(!doorsOpen()), primary);
const wingAction = () => action(wingUp() ? 'Stow wing' : 'Raise wing', () => setWing(!wingUp()));
const CONTROLS_XR = 'Left stick: walk. Right stick: forward to teleport, left or right to turn. Point at a door or the wing and pull the trigger to move it. A or X opens and closes this card; B or Y joins other visitors.';
const CONTROLS_FLAT = 'Drag to look around, scroll to zoom. Click a door or the rear wing to move it.';

function content() {
  if (busy) return { kicker: 'Roadster', title: 'Rolling it out…', body: 'Loading the model.', fact: '', actions: [] };
  if (page === 'rooms') return roomsCard('rds', rig, action, () => { page = 'intro'; render(); });
  if (page === 'people' && presence) return presenceCard(presence, action, () => { page = 'intro'; render(); });
  if (page === 'sizes') {
    return {
      kicker: 'Measured from photos',
      title: 'About 4.59 m long',
      body: 'No dimensions have been published, so these come from six reveal photos and the reveal stream, scaled by the US licence plate on the tail (12 by 6 in): 4.59 m long, 2.01 m wide, 1.18 m high, 2.92 m between the axles. Good to about one percent, not to the millimetre.',
      fact: 'Guessed, not measured: the cabin\'s sizes, the door hinge (the doors open as in the reveal, but no photo shows the hinge) and the path of the wing\'s struts.',
      actions: [action('Back', () => { page = 'intro'; render(); }), doorAction(), wingAction()],
    };
  }
  return {
    kicker: 'Revealed 15 October 2026',
    title: 'Roadster',
    body: 'A full-size model of the new two-seat Roadster, built from the reveal photos. Walk round it, open the scissor doors, raise the rear wing, and stand beside it: the roof comes up to about your chest.',
    fact: inXr() ? CONTROLS_XR : CONTROLS_FLAT,
    actions: [action('Sizes', () => { page = 'sizes'; render(); }), ...peopleAction(), doorAction(), wingAction()],
  };
}
// In the headset the bar isn't visible, so visitors are a page of the card.
function peopleAction() {
  if (!inXr() || !presence || presence.state.status !== 'online') return [];
  const s = presence.state;
  const open = () => { page = 'people'; render(); };
  if (!s.joined) return [action(s.online > 1 ? `Join ${s.online - 1} here` : 'Join others', () => { presence.join(); open(); })];
  return [action(`People · ${s.here}`, open)];
}
/** The headset's strip under the card: what the bar does on a flat screen. */
function tools() {
  if (busy || page === 'people' || page === 'rooms') return [];
  return [
    action(turning ? 'Stop turntable' : 'Turntable', toggleTurn),
    action('Change room', () => { page = 'rooms'; cardOpen = true; render(); }),
  ];
}

function render() {
  const data = content();
  ui.doors.textContent = doorsOpen() ? 'Close doors' : 'Open doors';
  if (ui.wing) ui.wing.textContent = wingUp() ? 'Stow wing' : 'Raise wing';
  ui.turn.textContent = turning ? 'Stop turning' : 'Turntable';
  for (const b of [ui.doors, ui.wing, ui.turn, ui.menu, ...ui.views].filter(Boolean)) b.disabled = busy;
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) {
      panel.hide();
      return;
    }
    panel.setContent({ ...data, tools: tools(), onClose: close });
    const f = rig.headForward();
    const a = -0.45;
    panel.place(rig.headPosition(), new Vector3(f.x * Math.cos(a) + f.z * Math.sin(a), 0, -f.x * Math.sin(a) + f.z * Math.cos(a)));
    return;
  }
  panel?.hide();
  ui.card.hidden = !cardOpen;
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact;
  ui.fact.hidden = !data.fact;
  ui.actions.replaceChildren(...data.actions.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn btn-primary' : 'btn';
    b.textContent = a.label;
    b.disabled = busy;
    b.addEventListener('click', a.onClick);
    return b;
  }));
}
function close() {
  cardOpen = false;
  page = 'intro';
  render();
  if (!inXr()) canvas.focus({ preventScroll: true });
}
function toggleTurn() {
  turning = !turning;
  render();
}

// Clicking a door (or pointing at it in the headset and pulling the trigger) opens or shuts it.
scene.onPointerObservable.add((info) => {
  if (busy) return;
  const xr = info.event?.pointerType === 'xr';
  if (xr ? info.type !== PointerEventTypes.POINTERDOWN : info.type !== PointerEventTypes.POINTERTAP) return;
  const hit = xr ? info.pickInfo : scene.pick(scene.pointerX, scene.pointerY);
  const name = hit?.hit ? doorOf(hit.pickedMesh) : null;
  if (name) toggleDoor(name);
});

// The card sits just above the bar, however many rows the bar wraps to.
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-top', `${Math.round(innerHeight - ui.bar.getBoundingClientRect().top)}px`);
}).observe(ui.bar);

// ---------------------------------------------------------------- start

async function start() {
  const car = await loadCar();
  panel = createCard(scene, { name: 'rds-card' });
  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'rds',
    getPose: () => (inXr() ? xrPose(rig) : orbitPose(camera, studio.floors)),
    onChange: (state) => {
      refreshBar(state);
      if (inXr() && cardOpen && !busy && (page === 'people' || page === 'intro')) panel.setContent({ ...content(), tools: tools(), onClose: close });
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  try {
    if (await xrSupported()) {
      // You arrive at the front left corner, 2 m off it, looking at the car.
      rig = await createXr(scene, { floorMeshes: studio.floors, start: { position: new Vector3(-2.9, 0, 3.6), lookAt: new Vector3(0, 0.7, 0) } });
    }
  } catch (e) {
    console.warn('[rds] VR unavailable', e);
  }
  if (rig) {
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const p of panel.panels) rig.mirrorPanel(p, { interactive: true });
    let frames = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      frames = entered ? 0 : -1;
      if (!entered) render();
    });
    // A few frames in, the card opens in front of you (the headset knows where you're looking by then).
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (frames < 0 || ++frames < 6) return;
      frames = -1;
      cardOpen = true;
      render();
    });
    presence.attachXr(rig.xr);
    createMenuControls(scene, rig, panel, { open: () => { cardOpen = true; render(); }, close });
  }
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), doors: Object.values(doors).map((d) => +d.t.toFixed(2)), turning }));

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
    moveDoors(dt);
    if (turning) {
      pose.rotation.y += TURN_SPEED * dt;
      shadowMoved();
    }
    if (!inXr()) {
      flyStep(dt);
      // With the card open, the car moves over into the space the card leaves.
      const want = cardOpen && ui.card.offsetWidth ? cardShift() : { x: 0, y: 0 };
      const k = Math.min(1, dt / 0.2);
      camera.targetScreenOffset.x += (want.x - camera.targetScreenOffset.x) * k;
      camera.targetScreenOffset.y += (want.y - camera.targetScreenOffset.y) * k;
    }
  });

  // Hide the loading screen once the car's shaders are compiled, so nothing pops in (8 s at most).
  const until = performance.now() + 8000;
  await new Promise((done) => {
    const check = () => (car.meshes.every((m) => m.isReady(true)) || performance.now() > until ? done() : setTimeout(check, 100));
    check();
  });
  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  busy = false;
  render();
}

ui.doors.addEventListener('click', () => setDoors(!doorsOpen()));
ui.wing?.addEventListener('click', () => setWing(!wingUp()));
ui.turn.addEventListener('click', toggleTurn);
ui.menu.addEventListener('click', () => { cardOpen = !cardOpen || page !== 'intro'; page = 'intro'; render(); });
for (const b of ui.views) b.addEventListener('click', () => fly(b.dataset.view));
ui.vr.addEventListener('click', async () => {
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (e) {
    console.warn('[rds] Enter VR failed', e);
  } finally {
    ui.vr.disabled = false;
  }
});
ui.retry.addEventListener('click', () => location.reload());
$('.card-close').addEventListener('click', close);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
  if (e.target.matches?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') { cardOpen = !cardOpen; page = 'intro'; render(); }
  if (e.key === 'd' || e.key === 'D') setDoors(!doorsOpen());
  if (e.key === 'w' || e.key === 'W') setWing(!wingUp());
});
window.addEventListener('resize', () => {
  engine.resize();
  fitCamera();
});
engine.runRenderLoop(() => scene.render());
// `?xrdebug`: the scene in the console, for poking at it.
if (new URLSearchParams(location.search).has('xrdebug')) window.rds = { scene, camera, doors, wing: () => wing };
render();
start().catch((e) => {
  console.error('[rds]', e);
  ui.pct.textContent = 'The car could not load. Please try again.';
  ui.retry.hidden = false;
});
