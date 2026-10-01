// The vrtor catalog: one 3D experience per subject, driven by scroll.
// Communication (café, interview, keynote hall) -> Space -> Math -> Nature.
// Asset sources and licenses: /assets/CREDITS.md.
// In a headset, Enter VR drops you into the current scene; pull the trigger to move to the next one.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
  { id: 'cafe', from: 0.0, to: 0.15 },
  { id: 'office', from: 0.15, to: 0.26 },
  { id: 'stage', from: 0.26, to: 0.42 },
  { id: 'space', from: 0.42, to: 0.61 },
  { id: 'math', from: 0.61, to: 0.8 },
  { id: 'nature', from: 0.8, to: 1.0 },
];

const stage = document.querySelector('.journey');
const canvas = document.querySelector('.journey-canvas');
const fade = document.querySelector('.journey-fade');
const loader = document.querySelector('.journey-loading');
const beats = [...document.querySelectorAll('[data-beat]')];
const chips = [...document.querySelectorAll('[data-scene-chip]')];
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 900);
const rig = new THREE.Group();
rig.add(camera);

// Bloom for glowing scenes (flat screens only; a headset renders directly).
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.95);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
gltf.setDRACOLoader(draco); // the NASA rover is Draco-compressed

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
  // Clips carry tracks for bones some avatars lack (face nubs, footsteps); drop those to keep the console quiet.
  const names = new Set();
  body.traverse((o) => names.add(o.name));
  const clip = anim.animations[0].clone();
  clip.tracks = clip.tracks.filter((t) => names.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName));
  const action = mixer.clipAction(clip);
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

// ---------- Shared helpers for the fully 3D subject scenes ----------
const texLoader = new THREE.TextureLoader();
async function groundMaterial(prefix, repeat, tint) {
  const [map, normalMap, roughnessMap] = await Promise.all(['diff', 'nor', 'rough'].map((k) => texLoader.loadAsync(`${prefix}_${k}_1k.jpg`)));
  for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, color: tint ?? 0xffffff });
}

// Gentle rolling ground: a big plane displaced by layered sines, flat near the subject.
function terrain(size, segs, mat, height, flatR) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x, z);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) + 0.5 * Math.sin(x * 0.31 + z * 0.17) + 0.25 * Math.sin(x * 0.7 - z * 0.5);
    p.setY(i, n * height * THREE.MathUtils.smoothstep(d, flatR, flatR * 3));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// A gradient sky dome; also used to light PBR materials via PMREM.
function skyDome(top, horizon, bottom, radius = 400) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.8, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}
function envFrom(object) {
  const s = new THREE.Scene();
  s.add(object.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  return tex;
}

function sunLight(color, intensity, pos, area = 12) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.copy(pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  return sun;
}

// The AI guide's labels: a floating card with a leader line down to what it explains.
function guideLabel(title, body, anchor, lift = 0.6, size = 1.5) {
  const W = 760, H = 230;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(15,27,45,0.88)';
  ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, 40); ctx.fill();
  ctx.fillStyle = '#ffb020'; ctx.font = '600 34px "JetBrains Mono", monospace'; ctx.fillText('GUIDE', 44, 70);
  const fit = (text, weight, px, family) => {
    do { ctx.font = `${weight} ${px}px ${family}`; px -= 1; } while (ctx.measureText(text).width > W - 88 && px > 18);
  };
  ctx.fillStyle = '#e9eef2'; fit(title, 700, 46, 'Unbounded, sans-serif'); ctx.fillText(title, 44, 128);
  ctx.fillStyle = '#c6d0dc'; fit(body, 400, 34, '"Atkinson Hyperlegible", sans-serif'); ctx.fillText(body, 44, 180);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0 }));
  sprite.scale.set(0.76 * size, 0.23 * size, 1);
  sprite.center.set(0.5, 0);
  sprite.position.copy(anchor).add(new THREE.Vector3(0, lift, 0));
  sprite.renderOrder = 10;
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([anchor, sprite.position]),
    new THREE.LineBasicMaterial({ color: 0xffb020, depthTest: false, transparent: true, opacity: 0 }),
  );
  line.renderOrder = 10;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffb020, depthTest: false, transparent: true, opacity: 0 }));
  dot.position.copy(anchor); dot.renderOrder = 10;
  const group = new THREE.Group();
  group.add(sprite, line, dot);
  group.userData.setOpacity = (o) => { sprite.material.opacity = o; line.material.opacity = o; dot.material.opacity = o; };
  return group;
}
const labelFade = (t, a, b) => THREE.MathUtils.clamp(Math.min((t - a) / 0.06, (b - t) / 0.06), 0, 1);

