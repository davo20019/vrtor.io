// The EC135 you jump from (scripts/prepare-jump-helicopter.py): "EC135" by NG, CC BY 4.0, with
// its pilot and two other jumpers seated inside (Microsoft Rocketbox, MIT). It hovers at the exit
// with its right sliding door open; you sit on the cabin floor in the doorway, facing out.
// The model's frame: x right, y up, z forward, origin under the mast at the skids' bottom.
import { Color3, DracoDecoder, LoadAssetContainerAsync, Mesh, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;
const MODELS = `${BASE}models/`;
// Self-hosted Draco decoder (public/draco).
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};

export async function createHelicopter(scene) {
  const [container, meta] = await Promise.all([
    LoadAssetContainerAsync(`${MODELS}ec135.glb`, scene),
    fetch(`${MODELS}ec135.json`).then((r) => {
      if (!r.ok) throw new Error('The helicopter could not load.');
      return r.json();
    }),
  ]);
  container.addAllToScene();
  const root = new TransformNode('helicopter', scene);
  for (const node of container.rootNodes) node.parent = root;
  for (const mesh of container.meshes) mesh.isPickable = false;
  const rotor = [...container.transformNodes, ...container.meshes].find((n) => n.name === 'rotor');
  const spin = rotor.rotationQuaternion?.clone() ?? Quaternion.Identity();
  rotor.rotationQuaternion ??= Quaternion.Identity();

  // The blades turn at a rate that reads as fast without strobing at 72 or 90 Hz; a faint disc
  // stands for the blur the eye would see at the real 395 rpm.
  const disc = MeshBuilder.CreateDisc('rotor-disc', { radius: meta.rotorRadius, tessellation: 64, sideOrientation: Mesh.DOUBLESIDE }, scene);
  const discMat = new StandardMaterial('rotor-disc', scene);
  discMat.diffuseColor = new Color3(0.06, 0.06, 0.07);
  discMat.specularColor = Color3.Black();
  discMat.alpha = 0.08;
  discMat.backFaceCulling = false;
  disc.material = discMat;
  disc.parent = root;
  disc.position.set(meta.rotor[0], meta.rotor[1] - 0.02, meta.rotor[2]);
  disc.rotation.x = Math.PI / 2;
  disc.isPickable = false;

  const local = (p) => new Vector3(p[0], p[1], p[2]);
  const turn = new Quaternion();
  const toWorld = (p) => {
    root.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(p, root.getWorldMatrix());
  };
  return {
    root,
    credit: meta.credit,
    /** Hovers at `position` (the skids' bottom) with its nose toward `heading` (radians from north). */
    place(position, heading) {
      root.position.copyFrom(position);
      root.rotation.y = heading;
    },
    /** World position of the cabin floor in the open doorway, where you sit. */
    seatPoint: () => toWorld(local(meta.floor)),
    /**
     * Turns the rotor. The helicopter holds a steady hover: you sit in it, and any sway of the cabin
     * around you (or of you with it) is motion your body doesn't feel, which makes people sick.
     */
    update(time) {
      Quaternion.RotationAxisToRef(Vector3.Up(), time * 7.3, turn);
      spin.multiplyToRef(turn, rotor.rotationQuaternion);
    },
    setVisible(visible) {
      root.setEnabled(visible);
    },
  };
}
