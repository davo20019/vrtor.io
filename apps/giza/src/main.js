// VRtor Great Pyramid (/giza): Khufu's pyramid at its real size, course by course from Petrie's survey, with its
// passages and chambers inside, on the Giza plateau with Khafre and Menkaure beyond (assets-src/giza/spec.md says
// what is measured and what is estimated).
//
// Flat screens: look round it from afar, then take the tour: each stop puts you on your feet there, to look round
// (drag) and walk (arrow keys or WASD, the wheel). Headset: walk with the left stick, teleport with the right; in low
// passages you crouch automatically.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  Ray,
  ReflectionProbe,
  Scene,
  ShadowGenerator,
  Tools,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import { continueInVr, createCard, createMenuControls, createXr, headsetNote, roomsCard, startHeadsetLog, xrSupported } from '@vrtor/xr-shell';
import { ABOUT, SOURCES, tour } from './content.js';
import { buildCasing, buildNorthFace, buildShell, createBlocks } from './exterior.js';
import { buildInterior } from './interior.js';
import { NEIGHBOURS, S, casingHalf } from './survey.js';
import { createApron, createGround, createSky, farPyramid, stone, sunAt } from './world.js';
import { buildXray } from './xray.js';
import './style.css';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'), pct: $('.loading-pct'), retry: $('[data-retry]'), detail: $('.detail'),
  card: $('.card'), kicker: $('.card-kicker'), title: $('.card-title'), body: $('.card-body'), fact: $('.card-fact'),
  source: $('.card-source'), actions: $('.card-actions'), vr: $('[data-enter-vr]'),
  tour: $('[data-tour]'), inside: $('[data-inside]'), built: $('[data-built]'), xray: $('[data-xray]'), light: $('[data-light]'),
  hint: $('.hint'),
};
const V = (x, y, z) => new Vector3(x, y, z);
const EYE = 1.6;
const GROUND = -S.pavement.thick;

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#c9d6dfff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.5;
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.00022;
scene.fogColor = Color3.FromHexString('#d8d6cc');

const sky = createSky(scene);
const sun = new DirectionalLight('sun', V(0, -1, 0), scene);
sun.intensity = 3.4;
const fill = new HemisphericLight('skyfill', V(0, 1, 0), scene);
fill.intensity = 0.55;
fill.groundColor = Color3.FromHexString('#c4a376');
fill.specular = Color3.Black();

// ---------------------------------------------------------------- materials

const T = (n) => ({ albedo: `${n}_albedo.jpg`, normal: `${n}_normal.jpg`, roughMap: `${n}_rough.jpg` });
const lit = {
  core: stone(scene, 'core', { ...T('core'), tile: 1, bump: 1.0 }),
  fine: stone(scene, 'fine', { ...T('fine'), tile: 1, bump: 1.2, tint: '#e8dcc8' }),
  casing: stone(scene, 'casing', { ...T('fine'), tile: 1, bump: 0.5, tint: '#fbf6ec' }),
  granite: stone(scene, 'granite', { ...T('granite'), tile: 1 }),
  sand: stone(scene, 'sand', { ...T('sand'), tile: 1, bump: 0.35 }),
};
// Inside, the lamps' light is baked into the vertex colours; one soft light, for the inside only, brings out the
// stone's relief. No sun and no sky reach in.
function indoor(name, n, tile, tint = '#ffffff') {
  const m = stone(scene, `in-${name}`, { ...T(n), tile, tint });
  m.environmentIntensity = 0;
  m.fogEnabled = false;
  return m;
}
const inside = {
  fine: indoor('fine', 'fine', 1, '#d6c7ac'),
  rock: indoor('rock', 'core', 1, '#d8c8b0'),
  granite: indoor('granite', 'granite', 1, '#c4a49a'),
  wood: indoor('wood', 'wood', 1, '#c09070'),
  dark: indoor('dark', 'fine', 1, '#3a3632'),
};

// ---------------------------------------------------------------- the plateau and the pyramid

