// Columbia, from the Smithsonian's scans (CC0): the hull, couches, panels and the graffiti
// layer inside, and the scorched shell outside, at real size. Each stop gets a glowing marker;
// pointing at one (or the Moon's Tranquility marker) explains it.
import {
  Color3,
  DracoDecoder,
  DynamicTexture,
  LoadAssetContainerAsync,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { faceViewer } from '@vrtor/xr-shell';
import '@babylonjs/loaders/glTF';

const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

const MODELS = `${BASE}models/`;
const SCANS = [
  { file: 'interior-hull.glb', part: 'interior' },
  { file: 'interior-seats.glb', part: 'interior' },
  { file: 'interior-panel.glb', part: 'interior' },
  { file: 'interior-graffiti.glb', part: 'interior' },
  { file: 'exterior-shell.glb', part: 'exterior' },
  { file: 'exterior-top.glb', part: 'exterior' },
];
/** The exterior scan sits 9.5 cm higher than the interior's frame (fitted: the cabin fills the shell evenly). */
const EXTERIOR_OFFSET_CM = 9.5;
/**
 * The crew lay facing the main panel, which faces down the capsule's axis at ~17 degrees. Columbia is
 * tipped so that line of sight is level: a standing visitor faces the panel as the crew did, with the
 * Moon below. (In orbit there is no up; the crew often flew it like this, heads away from the Moon.)
 */
const TIP = Math.atan2(-0.956, 0.29);
/**
 * And turned so the hatch window faces Earth, which hung about 51 degrees up in the west (+Z) when Eagle
 * landed (space.js); the low morning Sun in the east lights Columbia from the side.
 */
const TURN = Math.PI + (92.1 * Math.PI) / 180;
const ACCENT = Color3.FromHexString('#ffb020');
/** The middle of the cabin, in the scan's frame: it ends up at the world origin. */
const MIDDLE = [0, 150, 0];

export async function loadCapsule(scene, stopsData, { onProgress } = {}) {
  const capsule = new TransformNode('columbia', scene);
  capsule.scaling.setAll(0.01);
  capsule.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), TURN).multiply(Quaternion.RotationAxis(Vector3.Right(), TIP));

  const loaded = new Array(SCANS.length).fill(0);
  const report = () => onProgress?.(loaded.reduce((a, b) => a + b, 0) / SCANS.length);
  const containers = await Promise.all(
    SCANS.map((scan, i) =>
      LoadAssetContainerAsync(`${MODELS}${scan.file}`, scene, {
        onProgress: (e) => {
          if (!e.lengthComputable) return;
          loaded[i] = e.loaded / e.total;
          report();
        },
      }),
    ),
  );

  const meshes = { interior: [], exterior: [] };
  containers.forEach((container, i) => {
    const { part } = SCANS[i];
    container.addAllToScene();
    const root = container.meshes[0];
    root.parent = capsule;
    if (part === 'exterior') root.position.y += EXTERIOR_OFFSET_CM;
    for (const m of container.meshes) {
      if (!m.getTotalVertices()) continue;
      m.isPickable = true;
      meshes[part].push(m);
    }
    for (const mat of container.materials) {
      if (!(mat instanceof PBRMaterial)) continue;
      if (part === 'interior') {
        // The scan's photographs already hold the cabin's light: show them as they are.
        mat.unlit = true;
      } else {
        mat.metallic = 0;
        mat.roughness = 0.88;
      }
    }
  });

  // Centre the cabin on the origin.
  capsule.computeWorldMatrix(true);
  const middle = toWorld(capsule, MIDDLE);
  capsule.position.subtractInPlace(middle);
  capsule.computeWorldMatrix(true);
  for (const m of [...meshes.interior, ...meshes.exterior]) {
    m.computeWorldMatrix(true);
    m.freezeWorldMatrix();
  }

  const world = (p, scan) => toWorld(capsule, scan === 'exterior' || scan === 'hatch' ? [p[0], p[1] + EXTERIOR_OFFSET_CM, p[2]] : p);
  const markerTex = markerTexture(scene);
  const stops = stopsData.map((data) => {
    const at = world(data.at, data.scan);
    let eye;
    if (data.eye) {
      eye = world(data.eye, data.scan);
    } else {
      // A direction in the scan's frame, or `world` for one fixed in space (for the views with the Moon).
      const dir = data.from.world ? new Vector3(...data.from.world).normalize() : toWorldDirection(capsule, data.from.dir);
      eye = at.add(dir.scale(data.from.distance / 100));
    }
    let marker = null;
    if ((data.place === 'inside' || data.scan) && data.marker !== false) {
      // Lifted off the surface toward the viewer, so the wall can't swallow it.
      const lift = Math.min(0.03, Vector3.Distance(eye, at) * 0.1);
      const size = data.place === 'inside' ? 0.03 : 0.16;
      marker = MeshBuilder.CreatePlane(`marker-${data.id}`, { size }, scene);
      marker.position.copyFrom(at.add(eye.subtract(at).normalize().scale(lift)));
      faceViewer(marker);
      const mat = new StandardMaterial(`marker-${data.id}`, scene);
      mat.disableLighting = true;
      mat.emissiveTexture = markerTex;
      mat.opacityTexture = markerTex;
      mat.backFaceCulling = false;
      marker.material = mat;
      marker.metadata = { stop: data.id };
    }
    return { ...data, at, eye, marker };
  });

  let t = 0;
  let hovered = null;
  let selected = null;
  scene.onBeforeRenderObservable.add(() => {
    t += scene.getEngine().getDeltaTime() / 1000;
    stops.forEach((s, i) => {
      if (!s.marker) return;
      const boost = s === selected ? 1.35 : s === hovered ? 1.25 : 1;
      s.marker.scaling.setAll(boost * (1 + 0.12 * Math.sin(t * 3 + i)));
    });
  });

  return {
    root: capsule,
    meshes,
    stops,
    /** The world-space middle of the cabin. */
    center: Vector3.Zero(),
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
  };
}

/** A point in the scan's frame (cm, glTF axes) to world space. The glTF loader mirrors X into Babylon's frame. */
function toWorld(capsule, p) {
  return Vector3.TransformCoordinates(new Vector3(-p[0], p[1], p[2]), capsule.getWorldMatrix());
}

function toWorldDirection(capsule, d) {
  return Vector3.TransformNormal(new Vector3(-d[0], d[1], d[2]), capsule.getWorldMatrix()).normalize();
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
