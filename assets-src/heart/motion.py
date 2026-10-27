"""The beat, as displacement fields on the CT heart's full-resolution points, calibrated on chamber volumes.

Two fields, each the displacement from end-diastole (the CT's own state, the rest pose) when its weight is 1:

  vsys   the ventricles at end-systole. Ventricles: the base descends towards the apex (mitral and tricuspid
         annular plane systolic excursion, growing from 0 at the apex to the full value at the base), the
         wall moves in towards the LV's long axis (more on the inside than the outside, so it thickens) and
         twists (the apex one way, the base the other, seen down the long axis). Atria, aorta and pulmonary
         trunk follow their valve ring, less and less further from it.
  afill  the atria filled to their largest volume: they swell outwards from their centres, not at their
         valve ring (that moves with the ventricles).

Calibration: the inward motion of the LV's inner surface is solved so the LV holds its published end-systolic
volume, and the outer surface's so the LV's muscle keeps its volume (muscle is nearly incompressible); the
RV's likewise; each atrium's swelling so it holds its published largest volume at end-systole.

Then the electrical activation time of every point (eikonal on the tetrahedra's edges, with the published
conduction velocities): from the SA node through the atria, the AV node's delay, the His bundle, the
fast subendocardial Purkinje layer from the published earliest sites, and out through the wall.

Out: work/motion.npz: vsys, afill (n x 3, mm) and act (ms) for every CT point; label per point
"""
import json, numpy as np, pyvista as pv
from scipy import sparse
from scipy.sparse.csgraph import dijkstra
import cavities

M = json.load(open('motion_params.json'))
m = cavities.tets()
P = np.asarray(m.points, 'f8'); n = len(P)
uvc = np.stack([m.point_data[k] for k in ['RHO.dat', 'PHI.dat', 'Z.dat', 'V.dat']], 1)
cells = m.cells.reshape(-1, 5)[:, 1:]; tag = m.cell_data['ID']
label = np.zeros(n, 'i4')
for t in [3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24, 11, 12, 13, 14, 15, 16, 17, 7, 8, 9, 10, 2, 1]:   # ventricles win at shared points
    label[cells[tag == t].ravel()] = t
VENT = uvc[:, 2] > -1
LA = np.isin(label, [3, 18, 19, 20, 21, 22, 11, 12, 13, 14, 15]); RA = np.isin(label, [4, 23, 24, 16, 17])
AO, PA = label == 5, label == 6
CAPS = np.isin(label, [11, 12, 13, 14, 15, 16, 17])

# edges of the tetrahedra, for smoothing and for the activation
e = np.vstack([cells[:, [i, j]] for i in range(4) for j in range(i + 1, 4)]); e = np.unique(np.sort(e, 1), axis=0)
elen = np.linalg.norm(P[e[:, 0]] - P[e[:, 1]], axis=1)
A = sparse.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), (n, n)); A = (A + A.T).tocsr()
deg = np.asarray(A.sum(1)).ravel()
def smooth(D, it):
    for _ in range(it): D = 0.5 * D + 0.5 * (A @ D) / deg[:, None]
    return D

# LV long axis
lvp = VENT & (uvc[:, 3] < 0)
apex = P[lvp & (uvc[:, 2] < 0.02)].mean(0); base = P[lvp & (uvc[:, 2] > 0.97)].mean(0)
ax = (base - apex) / np.linalg.norm(base - apex)

def rotate(X, axis, ang):   # Rodrigues, about a line through apex
    q = X - apex; c, s = np.cos(ang), np.sin(ang)
    return apex + q * c[:, None] + np.cross(axis, q) * s[:, None] + np.outer(q @ axis, axis) * (1 - c)[:, None]

# the RV free wall moves towards the septum (its 'bellows' motion): each RV point's direction is to its
# nearest point on the septum's RV face
from scipy.spatial import cKDTree as _T
_sept = P[VENT & (uvc[:, 3] < 0) & (uvc[:, 0] > 0.95) & (np.abs(uvc[:, 1]) < 0.8)]
_rvp = VENT & (uvc[:, 3] > 0)
_to = np.zeros((n, 3)); _d, _i = _T(_sept).query(P[_rvp]); _to[_rvp] = (_sept[_i] - P[_rvp]) / (_d[:, None] + 1e-9)
_dsept = np.zeros(n); _dsept[_rvp] = _d
# the nearest septal point jumps from one point to the next: smooth the direction and distance over the RV
_W = sparse.diags(_rvp.astype(float)) @ A @ sparse.diags(_rvp.astype(float)); _dg = np.maximum(np.asarray(_W.sum(1)).ravel(), 1)
for _ in range(40):
    _to = np.where(_rvp[:, None], 0.5 * _to + 0.5 * (_W @ _to) / _dg[:, None], 0)
    _dsept = np.where(_rvp, 0.5 * _dsept + 0.5 * (_W @ _dsept) / _dg, 0)
