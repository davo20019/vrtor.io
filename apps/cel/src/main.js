// VRtor Cell (/cel): an animal cell and a plant cell, 150,000 times life size and to scale, with every part
// students learn about (and the ones they go on to): cut away so you can walk in, each part labelled, explained,
// and able to come out in your hands, down to the DNA, a ribosome and the membrane up close.
//
// Flat screens: orbit; tap a part to name it (the card climbs to what it's part of); drag the chosen part to pull it
// out. Headset: walk in; put your hand on a part and squeeze the grip to take it; pull the trigger while holding to
// take the whole of what it belongs to; let go near its place and it goes back in. Point and pull the trigger to
// read about anything, near or far. A or X opens the card.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Constants,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  Matrix,
  Plane,
  PointerEventTypes,
  Quaternion,
  Ray,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  Vector3,
} from '@babylonjs/core';
import { continueInVr, createCard, createMenuControls, createPresence, createXr, mountPresenceControls, orbitPose, presenceCard, roomsCard, xrPose, xrSupported } from '@vrtor/xr-shell';
import { VIEW, buildCells } from './cells.js';
import { DRAWN_NOTE, PARTS, SCALE_NOTE, about } from './content.js';
import { createLabels } from './labels.js';
import { createParts } from './parts.js';
import { createRoom } from './room.js';
import { QUIZ, TOURS } from './tours.js';
import { buildZoom } from './zoom.js';
import './style.css';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'),
  pct: $('.loading-pct'),
  retry: $('[data-retry]'),
  card: $('.card'),
  kicker: $('.card-kicker'),
  title: $('.card-title'),
  names: $('.card-names'),
  trail: $('.card-trail'),
  body: $('.card-body'),
  fact: $('.card-fact'),
  actions: $('.card-actions'),
  vr: $('[data-enter-vr]'),
  views: [...document.querySelectorAll('[data-view]')],
  cut: $('[data-cut]'),
  labels: $('[data-labels]'),
  learn: $('[data-learn]'),
  back: $('[data-back]'),
  hint: $('.hint'),
  search: $('.search input'),
  results: $('.search-results'),
};

const HOVER = Color3.FromHexString('#ffe7a3');
const PICKED = Color3.FromHexString('#ffb020');
const RIGHT = Color3.FromHexString('#4cd07d');
const WRONG = Color3.FromHexString('#ff5a4f');

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#0b1219ff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.2;
ip.contrast = 1.08;
scene.skipPointerMovePicking = true;

/** Where each cell floats (its centre), turned so its cut-away opening faces +z, the way you come in. */
// Babylon is left-handed: seen from +z, +x is on the left. The animal cell goes on the left, the plant on the right.
const AT = { animal: new Vector3(3.4, 1.72, 0), plant: new Vector3(-3.6, 2.06, -0.4) };
const TURN = Quaternion.RotationAxis(Vector3.Up(), -Math.PI / 4);
const room = createRoom(scene, [{ x: AT.animal.x, z: AT.animal.z, r: 1.75 }, { x: AT.plant.x, z: AT.plant.z, r: 3.7 }]);

const camera = new ArcRotateCamera('orbit', Math.PI / 2 - 0.2, 1.32, 14.5, new Vector3(-0.2, 1.9, 0), scene);
camera.minZ = 0.01;
camera.maxZ = 140;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 900;
camera.lowerBetaLimit = 0.15;
camera.upperBetaLimit = 1.62;
camera.lowerRadiusLimit = 0.08;
camera.upperRadiusLimit = 32;
camera.inputs.attached.pointers.multiTouchPanning = true;
camera.attachControl(canvas, true);
// Panning keeps what you orbit within 10 m of the middle: with the 32 m zoom limit the camera stays inside the room.
scene.onBeforeRenderObservable.add(() => {
  const t = camera.target;
  const d = Math.hypot(t.x, t.z);
  if (d > 10) { t.x *= 10 / d; t.z *= 10 / d; }
  t.y = Math.min(6, Math.max(0, t.y));
});

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.3), scene);
hemi.diffuse = Color3.FromHexString('#eef3f6');
hemi.groundColor = Color3.FromHexString('#2a3238');
hemi.specular = Color3.Black();
hemi.intensity = 0.85;
const TO_KEY = new Vector3(-0.35, 0.8, 0.6).normalize();
const key = new DirectionalLight('key', TO_KEY.scale(-1), scene);
key.intensity = 1.9;
key.diffuse = Color3.FromHexString('#fff6ee');
const rim = new DirectionalLight('rim', new Vector3(0.3, -0.3, 1).normalize(), scene);
rim.intensity = 0.6;
rim.diffuse = Color3.FromHexString('#cfe3ff');

const probe = new ReflectionProbe('env', 128, scene);
probe.position = new Vector3(0, 1.8, 2);
probe.renderList.push(...room.envMeshes);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.8;

// ---------------------------------------------------------------- the cells

const parts = createParts(scene);
let cells = null;
let zoom = null;
let labels = null;
let rig = null;
let presence = null;
const card = createCard(scene, { name: 'cell-card', width: 0.9, height: 0.74 });
let cardOpen = true;
let picked = null;
/** 'part' | 'more' | 'learn' | 'tour' | 'quiz' | 'compare' | 'rooms' | 'people' */
let page = 'part';
let note = '';
let view = 'both';

const inXr = () => !!rig?.inXr();
const node = (id) => parts.nodes[id];
const cellOf = (id) => {
  const c = node(id).cell;
  return c === 'zoom' ? null : c;
};
const CELL_NAME = { animal: 'Animal cell', plant: 'Plant cell' };
const info = (id) => about(node(id).key, cellOf(id)) ?? { name: node(id).name, text: '' };

