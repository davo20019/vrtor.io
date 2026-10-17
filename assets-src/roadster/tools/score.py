"""Score the current model against each photo's cut-out through its camera (fit/<photo>/camera.json): IoU, and each
landmark's error in px. For checking a model change, or cameras from tools/bundle.py, without running the fit.
  .venv/bin/python tools/score.py [camera file name, default camera.json]
"""
import json, sys
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import cad

name = sys.argv[1] if len(sys.argv) > 1 else 'camera.json'
cfg = json.loads((HERE / 'review.json').read_text())['fit']
parts = cad.fit_parts()
mesh = []
for s in parts.values():
    v, t = s.tessellate(*cfg.get('tessellation', [3.0, 0.3]))
    mesh.append((np.array([(q.X, q.Y, q.Z) for q in v]), np.array(t)))
L = cad.landmarks()
for ph in cfg['photos']:
    c = json.loads((HERE / 'fit' / ph['name'] / name).read_text())
    R, ctr, d, f = np.array(c['rotation']), np.array(c['centreMm']), c['distanceMm'], c['focalPx']
    cx, cy = c['principalPx']
    def proj(V):
        P = (np.atleast_2d(V) - ctr) @ R.T
        z = d - P[:, 2]
        return np.c_[cx + f * P[:, 0] / z, cy - f * P[:, 1] / z]
    tgt = cv2.imread(str(HERE / 'fit' / ph['name'] / 'target.png'), 0) > 127
    k = tgt.shape[1] / c['width']
    m = np.zeros(tgt.shape, np.uint8)
    for V, T in mesh:
        pts = np.round(proj(V) * k).astype(np.int32)
        for tri in pts[T]:
            cv2.fillConvexPoly(m, tri, 1)
    m = m > 0
    iou = (m & tgt).sum() / max(1, (m | tgt).sum())
    errs = {n: float(np.hypot(*(proj(L[n])[0] - uv))) for n, uv in (ph.get('landmarks') or {}).items() if n in L}
    worst = sorted(errs.items(), key=lambda e: -e[1])[:3]
    print(f"{ph['name']:10s} IoU {iou:.4f}   landmarks px: mean {np.mean(list(errs.values())) if errs else 0:.1f}, worst "
          + ', '.join(f'{n} {e:.0f}' for n, e in worst))
