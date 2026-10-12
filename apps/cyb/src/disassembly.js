// See every part: the truck taken apart in the showroom's parts space, as a technician takes it apart.
//
// The model lists its parts (cybertruck.json disassembly, from assets-src/cybertruck/disassembly.py): each part's
// name in Tesla's Service Manual, its nodes, which way it comes off, what it is fixed to and what must be off first.
// A part comes off only once every part in its `after` is off, and goes back only once every part that came off
// after it is back: the manual's order both ways. It carries what is still fixed to it (a door taken off whole
// takes its mirror and trim along), lifts out of its seat along its way off, and flies to its own place on the
// parts plinth, laid out by footprint. Put back, it returns to exactly where it was.
import { Quaternion, TransformNode, Vector3 } from '@babylonjs/core';

const OUT_S = 0.45;          // out of its seat
const FLY_S = 1.1;           // across to its place, or back
const LIFT = 0.3;            // m, out of its seat before it flies
const ARC = 0.9;             // m, how high it arcs over on the way
const GAP = 0.14;            // m, between parts laid out
const MARGIN = 0.25;         // m, from the plinth's edge
const STEP_S = 0.22;         // between parts when taking everything off or putting everything back
const FREE = 0.12;           // m, pulled past its seat's lift before it comes free in the hand
const NEAR_SEAT = 0.3;       // m, let go this close to its seat and a part goes back in

const smooth = (t) => t * t * (3 - 2 * t);

