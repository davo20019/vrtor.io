import { Color3, MaterialPluginBase, MeshBuilder, PBRMaterial, Texture, VertexData, VertexBuffer } from '@babylonjs/core';
const BASE=import.meta.env.BASE_URL;
async function load(path,kind){
  const r=await fetch(`${BASE}models/${path}`);
  if(!r.ok)throw new Error('The elevation data could not load.');
  return kind==='json'?r.json():r.arrayBuffer();
}
export async function buildTerrain(scene,grain){
  const [meta,buffer,land,farBuffer]=await Promise.all([load('andes.json','json'),load('andes-height.bin'),load('andes-landscape.json','json'),load('andes-far-height.bin')]);
  const far=land.far;
  if(buffer.byteLength!==meta.resolution**2*4||farBuffer.byteLength!==far.resolution**2*4)throw new Error('The elevation data is incomplete.');
  const heights=new Float32Array(buffer),size=meta.resolution,farHeights=new Float32Array(farBuffer),fs=far.resolution;
  const half=meta.extent/2,farStep=far.extent/(fs-1),band=farStep;
  // Bilinear sample of the distant grid; exact along shared grid lines, so the two meshes meet without cracks.
  const farAt=(x,z)=>{
    const u=(x/far.extent+.5)*(fs-1),v=(z/far.extent+.5)*(fs-1),a=Math.min(fs-2,Math.floor(u)),b=Math.min(fs-2,Math.floor(v)),tu=u-a,tv=v-b;
    const h=(r,c)=>farHeights[r*fs+c];
    return (h(b,a)*(1-tu)+h(b,a+1)*tu)*(1-tv)+(h(b+1,a)*(1-tu)+h(b+1,a+1)*tu)*tv;
  };
  const mesh=MeshBuilder.CreateGround('Andean-terrain',{width:meta.extent,height:meta.extent,subdivisions:size-1,updatable:true},scene);
  const positions=mesh.getVerticesData(VertexBuffer.PositionKind);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],z=positions[i+2];
    const col=Math.round((x/meta.extent+.5)*(size-1)),row=Math.round((z/meta.extent+.5)*(size-1));
    const radius=Math.hypot(x,z),blend=Math.max(0,Math.min(1,(radius-350)/250));
    const smooth=blend*blend*(3-2*blend);
    // This local join is illustrative; the terrain is never a teleport target.
    let y=heights[row*size+col]*smooth-.2*(1-smooth);
    const edge=Math.max(0,1-(half-Math.max(Math.abs(x),Math.abs(z)))/band);
    positions[i+1]=y+(farAt(x,z)-y)*edge;
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
  const imagery=name=>{
    const t=new Texture(`${BASE}models/${land.imagery[name].texture}`,scene,false,true,Texture.TRILINEAR_SAMPLINGMODE);
    t.wrapU=t.wrapV=Texture.CLAMP_ADDRESSMODE;return t;
  };
  const mat=new PBRMaterial('mountain-cover',scene);
  mat.albedoColor=Color3.White();mat.metallic=0;mat.roughness=1;mesh.material=mat;
  new TerrainCover(mat,grain,imagery('near'),land.imagery.near.extent,true);
  mesh.isPickable=false;mesh.freezeWorldMatrix();

  // Distant ring out to 20 km, with the near square cut out along shared grid lines.
  const ring=MeshBuilder.CreateGround('Andean-ranges',{width:far.extent,height:far.extent,subdivisions:fs-1,updatable:true},scene);
  const rp=ring.getVerticesData(VertexBuffer.PositionKind);
  for(let i=0;i<rp.length;i+=3)rp[i+1]=farAt(rp[i],rp[i+2]);
  const kept=[],all=ring.getIndices();
  for(let i=0;i<all.length;i+=3){
    const [a,b,c]=[all[i],all[i+1],all[i+2]];
    const x=(rp[a*3]+rp[b*3]+rp[c*3])/3,z=(rp[a*3+2]+rp[b*3+2]+rp[c*3+2])/3;
    if(Math.abs(x)>half||Math.abs(z)>half)kept.push(a,b,c);
  }
  const rn=[];VertexData.ComputeNormals(rp,kept,rn);
  ring.updateVerticesData(VertexBuffer.PositionKind,rp,true);ring.updateVerticesData(VertexBuffer.NormalKind,rn);ring.setIndices(kept);
  const farMat=new PBRMaterial('distant-range-cover',scene);
  farMat.albedoColor=Color3.White();farMat.metallic=0;farMat.roughness=1;ring.material=farMat;
  new TerrainCover(farMat,grain,imagery('far'),far.extent,false);
  ring.isPickable=false;ring.freezeWorldMatrix();
  return [mesh,ring];
}

// Satellite colour (Sentinel-2 cloudless) on the real relief. Near the citadel, where the
// reconstruction is not georeferenced, it fades back to illustrative cover.
class TerrainCover extends MaterialPluginBase {
  constructor(material,texture,imagery,extent,local){
    super(material,'TerrainCover',200,{TERRAIN_LOCAL:false},true,true);
    this.texture=texture;this.imagery=imagery;this.extent=extent;this.local=local;
  }
  getClassName(){return 'TerrainCover';}
  // Compiled shaders are shared by define set, so per-mesh differences are defines and uniforms.
  prepareDefines(defines){defines.TERRAIN_LOCAL=this.local;}
  getUniforms(){return {ubo:[{name:'terrainExtent',size:1,type:'float'}],fragment:'uniform float terrainExtent;'};}
  isReadyForSubMesh(){return this.texture.isReady()&&this.imagery.isReady();}
  getSamplers(samplers){samplers.push('terrainCoverSampler','terrainImagerySampler');}
  getActiveTextures(textures){textures.push(this.texture,this.imagery);}
  hasTexture(texture){return texture===this.texture||texture===this.imagery;}
  bindForSubMesh(buffer){buffer.updateFloat('terrainExtent',this.extent);buffer.setTexture('terrainCoverSampler',this.texture);buffer.setTexture('terrainImagerySampler',this.imagery);}
  getCustomCode(type){return type==='fragment'?{
    CUSTOM_FRAGMENT_DEFINITIONS:'uniform sampler2D terrainCoverSampler;uniform sampler2D terrainImagerySampler;',
    CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
      float cover=texture2D(terrainCoverSampler,vPositionW.xz*.0007).r;
      // The cloudless mosaic is tone-compressed; restore canopy-like albedo to match the local cover.
      vec3 photo=min(pow(texture2D(terrainImagerySampler,vPositionW.xz/terrainExtent+.5).rgb,vec3(2.2))*4.,vec3(.85));
      photo*=mix(.9,1.06,cover);
      #ifdef TERRAIN_LOCAL
      float canopy=texture2D(terrainCoverSampler,vPositionW.xz*.00018).r;
      vec3 drawn=surfaceAlbedo*mix(.64,1.15,canopy)*mix(.8,1.12,cover);
      surfaceAlbedo=mix(drawn,photo,smoothstep(500.,800.,length(vPositionW.xz)));
      #else
      surfaceAlbedo=photo;
      #endif
    `,
  }:null;}
}
