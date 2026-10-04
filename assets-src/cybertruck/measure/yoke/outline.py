"""The yoke's front outline from the manual's straight-on render (manual-steering-E2AF1DEC): the outer edge
and its three openings, traced from the picture's alpha and written in mm (x to the driver's right, y up,
origin at the outline's box centre) to outline.json for cad.py.

Scale: the outline is 376 px wide and the yoke 318 mm (measured through the dash camera, spec.md), so
0.846 mm/px; the same scale makes it 216 mm high.
    assets-src/cybertruck/.venv/bin/python assets-src/cybertruck/measure/yoke/outline.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
REF = HERE.parent.parent / 'refs/tesla/manual-steering-GUID-E2AF1DEC-41E5-4927-97BC-5737F8958D75-online-en-US.png'
WIDTH_MM = 318.0

def resample(c, n):
    """n points evenly along a closed contour, smoothed over ~3 px so pixel steps don't become ripples."""
    c = c.astype(float)
    k = np.ones(13) / 13
    c = np.stack([np.convolve(np.r_[c[-6:, i], c[:, i], c[:6, i]], k, 'valid') for i in (0, 1)], 1)
    seg = np.linalg.norm(np.diff(np.r_[c, c[:1]], axis=0), axis=1)
    t = np.r_[0, np.cumsum(seg)]
    s = np.linspace(0, t[-1], n, endpoint=False)
    closed = np.r_[c, c[:1]]
    return np.stack([np.interp(s, t, closed[:, i]) for i in (0, 1)], 1)

# The render is of a symmetric part: average the alpha with its mirror image about the outline's centre
# (4x up-sampled first, so the edge is traced between pixels), then trace.
UP = 4
im = np.array(Image.open(REF).convert('RGBA'))
alpha = cv2.resize(im[..., 3].astype(np.float32), None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
xs = np.nonzero((alpha > 128).any(0))[0]
mid = (xs.min() + xs.max()) / 2
shift = np.float32([[-1, 0, 2 * mid], [0, 1, 0]])
mirrored = cv2.warpAffine(alpha, shift, (alpha.shape[1], alpha.shape[0]), flags=cv2.INTER_LINEAR)
mask = (((alpha + mirrored) / 2) > 128).astype(np.uint8) * 255
cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
cs = [c[:, 0, :] for c in cs if cv2.contourArea(c) > 1000 * UP * UP]
outer = max(cs, key=cv2.contourArea)
x0, y0, w, h = cv2.boundingRect(outer)
mmpx = WIDTH_MM / w
cx, cy = x0 + w / 2, y0 + h / 2

def to_mm(c):
    return [[round((x - cx) * mmpx, 2), round((cy - y) * mmpx, 2)] for x, y in c]

holes = sorted((c for c in cs if c is not outer), key=lambda c: (c[:, 1].min() > 100 * UP, c[:, 0].mean()))
names = ['top', 'lower_left', 'lower_right']          # left and right as the driver sees them
out = {'mm_per_px': round(mmpx * UP, 4), 'centre_px': [cx / UP, cy / UP], 'size_mm': [round(w * mmpx, 1), round(h * mmpx, 1)],
       'outer': to_mm(resample(outer, 96))}
for name, c in zip(names, holes):
    out[name] = to_mm(resample(c, 64))
(HERE / 'outline.json').write_text(json.dumps(out))
print('outline:', out['size_mm'], 'mm,', out['mm_per_px'], 'mm/px,', {k: len(v) for k, v in out.items() if isinstance(v, list) and k not in ('centre_px', 'size_mm')})
