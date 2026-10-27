// VRtor Heart (/hrt): a normal adult heart, beating, with every part: the four chambers' walls, the four valves
// that open and shut, the papillary muscles and chordae that hold the mitral and tricuspid valves, and the
// coronary arteries and veins. The shape is the average of 19 healthy adults' CT; the rest is built to published
// measurements (assets-src/heart).
//
// Flat screens: orbit; click a part to name it, then "Whole ..." for what it belongs to; take it out to see it
// alone. Headset: walk round it; put a hand on a part and squeeze the grip to take it; pull the trigger while
// holding to take the whole of what it belongs to; let go near its place and it goes back in. The beat can be
// slowed down or stopped, and the heart cut open to see inside.
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Matrix,
  MeshoptCompression,
  Plane,
  PointerEventTypes,
  Quaternion,
  Ray,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { continueInVr, createCard, createMenuControls, createXr, headsetNote, startHeadsetLog, xrSupported } from '@vrtor/xr-shell';
import { PHASES, RR, at, ecg } from './cycle.js';
import { ABOUT, GROUP_NAME, SOURCES } from './content.js';
import { createRoom } from './room.js';
import { ELEC, applyTissue } from './tissue.js';
window.__ELEC = ELEC;
import './style.css';

const BASE = import.meta.env.BASE_URL;
const MODEL_V = '9';
MeshoptCompression.Configuration = { decoder: { url: `${location.origin}${BASE}vendor/meshopt_decoder.js` } };

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const ui = {
  loading: $('.loading'), pct: $('.loading-pct'), retry: $('[data-retry]'),
  card: $('.card'), kicker: $('.card-kicker'), title: $('.card-title'), body: $('.card-body'), fact: $('.card-fact'),
  actions: $('.card-actions'), vr: $('[data-enter-vr]'), play: $('[data-play]'), speed: $('[data-speed]'),
  cut: $('[data-cut]'), elec: $('[data-elec]'), size: $('[data-size]'), back: $('[data-back]'), hint: $('.hint'),
  ecg: $('.ecg canvas'), phase: $('.ecg-phase'),
};
const PICKED = Color3.FromHexString('#ffb020');

// ---------------------------------------------------------------- scene

const engine = new Engine(canvas, true, { xrCompatible: true, stencil: true }, true);
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString('#120d10ff');
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = true;
ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
ip.exposure = 1.25;
ip.contrast = 1.1;

const room = createRoom(scene);
const probe = new ReflectionProbe('env', 128, scene);
probe.position = new Vector3(0, 1.4, 1.2);
probe.renderList.push(...room.envMeshes);
probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
scene.environmentTexture = probe.cubeTexture;
scene.environmentIntensity = 0.9;
// The heart floats over the ring at the room's middle. "Big" is 8 times life size (about a metre), to walk round
// and look into; "Life size" is its real size.
const SIZES = { big: { scale: 8, y: 1.35 }, life: { scale: 1, y: 1.3 } };
let size = 'big';

const camera = new ArcRotateCamera('orbit', Math.PI / 2, 1.35, 2.4, new Vector3(0, SIZES.big.y, 0), scene);
camera.minZ = 0.005;
camera.maxZ = 100;
camera.wheelDeltaPercentage = 0.01;
camera.pinchDeltaPercentage = 0.004;
camera.panningSensibility = 1500;
camera.lowerRadiusLimit = 0.05;
camera.upperRadiusLimit = 12;
camera.inputs.attached.pointers.multiTouchPanning = true;
camera.attachControl(canvas, true);

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene);
hemi.diffuse = Color3.FromHexString('#fff1ec');
hemi.groundColor = Color3.FromHexString('#2a1e22');
hemi.specular = Color3.Black();
hemi.intensity = 0.9;
const key = new DirectionalLight('key', new Vector3(0.4, -0.7, -0.6).normalize(), scene);
key.intensity = 2.2;
key.diffuse = Color3.FromHexString('#fff4ea');
const rim = new DirectionalLight('rim', new Vector3(-0.3, -0.2, 1).normalize(), scene);
rim.intensity = 0.8;
rim.diffuse = Color3.FromHexString('#d8e4ff');
// Some light from where you look, so the inside of a cut-open chamber isn't black.
const head = new DirectionalLight('head', new Vector3(0, 0, -1), scene);
head.intensity = 0.55;
scene.onBeforeRenderObservable.add(() => {
  const cam = scene.activeCamera;
  if (cam) head.direction.copyFrom(cam.getForwardRay(1).direction);
});

// ---------------------------------------------------------------- the heart

