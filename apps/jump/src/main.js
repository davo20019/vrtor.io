// VRtor Parachute (/jump, unlisted): a solo jump over Interlaken. Sit in the open door of a
// hovering EC135 at 4,000 m above sea level, the pilot and two other jumpers behind you; jump,
// fly your body in freefall, pull at 1,500 m, take the toggles and fly the canopy down to the
// target on the Hohematte, then flare.
// The world is swisstopo's (terrain.js); the physics is physics.js; the helicopter is a modified
// CC BY model (helicopter.js); the canopy and sound are made in code.
//
// Headset: trigger on Jump. Freefall: your body turns to where you look (the view itself is
// never turned for you: that's what makes people sick), both hands down by the hips tracks
// forward; reach to your hip and squeeze a grip to pull. Canopy: squeeze both grips to take the
// toggles; pull a hand down to turn (turn your body to follow the canopy round), both down to
// slow and to flare.
// Flat screens: Space jumps, pulls and flares; arrows or A/D turn; W tracks; S flares.
import {
  Color3, Color4, DirectionalLight, DynamicTexture, Engine, HemisphericLight, KhronosTextureContainer2, Matrix, Mesh, MeshBuilder,
  Quaternion, ReflectionProbe, RenderTargetTexture, Scene, StandardMaterial, UniversalCamera, Vector3, VertexBuffer,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createCard, createXr, startHeadsetLog, xrSupported } from '@vrtor/xr-shell';
import { buildTerrain } from './terrain.js';
import { buildBuildings } from './buildings.js';
import { createJumper, createWind, rateLanding } from './physics.js';
import { createCanopy } from './canopy.js';
import { createHelicopter } from './helicopter.js';
import { createBody } from './body.js';
import { createDropzone } from './dropzone.js';
import { createAudio } from './audio.js';
import { createAltimeter } from './altimeter.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
// Self-hosted KTX2 transcoders (public/ktx2); textures stay GPU-compressed on every device.
const ktx2 = (file) => new URL(`${BASE}ktx2/${file}`, location.href).href;
KhronosTextureContainer2.URLConfig = {
  ...KhronosTextureContainer2.URLConfig,
  jsDecoderModule: ktx2('babylon.ktx2Decoder.js'),
  jsMSCTranscoder: ktx2('msc_basis_transcoder.js'),
  wasmMSCTranscoder: ktx2('msc_basis_transcoder.wasm'),
  wasmZSTDDecoder: ktx2('zstddec.wasm'),
};

const params = new URLSearchParams(location.search);
const debug = { chase: null, look: null };
/** Exit height above the landing: about 4,000 m above sea level. */
const EXIT = 3430;
/** Pull by here; the automatic opener fires at AAD if you haven't. */
const PULL = 1500;
const AAD = 750;
/** The target, on the open grass of the Hohematte (local east, north in m). */
const TARGET = { x: 95, z: -60 };
/** The Eiger's summit, to face from the door. */
const EIGER = new Vector3(11250, 3400, -12140);
const EYE = 1.7;
/** Sitting on the cabin floor in the door, your eyes are this high above it. */
const SEATED_EYE = 0.8;
/** The push you leave the door with: out, and a little up (m/s). */
const PUSH_OUT = 1.8;
const PUSH_UP = 0.4;
/** `?turn=1`: under the canopy the headset's view turns with the canopy (off: you turn yourself). */
const TURN_VIEW = params.get('turn') === '1';
/** Debug only: `?speed=4` runs the jump four times faster. */
const TIME_SCALE = Math.min(8, Math.max(0.25, Number(params.get('speed')) || 1));

const $ = (sel) => document.querySelector(sel);
const ui = {
  loading: $('.loading'), pct: $('.loading-pct'), readout: $('.readout'), vr: $('[data-enter-vr]'),
  action: $('[data-action]'), hint: $('.hint'), card: $('.card'), cardTitle: $('.card-title'), cardBody: $('.card-body'),
  cardFact: $('.card-fact'), cardActions: $('.card-actions'),
};

