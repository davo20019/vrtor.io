// The self-driving ride: the truck drives Highway 1's right-hand lane by itself. steering.js is the
// physics (the controller turns the yoke, steer-by-wire turns all four wheels, the wheels move the
// truck, the body leans); here it's shown: the truck's pose, each wheel's steer and roll, the yoke
// turning in the cabin, the road on the centre screen (screen.js) and the road's sound.
import { Axis, Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import { createCabinSound } from './sound.js';
import { ACCEL, DECEL, TRACK, WHEELBASE, createVehicle, laneOf, plan } from './steering.js';
import { createRide } from './surface.js';

const ROLLING_RADIUS = 0.424;          // m
/** Stopping when asked (a door button, Stop here): firm but comfortable, about 5 s from 55 mph. */
const STOP_DECEL = 3.0;                // m/s²

export function createDrive(scene, { pose, truckInfo, nodes, screen, road, windows = () => ({}) }) {
  const p = plan(road);
  const at = laneOf(road, p);
  const car = createVehicle(at, { start: p.start, end: p.end, accel: ACCEL, decel: DECEL });
  // The body over the road's last few millimetres (surface.js).
  const ride = createRide();
  let feel = { heave: 0, pitch: 0, roll: 0 };

  // Wheels and their steering knuckles, from the model's json.
  const rest = new Map();
  const restOf = (node) => {
    if (!rest.has(node)) {
      node.rotationQuaternion ??= Quaternion.FromEulerVector(node.rotation);
      rest.set(node, node.rotationQuaternion.clone());
    }
    return rest.get(node);
  };
  const byKey = (list) => Object.fromEntries(list.filter(Boolean).map((n) => [n.name.slice(-2), n]));
  const spins = byKey(truckInfo.spin.nodes.map((name) => nodes(name)));
  const knuckles = byKey(truckInfo.steer.nodes.map((name) => nodes(name)));
  // Which way a positive turn goes, measured in the scene (the model's frame is mirrored into it):
  // +1 when a positive steer turns the wheel's front right, and when a positive spin rolls it forward.
  const turnSign = (node, axis, from, to) => {
    const r = restOf(node);
    const inv = Matrix.Invert(node.computeWorldMatrix(true));
    const local = Vector3.TransformNormal(from, inv);
    node.rotationQuaternion = r.multiply(Quaternion.RotationAxis(axis, 0.1));
    const after = Vector3.TransformNormal(local, node.computeWorldMatrix(true));
    node.rotationQuaternion = r.clone();
    node.computeWorldMatrix(true);
    return Vector3.Dot(after, to) > 0 ? 1 : -1;
  };
  const anyKnuckle = Object.values(knuckles)[0], anySpin = Object.values(spins)[0];
  const steerSign = anyKnuckle ? turnSign(anyKnuckle, Axis.Y, Vector3.Forward(), Vector3.Right()) : 1;
  const spinSign = anySpin ? turnSign(anySpin, Axis.X, Vector3.Up(), Vector3.Forward()) : 1;
  /** How far each tyre has rolled (m): in a turn the outside ones go further. */
  const rolled = { fl: 0, fr: 0, rl: 0, rr: 0 };

  const yoke = yokePivot(scene, nodes);
  const audio = createCabinSound();
  let lastRear = 0;

  const state = { s: p.start, end: p.end, v: 0, heading: 0, yoke: 0, running: false, paused: false, done: false, heldUntil: 0, engagedAt: 0 };

  /** The truck where the physics has it: on the road's surface under its axles, leaning on its springs
   *  and riding its bumps. */
  function placeTruck() {
    const c = car.state;
    const f = at(c.s + WHEELBASE / 2), r = at(c.s - WHEELBASE / 2);
    const grade = -Math.atan2(f.y - r.y, WHEELBASE);     // nose up on a climb
    pose.position.set(c.x, (f.y + r.y) / 2 + feel.heave, c.z);
    pose.rotationQuaternion = Quaternion.RotationYawPitchRoll(c.yaw, grade + c.pitch + feel.pitch, c.roll + feel.roll);
    Object.assign(state, { s: c.s, v: c.v, heading: c.yaw, yoke: c.yoke });
  }

  /** The wheels: each front one at its own Ackermann angle (the inside one turns more), the rears a little. */
  function setWheels(front, rear) {
    const ack = (angle, side) => {
      // Turning about a point WHEELBASE/tan(angle) to the side: the wheel on that side is inside.
      if (Math.abs(angle) < 1e-5) return angle;
      const radius = WHEELBASE / Math.tan(angle);
      return Math.atan(WHEELBASE / (radius - side * TRACK / 2));
    };
    const set = (key, angle) => {
      const n = knuckles[key];
      if (n) n.rotationQuaternion = restOf(n).multiply(Quaternion.RotationAxis(Axis.Y, angle * steerSign));
    };
    // side: +1 for the right-hand wheels (right is +x), -1 for the left.
    set('fl', ack(front, -1));
    set('fr', ack(front, 1));
    set('rl', rear);
    set('rr', rear);
    yoke?.turn(car.state.yoke);
  }

  function settle() {
    ride.reset();
    feel = ride.step(car.state.s, 0);
  }

  function reset() {
    car.reset();
    settle();
    state.running = false;
    state.paused = false;
    state.done = false;
    placeTruck();
    setWheels(0, 0);
    screen.setRide({ state, at, plan: p, road });
  }

  // Where the truck stands when it's parked, as it was when the ride was made (e.g. on a plinth).
  const home = pose.position.clone();
  const homeTurn = pose.rotationQuaternion.clone();

  /** Back where it was parked, wheels straight. */
  function park() {
    state.running = false;
    state.paused = false;
    car.reset();
    settle();
    pose.position.copyFrom(home);
    pose.rotationQuaternion = homeTurn.clone();
    car.state.yoke = 0;
    setWheels(0, 0);
    screen.setRide(null);
    audio.stop();
  }

  /** How much rock or bank is beside the truck on each side, 0 to 1 (bigsur.js). */
  function wallsAt(s) {
    const w = road.walls;
    if (!w) return undefined;
    const f = Math.max(0, Math.min(road.n - 1.001, s / road.step));
    const i = Math.floor(f), t = f - i;
    return { left: w.left[i] * (1 - t) + w.left[i + 1] * t, right: w.right[i] * (1 - t) + w.right[i + 1] * t };
  }

  /** Your head in the truck's frame (position, forward, up), for placing the sounds around you. */
  function headInTruck() {
    const cam = scene.activeCamera;
    if (!cam) return null;
    const inv = Matrix.Invert(pose.computeWorldMatrix(true));
    const pos = Vector3.TransformCoordinates(cam.globalPosition, inv);
    const fwd = Vector3.TransformNormal(cam.getDirection(Vector3.Forward()), inv).normalize();
    const up = Vector3.TransformNormal(cam.getDirection(Vector3.Up()), inv).normalize();
    return { position: [pos.x, pos.y, pos.z], forward: [fwd.x, fwd.y, fwd.z], up: [up.x, up.y, up.z] };
  }

  /** Advances the ride by dt seconds. Returns the truck's movement this frame (a matrix taking last
   *  frame's positions to this frame's, and its turn), for carrying the viewer along. */
  function update(dt, now) {
    const before = pose.computeWorldMatrix(true).clone();
    const heading0 = state.heading;
    const driving = state.running && now >= state.heldUntil;
    // Physics in small steps, so a slow frame doesn't make the yoke overshoot.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) {
      car.step(dt / steps, driving, state.paused ? STOP_DECEL : undefined);
      feel = ride.step(car.state.s, dt / steps);
    }
    if (state.running && car.done()) {
      state.running = false;
      state.done = true;
    }
    placeTruck();
    const c = car.state;
    setWheels(c.front, c.rear);
    for (const key of Object.keys(rolled)) {
      const side = key[1] === 'r' ? 1 : -1;
      rolled[key] += (c.v + side * -c.yawRate * TRACK / 2) * dt;
      const n = spins[key];
      if (n) n.rotationQuaternion = restOf(n).multiply(Quaternion.RotationAxis(Axis.X, (rolled[key] / ROLLING_RADIUS) * spinSign));
    }
    // The cabin's sound, heard from where your head is in the truck.
    const rearRate = dt > 0 ? (c.rear - lastRear) / dt : 0;
    lastRear = c.rear;
    const parked = !state.running && c.v < 0.05;
    audio.update({ v: c.v, ax: c.ax, rearRate, s: c.s, dt, fan: screen.fan, parked, walls: wallsAt(c.s), windows: windows() }, headInTruck());
    const after = pose.computeWorldMatrix(true);
    let dyaw = state.heading - heading0;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    return { delta: before.invert().multiply(after), dyaw };
  }

  return {
    state,
    car,
    sound: audio,
    plan: p,
    reset,
    park,
    update,
    start(now) {
      audio.start();
      audio.chime();
      state.running = true;
      state.engagedAt = now;
      state.heldUntil = now + 2.5;
    },
    /** For checks: put the truck s metres along the lane at its planned speed, settled into the curve. */
    jumpTo(s) {
      const a = at(s);
      Object.assign(car.state, { x: a.x, z: a.z, yaw: a.heading, s, v: a.v, yokeRate: 0 });
      settle();
      for (let i = 0; i < 240; i++) {
        car.step(1 / 120, true);
        feel = ride.step(car.state.s, 1 / 120);
      }
      placeTruck();
    },
    /** Stops where it is, in its lane (to open a door, to step out). */
    pause() {
      if (!state.running) return;
      state.running = false;
      state.paused = true;
    },
    /** Drives on after a pause. */
    resume(now) {
      if (!state.paused) return;
      audio.chime();
      state.paused = false;
      state.running = true;
      state.heldUntil = now + 1.5;
    },
    /** Standing still (stopped on the way, or arrived). */
    get stopped() {
      return !state.running && car.state.v < 0.05;
    },
    stop() {
      state.running = false;
      state.paused = false;
      car.state.v = 0;
      audio.stop();
    },
    dispose() {
      audio.stop();
    },
  };
}

