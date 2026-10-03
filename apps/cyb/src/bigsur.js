// Highway 1 in Big Sur, from Bixby Creek Bridge south over Hurricane Point to the Little Sur, built
// from US open data by scripts/prepare-cyb-bigsur.py: three nested squares of ground under aerial
// photos (finest round the road), a 2 m strip of lidar ground either side of the road, the road
// itself with its lines painted on, and the Pacific.
import { Color3, DynamicTexture, ImageProcessingConfiguration, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, VertexData } from '@babylonjs/core';

const BASE = import.meta.env.BASE_URL;

async function load(path, kind) {
  const r = await fetch(`${BASE}bigsur/${path}`);
  if (!r.ok) throw new Error(`Big Sur file ${path} could not load.`);
  return kind === 'json' ? r.json() : r.arrayBuffer();
}

/**
 * A turn of the render loop, so the headset keeps drawing (and the card its progress) between heavy
 * steps. The scene's own frame, not requestAnimationFrame: the window's stops in an immersive session.
 */
const nextFrame = (scene) => new Promise((r) => scene.onAfterRenderObservable.addOnce(() => setTimeout(r, 0)));

/**
 * Downloads every Big Sur file (about 15 MB, most of it the aerial photos), reporting
 * onProgress({ loaded, total }) in bytes as they arrive. Separate from building, so it can start
 * before the ride is asked for.
 */
export async function fetchBigSur(onProgress) {
  const [meta, map] = await Promise.all([load('bigsur.json', 'json'), load('map.json', 'json')]);
  const files = [...meta.levels.flatMap((l) => [l.heights, l.texture]), meta.road.corridor.file];
  // All started together; each file's size from its header, or what has come so far if there's none.
  const responses = await Promise.all(files.map(async (f) => {
    const r = await fetch(`${BASE}bigsur/${f}`);
    if (!r.ok) throw new Error(`Big Sur file ${f} could not load.`);
    return r;
  }));
  const size = responses.map((r) => (r.headers.get('content-encoding') ? 0 : +r.headers.get('content-length') || 0));
  const got = files.map(() => 0);
  let last = 0;
  const report = () => {
    const now = performance.now();
    if (now - last < 100) return;
    last = now;
    const loaded = got.reduce((a, b) => a + b, 0);
    onProgress?.({ loaded, total: got.reduce((a, b, i) => a + Math.max(b, size[i]), 0) });
  };
  const bodies = await Promise.all(responses.map(async (r, i) => {
    if (!r.body) return r.arrayBuffer();
    const chunks = [];
    for (const reader = r.body.getReader(); ;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got[i] += value.byteLength;
      report();
    }
    const out = new Uint8Array(got[i]);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    return out.buffer;
  }));
  const total = got.reduce((a, b) => a + b, 0);
  onProgress?.({ loaded: total, total });
  return { meta, map, files: Object.fromEntries(files.map((f, i) => [f, bodies[i]])) };
}

/**
 * Builds the coast from fetchBigSur's files, hidden, and resolves once its photos are decoded and
 * its shaders compiled, so it shows complete the moment it's switched on. onStep(f) runs 0 to 1.
 */
