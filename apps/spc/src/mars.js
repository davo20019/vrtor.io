// The Martian landscape: butterscotch sky, rolling sand with scanned rocks,
// low sun with shadows, drifting dust. Built for a Quest's mobile GPU: one
// shadow map (the rover only), rock instances, no post-processing.
import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';

const A = '/assets/space/';
const SKY_TOP = Color3.FromHexString('#c49a76');
const SKY_HORIZON = Color3.FromHexString('#e8c39b');
const SKY_BELOW = Color3.FromHexString('#8a5a3c');
const FOG = Color3.FromHexString('#d9b08a');
/** Flat, even ground within this radius of the rover, so walking and teleporting there is easy. */
const FLAT_RADIUS = 9;

export function createMarsScene(engine) {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(SKY_HORIZON);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.014;
  scene.fogColor = FOG;
  scene.ambientColor = new Color3(0.25, 0.18, 0.14);
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.1;
  // The sky draws first in group 0; everything else in group 1, which clears depth first, so the
  // far dome can never cover the world (it did, from some angles, sharing a group).
  scene.onNewMeshAddedObservable.add((m) => {
    if (m.name !== 'sky' && m.renderingGroupId === 0) m.renderingGroupId = 1;
  });
  // Textures seen at a slant (the ground, the rover's panels) stay sharp: the most the GPU allows (16 on a Quest).
  const anisotropy = Math.min(16, engine.getCaps().maxAnisotropy || 4);
  scene.onNewTextureAddedObservable.add((t) => (t.anisotropicFilteringLevel = Math.max(t.anisotropicFilteringLevel, anisotropy)));
  return scene;
}

export async function buildMars(scene) {
  const sky = skyDome(scene);

  // The sky, captured once, lights the metal and paint (image-based lighting).
  const probe = new ReflectionProbe('sky-probe', 128, scene);
  probe.renderList.push(sky);
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  probe.position = new Vector3(0, 1.5, 0);
  scene.environmentTexture = probe.cubeTexture;
  scene.environmentIntensity = 0.75;

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.diffuse = Color3.FromHexString('#ffe2c4');
  hemi.groundColor = Color3.FromHexString('#7a4a30');
  hemi.intensity = 0.55;

  const sun = new DirectionalLight('sun', new Vector3(0.75, -1, -0.55).normalize(), scene);
  sun.position = new Vector3(-8, 11, 6);
  sun.diffuse = Color3.FromHexString('#fff0dc');
  sun.intensity = 3.2;
  // The sun and the rover never move: the shadow map is drawn once (see freezeShadows), so it can be
  // large and crisp without costing anything per frame.
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;

  const ground = terrain(scene);
  ground.receiveShadows = true;

  const rocks = await scatterRocks(scene);
  dust(scene);

  return { ground, shadows, sun, sky, rocks };
}

/** Draws the shadow map one last time (call after every caster is added), then never again. */
export function freezeShadows(shadows) {
  shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
}

// A dome with the sky's gradient painted into an emissive texture (no lighting, no fog).
function skyDome(scene) {
  const dome = MeshBuilder.CreateSphere('sky', { diameter: 800, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const tex = new DynamicTexture('sky', { width: 4, height: 256 }, scene, false);
  const ctx = tex.getContext();
  // A sphere's v runs from the bottom (0) to the top (1); the canvas is drawn top-down.
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, SKY_TOP.toHexString());
  g.addColorStop(0.32, SKY_TOP.toHexString());
  g.addColorStop(0.5, SKY_HORIZON.toHexString());
  g.addColorStop(0.56, SKY_BELOW.toHexString());
  g.addColorStop(1, SKY_BELOW.toHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new StandardMaterial('sky', scene);
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  dome.material = mat;
  dome.applyFog = false;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.renderingGroupId = 0;
  return dome;
}

// Small seeded random numbers, so the landscape is the same every visit.
export function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  // Gentle dunes that grow with distance, and a far crater rim.
  const dunes = 0.55 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) + 0.3 * Math.sin(x * 0.27 + z * 0.19) + 0.12 * Math.sin(x * 0.7 - z * 0.5);
  const ramp = Math.min(1, Math.max(0, (r - FLAT_RADIUS) / 25));
  const rim = Math.max(0, r - 70) * 0.18 * (1 + 0.35 * Math.sin(Math.atan2(z, x) * 5));
  return dunes * ramp * (1 + r / 40) + rim;
}

