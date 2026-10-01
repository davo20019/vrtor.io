// The vrtor journey: one learner's path through real 3D places, driven by scroll.
// Café (week 1) -> interview (week 3) -> keynote stage (week 6).
// Rooms, people and motion capture come from the Acento VR asset pipeline (see /assets/CREDITS.md).
// In a headset, Enter VR drops you into the current scene; pull the trigger to move to the next one.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const A = '/assets/';
const FILES = {
  cafe: A + 'rooms/cafe_misti.22c4cc62.glb',
  office: A + 'rooms/modern_office.cba30961.glb',
  hall: A + 'venues/keynote_hall.96a1606d.glb',
  hallEnv: A + 'venues/keynote_hall.env.f59a7fbf.jpg',
  crowd: A + 'crowd/crowd.a1a787aa.glb',
  friend: A + 'avatars/Female_Adult_04.ad0ae8c6.glb',
  interviewer: A + 'avatars/Business_Male_03.f7e9e0e9.glb',
  speaker: A + 'avatars/Female_Adult_09.0f612dfc.glb',
  clapperM: A + 'avatars/Male_Adult_05.45cb5a95.glb',
  fSitTalk: A + 'animations/f_sit_table_gestic_thoughtful.69f3ca02.glb',
  mSitTalk: A + 'animations/m_sit_table_gestic_thoughtful.c6e0f753.glb',
  fStandTalk: A + 'animations/f_gestic_talk_neutral_01.4e07101f.glb',
  fClap: A + 'animations/f_claphands_01.05fc04b3.glb',
  mClap: A + 'animations/m_claphands_01.13e471af.glb',
};

// Scroll ranges (0..1 over the journey) for each scene.
const SCENES = [
  { id: 'cafe', from: 0.0, to: 0.36 },
  { id: 'office', from: 0.36, to: 0.66 },
  { id: 'stage', from: 0.66, to: 1.0 },
];

const stage = document.querySelector('.journey');
const canvas = document.querySelector('.journey-canvas');
const fade = document.querySelector('.journey-fade');
const loader = document.querySelector('.journey-loading');
const beats = [...document.querySelectorAll('[data-beat]')];
const vrBtn = document.querySelector('[data-enter-vr]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  stage.classList.add('no-webgl');
  throw new Error('WebGL unavailable; the journey shows as text only.');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
const rig = new THREE.Group();
rig.add(camera);

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);

// Progress shown while the first room streams in.
const progress = new Map();
function track(url) {
  return (e) => {
    if (e.total) progress.set(url, e.loaded / e.total);
    const vals = [...progress.values()];
    const pct = Math.round((vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1)) * 100);
    if (loader && !loader.hidden) loader.querySelector('span').textContent = `${pct}%`;
  };
}
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, gltf.loadAsync(url, track(url)));
  return cache.get(url);
}

// Rooms come with lighting baked into their textures: draw those unlit.
function unlitBaked(root, all = false) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => {
      if (!(all || m.name.startsWith('baked_'))) return m;
      if (m.transparent || /glass/i.test(m.name)) return m;
      return new THREE.MeshBasicMaterial({ map: m.map, color: m.map ? 0xffffff : m.color, side: m.side, transparent: m.transparent, alphaTest: m.alphaTest });
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

function addLights(scene, intensity = 1) {
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3530, 1.6 * intensity));
  const key = new THREE.DirectionalLight(0xffffff, 1.4 * intensity);
  key.position.set(2, 4, -2);
  scene.add(key);
}

// A person: a Rocketbox avatar playing a motion-capture clip (all share the Bip01 skeleton).
async function person(avatarUrl, clipUrl, { position, facing = Math.PI, timeScale = 1, offset = 0 }) {
  const [avatar, anim] = await Promise.all([load(avatarUrl), load(clipUrl)]);
  const body = cloneSkinned(avatar.scene);
  body.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
  body.position.set(...position);
  body.rotation.y = facing;
  const mixer = new THREE.AnimationMixer(body);
  const action = mixer.clipAction(anim.animations[0]);
  action.timeScale = timeScale;
  action.play();
  mixer.setTime(offset);
  return { body, mixer };
}

