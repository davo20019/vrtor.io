// VRtor Coronation of Napoleon (/sacre): Jacques-Louis David's painting at its real size, 9.79 by 6.21 m, in its
// gilt frame on the red wall of the Louvre's Salle Daru. The painted face is a public-domain photograph of the
// whole painting laid onto the canvas in six tiles; the canvas's seam and weave, its lining, its stretcher and its
// frame are built as they are made (assets-src/sacre, spec.md says what is measured and what is estimated).
//
// Flat screens: look round, scroll in, take the tour of the people in it, light it from the side, turn it round to
// see the back. Headset: walk up to it (teleport along the floor). Each tile's full-resolution photograph loads once
// you come within reach of it.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  KhronosTextureContainer2,
  LoadAssetContainerAsync,
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
import { ABOUT, SOURCES, TOUR, aboutFor } from './content.js';
import { HANG, ROOM, SIGHT, createRoom } from './room.js';
import './style.css';

const BASE = import.meta.env.BASE_URL;
const MODEL_V = '1';
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
  light: $('[data-light]'), tour: $('[data-tour]'), turn: $('[data-turn]'), frame: $('[data-frame]'),
  hint: $('.hint'),
};

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#120d10ff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
ip.exposure = 1.1;

const room = createRoom(scene);
if (import.meta.env.DEV) window.__sacre = { scene, Tools, get holder() { return holder; } };

const HUNG = { position: HANG.clone() };
// Turned round: brought out into the room, so you can walk behind it.
const OUT = { position: new Vector3(0, HANG.y, 6.5) };

// You start in the middle of the room, standing, the whole painting in view.
const EYE = 1.6;
const START = { target: new Vector3(0, 3.0, 0), radius: 11.5 };
const camera = new ArcRotateCamera('orbit', Math.PI / 2, Math.acos((START.target.y - EYE) / START.radius), START.radius, START.target.clone(), scene);
camera.minZ = 0.02;
camera.maxZ = 80;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 600;
camera.lowerRadiusLimit = 0.25;
camera.upperRadiusLimit = 14;
camera.inputs.attached.pointers.multiTouchPanning = true;
camera.attachControl(canvas, true);
const limitOrbit = (onWall) => {
  camera.lowerAlphaLimit = onWall ? 0.2 : null;
  camera.upperAlphaLimit = onWall ? Math.PI - 0.2 : null;
};
limitOrbit(true);

// Daylight from the glass roof, falling steeply onto the wall: the frame throws its shadow down onto the wall.
const sky = new DirectionalLight('skylight', new Vector3(0.12, -0.85, -0.5).normalize(), scene);
sky.position = new Vector3(-2, ROOM.height - 1, 9);
sky.diffuse = Color3.FromHexString('#fff6ea');
sky.intensity = 2.4;
const fill = new HemisphericLight('fill', new Vector3(0, 1, 0.3), scene);
fill.diffuse = Color3.FromHexString('#e6e9ef');
fill.groundColor = Color3.FromHexString('#4a2c22');
fill.specular = Color3.Black();
fill.intensity = 0.55;
// Raking light: one lamp low on the left, nearly along the surface.
const rake = new SpotLight('rake', Vector3.Zero(), new Vector3(1, 0, 0), Math.PI / 2.4, 1.5, scene);
rake.diffuse = Color3.FromHexString('#fff4e6');
rake.intensity = 0;

const shadows = new ShadowGenerator(2048, sky);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.0015;
shadows.normalBias = 0.02;
for (const m of room.shadowReceivers) m.receiveShadows = true;
for (const m of room.shadowCasters) shadows.addShadowCaster(m);

// ---------------------------------------------------------------- the painting

const holder = new TransformNode('sacre', scene);
holder.position.copyFrom(HUNG.position);
holder.rotationQuaternion = Quaternion.Identity();
const meshes = [];
const tiles = [];          // { key, mesh, mat, level: '512' | '1k' | '4k', loading }
let frameMeshes = [];
let weave = null;
let framed = true;
let onWall = true;
let raking = false;
let rig = null;
let cardOpen = true;
let picked = 'intro';
let stop = -1;             // the tour's current stop, -1 when not touring
const card = createCard(scene, { name: 'sacre-card', width: 0.9, height: 0.74 });
const inXr = () => !!rig?.inXr();
const act = (label, onClick, primary = false) => ({ label, onClick, primary });