export async function buildBigSur(scene, { meta, map, files }, onStep) {
  let steps = 0;
  const STEPS = meta.levels.length * 2 + 5;
  const step = async () => {
    onStep?.(Math.min(1, ++steps / STEPS));
    await nextFrame(scene);
  };
  const buffers = [...meta.levels.map((l) => l.heights), meta.road.corridor.file].map((f) => new Float32Array(files[f]));
  const root = new TransformNode('bigsur', scene);
  root.setEnabled(false);
  const anisotropy = Math.min(16, scene.getEngine().getCaps().maxAnisotropy || 1);
  // The photos are already as the eye saw them: the scene's ACES tone mapping would grey their
  // whites and flatten their contrast, so they skip it.
  const asPhotographed = new ImageProcessingConfiguration();
  asPhotographed.toneMappingEnabled = false;
  // Fine grain at the scale of grass and gravel, where a 60 cm photo pixel is all there is. It
  // averages out to nothing in the distance (its small mipmaps are flat grey).
  const grain = grainTexture(scene, anisotropy);
  await step();

  const textures = {};
  const decoded = [];
  const photoMaterial = (level) => {
    let onLoad, onError;
    decoded.push(new Promise((resolve, reject) => ((onLoad = resolve), (onError = () => reject(new Error(`Big Sur photo ${level.texture} could not load.`))))));
    const texture = new Texture(`${BASE}bigsur/${level.texture}`, scene, {
      noMipmap: false,
      invertY: false,
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
      buffer: files[level.texture],
      forcedExtension: '.ktx2',
      onLoad,
      onError,
    });
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = anisotropy;
    textures[level.name] = texture;
    // The aerial photos already hold the day's light and shade, so they're shown as they are.
    const mat = new StandardMaterial(`bigsur-${level.name}`, scene);
    mat.disableLighting = true;
    mat.specularColor = Color3.Black();
    // Unlit: a white emissive passes the photo (as diffuse, so the grain below can work on it) straight through.
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = Color3.White();
    mat.diffuseTexture = texture;
    mat.imageProcessingConfiguration = asPhotographed;
    if (level.name === 'l0') {
      // One tile of grain every 3 m, over l0's photo (which the road's corridor shares).
      mat.detailMap.isEnabled = true;
      mat.detailMap.texture = grain;
      mat.detailMap.diffuseBlendLevel = 0.4;
      mat.detailMap.normalBlendLevel = 0;
      grain.uScale = (level.x1 - level.x0) / 3;
      grain.vScale = (level.z1 - level.z0) / 3;
    }
    return mat;
  };

  const materials = [];
  for (const [i, level] of meta.levels.entries()) {
    const material = photoMaterial(level);
    materials.push(material);
    for (const tile of gridTiles(scene, level, buffers[i], meta.levels[i - 1])) {
      for (const mesh of tile) {
        mesh.material = material;
        mesh.parent = root;
        mesh.isPickable = false;
        mesh.freezeWorldMatrix();
      }
    }
    await step();
    await step();
  }

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
  for (const corridor of corridorMeshes(scene, road.corridor, buffers[meta.levels.length], { px, pz, rx, rz }, l0)) {
    corridor.material = materials[0];
    corridor.parent = root;
    corridor.isPickable = false;
    corridor.freezeWorldMatrix();
  }
  await step();

  const asphalt = roadMesh(scene, { px, py, pz, rx, rz }, road.paveHalfWidth, anisotropy);
  asphalt.parent = root;
  asphalt.receiveShadows = true;
  asphalt.freezeWorldMatrix();
  await step();

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

  await Promise.all(decoded);
  await step();
  // Compiled now, while the showroom is still in view: otherwise it happens on the first frame of
  // the coast, a long freeze behind the headset's fade. The scene keeps its fog on (thin to nothing
  // in the showroom) so these are the shaders the coast will draw with.
  // One mesh per material is enough: the ground's tiles all draw with the same few shaders.
  const byMaterial = new Map();
  for (const m of root.getChildMeshes()) if (m.material && !byMaterial.has(m.material)) byMaterial.set(m.material, m);
  await Promise.all([...byMaterial].map(([mat, m]) => mat.forceCompilationAsync(m)));
  await step();
  return { root, meta, road: { px, py, pz, rx, rz, n, step: road.step, laneWidth: road.laneWidth, map }, ground: [asphalt] };
}

/** Cells along a ground tile's side: about 320 m of l0, 2.5 km of l1, 20 km of l2. */
const TILE = 64;
/** A tile drops to every 2nd and then every 4th point this many tile-widths away. */
const LOD_TILES = [2.2, 5];

/**
 * A level's grid (rows south to north), without the cells inside the next finer level, cut into tiles
 * so the ones out of view aren't drawn, each with coarser copies for the distance. Returns
 * [full, ...coarser] per tile. Skirts hang down round each tile's edge, hiding the cracks where a
 * coarse tile meets a finer one.
 */
