// Walking with the left thumbstick, as in most headset apps: push it and you glide the way you're
// looking (sideways too), on the floor, up and down its slopes and steps. The right stick keeps
// teleport and snap turn. Walking goes wherever teleport can land and only while teleport is on,
// so a subject that turns teleport off (a seat in a moving truck, a skydive) turns walking off too.
import { Ray, Vector3 } from '@babylonjs/core';

/** Top speed (m/s) at full tilt: a brisk walk, gentle on the stomach. */
const SPEED = 1.4;
const DEADZONE = 0.15;
/** The highest step up or down you walk over in one go (m); anything taller stops you. */
const STEP = 0.45;
/** How far below the eyes to look for the floor (m). */
const REACH = 4;

/** `floorMeshes`: the floors teleport starts with (later ones come through its addFloorMesh). */
export function enableWalking(scene, xr, { floorMeshes = [], inXr }) {
  const teleport = xr.teleportation;
  if (!teleport) return;
  // The floors teleport knows, kept in step with it.
  const floors = new Set(floorMeshes);
  const add = teleport.addFloorMesh.bind(teleport);
  const remove = teleport.removeFloorMesh.bind(teleport);
  teleport.addFloorMesh = (mesh) => {
    floors.add(mesh);
    add(mesh);
  };
  teleport.removeFloorMesh = (mesh) => {
    floors.delete(mesh);
    remove(mesh);
  };

  let stick = null;
  xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      if (mc.handedness === 'left') stick = mc.getComponent('xr-standard-thumbstick') ?? null;
    });
  });
  xr.input.onControllerRemovedObservable.add((source) => {
    if (source.inputSource.handedness === 'left') stick = null;
  });

  const ray = new Ray(Vector3.Zero(), Vector3.Down(), REACH + STEP);
  const groundAt = (x, z, eyeY) => {
    ray.origin.set(x, eyeY + STEP, z);
    const hit = scene.pickWithRay(ray, (m) => floors.has(m) && m.isEnabled());
    return hit?.hit ? hit.pickedPoint.y : null;
  };

  const camera = xr.baseExperience.camera;
  xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
    if (!stick || !inXr() || !teleport.attached || floors.size === 0) return;
    const { x, y } = stick.axes;
    const tilt = Math.hypot(x, y);
    if (tilt < DEADZONE) return;
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
    const f = camera.getDirection(Vector3.Forward());
    f.y = 0;
    if (f.lengthSquared() < 1e-6) return;
    f.normalize();
    const right = new Vector3(f.z, 0, -f.x);
    // Ramp in past the dead zone, so a small push is a slow step.
    const speed = SPEED * Math.min(1, (tilt - DEADZONE) / (1 - DEADZONE));
    const move = f.scale(-y / tilt).add(right.scale(x / tilt)).scale(speed * dt);
    const pos = camera.position;
    const here = groundAt(pos.x, pos.z, pos.y);
    const there = groundAt(pos.x + move.x, pos.z + move.z, pos.y);
    // Off the floor, or a step too tall: stay put.
    if (there === null || (here !== null && Math.abs(there - here) > STEP)) return;
    pos.x += move.x;
    pos.z += move.z;
    if (here !== null) pos.y += there - here;
  });
}
