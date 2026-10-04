// The road under the tyres: Highway 1's chip seal isn't flat at the scale of a tyre. The elevation
// data gives its line over metres; this adds the last few millimetres (a gentle long swell, a short
// ripple, cracks and seams across it) and the body's answer to them on its springs. Without it the
// truck glides like it's flying. The same road every ride: it's a function of the distance along it.
import { TRACK, WHEELBASE } from './steering.js';

const TAU = 2 * Math.PI;
const frac = (x) => x - Math.floor(x);
const hash = (x) => frac(Math.sin(x * 12.9898) * 43758.5453);

/** Unevenness along each wheel track: [wavelength m, amplitude m]. Old chip seal, smoothed by the tyre. */
const WAVES = [[13, 0.0035], [6.5, 0.0025], [3.3, 0.0016], [1.7, 0.0008]];
/** How much of each wave both tracks share (the rest is each track's own, which rocks the body). */
const SHARED = 0.6;
const CRACK_HEIGHT = 0.005;    // m, the strongest seam's step, as the tyre rides over it
const CRACK_WIDTH = 0.35;      // m, about the tyre's contact patch: it can't feel anything narrower

/** Cracks and patch seams across the road, at whole metres: on average one every ~65 m. Asphalt's
 *  transverse cracks are thermal, about 15 per km where it gets cold; Big Sur's coast barely frosts. */
export const isCrack = (x) => hash(x) < 0.015;
/** How hard a crack hits, 0.5 to 1. */
export const crackStrength = (x) => 0.5 + 0.5 * Math.abs(Math.sin(x * 7.1));

/** The road's height above its smooth line (m), s metres along, under one wheel track (side -1 left, +1 right). */
export function surface(s, side) {
  let h = 0;
  WAVES.forEach(([wave, amp], k) => {
    const shared = Math.sin((TAU * s) / wave + hash(k + 1) * TAU);
    const own = Math.sin((TAU * s) / wave + hash(k + 11 + side) * TAU);
    h += amp * (SHARED * shared + (1 - SHARED) * own);
  });
  // The nearest seam, if any, under the contact patch.
  for (const x of [Math.floor(s), Math.ceil(s)]) {
    const d = Math.abs(s - x);
    if (d < CRACK_WIDTH / 2 && isCrack(x)) h += CRACK_HEIGHT * crackStrength(x) * Math.cos((Math.PI * d) / CRACK_WIDTH) ** 2;
  }
  return h;
}

/** The body on its air springs: about 1.4 Hz, well damped, with a little of the road's sharpness coming through the tyres and bushings. */
const BODY_HZ = 1.4, BODY_DAMP = 0.35, HARSH = 0.1;

/**
 * The body's movement over the road's unevenness: heave (m), pitch and roll (rad, in the vehicle's
 * own sense: pitch positive nose down, roll positive left side down). Step it with the distance s.
 */
export function createRide() {
  const w = TAU * BODY_HZ;
  const modes = () => ({ x: 0, v: 0, u: null });
  let m = { heave: modes(), pitch: modes(), roll: modes() };

  /** One mode: a spring-damper following its input u. */
  function follow(mode, u, dt) {
    const du = mode.u === null || dt <= 0 ? 0 : (u - mode.u) / dt;
    if (mode.u === null) mode.x = u;
    mode.u = u;
    const a = w * w * (u - mode.x) + 2 * BODY_DAMP * w * (du - mode.v);
    mode.v += a * dt;
    mode.x += mode.v * dt;
    return mode.x + HARSH * (u - mode.x);
  }

  return {
    reset() {
      m = { heave: modes(), pitch: modes(), roll: modes() };
    },
    step(s, dt) {
      const front = s + WHEELBASE / 2, rear = s - WHEELBASE / 2;
      const fl = surface(front, -1), fr = surface(front, 1), rl = surface(rear, -1), rr = surface(rear, 1);
      return {
        heave: follow(m.heave, (fl + fr + rl + rr) / 4, dt),
        pitch: follow(m.pitch, (rl + rr - fl - fr) / 2 / WHEELBASE, dt),
        roll: follow(m.roll, (fr + rr - fl - rl) / 2 / TRACK, dt),
      };
    },
  };
}
