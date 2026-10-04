// The centre screen, drawn on a canvas, and a touchscreen like the truck's: tap it with the mouse,
// a finger on a phone, or a controller's ray in the headset.
// Laid out as the Owner's Manual draws the touchscreen for software 2026.32 (assets-src/cybertruck/refs/tesla/
// manual-touchscreen.html): dark by default, with Light under Controls > Display.
// Left, the truck's own pane: the status bar along its top (energy, lock, profile, connectivity, dashcam,
// time, the outside temperature), the drive mode strip down its left edge, then the vehicle status: parked,
// the truck with Tonneau and Tailgate on it to touch; on the road, the speed, the limit, whether it's
// driving itself, and the road ahead in perspective, from the real road's line and heights, with the path
// it plans in blue. Under it, the media card. Right, the map: parked, Navigate; on the ride, the route
// ahead in blue over OpenStreetMap (the real coastline, roads, creeks and named places), heading-up or
// north-up from the compass at its lower left, and the turn card naming the road, the next place on the
// way and the arrival time, minutes, miles and energy left.
// Along the bottom, the black bar: Controls (the car), the cabin temperature with its arrows and the fan,
// My Apps (Navigation, Music, the front defroster, the driver's seat heater), the app launcher, the most
// recent app, and the volume. Apps open over the map.
// The back seat's small screen follows the manual's rear touchscreen: fan, power, climate, seats, media
// and navigation along its bar.
// Our own drawing in the spirit of the maker's screen, not a copy of it.
import { Color3, DynamicTexture, ImageProcessingConfiguration, StandardMaterial, Texture } from '@babylonjs/core';
import { drawLoader } from './loader.js';
import { createRadio } from './radio.js';

// The manual's illustration, measured: the left pane is 42% of the width and the bar under it 8% of the
// height (here a little taller, for fingers and the headset's ray: 2026.14 made the bar's icons larger too).
const W = 1024, H = 576;
const DOCK = 52;                                   // the bar along the bottom
const MH = H - DOCK;                               // above it, the truck's pane and the map
const VW = 434;                                    // the truck's pane; the map takes the rest
const MX = VW, MW = W - VW;
const STATUS = 40;                                 // the status bar across the top of the truck's pane
const BLUE = '#3e6ae1';
const RED = '#e3372b';
const MI = 1609.344;
const LIMIT_MPH = 55;                              // California's limit on two-lane highways: OSM has no sign here
const DESTINATION = 'Little Sur River';
const ROAD_NAME = 'CA-1 South';
const SOFTWARE = '2026.32.3';
const BATTERY = 78;                                // percent, as it leaves the showroom
const PER_MILE = 0.4;                              // percent of the pack a mile: about 480 Wh/mi of 123 kWh
const FAN_MAX = 10;
const AUTO_FAN = 4;
const RW = 640, RH = 360;                          // the back seat's screen, 16:9 like its glass
const RBAR = 48;                                   // its bar along the bottom
/** Canvas pixels per drawing unit: a seat's eye on a sharp display sees more than 1024 across the screen.
 *  The headset sees about that, and uploads every frame drawn, so it gets less. */
const SCALE = /OculusBrowser|Quest/.test(navigator.userAgent) ? 1.5 : 2;
/** How far outside a button (drawing units) a press still counts: the screen is seen at an angle, and fingers are wide. */
const SLOP = 10;
/** An open app closes itself after this long without a tap. */
const PANEL_SECONDS = 15;
/** Parked in the showroom: the truck at the origin, standing still. */
const PARKED = { parked: true, s: 0, v: 0, running: false, done: false, paused: false };
const ORIGIN = { x: 0, y: 0, z: 0, heading: 0 };
const FONT = 'system-ui, sans-serif';

/** Both appearances (Controls > Display > Appearance). sky: the truck's pane behind the road, as r,g,b. */
const THEMES = {
  dark: {
    name: 'dark', sky: [17, 18, 20], skyLow: '#1b1d20', ink: '#f1f2f4', muted: '#8e949a', dim: '#4c5157',
    card: 'rgba(30,32,35,0.94)', line: '#2c2f33', bar: '#000000', barHi: '#1c1e21',
    panel: '#16181a', tile: '#23262a', tileHi: '#2d3035', tileOn: '#1c2b4f',
    lane: '#2a2d31', edge: '#c9ccd0', centre: '#c9a23a', shadow: 'rgba(0,0,0,0.45)',
    map: '#232528', grid: '#2b2e32', sea: '#19303f', creek: '#2a4b61', roadCase: '#191b1d', road: '#474b51', roadMain: '#61666d',
    label: '#b4b9be', dot: '#80868c', islet: '#6f9ab3', behind: '#565b62',
  },
  light: {
    name: 'light', sky: [223, 225, 228], skyLow: '#cfd2d6', ink: '#17191c', muted: '#6a6f75', dim: '#a7abb0',
    card: 'rgba(255,255,255,0.95)', line: '#d5d7da', bar: '#f7f7f8', barHi: '#e3e5e8',
    panel: '#fbfbfc', tile: '#f2f3f5', tileHi: '#e8eaed', tileOn: '#e6edfc',
    lane: '#c4c8cd', edge: '#fbfbfb', centre: '#d8ad2a', shadow: 'rgba(0,0,0,0.16)',
    map: '#f1eee8', grid: '#e4e0d8', sea: '#a9d2e4', creek: '#8cc0da', roadCase: '#c9c4bb', road: '#fdfdfd', roadMain: '#ffffff',
    label: '#3a3e43', dot: '#5b5f64', islet: '#4f7f99', behind: '#9da3aa',
  },
};
/** The appearance being drawn. */
let C = THEMES.dark;

/** Controls' list, in the truck's order; the ones this replica has a page for can be opened. */
const CATEGORIES = [
  ['quick', 'Quick Controls'], ['lights', 'Lights'], ['locks', 'Locks'], ['display', 'Display'],
  ['driving', 'Driving'], ['autopilot', 'Autopilot'], ['suspension', 'Suspension'], ['charging', 'Charging'],
  ['safety', 'Safety'], ['service', 'Service'], ['software', 'Software'],
];
const PAGES = new Set(['quick', 'lights', 'locks', 'display', 'software']);

const stored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

/**
 * controls(): the Quick Controls tiles, from the scene: [{ label, value, active, onClick, disabled }].
 * action(): the screen's one big button over the map ({ label, onClick, disabled }), or null.
 * loading(): while the ride loads, { progress (0 to 1), detail }, drawn over the map (loader.js); else null.
 * onChange(): something on the screen changed that the scene may care about (the fan, say).
 * The back seat's small screen (int_rear_screen) takes taps too.
 */
