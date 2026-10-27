import { Vector3 } from '@babylonjs/core';

// Ray tests for walking, against the area's triangles bucketed in a 2 m grid in plan. Babylon's picking tests every
// triangle of a mesh whose bounds the ray meets, and the citadel's meshes span the whole site: each step's dozen
// short rays cost tens of milliseconds. Here a ray only meets the triangles of the cells it crosses.
const CELL = 2;
const key = (i, j) => i * 73856093 ^ j * 19349663;

export function createCollider(meshes) {
  const tris = [], cells = new Map();
  const v = new Vector3();
  for (const mesh of meshes) {
    const p = mesh.getVerticesData('position'), idx = mesh.getIndices(), world = mesh.computeWorldMatrix(true);
    if (!p) continue;
    const w = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(p[i], p[i + 1], p[i + 2], world, v);
      w[i] = v.x; w[i + 1] = v.y; w[i + 2] = v.z;
    }
    const count = idx?.length ? idx.length : p.length / 3;
    for (let t = 0; t < count; t += 3) {
      const a = (idx?.length ? idx[t] : t) * 3, b = (idx?.length ? idx[t + 1] : t + 1) * 3, c = (idx?.length ? idx[t + 2] : t + 2) * 3;
      const n = tris.length / 9;
      tris.push(w[a], w[a + 1], w[a + 2], w[b], w[b + 1], w[b + 2], w[c], w[c + 1], w[c + 2]);
      const x0 = Math.floor(Math.min(w[a], w[b], w[c]) / CELL), x1 = Math.floor(Math.max(w[a], w[b], w[c]) / CELL);
      const z0 = Math.floor(Math.min(w[a + 2], w[b + 2], w[c + 2]) / CELL), z1 = Math.floor(Math.max(w[a + 2], w[b + 2], w[c + 2]) / CELL);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const k = key(i, j);
        let list = cells.get(k);
        if (!list) cells.set(k, list = []);
        list.push(n);
      }
    }
  }
  const T = new Float32Array(tris);
  /** Nearest hit of the segment origin + dir * [0, length]: { distance, y, normalY } or null. */
  return function cast(origin, dir, length) {
    const ex = origin.x + dir.x * length, ez = origin.z + dir.z * length;
    const x0 = Math.floor(Math.min(origin.x, ex) / CELL), x1 = Math.floor(Math.max(origin.x, ex) / CELL);
    const z0 = Math.floor(Math.min(origin.z, ez) / CELL), z1 = Math.floor(Math.max(origin.z, ez) / CELL);
    let best = null;
    const seen = new Set();
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      for (const n of cells.get(key(i, j)) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        const o = n * 9;
        // Moller-Trumbore, both faces.
        const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
        const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
        const px = dir.y * e2z - dir.z * e2y, py = dir.z * e2x - dir.x * e2z, pz = dir.x * e2y - dir.y * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-9) continue;
        const inv = 1 / det, sx = origin.x - T[o], sy = origin.y - T[o + 1], sz = origin.z - T[o + 2];
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const w = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;
        if (w < 0 || u + w > 1) continue;
        const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (d < 0 || d > length || (best && d >= best.distance)) continue;
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        best = { distance: d, y: origin.y + dir.y * d, normalY: ny / Math.hypot(nx, ny, nz) };
      }
    }
    return best;
  };
}
