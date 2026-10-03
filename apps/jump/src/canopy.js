// A ram-air canopy built in code: 9 cells between 10 airfoil ribs on an arc above the jumper,
// puffed between the ribs, open at the nose (the ribs show through), the bottom skin pulled into
// small points where the lines attach, the trailing edge pulled down by the brakes, more toward
// the tips, and a stabilizer panel hanging under each end. The cloth is fabric.js: panels, seams
// and tapes, glowing through when the sun is behind it. Under it: 4 rows of lines, joined in
// pairs at cascades, into 4 risers; the yellow brake lines cascading to the toggles (in your
// hands once you take them); the slider; and the pilot chute trailing on its bridle. It packs,
// stretches out, inflates from the centre cell outward, and collapses downwind after landing.
//
// The canopy's local frame is at the jumper's shoulders: x right, y up, z forward.
import {
  Color3, Matrix, MeshBuilder, Mesh, PBRMaterial, Quaternion, TransformNode, Vector3, VertexData, VertexBuffer,
} from '@babylonjs/core';
import { BOTTOM_V, CELLS, NAVY_UV, ROW_X, TOP_V, WHITE_UV, createFabric } from './fabric.js';
import { RISER_BASE } from './body.js';

/** Seconds after the pull when the lines are fully out (physics.js LINE_STRETCH). */
const LINE_STRETCH_S = 1.6;
/** Span samples per cell, chord samples per surface. */
const K = 5;
const NC = 22;
/** Distance from the riser links to the canopy (m), and the links above the shoulders. */
const LINE = 6.6;
const LINKS = 0.55;
/** Half the arc the span covers (radians): about 7.7 m of span. */
const ARC = 0.58;
const CHORD = 2.9;
const THICK = 0.17;
/** Nose-down incidence of the wing against its lines. */
const TRIM = 0.1;
/** The cell mouths: the lower surface starts this far back. */
const MOUTH = 0.075;
/** Line attachment rows (fraction of chord) and their riser (front or rear). */
const ROWS = ROW_X.map((x, i) => ({ x, rear: i >= 2 }));
/** Ribs whose lines join at one cascade (a third of the way down), per row. */
const CASCADES = [[0, 1], [2, 3], [4], [5], [6, 7], [8, 9]];
/** How far down the lines the cascades are, from the canopy. */
const CASCADE_AT = 0.33;
/** Turns a flat ring upright, in line with its riser. */
const STAND_UP = Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2);
/** Brake line attachments along each half of the trailing edge (|s| of the span). */
const BRAKE_POINTS = [0.3, 0.55, 0.78, 1];

const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** Half thickness and camber of the canopy's airfoil at chord fraction x. */
function airfoil(x) {
  const yt = 5 * THICK * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const p = 0.35;
  const m = 0.035;
  const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
  return { yt, yc };
}
/** Chord samples, closer together at the nose where the curve is tight. */
const XS = Array.from({ length: NC }, (_, i) => (1 - Math.cos((Math.PI * i) / (NC - 1))) / 2);
const XS_LOW = XS.map((x) => MOUTH + (1 - MOUTH) * x);

