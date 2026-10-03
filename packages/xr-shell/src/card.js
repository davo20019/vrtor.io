// A floating info card for the headset: kicker, title, text, an optional fact
// and buttons, with a thin line to what it describes. Under it, an optional
// strip of tools: the headset's stand-in for the page's control bar, which
// isn't visible in VR (play the flight, put the skin on, change the light). On flat screens the
// subjects show the same content as an HTML card instead (crisper, and it
// doesn't block the view).
import { Color3, Matrix, MeshBuilder, Quaternion, Vector3 } from '@babylonjs/core';
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
/** The tool strip's height (m) and its gap under the card. */
const BAR_HEIGHT = 0.1;
const BAR_GAP = 0.02;
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
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  // Group 2 draws after the world with its own depth: the card is never buried in the rover.
  plane.renderingGroupId = 2;
  plane.rotationQuaternion = Quaternion.Identity();
  plane.setEnabled(false);
  const texHeight = Math.round((TEX_WIDTH * height) / width);
  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_WIDTH * TEX_SCALE, texHeight * TEX_SCALE, true, false, true);
  ui.anisotropicFilteringLevel = 16;

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
  /** A button as wide as its label needs. */
  const wantWidth = (a) => Math.max(a.primary ? 250 : 200, a.label.length * 19 + 80);
  const setActions = (actions) => {
    rows.clearControls();
    const want = actions.map(wantWidth);
    const total = want.reduce((x, y) => x + y, 0);
    // Two rows split where the widths even out; the second row holds the last (primary) ones.
    let split = actions.length;
    if (total > ROW_WIDTH && actions.length > 1) {
      let acc = 0;
      split = 1;
      for (let i = 0; i < actions.length - 1; i++) {
        acc += want[i];
        if (acc <= total / 2) split = i + 1;
      }
    }
    const groups = [actions.slice(0, split), actions.slice(split)].filter((g) => g.length);
    rows.height = px(groups.length * 104 + 12);
    let k = 0;
    for (const group of groups) {
      const widths = want.slice(k, k + group.length);
      k += group.length;
      const fit = Math.min(1, ROW_WIDTH / widths.reduce((x, y) => x + y, 0));
      const line = new StackPanel(`${name}-actions-${k}`);
      line.isVertical = false;
      line.height = px(104);
      line.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      group.forEach((action, i) => line.addControl(makeButton(`${name}-${action.label}`, action, widths[i] * fit, fit < 0.9 ? 30 : 34)));
      rows.addControl(line);
    }
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
  const bar = MeshBuilder.CreatePlane(`${name}-bar`, { width, height: BAR_HEIGHT }, scene);
  bar.renderingGroupId = 2;
  bar.parent = plane;
  bar.position.y = -(height / 2 + BAR_GAP + BAR_HEIGHT / 2);
  bar.setEnabled(false);
  const barTexHeight = Math.round((TEX_WIDTH * BAR_HEIGHT) / width);
  const barUi = AdvancedDynamicTexture.CreateForMesh(bar, TEX_WIDTH * TEX_SCALE, barTexHeight * TEX_SCALE, true, false, true);
  barUi.anisotropicFilteringLevel = 16;
  const barBg = new Rectangle(`${name}-bar-bg`);
  barBg.thickness = sz(3);
  barBg.color = 'rgba(255,176,32,0.35)';
  barBg.cornerRadius = sz(barTexHeight / 2);
  barBg.background = 'rgba(12,13,18,0.94)';
  barUi.addControl(barBg);
  const toolRow = new StackPanel(`${name}-tools`);
  toolRow.isVertical = false;
  toolRow.height = px(92);
  barBg.addControl(toolRow);
  const setTools = (tools) => {
    bar.setEnabled(tools.length > 0);
    toolRow.clearControls();
    // Each button as wide as its label needs, all of them within the strip.
    const want = tools.map((t) => Math.max(200, t.label.length * 19 + 70));
    const fit = Math.min(1, (TEX_WIDTH - 40) / want.reduce((a, b) => a + b, 0));
    tools.forEach((tool, i) => toolRow.addControl(makeButton(`${name}-tool-${tool.label}`, tool, want[i] * fit, fit < 1 ? 30 : 34)));
  };

  // A line from the card's lower edge (or the strip's, under it) to what it describes.
  let line = null;
  const linePoints = [Vector3.Zero(), Vector3.Zero()];
  const drawLine = (target) => {
    if (!target) {
      line?.setEnabled(false);
      return;
    }
    const below = bar.isEnabled() ? height / 2 + BAR_GAP + BAR_HEIGHT : height / 2;
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
    hide() {
      glide = null;
      plane.setEnabled(false);
      line?.setEnabled(false);
    },
    get visible() {
      return plane.isEnabled();
    },
  };
}
