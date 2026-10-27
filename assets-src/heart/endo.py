"""The inside of the walls: trabeculae carneae, the moderator band, the crista terminalis, the pectinate muscles
and the fossa ovalis. The CT surfaces are smooth (the segmentation smoothed them); these are built on them.

- Trabeculae carneae: ridges of muscle on the ventricles' inner surface, laid by walking over it in the
  ventricular coordinates (mostly from apex to base, drifting round), fine in the LV's lower two thirds (its upper
  septum, the outflow, stays smooth) and coarse in the RV. Half sunk in the wall, tapering at their ends.
- Moderator band (septomarginal trabecula): from the septum across the RV to the base of the anterior papillary
  muscle; its published thickness, and its length checked against the published one.
- Crista terminalis: the ridge down the right atrium's lateral wall from the superior to the inferior vena cava,
  thinning from its head to its tail as published.
- Pectinate muscles: ridges branching from the crista like the teeth of a comb across the right atrium's wall and
  appendage, stopping short of the smooth vestibule round the tricuspid valve; and in the left atrial appendage.
- Fossa ovalis: the oval hollow on the atrial septum, seen as its raised rim, the limbus.

Every vertex moves with the wall it lies on (the moderator band, crossing the cavity, with the cavity).
Out: work/parts/endo_*.npz (+ .json)
"""
import json, glob, os, numpy as np, pyvista as pv
from scipy.spatial import cKDTree
import heartgeo as H
from subvalve import tube, merge

E = json.load(open('endo_params.json'))
W = H.walls(); rng = np.random.default_rng(11)
m = pv.read('work/average.vtu'); TAG = m.cell_data['ID']

def normals(name):
    return H.mesh(name).compute_normals(auto_orient_normals=True, point_normals=True).point_normals   # out of the wall

def save(pid, V, F, name, group, mount):
    vs, af = H.cavity_motion(V, mount) if mount in ('lv', 'rv') and group == 'moderator_band' else H.motion_at(V, 'heart')
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=vs.astype('f4'), afill=af.astype('f4'))
    json.dump({'name': name, 'tissue': 'heart', 'group': group, 'mount': mount}, open(f'work/parts/{pid}.json', 'w'), indent=1)

def dedupe(path):
    keep = np.r_[True, np.linalg.norm(np.diff(path, axis=0), axis=1) > 0.2]
    return path[keep]

def dedupe_idx(v, idx):
    keep = np.r_[True, np.linalg.norm(np.diff(v[idx], axis=0), axis=1) > 0.2]
    return idx[keep]

def ridge(path, r_mid, r_end=0.25):
    """A muscle ridge along path: thickest in the middle, tapering to almost nothing at both ends."""
    path = dedupe(path)
    if len(path) < 3: return np.zeros((0, 3)), np.zeros((0, 3), 'i4')
    t = np.linspace(0, 1, len(path)); r = r_end + (r_mid - r_end) * np.sin(np.pi * t) ** 0.6
    return tube(path, r, sides=8)

def smooth(P, k=2):
    for _ in range(k): P = np.vstack([P[:1], (P[:-2] + 2 * P[1:-1] + P[2:]) / 4, P[-1:]])
    return P

# ---------------------------------------------------------------- ventricles

def flat_ridge(path, nrm, width, height, sides=10):
    """A ridge of muscle lying on a wall: a flattened tube (width across the wall, height out of it) whose base
    is sunk into the wall, so it rises from it rather than lying on it. width/height per path point."""
    T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    Nn = nrm - (nrm * T).sum(1, keepdims=True) * T; Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12
    B = np.cross(T, Nn); a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    C = path - Nn * (height * 0.35)[:, None]
    V = (C[:, None, :] + (width / 2)[:, None, None] * np.cos(a)[None, :, None] * B[:, None, :]
         + height[:, None, None] * np.sin(a)[None, :, None] * Nn[:, None, :]).reshape(-1, 3)
    F = []
    for i in range(len(path) - 1):
        for j in range(sides):
            p_, q = i * sides + j, i * sides + (j + 1) % sides
            F += [[p_, q, q + sides], [p_, q + sides, p_ + sides]]
    c0, c1 = len(V), len(V) + 1; V = np.vstack([V, C[0], C[-1]]); e = (len(path) - 1) * sides
    F += [[c0, (j + 1) % sides, j] for j in range(sides)] + [[c1, e + j, e + (j + 1) % sides] for j in range(sides)]
    return V, np.array(F, 'i4')