_to /= np.linalg.norm(_to, axis=1, keepdims=True) + 1e-9
# where the RV wall joins the LV (its insertions), the pulmonary trunk or the atrium, it moves as they do: its
# own inward motion fades in over a few millimetres from those joins
_in = lambda t: np.unique(cells[tag == t].ravel())
_join = np.intersect1d(_in(2), np.concatenate([_in(1), _in(4), _in(23), _in(24)]))
# the outflow tract (infundibulum) squeezes towards its own axis, the line through the pulmonary valve, not
# towards the septum; the weight passes from one to the other with distance from the pulmonary ring
_pvp = P[_in(10)]; _pvc = _pvp.mean(0); _pvn = np.linalg.svd(_pvp - _pvc)[2][2]
_q = P - _pvc; _rad = _q - np.outer(_q @ _pvn, _pvn); _dax = np.linalg.norm(_rad, axis=1)
_wo = np.zeros(n); _wo[_rvp] = np.exp(-(np.linalg.norm(_q[_rvp], axis=1) / M['outflow_reach']) ** 2)
_dir = (1 - _wo)[:, None] * (-_to) + _wo[:, None] * (_rad / (_dax[:, None] + 1e-9))
_to = -_dir / (np.linalg.norm(_dir, axis=1, keepdims=True) + 1e-9); _to[~_rvp] = 0
_dsept = (1 - _wo) * _dsept + _wo * _dax
_fade = np.ones(n); _fade[_rvp] = 1 - np.exp(-(_T(P[_join]).query(P[_rvp])[0] / M['rv_join_fade']) ** 2)

def ventricles(d_endo_lv, d_epi_lv, d_endo_rv, d_epi_rv):
    D = np.zeros((n, 3)); rho, phi, Z, V = uvc[VENT].T; X = P[VENT]
    q = X - apex; radial = q - np.outer(q @ ax, ax); r = np.linalg.norm(radial, axis=1); rhat = radial / (r[:, None] + 1e-9)
    lv = V < 0
    rhat = np.where(lv[:, None], rhat * (r / (r + M['axis_fade']))[:, None], -_to[VENT])   # LV: none on the axis itself
    g = np.clip(np.sin(np.pi * (0.15 + 0.85 * Z)), 0.35, 1)          # less inward motion at the apex and base rim
    long = -np.where(lv, M['mapse'], M['mapse'] + (M['tapse'] - M['mapse']) * _fade[VENT]) * Z
    # the septum thickens into the LV: its RV face (the LV's outside there) barely moves
    sept = np.exp(-(phi / M['septum_width']) ** 2)
    epi_lv = d_epi_lv * (1 - sept)
    # RV: a fraction of each point's distance to the septum (d_*_rv are fractions)
    inward = np.where(lv, d_endo_lv * (1 - rho) + epi_lv * rho, (d_endo_rv * (1 - rho) + d_epi_rv * rho) * _dsept[VENT] * _fade[VENT]) * g
    twist = np.radians(M['twist_apex'] * (1 - Z) + M['twist_base'] * Z)
    D[VENT] = long[:, None] * ax - inward[:, None] * rhat + (rotate(X, -ax, twist) - X)
    return D

# atria, aorta and pulmonary trunk are continuous tissue: their motion is the smooth (harmonic) interpolation
# between the ventricles, wherever they touch, and the vessels' far ends, held where the body holds them
from scipy.sparse.linalg import splu
_ends = CAPS.copy()
for _part, _ring in [(AO, 9), (PA, 10)]:      # the cut end of each artery: its points furthest from its valve
    _rc = P[np.unique(cells[tag == _ring].ravel())].mean(0); _d = np.linalg.norm(P - _rc, axis=1)
    _ends |= _part & (_d > np.percentile(_d[_part], 97))
# the ventricles' surfaces (inside and outside of the walls, and their rims): the rules set the motion there
_vs = m.extract_cells(np.isin(tag, [1, 2])).extract_surface(algorithm='dataset_surface').triangulate()
_vsub = m.extract_cells(np.isin(tag, [1, 2]))
_vid = _vsub.point_data['vtkOriginalPointIds'][_vs.point_data['vtkOriginalPointIds']]
_vf = _vid[_vs.faces.reshape(-1, 4)[:, 1:]]
_SURF = np.zeros(n, bool); _SURF[_vf.ravel()] = True
_se = np.vstack([_vf[:, [0, 1]], _vf[:, [1, 2]], _vf[:, [2, 0]]])
_SA = sparse.coo_matrix((np.ones(len(_se)), (_se[:, 0], _se[:, 1])), (n, n)); _SA = ((_SA + _SA.T) > 0).astype(float).tocsr()
_sdeg = np.maximum(np.asarray(_SA.sum(1)).ravel(), 1)

def surface_smooth(D, it):
    """Smooth along the ventricles' surfaces only (the inside and outside of a wall are separate surfaces)."""
    for _ in range(it): D = np.where(_SURF[:, None], 0.5 * D + 0.5 * (_SA @ D) / _sdeg[:, None], D)
    return D

