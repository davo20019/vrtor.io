// A floating info card for the headset: kicker, title, text, an optional fact
// and buttons, with a thin line to what it describes. On flat screens the
// subjects show the same content as an HTML card instead (crisper, and it
// doesn't block the view).
import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core';
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

export function createCard(scene, { width = 0.8, height = 0.56, name = 'card' } = {}) {
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  // Group 2 draws after the world with its own depth: the card is never buried in the rover.
  plane.renderingGroupId = 2;
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

  const row = new StackPanel(`${name}-actions`);
  row.isVertical = false;
  row.height = px(120);
  row.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  row.paddingRight = px(PAD - 16);
  row.paddingBottom = px(28);
  bg.addControl(row);

  // A line from the card's lower edge to what it describes.
  let line = null;
  const linePoints = [Vector3.Zero(), Vector3.Zero()];
  const drawLine = (target) => {
    if (!target) {
      line?.setEnabled(false);
      return;
    }
    const down = plane.getDirection(Vector3.Down()).scale(height / 2);
    linePoints[0] = plane.getAbsolutePosition().add(down);
    linePoints[1] = target;
    line = MeshBuilder.CreateLines(`${name}-line`, { points: linePoints, updatable: true, instance: line ?? undefined }, scene);
    line.color = Color3.FromHexString(ACCENT);
    line.alpha = 0.8;
    line.isPickable = false;
    line.renderingGroupId = 2;
    line.setEnabled(true);
  };

  return {
    mesh: plane,
    /** The mesh and its GUI texture, for compositing as a quad layer (see layers.js). */
    panel: { mesh: plane, ui },
    /** { kicker, title, body, fact, actions: [{ label, primary, onClick }] } */
    setContent({ kicker: k = '', title: t = '', body: b = '', fact: f = '', actions = [] }) {
      kicker.text = k.toUpperCase();
      title.text = t;
      body.text = b;
      fact.text = f;
      fact.isVisible = !!f;
      row.clearControls();
      for (const action of actions) {
        const button = Button.CreateSimpleButton(`${name}-${action.label}`, action.label);
        button.width = action.primary ? px(290) : px(230);
        button.height = px(92);
        button.paddingLeft = px(16);
        button.cornerRadius = sz(46);
        button.thickness = action.primary ? 0 : sz(3);
        button.color = action.primary ? '#14100a' : '#ffffff';
        button.background = action.primary ? ACCENT : 'rgba(255,255,255,0.06)';
        button.fontSize = sz(34);
        button.fontWeight = '600';
        const idle = button.background;
        button.onPointerEnterObservable.add(() => (button.background = action.primary ? '#ffc65a' : 'rgba(255,255,255,0.2)'));
        button.onPointerOutObservable.add(() => (button.background = idle));
        button.onPointerUpObservable.add(() => action.onClick());
        row.addControl(button);
      }
    },
    /**
     * Puts the card `distance` metres in front of the head along `forward`
     * (flattened), a little below the eyes, turned to face the viewer, with its
     * line to `target` (or none).
     */
    place(head, forward, target = null, { distance = 1.15, drop = 0.18 } = {}) {
      const f = new Vector3(forward.x, 0, forward.z).normalize();
      const pos = head.add(f.scale(distance));
      pos.y = head.y - drop;
      plane.position.copyFrom(pos);
      // A plane shows its front to -Z: point +Z away from the viewer.
      plane.lookAt(pos.add(f));
      plane.computeWorldMatrix(true);
      plane.setEnabled(true);
      drawLine(target);
    },
    hide() {
      plane.setEnabled(false);
      line?.setEnabled(false);
    },
    get visible() {
      return plane.isEnabled();
    },
  };
}
