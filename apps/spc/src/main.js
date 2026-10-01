// vrtor Space (/spc): stand next to NASA's Perseverance rover on Mars and
// learn what each part does. A guided tour walks through the parts in order;
// pointing at any part (or its marker) explains it on its own.
// Flat screens: orbit camera and an HTML card. Headset: teleport, a floating
// card, and the tour moves you to each part.
import { ArcRotateCamera, Engine, PointerEventTypes, Vector3 } from '@babylonjs/core';
import { createCard, createXr, xrSupported } from '@vrtor/xr-shell';
import { createMarsScene, buildMars, freezeShadows } from './mars.js';
import { loadRover } from './rover.js';
import { PARTS, WELCOME } from './parts.js';
import { createWind } from './wind.js';
import './style.css';

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
  tour: $('[data-tour]'),
  sound: $('[data-sound]'),
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = createMarsScene(engine);
scene.skipPointerMovePicking = false;

// Flat-screen camera: orbit around the rover.
const START_EYE = new Vector3(5.2, 2.1, 5.6);
const LOOK_AT = new Vector3(0, 1, 0);
const camera = new ArcRotateCamera('orbit', 0, 1, 6, LOOK_AT.clone(), scene);
camera.setPosition(START_EYE);
camera.minZ = 0.05;
camera.lowerRadiusLimit = 1.2;
camera.upperRadiusLimit = 30;
camera.lowerBetaLimit = 0.15;
camera.upperBetaLimit = 1.5;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);

const wind = createWind();
const card = createCard(scene, { name: 'tour-card' });
let rig = null;
let rover = null;
/** -1: welcome; 0..n-1: a part; n: the end of the tour. */
let index = -1;
let cardOpen = true;

const inXr = () => !!rig?.inXr();
const XR_HOWTO = 'Point and pull the trigger to choose. Push the thumbstick forward to teleport, left or right to turn. A or X brings this card back.';

function content(i) {
  const n = rover.stops.length;
  if (i < 0) {
    // In a headset's browser, going into VR is the point: it's the main action.
    const actions = rig && !inXr()
      ? [
          { label: 'Tour here', onClick: () => go(0, true) },
          { label: 'Enter VR', primary: true, onClick: enterVr },
        ]
      : [
          { label: 'Explore', onClick: close },
          { label: 'Start the tour', primary: true, onClick: () => go(0, true) },
        ];
    return { ...WELCOME, fact: inXr() ? XR_HOWTO : WELCOME.fact, actions };
  }
  if (i >= n) {
    return {
      kicker: 'Tour complete',
      title: 'You know Perseverance',
      body: 'Walk around it and point at any part to read about it again. Every glowing marker is a stop on the tour.',
      fact: WELCOME.fact,
      actions: [
        { label: 'Start over', onClick: () => go(0, true) },
        { label: 'Close', primary: true, onClick: close },
      ],
    };
  }
  const { part } = rover.stops[i];
  const actions = [];
  if (i > 0) actions.push({ label: 'Back', onClick: () => go(i - 1, true) });
  actions.push({ label: 'Close', onClick: close });
  actions.push({ label: i === n - 1 ? 'Finish' : 'Next', primary: true, onClick: () => go(i + 1, true) });
  return { kicker: `Part ${i + 1} of ${n}`, title: part.title, body: part.body, fact: part.fact, actions };
}

/** Shows stop `i`; with `travel`, moves the viewer (or the orbit camera) to look at it. */
async function go(i, travel = false) {
  wind.start();
  index = i;
  cardOpen = true;
  const stop = rover.stops[i] ?? null;
  rover.select(stop);
  if (travel && stop) {
    if (inXr()) await rig.moveTo(stop.stand, stop.at);
    else flyTo(stop);
  }
  render();
}

function close() {
  cardOpen = false;
  rover.select(null);
  render();
}

const XR_DEBUG = new URLSearchParams(location.search).has('xrdebug');
let lastPress = '';

function render() {
  const data = content(index);
  // `?xrdebug`: the headset's resolution, frame rate and the last press, in the card's kicker.
  if (XR_DEBUG && inXr()) data.kicker = `${rig.stats()}${lastPress ? ` · ${lastPress}` : ''}`;
  // Headset: the card floats beside the part, a little to the left, with a line to it.
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent(data);
    const head = rig.headPosition();
    const stop = rover.stops[index];
    let forward = rig.headForward();
    if (stop) {
      const toPart = stop.at.subtract(head);
      toPart.y = 0;
      if (toPart.lengthSquared() > 0.01) forward = toPart.normalize();
      forward = rotateY(forward, -0.55);
    }
    card.place(head, forward, stop?.at ?? null);
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
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

function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
}

