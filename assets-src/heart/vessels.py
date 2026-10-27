"""The great vessels beyond the CT's cut stubs: the aorta (ascending, arch with its three branches, descending), the
pulmonary trunk to its split and both pulmonary arteries, the four pulmonary veins, the superior vena cava with
the brachiocephalic veins, and the inferior vena cava.

Each is a tube swept along BodyParts3D's own vessel (carried onto the CT heart with register.py's transform):
its centreline and radius are traced by marching along the element's vertices, slice by slice. A tube that
continues a CT stub starts exactly on the stub's open end (its centre, direction and radius) and blends into
BodyParts3D's path over its first 15 mm, so the join doesn't step. Walls have their thickness (published; the
inside is the lumen, open at both ends) and are closed solids. The vessels are held by the body where they leave
the heart, so they don't move with the beat (the CT stubs' ends are held still in motion.py too).

Out: work/parts/ves_<id>.npz (+ .json)
"""
import json, os, glob, numpy as np, pyvista as pv
from scipy.spatial import cKDTree
import heartgeo as H
from warp import apply as warp
OBJ = glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'body', 'raw', 'objisa', '*'))[0]
def read_obj(p):
    v, f = [], []
    for line in open(p):
        if line.startswith('v '): v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('f '): f.append([int(x.split('/')[0]) - 1 for x in line.split()[1:4]])
    return np.array(v, 'f4'), np.array(f, 'i4')

P = json.load(open('vessels_params.json'))
m = pv.read('work/average.vtu'); TAG = m.cell_data['ID']

def stub_end(label, ring=None):
    """Centre, outward direction and outer radius of a CT stub's open end. Vein caps (11-17) are discs closing
    the vessel: their centre and normal are the opening. Arteries: the stub's far end along its own axis."""
    if ring is None:
        Pc = np.asarray(m.extract_cells(TAG == label).points); c = Pc.mean(0); n = np.linalg.svd(Pc - c)[2][2]
        heart = np.asarray(m.points).mean(0)
        if n @ (c - heart) < 0: n = -n
        r = np.linalg.norm((Pc - c) - np.outer((Pc - c) @ n, n), axis=1).max()
        return c, n, r
    rc = np.asarray(m.extract_cells(TAG == ring).points).mean(0)
    S = np.asarray(H.mesh({5: 'aorta', 6: 'pa'}[label]).points)
    ax = S[np.argsort(np.linalg.norm(S - rc, axis=1))[-200:]].mean(0) - rc; ax /= np.linalg.norm(ax)
    pr = (S - rc) @ ax; e = S[pr > pr.max() - 1.0]; c = e.mean(0)
    r = np.linalg.norm((e - c) - np.outer((e - c) @ ax, ax), axis=1).max()
    return c, ax, r

def trace(V, start, d0, length, r0=10.0, step=2.0):
    """Centreline and outer radius of a tubular point cloud V, from start along d0, for up to length mm. Each
    slice takes only the points within 1.7 times the current radius of where the centre is expected, so the
    other limb of an arch or a neighbouring vessel never joins it. Stops where the vessel ends (the slice
    empties or narrows to under half the radius so far)."""
    tree = cKDTree(V); p, d = start.copy(), d0 / np.linalg.norm(d0); pts, rads = [], []
    r = r0; walked = 0.0
    while walked < length:
        q = p + d * step
        nb = np.array(tree.query_ball_point(q, max(3.0, 1.7 * r)))
        if len(nb) < 12: break
        X = V[nb]; X = X[np.abs((X - q) @ d) < 1.0]
        if len(X) < 10: break
        c = X.mean(0); c = c - ((c - q) @ d) * d
        rn = np.median(np.linalg.norm((X - c) - np.outer((X - c) @ d, d), axis=1))
        if pts and rn < 0.5 * np.median(rads): break
        r = 0.7 * r + 0.3 * rn
        nd = c - p; nd /= np.linalg.norm(nd); d = d * 0.7 + nd * 0.3; d /= np.linalg.norm(d)
        p = c; pts.append(c); rads.append(rn); walked += step
    return np.array(pts), np.array(rads)

def smooth_path(X, k=2):
    for _ in range(k): X = np.vstack([X[:1], (X[:-2] + 2 * X[1:-1] + X[2:]) / 4, X[-1:]])
    return X

def frames(path):
    T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    a = np.array([1.0, 0, 0]) if abs(T[0, 0]) < 0.9 else np.array([0, 1.0, 0])
    N = [np.cross(T[0], a) / np.linalg.norm(np.cross(T[0], a))]
    for i in range(1, len(T)):
        v = N[-1] - (N[-1] @ T[i]) * T[i]; N.append(v / np.linalg.norm(v))
    N = np.array(N); return T, N, np.cross(T, N)

