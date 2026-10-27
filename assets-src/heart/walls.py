"""The heart's walls from the CT average: each part's closed surface, reduced to its triangle budget.

Each vertex keeps the ventricular coordinates (rho, phi, Z, V; -10 outside the ventricles) and the fibre
direction of the nearest point of the full-resolution surface: the beat (motion.py) and the details
(endo.py, conduction.py) are placed with them.

Out: work/walls.npz with <part>_v (mm, CT frame), <part>_f, <part>_uvc (n x 4), <part>_fib (n x 3)
"""
import numpy as np, pyvista as pv, fast_simplification as fs
from scipy.spatial import cKDTree

BUDGET = {'lv': 36000, 'rv': 30000, 'la': 20000, 'ra': 20000, 'aorta': 9000, 'pa': 6000}
out = {}
for name, n in BUDGET.items():
    s = pv.read(f'work/surf_{name}.vtp')
    v, f = np.asarray(s.points), s.faces.reshape(-1, 4)[:, 1:]
    v2, f2 = fs.simplify(v.astype('f4'), f.astype('i4'), target_reduction=1 - n / len(f))
    m2 = pv.PolyData(v2, np.hstack([np.full((len(f2), 1), 3), f2]).ravel()).clean()
    m2 = m2.smooth_taubin(n_iter=10, pass_band=0.1)
    _, i = cKDTree(v).query(m2.points)
    uvc = np.stack([s.point_data[k][i] for k in ['RHO.dat', 'PHI.dat', 'Z.dat', 'V.dat']], 1)
    out[f'{name}_v'] = np.asarray(m2.points, 'f4'); out[f'{name}_f'] = m2.faces.reshape(-1, 4)[:, 1:].astype('i4')
    out[f'{name}_uvc'] = uvc.astype('f4'); out[f'{name}_fib'] = s.point_data['fibre'][i].astype('f4')
    err = cKDTree(v).query(m2.points)[0]
    print(f'{name:6s} {len(f):7d} -> {m2.n_cells:6d} tris, vertex offset mean {err.mean():.2f} max {err.max():.2f} mm, vol {abs(m2.volume)/1000:.1f} cm3')
np.savez_compressed('work/walls.npz', **out)
