import {
  Color3,
  Color4,
  DirectionalLight,
  DracoDecoder,
  DynamicTexture,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};
export const TERRACE_Y = 5.93;
export const V = (x, y, z) => new Vector3(x, y, z);
export const VIEWS = [
  { stand: V(0, 0, -105), at: V(0, 22, 0) },
  { stand: V(0, TERRACE_Y, -36), at: V(0, 16, -22) },
  { stand: V(-35, TERRACE_Y, -32), at: V(-43, 25, -43) },
  { stand: V(5.5, 0, -85), at: V(0, 37, 0) },
];

export async function buildWorld(engine, onProgress) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.69, 0.8, 0.88, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.00085;
  scene.fogColor = Color3.FromHexString("#c4d4dc");
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 0.95;
  const anisotropy = Math.min(16, engine.getCaps().maxAnisotropy || 4);
  scene.onNewTextureAddedObservable.add(
    (t) => (t.anisotropicFilteringLevel = anisotropy),
  );
  scene.onNewMeshAddedObservable.add((m) => {
    if (m.name !== "sky") m.renderingGroupId = 1;
  });
  const sky = MeshBuilder.CreateSphere(
    "sky",
    { diameter: 2000, segments: 24, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  const skyTex = new DynamicTexture(
    "sky-gradient",
    { width: 4, height: 512 },
    scene,
    false,
  );
  const ctx = skyTex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#527fa4");
  grad.addColorStop(0.38, "#9dc4dd");
  grad.addColorStop(0.5, "#c9deea");
  grad.addColorStop(1, "#b2c1ae");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  skyTex.update();
  skyTex.wrapU = skyTex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const skyMat = new StandardMaterial("sky", scene);
  skyMat.disableLighting = true;
  skyMat.emissiveTexture = skyTex;
  skyMat.backFaceCulling = false;
  sky.material = skyMat;
  sky.isPickable = false;
  sky.infiniteDistance = true;
  sky.applyFog = false;
  sky.renderingGroupId = 0;
  const probe = new ReflectionProbe("daylight", 128, scene);
  probe.renderList = [sky];
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  scene.environmentTexture = probe.cubeTexture;
  scene.environmentIntensity = 0.4;
  const hemi = new HemisphericLight("sky-light", V(0, 1, 0), scene);
  hemi.intensity = 0.3;
  hemi.groundColor = Color3.FromHexString("#99896f");
  const sun = new DirectionalLight(
    "sun",
    V(-0.65, -1, 0.35).normalize(),
    scene,
  );
  sun.position = V(100, 140, -70);
  sun.intensity = 1.9;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0004;
  shadows.normalBias = 0.04;
  const shadowMap = shadows.getShadowMap();
  shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  const stone = material("courtyard", "#baa58b", scene);
  const ground = MeshBuilder.CreateGround(
    "garden-court",
    { width: 240, height: 340 },
    scene,
  );
  ground.position.z = -60;
  ground.material = stone;
  ground.receiveShadows = true;
  ground.isPickable = false;
  const lawnMat = material("garden-green", "#536c36", scene);
  for (const x of [-44, 44])
    for (const z of [-91, -149]) {
      const lawn = MeshBuilder.CreateBox(
        "garden-bed",
        { width: 66, height: 0.16, depth: 48 },
        scene,
      );
      lawn.position = V(x, 0.08, z);
      lawn.material = lawnMat;
      lawn.isPickable = false;
      lawn.receiveShadows = true;
      lawn.freezeWorldMatrix();
    }
  const waterMat = new PBRMaterial("reflecting-water", scene);
  waterMat.albedoColor = Color3.FromHexString("#357776");
  waterMat.roughness = 0.2;
  waterMat.metallic = 0.1;
  const water = MeshBuilder.CreateBox(
    "reflecting-channel",
    { width: 7, height: 0.12, depth: 123 },
    scene,
  );
  water.position = V(0, 0.08, -115);
  water.material = waterMat;
  water.isPickable = false;
  water.freezeWorldMatrix();
  // Repeated garden trees share their mesh and material: few draw calls in stereo.
  const treeMat = material("cypress", "#294e33", scene);
  const tree = MeshBuilder.CreateLathe(
    "cypress",
    {
      shape: [
        V(0.2, 0, 0),
        V(0.65, 0.6, 0),
        V(0.9, 1.8, 0),
        V(0.92, 3, 0),
        V(0.8, 4.5, 0),
        V(0.65, 6, 0),
        V(0.4, 7.5, 0),
        V(0, 9, 0),
      ],
      tessellation: 16,
    },
    scene,
  );
  tree.material = treeMat;
  tree.position = V(-17, 0.4, -62);
  tree.isPickable = false;
  for (let side of [-1, 1])
    for (let i = 0; i < 10; i++) {
      if (side === -1 && i === 0) continue;
      const t = tree.createInstance(`cypress-${side}-${i}`);
      t.position = V(side * 17, 0.4, -62 - i * 12);
      t.isPickable = false;
      t.freezeWorldMatrix();
    }
  const container = await LoadAssetContainerAsync(
    `${BASE}models/taj-mahal.glb`,
    scene,
    {
      onProgress: (e) => e.lengthComputable && onProgress?.(e.loaded / e.total),
    },
  );
  container.addAllToScene();
  const monument = container.meshes.filter((m) => m.getTotalVertices() > 0);
  for (const m of container.materials) {
    if (!(m instanceof PBRMaterial)) continue;
    // Source materials are colored placeholders. Replace them with restrained ivory marble;
    // the architectural edges and moldings remain actual geometry, at their full triangle count.
    m.albedoColor = Color3.FromHexString(
      m.name === "Cuivre_verdi"
        ? "#b09c65"
        : m.name === "facade_2"
          ? "#d4cfc0"
          : "#e7e1d1",
    ).toLinearSpace();
    m.metallic = m.name === "Cuivre_verdi" ? 0.55 : 0;
    m.roughness = m.name === "Cuivre_verdi" ? 0.35 : 0.62;
    m.backFaceCulling = true;
  }
  for (const m of monument) {
    m.isPickable = false;
    m.receiveShadows = true;
    shadows.addShadowCaster(m, false);
    m.freezeWorldMatrix();
  }
  // Limit teleporting to the approach and open terrace strips; never into the tomb, pool or beds.
  const floors = [];
  const floor = (name, x, y, z, w, d) => {
    const m = MeshBuilder.CreateGround(name, { width: w, height: d }, scene);
    m.position = V(x, y, z);
    m.visibility = 0;
    m.isPickable = true;
    m.freezeWorldMatrix();
    floors.push(m);
  };
  floor("front-approach", 0, 0.02, -51, 86, 7);
  floor("left-garden-path", -5.5, 0.02, -118, 3, 126);
  floor("right-garden-path", 5.5, 0.02, -118, 3, 126);
  floor("garden-cross-path", 0, 0.02, -119, 150, 8);
  floor("terrace-front", 0, TERRACE_Y, -34, 76, 16);
  floor("terrace-back", 0, TERRACE_Y, 34, 76, 16);
  floor("terrace-left", -34, TERRACE_Y, 0, 16, 64);
  floor("terrace-right", 34, TERRACE_Y, 0, 16, 64);
  // The opening viewpoint stands on a path rather than in the water.
  VIEWS[0].stand.x = 5.5;
  const axis = MeshBuilder.CreateLines(
    "symmetry-axis",
    {
      points: [
        V(0, 0.22, -180),
        V(0, 0.22, -49),
        V(0, TERRACE_Y + 0.1, -48),
        V(0, TERRACE_Y + 0.1, -24),
        V(0, 54, 0),
      ],
    },
    scene,
  );
  axis.color = Color3.FromHexString("#ffc34a");
  axis.isPickable = false;
  axis.setEnabled(false);
  const rings = [];
  for (const x of [-43, 43]) {
    const ring = MeshBuilder.CreateTorus(
      "paired-minaret",
      { diameter: 5.8, thickness: 0.22, tessellation: 48 },
      scene,
    );
    ring.position = V(x, 12, -43);
    ring.material = material("study-gold", "#efb73e", scene, true);
    ring.isPickable = false;
    ring.setEnabled(false);
    rings.push(ring);
  }
  let light = 0;
  function daylight() {
    light = (light + 1) % 2;
    sun.direction = light
      ? V(0.85, -0.6, 0.4).normalize()
      : V(-0.65, -1, 0.35).normalize();
    sun.diffuse = Color3.FromHexString(light ? "#ffe1af" : "#fff8eb");
    sun.intensity = light ? 1.7 : 1.9;
    shadowMap.resetRefreshCounter();
    return light ? "Late afternoon" : "Morning";
  }
  return {
    scene,
    floors,
    monument,
    daylight,
    study(show) {
      axis.setEnabled(show);
      rings.forEach((m) => m.setEnabled(show));
    },
    triangleCount: monument.reduce((n, m) => n + m.getTotalIndices() / 3, 0),
  };
}
function material(name, hex, scene, emissive = false) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex).scale(0.65);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  if (emissive) m.emissiveColor = m.diffuseColor.scale(0.55);
  return m;
}
