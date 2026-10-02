// Open 3D buildings around you: the z14 tiles of Overture footprints near where you are,
// built in a worker (buildingsWorker.js) and drawn one mesh per tile. Only below a few km:
// from higher up the satellite imagery already shows the city.
import * as THREE from 'three';

const Z = 14;
const SHOW_BELOW = 4000; // metres above the ground
const KEEP = 24; // built tiles kept around (the ones in view plus recent ones)

export function createBuildings(scene) {
  // Follows the tiles' frame (ReorientationPlugin), so it holds Earth-centred meshes.
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  scene.add(root);

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const worker = new Worker(new URL('./buildingsWorker.js', import.meta.url), { type: 'module' });
  const tiles = new Map(); // key → { mesh, state: 'loading' | 'ready' | 'empty', used }
  let pending = 0;

  worker.onmessage = ({ data }) => {
    pending--;
    const t = tiles.get(data.key);
    if (!t) return;
    if (data.error || !data.pos.length) {
      if (data.error) console.warn('buildings', data.key, data.error);
      t.state = 'empty';
      return;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.fromArray(data.center);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    t.mesh = mesh;
    t.state = 'ready';
  };

  function tileOf(lat, lon) {
    const n = 2 ** Z;
    const x = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
    return [x, y];
  }

  let tick = 0;
  return {
    root,
    get triangles() {
      let n = 0;
      for (const t of tiles.values()) if (t.mesh?.visible) n += t.mesh.geometry.attributes.position.count / 3;
      return n;
    },
    get loading() {
      return pending;
    },
    // lat/lon in radians of the spot under you, agl in metres.
    update(tilesGroup, lat, lon, agl) {
      root.matrix.copy(tilesGroup.matrixWorld);
      root.matrixWorldNeedsUpdate = true;
      root.visible = agl < SHOW_BELOW;
      if (!root.visible || ++tick % 15) return;

      // the 3×3 tiles around you near the street, just yours higher up (a z14 tile is
      // about 2.4 km across at the equator; Midtown's is 1.6 MB and 60k triangles)
      const [cx, cy] = tileOf(lat, lon);
      const r = agl < 600 ? 1 : 0;
      const wanted = [];
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) wanted.push([cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy)]);
      }
      wanted.sort((a, b) => a[2] - b[2]);
      const now = performance.now();
      const near = new Set();
      for (const [x, y] of wanted) {
        const key = `${x}/${y}`;
        near.add(key);
        let t = tiles.get(key);
        if (!t && pending < 3) {
          t = { mesh: null, state: 'loading', used: now };
          tiles.set(key, t);
          pending++;
          worker.postMessage({ key, x, y });
        }
        if (t) t.used = now;
      }
      for (const [key, t] of tiles) if (t.mesh) t.mesh.visible = near.has(key);

      // forget the least recently used tiles beyond KEEP
      if (tiles.size > KEEP) {
        const old = [...tiles].filter(([, t]) => t.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
        for (const [key, t] of old.slice(0, tiles.size - KEEP)) {
          if (t.mesh) {
            root.remove(t.mesh);
            t.mesh.geometry.dispose();
          }
          tiles.delete(key);
        }
      }
    },
  };
}
