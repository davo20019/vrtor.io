// The centre screen, drawn on a canvas, and a touchscreen like the truck's: tap it with the mouse,
// a finger on a phone, or a controller's ray in the headset.
// Left, the truck's own view: gear, speed, the limit, whether it's driving itself, and the road
// ahead in perspective, from the real road's line and heights, with the path it plans in blue
// (parked, just the truck). Right, the navigation map on the ride: heading-up, following the truck,
// drawn from OpenStreetMap (the real coastline, roads, creeks and named places), the route ahead in
// blue, a guidance card naming the next place on the way, and the arrival time, minutes and miles left.
// Along the bottom, the dock: the car's controls, the cabin temperature, the climate, the radio
// (radio.js) and the volume. Each opens its panel over the map.
// Our own drawing in the spirit of the maker's screen, not a copy of it.
import { Color3, DynamicTexture, ImageProcessingConfiguration, StandardMaterial, Texture } from '@babylonjs/core';
import { drawLoader } from './loader.js';
import { createRadio } from './radio.js';

const W = 1024, H = 576;
const DOCK = 64;                                   // the dock along the bottom
const MH = H - DOCK;                               // above it, the view and the map
const VW = 372;                                    // the truck's view; the map takes the rest
const MX = VW, MW = W - VW;
const BLUE = '#3d6fe0';
const INK = '#17191c';
const MUTED = '#6a6f75';
const MI = 1609.344;
const LIMIT_MPH = 55;                              // California's limit on two-lane highways: OSM has no sign here
const DESTINATION = 'Little Sur River';
const FAN_MAX = 10;
const RW = 640, RH = 360;                          // the back seat's screen, 16:9 like its glass
/** Canvas pixels per drawing unit: a seat's eye on a sharp display sees more than 1024 across the screen.
 *  The headset sees about that, and uploads every frame drawn, so it gets less. */
const SCALE = /OculusBrowser|Quest/.test(navigator.userAgent) ? 1.5 : 2;
/** How far outside a button (drawing units) a press still counts: the screen is seen at an angle, and fingers are wide. */
const SLOP = 10;
/** An open panel closes itself after this long without a tap. */
const PANEL_SECONDS = 15;
/** Parked in the showroom: the truck at the origin, standing still. */
const PARKED = { parked: true, s: 0, v: 0, running: false, done: false, paused: false };
const ORIGIN = { x: 0, y: 0, z: 0, heading: 0 };

/**
 * controls(): the Controls panel's tiles, from the scene: [{ label, value, onClick, disabled }].
 * action(): the screen's one big button over the map ({ label, onClick, disabled }), or null.
 * loading(): while the ride loads, { progress (0 to 1), detail }, drawn over the map (loader.js); else null.
 * onChange(): something on the screen changed that the scene may care about (the fan, say).
 * The back seat's small screen (int_rear_screen) shows the radio and the climate, and takes taps too.
 */