async function loadModel(url) {
  const g = await load(url);
  g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g.scene;
}

// ---------- Space: NASA's Perseverance rover on Mars ----------
async function buildSpace() {
  const scene = new THREE.Scene();
  scene.userData.toneMapping = THREE.ACESFilmicToneMapping;
  scene.userData.exposure = 1.0;
  const dome = skyDome(0xc9a27e, 0xe7c29a, 0x8a5a3c);
  scene.add(dome);
  scene.environment = envFrom(dome);
  scene.environmentIntensity = 0.7;
  scene.fog = new THREE.FogExp2(0xd9b08a, 0.018);

  const groundMat = await groundMaterial(A + 'space/ground/aerial_sand', 40, 0xd28a5c);
  scene.add(terrain(220, 220, groundMat, 2.2, 7));

  scene.add(new THREE.HemisphereLight(0xffe2c4, 0x7a4a30, 0.6));
  const sun = sunLight(0xfff0dc, 3.2, new THREE.Vector3(-8, 10, 6), 8);
  scene.add(sun, sun.target);

  // Rover, scaled to its real size: about 3 m long.
  const rover = await loadModel(A + 'space/perseverance.glb');
  const box = new THREE.Box3().setFromObject(rover);
  const size = box.getSize(new THREE.Vector3());
  const s = 3.0 / Math.max(size.x, size.z);
  rover.scale.setScalar(s);
  box.setFromObject(rover);
  rover.position.y -= box.min.y;
  rover.position.x -= (box.min.x + box.max.x) / 2;
  rover.position.z -= (box.min.z + box.max.z) / 2;
  rover.rotation.y = -0.5;
  const turntable = new THREE.Group();
  turntable.add(rover);
  scene.add(turntable);
  const rb = new THREE.Box3().setFromObject(turntable);

  // Scanned rocks, tinted to Martian basalt, scattered around.
  const rockSrc = [await loadModel(A + 'space/rock_07/rock_07.gltf'), await loadModel(A + 'space/moon_rock_03/moon_rock_03.gltf')];
  const rand = mulberry32(11);
  for (let i = 0; i < 70; i++) {
    const src = rockSrc[i % 2];
    const r = src.clone();
    r.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0xb07050); } });
    const ang = rand() * Math.PI * 2, dist = 3 + rand() * rand() * 40;
    r.position.set(Math.cos(ang) * dist, -0.05, Math.sin(ang) * dist);
    r.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    r.scale.setScalar((0.2 + rand() * rand() * 2.4) * (dist < 6 ? 0.5 : 1));
    scene.add(r);
  }

  // Dust in the air, catching the sun.
  const dust = dustField(500, 30, 4, 0xffe1bf, 0.05);
  scene.add(dust);

  // Each label points at its named part in the NASA model, on the side the camera sees it from.
  turntable.updateMatrixWorld(true);
  // Measured with the rover unrotated, so the box hugs the part; then turned back into the scene.
  const partPoint = (name, from, side = false) => {
    const part = rover.getObjectByName(name);
    if (!part) return rb.getCenter(new THREE.Vector3());
    const yaw = rover.rotation.y;
    rover.rotation.y = 0; rover.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(part);
    const picks = [box.getCenter(new THREE.Vector3())];
    if (side) { // the side face nearest the viewer, low on the arm
      const c = picks[0];
      picks.splice(0, 1, new THREE.Vector3(box.min.x, box.min.y + (box.max.y - box.min.y) * 0.55, c.z), new THREE.Vector3(box.max.x, box.min.y + (box.max.y - box.min.y) * 0.55, c.z));
    }
    const local = picks.map((v) => rover.worldToLocal(v));
    rover.rotation.y = yaw; rover.updateMatrixWorld(true);
    const world = local.map((v) => rover.localToWorld(v));
    const view = new THREE.Vector3(...from);
    return world.sort((a, b) => a.distanceTo(view) - b.distanceTo(view))[0];
  };
  const labels = [
    guideLabel('Mastcam-Z', 'Two zoom cameras that see in 3D', partPoint('Mastcam_Z_cams', [4, 2, 4]), 0.5),
    guideLabel('Coring drill', 'Drills rock cores and seals them in tubes', partPoint('corring_drill', [2, 1.5, 4]), 0.8),
    guideLabel('Rocker-bogie', 'Keeps all six wheels on the ground over rocks', partPoint('suspension', [-3.6, 1.1, 2.6], true), 1.0),
    guideLabel('Nuclear power', 'Heat from plutonium makes its electricity', partPoint('rtg', [-4, 1.2, 1]), 0.7),
  ];
  labels.forEach((l) => scene.add(l));

  return {
    scene,
    mixers: [{ update(dt) { dust.userData.drift(dt); } }],
    path: [
      [[7.5, 2.6, 7.0], [0, 1.0, 0]],
      [[4.2, 1.7, 4.2], [0, 1.0, 0]],
      [[1.2, 1.5, 4.0], [0, 0.9, 0]],
      [[-3.6, 1.1, 2.6], [0, 0.7, 0]],
    ],
    seat: new THREE.Vector3(0, 0, 4),
    onProgress(t) {
      labels[0].userData.setOpacity(labelFade(t, 0.12, 0.34));
      labels[1].userData.setOpacity(labelFade(t, 0.34, 0.56));
      labels[2].userData.setOpacity(labelFade(t, 0.56, 0.78));
      labels[3].userData.setOpacity(labelFade(t, 0.78, 1.05));
    },
  };
}

