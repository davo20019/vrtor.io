"""Where CAST's scanned buildings stand in the connected citadel (apps/mpc/public/models/citadel-scans.json).

The scans' own coordinates don't place them: each area has its own frame. Each is placed where the model's
schematic version of the same building stands, by the features both share, at the scan's true size:
  Torreón: the centre of the curved wall (a circle fitted to each) and the side its horseshoe opens on (the
  middle of the widest gap in the curve's angles); the scan's enclosure floor set on the model's ground there.
The model's building is then cleared from under the scan (apps/mpc/src/scans.js), within the scan's footprint.

    python3 -I assets-src/machu/place_scans.py
Needs the Blender dumps made by masonry_zones.py and scripts/bake-machu-scan.py's outputs.
"""
import json
import math
import pathlib
import subprocess
import tempfile

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import ConvexHull

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / '.cache'
MODELS = ROOT / 'apps/mpc/public/models'


def dump(glb, out):
    """Triangles of a GLB in Blender coordinates (z up)."""
    if not out.exists():
        script = ("import bpy,sys,numpy as np\nsrc,out=sys.argv[sys.argv.index('--')+1:]\n"
                  "bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)\n"
                  "T=[[tuple(o.matrix_world@o.data.vertices[i].co) for i in p.vertices[:3]] for o in bpy.context.scene.objects "
                  "if o.type=='MESH' for p in o.data.polygons]\nnp.save(out,np.array(T,np.float32))\n")
        with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False) as f:
            f.write(script)
        subprocess.run(['blender', '--factory-startup', '-b', '--python', f.name, '--', str(glb), str(out)], check=True, capture_output=True)
    return np.load(out)


def normals(T):
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def fit_circle(Q, guess, band):
    """Circle through the points within `band` of the guess, refitted twice as the band follows it."""
    p = np.asarray(guess, float)
    for _ in range(3):
        on = np.abs(np.linalg.norm(Q - p[:2], axis=1) - p[2]) < band
        p = least_squares(lambda q: np.linalg.norm(Q[on] - q[:2], axis=1) - q[2], p, loss='soft_l1', f_scale=.03).x
        band *= .6
    return p, on


def opening(Q, c):
    """Direction (degrees) of the middle of the widest gap in the curve's angles round its centre."""
    a = np.sort(np.degrees(np.arctan2(Q[:, 1] - c[1], Q[:, 0] - c[0])))
    gaps = np.diff(np.r_[a, a[0] + 360])
    i = int(np.argmax(gaps))
    return (a[i] + gaps[i] / 2 + 180) % 360 - 180, float(gaps[i])


def osm_turn():
    """The real Torreón's straight side (the longest edge of OSM way 1436032059, outward), and the rotation from
    the model's frame to OSM's (the anchor fit of masonry_zones.py), both in degrees."""
    import sys
    sys.path.insert(0, str(HERE))
    import masonry_zones as mz
    data = mz.osm()
    R = 6371008.8
    en = lambda la, lo: np.array([(lo - mz.LON0) * math.pi / 180 * R * math.cos(mz.LAT0 * math.pi / 180), (la - mz.LAT0) * math.pi / 180 * R])
    named = {e['tags']['name']: en(e['lat'], e['lon']) for e in data['elements'] if e['type'] == 'node' and 'name' in e.get('tags', {})}
    way = next(e for e in data['elements'] if e['type'] == 'way' and e['id'] == 1436032059)
    g = np.array([en(p['lat'], p['lon']) for p in way['geometry']])
    edges = list(zip(g[:-1], g[1:]))
    a, b = max(edges, key=lambda e: np.linalg.norm(e[1] - e[0]))
    mid = (a + b) / 2 - g[:-1].mean(0)
    straight = math.degrees(math.atan2(mid[1], mid[0]))
    groups = mz.wall_groups(mz.model_triangles())
    curved = [x for x in groups if x['directions'] >= 10 and (x['hi'] - x['lo'])[:2].max() < 40][0]
    M = np.array([(curved['lo'][:2] + curved['hi'][:2]) / 2 if k == 'Templo del Sol' else v[2] for k, v in mz.ANCHORS.items()])
    O = np.array([named[k] for k in mz.ANCHORS])
    zm = (M - M.mean(0)) @ [1, 1j]
    zo = (O - O.mean(0)) @ [1, 1j]
    rot = math.degrees(np.angle(np.vdot(zm, zo)))
    print(f'OSM: the Torreón\'s straight side faces {straight:.0f} deg; model to OSM rotation {rot:.1f} deg')
    return straight, rot


