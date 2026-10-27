// What the card says, and where each stop of the tour stands. Every size and date has its source in
// assets-src/giza/refs/survey.md; places are in survey.js's frame (x east, y up, z north, metres).
import { ANTE, GALLERY, KING, PASSAGES, PIT, QUEEN, S, TUNNEL } from './survey.js';
import { chevrons } from './exterior.js';
import { coreFaceZ } from './interior.js';

const IN = 0.0254;

export const ABOUT = {
  intro: {
    kicker: 'Giza, Egypt · about 2560 BC',
    title: 'The Great Pyramid',
    text: "Built for the king Khufu, and the largest of the three pyramids of Giza. This one is at its real size, course by course from Flinders Petrie's survey of 1880 to 1882: 230.35 m a side, its 203 courses of stone standing 138.5 m high. Walk round it, climb it, then go inside.",
    fact: 'It was the tallest building in the world for nearly 4,000 years. Its sides line up with north, south, east and west to within 4 minutes of a degree.',
  },
  built: {
    kicker: 'As it was finished',
    title: 'The casing',
    text: 'It was faced with fine white limestone from Tura across the Nile, cut to a smooth slope of 51° 52′ and fitted with joints half a millimetre wide, to a point 146.71 m up. Almost all of it was taken away after an earthquake in 1303, to build Cairo.',
    fact: "Its height is Petrie's, from the base and the angle of the casing stones still in place. What crowned the top is not known.",
  },
  today: {
    kicker: 'As it stands',
    title: 'The core',
    text: 'Without its casing, what you see is the core: local limestone in steps, one course of blocks each, from 1.49 m high at the foot to about half a metre near the top. The faces are slightly hollowed, deepest down the middle.',
    fact: 'The top is a platform about 11 m across, at course 201. The courses here are Petrie\'s levels, measured at the corners.',
  },
  xray: {
    kicker: 'Seen through',
    title: 'Inside the pyramid',
    text: 'The passages and chambers: the descending passage down into the rock, the ascending passage and Grand Gallery up to the King\'s Chamber, the Queen\'s Chamber, and Al-Ma\'mun\'s tunnel. In blue, what the ScanPyramids project found with cosmic rays: a corridor behind the chevrons, and a large void over the gallery.',
    fact: 'The corridor\'s size is measured (2023). The void\'s place and shape are known only roughly: it is drawn here as the 2017 paper describes it, at least 30 m long.',
  },
  light: {
    kicker: 'The sun over Giza',
    title: 'Time of day',
    text: 'The sun as it moves at Giza\'s latitude, 30° north, at the equinox: rising due east, high at noon, setting due west. Watch the steps catch the light.',
    fact: '',
  },
};

