// VRtor AI foundations (/aif): the building blocks of AI, learned with your hands, one fruit at a time.
//
//   1 Data      sort apples and oranges; each becomes a dot on the board (size across, colour up)
//   2 Neuron    a machine with two dials: size × dial + colour × dial, above 0 it says orange
//   3 Error     a tube that fills with how wrong it is; turn the dials to empty it
//   4 Learning  the real error landscape of those two dials; the ball rolls downhill (gradient descent)
//   5 Network   green apples break one straight line; add neurons until the network fences them in
//
// Every number is live (model.js). Flat screens: an orbit camera, an HTML card with the dials as
// sliders. Headset: walk or teleport between the stations, grab fruit, dial handles and the ball with
// the grip, or point and pull the trigger. A, X or the menu button brings the card back.
import {
  ArcRotateCamera,
  Color3,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';
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
import { FIRST_FRUIT, GREEN_APPLES, HUE_RANGE, HUE_RANGE_WIDE, NEW_FRUIT, isOrange, skinColor } from './data.js';
import { SORT_TABLE_TOP, STATIONS, createLab, mat } from './lab.js';
import { makeFruit } from './fruit.js';
import { createBoard } from './board.js';
import { DIAL_MAX, createMachine } from './machine.js';
import { createLandscape } from './landscape.js';
import { createNetworkView } from './network.js';
import { attachGrab } from './grab.js';
import { bestDials, createNetwork, descend, dialCount, forward, neuronError, neuronInputs, networkError, networkInputs, sigmoid, trainStep } from './model.js';
import './style.css';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'),
  retry: $('[data-retry]'),
  card: $('.card'),
  kicker: $('.card-kicker'),
  title: $('.card-title'),
  body: $('.card-body'),
  fact: $('.card-fact'),
  dials: $('.card-dials'),
  dialInputs: [...document.querySelectorAll('[data-dial]')],
  choices: $('.card-choices'),
  actions: $('.card-actions'),
  vr: $('[data-enter-vr]'),
  bar: $('.bar'),
  steps: [...document.querySelectorAll('[data-step]')],
  menu: $('[data-menu]'),
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor.set(0.93, 0.94, 0.95, 1);
scene.ambientColor = new Color3(0.3, 0.3, 0.3);
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.0;

const camera = new ArcRotateCamera('orbit', -Math.PI / 2, 1.3, 5.6, new Vector3(0, 1.3, 2.2), scene);
camera.minZ = 0.02;
camera.maxZ = 60;
camera.lowerRadiusLimit = 0.6;
camera.upperRadiusLimit = 8;
camera.lowerBetaLimit = 0.2;
camera.upperBetaLimit = 1.55;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.diffuse = Color3.FromHexString('#ffffff');
hemi.groundColor = Color3.FromHexString('#8c8a86');
hemi.specular = Color3.Black();
hemi.intensity = 0.85;
const key = new DirectionalLight('key', new Vector3(0.25, -1, 0.35).normalize(), scene);
key.position = new Vector3(-2, 8, -3);
key.intensity = 0.55;
const shadows = new ShadowGenerator(1024, key);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
shadows.bias = 0.002;
shadows.normalBias = 0.01;
key.autoCalcShadowZBounds = true;

// ---------------------------------------------------------------- the lab and its stations

const lab = createLab(scene);
for (const m of lab.shadowReceivers) m.receiveShadows = true;
const board = createBoard(scene);
const machine = createMachine(scene, { onDial: (i, v) => setDial(i, v) });
const landscape = createLandscape(scene);
landscape.ground.receiveShadows = true;
const network = createNetworkView(scene);
network.setEnabled(false);
for (const m of [...machine.root.getChildMeshes(), landscape.ball]) shadows.addShadowCaster(m, false);
machine.onDragging((on) => (on ? camera.detachControl() : camera.attachControl(canvas, true)));

/** A small stand where step 5's new fruit is shown to the network. */
const testStand = MeshBuilder.CreateCylinder('test-stand', { diameter: 0.16, height: 0.02, tessellation: 32 }, scene);
testStand.position.set(-1.05, 1.08, 2.0);
testStand.material = mat(scene, 'test-stand', '#f7f4ee');
testStand.isPickable = false;
testStand.setEnabled(false);

// ---------------------------------------------------------------- the fruit

const tableTop = STATIONS.sort.center.add(new Vector3(0, SORT_TABLE_TOP, 0));
const fruits = FIRST_FRUIT.map((f, i) => makeFruit(scene, f, i));
fruits.forEach((fr, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  fr.home = tableTop.add(new Vector3((col - 1.5) * 0.115, fr.radius, (row - 1.5) * 0.12));
  fr.root.position.copyFrom(fr.home);
  for (const m of fr.meshes) shadows.addShadowCaster(m, false);
});
let greens = [];
const basketCount = { apple: 0, orange: 0 };
/** A spot in a basket for its n-th fruit: round the middle, then a second layer. */
function basketSpot(kind, n, radius) {
  const base = lab.baskets[kind].root.position;
  const layer = Math.floor(n / 8);
  const k = n % 8;
  const r = k === 0 ? 0 : 0.085;
  const a = k * ((Math.PI * 2) / 7) + layer * 0.4;
  return base.add(new Vector3(Math.cos(a) * r, 0.012 + radius + layer * 0.07, Math.sin(a) * r));
}

/** Short moves (a fruit into its basket, back to the table). */
const tweens = new Map();
function moveTo(node, to, seconds = 0.45, lift = 0.12) {
  tweens.set(node, { from: node.position.clone(), to: to.clone(), t: 0, seconds, lift });
}
function stepTweens(dt) {
  for (const [node, tw] of tweens) {
    tw.t = Math.min(1, tw.t + dt / tw.seconds);
    const e = tw.t * tw.t * (3 - 2 * tw.t);
    Vector3.LerpToRef(tw.from, tw.to, e, node.position);
    node.position.y += Math.sin(Math.PI * tw.t) * tw.lift;
    if (tw.t >= 1) tweens.delete(node);
  }
}

// ---------------------------------------------------------------- state

const RATES = { small: { label: 'Small steps', rate: 0.4 }, good: { label: 'Good steps', rate: 2 }, big: { label: 'Too big', rate: 9 } };
/** The dials start somewhere clearly wrong, so turning them shows something. */
const START_DIALS = [-2.4, -1.6];
const state = {
  step: 0,
  page: 'step',
  selected: null,
  note: '',
  w: [...START_DIALS],
  velocity: [0, 0],
  learning: false,
  rate: 'good',
  momentum: false,
  descents: 0,
  settled: false,
  lowest: null,
  hidden: 1,
  net: createNetwork(1),
  training: 0,
  netSeed: 7,
  test: null,
  testIndex: -1,
};

const sorted = () => [...fruits, ...greens].filter((f) => f.label);
const neuronExamples = () => fruits.filter((f) => f.label).map((f) => ({ x: neuronInputs(f.fruit), y: f.label === 'orange' ? 1 : 0 }));
const networkExamples = () => sorted().map((f) => ({ x: networkInputs(f.fruit), y: f.label === 'orange' ? 1 : 0 }));
let bestLoss = null;
let bestW = null;

function sortInto(fr, kind, { quiet = false } = {}) {
  if (fr.label === kind) return;
  if (fr.label) basketCount[fr.label]--;
  fr.label = kind;
  fr.home = basketSpot(kind, basketCount[kind]++, fr.radius);
  moveTo(fr.root, fr.home);
  if (state.selected === fr) select(null);
  if (!quiet) {
    const truth = isOrange(fr.fruit.kind) ? 'orange' : 'apple';
    state.note = truth === kind
      ? ''
      : `That one is really ${truth === 'apple' ? 'an apple' : 'an orange'}. The machine will believe your label anyway: it learns whatever the examples say, mistakes included. Pick it out of the basket to sort it again.`;
  }
  dataChanged();
}
function sortRest() {
  for (const fr of fruits) if (!fr.label) sortInto(fr, isOrange(fr.fruit.kind) ? 'orange' : 'apple', { quiet: true });
}
function select(fr) {
  const was = state.selected;
  was?.highlight(false);
  if (was && !tweens.has(was.root) && was.root.parent === null) moveTo(was.root, was.home, 0.2, 0);
  state.selected = fr;
  fr?.highlight(true);
  // The chosen fruit floats up a little, so it's clear which one the card is asking about.
  if (fr) moveTo(fr.root, fr.home.add(new Vector3(0, 0.06, 0)), 0.2, 0);
  render();
}
/** The data changed: the landscape and the lowest point follow it. */
function dataChanged() {
  const ex = neuronExamples();
  if (ex.length >= 2) {
    bestW = bestDials(ex);
    bestLoss = neuronError(bestW, ex).loss;
    landscape.build((w) => neuronError(w, ex).loss);
  }
  // No landscape until there are examples to measure the error on.
  landscape.setEnabled(ex.length >= 2);
  boardDirty = true;
  render();
}

function setDial(i, v) {
  state.w[i] = Math.max(-DIAL_MAX, Math.min(DIAL_MAX, v));
  state.velocity = [0, 0];
  state.settled = false;
  dialsChanged();
}
function setDials(w, { fresh = true } = {}) {
  state.w = w.map((v) => Math.max(-DIAL_MAX, Math.min(DIAL_MAX, v)));
  state.velocity = [0, 0];
  state.settled = false;
  state.descents = 0;
  if (fresh) landscape.mark(state.w, true);
  dialsChanged();
}
let ballHeld = false;
function dialsChanged() {
  if (!ballHeld) landscape.place(state.w);
  boardDirty = true;
  machineDirty = true;
  cardDirty = true;
}

// ---------------------------------------------------------------- learning (step 4) and training (step 5)

let learnClock = 0;
function learnTick(dt) {
  if (!state.learning) return;
  learnClock += dt;
  if (learnClock < 0.11) return;
  learnClock = 0;
  const ex = neuronExamples();
  const r = descend(state.w, state.velocity, ex, RATES[state.rate].rate, state.momentum ? 0.8 : 0);
  // The dials only turn so far: a step past the end stops there.
  state.w = r.w.map((v) => Math.max(-DIAL_MAX, Math.min(DIAL_MAX, v)));
  state.velocity = r.velocity;
  state.descents++;
  landscape.mark(state.w);
  const slope = Math.hypot(...neuronError(state.w, ex).grad);
  if (slope < 0.003) {
    state.learning = false;
    state.settled = true;
    state.lowest = [...state.w];
    landscape.showLowest(state.lowest);
    render();
  } else if (state.descents >= 240) {
    state.learning = false;
    render();
  }
  dialsChanged();
}
function stepOnce() {
  state.learning = false;
  learnClock = 1;
  state.learning = true;
  learnTick(0);
  state.learning = false;
  render();
}

function resetNetwork() {
  state.net = createNetwork(state.hidden, state.netSeed);
  state.training = 1500;
  state.test = null;
  boardDirty = true;
  render();
}
function trainTick() {
  if (!state.training) return;
  const ex = networkExamples();
  let r;
  for (let i = 0; i < 12 && state.training > 0; i++, state.training--) r = trainStep(state.net, ex);
  if (r && r.loss < 0.01) state.training = 0;
  boardDirty = true;
  cardDirty = true;
  if (!state.training) render();
}

// ---------------------------------------------------------------- the board, the machine, the network

let boardDirty = true;
let machineDirty = true;
let cardDirty = false;
let boardClock = 0;
function drawBoard(dt) {
  boardClock += dt;
  if (!boardDirty || boardClock < 0.08) return;
  boardDirty = false;
  boardClock = 0;
  const s = state.step;
  const wide = s >= 5;
  let predict = null;
  if (s >= 2 && s <= 4) predict = (size, hue) => {
    const x = neuronInputs({ size, hue });
    return sigmoid(state.w[0] * x[0] + state.w[1] * x[1]);
  };
  if (s >= 5) predict = (size, hue) => forward(state.net, networkInputs({ size, hue })).out;
  const points = sorted().map((fr) => ({
    size: fr.fruit.size,
    hue: fr.fruit.hue,
    label: fr.label,
    color: skinColor(fr.fruit),
    wrong: predict ? (predict(fr.fruit.size, fr.fruit.hue) >= 0.5 ? 'orange' : 'apple') !== fr.label : false,
  }));
  const titles = {
    0: ['What the machine sees', 'Not fruit: two numbers for each one, its size and its colour'],
    1: ['What the machine sees', 'Each fruit you sort becomes a dot: across by size, up by colour'],
    2: ['What the neuron says', 'Orange where the board is orange, apple where it is red. The dashed line is where it changes its mind'],
    3: ['What the neuron says', 'Ringed fruit are the ones it gets wrong'],
    4: ['What the neuron says', 'Watch the line swing into place as the ball rolls downhill'],
    5: ['What the network says', 'Green apples are apples too, up past the oranges'],
    6: ['What the network says', 'Several lines together fence the oranges in'],
  };
  const [title, subtitle] = titles[s];
  board.draw({ title, subtitle, points, predict, hueRange: wide ? HUE_RANGE_WIDE : HUE_RANGE });
}
function showMachine() {
  if (!machineDirty) return;
  machineDirty = false;
  const ex = neuronExamples();
  const e = neuronError(state.w, ex);
  machine.show({ w: state.w, loss: e.loss, wrong: e.wrong, total: ex.length, showError: state.step >= 3, bestLoss: state.step >= 3 ? bestLoss : null });
  ui.dialInputs.forEach((input, i) => {
    if (document.activeElement !== input) input.value = state.w[i];
    input.nextElementSibling.value = state.w[i].toFixed(1);
  });
}
function showNetwork() {
  if (state.step < 5) return;
  if (state.test) {
    const x = networkInputs(state.test.fruit);
    const p = forward(state.net, x).out;
    network.show(state.net, x, `${p >= 0.5 ? 'orange' : 'apple'} ${Math.round((p >= 0.5 ? p : 1 - p) * 100)}%`);
  } else network.show(state.net);
}

// ---------------------------------------------------------------- steps

const VIEWS = {
  0: { target: new Vector3(0, 1.4, 2.3), alpha: -Math.PI / 2, beta: 1.32, radius: 5.8 },
  // Flat screens: the station sits right of centre, clear of the card on the left.
  1: { target: new Vector3(-2.65, 0.85, 1.6), alpha: -Math.PI / 2 - 0.15, beta: 0.98, radius: 1.9 },
  2: { target: new Vector3(0, 1.45, 2.6), alpha: -Math.PI / 2, beta: 1.36, radius: 3.6 },
  3: { target: new Vector3(0, 1.45, 2.6), alpha: -Math.PI / 2 + 0.12, beta: 1.36, radius: 3.6 },
  4: { target: new Vector3(2.0, 0.95, 1.6), alpha: -Math.PI / 2 + 0.1, beta: 0.92, radius: 2.7 },
  5: { target: new Vector3(-0.1, 1.5, 2.5), alpha: -Math.PI / 2, beta: 1.36, radius: 4.0 },
  6: { target: new Vector3(0, 1.5, 2.4), alpha: -Math.PI / 2, beta: 1.32, radius: 5.4 },
};
const STAND = { 0: 'intro', 1: 'sort', 2: 'machine', 3: 'machine', 4: 'landscape', 5: 'machine', 6: 'intro' };

let flight = null;
function fly(v) {
  flight = { ...v };
}
function flyStep(dt) {
  if (!flight) return;
  const k = Math.min(1, dt / 0.14);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  const da = Math.atan2(Math.sin(flight.alpha - camera.alpha), Math.cos(flight.alpha - camera.alpha));
  camera.alpha += da * k;
  camera.beta += (flight.beta - camera.beta) * k;
  camera.radius += (flight.radius - camera.radius) * k;
  if (Math.abs(da) < 0.001 && Math.abs(flight.beta - camera.beta) < 0.001 && Math.abs(camera.radius - flight.radius) < 0.005 && Vector3.Distance(camera.target, flight.target) < 0.002) flight = null;
}
canvas.addEventListener('pointerdown', () => (flight = null));
canvas.addEventListener('wheel', () => (flight = null), { passive: true });

function goTo(step) {
  grab?.dropAll();
  if (step >= 2) sortRest();
  state.step = step;
  state.page = 'step';
  state.note = '';
  state.learning = false;
  select(null);
  if (step === 4) landscape.mark(state.w, true);
  if (step >= 5 && !greens.length) addGreens();
  machine.setEnabled(step < 5);
  network.setEnabled(step >= 5);
  testStand.setEnabled(step >= 5);
  landscape.showLowest(step === 4 || step === 6 ? state.lowest : null);
  if (state.test) state.test.root.setEnabled(step >= 5);
  boardDirty = true;
  machineDirty = true;
  cardOpen = true;
  fly(VIEWS[step]);
  const st = STATIONS[STAND[step]];
  if (inXr()) rig.moveTo(st.stand, st.look).then(() => { panel.hide(); render(); });
  render();
}
function addGreens() {
  greens = GREEN_APPLES.map((f, i) => {
    const fr = makeFruit(scene, f, `g${i}`);
    fr.root.position.copyFrom(tableTop.add(new Vector3((i - 2.5) * 0.11, fr.radius, -0.26)));
    for (const m of fr.meshes) shadows.addShadowCaster(m, false);
    return fr;
  });
  greens.forEach((fr) => sortInto(fr, 'apple', { quiet: true }));
  state.hidden = 1;
  state.netSeed = 7;
  resetNetwork();
}
function showNewFruit() {
  state.test?.root.dispose();
  state.testIndex = (state.testIndex + 1) % NEW_FRUIT.length;
  const fr = makeFruit(scene, NEW_FRUIT[state.testIndex], `new${state.testIndex}`);
  fr.root.position.copyFrom(testStand.position.add(new Vector3(0, 0.01 + fr.radius * 0.95, 0)));
  for (const m of fr.meshes) m.isPickable = false;
  state.test = fr;
  render();
}

// ---------------------------------------------------------------- the card

let rig = null;
let grab = null;
let presence = null;
let panel = null;
let busy = true;
let cardOpen = true;
const inXr = () => !!rig?.inXr();
const action = (label, onClick, primary = false) => ({ label, onClick: () => { if (!busy) onClick(); }, primary });
const next = (label = 'Next') => action(label, () => goTo(state.step + 1), true);
const back = () => action('Back', () => goTo(state.step - 1));
const how = (flat, xr) => (inXr() ? xr : flat);

function stepContent() {
  const s = state.step;
  const ex = neuronExamples();
  const e = neuronError(state.w, ex);
  if (s === 0) {
    return {
      kicker: 'AI foundations',
      title: 'Teach a machine to sort fruit',
      body: 'In five short steps you build the core of modern AI with your own hands: give it examples, wire up a neuron, measure its mistakes, let it learn, then grow it into a network. All the math runs live.',
      fact: how('Drag to look around, scroll to zoom. The steps are also in the bar below.', 'Left stick: walk. Right stick: teleport and turn. Grip grabs, trigger points. A or X opens and closes this card.'),
      actions: [action('Start', () => goTo(1), true)],
    };
  }
  if (s === 1) {
    const n = fruits.filter((f) => f.label).length;
    const sel = state.selected;
    return {
      kicker: 'Step 1 of 5 · Data',
      title: sel ? 'Which basket?' : 'Sort the fruit',
      body: sel
        ? 'Is this one an apple or an orange?'
        : how(
          'Click a fruit, then its basket. Every fruit you sort becomes an example: a dot on the board, placed by its size and its colour. Those two numbers are all the machine will ever see.',
          'Grab a fruit with the grip and drop it in its basket (or point, pull the trigger, then pick the basket). Every fruit you sort becomes a dot on the board, placed by its size and its colour. Those two numbers are all the machine will ever see.',
        ),
      fact: state.note || (n === fruits.length
        ? 'All sorted. Nobody wrote a rule like "orange if the colour is above 20". Your examples are the lesson: the machine has to find the rule itself.'
        : `${n} of ${fruits.length} sorted.`),
      actions: sel
        ? [action('Apple', () => sortInto(sel, 'apple')), action('Orange', () => sortInto(sel, 'orange')), action('Cancel', () => select(null))]
        : [back(), ...(n < fruits.length ? [action('Sort the rest for me', sortRest)] : []), next()],
    };
  }
  if (s === 2) {
    return {
      kicker: 'Step 2 of 5 · A neuron',
      title: 'Turn the dials',
      body: 'This machine is a neuron. It multiplies the size by one dial and the colour by the other, and adds them up: above 0 it says orange, below 0 apple. On the board, the dashed line is where it changes its mind. Turn the dials until the fruit land on the right sides.',
      fact: `${how('Drag the gold handles, or use the sliders.', 'Grab a gold handle and slide it, or point at it and drag with the trigger.')} Wrong now: ${e.wrong} of ${ex.length}.`,
      dials: true,
      actions: [back(), next()],
    };
  }
  if (s === 3) {
    return {
      kicker: 'Step 3 of 5 · Error',
      title: 'How wrong is it?',
      body: 'Counting mistakes is too blunt: a neuron that is barely wrong and one that is sure and wrong both count as one. So it measures error instead: how surprised it is by each right answer, averaged over all the fruit. The red tube shows it. Empty it as far as you can by hand.',
      fact: `Error ${e.loss.toFixed(2)}, wrong ${e.wrong} of ${ex.length}. The green ring marks the lowest error these two dials can reach (${bestLoss?.toFixed(2)}).${e.loss - bestLoss < 0.02 ? ' You found it!' : ''}`,
      dials: true,
      actions: [back(), next()],
    };
  }
  if (s === 4) {
    const choices = [
      action(state.learning ? 'Pause' : 'Let it learn', () => {
        if (!state.learning && (state.settled || state.descents >= 240)) setDials(state.settled ? START_DIALS : state.w);
        state.learning = !state.learning;
        render();
      }, true),
      action('One step', stepOnce),
      action(RATES[state.rate].label, () => {
        state.rate = state.rate === 'small' ? 'good' : state.rate === 'good' ? 'big' : 'small';
        render();
      }),
      action(state.momentum ? 'Momentum: on' : 'Momentum: off', () => {
        state.momentum = !state.momentum;
        render();
      }),
    ];
    let status = `Step ${state.descents}: error ${e.loss.toFixed(2)}, wrong ${e.wrong} of ${ex.length}.`;
    if (state.settled) status += ' It stopped: the ground is flat here, the lowest point it can find.';
    else if (state.descents >= 240) status += state.rate === 'big' ? ' Too big a step jumps over the valley again and again.' : ' Stopped after 240 steps.';
    return {
      kicker: 'Step 4 of 5 · Learning',
      title: 'Let it roll downhill',
      body: `Every setting of the two dials has an error. Lay them all out and you get this landscape: across, the two dials; up, the error. The gold ball is your neuron right now. Learning is rolling downhill: feel the slope, take a step down, repeat. That is gradient descent. ${how('Click anywhere on the landscape to drop the ball there.', 'Grab the ball and put it anywhere, or point at the ground and pull the trigger.')}`,
      fact: `${status} This landscape is real: two dials and the error are exactly three numbers (only the tall corners are squeezed to fit).`,
      choices,
      actions: [back(), next()],
    };
  }
  if (s === 5) {
    const ex5 = networkExamples();
    const r = networkError(state.net, ex5);
    const one = state.hidden === 1;
    const test = state.test
      ? (() => {
        const p = forward(state.net, networkInputs(state.test.fruit)).out;
        const says = p >= 0.5 ? 'orange' : 'apple';
        const is = isOrange(state.test.fruit.kind) ? 'orange' : 'apple';
        return ` New fruit: it says ${says}, ${Math.round((p >= 0.5 ? p : 1 - p) * 100)}% sure. It is ${is === 'apple' ? (state.test.fruit.kind === 'green' ? 'a green apple' : 'an apple') : 'an orange'}: ${says === is ? 'right' : 'wrong'}. It never saw this one; it learned the pattern.`;
      })()
      : '';
    return {
      kicker: 'Step 5 of 5 · A network',
      title: one ? 'Green apples break it' : `${state.hidden} neurons working together`,
      body: one
        ? 'Green apples are apples too, but on the board they sit up past the oranges. One neuron can only draw one straight line, so it cannot fence the oranges in from both sides. Add neurons: each one draws its own line, and the last neuron combines their answers.'
        : `Each neuron in the middle draws its own line; the one on the right combines them. Wires are the dials: thick ones matter more, orange ones push towards orange, blue ones away. With ${dialCount(state.net)} dials the landscape has ${dialCount(state.net)} directions, which nobody can draw, but learning is the same: downhill in every direction at once.`,
      fact: `${state.training ? 'Learning… ' : ''}${state.hidden} neuron${one ? '' : 's'} in the middle, ${dialCount(state.net)} dials. Wrong: ${r.wrong} of ${ex5.length}.${test}`,
      choices: [
        action('More neurons', () => { state.hidden = Math.min(6, state.hidden + 1); resetNetwork(); }, true),
        action('Fewer neurons', () => { state.hidden = Math.max(1, state.hidden - 1); resetNetwork(); }),
        action('Learn again', () => { state.netSeed++; resetNetwork(); }),
        action('Show it a new fruit', showNewFruit),
      ],
      actions: [back(), next('Finish')],
    };
  }
  return {
    kicker: 'You built it',
    title: 'The foundations of AI',
    body: 'Data, a neuron, error, learning and a network: every AI model, chat assistants included, is made of these same parts, just far bigger, with billions of dials instead of a few. Three things people often get wrong: it is not programmed with rules, it does not keep the fruit it learned from (only the dials), and it stopped learning when the training ended.',
    fact: 'Try breaking it: in Data, put a few fruit in the wrong basket and see what the neuron learns.',
    actions: [action('Start over', () => { resetAll(); goTo(1); }), action('Change room', () => { state.page = 'rooms'; render(); }, true)],
  };
}

function resetAll() {
  for (const fr of fruits) {
    fr.label = null;
    fr.highlight(false);
  }
  basketCount.apple = 0;
  basketCount.orange = 0;
  fruits.forEach((fr, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    fr.home = tableTop.add(new Vector3((col - 1.5) * 0.115, fr.radius, (row - 1.5) * 0.12));
    moveTo(fr.root, fr.home);
  });
  for (const g of greens) g.root.dispose();
  greens = [];
  state.test?.root.dispose();
  state.test = null;
  state.testIndex = -1;
  state.lowest = null;
  setDials(START_DIALS);
  dataChanged();
}

function content() {
  if (busy) return { kicker: 'AI foundations', title: 'Setting up the lab…', body: '', fact: '', actions: [] };
  const toIntro = () => { state.page = 'step'; render(); };
  if (state.page === 'rooms') return roomsCard('aif', rig, action, toIntro);
  if (state.page === 'people' && presence) return presenceCard(presence, action, toIntro);
  return stepContent();
}
function peopleAction() {
  if (!inXr() || !presence || presence.state.status !== 'online') return [];
  const s = presence.state;
  const open = () => { state.page = 'people'; render(); };
  if (!s.joined) return [action(s.online > 1 ? `Join ${s.online - 1} here` : 'Join others', () => { presence.join(); open(); })];
  return [action(`People · ${s.here}`, open)];
}
function tools() {
  if (busy || state.page !== 'step') return [];
  return [
    ...peopleAction(),
    action('Change room', () => { state.page = 'rooms'; cardOpen = true; render(); }),
  ];
}

/** The card's place in the headset: beside the station, turned towards you. */
function placePanel() {
  const head = rig.headPosition();
  const f = rig.headForward();
  const a = -0.55;
  panel.place(head, new Vector3(f.x * Math.cos(a) + f.z * Math.sin(a), 0, -f.x * Math.sin(a) + f.z * Math.cos(a)), null, { distance: 1.0, drop: 0.25 });
}

function render() {
  cardDirty = false;
  const data = content();
  ui.steps.forEach((b) => {
    b.disabled = busy;
    b.classList.toggle('btn-primary', +b.dataset.step === state.step);
  });
  ui.menu.disabled = busy;
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) {
      panel.hide();
      return;
    }
    const wasVisible = panel.visible;
    panel.setContent({ ...data, choices: data.choices ?? [], tools: tools(), onClose: close });
    if (!wasVisible) placePanel();
    return;
  }
  panel?.hide();
  ui.card.hidden = !cardOpen;
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.body.hidden = !data.body;
  ui.fact.textContent = data.fact;
  ui.fact.hidden = !data.fact;
  ui.dials.hidden = !data.dials;
  const button = (a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn btn-primary' : 'btn';
    b.textContent = a.label;
    b.disabled = busy;
    b.addEventListener('click', a.onClick);
    return b;
  };
  ui.choices.hidden = !data.choices?.length;
  ui.choices.replaceChildren(...(data.choices ?? []).map(button));
  ui.actions.replaceChildren(...data.actions.map(button));
}
/** Only the live numbers changed: refresh the card's text without rebuilding it, a few times a second. */
let factClock = 0;
function refreshCard(dt) {
  factClock += dt;
  if (!cardDirty || factClock < 0.2) return;
  factClock = 0;
  if (inXr()) {
    render();
    return;
  }
  cardDirty = false;
  const data = content();
  ui.fact.textContent = data.fact;
  ui.title.textContent = data.title;
}
function close() {
  cardOpen = false;
  state.page = 'step';
  render();
  if (!inXr()) canvas.focus({ preventScroll: true });
}

