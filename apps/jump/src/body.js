// Your own body: a Microsoft Rocketbox avatar (MIT), in a skydiving harness and container, posed
// for each part of the jump: sitting in the helicopter's door, arched belly-down in freefall,
// hanging in the harness under the canopy, standing after landing. Its shoulders are where your
// head says they are; its arms reach for your hands (two-bone IK, elbows down and out), whose
// fingers close when you grip. The head and hair are hidden: they'd be inside your view.
//
// The harness: the main lift webs down the front of your chest, from the three-rings at your
// collarbones where the risers attach (canopy.js RISER_BASE), the chest strap, the shoulder
// straps over to the container on your back, and a leg strap round each thigh.
//
// Posing works on directions, not the rig's own axes: each bone is turned (in world space) so it
// points where it should, so the avatar's bone conventions don't matter.
import {
  Color3, LoadAssetContainerAsync, MeshBuilder, PBRMaterial, Quaternion, Space, TransformNode, Vector3,
} from '@babylonjs/core';

const MODEL = `${import.meta.env.BASE_URL}models/jumper.glb`;
/** Where the risers meet the harness, in the shoulders' frame (x right, y up, z forward). */
export const RISER_BASE = { x: 0.11, y: 0.03, front: 0.15, rear: 0.12 };

/** Leg directions for each pose, in the heading's frame (x right, y up, z forward). */
const LEGS = {
  seated: { thigh: [0, -0.12, 1], calf: [0, -1, 0.12], spread: 0.08 },
  hanging: { thigh: [0, -0.55, 0.85], calf: [0, -1, -0.05], spread: 0.12 },
  freefall: { thigh: [0, -0.3, -1], calf: [0, 0.8, -0.6], spread: 0.35 },
  standing: { thigh: [0, -1, 0.02], calf: [0, -1, 0], spread: 0.06 },
};
/** Where the hands go when no controller says otherwise: in the shoulders' heading frame. */
const HANDS = {
  seated: [0.24, -0.42, 0.32],
  hanging: [0.2, 0.36, -0.04],
  freefall: [0.48, 0.02, 0.32],
  standing: [0.2, -0.58, 0.04],
};