def wall_tube(path, r_out, wall, sides=40):
    """A vessel's wall as a closed solid: outer and inner surfaces joined at both ends (the lumen is open)."""
    T, N, B = frames(path); a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = lambda r: (path[:, None, :] + r[:, None, None] * (np.cos(a)[None, :, None] * N[:, None, :] + np.sin(a)[None, :, None] * B[:, None, :])).reshape(-1, 3)
    out, inn = ring(r_out), ring(np.maximum(r_out - wall, 0.4)); n = len(out); L = len(path)
    F = []
    for i in range(L - 1):
        for j in range(sides):
            p, q = i * sides + j, i * sides + (j + 1) % sides
            F += [[p, q, q + sides], [p, q + sides, p + sides]]
            F += [[n + p, n + q + sides, n + q], [n + p, n + p + sides, n + q + sides]]
    for i, flip in [(0, True), (L - 1, False)]:
        for j in range(sides):
            p, q = i * sides + j, i * sides + (j + 1) % sides
            f = [[p, n + p, n + q], [p, n + q, q]]
            F += [x[::-1] for x in f] if flip else f
    return np.vstack([out, inn]), np.array(F, 'i4')

def bp3d_cloud(els, per_mm2=1.0):
    """Points spread over the elements' surfaces (their own vertices are too sparse to slice), carried onto the
    CT heart."""
    rng = np.random.default_rng(3); out = []
    for el in els:
        v, f = read_obj(os.path.join(OBJ, el + '.obj')); v = v.astype('f8')
        a = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1) / 2
        n = int(a.sum() * per_mm2); i = rng.choice(len(f), n, p=a / a.sum()); r = rng.random((n, 2)); m = r.sum(1) > 1; r[m] = 1 - r[m]
        out.append(v[f[i, 0]] + r[:, :1] * (v[f[i, 1]] - v[f[i, 0]]) + r[:, 1:] * (v[f[i, 2]] - v[f[i, 0]]))
    return warp(np.vstack(out))

def save(pid, V, F, name, group, extra=None):
    z = np.zeros_like(V)
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=z.astype('f4'), afill=z.astype('f4'))
    json.dump({'name': name, 'tissue': 'artery_wall' if group == 'great_arteries' else 'vein_wall', 'group': group,
               'mount': 'body', **(extra or {})}, open(f'work/parts/{pid}.json', 'w'), indent=1)

if __name__ == '__main__':
    os.makedirs('work/parts', exist_ok=True)
    for f in glob.glob('work/parts/ves_*'): os.remove(f)
    built = {}
    for v in P['vessels']:
        V = bp3d_cloud(v['bp3d'])
        if 'stub' in v:   # continues a CT stub
            c, d, r0 = stub_end(v['stub'], v.get('ring'))
            path, rad = trace(V, c, d, v['length'], r0=r0)
            if len(path) < 3: print('!', v['id'], 'trace failed'); continue
            # blend from the stub's end into BodyParts3D's path over the first 15 mm
            s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)]) + 2.0
            w = np.clip(s / 15.0, 0, 1)[:, None]
            straight = c + np.outer(s, d)
            path = np.vstack([c, straight * (1 - w) + path * w]); rad = np.r_[r0, r0 * (1 - w[:, 0]) + rad * w[:, 0]]
        else:             # a branch: starts inside its parent's wall, at BodyParts3D's own start nearest the parent
            par = built[v['from']]; t = cKDTree(par)
            dist = t.query(V)[0]; start = V[np.argmin(dist)]
            d = V.mean(0) - start
            rb = np.median(np.linalg.norm(V - V.mean(0), axis=1)) * 0.5
            path, rad = trace(V, start - d / np.linalg.norm(d) * 3, d, v['length'], r0=min(rb, 8.0))
            if len(path) < 3: print('!', v['id'], 'trace failed'); continue
        path = smooth_path(path, 3)
        rad = np.convolve(np.r_[rad[:2], rad, rad[-2:]], np.ones(5) / 5, 'valid')
        Vt, Ft = wall_tube(path, rad, v['wall'])
        save('ves_' + v['id'], Vt, Ft, v['name'], v['group'])
        built[v['id']] = path
        print(f"{v['name']:32s} {len(path) * 2:4d} mm, radius {rad.min():.1f}-{rad.max():.1f} mm")
