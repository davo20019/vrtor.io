// vrtor Wright Flyer (/fly): stand beside the real 1903 Wright Flyer on the sand at Kill Devil
// Hills, take a guided tour of how it works, lie where Orville lay, and watch the first flight.
// Pointing at any glowing marker explains that spot on its own.
// Flat screens: an orbit camera (at the pilot's place and the camera spot, it turns in place) and
// an HTML card. Headset: walk and teleport on the sand, a floating card, the tour moves you.
import { ArcRotateCamera, Engine, PointerEventTypes, Vector3 } from '@babylonjs/core';
import { createCard, createPresence, createXr, mountPresenceControls, orbitPose, presenceCard, xrPose, xrSupported } from '@vrtor/xr-shell';
import { buildWorld, createScene } from './world.js';
import { loadFlyer } from './flyer.js';
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
  fly: $('[data-fly]'),
  hint: $('.hint'),
};

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = createScene(engine);
scene.skipPointerMovePicking = false;

const camera = new ArcRotateCamera('orbit', -2.2, 1.2, 14, Vector3.Zero(), scene);
camera.minZ = 0.02;
camera.maxZ = 2400;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);
/** At the pilot's place or the photographer's spot, the camera turns in place around a point just ahead of the eyes. */
const LOOK_AHEAD = 0.05;
function setCameraInPlace(inPlace) {
  camera.lowerBetaLimit = 0.05;
  // Outside, never below the horizon looking up from under the sand.
  camera.upperBetaLimit = inPlace ? Math.PI - 0.05 : 1.52;
  camera.lowerRadiusLimit = inPlace ? 0.01 : 1.2;
  camera.upperRadiusLimit = inPlace ? 0.6 : 45;
}
setCameraInPlace(false);

const card = createCard(scene, { name: 'tour-card' });
let rig = null;
let world = null;
let flyer = null;
/** -1: welcome; 0..n-1: a stop; n: the end of the tour. */
let index = -1;
let cardOpen = true;
/** The headset card is showing the visitors page. */
let people = false;
let presence = null;
/** Seen the first flight at least once. */
let watched = false;

const inXr = () => !!rig?.inXr();
const XR_HOWTO = 'Point and pull the trigger to choose. Push the thumbstick forward to teleport across the sand; left or right to turn. A or X brings this card back; B or Y joins other visitors, then turns your mic on and off.';
const flightIndex = () => STOPS.findIndex((s) => s.action === 'fly');

function content(i) {
  const n = flyer.stops.length;
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
      title: 'You know how it flies',
      body: 'Wings, three-axis control, an engine and propellers of their own: the Wrights solved each problem separately, then made them work together. Walk around it again, watch the flight, or point at any glowing marker to read about it again.',
      fact: 'The Flyer has hung in the Smithsonian’s National Air and Space Museum in Washington since 1948.',
      actions: [
        { label: 'Start over', onClick: () => go(0, true) },
        { label: 'Close', primary: true, onClick: close },
      ],
    };
  }
  const stop = flyer.stops[i];
  const actions = [];
  if (i > 0) actions.push({ label: 'Back', onClick: () => go(i - 1, true) });
  // Flat screens close with the card's ×; the headset card has no corner button.
  if (inXr()) actions.push({ label: 'Close', onClick: close });
  if (stop.action === 'fly') {
    actions.push({ label: watched ? 'Watch again' : 'Watch it fly', primary: !watched, onClick: watchFlight });
    actions.push({ label: 'Finish', primary: watched, onClick: () => go(i + 1, true) });
  } else {
    actions.push({ label: i === n - 1 ? 'Finish' : 'Next', primary: true, onClick: () => go(i + 1, true) });
  }
  return { kicker: `Wright Flyer · ${i + 1} of ${n}`, title: stop.title, body: stop.body, fact: stop.fact, actions };
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
  if (!flyer) return null;
  return inXr() ? xrPose(rig) : orbitPose(camera, [world.ground]);
}

/** Shows stop `i`; with `travel`, moves the viewer (or the flat-screen camera) to it. */
async function go(i, travel = false) {
  index = i;
  cardOpen = true;
  people = false;
  const stop = flyer.stops[i] ?? null;
  flyer.select(stop);
  if (travel && stop) {
    if (inXr()) {
      await rig.moveTo(stop.eye.subtract(new Vector3(0, rig.camera.realWorldHeight || 1.6, 0)), stop.look);
    } else {
      flyTo(stop);
    }
  }
  render();
}

function close() {
  cardOpen = false;
  people = false;
  flyer.select(null);
  render();
}

