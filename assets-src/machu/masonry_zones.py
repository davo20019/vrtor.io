"""Which walls of the connected citadel model are fine ashlar (apps/mpc/public/models/citadel-masonry.json).

The model is schematic and carries no building names, so its fine-masonry buildings are found by registering it
to OpenStreetMap's mapped ruins and then confirmed by their shape:
  1. Anchors: the Sacred Rock pad (north end), the Intihuatana stone on its terraced hill, the House of the Guardian
     pad (the model's highest stone, south) and the Torreón, the model's only curved building (27 wall directions,
     9.8 x 9.2 m; the CAST scan of the real one fits a 4.50 m radius). A similarity fit to OSM's named points gives
     rotation 18.7 deg, scale 1.04, residuals 10 to 25 m: the model is distorted at that scale.
  2. A thin-plate spline through the anchors carries OSM's other named buildings into the model; each is matched to
     the wall groups (connected vertical faces) standing there.
Fine ashlar on site: the Torreón and the Royal Residence beside it, the Sacred Plaza court (Principal Temple, Three
Windows, Priest's House, Sacristy) and the Intihuatana. The Water Mirrors room is not: its CAST scan shows rough
coursed masonry with mud joints. The Condor's walls are left rough; its fine work is mostly carved bedrock.

    python3 -I assets-src/machu/masonry_zones.py
Needs Blender on PATH (to read the Draco GLB). Downloads and the dump go to assets-src/machu/.cache.
"""
import json
import math
import pathlib
import subprocess
import tempfile
import urllib.parse
import urllib.request

import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / '.cache'
GLB = ROOT / 'apps/mpc/public/models/citadel.glb'
OUT = ROOT / 'apps/mpc/public/models/citadel-masonry.json'
UA = 'vrtor-machu-masonry/1.0 (hello@vrtor.io)'
BBOX = (-13.1660, -72.5475, -13.1610, -72.5420)
LAT0, LON0 = -13.1635, -72.5455

# Anchor: OSM name -> how the model's feature is found (Blender coordinates, metres, z up).
ANCHORS = {
    'Roca Sagrada': ('stone pad', 'site-stone-GDLM9', (26.3, 235.2)),
    'Intihuantana': ('carved stone', None, (-46.8, 100.6)),
    'Casa del Guardian': ('highest stone pad', 'site-stone-GDLM9', (11.5, -150.9)),
    'Templo del Sol': ('curved building', None, None),
}
# Building -> (OSM name it is matched to, masonry, search radius m, wall base z range in the model)
BUILDINGS = {
    'Torreón (Temple of the Sun)': ('Templo del Sol', 'coursed', 8, (41, 44)),
    'Royal Residence': ('Residencia Real / Casa del Inca', 'coursed', 16, (41, 44)),
    'Sacred Plaza court': ('Templo Principal', 'megalithic', 16, (66, 72)),
    'Intihuatana': ('Intihuantana', 'coursed', 3, (66, 69)),
}
# The Sacred Plaza's named points fall on open ground in the model (its distortion there is about 30 m); the court of
# four buildings at the foot of the Intihuatana hill, where the plaza is on site, is its match.
SACRED_PLAZA_MODEL = (-49.0, 72.0)


def cached(name, fetch):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        path.write_bytes(fetch())
    return path


def osm():
    q = f'[out:json][timeout:90];nwr({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});out geom tags;'
    req = lambda: urllib.request.urlopen(urllib.request.Request(
        'https://overpass.kumi.systems/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(),
        headers={'User-Agent': UA}), timeout=180).read()
    return json.loads(cached('osm.json', req).read_text())


def model_triangles():
    dump = CACHE / 'citadel_tris.npz'
    if not dump.exists():
        script = ("import bpy,sys,numpy as np\nsrc,out=sys.argv[sys.argv.index('--')+1:]\n"
                  "bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)\n"
                  "d={o.name:np.array([[tuple(o.matrix_world@o.data.vertices[i].co) for i in p.vertices[:3]] "
                  "for p in o.data.polygons],np.float32) for o in bpy.context.scene.objects if o.type=='MESH'}\n"
                  "np.savez(out,**d)\n")
        with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False) as f:
            f.write(script)
        subprocess.run(['blender', '--factory-startup', '-b', '--python', f.name, '--', str(GLB), str(dump)],
                       check=True, capture_output=True)
    d = np.load(dump)
    return np.concatenate([d[k] for k in d])


