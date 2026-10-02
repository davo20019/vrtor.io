// Turns one z14 tile of Overture's open building footprints into a 3D mesh, off the main
// thread so the headset never stutters while a neighbourhood loads.
//
// Footprints come from Overture's PMTiles (ODbL, mostly OpenStreetMap); each building
// stands on the ground height read from the same Terrarium tile the terrain uses.
// Positions are Earth-centred (ECEF) minus the tile's centre, so the Float32 vertices stay
// precise to the millimetre; the main thread places the mesh at that centre.
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import earcut from 'earcut';

const BUILDINGS = 'https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-09-23.1/buildings.pmtiles';
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const Z = 14;
const SINK = 4; // walls go this far below the sampled ground, hiding small terrain mismatches

const pmtiles = new PMTiles(BUILDINGS);

// WGS84, the same ellipsoid 3d-tiles-renderer uses.
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
function ecef(lat, lon, h, out, o) {
  const sl = Math.sin(lat);
  const cl = Math.cos(lat);
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  out[o] = (n + h) * cl * Math.cos(lon);
  out[o + 1] = (n + h) * cl * Math.sin(lon);
  out[o + 2] = (n * (1 - E2) + h) * sl;
}

async function groundGrid(x, y) {
  try {
    const res = await fetch(`${TERRARIUM}/${Z}/${x}/${y}.png`);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const { data, width } = g.getImageData(0, 0, bmp.width, bmp.height);
    return (u, v) => {
      const px = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const py = Math.min(width - 1, Math.max(0, Math.floor(v * width)));
      const i = (py * width + px) * 4;
      return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    };
  } catch {
    return null;
  }
}

// Mapped colors (OSM building:colour) are often loud ("black", "red"): keep the hue but
// pull it halfway toward stone, so a tagged building reads as tinted, not painted.
const STONE = [0.78, 0.75, 0.7];
function parseColor(s) {
  if (typeof s !== 'string') return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  return c.map((v, i) => v * 0.5 + STONE[i] * 0.5);
}

// Warm stone and concrete tones; picked per building so a street isn't one flat grey.
const PALETTE = [
  [0.80, 0.77, 0.71], [0.74, 0.71, 0.66], [0.85, 0.82, 0.76], [0.70, 0.68, 0.66],
  [0.78, 0.72, 0.64], [0.66, 0.64, 0.62], [0.82, 0.79, 0.74], [0.72, 0.66, 0.60],
];
const GLASS = [0.55, 0.64, 0.72];
function hashPick(id, list) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  }
  return sum;
}

// Vector tile rings → polygons [outer, ...holes] (outer rings wind the opposite way to holes).
function classifyRings(rings) {
  const polys = [];
  let poly = null;
  let ccw;
  for (const ring of rings) {
    const area = signedArea(ring);
    if (area === 0) continue;
    if (ccw === undefined) ccw = area < 0;
    if (ccw === area < 0) {
      poly = [ring];
      polys.push(poly);
    } else if (poly) {
      poly.push(ring);
    }
  }
  return polys;
}

function height(p) {
  if (p.height > 0) return p.height;
  if (p.num_floors > 0) return p.num_floors * 3.2 + 1;
  return 7;
}