const ground = createGround(scene, lit.sand);
ground.position.y = GROUND;
ground.freezeWorldMatrix();
const apron = createApron(scene, lit.sand, S.half, GROUND);
const shell = buildShell(scene);
shell.material = lit.core;
shell.receiveShadows = true;
shell.isPickable = true;
shell.freezeWorldMatrix();
const blocks = createBlocks(scene, lit.core);
const north = buildNorthFace(scene, lit);
const casing = buildCasing(scene);
casing.material = lit.casing;
casing.receiveShadows = true;
casing.freezeWorldMatrix();
casing.setEnabled(false);
const neighbours = NEIGHBOURS.flatMap((n) => farPyramid(scene, { ...n, baseY: n.baseY + GROUND }, lit.core, { casing: lit.fine, granite: lit.granite }));
const neighboursBuilt = NEIGHBOURS.flatMap((n) => farPyramid(scene, { ...n, name: `${n.name}-built`, baseY: n.baseY + GROUND, top: n.height, cased: [[0, n.height, 'casing']] }, lit.core, { casing: lit.casing }));
for (const m of neighboursBuilt) m.setEnabled(false);
const interior = buildInterior(scene, inside);
const lamplight = new HemisphericLight('lamplight', V(0.3, 1, 0.2), scene);
lamplight.diffuse = Color3.FromHexString('#fff0dc');
lamplight.groundColor = Color3.FromHexString('#9c8a74');
lamplight.specular = Color3.FromHexString('#2a2620');
lamplight.intensity = 0.75;
lamplight.includedOnlyMeshes = [...interior.meshes];
sun.excludedMeshes = [...interior.meshes];
fill.excludedMeshes = [...interior.meshes];
const xray = buildXray(scene, interior.spaces);

const shadows = new ShadowGenerator(4096, sun);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.bias = 0.0008;
shadows.normalBias = 0.03;
for (const m of [shell, casing, ...north.meshes, ...neighbours, ...neighboursBuilt]) shadows.addShadowCaster(m, false);
for (const m of [ground, apron, ...north.meshes, ...neighbours]) m.receiveShadows = true;
const shadowMap = shadows.getShadowMap();
shadowMap.refreshRate = 0;

const probe = new ReflectionProbe('sky-probe', 64, scene);
probe.renderList.push(sky.mesh);
probe.refreshRate = 0;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.4;

const TIMES = [
  { hour: 8.2, name: 'Morning' },
  { hour: 12.3, name: 'Noon' },
  { hour: 15.8, name: 'Afternoon' },
  { hour: 17.55, name: 'Sunset' },
];
let time = 0;
function setTime(i) {
  time = i;
  const { dir, alt } = sunAt(TIMES[i].hour);
  sun.direction = dir;
  sun.position = dir.scale(-450);
  const low = Math.max(0, Math.min(1, 1 - alt / 0.5));
  sun.diffuse = Color3.Lerp(Color3.FromHexString('#fff4e2'), Color3.FromHexString('#ffb070'), low * low);
  sun.intensity = 4.2 * (0.55 + 0.45 * Math.min(1, alt / 0.35));
  fill.intensity = 0.55 * (0.6 + 0.4 * Math.min(1, alt / 0.5));
  sky.set(dir, {
    zenith: Color3.Lerp(Color3.FromHexString('#3a6db0'), Color3.FromHexString('#4a6a9a'), low),
    horizon: Color3.Lerp(Color3.FromHexString('#cfdae0'), Color3.FromHexString('#f0c08a'), low),
    ground: Color3.FromHexString('#b8a284'),
    warmth: low,
  });
  scene.fogColor = Color3.Lerp(Color3.FromHexString('#d8d6cc'), Color3.FromHexString('#e6c398'), low);
  shadowMap.resetRefreshCounter();
  probe.refreshRate = 0;
  probe.cubeTexture.resetRefreshCounter?.();
  ui.light.textContent = TIMES[(i + 1) % TIMES.length].name;
}
setTime(0);

// ---------------------------------------------------------------- cameras

const orbit = new ArcRotateCamera('orbit', -Math.PI / 2 + 0.55, 1.33, 330, V(0, 45, 0), scene);
orbit.minZ = 0.3;
orbit.maxZ = 9000;
orbit.wheelDeltaPercentage = 0.01;
orbit.pinchDeltaPercentage = 0.004;
orbit.lowerRadiusLimit = 20;
orbit.upperRadiusLimit = 1600;
orbit.upperBetaLimit = 1.52;
orbit.panningSensibility = 0;

// On your feet: drag to look; WASD or the arrow keys, or the wheel, to walk on the floors.
const walker = new UniversalCamera('walker', V(0, 1.6, 150), scene);
walker.minZ = 0.03;
walker.maxZ = 9000;
walker.fov = 1.0;
walker.inertia = 0.6;
walker.angularSensibility = 1400;
walker.inputs.removeByType('FreeCameraKeyboardMoveInput');
walker.inputs.removeByType('FreeCameraMouseWheelInput');
let active = orbit;
scene.activeCamera = orbit;
orbit.attachControl(canvas, true);