const engine = new Engine($('#scene'), true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
const HAZE = Color3.FromHexString('#b9c9d8');
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 1.6e-5;
scene.fogColor = HAZE;
scene.clearColor = new Color4(HAZE.r, HAZE.g, HAZE.b, 1);
// Draw order: sky (0), terrain (1, its own logarithmic depth), then everything near you (2) over
// it with a fresh depth buffer. From the air nothing near you is ever behind the ground, and the
// canopy, lines and hands never fight 100 km of terrain for depth precision.
// (The observer can run after a mesh's own setup, so the sky and terrain are left out by name.)
scene.onNewMeshAddedObservable.add((mesh) => {
  if (mesh.renderingGroupId === 0 && mesh.name !== 'sky' && !mesh.name.startsWith('terrain-')) mesh.renderingGroupId = 2;
});
const SUN = new Vector3(0.2, 0.75, -0.62).normalize();
const sky = createSky(scene);
// The sky, captured once, lights metal and gloss (image-based lighting): without it metallic surfaces,
// like the altimeter's anodised case, render black.
const skyProbe = new ReflectionProbe('sky-probe', 128, scene);
skyProbe.renderList.push(sky);
skyProbe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = skyProbe.cubeTexture;
scene.environmentIntensity = 0.6;
const hemi = new HemisphericLight('sky-light', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.75;
hemi.diffuse = Color3.FromHexString('#dfe9f5');
hemi.groundColor = Color3.FromHexString('#6f7a5c');
const sun = new DirectionalLight('sun', SUN.scale(-1), scene);
sun.intensity = 2.4;
sun.diffuse = Color3.FromHexString('#fff4e2');

const camera = new UniversalCamera('eye', new Vector3(0, EXIT + EYE, 0), scene);
camera.minZ = 0.05;
camera.maxZ = 300000;
camera.fov = 1.0;
camera.inertia = 0.6;
camera.angularSensibility = 1500;
// The keyboard flies the jump, it doesn't walk the camera.
camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [];
camera.attachControl(true);

const audio = createAudio();
let heli = null;
let body = null;
const canopy = createCanopy(scene);
canopy.root.setEnabled(false);
let terrain = null;
let dropzone = null;
let rig = null;
let card = null;
let wind = null;
let jumper = null;
const inXr = () => !!rig?.inXr();
const active = () => (inXr() ? rig.camera : camera);

/** Per-jump bookkeeping: what has been said and beeped, times, the flat-screen toggles. */
let jump = null;
const log = startHeadsetLog(() => ({
  phase: jumper?.state.phase,
  agl: jumper ? Math.round(jumper.aboveGround()) : null,
  vy: jumper ? +jumper.state.vel.y.toFixed(1) : null,
  vh: jumper ? +Math.hypot(jumper.state.vel.x, jumper.state.vel.z).toFixed(1) : null,
  brakes: jumper ? [+jumper.state.brakeL.toFixed(2), +jumper.state.brakeR.toFixed(2)] : null,
  stowed: jumper?.state.stowed,
  fps: Math.round(engine.getFps()),
  xr: inXr() ? rig.stats() : 'flat',
  audio: audio.running,
}));

function newJump() {
  // A fresh breeze from the west-southwest, 1.5 to 4.5 m/s on the ground.
  const from = 225 + Math.random() * 60;
  wind = createWind({ ground: 1.5 + Math.random() * 3, from, seed: Math.random() * 10 });
  jumper = createJumper({ groundAt: terrain.groundAt, reference: terrain.meta.referenceElevation, wind });
  // Exit upwind of the target, so freefall and canopy drift carry you back toward it.
  const toward = { x: -Math.sin((from * Math.PI) / 180), z: -Math.cos((from * Math.PI) / 180) };
  const spot = new Vector3(TARGET.x - toward.x * 420, EXIT, TARGET.z - toward.z * 420);
  const facing = Math.atan2(EIGER.x - spot.x, EIGER.z - spot.z);
  heli.place(spot, facing - Math.PI / 2);
  heli.setVisible(true);
  const seat = heli.seatPoint();
  jumper.reset({ x: seat.x, y: seat.y, z: seat.z }, facing);
  jump = { said: new Set(), freefallFrom: 0, canopyFrom: 0, keys: { left: 0, right: 0 }, result: null, lowered: 0 };
  placeViewer(seat, facing, true);
  bodyYaw = facing;
  showCard();
  log.note('new jump', { windFrom: Math.round(from), windGround: +wind.ground.toFixed(1) });
}

/** Puts the viewer at `feet`, facing `heading`: standing, or sitting on the floor there. */
function placeViewer(feet, heading, seated = false) {
  const look = feet.add(new Vector3(Math.sin(heading), 0, Math.cos(heading)).scale(10));
  if (inXr()) {
    // Whatever your height (or if you're on a chair), your eyes go where a seated jumper's are;
    // after the exit the difference is given back (doExit), so you land at your own height.
    jump.lowered = 0;
    rig.moveTo(feet, look, null, seated ? { eyeHeight: SEATED_EYE } : {});
  } else {
    const eye = seated ? SEATED_EYE : EYE;
    camera.position.set(feet.x, feet.y + eye, feet.z);
    camera.setTarget(new Vector3(look.x, feet.y + eye - 2, look.z));
  }
}

function doExit() {
  if (jumper.state.phase !== 'exit') return;
  audio.start();
  // You leave from where you sit now (in the headset you may have leaned or shifted).
  const cam = active();
  const s = jumper.state;
  s.pos.x = cam.position.x;
  s.pos.z = cam.position.z;
  // Seated in the door your eyes were put low; your own standing height comes back in freefall.
  if (inXr()) jump.lowered = Math.max(0, (rig.camera.realWorldHeight || EYE) - (cam.position.y - s.pos.y));
  jumper.exit({ x: Math.sin(s.heading) * PUSH_OUT, y: PUSH_UP, z: Math.cos(s.heading) * PUSH_OUT });
  jump.freefallFrom = performance.now();
  hideCard();
  log.note('exit');
}

function doPull(reason = 'pulled') {
  if (!jumper.pull()) return;
  audio.opening();
  jump.pulledAt = Math.round(jumper.aboveGround());
  log.note('pull', { reason, agl: jump.pulledAt });
}

// --- Inputs ---------------------------------------------------------------------------------

const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (!jumper) return;
  if (e.code === 'Space') {
    e.preventDefault();
    audio.start();
    const phase = jumper.state.phase;
    if (phase === 'exit') doExit();
    else if (phase === 'freefall') doPull();
    else if (phase === 'landed') newJump();
  }
  if (jumper.state.phase === 'canopy' && ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS', 'Space'].includes(e.code)) jumper.takeToggles();
});
addEventListener('keyup', (e) => keys.delete(e.code));
const held = (...codes) => codes.some((c) => keys.has(c));

/** Flat-screen intents, with the toggles easing in and out like a hand would. */
function keyboardInput(dt) {
  const left = held('ArrowLeft', 'KeyA');
  const right = held('ArrowRight', 'KeyD');
  const both = held('ArrowDown', 'KeyS', 'Space');
  const ease = (from, to) => from + Math.sign(to - from) * Math.min(Math.abs(to - from), dt * 2.2);
  jump.keys.left = ease(jump.keys.left, left || both ? 1 : 0);
  jump.keys.right = ease(jump.keys.right, right || both ? 1 : 0);
  return {
    turn: (right ? 1 : 0) - (left ? 1 : 0),
    track: held('ArrowUp', 'KeyW') ? 1 : 0,
    left: jump.keys.left,
    right: jump.keys.right,
    hands: null,
  };
}

const pressed = new Map();
function edge(controller, id) {
  const component = controller.motionController?.getComponent(id);
  const key = `${controller.uniqueId}:${id}`;
  const down = !!component?.pressed;
  const was = pressed.get(key);
  pressed.set(key, down);
  return down && !was;
}
function handsByHandedness() {
  const out = {};
  for (const c of rig.xr.input.controllers) {
    const mc = c.motionController;
    if (!mc) continue;
    out[mc.handedness] = { controller: c, mc, pos: (c.grip ?? c.pointer).position, grip: !!mc.getComponentOfType('squeeze')?.pressed, trigger: !!mc.getMainComponent()?.pressed };
  }
  return out;
}
/**
 * Where this frame is drawn from: between the headset's two eye cameras. They took this frame's
 * pose before the fall moved you (that move shows from the next frame), so your body is placed
 * here, not at the moved camera: at 60 m/s one frame is nearly a metre.
 */
function renderedEyes() {
  const cams = rig.camera.rigCameras;
  if (!cams?.length) return rig.camera.position.clone();
  const sum = new Vector3();
  for (const c of cams) sum.addInPlace(c.globalPosition);
  return sum.scaleInPlace(1 / cams.length);
}
/** The controllers' grips for the body's hands: world position, rotation and how hard they're squeezed. */
function bodyHands() {
  const out = {};
  for (const c of rig.xr.input.controllers) {
    const mc = c.motionController;
    if (!mc) continue;
    const node = c.grip ?? c.pointer;
    out[mc.handedness] = { pos: node.position.clone(), rot: node.rotationQuaternion?.clone(), grip: mc.getComponentOfType('squeeze')?.value ?? 0 };
  }
  return out;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const toBody = new Matrix();

/** Headset intents from where the hands are, relative to the head. */
function headsetInput() {
  const hands = handsByHandedness();
  const head = rig.camera.position;
  const L = hands.left;
  const R = hands.right;
  const s = jumper.state;
  const result = { turn: 0, track: 0, left: 0, right: 0, hands: null };
  for (const h of [L, R]) {
    if (!h) continue;
    if (edge(h.controller, 'xr-standard-squeeze')) h.gripEdge = true;
  }
  if (s.phase === 'freefall') {
    // Your body turns to face where you look, as fast as a body in freefall can turn (about a
    // second to come round). The view isn't turned with it: you already turned it yourself.
    const look = rig.camera.getDirection(Vector3.Forward());
    if (Math.hypot(look.x, look.z) > 0.2) {
      const off = Math.atan2(Math.sin(Math.atan2(look.x, look.z) - s.heading), Math.cos(Math.atan2(look.x, look.z) - s.heading));
      result.turn = Math.max(-1, Math.min(1, off / 1.2));
    }
    if (L && R) {
      // Both hands swept down by the hips: a track.
      const low = head.y - (L.pos.y + R.pos.y) / 2;
      result.track = clamp01((low - 0.6) / 0.25);
    }
    // The pull: a grip squeezed with that hand down at the hip.
    for (const h of [R, L]) {
      if (h?.gripEdge && head.y - h.pos.y > 0.45) doPull();
    }
  }
  if (s.phase === 'opening' || s.phase === 'canopy') {
    if (s.stowed && L?.grip && R?.grip && s.phase === 'canopy') {
      jumper.takeToggles();
      log.note('toggles taken');
    }
    // Shoulder height is full flight; down at the hips is full brakes.
    const brake = (h) => (h && h.grip && !s.stowed ? clamp01((head.y - 0.3 - h.pos.y) / 0.6) : 0);
    result.left = brake(L);
    result.right = brake(R);
    // The toggles go where the hands holding them are (in the canopy's frame).
    if (!s.stowed) {
      canopy.root.computeWorldMatrix(true).invertToRef(toBody);
      result.hands = {
        left: L?.grip ? Vector3.TransformCoordinates(L.pos, toBody) : null,
        right: R?.grip ? Vector3.TransformCoordinates(R.pos, toBody) : null,
      };
    }
  }
  if (s.phase === 'exit' && !card?.visible) {
    for (const h of [L, R]) if (h && edge(h.controller, 'xr-standard-trigger')) doExit();
  }
  for (const h of [L, R]) if (h) h.gripEdge = false;
  return result;
}

// --- Each frame -----------------------------------------------------------------------------

let lastHeading = 0;
/** Which way your torso faces (radians from north): with your head when you're free to turn. */
let bodyYaw = 0;
const lastPos = new Vector3();
let time = 0;
scene.onBeforeRenderObservable.add(() => {
  if (!jumper) return;
  const dt = Math.min(0.1, engine.getDeltaTime() / 1000) * TIME_SCALE;
  time += dt;
  const s = jumper.state;
  const input = inXr() ? headsetInput() : keyboardInput(dt);
  input.target = TARGET;

  const before = { phase: s.phase, heading: s.heading };
  lastPos.set(s.pos.x, s.pos.y, s.pos.z);
  lastHeading = s.heading;
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  for (let i = 0; i < steps; i++) jumper.step(dt / steps, input);

  if (s.phase === 'freefall' && jumper.aboveGround() < AAD && -s.vel.y > 30) {
    doPull('automatic opener');
    instruct('aad', 'Automatic opener fired. Next time, pull by 1,500 m.');
  }
  if (before.phase !== s.phase) onPhase(before.phase, s.phase);
  callouts();

  // Move the viewer with the jumper: in the headset by the step (your own head moves stay yours).
  const cam = active();
  const yaw = s.heading - lastHeading;
  heli.update(time);
  if (s.phase !== 'exit') {
    if (inXr()) {
      cam.position.x += s.pos.x - lastPos.x;
      cam.position.y += s.pos.y - lastPos.y;
      cam.position.z += s.pos.z - lastPos.z;
      if (jump.lowered > 0) {
        // Back up to your own height over the first seconds of freefall (you're lying on the air).
        const rise = Math.min(jump.lowered, dt * 0.6);
        cam.position.y += rise;
        jump.lowered -= rise;
      }
      // The view is never turned for you unless asked (`?turn=1`): under the canopy, as in
      // freefall, you turn yourself to follow it. A turned view is what makes people sick.
      if (yaw && TURN_VIEW && s.phase !== 'freefall') turnHeadset(yaw);
    } else {
      cam.position.set(s.pos.x, s.pos.y + EYE, s.pos.z);
      // Debug: a chase view from outside (`vrtorJump.chase = new Vector3(...)`, in the heading's frame).
      if (debug.chase) cam.position.addInPlace(debug.chase.applyRotationQuaternion(Quaternion.RotationYawPitchRoll(s.heading, 0, 0)));
      camera.rotation.y += yaw;
      // Debug: keep looking at a point in the heading's frame (`vrtorJump.debug.look`), from the feet.
      if (debug.look) camera.setTarget(new Vector3(s.pos.x, s.pos.y, s.pos.z).addInPlace(debug.look.applyRotationQuaternion(Quaternion.RotationYawPitchRoll(s.heading, 0, 0))));
    }
  }
  vignette.set(inXr() && TURN_VIEW && s.phase !== 'freefall' ? Math.min(0.85, Math.abs(s.yawRate) * 0.9) : 0);

  // Your body hangs from your head: its neck goes just behind and below your eyes, found from
  // where your head is and how it's turned and tilted, so the body's head is always yours.
  const pose = s.phase === 'exit' ? 'seated' : s.phase === 'freefall' ? 'freefall' : s.phase === 'landed' ? 'standing' : 'hanging';
  const eyes = inXr() ? renderedEyes() : new Vector3(s.pos.x, s.pos.y + (s.phase === 'exit' ? SEATED_EYE : EYE), s.pos.z);
  const headTurn = inXr() ? rig.camera.rotationQuaternion : Quaternion.RotationYawPitchRoll(s.heading, 0, 0);
  const headAhead = Vector3.Forward().applyRotationQuaternion(headTurn);
  const headUp = Vector3.Up().applyRotationQuaternion(headTurn);
  const neck = eyes.subtract(headAhead.scale(0.09)).subtractInPlace(headUp.scale(0.11));
  // Sitting or standing, your torso turns with you, a little behind your head (beyond 30 degrees);
  // in the harness or lying on the air it stays square to where you're flying.
  if (pose === 'seated' || pose === 'standing') {
    if (Math.hypot(headAhead.x, headAhead.z) > 0.25) {
      const twist = Math.atan2(Math.sin(Math.atan2(headAhead.x, headAhead.z) - bodyYaw), Math.cos(Math.atan2(headAhead.x, headAhead.z) - bodyYaw));
      const limit = Math.PI / 6;
      if (Math.abs(twist) > limit) bodyYaw += twist - Math.sign(twist) * limit;
    }
  } else {
    bodyYaw = s.heading;
  }
  const ahead = new Vector3(Math.sin(bodyYaw), 0, Math.cos(bodyYaw));
  const shoulders = pose === 'freefall'
    ? neck.subtract(ahead.scale(0.1)).addInPlaceFromFloats(0, -0.04, 0)
    : neck.subtract(ahead.scale(0.03)).addInPlaceFromFloats(0, -0.13, 0);
  canopy.root.position.copyFrom(shoulders);
  canopy.root.rotation.y = s.heading;
  canopy.update(s, { hands: input.hands, time, shoulder: shoulders.y - s.pos.y });
  body.showHead(!!debug.chase);
  body.update({ pose, shoulders, heading: bodyYaw, hands: inXr() ? bodyHands() : null });
  const w = wind.at(jumper.aboveGround(), s.t);
  dropzone.update(w, time);

  const air = Math.hypot(s.vel.x - w.x, s.vel.y - w.y, s.vel.z - w.z);
  const heliPos = heli.root.position;
  audio.update({
    airspeed: s.phase === 'exit' || s.phase === 'landed' ? Math.hypot(w.x, w.z) : air,
    canopy: s.phase === 'canopy' || s.phase === 'landed' ? 1 : s.phase === 'opening' ? s.inflation : 0,
    flutter: Math.min(1, Math.abs(s.brakeL - s.brakeR) + s.stall + (s.phase === 'opening' ? 1 : 0)),
    heliDistance: heli.root.isEnabled() ? Vector3.Distance(heliPos, cam.position) : Infinity,
  });
  updateReadouts(w);
});

function turnHeadset(yaw) {
  const cam = rig.camera;
  const e = cam.rotationQuaternion.toEulerAngles();
  Quaternion.FromEulerAnglesToRef(e.x, e.y + yaw, e.z, cam.rotationQuaternion);
}

function onPhase(from, to) {
  log.note('phase', { from, to, agl: Math.round(jumper.aboveGround()) });
  if (to === 'canopy') {
    jump.canopyFrom = performance.now();
    instruct('open', inXr() ? 'Good canopy. Hands up by your shoulders and squeeze both grips to take your toggles.' : 'Good canopy. Press an arrow key to take your toggles.');
  }
  if (to === 'landed') {
    const l = jumper.state.landing;
    const rating = rateLanding(l);
    audio.thud(l.sink);
    jump.result = { ...l, rating, freefall: jump.canopyFrom ? (jump.canopyFrom - jump.freefallFrom) / 1000 : null, canopy: jump.canopyFrom ? (performance.now() - jump.canopyFrom) / 1000 : null };
    log.note('landed', { sink: +l.sink.toFixed(2), speed: +l.speed.toFixed(2), distance: Math.round(l.distance), grade: rating.grade });
    setTimeout(showCard, 2500);
  }
}

/** The audible altimeter and the radio instructor on the ground. */
function callouts() {
  const s = jumper.state;
  const agl = jumper.aboveGround();
  if (s.phase === 'freefall') {
    if (agl < PULL + 300) once('wave', () => audio.beep(3));
    if (agl < PULL) once('pull', () => { audio.beep(1, true); instruct('pull', inXr() ? 'Pull! Reach to your hip and squeeze a grip.' : 'Pull! Press Space.'); });
  }
  if (s.phase === 'canopy') {
    if (agl < 300) once('300', () => { audio.beep(2); instruct('pattern', 'Three hundred metres. Fly toward the target and turn into the wind by one hundred.'); });
    if (agl < 100) once('100', () => { audio.beep(1); instruct('final', 'Final. Hands up, full flight, no more turns.'); });
    if (agl < 3.6 && -s.vel.y > 2) once('flare', () => instruct('flare', 'Flare! Flare!'));
  }
}
function once(key, fn) {
  if (jump.said.has(key)) return;
  jump.said.add(key);
  fn();
}
let instruction = '';
function instruct(key, text) {
  instruction = text;
  audio.say(text.replace(/,/g, ''));
  log.note('instructor', { key, text });
}

// --- Readouts: the wrist altimeter (headset) and the top bar (flat screens) -------------------

const wrist = createWrist();
// The real altimeter on the back of the left hand; the panel above the wrist keeps the words.
let altimeter = null;
const altimeterReady = createAltimeter(scene).then((a) => (altimeter = a)).catch((e) => log.note('altimeter-error', { message: String(e) }));
let readoutAt = 0;
function updateReadouts(w) {
  const now = performance.now();
  if (now - readoutAt < 150) return;
  readoutAt = now;
  const s = jumper.state;
  const agl = Math.max(0, Math.round(jumper.aboveGround()));
  const fall = Math.max(0, -s.vel.y);
  const ground = Math.hypot(s.vel.x, s.vel.z);
  const toTarget = Math.hypot(TARGET.x - s.pos.x, TARGET.z - s.pos.z);
  const bearing = Math.atan2(TARGET.x - s.pos.x, TARGET.z - s.pos.z) - s.heading;
  const phaseText = {
    exit: inXr() ? 'Trigger on Jump' : 'Space to jump',
    freefall: 'Freefall',
    opening: 'Opening',
    canopy: s.stall > 0.3 ? 'Stall: hands up!' : s.stowed ? 'Take your toggles' : 'Canopy',
    landed: jump.result?.rating.title ?? 'Landed',
  }[s.phase];
  const windText = `wind ${Math.round(Math.hypot(w.x, w.z))} m/s`;
  ui.readout.textContent = `${agl} m · ${phaseText} · down ${fall.toFixed(1)} m/s · forward ${ground.toFixed(1)} m/s · target ${Math.round(toTarget)} m · ${windText}${params.has('xrdebug') ? ` · ${Math.round(engine.getFps())} fps` : ''}`;
  ui.action.textContent = { exit: 'Jump', freefall: 'Pull', opening: 'Opening…', canopy: 'Flare (hold S)', landed: 'Jump again' }[s.phase];
  ui.action.disabled = s.phase === 'opening' || s.phase === 'canopy';
  ui.hint.textContent = {
    exit: 'Space jumps · drag to look',
    freefall: 'A/D or arrows turn · W tracks forward · Space pulls (by 1,500 m)',
    opening: 'Wait for it…',
    canopy: 'A/← left toggle · D/→ right toggle · S/↓/Space both: slow down, and flare at about 3 m',
    landed: 'Space to jump again',
  }[s.phase];
  altimeter?.set(agl);
  wrist.draw({ agl, fall, ground, phaseText, instruction, toTarget, bearing, band: s.phase === 'freefall' ? (agl > PULL + 300 ? 'green' : agl > 1000 ? 'amber' : 'red') : 'plain', debug: params.has('xrdebug') && rig ? rig.stats() : '' });
}

function createWrist() {
  const size = { width: 768, height: 384 };
  const texture = new DynamicTexture('wrist', size, scene, true);
  texture.hasAlpha = true;
  // Uploaded once now: a texture never drawn would hold the scene's readiness forever.
  texture.update();
  const plane = MeshBuilder.CreatePlane('wrist', { width: 0.14, height: 0.07 }, scene);
  const mat = new StandardMaterial('wrist', scene);
  mat.disableLighting = true;
  mat.emissiveTexture = texture;
  mat.opacityTexture = texture;
  mat.backFaceCulling = false;
  plane.material = mat;
  plane.isPickable = false;
  plane.setEnabled(false);
  let attached = false;
  const colors = { green: '#3fcf6a', amber: '#ffb020', red: '#ff4a3d', plain: '#f4f1ea' };
  return {
    attach(controller) {
      plane.parent = controller.grip ?? controller.pointer;
      plane.position.set(0.02, 0.035, -0.07);
      plane.rotation.set(Math.PI / 3, 0, 0);
      attached = true;
      plane.setEnabled(true);
    },
    draw({ agl, fall, ground, phaseText, instruction: text, toTarget, bearing, band, debug }) {
      if (!attached) return;
      const ctx = texture.getContext();
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.fillStyle = 'rgba(10,11,14,0.88)';
      ctx.beginPath();
      ctx.roundRect(0, 0, size.width, size.height, 36);
      ctx.fill();
      ctx.fillStyle = colors[band];
      ctx.font = 'bold 132px system-ui, sans-serif';
      ctx.fillText(`${agl}`, 28, 136);
      const unitAt = 40 + ctx.measureText(`${agl}`).width;
      ctx.font = '40px system-ui, sans-serif';
      ctx.fillStyle = '#c9c4ba';
      ctx.fillText('m', unitAt, 136);
      ctx.fillStyle = '#f4f1ea';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillText(phaseText, 30, 196);
      ctx.font = '34px system-ui, sans-serif';
      ctx.fillStyle = '#c9c4ba';
      ctx.fillText(`↓ ${fall.toFixed(1)}  → ${ground.toFixed(1)} m/s`, 30, 246);
      // Arrow to the target, relative to where you face.
      ctx.save();
      ctx.translate(650, 110);
      ctx.rotate(bearing);
      ctx.fillStyle = '#ff6a14';
      ctx.beginPath();
      ctx.moveTo(0, -62);
      ctx.lineTo(34, 30);
      ctx.lineTo(0, 12);
      ctx.lineTo(-34, 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f4f1ea';
      ctx.font = '32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(toTarget)} m`, 650, 210);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd27a';
      ctx.font = '30px system-ui, sans-serif';
      wrap(ctx, debug || text, 30, 300, 708, 36, 2);
      texture.update();
    },
  };
}
function wrap(ctx, text, x, y, width, line, max) {
  const words = (text || '').split(' ');
  let row = '';
  let n = 0;
  for (const word of words) {
    const test = row ? `${row} ${word}` : word;
    if (ctx.measureText(test).width > width && row) {
      ctx.fillText(row, x, y + n * line);
      row = word;
      if (++n >= max) return;
    } else row = test;
  }
  if (row) ctx.fillText(row, x, y + n * line);
}

/** A soft dark edge to the view while the canopy or your body turns you (headset only). */
const vignette = (() => {
  // A shell around your head, clear ahead and dark toward the sides, so it has no edge to see
  // however you turn your eyes. Its strength fades in quickly and out gently.
  const shell = MeshBuilder.CreateSphere('vignette', { diameter: 0.5, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const positions = shell.getVerticesData(VertexBuffer.PositionKind);
  const colors = new Float32Array((positions.length / 3) * 4);
  const CLEAR = Math.cos((35 * Math.PI) / 180);
  const DARK = Math.cos((70 * Math.PI) / 180);
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 4) {
    const ahead = positions[i + 2] / Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
    const t = Math.min(1, Math.max(0, (CLEAR - ahead) / (CLEAR - DARK)));
    colors[j + 3] = t * t * (3 - 2 * t);
  }
  shell.setVerticesData(VertexBuffer.ColorKind, colors);
  shell.hasVertexAlpha = true;
  const mat = new StandardMaterial('vignette', scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.emissiveColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.disableDepthWrite = true;
  mat.backFaceCulling = false;
  mat.alpha = 0;
  shell.material = mat;
  shell.isPickable = false;
  shell.renderingGroupId = 3;
  shell.setEnabled(false);
  let current = 0;
  return {
    attach(cam) {
      shell.parent = cam;
    },
    set(k) {
      current += (k - current) * (k > current ? 0.3 : 0.08);
      mat.alpha = current;
      shell.setEnabled(current > 0.02 && !!shell.parent);
    },
  };
})();

// --- The card: before the jump and after landing ---------------------------------------------

function cardContent() {
  const s = jumper.state;
  if (s.phase === 'exit') {
    return {
      kicker: 'Interlaken · 4,000 m',
      title: 'Ready in the door',
      body: inXr()
        ? 'Freefall: turn your head and body to turn; both hands down at your hips track forward. By 1,500 m reach to your hip and squeeze a grip to pull. Under the canopy, squeeze both grips to take your toggles: pull one down to turn and turn yourself with the canopy, both to slow down, and flare at about 3 m. Land on the orange X.'
        : 'Freefall: A/D or arrows turn, W tracks forward. Space pulls: do it by 1,500 m. Under the canopy, A/D pull the left and right toggles, S both: turn, slow down, and flare at about 3 m. Land on the orange X.',
      fact: `Wind on the ground: ${wind.ground.toFixed(1)} m/s from ${compass(wind.from)}. The windsock by the target shows it.`,
      actions: [{ label: 'Jump', primary: true, onClick: doExit }],
    };
  }
  const r = jump.result;
  const lines = [`Touchdown: ${r.sink.toFixed(1)} m/s down, ${r.speed.toFixed(1)} m/s across the ground. ${Math.round(r.distance)} m from the X.`];
  if (r.freefall) lines.push(`Freefall ${Math.round(r.freefall)} s, pulled at ${jump.pulledAt} m; ${Math.round(r.canopy / 60)} min ${Math.round(r.canopy % 60)} s under the canopy.`);
  return {
    kicker: 'Landed',
    title: r.rating.title,
    body: r.rating.body,
    fact: lines.join(' '),
    actions: [{ label: 'Jump again', primary: true, onClick: newJump }],
  };
}
function compass(deg) {
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
function showCard() {
  const c = cardContent();
  if (inXr()) {
    ui.card.hidden = true;
    card.setContent(c);
    card.place(rig.headPosition(), rig.headForward(), null, { distance: 1.2, drop: 0.25 });
    setLasers(true);
    return;
  }
  ui.card.hidden = false;
  ui.cardTitle.textContent = c.title;
  ui.cardBody.textContent = c.body;
  ui.cardFact.textContent = c.fact;
  ui.cardActions.replaceChildren(...c.actions.map((a) => {
    const b = document.createElement('button');
    b.className = `btn${a.primary ? ' btn-primary' : ''}`;
    b.type = 'button';
    b.textContent = a.label;
    b.addEventListener('click', () => {
      audio.start();
      a.onClick();
    });
    return b;
  }));
}
function hideCard() {
  ui.card.hidden = true;
  card?.hide();
  setLasers(false);
}
/** The pointer rays are for the card; in the air they would only clutter the view. */
function setLasers(on) {
  const ps = rig?.xr.pointerSelection;
  if (!ps) return;
  ps.displayLaserPointer = on;
  ps.displaySelectionMesh = on;
}

ui.action.addEventListener('click', () => {
  audio.start();
  const phase = jumper?.state.phase;
  if (phase === 'exit') doExit();
  else if (phase === 'freefall') doPull();
  else if (phase === 'landed') newJump();
});

// Sky: a clear zenith fading to the haze at the horizon, and the haze below it, where the
// 256 km square ends far under the horizon line.
function createSky(scene) {
  const mesh = MeshBuilder.CreateSphere('sky', { diameter: 1000, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
  const mat = new StandardMaterial('sky', scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.infiniteDistance = true;
  mesh.applyFog = false;
  mesh.renderingGroupId = 0;
  const zenith = Color3.FromHexString('#3d78b8');
  const glow = Color3.FromHexString('#fff2d8');
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const colors = new Float32Array((positions.length / 3) * 4);
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 4) {
    const len = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
    const x = positions[i] / len;
    const y = positions[i + 1] / len;
    const z = positions[i + 2] / len;
    const haze = Math.pow(1 - Math.max(0, y), 5);
    const g = Math.max(0, x * SUN.x + y * SUN.y + z * SUN.z);
    const scatter = 0.12 * Math.pow(g, 8) + 0.4 * Math.pow(g, 64);
    for (const [k, key] of ['r', 'g', 'b'].entries()) colors[j + k] = Math.min(1, zenith[key] + (HAZE[key] - zenith[key]) * haze + glow[key] * scatter);
    colors[j + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

async function start() {
  try {
    terrain = await buildTerrain(scene, (k) => (ui.pct.textContent = `${Math.round(k * 60)}%`));
    dropzone = createDropzone(scene, { target: TARGET, groundAt: terrain.groundAt });
    [heli, body] = await Promise.all([createHelicopter(scene), createBody(scene), buildBuildings(scene, terrain, { sun })]);
    if (params.has('debug')) window.vrtorJump = { scene, camera, terrain, get jumper() { return jumper; }, canopy, heli, Vector3, debug };
    await scene.whenReadyAsync();
    ui.pct.textContent = '100%';
    ui.loading.hidden = true;
    newJump();
    engine.runRenderLoop(() => scene.render());
    addEventListener('resize', () => engine.resize());
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: [] });
      if (rig) {
        rig.camera.minZ = camera.minZ;
        rig.camera.maxZ = camera.maxZ;
        card = createCard(scene, { name: 'jump-card' });
        for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
        // Teleport needs a floor; here you move by falling.
        rig.xr.teleportation?.detach();
        vignette.attach(rig.camera);
        rig.xr.input.onControllerAddedObservable.add((controller) => {
          controller.onMotionControllerInitObservable.add((mc) => {
            // Your own hands are drawn (body.js), not the controllers.
            mc.onModelLoadedObservable.add(() => mc.rootMesh?.setEnabled(false));
            if (mc.handedness === 'left') {
              wrist.attach(controller);
              altimeterReady.then(() => altimeter?.attach(controller));
            }
          });
        });
        ui.vr.hidden = false;
        rig.onChange((entered) => {
          document.body.classList.toggle('in-xr', entered);
          if (entered) {
            // Into the headset where the flat-screen view was: back in the door if not jumped yet.
            const s = jumper.state;
            const feet = new Vector3(s.pos.x, s.pos.y, s.pos.z);
            placeViewer(feet, s.heading, s.phase === 'exit');
            if (s.phase === 'exit' || s.phase === 'landed') setTimeout(showCard, 400);
          } else {
            card.hide();
            const s = jumper.state;
            camera.position.set(s.pos.x, s.pos.y + (s.phase === 'exit' ? SEATED_EYE : EYE), s.pos.z);
            if (jumper.state.phase === 'exit' || jumper.state.phase === 'landed') showCard();
          }
        });
      }
    }
  } catch (error) {
    ui.pct.textContent = error.message;
    throw error;
  }
}

ui.vr.addEventListener('click', async () => {
  if (!rig || inXr()) return;
  audio.start();
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } finally {
    ui.vr.disabled = false;
  }
});

start();
