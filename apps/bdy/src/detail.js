// The surface of each tissue, close up. The atlas's parts are smooth, single-coloured shells; real tissue is not:
// muscle is bundles of fibres (fascicles, about 1 mm across, gathered into bundles a few mm across) running the
// muscle's length and turning into pale, silvery tendon where the belly narrows to its attachment; bone is matt
// and finely pitted, mottled where it is thinner; skin has pores and fine lines; organs are faintly mottled under
// their wet film. None of it is in the model, so it is drawn in the shader, in the body's own space (it stays on a
// part that is taken out and turned), from one small tiling noise texture: a height with its slopes (a relief the
// lights catch) and a slow blotch (colour).
//
// A muscle's fibres are taken to run along the part's long axis (its vertices' principal axis), and its tendons to
// be the stretches at either end where its cross-section is under TENDON_AREA of its largest. Both are estimates
// from the shape alone: fans (pectoralis, trapezius) really converge on their tendon, and flat tendons
// (aponeuroses) do not narrow, so they stay red.
import { Constants, MaterialPluginBase, RawTexture, Texture, Vector3, VertexBuffer } from '@babylonjs/core';

const P_ATTR = 'bodyP';
const F_ATTR = 'bodyFibre';
/** A stretch at a muscle's end whose cross-section is under this share of the belly's largest is tendon. */
const TENDON_AREA = 0.15;
const BINS = 40;
/** ...in a muscle at least this many times longer than wide (the spreads of its vertices along and across). */
const LONG = 3;

/**
 * Each kind's numbers: tile (m, one repeat of the noise across the surface), amp (m, the relief's height),
 * tone (how far the relief lightens and darkens the colour), blotch (the slow colour change), stretch (fibres:
 * how many times longer than wide the grain is).
 */
export const KINDS = {
  // 64 grains across a tile: 1.5 mm fascicles, in 6 mm bundles.
  fibre: { tile: 0.096, amp: 0.0005, tone: 0.5, blotch: 0.22, stretch: 14 },
  // Ligament and tendon: finer, tighter, straighter.
  cord:  { tile: 0.064, amp: 0.00025, tone: 0.22, blotch: 0.12, stretch: 24 },
  bone:  { tile: 0.04, amp: 0.00012, tone: 0.16, blotch: 0.2, stretch: 1 },
  skin:  { tile: 0.02, amp: 0.00005, tone: 0.1, blotch: 0.1, stretch: 1 },
  soft:  { tile: 0.05, amp: 0.00008, tone: 0.1, blotch: 0.18, stretch: 1 },
};

const SIZE = 256;
const GRAD = 64;
let noiseTex = null;

