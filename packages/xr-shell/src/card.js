// A floating info card for the headset: kicker, title, text, an optional fact
// and buttons, with a thin line to what it describes. On flat screens the
// subjects show the same content as an HTML card instead (crisper, and it
// doesn't block the view).
import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from '@babylonjs/gui';

const ACCENT = '#ffb020';
const TEX_WIDTH = 1024;
const PAD = 56;

export function createCard(scene, { width = 0.8, height = 0.56, name = 'card' } = {}) {
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene);
  // Group 2 draws after the world with its own depth: the card is never buried in the rover.
  plane.renderingGroupId = 2;
  plane.setEnabled(false);
  const texHeight = Math.round((TEX_WIDTH * height) / width);
  const ui = AdvancedDynamicTexture.CreateForMesh(plane, TEX_WIDTH, texHeight, true, false, true);

  const bg = new Rectangle(`${name}-bg`);
  bg.thickness = 3;
  bg.color = 'rgba(255,176,32,0.55)';
  bg.cornerRadius = 36;
  bg.background = 'rgba(12,13,18,0.94)';
  ui.addControl(bg);

  const textWidth = TEX_WIDTH - 2 * PAD;
  const stack = new StackPanel(`${name}-text`);
  stack.isVertical = true;
  stack.width = `${textWidth}px`;
  stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  stack.top = `${PAD - 8}px`;
  bg.addControl(stack);

  const text = (id, size, color, weight = 'normal') => {
    const t = new TextBlock(`${name}-${id}`);
    t.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    t.fontSize = size;
    t.fontWeight = weight;
    t.color = color;
    t.textWrapping = true;
    t.resizeToFit = true;
    t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.width = `${textWidth}px`;
    stack.addControl(t);
    return t;
  };
  const kicker = text('kicker', 30, ACCENT, '600');
  const title = text('title', 62, '#ffffff', '700');
  title.paddingTop = '4px';
  const body = text('body', 36, '#dfe2ea');
  body.paddingTop = '18px';
  body.lineSpacing = '6px';
  const fact = text('fact', 32, '#ffd27a');
  fact.paddingTop = '30px';
  fact.lineSpacing = '4px';

  const row = new StackPanel(`${name}-actions`);
  row.isVertical = false;
  row.height = '120px';
  row.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  row.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  row.paddingRight = `${PAD - 16}px`;
  row.paddingBottom = '28px';
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
        button.width = action.primary ? '290px' : '230px';
        button.height = '92px';
        button.paddingLeft = '16px';
        button.cornerRadius = 46;
        button.thickness = action.primary ? 0 : 3;
        button.color = action.primary ? '#14100a' : '#ffffff';
        button.background = action.primary ? ACCENT : 'rgba(255,255,255,0.06)';
        button.fontSize = 34;
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
