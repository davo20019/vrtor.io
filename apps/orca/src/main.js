// VRtor Orca (/orca): walk around the real skeleton of an adult male killer whale, take a guided
// tour of how a whale is built, put its skin back on (see-through, then solid), compare it with a
// bottlenose dolphin, and listen to orcas calling. Pointing at any glowing marker explains it.
// Flat screens: an orbit camera and an HTML card. Headset: walk and teleport around the gallery,
// a floating card, the tour moves you.
import { ArcRotateCamera, Engine, PointerEventTypes, Vector3 } from '@babylonjs/core';
import { createCard, createPresence, createXr, mountPresenceControls, orbitPose, presenceCard, xrPose, xrSupported } from '@vrtor/xr-shell';
import { buildWorld, createScene, HALL } from './world.js';
import { loadAnimals } from './animals.js';
import { STOPS, WELCOME } from './stops.js';
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
  skin: $('[data-skin]'),
  listen: $('[data-listen]'),
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = createScene(engine);
scene.skipPointerMovePicking = false;

const camera = new ArcRotateCamera('orbit', 0.9, 1.3, 9, new Vector3(0, 1.4, 0), scene);
camera.minZ = 0.02;
camera.maxZ = 200;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.lowerBetaLimit = 0.08;
// Never below the floor looking up through it.
camera.upperBetaLimit = 1.62;
camera.lowerRadiusLimit = 0.6;
camera.upperRadiusLimit = 16;
camera.attachControl(canvas, true);

const card = createCard(scene, { name: 'tour-card' });
let rig = null;
let world = null;
let animals = null;
/** -1: welcome; 0..n-1: a stop; n: the end of the tour. */
let index = -1;
let cardOpen = true;
/** The headset card is showing the visitors page. */
let people = false;
let presence = null;

const inXr = () => !!rig?.inXr();
const XR_HOWTO = 'Point and pull the trigger to choose. Push the thumbstick forward to teleport around the gallery; left or right to turn. A or X brings this card back; B or Y joins other visitors, then turns your mic on and off.';

// The recording: U.S. National Park Service, Glacier Bay (public domain).
const audio = new Audio(`${import.meta.env.BASE_URL}audio/glacier-bay-orcas.mp3`);
audio.preload = 'none';
const listening = () => !audio.paused;
audio.addEventListener('play', refreshButtons);
audio.addEventListener('pause', refreshButtons);
audio.addEventListener('ended', refreshButtons);
function toggleListen() {
  if (listening()) {
    audio.pause();
    audio.currentTime = 0;
  } else {
    audio.play().catch((err) => console.warn('[orca] could not play', err));
  }
}

/** The skin goes bones, see-through, solid, then back to bones. */
const NEXT_SKIN = { bones: 'see-through', 'see-through': 'solid', solid: 'bones' };
const SKIN_LABEL = { 'see-through': 'Put the skin back', solid: 'Make it solid', bones: 'Bones only' };
function nextSkin() {
  if (!animals) return;
  animals.setSkin(NEXT_SKIN[animals.skinMode], () => world.refreshShadows());
  refreshButtons();
  if (cardOpen) render();
}

function refreshButtons() {
  if (animals) ui.skin.textContent = SKIN_LABEL[NEXT_SKIN[animals.skinMode]];
  ui.listen.textContent = listening() ? 'Stop the calls' : 'Hear orcas call';
  ui.listen.setAttribute('aria-pressed', String(listening()));
  if (inXr() && cardOpen) render();
}

