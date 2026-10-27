// VRtor Mona Lisa (/mona): Leonardo's Mona Lisa as the object it is. The painted face is the C2RMF scan of the
// whole panel straightened onto it (794 x 534 mm, Louvre), with the relief and the varnish's shine read from the
// scan; the plank bends as published, and its back, its oak châssis and its frame are built as they are made
// (assets-src/monalisa, spec.md says what is measured and what is estimated).
//
// Flat screens: look round it, scroll right up to it, light it from the side, take it off the wall and turn it
// over. Headset: walk up to it; squeeze the grip with a hand on it to take it off the wall and turn it in your
// hands; let go and it stays in the air. The 4k scan loads once you come close.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  KhronosTextureContainer2,
  LoadAssetContainerAsync,
  Matrix,
  PointerEventTypes,
  Quaternion,
  ReflectionProbe,
  Scene,
  ShadowGenerator,
  SpotLight,
  Texture,
  Tools,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { continueInVr, createCard, createMenuControls, createXr, headsetNote, startHeadsetLog, xrSupported } from '@vrtor/xr-shell';
import { ABOUT, SOURCES, aboutFor } from './content.js';
import { HANG, createRoom } from './room.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
const MODEL_V = '5';
const ktx2 = (file) => new URL(`${BASE}ktx2/${file}`, location.href).href;
KhronosTextureContainer2.URLConfig = {
  ...KhronosTextureContainer2.URLConfig,
  jsDecoderModule: ktx2('babylon.ktx2Decoder.js'),
  jsMSCTranscoder: ktx2('msc_basis_transcoder.js'),
  wasmMSCTranscoder: ktx2('msc_basis_transcoder.wasm'),
  wasmZSTDDecoder: ktx2('zstddec.wasm'),
};

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'), pct: $('.loading-pct'), retry: $('[data-retry]'), detail: $('.detail'),
  card: $('.card'), kicker: $('.card-kicker'), title: $('.card-title'), body: $('.card-body'), fact: $('.card-fact'),
  source: $('.card-source'), actions: $('.card-actions'), vr: $('[data-enter-vr]'),
  light: $('[data-light]'), close: $('[data-close]'), wall: $('[data-wall]'), turn: $('[data-turn]'), frame: $('[data-frame]'),
  hint: $('.hint'),
};

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#14110eff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
ip.exposure = 1.35;

const room = createRoom(scene);
if (import.meta.env.DEV) window.__mona = { scene, Tools, get holder() { return holder; } };

// Where it hangs: on the back of its case (room.js).
const HUNG = { position: HANG.clone() };
// Taken down: out through the glass, in the air in front of you, to look at both sides.
const DOWN = { position: new Vector3(0, 1.45, 1.6) };

// You start where visitors stand, at the front of the lane, a little below the painting.
const camera = new ArcRotateCamera('orbit', Math.PI / 2, Math.PI / 2 + 0.06, 3.1, HUNG.position.clone(), scene);
camera.minZ = 0.01;
camera.maxZ = 60;
camera.wheelDeltaPercentage = 0.012;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 2500;
camera.lowerRadiusLimit = 0.12;
camera.upperRadiusLimit = 6;
camera.inputs.attached.pointers.multiTouchPanning = true;
camera.attachControl(canvas, true);
const limitOrbit = (onWall) => {
  // On the wall you can't walk behind it.
  camera.lowerAlphaLimit = onWall ? 0.25 : null;
  camera.upperAlphaLimit = onWall ? Math.PI - 0.25 : null;
};
limitOrbit(true);

// The case lights the painting from its front shelf, below and in front of it, so the varnish's glare goes up
// and away from your eyes. Warm white, about 3000 K (estimated: the Louvre gives no figure).
const spot = new SpotLight('case-light', room.shelfLight.clone(), Vector3.Zero(), Math.PI / 3, 3, scene);
spot.direction = HUNG.position.subtract(room.shelfLight).normalize();
spot.diffuse = Color3.FromHexString('#ffe6c8');
spot.intensity = 20;
spot.shadowMinZ = 0.05;
spot.shadowMaxZ = 3;
// And the room's own light from the ceiling, dimmer.
const ceiling = new SpotLight('ceiling', room.lampPosition.clone(), Vector3.Zero(), Math.PI / 4, 4, scene);
ceiling.direction = new Vector3(0, -1, -0.25).normalize();
ceiling.diffuse = Color3.FromHexString('#ffe9d2');
ceiling.intensity = 60;
const fill = new HemisphericLight('fill', new Vector3(0, 1, 0.4), scene);
fill.diffuse = Color3.FromHexString('#c9cfdc');
fill.groundColor = Color3.FromHexString('#2a2118');
fill.specular = Color3.Black();
fill.intensity = 0.12;
// Raking light: one lamp low on the left, nearly along the surface.
const rake = new SpotLight('rake', Vector3.Zero(), new Vector3(1, 0, 0), Math.PI / 3, 2, scene);
rake.diffuse = Color3.FromHexString('#fff4e6');
rake.intensity = 0;

