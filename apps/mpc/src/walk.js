import { Ray, Vector3 } from '@babylonjs/core';
import { SITE } from './areas.js';
const V=(x,y,z)=>new Vector3(x,y,z);
export function createSurfaceWalker(scene,getCurrent){
  let walkMap=null;
  return function walk(position,delta){
    const current=getCurrent(),active=current.i;
    const meta=current.meta,origin=meta.nav[0],step=meta.step;
    const key=(x,z)=>`${Math.round((x-origin[0])/step)},${Math.round((z-origin[2])/step)}`;
    if(walkMap?.i!==active)walkMap={i:active,cells:new Map(meta.nav.map(c=>[key(c[0],c[2]),c]))};
    const x=position.x+delta.x,z=position.z+delta.z,cell=walkMap.cells.get(key(x,z));
    const foot=position.y-1.65;
    let y;
    if(cell&&Math.abs(cell[1]-foot)<=.35){
      const half=step*(active===SITE?.42:.46);
      const u=Math.max(0,Math.min(1,(x-cell[0])/(2*half)+.5));
      const v=Math.max(0,Math.min(1,(z-cell[2])/(2*half)+.5));
      y=(cell[3]*(1-u)+cell[4]*u)*(1-v)+(cell[6]*(1-u)+cell[5]*u)*v;
    }else if(active===SITE&&delta.lengthSquared()>0&&delta.lengthSquared()<=.16){
      // A coarse landing grid can omit narrow stair treads. Continuous walking
      // may cross them only with local foot support and a human-sized step.
      const heights=[];
      for(const [dx,dz] of [[0,0],[.12,.12],[-.12,.12],[.12,-.12],[-.12,-.12]]){
        const hit=scene.pickWithRay(new Ray(V(x+dx,foot+.32,z+dz),V(0,-1,0),.67),m=>current.meshes.includes(m));
        if(!hit?.hit||Math.abs(hit.getNormal(true)?.y??0)<.72)return null;
        heights.push(hit.pickedPoint.y);
      }
      y=heights[0]+.012;
      if(Math.max(...heights)-Math.min(...heights)>.3||Math.abs(y-foot)>.31)return null;
    }else return null;
    if(Math.abs(y-foot)>.35)return null;
    for(const h of [.65,1.4])for(const d of [V(1,0,0),V(-1,0,0),V(0,0,1),V(0,0,-1)]){
      const hit=scene.pickWithRay(new Ray(V(x,y+h,z),d,.24),m=>current.meshes.includes(m));
      if(hit?.hit)return null;
    }
    return V(x,y+1.65,z);
  }
}