export function createScreen(scene, screenMesh, { controls = () => [], action = () => null, loading = () => null, gear = () => 'P', onChange = () => {} } = {}) {
  const front = surface(scene, screenMesh, 'cyb-screen', W, H);
  const rear = surface(scene, scene.getMeshByName('int_rear_screen'), 'cyb-rear-screen', RW, RH);
  const surfaces = [front, rear].filter((s) => s.mesh);

  let ride = null;                                  // { state, at, plan, road } while on the road
  let dirty = true, since = 0, lastTap = 0;
  const changed = () => {
    dirty = true;
    onChange();
  };
  const radio = createRadio(changed);
  /** panel: the app open over the map (controls, climate, radio, apps, rear) or null; recent: the last app opened. */
  const ui = {
    panel: null, recent: null, tab: 'quick', hover: null,
    dark: stored('cyb-screen-dark') !== '0', h24: stored('cyb-screen-24h') === '1', celsius: stored('cyb-screen-celsius') === '1',
    northUp: false, locked: false,
    temp: 70, climateOn: true, auto: true, fan: AUTO_FAN, recirc: false, defrost: false, rearDefrost: false, seat: [0, 0], wheelHeat: false,
    rearOn: true, rearFan: 3, rearSeats: [0, 0, 0], rearTab: 'climate', rearLocked: false,
  };
  const open = (p) => () => {
    ui.panel = ui.panel === p ? null : p;
    if (ui.panel && ui.panel !== 'apps' && ui.panel !== 'controls') ui.recent = ui.panel;
  };
  const climate = {
    on: () => (ui.climateOn = true),
    temp: (d) => () => {
      ui.temp = Math.max(60, Math.min(85, ui.temp + d));
      ui.climateOn = true;
    },
    fan: (n) => Object.assign(ui, { climateOn: true, auto: false, fan: Math.max(0, Math.min(FAN_MAX, n)) }),
    defrost: () => {
      ui.defrost = !ui.defrost;
      if (ui.defrost) ui.climateOn = true;
    },
    seat: (i) => () => (ui.seat[i] = (ui.seat[i] + 3) % 4),
  };
  const set = (key, store_) => () => {
    ui[key] = !ui[key];
    store(store_, ui[key] ? '1' : '0');
  };
  const display = [
    { label: 'Appearance', value: () => (ui.dark ? 'Dark' : 'Light'), onClick: set('dark', 'cyb-screen-dark') },
    { label: 'Time', value: () => (ui.h24 ? '24 hour' : '12 hour'), onClick: set('h24', 'cyb-screen-24h') },
    { label: 'Temperature', value: () => (ui.celsius ? '°C' : '°F'), onClick: set('celsius', 'cyb-screen-celsius') },
  ];

  /** The turn card's words, for the front's map and the back's navigation. */
  function trip() {
    if (!ride) return null;
    const { state, plan, road } = ride;
    const left = Math.max(0, state.end - state.s);
    const secs = timeLeft(state, plan, road);
    return {
      done: state.done, left, secs,
      arrive: clock(new Date(Date.now() + secs * 1000), ui, 'America/Los_Angeles'),
      energy: Math.max(0, Math.round(BATTERY - (left / MI) * PER_MILE)),
      next: road.map?.along?.find((a) => a.s > state.s + 30),
      s: state.s,
    };
  }

  function drawFront() {
    const { ctx } = front;
    C = THEMES[ui.dark ? 'dark' : 'light'];
    const wait = ride ? null : loading();
    const hit = front.hit;
    front.hits = [];
    ctx.save();
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = C.map;
    ctx.fillRect(0, 0, W, H);
    const items = controls();
    if (ride) {
      const { state, at, plan, road } = ride;
      const here = at(state.s);
      drawView(ctx, state, at, here, [], hit, ui);
      drawMap(ctx, state, road, here, road.map, trip(), hit, ui);
    } else {
      drawView(ctx, PARKED, null, ORIGIN, items, hit, ui);
      if (wait) drawWait(ctx, wait);
      else drawParkedMap(ctx, hit, ui);
    }
    drawStatus(ctx, ui, !!ride, hit);
    drawDriveStrip(ctx, ride ? (ride.state.done ? 'P' : 'D') : gear());
    drawMediaCard(ctx, radio, hit, ui, open('radio'));
    const big = action();
    if (big && !ui.panel && !wait) drawAction(ctx, big, hit, ui);
    if (ui.panel === 'radio') drawRadioPanel(ctx, radio, hit, ui);
    if (ui.panel === 'climate') drawClimatePanel(ctx, ui, hit, climate);
    if (ui.panel === 'controls') drawControlsPanel(ctx, items, display, hit, ui);
    if (ui.panel === 'apps') drawAppsPanel(ctx, hit, ui, open);
    if (ui.panel === 'rear') drawRearPanel(ctx, hit, ui);
    if (ui.panel) hit(W - 70, 18, 52, 52, 'close', () => (ui.panel = null));
    drawDock(ctx, ui, radio, hit, open, climate);
    ctx.restore();
    front.tex.update();
  }

  function drawRear() {
    if (!rear.mesh) return;
    C = THEMES.dark;
    rear.hits = [];
    rear.ctx.save();
    rear.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawRearScreen(rear.ctx, ui, radio, ui.rearLocked ? () => {} : rear.hit, trip());
    rear.ctx.restore();
    rear.tex.update();
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
    /** The front climate's fan speed, 0 (off) to 10: the defroster runs it flat out. */
    get fan() {
      if (!ui.climateOn) return 0;
      return ui.defrost ? FAN_MAX : ui.auto ? AUTO_FAN : ui.fan;
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
      // An app left open closes by itself, so it doesn't hide the map for the whole ride.
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

/** The time as the screen shows it: 12 or 24 hour (Controls > Display > Time). */
function clock(date, ui, timeZone) {
  return date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: ui.h24 ? 'h23' : 'h12' }).replace(' AM', ' am').replace(' PM', ' pm');
}

/** A temperature kept in °F, shown in the unit chosen (Controls > Display > Temperature). */
function degrees(f, ui) {
  return ui.celsius ? `${Math.round(((f - 32) * 5) / 9 * 2) / 2}°` : `${Math.round(f)}°`;
}

// ---------------------------------------------------------------- the back seat's screen

/** The rear touchscreen: its page above, and the bar: fan speed, climate, seats, media, video, arcade, navigation, settings, volume. */
function drawRearScreen(ctx, ui, radio, hit, trip) {
  ctx.save();
  ctx.fillStyle = '#0c0d0f';
  ctx.fillRect(0, 0, RW, RH);
  const white = '#f4f5f6', grey = '#8b9096', off = '#4c5157';
  const by = RH - RBAR, cy = by + RBAR / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, by, RW, RBAR);
  const button = (x, w, id, onTap, paint, y = by, h = RBAR) => {
    if (ui.hover === id) {
      ctx.fillStyle = '#1f2226';
      roundRect(ctx, x, y + 4, w, h - 8, 10);
      ctx.fill();
    }
    paint(x + w / 2, y + h / 2);
    hit(x, y, w, h, id, onTap);
  };
  const tab = (x, id, paint) => button(x - 26, 52, `rear-${id}`, () => (ui.rearTab = id), (cx, c) => paint(cx, c, ui.rearTab === id ? BLUE : white));
  const fan = (d) => () => {
    ui.rearOn = true;
    ui.rearFan = Math.max(1, Math.min(FAN_MAX, ui.rearFan + d));
  };

  // Where the manual draws them, along a 640-wide bar.
  button(40, 36, 'rear-fan-down', fan(-1), (x, c) => chevron(ctx, x, c, -1, grey));
  fanIcon(ctx, 92, cy, white, ui.rearOn);
  ctx.fillStyle = ui.rearOn ? white : grey;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(ui.rearOn ? String(ui.rearFan) : 'Off', 106, cy + 5);
  button(126, 36, 'rear-fan-up', fan(1), (x, c) => chevron(ctx, x, c, 1, grey));
  tab(183, 'climate', (x, c, col) => fanIcon(ctx, x, c, col, true));
  tab(236, 'seats', (x, c, col) => seatIcon(ctx, x, c, col, 0));
  tab(291, 'media', (x, c, col) => noteGlyph(ctx, x, c, col));
  videoIcon(ctx, 345, cy, off);
  arcadeIcon(ctx, 400, cy, off);
  tab(455, 'nav', (x, c, col) => navArrow(ctx, x, c, col === BLUE ? BLUE : RED, 0.8));
  gearIcon(ctx, 508, cy, off);
  button(530, 34, 'rear-vol-down', () => radio.volume(-1), (x, c) => chevron(ctx, x, c, -1, grey));
  button(566, 38, 'rear-mute', () => radio.mute(), (x, c) => speakerIcon(ctx, x, c, radio.state.muted ? 0 : radio.state.volume, white, false));
  button(604, 34, 'rear-vol-up', () => radio.volume(1), (x, c) => chevron(ctx, x, c, 1, grey));

  const top = 0, h = by;
  ctx.textAlign = 'center';
  if (ui.rearLocked) {
    lockIcon(ctx, RW / 2, h / 2 - 20, white, true);
    ctx.fillStyle = grey;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Rear display locked from the front', RW / 2, h / 2 + 30);
  } else if (ui.rearTab === 'climate') {
    if (!ui.rearOn) {
      button(RW / 2 - 130, 200, 'rear-power', () => (ui.rearOn = true), (x, c) => {
        powerIcon(ctx, x, c - 16, white, 16);
        ctx.fillStyle = white;
        ctx.font = `500 20px ${FONT}`;
        ctx.fillText('Tap to power fan', x, c + 30);
      }, h / 2 - 60, 120);
    } else {
      fanIcon(ctx, RW / 2, h / 2 - 34, white, true, 2.4);
      ctx.fillStyle = white;
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText(`Fan ${ui.rearFan}`, RW / 2, h / 2 + 40);
      ctx.fillStyle = grey;
      ctx.font = `500 16px ${FONT}`;
      ctx.fillText('Rear vents · the front sets the temperature', RW / 2, h / 2 + 66);
      button(RW - 96, 72, 'rear-power-off', () => (ui.rearOn = false), (x, c) => powerIcon(ctx, x, c, grey, 12), 20, 64);
    }
  } else if (ui.rearTab === 'seats') {
    ctx.fillStyle = grey;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('SEAT HEATERS', RW / 2, 46);
    ['Left', 'Centre', 'Right'].forEach((name, i) => {
      const x = RW / 2 + (i - 1) * 170;
      button(x - 70, 140, `rear-seat-${i}`, () => (ui.rearSeats[i] = (ui.rearSeats[i] + 3) % 4), (cx, c) => {
        seatIcon(ctx, cx, c - 14, white, ui.rearSeats[i], 2);
        ctx.fillStyle = ui.rearSeats[i] ? white : grey;
        ctx.font = `600 16px ${FONT}`;
        ctx.fillText(`${name} · ${ui.rearSeats[i] || 'Off'}`, cx, c + 50);
      }, 80, 170);
    });
  } else if (ui.rearTab === 'media') {
    const st = radio.stations[radio.state.station];
    ctx.textAlign = 'left';
    ctx.fillStyle = grey;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('NOW PLAYING', 36, 50);
    ctx.fillStyle = white;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText(radio.on ? st.name : 'Radio off', 36, 98, RW - 72);
    ctx.fillStyle = radio.state.status === 'error' ? '#ff6b5e' : '#b7bcc2';
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(statusText(radio.state.status, st), 36, 130, RW - 72);
    const pad = (x, id, onTap, paint) => button(x, 96, id, onTap, paint, 170, 76);
    const box = (x) => {
      ctx.fillStyle = '#1b1d20';
      roundRect(ctx, x - 48, 174, 96, 68, 14);
      ctx.fill();
    };
    [[RW / 2 - 156, 'rear-prev', () => radio.prev(), (x, c) => nextIcon(ctx, x, c, white, -1)],
      [RW / 2 - 48, 'rear-play', () => radio.toggle(), (x, c) => playIcon(ctx, x, c, radio.on, white)],
      [RW / 2 + 60, 'rear-next', () => radio.next(), (x, c) => nextIcon(ctx, x, c, white)]].forEach(([x, id, fn, paint]) => {
      box(x + 48);
      pad(x, id, fn, paint);
    });
  } else if (ui.rearTab === 'nav') {
    ctx.textAlign = 'left';
    if (!trip) {
      ctx.fillStyle = white;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText('No route', 36, 90);
      ctx.fillStyle = grey;
      ctx.font = `500 18px ${FONT}`;
      ctx.fillText('Navigation starts with the self-driving ride', 36, 124);
    } else {
      navArrow(ctx, 70, 92, white, 1.6, true);
      ctx.fillStyle = white;
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText(trip.done ? 'You have arrived' : miles(trip.left), 120, 90);
      ctx.fillStyle = '#b7bcc2';
      ctx.font = `500 20px ${FONT}`;
      ctx.fillText(trip.done ? DESTINATION : `Continue on ${ROAD_NAME}`, 120, 122, RW - 150);
      ctx.fillStyle = white;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(trip.done ? 'Arrived' : `${trip.arrive} arrival · ${Math.max(1, Math.round(trip.secs / 60))} min`, 36, 200);
      ctx.fillStyle = grey;
      ctx.font = `500 18px ${FONT}`;
      ctx.fillText(trip.next && !trip.done ? `Next: ${trip.next.name}, ${miles(trip.next.s - trip.s)}` : DESTINATION, 36, 232, RW - 72);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the status bar, drive strip and media card

/** Across the top of the truck's pane: energy, then lock, profile and Wi-Fi, then the dashcam, the time and outside. */
function drawStatus(ctx, ui, onRide, hit) {
  const y = 22;
  // The energy: slanted bars, filled to the charge.
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i < Math.round((BATTERY / 100) * 9) ? C.ink : C.dim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16 + i * 5, y + 7);
    ctx.lineTo(20 + i * 5, y - 7);
    ctx.stroke();
  }
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(`${BATTERY} %`, 68, y + 6);

  // Lock (touch to lock or unlock everything), the driver's profile, Wi-Fi.
  const lx = 176;
  if (ui.hover === 'lock') {
    ctx.fillStyle = C.tileHi;
    roundRect(ctx, lx - 18, 4, 36, 34, 8);
    ctx.fill();
  }
  lockIcon(ctx, lx, y, C.ink, ui.locked);
  hit(lx - 20, 0, 40, STATUS, 'lock', () => (ui.locked = !ui.locked));
  profileIcon(ctx, lx + 38, y, C.ink);
  wifiIcon(ctx, lx + 76, y + 2, C.ink);

  // Dashcam, the time (Pacific on the ride, yours in the showroom), the temperature outside (the coast's in Big Sur).
  const time = clock(new Date(), ui, onRide ? 'America/Los_Angeles' : undefined);
  const temp = degrees(onRide ? 61 : 70, ui);
  ctx.font = `600 17px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = C.ink;
  ctx.fillText(temp, VW - 14, y + 6);
  const tw = ctx.measureText(temp).width;
  ctx.fillText(time, VW - 26 - tw, y + 6);
  const cw = ctx.measureText(time).width;
  cameraIcon(ctx, VW - 46 - tw - cw, y, C.ink);
}

/** Down the left edge: the drive mode strip, with the gear it's in. */
function drawDriveStrip(ctx, gear) {
  const x = 26, y0 = 64, y1 = 300;
  ctx.fillStyle = C.dim;
  for (let y = y0 + 22; y < y1 - 18; y += 8) {
    for (const dx of [-6, 0, 6]) {
      if (Math.abs(y - (y0 + y1) / 2) < 26) continue;
      ctx.fillRect(x + dx - 0.8, y, 1.6, 1.6);
    }
  }
  chevronUp(ctx, x, y0 + 8, -1, C.muted);
  chevronUp(ctx, x, y1 - 6, 1, C.muted);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(gear, x, (y0 + y1) / 2 + 4);
  ctx.font = `600 9px ${FONT}`;
  ctx.fillStyle = C.muted;
  if (gear === 'P') ctx.fillText('HOLD', x, (y0 + y1) / 2 + 20);
}

/** The media card under the truck: what's playing, then back, play/stop, next and the station list. */
function drawMediaCard(ctx, radio, hit, ui, openRadio) {
  const x = 16, y = MH - 104, w = VW - 32, h = 92;
  ctx.fillStyle = C.card;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  const st = radio.stations[radio.state.station];
  // The art: the music app's own square.
  if (ui.hover === 'm-open') {
    ctx.fillStyle = C.tileHi;
    roundRect(ctx, x + 4, y + 4, w - 8, 40, 8);
    ctx.fill();
  }
  ctx.fillStyle = C.tile;
  roundRect(ctx, x + 12, y + 8, 32, 32, 6);
  ctx.fill();
  noteGlyph(ctx, x + 28, y + 24, C.muted, 0.7);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(radio.on ? st.name : 'Choose Media Source', x + 56, y + 22, w - 70);
  ctx.fillStyle = radio.state.status === 'error' ? '#e05a4c' : C.muted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(radio.on ? statusText(radio.state.status, st) : `Radio · ${st.name}`, x + 56, y + 38, w - 70);
  hit(x, y, w, 46, 'm-open', openRadio);
  ctx.fillStyle = C.line;
  ctx.fillRect(x + 10, y + 47, w - 20, 1);
  const row = y + 70;
  const btns = [
    ['m-prev', () => radio.prev(), (cx) => nextIcon(ctx, cx, row, C.ink, -1)],
    ['m-play', () => radio.toggle(), (cx) => playIcon(ctx, cx, row, radio.on, C.ink)],
    ['m-next', () => radio.next(), (cx) => nextIcon(ctx, cx, row, C.ink)],
    ['m-list', openRadio, (cx) => listIcon(ctx, cx, row, C.ink)],
  ];
  btns.forEach(([id, fn, paint], i) => {
    const bw = w / btns.length, bx = x + i * bw;
    if (ui.hover === id) {
      ctx.fillStyle = C.tileHi;
      roundRect(ctx, bx + 8, y + 52, bw - 16, 36, 8);
      ctx.fill();
    }
    paint(bx + bw / 2);
    hit(bx, y + 48, bw, h - 48, id, fn);
  });
}

// ---------------------------------------------------------------- the bar and the apps

function drawDock(ctx, ui, radio, hit, open, climate) {
  const y = MH;
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, y, W, DOCK);
  if (!ui.dark) {
    ctx.fillStyle = C.line;
    ctx.fillRect(0, y, W, 1);
  }
  const cy = y + DOCK / 2;
  const button = (x, w, id, onTap, paint) => {
    if (ui.hover === id) {
      ctx.fillStyle = C.barHi;
      roundRect(ctx, x, y + 5, w, DOCK - 10, 9);
      ctx.fill();
    }
    paint(x + w / 2, cy);
    hit(x, y, w, DOCK, id, onTap);
  };
  const lit = (p) => (ui.panel === p ? BLUE : C.ink);

  // Controls: the car.
  button(4, 46, 'dock-car', open('controls'), (x, c) => carIcon(ctx, x, c, lit('controls')));
  // The driver's temperature, its arrows either side, and the fan: touch either for the climate.
  button(114, 36, 'temp-down', climate.temp(-1), (x, c) => chevron(ctx, x, c, -1, C.muted));
  button(150, 60, 'temp', open('climate'), (x, c) => {
    ctx.fillStyle = ui.climateOn ? C.ink : C.dim;
    ctx.font = `500 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(ui.climateOn ? degrees(ui.temp, ui).replace('°', '') : 'Off', x, c + 9);
  });
  button(210, 36, 'temp-up', climate.temp(1), (x, c) => chevron(ctx, x, c, 1, C.muted));
  button(312, 50, 'dock-fan', open('climate'), (x, c) => fanIcon(ctx, x, c, lit('climate'), ui.climateOn));

  // My Apps: Navigation, Music, the front defroster, the driver's seat heater.
  button(366, 44, 'app-nav', () => (ui.panel = null), (x, c) => appTile(ctx, x, c, '#1b1d20', (cx, cc) => navArrow(ctx, cx, cc, RED, 0.75)));
  button(414, 44, 'app-music', open('radio'), (x, c) => appTile(ctx, x, c, '#e2492f', (cx, cc) => noteGlyph(ctx, cx, cc, '#fff', 0.75)));
  button(462, 44, 'app-defrost', climate.defrost, (x, c) => defrostIcon(ctx, x, c, ui.defrost ? BLUE : C.ink));
  button(510, 44, 'app-seat', climate.seat(0), (x, c) => seatIcon(ctx, x, c, C.ink, ui.seat[0]));
  // The launcher, then the app used last.
  button(566, 44, 'dock-apps', open('apps'), (x, c) => launcherIcon(ctx, x, c));
  if (ui.recent) {
    const app = APPS.find((a) => a.panel === ui.recent);
    if (app) button(614, 44, 'dock-recent', open(app.panel), (x, c) => app.icon(ctx, x, c, lit(app.panel)));
  }

  // The volume: its arrows, and the speaker to mute.
  button(774, 40, 'vol-down', () => radio.volume(-1), (x, c) => chevron(ctx, x, c, -1, C.muted));
  button(816, 54, 'mute', () => radio.mute(), (x, c) => speakerIcon(ctx, x, c, radio.state.muted ? 0 : radio.state.volume, C.ink, true));
  button(872, 40, 'vol-up', () => radio.volume(1), (x, c) => chevron(ctx, x, c, 1, C.muted));
}

