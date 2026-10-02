// Someone else in the room, drawn from just their head (and hands, in a headset):
// a stylized figure in their color with a floating torso, a face whose eyes blink
// and whose mouth moves with their voice, mitten hands and a name tag. Stylized on
// purpose: a realistic body driven by three points slides around like a statue.
//
// Built for the headset's budget: parts are colored per vertex and merged, so a
// person is 6 draw calls (head, eyes, mouth, body, two hands) plus their name tag,
// all sharing one material. Faces drop out beyond FACE_DISTANCE, whole avatars beyond
// DRAW_DISTANCE, and someone standing inside your head isn't drawn at all.
//
// An outfit dresses everyone for a subject: `{ suit }`, a mesh whose origin is the middle of its
// neck ring (Apollo 11 loads Neil Armstrong's scanned suit), worn in place of the torso, with a
// clear bubble helmet over the face so faces and talking stay visible. Every suit is an instance
// of that one mesh, so a room full of them is a single draw call, plus one see-through helmet each.
import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3, VertexBuffer,
} from '@babylonjs/core';

const FACE_DISTANCE = 20;
const DRAW_DISTANCE = 45;
/** Closer than this to your eyes, someone is hidden (they'd fill your view). */
const PERSONAL_SPACE = 0.55;

const TAG_HEIGHT = 0.3;
/** Torso top, below the eyes. */
const NECK = 0.2;
const TORSO = [
  [0, 0], [0.12, 0.015], [0.155, 0.1], [0.185, 0.3], [0.195, 0.39], [0.185, 0.45], [0.155, 0.505], [0.1, 0.535], [0, 0.545],
];
const TORSO_HEIGHT = 0.545;
/** The gloves the headset's tracked hands wear with a suit (the suit's own hang at its sides). */
const GLOVE = new Color3(0.6, 0.58, 0.54);
/** Eyes to the top of a suit's neck ring. */
const SUIT_NECK = 0.19;

// One material for every avatar in a scene; the color is in the vertices.
const shared = new WeakMap();
function avatarMaterial(scene) {
  let m = shared.get(scene);
  if (!m || m.isDisposed?.()) {
    m = new StandardMaterial('person', scene);
    m.diffuseColor = new Color3(0.82, 0.82, 0.82);
    m.emissiveColor = new Color3(0.16, 0.16, 0.16);
    m.specularColor = new Color3(0.1, 0.1, 0.1);
    m.freeze();
    shared.set(scene, m);
  }
  return m;
}

// The see-through helmet, also shared: one draw call per person on top of the six.
const helmets = new WeakMap();
function helmetMaterial(scene) {
  let m = helmets.get(scene);
  if (!m || m.isDisposed?.()) {
    m = new StandardMaterial('helmet', scene);
    m.diffuseColor = new Color3(0.75, 0.82, 0.9);
    // Faint and lit from within a little, so it reads as glass against black space; the
    // highlight sells the curve. The face shows through clearly.
    m.emissiveColor = new Color3(0.3, 0.34, 0.4);
    m.specularColor = new Color3(1, 1, 1);
    m.specularPower = 128;
    m.alpha = 0.14;
    m.backFaceCulling = true;
    // The face inside must never lose to the glass's depth.
    m.disableDepthWrite = true;
    m.freeze();
    helmets.set(scene, m);
  }
  return m;
}