const floors = [shell, ground, apron, interior.floor, north.floor];
const ray = new Ray(Vector3.Zero(), V(0, -1, 0), 6);
function groundAt(x, z, fromY) {
  ray.origin.set(x, fromY, z);
  ray.length = 6;
  const hit = scene.pickWithRay(ray, (m) => floors.includes(m) && m.isEnabled());
  return hit?.hit ? hit.pickedPoint.y : null;
}

/** How high the ceiling is above the floor here, if you are in one of the low passages. */
function lowCeiling(p) {
  for (const l of interior.low) {
    const dx = l.b[0] - l.a[0], dz = l.b[2] - l.a[2];
    const L2 = dx * dx + dz * dz;
    const t = ((p.x - l.a[0]) * dx + (p.z - l.a[2]) * dz) / L2;
    if (t < -0.02 || t > 1.02) continue;
    const cx = l.a[0] + dx * t, cz = l.a[2] + dz * t;
    if (Math.hypot(p.x - cx, p.z - cz) > l.w / 2 + 0.15) continue;
    const fy = l.a[1] + (l.b[1] - l.a[1]) * Math.max(0, Math.min(1, t));
    if (Math.abs(p.y - EYE - fy) > 1.5 && Math.abs(p.y - fy) > 1.5) continue;
    return { floor: fy, h: l.h };
  }
  return null;
}

const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.closest?.('button')) return;
  keys.add(e.key.toLowerCase());
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let wheelPush = 0;
canvas.addEventListener('wheel', (e) => {
  if (active !== walker) return;
  wheelPush += -Math.sign(e.deltaY) * 0.6;
  e.preventDefault();
}, { passive: false });

function walk(dt) {
  if (active !== walker) return;
  const f = walker.getDirection(Vector3.Forward());
  f.y = 0;
  f.normalize();
  const r = new Vector3(f.z, 0, -f.x);
  let mv = Vector3.Zero();
  const k = (a, b) => keys.has(a) || keys.has(b);
  if (k('w', 'arrowup')) mv.addInPlace(f);
  if (k('s', 'arrowdown')) mv.subtractInPlace(f);
  if (k('d', 'arrowright')) mv.addInPlace(r);
  if (k('a', 'arrowleft')) mv.subtractInPlace(r);
  const speed = keys.has('shift') ? 5 : 1.6;
  if (mv.lengthSquared() > 0) mv = mv.normalize().scale(speed * dt);
  if (wheelPush) {
    const step = Math.sign(wheelPush) * Math.min(Math.abs(wheelPush), 4 * dt);
    mv.addInPlace(f.scale(step));
    wheelPush -= step;
  }
  const p = walker.position;
  const feetNow = groundAt(p.x, p.z, p.y + 0.4);
  if (mv.lengthSquared() > 0) {
    const there = groundAt(p.x + mv.x, p.z + mv.z, p.y + 0.4);
    if (there !== null && (feetNow === null || Math.abs(there - feetNow) < 0.5)) {
      p.x += mv.x;
      p.z += mv.z;
    } else wheelPush = 0;
  }
  const feet = groundAt(p.x, p.z, p.y + 0.4);
  if (feet === null) return;
  // Crouch in the low passages.
  const low = lowCeiling(new Vector3(p.x, feet + EYE, p.z));
  const eye = low ? Math.min(EYE, low.h - 0.14) : EYE;
  p.y += (feet + eye - p.y) * Math.min(1, dt * 10);
}

// ---------------------------------------------------------------- inside or out

let isInside = false;
let built = false;
let seeThrough = false;
/** Whether the eye is within the pyramid's body (or under the ground), so the outside need not be drawn. */
function within(p) {
  if (p.y < GROUND - 1.5) return true;
  if (p.y > S.apex) return false;
  const h = casingHalf(Math.max(0, p.y)) - 5;
  return Math.abs(p.x) < h && Math.abs(p.z) < h;
}
function setOutsideVisible(show) {
  for (const m of [ground, apron, sky.mesh]) m.setEnabled(show);
  shell.setEnabled(show && !built);
  for (const m of north.meshes) m.setEnabled(show && !built);
  casing.setEnabled(show && built);
  for (const m of neighbours) m.setEnabled(show && !built);
  for (const m of neighboursBuilt) m.setEnabled(show && built);
  blocks.setEnabled(show && !built);
  scene.fogEnabled = show;
  scene.clearColor = show ? Color4.FromHexString('#c9d6dfff') : Color4.FromHexString('#000000ff');
}
function updateInside() {
  const eye = inXr() ? rig.headPosition() : active.position;
  const now = within(eye) && !seeThrough;
  if (now === isInside) return;
  isInside = now;
  setOutsideVisible(!now);
}

