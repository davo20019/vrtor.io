// The yoke's controls, worked from the driver's seat (Owner's Manual, Steering): press the centre pad for
// the horn ("press and hold the center pad"); on the left pod, the turn signals (right above, left below)
// and the high beam; on the right pod, the wiper (Windshield Wiper and Washers: "press and quickly release
// the wiper button ... to wipe the windshield", once, from parked up the pillar to horizontal and back). The model names each control's meshes and the amber lamps the signals blink
// (cybertruck.json "yoke"); here they get pick targets, a glow under the pointer, and what they do.
//
// Estimated (not published): the horn's two tones and their loudness, the signal's tick, and how the
// pod's symbols light (the manual shows them only unlit). The flash rate is the legal one's middle:
// FMVSS 108 allows 60 to 120 flashes a minute.
import { Color3, Matrix, MeshBuilder, Quaternion, Vector3 } from '@babylonjs/core';

const HOVER = Color3.FromHexString('#ffb020');
const GREEN = new Color3(0.15, 0.95, 0.3);
const BLUE = new Color3(0.2, 0.45, 1);
const AMBER_LIT = new Color3(4.0, 1.8, 0.2);    // a lit corner lamp; unlit, the model's lens is dark amber and doesn't glow
const FLASH_S = 60 / 85;                       // one on-and-off, at 85 flashes a minute
const HORN_HZ = [415, 520];                    // a two-tone car horn, about a major third apart (estimate)
const HORN_S = 0.5;
const WIPE_S = 1.4;                            // one wipe, out and back (estimate: the continuous-slow pace)
const TARGET_M = 0.035;                        // the pick target round each key: its symbols sit 16 mm apart

let audio = null;
function ctx() {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function honk() {
  const a = ctx();
  const t = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.22, t + 0.015);
  out.gain.setValueAtTime(0.22, t + HORN_S);
  out.gain.linearRampToValueAtTime(0, t + HORN_S + 0.06);
  const tone = a.createBiquadFilter();             // a horn's diaphragm: buzzy, its top rolled off
  tone.type = 'lowpass';
  tone.frequency.value = 2400;
  tone.Q.value = 2;
  tone.connect(out).connect(a.destination);
  for (const hz of HORN_HZ) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    o.connect(tone);
    o.start(t);
    o.stop(t + HORN_S + 0.1);
  }
}

/** The relay-like tick as the lamps come on, a lower tock as they go off. */
function tick(on) {
  const a = ctx();
  const t = a.currentTime;
  const len = Math.round(a.sampleRate * 0.02);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  const src = a.createBufferSource();
  src.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = on ? 2600 : 1700;
  band.Q.value = 4;
  const g = a.createGain();
  g.gain.value = 0.5;
  src.connect(band).connect(g).connect(a.destination);
  src.start(t);
}

/**
 * Sets up the yoke's controls. byName finds a mesh by name; info is cybertruck.json; onHighBeam(on) brightens
 * the light bar (main.js owns its glow). Returns
 * { targets: Map(mesh -> control), hover(control|null), press(control), tick(dt), set active(bool) }:
 * targets are only pickable while active (in the driver's seat).
 */
