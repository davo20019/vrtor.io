// Earth (experiment): the whole planet from open data, in WebXR. It starts as a 3D globe
// in front of you (globe mode): turn it, zoom into any place, and when you're close enough
// you step in at full size (world mode) to stand and fly there. No keys, no accounts:
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
const ARRIVE = 300; // metres above the ground when you step into the world
const EYE = 1.6; // flat-screen eye height

// Globe mode: the Earth as a model whose spot `state.center` sits on a table point in
// front of you, scaled by `state.scale` (1 = real size). Seen from your eyes about
// 0.85 m away, that's the view from 0.85 / scale metres up; zooming in until that's
// ARRIVE steps you into the full-size world there.
const TABLE = new THREE.Vector3(0, 1.0, -0.75); // in the rig (your floor space)
const GLOBE_RADIUS = 0.35; // metres, fully zoomed out
const SCALE_MIN = GLOBE_RADIUS / 6_371_000;
const VIEW = 0.85; // metres from your eyes to the table point
const SCALE_STEP_IN = VIEW / ARRIVE;
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
  onPick: (i) => goToPlace(i),
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
  mode: 'globe', // 'globe' (the Earth as a model in front of you) | 'world' (full size)
  scale: SCALE_MIN,
  globeFlight: null, // animated zoom into a place on the globe
  center: { lat: 0, lon: 0 }, // the spot (radians) at the local origin, under you
};

let tiles = null;
let reorient = null;
let helsinki = null;
// Holds the tiles: identity in world mode, the scaled model in globe mode.
const earth = new THREE.Group();
scene.add(earth);
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
  earth.add(tiles.group);

  helsinki = createHelsinki(camera, renderer, params.get('hel') || undefined);
  scene.add(helsinki.tiles.group);
  if (params.has('debug')) window.vrtorGeo = { THREE, tiles, helsinki, rig, state, camera, vrUi, earth, grabStart, grabEnd, updateGrab, rayToGround, updateGlobe };

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

  const p = PLACES[0];
  setCenter(p.lat * D2R, p.lon * D2R);
  state.groundY = 0;
  enterGlobe(SCALE_MIN);
}

async function fadeTo(v) {
  state.fadeTarget = v;
  await new Promise((r) => (state.fadeDone = r));
}

function setCenter(lat, lon) {
  state.center = { lat, lon };
  reorient.transformLatLonHeightToOrigin(lat, lon, 0);
}

function selectPlace(i) {
  state.place = i;
  updatePlaceButtons();
  vrUi.setCurrent(i);
}

// ---------- modes ----------
function enterGlobe(scale) {
  state.mode = 'globe';
  state.scale = THREE.MathUtils.clamp(scale, SCALE_MIN, SCALE_STEP_IN);
  state.flight = null;
  grab = null;
  spin = null;
  rig.position.set(0, 0, 0);
  if (!renderer.xr.isPresenting) camera.rotation.x = -0.72; // down at the table point
}

// Step into the full-size world at the spot on the table, ARRIVE metres up.
async function stepIn(heading = null) {
  if (state.mode !== 'globe' || state.stepping) return;
  state.stepping = true;
  state.globeFlight = null;
  await fadeTo(1);
  state.mode = 'world';
  earth.position.set(0, 0, 0);
  earth.quaternion.identity();
  earth.scale.setScalar(1);
  earth.updateMatrixWorld(true);
  grab = null;
  spin = null;
  rig.position.set(0, state.groundY + ARRIVE, 0);
  if (heading != null) rig.rotation.set(0, Math.PI - heading * D2R, 0);
  if (!renderer.xr.isPresenting) camera.rotation.x = -0.3;
  await fadeTo(0);
  state.stepping = false;
}

// Back to the globe in front of you (B, or zooming out high above the world).
async function backToGlobe(scale = SCALE_MIN) {
  if (state.mode !== 'world' || state.stepping) return;
  state.stepping = true;
  await fadeTo(1);
  recenter();
  enterGlobe(scale);
  await fadeTo(0);
  state.stepping = false;
}
const backToOrbit = () => (state.mode === 'world' ? backToGlobe() : globeTo(SCALE_MIN));

