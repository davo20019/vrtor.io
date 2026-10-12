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

const smooth = (t) => t * t * (3 - 2 * t);

export function createDisassembly(scene, { info, byName, root, area, moved = () => {}, prepare = () => {}, onChange = () => {} }) {
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

  // ---- moving: a part's nodes (and what it carries) ride on a holder that flies
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
  const centreNow = (p) => {
    const b = boxOf(p);
    return b.centre;
  };
  // Parts fixed to p that aren't inside its own nodes (the airbag on the yoke): they ride along on its holder.
  const looseKids = (p) => (kids.get(p.def.id) ?? []).filter((k) => !k.off && !k.carriedBy && !k.nodes.some((n) => p.nodes.some((pn) => n.isDescendantOf?.(pn))));

  function fly(p, path, done) {
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
  const blockersOn = (p) => [...parts.values()].filter((q) => q.off && q.def.after.includes(p.def.id));
  const onPart = (p) => (p.def.on ? parts.get(p.def.on) : null);
  const history = [];

  function remove(p, { instant = false } = {}) {
    prepare(p);
    const carried = looseKids(p);
    const start = centreNow(p);
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
    p.off = true;
    mark(p, true);
    history.push(p);
    const out = start.add(dirWorld(p).scale(LIFT));
    const to = p.slot ?? out;
    const turn = p.turn ?? Quaternion.Identity();
    if (instant) {
      p.holder.position.copyFrom(to);
      p.holder.rotationQuaternion.copyFrom(turn);
      moved();
      return;
    }
    fly(p, [{ a: start, b: out, s: OUT_S }, { a: out, b: to, s: FLY_S, arc: ARC, qa: Quaternion.Identity(), qb: turn }]);
  }

  function install(p, { instant = false } = {}) {
    const back = () => {
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
      p.off = false;
      mark(p, false);
      history.splice(history.lastIndexOf(p), 1);
      moved();
    };
    if (instant) return back();
    // Back along the way it came: to just outside its seat, then in. Its seat is where its holder started, in
    // whatever frame its parent is in now (a door's mirror goes back onto the door, wherever the door is).
    const seat = seatOf(p);
    const out = seat.add(dirWorld(p).scale(LIFT));
    fly(p, [{ a: p.holder.position.clone(), b: out, s: FLY_S, arc: ARC, qa: p.holder.rotationQuaternion.clone(), qb: Quaternion.Identity() }, { a: out, b: seat, s: OUT_S }], back);
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

  function tap(mesh) {
    const p = owner.get(mesh);
    if (!p) return null;
    if (p.busy) return { part: p.def, verb: 'moving' };
    if (!p.off) {
      const blocked = blockersOff(p);
      if (blocked.length) return { part: p.def, verb: 'blocked-off', by: blocked.map((q) => q.def) };
      remove(p);
      return { part: p.def, verb: 'off' };
    }
    const blocked = blockersOn(p);
    const on = onPart(p);
    // Fixed to a part that's off itself, and taken off it somewhere else: that part goes back first.
    if (on && on.off && !(p.rest[0].parent && p.rest[0].parent.isDescendantOf?.(on.holder)) && p.rest[0].parent !== on.holder)
      blocked.push(on);
    if (blocked.length) return { part: p.def, verb: 'blocked-on', by: [...new Set(blocked)].map((q) => q.def) };
    install(p);
    return { part: p.def, verb: 'on' };
  }

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
      const free = [...parts.values()].filter((p) => !p.off && !p.busy && !offOrHidden(p) && !blockersOff(p).length && !p.carriedBy);
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
      const p = [...history].reverse().find((q) => !q.busy && !q.carriedBy && !blockersOn(q).length);
      if (!p) return history.length > 0 && [...parts.values()].some((q) => q.busy);
      install(p);
      onChange();
      return true;
    });
  }
  /** Everything back at once (before the truck drives off). */
  function restoreNow() {
    clearInterval(queue);
    queue = null;
    for (const tw of tweens.splice(0)) tw.p.busy = false;
    while (history.length) install(history[history.length - 1], { instant: true });
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
    isOff: (id) => parts.get(id)?.off ?? false,
    tap,
    takeAll,
    putAllBack,
    restoreNow,
    stop() {
      clearInterval(queue);
      queue = null;
    },
  };
}
