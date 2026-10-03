// Reports from a headset under test, for reading on the dev machine (scripts/headset-log-plugin.js):
// on dev.vrtor.io and localhost only, every couple of seconds the page posts `state()` (whatever
// the subject wants to see: fps, phase, speeds), notes (headsetNote, from any module, such as the
// pointer reports in xr.js) and any errors and console warnings since the last post. Production
// has no endpoint, so it never runs there.
const DEV_HOSTS = ['dev.vrtor.io', 'localhost', '127.0.0.1'];
export const headsetLogging = typeof location !== 'undefined' && DEV_HOSTS.includes(location.hostname);

const queue = [];
let started = false;
function push(kind, data) {
  if (!headsetLogging) return;
  // Browser extensions on a desktop test aren't the page's problem.
  if (/chrome-extension:|moz-extension:/.test(`${data.message ?? ''} ${data.at ?? ''}`)) return;
  queue.push({ t: new Date().toISOString().slice(11, 23), kind, ...data });
  if (queue.length > 300) queue.splice(0, queue.length - 300);
}

/** Something worth seeing right away (a phase change, a press, a landing). */
export function headsetNote(message, data = {}) {
  push('note', { message, ...data });
}

/** Starts posting; `state()` is sampled with every post. Safe to call once per page. */
export function startHeadsetLog(state = () => ({}), { every = 2000 } = {}) {
  if (!headsetLogging || started) return { note: headsetNote };
  started = true;
  const url = `${import.meta.env?.BASE_URL ?? '/'}__log`;
  addEventListener('error', (e) => push('error', { message: e.message, at: `${e.filename}:${e.lineno}` }));
  addEventListener('unhandledrejection', (e) => push('error', { message: String(e.reason?.stack || e.reason) }));
  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      push(level, { message: args.map((a) => (a instanceof Error ? a.stack : typeof a === 'object' ? safe(a) : String(a))).join(' ').slice(0, 2000) });
      original(...args);
    };
  }
  push('start', { ua: navigator.userAgent, url: location.href });
  setInterval(() => {
    try {
      push('state', state());
    } catch (error) {
      push('error', { message: `state(): ${error.message}` });
    }
    const batch = queue.splice(0);
    fetch(url, { method: 'POST', body: JSON.stringify(batch), keepalive: true }).catch(() => undefined);
  }, every);
  return { note: headsetNote };
}

function safe(value) {
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}