function build() {
  cells = buildCells(scene, parts);
  for (const [k, c] of Object.entries({ animal: cells.animal, plant: cells.plant })) {
    c.root.position.copyFrom(AT[k]);
    c.root.rotationQuaternion = TURN.clone();
  }
  zoom = buildZoom(scene, parts);
  parts.apply();
  for (const m of scene.meshes) m.computeWorldMatrix(true);

  const L = (cell, key, extra = {}) => ({ id: parts.idOf(cell, key), text: PARTS[key].name, cell: { root: cells[cell].root, opening: cells.OPENING }, ...extra });
  labels = createLabels(scene, parts, [
    L('animal', 'membrane', { up: 0.25 }),
    L('animal', 'cytoplasm', { up: -0.1 }),
    L('animal', 'nucleus', { text: 'Nucleus', up: 0.35 }),
    L('animal', 'nucleolus', { up: 0.05 }),
    L('animal', 'chromatin', { text: 'Chromatin (DNA)', up: -0.18 }),
    L('animal', 'rough-er', { text: 'Rough ER', up: -0.3 }),
    L('animal', 'smooth-er', { text: 'Smooth ER', up: -0.15 }),
    L('animal', 'golgi', { up: 0.3 }),
    L('animal', 'centrosome', { up: 0.45 }),
    L('animal', 'mitochondria', { text: 'Mitochondrion' }),
    L('animal', 'lysosomes', { text: 'Lysosome' }),
    L('animal', 'peroxisomes', { text: 'Peroxisome' }),
    L('animal', 'vesicles', { text: 'Vesicle' }),
    L('animal', 'ribosomes', { up: 0.06 }),
    L('animal', 'microtubules', { text: 'Microtubules (cytoskeleton)' }),
    L('plant', 'cell-wall', { up: 0.25 }),
    L('plant', 'membrane', { up: -0.15 }),
    L('plant', 'plasmodesmata'),
    L('plant', 'cytoplasm', { up: -0.15 }),
    L('plant', 'vacuole', { text: 'Central vacuole', up: 0.4 }),
    L('plant', 'nucleus', { up: 0.4 }),
    L('plant', 'rough-er', { text: 'Rough ER', up: -0.25 }),
    L('plant', 'chloroplasts', { text: 'Chloroplast', up: 0.2 }),
    L('plant', 'mitochondria', { text: 'Mitochondrion' }),
    L('plant', 'golgi'),
    L('plant', 'peroxisomes', { text: 'Peroxisome' }),
    L('plant', 'smooth-er', { text: 'Smooth ER' }),
    L('plant', 'ribosomes'),
    L('plant', 'microtubules', { text: 'Microtubules' }),
  ].filter((l) => l.id !== null));
}

// ---------------------------------------------------------------- views

const VIEWS = {
  both: { target: new Vector3(-0.2, 1.9, 0), radius: 14.5, alpha: Math.PI / 2 - 0.2, beta: 1.32 },
  animal: { target: AT.animal.clone(), radius: 4.6, alpha: Math.PI / 2 - 0.3, beta: 1.25 },
  plant: { target: AT.plant.clone(), radius: 8.2, alpha: Math.PI / 2 - 0.25, beta: 1.22 },
};
/** Where the headset viewer stands for each: in the opening, or between the two. */
const XR_SPOTS = {
  both: { position: new Vector3(-0.1, 0, 6.5), lookAt: new Vector3(-0.1, 1.7, 0) },
  animal: { position: AT.animal.add(new Vector3(0, 0, 1.25)).multiplyByFloats(1, 0, 1), lookAt: AT.animal.clone() },
  plant: { position: AT.plant.add(new Vector3(-0.3, 0, 1.9)).multiplyByFloats(1, 0, 1), lookAt: AT.plant.add(new Vector3(-0.6, -0.3, -0.6)) },
};

/** How much further back a view stands on a screen narrower than it is tall. */
const fitWidth = () => Math.min(2.2, Math.max(1, 1.25 / (engine.getRenderWidth() / engine.getRenderHeight())));

let flight = null;
function look(target, radius, alpha = null, beta = null) {
  flight = { target: target.clone(), radius, alpha, beta };
}
canvas.addEventListener('pointerdown', () => (flight = null));
canvas.addEventListener('wheel', () => (flight = null), { passive: true });
scene.onBeforeRenderObservable.add(() => {
  if (!flight || inXr()) return;
  const k = Math.min(1, engine.getDeltaTime() / 260);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  camera.radius += (flight.radius - camera.radius) * k;
  if (flight.alpha !== null) camera.alpha += (flight.alpha - camera.alpha) * k;
  if (flight.beta !== null) camera.beta += (flight.beta - camera.beta) * k;
  const done = Vector3.Distance(camera.target, flight.target) < 0.002 && Math.abs(camera.radius - flight.radius) < 0.003 && (flight.alpha === null || Math.abs(camera.alpha - flight.alpha) < 0.002);
  if (done) flight = null;
});

