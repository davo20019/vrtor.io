// VRtor Body (/bdy): a whole human body, life size, made of 3,273 separate parts from BodyParts3D and Z-Anatomy (bones,
// muscles, organs, vessels, nerves, the eyes and ears), every one of which can be taken out, and taken out
// with everything that belongs to it.
//
// Flat screens: orbit round it; click a part to name it, and the card climbs from it to what it is part of
// (a valve leaflet, the valve, the right side of the heart, the heart); drag to pull out what's chosen, at
// that level. Headset: walk round it, put a hand in and squeeze the grip to take hold of the part under your
// hand; pull the trigger while holding to take the whole of what it belongs to instead (the leaflet, then the
// valve, then the heart). Let go anywhere and it stays in the air; let go near where it belongs and it goes
// back in. Layers peel the body: skin, muscles, organs, skeleton.
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
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { continueInVr, createCard, createMenuControls, createPresence, createXr, headsetNote, mountPresenceControls, orbitPose, presenceCard, roomsCard, startHeadsetLog, xrPose, xrSupported } from '@vrtor/xr-shell';
import { loadBody } from './body.js';
import { canSpeak, loadLearning, speak } from './learn.js';
import { QUIZ, TOURS } from './tours.js';
import { setLite } from './tissues.js';
import { createRoom, PLINTH_TOP } from './room.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
const MODEL_V = '12';
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
  layers: [...document.querySelectorAll('[data-layer]')],
  systems: $('[data-systems]'),
  learn: $('[data-learn]'),
  back: $('[data-back]'),
  hint: $('.hint'),
  names: $('.card-names'),
  trail: $('.card-trail'),
  source: $('.card-source'),
  search: $('.search input'),
  results: $('.search-results'),
};

const HOVER = Color3.FromHexString('#ffd27a');
const PICKED = Color3.FromHexString('#ffb020');
const RIGHT = Color3.FromHexString('#4cd07d');
const WRONG = Color3.FromHexString('#ff5a4f');

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#121012ff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.15;
ip.contrast = 1.1;
scene.skipPointerMovePicking = false;

const camera = new ArcRotateCamera('orbit', Math.PI / 2, 1.35, 3.1, new Vector3(0, 1.05, 0), scene);
camera.minZ = 0.01;
camera.maxZ = 60;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 1800;
camera.lowerBetaLimit = 0.1;
camera.upperBetaLimit = 1.66;
camera.lowerRadiusLimit = 0.15;
camera.upperRadiusLimit = 8;
camera.attachControl(canvas, true);
// Up and down the body: panning (right-drag or Ctrl-drag with a mouse, two fingers on a phone) only slides the view
// vertically, and the height slider does the same. Between the soles and just over the head.
camera.panningAxis = new Vector3(0, 1, 0);
camera.inputs.attached.pointers.multiTouchPanning = true;
const VIEW_LOW = 0.05;
const VIEW_HIGH = 1.85;

const room = createRoom(scene);
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene);
hemi.diffuse = Color3.FromHexString('#f1e9e2');
hemi.groundColor = Color3.FromHexString('#3a3230');
hemi.specular = Color3.Black();
hemi.intensity = 0.7;
// The key light, high and to the front left, as over a dissection table: the forms read, the hollows go dark.
const TO_KEY = new Vector3(-0.45, 0.8, 0.55).normalize();
const key = new DirectionalLight('key', TO_KEY.scale(-1), scene);
key.position = TO_KEY.scale(10);
key.intensity = 2.2;
key.diffuse = Color3.FromHexString('#fff4ea');
// A cool rim from behind, so the silhouette separates from the dark room.
const rim = new DirectionalLight('rim', new Vector3(0.3, -0.35, 1).normalize(), scene);
rim.intensity = 0.9;
rim.diffuse = Color3.FromHexString('#d6e2ff');
rim.specular = Color3.FromHexString('#d6e2ff');

// Wet tissue shows what surrounds it: the room rendered once into a cube map.
const probe = new ReflectionProbe('env', 128, scene);
probe.position = new Vector3(0, 1.2, 0);
probe.renderList.push(...room.envMeshes);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.9;

const stand = new TransformNode('body', scene);
stand.position.y = PLINTH_TOP;

// ---------------------------------------------------------------- state

let body = null;
/** Names, descriptions and search (learn.js). */
let learn = null;
let rig = null;
let presence = null;
const card = createCard(scene, { name: 'body-card', width: 0.8, height: 0.6 });
let cardOpen = true;
/** The node the card is about (null: the welcome). */
let picked = null;
/** The card's page: 'part' | 'systems' | 'people' | 'rooms'. */
let page = 'part';
let layer = 'muscles';
let note = '';

const inXr = () => !!rig?.inXr();
const name = (id) => body.nodes[id].name;
const partCount = (id) => [...body.below(id)].filter((i) => body.nodes[i].el).length;

