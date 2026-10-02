// Shared presence for the subject apps: who else is here, where they stand, and
// the WebRTC signaling for their voices. One Durable Object per room instance;
// each subject fills `<code>:0`, then `<code>:1`, ... ROOM_SIZE people at a time.
//
// Every socket starts as a watcher (it only gets the head count). Sending
// { t: 'join' } makes it visible: it then receives everyone's poses and can
// exchange voice signaling with other visible people. Everyone gets a random
// name; a name people choose is only kept if it passes cleanName().
//
// Kill switches (wrangler vars, or the dashboard): PRESENCE = "off" refuses new
// connections; VOICE = "off" stops relaying voice signaling. A deploy restarts
// the rooms, so connected clients reconnect under the new settings.
import { DurableObject } from 'cloudflare:workers';

export const ROOM_SIZE = 12;
const MAX_ROOMS = 50;
const MAX_MESSAGE = 16_000;
/** Messages per socket per second before the rest are dropped. */
const RATE_LIMIT = 40;

const ADJECTIVES = ['Curious', 'Bright', 'Swift', 'Gentle', 'Sunny', 'Brave', 'Calm', 'Quiet', 'Lucky', 'Clever', 'Kind', 'Merry'];
const ANIMALS = ['Condor', 'Llama', 'Alpaca', 'Vicuña', 'Puma', 'Viscacha', 'Hummingbird', 'Fox', 'Toucan', 'Jaguar', 'Owl', 'Falcon'];
const COLORS = ['#ffb020', '#5ec8f2', '#f2735e', '#8fd16a', '#c48cf2', '#f2d65e', '#5ef2c1', '#f28cc4', '#7aa2ff', '#ff8a3d', '#b5e655', '#e6e6e6'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Chosen names: 2 to 20 letters, digits, spaces and . ' -; nothing that poses as
// staff, and no slurs or profanity, with look-alike digits and symbols read as letters.
// Unambiguous words are refused anywhere (also with the letters spaced out); words
// that also sit inside ordinary names (Scunthorpe, Cocktail) only as whole words.
const NAME_CHARS = /^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,19}$/u;
const ANYWHERE = ['fuck', 'shit', 'nigg', 'faggot', 'whore', 'porn', 'hitler', 'nazi', 'retard', 'pendej', 'mierda'];
const WORDS = [
  'admin', 'administrator', 'mod', 'moderator', 'official', 'vrtor', 'staff', 'support', 'anthropic', 'claude',
  'cunt', 'bitch', 'dick', 'cock', 'pussy', 'slut', 'sex', 'sexy', 'rape', 'fag', 'kike', 'spic', 'chink',
  'tranny', 'puta', 'puto', 'verga', 'marica', 'maricon', 'culo', 'ass', 'asshole', 'penis', 'vagina',
];
const LOOKALIKES = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!NAME_CHARS.test(name)) return null;
  const plain = [...name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')].map((c) => LOOKALIKES[c] ?? c).join('');
  const squashed = plain.replace(/[^a-z]/g, '');
  if (ANYWHERE.some((word) => squashed.includes(word))) return null;
  const words = plain.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => WORDS.includes(w) || WORDS.includes(w.replace(/e?s$/, '')))) return null;
  return name;
}

