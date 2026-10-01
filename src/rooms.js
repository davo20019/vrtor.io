// Short links for each room. vrtor.io/<slug> redirects to the room's app.
// Primary slugs are two letters: people type these with a VR controller.
// Longer names are kept as aliases for anyone who guesses the full word.

const ACCENT = { name: 'Accent', url: 'https://accent.learnenglishsounds.com/vr' };

export const ROOMS = {
  ac: ACCENT,
  accent: ACCENT,
  acento: ACCENT,
  speak: ACCENT,
  // Planned rooms (no url yet): iv = Interview, cf = Café, sc = Scale
};
