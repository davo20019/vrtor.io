// NASA's Perseverance at real size, with each tour part clickable: point at
// the part itself or at its glowing marker.
import {
  Color3,
  DracoDecoder,
  DynamicTexture,
  LoadAssetContainerAsync,
  Matrix,
  Quaternion,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { faceViewer } from '@vrtor/xr-shell';
import '@babylonjs/loaders/glTF';

const BASE = import.meta.env.BASE_URL;
// The Draco decoder is served from this app, not a third-party CDN.
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

const ROVER_URL = '/assets/space/perseverance.glb';
const ROVER_LENGTH_M = 3;
const ACCENT = Color3.FromHexString('#ffb020');
/** How far the viewer stands from a part's marker when the tour takes them there. */
const VIEW_DISTANCE = 1.9;

export async function loadRover(scene, parts, { shadows, onProgress } = {}) {
  const container = await LoadAssetContainerAsync(ROVER_URL, scene, {
    onProgress: (e) => e.lengthComputable && onProgress?.(e.loaded / e.total),
  });
  container.addAllToScene();
  const root = container.meshes[0];

  // Real size, wheels on the ground, centered.
  const sizeOf = () => {
    const { min, max } = root.getHierarchyBoundingVectors(true);
    return { min, max, size: max.subtract(min) };
  };
  let { size } = sizeOf();
  root.scaling.scaleInPlace(ROVER_LENGTH_M / Math.max(size.x, size.z));
  const { min, max } = sizeOf();
  root.position.subtractInPlace(new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2));
  // Parents before children, so every part's world box is measured where it really is.
  const refresh = (node) => {
    node.computeWorldMatrix(true);
    node.getChildren().forEach(refresh);
  };
  refresh(root);
  deployMast(scene, refresh);
  refresh(root);

  const meshes = container.meshes.filter((m) => m.getTotalVertices() > 0);
  for (const m of meshes) {
    m.isPickable = true;
    m.receiveShadows = false;
    shadows?.addShadowCaster(m, false);
  }
  for (const mat of container.materials) {
    if (!(mat instanceof PBRMaterial)) continue;
    // Refraction renders the whole scene again into a texture each frame: far too much for a headset.
    if (mat.subSurface?.isRefractionEnabled) {
      mat.subSurface.isRefractionEnabled = false;
      mat.alpha = 0.35;
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    }
  }
  // The rover never moves: skip recomputing its matrices every frame.
  meshes.forEach((m) => m.freezeWorldMatrix());

  // Which tour part each mesh belongs to: its nearest ancestor listed in a part's nodes.
  const partByNode = new Map();
  parts.forEach((p) => p.nodes.forEach((n) => partByNode.set(n, p)));
  const partOf = (node) => {
    for (let n = node; n; n = n.parent) {
      const p = partByNode.get(n.name) ?? partByNode.get(n.name.replace(/_primitive\d+$/, ''));
      if (p) return p;
    }
    return null;
  };
  const meshesOf = new Map(parts.map((p) => [p, []]));
  for (const m of meshes) {
    const p = partOf(m);
    if (p) meshesOf.get(p).push(m);
  }

  const { min: rmin, max: rmax } = sizeOf();
  const center = rmin.add(rmax).scale(0.5);
  const markerTex = markerTexture(scene);
  const stops = [];
  for (const part of parts) {
    const group = meshesOf.get(part);
    if (!group.length) {
      console.warn(`[spc] no meshes for part ${part.id}`);
      continue;
    }
    // The part's box, pushed outward from the rover's middle so the marker floats beside it.
    let pmin = new Vector3(Infinity, Infinity, Infinity);
    let pmax = pmin.scale(-1);
    for (const m of group) {
      const bb = m.getBoundingInfo().boundingBox;
      pmin = Vector3.Minimize(pmin, bb.minimumWorld);
      pmax = Vector3.Maximize(pmax, bb.maximumWorld);
    }
    const pc = pmin.add(pmax).scale(0.5);
    const out = new Vector3(pc.x - center.x, 0, pc.z - center.z);
    if (out.lengthSquared() < 0.04) out.set(0.6, 0, 0.8); // dead center (the mast): pick a side
    out.normalize();
    const reach = Math.max(Math.abs(out.x) * (pmax.x - pmin.x), Math.abs(out.z) * (pmax.z - pmin.z)) / 2;
    const at = pc.add(out.scale(reach + 0.14));
    if (part.lift) at.y += part.lift;

    const marker = MeshBuilder.CreatePlane(`marker-${part.id}`, { size: 0.12 }, scene);
    marker.position.copyFrom(at);
    faceViewer(marker);
    const mat = new StandardMaterial(`marker-${part.id}`, scene);
    mat.disableLighting = true;
    mat.emissiveTexture = markerTex;
    mat.opacityTexture = markerTex;
    mat.backFaceCulling = false;
    marker.material = mat;
    marker.applyFog = false;
    marker.metadata = { part };

    // Where to stand: out along the same line, on the floor, looking at the part.
    const stand = new Vector3(center.x, 0, center.z).add(out.scale(Math.hypot(at.x - center.x, at.z - center.z) + VIEW_DISTANCE));
    stops.push({ part, marker, meshes: group, at, stand });
  }

  // Markers pulse gently so they read as something to press.
  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    t += scene.getEngine().getDeltaTime() / 1000;
    stops.forEach((s, i) => s.marker.scaling.setAll(1 + 0.12 * Math.sin(t * 3 + i)));
  });

  const stopFor = (mesh) => {
    if (!mesh) return null;
    if (mesh.metadata?.part) return stops.find((s) => s.part === mesh.metadata.part) ?? null;
    const p = partOf(mesh);
    return p ? stops.find((s) => s.part === p) ?? null : null;
  };

  // Hover and selection tint the part's own meshes.
  let hovered = null;
  let selected = null;
  const paint = (stop, alpha) => stop?.meshes.forEach((m) => {
    m.renderOverlay = alpha > 0;
    m.overlayColor = ACCENT;
    m.overlayAlpha = alpha;
  });
  const repaint = () => {
    stops.forEach((s) => paint(s, s === selected ? 0.38 : s === hovered ? 0.22 : 0));
  };

  return {
    root,
    center,
    stops,
    stopFor,
    hover(stop) {
      if (stop === hovered) return;
      hovered = stop;
      repaint();
    },
    select(stop) {
      selected = stop;
      repaint();
    },
  };
}

