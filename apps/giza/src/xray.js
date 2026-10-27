// The see-through view: every passage and chamber as a glowing solid inside a ghost of the pyramid, with what is
// only known from muon imaging (the North Face Corridor, the Big Void) and the relieving chambers, which you cannot
// visit, in blue.
import { Color3, Mesh, StandardMaterial } from '@babylonjs/core';
import { Geo, add, mul, norm, sub } from './geom.js';
import { chevrons } from './exterior.js';
import { ENTRANCE, GALLERY, KING, RELIEVING, VOID } from './survey.js';

function glow(scene, name, hex, alpha) {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = Color3.FromHexString(hex);
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  m.alpha = alpha;
  m.backFaceCulling = false;
  m.fogEnabled = false;
  return m;
}

/** A box with its corners given, outward faces. */
function solid(g, c) {
  // c: 8 corners: bottom a,b,c,d then top a,b,c,d.
  const faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  for (const f of faces) g.quad(c[f[0]], c[f[1]], c[f[2]], c[f[3]], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
}

function boxCorners([x0, y0, z0, x1, y1, z1]) {
  return [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
}

function tubeCorners(a, b, w, h) {
  const dir = norm(sub(b, a));
  const hd = norm([dir[0], 0, dir[2]]);
  const side = [-hd[2], 0, hd[0]];
  const s = mul(side, w / 2), u = [0, h, 0];
  return [sub(a, s), add(a, s), add(b, s), sub(b, s), add(sub(a, s), u), add(add(a, s), u), add(add(b, s), u), add(sub(b, s), u)];
}

export function buildXray(scene, spaces) {
  const known = new Geo(), found = new Geo();
  for (const sp of spaces) {
    if (sp.name === 'coffer') continue;
    solid(known, sp.box ? boxCorners(sp.box) : tubeCorners(sp.a, sp.b, sp.w, sp.h));
  }
  // The relieving chambers: five low spaces above the King's Chamber, granite beams between, to 21.11 m above its
  // floor (Vyse, unverified). Drawn evenly spaced in that height.
  const K = KING;
  const x1 = K.east + 0.3, x0 = x1 - RELIEVING.length;
  const z1 = K.north + 0.0, z0 = z1 - RELIEVING.width;
  const span = RELIEVING.top - K.ceiling;
  for (let i = 0; i < RELIEVING.count; i++) {
    const yb = K.ceiling + (span * (i + 0.45)) / (RELIEVING.count + 0.5);
    solid(found, boxCorners([x0, yb, z0, x1, yb + (i === RELIEVING.count - 1 ? 2.2 : 0.9), z1]));
  }
  // The North Face Corridor (SP23): 9.06 m long behind the chevrons.
  const ch = chevrons();
  const n = ENTRANCE.nfc;
  const zN = ch.face - n.behind;
  solid(found, boxCorners([ENTRANCE.x - n.width / 2, n.floor, zN - n.length, ENTRANCE.x + n.width / 2, n.floor + n.height, zN]));
  // The Big Void (SP17): at least 30 m, over the gallery, like it in section. Its place is uncertain.
  const G = GALLERY;
  const mid = mul(add(G.a, G.b), 0.5);
  const dir = norm(sub(G.b, G.a));
  const a = add(add(mid, mul(dir, -VOID.length / 2)), [0, VOID.above, 0]);
  const b = add(add(mid, mul(dir, VOID.length / 2)), [0, VOID.above, 0]);
  solid(found, tubeCorners(a, b, VOID.width, VOID.height));

  const mk = known.mesh('xray-known', scene);
  mk.material = glow(scene, 'xray-known', '#ffb347', 0.85);
  const mf = found.mesh('xray-found', scene);
  mf.material = glow(scene, 'xray-found', '#5ab4ff', 0.55);
  for (const m of [mk, mf]) {
    m.isPickable = false;
    m.renderingGroupId = 2;
    m.setEnabled(false);
    m.sideOrientation = Mesh.DOUBLESIDE;
  }
  return [mk, mf];
}
