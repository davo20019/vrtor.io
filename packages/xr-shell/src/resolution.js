// Adaptive eye-buffer resolution (ported from Acento's scene/xrResolution.ts).
// The WebGL layer is allocated large and each frame renders into a share of
// it (XRView.requestViewportScale): sharp while the scene keeps up, backing
// off before it drops frames. Scales are relative to the browser's default
// eye-buffer size, like `framebufferScaleFactor`.

/** Frames per judging window (about a second at 72-90 Hz). */
const WINDOW_FRAMES = 80;
/** A frame counts as dropped past this multiple of the refresh period. */
const LATE_FACTOR = 1.5;
/** Longer gaps are hitches (loading, a GC, the headset menu), not load. */
const HITCH_MS = 250;
/** Share of late frames in a window that steps the resolution down. */
const DOWN_SHARE = 0.08;
/** Share of late frames still counted as clean. */
const CLEAN_SHARE = 0.01;
/** Clean windows in a row before stepping up. */
const CLEAN_WINDOWS_TO_RAISE = 3;
const STEP_DOWN = 0.1;
const STEP_UP = 0.05;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 100) / 100;

export class AdaptiveResolution {
  constructor({ allocated, start, floor, ceiling = allocated }) {
    this.allocated = allocated;
    this.ceiling = Math.min(ceiling, allocated);
    this.floor = Math.min(floor, this.ceiling);
    this.scale = clamp(start, this.floor, this.ceiling);
    this.frames = 0;
    this.late = 0;
    this.cleanWindows = 0;
    this.holdMs = 0;
  }

  /** The share of the allocated layer to render: the value for `requestViewportScale`. */
  get viewportScale() {
    return this.scale / this.allocated;
  }

  /** Stop judging for a while (a scene is loading: its hitches aren't load). */
  hold(seconds) {
    this.holdMs = Math.max(this.holdMs, seconds * 1000);
    this.frames = 0;
    this.late = 0;
    this.cleanWindows = 0;
  }

  /** One frame: `dtMs` since the last, at a display refresh of `periodMs`. */
  sample(dtMs, periodMs) {
    if (this.holdMs > 0) {
      this.holdMs -= dtMs;
      return;
    }
    if (!(dtMs > 0) || dtMs > HITCH_MS || !(periodMs > 0)) return;
    this.frames++;
    if (dtMs > periodMs * LATE_FACTOR) this.late++;
    if (this.frames < WINDOW_FRAMES) return;

    const share = this.late / this.frames;
    this.frames = 0;
    this.late = 0;
    if (share > DOWN_SHARE) {
      this.scale = Math.max(this.floor, round(this.scale - STEP_DOWN));
      this.cleanWindows = 0;
    } else if (share <= CLEAN_SHARE) {
      if (++this.cleanWindows >= CLEAN_WINDOWS_TO_RAISE) {
        this.scale = Math.min(this.ceiling, round(this.scale + STEP_UP));
        this.cleanWindows = 0;
      }
    } else {
      this.cleanWindows = 0;
    }
  }
}
