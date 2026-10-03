// The truck's steering and motion for the self-driving ride, as plain numbers (no scene), so it can
// be checked on its own (scripts/check-cyb-steering.mjs).
//
// The chain, as in the truck: a driver (here the self-driving controller) turns the yoke; the yoke
// has inertia and a top turning speed; steer-by-wire turns the front wheels by the yoke angle over a
// ratio that depends on speed, and turns the rear wheels a little too; the wheels move the truck
// (a bicycle model with four-wheel steer and some understeer); the body leans on its suspension.
//
// Published: 340 degrees lock to lock, 170 each way (Tesla, Cybertruck specifications); the ratio
// is about 5:1 at parking speeds and about 12:1 at highway speeds (reported, not published by
// Tesla); rear steer up to about 3 degrees, opposite to the fronts at low speed and with them at
// speed; a 13.26 m kerb-to-kerb turning circle. Full lock at the front then works out to about 30
// degrees, which is 170 / 30 = 5.6:1, in line with the reported low-speed ratio.
// Estimated, not published: the speeds where the ratio changes, how quickly the yoke can be turned,
// the understeer, and how far the body leans.

export const WHEELBASE = 3.635;                    // m, between the model's axles (143.1 in)
export const TRACK = 1.772;                        // m, between the tyres' centres
export const YOKE_MAX = (170 * Math.PI) / 180;     // each way
const DEG = Math.PI / 180;
const RATIO_SLOW = 5.6, RATIO_FAST = 12;           // yoke turn per front-wheel turn
const RATIO_FROM = 4.5, RATIO_TO = 22;             // m/s: 10 mph to 50 mph, eased between
const REAR_MAX = 3 * DEG;
const REAR_FLIP = 15;                              // m/s: below, rears turn against the fronts; above, with them
const UNDERSTEER = 0.0028;                         // rad of extra front steer per m/s² of sideways pull
// The yoke as the controller moves it: a stiff, well-damped follow of the angle asked for, never
// faster than a calm driver's hands (FSD turns the yoke smoothly, without snaps).
const YOKE_W = 9;                                  // rad/s, how briskly it follows
const YOKE_DAMP = 0.95;
const YOKE_RATE = 220 * DEG;                       // rad/s, most it turns per second
const YOKE_ACCEL = 900 * DEG;                      // rad/s²
// Body lean on the air suspension, per m/s² of sideways or fore-and-aft push, and how fast it settles.
const ROLL_PER = 0.45 * DEG, PITCH_PER = 0.35 * DEG, LEAN_TAU = 0.3;

// ---------------------------------------------------------------- the plan

/** The controller's settings: how far ahead it reads the curve (m, and s at speed) and how firmly it
 *  corrects heading and drift, and how much it smooths the road's curvature. Tuned with scripts/check-cyb-steering.mjs on the real road. */
export const TUNING = { previewM: 0.5, previewS: 0.2, headingTau: 0.5, driftRate: 1.5, curvSigmaM: 5 };

export const LIMIT = 55 * 0.44704;            // Highway 1's posted 55 mph, in m/s
const LATERAL = 2.0;                   // m/s², the most sideways push it allows in a curve
export const ACCEL = 1.1;                     // m/s²
export const DECEL = 1.6;                     // m/s²
export const LANE_OFFSET = 1.8;               // m right of the centre line: the middle of the right lane
const START_AT = 14;                   // m along the road: just clear of the bridge
const STOP_BEFORE = 30;                // m before the end of the data

