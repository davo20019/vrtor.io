import { DynamicTexture, MaterialPluginBase, Texture } from '@babylonjs/core';

// Illustrative mineral grain, sampled in world space so untextured scan meshes
// need no invented UVs. Mipmaps filter the grain in stereo instead of shimmering.
export function createGraniteGrain(scene) {
  const texture=new DynamicTexture('illustrative-granite-grain',{width:256,height:256},scene,true,Texture.TRILINEAR_SAMPLINGMODE);
  const ctx=texture.getContext(),data=ctx.createImageData(256,256);
  let seed=71429;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<data.data.length;i+=4){
    const r=random(),v=r<.14?120+random()*40:r>.87?245:190+random()*40;
    data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);texture.update();texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;
  return texture;
}
export class GraniteMaterial extends MaterialPluginBase {
  constructor(material,texture,blocks=false){super(material,'GraniteGrain',200,{},true,true);this.texture=texture;this.blocks=blocks;}
  getClassName(){return 'GraniteMaterial';}
  getSamplers(samplers){samplers.push('graniteGrainSampler');}
  getActiveTextures(textures){textures.push(this.texture);}
  hasTexture(texture){return texture===this.texture;}
  bindForSubMesh(buffer){buffer.setTexture('graniteGrainSampler',this.texture);}
  getCustomCode(type){
    if(type!=='fragment')return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS:'uniform sampler2D graniteGrainSampler;',
      CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
        ${this.blocks?`
        float stoneWall=1.0-smoothstep(.6,.85,abs(normalW.y));
        // The source groups terrace walls with ground cover; restore stone on vertical faces.
        surfaceAlbedo=mix(surfaceAlbedo,vec3(.503,.485,.423),stoneWall);
        `:''}
        vec3 graniteWeights=pow(abs(normalW),vec3(4.0));
        graniteWeights/=max(dot(graniteWeights,vec3(1.0)),0.0001);
        float graniteGrain=dot(vec3(
          texture2D(graniteGrainSampler,vPositionW.yz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xy*2.5).r
        ),graniteWeights);
        surfaceAlbedo*=mix(0.9,1.05,graniteGrain);
        ${this.blocks?`
        // Illustrative joints on the architectural reconstruction, not survey data.
        vec2 stoneUV=abs(normalW.x)>.6?vPositionW.zy:vPositionW.xy;
        stoneUV/=vec2(.62,.28);
        stoneUV.x+=fract(sin(floor(stoneUV.y)*12.9898)*43758.5453)*.65;
        vec2 stoneCell=floor(stoneUV),stoneFraction=fract(stoneUV);
        vec2 stoneEdge=min(stoneFraction,1.0-stoneFraction)*vec2(.62,.28);
        float edgeDistance=min(stoneEdge.x,stoneEdge.y);
        float stoneJoint=1.0-smoothstep(.003,.012+fwidth(edgeDistance),edgeDistance);
        float stoneTone=fract(sin(dot(stoneCell,vec2(12.9898,78.233)))*43758.5453);
        surfaceAlbedo*=mix(1.0,mix(.83,1.02,stoneTone)*mix(1.0,.58,stoneJoint),stoneWall);
        `:''}
      `,
    };
  }
}