const holder = new TransformNode('heart', scene);
let meta = null;
/** id -> { mesh, meta, home: { position, rotation } } */
const parts = new Map();
const card = createCard(scene, { name: 'heart-card', width: 0.9, height: 0.74 });
let rig = null;
let cardOpen = true;
let picked = null;        // { kind: 'part' | 'group' | 'branch', key }
let page = 'part';        // 'part' | 'cycle'
let playing = true;
let speed = 1;
let clock = 0;
let cut = false;
const inXr = () => !!rig?.inXr();
const act = (label, onClick, primary = false) => ({ label, onClick, primary });
const branchOf = (m) => (m.group?.startsWith('coronary') ? m.name.replace(/, \d+ of \d+$/, '') : null);

async function load() {
  const res = await fetch(`${BASE}models/heart.json?v=${MODEL_V}`);
  meta = await res.json();
  const container = await LoadAssetContainerAsync(`${BASE}models/heart.glb?v=${MODEL_V}`, scene, {
    pluginOptions: { gltf: { onProgress: (e) => { if (e.total) ui.pct.textContent = `Downloading ${Math.round((e.loaded / e.total) * 100)}%`; } } },
  });
  container.addAllToScene();
  for (const root of container.rootNodes) root.parent = holder;
  for (const mesh of container.meshes) {
    const id = mesh.name.replace(/_primitive\d+$/, '');
    const m = meta.parts[id];
    if (!m) continue;
    mesh.isPickable = true;
    parts.set(id, { id, mesh, meta: m, home: null });
  }
  for (const mat of container.materials) mat.backFaceCulling = false;
  applyTissue(container.materials);
  setSize(size);
  for (const p of parts.values()) p.home = { position: p.mesh.position.clone(), rotation: p.mesh.rotationQuaternion?.clone() ?? null, parent: p.mesh.parent };
}

function setSize(s) {
  size = s;
  const z = SIZES[s];
  holder.scaling.setAll(z.scale);
  holder.position.set(0, z.y, 0);
  ui.size.textContent = s === 'big' ? 'Life size' : 'Make it big';
  if (!inXr()) {
    camera.setTarget(new Vector3(0, z.y, 0));
    camera.radius = s === 'big' ? 2.4 : 0.36;
  }
  setCut(cut);
}

// ---------------------------------------------------------------- the beat

function beat(dt) {
  if (playing) clock += dt * speed;
  const s = at(clock);
  ELEC.clock = s.t;
  for (const p of parts.values()) {
    const mtm = p.mesh.morphTargetManager;
    if (!mtm) continue;
    for (let i = 0; i < mtm.numTargets; i++) {
      const t = mtm.getTarget(i);
      t.influence = s.weights[t.name] ?? 0;
    }
  }
  return s;
}

// The ECG strip: the last two beats drawn as they come, with the phase named under it.
const trace = new Float32Array(600);
let lastPhase = null;
function drawEcg(s) {
  const c = ui.ecg;
  if (!c || inXr()) return;
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.strokeStyle = '#6cf0a0';
  g.lineWidth = 2;
  g.beginPath();
  const span = 2 * RR;
  for (let x = 0; x < w; x++) {
    const tt = clock - span + (x / w) * span;
    const y = h * 0.62 - ecg(((tt % RR) + RR) % RR) * h * 0.42;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    ui.phase.textContent = s.phase.name;
    if (page === 'cycle') render();
  }
}

// ---------------------------------------------------------------- choosing parts

function members(sel) {
  if (!sel) return [];
  if (sel.kind === 'part') return [parts.get(sel.key)];
  if (sel.kind === 'group') return [...parts.values()].filter((p) => p.meta.group === sel.key);
  return [...parts.values()].filter((p) => branchOf(p.meta) === sel.key);
}
function highlight() {
  const on = new Set(members(picked).map((p) => p.id));
  for (const p of parts.values()) {
    p.mesh.renderOverlay = on.has(p.id);
    p.mesh.overlayColor = PICKED;
    p.mesh.overlayAlpha = 0.28;
  }
}
function pickMesh(mesh) {
  const id = mesh?.name.replace(/_primitive\d+$/, '');
  const p = parts.get(id);
  if (!p) return;
  const b = branchOf(p.meta);
  picked = b ? { kind: 'branch', key: b } : { kind: 'part', key: id };
  page = 'part';
  cardOpen = true;
  highlight();
  render();
}
function unpick() {
  picked = null;
  highlight();
  render();
}

