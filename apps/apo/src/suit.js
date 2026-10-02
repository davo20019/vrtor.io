// The visitors' spacesuit: the Smithsonian's scan of Neil Armstrong's A7-L, helmet off,
// cut down and stood up (scripts/prepare-apollo-suit.py). Loaded once; every visitor wears
// an instance of it (xr-shell's avatar.js), so all the suits are one draw call.
import { LoadAssetContainerAsync } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export async function loadSuit(scene) {
  const container = await LoadAssetContainerAsync(`${import.meta.env.BASE_URL}models/suit.glb`, scene);
  container.addAllToScene();
  const suit = container.meshes.find((m) => m.getTotalVertices() > 0);
  // Out of the glTF root (which mirrors it into Babylon's frame) with that mirroring kept in
  // its vertices, so instances parented anywhere come out the right way round.
  suit.setParent(null);
  suit.bakeCurrentTransformIntoVertices();
  container.meshes.filter((m) => m !== suit).forEach((m) => m.dispose());
  suit.isVisible = false; // the template; only its instances show
  suit.isPickable = false;
  suit.alwaysSelectAsActiveMesh = false;
  return suit;
}