// ---------------------------------------------------------------- layers and systems

/** What each layer shows: the body peeled from the outside in. */
const LAYERS = {
  // Fascia wraps the muscles like cling film: it's in Systems, off in every layer. Each layer shows what it's about:
  // the reproductive organs (BodyParts3D has them without their skin) are with the organs, not the muscles.
  skin: { label: 'Skin', off: ['fascia'] },
  muscles: { label: 'Muscles', off: ['skin', 'fascia', 'repro'] },
  organs: { label: 'Organs', off: ['skin', 'muscles', 'fascia'] },
  skeleton: { label: 'Skeleton', off: ['skin', 'muscles', 'fascia', 'heart', 'nerves', 'lungs', 'gut', 'urinary', 'repro', 'glands', 'senses', 'lymph'] },
};
function setLayer(id) {
  layer = id;
  body.isolate(null);
  for (const s of body.systems) body.setSystem(s.id, !LAYERS[id].off.includes(s.id));
  if (picked !== null && !visible(picked)) picked = null;
  refreshBar();
  render();
}
function visible(id) {
  return body.meshesBelow(id).some((m) => m.isEnabled());
}
function toggleSystem(id) {
  body.setSystem(id, !body.systemOn(id));
  layer = null;
  refreshBar();
  render();
}

function refreshBar() {
  for (const b of ui.layers) b.setAttribute('aria-pressed', String(b.dataset.layer === layer));
  if (body) ui.back.disabled = !body.movedCount() && !body.hiddenCount() && body.isolated() === null;
}

// ---------------------------------------------------------------- choosing and taking out

/** A phone-sized screen: the card is a short strip, and the view brings what's chosen to the middle. */
const phone = () => matchMedia('(max-width: 640px)').matches;

function pick(id) {
  if (page === 'quiz' && quiz?.q?.type === 'find' && !quiz.answered) return answerFind(id);
  picked = id;
  page = 'part';
  note = '';
  cardOpen = true;
  body.highlight('picked', id, PICKED);
  // On a phone the card covers the bottom of the screen: the chosen part comes to the middle, above it.
  if (phone() && !inXr()) look(body.centreOf(id), camera.radius);
  render();
}
function climb() {
  if (picked === null) return;
  const up = body.parentOf(picked);
  if (up !== null && up !== 0) pick(up);
}
function unpick() {
  picked = null;
  body.highlight('picked', null);
  render();
}

/** Out in front of the viewer, at arm's length (or beside the body on a flat screen). */
function takeOut(id) {
  let to;
  if (inXr()) {
    const head = rig.headPosition();
    const f = rig.headForward();
    to = head.add(new Vector3(f.x, 0, f.z).normalize().scale(0.55));
    to.y = head.y - 0.15;
  } else {
    // Towards the camera, off the body's side, at the height it's at.
    const c = body.centreOf(id);
    const toCam = camera.position.subtract(c);
    toCam.y = 0;
    const side = Vector3.Cross(Vector3.Up(), toCam.normalize()).scale(c.x >= 0 ? 1 : -1);
    to = c.add(toCam.normalize().scale(0.3)).add(side.scale(0.3));
  }
  body.sendTo(id, to, () => {
    refreshBar();
    render();
  });
  // On a flat screen the camera follows it out.
  if (!inXr()) look(to, Math.max(0.6, Math.min(2.2, size(id) * 2.2)));
  note = 'Out. Drag it about, or put it back from here.';
  render();
}
const size = (id) => {
  const { lo, hi } = body.boxOf(id);
  return Number.isFinite(lo.x) ? hi.subtract(lo).length() : 0.5;
};

// The height slider and the view's height follow each other.
const heightSlider = document.querySelector('[data-height]');
heightSlider.min = String(VIEW_LOW);
heightSlider.max = String(VIEW_HIGH);
heightSlider.addEventListener('input', () => {
  flight = null;
  camera.target.y = Number(heightSlider.value);
});
scene.onBeforeRenderObservable.add(() => {
  if (inXr()) return;
  const t = camera.target;
  if (t.y < VIEW_LOW) t.y = VIEW_LOW;
  if (t.y > VIEW_HIGH) t.y = VIEW_HIGH;
  if (document.activeElement !== heightSlider && Math.abs(Number(heightSlider.value) - t.y) > 0.005) heightSlider.value = t.y.toFixed(3);
});

