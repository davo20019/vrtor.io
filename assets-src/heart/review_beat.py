"""End-diastole beside end-systole: front view and a cut across the ventricles (review/beat.png)."""
import numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
W = H.walls(); COL = {'lv': '#b0413e', 'rv': '#c96a5a', 'la': '#a85a7a', 'ra': '#9a6a9a', 'aorta': '#d8a070', 'pa': '#7090c0'}
mo = np.load('work/motion.npz'); apex, ax = mo['apex'], mo['axis']
pl = pv.Plotter(shape=(2, 2), window_size=(1400, 1400))
for col, state in enumerate(['end-diastole', 'end-systole']):
    for row in range(2):
        pl.subplot(row, col)
        for k, c in COL.items():
            m = H.mesh(k)
            if state == 'end-systole':
                vs, af = H.motion_at(m.points, 'heart'); m.points = m.points + vs + af
            if row == 1:
                m = m.clip(normal=-ax, origin=apex + ax * 45, invert=False) if True else m
            pl.add_mesh(m, color=c, smooth_shading=True)
        if row == 0: pl.camera_position = [(0, -400, 10), (0, 0, 10), (0, 0, 1)]
        else: pl.camera_position = [tuple(apex + ax * 45 - ax * 220), tuple(apex + ax * 45), (0, -1, 0)]
        pl.add_text(state + (' (cut, from the apex)' if row else ''), font_size=11)
pl.screenshot('review/beat.png')
