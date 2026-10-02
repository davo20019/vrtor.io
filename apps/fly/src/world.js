// Kill Devil Hills, North Carolina, about 10:35 in the morning on December 17, 1903: flat sand
// to the horizon, Big Kill Devil Hill behind, the Wrights' wooden camp, and the 60 ft launch
// rail pointing north into the wind. North is +Z (the way the Flyer faces), east is +X.
// The sand texture is Poly Haven's Coast Sand 02 (CC0).
import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';

const SAND = `${import.meta.env.BASE_URL}textures/`;
const SKY_TOP = Color3.FromHexString('#8fb0cf');
const SKY_HORIZON = Color3.FromHexString('#dfe6ea');
const SKY_BELOW = Color3.FromHexString('#c9b99a');
const FOG = Color3.FromHexString('#dde3e4');
/** The launch rail: 60 ft of two-by-fours on edge, the Flyer's dolly at its south end (z = 0). */
export const RAIL = { length: 18.3, height: 0.1 };
/** Level sand within this distance of the rail, so walking and teleporting there is easy. */
const FLAT_RADIUS = 45;
/**
 * The Sun in mid-December at about 36 degrees north, mid-morning: low (about 28 degrees up) and in
 * the south-south-east.
 */
const SUN_UP = (28 * Math.PI) / 180;
const SUN_AZIMUTH = (155 * Math.PI) / 180;
const TO_SUN = new Vector3(Math.sin(SUN_AZIMUTH) * Math.cos(SUN_UP), Math.sin(SUN_UP), Math.cos(SUN_AZIMUTH) * Math.cos(SUN_UP));

export function createScene(engine) {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(SKY_HORIZON);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0035;
  scene.fogColor = FOG;
  scene.ambientColor = new Color3(0.3, 0.3, 0.32);
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.05;
  // The sky draws first (group 0); everything else after it.
  scene.onNewMeshAddedObservable.add((m) => {
    if (m.name !== 'sky' && m.renderingGroupId === 0) m.renderingGroupId = 1;
  });
  const anisotropy = Math.min(16, engine.getCaps().maxAnisotropy || 4);
  scene.onNewTextureAddedObservable.add((t) => (t.anisotropicFilteringLevel = Math.max(t.anisotropicFilteringLevel, anisotropy)));
  return scene;
}

export function buildWorld(scene) {
  skyDome(scene);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.diffuse = Color3.FromHexString('#e4ecf4');
  hemi.groundColor = Color3.FromHexString('#9a8c72');
  hemi.specular = Color3.Black();
  hemi.intensity = 0.75;

  const sun = new DirectionalLight('sun', TO_SUN.scale(-1), scene);
  sun.position = TO_SUN.scale(40);
  sun.diffuse = Color3.FromHexString('#fff3e2');
  sun.intensity = 2.2;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0015;
  shadows.normalBias = 0.015;
  // Only the Flyer casts: the shadow map fits it wherever it is, so its wires stay crisp.
  sun.autoCalcShadowZBounds = true;

  const ground = terrain(scene);
  ground.receiveShadows = true;
  const rail = launchRail(scene);
  rail.receiveShadows = true;
  camp(scene);

  return {
    ground,
    shadows,
    /** Draw the shadow map every frame while something moves; otherwise once. */
    liveShadows(on) {
      shadows.getShadowMap().refreshRate = on ? 1 : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      if (!on) shadows.getShadowMap().resetRefreshCounter();
    },
  };
}