// Flat screens: glide the camera's target (and distance) to something.
let flight = null;
function look(target, radius) {
  flight = { target: target.clone(), radius };
}
canvas.addEventListener('pointerdown', () => (flight = null));
canvas.addEventListener('wheel', () => (flight = null), { passive: true });
scene.onBeforeRenderObservable.add(() => {
  if (!flight || inXr()) return;
  const k = Math.min(1, engine.getDeltaTime() / 250);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  camera.radius += (flight.radius - camera.radius) * k;
  if (Vector3.Distance(camera.target, flight.target) < 0.002 && Math.abs(camera.radius - flight.radius) < 0.002) flight = null;
});
function putBack(id) {
  body.putBack(id, () => {
    refreshBar();
    render();
  });
  note = '';
  render();
}
function putAllBack() {
  body.putAllBack();
  body.showAll();
  body.isolate(null);
  if (layer) setLayer(layer);
  note = '';
  setTimeout(refreshBar, 700);
  render();
}
/** "Show only this" (or everything again, with null). */
function showOnly(id) {
  body.isolate(id);
  if (id !== null && !inXr()) look(body.centreOf(id), Math.max(0.35, Math.min(2.2, size(id) * 1.8)));
  refreshBar();
  render();
}

/** Where a part can be seen: the layer that shows its system (a bone: Skeleton; a muscle: Muscles). */
const LAYER_OF = { skeleton: 'skeleton', muscles: 'muscles', skin: 'skin' };
/** From search: makes the part visible, chooses it and brings the view to it. */
function showPart(id) {
  body.isolate(null);
  const sys = body.systemOf(id);
  if (sys === 'fascia') body.setSystem('fascia', true);
  else if (!body.meshesBelow(id).some((m) => m.isEnabled())) setLayer(LAYER_OF[sys] ?? 'organs');
  pick(id);
  if (!inXr()) look(body.centreOf(id), Math.max(0.35, Math.min(2.2, size(id) * 2.2)));
}

function hidePart(id) {
  body.hide(id);
  picked = null;
  body.highlight('picked', null);
  refreshBar();
  render();
}

// ---------------------------------------------------------------- tours and the quiz (content in tours.js)

/** The tour being taken: { t, i } (stop index), or null. */
let tour = null;
/** The quiz: { qs, n, score, q, answered: null | { ok, id?, choice? } }, or null. */
let quiz = null;
const QUESTIONS = 10;

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
    fact: 'A tour shows and explains a few parts, one stop at a time. The quiz asks you to find parts and to name them.',
    actions: [
      ...TOURS.map((t) => act(t.title, () => startTour(t))),
      act(`Quiz: ${QUESTIONS} questions`, startQuiz, true),
      act('Back', () => { page = 'part'; render(); }),
    ],
  };
}

const ids = (names) => (names ?? []).map((n) => body.idOf(n)).filter((i) => i !== null);
/** A tour's stops whose parts are all there (a missing part is logged, and its stop skipped). */
function stopsOf(t) {
  return t.stops.filter((s) => {
    const want = [...(s.only ?? []), ...(s.out ?? []), s.pick];
    const missing = want.filter((n) => body.idOf(n) === null);
    if (missing.length) console.warn('[bdy] tour stop left out, missing', missing);
    return !missing.length;
  });
}

function startTour(t) {
  tour = { t, stops: stopsOf(t), i: 0 };
  page = 'tour';
  showStop();
}

/** Sets the scene for the current stop: its layer, only its parts, any lifted out of the way, the view on them. */
function showStop() {
  const s = tour.stops[tour.i];
  body.putAllBack();
  if (s.layer) setLayer(s.layer);
  const only = ids(s.only);
  if (only.length) body.isolate(only);
  // Lifted straight up, a little apart: out of the way, still in view.
  ids(s.out).forEach((id, k) => body.sendTo(id, body.centreOf(id).add(new Vector3((k - 1) * 0.12, 0.2, 0.05))));
  picked = body.idOf(s.pick);
  body.highlight('picked', picked, PICKED);
  if (!inXr()) {
    const box = union(only.length ? only : [picked]);
    look(box.centre, Math.max(0.35, Math.min(2.6, box.size * 1.5)));
  }
  cardOpen = true;
  refreshBar();
  render();
}
function union(list) {
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.scale(-1);
  for (const id of list) {
    const b = body.boxOf(id);
    lo.minimizeInPlace(b.lo);
    hi.maximizeInPlace(b.hi);
  }
  return { centre: lo.add(hi).scale(0.5), size: hi.subtract(lo).length() };
}

function tourPage() {
  const { t, stops, i } = tour;
  const s = stops[i];
  const last = i === stops.length - 1;
  const pid = body.idOf(s.pick);
  const info = learn?.about(pid) ?? {};
  return {
    kicker: `Tour · ${t.title} · ${i + 1} of ${stops.length}`,
    title: s.title,
    names: info.latin ? `${name(pid)} · Latin: ${info.latin}` : name(pid),
    body: s.text,
    fact: inXr() ? 'Squeeze the grip on a part to take it in your hand.' : 'Drag the lit part to pull it out; drag elsewhere to turn the view.',
    actions: [
      ...(i > 0 ? [act('Back', () => { tour.i--; showStop(); })] : []),
      act(last ? 'Finish' : 'Next', () => (last ? endTour() : (tour.i++, showStop())), true),
      act('End tour', endTour),
    ],
  };
}