def floors(name, model_centre, radius=8):
    """Walkable floor heights: the scan's, as measured for its closeup (survey.json), and the model's walk grid
    (citadel.json, Babylon frame) round the building."""
    scan = next(x for x in json.loads((MODELS / 'survey.json').read_text()) if x['id'] == name)['floorHeight']
    nav = np.array([c[:3] for c in json.loads((MODELS / 'citadel.json').read_text())['nav']])
    near = np.hypot(nav[:, 0] + model_centre[0], nav[:, 2] + model_centre[1]) < radius
    return float(scan), float(np.median(nav[near, 1]) - .018)


def torreon():
    # The model's curved wall: faces of its only curved wall group that face neither of its two straight directions.
    T = np.concatenate([v for v in np.load(CACHE / 'citadel_tris.npz').values()])
    n = normals(T)
    c = T.mean(1)
    near = (np.linalg.norm(c[:, :2] - [16.2, -33.5], axis=1) < 7) & (np.abs(n[:, 2]) < .3) & (c[:, 2] > 42) & (c[:, 2] < 48)
    ang = np.degrees(np.arctan2(n[near, 1], n[near, 0])) % 180
    h, e = np.histogram(ang, 36, (0, 180))
    dom = e[np.argsort(h)[-2:]] + 2.5
    curve = np.array([min(abs(x - d) % 180, 180 - abs(x - d) % 180) for x in ang for d in [dom[0]]]) > 8
    curve &= np.array([min(abs(x - dom[1]) % 180, 180 - abs(x - dom[1]) % 180) for x in ang]) > 8
    MQ = c[near][curve, :2]
    # Started from a free circle fit through these faces: (18.08, -33.69), radius 3.91.
    (mx, my, mr), on = fit_circle(MQ, [18.08, -33.69, 3.91], .8)
    print('model curve faces', len(MQ), 'on the circle', int(on.sum()))
    m_open, m_gap = opening(MQ[on], (mx, my))
    ground = c[(np.linalg.norm(c[:, :2] - [mx, my], axis=1) < 12) & (n[:, 2] > .9)][:, 2]
    model_floor = float(np.median(ground[ground < np.percentile(ground, 40)]))
    # The scan's tower: the wall faces on its fitted 4.50 m circle.
    S = dump(MODELS / 'sun-temple-walk.glb', CACHE / 'walk_sun-temple.npy')
    sn = normals(S)
    sc = S.mean(1)
    # Started from a RANSAC circle through the full scan's wall faces (17,904 faces within 6 cm of it).
    SQ = sc[(np.abs(sn[:, 2]) < .3) & (sc[:, 2] > 4.2), :2]
    (sx, sy, sr), on = fit_circle(SQ, [-2.04, 1.44, 4.5], .3)
    s_open, s_gap = opening(SQ[on], (sx, sy))
    scan_floor, model_floor = floors('sun-temple', (mx, my))
    # The model's D is schematic and opens 80-odd degrees away from the real tower, so the turn comes from the real
    # orientation (OSM's outline) carried into the model's frame, not from the D. The D gives the position.
    straight, rot = osm_turn()
    theta = (straight - rot - s_open + 540) % 360 - 180
    print(f'model curve centre ({mx:.2f}, {my:.2f}) radius {mr:.2f}, opens towards {m_open:.0f} deg (gap {m_gap:.0f})')
    print(f'scan  curve centre ({sx:.2f}, {sy:.2f}) radius {sr:.2f}, opens towards {s_open:.0f} deg (gap {s_gap:.0f})')
    print(f'turn {theta:.1f} deg; floors: scan {scan_floor:.2f}, model {model_floor:.2f}')
    return dict(theta=theta, scan_centre=(sx, sy), model_centre=(mx, my), dz=model_floor - scan_floor, floor=model_floor,
                points=S.reshape(-1, 3), note=f'centred on the model curve ({mr:.2f} m radius; the real tower {sr:.2f} m); turned so the horseshoe opens as OSM way 1436032059 does, {straight:.0f} deg, less the model-to-OSM rotation {rot:.1f} deg')


