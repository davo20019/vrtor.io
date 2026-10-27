import {
  Color3, DirectionalLight, DracoDecoder,
  HemisphericLight, ImageProcessingConfiguration, KhronosTextureContainer2, LoadAssetContainerAsync,
  Mesh, PBRMaterial, ReflectionProbe, RenderTargetTexture,
  Scene, ShadowGenerator, CascadedShadowGenerator, Vector3, VertexData,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createSurfaceWalker } from './walk.js';
import { createSky } from './sky.js';
import { createGrass } from './grass.js';
import { buildTerrain } from './terrain.js';
import { createGraniteGrain, GraniteMaterial, loadCitadelOcclusion, loadSiteSurfaces } from './granite.js';
import { AREAS, SITE } from './areas.js';
import { addWallFrames } from './masonry.js';
const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};
// Self-hosted KTX2 transcoders (public/ktx2); textures stay GPU-compressed on every device.
const ktx2=file=>new URL(`${BASE}ktx2/${file}`,location.href).href;
KhronosTextureContainer2.URLConfig={...KhronosTextureContainer2.URLConfig,
  jsDecoderModule:ktx2('babylon.ktx2Decoder.js'),jsMSCTranscoder:ktx2('msc_basis_transcoder.js'),
  wasmMSCTranscoder:ktx2('msc_basis_transcoder.wasm'),wasmZSTDDecoder:ktx2('zstddec.wasm')};
export const V = (x,y,z) => new Vector3(x,y,z);