async function load() {
  const container = await LoadAssetContainerAsync(`${BASE}models/sacre.glb?v=${MODEL_V}`, scene, {
    pluginOptions: { gltf: { onProgress: (e) => { if (e.total) ui.pct.textContent = `Downloading ${Math.round((e.loaded / e.total) * 100)}%`; } } },
  });
  container.addAllToScene();
  for (const root of container.rootNodes) root.parent = holder;
  for (const mesh of container.meshes) {
    if (!mesh.getTotalVertices()) continue;
    mesh.isPickable = true;
    meshes.push(mesh);
    mesh.receiveShadows = true;
    let n = mesh;
    let inFrame = false;
    while (n) {
      if (n.name === 'frame') inFrame = true;
      n = n.parent;
    }
    if (inFrame) { frameMeshes.push(mesh); shadows.addShadowCaster(mesh); }
  }
  for (const mat of container.materials) {
    if (!mat.name.startsWith('paint_')) continue;
    const mesh = container.meshes.find((m) => m.material === mat);
    // A canvas under an old varnish: the paint itself satin, the varnish a thin, slightly uneven clear coat.
    mat.roughness = 0.7;
    mat.metallic = 0;
    mat.metallicF0Factor = 0.25;
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = 0.5;
    mat.clearCoat.roughness = 0.32;
    mat.clearCoat.indexOfRefraction = 1.52;
    mat.environmentIntensity = 0.25;
    tiles.push({ key: mat.name.slice(6), mesh, mat, level: '512', loading: false });
  }
  for (const m of container.materials) {
    // Old water gilding under a skylight reads bright yellow in every photograph: it scatters as much as it mirrors,
    // and what it mirrors here (a dim red room) would leave pure metal dark brown.
    if (m.name.startsWith('gilt') || m.name === 'plaque') {
      m.metallic = 0.55;
      m.environmentIntensity = 1.6;
      m.albedoColor = new Color3(1.15, 1.08, 0.95);
    }
  }
  dressFrame();
}

/** A texture from the KTX2 tiles; resolves once it is on the GPU. */
function scanTexture(file, linear = false) {
  return new Promise((resolve, reject) => {
    const t = new Texture(`${BASE}scan/${file}?v=${MODEL_V}`, scene, { noMipmap: false, invertY: false, gammaSpace: !linear, onLoad: () => resolve(t), onError: (_, e) => reject(e ?? new Error(file)) });
  });
}

/** The canvas weave, tiled over every tile: one repeat of the detail map is 32 threads of about 1 mm. */
async function useWeave() {
  weave = await scanTexture('weave_detail.ktx2', true);
  weave.wrapU = weave.wrapV = Texture.WRAP_ADDRESSMODE;
  weave.anisotropicFilteringLevel = 8;
  const tileW = (SIGHT.width / 3) * 1000, tileH = (SIGHT.height / 2) * 1000;
  for (const t of tiles) {
    const dm = t.mat.detailMap;
    dm.texture = weave.clone();
    dm.texture.uScale = tileW / 32;
    dm.texture.vScale = tileH / 32;
    dm.isEnabled = true;
    dm.diffuseBlendLevel = 0.15;
    dm.bumpLevel = 0.6;
    dm.roughnessBlendLevel = 0;
  }
}

async function useTile(t, level) {
  if (t.loading || t.level === level || (level === '1k' && t.level === '4k')) return;
  t.loading = true;
  try {
    const color = await scanTexture(`tile_${t.key}_${level}.ktx2`);
    const normal = level === '4k' ? await scanTexture(`tile_${t.key}_normal.ktx2`, true) : null;
    const old = t.mat.albedoTexture;
    t.mat.albedoTexture = color;
    if (normal) {
      t.mat.bumpTexture = normal;
      // glTF normal maps in Babylon's left-handed scene (what the glTF loader sets)
      t.mat.invertNormalMapX = true;
      t.mat.invertNormalMapY = false;
    }
    if (t.level !== '512') old?.dispose();
    t.level = level;
    headsetNote('tile', { key: t.key, level });
  } finally {
    t.loading = false;
  }
}

