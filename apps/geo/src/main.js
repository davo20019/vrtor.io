// Earth (experiment): the whole planet from open data, in WebXR. Start in orbit, fall
// into a city, fly around it. No keys, no accounts:
//   - imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), about 10 m per pixel
//   - terrain: Terrain Tiles on AWS (Mapzen Terrarium; SRTM, GMTED2010, ETOPO1 and others)
//   - buildings: Overture Maps footprints and heights (ODbL, mostly OpenStreetMap),
//     extruded in buildings.js
//   - Helsinki's Kalasatama district: the city's real photo mesh (CC BY 4.0), helsinki.js
//
// Precision: the tiles are in Earth-centred coordinates (millions of metres), too big
// for the GPU's 32-bit floats. ReorientationPlugin moves the tiles so the spot you are
// over sits at the origin with +Y up, and recenter() repeats that whenever you fly
// far enough away, so everything near you always has small coordinates.
import './style.css';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { ReorientationPlugin, TerrariumMeshPlugin, XYZTilesOverlay } from '3d-tiles-renderer/plugins';
import { PLACES } from './places.js';
import { createBuildings } from './buildings.js';
import { createHelsinki, HELSINKI_CREDIT } from './helsinki.js';
import { createVrUi } from './vrUi.js';

const IMAGERY = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const CREDITS =
  'Imagery: Sentinel-2 cloudless 2016 by EOX (Copernicus Sentinel data 2016), CC BY 4.0 · ' +
  'Terrain: Mapzen Terrain Tiles on AWS · Buildings: Overture Maps Foundation, © OpenStreetMap contributors (ODbL) · ' +
  HELSINKI_CREDIT;

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
// Logarithmic depth: precise from your controllers (5 cm away) out to the far side of the
// planet, so the near plane never has to grow with height and cut off hands and menus.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-0.5, 1, 0.3);
scene.add(sun);

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

// Headset interface: places menu, controller lasers, wrist display (vrUi.js).
const vrUi = createVrUi({
  renderer,
  rig,
  camera,
  places: PLACES,
  credits: CREDITS,
  onPick: (i) => (i === state.place && !state.visited ? fall() : goToPlace(i)),
  onOrbit: () => backToOrbit(),
  onGrab: (getRay) => grabStart(getRay),
  onRelease: (getRay) => grabEnd(getRay),
});

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
  menuIn: 0, // frames until the welcome menu opens (the headset pose needs a moment)
  center: { lat: 0, lon: 0 }, // the spot (radians) at the local origin, under you
};

let tiles = null;
let reorient = null;
let helsinki = null;
const buildings = createBuildings(scene);

