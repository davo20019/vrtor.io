// The error landscape on the round table. Across the table run the neuron's two dials (left to right
// the size dial, front to back the colour dial, -6 to +6 each); the height is the error with the dials
// set there. It is the real surface, worked out from the fruit you sorted: two dials and the error are
// exactly three numbers. Only the height is squeezed near the top (errorFill), so the tall corners
// fit on the table.
//
// The ball is the neuron as it is now. Learning rolls it downhill one step at a time.
import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, VertexBuffer } from '@babylonjs/core';
import { LANDSCAPE_TABLE_TOP, STATIONS, makeLabel, mat } from './lab.js';
import { DIAL_MAX, errorFill } from './machine.js';

/** Half the terrain's width, m, and its tallest point above the table. */
const HALF = 0.8;
const HEIGHT = 0.48;
const SEGMENTS = 96;
const BALL = 0.06;

export function createLandscape(scene) {
  const root = new TransformNode('landscape', scene);
  root.position.copyFrom(STATIONS.landscape.center);
  root.position.y = LANDSCAPE_TABLE_TOP + 0.005;

  const ground = MeshBuilder.CreateGround('terrain', { width: HALF * 2, height: HALF * 2, subdivisions: SEGMENTS, updatable: true }, scene);
  ground.parent = root;
  const tm = new StandardMaterial('terrain', scene);
  tm.diffuseColor = Color3.White();
  tm.specularColor = new Color3(0.15, 0.15, 0.15);
  tm.specularPower = 32;
  tm.backFaceCulling = false;
  ground.material = tm;
  ground.useVertexColors = true;
  ground.metadata = { terrain: true };

  const base = MeshBuilder.CreateBox('terrain-base', { width: HALF * 2, depth: HALF * 2, height: 0.01 }, scene);
  base.parent = root;
  base.material = mat(scene, 'terrain-base', '#2a3038');
  base.isPickable = false;

  const ballMat = mat(scene, 'ball', '#ffb020', { spec: 0.7, emissive: '#4a3000' });
  const ball = MeshBuilder.CreateSphere('ball', { diameter: BALL, segments: 24 }, scene);
  ball.material = ballMat;
  ball.metadata = { ball: true };
  const flag = MeshBuilder.CreateCylinder('lowest', { diameter: 0.006, height: 0.16, tessellation: 8 }, scene);
  flag.material = mat(scene, 'lowest', '#2fbf71', { emissive: '#145c35' });
  flag.isPickable = false;
  flag.setEnabled(false);
  const flagLabel = makeLabel(scene, 'lowest point', { w: 0.24, h: 0.06, size: 70, color: '#ffffff', bg: '#2a8c57', weight: 700 });
  flagLabel.mesh.parent = flag;
  flagLabel.mesh.position.y = 0.1;

  // Names of the two directions along the table's front and left edges.
  const across = makeLabel(scene, 'size dial  −6 … 0 … +6  →', { w: 0.9, h: 0.07, size: 56, weight: 700 });
  across.mesh.parent = root;
  across.mesh.position.set(0, 0.012, -HALF - 0.07);
  across.mesh.rotation.x = Math.PI / 2;
  const back = makeLabel(scene, 'colour dial  −6 … 0 … +6  →', { w: 0.9, h: 0.07, size: 56, weight: 700 });
  back.mesh.parent = root;
  back.mesh.position.set(-HALF - 0.07, 0.012, 0);
  back.mesh.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
  const upLabel = makeLabel(scene, '↑ error', { w: 0.3, h: 0.07, size: 70, weight: 700 });
  upLabel.mesh.parent = root;
  upLabel.mesh.position.set(-HALF - 0.04, 0.3, -HALF - 0.04);

  let trail = null;
  const points = [];
  /** The error at given dials, set by build(). */
  let errorAt = () => 0;

  const toLocal = (w) => new Vector3((w[0] / DIAL_MAX) * HALF, 0, (w[1] / DIAL_MAX) * HALF);
  const heightAt = (w) => 0.006 + HEIGHT * errorFill(errorAt(w));

  return {
    ball,
    ground,
    setEnabled(on) {
      ground.setEnabled(on);
      base.setEnabled(on);
      ball.setEnabled(on);
      if (!on) {
        trail?.dispose();
        trail = null;
        flag.setEnabled(false);
      }
    },
    /** Shapes the terrain from `error(w)` (the neuron's error with the dials at w). */
    build(error) {
      errorAt = error;
      const pos = ground.getVerticesData(VertexBuffer.PositionKind);
      const colors = new Float32Array((pos.length / 3) * 4);
      for (let i = 0; i < pos.length; i += 3) {
        const w = [(pos[i] / HALF) * DIAL_MAX, (pos[i + 2] / HALF) * DIAL_MAX];
        const loss = error(w);
        const f = errorFill(loss);
        pos[i + 1] = 0.006 + HEIGHT * f;
        // Low ground teal, high ground warm sand.
        const c = mix([0.13, 0.55, 0.6], [0.97, 0.78, 0.52], Math.min(1, f * 1.15));
        colors.set([c[0], c[1], c[2], 1], (i / 3) * 4);
      }
      ground.updateVerticesData(VertexBuffer.PositionKind, pos);
      ground.setVerticesData(VertexBuffer.ColorKind, colors);
      ground.createNormals(true);
      ground.refreshBoundingInfo();
    },
    /** Puts the ball on the ground at dials `w`. */
    place(w) {
      const p = toLocal(w);
      p.y = heightAt(w) + BALL / 2;
      ball.position.copyFrom(Vector3.TransformCoordinates(p, root.computeWorldMatrix(true)));
    },
    /** Adds the ball's position to its trail (and starts a new trail with `fresh`). */
    mark(w, fresh = false) {
      if (fresh) points.length = 0;
      const p = toLocal(w);
      p.y = heightAt(w) + 0.008;
      points.push(Vector3.TransformCoordinates(p, root.computeWorldMatrix(true)));
      if (points.length > 400) points.shift();
      trail?.dispose();
      trail = points.length > 1 ? MeshBuilder.CreateLines('trail', { points }, scene) : null;
      if (trail) {
        trail.color = new Color3(0.1, 0.12, 0.15);
        trail.isPickable = false;
      }
    },
    /** Shows the green flag at the lowest point (or hides it with null). */
    showLowest(w) {
      flag.setEnabled(!!w);
      if (!w) return;
      const p = toLocal(w);
      p.y = heightAt(w) + 0.08;
      flag.position.copyFrom(Vector3.TransformCoordinates(p, root.computeWorldMatrix(true)));
    },
    /** The dials under a point in the world (a click on the ground, or where a hand let go of the ball). */
    dialsAt(world) {
      const local = Vector3.TransformCoordinates(world, root.computeWorldMatrix(true).clone().invert());
      const c = (v) => Math.max(-DIAL_MAX, Math.min(DIAL_MAX, (v / HALF) * DIAL_MAX));
      return [c(local.x), c(local.z)];
    },
  };
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
