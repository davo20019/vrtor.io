// Earth (experiment): Google's Photorealistic 3D Tiles in WebXR. Start in orbit,
// fall into a city, fly around it. A spike to measure how streamed globe data looks
// and runs on a Quest, from orbit down to street level.
//
// Precision: the tiles are in Earth-centred coordinates (millions of metres), too big
// for the GPU's 32-bit floats. ReorientationPlugin moves the tiles so the spot you are
// over sits at the origin with +Y up, and recenter() repeats that whenever you fly
// far enough away, so everything near you always has small coordinates.
import './style.css';
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TilesFadePlugin,
} from '3d-tiles-renderer/plugins';
import { PLACES } from './places.js';

const D2R = Math.PI / 180;
const ORBIT = 6_000_000; // metres above the ground: the whole Earth fills the view
const ARRIVE = 300; // metres above the ground at the end of a fall
const EYE = 1.6; // flat-screen eye height
const params = new URLSearchParams(location.search);

const $ = (s) => document.querySelector(s);
const loading = $('.loading');
const loadingText = $('.loading-text');
const statsEl = $('.stats');

// ---------- renderer, scene, rig ----------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 3));

// The rig is where your feet are; in the headset the camera moves inside it.
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1e8);
camera.position.y = EYE;
rig.add(camera);

// Stars: a shell around your head, in world orientation (snap turns don't spin the sky).
const stars = (() => {
  const n = 4000;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().toArray(pos, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -1;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

// Black sphere around the head for fades between places.
const fader = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }),
);
fader.renderOrder = 1000;
fader.visible = false;
camera.add(fader);

// Headset panel, low in view: where you are, the Google attribution (required
// whenever the tiles are on screen) and the measurements this spike is for.
const hud = (() => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.64, 0.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  mesh.position.set(0, -0.42, -1);
  mesh.rotation.x = -0.4;
  mesh.renderOrder = 999;
  mesh.visible = false;
  camera.add(mesh);
  let last = '';
  return {
    mesh,
    draw(lines) {
      const key = lines.join('\n');
      if (key === last) return;
      last = key;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(12,13,18,0.82)';
      g.beginPath();
      g.roundRect(0, 0, c.width, c.height, 36);
      g.fill();
      lines.forEach((line, i) => {
        g.fillStyle = i === 0 ? '#ffb020' : i === lines.length - 1 ? '#ffffff' : '#c9c4ba';
        g.font = i === 0 ? '600 46px system-ui, sans-serif' : '32px system-ui, sans-serif';
        g.fillText(line, 36, 70 + i * 54, c.width - 72);
      });
      tex.needsUpdate = true;
    },
  };
})();

// ---------- state ----------
const state = {
  place: 0,
  visited: false, // has the current place been fallen into since it was picked
  flight: null, // { from, to, t, duration } in log10(height above ground)
  groundY: PLACES[0].ground, // local height of the ground under you
  fade: 0,
  fadeTarget: 0,
  fadeDone: null,
  fps: 0,
};

let tiles = null;
let reorient = null;

// ---------- tiles ----------
async function start() {
  let key = params.get('key');
  if (!key) {
    try {
      key = (await (await fetch('config.json')).json()).tilesKey;
    } catch {
      key = null;
    }
  }
  if (!key) {
    loadingText.textContent =
      'This experiment needs a Google Map Tiles API key, and none is set yet. ' +
      '(npx wrangler secret put GOOGLE_TILES_KEY -c apps/geo/wrangler.jsonc)';
    return;
  }

  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  const first = PLACES[0];
  tiles = new TilesRenderer();
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true }));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  tiles.registerPlugin(new TilesFadePlugin());
  reorient = new ReorientationPlugin({ lat: first.lat * D2R, lon: first.lon * D2R, height: 0 });
  tiles.registerPlugin(reorient);
  if (params.has('error')) tiles.errorTarget = Number(params.get('error'));
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  scene.add(tiles.group);

  tiles.addEventListener('load-root-tileset', () => {
    loading.hidden = true;
  });
  tiles.addEventListener('load-error', (e) => {
    console.warn('tiles load error', e);
    if (!loading.hidden || e.tile?.parent == null) {
      loading.hidden = false;
      loadingText.textContent =
        'Google refused the 3D tiles. The Map Tiles API key may be missing a referrer, the API may be off, or billing may not be set up.';
    }
  });

  placeAt(0, ORBIT);
}

// Stand over a place at `height` metres above its ground, facing its heading.
function placeAt(i, height) {
  const p = PLACES[i];
  state.place = i;
  state.visited = false;
  reorient.transformLatLonHeightToOrigin(p.lat * D2R, p.lon * D2R, 0);
  state.groundY = p.ground;
  rig.position.set(0, p.ground + height, 0);
  rig.rotation.set(0, Math.PI - p.heading * D2R, 0);
  updatePlaceButtons();
}

// Fly (in log height, so the speed you see stays steady) to `agl` metres above the ground.
function flyTo(agl, duration) {
  state.flight = {
    from: Math.log10(Math.max(rig.position.y - state.groundY, 1)),
    to: Math.log10(agl),
    t: 0,
    duration,
  };
}