/** Smooth tiling value noise with `cells` cells a side, 0..1, as a SIZE x SIZE Float32Array. */
function valueNoise(cells, rand) {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const out = new Float32Array(SIZE * SIZE);
  const s = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  for (let y = 0; y < SIZE; y++) {
    const fy = (y / SIZE) * cells, y0 = Math.floor(fy), ty = s(fy - y0), y1 = (y0 + 1) % cells;
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * cells, x0 = Math.floor(fx), tx = s(fx - x0), x1 = (x0 + 1) % cells;
      const a = grid[y0 * cells + x0], b = grid[y0 * cells + x1], c = grid[y1 * cells + x0], d = grid[y1 * cells + x1];
      out[y * SIZE + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** R: height. G, B: its slopes along u and v (per tile, / GRAD, + 0.5). A: a slow blotch. */
function noiseTexture(scene) {
  if (noiseTex) return noiseTex;
  let seed = 20261112;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const fine = valueNoise(64, rand), mid = valueNoise(16, rand), big = valueNoise(4, rand), big2 = valueNoise(8, rand);
  const h = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < h.length; i++) h[i] = 0.55 * fine[i] + 0.45 * mid[i];
  const data = new Uint8Array(SIZE * SIZE * 4);
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const du = ((at(x + 1, y) - at(x - 1, y)) / 2) * SIZE, dv = ((at(x, y + 1) - at(x, y - 1)) / 2) * SIZE;
      data[i * 4] = byte(h[i]);
      data[i * 4 + 1] = byte(du / GRAD + 0.5);
      data[i * 4 + 2] = byte(dv / GRAD + 0.5);
      data[i * 4 + 3] = byte(0.6 * big[i] + 0.4 * big2[i]);
    }
  }
  noiseTex = RawTexture.CreateRGBATexture(data, SIZE, SIZE, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  noiseTex.wrapU = noiseTex.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  noiseTex.anisotropicFilteringLevel = 4;
  return noiseTex;
}

const FRAGMENT_DEFS = `
#ifdef BODY_DETAIL
varying vec3 vBodyP;
uniform sampler2D bodyNoise;
#ifdef BODY_FIBRE
varying vec4 vBodyFibre;
#endif
// height, slope along u, slope along v, blotch
vec4 bodyTap(vec2 uv) {
  vec4 t = texture2D(bodyNoise, uv);
  return vec4(t.r, (t.gb - 0.5) * ${GRAD.toFixed(1)}, t.a);
}
#endif`;

const FRAGMENT_MAIN = `
#ifdef BODY_DETAIL
{
  vec3 bp = vBodyP;
  vec3 dBx = dFdx(bp), dBy = dFdy(bp);
  vec3 nB = normalize(cross(dBx, dBy) + vec3(1e-12));
  float inv = 1.0 / bodyDetailK.x;
  float h, blotch;
  vec3 g;
#ifdef BODY_FIBRE
  vec3 f = normalize(vBodyFibre.xyz + vec3(0.0, 1e-6, 0.0));
  vec3 e1 = normalize(cross(f, abs(f.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(f, e1);
  float along = inv / bodyDetailT.w;
  float a = dot(bp, f) * along;
  float w1 = dot(nB, e2), w2 = dot(nB, e1);
  w1 *= w1; w2 *= w2;
  float ws = w1 + w2 + 1e-5;
  w1 /= ws; w2 /= ws;
  vec4 t1 = bodyTap(vec2(dot(bp, e1) * inv, a));
  vec4 t2 = bodyTap(vec2(dot(bp, e2) * inv + 0.37, a + 0.11));
  h = t1.x * w1 + t2.x * w2;
  blotch = t1.w * w1 + t2.w * w2;
  g = w1 * (t1.y * inv * e1 + t1.z * along * f) + w2 * (t2.y * inv * e2 + t2.z * along * f);
#else
  vec3 w = nB * nB;
  vec4 tx = bodyTap(bp.zy * inv), ty = bodyTap(bp.xz * inv + 0.37), tz = bodyTap(bp.xy * inv + 0.71);
  h = tx.x * w.x + ty.x * w.y + tz.x * w.z;
  blotch = tx.w * w.x + ty.w * w.y + tz.w * w.z;
  g = inv * (w.x * vec3(0.0, tx.z, tx.y) + w.y * vec3(ty.y, 0.0, ty.z) + w.z * vec3(tz.y, tz.z, 0.0));
#endif
  float amp = bodyDetailK.y, tone = bodyDetailK.z;
  vec3 tint = vec3(1.0);
#ifdef BODY_FIBRE
  // Tendon: where the belly has narrowed. The edge is ragged, as fibres end at different lengths.
  float tendon = smoothstep(0.35, 0.65, vBodyFibre.w + (blotch - 0.5) * 0.5);
  tint = mix(tint, bodyDetailT.rgb, tendon);
  amp *= 1.0 - 0.6 * tendon;
  tone *= 1.0 - 0.6 * tendon;
#endif
  surfaceAlbedo *= tint * (1.0 + tone * (h - 0.5) * 2.0) * (1.0 + bodyDetailK.w * (blotch - 0.5) * 2.0);
#ifdef NORMAL
  // The relief's slope along the surface, from its slope in the body's space (Mikkelsen's derivative bump).
  vec3 dWx = dFdx(vPositionW), dWy = dFdy(vPositionW);
  float dhx = dot(g, dBx) * amp, dhy = dot(g, dBy) * amp;
  vec3 r1 = cross(dWy, normalW), r2 = cross(normalW, dWx);
  float det = dot(dWx, r1);
  normalW = normalize(abs(det) * normalW - sign(det) * (dhx * r1 + dhy * r2));
#endif
}
#endif`;

class DetailPlugin extends MaterialPluginBase {
  constructor(material, kind, tendonTint) {
    super(material, 'BodyDetail', 220, { BODY_DETAIL: false, BODY_DETAIL_BATCH: false, BODY_FIBRE: false }, true, true);
    this.kind = kind;
    this.k = KINDS[kind];
    this.fibre = kind === 'fibre' || kind === 'cord';
    this.tendonTint = tendonTint ?? [1, 1, 1];
  }
  getClassName() {
    return 'BodyDetail';
  }
  prepareDefines(defines, scene, mesh) {
    defines.BODY_DETAIL = true;
    defines.BODY_DETAIL_BATCH = !!mesh?.metadata?.batch;
    defines.BODY_FIBRE = this.fibre;
  }
  getAttributes(attributes, scene, mesh) {
    if (!mesh?.metadata?.batch) attributes.push(P_ATTR);
    if (this.fibre) attributes.push(F_ATTR);
  }
  getSamplers(samplers) {
    samplers.push('bodyNoise');
  }
  getUniforms() {
    return {
      ubo: [{ name: 'bodyDetailK', size: 4, type: 'vec4' }, { name: 'bodyDetailT', size: 4, type: 'vec4' }],
      fragment: '#ifdef BODY_DETAIL\nuniform vec4 bodyDetailK;\nuniform vec4 bodyDetailT;\n#endif',
    };
  }
  bindForSubMesh(uniformBuffer, scene) {
    const k = this.k, t = this.tendonTint;
    uniformBuffer.updateFloat4('bodyDetailK', k.tile, k.amp, k.tone, k.blotch);
    uniformBuffer.updateFloat4('bodyDetailT', t[0], t[1], t[2], k.stretch);
    uniformBuffer.setTexture('bodyNoise', noiseTexture(scene));
  }
  getCustomCode(type) {
    if (type === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `
#ifdef BODY_DETAIL
varying vec3 vBodyP;
#ifndef BODY_DETAIL_BATCH
attribute vec3 ${P_ATTR};
#endif
#ifdef BODY_FIBRE
attribute vec4 ${F_ATTR};
varying vec4 vBodyFibre;
#endif
#endif`,
        CUSTOM_VERTEX_MAIN_BEGIN: `
#ifdef BODY_DETAIL
#ifdef BODY_DETAIL_BATCH
vBodyP = position;
#else
vBodyP = ${P_ATTR};
#endif
#ifdef BODY_FIBRE
vBodyFibre = ${F_ATTR};
#endif
#endif`,
      };
    }
    return { CUSTOM_FRAGMENT_DEFINITIONS: FRAGMENT_DEFS, CUSTOM_FRAGMENT_BEFORE_LIGHTS: FRAGMENT_MAIN };
  }
}

