// Real-size fruit, made from spheres: an apple (glossy, a dip at the top, a stem) or an orange
// (matt). Each mesh carries its fruit in metadata, so a click or a grab finds it.
import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { skinColor } from './data.js';

let stemMat = null;

export function makeFruit(scene, fruit, id) {
  const d = fruit.size / 100;
  const root = new TransformNode(`fruit-${id}`, scene);
  const body = MeshBuilder.CreateSphere(`fruit-${id}-body`, { diameter: d, segments: 20 }, scene);
  body.parent = root;
  const m = new StandardMaterial(`fruit-${id}`, scene);
  m.diffuseColor = Color3.FromArray(skinColor(fruit));
  if (fruit.kind === 'orange') {
    // Peel is matt: a broad, faint highlight.
    m.specularColor = new Color3(0.08, 0.07, 0.06);
    m.specularPower = 12;
    body.scaling.y = 0.96;
  } else {
    m.specularColor = new Color3(0.3, 0.3, 0.3);
    m.specularPower = 90;
    body.scaling.y = 0.88;
    // The dip round the stem, and the stem.
    const dip = MeshBuilder.CreateSphere(`fruit-${id}-dip`, { diameter: d * 0.34, segments: 10 }, scene);
    dip.parent = root;
    dip.position.y = d * 0.4;
    dip.scaling.y = 0.4;
    dip.material = m;
    stemMat ??= Object.assign(new StandardMaterial('stem', scene), { diffuseColor: Color3.FromHexString('#5a3b22'), specularColor: Color3.Black() });
    const stem = MeshBuilder.CreateCylinder(`fruit-${id}-stem`, { diameterTop: 0.003, diameterBottom: 0.005, height: d * 0.3, tessellation: 6 }, scene);
    stem.parent = root;
    stem.position.y = d * 0.5;
    stem.rotation.z = 0.25;
    stem.material = stemMat;
  }
  body.material = m;
  const meshes = root.getChildMeshes();
  for (const mesh of meshes) mesh.metadata = { fruit: id };
  return {
    id,
    fruit,
    root,
    meshes,
    material: m,
    radius: d / 2,
    /** Where it sits when it's not being held (a spot on the table, or in a basket). */
    home: new Vector3(),
    /** Its label once sorted: 'apple', 'orange', or null. */
    label: null,
    highlight(on) {
      m.emissiveColor = on ? new Color3(0.22, 0.2, 0.12) : Color3.Black();
    },
  };
}