def trabeculae(side, p):
    """Trabeculae carneae: columns of muscle running mostly from apex to base, joined here and there by cross
    links, as in a dissected ventricle. Nodes spread over the inner surface (none closer than the spacing); each
    links to its best neighbour towards the base, and chains of such links become single, continuous ridges whose
    thickness wanders along them and which taper into the wall at their ends; a share of nodes also link
    sideways. Ridges are flat (wider than high) and rise out of the wall."""
    v, u = W[side + '_v'], W[side + '_uvc']; n = normals(side)
    ax = np.load('work/motion.npz')['axis']
    zone = (u[:, 0] < 0.04) & (u[:, 2] > p['z'][0]) & (u[:, 2] < p['z'][1])
    if side == 'lv': zone &= ~((np.abs(u[:, 1]) < p['smooth_septum']) & (u[:, 2] > p.get('septum_from', 0.45)))   # the septum is smooth but at the apex
    iv = np.where(zone)[0]; rng.shuffle(iv)
    nodes = []
    for i in iv:
        if nodes and np.min(np.linalg.norm(v[nodes] - v[i], axis=1)) < p['spacing'] * rng.uniform(0.8, 1.3): continue
        nodes.append(i)
    nodes = np.array(nodes); P = v[nodes]; TN = cKDTree(P)
    inner = np.where(u[:, 0] < 0.04)[0]; TI = cKDTree(v[inner])
    up = -np.ones(len(nodes), int); cross = []
    for a_ in range(len(nodes)):
        d, nb = TN.query(P[a_], 8); best = None
        for dd, b_ in zip(d[1:], nb[1:]):
            if dd > p['spacing'] * 2.4: continue
            dirn = (P[b_] - P[a_]) / dd; along = dirn @ ax
            if along > 0.55 and (best is None or dd < best[0]): best = (dd, b_)
            elif abs(along) < 0.4 and rng.random() < p['cross_share'] / 3: cross.append((a_, b_))
        if best: up[a_] = best[1]
    has_down = np.zeros(len(nodes), bool); has_down[up[up >= 0]] = True
    def lay(idx_path):
        """Sample the chain densely, lay it over the wall, with its normals."""
        pts = P[idx_path]
        dense = np.vstack([pts[k] * (1 - t) + pts[k + 1] * t for k in range(len(pts) - 1) for t in np.linspace(0, 1, 4)[:-1]] + [pts[-1:]])
        dense = dense + rng.normal(0, p['spacing'] * 0.08, dense.shape)   # not ruler-straight
        j = inner[TI.query(dense)[1]]
        path = smooth(dedupe(v[j]), 3); nn = n[inner[TI.query(path)[1]]]
        return path, nn
    parts = []; chains = 0
    used = np.zeros(len(nodes), bool)
    for s_ in range(len(nodes)):
        if has_down[s_] or used[s_]: continue
        chain = [s_]
        while up[chain[-1]] >= 0 and not used[up[chain[-1]]] and len(chain) < 40:
            used[chain[-1]] = True; chain.append(up[chain[-1]])
        used[chain[-1]] = True
        if len(chain) < 2: continue
        path, nn = lay(np.array(chain))
        if len(path) < 4: continue
        t = np.linspace(0, 1, len(path)); w0 = rng.uniform(*p['radius']) * 2
        wav = 1 + 0.35 * np.sin(t * rng.uniform(4, 9) + rng.uniform(0, 6))
        taper = np.clip(np.minimum(t, 1 - t) * len(path) / 4, 0.15, 1)
        width = w0 * wav * taper; height = width * p['flatness']
        parts.append(flat_ridge(path, nn, width, height)); chains += 1
    for a_, b_ in cross:
        path, nn = lay(np.array([a_, b_]))
        if len(path) < 3: continue
        w = np.full(len(path), rng.uniform(*p['radius']) * 1.4); w[[0, -1]] *= 0.6
        parts.append(flat_ridge(path, nn, w, w * p['flatness']))
    return merge(parts), f'{chains} columns, {len(cross)} cross links'

