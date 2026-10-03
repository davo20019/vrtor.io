// The landing area on the Hohematte: a target (a pale circle with an orange X, as drop zones
// lay out for students) and a windsock that shows the jump's wind.
import { Color3, Mesh, MeshBuilder, PBRMaterial, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

export function createDropzone(scene, { target, groundAt }) {
  const root = new TransformNode('dropzone', scene);
  const flat = (name, hex) => {
    const m = new StandardMaterial(name, scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.FromHexString(hex);
    return m;
  };
  const y = groundAt(target.x, target.z) + 0.03;
  const circle = MeshBuilder.CreateDisc('target-circle', { radius: 12, tessellation: 64 }, scene);
  circle.material = flat('target-circle', '#d9d4c3');
  circle.material.alpha = 0.85;
  circle.rotation.x = Math.PI / 2;
  circle.position.set(target.x, y, target.z);
  circle.parent = root;
  const xMat = flat('target-x', '#ff6a14');
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const bar = MeshBuilder.CreatePlane('target-x', { width: 14, height: 1.6 }, scene);
    bar.material = xMat;
    bar.rotation.set(Math.PI / 2, angle, 0);
    bar.position.set(target.x, y + 0.02, target.z);
    bar.parent = root;
  }
  const centre = MeshBuilder.CreateDisc('target-centre', { radius: 1.5, tessellation: 32 }, scene);
  centre.material = flat('target-centre', '#ffffff');
  centre.rotation.x = Math.PI / 2;
  centre.position.set(target.x, y + 0.04, target.z);
  centre.parent = root;

  // Windsock on a pole beside the target: it lifts and swings with the wind.
  const sockAt = new Vector3(target.x + 22, groundAt(target.x + 22, target.z - 8), target.z - 8);
  const pole = MeshBuilder.CreateCylinder('windsock-pole', { diameter: 0.08, height: 6, tessellation: 10 }, scene);
  const metal = new PBRMaterial('pole', scene);
  metal.albedoColor = new Color3(0.6, 0.6, 0.62);
  metal.metallic = 0.7;
  metal.roughness = 0.4;
  pole.material = metal;
  pole.position.set(sockAt.x, sockAt.y + 3, sockAt.z);
  pole.parent = root;
  const pivot = new TransformNode('windsock-pivot', scene);
  pivot.position.set(sockAt.x, sockAt.y + 5.9, sockAt.z);
  pivot.parent = root;
  const sockMat = new PBRMaterial('windsock', scene);
  sockMat.albedoColor = Color3.FromHexString('#ff5a10').toLinearSpace();
  sockMat.metallic = 0;
  sockMat.roughness = 0.8;
  sockMat.backFaceCulling = false;
  const sock = MeshBuilder.CreateCylinder('windsock', { diameterTop: 0.25, diameterBottom: 0.55, height: 2.2, tessellation: 18, cap: Mesh.NO_CAP }, scene);
  sock.material = sockMat;
  sock.parent = pivot;
  sock.rotation.x = Math.PI / 2;
  sock.position.z = 1.1;

  return {
    root,
    /** Points the sock downwind; it hangs at 6 m/s and above, droops below. */
    update(wind, time) {
      const speed = Math.hypot(wind.x, wind.z);
      pivot.rotation.y = Math.atan2(wind.x, wind.z) + Math.sin(time * 1.7) * 0.08 * Math.min(1, speed / 3);
      const droop = (1 - Math.min(1, speed / 6)) * 1.2;
      pivot.rotation.x = droop + Math.sin(time * 2.3) * 0.04;
    },
  };
}
