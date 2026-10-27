"""Shared geometry for the heart builders: the valve rings, frames, and small mesh helpers (mm, CT frame:
x to the patient's left, y to the back, z up)."""
import json, numpy as np, pyvista as pv
from scipy.spatial import cKDTree

W = None
def walls():
    global W
    if W is None: W = dict(np.load('work/walls.npz'))
    return W

def mesh(name):
    w = walls(); v, f = w[name + '_v'], w[name + '_f']
    return pv.PolyData(v, np.hstack([np.full((len(f), 1), 3), f]).ravel())

# which way each valve's normal points: from the inflow chamber into the outflow one
FLOW = {'mv': ('la', 'lv'), 'tv': ('ra', 'rv'), 'av': ('lv', 'aorta'), 'pv': ('rv', 'pa')}

def valve_frame(v):
    """Centre, unit normal (downstream), in-plane axes e1, e2 of a CT valve plane."""
    d = pv.read(f'work/surf_{v}_plane.vtp'); P = np.asarray(d.points, 'f8'); c = P.mean(0)
    _, _, Vt = np.linalg.svd(P - c); n = Vt[2]
    down = np.asarray(pv.read(f'work/surf_{FLOW[v][1]}.vtp').points).mean(0)
    if n @ (down - c) < 0: n = -n
    e1 = Vt[0] - (Vt[0] @ n) * n; e1 /= np.linalg.norm(e1); e2 = np.cross(n, e1)
    return c, n, e1, e2, P

def ring(v, nb=96):
    """The annulus: for each of nb angles about the valve's centre, the outermost point of the CT valve
    plane (where it meets the wall), at the middle of the plane's thickness. Returns (nb, 3) points
    ordered by angle, the angles, and the frame."""
    c, n, e1, e2, P = valve_frame(v)
    q = P - c; x, y, h = q @ e1, q @ e2, q @ n
    th = np.arctan2(y, x); r = np.hypot(x, y)
    edges = np.linspace(-np.pi, np.pi, nb + 1); out = []
    for k in range(nb):
        m = (th >= edges[k]) & (th < edges[k + 1])
        if m.sum() < 3: out.append(None); continue
        rr = r[m]; sel = rr > rr.max() - 1.0
        out.append([rr[sel].mean(), h[m][sel].mean()])
    a = (edges[:-1] + edges[1:]) / 2
    ok = np.array([o is not None for o in out])
    rh = np.array([o if o is not None else [np.nan, np.nan] for o in out])
    for j in range(2):   # fill gaps, then smooth round the ring
        rh[~ok, j] = np.interp(a[~ok], a[ok], rh[ok, j], period=2 * np.pi)
        k = np.exp(-np.arange(-3, 4)**2 / 4.0); k /= k.sum()
        rh[:, j] = np.convolve(np.r_[rh[-3:, j], rh[:, j], rh[:3, j]], k, 'valid')
    pts = c + np.outer(rh[:, 0] * np.cos(a), e1) + np.outer(rh[:, 0] * np.sin(a), e2) + np.outer(rh[:, 1], n)
    return pts, a, (c, n, e1, e2)

def angle_of(p, frame):
    c, n, e1, e2 = frame; q = np.atleast_2d(p) - c
    return np.arctan2(q @ e2, q @ e1)

def bp3d_warped():
    return dict(np.load('work/warped.npz')), json.load(open('work/bp3d.json'))

def tri_grid(nu, nw, closed_u=False):
    """Faces of an nu x nw vertex grid (index u * nw + w)."""
    f = []
    U = nu if closed_u else nu - 1
    for i in range(U):
        i2 = (i + 1) % nu
        for j in range(nw - 1):
            a, b, c_, d = i * nw + j, i2 * nw + j, i2 * nw + j + 1, i * nw + j + 1
            f += [[a, b, c_], [a, c_, d]]
    return np.array(f, 'i4')

