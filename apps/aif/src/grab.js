// Grabbing with a controller's grip (squeeze): the nearest grabbable thing within reach of the hand,
// or the one its ray points at, follows that hand until the grip opens. Each hand holds one thing.
//
// A grabbable is { position(): Vector3 (world), reach: m, grab(anchor), move(handWorld, anchor), release(handWorld) }.
import { Vector3 } from '@babylonjs/core';

export function attachGrab(scene, rig, { items, rayItem = () => null }) {
  /** Hand (anchor node) -> what it holds. */
  const held = new Map();

  function nearest(at) {
    let best = null;
    let bestD = Infinity;
    for (const it of items()) {
      if ([...held.values()].includes(it)) continue;
      const d = Vector3.Distance(at, it.position());
      if (d < it.reach && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  function add(source) {
    const bind = (mc) => {
      const squeeze = mc.getComponentOfType('squeeze');
      if (!squeeze) return;
      squeeze.onButtonStateChangedObservable.add((c) => {
        if (!c.changes.pressed || !rig.inXr()) return;
        const anchor = source.grip ?? source.pointer;
        if (!c.pressed) {
          const it = held.get(anchor);
          held.delete(anchor);
          it?.release(anchor.getAbsolutePosition().clone());
          return;
        }
        if (held.has(anchor)) return;
        const hit = rig.xr.pointerSelection?.getMeshUnderPointer(source.uniqueId);
        const it = nearest(anchor.getAbsolutePosition()) ?? (hit ? rayItem(hit) : null);
        if (!it || [...held.values()].includes(it)) return;
        held.set(anchor, it);
        it.grab(anchor);
      });
    };
    if (source.motionController) bind(source.motionController);
    else source.onMotionControllerInitObservable.add(bind);
  }
  rig.xr.input.controllers.forEach(add);
  rig.xr.input.onControllerAddedObservable.add(add);
  rig.xr.input.onControllerRemovedObservable.add((source) => {
    const anchor = source.grip ?? source.pointer;
    const it = held.get(anchor);
    held.delete(anchor);
    it?.release(anchor.getAbsolutePosition().clone());
  });

  scene.onBeforeRenderObservable.add(() => {
    for (const [anchor, it] of held) it.move(anchor.getAbsolutePosition(), anchor);
  });

  return {
    /** Lets go of everything (leaving VR, changing step). */
    dropAll() {
      for (const [anchor, it] of held) it.release(anchor.getAbsolutePosition().clone());
      held.clear();
    },
    isHeld: (it) => [...held.values()].includes(it),
  };
}
