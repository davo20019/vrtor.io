// Other people in the same subject, live: a head count for everyone, and for
// those who choose to be visible, avatars (avatar.js), spatial voice (voice.js),
// a chime and a notice when people arrive or leave, and a name they can choose.
// The server side is apps/home/src/presence.js.
//
// Nobody is visible or heard until they join; the mic stays off until they turn
// it on. Tapping someone's avatar mutes them for you only.
import { PointerEventTypes } from '@babylonjs/core';
import { createAvatar } from './avatar.js';
import { createToast } from './toast.js';
import { createVoice } from './voice.js';

const SEND_INTERVAL_MS = 100;
/** Resend an unchanged pose this often, so late joiners and the room stay current. */
const HEARTBEAT_MS = 2000;
const RECONNECT_MS = [1000, 3000, 8000, 20000];
/** At most one arrival/departure chime this often, however many people come and go. */
const CHIME_GAP_MS = 1500;
const NAME_KEY = 'vrtor.presence.name';

const storedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const storeName = (name) => {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {}
};

/**
 * `subject` is the three-letter code. `getPose()` returns where you are now, or null
 * while you're between places: { area, head: Vector3 (eyes), forward: Vector3,
 * left?: Vector3, right?: Vector3 } (hands, in the headset). Positions are only
 * compared between people in the same `area`. `onChange(state)` fires whenever
 * what the UI shows changes.
 */
