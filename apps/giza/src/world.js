// The Giza plateau around the Great Pyramid: the sky, the sun at Giza's latitude, the desert floor, and the other
// pyramids at their published sizes and places (survey.js, NEIGHBOURS).
import {
  Color3,
  Effect,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  ShaderMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import { Geo, fbm, hash } from './geom.js';
import { NEIGHBOURS } from './survey.js';

const BASE = import.meta.env.BASE_URL;

/** A stone, sand or wood material from the photographed surfaces (assets-src/giza/photo_textures.py). */
export function stone(scene, name, { albedo, normal = null, roughMap = null, tile = 1, rough = 1, bump = 1, tint = null }) {
  const m = new PBRMaterial(name, scene);
  const tex = (file, gamma) => {
    const t = new Texture(`${BASE}tex/${file}`, scene, { noMipmap: false, gammaSpace: gamma });
    t.uScale = t.vScale = 1 / tile;
    t.anisotropicFilteringLevel = 8;
    return t;
  };
  m.albedoTexture = tex(albedo, true);
  if (normal) {
    m.bumpTexture = tex(normal, false);
    m.bumpTexture.level = bump;
  }
  if (roughMap) {
    // Roughness from the scan, in the green channel of a grey map.
    m.metallicTexture = tex(roughMap, false);
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useMetallnessFromMetallicTextureBlue = false;
    m.useRoughnessFromMetallicTextureAlpha = false;
  }
  if (tint) m.albedoColor = Color3.FromHexString(tint);
  m.metallic = 0;
  m.roughness = rough;
  m.environmentIntensity = 0.6;
  m.maxSimultaneousLights = 2;
  return m;
}

// ---------------------------------------------------------------- the sky

Effect.ShadersStore.gizaSkyVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;
}`;

// A clear desert sky: deep blue overhead, paling to a dusty haze at the horizon, a bright disc and glow round the
// sun, and warmer light near the horizon when the sun is low.
Effect.ShadersStore.gizaSkyFragmentShader = `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform float warmth;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(horizon, zenith, t);
  float c = max(dot(d, -sunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * (pow(c, 8.0) * 0.25 + pow(c, 64.0) * 0.4) * (0.6 + warmth);
  col += vec3(1.0, 0.98, 0.9) * smoothstep(0.9996, 0.99985, c) * 4.0;
  col = mix(col, horizon * vec3(1.05, 0.95, 0.85), warmth * (1.0 - t) * 0.5);
  col = mix(col, ground, smoothstep(0.0, -0.06, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(scene) {
  const sky = MeshBuilder.CreateSphere('sky', { diameter: 9000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const mat = new ShaderMaterial('sky', scene, { vertex: 'gizaSky', fragment: 'gizaSky' }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'sunDir', 'zenith', 'horizon', 'ground', 'warmth'],
  });
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  sky.material = mat;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.applyFog = false;
  return {
    mesh: sky,
    set(sunDir, { zenith, horizon, ground, warmth }) {
      mat.setVector3('sunDir', sunDir);
      mat.setColor3('zenith', zenith);
      mat.setColor3('horizon', horizon);
      mat.setColor3('ground', ground);
      mat.setFloat('warmth', warmth);
    },
  };
}

/**
 * The sun over Giza (29.98° N) at a time of day, on 21 March: the direction light travels. Solar time; the sun
 * rises due east at the equinox.
 */
export function sunAt(hour, lat = 29.979, decl = 0) {
  const H = ((hour - 12) * 15 * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180, d = (decl * Math.PI) / 180;
  const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
  // Azimuth from north, clockwise (east = 90°).
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(phi) * Math.sin(d) - Math.sin(phi) * Math.cos(d) * Math.cos(H));
  // Toward the sun: x east, z north.
  const to = new Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
  return { dir: to.scale(-1), alt };
}

// ---------------------------------------------------------------- the ground

/**
 * The desert floor: a grid of sand, tinted in broad patches so the texture's repeat doesn't show from the top of the
 * pyramid, fading into haze at its edge.
 */
/** The plateau's height: level round Khufu, rising under each neighbour to its base (survey.js, baseY). */
export function groundY(x, z) {
  let y = 0;
  for (const n of NEIGHBOURS) {
    const d = Math.max(Math.abs(x - n.centre[0]), Math.abs(z - n.centre[1])) - n.base / 2 - 25;
    const k = Math.max(0, Math.min(1, 1 - d / 220));
    y = Math.max(y, n.baseY * k * k * (3 - 2 * k));
  }
  return y;
}

export function createGround(scene, material) {
  const g = new Geo();
  const R = 2400, N = 96, step = (2 * R) / N;
  const tint = (x, z) => {
    const v = 0.88 + 0.2 * (fbm(x, z, 140, 3) - 0.5) + 0.08 * (fbm(x, z, 31, 4) - 0.5);
    return [v * 1.0, v * 0.97, v * 0.93];
  };
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = -R + i * step, z0 = -R + j * step, x1 = x0 + step, z1 = z0 + step;
      const q = [[x0, groundY(x0, z0), z0], [x1, groundY(x1, z0), z0], [x1, groundY(x1, z1), z1], [x0, groundY(x0, z1), z1]];
      // Counter-clockwise seen from above.
      g.quad(q[0], q[3], q[2], q[1], [q[0], q[3], q[2], q[1]].map((p) => [p[0] / 6, p[2] / 6]),
        [q[0], q[3], q[2], q[1]].map((p) => tint(p[0], p[2])));
    }
  }
  const m = g.mesh('plateau', scene);
  m.material = material;
  m.receiveShadows = true;
  m.isPickable = true;
  m.freezeWorldMatrix();
  return m;
}

/**
 * The rock round the foot: where the pavement was, its bed cut in the bedrock reaches 13 to 16 m out (P §27), grey
 * and littered, fading into the sand. A band of the core stone, darker at the foot.
 */
export function createApron(scene, material, half, y) {
  const g = new Geo();
  const reach = 22, steps = 6, under = 3;
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    for (let k = 0; k < steps; k++) {
      const r0 = half - under + ((reach + under) * k) / steps, r1 = half - under + ((reach + under) * (k + 1)) / steps;
      const q = [[ax * r0, 0.08, az * r0], [bx * r0, 0.08, bz * r0], [bx * r1, 0.08, bz * r1], [ax * r1, 0.08, az * r1]];
      // Grey rock and grit at the foot, fading into the plain sand.
      const shade = (p) => {
        const d = Math.max(0, Math.max(Math.abs(p[0]), Math.abs(p[2])) - half);
        const t = Math.min(1, d / reach) ** 0.7;
        const v = 0.64 + 0.26 * t + 0.1 * (fbm(p[0], p[2], 5, 81) - 0.5) * (1 - t);
        return [v * (0.97 + 0.03 * t), v * (0.95 + 0.05 * t), v * (0.9 + 0.1 * t)];
      };
      const f = (p) => [p[0] / 6, p[2] / 6];
      const pts = Math.sign(ax * bz - az * bx) > 0 ? q : [q[1], q[0], q[3], q[2]];
      g.face(pts, [0, 1, 0], f, shade);
    }
  }
  const m = g.mesh('apron', scene);
  m.position.y = y;
  m.material = material;
  m.isPickable = true;
  m.receiveShadows = true;
  m.freezeWorldMatrix();
  return m;
}

// ---------------------------------------------------------------- the other pyramids

/**
 * A pyramid seen from afar: its stepped courses in runs, with the casing that still stands (Khafre's cap,
 * Menkaure's granite foot) smooth. `p`: centre [x, z], base, height, course height, `turn` (radians clockwise seen
 * from above, relative to Khufu's sides), cased: [[y0, y1, material, faces?]] with faces as 'nesw' letters.
 */
export function farPyramid(scene, p, coreMat, casedMats) {
  const g = new Geo();
  const caps = new Map();
  const half = p.base / 2;
  const tan = p.height / half;
  const halfAt = (y) => (p.height - y) / tan;
  // Built round its own centre, then placed and turned.
  const cx = 0, cz = 0;
  const top = p.top ?? p.height;
  const faces = [[0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0], [-1, 0, 0, 1]];
  const W = (nx, nz, tx, tz, u, s, y) => [cx + nx * s + tx * u, y, cz + nz * s + tz * u];
  for (let fi = 0; fi < 4; fi++) {
    const [nx, nz, tx, tz] = faces[fi];
    for (let y0 = 0, k = 0; y0 < top - 0.01; k++) {
      const y1 = Math.min(top, y0 + p.course);
      const cased = (p.cased ?? []).find((c) => y0 >= c[0] - 0.01 && y1 <= c[1] + 0.01 && (!c[3] || c[3].includes('nesw'[fi])));
      const h0 = halfAt(y0), h1 = halfAt(y1);
      if (cased) {
        // Smooth casing: one sloped strip.
        const geo = caps.get(cased[2]) ?? caps.set(cased[2], new Geo()).get(cased[2]);
        const q = [W(nx, nz, tx, tz, -h0, h0, y0), W(nx, nz, tx, tz, h0, h0, y0), W(nx, nz, tx, tz, h1, h1, y1), W(nx, nz, tx, tz, -h1, h1, y1)];
        geo.quad(q[0], q[1], q[2], q[3], q.map((v) => [(v[0] * tx + v[2] * tz) / 2, v[1] / 2]), 0.95 + 0.05 * hash(fi, k, 2));
      } else {
        // A step: riser at the line of the casing less a recess, tread back to the next riser.
        const s = h1 - p.recess;
        const back = halfAt(y1 + p.course) - p.recess - 0.5;
        const runs = Math.max(1, Math.round((2 * s) / 5));
        for (let r = 0; r < runs; r++) {
          const u0 = -s + (2 * s * r) / runs, u1 = -s + (2 * s * (r + 1)) / runs;
          const rec = 0.25 * hash(fi, k, r, p.seed) ** 2 + (hash(fi, k, r, p.seed + 1) > 0.93 ? 0.7 : 0);
          const ss = s - rec;
          const t = 0.85 + 0.2 * hash(fi, k, r, p.seed + 2);
          const fq = [W(nx, nz, tx, tz, u0, ss, y0), W(nx, nz, tx, tz, u1, ss, y0), W(nx, nz, tx, tz, u1, ss, y1), W(nx, nz, tx, tz, u0, ss, y1)];
          g.quad(fq[0], fq[1], fq[2], fq[3], fq.map((v) => [(v[0] * tx + v[2] * tz) / 2, v[1] / 2]), [t * 0.65, t * 0.65, t, t]);
          const cl = (u, d) => Math.max(-d, Math.min(d, u));
          const b = Math.max(0, back);
          const tq = [W(nx, nz, tx, tz, cl(u0, ss), ss, y1), W(nx, nz, tx, tz, cl(u1, ss), ss, y1), W(nx, nz, tx, tz, cl(u1, b), b, y1), W(nx, nz, tx, tz, cl(u0, b), b, y1)];
          g.quad(tq[0], tq[1], tq[2], tq[3], tq.map((v) => [(v[0] * tx + v[2] * tz) / 2, (v[0] * nx + v[2] * nz) / 2]), [t, t, t * 0.75, t * 0.75]);
        }
      }
      y0 = y1;
    }
  }
  const meshes = [];
  const core = g.mesh(`${p.name}-core`, scene);
  core.material = coreMat;
  meshes.push(core);
  for (const [key, geo] of caps) {
    const m = geo.mesh(`${p.name}-casing-${key}`, scene);
    m.material = casedMats[key];
    meshes.push(m);
  }
  for (const m of meshes) {
    m.position.set(p.centre[0], p.baseY ?? 0, p.centre[1]);
    m.rotation.y = p.turn ?? 0;
    m.isPickable = false;
    m.receiveShadows = true;
    m.freezeWorldMatrix();
  }
  return meshes;
}

export { NEIGHBOURS };
