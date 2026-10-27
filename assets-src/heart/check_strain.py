"""How smooth the beat is: per-edge displacement difference over edge length (a strain-like number) on each
full-resolution wall surface, at end-systole. Heart muscle strains 20 to 40%; above 100% means a tear."""
import numpy as np, pyvista as pv
from scipy.spatial import cKDTree
mo = np.load('work/motion.npz'); P = np.asarray(pv.read('work/average.vtu').points); T = cKDTree(P)
D = mo['vsys'] + mo['afill']
for k in ['lv', 'rv', 'la', 'ra', 'aorta', 'pa']:
    s = pv.read(f'work/surf_{k}.vtp'); _, i = T.query(s.points)
    f = s.faces.reshape(-1, 4)[:, 1:]; e = np.vstack([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    st = np.linalg.norm(D[i][e[:, 0]] - D[i][e[:, 1]], axis=1) / np.linalg.norm(s.points[e[:, 0]] - s.points[e[:, 1]], axis=1)
    L = np.linalg.norm(s.points[e[:, 0]] - s.points[e[:, 1]], axis=1); jump = st * L; ok = L > 0.5
    print(f'{k:6s} edges>0.5mm strain 50/95/99 {np.percentile(st[ok], [50, 95, 99]).round(2)}  jumps >1mm: {(jump > 1).sum()}  >2mm: {(jump > 2).sum()}  median edge {np.median(L):.2f}')
    continue
    print(f'{k:6s} strain 50/95/99/max {np.percentile(st, [50, 95, 99]).round(2)} {st.max():.1f}')
