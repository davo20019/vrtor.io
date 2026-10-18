// Every part of both cells as a tree (cell › nucleus › nucleolus; cell › mitochondria › one mitochondrion › its
// cristae), each with its own transform in the scene so any of them comes out alone or with what it holds.
// Taken out, a part keeps where it came from and goes back there when it's let go close to it.
import { Color3, Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';

/** Let go this close to where it belongs (m) and it goes back in. */
const SNAP = 0.18;
const SLOTS = ['hover', 'near', 'quiz-wrong', 'quiz', 'hand', 'picked'];

export function createParts(scene) {
  const nodes = [];
  const byKey = new Map();
  const tweens = new Set();
  const lit = new Map();      // slot -> { id, color }
  let isolated = null;
  const hidden = new Set();

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime();
    for (const tw of tweens) {
      tw.k = Math.min(1, tw.k + dt / tw.ms);
      const e = 1 - Math.pow(1 - tw.k, 3);
      Vector3.LerpToRef(tw.p0, tw.p1, e, tw.t.position);
      Quaternion.SlerpToRef(tw.q0, tw.q1, e, tw.t.rotationQuaternion);
      Vector3.LerpToRef(tw.s0, tw.s1, e, tw.t.scaling);
      if (tw.k >= 1) {
        tweens.delete(tw);
        tw.done?.();
      }
    }
  });

  /**
   * A part: `{ key, name, parent, meshes, t?, cell, grab, surface? }`. `t` is its transform (made if missing, under
   * the parent's); `key` names its text (content.js); `grab` lets a hand take it; `surface(pLocal)` tells how
   * far a point is from a membrane (for shells a hand is never "inside").
   */
  function add(spec) {
    const id = nodes.length;
    const parentNode = spec.parent ?? null;
    const t = spec.t ?? new TransformNode(`part-${id}`, scene);
    if (spec.t === undefined && parentNode !== null) t.parent = nodes[parentNode].t;
    if (!t.rotationQuaternion) t.rotationQuaternion = Quaternion.FromEulerVector(t.rotation);
    const n = { id, children: [], meshes: [], ...spec, parent: parentNode, t, home: null };
    nodes.push(n);
    if (parentNode !== null) nodes[parentNode].children.push(id);
    for (const m of n.meshes) claim(m, id);
    if (spec.key && !byKey.has(`${spec.cell}:${spec.key}`)) byKey.set(`${spec.cell}:${spec.key}`, id);
    return id;
  }
  function claim(mesh, id) {
    mesh.metadata = { ...(mesh.metadata ?? {}), part: id };
    if (!nodes[id].meshes.includes(mesh)) nodes[id].meshes.push(mesh);
  }

  function* below(id) {
    yield id;
    for (const c of nodes[id].children) yield* below(c);
  }
  const meshesBelow = (id) => [...below(id)].flatMap((i) => nodes[i].meshes);
  const parentOf = (id) => nodes[id].parent;
  const path = (id) => {
    const out = [];
    for (let i = id; i !== null; i = nodes[i].parent) out.unshift(i);
    return out;
  };

  function nodeOfMesh(mesh) {
    for (let m = mesh; m; m = m.parent) if (m.metadata?.part !== undefined) return m.metadata.part;
    return null;
  }

  // ---- lighting up
  function highlight(slot, id, color = null) {
    if (id === null) lit.delete(slot);
    else lit.set(slot, { id, color });
    relight();
  }
  /** Later kinds of light win: a part both hovered and chosen shows as chosen. */
  function relight() {
    for (const n of nodes) for (const m of n.meshes) m.renderOverlay = false;
    const rank = (s) => SLOTS.findIndex((p) => s === p || s.startsWith(`${p}-`));
    const order = [...lit.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
    for (const [slot, { id, color }] of order) {
      const soft = slot === 'hover' || slot.startsWith('near');
      for (const m of meshesBelow(id)) {
        m.renderOverlay = true;
        m.overlayColor = color ?? Color3.White();
        m.overlayAlpha = soft ? 0.22 : 0.4;
      }
    }
  }

  // ---- where things are
  function boxOf(id) {
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.scale(-1);
    for (const m of meshesBelow(id)) {
      if (!m.isEnabled() || !m.isVisible) continue;
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo().boundingBox;
      lo.minimizeInPlace(b.minimumWorld);
      hi.maximizeInPlace(b.maximumWorld);
    }
    return { lo, hi };
  }
  function centreOf(id) {
    const n = nodes[id];
    if (n.anchor) return Vector3.TransformCoordinates(n.anchor, n.t.computeWorldMatrix(true));
    const { lo, hi } = boxOf(id);
    if (!Number.isFinite(lo.x)) return n.t.getAbsolutePosition().clone();
    return lo.add(hi).scale(0.5);
  }
  const sizeOf = (id) => {
    const { lo, hi } = boxOf(id);
    return Number.isFinite(lo.x) ? hi.subtract(lo).length() : 0.3;
  };

  // ---- taking out and putting back
  function remember(n) {
    if (n.home) return;
    const t = n.t;
    n.home = { parent: t.parent, pos: t.position.clone(), rot: t.rotationQuaternion.clone(), scale: t.scaling.clone() };
  }
  const isHome = (id) => !nodes[id].home;
  function homeWorld(n) {
    const local = Matrix.Compose(n.home.scale, n.home.rot, n.home.pos);
    return n.home.parent ? local.multiply(n.home.parent.computeWorldMatrix(true)) : local;
  }
  function stopTweens(t) {
    for (const tw of tweens) if (tw.t === t) tweens.delete(tw);
  }
  /** Lifts a part out of its place (its transform now in the world), to follow `hand` (a world matrix). */
  function take(id, hand) {
    const n = nodes[id];
    remember(n);
    stopTweens(n.t);
    n.t.setParent(null);
    const world = n.t.computeWorldMatrix(true);
    const offset = world.multiply(Matrix.Invert(hand));
    return { id, offset };
  }
  function follow(hold, hand) {
    const t = nodes[hold.id].t;
    const w = hold.offset.multiply(hand);
    w.decompose(t.scaling, t.rotationQuaternion, t.position);
  }
  /** Lets go: back in when it's near where it belongs ('home'), otherwise it stays in the air ('air'). */
  function drop(hold) {
    const n = nodes[hold.id];
    const at = n.t.getAbsolutePosition();
    const home = homeWorld(n).getTranslation();
    if (Vector3.Distance(at, home) < SNAP) {
      putBack(hold.id);
      return 'home';
    }
    return 'air';
  }
  function tweenTo(t, pos, rot, scale, ms, done) {
    stopTweens(t);
    tweens.add({ t, k: 0, ms, p0: t.position.clone(), p1: pos, q0: t.rotationQuaternion.clone(), q1: rot, s0: t.scaling.clone(), s1: scale, done });
  }
  /** Floats a part out to `to` (world), at `scale` times its size. */
  function sendTo(id, to, done, scale = null, rot = null) {
    const n = nodes[id];
    remember(n);
    n.t.setParent(null);
    const s = scale ? n.home.scale.multiply(worldScale(n)).scale(scale) : n.t.scaling.clone();
    // Where its origin goes so that its middle lands at `to` once turned and scaled.
    const q = rot ?? n.t.rotationQuaternion.clone();
    const mid = centreOf(id).subtract(n.t.position).applyRotationQuaternion(Quaternion.Inverse(n.t.rotationQuaternion));
    const k = s.x / n.t.scaling.x;
    tweenTo(n.t, to.subtract(mid.scale(k).applyRotationQuaternion(q)), q, s, 650, done);
  }
  function worldScale(n) {
    const p = n.home.parent;
    if (!p) return Vector3.One();
    const s = new Vector3();
    p.computeWorldMatrix(true).decompose(s);
    return s;
  }
  /** Bigger or smaller where it is, about its middle. */
  function rescale(id, k) {
    const n = nodes[id];
    if (!n.home) return;
    const c = centreOf(id);
    const s = n.t.scaling.scale(k);
    const pos = c.add(n.t.position.subtract(c).scale(k));
    tweenTo(n.t, pos, n.t.rotationQuaternion.clone(), s, 300);
  }
  function putBack(id, done) {
    const n = nodes[id];
    if (!n.home) return done?.();
    const w = homeWorld(n);
    const s = new Vector3(), q = new Quaternion(), p = new Vector3();
    w.decompose(s, q, p);
    tweenTo(n.t, p, q, s, 600, () => {
      n.t.setParent(n.home.parent);
      n.t.position.copyFrom(n.home.pos);
      n.t.rotationQuaternion.copyFrom(n.home.rot);
      n.t.scaling.copyFrom(n.home.scale);
      n.home = null;
      done?.();
    });
  }
  function putAllBack() {
    for (const n of nodes) if (n.home) putBack(n.id);
  }
  const movedCount = () => nodes.filter((n) => n.home).length;

  // ---- showing and hiding
  function isolate(list) {
    isolated = list === null ? null : [].concat(list);
    apply();
  }
  function hide(id) {
    hidden.add(id);
    apply();
  }
  function showAll() {
    hidden.clear();
    apply();
  }
  /** Which meshes show: what's switched on (a part's own `shown()`), minus the hidden, within what's isolated. */
  function apply() {
    const keep = isolated ? new Set(isolated.flatMap((i) => [...below(i)])) : null;
    // Isolating a part shows the parts above it only as far as they hold it (not the rest of the cell).
    for (const n of nodes) {
      const off = path(n.id).some((i) => hidden.has(i));
      for (const m of n.meshes) {
        const want = (m.metadata?.shown ? m.metadata.shown() : true) && !off && (!keep || keep.has(n.id));
        m.setEnabled(want);
      }
    }
  }

  /** The smallest part a hand at p (world) is touching, within `reach`. */
  function partAt(p, reach) {
    let best = null, bestSize = Infinity;
    for (const n of nodes) {
      if (!n.grab) continue;
      const ms = meshesBelow(n.id).filter((m) => m.isEnabled() && m.isVisible);
      if (!ms.length) continue;
      if (n.surface) {
        const local = Vector3.TransformCoordinates(p, Matrix.Invert(n.t.computeWorldMatrix(true)));
        if (n.surface(local) > reach) continue;
        const size = 1e3 + sizeOf(n.id);     // a membrane only when nothing smaller is there
        if (size < bestSize) { best = n.id; bestSize = size; }
        continue;
      }
      const { lo, hi } = boxOf(n.id);
      const r = new Vector3(reach, reach, reach);
      if (p.x < lo.x - r.x || p.y < lo.y - r.y || p.z < lo.z - r.z || p.x > hi.x + r.x || p.y > hi.y + r.y || p.z > hi.z + r.z) continue;
      const d = hi.subtract(lo);
      const size = d.x * d.y * d.z;
      if (size < bestSize) { best = n.id; bestSize = size; }
    }
    return best;
  }

  return {
    nodes,
    add,
    claim,
    below,
    meshesBelow,
    parentOf,
    path,
    nodeOfMesh,
    idOf: (cell, key) => byKey.get(`${cell}:${key}`) ?? null,
    highlight,
    boxOf,
    centreOf,
    sizeOf,
    take,
    follow,
    drop,
    sendTo,
    rescale,
    putBack,
    putAllBack,
    isHome,
    movedCount,
    isolate,
    isolated: () => isolated,
    hide,
    showAll,
    hiddenCount: () => hidden.size,
    apply,
    partAt,
  };
}
