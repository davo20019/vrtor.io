// Hero backdrop: a few calm 3D scenes that dissolve into each other, one screen tall.
// Café (Communication) -> keynote hall (Communication) -> Perseverance on Mars (Space), then around again.
// Desktop and phones get it at full quality; headset browsers skip it entirely (see index.html).
// Asset sources and licenses: /assets/CREDITS.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const A = '/assets/';
const FILES = {
  cafe: A + 'rooms/cafe_misti.22c4cc62.glb',
  hall: A + 'venues/keynote_hall.96a1606d.glb',
  hallEnv: A + 'venues/keynote_hall.env.f59a7fbf.jpg',
  crowd: A + 'crowd/crowd.a1a787aa.glb',
  friend: A + 'avatars/Female_Adult_04.ad0ae8c6.glb',
  speaker: A + 'avatars/Female_Adult_09.0f612dfc.glb',
  clapperM: A + 'avatars/Male_Adult_05.45cb5a95.glb',
  fSitTalk: A + 'animations/f_sit_table_gestic_thoughtful.69f3ca02.glb',
  fStandTalk: A + 'animations/f_gestic_talk_neutral_01.4e07101f.glb',
  fClap: A + 'animations/f_claphands_01.05fc04b3.glb',
  mClap: A + 'animations/m_claphands_01.13e471af.glb',
  rover: A + 'space/perseverance.glb',
};

const DWELL = 13; // seconds each scene stays on screen
const FADE = 2.2; // seconds of dissolve into the next one

const hero = document.querySelector('.hero');
const canvas = document.querySelector('.hero-canvas');
const loading = document.querySelector('.hero-loading');
const caption = document.querySelector('.hero-caption');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData === true;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  hero.classList.add('no-webgl');
  throw new Error('WebGL unavailable; the hero shows without 3D.');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 900);

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
gltf.setDRACOLoader(draco); // the NASA rover is Draco-compressed
const texLoader = new THREE.TextureLoader();

const cache = new Map();
function load(url, onProgress) {
  if (!cache.has(url)) cache.set(url, gltf.loadAsync(url, onProgress));
  return cache.get(url);
}
const ease = (t) => t * t * (3 - 2 * t);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
  body.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  body.position.set(...position);
  body.rotation.y = facing;
  const mixer = new THREE.AnimationMixer(body);
  // Clips carry tracks for bones some avatars lack; drop those to keep the console quiet.
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

// A slow camera move between two [position, look-at] keyframes.
function drift(from, to) {
  const p0 = new THREE.Vector3(...from[0]), p1 = new THREE.Vector3(...to[0]);
  const l0 = new THREE.Vector3(...from[1]), l1 = new THREE.Vector3(...to[1]);
  return (t, pos, look) => { const k = ease(t); pos.lerpVectors(p0, p1, k); look.lerpVectors(l0, l1, k); };
}

// ---------- Café: the friend across the table ----------
async function buildCafe() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ee);
  const room = (await load(FILES.cafe, progress)).scene.clone();
  unlitBaked(room);
  scene.add(room);
  addLights(scene);
  const friend = await person(FILES.friend, FILES.fSitTalk, { position: [0, 0, 1.48] });
  scene.add(friend.body);
  return {
    scene,
    mixers: [friend.mixer],
    fov: [55, 70, 84],
    push: 0.4, // metres the camera eases forward as the hero scrolls away
    // From just inside the room, a slow walk up to your seat at her table.
    pose: drift([[1.1, 1.5, -1.7], [0, 1.02, 1.45]], [[0.35, 1.3, -0.45], [0, 1.1, 1.48]]),
    caption: ['Communication: a coffee chat', '/com'],
  };
}

// ---------- Keynote hall: a talk on stage in front of a full room ----------
const FLOOR_Y = -0.82;
const ROW_Z0 = 5.3, ROW_DZ = 1.0, ROWS = 10, SEAT_DX = 0.6;
// The crowd's baked head turn per pose; glTF is the mirror of Acento's Babylon frame, so 'left' there is +yaw here.
const CROWD_POSE_POS = 'left', CROWD_POSE_NEG = 'right';