// ---------- tiles ----------
function start() {
  const first = PLACES[0];
  tiles = new TilesRenderer();
  tiles.registerPlugin(new TerrariumMeshPlugin({
    url: TERRAIN,
    maxZoom: 15,
    overlay: new XYZTilesOverlay({ url: IMAGERY, levels: 15 }),
    applyOverlayTexture: true,
  }));
  reorient = new ReorientationPlugin({ lat: first.lat * D2R, lon: first.lon * D2R, height: 0 });
  tiles.registerPlugin(reorient);
  if (params.has('error')) tiles.errorTarget = Number(params.get('error'));
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  scene.add(tiles.group);

  helsinki = createHelsinki(camera, renderer, params.get('hel') || undefined);
  scene.add(helsinki.tiles.group);
  if (params.has('debug')) window.vrtorGeo = { THREE, tiles, helsinki, rig, state, camera, vrUi };

  // Terrain doesn't draw where a photo mesh already did (helsinki.js marks the stencil).
  tiles.addEventListener('load-model', ({ scene }) => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material.stencilWrite = true;
      o.material.stencilRef = 1;
      o.material.stencilFunc = THREE.NotEqualStencilFunc;
      o.material.stencilZPass = THREE.KeepStencilOp;
    });
  });

  tiles.addEventListener('load-root-tileset', () => {
    loading.hidden = true;
  });
  tiles.addEventListener('load-error', (e) => {
    console.warn('tiles load error', e);
    if (!loading.hidden || e.tile?.parent == null) {
      loading.hidden = false;
      loadingText.textContent = 'The open map tiles did not load. Check the connection and reload.';
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
  state.center = { lat: p.lat * D2R, lon: p.lon * D2R };
  grab = null;
  spin = null;
  state.groundY = p.ground;
  rig.position.set(0, p.ground + height, 0);
  rig.rotation.set(0, Math.PI - p.heading * D2R, 0);
  if (!renderer.xr.isPresenting) camera.rotation.x = pitchFor(height);
  updatePlaceButtons();
  vrUi.setCurrent(i);
}

// On a flat screen, look down at the planet from orbit and level out near the ground.
// (In the headset you look wherever you like.)
function pitchFor(agl) {
  return agl > 500_000 ? -1.25 : agl > 20_000 ? -0.9 : -0.3;
}

// Fly (in log height, so the speed you see stays steady) to `agl` metres above the ground.
function flyTo(agl, duration) {
  state.flight = {
    from: Math.log10(Math.max(rig.position.y - state.groundY, 1)),
    to: Math.log10(agl),
    pitchFrom: camera.rotation.x,
    pitchTo: pitchFor(agl),
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
  state.center = { lat: _carto.lat, lon: _carto.lon };
  rig.position.set(0, _carto.height, 0);
  state.groundY += dy;
}

// ---------- grabbing the Earth ----------
// Squeeze a grip (or drag the mouse from high up) to grab the spot you point at, then
// move: the Earth turns so that spot stays under your pointer. It works by moving which
// spot is at the origin under you, so you stay upright; from orbit it spins the globe,
// near the ground it pans the land. Let go mid-swing and it keeps spinning, slowing down.
let grab = null; // { point: grabbed spot (Earth-centred), getRay, axis, speed }
let spin = null; // { axis, speed } after letting go: radians per second about an Earth axis
const _gray = new THREE.Ray();
const _ghit = new THREE.Vector3();
const _gcenter = new THREE.Vector3();
const _gq = new THREE.Quaternion();
const _gcarto = {};
let grabEllipsoid = null;

// Where a world-space ray meets the ground (the ellipsoid raised to the local ground
// height), in Earth-centred coordinates; null when it points past the planet.
function rayToGround(origin, dir, target) {
  grabEllipsoid ??= tiles.ellipsoid.clone();
  grabEllipsoid.radius.copy(tiles.ellipsoid.radius).addScalar(Math.max(state.groundY, 0));
  _inv.copy(tiles.group.matrixWorld).invert();
  _gray.origin.copy(origin).applyMatrix4(_inv);
  _gray.direction.copy(dir).transformDirection(_inv);
  return grabEllipsoid.intersectRay(_gray, target);
}

// Turn the Earth under you by `q` (a rotation of Earth-centred directions): the spot under
// you moves by the inverse, i.e. you move over the surface by q.
function rotateCenter(q) {
  tiles.ellipsoid.getCartographicToPosition(state.center.lat, state.center.lon, 0, _gcenter);
  _gcenter.applyQuaternion(q);
  tiles.ellipsoid.getPositionToCartographic(_gcenter, _gcarto);
  state.center.lat = THREE.MathUtils.clamp(_gcarto.lat, -1.5, 1.5);
  state.center.lon = _gcarto.lon;
  reorient.transformLatLonHeightToOrigin(state.center.lat, state.center.lon, 0);
}

// ---------- zoom ----------
// Zooming changes your height (by a factor, so it feels the same from orbit to the street)
// and, zooming in, also moves you toward what you point at: the closer you get, the more
// that spot comes to sit under you.
const MIN_AGL = 2;
const MAX_AGL = 20_000_000;
const _zq = new THREE.Quaternion();
const _zpart = new THREE.Quaternion();
const _zu = new THREE.Vector3();
const _zhit = new THREE.Vector3();
const IDENTITY = new THREE.Quaternion();
function setHeight(agl) {
  rig.position.y = state.groundY + THREE.MathUtils.clamp(agl, MIN_AGL, MAX_AGL);
}
function zoomToward(factor, getRay) {
  if (!tiles) return;
  state.flight = null;
  spin = null;
  const agl = Math.max(rig.position.y - state.groundY, 1);
  const next = THREE.MathUtils.clamp(agl * factor, MIN_AGL, MAX_AGL);
  if (next < agl && getRay) {
    const [o, d] = getRay();
    if (rayToGround(o, d, _zhit)) {
      tiles.ellipsoid.getCartographicToPosition(state.center.lat, state.center.lon, 0, _zu);
      _zq.setFromUnitVectors(_zu.normalize(), _zhit.normalize());
      rotateCenter(_zpart.slerpQuaternions(IDENTITY, _zq, 1 - next / agl));
    }
  }
  setHeight(next);
}

// Both grips held: pull your hands apart to zoom in, push them together to zoom out.
const grips = new Set(); // getRay of each squeezed controller
let pinch = null; // { d0, agl0 }
function handsApart() {
  const [a, b] = [...grips];
  return a()[0].distanceTo(b()[0]);
}

function grabStart(getRay) {
  if (!tiles) return;
  grips.add(getRay);
  if (grips.size === 2) {
    grab = null;
    pinch = { d0: Math.max(handsApart(), 0.05), agl0: Math.max(rig.position.y - state.groundY, 1) };
    return;
  }
  const [o, d] = getRay();
  const point = rayToGround(o, d, new THREE.Vector3());
  if (!point) return; // pointing at the sky
  grab = { point, getRay, axis: new THREE.Vector3(), speed: 0 };
  spin = null;
  state.flight = null;
}

function grabEnd(getRay) {
  if (getRay) grips.delete(getRay);
  if (pinch) {
    // one hand let go: back to dragging with the other
    pinch = null;
    const other = [...grips][0];
    if (other) {
      grips.delete(other);
      grabStart(other);
    }
    return;
  }
  if (!grab || (getRay && grab.getRay !== getRay)) return;
  // keep the swing going if it was quick enough to be a fling
  if (grab.speed > 0.002) spin = { axis: grab.axis.clone(), speed: Math.min(grab.speed, 1) };
  grab = null;
}

const _gu = new THREE.Vector3();
const _gv = new THREE.Vector3();
const _gaxis = new THREE.Vector3();
function updateGrab(dt) {
  if (pinch && grips.size === 2) {
    state.flight = null;
    setHeight(pinch.agl0 * (pinch.d0 / Math.max(handsApart(), 0.02)) ** 3);
    return;
  }
  if (grab) {
    const [o, d] = grab.getRay();
    // past the edge of the planet: hold still until the pointer comes back
    if (!rayToGround(o, d, _ghit)) {
      grab.speed = 0;
      return;
    }
    // the rotation carrying the spot now under the pointer to the grabbed one
    _gu.copy(_ghit).normalize();
    _gv.copy(grab.point).normalize();
    const angle = _gu.angleTo(_gv);
    if (angle < 1e-9) return;
    _gq.setFromUnitVectors(_gu, _gv);
    rotateCenter(_gq);
    // smoothed angular velocity, for the fling
    _gaxis.crossVectors(_gu, _gv).normalize();
    const k = Math.min(1, dt * 12);
    grab.axis.lerp(_gaxis, k).normalize();
    grab.speed += (angle / Math.max(dt, 1e-3) - grab.speed) * k;
  } else if (spin) {
    _gq.setFromAxisAngle(spin.axis, spin.speed * dt);
    rotateCenter(_gq);
    spin.speed *= Math.exp(-dt * 1.5);
    if (spin.speed < 0.0005) spin = null;
  }
}

// ---------- ground ----------
const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const DOWN = new THREE.Vector3(0, -1, 0);
let groundTick = 0;
function probeGround() {
  const agl = rig.position.y - state.groundY;
  if (agl > 40_000 || ++groundTick % 8) return;
  ray.set(_p.set(rig.position.x, rig.position.y + 2000, rig.position.z), DOWN);
  ray.far = agl + 6000;
  const hit = ray.intersectObjects([tiles.group, helsinki.tiles.group], true).sort((a, b) => a.distance - b.distance)[0];
  // A surface well above your feet is a wall you walked into (the photo mesh has the
  // buildings in it): keep the ground you had instead of popping onto the roof.
  if (hit && hit.point.y < rig.position.y + 1.5) state.groundY = hit.point.y;
}

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
// Mouse: from high up, drag spins the globe (grab); near the ground, drag looks around.
let drag = null;
const mouseNdc = new THREE.Vector2();
const mouseRay = new THREE.Raycaster();
const mouseGetRay = () => {
  mouseRay.setFromCamera(mouseNdc, camera);
  return [mouseRay.ray.origin, mouseRay.ray.direction];
};
const setNdc = (e) => mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, grab: rig.position.y - state.groundY > 20_000 };
  canvas.setPointerCapture(e.pointerId);
  setNdc(e);
  if (drag.grab) grabStart(mouseGetRay);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || renderer.xr.isPresenting) return;
  setNdc(e);
  if (!drag.grab) {
    rig.rotation.y += (e.clientX - drag.x) * 0.004;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + (e.clientY - drag.y) * 0.004, -1.5, 1.5);
  }
  drag = { ...drag, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => {
  if (drag?.grab) grabEnd(mouseGetRay);
  drag = null;
});
// Wheel or trackpad pinch: zoom toward the point under the cursor.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  setNdc(e);
  zoomToward(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), mouseGetRay);
}, { passive: false });

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
        const x = edge(source, 4), y = edge(source, 5);
        if (x || y) vrUi.toggleMenu(); // X, Y
      } else {
        // push forward to zoom toward where this controller points, pull back to zoom out
        if (Math.abs(sy) > 0.2) zoomToward(Math.exp(sy * 1.4 * dt), vrUi.rayOf('right'));
        if (Math.abs(sx) > 0.7) {
          if (!turnLatch) snapTurn(-Math.sign(sx) * Math.PI / 6);
          turnLatch = true;
        } else if (Math.abs(sx) < 0.3) turnLatch = false;
        if (edge(source, 4)) vrUi.toggleMenu(); // A
        if (edge(source, 5)) { vrUi.closeMenu(); backToOrbit(); } // B
      }
    }
    // Hold a trigger to fly where that controller points (down to descend, up to climb),
    // faster the harder you pull.
    const fp = vrUi.flyPointer();
    if (fp) {
      state.flight = null;
      const agl = Math.max(rig.position.y - state.groundY, 1);
      const speed = THREE.MathUtils.clamp(agl * 0.8, 4, 4_000_000) * fp.value;
      fp.ray.getWorldDirection(_fwd).negate(); // a controller points down its -Z
      rig.position.addScaledVector(_fwd, speed * dt);
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
  // The far plane follows the horizon; the near one stays close (log depth, above).
  const near = 0.05;
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


let frames = 0, fpsClock = 0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  frames++;
  fpsClock += dt;

  if (renderer.xr.isPresenting) {
    if (state.menuIn > 0 && --state.menuIn === 0) vrUi.openMenu();
    vrUi.update();
  }

  if (tiles) {
    updateGrab(dt);
    move(dt);
    if (state.flight) {
      const f = state.flight;
      f.t = Math.min(f.t + dt / f.duration, 1);
      const s = f.t * f.t * (3 - 2 * f.t);
      rig.position.y = state.groundY + 10 ** (f.from + (f.to - f.from) * s);
      if (!renderer.xr.isPresenting) camera.rotation.x = f.pitchFrom + (f.pitchTo - f.pitchFrom) * s;
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
      helsinki.tiles.setResolution(xrCam, w / 2, h);
    } else {
      tiles.setResolutionFromRenderer(camera, renderer);
      helsinki.tiles.setResolutionFromRenderer(camera, renderer);
    }
    tiles.update();
    helsinki.update(tiles.group);
    _inv.copy(tiles.group.matrixWorld).invert();
    _p.copy(rig.position).applyMatrix4(_inv);
    tiles.ellipsoid.getPositionToCartographic(_p, _carto);
    buildings.update(tiles.group, _carto.lat, _carto.lon, agl);
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
  // Once you've grabbed or flown more than 200 km away, say where you are instead.
  const c = state.center;
  const away = 6_371_000 * Math.acos(Math.min(1,
    Math.sin(c.lat) * Math.sin(p.lat * D2R) + Math.cos(c.lat) * Math.cos(p.lat * D2R) * Math.cos(c.lon - p.lon * D2R)));
  const coords = `${Math.abs(c.lat / D2R).toFixed(1)}°${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lon / D2R).toFixed(1)}°${c.lon >= 0 ? 'E' : 'W'}`;
  const where = away > 200_000 ? `Over ${coords}` : agl > 50_000 ? `Above ${p.name}` : `${p.name}, ${p.spot}`;
  const kTris = Math.round(buildings.triangles / 1000);
  const measures = `${formatHeight(agl)} up · ${state.fps} fps · ${s.visible ?? '?'} ground tiles, ${(s.downloading ?? 0) + (s.parsing ?? 0) + buildings.loading} loading · buildings ${kTris}k tris`;
  statsEl.textContent = `${where}\n${measures}`;


  vrUi.setStatus([
    where,
    `${formatHeight(agl)} up · ${state.fps} fps`,
    `${s.visible ?? '?'} ground tiles · ${kTris}k building tris`,
    'Data: EOX · Mapzen · Overture/OSM · City of Helsinki',
  ]);
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
  const walk = $('[data-walk]');
  walk.hidden = !PLACES[state.place].walk;
  if (PLACES[state.place].walk) walk.href = PLACES[state.place].walk;
}
$('[data-orbit]').addEventListener('click', backToOrbit);
// + and −, for touch screens: zoom toward the middle of the view.
const centreRay = () => {
  mouseRay.setFromCamera(new THREE.Vector2(0, 0), camera);
  return [mouseRay.ray.origin, mouseRay.ray.direction];
};
document.querySelectorAll('[data-zoom]').forEach((b) =>
  b.addEventListener('click', () => zoomToward(b.dataset.zoom === 'in' ? 0.35 : 2.8, centreRay)),
);

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
  state.menuIn = 20;
  for (const t of tiles ? [tiles, helsinki.tiles] : []) {
    t.deleteCamera(camera);
    t.setCamera(renderer.xr.getCamera());
  }
});
renderer.xr.addEventListener('sessionend', () => {
  vrUi.closeMenu();
  camera.position.set(0, EYE, 0);
  camera.rotation.set(0, 0, 0);
  for (const t of tiles ? [tiles, helsinki.tiles] : []) {
    t.deleteCamera(renderer.xr.getCamera());
    t.setCamera(camera);
  }
});

start();