ui.dialInputs.forEach((input, i) => input.addEventListener('input', () => setDial(i, +input.value)));

// ---------------------------------------------------------------- pointing and clicking

function fruitOf(mesh) {
  const id = mesh?.metadata?.fruit;
  if (id === undefined) return null;
  return [...fruits, ...greens].find((f) => f.id === id) ?? null;
}
scene.onPointerObservable.add((info) => {
  if (busy) return;
  const xr = info.event?.pointerType === 'xr';
  if (xr ? info.type !== PointerEventTypes.POINTERDOWN : info.type !== PointerEventTypes.POINTERTAP) return;
  const hit = xr ? info.pickInfo : scene.pick(scene.pointerX, scene.pointerY);
  if (!hit?.hit) return;
  const mesh = hit.pickedMesh;
  if (state.step === 1) {
    const fr = fruitOf(mesh);
    if (fr) return select(state.selected === fr ? null : fr);
    const kind = mesh.metadata?.basket;
    if (kind && state.selected) return sortInto(state.selected, kind);
  }
  if (state.step === 4 && mesh.metadata?.terrain) {
    state.learning = false;
    setDials(landscape.dialsAt(hit.pickedPoint));
    render();
  }
});

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-top', `${Math.round(innerHeight - ui.bar.getBoundingClientRect().top)}px`);
}).observe(ui.bar);

