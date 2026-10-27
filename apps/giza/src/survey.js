// Every size the pyramid is built from, in metres, with its source. The sources and the reasoning are in
// assets-src/giza/refs/survey.md (P = Petrie 1883, by section; D15 = Dash 2015; G = Gantenbrink; SP23 = ScanPyramids
// 2023); assets-src/giza/spec.md lists what is estimated.
//
// Frame (Petrie's own, P §35 note 1): the origin is the centre of the base at pavement level, where the casing stood.
// x is east, z is north, y is up: Babylon's left-handed frame, so looking north, east is on your right. Axes run
// along the pyramid's sides, which lie 3' 43" anticlockwise of true north (P §21); north here is the pyramid's.
import { LEVELS } from './levels.js';

const IN = 0.0254;
const deg = (d, m = 0, s = 0) => ((d + m / 60 + s / 3600) * Math.PI) / 180;

export const S = {
  // Mean side of the casing at the pavement, 9068.8 in (P §21). Dash 2015 gives 230.363 m.
  base: 9068.8 * IN,
  // Petrie's adopted mean angle of the faces, 51° 52' ± 2' (P §25), which with the base gives his height.
  slope: deg(51, 52),
  levels: LEVELS,
  // The core stands back from the line of the lost casing: 33.7 in at the corners on the pavement (P §26), and at the
  // platform of course 201 the core's mean planes are 1.64 to 1.90 m inside it (P §25, mean 1.81).
  coreRecessBase: 33.7 * IN,
  coreRecessTop: 1.81,
  // The faces are hollowed: 37 in deeper at the middle of the north face than at its corners (P §26). Petrie gives no
  // figure for the other faces; the same is used for all four (spec.md, "Hollowing").
  hollow: 37 * IN,
  cornerOverlap: 0,
  // Pavement: 0.43 to 0.69 m thick (P §27); the platform reaches 0.39 to 0.47 m beyond the casing (D15).
  pavement: { thick: 21 * IN, beyond: 0.43 },
  // Casing in place: course 1 at the middle of the north side, 1.495 m high, 1.575 m deep at the top and 2.743 m at the
  // bottom (P §26). Their extent along the side is estimated (spec.md).
  casingStones: { u0: -6.5, u1: 5.5, height: 58.85 * IN, top: 62 * IN, bottom: 108 * IN },
};
S.half = S.base / 2;
S.tan = Math.tan(S.slope);
S.apex = S.half * S.tan; // 146.71 m: Petrie's 5776.0 ± 7.0 in (P §25)

/** The casing's half-width at height y. */
export function casingHalf(y) {
  return (S.apex - y) / S.tan;
}

/** How far the core stands behind the casing line at height y and `u` along a face (0 at its middle). */
export function coreRecess(y, u, half) {
  const t = Math.min(1, Math.max(0, y / LEVELS[201]));
  const corner = S.coreRecessBase + (S.coreRecessTop - S.coreRecessBase) * t;
  // The hollowing grows with the face: none at the top, the full 0.94 m at the foot. A general curve, and "a sort of
  // groove specially down the middle" (P §26).
  const x = Math.min(1, Math.abs(u) / Math.max(half, 1e-3));
  const scale = Math.min(1, half / S.half);
  const curve = 0.75 * (1 - x * x) + 0.25 * Math.exp(-((x / 0.06) ** 2));
  return corner + S.hollow * scale * curve;
}

// ---------------------------------------------------------------- the passages (P §35-64)

// All the passages lie in a vertical plane east of the centre: 287.0 in at the entrance (P §35), 284.4 at the top of
// the gallery (P §45).
const X0 = 287.0 * IN;

/**
 * Each passage by the line of its floor's middle, from `a` to `b` ([x, y, z]), with its width and its height measured
 * square to the floor (P §30: 41.53 by 47.24 in). `rock`: cut in the bedrock rather than built.
 */
export const PASSAGES = {
  // The descending passage: from the doorway at the casing face, 16.972 m up and 101.854 m N of centre, down at
  // 26° 31' 23" to its south end at -29.997 m, 7.772 m N (P §35, §36, §64). Built for its first 34.3 m (P §35).
  descending: { a: [X0, 668.2 * IN, 4010.0 * IN], b: [286.4 * IN, -1181 * IN, 306 * IN], width: 41.53 * IN, height: 47.24 * IN, builtTo: 1350.7 * IN },
  // The lower horizontal passage to the subterranean chamber: 8.79 m, about 0.82 m wide and 0.85 high (P §37, §64).
  lower: { a: [286.4 * IN, -1181 * IN, 306 * IN], b: [286.3 * IN, -1178 * IN, -40 * IN], width: 32.2 * IN, height: 34 * IN, rock: true },
  // The dead-end passage beyond the chamber: 16.4 m, about 0.72 m square (P §37, §64).
  deadEnd: { a: [284.9 * IN, -1219 * IN, -366 * IN], b: [277.1 * IN, -1213 * IN, -1012 * IN], width: 28.4 * IN, height: 28 * IN, rock: true },
  // The ascending passage: from the junction on the descending passage's floor line, 4.569 m up and 76.614 m N, to the
  // gallery's north wall at 21.656 m, 41.321 m N (P §38, §39, §64). 41.6 in wide, 38.2 at its lower end; 47.3 high.
  ascending: { a: [286.6 * IN, 179.9 * IN, 3016.3 * IN], b: [X0, 852.6 * IN, 1626.8 * IN], width: 41.6 * IN, height: 47.3 * IN },
  // The horizontal passage to the Queen's Chamber: floor 858 to 854 in, roof 904 to 901 in; a step down to 834.9 in at
  // 319.8 in N of centre; the chamber's north wall at 102.9 in N (P §40).
  queens: { a: [X0, 856.5 * IN, 1626.8 * IN], b: [X0, 854.6 * IN, 102.9 * IN], width: 41.3 * IN, roof: 902.3 * IN, step: { z: 319.8 * IN, floor: 834.9 * IN } },
};