const shadows = new ShadowGenerator(1024, spot);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.0008;
shadows.normalBias = 0.01;

// ---------------------------------------------------------------- the painting

const holder = new TransformNode('mona', scene);
holder.position.copyFrom(HUNG.position);
holder.rotationQuaternion = Quaternion.Identity();
const meshes = [];
let front = null;          // the painted face's material
let frameMeshes = [];
let chassisMeshes = [];
let detail = '512';        // which scan is on: '512' (in the model), '2k', '4k'
let mounting = 'framed';   // 'framed' | 'chassis' | 'bare'
let onWall = true;
let raking = false;
let rig = null;
let cardOpen = true;
let picked = 'intro';
const card = createCard(scene, { name: 'mona-card', width: 0.9, height: 0.74 });
const inXr = () => !!rig?.inXr();
const act = (label, onClick, primary = false) => ({ label, onClick, primary });

async function load() {
  const container = await LoadAssetContainerAsync(`${BASE}models/monalisa.glb?v=${MODEL_V}`, scene, {
    pluginOptions: { gltf: { onProgress: (e) => { if (e.total) ui.pct.textContent = `Downloading ${Math.round((e.loaded / e.total) * 100)}%`; } } },
  });
  container.addAllToScene();
  for (const root of container.rootNodes) root.parent = holder;
  for (const mesh of container.meshes) {
    if (!mesh.getTotalVertices()) continue;
    mesh.isPickable = true;
    meshes.push(mesh);
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
    let n = mesh;
    while (n) {
      if (n.name === 'frame') frameMeshes.push(mesh);
      if (n.name === 'chassis') chassisMeshes.push(mesh);
      n = n.parent;
    }
  }
  front = container.materials.find((m) => m.name === 'painting');
  // The varnish: a clear, slightly uneven coat over the paint that follows its cracks. Its roughness comes
  // from the scan (rougher in the cracks, matte on the bare wood), and the paint under it is satin.
  front.roughness = 0.8;
  // Paint bound in oil under varnish reflects little itself: the varnish carries the shine.
  front.metallicF0Factor = 0.25;
  front.clearCoat.isEnabled = true;
  front.clearCoat.intensity = 0.75;
  front.clearCoat.roughness = 1;
  front.clearCoat.indexOfRefraction = 1.52;
  front.clearCoat.useRoughnessFromMainTexture = false;
  // The room's blue reaches the paint only as faint reflections in the varnish.
  front.environmentIntensity = 0.2;
  for (const m of container.materials) {
    if (m.name.startsWith('gilt')) m.environmentIntensity = 0.9;
    // From a distance a pixel covers many of the gilding's bright edges and punched marks, and flashed between
    // them as the head moved: this widens the highlight where the detail gets smaller than a pixel.
    m.enableSpecularAntiAliasing = true;
  }
  dressFrame();
}

/** A texture from the KTX2 scans; resolves once it is on the GPU. */
function scanTexture(file, linear = false) {
  return new Promise((resolve, reject) => {
    const t = new Texture(`${BASE}scan/${file}?v=${MODEL_V}`, scene, { noMipmap: false, invertY: false, gammaSpace: !linear, onLoad: () => resolve(t), onError: (_, e) => reject(e ?? new Error(file)) });
  });
}