// ---------- Scenes ----------
const built = {};

async function buildCafe() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ee);
  const room = (await load(FILES.cafe)).scene.clone();
  unlitBaked(room);
  scene.add(room);
  addLights(scene);
  // The friend across the table (the room's coach seat, from the Acento layout).
  const friend = await person(FILES.friend, FILES.fSitTalk, { position: [0, 0, 1.48] });
  scene.add(friend.body);
  return {
    scene,
    mixers: [friend.mixer],
    // Camera keyframes [position, look-at]: from the doorway to your seat at the table.
    path: [
      [[1.6, 1.65, -2.4], [0, 1.0, 1.4]],
      [[0.7, 1.4, -1.0], [0, 1.05, 1.48]],
      [[0.12, 1.22, 0.0], [0, 1.12, 1.48]],
    ],
    seat: new THREE.Vector3(0, 0, 0),
    face: new THREE.Vector3(0, 1.12, 1.48),
  };
}

async function buildOffice() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6ebf0);
  const room = (await load(FILES.office)).scene.clone();
  unlitBaked(room);
  scene.add(room);
  addLights(scene);
  const interviewer = await person(FILES.interviewer, FILES.mSitTalk, { position: [0, 0, 1.53] });
  scene.add(interviewer.body);
  return {
    scene,
    mixers: [interviewer.mixer],
    path: [
      [[-1.4, 1.7, -1.8], [0, 1.0, 1.5]],
      [[-0.6, 1.35, -0.6], [0, 1.1, 1.53]],
      [[-0.1, 1.2, 0.05], [0, 1.15, 1.53]],
    ],
    seat: new THREE.Vector3(0, 0, 0),
    face: new THREE.Vector3(0, 1.15, 1.53),
  };
}

// Keynote hall: presenter's spot at the origin on a stage 0.82 m above the stalls; seats toward +z.
const FLOOR_Y = -0.82;
const ROW_Z0 = 5.3, ROW_DZ = 1.0, ROWS = 10, SEAT_DX = 0.6;
const CROWD_SIT = [0.46, -0.08]; // cushion height and setback in a sitter's own frame
// The crowd's baked head turn per pose; glTF is the mirror of Acento's Babylon frame, so 'left' there is +yaw here.
const CROWD_POSE_POS = 'left', CROWD_POSE_NEG = 'right';

