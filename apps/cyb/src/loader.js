// The wait for the self-driving ride, drawn: the truck in profile drives along Highway 1 as the coast
// downloads, from Bixby Creek Bridge to the Little Sur River, its light bar on and its wheels turning,
// the hills going by behind it. One drawing for the centre screen, the card on flat screens and a strip
// over the card in the headset, so the wait looks the same wherever you are.
import { DynamicTexture, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

/** The truck's side, rear at x 0 and ground at y 0, in metres: 5.68 m long, 1.79 m to the roof's peak. */
const LENGTH = 5.68;
const BODY = [
  [0.06, 0.52], [0, 1.1], [2.75, 1.79], [5.62, 1.06], [5.68, 0.98], [5.58, 0.55],
  // The front wheel's arch, then the rear's: angular, like the truck's.
  [5.36, 0.55], [5.22, 0.92], [4.26, 0.92], [4.12, 0.55],
  [1.55, 0.55], [1.41, 0.92], [0.45, 0.92], [0.31, 0.55],
];
const GLASS = [[1.5, 1.25], [1.5, 1.4], [2.75, 1.7], [4.2, 1.33], [4.2, 1.25]];
const ARCHES = [[[5.36, 0.55], [5.22, 0.92], [4.26, 0.92], [4.12, 0.55]], [[1.55, 0.55], [1.41, 0.92], [0.45, 0.92], [0.31, 0.55]]];
const AXLES = [0.93, 4.74];
const TYRE = 0.445;

const THEMES = {
  light: { ink: '#17191c', dim: 'rgba(23,25,28,0.18)', hills: ['rgba(80,110,90,0.16)', 'rgba(80,110,90,0.28)'], sea: 'rgba(61,111,224,0.12)', lit: '#3d6fe0', steel: ['#e4e6e8', '#a7acb1'], edge: '#6b7075' },
  dark: { ink: '#f3f4f6', dim: 'rgba(255,255,255,0.16)', hills: ['rgba(150,175,160,0.10)', 'rgba(150,175,160,0.18)'], sea: 'rgba(90,140,230,0.14)', lit: '#ffb020', steel: ['#d9dcdf', '#8f959b'], edge: '#3e4246' },
};

/**
 * Draws the loader into the box (x, y, w, h) of a 2D context: progress 0 to 1 is how far along the
 * road the truck has got; t (seconds) keeps it moving while the bytes are slow.
 */
export function drawLoader(ctx, x, y, w, h, { progress = 0, t = 0, theme = 'dark' } = {}) {
  const c = THEMES[theme];
  const p = Math.max(0, Math.min(1, progress));
  const pad = Math.min(w, h) * 0.12;
  const ground = y + h * 0.8;
  const L = Math.min(w * 0.34, h * 1.6);
  const s = L / LENGTH;
  const x0 = x + pad, x1 = x + w - pad;
  const rear = x0 + p * (x1 - x0 - L);
  const nose = rear + L;
  const speed = L * 0.9;                               // px a second, for the wheels and the hills
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // The coast going by: two ridges, the far one slower, and the sea below the road.
  ridge(ctx, x, w, ground - h * 0.18, h * 0.22, t * speed * 0.08, 0.011 / s, c.hills[0]);
  ridge(ctx, x, w, ground - h * 0.04, h * 0.16, t * speed * 0.2, 0.019 / s, c.hills[1]);
  ctx.fillStyle = c.sea;
  ctx.fillRect(x, ground + 2, w, h);

  // The road: lit as far as the truck has come, dashed beyond, a flag at the river.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, h * 0.025);
  ctx.strokeStyle = c.dim;
  ctx.setLineDash([h * 0.06, h * 0.06]);
  ctx.lineDashOffset = t * speed * 0.5;
  line(ctx, nose, ground, x1, ground);
  ctx.setLineDash([]);
  ctx.strokeStyle = c.lit;
  line(ctx, x0, ground, nose, ground);
  ctx.fillStyle = c.lit;
  dot(ctx, x0, ground, h * 0.03);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(1.5, h * 0.012);
  line(ctx, x1, ground, x1, ground - h * 0.2);
  ctx.fillStyle = c.lit;
  ctx.beginPath();
  ctx.moveTo(x1, ground - h * 0.2);
  ctx.lineTo(x1 + h * 0.1, ground - h * 0.165);
  ctx.lineTo(x1, ground - h * 0.13);
  ctx.fill();

  const X = (m) => rear + m * s;
  const Y = (m) => ground - m * s;
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))));
    ctx.closePath();
  };

  // Speed lines trailing off the tailgate.
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.6 + i / 3) % 1;
    ctx.strokeStyle = c.dim;
    ctx.globalAlpha = 1 - k;
    const ly = Y([1.25, 0.95, 0.65][i]);
    const lx = X(-0.3) - k * L * 0.5;
    line(ctx, lx - L * 0.18, ly, lx, ly);
  }
  ctx.globalAlpha = 1;

  // The light bar's beam on the road ahead, breathing.
  const glow = 0.55 + 0.45 * Math.sin(t * 3);
  const beam = ctx.createLinearGradient(X(5.66), 0, X(5.66) + L * 0.7, 0);
  beam.addColorStop(0, `rgba(255,250,235,${0.35 * glow})`);
  beam.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(X(5.66), Y(1.04));
  ctx.lineTo(X(5.66) + L * 0.7, ground);
  ctx.lineTo(X(5.66) + L * 0.7, Y(1.3));
  ctx.closePath();
  ctx.fill();

  // Shadow, body, glass, the black arches.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(X(2.84), ground + s * 0.04, L * 0.52, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  const steel = ctx.createLinearGradient(0, Y(1.79), 0, Y(0.5));
  steel.addColorStop(0, c.steel[0]);
  steel.addColorStop(1, c.steel[1]);
  poly(BODY);
  ctx.fillStyle = steel;
  ctx.fill();
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.lineJoin = 'round';
  ctx.stroke();
  poly(GLASS);
  ctx.fillStyle = '#1f2326';
  ctx.fill();
  ctx.strokeStyle = c.steel[1];
  ctx.lineWidth = Math.max(1, s * 0.06);
  line(ctx, X(2.95), Y(1.25), X(2.95), Y(1.65));       // the B pillar
  ctx.strokeStyle = '#26282b';
  ctx.lineWidth = Math.max(2, s * 0.12);
  for (const arch of ARCHES) {
    ctx.beginPath();
    arch.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))));
    ctx.stroke();
  }

  // Wheels: the tyre and its aero cover, turning as it rolls.
  const turn = (t * speed) / (TYRE * s);
  for (const ax of AXLES) {
    const cx = X(ax), cy = Y(TYRE);
    ctx.fillStyle = '#1b1d20';
    dot(ctx, cx, cy, TYRE * s);
    ctx.fillStyle = '#9ba1a7';
    dot(ctx, cx, cy, TYRE * s * 0.7);
    ctx.strokeStyle = '#5d6369';
    ctx.lineWidth = Math.max(1, s * 0.035);
    for (let k = 0; k < 6; k++) {
      const a = turn + (k * Math.PI) / 3;
      line(ctx, cx + Math.cos(a) * TYRE * s * 0.18, cy + Math.sin(a) * TYRE * s * 0.18, cx + Math.cos(a) * TYRE * s * 0.66, cy + Math.sin(a) * TYRE * s * 0.66);
    }
    ctx.fillStyle = '#2b2e32';
    dot(ctx, cx, cy, TYRE * s * 0.16);
  }

  // The light bar across the nose, and the red one across the tailgate.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.shadowColor = 'rgba(255,248,230,0.9)';
  ctx.shadowBlur = s * 0.5 * glow;
  ctx.strokeStyle = '#fffaf0';
  line(ctx, X(5.3), Y(1.14), X(5.64), Y(1.05));
  ctx.shadowColor = 'rgba(255,40,30,0.9)';
  ctx.strokeStyle = '#ff3b2f';
  line(ctx, X(0.02), Y(1.08), X(0.3), Y(1.15));
  ctx.restore();
}

