// Other people in the same subject, live: a head count for everyone, and for
// those who choose to be visible, simple avatars and spatial voice (voice.js).
// The server side is apps/home/src/presence.js.
//
// Nobody is visible or heard until they join; the mic stays off until they turn
// it on. Tapping someone's avatar mutes them for you only.
import {
  Color3, DynamicTexture, Mesh, MeshBuilder, PointerEventTypes, Quaternion, StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';
import { createVoice } from './voice.js';

const SEND_INTERVAL_MS = 100;
/** Resend an unchanged pose this often, so late joiners and the room stay current. */
const HEARTBEAT_MS = 2000;
const RECONNECT_MS = [1000, 3000, 8000, 20000];
const TAG_HEIGHT = 0.32;

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
  };
  const avatars = new Map();
  let ws = null;
  let attempt = 0;
  let wantJoined = false;
  let lastSent = 0;
  let lastPose = '';
  let lastLevels = 0;
  let myArea = null;

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
    } else if (msg.t === 'joined') {
      addPerson(msg.peer);
    } else if (msg.t === 'left') {
      removePerson(msg.id);
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
    send({ t: 'join', p: pose ? encode(pose) : undefined });
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
      const visible = avatar.update(dt, myArea);
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

  return {
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
        state.micError = e?.name === 'NotAllowedError' ? 'Microphone access was blocked.' : 'No microphone was found.';
      }
      changed();
    },
    /** Voice connection states, for debugging. */
    stats: () => voice.stats(),
    /** Mutes or unmutes one person for you only; returns whether they're now muted. */
    toggleSilenced,
    /** Whether a picked mesh is part of someone's avatar (taps on it are handled here). */
    isAvatar: (mesh) => !!mesh?.metadata?.presenceId,
  };
}

