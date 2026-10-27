// The room: a dim, warm space with the heart floating over a lit ring at its middle. Frame: metres, up +y, the
// viewer starting at +z looking at -z, the floor at y = 0.
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core';

// Bigger than the furthest the orbit camera goes (main.js upperRadiusLimit).
const ROOM_R = 20;

export function createRoom(scene) {
  const dome = MeshBuilder.CreateSphere('room-dome', { diameter: ROOM_R * 2, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const low = Color3.FromHexString('#120d10');
  const high = Color3.FromHexString('#2a1c22');
  const pos = dome.getVerticesData(VertexBuffer.PositionKind);
  const colors = [];
  for (let i = 0; i < pos.length; i += 3) {
    const c = Color3.Lerp(low, high, Math.max(0, pos[i + 1] / ROOM_R));
    colors.push(c.r, c.g, c.b, 1);
  }
  dome.setVerticesData(VertexBuffer.ColorKind, colors);
  const dm = new StandardMaterial('room-dome', scene);
  dm.disableLighting = true;
  dm.diffuseColor = Color3.White();
  dm.specularColor = Color3.Black();
  dm.backFaceCulling = false;
  dome.material = dm;
  dome.isPickable = false;

  const floor = MeshBuilder.CreateDisc('room-floor', { radius: ROOM_R - 0.5, tessellation: 64 }, scene);
  floor.rotation.x = Math.PI / 2;
  const fm = new StandardMaterial('room-floor', scene);
  fm.diffuseColor = Color3.FromHexString('#1a1316');
  fm.specularColor = new Color3(0.05, 0.05, 0.05);
  floor.material = fm;

  const circle = [];
  for (let k = 0; k <= 120; k++) circle.push(new Vector3(0.9 * Math.cos((k / 120) * Math.PI * 2), 0.012, 0.9 * Math.sin((k / 120) * Math.PI * 2)));
  const ring = MeshBuilder.CreateTube('ring', { path: circle, radius: 0.01, tessellation: 5 }, scene);
  const rm = new StandardMaterial('ring', scene);
  rm.disableLighting = true;
  rm.emissiveColor = Color3.FromHexString('#e0566a');
  ring.material = rm;
  ring.isPickable = false;
  // Two soft overhead panels, like an operating theatre's lights: they are what the wet tissue reflects.
  const lamps = [];
  for (const [i, x] of [[0, -1.6], [1, 1.8]]) {
    const p = MeshBuilder.CreatePlane(`lamp-${i}`, { width: 2.4, height: 1.2 }, scene);
    p.position.set(x, 5.5, 0.8 * (i ? -1 : 1));
    p.rotation.x = Math.PI / 2;
    const lm = new StandardMaterial(`lamp-${i}`, scene);
    lm.disableLighting = true;
    lm.emissiveColor = Color3.FromHexString('#fff6ec');
    lm.backFaceCulling = false;
    p.material = lm;
    p.isPickable = false;
    lamps.push(p);
  }
  return { floors: [floor], envMeshes: [dome, floor, ring, ...lamps] };
}