async function useScan(level) {
  if (!front || detail === level || (level === '2k' && detail === '4k')) return;
  const [color, normal, orm] = await Promise.all([
    scanTexture(`front_${level}_color.ktx2`),
    scanTexture(`front_${level}_normal.ktx2`, true),
    level === '2k' ? scanTexture('front_2k_orm.ktx2', true) : Promise.resolve(null),
  ]);
  const old = [front.albedoTexture, front.bumpTexture];
  front.albedoTexture = color;
  front.bumpTexture = normal;
  front.clearCoat.bumpTexture = normal;
  // glTF normal maps in Babylon's left-handed scene (what the glTF loader sets)
  front.invertNormalMapX = true;
  front.invertNormalMapY = false;
  if (orm) {
    front.metallicTexture = orm;
    front.useRoughnessFromMetallicTextureGreen = true;
    front.useMetallnessFromMetallicTextureBlue = true;
    front.useAmbientOcclusionFromMetallicTextureRed = false;
    front.metallic = 1;
    front.clearCoat.textureRoughness = orm;
  }
  if (detail !== '512') old.forEach((t) => t?.dispose());
  detail = level;
  headsetNote('scan', { level });
}

let wantDetail = false;
function checkDistance() {
  if (!front || detail === '4k' || wantDetail || detail === '512') return;
  const eye = inXr() ? rig.headPosition() : camera.position;
  if (Vector3.Distance(eye, holder.position) > 0.8) return;
  wantDetail = true;
  ui.detail.hidden = false;
  ui.detail.textContent = 'Loading the full-resolution scan…';
  useScan('4k')
    .then(() => { ui.detail.textContent = 'Full-resolution scan: 0.13 mm a pixel'; setTimeout(() => (ui.detail.hidden = true), 4000); })
    .catch((err) => { console.warn('[mona] 4k scan', err); ui.detail.hidden = true; });
}

// ---------------------------------------------------------------- environment

// The gilt and the varnish reflect the room: a probe of it, drawn once the painting is up.
const probe = new ReflectionProbe('env', 256, scene, true); // with mipmaps, for the rough surfaces
probe.cubeTexture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
probe.refreshRate = 0;
probe.position.set(0, 1.6, 1.2);
function dressFrame() {
  for (const m of scene.meshes) if (!meshes.includes(m)) probe.renderList.push(m);
  // Only once the probe has drawn the room: the room's own materials read the environment, and sampling the
  // cube while drawing into it is a feedback loop.
  probe.cubeTexture.onAfterRenderObservable.addOnce(() => {
    scene.environmentTexture = probe.cubeTexture;
    scene.environmentIntensity = 0.6;
  });
}

// ---------------------------------------------------------------- moving it

// Tweens, stepped in the render loop: one per (target, property), a new one replacing the old.
const tweens = new Map();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
function animate(target, prop, to, ms = 900) {
  const from = target[prop]?.clone ? target[prop].clone() : target[prop];
  return new Promise((resolve) => {
    const key = `${target.uniqueId ?? target.name}:${prop}`;
    tweens.get(key)?.resolve();
    tweens.set(key, { target, prop, from, to, t0: performance.now(), ms, resolve });
  });
}
function stepTweens(now) {
  for (const [key, tw] of tweens) {
    const k = Math.min(1, (now - tw.t0) / tw.ms);
    const e = easeInOut(k);
    const { target, prop, from, to } = tw;
    if (typeof from === 'number') target[prop] = from + (to - from) * e;
    else if (from instanceof Quaternion) target[prop] = Quaternion.Slerp(from, to, e);
    else target[prop] = Vector3.Lerp(from, to, e);
    if (k === 1) { tweens.delete(key); tw.resolve(); }
  }
}

async function setWall(on) {
  onWall = on;
  limitOrbit(on);
  const pos = on ? HUNG.position : DOWN.position;
  const rot = on ? Quaternion.Identity() : Quaternion.RotationAxis(Vector3.Up(), holder.rotationQuaternion.toEulerAngles().y > 1.5 ? Math.PI : 0);
  if (!inXr()) animate(camera, 'target', pos.clone(), 900);
  await Promise.all([animate(holder, 'position', pos.clone()), animate(holder, 'rotationQuaternion', rot)]);
  if (on) { picked = picked === 'intro' ? 'intro' : picked; }
  render();
}

async function turnOver() {
  if (onWall) await setWall(false);
  const yaw = holder.rotationQuaternion.toEulerAngles().y;
  const to = Quaternion.RotationAxis(Vector3.Up(), Math.abs(yaw) > 1.5 ? 0 : Math.PI);
  await animate(holder, 'rotationQuaternion', to, 1400);
  picked = Math.abs(yaw) > 1.5 ? 'painting' : 'crack_lining';
  render();
}