def thicken(S, t, nu, nw):
    """A closed thin solid from a grid surface S (nu*nw, 3) of thickness t: two faces at +-t/2 along the
    grid's normals, joined round all four edges. Works for any state of S with the same topology."""
    G = S.reshape(nu, nw, 3)
    du = np.gradient(G, axis=0); dw = np.gradient(G, axis=1)
    N = np.cross(du, dw); N /= np.linalg.norm(N, axis=2, keepdims=True) + 1e-12
    top, bot = (G + N * t / 2).reshape(-1, 3), (G - N * t / 2).reshape(-1, 3)
    f = tri_grid(nu, nw); n = nu * nw
    faces = [f, f[:, ::-1] + n]
    def edge(idx):   # strip joining top and bottom along an ordered list of grid indices
        e = []
        for a, b in zip(idx[:-1], idx[1:]):
            e += [[a, b, b + n], [a, b + n, a + n]]
        return np.array(e, 'i4')
    W_ = nw
    faces += [edge([i * W_ for i in range(nu)])[:, ::-1], edge([i * W_ + nw - 1 for i in range(nu)]),
              edge([j for j in range(nw)]), edge([(nu - 1) * W_ + j for j in range(nw)])[:, ::-1]]
    return np.vstack([top, bot]), np.vstack(faces)

MOUNT = {'lv': [1], 'rv': [2], 'la': [3, 18, 19, 20, 21, 22, 11, 12, 13, 14, 15], 'ra': [4, 23, 24, 16, 17],
         'aorta': [5], 'pa': [6], 'ventricles': [1, 2], 'atria': [3, 4, 18, 19, 20, 21, 22, 23, 24],
         'mv': [7], 'tv': [8], 'av': [9], 'pv': [10], 'heart': list(range(1, 25))}
_mo = None
def motion_at(X, mount):
    """The beat's two displacement fields (vsys, afill) at points X, taken from the nearest CT point of the
    part they are mounted on."""
    global _mo
    if _mo is None:
        import pyvista as pv
        mo = dict(np.load('work/motion.npz')); mo['P'] = np.asarray(pv.read('work/average.vtu').points); mo['trees'] = {}
        # only points on the surface of some part: a vertex must not take an inner point's motion
        surf = np.vstack([pv.read(f'work/surf_{k}.vtp').points for k in ['lv', 'rv', 'la', 'ra', 'aorta', 'pa',
                          'mv_plane', 'tv_plane', 'av_plane', 'pv_plane']])
        d, i = cKDTree(mo['P']).query(surf); mo['onsurf'] = np.zeros(len(mo['P']), bool); mo['onsurf'][i[d < 1e-3]] = True
        _mo = mo
    key = mount if isinstance(mount, str) else tuple(mount)
    labs = MOUNT[mount] if isinstance(mount, str) else mount
    if key not in _mo['trees']:
        sel = np.where(np.isin(_mo['label'], labs) & _mo['onsurf'])[0]; _mo['trees'][key] = (cKDTree(_mo['P'][sel]), sel)
    t, sel = _mo['trees'][key]; _, i = t.query(X)
    return _mo['vsys'][sel[i]], _mo['afill'][sel[i]]

_cav = {}
def cavity_motion(X, side):
    """The beat's displacement (vsys, afill) at points inside a ventricle's cavity: interpolated from the inner
    surface of its walls round it (inverse distance, cubed, over the 48 nearest wall points), so whatever is in
    the cavity is carried along by the walls and the walls can never pass through it."""
    if side not in _cav:
        w = walls(); sel = w[side + '_uvc'][:, 0] < 0.05
        if side == 'rv':   # the RV's cavity is also bounded by the septum, which is LV muscle
            u = w['lv_uvc']; sept = (u[:, 0] > 0.95) & (np.abs(u[:, 1]) < 0.9)
            P = np.vstack([w['rv_v'][sel], w['lv_v'][sept]])
        else:
            P = w['lv_v'][sel]
        vs, af = motion_at(P, 'heart'); _cav[side] = (cKDTree(P), vs, af)
    t, vs, af = _cav[side]; d, i = t.query(X, 48)
    wgt = 1 / np.maximum(d, 0.5) ** 3; wgt /= wgt.sum(1, keepdims=True)
    return (vs[i] * wgt[..., None]).sum(1), (af[i] * wgt[..., None]).sum(1)
