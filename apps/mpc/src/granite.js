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
// CC0 photo scans graded to colours measured on photographs of the site (assets-src/machu/photo_textures.py).
// Sampled in world space at the scans' real size, so the source's generic UVs aren't needed.
export const SITE_SURFACES={stone:2.0,lawn:1.4,earth:2.07,rock:1.8};
// Linear gains that bring the rendered surfaces, under this scene's sun and sky, to the mean colour of the same
// surfaces in the photographs (measured by sampling rendered pixels the way photo_textures.py samples the photos).
const SITE_GAIN={stone:[2.9,2.7,2.75],lawn:[1.3,1.22,.47],earth:[1.65,1.45,1.7],rock:[2.95,2.65,2.7]};
const vec=a=>`vec3(${a.map(v=>v.toFixed(3)).join(',')})`;
export function loadSiteSurfaces(scene) {
  const load=(name,gamma)=>{
    const t=new Texture(`${import.meta.env.BASE_URL}materials/site-${name}.jpg`,scene,false,true,Texture.TRILINEAR_SAMPLINGMODE);
    t.gammaSpace=gamma;t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;
    return t;
  };
  const out={};
  for(const name of Object.keys(SITE_SURFACES))out[name]={albedo:load(`${name}-albedo`,true),normal:load(`${name}-normal`,false)};
  return out;
}
// Baked from the connected model (scripts/bake-machu-ao.py, encode-machu-ktx2.py); glTF UVs keep it unflipped.
export function loadCitadelOcclusion(scene) {
  const t=new Texture(`${import.meta.env.BASE_URL}materials/citadel-ao.ktx2`,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);
  t.gammaSpace=false;t.coordinatesIndex=1;t.wrapU=t.wrapV=Texture.CLAMP_ADDRESSMODE;
  return t;
}
export class GraniteMaterial extends MaterialPluginBase {
  // kind: the citadel surface ('stone', 'lawn' or 'earth'), 'rock' for the survey closeups, or null for grain only.
  constructor(material,texture,site=null,occlusion=null,kind=null){
    super(material,'GraniteGrain',200,{SITE_LAWN:false,SITE_EARTH:false},true,true);this.texture=texture;this.site=site;this.occlusion=occlusion;this.kind=kind;
    // The ambient slot declares the second UV set; occlusion is applied below, to all light.
    if(occlusion){material.ambientTexture=occlusion;material.ambientTextureStrength=0;}
  }
  getClassName(){return 'GraniteMaterial';}
  // Compiled shaders are shared by define set, so variations must be defines, not code.
  prepareDefines(defines){defines.SITE_LAWN=this.kind==='lawn';defines.SITE_EARTH=this.kind==='earth';}
  get rock(){return this.kind==='rock';}
  textures(){const t=[this.texture];if(this.site){const ground=this.site[this.kind];if(!this.rock)t.push(this.site.stone.albedo,this.site.stone.normal);t.push(ground.albedo,ground.normal);}if(this.occlusion)t.push(this.occlusion);return t;}
  isReadyForSubMesh(){return this.textures().every(t=>t.isReady());}
  getSamplers(samplers){samplers.push('graniteGrainSampler');if(this.site){if(!this.rock)samplers.push('wallAlbedoSampler','wallNormalSampler');samplers.push('groundAlbedoSampler','groundNormalSampler');}if(this.occlusion)samplers.push('citadelOcclusionSampler');}
  getActiveTextures(textures){textures.push(...this.textures());}
  hasTexture(texture){return this.textures().includes(texture);}
  bindForSubMesh(buffer){
    buffer.setTexture('graniteGrainSampler',this.texture);
    if(this.site){const ground=this.site[this.kind];
      if(!this.rock){buffer.setTexture('wallAlbedoSampler',this.site.stone.albedo);buffer.setTexture('wallNormalSampler',this.site.stone.normal);}
      buffer.setTexture('groundAlbedoSampler',ground.albedo);buffer.setTexture('groundNormalSampler',ground.normal);}
    if(this.occlusion)buffer.setTexture('citadelOcclusionSampler',this.occlusion);
  }
  getCustomCode(type){
    if(type!=='fragment')return null;
    const site=this.site&&!this.rock,rock=this.site&&this.rock,tile=k=>(1/SITE_SURFACES[k]).toFixed(5),ground=this.kind;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS:`uniform sampler2D graniteGrainSampler; ${site?'uniform sampler2D wallAlbedoSampler; uniform sampler2D wallNormalSampler;':''}${this.site?'uniform sampler2D groundAlbedoSampler; uniform sampler2D groundNormalSampler;':''}${this.occlusion?'uniform sampler2D citadelOcclusionSampler;':''}
        ${this.site?`
        // Two reads of a scan, the second turned half round and shifted, chosen by metre-scale noise
        // with a narrow seam, so a wall or lawn doesn't show the tile repeating.
        vec2 siteSecond(vec2 uv){return vec2(.63,.29)-uv;}
        vec3 siteLinear(vec3 c){return pow(c,vec3(2.2));}
        `:''}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS:site?`
        // Vertical faces are stone whatever the source groups them with (terrace walls share the lawn material).
        float stoneWall=1.0-smoothstep(.6,.85,abs(normalW.y));
        vec3 stoneAxis=abs(normalW.x)>abs(normalW.z)?vec3(normalW.x>=0.0?1.0:-1.0,0.0,0.0):vec3(0.0,0.0,normalW.z>=0.0?1.0:-1.0);
        vec3 stoneTangent=cross(vec3(0.0,1.0,0.0),stoneAxis);
        vec3 stoneUp=normalize(cross(normalW,stoneTangent));
        vec2 wallAt=vec2(dot(vPositionW,stoneTangent),vPositionW.y);
        vec2 wallUV=wallAt*${tile('stone')};
        float wallPick=smoothstep(.47,.53,texture2D(graniteGrainSampler,wallAt*.0013+.37).r);
        vec3 wallColor=${vec(SITE_GAIN.stone)}*siteLinear(mix(texture2D(wallAlbedoSampler,wallUV).rgb,texture2D(wallAlbedoSampler,siteSecond(wallUV)).rgb,wallPick));
        vec3 wallBump=mix(texture2D(wallNormalSampler,wallUV).rgb*2.0-1.0,-(texture2D(wallNormalSampler,siteSecond(wallUV)).rgb*2.0-1.0)*vec3(1.0,1.0,-1.0),wallPick);
        vec3 wallNormal=normalize(normalW*max(wallBump.z,.2)+stoneTangent*wallBump.x+stoneUp*wallBump.y);
        // Weathering at the scale of whole walls: lichen streaks run down from the tops, patches darken.
        float stoneStreak=texture2D(graniteGrainSampler,vec2(wallAt.x*.006,wallAt.y*.0007)+.11).r;
        float stonePatch=texture2D(graniteGrainSampler,wallAt*.0035+.63).r;
        wallColor*=mix(.86,1.04,stoneStreak)*mix(.9,1.04,stonePatch);
        // Ground and tops: the scan laid flat, x east, z north.
        vec2 groundAt=vPositionW.xz;
        vec2 groundUV=groundAt*${tile(ground)};
        float groundPick=smoothstep(.47,.53,texture2D(graniteGrainSampler,groundAt*.0013+.71).r);
        vec3 groundColor=${vec(SITE_GAIN[ground])}*siteLinear(mix(texture2D(groundAlbedoSampler,groundUV).rgb,texture2D(groundAlbedoSampler,siteSecond(groundUV)).rgb,groundPick));
        vec3 groundBump=mix(texture2D(groundNormalSampler,groundUV).rgb*2.0-1.0,-(texture2D(groundNormalSampler,siteSecond(groundUV)).rgb*2.0-1.0)*vec3(1.0,1.0,-1.0),groundPick);
        vec3 groundNormal=normalize(normalW*max(groundBump.z,.2)+vec3(1.0,0.0,0.0)*groundBump.x+vec3(0.0,0.0,1.0)*groundBump.y);
        #ifdef SITE_LAWN
        // Mown lawn varies in tone across a terrace; worn and fresh patches at two scales.
        groundColor*=mix(.82,1.12,texture2D(graniteGrainSampler,groundAt*.035).r)*mix(.92,1.06,texture2D(graniteGrainSampler,groundAt*.21+.5).r);
        #endif
        #ifdef SITE_EARTH
        groundColor*=mix(.9,1.06,texture2D(graniteGrainSampler,groundAt*.05).r);
        #endif
        surfaceAlbedo=mix(groundColor,wallColor,stoneWall);
        normalW=normalize(mix(groundNormal,wallNormal,stoneWall));
        ${this.occlusion?`
        // Occlusion baked from the model's own geometry darkens corners, wall bases and niches.
        // Lawn faces overlap the earth beneath them in the source, so they keep only their walls.
        // Walls keep about half: the source's large wall triangles bake uneven, triangular occlusion.
        float occlusionStrength=.85*mix(1.0,.45,stoneWall);
        #ifdef SITE_LAWN
        occlusionStrength*=stoneWall;
        #endif
        surfaceAlbedo*=mix(1.0,texture2D(citadelOcclusionSampler,vMainUV2).r,occlusionStrength);
        `:''}
      `:rock?`
        // Weathered granite on the scanned stones, projected from the three axes and blended by the surface's
        // facing. Its colour multiplies the scan's own grey values; the stones and joints are the scan's geometry.
        vec3 rockWeights=pow(abs(normalW),vec3(4.0));
        rockWeights/=max(dot(rockWeights,vec3(1.0)),0.0001);
        vec2 rockX=vPositionW.zy*${tile('rock')},rockY=vPositionW.xz*${tile('rock')},rockZ=vPositionW.xy*${tile('rock')};
        vec3 rockColor=texture2D(groundAlbedoSampler,rockX).rgb*rockWeights.x+texture2D(groundAlbedoSampler,rockY).rgb*rockWeights.y+texture2D(groundAlbedoSampler,rockZ).rgb*rockWeights.z;
        vec2 bumpX=texture2D(groundNormalSampler,rockX).rg*2.0-1.0,bumpY=texture2D(groundNormalSampler,rockY).rg*2.0-1.0,bumpZ=texture2D(groundNormalSampler,rockZ).rg*2.0-1.0;
        normalW=normalize(normalW+(vec3(0.0,bumpX.y,bumpX.x)*rockWeights.x+vec3(bumpY.x,0.0,bumpY.y)*rockWeights.y+vec3(bumpZ.x,bumpZ.y,0.0)*rockWeights.z)*.8);
        surfaceAlbedo*=${vec(SITE_GAIN.rock)}*siteLinear(rockColor);
      `:`
        vec3 graniteWeights=pow(abs(normalW),vec3(4.0));
        graniteWeights/=max(dot(graniteWeights,vec3(1.0)),0.0001);
        float graniteGrain=dot(vec3(
          texture2D(graniteGrainSampler,vPositionW.yz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xz*2.5).r,
          texture2D(graniteGrainSampler,vPositionW.xy*2.5).r
        ),graniteWeights);
        surfaceAlbedo*=mix(0.9,1.05,graniteGrain);
      `,
    };
  }
}