function endTour() {
  tour = null;
  body.isolate(null);
  body.putAllBack();
  picked = null;
  body.highlight('picked', null);
  setLayer('muscles');
  page = 'learn';
  render();
}

// ---- the quiz: "Find the femur" (tap it, or point and pull the trigger: either side counts) and "What is this?"
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startQuiz() {
  const pool = QUIZ.map((q) => ({ ...q, ids: ids(q.parts) })).filter((q) => q.ids.length);
  const qs = shuffle(pool.slice()).slice(0, QUESTIONS).map((q, k) => ({ ...q, type: k % 5 < 3 ? 'find' : 'name' }));
  for (const q of qs) {
    if (q.type !== 'name') continue;
    const others = shuffle(pool.filter((p) => p.kind === q.kind && p.name !== q.name)).slice(0, 3).map((p) => p.name);
    q.choices = shuffle([q.name, ...others]);
    q.shown = q.ids[Math.floor(Math.random() * q.ids.length)];
  }
  quiz = { qs, n: 0, score: 0, q: null, answered: null };
  page = 'quiz';
  nextQuestion();
}

function nextQuestion() {
  body.isolate(null);
  body.highlight('quiz', null);
  body.highlight('quiz-wrong', null);
  if (quiz.n >= quiz.qs.length) {
    quiz.q = null;
    return render();
  }
  const q = (quiz.q = quiz.qs[quiz.n]);
  quiz.answered = null;
  body.putAllBack();
  setLayer(q.layer);
  picked = null;
  body.highlight('picked', null);
  if (q.type === 'name') {
    // An organ or a muscle may lie under others (the pancreas behind the stomach, the cerebellum inside the skull):
    // it shows alone, to be known by its shape. A bone shows in the skeleton as it is.
    if (q.kind !== 'bone') body.isolate(q.shown);
    body.highlight('quiz', q.shown, PICKED);
    if (!inXr()) look(body.centreOf(q.shown), Math.max(0.5, Math.min(2.2, size(q.shown) * 2.5)));
  } else if (!inXr()) {
    look(new Vector3(0, 1.0, 0), 3.1);
  }
  cardOpen = true;
  render();
}

function answerFind(id) {
  const q = quiz.q;
  const ok = id >= 0 && q.ids.some((t) => isUnder(id, t));
  quiz.answered = { ok, id };
  if (ok) quiz.score++;
  const target = ok ? q.ids.find((t) => isUnder(id, t)) : q.ids[0];
  body.highlight('quiz', target, RIGHT);
  if (!ok && id >= 0) body.highlight('quiz-wrong', id, WRONG);     // "Show me" has no wrong part
  if (!inXr()) look(body.centreOf(target), Math.max(0.5, Math.min(2.2, size(target) * 2.5)));
  render();
}

function answerName(choice) {
  const q = quiz.q;
  const ok = choice === q.name;
  quiz.answered = { ok, choice };
  if (ok) quiz.score++;
  body.highlight('quiz', q.shown, ok ? RIGHT : WRONG);
  render();
}

function quizPage() {
  const { q, n, qs, score, answered } = quiz;
  if (!q) {
    const great = score >= qs.length * 0.8;
    return {
      kicker: 'Quiz · done',
      title: `${score} of ${qs.length}`,
      body: great ? 'Well done: you know your way around the body.' : 'Every miss showed you where the part really is. Try another round: the questions change each time.',
      actions: [act('Another round', startQuiz, true), act('Done', endQuiz)],
    };
  }
  const kicker = `Quiz · ${n + 1} of ${qs.length} · score ${score}`;
  const next = act(n + 1 < qs.length ? 'Next question' : 'See my score', () => { quiz.n++; nextQuestion(); }, true);
  const article = (s) => (/^[aeiou]/.test(s) ? 'an' : 'a');
  if (q.type === 'find') {
    if (!answered) {
      return {
        kicker,
        title: `Find the ${q.name}`,
        body: inXr() ? 'Point at it and pull the trigger. Either side counts.' : 'Tap or click it. Either side counts. Drag to turn the body, pinch or scroll to zoom.',
        actions: [act('Show me', () => answerFind(-1)), act('End quiz', endQuiz)],
      };
    }
    const what = answered.id >= 0 ? name(answered.id) : null;
    return {
      kicker,
      title: answered.ok ? 'Right!' : 'Not quite',
      body: answered.ok ? `That’s the ${q.name}, lit up in green.` : `${what ? `You chose the ${what.toLowerCase()}, in red. ` : ''}The ${q.name} is lit up in green.`,
      actions: [next, act('End quiz', endQuiz)],
    };
  }
  if (!answered) {
    return {
      kicker,
      title: 'What is this?',
      body: q.kind === 'bone' ? 'The lit part is a bone. Which one?' : `This is ${article(q.kind)} ${q.kind}, shown on its own. Which one? Turn it around to see its shape.`,
      actions: [...q.choices.map((c) => act(c[0].toUpperCase() + c.slice(1), () => answerName(c))), act('End quiz', endQuiz)],
    };
  }
  return {
    kicker,
    title: answered.ok ? 'Right!' : 'Not quite',
    body: answered.ok ? `It’s the ${q.name}.` : `It’s the ${q.name}, not the ${answered.choice}.`,
    actions: [next, act('End quiz', endQuiz)],
  };
}