// ---------------------------------------------------------------- the tour, the card

const STOPS = tour();
let rig = null;
let cardOpen = true;
let picked = 'intro';
let stop = -1;
let rooms = false;
const card = createCard(scene, { name: 'giza-card', width: 0.9, height: 0.74 });
const inXr = () => !!rig?.inXr();
const act = (label, onClick, primary = false) => ({ label, onClick, primary });

function travel(i) {
  stop = i;
  const s = STOPS[i];
  picked = `tour:${s.id}`;
  cardOpen = true;
  rooms = false;
  if (seeThrough) setSeeThrough(false);
  if (built && s.inside) setBuilt(false);
  const stand = V(...s.stand), at = V(...s.at);
  if (inXr()) {
    rig.moveTo(stand, at);
  } else {
    if (active !== walker) {
      orbit.detachControl();
      walker.attachControl(canvas, true);
      active = walker;
      scene.activeCamera = walker;
    }
    walker.position.copyFrom(stand.add(V(0, EYE, 0)));
    const low = lowCeiling(walker.position);
    if (low) walker.position.y = stand.y + Math.min(EYE, low.h - 0.14);
    walker.setTarget(at);
  }
  updateInside();
  render();
}

function overview() {
  stop = -1;
  picked = 'intro';
  if (active !== orbit) {
    walker.detachControl();
    orbit.attachControl(canvas, true);
    active = orbit;
    scene.activeCamera = orbit;
  }
  updateInside();
  render();
}

function setBuilt(on) {
  built = on;
  picked = on ? 'built' : 'today';
  cardOpen = true;
  setOutsideVisible(!isInside);
  ui.built.setAttribute('aria-pressed', String(on));
  ui.built.textContent = on ? 'As it is today' : 'As built';
  shadowMap.resetRefreshCounter();
  render();
}

function setSeeThrough(on) {
  seeThrough = on;
  for (const m of xray) m.setEnabled(on);
  // The pyramid becomes a ghost.
  for (const m of [lit.core, lit.fine, lit.casing, lit.sand]) {
    m.alpha = on ? 0.16 : 1;
    m.transparencyMode = on ? 2 : null;
  }
  ui.xray.setAttribute('aria-pressed', String(on));
  if (on) {
    picked = 'xray';
    isInside = false;
    setOutsideVisible(true);
    if (active === walker && within(walker.position)) overview();
  } else updateInside();
  cardOpen = true;
  render();
}

function content() {
  if (rooms) return roomsCard('giza', rig, act, () => { rooms = false; render(); });
  const actions = [];
  if (picked.startsWith('tour:')) {
    const s = STOPS[stop];
    if (stop > 0) actions.push(act('Back', () => travel(stop - 1)));
    else actions.push(act('Overview', overview));
    if (stop < STOPS.length - 1) actions.push(act(`Next: ${STOPS[stop + 1].title}`, () => travel(stop + 1), true));
    else actions.push(act('Overview', overview, true));
    return { kicker: `${stop + 1} of ${STOPS.length} · ${s.kicker}`, title: s.title, body: s.text, fact: s.fact, source: '', actions };
  }
  const a = ABOUT[picked] ?? ABOUT.intro;
  if (picked === 'intro') actions.push(act('Take the tour', () => travel(0), true));
  else actions.push(act('Close', close));
  return { kicker: a.kicker, title: a.title, body: a.text, fact: a.fact, source: picked === 'intro' ? SOURCES : '', actions };
}

function tools() {
  if (rooms) return [];
  return [
    act(stop >= 0 ? 'Next stop' : 'Tour', () => travel(stop >= 0 ? (stop + 1) % STOPS.length : 0)),
    act(built ? 'As today' : 'As built', () => setBuilt(!built)),
    act(TIMES[(time + 1) % TIMES.length].name, () => { setTime((time + 1) % TIMES.length); picked = 'light'; render(); }),
    act('Change room', () => { rooms = true; cardOpen = true; render(); }),
  ];
}

function close() {
  cardOpen = false;
  rooms = false;
  render();
}

