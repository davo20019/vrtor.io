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
// A full-size Cybertruck to walk around and sit in, built with the building-3d-replicas skill (apps/cyb).
const CYB = { name: 'Cybertruck', code: 'cyb', service: 'CYB' };
// The second-generation Roadster revealed on 15 October 2026, built the same way from the reveal photos (apps/rds).
const RDS = { name: 'Roadster', code: 'rds', service: 'RDS' };
// The human body from BodyParts3D's 2,234 parts, each of which comes out (apps/bdy).
const BODY = { name: 'Body', code: 'bdy', service: 'BDY' };
// The foundations of AI, hands-on: data, a neuron, error, gradient descent and a network (apps/aif).
const AIF = { name: 'AI foundations', code: 'aif', service: 'AIF' };
// An animal cell and a plant cell 150,000 times life size, every part to scale and able to come out (apps/cel).
const CELL = { name: 'The cell', code: 'cel', service: 'CEL' };
// A normal adult heart from the average of 19 adults' CT, beating, its valves opening and shutting (apps/hrt).
const HEART = { name: 'The heart', code: 'hrt', service: 'HRT' };
const SOUND_LAB = { name: 'Sound Lab', code: 'snd', service: 'SND' };
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

  snd: SOUND_LAB,
  sounds: SOUND_LAB,
  'sound-lab': SOUND_LAB,
  english: SOUND_LAB,

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

  rds: RDS,
  roadster: RDS,
  'tesla-roadster': RDS,

  bdy: BODY,
  body: BODY,
  'human-body': BODY,
  anatomy: BODY,

  aif: AIF,
  ai: AIF,
  'ai-foundations': AIF,
  'machine-learning': AIF,
  ml: AIF,

  cel: CELL,
  cell: CELL,
  cells: CELL,
  'the-cell': CELL,
  'plant-cell': CELL,
  'animal-cell': CELL,
  celula: CELL,

  hrt: HEART,
  heart: HEART,
  'the-heart': HEART,
  'human-heart': HEART,
  corazon: HEART,
  coeur: HEART,
  cuore: HEART,
  coracao: HEART,

  mec: MECHANICS,
  mechanics: MECHANICS,
  mat: MATH,
  math: MATH,
  nat: NATURE,
  nature: NATURE,
};
