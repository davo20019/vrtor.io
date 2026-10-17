// The body: BodyParts3D's parts and Z-Anatomy's additions, 3,245 in all (assets-src/body), each its own mesh, hung in the anatomy's own tree
// (models/body.json): Human body > system > organ > part > ... > the meshes. Every node of the tree is a
// TransformNode, so moving a node moves everything under it: take hold of the heart and its valves, walls and
// coronary vessels come along; take hold of one valve and only it comes out.
//
// A node that has been moved remembers where it belongs: let go of it close to there and it goes back in.
// Meshes and nodes that aren't moving have their world matrices frozen (3,245 meshes would otherwise be
// recomputed every frame); taking hold of a node thaws it and everything under it until it settles.
import { DracoDecoder, LoadAssetContainerAsync, Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createTissues } from './tissues.js';

const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

/** Let go this close to where it belongs (m, and degrees) and a part goes back in. */
const HOME_DIST = 0.06;
const HOME_DEG = 25;
/** How long a part takes to glide home, or out to where it's sent (s). */
const GLIDE_S = 0.6;

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Loads the body under `parent`. Returns the body's API (see the end). `onProgress(0..1)`; `lite` for the headset's
 * cheaper materials; `systems` to load first (the rest follow).
 */
export async function loadBody(scene, parent, { version = '1', lite = false, onProgress = () => {} } = {}) {
  const info = await (await fetch(`${BASE}models/body.json?v=${version}`)).json();
  const nodes = info.nodes;
  const mats = createTissues(scene, { lite });

  // glTF is right-handed: the loader's root turns it into Babylon's frame. One such root for all the files.
  const frame = new TransformNode('body-gltf', scene);
  frame.parent = parent;
  frame.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI);
  frame.scaling = new Vector3(1, 1, -1);

  // The tree as TransformNodes (the leaves are the meshes themselves, attached below).
  const tnode = new Array(nodes.length);
  for (const n of nodes) {
    if (n.el) continue;
    const t = new TransformNode(`n${n.id}`, scene);
    t.metadata = { node: n.id };
    t.rotationQuaternion = Quaternion.Identity();
    tnode[n.id] = t;
  }
  for (const n of nodes) if (!n.el) tnode[n.id].parent = n.parent === null ? frame : tnode[n.parent];

  const byEl = new Map(nodes.filter((n) => n.el).map((n) => [n.el, n]));
  const meshOf = new Array(nodes.length);
  const nodeOfMesh = new Map();
  const systems = info.systems;

  // One file per system of BodyParts3D's parts, and one of Z-Anatomy's additions (body-za.glb, its own licence).
  const files = info.files ?? systems.map((s) => s.id);
  const progress = Object.fromEntries(files.map((f) => [f, 0]));
  const sizes = info.sizes ?? {};
  const total = files.reduce((a, f) => a + (sizes[f] ?? 1), 0);
  const report = () => onProgress(files.reduce((a, f) => a + progress[f] * (sizes[f] ?? 1), 0) / total);

  async function loadFile(file) {
    const container = await LoadAssetContainerAsync(`${BASE}models/body-${file}.glb?v=${version}`, scene, {
      onProgress: (e) => {
        if (!e.lengthComputable) return;
        progress[file] = e.loaded / e.total;
        report();
      },
    });
    container.addAllToScene();
    for (const m of container.meshes) {
      const n = byEl.get(m.name);
      if (!n) continue;
      // From the container's own root to ours: same frame, so the mesh's own transform carries over.
      m.parent = tnode[n.parent];
      m.material = mats[n.tissue] ?? mats.muscle;
      m.metadata = { node: n.id };
      m.isPickable = true;
      m.rotationQuaternion ??= Quaternion.Identity();
      meshOf[n.id] = m;
      nodeOfMesh.set(m, n.id);
    }
    for (const m of container.meshes) if (!nodeOfMesh.has(m)) m.dispose();
    for (const mat of container.materials) mat.dispose();
    progress[file] = 1;
    report();
  }
  await Promise.all(files.map(loadFile));

  // ---- the tree's helpers
  const kids = (id) => nodes[id].kids;
  const parentOf = (id) => nodes[id].parent;
  const objOf = (id) => meshOf[id] ?? tnode[id];
  function* below(id) {
    yield id;
    for (const k of kids(id)) yield* below(k);
  }
  const meshesBelow = (id) => [...below(id)].map((i) => meshOf[i]).filter(Boolean);
  const path = (id) => {
    const out = [];
    for (let i = id; i !== null; i = parentOf(i)) out.unshift(i);
    return out;
  };
  const systemOf = (id) => nodes[id].system ?? null;

  // Where each node belongs: its local transform as loaded.
  const home = new Map();
  for (const n of nodes) {
    const o = objOf(n.id);
    if (!o) continue;
    home.set(n.id, { position: o.position.clone(), rotation: (o.rotationQuaternion ?? Quaternion.Identity()).clone() });
  }
  const isHome = (id) => {
    const o = objOf(id), h = home.get(id);
    return Vector3.Distance(o.position, h.position) < 1e-5 && Math.abs(Quaternion.Dot(o.rotationQuaternion, h.rotation)) > 0.99999;
  };

  // ---- freezing: everything still is frozen; a node being moved is thawed with all it carries
  const thawed = new Map();      // node id -> count of reasons
  function thaw(id) {
    thawed.set(id, (thawed.get(id) ?? 0) + 1);
    if (thawed.get(id) > 1) return;
    for (const i of below(id)) {
      const o = objOf(i);
      if (o.unfreezeWorldMatrix) o.unfreezeWorldMatrix();
    }
  }
  function settle(id) {
    const c = (thawed.get(id) ?? 1) - 1;
    if (c > 0) return thawed.set(id, c);
    thawed.delete(id);
    // Frozen again once its new place is computed (a held ancestor keeps its own thaw).
    for (const i of below(id)) {
      const o = objOf(i);
      o.computeWorldMatrix(true);
      if (!heldAbove(i)) o.freezeWorldMatrix?.();
    }
  }
  const heldAbove = (id) => {
    for (let i = parentOf(id); i !== null; i = parentOf(i)) if (thawed.has(i)) return true;
    return false;
  };
  function freezeAll() {
    for (const n of nodes) {
      const o = objOf(n.id);
      o.computeWorldMatrix(true);
      o.freezeWorldMatrix?.();
    }
    for (const m of meshOf) {
      if (!m) continue;
      m.material?.freeze?.();
    }
  }
  frame.computeWorldMatrix(true);
  freezeAll();

  // ---- moving a node about with a hand (or a mouse): it keeps the offset it had from the hand when taken
  const tmp = { m: new Matrix(), inv: new Matrix(), s: new Vector3(), q: new Quaternion(), p: new Vector3() };
  /** hand: a world Matrix. Returns a hold token. */
  function take(id, hand) {
    const o = objOf(id);
    stopGlide(id);
    thaw(id);
    o.computeWorldMatrix(true);
    const offset = o.getWorldMatrix().multiply(Matrix.Invert(hand));
    return { id, offset };
  }
  /** Moves a held node so it keeps its offset from the hand. */
  function follow(hold, hand) {
    const o = objOf(hold.id);
    const desired = hold.offset.multiply(hand);
    const p = o.parent;
    p.computeWorldMatrix(true);
    p.getWorldMatrix().invertToRef(tmp.inv);
    desired.multiplyToRef(tmp.inv, tmp.m);
    tmp.m.decompose(tmp.s, tmp.q, tmp.p);
    o.position.copyFrom(tmp.p);
    o.rotationQuaternion.copyFrom(tmp.q);
  }
  /** Lets go: near where it belongs it glides back in. Returns 'home' or 'out'. */
  function drop(hold) {
    const id = hold.id;
    const o = objOf(id), h = home.get(id);
    const near = Vector3.Distance(worldOf(id, o.position), worldOf(id, h.position)) < HOME_DIST
      && angleDeg(o.rotationQuaternion, h.rotation) < HOME_DEG;
    if (near) {
      glide(id, h.position, h.rotation, () => settle(id));
      return 'home';
    }
    settle(id);
    return 'out';
  }
  /** A local position of node `id`'s in world space (to compare distances as the eye sees them). */
  function worldOf(id, local) {
    const p = objOf(id).parent;
    return Vector3.TransformCoordinates(local, p.getWorldMatrix());
  }
  const angleDeg = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(Quaternion.Dot(a, b)))) * 180) / Math.PI;

  // ---- gliding: back home, or out in front of the viewer
  const glides = new Map();
  function glide(id, position, rotation, done = () => {}) {
    const o = objOf(id);
    stopGlide(id);
    thaw(id);
    glides.set(id, { a: o.position.clone(), b: position.clone(), qa: o.rotationQuaternion.clone(), qb: rotation.clone(), t: 0, done });
  }
  function stopGlide(id) {
    const g = glides.get(id);
    if (!g) return;
    glides.delete(id);
    settle(id);
  }
  scene.onBeforeRenderObservable.add(() => {
    if (!glides.size) return;
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (const [id, g] of glides) {
      g.t = Math.min(1, g.t + dt / GLIDE_S);
      const k = smooth(g.t);
      const o = objOf(id);
      Vector3.LerpToRef(g.a, g.b, k, o.position);
      Quaternion.SlerpToRef(g.qa, g.qb, k, o.rotationQuaternion);
      if (g.t >= 1) {
        glides.delete(id);
        g.done();
      }
    }
  });

  /** Sends a node out to a world position (its centre there), facing as it was. */
  function sendTo(id, worldCentre, done) {
    const o = objOf(id);
    const c = centreOf(id);
    const p = o.parent;
    p.computeWorldMatrix(true);
    const inv = Matrix.Invert(p.getWorldMatrix());
    const shift = Vector3.TransformCoordinates(worldCentre, inv).subtract(Vector3.TransformCoordinates(c, inv));
    glide(id, o.position.add(shift), o.rotationQuaternion, () => {
      settle(id);
      done?.();
    });
  }
  function putBack(id, done) {
    const h = home.get(id);
    glide(id, h.position, h.rotation, () => {
      settle(id);
      done?.();
    });
  }
  /** Everything that has been moved goes back. */
  function putAllBack() {
    for (const n of nodes) if (objOf(n.id) && !isHome(n.id)) putBack(n.id);
  }
  const movedCount = () => nodes.filter((n) => objOf(n.id) && !isHome(n.id)).length;

  // ---- what's where
  function boxOf(id) {
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.scale(-1);
    for (const m of meshesBelow(id)) {
      if (!m.isEnabled()) continue;
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo().boundingBox;
      lo.minimizeInPlace(b.minimumWorld);
      hi.maximizeInPlace(b.maximumWorld);
    }
    return { lo, hi };
  }
  function centreOf(id) {
    const { lo, hi } = boxOf(id);
    return Number.isFinite(lo.x) ? lo.add(hi).scale(0.5) : objOf(id).getAbsolutePosition();
  }
  /** The smallest visible part whose box holds `point` (padded by `reach`): what a hand there would take. */
  function partAt(point, reach) {
    let best = null, size = Infinity;
    for (const m of meshOf) {
      if (!m || !m.isEnabled() || !m.isVisible) continue;
      const b = m.getBoundingInfo().boundingBox;
      const lo = b.minimumWorld, hi = b.maximumWorld;
      if (point.x < lo.x - reach || point.x > hi.x + reach || point.y < lo.y - reach || point.y > hi.y + reach || point.z < lo.z - reach || point.z > hi.z + reach) continue;
      const s = (hi.x - lo.x) * (hi.y - lo.y) * (hi.z - lo.z);
      if (s < size) {
        size = s;
        best = m;
      }
    }
    return best ? nodeOfMesh.get(best) : null;
  }

  // ---- showing and hiding: by system, or by node
  const hidden = new Set();     // node ids hidden by the visitor
  const systemOn = Object.fromEntries(systems.map((s) => [s.id, true]));
  /** "Show only this": everything else hidden, whatever the layer; null shows the layer again. */
  let only = null;
  function refreshVisibility() {
    for (const n of nodes) {
      const m = meshOf[n.id];
      if (!m) continue;
      let on, inside = false;
      for (let i = n.id; i !== null; i = parentOf(i)) if (i === only) inside = true;
      if (only !== null) {
        on = inside;
      } else {
        on = systemOn[n.system] !== false;
        for (let i = n.id; on && i !== null; i = parentOf(i)) if (hidden.has(i)) on = false;
      }
      m.setEnabled(on);
    }
  }
  function isolate(id) {
    only = id;
    refreshVisibility();
  }
  function setSystem(id, on) {
    systemOn[id] = on;
    refreshVisibility();
  }
  function hide(id) {
    hidden.add(id);
    refreshVisibility();
  }
  function showAll() {
    hidden.clear();
    refreshVisibility();
  }

  // ---- highlight: an overlay on the meshes under a node
  const lit = new Map();         // key -> node id
  function highlight(key, id, color) {
    const before = lit.get(key);
    if (before === id) return;
    lit.set(key, id);
    if (id === null || id === undefined) lit.delete(key);
    const want = new Map();
    for (const [, v] of lit) for (const m of meshesBelow(v)) want.set(m, true);
    if (before !== undefined && before !== null) for (const m of meshesBelow(before)) if (!want.has(m)) m.renderOverlay = false;
    if (id !== null && id !== undefined) {
      for (const m of meshesBelow(id)) {
        m.renderOverlay = true;
        m.overlayColor = color;
        m.overlayAlpha = 0.28;
      }
    }
  }

  return {
    info,
    nodes,
    systems,
    frame,
    meshes: meshOf.filter(Boolean),
    nodeOfMesh: (m) => nodeOfMesh.get(m) ?? null,
    parentOf,
    path,
    systemOf,
    below,
    meshesBelow,
    centreOf,
    boxOf,
    partAt,
    isHome,
    take,
    follow,
    drop,
    sendTo,
    putBack,
    putAllBack,
    movedCount,
    setSystem,
    systemOn: (id) => systemOn[id] !== false,
    hide,
    showAll,
    hiddenCount: () => hidden.size,
    isolate,
    isolated: () => only,
    highlight,
    count: nodes.filter((n) => n.el).length,
  };
}