// NASA's model has the remote sensing mast folded flat on the deck, as it flew
// to Mars. Stand it up, and turn the head to look forward, as it is on the surface.
function deployMast(scene, refresh) {
  const mast = scene.getTransformNodeByName('Cylinder') ?? scene.getMeshByName('Cylinder');
  const pan = scene.getTransformNodeByName('top') ?? scene.getMeshByName('top');
  const head = scene.getTransformNodeByName('head') ?? scene.getMeshByName('head');
  const lens = scene.getTransformNodeByName('lens') ?? scene.getMeshByName('lens');
  if (!mast || !pan || !head || !lens) return;

  // Raise it about its base: a quarter turn that swings the head from the deck straight up.
  const base = mast.getAbsolutePosition().clone();
  const along = head.getAbsolutePosition().subtract(base);
  along.y = 0;
  const axis = Vector3.Cross(along.normalize(), Vector3.Up()).normalize();
  rotateInWorld(mast, base, axis, Math.PI / 2);
  refresh(mast);

  // Pan the head about the mast's vertical axis until SuperCam's lens faces the front (+Z, the arm's side).
  const pivot = pan.getAbsolutePosition().clone();
  const facing = lens.getAbsolutePosition().subtract(head.getAbsolutePosition());
  const yaw = Math.atan2(facing.x, facing.z);
  rotateInWorld(pan, pivot, Vector3.Up(), -yaw);
}

/** Rotates `node` by `angle` about a world-space `axis` through world point `pivot`, whatever its parents' scale. */
function rotateInWorld(node, pivot, axis, angle) {
  const world = node.computeWorldMatrix(true).clone();
  const turn = Matrix.Translation(-pivot.x, -pivot.y, -pivot.z)
    .multiply(Matrix.RotationAxis(axis, angle))
    .multiply(Matrix.Translation(pivot.x, pivot.y, pivot.z));
  const parentWorld = node.parent ? node.parent.computeWorldMatrix(true) : Matrix.Identity();
  const local = world.multiply(turn).multiply(Matrix.Invert(parentWorld));
  const scaling = new Vector3();
  const rotation = new Quaternion();
  const position = new Vector3();
  local.decompose(scaling, rotation, position);
  node.scaling.copyFrom(scaling);
  node.rotationQuaternion = rotation;
  node.position.copyFrom(position);
}

function markerTexture(scene) {
  const tex = new DynamicTexture('marker', 128, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffb020';
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