async function build(x, y) {
  const [tile, ground] = await Promise.all([pmtiles.getZxy(Z, x, y), groundGrid(x, y)]);
  const n = 2 ** Z;
  const lonOf = (u) => ((x + u) / n) * 2 * Math.PI - Math.PI;
  const latOf = (v) => Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + v)) / n)));

  // Tile centre, the origin of every vertex below.
  const center = new Float64Array(3);
  ecef(latOf(0.5), lonOf(0.5), 0, center, 0);
  const up = [center[0], center[1], center[2]];
  const ul = Math.hypot(...up);
  up[0] /= ul; up[1] /= ul; up[2] /= ul;

  // A fixed sun direction for baked shading: east-southeast, so streets read without lights.
  const east = [-Math.sin(lonOf(0.5)), Math.cos(lonOf(0.5)), 0];

  const pos = [];
  const col = [];
  if (!tile) return { center, pos: new Float32Array(), col: new Float32Array() };
  const vt = new VectorTile(new Pbf(new Uint8Array(tile.data)));
  const tmp = new Float64Array(3);
  const a = new Float64Array(3);
  const b = new Float64Array(3);
  const c = new Float64Array(3);
  const d = new Float64Array(3);

  const push = (p, color) => {
    pos.push(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
    col.push(color[0], color[1], color[2]);
  };

  const addFeature = (f) => {
    const p = f.properties;
    if (p.is_underground) return;
    const extent = f.extent;
    const polys = classifyRings(f.loadGeometry());
    if (!polys.length) return;
    const outer0 = polys[0][0];
    // Ground under the building: lowest of a few footprint corners, so slopes don't leave gaps.
    let base = Infinity;
    if (ground) {
      const step = Math.max(1, Math.floor(outer0.length / 4));
      for (let i = 0; i < outer0.length; i += step) {
        base = Math.min(base, ground(outer0[i].x / extent, outer0[i].y / extent));
      }
    }
    if (!Number.isFinite(base)) base = 0;
    const minH = p.min_height > 0 ? p.min_height : 0;
    const bottom = base + (minH > 0 ? minH : -SINK);
    const top = base + Math.max(height(p), minH + 1);
    const id = String(p.id ?? p.building_id ?? '');
    const wall = parseColor(p.facade_color) ?? (p.facade_material === 'glass' ? GLASS : hashPick(id, PALETTE));
    const roofBase = parseColor(p.roof_color) ?? wall.map((v) => Math.min(1, v * 0.82 + 0.06));

    for (const poly of polys) {
      // Walls: one quad per footprint edge, shaded by how squarely it faces the sun.
      for (const ring of poly) {
        for (let i = 0; i < ring.length - 1; i++) {
          const p0 = ring[i];
          const p1 = ring[i + 1];
          const la0 = latOf(p0.y / extent), lo0 = lonOf(p0.x / extent);
          const la1 = latOf(p1.y / extent), lo1 = lonOf(p1.x / extent);
          ecef(la0, lo0, bottom, a, 0);
          ecef(la1, lo1, bottom, b, 0);
          ecef(la1, lo1, top, c, 0);
          ecef(la0, lo0, top, d, 0);
          // wall normal (either side) = (b - a) × up
          const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
          const nx = ey * up[2] - ez * up[1];
          const ny = ez * up[0] - ex * up[2];
          const nz = ex * up[1] - ey * up[0];
          const nl = Math.hypot(nx, ny, nz) || 1;
          const shade = 0.62 + 0.3 * Math.abs((nx * east[0] + ny * east[1] + nz * east[2]) / nl);
          const wc = [wall[0] * shade, wall[1] * shade, wall[2] * shade];
          push(a, wc); push(b, wc); push(c, wc);
          push(a, wc); push(c, wc); push(d, wc);
        }
      }
      // Roof: triangulate the footprint (holes included) in tile coordinates.
      const flat = [];
      const holes = [];
      for (const ring of poly) {
        if (flat.length) holes.push(flat.length / 2);
        for (let i = 0; i < ring.length - 1; i++) flat.push(ring[i].x, ring[i].y);
      }
      const tris = earcut(flat, holes);
      for (const k of tris) {
        ecef(latOf(flat[k * 2 + 1] / extent), lonOf(flat[k * 2] / extent), top, tmp, 0);
        push(tmp, roofBase);
      }
    }
  };

  // A building drawn as parts (towers, setbacks) is drawn only through its parts.
  const parts = vt.layers.building_part;
  const buildings = vt.layers.building;
  if (buildings) {
    for (let i = 0; i < buildings.length; i++) {
      const f = buildings.feature(i);
      if (f.properties.has_parts && parts) continue;
      addFeature(f);
    }
  }
  if (parts) for (let i = 0; i < parts.length; i++) addFeature(parts.feature(i));

  return { center, pos: new Float32Array(pos), col: new Float32Array(col) };
}

self.onmessage = async ({ data: { key, x, y } }) => {
  try {
    const r = await build(x, y);
    self.postMessage({ key, ...r }, [r.pos.buffer, r.col.buffer]);
  } catch (err) {
    self.postMessage({ key, error: String(err) });
  }
};
