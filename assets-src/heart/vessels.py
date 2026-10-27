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

CUTS = {}
def stub_end(label, ring=None):
    """Centre, outward direction and outer radius of a CT stub's open end. Vein caps (11-17) are discs closing
    the vessel: their centre and normal are the opening. The aorta and pulmonary trunk end in a slanted, ragged cut:
    they are trimmed square across their own axis just above the sinotubular junction (CUTS, applied to the shipped
    walls by parts.py), and the tube starts on that cut, at its cross-section's radius."""
    if ring is None:
        Pc = np.asarray(m.extract_cells(TAG == label).points); c = Pc.mean(0); n = np.linalg.svd(Pc - c)[2][2]
        heart = np.asarray(m.points).mean(0)
        if n @ (c - heart) < 0: n = -n
        r = np.linalg.norm((Pc - c) - np.outer((Pc - c) @ n, n), axis=1).max()
        return c, n, r
    rc = np.asarray(m.extract_cells(TAG == ring).points).mean(0)
    name = {5: 'aorta', 6: 'pa'}[label]; S = np.asarray(H.mesh(name).points)
    # the outflow direction: the valve plane's normal (downstream), not the stub's far points (it is short and oblique)
    ax = H.valve_frame({5: 'av', 6: 'pv'}[label])[1]
    pr = (S - rc) @ ax
    h = min(P['cut_above_ring'], pr.max() - 4)
    x = S[np.abs(pr - h) < 1.0]; c = x.mean(0); c = c - ((c - rc) @ ax - h) * ax
    rr = np.linalg.norm((x - c) - np.outer((x - c) @ ax, ax), axis=1)
    CUTS[name] = (c.tolist(), ax.tolist())
    return c, ax, float(np.percentile(rr, 90))

def centreline(els, near, h=1.5):
    """Centreline and radius of BodyParts3D vessel elements (their union, carried onto the CT heart): the vessel
    filled as voxels of h mm, its distance transform (the radius anywhere inside) and skeleton; the path is the
    skeleton's longest route from its end nearest `near`."""
    from skimage.morphology import skeletonize
    from scipy.ndimage import distance_transform_edt, binary_closing
    from scipy.sparse.csgraph import dijkstra
    from scipy import sparse
    ms = []
    for el in els:
        v, f = read_obj(os.path.join(OBJ, el + '.obj'))
        ms.append(pv.PolyData(warp(v), np.hstack([np.full((len(f), 1), 3), f]).ravel()))
    lo = np.min([m_.bounds[::2] for m_ in ms], 0) - 3; hi = np.max([m_.bounds[1::2] for m_ in ms], 0) + 3
    dims = np.ceil((hi - lo) / h).astype(int) + 1
    grid = pv.ImageData(dimensions=dims, spacing=(h, h, h), origin=lo)
    inside = np.zeros(grid.n_points, bool)
    for m_ in ms:
        inside |= grid.select_interior_points(m_.clean().triangulate(), check_surface=False)['selected_points'].astype(bool) \
            if hasattr(grid, 'select_interior_points') else grid.select_enclosed_points(m_.clean().triangulate(), check_surface=False)['SelectedPoints'].astype(bool)
    vol = inside.reshape(dims[::-1]).transpose(2, 1, 0)        # x, y, z
    vol = binary_closing(vol, iterations=1)                    # close the seams between elements
    dist = distance_transform_edt(vol) * h
    sk = skeletonize(vol)
    idx = np.argwhere(sk); P = lo + idx * h
    if len(P) < 3: return np.zeros((0, 3)), np.zeros(0)
    # a graph of the skeleton's voxels, 26-connected
    from scipy.spatial import cKDTree as T
    t = T(idx); pairs = t.query_pairs(1.75, output_type='ndarray')
    w = np.linalg.norm(idx[pairs[:, 0]] - idx[pairs[:, 1]], axis=1)
    G = sparse.coo_matrix((w, (pairs[:, 0], pairs[:, 1])), (len(P), len(P))); G = G + G.T
    s0 = np.argmin(np.linalg.norm(P - near, axis=1))
    dd, pred = dijkstra(G, indices=s0, return_predecessors=True)
    far = np.argmax(np.where(np.isfinite(dd), dd, -1)); path = [far]
    while path[-1] != s0 and pred[path[-1]] >= 0: path.append(pred[path[-1]])
    path = path[::-1]
    rad = dist[tuple(idx[path].T)]
    return P[path], rad

def clip_path(path, rad, c, d, length):
    """The part of path beyond the plane through c facing d, from its point nearest c, for up to length mm."""
    if len(path) < 2: return path, rad
    if np.linalg.norm(path[-1] - c) < np.linalg.norm(path[0] - c): path, rad = path[::-1], rad[::-1]
    i = np.argmin(np.linalg.norm(path - c, axis=1)); path, rad = path[i:], rad[i:]
    s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)]); k = s <= length
    return path[k], rad[k]

def spline(path, rad, step=1.5, smooth=4.0):
    """A smoothing spline through a centreline (the skeleton steps voxel by voxel), resampled every step mm."""
    from scipy.interpolate import splprep, splev
    s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)])
    keep = np.r_[True, np.diff(s) > 1e-6]; path, rad, s = path[keep], rad[keep], s[keep]
    if len(path) < 5: return path, rad
    tck, u = splprep(path.T, u=s / s[-1], s=len(path) * smooth, k=3)
    n = max(5, int(s[-1] / step)); uu = np.linspace(0, 1, n)
    P = np.array(splev(uu, tck)).T
    r = np.interp(uu, s / s[-1], np.convolve(np.r_[[rad[0]] * 3, rad, [rad[-1]] * 3], np.ones(7) / 7, 'valid'))
    return P, r