export function createScreen(scene, screenMesh, { controls = () => [], action = () => null, loading = () => null, onChange = () => {} } = {}) {
  const front = surface(scene, screenMesh, 'cyb-screen', W, H);
  const rear = surface(scene, scene.getMeshByName('int_rear_screen'), 'cyb-rear-screen', RW, RH);
  const surfaces = [front, rear].filter((s) => s.mesh);
  // A copy of the frame, drawn back through a filter for the dark display.
  const scratch = document.createElement('canvas');
  const canDark = typeof front.ctx.filter === 'string';

  let ride = null;                                  // { state, at, plan, road } while on the road
  let dirty = true, since = 0, lastTap = 0;
  const changed = () => {
    dirty = true;
    onChange();
  };
  const radio = createRadio(changed);
  /** panel: the one open over the map (controls, climate, radio) or null. */
  const ui = { panel: null, temp: 70, climateOn: true, fan: 4, rearTemp: 70, hover: null, dark: canDark && localStorage.getItem('cyb-screen-dark') === '1' };
  const toggle = (panel) => () => (ui.panel = ui.panel === panel ? null : panel);
  const display = () => ({
    label: 'Display',
    value: ui.dark ? 'Dark' : 'Light',
    active: ui.dark,
    disabled: !canDark,
    onClick: () => {
      ui.dark = !ui.dark;
      localStorage.setItem('cyb-screen-dark', ui.dark ? '1' : '0');
    },
  });

  function drawFront() {
    const { ctx } = front;
    const wait = ride ? null : loading();
    const hit = front.hit;
    front.hits = [];
    ctx.save();
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = '#e8e9eb';
    ctx.fillRect(0, 0, W, H);
    if (ride) {
      const { state, at, plan, road } = ride;
      const here = at(state.s);
      drawView(ctx, state, at, here);
      drawMap(ctx, state, plan, road, here, road.map);
    } else {
      drawView(ctx, PARKED, null, ORIGIN);
      if (wait) drawWait(ctx, wait);
      else drawParkedMap(ctx);
    }
    drawClock(ctx, ride ? 'America/Los_Angeles' : undefined);
    const big = action();
    if (big && !ui.panel && !wait) drawAction(ctx, big, hit, ui);
    if (ui.panel === 'radio') drawRadioPanel(ctx, radio, hit, ui);
    if (ui.panel === 'climate') drawClimatePanel(ctx, ui, hit);
    if (ui.panel === 'controls') drawControlsPanel(ctx, [...controls(), display()], hit, ui);
    if (ui.panel) hit(W - 70, 22, 44, 44, 'close', () => (ui.panel = null));
    drawDock(ctx, ui, radio, hit, toggle);
    ctx.restore();
    if (ui.dark) darken(ctx);
    front.tex.update();
  }

  function drawRear() {
    if (!rear.mesh) return;
    rear.hits = [];
    rear.ctx.save();
    rear.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawRearScreen(rear.ctx, ui, radio, rear.hit);
    rear.ctx.restore();
    rear.tex.update();
  }

  /** The dark display: the light one with its lightness turned over and its hues kept (the map's sea stays blue). */
  function darken(ctx) {
    scratch.width = ctx.canvas.width;
    scratch.height = ctx.canvas.height;
    scratch.getContext('2d').drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.filter = 'invert(1) hue-rotate(180deg) brightness(0.92)';
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }

  function hitAt(pick) {
    if (!pick?.hit) return null;
    const s = surfaces.find((x) => x.mesh === pick.pickedMesh);
    const uv = s && pick.getTextureCoordinates();
    if (!uv) return null;
    // vScale -1 samples the texture at 1 - v, and the canvas's top row is at texture v = 1: so the
    // mesh's v is straight down the canvas (measured on a pick: the big button, low on the screen, at v 0.67).
    const px = uv.x * s.w, py = uv.y * s.h;
    // Last drawn is on top; a press just outside every button goes to the nearest within SLOP.
    for (let i = s.hits.length - 1; i >= 0; i--) {
      const [x, y, w, h] = s.hits[i];
      if (px >= x && px <= x + w && py >= y && py <= y + h) return s.hits[i];
    }
    let near = null, best = SLOP;
    for (let i = s.hits.length - 1; i >= 0; i--) {
      const [x, y, w, h] = s.hits[i];
      const d = Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h));
      if (d < best) [near, best] = [s.hits[i], d];
    }
    return near;
  }

  function run(h) {
    lastTap = performance.now();
    h[5]();
    changed();
  }

  /** The button under a mouse or finger that went down, until it comes up. */
  let held = null;

  return {
    mesh: screenMesh,
    /** Both screens' meshes: what the pointer may press. */
    meshes: surfaces.map((s) => s.mesh),
    radio,
    /** The climate's fan speed, 0 (off) to 10. */
    get fan() {
      return ui.climateOn ? ui.fan : 0;
    },
    show(on) {
      for (const s of surfaces) s.mesh.material = on ? s.mat : s.original;
    },
    /** On the road: the ride's state; at(s): the lane point s metres along; plan; road. Null when parked. */
    setRide(r) {
      ride = r;
      if (r?.road.map && !r.road.map.boxed) {
        // Each road's bounds, so only the ones near the truck are drawn.
        for (const x of r.road.map.roads ?? []) x.box = bounds(x.pts);
        for (const x of r.road.map.water ?? []) x.box = bounds(x.pts);
        r.road.map.boxed = true;
      }
      dirty = true;
    },
    /** Something the screen shows from the scene changed (the loading's progress): drawn next frame. */
    refresh() {
      dirty = true;
    },
    /** Each frame: redrawn ten times a second on the road, 20 while it loads, once a second parked (the clock), and on a tap. */
    tick(dt) {
      since += dt;
      if (!dirty && since < (ride ? 0.1 : loading() ? 0.05 : 1)) return;
      // A panel left open closes by itself, so it doesn't hide the map for the whole ride.
      if (ui.panel && performance.now() - lastTap > PANEL_SECONDS * 1000) ui.panel = null;
      const full = dirty || since >= 1;
      since = 0;
      dirty = false;
      drawFront();
      if (full) drawRear();
    },
    /** A press on either screen, all at once (a controller's trigger): true if it landed on something. */
    tap(pick) {
      const h = hitAt(pick);
      if (!h) return false;
      run(h);
      return true;
    },
    /** A mouse or finger down on either screen: true if it's on a button (it lights up until it comes up). */
    down(pick) {
      held = hitAt(pick)?.[4] ?? null;
      if (held) {
        ui.hover = held;
        dirty = true;
      }
      return !!held;
    },
    /** ...and up: the button goes off if it's still the one under it, however long it was held or the hand wobbled. */
    up(pick) {
      const h = hitAt(pick);
      if (held && h?.[4] === held) run(h);
      held = null;
      ui.hover = null;
      dirty = true;
    },
    /** The pointer over either screen: true if it's over something tappable (it lights up). */
    hover(pick) {
      const id = hitAt(pick)?.[4] ?? null;
      if (id !== ui.hover) {
        ui.hover = id;
        dirty = true;
      }
      return !!id;
    },
    dispose() {
      radio.stop();
    },
  };
}

const AS_DRAWN = new ImageProcessingConfiguration();
AS_DRAWN.toneMappingEnabled = false;

/** A screen in the model: its canvas, drawn as light (unlit), and what's tappable on it. */
function surface(scene, mesh, name, w, h) {
  const tex = new DynamicTexture(name, { width: w * SCALE, height: h * SCALE }, scene, true);
  // Sharp when seen from the side, as from the driver's seat.
  tex.anisotropicFilteringLevel = 16;
  // The model's screen UVs run bottom-up from a canvas: flip it.
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.vScale = -1;
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  // A screen gives out its own light: shown as drawn, not tone-mapped like the lit cabin (which greys its white).
  mat.imageProcessingConfiguration = AS_DRAWN;
  /** hits: [x, y, w, h, id, onTap], from the last frame drawn. */
  const s = { mesh, tex, mat, original: mesh?.material, ctx: tex.getContext(), w, h, hits: [] };
  s.hit = (x, y, hw, hh, id, onTap) => s.hits.push([x, y, hw, hh, id, onTap]);
  return s;
}

// ---------------------------------------------------------------- the back seat's screen