export function createCanopy(scene) {
  const root = new TransformNode('canopy', scene);
  const mat = createFabric(scene);

  // One mesh: top skin, bottom skin and ribs, each cell its own patch so colours stay crisp.
  const topCount = CELLS * (K + 1) * NC;
  const bottomCount = topCount;
  const ribCount = (CELLS + 1) * NC * 2;
  const total = topCount + bottomCount + ribCount;
  const positions = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  const indices = [];
  const grid = (start, rows, cols, flip) => {
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = start + r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        if (flip) indices.push(a, b, d, b, e, d);
        else indices.push(a, d, b, b, d, e);
      }
    }
  };
  for (let cell = 0; cell < CELLS; cell++) {
    grid(cell * (K + 1) * NC, K + 1, NC, false);
    grid(topCount + cell * (K + 1) * NC, K + 1, NC, true);
  }
  for (let rib = 0; rib <= CELLS; rib++) grid(topCount + bottomCount + rib * NC * 2, 2, NC, false);
  // Texture coordinates (fabric.js): u across the span, v down each skin's chord.
  for (const [start, xs, [v0, v1]] of [[0, XS, TOP_V], [topCount, XS_LOW, BOTTOM_V]]) {
    for (let cell = 0; cell < CELLS; cell++) {
      for (let k = 0; k <= K; k++) {
        for (let c = 0; c < NC; c++) {
          const i = start + (cell * (K + 1) + k) * NC + c;
          uvs[i * 2] = (cell + k / K) / CELLS;
          uvs[i * 2 + 1] = v0 + (v1 - v0) * xs[c];
        }
      }
    }
  }
  for (let i = topCount + bottomCount; i < total; i++) uvs.set(WHITE_UV, i * 2);
  const wing = new Mesh('canopy-wing', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = new Uint32Array(indices);
  data.uvs = uvs;
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, data.indices, normals);
  data.normals = normals;
  data.applyToMesh(wing, true);
  wing.material = mat;
  wing.parent = root;
  wing.isPickable = false;
  wing.alwaysSelectAsActiveMesh = true;

  // Lines: suspension (each rib to its cascade, each cascade to its riser) and the bridle; then
  // the brake lines (to a cascade per side, then to the toggle), in yellow as on most canopies.
  const lineSet = (name, count, color, alpha) => {
    const lines = Array.from({ length: count }, () => [new Vector3(), new Vector3()]);
    const mesh = MeshBuilder.CreateLineSystem(name, { lines, updatable: true }, scene);
    mesh.color = color;
    mesh.alpha = alpha;
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return { lines, mesh };
  };
  const suspension = lineSet('canopy-lines', ROWS.length * (CELLS + 1 + CASCADES.length) + 1, new Color3(0.8, 0.79, 0.75), 0.8);
  const brakes = lineSet('canopy-brake-lines', 2 * (BRAKE_POINTS.length + 1), new Color3(0.93, 0.74, 0.16), 0.9);

  // The lines' lower lengths, from the cascades down to the links by your head, as real cords
  // (about 2 mm): up close a one-pixel line reads as a drawing, not as line.
  const cords = (name, count, hex, diameter) => {
    const mesh = MeshBuilder.CreateCylinder(name, { height: 1, diameter, tessellation: 6 }, scene);
    const m = new PBRMaterial(name, scene);
    m.albedoColor = Color3.FromHexString(hex);
    m.metallic = 0;
    m.roughness = 0.65;
    mesh.material = m;
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    const matrices = new Float32Array(count * 16);
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    const scale = new Vector3();
    const turn = new Quaternion();
    const mid = new Vector3();
    const tmpMatrix = new Matrix();
    return {
      /** Lays cord `i` from `a` to `b`. */
      set(i, a, b) {
        const along = b.subtract(a);
        const length = along.length();
        scale.set(1, length, 1);
        Quaternion.FromUnitVectorsToRef(Vector3.Up(), along.scaleInPlace(1 / length), turn);
        a.addToRef(b, mid).scaleInPlace(0.5);
        Matrix.ComposeToRef(scale, turn, mid, tmpMatrix);
        tmpMatrix.copyToArray(matrices, i * 16);
      },
      update: () => mesh.thinInstanceBufferUpdated('matrix'),
    };
  };
  const lowerCords = cords('canopy-cords', ROWS.length * CASCADES.length, '#d9d6cc', 0.0022);
  const brakeCords = cords('canopy-brake-cords', 2, '#e8b52a', 0.0024);

  // Stabilizers: a panel hanging under each end cell.
  const stabilizers = new Mesh('canopy-stabilizers', scene);
  const stabPositions = new Float32Array(6 * 3);
  const stabData = new VertexData();
  stabData.positions = stabPositions;
  stabData.indices = [0, 1, 2, 3, 5, 4];
  stabData.normals = new Float32Array(18);
  stabData.uvs = new Float32Array(12).map((_, i) => NAVY_UV[i % 2]);
  stabData.applyToMesh(stabilizers, true);
  stabilizers.material = mat;
  stabilizers.parent = root;
  stabilizers.isPickable = false;
  stabilizers.alwaysSelectAsActiveMesh = true;

  const dark = new PBRMaterial('canopy-webbing', scene);
  dark.albedoColor = Color3.FromHexString('#0b0c0f');
  dark.metallic = 0;
  dark.roughness = 0.9;
  // Risers: webbing from the harness at your shoulders up to a steel connector link, where
  // that riser's lines (front: A and B rows; rear: C and D) are threaded on.
  const steel = new PBRMaterial('canopy-links', scene);
  steel.albedoColor = Color3.FromHexString('#9aa0a6');
  steel.metallic = 0.6;
  steel.roughness = 0.35;
  const risers = [-1, 1].flatMap((side) => [false, true].map((rear) => {
    const mesh = MeshBuilder.CreateBox('riser', { width: 0.026, height: 1, depth: 0.006 }, scene);
    mesh.material = dark;
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.rotationQuaternion = new Quaternion();
    const link = MeshBuilder.CreateTorus('riser-link', { diameter: 0.022, thickness: 0.004, tessellation: 12 }, scene);
    link.material = steel;
    link.parent = root;
    link.isPickable = false;
    // An oval standing in line with the riser (the torus lies flat until turned).
    link.scaling.set(0.7, 1, 1.6);
    link.rotationQuaternion = new Quaternion();
    return { mesh, link, side, rear };
  }));
  const toggleMat = new PBRMaterial('toggle', scene);
  toggleMat.albedoColor = Color3.FromHexString('#ff7a1a');
  toggleMat.metallic = 0;
  toggleMat.roughness = 0.6;
  const toggles = [-1, 1].map(() => {
    const m = MeshBuilder.CreateBox('toggle', { width: 0.022, height: 0.1, depth: 0.016 }, scene);
    m.material = toggleMat;
    m.parent = root;
    m.isPickable = false;
    return m;
  });

  const navy = (mesh) => mesh.setVerticesData(VertexBuffer.UVKind, new Float32Array(mesh.getTotalVertices() * 2).map((_, i) => NAVY_UV[i % 2]));
  const slider = MeshBuilder.CreatePlane('slider', { size: 1, updatable: true }, scene);
  navy(slider);
  slider.material = mat;
  slider.parent = root;
  slider.isPickable = false;
  slider.alwaysSelectAsActiveMesh = true;

  // A dome, open side into the wind.
  const pilot = MeshBuilder.CreateSphere('pilot-chute', { diameter: 0.9, segments: 12, slice: 0.5 }, scene);
  pilot.scaling.y = 0.7;
  navy(pilot);
  pilot.material = mat;
  pilot.parent = root;
  pilot.isPickable = false;

  const tmp = { p: new Vector3() };
  /** Where a point on the wing is: span s -1..1, chord x 0..1, airfoil height y (chord units). */
  function wingPoint(s, x, y, shape, out) {
    const theta = s * ARC * shape.spread;
    const radius = shape.radius;
    const c = CHORD * (1 - 0.22 * s * s) * shape.chord;
    // Brakes pull the back of the wing down, harder toward the tips on that side.
    const brake = s < 0 ? shape.brakeL : shape.brakeR;
    let b = y * c;
    if (x > 0.62) {
      const k = (x - 0.62) / 0.38;
      const bend = brake * 0.75 * (0.3 + 0.7 * Math.abs(s));
      b -= (x - 0.62) * c * Math.sin(bend * k);
    }
    const a = (0.3 - x) * c;
    const along = a * Math.cos(TRIM) + b * Math.sin(TRIM);
    const up = b * Math.cos(TRIM) - a * Math.sin(TRIM);
    // The arc is centred on the links, (0, LINKS, 0); the tips hang lower than the centre.
    const r = radius + up;
    return out.set(Math.sin(theta) * r, LINKS + Math.cos(theta) * r + shape.lift, along);
  }

  function writeWing(shape, time) {
    let i = 0;
    const p = tmp.p;
    // Skins.
    for (const lower of [false, true]) {
      for (let cell = 0; cell < CELLS; cell++) {
        const s0 = -1 + (2 * cell) / CELLS;
        const sc = s0 + 1 / CELLS;
        // Cells fill from the centre outward.
        const fill = smooth(shape.inflation * 1.7 - Math.abs(sc) * 0.7);
        for (let k = 0; k <= K; k++) {
          const s = s0 + (2 * k) / (CELLS * K);
          const across = Math.sin((Math.PI * k) / K);
          for (let c = 0; c < NC; c++) {
            const x = lower ? XS_LOW[c] : XS[c];
            const { yt, yc } = airfoil(x);
            const flutter = (1 - fill) * 0.35 * Math.sin(time * 31 + s * 9 + x * 7) + shape.flutter * 0.02 * Math.sin(time * 23 + s * 13 + x * 11);
            const half = yt * (0.15 + 0.85 * fill) * (1 + flutter);
            // Between ribs the top skin puffs up and the bottom sags a little.
            const puff = across * Math.sqrt(Math.sin(Math.PI * Math.min(1, x * 1.02))) * THICK * 0.42 * fill;
            let y = lower ? yc - half - puff * 0.35 : yc + half + puff;
            // The lines pull the bottom skin into small points where they attach to the ribs.
            if (lower && (k === 0 || k === K)) {
              for (const row of ROWS) y -= 0.012 * fill * Math.exp(-(((x - row.x) / 0.035) ** 2));
            }
            // Never quite still: the trailing edge ripples in the airflow, and the end cells,
            // less pressurised than the rest, breathe.
            const tail = Math.max(0, (x - 0.82) / 0.18);
            y += fill * (tail * tail * 0.006 * Math.sin(time * 11 + s * 17 + x * 5) * (0.4 + 0.6 * across)
              + Math.max(0, Math.abs(s) - 0.7) * across * 0.012 * Math.sin(time * 3.1 + s * 4));
            wingPoint(s, x, y, shape, p);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
            i++;
          }
        }
      }
    }
    // Ribs: from the top skin down to the bottom skin (and the open mouth at the nose).
    for (let rib = 0; rib <= CELLS; rib++) {
      const s = -1 + (2 * rib) / CELLS;
      const fill = smooth(shape.inflation * 1.7 - Math.abs(s) * 0.7);
      for (const lower of [false, true]) {
        for (let c = 0; c < NC; c++) {
          const x = lower ? XS_LOW[c] : XS[c];
          const { yt, yc } = airfoil(x);
          const half = yt * (0.15 + 0.85 * fill);
          wingPoint(s, x, lower ? yc - half : yc + half, shape, p);
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
          i++;
        }
      }
    }
    wing.updateVerticesData(VertexBuffer.PositionKind, positions, false, false);
    VertexData.ComputeNormals(positions, data.indices, normals);
    wing.updateVerticesData(VertexBuffer.NormalKind, normals, false, false);
  }

  // Tell the fabric which way the skins' normals face (it depends on the triangles' winding):
  // the top skin's outside is up, the bottom skin's down, at the centre of the span.
  writeWing({ inflation: 1, spread: 1, chord: 1, radius: LINE, brakeL: 0, brakeR: 0, flutter: 0, lift: 0 }, 0);
  const centre = ((Math.floor(CELLS / 2) * (K + 1) + Math.floor(K / 2)) * NC + Math.floor(NC / 2)) * 3;
  mat.setFloat('topSign', Math.sign(normals[centre + 1]) || 1);
  mat.setFloat('bottomSign', -Math.sign(normals[topCount * 3 + centre + 1]) || 1);

  const lowerPoint = (s, x, shape, out) => {
    const { yt, yc } = airfoil(x);
    return wingPoint(s, x, yc - yt, shape, out);
  };
  const linkPoint = (side, rear, out) => out.set(side * 0.24, LINKS, rear ? -0.06 : 0.06);

  const state = { collapse: 0 };
  let collapseFrom = null;

  return {
    root,
    /**
     * Draws the canopy for this frame. `j` is the jumper's state (physics.js); `hands` the toggle
     * positions in the canopy's frame ({ left, right } or null for the stowed places);
     * `time` seconds for the flutter.
     */
    update(j, { hands, time, shoulder }) {
      const deployed = j.phase === 'opening' || j.phase === 'canopy' || (j.phase === 'landed' && j.landing?.canopy);
      root.setEnabled(deployed);
      if (!deployed) {
        state.collapse = 0;
        collapseFrom = null;
        return;
      }
      const inflation = j.phase === 'landed' ? 1 : j.inflation;
      const stretch = j.phase === 'opening' ? j.lines : 1;
      const shape = {
        inflation: j.phase === 'landed' ? Math.max(0, 1 - state.collapse * 1.6) : inflation,
        spread: 0.12 + 0.88 * smooth(inflation * 1.25),
        chord: 0.3 + 0.7 * smooth(inflation * 1.5),
        radius: LINE * (0.25 + 0.75 * stretch),
        brakeL: j.brakeL,
        brakeR: j.brakeR,
        flutter: Math.min(1, Math.abs(j.brakeL - j.brakeR) + Math.max(0, (j.brakeL + j.brakeR) / 2 - 0.5) + j.stall),
        lift: 0,
      };
      // Bag and lines on the way out: the packed canopy rides up the bridle.
      if (j.phase === 'opening' && j.sincePull < LINE_STRETCH_S) shape.radius = LINE * (0.05 + 0.95 * stretch);
      writeWing(shape, time);

      // Orientation: banked into turns, swung back in a flare. After landing it falls back and
      // settles flat on the grass behind you (downwind: you land facing into the wind).
      let pitch = j.pitch;
      let roll = j.bank;
      const offset = new Vector3();
      let flatten = 1;
      if (j.phase === 'landed') {
        if (!collapseFrom) collapseFrom = { pitch, roll };
        state.collapse = Math.min(1, state.collapse + 1 / 160);
        const k = smooth(state.collapse);
        pitch = collapseFrom.pitch * (1 - k) + Math.sin(Math.PI * k) * 0.9;
        roll = collapseFrom.roll * (1 - k);
        flatten = 1 - 0.93 * k;
        // Its top ends just above the grass, about a line length behind.
        offset.set(0, (-shoulder + 0.12 - (LINKS + LINE) * flatten) * k, -(LINE - 0.6) * k);
      }
      const rot = Quaternion.RotationYawPitchRoll(0, -pitch, -roll);
      wing.rotationQuaternion = rot;
      wing.scaling.set(1, flatten, 1);
      wing.position.copyFrom(offset);
      // Lines, slider and pilot chute are drawn in the body's frame: wing points go through this.
      const toBody = Matrix.Compose(new Vector3(1, flatten, 1), rot, offset);
      const body = (v) => Vector3.TransformCoordinatesToRef(v, toBody, v);

      const lines = suspension.lines;
      let n = 0;
      let cord = 0;
      for (const row of ROWS) {
        for (const ribs of CASCADES) {
          const side = ribs[0] < CELLS / 2 ? -1 : 1;
          const link = linkPoint(side, row.rear, new Vector3());
          const top = new Vector3();
          for (const rib of ribs) {
            body(lowerPoint(-1 + (2 * rib) / CELLS, row.x, shape, lines[n][0]));
            top.addInPlace(lines[n][0]);
            n++;
          }
          top.scaleInPlace(1 / ribs.length);
          const cascade = Vector3.Lerp(top, link, CASCADE_AT);
          for (let r = ribs.length; r > 0; r--) lines[n - r][1].copyFrom(cascade);
          lines[n][0].copyFrom(cascade);
          lines[n][1].copyFrom(link);
          lowerCords.set(cord++, cascade, link);
          n++;
        }
      }
      // Brake lines: trailing edge points to a cascade, the cascade to the toggle.
      let b = 0;
      const togglePos = [];
      for (const side of [-1, 1]) {
        const hand = side < 0 ? hands?.left : hands?.right;
        const stowed = linkPoint(side, true, new Vector3()).add(new Vector3(0, -0.12, -0.04));
        const at = hand ? hand.clone() : stowed;
        togglePos.push(at);
        const cascade = body(lowerPoint(side * 0.7, 1, shape, new Vector3())).scaleInPlace(0.55).addInPlace(at.scale(0.45));
        for (const sb of BRAKE_POINTS) {
          body(lowerPoint(side * sb, 1, shape, brakes.lines[b][0]));
          brakes.lines[b][1].copyFrom(cascade);
          b++;
        }
        brakes.lines[b][0].copyFrom(cascade);
        brakes.lines[b][1].copyFrom(at);
        brakeCords.set(side < 0 ? 0 : 1, cascade, at);
        b++;
      }
      // Pilot chute: up the bridle while the bag comes out, then trailing behind the centre cell.
      const top = body(wingPoint(0, 0.35, airfoil(0.35).yc + airfoil(0.35).yt, shape, new Vector3()));
      const extracting = j.phase === 'opening' && j.sincePull < LINE_STRETCH_S;
      const pc = extracting
        ? new Vector3(0, 1 + 9 * j.sincePull, -0.5)
        : top.add(new Vector3(0, 0.9 * flatten, -2.4 - 1.2 * state.collapse));
      if (j.phase === 'landed') pc.y = Math.max(pc.y, -shoulder + 0.3);
      lines[n][0].copyFrom(top);
      lines[n][1].copyFrom(pc);
      pilot.position.copyFrom(pc);
      pilot.rotation.x = extracting ? 0 : -1.25 * flatten - 1.5 * (1 - flatten);
      MeshBuilder.CreateLineSystem('canopy-lines', { lines, instance: suspension.mesh });
      lowerCords.update();
      brakeCords.update();
      MeshBuilder.CreateLineSystem('canopy-brake-lines', { lines: brakes.lines, instance: brakes.mesh });

      // Stabilizers: from the end rib's bottom skin, front to back, down to a point on the lines.
      for (const [side, at] of [[-1, 0], [1, 3]]) {
        const front = body(lowerPoint(side, 0.18, shape, new Vector3()));
        const back = body(lowerPoint(side, 0.8, shape, new Vector3()));
        const mid = body(lowerPoint(side, 0.45, shape, new Vector3()));
        const tip = Vector3.Lerp(mid, linkPoint(side, false, new Vector3()), 0.055 * flatten);
        [front, back, tip].forEach((v, i) => v.toArray(stabPositions, (at + i) * 3));
      }
      stabilizers.updateVerticesData(VertexBuffer.PositionKind, stabPositions);
      VertexData.ComputeNormals(stabPositions, stabData.indices, stabData.normals);
      stabilizers.updateVerticesData(VertexBuffer.NormalKind, stabData.normals);
      // Slider: down the lines as the canopy opens, to the links.
      const f = j.phase === 'opening' ? 0.9 - 0.885 * smooth((j.sincePull - 2) / 2.2) : 0.015;
      const corners = [[-0.55, 0], [0.55, 0], [-0.55, 3], [0.55, 3]].map(([s, row]) => {
        const a = body(lowerPoint(s, ROWS[row].x, shape, new Vector3()));
        const b = linkPoint(s < 0 ? -1 : 1, ROWS[row].rear, new Vector3());
        return Vector3.Lerp(b, a, f);
      });
      // Once it's down, collapsed and pushed behind your head, as jumpers do.
      const tuck = j.phase === 'opening' ? smooth((j.sincePull - 3.4) / 1.2) : 1;
      if (tuck > 0) {
        for (const c of corners) {
          c.x *= 1 - 0.45 * tuck;
          c.y -= 0.12 * tuck;
          c.z = c.z * (1 - 0.6 * tuck) - 0.3 * tuck;
        }
      }
      const sp = slider.getVerticesData(VertexBuffer.PositionKind);
      // CreatePlane's vertices: bottom-left, bottom-right, top-right, top-left (front, then back copy).
      const order = [corners[2], corners[3], corners[1], corners[0]];
      for (let v = 0; v < sp.length / 3; v++) {
        const c = order[v % 4];
        sp[v * 3] = c.x;
        sp[v * 3 + 1] = c.y;
        sp[v * 3 + 2] = c.z;
      }
      slider.updateVerticesData(VertexBuffer.PositionKind, sp);
      slider.refreshBoundingInfo();

      // Risers from the shoulders to the links; toggles where the hands (or their stows) are.
      for (const r of risers) {
        const to = linkPoint(r.side, r.rear, new Vector3());
        // From the harness's three-ring at your collarbone (body.js).
        const from = new Vector3(r.side * RISER_BASE.x, RISER_BASE.y, r.rear ? RISER_BASE.rear : RISER_BASE.front);
        const along = to.subtract(from);
        const length = along.length();
        // The webbing ends just under the link, which sits on the point where the lines meet.
        r.mesh.position.copyFrom(from).addInPlace(along.scale(0.5 * (length - 0.02) / length));
        r.mesh.scaling.y = length - 0.02;
        Quaternion.FromUnitVectorsToRef(Vector3.Up(), along.normalize(), r.mesh.rotationQuaternion);
        r.link.position.copyFrom(to);
        r.mesh.rotationQuaternion.multiplyToRef(STAND_UP, r.link.rotationQuaternion);
      }
      toggles.forEach((t, i) => t.position.copyFrom(togglePos[i]));
    },
  };
}