def moderator_band(p):
    pm = np.load('work/parts/rv_pm_ant.npz')['v']
    lv, u = W['lv_v'], W['lv_uvc']
    sept = (u[:, 0] > 0.95) & (np.abs(u[:, 1]) < 0.9)                # the septum's RV face
    base = pm[np.argsort(np.linalg.norm(pm - pm.mean(0), axis=1))][:50].mean(0)
    # the band leaves the septum where it is nearest the anterior muscle's base, a little above it
    cand = lv[sept]; d = np.linalg.norm(cand - base, axis=1); s0 = cand[np.argmin(d)]
    mid = (s0 + base) / 2; ax = H.motion_at  # noqa
    # it sags a little into the cavity and flares where it meets the septum and the muscle
    t = np.linspace(-0.18, 1.14, 30)[:, None]          # its ends sunk into the septum and the muscle
    path = s0 * (1 - t) + base * t
    tt = t[:, 0]; r = p['thickness'] / 2 * (1 + 0.3 * np.exp(-((tt + 0.05) / 0.18) ** 2) + 0.3 * np.exp(-((1.03 - tt) / 0.18) ** 2))
    V, F = tube(path, r, sides=14)
    return V, F, float(np.linalg.norm(base - s0))

# ---------------------------------------------------------------- atria

def inner_atrium(name):
    """Vertices of an atrium's inside (normals out of the wall pointing into its cavity) and their normals."""
    import cavities
    v = W[name + '_v']; n = normals(name)
    cav = np.asarray(m.points)[cavities.cavity_faces(name.upper()).ravel()].mean(0)
    into = ((cav - v) * n).sum(1) > 0
    return np.where(into)[0], v, n, cav

def cap_centre(tag):
    P = np.asarray(m.extract_cells(TAG == tag).points); return P.mean(0)

def march(start, toward, idx, v, n, T, step=2.0, length=30.0, stop=None):
    """Walk over a surface from start towards a point, staying on it (each step projected to its nearest vertex)."""
    p = start.copy(); out = [p]
    for _ in range(int(length / step)):
        d = toward - p; d -= (d @ n[idx[T.query(p)[1]]]) * n[idx[T.query(p)[1]]]
        if np.linalg.norm(d) < 1e-6: break
        q = p + d / np.linalg.norm(d) * step; j = idx[T.query(q)[1]]; p = v[j]
        if stop is not None and stop(p): break
        out.append(p)
    return np.array(out)