// Each tile's 4k photograph (0.8 mm a pixel) loads when your eye comes within 3.5 m of it.
const NEAR = 3.5;
function checkDistance() {
  const eye = inXr() ? rig.headPosition() : camera.position;
  for (const t of tiles) {
    if (t.level === '4k' || t.loading || t.level === '512') continue;
    const bb = t.mesh.getBoundingInfo().boundingBox;
    const p = Vector3.Clamp(eye, bb.minimumWorld, bb.maximumWorld);
    if (Vector3.Distance(eye, p) > NEAR) continue;
    ui.detail.hidden = false;
    ui.detail.textContent = 'Loading the full-resolution photograph…';
    useTile(t, '4k')
      .then(() => {
        if (tiles.some((x) => x.loading)) return;
        ui.detail.textContent = 'Full resolution here: 0.8 mm a pixel';
        setTimeout(() => (ui.detail.hidden = true), 3000);
      })
      .catch((err) => { console.warn('[sacre] 4k tile', t.key, err); ui.detail.hidden = true; });
    return; // one at a time
  }
}

// ---------------------------------------------------------------- environment

// The gilt and the varnish reflect the room: a probe of it, drawn once the painting is up.
const probe = new ReflectionProbe('env', 256, scene, true);
probe.cubeTexture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
probe.refreshRate = 0;
probe.position.set(0, 2.5, 5);
function dressFrame() {
  for (const m of scene.meshes) if (!meshes.includes(m)) probe.renderList.push(m);
  probe.cubeTexture.onAfterRenderObservable.addOnce(() => {
    scene.environmentTexture = probe.cubeTexture;
    scene.environmentIntensity = 0.7;
  });
}

// ---------------------------------------------------------------- moving it

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

/** A point on the canvas, from its place on the photograph (fractions, 0,0 top left), in the world. Facing the
 * painting from the room you look down -z, so in Babylon's left-handed scene its right edge is at -x. */
function onCanvas([fx, fy]) {
  const local = new Vector3(-(fx - 0.5) * SIGHT.width, (0.5 - fy) * SIGHT.height, 0);
  return Vector3.TransformCoordinates(local, holder.computeWorldMatrix(true));
}

async function turnRound() {
  stop = -1;
  if (onWall) {
    onWall = false;
    limitOrbit(false);
    if (!inXr()) {
      animate(camera, 'target', new Vector3(0, 3.0, OUT.position.z), 1400);
      animate(camera, 'radius', 10, 1400);
    }
    await animate(holder, 'position', OUT.position.clone(), 1400);
    await animate(holder, 'rotationQuaternion', Quaternion.RotationAxis(Vector3.Up(), Math.PI), 1800);
    picked = 'back';
  } else {
    await animate(holder, 'rotationQuaternion', Quaternion.Identity(), 1800);
    if (!inXr()) {
      animate(camera, 'target', START.target.clone(), 1400);
      animate(camera, 'radius', START.radius, 1400);
      animate(camera, 'alpha', Math.PI / 2, 1400);
    }
    await animate(holder, 'position', HUNG.position.clone(), 1400);
    onWall = true;
    limitOrbit(true);
    picked = 'intro';
  }
  cardOpen = true;
  render();
}

function setFramed(on) {
  framed = on;
  for (const x of frameMeshes) x.setEnabled(on);
  picked = on ? 'frame' : 'painting';
  cardOpen = true;
  render();
}

function setRaking(on) {
  raking = on;
  // Low on the canvas's left (+x, see onCanvas), a few degrees off its surface, wherever the canvas is.
  const m = holder.computeWorldMatrix(true);
  const left = Vector3.TransformNormal(new Vector3(1, 0, 0), m).normalize();
  const out = Vector3.TransformNormal(new Vector3(0, 0, 1), m).normalize();
  // Across a canvas 10 m wide the light falls with the square of the distance: strong, and aimed past the middle.
  rake.position = holder.position.add(left.scale(SIGHT.width / 2 + 1.2)).add(out.scale(0.9));
  rake.direction = holder.position.add(left.scale(-2)).subtract(rake.position).normalize();
  rake.intensity = on ? 900 : 0;
  sky.intensity = on ? 0.15 : 2.4;
  fill.intensity = on ? 0.06 : 0.55;
  ui.light.setAttribute('aria-pressed', String(on));
  if (on) picked = 'light';
  cardOpen = true;
  render();
}

function goTo(i) {
  if (!onWall) return;
  stop = i;
  const s = TOUR[i];
  picked = `tour:${s.id}`;
  cardOpen = true;
  render();
  if (inXr()) return;
  // On a wide screen the card covers the left of the view: aim a little to the left of the stop (+x, see onCanvas)
  // so it sits in the clear right part. On a phone the card is below, and the stop stays in the middle.
  const aside = innerWidth > 640 ? s.radius * 0.3 : 0;
  animate(camera, 'target', onCanvas(s.at).add(new Vector3(aside, 0, 0)), 1100);
  animate(camera, 'radius', s.radius, 1200);
  animate(camera, 'alpha', Math.PI / 2, 1100);
  animate(camera, 'beta', Math.PI / 2 - 0.03, 1100);
}

