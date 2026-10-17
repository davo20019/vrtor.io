# Each lung's lobes (Z-Anatomy's) fitted to that lung's own airway tree (BodyParts3D's): a shift and a scale per lung,
# solved so the airways lie inside their lobes. The chest's bone fit (regfit.py) leaves some airway tips up to 13 mm
# outside the right lower lobe; two models of the lungs won't match exactly, but their airways must be inside them.
# Run in Blender after zexport.py: blender -b -P lungfit.py. Rewrites the lobes' OBJs in raw/zextra in place.
import json, os, re
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']


def read(path):
    head, v, f = [], [], []
    for l in open(path, errors='ignore'):
        if l.startswith('v '):
            v.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('f '):
            f.append([int(x.split('/')[0]) - 1 for x in l.split()[1:4]])
        elif l.startswith('#'):
            head.append(l)
    return head, np.array(v), f


def below(i):
    yield i
    for k in N[i]['kids']:
        yield from below(k)


lobes = {}            # lung side -> [(el, verts, faces, header, airway points)]
for n in N:
    if 'el' in n and n['name'].startswith('Tissue of'):
        lobe = N[n['parent']]
        side = 'left' if 'left' in n['name'] else 'right'
        head, v, f = read(os.path.join(HERE, 'raw', 'zextra', n['el'] + '.obj'))
        pts = []
        for i in below(lobe['id']):
            m = N[i]
            if 'el' in m and m.get('src') != 'za' and m['tissue'] == 'bronchus':
                pts.append(read(os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99', m['el'] + '.obj'))[1][::2])
        lobes.setdefault(side, []).append((n['el'], v, f, head, np.concatenate(pts)))


def outside(params, items):
    """Mean distance (mm) by which airway points lie outside their lobe, the lobes moved by params."""
    tx, ty, tz, s = params
    total, count = 0.0, 0
    for el, v, f, head, pts in items:
        c = items_centre
        w = (v - c) * s + c + np.array([tx, ty, tz])
        bvh = BVHTree.FromPolygons([Vector(x) for x in w], f)
        for p in pts:
            o, hits = Vector(p), 0
            d = Vector((0.0, 0.0, 1.0))
            while True:
                h = bvh.ray_cast(o, d)
                if h[0] is None:
                    break
                hits += 1
                o = h[0] + d * 0.01
            if hits % 2 == 0:
                total += bvh.find_nearest(Vector(p))[3]
            count += 1
    return total / count + 0.02 * (abs(tx) + abs(ty) + abs(tz)) + 40 * abs(s - 1)    # stay near the bone fit


report = {}
for side, items in lobes.items():
    allv = np.concatenate([it[1] for it in items])
    items_centre = (allv.min(0) + allv.max(0)) / 2
    x = [0.0, 0.0, 0.0, 1.0]
    best = outside(x, items)
    start = best
    for step, sstep in ((4.0, 0.02), (2.0, 0.01), (1.0, 0.005), (0.5, 0.0025)):
        improved = True
        while improved:
            improved = False
            for k in range(4):
                for sign in (1, -1):
                    y = list(x)
                    y[k] += sign * (sstep if k == 3 else step)
                    val = outside(y, items)
                    if val < best - 1e-3:
                        best, x, improved = val, y, True
    print(f'[lungfit] {side} lung: shift {np.round(x[:3], 1)} mm, scale {x[3]:.4f}; airways outside by {start:.2f} -> {best:.2f} mm on average')
    report[side] = {'shift_mm': x[:3], 'scale': x[3], 'before': start, 'after': best}
    tx, ty, tz, s = x
    for el, v, f, head, pts in items:
        w = (v - items_centre) * s + items_centre + np.array([tx, ty, tz])
        lo, hi = w.min(0), w.max(0)
        with open(os.path.join(HERE, 'raw', 'zextra', el + '.obj'), 'w') as out:
            for l in head:
                if l.startswith('# Bounds(mm)'):
                    l = '# Bounds(mm): ({:.4f},{:.4f},{:.4f})-({:.4f},{:.4f},{:.4f})\n'.format(*lo, *hi)
                if l.startswith('# Placed by'):
                    l = l.rstrip('\n') + f', then fitted to its airways (lungfit.py)\n'
                out.write(l)
            out.write('#\n')
            for p in w:
                out.write(f'v {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n')
            for t in f:
                out.write(f'f {t[0] + 1} {t[1] + 1} {t[2] + 1}\n')
json.dump(report, open(os.path.join(HERE, 'out', 'lungfit.json'), 'w'), indent=1)