function render() {
  const data = content();
  ui.inside.textContent = isInside ? 'Go outside' : 'Go inside';
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: tools() });
    card.place(rig.headPosition(), rig.headForward(), null);
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
  ui.hint.textContent = active === walker ? 'Drag to look · WASD, arrows or the wheel to walk · Shift to hurry' : 'Drag to look round · scroll to get closer';
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact;
  ui.fact.hidden = !data.fact;
  ui.source.textContent = data.source;
  ui.source.hidden = !data.source;
  ui.actions.replaceChildren(...data.actions.map((x) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = x.primary ? 'btn btn-primary' : 'btn';
    b.textContent = x.label;
    b.addEventListener('click', x.onClick);
    return b;
  }));
}

// ---------------------------------------------------------------- headset: crouch in low passages

let crouch = 0;
function xrCrouch() {
  const cam = rig.camera;
  const head = cam.position;
  const low = lowCeiling(head);
  // How far down the world must move so your head clears the roof.
  const natural = head.y - crouch;
  const want = low ? Math.min(0, low.floor + low.h - 0.12 - natural) : 0;
  const d = want - crouch;
  if (Math.abs(d) < 0.005) return;
  cam.position.y += d;
  crouch = want;
}

// ---------------------------------------------------------------- start

async function start() {
  const t0 = performance.now();
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), inside: isInside, chunks: blocks.count, stop, built, seeThrough }));
  await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 8000))]);
  headsetNote('loaded', { ms: Math.round(performance.now() - t0) });
  try {
    if (await xrSupported()) {
      const s0 = STOPS[0];
      rig = await createXr(scene, { floorMeshes: floors, start: { position: V(...s0.stand), lookAt: V(...s0.at) } });
    }
  } catch (err) {
    console.warn('[giza] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.03;
    rig.camera.maxZ = 9000;
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
    let framesSinceEnter = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      framesSinceEnter = entered ? 0 : -1;
      crouch = 0;
      if (!entered) render();
    });
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      xrCrouch();
      if (framesSinceEnter < 0 || ++framesSinceEnter < 6) return;
      framesSinceEnter = -1;
      cardOpen = true;
      render();
    });
    createMenuControls(scene, rig, card, { open: () => { cardOpen = true; render(); }, close });
  }
  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [ui.tour, ui.inside, ui.built, ui.xray, ui.light]) b.disabled = false;
  render();
}

ui.vr.addEventListener('click', async () => {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try { await rig.enter(); } catch (err) { console.error('[giza] could not enter VR', err); } finally { ui.vr.disabled = false; }
});
$('.card-close').addEventListener('click', close);
ui.tour.addEventListener('click', () => travel(stop >= 0 ? (stop + 1) % STOPS.length : 0));
ui.inside.addEventListener('click', () => (isInside ? travel(0) : travel(STOPS.findIndex((s) => s.id === 'tunnel'))));
ui.built.addEventListener('click', () => setBuilt(!built));
ui.xray.addEventListener('click', () => setSeeThrough(!seeThrough));
ui.light.addEventListener('click', () => { setTime((time + 1) % TIMES.length); picked = 'light'; cardOpen = true; render(); });
ui.retry.addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => {
  if (inXr()) return;
  if (e.key === 'Escape') close();
});

let frames = 0;
let last = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  walk(dt);
  const eye = inXr() ? rig.headPosition() : active.position;
  if (++frames % 5 === 0) {
    if (!isInside && !built) blocks.update(eye);
    updateInside();
  }
  scene.render();
});
addEventListener('resize', () => engine.resize());

// Dev only: ?shot frames the homepage card's view with no interface, for a headless screenshot.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('shot')) {
  document.body.style.visibility = 'hidden';
  canvas.style.visibility = 'visible';
  setTime(0);
  orbit.target.set(0, 42, 0);
  orbit.alpha = 0.62;
  orbit.beta = 1.44;
  orbit.radius = 330;
  cardOpen = false;
}
if (import.meta.env.DEV) window.__giza = { shot: (width, height) => Tools.CreateScreenshotUsingRenderTargetAsync(engine, scene.activeCamera, { width, height }, 'image/png', 4), scene, orbit, walker, blocks, travel, setTime, setBuilt, setSeeThrough, interior, STOPS, V };

start().catch((err) => {
  console.error('[giza] failed to start', err);
  ui.pct.textContent = 'The pyramid could not load.';
  ui.retry.hidden = false;
});
