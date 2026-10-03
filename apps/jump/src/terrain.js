// Interlaken from swisstopo open data (scripts/prepare-jump-interlaken.py): five nested squares
// centred on the landing, from 256 km across down to 1 km, each sharper than the one around it.
// Every square has a hole where the next finer one sits; the prep script bends each square's
// edge onto its outer neighbour, so they meet without cracks.
import { Color3, Mesh, StandardMaterial, Texture, VertexData } from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;

async function load(path, kind) {
  const r = await fetch(`${BASE}terrain/${path}`);
  if (!r.ok) throw new Error(`Terrain file ${path} could not load.`);
  return kind === 'json' ? r.json() : r.arrayBuffer();
}

export async function buildTerrain(scene, onProgress) {
  const meta = await load('interlaken.json', 'json');
  const levels = meta.levels;
  let loaded = 0;
  const heights = await Promise.all(levels.map(async (level) => {
    const buffer = await load(level.heights);
    if (buffer.byteLength !== level.size ** 2 * 4) throw new Error(`Terrain ${level.name} is incomplete.`);
    onProgress?.(++loaded / levels.length);
    return new Float32Array(buffer);
  }));
  const anisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);
  /** Each square's aerial photo, by level name (the buildings' roofs use them too). */
  const textures = {};

  const meshes = levels.map((level, i) => {
    const inner = levels[i + 1];
    const mesh = gridMesh(scene, level, heights[i], inner ? inner.extent / 2 : 0);
    const texture = new Texture(`${BASE}terrain/${level.texture}`, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = anisotropy;
    textures[level.name] = texture;
    // The aerial photos already hold the day's light and shadow, so they're shown as they are.
    const mat = new StandardMaterial(`terrain-${level.name}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveTexture = texture;
    // Near hands and 100 km ridges in one depth buffer: logarithmic depth keeps both sharp.
    mat.useLogarithmicDepth = true;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    mesh.freezeWorldMatrix();
    return mesh;
  });

  /** Height above the landing (m) of the ground at local east/north, from the finest square that covers it. */
  function groundAt(x, z) {
    for (let i = levels.length - 1; i >= 0; i--) {
      const { extent, size } = levels[i];
      if (Math.abs(x) > extent / 2 || Math.abs(z) > extent / 2) continue;
      const u = (x / extent + 0.5) * (size - 1);
      const v = (z / extent + 0.5) * (size - 1);
      const a = Math.min(size - 2, Math.floor(u));
      const b = Math.min(size - 2, Math.floor(v));
      const tu = u - a;
      const tv = v - b;
      const h = (r, c) => heights[i][r * size + c];
      return (h(b, a) * (1 - tu) + h(b, a + 1) * tu) * (1 - tv) + (h(b + 1, a) * (1 - tu) + h(b + 1, a + 1) * tu) * tv;
    }
    return 0;
  }

  return { meshes, groundAt, meta, textures };
}

/** A size x size grid of heights (rows south to north), without the cells inside `hole` (half-width, m). */
function gridMesh(scene, level, heights, hole) {
  const { extent, size } = level;
  const n = size - 1;
  const positions = new Float32Array(size * size * 3);
  const uvs = new Float32Array(size * size * 2);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const k = row * size + col;
      positions[k * 3] = (col / n - 0.5) * extent;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = (row / n - 0.5) * extent;
      // The texture has north at the top, and KTX2 textures aren't flipped on upload.
      uvs[k * 2] = col / n;
      uvs[k * 2 + 1] = 1 - row / n;
    }
  }
  const indices = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = ((col + 0.5) / n - 0.5) * extent;
      const z = ((row + 0.5) / n - 0.5) * extent;
      if (Math.abs(x) < hole && Math.abs(z) < hole) continue;
      const a = row * size + col;
      const b = a + 1;
      const c = a + size;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const index = new Uint32Array(indices);
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, index, normals);
  // Face the sky whatever winding this engine treats as front (the corner vertex is never in the hole).
  if (normals[1] < 0) flip(index, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = index;
  data.normals = normals;
  data.uvs = uvs;
  const mesh = new Mesh(`terrain-${level.name}`, scene);
  data.applyToMesh(mesh);
  return mesh;
}

function flip(index, normals) {
  for (let i = 0; i < index.length; i += 3) {
    const t = index[i + 1];
    index[i + 1] = index[i + 2];
    index[i + 2] = t;
  }
  for (let i = 0; i < normals.length; i++) normals[i] = -normals[i];
}
