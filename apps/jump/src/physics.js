// The jump's physics, in local metres (x east, y up from the landing, z north) and seconds.
// No Babylon here, so whole jumps can be simulated and tuned in Node (scripts/check-jump-physics.mjs).
//
// Freefall: gravity against body drag in air that thins with height (terminal speed is
// about 62 m/s at the 4,000 m exit and 53 m/s near the ground). Arms: one hand lower turns,
// both swept back tracks forward.
// Opening: pilot chute, bag and line stretch (about 1.6 s), then the canopy inflates over
// about 2 s while the slider holds the deceleration near 3 g, as on a real sport rig.
// Canopy: a ram-air wing as a point mass. Lift and drag come from the brake setting
// (a student 260 sq ft canopy loaded at 0.72 lb/sq ft: about 10 m/s forward and 3.8 m/s
// down at full flight). One toggle banks it and the tilted lift turns it and dives it; both
// toggles slow it, and pulled quickly at speed they flare: lift beats weight for a moment.
// Held too deep for too long it stalls.

export const G = 9.81;
/** Jumper and gear (kg). */
export const MASS = 85;
/** Canopy area (m^2): 260 sq ft. */
export const AREA = 24;
/** Belly-to-earth drag area (m^2): 53 m/s terminal at 1,000 m. */
const BELLY_CDA = 0.534;
/** Times (s) after the pull: pilot chute and bag out, lines at full stretch, canopy fully open. */
export const LINE_STRETCH = 1.6;
const INFLATED = 3.6;
export const OPEN = 4.4;
/** The slider keeps an opening near this deceleration (m/s^2). */
const OPENING_LIMIT = 3.1 * G;

/** Air density (kg/m^3) at `msl` metres above sea level. */
export function airDensity(msl) {
  return 1.225 * Math.exp(-msl / 8434);
}

/** Canopy lift and drag coefficients for a symmetric brake setting 0..1. */
export function coefficients(brake) {
  return { cl: 0.47 + 0.95 * Math.pow(brake, 1.5), cd: 0.19 + 0.7 * brake * brake };
}

/**
 * A wind for one jump: `ground` m/s from bearing `from` (degrees, where it blows from) at 10 m,
 * stronger and veering with height, with slow gusts.
 */
export function createWind({ ground = 3, from = 250, veer = 25, seed = 1 } = {}) {
  const out = { x: 0, y: 0, z: 0 };
  return {
    ground,
    from,
    at(heightAboveGround, t) {
      const h = Math.max(2, heightAboveGround);
      const speed = ground * Math.pow(h / 10, 0.16) * (1 + 0.12 * Math.sin(t * 0.23 + seed) + 0.07 * Math.sin(t * 0.71 + seed * 3));
      const bearing = ((from + veer * Math.min(1, h / 3000)) * Math.PI) / 180;
      // Blowing toward the opposite bearing.
      out.x = -Math.sin(bearing) * speed;
      out.z = -Math.cos(bearing) * speed;
      return out;
    },
  };
}

/**
 * One jumper. `groundAt(x, z)` is the terrain height above the landing; `reference` is the
 * landing's height above sea level.
 */
