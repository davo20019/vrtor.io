// Text panels as WebXR quad layers (ported from Acento's scene/xrLayers.ts).
// A panel drawn into the eye buffer is resampled twice (into the buffer, then
// by the compositor's lens warp), which blurs small text; a quad layer hands
// the panel's own pixels to the compositor, which samples them once at
// display resolution.
//
// The compositor draws layers over the eye buffer, so a controller's cursor on
// a mirrored panel would vanish behind it: interactive panels get a small
// cursor quad of their own, listed after the panels, where each controller's
// ray meets them. The scene itself stays in the browser's anti-aliased
// XRWebGLLayer, listed first in the session's layers (Babylon's
// projection-layer path renders without MSAA).
//
// While a session composites layers, each mirrored panel's mesh is kept out of
// the eye buffer (`layerMask` 0) but stays enabled, so its GUI texture keeps
// rendering; whether the mesh is enabled decides whether its quad is shown.
// Outside XR, or when the browser has no layers, nothing changes.
import { Quaternion, Vector3 } from '@babylonjs/core';

/** Whether this browser can create quad layers (the session must also grant 'layers'). */
export function quadLayersSupported() {
  const binding = globalThis.XRWebGLBinding;
  return typeof binding === 'function' && 'createQuadLayer' in binding.prototype;
}

/**
 * A pose in Babylon's world converted to the session's reference space. The
 * world is the reference space with Z mirrored in a left-handed scene (as
 * WebXRCamera does), which turns a plane's front (-Z, facing the viewer) into
 * the quad's front (+Z).
 */
export function toXrPose(position, rotation, rightHanded) {
  if (rightHanded) {
    return {
      position: { x: position.x, y: position.y, z: position.z },
      orientation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    };
  }
  return {
    position: { x: position.x, y: position.y, z: -position.z },
    orientation: { x: -rotation.x, y: -rotation.y, z: rotation.z, w: rotation.w },
  };
}

/** `pose`, given in a space whose origin sits at `origin` within another space, expressed in that other space. */
export function inSpace(pose, origin) {
  const q = new Quaternion(origin.orientation.x, origin.orientation.y, origin.orientation.z, origin.orientation.w);
  const p = new Vector3(pose.position.x, pose.position.y, pose.position.z).applyRotationQuaternion(q);
  const r = q.multiply(new Quaternion(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w));
  return {
    position: { x: p.x + origin.position.x, y: p.y + origin.position.y, z: p.z + origin.position.z },
    orientation: { x: r.x, y: r.y, z: r.z, w: r.w },
  };
}

/** The cursor's width on a panel (m) and its texture's size (px). */
const CURSOR_M = 0.016;
const CURSOR_PX = 64;
/** How far in front of the panel the cursor floats (m). */
const CURSOR_LIFT_M = 0.002;

