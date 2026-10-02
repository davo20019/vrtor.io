// Lunar orbit around Columbia: stars, the Moon below, Earth and the Sun. Columbia is
// at real size; the Moon, Earth and their distances are scaled down 1000 times
// (1 km becomes 1 m), which keeps every angle as it was, so the horizon, the size of
// Earth and the drift of the ground look right. All imagery is NASA's (scripts/prepare-apollo.py).
import {
  Color3,
  Constants,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Effect,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  Vector4,
  VertexData,
} from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;
const TEX = `${BASE}textures/`;

export const MOON_RADIUS = 1737.4;
/** Columbia's height above the surface (about 100 by 120 km after the second burn into orbit). */
export const ALTITUDE = 110;
const EARTH_RADIUS = 6371;
/** The real Earth is ~380,000 km away; drawn nearer (inside the camera's range) at the same apparent size. */
const EARTH_DISTANCE = 3000;
const STAR_DISTANCE = 6000;
/** Below Columbia when the page opens: just east of the Sea of Tranquility. */
const NADIR = { lat: 1, lon: 32 };
const TRANQUILITY = { lat: 0.674, lon: 23.473 };
/** The sharp patch of moon-near-*.jpg: longitude and latitude bounds (keep in sync with prepare-apollo.py). */
const PATCH = [-17, 63, -20, 20];
/** How fast the ground drifts west to east below: the real orbit does ~3 degrees a minute; this is slowed. */
const DRIFT_DEG_PER_MIN = 0.5;
/**
 * Sun 16 degrees up in the east: early morning below, as when Eagle landed (the Sun was about 11 degrees
 * up at Tranquility Base). Earth, high above, is lit from the side.
 */
const SUN_DIR = new Vector3(0.05, Math.sin((16 * Math.PI) / 180), -Math.cos((16 * Math.PI) / 180)).normalize();

export function createSpaceScene(engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);
  scene.ambientColor = new Color3(0.06, 0.06, 0.07);
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.0;
  // The sky (stars, Moon, Earth, Sun) draws first in group 0, at distances in the kilometres; everything
  // else draws in group 1 after the depth is cleared, so nothing near can lose to the far sky's depth.
  scene.onNewMeshAddedObservable.add((m) => {
    if (!m.metadata?.sky && m.renderingGroupId === 0) m.renderingGroupId = 1;
  });
  const anisotropy = Math.min(16, engine.getCaps().maxAnisotropy || 4);
  scene.onNewTextureAddedObservable.add((t) => (t.anisotropicFilteringLevel = Math.max(t.anisotropicFilteringLevel, anisotropy)));
  return scene;
}

export function buildSpace(scene) {
  const sun = new DirectionalLight('sun', SUN_DIR.scale(-1), scene);
  sun.diffuse = Color3.FromHexString('#fff6ea');
  sun.intensity = 2.6;
  // Sunlight bounced off the Moon fills the shadowed side from below.
  const moonlight = new HemisphericLight('moonlight', new Vector3(0, -1, 0), scene);
  moonlight.diffuse = Color3.FromHexString('#8e8a84');
  moonlight.groundColor = Color3.Black();
  moonlight.specular = Color3.Black();
  moonlight.intensity = 0.7;

  const stars = starField(scene);
  const sunDisc = sunSprite(scene);
  const moon = buildMoon(scene);
  const earth = buildEarth(scene);

  return {
    sun,
    sunDirection: SUN_DIR.clone(),
    moon,
    earth,
    stars,
    sunDisc,
    /** Earth hangs in `direction` from Columbia: chosen so it shows through the hatch window. */
    placeEarth(direction) {
      earth.place(direction);
    },
  };
}

// ---------- Moon ----------