async function fadeTo(v) {
  state.fadeTarget = v;
  await new Promise((r) => (state.fadeDone = r));
}

async function goToPlace(i) {
  if (!tiles) return;
  i = (i + PLACES.length) % PLACES.length;
  state.flight = null;
  await fadeTo(1);
  placeAt(i, ORBIT);
  await fadeTo(0);
  fall();
}

function fall() {
  state.visited = true;
  flyTo(ARRIVE, 14);
}

function backToOrbit() {
  if (!tiles) return;
  flyTo(ORBIT, 10);
}

// The A (or X) button: fall into the picked place, or once there, go to the next one.
function primaryAction() {
  if (state.visited) goToPlace(state.place + 1);
  else fall();
}

// Keep the spot under you at the origin (see the note at the top).
const _inv = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _carto = {};
function recenter() {
  _inv.copy(tiles.group.matrixWorld).invert();
  _p.copy(rig.position).applyMatrix4(_inv);
  tiles.ellipsoid.getPositionToCartographic(_p, _carto);
  const dy = _carto.height - rig.position.y;
  reorient.transformLatLonHeightToOrigin(_carto.lat, _carto.lon, 0);
  rig.position.set(0, _carto.height, 0);
  state.groundY += dy;
}

// ---------- ground ----------
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
let groundTick = 0;
function probeGround() {
  const agl = rig.position.y - state.groundY;
  if (agl > 40_000 || ++groundTick % 8) return;
  ray.set(_p.set(rig.position.x, rig.position.y + 2000, rig.position.z), DOWN);
  ray.far = agl + 6000;
  const hit = ray.intersectObject(tiles.group, true)[0];
  if (hit) state.groundY = hit.point.y;
}

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || renderer.xr.isPresenting) return;
  rig.rotation.y += (e.clientX - drag.x) * 0.004;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + (e.clientY - drag.y) * 0.004, -1.5, 1.5);
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('wheel', (e) => {
  state.flight = null;
  const agl = Math.max(rig.position.y - state.groundY, 1);
  rig.position.y = state.groundY + agl * Math.exp(e.deltaY * 0.002);
}, { passive: true });

// Headset buttons, with edge detection per controller.
const pressed = new Map();
function edge(source, index) {
  const id = `${source.handedness}${index}`;
  const now = !!source.gamepad?.buttons[index]?.pressed;
  const was = pressed.get(id);
  pressed.set(id, now);
  return now && !was;
}
let turnLatch = false;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _head = new THREE.Vector3();
const _head2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function snapTurn(angle) {
  camera.getWorldPosition(_head);
  rig.rotation.y += angle;
  rig.updateMatrixWorld(true);
  camera.getWorldPosition(_head2);
  rig.position.add(_head.sub(_head2));
}

function move(dt) {
  let mx = 0, mz = 0, my = 0;
  if (renderer.xr.isPresenting) {
    for (const source of renderer.xr.getSession().inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;
      const [, , sx = 0, sy = 0] = gp.axes;
      if (source.handedness === 'left') {
        mx += sx; mz += sy;
        if (edge(source, 4)) goToPlace(state.place - 1); // X
        if (edge(source, 5)) backToOrbit(); // Y
      } else {
        my -= Math.abs(sy) > 0.2 ? sy : 0;
        if (Math.abs(sx) > 0.7) {
          if (!turnLatch) snapTurn(-Math.sign(sx) * Math.PI / 6);
          turnLatch = true;
        } else if (Math.abs(sx) < 0.3) turnLatch = false;
        if (edge(source, 4)) primaryAction(); // A
        if (edge(source, 5)) backToOrbit(); // B
      }
    }
  } else {
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyE') || keys.has('Space')) my += 1;
    if (keys.has('KeyQ') || keys.has('ShiftLeft')) my -= 1;
  }
  if (Math.abs(mx) < 0.15) mx = 0;
  if (Math.abs(mz) < 0.15) mz = 0;
  if (!mx && !mz && !my) return;
  state.flight = null;

  // Speed grows with height: walking pace near the street, thousands of km/s in orbit.
  const agl = Math.max(rig.position.y - state.groundY, 1);
  const speed = THREE.MathUtils.clamp(agl * 0.8, 4, 4_000_000);
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  _fwd.normalize();
  _right.crossVectors(_fwd, UP);
  rig.position.addScaledVector(_fwd, -mz * speed * dt);
  rig.position.addScaledVector(_right, mx * speed * dt);
  rig.position.y += my * speed * dt;
}