export function createYokeControls(scene, byName, info, { onHighBeam = () => {} } = {}) {
  const y = info.yoke;
  const controls = {};                           // control -> { meshes: [{ mesh, rest }] }
  const targets = new Map();
  if (!y?.controls) return null;
  for (const [key, names] of Object.entries(y.controls)) {
    const meshes = names.map(byName).filter((m) => m?.material);
    if (!meshes.length) continue;
    controls[key] = meshes.map((mesh) => {
      mesh.material = mesh.material.clone(`${mesh.name}-ctl`);   // its own, so it lights alone
      // The pod's keys light only their symbols: the symbol texture is the glow's mask.
      return { mesh, rest: mesh.material.emissiveColor?.clone() ?? Color3.Black(), symbols: mesh.material.albedoTexture ?? null,
               restTexture: mesh.material.emissiveTexture ?? null };
    });
    if (key === 'horn') {
      for (const m of meshes) targets.set(m, key);            // the pad is big enough to hit as it is
      continue;
    }
    // A small invisible box on the key, riding with it as the yoke turns.
    const key0 = meshes[0];
    const box = MeshBuilder.CreateBox(`${key0.name}-target`, { size: TARGET_M }, scene);
    box.visibility = 0;
    box.position.copyFrom(key0.getBoundingInfo().boundingBox.centerWorld);
    box.setParent(key0);
    targets.set(box, key);
  }
  const lamps = {};
  for (const [side, name] of Object.entries(y.signals ?? {})) {
    const mesh = byName(name);
    if (!mesh?.material) continue;
    mesh.material = mesh.material.clone(`${name}-signal`);
    lamps[side] = { mat: mesh.material, rest: mesh.material.emissiveColor.clone() };
  }

  const state = { signal: null, hazard: false, phase: 0, lit: false, highBeam: false, hovered: null, active: false, wipe: -1 };

  // The wiper's arm turns about the glass's normal; which way is toward the passenger is found by trying it.
  const w = info.wiper && byName(info.wiper.node);
  let wiper = null;
  if (w) {
    w.rotationQuaternion ??= Quaternion.Identity();
    const rest = w.rotationQuaternion.clone(), axis = Vector3.FromArray(info.wiper.axis);
    const blade = w.getChildMeshes()[0];
    const across = () => {                             // the blade's middle, left (+x) to right in the truck's frame
      w.computeWorldMatrix(true);
      blade.computeWorldMatrix(true);
      const root = w.parent.computeWorldMatrix(true);
      return Vector3.TransformCoordinates(blade.getBoundingInfo().boundingBox.centerWorld, Matrix.Invert(root)).x;
    };
    const x0 = across();
    w.rotationQuaternion = rest.multiply(Quaternion.RotationAxis(axis, 0.1));
    const sign = across() < x0 ? 1 : -1;
    w.rotationQuaternion = rest.clone();
    wiper = { node: w, rest, axis, sweep: (sign * info.wiper.sweepDeg * Math.PI) / 180 };
  }

  function paint() {
    for (const [key, parts] of Object.entries(controls)) {
      let c = null;
      if (key === state.hovered) c = HOVER;
      else if ((key === `signal_${state.signal}` || (state.hazard && key.startsWith('signal_'))) && state.lit) c = GREEN;
      else if (key === 'high_beam' && state.highBeam) c = BLUE;
      for (const p of parts) {
        p.mesh.material.emissiveTexture = c && p.symbols ? p.symbols : p.restTexture;
        p.mesh.material.emissiveColor = c ? c.scale(p.symbols ? 1.6 : 0.6) : p.rest.clone();
      }
    }
    for (const [side, l] of Object.entries(lamps)) {
      l.mat.emissiveColor = blink(side) ? AMBER_LIT.clone() : l.rest.clone();
    }
  }

  /** Whether a side's signal lamps are lit just now: its turn signal or the hazards, in the on half of a flash. */
  function blink(side) {
    return state.lit && (state.hazard || state.signal === side);
  }

  function setLit(lit) {
    if (lit === state.lit) return;
    state.lit = lit;
    tick(lit);
    paint();
  }

  return {
    targets,
    get signal() { return state.signal; },
    get hazard() { return state.hazard; },
    blink,
    /** The hazard flashers (Owner's Manual, Lights: the button on the overhead console): every signal lamp flashes. */
    setHazard(on) {
      state.hazard = on;
      state.phase = 0;
      state.lit = false;
      if (on || state.signal) setLit(true);
      else paint();
    },
    get highBeam() { return state.highBeam; },
    set active(on) {
      state.active = on;
      for (const t of targets.keys()) {
        t.isPickable = on;
        t.enablePointerMoveEvents = on;          // Babylon picks on a mouse move only meshes that ask for it
      }
      if (!on) this.hover(null);
    },
    hover(key) {
      if (key === state.hovered) return;
      state.hovered = key;
      paint();
    },
    press(key) {
      if (key === 'horn') honk();
      else if (key === 'signal_left' || key === 'signal_right') {
        const side = key.slice(7);
        state.signal = state.signal === side ? null : side;    // the same key again turns it off
        state.phase = 0;
        state.lit = false;
        if (state.signal || state.hazard) setLit(true);
        else paint();
      } else if (key === 'wiper') {
        if (wiper && state.wipe < 0 && !w.metadata?.off) state.wipe = 0;     // not with the arm taken off (disassembly.js)
      } else if (key === 'high_beam') {
        state.highBeam = !state.highBeam;
        onHighBeam(state.highBeam);
        paint();
      }
    },
    get wiping() { return state.wipe >= 0; },
    /** dt in seconds: the signal's flashing and the wiper's sweep. */
    tick(dt) {
      if (wiper && state.wipe >= 0) {
        state.wipe = Math.min(1, state.wipe + dt / WIPE_S);
        const e = (1 - Math.cos(2 * Math.PI * state.wipe)) / 2;     // out and back, easing at both ends
        wiper.node.rotationQuaternion = wiper.rest.multiply(Quaternion.RotationAxis(wiper.axis, wiper.sweep * e));
        if (state.wipe >= 1) state.wipe = -1;
      }
      if (!state.signal && !state.hazard) return;
      state.phase = (state.phase + dt / FLASH_S) % 1;
      setLit(state.phase < 0.5);
    },
  };
}
