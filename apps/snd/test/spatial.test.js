import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, Vector3, Observable } from '@babylonjs/core';
import { createObjectInteraction, attachGripInteraction, stationFor, STATIONS } from '../src/spatial.js';

function fixture() {
  const engine = new NullEngine(), scene = new Scene(engine);
  const models = [0, 1].map((i) => { const m = new TransformNode(`word-${i}`, scene); m.position.set(i ? 1 : -1, 0.85, 0.65); return m; });
  const anchor = new TransformNode('controller grip', scene);
  const answers = []; let enabled = false;
  const interaction = createObjectInteraction({ models, target: new Vector3(0, 1, 0), enabled: () => enabled, onAnswer: (side) => answers.push(side) });
  return { scene, models, anchor, answers, interaction, enable() { enabled = true; }, disable() { enabled = false; }, dispose() { engine.dispose(); } };
}

test('grabbing requires listening; only releases within the answer ring submit', () => {
  const f = fixture();
  assert.equal(f.interaction.take(0, f.anchor), false);
  f.enable(); assert.equal(f.interaction.take(0, f.anchor), true);
  assert.equal(f.models[0].parent, f.anchor);
  f.anchor.position.set(3, 1, 0); assert.equal(f.interaction.release(f.anchor), false);
  assert.deepEqual(f.answers, []); assert.equal(f.models[0].parent, null);
  assert.equal(f.models[0].position.x, -1);
  f.interaction.take(1, f.anchor); f.anchor.position.set(0, 1, 0);
  assert.equal(f.interaction.release(f.anchor), true); assert.deepEqual(f.answers, [1]);
  assert.equal(f.interaction.release(f.anchor), false); f.dispose();
});

test('point-and-place uses the same answer callback and cannot submit stale selections', () => {
  const f = fixture(); f.enable();
  f.interaction.take(0); assert.equal(f.interaction.release(null, true), true);
  assert.deepEqual(f.answers, [0]);
  f.interaction.take(1); f.disable(); assert.equal(f.interaction.release(null, true), false);
  assert.deepEqual(f.answers, [0]); f.enable(); f.interaction.take(1); f.interaction.reset();
  assert.equal(f.interaction.release(null, true), false); f.dispose();
});

test('XR squeeze binds grip and cleans up when a controller disconnects or session exits', () => {
  const f = fixture(); f.enable();
  const changes = new Observable(); const added = new Observable(), removed = new Observable(); let sessionChange;
  const source = { uniqueId: 'left', grip: f.anchor, motionController: { getComponentOfType() { return { onButtonStateChangedObservable: changes }; } } };
  const rig = { inXr: () => true, onChange(fn) { sessionChange = fn; }, xr: {
    input: { controllers: [source], onControllerAddedObservable: added, onControllerRemovedObservable: removed },
    pointerSelection: { getMeshUnderPointer() { return { metadata: { side: 1 } }; } },
  } };
  attachGripInteraction(rig, f.interaction, f.models);
  changes.notifyObservers({ pressed: true, changes: { pressed: { current: true } } });
  assert.equal(f.interaction.held.side, 1); assert.equal(f.models[1].parent, f.anchor);
  removed.notifyObservers(source); assert.equal(f.interaction.held, null); assert.equal(f.models[1].parent, null);
  changes.notifyObservers({ pressed: true, changes: { pressed: { current: true } } });
  sessionChange(false); assert.equal(f.interaction.held, null); assert.deepEqual(f.answers, []); f.dispose();
});

test('activities occupy three distinct reachable stations on the teleport floor', () => {
  assert.equal(stationFor('listen'), 'listen'); assert.equal(stationFor('feedback'), 'listen');
  assert.equal(stationFor('mouth'), 'mouth'); assert.equal(stationFor('speak'), 'speak');
  assert.equal(new Set(Object.values(STATIONS).map((s) => s.position.join(','))).size, 3);
  for (const station of Object.values(STATIONS)) {
    assert.equal(station.position[1], 0);
    assert.ok(Math.abs(station.position[0]) < 6 && Math.abs(station.position[2]) < 6);
  }
});
