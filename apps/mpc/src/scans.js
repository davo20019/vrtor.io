import { Ray, TransformNode, Texture, Vector3, Matrix, LoadAssetContainerAsync, PBRMaterial, Color3 } from '@babylonjs/core';
import { GraniteMaterial } from './granite.js';

// CAST's scanned buildings, placed in the citadel where the model's schematic versions stand (citadel-scans.json,
// assets-src/machu/place_scans.py). Light meshes with the full scans' relief and grey values baked to textures
// (scripts/bake-machu-scan.py). CC BY-NC 3.0, as the scans.
const BASE=import.meta.env.BASE_URL;

export function inside(polygon,x,z){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)hit=!hit;
  }
  return hit;
}
function grow(polygon,by){
  const cx=polygon.reduce((s,p)=>s+p[0],0)/polygon.length,cz=polygon.reduce((s,p)=>s+p[1],0)/polygon.length;
  return polygon.map(([x,z])=>{const d=Math.hypot(x-cx,z-cz)||1;return [x+(x-cx)/d*by,z+(z-cz)/d*by];});
}
export function unindex(mesh){if(mesh.getTotalIndices()!==mesh.getTotalVertices())mesh.convertToUnIndexedMesh();}

// The model's own building goes from under each scan: its walls and anything raised. Its ground stays, a little
// lower, so the scan's floor shows where both exist and the model's covers any gap in the scan.
export function clearFootprints(meshes,scans){
  const areas=scans.map(s=>({polygon:grow(s.footprint,.3),floor:s.floor}));
  for(const mesh of meshes){
    unindex(mesh);
    const p=mesh.getVerticesData('position'),world=mesh.computeWorldMatrix(true),back=world.clone().invert();
    const w=[0,1,2].map(()=>new Vector3());let changed=false;
    for(let t=0;t<p.length/9;t++){
      for(let k=0;k<3;k++)Vector3.TransformCoordinatesFromFloatsToRef(p[t*9+k*3],p[t*9+k*3+1],p[t*9+k*3+2],world,w[k]);
      const cy=(w[0].y+w[1].y+w[2].y)/3;
      // Any face reaching into the footprint goes, so no wall of the model's building cuts through the scan.
      const area=areas.find(a=>w.some(v=>inside(a.polygon,v.x,v.z))||inside(a.polygon,(w[0].x+w[1].x+w[2].x)/3,(w[0].z+w[1].z+w[2].z)/3));
      if(!area)continue;
      const n=Vector3.Cross(w[1].subtract(w[0]),w[2].subtract(w[0])).normalize();
      if(Math.abs(n.y)>.85&&cy<area.floor+.35){
        for(let k=0;k<3;k++){const q=Vector3.TransformCoordinates(w[k].add(new Vector3(0,-.25,0)),back);p.set([q.x,q.y,q.z],t*9+k*3);}
      }else for(let k=1;k<3;k++)p.set([p[t*9],p[t*9+1],p[t*9+2]],t*9+k*3);
      changed=true;
    }
    if(changed)mesh.updateVerticesData('position',p);
  }
}

export async function loadScans(scene,scans,grain,surfaces){
  const out=[];
  for(const s of scans){
    const container=await LoadAssetContainerAsync(`${BASE}models/${s.mesh}`,scene);
    const node=new TransformNode(`${s.id}-placed`,scene);
    node.position.set(...s.position);node.rotation.y=s.rotationY;
    for(const root of container.rootNodes)root.parent=node;
    container.transformNodes.push(node);
    const load=(file,gamma)=>{const t=new Texture(`${BASE}materials/${file}`,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);t.gammaSpace=gamma;return t;};
    const material=new PBRMaterial(`${s.id}-scan`,scene);
    material.albedoColor=Color3.White();material.metallic=0;material.roughness=.88;
    material.albedoTexture=load(s.gray,true);material.bumpTexture=load(s.normal,false);material.bumpTexture.level=3;
    // Left-handed scene: as the glTF loader sets them for a tangent-space map baked in Blender.
    material.invertNormalMapX=true;material.invertNormalMapY=false;
    material.backFaceCulling=false;material.twoSidedLighting=true;
    new GraniteMaterial(material,grain,surfaces,null,'scan');
    container.materials.push(material);container.textures.push(material.albedoTexture,material.bumpTexture);
    const meshes=container.meshes.filter(m=>m.getTotalVertices()>0);
    for(const m of meshes){m.material=material;m.isPickable=false;m.receiveShadows=true;}
    out.push({scan:s,container,meshes,node});
  }
  return out;
}

// Teleport cells on the scans' floors, on the model's grid (walk.js keys cells by it), replacing the model's
// cells inside each footprint.
export function scanCells(scene,scans,loaded,nav,step){
  const origin=nav[0],kept=nav.filter(c=>!scans.some(s=>inside(grow(s.footprint,.3),c[0],c[2])));
  const meshes=loaded.flatMap(l=>l.meshes);
  for(const m of meshes)m.computeWorldMatrix(true);
  const h=step*.42,down=new Vector3(0,-1,0);
  // The scans aren't in the scene yet: rays test their meshes directly.
  const first=ray=>ray.intersectsMeshes(meshes,false)[0];
  const cast=(x,z,top)=>{const hit=first(new Ray(new Vector3(x,top,z),down,30));return hit?.hit&&Math.abs(hit.getNormal(true).y)>.9?hit.pickedPoint.y:null;};
  for(const s of scans){
    const xs=s.footprint.map(p=>p[0]),zs=s.footprint.map(p=>p[1]),top=s.floor+12;
    for(let i=Math.floor((Math.min(...xs)-origin[0])/step);origin[0]+i*step<=Math.max(...xs);i++)
      for(let j=Math.floor((Math.min(...zs)-origin[2])/step);origin[2]+j*step<=Math.max(...zs);j++){
        const x=origin[0]+i*step,z=origin[2]+j*step;
        if(!inside(s.footprint,x,z))continue;
        const y=cast(x,z,top);if(y===null)continue;
        const c=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([dx,dz])=>cast(x+dx,z+dz,top));
        if(c.some(v=>v===null||Math.abs(v-y)>.25))continue;
        // Never above head clearance under a lintel or roof slab.
        const head=first(new Ray(new Vector3(x,y+.1,z),new Vector3(0,1,0),1.9));
        if(head?.hit)continue;
        kept.push([x,y+.018,z,...c.map(v=>v+.018)]);
      }
  }
  // The walker keys cells from the first one: keep the model's first cell first.
  return kept;
}
