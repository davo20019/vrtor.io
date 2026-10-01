// Exercise the actual walker against independently constructed physical fixtures.
import assert from 'node:assert/strict';
import { Mesh, NullEngine, Scene, Vector3, VertexData } from '@babylonjs/core';
import { createSurfaceWalker } from '../apps/mpc/src/walk.js';
import { SITE } from '../apps/mpc/src/areas.js';
const engine=new NullEngine(),scene=new Scene(engine),meshes=[];
function quad(name,points){
  const mesh=new Mesh(name,scene),data=new VertexData();
  data.positions=points.flat();data.indices=[0,2,1,0,3,2];data.normals=[];
  VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(mesh);mesh.computeWorldMatrix(true);meshes.push(mesh);return mesh;
}
quad('lower landing',[[-2,0,-1],[0,0,-1],[0,0,1],[-2,0,1]]);
quad('narrow first tread',[[0,.2,-1],[.3,.2,-1],[.3,.2,1],[0,.2,1]]);
quad('second tread',[[.3,.4,-1],[.6,.4,-1],[.6,.4,1],[.3,.4,1]]);
quad('unclimbable ledge',[[.6,1,-1],[1.5,1,-1],[1.5,1,1],[.6,1,1]]);
quad('wall across landing',[[-1,0,-1],[-1,0,1],[-1,2.4,1],[-1,2.4,-1]]);
const meta={step:.75,nav:[[-1.6,.012,0,.012,.012,.012,.012]]};
let current={i:SITE,meta,meshes};
const walk=createSurfaceWalker(scene,()=>current),V=(x,y,z)=>new Vector3(x,y,z);
let p=V(-.15,1.662,0);
p=walk(p,V(.3,0,0));assert(p,'narrow tread omitted by coarse grid must be reachable');assert(Math.abs(p.y-1.862)<.002);
p=walk(p,V(.3,0,0));assert(p,'next connected tread must be reachable');assert(Math.abs(p.y-2.062)<.002);
assert.equal(walk(p,V(.3,0,0)),null,'a 60 cm ledge must block movement');
assert.equal(walk(V(-.2,1.662,.93),V(.1,0,.1)),null,'unsupported footprint at a cliff must block movement');
assert.equal(walk(V(-.7,1.662,0),V(-.15,0,0)),null,'body clearance must block walls');
assert.equal(walk(V(-.15,1.662,0),V(.7,0,0)),null,'large travel cannot bypass conservative landing grid');
assert.equal(walk(V(.15,1.862,0),V(0,0,0)),null,'click travel cannot land on omitted treads');
current={...current,i:0};
assert.equal(walk(V(-.15,1.662,0),V(.3,0,0)),null,'large survey meshes must keep conservative landing rules');
engine.dispose();console.log('PASS: connected narrow stairs, step limit, cliff support, wall clearance, travel and scan restrictions.');