export function createPresence(scene, { subject, getPose, onChange }) {
  const state = {
    status: 'connecting', // connecting | online | offline | off
    here: 0, // visible people, you included
    online: 0, // everyone with the page open in this room instance
    joined: false,
    voice: false, // the server relays voice
    micOn: false,
    micLive: false, // you're making sound right now
    micError: '',
    me: null, // { id, name, color }
    notice: null, // { text, n }: the latest arrival, departure or name change, to show briefly
  };
  const avatars = new Map();
  let ws = null;
  let attempt = 0;
  let wantJoined = false;
  let lastSent = 0;
  let lastPose = '';
  let lastLevels = 0;
  let myArea = null;
  let lastChime = 0;
  let notices = 0;
  /** A name asked for with setName() that the server hasn't answered yet. */
  let pendingName = null;
  /** The saved name sent with the last join: kept quietly if allowed. */
  let joinName = null;
  const toast = createToast(scene);

  const inXr = () => scene.activeCamera?.getClassName() === 'WebXRCamera';

  /** Shows a short notice (in HTML through onChange, and floating ahead in the headset). */
  function notify(text, chime = null) {
    state.notice = { text, n: ++notices };
    const camera = scene.activeCamera;
    if (inXr()) toast.show(text, camera, state.me?.color);
    const now = performance.now();
    if (chime !== null && now - lastChime > CHIME_GAP_MS) {
      lastChime = now;
      voice.chime(chime);
    }
  }

  const changed = () => onChange?.({ ...state, people: [...avatars.values()].map((a) => a.info()) });

  const voice = createVoice({
    signal: (to, d) => send({ t: 'signal', to, d }),
    onActivity: (id, speaking) => avatars.get(id)?.setSpeaking(speaking),
  });

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function connect() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/presence/${subject}`;
    const socket = new WebSocket(url);
    ws = socket;
    let opened = false;
    socket.onopen = () => {
      opened = true;
      attempt = 0;
    };
    socket.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      receive(msg);
    };
    socket.onclose = () => {
      if (ws !== socket) return;
      ws = null;
      clearPeople();
      voice.stop();
      state.joined = false;
      state.micOn = false;
      state.micLive = false;
      // Refused several times in a row (presence switched off, or every room full): try much later.
      const refused = !opened && attempt >= 3;
      state.status = refused ? 'off' : 'offline';
      changed();
      setTimeout(connect, refused ? 60000 : RECONNECT_MS[Math.min(attempt++, RECONNECT_MS.length - 1)]);
    };
  }

  function receive(msg) {
    if (msg.t === 'hello') {
      state.me = { id: msg.id, name: msg.name, color: msg.color };
      state.voice = !!msg.voice;
      state.status = 'online';
      if (wantJoined) sendJoin();
    } else if (msg.t === 'count') {
      state.here = msg.here;
      state.online = msg.online;
    } else if (msg.t === 'peers') {
      for (const p of msg.peers) addPerson(p);
      const n = msg.peers.length;
      if (n) notify(`${n} ${n === 1 ? 'person is' : 'people are'} here with you`);
    } else if (msg.t === 'joined') {
      if (!state.joined) return;
      addPerson(msg.peer);
      notify(`${msg.peer.name} joined`, true);
    } else if (msg.t === 'left') {
      const avatar = avatars.get(msg.id);
      if (!avatar) return;
      notify(`${avatar.name} left`, false);
      removePerson(msg.id);
    } else if (msg.t === 'renamed') {
      const avatar = avatars.get(msg.id);
      if (!avatar) return;
      notify(`${avatar.name} is now ${msg.name}`);
      avatar.setName(msg.name);
    } else if (msg.t === 'you') {
      if (!state.me) return;
      state.me.name = msg.name;
      if (msg.rejected && (pendingName !== null || joinName)) {
        // Not allowed (or taken): forget it so it isn't sent again, and say why.
        storeName('');
        notify(`That name can't be used. You're ${msg.name}.`);
      } else if (pendingName !== null) {
        notify(`You're now ${msg.name}`);
      }
      pendingName = joinName = null;
    } else if (msg.t === 'pose') {
      avatars.get(msg.id)?.setPose(msg.p);
      return; // positions don't change the UI
    } else if (msg.t === 'signal') {
      if (state.voice) voice.handle(msg.from, msg.d);
      return;
    }
    changed();
  }

  function addPerson(p) {
    if (!state.joined || avatars.has(p.id) || p.id === state.me?.id) return;
    const avatar = createAvatar(scene, p);
    avatars.set(p.id, avatar);
    if (p.p) avatar.setPose(p.p, true);
    if (state.voice) voice.addPeer(p.id);
  }

  function removePerson(id) {
    avatars.get(id)?.dispose();
    avatars.delete(id);
    voice.removePeer(id);
  }

  function clearPeople() {
    for (const id of [...avatars.keys()]) removePerson(id);
  }

  function encode(pose) {
    const r = (n) => Math.round(n * 1000) / 1000;
    const f = pose.forward;
    const p = [pose.area, r(pose.head.x), r(pose.head.y), r(pose.head.z), r(Math.atan2(f.x, f.z)), r(Math.asin(Math.max(-1, Math.min(1, f.y))))];
    if (pose.left && pose.right) p.push(r(pose.left.x), r(pose.left.y), r(pose.left.z), r(pose.right.x), r(pose.right.y), r(pose.right.z));
    return p;
  }

  function sendJoin() {
    const pose = getPose();
    state.joined = true;
    const name = storedName();
    joinName = name || null;
    send({ t: 'join', p: pose ? encode(pose) : undefined, name: name || undefined });
  }

  scene.onBeforeRenderObservable.add(() => {
    if (!state.joined) return;
    const now = performance.now();
    const pose = getPose();
    if (pose) {
      myArea = pose.area;
      voice.setListener(pose.head, pose.forward);
      if (now - lastSent >= SEND_INTERVAL_MS) {
        const p = encode(pose);
        const key = p.map((n) => n.toFixed(2)).join();
        if (key !== lastPose || now - lastSent >= HEARTBEAT_MS) {
          send({ t: 'pose', p });
          lastPose = key;
          lastSent = now;
        }
      }
    }
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    for (const [id, avatar] of avatars) {
      const visible = avatar.update(dt, myArea, voice.level(id), pose?.head);
      voice.setSource(id, avatar.headPosition, visible);
    }
    if (now - lastLevels > 120) {
      lastLevels = now;
      const live = voice.sampleLevels();
      if (live !== state.micLive) {
        state.micLive = live;
        changed();
      }
    }
  });

  // A tap or trigger click on someone mutes them for you (and again unmutes).
  scene.onPointerObservable.add((info) => {
    const id = info.pickInfo?.pickedMesh?.metadata?.presenceId;
    if (id && avatars.has(id)) toggleSilenced(id);
  }, PointerEventTypes.POINTERTAP);

  function toggleSilenced(id) {
    const on = !voice.isSilenced(id);
    voice.setSilenced(id, on);
    avatars.get(id)?.setSilenced(on);
    changed();
    return on;
  }

  // Browsers only start audio inside a real tap or key press, and a controller click in the
  // headset may not count: any earlier gesture on the page (Enter VR included) unlocks it.
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => voice.unlock(), { capture: true, passive: true });

  connect();

  const api = {
    get state() {
      return state;
    },
    /** Become visible and hear others. Call from a click (it unlocks audio). */
    join() {
      voice.unlock();
      wantJoined = true;
      if (state.status === 'online' && !state.joined) sendJoin();
      changed();
    },
    leave() {
      wantJoined = false;
      if (!state.joined) return;
      send({ t: 'leave' });
      state.joined = false;
      clearPeople();
      voice.stop();
      state.micOn = false;
      state.micLive = false;
      changed();
    },
    /** Turns your mic on or off. Call from a click: the first time asks for permission. */
    async setMic(on) {
      state.micError = '';
      try {
        if (on) await voice.startMic();
        else voice.setMicMuted(true);
        state.micOn = voice.micOn;
      } catch (e) {
        console.warn('[presence] mic unavailable', e);
        state.micOn = false;
        const blocked = e?.name === 'NotAllowedError';
        // The headset browser may not be able to ask for the mic inside VR: allowing it once
        // on the flat page (Talk before Enter VR) is remembered for this site.
        state.micError = inXr()
          ? 'The mic needs permission. Leave VR, tap Talk once to allow it, then come back.'
          : blocked
            ? 'Microphone access was blocked. Allow it in the browser’s site settings.'
            : 'No microphone was found.';
        if (inXr()) notify(blocked ? 'Mic blocked: allow it outside VR' : 'Mic unavailable');
      }
      changed();
    },
    /**
     * Headset controls: B or Y joins, then turns your mic on and off, with a notice
     * floating ahead so you know which it is. `xr` is the WebXRDefaultExperience.
     */
    attachXr(xr) {
      xr.input.onControllerAddedObservable.add((source) =>
        source.onMotionControllerInitObservable.add((mc) => {
          for (const id of ['b-button', 'y-button']) {
            mc.getComponent(id)?.onButtonStateChangedObservable.add(async (c) => {
              if (!c.changes.pressed?.current || state.status !== 'online') return;
              if (!state.joined) {
                api.join();
                notify('You joined. Press B or Y again to talk.');
              } else if (state.voice) {
                await api.setMic(!state.micOn);
                if (!state.micError) notify(state.micOn ? 'Mic on: others can hear you' : 'Mic off');
              }
            });
          }
        }),
      );
    },
    /** Your name: as typed (kept for next time if the server allows it), or a new random one with `random`. */
    setName(name, { random = false } = {}) {
      if (state.status !== 'online') return;
      if (random) {
        storeName('');
        pendingName = '';
        send({ t: 'rename', random: true });
        return;
      }
      const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
      if (!clean || clean === state.me?.name) return;
      storeName(clean);
      pendingName = clean;
      send({ t: 'rename', name: clean });
    },
    /** Voice connection states, for debugging. */
    stats: () => {
      const pose = getPose();
      const r = (v) => v && [v.x, v.y, v.z].map((n) => +n.toFixed(2));
      return { ...voice.stats(), area: myArea, me: r(pose?.head), people: [...avatars].map(([id, a]) => ({ id, head: r(a.headPosition), drawn: a.drawn })) };
    },
    /** Mutes or unmutes one person for you only; returns whether they're now muted. */
    toggleSilenced,
    /** Whether a picked mesh is part of someone's avatar (taps on it are handled here). */
    isAvatar: (mesh) => !!mesh?.metadata?.presenceId,
  };
  return api;
}