// The plugs: three of red granite, 1.57, 1.67 and 1.0 m (W, citing Dormion), from 74.19 in up the ascending passage to
// 252.7 in now (P §38).
export const PLUGS = { from: 74.19 * IN, to: 252.7 * IN, lengths: [1.57, 1.67, 1.0] };

/** The Grand Gallery (P §45, §46). */
export const GALLERY = {
  // From the north wall (the ascending passage's end) to the virtual south end of its floor: 42.901 m up, 1.567 m S,
  // 284.4 in E (P §45).
  a: [X0, 852.6 * IN, 1626.8 * IN],
  b: [284.4 * IN, 1689.0 * IN, -61.7 * IN],
  width: 82.42 * IN, // between the walls at the floor (P §30)
  floor: 41.2 * IN, // between the ramps: 2 cubits (P §46)
  ramp: 23.86 * IN, // the ramps' height (P §30)
  wall: 2.29, // the walls rise straight before the first lap (W, citing Maragioglio & Rinaldi)
  laps: 7, // each lap about 3 in, 20.55 in in all (P §46)
  overhang: 20.55 * IN,
  height: 8.6, // 8.48 to 8.74 m (P §46); W: 8.6 m
  // The roof slabs lie steeper than the floor, 28° 11', each hooked into the wall tops (P §46), 52.2 in typical.
  roofSlope: deg(28, 11),
  slab: 52.2 * IN,
  // The great step: its face 0.4 in S of centre, its top 43.030 m up, 1.55 m long (P §46).
  step: { z: -0.4 * IN, top: 1694.1 * IN, length: 61.25 * IN },
  // Ramp holes: 28 a side, long and short in turn, 23.32 and 20.51 in (P §46; W).
  holes: { count: 28, long: 23.32 * IN, short: 20.51 * IN },
  // The well shaft's upper mouth, in the west ramp, its middle 35.4 in from the north wall (P §46).
  well: 35.4 * IN,
};

/** The antechamber (P §47-50) and the passages either side of it. */
export const ANTE = {
  x: 284.4 * IN,
  floor: 1693.4 * IN,
  north: -113.7 * IN, // N end, S of centre (P §47)
  granite: -126.6 * IN, // where the granite begins
  south: -229.8 * IN,
  width: 65.0 * IN,
  height: 149.35 * IN,
  // The granite leaf: two stones, 15.2 to 16.2 in thick, in grooves; its top 51 to 59 in below the ceiling (P §50).
  leaf: { thick: 15.7 * IN, below: 55 * IN },
  // The low passages either side: 2 cubits wide; their height is estimated (spec.md).
  passage: { width: 41.2 * IN, height: 43.5 * IN },
};

/** The King's Chamber (P §51-61). */
export const KING = {
  north: -330.6 * IN, // walls, from the centre (P §55)
  south: -537.0 * IN,
  east: 305.1 * IN,
  west: -107.7 * IN,
  base: 1688.5 * IN, // the walls' foot (P §55, §64)
  floor: 1692.8 * IN, // the floor, inserted between the walls
  ceiling: 1922.6 * IN,
  course: 47.04 * IN, // five granite courses (P §52)
  // Nine roof beams, their widths along the north side from the east (P §53).
  beams: [22.4, 45.5, 52.5, 49.1, 53.9, 44.8, 58.1, 62.7, 23.3].map((w) => w * IN),
  // The north wall's top-course joints, from its east end (P §52).
  topJoints: [62.1 * IN, 248.8 * IN],
  // The coffer (P §59), and where it stands: its N.W. corner 49.5 in from the north wall and 53.3 from the west (P §58).
  coffer: {
    length: 89.62 * IN, width: 38.5 * IN, height: 41.31 * IN,
    inLength: 78.06 * IN, inWidth: 26.81 * IN, inDepth: 34.42 * IN,
    fromNorth: 49.5 * IN, fromWest: 53.33 * IN,
  },
  // The shafts: inlets about 0.91 m above the floor (W, citing Dormion), their east sides 2.48 m (N) and 2.49 m (S)
  // from the east wall; 21 x 14 cm at the inlet (G). North: level for 2.63 m, then up at 32.6°; south at 45° (G).
  shafts: [
    { wall: 'north', fromEast: 2.48, w: 0.21, h: 0.14, run: 2.63, rise: deg(32, 36) },
    { wall: 'south', fromEast: 2.49, w: 0.18, h: 0.14, run: 0.4, rise: deg(45) },
  ],
};