function gridTiles(scene, level, heights, inner) {
  const { nx, nz, x0, z0, x1, z1, step } = level;
  const insideInner = (x, z) => inner && x > inner.x0 && x < inner.x1 && z > inner.z0 && z < inner.z1;
  const tiles = [];
  for (let r0 = 0; r0 < nz - 1; r0 += TILE) {
    for (let c0 = 0; c0 < nx - 1; c0 += TILE) {
      const r1 = Math.min(nz - 1, r0 + TILE), c1 = Math.min(nx - 1, c0 + TILE);
      const tx0 = x0 + c0 * step, tx1 = x0 + c1 * step, tz0 = z0 + r0 * step, tz1 = z0 + r1 * step;
      // Wholly inside the finer level: nothing to draw.
      if (inner && tx0 >= inner.x0 && tx1 <= inner.x1 && tz0 >= inner.z0 && tz1 <= inner.z1) continue;
      // A tile on the finer level's edge keeps every point, so its cut-out matches exactly.
      const edge = inner && tx0 < inner.x1 && tx1 > inner.x0 && tz0 < inner.z1 && tz1 > inner.z0;
      const strides = edge ? [1] : [1, 2, 4];
      const meshes = strides.map((stride) => {
        const pick = (a, b) => {
          const out = [];
          for (let i = a; i < b; i += stride) out.push(i);
          out.push(b);
          return out;
        };
        const cols = pick(c0, c1), rows = pick(r0, r1);
        const w = cols.length, h = rows.length;
        const ring = 2 * (w + h);
        const positions = new Float32Array((w * h + 2 * ring) * 3);
        const uvs = new Float32Array((w * h + 2 * ring) * 2);
        let v = 0;
        const put = (col, row, drop = 0) => {
          const x = x0 + col * step, z = z0 + row * step;
          positions[v * 3] = x;
          positions[v * 3 + 1] = heights[row * nx + col] - drop;
          positions[v * 3 + 2] = z;
          // North at the top of the texture, and KTX2 textures aren't flipped on upload.
          uvs[v * 2] = (x - x0) / (x1 - x0);
          uvs[v * 2 + 1] = (z1 - z) / (z1 - z0);
          return v++;
        };
        for (const row of rows) for (const col of cols) put(col, row);
        const indices = [];
        for (let j = 0; j < h - 1; j++) {
          for (let i = 0; i < w - 1; i++) {
            const cx = x0 + ((cols[i] + cols[i + 1]) / 2) * step, cz = z0 + ((rows[j] + rows[j + 1]) / 2) * step;
            if (insideInner(cx, cz)) continue;
            const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
            indices.push(a, c, b, b, c, d);
          }
        }
        if (stride > 1 || !edge) {
          // Round the edge: each point, and a copy hanging 6 cells below, both faces. The worst
          // crack measured between neighbours is under 4 cells (20 m on l0, against 4x coarser).
          const drop = 6 * step * stride;
          const around = [
            ...cols.map((c) => [c, rows[0]]), ...rows.slice(1).map((r) => [cols[w - 1], r]),
            ...cols.slice(0, -1).reverse().map((c) => [c, rows[h - 1]]), ...rows.slice(1, -1).reverse().map((r) => [cols[0], r]),
          ];
          around.push(around[0]);
          let prev = null;
          for (const [col, row] of around) {
            const top = put(col, row), bottom = put(col, row, drop);
            if (prev) indices.push(prev[0], prev[1], top, top, prev[1], bottom, prev[0], top, prev[1], top, bottom, prev[1]);
            prev = [top, bottom];
          }
        }
        return finish(scene, `bigsur-${level.name}-${c0}-${r0}-${stride}`, positions.subarray(0, v * 3), new Uint32Array(indices), uvs.subarray(0, v * 2));
      });
      const size = TILE * step;
      meshes.slice(1).forEach((m, k) => meshes[0].addLODLevel(LOD_TILES[k] * size, m));
      tiles.push(meshes);
    }
  }
  return tiles;
}