/** The app tray's apps, and how each draws in the bar as the recent one. */
const APPS = [
  { panel: null, label: 'Navigation', icon: (ctx, x, y) => appTile(ctx, x, y, '#1b1d20', (cx, cc) => navArrow(ctx, cx, cc, RED, 0.75)) },
  { panel: 'radio', label: 'Music', icon: (ctx, x, y) => appTile(ctx, x, y, '#e2492f', (cx, cc) => noteGlyph(ctx, cx, cc, '#fff', 0.75)) },
  { panel: 'climate', label: 'Climate', icon: (ctx, x, y, col) => fanIcon(ctx, x, y, col, true) },
  { panel: 'controls', label: 'Controls', icon: (ctx, x, y, col) => carIcon(ctx, x, y, col) },
  { panel: 'rear', label: 'Rear Screen', icon: (ctx, x, y, col) => rearScreenIcon(ctx, x, y, col) },
];

function statusText(status, st) {
  if (status === 'connecting') return 'Tuning in…';
  if (status === 'error') return 'Can’t reach this station';
  if (status === 'playing') return st.sub;
  return 'Tap to listen';
}

/** An app over the map, with a title and a close button; returns its inner box. */
function panel(ctx, title, ui) {
  const x = MX + 12, y = 12, w = MW - 24, h = MH - 24;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x + 2, y + 4, w, h, 14);
  ctx.fill();
  ctx.fillStyle = C.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  if (title) {
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(title, x + 24, y + 42);
  }
  // Close, top right (its hit is added after the app's own).
  ctx.strokeStyle = ui.hover === 'close' ? BLUE : C.muted;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const cx = W - 44, cy = 44;
  ctx.moveTo(cx - 9, cy - 9);
  ctx.lineTo(cx + 9, cy + 9);
  ctx.moveTo(cx + 9, cy - 9);
  ctx.lineTo(cx - 9, cy + 9);
  ctx.stroke();
  return { x: x + 24, y: y + 64, w: w - 48, h: h - 80 };
}