/** The plan: speed at every road point, given the curves ahead and behind. */
export function plan(road) {
  const { n, step, px, pz } = road;
  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    heading[i] = Math.atan2(px[b] - px[a], pz[b] - pz[a]);
  }
  const curv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    let d = heading[b] - heading[a];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    curv[i] = d / ((b - a) * step);                     // 1/m, positive turning right
  }
  // Roads bend in smooth transitions; the mapped line has small kinks. Smooth the curvature over
  // ~10 m so the yoke follows the bends, not the kinks.
  const sigma = TUNING.curvSigmaM / step, half = Math.ceil(sigma * 3);
  const raw = curv.slice();
  for (let i = 0; i < n; i++) {
    let sum = 0, w = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      const g = Math.exp(-0.5 * ((j - i) / sigma) ** 2);
      sum += raw[j] * g;
      w += g;
    }
    curv[i] = sum / w;
  }
  // Look at the tightest curve within 20 m either way, so it has slowed before the curve, not in it.
  const look = Math.round(20 / step);
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let j = Math.max(0, i - look); j <= Math.min(n - 1, i + look); j++) k = Math.max(k, Math.abs(curv[j]));
    v[i] = Math.min(LIMIT, Math.sqrt(LATERAL / Math.max(k, 1e-6)));
  }
  const first = Math.round(START_AT / step), last = n - 1 - Math.round(STOP_BEFORE / step);
  for (let i = 0; i <= first; i++) v[i] = 0;
  for (let i = last; i < n; i++) v[i] = 0;
  for (let i = first + 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * ACCEL * step));
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * DECEL * step));
  // Pull away from rest: a little speed at the start point so it can move off it.
  v[first] = 0.6;
  return { heading, curv, v, start: first * step, end: last * step };
}


/** The lane's centre s metres along: position, heading, curvature and planned speed. */
export function laneOf(road, p) {
  return (s) => {
    const f = Math.max(0, Math.min(road.n - 1.001, s / road.step));
    const i = Math.floor(f), t = f - i;
    const lerp = (a) => a[i] * (1 - t) + a[i + 1] * t;
    let dh = p.heading[i + 1] - p.heading[i];
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    return {
      x: lerp(road.px) + lerp(road.rx) * LANE_OFFSET,
      y: lerp(road.py),
      z: lerp(road.pz) + lerp(road.rz) * LANE_OFFSET,
      heading: p.heading[i] + dh * t,
      // The lane runs inside or outside the centre line's curves: its own curvature.
      curv: lerp(p.curv) / (1 - LANE_OFFSET * lerp(p.curv)),
      v: lerp(p.v),
    };
  };
}

// ---------------------------------------------------------------- the truck

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Yoke turn per front-wheel turn at speed v (m/s). */
export function ratioAt(v) {
  return RATIO_SLOW + (RATIO_FAST - RATIO_SLOW) * smooth((v - RATIO_FROM) / (RATIO_TO - RATIO_FROM));
}

/** Rear-wheel angle for a front-wheel angle, at speed v: against the fronts when slow, with them when fast. */
export function rearFor(front, v) {
  const gain = v < REAR_FLIP ? -0.1 * (1 - v / REAR_FLIP) : 0.04 * smooth((v - REAR_FLIP) / 8);
  return clamp(front * gain, -REAR_MAX, REAR_MAX);
}

/**
 * A truck on the road, driven along the lane by the controller. `lane(s)` gives the lane's centre
 * s metres along: { x, z, heading, curv, v } (heading clockwise from north, curv positive turning
 * right, v the planned speed). Angles positive to the right.
 */
