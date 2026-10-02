// The whole orca, wrapped around the skeleton: a body lofted along the skeleton's measured outline
// (models/orca-shape.json, from scripts/prepare-orca.py), plus the parts with no bone in them,
// the dorsal fin and the tail flukes, and the flippers over the hand bones. Colored in the orca's
// black and white: white chin, belly and flank patch, the white patch behind the eye and the grey
// saddle behind the fin. It's an illustration fitted to this skeleton, not a scan.
//
// Shapes are worked out in the skeleton's glTF frame (metres; +Z toward the snout, +Y up, the
// lowest bone at y = 0). The glTF loader mirrors X into Babylon's frame, so vertices are written
// with x negated.
import { Color3, DynamicTexture, Mesh, StandardMaterial, Texture, Vector3, VertexData } from '@babylonjs/core';

const BLACK = Color3.FromHexString('#16181b');
const WHITE = Color3.FromHexString('#eef0ee');
const SADDLE = Color3.FromHexString('#6a7076');
const RINGS = 140;
const AROUND = 56;
/** The pattern texture: the body unrolled (along it by around it), with a strip of plain colors at the foot for the fins. */
const TEX_W = 1024;
const TEX_H = 512;
const STRIP = 16;
const UV_BLACK = [0.25, 1 - (STRIP / 2) / TEX_H];
const UV_WHITE = [0.75, 1 - (STRIP / 2) / TEX_H];
/** Flesh over the bone: above the backbone and under the belly. */
const TOP_FLESH = 0.11;
const BELLY_FLESH = 0.09;