function tile(ctx, x, y, w, h, { label, value, active, disabled }, hovered) {
  ctx.fillStyle = active ? C.tileOn : hovered && !disabled ? C.tileHi : C.tile;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  if (active) {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = disabled ? C.dim : C.ink;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(label, x + 14, y + (value ? h / 2 - 4 : h / 2 + 6), w - 28);
  if (value) {
    ctx.fillStyle = disabled ? C.dim : active ? (C.name === 'dark' ? '#8fb0ff' : BLUE) : C.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(value, x + 14, y + h / 2 + 18, w - 28);
  }
}

function tiles(ctx, box, y, list, cols, th, hit, ui, prefix) {
  const gap = 10, tw = (box.w - gap * (cols - 1)) / cols;
  list.forEach((item, i) => {
    const x = box.x + (i % cols) * (tw + gap), ty = y + Math.floor(i / cols) * (th + gap);
    const id = `${prefix}-${i}`;
    tile(ctx, x, ty, tw, th, item, ui.hover === id);
    if (!item.disabled) hit(x, ty, tw, th, id, item.onClick);
  });
}

function note(ctx, box, text) {
  ctx.fillStyle = C.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(text, box.x, box.y + box.h, box.w);
}

function drawRadioPanel(ctx, radio, hit, ui) {
  const box = panel(ctx, 'Radio', ui);
  tiles(ctx, box, box.y, radio.stations.map((st, i) => {
    const playing = radio.on && radio.state.station === i;
    return { label: st.name, value: playing ? statusText(radio.state.status, st) : st.sub, active: playing, onClick: () => (playing ? radio.stop() : radio.play(i)) };
  }), 2, 72, hit, ui, 'station');
  note(ctx, box, 'Live from each station’s own stream. Volume on the bar’s right.');
}

/** The climate app: power, Auto and the temperature; the fan; then airflow, defrosters and heaters. */
function drawClimatePanel(ctx, ui, hit, climate) {
  const box = panel(ctx, 'Climate', ui);
  const { x, y, w } = box;
  const pill = (px, py, pw, ph, id, on, onTap, paint) => {
    ctx.fillStyle = on ? C.tileOn : ui.hover === id ? C.tileHi : C.tile;
    roundRect(ctx, px, py, pw, ph, ph / 2);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    paint(px + pw / 2, py + ph / 2);
    hit(px, py, pw, ph, id, onTap);
  };
  pill(x, y, 52, 48, 'c-power', ui.climateOn, () => (ui.climateOn = !ui.climateOn), (cx, cy) => powerIcon(ctx, cx, cy, ui.climateOn ? BLUE : C.muted, 11));
  pill(x + 64, y, 88, 48, 'c-auto', ui.auto && ui.climateOn, () => Object.assign(ui, { auto: !ui.auto, climateOn: true }), (cx, cy) => {
    ctx.fillStyle = ui.auto && ui.climateOn ? (C.name === 'dark' ? '#8fb0ff' : BLUE) : C.ink;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('AUTO', cx, cy + 6);
  });
  const tx = x + w - 110;
  for (const [dx, d] of [[-80, -1], [80, 1]]) pill(tx + dx - 26, y, 52, 48, `c-temp${d}`, false, climate.temp(d), (cx, cy) => chevron(ctx, cx, cy, d, C.ink));
  ctx.fillStyle = ui.climateOn ? C.ink : C.dim;
  ctx.textAlign = 'center';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(degrees(ui.temp, ui), tx, y + 37);

  // The fan: ten steps to touch (Auto picks its own).
  const fy = y + 66;
  fanIcon(ctx, x + 14, fy + 20, ui.climateOn ? C.ink : C.dim, ui.climateOn);
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'left';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(!ui.climateOn ? 'Off' : ui.defrost ? 'Max' : ui.auto ? 'Auto' : String(ui.fan), x + 34, fy + 25);
  const sx = x + 76, sw = w - 76, step = sw / FAN_MAX;
  const level = !ui.climateOn ? 0 : ui.defrost ? FAN_MAX : ui.auto ? AUTO_FAN : ui.fan;
  for (let i = 0; i < FAN_MAX; i++) {
    const id = `c-fan-${i}`;
    ctx.fillStyle = i < level ? (ui.auto && !ui.defrost ? C.muted : BLUE) : ui.hover === id ? C.tileHi : C.tile;
    roundRect(ctx, sx + i * step + 2, fy + 8, step - 4, 24, 5);
    ctx.fill();
    hit(sx + i * step, fy, step, 40, id, () => climate.fan(i + 1 === ui.fan && !ui.auto ? i : i + 1));
  }

  const heat = (n) => (n ? `Heat ${n}` : 'Off');
  tiles(ctx, box, y + 124, [
    { label: 'Recirculate', value: ui.recirc ? 'Cabin air' : 'Outside air', active: ui.recirc, onClick: () => (ui.recirc = !ui.recirc) },
    { label: 'Front defrost', value: ui.defrost ? 'On · fan max' : 'Off', active: ui.defrost, onClick: climate.defrost },
    { label: 'Rear defrost', value: ui.rearDefrost ? 'On' : 'Off', active: ui.rearDefrost, onClick: () => (ui.rearDefrost = !ui.rearDefrost) },
    { label: 'Driver seat', value: heat(ui.seat[0]), active: ui.seat[0] > 0, onClick: climate.seat(0) },
    { label: 'Passenger seat', value: heat(ui.seat[1]), active: ui.seat[1] > 0, onClick: climate.seat(1) },
    { label: 'Steering wheel', value: ui.wheelHeat ? 'Heat on' : 'Off', active: ui.wheelHeat, onClick: () => (ui.wheelHeat = !ui.wheelHeat) },
  ], 3, 68, hit, ui, 'climate');
  note(ctx, box, 'On the ride you hear the fan behind the dash vents change with its speed.');
}

/** Controls: search at the top, the list down the left, the chosen page on the right. */
function drawControlsPanel(ctx, items, display, hit, ui) {
  const box = panel(ctx, null, ui);
  const top = box.y - 52;
  // Search, as at the top of the truck's Controls (not a keyboard here).
  ctx.fillStyle = C.tile;
  roundRect(ctx, box.x - 8, top, 250, 38, 19);
  ctx.fill();
  searchIcon(ctx, box.x + 12, top + 19, C.muted);
  ctx.fillStyle = C.muted;
  ctx.font = `500 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Search Settings', box.x + 30, top + 24);
  profileIcon(ctx, box.x + 274, top + 19, C.ink);
  bellIcon(ctx, box.x + 310, top + 19, C.ink);

  const lw = 160, rowH = 36;
  CATEGORIES.forEach(([id, name], i) => {
    const y = box.y + i * rowH, can = PAGES.has(id), on = ui.tab === id, hid = `tab-${id}`;
    if (on || (can && ui.hover === hid)) {
      ctx.fillStyle = on ? C.tile : C.tileHi;
      roundRect(ctx, box.x - 8, y, lw, rowH - 4, 8);
      ctx.fill();
    }
    ctx.fillStyle = !can ? C.dim : on ? C.ink : C.muted;
    ctx.font = `${on ? 700 : 500} 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(name, box.x + 6, y + 22);
    if (can) hit(box.x - 8, y, lw, rowH - 4, hid, () => (ui.tab = id));
  });

  const page = { x: box.x + lw + 12, y: box.y, w: box.w - lw - 12, h: box.h };
  ctx.fillStyle = C.ink;
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(CATEGORIES.find(([id]) => id === ui.tab)[1], page.x, page.y + 18);
  const y = page.y + 36;
  const byLabel = (...names) => items.filter((it) => names.includes(it.label));
  if (ui.tab === 'quick') tiles(ctx, page, y, items.filter((it) => !['Ambient light', 'Hazards', 'Gear'].includes(it.label)), 2, 72, hit, ui, 'quick');
  if (ui.tab === 'lights') tiles(ctx, page, y, byLabel('Lights', 'Hazards', 'Gear', 'Ambient light'), 2, 72, hit, ui, 'lights');
  if (ui.tab === 'locks') {
    tiles(ctx, page, y, [
      { label: 'Lock', value: ui.locked ? 'Locked · tap to unlock' : 'Unlocked · tap to lock', active: ui.locked, onClick: () => (ui.locked = !ui.locked) },
      ...byLabel('Doors'),
    ], 2, 72, hit, ui, 'locks');
  }
  if (ui.tab === 'display') tiles(ctx, page, y, display.map((d) => ({ label: d.label, value: d.value(), onClick: d.onClick })), 2, 72, hit, ui, 'display');
  if (ui.tab === 'software') {
    ctx.fillStyle = C.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('Software version', page.x, y + 14);
    ctx.fillStyle = C.ink;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`v${SOFTWARE}`, page.x, y + 50);
    ctx.fillStyle = C.muted;
    ctx.font = `500 14px ${FONT}`;
    for (const [i, line] of ['This screen follows the Cybertruck Owner’s Manual', `for software ${SOFTWARE.split('.').slice(0, 2).join('.')}: its layout, bar and apps.`, 'Our own drawing, not the maker’s code.'].entries()) {
      ctx.fillText(line, page.x, y + 84 + i * 20, page.w);
    }
  }
}

