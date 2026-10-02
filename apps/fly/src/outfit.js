// What visitors wear here (xr-shell's avatar.js): the brothers flew in coats and ties, so everyone
// gets a dark coat over a white shirt, a tie in their own color, and a bowler, the everyday hat
// of 1903 (what the Wrights wore on their heads that morning isn't recorded). The bowler is turned
// from one profile; every visitor wears an instance of it, so all the hats are one draw call.
import { Color3, MeshBuilder, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core';

const COAT = '#3b3a40';
const FELT = Color3.FromHexString('#1e1b1a');
const BAND = Color3.FromHexString('#0b0a0a');
/**
 * Half the bowler's outline, from the middle of the brim's underside out and over the crown, in
 * metres above the wearer's eyes (the avatar's head is a 26 cm ball centred on them). The brim
 * rolls up at its edge; the crown is a low, round dome.
 */
const PROFILE = [
  [0.0, 0.062], [0.13, 0.062], [0.175, 0.064], [0.198, 0.072], [0.206, 0.086], [0.199, 0.09],
  [0.17, 0.079], [0.14, 0.076], [0.137, 0.1], [0.136, 0.135], [0.13, 0.165], [0.115, 0.19],
  [0.09, 0.208], [0.055, 0.219], [0.0, 0.223],
];
/** The band runs round the base of the crown, up to this height. */
const BAND_TOP = 0.1;

export function createOutfit(scene) {
  const hat = MeshBuilder.CreateLathe('bowler', {
    shape: PROFILE.map(([r, y]) => new Vector3(r, y, 0)),
    tessellation: 28,
    closed: true,
  }, scene);
  const positions = hat.getVerticesData(VertexBuffer.PositionKind);
  const colors = [];
  for (let i = 0; i < positions.length; i += 3) {
    const r = Math.hypot(positions[i], positions[i + 2]);
    const y = positions[i + 1];
    // The band: the crown's wall just above the brim.
    const c = r < 0.139 && r > 0.13 && y > 0.074 && y < BAND_TOP ? BAND : FELT;
    colors.push(c.r, c.g, c.b, 1);
  }
  hat.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial('bowler', scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.backFaceCulling = false;
  hat.material = mat;
  hat.hasVertexAlpha = false;
  hat.isVisible = false; // the template; only its instances show
  hat.isPickable = false;
  return { hat, coat: { color: COAT } };
}
