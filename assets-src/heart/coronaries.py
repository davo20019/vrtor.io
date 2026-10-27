"""The coronary arteries and cardiac veins, from BodyParts3D carried onto the CT heart, laid on its surface.

The warp leaves them about 2 mm off: many sink half into the muscle. Each vessel is pushed out along the outer
surface's normal until its whole cross-section lies outside the tissue, 0.3 mm clear (they run in the fat on
the heart's surface); the push is shared across each cross-section and smoothed along the vessel, so the
vessel keeps its shape. Near a coronary ostium the trunk is left where it is, opening into the aorta.

Out: work/parts/cor_<el>.npz (+ .json); one part per BodyParts3D element, with its /bdy name.
"""
import json, os, numpy as np, pyvista as pv
from scipy.spatial import cKDTree
import heartgeo as H

CLEAR = 0.3
w, info = H.bp3d_warped()
m = pv.read('work/average.vtu'); tissue = np.isin(m.cell_data['ID'], [1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24])
outer = m.extract_cells(tissue).extract_surface(algorithm='dataset_surface').triangulate()
cc = outer.connectivity('largest').compute_normals(auto_orient_normals=True, point_normals=True)
OP, ON = np.asarray(cc.points), np.asarray(cc.point_normals); OT = cKDTree(OP)
ostia = [H.valve_frame('av')[0]]
for el in ['FJ2737', 'FJ2723']:
    v = w[el + '_v']; ostia.append(v[np.argsort(np.linalg.norm(v - ostia[0], axis=1))[:30]].mean(0))
ostia = np.array(ostia[1:])

def depth(X):
    """Signed distance to the outer surface along its normal (negative: inside the tissue)."""
    d, i = OT.query(X); return ((X - OP[i]) * ON[i]).sum(1), ON[i]

os.makedirs('work/parts', exist_ok=True); report = []
for el, d in info.items():
    if d['tissue'] not in ('artery', 'vein'): continue
    V, F = w[el + '_v'].astype('f8'), w[el + '_f']
    keep = np.linalg.norm(V[:, None] - ostia[None], axis=2).min(1) < 4.0          # trunks stay open into the aorta
    before = (depth(V)[0] < 0).mean()
    for _ in range(12):
        dep, nrm = depth(V)
        # the cross-section: vertices within 2.5 mm share the push their deepest member needs
        t = cKDTree(V); push = np.zeros(len(V))
        need = np.maximum(0, CLEAR - dep)
        for k, nb in enumerate(t.query_ball_point(V, 2.5)): push[k] = need[nb].max()
        push[keep] = 0
        if push.max() < 0.05: break
        V = V + nrm * push[:, None] * 0.8
    after = (depth(V)[0] < 0).mean()
    vs, af = H.motion_at(V, 'heart')
    pid = f'cor_{el}'
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=vs, afill=af)
    json.dump({'name': d['name'], 'tissue': d['tissue'], 'group': 'coronary_' + ('arteries' if d['tissue'] == 'artery' else 'veins'),
               'path': d['path'], 'mount': 'heart', 'bp3d': el}, open(f'work/parts/{pid}.json', 'w'), indent=1)
    report.append((d['name'], before, after))
print(f'{len(report)} vessels; share of vertices inside the tissue, before -> after:')
for nm, b, a in sorted(report, key=lambda r: -r[2])[:8]: print(f'  {nm[:60]:60s} {b:.0%} -> {a:.0%}')
print('  mean', f'{np.mean([r[1] for r in report]):.0%} -> {np.mean([r[2] for r in report]):.0%}')