def right_atrium(p):
    idx, v, n, cav = inner_atrium('ra'); T = cKDTree(v[idx])
    svc, ivc = cap_centre(16), cap_centre(17)
    # the crista runs down the lateral wall: the side away from the septum (the LA)
    lat = cav - np.asarray(m.extract_cells(TAG == 3).points).mean(0); lat /= np.linalg.norm(lat)
    t = np.linspace(0, 1, 30)[:, None]
    line = svc * (1 - t) + ivc * t + lat * (np.sin(np.pi * t) * p['crista_bow'])
    crista = smooth(dedupe(v[idx[T.query(line)[1]]]), 4)
    # thickness from head (by the SVC) to tail (by the IVC), published; as a ridge, half its thickness stands out
    th = np.interp(np.linspace(0, 1, len(crista)), [0, 0.5, 1], p["crista_thickness"])
    nn = n[idx[T.query(crista)[1]]]
    Vc, Fc = tube(crista + nn * th[:, None] * 0.25, th / 2, sides=10)
    # pectinate muscles: from the crista, across the wall towards the appendage, stopping at the smooth vestibule
    tv = H.ring('tv')[0]; TV = cKDTree(tv)
    front = v[idx][np.argmax(v[idx] @ np.array([0, -0.7, 0.7]))]    # the appendage's tip: front and up
    pects = []
    for k in np.linspace(3, len(crista) - 4, p['pectinate_count']).astype(int):
        start = crista[k]
        aim = front * 0.6 + (start + (front - start) * 0.5 + rng.normal(0, 6, 3)) * 0.4
        path = march(start, aim, idx, v, n, T, length=rng.uniform(*p['pectinate_length']),
                     stop=lambda q: TV.query(q)[0] < p['vestibule'])
        if len(path) < 4: continue
        path = smooth(dedupe(path), 3); pn = n[idx[T.query(path)[1]]]
        r = rng.uniform(*p['pectinate_radius'])
        pects.append(ridge(path + pn * r * 0.4, r))
    # fossa ovalis: its rim (the limbus) on the septum, facing the LA, a little below the middle
    la = np.asarray(m.extract_cells(TAG == 3).points).mean(0)
    sp = v[idx][np.argmin(np.linalg.norm(v[idx] - (la + (cav - la) * 0.45 - np.array([0, 0, 6])), axis=1))]
    sn = n[idx[T.query(sp)[1]]]
    a = np.cross(sn, [0, 0, 1.0]); a /= np.linalg.norm(a); b = np.cross(sn, a)
    th_ = np.linspace(0, 2 * np.pi, 48, endpoint=False)
    ring_ = sp + np.outer(np.cos(th_) * p['fossa'][0] / 2, a) + np.outer(np.sin(th_) * p['fossa'][1] / 2, b)
    ring_ = smooth(v[idx[T.query(ring_)[1]]], 2) + sn * 0.8
    ring_ = np.vstack([ring_, ring_[:2]])
    Vf, Ff = tube(ring_, np.full(len(ring_), p['limbus'] / 2), sides=8)
    return (Vc, Fc), merge(pects), (Vf, Ff), len(pects)

def left_appendage(p):
    idx, v, n, cav = inner_atrium('la'); T = cKDTree(v[idx])
    tip = cap_centre(11)
    near = idx[np.linalg.norm(v[idx] - tip, axis=1) < p['laa_reach']]
    paths = []
    for k in range(p['laa_count']):
        s = v[rng.choice(near)]; aim = tip + rng.normal(0, 8, 3)
        path = march(s, aim, idx, v, n, T, length=rng.uniform(8, 18))
        if len(path) < 4: continue
        path = smooth(dedupe(path), 2); pn = n[idx[T.query(path)[1]]]; r = rng.uniform(*E['laa_pectinate_radius'])
        paths.append(ridge(path + pn * r * 0.4, r))
    return merge(paths), len(paths)

if __name__ == '__main__':
    for f in glob.glob('work/parts/endo_*'): os.remove(f)
    for side in ('lv', 'rv'):
        (V, F), k = trabeculae(side, E['trabeculae'][side])
        save(f'endo_{side}_trabeculae', V, F, f'Trabeculae carneae of the {"left" if side == "lv" else "right"} ventricle', f'{side}_trabeculae', side)
        print(f'{side} trabeculae: {k}')
    V, F, L = moderator_band(E['moderator_band'])
    save('endo_moderator_band', V, F, 'Moderator band (septomarginal trabecula)', 'moderator_band', 'rv')
    print(f'moderator band: {L:.1f} mm long (published {E["moderator_band"]["published_length"]})')
    (Vc, Fc), (Vp, Fp), (Vf, Ff), k = right_atrium(E['right_atrium'])
    save('endo_crista_terminalis', Vc, Fc, 'Crista terminalis', 'crista_terminalis', 'ra')
    save('endo_ra_pectinate', Vp, Fp, 'Pectinate muscles of the right atrium', 'pectinate_muscles', 'ra')
    save('endo_fossa_ovalis', Vf, Ff, 'Limbus of the fossa ovalis', 'fossa_ovalis', 'ra')
    print(f'right atrium: crista, {k} pectinate muscles, fossa ovalis')
    (V, F), k = left_appendage(E['left_appendage'])
    save('endo_laa_pectinate', V, F, 'Pectinate muscles of the left atrial appendage', 'pectinate_muscles', 'la')
    print(f'left atrial appendage: {k} pectinate muscles')