Effect.ShadersStore.moonVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vObj = position;
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = viewProjection * w;
}`;

Effect.ShadersStore.moonFragmentShader = `
precision highp float;
varying vec3 vObj;
varying vec3 vWorld;
uniform mat4 world;
uniform vec3 sunDir;
uniform vec3 eye;
uniform vec4 patchBounds;
uniform float relief;
uniform sampler2D farColor;
uniform sampler2D farSlope;
uniform sampler2D nearColor;
uniform sampler2D nearSlope;
const float PI = 3.14159265;
void main() {
  vec3 p = normalize(vObj);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  float latD = degrees(lat);
  float lonD = degrees(lon);
  vec2 farUv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
  vec3 albedo = texture2D(farColor, farUv).rgb;
  vec2 slope = texture2D(farSlope, farUv).rg;
  vec2 nearUv = vec2((lonD - patchBounds.x) / (patchBounds.y - patchBounds.x), (patchBounds.w - latD) / (patchBounds.w - patchBounds.z));
  vec2 edge = min(nearUv, 1.0 - nearUv);
  float w = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  if (w > 0.0) {
    albedo = mix(albedo, texture2D(nearColor, nearUv).rgb, w);
    slope = mix(slope, texture2D(nearSlope, nearUv).rg, w);
  }
  slope = (slope - 0.5) * 2.0 * 0.6 * relief;
  vec3 east = normalize(vec3(-sin(lon), 0.0, cos(lon)));
  vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), -sin(lat) * sin(lon));
  vec3 nObj = normalize(p - slope.x * east - slope.y * north);
  vec3 n = normalize(mat3(world) * nObj);
  vec3 g = normalize(mat3(world) * p);
  vec3 v = normalize(eye - vWorld);
  float ci = max(dot(n, sunDir), 0.0);
  float ce = max(dot(n, v), 0.02);
  // Lunar soil scatters light back the way it came (Lommel-Seeliger), with a little Lambert for relief;
  // the geometric normal sets the terminator so slopes can't light the night side.
  float shade = mix(2.0 * ci / (ci + ce), ci * 1.5, 0.35) * smoothstep(-0.02, 0.06, dot(g, sunDir));
  vec3 col = albedo * (shade * 1.05 + 0.012);
  gl_FragColor = vec4(col, 1.0);
}`;

function buildMoon(scene) {
  const pivot = new TransformNode('moon-pivot', scene);
  pivot.position.set(0, -(MOON_RADIUS + ALTITUDE), 0);
  const moon = MeshBuilder.CreateSphere('moon', { diameter: 2 * MOON_RADIUS, segments: 160 }, scene);
  moon.metadata = { sky: true };
  moon.renderingGroupId = 0;
  moon.isPickable = false;
  moon.parent = pivot;

  const tex = (name) => {
    const t = new Texture(`${TEX}${name}`, scene, false, false);
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.wrapV = Texture.CLAMP_ADDRESSMODE;
    return t;
  };
  const near = (name) => {
    const t = tex(name);
    t.wrapU = Texture.CLAMP_ADDRESSMODE;
    return t;
  };
  const mat = new ShaderMaterial('moon', scene, { vertex: 'moon', fragment: 'moon' }, {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'sunDir', 'eye', 'patchBounds', 'relief'],
    samplers: ['farColor', 'farSlope', 'nearColor', 'nearSlope'],
  });
  mat.setTexture('farColor', tex('moon-color.jpg'));
  mat.setTexture('farSlope', tex('moon-slope.jpg'));
  mat.setTexture('nearColor', near('moon-near-color.jpg'));
  mat.setTexture('nearSlope', near('moon-near-slope.jpg'));
  mat.setVector3('sunDir', SUN_DIR);
  mat.setVector4('patchBounds', new Vector4(...PATCH));
  // Relief exaggerated a little: from orbit the real slopes read flatter than they look in photos.
  mat.setFloat('relief', 2.2);
  mat.onBindObservable.add(() => {
    const cam = scene.activeCamera;
    if (cam) mat.getEffect()?.setVector3('eye', cam.globalPosition);
  });
  moon.material = mat;

  // The ground below at the start, oriented so north is +X and east is -Z (the way Columbia's crew faces).
  const orient = surfaceFrame(NADIR.lat, NADIR.lon);
  const start = performance.now();
  // Tranquility Base's marker is a billboard, which ignores a parent's rotation: it follows the Moon here.
  const baseOnMoon = latLon(TRANQUILITY.lat, TRANQUILITY.lon).scale(MOON_RADIUS + 12);
  let base = null;
  scene.onBeforeRenderObservable.add(() => {
    const minutes = (performance.now() - start) / 60000;
    // West (+Z) comes toward you: Columbia flies west over the near side.
    const drift = Quaternion.RotationAxis(Vector3.Right(), (-DRIFT_DEG_PER_MIN * minutes * Math.PI) / 180);
    moon.rotationQuaternion = drift.multiply(orient);
    if (base) Vector3.TransformCoordinatesToRef(baseOnMoon, moon.computeWorldMatrix(true), base.position);
  });

  // Tranquility Base: a marker standing a little above the plain, so it reads from orbit.
  base = MeshBuilder.CreatePlane('tranquility', { size: 9 }, scene);
  base.metadata = { sky: true, stop: 'tranquility' };
  base.renderingGroupId = 0;
  base.billboardMode = Mesh.BILLBOARDMODE_ALL;
  const bmat = new StandardMaterial('tranquility', scene);
  const btex = ringTexture(scene, '#ffb020');
  bmat.disableLighting = true;
  bmat.emissiveTexture = btex;
  bmat.opacityTexture = btex;
  bmat.backFaceCulling = false;
  base.material = bmat;

  return { mesh: moon, tranquility: base };
}

/** Unit vector at a latitude and longitude, in the Moon's (and Earth's) mesh frame: east toward +Z at longitude 0. */
function latLon(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

/** The rotation that puts (lat, lon) on top (+Y), with north toward +X and east toward -Z. */
function surfaceFrame(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const up = latLon(latDeg, lonDeg);
  const east = new Vector3(-Math.sin(lon), 0, Math.cos(lon));
  const north = new Vector3(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), -Math.sin(lat) * Math.sin(lon));
  // Where each of the mesh's own axes ends up: x -> (north.x, up.x, -east.x), and so on.
  return Quaternion.RotationQuaternionFromAxis(
    new Vector3(north.x, up.x, -east.x),
    new Vector3(north.y, up.y, -east.y),
    new Vector3(north.z, up.z, -east.z),
  );
}

// ---------- Earth ----------

Effect.ShadersStore.earthVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vObj = position;
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = viewProjection * w;
}`;

