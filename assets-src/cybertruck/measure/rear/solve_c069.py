"""c069's camera with the tailgate's heights left free: the deck's tail corners fix the scale (tail_half 930.5, from
the manual's top view; tail_h 1,319.5), the gate's vertical edges (x = +-gate_half) fix the pitch through their
convergence, and the two heights shared by each pair of gate corners come out of the solve. Focal from the EXIF.
Writes c069.camera.json in measure.py's job format (refs with the solved heights) for the queries."""
import json, sys
import cv2, numpy as np
from scipy.optimize import least_squares

W, H = 3840, 2971
F = 3028.0
ZT = -2873.4
GH = float(sys.argv[1]) if len(sys.argv) > 1 else 926.0
K = np.array([[F, 0, W / 2], [0, F, H / 2], [0, 0, 1]])
tail = {'tail L': ([930.5, 1319.5, ZT], [210, 821]), 'tail R': ([-930.5, 1319.5, ZT], [3536, 829])}
gate = {'gate TL': (GH, 0, [266, 1036]), 'gate TR': (-GH, 0, [3489, 1046]),
        'gate BL': (GH, 1, [371, 1849]), 'gate BR': (-GH, 1, [3396, 1899])}

def pts(v):
    ys = v[6:8]
    obj = [m for m, _ in tail.values()] + [[x, ys[i], ZT] for x, i, _ in gate.values()]
    pix = [p for _, p in tail.values()] + [p for *_, p in gate.values()]
    return np.array(obj, float), np.array(pix, float)

def res(v):
    obj, pix = pts(v)
    return (cv2.projectPoints(obj, v[:3], v[3:6], K, None)[0].reshape(-1, 2) - pix).ravel()

# start: camera 1.7 m behind, looking forward (+z in the model is the truck's front, so the camera looks along +z)
R0 = np.diag([-1.0, -1.0, 1.0])                  # model x left -> image right flipped, y up -> image down
rv0 = cv2.Rodrigues(R0)[0].ravel()
t0 = -R0 @ np.array([0, 1200, ZT - 1700])
v = least_squares(res, np.r_[rv0, t0, 1200, 735]).x
r = res(v).reshape(-1, 2)
R = cv2.Rodrigues(v[:3])[0]
cam = -R.T @ v[3:6]
print(f'camera {cam.round(0)}, band/gate top {v[6]:.0f}, gate bottom {v[7]:.0f}, rms {np.sqrt((r**2).sum(1).mean()):.1f} px')
for n, e in zip(list(tail) + list(gate), r):
    print(f'  {n}: {np.hypot(*e):.1f} px')
obj, pix = pts(v)
names = list(tail) + list(gate)
job = {'_': 'Refs: c069 solved by solve_c069.py (gate heights from the solve).', 'photo': '../../refs/web/c069-rear.jpg', 'focal': F,
       'refs': {n: {'px': p.tolist(), 'mm': o.round(1).tolist()} for n, o, p in zip(names, obj, pix)}}
json.dump(job, open('c069.refs.json', 'w'), indent=1)
