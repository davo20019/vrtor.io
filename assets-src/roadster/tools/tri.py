"""Triangulate features marked in two or more photos, through the photos' solved cameras (fit/<photo>/camera.json).
  python tools/tri.py <job.json>

job.json: {"points": {name: {photo: [x, y], ...}}, "mirror": true}
  photo is a fit name (side, front, top, q34, rear_high, front_q34); x, y in the photo's full-resolution pixels.
  "mirror": a point marked on the car's right (x < 0) in a photo can be given as "<photo>:r", and is mirrored to the
  left before solving (the car is symmetric), so a front view's two headlights both constrain one point.
Prints each point in mm (model frame: front +z, up +y, +x the car's left) and its reprojection error in each photo, px.
A point seen in one photo only needs "plane": {"x"|"y"|"z": value} in its entry, and is intersected with it.
Writes <job>.out.json: {name: [x, y, z]}.
"""
import json, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent.parent

def cam(name):
    c = json.loads((HERE / 'fit' / name / 'camera.json').read_text())
    R = np.array(c['rotation']); ctr = np.array(c['centreMm']); d = c['distanceMm']
    f = c['focalPx']; cx, cy = c['principalPx']
    eye = ctr + R.T @ np.array([0, 0, d])
    def ray(u, v):
        dirc = np.array([(u - cx) / f, -(v - cy) / f, -1.0])
        w = R.T @ dirc
        return eye, w / np.linalg.norm(w)
    def proj(X):
        P = R @ (np.asarray(X) - ctr)
        z = d - P[2]
        return np.array([cx + f * P[0] / z, cy - f * P[1] / z])
    ride = c.get('rideOffsetMm', 0.0)
    return ray, proj, ride

job_path = Path(sys.argv[1]).resolve()
job = json.loads(job_path.read_text())
out = {}
for name, obs in job['points'].items():
    plane = obs.pop('plane', None)
    rays, checks = [], []
    for key, (u, v) in obs.items():
        ph, _, side = key.partition(':')
        ray, proj, ride = cam(ph)
        o, w = ray(u, v)
        o = o - [0, ride, 0]
        flip = side == 'r'
        rays.append((o * [-1, 1, 1] if flip else o, w * [-1, 1, 1] if flip else w))
        checks.append((key, proj, ride, flip, (u, v)))
    if plane:
        (axis, val), = plane.items()
        i = 'xyz'.index(axis)
        o, w = rays[0]
        X = o + w * (val - o[i]) / w[i]
    else:
        A = np.zeros((3, 3)); b = np.zeros(3)
        for o, w in rays:
            M = np.eye(3) - np.outer(w, w)
            A += M; b += M @ o
        X = np.linalg.solve(A, b)
    errs = []
    for key, proj, ride, flip, (u, v) in checks:
        Xp = X * [-1, 1, 1] if flip else X
        p = proj(Xp + [0, ride, 0])
        errs.append(f'{key} {np.hypot(p[0] - u, p[1] - v):.1f}')
    out[name] = np.round(X, 1).tolist()
    print(f'{name:24s} x {X[0]:7.0f}  y {X[1]:6.0f}  z {X[2]:7.0f}   px err: {", ".join(errs)}')
job_path.with_suffix('.out.json').write_text(json.dumps(out, indent=1))