/**
 * The loader for the headset: a strip that sits just above the card (`cardMesh`, `cardWidth` by
 * `cardHeight` metres) and moves with it. show(progress) draws a frame; hide() puts it away.
 */
export function createLoaderStrip(scene, cardMesh, { cardWidth = 0.8, cardHeight = 0.56 } = {}) {
  const TW = 1024, TH = 300;
  const h = (cardWidth * TH) / TW;
  const plane = MeshBuilder.CreatePlane('ride-loader', { width: cardWidth, height: h }, scene);
  plane.parent = cardMesh;
  plane.position.y = cardHeight / 2 + h / 2 + 0.015;
  plane.renderingGroupId = cardMesh.renderingGroupId;
  plane.isPickable = false;
  const tex = new DynamicTexture('ride-loader', { width: TW, height: TH }, scene, true);
  tex.hasAlpha = true;
  const mat = new StandardMaterial('ride-loader', scene);
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  mat.opacityTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  plane.material = mat;
  plane.setEnabled(false);
  const ctx = tex.getContext();
  return {
    show(progress) {
      plane.renderingGroupId = cardMesh.renderingGroupId;
      plane.setEnabled(true);
      ctx.clearRect(0, 0, TW, TH);
      ctx.fillStyle = 'rgba(12,13,18,0.94)';
      roundRect(ctx, 3, 3, TW - 6, TH - 6, 54);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,32,0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
      drawLoader(ctx, 0, 0, TW, TH, { progress, t: performance.now() / 1000 });
      tex.update();
    },
    hide() {
      plane.setEnabled(false);
    },
  };
}

function ridge(ctx, x, w, base, amp, offset, freq, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, base + amp * 2);
  for (let px = 0; px <= w; px += 6) {
    const u = (px + offset) * freq;
    const v = 0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1 + 0.4);
    ctx.lineTo(x + px, base - amp * (0.5 + 0.5 * v));
  }
  ctx.lineTo(x + w, base + amp * 2);
  ctx.closePath();
  ctx.fill();
}

function line(ctx, ax, ay, bx, by) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

function dot(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
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
