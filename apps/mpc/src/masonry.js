import { Vector3 } from '@babylonjs/core';

// Masonry kinds, as the shader reads them (granite.js). Measured on the CAST laser scans; see citadel-masonry.json.
export const MASONRY={rustic:0,coursed:1,megalithic:2};

// Gives every wall face its own frame, so the stones are laid along it: a vertex attribute
// (along the wall in metres, height above the base of its wall, that wall's height, masonry kind).
// A wall is a set of connected vertical faces, so a building's courses line up round its corners.
// Flatter faces get kind -1. Meshes are unindexed first: a corner vertex belongs to two walls.
export function addWallFrames(meshes,zones){
  const faces=[];
  for(const mesh of meshes){
    if(mesh.getIndices()?.length)mesh.convertToUnIndexedMesh();
    const local=mesh.getVerticesData('position'),world=mesh.computeWorldMatrix(true),p=new Float32Array(local.length);
    const v=new Vector3();
    for(let i=0;i<local.length;i+=3){Vector3.TransformCoordinatesFromFloatsToRef(local[i],local[i+1],local[i+2],world,v);p[i]=v.x;p[i+1]=v.y;p[i+2]=v.z;}
    for(let t=0;t<p.length/9;t++)faces.push({mesh,p,t});
  }
  const parent=faces.map((_,i)=>i),find=i=>{while(parent[i]!==i)i=parent[i]=parent[parent[i]];return i;};
  const corners=new Map(),key=(p,i)=>`${Math.round(p[i]*100)},${Math.round(p[i+1]*100)},${Math.round(p[i+2]*100)}`;
  faces.forEach((f,i)=>{
    const o=f.t*9,p=f.p;
    const ax=p[o+3]-p[o],ay=p[o+4]-p[o+1],az=p[o+5]-p[o+2],bx=p[o+6]-p[o],by=p[o+7]-p[o+1],bz=p[o+8]-p[o+2];
    const n=new Vector3(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx).normalize();
    // Steep faces too (gable slopes): the shader shows stone wherever the face is steeper than |n.y| 0.85.
    f.wall=Math.abs(n.y)<.85;f.normal=n;
    if(!f.wall)return;
    for(let k=0;k<3;k++){const c=key(p,o+k*3),j=corners.get(c);if(j===undefined)corners.set(c,i);else parent[find(i)]=find(j);}
  });
  const extent=new Map();
  faces.forEach((f,i)=>{
    if(!f.wall)return;
    const r=find(i),o=f.t*9,e=extent.get(r)??[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for(let k=0;k<3;k++)for(let a=0;a<3;a++){e[a]=Math.min(e[a],f.p[o+k*3+a]);e[a+3]=Math.max(e[a+3],f.p[o+k*3+a]);}
    extent.set(r,e);
  });
  // A wall is ashlar only if it stands wholly inside a building's zone: a long terrace wall that runs past
  // a temple stays rustic.
  const kindOf=new Map();
  for(const [r,e] of extent){
    const zone=zones.find(({box:b})=>e[0]>=b[0]&&e[1]>=b[1]&&e[2]>=b[2]&&e[3]<=b[3]&&e[4]<=b[4]&&e[5]<=b[5]);
    kindOf.set(r,MASONRY[zone?.masonry]??MASONRY.rustic);
  }
  const frames=new Map(meshes.map(m=>[m,new Float32Array(m.getTotalVertices()*4)]));
  faces.forEach((f,i)=>{
    const out=frames.get(f.mesh),o=f.t*9;
    if(!f.wall){for(let k=0;k<3;k++)out[(f.t*3+k)*4+3]=-1;return;}
    // Along the wall: the same tangent the shader builds from the normal, cross(up, normal).
    const h=Math.hypot(f.normal.x,f.normal.z),tx=f.normal.z/h,tz=-f.normal.x/h;
    const e=extent.get(find(i)),base=e[1],top=e[4],kind=kindOf.get(find(i));
    for(let k=0;k<3;k++){
      const q=o+k*3,w=(f.t*3+k)*4;
      out[w]=f.p[q]*tx+f.p[q+2]*tz;out[w+1]=f.p[q+1]-base;out[w+2]=top-base;out[w+3]=kind;
    }
  });
  for(const [mesh,data] of frames)mesh.setVerticesData('wallFrame',data,false,4);
}