function skyDome(scene) {
  const dome = MeshBuilder.CreateSphere('sky', { diameter: 1600, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const tex = new DynamicTexture('sky', { width: 4, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  // The dome samples this bottom-up: the ground side first.
  g.addColorStop(0, SKY_BELOW.toHexString());
  g.addColorStop(0.47, SKY_BELOW.toHexString());
  g.addColorStop(0.51, SKY_HORIZON.toHexString());
  g.addColorStop(0.7, SKY_TOP.toHexString());
  g.addColorStop(1, SKY_TOP.toHexString());
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

/** Big Kill Devil Hill, the dune the Wrights glided from, stands to the south-west. */
const HILL = { x: -170, z: -330, height: 27, radius: 130 };

export function heightAt(x, z) {
  const r = Math.hypot(x, z - RAIL.length / 2);
  const ripples = 0.35 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.05) + 0.2 * Math.sin(x * 0.17 + z * 0.13);
  const ramp = Math.min(1, Math.max(0, (r - FLAT_RADIUS) / 40));
  const dh = Math.hypot(x - HILL.x, (z - HILL.z) * 1.3) / HILL.radius;
  const hill = HILL.height * Math.exp(-dh * dh * 2.2);
  return ripples * ramp * (1 + r / 120) + hill;
}

function terrain(scene) {
  const size = 1200;
  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 200, updatable: true }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) positions[i + 1] = heightAt(positions[i], positions[i + 2]);
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);

  const mat = new StandardMaterial('sand', scene);
  const tex = (file) => {
    const t = new Texture(SAND + file, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
    // About 8 m per tile, so the repeat doesn't show across the flat.
    t.uScale = t.vScale = 150;
    return t;
  };
  mat.diffuseTexture = tex('coast_sand_02_diff_1k.jpg');
  // The texture is lifted to pale Outer Banks sand (see public/models/CREDITS.md).
  mat.bumpTexture = tex('coast_sand_02_nor_gl_1k.jpg');
  mat.bumpTexture.level = 0.6;
  mat.specularColor = Color3.Black();
  ground.material = mat;
  ground.freezeWorldMatrix();
  return ground;
}

function wood(scene, name, hex) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  // Weathered boards in a bright sky's light: the shaded sides don't go black.
  mat.emissiveColor = Color3.FromHexString(hex).scale(0.25);
  mat.specularColor = new Color3(0.04, 0.04, 0.04);
  return mat;
}

/** Two-by-fours laid end to end on edge, capped with a thin metal strip the dolly ran on. */
function launchRail(scene) {
  const rail = MeshBuilder.CreateBox('rail', { width: 0.045, height: RAIL.height, depth: RAIL.length }, scene);
  rail.position.set(0, RAIL.height / 2, RAIL.length / 2 - 1.2);
  rail.material = wood(scene, 'rail', '#6e5c47');
  const cap = MeshBuilder.CreateBox('rail-cap', { width: 0.03, height: 0.004, depth: RAIL.length }, scene);
  cap.position.set(0, RAIL.height + 0.002, rail.position.z);
  const metal = new StandardMaterial('rail-cap', scene);
  metal.diffuseColor = Color3.FromHexString('#6b6e70');
  cap.material = metal;
  const merged = Mesh.MergeMeshes([rail, cap], true, true, undefined, false, true);
  merged.name = 'launch-rail';
  merged.isPickable = false;
  merged.freezeWorldMatrix();
  return merged;
}

/**
 * The camp: the 1903 hangar built for the Flyer (44 by 16 ft) and the 1901 building the brothers
 * lived and worked in, plain board sheds with low gable roofs, a short walk south of the rail.
 */
function camp(scene) {
  const walls = wood(scene, 'shed-walls', '#c4b393');
  const roof = wood(scene, 'shed-roof', '#857a68');
  const shed = (name, x, z, width, depth, height) => {
    const y = heightAt(x, z);
    const body = MeshBuilder.CreateBox(`${name}-body`, { width, depth, height }, scene);
    body.position.set(x, y + height / 2, z);
    body.material = walls;
    // A low gable roof: two boards meeting along the ridge, the ridge running the long way.
    const pitch = 0.32;
    const half = depth / 2 + 0.3;
    const slope = half / Math.cos(pitch);
    const parts = [body];
    for (const side of [-1, 1]) {
      const plane = MeshBuilder.CreateBox(`${name}-roof`, { width: width + 0.5, depth: slope, height: 0.06 }, scene);
      plane.rotation.x = side * pitch;
      plane.position.set(x, y + height + (half * Math.tan(pitch)) / 2, z + (side * half) / 2);
      plane.material = roof;
      parts.push(plane);
    }
    const m = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    m.name = name;
    m.isPickable = false;
    m.receiveShadows = true;
    m.freezeWorldMatrix();
    return m;
  };
  shed('hangar', -12, -34, 13.4, 4.9, 2.4);
  shed('living-shed', 6, -38, 7.6, 4.9, 2.5);
}
