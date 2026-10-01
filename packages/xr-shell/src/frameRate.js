// The display refresh to ask for (ported from Acento's scene/xrFrameRate.ts).
// The Quest browser runs WebXR at 90 Hz unless asked otherwise; a frame that
// misses its refresh waits for the next one and gets reprojected (smears). A
// scene starts at the highest supported rate up to MAX_FRAME_RATE; if a window
// of frames runs late it steps down, never below MIN_FRAME_RATE.

export const MAX_FRAME_RATE = 90;
export const MIN_FRAME_RATE = 72;

/** Frames per judging window (about two seconds). */
const WINDOW_FRAMES = 150;
/** A frame counts as late past this multiple of the refresh period. */
const LATE_FACTOR = 1.5;
/** Longer gaps are hitches (loading, a GC, the headset menu), not load. */
const HITCH_MS = 250;
/** Share of late frames in a window that steps the rate down. */
const DOWN_SHARE = 0.2;

export class FrameRateGovernor {
  constructor(supported) {
    this.rates = Array.from(supported ?? [])
      .map((rate) => Math.round(rate))
      .filter((rate) => rate >= MIN_FRAME_RATE && rate <= MAX_FRAME_RATE)
      .sort((a, b) => a - b);
    this.index = this.rates.length - 1;
    this.frames = 0;
    this.late = 0;
    this.holdMs = 0;
  }

  /** The rate to ask for; null when the browser can't change it. */
  get target() {
    return this.rates[this.index] ?? null;
  }

  /** Whether the refresh can't go any lower (or can't be changed at all). */
  get atMinimum() {
    return this.index <= 0;
  }

  /** Ignore frame times for a while (a scene is loading). */
  hold(seconds) {
    this.holdMs = Math.max(this.holdMs, seconds * 1000);
  }

  /** One frame, `dtMs` after the last at a refresh of `periodMs`; returns a new rate to ask for, or null. */
  sample(dtMs, periodMs) {
    if (this.holdMs > 0) {
      this.holdMs -= dtMs;
      return null;
    }
    if (this.index <= 0 || !(dtMs > 0) || dtMs > HITCH_MS || !(periodMs > 0)) return null;
    this.frames++;
    if (dtMs > periodMs * LATE_FACTOR) this.late++;
    if (this.frames < WINDOW_FRAMES) return null;
    const share = this.late / this.frames;
    this.frames = 0;
    this.late = 0;
    if (share <= DOWN_SHARE) return null;
    this.index--;
    return this.target;
  }
}