async function buildHall() {
  const scene = new THREE.Scene();
  const env = await texLoader.loadAsync(FILES.hallEnv);
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
    const m = /^crowd-(.+)-(left|right)-(near|far)$/.exec(o.parent?.name ?? '');
    if (m) (variants[`${m[2]}-${m[3]}`] ||= []).push(o);
  });
  const seats = [];
  for (let r = 0; r < ROWS; r++) {
    for (const side of [-1, 1]) {
      for (let k = 1; k <= 16; k++) {
        const x = side * (0.8 + (k - 0.5) * SEAT_DX);
        if (Math.abs(x) <= 10.9) seats.push({ r, x, z: ROW_Z0 + r * ROW_DZ });
      }
    }
  }
  const velvet = new THREE.MeshStandardMaterial({ color: 0x2b1f2a, roughness: 0.9 });
  const seatMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.1, 0.5), velvet, seats.length);
  const backMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.55, 0.08), velvet, seats.length);
  const m4 = new THREE.Matrix4();
  seats.forEach((s, i) => {
    seatMesh.setMatrixAt(i, m4.makeTranslation(s.x, FLOOR_Y + 0.41, s.z + 0.05));
    backMesh.setMatrixAt(i, m4.makeTranslation(s.x, FLOOR_Y + 0.7, s.z + 0.32));
  });
  scene.add(seatMesh, backMesh);

  // About two thirds of the seats taken, each person turned a little toward the presenter.
  const rand = mulberry32(7);
  const placements = {};
  for (const s of seats) {
    if (rand() > 0.68) continue;
    const toStage = Math.atan2(-s.x, -s.z);
    const turn = Math.atan2(Math.sin(toStage - Math.PI), Math.cos(toStage - Math.PI));
    const key = `${turn > 0 ? CROWD_POSE_POS : CROWD_POSE_NEG}-${s.r < 3 ? 'near' : 'far'}`;
    (placements[key] ||= []).push({ s, yaw: Math.PI + turn * 0.35 + (rand() - 0.5) * 0.1, pick: rand() });
  }
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
  for (const [key, list] of Object.entries(placements)) {
    const meshes = variants[key] || [];
    meshes.forEach((src, vi) => {
      const mine = list.filter((p) => Math.floor(p.pick * meshes.length) === vi);
      if (!mine.length) return;
      const inst = new THREE.InstancedMesh(src.geometry, src.material, mine.length);
      src.updateMatrix();
      mine.forEach((p, i) => {
        m4.compose(at.set(p.s.x, FLOOR_Y, p.s.z + 0.1), q.setFromAxisAngle(up, p.yaw), one);
        inst.setMatrixAt(i, m4.multiply(src.matrix));
      });
      inst.frustumCulled = false;
      scene.add(inst);
    });
  }

  const speaker = await person(FILES.speaker, FILES.fStandTalk, { position: [0, 0, 0], facing: 0 });
  scene.add(speaker.body);
  return {
    scene,
    mixers: [speaker.mixer],
    fov: [55, 70, 84],
    push: 1.2,
    // From the middle of the stalls, a slow glide down the aisle toward the stage.
    pose: drift([[0.6, 1.9, 13], [0, 0.95, 0]], [[1.1, 1.45, 8.2], [0, 1.1, 0]]),
    caption: ['Communication: a talk on stage', '/com'],
  };
}

// ---------- Space: NASA's Perseverance rover on Mars ----------
function skyDome(top, horizon, bottom, radius = 400) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.8, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}

