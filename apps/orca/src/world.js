// A bright museum gallery for the skeletons: a long hall with tall windows down one side, light
// from skylights, a pale stone floor and low dark platforms under the mounts. It isn't a copy of
// the Pisa museum's Cetacean Gallery; it's drawn in code. The hall runs along Z (the way the
// skeletons face), the windows are on the -X wall.
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
} from '@babylonjs/core';

export const HALL = { width: 18, length: 36, height: 7.5 };
const WALL = '#ebe6dc';
const FLOOR = '#cfc8bb';

export function createScene(engine) {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#ebe6dcff');
  scene.ambientColor = new Color3(0.32, 0.32, 0.32);
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.1;
  ip.vignetteEnabled = false;
  const anisotropy = Math.min(16, engine.getCaps().maxAnisotropy || 4);
  scene.onNewTextureAddedObservable.add((t) => (t.anisotropicFilteringLevel = Math.max(t.anisotropicFilteringLevel, anisotropy)));
  return scene;
}

export function buildWorld(scene) {
  const hemi = new HemisphericLight('hemi', new Vector3(0.15, 1, 0.1), scene);
  hemi.diffuse = Color3.FromHexString('#f4f1ea');
  hemi.groundColor = Color3.FromHexString('#8f877a');
  hemi.specular = Color3.Black();
  hemi.intensity = 0.85;

  // Daylight through the skylights and the windows: high, from the window side.
  const sun = new DirectionalLight('sun', new Vector3(0.38, -1, -0.22).normalize(), scene);
  sun.position = new Vector3(-6, 14, 4);
  sun.diffuse = Color3.FromHexString('#fff6ea');
  sun.intensity = 1.45;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.25;
  sun.autoCalcShadowZBounds = true;

  const ground = floor(scene);
  ground.receiveShadows = true;
  hall(scene);
  windows(scene);
  skylights(scene);
  title(scene);

  return {
    ground,
    shadows,
    /** Platforms people can step onto (teleport targets besides the floor). */
    floors: [ground],
    /** Redraw the shadow map once (the scene is still; call after anything moves). */
    refreshShadows() {
      shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      shadows.getShadowMap().resetRefreshCounter();
    },
    platform: (name, x, z, width, depth) => platform(scene, name, x, z, width, depth),
  };
}

function flat(scene, name, hex, { emissive = 0.18, specular = 0.03 } = {}) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  // Pale painted walls in a bright room: the shaded sides don't go grey.
  mat.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  mat.specularColor = new Color3(specular, specular, specular);
  return mat;
}

/** Pale stone with faint speckles and the joints of large tiles. */
function floor(scene) {
  const ground = MeshBuilder.CreateGround('floor', { width: HALL.width, height: HALL.length }, scene);
  const size = 512;
  const tex = new DynamicTexture('floor', size, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, size, size);
  // A fixed pattern (no Math.random), so every visitor sees the same floor.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const shade = 150 + Math.floor(rand() * 90);
    ctx.fillStyle = `rgba(${shade},${shade - 6},${shade - 16},0.35)`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  ctx.strokeStyle = 'rgba(120,112,98,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  // One texture tile is one 1.5 m floor tile.
  tex.uScale = HALL.width / 1.5;
  tex.vScale = HALL.length / 1.5;
  const mat = new StandardMaterial('floor', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.12, 0.12, 0.12);
  mat.specularPower = 48;
  mat.emissiveColor = Color3.FromHexString(FLOOR).scale(0.08);
  ground.material = mat;
  ground.freezeWorldMatrix();
  return ground;
}

