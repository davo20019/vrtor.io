// The headset card as a menu you can always get back: A, X or the left menu button (the palm
// pinch with tracked hands) opens it in front of you, and closes it when it's already there. While
// it's closed, a small "A · Menu" label rides on each controller so nobody has to know the button.
// While it's open it stays in view: turn away or walk off and it glides back in front of you.
//
// It can be moved: point at it and squeeze the grip, and it follows the ray, turned to face you, and stays
// where you let go (it no longer follows you). The menu button brings it back in front of you.
import { Color3, DynamicTexture, Mesh, MeshBuilder, Quaternion, Ray, StandardMaterial, Vector3 } from '@babylonjs/core';

/** Each button and its label (the menu button is a hand's palm pinch when nothing else is there). */
const BUTTONS = { 'a-button': 'A · Menu', 'x-button': 'X · Menu', menu: 'Pinch palm · Menu' };
/** Out of view: further than this off where you're facing (rad), or this far away (m)... */
const OUT_ANGLE = (55 * Math.PI) / 180;
const OUT_DISTANCE = 2.6;
/** ...for this long (s), and it comes back. */
const OUT_SECONDS = 0.6;
/**
 * How quickly a card being moved catches up with the ray (1/s). The card hangs a metre or so down the ray,
 * where the hand's own tremor is magnified: following it at once made the card shake. ~50 ms to catch up
 * keeps it steady and still feels attached.
 */
const DRAG_FOLLOW = 20;

/**
 * `card` is the subject's createCard(); `open()` shows it in front of the viewer (the subject's
 * render, with its card open), `close()` hides it. `follow: false` leaves an open card where it is.
 */
export function createMenuControls(scene, rig, card, { open, close, follow = true }) {
  const head = () => rig.camera.globalPosition;
  const offBy = () => {
    const to = card.mesh.getAbsolutePosition().subtract(head());
    const distance = to.length();
    to.y = 0;
    const f = rig.headForward();
    const angle = to.lengthSquared() < 1e-6 ? 0 : Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(to.normalize(), f))));
    return { angle, distance };
  };
  const inView = () => {
    if (!card.visible) return false;
    const { angle, distance } = offBy();
    return angle < OUT_ANGLE && distance < OUT_DISTANCE;
  };

  const labels = [];
  rig.xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      for (const [id, text] of Object.entries(BUTTONS)) {
        const component = mc.getComponent(id);
        if (!component) continue;
        component.onButtonStateChangedObservable.add((c) => {
          if (!c.changes.pressed?.current) return;
          if (inView()) return close();
          card.unpin();
          open();
        });
        // One label per controller, naming its face button (or the menu button on a hand).
        if (labels.some((l) => l.source === source)) continue;
        const label = makeLabel(scene, text);
        label.parent = source.grip ?? source.pointer;
        label.position.set(0, 0.075, -0.01);
        labels.push({ source, mesh: label });
      }
    });
  });
  // ---- moving it: a squeeze with the ray on the card takes it by the point the ray is on
  let drag = null;      // { source, mc, distance, local }: the taken point in the card's frame, and how far along the ray
  const ray = new Ray(Vector3.Zero(), Vector3.Forward());
  const aimedAt = (source) => card.isCard(rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId));
  const pulse = (mc, v, ms) => {
    try { mc?.pulse(v, ms); } catch {}
  };
  const endDrag = () => {
    pulse(drag?.mc, 0.2, 20);
    drag = null;
  };
  rig.xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      mc.getComponent('xr-standard-squeeze')?.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed) return;
        if (!c.pressed) {
          if (drag?.source === source) endDrag();
          return;
        }
        if (drag || !card.visible || !aimedAt(source)) return;
        source.getWorldPointerRayToRef(ray);
        const mesh = rig.xr.pointerSelection.getMeshUnderPointer(source.uniqueId);
        const hit = ray.intersectsMesh(mesh);
        if (!hit.hit) return;
        const local = Vector3.TransformCoordinates(hit.pickedPoint, card.mesh.computeWorldMatrix(true).clone().invert());
        local.z = 0;
        drag = { source, mc, distance: hit.distance, local, pos: null, f: null };
        pulse(mc, 0.3, 30);
      });
    });
  });
  const facing = new Quaternion(), offset = new Vector3();
  scene.onBeforeRenderObservable.add(() => {
    if (drag && (!card.visible || !rig.inXr())) drag = null;
    if (drag) {
      drag.source.getWorldPointerRayToRef(ray);
      const at = ray.origin.add(ray.direction.scale(drag.distance));
      const f = at.subtract(head());
      f.y = 0;
      if (f.lengthSquared() < 1e-6) f.copyFrom(rig.headForward());
      f.normalize();
      // The card's middle, such that the point taken is where the ray now ends.
      Quaternion.RotationYawPitchRollToRef(Math.atan2(f.x, f.z), 0, 0, facing);
      drag.local.applyRotationQuaternionToRef(facing, offset);
      const want = at.subtract(offset);
      if (!drag.pos) {
        drag.pos = card.mesh.getAbsolutePosition().clone();
        drag.f = want.subtract(head());
        drag.f.y = 0;
        drag.f.normalize();
      }
      // Eased towards where the ray says, so the hand's tremor doesn't shake it.
      const k = 1 - Math.exp(-DRAG_FOLLOW * Math.min(0.1, scene.getEngine().getDeltaTime() / 1000));
      Vector3.LerpToRef(drag.pos, want, k, drag.pos);
      Vector3.LerpToRef(drag.f, f, k, drag.f);
      drag.f.normalize();
      card.moveTo(drag.pos, drag.f);
    }
    card.lightHandle(!!drag || (rig.inXr() && card.visible && rig.xr.input.controllers.some(aimedAt)));
  });

  rig.xr.input.onControllerRemovedObservable.add((source) => {
    if (drag?.source === source) drag = null;
    const i = labels.findIndex((l) => l.source === source);
    if (i < 0) return;
    labels[i].mesh.dispose(false, true);
    labels.splice(i, 1);
  });

  let outFor = 0;
  scene.onBeforeRenderObservable.add(() => {
    const showing = rig.inXr() && card.visible;
    for (const l of labels) l.mesh.setEnabled(rig.inXr() && !showing);
    // Put somewhere by hand, it stays there.
    if (!follow || !showing || card.pinned) {
      outFor = 0;
      return;
    }
    outFor = inView() ? 0 : outFor + scene.getEngine().getDeltaTime() / 1000;
    if (outFor > OUT_SECONDS) {
      outFor = 0;
      open();
    }
  });

  return { inView };
}

/** A small dark pill with white text that always faces you. */
function makeLabel(scene, text) {
  const W = 512, H = 128;
  const plane = MeshBuilder.CreatePlane('menu-label', { width: 0.1, height: 0.025 }, scene);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.renderingGroupId = 2;
  const tex = new DynamicTexture('menu-label', { width: W, height: H }, scene, true);
  tex.hasAlpha = true;
  const c = tex.getContext();
  c.fillStyle = 'rgba(12,13,18,0.88)';
  c.beginPath();
  c.roundRect(4, 4, W - 8, H - 8, (H - 8) / 2);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = '#ffb020';
  c.stroke();
  c.font = '600 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#fff';
  c.fillText(text, W / 2, H / 2 + 3, W - 40);
  tex.update();
  const mat = new StandardMaterial('menu-label', scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  plane.material = mat;
  plane.setEnabled(false);
  return plane;
}