async function buildStage() {
  const scene = new THREE.Scene();
  const env = await new THREE.TextureLoader().loadAsync(FILES.hallEnv);
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  scene.background = env;

  const hall = (await load(FILES.hall)).scene.clone();
  unlitBaked(hall, true);
  scene.add(hall);
  addLights(scene, 0.9);

  // Seats and the seated crowd, instanced so hundreds of people stay cheap.
  const crowdGltf = await load(FILES.crowd);
  const variants = {};
  crowdGltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    // Each person is crowd-<avatar>-<pose>-<lod> > ...-mesh; the child's transform un-quantizes it.
    const m = /^crowd-(.+)-(left|right)-(near|far)$/.exec(o.parent?.name ?? '');
    if (!m) return;
    const key = `${m[2]}-${m[3]}`;
    (variants[key] ||= []).push(o);
  });

  const seats = [];
  const standing = new Set(['0:-1', '0:1', '0:-3', '0:2', '1:-2', '1:1']);
  for (let r = 0; r < ROWS; r++) {
    for (const side of [-1, 1]) {
      for (let k = 1; k <= 16; k++) {
        const x = side * (0.8 + (k - 0.5) * SEAT_DX);
        if (Math.abs(x) > 10.9) continue;
        seats.push({ r, k: side * k, x, z: ROW_Z0 + r * ROW_DZ });
      }
    }
  }

  // Seat furniture.
  const seatGeo = new THREE.BoxGeometry(0.52, 0.1, 0.5);
  const backGeo = new THREE.BoxGeometry(0.52, 0.55, 0.08);
  const velvet = new THREE.MeshStandardMaterial({ color: 0x2b1f2a, roughness: 0.9 });
  const seatMesh = new THREE.InstancedMesh(seatGeo, velvet, seats.length);
  const backMesh = new THREE.InstancedMesh(backGeo, velvet, seats.length);
  const m4 = new THREE.Matrix4();
  seats.forEach((s, i) => {
    m4.makeTranslation(s.x, FLOOR_Y + 0.41, s.z + 0.05);
    seatMesh.setMatrixAt(i, m4);
    m4.makeTranslation(s.x, FLOOR_Y + 0.7, s.z + 0.32);
    backMesh.setMatrixAt(i, m4);
  });
  scene.add(seatMesh, backMesh);

  // People: about two thirds of the seats, turned a little toward the stage.
  const rand = mulberry32(7);
  const placements = {};
  for (const s of seats) {
    if (standing.has(`${s.r}:${s.k}`) || rand() > 0.68) continue;
    // Seats face the stage (yaw PI); each person turns part of the way toward the presenter.
    const toStage = Math.atan2(-s.x, -s.z);
    const turn = Math.atan2(Math.sin(toStage - Math.PI), Math.cos(toStage - Math.PI)); // wrapped to [-PI, PI]
    const pose = turn > 0 ? CROWD_POSE_POS : CROWD_POSE_NEG;
    const key = `${pose}-${s.r < 3 ? 'near' : 'far'}`;
    (placements[key] ||= []).push({ s, yaw: Math.PI + turn * 0.35 + (rand() - 0.5) * 0.1, pick: rand() });
  }
  for (const [key, list] of Object.entries(placements)) {
    const meshes = variants[key] || [];
    if (!meshes.length) continue;
    // Spread each pose's people across the avatar variants available for it.
    meshes.forEach((src, vi) => {
      const mine = list.filter((p) => Math.floor(p.pick * meshes.length) === vi);
      if (!mine.length) return;
      const inst = new THREE.InstancedMesh(src.geometry, src.material, mine.length);
      mine.forEach((p, i) => {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
        m4.compose(new THREE.Vector3(p.s.x, FLOOR_Y, p.s.z + 0.1), q, new THREE.Vector3(1, 1, 1));
        src.updateMatrix();
        inst.setMatrixAt(i, m4.multiply(src.matrix));
      });
      inst.frustumCulled = false;
      scene.add(inst);
    });
  }

  // The learner presenting, and the front rows who stand up to clap at the end.
  const speaker = await person(FILES.speaker, FILES.fStandTalk, { position: [0, 0, 0], facing: 0 });
  scene.add(speaker.body);
  const clappers = [];
  const clapSpots = seats.filter((s) => standing.has(`${s.r}:${s.k}`));
  for (const [i, s] of clapSpots.entries()) {
    const female = i % 2 === 0;
    const c = await person(female ? FILES.speaker : FILES.clapperM, female ? FILES.fClap : FILES.mClap, {
      position: [s.x, FLOOR_Y, s.z - 0.15], facing: Math.PI, offset: i * 0.37, timeScale: 0.9 + (i % 3) * 0.08,
    });
    c.body.visible = false;
    scene.add(c.body);
    clappers.push(c);
  }

  return {
    scene,
    mixers: [speaker.mixer, ...clappers.map((c) => c.mixer)],
    // From the back of the hall, over the crowd, up onto the stage, then turn to face the room.
    path: [
      [[0, 2.2, 16], [0, 0.9, 0]],
      [[1.2, 1.4, 9.5], [0, 1.1, 0]],
      [[1.4, 1.2, 3.5], [0, 1.3, 0]],
      [[0.9, 1.95, -2.4], [0, 0.6, 9]],
    ],
    seat: new THREE.Vector3(0, 0, 0),
    face: new THREE.Vector3(0, 1.4, 8),
    onProgress(t) { for (const c of clappers) c.body.visible = t > 0.6; },
  };
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BUILDERS = { cafe: buildCafe, office: buildOffice, stage: buildStage };
function ensure(id) {
  if (!built[id]) built[id] = BUILDERS[id]().catch((err) => { console.error(`[vrtor] ${id} failed`, err); delete built[id]; throw err; });
  return built[id];
}

