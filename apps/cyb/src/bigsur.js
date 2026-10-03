// Highway 1 in Big Sur, from Bixby Creek Bridge south over Hurricane Point to the Little Sur, built
// from US open data by scripts/prepare-cyb-bigsur.py: three nested squares of ground under aerial
// photos (finest round the road), a 2 m strip of lidar ground either side of the road, the road
// itself with its lines painted on, and the Pacific.
import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, VertexData } from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;

async function load(path, kind) {
  const r = await fetch(`${BASE}bigsur/${path}`);
  if (!r.ok) throw new Error(`Big Sur file ${path} could not load.`);
  return kind === 'json' ? r.json() : r.arrayBuffer();
}

export async function buildBigSur(scene, onProgress) {
  const [meta, map] = await Promise.all([load('bigsur.json', 'json'), load('map.json', 'json')]);
  const files = [...meta.levels.map((l) => l.heights), meta.road.corridor.file];
  let loaded = 0;
  const buffers = await Promise.all(files.map(async (f) => {
    const b = await load(f);
    onProgress?.(++loaded / files.length);
    return new Float32Array(b);
  }));
  const root = new TransformNode('bigsur', scene);
  const anisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);

  const textures = {};
  const photoMaterial = (level) => {
    const texture = new Texture(`${BASE}bigsur/${level.texture}`, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = anisotropy;
    textures[level.name] = texture;
    // The aerial photos already hold the day's light and shade, so they're shown as they are.
    const mat = new StandardMaterial(`bigsur-${level.name}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveTexture = texture;
    return mat;
  };

  const meshes = meta.levels.map((level, i) => {
    const inner = meta.levels[i - 1];
    const mesh = gridMesh(scene, level, buffers[i], inner);
    mesh.material = photoMaterial(level);
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    return mesh;
  });

  const road = meta.road;
  const n = road.points.length;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  road.points.forEach(([x, y, z], i) => { px[i] = x; py[i] = y; pz[i] = z; });
  // Unit normal to the right of travel at every point.
  const rx = new Float32Array(n), rz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = px[b] - px[a], tz = pz[b] - pz[a], l = Math.hypot(tx, tz);
    rx[i] = tz / l;
    rz[i] = -tx / l;
  }

  const l0 = meta.levels[0];
  const corridor = corridorMesh(scene, road.corridor, buffers[meta.levels.length], { px, pz, rx, rz }, l0);
  corridor.material = meshes[0].material;
  corridor.parent = root;
  corridor.isPickable = false;
  corridor.freezeWorldMatrix();

  const asphalt = roadMesh(scene, { px, py, pz, rx, rz }, road.paveHalfWidth, anisotropy);
  asphalt.parent = root;
  asphalt.receiveShadows = true;
  asphalt.freezeWorldMatrix();

  const sea = MeshBuilder.CreateDisc('sea', { radius: 150000, tessellation: 96 }, scene);
  sea.rotation.x = Math.PI / 2;
  sea.position.y = meta.seaLevel;
  const seaMat = new StandardMaterial('sea', scene);
  seaMat.diffuseColor = Color3.FromHexString('#1c4a63');
  seaMat.emissiveColor = Color3.FromHexString('#0d2a3a');
  seaMat.specularColor = new Color3(0.55, 0.55, 0.5);
  seaMat.specularPower = 180;
  // See-through enough that the photographed surf and kelp beds near the shore still show.
  seaMat.alpha = 0.72;
  seaMat.backFaceCulling = false;
  sea.material = seaMat;
  sea.parent = root;
  sea.isPickable = false;

  root.setEnabled(false);
  return { root, meta, road: { px, py, pz, rx, rz, n, step: road.step, laneWidth: road.laneWidth, map }, ground: [asphalt] };
}

/** A level's grid (rows south to north), without the cells inside the next finer level. */
function gridMesh(scene, level, heights, inner) {
  const { nx, nz, x0, z0, x1, z1, step } = level;
  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  for (let row = 0; row < nz; row++) {
    for (let col = 0; col < nx; col++) {
      const k = row * nx + col;
      const x = x0 + col * step, z = z0 + row * step;
      positions[k * 3] = x;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = z;
      // North at the top of the texture, and KTX2 textures aren't flipped on upload.
      uvs[k * 2] = (x - x0) / (x1 - x0);
      uvs[k * 2 + 1] = (z1 - z) / (z1 - z0);
    }
  }
  const indices = [];
  for (let row = 0; row < nz - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const cx = x0 + (col + 0.5) * step, cz = z0 + (row + 0.5) * step;
      if (inner && cx > inner.x0 && cx < inner.x1 && cz > inner.z0 && cz < inner.z1) continue;
      const a = row * nx + col, b = a + 1, c = a + nx, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return finish(scene, `bigsur-${level.name}`, positions, new Uint32Array(indices), uvs);
}

/** The strip of lidar ground either side of the road, on l0's photo. */
function corridorMesh(scene, info, heights, { px, pz, rx, rz }, l0) {
  const rows = info.rows, cols = info.offsets.length;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j, d = info.offsets[j];
      const x = px[i] + rx[i] * d, z = pz[i] + rz[i] * d;
      positions[k * 3] = x;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = z;
      uvs[k * 2] = (x - l0.x0) / (l0.x1 - l0.x0);
      uvs[k * 2 + 1] = (l0.z1 - z) / (l0.z1 - l0.z0);
    }
  }
  const indices = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let o = 0;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      indices.set([a, c, b, b, c, d], o);
      o += 6;
    }
  }
  return finish(scene, 'bigsur-corridor', positions, indices, uvs);
}

/** Two lanes of asphalt: a solid double yellow line down the middle and white edge lines. */
function roadMesh(scene, { px, py, pz, rx, rz }, half, anisotropy) {
  const n = px.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  let along = 0;
  for (let i = 0; i < n; i++) {
    if (i) along += Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
    for (const [j, d] of [[0, -half], [1, half]]) {
      const k = i * 2 + j;
      positions[k * 3] = px[i] + rx[i] * d;
      positions[k * 3 + 1] = py[i];
      positions[k * 3 + 2] = pz[i] + rz[i] * d;
      uvs[k * 2] = j;
      uvs[k * 2 + 1] = along / 8;                      // the texture repeats every 8 m
    }
  }
  const indices = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.set([a, c, b, b, c, d], i * 6);
  }
  const mesh = finish(scene, 'bigsur-road', positions, indices, uvs);

  const W = 512, H = 512;
  const tex = new DynamicTexture('asphalt', { width: W, height: H }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = '#4a4a48';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {                     // aggregate, so it reads as asphalt
    const v = 55 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgb(${v},${v},${v - 2})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  const mpx = (2 * half) / W;                          // metres per pixel across
  const stripe = (d, w, color) => {
    ctx.fillStyle = color;
    ctx.fillRect((d + half) / mpx - w / mpx / 2, 0, w / mpx, H);
  };
  // US practice: 4-inch lines, a 4-inch gap between the yellow pair; edge lines at the lane's outer edge.
  stripe(-0.1, 0.1, '#d9a91c');
  stripe(0.1, 0.1, '#d9a91c');
  stripe(-3.65, 0.12, '#e8e6df');
  stripe(3.65, 0.12, '#e8e6df');
  // A darker band where tyres run, either side.
  ctx.fillStyle = 'rgba(20,20,20,0.12)';
  for (const d of [-2.7, -0.9, 0.9, 2.7]) ctx.fillRect((d + half) / mpx - 0.35 / mpx, 0, 0.7 / mpx, H);
  tex.update();
  tex.anisotropicFilteringLevel = anisotropy;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  const mat = new StandardMaterial('asphalt', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.06, 0.06, 0.06);
  mesh.material = mat;
  return mesh;
}

function finish(scene, name, positions, indices, uvs) {
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  // Face the sky whatever winding this engine treats as front.
  let up = 0;
  for (let i = 1; i < normals.length; i += 3) up += normals[i];
  if (up < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
    for (let i = 0; i < normals.length; i++) normals[i] = -normals[i];
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}
