// The headset side of every vrtor subject: WebXR session setup tuned for Quest
// (ported from Acento), teleport and snap turn on the floor, a comfort fade,
// and moving the viewer for guided tours.
//
// Sharpness, in order of effect:
//   - the eye buffer is allocated above the browser's default (which is well
//     under a Quest 3's panels) and each frame renders as much of it as the
//     frame rate allows (resolution.js); a size that ever fails to enter is
//     never tried again (eyeBuffer.js)
//   - MSAA on the layer, light fixed foveation
//   - 90 Hz while the scene keeps up, stepping down to 72 when it can't (frameRate.js);
//     resolution only drops once the refresh is as low as it goes: sharpness first
//   - text panels composited as WebXR quad layers, sampled once at display
//     resolution instead of through the eye buffer (layers.js); `?layers=0` turns them off
import { Color3, MeshBuilder, Ray, StandardMaterial, Vector3, WebXRState } from '@babylonjs/core';
import { WebXRWebGLLayerWrapper } from '@babylonjs/core/XR/webXRWebGLLayer.js';
import { FrameRateGovernor } from './frameRate.js';
import { createPanelLayers, quadLayersSupported } from './layers.js';
import { PressAim } from './pressAim.js';
import { chooseEyeBufferScale, eyeBufferMemory } from './eyeBuffer.js';
import { AdaptiveResolution } from './resolution.js';

/** Eye-buffer scale over the browser's default known to work on a Quest 3 (Acento ships it). */
export const RESOLUTION_SCALE = 1.25;
/** The largest eye buffer to try; the browser caps it at what the headset allows. */
export const MAX_RESOLUTION_SCALE = 1.5;
/** Adaptive resolution never renders below this. */
const MIN_RESOLUTION_SCALE = 1.1;
/** XR frames that must render before a larger eye buffer counts as working. */
const EYE_BUFFER_CONFIRM_FRAMES = 30;
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