async function buildMars() {
  const scene = new THREE.Scene();
  scene.userData.toneMapping = THREE.ACESFilmicToneMapping;
  const dome = skyDome(0xc9a27e, 0xe7c29a, 0x8a5a3c);
  scene.add(dome);
  {
    const s = new THREE.Scene();
    s.add(dome.clone());
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(s, 0.02).texture;
    pmrem.dispose();
  }
  scene.environmentIntensity = 0.7;
  scene.fog = new THREE.FogExp2(0xd9b08a, 0.018);
  scene.add(new THREE.HemisphereLight(0xffe2c4, 0x7a4a30, 0.6));
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
  sun.position.set(-8, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // Gentle rolling ground, flat around the rover.
  const maps = await Promise.all(['diff', 'nor', 'rough'].map((k) => texLoader.loadAsync(`${A}space/ground/aerial_sand_${k}_1k.jpg`)));
  for (const t of maps) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.anisotropy = 8; }
  maps[0].colorSpace = THREE.SRGBColorSpace;
  const segs = 220;
  const geo = new THREE.PlaneGeometry(220, 220, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) + 0.5 * Math.sin(x * 0.31 + z * 0.17) + 0.25 * Math.sin(x * 0.7 - z * 0.5);
    p.setY(i, n * 2.2 * THREE.MathUtils.smoothstep(Math.hypot(x, z), 7, 21));
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: maps[0], normalMap: maps[1], roughnessMap: maps[2], color: 0xd28a5c }));
  ground.receiveShadow = true;
  scene.add(ground);

  const shadowed = (root) => { root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return root; };

  // Rover at its real size: about 3 m long.
  const rover = shadowed((await load(FILES.rover)).scene);
  const box = new THREE.Box3().setFromObject(rover);
  const size = box.getSize(new THREE.Vector3());
  rover.scale.setScalar(3.0 / Math.max(size.x, size.z));
  box.setFromObject(rover);
  rover.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const turn = new THREE.Group();
  turn.add(rover);
  turn.rotation.y = -0.5;
  scene.add(turn);

  // Scanned rocks, tinted to Martian basalt.
  const rockSrc = [shadowed((await load(A + 'space/rock_07/rock_07.gltf')).scene)];
  rockSrc.push(shadowed((await load(A + 'space/moon_rock_03/moon_rock_03.gltf')).scene));
  const rand = mulberry32(11);
  for (let i = 0; i < 70; i++) {
    const r = rockSrc[i % rockSrc.length].clone();
    r.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0xb07050); } });
    const ang = rand() * Math.PI * 2, dist = 4 + rand() * rand() * 40;
    r.position.set(Math.cos(ang) * dist, -0.05, Math.sin(ang) * dist);
    r.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    r.scale.setScalar((0.2 + rand() * rand() * 2.4) * (dist < 7 ? 0.5 : 1));
    scene.add(r);
  }

  // A little dust in the air, catching the sun.
  const count = 400;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) dp.set([(rand() - 0.5) * 30, rand() * 4, (rand() - 0.5) * 30], i * 3);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'); const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe1bf, size: 0.05, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 })));
  const dust = { update(dt) { for (let i = 0; i < count; i++) { let y = dp[i * 3 + 1] + dt * 0.04 * (0.5 + ((i * 7) % 5) / 5); if (y > 4) y = 0; dp[i * 3 + 1] = y; } dg.attributes.position.needsUpdate = true; } };

  // A slow quarter turn around the rover, from its front-right three-quarter view.
  const target = new THREE.Vector3(0, 0.9, 0);
  return {
    scene,
    mixers: [dust],
    fov: [45, 55, 62],
    push: 1.0,
    pose(t, pos, look) {
      const a = 0.8 + t * 0.75;
      const r = portrait ? 7.4 : 6.5, h = portrait ? 2.3 : 1.9;
      pos.set(Math.sin(a) * r, h, Math.cos(a) * r);
      look.copy(target);
    },
    caption: ['Space: Perseverance on Mars', '/spc'],
  };
}

// ---------- Scenes, loaded one at a time ----------
const ORDER = [buildCafe, buildHall, buildMars];
const scenes = ORDER.map(() => null);
const pending = ORDER.map(() => null);
function ensure(i) {
  if (!pending[i]) {
    pending[i] = ORDER[i]()
      .then((s) => { scenes[i] = s; return s; })
      .catch((err) => { console.warn('[vrtor] hero scene failed', err); });
  }
  return pending[i];
}
function progress(e) {
  if (e.total && loading) loading.querySelector('span').textContent = `${Math.round((e.loaded / e.total) * 100)}%`;
}

