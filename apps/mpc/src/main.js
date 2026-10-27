import { ArcRotateCamera, DefaultRenderingPipeline, Engine, UniversalCamera, Vector3 } from '@babylonjs/core';
import { createCard, createMenuControls, createPresence, createXr, mountPresenceControls, presenceCard, roomsCard, continueInVr, xrPose, xrSupported } from '@vrtor/xr-shell';
import { buildWorld, V } from './world.js';
import { AREAS, SITE } from './areas.js';
import { LESSONS } from './lesson.js';
import './style.css';
const $=s=>document.querySelector(s);
const ui={loading:$('.loading'),pct:$('.loading-pct'),card:$('.card'),kicker:$('.card-kicker'),title:$('.card-title'),body:$('.card-body'),fact:$('.card-fact'),actions:$('.card-actions'),vr:$('[data-enter-vr]'),learn:$('[data-lesson]'),view:$('[data-view]'),light:$('[data-light]'),site:$('[data-site]'),next:$('[data-next]'),status:$('.area-status'),hint:$('.hint')};
const engine=new Engine($('#scene'),true,{xrCompatible:true,stencil:true},true);
let world,scene,camera,walker,panel,rig,flight,sitePose,presence;
const keys=new Set();
let destination=null;
let lesson=-1,phase='observe',feedback='',score=0,answered=new Set(),cardOpen=true,busy=true,walkView=true,people=false,rooms=false;
const inXr=()=>!!rig?.inXr();
const action=(label,onClick,primary=false)=>({label,onClick:()=>{if(!busy)onClick();},primary});
const siteCredit='Model: Ministerio de Cultura Perú, CC BY 4.0. Surfaces: Poly Haven and ambientCG photo scans (CC0), graded to photographs of the site; masonry sizes from the CAST scans; building identification © OpenStreetMap contributors. Torreón, Principal Temple and Water Mirrors: CAST laser scans (INC Peru, CAST University of Arkansas, Cotsen Institute UCLA), CC BY-NC 3.0. Adapted by VRtor; layout and scale approximate.';
const controls='Left stick: walk. Right stick: forward to teleport, left or right to turn. Trigger selects. A or X opens and closes this card; B or Y joins other visitors, then turns your mic on and off.';
const credit='Survey: INC Peru, CAST (University of Arkansas) and Cotsen Institute (UCLA). CC BY-NC 3.0; adapted by VRtor.';
function content(){
  const area=AREAS[destination??world?.active??0];
  if(busy)return {kicker:'Preparing the survey',title:'Traveling…',body:`Loading ${area.name}. Each area keeps the published mesh geometry.`,fact:'',actions:[]};
  if(rooms)return roomsCard('mpc',rig,action,()=>{rooms=false;render();});
  if(people&&presence)return presenceCard(presence,action,()=>{people=false;render();});
  if(lesson<0&&world.active===SITE)return {kicker:'World wonders · 02 · Connected walkthrough',title:'Walk through Machu Picchu',body:'Explore the paths, terraces and courts of the citadel in one connected architectural model. Close this card to look around freely. The detailed survey closeups are available through Learn.',fact:`${inXr()?controls:'Drag to look. Use WASD or the arrow keys to walk. Click a path to travel farther. On a phone, hold the movement arrows.'}\n${siteCredit}`,actions:[action('Start walking',()=>{walkView=true;if(!inXr()&&scene.activeCamera!==walker)frameArea(true);close();},true),action('Learn',restart),...peopleAction()]};
  if(lesson<0)return {kicker:`World wonders · 02 · ${world.active+1} / 6`,title:area.name,body:`${area.detail}. Explore six laser-scanned spaces at Machu Picchu, or follow four short investigations. These are separate survey areas, with gaps in coverage.`,fact:inXr()?`${controls}\n${credit}`:credit,actions:[action('Explore',close),action('Next area',()=>visit((world.active+1)%6)),action('Learn',restart,true)]};
  if(lesson>=LESSONS.length)return {kicker:'Lesson complete',title:`${score} of 4 first try`,body:'You compared fitted masonry, a curved temple wall, carved bedrock and natural rock integrated into buildings. Continue into the Water Mirrors Room and Knob Room.',fact:credit,actions:[action('Again',restart),action('More areas',()=>visit(4),true)]};
  const l=LESSONS[lesson];
  if(phase==='question')return {kicker:`Challenge ${lesson+1} of 4`,title:l.question,body:feedback||'Look closely at the scanned stonework before choosing. You can try again.',fact:'',actions:l.choices.map((c,i)=>action(c,()=>answer(i)))};
  if(phase==='answered')return {kicker:`Challenge ${lesson+1} of 4 · Correct`,title:'You found it',body:l.why,fact:feedback,actions:[action('Look around',close),action(lesson===3?'Finish':'Next',()=>go(lesson+1),true)]};
  return {kicker:`Investigate ${lesson+1} of 4`,title:l.title,body:l.body,fact:l.fact,actions:[action(lesson===2?'Change light':'Explore',lesson===2?changeLight:close),action('Test me',()=>{phase='question';feedback='';render();},true)]};
}
// In the headset the bar isn't visible, so visitors are a page of the card.
function peopleAction(){
  if(!inXr()||!presence||presence.state.status!=='online')return [];
  const s=presence.state,open=()=>{people=true;render();};
  // One step to join from the walk card; B or Y does the same anywhere (presence.attachXr).
  if(!s.joined)return [action(s.online>1?`Join ${s.online-1} here`:'Join others',()=>{presence.join();open();})];
  return [action(`People · ${s.here}`,open)];
}
function poseNow(){
  if(busy||!world)return null;
  if(inXr())return xrPose(rig,world.active);
  return {area:world.active,head:walker.position,forward:walker.getDirection(Vector3.Forward())};
}
function answer(choice){
  const l=LESSONS[lesson],first=!answered.has(lesson);answered.add(lesson);
  if(choice!==l.answer){feedback='Try again. '+l.hint;render();return;}
  if(first)score++;
  feedback=first?'Correct on your first try.':'Correct after another look.';phase='answered';render();
}
function render(){
  const data=content();
  const onSite=world?.active===SITE;
  ui.next.hidden=onSite;ui.site.hidden=onSite;
  document.body.classList.toggle('card-open',cardOpen);document.body.classList.toggle('walking',walkView);
  for(const el of [ui.site,ui.next,ui.learn,ui.view,ui.light])el.disabled=busy;
  if(inXr()){
    ui.card.hidden=true;
    if(!cardOpen){panel.hide();return;}
    if(!onSite&&!busy&&!people&&!rooms)data.actions.push(action('Back to walk',()=>{walkView=true;visit(SITE);}));
    if(new URLSearchParams(location.search).has('xrdebug'))data.kicker=rig.stats();
    panel.setContent({...data,tools:tools(),onClose:close});
    const f=rig.headForward(),a=-.45;
    panel.place(rig.headPosition(),V(f.x*Math.cos(a)+f.z*Math.sin(a),0,-f.x*Math.sin(a)+f.z*Math.cos(a)));
    return;
  }
  panel?.hide();ui.card.hidden=!cardOpen;
  if(!cardOpen)return;
  ui.kicker.textContent=data.kicker;ui.title.textContent=data.title;ui.body.textContent=data.body;ui.fact.textContent=data.fact;ui.fact.hidden=!data.fact;
  ui.actions.replaceChildren(...data.actions.map(a=>{const b=document.createElement('button');b.type='button';b.className=a.primary?'btn btn-primary':'btn';b.textContent=a.label;b.disabled=busy;b.addEventListener('click',a.onClick);return b;}));
}
// In the headset the bar isn't visible: its buttons are a strip under the card (the view switch is for flat screens only).
function tools(){if(busy||people||rooms)return [];const room=action('Change room',()=>{rooms=true;people=false;cardOpen=true;render();});return lesson===2&&phase!=='question'&&phase!=='answered'?[room]:[action('Change light',changeLight),room];}
function close(){cardOpen=false;people=false;rooms=false;render();if(!inXr())$('#scene').focus({preventScroll:true});}
function changeLight(){ui.light.textContent=world.daylight();render();}
function frameArea(walk=walkView){
  const s=world.stop();
  if(walk){
    camera.detachControl();scene.activeCamera=walker;
    const pose=world.active===SITE&&sitePose?sitePose:s;
    const eye=pose.stand.add(V(0,1.65,0)),target=pose.at.clone();target.y=eye.y;
    if(Vector3.Distance(eye,target)<1)target.z-=2;
    walker.position.copyFrom(eye);walker.setTarget(target);walker.attachControl($('#scene'),true);
    flight=null;
  }else{
    walker.detachControl();scene.activeCamera=camera;camera.attachControl($('#scene'),true);
    const size=Math.max(s.bounds[0],s.bounds[2]),target=V(0,s.bounds[1]*.42,0);
    animateCamera(V(size*.65,s.bounds[1]+size*.28,-size*.8),target);
  }
  ui.view.textContent=walk?'Overview':'Walk';
  ui.hint.textContent=walk?'Drag to look · WASD to walk · click a path to travel':'Drag to orbit · scroll to move closer';
}
function saveSitePose(){
  if(world.active!==SITE)return;
  if(inXr()){
    const head=rig.headPosition(),height=rig.xr.baseExperience.camera.realWorldHeight;
    sitePose={stand:head.subtract(V(0,height,0)),at:head.add(rig.headForward().scale(30))};
  }else if(scene.activeCamera===walker){
    sitePose={stand:walker.position.subtract(V(0,1.65,0)),at:walker.position.add(walker.getForwardRay().direction.scale(30))};
  }
}
function animateCamera(eye,target){
  const off=eye.subtract(target);
  flight={target,radius:off.length(),alpha:Math.atan2(off.z,off.x),beta:Math.acos(off.y/off.length())};
}
async function travel(i){
  if(busy)return false;
  saveSitePose();busy=true;destination=i;ui.status.textContent=`Loading ${AREAS[i].name}…`;cardOpen=true;render();
  let prepared;
  try{
    if(i!==world.active)prepared=await world.prepare(i,p=>ui.status.textContent=`Loading ${AREAS[i].name} · ${Math.round(p*100)}%`);
    const stop=i===SITE&&sitePose?sitePose:world.stop(i);
    const activate=()=>{
      if(!prepared)return;
      const teleport=rig?.xr.teleportation;
      for(const floor of world.floors)teleport?.removeFloorMesh(floor);
      world.activate(prepared);prepared=null;
      for(const floor of world.floors)teleport?.addFloorMesh(floor);
    };
    if(inXr())await rig.moveTo(stop.stand,stop.at,activate);
    else {activate();frameArea();}
    ui.status.textContent=i===SITE?'Connected citadel walkthrough':`${AREAS[i].name} · Closeup ${i+1} of 6`;
    return true;
  }catch(e){
    prepared?.container.dispose();console.error('[mpc] Area loading failed',e);
    ui.status.textContent='This area could not load. Choose it again to retry.';
    return false;
  }finally{busy=false;destination=null;render();}
}
async function visit(i){
  if(busy)return;
  lesson=-1;phase='observe';feedback='';rooms=false;await travel(i);render();
}
async function go(i){
  if(busy)return;
  // Commit the lesson only after its area loads, so failures remain retryable.
  if(i<LESSONS.length&&!(await travel(LESSONS[i].view)))return;
  lesson=i;phase='observe';feedback='';cardOpen=true;rooms=false;render();
}
function restart(){if(busy)return;score=0;answered=new Set();go(0);}
async function start(){
  world=await buildWorld(engine,p=>ui.pct.textContent=`${Math.round(p*100)}%`);scene=world.scene;
  camera=new ArcRotateCamera('orbit',0,1,25,V(0,2,0),scene);
  camera.minZ=.04;camera.maxZ=32000;camera.lowerRadiusLimit=.45;camera.upperRadiusLimit=900;camera.lowerBetaLimit=.08;camera.upperBetaLimit=2.8;camera.wheelDeltaPercentage=.012;camera.pinchDeltaPercentage=.004;camera.panningSensibility=0;
  walker=new UniversalCamera('walk',V(0,2,0),scene);walker.minZ=.06;walker.maxZ=32000;walker.angularSensibility=2200;walker.inertia=0;
  walker.keysUp=[];walker.keysDown=[];walker.keysLeft=[];walker.keysRight=[];
  // Desktop and phone only: the headset camera keeps its own MSAA layer and per-material tone mapping.
  const pipeline=new DefaultRenderingPipeline('sharp-view',false,scene,[camera,walker]);
  pipeline.imageProcessingEnabled=false;pipeline.samples=engine.webGLVersion>1?4:1;pipeline.fxaaEnabled=pipeline.samples<2;
  pipeline.sharpenEnabled=true;pipeline.sharpen.edgeAmount=.22;pipeline.sharpen.colorAmount=1;
  panel=createCard(scene,{name:'machu-lesson',height:.88});
  let refreshBar=()=>{};
  presence=createPresence(scene,{subject:'mpc',getPose:poseNow,onChange:state=>{
    refreshBar(state);
    // Refresh the open headset card in place (render() would also move it to where you look).
    if(inXr()&&cardOpen&&!busy&&(people||(lesson<0&&world.active===SITE)))panel.setContent({...content(),tools:tools(),onClose:close});
  }});
  refreshBar=mountPresenceControls(presence,$('.presence-controls'));refreshBar(presence.state);
  if(new URLSearchParams(location.search).has('xrdebug'))window.vrtorPresence=presence;
  frameArea(true);
  try{if(await xrSupported()){rig=await createXr(scene,{floorMeshes:world.floors,start:{get position(){return world.stop().stand;},get lookAt(){return world.stop().at;}}});}}catch(e){console.warn('[mpc] VR unavailable',e);}
  if(rig){
    ui.vr.hidden=false;document.body.classList.add('xr-ready');for(const p of panel.panels)rig.mirrorPanel(p,{interactive:true});
    let frames=-1;
    rig.onChange(entered=>{document.body.classList.toggle('in-xr',entered);frames=entered?0:-1;if(!entered){frameArea();render();}});
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(()=>{
      if(frames<0||++frames<6)return;frames=-1;cardOpen=true;
      // The initial floor-aware pose already matches the active area.
      render();
    });
    presence.attachXr(rig.xr);
    // A, X or the menu button: the card in front of you, or away when it's already there.
    createMenuControls(scene,rig,panel,{open:()=>{cardOpen=true;render();},close});
  }
  scene.onBeforeRenderObservable.add(()=>{
    if(!inXr()&&!busy&&scene.activeCamera===walker){
      const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
      const side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
      if(forward||side){
        const f=walker.getForwardRay().direction;f.y=0;f.normalize();
        const direction=f.scale(forward).add(V(f.z,0,-f.x).scale(side)).normalize();
        const distance=1.7*Math.min(.08,engine.getDeltaTime()/1000);
        const step=direction.scale(distance);
        // Blocked straight on (a wall, a ledge): slide along it on whichever axis still goes.
        const p=world.walk(walker.position,step)??world.walk(walker.position,V(step.x,0,0))??world.walk(walker.position,V(0,0,step.z));
        if(p)walker.position.copyFrom(p);
      }
    }
    if(!flight||inXr()||scene.activeCamera!==camera)return;
    const k=Math.min(1,engine.getDeltaTime()/120);
    Vector3.LerpToRef(camera.target,flight.target,k,camera.target);
    const da=Math.atan2(Math.sin(flight.alpha-camera.alpha),Math.cos(flight.alpha-camera.alpha));
    camera.alpha+=da*k;camera.beta+=(flight.beta-camera.beta)*k;camera.radius+=(flight.radius-camera.radius)*k;
    if(Math.abs(da)<.001&&Vector3.Distance(camera.target,flight.target)<.01&&Math.abs(camera.radius-flight.radius)<.01)flight=null;
  });
  // Hide the loading screen once the citadel and terrain shaders are compiled, so nothing pops in.
  // Only these meshes: shared shell textures may stay unready, and a slow device must not hang here.
  const shown=[...world.monument,...scene.meshes.filter(m=>m.name.startsWith('Andean'))],until=performance.now()+8000;
  await new Promise(done=>{const check=()=>shown.every(m=>m.isReady(true))||performance.now()>until?done():setTimeout(check,100);check();});
  continueInVr(rig,ui.vr);
  ui.loading.hidden=true;ui.hint.hidden=false;busy=false;
  ui.status.textContent='Connected citadel walkthrough';render();
}
ui.site.addEventListener('click',()=>{walkView=true;visit(SITE);});
ui.next.addEventListener('click',()=>visit((world.active+1)%6));
ui.learn.addEventListener('click',()=>{cardOpen=true;if(lesson<0)restart();else render();});
ui.view.addEventListener('click',()=>{saveSitePose();walkView=!walkView;frameArea();render();});
ui.light.addEventListener('click',changeLight);
ui.vr.addEventListener('click',async()=>{ui.vr.disabled=true;try{await rig.enter();}catch(e){console.warn('[mpc] Enter VR failed',e);ui.status.textContent='VR could not start. Try Enter VR again, or explore here.';}finally{ui.vr.disabled=false;}});
$('[data-retry]').addEventListener('click',()=>location.reload());
$('.card-close').addEventListener('click',close);
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){close();return;}
  if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();keys.add(key);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
