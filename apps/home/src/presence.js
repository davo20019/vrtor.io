// Shared presence for the subject apps: who else is here, where they stand, and
// the WebRTC signaling for their voices. One Durable Object per room instance;
// each subject fills `<code>:0`, then `<code>:1`, ... ROOM_SIZE people at a time.
//
// Every socket starts as a watcher (it only gets the head count). Sending
// { t: 'join' } makes it visible: it then receives everyone's poses and can
// exchange voice signaling with other visible people. Names are assigned here,
// never chosen by clients.
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
    const taken = new Set(this.people().map((p) => p.name));
    let name;
    do name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
    while (taken.has(name) && taken.size < 100);
    const me = { id: crypto.randomUUID().slice(0, 8), name, color: pick(COLORS), joined: false, pose: null };
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
      ws.serializeAttachment(me);
      send(ws, { t: 'peers', peers: this.people().filter((p) => p.id !== me.id).map(publicPerson) });
      this.broadcast({ t: 'joined', peer: publicPerson(me) }, ws);
      this.broadcastCount();
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
