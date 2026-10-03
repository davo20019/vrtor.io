// Ripstop nylon for the canopy (canopy.js): a sport canopy's panels, seams and tapes, painted once
// into two textures, and a shader that lights the cloth as cloth. In front of the sun it glows
// through, tinted by its dye, with the seams, rib tapes and reinforcements showing darker where
// the fabric is doubled: the look of a canopy overhead. On the sunny side it has nylon's soft
// sheen; seams and wrinkles catch the light as small ridges.
//
// Texture layout (u across the span, cell i from u = i/9; v down the chord, nose first):
//   v 0.00-0.43  top skin       v 0.45-0.88  bottom skin
//   v 0.90-1.00  plain fabric: white for u < 0.5 (ribs), navy for u > 0.5 (slider, pilot chute)
import { Color3, DynamicTexture, Effect, ShaderMaterial, Texture, Vector3 } from '@babylonjs/core';

export const CELLS = 9;
export const TOP_V = [0, 0.43];
export const BOTTOM_V = [0.45, 0.88];
export const WHITE_UV = [0.25, 0.95];
export const NAVY_UV = [0.75, 0.95];

const W = 2048;
const H = 1024;
const NAVY = '#14275a';
const WHITE = '#e8e6df';
const RED = '#a81c22';
/** Each cell's colour, left tip to right tip; the nose panel is navy across the span. */
const CELL_COLORS = [RED, WHITE, NAVY, WHITE, NAVY, WHITE, NAVY, WHITE, RED];
const NOSE_PANEL = 0.16;
/** Chordwise seams of the top and bottom skins (chord fraction). */
const PANEL_SEAMS = [NOSE_PANEL, 0.42, 0.7];
/** Line attachment rows (chord fraction), as canopy.js hangs them. */
export const ROW_X = [0.04, 0.28, 0.54, 0.8];

Effect.ShadersStore.fabricVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUV;
void main() {
  vec4 p = world * vec4(position, 1.0);
  vPos = p.xyz;
  vNormal = normalize(mat3(world) * normal);
  vUV = uv;
  gl_Position = viewProjection * p;
}`;

Effect.ShadersStore.fabricFragmentShader = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUV;
uniform vec3 eye;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform sampler2D albedoMap;
uniform sampler2D detailMap;
// Which way each skin's normals point: +1 outward, -1 inward (canopy.js measures it).
uniform float topSign;
uniform float bottomSign;
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  vec3 albedo = toLinear(texture2D(albedoMap, vUV).rgb);
  vec4 detail = texture2D(detailMap, vUV);
  float density = detail.r;   // doubled fabric, tapes, thread: blocks light
  float height = detail.g;    // seams' ridges and wrinkles
  vec3 toEye = normalize(eye - vPos);
  vec3 n = normalize(vNormal);
  // Inside a cell (seen through the open mouths): the skins' inner sides and the ribs get little
  // light but the glow through the cloth.
  float top = step(vUV.y, ${(TOP_V[1] + 0.01).toFixed(2)});
  float lower = step(${(BOTTOM_V[0] - 0.01).toFixed(2)}, vUV.y) * step(vUV.y, ${(BOTTOM_V[1] + 0.01).toFixed(2)});
  float rib = step(0.89, vUV.y) * step(vUV.x, 0.5);
  float outward = dot(n, toEye) * (top * topSign + lower * bottomSign);
  float inside = max(rib, (top + lower) * step(outward, 0.0));
  // The fabric curves into a crease along each rib: a little darker there.
  float edge = min(fract(vUV.x * ${CELLS}.0), 1.0 - fract(vUV.x * ${CELLS}.0));
  float crease = mix(0.72, 1.0, smoothstep(0.0, 0.2, edge)) * (1.0 - rib) + rib;
  // Cloth has two sides: light the one you see.
  if (dot(n, toEye) < 0.0) n = -n;
  vec3 geo = n;
  // Bump from the detail map (surface gradient: no tangents needed).
  vec3 dp1 = dFdx(vPos);
  vec3 dp2 = dFdy(vPos);
  float h = height * 0.006;
  vec3 r1 = cross(dp2, n);
  vec3 r2 = cross(n, dp1);
  float det = dot(dp1, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  vec3 bumped = abs(det) * n - grad;
  if (abs(det) > 1e-14) n = normalize(bumped);

  float ndl = dot(n, sunDir);
  vec3 sky = mix(groundColor, skyColor, 0.5 + 0.5 * n.y);
  vec3 color = albedo * (sky * 0.55 + sunColor * max(ndl, 0.0) * 1.05) * crease;
  // Nylon's sheen.
  vec3 hv = normalize(sunDir + toEye);
  color += sunColor * pow(max(dot(n, hv), 0.0), 36.0) * 0.12 * step(0.0, ndl);
  color *= mix(1.0, 0.22, inside);
  // Light through the cloth from behind it: the sun, and the sky above a skin seen from below.
  // The bottom skin is seen through two layers (the top skin is above it), so it glows less.
  float bottom = step(${BOTTOM_V[0].toFixed(2)}, vUV.y) * step(vUV.y, ${BOTTOM_V[1].toFixed(2)});
  float through = mix(0.7, 0.48, bottom) * (1.0 - 0.85 * density) * mix(1.0, 0.85, 1.0 - crease);
  vec3 tint = albedo * (0.45 + 0.75 * albedo);
  float behind = max(-dot(geo, sunDir), 0.0);
  color += tint * through * (sunColor * (0.25 + 0.75 * behind) * behind * 1.3 + skyColor * max(-geo.y, 0.0) * 1.1);
  // Seams darken a touch in reflected light too (thread, stitch shadows).
  color *= 1.0 - 0.18 * density;
  gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}`;

