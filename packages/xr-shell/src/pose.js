// Where you are, for presence.js's getPose(): shared by subjects so everyone's avatar
// is placed the same way.
import { Ray, Vector3 } from '@babylonjs/core';

const DOWN = new Vector3(0, -1, 0);

/** In the headset: your head, gaze and hands. `rig` is createXr's result. */
export function xrPose(rig, area = 0) {
  const hand = (side) => {
    const c = rig.xr.input.controllers.find((c) => c.inputSource.handedness === side);
    return (c?.grip ?? c?.pointer)?.getAbsolutePosition().clone();
  };
  return { area, head: rig.headPosition(), forward: rig.camera.getDirection(Vector3.Forward()), left: hand('left'), right: hand('right') };
}

/**
 * On a flat screen with an orbit camera, which can be anywhere in the air: others
 * see you standing on the ground below it, at eye height, looking where it looks.
 * Null (not shown) when there's none of `floors` below the camera.
 */
export function orbitPose(camera, floors, { area = 0, eye = 1.6 } = {}) {
  const from = camera.globalPosition;
  const hit = camera.getScene().pickWithRay(new Ray(from, DOWN, 10000), (m) => floors.includes(m));
  if (!hit?.hit) return null;
  return { area, head: hit.pickedPoint.add(new Vector3(0, eye, 0)), forward: camera.getDirection(Vector3.Forward()) };
}