/** The rear screen: what's playing with play/stop and next, and the back's own temperature. */
function drawRearScreen(ctx, ui, radio, hit) {
  ctx.save();
  ctx.fillStyle = '#121417';
  ctx.fillRect(0, 0, RW, RH);
  const button = (x, y, w, h, id, onTap, paint) => {
    ctx.fillStyle = ui.hover === id ? '#2c3036' : '#1d2024';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    paint(x + w / 2, y + h / 2);
    hit(x, y, w, h, id, onTap);
  };
  const st = radio.stations[radio.state.station];
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b9096';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('NOW PLAYING', 32, 46);
  ctx.fillStyle = '#fff';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(radio.on ? st.name : 'Radio off', 32, 96, RW - 64);
  ctx.fillStyle = radio.state.status === 'error' ? '#ff6b5e' : '#b7bcc2';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(statusText(radio.state.status, st), 32, 130, RW - 64);
  const white = '#f4f5f6';
  button(32, 160, 96, 72, 'rear-play', () => radio.toggle(), (x, y) => playIcon(ctx, x, y, radio.on, white));
  button(140, 160, 96, 72, 'rear-next', () => radio.next(), (x, y) => nextIcon(ctx, x, y, white));
  button(RW - 248, 160, 96, 72, 'rear-vol-down', () => radio.volume(-1), (x, y) => chevron(ctx, x, y, -1, white));
  button(RW - 128, 160, 96, 72, 'rear-vol-up', () => radio.volume(1), (x, y) => chevron(ctx, x, y, 1, white));
  ctx.fillStyle = '#8b9096';
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`VOLUME ${radio.state.muted ? 0 : radio.state.volume}`, RW - 140, 254);

  // The back's climate: its own temperature.
  ctx.fillStyle = '#2a2d31';
  ctx.fillRect(0, RH - 92, RW, 1);
  const y = RH - 80, step = (d) => () => (ui.rearTemp = Math.max(60, Math.min(85, ui.rearTemp + d)));
  button(32, y, 72, 64, 'rear-temp-down', step(-1), (x, c) => chevron(ctx, x, c, -1, white));
  ctx.fillStyle = ui.climateOn ? '#fff' : '#6a6f75';
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(ui.climateOn ? `${ui.rearTemp}°` : 'Off', 164, y + 45);
  button(224, y, 72, 64, 'rear-temp-up', step(1), (x, c) => chevron(ctx, x, c, 1, white));
  fanIcon(ctx, RW - 120, y + 32, white, ui.climateOn && ui.fan > 0);
  ctx.fillStyle = '#b7bcc2';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(ui.climateOn && ui.fan ? String(ui.fan) : 'Off', RW - 70, y + 40);
  ctx.restore();
}

// ---------------------------------------------------------------- the dock and its panels

const FONT = 'system-ui, sans-serif';

