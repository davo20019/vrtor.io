// A short line of text that floats low in front of the viewer for a few seconds,
// for the headset (flat screens show the same notice in HTML). It's placed where you
// look when it appears and then stays put in the world, which is easier on the eyes
// than text glued to your head.
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';

const SHOW_SECONDS = 3.2;

export function createToast(scene) {
  const plane = MeshBuilder.CreatePlane('toast', { width: 0.56, height: 0.1 }, scene);
  plane.renderingGroupId = 2;
  plane.isPickable = false;
  plane.applyFog = false;
  plane.setEnabled(false);
  const tex = new DynamicTexture('toast', { width: 1024, height: 184 }, scene, true);
  tex.hasAlpha = true;
  const mat = new StandardMaterial('toast', scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = Color3.White();
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  plane.material = mat;

  let left = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (left <= 0) return;
    left -= scene.getEngine().getDeltaTime() / 1000;
    mat.alpha = Math.min(1, left / 0.4, (SHOW_SECONDS - left) / 0.2);
    if (left <= 0) plane.setEnabled(false);
  });

  return {
    /** Shows `text` ahead of `camera` (its position is the eyes). */
    show(text, camera, accent = '#ffb020') {
      const c = tex.getContext();
      c.clearRect(0, 0, 1024, 184);
      c.fillStyle = 'rgba(12,13,18,0.9)';
      c.beginPath();
      c.roundRect(6, 6, 1012, 172, 86);
      c.fill();
      c.lineWidth = 8;
      c.strokeStyle = accent;
      c.stroke();
      c.font = '600 72px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.fillText(text, 512, 96, 940);
      tex.update();
      const f = camera.getDirection(Vector3.Forward());
      f.y = 0;
      if (f.lengthSquared() < 1e-6) f.set(0, 0, 1);
      f.normalize();
      const eye = camera.globalPosition;
      plane.position.set(eye.x + f.x * 1.3, eye.y - 0.38, eye.z + f.z * 1.3);
      // A plane shows its front to -Z: point +Z away from the viewer.
      plane.lookAt(plane.position.add(f));
      plane.setEnabled(true);
      left = SHOW_SECONDS;
    },
  };
}