for(const b of document.querySelectorAll('[data-move]')){
  let pressedAt=0;
  b.addEventListener('pointerdown',e=>{pressedAt=performance.now();e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);});
  b.addEventListener('click',()=>{
    if(busy||inXr()||scene.activeCamera!==walker||(pressedAt&&performance.now()-pressedAt>220))return;
    const f=walker.getForwardRay().direction;f.y=0;f.normalize();
    const key=b.dataset.move,d=key==='w'?f:key==='s'?f.scale(-1):key==='d'?V(f.z,0,-f.x):V(-f.z,0,f.x);
    const next=world.walk(walker.position,d.scale(.35));if(next)walker.position.copyFrom(next);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>keys.delete(b.dataset.move));
}
$('#scene').addEventListener('pointerdown',()=>flight=null);$('#scene').addEventListener('wheel',()=>flight=null,{passive:true});
let pointerStart;
$('#scene').addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});
$('#scene').addEventListener('pointerup',e=>{
  if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6||busy||inXr()||scene.activeCamera!==walker)return;
  const rect=$('#scene').getBoundingClientRect();
  const pick=scene.pick(e.clientX-rect.left,e.clientY-rect.top,m=>world.floors.includes(m)||world.monument.includes(m)||(m.isPickable&&presence?.isAvatar(m)));
  // A click on someone mutes them (presence.js); it isn't a walk.
  if(!pick?.hit||!world.floors.includes(pick.pickedMesh))return;
  const destination=pick.pickedPoint.add(V(0,1.65,0));
  const allowed=world.walk(destination,Vector3.Zero());
  if(allowed){walker.position.copyFrom(allowed);close();}
});
window.addEventListener('resize',()=>engine.resize());engine.runRenderLoop(()=>scene?.render());
start().catch(e=>{console.error('[mpc]',e);ui.pct.textContent='The survey could not load. Please try again.';$('[data-retry]').hidden=false;});
