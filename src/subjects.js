// Short links: vrtor.io/<code> opens that subject's WebXR app.
// Codes are three letters (quick to type with a controller); the full word works too.
// Subjects without a url are coming soon and redirect to the catalog on the homepage.

const COMMUNICATION = { name: 'Communication', url: 'https://accent.learnenglishsounds.com/vr' };
const SPACE = { name: 'Space' };
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
