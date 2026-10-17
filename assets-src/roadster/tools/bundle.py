"""Bundle adjustment: the photos' cameras (fit/<photo>/camera.json) and features marked in several photos, refined
together, so features the outline can't see are measured in mm with the error of every photo shown.
  .venv/bin/python tools/bundle.py <job.json> [--write]

job.json:
  "anchors":  {name: {photo: [x, y], ...}}   points whose position is known: cad.landmarks() (plate corners, hubs,
              contacts); they hold the frame and the scale
  "points":   {name: {photo: [x, y], ...}}   features to measure; "<photo>:r" marks the car's right-hand twin of a
              left-hand point (mirrored, the car is symmetric)
  "prior":    optional {"deg": 1.0, "mm": 60, "focal": 0.03}: how far a camera may move from its fit for one px of error
Each camera: a rotation (3), its eye position (3) and its focal length (1), starting from the fit. Prints each point
in mm and each observation's error in px, and each camera's change. --write saves the refined cameras to
fit/<photo>/camera_ba.json (camera.json untouched) and the points to <job>.out.json.
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import cad

job_path = Path([a for a in sys.argv[1:] if not a.startswith('--')][0]).resolve()
job = json.loads(job_path.read_text())
prior = {'deg': 1.0, 'mm': 60.0, 'focal': 0.03, **job.get('prior', {})}
known = cad.landmarks()

obs = []                                  # (photo, point index or anchor name, mirror, u, v)
pts = list(job.get('points', {}))
photos = set()
for kind in ('anchors', 'points'):
    for name, o in job.get(kind, {}).items():
        for key, uv in o.items():
            ph, _, side = key.partition(':')
            photos.add(ph)
            obs.append((ph, name if kind == 'anchors' else pts.index(name), side == 'r', *uv))
photos = sorted(photos)

cams = {}
for ph in photos:
    c = json.loads((HERE / 'fit' / ph / 'camera.json').read_text())
    R = np.array(c['rotation']); ctr = np.array(c['centreMm'])
    eye = ctr + R.T @ np.array([0, 0, c['distanceMm']])
    cams[ph] = dict(c=c, R0=R, eye0=eye, f0=c['focalPx'], pp=np.array(c['principalPx']), ride=c.get('rideOffsetMm', 0.0))

def unpack(x):
    out = {}
    for i, ph in enumerate(photos):
        r, t, df = x[7 * i:7 * i + 3], x[7 * i + 3:7 * i + 6], x[7 * i + 6]
        k = cams[ph]
        out[ph] = (Rotation.from_rotvec(r).as_matrix() @ k['R0'], k['eye0'] + t, k['f0'] * (1 + df), k['pp'], k['ride'])
    P = x[7 * len(photos):].reshape(-1, 3)
    return out, P

def proj(cam, X):
    R, eye, f, pp, ride = cam
    Pc = R @ (X + [0, ride, 0] - eye)     # camera looks along -z of its frame
    return np.array([pp[0] + f * Pc[0] / -Pc[2], pp[1] - f * Pc[1] / -Pc[2]])

ROBUST = 6.0                              # px: observations further off than this count less (soft L1), the priors don't

def robust(e):
    return np.sign(e) * ROBUST * np.sqrt(2 * (np.sqrt(1 + (e / ROBUST) ** 2) - 1))

def raw(x):
    C, P = unpack(x)
    r = []
    for ph, who, mir, u, v in obs:
        X = np.array(known[who], float) if isinstance(who, str) else P[who]
        if mir:
            X = X * [-1, 1, 1]
        r += list(proj(C[ph], X) - [u, v])
    return np.array(r)

def resid(x):
    C, P = unpack(x)
    r = []
    for ph, who, mir, u, v in obs:
        X = np.array(known[who], float) if isinstance(who, str) else P[who]
        if mir:
            X = X * [-1, 1, 1]
        r += list(proj(C[ph], X) - [u, v])
    r = list(robust(np.array(r)))
    for i in range(len(photos)):
        r += list(np.degrees(x[7 * i:7 * i + 3]) / prior['deg'])
        r += list(x[7 * i + 3:7 * i + 6] / prior['mm'])
        r.append(x[7 * i + 6] / prior['focal'])
    return np.array(r)

# start the points from a plain triangulation through the fitted cameras
C0, _ = unpack(np.zeros(7 * len(photos) + 3 * len(pts)))
P0 = []
for j, name in enumerate(pts):
    A = np.zeros((3, 3)); b = np.zeros(3)
    for ph, who, mir, u, v in obs:
        if who != j:
            continue
        R, eye, f, pp, ride = C0[ph]
        d = R.T @ np.array([(u - pp[0]) / f, -(v - pp[1]) / f, -1.0]); d /= np.linalg.norm(d)
        o = eye - [0, ride, 0]
        if mir:
            o, d = o * [-1, 1, 1], d * [-1, 1, 1]
        M = np.eye(3) - np.outer(d, d); A += M; b += M @ o
    P0.append(np.linalg.solve(A, b))
x0 = np.r_[np.zeros(7 * len(photos)), np.ravel(P0)]
before = raw(x0)
sol = least_squares(resid, x0)
C, P = unpack(sol.x)
after = raw(sol.x).reshape(-1, 2)
print(f'rms px: before {np.sqrt(np.mean(before ** 2)) * 1.414:.1f}, after {np.sqrt(np.mean(np.sum(after ** 2, 1))):.1f}')
for i, ph in enumerate(photos):
    r = np.degrees(np.linalg.norm(sol.x[7 * i:7 * i + 3])); t = np.linalg.norm(sol.x[7 * i + 3:7 * i + 6])
    print(f'  camera {ph:10s} turned {r:4.2f} deg, moved {t:4.0f} mm, focal {sol.x[7 * i + 6] * 100:+.1f}%')
errs = {}
for (ph, who, mir, u, v), e in zip(obs, after):
    errs.setdefault(who, []).append(f'{ph}{":r" if mir else ""} {np.hypot(*e):.1f}')
for name in job.get('anchors', {}):
    print(f'  anchor {name:18s} px err: {", ".join(errs[name])}')
for j, name in enumerate(pts):
    X = P[j]
    print(f'{name:24s} x {X[0]:7.0f}  y {X[1]:6.0f}  z {X[2]:7.0f}   px err: {", ".join(errs[j])}')
if '--write' in sys.argv:
    for ph in photos:
        R, eye, f, pp, ride = C[ph]
        c = dict(cams[ph]['c'])
        ctr = np.array(c['centreMm'])
        c.update(rotation=R.tolist(), distanceMm=float(np.linalg.norm(eye - ctr)), focalPx=float(f), cameraPositionMm=np.round(eye).tolist())
        # keep the fit's convention (camera on +z of its frame, looking at centreMm): re-centre the look point
        fwd = -R[2]; c['centreMm'] = (eye + fwd * np.dot(ctr - eye, fwd)).tolist()
        c['distanceMm'] = float(np.dot(ctr - eye, fwd))
        (HERE / 'fit' / ph / 'camera_ba.json').write_text(json.dumps(c, indent=2))
    job_path.with_suffix('.out.json').write_text(json.dumps({n: np.round(P[j], 1).tolist() for j, n in enumerate(pts)}, indent=1))
