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
export const SITE_SURFACES={lawn:1.4,earth:2.07,rock:1.8};
// Linear gains that bring the rendered surfaces, under this scene's sun and sky, to the mean colour of the same
// surfaces in the photographs (measured by sampling rendered pixels the way photo_textures.py samples the photos).
const SITE_GAIN={lawn:[1.3,1.22,.47],earth:[1.65,1.45,1.7],rock:[2.95,2.65,2.7],wall:[3.85,3.55,3.55],scan:[2.92,2.65,2.69]};
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
// Masonry measured on the CAST laser scans (citadel-masonry.json): course height and mean stone length (m), the
// spread of stone lengths, joint half-width and how far the stone's arris is rounded.
const MASONRY_GLSL=`
float masonryHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 masonryHash2(vec2 p){return vec2(masonryHash(p),masonryHash(p+19.19));}
// Courses fitted to the wall: they start at its base and the last one finishes at its top.
// Megalithic courses shrink upwards, from 0.80 m at the base to 0.30 m (the Principal Temple).
void masonryCourse(float v,float H,float kind,out float row,out float c0,out float c1){
  H=max(H,.05);
  if(kind>1.5){
    float hb=.8,ht=.3,k=(ht-hb)/max(H,.5);
    float tH=log(1.0+k*H/hb)/k,n=max(1.0,floor(tH+.5)),s=log(1.0+k*v/hb)/k*n/tH;
    row=floor(s);
    c0=hb*(exp(row*tH/n*k)-1.0)/k;c1=hb*(exp((row+1.0)*tH/n*k)-1.0)/k;
    return;
  }
  // Coursed ashlar about 0.25 m (0.20-0.32), rustic about 0.28 m (0.24-0.36): heights vary course by course.
  float hc=kind>.5?.25:.28,n=max(1.0,floor(H/hc+.5)),step=H/n;
  float r=floor(v/step);
  float lo=(r+.4*(masonryHash(vec2(r,7.0))-.5))*step,hi=(r+1.0+.4*(masonryHash(vec2(r+1.0,7.0))-.5))*step;
  if(r<=0.0)lo=0.0;if(r>=n-1.0)hi=H;
  if(v<lo){r-=1.0;hi=lo;lo=r<=0.0?0.0:(r+.4*(masonryHash(vec2(r,7.0))-.5))*step;}
  else if(v>=hi){r+=1.0;lo=hi;hi=r>=n-1.0?H:(r+1.0+.4*(masonryHash(vec2(r+1.0,7.0))-.5))*step;}
  row=r;c0=lo;c1=hi;
}
// One stone: its id, its distance in from its nearest edges along the wall (x) and up it (y), and which way
// those edges lie (-1 below or behind, +1 above or ahead).
void masonryStone(vec2 at,float H,float kind,out vec2 id,out vec2 edge,out vec2 toward,out float size){
  float row,c0,c1;masonryCourse(at.y,H,kind,row,c0,c1);
  float hc=c1-c0;
  // Stone lengths: coursed 0.28-0.60 m, rustic 0.22-0.60 m (scans); megalithic 1.8-3 course heights (photograph of
  // the Principal Temple's back wall, Laslovarga 116; the scan's mesh splits its long blocks).
  float L=kind>1.5?hc*2.3:kind>.5?.42:.4,spread=kind>1.5?.3:kind>.5?.2:.3;
  float x=at.x+masonryHash(vec2(row,3.0))*L*7.0,j=floor(x/L);
  float e0=(j+spread*(2.0*masonryHash(vec2(j,row))-1.0))*L,e1=(j+1.0+spread*(2.0*masonryHash(vec2(j+1.0,row))-1.0))*L;
  if(x<e0){j-=1.0;e1=e0;e0=(j+spread*(2.0*masonryHash(vec2(j,row))-1.0))*L;}
  else if(x>=e1){j+=1.0;e0=e1;e1=(j+1.0+spread*(2.0*masonryHash(vec2(j+1.0,row))-1.0))*L;}
  id=vec2(j,row);
  edge=vec2(min(x-e0,e1-x),min(at.y-c0,c1-at.y));
  toward=vec2(x-e0<e1-x?-1.0:1.0,at.y-c0<c1-at.y?-1.0:1.0);
  size=min(e1-e0,hc);
}
`;
// Baked from the connected model (scripts/bake-machu-ao.py, encode-machu-ktx2.py); glTF UVs keep it unflipped.
export function loadCitadelOcclusion(scene) {
  const t=new Texture(`${import.meta.env.BASE_URL}materials/citadel-ao.ktx2`,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);
  t.gammaSpace=false;t.coordinatesIndex=1;t.wrapU=t.wrapV=Texture.CLAMP_ADDRESSMODE;
  return t;
}
export class GraniteMaterial extends MaterialPluginBase {
  // kind: the citadel surface ('stone', 'lawn' or 'earth'), 'rock' for the survey closeups, or null for grain only.
  constructor(material,texture,site=null,occlusion=null,kind=null){
    super(material,'GraniteGrain',200,{SITE_LAWN:false,SITE_EARTH:false,SITE_SCAN:false},true,true);this.texture=texture;this.site=site;this.occlusion=occlusion;this.kind=kind;
    // The ambient slot declares the second UV set; occlusion is applied below, to all light.
    if(occlusion){material.ambientTexture=occlusion;material.ambientTextureStrength=0;}
  }
  getClassName(){return 'GraniteMaterial';}
  // Compiled shaders are shared by define set, so variations must be defines, not code.
  prepareDefines(defines){defines.SITE_LAWN=this.kind==='lawn';defines.SITE_EARTH=this.kind==='earth';defines.SITE_SCAN=this.kind==='scan';}
  // 'scan': a CAST scan placed in the citadel (scans.js), shaded as the closeups with its own gain.
  get rock(){return this.kind==='rock'||this.kind==='scan';}
  get citadel(){return this.site&&!this.rock;}
  // Walls are granite stones in mud; the ground is lawn, earth, or granite on wall tops.
  get ground(){return this.site[this.kind==='stone'?'rock':this.kind];}
  textures(){const t=[this.texture];if(this.site){t.push(this.site.rock.albedo,this.site.rock.normal);if(this.citadel)t.push(this.site.earth.albedo,this.ground.albedo,this.ground.normal);}if(this.occlusion)t.push(this.occlusion);return t;}
  isReadyForSubMesh(){return this.textures().every(t=>t.isReady());}
  getSamplers(samplers){samplers.push('graniteGrainSampler');if(this.site){samplers.push('rockAlbedoSampler','rockNormalSampler');if(this.citadel)samplers.push('mortarAlbedoSampler','groundAlbedoSampler','groundNormalSampler');}if(this.occlusion)samplers.push('citadelOcclusionSampler');}
  getAttributes(attributes){if(this.citadel)attributes.push('wallFrame');}
  getActiveTextures(textures){textures.push(...this.textures());}
  hasTexture(texture){return this.textures().includes(texture);}
  bindForSubMesh(buffer){
    buffer.setTexture('graniteGrainSampler',this.texture);
    if(this.site){
      buffer.setTexture('rockAlbedoSampler',this.site.rock.albedo);buffer.setTexture('rockNormalSampler',this.site.rock.normal);
      if(this.citadel){buffer.setTexture('mortarAlbedoSampler',this.site.earth.albedo);buffer.setTexture('groundAlbedoSampler',this.ground.albedo);buffer.setTexture('groundNormalSampler',this.ground.normal);}
    }
    if(this.occlusion)buffer.setTexture('citadelOcclusionSampler',this.occlusion);
  }
  getCustomCode(type){
    const citadel=this.citadel,rock=this.site&&this.rock,tile=k=>(1/SITE_SURFACES[k]).toFixed(5),ground=this.kind==='stone'?'rock':this.kind;
    // Always named: the plugin manager collects injection points from the first call, before this plugin's fields are set.
    if(type==='vertex')return {CUSTOM_VERTEX_DEFINITIONS:citadel?'attribute vec4 wallFrame;varying vec4 vWallFrame;':'',CUSTOM_VERTEX_MAIN_END:citadel?'vWallFrame=wallFrame;':''};
    if(type!=='fragment')return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS:`uniform sampler2D graniteGrainSampler; ${this.site?'uniform sampler2D rockAlbedoSampler; uniform sampler2D rockNormalSampler; vec3 siteLinear(vec3 c){return pow(c,vec3(2.2));}':''}${citadel?'uniform sampler2D mortarAlbedoSampler; uniform sampler2D groundAlbedoSampler; uniform sampler2D groundNormalSampler; varying vec4 vWallFrame;':''}${this.occlusion?'uniform sampler2D citadelOcclusionSampler;':''}
        ${citadel?MASONRY_GLSL+`
        // Stochastic tiling (a triangle grid, three reads shifted at random, blended by sharpened weights):
        // lawns and floors don't show the scan repeating. Shifts only, so normal maps stay valid.
        void siteGrid(vec2 uv,out vec3 w,out vec2 a,out vec2 b,out vec2 c){
          vec2 s=mat2(1.0,0.0,-.57735027,1.15470054)*(uv*3.4641016);vec2 base=floor(s);vec3 t=vec3(fract(s),0.0);t.z=1.0-t.x-t.y;
          if(t.z>0.0){w=vec3(t.z,t.y,t.x);a=base;b=base+vec2(0.0,1.0);c=base+vec2(1.0,0.0);}
          else{w=vec3(-t.z,1.0-t.y,1.0-t.x);a=base+1.0;b=base+vec2(1.0,0.0);c=base+vec2(0.0,1.0);}
          w=pow(w,vec3(6.0));w/=dot(w,vec3(1.0));
        }
        void siteTiled(sampler2D albedo,sampler2D normal,vec2 uv,out vec3 color,out vec3 bump){
          vec3 w;vec2 a,b,c;siteGrid(uv,w,a,b,c);
          vec2 oa=masonryHash2(a)*7.0,ob=masonryHash2(b)*7.0,oc=masonryHash2(c)*7.0;
          color=texture2D(albedo,uv+oa).rgb*w.x+texture2D(albedo,uv+ob).rgb*w.y+texture2D(albedo,uv+oc).rgb*w.z;
          bump=(texture2D(normal,uv+oa).rgb*w.x+texture2D(normal,uv+ob).rgb*w.y+texture2D(normal,uv+oc).rgb*w.z)*2.0-1.0;
        }
        `:''}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS:citadel?`
        // Vertical faces are stone whatever the source groups them with (terrace walls share the lawn material).
        float stoneWall=1.0-smoothstep(.6,.85,abs(normalW.y));
        vec3 stoneTangent=normalize(cross(vec3(0.0,1.0,0.0),normalize(vec3(normalW.x,0.0,normalW.z)+1e-5)));
        vec3 stoneUp=normalize(cross(normalW,stoneTangent));
        // The wall's own frame: along it, height above its base, its height, masonry kind (masonry.js).
        vec2 wallAt=vWallFrame.xy;float wallHeight=vWallFrame.z,wallKind=vWallFrame.w;
        // Metres a pixel covers here: joints, arrises and per-stone colour fade to their average as they shrink.
        // Taken before the branch below: derivatives need every pixel of a quad.
        float pixel=max(length(fwidth(wallAt)),1e-4);
        vec3 wallColor=vec3(0.0),wallNormal=normalW;
        if(wallKind>-.5&&stoneWall>0.0){
        vec2 stoneId,stoneEdge,stoneToward;float stoneSize;
        masonryStone(wallAt,wallHeight,wallKind,stoneId,stoneEdge,stoneToward,stoneSize);
        bool rustic=wallKind<.5;
        // Rustic stones are roughly squared, with rounded corners and wandering edges, set in mud joints a few cm
        // wide; ashlar joints are hairline and the arrises rounded over about 15 mm.
        float wander=rustic?(texture2D(graniteGrainSampler,wallAt*.03+stoneId*.13).r-.5)*.05:0.0;
        float corner=rustic?.07:.02;
        vec2 inner=stoneEdge+wander;
        float edgeDistance=min(inner.x,inner.y);
        if(inner.x<corner&&inner.y<corner)edgeDistance=corner-length(corner-inner);
        // Arrises, measured across joints on full-size photographs scaled by the scans' course heights: rounded
        // over about 17 mm on the Torreón, 35 mm on the Principal Temple (the scans' 31-47 mm mesh can't resolve them).
        float joint=rustic?.016:.0015,arris=rustic?.05:wallKind>1.5?.035:.017;
        float mortar=1.0-smoothstep(joint-pixel,joint+pixel,edgeDistance);
        float jointShare=clamp(2.0*joint*(2.0/max(stoneSize,.1)),0.0,1.0);
        mortar=mix(mortar,jointShare,smoothstep(joint,joint*6.0,pixel));
        // The stone's face rounds off towards its nearest edge.
        float slope=(1.0-smoothstep(0.0,arris,edgeDistance-joint))*(1.0-smoothstep(arris*.5,arris*3.0,pixel));
        vec2 nearest=inner.x<inner.y?vec2(stoneToward.x,0.0):vec2(0.0,stoneToward.y);
        if(inner.x<corner&&inner.y<corner)nearest=stoneToward*normalize(max(corner-inner,1e-4));
        vec2 bevel=nearest*slope*(rustic?.7:.5);
        // Every stone shows a different patch of the granite scan, and its own tone.
        vec2 stoneUV=wallAt*${tile('rock')}+masonryHash2(stoneId)*5.0;
        float tone=mix(1.0,mix(rustic?.8:.9,rustic?1.15:1.08,masonryHash(stoneId+41.0)),1.0-smoothstep(stoneSize*.08,stoneSize*.25,pixel));
        vec3 stoneColor=${vec(SITE_GAIN.wall)}*siteLinear(texture2D(rockAlbedoSampler,stoneUV).rgb)*tone;
        vec3 stoneBump=texture2D(rockNormalSampler,stoneUV).rgb*2.0-1.0;
        // Mud mortar, recessed into shadow.
        vec3 mortarColor=${vec(SITE_GAIN.earth)}*siteLinear(texture2D(mortarAlbedoSampler,wallAt*${tile('earth')}).rgb)*(rustic?.55:.35);
        wallColor=mix(stoneColor,mortarColor,mortar);
        // The rounded arris turns away from the light: a shade line along every joint, kept (as its average)
        // when it is narrower than a pixel, so joints still read from across a court as they do on site.
        float arrisShade=1.0-.3*(1.0-smoothstep(joint,joint+arris,edgeDistance));
        float arrisMean=1.0-.3*clamp(arris*2.0/max(stoneSize,.1)*1.5,0.0,1.0);
        wallColor*=mix(arrisShade,arrisMean,smoothstep(arris*.5,arris*2.0,pixel));
        // Weathering at the scale of whole walls: lichen streaks run down from the tops, patches darken.
        float stoneStreak=texture2D(graniteGrainSampler,vec2(wallAt.x*.006,wallAt.y*.0007)+.11).r;
        float stonePatch=texture2D(graniteGrainSampler,wallAt*.0035+.63).r;
        wallColor*=mix(.86,1.04,stoneStreak)*mix(.9,1.04,stonePatch);
        vec2 wallSlope=stoneBump.xy*(1.0-mortar)+bevel;
        wallNormal=normalize(normalW*max(stoneBump.z,.3)+stoneTangent*wallSlope.x+stoneUp*wallSlope.y);
        }
        // Ground and wall tops: the scan laid flat, tiled stochastically.
        vec2 groundAt=vPositionW.xz;
        vec3 groundColor,groundBump;
        siteTiled(groundAlbedoSampler,groundNormalSampler,groundAt*${tile(ground)},groundColor,groundBump);
        groundColor=${vec(SITE_GAIN[ground])}*siteLinear(groundColor);
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
        vec3 rockColor=texture2D(rockAlbedoSampler,rockX).rgb*rockWeights.x+texture2D(rockAlbedoSampler,rockY).rgb*rockWeights.y+texture2D(rockAlbedoSampler,rockZ).rgb*rockWeights.z;
        vec2 bumpX=texture2D(rockNormalSampler,rockX).rg*2.0-1.0,bumpY=texture2D(rockNormalSampler,rockY).rg*2.0-1.0,bumpZ=texture2D(rockNormalSampler,rockZ).rg*2.0-1.0;
        normalW=normalize(normalW+(vec3(0.0,bumpX.y,bumpX.x)*rockWeights.x+vec3(bumpY.x,0.0,bumpY.y)*rockWeights.y+vec3(bumpZ.x,bumpZ.y,0.0)*rockWeights.z)*${this.kind==='scan'?'.25':'.8'});
        ${this.kind==='scan'?`
        // A placed scan carries its stones in its baked relief and grey values: the granite photo adds only its
        // colour and fine grain, its broad mottling evened out, so the joints read.
        rockColor=mix(texture2D(rockAlbedoSampler,rockY,8.0).rgb,rockColor,.4);
        `:''}
        surfaceAlbedo*=${vec(SITE_GAIN[this.kind])}*siteLinear(rockColor);
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