function isHome(p) { return p.mesh.parent === p.home.parent && p.mesh.position.equalsWithEpsilon(p.home.position, 1e-4); }
function putBack(list) {
  for (const p of list) {
    p.mesh.setParent(p.home.parent);
    p.mesh.position.copyFrom(p.home.position);
    if (p.home.rotation) p.mesh.rotationQuaternion = p.home.rotation.clone();
  }
  render();
}
/** Out of the heart, towards the viewer and a little up, keeping its shape and its beat. */
function takeOut(list) {
  const from = inXr() ? rig.headPosition() : camera.position;
  const centre = holder.getAbsolutePosition();
  const toward = from.subtract(centre).normalize();
  const reach = (size === 'big' ? 0.55 : 0.09);
  for (const p of list) {
    p.mesh.position.addInPlace(Vector3.TransformNormal(toward.scale(reach), Matrix.Invert(p.mesh.parent.getWorldMatrix())));
  }
  render();
}

// ---------------------------------------------------------------- cut open

function setCut(on) {
  cut = on;
  // A frontal plane through the heart's middle: the front half goes, and you look into all four chambers.
  const c = holder.getAbsolutePosition();
  const plane = on ? new Plane(0, 0, 1, -c.z) : null;
  for (const p of parts.values()) if (p.mesh.material) p.mesh.material.clipPlane = plane;
  ui.cut.textContent = on ? 'Close it' : 'Cut it open';
  ui.cut.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// ---------------------------------------------------------------- the card

const FLAT_HOWTO = 'Click a part to name it. Drag to turn, scroll or pinch to zoom in, right-drag to slide. "Cut it open" shows the inside of all four chambers.';
const XR_HOWTO = 'Walk round it. Put your hand on a part and squeeze the grip to take it out; pull the trigger while holding to take everything it belongs to. Let go near its place and it goes back. A or X opens this card.';

function content() {
  if (page === 'cycle') {
    const s = at(clock);
    const i = PHASES.indexOf(s.phase);
    return {
      kicker: `The heartbeat · ${i + 1} of ${PHASES.length}`,
      title: s.phase.name,
      body: s.phase.text,
      fact: 'One beat at 75 a minute lasts 0.8 s. Slow it down to watch each valve.',
      actions: [act('Back', () => { page = 'part'; render(); }), act(playing ? 'Pause' : 'Play', togglePlay, true)],
    };
  }
  if (!picked) {
    return {
      kicker: 'The heart · beating',
      title: 'A human heart, every part',
      body: `The average shape of 19 healthy adults' hearts from CT scans, with its four valves, the muscles and cords that hold them, and its own arteries and veins. It beats as a real heart does: the volumes, the valves' timing and the twist are measured ones.`,
      fact: inXr() ? XR_HOWTO : FLAT_HOWTO,
      actions: [
        act('The heartbeat, step by step', () => { page = 'cycle'; render(); }),
        act(cut ? 'Close it' : 'Cut it open', () => { setCut(!cut); render(); }),
        ...(rig && !inXr() ? [act('Enter VR', enterVr, true)] : [act(inXr() ? 'Close' : 'Explore', close, true)]),
      ],
      source: SOURCES,
    };
  }
  const list = members(picked);
  const first = list[0].meta;
  const group = first.group;
  const about = picked.kind === 'part' ? (ABOUT[picked.key] ?? ABOUT[group]) : ABOUT[group];
  const title = picked.kind === 'part' ? first.name : picked.kind === 'branch' ? picked.key : GROUP_NAME[group];
  const home = list.every(isHome);
  const actions = [];
  if (picked.kind !== 'group' && group !== 'walls' && GROUP_NAME[group]) actions.push(act(`Whole ${GROUP_NAME[group].toLowerCase()}`, () => { picked = { kind: 'group', key: group }; highlight(); render(); }));
  actions.push(home ? act('Take it out', () => takeOut(list), true) : act('Put it back', () => putBack(list), true));
  actions.push(act('Close', inXr() ? close : unpick));
  return {
    kicker: picked.kind === 'part' && GROUP_NAME[group] && group !== 'walls' ? GROUP_NAME[group] : 'The heart',
    title,
    body: about?.text ?? '',
    fact: about?.fact ?? '',
    actions,
  };
}

function tools() {
  return [
    act(playing ? 'Pause' : 'Play', togglePlay),
    act(speed === 1 ? 'Slow it down' : speed === 0.25 ? 'Slower' : 'Real speed', cycleSpeed),
    act(cut ? 'Close it' : 'Cut it open', () => { setCut(!cut); render(); }),
    act(electricity ? 'Hide the electricity' : 'Show the electricity', toggleElectricity),
    act(size === 'big' ? 'Life size' : 'Make it big', () => { setSize(size === 'big' ? 'life' : 'big'); render(); }),
    act('Put back', () => putBack([...parts.values()])),
  ];
}

function close() {
  cardOpen = false;
  render();
}

function render() {
  if (!meta) return;
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
  ui.actions.replaceChildren(...data.actions.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn btn-primary' : 'btn';
    b.textContent = a.label;
    b.addEventListener('click', a.onClick);
    return b;
  }));
  const src = $('.card-source');
  src.textContent = data.source ?? '';
  src.hidden = !data.source;
  ui.play.textContent = playing ? 'Pause' : 'Play';
  ui.speed.textContent = speed === 1 ? 'Slow it down' : speed === 0.25 ? 'Slower' : 'Real speed';
}

