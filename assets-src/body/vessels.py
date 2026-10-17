# Are the vessels connected where they should be? Every vein (and artery) checked for touching another of its kind:
# two vessels touch if their surfaces come within TOUCH mm. The touching pairs make a network; a healthy venous
# system is one network draining to the heart. Prints the networks, and every vessel or group of vessels cut off,
# with how far it is from the nearest vessel of its kind. On BodyParts3D's own meshes (before simplification) and on
# the built GLBs' (after), so a gap made by simplifying shows too. Writes out/vessels.json.
import json, os, collections, sys
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
TOUCH = 2.0


def verts(el):
    d = os.path.join(HERE, 'raw', 'zextra') if el.startswith('Z') else OBJ
    return np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(d, el + '.obj')) if l.startswith('v ')])


# The heart joins the networks: the venae cavae and the heart's own veins drain into the right atrium, the lungs'
# veins into the left; the aorta and pulmonary trunk leave the ventricles. Its walls, chambers and valves count as
# vessels for this.
HEART = {'heart', 'blood', 'valve'}


def network(tissue):
    # ours, and the joins vjoin.py made (ZV...)
    parts = [n for n in N if 'el' in n and (n.get('src') != 'za' or n['el'].startswith('ZV'))
             and (n.get('tissue') == tissue or n.get('tissue') in HEART)]
    V = [verts(n['el']) for n in parts]
    kd = [cKDTree(v) for v in V]
    lo = np.array([v.min(0) for v in V]) - TOUCH
    hi = np.array([v.max(0) for v in V]) + TOUCH
    edges = collections.defaultdict(set)
    for i in range(len(parts)):
        cand = np.where(np.all((lo[i] <= hi) & (hi[i] >= lo), axis=1))[0]
        for j in cand:
            if j <= i:
                continue
            d = kd[j].query(V[i], distance_upper_bound=TOUCH)[0]
            if np.isfinite(d).any():
                edges[i].add(j)
                edges[j].add(i)
    # networks: connected components
    seen, comps = set(), []
    for i in range(len(parts)):
        if i in seen:
            continue
        stack, comp = [i], []
        seen.add(i)
        while stack:
            a = stack.pop()
            comp.append(a)
            for b in edges[a]:
                if b not in seen:
                    seen.add(b)
                    stack.append(b)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    # how far each smaller network is from the main one (the one through the heart)
    main = set(comps[0])
    mv = np.concatenate([V[i] for i in main])
    mown = np.concatenate([np.full(len(V[i]), i) for i in main])
    kd_main = cKDTree(mv)
    out = []
    for c in comps[1:]:
        pts = np.concatenate([V[i] for i in c])
        d, idx = kd_main.query(pts)
        k = int(np.argmin(d))
        out.append({'parts': [parts[i]['name'] for i in c], 'gap_mm': round(float(d[k]), 1),
                    'nearest': parts[mown[idx[k]]]['name'], 'at_mm': [round(float(x)) for x in pts[k]]})
    return parts, comps, out


report = {}
for tissue in ('vein', 'artery'):
    parts, comps, cut = network(tissue)
    sizes = [len(c) for c in comps]
    print(f'{tissue}s (with the heart): {len(parts)} parts in {len(comps)} networks; the largest {sizes[:5]}; '
          f'cut off: {sum(sizes[1:])} parts in {len(cut)} groups')
    gaps = sorted(cut, key=lambda x: -x['gap_mm'])
    for g in gaps[:25]:
        print(f"   gap {g['gap_mm']:6.1f} mm  {len(g['parts'])} part(s): {', '.join(g['parts'][:3])}{'…' if len(g['parts']) > 3 else ''}  (nearest: {g['nearest']})")
    report[tissue] = {'parts': len(parts), 'networks': sizes, 'cut': gaps}
json.dump(report, open(os.path.join(HERE, 'out', 'vessels.json'), 'w'), indent=1)
