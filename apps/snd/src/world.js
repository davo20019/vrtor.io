import {
  Scene, Color3, Color4, Vector3, Mesh, MeshBuilder, StandardMaterial,
  HemisphericLight, PointLight, TransformNode, DynamicTexture, PointerEventTypes,
} from '@babylonjs/core';
import { createObjectInteraction, attachGripInteraction, STATIONS } from './spatial.js';

export const V = (x, y, z) => new Vector3(x, y, z);
const C = (hex) => Color3.FromHexString(hex);

export function buildWorld(engine, onChoose) {
  let activity = { view: 'home', heard: false }, comparison = false, selectedPart = null;
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.025, 0.065, 0.09, 1);
  const hemi = new HemisphericLight('soft skylight', V(0, 1, -0.3), scene);
  hemi.intensity = 0.9; hemi.groundColor = C('#183044');
  const light = new PointLight('mouth light', V(0, 4, -1), scene); light.intensity = 0.6;
  function material(name, hex, glow = false) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = C(hex); m.specularColor = C('#223843');
    if (glow) m.emissiveColor = C(hex).scale(0.7);
    return m;
  }
  const mats = {
    floor: material('midnight terrazzo', '#142d39'), wall: material('petrol walls', '#0d202c'),
    teal: material('sea glass', '#62e2cd'), coral: material('warm coral', '#ff977d'),
    white: material('warm ivory', '#f5efdf'), ink: material('ink', '#183647'),
    gold: material('soft gold', '#ffd37e'), tongue: material('tongue', '#ee8c9b'),
    rim: material('luminous mint', '#70f4d3', true),
  };
  function box(name, size, at, mat, parent = null) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.copyFrom(at); mesh.material = mat; mesh.parent = parent; mesh.isPickable = false;
    return mesh;
  }
  function sphere(name, size, at, mat, parent = null) {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);
    mesh.scaling.set(...size); mesh.position.copyFrom(at); mesh.material = mat; mesh.parent = parent; mesh.isPickable = false;
    return mesh;
  }
  function label(name, text, at, width = 1.2, height = 0.32, color = '#f5efdf') {
    const mesh = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    mesh.position.copyFrom(at); mesh.isPickable = false;
    const texture = new DynamicTexture(`${name}-text`, { width: 1024, height: Math.round(1024 * height / width) }, scene, true);
    const mat = material(`${name}-label`, '#ffffff');
    mat.diffuseTexture = texture; mat.emissiveColor = Color3.White(); mat.disableLighting = true; mat.backFaceCulling = false;
    texture.hasAlpha = true; mat.useAlphaFromDiffuseTexture = true; mesh.material = mat;
    const set = (value) => {
      const ctx = texture.getContext(), size = texture.getSize();
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.font = `600 ${Math.round(size.height * 0.65)}px system-ui, sans-serif`; ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(value, size.width / 2, size.height / 2, size.width - 40); texture.update();
    };
    set(text); return { mesh, set };
  }
  const floor = MeshBuilder.CreateGround('teleport floor', { width: 12, height: 12 }, scene);
  floor.material = mats.floor;
  box('back wall', [12, 5, 0.2], V(0, 2.5, 5), mats.wall);
  box('left wall', [0.2, 5, 12], V(-6, 2.5, 0), mats.wall);
  box('right wall', [0.2, 5, 12], V(6, 2.5, 0), mats.wall);
  for (const x of [-4.6, -3.6, -2.6, 2.6, 3.6, 4.6]) box('wall rib', [0.04, 3.7, 0.05], V(x, 2.3, 4.85), mats.teal);
  for (const z of [-3, 0, 3]) box('floor seam', [11.6, 0.006, 0.014], V(0, 0.008, z), mats.ink);
  label('sound lab sign', 'S O U N D   L A B', V(0, 3.5, 4.82), 4, 0.6, '#70f4d3');
  label('lab subtitle', 'LISTEN  /  NOTICE  /  SPEAK', V(0, 2.96, 4.8), 3, 0.25);

  const stands = [], models = [], names = [], rims = [];
  for (let side = 0; side < 2; side++) {
    const x = side ? 1.15 : -1.15;
    const stand = MeshBuilder.CreateCylinder(`choice ${side + 1} plinth`, { diameter: 1.45, height: 0.75, tessellation: 32 }, scene);
    stand.position.set(x, 0.375, 0.65); stand.material = mats.ink; stand.metadata = { side }; stands.push(stand);
    const rim = MeshBuilder.CreateTorus('choice rim', { diameter: 1.38, thickness: 0.035, tessellation: 40 }, scene);
    rim.position.set(x, 0.76, 0.65); rim.material = side ? mats.coral : mats.teal; rim.isPickable = false; rims.push(rim);
    const root = new TransformNode(`choice ${side}`, scene); root.position.set(x, 0.85, 0.65); models.push(root);
    names.push(label(`choice label ${side}`, side ? 'RIGHT' : 'LEFT', V(x, 0.43, -0.1), 1.22, 0.24));
  }
  function object(type, parent, side) {
    const accent = side ? mats.coral : mats.teal;
    if (type === 'ship') {
      sphere('ship hull', [1, 0.25, 0.42], V(0, 0.14, 0), accent, parent);
      box('mast', [0.025, 0.8, 0.025], V(0, 0.63, 0), mats.gold, parent);
      const sail = MeshBuilder.CreateCylinder('triangular sail', { diameterTop: 0, diameterBottom: 0.63, height: 0.7, tessellation: 3 }, scene);
      sail.scaling.z = 0.045; sail.position.set(0.17, 0.68, 0); sail.material = mats.white; sail.parent = parent;
    } else if (type === 'sheep' || type === 'cat') {
      sphere('body', [0.77, 0.46, 0.4], V(0, 0.36, 0), type === 'sheep' ? mats.white : accent, parent);
      sphere('head', [0.32, 0.32, 0.3], V(0.38, 0.55, -0.02), type === 'sheep' ? mats.ink : accent, parent);
      for (const x of [-0.25, 0.25]) for (const z of [-0.13, 0.13]) box('leg', [0.08, 0.25, 0.08], V(x, 0.12, z), mats.ink, parent);
      if (type === 'sheep') for (const x of [-0.23, 0, 0.23]) for (const z of [-0.13, 0.13]) sphere('wool', [0.3, 0.32, 0.3], V(x, 0.45, z), mats.white, parent);
      for (const z of [-0.1, 0.1]) sphere('ear', [0.09, 0.21, 0.07], V(0.35, 0.73, z), accent, parent);
      sphere('eye', [0.035, 0.035, 0.035], V(0.48, 0.6, -0.16), mats.ink, parent);
    } else if (type === 'scissors') {
      for (const sign of [-1, 1]) {
        const handle = MeshBuilder.CreateTorus('scissor handle', { diameter: 0.25, thickness: 0.07, tessellation: 20 }, scene);
        handle.parent = parent; handle.position.set(sign * 0.15, 0.2, 0); handle.rotation.x = Math.PI / 2; handle.material = accent;
        const blade = box('scissor blade', [0.07, 0.6, 0.04], V(sign * 0.15, 0.59, 0), mats.white, parent); blade.rotation.z = -sign * 0.45;
      }
    } else if (type === 'vest') {
      box('vest body', [0.64, 0.65, 0.2], V(0, 0.4, 0), accent, parent);
      for (const x of [-0.24, 0.24]) box('vest shoulder', [0.17, 0.22, 0.2], V(x, 0.8, 0), accent, parent);
      box('zip', [0.025, 0.55, 0.015], V(0, 0.4, -0.11), mats.gold, parent);
    } else if (type === 'trophy') {
      sphere('trophy cup', [0.58, 0.5, 0.4], V(0, 0.65, 0), mats.gold, parent);
      box('stem', [0.09, 0.3, 0.09], V(0, 0.34, 0), mats.gold, parent);
      box('base', [0.48, 0.1, 0.3], V(0, 0.11, 0), mats.ink, parent);
    } else if (type === 'thin') {
      box('thin book', [0.58, 0.04, 0.46], V(0, 0.2, 0), accent, parent);
      box('thin book pages', [0.54, 0.015, 0.42], V(0, 0.202, -0.01), mats.white, parent);
    } else {
      const token = MeshBuilder.CreateTorus('sound token', { diameter: 0.6, thickness: 0.13, tessellation: 28 }, scene);
      token.rotation.x = Math.PI / 2; token.position.y = 0.46; token.material = accent; token.parent = parent;
    }
    for (const mesh of parent.getChildMeshes()) { mesh.isPickable = true; mesh.metadata = { side }; }
  }

  // An intentionally simplified side cutaway: front is to the right, throat to the left.
  const mouth = new TransformNode('schematic mouth', scene); mouth.position.set(3, 2.15, 3.1); mouth.scaling.setAll(1.35);
  sphere('mouth interior', [1.7, 1.2, 0.6], V(0, 0, 0.42), mats.ink, mouth);
  const palatePoints = [V(-0.67, 0, 0), V(-0.53, 0.37, 0), V(-0.1, 0.49, 0), V(0.4, 0.35, 0), V(0.68, 0.14, 0)];
  const palate = MeshBuilder.CreateTube('palate', { path: palatePoints, radius: 0.065, tessellation: 12 }, scene); palate.parent = mouth; palate.material = mats.white; palate.isPickable = false;
  const upperTeeth = box('upper front teeth', [0.09, 0.21, 0.38], V(0.59, 0.14, -0.03), mats.white, mouth);
  const lowerTeeth = box('lower front teeth', [0.09, 0.14, 0.38], V(0.59, -0.29, -0.03), mats.white, mouth);
  const upperLip = sphere('upper lip', [0.2, 0.13, 0.46], V(0.74, 0.2, 0), mats.coral, mouth);
  const lowerLip = sphere('lower lip', [0.2, 0.13, 0.46], V(0.74, -0.32, 0), mats.coral, mouth);
  const paths = {
    ih: [[-0.6,-0.34],[-0.28,-0.04],[0.06,0.15],[0.37,0.12],[0.46,-0.16]],
    ee: [[-0.6,-0.34],[-0.28,0.02],[0.12,0.31],[0.4,0.23],[0.47,-0.12]],
    ae: [[-0.6,-0.39],[-0.28,-0.23],[0.12,-0.14],[0.38,-0.18],[0.46,-0.33]],
    uh: [[-0.6,-0.37],[-0.28,-0.09],[0.03,-0.02],[0.26,-0.16],[0.44,-0.29]],
    th: [[-0.6,-0.34],[-0.28,-0.19],[0.15,-0.14],[0.48,-0.08],[0.75,-0.06]],
    s: [[-0.6,-0.34],[-0.28,-0.18],[0.15,-0.13],[0.37,0.03],[0.5,0.035]],
    v: [[-0.6,-0.34],[-0.28,-0.17],[0.1,-0.2],[0.3,-0.25],[0.45,-0.28]],
    b: [[-0.6,-0.34],[-0.28,-0.17],[0.1,-0.2],[0.3,-0.25],[0.45,-0.28]],
  };
  const pathVectors = (key) => paths[key].map(([x, y]) => V(x, y, -0.09));
  let tongue = MeshBuilder.CreateTube('tongue', { path: pathVectors('ih'), radius: 0.07, tessellation: 12, updatable: true }, scene);
  tongue.parent = mouth; tongue.material = mats.tongue; tongue.isPickable = false;
  const mouthCaption = label('mouth caption', 'MOUTH LAB · SIMPLIFIED CUTAWAY', V(3, 3.15, 3), 2.9, 0.22, '#70f4d3');
  const mouthOrientation = label('mouth orientation', 'THROAT ←     → LIPS', V(3, 1.38, 3), 2, 0.18);
  const soundLabel = label('mouth sound', '/ɪ/', V(3, 3.45, 3), 1, 0.3);
  const partLabel = label('mouth part', 'Point at tongue, teeth or lips to inspect', V(3, 3.75, 3), 3.0, 0.17);
  const teachingLines = [1.15, 0.96, 0.77].map((y, i) => label(`mouth teaching ${i}`, '', V(3, y, 3), 3.0, 0.16));
  const parts = { tongue: [tongue], teeth: [upperTeeth, lowerTeeth], lips: [upperLip, lowerLip] };
  for (const [part, meshes] of Object.entries(parts)) for (const mesh of meshes) {
    mesh.isPickable = true; mesh.metadata = { part };
  }
  const explanations = { tongue: 'Tongue: watch height and forward position', teeth: 'Teeth: notice contact for /θ/ and /v/', lips: 'Lips: /b/ closes them; /v/ touches lower lip to teeth' };
  function inspectPart(part) {
    selectedPart = selectedPart === part ? null : part;
    for (const [key, meshes] of Object.entries(parts)) for (const mesh of meshes) {
      mesh.renderOutline = selectedPart === key; mesh.outlineColor = C('#ffd37e'); mesh.outlineWidth = 0.02;
    }
    partLabel.set(explanations[selectedPart] ?? 'Point at tongue, teeth or lips to inspect');
  }
  const particles = Array.from({ length: 7 }, () => sphere('airflow', [0.035, 0.035, 0.035], V(0, 0, 0), mats.rim, mouth));
  let mouthKey = 'ih', animated = true, elapsed = 0, morph = 1;
  let fromPath = pathVectors('ih'), toPath = pathVectors('ih'), fromLip = -0.23, toLip = -0.23, fromTeeth = -0.26, toTeeth = -0.26;
  let contrast = null, lastCompareSide = -1;
  function setMouth(key, symbol) {
    const next = paths[key] ? key : 'uh';
    if (next !== mouthKey) {
      fromPath = fromPath.map((v, i) => Vector3.Lerp(v, toPath[i], morph));
      fromLip = lowerLip.position.y; fromTeeth = lowerTeeth.position.y;
      mouthKey = next; toPath = pathVectors(mouthKey); morph = 0;
      toLip = mouthKey === 'v' ? 0.02 : mouthKey === 'b' ? 0.12 : ['ae', 'uh'].includes(mouthKey) ? -0.41 : -0.23;
      toTeeth = ['ae', 'uh'].includes(mouthKey) ? -0.4 : -0.26;
    }
    upperLip.position.y = mouthKey === 'b' ? 0.22 : 0.2;
    soundLabel.set(`/${symbol}/`);
  }

  // A visible answer receiver turns recognition into an action with an object.
  const receiver = MeshBuilder.CreateTorus('answer ring', { diameter: 1.1, thickness: 0.085, tessellation: 40 }, scene);
  receiver.position.set(0, 0.8, -0.45); receiver.material = mats.gold;
  receiver.metadata = { answer: true };
  const receiverLabel = label('answer instruction', 'LISTEN, THEN PLACE A WORD HERE', V(0, 0.43, -1.03), 2, 0.18, '#ffd37e');
  const interaction = createObjectInteraction({
    models, target: V(0, 1.05, -0.45), enabled: () => activity.view === 'listen' && activity.heard,
    onAnswer: onChoose,
    onSelect(side) {
      receiverLabel.set(side === null ? 'LISTEN, THEN PLACE A WORD HERE' : 'RELEASE IN RING · OR POINT & TAP RING');
      models.forEach((root, i) => root.getChildMeshes().forEach((mesh) => { mesh.renderOutline = i === side; mesh.outlineColor = C('#ffd37e'); mesh.outlineWidth = 0.025; }));
    },
  });

  const consoleRoot = new TransformNode('activity console', scene);
  const activityTitle = label('activity title', 'LISTENING LAB', V(0, 2.55, 0.8), 3.2, 0.28, '#70f4d3');
  const activityHint = label('activity instruction', '', V(0, 2.22, 0.8), 3.7, 0.18);
  const activityStatus = label('activity status', '', V(0, 1.98, 0.8), 3.7, 0.18, '#ffd37e');
  const controls = Array.from({ length: 8 }, (_, i) => {
    const at = V((i % 2 ? 1 : -1) * 0.62, 1.46 - Math.floor(i / 2) * 0.25, 0);
    const mesh = box(`lab control ${i}`, [1.16, 0.21, 0.1], at, mats.ink, consoleRoot);
    mesh.isPickable = true; mesh.metadata = { control: i };
    const text = label(`lab control label ${i}`, '', at.add(V(0, 0, -0.1)), 1.08, 0.13);
    text.mesh.parent = consoleRoot;
    return { mesh, text, action: null };
  });
  for (const [name, s] of Object.entries(STATIONS)) {
    const pad = MeshBuilder.CreateTorus(`${name} station marker`, { diameter: 1.4, thickness: 0.025, tessellation: 32 }, scene);
    pad.position.set(...s.position); pad.position.y = 0.02; pad.material = mats.rim; pad.isPickable = false;
  }

  // Loudness makes speaking visible in space; it does not score pronunciation.
  const voiceRoot = new TransformNode('speaking station', scene); voiceRoot.position.set(-3, 0.45, 3);
  box('speaking pedestal', [2.1, 0.15, 0.6], V(0, 0.75, 0), mats.ink, voiceRoot);
  const voiceBars = Array.from({ length: 11 }, (_, i) => box('live voice level', [0.1, 1, 0.1], V((i - 5) * 0.16, 1.05, 0), mats.teal, voiceRoot));
  const voiceTitle = label('voice caption', 'YOUR VOICE · LIVE VOLUME', V(-3, 2.75, 3), 2.8, 0.22, '#70f4d3');
  const voiceNote = label('voice note', 'Listen · Record · Compare', V(-3, 1.08, 3), 2.5, 0.16);
  let getVoiceLevel = () => 0, controlsKey = '';
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000); elapsed += dt;
    models.forEach((root, i) => { if (interaction.held?.model !== root && animated) root.rotation.y = 0.14 * Math.sin(elapsed * 0.6 + i); });
    if (comparison && contrast) {
      const side = Math.floor(elapsed / 2.4) % 2;
      if (side !== lastCompareSide) { lastCompareSide = side; setMouth(contrast.keys[side], contrast.symbols[side]); }
    }
    if (morph < 1) {
      morph = Math.min(1, morph + (animated ? dt * 1.8 : 1));
      tongue = MeshBuilder.CreateTube('tongue', { path: fromPath.map((v, i) => Vector3.Lerp(v, toPath[i], morph)), radius: 0.07, instance: tongue }, scene);
      lowerLip.position.y = fromLip + (toLip - fromLip) * morph;
      lowerTeeth.position.y = fromTeeth + (toTeeth - fromTeeth) * morph;
    }
    for (let i = 0; i < particles.length; i++) {
      const t = ((elapsed * 0.4 + i / particles.length) % 1);
      particles[i].position.set(-0.53 + t * 1.55, -0.02, -0.2);
      particles[i].setEnabled(animated && mouthKey !== 'b');
    }
    const level = activity.recording ? getVoiceLevel() : 0;
    voiceBars.forEach((bar, i) => {
      const h = 0.045 + Math.min(1, level * (1 - Math.abs(i - 5) / 8)) * 1.2;
      bar.scaling.y = h; bar.position.y = 0.86 + h / 2;
    });
  });
  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP || !info.pickInfo?.hit) return;
    const data = info.pickInfo.pickedMesh.metadata;
    if (!data) return;
    if (data.control !== undefined) { controls[data.control].action?.(); return; }
    if (data.part) { inspectPart(data.part); return; }
    if (data.answer) { interaction.release(null, true); return; }
    if (data.side !== 0 && data.side !== 1) return;
    if (activity.view === 'listen') {
      if (!activity.heard) { onChoose(data.side); return; }
      if (interaction.held?.anchor) return;
      interaction.reset(); interaction.take(data.side); return;
    }
    onChoose(data.side);
  });
  return {
    scene, floor, interaction,
    attachXr(rig) { attachGripInteraction(rig, interaction, models); },
    voiceLevel(read) { getVoiceLevel = read; },
    rotateMouth(direction) { mouth.rotation.y = Math.max(-0.65, Math.min(0.65, mouth.rotation.y + direction * 0.22)); },
    compareMouth(keys, symbols) {
      contrast = { keys, symbols }; comparison = !comparison; lastCompareSide = -1; return comparison;
    },
    stopComparison() { comparison = false; },
    get comparing() { return comparison; },
    setActivity(data) {
      const changed = activity.view !== data.view; activity = data;
      if (changed || data.view !== 'listen' || !data.heard) interaction.reset();
      const s = STATIONS[data.station]; consoleRoot.position.set(...s.console);
      const active = ['preview', 'listen', 'feedback', 'mouth', 'speak'].includes(data.view);
      consoleRoot.setEnabled(active);
      const listening = ['preview', 'listen', 'feedback'].includes(data.view);
      for (const root of [...stands, ...rims, ...models, ...names.map((l) => l.mesh)]) root.setEnabled(listening || data.view === 'home' || data.view === 'complete');
      receiver.setEnabled(data.view === 'listen'); receiverLabel.mesh.setEnabled(data.view === 'listen');
      voiceRoot.setEnabled(data.view === 'speak'); voiceTitle.mesh.setEnabled(data.view === 'speak'); voiceNote.mesh.setEnabled(data.view === 'speak');
      for (const l of [activityTitle, activityHint, activityStatus]) l.mesh.setEnabled(active && listening);
      const lines = (data.teaching ?? '').match(/.{1,66}(?:\s|$)/g) ?? [];
      teachingLines.forEach((l, i) => { l.set(lines[i]?.trim() ?? ''); l.mesh.setEnabled(data.view === 'mouth'); });
      activityTitle.set(data.title); activityHint.set(data.hint); activityStatus.set(data.status);
      voiceTitle.set(data.view === 'speak' ? data.title : 'YOUR VOICE');
      voiceNote.set(data.recording ? 'Live volume · not a pronunciation score' : 'Listen · Record · Compare');
      const key = JSON.stringify([data.actions.map((a) => a.label), data.busy]);
      controls.forEach((c, i) => {
        const a = data.actions[i]; c.mesh.setEnabled(!!a); c.text.mesh.setEnabled(!!a);
        c.action = a && (!data.busy || a.label === 'Stop recording') ? a.onClick : null;
        if (key !== controlsKey) { c.text.set(a?.label ?? ''); c.mesh.material = mats.ink; c.mesh.renderOutline = !!a?.primary; c.mesh.outlineColor = C('#70f4d3'); c.mesh.outlineWidth = 0.025; }
      });
      controlsKey = key;
    },
    setChoices(types, labels) {
      interaction.reset();
      models.forEach((root, i) => {
        root.getChildMeshes().forEach((mesh) => mesh.dispose());
        object(types[i], root, i); names[i].set(labels[i]);
      });
    },
    setMouth,
    showMouth(show) {
      mouth.setEnabled(show);
      for (const l of [soundLabel, mouthCaption, mouthOrientation, partLabel]) l.mesh.setEnabled(show);
    },
    animateMouth(value) { animated = value; },
  };
}
