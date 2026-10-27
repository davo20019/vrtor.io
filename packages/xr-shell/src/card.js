// A floating info card for the headset: kicker, title, text, an optional fact
// and buttons, with a thin line to what it describes. Under it, an optional
// strip of tools: the headset's stand-in for the page's control bar, which
// isn't visible in VR (play the flight, put the skin on, change the light). On flat screens the
// subjects show the same content as an HTML card instead (crisper, and it
// doesn't block the view).
import { Color3, Matrix, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import { headsetNote } from './headsetLog.js';
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from '@babylonjs/gui';

const ACCENT = '#ffb020';
/** Layout width in GUI pixels; the texture itself is drawn TEX_SCALE times larger. */
const TEX_WIDTH = 1024;
/**
 * Texel density over the layout: at 1.5x the card holds ~1900 texels per
 * metre, more than the headset resolves at reading distance, and trilinear
 * mipmaps with anisotropy keep it clean when seen at a slant.
 */
const TEX_SCALE = 1.5;
const PAD = 56;
/** A layout size in texture pixels. */
const px = (n) => `${n * TEX_SCALE}px`;
const sz = (n) => n * TEX_SCALE;

/** Stretches an updatable plane from height `from` to `to` (m), about its middle. */
function resizePlane(plane, from, to) {
  const p = plane.getVerticesData('position');
  for (let i = 1; i < p.length; i += 3) p[i] *= to / from;
  plane.updateVerticesData('position', p);
  plane.refreshBoundingInfo();
}
/** The tool strip's height (m) for one row of tools, and its gap under the card. */
const BAR_HEIGHT = 0.1;
const BAR_GAP = 0.02;
/** A row of buttons, in layout pixels: the button and the space under it. */
const ROW = 104;
/** The tallest a card grows to fit what it says (m); past that its foot overlaps the text. */
const MAX_HEIGHT = 1.25;
/** The handle along the card's top edge: its size and its gap above the card (m). */
const HANDLE_WIDTH = 0.16;
const HANDLE_HEIGHT = 0.014;
const HANDLE_GAP = 0.02;
/** How long the card takes to glide to a new place when it's already showing (s). */
const GLIDE_SECONDS = 0.35;

/** A rounded button that acts on release, and only for a press that began on it. */
function makeButton(id, { label, primary, onClick }, width, fontSize = 34) {
  const button = Button.CreateSimpleButton(id, label);
  button.width = px(width);
  button.height = px(92);
  button.paddingLeft = px(16);
  button.cornerRadius = sz(46);
  button.thickness = primary ? 0 : sz(3);
  button.color = primary ? '#14100a' : '#ffffff';
  button.background = primary ? ACCENT : 'rgba(255,255,255,0.06)';
  button.fontSize = sz(fontSize);
  button.fontWeight = '600';
  const idle = button.background;
  button.onPointerEnterObservable.add(() => (button.background = primary ? '#ffc65a' : 'rgba(255,255,255,0.2)'));
  button.onPointerOutObservable.add(() => (button.background = idle));
  // Releasing over another button after the ray drifted must not trigger that one too.
  let armed = false;
  button.onPointerDownObservable.add(() => {
    armed = true;
    headsetNote('card button down', { button: id });
  });
  button.onPointerUpObservable.add(() => {
    headsetNote('card button up', { button: id, armed });
    if (!armed) return;
    armed = false;
    onClick();
  });
  return button;
}

export function createCard(scene, { width = 0.8, height = 0.56, name = 'card' } = {}) {
  // Updatable: the card grows taller when what it says doesn't fit (fit(), below), never smaller than `height`.
  const plane = MeshBuilder.CreatePlane(name, { width, height, updatable: true }, scene);
  let cardHeight = height;
  // Group 2 draws after the world with its own depth: the card is never buried in the rover.
  plane.renderingGroupId = 2;
  plane.rotationQuaternion = Quaternion.Identity();
  plane.setEnabled(false);
  const texHeight = Math.round((TEX_WIDTH * height) / width);
  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_WIDTH * TEX_SCALE, texHeight * TEX_SCALE, true, false, true);
  ui.anisotropicFilteringLevel = 16;
  // A card that grows is redrawn whole: the GUI's redraw of only what changed left the new part blank.
  ui.useInvalidateRectOptimization = false;

  const bg = new Rectangle(`${name}-bg`);
  bg.thickness = sz(3);
  bg.color = 'rgba(255,176,32,0.55)';
  bg.cornerRadius = sz(36);
  bg.background = 'rgba(12,13,18,0.94)';
  ui.addControl(bg);

  const textWidth = TEX_WIDTH - 2 * PAD;
  const stack = new StackPanel(`${name}-text`);
  stack.isVertical = true;
  stack.width = px(textWidth);
  stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  stack.top = px(PAD - 8);
  bg.addControl(stack);

  const text = (id, size, color, weight = 'normal') => {
    const t = new TextBlock(`${name}-${id}`);
    t.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    t.fontSize = sz(size);
    t.fontWeight = weight;
    t.color = color;
    t.textWrapping = true;
    t.resizeToFit = true;
    t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.width = px(textWidth);
    stack.addControl(t);
    return t;
  };
  const kicker = text('kicker', 30, ACCENT, '600');
  const title = text('title', 62, '#ffffff', '700');
  title.paddingTop = px(4);
  const body = text('body', 36, '#dfe2ea');
  body.paddingTop = px(18);
  const fact = text('fact', 32, '#ffd27a');
  fact.paddingTop = px(30);
  // Choices: a grid of buttons under the text, two to a row (a list of places to go).
  const grid = new StackPanel(`${name}-choices`);
  grid.isVertical = true;
  grid.width = px(textWidth);
  grid.paddingTop = px(24);
  stack.addControl(grid);

  // The buttons along the foot, right-aligned: one row, or two when they don't fit in one.
  const rows = new StackPanel(`${name}-actions`);
  rows.isVertical = true;
  rows.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  rows.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  rows.paddingRight = px(PAD - 16);
  rows.paddingBottom = px(28);
  bg.addControl(rows);
  const ROW_WIDTH = TEX_WIDTH - 2 * (PAD - 16);
  rows.width = px(ROW_WIDTH + PAD - 16);   // its right padding comes out of its width
  /** A button as wide as its label needs. */
  const wantWidth = (a) => Math.max(a.primary ? 250 : 200, a.label.length * 19 + 80);
  /** Buttons in rows, each as wide as its label needs: a row takes buttons until the next doesn't fit. */
  const pack = (widths, room) => {
    const groups = [];
    let row = [], used = 0;
    widths.forEach((w, i) => {
      if (row.length && used + w > room) {
        groups.push(row);
        row = [];
        used = 0;
      }
      row.push(i);
      used += w;
    });
    if (row.length) groups.push(row);
    return groups;
  };
  let actionRows = 0;
  const setActions = (actions) => {
    rows.clearControls();
    const want = actions.map((a) => Math.min(ROW_WIDTH, wantWidth(a)));
    const groups = pack(want, ROW_WIDTH);
    actionRows = groups.length;
    rows.height = px(groups.length * ROW + 12 + 28);   // its bottom padding comes out of its height
    groups.forEach((group, g) => {
      const line = new StackPanel(`${name}-actions-${g}`);
      line.isVertical = false;
      line.height = px(ROW);
      line.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      for (const i of group) line.addControl(makeButton(`${name}-${actions[i].label}`, actions[i], want[i]));
      rows.addControl(line);
    });
  };

  const closeButton = Button.CreateSimpleButton(`${name}-close`, '×');
  closeButton.width = px(84);
  closeButton.height = px(84);
  closeButton.top = px(20);
  closeButton.left = px(-20);
  closeButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  closeButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  closeButton.color = '#ffffff';
  closeButton.background = 'rgba(255,255,255,0.08)';
  closeButton.cornerRadius = sz(42);
  closeButton.thickness = sz(2);
  closeButton.fontSize = sz(48);
  closeButton.isVisible = false;
  let onClose = null, closeArmed = false;
  closeButton.onPointerDownObservable.add(() => (closeArmed = true));
  closeButton.onPointerOutObservable.add(() => (closeArmed = false));
  closeButton.onPointerUpObservable.add(() => {
    if (!closeArmed) return;
    closeArmed = false;
    onClose?.();
  });
  bg.addControl(closeButton);

  // The tool strip, hung under the card (it moves and hides with it).
  const bar = MeshBuilder.CreatePlane(`${name}-bar`, { width, height: BAR_HEIGHT, updatable: true }, scene);
  bar.renderingGroupId = 2;
  bar.parent = plane;
  bar.position.y = -(height / 2 + BAR_GAP + BAR_HEIGHT / 2);
  bar.setEnabled(false);
  const barTexHeight = Math.round((TEX_WIDTH * BAR_HEIGHT) / width);
  const barUi = AdvancedDynamicTexture.CreateForMesh(bar, TEX_WIDTH * TEX_SCALE, barTexHeight * TEX_SCALE, true, false, true);
  barUi.anisotropicFilteringLevel = 16;
  barUi.useInvalidateRectOptimization = false;
  const barBg = new Rectangle(`${name}-bar-bg`);
  barBg.thickness = sz(3);
  barBg.color = 'rgba(255,176,32,0.35)';
  barBg.cornerRadius = sz(barTexHeight / 2);
  barBg.background = 'rgba(12,13,18,0.94)';
  barUi.addControl(barBg);
  const toolRows = new StackPanel(`${name}-tools`);
  toolRows.isVertical = true;
  barBg.addControl(toolRows);
  const barRowM = (ROW * width) / TEX_WIDTH;
  let barHeight = BAR_HEIGHT;
  const placeBar = () => {
    bar.position.y = -(cardHeight / 2 + BAR_GAP + barHeight / 2);
    handle.position.y = cardHeight / 2 + HANDLE_GAP + HANDLE_HEIGHT / 2;
  };
  // A handle along the top edge, as on a window: the card can be taken anywhere with the grip
  // (menu.js), and this says so. It lights up while pointed at or held.
  const handle = MeshBuilder.CreatePlane(`${name}-handle`, { width: HANDLE_WIDTH, height: HANDLE_HEIGHT }, scene);
  handle.renderingGroupId = 2;
  handle.parent = plane;
  const handleMat = new StandardMaterial(`${name}-handle`, scene);
  handleMat.disableLighting = true;
  handleMat.emissiveColor = Color3.FromHexString('#c9c4bc');
  handleMat.alpha = 0.55;
  handleMat.backFaceCulling = false;
  handle.material = handleMat;
  placeBar();
  let handleLit = false;
  const litHandle = (on) => {
    if (on === handleLit) return;
    handleLit = on;
    handleMat.emissiveColor = Color3.FromHexString(on ? ACCENT : '#c9c4bc');
    handleMat.alpha = on ? 0.95 : 0.55;
  };
  const setTools = (tools) => {
    bar.setEnabled(tools.length > 0);
    toolRows.clearControls();
    // Each button as wide as its label needs; tools that don't fit in one row go on to a second, full size.
    const want = tools.map((t) => Math.max(200, t.label.length * 19 + 70));
    const groups = pack(want, TEX_WIDTH - 40);
    const height = BAR_HEIGHT + (Math.max(1, groups.length) - 1) * barRowM;
    if (Math.abs(height - barHeight) > 1e-4) {
      resizePlane(bar, barHeight, height);
      barHeight = height;
      const texHeight = Math.round((TEX_WIDTH * height) / width);
      barUi.scaleTo(TEX_WIDTH * TEX_SCALE, Math.round(texHeight * TEX_SCALE));
      barBg.cornerRadius = sz(Math.round((TEX_WIDTH * BAR_HEIGHT) / width) / 2);
      placeBar();
    }
    toolRows.height = px(groups.length * ROW);
    groups.forEach((group, g) => {
      const line = new StackPanel(`${name}-tools-${g}`);
      line.isVertical = false;
      line.height = px(ROW);
      for (const i of group) line.addControl(makeButton(`${name}-tool-${tools[i].label}`, tools[i], want[i]));
      toolRows.addControl(line);
    });
    barUi.markAsDirty();
  };

  // Growing to fit: after the GUI lays the text out, the card is made as tall as its text, choices and buttons
  // need (the next frame: a texture can't be resized in the middle of its own layout).
  let wanted = null;
  ui.onEndLayoutObservable.add(() => {
    const need = PAD - 8 + stack.heightInPixels / TEX_SCALE + 24 + actionRows * ROW + 12 + 28;
    const h = Math.min(MAX_HEIGHT, Math.max(height, (need * width) / TEX_WIDTH));
    if (Math.abs(h - cardHeight) > 0.004) wanted = h;
  });
  scene.onBeforeRenderObservable.add(() => {
    if (wanted === null) return;
    const h = wanted;
    wanted = null;
    resizePlane(plane, cardHeight, h);
    cardHeight = h;
    ui.scaleTo(TEX_WIDTH * TEX_SCALE, Math.round(((TEX_WIDTH * h) / width) * TEX_SCALE));
    ui.markAsDirty();
    placeBar();
    if (plane.isEnabled()) drawLine(lineTarget);
  });

  // A line from the card's lower edge (or the strip's, under it) to what it describes.
  let line = null;
  const linePoints = [Vector3.Zero(), Vector3.Zero()];
  const drawLine = (target) => {
    if (!target) {
      line?.setEnabled(false);
      return;
    }
    const below = bar.isEnabled() ? cardHeight / 2 + BAR_GAP + barHeight : cardHeight / 2;
    const down = plane.getDirection(Vector3.Down()).scale(below);
    linePoints[0] = plane.getAbsolutePosition().add(down);
    linePoints[1] = target;
    line = MeshBuilder.CreateLines(`${name}-line`, { points: linePoints, updatable: true, instance: line ?? undefined }, scene);
    line.color = Color3.FromHexString(ACCENT);
    line.alpha = 0.8;
    line.isPickable = false;
    line.renderingGroupId = 2;
    line.setEnabled(true);
  };

  // Moving an open card: it glides there in its parent's frame (so a card riding in a moving
  // vehicle glides with it), its line following.
  let glide = null;
  let lineTarget = null;
  /** Moved by hand (moveTo): it stays there, whatever place() asks, until unpinned or hidden. */
  let pinned = false;
  /** A world position and a facing (a horizontal direction away from the viewer) into the parent's frame. */
  const toLocal = (pos, f) => {
    const rot = Quaternion.RotationYawPitchRoll(Math.atan2(f.x, f.z), 0, 0);
    const p = pos.clone();
    if (plane.parent) {
      const inv = Matrix.Invert(plane.parent.computeWorldMatrix(true));
      Vector3.TransformCoordinatesToRef(p, inv, p);
      const parentRot = new Quaternion();
      inv.decompose(undefined, parentRot);
      parentRot.multiplyToRef(rot, rot);
    }
    return { p, rot };
  };
  scene.onBeforeRenderObservable.add(() => {
    if (!glide) return;
    glide.t = Math.min(1, glide.t + scene.getEngine().getDeltaTime() / 1000 / GLIDE_SECONDS);
    const e = glide.t * glide.t * (3 - 2 * glide.t);
    Vector3.LerpToRef(glide.p0, glide.p1, e, plane.position);
    Quaternion.SlerpToRef(glide.q0, glide.q1, e, plane.rotationQuaternion);
    if (glide.t >= 1) glide = null;
    plane.computeWorldMatrix(true);
    drawLine(lineTarget);
  });

  return {
    mesh: plane,
    /** The mesh and its GUI texture, for compositing as a quad layer (see layers.js). */
    panel: { mesh: plane, ui },
    /** Both panels to composite: the card and its tool strip. */
    panels: [
      { mesh: plane, ui },
      { mesh: bar, ui: barUi },
    ],
    /** { kicker, title, body, fact, actions: [{ label, primary, onClick }], choices?, tools?: (the same, in a grid and in the strip), onClose? } */
    setContent({ kicker: k = '', title: t = '', body: b = '', fact: f = '', actions = [], choices = [], tools = [], onClose: close = null }) {
      onClose = close;
      closeButton.isVisible = typeof close === 'function';
      kicker.width = px(textWidth - (closeButton.isVisible ? 84 : 0));
      kicker.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      title.width = px(textWidth - (closeButton.isVisible ? 84 : 0));
      title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      kicker.text = k.toUpperCase();
      title.text = t;
      body.text = b;
      fact.text = f;
      fact.isVisible = !!f;
      setActions(actions);
      grid.clearControls();
      grid.isVisible = choices.length > 0;
      for (let i = 0; i < choices.length; i += 2) {
        const line = new StackPanel(`${name}-choices-${i}`);
        line.isVertical = false;
        line.height = px(104);
        line.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        for (const choice of choices.slice(i, i + 2)) line.addControl(makeButton(`${name}-choice-${choice.label}`, choice, textWidth / 2));
        grid.addControl(line);
      }
      setTools(tools);
    },
    /**
     * Puts the card `distance` metres in front of the head along `forward`
     * (flattened), a little below the eyes, turned to face the viewer, with its
     * line to `target` (or none). A card already showing glides there unless `glide` is false.
     * Positions are in the world; a card with a parent stays in the parent's frame.
     */
    place(head, forward, target = null, { distance = 1.15, drop = 0.18, glide: smooth = true } = {}) {
      // Put somewhere by hand: it stays, and only its line follows what it now describes.
      if (pinned && plane.isEnabled()) {
        lineTarget = target;
        drawLine(target);
        return;
      }
      pinned = false;
      const f = new Vector3(forward.x, 0, forward.z);
      if (f.lengthSquared() < 1e-6) f.set(0, 0, 1);
      f.normalize();
      const pos = head.add(f.scale(distance));
      pos.y = head.y - drop;
      // A plane shows its front to -Z: point +Z away from the viewer.
      const rot = Quaternion.RotationYawPitchRoll(Math.atan2(f.x, f.z), 0, 0);
      if (plane.parent) {
        const inv = Matrix.Invert(plane.parent.computeWorldMatrix(true));
        Vector3.TransformCoordinatesToRef(pos, inv, pos);
        const parentRot = new Quaternion();
        inv.decompose(undefined, parentRot);
        parentRot.multiplyToRef(rot, rot);
      }
      lineTarget = target;
      if (smooth && plane.isEnabled()) {
        glide = { t: 0, p0: plane.position.clone(), p1: pos, q0: plane.rotationQuaternion.clone(), q1: rot };
        return;
      }
      glide = null;
      plane.position.copyFrom(pos);
      plane.rotationQuaternion.copyFrom(rot);
      plane.computeWorldMatrix(true);
      plane.setEnabled(true);
      drawLine(target);
    },
    /** Moves it by hand to world position `pos`, facing along `forward` (horizontal, away from the viewer); it stays there. */
    moveTo(pos, forward) {
      const { p, rot } = toLocal(pos, forward);
      glide = null;
      pinned = true;
      plane.position.copyFrom(p);
      plane.rotationQuaternion.copyFrom(rot);
      plane.computeWorldMatrix(true);
      drawLine(lineTarget);
    },
    /** Back to being placed by place() (the menu button brings it back in front). */
    unpin() {
      pinned = false;
    },
    get pinned() {
      return pinned;
    },
    /** Whether `mesh` is part of this card (the card, its tool strip or its handle): what a grip on it takes. */
    isCard(mesh) {
      return !!mesh && (mesh === plane || mesh === bar || mesh === handle);
    },
    /** Lights the handle (pointed at, or held). */
    lightHandle: litHandle,
    hide() {
      pinned = false;
      glide = null;
      plane.setEnabled(false);
      line?.setEnabled(false);
    },
    get visible() {
      return plane.isEnabled();
    },
  };
}
