// The truck's radio: live internet streams from stations on and near the Central Coast, played by
// the browser's own audio element (no Web Audio, so the streams need no CORS). Live streams can't be
// paused and resumed where they were: pause stops it, play starts it again at the live edge.

export const STATIONS = [
  { name: 'KAZU 90.3', sub: 'Monterey Bay public radio', url: 'https://kazu.streamguys1.com/kazu.mp3' },
  { name: 'KDFC', sub: 'Classical California', url: 'https://14923.live.streamtheworld.com/KDFCFMAAC96_SC' },
  { name: 'KCRW 89.9', sub: 'Santa Monica public radio', url: 'https://streams.kcrw.com/kcrw_mp3' },
  { name: 'Radio Paradise', sub: 'Eclectic, from Paradise, California', url: 'https://stream.radioparadise.com/mp3-192' },
  { name: 'Smooth Jazz', sub: 'SmoothJazz.com, Monterey', url: 'https://smoothjazz.cdnstream1.com/2585_64.aac' },
  { name: 'NOAA Weather', sub: 'KEC49, the Monterey forecast', url: 'https://wxradio.org/CA-Monterey-KEC49' },
];

const VOLUME_STEPS = 10;

export function createRadio(onChange = () => {}) {
  const audio = new Audio();
  audio.preload = 'none';
  /** station: index in STATIONS; status: off, connecting, playing or error; volume 0..10. */
  const state = { station: 0, status: 'off', volume: 6, muted: false };
  const set = (patch) => {
    Object.assign(state, patch);
    onChange(state);
  };
  const apply = () => {
    audio.volume = state.muted ? 0 : (state.volume / VOLUME_STEPS) ** 1.5;
  };
  apply();
  audio.addEventListener('playing', () => set({ status: 'playing' }));
  audio.addEventListener('waiting', () => state.status !== 'off' && set({ status: 'connecting' }));
  audio.addEventListener('error', () => state.status !== 'off' && set({ status: 'error' }));

  function play(i = state.station) {
    set({ station: (i + STATIONS.length) % STATIONS.length, status: 'connecting' });
    audio.src = STATIONS[state.station].url;
    audio.play().catch((err) => {
      if (err.name === 'AbortError') return;           // another station was picked meanwhile
      console.warn('[cyb] radio', err);
      set({ status: 'error' });
    });
  }
  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    set({ status: 'off' });
  }

  return {
    state,
    stations: STATIONS,
    play,
    stop,
    get on() {
      return state.status !== 'off';
    },
    toggle() {
      if (this.on) stop();
      else play();
    },
    next() {
      play(state.station + 1);
    },
    prev() {
      play(state.station - 1);
    },
    volume(delta) {
      set({ volume: Math.max(0, Math.min(VOLUME_STEPS, state.volume + delta)), muted: false });
      apply();
    },
    mute() {
      set({ muted: !state.muted });
      apply();
    },
  };
}