function drawDock(ctx, ui, radio, hit, toggle) {
  const y = MH;
  ctx.fillStyle = '#f7f7f8';
  ctx.fillRect(0, y, W, DOCK);
  ctx.fillStyle = '#d5d7da';
  ctx.fillRect(0, y, W, 1);
  const cy = y + DOCK / 2;
  const button = (x, w, id, onTap, paint) => {
    const on = ui.hover === id;
    if (on) {
      ctx.fillStyle = '#e3e5e8';
      roundRect(ctx, x, y + 6, w, DOCK - 12, 10);
      ctx.fill();
    }
    paint(x + w / 2, cy);
    hit(x, y, w, DOCK, id, onTap);
  };

  // The car: its controls.
  button(24, 70, 'dock-car', toggle('controls'), (x, c) => carIcon(ctx, x, c, ui.panel === 'controls' ? BLUE : INK));
  // The cabin temperature, with arrows either side; tap the number for the climate.
  const tempStep = (d) => () => {
    ui.temp = Math.max(60, Math.min(85, ui.temp + d));
    ui.climateOn = true;
  };
  button(104, 40, 'temp-down', tempStep(-1), (x, c) => chevron(ctx, x, c, -1, INK));
  button(146, 76, 'temp', toggle('climate'), (x, c) => {
    ctx.fillStyle = ui.climateOn ? INK : '#9aa0a6';
    ctx.font = `600 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(ui.climateOn ? `${ui.temp}°` : 'Off', x, c + 9);
  });
  button(224, 40, 'temp-up', tempStep(1), (x, c) => chevron(ctx, x, c, 1, INK));
  button(276, 64, 'dock-fan', toggle('climate'), (x, c) => fanIcon(ctx, x, c, ui.panel === 'climate' ? BLUE : INK, ui.climateOn && ui.fan > 0));

  // The radio: its icon, and what's playing with play/stop and next.
  button(372, 64, 'dock-radio', toggle('radio'), (x, c) => noteIcon(ctx, x, c, ui.panel === 'radio' ? BLUE : INK));
  const st = radio.stations[radio.state.station];
  button(440, 290, 'dock-now', toggle('radio'), (x) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText(radio.on ? st.name : 'Radio', x - 135, cy - 3, 270);
    ctx.fillStyle = radio.state.status === 'error' ? '#c0392b' : MUTED;
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(statusText(radio.state.status, st), x - 135, cy + 15, 270);
  });
  button(734, 52, 'dock-play', () => radio.toggle(), (x, c) => playIcon(ctx, x, c, radio.on, INK));
  button(788, 52, 'dock-next', () => radio.next(), (x, c) => nextIcon(ctx, x, c, INK));

  // The volume.
  button(866, 40, 'vol-down', () => radio.volume(-1), (x, c) => chevron(ctx, x, c, -1, INK));
  button(908, 64, 'mute', () => radio.mute(), (x, c) => speakerIcon(ctx, x, c, radio.state.muted ? 0 : radio.state.volume, INK));
  button(974, 40, 'vol-up', () => radio.volume(1), (x, c) => chevron(ctx, x, c, 1, INK));
}

function statusText(status, st) {
  if (status === 'connecting') return 'Tuning in…';
  if (status === 'error') return 'Can’t reach this station';
  if (status === 'playing') return st.sub;
  return 'Tap to listen';
}

/** A panel over the map with a title and a close button; returns its inner box. */
function panel(ctx, title, ui) {
  const x = MX + 14, y = 14, w = MW - 28, h = MH - 28;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, x + 2, y + 4, w, h, 14);
  ctx.fill();
  ctx.fillStyle = '#fbfbfc';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(title, x + 24, y + 42);
  // Close, top right (its hit is added after the panel's own).
  ctx.strokeStyle = ui.hover === 'close' ? BLUE : MUTED;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const cx = W - 48, cy = 44;
  ctx.moveTo(cx - 9, cy - 9);
  ctx.lineTo(cx + 9, cy + 9);
  ctx.moveTo(cx + 9, cy - 9);
  ctx.lineTo(cx - 9, cy + 9);
  ctx.stroke();
  return { x: x + 24, y: y + 64, w: w - 48, h: h - 80 };
}

function tile(ctx, x, y, w, h, { label, value, active, disabled }, hovered) {
  ctx.fillStyle = active ? '#e6edfc' : hovered && !disabled ? '#eceef1' : '#f2f3f5';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  if (active) {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = disabled ? '#a7abb0' : INK;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(label, x + 16, y + (value ? 32 : h / 2 + 6), w - 32);
  if (value) {
    ctx.fillStyle = disabled ? '#a7abb0' : active ? BLUE : MUTED;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(value, x + 16, y + 56, w - 32);
  }
}

function drawRadioPanel(ctx, radio, hit, ui) {
  const box = panel(ctx, 'Radio', ui);
  const cols = 2, gap = 12;
  const tw = (box.w - gap) / cols, th = 76;
  radio.stations.forEach((st, i) => {
    const x = box.x + (i % cols) * (tw + gap), y = box.y + Math.floor(i / cols) * (th + gap);
    const playing = radio.on && radio.state.station === i;
    const id = `station-${i}`;
    tile(ctx, x, y, tw, th, { label: st.name, value: playing ? statusText(radio.state.status, st) : st.sub, active: playing }, ui.hover === id);
    hit(x, y, tw, th, id, () => (playing ? radio.stop() : radio.play(i)));
  });
  ctx.fillStyle = MUTED;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Live from each station’s own stream. Volume on the dock’s right.', box.x, box.y + box.h, box.w);
}

function drawClimatePanel(ctx, ui, hit) {
  const box = panel(ctx, 'Climate', ui);
  const tw = (box.w - 24) / 3, th = 84;
  const row = (y, label, value, down, up, idBase) => {
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(label, box.x, y + 34);
    const cx = box.x + box.w - 150;
    for (const [dx, d, fn] of [[-60, -1, down], [60, 1, up]]) {
      const id = `${idBase}-${d}`;
      ctx.fillStyle = ui.hover === id ? '#e3e5e8' : '#f2f3f5';
      roundRect(ctx, cx + dx - 26, y + 4, 52, 48, 10);
      ctx.fill();
      chevron(ctx, cx + dx, y + 28, d, INK);
      hit(cx + dx - 26, y + 4, 52, 48, id, fn);
    }
    ctx.fillStyle = ui.climateOn ? INK : '#9aa0a6';
    ctx.textAlign = 'center';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(value, cx, y + 38);
  };
  const on = () => (ui.climateOn = true);
  row(box.y, 'Temperature', `${ui.temp}°F`, () => (on(), (ui.temp = Math.max(60, ui.temp - 1))), () => (on(), (ui.temp = Math.min(85, ui.temp + 1))), 'ctemp');
  row(box.y + 68, 'Fan', ui.fan ? String(ui.fan) : 'Off', () => (on(), (ui.fan = Math.max(0, ui.fan - 1))), () => (on(), (ui.fan = Math.min(FAN_MAX, ui.fan + 1))), 'cfan');
  const y = box.y + 150;
  const tiles = [
    { id: 'climate-power', label: 'Climate', value: ui.climateOn ? 'On' : 'Off', active: ui.climateOn, onTap: () => (ui.climateOn = !ui.climateOn) },
    { id: 'climate-max', label: 'Max', value: 'Fan 10, 60°', onTap: () => Object.assign(ui, { climateOn: true, fan: FAN_MAX, temp: 60 }) },
    { id: 'climate-auto', label: 'Auto', value: 'Fan 4, 70°', onTap: () => Object.assign(ui, { climateOn: true, fan: 4, temp: 70 }) },
  ];
  tiles.forEach((t, i) => {
    const x = box.x + i * (tw + 12);
    tile(ctx, x, y, tw, th, t, ui.hover === t.id);
    hit(x, y, tw, th, t.id, t.onTap);
  });
  ctx.fillStyle = MUTED;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('On the ride you hear the fan behind the dash vents change with its speed.', box.x, box.y + box.h, box.w);
}

function drawControlsPanel(ctx, items, hit, ui) {
  const box = panel(ctx, 'Controls', ui);
  const cols = 3, gap = 12;
  const tw = (box.w - gap * (cols - 1)) / cols, th = 84;
  items.forEach((item, i) => {
    const x = box.x + (i % cols) * (tw + gap), y = box.y + Math.floor(i / cols) * (th + gap);
    const id = `control-${i}`;
    tile(ctx, x, y, tw, th, item, ui.hover === id);
    if (!item.disabled) hit(x, y, tw, th, id, item.onClick);
  });
}

/** The big blue button over the map: Start self-driving, Drive on. */
function drawAction(ctx, { label, onClick, disabled }, hit, ui) {
  const w = 340, h = 66, x = MX + (MW - w) / 2, y = MH - 152;
  const on = ui.hover === 'action' && !disabled;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, x + 2, y + 4, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = disabled ? '#9aa0a6' : on ? '#2b57c4' : BLUE;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  wheelIcon(ctx, x + 44, y + h / 2 - 1, '#fff');
  ctx.fillStyle = '#fff';
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 78, y + h / 2 + 9, w - 96);
  ctx.restore();
  if (!disabled) hit(x, y, w, h, 'action', onClick);
}

/** While the ride loads, over the map: the truck on its way down the coast, and how far the download has got. */
function drawWait(ctx, { progress, detail }) {
  ctx.save();
  ctx.fillStyle = '#f1eee8';
  ctx.fillRect(MX, 0, MW, MH);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('Getting Highway 1 ready', MX + 36, 120);
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText(`${Math.round(progress * 100)}%${detail ? ` · ${detail}` : ''}`, MX + 36, 154);
  drawLoader(ctx, MX, 180, MW, 240, { progress, t: performance.now() / 1000, theme: 'light' });
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText('Bixby Creek Bridge', MX + 24, 452);
  ctx.textAlign = 'right';
  ctx.fillText(DESTINATION, W - 24, 452);
  ctx.restore();
}

/** Parked, the map has nowhere to go: a quiet grid and where you are. */
function drawParkedMap(ctx) {
  ctx.save();
  ctx.fillStyle = '#f1eee8';
  ctx.fillRect(MX, 0, MW, MH);
  ctx.strokeStyle = '#e4e0d8';
  ctx.lineWidth = 1;
  for (let x = MX + 20; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MH);
    ctx.stroke();
  }
  for (let y = 20; y < MH; y += 48) {
    ctx.beginPath();
    ctx.moveTo(MX, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const cx = MX + MW / 2, cy = MH * 0.5;
  ctx.fillStyle = 'rgba(61,111,224,0.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BLUE;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, MX + 14, MH - 62, MW - 28, 48, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText('Showroom', MX + 30, MH - 31);
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText('Navigation starts with the self-driving ride', MX + 140, MH - 31);
  ctx.restore();
}

/** The time, top right: Pacific on the ride, your own in the showroom. */
function drawClock(ctx, timeZone) {
  const text = new Date().toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  ctx.font = `600 16px ${FONT}`;
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  roundRect(ctx, W - 14 - w, 14, w, 30, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(text, W - 14 - w / 2, 35);
}

// ---------------------------------------------------------------- icons

/** The truck's side: the long roof line from the nose to the tail, over its two wheels. */
function carIcon(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-24, 2);
  ctx.lineTo(-23, -4);
  ctx.lineTo(-2, -12);
  ctx.lineTo(24, -6);
  ctx.lineTo(24, 4);
  ctx.lineTo(-24, 4);
  ctx.closePath();
  ctx.fill();
  for (const wx of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(wx, 6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function chevron(ctx, x, y, dir, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dir * 4, y - 9);
  ctx.lineTo(x + dir * 5, y);
  ctx.lineTo(x - dir * 4, y + 9);
  ctx.stroke();
}

function fanIcon(ctx, x, y, color, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = on ? color : '#9aa0a6';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -8, 5, 9, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function noteIcon(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, 9);
  ctx.lineTo(-6, -10);
  ctx.lineTo(10, -14);
  ctx.lineTo(10, 5);
  ctx.stroke();
  for (const [cx, cy] of [[-10, 9], [6, 5]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function playIcon(ctx, x, y, playing, color) {
  ctx.fillStyle = color;
  if (playing) {
    // Live radio stops rather than pauses: a square.
    ctx.fillRect(x - 8, y - 8, 16, 16);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 11);
  ctx.lineTo(x + 11, y);
  ctx.lineTo(x - 7, y + 11);
  ctx.closePath();
  ctx.fill();
}

function nextIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (const dx of [-10, 0]) {
    ctx.beginPath();
    ctx.moveTo(x + dx - 2, y - 9);
    ctx.lineTo(x + dx + 8, y);
    ctx.lineTo(x + dx - 2, y + 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x + 7, y - 9, 3, 18);
}

/** A speaker with as many waves as the volume (none when muted: a cross). */
function speakerIcon(ctx, x, y, volume, color) {
  ctx.save();
  ctx.translate(x - 6, y);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(-12, -5);
  ctx.lineTo(-6, -5);
  ctx.lineTo(2, -12);
  ctx.lineTo(2, 12);
  ctx.lineTo(-6, 5);
  ctx.lineTo(-12, 5);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (!volume) {
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(18, 6);
    ctx.moveTo(18, -6);
    ctx.lineTo(8, 6);
    ctx.stroke();
  } else {
    const waves = Math.ceil(volume / 4);
    for (let i = 0; i < waves; i++) {
      ctx.beginPath();
      ctx.arc(2, 0, 7 + i * 6, -0.8, 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = MUTED;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(volume), x + 22, y + 20);
}

// ---------------------------------------------------------------- the truck's view

function drawView(ctx, state, at, here) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VW, MH);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, MH);
  g.addColorStop(0, '#dfe1e4');
  g.addColorStop(1, '#cfd2d6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, MH);

  // A camera 13 m behind the truck and 9 m up (parked, 7 m and 4.2 m), looking ahead and down: the next 100 m of curves show.
  const h = here.heading;
  const fx = Math.sin(h), fz = Math.cos(h);                // ahead
  const rx = Math.cos(h), rz = -Math.sin(h);               // right
  // Parked, closer in: there's no road to show, just the truck.
  const back = state.parked ? 7 : 13, high = state.parked ? 4.2 : 9;
  const cx = here.x - fx * back, cy = here.y + high, cz = here.z - fz * back;
  const pitch = 0.46, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const F = 380, OX = VW / 2, OY = 330;
  const project = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const ahead = dx * fx + dz * fz, side = dx * rx + dz * rz;
    const depth = ahead * cp - dy * sp;
    if (depth < 0.5) return null;
    const up = ahead * sp + dy * cp;
    return [OX + (F * side) / depth, OY - (F * up) / depth];
  };
  // A point `off` metres right of the lane's centre, s metres along.
  const lanePoint = (s, off, lift = 0) => {
    const q = at(s);
    const qx = Math.cos(q.heading), qz = -Math.sin(q.heading);
    return project(q.x + qx * off, q.y + lift, q.z + qz * off);
  };
  const strip = (from, to, a, b, fill) => {
    const left = [], right = [];
    for (let s = from; s <= to; s += 2) {
      const p = lanePoint(s, a), q = lanePoint(s, b);
      if (p && q) {
        left.push(p);
        right.push(q);
      }
    }
    if (left.length < 2) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  const line = (from, to, off, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let on = false;
    for (let s = from; s <= to; s += 2) {
      const p = lanePoint(s, off);
      if (!p) continue;
      if (on) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      on = true;
    }
    ctx.stroke();
  };
  const s0 = state.s - 8, s1 = state.s + 160;
  // Parked (in the showroom) there's no road: the truck alone on the floor.
  if (!state.parked) {
    // The lane is centred 1.8 m right of the road's centre line; the pavement runs 4.6 m either side.
    strip(s0, s1, -6.4, 2.8, '#c4c8cd');
    line(s0, s1, -1.9, '#d8ad2a', 2.2);
    line(s0, s1, -1.7, '#d8ad2a', 2.2);
    line(s0, s1, 1.85, '#fbfbfb', 3);
    line(s0, s1, -5.45, '#fbfbfb', 3);
    if (state.running) {
      ctx.globalAlpha = 0.9;
      strip(state.s + 2.5, Math.min(state.s + 90, state.end), -0.55, 0.55, BLUE);
      ctx.globalAlpha = 1;
    }
  }
  drawTruck(ctx, here, project, [0, high, ORIGIN_S + back]);
  // Fade the far road into the sky.
  const fade = ctx.createLinearGradient(0, 150, 0, 185);
  fade.addColorStop(0, 'rgba(223,225,228,1)');
  fade.addColorStop(1, 'rgba(223,225,228,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, VW, 185);
  ctx.restore();

  // Top: gear and battery.
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  'PRND'.split('').forEach((c, i) => {
    ctx.fillStyle = c === (state.parked ? 'P' : 'D') ? INK : '#9aa0a6';
    ctx.fillText(c, 24 + i * 22, 36);
  });
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText('78%', VW - 22, 36);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(VW - 100, 21, 30, 15);
  ctx.fillRect(VW - 98, 23, 20, 11);
  ctx.fillRect(VW - 70, 25, 3, 7);

  // Speed, the limit, and whether it's driving itself.
  ctx.textAlign = 'center';
  ctx.font = '700 78px system-ui, sans-serif';
  ctx.fillText(String(Math.round(state.v * 2.23694)), VW / 2, 122);
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.fillText('MPH', VW / 2, 146);
  if (!state.parked) sign(ctx, 46, 82);
  wheelIcon(ctx, VW - 54, 100, state.running ? BLUE : '#9aa0a6');
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = state.running ? BLUE : MUTED;
  ctx.fillText(state.running ? 'Self-driving' : state.done || state.parked ? 'Parked' : state.paused ? (state.v > 0.05 ? 'Stopping' : 'Stopped') : 'Ready', VW - 54, 140);
}

// The truck as the model measures it (assets-src/cybertruck/spec.md, params.json), in metres: w across
// from the centre line (right +), h up from the ground, s back from the front light bar.
const ORIGIN_S = 2.696;                            // the midpoint between the axles: where the truck's position is
const AXLE_S = [0.878, 4.513];
const TAIL_S = 5.57;                               // the tailgate; the bumper stands out past it to 5.683
const RIGHT = {
  nose: [0.852, 0.95, 0], noseCorner: [0.962, 0.87, 0.16], low: [0.962, 0.55, 0.16],
  cowl: [0.8, 1.374, 0.954], fender: [0.962, 1.24, 0.954], beltA: [0.962, 1.209, 1.514],
  apex: [0.608, 1.794, 2.426], beltC: [0.962, 1.29, 3.64],
  tailTop: [0.909, 1.32, TAIL_S], tailCorner: [0.962, 1.25, TAIL_S], tailLow: [0.962, 0.68, TAIL_S], lowRear: [0.962, 0.55, TAIL_S],
};
const LEFT = Object.fromEntries(Object.entries(RIGHT).map(([k, [w, h, s]]) => [k, [-w, h, s]]));
const STEEL = [222, 225, 228], GLASS = [40, 45, 52], BLACK = [42, 45, 50], TYRE = [26, 27, 30];
const SUN = norm([-0.35, 1, 0.45]);                // from above, a little left and behind

function norm([x, y, z]) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/**
 * The truck from behind and above, faceted like the real one: the flat tailgate with its red light bar,
 * the rear deck (the roof glass, then the black tonneau) rising to the roof's apex, the sails and side
 * glass leaning in, the windshield and hood beyond, the black bumper, arch flares and tyres standing
 * out past the steel. Each solid is convex, so a face is drawn only if it faces the eye.
 */
function drawTruck(ctx, here, project, eye) {
  const h = here.heading;
  const fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const P = ([w, y, s]) => {
    const ahead = ORIGIN_S - s;
    return project(here.x + rx * w + fx * ahead, here.y + y, here.z + rz * w + fz * ahead);
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // The outward normal of a face of a convex solid with the given centre, or null if it faces away from the eye.
  const facing = (pts, centre) => {
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (dot(n, sub(pts[0], centre)) < 0) n = n.map((v) => -v);
    return dot(n, sub(eye, pts[0])) > 0 ? n : null;
  };
  const fill = (pts, rgb, stroke) => {
    const q = pts.map(P);
    if (q.some((p) => !p)) return;
    ctx.beginPath();
    q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = typeof rgb === 'string' ? rgb : `rgb(${rgb.map((v) => Math.round(Math.min(255, v))).join(',')})`;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };
  const lit = (rgb, n, spread) => rgb.map((v) => v * (1 - spread + spread * Math.max(0, dot(n, SUN))));
  const face = (pts, centre, rgb, spread = 0.35, stroke = 'rgba(70,76,82,0.55)') => {
    const n = facing(pts, centre);
    if (n) fill(pts, lit(rgb, n, spread), stroke);
    return !!n;
  };
  const box = ([w0, w1], [h0, h1], [s0, s1], rgb, spread) => {
    const c = [(w0 + w1) / 2, (h0 + h1) / 2, (s0 + s1) / 2];
    const v = (i, j, k) => [[w0, w1][i], [h0, h1][j], [s0, s1][k]];
    for (const f of [
      [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)],
      [v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)],
      [v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)],
    ]) face(f, c, rgb, spread, null);
  };

  // Its shadow on the road.
  ctx.save();
  ctx.filter = 'blur(3px)';
  fill([[-1.12, 0, 0.1], [1.12, 0, 0.1], [1.12, 0, 5.9], [-1.12, 0, 5.9]], 'rgba(0,0,0,0.16)');
  ctx.restore();

  // The far wheels first: tyres, then the flares over them.
  for (const a of AXLE_S) {
    for (const side of [-1, 1]) {
      const span = (lo, hi) => (side > 0 ? [lo, hi] : [-hi, -lo]);
      box(span(0.743, 1.029), [0.02, 0.86], [a - 0.42, a + 0.42], TYRE, 0.3);
      box(span(0.93, 1.016), [0.86, 1.0], [a - 0.4, a + 0.4], BLACK, 0.4);
    }
  }

  // The steel shell.
  const C = [0, 0.9, 2.84];
  const R = RIGHT, L = LEFT;
  face([L.tailTop, R.tailTop, R.tailCorner, R.tailLow, L.tailLow, L.tailCorner], C, STEEL);
  face([L.nose, R.nose, R.cowl, L.cowl], C, STEEL);
  for (const S of [L, R]) {
    face([S.nose, S.noseCorner, S.fender, S.cowl], C, STEEL);
    face([S.cowl, S.fender, S.beltA, S.apex], C, STEEL);
    face([S.apex, S.beltC, S.tailCorner, S.tailTop], C, STEEL);
    face([S.noseCorner, S.low, S.lowRear, S.tailLow, S.tailCorner, S.beltC, S.beltA, S.fender], C, STEEL);
  }
  const deck = face([L.apex, R.apex, R.tailTop, L.tailTop], C, STEEL);
  face([L.cowl, R.cowl, R.apex, L.apex], C, GLASS, 0.25);
  for (const S of [L, R]) {
    // The side glass, inset in its facet.
    const mid = [0, 1, 2].map((i) => (S.apex[i] + S.beltA[i] + S.beltC[i]) / 3);
    const inset = (p) => p.map((v, i) => mid[i] + (v - mid[i]) * 0.82);
    if (facing([S.apex, S.beltA, S.beltC], C)) fill([S.apex, S.beltA, S.beltC].map(inset), GLASS);
  }

  if (deck) {
    // On the deck: the rear roof glass, then the tonneau sunk between the sails, its slats across.
    const at = (s, inset) => {
      const t = (s - RIGHT.apex[2]) / (TAIL_S - RIGHT.apex[2]);
      const w = RIGHT.apex[0] + (RIGHT.tailTop[0] - RIGHT.apex[0]) * t - inset;
      const y = RIGHT.apex[1] + (RIGHT.tailTop[1] - RIGHT.apex[1]) * t;
      return [[-w, y, s], [w, y, s]];
    };
    const panel = (s0, s1, inset, rgb) => {
      const [a, b] = at(s0, inset), [c, d] = at(s1, inset);
      fill([a, b, d, c], rgb);
    };
    panel(2.5, 3.58, 0.07, GLASS);
    panel(3.66, TAIL_S - 0.06, 0.08, [30, 33, 37]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    for (let s = 3.9; s < TAIL_S - 0.1; s += 0.25) {
      const [a, b] = at(s, 0.1).map(P);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  // The light bar, full width under the tonneau, and the black bumper below the tailgate.
  fill([[-0.95, 1.205, TAIL_S + 0.002], [0.95, 1.205, TAIL_S + 0.002], [0.95, 1.24, TAIL_S + 0.002], [-0.95, 1.24, TAIL_S + 0.002]], [214, 46, 38]);
  box([-0.96, 0.96], [0.36, 0.68], [TAIL_S, 5.683], BLACK, 0.4);
  // Its small red lights at the bumper's corners.
  for (const side of [-1, 1]) {
    const x0 = side * 0.78, x1 = side * 0.92;
    fill([[x0, 0.6, 5.684], [x1, 0.6, 5.684], [x1, 0.64, 5.684], [x0, 0.64, 5.684]], [190, 40, 34]);
  }
}

function sign(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x - 26, y - 38, 52, 66, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.fillText('SPEED', x, y - 22);
  ctx.fillText('LIMIT', x, y - 11);
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText(String(LIMIT_MPH), x, y + 18);
  ctx.restore();
}

function wheelIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 1);
  ctx.lineTo(x + 16, y - 1);
  ctx.moveTo(x, y - 1);
  ctx.lineTo(x, y + 16);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the map

function drawMap(ctx, state, plan, road, here, map) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(MX, 0, MW, MH);
  ctx.clip();
  ctx.fillStyle = '#f1eee8';
  ctx.fillRect(MX, 0, MW, MH);

  // Heading-up, the truck a little below the middle, about 2.5 km across.
  const scale = 0.26;                                   // px per metre
  const ox = MX + MW / 2, oy = MH * 0.64;
  const c = Math.cos(-here.heading), s = Math.sin(-here.heading);
  const T = (x, z) => {
    const dx = (x - here.x) * scale, dy = -(z - here.z) * scale;
    return [ox + dx * c - dy * s, oy + dx * s + dy * c];
  };
  const reach = Math.hypot(MW, MH) / scale;              // metres from the truck to any corner
  const near = (b) => b[2] > here.x - reach && b[0] < here.x + reach && b[3] > here.z - reach && b[1] < here.z + reach;
  const path = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      const [u, v] = T(x, z);
      if (i) ctx.lineTo(u, v); else ctx.moveTo(u, v);
    });
  };

  if (map) {
    ctx.fillStyle = '#a9d2e4';
    for (const ring of map.sea) {
      path(ring);
      ctx.fill();
    }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const w of map.water) {
      if (!near(w.box)) continue;
      ctx.strokeStyle = '#8cc0da';
      ctx.lineWidth = w.river ? 3 : 1.6;
      path(w.pts);
      ctx.stroke();
    }
    // Small roads first; each drawn as a grey casing with a white middle.
    const roads = map.roads.filter((r) => r.rank <= 3 && near(r.box)).sort((a, b) => b.rank - a.rank);
    for (const pass of [0, 1]) {
      for (const r of roads) {
        const width = [9, 7, 5, 3][r.rank];
        ctx.strokeStyle = pass ? (r.rank === 0 ? '#ffffff' : '#fdfdfd') : '#c9c4bb';
        ctx.lineWidth = pass ? width : width + 2.5;
        path(r.pts);
        ctx.stroke();
      }
    }
  }

  // The route: behind in grey, ahead in blue to the destination.
  const i0 = Math.max(0, Math.floor(state.s / road.step));
  const iEnd = Math.floor(state.end / road.step);
  const routeLine = (from, to, color, width) => {
    if (to <= from) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const [u, v] = T(road.px[i], road.pz[i]);
      if (i === from) ctx.moveTo(u, v); else ctx.lineTo(u, v);
    }
    ctx.stroke();
  };
  routeLine(0, i0, '#9da3aa', 7);
  routeLine(i0, iEnd, '#2b57c4', 10);
  routeLine(i0, iEnd, BLUE, 7);
  const [ex, ey] = T(road.px[iEnd], road.pz[iEnd]);
  pin(ctx, ex, ey);

  if (map) {
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const taken = [];                                   // label boxes, so none overlap
    for (const p of map.places) {
      if (!['cape', 'peak', 'viewpoint', 'islet', 'locality', 'lighthouse'].includes(p.kind)) continue;
      const [u, v] = T(p.x, p.z);
      if (u < MX + 10 || u > W - 10 || v < 70 || v > MH - 50) continue;
      const box = [u - 4, v - 10, u + 10 + ctx.measureText(p.name).width, v + 8];
      if (taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      taken.push(box);
      ctx.fillStyle = p.kind === 'islet' ? '#4f7f99' : '#5b5f64';
      ctx.beginPath();
      ctx.arc(u, v, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3e43';
      ctx.fillText(p.name, u + 6, v + 4);
    }
  }

  // The truck: a blue arrow, always pointing up.
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = BLUE;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 11);
  ctx.lineTo(0, 5);
  ctx.lineTo(-11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // North, top right.
  ctx.save();
  ctx.translate(W - 34, 96);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(-here.heading);
  ctx.fillStyle = '#d23a30';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(5, 0);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9aa0a6';
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.lineTo(5, 0);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Guidance: stay on CA-1 South; the next named place on the way, and how far.
  const left = Math.max(0, state.end - state.s);
  const next = map?.along?.find((a) => a.s > state.s + 30);
  ctx.fillStyle = 'rgba(28,30,33,0.94)';
  roundRect(ctx, MX + 14, 14, 330, 70, 10);
  ctx.fill();
  ctx.save();
  ctx.translate(MX + 50, 49);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(12, -4);
  ctx.lineTo(4, -4);
  ctx.lineTo(4, 18);
  ctx.lineTo(-4, 18);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-12, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(state.done ? 'You have arrived' : `${miles(left)}`, MX + 80, 43);
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = '#c9ccd0';
  ctx.fillText(state.done ? DESTINATION : 'Continue on CA-1 South', MX + 80, 66, 255);
  if (next && !state.done) {
    // The next named place on the way, and how far.
    const text = `${next.name} · ${miles(next.s - state.s)}`;
    ctx.font = '600 14px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(28,30,33,0.82)';
    roundRect(ctx, MX + 14, 90, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, MX + 26, 109);
  }

  // Trip: arrival (Pacific time), minutes and miles left.
  const secs = timeLeft(state, plan, road);
  const arrive = new Date(Date.now() + secs * 1000).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, MX + 14, MH - 62, MW - 28, 48, 10);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText(state.done ? 'Arrived' : `${arrive} arrival`, MX + 30, MH - 31);
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.fillText(state.done ? DESTINATION : `${Math.max(1, Math.round(secs / 60))} min · ${miles(left)} · ${DESTINATION}`, MX + 190, MH - 31);
  ctx.font = '500 10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8b9096';
  ctx.fillText('© OpenStreetMap contributors', W - 8, MH - 4);
  ctx.restore();
}

/** Seconds to the end, from the planned speeds ahead (never less than walking pace). */
function timeLeft(state, plan, road) {
  let t = 0;
  for (let i = Math.floor(state.s / road.step); i < Math.floor(state.end / road.step); i++) t += road.step / Math.max(1.5, plan.v[i]);
  return t + 2;
}

function miles(m) {
  const mi = m / MI;
  return mi < 0.2 ? `${Math.round(m * 3.28084 / 50) * 50} ft` : `${mi.toFixed(1)} mi`;
}

function pin(ctx, x, y) {
  ctx.fillStyle = '#d23a30';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y - 16, 9, Math.PI, 0);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y - 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bounds(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of pts) {
    a = Math.min(a, x);
    b = Math.min(b, z);
    c = Math.max(c, x);
    d = Math.max(d, z);
  }
  return [a, b, c, d];
}
