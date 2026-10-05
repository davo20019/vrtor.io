"""Sight planes for the A-pillar trim, driver's side: each is the plane through a solved camera and the trim's
outline in that photo, so the trim drawn up to it shows exactly that outline from that camera (the trim's faces
are rounded, so each camera's outline is a different line on them: crossing two outlines as if one edge put the
post's edge outside the glass). Outlines are the strongest brightness step against the glass triangle, per row
or column. dgRcedIkNOM at 6:16 looks at the passenger's pillar; it is mirrored across.
Cameras: athens1 (5.9 px RMS), d32f1100 (dgRcedIkNOM-32, 9 px; the edge holds within 15 mm for 924 to 1,300 px),
v376f838 (dgRcedIkNOM at 6:16, 8.5 px, focal fixed at what the video's 7:13 frame solves to (v433f838, 11 px);
its dash comes out ~50 px off, so cad.py uses it only for the strip underside's tilt).
Writes pillar_hull.json: {name: {"point", "normal", "photo", "px"}} with the normal pointing away from the trim.
  assets-src/cybertruck/.venv/bin/python assets-src/cybertruck/measure/console/pillar_hull.py"""
import json, numpy as np
from pathlib import Path
H = Path(__file__).parent
M = np.diag([-1.0, 1.0, 1.0])
def cam(n):
    c = json.loads((H / n).read_text()); return np.array(c['R']), np.array(c['centreMm']), c['focalPx'], np.array(c['principalPx'])
def ray(c, px):
    R, C, f, pp = c; d = R.T @ np.array([(px[0] - pp[0]) / f, (px[1] - pp[1]) / f, 1]); return d / np.linalg.norm(d)
# name: (camera file, outline from, outline to, mirror, a point inside the trim)
inside_post = np.array([880.0, 1300.0, 2695.8 - 1420])
inside_strip = np.array([800.0, 1450.0, 2695.8 - 1100])
SPEC = {
    # Independent, solved still photo; do not use the cross-cab video's post outline for depth.
    'post athens2':  ('athens2-f921.camera.json', (352, 950), (355, 1105), False, inside_post),
    'strip upper athens2': ('athens2-f921.camera.json', (360, 700), (631, 1066), False, np.array([700.0, 1330.0, 1420.0])),
    'post athens1':  ('athens1.camera.json', (461, 440), (464, 530), False, inside_post),
    'post d32':      ('d32f1100.camera.json', (137, 22), (130, 165), False, inside_post),
    'strip athens1': ('athens1.camera.json', (475, 440), (595, 541), False, inside_strip),
    'strip upper athens1': ('athens1.camera.json', (530, 280), (670, 527), False, np.array([870.0, 1320.0, 2695.8 - 1150])),
    # dgRcedIkNOM at 6:16, from the passenger's seat (screen's right corners and the white block's end, focal
    # fixed at the 838 px the video's 7:13 frame solves to; +-25 mm over 760 to 1,000 px)
    'strip passenger seat': ('v376f838.camera.json', (640, 117), (820, 30), True, inside_strip),
    'post passenger seat': ('v376f838.camera.json', (845, 30), (838, 130), True, inside_post),
}
out = {}
for name, (cf, a, b, mirror, inner) in SPEC.items():
    c = cam(cf)
    C, n = c[1], np.cross(ray(c, a), ray(c, b))
    if mirror:
        C, n = M @ C, M @ n
    n /= np.linalg.norm(n)
    if (inner - C) @ n > 0:
        n = -n
    out[name] = {'point': [round(v, 2) for v in C], 'normal': [round(v, 6) for v in n], 'photo': cf.split('.')[0], 'px': [a, b]}
(H / 'pillar_hull.json').write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
