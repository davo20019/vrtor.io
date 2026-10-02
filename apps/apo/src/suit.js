// What visitors wear here (xr-shell's avatar.js): the Smithsonian's scan of Neil Armstrong's
// A7-L suit and helmet, gold visor down, cut down and stood up (scripts/prepare-apollo-suit.py).
// Loaded once; every visitor wears instances of them, so all the suits are one draw call and all
// the helmets another.
import { LoadAssetContainerAsync, PBRMaterial } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const MODELS = `${import.meta.env.BASE_URL}models/`;

export async function loadOutfit(scene) {
  const [suit, helmet] = await Promise.all([loadPiece(scene, 'suit.glb'), loadPiece(scene, 'helmet.glb')]);
  // The visor is polished gold: let it catch the Sun.
  const visor = helmet.material;
  if (visor instanceof PBRMaterial) {
    visor.roughness = 0.35;
    visor.metallic = 0.35;
  }
  return { suit, helmet };
}

async function loadPiece(scene, file) {
  const container = await LoadAssetContainerAsync(`${MODELS}${file}`, scene);
  container.addAllToScene();
  const mesh = container.meshes.find((m) => m.getTotalVertices() > 0);
  // Out of the glTF root (which mirrors it into Babylon's frame) with that mirroring kept in
  // its vertices, so instances parented anywhere come out the right way round.
  mesh.setParent(null);
  mesh.bakeCurrentTransformIntoVertices();
  container.meshes.filter((m) => m !== mesh).forEach((m) => m.dispose());
  mesh.isVisible = false; // the template; only its instances show
  mesh.isPickable = false;
  return mesh;
}