Effect.ShadersStore.earthFragmentShader = `
precision highp float;
varying vec3 vObj;
varying vec3 vWorld;
uniform mat4 world;
uniform vec3 sunDir;
uniform vec3 eye;
uniform sampler2D day;
const float PI = 3.14159265;
void main() {
  vec3 p = normalize(vObj);
  vec2 uv = vec2(atan(p.z, p.x) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(p.y, -1.0, 1.0)) / PI);
  vec3 n = normalize(mat3(world) * p);
  vec3 v = normalize(eye - vWorld);
  float d = dot(n, sunDir);
  vec3 col = texture2D(day, uv).rgb * smoothstep(-0.08, 0.25, d) * 1.15;
  // A thin blue limb of atmosphere on the lit side.
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += vec3(0.25, 0.45, 0.95) * rim * smoothstep(-0.2, 0.4, d) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

function buildEarth(scene) {
  // Same angle across as the real Earth from the Moon: about 1.9 degrees.
  const radius = (EARTH_DISTANCE * EARTH_RADIUS) / 384400;
  const earth = MeshBuilder.CreateSphere('earth', { diameter: 2 * radius, segments: 48 }, scene);
  earth.metadata = { sky: true };
  earth.renderingGroupId = 0;
  earth.isPickable = false;
  const mat = new ShaderMaterial('earth', scene, { vertex: 'earth', fragment: 'earth' }, {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'sunDir', 'eye'],
    samplers: ['day'],
  });
  mat.setTexture('day', new Texture(`${TEX}earth.jpg`, scene, false, false));
  mat.setVector3('sunDir', SUN_DIR);
  mat.onBindObservable.add(() => {
    const cam = scene.activeCamera;
    if (cam) mat.getEffect()?.setVector3('eye', cam.globalPosition);
  });
  earth.material = mat;

  return {
    mesh: earth,
    place(direction) {
      const d = direction.normalizeToNew();
      earth.position.copyFrom(d.scale(EARTH_DISTANCE));
      // The Atlantic, with the Americas and Africa at the edges, faces the Moon.
      const toMoon = d.scale(-1);
      const frame = surfaceFrame(0, -35);
      // surfaceFrame puts that point on +Y; turn +Y to face the Moon, keeping north roughly up.
      const align = Quaternion.FromUnitVectorsToRef(Vector3.Up(), toMoon, new Quaternion());
      earth.rotationQuaternion = align.multiply(frame);
    },
  };
}

// ---------- Stars and Sun ----------

Effect.ShadersStore.starsVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec4 color;
uniform mat4 worldViewProjection;
varying vec4 vColor;
void main() {
  vColor = color;
  gl_Position = worldViewProjection * vec4(position, 1.0);
  gl_PointSize = 1.0 + 2.2 * color.a;
}`;

