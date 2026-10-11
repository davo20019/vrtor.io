import { Vector3 } from '@babylonjs/core';

// One shared interaction for grip controllers and the accessible point-and-place fallback.
export function createObjectInteraction({ models, target, enabled, onAnswer, onSelect = () => {} }) {
  let held = null;
  const homes = models.map((m) => m.position.clone());
  function reset() {
    if (held) held.model.setParent(null);
    held = null;
    models.forEach((m, i) => { m.position.copyFrom(homes[i]); m.rotationQuaternion = null; m.rotation.setAll(0); });
    onSelect(null);
  }
  function take(side, anchor = null) {
    if (!enabled() || !models[side] || held) return false;
    const model = models[side];
    held = { side, model, anchor };
    if (anchor) {
      model.parent = anchor;
      model.position.set(0, -0.35, 0.05);
      model.rotationQuaternion = null; model.rotation.setAll(0);
    }
    onSelect(side); return true;
  }
  function release(anchor, force = false) {
    if (!held || held.anchor !== anchor) return false;
    const { model, side } = held;
    model.computeWorldMatrix(true);
    const center = Vector3.TransformCoordinates(new Vector3(0, 0.35, 0), model.getWorldMatrix());
    const accepted = enabled() && (force || Vector3.Distance(center, target) < 0.7);
    reset();
    if (accepted) onAnswer(side);
    return accepted;
  }
  return { take, release, reset, get held() { return held; } };
}

export function attachGripInteraction(rig, interaction, models) {
  function add(source) {
    function bind(mc) {
      const squeeze = mc.getComponentOfType('squeeze');
      if (!squeeze) return; // Trigger-only input uses point-and-place.
      squeeze.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed || !rig.inXr()) return;
        const anchor = source.grip ?? source.pointer;
        if (!c.pressed) { interaction.release(anchor); return; }
        const hit = rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId);
        let side = hit?.metadata?.side;
        if (side !== 0 && side !== 1) {
          const at = anchor.getAbsolutePosition();
          side = models.findIndex((m) => Vector3.Distance(at, m.getAbsolutePosition().add(new Vector3(0, 0.35, 0))) < 0.6);
        }
        if (side === 0 || side === 1) interaction.take(side, anchor);
      });
    }
    if (source.motionController) bind(source.motionController);
    else source.onMotionControllerInitObservable.add(bind);
  }
  rig.xr.input.controllers.forEach(add);
  rig.xr.input.onControllerAddedObservable.add(add);
  rig.xr.input.onControllerRemovedObservable.add((source) => {
    if (interaction.held?.anchor === (source.grip ?? source.pointer)) interaction.reset();
  });
  rig.onChange(() => interaction.reset());
}

export const STATIONS = {
  listen: { position: [0, 0, -2.6], lookAt: [0, 1.5, 0.6], console: [0, -0.45, -0.9], target: [0, 1.5, 0.5], radius: 6.3 },
  mouth: { position: [3, 0, 0.2], lookAt: [3, 2.0, 3.0], console: [3, -0.25, 1.4], target: [3, 1.75, 3], radius: 5.8 },
  speak: { position: [-3, 0, 0.2], lookAt: [-3, 1.6, 3], console: [-3, 0, 1.4], target: [-3, 1.6, 3], radius: 5.4 },
};
export function stationFor(view) {
  return view === 'mouth' ? 'mouth' : view === 'speak' ? 'speak' : 'listen';
}