// Picking a place: on the globe, turn to it and zoom in, then step in facing its view.
async function goToPlace(i) {
  if (!tiles) return;
  i = (i + PLACES.length) % PLACES.length;
  selectPlace(i);
  if (state.mode === 'world') await backToGlobe(Math.max(state.scale, SCALE_MIN));
  const p = PLACES[i];
  tiles.ellipsoid.getCartographicToPosition(state.center.lat, state.center.lon, 0, _from);
  tiles.ellipsoid.getCartographicToPosition(p.lat * D2R, p.lon * D2R, 0, _to);
  state.globeFlight = {
    q: new THREE.Quaternion().setFromUnitVectors(_from.clone().normalize(), _to.clone().normalize()),
    from: _from.clone(),
    s0: Math.log(state.scale),
    s1: Math.log(SCALE_STEP_IN),
    t: 0,
    duration: 7,
    place: p,
  };
  grab = null;
  spin = null;
}
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _gf = new THREE.Vector3();
const _gfq = new THREE.Quaternion();

// Animate the globe to a scale (used by "Back to orbit" on the globe).
function globeTo(scale) {
  state.globeFlight = { q: null, s0: Math.log(state.scale), s1: Math.log(scale), t: 0, duration: 3 };
}

function updateGlobeFlight(dt) {
  const f = state.globeFlight;
  if (!f) return;
  f.t = Math.min(f.t + dt / f.duration, 1);
  const e = f.t * f.t * (3 - 2 * f.t);
  if (f.q) {
    // turn first (done by 60%), zoom all the way
    const turn = Math.min(1, e / 0.6);
    _gfq.slerpQuaternions(IDENTITY, f.q, turn * turn * (3 - 2 * turn));
    _gf.copy(f.from).applyQuaternion(_gfq);
    tiles.ellipsoid.getPositionToCartographic(_gf, _gcarto);
    setCenter(_gcarto.lat, _gcarto.lon);
  }
  state.scale = Math.exp(f.s0 + (f.s1 - f.s0) * e);
  if (f.t === 1) {
    state.globeFlight = null;
    if (f.place) stepIn(f.place.heading);
  }
}

// Place the model each frame: the spot under `center` on the table point, turned with you,
// raised by its ground height so mountains don't swallow the table.
const _table = new THREE.Vector3();
function updateGlobe() {
  rig.localToWorld(_table.copy(TABLE));
  earth.quaternion.copy(rig.quaternion);
  earth.scale.setScalar(state.scale);
  earth.position.set(_table.x, _table.y - state.scale * state.groundY, _table.z);
  earth.updateMatrixWorld(true);
}

// Height of the view in globe mode (metres, as if you were up there at real size).
function globeHeight() {
  camera.getWorldPosition(_head);
  return Math.max(_head.distanceTo(_table), 0.2) / state.scale;
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
// Squeeze a grip (or drag the mouse on the globe) to grab the Earth where you point, then
// move: each frame it turns by exactly the arc your pointer moved across it, so the
// surface follows your hand (and nothing moves while your hand is still). It works by
// moving which spot is at the origin under you, so north stays up; on the globe it spins
// the model, in the world it pans the land. Let go mid-swing and it keeps spinning.
let grab = null; // { prev: last pointer hit (world), getRay, axis, speed }
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
  if (state.mode === 'globe') {
    // a height on the globe is a scale; zooming out of the world past 30 km (below) and
    // into the globe past ARRIVE (here) switch modes
    state.scale = THREE.MathUtils.clamp(VIEW / agl, SCALE_MIN, SCALE_STEP_IN);
    if (state.scale >= SCALE_STEP_IN) stepIn();
    return;
  }
  rig.position.y = state.groundY + THREE.MathUtils.clamp(agl, MIN_AGL, MAX_AGL);
  if (agl > 30_000) backToGlobe(VIEW / agl);
}
function currentHeight() {
  return state.mode === 'globe' ? VIEW / state.scale : Math.max(rig.position.y - state.groundY, 1);
}
function zoomToward(factor, getRay) {
  if (!tiles || state.stepping) return;
  state.flight = null;
  state.globeFlight = null;
  spin = null;
  const agl = currentHeight();
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
    pinch = { d0: Math.max(handsApart(), 0.05), agl0: currentHeight() };
    return;
  }
  const prev = pointerHit(getRay, new THREE.Vector3());
  if (!prev) return; // pointing at the sky
  grab = { prev, getRay, axis: new THREE.Vector3(), speed: 0 };
  spin = null;
  state.flight = null;
  state.globeFlight = null;
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
const _gc = new THREE.Vector3();
const _gnow = new THREE.Vector3();