function togglePlay() { playing = !playing; render(); }
let electricity = false;
function toggleElectricity() {
  electricity = !electricity;
  ELEC.muscle = electricity ? 0.75 : 0;
  ELEC.conduction = electricity ? 1.4 : 0.9;
  if (electricity && speed === 1) speed = 0.25;   // the wave crosses the heart in a tenth of a second
  ui.elec.setAttribute('aria-pressed', electricity ? 'true' : 'false');
  render();
}
function cycleSpeed() { speed = speed === 1 ? 0.25 : speed === 0.25 ? 0.1 : 1; render(); }

// ---------------------------------------------------------------- pointer (flat screens)

let down = null;
scene.onPointerObservable.add((info) => {
  if (inXr()) return xrPointer(info);
  if (info.type === PointerEventTypes.POINTERDOWN) down = { x: info.event.clientX, y: info.event.clientY };
  if (info.type === PointerEventTypes.POINTERUP && down) {
    const moved = Math.hypot(info.event.clientX - down.x, info.event.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m.isPickable && parts.has(m.name.replace(/_primitive\d+$/, '')));
    if (hit?.hit) pickMesh(hit.pickedMesh);
    else if (picked) unpick();
  }
});

// ---------------------------------------------------------------- headset

const holds = new Map();
function xrPointer(info) {
  if (info.type !== PointerEventTypes.POINTERDOWN) return;
  if (info.pickInfo?.pickedMesh && card.panels.some((p) => p.mesh === info.pickInfo.pickedMesh)) return;
  const m = info.pickInfo?.pickedMesh;
  if (m && parts.has(m.name.replace(/_primitive\d+$/, ''))) pickMesh(m);
}
function handMatrix(source) {
  const n = source.grip ?? source.pointer;
  n.computeWorldMatrix(true);
  return Matrix.Compose(Vector3.One(), n.absoluteRotationQuaternion.clone(), n.getAbsolutePosition().clone());
}
const buzz = (mc, v, ms) => { try { mc?.pulse(v, ms); } catch {} };
/** The part whose surface is nearest the hand, within reach. */
function partAt(pos) {
  let best = null;
  let bestD = size === 'big' ? 0.06 : 0.015;
  for (const p of parts.values()) {
    const bs = p.mesh.getBoundingInfo().boundingSphere;
    const d = Vector3.Distance(pos, bs.centerWorld) - bs.radiusWorld;
    if (d > bestD) continue;
    const hit = scene.pickWithRay(new Ray(pos, bs.centerWorld.subtract(pos).normalize(), 1), (m) => m === p.mesh);
    const dd = hit?.hit ? hit.distance : d;
    if (dd < bestD) { bestD = dd; best = p; }
  }
  return best;
}
function setUpHands() {
  const holdNode = (source) => {
    const n = new TransformNode(`hold-${source.uniqueId}`, scene);
    const mm = handMatrix(source);
    n.rotationQuaternion = Quaternion.Identity();
    mm.decompose(undefined, n.rotationQuaternion, n.position);
    return n;
  };
  const take = (source, list, mc) => {
    const node = holdNode(source);
    for (const p of list) p.mesh.setParent(node);
    holds.set(source.uniqueId, { node, list, mc });
    buzz(mc, 0.3, 25);
  };
  const grab = (source, mc) => {
    if (card.isCard(rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId))) return;
    if (holds.has(source.uniqueId)) return;
    const p = partAt(handMatrix(source).getTranslation());
    if (!p) return;
    pickMesh(p.mesh);
    take(source, members(picked), mc);
  };
  const climb = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h || picked?.kind === 'group') return buzz(h?.mc, 0.6, 80);
    const group = h.list[0].meta.group;
    if (group === 'walls') return buzz(h.mc, 0.6, 80);
    picked = { kind: 'group', key: group };
    highlight();
    const more = members(picked).filter((p) => !h.list.includes(p));
    for (const p of more) p.mesh.setParent(h.node);
    h.list.push(...more);
    buzz(h.mc, 0.5, 40);
    render();
  };
  const letGo = (source) => {
    const h = holds.get(source.uniqueId);
    if (!h) return;
    holds.delete(source.uniqueId);
    for (const p of h.list) p.mesh.setParent(p.home.parent);
    // Near its place: back in.
    const p0 = h.list[0];
    const homeWorld = Vector3.TransformCoordinates(p0.home.position, p0.home.parent.getWorldMatrix());
    if (Vector3.Distance(p0.mesh.getAbsolutePosition(), homeWorld) < (size === 'big' ? 0.12 : 0.025)) {
      putBack(h.list);
      buzz(h.mc, 0.4, 30);
    }
    h.node.dispose();
    render();
  };
  rig.xr.input.onControllerAddedObservable.add((source) => {
    source.onMotionControllerInitObservable.add((mc) => {
      mc.getComponent('xr-standard-squeeze')?.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed) return;
        if (c.pressed) grab(source, mc);
        else letGo(source);
      });
      mc.getComponent('xr-standard-trigger')?.onButtonStateChangedObservable.add((c) => {
        if (c.changes.pressed && c.pressed && holds.has(source.uniqueId)) climb(source);
      });
    });
  });
  rig.xr.input.onControllerRemovedObservable.add(letGo);
  scene.onBeforeRenderObservable.add(() => {
    for (const [uid, h] of holds) {
      const source = rig.xr.input.controllers.find((c) => c.uniqueId === uid);
      if (!source) continue;
      handMatrix(source).decompose(undefined, h.node.rotationQuaternion, h.node.position);
    }
  });
}

