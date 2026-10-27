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
SECTION = {}
ROOT = {}
def root_sections(name, rc, ax, h_top, step=1.5):
    """The CT stub's cross-sections from its foot (where it meets the ventricle) up to the cut, every step mm:
    for each, the centre and the outline's points (outer and inner surfaces)."""
    M_ = H.mesh(name); S = np.asarray(M_.points); pr = (S - rc) @ ax
    out = []
    for h in np.arange(pr.min() + 0.6, h_top, step):
        sl = np.asarray(M_.slice(normal=ax, origin=rc + ax * h).points)
        if len(sl) > 20: out.append((rc + ax * h, sl))
    return out

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
    # the stub's cross-section in the cut plane: its outer loop's middle is where the continuing tube starts
    sl = np.asarray(H.mesh(name).slice(normal=ax, origin=rc + ax * h).points)
    c = sl.mean(0)
    rr = np.linalg.norm((sl - c) - np.outer((sl - c) @ ax, ax), axis=1)
    CUTS[name] = (c.tolist(), ax.tolist())
    SECTION[name] = sl
    ROOT[name] = root_sections(name, rc, ax, h)
    # the outer loop is the larger half of the section's radii; its mean is the circle the tube eases into
    return c, ax, float(np.mean(np.sort(rr)[len(rr) // 2:]))

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

def profile(points, centre, T0, N0, B0, sides):
    """Outer and inner radius per angle (the tube's angles about N0, B0) of a cross-section's points."""
    q = points - centre; q -= np.outer(q @ T0, T0)
    ang = np.arctan2(q @ B0, q @ N0); rad = np.linalg.norm(q, axis=1)
    bins = np.round((ang % (2 * np.pi)) / (2 * np.pi) * sides).astype(int) % sides
    po, pi_ = np.full(sides, np.nan), np.full(sides, np.nan)
    for k in range(sides):
        r_ = rad[bins == k]
        if len(r_): po[k], pi_[k] = r_.max(), r_.min()
    idx = np.arange(sides); ok = ~np.isnan(po)
    po = np.interp(idx, idx[ok], po[ok], period=sides); pi_ = np.interp(idx, idx[ok], pi_[ok], period=sides)
    return po, np.minimum(pi_, po - 0.6)

def wall_tube(path, r_out, wall, sides=40, start=None, blend=25.0, root=None):
    """A vessel's wall as a closed solid: outer and inner surfaces joined at both ends (the lumen is open).
    start: points of the wall it continues (a CT stub's surface at the cut): the first ring takes their exact
    outline, outer and inner, per angle, and eases into the circle over blend mm, so the join has no step."""
    T, N, B = frames(path); a = np.linspace(0, 2 * np.pi, sides, endpoint=False); L = len(path)
    ro = np.repeat(np.asarray(r_out, 'f8')[:, None], sides, 1); ri = np.maximum(ro - wall, 0.4)
    if start is not None:
        po, pi_ = profile(start, path[0], T[0], N[0], B[0], sides)
        s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)])
        w = np.clip(s / blend, 0, 1); w = (w * w * (3 - 2 * w))[:, None]
        ro = po[None] * (1 - w) + ro * w; ri = pi_[None] * (1 - w) + ri * w
    if root:   # rings below the path's start, through the measured sections, in the same frame
        rc_ = np.array([c_ for c_, _ in root]); prof = [profile(p_, c_, T[0], N[0], B[0], sides) for c_, p_ in root]
        path = np.vstack([rc_, path]); N = np.vstack([np.repeat(N[:1], len(root), 0), N]); B = np.vstack([np.repeat(B[:1], len(root), 0), B])
        ro = np.vstack([np.array([p_[0] for p_ in prof]), ro]); ri = np.vstack([np.array([p_[1] for p_ in prof]), ri]); L = len(path)
    ring = lambda r: (path[:, None, :] + r[:, :, None] * (np.cos(a)[None, :, None] * N[:, None, :] + np.sin(a)[None, :, None] * B[:, None, :])).reshape(-1, 3)
    out, inn = ring(ro), ring(ri); n = len(out)
    F = []
    for i in range(L - 1):
        for j in range(sides):
            p, q_ = i * sides + j, i * sides + (j + 1) % sides
            F += [[p, q_, q_ + sides], [p, q_ + sides, p + sides]]
            F += [[n + p, n + q_ + sides, n + q_], [n + p, n + p + sides, n + q_ + sides]]
    for i, flip in [(0, True), (L - 1, False)]:
        for j in range(sides):
            p, q_ = i * sides + j, i * sides + (j + 1) % sides
            f = [[p, n + p, n + q_], [p, n + q_, q_]]
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