def join(c, d, r0, path, rad, blend=25.0):
    """Replace the path's first blend mm by a curve leaving the stub's end c along d and meeting the path along
    its own direction (cubic Hermite), the radius going from the stub's to the path's."""
    s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)])
    j = int(np.searchsorted(s, blend)); j = min(max(j, 2), len(path) - 2)
    p1 = path[j]; t1 = path[j + 1] - path[j - 1]; t1 /= np.linalg.norm(t1)
    L = np.linalg.norm(p1 - c) * 0.6; t = np.linspace(0, 1, j + 1)[:, None]
    h00, h10, h01, h11 = 2*t**3 - 3*t**2 + 1, t**3 - 2*t**2 + t, -2*t**3 + 3*t**2, t**3 - t**2
    H = h00 * c + h10 * L * d + h01 * p1 + h11 * L * t1
    rr = r0 + (rad[j] - r0) * (3 * t[:, 0]**2 - 2 * t[:, 0]**3)
    return np.vstack([H, path[j + 1:]]), np.r_[rr, rad[j + 1:]]

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
    rng = np.random.default_rng(3); out = []; nrm = []
    for el in els:
        v, f = read_obj(os.path.join(OBJ, el + '.obj')); v = v.astype('f8')
        a = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1) / 2
        n = int(a.sum() * per_mm2); i = rng.choice(len(f), n, p=a / a.sum()); r = rng.random((n, 2)); m = r.sum(1) > 1; r[m] = 1 - r[m]
        out.append(v[f[i, 0]] + r[:, :1] * (v[f[i, 1]] - v[f[i, 0]]) + r[:, 1:] * (v[f[i, 2]] - v[f[i, 0]]))
        fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
        nrm.append(fn[i])
    # each point keeps its triangle's normal: a slice keeps the wall (normals across the vessel) and drops the
    # caps that close each BodyParts3D element where it meets the next (normals along it)
    global NORMALS
    NORMALS = np.vstack(nrm)
    return warp(np.vstack(out))

def save(pid, V, F, name, group, extra=None):
    z = np.zeros_like(V)
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=z.astype('f4'), afill=z.astype('f4'))
    json.dump({'name': name, 'tissue': 'artery_wall' if group == 'great_arteries' else 'vein_wall', 'group': group,
               'mount': 'body', **(extra or {})}, open(f'work/parts/{pid}.json', 'w'), indent=1)

if __name__ == '__main__':
    os.makedirs('work/parts', exist_ok=True)
    for f in glob.glob('work/parts/ves_*'): os.remove(f)
    built = {}; CUTS.clear(); SCALE = {}; RMED = {}
    for v in P['vessels']:
        if 'stub' in v:   # continues a CT stub
            c, d, r0 = stub_end(v['stub'], v.get('ring'))
            path, rad = centreline(v['bp3d'], c)
            # from the stub outwards: drop what lies back towards the heart, keep the requested length
            path, rad = clip_path(path, rad, c, d, v['length'])
            # BodyParts3D is one smaller man: its taper, scaled to the CT stub's radius where they meet
            k = max(r0, 4.0) / np.median(rad[:max(4, len(rad) // 4)]) if len(rad) > 4 else 1.0
            k = float(np.clip(k, 0.8, 2.2)); SCALE[v['id']] = k   # one adult's vessels to another's: never more than about twice
            if len(rad) > 4: rad = np.clip(rad * k, 0.3 * r0, 1.1 * r0)
            if len(path) < 3: print('!', v['id'], 'trace failed'); continue
            path, rad = spline(path, rad)
            path, rad = join(c, d, max(r0, 4.0), path, rad)
        else:             # a branch: starts inside its parent's wall, at BodyParts3D's own start nearest the parent
            par = built[v['from']]
            bc = np.vstack([warp(read_obj(os.path.join(OBJ, el + '.obj'))[0]) for el in v['bp3d']]).mean(0)
            path, rad = centreline(v['bp3d'], par[np.argmin(np.linalg.norm(par - bc, axis=1))])
            # start where the branch leaves its parent's centreline
            t = cKDTree(par); i0 = np.argmin(t.query(path)[0] - rad)
            path, rad = clip_path(path[i0:], rad[i0:], path[i0], path[min(i0 + 3, len(path) - 1)] - path[i0], v['length'])
            rad = rad * SCALE.get(v['from'], 1.0); SCALE[v['id']] = SCALE.get(v['from'], 1.0)   # the same body scale as its parent
            rad = np.minimum(rad, 0.9 * RMED[v['from']])                                        # never wider than its parent
            if len(path) < 3: print('!', v['id'], 'trace failed'); continue
        if 'stub' not in v: path, rad = spline(path, rad)
        Vt, Ft = wall_tube(path, rad, v['wall'])
        save('ves_' + v['id'], Vt, Ft, v['name'], v['group'])
        built[v['id']] = path; RMED[v['id']] = float(np.median(rad))
        if 'stub' in v and v.get('ring'): Vt, Ft = wall_tube(np.vstack([path[0] - d * 1.0, path]), np.r_[rad[0], rad], v['wall'])
        save('ves_' + v['id'], Vt, Ft, v['name'], v['group'])
        print(f"{v['name']:32s} {len(path) * 2:4d} mm, radius {rad.min():.1f}-{rad.max():.1f} mm")
    json.dump(CUTS, open('work/vessel_cuts.json', 'w'))