const ready = {};
ensure('cafe').then((s) => {
  ready.cafe = s;
  stage.classList.add('is-ready');
  if (loader) loader.hidden = true;
  // Stream the rest after the first room is on screen.
  ensure('office').then((s2) => { ready.office = s2; });
  ensure('stage').then((s3) => { ready.stage = s3; });
});

// ---------- Scroll ----------
let p = 0; // 0..1 through the journey
function readScroll() {
  const r = stage.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  p = THREE.MathUtils.clamp(-r.top / Math.max(total, 1), 0, 1);
  updateBeats();
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

function sceneAt(prog) {
  return SCENES.find((s) => prog >= s.from && prog < s.to) || SCENES[SCENES.length - 1];
}

const ease = (t) => t * t * (3 - 2 * t);
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), look = new THREE.Vector3();
function alongPath(path, t) {
  const seg = Math.min(Math.floor(t * (path.length - 1)), path.length - 2);
  const lt = ease(t * (path.length - 1) - seg);
  vA.fromArray(path[seg][0]).lerp(vB.fromArray(path[seg + 1][0]), lt);
  camera.position.copy(vA);
  look.fromArray(path[seg][1]).lerp(vB.fromArray(path[seg + 1][1]), lt);
}

// A little mouse parallax so it feels like a space you're in, not a video.
const mouse = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

function updateBeats() {
  for (const el of beats) {
    const [a, b] = el.dataset.beat.split(',').map(Number);
    const on = p >= a && p < b;
    el.classList.toggle('on', on);
  }
  // Fade to white across scene changes.
  let f = 0;
  for (const s of SCENES.slice(1)) f = Math.max(f, 1 - Math.abs(p - s.from) / 0.03);
  fade.style.opacity = String(THREE.MathUtils.clamp(f, 0, 1));
}

// ---------- VR ----------
let vrIndex = 0;
async function enterScene(i) {
  vrIndex = i;
  const s = await ensure(SCENES[i].id);
  ready[SCENES[i].id] = s;
}
for (const i of [0, 1]) {
  const c = renderer.xr.getController(i);
  c.addEventListener('select', () => enterScene((vrIndex + 1) % SCENES.length));
  rig.add(c);
}
async function setupVr() {
  if (!vrBtn || !navigator.xr) return;
  let ok = false;
  try { ok = await navigator.xr.isSessionSupported('immersive-vr'); } catch { /* unsupported */ }
  if (!ok) return;
  vrBtn.hidden = false;
  stage.classList.add('xr-ready');
  vrBtn.addEventListener('click', async () => {
    if (renderer.xr.isPresenting) { renderer.xr.getSession().end(); return; }
    try {
      vrIndex = SCENES.indexOf(sceneAt(p));
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Exit VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Walk through it in VR'; });
    } catch (err) {
      vrBtn.textContent = 'VR could not start';
      console.warn(err);
    }
  });
}
setupVr();

// ---------- Loop ----------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 72 : 55;
  // Wide screens: shift the frame so the people sit to the right of the text panels.
  if (camera.aspect > 1.2) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

let onScreen = true;
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(canvas);

const clock = new THREE.Clock();
let lastScene = null;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!onScreen && !renderer.xr.isPresenting) return;

  let active, t;
  if (renderer.xr.isPresenting) {
    active = ready[SCENES[vrIndex].id] || ready.cafe;
    if (!active) return;
    if (rig.parent !== active.scene) active.scene.add(rig);
    rig.position.copy(active.seat);
    rig.rotation.set(0, Math.PI, 0); // the rooms face +z; the headset looks down -z
    t = 1;
  } else {
    updateBeats();
    const info = sceneAt(p);
    active = ready[info.id];
    if (!active) { active = lastScene; if (!active) return; t = 1; }
    else t = (p - info.from) / (info.to - info.from);
    if (rig.parent !== active.scene) active.scene.add(rig);
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    alongPath(active.path, THREE.MathUtils.clamp(t, 0, 1));
    const par = reduceMotion ? 0 : 0.18;
    look.x += mouse.x * par; look.y -= mouse.y * par * 0.5;
    camera.lookAt(look);
  }
  lastScene = active;
  active.onProgress?.(t);
  for (const m of active.mixers) m.update(reduceMotion ? 0 : dt);
  renderer.render(active.scene, camera);
});
