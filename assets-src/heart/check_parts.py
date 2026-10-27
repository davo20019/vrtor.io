"""Where each carried-over part lies in the CT heart: share of its vertices inside each tissue label,
in no tissue (blood or outside), and its median distance to the nearest tissue surface."""
import json, numpy as np, pyvista as pv
from scipy.spatial import cKDTree
m = pv.read('work/average.vtu'); tag = m.cell_data['ID']
w = np.load('work/warped.npz'); info = json.load(open('work/bp3d.json'))
LAB = {1: 'LV', 2: 'RV', 3: 'LA', 4: 'RA', 5: 'Ao', 6: 'PA', 7: 'MVp', 8: 'TVp', 9: 'AVp', 10: 'PVp'}
surf = pv.merge([pv.read(f'work/surf_{n}.vtp') for n in ['lv', 'rv', 'la', 'ra', 'aorta', 'pa']])
st = cKDTree(surf.points)
rows = []
for el, d in info.items():
    if d['tissue'] in ('blood',): continue
    V = w[el + '_v'][::max(1, len(w[el + '_v']) // 400)]
    c = m.find_containing_cell(V); lab = np.where(c >= 0, tag[np.maximum(c, 0)], 0)
    u, n = np.unique(lab, return_counts=True)
    where = ' '.join(f'{LAB.get(k, "none" if k == 0 else k)}:{100 * v // len(V)}%' for k, v in zip(u, n))
    print(f'{d["name"][:58]:58s} {d["tissue"]:7s} {np.median(st.query(V)[0]):5.1f}mm  {where}')