function hall(scene) {
  const { width, length, height } = HALL;
  const wall = flat(scene, 'wall', WALL);
  const parts = [];
  const box = (name, w, h, d, x, y, z) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    parts.push(b);
    return b;
  };
  // The window wall (-X) is posts between the windows, above and below them.
  box('wall-east', 0.3, height, length, width / 2 + 0.15, height / 2, 0);
  box('wall-north', width, height, 0.3, 0, height / 2, length / 2 + 0.15);
  box('wall-south', width, height, 0.3, 0, height / 2, -length / 2 - 0.15);
  box('sill', 0.3, 0.9, length, -width / 2 - 0.15, 0.45, 0);
  box('lintel', 0.3, 1.1, length, -width / 2 - 0.15, height - 0.55, 0);
  for (let z = -length / 2; z <= length / 2 + 0.01; z += 4) box('post', 0.3, height, 0.6, -width / 2 - 0.15, height / 2, z);
  const walls = Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  walls.name = 'walls';
  walls.material = wall;
  walls.isPickable = false;
  walls.freezeWorldMatrix();

  // Ceiling, with dark baseboards along the walls.
  const ceiling = MeshBuilder.CreatePlane('ceiling', { width, height: length, sideOrientation: Mesh.DOUBLESIDE }, scene);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  ceiling.material = flat(scene, 'ceiling', '#f3f0ea', { emissive: 0.45 });
  ceiling.isPickable = false;
  const base = [];
  for (const [w, d, x, z] of [[0.04, length, width / 2 - 0.02, 0], [width, 0.04, 0, length / 2 - 0.02], [width, 0.04, 0, -length / 2 + 0.02]]) {
    const b = MeshBuilder.CreateBox('base', { width: w, height: 0.12, depth: d }, scene);
    b.position.set(x, 0.06, z);
    base.push(b);
  }
  const baseboards = Mesh.MergeMeshes(base, true);
  baseboards.material = flat(scene, 'baseboard', '#4a4640', { emissive: 0.1 });
  baseboards.isPickable = false;
}

/** Tall windows full of soft daylight (bright panes; no view through them). */
function windows(scene) {
  const { width, length, height } = HALL;
  // A pale sky, brightest low down, as through frosted glass.
  const tex = new DynamicTexture('pane', { width: 4, height: 128 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#b9d3e8');
  g.addColorStop(0.65, '#e3edf3');
  g.addColorStop(1, '#f6f7f2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  tex.update();
  const pane = new StandardMaterial('pane', scene);
  pane.disableLighting = true;
  pane.emissiveTexture = tex;
  pane.emissiveColor = new Color3(1.2, 1.2, 1.2);
  const panes = [];
  for (let z = -length / 2 + 2; z < length / 2; z += 4) {
    const p = MeshBuilder.CreatePlane('pane', { width: 3.4, height: height - 2 }, scene);
    p.position.set(-width / 2 - 0.05, 0.9 + (height - 2) / 2, z);
    p.rotation.y = -Math.PI / 2;
    panes.push(p);
  }
  const all = Mesh.MergeMeshes(panes, true);
  all.material = pane;
  all.isPickable = false;
}

/** Long skylights down the middle of the ceiling. */
function skylights(scene) {
  const mat = new StandardMaterial('skylight', scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString('#fbfbf8');
  const strips = [];
  for (const x of [-3, 3]) {
    const s = MeshBuilder.CreatePlane('skylight', { width: 1.6, height: HALL.length - 4 }, scene);
    s.rotation.x = Math.PI / 2;
    s.position.set(x, HALL.height - 0.01, 0);
    strips.push(s);
  }
  const all = Mesh.MergeMeshes(strips, true);
  all.material = mat;
  all.isPickable = false;
}

/** The gallery's title on the far wall, ahead of the skeletons. */
function title(scene) {
  const w = 2048;
  const h = 512;
  const tex = new DynamicTexture('title', { width: w, height: h }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2f2c28';
  ctx.textAlign = 'center';
  ctx.font = 'italic 600 190px Georgia, "Times New Roman", serif';
  ctx.fillText('Orcinus orca', w / 2, 250);
  ctx.font = '500 78px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#6a645b';
  ctx.fillText('KILLER WHALE  ·  THE LARGEST DOLPHIN', w / 2, 400);
  tex.update();
  tex.hasAlpha = true;
  const mat = new StandardMaterial('title', scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
  mat.specularColor = Color3.Black();
  const plane = MeshBuilder.CreatePlane('title', { width: 7, height: 1.75 }, scene);
  plane.position.set(0, 4.6, HALL.length / 2 - 0.01);
  plane.material = mat;
  plane.isPickable = false;
}

/** A low dark platform a skeleton stands over; people can step up onto its edge. */
function platform(scene, name, x, z, width, depth) {
  const p = MeshBuilder.CreateBox(name, { width, height: 0.12, depth }, scene);
  p.position.set(x, 0.06, z);
  p.material = flat(scene, `${name}-mat`, '#3b3a38', { emissive: 0.05, specular: 0.08 });
  p.receiveShadows = true;
  p.isPickable = false;
  p.freezeWorldMatrix();
  return p;
}
