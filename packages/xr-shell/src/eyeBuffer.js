// How large to allocate the eye buffer, with a safety net (ported from Acento's scene/eyeBuffer.ts).
// Above the size known to work on a Quest 3 (`safe`), a session may try up to
// `target`. The attempt is recorded before entering and confirmed once frames
// render; an entry that fails, or a page that dies before confirming, makes
// every later session use `safe`: a buffer too large for the headset's memory
// must not lock anyone out of VR.

const STORAGE_KEY = 'vrtor.xr.eyeBuffer.v1';

export function chooseEyeBufferScale({ safe, target, failedBefore }) {
  return failedBefore ? safe : Math.max(safe, target);
}

/** The attempt record in localStorage (reads and writes never throw). */
export function eyeBufferMemory() {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  };
  const write = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // No storage: the net just doesn't persist.
    }
  };
  // An attempt left pending by the last page never rendered: treat it as failed.
  const initial = read();
  if (initial.pending) write({ failed: initial.pending });

  return {
    failedBefore: () => !!read().failed,
    attempt: (scale) => write({ ...read(), pending: scale }),
    confirm() {
      const { failed } = read();
      write(failed ? { failed } : {});
    },
    fail() {
      const { pending, failed } = read();
      if (pending) write({ failed: pending });
      else if (failed) write({ failed });
    },
  };
}
