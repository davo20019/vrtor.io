// node apps/aif/test/model.test.mjs: the fruit and the math tell the story the lesson tells.
import assert from 'node:assert/strict';
import { FIRST_FRUIT, GREEN_APPLES, NEW_FRUIT, isOrange } from '../src/data.js';
import { bestDials, createNetwork, curvature, descend, forward, neuronError, neuronInputs, networkInputs, trainStep } from '../src/model.js';

const first = FIRST_FRUIT.map((f) => ({ x: neuronInputs(f), y: isOrange(f.kind) }));
const best = bestDials(first);
const at = neuronError(best, first);
console.log('best dials', best.map((v) => v.toFixed(2)), 'loss', at.loss.toFixed(3), 'wrong', at.wrong);
assert.ok(Math.abs(best[0]) < 6 && Math.abs(best[1]) < 6, 'the lowest point is on the table');
assert.ok(at.wrong <= 2, 'one neuron sorts the first fruit, but for the two that overlap');
assert.ok(at.wrong >= 1, 'the overlapping pair keeps a minimum on the table');
const k = curvature(best, first);
console.log('curvature', k.toFixed(3));

for (const [name, mult] of [['small', 0.15], ['good', 1], ['too big', 2.6]]) {
  let s = { w: [-4.5, -4], velocity: [0, 0] };
  const losses = [];
  for (let i = 0; i < 60; i++) {
    s = descend(s.w, s.velocity, first, mult / k);
    losses.push(neuronError(s.w, first).loss);
  }
  console.log(name, 'after 60 steps', losses.at(-1).toFixed(3), 'w', s.w.map((v) => v.toFixed(2)));
}

const all = [...FIRST_FRUIT, ...GREEN_APPLES].map((f) => ({ f, x: neuronInputs(f), y: isOrange(f.kind) }));
const one = bestDials(all);
const oneErr = neuronError(one, all);
console.log('one neuron with green apples: wrong', oneErr.wrong, 'of', all.length);
assert.ok(oneErr.wrong >= 4, 'a single line cannot fence off the green apples');

for (const hidden of [2, 3, 4, 6]) {
  const net = createNetwork(hidden);
  const data = [...FIRST_FRUIT, ...GREEN_APPLES].map((f) => ({ x: networkInputs(f), y: isOrange(f.kind) }));
  let r;
  for (let i = 0; i < 1500; i++) r = trainStep(net, data);
  const unseen = NEW_FRUIT.filter((f) => (forward(net, networkInputs(f)).out >= 0.5 ? 1 : 0) === isOrange(f.kind)).length;
  console.log(`network ${hidden}: loss ${r.loss.toFixed(3)} wrong ${r.wrong}, new fruit right ${unseen}/${NEW_FRUIT.length}`);
  if (hidden >= 3) assert.ok(r.wrong <= 2, `network ${hidden} learns the band`);
}
console.log('ok');
