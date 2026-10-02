// The 1903 Wright Flyer from the Smithsonian's scan (CC0), colored by what each piece is made of
// (scripts/prepare-flyer.py), standing on its dolly at the south end of the launch rail. Each tour
// stop gets a glowing marker; `fly()` replays the first flight.
import {
  Color3,
  DracoDecoder,
  DynamicTexture,
  LoadAssetContainerAsync,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Space,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { faceViewer } from '@vrtor/xr-shell';
import '@babylonjs/loaders/glTF';
import { RAIL, heightAt } from './world.js';

const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

const ACCENT = Color3.FromHexString('#ffb020');
/** The scan's lowest point (the skids), metres below its origin. */
const LOWEST = 0.9615;
/** Resting on the dolly, which rides on top of the rail. */
const REST = new Vector3(0, RAIL.height + LOWEST, 0);

/**
 * The first flight, December 17, 1903, about 10:35 am, Orville at the controls: a run of about
 * 40 ft (12 m) down the rail into a stiff wind, then 12 seconds in the air, covering 120 ft
 * (36.6 m) over the ground, rising and dipping, before it settled onto its skids.
 */
const RUN = { start: 1.5, end: 6, distance: 12 };
const AIR = { end: 18, distance: 36.6, height: 3 };
const SLIDE = { end: 19.5, distance: 1.2 };
const SPIN_DOWN = 1.2;
const RESET = 24;
/** Propeller turns per second as drawn (the real ones ran at about 350 rpm). */
const SPIN = 5;

export async function loadFlyer(scene, stopsData, { shadows, onProgress } = {}) {
  const root = new TransformNode('flyer', scene);
  root.position.copyFrom(REST);
  root.rotationQuaternion = Quaternion.Identity();

  const container = await LoadAssetContainerAsync(`${BASE}models/flyer.glb`, scene, {
    onProgress: (e) => e.lengthComputable && onProgress?.(e.loaded / e.total),
  });
  container.addAllToScene();
  container.meshes[0].parent = root;
  const meshes = container.meshes.filter((m) => m.getTotalVertices() > 0);
  for (const m of meshes) {
    m.isPickable = false;
    shadows?.addShadowCaster(m);
    m.receiveShadows = true;
  }
  for (const mat of container.materials) {
    if (!(mat instanceof PBRMaterial)) continue;
    // Thin wires and fabric seen from either side.
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;
  }
  const propellers = ['propeller-left', 'propeller-right'].map((name) => meshes.find((m) => m.name === name)).filter(Boolean);

  // Stops: positions in the scan's frame (cm, glTF axes). The loader mirrors X into Babylon's frame.
  root.computeWorldMatrix(true);
  const local = (p) => new Vector3(-p[0] / 100, p[1] / 100, p[2] / 100);
  const world = (p) => Vector3.TransformCoordinates(local(p), root.getWorldMatrix());
  const markerTex = markerTexture(scene);
  const stops = stopsData.map((data) => {
    const at = world(data.at);
    const eye = world(data.eye);
    const look = data.look ? world(data.look) : at;
    let marker = null;
    if (data.marker !== false) {
      marker = MeshBuilder.CreatePlane(`marker-${data.id}`, { size: 0.16 }, scene);
      marker.parent = root;
      // Lifted a little toward the viewer, so the part can't swallow it.
      const lift = eye.subtract(at).normalize().scale(0.06);
      marker.position.copyFrom(local(data.at).add(lift));
      faceViewer(marker);
      const mat = new StandardMaterial(`marker-${data.id}`, scene);
      mat.disableLighting = true;
      mat.emissiveTexture = markerTex;
      mat.opacityTexture = markerTex;
      mat.backFaceCulling = false;
      marker.material = mat;
      marker.metadata = { stop: data.id };
    }
    return { ...data, at, eye, look, marker };
  });

  let t = 0;
  let hovered = null;
  let selected = null;
  /** Seconds into the replay, or -1 when the Flyer is resting on the rail. */
  let clock = -1;
  let onLanded = null;
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    t += dt;
    stops.forEach((s, i) => {
      if (!s.marker) return;
      const boost = s === selected ? 1.35 : s === hovered ? 1.25 : 1;
      s.marker.scaling.setAll(boost * (1 + 0.12 * Math.sin(t * 3 + i)));
    });
    if (clock < 0) return;
    clock += Math.min(dt, 0.1);
    pose(clock);
    const spin = SPIN * spinFactor(clock) * Math.PI * 2 * Math.min(dt, 0.1);
    // The chains turned the two propellers in opposite directions.
    propellers.forEach((p, i) => p.rotate(Vector3.Forward(), i === 0 ? spin : -spin, Space.LOCAL));
    if (clock >= RESET) {
      clock = -1;
      pose(0);
      showMarkers(true);
      onLanded?.();
    }
  });

  function showMarkers(on) {
    for (const s of stops) if (s.marker) s.marker.setEnabled(on);
  }

  /** Where the Flyer is `time` seconds into the replay. */
  function pose(time) {
    let z = 0;
    let lift = 0;
    let pitch = 0;
    let roll = 0;
    let onSand = false;
    if (time > RUN.start && time <= RUN.end) {
      const u = (time - RUN.start) / (RUN.end - RUN.start);
      z = RUN.distance * Math.pow(u, 1.35);
    } else if (time > RUN.end && time <= AIR.end) {
      const s = (time - RUN.end) / (AIR.end - RUN.end);
      z = RUN.distance + AIR.distance * s;
      // Up and down, as Orville described it: the elevator was touchy and the air gusty.
      const arc = Math.pow(Math.sin(Math.PI * s), 0.7);
      lift = AIR.height * arc + 0.6 * Math.sin(Math.PI * 2 * 2.2 * s) * Math.sin(Math.PI * s);
      const ahead = Math.min(1, s + 0.01);
      const liftAhead = AIR.height * Math.pow(Math.sin(Math.PI * ahead), 0.7) + 0.6 * Math.sin(Math.PI * 2 * 2.2 * ahead) * Math.sin(Math.PI * ahead);
      // Nose follows the path, within a few degrees: it never climbed steeply.
      pitch = Math.max(-0.12, Math.min(0.14, Math.atan2(liftAhead - lift, AIR.distance * 0.01) * 0.6));
      roll = 0.05 * Math.sin(Math.PI * 2 * 1.3 * s) * Math.sin(Math.PI * s);
    } else if (time > AIR.end) {
      const s = Math.min(1, (time - AIR.end) / (SLIDE.end - AIR.end));
      z = RUN.distance + AIR.distance + SLIDE.distance * (1 - (1 - s) * (1 - s));
      onSand = true;
    }
    root.position.set(0, REST.y + lift, z);
    if (onSand || time > RUN.end) {
      // Off the end of the rail, the skids are what touch: on the sand once it's down.
      const sand = heightAt(0, z) + LOWEST;
      if (onSand) root.position.y = sand;
      else root.position.y = Math.max(sand, REST.y) + lift;
    }
    Quaternion.FromEulerAnglesToRef(-pitch, 0, roll, root.rotationQuaternion);
  }

  function spinFactor(time) {
    if (time < RUN.start) return time / RUN.start;
    if (time < AIR.end) return 1;
    return Math.max(0, 1 - (time - AIR.end) / SPIN_DOWN);
  }

  return {
    root,
    meshes,
    stops,
    propellers,
    /** The middle of the Flyer at rest. */
    center: world([0, 20, 0]),
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
    get flying() {
      return clock >= 0;
    },
    /** Replays the first flight; `done` runs once it's back on the rail. */
    fly(done) {
      if (clock >= 0) return;
      clock = 0;
      onLanded = done;
      showMarkers(false);
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