export async function createBody(scene) {
  const container = await LoadAssetContainerAsync(MODEL, scene);
  container.addAllToScene();
  const nodes = new Map(container.transformNodes.map((n) => [n.name, n]));
  const bone = (name) => {
    const n = nodes.get(`Bip01 ${name}`);
    if (!n) throw new Error(`The jumper has no ${name}.`);
    return n;
  };
  const head = [];
  for (const mesh of container.meshes) {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    if (mesh.material && /head|opacity/i.test(mesh.material.name)) head.push(mesh);
  }

  // The heading's frame at your shoulders -> the avatar turned to face +z, shoulders at the origin.
  const frame = new TransformNode('jumper-body', scene);
  const align = new TransformNode('jumper-align', scene);
  align.parent = frame;
  for (const n of container.rootNodes) n.parent = align;
  const at = (n) => {
    n.computeWorldMatrix(true);
    return n.getAbsolutePosition().clone();
  };
  const refresh = () => {
    frame.computeWorldMatrix(true);
    align.computeWorldMatrix(true);
    for (const n of container.transformNodes) n.computeWorldMatrix(true);
  };
  refresh();
  {
    const right = at(bone('R Thigh')).subtract(at(bone('L Thigh'))).normalize();
    const up = at(bone('Neck')).subtract(at(bone('Pelvis'))).normalize();
    const forward = Vector3.Cross(right, up).normalize();
    const fixedRight = Vector3.Cross(up, forward).normalize();
    align.rotationQuaternion = Quaternion.Inverse(Quaternion.RotationQuaternionFromAxis(fixedRight, up, forward));
    refresh();
    const shoulders = at(bone('L UpperArm')).add(at(bone('R UpperArm'))).scale(0.5);
    align.position.subtractInPlace(shoulders);
    refresh();
  }

  const limbs = {
    left: { upper: bone('L UpperArm'), fore: bone('L Forearm'), hand: bone('L Hand'), side: -1 },
    right: { upper: bone('R UpperArm'), fore: bone('R Forearm'), hand: bone('R Hand'), side: 1 },
  };
  for (const arm of Object.values(limbs)) {
    arm.a = Vector3.Distance(at(arm.fore), at(arm.upper));
    arm.b = Vector3.Distance(at(arm.hand), at(arm.fore));
    const p = arm.side < 0 ? 'L' : 'R';
    arm.middle = bone(`${p} Finger2`);
    arm.thumb = bone(`${p} Finger0`);
    arm.fingers = ['0', '1', '2', '3', '4'].flatMap((f) => [`${p} Finger${f}`, `${p} Finger${f}1`, `${p} Finger${f}2`].map(bone));
  }
  const legs = {
    left: { thigh: bone('L Thigh'), calf: bone('L Calf'), foot: bone('L Foot'), side: -1 },
    right: { thigh: bone('R Thigh'), calf: bone('R Calf'), foot: bone('R Foot'), side: 1 },
  };
  // Every bone this file turns goes back to its rest each frame, then is posed from there.
  const posed = [
    ...Object.values(limbs).flatMap((a) => [a.upper, a.fore, a.hand, ...a.fingers]),
    ...Object.values(legs).flatMap((l) => [l.thigh, l.calf]),
  ];
  const rest = new Map(posed.map((n) => [n, (n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation)).clone()]));
  for (const n of posed) n.rotationQuaternion ??= rest.get(n).clone();

  /** Turns `node` (in world space) so its child `toward` lies along `dir`. */
  const tmp = { a: new Vector3(), axis: new Vector3() };
  function aim(node, toward, dir) {
    const from = at(node);
    const cur = at(toward).subtractInPlace(from).normalize();
    const want = dir.normalizeToNew();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(cur, want)));
    if (dot > 0.99999) return;
    Vector3.CrossToRef(cur, want, tmp.axis);
    if (tmp.axis.lengthSquared() < 1e-10) return;
    node.rotate(tmp.axis.normalize(), Math.acos(dot), Space.WORLD);
    node.computeWorldMatrix(true);
    for (const n of node.getDescendants(false)) n.computeWorldMatrix(true);
  }
  /** Rolls `node` about `axis` (world) so `toward` (a child) lies as near `dir` as it can. */
  function roll(node, toward, axis, dir) {
    const from = at(node);
    const cur = at(toward).subtractInPlace(from);
    const ax = axis.normalizeToNew();
    const c = cur.subtract(ax.scale(Vector3.Dot(cur, ax))).normalize();
    const d = dir.subtract(ax.scale(Vector3.Dot(dir, ax))).normalize();
    const angle = Math.atan2(Vector3.Dot(Vector3.Cross(c, d), ax), Vector3.Dot(c, d));
    if (Math.abs(angle) < 1e-4) return;
    node.rotate(ax, angle, Space.WORLD);
    for (const n of [node, ...node.getDescendants(false)]) n.computeWorldMatrix(true);
  }

  // --- The harness and container ---------------------------------------------------------------
  const webbing = new PBRMaterial('harness-webbing', scene);
  webbing.albedoColor = Color3.FromHexString('#060709');
  webbing.metallic = 0;
  webbing.roughness = 0.85;
  const cordura = new PBRMaterial('container-cordura', scene);
  cordura.albedoColor = Color3.FromHexString('#15171b');
  cordura.metallic = 0;
  cordura.roughness = 0.8;
  const trim = new PBRMaterial('container-trim', scene);
  trim.albedoColor = Color3.FromHexString('#a81c22');
  trim.metallic = 0;
  trim.roughness = 0.7;
  const steel = new PBRMaterial('harness-steel', scene);
  steel.albedoColor = Color3.FromHexString('#a3a8ad');
  steel.metallic = 0.6;
  steel.roughness = 0.35;
  /** The torso's frame (x right, y up, z out of the chest), at the shoulders. */
  const torso = new TransformNode('jumper-torso', scene);
  torso.rotationQuaternion = new Quaternion();
  const part = (mesh, material, parent = torso) => {
    mesh.material = material;
    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  };
  const box = (name, w, h, d, material) => part(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), material);
  // Container: the main on top, the reserve below it, a red trim round the edge, the pilot chute's pouch at the bottom.
  // Rounded: a box with its edges taken off by a slightly larger, shorter one.
  const pack = box('container', 0.34, 0.52, 0.15, cordura);
  pack.position.set(0, -0.24, -0.19);
  const packSides = box('container-sides', 0.37, 0.46, 0.12, cordura);
  packSides.position.set(0, -0.24, -0.19);
  const reserve = box('container-reserve', 0.32, 0.14, 0.04, cordura);
  reserve.position.set(0, -0.07, -0.275);
  const edge = box('container-trim', 0.35, 0.02, 0.155, trim);
  edge.position.set(0, -0.5, -0.19);
  const edgeTop = box('container-trim', 0.33, 0.015, 0.045, trim);
  edgeTop.position.set(0, -0.145, -0.275);
  const pouch = part(MeshBuilder.CreateCylinder('pilot-chute-pouch', { height: 0.05, diameter: 0.1, tessellation: 14 }, scene), cordura);
  pouch.position.set(0.08, -0.47, -0.29);
  pouch.rotation.x = Math.PI / 2;
  /** A strap from a to b (torso frame), webbing 4.5 cm wide. */
  const strap = (name, a, b, width = 0.045) => {
    const m = box(name, width, 1, 0.007, webbing);
    const from = new Vector3(...a);
    const to = new Vector3(...b);
    const along = to.subtract(from);
    m.position.copyFrom(from.add(to).scaleInPlace(0.5));
    m.scaling.y = along.length();
    m.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), along.normalize(), m.rotationQuaternion);
    return m;
  };
  for (const side of [-1, 1]) {
    const x = side * RISER_BASE.x;
    strap('main-lift-web', [x, RISER_BASE.y, RISER_BASE.front], [side * 0.13, -0.5, 0.16]);
    strap('shoulder-strap', [x, RISER_BASE.y, RISER_BASE.front], [side * 0.11, 0.06, -0.12]);
    strap('back-strap', [side * 0.14, -0.5, 0.16], [side * 0.17, -0.48, -0.12]);
    // The three-ring where the riser attaches.
    const ring = part(MeshBuilder.CreateTorus('three-ring', { diameter: 0.04, thickness: 0.006, tessellation: 14 }, scene), steel);
    ring.position.set(x, RISER_BASE.y + 0.005, RISER_BASE.front + 0.008);
    ring.rotation.x = Math.PI / 2;
  }
  strap('chest-strap', [-0.13, -0.2, 0.175], [0.13, -0.2, 0.175], 0.03);
  // Leg straps: placed round each thigh every frame.
  const legStraps = Object.values(legs).map((leg) => {
    const m = part(MeshBuilder.CreateTorus('leg-strap', { diameter: 0.215, thickness: 0.04, tessellation: 18 }, scene), webbing, null);
    m.rotationQuaternion = new Quaternion();
    return { leg, mesh: m };
  });

  const v = (a, q) => new Vector3(a[0], a[1], a[2]).applyRotationQuaternion(q);
  const yaw = new Quaternion();
  const temp = new Vector3();

  return {
    /** Shows or hides the head (it's hidden from your own eyes; shown to a chase camera). */
    showHead(show) {
      for (const m of head) m.isVisible = show;
    },
    setEnabled(on) {
      frame.setEnabled(on);
      torso.setEnabled(on);
      for (const s of legStraps) s.mesh.setEnabled(on);
    },
    /**
     * Poses the body. `pose`: seated | freefall | hanging | standing. `shoulders`: world point;
     * `heading` radians; `scale` for your height; `hands`: { left, right } each null or
     * { pos, rot, grip } (world position and rotation of the controller's grip, grip 0..1).
     */
    update({ pose, shoulders, heading, scale = 1, hands }) {
      Quaternion.RotationYawPitchRollToRef(heading, 0, 0, yaw);
      frame.position.copyFrom(shoulders);
      frame.scaling.setAll(scale);
      // In freefall you lie on the air: belly down, head toward your heading.
      frame.rotationQuaternion = pose === 'freefall'
        ? yaw.multiply(Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2))
        : yaw.clone();
      for (const n of posed) n.rotationQuaternion.copyFrom(rest.get(n));
      refresh();

      const legPose = LEGS[pose];
      for (const leg of Object.values(legs)) {
        const thigh = v(legPose.thigh, yaw);
        thigh.addInPlace(v([leg.side * legPose.spread, 0, 0], yaw));
        aim(leg.thigh, leg.calf, thigh);
        aim(leg.calf, leg.foot, v(legPose.calf, yaw).addInPlace(v([leg.side * legPose.spread * 0.6, 0, 0], yaw)));
      }

      for (const [name, arm] of Object.entries(limbs)) {
        const hand = hands?.[name];
        const target = hand ? hand.pos.clone() : shoulders.add(v([arm.side * HANDS[pose][0], HANDS[pose][1], HANDS[pose][2]], yaw).scaleInPlace(scale));
        // Two-bone IK: the elbow where both bones reach, bent down and out.
        const s = at(arm.upper);
        const a = arm.a * scale;
        const b = arm.b * scale;
        const toTarget = target.subtract(s);
        const d = Math.min(Math.max(toTarget.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3);
        const dir = toTarget.normalize();
        const pole = v([arm.side * 0.8, -1, pose === 'freefall' ? 0.2 : -0.3], yaw);
        const perp = pole.subtract(dir.scale(Vector3.Dot(pole, dir))).normalize();
        const along = (a * a - b * b + d * d) / (2 * d);
        const elbow = s.add(dir.scale(along)).addInPlace(perp.scale(Math.sqrt(Math.max(0, a * a - along * along))));
        aim(arm.upper, arm.fore, elbow.subtract(s));
        aim(arm.fore, arm.hand, s.add(dir.scale(d)).subtractInPlace(elbow));
        if (hand?.rot) {
          // Fingers along the controller's forward, the thumb up along its top.
          const forward = Vector3.Forward().applyRotationQuaternion(hand.rot);
          const up = Vector3.Up().applyRotationQuaternion(hand.rot);
          aim(arm.hand, arm.middle, forward);
          roll(arm.hand, arm.thumb, forward, up);
        }
        // A grip closes the fingers round the toggle.
        const close = hand ? hand.grip : pose === 'hanging' ? 1 : 0.25;
        if (close > 0.01) {
          const hp = at(arm.hand);
          const across = at(arm.thumb).subtractInPlace(hp);
          const fingersDir = at(arm.middle).subtractInPlace(hp);
          const axis = Vector3.Cross(fingersDir, across).normalize().scaleInPlace(arm.side);
          for (const f of arm.fingers) {
            if (/Finger0/.test(f.name)) continue;
            f.rotate(axis, 0.75 * close, Space.WORLD);
            for (const n of [f, ...f.getDescendants(false)]) n.computeWorldMatrix(true);
          }
        }
      }

      // The torso's frame for the harness, from where the shoulders and hips are now.
      const l = at(limbs.left.upper);
      const r = at(limbs.right.upper);
      const right = r.subtract(l).normalize();
      const up = at(bone('Neck')).subtractInPlace(at(bone('Pelvis'))).normalize();
      const out = Vector3.Cross(right, up).normalize();
      Quaternion.RotationQuaternionFromAxisToRef(Vector3.Cross(up, out).normalize(), up, out, torso.rotationQuaternion);
      torso.position.copyFrom(l.add(r).scaleInPlace(0.5));
      torso.scaling.setAll(scale);
      for (const { leg, mesh } of legStraps) {
        const hip = at(leg.thigh);
        const knee = at(leg.calf);
        knee.subtractToRef(hip, temp);
        mesh.position.copyFrom(hip).addInPlace(temp.scale(0.2));
        Quaternion.FromUnitVectorsToRef(Vector3.Up(), temp.normalize(), mesh.rotationQuaternion);
        mesh.scaling.setAll(scale);
      }
    },
  };
}
