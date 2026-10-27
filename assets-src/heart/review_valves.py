"""Renders each valve closed and open, seen from upstream (atrium / ventricle) with its ring: review/valves.png"""
import json, numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
V = dict(np.load('work/valves.npz')); meta = json.load(open('work/valves.json'))
COL = ['#e8d2a0', '#c8e0a0', '#a0c8e8', '#e8a0c8']
pl = pv.Plotter(shape=(2, 4), window_size=(2000, 1000))
for col, v in enumerate(['mv', 'tv', 'av', 'pv']):
    pts, angs, (c, n, e1, e2) = H.ring(v)
    for row, state in enumerate(['closed', 'open']):
        pl.subplot(row, col)
        pl.add_mesh(pv.Spline(np.vstack([pts, pts[:1]]), 300).tube(radius=0.4), color='black')
        for k, key in enumerate([k for k in meta if meta[k]['valve'] == v]):
            f = V[key + '_f']; m = pv.PolyData(V[f'{key}_{state}'], np.hstack([np.full((len(f), 1), 3), f]).ravel())
            pl.add_mesh(m, color=COL[k], smooth_shading=True)
        eye = c - n * 70 + e1 * 25
        pl.camera_position = [tuple(eye), tuple(c + n * 5), tuple(e2)]
        pl.add_text(f'{v} {state}', font_size=10)
pl.screenshot('review/valves.png')