/** Paints `mesh` one color and bakes its transform, ready to merge. */
function paint(mesh, color) {
  const n = mesh.getTotalVertices();
  const colors = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

export function createAvatar(scene, { id, name, color, outfit = null }) {
  const suit = outfit?.suit ?? null;
  const tint = Color3.FromHexString(color);
  const light = Color3.Lerp(tint, Color3.White(), 0.55);
  const white = new Color3(1, 1, 1);
  const ink = new Color3(0.03, 0.03, 0.05);
  const mat = avatarMaterial(scene);
  const root = new TransformNode(`person-${id}`, scene);
  const meshes = [];
  const finish = (mesh, parent, pickable = false) => {
    mesh.material = mat;
    mesh.parent = parent;
    mesh.isPickable = pickable;
    mesh.metadata = { presenceId: id };
    meshes.push(mesh);
    return mesh;
  };
  const merge = (name, parts) => {
    const mesh = Mesh.MergeMeshes(parts, true, false);
    mesh.name = name;
    // Opaque: merged vertex colors would otherwise count as alpha and sort behind the helmet.
    mesh.hasVertexAlpha = false;
    return mesh;
  };
  const sphere = (diameter, segments, [sx, sy, sz] = [1, 1, 1], [x, y, z] = [0, 0, 0]) => {
    const m = MeshBuilder.CreateSphere('part', { diameter, segments }, scene);
    m.scaling.set(sx, sy, sz);
    m.position.set(x, y, z);
    return m;
  };

  // Head, turned with where they look; the eyes are their own mesh so they can blink.
  const head = new TransformNode(`person-${id}-head`, scene);
  head.parent = root;
  head.rotationQuaternion = Quaternion.Identity();
  const skull = finish(paint(sphere(0.26, 14, [1, 1.08, 0.98]), tint), head, true);
  skull.name = `person-${id}-skull`;
  if (suit) {
    const bubble = sphere(0.37, 16, [1, 1, 1], [0, 0.005, 0.005]);
    bubble.name = `person-${id}-helmet`;
    bubble.parent = head;
    bubble.material = helmetMaterial(scene);
    bubble.isPickable = false;
  }
  const eyeParts = [];
  for (const side of [-1, 1]) {
    eyeParts.push(paint(sphere(0.058, 8, [1, 1, 0.55], [side * 0.05, 0, 0]), white));
    eyeParts.push(paint(sphere(0.03, 6, [1, 1, 0.6], [side * 0.05, -0.003, 0.013]), ink));
  }
  const eyes = finish(merge(`person-${id}-eyes`, eyeParts), head);
  eyes.position.set(0, 0.025, 0.105);
  const mouth = finish(paint(sphere(1, 8), ink), head);
  mouth.position.set(0, -0.052, 0.118);
  mouth.scaling.set(0.05, 0.008, 0.02);

  // Torso with a chest badge, turned more slowly than the head, like a body.
  const torsoShape = MeshBuilder.CreateLathe('part', { shape: TORSO.map(([r, y]) => new Vector3(r, y, 0)), tessellation: 18 }, scene);
  let body;
  if (suit) {
    torsoShape.dispose();
    body = suit.createInstance(`person-${id}-suit`);
    body.parent = root;
    body.isPickable = true;
    body.metadata = { presenceId: id };
  } else {
    body = finish(merge(`person-${id}-body`, [paint(torsoShape, tint), paint(sphere(0.11, 10, [1, 1, 0.35], [0, 0.34, 0.19]), light)]), root, true);
  }
  /** Eyes to the body's origin: the torso's base, or a suit's neck ring. */
  const bodyDrop = suit ? SUIT_NECK : NECK + TORSO_HEIGHT;

  const hands = [-1, 1].map((side) => {
    const hand = finish(paint(sphere(0.1, 8, [0.8, 0.65, 1.1]), suit ? GLOVE : light), root);
    hand.name = `person-${id}-hand`;
    hand.rotationQuaternion = Quaternion.Identity();
    hand.metadata.side = side;
    return hand;
  });

  // Name tag, lit while they talk.
  const tag = MeshBuilder.CreatePlane(`person-${id}-tag`, { width: 0.6, height: 0.15 }, scene);
  tag.billboardMode = Mesh.BILLBOARDMODE_ALL;
  tag.applyFog = false;
  const tex = new DynamicTexture(`person-${id}-tag`, { width: 512, height: 128 }, scene, true);
  tex.hasAlpha = true;
  const tagMat = new StandardMaterial(`person-${id}-tag`, scene);
  tagMat.diffuseTexture = tex;
  tagMat.emissiveColor = Color3.White();
  tagMat.disableLighting = true;
  tagMat.useAlphaFromDiffuseTexture = true;
  tagMat.backFaceCulling = false;
  tag.material = tagMat;
  tag.parent = root;
  tag.metadata = { presenceId: id };

  let label = name;
  let speaking = false;
  let silenced = false;
  const drawTag = () => {
    const c = tex.getContext();
    c.clearRect(0, 0, 512, 128);
    c.fillStyle = speaking ? 'rgba(255,255,255,0.94)' : 'rgba(12,13,18,0.78)';
    c.beginPath();
    c.roundRect(4, 14, 504, 100, 50);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = color;
    c.stroke();
    c.font = '600 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = speaking ? '#111' : '#fff';
    c.fillText(silenced ? `${label} · muted` : label, 256, 66, 470);
    tex.update();
  };
  drawTag();

  // Received poses are eased toward, so 10 updates a second look smooth.
  const target = { area: null, head: new Vector3(), yaw: 0, pitch: 0, hands: null };
  const cur = { head: new Vector3(), yaw: 0, pitch: 0, bodyYaw: 0, hands: [new Vector3(), new Vector3()], mouth: 0 };
  let placed = false;
  let time = Math.random() * 10;
  let nextBlink = 2 + Math.random() * 4;
  root.setEnabled(false);
  const turn = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const yawQuat = new Quaternion();
  const setShown = (mesh, on) => mesh.isEnabled() !== on && mesh.setEnabled(on);
  const rest = new Vector3();

  return {
    headPosition: cur.head,
    get drawn() {
      return root.isEnabled();
    },
    get name() {
      return label;
    },
    info: () => ({ id, name: label, color, silenced }),
    setPose(p, snap = false) {
      target.area = p[0];
      target.head.set(p[1], p[2], p[3]);
      target.yaw = p[4];
      target.pitch = p[5];
      target.hands = p.length >= 12 ? [new Vector3(p[6], p[7], p[8]), new Vector3(p[9], p[10], p[11])] : null;
      if (snap || !placed) {
        cur.head.copyFrom(target.head);
        cur.yaw = cur.bodyYaw = target.yaw;
        cur.pitch = target.pitch;
        target.hands?.forEach((h, i) => cur.hands[i].copyFrom(h));
        placed = true;
      }
    },
    /**
     * Moves toward the latest pose; `level` is their voice level, `eye` where you are.
     * Returns whether they're in your area (and so can be heard).
     */
    update(dt, area, level = 0, eye = null) {
      const here = placed && target.area === area;
      const distance = here && eye ? Vector3.Distance(eye, target.head) : 0;
      const drawn = here && distance < DRAW_DISTANCE && (!eye || distance > PERSONAL_SPACE);
      setShown(root, drawn);
      if (!drawn) {
        if (here) cur.head.copyFrom(target.head); // keep the voice where they are
        return here;
      }
      const near = distance < FACE_DISTANCE;
      setShown(eyes, near);
      setShown(mouth, near);
      time += dt;
      const k = 1 - Math.exp(-dt * 12);
      // A jump (teleport or a new area) snaps instead of sliding through walls.
      if (Vector3.DistanceSquared(cur.head, target.head) > 9) cur.head.copyFrom(target.head);
      else Vector3.LerpToRef(cur.head, target.head, k, cur.head);
      cur.yaw += turn(cur.yaw, target.yaw) * k;
      cur.pitch += (target.pitch - cur.pitch) * k;
      // The body only follows the head once it has turned well away, like shoulders do.
      const lag = turn(cur.bodyYaw, cur.yaw);
      cur.bodyYaw += lag * (1 - Math.exp(-dt * (Math.abs(lag) > 0.6 ? 6 : 1.5)));

      head.position.copyFrom(cur.head);
      Quaternion.FromEulerAnglesToRef(-cur.pitch * 0.8, cur.yaw, 0, head.rotationQuaternion);
      const breath = Math.sin(time * 1.6) * 0.006;
      body.position.set(cur.head.x, cur.head.y - bodyDrop + breath, cur.head.z);
      body.rotation.y = cur.bodyYaw;
      tag.position.set(cur.head.x, cur.head.y + TAG_HEIGHT, cur.head.z);

      // Blinks every few seconds; the mouth opens with their voice (only up close).
      if (near) {
        nextBlink -= dt;
        eyes.scaling.y = nextBlink < 0.12 ? 0.15 : 1;
        if (nextBlink < 0) nextBlink = 2.5 + Math.random() * 4;
        cur.mouth += (Math.min(1, level * 5) - cur.mouth) * (1 - Math.exp(-dt * 25));
        mouth.scaling.y = 0.008 + cur.mouth * 0.035;
        mouth.scaling.x = 0.05 - cur.mouth * 0.012;
      }

      Quaternion.FromEulerAnglesToRef(0, cur.bodyYaw, 0, yawQuat);
      hands.forEach((hand, i) => {
        // A suit has its own gloves at its sides: separate hands show only when a headset tracks them.
        setShown(hand, !suit || !!target.hands);
        if (target.hands) {
          Vector3.LerpToRef(cur.hands[i], target.hands[i], Math.min(1, k * 1.5), cur.hands[i]);
          hand.position.copyFrom(cur.hands[i]);
        } else {
          // On a flat screen there are no hands to follow: they rest at the sides and sway a little.
          const side = hand.metadata.side;
          rest.set(side * 0.25, 0, 0.04 + Math.sin(time * 1.3 + side) * 0.015);
          rest.rotateByQuaternionToRef(yawQuat, rest);
          hand.position.set(cur.head.x + rest.x, cur.head.y - 0.62 + breath, cur.head.z + rest.z);
        }
        hand.rotationQuaternion.copyFrom(yawQuat);
      });
      return true;
    },
    setSpeaking(on) {
      speaking = on;
      drawTag();
    },
    setSilenced(on) {
      silenced = on;
      drawTag();
    },
    setName(next) {
      label = next;
      drawTag();
    },
    dispose() {
      root.dispose(); // the shared material stays
      tagMat.dispose();
      tex.dispose();
    },
  };
}