/** The app launcher's tray. */
function drawAppsPanel(ctx, hit, ui, open) {
  const box = panel(ctx, 'Apps', ui);
  const cols = 4, gap = 12, tw = (box.w - gap * (cols - 1)) / cols, th = 100;
  APPS.forEach((app, i) => {
    const x = box.x + (i % cols) * (tw + gap), y = box.y + Math.floor(i / cols) * (th + gap), id = `tray-${i}`;
    ctx.fillStyle = ui.hover === id ? C.tileHi : C.tile;
    roundRect(ctx, x, y, tw, th, 12);
    ctx.fill();
    app.icon(ctx, x + tw / 2, y + 40, C.ink);
    ctx.fillStyle = C.ink;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(app.label, x + tw / 2, y + 82, tw - 12);
    hit(x, y, tw, th, id, app.panel ? open(app.panel) : () => (ui.panel = null));
  });
  note(ctx, box, 'Touch an app to open it over the map.');
}

/** The rear screen's remote: its fan and power, and locking it. */
function drawRearPanel(ctx, hit, ui) {
  const box = panel(ctx, 'Rear Screen', ui);
  tiles(ctx, box, box.y, [
    { label: 'Rear climate', value: ui.rearOn ? 'On' : 'Off', active: ui.rearOn, onClick: () => (ui.rearOn = !ui.rearOn) },
    { label: 'Fan slower', value: ui.rearOn ? `Fan ${ui.rearFan}` : 'Off', onClick: () => Object.assign(ui, { rearOn: true, rearFan: Math.max(1, ui.rearFan - 1) }) },
    { label: 'Fan faster', value: ui.rearOn ? `Fan ${ui.rearFan}` : 'Off', onClick: () => Object.assign(ui, { rearOn: true, rearFan: Math.min(FAN_MAX, ui.rearFan + 1) }) },
    { label: 'Lock Rear Display', value: ui.rearLocked ? 'Locked' : 'Unlocked', active: ui.rearLocked, onClick: () => (ui.rearLocked = !ui.rearLocked) },
  ], 2, 72, hit, ui, 'rear');
  note(ctx, box, 'The back seat’s screen, from the front.');
}