function leaveTour() {
  stop = -1;
  picked = 'intro';
  render();
  if (inXr()) return;
  animate(camera, 'target', START.target.clone(), 1100);
  animate(camera, 'radius', START.radius, 1200);
  animate(camera, 'alpha', Math.PI / 2, 1100);
  animate(camera, 'beta', Math.acos((START.target.y - EYE) / START.radius), 1100);
}

// ---------------------------------------------------------------- the card

function content() {
  const actions = [];
  if (picked.startsWith('tour:')) {
    const s = TOUR[stop];
    if (stop > 0) actions.push(act('Back', () => goTo(stop - 1)));
    actions.push(act('Whole painting', leaveTour));
    if (stop < TOUR.length - 1) actions.push(act('Next', () => goTo(stop + 1), true));
    return { kicker: `${stop + 1} of ${TOUR.length} · ${s.kicker}`, title: s.title, body: s.text, fact: s.fact, source: '', actions };
  }
  const a = ABOUT[picked] ?? ABOUT.intro;
  if (picked !== 'intro') actions.push(act('About the painting', () => { picked = 'intro'; render(); }));
  if (picked === 'intro' && onWall) actions.push(act('Take the tour', () => goTo(0), true));
  else actions.push(act('Close', close));
  return { kicker: a.kicker, title: a.title, body: a.text, fact: a.fact, source: picked === 'intro' ? SOURCES : '', actions };
}

function tools() {
  return [
    act(raking ? 'Daylight' : 'Light from the side', () => setRaking(!raking)),
    act(onWall ? 'Turn it round' : 'Hang it back', turnRound),
    act(framed ? 'Out of the frame' : 'Back in its frame', () => setFramed(!framed)),
  ];
}

function close() { cardOpen = false; render(); }

function render() {
  ui.light.textContent = raking ? 'Daylight' : 'Light from the side';
  ui.turn.textContent = onWall ? 'Turn it round' : 'Hang it back';
  ui.frame.textContent = framed ? 'Out of the frame' : 'Back in its frame';
  ui.tour.disabled = !onWall;
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
  stop = -1;
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

// ---------------------------------------------------------------- start

async function start() {
  const t0 = performance.now();
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), tiles: tiles.map((t) => t.level).join(','), onWall, framed, raking }));
  await load();
  headsetNote('loaded', { ms: Math.round(performance.now() - t0) });
  ui.pct.textContent = 'Bringing in the photograph…';
  try { await Promise.all(tiles.map((t) => useTile(t, '1k'))); } catch (err) { console.warn('[sacre] 1k tiles', err); }
  useWeave().catch((err) => console.warn('[sacre] weave', err));
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: room.floors, start: { position: new Vector3(0, 0, 6), lookAt: new Vector3(0, 3, 0) }, maxResolution: 1.3 });
    }
  } catch (err) {
    console.warn('[sacre] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.02;
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
  }
  continueInVr(rig, ui.vr);
  await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 6000))]);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [ui.light, ui.tour, ui.turn, ui.frame]) b.disabled = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try { await rig.enter(); } catch (err) { console.error('[sacre] could not enter VR', err); } finally { ui.vr.disabled = false; }
}

ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
ui.light.addEventListener('click', () => setRaking(!raking));
ui.tour.addEventListener('click', () => goTo(stop >= 0 ? (stop + 1) % TOUR.length : 0));
ui.turn.addEventListener('click', turnRound);
ui.frame.addEventListener('click', () => setFramed(!framed));
ui.retry.addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => {
  if (inXr()) return;
  if (e.key === 'Escape') close();
  if (stop >= 0 && e.key === 'ArrowRight' && stop < TOUR.length - 1) goTo(stop + 1);
  if (stop >= 0 && e.key === 'ArrowLeft' && stop > 0) goTo(stop - 1);
});

let frames = 0;
engine.runRenderLoop(() => {
  stepTweens(performance.now());
  scene.render();
  if (++frames % 15 === 0) checkDistance();
});
addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[sacre] failed to start', err);
  ui.pct.textContent = 'The painting could not load.';
  ui.retry.hidden = false;
});
