// Planes that turn to face the viewer (stop markers, name tags, the Sun). Babylon's default
// billboard copies the camera's rotation, which in a headset makes them turn and roll with
// your head (tilt it and the markers tilt too); facing the eye's position keeps them level
// and fixed in the world.
import { Matrix, TransformNode } from '@babylonjs/core';

const BILLBOARD = TransformNode.BILLBOARDMODE_ALL | TransformNode.BILLBOARDMODE_USE_POSITION;

/** Makes plane `mesh` face the viewer's position. */
export function faceViewer(mesh) {
  // Facing by position turns a plane's back to the viewer: flip it once so text reads right.
  mesh.bakeTransformIntoVertices(Matrix.RotationY(Math.PI));
  mesh.billboardMode = BILLBOARD;
}