function content(i) {
  const n = animals.stops.length;
  if (people && presence) {
    return presenceCard(presence, (label, onClick, primary = false) => ({ label, onClick, primary }), () => {
      people = false;
      render();
    });
  }
  if (i < 0) {
    const actions = rig && !inXr()
      ? [
          { label: 'Tour here', onClick: () => go(0, true) },
          { label: 'Enter VR', primary: true, onClick: enterVr },
        ]
      : [
          { label: 'Explore', onClick: close },
          { label: 'Start the tour', primary: true, onClick: () => go(0, true) },
          ...peopleAction(),
        ];
    return { ...WELCOME, fact: inXr() ? XR_HOWTO : WELCOME.fact, actions };
  }
  if (i >= n) {
    return {
      kicker: 'Tour complete',
      title: 'A mammal built for the sea',
      body: 'Nose on top, a hand in each flipper, a neck pressed flat, a chest that folds and a backbone that drives the tail up and down: the orca still carries the plan of a land mammal, reshaped for the water. Walk around it again, switch its skin on and off, or point at any glowing marker.',
      fact: 'The skeleton is in the Cetacean Gallery of the University of Pisa’s Natural History Museum, in Calci, Italy.',
      actions: [
        { label: 'Start over', onClick: () => go(0, true) },
        { label: 'Close', primary: true, onClick: close },
      ],
    };
  }
  const stop = animals.stops[i];
  const actions = [];
  if (i > 0) actions.push({ label: 'Back', onClick: () => go(i - 1, true) });
  // Flat screens close with the card's ×; the headset card has no corner button.
  if (inXr()) actions.push({ label: 'Close', onClick: close });
  if (stop.action === 'skin') actions.push({ label: SKIN_LABEL[NEXT_SKIN[animals.skinMode]], onClick: nextSkin });
  if (stop.action === 'listen') actions.push({ label: listening() ? 'Stop' : 'Listen', primary: !listening(), onClick: toggleListen });
  actions.push({ label: i === n - 1 ? 'Finish' : 'Next', primary: stop.action !== 'listen' || listening(), onClick: () => go(i + 1, true) });
  return { kicker: `Orca · ${i + 1} of ${n}`, title: stop.title, body: stop.body, fact: stop.fact, actions };
}

// In the headset the bar isn't visible: its buttons are a strip under the card.
function tools() {
  if (people) return [];
  // A stop that has the skin or the calls as its own button doesn't repeat it.
  const action = animals.stops[index]?.action;
  const list = [];
  if (action !== 'skin') list.push({ label: SKIN_LABEL[NEXT_SKIN[animals.skinMode]], onClick: nextSkin });
  if (action !== 'listen') list.push({ label: listening() ? 'Stop the calls' : 'Hear orcas call', onClick: toggleListen });
  return list;
}

// In the headset the bar isn't visible, so visitors are a page of the card.
function peopleAction() {
  if (!inXr() || !presence || presence.state.status !== 'online') return [];
  const s = presence.state;
  const open = () => {
    people = true;
    render();
  };
  if (!s.joined) {
    const label = s.online > 1 ? `Join ${s.online - 1} here` : 'Join others';
    return [{ label, onClick: () => { presence.join(); open(); } }];
  }
  return [{ label: `People · ${s.here}`, onClick: open }];
}

function poseNow() {
  if (!animals) return null;
  return inXr() ? xrPose(rig) : orbitPose(camera, world.floors);
}

/** Shows stop `i`; with `travel`, moves the viewer (or the flat-screen camera) to it. */
async function go(i, travel = false) {
  index = i;
  cardOpen = true;
  people = false;
  const stop = animals.stops[i] ?? null;
  animals.select(stop);
  if (travel && stop) {
    if (inXr()) {
      await rig.moveTo(new Vector3(stop.eye.x, 0, stop.eye.z), stop.look);
    } else {
      flyTo(stop);
    }
  }
  render();
}

function close() {
  cardOpen = false;
  people = false;
  animals.select(null);
  render();
}

const XR_DEBUG = new URLSearchParams(location.search).has('xrdebug');
let lastPress = '';

function render() {
  const data = content(index);
  if (XR_DEBUG && inXr()) data.kicker = `${rig.stats()}${lastPress ? ` · ${lastPress}` : ''}`;
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: tools() });
    const head = rig.headPosition();
    const stop = animals.stops[index];
    let forward = rig.headForward();
    if (stop) {
      const to = stop.look.subtract(head);
      to.y = 0;
      if (to.lengthSquared() > 0.0001) forward = to.normalize();
      // The card sits off to the side of what it describes.
      forward = rotateY(forward, -0.55);
    }
    card.place(head, forward, stop?.marker ? stop.marker.getAbsolutePosition() : null);
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

