"""Project the model's landmarks through each solved camera and list the error per landmark (px and mm at depth).
  .venv/bin/python tools/lmcheck.py [photo names]"""
import json, sys, numpy as np
sys.path.insert(0, '.')
import cad
cfg = json.load(open('review.json'))['fit']
L = cad.landmarks(cad.P)
def rot(c):
    rx, ry, rz = np.radians(c)
    Rx = np.array([[1, 0, 0], [0, np.cos(rx), -np.sin(rx)], [0, np.sin(rx), np.cos(rx)]])
    Ry = np.array([[np.cos(ry), 0, np.sin(ry)], [0, 1, 0], [-np.sin(ry), 0, np.cos(ry)]])
    Rz = np.array([[np.cos(rz), -np.sin(rz), 0], [np.sin(rz), np.cos(rz), 0], [0, 0, 1]])
    return Rz @ Rx @ Ry
for ph in cfg['photos']:
    if len(sys.argv) > 1 and ph['name'] not in sys.argv[1:]:
        continue
    try:
        cam = json.load(open(f"fit/{ph['name']}/camera.json"))
    except FileNotFoundError:
        continue
    R = np.array(cam['rotation']); c = np.array(cam['centreMm']); d = cam['distanceMm']; f = cam['focalPx']
    cx, cy = cam['principalPx']
    print(ph['name'], 'pyr', cam['pitchYawRollDeg'], 'dist', round(d), 'f', round(f))
    for k, px in ph.get('landmarks', {}).items():
        V = np.array(L[k], float)
        P = (V - c) @ R.T
        z = d - P[2]
        u = cx + f * P[0] / z; v = cy - f * P[1] / z
        e = np.hypot(u - px[0], v - px[1])
        print(f'  {k:10s} photo {px} model [{u:.0f}, {v:.0f}]  err {e:.1f} px = {e * z / f:.0f} mm')
