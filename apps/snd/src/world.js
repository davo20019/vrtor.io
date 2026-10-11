import {
  Scene, Color3, Color4, Vector3, Mesh, MeshBuilder, StandardMaterial,
  HemisphericLight, PointLight, TransformNode, DynamicTexture, PointerEventTypes,
} from '@babylonjs/core';

export const V = (x, y, z) => new Vector3(x, y, z);
const C = (hex) => Color3.FromHexString(hex);

export function buildWorld(engine, onChoose) {
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

  const stands = [], models = [], names = [];
  for (let side = 0; side < 2; side++) {
    const x = side ? 1.15 : -1.15;
    const stand = MeshBuilder.CreateCylinder(`choice ${side + 1} plinth`, { diameter: 1.45, height: 0.75, tessellation: 32 }, scene);
    stand.position.set(x, 0.375, 0.65); stand.material = mats.ink; stand.metadata = { side }; stands.push(stand);
    const rim = MeshBuilder.CreateTorus('choice rim', { diameter: 1.38, thickness: 0.035, tessellation: 40 }, scene);
    rim.position.set(x, 0.76, 0.65); rim.material = side ? mats.coral : mats.teal; rim.isPickable = false;
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
  const mouth = new TransformNode('schematic mouth', scene); mouth.position.set(2.95, 1.95, 3.1);
  sphere('mouth interior', [1.7, 1.2, 0.16], V(0, 0, 0.12), mats.ink, mouth);
  const palatePoints = [V(-0.67, 0, 0), V(-0.53, 0.37, 0), V(-0.1, 0.49, 0), V(0.4, 0.35, 0), V(0.68, 0.14, 0)];
  const palate = MeshBuilder.CreateTube('palate', { path: palatePoints, radius: 0.045, tessellation: 12 }, scene); palate.parent = mouth; palate.material = mats.white; palate.isPickable = false;
  const upperTeeth = box('upper front teeth', [0.09, 0.21, 0.16], V(0.59, 0.14, -0.03), mats.white, mouth);
  const lowerTeeth = box('lower front teeth', [0.09, 0.14, 0.16], V(0.59, -0.29, -0.03), mats.white, mouth);
  const upperLip = sphere('upper lip', [0.2, 0.13, 0.23], V(0.74, 0.2, 0), mats.coral, mouth);
  const lowerLip = sphere('lower lip', [0.2, 0.13, 0.23], V(0.74, -0.32, 0), mats.coral, mouth);
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
  const mouthCaption = label('mouth caption', 'MOUTH POSITION · SIDE VIEW', V(2.95, 2.78, 3), 2, 0.24, '#70f4d3');
  const mouthOrientation = label('mouth orientation', 'THROAT ←     → LIPS', V(2.95, 1.23, 3), 1.9, 0.2);
  const soundLabel = label('mouth sound', '/ɪ/', V(2.95, 1, 3), 0.8, 0.32);
  const particles = Array.from({ length: 7 }, () => sphere('airflow', [0.035, 0.035, 0.035], V(0, 0, 0), mats.rim, mouth));
  let mouthKey = 'ih', animated = true, elapsed = 0;
  function setMouth(key, symbol) {
    mouthKey = paths[key] ? key : 'uh';
    tongue = MeshBuilder.CreateTube('tongue', { path: pathVectors(mouthKey), radius: 0.07, instance: tongue }, scene);
    lowerLip.position.y = mouthKey === 'v' ? 0.02 : mouthKey === 'b' ? 0.12 : ['ae', 'uh'].includes(mouthKey) ? -0.41 : -0.23;
    lowerTeeth.position.y = ['ae', 'uh'].includes(mouthKey) ? -0.4 : -0.26;
    upperLip.position.y = mouthKey === 'b' ? 0.22 : 0.2;
    soundLabel.set(`/${symbol}/`);
  }
  scene.onBeforeRenderObservable.add(() => {
    elapsed += engine.getDeltaTime() / 1000;
    models.forEach((root, i) => { root.rotation.y = 0.14 * Math.sin(elapsed * 0.6 + i); });
    for (let i = 0; i < particles.length; i++) {
      const t = ((elapsed * 0.4 + i / particles.length) % 1);
      particles[i].position.set(-0.53 + t * 1.55, -0.02, -0.2);
      particles[i].setEnabled(animated && mouthKey !== 'b');
    }
  });
  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP || !info.pickInfo?.hit) return;
    const side = info.pickInfo.pickedMesh.metadata?.side;
    if (side === 0 || side === 1) onChoose(side);
  });
  return {
    scene, floor,
    setChoices(types, labels) {
      models.forEach((root, i) => {
        root.getChildMeshes().forEach((mesh) => mesh.dispose());
        object(types[i], root, i); names[i].set(labels[i]);
      });
    },
    setMouth,
    showMouth(show) {
      mouth.setEnabled(show);
      for (const l of [soundLabel, mouthCaption, mouthOrientation]) l.mesh.setEnabled(show);
    },
    animateMouth(value) { animated = value; },
  };
}