function setMounting(m) {
  mounting = m;
  for (const x of frameMeshes) x.setEnabled(m === 'framed');
  for (const x of chassisMeshes) x.setEnabled(m !== 'bare');
  picked = m === 'framed' ? 'frame' : m === 'chassis' ? 'chassis' : 'panel_wood';
  render();
}
const nextMounting = () => ({ framed: 'chassis', chassis: 'bare', bare: 'framed' })[mounting];
const mountingLabel = () => ({ framed: 'Out of the frame', chassis: 'Out of the châssis', bare: 'Back in its frame' })[mounting];

function setRaking(on) {
  raking = on;
  // Low on the panel's left, a few degrees off its surface, wherever the panel is.
  const m = holder.computeWorldMatrix(true);
  const left = Vector3.TransformNormal(new Vector3(-1, 0, 0), m).normalize();
  const out = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
  // 15 degrees off the surface: low enough for every crack to throw a shadow, high enough to light it.
  rake.position = holder.position.add(left.scale(0.9)).add(out.scale(0.24));
  rake.direction = holder.position.subtract(rake.position).normalize();
  rake.intensity = on ? 30 : 0;
  spot.intensity = on ? 0.3 : 20;
  ceiling.intensity = on ? 8 : 60;
  fill.intensity = on ? 0.03 : 0.12;
  ui.light.setAttribute('aria-pressed', String(on));
  if (on) picked = 'light';
  render();
}

function getClose() {
  if (inXr()) return;
  const yaw = holder.rotationQuaternion.toEulerAngles().y;
  // Her face: 17 cm above the panel's middle.
  const face = Vector3.TransformCoordinates(new Vector3(0, 0.17, 0), holder.computeWorldMatrix(true));
  animate(camera, 'target', face, 700);
  animate(camera, 'radius', 0.32, 900);
  animate(camera, 'alpha', Math.abs(yaw) > 1.5 && !onWall ? -Math.PI / 2 : Math.PI / 2, 900);
  animate(camera, 'beta', Math.PI / 2 - 0.02, 900);
}

// ---------------------------------------------------------------- the card

function content() {
  const a = ABOUT[picked] ?? ABOUT.intro;
  const actions = [];
  if (picked !== 'intro') actions.push(act('About the painting', () => { picked = 'intro'; render(); }));
  actions.push(act('Close', close));
  return { kicker: a.kicker, title: a.title, body: a.text, fact: a.fact, source: picked === 'intro' ? SOURCES : '', actions };
}

function tools() {
  return [
    act(raking ? 'Gallery light' : 'Light from the side', () => setRaking(!raking)),
    act(onWall ? 'Take it off the wall' : 'Hang it back', () => setWall(!onWall)),
    act('Turn it over', turnOver),
    act(mountingLabel(), () => setMounting(nextMounting())),
  ];
}

function close() { cardOpen = false; render(); }

function render() {
  ui.light.textContent = raking ? 'Gallery light' : 'Light from the side';
  ui.wall.textContent = onWall ? 'Take it off the wall' : 'Hang it back';
  ui.frame.textContent = mountingLabel();
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) return card.hide();
    card.setContent({ ...data, tools: tools() });
    card.place(rig.headPosition(), rig.headForward(), null);
    return;
  }
  card.hide();
  ui.card.hidden = !cardOpen;
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact;
  ui.fact.hidden = !data.fact;
  ui.source.textContent = data.source;
  ui.source.hidden = !data.source;
  ui.actions.replaceChildren(...data.actions.map((x) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = x.primary ? 'btn btn-primary' : 'btn';
    b.textContent = x.label;
    b.addEventListener('click', x.onClick);
    return b;
  }));
}

function pick(mesh) {
  picked = aboutFor(mesh.name);
  cardOpen = true;
  render();
}

// ---------------------------------------------------------------- pointer (flat screens)

let down = null;
scene.onPointerObservable.add((info) => {
  if (inXr()) {
    if (info.type !== PointerEventTypes.POINTERDOWN) return;
    const m = info.pickInfo?.pickedMesh;
    if (m && meshes.includes(m)) pick(m);
    return;
  }
  if (info.type === PointerEventTypes.POINTERDOWN) down = { x: info.event.clientX, y: info.event.clientY };
  if (info.type === PointerEventTypes.POINTERUP && down) {
    const moved = Math.hypot(info.event.clientX - down.x, info.event.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => meshes.includes(m) && m.isEnabled());
    if (hit?.hit) pick(hit.pickedMesh);
  }
});