function goTo(v) {
  view = v;
  if (inXr()) {
    const s = XR_SPOTS[v];
    rig.moveTo(s.position, s.lookAt).then(() => render());
  } else {
    const s = VIEWS[v];
    // Turn the shorter way round. A tall, narrow screen stands further back to fit the cells in.
    const alpha = camera.alpha + ((((s.alpha - camera.alpha) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    look(s.target, s.radius * fitWidth(), alpha, s.beta);
  }
  refreshBar();
}

function setCut(on) {
  VIEW.cut = on;
  parts.apply();
  refreshBar();
  render();
}
function setLabels(on) {
  labels.setVisible(on);
  refreshBar();
  render();
}

function refreshBar() {
  for (const b of ui.views) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  ui.cut.textContent = VIEW.cut ? 'Close the cells' : 'Cut them open';
  ui.labels.setAttribute('aria-pressed', String(!!labels?.visible));
  ui.back.disabled = !parts.movedCount() && !parts.hiddenCount() && parts.isolated() === null && !zoom?.show.size;
}

// ---------------------------------------------------------------- choosing, opening, taking out

const phone = () => matchMedia('(max-width: 640px)').matches;

function pick(id) {
  if (page === 'quiz' && quiz?.q?.type === 'find' && !quiz.answered) return answerFind(id);
  picked = id;
  page = 'part';
  note = '';
  cardOpen = true;
  // A close-up keeps its own colours (the bases' code would be lost under the tint).
  parts.highlight('picked', node(id).cell === 'zoom' ? null : id, PICKED);
  if (phone() && !inXr()) look(parts.centreOf(id), camera.radius);
  render();
}
function unpick() {
  picked = null;
  parts.highlight('picked', null);
  render();
}
const isUnder = (id, group) => {
  for (let i = id; i !== null; i = parts.parentOf(i)) if (i === group) return true;
  return false;
};
/** The nearest part above id (or id itself) that can be opened. */
function openableOf(id) {
  for (let i = id; i !== null; i = parts.parentOf(i)) if (node(i).openable) return i;
  return null;
}
function setOpen(id, open) {
  node(id).opened = open;
  parts.apply();
  render();
}

function takeOut(id) {
  let to;
  if (inXr()) {
    const head = rig.headPosition();
    const f = rig.headForward();
    to = head.add(f.scale(0.55));
    to.y = head.y - 0.15;
  } else {
    // Out in front of its cell's opening, side by side with whatever else is out.
    const k = parts.movedCount();
    to = zoomSpot(id).add(new Vector3(((k % 4) - 1.5) * 0.55, 0.25 - 0.1 * (k % 2), -0.3));
  }
  // Small parts come out bigger, so you can see them: up to about 30 cm.
  const size = parts.sizeOf(id);
  const grow = size < 0.2 ? Math.min(4, 0.3 / Math.max(size, 0.01)) : null;
  // Something that opens turns its open side to you; it opens as it comes out.
  const opens = node(id).openable && !(cellOf(id) === 'animal' && node(id).key === 'nucleus');
  let rot = null;
  if (opens) {
    const eye = inXr() ? rig.headPosition() : camera.position;
    const t = node(id).t;
    t.computeWorldMatrix(true);
    const q0 = t.absoluteRotationQuaternion.clone();
    const up = Vector3.Up().applyRotationQuaternion(q0);
    rot = turnFrom(up, eye.subtract(to).normalize()).multiply(q0);
    node(id).opened = true;
  }
  parts.sendTo(id, to, () => {
    refreshBar();
    render();
  }, grow, rot);
  parts.apply();
  if (!inXr()) look(to, Math.max(0.5, Math.min(3, (grow ?? 1) * size * 2.6)));
  note = grow ? `Out, shown ${grow.toFixed(1)} times bigger. Drag it about, or put it back from here.` : 'Out. Drag it about, or put it back from here.';
  render();
}
/** The shortest rotation taking direction a to direction b. */
function turnFrom(a, b) {
  const d = Vector3.Dot(a, b);
  if (d > 0.9999) return Quaternion.Identity();
  const axis = d < -0.9999 ? Vector3.Right() : Vector3.Cross(a, b).normalize();
  return Quaternion.RotationAxis(axis, Math.acos(Math.max(-1, Math.min(1, d))));
}

function putBack(id) {
  parts.putBack(id, () => {
    refreshBar();
    render();
  });
  note = '';
  render();
}
function putAllBack() {
  parts.putAllBack();
  parts.showAll();
  parts.isolate(null);
  for (const n of parts.nodes) n.opened = false;
  zoom.show.clear();
  parts.apply();
  note = '';
  setTimeout(refreshBar, 700);
  render();
}
function showOnly(id) {
  parts.isolate(id);
  if (id !== null && !inXr()) look(parts.centreOf(id), Math.max(0.35, Math.min(6, parts.sizeOf(id) * 1.8)));
  refreshBar();
  render();
}
function hidePart(id) {
  parts.hide(id);
  unpick();
  refreshBar();
}

/** A close-up (DNA, a ribosome, the membrane): out in front of you. */
function showZoom(key) {
  const id = zoom.ids[key];
  const t = node(id).t;
  let at;
  if (inXr()) {
    const head = rig.headPosition();
    at = head.add(rig.headForward().scale(0.6));
    at.y = head.y - 0.12;
  } else {
    at = zoomSpot();
    look(at, 1.0);
  }
  t.position.copyFrom(at);
  t.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(camera.position.x - at.x, camera.position.z - at.z));
  zoom.show.add(key);
  parts.apply();
  refreshBar();
  pick(id);
}
function hideZoom(key) {
  zoom.show.delete(key);
  parts.apply();
  unpick();
  refreshBar();
}

/** Where a close-up shows on a flat screen: out in front of the cell you're looking at (or of `near`'s cell). */
function zoomSpot(near = null) {
  const cell = near !== null ? cellOf(near) : view === 'both' ? null : view;
  if (cell === 'animal') return AT.animal.add(new Vector3(-0.2, 0, 2.1));
  if (cell === 'plant') return AT.plant.add(new Vector3(0.3, -0.2, 2.9));
  return new Vector3(-0.1, 1.7, 2.6);
}

/** What stays put: the cell's skins and fills, and the networks that run through the whole cell. "Show only this" shows them alone instead. */
const FIXED = new Set(['membrane', 'cytoplasm', 'cell-wall', 'vacuole', 'cell-sap', 'nucleoplasm', 'plasmodesmata', 'cytoskeleton', 'microtubules', 'actin', 'intermediate', 'ribosomes']);
const movable = (id) => parts.parentOf(id) !== null && !FIXED.has(node(id).key);

/** Which close-up a part's card offers. */
const ZOOM_OF = { chromatin: 'zoom-dna', nucleus: 'zoom-dna', nucleoplasm: 'zoom-dna', ribosomes: 'zoom-ribosome', 'er-ribosomes': 'zoom-ribosome', 'rough-er': 'zoom-ribosome', membrane: 'zoom-membrane' };
const ZOOM_LABEL = { 'zoom-dna': 'See the DNA up close', 'zoom-ribosome': 'See a ribosome up close', 'zoom-membrane': 'See the membrane up close' };

// ---------------------------------------------------------------- reading aloud

const canSpeak = () => 'speechSynthesis' in window;
function speak(text, lang = 'en-US') {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- tours and the quiz

let tour = null;
let quiz = null;
const QUESTIONS = 10;
const stopId = (s) => parts.idOf(s.cell, s.key);

function openLearn() {
  page = 'learn';
  cardOpen = true;
  render();
}
function learnPage() {
  return {
    kicker: 'Learn',
    title: 'Tours and quiz',
    body: TOURS.map((t) => `${t.title}: ${t.blurb}`).join('\n'),
    fact: 'A tour shows and explains a few parts, one stop at a time. The quiz asks you to find parts, name them and say which cells have them.',
    actions: [
      ...TOURS.map((t) => act(t.title, () => startTour(t))),
      act('Animal or plant?', openCompare),
      act(`Quiz: ${QUESTIONS} questions`, startQuiz, true),
      act('Back', () => { page = 'part'; render(); }),
    ],
  };
}

function startTour(t) {
  tour = { t, stops: t.stops.filter((s) => stopId(s) !== null), i: 0 };
  page = 'tour';
  showStop();
}
function showStop() {
  const s = tour.stops[tour.i];
  parts.putAllBack();
  parts.isolate(null);
  for (const n of parts.nodes) n.opened = false;
  zoom.show.clear();
  if (!VIEW.cut) VIEW.cut = true;
  const id = stopId(s);
  const o = openableOf(id);
  if (s.open && o !== null) node(o).opened = true;
  parts.apply();
  picked = id;
  parts.highlight('picked', id, PICKED);
  const isCell = node(id).parent === null;
  if (s.zoom) {
    showZoomQuiet(s.zoom, id);
  } else if (inXr()) {
    if (isCell && view !== s.cell) goTo(s.cell);
  } else if (isCell) {
    view = s.cell;
    const v = VIEWS[s.cell];
    look(v.target, v.radius, null, v.beta);
  } else {
    look(parts.centreOf(id), Math.max(0.6, Math.min(7, parts.sizeOf(id) * 2.2)));
  }
  cardOpen = true;
  refreshBar();
  render();
}
/** A tour stop's close-up: beside the part, without changing what's chosen. */
function showZoomQuiet(key, near) {
  const t = node(zoom.ids[key]).t;
  const c = parts.centreOf(near);
  let at;
  if (inXr()) {
    const head = rig.headPosition();
    at = head.add(rig.headForward().scale(0.6));
    at.y = head.y - 0.12;
  } else {
    at = zoomSpot(near);
    look(at, 1.3);
  }
  t.position.copyFrom(at);
  t.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.atan2(camera.position.x - at.x, camera.position.z - at.z));
  zoom.show.add(key);
  parts.apply();
}
function tourPage() {
  const { t, stops, i } = tour;
  const s = stops[i];
  const last = i === stops.length - 1;
  const id = stopId(s);
  const inf = info(id);
  return {
    kicker: `Tour · ${t.title} · ${i + 1} of ${stops.length}`,
    title: s.title,
    names: inf.es ? `${inf.name} · Spanish: ${inf.es}` : inf.name,
    body: s.text,
    fact: inXr() ? 'Squeeze the grip on a part to take it in your hand.' : 'Drag the lit part to pull it out; drag elsewhere to turn the view.',
    actions: [
      ...(i > 0 ? [act('Back', () => { tour.i--; showStop(); })] : []),
      ...(canSpeak() ? [act('Read it to me', () => speak(`${s.title}. ${s.text}`))] : []),
      act(last ? 'Finish' : 'Next', () => (last ? endTour() : (tour.i++, showStop())), true),
      act('End tour', endTour),
    ],
  };
}
function endTour() {
  tour = null;
  putAllBack();
  unpick();
  page = 'learn';
  render();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const qName = (q) => (q.name ?? PARTS[q.key].name).toLowerCase().replace('golgi', 'Golgi');
/** Plural and mass nouns take no "a": "Which cells have ribosomes?" */
const MASS = /^(ribosomes|vesicles|microtubules|plasmodesmata|cytoplasm)$/;

function startQuiz() {
  const pool = QUIZ.slice();
  const types = ['find', 'find', 'name', 'which', 'find'];
  const qs = shuffle(pool.slice()).slice(0, QUESTIONS).map((q, k) => {
    const type = types[k % types.length];
    const cells = q.where === 'both' ? shuffle(['animal', 'plant']) : [q.where];
    const ids = ['animal', 'plant'].map((c) => parts.idOf(c, q.key)).filter((i) => i !== null);
    const out = { ...q, type, cell: cells[0], ids };
    if (type === 'name') {
      const others = shuffle(pool.filter((p) => p.key !== q.key)).slice(0, 3).map(qName);
      out.choices = shuffle([qName(q), ...others]);
      out.shown = parts.idOf(cells[0], q.key);
    }
    return out;
  });
  quiz = { qs, n: 0, score: 0, q: null, answered: null };
  labels.setVisible(false);
  page = 'quiz';
  nextQuestion();
}
function nextQuestion() {
  parts.highlight('quiz', null);
  parts.highlight('quiz-wrong', null);
  parts.putAllBack();
  parts.isolate(null);
  zoom.show.clear();
  for (const n of parts.nodes) n.opened = false;
  VIEW.cut = true;
  parts.apply();
  if (quiz.n >= quiz.qs.length) {
    quiz.q = null;
    return render();
  }
  const q = (quiz.q = quiz.qs[quiz.n]);
  quiz.answered = null;
  unpick();
  if (q.type === 'name') {
    parts.highlight('quiz', q.shown, PICKED);
    if (!inXr()) look(parts.centreOf(q.shown), Math.max(0.6, Math.min(7, parts.sizeOf(q.shown) * 2.4)));
  } else if (q.type === 'find' && !inXr()) {
    const v = VIEWS[q.where === 'both' ? 'both' : q.where];
    look(v.target, v.radius, null, v.beta);
  }
  cardOpen = true;
  render();
}
function answerFind(id) {
  const q = quiz.q;
  const ok = id !== null && id >= 0 && q.ids.some((t) => isUnder(id, t) || (node(t).key === node(id).key));
  quiz.answered = { ok, id };
  if (ok) quiz.score++;
  const target = ok ? (q.ids.find((t) => isUnder(id, t)) ?? id) : q.ids[0];
  parts.highlight('quiz', target, RIGHT);
  if (!ok && id !== null && id >= 0) parts.highlight('quiz-wrong', id, WRONG);
  if (!inXr()) look(parts.centreOf(target), Math.max(0.6, Math.min(7, parts.sizeOf(target) * 2.4)));
  render();
}
function answerChoice(choice, right) {
  const ok = choice === right;
  quiz.answered = { ok, choice };
  if (ok) quiz.score++;
  if (quiz.q.type === 'name') parts.highlight('quiz', quiz.q.shown, ok ? RIGHT : WRONG);
  render();
}
const WHERE = { both: 'Both', animal: 'Only animal cells', plant: 'Only plant cells' };
function quizPage() {
  const { q, n, qs, score, answered } = quiz;
  if (!q) {
    return {
      kicker: 'Quiz · done',
      title: `${score} of ${qs.length}`,
      body: score >= qs.length * 0.8 ? 'Excellent: you know your way round a cell.' : 'Every miss showed you the right answer. Try another round: the questions change each time.',
      actions: [act('Another round', startQuiz, true), act('Done', endQuiz)],
    };
  }
  const kicker = `Quiz · ${n + 1} of ${qs.length} · score ${score}`;
  const next = act(n + 1 < qs.length ? 'Next question' : 'See my score', () => { quiz.n++; nextQuestion(); }, true);
  const name = qName(q);
  const where = q.where === 'both' ? 'in either cell' : `in the ${q.where} cell`;
  if (q.type === 'find') {
    if (!answered) {
      return {
        kicker,
        title: `Find the ${name}`,
        body: inXr() ? `Point at it ${where} and pull the trigger.` : `Tap or click it ${where}. Turn and zoom to look round.`,
        actions: [act('Show me', () => answerFind(-1)), act('End quiz', endQuiz)],
      };
    }
    const what = answered.id >= 0 && answered.id !== null ? node(answered.id).name : null;
    return {
      kicker,
      title: answered.ok ? 'Right!' : 'Not quite',
      body: answered.ok ? `That’s it, lit up in green. ${info(q.ids[0]).text.split('. ')[0]}.` : `${what ? `You chose: ${what.toLowerCase()}, in red. ` : ''}The ${name} is lit up in green.`,
      actions: [next, act('End quiz', endQuiz)],
    };
  }
  if (q.type === 'name') {
    if (!answered) {
      return {
        kicker,
        title: 'What is the lit part?',
        body: `It’s in the ${q.cell} cell. Look round it if you need to.`,
        actions: [...q.choices.map((c) => act(c[0].toUpperCase() + c.slice(1), () => answerChoice(c, name))), act('End quiz', endQuiz)],
      };
    }
    return {
      kicker,
      title: answered.ok ? 'Right!' : 'Not quite',
      body: answered.ok ? `It’s the ${name}.` : `It’s the ${name}, not the ${answered.choice}.`,
      actions: [next, act('End quiz', endQuiz)],
    };
  }
  // Which cells have it?
  if (!answered) {
    return {
      kicker,
      title: `Which cells have ${MASS.test(name) ? '' : /^[aeiou]/.test(name) ? 'an ' : 'a '}${name}?`,
      body: 'Animal cells, plant cells, or both?',
      actions: [...Object.entries(WHERE).map(([k, label]) => act(label, () => answerChoice(k, q.where))), act('End quiz', endQuiz)],
    };
  }
  const p = PARTS[q.key];
  return {
    kicker,
    title: answered.ok ? 'Right!' : 'Not quite',
    body: `${WHERE[q.where]}. ${p.where}. ${p.fact ?? ''}`.replace('Both. Animal and plant cells.', 'Both animal and plant cells.'),
    actions: [next, act('End quiz', endQuiz)],
  };
}
function endQuiz() {
  quiz = null;
  parts.highlight('quiz', null);
  parts.highlight('quiz-wrong', null);
  labels.setVisible(true);
  putAllBack();
  page = 'learn';
  render();
}

// ---------------------------------------------------------------- animal or plant?

function openCompare() {
  page = 'compare';
  cardOpen = true;
  render();
}
function comparePage() {
  return {
    kicker: 'Animal or plant?',
    title: 'What’s the same, what’s different',
    body: [
      'Both have: a cell membrane, cytoplasm, a nucleus, mitochondria, ribosomes, rough and smooth ER, Golgi, vesicles, peroxisomes and a cytoskeleton.',
      'Only plant cells: a cell wall, chloroplasts, a big central vacuole, plasmodesmata. They’re usually bigger and box-shaped.',
      'Only animal cells: centrioles (in the centrosome), lysosomes. They’re usually smaller and roundish, with no wall.',
    ].join('\n\n'),
    fact: 'Tap a part in either cell to read about it. Both cells are at the same scale, so you can compare their sizes too.',
    actions: [act('Back', openLearn), act('See both', () => goTo('both'), true)],
  };
}

// ---------------------------------------------------------------- the card

const XR_HOWTO = 'Point at anything and pull the trigger to read about it. Put your hand on a part and squeeze the grip to take it; while holding, pull the trigger to take what it belongs to. Let go where it belongs and it goes back in. Left stick walks, right stick teleports and turns. A or X opens this card.';
const FLAT_HOWTO = 'Tap or click a part to choose it; it lights up. Drag the chosen part to pull it out. Drag anywhere else to turn; pinch or scroll to zoom in, right into the cell; two fingers or right-drag to slide the view.';

const act = (label, onClick, primary = false) => ({ label, onClick, primary });

function content() {
  if (page === 'rooms') return roomsCard('cel', rig, act, () => { page = 'part'; render(); });
  if (page === 'people' && presence) return presenceCard(presence, act, () => { page = 'part'; render(); });
  if (page === 'learn') return learnPage();
  if (page === 'compare') return comparePage();
  if (page === 'tour' && tour) return tourPage();
  if (page === 'quiz' && quiz) return quizPage();
  if (picked === null) {
    return {
      kicker: 'The cell · 150,000 times life size',
      title: 'Walk into a cell',
      body: `An animal cell (left) and a plant cell (right), with every part you learn about in school, and more. Each is cut open so you can see in, and every part can come out. ${SCALE_NOTE}`,
      fact: inXr() ? XR_HOWTO : FLAT_HOWTO,
      actions: [
        act('Animal cell', () => goTo('animal')),
        act('Plant cell', () => goTo('plant')),
        act('Tours and quiz', openLearn),
        ...(rig && !inXr() ? [act('Enter VR', enterVr, true)] : [act(inXr() ? 'Close' : 'Explore', close, true)]),
        ...peopleAction(),
      ],
    };
  }
  const id = picked;
  const n = node(id);
  const inf = info(id);
  const cell = cellOf(id);
  const trail = parts.path(id).slice(0, -1);
  const up = parts.parentOf(id);
  const home = [...parts.below(id)].every((i) => parts.isHome(i));
  const isZoom = n.cell === 'zoom';
  const actions = [];
  if (page === 'more') {
    return {
      kicker: `${inf.name} · more`,
      title: 'Size and a fact',
      body: `Real size: ${inf.size ?? ''}\n\n${inf.fact ?? ''}${up === null ? `\n\n${DRAWN_NOTE}` : ''}`,
      fact: inf.where ? `Found in: ${inf.where}.` : '',
      actions: [act('Back', () => { page = 'part'; render(); }, true)],
    };
  }
  if (up !== null) actions.push(act(`Whole ${node(up).name.toLowerCase()}`, () => pick(up)));
  if (isZoom) {
    actions.push(act('Put it away', () => hideZoom(n.key), true));
  } else if (movable(id)) {
    actions.push(home ? act('Take it out', () => takeOut(id), true) : act('Put it back', () => putBack(id), true));
  }
  const o = openableOf(id);
  if (o !== null && !(cell === 'animal' && node(o).key === 'nucleus')) {
    actions.push(act(node(o).opened ? 'Close it' : 'Look inside', () => setOpen(o, !node(o).opened)));
  }
  const z = ZOOM_OF[n.key];
  if (z && !zoom.show.has(z)) actions.push(act(ZOOM_LABEL[z], () => showZoom(z)));
  if (!home && movable(id)) {
    actions.push(act('Bigger', () => parts.rescale(id, 1.5)), act('Smaller', () => parts.rescale(id, 1 / 1.5)));
  }
  if (!isZoom) {
    const alone = parts.isolated()?.[0] === id;
    actions.push(act(alone ? 'Show everything' : 'Show only this', () => showOnly(alone ? null : id)));
  }
  if (canSpeak()) {
    actions.push(act('Read it to me', () => speak(`${inf.name}. ${inf.text} ${inf.like ? `It's like ${inf.like.charAt(0).toLowerCase()}${inf.like.slice(1)}` : ''}`)));
    if (inf.es) actions.push(act('En español', () => speak(inf.es, 'es-ES')));
  }
  if (inXr()) {
    actions.push(act('Size and more', () => { page = 'more'; render(); }));
    actions.push(act('Close', close));
  } else if (!isZoom && up !== null) {
    actions.push(act('Hide', () => hidePart(id)));
  }
  if (tour) actions.unshift(act('Back to tour', () => { page = 'tour'; showStop(); }));
  else if (quiz) actions.unshift(act('Back to quiz', () => { page = 'quiz'; render(); }));
  const kicker = isZoom ? 'Close-up' : CELL_NAME[cell];
  const like = inf.like ? `Think of it as: ${inf.like}` : '';
  if (inXr()) {
    return {
      kicker,
      title: n.name,
      body: [inf.es ? `Spanish: ${inf.es}` : '', inf.text].filter(Boolean).join('\n'),
      fact: note || like,
      actions,
    };
  }
  return {
    kicker,
    title: n.name,
    names: inf.es ? `Spanish: ${inf.es}` : '',
    trail,
    body: [inf.text, like, inf.size ? `Real size: ${inf.size}` : '', up === null && !isZoom ? DRAWN_NOTE : ''].filter(Boolean).join('\n\n'),
    fact: note || [inf.fact, inf.where && up !== null ? `Found in: ${inf.where}.` : ''].filter(Boolean).join(' '),
    actions,
  };
}

function tools() {
  if (page === 'people' || page === 'rooms') return [];
  return [
    act('Animal cell', () => goTo('animal'), view === 'animal'),
    act('Plant cell', () => goTo('plant'), view === 'plant'),
    act('Both', () => goTo('both'), view === 'both'),
    act(VIEW.cut ? 'Close cells' : 'Cut open', () => setCut(!VIEW.cut)),
    act(labels.visible ? 'Labels off' : 'Labels on', () => setLabels(!labels.visible)),
    act('Learn', openLearn),
    act('Put back', putAllBack),
    act('Rooms', () => { page = 'rooms'; cardOpen = true; render(); }),
  ];
}

function peopleAction() {
  if (!inXr() || !presence || presence.state.status !== 'online') return [];
  const s = presence.state;
  const open = () => { page = 'people'; render(); };
  if (!s.joined) return [act(s.online > 1 ? `Join ${s.online - 1} here` : 'Join others', () => { presence.join(); open(); })];
  return [act(`People · ${s.here}`, open)];
}

function close() {
  cardOpen = false;
  if (page !== 'tour' && page !== 'quiz') page = 'part';
  render();
}

function render() {
  if (!cells) return;
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: tools() });
    const head = rig.headPosition();
    let forward = rig.headForward();
    const target = picked !== null ? parts.centreOf(picked) : null;
    if (target) {
      const to = target.subtract(head);
      to.y = 0;
      if (to.lengthSquared() > 0.0001) forward = rotateY(to.normalize(), -0.6);
    }
    card.place(head, forward, target);
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
  if (!cardOpen) return;
  ui.card.classList.toggle('compact', phone() && page === 'part' && picked !== null);
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.names.textContent = data.names ?? '';
  ui.names.hidden = !data.names;
  ui.trail.replaceChildren(...(data.trail ?? []).flatMap((i, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'trail-step';
    b.textContent = node(i).name;
    b.addEventListener('click', () => pick(i));
    return k ? [document.createTextNode(' › '), b] : [b];
  }));
  ui.trail.hidden = !data.trail?.length;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact ?? '';
  ui.fact.hidden = !data.fact;
  ui.actions.replaceChildren(...data.actions.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.label;
    b.className = a.primary ? 'btn btn-primary' : 'btn';
    b.addEventListener('click', a.onClick);
    return b;
  }));
}

function rotateY(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Vector3(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
}

// ---------------------------------------------------------------- picking

const pickable = (m) => m.isPickable && m.isEnabled() && m.isVisible && m.metadata?.part !== undefined;
/**
 * What a ray points at. The cut faces of the cytoplasm, the nucleoplasm and the cell sap are see-through: the
 * ray goes on to what's behind them, unless that's only the cell's far wall, when it's the jelly you chose.
 */
function pickRay(ray) {
  const hits = scene.multiPickWithRay(ray, pickable) ?? [];
  hits.sort((a, b) => a.distance - b.distance);
  let capPart = null;
  for (const h of hits) {
    const id = parts.nodeOfMesh(h.pickedMesh);
    if (id === null) continue;
    if (h.pickedMesh.metadata.cap) {
      capPart ??= id;
      continue;
    }
    if (capPart !== null && node(id).boundary) return capPart;
    return id;
  }
  return capPart;
}
const screenRay = () => scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera);
function screenPick() {
  const ray = screenRay();
  const id = pickRay(ray);
  if (id === null) return { id: null, point: null };
  const hit = scene.pickWithRay(ray, (m) => pickable(m) && parts.nodeOfMesh(m) === id);
  return { id, point: hit?.pickedPoint ?? null };
}

// ---------------------------------------------------------------- flat screen: hover, tap, drag

let drag = null;
const tapSlop = (e) => (e.pointerType === 'touch' ? 12 : 5);
const translation = (p) => Matrix.Translation(p.x, p.y, p.z);
const fingers = new Set();
canvas.addEventListener('pointerdown', (e) => {
  fingers.add(e.pointerId);
  if (fingers.size > 1) cancelDrag();
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, (e) => fingers.delete(e.pointerId));

function cancelDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.mode !== 'part') return;
  if (d.started) parts.drop(d.hold);
  camera.attachControl(canvas, true);
  refreshBar();
  render();
}

let hoverFrame = 0;
scene.onPointerObservable.add((info) => {
  if (!cells) return;
  const { type, event } = info;
  if (event?.pointerType === 'xr') return xrPointer(info);
  if (type === PointerEventTypes.POINTERMOVE) {
    if (drag) return dragMove(event);
    if (event.pointerType === 'mouse' && ++hoverFrame % 2 === 0) {
      const { id } = screenPick();
      parts.highlight('hover', id, HOVER);
      canvas.style.cursor = id === null ? '' : picked !== null && isUnder(id, picked) ? 'grab' : 'pointer';
    }
    return;
  }
  if (type === PointerEventTypes.POINTERDOWN && event.button === 0 && event.isPrimary !== false && fingers.size <= 1) {
    const down = { x: event.clientX, y: event.clientY };
    const { id, point } = screenPick();
    if (picked !== null && id !== null && isUnder(id, picked) && point && movable(picked)) {
      camera.detachControl();
      drag = { mode: 'part', down, id: picked, under: id, point, started: false };
    } else {
      drag = { mode: 'tap', down, id, moved: false };
    }
    return;
  }
  if (type === PointerEventTypes.POINTERUP && drag) {
    const d = drag;
    drag = null;
    if (d.mode === 'part') {
      camera.attachControl(canvas, true);
      if (d.started) {
        const where = parts.drop(d.hold);
        note = where === 'home' ? 'Back in its place.' : '';
        refreshBar();
        render();
      } else {
        pick(d.under);
      }
    } else if (!d.moved) {
      if (d.id !== null) pick(d.id);
      else if (page === 'part' && picked !== null) unpick();
    }
  }
});

function dragMove(event) {
  const d = drag;
  const far = Math.hypot(event.clientX - d.down.x, event.clientY - d.down.y) >= tapSlop(event);
  if (d.mode === 'tap') {
    if (far) d.moved = true;
    return;
  }
  if (!d.started) {
    if (!far) return;
    d.started = true;
    d.plane = Plane.FromPositionAndNormal(d.point, camera.getForwardRay().direction.scale(-1));
    d.hold = parts.take(d.id, translation(d.point));
  }
  const ray = screenRay();
  const t = ray.intersectsPlane(d.plane);
  if (t === null) return;
  parts.follow(d.hold, translation(ray.origin.add(ray.direction.scale(t))));
}

// ---------------------------------------------------------------- headset: point, and take hold

const HAND_REACH = 0.025;
const holds = new Map();

function xrPointer(info) {
  if (info.type !== PointerEventTypes.POINTERDOWN) return;
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(info.event.pointerId);
  if (controller && holds.has(controller.uniqueId)) return;
  if (info.pickInfo?.pickedMesh && card.panels.some((p) => p.mesh === info.pickInfo.pickedMesh)) return;
  let id = null;
  if (controller) {
    const ray = new Ray(Vector3.Zero(), Vector3.Forward(), 30);
    controller.getWorldPointerRayToRef(ray);
    id = pickRay(ray);
  } else if (info.pickInfo?.pickedMesh) {
    id = parts.nodeOfMesh(info.pickInfo.pickedMesh);
  }
  if (id !== null) pick(id);
}

function handMatrix(source) {
  const n = source.grip ?? source.pointer;
  n.computeWorldMatrix(true);
  return Matrix.Compose(Vector3.One(), n.absoluteRotationQuaternion.clone(), n.getAbsolutePosition().clone());
}
const buzz = (mc, v, ms) => { try { mc?.pulse(v, ms); } catch {} };

function setUpHands() {
  const grab = (source, mc) => {
    if (holds.has(source.uniqueId)) return;
    const hand = handMatrix(source);
    const id = parts.partAt(hand.getTranslation(), HAND_REACH);
    if (id === null) return;
    holds.set(source.uniqueId, { hold: parts.take(id, hand), id, mc });
    // An organelle in your hand opens up so you can see inside it.
    if (node(id).openable && !(node(id).cell === 'animal' && node(id).key === 'nucleus')) {
      node(id).opened = true;
      parts.apply();
    }
    parts.highlight(`hand-${source.uniqueId}`, id, PICKED);
    buzz(mc, 0.3, 25);
    picked = id;
    page = 'part';
    note = '';
    cardOpen = true;
    render();
  };
  const climbHold = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h) return;
    const up = parts.parentOf(h.id);
    if (up === null || parts.parentOf(up) === null) return buzz(h.mc, 0.6, 80);
    parts.drop(h.hold);
    h.id = up;
    h.hold = parts.take(up, handMatrix(source));
    parts.highlight(`hand-${source.uniqueId}`, up, PICKED);
    buzz(h.mc, 0.5, 40);
    picked = up;
    render();
  };
  const letGo = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h) return;
    holds.delete(source.uniqueId);
    parts.highlight(`hand-${source.uniqueId}`, null);
    const where = parts.drop(h.hold);
    if (where === 'home') {
      buzz(h.mc, 0.4, 30);
      if (node(h.id).openable) {
        node(h.id).opened = false;
        parts.apply();
      }
    }
    note = where === 'home' ? 'Back in its place.' : '';
    refreshBar();
    render();
  };
  rig.xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      mc.getComponent('xr-standard-squeeze')?.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed) return;
        if (c.pressed) grab(source, mc);
        else letGo(source);
      });
      mc.getComponent('xr-standard-trigger')?.onButtonStateChangedObservable.add((c) => {
        if (c.changes.pressed && c.pressed && holds.has(source.uniqueId)) climbHold(source);
      });
    });
  });
  rig.xr.input.onControllerRemovedObservable.add(letGo);
  scene.onBeforeRenderObservable.add(() => {
    for (const [uid, h] of holds) {
      const source = rig.xr.input.controllers.find((c) => c.uniqueId === uid);
      if (source) parts.follow(h.hold, handMatrix(source));
    }
  });
  let frame = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (!inXr() || ++frame % 6) return;
    for (const source of rig.xr.input.controllers) {
      if (holds.has(source.uniqueId)) continue;
      parts.highlight(`near-${source.uniqueId}`, parts.partAt(handMatrix(source).getTranslation(), HAND_REACH), HOVER);
    }
  });
}