/** The big blue button over the map: Start self-driving, Drive on. */
function drawAction(ctx, { label, onClick, disabled }, hit, ui) {
  const w = 340, h = 64, x = MX + (MW - w) / 2, y = MH - 96;
  const on = ui.hover === 'action' && !disabled;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x + 2, y + 4, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = disabled ? '#6a6f75' : on ? '#2b57c4' : BLUE;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  wheelIcon(ctx, x + 44, y + h / 2 - 1, '#fff');
  ctx.fillStyle = '#fff';
  ctx.font = `700 25px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 78, y + h / 2 + 9, w - 96);
  ctx.restore();
  if (!disabled) hit(x, y, w, h, 'action', onClick);
}

/** While the ride loads, over the map: the truck on its way down the coast, and how far the download has got. */
function drawWait(ctx, { progress, detail }) {
  ctx.save();
  ctx.fillStyle = C.map;
  ctx.fillRect(MX, 0, MW, MH);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText('Getting Highway 1 ready', MX + 32, 110);
  ctx.fillStyle = C.muted;
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(`${Math.round(progress * 100)}%${detail ? ` · ${detail}` : ''}`, MX + 32, 142);
  drawLoader(ctx, MX, 170, MW, 230, { progress, t: performance.now() / 1000, theme: C.name });
  ctx.fillStyle = C.muted;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('Bixby Creek Bridge', MX + 24, 430);
  ctx.textAlign = 'right';
  ctx.fillText(DESTINATION, W - 24, 430);
  ctx.restore();
}

/** Parked, the map has nowhere to go: a quiet grid, where you are, and Navigate. */
function drawParkedMap(ctx, hit, ui) {
  ctx.save();
  ctx.fillStyle = C.map;
  ctx.fillRect(MX, 0, MW, MH);
  ctx.strokeStyle = C.grid;
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
  ctx.save();
  ctx.translate(cx, cy);
  arrow(ctx, ui.northUp ? 0 : 0);
  ctx.restore();
  // Navigate, top left, as on the truck; the route here comes with the ride.
  ctx.fillStyle = C.card;
  roundRect(ctx, MX + 14, 14, 260, 42, 10);
  ctx.fill();
  searchIcon(ctx, MX + 36, 35, C.muted);
  ctx.fillStyle = C.ink;
  ctx.font = `500 18px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Navigate', MX + 56, 41);
  ctx.fillStyle = C.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('Showroom · navigation starts with the self-driving ride', MX + 18, 76);
  compass(ctx, 0, hit, ui);
  ctx.restore();
}

/** The blue arrow that is the truck on the map. */
function arrow(ctx, angle) {
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(62,106,225,0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
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
}

/** Map orientation, lower left of the map: touch to switch between heading-up and north-up. */
function compass(ctx, heading, hit, ui) {
  const x = MX + 34, y = MH - 34;
  ctx.save();
  ctx.fillStyle = ui.hover === 'compass' ? C.tileHi : C.card;
  roundRect(ctx, x - 22, y - 22, 44, 44, 10);
  ctx.fill();
  ctx.translate(x, y);
  // The needle points north: up when north-up, turned by the heading when heading-up.
  ctx.rotate(ui.northUp ? 0 : -heading);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, -2);
  ctx.lineTo(-5, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(5, 2);
  ctx.lineTo(-5, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  hit(x - 26, y - 26, 52, 52, 'compass', () => (ui.northUp = !ui.northUp));
}

// ---------------------------------------------------------------- icons

/** An app in the bar: a rounded square in its colour, its glyph on it. */
function appTile(ctx, x, y, color, glyph) {
  ctx.fillStyle = color;
  roundRect(ctx, x - 15, y - 15, 30, 30, 7);
  ctx.fill();
  if (color === '#1b1d20') {
    ctx.strokeStyle = '#3a3e43';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  glyph(x, y);
}

/** The launcher: four small apps in a square. */
function launcherIcon(ctx, x, y) {
  ctx.fillStyle = '#1b1d20';
  roundRect(ctx, x - 15, y - 15, 30, 30, 7);
  ctx.fill();
  ctx.strokeStyle = '#3a3e43';
  ctx.lineWidth = 1;
  ctx.stroke();
  ['#3fb950', '#e2492f', '#f2c230', '#3e6ae1'].forEach((c, i) => {
    ctx.fillStyle = c;
    roundRect(ctx, x - 10 + (i % 2) * 11, y - 10 + Math.floor(i / 2) * 11, 9, 9, 2);
    ctx.fill();
  });
}

/** The truck from the side: the long roof line from the nose to the tail, over its two wheels. */
function carIcon(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.lineTo(-17, -3);
  ctx.lineTo(-1, -10);
  ctx.lineTo(18, -5);
  ctx.lineTo(18, 3);
  ctx.lineTo(-18, 3);
  ctx.closePath();
  ctx.fill();
  for (const wx of [-10, 10]) {
    ctx.beginPath();
    ctx.arc(wx, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function chevron(ctx, x, y, dir, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dir * 4, y - 8);
  ctx.lineTo(x + dir * 4, y);
  ctx.lineTo(x - dir * 4, y + 8);
  ctx.stroke();
}

/** Up (dir -1) or down (1). */
function chevronUp(ctx, x, y, dir, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y - dir * 3);
  ctx.lineTo(x, y + dir * 3);
  ctx.lineTo(x + 5, y - dir * 3);
  ctx.stroke();
}

function fanIcon(ctx, x, y, color, on, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = on ? color : C.dim;
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-7, -4, -6, -13, 1, -13);
    ctx.bezierCurveTo(6, -13, 6, -6, 0, 0);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function noteGlyph(ctx, x, y, color, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
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

/** Navigation's arrowhead (outlined in white when big, as on the rear screen). */
function navArrow(ctx, x, y, color, k = 1, outline = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-11, 12);
  ctx.closePath();
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function playIcon(ctx, x, y, playing, color) {
  ctx.fillStyle = color;
  if (playing) {
    // Live radio stops rather than pauses: a square.
    ctx.fillRect(x - 7, y - 7, 14, 14);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 10);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x - 6, y + 10);
  ctx.closePath();
  ctx.fill();
}

/** Next (dir 1) or back (-1): a triangle to a bar. */
function nextIcon(ctx, x, y, color, dir = 1) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - dir * 7, y - 8);
  ctx.lineTo(x + dir * 5, y);
  ctx.lineTo(x - dir * 7, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(dir > 0 ? x + 5 : x - 8, y - 8, 3, 16);
}

function listIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 8, y - 7 + i * 6, 16, 2);
  ctx.fillRect(x - 8, y + 11, 10, 2);
}

/** A speaker with as many waves as the volume (none when muted: a cross); its number beside it if asked. */
function speakerIcon(ctx, x, y, volume, color, number) {
  ctx.save();
  ctx.translate(x - 4, y);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(-5, -4);
  ctx.lineTo(1, -10);
  ctx.lineTo(1, 10);
  ctx.lineTo(-5, 4);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (!volume) {
    ctx.beginPath();
    ctx.moveTo(6, -5);
    ctx.lineTo(14, 5);
    ctx.moveTo(14, -5);
    ctx.lineTo(6, 5);
    ctx.stroke();
  } else {
    const waves = Math.ceil(volume / 4);
    for (let i = 0; i < waves; i++) {
      ctx.beginPath();
      ctx.arc(1, 0, 6 + i * 5, -0.8, 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (!number) return;
  ctx.fillStyle = C.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(volume), x + 19, y + 17);
}

/** A seat from the side, with its heat as one to three red waves over the cushion. */
function seatIcon(ctx, x, y, color, level, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  // The backrest, leaning back, and the cushion.
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.quadraticCurveTo(-5, -14, -4, -10);
  ctx.lineTo(-2, 4);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, -7, 4, 17, 6, 3);
  ctx.fill();
  ctx.fillRect(-1, 10, 3, 4);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < level; i++) {
    const wx = 2 + i * 4;
    ctx.beginPath();
    ctx.moveTo(wx, 1);
    ctx.bezierCurveTo(wx - 2, -2, wx + 2, -5, wx, -8);
    ctx.stroke();
  }
  ctx.restore();
}

/** The front defroster: the windscreen's curve with three wavy arrows up through it. */
function defrostIcon(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -5);
  ctx.quadraticCurveTo(0, -12, 13, -5);
  ctx.lineTo(10, 9);
  ctx.quadraticCurveTo(0, 6, -10, 9);
  ctx.closePath();
  ctx.stroke();
  for (const dx of [-5, 0, 5]) {
    ctx.beginPath();
    ctx.moveTo(dx, 5);
    ctx.bezierCurveTo(dx - 2, 2, dx + 2, -1, dx, -5);
    ctx.stroke();
  }
  ctx.restore();
}