// ---------- Dissolve: during a change, both scenes render live offscreen and are blended ----------
// Offscreen targets skip the renderer's tone mapping and sRGB output, so the blend applies them per scene.
const rtOpts = { type: THREE.HalfFloatType, samples: 4 } // MSAA, so the dissolve is as smooth-edged as the normal view;
const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts), rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
const blendMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: rtA.texture }, b: { value: rtB.texture }, acesA: { value: 0 }, acesB: { value: 0 }, k: { value: 0 } },
  depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D a; uniform sampler2D b; uniform float acesA; uniform float acesB; uniform float k; varying vec2 vUv;
    vec3 fit(vec3 v){ vec3 x = v * (v + 0.0245786) - 0.000090537; vec3 y = v * (0.983729 * v + 0.4329510) + 0.238081; return x / y; }
    vec3 aces(vec3 c){ // same curve as three's ACESFilmicToneMapping, exposure 1
      const mat3 i = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 o = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      return clamp(o * fit(i * (c / 0.6)), 0.0, 1.0);
    }
    vec3 srgb(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
    void main(){
      vec3 ca = texture2D(a, vUv).rgb, cb = texture2D(b, vUv).rgb;
      ca = srgb(acesA > 0.5 ? aces(ca) : ca);
      cb = srgb(acesB > 0.5 ? aces(cb) : cb);
      gl_FragColor = vec4(mix(ca, cb, k), 1.0);
    }`,
});
const blendScene = new THREE.Scene();
const blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blendQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blendMat);
blendQuad.frustumCulled = false; // positioned in clip space by the shader
blendScene.add(blendQuad);

// ---------- Camera framing per screen shape ----------
let portrait = false;
const pos = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3();

// 0 with the hero fully on screen, 1 once it has scrolled away; smoothed in the loop.
let scrollTarget = 0, scrollK = 0;
function readScroll() { scrollTarget = THREE.MathUtils.clamp(window.scrollY / Math.max(hero.offsetHeight, 1), 0, 1); }
if (!reduceMotion) { window.addEventListener('scroll', readScroll, { passive: true }); readScroll(); }
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  portrait = camera.aspect < 0.9;
  // Wide screens: the text panel is on the left, so shift the subject to the right.
  if (camera.aspect > 1.2) camera.setViewOffset(w, h, -w * 0.18, 0, w, h);
  // Phones: the text sits in a sheet at the bottom, so lift the subject into the top half.
  else if (portrait) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
  else camera.clearViewOffset();
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  rtA.setSize(db.x, db.y); rtB.setSize(db.x, db.y);
  if (!running) draw(0);
}

// ---------- Loop ----------
let current = 0, t = 0, prev = -1, prevT = 0, fading = 0, running = false, visible = true, started = false;

function render(s, k, target = null) {
  const fov = s.fov[camera.aspect < 0.6 ? 2 : portrait ? 1 : 0];
  if (camera.fov !== fov) camera.fov = fov;
  camera.updateProjectionMatrix();
  s.pose(Math.min(k, 1), pos, look);
  // Scrolling the hero away dollies the camera a little further in (position and target together).
  if (scrollK > 0) {
    fwd.subVectors(look, pos).normalize().multiplyScalar(s.push * ease(scrollK));
    pos.add(fwd); look.add(fwd);
  }
  camera.position.copy(pos);
  camera.lookAt(look);
  renderer.toneMapping = s.scene.userData.toneMapping ?? THREE.NoToneMapping;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(s.scene, camera);
}

function setCaption(s) {
  if (!caption) return;
  caption.classList.add('swap');
  setTimeout(() => {
    caption.firstChild.textContent = s.caption[0] + ' ';
    caption.querySelector('span').textContent = 'vrtor.io' + s.caption[1];
    caption.href = s.caption[1] === '/com' ? '/com' : s.caption[1] + '/';
    caption.classList.remove('swap');
  }, 400);
}

function nextReady() {
  for (let k = 1; k < scenes.length; k++) {
    const i = (current + k) % scenes.length;
    if (scenes[i]) return i;
  }
  return -1;
}

function draw(dt) {
  const s = scenes[current];
  if (!s) return;
  t += dt;
  for (const m of s.mixers) m.update(dt);
  scrollK += (scrollTarget - scrollK) * (1 - Math.exp(-dt * 6));
  // Poses run a little past the dwell so both cameras are still moving while they dissolve.
  const span = DWELL + FADE;
  if (fading > 0) {
    const p = scenes[prev];
    prevT += dt;
    for (const m of p.mixers) m.update(dt);
    fading = Math.max(0, fading - dt);
    render(p, prevT / span, rtA);
    render(s, t / span, rtB);
    blendMat.uniforms.acesA.value = p.scene.userData.toneMapping ? 1 : 0;
    blendMat.uniforms.acesB.value = s.scene.userData.toneMapping ? 1 : 0;
    blendMat.uniforms.k.value = ease(1 - fading / FADE);
    renderer.setRenderTarget(null);
    renderer.render(blendScene, blendCam);
  } else {
    render(s, t / span);
  }
  if (!reduceMotion && t >= DWELL && fading === 0) {
    const n = nextReady();
    if (n < 0) return; // nothing else loaded yet: keep drifting here
    prev = current; prevT = t;
    current = n; t = 0; fading = FADE;
    setCaption(scenes[n]);
    // Load the one after this while this one plays (phones: only if they stay).
    if (!saveData) ensure((n + 1) % scenes.length);
  }
}

const clock = new THREE.Clock();
function frame() { draw(Math.min(clock.getDelta(), 0.1)); }
function sync() {
  const should = started && visible && !document.hidden && !reduceMotion;
  if (should === running) return;
  running = should;
  clock.getDelta(); // don't jump after a pause
  renderer.setAnimationLoop(should ? frame : null);
}
new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(hero);
document.addEventListener('visibilitychange', sync);
new ResizeObserver(resize).observe(canvas);

(async () => {
  const first = await ensure(0);
  if (!first) { hero.classList.add('no-webgl'); return; }
  resize();
  draw(0);
  started = true;
  hero.classList.add('is-ready');
  if (loading) loading.hidden = true;
  sync();
  if (!saveData && !reduceMotion) ensure(1);
})();
