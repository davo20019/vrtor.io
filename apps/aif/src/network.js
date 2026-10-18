// Step 5's network, as a sculpture of glowing balls and wires where the neuron machine stood: two
// inputs (size, colour) on the left, the hidden neurons in the middle, the answer on the right.
// A wire's thickness is how big its weight is; orange pulls towards "orange", blue pushes away.
// Showing it a fruit lights each neuron by how strongly it fires.
import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { STATIONS, makeLabel, mat } from './lab.js';
import { forward } from './model.js';

const NODE = 0.075;
const POS_COL = new Color3(0.94, 0.54, 0.11);
const NEG_COL = new Color3(0.2, 0.45, 0.85);

export function createNetworkView(scene) {
  const root = new TransformNode('network', scene);
  root.position.copyFrom(STATIONS.machine.center);
  root.position.y = 1.2;
  const plinth = MeshBuilder.CreateCylinder('network-plinth', { diameter: 0.5, height: 0.7, tessellation: 32 }, scene);
  plinth.position.copyFrom(STATIONS.machine.center);
  plinth.position.y = 0.35;
  plinth.material = mat(scene, 'network-plinth', '#39424d', { spec: 0.2 });
  plinth.isPickable = false;

  let parts = [];
  let built = -1;
  const inputs = [];
  let hidden = [];
  let out = null;
  let wires = [];
  const outLabel = makeLabel(scene, '', { w: 0.42, h: 0.12, size: 64, color: '#ffffff', bg: '#1d232b', weight: 700 });
  outLabel.mesh.parent = root;
  const inLabels = ['size', 'colour'].map((t) => {
    const l = makeLabel(scene, t, { w: 0.28, h: 0.08, size: 90, weight: 700 });
    l.mesh.parent = root;
    return l;
  });

  const node = (name, at) => {
    const m = MeshBuilder.CreateSphere(name, { diameter: NODE, segments: 16 }, scene);
    m.parent = root;
    m.position.copyFrom(at);
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = new Color3(0.9, 0.92, 0.95);
    material.specularColor = new Color3(0.3, 0.3, 0.3);
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };
  const wire = (a, b) => {
    const m = MeshBuilder.CreateCylinder('wire', { diameter: 1, height: 1, tessellation: 8 }, scene);
    m.parent = root;
    const d = b.position.subtract(a.position);
    m.position.copyFrom(a.position.add(d.scale(0.5)));
    // Cylinders run along y: turn y onto the wire's direction.
    m.rotation.z = -Math.atan2(d.x, d.y);
    m.scaling.y = d.length() - NODE;
    const material = new StandardMaterial('wire', scene);
    material.specularColor = Color3.Black();
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };

  function build(h) {
    for (const p of parts) p.dispose();
    parts = [];
    inputs.length = 0;
    const spread = (n, gap) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);
    spread(2, 0.32).forEach((y, i) => inputs.push(node(`in-${i}`, new Vector3(-0.55, -y, 0))));
    hidden = spread(h, Math.min(0.17, 0.75 / Math.max(1, h - 1))).map((y, i) => node(`hidden-${i}`, new Vector3(0, -y, 0)));
    out = node('out', new Vector3(0.55, 0, 0));
    out.scaling.setAll(1.4);
    wires = [];
    for (let i = 0; i < h; i++) {
      wires.push(wire(inputs[0], hidden[i]), wire(inputs[1], hidden[i]), wire(hidden[i], out));
    }
    inLabels.forEach((l, i) => l.mesh.position.set(-0.78, inputs[i].position.y, 0));
    outLabel.mesh.position.set(0.55, 0.17, 0);
    built = h;
  }

  const glow = (m, a) => {
    m.material.emissiveColor = new Color3(1, 0.75, 0.25).scale(a * 0.9);
  };

  return {
    root,
    setEnabled(on) {
      root.setEnabled(on);
      plinth.setEnabled(on);
    },
    /** Redraws the wires from the network's weights, and lights it for input x (or idles it with null). */
    show(net, x = null, caption = '') {
      if (built !== net.hidden) build(net.hidden);
      for (let i = 0; i < net.hidden; i++) {
        const ws = [net.w1[i][0], net.w1[i][1], net.w2[i]];
        ws.forEach((w, k) => {
          const m = wires[i * 3 + k];
          const t = 0.004 + 0.016 * Math.min(1, Math.abs(w) / 5);
          m.scaling.x = t;
          m.scaling.z = t;
          m.material.emissiveColor = (w >= 0 ? POS_COL : NEG_COL).scale(0.55);
          m.material.diffuseColor = w >= 0 ? POS_COL : NEG_COL;
        });
      }
      if (x) {
        const r = forward(net, x);
        inputs.forEach((m, i) => glow(m, Math.min(1, Math.abs(x[i]) / 2)));
        hidden.forEach((m, i) => glow(m, r.hidden[i]));
        glow(out, r.out);
      } else {
        for (const m of [...inputs, ...hidden, out]) glow(m, 0.15);
      }
      outLabel.set(caption || 'orange?');
    },
  };
}