function numberParam(name) {
  const raw = new URLSearchParams(location.search).get(name);
  const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function viewportScalingSupported() {
  return !!globalThis.XRView && 'requestViewportScale' in XRView.prototype;
}

/**
 * Sets up WebXR for `scene`. Returns null when the browser can't do immersive VR.
 * `floorMeshes` are where teleport can land; `start` is where the viewer
 * stands on entering ({ position: Vector3 on the floor, lookAt: Vector3 }).
 * `maxResolution` caps the eye buffer for heavy scenes; `foveation` sets the default
 * edge softening. For comparing on the headset: `?fov=0..1`, `?res=1..1.5` pins the resolution.
 */
export async function createXr(scene, { floorMeshes = [], start = null, maxResolution = MAX_RESOLUTION_SCALE, foveation = FOVEATION } = {}) {
  if (!(await xrSupported())) return null;

  const fovParam = numberParam('fov');
  const fov = fovParam === null ? foveation : Math.min(1, Math.max(0, fovParam));
  const resParam = numberParam('res');
  const pinned = resParam === null ? null : Math.min(MAX_RESOLUTION_SCALE, Math.max(0.5, resParam));
  const adaptive = viewportScalingSupported();
  const eyeBuffer = eyeBufferMemory();
  // The layer is made after the session starts, from these options; its size is set then.
  const canvasOptions = { antialias: true, depth: true, stencil: true, alpha: false, framebufferScaleFactor: RESOLUTION_SCALE };

  const xr = await scene.createDefaultXRExperienceAsync({
    disableDefaultUI: true,
    floorMeshes,
    optionalFeatures: true,
    outputCanvasOptions: { canvasOptions },
    // Both hands point and click. Otherwise a press with the other controller only switches to it.
    pointerSelectionOptions: { enablePointerSelectionOnAllControllers: true },
    teleportationOptions: {
      defaultTargetMeshOptions: { teleportationFillColor: ACCENT, teleportationBorderColor: '#ffffff' },
    },
  });
  const base = xr.baseExperience;
  const sessionManager = base.sessionManager;
  const camera = base.camera;

  // A session with the 'layers' feature rejects `baseLayer` ("can't use baseLayer with layers
  // feature requested"): Babylon's layer goes in as the first entry of `layers` instead, still
  // rendered through Babylon's wrapper.
  const updateRenderState = sessionManager.updateRenderState.bind(sessionManager);
  sessionManager.updateRenderState = (state) => {
    const session = sessionManager.session;
    if (!state.baseLayer || !session?.enabledFeatures?.includes('layers')) return updateRenderState(state);
    const { baseLayer, ...rest } = state;
    sessionManager._setBaseLayerWrapper(new WebXRWebGLLayerWrapper(baseLayer));
    session.updateRenderState({ ...rest, layers: [baseLayer] });
  };
  const useQuadLayers = new URLSearchParams(location.search).get('layers') !== '0' && quadLayersSupported();
  // What each controller points at, for the cursor drawn on panels composited as layers.
  const rays = new WeakMap();
  const pointerHits = () => {
    const hits = [];
    for (const source of xr.input.controllers) {
      const mesh = xr.pointerSelection?.getMeshUnderPointer(source.uniqueId);
      if (!mesh) continue;
      let ray = rays.get(source);
      if (!ray) rays.set(source, (ray = new Ray(Vector3.Zero(), Vector3.Forward())));
      source.getWorldPointerRayToRef(ray);
      hits.push({ mesh, ray });
    }
    return hits;
  };
  const panelLayers = createPanelLayers(scene, sessionManager, pointerHits);

  // A press clicks what the ray hit as the trigger pull began, not where the pull has tipped it
  // by the time it counts as pressed (pressAim.js).
  const pressAim = new PressAim();
  const triggerValue = (pointerId) => {
    const component = xr.pointerSelection?.getXRControllerByPointerId(pointerId)?.motionController?.getMainComponent();
    return component ? component.value : null;
  };
  const simulateMove = scene.simulatePointerMove.bind(scene);
  scene.simulatePointerMove = (pick, init) => {
    if (init?.pointerType === 'xr' && init.pointerId !== undefined) {
      pressAim.sample(init.pointerId, pick, triggerValue(init.pointerId), performance.now());
    }
    return simulateMove(pick, init);
  };
  const simulateDown = scene.simulatePointerDown.bind(scene);
  scene.simulatePointerDown = (pick, init) => {
    if (init?.pointerType !== 'xr' || init.pointerId === undefined) return simulateDown(pick, init);
    return simulateDown(pressAim.pickFor(init.pointerId, pick, performance.now()), init);
  };

  // Where the viewer stands when the session starts (their real height is kept).
  base.onInitialXRPoseSetObservable.add((cam) => {
    if (!start) return;
    cam.position.y += start.position.y || 0;
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
  // The eye buffer: as large as has worked (or is worth trying), with adaptive
  // resolution rendering into as much of it as the frame rate allows.
  let allocated = RESOLUTION_SCALE;
  let pendingFrames = 0;
  let resolution = null;
  sessionManager.onXRSessionInit.add(() => {
    allocated = adaptive
      ? chooseEyeBufferScale({ safe: RESOLUTION_SCALE, target: maxResolution, failedBefore: eyeBuffer.failedBefore() })
      : RESOLUTION_SCALE;
    if (pinned !== null && pinned > allocated) allocated = pinned;
    canvasOptions.framebufferScaleFactor = allocated;
    pendingFrames = allocated > RESOLUTION_SCALE ? EYE_BUFFER_CONFIRM_FRAMES : 0;
    if (pendingFrames) eyeBuffer.attempt(allocated);
    resolution = adaptive
      ? new AdaptiveResolution(
          pinned === null
            ? { allocated, start: allocated, floor: Math.min(MIN_RESOLUTION_SCALE, allocated) }
            : { allocated, start: pinned, floor: pinned, ceiling: pinned },
        )
      : null;
    resolution?.hold(2);
    lastFrameMs = 0;
    governor = new FrameRateGovernor(sessionManager.supportedFrameRates);
    governor.hold(2);
    requestFrameRate(governor.target);
  });
  if (adaptive) {
    // Every view asks for its share of the layer just before Babylon reads its viewport.
    const setViewport = sessionManager.trySetViewportForView.bind(sessionManager);
    sessionManager.trySetViewportForView = (viewport, view) => {
      if (resolution) view.requestViewportScale?.(resolution.viewportScale);
      return setViewport(viewport, view);
    };
  }
  /** Smoothed frame interval (ms), for the `?xrdebug` readout. */
  let frameMs = 0;
  sessionManager.onXRFrameObservable.add(() => {
    if (pendingFrames && --pendingFrames === 0) eyeBuffer.confirm();
    const nowMs = performance.now();
    if (lastFrameMs) {
      const dt = nowMs - lastFrameMs;
      const periodMs = 1000 / (sessionManager.currentFrameRate || DEFAULT_FRAME_RATE);
      requestFrameRate(governor.sample(dt, periodMs));
      // A lower refresh gives every frame more time: try that before giving up pixels.
      if (governor.atMinimum) resolution?.sample(dt, periodMs);
      if (dt < 250) frameMs = frameMs ? frameMs + (dt - frameMs) * 0.05 : dt;
    }
    lastFrameMs = nowMs;
  });

  const fade = createFade(scene, camera, (alpha) => panelLayers.setFade(alpha));
  const inXr = () => base.state === WebXRState.IN_XR;

  // Analytics (the page's gtag, when it has one): time in the headset, per subject page.
  let enteredAt = 0;
  base.onStateChangedObservable.add((state) => {
    if (state === WebXRState.IN_XR) {
      enteredAt = performance.now();
      window.gtag?.('event', 'enter_vr');
    } else if (state === WebXRState.NOT_IN_XR && enteredAt) {
      window.gtag?.('event', 'exit_vr', { vr_seconds: Math.round((performance.now() - enteredAt) / 1000) });
      enteredAt = 0;
    }
  });

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
      try {
        // 'layers' is optional: a browser without it still enters, and panels stay in the eye buffer.
        await base.enterXRAsync('immersive-vr', 'local-floor', undefined, useQuadLayers ? { optionalFeatures: ['layers'] } : {});
      } catch (error) {
        // A larger eye buffer that couldn't enter isn't tried again.
        if (pendingFrames) eyeBuffer.fail();
        pendingFrames = 0;
        throw error;
      }
      const renderState = sessionManager.session?.renderState;
      const layer = renderState?.baseLayer ?? renderState?.layers?.[0];
      if (layer && 'fixedFoveation' in layer) layer.fixedFoveation = fov;
    },
    /**
     * Composites a GUI panel ({ mesh, ui }) as a quad layer when the headset supports it, for
     * sharper text; `interactive` adds a cursor where a controller points at it. Returns the undo.
     */
    mirrorPanel(panel, options) {
      return panelLayers.mirror(panel, options);
    },
    async exit() {
      if (inXr()) await base.exitXRAsync();
    },
    /** Fades out, optionally swaps the scene while hidden, moves the viewer to `position` facing `lookAt`, and fades back in. */
    async moveTo(position, lookAt, whileHidden) {
      if (!inXr()) return;
      await fade.to(1, 180);
      try {
        await whileHidden?.();
        camera.position.y = (position.y || 0) + camera.realWorldHeight;
        camera.position.x = position.x;
        camera.position.z = position.z;
        camera.setTarget(lookAt);
        governor.hold(0.5);
        resolution?.hold(0.5);
      } finally {
        await fade.to(0, 260);
      }
    },
    /** What the headset is doing, for the `?xrdebug` readout: `1.50x · 72/72 fps · text layers`. */
    stats() {
      const rendering = resolution ? resolution.scale : allocated;
      const rate = sessionManager.currentFrameRate;
      const fps = frameMs ? Math.round(1000 / frameMs) : 0;
      return `${rendering.toFixed(2)}x of ${allocated.toFixed(2)}x · ${fps}${rate ? `/${Math.round(rate)}` : ''} fps · text ${panelLayers.active() ? 'layers' : 'in scene'} · fov ${fov}`;
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
function createFade(scene, camera, onChange) {
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
          onChange(mat.alpha);
          if (k < 1) return;
          scene.onBeforeRenderObservable.remove(obs);
          if (alpha === 0) sphere.setEnabled(false);
          resolve();
        });
      });
    },
  };
}
