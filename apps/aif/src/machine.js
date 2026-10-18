// The neuron: a machine on a pedestal with two sliding dials on top (one for size, one for colour),
// a screen that shows the sum it makes, and a glass tube beside it that fills with its error.
// Each dial's handle can be dragged (mouse, touch, or a controller's ray and trigger) or grabbed
// with a controller's grip.
import { MeshBuilder, PointerDragBehavior, TransformNode, Vector3 } from '@babylonjs/core';
import { STATIONS, makeLabel, mat } from './lab.js';

export const DIAL_MAX = 6;
/** Half the length a handle slides, m. */
const TRACK = 0.3;
/** How tall the error tube is, m, and the error that fills it. */
const TUBE = 0.7;
export const errorFill = (loss) => 1 - Math.exp(-loss / 1.2);

export function createMachine(scene, { onDial }) {
  const root = new TransformNode('machine', scene);
  root.position.copyFrom(STATIONS.machine.center);
  const body = mat(scene, 'machine-body', '#39424d', { spec: 0.2 });
  const face = mat(scene, 'machine-face', '#e9edf1', { spec: 0.1 });
  const brass = mat(scene, 'machine-handle', '#ffb020', { spec: 0.5, emissive: '#3a2600' });

  const base = MeshBuilder.CreateBox('machine-base', { width: 1.1, depth: 0.55, height: 0.86 }, scene);
  base.position.y = 0.43;
  base.parent = root;
  base.material = body;
  const top = MeshBuilder.CreateBox('machine-top', { width: 1.1, depth: 0.55, height: 0.03 }, scene);
  top.position.y = 0.875;
  top.parent = root;
  top.material = face;

  const dials = [];
  const handles = [];
  ['Size dial', 'Colour dial'].forEach((name, i) => {
    const z = i === 0 ? -0.1 : 0.1;
    const track = MeshBuilder.CreateBox(`dial-${i}-track`, { width: TRACK * 2 + 0.04, depth: 0.018, height: 0.01 }, scene);
    track.position.set(0, 0.895, z);
    track.parent = root;
    track.material = body;
    track.isPickable = false;
    // A tick at zero, and the ends.
    for (const x of [-TRACK, 0, TRACK]) {
      const tick = MeshBuilder.CreateBox(`dial-${i}-tick`, { width: 0.006, depth: 0.05, height: 0.004 }, scene);
      tick.position.set(x, 0.892, z);
      tick.parent = root;
      tick.material = body;
      tick.isPickable = false;
    }
    const label = makeLabel(scene, name, { w: 0.2, h: 0.045, size: 74 });
    label.mesh.parent = root;
    label.mesh.position.set(-TRACK - 0.14, 0.893, z);
    label.mesh.rotation.x = Math.PI / 2;
    const handle = MeshBuilder.CreateCylinder(`dial-${i}-handle`, { diameter: 0.055, height: 0.07, tessellation: 24 }, scene);
    handle.parent = root;
    handle.position.set(0, 0.935, z);
    handle.material = brass;
    handle.metadata = { dial: i };
    const value = makeLabel(scene, '0.0', { w: 0.1, h: 0.045, size: 90, weight: 700 });
    value.mesh.parent = handle;
    value.mesh.position.set(0, 0.07, 0);
    value.mesh.rotation.x = Math.PI / 4;
    const drag = new PointerDragBehavior({ dragAxis: new Vector3(1, 0, 0) });
    drag.useObjectOrientationForDragging = false;
    drag.moveAttached = false;
    drag.onDragObservable.add((e) => {
      const local = handle.position.x + e.delta.x;
      onDial(i, (Math.max(-TRACK, Math.min(TRACK, local)) / TRACK) * DIAL_MAX);
    });
    handle.addBehavior(drag);
    dials.push({ handle, value, drag });
    handles.push(handle);
  });

  // The screen on the front face: the sum the neuron makes.
  const screen = makeLabel(scene, '', { w: 0.9, h: 0.36, size: 62, color: '#e9f3ff', bg: '#111820', weight: 600, px: 1280 });
  screen.mesh.parent = root;
  screen.mesh.position.set(0, 0.52, -0.278);

  // The error tube, to the right.
  const glass = MeshBuilder.CreateCylinder('error-glass', { diameter: 0.14, height: TUBE, tessellation: 32 }, scene);
  glass.parent = root;
  glass.position.set(0.72, TUBE / 2 + 0.01, -0.05);
  glass.material = mat(scene, 'error-glass', '#cfe6ff', { spec: 0.6, alpha: 0.25 });
  glass.isPickable = false;
  const fill = MeshBuilder.CreateCylinder('error-fill', { diameter: 0.11, height: 1, tessellation: 24 }, scene);
  fill.parent = root;
  const fillMat = mat(scene, 'error-fill', '#e5484d', { emissive: '#4a0d10' });
  fill.material = fillMat;
  fill.isPickable = false;
  const tubeLabel = makeLabel(scene, 'Error', { w: 0.2, h: 0.06, size: 80, weight: 700 });
  tubeLabel.mesh.parent = root;
  tubeLabel.mesh.position.set(0.72, TUBE + 0.06, -0.05);
  const best = MeshBuilder.CreateTorus('error-best', { diameter: 0.16, thickness: 0.008, tessellation: 32 }, scene);
  best.parent = root;
  best.material = mat(scene, 'error-best', '#2fbf71', { emissive: '#0f4d2c' });
  best.isPickable = false;
  best.setEnabled(false);

  return {
    root,
    handles,
    /** Moves the handles to the dials' values and updates the screen and tube. */
    show({ w, loss, wrong, total, showError, bestLoss = null }) {
      dials.forEach((d, i) => {
        d.handle.position.x = (w[i] / DIAL_MAX) * TRACK;
        d.value.set(w[i].toFixed(1));
      });
      const sign = (v) => (v < 0 ? '−' : '+');
      screen.set(
        `size × ${w[0].toFixed(1)}  ${sign(w[1])}  colour × ${Math.abs(w[1]).toFixed(1)}\n` +
          'above 0: orange   below 0: apple\n' +
          (showError ? `wrong: ${wrong} of ${total}   error: ${loss.toFixed(2)}` : `wrong: ${wrong} of ${total}`),
      );
      glass.setEnabled(showError);
      tubeLabel.mesh.setEnabled(showError);
      fill.setEnabled(showError);
      const h = Math.max(0.005, errorFill(loss) * TUBE);
      fill.scaling.y = h;
      fill.position.set(0.72, h / 2 + 0.012, -0.05);
      best.setEnabled(showError && bestLoss != null);
      if (bestLoss != null) best.position.set(0.72, errorFill(bestLoss) * TUBE + 0.012, -0.05);
    },
    /** Where a grabbing hand puts dial `i`, from its position in the world. */
    dialFromHand(i, world) {
      const local = world.subtract(root.position);
      return (Math.max(-TRACK, Math.min(TRACK, local.x)) / TRACK) * DIAL_MAX;
    },
    setEnabled(on) {
      root.setEnabled(on);
    },
    /** Stops the orbit camera turning while a handle is dragged. */
    onDragging(cb) {
      for (const d of dials) {
        d.drag.onDragStartObservable.add(() => cb(true));
        d.drag.onDragEndObservable.add(() => cb(false));
      }
    },
  };
}

