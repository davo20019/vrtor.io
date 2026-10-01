import { Color3, Mesh, PBRMaterial, VertexData } from '@babylonjs/core';

// Small opaque blades preserve stereo depth without alpha sorting or photo cards.
// Only nearby cells are drawn; roots were checked against actual model grass faces.
export async function createGrass(scene,enabled){
  const response=await fetch(`${import.meta.env.BASE_URL}models/citadel-grass.bin`);
  if(!response.ok)throw new Error('The ground detail could not load.');
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength%12)throw new Error('The ground detail is incomplete.');
  const roots=new Float32Array(buffer),tiles=new Map(),cache=new Map();
  for(let i=0;i<roots.length;i+=3){
    const x=roots[i],z=roots[i+2],key=`${Math.floor(x/20)},${Math.floor(z/20)}`;
    if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push([x,roots[i+1],z]);
  }
  const material=new PBRMaterial('short-illustrative-grass',scene);
  material.albedoColor=Color3.White();material.roughness=1;material.metallic=0;
  material.backFaceCulling=false;material.twoSidedLighting=true;
  const positions=[],normals=[],colors=[],indices=[];
  const root=Color3.FromHexString('#35451d').toLinearSpace(),tip=Color3.FromHexString('#86984c').toLinearSpace();
  for(let blade=0;blade<3;blade++){
    const angle=blade*Math.PI/3,dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;
    positions.push(-dx*.012,0,-dz*.012,dx*.012,0,dz*.012,dx*.012+.018,.085,dz*.003,-dx*.003+.018,.085,-dz*.003);
    for(let j=0;j<4;j++){normals.push(-dz,0,dx);const c=j<2?root:tip;colors.push(c.r,c.g,c.b,1);}
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  function build(key){
    const points=tiles.get(key);if(!points)return null;
    const mesh=new Mesh(`grass-${key}`,scene),data=new VertexData();
    data.positions=positions;data.normals=normals;data.colors=colors;data.indices=indices;data.applyToMesh(mesh);
    mesh.material=material;mesh.isPickable=false;mesh.receiveShadows=true;
    const matrices=new Float32Array(points.length*3*16);
    let seed=points.length*71429+Math.abs(Math.round(points[0][0]*1000));
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let i=0;
    for(const [x,y,z] of points)for(let tuft=0;tuft<3;tuft++){
      const theta=random()*Math.PI*2,size=.6+random()*.7,c=Math.cos(theta),s=Math.sin(theta);
      matrices.set([c*size,0,-s*size,0,0,size,0,0,s*size,0,c*size,0,x+(random()-.5)*.26,y-.012,z+(random()-.5)*.26,1],i++*16);
    }
    mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.freezeWorldMatrix();return mesh;
  }
  let last='';
  const observer=scene.onBeforeRenderObservable.add(()=>{
    const camera=scene.activeCamera,show=enabled()&&camera?.getClassName()!=='ArcRotateCamera';
    const p=camera?.globalPosition??camera?.position;
    const cx=p?Math.floor(p.x/20):0,cz=p?Math.floor(p.z/20):0,key=show?`${cx},${cz}`:'hidden';
    if(last===key)return;last=key;
    const wanted=new Set();
    if(show)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)wanted.add(`${cx+dx},${cz+dz}`);
    for(const [tile,mesh] of cache)if(!wanted.has(tile)){mesh.dispose();cache.delete(tile);}
    for(const tile of wanted)if(!cache.has(tile)){const mesh=build(tile);if(mesh)cache.set(tile,mesh);}
  });
  scene.onDisposeObservable.add(()=>{scene.onBeforeRenderObservable.remove(observer);for(const mesh of cache.values())mesh.dispose();material.dispose();});
}
