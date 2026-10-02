// vrtor Apollo 11 (/apo): float beside the real command module Columbia in lunar orbit,
// July 1969, then go inside. A guided tour goes around the outside, then in; pointing at any
// glowing marker explains that spot on its own.
// Flat screens: an orbit camera (inside, it turns in place) and an HTML card. Headset: you float
// (no floor in orbit), a floating card, and the tour moves you to each stop.
import { ArcRotateCamera, Engine, PointerEventTypes, Vector3 } from '@babylonjs/core';
import { createCard, createPresence, createXr, mountPresenceControls, presenceCard, xrPose, xrSupported } from '@vrtor/xr-shell';
import { buildSpace, createSpaceScene } from './space.js';
import { loadCapsule } from './capsule.js';
import { attachFloat } from './float.js';
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
  place: $('[data-place]'),
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = createSpaceScene(engine);
scene.skipPointerMovePicking = false;

const camera = new ArcRotateCamera('orbit', -2.2, 1.2, 7, Vector3.Zero(), scene);
camera.minZ = 0.02;
camera.maxZ = 9000;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);
/**
 * Outside, the camera circles Columbia; inside (or looking far off, at the Moon), it turns in place
 * around a point just ahead of your eyes.
 */
const LOOK_AHEAD = 0.05;
function setCameraInPlace(inPlace) {
  camera.lowerBetaLimit = 0.02;
  camera.upperBetaLimit = Math.PI - 0.02;
  camera.lowerRadiusLimit = inPlace ? 0.01 : 2.4;
  camera.upperRadiusLimit = inPlace ? 0.6 : 40;
}
setCameraInPlace(false);

const card = createCard(scene, { name: 'tour-card' });
let rig = null;
let space = null;
let capsule = null;
/** -1: welcome; 0..n-1: a stop; n: the end of the tour. */
let index = -1;
let cardOpen = true;
/** The headset card is showing the visitors page. */
let people = false;
let presence = null;

const inXr = () => !!rig?.inXr();
const XR_HOWTO = 'Point and pull the trigger to choose. Left thumbstick: float where you look. Right thumbstick: turn, or rise and sink. A or X brings this card back; B or Y joins other visitors, then turns your mic on and off.';

function content(i) {
  const n = capsule.stops.length;
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
      title: 'You have been inside Columbia',
      body: 'Float around it, go back in, or point at any glowing marker to read about it again. Three days after Collins wrote his note, Columbia splashed down in the Pacific with all three astronauts aboard.',
      fact: 'The scan: Smithsonian National Air and Space Museum. The Moon and Earth: NASA.',
      actions: [
        { label: 'Start over', onClick: () => go(0, true) },
        { label: 'Close', primary: true, onClick: close },
      ],
    };
  }
  const stop = capsule.stops[i];
  const actions = [];
  if (i > 0) actions.push({ label: 'Back', onClick: () => go(i - 1, true) });
  actions.push({ label: 'Close', onClick: close });
  actions.push({ label: i === n - 1 ? 'Finish' : 'Next', primary: true, onClick: () => go(i + 1, true) });
  const where = stop.place === 'inside' ? 'Inside' : 'Outside';
  return { kicker: `${where} · ${i + 1} of ${n}`, title: stop.title, body: stop.body, fact: stop.fact, actions };
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

/** What a stop looks at: Tranquility Base moves as the Moon turns below. */
function lookAt(stop) {
  return stop.target === 'tranquility' ? space.moon.tranquility.getAbsolutePosition().clone() : stop.at;
}

function poseNow() {
  if (!capsule) return null;
  if (inXr()) return xrPose(rig);
  // In orbit there's no ground: others see you where your view is.
  return { area: 0, head: camera.globalPosition.clone(), forward: camera.getDirection(Vector3.Forward()) };
}

/** Shows stop `i`; with `travel`, moves the viewer (or the flat-screen camera) to it. */
async function go(i, travel = false) {
  index = i;
  cardOpen = true;
  people = false;
  const stop = capsule.stops[i] ?? null;
  capsule.select(stop);
  if (travel && stop) {
    if (inXr()) {
      const eye = stop.eye;
      await rig.moveTo(eye.subtract(new Vector3(0, rig.camera.realWorldHeight || 1.6, 0)), lookAt(stop));
    } else {
      flyTo(stop);
    }
  }
  render();
}

