// The Alti-2 Galaxy on the back of your left hand (assets-src/altimeter, built with the
// build-3d-model skill). Its needle reads height above the ground, one turn per 4,000 m.
import { LoadAssetContainerAsync, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';

const MODELS = `${import.meta.env.BASE_URL}models/`;

export async function createAltimeter(scene) {
  const [container, info] = await Promise.all([
    LoadAssetContainerAsync(`${MODELS}altimeter.glb`, scene),
    fetch(`${MODELS}altimeter.json`).then((r) => r.json()),
  ]);
  container.addAllToScene();
  for (const mesh of container.meshes) {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
  }
  const needle = container.transformNodes.find((n) => n.name === info.needle.node);
  if (!needle) throw new Error('The altimeter has no needle.');
  const rest = needle.rotationQuaternion?.clone() ?? Quaternion.Identity();
  const axis = Vector3.FromArray(info.needle.axis);

  // The grip's frame: fingers along +z, thumb along +y, so the back of the left hand faces -x.
  // The model's dial faces +y with 0 toward -z: dial out of the back of the hand, 0 toward the
  // fingertips, upright when you bring your fist up in front of your face.
  const mount = new TransformNode('altimeter-mount', scene);
  mount.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(new Vector3(0, -1, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, -1));
  mount.position.set(-0.03, 0, -0.02);
  for (const n of container.rootNodes) n.parent = mount;
  mount.setEnabled(false);

  return {
    attach(controller) {
      mount.parent = controller.grip ?? controller.pointer;
      mount.setEnabled(true);
    },
    /** Height above the ground in metres. */
    set(agl) {
      needle.rotationQuaternion = rest.multiply(Quaternion.RotationAxis(axis, agl * info.needle.radiansPerMetre));
    },
  };
}
