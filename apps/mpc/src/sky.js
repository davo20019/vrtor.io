import { Color3, Color4, ImageProcessingConfiguration, Mesh, MeshBuilder, StandardMaterial, VertexBuffer } from '@babylonjs/core';

// Sky colour follows the sun: a clearer zenith, haze at the horizon matching the fog,
// and forward-scattered glow around the sun. Vertex colours avoid any UV or seam issues.
const PRESETS = [
  {zenith:'#2a6aae',horizon:'#bdd3de',glow:'#fff4dc'},
  {zenith:'#35679f',horizon:'#d8d3c6',glow:'#ffd9a0'},
];
export function createSky(scene){
  const mesh=MeshBuilder.CreateSphere('sky',{diameter:60000,segments:48,sideOrientation:Mesh.BACKSIDE},scene);
  const mat=new StandardMaterial('sky',scene);
  mat.disableLighting=true;mat.diffuseColor=Color3.Black();mat.emissiveColor=Color3.White();mat.backFaceCulling=false;
  const processing=new ImageProcessingConfiguration();processing.toneMappingEnabled=false;
  mat.imageProcessingConfiguration=processing;
  mesh.material=mat;mesh.isPickable=false;mesh.infiniteDistance=true;mesh.applyFog=false;
  const positions=mesh.getVerticesData(VertexBuffer.PositionKind),colors=new Float32Array(positions.length/3*4);
  function update(sunDirection,preset){
    const p=PRESETS[preset],zenith=Color3.FromHexString(p.zenith),horizon=Color3.FromHexString(p.horizon),glow=Color3.FromHexString(p.glow);
    const s=sunDirection.scale(-1).normalize();
    for(let i=0,j=0;i<positions.length;i+=3,j+=4){
      const len=Math.hypot(positions[i],positions[i+1],positions[i+2]),x=positions[i]/len,y=positions[i+1]/len,z=positions[i+2]/len;
      const e=Math.max(0,y),haze=Math.pow(1-e,4),below=Math.min(0,y);
      const g=Math.max(0,x*s.x+y*s.y+z*s.z),scatter=.16*Math.pow(g,6)+.32*Math.pow(g,48);
      for(let k=0;k<3;k++){
        const key=['r','g','b'][k];
        const base=(zenith[key]+(horizon[key]-zenith[key])*haze)*(1+below*.35);
        colors[j+k]=Math.min(1,base+glow[key]*scatter);
      }
      colors[j+3]=1;
    }
    mesh.setVerticesData(VertexBuffer.ColorKind,colors,true);
    scene.fogColor=horizon;scene.clearColor=new Color4(horizon.r,horizon.g,horizon.b,1);
  }
  return {mesh,update};
}
