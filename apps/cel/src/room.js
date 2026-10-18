// The room: a dim, cool lab with the two cells floating side by side over lit rings on the floor. Drawn here, a
// few thousand triangles.
//
// Frame: metres, up +y, the viewer starting at +z looking at -z, the floor at y = 0.
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core';

const ROOM_R = 16;

function matte(scene, name, color, specular = 0.03) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(specular, specular, specular);
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

function dome(scene) {
  const mesh = MeshBuilder.CreateSphere('room-dome', { diameter: ROOM_R * 2, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const low = Color3.FromHexString('#0b1219');
  const mid = Color3.FromHexString('#14212c');
  const high = Color3.FromHexString('#20323f');
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

/** `spots`: where each cell floats, { x, z, r } (the ring under it). */
export function createRoom(scene, spots) {
  const walls = dome(scene);
  const floor = MeshBuilder.CreateDisc('room-floor', { radius: ROOM_R - 0.5, tessellation: 64 }, scene);
  floor.rotation.x = Math.PI / 2;
  floor.material = matte(scene, 'room-floor', '#111a22', 0.08);
  floor.isPickable = true;
  const env = [walls, floor];
  for (const [i, s] of spots.entries()) {
    const pad = MeshBuilder.CreateDisc(`pad-${i}`, { radius: s.r, tessellation: 72 }, scene);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(s.x, 0.004, s.z);
    pad.material = matte(scene, `pad-${i}`, '#16232e', 0.1);
    pad.isPickable = false;
    const circle = [];
    for (let k = 0; k <= 120; k++) circle.push(new Vector3(s.x + s.r * Math.cos((k / 120) * Math.PI * 2), 0.012, s.z + s.r * Math.sin((k / 120) * Math.PI * 2)));
    const ring = MeshBuilder.CreateTube(`ring-${i}`, { path: circle, radius: 0.01, tessellation: 5 }, scene);
    ring.material = glow(scene, `ring-${i}`, '#5fb3c9');
    ring.isPickable = false;
    env.push(pad, ring);
  }
  return { floors: [floor], envMeshes: env };
}