function close() {
  cardOpen = false;
  people = false;
  capsule.select(null);
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
    card.setContent(data);
    const head = rig.headPosition();
    const stop = capsule.stops[index];
    let forward = rig.headForward();
    if (stop) {
      const to = lookAt(stop).subtract(head);
      to.y = 0;
      if (to.lengthSquared() > 0.0001) forward = to.normalize();
      // Inside, the card sits off to the side of what it describes; there's little room.
      forward = rotateY(forward, stop.place === 'inside' ? -0.75 : -0.55);
    }
    card.place(head, forward, stop?.marker ? stop.marker.position : null);
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

/** Inside or outside, from where the viewer is now. */
function currentPlace() {
  if (!capsule) return 'outside';
  const at = inXr() ? rig.headPosition() : camera.globalPosition;
  return Vector3.Distance(at, capsule.center) < 1.75 ? 'inside' : 'outside';
}

function rotateY(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
}

// Flat screens: glide the camera to a stop's eye, looking at its subject.
let flight = null;
function flyTo(stop) {
  const at = lookAt(stop);
  const inPlace = stop.place === 'inside' || !!stop.target;
  const eye = stop.eye;
  // Inside, the camera turns around a point just ahead of the eye; outside, around the subject.
  const target = inPlace ? eye.add(at.subtract(eye).normalize().scale(LOOK_AHEAD)) : at;
  const off = eye.subtract(target);
  const radius = off.length();
  setCameraInPlace(inPlace);
  flight = {
    target,
    radius,
    alpha: Math.atan2(off.z, off.x),
    beta: Math.acos(Math.max(-1, Math.min(1, off.y / radius))),
  };
}
// Markers show on the side you're on: the hatch's would otherwise float in the window, over Earth.
scene.onBeforeRenderObservable.add(() => {
  if (!capsule) return;
  const place = currentPlace();
  for (const s of capsule.stops) if (s.marker) s.marker.isVisible = s.place === place;
  const label = place === 'inside' ? 'Go outside' : 'Go inside';
  if (ui.place.textContent !== label) ui.place.textContent = label;
});
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
  if (Math.abs(da) < 0.002 && Vector3.Distance(camera.target, flight.target) < 0.002 && Math.abs(flight.radius - camera.radius) < 0.002) flight = null;
});

// Pointing: a marker grows under the pointer; a click (or trigger pull) explains its stop.
const hoverBy = new Map();
scene.onPointerObservable.add((info) => {
  if (!capsule) return;
  const { type, event } = info;
  const xrPointer = event?.pointerType === 'xr';
  if (type === PointerEventTypes.POINTERMOVE) {
    const stop = capsule.stopFor(info.pickInfo?.pickedMesh);
    const id = event?.pointerId ?? 0;
    if (xrPointer && stop && hoverBy.get(id) !== stop) pulse(id);
    hoverBy.set(id, stop);
    capsule.hover([...hoverBy.values()].find(Boolean) ?? null);
    canvas.style.cursor = !xrPointer && stop ? 'pointer' : '';
    return;
  }
  const pick = (xrPointer && type === PointerEventTypes.POINTERDOWN) || (!xrPointer && type === PointerEventTypes.POINTERTAP);
  if (!pick) return;
  if (XR_DEBUG && xrPointer) {
    lastPress = `press ${info.pickInfo?.pickedMesh?.name ?? 'nothing'}`;
    if (info.pickInfo?.pickedMesh === card.mesh) setTimeout(render, 50);
  }
  const stop = capsule.stopFor(info.pickInfo?.pickedMesh);
  if (!stop) return;
  // Pointing at a marker explains it where you are; on a flat screen the camera goes to it.
  go(capsule.stops.indexOf(stop), !inXr());
});

function pulse(pointerId) {
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(pointerId);
  controller?.motionController?.pulse(0.25, 25).catch?.(() => undefined);
}

async function start() {
  space = buildSpace(scene);
  capsule = await loadCapsule(scene, STOPS, {
    onProgress: (p) => (ui.pct.textContent = `${Math.round(p * 100)}%`),
  });
  // Earth hangs where the hatch window looks: that's where the last stop asks you to look.
  const hatch = capsule.stops.find((s) => s.id === 'window');
  space.placeEarth(hatch.at.subtract(hatch.eye));

  // The opening view: the first stop's, outside.
  const first = capsule.stops[0];
  const off = first.eye.subtract(first.at);
  camera.target.copyFrom(first.at);
  camera.radius = off.length();
  camera.alpha = Math.atan2(off.z, off.x);
  camera.beta = Math.acos(off.y / off.length());

  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'apo',
    getPose: poseNow,
    onChange: (state) => {
      refreshBar(state);
      if (inXr() && cardOpen && (people || index < 0)) card.setContent(content(index));
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  if (XR_DEBUG) window.vrtorPresence = presence;

  if (await xrSupported()) {
    rig = await createXr(scene, {
      floorMeshes: [],
      start: { position: first.eye.subtract(new Vector3(0, 1.6, 0)), lookAt: first.at },
    });
  }
  if (rig) {
    rig.camera.minZ = 0.02;
    rig.camera.maxZ = 9000;
    attachFloat(rig, scene, { center: capsule.center, range: 30 });
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    rig.mirrorPanel(card.panel, { interactive: true });
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
              capsule.select(capsule.stops[index] ?? null);
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
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[apo] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}
ui.vr.addEventListener('click', enterVr);
ui.tour.addEventListener('click', () => go(index >= 0 && index < (capsule?.stops.length ?? 0) ? index : 0, true));
ui.place.addEventListener('click', () => {
  if (!capsule) return;
  const want = currentPlace() === 'inside' ? 'outside' : 'inside';
  go(capsule.stops.findIndex((s) => s.place === want), true);
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[apo]', err);
  ui.pct.textContent = 'Could not reach lunar orbit. Reload to try again.';
});

// For automated checks in a browser.
window.__apo = { scene, card, camera, content: (i) => content(i), go: (i) => go(i, true), get capsule() { return capsule; }, get space() { return space; } };