// ---------------------------------------------------------------- start

async function start() {
  const t0 = performance.now();
  startHeadsetLog(() => ({ fps: Math.round(engine.getFps()), xr: inXr(), loaded: parts.size, size, cut, speed }));
  await load();
  headsetNote('loaded', { ms: Math.round(performance.now() - t0), parts: parts.size });
  try {
    if (await xrSupported()) {
      rig = await createXr(scene, { floorMeshes: room.floors, start: { position: new Vector3(0, 0, 1.6), lookAt: new Vector3(0, 1.35, 0) }, maxResolution: 1.3 });
    }
  } catch (err) {
    console.warn('[hrt] VR unavailable', err);
  }
  if (rig) {
    rig.camera.minZ = 0.005;
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
  ui.pct.textContent = 'Getting the colours ready…';
  await Promise.race([scene.whenReadyAsync(), new Promise((r) => setTimeout(r, 6000))]);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  for (const b of [ui.play, ui.speed, ui.cut, ui.elec, ui.size, ui.back]) b.disabled = false;
  render();
}

async function enterVr() {
  if (!rig || inXr()) return;
  ui.vr.disabled = true;
  try { await rig.enter(); } catch (err) { console.error('[hrt] could not enter VR', err); } finally { ui.vr.disabled = false; }
}

ui.vr.addEventListener('click', enterVr);
$('.card-close').addEventListener('click', close);
ui.play.addEventListener('click', togglePlay);
ui.speed.addEventListener('click', cycleSpeed);
ui.cut.addEventListener('click', () => { setCut(!cut); render(); });
ui.elec.addEventListener('click', toggleElectricity);
ui.size.addEventListener('click', () => { setSize(size === 'big' ? 'life' : 'big'); render(); });
ui.back.addEventListener('click', () => putBack([...parts.values()]));
ui.retry.addEventListener('click', () => location.reload());
$('[data-cycle]')?.addEventListener('click', () => { page = 'cycle'; cardOpen = true; render(); });
addEventListener('keydown', (e) => {
  if (inXr()) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Escape') { if (picked) unpick(); else close(); }
});

let last = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();
  const s = beat(Math.min(100, now - last));
  last = now;
  scene.render();
  drawEcg(s);
});
addEventListener('resize', () => engine.resize());

start().catch((err) => {
  console.error('[hrt]', err);
  ui.pct.textContent = 'The heart could not be built.';
  ui.retry.hidden = false;
});

// For automated checks in a browser.
window.__hrt = { ELEC: null, scene, camera, parts, setCut, setSize, pick: (id) => pickMesh(parts.get(id)?.mesh), content: () => content(), at, get clock() { return clock; }, set clock(v) { clock = v; }, pause: () => { playing = false; } };