/** The yoke and what's on it turn about the column: the axis is the yoke's own face normal. */
function yokePivot(scene, nodes) {
  const parts = ['int_yoke', 'int_yoke_pods', 'int_yoke_keys'].map((n) => nodes(n)).filter((m) => m?.getTotalVertices?.() > 0);
  if (!parts.length) return null;
  const main = parts[0];
  main.parent?.computeWorldMatrix(true);
  main.computeWorldMatrix(true);
  const pts = worldPoints(main);
  const { mean, axes } = pca(pts);
  // The column runs forward and down from the yoke: of the yoke's two thinner directions, the one
  // closest to straight ahead (its depth can exceed its height, so "thinnest" alone isn't enough).
  let axis = Math.abs(axes[1].z) > Math.abs(axes[2].z) ? axes[1] : axes[2];
  if (axis.z < 0) axis = axis.scale(-1);                // pointing ahead, away from the driver
  const pivot = new TransformNode('yoke-pivot', scene);
  pivot.parent = main.parent;
  // The pivot sits at the yoke's centre, in its parent's frame.
  const inv = Matrix.Invert(main.parent.getWorldMatrix());
  pivot.position = Vector3.TransformCoordinates(mean, inv);
  const localAxis = Vector3.TransformNormal(axis, inv).normalize();
  pivot.rotationQuaternion = Quaternion.Identity();
  for (const m of parts) m.setParent(pivot);
  // Which way is clockwise for the driver: a point above the centre should move right (+x).
  const above = mean.add(new Vector3(0, 0.15, 0));
  const local = Vector3.TransformCoordinates(above, Matrix.Invert(pivot.computeWorldMatrix(true)));
  pivot.rotationQuaternion = Quaternion.RotationAxis(localAxis, 0.1);
  const moved = Vector3.TransformCoordinates(local, pivot.computeWorldMatrix(true));
  pivot.rotationQuaternion = Quaternion.Identity();
  pivot.computeWorldMatrix(true);
  const sign = moved.x > above.x ? 1 : -1;
  return {
    turn(angle) {
      pivot.rotationQuaternion = Quaternion.RotationAxis(localAxis, angle * sign);
    },
  };
}

function worldPoints(mesh) {
  const pos = mesh.getVerticesData('position');
  const m = mesh.getWorldMatrix();
  const out = [];
  for (let i = 0; i < pos.length; i += 3) out.push(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), m));
  return out;
}

/** Principal axes (most to least spread) of a point cloud, by power iteration. */
function pca(pts) {
  const mean = pts.reduce((a, p) => a.addInPlace(p), new Vector3()).scale(1 / pts.length);
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = [p.x - mean.x, p.y - mean.y, p.z - mean.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] += d[i] * d[j];
  }
  const axes = [];
  for (let k = 0; k < 3; k++) {
    let v = [1, 0.3 + k, 0.7 - k];
    for (let it = 0; it < 80; it++) {
      let w = [0, 1, 2].map((i) => c[i][0] * v[0] + c[i][1] * v[1] + c[i][2] * v[2]);
      for (const a of axes) {
        const d = w[0] * a.x + w[1] * a.y + w[2] * a.z;
        w = [w[0] - d * a.x, w[1] - d * a.y, w[2] - d * a.z];
      }
      const l = Math.hypot(...w) || 1;
      v = w.map((x) => x / l);
    }
    axes.push(new Vector3(...v));
  }
  return { mean, axes };
}