// A person: head with a visor (so you can tell where they look), a body below it,
// hands when they're in a headset, and a name tag that lights up while they talk.
function createAvatar(scene, { id, name, color }) {
  const root = new TransformNode(`person-${id}`, scene);
  const tint = Color3.FromHexString(color);
  const skin = new StandardMaterial(`person-${id}`, scene);
  skin.diffuseColor = tint;
  skin.emissiveColor = tint.scale(0.25);
  skin.specularColor = new Color3(0.15, 0.15, 0.15);
  const dark = new StandardMaterial(`person-${id}-visor`, scene);
  dark.diffuseColor = new Color3(0.05, 0.06, 0.08);
  dark.specularColor = new Color3(0.6, 0.6, 0.6);

  const head = new TransformNode(`person-${id}-head`, scene);
  head.parent = root;
  head.rotationQuaternion = Quaternion.Identity();
  const skull = MeshBuilder.CreateSphere(`person-${id}-skull`, { diameter: 0.24, segments: 12 }, scene);
  skull.material = skin;
  skull.parent = head;
  const visor = MeshBuilder.CreateBox(`person-${id}-face`, { width: 0.18, height: 0.07, depth: 0.06 }, scene);
  visor.material = dark;
  visor.position.set(0, 0.01, 0.1);
  visor.parent = head;

  const body = MeshBuilder.CreateCapsule(`person-${id}-body`, { height: 1.2, radius: 0.17, tessellation: 12 }, scene);
  body.material = skin;
  body.parent = root;

  const hands = [0, 1].map((i) => {
    const hand = MeshBuilder.CreateSphere(`person-${id}-hand${i}`, { diameter: 0.09, segments: 8 }, scene);
    hand.material = skin;
    hand.parent = root;
    hand.setEnabled(false);
    return hand;
  });

  const tag = MeshBuilder.CreatePlane(`person-${id}-tag`, { width: 0.6, height: 0.15 }, scene);
  tag.billboardMode = Mesh.BILLBOARDMODE_ALL;
  tag.parent = root;
  const tex = new DynamicTexture(`person-${id}-tag`, { width: 512, height: 128 }, scene, true);
  tex.hasAlpha = true;
  const tagMat = new StandardMaterial(`person-${id}-tag`, scene);
  tagMat.diffuseTexture = tex;
  tagMat.emissiveColor = Color3.White();
  tagMat.disableLighting = true;
  tagMat.useAlphaFromDiffuseTexture = true;
  tagMat.backFaceCulling = false;
  tag.material = tagMat;
  tag.applyFog = false;

  const pickable = [skull, visor, body, tag];
  for (const m of [skull, visor, body, tag, ...hands]) {
    m.isPickable = pickable.includes(m);
    m.metadata = { presenceId: id };
  }

  let speaking = false;
  let silenced = false;
  const drawTag = () => {
    const c = tex.getContext();
    c.clearRect(0, 0, 512, 128);
    c.fillStyle = speaking ? 'rgba(255,255,255,0.92)' : 'rgba(12,13,18,0.78)';
    c.beginPath();
    c.roundRect(4, 14, 504, 100, 50);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = color;
    c.stroke();
    c.font = '600 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = speaking ? '#111' : '#fff';
    c.fillText(silenced ? `${name} · muted` : name, 256, 66, 470);
    tex.update();
  };
  drawTag();

  // Received poses are eased toward, so 10 updates a second look smooth.
  const target = { area: null, head: new Vector3(), yaw: 0, pitch: 0, hands: null };
  const cur = { head: new Vector3(), yaw: 0, pitch: 0, hands: [new Vector3(), new Vector3()] };
  let placed = false;
  root.setEnabled(false);

  return {
    headPosition: cur.head,
    info: () => ({ id, name, color, silenced }),
    setPose(p, snap = false) {
      target.area = p[0];
      target.head.set(p[1], p[2], p[3]);
      target.yaw = p[4];
      target.pitch = p[5];
      target.hands = p.length >= 12 ? [new Vector3(p[6], p[7], p[8]), new Vector3(p[9], p[10], p[11])] : null;
      if (snap || !placed) {
        cur.head.copyFrom(target.head);
        cur.yaw = target.yaw;
        cur.pitch = target.pitch;
        if (target.hands) target.hands.forEach((h, i) => cur.hands[i].copyFrom(h));
        placed = true;
      }
    },
    /** Moves toward the latest pose; returns whether they're visible (in your area). */
    update(dt, area) {
      const visible = placed && target.area === area;
      root.setEnabled(visible);
      if (!visible) return false;
      const k = 1 - Math.exp(-dt * 12);
      // A jump (teleport or a new area) snaps instead of sliding through walls.
      if (Vector3.DistanceSquared(cur.head, target.head) > 9) cur.head.copyFrom(target.head);
      else Vector3.LerpToRef(cur.head, target.head, k, cur.head);
      cur.yaw += Math.atan2(Math.sin(target.yaw - cur.yaw), Math.cos(target.yaw - cur.yaw)) * k;
      cur.pitch += (target.pitch - cur.pitch) * k;
      head.position.copyFrom(cur.head);
      Quaternion.FromEulerAnglesToRef(-cur.pitch, cur.yaw, 0, head.rotationQuaternion);
      body.position.set(cur.head.x, cur.head.y - 0.85, cur.head.z);
      body.rotation.y = cur.yaw;
      tag.position.set(cur.head.x, cur.head.y + TAG_HEIGHT, cur.head.z);
      hands.forEach((hand, i) => {
        hand.setEnabled(!!target.hands);
        if (!target.hands) return;
        Vector3.LerpToRef(cur.hands[i], target.hands[i], Math.min(1, k * 1.5), cur.hands[i]);
        hand.position.copyFrom(cur.hands[i]);
      });
      return true;
    },
    setSpeaking(on) {
      speaking = on;
      drawTag();
    },
    setSilenced(on) {
      silenced = on;
      drawTag();
    },
    dispose() {
      root.dispose(false, true);
      tex.dispose();
    },
  };
}