function paint() {
  const albedo = document.createElement('canvas');
  albedo.width = W;
  albedo.height = H;
  const a = albedo.getContext('2d');
  const detail = document.createElement('canvas');
  detail.width = W;
  detail.height = H;
  const d = detail.getContext('2d');
  d.fillStyle = '#000';
  d.fillRect(0, 0, W, H);
  // Seeded, so the canopy is the same every visit.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const cellX = (i) => (i / CELLS) * W;
  const chordY = ([v0, v1], x) => (v0 + (v1 - v0) * x) * H;
  /** A stroke into the detail map: red = density, green = height. */
  const mark = (density, height, width, draw) => {
    d.strokeStyle = `rgb(${Math.round(density * 255)},${Math.round(height * 255)},0)`;
    d.lineWidth = width;
    d.beginPath();
    draw();
    d.stroke();
  };
  d.globalCompositeOperation = 'lighten';

  for (const region of [TOP_V, BOTTOM_V]) {
    const top = region === TOP_V;
    // Panels: each cell's colour, the nose panel navy.
    for (let i = 0; i < CELLS; i++) {
      a.fillStyle = CELL_COLORS[i];
      a.fillRect(cellX(i), chordY(region, 0), cellX(i + 1) - cellX(i) + 1, chordY(region, 1) - chordY(region, 0) + 1);
      a.fillStyle = NAVY;
      a.fillRect(cellX(i), chordY(region, 0), cellX(i + 1) - cellX(i) + 1, chordY(region, NOSE_PANEL) - chordY(region, 0));
    }
    const y0 = chordY(region, 0);
    const y1 = chordY(region, 1);
    // Rib seams: a doubled tape with two rows of stitching.
    for (let i = 0; i <= CELLS; i++) {
      const x = Math.min(W - 2, Math.max(2, cellX(i)));
      mark(0.9, 0.85, 5, () => { d.moveTo(x, y0); d.lineTo(x, y1); });
      for (const off of [-3.5, 3.5]) mark(1, 1, 1, () => { d.moveTo(x + off, y0); d.lineTo(x + off, y1); });
    }
    // Chordwise panel seams.
    for (const s of PANEL_SEAMS) {
      const y = chordY(region, s);
      mark(0.7, 0.75, 3, () => { d.moveTo(0, y); d.lineTo(W, y); });
    }
    // The nose: reinforced (stiffened) on the top skin, the cell mouths' tape on the bottom.
    if (top) {
      d.fillStyle = 'rgb(90,40,0)';
      d.fillRect(0, y0, W, chordY(region, 0.05) - y0);
    } else {
      mark(0.95, 0.9, 6, () => { d.moveTo(0, y0 + 3); d.lineTo(W, y0 + 3); });
    }
    // Trailing edge tape.
    mark(0.95, 0.9, 7, () => { d.moveTo(0, y1 - 4); d.lineTo(W, y1 - 4); });
    // Wrinkles: on the bottom, fanning out from each line attachment; on the top, fine creases
    // along the ribs where the skin is pulled.
    for (let i = 0; i <= CELLS; i++) {
      const x = cellX(i);
      if (!top) {
        for (const row of ROW_X) {
          const y = chordY(region, row);
          // The attachment's reinforcing patch.
          d.fillStyle = 'rgb(240,200,0)';
          d.fillRect(x - 9, y - 12, 18, 24);
          for (let k = 0; k < 9; k++) {
            const ang = rand() * Math.PI * 2;
            const len = 25 + rand() * 60;
            mark(0.06, 0.25 + rand() * 0.25, 1.5 + rand() * 2, () => {
              d.moveTo(x, y);
              d.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (rand() - 0.5) * 12, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
            });
          }
        }
      } else {
        for (let k = 0; k < 14; k++) {
          const y = y0 + rand() * (y1 - y0);
          const side = rand() < 0.5 ? -1 : 1;
          const len = 15 + rand() * 45;
          mark(0.04, 0.2 + rand() * 0.2, 1.5, () => {
            d.moveTo(x + side * 4, y);
            d.lineTo(x + side * (4 + len), y + (rand() - 0.5) * 20);
          });
        }
      }
    }
  }
  // Plain fabric.
  a.fillStyle = WHITE;
  a.fillRect(0, 0.9 * H, W / 2, 0.1 * H);
  a.fillStyle = NAVY;
  a.fillRect(W / 2, 0.9 * H, W / 2, 0.1 * H);
  return { albedo, detail };
}