function powerIcon(ctx, x, y, color, r) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + Math.PI * 2);
  ctx.moveTo(x, y - r - 3);
  ctx.lineTo(x, y - r * 0.2);
  ctx.stroke();
}

function lockIcon(ctx, x, y, color, locked) {
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (locked) ctx.arc(x, y - 3, 4.5, Math.PI, 0);
  else ctx.arc(x + 6, y - 5, 4.5, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4.5, y - 3);
  ctx.lineTo(x - 4.5, y - 1);
  if (locked) {
    ctx.moveTo(x + 4.5, y - 3);
    ctx.lineTo(x + 4.5, y - 1);
  }
  ctx.stroke();
  roundRect(ctx, x - 7, y - 1, 14, 10, 2);
  ctx.fill();
}

function profileIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 8, 5, 0, Math.PI, 0);
  ctx.fill();
}

function wifiIcon(ctx, x, y, color) {
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const r of [5, 10]) {
    ctx.beginPath();
    ctx.arc(x, y + 4, r, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y + 4, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/** The dashcam: a video camera. */
function cameraIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x - 9, y - 5, 12, 10, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 1);
  ctx.lineTo(x + 9, y - 5);
  ctx.lineTo(x + 9, y + 5);
  ctx.lineTo(x + 3, y + 1);
  ctx.closePath();
  ctx.fill();
}

function searchIcon(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 6, 0, Math.PI * 2);
  ctx.moveTo(x + 2.5, y + 2.5);
  ctx.lineTo(x + 7, y + 7);
  ctx.stroke();
}

function bellIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 5);
  ctx.quadraticCurveTo(x - 6, y - 9, x, y - 9);
  ctx.quadraticCurveTo(x + 6, y - 9, x + 7, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + 7, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function rearScreenIcon(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 12, y - 8, 24, 15, 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 4, y + 9, 8, 2);
}

function videoIcon(ctx, x, y, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x - 10, y - 8, 20, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 4);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x - 3, y + 4);
  ctx.closePath();
  ctx.fill();
}

function arcadeIcon(ctx, x, y, color) {
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.fillRect(x - 10, y + 4, 20, 6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y - 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function gearIcon(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2, -11, 4, 6);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the truck's view

function drawView(ctx, state, at, here, items, hit, ui) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VW, MH);
  ctx.clip();
  const [r, g, b] = C.sky;
  const grad = ctx.createLinearGradient(0, 0, 0, MH);
  grad.addColorStop(0, `rgb(${r},${g},${b})`);
  grad.addColorStop(1, C.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, MH);

  // A camera 13 m behind the truck and 9 m up (parked, 7 m and 4.2 m), looking ahead and down: the next 100 m of curves show.
  const h = here.heading;
  const fx = Math.sin(h), fz = Math.cos(h);                // ahead
  const rx = Math.cos(h), rz = -Math.sin(h);               // right
  // Parked, closer in: there's no road to show, just the truck.
  const back = state.parked ? 7 : 13, high = state.parked ? 4.2 : 9;
  const cx = here.x - fx * back, cy = here.y + high, cz = here.z - fz * back;
  const pitch = 0.46, cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Right of the drive strip, above the media card.
  const F = 400, OX = VW / 2 + 16, OY = state.parked ? 236 : 290;
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
    strip(s0, s1, -6.4, 2.8, C.lane);
    line(s0, s1, -1.9, C.centre, 2.2);
    line(s0, s1, -1.7, C.centre, 2.2);
    line(s0, s1, 1.85, C.edge, 3);
    line(s0, s1, -5.45, C.edge, 3);
    if (state.running) {
      ctx.globalAlpha = 0.9;
      strip(state.s + 2.5, Math.min(state.s + 90, state.end), -0.55, 0.55, BLUE);
      ctx.globalAlpha = 1;
    }
  } else {
    // The floor: a faint grid going away, as the truck stands on in the real Park view.
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let k = -12; k <= 12; k += 2) {
      const a = project(here.x + k, 0, here.z - 6), z = project(here.x + k, 0, here.z + 40);
      if (!a || !z) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(z[0], z[1]);
      ctx.stroke();
    }
    for (let d = -6; d <= 40; d += 2) {
      const a = project(here.x - 12, 0, here.z + d), z = project(here.x + 12, 0, here.z + d);
      if (!a || !z) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(z[0], z[1]);
      ctx.stroke();
    }
  }
  const P = drawTruck(ctx, here, project, [0, high, ORIGIN_S + back]);
  // Fade the far road into the sky.
  const fade = ctx.createLinearGradient(0, 150, 0, 190);
  fade.addColorStop(0, `rgba(${r},${g},${b},1)`);
  fade.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, VW, 190);
  ctx.restore();

  if (state.parked) {
    // In Park, the truck's own closures, touched on the truck: where they are on it.
    const spots = [['Tonneau', [0, 1.62, 4.3]], ['Tailgate', [0, 0.95, TAIL_S + 0.1]]];
    for (const [name, at3] of spots) {
      const item = items.find((it) => it.label === name);
      const p = item && P(at3);
      if (!p) continue;
      const id = `spot-${name}`;
      const word = item.disabled ? (item.value.split(' · ')[0]) : item.active ? 'Close' : 'Open';
      ctx.font = `700 15px ${FONT}`;
      const w = Math.max(ctx.measureText(name).width, 40) + 24, hh = 44;
      const bx = p[0] - w / 2, by = p[1] - hh / 2;
      ctx.fillStyle = ui.hover === id ? 'rgba(62,106,225,0.9)' : 'rgba(20,22,25,0.72)';
      roundRect(ctx, bx, by, w, hh, 10);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = item.disabled ? '#9aa0a6' : '#c9ccd0';
      ctx.font = `500 12px ${FONT}`;
      ctx.fillText(word, p[0], by + 17, w - 8);
      ctx.fillStyle = item.disabled ? '#9aa0a6' : '#fff';
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(name, p[0], by + 35);
      if (!item.disabled) hit(bx, by, w, hh, id, item.onClick);
    }
    return;
  }

  // Speed, the limit, and whether it's driving itself.
  const mid = VW / 2 + 16;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.font = `700 72px ${FONT}`;
  ctx.fillText(String(Math.round(state.v * 2.23694)), mid, 116);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('MPH', mid, 138);
  sign(ctx, 84, 96);
  wheelIcon(ctx, VW - 52, 88, state.running ? BLUE : C.dim);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = state.running ? (C.name === 'dark' ? '#8fb0ff' : BLUE) : C.muted;
  ctx.fillText(state.running ? 'Self-driving' : state.done ? 'Parked' : state.paused ? (state.v > 0.05 ? 'Stopping' : 'Stopped') : 'Ready', VW - 52, 128);
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
 * Returns where a point on the truck ([w, h, s]) lands on the screen.
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
  fill([[-1.12, 0, 0.1], [1.12, 0, 0.1], [1.12, 0, 5.9], [-1.12, 0, 5.9]], C.shadow);
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
  const MID = [0, 0.9, 2.84];
  const R = RIGHT, L = LEFT;
  face([L.tailTop, R.tailTop, R.tailCorner, R.tailLow, L.tailLow, L.tailCorner], MID, STEEL);
  face([L.nose, R.nose, R.cowl, L.cowl], MID, STEEL);
  for (const S of [L, R]) {
    face([S.nose, S.noseCorner, S.fender, S.cowl], MID, STEEL);
    face([S.cowl, S.fender, S.beltA, S.apex], MID, STEEL);
    face([S.apex, S.beltC, S.tailCorner, S.tailTop], MID, STEEL);
    face([S.noseCorner, S.low, S.lowRear, S.tailLow, S.tailCorner, S.beltC, S.beltA, S.fender], MID, STEEL);
  }
  const deck = face([L.apex, R.apex, R.tailTop, L.tailTop], MID, STEEL);
  face([L.cowl, R.cowl, R.apex, L.apex], MID, GLASS, 0.25);
  for (const S of [L, R]) {
    // The side glass, inset in its facet.
    const mid = [0, 1, 2].map((i) => (S.apex[i] + S.beltA[i] + S.beltC[i]) / 3);
    const inset = (p) => p.map((v, i) => mid[i] + (v - mid[i]) * 0.82);
    if (facing([S.apex, S.beltA, S.beltC], MID)) fill([S.apex, S.beltA, S.beltC].map(inset), GLASS);
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
  return P;
}

