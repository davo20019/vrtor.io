// Moving in the headset where there's no floor to teleport to: the left thumbstick floats you
// toward where you look (or back, or sideways), gently; the right one snap-turns left and right
// and floats you up and down. You can't drift farther than `range` from `center`.
import { Quaternion, Vector3, WebXRFeatureName } from '@babylonjs/core';

/** Metres per second at full tilt: slow, so floating stays comfortable. */
const SPEED = 0.9;
const DEADZONE = 0.18;
const TURN = Math.PI / 6;

export function attachFloat(rig, scene, { center = Vector3.Zero(), range = 30 } = {}) {
  const { xr } = rig;
  // Teleport needs a floor; in orbit it would only draw a ray to nowhere.
  xr.baseExperience.featuresManager.disableFeature(WebXRFeatureName.TELEPORTATION);
  const camera = xr.baseExperience.camera;
  const sticks = new Map();
  let turnArmed = true;

  xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      const stick = mc.getComponent('xr-standard-thumbstick');
      if (stick) sticks.set(source.inputSource.handedness, stick);
    });
  });
  xr.input.onControllerRemovedObservable.add((source) => sticks.delete(source.inputSource.handedness));

  const shaped = (v) => (Math.abs(v) < DEADZONE ? 0 : Math.sign(v) * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE)) ** 2);

  scene.onBeforeRenderObservable.add(() => {
    if (!rig.inXr()) return;
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    const move = new Vector3();
    const left = sticks.get('left')?.axes;
    if (left) {
      const forward = camera.getDirection(Vector3.Forward());
      const right = camera.getDirection(Vector3.Right());
      move.addInPlace(forward.scale(-shaped(left.y))).addInPlace(right.scale(shaped(left.x)));
    }
    const rightStick = sticks.get('right')?.axes;
    if (rightStick) {
      move.y -= shaped(rightStick.y);
      // One turn per push: it re-arms when the stick comes back to the middle.
      if (Math.abs(rightStick.x) > 0.7 && turnArmed) {
        turnArmed = false;
        // Turn about the world's up, not the head's: multiplied on the other side, a turn made while
        // looking down or with the head tilted would tip the whole world off level.
        Quaternion.FromEulerAngles(0, Math.sign(rightStick.x) * TURN, 0).multiplyToRef(camera.rotationQuaternion, camera.rotationQuaternion);
      } else if (Math.abs(rightStick.x) < 0.3) {
        turnArmed = true;
      }
    }
    if (move.lengthSquared() === 0) return;
    const next = camera.position.add(move.scale(SPEED * dt));
    const off = next.subtract(center);
    if (off.length() > range) next.copyFrom(center.add(off.normalize().scale(range)));
    camera.position.copyFrom(next);
  });
}
