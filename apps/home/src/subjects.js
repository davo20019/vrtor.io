// Short links: vrtor.io/<code> opens that subject's WebXR app.
// Codes are three or four letters (quick to type with a controller); the full word works too.
// A subject is one of:
//   - `service`: its own Worker in this repo (apps/<code>), served right here at
//     vrtor.io/<code>/ through that service binding (see wrangler.jsonc)
//   - `url`: an app hosted elsewhere, reached by redirect
//   - neither: coming soon, redirects to the catalog on the homepage

const COMMUNICATION = { name: 'Communication', url: 'https://accent.learnenglishsounds.com/vr' };
const MACHU = { name: 'Machu Picchu', code: 'mpc', service: 'MPC' };
const TAJ = { name: 'Taj Mahal', code: 'taj', service: 'TAJ' };
const SPACE = { name: 'Space', code: 'spc', service: 'SPC' };
const APOLLO = { name: 'Apollo 11', code: 'apo', service: 'APO' };
const FLYER = { name: 'Wright Flyer', code: 'fly', service: 'FLY' };
const ORCA = { name: 'Orca', code: 'orca', service: 'ORCA' };
// Unlisted experiment: Google's photorealistic Earth in VR (apps/geo).
const EARTH = { name: 'Earth', code: 'geo', service: 'GEO' };
// A skydive over Interlaken from swisstopo data (apps/jump).
const JUMP = { name: 'Parachute', code: 'jump', service: 'JUMP' };
// A full-size Cybertruck to walk around and sit in, built with the build-3d-model skill (apps/cyb).
const CYB = { name: 'Cybertruck', code: 'cyb', service: 'CYB' };
const MECHANICS = { name: 'Mechanics' };
const MATH = { name: 'Math' };
const NATURE = { name: 'Nature' };

export const SUBJECTS = {
  com: COMMUNICATION,
  communication: COMMUNICATION,
  // Earlier links to the same app
  ac: COMMUNICATION,
  accent: COMMUNICATION,
  acento: COMMUNICATION,
  speak: COMMUNICATION,

  mpc: MACHU,
  'machu-picchu': MACHU,
  machupicchu: MACHU,

  taj: TAJ,
  'taj-mahal': TAJ,
  tajmahal: TAJ,

  spc: SPACE,
  space: SPACE,

  apo: APOLLO,
  apollo: APOLLO,
  apollo11: APOLLO,
  'apollo-11': APOLLO,

  fly: FLYER,
  flyer: FLYER,
  wright: FLYER,
  'wright-flyer': FLYER,
  wrightflyer: FLYER,
  kittyhawk: FLYER,
  'kitty-hawk': FLYER,

  orca: ORCA,
  orcas: ORCA,
  'killer-whale': ORCA,
  killerwhale: ORCA,
  whale: ORCA,
  whales: ORCA,

  geo: EARTH,
  earth: EARTH,

  jump: JUMP,

  cyb: CYB,
  cybertruck: CYB,
  truck: CYB,

  mec: MECHANICS,
  mechanics: MECHANICS,
  mat: MATH,
  math: MATH,
  nat: NATURE,
  nature: NATURE,
};