function endQuiz() {
  quiz = null;
  body.isolate(null);
  body.highlight('quiz', null);
  body.highlight('quiz-wrong', null);
  body.putAllBack();
  setLayer('muscles');
  page = 'learn';
  render();
}

// ---------------------------------------------------------------- the card

const XR_HOWTO = 'Put your hand on a part and squeeze the grip to take it. While holding, pull the trigger to take the whole of what it belongs to. Let go anywhere and it stays; let go where it belongs and it goes back in. Left stick walks, right stick teleports and turns. A or X opens this card.';
const FLAT_HOWTO = 'Tap or click a part to choose it; it lights up. Drag the chosen part to pull it out. Drag anywhere else to turn the body; pinch or scroll to zoom. To go up to the head or down to the feet: the slider on the right, two fingers on a phone, or right-drag with a mouse.';

const act = (label, onClick, primary = false) => ({ label, onClick, primary });

function content() {
  if (page === 'rooms') return roomsCard('bdy', rig, act, () => { page = 'part'; render(); });
  if (page === 'people' && presence) return presenceCard(presence, act, () => { page = 'part'; render(); });
  if (page === 'learn') return learnPage();
  if (page === 'tour' && tour) return tourPage();
  if (page === 'quiz' && quiz) return quizPage();
  if (page === 'systems') {
    return {
      kicker: 'Body systems',
      title: 'What to show',
      body: body.systems.map((s) => `${body.systemOn(s.id) ? '●' : '○'} ${s.name}`).join('   '),
      fact: 'Each system can go on or off on its own. The layers below peel the body from the outside in.',
      actions: [
        ...body.systems.map((s) => act(`${body.systemOn(s.id) ? 'Hide' : 'Show'} ${s.name.toLowerCase()}`, () => toggleSystem(s.id))),
        act('Done', () => { page = 'part'; render(); }, true),
      ],
    };
  }
  if (picked === null) {
    return {
      kicker: `Human body · ${body.count.toLocaleString('en')} parts`,
      title: 'Take the body apart',
      body: 'Every bone, muscle, organ, vessel and nerve here is its own part, in its place in an adult man’s body: the BodyParts3D atlas, built from a whole-body MRI and refined by medical illustrators, with the face’s muscles, the lungs, ligaments, nerves and lymph nodes from Z-Anatomy. Any part comes out, alone or with all that belongs to it.',
      fact: inXr() ? XR_HOWTO : FLAT_HOWTO,
      actions: rig && !inXr()
        ? [act('Explore', close), act('Tours and quiz', openLearn), act('Enter VR', enterVr, true)]
        : [act(inXr() ? 'Close' : 'Explore', close, true), act('Tours and quiz', openLearn), ...peopleAction()],
    };
  }
  const id = picked;
  const n = body.nodes[id];
  // From the system down to what it's directly part of: "Heart › Right side of heart › Tricuspid valve".
  const trail = body.path(id).slice(2, -1).map(name);
  const sys = body.systems.find((s) => s.id === body.systemOf(id));
  const count = partCount(id);
  const home = [...body.below(id)].every((i) => body.isHome(i));
  const up = body.parentOf(id);
  const actions = [];
  if (up !== null && up !== 0) actions.push(act(up === sys?.node ? `All ${sys.name.toLowerCase()}` : `Whole ${name(up).toLowerCase()}`, climb));
  actions.push(home ? act('Take it out', () => takeOut(id), true) : act('Put it back', () => putBack(id), true));
  const alone = body.isolated() === id;
  actions.push(act(alone ? 'Show everything' : 'Show only this', () => showOnly(alone ? null : id)));
  if (canSpeak()) actions.push(act('Hear it', () => speak(n.name.replace(/, (\d+ of \d+|main part)$/, ''))));
  if (inXr()) actions.push(act('Close', close));
  else actions.push(act('Hide', () => hidePart(id)));
  // Looked at a part mid-tour or mid-quiz: the way back first.
  if (tour) actions.unshift(act('Back to tour', () => { page = 'tour'; render(); }));
  else if (quiz) actions.unshift(act('Back to quiz', () => { page = 'quiz'; render(); }));
  const info = learn?.about(id) ?? {};
  const where = trail.length ? `In ${trail.join(' › ')}.` : n.el ? `In ${sys?.name.toLowerCase() ?? 'the body'}.` : '';
  const names = [info.latin && `Latin: ${info.latin}`, info.local && `${info.local.label}: ${info.local.name}`].filter(Boolean).join(' · ');
  const about = !info.text ? ''
    : info.kind ? `About ${info.kind}: ${info.text}`
    : info.from ? `Part of the ${info.from.toLowerCase()}. ${info.text}`
    : info.article ? `From the article on the ${info.article.toLowerCase()}: ${info.text}`
    : info.text;
  const howto = inXr()
    ? 'Squeeze the grip on it to take it in your hand; pull the trigger while holding to take the whole of what it belongs to.'
    : 'Drag it to pull it out; drag anywhere else to turn the view.';
  return {
    kicker: sys ? `${sys.name}${n.el ? '' : ` · ${count} parts`}` : 'Human body',
    title: n.name,
    names,
    // The headset's card is text only: the path and the names go in its body.
    body: inXr() ? [names, about || where].filter(Boolean).join('\n') : about || [where, n.el ? '' : `${count} parts move together when you take it out.`].filter(Boolean).join(' '),
    trail: body.path(id).slice(1, -1),
    source: info.source,
    fact: note || (inXr() && info.source ? `${howto} Text: Wikipedia, CC BY-SA.` : howto),
    actions,
  };
}