// Where the pointer meets the Earth, in world space (null when it points past it). The
// Earth's sphere doesn't move in the world when it turns, so this depends only on the ray.
function pointerHit(getRay, target) {
  const [o, d] = getRay();
  if (!rayToGround(o, d, target)) return null;
  return target.applyMatrix4(tiles.group.matrixWorld);
}

function updateGrab(dt) {
  if (pinch && grips.size === 2) {
    state.flight = null;
    setHeight(pinch.agl0 * (pinch.d0 / Math.max(handsApart(), 0.02)) ** 3);
    return;
  }
  if (grab) {
    if (!pointerHit(grab.getRay, _gnow)) {
      grab.speed = 0; // past the edge of the planet: wait for the pointer to come back
      return;
    }
    // the arc the pointer moved over the sphere, about the Earth's centre (world space)
    _gc.set(0, 0, 0).applyMatrix4(tiles.group.matrixWorld);
    _gu.copy(grab.prev).sub(_gc).normalize();
    _gv.copy(_gnow).sub(_gc).normalize();
    grab.prev.copy(_gnow);
    const angle = _gu.angleTo(_gv);
    if (angle < 1e-9) {
      grab.speed *= Math.exp(-dt * 10);
      return;
    }
    // the Earth turns u → v under you, i.e. the spot under you turns the other way:
    // that axis in Earth-centred terms, by -angle
    _gaxis.crossVectors(_gu, _gv).normalize();
    _inv.copy(tiles.group.matrixWorld).invert();
    _gaxis.transformDirection(_inv).negate();
    rotateCenter(_gq.setFromAxisAngle(_gaxis, angle));
    // smoothed angular velocity, for the fling
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
  if (state.mode === 'globe') return probeGlobeGround();
  const agl = rig.position.y - state.groundY;
  if (agl > 40_000 || ++groundTick % 8) return;
  ray.set(_p.set(rig.position.x, rig.position.y + 2000, rig.position.z), DOWN);
  ray.far = agl + 6000;
  const hit = ray.intersectObjects([tiles.group, helsinki.tiles.group], true).sort((a, b) => a.distance - b.distance)[0];
  // A surface well above your feet is a wall you walked into (the photo mesh has the
  // buildings in it): keep the ground you had instead of popping onto the roof.
  if (hit && hit.point.y < rig.position.y + 1.5) state.groundY = hit.point.y;
}

// On the globe: the ground height under the table point, eased so the model doesn't jump.
function probeGlobeGround() {
  if (++groundTick % 8) return;
  const s = state.scale;
  ray.set(_p.set(_table.x, _table.y + s * 9000, _table.z), DOWN);
  ray.far = s * 20000 + 1;
  const hit = ray.intersectObjects([tiles.group, helsinki.tiles.group], true).sort((a, b) => a.distance - b.distance)[0];
  if (!hit) return;
  const ground = (hit.point.y - (_table.y - s * state.groundY)) / s;
  state.groundY += (ground - state.groundY) * 0.5;
}

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
// Mouse: on the globe, drag turns it (grab); in the world, drag looks around.
let drag = null;
const mouseNdc = new THREE.Vector2();
const mouseRay = new THREE.Raycaster();
const mouseGetRay = () => {
  mouseRay.setFromCamera(mouseNdc, camera);
  return [mouseRay.ray.origin, mouseRay.ray.direction];
};
const setNdc = (e) => mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, grab: state.mode === 'globe' };
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
    // faster the harder you pull. On the globe, it zooms toward where you point.
    const fp = vrUi.flyPointer();
    if (fp && state.mode === 'globe') {
      zoomToward(Math.exp(-1.3 * fp.value * dt), fp.getRay);
    } else if (fp) {
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

  if (state.mode === 'globe') {
    // sticks / keys roll the globe under the table point, at a pace that suits the zoom
    state.globeFlight = null;
    const rate = (currentHeight() * 0.9) / 6_371_000; // radians per second
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _right.crossVectors(_fwd, UP);
    if (my) zoomToward(Math.exp(my * 1.2 * dt)); // up zooms out, down zooms in
    // travel the way you push: turning the spot under you toward a direction d means
    // rotating about (up × d)
    _gaxis.crossVectors(UP, _fwd).multiplyScalar(-mz).add(_gu.crossVectors(UP, _right).multiplyScalar(mx));
    const amount = Math.min(1, _gaxis.length());
    if (amount < 1e-4) return;
    _inv.copy(tiles.group.matrixWorld).invert();
    _gaxis.transformDirection(_inv);
    rotateCenter(_gq.setFromAxisAngle(_gaxis, rate * dt * amount));
    return;
  }

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
  // The far plane follows the horizon (in the model's scale on the globe); the near one
  // stays close (log depth, above).
  const near = 0.05;
  const horizon = Math.sqrt(2 * 6_371_000 * agl) + agl;
  const worldScale = state.mode === 'globe' ? state.scale : 1;
  const far = 2 ** Math.ceil(Math.log2(Math.max(state.mode === 'globe' ? 1000 : 30_000, 2 * horizon * worldScale)));
  if (near !== lastNear || far !== lastFar) {
    camera.near = lastNear = near;
    camera.far = lastFar = far;
    camera.updateProjectionMatrix();
  }

  // Blue sky below 10 km, black space above 200 km, stars once the sky is dark.
  // (the globe floats in space)
  const t = state.mode === 'globe' ? 1 : THREE.MathUtils.clamp((Math.log10(agl) - 4) / 1.3, 0, 1);
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

  if (tiles && state.mode === 'globe') {
    updateGrab(dt);
    move(dt);
    updateGlobeFlight(dt);
    updateGlobe();
    probeGround();
    updateView(globeHeight());
    updateTiles(globeHeight(), state.center.lat, state.center.lon);
  } else if (tiles) {
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
    _inv.copy(tiles.group.matrixWorld).invert();
    _p.copy(rig.position).applyMatrix4(_inv);
    tiles.ellipsoid.getPositionToCartographic(_p, _carto);
    updateTiles(agl, _carto.lat, _carto.lon);
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

function updateTiles(agl, lat, lon) {
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
    buildings.update(tiles.group, lat, lon, agl);
}

function updateReadout() {
  if (!tiles) return;
  const p = PLACES[state.place];
  const agl = state.mode === 'globe' ? globeHeight() : rig.position.y - state.groundY;
  const s = tiles.stats || {};
  // Once you've grabbed or flown more than 200 km away, say where you are instead.
  const c = state.center;
  const away = 6_371_000 * Math.acos(Math.min(1,
    Math.sin(c.lat) * Math.sin(p.lat * D2R) + Math.cos(c.lat) * Math.cos(p.lat * D2R) * Math.cos(c.lon - p.lon * D2R)));
  const coords = `${Math.abs(c.lat / D2R).toFixed(1)}°${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lon / D2R).toFixed(1)}°${c.lon >= 0 ? 'E' : 'W'}`;
  const where = away > 200_000 ? `Over ${coords}` : agl > 50_000 ? `Above ${p.name}` : `${p.name}, ${p.spot}`;
  const view = state.mode === 'globe' ? `Globe · view from ${formatHeight(agl)}` : `${formatHeight(agl)} up`;
  const kTris = Math.round(buildings.triangles / 1000);
  const measures = `${view} · ${state.fps} fps · ${s.visible ?? '?'} ground tiles, ${(s.downloading ?? 0) + (s.parsing ?? 0) + buildings.loading} loading · buildings ${kTris}k tris`;
  statsEl.textContent = `${where}\n${measures}`;


  vrUi.setStatus([
    where,
    `${view} · ${state.fps} fps`,
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
  b.addEventListener('click', () => goToPlace(i));
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