function terrain(scene) {
  const size = 260;
  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 160, updatable: true }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) positions[i + 1] = heightAt(positions[i], positions[i + 2]);
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);

  // Plain (non-PBR) shading for the sand: it fills most of every frame, so it must be cheap
  // for the headset to keep its eye buffer large; matte sand looks the same either way.
  const mat = new StandardMaterial('sand', scene);
  const tex = (file) => {
    const t = new Texture(A + 'ground/' + file, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    t.uScale = t.vScale = 70;
    return t;
  };
  mat.diffuseTexture = tex('aerial_sand_diff_1k.jpg');
  // The lights are set for physically based materials, which divide by π (and add sky light): scale to match.
  mat.diffuseColor = Color3.FromHexString('#f08a58').scale(1.45 / Math.PI);
  mat.bumpTexture = tex('aerial_sand_nor_1k.jpg');
  mat.bumpTexture.level = 0.8;
  mat.invertNormalMapY = true;
  mat.specularColor = Color3.Black();
  ground.material = mat;
  ground.freezeWorldMatrix();
  return ground;
}

async function scatterRocks(scene) {
  const sources = [];
  for (const name of ['rock_07', 'moon_rock_03']) {
    const container = await LoadAssetContainerAsync(`${A}${name}/${name}.gltf`, scene);
    container.addAllToScene();
    const meshes = container.meshes.filter((m) => m.getTotalVertices() > 0);
    for (const m of meshes) {
      // Bake the glTF root's transform (handedness flip) so instances start from identity.
      m.setParent(null);
      m.bakeCurrentTransformIntoVertices();
      m.refreshBoundingInfo();
      const ext = m.getBoundingInfo().boundingBox.extendSize;
      const s = 0.5 / Math.max(ext.x, ext.z);
      m.scaling.setAll(s);
      m.bakeCurrentTransformIntoVertices();
      m.refreshBoundingInfo();
      const mat = m.material;
      if (mat) mat.albedoColor = Color3.FromHexString('#b07050');
      m.isPickable = false;
      m.setEnabled(false);
      sources.push(m);
    }
    container.transformNodes.forEach((n) => n.dispose());
  }

  const rand = mulberry32(11);
  const instances = [];
  for (let i = 0; i < 80; i++) {
    const src = sources[i % sources.length];
    const ang = rand() * Math.PI * 2;
    const dist = 3.6 + rand() * rand() * 55;
    // Small pebbles near the rover (nothing to trip over in VR), boulders farther out.
    const scale = (0.25 + rand() * rand() * 2.6) * (dist < 7 ? 0.35 : 1);
    const inst = src.createInstance(`rock-${i}`);
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const ext = src.getBoundingInfo().boundingBox;
    inst.position.set(x, heightAt(x, z) - ext.minimum.y * scale * 0.6, z);
    inst.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    inst.scaling.setAll(scale);
    inst.isPickable = false;
    inst.freezeWorldMatrix();
    instances.push(inst);
  }
  sources.forEach((m) => m.setEnabled(true));
  // The source meshes themselves sit far underground.
  sources.forEach((m) => (m.position.y = -50));
  return instances;
}

// Fine dust drifting in the low sun.
function dust(scene) {
  const tex = new DynamicTexture('dust', 64, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex.update();
  tex.hasAlpha = true;

  const ps = new ParticleSystem('dust', 500, scene);
  ps.particleTexture = tex;
  ps.emitter = new Vector3(0, 0, 0);
  ps.minEmitBox = new Vector3(-16, 0, -16);
  ps.maxEmitBox = new Vector3(16, 3.5, 16);
  ps.color1 = new Color4(1, 0.88, 0.75, 0.5);
  ps.color2 = new Color4(1, 0.8, 0.6, 0.3);
  ps.colorDead = new Color4(1, 0.8, 0.6, 0);
  ps.minSize = 0.015;
  ps.maxSize = 0.05;
  ps.minLifeTime = 8;
  ps.maxLifeTime = 16;
  ps.emitRate = 40;
  ps.direction1 = new Vector3(0.12, 0.02, 0.03);
  ps.direction2 = new Vector3(0.25, 0.06, -0.03);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 1;
  ps.updateSpeed = 0.01;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.preWarmCycles = 400;
  ps.preWarmStepOffset = 5;
  ps.isLocal = false;
  ps.renderingGroupId = 1;
  ps.start();
  return ps;
}
