import {
  Color3, Color4, DirectionalLight, DracoDecoder, DynamicTexture,
  HemisphericLight, ImageProcessingConfiguration, LoadAssetContainerAsync,
  Mesh, MeshBuilder, PBRMaterial, ReflectionProbe, RenderTargetTexture,
  Scene, ShadowGenerator, StandardMaterial, Texture, Vector3, VertexData,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { buildTerrain } from './terrain.js';
import { createGraniteGrain, GraniteMaterial } from './granite.js';
import { AREAS } from './areas.js';
const BASE = import.meta.env.BASE_URL;
DracoDecoder.DefaultConfiguration = {
  wasmUrl: `${BASE}draco/draco_wasm_wrapper_gltf.js`,
  wasmBinaryUrl: `${BASE}draco/draco_decoder_gltf.wasm`,
  fallbackUrl: `${BASE}draco/draco_decoder_gltf.js`,
};
export const V = (x,y,z) => new Vector3(x,y,z);

export async function buildWorld(engine, onProgress) {
  const response = await fetch(`${BASE}models/survey.json`);
  if (!response.ok) throw new Error('Survey information could not load.');
  const survey = await response.json();
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.64,.76,.81,1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = .00015;
  scene.fogColor = Color3.FromHexString('#b9cccd');
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1;
  scene.onNewTextureAddedObservable.add(t => t.anisotropicFilteringLevel = Math.min(16, engine.getCaps().maxAnisotropy || 4));
  const sky = MeshBuilder.CreateSphere('sky', {diameter:30000,segments:24,sideOrientation:Mesh.BACKSIDE},scene);
  const texture = new DynamicTexture('sky-gradient',{width:4,height:512},scene,false);
  const ctx=texture.getContext(), gradient=ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,'#598ba9');gradient.addColorStop(.4,'#9bbbc7');gradient.addColorStop(.5,'#c7d6d2');gradient.addColorStop(1,'#718073');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,4,512);texture.update();
  texture.wrapU=texture.wrapV=Texture.CLAMP_ADDRESSMODE;
  const skyMat=new StandardMaterial('sky',scene);
  skyMat.disableLighting=true;skyMat.emissiveTexture=texture;skyMat.backFaceCulling=false;
  sky.material=skyMat;sky.isPickable=false;sky.infiniteDistance=true;sky.applyFog=false;
  const probe=new ReflectionProbe('outdoor-light',128,scene);
  probe.renderList=[sky];probe.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  scene.environmentTexture=probe.cubeTexture;scene.environmentIntensity=.25;
  const hemi=new HemisphericLight('sky-light',V(0,1,0),scene);
  hemi.intensity=.28;hemi.groundColor=Color3.FromHexString('#747664');
  const sun=new DirectionalLight('sun',V(-.6,-1,.5).normalize(),scene);
  sun.position=V(40,60,-35);sun.intensity=2;sun.shadowMinZ=1;sun.shadowMaxZ=150;
  const shadows=new ShadowGenerator(2048,sun);
  shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;
  shadows.bias=.0001;shadows.normalBias=.018;
  const shadowMap=shadows.getShadowMap();shadowMap.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  // A quiet outdoor setting beneath the scan boundary; this is illustrative, not surveyed terrain.
  const ground=MeshBuilder.CreateGround('context-ground',{width:120,height:120},scene);
  ground.position.y=-.15;ground.isPickable=false;ground.receiveShadows=true;
  const groundMat=new PBRMaterial('earth',scene);
  groundMat.albedoColor=Color3.FromHexString('#68705b').toLinearSpace();groundMat.roughness=1;groundMat.metallic=0;ground.material=groundMat;
  await buildTerrain(scene);
  const grain=createGraniteGrain(scene);
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
    for (const m of container.materials) if (m instanceof PBRMaterial) {
      m.albedoColor=Color3.FromHexString('#d8d3c4').toLinearSpace();m.roughness=.88;m.metallic=0;
      // Open survey surfaces have no modeled thickness; preserve both visible sides.
      m.backFaceCulling=false;m.twoSidedLighting=true;new GraniteMaterial(m,grain);
    }
    for (const m of meshes) {m.isPickable=false;m.receiveShadows=true;}
    return {i,meta,container,meshes,triangles};
  }
  function activate(prepared) {
    shadows.getShadowMap().renderList=[];
    for (const f of floors) f.dispose();floors.length=0;
    current?.container.dispose();current=prepared;active=prepared.i;
    prepared.container.addAllToScene();
    for (const m of prepared.meshes) {shadows.addShadowCaster(m,false);m.freezeWorldMatrix();}
    const positions=[],indices=[],normals=[];
    for (const [x,y,z,a,b,c,d] of prepared.meta.nav) {
      const h=prepared.meta.step*.46, base=positions.length/3;
      positions.push(x-h,a,z-h,x+h,b,z-h,x+h,c,z+h,x-h,d,z+h);
      normals.push(0,1,0,0,1,0,0,1,0,0,1,0);
      indices.push(base,base+2,base+1,base,base+3,base+2);
    }
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;
    const floor=new Mesh('survey-walking-surface',scene);data.applyToMesh(floor);
    floor.visibility=0;floor.isPickable=true;floor.freezeWorldMatrix();floors.push(floor);
    shadowMap.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    scene.executeWhenReady(()=>{shadowMap.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;shadowMap.resetRefreshCounter();});
  }
  function daylight() {
    light=(light+1)%2;sun.direction=light?V(.8,-.5,-.3).normalize():V(-.6,-1,.5).normalize();
    sun.diffuse=Color3.FromHexString(light?'#ffe0b0':'#fff9eb');sun.intensity=light?1.8:2;
    shadowMap.resetRefreshCounter();return light?'Late afternoon':'Morning';
  }
  function stop(i=active) {
    const s=survey.find(s => s.id===AREAS[i].id);
    return {...s,stand:V(...s.stand),at:V(...s.at)};
  }
  activate(await prepare(0));
  return {scene,floors,prepare,activate,daylight,stop,
    get active(){return active;},get triangleCount(){return current.triangles;},
    get monument(){return current.meshes;},
  };
}