/** Upgrades `request` into the first room instance of `code` with space. */
export async function connectPresence(request, env, code) {
  if (env.PRESENCE === 'off') return new Response('Presence is off.', { status: 503 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected a WebSocket.', { status: 426 });
  }
  for (let i = 0; i < MAX_ROOMS; i++) {
    const room = env.PRESENCE_ROOM.get(env.PRESENCE_ROOM.idFromName(`${code}:${i}`));
    const res = await room.fetch(request);
    if (res.status !== 409) return res;
  }
  return new Response('Every room is full.', { status: 503 });
}

export class PresenceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /** Per-socket message counts for rate limiting (lost on hibernation, which is fine). */
    this.rate = new Map();
  }

  async fetch() {
    if (this.ctx.getWebSockets().length >= ROOM_SIZE) return new Response('Full', { status: 409 });
    const [client, server] = Object.values(new WebSocketPair());
    const me = { id: crypto.randomUUID().slice(0, 8), name: this.randomName(), color: pick(COLORS), joined: false, pose: null };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    send(server, { t: 'hello', id: me.id, name: me.name, color: me.color, voice: this.env.VOICE !== 'off', size: ROOM_SIZE });
    this.broadcastCount();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE || !this.allow(ws)) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const me = ws.deserializeAttachment();
    if (msg.t === 'join' && !me.joined) {
      me.joined = true;
      me.pose = validPose(msg.p);
      if (msg.name !== undefined) me.name = this.uniqueName(cleanName(msg.name), me.id) ?? me.name;
      ws.serializeAttachment(me);
      send(ws, { t: 'you', name: me.name, rejected: msg.name !== undefined && me.name !== cleanName(msg.name) });
      send(ws, { t: 'peers', peers: this.people().filter((p) => p.id !== me.id).map(publicPerson) });
      this.broadcast({ t: 'joined', peer: publicPerson(me) }, ws);
      this.broadcastCount();
    } else if (msg.t === 'rename') {
      const wanted = msg.random ? this.randomName() : cleanName(msg.name);
      const name = this.uniqueName(wanted, me.id);
      send(ws, { t: 'you', name: name ?? me.name, rejected: !name });
      if (!name || name === me.name) return;
      me.name = name;
      ws.serializeAttachment(me);
      if (me.joined) this.broadcast({ t: 'renamed', id: me.id, name }, ws);
    } else if (msg.t === 'leave' && me.joined) {
      me.joined = false;
      me.pose = null;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'left', id: me.id }, ws);
      this.broadcastCount();
    } else if (msg.t === 'pose' && me.joined) {
      const pose = validPose(msg.p);
      if (!pose) return;
      me.pose = pose;
      ws.serializeAttachment(me);
      this.broadcast({ t: 'pose', id: me.id, p: pose }, ws);
    } else if (msg.t === 'signal' && me.joined && this.env.VOICE !== 'off' && typeof msg.to === 'string') {
      const target = this.socketOf(msg.to);
      if (target?.deserializeAttachment().joined) send(target, { t: 'signal', from: me.id, d: msg.d });
    }
  }

  async webSocketClose(ws) {
    this.drop(ws);
  }

  async webSocketError(ws) {
    this.drop(ws);
  }

  drop(ws) {
    this.rate.delete(ws);
    const me = ws.deserializeAttachment();
    try {
      ws.close(1000, 'bye');
    } catch {}
    if (me?.joined) this.broadcast({ t: 'left', id: me.id }, ws);
    this.broadcastCount(ws);
  }

  randomName() {
    const taken = new Set(this.sockets().map((ws) => ws.deserializeAttachment()?.name));
    let name;
    do name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
    while (taken.has(name) && taken.size < 100);
    return name;
  }

  /** `name` if nobody else in the room has it, else with a number added; null for no name. */
  uniqueName(name, id) {
    if (!name) return null;
    const taken = new Set(this.sockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && p.id !== id).map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; n < 100; n++) if (!taken.has(`${name} ${n}`.toLowerCase())) return `${name.slice(0, 17)} ${n}`;
    return null;
  }

  allow(ws) {
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r || now - r.start > 1000) this.rate.set(ws, (r = { start: now, n: 0 }));
    return ++r.n <= RATE_LIMIT;
  }

  /** Open sockets, optionally leaving one out (a socket that is closing still shows up). */
  sockets(except) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN);
  }

  people() {
    return this.sockets().map((ws) => ws.deserializeAttachment()).filter((p) => p?.joined);
  }

  socketOf(id) {
    return this.sockets().find((ws) => ws.deserializeAttachment()?.id === id);
  }

  /** Sends to every visible person except `from`. */
  broadcast(msg, from) {
    const text = JSON.stringify(msg);
    for (const ws of this.sockets(from)) {
      if (ws.deserializeAttachment()?.joined) ws.send(text);
    }
  }

  broadcastCount(except) {
    const sockets = this.sockets(except);
    const here = sockets.filter((ws) => ws.deserializeAttachment()?.joined).length;
    const text = JSON.stringify({ t: 'count', here, online: sockets.length });
    for (const ws of sockets) ws.send(text);
  }
}

function send(ws, msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {}
}

function publicPerson({ id, name, color, pose }) {
  return { id, name, color, p: pose };
}

/**
 * A pose is [area, x, y, z, yaw, pitch] for the head, optionally followed by both
 * hands' positions [lx, ly, lz, rx, ry, rz]. Anything else is rejected.
 */
function validPose(p) {
  if (!Array.isArray(p) || (p.length !== 6 && p.length !== 12)) return null;
  if (!p.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e5)) return null;
  return p.map((n) => Math.round(n * 1000) / 1000);
}
