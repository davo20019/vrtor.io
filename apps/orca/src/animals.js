// The two skeletons from the University of Pisa's scans (CC BY-SA 4.0; scripts/prepare-orca.py),
// each held up on steel rods over a low platform, with the orca's body ready to wrap around it
// (body.js). Each tour stop gets a glowing marker on the bone it describes.
import {
  Color3,
  DracoDecoder,
  DynamicTexture,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { buildBody } from './body.js';

const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

const ACCENT = Color3.FromHexString('#ffb020');
/**
 * Where each skeleton stands (its lowest bone this high off the floor), and the bones the rods
 * hold it up by (glTF frame: under the breastbone and under the backbone).
 */
export const MOUNTS = {
  orca: { position: new Vector3(0, 0.85, 0), rods: [[-0.099, 0.01, 1.441], [-0.042, 0.493, -1.911]] },
  dolphin: { position: new Vector3(3.4, 0.85, -1.8), rods: [[0.047, 0.202, 0.263], [-0.02, 0.43, -0.52]] },
};
/** How long the skin takes to fade in or out, in seconds. */
const FADE = 1.2;
/** The skin's opacity when you can see the bones through it. */
const SEE_THROUGH = 0.42;

export async function loadAnimals(scene, stopsData, { shadows, platform, onProgress } = {}) {
  const roots = {};
  const progress = { orca: 0, dolphin: 0 };
  const weights = { orca: 0.76, dolphin: 0.24 };
  const report = () => onProgress?.(progress.orca * weights.orca + progress.dolphin * weights.dolphin);
  const [shape] = await Promise.all([
    fetch(`${BASE}models/orca-shape.json`).then((r) => r.json()),
    ...Object.keys(MOUNTS).map(async (name) => {
      const root = new TransformNode(name, scene);
      root.position.copyFrom(MOUNTS[name].position);
      roots[name] = root;
      const container = await LoadAssetContainerAsync(`${BASE}models/${name}.glb`, scene, {
        onProgress: (e) => {
          if (!e.lengthComputable) return;
          progress[name] = e.loaded / e.total;
          report();
        },
      });
      container.addAllToScene();
      container.meshes[0].parent = root;
      for (const m of container.meshes) {
        if (!m.getTotalVertices()) continue;
        m.isPickable = false;
        m.receiveShadows = true;
        shadows?.addShadowCaster(m);
        m.freezeWorldMatrix();
      }
      for (const mat of container.materials) {
        // A touch of sheen on old, handled bone.
        mat.metallic = 0;
        mat.roughness = 0.62;
      }
      root.metadata = { meshes: container.meshes.filter((m) => m.getTotalVertices() > 0) };
    }),
  ]);

  // Steel rods from the platform up to the bone, and the platforms.
  const steel = new StandardMaterial('steel', scene);
  steel.diffuseColor = Color3.FromHexString('#2b2d30');
  steel.specularColor = new Color3(0.5, 0.5, 0.5);
  for (const [name, mount] of Object.entries(MOUNTS)) {
    for (const [x, y, z] of mount.rods) {
      const top = mount.position.y + y + 0.02;
      const rod = MeshBuilder.CreateCylinder(`${name}-rod`, { diameter: 0.045, height: top, tessellation: 12 }, scene);
      rod.position.set(mount.position.x - x, top / 2, mount.position.z + z);
      rod.material = steel;
      rod.isPickable = false;
      shadows?.addShadowCaster(rod);
    }
  }
  platform?.('orca-platform', MOUNTS.orca.position.x - 0.1, MOUNTS.orca.position.z, 2.6, 7.6);
  platform?.('dolphin-platform', MOUNTS.dolphin.position.x, MOUNTS.dolphin.position.z, 1.3, 3.2);

  // The orca's skin, hidden until asked for.
  const skin = buildBody(scene, shape);
  skin.parent = roots.orca;
  shadows?.addShadowCaster(skin);
  skin.setEnabled(false);
  skin.visibility = 0;

  // Stops: positions in each skeleton's glTF frame; the loader mirrors X into Babylon's frame.
  const local = (p) => new Vector3(-p[0], p[1], p[2]);
  const markerTex = markerTexture(scene);
  const stops = stopsData.map((data) => {
    const root = roots[data.animal ?? 'orca'];
    root.computeWorldMatrix(true);
    const world = (p) => Vector3.TransformCoordinates(local(p), root.getWorldMatrix());
    const at = world(data.at);
    const eye = world(data.eye);
    const look = data.look ? world(data.look) : at;
    let marker = null;
    if (data.marker !== false) {
      marker = MeshBuilder.CreatePlane(`marker-${data.id}`, { size: 0.12 }, scene);
      marker.parent = root;
      // Lifted a little toward the viewer, so the bone can't swallow it.
      const lift = eye.subtract(at).normalize().scale(0.05);
      marker.position.copyFrom(local(data.at).add(lift));
      marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const mat = new StandardMaterial(`marker-${data.id}`, scene);
      mat.disableLighting = true;
      mat.emissiveTexture = markerTex;
      mat.opacityTexture = markerTex;
      mat.backFaceCulling = false;
      marker.material = mat;
      // Drawn after the see-through skin, so markers stay visible inside it.
      marker.renderingGroupId = 1;
      marker.metadata = { stop: data.id };
    }
    return { ...data, at, eye, look, marker };
  });

  let t = 0;
  let hovered = null;
  let selected = null;
  /** The skin's opacity now, and where it's heading. */
  let skinNow = 0;
  let skinGoal = 0;
  let onSkinSettled = null;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    t += dt;
    stops.forEach((s, i) => {
      if (!s.marker) return;
      const boost = s === selected ? 1.35 : s === hovered ? 1.25 : 1;
      s.marker.scaling.setAll(boost * (1 + 0.12 * Math.sin(t * 3 + i)));
    });
    if (skinNow === skinGoal) return;
    const step = dt / FADE;
    skinNow = skinGoal > skinNow ? Math.min(skinGoal, skinNow + step) : Math.max(skinGoal, skinNow - step);
    applySkin();
    if (skinNow === skinGoal) {
      onSkinSettled?.();
      onSkinSettled = null;
    }
  });

  function applySkin() {
    skin.setEnabled(skinNow > 0);
    skin.visibility = skinNow;
    // Fully solid: the bones can't be seen, so skip drawing them.
    for (const m of roots.orca.metadata.meshes) m.setEnabled(skinNow < 1);
  }

  return {
    roots,
    stops,
    skin,
    stopFor(mesh) {
      const id = mesh?.metadata?.stop;
      return id ? stops.find((s) => s.id === id) ?? null : null;
    },
    hover(stop) {
      hovered = stop;
    },
    select(stop) {
      selected = stop;
    },
    /** 'bones', 'see-through' or 'solid'. */
    get skinMode() {
      return skinGoal === 0 ? 'bones' : skinGoal < 1 ? 'see-through' : 'solid';
    },
    /** Fades the skin to `mode`; `done` runs when it gets there. */
    setSkin(mode, done) {
      skinGoal = mode === 'solid' ? 1 : mode === 'see-through' ? SEE_THROUGH : 0;
      onSkinSettled = done ?? null;
      if (skinNow === skinGoal) onSkinSettled?.();
    },
  };
}

function markerTexture(scene) {
  const tex = new DynamicTexture('marker', 128, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = ACCENT.toHexString();
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 22, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  return tex;
}
