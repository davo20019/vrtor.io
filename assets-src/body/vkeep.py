# After a build: which vessels simplifying cut off from their network (on the shipped meshes, raw/vessels_built.json
# from vcheck_built.py), and the vessels they touched before simplifying. Adds both to out/keep_whole.json, which
# build.py keeps unsimplified. Rerun build, vcheck_built, vkeep until nothing is cut off.
import json, os, collections
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
B = json.load(open(os.path.join(HERE, 'raw', 'vessels_built.json')))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
byel = {n['el']: n for n in N if 'el' in n}
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
raw = lambda el: np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(OBJ if not el.startswith('Z') else os.path.join(HERE, 'raw', 'zextra'), el + '.obj')) if l.startswith('v ')])
keep_path = os.path.join(HERE, 'out', 'keep_whole.json')
keep = set(json.load(open(keep_path))) if os.path.exists(keep_path) else set()
added = 0
for tissue in ('vein', 'artery'):
    els = [e for e in B if byel[e]['tissue'] in (tissue, 'heart', 'blood', 'valve')]
    V = [np.array(B[e]) for e in els]
    kd = [cKDTree(v) for v in V]
    lo = np.array([v.min(0) for v in V]) - 0.002
    hi = np.array([v.max(0) for v in V]) + 0.002
    adj = collections.defaultdict(set)
    for i in range(len(V)):
        for j in np.where(np.all((lo[i] <= hi) & (hi[i] >= lo), axis=1))[0]:
            if j > i and np.isfinite(kd[j].query(V[i], distance_upper_bound=0.002)[0]).any():
                adj[i].add(j)
                adj[j].add(i)
    seen, comps = set(), []
    for i in range(len(V)):
        if i in seen:
            continue
        st, c = [i], []
        seen.add(i)
        while st:
            a = st.pop()
            c.append(a)
            for b in adj[a]:
                if b not in seen:
                    seen.add(b)
                    st.append(b)
        comps.append(c)
    comps.sort(key=len, reverse=True)
    main = set(comps[0])
    for c in comps[1:]:
        for i in c:
            keep.add(els[i])
            added += 1
            # and the vessels it touched before simplifying
            rv = cKDTree(raw(els[i]))
            for j in main:
                if np.all(lo[i] <= hi[j]) and np.all(hi[i] >= lo[j]) and np.isfinite(rv.query(raw(els[j]), distance_upper_bound=2.0)[0]).any():
                    keep.add(els[j])
                    added += 1
json.dump(sorted(keep), open(keep_path, 'w'))
print(f'[vkeep] {added} added; {len(keep)} vessels kept whole')
