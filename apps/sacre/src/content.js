// What the card says, and where each stop of the tour is on the canvas. Positions are fractions of the photograph
// (0,0 top left), measured on it (assets-src/sacre/spec.md, "Tour"); every date and size has its source there.

export const ABOUT = {
  intro: {
    kicker: 'Jacques-Louis David, 1805 to 1807',
    title: 'The Coronation of Napoleon',
    text: 'Notre-Dame de Paris, 2 December 1804: Napoleon, already crowned, lifts a crown over Joséphine, kneeling. David painted it life size, on a canvas 9.79 m wide and 6.21 m high. Walk up to it, take the tour of the people in it, or light it from the side.',
    fact: 'Napoleon asked for it in September 1804. David started on 21 December 1805 in a disused church near the Sorbonne, and finished in January 1808 with his pupil Georges Rouget.',
  },
  painting: {
    kicker: 'The painted face',
    title: 'Oil on canvas',
    text: 'What you see is a photograph of the whole painting in its room, laid onto the canvas at its real size. A pixel of it covers about 0.8 mm. Get very close and it softens before the painting itself would.',
    fact: 'Across the canvas, a third of the way down, runs a seam: the canvas is two widths of cloth sewn together. Light it from the side to see it.',
  },
  back: {
    kicker: 'Behind it',
    title: 'Lining and stretcher',
    text: 'Behind the painted canvas is a second canvas glued on to strengthen it, the lining, and the whole is nailed round a wooden stretcher with crossbars, so it stays taut.',
    fact: 'The stretcher\'s bars and their sizes here are estimates: the museum publishes no drawing of the back.',
  },
  frame: {
    kicker: 'Around it',
    title: 'The gilt frame',
    text: 'A water-leaf band at the edge of the picture, a wide plain frieze, and an egg-and-dart moulding outside. The plaque on the bottom rail gives the painter and the subject.',
    fact: 'Its width, about 36 cm, is measured on photographs of it on the wall; its ornament is drawn to match them, not a copy of the carving.',
  },
  light: {
    kicker: 'Raking light',
    title: 'Light from the side',
    text: 'Conservators light a painting from a low angle to see its surface. Here it finds the seam across the canvas and the weave of the cloth under the paint.',
    fact: 'The seam\'s place is measured on the photograph; the depth of the relief and the weave\'s thread count are estimates.',
  },
};

export const TOUR = [
  {
    id: 'napoleon', at: [0.585, 0.593], radius: 1.6,
    kicker: 'At the centre', title: 'Napoleon',
    text: 'He has crowned himself already: the laurel wreath is on his head. Now he lifts the crown he will lay on Joséphine. David first drew him crowning himself, and in the end chose this gentler moment.',
    fact: 'Look at the arms: you can still read the first gesture in the way he holds the crown up, as if over his own head.',
  },
  {
    id: 'josephine', at: [0.498, 0.724], radius: 1.5,
    kicker: 'Kneeling', title: 'Joséphine',
    text: 'The new empress kneels on the steps, hands joined, her long red mantle carried by her ladies. She was 41; David painted her younger.',
    fact: 'The woman holding the mantle directly behind her, on the right, is Elisabeth de Montmorency-Laval.',
  },
  {
    id: 'pope', at: [0.675, 0.639], radius: 1.5,
    kicker: 'Behind Napoleon', title: 'Pope Pius VII',
    text: 'The Pope came from Rome for the ceremony and sits to one side. Napoleon had David make him raise his hand in blessing.',
    fact: 'He is there, but he does not crown anyone: Napoleon did that himself.',
  },
  {
    id: 'mother', at: [0.446, 0.526], radius: 1.8,
    kicker: 'In the box, in the middle', title: 'Napoleon\'s mother',
    text: 'Letizia Bonaparte, "Madame Mère", sits in the place of honour, higher than the Pope. She did not come: she stayed away over Napoleon\'s quarrel with his brothers Lucien and Joseph.',
    fact: 'Napoleon had her painted in all the same.',
  },
  {
    id: 'pieta', at: [0.95, 0.3], radius: 2.2,
    kicker: 'At the right edge', title: 'The Pietà of Notre-Dame',
    text: 'Behind the altar, cut by the edge of the canvas, is the marble group of the cathedral\'s choir: the dead Christ across Mary\'s knees.',
    fact: 'Nicolas Coustou carved it in the early 18th century, and it is still in the cathedral\'s choir.',
  },
  {
    id: 'signature', at: [0.975, 0.975], radius: 0.9,
    kicker: 'Bottom right', title: 'David\'s signature',
    text: 'Signed in black on the green of the floor, low in the corner. The dates are at the other end, bottom left.',
    fact: 'David kept the painting until 1819. It went to Versailles under Louis-Philippe and came to the Louvre in 1889.',
  },
];

export const SOURCES = 'Musée du Louvre, INV 3699 (POP, Joconde) · photograph of the painting by Shonagon, 2025 (public domain, Wikimedia Commons) · Wikipedia, "The Coronation of Napoleon"';

// Which ABOUT entry a picked mesh opens.
export function aboutFor(name) {
  if (name.startsWith('paint_')) return 'painting';
  if (name.startsWith('member') || name.startsWith('bar_') || name === 'lining' || name === 'tacking') return 'back';
  if (name.startsWith('frame') || name.startsWith('plaque')) return 'frame';
  return ABOUT[name] ? name : 'intro';
}