/** Tour stops: stand (feet) and look at. inside: whether it is within the pyramid. */
export function tour() {
  const ch = chevrons();
  const X = 287 * IN;
  const D = PASSAGES.descending, A = PASSAGES.ascending, G = GALLERY;
  const along = (p, s) => {
    const d = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]];
    const l = Math.hypot(...d);
    return [p.a[0] + (d[0] * s) / l, p.a[1] + (d[1] * s) / l, p.a[2] + (d[2] * s) / l];
  };
  const mouthZ = coreFaceZ(TUNNEL.floor + 1, TUNNEL.x) + 0.4;
  const yF = 668.2 * IN - (4010.0 * IN - ch.face) * Math.tan((26.52 * Math.PI) / 180);
  return [
    {
      id: 'north', kicker: 'Outside', title: 'The north face', stand: [24, -0.53, 190], at: [0, 50, 0],
      text: 'You are 75 m from its foot, looking south. The opening high up on the left of the middle is the original entrance, 17 m up, with its great gabled blocks. The lower, ragged hole is the tunnel robbers forced in the 9th century: it is still the way in.',
      fact: 'Behind you, the ground falls to the Nile valley; Khafre\'s pyramid stands to the south-west, on ground 10 m higher, and looks the taller for it.',
    },
    {
      id: 'corner', kicker: 'Outside', title: 'The north-east corner', stand: [128, -0.53, 131], at: [100, 18, 100],
      text: 'Each course is one layer of blocks. At the foot the first is 1.49 m high; up here they thin out, and some are thicker again, as the quarries gave. The corners are worn round: their blocks were the easiest to prise away.',
      fact: 'The four sides differ in length by less than 5 cm in Petrie\'s survey, and by 8 cm in Dash\'s of 2015.',
    },
    {
      id: 'casing', kicker: 'Outside', title: 'The last casing stones', stand: [-3, 0, S.half + 6.5], at: [-0.5, 0.6, S.half - 1],
      text: 'These few blocks at the middle of the north side are all that is left in place of the casing that covered the whole pyramid. Their sloping face is the angle of the pyramid itself, 51° 52′.',
      fact: 'Petrie found their joints to be half a millimetre wide on average, and cemented, on stones of some 16 tonnes.',
    },
    {
      id: 'entrance', kicker: 'Outside', title: 'The original entrance', stand: [X, yF, ch.face + 1.0], at: [X, ch.spring + 1.5, ch.face],
      text: 'The doorway was in the face of the casing, 16.97 m up and 7.29 m east of the middle. Above it lean two pairs of huge limestone blocks, set like a gable at 50° 28′, to carry the weight of the stone above off the passage.',
      fact: 'In 2023 ScanPyramids confirmed a corridor 9 m long and 2 m wide right behind these blocks, found with cosmic-ray muons and looked into with an endoscope.',
    },
    {
      id: 'tunnel', kicker: 'Inside', title: "Al-Ma'mun's tunnel", inside: true, stand: [TUNNEL.x, TUNNEL.floor, mouthZ - 6], at: [TUNNEL.x, TUNNEL.floor + 1.3, mouthZ - 20],
      text: 'Hacked through the 6th and 7th courses, about 7 m up, and straight in for some 27 m, then left, to come out above the granite plugs that block the ascending passage. Tradition names the caliph al-Ma\'mun, about AD 820.',
      fact: 'The plugs could not be cut, so the tunnel goes round them through the softer limestone.',
    },
    {
      id: 'ascending', kicker: 'Inside', title: 'The ascending passage', inside: true, stand: along(A, 7.6), at: along(A, 20).map((v, i) => (i === 1 ? v + 1 : v)),
      text: 'Just over a metre wide and 1.2 m high, rising at 26° for 39.3 m. You climb it bent double. Below you are the three granite plugs that sealed it from the descending passage.',
      fact: 'Every 10 cubits (5.24 m) a girdle stone wraps right round the passage.',
    },
    {
      id: 'gallery', kicker: 'Inside', title: 'The Grand Gallery', inside: true, stand: along(G, 1.2), at: along(G, 20).map((v, i) => (i === 1 ? v + 5.5 : v)),
      text: 'Suddenly 8.6 m high and 47 m long. The walls rise straight for 2.3 m, then step inwards seven times, a palm\'s width each, to a roof 1.05 m wide. Along both sides run ramps, cut with slots in pairs.',
      fact: 'The roof is made of separate slabs, each set a little steeper than the floor and hooked into notches in the walls, so no slab pushes on the next.',
    },
    {
      id: 'step', kicker: 'Inside', title: 'The great step', inside: true, stand: [G.b[0], G.step.top, G.step.z - 0.7], at: along(G, 25),
      text: 'At the top of the gallery, a step 0.9 m high, almost exactly on the pyramid\'s middle. Look back down: the passage you came up is lined up with the gallery\'s floor all the way.',
      fact: 'The face of the step is 1 cm south of the pyramid\'s east-west centre line, by Petrie\'s measure.',
    },
    {
      id: 'ante', kicker: 'Inside', title: 'The antechamber', inside: true, stand: [ANTE.x, ANTE.floor, -2.45], at: [ANTE.x, ANTE.floor + 0.75, ANTE.south],
      text: 'A small room of granite, where three stone portcullises once dropped in slots to close the way. Across it hangs the granite leaf: duck under it.',
      fact: 'The leaf is two stones, about 40 cm thick, resting in grooves in the walls.',
    },
    {
      id: 'king', kicker: 'Inside', title: "The King's Chamber", inside: true, stand: [KING.east - 1.1, KING.floor, KING.north - 1.3], at: [KING.west + 1.0, KING.floor + 0.9, (KING.north + KING.south) / 2],
      text: 'Red granite from Aswan, 900 km up the Nile: 10.47 m by 5.24 m and 5.84 m high, a 2 by 1 room in royal cubits of 52.4 cm. Nine granite beams make the roof. At the west end stands the coffer, its lid long gone.',
      fact: 'The coffer is wider than the passages: it must have been put here as the chamber was built.',
    },
    {
      id: 'queen', kicker: 'Inside', title: "The Queen's Chamber", inside: true, stand: [QUEEN.east - 1.0, QUEEN.footing, QUEEN.north - 0.8], at: [QUEEN.east, QUEEN.footing + 2, QUEEN.niche.offset],
      text: 'Exactly on the pyramid\'s east-west centre line, under a pitched roof of limestone. Its floor was never finished. In the east wall is a niche that steps in five times as it rises.',
      fact: 'The name is a mistake of early explorers: nobody knows it was meant for a queen.',
    },
    {
      id: 'pit', kicker: 'Inside', title: 'The subterranean chamber', inside: true, stand: [PIT.east - 1.2, PIT.floor, PIT.north - 1.0], at: [PIT.west + 2, PIT.floor + 1.2, PIT.south + 2],
      text: '30 m below the base, at the foot of the descending passage, a chamber cut into the bedrock and abandoned unfinished: the west half is still a mass of rock, worked down in steps.',
      fact: 'From here a passage leads on south for 16 m and stops, a rough first cut, in the rock.',
    },
    {
      id: 'top', kicker: 'Outside', title: 'The top', stand: [1, S.levels[201], -2], at: [-343, 60, -345],
      text: 'You are standing on course 201, 137.4 m up, on a platform about 11 m across. The point of the casing was another 9.3 m above you.',
      fact: 'Khafre\'s pyramid, beyond, still has its casing near the top.',
    },
  ];
}

export const SOURCES = 'W. M. F. Petrie, The Pyramids and Temples of Gizeh (1883); G. Dash, AERAGRAM 16-2 (2015); ScanPyramids, Nature 2017, Nature Communications 2023; R. Gantenbrink, Upuaut (1999). Stone surfaces: Poly Haven and ambientCG scans (CC0).';
