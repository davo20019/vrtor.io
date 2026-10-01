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
export function loadSurveyStone(scene) {
  const load=name=>{
    const t=new Texture(`${import.meta.env.BASE_URL}materials/${name}.png`,scene,false,true,Texture.TRILINEAR_SAMPLINGMODE);
    t.gammaSpace=false;t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;
    return t;
  };
  return {normal:load('survey-stone-normal'),relief:load('survey-stone-relief')};
}
export class GraniteMaterial extends MaterialPluginBase {
  constructor(material,texture,survey=null){super(material,'GraniteGrain',200,{},true,true);this.texture=texture;this.survey=survey;}
  getClassName(){return 'GraniteMaterial';}
  isReadyForSubMesh(){return this.texture.isReady()&&(!this.survey||(this.survey.normal.isReady()&&this.survey.relief.isReady()));}
  getSamplers(samplers){samplers.push('graniteGrainSampler');if(this.survey)samplers.push('surveyNormalSampler','surveyReliefSampler');}
  getActiveTextures(textures){textures.push(this.texture);if(this.survey)textures.push(this.survey.normal,this.survey.relief);}
  hasTexture(texture){return texture===this.texture||texture===this.survey?.normal||texture===this.survey?.relief;}
  bindForSubMesh(buffer){buffer.setTexture('graniteGrainSampler',this.texture);if(this.survey){buffer.setTexture('surveyNormalSampler',this.survey.normal);buffer.setTexture('surveyReliefSampler',this.survey.relief);}}
  getCustomCode(type){
    if(type!=='fragment')return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS:`uniform sampler2D graniteGrainSampler; ${this.survey?'uniform sampler2D surveyNormalSampler; uniform sampler2D surveyReliefSampler;':''}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
        ${this.survey?`
        float stoneWall=1.0-smoothstep(.6,.85,abs(normalW.y));
        // The source groups terrace walls with ground cover; restore stone on vertical faces.
        surfaceAlbedo=mix(surfaceAlbedo,vec3(.43,.413,.371),stoneWall);
        `:''}
        vec3 graniteWeights=pow(abs(normalW),vec3(4.0));
        graniteWeights/=max(dot(graniteWeights,vec3(1.0)),0.0001);
        float graniteGrain=dot(vec3(
          texture2D(graniteGrainSampler,vPositionW.yz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xy*2.5).r
        ),graniteWeights);
        surfaceAlbedo*=mix(0.9,1.05,graniteGrain);
        ${this.survey?`
        // Physical 4 m × 1.4 m relief sampled from the Main Temple laser geometry.
        // Reusing this patch gives measured surface cues, not a survey of every wall.
        vec3 stoneAxis=abs(normalW.x)>abs(normalW.z)?vec3(normalW.x>=0.0?1.0:-1.0,0.0,0.0):vec3(0.0,0.0,normalW.z>=0.0?1.0:-1.0);
        vec3 stoneTangent=cross(vec3(0.0,1.0,0.0),stoneAxis);
        vec3 stoneUp=normalize(cross(normalW,stoneTangent));
        vec2 stoneUV=vec2(dot(vPositionW,stoneTangent)/4.0,vPositionW.y/1.4);
        vec3 stoneCapture=texture2D(surveyReliefSampler,stoneUV).rgb;
        vec3 stoneNormal=texture2D(surveyNormalSampler,stoneUV).rgb*2.0-1.0;
        vec3 fittedNormal=normalize(normalW*stoneNormal.z+stoneTangent*stoneNormal.x*.65+stoneUp*stoneNormal.y*.65);
        normalW=normalize(mix(normalW,fittedNormal,stoneWall));
        surfaceAlbedo*=mix(1.0,stoneCapture.r*mix(.92,1.08,stoneCapture.g),stoneWall);
        // Mottled ground cover at two scales; no photo texture or fabricated brick grid.
        float groundCover=texture2D(graniteGrainSampler,vPositionW.xz*.035).r;
        float groundFine=texture2D(graniteGrainSampler,vPositionW.xz*.8).r;
        surfaceAlbedo*=mix(mix(.72,1.18,groundCover)*mix(.86,1.08,groundFine),1.0,stoneWall);
        `:''}
      `,
    };
  }
}