/** The headset's stand-in for the page's bar: a strip of tools under the card. */
function tools() {
  if (page === 'people' || page === 'rooms') return [];
  return [
    ...Object.entries(LAYERS).map(([id, l]) => act(l.label, () => setLayer(id), layer === id)),
    act('Systems', () => { page = 'systems'; cardOpen = true; render(); }),
    act('Learn', openLearn),
    act('Put everything back', putAllBack),
    act('Change room', () => { page = 'rooms'; cardOpen = true; render(); }),
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
  page = 'part';
  render();
}

function render() {
  if (!body) return;
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: tools() });
    const head = rig.headPosition();
    let forward = rig.headForward();
    const target = picked !== null ? body.centreOf(picked) : null;
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
  // A part chosen on a phone: its name and buttons only, so the part stays in view and in reach of a drag.
  ui.card.classList.toggle('compact', phone() && page === 'part' && picked !== null);
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.names.textContent = data.names ?? '';
  ui.names.hidden = !data.names;
  // The path, each step a button that chooses it: Heart and vessels › Heart › Right side of heart.
  ui.trail.replaceChildren(...(data.trail ?? []).flatMap((i, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'trail-step';
    b.textContent = name(i);
    b.addEventListener('click', () => pick(i));
    return k ? [document.createTextNode(' › '), b] : [b];
  }));
  ui.trail.hidden = !data.trail?.length;
  ui.body.textContent = data.body;
  if (data.source) {
    ui.source.replaceChildren('Text: ', Object.assign(document.createElement('a'), { href: data.source.url, target: '_blank', rel: 'noopener', textContent: `Wikipedia, “${data.source.title}”` }), ', CC BY-SA 4.0');
  }
  ui.source.hidden = !data.source;
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

// ---------------------------------------------------------------- flat screen: hover, tap, drag
//
// One rule, mouse or finger: a drag moves the part you have chosen (it's lit) and turns the view anywhere else,
// on other parts too; a tap chooses the part under it. On a phone the body fills the screen, so a drag on any part
// pulling that part out left nowhere to turn the view. A second finger (a pinch) always goes to the camera.

let drag = null;            // { mode: 'part' | 'tap', down: {x,y}, id, point, hold, plane, started, moved }
/** How far a press may wander and still be a tap (px): a fingertip wobbles more than a mouse. */
const tapSlop = (e) => (e.pointerType === 'touch' ? 12 : 5);
const translation = (p) => Matrix.Translation(p.x, p.y, p.z);
const fingers = new Set();

canvas.addEventListener('pointerdown', (e) => {
  fingers.add(e.pointerId);
  if (fingers.size > 1) cancelDrag();
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, (e) => fingers.delete(e.pointerId));

/** A pinch begins, or the press is lost: a part being pulled stays where it got to, and the camera has the view. */
function cancelDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.mode !== 'part') return;
  if (d.started) body.drop(d.hold);
  camera.attachControl(canvas, true);
  refreshBar();
  render();
}

