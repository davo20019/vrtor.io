// Every building within 1.2 km of the landing, from swisstopo's swissBUILDINGS3D
// (scripts/prepare-jump-buildings.py). Roofs take the aerial photo straight above them, so tiles,
// skylights and solar panels show; walls are plaster, lit by the sun. One mesh, one draw call.
// Faces are flat: the shader works out each one's normal, so vertices are shared and the file is
// small. Drawn with the terrain (logarithmic depth, the same haze), so hills and houses hide each
// other correctly.
import { Effect, Mesh, ShaderMaterial, Vector3, VertexData } from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;

Effect.ShadersStore.buildingsVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec4 color;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vPos;
varying vec3 vColor;
varying float vFragmentDepth;
void main() {
  vec4 p = world * vec4(position, 1.0);
  vPos = p.xyz;
  vColor = color.rgb;
  gl_Position = viewProjection * p;
  vFragmentDepth = 1.0 + gl_Position.w;
}`;

Effect.ShadersStore.buildingsFragmentShader = `
#extension GL_OES_standard_derivatives : enable
#extension GL_EXT_frag_depth : enable
precision highp float;
varying vec3 vPos;
varying vec3 vColor;
varying float vFragmentDepth;
uniform vec3 eye;
uniform vec3 sunDir;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float logDepth;
uniform float nearExtent;
uniform float farExtent;
uniform sampler2D nearPhoto;
uniform sampler2D farPhoto;
void main() {
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  vec3 toEye = eye - vPos;
  if (dot(n, toEye) < 0.0) n = -n;
  vec3 color;
  if (n.y > 0.35) {
    // Roof: the photo above it (it already holds the day's light and shade).
    vec2 xz = vPos.xz;
    bool near = abs(xz.x) < nearExtent * 0.5 && abs(xz.y) < nearExtent * 0.5;
    vec2 uv = near ? vec2(xz.x / nearExtent + 0.5, 0.5 - xz.y / nearExtent) : vec2(xz.x / farExtent + 0.5, 0.5 - xz.y / farExtent);
    color = near ? texture2D(nearPhoto, uv).rgb : texture2D(farPhoto, uv).rgb;
  } else {
    // Walls: plaster in sun and shade.
    float sun = max(dot(n, sunDir), 0.0);
    color = vColor * (0.55 + 0.2 * n.y + 0.5 * sun);
  }
  float d = length(toEye) * fogDensity;
  color = mix(fogColor, color, exp(-d * d));
  gl_FragColor = vec4(color, 1.0);
  gl_FragDepthEXT = log2(vFragmentDepth) * logDepth * 0.5;
}`;

export async function buildBuildings(scene, terrain, { sun }) {
  const [meta, buffer] = await Promise.all([
    fetch(`${BASE}terrain/buildings.json`).then((r) => r.json()),
    fetch(`${BASE}terrain/buildings.bin`).then((r) => {
      if (!r.ok) throw new Error('The buildings could not load.');
      return r.arrayBuffer();
    }),
  ]);
  const v = meta.vertices;
  const raw = new Int16Array(buffer, 0, v * 4);
  const positions = new Float32Array(v * 3);
  for (let i = 0; i < v; i++) {
    positions[i * 3] = raw[i * 4] / 10;
    positions[i * 3 + 1] = raw[i * 4 + 1] / 10;
    positions[i * 3 + 2] = raw[i * 4 + 2] / 10;
  }
  const rgba = new Uint8Array(buffer, v * 8, v * 4);
  const colors = new Float32Array(v * 4);
  // Kept in the same (sRGB) space as the photos, which the scene shows as they are.
  for (let i = 0; i < v * 4; i++) colors[i] = rgba[i] / 255;
  const indices = new Uint32Array(buffer, v * 12, meta.triangles * 3);

  const mesh = new Mesh('terrain-buildings', scene);
  const data = new VertexData();
  data.positions = positions;
  data.colors = colors;
  data.indices = indices;
  data.applyToMesh(mesh);
  const near = terrain.meta.levels.find((l) => l.name === 'l0');
  const far = terrain.meta.levels.find((l) => l.name === 'l1');
  const mat = new ShaderMaterial('buildings', scene, { vertex: 'buildings', fragment: 'buildings' }, {
    attributes: ['position', 'color'],
    uniforms: ['world', 'viewProjection', 'eye', 'sunDir', 'fogColor', 'fogDensity', 'logDepth', 'nearExtent', 'farExtent'],
    samplers: ['nearPhoto', 'farPhoto'],
  });
  mat.setTexture('nearPhoto', terrain.textures.l0);
  mat.setTexture('farPhoto', terrain.textures.l1);
  mat.setFloat('nearExtent', near.extent);
  mat.setFloat('farExtent', far.extent);
  mat.setVector3('sunDir', sun.direction.scale(-1).normalize());
  mat.onBind = () => {
    const cam = scene.activeCamera;
    mat.setVector3('eye', cam.globalPosition ?? cam.position);
    mat.setColor3('fogColor', scene.fogColor);
    mat.setFloat('fogDensity', scene.fogDensity);
    mat.setFloat('logDepth', 2 / (Math.log(cam.maxZ + 1) / Math.LN2));
  };
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  mesh.freezeWorldMatrix();
  return { mesh, count: meta.buildings };
}