export function createJumper({ groundAt, reference, wind }) {
  const s = {
    phase: 'exit', // exit, freefall, opening, canopy, landed
    t: 0,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    /** Bearing the jumper (and later the canopy) faces, radians from north toward east. */
    heading: 0,
    yawRate: 0,
    /** Canopy bank (radians, right wing down positive) and swing pitch (positive: canopy behind). */
    bank: 0,
    pitch: 0,
    /** Brake lines as the canopy feels them (0 up .. 1 full), after the toggles' short lag. */
    brakeL: 0,
    brakeR: 0,
    /** Brakes stay set (stowed) until both toggles are taken. */
    stowed: true,
    stall: 0,
    /** Seconds since the pull, and opening progress 0..1 (lines out, then inflation). */
    sincePull: 0,
    lines: 0,
    inflation: 0,
    /** Last frame's acceleration from the air (m/s^2), for the opening shock readout. */
    load: 0,
    landing: null,
  };
  const air = { x: 0, y: 0, z: 0 };

  function aboveGround() {
    return s.pos.y - groundAt(s.pos.x, s.pos.z);
  }

  /** Freefall body drag and tracking lift for `input` { turn -1..1, track 0..1 }. */
  function bodyForce(rho, input, f) {
    const v = Math.hypot(air.x, air.y, air.z) || 1e-6;
    const q = 0.5 * rho * v * v;
    const cda = BELLY_CDA * (1 - 0.35 * input.track);
    const drag = (q * cda) / MASS;
    f.x -= (drag * air.x) / v;
    f.y -= (drag * air.y) / v;
    f.z -= (drag * air.z) / v;
    // A track turns some of the fall into forward speed: about 1:1.2 at full sweep.
    const lift = (q * 0.25 * input.track) / MASS;
    f.x += lift * Math.sin(s.heading);
    f.z += lift * Math.cos(s.heading);
  }

  /** Canopy aerodynamics, scaled by `scale` (inflation). Returns the lift and drag acceleration. */
  function canopyForce(rho, scale, f) {
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    // Air velocity split along the heading (u), across it (side) and vertically (w).
    const u = air.x * fx + air.z * fz;
    const side = air.x * fz - air.z * fx;
    const w = air.y;
    const v2 = u * u + w * w;
    const v = Math.sqrt(v2) || 1e-6;
    const sym = (s.brakeL + s.brakeR) / 2;
    const asym = Math.abs(s.brakeR - s.brakeL);
    let { cl, cd } = coefficients(Math.min(1, sym));
    cd += 0.18 * asym;
    if (s.stall > 0) {
      cl *= 1 - 0.65 * s.stall;
      cd *= 1 + 0.8 * s.stall;
    }
    const q = 0.5 * rho * v2 * AREA * scale;
    // Lift never more than about 1.9 g: the wing pitches back and unloads above that.
    const lift = Math.min(q * cl, 1.9 * MASS * G) / MASS;
    const drag = (q * cd) / MASS;
    // Drag along -air; lift perpendicular to it in the heading's vertical plane, tilted by the bank.
    const du = -u / v;
    const dw = -w / v;
    // Perpendicular to (du, dw), pointing up when the air comes from ahead and below.
    let lu = dw;
    let lw = -du;
    if (lw < 0) {
      lu = -lu;
      lw = -lw;
    }
    const cosBank = Math.cos(s.bank);
    const along = drag * du + lift * lu * cosBank;
    f.x += along * fx;
    f.z += along * fz;
    f.y += drag * dw + lift * lw * cosBank;
    // The banked part of the lift turns the wing (a coordinated turn), it doesn't slide it.
    const horizontal = Math.max(3, Math.abs(u));
    s.yawRate = (lift * Math.sin(s.bank)) / horizontal;
    // Sideways air is cancelled quickly: the wing weathervanes onto its heading.
    const sideDrag = Math.min(1 / 0.35, 0.5 * rho * Math.abs(side) * AREA * 0.45 * scale / MASS) * side;
    f.x -= sideDrag * fz;
    f.z += sideDrag * fx;
    return Math.hypot(along, drag * dw + lift * lw * cosBank);
  }

  return {
    state: s,
    aboveGround,
    /** Stands the jumper still at `pos` facing `heading`, ready to exit. */
    reset(pos, heading) {
      Object.assign(s, {
        phase: 'exit', t: 0, heading, yawRate: 0, bank: 0, pitch: 0, brakeL: 0, brakeR: 0, stowed: true, stall: 0,
        sincePull: 0, lines: 0, inflation: 0, load: 0, landing: null,
      });
      s.pos = { ...pos };
      s.vel = { x: 0, y: 0, z: 0 };
    },
    /** Out of the door, with the push you leave with (m/s). */
    exit(push = { x: 0, y: 0, z: 0 }) {
      if (s.phase !== 'exit') return;
      s.phase = 'freefall';
      s.vel = { ...push };
    },
    pull() {
      if (s.phase !== 'freefall') return false;
      s.phase = 'opening';
      s.sincePull = 0;
      return true;
    },
    /** Takes the toggles: the brakes come out of their stowed setting. */
    takeToggles() {
      s.stowed = false;
    },
    /**
     * Advances `dt` seconds. `input`: freefall { turn, track }, canopy { left, right } (0..1
     * toggle pulls; ignored while the brakes are stowed).
     */
    step(dt, input) {
      if (s.phase === 'exit' || s.phase === 'landed') return;
      s.t += dt;
      const rho = airDensity(s.pos.y + reference);
      const w = wind.at(aboveGround(), s.t);
      air.x = s.vel.x - w.x;
      air.y = s.vel.y - w.y;
      air.z = s.vel.z - w.z;
      const f = { x: 0, y: -G, z: 0 };
      let load = 0;

      if (s.phase === 'freefall') {
        bodyForce(rho, input, f);
        const target = input.turn * 1.2;
        s.yawRate += (target - s.yawRate) * Math.min(1, dt / 0.45);
      } else {
        s.sincePull += dt;
        // Toggles: stowed brakes sit at about 30%; once taken they follow the hands with a short lag.
        const left = s.stowed ? 0.3 : input.left;
        const right = s.stowed ? 0.3 : input.right;
        const lag = Math.min(1, dt / 0.25);
        s.brakeL += (left - s.brakeL) * lag;
        s.brakeR += (right - s.brakeR) * lag;
        let scale = 1;
        if (s.phase === 'opening') {
          s.lines = Math.min(1, s.sincePull / LINE_STRETCH);
          const k = Math.max(0, Math.min(1, (s.sincePull - LINE_STRETCH) / (INFLATED - LINE_STRETCH)));
          s.inflation = k * k * (3 - 2 * k);
          scale = s.inflation * s.inflation;
          // The body still falls through the air until the canopy takes the weight.
          bodyForce(rho, { turn: 0, track: 0 }, f);
          if (s.sincePull >= OPEN) {
            s.phase = 'canopy';
            s.inflation = 1;
          }
        }
        const before = { ...f };
        load = canopyForce(rho, scale, f);
        if (s.phase === 'opening') {
          // The slider: no more than about 3 g from the canopy, however fast the opening.
          const ax = f.x - before.x;
          const ay = f.y - before.y;
          const az = f.z - before.z;
          const a = Math.hypot(ax, ay, az);
          if (a > OPENING_LIMIT) {
            const k = OPENING_LIMIT / a;
            f.x = before.x + ax * k;
            f.y = before.y + ay * k;
            f.z = before.z + az * k;
            load = OPENING_LIMIT;
          }
          s.yawRate *= s.inflation;
        }
        // Bank follows the toggle difference; a full single toggle holds about 45 degrees.
        const bankTarget = (s.brakeR - s.brakeL) * 0.8 * s.inflation;
        s.bank += (bankTarget - s.bank) * Math.min(1, dt / 0.9);
        // Deep brakes held at low speed stall the wing; letting up recovers it.
        const sym = (s.brakeL + s.brakeR) / 2;
        const speed = Math.hypot(air.x, air.z);
        const stalling = s.phase === 'canopy' && sym > 0.9 && speed < 5.5;
        s.stall = Math.max(0, Math.min(1, s.stall + (stalling ? dt / 1.2 : -dt / 0.8)));
        // The jumper swings under the wing: forward when it slows (a flare), back when it speeds up.
        const along = f.x * Math.sin(s.heading) + f.z * Math.cos(s.heading);
        s.pitch += (Math.max(-0.4, Math.min(0.4, -along * 0.06)) - s.pitch) * Math.min(1, dt / 0.6);
      }
      s.load = load;
      s.vel.x += f.x * dt;
      s.vel.y += f.y * dt;
      s.vel.z += f.z * dt;
      s.heading += s.yawRate * dt;
      s.pos.x += s.vel.x * dt;
      s.pos.y += s.vel.y * dt;
      s.pos.z += s.vel.z * dt;

      const ground = groundAt(s.pos.x, s.pos.z);
      if (s.pos.y <= ground) {
        s.pos.y = ground;
        s.landing = {
          sink: -s.vel.y,
          speed: Math.hypot(s.vel.x, s.vel.z),
          canopy: s.phase === 'canopy',
          distance: Math.hypot(s.pos.x - (input.target?.x ?? 0), s.pos.z - (input.target?.z ?? 0)),
        };
        s.phase = 'landed';
        s.vel = { x: 0, y: 0, z: 0 };
        s.yawRate = 0;
        s.bank = 0;
      }
    },
  };
}

/** How a landing went, from its sink rate and ground speed (m/s). */
export function rateLanding({ sink, speed, canopy }) {
  if (!canopy) return { grade: 'fatal', title: 'No canopy', body: 'You hit the ground in freefall. Pull by 1,500 m: the automatic opener is a last resort, not a plan.' };
  if (sink < 1.6 && speed < 5.5) return { grade: 'standup', title: 'Stand-up landing', body: 'A full flare at the right moment: you stepped onto the grass.' };
  if (sink < 3) return { grade: 'soft', title: 'Soft landing', body: 'A slide on your feet and seat, the way students are taught to land.' };
  if (sink < 5) return { grade: 'hard', title: 'Hard landing', body: 'A firm parachute landing fall (feet, calf, thigh, hip, roll). Flare a little later and all the way down.' };
  return { grade: 'injury', title: 'Too hard', body: 'That would hurt. Hold full flight on final, then flare smoothly from about 3 m, both hands all the way down.' };
}
