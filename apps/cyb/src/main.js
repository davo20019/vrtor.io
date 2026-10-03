// VRtor Cybertruck (/cyb): a full-size model of the stainless steel pickup,
// built in assets-src/cybertruck with the build-3d-model skill, parked on a plaza. Walk around it,
// sit in the driver's seat or the back seat, and take the wheel covers off.
// Flat screens: an orbit camera (in a seat it turns in place) and an HTML card. Headset: walk and
// teleport on the plaza; the card's buttons move you into a seat.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
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
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createCard, createXr, continueInVr, startHeadsetLog, xrSupported } from '@vrtor/xr-shell';
import './style.css';

const BASE = import.meta.env.BASE_URL;
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
  seats: [...document.querySelectorAll('[data-seat]')],
  covers: $('[data-covers]'),
  hint: $('.hint'),
};

const SKY_TOP = Color3.FromHexString('#7fa6cf');
const SKY_HORIZON = Color3.FromHexString('#dfe7ee');
const SKY_BELOW = Color3.FromHexString('#8d8f8c');
/** Mid-afternoon sun, high and off to the front left, so the steel catches it. */
const TO_SUN = new Vector3(-0.45, 0.75, 0.48).normalize();

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromColor3(SKY_HORIZON);
scene.ambientColor = new Color3(0.3, 0.3, 0.32);
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.0;

const camera = new ArcRotateCamera('orbit', -2.3, 1.25, 9, new Vector3(0, 0.9, 0), scene);
camera.minZ = 0.02;
camera.maxZ = 2000;
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

// ---------------------------------------------------------------- the plaza