/** The strip of lidar ground either side of the road, on l0's photo, in lengths of road so the ones out of view aren't drawn. */
function corridorMeshes(scene, info, heights, { px, pz, rx, rz }, l0) {
  const rows = info.rows, cols = info.offsets.length;
  const CHUNK = 128;
  const meshes = [];
  for (let i0 = 0; i0 < rows - 1; i0 += CHUNK) {
    const i1 = Math.min(rows - 1, i0 + CHUNK);
    const n = i1 - i0 + 1;
    const positions = new Float32Array(n * cols * 3);
    const uvs = new Float32Array(n * cols * 2);
    for (let i = i0; i <= i1; i++) {
      for (let j = 0; j < cols; j++) {
        const k = (i - i0) * cols + j, d = info.offsets[j];
        const x = px[i] + rx[i] * d, z = pz[i] + rz[i] * d;
        positions[k * 3] = x;
        positions[k * 3 + 1] = heights[i * cols + j];
        positions[k * 3 + 2] = z;
        uvs[k * 2] = (x - l0.x0) / (l0.x1 - l0.x0);
        uvs[k * 2 + 1] = (l0.z1 - z) / (l0.z1 - l0.z0);
      }
    }
    const indices = new Uint32Array((n - 1) * (cols - 1) * 6);
    let o = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        indices.set([a, c, b, b, c, d], o);
        o += 6;
      }
    }
    meshes.push(finish(scene, `bigsur-corridor-${i0}`, positions, indices, uvs));
  }
  return meshes;
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

  const W = 1024, H = 1024;
  const tex = new DynamicTexture('asphalt', { width: W, height: H }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = '#4a4a48';
  ctx.fillRect(0, 0, W, H);
  // Worn and fresher patches, a metre or two across, tiling with the 8 m repeat.
  const patches = noiseCanvas(W, H, [[8, 0.6], [16, 0.4]]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(patches, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Aggregate, 1 to 2 cm stones, light and dark, so it reads as asphalt up close.
  for (let i = 0; i < 60000; i++) {
    const v = Math.random() < 0.5 ? 40 + Math.floor(Math.random() * 25) : 85 + Math.floor(Math.random() * 60);
    const r = 0.8 + Math.random() * 1.4;
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = `rgb(${v},${v},${v - 3})`;
    // Drawn again across the top and bottom edge, so the 8 m repeat has no seam.
    for (const dy of [0, -H, H]) ctx.fillRect(x, y + dy, r, r);
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
  // The paint is worn through to the stones in places.
  ctx.fillStyle = 'rgba(74,74,72,0.55)';
  for (const d of [-0.1, 0.1, -3.65, 3.65]) {
    for (let i = 0; i < 700; i++) {
      const x = (d + half) / mpx + (Math.random() - 0.5) * 0.12 / mpx;
      ctx.fillRect(x, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  // A darker band where tyres run, either side.
  ctx.fillStyle = 'rgba(20,20,20,0.12)';
  for (const d of [-2.7, -0.9, 0.9, 2.7]) ctx.fillRect((d + half) / mpx - 0.35 / mpx, 0, 0.7 / mpx, H);
  tex.update();
  tex.anisotropicFilteringLevel = anisotropy;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  // A DynamicTexture clamps both ways unless told: without this every metre past the first 8 shows
  // the texture's last row, stretched into streaks.
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  const mat = new StandardMaterial('asphalt', scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.06, 0.06, 0.06);
  mesh.material = mat;
  return mesh;
}

/**
 * Tiling value noise on a canvas, grey around the middle: `octaves` are [cells across, weight].
 * Cells wrap at the edges, so the canvas repeats without a seam.
 */
function noiseCanvas(w, h, octaves) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const sum = new Float32Array(w * h);
  const fade = (t) => t * t * (3 - 2 * t);
  for (const [cells, weight] of octaves) {
    const grid = Float32Array.from({ length: cells * cells }, () => Math.random() * 2 - 1);
    const at = (i, j) => grid[(j % cells) * cells + (i % cells)];
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * cells, j = Math.floor(gy), ty = fade(gy - j);
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * cells, i = Math.floor(gx), tx = fade(gx - i);
        const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
        const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
        sum[y * w + x] += (top + (bottom - top) * ty) * weight;
      }
    }
  }
  for (let k = 0; k < w * h; k++) {
    const v = Math.max(0, Math.min(255, 128 + sum[k] * 90));
    img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The ground's close-up grain: clumps and tufts of 10 cm down to a centimetre (nothing larger, which would show the 3 m repeat), in the red channel. */
function grainTexture(scene, anisotropy) {
  const size = 512;
  const tex = new DynamicTexture('bigsur-grain', { width: size, height: size }, scene, true);
  tex.getContext().drawImage(noiseCanvas(size, size, [[32, 0.3], [64, 0.3], [128, 0.25], [256, 0.2]]), 0, 0);
  tex.update(false);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = anisotropy;
  return tex;
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
