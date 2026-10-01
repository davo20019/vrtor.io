// The headset side of every vrtor subject: WebXR session setup tuned for Quest
// (the same settings Acento ships), teleport and snap turn on the floor, a
// comfort fade, and moving the viewer for guided tours.
import { Color3, MeshBuilder, StandardMaterial, Vector3, WebXRState } from '@babylonjs/core';
import { FrameRateGovernor } from './frameRate.js';

/**
 * Eye-buffer resolution over the browser's default (1.0 is well under a
 * Quest 3's panels). 1.25x is the size Acento found works on a Quest 3.
 */
export const RESOLUTION_SCALE = 1.25;
/** Fixed foveation (0 off .. 1 strongest): light, so the edges stay sharp. `?fov=` overrides. */
export const FOVEATION = 0.25;
/** Refresh rate assumed when the session doesn't report one (Quest default). */
const DEFAULT_FRAME_RATE = 72;
const ACCENT = '#ffb020';

export async function xrSupported() {
  try {
    return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr'));
  } catch {
    return false;
  }
}

function foveationParam() {
  const raw = new URLSearchParams(location.search).get('fov');
  const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : FOVEATION;
}

/**
 * Sets up WebXR for `scene`. Returns null when the browser can't do immersive VR.
 * `floorMeshes` are where teleport can land; `start` is where the viewer
 * stands on entering ({ position: Vector3 on the floor, lookAt: Vector3 }).
 */
export async function createXr(scene, { floorMeshes = [], start = null } = {}) {
  if (!(await xrSupported())) return null;

  const xr = await scene.createDefaultXRExperienceAsync({
    disableDefaultUI: true,
    floorMeshes,
    optionalFeatures: true,
    outputCanvasOptions: { canvasOptions: { framebufferScaleFactor: RESOLUTION_SCALE } },
    // Both hands point and click. Otherwise a press with the other controller only switches to it.
    pointerSelectionOptions: { enablePointerSelectionOnAllControllers: true },
    teleportationOptions: {
      defaultTargetMeshOptions: { teleportationFillColor: ACCENT, teleportationBorderColor: '#ffffff' },
    },
  });
  const base = xr.baseExperience;
  const sessionManager = base.sessionManager;
  const camera = base.camera;
  const foveation = foveationParam();

  // Where the viewer stands when the session starts (their real height is kept).
  base.onInitialXRPoseSetObservable.add((cam) => {
    if (!start) return;
    cam.position.x = start.position.x;
    cam.position.z = start.position.z;
    cam.setTarget(start.lookAt);
  });

  // The display refresh: 90 Hz while the scene keeps up, down to 72 when it can't.
  let governor = new FrameRateGovernor(undefined);
  let lastFrameMs = 0;
  const requestFrameRate = (rate) => {
    if (rate === null || rate === sessionManager.currentFrameRate) return;
    sessionManager.updateTargetFrameRate(rate).catch(() => undefined);
  };
  sessionManager.onXRSessionInit.add(() => {
    lastFrameMs = 0;
    governor = new FrameRateGovernor(sessionManager.supportedFrameRates);
    governor.hold(2);
    requestFrameRate(governor.target);
  });
  sessionManager.onXRFrameObservable.add(() => {
    const nowMs = performance.now();
    if (lastFrameMs) {
      const periodMs = 1000 / (sessionManager.currentFrameRate || DEFAULT_FRAME_RATE);
      requestFrameRate(governor.sample(nowMs - lastFrameMs, periodMs));
    }
    lastFrameMs = nowMs;
  });

  const fade = createFade(scene, camera);
  const inXr = () => base.state === WebXRState.IN_XR;

  return {
    xr,
    camera,
    inXr,
    /** Fires with true on entering the headset and false on leaving. */
    onChange(callback) {
      base.onStateChangedObservable.add((state) => {
        if (state === WebXRState.IN_XR) callback(true);
        if (state === WebXRState.NOT_IN_XR) callback(false);
      });
    },
    async enter() {
      await base.enterXRAsync('immersive-vr', 'local-floor');
      const layer = sessionManager.session?.renderState?.baseLayer;
      if (layer && 'fixedFoveation' in layer) layer.fixedFoveation = foveation;
    },
    async exit() {
      if (inXr()) await base.exitXRAsync();
    },
    /** Fades out, moves the viewer to `position` (on the floor) facing `lookAt`, fades back in. */
    async moveTo(position, lookAt) {
      if (!inXr()) return;
      await fade.to(1, 180);
      camera.position.x = position.x;
      camera.position.z = position.z;
      camera.setTarget(lookAt);
      governor.hold(0.5);
      await fade.to(0, 260);
    },
    /** Where the viewer's head is now. */
    headPosition() {
      return camera.globalPosition.clone();
    },
    /** The viewer's facing direction, flattened onto the floor. */
    headForward() {
      const f = camera.getDirection(Vector3.Forward());
      f.y = 0;
      return f.lengthSquared() > 1e-6 ? f.normalize() : new Vector3(0, 0, 1);
    },
  };
}

// A dark sphere around the head, faded in and out over moves so they don't lurch.
function createFade(scene, camera) {
  const sphere = MeshBuilder.CreateSphere('xr-fade', { diameter: 0.6, segments: 8, sideOrientation: 1 }, scene);
  const mat = new StandardMaterial('xr-fade', scene);
  mat.disableLighting = true;
  mat.emissiveColor = new Color3(0.02, 0.02, 0.03);
  mat.disableDepthWrite = true;
  mat.alpha = 0;
  sphere.material = mat;
  sphere.isPickable = false;
  sphere.renderingGroupId = 3;
  sphere.parent = camera;
  sphere.setEnabled(false);

  return {
    to(alpha, ms) {
      return new Promise((resolve) => {
        const from = mat.alpha;
        const t0 = performance.now();
        sphere.setEnabled(true);
        const obs = scene.onBeforeRenderObservable.add(() => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          mat.alpha = from + (alpha - from) * k;
          if (k < 1) return;
          scene.onBeforeRenderObservable.remove(obs);
          if (alpha === 0) sphere.setEnabled(false);
          resolve();
        });
      });
    },
  };
}
