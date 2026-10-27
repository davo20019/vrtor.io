"""Inside the LV and RV, cut open: valve, papillary muscles and chordae, closed and open (review/subvalve.png)."""
import json, glob, numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
VAL = dict(np.load('work/valves.npz')); VM = json.load(open('work/valves.json'))
mo = np.load('work/motion.npz'); apex, ax = mo['apex'], mo['axis']
pl = pv.Plotter(shape=(2, 2), window_size=(1600, 1600))
for row, (valve, side, wall_cut) in enumerate([('mv', 'lv', 'lv'), ('tv', 'rv', 'rv')]):
    c, n, e1, e2, _ = H.valve_frame(valve)
    for col, state in enumerate(['closed', 'open']):
        pl.subplot(row, col)
        w = H.mesh(side)
        cut_n = np.cross(ax, n); cut_n /= np.linalg.norm(cut_n)
        pl.add_mesh(w.clip(normal=cut_n, origin=c), color='#b0413e', opacity=1.0, smooth_shading=True)
        for k in [k for k in VM if VM[k]['valve'] == valve]:
            f = VAL[k + '_f']; pl.add_mesh(pv.PolyData(VAL[f'{k}_{state}'], np.hstack([np.full((len(f), 1), 3), f]).ravel()), color='#ead9a8', smooth_shading=True)
        for p in glob.glob(f'work/parts/{side}_*.npz'):
            d = np.load(p); v = d['v'] + (d[f'open_{valve}'] if state == 'open' and f'open_{valve}' in d else 0)
            col_ = '#f2efe6' if 'chordae' in p else '#9c2f2c'
            pl.add_mesh(pv.PolyData(v, np.hstack([np.full((len(d['f']), 1), 3), d['f']]).ravel()), color=col_, smooth_shading=True)
        eye = c + cut_n * 130 - n * 20
        pl.camera_position = [tuple(eye), tuple(c + n * 25), tuple(-n)]
        pl.add_text(f'{side.upper()} {state}', font_size=11)
pl.screenshot('review/subvalve.png')
