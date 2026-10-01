import { ArcRotateCamera, Engine, Vector3 } from '@babylonjs/core';
import { createCard, createXr, xrSupported } from '@vrtor/xr-shell';
import { buildWorld, V } from './world.js';
import { AREAS } from './areas.js';
import { LESSONS } from './lesson.js';
import './style.css';
const $=s=>document.querySelector(s);
const ui={loading:$('.loading'),pct:$('.loading-pct'),card:$('.card'),kicker:$('.card-kicker'),title:$('.card-title'),body:$('.card-body'),fact:$('.card-fact'),actions:$('.card-actions'),vr:$('[data-enter-vr]'),learn:$('[data-lesson]'),view:$('[data-view]'),light:$('[data-light]'),area:$('[data-area]'),next:$('[data-next]'),status:$('.area-status'),hint:$('.hint')};
const engine=new Engine($('#scene'),true,{xrCompatible:true,stencil:true},true);
let world,scene,camera,panel,rig,flight;
let destination=null;
let lesson=-1,phase='observe',feedback='',score=0,answered=new Set(),cardOpen=true,busy=true,walkView=false;
const inXr=()=>!!rig?.inXr();
const action=(label,onClick,primary=false)=>({label,onClick:()=>{if(!busy)onClick();},primary});
const controls='Push the stick forward to teleport; left or right to turn. Trigger selects. A or X reopens this card.';
const credit='Survey: INC Peru, CAST (University of Arkansas) and Cotsen Institute (UCLA). CC BY-NC 3.0; adapted by vrtor.';
function content(){
  const area=AREAS[destination??world?.active??0];
  if(busy)return {kicker:'Preparing the survey',title:'Traveling…',body:`Loading ${area.name}. Each area keeps the published mesh geometry.`,fact:'',actions:[]};
  if(lesson<0)return {kicker:`World wonders · 02 · ${world.active+1} / 6`,title:area.name,body:`${area.detail}. Explore six laser-scanned spaces at Machu Picchu, or follow four short investigations. These are separate survey areas, with gaps in coverage.`,fact:inXr()?`${controls}\n${credit}`:credit,actions:[action('Explore',close),action('Next area',()=>visit((world.active+1)%AREAS.length)),action('Learn',restart,true)]};
  if(lesson>=LESSONS.length)return {kicker:'Lesson complete',title:`${score} of 4 first try`,body:'You compared fitted masonry, a curved temple wall, carved bedrock and natural rock integrated into buildings. Continue into the Water Mirrors Room and Knob Room.',fact:credit,actions:[action('Again',restart),action('More areas',()=>visit(4),true)]};
  const l=LESSONS[lesson];
  if(phase==='question')return {kicker:`Challenge ${lesson+1} of 4`,title:l.question,body:feedback||'Look closely at the scanned stonework before choosing. You can try again.',fact:'',actions:l.choices.map((c,i)=>action(c,()=>answer(i)))};
  if(phase==='answered')return {kicker:`Challenge ${lesson+1} of 4 · Correct`,title:'You found it',body:l.why,fact:feedback,actions:[action('Look around',close),action(lesson===3?'Finish':'Next',()=>go(lesson+1),true)]};
  return {kicker:`Investigate ${lesson+1} of 4`,title:l.title,body:l.body,fact:l.fact,actions:[action(lesson===2?'Change light':'Explore',lesson===2?changeLight:close),action('Test me',()=>{phase='question';feedback='';render();},true)]};
}
function answer(choice){
  const l=LESSONS[lesson],first=!answered.has(lesson);answered.add(lesson);
  if(choice!==l.answer){feedback='Try again. '+l.hint;render();return;}
  if(first)score++;
  feedback=first?'Correct on your first try.':'Correct after another look.';phase='answered';render();
}
function render(){
  const data=content();
  ui.area.value=String(world?.active??0);
  for(const el of [ui.area,ui.next,ui.learn,ui.view,ui.light])el.disabled=busy;
  if(inXr()){
    ui.card.hidden=true;
    if(!cardOpen){panel.hide();return;}
    if(new URLSearchParams(location.search).has('xrdebug'))data.kicker=rig.stats();
    panel.setContent(data);
    const f=rig.headForward(),a=-.45;
    panel.place(rig.headPosition(),V(f.x*Math.cos(a)+f.z*Math.sin(a),0,-f.x*Math.sin(a)+f.z*Math.cos(a)));
    return;
  }
  panel?.hide();ui.card.hidden=!cardOpen;
  if(!cardOpen)return;
  ui.kicker.textContent=data.kicker;ui.title.textContent=data.title;ui.body.textContent=data.body;ui.fact.textContent=data.fact;ui.fact.hidden=!data.fact;
  ui.actions.replaceChildren(...data.actions.map(a=>{const b=document.createElement('button');b.type='button';b.className=a.primary?'btn btn-primary':'btn';b.textContent=a.label;b.disabled=busy;b.addEventListener('click',a.onClick);return b;}));
}
function close(){cardOpen=false;render();}
function changeLight(){ui.light.textContent=world.daylight();render();}
function frameArea(walk=walkView){
  const s=world.stop();
  if(walk){
    const eye=s.stand.add(V(0,1.65,0));
    const target=s.at.clone();target.y=eye.y;
    if(Vector3.Distance(eye,target)<1)target.z-=2;
    animateCamera(eye,target);
  }else{
    const size=Math.max(s.bounds[0],s.bounds[2]);
    const target=V(0,s.bounds[1]*.42,0);
    animateCamera(V(size*.65,s.bounds[1]+size*.28,-size*.8),target);
  }
  ui.view.textContent=walk?'Overview':'At eye level';
}
function animateCamera(eye,target){
  const off=eye.subtract(target);
  flight={target,radius:off.length(),alpha:Math.atan2(off.z,off.x),beta:Math.acos(off.y/off.length())};
}
async function travel(i){
  if(busy)return false;
  busy=true;destination=i;ui.status.textContent=`Loading ${AREAS[i].name}…`;cardOpen=true;render();
  let prepared;
  try{
    if(i!==world.active)prepared=await world.prepare(i,p=>ui.status.textContent=`Loading ${AREAS[i].name} · ${Math.round(p*100)}%`);
    const stop=world.stop(i);
    const activate=()=>{
      if(!prepared)return;
      const teleport=rig?.xr.teleportation;
      for(const floor of world.floors)teleport?.removeFloorMesh(floor);
      world.activate(prepared);prepared=null;
      for(const floor of world.floors)teleport?.addFloorMesh(floor);
    };
    if(inXr())await rig.moveTo(stop.stand,stop.at,activate);
    else {activate();frameArea();}
    ui.status.textContent=`${AREAS[i].name} · ${i+1} of 6`;
    return true;
  }catch(e){
    prepared?.container.dispose();console.error('[mpc] Area loading failed',e);
    ui.status.textContent='This area could not load. Choose it again to retry.';
    return false;
  }finally{busy=false;destination=null;render();}
}
async function visit(i){
  if(busy)return;
  lesson=-1;phase='observe';feedback='';await travel(i);render();
}
async function go(i){
  if(busy)return;
  // Commit the lesson only after its area loads, so failures remain retryable.
  if(i<LESSONS.length&&!(await travel(LESSONS[i].view)))return;
  lesson=i;phase='observe';feedback='';cardOpen=true;render();
}
function restart(){if(busy)return;score=0;answered=new Set();go(0);}
async function start(){
  world=await buildWorld(engine,p=>ui.pct.textContent=`${Math.round(p*100)}%`);scene=world.scene;
  camera=new ArcRotateCamera('orbit',0,1,25,V(0,2,0),scene);
  camera.minZ=.04;camera.maxZ=16000;camera.lowerRadiusLimit=.45;camera.upperRadiusLimit=90;camera.lowerBetaLimit=.08;camera.upperBetaLimit=2.8;camera.wheelDeltaPercentage=.012;camera.pinchDeltaPercentage=.004;camera.panningSensibility=0;camera.attachControl($('#scene'),true);
  panel=createCard(scene,{name:'machu-lesson',height:.88});
  frameArea(false);
  try{if(await xrSupported()){rig=await createXr(scene,{floorMeshes:world.floors,start:{get position(){return world.stop().stand;},get lookAt(){return world.stop().at;}}});}}catch(e){console.warn('[mpc] VR unavailable',e);}
  if(rig){
    ui.vr.hidden=false;document.body.classList.add('xr-ready');rig.mirrorPanel(panel.panel,{interactive:true});
    let frames=-1;
    rig.onChange(entered=>{document.body.classList.toggle('in-xr',entered);frames=entered?0:-1;if(!entered)render();});
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(()=>{
      if(frames<0||++frames<6)return;frames=-1;cardOpen=true;
      // The initial floor-aware pose already matches the active area.
      render();
    });
    rig.xr.input.onControllerAddedObservable.add(source=>source.onMotionControllerInitObservable.add(mc=>{
      for(const id of ['a-button','x-button'])mc.getComponent(id)?.onButtonStateChangedObservable.add(c=>{if(c.changes.pressed?.current){cardOpen=true;render();}});
    }));
  }
  scene.onBeforeRenderObservable.add(()=>{
    if(!flight||inXr())return;
    const k=Math.min(1,engine.getDeltaTime()/120);
    Vector3.LerpToRef(camera.target,flight.target,k,camera.target);
    const da=Math.atan2(Math.sin(flight.alpha-camera.alpha),Math.cos(flight.alpha-camera.alpha));
    camera.alpha+=da*k;camera.beta+=(flight.beta-camera.beta)*k;camera.radius+=(flight.radius-camera.radius)*k;
    if(Math.abs(da)<.001&&Vector3.Distance(camera.target,flight.target)<.01&&Math.abs(camera.radius-flight.radius)<.01)flight=null;
  });
  ui.loading.hidden=true;ui.hint.hidden=false;busy=false;
  ui.status.textContent='Main Temple · 1 of 6';render();
}
for(const [i,a] of AREAS.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=a.name;ui.area.append(o);}
ui.area.addEventListener('change',()=>visit(Number(ui.area.value)));
ui.next.addEventListener('click',()=>visit((world.active+1)%AREAS.length));
ui.learn.addEventListener('click',()=>{cardOpen=true;if(lesson<0)restart();else render();});
ui.view.addEventListener('click',()=>{walkView=!walkView;frameArea();});
ui.light.addEventListener('click',changeLight);
ui.vr.addEventListener('click',async()=>{ui.vr.disabled=true;try{await rig.enter();}catch(e){console.warn('[mpc] Enter VR failed',e);ui.status.textContent='VR could not start. Try Enter VR again, or explore here.';}finally{ui.vr.disabled=false;}});
$('[data-retry]').addEventListener('click',()=>location.reload());
$('#scene').addEventListener('pointerdown',()=>flight=null);$('#scene').addEventListener('wheel',()=>flight=null,{passive:true});
window.addEventListener('resize',()=>engine.resize());engine.runRenderLoop(()=>scene?.render());
start().catch(e=>{console.error('[mpc]',e);ui.pct.textContent='The survey could not load. Please try again.';$('[data-retry]').hidden=false;});
