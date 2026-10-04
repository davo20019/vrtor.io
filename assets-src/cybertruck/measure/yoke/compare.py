"""Overlay the straight-on render of the yoke (render_cams.py 'front') on the manual's render: both cut out,
the render scaled to the same 318 mm width, then IoU and outline distance in mm, and overlay.png (manual
in red, model in cyan).
    .venv/bin/python measure/yoke/compare.py measure/yoke/r1
"""
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
rdir = Path(sys.argv[1])
ref = np.array(Image.open(HERE.parent.parent / 'refs/tesla/manual-steering-GUID-E2AF1DEC-41E5-4927-97BC-5737F8958D75-online-en-US.png').convert('RGBA'))
UP = 4
ref_m = cv2.resize((ref[..., 3] > 128).astype(np.uint8) * 255, None, fx=UP, fy=UP, interpolation=cv2.INTER_NEAREST)
ren = np.array(Image.open(rdir / 'front.png').convert('RGB')).astype(int)
bg = ren[5, 5]
ren_m = ((np.abs(ren - bg).sum(2) > 40) * 255).astype(np.uint8)
ren_m = cv2.morphologyEx(ren_m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

def crop(m):
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
a, b = crop(ref_m), crop(ren_m)
mmpx = 318.0 / a.shape[1]
b = cv2.resize(b, (a.shape[1], round(b.shape[0] * a.shape[1] / b.shape[1])), interpolation=cv2.INTER_LINEAR)
b = (b > 127).astype(np.uint8) * 255
print(f'height: manual {a.shape[0] * mmpx:.1f} mm, model {b.shape[0] * mmpx:.1f} mm')
H = max(a.shape[0], b.shape[0]); W = a.shape[1]
A = np.zeros((H, W), np.uint8); B = np.zeros((H, W), np.uint8)
A[(H - a.shape[0]) // 2:][:a.shape[0]] = a; B[(H - b.shape[0]) // 2:][:b.shape[0]] = b
iou = (A & B).astype(bool).sum() / (A | B).astype(bool).sum()
ea, eb = cv2.Canny(A, 50, 150) > 0, cv2.Canny(B, 50, 150) > 0
da = cv2.distanceTransform((~ea).astype(np.uint8), cv2.DIST_L2, 5)
err = da[eb] * mmpx
print(f'IoU {iou:.3f}; model outline from manual outline: mean {err.mean():.2f} mm, 95% {np.percentile(err, 95):.2f} mm, max {err.max():.2f} mm')
ov = np.full((H, W, 3), 255, np.uint8)
ov[A > 0] = (255, 200, 200); ov[B > 0] = (200, 235, 255); ov[(A > 0) & (B > 0)] = (200, 200, 200)
ov[ea] = (220, 0, 0); ov[eb] = (0, 140, 220)
Image.fromarray(ov).save(rdir / 'overlay.png')