// ---------------------------------------------------------------- the headset's hands

function grabbables() {
  const list = [];
  if (state.step === 1) {
    for (const fr of fruits) {
      list.push({
        fr,
        reach: 0.11,
        position: () => fr.root.getAbsolutePosition(),
        grab(anchor) {
          tweens.delete(fr.root);
          fr.root.setParent(anchor);
          select(null);
        },
        move() {},
        release() {
          fr.root.setParent(null);
          const at = fr.root.getAbsolutePosition();
          for (const kind of ['apple', 'orange']) {
            const b = lab.baskets[kind].root.position;
            const flat = Math.hypot(at.x - b.x, at.z - b.z);
            if (flat < 0.26 && at.y > b.y - 0.05 && at.y < b.y + 0.45) {
              fr.root.rotation.setAll(0);
              fr.root.rotationQuaternion = null;
              if (fr.label === kind) moveTo(fr.root, fr.home, 0.3, 0.02);
              else sortInto(fr, kind);
              return;
            }
          }
          // Let go anywhere else: it goes back where it was.
          fr.root.rotationQuaternion = null;
          fr.root.rotation.setAll(0);
          moveTo(fr.root, fr.home, 0.4, 0.05);
        },
      });
    }
  }
  if (state.step >= 2 && state.step <= 4) {
    machine.handles.forEach((h, i) => {
      list.push({
        reach: 0.09,
        position: () => h.getAbsolutePosition(),
        grab() {},
        move(hand) {
          setDial(i, machine.dialFromHand(i, hand));
        },
        release() {
          render();
        },
      });
    });
  }
  if (state.step === 4) {
    list.push({
      ball: true,
      reach: 0.12,
      position: () => landscape.ball.getAbsolutePosition(),
      grab() {
        state.learning = false;
        ballHeld = true;
      },
      move(hand) {
        landscape.ball.position.copyFrom(hand);
        const w = landscape.dialsAt(hand);
        state.w = w;
        boardDirty = true;
        machineDirty = true;
        cardDirty = true;
      },
      release(hand) {
        ballHeld = false;
        setDials(landscape.dialsAt(hand));
        render();
      },
    });
  }
  return list;
}