/** Gives `material` the surface of `kind`. tendonTint: what a muscle's colour is multiplied by where it is tendon. */
export function addDetail(material, kind, tendonTint) {
  noiseTexture(material.getScene());
  return new DetailPlugin(material, kind, tendonTint);
}

const detailOf = (material) => material?.pluginManager?.getPlugin('BodyDetail') ?? null;

/** The largest eigenvector of the symmetric 3x3 [xx, xy, xz, yy, yz, zz]. */
function mainAxis(c) {
  let v = [0.57, 0.6, 0.56];
  for (let i = 0; i < 60; i++) {
    const x = c[0] * v[0] + c[1] * v[1] + c[2] * v[2], y = c[1] * v[0] + c[3] * v[1] + c[4] * v[2], z = c[2] * v[0] + c[4] * v[1] + c[5] * v[2];
    const l = Math.hypot(x, y, z) || 1;
    v = [x / l, y / l, z / l];
  }
  return v;
}

/**
 * A part's fibres from its shape: `pos` (the body's space, xyz per vertex). Returns xyzw per vertex: the fibres'
 * direction (the same all over the part) and how far each vertex is tendon (0..1; always 0 unless `tendons`).
 */
export function fibresOf(pos, tendons) {
  const n = pos.length / 3;
  const out = new Float32Array(n * 4);
  if (!n) return out;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const c = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] - cx, y = pos[i * 3 + 1] - cy, z = pos[i * 3 + 2] - cz;
    c[0] += x * x; c[1] += x * y; c[2] += x * z; c[3] += y * y; c[4] += y * z; c[5] += z * z;
  }
  const f = mainAxis(c);
  const up = Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let e1 = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  const l1 = Math.hypot(...e1);
  e1 = e1.map((v) => v / l1);
  const e2 = [f[1] * e1[2] - f[2] * e1[1], f[2] * e1[0] - f[0] * e1[2], f[0] * e1[1] - f[1] * e1[0]];
  const t = new Float32Array(n), u = new Float32Array(n), v = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] - cx, y = pos[i * 3 + 1] - cy, z = pos[i * 3 + 2] - cz;
    t[i] = x * f[0] + y * f[1] + z * f[2];
    u[i] = x * e1[0] + y * e1[1] + z * e1[2];
    v[i] = x * e2[0] + y * e2[1] + z * e2[2];
    lo = Math.min(lo, t[i]); hi = Math.max(hi, t[i]);
  }
  let t0 = -Infinity, t1 = Infinity;
  const step = (hi - lo) / BINS;
  // Only a muscle that is long for its width (a spindle or a strap) is read this way: a sheet or a fan narrows
  // towards a corner without that corner being tendon.
  let vt = 0, uu = 0, uv = 0, vv = 0;
  for (let i = 0; i < n; i++) { vt += t[i] * t[i]; uu += u[i] * u[i]; uv += u[i] * v[i]; vv += v[i] * v[i]; }
  const wide = (uu + vv) / 2 + Math.hypot((uu - vv) / 2, uv);
  if (tendons && n >= BINS * 4 && step > 0 && vt > wide * LONG * LONG) {
    // Each slice's cross-section, as the area of the ellipse its vertices' spread describes.
    const s = Array.from({ length: BINS }, () => [0, 0, 0, 0, 0, 0]);   // count, su, sv, suu, suv, svv
    for (let i = 0; i < n; i++) {
      const b = s[Math.min(BINS - 1, Math.floor((t[i] - lo) / step))];
      b[0]++; b[1] += u[i]; b[2] += v[i]; b[3] += u[i] * u[i]; b[4] += u[i] * v[i]; b[5] += v[i] * v[i];
    }
    const raw = s.map((b) => {
      if (b[0] < 3) return 0;
      const mu = b[1] / b[0], mv = b[2] / b[0];
      const uu = b[3] / b[0] - mu * mu, uv = b[4] / b[0] - mu * mv, vv = b[5] / b[0] - mv * mv;
      return Math.sqrt(Math.max(0, uu * vv - uv * uv));
    });
    const area = raw.map((a, i) => (raw[Math.max(0, i - 1)] + a + raw[Math.min(BINS - 1, i + 1)]) / 3);
    const cut = Math.max(...area) * TENDON_AREA;
    let a = 0, b = BINS - 1;
    while (a < BINS && area[a] < cut) a++;
    while (b >= 0 && area[b] < cut) b--;
    if (a <= b) {
      t0 = lo + a * step;
      t1 = lo + (b + 1) * step;
    }
  }
  const soft = Math.max(step, 1e-6);
  const ramp = (x) => Math.max(0, Math.min(1, x));
  for (let i = 0; i < n; i++) {
    out[i * 4] = f[0]; out[i * 4 + 1] = f[1]; out[i * 4 + 2] = f[2];
    out[i * 4 + 3] = Math.max(ramp((t0 - t[i]) / soft + 0.5), ramp((t[i] - t1) / soft + 0.5));
  }
  return out;
}