// Flat screens: glide the orbit camera to look at a part from where you'd stand.
let flight = null;
function flyTo(stop) {
  const eye = stop.stand.add(new Vector3(0, 1.55, 0));
  const off = eye.subtract(stop.at);
  const radius = Math.max(off.length() * 1.35, 2.6);
  flight = {
    target: stop.at.clone(),
    radius,
    alpha: Math.atan2(off.z, off.x),
    beta: Math.min(camera.upperBetaLimit, Math.acos(off.y / off.length())),
  };
}
canvas.addEventListener('pointerdown', () => (flight = null));
canvas.addEventListener('wheel', () => (flight = null), { passive: true });
scene.onBeforeRenderObservable.add(() => {
  if (!flight || inXr()) return;
  const k = Math.min(1, engine.getDeltaTime() / 250);
  Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
  let da = flight.alpha - camera.alpha;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  camera.alpha += da * k;
  camera.beta += (flight.beta - camera.beta) * k;
  camera.radius += (flight.radius - camera.radius) * k;
  if (Math.abs(da) < 0.002 && Vector3.Distance(camera.target, flight.target) < 0.005 && Math.abs(flight.radius - camera.radius) < 0.01) flight = null;
});

// Pointing: hover tints a part; a click (or trigger pull) explains it.
const hoverBy = new Map();
scene.onPointerObservable.add((info) => {
  if (!rover) return;
  const { type, event } = info;
  const xrPointer = event?.pointerType === 'xr';
  if (type === PointerEventTypes.POINTERMOVE) {
    const stop = rover.stopFor(info.pickInfo?.pickedMesh);
    const id = event?.pointerId ?? 0;
    if (xrPointer && stop && hoverBy.get(id) !== stop) pulse(id);
    hoverBy.set(id, stop);
    rover.hover([...hoverBy.values()].find(Boolean) ?? null);
    canvas.style.cursor = !xrPointer && stop ? 'pointer' : '';
    return;
  }
  const pick = (xrPointer && type === PointerEventTypes.POINTERDOWN) || (!xrPointer && type === PointerEventTypes.POINTERTAP);
  if (!pick) return;
  if (XR_DEBUG && xrPointer) {
    const uv = info.pickInfo?.getTextureCoordinates();
    lastPress = `press ${info.pickInfo?.pickedMesh?.name ?? 'nothing'}${uv ? ` (${uv.x.toFixed(2)},${uv.y.toFixed(2)})` : ''}`;
    if (info.pickInfo?.pickedMesh === card.mesh) setTimeout(render, 50);
  }
  const stop = rover.stopFor(info.pickInfo?.pickedMesh);
  if (!stop) return;
  const i = rover.stops.indexOf(stop);
  // Pointing at a part shows it where you are; on a flat screen the camera turns to it.
  go(i, !inXr());
});

function pulse(pointerId) {
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(pointerId);
  controller?.motionController?.pulse(0.25, 25).catch?.(() => undefined);
}

async function start() {
  const env = await buildMars(scene);
  rover = await loadRover(scene, PARTS, {
    shadows: env.shadows,
    onProgress: (p) => (ui.pct.textContent = `${Math.round(p * 100)}%`),
  });
  freezeShadows(env.shadows);

  if (await xrSupported()) {
    rig = await createXr(scene, {
      floorMeshes: [env.ground],
      start: { position: new Vector3(2.6, 0, 3.6), lookAt: new Vector3(0, 1, 0) },
    });
  }
  if (rig) {
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    // In the headset the card is its own compositor layer: text sampled once, at display resolution.
    rig.mirrorPanel(card.panel, { interactive: true });
    let framesSinceEnter = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      framesSinceEnter = entered ? 0 : -1;
      if (!entered) render();
    });
    // The head pose is real a few frames in: place the card then.
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
          const button = mc.getComponent(id);
          button?.onButtonStateChangedObservable.add((c) => {
            if (c.changes.pressed?.current) {
              cardOpen = true;
              rover.select(rover.stops[index] ?? null);
              render();
            }
          });
        }
      });
    });
  }

  ui.loading.hidden = true;
  ui.hint.hidden = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  wind.start();
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[spc] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}
ui.vr.addEventListener('click', enterVr);
ui.tour.addEventListener('click', () => go(index >= 0 && index < (rover?.stops.length ?? 0) ? index : 0, true));
ui.sound.addEventListener('click', () => {
  const on = wind.toggle();
  ui.sound.setAttribute('aria-pressed', String(on));
  ui.sound.textContent = on ? 'Sound on' : 'Sound off';
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[spc]', err);
  ui.pct.textContent = 'Could not load Mars. Reload to try again.';
});

// For automated checks in a browser.
window.__spc = { scene, card, content: (i) => content(i), get rover() { return rover; } };