// Flat screens: glide the camera to a stop's eye, looking at its subject.
let flight = null;
function flyTo(stop) {
  const off = stop.eye.subtract(stop.look);
  const radius = off.length();
  flight = {
    target: stop.look,
    radius,
    alpha: Math.atan2(off.z, off.x),
    beta: Math.acos(Math.max(-1, Math.min(1, off.y / radius))),
  };
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
// Keep the orbit camera inside the gallery.
scene.onAfterRenderObservable.add(() => {
  if (inXr()) return;
  const p = camera.position;
  const margin = 0.4;
  const hx = HALL.width / 2 - margin;
  const hz = HALL.length / 2 - margin;
  if (Math.abs(p.x) > hx || Math.abs(p.z) > hz || p.y > HALL.height - margin) {
    camera.radius = Math.max(camera.lowerRadiusLimit, camera.radius * 0.97);
  }
});

// Pointing: a marker grows under the pointer; a click (or trigger pull) explains its stop.
const hoverBy = new Map();
scene.onPointerObservable.add((info) => {
  if (!animals) return;
  const { type, event } = info;
  const xrPointer = event?.pointerType === 'xr';
  if (type === PointerEventTypes.POINTERMOVE) {
    const stop = animals.stopFor(info.pickInfo?.pickedMesh);
    const id = event?.pointerId ?? 0;
    if (xrPointer && stop && hoverBy.get(id) !== stop) pulse(id);
    hoverBy.set(id, stop);
    animals.hover([...hoverBy.values()].find(Boolean) ?? null);
    canvas.style.cursor = !xrPointer && stop ? 'pointer' : '';
    return;
  }
  const pick = (xrPointer && type === PointerEventTypes.POINTERDOWN) || (!xrPointer && type === PointerEventTypes.POINTERTAP);
  if (!pick) return;
  if (XR_DEBUG && xrPointer) {
    lastPress = `press ${info.pickInfo?.pickedMesh?.name ?? 'nothing'}`;
    if (info.pickInfo?.pickedMesh === card.mesh) setTimeout(render, 50);
  }
  const stop = animals.stopFor(info.pickInfo?.pickedMesh);
  if (!stop) return;
  // Pointing at a marker explains it where you are; on a flat screen the camera goes to it.
  go(animals.stops.indexOf(stop), !inXr());
});

function pulse(pointerId) {
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(pointerId);
  controller?.motionController?.pulse(0.25, 25).catch?.(() => undefined);
}

async function start() {
  world = buildWorld(scene);
  animals = await loadAnimals(scene, STOPS, {
    shadows: world.shadows,
    platform: (...args) => world.floors.push(world.platform(...args)),
    onProgress: (p) => (ui.pct.textContent = `${Math.round(p * 100)}%`),
  });
  world.refreshShadows();

  // The opening view: the first stop's.
  const first = animals.stops[0];
  const off = first.eye.subtract(first.at);
  camera.target.copyFrom(first.at);
  camera.radius = off.length();
  camera.alpha = Math.atan2(off.z, off.x);
  camera.beta = Math.acos(off.y / off.length());

  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'orca',
    getPose: poseNow,
    onChange: (state) => {
      refreshBar(state);
      if (inXr() && cardOpen && (people || index < 0)) card.setContent({ ...content(index), tools: tools() });
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  if (XR_DEBUG) window.vrtorPresence = presence;

  // Headset setup is optional: the tour still works on a flat screen if WebXR fails.
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, {
        floorMeshes: world.floors,
        start: { position: new Vector3(first.eye.x, 0, first.eye.z), lookAt: first.at },
      });
    }
  } catch (err) {
    console.warn('[orca] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.02;
    rig.camera.maxZ = 200;
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
    // A or X: bring the card back in front of you.
    rig.xr.input.onControllerAddedObservable.add((source) => {
      source.onMotionControllerInitObservable.add((mc) => {
        for (const id of ['a-button', 'x-button']) {
          mc.getComponent(id)?.onButtonStateChangedObservable.add((c) => {
            if (c.changes.pressed?.current) {
              cardOpen = true;
              animals.select(animals.stops[index] ?? null);
              render();
            }
          });
        }
      });
    });
  }

  ui.loading.hidden = true;
  ui.hint.hidden = false;
  ui.tour.disabled = ui.skin.disabled = ui.listen.disabled = false;
  refreshButtons();
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[orca] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}
ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cardOpen && !inXr()) close();
});
ui.tour.addEventListener('click', () => go(index >= 0 && index < (animals?.stops.length ?? 0) ? index : 0, true));
ui.skin.addEventListener('click', nextSkin);
ui.listen.addEventListener('click', toggleListen);

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[orca]', err);
  ui.pct.textContent = 'The skeleton could not load. Reload to try again.';
});

// For automated checks in a browser.
window.__orca = { scene, card, camera, content: (i) => content(i), go: (i) => go(i, true), nextSkin, get animals() { return animals; }, get world() { return world; } };