export function createDisassembly(scene, { info, byName, root, area, moved = () => {}, prepare = () => {}, onChange = () => {}, share = () => {} }) {
  const parts = new Map();
  for (const def of info.disassembly?.parts ?? []) {
    const nodes = def.nodes.map(byName).filter(Boolean);
    if (nodes.length) parts.set(def.id, { def, nodes, off: false, busy: false, holder: null, rest: null, carriedBy: null, carrying: [], slot: null });
  }
  const kids = new Map();
  for (const p of parts.values()) if (p.def.on && parts.has(p.def.on)) (kids.get(p.def.on) ?? kids.set(p.def.on, []).get(p.def.on)).push(p);
  const depth = (p) => (p.def.on && parts.has(p.def.on) ? 1 + depth(parts.get(p.def.on)) : 0);
  const meshesOf = (nodes) => nodes.flatMap((n) => (n.getTotalVertices?.() > 0 ? [n] : []).concat(n.getChildMeshes(false)));
  // Which part a picked mesh belongs to: the most specific one (a door's mirror glass, not the door).
  const owner = new Map();
  for (const p of [...parts.values()].sort((a, b) => depth(a) - depth(b))) for (const m of meshesOf(p.nodes)) owner.set(m, p);

  // ---- where each part lies in the parts space: its footprint as it sits on the truck, rows across the plinth
  root.computeWorldMatrix(true);
  const boxOf = (p) => {
    const ms = meshesOf([...p.nodes, ...(kids.get(p.def.id) ?? []).flatMap((k) => k.nodes)]).filter((m) => m.getTotalVertices() > 0);
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.scale(-1);
    for (const m of ms) {
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo().boundingBox;
      lo.minimizeInPlace(b.minimumWorld);
      hi.maximizeInPlace(b.maximumWorld);
    }
    return { lo, hi, size: hi.subtract(lo), centre: lo.add(hi).scale(0.5) };
  };
  const list = [...parts.values()].map((p) => ({ p, box: boxOf(p) })).filter((q) => Number.isFinite(q.box.size.x));
  // Biggest first, each into the free rectangle it fits most snugly (MaxRects, best short side), turned a quarter
  // about the vertical if that fits better: a rocker lies along the plinth, a fascia across it.
  list.sort((a, b) => b.box.size.x * b.box.size.z - a.box.size.x * a.box.size.z);
  const W = area.width - 2 * MARGIN, D = area.depth - 2 * MARGIN;
  let free = [{ x: 0, z: 0, w: W, d: D }];
  const unplaced = [];
  for (const q of list) {
    let best = null;
    for (const r of free) {
      for (const turned of [false, true]) {
        const w = (turned ? q.box.size.z : q.box.size.x) + GAP, d = (turned ? q.box.size.x : q.box.size.z) + GAP;
        if (w > r.w + 1e-6 || d > r.d + 1e-6) continue;
        const score = Math.min(r.w - w, r.d - d);
        if (!best || score < best.score) best = { x: r.x, z: r.z, w, d, turned, score };
      }
    }
    if (!best) {
      unplaced.push(q.p.def.id);
      continue;
    }
    const next = [];
    for (const r of free) {
      if (best.x >= r.x + r.w || best.x + best.w <= r.x || best.z >= r.z + r.d || best.z + best.d <= r.z) {
        next.push(r);
        continue;
      }
      if (best.x > r.x) next.push({ x: r.x, z: r.z, w: best.x - r.x, d: r.d });
      if (best.x + best.w < r.x + r.w) next.push({ x: best.x + best.w, z: r.z, w: r.x + r.w - best.x - best.w, d: r.d });
      if (best.z > r.z) next.push({ x: r.x, z: r.z, w: r.w, d: best.z - r.z });
      if (best.z + best.d < r.z + r.d) next.push({ x: r.x, z: best.z + best.d, w: r.w, d: r.z + r.d - best.z - best.d });
    }
    const inside = (a, b) => a.x >= b.x && a.z >= b.z && a.x + a.w <= b.x + b.w && a.z + a.d <= b.z + b.d;
    free = next.filter((r, i) => !next.some((o, j) => j !== i && inside(r, o) && (!inside(o, r) || j < i)));
    // The place for the part's centre: on the plinth's top, its lowest point just above it.
    const { box } = q;
    q.p.slot = new Vector3(area.centre.x - W / 2 + best.x + (best.w - GAP) / 2, area.top + 0.01 + (box.centre.y - box.lo.y),
      area.centre.z - D / 2 + best.z + (best.d - GAP) / 2);
    q.p.turn = best.turned ? Quaternion.RotationAxis(Vector3.Up(), Math.PI / 2) : Quaternion.Identity();
  }
  if (unplaced.length) console.warn(`[cyb] no room on the parts plinth for: ${unplaced.join(', ')}`);

  // ---- moving: a part's nodes (and what it carries) ride on a holder: it flies, or a hand holds it
  const tweens = [];
  const dirWorld = (p) => Vector3.TransformNormal(Vector3.FromArray(p.def.dir), root.getWorldMatrix()).normalize();
  const capture = (n) => ({
    node: n,
    parent: n.parent,
    position: n.position.clone(),
    rotation: n.rotation.clone(),
    quaternion: n.rotationQuaternion?.clone() ?? null,
    scaling: n.scaling.clone(),
  });
  const restore = (r) => {
    r.node.parent = r.parent;
    r.node.position.copyFrom(r.position);
    r.node.rotation.copyFrom(r.rotation);
    if (r.quaternion) (r.node.rotationQuaternion ??= new Quaternion()).copyFrom(r.quaternion);
    else r.node.rotationQuaternion = null;
    r.node.scaling.copyFrom(r.scaling);
  };
  const mark = (p, off) => {
    for (const n of p.nodes) n.metadata = { ...(n.metadata ?? {}), off };
  };
  // Parts fixed to p that aren't inside its own nodes (the airbag on the yoke): they ride along on its holder.
  const looseKids = (p) => (kids.get(p.def.id) ?? []).filter((k) => !k.off && !k.carriedBy && !k.holder && !k.nodes.some((n) => p.nodes.some((pn) => n.isDescendantOf?.(pn))));

  /** Out of its seat onto a holder at its centre, with what it carries; nothing moves yet. */
  function detach(p) {
    if (p.holder) return;
    prepare(p.def);
    const start = boxOf(p).centre;
    const carried = looseKids(p);
    p.rest = p.nodes.map(capture);
    p.holder = new TransformNode(`parts-${p.def.id}`, scene);
    p.holder.position.copyFrom(start);
    p.holder.rotationQuaternion = Quaternion.Identity();
    for (const n of p.nodes) n.setParent(p.holder);
    p.carrying = carried;
    for (const k of carried) {
      k.rest = k.nodes.map(capture);
      for (const n of k.nodes) n.setParent(p.holder);
      k.carriedBy = p;
    }
    p.seat = start.clone();
  }

  /** Back in its seat, on what it's fixed to: the nodes return exactly, the holder goes. */
  function seatBack(p) {
    for (const r of p.rest) restore(r);
    for (const k of p.carrying) {
      for (const r of k.rest) restore(r);
      k.rest = null;
      k.carriedBy = null;
    }
    p.carrying = [];
    p.holder.dispose();
    p.holder = null;
    p.rest = null;
    moved();
  }

  /** Stops a part's move where it is (a move made at once overrides it). */
  function still(p) {
    for (const tw of tweens.filter((t) => t.p === p)) tweens.splice(tweens.indexOf(tw), 1);
    p.busy = false;
  }

  function fly(p, path, done) {
    for (const tw of tweens.filter((t) => t.p === p)) tweens.splice(tweens.indexOf(tw), 1);
    p.busy = true;
    tweens.push({ p, path, i: 0, t: 0, done });
  }
  scene.onBeforeRenderObservable.add(() => {
    if (!tweens.length) return;
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (const tw of [...tweens]) {
      const seg = tw.path[tw.i];
      tw.t = Math.min(1, tw.t + dt / seg.s);
      const e = smooth(tw.t);
      const pos = Vector3.Lerp(seg.a, seg.b, e);
      if (seg.arc) pos.y += seg.arc * Math.sin(Math.PI * e);
      tw.p.holder.position.copyFrom(pos);
      if (seg.qa) Quaternion.SlerpToRef(seg.qa, seg.qb, e, tw.p.holder.rotationQuaternion);
      if (tw.t >= 1) {
        tw.i += 1;
        tw.t = 0;
        if (tw.i >= tw.path.length) {
          tweens.splice(tweens.indexOf(tw), 1);
          tw.p.busy = false;
          tw.done?.();
          onChange();
        }
      }
    }
    moved();
  });

  // ---- the rules
  const offOrHidden = (q) => q.off || q.nodes.every((n) => !n.isEnabled());
  const blockersOff = (p) => p.def.after.map((id) => parts.get(id)).filter((q) => q && !offOrHidden(q));
  const blockersOn = (p) => {
    const by = [...parts.values()].filter((q) => q.off && q.def.after.includes(p.def.id));
    // Fixed to a part that's off itself, and taken off it somewhere else: that part goes back first.
    const on = p.def.on ? parts.get(p.def.on) : null;
    const parent = p.rest?.[0]?.parent;
    if (on && on.off && on.holder && parent !== on.holder && !parent?.isDescendantOf?.(on.holder)) by.push(on);
    return [...new Set(by)];
  };
  const history = [];

  /** Off and away to its place on the plinth: out along its way off first if it's still in its seat. */
  function remove(p, { instant = false, local = true } = {}) {
    const inSeat = !p.holder;
    detach(p);
    if (!p.off) history.push(p);
    p.off = true;
    mark(p, true);
    if (local) share(p.def.id, true);
    const from = p.holder.position.clone();
    const to = p.slot ?? from.add(dirWorld(p).scale(LIFT));
    const turn = p.turn ?? Quaternion.Identity();
    if (instant) {
      still(p);
      p.holder.position.copyFrom(to);
      p.holder.rotationQuaternion.copyFrom(turn);
      moved();
      return;
    }
    const q0 = p.holder.rotationQuaternion.clone();
    if (inSeat) {
      const out = from.add(dirWorld(p).scale(LIFT));
      fly(p, [{ a: from, b: out, s: OUT_S }, { a: out, b: to, s: FLY_S, arc: ARC, qa: q0, qb: turn }]);
    } else {
      fly(p, [{ a: from, b: to, s: FLY_S, arc: ARC * 0.6, qa: q0, qb: turn }]);
    }
  }

  /** Back to its seat from wherever it is, the last bit in along its way off. */
  function install(p, { instant = false, local = true } = {}) {
    const done = () => {
      seatBack(p);
      p.off = false;
      mark(p, false);
      const i = history.lastIndexOf(p);
      if (i >= 0) history.splice(i, 1);
    };
    if (local) share(p.def.id, false);
    if (instant) {
      still(p);
      return done();
    }
    const seat = seatOf(p);
    const out = seat.add(dirWorld(p).scale(LIFT));
    fly(p, [{ a: p.holder.position.clone(), b: out, s: FLY_S, arc: ARC, qa: p.holder.rotationQuaternion.clone(), qb: Quaternion.Identity() }, { a: out, b: seat, s: OUT_S }], done);
  }

  /** Where the part's holder stands when the part is back in its seat, in the world as it is now. */
  function seatOf(p) {
    // On its holder a node keeps its offset in the holder's own frame; back in its seat the holder is unturned, so
    // the holder stands that offset short of where the node's own parent puts it. Put the node back for a moment to
    // read that, then onto the holder again.
    const r = p.rest[0];
    const n = r.node;
    const before = { parent: n.parent, position: n.position.clone(), rotation: n.rotation.clone(), quaternion: n.rotationQuaternion?.clone() ?? null };
    restore(r);
    n.computeWorldMatrix(true);
    const seat = n.getAbsolutePosition().subtract(before.position);
    n.parent = before.parent;
    n.position.copyFrom(before.position);
    n.rotation.copyFrom(before.rotation);
    if (before.quaternion) n.rotationQuaternion.copyFrom(before.quaternion);
    n.computeWorldMatrix(true);
    return seat;
  }

  /** What a press on a part would do, and does it: a tap, or the trigger in the headset. */
  function tap(mesh) {
    const p = owner.get(mesh);
    if (!p) return null;
    if (p.busy || p.hand) return { part: p.def, verb: 'moving' };
    if (!p.off) {
      const blocked = blockersOff(p);
      if (blocked.length) return { part: p.def, verb: 'blocked-off', by: blocked.map((q) => q.def) };
      remove(p);
      return { part: p.def, verb: 'off' };
    }
    const blocked = blockersOn(p);
    if (blocked.length) return { part: p.def, verb: 'blocked-on', by: blocked.map((q) => q.def) };
    install(p);
    return { part: p.def, verb: 'on' };
  }

  // ---- in the hand (the headset's grip): pull a part out of its seat along its way off, then it's free
  /** Takes hold of the part a mesh belongs to: { part, verb: 'held' } or why not. hand: { position, rotation } now. */
  function grab(mesh, hand) {
    const p = owner.get(mesh);
    if (!p) return null;
    if (p.busy || p.hand) return { part: p.def, verb: 'moving' };
    if (!p.off) {
      const blocked = blockersOff(p);
      if (blocked.length) return { part: p.def, verb: 'blocked-off', by: blocked.map((q) => q.def) };
    }
    detach(p);
    p.hand = { from: hand.position.clone(), q0: hand.rotation.clone(), held: p.holder.position.subtract(hand.position),
      rot: p.holder.rotationQuaternion.clone(), free: p.off, seat: p.off ? null : p.holder.position.clone() };
    return { part: p.def, verb: 'held', id: p.def.id };
  }

  /** The hand moved: in its seat the part slides out along its way off; once out, it follows the hand. */
  function hold(id, hand) {
    const p = parts.get(id);
    if (!p?.hand) return null;
    const h = p.hand;
    if (!h.free) {
      const pulled = Vector3.Dot(hand.position.subtract(h.from), dirWorld(p));
      p.holder.position.copyFrom(h.seat.add(dirWorld(p).scale(Math.max(0, Math.min(LIFT, pulled)))));
      if (pulled > LIFT + FREE) {
        h.free = true;                                   // out of its seat: it's in the hand now
        h.from = hand.position.clone();
        h.q0 = hand.rotation.clone();
        h.held = p.holder.position.subtract(hand.position);
        h.rot = p.holder.rotationQuaternion.clone();
        moved();
        return 'free';
      }
    } else {
      const turn = hand.rotation.multiply(Quaternion.Inverse(h.q0));
      p.holder.position.copyFrom(hand.position.add(h.held.applyRotationQuaternion(turn)));
      p.holder.rotationQuaternion.copyFrom(turn.multiply(h.rot));
    }
    moved();
    return h.free ? 'free' : 'seated';
  }

  /** Let go: still in its seat it slides back in; out of it, it goes back in if it's near its seat (and may), else to its place. */
  function release(id) {
    const p = parts.get(id);
    if (!p?.hand) return null;
    const h = p.hand;
    p.hand = null;
    if (!h.free) {
      // Never came out: back in, as it was (nothing changed).
      fly(p, [{ a: p.holder.position.clone(), b: h.seat, s: OUT_S * 0.5 }], () => seatBack(p));
      return { part: p.def, verb: 'kept' };
    }
    const seat = seatOf(p);
    if (Vector3.Distance(p.holder.position, seat) < NEAR_SEAT) {
      const blocked = p.off ? blockersOn(p) : [];
      if (!blocked.length) {
        if (p.off) {
          install(p);
        } else {
          fly(p, [{ a: p.holder.position.clone(), b: seat, s: OUT_S, qa: p.holder.rotationQuaternion.clone(), qb: Quaternion.Identity() }], () => seatBack(p));
        }
        return { part: p.def, verb: p.off ? 'on' : 'kept' };
      }
      if (p.off) {
        remove(p);                                       // back to its place, and say why
        return { part: p.def, verb: 'blocked-on', by: blocked.map((q) => q.def) };
      }
    }
    if (!p.off) {
      remove(p);
      return { part: p.def, verb: 'off' };
    }
    remove(p, { local: false });                         // already off: just back to its place
    return { part: p.def, verb: 'placed' };
  }

  /** Where a held part is now (to show others): [x, y, z, qx, qy, qz, qw], or null. */
  function heldPose(id) {
    const p = parts.get(id);
    if (!p?.holder) return null;
    const a = p.holder.position, q = p.holder.rotationQuaternion;
    return [a.x, a.y, a.z, q.x, q.y, q.z, q.w].map((v) => +v.toFixed(4));
  }

  // ---- someone else's truck (multiplayer): their changes, applied here with the same motion
  /** Someone took a part off (true) or put it back (false). Their order was the manual's; it's applied as is. */
  function apply(id, off) {
    const p = parts.get(id);
    if (!p || p.hand || p.off === off) return;
    if (p.busy) {
      setTimeout(() => apply(id, off), 300);             // after its current move
      return;
    }
    if (off) remove(p, { local: false });
    else install(p, { local: false });
    onChange();
  }
  /** A part in someone else's hand: shown where they hold it; null when they let go. */
  function remoteHold(id, pose) {
    const p = parts.get(id);
    if (!p || p.hand || p.busy) return;
    if (!pose) {
      if (!p.off && p.holder) fly(p, [{ a: p.holder.position.clone(), b: seatOf(p), s: OUT_S, qa: p.holder.rotationQuaternion.clone(), qb: Quaternion.Identity() }], () => seatBack(p));
      return;
    }
    detach(p);
    p.holder.position.set(pose[0], pose[1], pose[2]);
    p.holder.rotationQuaternion.set(pose[3], pose[4], pose[5], pose[6]);
    moved();
  }
  /** Brings this truck to a given set of parts off (someone else's, on joining): each off part comes off (what's
   *  fixed to a part first) and each other goes back (a part before what's fixed to it). */
  function applyAll(offIds, { instant = true } = {}) {
    const want = new Set(offIds);
    const offs = [...parts.values()].filter((p) => want.has(p.def.id) && !p.off).sort((a, b) => depth(b) - depth(a));
    const ons = [...parts.values()].filter((p) => !want.has(p.def.id) && p.off).sort((a, b) => depth(a) - depth(b));
    for (const p of ons) {
      p.hand = null;
      install(p, { instant, local: false });
    }
    for (const p of offs) {
      p.hand = null;
      remove(p, { instant, local: false });
    }
    onChange();
  }
  /** Which parts are off (to bring someone who joins up to date). */
  const offIds = () => [...parts.values()].filter((p) => p.off).map((p) => p.def.id);

  let queue = null;
  function run(next) {
    clearInterval(queue);
    queue = setInterval(() => {
      if (!next()) {
        clearInterval(queue);
        queue = null;
        onChange();
      }
    }, STEP_S * 1000);
  }
  /** Everything off, in the manual's order: what's fixed to a part comes off it first (laid out on its own). */
  function takeAll() {
    run(() => {
      const free = [...parts.values()].filter((p) => !p.off && !p.busy && !p.hand && !offOrHidden(p) && !blockersOff(p).length && !p.carriedBy);
      const leaf = free.find((p) => !(kids.get(p.def.id) ?? []).some((k) => !k.off)) ?? free[0];
      if (!leaf) return [...parts.values()].some((p) => p.busy);
      remove(leaf);
      onChange();
      return true;
    });
  }
  /** Everything back, last off first on. */
  function putAllBack() {
    run(() => {
      const p = [...history].reverse().find((q) => !q.busy && !q.hand && !q.carriedBy && !blockersOn(q).length);
      if (!p) return history.length > 0 && [...parts.values()].some((q) => q.busy);
      install(p);
      onChange();
      return true;
    });
  }
  /** Everything back at once (before the truck drives off). */
  function restoreNow({ local = true } = {}) {
    clearInterval(queue);
    queue = null;
    for (const tw of tweens.splice(0)) tw.p.busy = false;
    for (const p of parts.values()) {
      p.hand = null;
      if (p.holder && !p.off) seatBack(p);
    }
    while (history.length) install(history[history.length - 1], { instant: true, local });
    onChange();
  }

  return {
    get count() {
      return parts.size;
    },
    get offCount() {
      return [...parts.values()].filter((p) => p.off).length;
    },
    get running() {
      return Boolean(queue) || tweens.length > 0;
    },
    /** Each part's footprint as it sits on the truck (m) and its place on the plinth: for checking the layout. */
    get layout() {
      return list.map(({ p, box }) => ({ id: p.def.id, size: [box.size.x, box.size.y, box.size.z].map((v) => +v.toFixed(2)), slot: p.slot && [p.slot.x, p.slot.z].map((v) => +v.toFixed(2)), turned: !!p.turn && Math.abs(p.turn.y) > 0.1 }));
    },
    partOf: (mesh) => owner.get(mesh)?.def ?? null,
    /** The part whose meshes come nearest a point within reach (a hand): its mesh, or null. */
    nearest(point, reach) {
      let best = null, bestD = reach;
      for (const [m, p] of owner) {
        if (!m.isEnabled() || m.getTotalVertices() === 0 || p.busy) continue;
        const b = m.getBoundingInfo().boundingBox;
        const c = Vector3.Clamp(point, b.minimumWorld, b.maximumWorld);
        const d = Vector3.Distance(point, c);
        if (d < bestD || (d === 0 && best && depth(p) > depth(owner.get(best)))) {
          bestD = d;
          best = m;
        }
      }
      return best;
    },
    isOff: (id) => parts.get(id)?.off ?? false,
    tap,
    grab,
    hold,
    release,
    heldPose,
    apply,
    applyAll,
    remoteHold,
    offIds,
    takeAll,
    putAllBack,
    restoreNow,
    stop() {
      clearInterval(queue);
      queue = null;
    },
  };
}
