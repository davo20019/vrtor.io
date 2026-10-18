// The board on the far wall: what the machine sees. Every sorted fruit is a dot placed by its two
// numbers (size across, colour up). Once there's a neuron, the background shows what it would say
// anywhere on the board (orange or apple, paler where it isn't sure) and a ring marks each fruit it
// gets wrong.
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import { SIZE_RANGE } from './data.js';

const W = 2048;
const H = 1100;
/** The plot inside the board, in texture pixels. */
const P = { left: 330, right: W - 70, top: 170, bottom: H - 130 };
const APPLE = [196, 46, 56];
const ORANGE = [240, 138, 28];

export function createBoard(scene, { width = 3.4, at = new Vector3(0, 2.3, 3.9) } = {}) {
  const height = (width * H) / W;
  const tex = new DynamicTexture('board', { width: W, height: H }, scene, true);
  tex.anisotropicFilteringLevel = 8;
  const m = new StandardMaterial('board', scene);
  m.diffuseTexture = tex;
  m.emissiveColor = Color3.White();
  m.disableLighting = true;
  const mesh = MeshBuilder.CreatePlane('board', { width, height }, scene);
  mesh.material = m;
  mesh.position.copyFrom(at);
  mesh.isPickable = false;

  // The shading is drawn small and scaled up, smooth, under the axes and dots.
  const shade = document.createElement('canvas');
  shade.width = 96;
  shade.height = 56;
  const sctx = shade.getContext('2d');
  const img = sctx.createImageData(shade.width, shade.height);

  /**
   * `points`: [{ size, hue, label: 'apple'|'orange', color: [r,g,b] 0..1, wrong }]. `predict(size, hue)`
   * gives the chance of orange (or null for no machine yet). `line`: [w1, w2] and the input mapping,
   * for the neuron's straight line. `hueRange`: the colour axis.
   */
  function draw({ title = '', subtitle = '', points = [], predict = null, hueRange, legend = true }) {
    const ctx = tex.getContext();
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(18, 18, W - 36, H - 36);
    const [s0, s1] = SIZE_RANGE;
    const [h0, h1] = hueRange;
    const X = (s) => P.left + ((s - s0) / (s1 - s0)) * (P.right - P.left);
    const Y = (h) => P.bottom - ((h - h0) / (h1 - h0)) * (P.bottom - P.top);

    if (predict) {
      for (let j = 0; j < shade.height; j++) {
        for (let i = 0; i < shade.width; i++) {
          const s = s0 + ((i + 0.5) / shade.width) * (s1 - s0);
          const h = h1 - ((j + 0.5) / shade.height) * (h1 - h0);
          const p = predict(s, h);
          const c = p >= 0.5 ? ORANGE : APPLE;
          // Sure: a clear tint. Unsure (near 50%): close to white.
          const k = 0.12 + 0.3 * Math.abs(p - 0.5) * 2;
          const o = (j * shade.width + i) * 4;
          img.data[o] = 251 + (c[0] - 251) * k;
          img.data[o + 1] = 250 + (c[1] - 250) * k;
          img.data[o + 2] = 247 + (c[2] - 247) * k;
          img.data[o + 3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(shade, P.left, P.top, P.right - P.left, P.bottom - P.top);
      // Where it changes its mind: the 50% line, traced from the same predictions at full resolution.
      ctx.strokeStyle = '#1d232b';
      ctx.lineWidth = 6;
      ctx.setLineDash([22, 14]);
      ctx.beginPath();
      const cols = 220;
      const rows = 140;
      const seg = [];
      for (let i = 0; i <= cols; i++) {
        const s = s0 + (i / cols) * (s1 - s0);
        let prev = predict(s, h0) - 0.5;
        for (let j = 1; j <= rows; j++) {
          const h = h0 + (j / rows) * (h1 - h0);
          const cur = predict(s, h) - 0.5;
          if (Math.sign(cur) !== Math.sign(prev)) seg.push([X(s), Y(h - (0.5 * (h1 - h0)) / rows)]);
          prev = cur;
        }
      }
      for (const [x, y] of seg) {
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axes, ticks and names.
    ctx.strokeStyle = '#59616b';
    ctx.lineWidth = 4;
    ctx.strokeRect(P.left, P.top, P.right - P.left, P.bottom - P.top);
    ctx.fillStyle = '#3a414a';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let s = Math.ceil(s0); s <= s1; s++) {
      ctx.fillText(`${s} cm`, X(s), P.bottom + 14);
    }
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText('Size (across)', (P.left + P.right) / 2, P.bottom + 64);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '600 36px system-ui, sans-serif';
    const hueStep = h1 - h0 > 60 ? 30 : 15;
    for (let h = h0; h <= h1; h += hueStep) {
      ctx.fillText(hueName(h), P.left - 18, Y(h));
      // A swatch of that hue at the axis.
      ctx.fillStyle = `hsl(${h} 85% 48%)`;
      ctx.fillRect(P.left - 12, Y(h) - 4, 10, 8);
      ctx.fillStyle = '#3a414a';
    }
    ctx.save();
    ctx.translate(46, (P.top + P.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText('Colour (up)', 0, 0);
    ctx.restore();

    for (const pt of points) {
      const x = X(pt.size);
      const y = Y(pt.hue);
      const r = 26;
      ctx.fillStyle = rgb(pt.color);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (pt.label === 'orange') ctx.arc(x, y, r, 0, Math.PI * 2);
      // Apples are drawn as diamonds, so the label reads without colour too.
      else {
        ctx.moveTo(x, y - r * 1.2);
        ctx.lineTo(x + r * 1.2, y);
        ctx.lineTo(x, y + r * 1.2);
        ctx.lineTo(x - r * 1.2, y);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      if (pt.wrong) {
        ctx.strokeStyle = '#d0112b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x, y, r + 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1d232b';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText(title, P.left, 86);
    ctx.font = '500 38px system-ui, sans-serif';
    ctx.fillStyle = '#4a525c';
    ctx.fillText(subtitle, P.left, 140);
    if (legend) {
      ctx.textAlign = 'right';
      ctx.font = '600 36px system-ui, sans-serif';
      ctx.fillStyle = '#3a414a';
      let x = P.right;
      const item = (text, shape) => {
        const w = ctx.measureText(text).width;
        ctx.fillText(text, x, 86);
        shape(x - w - 34, 74);
        x -= w + 90;
      };
      item('wrong', (cx, cy) => { ctx.strokeStyle = '#d0112b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke(); });
      item('labelled orange', (cx, cy) => { ctx.fillStyle = rgb([0.94, 0.54, 0.11]); ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a414a'; });
      item('labelled apple', (cx, cy) => { ctx.fillStyle = rgb([0.77, 0.18, 0.22]); ctx.beginPath(); ctx.moveTo(cx, cy - 19); ctx.lineTo(cx + 19, cy); ctx.lineTo(cx, cy + 19); ctx.lineTo(cx - 19, cy); ctx.fill(); ctx.fillStyle = '#3a414a'; });
    }
    tex.update(true);
  }

  return { mesh, draw };
}

const rgb = (c) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
function hueName(h) {
  if (h < 8) return 'red';
  if (h < 22) return 'red-orange';
  if (h < 38) return 'orange';
  if (h < 52) return 'orange-yellow';
  if (h < 75) return 'yellow';
  if (h < 105) return 'yellow-green';
  return 'green';
}
