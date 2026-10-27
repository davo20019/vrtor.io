"""Blood flow: the paths blood takes through the heart, for the app's moving blood.

Right heart: each vena cava -> right atrium -> tricuspid valve -> down the right ventricle's inflow -> up its outflow
tract -> pulmonary valve -> pulmonary trunk -> left or right pulmonary artery. Left heart: each pulmonary vein ->
left atrium -> mitral valve -> down to the apex -> up the outflow tract -> aortic valve -> aorta, to its arch's
branches or down the descending aorta. Every point says which stretch it is on (the app moves blood on each with
that stretch's measured timing and peak velocity), how wide the lumen is there, and how the point moves with
the beat (it is carried by the chambers' walls).

Out: work/flow.json (in the GLB's frame: x left, y up, z front, mm, centred like the model)
"""
import json, numpy as np, pyvista as pv
from scipy.spatial import cKDTree
import heartgeo as H

VP = dict(np.load('work/vessel_paths.npz')); META = json.load(open('work/heart_parts.json'))
CEN = np.array(META['centre_mm'])
m = pv.read('work/average.vtu'); tag = m.cell_data['ID']; P = np.asarray(m.points)
mo = np.load('work/motion.npz'); apex, ax = mo['apex'], mo['axis']
import cavities

def cav_centre(name):
    return P[cavities.cavity_faces(name).ravel()].mean(0)

def cap(t): return P[np.unique(m.cells.reshape(-1, 5)[:, 1:][tag == t].ravel())].mean(0)

def line(a, b, step=2.0):
    n = max(2, int(np.linalg.norm(b - a) / step)); return a + np.linspace(0, 1, n)[:, None] * (b - a)

def curve(*pts, step=2.0):
    """A smooth path through the given points (Catmull-Rom), every step mm."""
    pts = np.array(pts); out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)

def seg(points, kind, radius):
    r = np.broadcast_to(np.asarray(radius, 'f8'), (len(points),)).copy()
    return [(p, kind, rr) for p, rr in zip(points, r)]

def vessel(id_, reverse=False, kind='artery'):
    p, r = VP[id_ + '_path'], VP[id_ + '_rad']
    if reverse: p, r = p[::-1], r[::-1]
    return seg(p, kind, np.maximum(r, 1.0))

# landmarks
ra, la, rv, lv = cav_centre('RA'), cav_centre('LA'), cav_centre('RV'), cav_centre('LV')
tv, mv, av, pv_ = (H.valve_frame(v)[0] for v in ('tv', 'mv', 'av', 'pv'))
tvn, mvn = H.valve_frame('tv')[1], H.valve_frame('mv')[1]
lv_apex = apex + ax * 18                                     # in the cavity, above the apex
rv_low = P[cavities.cavity_faces('RV').ravel()]
rv_low = rv_low[np.argsort((rv_low - apex) @ ax)][: len(rv_low) // 6].mean(0)   # the RV's lowest part of its cavity
rvot = pv_ - H.valve_frame('pv')[1] * 14; lvot = av - H.valve_frame('av')[1] * 14

paths = []
def add(kind, parts):
    pts, k, r = [], [], []
    for p, kk, rr in [x for part in parts for x in part]:
        if pts and np.linalg.norm(p - pts[-1]) < 0.5: continue
        pts.append(p); k.append(kk); r.append(rr)
    paths.append({'blood': kind, 'pts': np.array(pts), 'kind': k, 'r': np.array(r)})

# right heart
right_in = {'svc': vessel('svc', True, 'vein'), 'ivc': vessel('ivc', True, 'vein')}
mouth = {'svc': cap(16), 'ivc': cap(17)}
right_out = {'lpa': vessel('lpa'), 'rpa': vessel('rpa')}
for vin in right_in:
    for vout in right_out:
        pt = vessel('pt')
        add('venous', [right_in[vin], seg(curve(mouth[vin], ra, tv - tvn * 6), 'atrium', 14),
                       seg(curve(tv - tvn * 6, tv + tvn * 10, rv_low), 'v_in', 10),
                       seg(curve(rv_low, rv, rvot, pv_ + H.valve_frame('pv')[1] * 4), 'v_out', 9),
                       pt, right_out[vout]])
# left heart
outs = {'aorta': vessel('aorta'), 'brachiocephalic': vessel('brachiocephalic'), 'lcca': vessel('lcca'), 'lsa': vessel('lsa')}
asc = VP['aorta_path']
for vin, capt in [('lspv', 12), ('lipv', 13), ('ripv', 14), ('rspv', 15)]:
    for o, op in outs.items():
        if o == 'aorta':
            tail = [op]
        else:   # up the ascending aorta to where the branch leaves, then the branch
            j = int(np.argmin(np.linalg.norm(asc - VP[o + '_path'][0], axis=1)))
            tail = [seg(asc[:j + 1], 'artery', np.maximum(VP['aorta_rad'][:j + 1], 1)), op]
        add('arterial', [vessel(vin, True, 'vein'), seg(curve(cap(capt), la, mv - mvn * 6), 'atrium', 14),
                         seg(curve(mv - mvn * 6, mv + mvn * 12, lv_apex), 'v_in', 11),
                         seg(curve(lv_apex, lv, lvot, av + H.valve_frame('av')[1] * 4), 'v_out', 10)] + tail)

# how each point moves with the beat: the motion of the nearest point of the heart (global, not by band)
out = []
for p in paths:
    vs, af = H.motion_at(p['pts'], 'heart')
    far = np.linalg.norm(p['pts'] - P.mean(0), axis=1) > 75      # far along the vessels: still
    vs[far] = 0; af[far] = 0
    g = lambda X: np.c_[X[:, 0], X[:, 2], -X[:, 1]]              # CT/Blender to the GLB's frame
    out.append({'blood': p['blood'], 'pts': np.round(g(p['pts'] - CEN), 2).tolist(), 'kind': p['kind'],
                'r': np.round(p['r'], 2).tolist(), 'dv': np.round(g(vs), 2).tolist(), 'da': np.round(g(af), 2).tolist()})
json.dump({'paths': out, 'note': 'mm, GLB frame, centred like heart.glb; kind: vein, atrium, v_in, v_out, artery'},
          open('work/flow.json', 'w'))
L = [np.sum(np.linalg.norm(np.diff(np.array(p['pts']), axis=0), axis=1)) for p in out]
print(f'{len(out)} paths ({sum(p["blood"] == "venous" for p in out)} right, {sum(p["blood"] == "arterial" for p in out)} left), '
      f'{min(L):.0f}-{max(L):.0f} mm long, {sum(len(p["pts"]) for p in out)} points')
