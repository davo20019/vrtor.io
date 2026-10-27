// The body drawn in a few dozen draw calls instead of 3,273: every opaque part is copied, where it belongs, into one
// mesh per tissue material (the batches), and the parts themselves stop drawing. A part that is lit, held, moving,
// out of its place or hidden drops out of its batch (its vertices are collapsed in the vertex shader) and draws
// as itself again, so everything that moves or lights a part keeps working on the part's own mesh. Picking and
// the hand's reach still use the parts' own meshes; the batches can't be picked.
//
// Why: on a Quest the CPU cost of a draw call, twice a frame (one per eye), held the whole body to 9 fps.
// See-through tissues (fascia, lungs, capsules...) stay as separate parts, so they are still sorted back to front.
import { Matrix, MaterialPluginBase, Mesh, Vector3, VertexBuffer } from '@babylonjs/core';

const ATTR = 'bodyPartOn';
/** The parts' usual layer mask (Babylon's default); 0 keeps a camera from drawing them. */
const SHOWN = 0x0fffffff;

class BatchPlugin extends MaterialPluginBase {
  constructor(material) {
    super(material, 'BodyBatch', 210, { BODY_BATCH: false }, true, true);
  }
  getClassName() {
    return 'BodyBatch';
  }
  prepareDefines(defines, scene, mesh) {
    defines.BODY_BATCH = !!mesh?.metadata?.batch;
  }
  getAttributes(attributes, scene, mesh) {
    if (mesh?.metadata?.batch) attributes.push(ATTR);
  }
  getCustomCode(type) {
    if (type !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_DEFINITIONS: `#ifdef BODY_BATCH\nattribute float ${ATTR};\n#endif`,
      // Outside the clip volume on every axis: the part's triangles are dropped before any pixel is shaded.
      CUSTOM_VERTEX_MAIN_END: `#ifdef BODY_BATCH\nif (${ATTR} < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\n#endif`,
    };
  }
}

/**
 * Builds the batches under `frame` from `meshes` (the parts, all at home and frozen). Returns { sync }: call it after
 * anything that changes which parts are lit, moving, out of place or shown.
 */
export function createBatches(scene, frame, meshes) {
  const engine = scene.getEngine();
  frame.computeWorldMatrix(true);
  const toFrame = Matrix.Invert(frame.getWorldMatrix());
  const groups = new Map();
  for (const m of meshes) {
    if (!m.material || m.material.needAlphaBlending()) continue;
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(m);
  }
  for (const mat of groups.keys()) if (!mat.pluginManager?.getPlugin('BodyBatch')) new BatchPlugin(mat);

  const parts = [];        // { mesh, batch, start, count, home (Float32Array 16), on }
  const batches = [];
  const rel = new Matrix(), nrm = new Matrix(), p = new Vector3(), n = new Vector3();
  for (const [mat, list] of groups) {
    let verts = 0, idx = 0;
    for (const m of list) {
      verts += m.getTotalVertices();
      idx += m.getTotalIndices();
    }
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 4);
    const on = new Float32Array(verts);
    const ind = new Uint32Array(idx);
    let v0 = 0, i0 = 0;
    const batch = new Mesh(`batch-${mat.name}`, scene);
    for (const m of list) {
      m.getWorldMatrix().multiplyToRef(toFrame, rel);
      rel.toNormalMatrix(nrm);
      const P = m.getVerticesData(VertexBuffer.PositionKind), N = m.getVerticesData(VertexBuffer.NormalKind);
      const C = m.getVerticesData(VertexBuffer.ColorKind), I = m.getIndices();
      const count = m.getTotalVertices();
      for (let k = 0; k < count; k++) {
        Vector3.TransformCoordinatesFromFloatsToRef(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], rel, p);
        pos[(v0 + k) * 3] = p.x; pos[(v0 + k) * 3 + 1] = p.y; pos[(v0 + k) * 3 + 2] = p.z;
        Vector3.TransformNormalFromFloatsToRef(N[k * 3], N[k * 3 + 1], N[k * 3 + 2], nrm, n);
        n.normalize();
        nor[(v0 + k) * 3] = n.x; nor[(v0 + k) * 3 + 1] = n.y; nor[(v0 + k) * 3 + 2] = n.z;
      }
      if (C) col.set(C.subarray(0, count * 4), v0 * 4);
      else col.fill(1, v0 * 4, (v0 + count) * 4);
      for (let k = 0; k < I.length; k++) ind[i0 + k] = I[k] + v0;
      parts.push({ mesh: m, batch, start: v0, count, home: Float32Array.from(m.getWorldMatrix().m), on: false });
      v0 += count;
      i0 += I.length;
    }
    batch.setVerticesData(VertexBuffer.PositionKind, pos, false);
    batch.setVerticesData(VertexBuffer.NormalKind, nor, false);
    batch.setVerticesData(VertexBuffer.ColorKind, col, false, 4);
    batch.setIndices(ind, verts);
    const onBuffer = new VertexBuffer(engine, on, ATTR, true, false, 1);
    batch.setVerticesBuffer(onBuffer);
    // The glTF parts wind their triangles the other way from a new mesh's default.
    batch.sideOrientation = list[0].sideOrientation;
    batch.parent = frame;
    batch.material = mat;
    batch.isPickable = false;
    batch.metadata = { batch: true };
    batch.computeWorldMatrix(true);
    batch.freezeWorldMatrix();
    batches.push({ mesh: batch, on, onBuffer, lo: Infinity, hi: -1 });
    batch.metadata.index = batches.length - 1;
  }

  const atHome = (part) => {
    const w = part.mesh.getWorldMatrix().m, h = part.home;
    for (let k = 0; k < 16; k++) if (Math.abs(w[k] - h[k]) > 1e-5) return false;
    return true;
  };
  function sync() {
    for (const part of parts) {
      const m = part.mesh;
      const inBatch = m.isEnabled() && !m.renderOverlay && m.isWorldMatrixFrozen && atHome(part);
      m.layerMask = inBatch ? 0 : SHOWN;
      if (inBatch === part.on) continue;
      part.on = inBatch;
      const b = batches[part.batch.metadata.index];
      b.on.fill(inBatch ? 1 : 0, part.start, part.start + part.count);
      b.lo = Math.min(b.lo, part.start);
      b.hi = Math.max(b.hi, part.start + part.count);
    }
    for (const b of batches) {
      if (b.hi < 0) continue;
      b.onBuffer.updateDirectly(b.on.subarray(b.lo, b.hi), b.lo);
      b.mesh.setEnabled(b.on.includes(1));
      b.lo = Infinity;
      b.hi = -1;
    }
  }
  sync();
  return { sync, batches: batches.map((b) => b.mesh) };
}
