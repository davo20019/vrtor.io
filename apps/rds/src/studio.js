// The studio the Roadster is shown in: a dark room with the car on a low turntable, three soft light
// panels for the white paint and the gold glass to reflect (a long one overhead, one each side), and a
// lit ring round the turntable's edge. Everything is drawn here (no files to load) and kept small for
// Quest: a few hundred triangles and no textures.
//
// Frame: metres, Babylon's (the glTF loader's root turns the model into it). Up +y, the car's nose +z,
// the car's left -x, the floor at y = 0.
import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, VertexBuffer } from '@babylonjs/core';

/** How high the turntable lifts the car off the floor. */
export const TABLE_TOP = 0.06;
/** The car is 4.6 m long and 2.0 m wide: its corners reach 2.5 m from the centre. */
const TABLE_R = 3.3;
const ROOM_R = 18;

function matte(scene, name, color, specular = 0.03) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(specular, specular, specular);
  mat.specularPower = 48;
  return mat;
}

/** A material that only glows: the light panels and the ring. */
function glow(scene, name, color) {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(color);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  return mat;
}

/** The room's walls and ceiling: a dome, darkest at the floor, a little lighter overhead (vertex colours). */
function dome(scene) {
  const mesh = MeshBuilder.CreateSphere('studio-dome', { diameter: ROOM_R * 2, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const low = Color3.FromHexString('#0e1014');
  const mid = Color3.FromHexString('#1a1f26');
  const high = Color3.FromHexString('#2a313b');
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const colors = [];
  for (let i = 0; i < pos.length; i += 3) {
    const h = pos[i + 1] / ROOM_R;          // -1 at the bottom, 1 at the top
    const c = h < 0.1 ? low : h < 0.4 ? Color3.Lerp(low, mid, (h - 0.1) / 0.3) : Color3.Lerp(mid, high, (h - 0.4) / 0.6);
    colors.push(c.r, c.g, c.b, 1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial('studio-dome', scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.White();
  mat.emissiveColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

export function createStudio(scene) {
  const walls = dome(scene);

  const floor = MeshBuilder.CreateDisc('studio-floor', { radius: ROOM_R - 0.5, tessellation: 64 }, scene);
  floor.rotation.x = Math.PI / 2;
  floor.material = matte(scene, 'studio-floor', '#141619', 0.1);
  floor.receiveShadows = true;

  // The turntable turns with the car (main.js parents the car to `table`).
  const table = new TransformNode('turntable', scene);
  const deck = MeshBuilder.CreateCylinder('turntable-deck', { diameter: TABLE_R * 2, height: TABLE_TOP, tessellation: 96 }, scene);
  deck.position.y = TABLE_TOP / 2;
  deck.material = matte(scene, 'turntable-deck', '#2a2e35', 0.12);
  deck.receiveShadows = true;
  deck.parent = table;
  const ring = MeshBuilder.CreateTorus('turntable-ring', { diameter: TABLE_R * 2 + 0.02, thickness: 0.03, tessellation: 96 }, scene);
  ring.position.y = TABLE_TOP;
  ring.material = glow(scene, 'turntable-ring', '#7f93a8');
  ring.isPickable = false;

  // Soft light panels: what the paint and the glass reflect. Lit both sides, so which way they face doesn't matter.
  const panels = [];
  const panel = (name, w, h, pos, rx, ry, color = '#f2f4f7') => {
    const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
    p.position.copyFrom(pos);
    p.rotation.set(rx, ry, 0);
    p.material = glow(scene, name, color);
    p.material.backFaceCulling = false;
    p.isPickable = false;
    panels.push(p);
    return p;
  };
  panel('light-over', 2.4, 7.5, new Vector3(0, 5.2, 0), Math.PI / 2, 0);
  // Thin strips high on the walls, tilted down at the car: a line of light along each side.
  panel('light-left', 8, 0.3, new Vector3(-9, 4.2, 0), 0, Math.PI / 2, '#9aa1aa').rotation.x = 0.5;
  panel('light-right', 8, 0.3, new Vector3(9, 4.2, 0), 0, Math.PI / 2, '#9aa1aa').rotation.x = -0.5;

  return {
    table,
    floors: [floor, deck],
    /** What a reflection probe should see. */
    envMeshes: [walls, floor, deck, ring, ...panels],
  };
}