BUILDINGS = {
    # scan: (OSM outline way, model wall group centre in Blender metres, how a fit's 180-degree tie is broken)
    # The Principal Temple's U opens onto the Sacred Plaza. The Water Mirrors' rectangle fits the ruins as well
    # either way round; CAST published it in the same metric frame as the Principal Temple, so it takes the turn
    # nearest the Principal Temple's.
    'main-temple': (1436032057, (-46.4, 75.4), ('faces', 'Plaza Sagrada')),
    'water-room': (844865415, (73.5, 30.4), ('frame', 'main-temple')),
}
# The Condor is not placed: mostly natural rock, its scan fits OSM's ruins about as well (1.17-1.27 m mean distance)
# at any turn across 60 degrees, so its turn would be arbitrary, and its 44 x 47 m would clear much of the model.
TURNS = {}


def real_turn(name, way_id, tie):
    """Turn (degrees) from the scan's frame to OSM's, by fitting the scan's wall faces in plan to the ruins OSM maps
    around the building (its outline and its neighbours'), at true size."""
    import sys
    import cv2
    from scipy.ndimage import map_coordinates
    sys.path.insert(0, str(HERE))
    import masonry_zones as mz
    data = mz.osm()
    R = 6371008.8
    en = lambda la, lo: np.array([(lo - mz.LON0) * math.pi / 180 * R * math.cos(mz.LAT0 * math.pi / 180), (la - mz.LAT0) * math.pi / 180 * R])
    named = {e['tags']['name']: en(e['lat'], e['lon']) for e in data['elements'] if e['type'] == 'node' and 'name' in e.get('tags', {})}
    way = next(e for e in data['elements'] if e['type'] == 'way' and e['id'] == way_id)
    outline = np.array([en(p['lat'], p['lon']) for p in way['geometry']])
    centre = outline[:-1].mean(0)
    res, lo = .05, centre - 30
    img = np.zeros((1200, 1200), np.uint8)
    for e in data['elements']:
        t = e.get('tags', {})
        if e['type'] == 'way' and (t.get('building') or t.get('barrier') in ('wall', 'retaining_wall')):
            g = np.array([en(p['lat'], p['lon']) for p in e['geometry']])
            if np.linalg.norm(g.mean(0) - centre) < 30:
                cv2.polylines(img, [((g - lo) / res).astype(np.int32).reshape(-1, 1, 2)], False, 255, 2)
    dist = np.minimum(cv2.distanceTransform(255 - img, cv2.DIST_L2, 5) * res, 2.0)
    S = dump(MODELS / f'{name}-walk.glb', CACHE / f'walk_{name}.npy')
    n = normals(S)
    walls = S.mean(1)[np.abs(n[:, 2]) < .3, :2]
    walls = walls[np.random.default_rng(0).choice(len(walls), min(6000, len(walls)), replace=False)]
    mid = walls.mean(0)
    def place(phi, shift):
        a = math.radians(phi)
        return (walls - mid) @ np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]).T + centre + shift
    def score(phi, shift):
        q = (place(phi, shift) - lo) / res
        return map_coordinates(dist, [q[:, 1], q[:, 0]], order=1, mode='constant', cval=2.0).mean()
    results = []
    for phi in range(0, 360, 2):
        best = min((score(phi, np.array([dx, dy])), dx, dy) for dx in np.arange(-3, 3.1, .75) for dy in np.arange(-3, 3.1, .75))
        results.append((best[0], phi, best[1], best[2]))
    results.sort()
    # Keep the turns that fit about as well as the best; an open side, if given, must face its point.
    print(f'{name}: best fit by turn (m):', [(r[1], round(float(r[0]), 2)) for r in sorted(results[:40], key=lambda r: r[1])][:40:3])
    # A rectangular outline fits a U and its reverse alike: when an open side is given, any turn fitting within 30%
    # of the best may win on it.
    faces = tie[1] if tie and tie[0] == 'faces' else None
    good = [r for r in results if r[0] < results[0][0] * (1.3 if faces else 1.08)]
    if tie and tie[0] == 'frame':
        ref = TURNS[tie[1]]
        good.sort(key=lambda r: abs((r[1] - ref + 540) % 360 - 180))
        print(f'{name}: of the fits within 8%, the turn nearest {tie[1]}\'s {ref} deg')
    if faces:
        def opens(r):
            pts = place(r[1], np.array(r[2:]))
            c = pts.mean(0)
            ang = np.degrees(np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0]))
            hist = np.histogram(ang, 36, (-180, 180))[0]
            k = int(np.argmin(np.convolve(np.r_[hist, hist[:5]], np.ones(6), 'valid')[:36]))
            open_dir = -180 + (k + 3) * 10
            target = math.degrees(math.atan2(*(named[faces] - c)[::-1]))
            return abs((open_dir - target + 540) % 360 - 180)
        good.sort(key=opens)
        print(f'{name}: open side within {opens(good[0]):.0f} deg of {faces}')
    phi = good[0][1]
    TURNS[name] = phi
    print(f'{name}: OSM fit {good[0][0]:.2f} m mean distance at {phi} deg; others within 8%:', sorted({r[1] for r in good})[:12])
    return phi, mid