const tmp = new Vector3();
/** A part's vertices in the body's space: `rel` is the part's matrix there, at home. */
export function bodyPositions(mesh, rel) {
  const P = mesh.getVerticesData(VertexBuffer.PositionKind);
  const out = new Float32Array(P.length);
  for (let k = 0; k < P.length; k += 3) {
    Vector3.TransformCoordinatesFromFloatsToRef(P[k], P[k + 1], P[k + 2], rel, tmp);
    out[k] = tmp.x; out[k + 1] = tmp.y; out[k + 2] = tmp.z;
  }
  return out;
}

/**
 * What a part needs to draw as itself with its surface in place: where each vertex is in the body (so the grain
 * doesn't slide when the part is moved) and, for muscle and cords, its fibres. `data` as from partDetail().
 */
export function giveDetail(mesh, data) {
  if (!data || mesh.isVerticesDataPresent(P_ATTR)) return;
  const engine = mesh.getEngine();
  mesh.setVerticesBuffer(new VertexBuffer(engine, data.pos, P_ATTR, false, false, 3));
  if (data.fibres) mesh.setVerticesBuffer(new VertexBuffer(engine, data.fibres, F_ATTR, false, false, 4));
}

/** { pos, fibres } for a part whose material has a surface, or null. */
export function partDetail(mesh, rel) {
  const d = detailOf(mesh.material);
  if (!d) return null;
  const pos = bodyPositions(mesh, rel);
  return { pos, fibres: d.fibre ? fibresOf(pos, d.kind === 'fibre') : null };
}

export { F_ATTR };