// ---------------------------------------------------------------- headset: hold it

function handMatrix(source) {
  const n = source.grip ?? source.pointer;
  n.computeWorldMatrix(true);
  return Matrix.Compose(Vector3.One(), n.absoluteRotationQuaternion.clone(), n.getAbsolutePosition().clone());
}
const buzz = (mc, v, ms) => { try { mc?.pulse(v, ms); } catch {} };

function setUpHands() {
  let hold = null; // { uid, node, mc }
  const near = (pos) => meshes.some((m) => {
    if (!m.isEnabled()) return false;
    const bb = m.getBoundingInfo().boundingBox;
    const p = Vector3.TransformCoordinates(pos, Matrix.Invert(m.getWorldMatrix()));
    const d = Vector3.Maximize(bb.minimum.subtract(p), p.subtract(bb.maximum));
    return Math.max(d.x, d.y, d.z, 0) < 0.08;
  });
  const grab = (source, mc) => {
    if (hold || card.isCard(rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId))) return;
    const mm = handMatrix(source);
    if (!near(mm.getTranslation())) return;
    const node = new TransformNode('hand-hold', scene);
    node.rotationQuaternion = Quaternion.Identity();
    mm.decompose(undefined, node.rotationQuaternion, node.position);
    holder.setParent(node);
    hold = { uid: source.uniqueId, node, mc };
    onWall = false;
    buzz(mc, 0.3, 25);
  };
  const letGo = (source) => {
    if (!hold || hold.uid !== source.uniqueId) return;
    holder.setParent(null);
    hold.node.dispose();
    hold = null;
    render();
  };
  rig.xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      mc.getComponent('xr-standard-squeeze')?.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed) return;
        if (c.pressed) grab(source, mc); else letGo(source);
      });
    });
  });
  rig.xr.input.onControllerRemovedObservable.add(letGo);
  scene.onBeforeRenderObservable.add(() => {
    if (!hold) return;
    const source = rig.xr.input.controllers.find((c) => c.uniqueId === hold.uid);
    if (source) handMatrix(source).decompose(undefined, hold.node.rotationQuaternion, hold.node.position);
  });
}

// ---------------------------------------------------------------- start

async function start() {
  const t0 = performance.now();
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), detail, onWall, mounting, raking }));
  await load();
  headsetNote('loaded', { ms: Math.round(performance.now() - t0) });
  ui.pct.textContent = 'Bringing in the scan…';
  try { await useScan('2k'); } catch (err) { console.warn('[mona] 2k scan', err); }
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: room.floors, start: { position: new Vector3(0, 0, 3.0), lookAt: HUNG.position.clone() }, maxResolution: 1.3 });
    }
  } catch (err) {
    console.warn('[mona] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.01;
    ui.vr.hidden = false;
    document.body.classList.add('xr-ready');
    for (const panel of card.panels) rig.mirrorPanel(panel, { interactive: true });
    let framesSinceEnter = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      framesSinceEnter = entered ? 0 : -1;
      if (!entered) render();
    });
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (framesSinceEnter < 0 || ++framesSinceEnter < 6) return;
      framesSinceEnter = -1;
      cardOpen = true;
      render();
    });
    createMenuControls(scene, rig, card, { open: () => { cardOpen = true; render(); }, close });
    setUpHands();
  }
  continueInVr(rig, ui.vr);
  await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 6000))]);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [ui.light, ui.close, ui.wall, ui.turn, ui.frame]) b.disabled = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try { await rig.enter(); } catch (err) { console.error('[mona] could not enter VR', err); } finally { ui.vr.disabled = false; }
}

ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
ui.light.addEventListener('click', () => setRaking(!raking));
ui.close.addEventListener('click', getClose);
ui.wall.addEventListener('click', () => setWall(!onWall));
ui.turn.addEventListener('click', turnOver);
ui.frame.addEventListener('click', () => setMounting(nextMounting()));
ui.retry.addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => {
  if (inXr()) return;
  if (e.key === 'Escape') close();
});

let frames = 0;
engine.runRenderLoop(() => {
  stepTweens(performance.now());
  scene.render();
  if (++frames % 15 === 0) checkDistance();
});
addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[mona] failed to start', err);
  ui.pct.textContent = 'The painting could not load.';
  ui.retry.hidden = false;
});
