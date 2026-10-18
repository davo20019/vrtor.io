// The math, kept apart from the 3D so it can be checked on its own (node test/model.test.mjs).
//
// Step 2 to 4: one neuron with two dials (weights), no bias. Its inputs are the fruit's size and
// colour, each shifted and scaled so the average fruit sits at 0 (so the neuron's line goes through
// the middle of the data and two dials are enough). It says "orange" with probability
// sigmoid(w1 * size + w2 * colour). Two dials plus the error is exactly three numbers, so the error
// landscape on the table is the real one, not a squashed picture of something bigger.
//
// Step 5: a small network, 2 inputs -> H hidden neurons -> 1 output, trained with Adam.

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Inputs for the single neuron: centred on the step 1 fruit. */
export const neuronInputs = (f) => [(f.size - 8.1) / 0.65, (f.hue - 20) / 11];

/** A small pull towards 0 on the dials, so the lowest point of the landscape is on the table. */
export const PENALTY = 0.02;

/**
 * The neuron's error over `examples` ({ x: [s, c], y: 0|1 }): the average cross-entropy (how surprised
 * it is by each right answer) plus the penalty. Also returns the gradient, and how many it gets wrong.
 */
export function neuronError(w, examples) {
  let loss = 0;
  let g0 = 0;
  let g1 = 0;
  let wrong = 0;
  for (const { x, y } of examples) {
    const p = sigmoid(w[0] * x[0] + w[1] * x[1]);
    const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
    loss -= y ? Math.log(q) : Math.log(1 - q);
    g0 += (p - y) * x[0];
    g1 += (p - y) * x[1];
    if ((p >= 0.5 ? 1 : 0) !== y) wrong++;
  }
  const n = Math.max(1, examples.length);
  return {
    loss: loss / n + (PENALTY / 2) * (w[0] * w[0] + w[1] * w[1]),
    grad: [g0 / n + PENALTY * w[0], g1 / n + PENALTY * w[1]],
    wrong,
  };
}

/** The largest curvature of the error at `w` (finite differences), which sets how big a step is too big. */
export function curvature(w, examples) {
  const h = 1e-3;
  const g = (a, b) => neuronError([a, b], examples).grad;
  const gx1 = g(w[0] + h, w[1]);
  const gx0 = g(w[0] - h, w[1]);
  const gy1 = g(w[0], w[1] + h);
  const gy0 = g(w[0], w[1] - h);
  const a = (gx1[0] - gx0[0]) / (2 * h);
  const b = ((gx1[1] - gx0[1]) / (2 * h) + (gy1[0] - gy0[0]) / (2 * h)) / 2;
  const d = (gy1[1] - gy0[1]) / (2 * h);
  const tr = a + d;
  const det = a * d - b * b;
  return tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
}

/** The dials where the error is lowest (plain gradient descent run to the end). */
export function bestDials(examples) {
  let w = [0, 0];
  for (let i = 0; i < 4000; i++) {
    const { grad } = neuronError(w, examples);
    const k = 1 / Math.max(0.05, curvature(w, examples));
    w = [w[0] - k * grad[0], w[1] - k * grad[1]];
  }
  return w;
}

/**
 * One step of gradient descent: move the dials a little way downhill. `velocity` (momentum) carries
 * some of the last step into this one, like a heavy ball that keeps rolling.
 */
export function descend(w, velocity, examples, rate, momentum = 0) {
  const { grad } = neuronError(w, examples);
  const v = [momentum * velocity[0] - rate * grad[0], momentum * velocity[1] - rate * grad[1]];
  return { w: [w[0] + v[0], w[1] + v[1]], velocity: v, grad };
}

// ---------------------------------------------------------------- the network

/** Inputs for the network: centred on all the fruit, green apples included. */
export const networkInputs = (f) => [(f.size - 8.1) / 0.65, (f.hue - 50) / 35];

/** A seeded random number generator, so the network starts the same way every time. */
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A network with `hidden` neurons in the middle. Weights: w1[h] = [from size, from colour], b1[h],
 * w2[h] (from each hidden neuron to the output), b2.
 */