function sign(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#17191c';
  ctx.lineWidth = 2.5;
  roundRect(ctx, x - 24, y - 36, 48, 62, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#17191c';
  ctx.textAlign = 'center';
  ctx.font = `700 9px ${FONT}`;
  ctx.fillText('SPEED', x, y - 21);
  ctx.fillText('LIMIT', x, y - 11);
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(String(LIMIT_MPH), x, y + 17);
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

function drawMap(ctx, state, road, here, map, trip, hit, ui) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(MX, 0, MW, MH);
  ctx.clip();
  ctx.fillStyle = C.map;
  ctx.fillRect(MX, 0, MW, MH);

  // Heading-up with the truck a little below the middle, or north-up with it in the middle; about 2.5 km across.
  const scale = 0.26;                                   // px per metre
  const ox = MX + MW / 2, oy = MH * (ui.northUp ? 0.55 : 0.64);
  const turn = ui.northUp ? 0 : -here.heading;
  const c = Math.cos(turn), s = Math.sin(turn);
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
    ctx.fillStyle = C.sea;
    for (const ring of map.sea) {
      path(ring);
      ctx.fill();
    }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const w of map.water) {
      if (!near(w.box)) continue;
      ctx.strokeStyle = C.creek;
      ctx.lineWidth = w.river ? 3 : 1.6;
      path(w.pts);
      ctx.stroke();
    }
    // Small roads first; each drawn as a casing with a lighter middle.
    const roads = map.roads.filter((r) => r.rank <= 3 && near(r.box)).sort((a, b) => b.rank - a.rank);
    for (const pass of [0, 1]) {
      for (const r of roads) {
        const width = [9, 7, 5, 3][r.rank];
        ctx.strokeStyle = pass ? (r.rank === 0 ? C.roadMain : C.road) : C.roadCase;
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
  routeLine(0, i0, C.behind, 7);
  routeLine(i0, iEnd, '#2b57c4', 10);
  routeLine(i0, iEnd, BLUE, 7);
  const [ex, ey] = T(road.px[iEnd], road.pz[iEnd]);
  pin(ctx, ex, ey);

  if (map) {
    ctx.font = `500 13px ${FONT}`;
    ctx.textAlign = 'left';
    const taken = [[MX, 0, MX + 330, 160]];             // label boxes, so none overlap (nor the turn card)
    for (const p of map.places) {
      if (!['cape', 'peak', 'viewpoint', 'islet', 'locality', 'lighthouse'].includes(p.kind)) continue;
      const [u, v] = T(p.x, p.z);
      if (u < MX + 10 || u > W - 10 || v < 20 || v > MH - 60) continue;
      const box = [u - 4, v - 10, u + 10 + ctx.measureText(p.name).width, v + 8];
      if (taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      taken.push(box);
      ctx.fillStyle = p.kind === 'islet' ? C.islet : C.dot;
      ctx.beginPath();
      ctx.arc(u, v, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.label;
      ctx.fillText(p.name, u + 6, v + 4);
    }
  }

  // The truck: a blue arrow, pointing up when heading-up, its way when north-up.
  ctx.save();
  ctx.translate(ox, oy);
  arrow(ctx, ui.northUp ? here.heading : 0);
  ctx.restore();

  // The turn card, top left: the manoeuvre and the road, then the arrival time, minutes, miles and energy left.
  const cx = MX + 14, cw = 316;
  ctx.fillStyle = 'rgba(24,26,29,0.96)';
  roundRect(ctx, cx, 14, cw, 108, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(cx, 82, cw, 1);
  ctx.save();
  ctx.translate(cx + 36, 48);
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
  ctx.font = `700 21px ${FONT}`;
  ctx.fillText(trip.done ? 'You have arrived' : miles(trip.left), cx + 66, 44);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = '#c9ccd0';
  ctx.fillText(trip.done ? DESTINATION : `Continue on ${ROAD_NAME}`, cx + 66, 67, cw - 80);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(trip.done ? 'Arrived' : `${trip.arrive}`, cx + 16, 107);
  const aw = ctx.measureText(trip.done ? 'Arrived' : trip.arrive).width;
  ctx.font = `500 14px ${FONT}`;
  ctx.fillStyle = '#a9aeb3';
  ctx.fillText(trip.done ? DESTINATION : `${Math.max(1, Math.round(trip.secs / 60))} min · ${miles(trip.left)}`, cx + 26 + aw, 107);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${trip.energy}%`, cx + cw - 14, 107);
  if (trip.next && !trip.done) {
    // The next named place on the way, and how far.
    const text = `${trip.next.name} · ${miles(trip.next.s - trip.s)}`;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'left';
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(24,26,29,0.86)';
    roundRect(ctx, cx, 130, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, cx + 12, 149);
  }

  compass(ctx, here.heading, hit, ui);
  ctx.font = `500 10px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = C.muted;
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
