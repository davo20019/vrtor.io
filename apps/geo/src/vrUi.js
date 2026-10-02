// The headset interface: controller models with laser pointers, a places menu you point
// at, and a wrist display on the left hand. Panels are drawn into canvas textures.
//
// The menu floats in front of you (it opens when you enter VR and with A, X or Y) and stays
// put in the world while open; point with either controller and pull the trigger to pick.
// The wrist display shows where you are, how high, the frame rate and the data credits.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const MENU_W = 1024;
const MENU_H = 1200;
const MENU_SIZE = 0.9; // metres across
const ACCENT = '#ffb020';

function canvasPanel(w, h, metresW) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(metresW, (metresW * h) / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  mesh.renderOrder = 999;
  return { c, g: c.getContext('2d'), tex, mesh };
}

function roundRect(g, x, y, w, h, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

export function createVrUi({ renderer, rig, camera, places, credits, onPick, onOrbit, onGrab, onRelease }) {
  // ---------- controllers ----------
  const factory = new XRControllerModelFactory();
  const hands = {}; // handedness → { ray, grip, laser, source }
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  for (let i = 0; i < 2; i++) {
    const ray = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(factory.createControllerModel(grip));
    const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.8, depthTest: false }));
    laser.renderOrder = 998;
    laser.scale.z = 3;
    laser.visible = false;
    ray.add(laser);
    rig.add(ray, grip);
    const hand = { ray, grip, laser, source: null, grabbing: false };
    // where this controller points, in world space (it points down its -Z)
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    hand.getRay = () => [ray.getWorldPosition(pos), ray.getWorldDirection(dir).negate()];
    ray.addEventListener('squeezestart', () => {
      hand.grabbing = true;
      onGrab(hand.getRay);
    });
    ray.addEventListener('squeezeend', () => {
      hand.grabbing = false;
      onRelease(hand.getRay);
    });
    ray.addEventListener('connected', (e) => {
      hand.source = e.data;
      hands[e.data.handedness] = hand;
      if (e.data.handedness === 'left') grip.add(wrist.mesh);
    });
    ray.addEventListener('disconnected', () => {
      if (hand.source) delete hands[hand.source.handedness];
      hand.source = null;
    });
    ray.addEventListener('selectstart', () => {
      if (!menu.mesh.visible || hand.hover == null) return;
      // this trigger pull was a click: don't let it start flying until it's released
      hand.suppress = true;
      click(hand.hover);
    });
  }

  // ---------- menu ----------
  const menu = canvasPanel(MENU_W, MENU_H, MENU_SIZE);
  menu.mesh.visible = false;
  rig.add(menu.mesh);

  // Button layout in canvas pixels: the places in a 3-column grid, then the actions.
  const buttons = [];
  const cols = 3;
  const bw = 296, bh = 92, gap = 18, left = (MENU_W - (cols * bw + (cols - 1) * gap)) / 2, top = 150;
  places.forEach((p, i) => {
    const r = Math.floor(i / cols), col = i % cols;
    buttons.push({ id: i, label: p.name, x: left + col * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh });
  });
  const rows = Math.ceil(places.length / cols);
  const actionsY = top + rows * (bh + gap) + 14;
  buttons.push({ id: 'orbit', label: 'Back to orbit', x: left, y: actionsY, w: bw * 1.5 + gap / 2, h: bh });
  buttons.push({ id: 'close', label: 'Close', x: left + bw * 1.5 + gap * 1.5, y: actionsY, w: bw * 1.5 + gap / 2, h: bh });

  let current = 0;
  let hoverIds = new Set();
  function drawMenu() {
    const { g } = menu;
    g.clearRect(0, 0, MENU_W, MENU_H);
    roundRect(g, 0, 0, MENU_W, MENU_H, 48, 'rgba(12,13,18,0.9)');
    g.fillStyle = ACCENT;
    g.font = '600 30px system-ui, sans-serif';
    g.fillText('EARTH · EXPERIMENT', 54, 70);
    g.fillStyle = '#f4f1ea';
    g.font = '700 50px system-ui, sans-serif';
    g.fillText('Where to?', 54, 124);
    for (const b of buttons) {
      const hot = hoverIds.has(b.id);
      const on = b.id === current;
      roundRect(g, b.x, b.y, b.w, b.h, b.h / 2, on ? ACCENT : hot ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)');
      g.fillStyle = on ? '#14100a' : '#f4f1ea';
      g.font = '600 36px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 13, b.w - 30);
      g.textAlign = 'left';
    }
    const legendY = actionsY + bh + 62;
    g.fillStyle = '#c9c4ba';
    g.font = '30px system-ui, sans-serif';
    [
      'Trigger: pick here · out there, hold it to fly where you point',
      'Grip: grab the Earth and drag it · both grips: pull apart to zoom in',
      'Right stick: forward to zoom toward where you point, back to zoom out',
      'Left stick: move · Right stick sideways: turn',
      'A, X or Y: this menu · B: back to orbit',
    ].forEach((line, i) => g.fillText(line, 54, legendY + i * 44, MENU_W - 108));
    g.fillStyle = '#8f8a80';
    g.font = '20px system-ui, sans-serif';
    wrapText(g, credits, 54, MENU_H - 70, MENU_W - 108, 26);
    menu.tex.needsUpdate = true;
  }

  function wrapText(g, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
    lines.forEach((l, i) => g.fillText(l, x, y + i * lineH));
  }

  const _head = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _local = new THREE.Vector3();
  function openMenu() {
    // 1 m in front of where you're looking, a little below eye level, facing you.
    camera.getWorldPosition(_head);
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _local.copy(_head).addScaledVector(_fwd, 1.0);
    _local.y -= 0.15;
    rig.worldToLocal(_local);
    menu.mesh.position.copy(_local);
    menu.mesh.visible = true;
    menu.mesh.updateMatrixWorld();
    menu.mesh.lookAt(_head);
    drawMenu();
  }
  function closeMenu() {
    menu.mesh.visible = false;
  }
  function click(id) {
    if (id === 'close') closeMenu();
    else if (id === 'orbit') {
      closeMenu();
      onOrbit();
    } else {
      closeMenu();
      onPick(id);
    }
  }

  // ---------- wrist ----------
  const wrist = canvasPanel(640, 300, 0.17);
  // On top of the left controller, tilted toward your eyes when you raise your hand.
  wrist.mesh.position.set(0, 0.05, 0.02);
  wrist.mesh.rotation.x = -0.9;
  let wristLast = '';
  function drawWrist(lines) {
    const key = lines.join('\n');
    if (key === wristLast) return;
    wristLast = key;
    const { g, c } = wrist;
    g.clearRect(0, 0, c.width, c.height);
    roundRect(g, 0, 0, c.width, c.height, 32, 'rgba(12,13,18,0.88)');
    lines.forEach((line, i) => {
      g.fillStyle = i === 0 ? ACCENT : i === lines.length - 1 ? '#8f8a80' : '#f4f1ea';
      g.font = i === 0 ? '600 44px system-ui, sans-serif' : i === lines.length - 1 ? '24px system-ui, sans-serif' : '36px system-ui, sans-serif';
      g.fillText(line, 30, 62 + i * 58, c.width - 60);
    });
    wrist.tex.needsUpdate = true;
  }

  // ---------- per frame ----------
  const raycaster = new THREE.Raycaster();
  return {
    // getRay of a controller by handedness ('left' | 'right'), if connected
    rayOf(handedness) {
      return hands[handedness]?.getRay;
    },
    get menuOpen() {
      return menu.mesh.visible;
    },
    openMenu,
    closeMenu,
    toggleMenu() {
      if (menu.mesh.visible) closeMenu();
      else openMenu();
    },
    setCurrent(i) {
      current = i;
      if (menu.mesh.visible) drawMenu();
    },
    setStatus(lines) {
      drawWrist(lines);
    },
    // The controller that is flying you, if its trigger is held (menu closed).
    flyPointer() {
      if (menu.mesh.visible) return null;
      let best = null;
      for (const hand of Object.values(hands)) {
        const v = hand.source?.gamepad?.buttons[0]?.value ?? 0;
        if (hand.suppress) continue;
        if (v > 0.1 && (!best || v > best.value)) best = { ray: hand.ray, value: v };
      }
      return best;
    },
    update() {
      const nextHover = new Set();
      for (const hand of Object.values(hands)) {
        hand.hover = null;
        const trigger = hand.source?.gamepad?.buttons[0]?.value ?? 0;
        if (hand.suppress && trigger < 0.1) hand.suppress = false;
        const flying = trigger > 0.1 && !hand.suppress;
        hand.laser.visible = menu.mesh.visible || flying || hand.grabbing;
        hand.laser.scale.z = 3;
        if (!menu.mesh.visible) continue;
        raycaster.setFromXRController(hand.ray);
        const hit = raycaster.intersectObject(menu.mesh, false)[0];
        if (!hit) continue;
        hand.laser.scale.z = hit.distance;
        const px = hit.uv.x * MENU_W;
        const py = (1 - hit.uv.y) * MENU_H;
        const b = buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
        if (b) {
          hand.hover = b.id;
          nextHover.add(b.id);
        }
      }
      const changed = nextHover.size !== hoverIds.size || [...nextHover].some((id) => !hoverIds.has(id));
      hoverIds = nextHover;
      if (changed && menu.mesh.visible) drawMenu();
    },
  };
}
