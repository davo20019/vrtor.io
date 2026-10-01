// Where a press lands (ported from Acento's behavior/pressAim.ts). Pulling a
// controller's trigger tips the controller down, and Babylon clicks with the
// ray of the frame the trigger counts as pressed, near the end of the pull, by
// which time the ray has slid off the button you were pointing at (onto the
// gap or the button below). A pinch shifts a hand's ray the same way. So a
// press uses what the ray hit just before the pull began: the last frame the
// trigger was still at rest, or, for a source without a trigger value (a
// hand), a moment earlier.

/** Trigger travel (0..1) below which the trigger counts as at rest. */
export const PULL_START = 0.1;
/** A pull longer than this is a drag, not a click: the press uses the ray as it is. */
export const MAX_PULL_MS = 400;
/** How far back a press without a trigger value (a pinch) looks. */
export const PINCH_LOOKBACK_MS = 120;
/** History kept per pointer. */
const KEEP_MS = 500;

export class PressAim {
  constructor() {
    this.history = new Map();
  }

  /** Records what `pointerId`'s ray hits this frame and how far its trigger is pulled (null: no trigger). */
  sample(pointerId, pick, value, t) {
    let samples = this.history.get(pointerId);
    if (!samples) this.history.set(pointerId, (samples = []));
    samples.push({ t, pick, value });
    while (samples.length > 1 && t - samples[0].t > KEEP_MS) samples.shift();
  }

  /** The pick a press at `t` should use instead of `current`. */
  pickFor(pointerId, current, t) {
    const samples = this.history.get(pointerId);
    if (!samples?.length) return current;
    const latest = samples[samples.length - 1];
    let aim;
    if (latest.value === null) {
      for (let i = samples.length - 1; i >= 0; i--) {
        if (t - samples[i].t >= PINCH_LOOKBACK_MS) {
          aim = samples[i];
          break;
        }
      }
    } else {
      for (let i = samples.length - 1; i >= 0; i--) {
        const value = samples[i].value;
        if (value !== null && value < PULL_START) {
          aim = samples[i];
          break;
        }
      }
    }
    if (!aim || t - aim.t > MAX_PULL_MS || !aim.pick.hit) return current;
    return aim.pick;
  }
}