export async function buildWorld(engine, onProgress) {
  const response = await fetch(`${BASE}models/survey.json`);
  if (!response.ok) throw new Error('Survey information could not load.');
  const survey = await response.json();
  const siteResponse=await fetch(`${BASE}models/citadel.json`);
  if(!siteResponse.ok)throw new Error('The citadel information could not load.');
  survey.push(await siteResponse.json());
  const masonryResponse=await fetch(`${BASE}models/citadel-masonry.json`);
  if(!masonryResponse.ok)throw new Error('The citadel information could not load.');
  const masonry=await masonryResponse.json();
  const scene = new Scene(engine);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = .00005;
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.08;
  scene.onNewTextureAddedObservable.add(t => t.anisotropicFilteringLevel = Math.min(16, engine.getCaps().maxAnisotropy || 4));
  const sky=createSky(scene);
  const probe=new ReflectionProbe('outdoor-light',128,scene);
  probe.renderList=[sky.mesh];probe.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.35;
  const hemi=new HemisphericLight('sky-light',V(0,1,0),scene);
  hemi.intensity=.62;hemi.diffuse=Color3.FromHexString('#e4edf4');hemi.groundColor=Color3.FromHexString('#747664');
  const sun=new DirectionalLight('sun',V(-.6,-1,.5).normalize(),scene);
  sun.position=V(300,400,-250);sun.intensity=1.7;sun.shadowMinZ=1;sun.shadowMaxZ=1500;
  sky.update(sun.direction,0);
  // The citadel uses cascades: sharp near the viewer, coarser farther out, re-rendered as you move.
  // Scan closeups are small but heavy (up to 2M triangles), so they keep one map rendered once.
  let shadows=null,cascaded=false;
  // Headsets and phones get smaller cascades and cheaper filtering.
  const compact=/OculusBrowser|Quest|Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  function useShadows(site){
    shadows?.dispose();cascaded=site&&engine.webGLVersion>1;
    if(cascaded){
      shadows=new CascadedShadowGenerator(compact?1024:2048,sun);
      shadows.numCascades=3;shadows.lambda=.85;shadows.stabilizeCascades=true;shadows.cascadeBlendPercentage=.08;shadows.depthClamp=true;
      shadows.shadowMaxZ=scene.activeCamera?.getClassName()==='ArcRotateCamera'?1200:220;shadows.bias=.0006;shadows.normalBias=.02;
    }else{
      shadows=new ShadowGenerator(2048,sun);shadows.bias=.0001;shadows.normalBias=.018;
      shadows.getShadowMap().refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }
    shadows.usePercentageCloserFiltering=true;
    shadows.filteringQuality=cascaded&&!compact?ShadowGenerator.QUALITY_MEDIUM:ShadowGenerator.QUALITY_LOW;
  }
  // Walking needs detail close by; the overview orbits far out and needs the whole site covered.
  // Only two ranges: each change marks every lit mesh dirty.
  scene.onActiveCameraChanged.add(()=>{
    if(cascaded)shadows.shadowMaxZ=scene.activeCamera?.getClassName()==='ArcRotateCamera'?1200:220;
  });
  // The elevation backdrop supplies the local ground too, avoiding overlapping planes.
  const grain=createGraniteGrain(scene),siteSurfaces=loadSiteSurfaces(scene),occlusion=loadCitadelOcclusion(scene);
  const [terrain]=await buildTerrain(scene,grain);terrain.receiveShadows=true;
  let current=null, active=-1, light=0;
  const floors=[];
  async function prepare(i, progress=onProgress) {
    if (!AREAS[i]) throw new Error('Unknown survey area.');
    const meta=survey.find(s => s.id === AREAS[i].id);
    const container=await LoadAssetContainerAsync(`${BASE}models/${meta.id}.glb`,scene,{
      onProgress:e => e.lengthComputable && progress?.(e.loaded/e.total),
    });
    const meshes=container.meshes.filter(m => m.getTotalVertices()>0);
    const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);
    if (triangles!==meta.triangles) {container.dispose();throw new Error('Survey geometry did not load completely.');}
    // Lay the citadel's stones along each wall, ashlar where the building is (citadel-masonry.json).
    if(i===SITE)addWallFrames(meshes,masonry.zones);
    for (const m of container.materials) if (m instanceof PBRMaterial) {
      // Open survey surfaces have no modeled thickness; preserve both visible sides.
      m.backFaceCulling=false;m.twoSidedLighting=true;m.metallic=0;
      // The scans' grey values stay; a granite photo scan adds the stone's colour and grain.
      if(i!==SITE){m.albedoColor=Color3.White();m.roughness=.88;new GraniteMaterial(m,grain,siteSurfaces,null,'rock');continue;}
      // The citadel's surfaces are photo scans; the shader sets the albedo.
      const kind=m.name.includes('grass')?'lawn':m.name.includes('earth')?'earth':'stone';
      m.albedoColor=Color3.White();m.albedoTexture=null;m.roughness=kind==='lawn'?.95:.9;
      if(kind==='lawn'){m.zOffset=-2;m.zOffsetUnits=-2;}
      new GraniteMaterial(m,grain,siteSurfaces,occlusion,kind);
    }
    for (const m of meshes) {m.isPickable=false;m.receiveShadows=true;}
    return {i,meta,container,meshes,triangles};
  }
  function activate(prepared) {
    useShadows(prepared.i===SITE);
    for (const f of floors) f.dispose();floors.length=0;
    current?.container.dispose();current=prepared;active=prepared.i;
    prepared.container.addAllToScene();
    for (const m of prepared.meshes) {
      // Overlapping ground faces in the architectural source must not self-shadow.
      if(prepared.i!==SITE||m.material?.name.includes('stone'))shadows.addShadowCaster(m,false);
      m.freezeWorldMatrix();
    }
    const groups=new Map();
    for(const cell of prepared.meta.nav){
      const key=prepared.i===SITE?`${Math.floor(cell[0]/20)},${Math.floor(cell[2]/20)}`:'scan';
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(cell);
    }
    for(const [key,cells] of groups){
    const positions=[],indices=[],normals=[];
    for (const [x,y,z,a,b,c,d] of cells) {
      const h=prepared.meta.step*(prepared.i===SITE?.42:.46), base=positions.length/3;
      positions.push(x-h,a,z-h,x+h,b,z-h,x+h,c,z+h,x-h,d,z+h);
      normals.push(0,1,0,0,1,0,0,1,0,0,1,0);
      indices.push(base,base+2,base+1,base,base+3,base+2);
    }
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;
    const floor=new Mesh(`walking-surface-${key}`,scene);data.applyToMesh(floor);
    floor.visibility=0;floor.isPickable=true;floor.freezeWorldMatrix();floors.push(floor);
    }
    if(!cascaded){
      const map=shadows.getShadowMap();map.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
      scene.executeWhenReady(()=>{if(map!==shadows?.getShadowMap())return;map.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;map.resetRefreshCounter();});
    }
  }
  function daylight() {
    light=(light+1)%2;sun.direction=light?V(.8,-.5,-.3).normalize():V(-.6,-1,.5).normalize();
    sun.diffuse=Color3.FromHexString(light?'#ffe0b0':'#fff9eb');sun.intensity=light?1.55:1.7;
    hemi.diffuse=Color3.FromHexString(light?'#eee5d8':'#e4edf4');
    sky.update(sun.direction,light);probe.cubeTexture.resetRefreshCounter();if(!cascaded)shadows.getShadowMap().resetRefreshCounter();return light?'Late afternoon':'Morning';
  }
  function stop(i=active) {
    const s=survey.find(s => s.id===AREAS[i].id);
    return {...s,stand:V(...s.stand),at:V(...s.at)};
  }
  const walk=createSurfaceWalker(scene,()=>current);
  activate(await prepare(SITE));
  await createGrass(scene,()=>active===SITE);
  return {scene,floors,prepare,activate,daylight,stop,walk,
    get active(){return active;},get triangleCount(){return current.triangles;},
    get monument(){return current.meshes;},
  };
}