function cursorCanvas() {
  const canvas =
    typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(CURSOR_PX, CURSOR_PX)
      : Object.assign(document.createElement('canvas'), { width: CURSOR_PX, height: CURSOR_PX });
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = CURSOR_PX / 2;
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.arc(c, c, c - 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, c - 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvas;
}

/**
 * `pointerHits()` returns each controller's { mesh, ray } this frame (what it points at), for the cursors.
 * Returns { mirror(panel, options), setFade(alpha), active(), dispose() }.
 */
export function createPanelLayers(scene, sessionManager, pointerHits = () => []) {
  const entries = [];
  const cursors = [
    { quad: null, dirty: true },
    { quad: null, dirty: true },
  ];
  let cursorImage = null;
  let state = 'idle'; // 'idle' | 'on' | 'off'
  let binding = null;
  let base = null;
  /** Quads in the session's layers after the base layer; null until they're first set. */
  let active = null;
  let fade = 0;

  const gl = () => scene.getEngine()._gl;
  const session = () => sessionManager.session ?? null;

  const setLayers = (quads) => {
    session()?.updateRenderState({ layers: [base, ...quads] });
    active = quads;
  };
  /** Takes `quads` out of the session's layers before they're destroyed. */
  const unlist = (quads) => {
    if (!active || !quads.some((q) => active.includes(q))) return;
    try {
      setLayers(active.filter((q) => !quads.includes(q)));
    } catch {
      // The session may already be gone.
    }
  };
  const destroyQuad = (entry) => {
    try {
      entry.quad?.destroy();
    } catch {
      // The session may already be gone.
    }
    entry.quad = null;
  };
  const destroyCursors = () => {
    for (const cursor of cursors) {
      try {
        cursor.quad?.destroy();
      } catch {
        // The session may already be gone.
      }
      cursor.quad = null;
      cursor.dirty = true;
    }
  };
  const restoreMeshes = () => {
    for (const entry of entries) entry.panel.mesh.layerMask = entry.layerMask;
  };
  const stop = (next) => {
    // On a live session (a failure), unlist the quads and leave the base layer.
    if (next === 'off') unlist([...entries, ...cursors].flatMap((e) => (e.quad ? [e.quad] : [])));
    entries.forEach(destroyQuad);
    destroyCursors();
    restoreMeshes();
    state = next;
    binding = null;
    base = null;
    active = null;
  };

  const start = () => {
    const s = session();
    const Binding = globalThis.XRWebGLBinding;
    // With 'layers', the scene's XRWebGLLayer is the first of the session's layers (see xr.js).
    const sceneLayer = s?.renderState.layers?.[0] ?? s?.renderState.baseLayer;
    if (!s || !Binding || !quadLayersSupported() || !s.enabledFeatures?.includes('layers') || !sceneLayer) {
      state = 'off';
      return;
    }
    binding = new Binding(s, gl());
    base = sceneLayer;
    state = 'on';
  };

  // Where Babylon's reference space sits in the session's base space this
  // frame. Quads live in the base space: Babylon's is an offset space
  // (teleporting moves it), and the Quest drew quads made in it shifted from
  // the scene. The browser resolves the offset here instead.
  let origin = null;
  const setTransform = (quad, pose) => {
    const p = origin ? inSpace(pose, origin) : pose;
    quad.transform = new XRRigidTransform(p.position, p.orientation);
  };
  const quadSpace = () => sessionManager.baseReferenceSpace;

  const scale = new Vector3();
  const rotation = new Quaternion();
  const position = new Vector3();
  const place = (entry, quad) => {
    const mesh = entry.panel.mesh;
    mesh.getWorldMatrix().decompose(scale, rotation, position);
    const half = mesh.getBoundingInfo().boundingBox.extendSize;
    quad.width = half.x * 2 * Math.abs(scale.x);
    quad.height = half.y * 2 * Math.abs(scale.y);
    setTransform(quad, toXrPose(position, rotation, scene.useRightHandedSystem));
    if ('opacity' in quad) quad.opacity = 1 - fade;
  };

  /** Copies a canvas into a quad (premultiplied, GL row order), keeping Babylon's GL state. */
  const upload = (canvas, quad, frame) => {
    const g = gl();
    const target = binding.getSubImage(quad, frame).colorTexture;
    const texture = g.getParameter(g.TEXTURE_BINDING_2D);
    const flip = g.getParameter(g.UNPACK_FLIP_Y_WEBGL);
    const premultiply = g.getParameter(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
    g.bindTexture(g.TEXTURE_2D, target);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, g.RGBA, g.UNSIGNED_BYTE, canvas);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, flip);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    g.bindTexture(g.TEXTURE_2D, texture);
  };

  const cursorWorld = new Vector3();
  const cursorRotation = new Quaternion();
  const cursorScale = new Vector3();
  const cursorPosition = new Vector3();
  const toward = new Vector3();
  /** Cursor quads where the controllers point at shown interactive panels. */
  const placeCursors = (shown, xrFrame) => {
    const placed = [];
    for (const hit of pointerHits()) {
      if (placed.length >= cursors.length) break;
      const entry = entries.find((e) => e.interactive && e.panel.mesh === hit.mesh && e.quad && shown.includes(e.quad));
      if (!entry) continue;
      const pick = hit.ray.intersectsMesh(entry.panel.mesh);
      if (!pick.hit || !pick.pickedPoint) continue;
      const cursor = cursors[placed.length];
      if (!cursor.quad) {
        cursor.quad = binding.createQuadLayer({ space: quadSpace(), viewPixelWidth: CURSOR_PX, viewPixelHeight: CURSOR_PX, layout: 'mono' });
        cursor.dirty = true;
      }
      const world = entry.panel.mesh.getWorldMatrix();
      world.decompose(cursorScale, cursorRotation, cursorPosition);
      // The plane's front, local -Z (Babylon's `Backward`), faces the viewer.
      Vector3.TransformNormalToRef(Vector3.Backward(), world, toward);
      toward.scaleInPlace(CURSOR_LIFT_M / Math.max(toward.length(), 1e-6));
      pick.pickedPoint.addToRef(toward, cursorWorld);
      cursor.quad.width = CURSOR_M;
      cursor.quad.height = CURSOR_M;
      setTransform(cursor.quad, toXrPose(cursorWorld, cursorRotation, scene.useRightHandedSystem));
      if (cursor.dirty || cursor.quad.needsRedraw) {
        cursorImage ??= cursorCanvas();
        upload(cursorImage, cursor.quad, xrFrame);
        cursor.dirty = !active?.includes(cursor.quad);
      }
      placed.push(cursor.quad);
    }
    return placed;
  };

  const frame = () => {
    const xrFrame = sessionManager.currentFrame;
    if (!xrFrame || !sessionManager.inXRSession || !entries.length) return;
    if (state === 'idle') start();
    if (state !== 'on') return;
    try {
      const located = xrFrame.getPose(sessionManager.referenceSpace, sessionManager.baseReferenceSpace);
      // Without it this frame, the quads keep last frame's place.
      if (!located) return;
      const { position: p, orientation: o } = located.transform;
      origin = { position: { x: p.x, y: p.y, z: p.z }, orientation: { x: o.x, y: o.y, z: o.z, w: o.w } };
      const shown = [];
      for (const entry of entries) {
        entry.panel.mesh.layerMask = 0;
        if (!entry.panel.mesh.isEnabled() || fade > 0.99) continue;
        if (!entry.quad) {
          entry.quad = binding.createQuadLayer({
            space: quadSpace(),
            viewPixelWidth: entry.canvas.width,
            viewPixelHeight: entry.canvas.height,
            layout: 'mono',
          });
          entry.dirty = true;
        }
        const quad = entry.quad;
        place(entry, quad);
        if (entry.dirty || quad.needsRedraw) {
          upload(entry.canvas, quad, xrFrame);
          // A quad only just added to the session's layers draws again next frame.
          entry.dirty = !active?.includes(quad);
        }
        shown.push(quad);
      }
      shown.push(...placeCursors(shown, xrFrame));
      const changed = active ? shown.length !== active.length || shown.some((q, i) => q !== active[i]) : shown.length > 0;
      if (changed) setLayers(shown);
    } catch (error) {
      console.warn('[xr] quad layers failed; panels back in the eye buffer', error);
      stop('off');
    }
  };

  const afterRender = scene.onAfterRenderObservable.add(frame);
  const ended = sessionManager.onXRSessionEnded.add(() => stop('idle'));

  return {
    /** Composites `panel` ({ mesh, ui }) as a quad layer during XR sessions; returns the undo. */
    mirror(panel, { interactive = false } = {}) {
      const entry = {
        panel,
        canvas: panel.ui.getContext().canvas,
        layerMask: panel.mesh.layerMask,
        quad: null,
        dirty: true,
        interactive,
        dispose: () => {},
      };
      const rendered = panel.ui.onEndRenderObservable.add(() => {
        entry.dirty = true;
      });
      entry.dispose = () => {
        panel.ui.onEndRenderObservable.remove(rendered);
        if (entry.quad) unlist([entry.quad]);
        destroyQuad(entry);
        if (!panel.mesh.isDisposed()) panel.mesh.layerMask = entry.layerMask;
      };
      entries.push(entry);
      return () => {
        const index = entries.indexOf(entry);
        if (index < 0) return;
        entries.splice(index, 1);
        entry.dispose();
      };
    },
    /** The comfort fade's darkness over the panels (0 clear .. 1 black). */
    setFade(alpha) {
      fade = alpha;
    },
    /** Whether panels are being composited as quad layers in this session. */
    active: () => state === 'on',
    dispose() {
      scene.onAfterRenderObservable.remove(afterRender);
      sessionManager.onXRSessionEnded.remove(ended);
      for (const entry of entries.splice(0)) entry.dispose();
    },
  };
}
