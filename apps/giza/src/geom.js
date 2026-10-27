// Geometry helpers: a buffer that collects quads and triangles with normals, UVs and vertex colours and
// turns into one Babylon mesh, a seeded hash for repeatable randomness, and value noise.
import { Mesh, VertexData } from '@babylonjs/core';

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));

/** A rectangle less some holes, as rectangles: cut into strips at every hole's edges. */
export function minus(r, holes) {
  const hs = holes
    .map((h) => ({ u0: Math.max(r.u0, h.u0), u1: Math.min(r.u1, h.u1), v0: Math.max(r.v0, h.v0), v1: Math.min(r.v1, h.v1) }))
    .filter((h) => h.u1 > h.u0 + 1e-6 && h.v1 > h.v0 + 1e-6);
  if (!hs.length) return [r];
  const us = [...new Set([r.u0, r.u1, ...hs.flatMap((h) => [h.u0, h.u1])])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1], m = (a + b) / 2;
    const cuts = hs.filter((h) => h.u0 <= m && h.u1 >= m).sort((p, q) => p.v0 - q.v0);
    let v = r.v0;
    for (const h of cuts) {
      if (h.v0 > v + 1e-6) out.push({ u0: a, u1: b, v0: v, v1: h.v0 });
      v = Math.max(v, h.v1);
    }
    if (r.v1 > v + 1e-6) out.push({ u0: a, u1: b, v0: v, v1: r.v1 });
  }
  return out;
}

/** A repeatable random number in [0, 1) from integers. */
export function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h ^= Math.imul((v | 0) + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in 2D, about 0..1, with features `scale` units apart. `seed` picks an independent field. */
export function noise2(x, y, scale, seed = 0) {
  x /= scale;
  y /= scale;
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Two octaves of noise2. */
export function fbm(x, y, scale, seed = 0) {
  return noise2(x, y, scale, seed) * 0.65 + noise2(x, y, scale / 2.7, seed + 17) * 0.35;
}

/**
 * Collects faces in a left-handed, y-up world (Babylon's). A quad is given counter-clockwise as seen from the side
 * it faces; `uv` per corner; `c` a colour per corner (or one for all).
 */
export class Geo {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.i = [];
  }

  get count() {
    return this.p.length / 3;
  }

  /** Corners a, b, c, d as [x, y, z], counter-clockwise seen from the front. */
  quad(a, b, c, d, uv, col = 1) {
    const base = this.count;
    const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
    const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1;
    const cols = Array.isArray(col) ? col : [col, col, col, col];
    [a, b, c, d].forEach((v, k) => {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx / l, ny / l, nz / l);
      this.uv.push(uv[k][0], uv[k][1]);
      const g = cols[k];
      if (typeof g === 'number') this.c.push(g, g, g, 1);
      else this.c.push(g[0], g[1], g[2], 1);
    });
    this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  tri(a, b, c, uv, col = 1) {
    this.quad(a, b, c, c, [uv[0], uv[1], uv[2], uv[2]], Array.isArray(col) ? [...col, col[2]] : col);
  }

  /** Planar UVs in metres / `tile` on the two axes given ('x','y','z'). */
  static planar(pts, ua, va, tile, du = 0, dv = 0, flipU = false) {
    const ax = { x: 0, y: 1, z: 2 };
    return pts.map((p) => [((flipU ? -1 : 1) * p[ax[ua]] + du) / tile, (p[ax[va]] + dv) / tile]);
  }

  /**
   * A rectangle P(u, v) = O + U u + V v over [u0, u1] x [v0, v1], cut into cells about `cell` m across, facing
   * `facing` ([x, y, z]), less any `holes` ([{ u0, u1, v0, v1 }]). `uv(p)` and `col(p)` per corner.
   */
  rect(O, U, V, u0, u1, v0, v1, facing, { holes = [], cell = 0.7, uv, col = () => 1 }) {
    for (const r of minus({ u0, u1, v0, v1 }, holes)) {
      const nu = Math.max(1, Math.ceil((r.u1 - r.u0) / cell));
      const nv = Math.max(1, Math.ceil((r.v1 - r.v0) / cell));
      for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
          const ua = r.u0 + ((r.u1 - r.u0) * i) / nu, ub = r.u0 + ((r.u1 - r.u0) * (i + 1)) / nu;
          const va = r.v0 + ((r.v1 - r.v0) * j) / nv, vb = r.v0 + ((r.v1 - r.v0) * (j + 1)) / nv;
          const P = (u, v) => [O[0] + U[0] * u + V[0] * v, O[1] + U[1] * u + V[1] * v, O[2] + U[2] * u + V[2] * v];
          this.face([P(ua, va), P(ub, va), P(ub, vb), P(ua, vb)], facing, uv, col);
        }
      }
    }
  }

  /** A quad turned to face `facing`, with uv(p) and col(p) worked out per corner. */
  face(pts, facing, uv, col = () => 1) {
    const [a, b, , d] = pts;
    const n = cross(sub(b, a), sub(d, a));
    if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] < 0) pts = [pts[1], pts[0], pts[3], pts[2]];
    this.quad(pts[0], pts[1], pts[2], pts[3], pts.map(uv), pts.map(col));
  }

  /** Scales every vertex colour by light(p, n) → [r, g, b]: baked lighting. */
  bake(light) {
    for (let v = 0; v < this.count; v++) {
      const p = [this.p[v * 3], this.p[v * 3 + 1], this.p[v * 3 + 2]];
      const n = [this.n[v * 3], this.n[v * 3 + 1], this.n[v * 3 + 2]];
      const l = light(p, n);
      for (let c = 0; c < 3; c++) this.c[v * 4 + c] *= l[c];
    }
  }

  mesh(name, scene) {
    const m = new Mesh(name, scene);
    if (!this.count) return m;
    const vd = new VertexData();
    vd.positions = this.p;
    vd.normals = this.n;
    vd.uvs = this.uv;
    vd.colors = this.c;
    vd.indices = this.i;
    vd.applyToMesh(m, false);
    return m;
  }
}