export function buildBody(scene, shape) {
  const slices = shape.slices;
  const zs = slices.map((s) => s.z);
  const zBack = zs[0];
  const zFront = zs[zs.length - 1];
  const snout = zFront + 0.12;
  const tailEnd = zBack - 0.08;

  // Upper and lower outlines: hulls bridge the gaps between bones (between the spines, behind
  // the ribs), then a light smoothing.
  const top = smooth(hull(zs, slices.map((s) => s.top), +1), 2).map((y) => y + TOP_FLESH);
  const bottom = smooth(hull(zs, slices.map((s) => s.bottom), -1), 2).map((y) => y - BELLY_FLESH);
  // The midline: the middle of each slice, except along the chest, where the flippers stick out
  // to the sides: there it runs straight between the ends.
  const chest = (z) => z > 0.45 && z < 2.05;
  const mids = slices.map((s) => (s.left + s.right) / 2);
  const free = zs.map((z, i) => [z, mids[i]]).filter(([z]) => !chest(z));
  const mid = smooth(zs.map((z) => interp(free.map((p) => p[0]), free.map((p) => p[1]), z)), 3);
  const at = (arr, z) => interp(zs, arr, z);

  /** How wide the body is for its height: round at the chest and head, flat at the tail stock. */
  const ratio = (z) => {
    const u = (z - tailEnd) / (snout - tailEnd);
    if (u < 0.12) return 0.32 + (0.45 - 0.32) * (u / 0.12);
    if (u < 0.45) return 0.45 + (0.86 - 0.45) * smoothstep((u - 0.12) / 0.33);
    return 0.86;
  };

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStart = [];
  /** Per ring: where it is along the body, its middle height and half-height (for the pattern). */
  const rings = [];
  for (let r = 0; r <= RINGS; r++) {
    const v = r / RINGS;
    // More rings toward the ends, where the shape turns fastest.
    const z = tailEnd + (snout - tailEnd) * (0.5 - 0.5 * Math.cos(Math.PI * v));
    const zc = Math.max(zBack, Math.min(zFront, z));
    let t = at(top, zc);
    let b = at(bottom, zc);
    // Close the ends: the snout rounds off, the tail stock narrows into the flukes.
    const front = Math.max(0, (z - (zFront - 0.4)) / (snout - (zFront - 0.4)));
    const back = Math.max(0, ((zBack + 0.12) - z) / ((zBack + 0.12) - tailEnd));
    const cy = (t + b) / 2;
    let hh = (t - b) / 2;
    if (front > 0) hh *= Math.sqrt(Math.max(0, 1 - front * front));
    if (back > 0) hh *= 1 - 0.65 * back;
    const hw = hh * ratio(z);
    const cx = at(mid, zc);
    ringStart.push(positions.length / 3);
    rings.push({ z, cy, hh });
    // One more vertex than the ring has sides, so the texture wraps without a seam.
    for (let k = 0; k <= AROUND; k++) {
      // theta 0 at the top, PI at the belly.
      const theta = (k / AROUND) * Math.PI * 2;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      // A slightly squared-off ellipse.
      const e = 0.9;
      const x = cx + hw * Math.sign(s) * Math.pow(Math.abs(s), e);
      const y = cy + hh * Math.sign(c) * Math.pow(Math.abs(c), e);
      positions.push(-x, y, z);
      uvs.push(v, (k / AROUND) * (1 - STRIP / TEX_H));
    }
  }
  for (let r = 0; r < RINGS; r++) {
    for (let k = 0; k < AROUND; k++) {
      const a = ringStart[r] + k;
      const b = a + 1;
      const c = ringStart[r + 1] + k;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const parts = [meshFrom(scene, 'orca-body', positions, uvs, indices)];

  // The dorsal fin: tall and nearly straight-edged on an adult male (up to 1.8 m), no bone in it.
  const finBase = at(top, 0.1) - 0.04;
  const finX = at(mid, 0.1);
  parts.push(fin(scene, 'dorsal-fin', 10, (s) => {
    const y = finBase + 1.5 * s;
    const le = 0.55 - 0.72 * Math.pow(s, 1.1);
    const te = -0.38 + 0.2 * s;
    return { le: new Vector3(finX, y, le), te: new Vector3(finX, y, Math.min(te, le - 0.02)), thick: 0.13 * (1 - s) + 0.015, normal: new Vector3(1, 0, 0) };
  }, () => UV_BLACK));

  // The tail flukes, out past the last vertebra: about 1.8 m from tip to tip.
  const flukeY = at(top, zBack) - 0.06;
  const flukeX = at(mid, zBack);
  for (const side of [-1, 1]) {
    parts.push(fin(scene, `fluke-${side}`, 10, (s) => {
      const x = flukeX + side * 0.9 * s;
      const le = zBack + 0.1 - 0.5 * Math.pow(s, 1.4);
      const te = zBack - 0.28 - 0.22 * Math.pow(s, 0.8) + 0.04 * s * s;
      return { le: new Vector3(x, flukeY + 0.04 * s, le), te: new Vector3(x, flukeY + 0.04 * s, Math.min(te, le - 0.03)), thick: 0.08 * (1 - s) + 0.012, normal: new Vector3(0, 1, 0) };
    }, (p, n) => (n.y < -0.2 && p.s < 0.85 ? UV_WHITE : UV_BLACK)));
  }

  // The flippers: big, rounded paddles on a male, over the hand bones, angled back and down.
  for (const side of [-1, 1]) {
    const root = new Vector3(at(mid, 1.6) + side * 0.4, 0.42, 1.62);
    const tip = new Vector3(at(mid, 1.6) + side * 0.95, -0.12, 0.92);
    const span = tip.subtract(root);
    const chordDir = new Vector3(0, 0.3, 1).normalize();
    const normal = Vector3.Cross(span, chordDir).normalize();
    parts.push(fin(scene, `flipper-${side}`, 10, (s) => {
      const c = root.add(span.scale(s));
      const chord = 0.6 * Math.sqrt(Math.max(0.02, 1 - Math.pow((s - 0.42) / 0.62, 2)));
      return { le: c.add(chordDir.scale(chord * 0.45)), te: c.subtract(chordDir.scale(chord * 0.55)), thick: 0.1 * (1 - 0.65 * s) + 0.01, normal };
    }, () => UV_BLACK));
  }

  const body = Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  body.name = 'orca-skin';
  const mat = new StandardMaterial('orca-skin', scene);
  mat.diffuseTexture = patternTexture(scene, rings, tailEnd, snout);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.32, 0.32, 0.34);
  mat.specularPower = 42;
  mat.emissiveColor = new Color3(0.04, 0.04, 0.045);
  mat.backFaceCulling = true;
  // Seen through, it shows only its nearest surface over the bones.
  mat.needDepthPrePass = true;
  body.material = mat;
  body.isPickable = false;
  return body;
}

/** Paints the pattern into the unrolled body, two by two samples per texel for smooth edges. */
function patternTexture(scene, rings, tailEnd, snout) {
  const tex = new DynamicTexture('orca-pattern', { width: TEX_W, height: TEX_H }, scene, true);
  const ctx = tex.getContext();
  const img = ctx.createImageData(TEX_W, TEX_H);
  const rows = TEX_H - STRIP;
  const ringAt = (u) => {
    const f = Math.max(0, Math.min(rings.length - 1, u * (rings.length - 1)));
    const i = Math.min(rings.length - 2, Math.floor(f));
    const t = f - i;
    const a = rings[i];
    const b = rings[i + 1];
    return { z: a.z + (b.z - a.z) * t, cy: a.cy + (b.cy - a.cy) * t, hh: a.hh + (b.hh - a.hh) * t };
  };
  for (let px = 0; px < TEX_W; px++) {
    for (let py = 0; py < TEX_H; py++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      if (py >= rows) {
        const c = px < TEX_W / 2 ? BLACK : WHITE;
        r = c.r;
        g = c.g;
        bl = c.b;
      } else {
        for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const ring = ringAt((px + dx) / TEX_W);
          const theta = ((py + dy) / rows) * Math.PI * 2;
          const side = Math.min(theta, Math.PI * 2 - theta);
          const y = ring.cy + ring.hh * Math.sign(Math.cos(theta)) * Math.pow(Math.abs(Math.cos(theta)), 0.9);
          const c = bodyColor(ring.z, side, y, tailEnd, snout);
          r += c.r / 4;
          g += c.g / 4;
          bl += c.b / 4;
        }
      }
      // Row py of the image is sampled at v = py / TEX_H here.
      const o = (py * TEX_W + px) * 4;
      img.data[o] = Math.round(Math.pow(r, 1 / 2.2) * 255);
      img.data[o + 1] = Math.round(Math.pow(g, 1 / 2.2) * 255);
      img.data[o + 2] = Math.round(Math.pow(bl, 1 / 2.2) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(false);
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

/**
 * The orca's pattern at a point of the body: `z` along it, `side` 0 on top to PI under the belly,
 * `y` the height. Edges are crisp, as on the animal.
 */
function bodyColor(z, side, y, tailEnd, snout) {
  const u = (z - tailEnd) / (snout - tailEnd);
  // The white underside: how far up the sides it reaches along the body.
  const white = interp(
    [0, 0.08, 0.16, 0.22, 0.27, 0.33, 0.4, 0.48, 0.6, 0.72, 0.82, 0.9, 1],
    [Math.PI, 2.85, 2.55, 1.75, 1.45, 1.6, 2.25, 2.5, 2.62, 2.5, 2.3, 2.2, 2.15],
    u,
  );
  if (side > white) return WHITE;
  // The eye patch: an oval above and behind the eye, on each side.
  const ez = (z - (snout - 0.98)) / 0.32;
  const ey = (y - 0.9 + 0.05 * ez) / 0.095;
  if (side > 0.7 && side < 1.9 && ez * ez + ey * ey < 1) return WHITE;
  // The grey saddle behind the dorsal fin.
  const sz = (z + 0.95) / 0.5;
  const ss = side / 0.48;
  if (sz * sz + ss * ss < 1) return SADDLE;
  return BLACK;
}

/**
 * A fin lofted through `count` + 1 stations from root (s = 0) to tip (s = 1). `station(s)` gives
 * the leading and trailing edge points, the thickness and the direction thickness goes in.
 */
function fin(scene, name, count, station, color) {
  const AROUND_FIN = 16;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= count; i++) {
    const s = i / count;
    const { le, te, thick, normal } = station(s);
    const midPt = le.add(te).scale(0.5);
    const half = le.subtract(te).scale(0.5);
    for (let k = 0; k < AROUND_FIN; k++) {
      const a = (k / AROUND_FIN) * Math.PI * 2;
      // A rounded leading edge, a thinner trailing one.
      const along = Math.cos(a);
      const across = Math.sin(a) * (thick / 2) * (along > 0 ? 1 : 0.55 + 0.45 * (1 + along));
      const p = midPt.add(half.scale(along)).add(normal.scale(across));
      positions.push(-p.x, p.y, p.z);
      uvs.push(...color({ s }, normal.scale(Math.sign(Math.sin(a)) || 1)));
    }
  }
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < AROUND_FIN; k++) {
      const a = i * AROUND_FIN + k;
      const b = i * AROUND_FIN + ((k + 1) % AROUND_FIN);
      indices.push(a, a + AROUND_FIN, b, b, a + AROUND_FIN, b + AROUND_FIN);
    }
  }
  // Cap the tip.
  const last = count * AROUND_FIN;
  for (let k = 1; k < AROUND_FIN - 1; k++) indices.push(last, last + k + 1, last + k);
  return meshFrom(scene, name, positions, uvs, indices);
}

function meshFrom(scene, name, positions, uvs, indices) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.uvs = uvs;
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

/** The outer hull of a profile (`sign` +1 for the top, -1 for the bottom). */
function hull(xs, ys, sign) {
  const pts = xs.map((x, i) => [x, sign * ys[i]]);
  const upper = [];
  for (const p of pts) {
    while (upper.length >= 2) {
      const [a, b] = [upper[upper.length - 2], upper[upper.length - 1]];
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }
  return xs.map((x) => sign * interp(upper.map((p) => p[0]), upper.map((p) => p[1]), x));
}

function smooth(arr, radius) {
  return arr.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(arr.length - 1, i + radius); j++) {
      sum += arr[j];
      n++;
    }
    return sum / n;
  });
}

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
}

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
