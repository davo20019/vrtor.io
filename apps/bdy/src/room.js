// The room the body stands in: a quiet, warm-dark studio like an anatomy museum's, the body on a low round
// plinth in the middle, soft light panels overhead and to the sides for the wet tissue to catch, and a lit
// ring round the plinth. Drawn here (no files), a few hundred triangles, for Quest.
//
// Frame: metres, up +y, the body facing +z, the floor at y = 0.
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core';

/** The plinth's top: the soles stand here. */
export const PLINTH_TOP = 0.08;
export const PLINTH_R = 0.75;
const ROOM_R = 14;

function matte(scene, name, color, specular = 0.03) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(specular, specular, specular);
  mat.specularPower = 48;
  return mat;
}

function glow(scene, name, color) {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(color);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  return mat;
}

/** Walls and ceiling: a dome, darkest at the floor, a little lighter and warmer overhead (vertex colours). */
function dome(scene) {
  const mesh = MeshBuilder.CreateSphere('room-dome', { diameter: ROOM_R * 2, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const low = Color3.FromHexString('#121012');
  const mid = Color3.FromHexString('#211d1f');
  const high = Color3.FromHexString('#332d2c');
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const colors = [];
  for (let i = 0; i < pos.length; i += 3) {
    const h = pos[i + 1] / ROOM_R;
    const c = h < 0.1 ? low : h < 0.4 ? Color3.Lerp(low, mid, (h - 0.1) / 0.3) : Color3.Lerp(mid, high, (h - 0.4) / 0.6);
    colors.push(c.r, c.g, c.b, 1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial('room-dome', scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.White();
  mat.emissiveColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

export function createRoom(scene) {
  const walls = dome(scene);
  const floor = MeshBuilder.CreateDisc('room-floor', { radius: ROOM_R - 0.5, tessellation: 64 }, scene);
  floor.rotation.x = Math.PI / 2;
  floor.material = matte(scene, 'room-floor', '#191617', 0.08);
  floor.receiveShadows = true;
  floor.isPickable = true;

  const plinth = MeshBuilder.CreateCylinder('plinth', { diameter: PLINTH_R * 2, height: PLINTH_TOP, tessellation: 72 }, scene);
  plinth.position.y = PLINTH_TOP / 2;
  plinth.material = matte(scene, 'plinth', '#2c2829', 0.1);
  plinth.receiveShadows = true;
  plinth.isPickable = false;
  const ring = MeshBuilder.CreateTorus('plinth-ring', { diameter: PLINTH_R * 2 + 0.02, thickness: 0.018, tessellation: 72 }, scene);
  ring.position.y = PLINTH_TOP;
  ring.material = glow(scene, 'plinth-ring', '#a8907a');
  ring.isPickable = false;

  // Soft panels: what glossy tissue reflects, so organs read as wet and round rather than flat.
  const panels = [];
  const panel = (name, w, h, pos, rx, ry, color) => {
    const p = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
    p.position.copyFrom(pos);
    p.rotation.set(rx, ry, 0);
    p.material = glow(scene, name, color);
    p.isPickable = false;
    panels.push(p);
    return p;
  };
  panel('light-over', 2.2, 2.2, new Vector3(0, 4.2, 0.4), Math.PI / 2, 0, '#f6f1ea');
  panel('light-left', 0.5, 3.2, new Vector3(-3.6, 2.2, 1.6), 0, -Math.PI / 2 + 0.5, '#b9b2aa');
  panel('light-right', 0.5, 3.2, new Vector3(3.6, 2.2, 1.6), 0, Math.PI / 2 - 0.5, '#b9b2aa');
  panel('light-back', 3.0, 0.4, new Vector3(0, 3.2, -4.2), 0.3, Math.PI, '#8f8780');

  return { floors: [floor], envMeshes: [walls, floor, plinth, ring, ...panels] };
}