/** Goes to where the photograph was taken, then replays the first flight. */
async function watchFlight() {
  if (!flyer || flyer.flying) return;
  const i = flightIndex();
  if (index !== i) await go(i, true);
  cardOpen = false;
  render();
  following = !inXr();
  world.liveShadows(true);
  ui.fly.disabled = true;
  flyer.fly(() => {
    watched = true;
    following = false;
    world.liveShadows(false);
    ui.fly.disabled = false;
    go(i, false);
  });
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
    const stop = flyer.stops[index];
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
/** During the replay, the flat-screen camera keeps the Flyer in view until you take over. */
let following = false;
function flyTo(stop) {
  const eye = stop.eye;
  const inPlace = !!stop.inPlace;
  // In place, the camera turns around a point just ahead of the eye; otherwise around the subject.
  const target = inPlace ? eye.add(stop.look.subtract(eye).normalize().scale(LOOK_AHEAD)) : stop.look;
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
canvas.addEventListener('pointerdown', () => {
  flight = null;
  following = false;
});
canvas.addEventListener('wheel', () => (flight = null), { passive: true });
scene.onBeforeRenderObservable.add(() => {
  if (inXr()) return;
  const k = Math.min(1, engine.getDeltaTime() / 250);
  if (following && flyer?.flying && !flight) {
    // Turn in place toward the Flyer as it goes by.
    const eye = camera.globalPosition;
    const to = flyer.root.position.add(new Vector3(0, 0.6, 0)).subtract(eye).normalize();
    const want = Math.atan2(-to.z, -to.x);
    let da = want - camera.alpha;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    camera.alpha += da * k;
    camera.beta += (Math.acos(-to.y) - camera.beta) * k;
    return;
  }
  if (!flight) return;
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
  if (!flyer) return;
  const { type, event } = info;
  const xrPointer = event?.pointerType === 'xr';
  if (type === PointerEventTypes.POINTERMOVE) {
    const stop = flyer.stopFor(info.pickInfo?.pickedMesh);
    const id = event?.pointerId ?? 0;
    if (xrPointer && stop && hoverBy.get(id) !== stop) pulse(id);
    hoverBy.set(id, stop);
    flyer.hover([...hoverBy.values()].find(Boolean) ?? null);
    canvas.style.cursor = !xrPointer && stop ? 'pointer' : '';
    return;
  }
  const pick = (xrPointer && type === PointerEventTypes.POINTERDOWN) || (!xrPointer && type === PointerEventTypes.POINTERTAP);
  if (!pick) return;
  if (XR_DEBUG && xrPointer) {
    lastPress = `press ${info.pickInfo?.pickedMesh?.name ?? 'nothing'}`;
    if (info.pickInfo?.pickedMesh === card.mesh) setTimeout(render, 50);
  }
  const stop = flyer.stopFor(info.pickInfo?.pickedMesh);
  if (!stop) return;
  // Pointing at a marker explains it where you are; on a flat screen the camera goes to it.
  go(flyer.stops.indexOf(stop), !inXr());
});

function pulse(pointerId) {
  const controller = rig?.xr.pointerSelection?.getXRControllerByPointerId(pointerId);
  controller?.motionController?.pulse(0.25, 25).catch?.(() => undefined);
}

async function start() {
  world = buildWorld(scene);
  flyer = await loadFlyer(scene, STOPS, {
    shadows: world.shadows,
    onProgress: (p) => (ui.pct.textContent = `${Math.round(p * 100)}%`),
  });
  world.liveShadows(false);

  // The opening view: the first stop's.
  const first = flyer.stops[0];
  const off = first.eye.subtract(first.at);
  camera.target.copyFrom(first.at);
  camera.radius = off.length();
  camera.alpha = Math.atan2(off.z, off.x);
  camera.beta = Math.acos(off.y / off.length());

  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: 'fly',
    getPose: poseNow,
    onChange: (state) => {
      refreshBar(state);
      if (inXr() && cardOpen && (people || index < 0)) card.setContent(content(index));
    },
  });
  refreshBar = mountPresenceControls(presence, $('.presence-controls'));
  refreshBar(presence.state);
  if (XR_DEBUG) window.vrtorPresence = presence;

  // Headset setup is optional: the tour still works on a flat screen if WebXR fails.
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, {
        floorMeshes: [world.ground],
        start: { position: new Vector3(first.eye.x, 0, first.eye.z), lookAt: first.at },
      });
    }
  } catch (err) {
    console.warn('[fly] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.02;
    rig.camera.maxZ = 2400;
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
            if (c.changes.pressed?.current && !flyer.flying) {
              cardOpen = true;
              flyer.select(flyer.stops[index] ?? null);
              render();
            }
          });
        }
      });
    });
  }

  ui.loading.hidden = true;
  ui.hint.hidden = false;
  ui.tour.disabled = ui.fly.disabled = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (err) {
    console.error('[fly] could not enter VR', err);
  } finally {
    ui.vr.disabled = false;
  }
}
ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cardOpen && !inXr()) close();
});
ui.tour.addEventListener('click', () => go(index >= 0 && index < (flyer?.stops.length ?? 0) ? index : 0, true));
ui.fly.addEventListener('click', watchFlight);

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[fly]', err);
  ui.pct.textContent = 'The Flyer could not load. Reload to try again.';
});

// For automated checks in a browser.
window.__fly = { scene, card, camera, content: (i) => content(i), go: (i) => go(i, true), watchFlight, get flyer() { return flyer; }, get world() { return world; } };
