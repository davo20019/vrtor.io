// What the card says about each part. Keys are the GLB's node names (assets-src/monalisa/assemble.py); every
// size and date has its source in assets-src/monalisa/spec.md.

export const ABOUT = {
  intro: {
    kicker: 'Leonardo da Vinci, about 1503 to 1519',
    title: 'The Mona Lisa',
    text: 'Not a picture: an object. Oil on a single poplar plank, 79.4 by 53.4 cm and about 13 mm thick, bent by five centuries of damp and dry. The face you see here is the museum laboratory\'s own scan, straightened onto the plank, so every crack in it is a real one. Get as close as you like, light it from the side, then take it off the wall and turn it over.',
    fact: 'Most likely Lisa Gherardini, wife of the Florentine silk merchant Francesco del Giocondo: hence La Gioconda, La Joconde.',
  },
  painting: {
    kicker: 'The painted face',
    title: 'Sfumato, under old varnish',
    text: 'Leonardo built the shadows from many glazes, each a little darker, so thin that X-ray fluorescence measured them in thousandths of a millimetre. No line marks where a cheek ends. The yellow-green cast is mostly old varnish: under it the sky and the far landscape are bluer.',
    fact: 'The fine net of cracks is craquelure: the paint and varnish broke as the wood under them swelled and shrank, year after year.',
  },
  panel_wood: {
    kicker: 'The support',
    title: 'One plank of poplar',
    text: 'Painted on a single board of white poplar, about 13 mm thick, its grain running from top to bottom. Wood moves with the air\'s moisture, and this plank has bowed towards you, most on the left: 11 mm at its most, measured by the scientists who watch it.',
    fact: 'The edges were never cut: bare wood shows all round, with a ridge of paint (the "barbe") where the brush met the frame Leonardo painted it in.',
  },
  crack_lining: {
    kicker: 'The back',
    title: 'The crack',
    text: 'A split runs down from the top edge, about 11 cm long, as far as her hairline. You can find it on the front too, a pale line in the sky above her head. Restorers stopped it with butterfly-shaped keys and, later, a strip of canvas glued along it.',
    fact: 'The split is why the warp is largest on the left.',
  },
  key: {
    kicker: 'The back',
    title: 'A walnut butterfly',
    text: 'Two walnut keys, wide at the ends and narrow in the middle, were let into the back across the crack, a third of the way into the wood, to hold its two sides together. When is not known: somewhere between the mid-18th and early 19th century.',
    fact: 'This is the lower one, still in place. Its position and size here are estimates: the museum publishes no drawing.',
  },
  socket: {
    kicker: 'The back',
    title: 'The missing key',
    text: 'The upper butterfly key is gone. It fell out between 1888 and 1905, or perhaps while the painting was stolen in 1911. A restorer lined its empty socket with canvas.',
    fact: 'From August 1911 to December 1913 the painting was hidden in a Paris room and then a Florence flat by the thief, Vincenzo Peruggia.',
  },
  chassis: {
    kicker: 'Holding it',
    title: 'The oak châssis',
    text: 'Since 1951 the panel has sat in a flexible oak frame, its châssis-cadre, pressed against the front lip by crossbars across the back, so it can move with the seasons without being forced flat. The crossbars were beech, then maple from 1970, then sycamore from 2004, with one of metal that measures the bend.',
    fact: 'The sizes of the châssis and its bars here are estimates.',
  },
  frame: {
    kicker: 'Around it',
    title: 'A Renaissance frame',
    text: 'The gilded frame was given in 1909 by the Comtesse de Béhague, a collector. It is not the painting\'s first: nobody knows what Leonardo\'s looked like. Outside, frame and painting measure 101 by 77 cm.',
    fact: 'Its outer size is the museum\'s; the moulding and carving here are a stand-in, not a copy, because no measured drawing of it is published.',
  },
  light: {
    kicker: 'Raking light',
    title: 'Light from the side',
    text: 'Conservators light a painting from a low angle to see its surface: every crack and lump throws a shadow, and the bend of the plank shows as a slow change in the shine.',
    fact: 'The relief here is read from the scan\'s fine dark lines, not measured, so it is right where the cracks are and only roughly right in how deep they are.',
  },
};

export const SOURCES = 'Musée du Louvre, collections INV 779 · C2RMF scan (public domain, Wikimedia Commons) · Mona Lisa Project (Gril, Dionisi-Vici, Riparbelli et al.)';

// Which ABOUT entry a picked mesh opens.
export function aboutFor(name) {
  if (name.startsWith('crossbar') || name.startsWith('chassis')) return 'chassis';
  if (name === 'panel_wood_primitive0' || name === 'panel_wood') return 'painting';
  if (name.startsWith('panel_wood')) return 'panel_wood';
  if (name.startsWith('frame')) return 'frame';
  return ABOUT[name] ? name : 'intro';
}