Effect.ShadersStore.starsFragmentShader = `
precision highp float;
varying vec4 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c));
  gl_FragColor = vec4(vColor.rgb * a, 1.0);
}`;

function starField(scene) {
  const count = 4500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  let seed = 1969;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    positions.set([r * Math.cos(a) * STAR_DISTANCE, z * STAR_DISTANCE, r * Math.sin(a) * STAR_DISTANCE], i * 3);
    // Mostly faint, a few bright; warm and cool tints.
    const m = Math.pow(rand(), 5);
    const b = 0.25 + 0.75 * Math.pow(rand(), 3) + m;
    const t = rand();
    const tint = t < 0.15 ? [1, 0.82, 0.65] : t < 0.35 ? [0.75, 0.85, 1] : [1, 1, 1];
    colors.set([tint[0] * Math.min(b, 1), tint[1] * Math.min(b, 1), tint[2] * Math.min(b, 1), Math.min(m * 2, 1)], i * 4);
  }
  const mesh = new Mesh('stars', scene);
  const data = new VertexData();
  data.positions = positions;
  data.colors = colors;
  data.applyToMesh(mesh);
  mesh.metadata = { sky: true };
  mesh.renderingGroupId = 0;
  mesh.isPickable = false;
  mesh.infiniteDistance = true;
  const mat = new ShaderMaterial('stars', scene, { vertex: 'stars', fragment: 'stars' }, {
    attributes: ['position', 'color'],
    uniforms: ['worldViewProjection'],
  });
  mat.pointsCloud = true;
  mat.disableDepthWrite = true;
  mesh.material = mat;
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

Effect.ShadersStore.sunVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

Effect.ShadersStore.sunFragmentShader = `
precision highp float;
varying vec2 vUv;
void main() {
  // A hard white disc (0.53 degrees) in a soft glow, added to whatever is behind.
  float r = length(vUv - 0.5) * 2.0 * 11.0;
  float disc = smoothstep(1.05, 0.95, r);
  float glow = 0.5 * exp(-r * 0.9) + 0.12 * exp(-r * 0.25);
  vec3 col = vec3(1.0, 0.98, 0.94) * disc + vec3(1.0, 0.9, 0.75) * glow * (1.0 - disc);
  gl_FragColor = vec4(col, 1.0);
}`;

function sunSprite(scene) {
  const disc = MeshBuilder.CreatePlane('sun-disc', { size: 1 }, scene);
  // The real Sun is 0.53 degrees across; the plane spans 11 times that, for the glow.
  const distance = STAR_DISTANCE * 0.9;
  disc.scaling.setAll(2 * distance * Math.tan((0.265 * Math.PI) / 180) * 11);
  disc.position.copyFrom(SUN_DIR.scale(distance));
  disc.infiniteDistance = true;
  disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
  disc.metadata = { sky: true };
  disc.renderingGroupId = 0;
  disc.isPickable = false;
  const mat = new ShaderMaterial('sun', scene, { vertex: 'sun', fragment: 'sun' }, {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection'],
    needAlphaBlending: true,
  });
  mat.alphaMode = Constants.ALPHA_ADD;
  mat.disableDepthWrite = true;
  mat.backFaceCulling = false;
  disc.material = mat;
  return disc;
}

function ringTexture(scene, color) {
  const tex = new DynamicTexture('ring', 128, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 18, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}