function skyDome() {
  const dome = MeshBuilder.CreateSphere('sky', { diameter: 1500, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const tex = new DynamicTexture('sky', { width: 4, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  // The dome samples this bottom-up: the ground side first.
  g.addColorStop(0, SKY_BELOW.toHexString());
  g.addColorStop(0.48, SKY_BELOW.toHexString());
  g.addColorStop(0.51, SKY_HORIZON.toHexString());
  g.addColorStop(0.72, SKY_TOP.toHexString());
  g.addColorStop(1, SKY_TOP.toHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new StandardMaterial('sky', scene);
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  return dome;
}

/** Light concrete paving in 1 m slabs, out to 60 m. */
function plaza() {
  const ground = MeshBuilder.CreateGround('ground', { width: 120, height: 120 }, scene);
  const tex = new DynamicTexture('paving', { width: 512, height: 512 }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = '#b9b6b0';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {                     // speckle, so the slabs read as concrete
    const v = 165 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = '#8f8c86';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  tex.update();
  tex.uScale = tex.vScale = 120;
  const mat = new StandardMaterial('paving', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.04, 0.04, 0.04);
  ground.material = mat;
  ground.receiveShadows = true;
  return ground;
}

const sky = skyDome();
const ground = plaza();
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
// A probe renders the sky and the plaza once into a cube map for every metal surface to reflect.
const probe = new ReflectionProbe('env', 128, scene);
probe.position = new Vector3(0, 1.0, 0);
probe.renderList.push(sky, ground);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.9;

// ---------------------------------------------------------------- the truck

let truck = null;
/** Seat eye points in the scene's frame, from the model's json. */
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
  root.computeWorldMatrix(true);
  for (const m of container.meshes) {
    if (m.getTotalVertices() > 0) shadows.addShadowCaster(m, false);
  }
  // The json is in glTF's frame; the loader's root turns that into Babylon's.
  const world = root.getWorldMatrix();
  for (const [k, p] of Object.entries(info.seatEyes)) eyes[k] = Vector3.TransformCoordinates(Vector3.FromArray(p), world);
  covers = container.transformNodes.filter((n) => n.name.startsWith('cover_')).concat(container.meshes.filter((m) => m.name.startsWith('cover_')));
  setUpDoors(container, info);
  shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  return { root, info };
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
  d.target = d.target > 0.5 ? 0 : 1;
  render();
}

function setDoorsAll(open) {
  for (const d of Object.values(doors)) d.target = open ? 1 : 0;
  render();
}

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
  const key = doorTargets.get(info.pickInfo?.pickedMesh) ?? null;
  const xrPointer = info.event?.pointerType === 'xr';
  if (info.type === PointerEventTypes.POINTERMOVE) return hover(key);
  const press = (xrPointer && info.type === PointerEventTypes.POINTERDOWN) || (!xrPointer && info.type === PointerEventTypes.POINTERTAP);
  if (press && key) toggleDoor(key);
});

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

function eyeOf(name) {
  if (name === 'outside') return OUTSIDE;
  const eye = eyes[name];
  return { eye, look: SEATS[name].look(eye) };
}

async function sitIn(name) {
  seat = name;
  const { eye, look } = eyeOf(name);
  if (inXr()) {
    // Seated or standing, the eyes end up at the seat's eye height.
    await rig.moveTo(eye.subtract(new Vector3(0, rig.camera.realWorldHeight || 1.6, 0)), look);
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
  const coversOn = covers[0]?.isEnabled() ?? true;
  const actions = [
    ...(seat !== 'driver' ? [{ label: "Driver's seat", primary: seat === 'outside', onClick: () => sitIn('driver') }] : []),
    ...(seat !== 'rear' ? [{ label: 'Back seat', onClick: () => sitIn('rear') }] : []),
    ...(seat !== 'outside' ? [{ label: 'Step out', primary: true, onClick: () => sitIn('outside') }] : []),
    { label: anyDoorOpen() ? 'Close the doors' : 'Open the doors', onClick: () => setDoorsAll(!anyDoorOpen()) },
    { label: coversOn ? 'Take the wheel covers off' : 'Put the wheel covers on', onClick: toggleCovers },
  ];
  if (rig && !inXr()) actions.push({ label: 'Enter VR', primary: true, onClick: enterVr });
  if (inXr()) actions.push({ label: 'Close', onClick: close });
  const where = seat === 'outside' ? 'Walk around it' : `In the ${SEATS[seat].label.toLowerCase()}`;
  return {
    kicker: 'Full size',
    title: where,
    body: seat === 'outside'
      ? 'A full-size model of the stainless steel pickup, built from the maker’s published dimensions and photographs from every side. It has no door handles: press the small black button on the pillar behind a door to open it.'
      : 'Look around: the long dash shelf, the yoke, the big centre screen, and the glass roof over your head.',
    fact: inXr()
      ? 'Push the thumbstick forward to teleport; A or X brings this card back.'
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
    card.place(rig.headPosition(), rig.headForward(), null);
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
  for (const b of ui.seats) b.classList.toggle('btn-primary', b.dataset.seat === seat);
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

async function start() {
  // Before createXr: the headset rig starts the log too, and only the first start's state() is kept.
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), seat, xr: inXr(), covers: covers[0]?.isEnabled(),
    doorsOpen: Object.entries(doors).filter(([, d]) => d.target > 0.5).map(([k]) => k).join(',') }));
  truck = await loadTruck();
  const { eye, look } = eyeOf('outside');
  const off = eye.subtract(look);
  camera.target.copyFrom(look);
  camera.radius = off.length();
  camera.alpha = Math.atan2(off.z, off.x);
  camera.beta = Math.acos(off.y / off.length());

  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: [ground], start: { position: new Vector3(eye.x, 0, eye.z), lookAt: look } });
    }
  } catch (err) {
    console.warn('[cyb] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.02;
    rig.camera.maxZ = 2000;
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
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
    // A or X: bring the card back in front of you.
    rig.xr.input.onControllerAddedObservable.add((source) => {
      source.onMotionControllerInitObservable.add((mc) => {
        for (const id of ['a-button', 'x-button']) {
          mc.getComponent(id)?.onButtonStateChangedObservable.add((c) => {
            if (c.changes.pressed?.current) {
              cardOpen = true;
              render();
            }
          });
        }
      });
    });
  }

  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [...ui.seats, ui.covers]) b.disabled = false;
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
for (const b of ui.seats) b.addEventListener('click', () => sitIn(b.dataset.seat));
ui.covers.addEventListener('click', toggleCovers);
$('.card-close').addEventListener('click', close);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cardOpen && !inXr()) close();
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[cyb]', err);
  ui.pct.textContent = 'The truck could not load. Reload to try again.';
});

// For automated checks in a browser.
window.__cyb = { scene, camera, sitIn, toggleCovers, toggleDoor, setDoorsAll, get doors() { return doors; }, get eyes() { return eyes; }, get truck() { return truck; } };