scene.onPointerObservable.add((info) => {
  if (!body) return;
  const { type, event } = info;
  if (event?.pointerType === 'xr') return xrPointer(info);
  const pickedMesh = info.pickInfo?.pickedMesh;
  const id = pickedMesh ? body.nodeOfMesh(pickedMesh) : null;
  if (type === PointerEventTypes.POINTERMOVE) {
    if (drag) return dragMove(event);
    if (event.pointerType === 'mouse') {
      body.highlight('hover', id, HOVER);
      canvas.style.cursor = id === null ? '' : picked !== null && isUnder(id, picked) ? 'grab' : 'pointer';
    }
    return;
  }
  if (type === PointerEventTypes.POINTERDOWN && event.button === 0 && event.isPrimary !== false && fingers.size <= 1) {
    const down = { x: event.clientX, y: event.clientY };
    const onChosen = picked !== null && (id !== null && isUnder(id, picked) ? info.pickInfo.pickedPoint.clone() : nearChosen(event));
    if (onChosen) {
      // On the chosen part (or close enough for a fingertip): it moves, the view doesn't.
      camera.detachControl();
      drag = { mode: 'part', down, id: picked, point: onChosen, started: false };
    } else if (id !== null) {
      // Anywhere else the camera turns as usual; if the press comes up where it went down, it was a tap.
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
        const where = body.drop(d.hold);
        note = where === 'home' ? 'Back in its place.' : '';
        refreshBar();
        render();
      } else {
        // A tap on the chosen part: the part under the finger, which may be a smaller one inside it.
        pick(id ?? d.id);
      }
    } else if (!d.moved) {
      pick(d.id);
    }
  }
});

/**
 * A press beside a thin chosen part (a nerve, a tendon, the linea alba) is still on it: within its outline on
 * screen, padded for a fingertip. Returns where on it the press lands (in the plane through its centre), or null.
 */
function nearChosen(event) {
  const pad = event.pointerType === 'touch' ? 16 : 6;
  const { lo, hi } = body.boxOf(picked);
  if (!Number.isFinite(lo.x)) return null;
  const engine = scene.getEngine();
  const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const k = canvas.clientWidth / engine.getRenderWidth();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const c = new Vector3(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z);
    const p = Vector3.Project(c, Matrix.Identity(), scene.getTransformMatrix(), vp);
    x0 = Math.min(x0, p.x * k); x1 = Math.max(x1, p.x * k);
    y0 = Math.min(y0, p.y * k); y1 = Math.max(y1, p.y * k);
  }
  const r = canvas.getBoundingClientRect();
  const x = event.clientX - r.left, y = event.clientY - r.top;
  if (x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) return null;
  const centre = lo.add(hi).scale(0.5);
  const plane = Plane.FromPositionAndNormal(centre, camera.getForwardRay().direction.scale(-1));
  const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera);
  const t = ray.intersectsPlane(plane);
  return t === null ? null : ray.origin.add(ray.direction.scale(t));
}

const isUnder = (id, group) => {
  for (let i = id; i !== null; i = body.parentOf(i)) if (i === group) return true;
  return false;
};

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
    // The part slides in the plane through where it was grabbed, facing the camera.
    const normal = camera.getForwardRay().direction.scale(-1);
    d.plane = Plane.FromPositionAndNormal(d.point, normal);
    d.hold = body.take(d.id, translation(d.point));
  }
  const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera);
  const t = ray.intersectsPlane(d.plane);
  if (t === null) return;
  body.follow(d.hold, translation(ray.origin.add(ray.direction.scale(t))));
}

// ---------------------------------------------------------------- headset: point, and take hold

const HAND_REACH = 0.03;            // m, around the hand's centre
const holds = new Map();            // controller uniqueId -> { hold, id, mc }

/** Trigger on a part: choose it (the card names it). A controller that's holding uses its trigger to climb. */
function xrPointer(info) {
  if (info.type !== PointerEventTypes.POINTERDOWN) return;
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(info.event.pointerId);
  if (controller && holds.has(controller.uniqueId)) return;
  const id = info.pickInfo?.pickedMesh ? body.nodeOfMesh(info.pickInfo.pickedMesh) : null;
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
    const at = hand.getTranslation();
    let id = body.partAt(at, HAND_REACH);
    if (id === null) {
      const mesh = rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId);
      id = mesh ? body.nodeOfMesh(mesh) : null;
    }
    if (id === null) return;
    holds.set(source.uniqueId, { hold: body.take(id, hand), id, mc });
    body.highlight(`hand-${source.uniqueId}`, id, PICKED);
    buzz(mc, 0.3, 25);
    picked = id;
    page = 'part';
    note = '';
    render();
  };
  const climbHold = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h) return;
    const up = body.parentOf(h.id);
    if (up === null || up === 0) return buzz(h.mc, 0.6, 80);
    body.drop(h.hold);
    h.id = up;
    h.hold = body.take(up, handMatrix(source));
    body.highlight(`hand-${source.uniqueId}`, up, PICKED);
    buzz(h.mc, 0.5, 40);
    picked = up;
    render();
  };
  const letGo = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h) return;
    holds.delete(source.uniqueId);
    body.highlight(`hand-${source.uniqueId}`, null);
    const where = body.drop(h.hold);
    if (where === 'home') buzz(h.mc, 0.4, 30);
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
      if (source) body.follow(h.hold, handMatrix(source));
    }
  });
  // Hovering a hand over a part lights it, so you know what a squeeze will take.
  let frame = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (!inXr() || ++frame % 6) return;
    for (const source of rig.xr.input.controllers) {
      if (holds.has(source.uniqueId)) continue;
      const at = handMatrix(source).getTranslation();
      body.highlight(`near-${source.uniqueId}`, body.partAt(at, HAND_REACH), HOVER);
    }
  });
}