export function createFabric(scene) {
  const { albedo, detail } = paint();
  const anisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);
  const texture = (name, canvas) => {
    const t = new DynamicTexture(name, canvas, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    // Canvas row 0 is v = 0 (the nose of the top skin).
    t.update(false);
    t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
    t.anisotropicFilteringLevel = anisotropy;
    return t;
  };
  const mat = new ShaderMaterial('canopy-fabric', scene, { vertex: 'fabric', fragment: 'fabric' }, {
    attributes: ['position', 'normal', 'uv'],
    uniforms: ['world', 'viewProjection', 'eye', 'sunDir', 'sunColor', 'skyColor', 'groundColor', 'topSign', 'bottomSign'],
    samplers: ['albedoMap', 'detailMap'],
  });
  mat.setTexture('albedoMap', texture('canopy-albedo', albedo));
  mat.setTexture('detailMap', texture('canopy-detail', detail));
  mat.backFaceCulling = false;
  const sun = scene.getLightByName('sun');
  const hemi = scene.getLightByName('sky-light');
  const lin = (c, k = 1) => new Color3(c.r ** 2.2 * k, c.g ** 2.2 * k, c.b ** 2.2 * k);
  mat.setVector3('sunDir', sun ? sun.direction.scale(-1).normalize() : new Vector3(0.2, 0.75, -0.62).normalize());
  mat.setColor3('sunColor', lin(sun?.diffuse ?? Color3.White(), 1));
  mat.setColor3('skyColor', lin(hemi?.diffuse ?? new Color3(0.87, 0.91, 0.96), 1));
  mat.setColor3('groundColor', lin(hemi?.groundColor ?? new Color3(0.44, 0.48, 0.36), 1));
  mat.setFloat('topSign', 1);
  mat.setFloat('bottomSign', 1);
  mat.onBind = () => {
    const cam = scene.activeCamera;
    mat.setVector3('eye', cam.globalPosition ?? cam.position);
  };
  return mat;
}
