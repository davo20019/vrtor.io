import { Color3, MaterialPluginBase, MeshBuilder, PBRMaterial, VertexData, VertexBuffer } from '@babylonjs/core';
const BASE=import.meta.env.BASE_URL;
export async function buildTerrain(scene,grain){
  const [info,data]=await Promise.all([fetch(`${BASE}models/andes.json`),fetch(`${BASE}models/andes-height.bin`)]);
  if(!info.ok||!data.ok)throw new Error('The elevation data could not load.');
  const meta=await info.json(),buffer=await data.arrayBuffer();
  if(buffer.byteLength!==meta.resolution**2*4)throw new Error('The elevation data is incomplete.');
  const heights=new Float32Array(buffer),size=meta.resolution;
  const mesh=MeshBuilder.CreateGround('Andean-terrain',{width:meta.extent,height:meta.extent,subdivisions:size-1,updatable:true},scene);
  const positions=mesh.getVerticesData(VertexBuffer.PositionKind);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],z=positions[i+2];
    const col=Math.round((x/meta.extent+.5)*(size-1)),row=Math.round((z/meta.extent+.5)*(size-1));
    const radius=Math.hypot(x,z),blend=Math.max(0,Math.min(1,(radius-350)/250));
    const smooth=blend*blend*(3-2*blend);
    // This local join is illustrative; the terrain is never a teleport target.
    positions[i+1]=heights[row*size+col]*smooth-.2*(1-smooth);
  }
  const normals=[];VertexData.ComputeNormals(positions,mesh.getIndices(),normals);
  mesh.updateVerticesData(VertexBuffer.PositionKind,positions,true);
  mesh.updateVerticesData(VertexBuffer.NormalKind,normals);
  const green=Color3.FromHexString('#526940').toLinearSpace(),rock=Color3.FromHexString('#8b8a75').toLinearSpace(),colors=[];
  for(let i=0;i<normals.length;i+=3){
    const steep=Math.min(1,Math.max(0,(.83-Math.abs(normals[i+1]))*2));
    const tint=Color3.Lerp(green,rock,steep);
    colors.push(tint.r,tint.g,tint.b,1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind,colors);
  const mat=new PBRMaterial('illustrative-mountain-cover',scene);
  mat.albedoColor=Color3.White();mat.metallic=0;mat.roughness=1;mesh.material=mat;
  new TerrainCover(mat,grain);
  mesh.isPickable=false;mesh.freezeWorldMatrix();
  return mesh;
}

class TerrainCover extends MaterialPluginBase {
  constructor(material,texture){super(material,'TerrainCover',200,{},true,true);this.texture=texture;}
  getClassName(){return 'TerrainCover';}
  getSamplers(samplers){samplers.push('terrainCoverSampler');}
  getActiveTextures(textures){textures.push(this.texture);}
  hasTexture(texture){return texture===this.texture;}
  bindForSubMesh(buffer){buffer.setTexture('terrainCoverSampler',this.texture);}
  getCustomCode(type){return type==='fragment'?{
    CUSTOM_FRAGMENT_DEFINITIONS:'uniform sampler2D terrainCoverSampler;',
    CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
      float canopy=texture2D(terrainCoverSampler,vPositionW.xz*.00018).r;
      float cover=texture2D(terrainCoverSampler,vPositionW.xz*.0007).r;
      surfaceAlbedo*=mix(.64,1.15,canopy)*mix(.8,1.12,cover);
    `,
  }:null;}
}