export function createNetwork(hidden, seed = 7) {
  const r = random(seed + hidden * 101);
  const g = () => (r() * 2 - 1) * 1.2;
  const net = {
    hidden,
    w1: Array.from({ length: hidden }, () => [g(), g()]),
    b1: Array.from({ length: hidden }, () => g() * 0.5),
    w2: Array.from({ length: hidden }, () => g()),
    b2: 0,
    steps: 0,
  };
  net.adam = { m: zeros(net), v: zeros(net), t: 0 };
  return net;
}

/** What each neuron says for input x: { hidden: [..], out }. */
export function forward(net, x) {
  const hidden = net.w1.map((w, i) => sigmoid(w[0] * x[0] + w[1] * x[1] + net.b1[i]));
  let z = net.b2;
  for (let i = 0; i < net.hidden; i++) z += net.w2[i] * hidden[i];
  return { hidden, out: sigmoid(z) };
}

/** The network's error over `examples`, its gradient (same shape as the weights) and how many it gets wrong. */
export function networkError(net, examples) {
  const grad = zeros(net);
  let loss = 0;
  let wrong = 0;
  for (const { x, y } of examples) {
    const { hidden, out } = forward(net, x);
    const q = Math.min(1 - 1e-9, Math.max(1e-9, out));
    loss -= y ? Math.log(q) : Math.log(1 - q);
    if ((out >= 0.5 ? 1 : 0) !== y) wrong++;
    // Backpropagation: how much each weight is to blame, passed back from the output.
    const dz = out - y;
    grad.b2 += dz;
    for (let i = 0; i < net.hidden; i++) {
      grad.w2[i] += dz * hidden[i];
      const dh = dz * net.w2[i] * hidden[i] * (1 - hidden[i]);
      grad.b1[i] += dh;
      grad.w1[i][0] += dh * x[0];
      grad.w1[i][1] += dh * x[1];
    }
  }
  const n = Math.max(1, examples.length);
  scale(grad, 1 / n);
  return { loss: loss / n, grad, wrong };
}

/** One step of Adam: gradient descent that keeps a running average of each weight's slope. */
export function trainStep(net, examples, rate = 0.05) {
  const { loss, grad, wrong } = networkError(net, examples);
  const a = net.adam;
  a.t++;
  const b1 = 0.9;
  const b2 = 0.999;
  const c1 = 1 - b1 ** a.t;
  const c2 = 1 - b2 ** a.t;
  const upd = (m, v, g) => {
    const mm = b1 * m + (1 - b1) * g;
    const vv = b2 * v + (1 - b2) * g * g;
    return [mm, vv, (rate * (mm / c1)) / (Math.sqrt(vv / c2) + 1e-8)];
  };
  for (let i = 0; i < net.hidden; i++) {
    for (let j = 0; j < 2; j++) {
      const [m, v, d] = upd(a.m.w1[i][j], a.v.w1[i][j], grad.w1[i][j]);
      a.m.w1[i][j] = m; a.v.w1[i][j] = v; net.w1[i][j] -= d;
    }
    let [m, v, d] = upd(a.m.b1[i], a.v.b1[i], grad.b1[i]);
    a.m.b1[i] = m; a.v.b1[i] = v; net.b1[i] -= d;
    [m, v, d] = upd(a.m.w2[i], a.v.w2[i], grad.w2[i]);
    a.m.w2[i] = m; a.v.w2[i] = v; net.w2[i] -= d;
  }
  const [m, v, d] = upd(a.m.b2, a.v.b2, grad.b2);
  a.m.b2 = m; a.v.b2 = v; net.b2 -= d;
  net.steps++;
  return { loss, wrong };
}

/** How many dials (weights and biases) the network has. */
export const dialCount = (net) => net.hidden * 4 + 1;

function zeros(net) {
  return {
    w1: Array.from({ length: net.hidden }, () => [0, 0]),
    b1: new Array(net.hidden).fill(0),
    w2: new Array(net.hidden).fill(0),
    b2: 0,
  };
}
function scale(g, k) {
  for (let i = 0; i < g.w1.length; i++) {
    g.w1[i][0] *= k; g.w1[i][1] *= k; g.b1[i] *= k; g.w2[i] *= k;
  }
  g.b2 *= k;
}