_known = _SURF | _ends
_Lap = (sparse.diags(deg) - A).tocsr()
_U = np.where(~_known)[0]; _K = np.where(_known)[0]
_solve = splu(_Lap[_U][:, _U].tocsc())
_LUK = _Lap[_U][:, _K]

def follow_rings(D):
    """Everything off the ventricles' surfaces (inside the walls, atria, valve planes, vessels): harmonic
    between the surfaces' motion and the vessels' ends."""
    out = surface_smooth(D, M['surface_smooth']); out[_ends] = 0
    rhs = -(_LUK @ out[_K])
    out[_U] = np.stack([_solve.solve(rhs[:, j]) for j in range(3)], 1)
    return out

def atria(amp_la, amp_ra):
    from scipy.spatial import cKDTree
    D = np.zeros((n, 3))
    for part, amp, ring in [(LA, amp_la, 7), (RA, amp_ra, 8)]:
        c = P[part].mean(0); q = P[part] - c; dirn = q / np.linalg.norm(q, axis=1, keepdims=True)
        ringpts = np.unique(cells[tag == ring].ravel())
        d = cKDTree(P[ringpts]).query(P[part])[0]
        # zero at the valve ring (it moves with the ventricles) and at the vein mouths (the veins are held there)
        caps = np.unique(cells[np.isin(tag, [11, 12, 13, 14, 15, 16, 17])].ravel())
        dc = cKDTree(P[caps]).query(P[part])[0]
        D[part] = amp * dirn * ((1 - np.exp(-(d / M['follow_falloff_atrium']) ** 2)) * (1 - np.exp(-(dc / M['vein_hold']) ** 2)))[:, None]
    return D

def vol(D):
    return cavities.fast_volumes(D)

def solve(f, target, lo, hi, it=12):
    """Bisection for f(x) = target, whichever way f runs; fails loudly if the target is outside [lo, hi]."""
    flo, fhi = f(lo) - target, f(hi) - target
    if flo * fhi > 0: raise SystemExit(f'target {target} outside [{f(lo):.1f}, {f(hi):.1f}] for x in [{lo}, {hi}]')
    for _ in range(it):
        mid = (lo + hi) / 2; fm = f(mid) - target
        if fm * flo > 0: lo, flo = mid, fm
        else: hi = mid
    return (lo + hi) / 2

if __name__ == '__main__':
    SM = M['smooth']
    V0 = vol(None); print('end-diastole', {k: round(v, 1) for k, v in V0.items()})
    myo0 = {k: cavities.tet_volume(0, t) for k, t in [('LV', 1), ('RV', 2)]}

    def myo(D, t):
        return cavities.tet_volume(D, t)

    # LV: inner surface for the end-systolic volume, outer for constant muscle volume (two passes)
    de, dp, re, rp = M['guess']['lv_endo'], M['guess']['lv_epi'], M['guess']['rv_endo'], M['guess']['rv_epi']
    for it in range(4):
        de = solve(lambda x: vol(follow_rings(ventricles(x, dp, re, rp)))['LV'], M['lv_esv'], 0, 20, 10)
        dp = solve(lambda x: myo(follow_rings(ventricles(de, x, re, rp)), 1), myo0['LV'], -10, 20, 12)
        re = solve(lambda x: vol(follow_rings(ventricles(de, dp, x, rp)))['RV'], M['rv_esv'], 0, 0.9, 12)
        rp = solve(lambda x: myo(follow_rings(ventricles(de, dp, re, x)), 2), myo0['RV'], -0.5, 0.9, 12)
        print(f'pass {it}: LV endo {de:.2f} epi {dp:.2f} mm, RV endo {re:.2f} epi {rp:.2f} mm')
    Dv = follow_rings(ventricles(de, dp, re, rp))
    Ves = vol(Dv); print('end-systole, ventricles only', {k: round(v, 1) for k, v in Ves.items()})
    al = solve(lambda x: vol(Dv + atria(x, 0))['LA'], M['la_max'], -5, 20, 10)
    ar = solve(lambda x: vol(Dv + atria(al, x))['RA'], M['ra_max'], -5, 20, 10)
    Da = smooth(atria(al, ar), 10)
    Vfull = vol(Dv + Da)
    print(f'atria swell LA {al:.2f} RA {ar:.2f} mm ->', {k: round(v, 1) for k, v in Vfull.items()})
    print('muscle volume LV %.1f -> %.1f, RV %.1f -> %.1f cm3' % (myo0['LV'], myo(Dv, 1), myo0['RV'], myo(Dv, 2)))
    np.savez_compressed('work/motion.npz', vsys=Dv.astype('f4'), afill=Da.astype('f4'), label=label,
                        apex=apex, axis=ax)
    json.dump({'ed': V0, 'es': Vfull, 'lv': [de, dp], 'rv': [re, rp], 'atria': [al, ar]},
              open('work/motion.json', 'w'), indent=1)