// ---------------------------------------------------------------- start

async function start() {
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), loaded: !!body, meshes: scene.meshes.length }));
  const t0 = performance.now();
  const stage = (name) => headsetNote(name, { ms: Math.round(performance.now() - t0) });
  body = await loadBody(scene, stand, {
    version: MODEL_V,
    onProgress: (p) => (ui.pct.textContent = `Downloading ${Math.round(p * 100)}%`),
    onStage: (name, p, data) => {
      headsetNote(name, data);
      if (name === 'build') ui.pct.textContent = `Building ${Math.round(p * 100)}%`;
    },
  });
  for (const mat of Object.values(scene.materials)) {
    if (mat.realTimeFiltering === undefined) continue;
    mat.realTimeFiltering = true;
    mat.realTimeFilteringQuality = Constants.TEXTURE_FILTERING_QUALITY_LOW;
  }
  setLayer(layer);
  stage('layer');
  learn = await loadLearning(body, MODEL_V);
  setUpSearch();
  stage('learning');

  let refreshPresence = () => {};
  presence = createPresence(scene, {
    subject: 'bdy',
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
      rig = await createXr(scene, {
        floorMeshes: room.floors,
        start: { position: new Vector3(0, 0, 1.1), lookAt: new Vector3(0, 1.2, 0) },
        maxResolution: 1.3,
      });
    }
  } catch (err) {
    console.warn('[bdy] VR unavailable', err);
  }
  stage('xr');
  if (rig) {
    rig.camera.minZ = 0.01;
    rig.camera.maxZ = 60;
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
    let framesSinceEnter = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      // Two eyes at 72-90 Hz: the clear coat's second specular lobe is the first thing to go.
      setLite(scene, entered);
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
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  document.querySelector('.height').hidden = false;
  for (const b of [...ui.layers, ui.systems, ui.learn, ui.back]) b.disabled = false;
  refreshBar();
  render();
  stage('ready');
  engine.onEndFrameObservable.addOnce(() => stage('first frame'));
}

// ---------------------------------------------------------------- search

function setUpSearch() {
  const input = ui.search, list = ui.results;
  let hits = [], at = -1;
  const show = () => {
    list.replaceChildren(...hits.map((id, k) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `hit-${k}`;
      li.setAttribute('aria-selected', String(k === at));
      const sys = body.systems.find((s) => s.id === body.systemOf(id));
      li.innerHTML = '<span class="hit-name"></span><span class="hit-sys"></span>';
      li.firstChild.textContent = name(id);
      li.lastChild.textContent = body.nodes[id].el ? sys?.name ?? '' : `${sys?.name ?? ''} · ${partCount(id)} parts`;
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(id); });
      return li;
    }));
    list.hidden = !hits.length;
    input.setAttribute('aria-expanded', String(!!hits.length));
    if (at >= 0) input.setAttribute('aria-activedescendant', `hit-${at}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const choose = (id) => {
    hits = [];
    show();
    input.value = '';
    input.blur();
    showPart(id);
  };
  input.addEventListener('input', () => {
    hits = learn.search(input.value);
    at = hits.length ? 0 : -1;
    show();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      at = (at + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      show();
    } else if (e.key === 'Enter' && hits[at] !== undefined) {
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

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[bdy] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}

ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
for (const b of ui.layers) b.addEventListener('click', () => setLayer(b.dataset.layer));
ui.systems.addEventListener('click', () => { page = page === 'systems' ? 'part' : 'systems'; cardOpen = true; render(); });
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
  console.error('[bdy]', err);
  ui.pct.textContent = 'The body could not load.';
  ui.retry.hidden = false;
});

// For automated checks in a browser.
window.__bdy = { scene, camera, get body() { return body; }, pick, takeOut, putAllBack, setLayer, content: () => content(), startTour: (i) => startTour(TOURS[i]), startQuiz, get state() { return { page, tour: tour && { id: tour.t.id, i: tour.i, n: tour.stops.length }, quiz: quiz && { n: quiz.n, score: quiz.score, q: quiz.q && { type: quiz.q.type, name: quiz.q.name, ids: quiz.q.ids } } }; } };