function dustField(count, spread, height, color, size) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const rand = mulberry32(5);
  for (let i = 0; i < count; i++) pos.set([(rand() - 0.5) * spread, rand() * height, (rand() - 0.5) * spread], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'); const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  let time = 0;
  pts.userData.drift = (dt) => {
    time += dt;
    const a = g.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) + dt * 0.05 * (0.5 + ((i * 7) % 5) / 5);
      if (y > height) y = 0;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.04);
    }
    a.needsUpdate = true;
  };
  return pts;
}

// ---------- Math: a glossy function surface with a swarm flowing down its gradient ----------
const fxy = (x, y) => 0.6 * Math.sin(0.9 * x) * Math.cos(0.75 * y) + 0.3 * Math.sin(0.4 * x + 0.6 * y) + 0.03 * (x * x + y * y);
const grad = (x, y, h = 1e-3) => [(fxy(x + h, y) - fxy(x - h, y)) / (2 * h), (fxy(x, y + h) - fxy(x, y - h)) / (2 * h)];
async function buildMath() {
  const scene = new THREE.Scene();
  scene.userData.toneMapping = THREE.ACESFilmicToneMapping;
  scene.userData.exposure = 0.75;
  scene.userData.bloom = true;
  scene.background = new THREE.Color(0x070d18);
  scene.fog = new THREE.Fog(0x070d18, 9, 22);
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.12;

  const N = 220, S = 9;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  const colors = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const low = new THREE.Color(0x06124f), mid = new THREE.Color(0x4a1fc4), high = new THREE.Color(0xff8a10), c = new THREE.Color();

  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  // Contour lines: thin bright bands every 0.1 of height, drawn in the shader.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat k = abs(fract(vH * 10.0) - 0.5); float w = fwidth(vH * 10.0) * 1.5; float line = smoothstep(0.5 - w, 0.5, k); totalEmissiveRadiance += vec3(0.55, 0.65, 1.0) * line * 1.2;',
    );
  };
  const surface = new THREE.Mesh(geo, mat);
  scene.add(surface);
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f86ff, 0.7); rim.position.set(-5, 2, -4); scene.add(rim);

  // Particles: each one follows the negative gradient (gradient descent) and glows.
  const P = 900;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(P * 3);
  const rand = mulberry32(3);
  const seed = (i) => { pp[i * 3] = (rand() - 0.5) * S * 0.95; pp[i * 3 + 2] = (rand() - 0.5) * S * 0.95; };
  for (let i = 0; i < P; i++) seed(i);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const sprite = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,220,150,0.9)'); g.addColorStop(1, 'rgba(255,180,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const swarm = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.07, map: sprite, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(swarm);
  const age = new Float32Array(P).map(() => rand() * 6);

  let amp = 0;
  function shape(a) {
    for (let i = 0; i < pos.count; i++) {
      const z = fxy(base[i * 3], base[i * 3 + 2]) * a;
      pos.setY(i, z);
      const h = THREE.MathUtils.clamp((z + 0.6) / 1.9, 0, 1);
      if (h < 0.5) c.copy(low).lerp(mid, h * 2); else c.copy(mid).lerp(high, (h - 0.5) * 2);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
  }
  shape(0.02);

  const label = guideLabel('Gradient descent', 'Every light rolls the steepest way down', new THREE.Vector3(-1.2, 0.4, 1.2), 0.9, 2.2);
  scene.add(label);

  return {
    scene,
    mixers: [{
      update(dt) {
        swarm.visible = amp > 0.9;
        if (!swarm.visible) return;
        for (let i = 0; i < P; i++) {
          let x = pp[i * 3], y = pp[i * 3 + 2];
          const [gx, gy] = grad(x, y);
          x -= gx * dt * 1.6; y -= gy * dt * 1.6;
          age[i] += dt;
          if (age[i] > 7 || Math.abs(x) > S / 2 || Math.abs(y) > S / 2) { age[i] = 0; seed(i); x = pp[i * 3]; y = pp[i * 3 + 2]; }
          pp[i * 3] = x; pp[i * 3 + 2] = y; pp[i * 3 + 1] = fxy(x, y) * amp + 0.05;
        }
        pg.attributes.position.needsUpdate = true;
      },
    }],
    path: [
      [[6.0, 4.6, 6.2], [0, 0, 0]],
      [[4.2, 2.6, 4.6], [0, 0.1, 0]],
      [[0.8, 1.6, 4.0], [-0.6, 0.0, 0.2]],
    ],
    seat: new THREE.Vector3(0, 0.3, 4),
    onProgress(t) {
      const a = ease(THREE.MathUtils.clamp(t / 0.35, 0.02, 1));
      if (Math.abs(a - amp) > 0.002) { amp = a; shape(a); }
      label.userData.setOpacity(labelFade(t, 0.45, 1.05));
    },
  };
}

// ---------- Nature: a forest built from generated trees and scanned plants ----------
async function buildNature() {
  const { Tree } = await import('@dgreenheck/ez-tree');
  const { Sky } = await import('three/addons/objects/Sky.js');
  const scene = new THREE.Scene();
  scene.userData.toneMapping = THREE.ACESFilmicToneMapping;
  scene.userData.exposure = 0.95;

  // Late-afternoon sun.
  const sky = new Sky();
  sky.scale.setScalar(450);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(210));
  Object.assign(sky.material.uniforms, {});
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  sky.material.uniforms.turbidity.value = 6;
  sky.material.uniforms.rayleigh.value = 1.6;
  sky.material.uniforms.mieCoefficient.value = 0.006;
  sky.material.uniforms.mieDirectionalG.value = 0.85;
  scene.add(sky);
  scene.environment = envFrom(sky);
  scene.environmentIntensity = 0.6;
  scene.fog = new THREE.FogExp2(0xb9c6b0, 0.022);

  const groundMat = await groundMaterial(A + 'nature/ground/forest_ground_04', 60);
  scene.add(terrain(200, 200, groundMat, 1.6, 6));
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x3b3a26, 0.9));
  const sun = sunLight(0xffd9a8, 4.0, sunDir.clone().multiplyScalar(30), 16);
  scene.add(sun, sun.target);

  // Trees: a few generated species, each placed several times around the clearing.
  const presets = ['Oak Large', 'Ash Large', 'Aspen Large', 'Pine Large', 'Oak Medium', 'Ash Medium'];
  // Generating a tree takes a moment; yield a frame between each so scrolling stays smooth.
  const nextFrame = () => new Promise((res) => setTimeout(res, 0)); // not rAF: it never fires in a background tab
  const trees = [];
  for (const preset of presets) {
    await nextFrame();
    const t = new Tree();
    t.loadPreset(preset); // loadPreset generates the tree itself
    t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    trees.push(t);
  }
  const rand = mulberry32(21);
  const planted = [];
  // Keep a clear corridor where the camera flies in (toward +z) so no trunk fills the view.
  const inCorridor = (x, z) => z > -6 && Math.abs(x) < 4.5 + Math.max(0, z) * 0.35;
  for (let i = 0; i < 42; i++) {
    const src = trees[i % trees.length];
    const t = i < trees.length ? src : src.clone();
    let x, z;
    do {
      const ang = rand() * Math.PI * 2, dist = 10 + rand() * 34;
      x = Math.cos(ang) * dist; z = Math.sin(ang) * dist - 4;
    } while (inCorridor(x, z));
    t.position.set(x, -0.1, z);
    t.rotation.y = rand() * Math.PI * 2;
    t.scale.setScalar(0.38 + rand() * 0.22);
    scene.add(t);
    planted.push(t);
  }

  // Scanned ground cover, instanced.
  async function scatter(url, count, radius, scaleMin, scaleMax, keepOut = 1.2) {
    const g = await load(url);
    const meshes = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const placements = [];
    for (let i = 0; i < count; i++) {
      let x, z;
      do { x = (rand() - 0.5) * radius * 2; z = (rand() - 0.5) * radius * 2 - 2; } while (Math.hypot(x, z + 1.2) < keepOut);
      placements.push([x, z, rand() * Math.PI * 2, scaleMin + rand() * (scaleMax - scaleMin)]);
    }
    for (const src of meshes) {
      const inst = new THREE.InstancedMesh(src.geometry, src.material, count);
      placements.forEach(([x, z, r, s], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
        m4.compose(v.set(x, 0, z), q, sc.set(s, s, s)).multiply(src.matrixWorld);
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = true; inst.receiveShadow = true;
      scene.add(inst);
    }
  }
  await Promise.all([
    scatter(A + 'nature/fern_02/fern_02.gltf', 260, 15, 0.7, 1.5),
    scatter(A + 'nature/grass_medium_01/grass_medium_01.gltf', 700, 18, 0.8, 1.7, 0.8),
    scatter(A + 'nature/rock_07/rock_07.gltf', 18, 14, 0.3, 1.1, 2.0),
  ]);
  const log = await loadModel(A + 'nature/dead_tree_trunk/dead_tree_trunk.gltf');
  log.position.set(1.6, 0, -1.6); log.rotation.y = 0.9;
  scene.add(log);

  // Light shafts through the canopy and pollen drifting in them.
  const shaftTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,230,180,0.0)'); g.addColorStop(0.3, 'rgba(255,230,180,0.35)'); g.addColorStop(1, 'rgba(255,230,180,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); return new THREE.CanvasTexture(cv); })();
  for (let i = 0; i < 6; i++) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + rand() * 1.6, 16), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: 0.5 }));
    shaft.position.set(-6 + rand() * 12, 6, -8 + rand() * 9);
    shaft.lookAt(shaft.position.clone().add(sunDir));
    shaft.rotateX(Math.PI / 2);
    scene.add(shaft);
  }
  const pollen = dustField(700, 24, 5, 0xfff0c8, 0.04);
  pollen.position.z = -3;
  scene.add(pollen);

  const fernLabel = guideLabel('Fern', 'No flowers or seeds: it spreads by spores', new THREE.Vector3(-1.4, 0.5, -0.6), 0.7);
  const logLabel = guideLabel('Fallen trunk', 'Fungi and insects slowly turn it into soil', new THREE.Vector3(1.6, 0.4, -1.6), 0.8);
  scene.add(fernLabel, logLabel);

  let time = 0;
  return {
    scene,
    mixers: [{ update(dt) { time += dt; for (const t of trees) t.update(time); pollen.userData.drift(dt); } }],
    path: [
      [[0.5, 4.5, 12.0], [0, 2.4, -6]],
      [[2.2, 2.0, 5.2], [0, 1.2, -3]],
      [[-0.4, 1.4, 2.4], [0, 0.6, -1.4]],
    ],
    seat: new THREE.Vector3(0, 0, 2.5),
    onProgress(t) {
      fernLabel.userData.setOpacity(labelFade(t, 0.35, 0.68));
      logLabel.userData.setOpacity(labelFade(t, 0.68, 1.05));
    },
  };
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BUILDERS = { cafe: buildCafe, office: buildOffice, stage: buildStage, space: buildSpace, math: buildMath, nature: buildNature };
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
  // Light procedural scenes first, heavy rooms after.
  (async () => {
    for (const id of ['math', 'space', 'nature', 'office', 'stage']) {
      try { ready[id] = await ensure(id); } catch { /* logged in ensure */ }
    }
  })();
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
  const current = sceneAt(p).id;
  for (const c of chips) c.classList.toggle('on', c.dataset.sceneChip === current);
  // Fade across scene changes.
  let f = 0;
  for (const s of SCENES.slice(1)) f = Math.max(f, 1 - Math.abs(p - s.from) / 0.02);
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
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
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
  renderer.toneMapping = active.scene.userData.toneMapping ?? THREE.NoToneMapping;
  renderer.toneMappingExposure = active.scene.userData.exposure ?? 1;
  if (active.scene.userData.bloom && !renderer.xr.isPresenting) {
    renderPass.scene = active.scene;
    composer.render(dt);
  } else {
    renderer.render(active.scene, camera);
  }
});