// ---------------------------------------------------------------- start

async function start() {
  panel = createCard(scene, { name: 'aif-card', width: 0.9, height: 0.78 });
  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'aif',
    getPose: () => (inXr() ? xrPose(rig) : orbitPose(camera, lab.floors)),
    onChange: (state_) => {
      refreshBar(state_);
      if (inXr() && cardOpen && !busy) cardDirty = true;
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: lab.floors, start: { position: STATIONS.intro.stand.clone(), lookAt: STATIONS.intro.look.clone() } });
    }
  } catch (e) {
    console.warn('[aif] VR unavailable', e);
  }
  if (rig) {
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const p of panel.panels) rig.mirrorPanel(p, { interactive: true });
    grab = attachGrab(scene, rig, {
      items: grabbables,
      rayItem: (mesh) => {
        const all = grabbables();
        const fr = fruitOf(mesh);
        if (fr) return all.find((g) => g.fr === fr) ?? null;
        if (mesh.metadata?.ball) return all.find((g) => g.ball) ?? null;
        if (mesh.metadata?.dial !== undefined) return all.filter((g) => !g.fr && !g.ball)[mesh.metadata.dial] ?? null;
        return null;
      },
    });
    let frames = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      frames = entered ? 0 : -1;
      grab.dropAll();
      if (!entered) render();
    });
    // A few frames in, take the visitor to the step's station and open the card in front of them.
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (frames < 0 || ++frames < 6) return;
      frames = -1;
      cardOpen = true;
      const st = STATIONS[STAND[state.step]];
      if (state.step > 0) rig.moveTo(st.stand, st.look).then(() => { panel.hide(); render(); });
      else render();
    });
    presence.attachXr(rig.xr);
    createMenuControls(scene, rig, panel, { open: () => { cardOpen = true; panel.hide(); render(); }, close });
  }
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), step: state.step, w: state.w.map((v) => +v.toFixed(2)), sorted: sorted().length, hidden: state.hidden }));

  dataChanged();
  setDials(START_DIALS);
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
    stepTweens(dt);
    learnTick(dt);
    trainTick();
    drawBoard(dt);
    showMachine();
    showNetwork();
    refreshCard(dt);
    if (!inXr()) flyStep(dt);
  });

  // Hide the loading screen once the shaders are compiled, so nothing pops in (8 s at most). Not
  // scene.whenReadyAsync: the presence toast's texture stays unready until it first shows.
  const until = performance.now() + 8000;
  const meshes = [...fruits.flatMap((f) => f.meshes), ...machine.root.getChildMeshes(), landscape.ground, landscape.ball];
  await new Promise((done) => {
    const check = () => (meshes.every((m) => m.isReady(true)) || performance.now() > until ? done() : setTimeout(check, 100));
    check();
  });
  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  busy = false;
  const asked = +new URLSearchParams(location.search).get('step');
  goTo(asked >= 1 && asked <= 6 ? asked : 0);
}

ui.steps.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.step)));
ui.menu.addEventListener('click', () => { cardOpen = !cardOpen || state.page !== 'step'; state.page = 'step'; render(); });
ui.vr.addEventListener('click', async () => {
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (e) {
    console.warn('[aif] Enter VR failed', e);
  } finally {
    ui.vr.disabled = false;
  }
});
ui.retry.addEventListener('click', () => location.reload());
$('.card-close').addEventListener('click', close);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
  if (e.target.matches?.('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') { cardOpen = !cardOpen; state.page = 'step'; render(); }
  if (e.key === 'ArrowRight' && state.step < 6) goTo(state.step + 1);
  if (e.key === 'ArrowLeft' && state.step > 0) goTo(state.step - 1);
});
window.addEventListener('resize', () => engine.resize());
engine.runRenderLoop(() => scene.render());
if (new URLSearchParams(location.search).has('xrdebug')) window.aif = { scene, camera, state, fruits, goTo, sortInto, sortRest, setDials, select, render };
render();
start().catch((e) => {
  console.error('[aif]', e);
  $('.loading-pct').textContent = 'The lab could not load. Please try again.';
  ui.retry.hidden = false;
});