def building(name):
    """A scan set where the model's building stands, turned as the real one is."""
    way_id, model_centre, tie = BUILDINGS[name]
    phi, mid = real_turn(name, way_id, tie)
    _, rot = osm_turn()
    S = dump(MODELS / f'{name}-walk.glb', CACHE / f'walk_{name}.npy')
    scan_floor, model_floor = floors(name, model_centre)
    theta = (phi - rot + 540) % 360 - 180
    print(f'{name}: turn {theta:.1f} deg in the model; floors: scan {scan_floor:.2f}, model {model_floor:.2f}')
    return dict(theta=theta, scan_centre=tuple(mid), model_centre=model_centre, dz=model_floor - scan_floor, floor=model_floor,
                points=S.reshape(-1, 3), note=f'set on the model building at {model_centre}; turned as OSM way {way_id} and the ruins round it ({phi} deg), less the model-to-OSM rotation {rot:.1f} deg')


def placement(name, p):
    """Babylon frame: x = -Blender x, z = -Blender y. The node turns by -theta about y, then moves."""
    t = math.radians(p['theta'])
    R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    to_model = lambda xy: (np.asarray(xy) - p['scan_centre']) @ R.T + p['model_centre']
    origin = to_model([0.0, 0.0])
    pts = to_model(p['points'][:, :2])
    hull = pts[ConvexHull(pts).vertices]
    return {
        'id': name, 'mesh': f'{name}-walk.glb', 'normal': f'{name}-walk-normal.ktx2', 'gray': f'{name}-walk-gray.ktx2',
        'position': [round(-origin[0], 3), round(p['dz'], 3), round(-origin[1], 3)],
        'rotationY': round(-t, 5), 'floor': round(p['floor'], 3),
        'footprint': [[round(-x, 2), round(-y, 2)] for x, y in hull],
        'how': p['note'],
    }


def main():
    scans = [placement('sun-temple', torreon())] + [placement(name, building(name)) for name in BUILDINGS]
    out = {'frame': 'Babylon world metres; footprint is the scan\'s plan outline [x, z]', 'scans': scans}
    (MODELS / 'citadel-scans.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print('wrote', MODELS / 'citadel-scans.json')


if __name__ == '__main__':
    main()
