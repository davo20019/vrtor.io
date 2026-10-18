// Geometry for the cells, all drawn here (no model files): membranes as superellipsoid shells (an ellipsoid when
// the exponents are 1, a rounded box as they shrink), cut open where the cell is cut away; flattened sacs (the
// ER's and the Golgi's cisternae, cristae) as "pillows"; filaments as tubes; flat caps where a cut goes through.
//
// Frame: metres, up +y. A cut-away cell is missing its quadrant x > 0, z > 0 (theta between 0 and 90 degrees).
import { Color3, Matrix, Mesh, MeshBuilder, PBRMaterial, Quaternion, Vector3, VertexData } from '@babylonjs/core';

/** Metres per micrometre: the cells are 150,000 times life size. */
export const UM = 0.15;
export const TAU = Math.PI * 2;

const sgn = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** A point on a superellipsoid of radii r: theta round y from +x to +z, phi from -pi/2 (bottom) to pi/2 (top). */
export function superPoint(r, e1, e2, theta, phi) {
  const cp = sgn(Math.cos(phi), e1);
  return new Vector3(r.x * cp * sgn(Math.cos(theta), e2), r.y * sgn(Math.sin(phi), e1), r.z * cp * sgn(Math.sin(theta), e2));
}

/** How far p is outside (> 1) or inside (< 1) the superellipsoid, as the factor its radii would need. */
export function superScale(r, e1, e2, p) {
  const f = Math.pow(Math.pow(Math.abs(p.x / r.x), 2 / e2) + Math.pow(Math.abs(p.z / r.z), 2 / e2), e2 / e1) + Math.pow(Math.abs(p.y / r.y), 2 / e1);
  return Math.pow(f, e1 / 2);
}

/** Rows (phi) of columns (theta) of points. `deform(p)` may move each point. */
function grid(r, e1, e2, { t0 = 0, t1 = TAU, p0 = -Math.PI / 2, p1 = Math.PI / 2, seg = 48, rings = 32, deform = null }) {
  const rows = [];
  const cols = Math.max(2, Math.round((seg * (t1 - t0)) / TAU));
  const nr = Math.max(2, Math.round((rings * (p1 - p0)) / Math.PI));
  for (let i = 0; i <= nr; i++) {
    const phi = p0 + ((p1 - p0) * i) / nr;
    const row = [];
    for (let j = 0; j <= cols; j++) {
      let p = superPoint(r, e1, e2, t0 + ((t1 - t0) * j) / cols, phi);
      if (deform) p = deform(p);
      row.push(p);
    }
    rows.push(row);
  }
  return rows;
}

/** Vertex data of a grid of points (rows of equal length); `closed` joins the last column to the first. */
function gridData(rows, closed = false) {
  const pos = [], idx = [];
  const w = rows[0].length;
  for (const row of rows) for (const p of row) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const normals = [];
  VertexData.ComputeNormals(pos, idx, normals);
  if (closed) {
    // The seam: both copies of a point get the average of their two half-normals.
    for (let i = 0; i < rows.length; i++) {
      const a = (i * w) * 3, b = (i * w + w - 1) * 3;
      for (let k = 0; k < 3; k++) normals[a + k] = normals[b + k] = (normals[a + k] + normals[b + k]) / 2;
    }
  }
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = idx;
  vd.normals = normals;
  return vd;
}

function meshOf(name, scene, vd, material) {
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  if (material) m.material = material;
  return m;
}

/** A ribbon between two paths of equal length. */
export function strip(name, scene, a, b, material) {
  return meshOf(name, scene, gridData([a, b]), material);
}

/**
 * A membrane: a superellipsoid shell, or two (outer and inner, `thickness` apart) with their open edges joined.
 * The range of theta and phi it covers leaves the rest open: a cut-away cell is t0 = pi/2, a mitochondrion cut
 * lengthwise is p1 = 0. Returns one mesh.
 */