// ---------------------------------------------------------------- search

function setUpSearch() {
  const input = ui.search, list = ui.results;
  const entries = [];
  const seen = new Set();
  for (const n of parts.nodes) {
    const p = PARTS[n.key];
    if (!p) continue;
    const k = `${n.cell}:${n.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const words = [p.name, p.es, ...(p.alt ?? [])].map((w) => w.toLowerCase());
    entries.push({ id: n.id, words, label: p.name, where: n.cell === 'zoom' ? 'Close-up' : CELL_NAME[n.cell] });
  }
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let hits = [], at = -1;
  const show = () => {
    list.replaceChildren(...hits.map((e, k) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `hit-${k}`;
      li.setAttribute('aria-selected', String(k === at));
      li.innerHTML = '<span class="hit-name"></span><span class="hit-sys"></span>';
      li.firstChild.textContent = e.label;
      li.lastChild.textContent = e.where;
      li.addEventListener('pointerdown', (ev) => { ev.preventDefault(); choose(e); });
      return li;
    }));
    list.hidden = !hits.length;
    input.setAttribute('aria-expanded', String(!!hits.length));
    if (at >= 0) input.setAttribute('aria-activedescendant', `hit-${at}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const choose = (e) => {
    hits = [];
    show();
    input.value = '';
    input.blur();
    if (node(e.id).cell === 'zoom') return showZoom(node(e.id).key);
    parts.isolate(null);
    if (!VIEW.cut) setCut(true);
    pick(e.id);
    look(parts.centreOf(e.id), Math.max(0.6, Math.min(8, parts.sizeOf(e.id) * 2.2)));
  };
  input.addEventListener('input', () => {
    const q = fold(input.value.trim());
    hits = q.length < 2 ? [] : entries.filter((e) => e.words.some((w) => fold(w).includes(q)))
      .sort((a, b) => Number(!a.words.some((w) => fold(w).startsWith(q))) - Number(!b.words.some((w) => fold(w).startsWith(q))))
      .slice(0, 10);
    at = hits.length ? 0 : -1;
    show();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      at = (at + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      show();
    } else if (e.key === 'Enter' && hits[at]) {
      choose(hits[at]);
    } else if (e.key === 'Escape') {
      hits = [];
      show();
      input.blur();
    }
  });
  input.addEventListener('blur', () => setTimeout(() => { hits = []; show(); }, 150));
  input.disabled = false;
}

// ---------------------------------------------------------------- start

async function start() {
  ui.pct.textContent = 'Building the cells…';
  await new Promise((r) => setTimeout(r, 30));
  build();
  for (const mat of scene.materials) {
    if (mat.realTimeFiltering === undefined) continue;
    mat.realTimeFiltering = true;
    mat.realTimeFilteringQuality = Constants.TEXTURE_FILTERING_QUALITY_LOW;
  }
  setUpSearch();

  let refreshPresence = () => {};
  presence = createPresence(scene, {
    subject: 'cel',
    getPose: () => (inXr() ? xrPose(rig) : orbitPose(camera, room.floors)),
    onChange: (state) => {
      refreshPresence(state);
      if (inXr() && cardOpen && (page === 'people' || picked === null)) card.setContent({ ...content(), tools: tools() });
    },
  });
  refreshPresence = mountPresenceControls(presence, $('.presence-controls'));
  refreshPresence(presence.state);

  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: room.floors, start: XR_SPOTS.both, maxResolution: 1.3 });
    }
  } catch (err) {
    console.warn('[cel] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.01;
    rig.camera.maxZ = 140;
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
    presence.attachXr(rig.xr);
    createMenuControls(scene, rig, card, { open: () => { cardOpen = true; render(); }, close });
    setUpHands();
  }

  continueInVr(rig, ui.vr);
  ui.pct.textContent = 'Getting the colours ready…';
  // Shaders compile on the first frames; a few seconds at most, then show the cells anyway.
  await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 6000))]);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [...ui.views, ui.cut, ui.labels, ui.learn, ui.back]) b.disabled = false;
  camera.radius = VIEWS.both.radius * fitWidth();
  refreshBar();
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[cel] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}

ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
for (const b of ui.views) b.addEventListener('click', () => goTo(b.dataset.view));
ui.cut.addEventListener('click', () => setCut(!VIEW.cut));
ui.labels.addEventListener('click', () => setLabels(!labels.visible));
ui.learn.addEventListener('click', openLearn);
ui.back.addEventListener('click', putAllBack);
ui.retry.addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => {
  if (document.activeElement === ui.search) return;
  if (e.key === '/' && !inXr()) {
    e.preventDefault();
    ui.search.focus();
    return;
  }
  if (e.key === 'Escape' && !inXr()) {
    if (picked !== null) unpick();
    else close();
  }
});

engine.runRenderLoop(() => scene.render());
addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[cel]', err);
  ui.pct.textContent = 'The cells could not be built.';
  ui.retry.hidden = false;
});

// For automated checks in a browser.
window.__cel = { scene, camera, parts, get cells() { return cells; }, pick, takeOut, putAllBack, setCut, goTo, showZoom, setOpen, content: () => content(), startTour: (i) => startTour(TOURS[i]), startQuiz, get state() { return { page, picked, view, tour: tour && { id: tour.t.id, i: tour.i }, quiz: quiz && { n: quiz.n, q: quiz.q && { type: quiz.q.type, key: quiz.q.key } } }; } };
