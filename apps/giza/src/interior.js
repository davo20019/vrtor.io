// The inside, from Petrie's positions (survey.js): the descending passage and the rock-cut chamber at its foot, the
// ascending passage with its granite plugs, the Grand Gallery, the antechamber, the King's Chamber with its coffer,
// the Queen's Chamber, and Al-Ma'mun's tunnel, the way in today.
//
// Everything faces inwards and is lit as it is today, by electric lamps: their light is baked into the vertex colours
// (no lights to compute in the headset). What you walk on is kept apart, as invisible floors for walking and teleport.
import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { Geo, add, cross, dot, fbm, hash, len, mul, norm, sub } from './geom.js';
import { ANTE, ENTRANCE, GALLERY, KING, PASSAGES, PIT, PLUGS, QUEEN, S, TUNNEL, casingHalf, coreRecess } from './survey.js';

const UP = [0, 1, 0];
const E = [1, 0, 0];
const N = [0, 0, 1];

/** The texture's repeat for each stone: fine and core limestone 2 m, granite 1 m, wood 1 m along the grain. */
const TILE = { fine: 2, rock: 2, granite: 1, wood: 1 };

export function buildInterior(scene, mats) {
  const g = { fine: new Geo(), rock: new Geo(), granite: new Geo(), wood: new Geo(), dark: new Geo() };
  const floors = new Geo();
  const lamps = [];
  const spaces = []; // boxes round each space, for the see-through view and for "are you inside?"
  const low = []; // passages too low to stand in: [a, b, width, ceiling-above-floor]

  // UVs: planar on the face's two strongest axes.
  const uvFor = (tile, facing) => (p) => {
    const ax = Math.abs(facing[0]) > 0.7 ? [2, 1] : Math.abs(facing[1]) > 0.7 ? [0, 2] : [0, 1];
    return [p[ax[0]] / tile, p[ax[1]] / tile];
  };
  // A little unevenness in the stone's colour, in patches.
  const tone = (k) => (p) => k * (0.86 + 0.22 * fbm(p[0] + p[2], p[1] * 1.3, 2.3, 5));

  function rect(mat, O, U, V, u0, u1, v0, v1, facing, holes = [], k = 1) {
    g[mat].rect(O, U, V, u0, u1, v0, v1, facing, { holes, uv: uvFor(TILE[mat], facing), col: tone(k) });
  }
  function floor(O, U, V, u0, u1, v0, v1) {
    floors.rect(O, U, V, u0, u1, v0, v1, UP, { cell: 4, uv: () => [0, 0] });
  }
  function lamp(p, power, box, color = [1, 0.82, 0.6]) {
    lamps.push({ p, power, box, color });
  }

  // ---------------------------------------------------------------- a sloping passage

  /**
   * A passage of rectangular section along its floor's mid-line from A to B: width w, height h square to the floor.
   * holes: { floor, roof, east, west } in (s along, t across or v up). Returns its frame for placing things in it.
   */
  function passage(name, A, B, w, h, { mat = 'fine', from = 0, to = null, holes = {}, k = 1, walk = true } = {}) {
    const L = len(sub(B, A));
    const dir = norm(sub(B, A));
    const hd = norm([dir[0], 0, dir[2]]);
    const side = [-hd[2], 0, hd[0]]; // to the right, walking from A to B
    const cosT = Math.hypot(dir[0], dir[2]);
    const hv = h / cosT; // vertical height
    to ??= L;
    const P = (s, t, v) => add(add(add(A, mul(dir, s)), mul(side, t)), mul(UP, v));
    rect(mat, A, dir, side, from, to, -w / 2, w / 2, UP, holes.floor, k * 0.92);
    rect(mat, add(A, mul(UP, hv)), dir, side, from, to, -w / 2, w / 2, mul(UP, -1), holes.roof, k * 0.85);
    rect(mat, add(A, mul(side, w / 2)), dir, UP, from, to, 0, hv, mul(side, -1), holes.right, k);
    rect(mat, add(A, mul(side, -w / 2)), dir, UP, from, to, 0, hv, side, holes.left, k);
    if (walk) floor(A, dir, side, from, to, -w / 2, w / 2);
    const lo = P(from, 0, 0), hi = P(to, 0, 0);
    spaces.push({ name, a: lo, b: hi, w, h: hv });
    if (hv < 1.75) low.push({ a: lo, b: hi, w, h: hv });
    return { A, dir, side, hv, L, P };
  }

  /** An axis-aligned room, inward faces. holes per wall in world coordinates: north/south (x, y), east/west (z, y). */
  function room(name, mat, x0, x1, y0, y1, z0, z1, holes = {}, { k = 1, ceiling = true, floorMat = mat, walk = true } = {}) {
    rect(floorMat, [0, y0, 0], E, N, x0, x1, z0, z1, UP, holes.floor, k * 0.9);
    if (ceiling) rect(mat, [0, y1, 0], E, N, x0, x1, z0, z1, [0, -1, 0], holes.ceiling, k * 0.85);
    rect(mat, [0, 0, z1], E, UP, x0, x1, y0, y1, [0, 0, -1], holes.north, k);
    rect(mat, [0, 0, z0], E, UP, x0, x1, y0, y1, [0, 0, 1], holes.south, k);
    rect(mat, [x1, 0, 0], N, UP, z0, z1, y0, y1, [-1, 0, 0], holes.east, k);
    rect(mat, [x0, 0, 0], N, UP, z0, z1, y0, y1, [1, 0, 0], holes.west, k);
    if (walk) floor([0, y0, 0], E, N, x0, x1, z0, z1);
    spaces.push({ name, box: [x0, y0, z0, x1, y1, z1] });
  }

  // ---------------------------------------------------------------- the descending passage

  const D = PASSAGES.descending;
  // Today it opens where the core face is, under the chevrons; the 3 m in front went with the casing.
  const chevFace = chevronFaceZ();
  const dDir = norm(sub(D.b, D.a));
  const dFrom = (D.a[2] - chevFace) / -dDir[2];
  const dL = len(sub(D.b, D.a));
  // Where the ascending passage leaves its roof: from 28.21 m to 29.73 m along it (P §38; spec.md).
  const junction = 1110.64 * 0.0254;
  // The lower end of the well shaft, in its west wall at 3825 to 3856 in from the entrance (P §35).
  const wellLow = [3825 * 0.0254, 3856 * 0.0254];
  const desc = passage('descending', D.a, D.b, D.width, D.height, {
    from: dFrom,
    holes: { left: [{ u0: wellLow[0], u1: wellLow[1], v0: 0, v1: 0.75 }] },
  });
  // Built of fine limestone for its first 34.3 m, then cut in the rock: the rock part is a little darker and rougher.
  // (One material serves both; the change is in the colour.)
  // The granite underside of the lowest plug, seen in the roof at the junction.
  {
    const a = desc.P(junction + 0.1, -D.width / 2, desc.hv - 0.002), b = desc.P(junction + 1.6, -D.width / 2, desc.hv - 0.002);
    g.granite.face([a, b, add(b, mul(desc.side, D.width)), add(a, mul(desc.side, D.width))], [0, -1, 0], (p) => [p[0], p[2]], () => 0.8);
  }
  for (let s = dFrom + 4; s < dL - 2; s += 9) lamp(desc.P(s, 0, desc.hv - 0.06), 3, boxAround(desc, s, 10));

  // The lower horizontal passage, the chamber, the dead end: all in the rock.
  const Lw = PASSAGES.lower;
  passage('lower', Lw.a, Lw.b, Lw.width, Lw.height, { mat: 'rock', k: 0.85 });
  {
    const p = PIT;
    const y0 = p.floor, y1 = p.roof;
    const door = { u0: Lw.a[0] - Lw.width / 2, u1: Lw.a[0] + Lw.width / 2, v0: y0, v1: Lw.b[1] + Lw.height };
    const de = PASSAGES.deadEnd;
    const doorS = { u0: de.a[0] - de.width / 2, u1: de.a[0] + de.width / 2, v0: de.a[1], v1: de.a[1] + de.height };
    // The floor: never finished. The east half is the main floor; the west rises in rough steps almost to the roof.
    rockFloor(p);
    room('subterranean', 'rock', p.west, p.east, y0, y1, p.south, p.north, { north: [door], south: [doorS] }, { k: 0.8, walk: false });
    lamp([p.east - 0.4, y0 + 0.4, p.north - 0.4], 7, [p.west, y0 - 3, p.south, p.east, y1, p.north]);
    lamp([p.east - 0.4, y0 + 0.4, p.south + 0.4], 7, [p.west, y0 - 3, p.south, p.east, y1, p.north]);
    lamp([(p.east + p.west) / 2, y0 + 1.2, p.north - 0.3], 5, [p.west, y0 - 3, p.south, p.east, y1, p.north]);
  }
  passage('dead end', PASSAGES.deadEnd.a, PASSAGES.deadEnd.b, PASSAGES.deadEnd.width, PASSAGES.deadEnd.height, { mat: 'rock', k: 0.75 });

  // ---------------------------------------------------------------- Al-Ma'mun's tunnel

  const T = TUNNEL;
  const A = PASSAGES.ascending;
  const aDir = norm(sub(A.b, A.a));
  const aLen = len(sub(A.b, A.a));
  // Where the tunnel breaks into the ascending passage: just above the plugs' present top (P §38).
  const breakIn = PLUGS.to + 0.25;
  const asc = { P: (s, t, v) => add(add(add(A.a, mul(aDir, s)), mul([1, 0, 0], t)), mul(UP, v)) };
  {
    const yMouth = T.floor;
    const zMouth = coreFaceZ(yMouth + 1, T.x) + 0.4;
    const zIn = zMouth - T.length;
    // Straight in, level, rough, then left and up to break into the ascending passage's west wall: one bore.
    const target = asc.P(breakIn + 1.1, -A.width / 2 + 0.2, 0);
    // The last metre and a half turns east, square into the passage's wall.
    const turn = [target[0] - 1.5, target[1] - 0.05, target[2] + 0.25];
    tunnel([[T.x, yMouth, zMouth], [T.x, yMouth, zIn + 1.0], [turn[0] - 0.2, turn[1] - 0.25, turn[2] + 1.2], turn, [target[0] + 0.3, target[1], target[2]]], T.width, T.height);
    for (let z = zMouth - 3; z > zIn; z -= 7) lamp([T.x - T.width / 2 + 0.08, yMouth + 1.7, z], 4, [T.x - 4, yMouth - 1, zIn - 4, T.x + 4, yMouth + 5, zMouth + 1]);
  }

  // ---------------------------------------------------------------- the ascending passage

  {
    const hv = A.height / Math.hypot(aDir[0], aDir[2]);
    // Its roof begins over the junction; its floor emerges above the descending passage's roof 1.51 m up (spec.md).
    const ap = passage('ascending', A.a, A.b, A.width, A.height, {
      from: PLUGS.from,
      holes: { left: [{ u0: breakIn + 0.3, u1: breakIn + 1.9, v0: 0, v1: hv }] },
    });
    // The three plugs, granite, as they lie: the lowest at 1.88 m, the top one broken.
    let s = PLUGS.from;
    PLUGS.lengths.forEach((l, i) => {
      const end = Math.min(PLUGS.to, s + l);
      graniteBlock(ap, s + (i ? 0.01 : 0), end, A.width * (i === 0 ? 0.92 : 0.98), hv * 0.98);
      s = end;
    });
    // Today's boardwalk with cleats, from the tunnel to the gallery.
    boardwalk(ap, breakIn, aLen, A.width - 0.08);
    for (let t = breakIn + 2; t < aLen - 1; t += 7) lamp(ap.P(t, A.width / 2 - 0.05, hv - 0.25), 3, boxAround(ap, t, 9));
    // The girdle stones every 10 cubits: a joint all round the passage (P §38).
    for (let t = 10 * 0.5241 * 2; t < aLen; t += 10 * 0.5241) girdle(ap, t, A.width, hv);
  }

  // ---------------------------------------------------------------- the horizontal passage and the Queen's Chamber

  const Qp = PASSAGES.queens;
  const Q = QUEEN;
  // From the gallery's north wall it runs level beneath the gallery's rising floor, which starts 3.9 m on (spec.md).
  const gapEnd = galleryFloorStart();
  {
    const x = Qp.a[0], w = Qp.width;
    const yF = Qp.a[1], yR = Qp.roof;
    const zA = Qp.a[2], zStep = Qp.step.z, zB = Q.north;
    // Before the step: floor at 856 in, roof at 902 in. The first stretch is open above, under the gallery.
    rect('fine', [0, yF, 0], E, N, x - w / 2, x + w / 2, zStep, zA, UP, [], 0.92);
    floor([0, yF, 0], E, N, x - w / 2, x + w / 2, zStep, zA);
    rect('fine', [0, yR, 0], E, N, x - w / 2, x + w / 2, zStep, gapEnd.z, [0, -1, 0], [], 0.85);
    rect('fine', [x + w / 2, 0, 0], N, UP, zStep, zA, yF, yR, [-1, 0, 0], [{ u0: gapEnd.z, u1: zA, v0: yF + 0.6, v1: yR }]);
    rect('fine', [x - w / 2, 0, 0], N, UP, zStep, zA, yF, yR, [1, 0, 0], [{ u0: gapEnd.z, u1: zA, v0: yF + 0.6, v1: yR }]);
    // The step down, then 1.70 m of headroom to the chamber.
    const yS = Qp.step.floor;
    rect('fine', [0, 0, zStep], E, UP, x - w / 2, x + w / 2, yS, yF, [0, 0, -1], [], 0.85);
    rect('fine', [0, yS, 0], E, N, x - w / 2, x + w / 2, zB, zStep, UP, [], 0.92);
    floor([0, yS, 0], E, N, x - w / 2, x + w / 2, zB, zStep);
    rect('fine', [0, yR, 0], E, N, x - w / 2, x + w / 2, zB, zStep, [0, -1, 0], [], 0.85);
    rect('fine', [x + w / 2, 0, 0], N, UP, zB, zStep, yS, yR, [-1, 0, 0]);
    rect('fine', [x - w / 2, 0, 0], N, UP, zB, zStep, yS, yR, [1, 0, 0]);
    spaces.push({ name: "queen's passage", box: [x - w / 2, yS, zB, x + w / 2, yR, zA] });
    low.push({ a: [x, yF, zA], b: [x, yF, zStep], w, h: yR - yF });
    for (let z = zA - 6; z > zB; z -= 8) lamp([x + w / 2 - 0.05, yR - 0.2, z], 3, [x - 3, yS - 1, z - 8, x + 3, yR + 1, z + 8]);

    // The chamber: north and south walls 4.686 m high, a gable roof to 6.226 m over the centre, the niche in the east.
    const y0 = Q.footing, yW = y0 + Q.wall, yR2 = y0 + Q.ridge, zr = 0.008;
    const door = { u0: x - w / 2, u1: x + w / 2, v0: y0, v1: yR };
    const nicheZ = zr + Q.niche.offset;
    const nicheHoles = Q.niche.stages.map(([a, b, wd]) => ({ u0: nicheZ - wd / 2, u1: nicheZ + wd / 2, v0: y0 + a, v1: y0 + b }));
    const shaftHole = (sh, zWall) => {
      const xe = Q.east - sh.fromEast;
      return { u0: xe - sh.w, u1: xe, v0: y0 + 1.6, v1: y0 + 1.6 + sh.h };
    };
    rect('fine', [0, y0, 0], E, N, Q.west, Q.east, Q.south, Q.north, UP, [], 0.8);
    floor([0, y0, 0], E, N, Q.west, Q.east, Q.south, Q.north);
    rect('fine', [0, 0, Q.north], E, UP, Q.west, Q.east, y0, yW, [0, 0, -1], [door, shaftHole(Q.shafts[0])]);
    rect('fine', [0, 0, Q.south], E, UP, Q.west, Q.east, y0, yW, [0, 0, 1], [shaftHole(Q.shafts[1])]);
    rect('fine', [Q.west, 0, 0], N, UP, Q.south, Q.north, y0, yW, [1, 0, 0]);
    rect('fine', [Q.east, 0, 0], N, UP, Q.south, Q.north, y0, yW, [-1, 0, 0], nicheHoles);
    // The gables of the east and west walls, and the two roof slopes.
    for (const [xw, f] of [[Q.west, [1, 0, 0]], [Q.east, [-1, 0, 0]]]) {
      g.fine.face([[xw, yW, Q.north], [xw, yW, zr], [xw, yR2, zr], [xw, yR2, zr]], f, uvFor(2, f), tone(0.9));
      g.fine.face([[xw, yW, zr], [xw, yW, Q.south], [xw, yR2, zr], [xw, yR2, zr]], f, uvFor(2, f), tone(0.9));
      g.fine.face([[xw, yW, Q.north], [xw, yW, Q.south], [xw, yW, zr], [xw, yW, zr]], f, uvFor(2, f), tone(0.9));
    }
    g.fine.rect([0, yW, Q.north], E, norm([0, yR2 - yW, zr - Q.north]), Q.west, Q.east, 0, Math.hypot(yR2 - yW, zr - Q.north), norm([0, -1, -0.6]), { uv: uvFor(2, [0, 1, 0]), col: tone(0.82) });
    g.fine.rect([0, yW, Q.south], E, norm([0, yR2 - yW, zr - Q.south]), Q.west, Q.east, 0, Math.hypot(yR2 - yW, zr - Q.south), norm([0, -1, 0.6]), { uv: uvFor(2, [0, 1, 0]), col: tone(0.82) });
    // The niche's insides: each stage's back and sides, stepping in by a quarter cubit.
    for (const [a, b, wd] of Q.niche.stages) {
      const z0 = nicheZ - wd / 2, z1 = nicheZ + wd / 2, xb = Q.east + Q.niche.depth;
      rect('fine', [xb, 0, 0], N, UP, z0, z1, y0 + a, y0 + b, [-1, 0, 0], [], 0.7);
      rect('fine', [0, 0, z0], E, UP, Q.east, xb, y0 + a, y0 + b, [0, 0, 1], [], 0.75);
      rect('fine', [0, 0, z1], E, UP, Q.east, xb, y0 + a, y0 + b, [0, 0, -1], [], 0.75);
      rect('fine', [0, y0 + b, 0], E, N, Q.east, xb, z0, z1, [0, -1, 0], [], 0.7);
    }
    for (const sh of Q.shafts) shaft(sh, Q, y0 + 1.6);
    spaces.push({ name: "queen's chamber", box: [Q.west, y0, Q.south, Q.east, yR2, Q.north] });
    const qBox = [Q.west, y0 - 1, Q.south, Q.east + 1.2, yR2, Q.north];
    lamp([Q.east - 0.3, y0 + 0.3, Q.north - 0.3], 9, qBox);
    lamp([Q.west + 0.3, y0 + 0.3, Q.south + 0.3], 9, qBox);
  }

  // ---------------------------------------------------------------- the Grand Gallery

  grandGallery();

  // ---------------------------------------------------------------- antechamber and King's Chamber

  {
    const a = ANTE, x = a.x, y0 = a.floor, pw = a.passage.width, ph = a.passage.height;
    const zS = -61.7 * 0.0254; // the gallery's south wall
    // The low passage from the top of the great step to the antechamber.
    const hole = { u0: x - pw / 2, u1: x + pw / 2, v0: y0, v1: y0 + ph };
    lowPassage(x, y0, zS, a.north, pw, ph, 'fine');
    // The antechamber: limestone at its north end, granite from 126.6 in S of centre (P §47).
    const x0 = x - a.width / 2, x1 = x + a.width / 2, yT = y0 + a.height;
    const leafZ0 = a.granite - 0.12, leafZ1 = leafZ0 - a.leaf.thick;
    room('antechamber', 'granite', x0, x1, y0, yT, a.south, a.north, { north: [hole], south: [hole] }, { k: 0.85 });
    // The granite leaf across it, in its grooves, its top 1.4 m below the ceiling; you duck under it.
    const leafTop = yT - a.leaf.below, leafBot = y0 + ph;
    box('granite', x0, x1, leafBot, leafTop, leafZ1, leafZ0, 0.8);
    // Its boss, on the north face.
    box('granite', x - 0.065, x + 0.065, leafTop - 0.4, leafTop - 0.31, leafZ0, leafZ0 + 0.026, 0.8);
    // The three portcullis slots south of it, in both walls, each a cubit wide, with a half-round hollow at the top.
    for (let i = 0; i < 3; i++) {
      const z1 = leafZ1 - 0.12 - i * 0.68, z0 = z1 - 0.53;
      for (const [xw, f] of [[x0, [1, 0, 0]], [x1, [-1, 0, 0]]]) {
        const d = xw === x0 ? -0.09 : 0.09;
        g.dark.face([[xw + d * 0.1, y0, z0], [xw + d * 0.1, y0, z1], [xw + d * 0.1, yT - 0.5, z1], [xw + d * 0.1, yT - 0.5, z0]], f, () => [0, 0], () => 0.5);
      }
    }
    lowPassage(x, y0, a.south, KING.north, pw, ph, 'granite');
    lamp([x, y0 + 0.3, a.north - 0.25], 3, [x0 - 1, y0 - 1, a.south - 0.5, x1 + 1, yT + 1, zS]);
    lamp([x, y0 + 0.3, a.south + 0.25], 3, [x0 - 1, y0 - 1, KING.north - 0.1, x1 + 1, yT + 1, a.granite]);
  }
  kingsChamber();

  // ---------------------------------------------------------------- finishing

  bakeLight();
  const meshes = [];
  for (const [key, geo] of Object.entries(g)) {
    if (!geo.count) continue;
    const m = geo.mesh(`inside-${key}`, scene);
    m.material = mats[key];
    m.isPickable = false;
    m.freezeWorldMatrix();
    meshes.push(m);
  }
  const floorMesh = floors.mesh('inside-floors', scene);
  floorMesh.isVisible = false;
  floorMesh.isPickable = true;
  floorMesh.freezeWorldMatrix();
  // The lamps themselves, glowing.
  const glow = new StandardMaterial('lamp', scene);
  glow.emissiveColor = new Color3(1, 0.8, 0.55);
  glow.disableLighting = true;
  const bulb = MeshBuilder.CreateBox('lamp', { width: 0.12, height: 0.05, depth: 0.05 }, scene);
  bulb.material = glow;
  bulb.isPickable = false;
  bulb.position.set(...lamps[0].p);
  for (const l of lamps.slice(1)) {
    const b = bulb.createInstance('lamp');
    b.position.set(...l.p);
    b.isPickable = false;
    b.freezeWorldMatrix();
  }
  return { meshes, floor: floorMesh, spaces, low, lamps, bulb };

  // ================================================================ helpers that need the buffers above

  function chevronFaceZ() {
    return coreFaceZ(ENTRANCE.chevron.spring, ENTRANCE.x) - 0.3;
  }

  function boxAround(pp, s, reach) {
    const a = pp.P(Math.max(0, s - reach), 0, 0), b = pp.P(s + reach, 0, 0);
    return [Math.min(a[0], b[0]) - 2, Math.min(a[1], b[1]) - 2, Math.min(a[2], b[2]) - 2, Math.max(a[0], b[0]) + 2, Math.max(a[1], b[1]) + 3, Math.max(a[2], b[2]) + 2];
  }

  /** An axis-aligned block of stone, outward faces. */
  function box(mat, x0, x1, y0, y1, z0, z1, k = 1) {
    rect(mat, [0, y1, 0], E, N, x0, x1, z0, z1, UP, [], k);
    rect(mat, [0, y0, 0], E, N, x0, x1, z0, z1, [0, -1, 0], [], k * 0.8);
    rect(mat, [0, 0, z1], E, UP, x0, x1, y0, y1, N, [], k);
    rect(mat, [0, 0, z0], E, UP, x0, x1, y0, y1, [0, 0, -1], [], k);
    rect(mat, [x1, 0, 0], N, UP, z0, z1, y0, y1, E, [], k);
    rect(mat, [x0, 0, 0], N, UP, z0, z1, y0, y1, [-1, 0, 0], [], k);
  }

  /** A level passage along -z from zA to zB, square in section. */
  function lowPassage(x, y0, zA, zB, w, h, mat) {
    rect(mat, [0, y0, 0], E, N, x - w / 2, x + w / 2, zB, zA, UP, [], 0.9);
    rect(mat, [0, y0 + h, 0], E, N, x - w / 2, x + w / 2, zB, zA, [0, -1, 0], [], 0.85);
    rect(mat, [x + w / 2, 0, 0], N, UP, zB, zA, y0, y0 + h, [-1, 0, 0]);
    rect(mat, [x - w / 2, 0, 0], N, UP, zB, zA, y0, y0 + h, [1, 0, 0]);
    floor([0, y0, 0], E, N, x - w / 2, x + w / 2, zB, zA);
    low.push({ a: [x, y0, zA], b: [x, y0, zB], w, h });
    spaces.push({ name: 'low passage', box: [x - w / 2, y0, zB, x + w / 2, y0 + h, zA] });
  }

  /** A granite plug filling a passage between s0 and s1. */
  function graniteBlock(pp, s0, s1, w, hv) {
    const c = [pp.P(s0, -w / 2, 0.01), pp.P(s1, -w / 2, 0.01), pp.P(s1, w / 2, 0.01), pp.P(s0, w / 2, 0.01)];
    const top = c.map((p) => add(p, mul(UP, hv - 0.02)));
    const f = (pts, n) => g.granite.face(pts, n, uvFor(1, n), () => 0.85);
    f([c[0], c[3], top[3], top[0]], mul(pp.dir, -1)); // the lower end, facing down the passage
    f([c[1], c[2], top[2], top[1]], pp.dir);
    f([top[0], top[1], top[2], top[3]], UP);
  }

  /** The modern wooden boardwalk with cross cleats every 35 cm. */
  function boardwalk(pp, s0, s1, w) {
    const lift = 0.03;
    g.wood.rect(add(pp.A, mul(UP, lift)), pp.dir, pp.side, s0, s1, -w / 2, w / 2, UP, { cell: 1.2, uv: (p) => [dot(p, pp.side), dot(p, pp.dir)], col: () => 0.9 });
    for (let s = s0 + 0.2; s < s1 - 0.1; s += 0.35) {
      const a = pp.P(s, -w / 2 + 0.05, lift), b = pp.P(s, w / 2 - 0.05, lift);
      const fw = mul(pp.dir, 0.045);
      const up = mul(UP, 0.03);
      g.wood.face([a, b, add(b, up), add(a, up)], mul(pp.dir, -1), (p) => [dot(p, pp.side), 0.1], () => 0.75);
      g.wood.face([add(a, up), add(b, up), add(add(b, up), fw), add(add(a, up), fw)], UP, (p) => [dot(p, pp.side), 0.3], () => 0.85);
    }
  }

  /** A girdle stone: a darker joint line round the passage. */
  function girdle(pp, s, w, hv) {
    const d = 0.015;
    for (const [t, n] of [[w / 2 - 0.003, mul(pp.side, -1)], [-w / 2 + 0.003, pp.side]]) {
      const a = pp.P(s, t, 0), b = pp.P(s + d, t, 0);
      g.dark.face([a, b, add(b, mul(UP, hv)), add(a, mul(UP, hv))], n, () => [0, 0], () => 0.35);
    }
    const a = pp.P(s, -w / 2, hv - 0.003), b = pp.P(s + d, -w / 2, hv - 0.003);
    g.dark.face([a, b, add(b, mul(pp.side, w)), add(a, mul(pp.side, w))], [0, -1, 0], () => [0, 0], () => 0.35);
  }

  /** A shaft: a small dark square opening, level for a little, then rising. */
  function shaft(sh, room, yIn) {
    const zWall = sh.wall === 'north' ? room.north : room.south;
    const out = sh.wall === 'north' ? 1 : -1;
    const x1 = room.east - sh.fromEast, x0 = x1 - sh.w;
    const dirH = [0, 0, out];
    const z1 = zWall + out * sh.run;
    const up = [0, Math.sin(sh.rise), out * Math.cos(sh.rise)];
    const lenUp = 3;
    const end = [0, yIn + Math.sin(sh.rise) * lenUp, z1 + out * Math.cos(sh.rise) * lenUp];
    for (const [xa, xb, n] of [[x0, x0, [1, 0, 0]], [x1, x1, [-1, 0, 0]]]) {
      g.rock.face([[xa, yIn, zWall], [xa, yIn, z1], [xb, yIn + sh.h, z1], [xb, yIn + sh.h, zWall]], n, uvFor(2, n), () => 0.25);
      g.rock.face([[xa, yIn, z1], [xa, end[1], end[2]], [xb, end[1] + sh.h, end[2]], [xb, yIn + sh.h, z1]], n, uvFor(2, n), () => 0.12);
    }
    g.rock.face([[x0, yIn, zWall], [x1, yIn, zWall], [x1, yIn, z1], [x0, yIn, z1]], UP, uvFor(2, UP), () => 0.3);
    g.rock.face([[x0, yIn + sh.h, zWall], [x1, yIn + sh.h, zWall], [x1, yIn + sh.h, z1], [x0, yIn + sh.h, z1]], [0, -1, 0], uvFor(2, UP), () => 0.2);
    g.rock.face([[x0, yIn, z1], [x1, yIn, z1], [x1, end[1], end[2]], [x0, end[1], end[2]]], norm([0, Math.cos(sh.rise), -out * Math.sin(sh.rise)]), uvFor(2, UP), () => 0.12);
    g.dark.face([[x0, end[1], end[2]], [x1, end[1], end[2]], [x1, end[1] + sh.h, end[2]], [x0, end[1] + sh.h, end[2]]], [0, 0, -out], () => [0, 0], () => 0.02);
    void dirH;
    void up;
  }

  /** The rough floor of the subterranean chamber: a grid, rising in the west to within 25 cm of the roof. */
  function rockFloor(p) {
    const nx = 28, nz = 16;
    const h = (x, z) => {
      const t = (p.east - x) / (p.east - p.west); // 0 at the east wall, 1 at the west
      let y = p.floor + (fbm(x, z, 0.9, 61) - 0.5) * 0.12;
      if (t > 0.45) {
        // The unfinished mass: blocks left standing as the quarrymen worked westward, in rough steps.
        const step = Math.floor((t - 0.45) / 0.11);
        y = Math.min(p.roof - 0.25, p.floor + 0.55 + step * 0.62 + (fbm(x * 2, z * 2, 0.6, 62) - 0.5) * 0.25);
        // A trench along the north side, cut to floor level.
        if (p.north - z < 1.2 && t < 0.8) y = p.floor + 0.1;
      }
      return y;
    };
    const ph = p.hole;
    const inPit = (x, z) => {
      const dx = x - ph.x, dz = z - ph.z;
      const u = dx * Math.cos(ph.turn) + dz * Math.sin(ph.turn), v = -dx * Math.sin(ph.turn) + dz * Math.cos(ph.turn);
      return Math.abs(u) < ph.side / 2 && Math.abs(v) < ph.side / 2;
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x0 = p.west + ((p.east - p.west) * i) / nx, x1 = p.west + ((p.east - p.west) * (i + 1)) / nx;
        const z0 = p.south + ((p.north - p.south) * j) / nz, z1 = p.south + ((p.north - p.south) * (j + 1)) / nz;
        if (inPit((x0 + x1) / 2, (z0 + z1) / 2)) continue;
        const q = [[x0, h(x0, z0), z0], [x1, h(x1, z0), z0], [x1, h(x1, z1), z1], [x0, h(x0, z1), z1]];
        g.rock.face(q, UP, uvFor(2, UP), (pt) => 0.75 + 0.25 * fbm(pt[0], pt[2], 1.4, 63));
        if ((p.east - (x0 + x1) / 2) / (p.east - p.west) < 0.45) floors.face(q, UP, () => [0, 0]);
      }
    }
    // The pit: four walls down and a floor.
    const c = Math.cos(ph.turn), s = Math.sin(ph.turn), r = ph.side / 2;
    const corners = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([u, v]) => [ph.x + u * c - v * s, ph.z + u * s + v * c]);
    const yb = p.floor - ph.depth;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const n = norm([ph.x - (ax + bx) / 2, 0, ph.z - (az + bz) / 2]);
      g.rock.face([[ax, yb, az], [bx, yb, bz], [bx, p.floor, bz], [ax, p.floor, az]], n, uvFor(2, n), () => 0.55);
    }
    g.rock.face(corners.map(([x, z]) => [x, yb, z]), UP, uvFor(2, UP), () => 0.35);
  }

  /** Al-Ma'mun's tunnel: a rough, uneven bore along a path of points, its walls pushed in and out by noise. */
  function tunnel(path, w, h) {
    // Sample the path every 0.5 m; each sample's section is square to its heading.
    const samples = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const L = len(sub(b, a));
      const n = Math.max(1, Math.ceil(L / 0.5));
      for (let j = 0; j < n; j++) samples.push(add(a, mul(sub(b, a), j / n)));
    }
    samples.push(path[path.length - 1]);
    let dist = 0;
    const frames = samples.map((p, i) => {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      const t = norm(sub(b, a));
      const hd = norm([t[0], 0, t[2]]);
      if (i) dist += len(sub(p, samples[i - 1]));
      return { p, side: [-hd[2], 0, hd[0]], s: dist };
    });
    const nr = 14;
    const ring = (f, k) => {
      const ang = (k / nr) * Math.PI * 2;
      const wob = 1 + 0.2 * (fbm(f.s * 1.3, k * 0.9, 1.1, 71) - 0.5);
      const t = Math.cos(ang) * (w / 2) * wob;
      let v = h / 2 + Math.sin(ang) * (h / 2) * wob;
      if (Math.sin(ang) < -0.35) v = 0.03 * fbm(f.s, k, 0.7, 72);
      return add(add(f.p, mul(f.side, t)), mul(UP, Math.max(0, v)));
    };
    for (let i = 0; i < frames.length - 1; i++) {
      for (let k = 0; k < nr; k++) {
        const q = [ring(frames[i], k), ring(frames[i + 1], k), ring(frames[i + 1], k + 1), ring(frames[i], k + 1)];
        const mid = mul(add(q[0], q[2]), 0.5);
        const axis = add(mul(add(frames[i].p, frames[i + 1].p), 0.5), mul(UP, h / 2));
        const n = norm(sub(axis, mid));
        g.rock.face(q, n, uvFor(2, Math.abs(n[1]) > 0.7 ? UP : n), (pt) => 0.7 + 0.3 * fbm(pt[0] * 2, pt[1] * 2 + pt[2], 0.8, 73));
      }
    }
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dir = norm(sub(b, a));
      const hd = norm([dir[0], 0, dir[2]]);
      floor(add(a, mul(UP, 0.03)), dir, [-hd[2], 0, hd[0]], -0.3, len(sub(b, a)) + 0.3, -w / 2 + 0.3, w / 2 - 0.3);
      spaces.push({ name: "Al-Ma'mun's tunnel", a, b, w, h });
    }
  }

  function galleryFloorStart() {
    // Where the gallery's floor rises clear of the Queen's passage roof and its 0.5 m of slab (spec.md).
    const dir = norm(sub(GALLERY.b, GALLERY.a));
    const need = PASSAGES.queens.roof + 0.5 - GALLERY.a[1];
    const s = need / dir[1];
    return { s, z: GALLERY.a[2] + dir[2] * s };
  }

  function grandGallery() {
    const G = GALLERY;
    const dir = norm(sub(G.b, G.a));
    const L = len(sub(G.b, G.a));
    const hd = norm([dir[0], 0, dir[2]]);
    const side = [-hd[2], 0, hd[0]];
    const W = G.width, f = G.floor;
    const o = G.overhang / G.laps, lh = (G.height - G.wall) / G.laps;
    const sStep = (G.a[2] - G.step.z) / -dir[2];
    const gap = galleryFloorStart().s;
    const P = (s, t, v) => add(add(add(G.a, mul(dir, s)), mul(side, t)), mul(UP, v));
    const O = (t, v) => P(0, t, v);
    const R = (mat, t0, t1, v0, v1, facing, s0, s1, k = 1, holes = []) => {
      // A face running along the gallery: across from t0 to t1 at heights v0..v1 (linear between the two).
      const o0 = O(t0, v0);
      const acr = sub(O(t1, v1), o0);
      const l = len(acr);
      rect(mat, o0, dir, norm(acr), s0, s1, 0, l, facing, holes, k);
    };
    // The floor between the ramps, from where it rises clear of the Queen's passage; the boardwalk on it.
    R('fine', -f / 2, f / 2, 0, 0, UP, gap, sStep, 0.9);
    const pp = { A: G.a, dir, side, P };
    boardwalk(pp, gap, sStep - 0.05, f - 0.06);
    // Today's bridge over the gap: planks at the floor's line from the north wall.
    boardwalk(pp, 0, gap, f - 0.06);
    floor(G.a, dir, side, 0, sStep, -f / 2, f / 2);
    // The end of the floor slab over the Queen's passage, facing north.
    {
      const a = P(gap, -f / 2, 0), b = P(gap, f / 2, 0);
      const yQ = PASSAGES.queens.roof;
      g.fine.face([[a[0], yQ, a[2]], [b[0], yQ, b[2]], b, a], [0, 0, 1], uvFor(2, N), () => 0.8);
    }
    // The ramps: their inner sides (down to the Queen's passage floor where the gallery floor is missing), their tops
    // with the holes, and the well's mouth in the west ramp.
    for (const sgn of [-1, 1]) {
      const t = (sgn * f) / 2;
      const inward = mul(side, -sgn);
      const holes = [];
      for (let i = 0; i < G.holes.count; i++) {
        const sc = 0.9 + ((sStep - 1.8) * (i + 0.5)) / G.holes.count;
        const hl = i % 2 ? G.holes.short : G.holes.long;
        holes.push({ u0: sc - hl / 2, u1: sc + hl / 2 });
      }
      // Inner side
      const wellHole = sgn < 0 ? [{ u0: G.well - 0.45, u1: G.well + 0.45, v0: 0, v1: G.ramp - 0.02 }] : [];
      rect('fine', P(0, t, 0), dir, UP, gap, sStep, 0, G.ramp, inward, sgn < 0 ? [] : [], 0.85);
      rect('fine', P(0, t, 0), dir, UP, 0, gap, -(G.a[1] - PASSAGES.queens.a[1]) - 0.0, G.ramp, inward, wellHole, 0.85);
      // Top, with its holes cut as dark recesses 20 cm deep against the wall.
      const tw0 = (sgn * f) / 2, tw1 = (sgn * W) / 2;
      const topHoles = holes.map((h) => ({ u0: h.u0, u1: h.u1, v0: 0, v1: 0.16 }));
      const acrossDir = mul(side, sgn);
      // Measured from the wall inwards so the holes sit against it.
      rect('fine', P(0, tw1, G.ramp), dir, mul(acrossDir, -1), 0, sStep, 0, (W - f) / 2, UP, topHoles, 0.9);
      for (const h of topHoles) {
        const a = P(h.u0, tw1 - sgn * 0.16, G.ramp), b = P(h.u1, tw1 - sgn * 0.16, G.ramp);
        const down = mul(UP, -0.2);
        g.dark.face([a, b, add(b, down), add(a, down)], inward, () => [0, 0], () => 0.4);
        g.dark.face([add(a, down), add(b, down), add(add(b, down), mul(acrossDir, 0.16)), add(add(a, down), mul(acrossDir, 0.16))], UP, () => [0, 0], () => 0.15);
      }
      if (sgn < 0) g.dark.face([P(G.well - 0.45, t + 0.005, 0.02), P(G.well + 0.45, t + 0.005, 0.02), P(G.well + 0.45, t + 0.005, G.ramp - 0.03), P(G.well - 0.45, t + 0.005, G.ramp - 0.03)].map((p) => [p[0], p[1] - (G.a[1] - PASSAGES.queens.a[1]) * 0, p[2]]), inward, () => [0, 0], () => 0.05);
      // The wall, then the seven laps, each stepping in by about 3 in.
      rect('fine', P(0, tw1, 0), dir, UP, 0, L, G.ramp, G.wall, inward, [], 1);
      for (let i = 0; i < G.laps; i++) {
        const tt = sgn * (W / 2 - (i + 1) * o);
        const v0 = G.wall + i * lh, v1 = v0 + lh;
        // The underside of the lap's projection.
        R('fine', sgn * (W / 2 - i * o), tt, v0, v0, [0, -1, 0], 0, L, 0.7);
        rect('fine', P(0, tt, 0), dir, UP, 0, L, v0, v1, inward, [], 0.97 - i * 0.02);
        // The groove along the third lap (P §46).
        if (i === 2) {
          const a = P(0, tt - sgn * 0.002, v0 + 0.135), b = P(L, tt - sgn * 0.002, v0 + 0.135);
          g.dark.face([a, b, add(b, mul(UP, 0.155)), add(a, mul(UP, 0.155))], inward, () => [0, 0], () => 0.55);
        }
      }
      // Handrails along the ramps, today's: posts every 2 m, a rail at 0.9 m.
      for (let s = 1; s < sStep - 0.5; s += 2) postAt(P(s, sgn * (f / 2 + 0.12), G.ramp), 0.9);
      rail(P(1, sgn * (f / 2 + 0.12), G.ramp + 0.9), P(sStep - 0.6, sgn * (f / 2 + 0.12), G.ramp + 0.9));
    }
    // The roof: slabs at 28° 11', each a few centimetres proud of the next (a saw-tooth against the 26° 17' floor).
    {
      const tr = W / 2 - G.overhang;
      const tilt = Math.tan(G.roofSlope) - Math.tan(Math.asin(dir[1]));
      for (let s = 0; s < L; s += G.slab) {
        const s1 = Math.min(L, s + G.slab);
        const drop = tilt * (s1 - s) * Math.hypot(dir[0], dir[2]);
        const a = P(s, -tr, G.height), b = P(s, tr, G.height), c = P(s1, tr, G.height + drop), d = P(s1, -tr, G.height + drop);
        g.fine.face([a, b, c, d], [0, -1, 0], uvFor(2, UP), tone(0.75));
        g.fine.face([c, d, P(s1, -tr, G.height), P(s1, tr, G.height)], mul(dir, -1), uvFor(2, N), tone(0.7));
      }
    }
    // The north wall, with the ascending passage's mouth.
    {
      const z = G.a[2];
      const x0 = G.a[0] - W / 2, x1 = G.a[0] + W / 2;
      const yb = PASSAGES.queens.a[1];
      const hv = PASSAGES.ascending.height / Math.hypot(dir[0], dir[2]);
      rect('fine', [0, 0, z], E, UP, x0, x1, yb, G.a[1] + G.height + 0.5, [0, 0, -1], [{ u0: G.a[0] - f / 2, u1: G.a[0] + f / 2, v0: yb, v1: G.a[1] + hv }]);
    }
    // The great step: its face, its top, and the south wall with the low doorway to the antechamber.
    {
      const zF = G.step.z, zS = G.b[2], yT = G.step.top;
      const x0 = G.b[0] - W / 2, x1 = G.b[0] + W / 2;
      const yFloor = P(sStep, 0, 0)[1];
      rect('fine', [0, 0, zF], E, UP, x0, x1, yFloor - 0.05, yT, N, [], 0.9);
      rect('fine', [0, yT, 0], E, N, x0, x1, zS, zF, UP, [], 0.9);
      floor([0, yT, 0], E, N, x0, x1, zS, zF);
      const hole = { u0: ANTE.x - ANTE.passage.width / 2, u1: ANTE.x + ANTE.passage.width / 2, v0: yT, v1: ANTE.floor + ANTE.passage.height };
      // The opening at the top of the east wall to Davison's chamber (P §62): 0.67 m wide, 0.75 high.
      rect('fine', [0, 0, zS], E, UP, x0, x1, yT, yT + G.height + 1, [0, 0, 1], [hole]);
      const dav = P(L - 0.1, W / 2 - G.overhang - 0.001, G.height - 0.8);
      g.dark.face([dav, add(dav, mul(dir, -0.67)), add(add(dav, mul(dir, -0.67)), mul(UP, 0.75)), add(dav, mul(UP, 0.75))], mul(side, -1), () => [0, 0], () => 0.05);
      // A stair of three steps up the great step, today's.
      for (let i = 0; i < 3; i++) {
        const yS = yFloor + ((yT - yFloor) * (i + 1)) / 3.5;
        const z1 = zF + 0.3 * (3 - i), z0 = z1 - 0.3;
        box('wood', G.b[0] - 0.45, G.b[0] + 0.45, yS - 0.04, yS, z0, z1 + 0.02, 0.85);
      }
      floor([0, yFloor + (yT - yFloor) * 0.5, 0], E, N, G.b[0] - 0.45, G.b[0] + 0.45, zF, zF + 0.9);
    }
    spaces.push({ name: 'Grand Gallery', a: G.a, b: P(L, 0, 0), w: W, h: G.height });
    // Lamps along both ramps, every 4.5 m, throwing light up the walls.
    for (let s = 2; s < sStep; s += 4.5) {
      for (const sgn of [-1, 1]) {
        const p = P(s, sgn * (W / 2 - 0.1), G.ramp + 0.12);
        lamp(p, 6, boxAround(pp, s, 12));
      }
    }
  }

  function postAt(p, h) {
    const r = 0.022;
    for (const [dx, dz, n] of [[-r, 0, [-1, 0, 0]], [r, 0, [1, 0, 0]], [0, -r, [0, 0, -1]], [0, r, [0, 0, 1]]]) {
      const a = [p[0] + dx + (dz ? -r : 0), p[1], p[2] + dz + (dx ? -r : 0)];
      const b = [p[0] + dx + (dz ? r : 0), p[1], p[2] + dz + (dx ? r : 0)];
      g.dark.face([a, b, add(b, [0, h, 0]), add(a, [0, h, 0])], n, () => [0, 0], () => 0.45);
    }
  }

  function rail(a, b) {
    const r = 0.022;
    for (const [off, n] of [[[0, r, 0], UP], [[0, -r, 0], [0, -1, 0]]]) {
      const d = norm(cross(sub(b, a), UP));
      g.dark.face([add(add(a, off), mul(d, -r)), add(add(b, off), mul(d, -r)), add(add(b, off), mul(d, r)), add(add(a, off), mul(d, r))], n, () => [0, 0], () => 0.5);
      g.dark.face([add(a, mul(d, r)), add(b, mul(d, r)), add(add(b, mul(d, r)), [0, 2 * r, 0]), add(add(a, mul(d, r)), [0, 2 * r, 0])].map((p) => add(p, [0, -r, 0])), d, () => [0, 0], () => 0.5);
      g.dark.face([add(a, mul(d, -r)), add(b, mul(d, -r)), add(add(b, mul(d, -r)), [0, 2 * r, 0]), add(add(a, mul(d, -r)), [0, 2 * r, 0])].map((p) => add(p, [0, -r, 0])), mul(d, -1), () => [0, 0], () => 0.5);
    }
  }

  function kingsChamber() {
    const K = KING;
    const y0 = K.floor, y1 = K.ceiling;
    const door = { u0: ANTE.x - ANTE.passage.width / 2, u1: ANTE.x + ANTE.passage.width / 2, v0: y0, v1: y0 + ANTE.passage.height };
    const sh = K.shafts.map((s) => {
      const xe = K.east - s.fromEast;
      return { u0: xe - s.w, u1: xe, v0: y0 + 0.91, v1: y0 + 0.91 + s.h };
    });
    room("King's Chamber", 'granite', K.west, K.east, y0, y1, K.south, K.north, { north: [door, sh[0]], south: [sh[1]] }, { k: 0.95 });
    for (const s of K.shafts) shaft(s, K, y0 + 0.91);
    // The joints of the five granite courses, from the walls' foot; and the roof beams' joints, east to west.
    const jd = 0.004;
    for (let c = 1; c < 5; c++) {
      const y = K.base + c * K.course;
      if (y <= y0 || y >= y1) continue;
      for (const [O, U, u0, u1, n] of [
        [[0, 0, K.north - jd], E, K.west, K.east, [0, 0, -1]],
        [[0, 0, K.south + jd], E, K.west, K.east, [0, 0, 1]],
        [[K.east - jd, 0, 0], N, K.south, K.north, [-1, 0, 0]],
        [[K.west + jd, 0, 0], N, K.south, K.north, [1, 0, 0]],
      ]) g.dark.rect(O, U, UP, u0, u1, y - 0.006, y + 0.006, n, { cell: 20, uv: () => [0, 0], col: () => 0.35 });
    }
    // Vertical joints: the north wall's top course as measured; the rest of the blocks at estimated lengths (spec.md).
    const vjoint = (O, U, u, ya, yb, n) => g.dark.rect(O, U, UP, u - 0.005, u + 0.005, ya, yb, n, { cell: 20, uv: () => [0, 0], col: () => 0.35 });
    for (let c = 0; c < 5; c++) {
      const ya = Math.max(y0, K.base + c * K.course), yb = Math.min(y1, K.base + (c + 1) * K.course);
      if (yb <= ya) continue;
      const walls = [
        [[0, 0, K.north - jd], E, K.east, -1, [0, 0, -1], K.east - K.west],
        [[0, 0, K.south + jd], E, K.east, -1, [0, 0, 1], K.east - K.west],
      ];
      for (const [O, U, start, sense, n, length] of walls) {
        const cuts = c === 4 && n[2] < 0 ? K.topJoints : estimateJoints(length, c * 7 + (n[2] < 0 ? 1 : 2));
        for (const d of cuts) vjoint(O, U, start + sense * d, ya, yb, n);
      }
      for (const [O, n, zs] of [[[K.east - jd, 0, 0], [-1, 0, 0], K.south], [[K.west + jd, 0, 0], [1, 0, 0], K.south]]) {
        if (c === 4) continue; // the top course of the end walls is a single stone (P §52)
        for (const d of estimateJoints(K.north - K.south, c * 5 + (n[0] < 0 ? 3 : 4))) vjoint(O, N, zs + d, ya, yb, n);
      }
    }
    let x = K.east;
    for (const w of K.beams.slice(0, -1)) {
      x -= w;
      g.dark.rect([x, y1 - jd, 0], N, E, K.south, K.north, -0.006, 0.006, [0, -1, 0], { cell: 20, uv: () => [0, 0], col: () => 0.3 });
    }
    // The coffer: red granite, open, with the ledge for its lost lid.
    coffer();
    const box = [K.west - 0.5, y0 - 1, K.south - 0.5, K.east + 0.5, y1 + 0.5, K.north + 0.5];
    lamp([K.east - 0.35, y0 + 0.25, K.north - 0.35], 22, box);
    lamp([K.west + 0.35, y0 + 0.25, K.north - 0.35], 22, box);
    lamp([K.east - 0.35, y0 + 0.25, K.south + 0.35], 22, box);
    lamp([K.west + 0.35, y0 + 0.25, K.south + 0.35], 22, box);
    lamp([(K.east + K.west) / 2, y1 - 0.3, (K.north + K.south) / 2], 10, box, [1, 0.95, 0.88]);
  }

  function estimateJoints(length, seed) {
    const out = [];
    let d = 1.2 + 1.3 * hash(seed, 1);
    while (d < length - 0.8) {
      out.push(d);
      d += 1.3 + 1.5 * hash(seed, Math.round(d * 10));
    }
    return out;
  }

  function coffer() {
    const c = KING.coffer;
    const x0 = KING.west + c.fromWest, x1 = x0 + c.width;
    const z1 = KING.north - c.fromNorth, z0 = z1 - c.length;
    const y0 = KING.floor, y1 = y0 + c.height;
    const tx = (c.width - c.inWidth) / 2, tz = (c.length - c.inLength) / 2;
    const ix0 = x0 + tx, ix1 = x1 - tx, iz0 = z0 + tz, iz1 = z1 - tz, iy = y1 - c.inDepth;
    const k = 0.9;
    // Outside
    rect('granite', [0, 0, z1], E, UP, x0, x1, y0, y1, N, [], k);
    rect('granite', [0, 0, z0], E, UP, x0, x1, y0, y1, [0, 0, -1], [], k);
    rect('granite', [x1, 0, 0], N, UP, z0, z1, y0, y1, E, [], k);
    rect('granite', [x0, 0, 0], N, UP, z0, z1, y0, y1, [-1, 0, 0], [], k);
    // Rim
    rect('granite', [0, y1, 0], E, N, x0, x1, z0, z1, UP, [{ u0: ix0, u1: ix1, v0: iz0, v1: iz1 }], k);
    // Inside
    rect('granite', [0, 0, iz1], E, UP, ix0, ix1, iy, y1, [0, 0, -1], [], 0.6);
    rect('granite', [0, 0, iz0], E, UP, ix0, ix1, iy, y1, N, [], 0.6);
    rect('granite', [ix1, 0, 0], N, UP, iz0, iz1, iy, y1, [-1, 0, 0], [], 0.6);
    rect('granite', [ix0, 0, 0], N, UP, iz0, iz1, iy, y1, E, [], 0.6);
    rect('granite', [0, iy, 0], E, N, ix0, ix1, iz0, iz1, UP, [], 0.45);
    spaces.push({ name: 'coffer', box: [x0, y0, z0, x1, y1, z1] });
  }

  /** The lamps' light into every vertex within each lamp's room; walls and floors facing it get the most. */
  function bakeLight() {
    const amb = [0.05, 0.045, 0.04];
    const light = (p, n) => {
      const out = [...amb];
      for (const l of lamps) {
        const b = l.box;
        if (p[0] < b[0] || p[1] < b[1] || p[2] < b[2] || p[0] > b[3] || p[1] > b[4] || p[2] > b[5]) continue;
        const d = sub(l.p, p);
        const r = len(d) + 1e-3;
        const lam = Math.max(0, dot(n, mul(d, 1 / r))) * 0.75 + 0.25;
        const k = (l.power * lam) / (1 + r * r);
        for (let c = 0; c < 3; c++) out[c] += k * l.color[c];
      }
      // Soft roll-off so the walls by a lamp burn bright but never flat white.
      return out.map((v) => 1.8 * (1 - Math.exp(-v * 0.8)));
    };
    for (const geo of Object.values(g)) geo.bake(light);
  }
}

/** The z of the core's face at height y and x along the north face. */
export function coreFaceZ(y, x) {
  const h = casingHalf(y);
  return h - coreRecess(y, x, h);
}

void S;