export function shell(name, scene, { r, e1 = 1, e2 = 1, t0 = 0, t1 = TAU, p0 = -Math.PI / 2, p1 = Math.PI / 2, seg = 48, rings = 32, thickness = 0, deform = null, material = null }) {
  const whole = t1 - t0 >= TAU - 1e-6;
  const opts = { t0, t1, p0, p1, seg, rings, deform };
  const outer = grid(r, e1, e2, opts);
  const parts = [gridData(outer, whole)];
  if (thickness > 0) {
    const ri = new Vector3(r.x - thickness, r.y - thickness, r.z - thickness);
    const inner = grid(ri, e1, e2, opts);
    parts.push(gridData(inner, whole));
    // The cut edges, where you see the membrane's thickness.
    if (!whole) {
      const col = (rows, j) => rows.map((row) => row[j]);
      const last = outer[0].length - 1;
      parts.push(gridData([col(outer, 0), col(inner, 0)]));
      parts.push(gridData([col(outer, last), col(inner, last)]));
    }
    if (p1 < Math.PI / 2 - 1e-6) parts.push(gridData([outer[outer.length - 1], inner[inner.length - 1]]));
    if (p0 > -Math.PI / 2 + 1e-6) parts.push(gridData([outer[0], inner[0]]));
  }
  const vd = parts[0];
  for (const p of parts.slice(1)) vd.merge(p);
  return meshOf(name, scene, vd, material);
}

/**
 * The boundary of a (deformed) superellipsoid in one of the cut's half-planes, bottom to top: theta = 0 is the
 * half-plane z = 0, x >= 0; theta = pi/2 is x = 0, z >= 0.
 */
export function cutCurve(r, e1, e2, theta, { n = 40, deform = null } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    let p = superPoint(r, e1, e2, theta, -Math.PI / 2 + (Math.PI * i) / n);
    if (deform) p = deform(p);
    pts.push(p);
  }
  return pts;
}

/** Distance from the axis (along x for theta 0, z for pi/2) of a bottom-to-top curve at height y; 0 outside it. */
function across(curve, theta, y) {
  const d = (p) => (theta === 0 ? p.x : p.z);
  if (y <= curve[0].y || y >= curve[curve.length - 1].y) return 0;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (y >= a.y && y <= b.y) {
      const k = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return d(a) + (d(b) - d(a)) * k;
    }
  }
  return 0;
}

/**
 * A flat cap on a cut face: the region between an outer boundary and an inner one (or the axis), in the
 * half-plane of `theta`. Curves are bottom to top, as cutCurve makes them.
 */
export function cap(name, scene, theta, outer, inner = null, { n = 48, material = null } = {}) {
  const y0 = outer[0].y, y1 = outer[outer.length - 1].y;
  const a = [], b = [];
  const at = (x, y) => (theta === 0 ? new Vector3(x, y, 0) : new Vector3(0, y, x));
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    const xo = i === 0 || i === n ? 0 : across(outer, theta, y);
    const xi = inner ? Math.min(xo, across(inner, theta, y)) : 0;
    a.push(at(xo, y));
    b.push(at(xi, y));
  }
  return strip(name, scene, a, b, material);
}

/**
 * A flattened sac (a cisterna, a crista): a surface f(u, v) in [0,1]², puffed out both ways along its normal by
 * up to `h`, closing to an edge all round. `f` returns the point; the normal is worked out from it.
 */
export function pillow(name, scene, f, { h, nu = 14, nv = 14, material = null, bulge = null }) {
  const top = [], bottom = [];
  const e = 1e-3;
  for (let i = 0; i <= nv; i++) {
    const v = i / nv;
    const rt = [], rb = [];
    for (let j = 0; j <= nu; j++) {
      const u = j / nu;
      const p = f(u, v);
      const du = f(Math.min(1, u + e), v).subtract(f(Math.max(0, u - e), v));
      const dv = f(u, Math.min(1, v + e)).subtract(f(u, Math.max(0, v - e)));
      let nrm = Vector3.Cross(du, dv);
      nrm = nrm.lengthSquared() > 1e-14 ? nrm.normalize() : Vector3.Up();
      const k = bulge ? bulge(u, v) : Math.sqrt(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)));
      rt.push(p.add(nrm.scale(h * k)));
      rb.push(p.subtract(nrm.scale(h * k)));
    }
    top.push(rt);
    bottom.push(rb);
  }
  const vd = gridData(top);
  vd.merge(gridData(bottom));
  return meshOf(name, scene, vd, material);
}