/** The Queen's Chamber (P §41-43). */
export const QUEEN = {
  north: 102.0 * IN,
  south: 102.0 * IN - 205.85 * IN,
  east: 308.0 * IN,
  west: 308.0 * IN - 226.47 * IN,
  footing: 834.4 * IN,
  wall: 184.47 * IN, // the north and south walls
  ridge: 245.1 * IN, // above the footing; the ridge runs east-west over the centre plane (P §41)
  // The niche in the east wall: 41 in deep, five stages narrowing by 1/4 cubit, its middle 25.19 in S of the ridge.
  niche: {
    depth: 41.07 * IN,
    offset: -25.19 * IN,
    stages: [[0, 67.14, 61.74], [67.14, 98.93, 52.74], [98.93, 127.16, 41.83], [127.16, 156.1, 30.43], [156.1, 183.8, 20.3]].map(([a, b, w]) => [a * IN, b * IN, w * IN]),
  },
  // Shafts: 21 x 21 cm, their east sides 2.90 m (N) and 2.88 m (S) from the east wall (G); level for about 2 m (P §44).
  shafts: [
    { wall: 'north', fromEast: 2.9, w: 0.21, h: 0.21, run: 1.93, rise: deg(37, 28) },
    { wall: 'south', fromEast: 2.88, w: 0.21, h: 0.21, run: 2.03, rise: deg(39, 36) },
  ],
};

/** The subterranean chamber, cut in the rock and never finished (P §37, §64). */
export const PIT = {
  north: -40 * IN,
  south: -366 * IN,
  east: 301.3 * IN,
  west: -252.6 * IN,
  roof: -1056 * IN,
  floor: -1056 * IN - 155 * IN, // the main floor, 155 in below the roof (P §37)
  // The square pit, set nearly diagonally; about 2 m a side and 1.7 m deep in its ancient part (P §37).
  hole: { x: 4.6, z: -5.2, side: 2.0, depth: 67 * IN, turn: 0.6 },
};

/**
 * The entrance on the north face. The gable of the two remaining pairs of chevron blocks: 0.838 m thick, at 50° 28'
 * (P §34). Their lengths below are 107.6 in (lower) and 119 in (upper); their depth across the slope 91 and 114 in.
 * Where they stand on the face is estimated from photographs (spec.md, "Chevrons").
 */
export const ENTRANCE = {
  x: X0,
  chevron: { angle: deg(50, 28), thick: 33 * IN, lower: { soffit: 107.6 * IN, depth: 91 * IN }, upper: { soffit: 119.25 * IN, depth: 114 * IN }, spring: 19.3 },
  // The North Face Corridor: 2.02 x 2.18 m, 9.06 m long, its north end 0.84 m behind the chevron's face, floor about
  // 20 m up, on the passage's line (SP23).
  nfc: { width: 2.02, height: 2.18, length: 9.06, behind: 0.84, floor: 20.0 },
};

/**
 * Al-Ma'mun's tunnel, the way in today: forced through the 6th and 7th courses about 7 m up, straight in for about
 * 27 m, then left to meet the ascending passage above the plugs (W, citing Tyldesley). Its line and section are
 * estimated from photographs (spec.md, "Robbers' tunnel").
 */
export const TUNNEL = { x: 4.4, floor: LEVELS[5] + 0.15, width: 1.9, height: 2.1, length: 27 };

/**
 * The relieving chambers above the King's Chamber: five, to 21.11 m above its floor (Vyse, unverified); their plans
 * from P §62. Shown only seen through.
 */
export const RELIEVING = { count: 5, top: 1692.8 * IN + 21.11, length: 470 * IN, width: 205 * IN };

/** ScanPyramids' Big Void: at least 30 m long, above the gallery, its section like the gallery's (SP17). Uncertain. */
export const VOID = { length: 30, height: 8, width: 2, above: 18 };

/**
 * The other pyramids, seen from afar. centre: [x east, z north] of the centre of the base, from Khufu's.
 * Sizes from Lehner 1997; their places and plateau levels are ESTIMATED from published plans (spec.md, "Neighbours").
 */
export const NEIGHBOURS = [
  // Khafre: 215.25 m, 143.5 m (Lehner 1997). Its casing survives over the top.
  { name: 'khafre', centre: [-343, -345], baseY: 10, base: 215.25, height: 143.5, top: 136.4, course: 0.95, recess: 1.2, seed: 31, cased: [[96, 136.4, 'casing']] },
  // Menkaure: about 103.4 m, 65.5 m. The lower courses keep part of their red granite casing.
  { name: 'menkaure', centre: [-650, -760], baseY: 2, base: 103.4, height: 65.5, top: 62, course: 0.85, recess: 1.0, seed: 47, cased: [[0, 6, 'granite']] },
];
