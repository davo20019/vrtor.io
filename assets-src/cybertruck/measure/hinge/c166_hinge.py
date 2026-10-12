"""The front doors' hinge axis, measured: c166 (both front doors open, from the front) through its solved camera.

The camera: focal length from the photo's EXIF (Nikon D7500, 23.5 mm sensor, 18 mm: 2,941 px at 3,840 wide), its
pose and the lens's radial distortion (k1, k2) solved from fixed points the model has (hood corners, cowl corners,
windshield top corners, the headlamp rows' ends). The hinge: each open door is the shut door turned about one
axis; that axis (a point on it at 900 high, its direction) and each door's angle are fitted so the door's rear
corners land where the photo shows them. Both doors share the axis, mirrored. Run:
  .venv/bin/python measure/hinge/c166_hinge.py

Result (2026-10-12): not good enough to measure the hinge. The camera solves to 70 px RMS with the EXIF focal length
and to 41 px with focal and k1 free (3,386 px, -0.60), the cowl and front face corners off by 40 to 60 px both sides
alike: about 30 mm, against the 55 mm a 5 degree tilt moves the door's rear corner. The lamps first marked were the
bumper's (370 high), not the projector row (680): dropped. The door step was not run.
"""
import json
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

W, H = 3840, 2560
F = 18 / 23.5 * W                 # 2,941 px
C = np.array([W / 2, H / 2])

# Fixed points: px in refs/web/c166-front-doors-open.jpg, model mm (x out to the truck's left, y up, z forward).
# The truck's left (+x) is the photo's right: the driver sits behind the yoke on the right of the windshield.
FIXED = {
    'hood front corner R':  ((465, 1100), (-945.9, 1070.5, 2419.3)),
    'hood front corner L':  ((3367, 1095), (945.9, 1070.5, 2419.3)),
    'cowl corner R':        ((720, 790), (-962.0, 1158.0, 2043.0)),
    'cowl corner L':        ((3080, 790), (962.0, 1158.0, 2043.0)),
    'windshield top R':     ((1240, 192), (-716.0, 1778.2, 310.3)),
    'windshield top L':     ((2465, 202), (716.0, 1778.2, 310.3)),
    'face bottom corner R': ((517, 1703), (-962.0, 682.0, 2387.0)),
    'face bottom corner L': ((3303, 1677), (962.0, 682.0, 2387.0)),
}
# The open doors' rear corners: px, and where they are with the door shut (model mm).
DOORS = {
    'fr': {'rear top': ((89, 599), (-957.0, 1286.3, 97.8)), 'rear bottom': ((170, 1388), (-952.0, 482.0, 97.9))},
    'fl': {'rear top': ((3551, 622), (957.0, 1286.3, 97.8)), 'rear bottom': ((3480, 1380), (952.0, 482.0, 97.9))},
}

def project(pts, rv, t, k1, k2):
    pc = Rotation.from_rotvec(rv).apply(pts) + t
    xy = pc[:, :2] / pc[:, 2:3]
    r2 = (xy ** 2).sum(1, keepdims=True)
    xy = xy * (1 + k1 * r2 + k2 * r2 ** 2)
    return np.c_[F * xy[:, 0] + C[0], F * xy[:, 1] + C[1]]       # camera x right, y down, z ahead

names = list(FIXED)
px = np.array([FIXED[n][0] for n in names], float)
P = np.array([FIXED[n][1] for n in names], float)

def cam_res(q):
    return (project(P, q[:3], q[3:6], q[6], q[7]) - px).ravel()

# The camera looks back along -z at the truck's front from about 4 m ahead, 1.5 m up: start there, facing it
# (camera x = x, y = -y, z = -z: a half turn about x).
best = None
for dist in (5500.0, 6500.0, 8000.0):
    q0 = np.r_[Rotation.from_euler('x', 180, degrees=True).as_rotvec(), 0, 1500, dist, 0, 0]
    sol = least_squares(cam_res, q0, x_scale=np.r_[0.1, 0.1, 0.1, 100, 100, 100, 0.05, 0.05])
    if best is None or sol.cost < best.cost:
        best = sol
q = best.x
res = cam_res(q).reshape(-1, 2)
print('camera: k1 %.3f k2 %.3f, RMS %.1f px' % (q[6], q[7], np.sqrt((res ** 2).sum(1).mean())))
for n, r in zip(names, res):
    print(f'  {n:20s} {np.hypot(*r):6.1f} px')
R = Rotation.from_rotvec(q[:3]); eye = -R.inv().apply(q[3:6])
print('  eye at x %.0f, h %.0f, z %.0f (s %.0f)' % (eye[0], eye[1], eye[2], 2695.8 - eye[2]))
json.dump({'rotvec': q[:3].tolist(), 't': q[3:6].tolist(), 'k1': q[6], 'k2': q[7], 'focal': F}, open(__file__.replace('.py', '.camera.json'), 'w'), indent=1)