def tube_motion(V, path, sides, start_vs, start_af, fade):
    """A vessel moves with what it leaves (its first ring takes the motion of the wall or vessel it continues),
    less and less along its length: none beyond fade mm. V is wall_tube's layout (outer rings, then inner)."""
    L = len(path); s = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)])
    f = np.clip(1 - s / fade, 0, 1); f = f * f * (3 - 2 * f)
    # it follows the wall exactly where it joins it, then moves as a whole (the ring's mean) within 8 mm, so the
    # wall's uneven twist and squeeze don't wrinkle it
    b = np.clip(s / 8.0, 0, 1); b = b * b * (3 - 2 * b)
    def field(st):
        ring = st[None] * (1 - b)[:, None, None] + st.mean(0)[None, None] * b[:, None, None]   # L x sides x 3
        ring = ring * f[:, None, None]
        return np.vstack([ring.reshape(-1, 3), ring.reshape(-1, 3)])
    return field(start_vs), field(start_af)

def save(pid, V, F, name, group, extra=None, vs=None, af=None):
    z = np.zeros_like(V); vs = z if vs is None else vs; af = z if af is None else af
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=vs.astype('f4'), afill=af.astype('f4'))
    json.dump({'name': name, 'tissue': 'artery_wall' if group == 'great_arteries' else 'vein_wall', 'group': group,
               'mount': 'body', **(extra or {})}, open(f'work/parts/{pid}.json', 'w'), indent=1)

if __name__ == '__main__':
    os.makedirs('work/parts', exist_ok=True)
    for f in glob.glob('work/parts/ves_*'): os.remove(f)
    built = {}; CUTS.clear(); SCALE = {}; RMED = {}; MOT = {}; PATHS = {}
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
        built[v['id']] = path; RMED[v['id']] = float(np.median(rad))
        if 'stub' in v and v.get('ring'):   # starts on the square cut, in the cut's own outline
            name = {5: 'aorta', 6: 'pa'}[v['stub']]; cc, axc = map(np.array, CUTS[name])
            Vt, Ft = wall_tube(path, rad, v['wall'], start=SECTION[name], root=ROOT[name])
            path = np.vstack([np.array([c_ for c_, _ in ROOT[name]]), path])   # the tube now starts at the stub's foot
        sides = 40; fade = P['fade_artery'] if v['group'] == 'great_arteries' else P['fade_vein']
        if 'stub' in v:      # the wall it continues, at its first ring
            mount = {5: 'aorta', 6: 'pa'}.get(v['stub'], 'heart')
            s_vs, s_af = H.motion_at(Vt[:sides], mount)
        else:                # its parent, where it leaves it
            (pvs, paf), pp = MOT[v['from']]; j = np.argmin(np.linalg.norm(pp - path[0], axis=1))
            s_vs, s_af = np.tile(pvs[j], (sides, 1)), np.tile(paf[j], (sides, 1))
        vs, af = tube_motion(Vt, path, sides, s_vs, s_af, fade)
        n1 = len(path) * sides
        MOT[v['id']] = ((vs[:n1].reshape(len(path), sides, 3).mean(1), af[:n1].reshape(len(path), sides, 3).mean(1)), path)
        save('ves_' + v['id'], Vt, Ft, v['name'], v['group'], vs=vs, af=af)
        PATHS[v['id'] + '_path'] = path; PATHS[v['id'] + '_rad'] = np.r_[np.full(len(path) - len(rad), rad[0]), rad] - v['wall']
        print(f"{v['name']:32s} {len(path) * 2:4d} mm, radius {rad.min():.1f}-{rad.max():.1f} mm")
    json.dump(CUTS, open('work/vessel_cuts.json', 'w'))
    np.savez_compressed('work/vessel_paths.npz', **PATHS)