// ---------- frame ----------
const sky = new THREE.Color(0x8db4e2);
const space = new THREE.Color(0x000000);
let lastNear = 0, lastFar = 0;
function updateView(agl) {
  // Clip planes that fit the height: a fixed pair either z-fights in orbit or
  // clips the ground at street level.
  const near = 2 ** Math.round(Math.log2(THREE.MathUtils.clamp(agl * 0.002, 0.05, 2000)));
  const horizon = Math.sqrt(2 * 6_371_000 * agl) + agl;
  const far = 2 ** Math.ceil(Math.log2(Math.max(30_000, 2 * horizon)));
  if (near !== lastNear || far !== lastFar) {
    camera.near = lastNear = near;
    camera.far = lastFar = far;
    camera.updateProjectionMatrix();
  }

  // Blue sky below 10 km, black space above 200 km, stars once the sky is dark.
  const t = THREE.MathUtils.clamp((Math.log10(agl) - 4) / 1.3, 0, 1);
  scene.background.copy(sky).lerp(space, t);
  stars.visible = t > 0.3;
  stars.material.opacity = (t - 0.3) / 0.7;
  camera.getWorldPosition(stars.position);
  stars.scale.setScalar(far * 0.9);
}

function updateFade(dt) {
  const step = dt / 0.35;
  state.fade += THREE.MathUtils.clamp(state.fadeTarget - state.fade, -step, step);
  fader.visible = state.fade > 0.001;
  fader.material.opacity = state.fade;
  if (state.fade === state.fadeTarget && state.fadeDone) {
    const done = state.fadeDone;
    state.fadeDone = null;
    done();
  }
}

function formatHeight(m) {
  if (m >= 10_000) return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

let attributionText = '';
function attributions() {
  if (!tiles) return '';
  return tiles
    .getAttributions()
    .filter((a) => a.type === 'string')
    .map((a) => a.value)
    .join(' ');
}

let frames = 0, fpsClock = 0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  frames++;
  fpsClock += dt;

  if (tiles) {
    move(dt);
    if (state.flight) {
      const f = state.flight;
      f.t = Math.min(f.t + dt / f.duration, 1);
      const s = f.t * f.t * (3 - 2 * f.t);
      rig.position.y = state.groundY + 10 ** (f.from + (f.to - f.from) * s);
      if (f.t === 1) state.flight = null;
    }
    probeGround();
    if (rig.position.y < state.groundY) rig.position.y = state.groundY;
    const agl = rig.position.y - state.groundY;
    if (Math.hypot(rig.position.x, rig.position.z) > Math.max(5000, agl * 0.2)) recenter();

    updateView(Math.max(agl + (renderer.xr.isPresenting ? 1.6 : EYE), 1));
    camera.updateMatrixWorld(true);
    if (renderer.xr.isPresenting) {
      const xrCam = renderer.xr.getCamera();
      const layer = renderer.xr.getBaseLayer();
      const w = layer?.framebufferWidth ?? 3664;
      const h = layer?.framebufferHeight ?? 1920;
      tiles.setResolution(xrCam, w / 2, h);
    } else {
      tiles.setResolutionFromRenderer(camera, renderer);
    }
    tiles.update();
  }
  updateFade(dt);

  renderer.render(scene, camera);

  if (fpsClock >= 1) {
    state.fps = Math.round(frames / fpsClock);
    frames = 0;
    fpsClock = 0;
    updateReadout();
  }
});

function updateReadout() {
  if (!tiles) return;
  const p = PLACES[state.place];
  const agl = rig.position.y - state.groundY;
  const s = tiles.stats || {};
  const where = agl > 50_000 ? `Above ${p.name}` : `${p.name}, ${p.spot}`;
  const measures = `${formatHeight(agl)} up · ${state.fps} fps · ${s.visible ?? '?'} tiles shown, ${(s.downloading ?? 0) + (s.parsing ?? 0)} loading · error ${tiles.errorTarget}`;
  statsEl.textContent = `${where}\n${measures}`;

  const next = attributions();
  if (next !== attributionText) {
    attributionText = next;
    $('.attribution-data').textContent = next;
  }
  const action = state.visited ? `A: next place (${PLACES[(state.place + 1) % PLACES.length].name})` : `A: fall into ${p.name}`;
  hud.draw([where, measures, `${action} · B: back to orbit · X: previous`, 'Left stick: fly · Right stick: up, down, turn', `Google  ${attributionText}`]);
}

// ---------- page ----------
const placesEl = $('.places');
PLACES.forEach((p, i) => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.type = 'button';
  b.textContent = p.name;
  b.addEventListener('click', () => {
    if (i === state.place && !state.visited) fall();
    else goToPlace(i);
  });
  placesEl.append(b);
});
function updatePlaceButtons() {
  [...placesEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.place)));
}
$('[data-orbit]').addEventListener('click', backToOrbit);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- VR ----------
const vrButton = $('[data-enter-vr]');
navigator.xr?.isSessionSupported('immersive-vr').then((ok) => {
  vrButton.hidden = !ok;
});
vrButton.addEventListener('click', async () => {
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
  await renderer.xr.setSession(session);
});
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  session.updateTargetFrameRate?.(72).catch(() => {});
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  hud.mesh.visible = true;
  if (tiles) {
    tiles.deleteCamera(camera);
    tiles.setCamera(renderer.xr.getCamera());
  }
});
renderer.xr.addEventListener('sessionend', () => {
  hud.mesh.visible = false;
  camera.position.set(0, EYE, 0);
  camera.rotation.set(0, 0, 0);
  if (tiles) {
    tiles.deleteCamera(renderer.xr.getCamera());
    tiles.setCamera(camera);
  }
});

start();
