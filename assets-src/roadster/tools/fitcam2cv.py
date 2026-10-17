"""Write a fit camera (fit/<photo>/camera.json or camera_ba.json) as scripts/3d/render_cams.py's "measure" camera:
OpenCV axes (x right, y down, z forward), the eye in mm.
  python tools/fitcam2cv.py fit/<photo>/camera_ba.json out.camera.json
"""
import json, sys
import numpy as np
c = json.load(open(sys.argv[1]))
R = np.array(c['rotation'])
eye = np.array(c['centreMm']) + R.T @ np.array([0, 0, c['distanceMm']]) - [0, c.get('rideOffsetMm', 0.0), 0]
Rcv = np.diag([1.0, -1.0, -1.0]) @ R
json.dump({'size': [c['width'], c['height']], 'focalPx': c['focalPx'], 'principalPx': c['principalPx'],
           'R': Rcv.tolist(), 'centreMm': eye.tolist()}, open(sys.argv[2], 'w'), indent=1)