/** A smooth path through points (Catmull-Rom), `per` points per span. */
export function smooth(points, per = 6) {
  if (points.length < 3) return points;
  const out = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    for (let k = 0; k < per; k++) out.push(Vector3.CatmullRom(p[i - 1], p[i], p[i + 1], p[i + 2], k / per));
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Many tubes as one mesh. */
export function tubes(name, scene, paths, { radius, tessellation = 5, material = null }) {
  const list = paths.filter((p) => p.length >= 2).map((path, i) => MeshBuilder.CreateTube(`${name}-${i}`, { path, radius, tessellation, cap: Mesh.CAP_ALL }, scene));
  if (!list.length) return null;
  const m = Mesh.MergeMeshes(list, true, true);
  m.name = name;
  if (material) m.material = material;
  return m;
}

/** Copies of `template` at each matrix, as thin instances (one draw call). */
export function scatter(name, template, matrices, material = null) {
  const m = template;
  m.name = name;
  if (material) m.material = material;
  const buf = new Float32Array(matrices.length * 16);
  matrices.forEach((mx, i) => mx.copyToArray(buf, i * 16));
  m.thinInstanceSetBuffer('matrix', buf, 16, true);
  m.thinInstanceEnablePicking = true;
  m.alwaysSelectAsActiveMesh = false;
  m.thinInstanceRefreshBoundingInfo(true);
  return m;
}

/** A matrix placing something at p, its +y turned to `up`, scaled by s (a number or a Vector3). */
export function placeAt(p, up = Vector3.Up(), s = 1, spin = 0) {
  const scale = typeof s === 'number' ? new Vector3(s, s, s) : s;
  const q = turnTo(up).multiply(Quaternion.RotationAxis(Vector3.Up(), spin));
  return Matrix.Compose(scale, q, p);
}

/** The rotation taking +y to `dir`. */
export function turnTo(dir) {
  const d = dir.normalizeToNew();
  const up = Vector3.Up();
  const dot = Vector3.Dot(up, d);
  if (dot > 0.99999) return Quaternion.Identity();
  if (dot < -0.99999) return Quaternion.RotationAxis(Vector3.Right(), Math.PI);
  return Quaternion.RotationAxis(Vector3.Cross(up, d).normalize(), Math.acos(dot));
}

/** A wobble in the surface of a living thing: a smooth function of direction, about ±amp. */
export function wobble(amp, seed = 0) {
  return (p) => {
    const l = p.length() || 1;
    const x = p.x / l, y = p.y / l, z = p.z / l;
    const w = amp * (0.6 * Math.sin(2.7 * x + 1.3 + seed) * Math.cos(2.1 * y + seed * 0.7) + 0.4 * Math.sin(3.3 * z + 0.4 + seed * 1.9) * Math.cos(1.7 * x - seed));
    return p.scale(1 + w);
  };
}

/** A seeded random generator, so every visitor sees the same cell. */
export function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** A random unit vector. */
export function randomDir(rnd) {
  const z = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - z * z);
  return new Vector3(s * Math.cos(a), z, s * Math.sin(a));
}

/** The cut away quadrant (x > 0, z > 0, in the cell's own frame): how far p is from it (negative: inside it). */
export function fromCut(p) {
  if (p.x > 0 && p.z > 0) return -Math.min(p.x, p.z);
  if (p.x <= 0 && p.z <= 0) return Math.hypot(p.x, p.z);
  return p.x > 0 ? -p.z : -p.x;
}

const materials = new Map();
/**
 * A soft, slightly glossy material: living membranes are wet and a little translucent. Colours sRGB hex.
 * `alpha` < 1 is seen through; `glow` lifts the colour so it reads in the shade.
 */
export function mat(scene, key, { color, rough = 0.5, alpha = 1, glow = 0.08, sheen = 0 }) {
  if (materials.has(key)) return materials.get(key);
  const m = new PBRMaterial(`m-${key}`, scene);
  const c = Color3.FromHexString(color);
  m.albedoColor = c.toLinearSpace();
  m.metallic = 0;
  m.roughness = rough;
  m.emissiveColor = c.toLinearSpace().scale(glow);
  m.backFaceCulling = false;
  m.twoSidedLighting = true;
  m.environmentIntensity = 0.7;
  if (sheen) {
    m.sheen.isEnabled = true;
    m.sheen.intensity = sheen;
  }
  if (alpha < 1) {
    m.alpha = alpha;
    m.transparencyMode = PBRMaterial.MATERIAL_ALPHABLEND;
    m.needDepthPrePass = false;
  }
  materials.set(key, m);
  return m;
}
export function clearMaterials() {
  materials.clear();
}