export function createVehicle(lane, { start, end, accel, decel }) {
  const st = {};
  function reset() {
    const a = lane(start);
    Object.assign(st, {
      x: a.x, z: a.z, yaw: a.heading, v: 0, s: start,
      yoke: 0, yokeRate: 0, front: 0, rear: 0,
      yawRate: 0, ay: 0, ax: 0, roll: 0, pitch: 0,
      error: 0, headingError: 0,
    });
  }
  reset();

  /** The nearest point of the lane to the truck, searched near the last one. */
  function project() {
    let best = st.s, bestD = Infinity;
    for (let s = st.s - 2; s <= st.s + 6; s += 0.25) {
      const a = lane(s);
      const d = (a.x - st.x) ** 2 + (a.z - st.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    // Refine along the tangent, so the nearest point moves smoothly rather than in 25 cm jumps.
    for (let it = 0; it < 2; it++) {
      const q = lane(best);
      best += (st.x - q.x) * Math.sin(q.heading) + (st.z - q.z) * Math.cos(q.heading);
    }
    st.s = best;
    const a = lane(best);
    // Right of the lane's centre is positive.
    st.error = (st.x - a.x) * Math.cos(a.heading) - (st.z - a.z) * Math.sin(a.heading);
    st.headingError = wrap(st.yaw - a.heading);
    return a;
  }

  /** The yoke angle the controller wants: what the curve ahead needs, plus corrections back to the lane. */
  function wanted(a) {
    const v = st.v;
    // Feed forward the curvature a moment ahead (it turns in as the curve arrives, not after).
    const ahead = lane(st.s + TUNING.previewM + v * TUNING.previewS);
    const k = ahead.curv;
    // Net steer the wheels need for that curve, understeer included (front minus rear, small angles).
    let net = Math.atan(WHEELBASE * k) + UNDERSTEER * v * v * k;
    // Corrections, one inside the other: drift off the lane's centre sets the heading to aim for
    // (closing the drift over ~1/driftRate s), and the heading is brought there over headingTau s.
    // Both slower than the yoke can move, so the two never ring against each other.
    const aim = -Math.atan((TUNING.driftRate * st.error) / (v + 1));
    net += (WHEELBASE / (TUNING.headingTau * (v + 1))) * wrap(aim - st.headingError);
    // Front angle for that net, given the rears' share.
    const g = rearFor(1, v);
    const front = net / (1 - g);
    return clamp(front * ratioAt(v), -YOKE_MAX, YOKE_MAX);
  }

  /** One step: dt seconds; drive: whether it's driving itself (else it slows to a stop, at `brake` m/s²). */
  function step(dt, drive, brake = decel) {
    const a = project();
    // Speed: follow the plan within the truck's comfort limits.
    const v0 = st.v;
    if (drive) {
      const target = lane(st.s).v;
      st.v = Math.max(0, st.v + clamp(target - st.v, -decel * dt, accel * dt));
    } else {
      st.v = Math.max(0, st.v - brake * dt);
    }
    st.ax = (st.v - v0) / Math.max(dt, 1e-6);

    // The yoke: a damped follow of the wanted angle, its speed and acceleration capped.
    const target = drive || st.v > 0 ? wanted(a) : st.yoke;
    const acc = clamp(YOKE_W * YOKE_W * (target - st.yoke) - 2 * YOKE_DAMP * YOKE_W * st.yokeRate, -YOKE_ACCEL, YOKE_ACCEL);
    st.yokeRate = clamp(st.yokeRate + acc * dt, -YOKE_RATE, YOKE_RATE);
    st.yoke = clamp(st.yoke + st.yokeRate * dt, -YOKE_MAX, YOKE_MAX);
    if (Math.abs(st.yoke) === YOKE_MAX) st.yokeRate = 0;

    // Steer-by-wire: the wheels from the yoke.
    st.front = st.yoke / ratioAt(st.v);
    st.rear = rearFor(st.front, st.v);

    // The truck moves (kinematic bicycle about the midpoint of the axles, with understeer).
    const net = Math.tan(st.front) - Math.tan(st.rear);
    const slip = Math.atan((Math.tan(st.front) + Math.tan(st.rear)) / 2);
    st.yawRate = (st.v * Math.cos(slip) * net) / (WHEELBASE + (UNDERSTEER * st.v * st.v));
    st.yaw = wrap(st.yaw + st.yawRate * dt);
    const dir = st.yaw + slip;
    st.x += Math.sin(dir) * st.v * dt;
    st.z += Math.cos(dir) * st.v * dt;
    st.ay = st.v * st.yawRate;

    // The body leans out of turns and dips under braking, settling on its springs.
    const k = 1 - Math.exp(-dt / LEAN_TAU);
    st.roll += (st.ay * ROLL_PER - st.roll) * k;
    st.pitch += (-st.ax * PITCH_PER - st.pitch) * k;
    return st;
  }

  return { state: st, reset, step, done: () => st.s >= end - 0.5 && st.v < 0.05 };
}
