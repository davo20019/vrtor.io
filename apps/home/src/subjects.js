// Short links: vrtor.io/<code> opens that subject's WebXR app.
// Codes are three letters (quick to type with a controller); the full word works too.
// A subject is one of:
//   - `service`: its own Worker in this repo (apps/<code>), served right here at
//     vrtor.io/<code>/ through that service binding (see wrangler.jsonc)
//   - `url`: an app hosted elsewhere, reached by redirect
//   - neither: coming soon, redirects to the catalog on the homepage

const COMMUNICATION = { name: 'Communication', url: 'https://accent.learnenglishsounds.com/vr' };
const SPACE = { name: 'Space', code: 'spc', service: 'SPC' };
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

  spc: SPACE,
  space: SPACE,
  mec: MECHANICS,
  mechanics: MECHANICS,
  mat: MATH,
  math: MATH,
  nat: NATURE,
  nature: NATURE,
};