def wall_groups(T):
    """Connected steep faces (shared corners), with their bounds."""
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    # Steep faces count as wall, as in the scene (apps/mpc/src/masonry.js): gable slopes belong to their walls.
    steep = np.abs(n[:, 2]) < .85
    V, N = T[steep], n[steep]
    keys, pairs = {}, []
    for i, tri in enumerate(V):
        for p in tri:
            pairs.append((i, keys.setdefault(tuple(np.round(p, 2)), len(keys))))
    ii = np.array(pairs)
    size = len(V) + len(keys)
    A = coo_matrix((np.ones(len(ii)), (ii[:, 0], ii[:, 1] + len(V))), shape=(size, size))
    _, lab = connected_components(A, directed=False)
    lab = lab[:len(V)]
    groups = []
    for c in np.unique(lab):
        m = lab == c
        pts = V[m].reshape(-1, 3)
        ang = np.degrees(np.arctan2(N[m, 1], N[m, 0])) % 180
        groups.append(dict(lo=pts.min(0), hi=pts.max(0), directions=int((np.histogram(ang, 36, (0, 180))[0] > 0).sum())))
    return groups


def main():
    data = osm()
    R = 6371008.8
    en = lambda la, lo: np.array([(lo - LON0) * math.pi / 180 * R * math.cos(LAT0 * math.pi / 180), (la - LAT0) * math.pi / 180 * R])
    named = {e['tags']['name']: en(e['lat'], e['lon']) for e in data['elements'] if e['type'] == 'node' and 'name' in e.get('tags', {})}
    groups = wall_groups(model_triangles())
    curved = [g for g in groups if g['directions'] >= 10 and (g['hi'] - g['lo'])[:2].max() < 40]
    assert len(curved) == 1, f'expected one curved building, found {len(curved)}'
    torreon = (curved[0]['lo'][:2] + curved[0]['hi'][:2]) / 2
    print('curved building', torreon.round(1), 'size', (curved[0]['hi'] - curved[0]['lo'])[:2].round(1))
    M = np.array([torreon if k == 'Templo del Sol' else a[2] for k, a in ANCHORS.items()])
    O = np.array([named[k] for k in ANCHORS])
    osm_to_model = RBFInterpolator(O, M, kernel='thin_plate_spline', degree=1)
    zones = []
    for name, (osm_name, kind, radius, zr) in BUILDINGS.items():
        at = np.array(SACRED_PLAZA_MODEL) if name == 'Sacred Plaza court' else osm_to_model(named[osm_name][None])[0]
        found = [g for g in groups if np.linalg.norm((g['lo'][:2] + g['hi'][:2]) / 2 - at) < radius
                 and zr[0] <= g['lo'][2] <= zr[1] and (g['hi'] - g['lo'])[:2].max() < 40]
        assert found, name
        lo = np.min([g['lo'] for g in found], 0) - .3
        hi = np.max([g['hi'] for g in found], 0) + .3
        # Babylon's frame: x = -Blender x, z = -Blender y, y = Blender z.
        zones.append({'name': name, 'masonry': kind, 'walls': len(found),
                      'box': [round(float(v), 2) for v in (-hi[0], lo[2], -hi[1], -lo[0], hi[2], -lo[1])]})
        print(name, kind, len(found), 'wall groups at', at.round(1))
    meta = {
        'source': 'scripts: assets-src/machu/masonry_zones.py; OpenStreetMap contributors (ODbL) for the named ruins',
        'frame': 'Babylon world metres; box = [xmin, ymin, zmin, xmax, ymax, zmax]',
        # Measured on the CAST laser scans (CC BY-NC 3.0) as relief images at 1 cm a pixel.
        'measured': {
            'coursed': 'Torreón: courses 0.20-0.32 m (about 0.25), blocks 0.28-0.60 m (median about 0.40) from the scan; hairline joints, arrises rounded over about 17 mm (photograph Peru-174)',
            'megalithic': 'Principal Temple: courses about 0.80 m at the base to 0.30 m at the top (scan); blocks 1.8-3 course heights long, hairline joints, arrises rounded over about 35 mm (photograph Laslovarga 116)',
            'rustic': 'Knob Room and Water Mirrors: courses 0.24-0.36 m (about 0.28), stones 0.22-0.60 m (median about 0.40), mud joints a few cm',
        },
        'zones': zones,
    }
    OUT.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
