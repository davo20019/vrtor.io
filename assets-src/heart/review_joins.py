"""Where the great arteries leave the ventricles, at rest and squeezed (review/joins.png): the ventricle's wall,
the artery (which now starts at the ventricle) and its valve, each moved by its own motion as in the app."""
import json, numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
cuts = json.load(open('work/vessel_cuts.json')); VAL = dict(np.load('work/valves.npz')); VM = json.load(open('work/valves.json'))
pl = pv.Plotter(shape=(2, 2), window_size=(1600, 1600))
for row, (name, pid, vent, valve) in enumerate([('aorta', 'ves_aorta', 'lv', 'av'), ('pa', 'ves_pt', 'rv', 'pv')]):
    c, ax = map(np.array, cuts[name])
    for col, w in enumerate([0.0, 1.0]):
        pl.subplot(row, col)
        for wall, colr in [(vent, '#8c3b36'), ('la' if vent == 'lv' else 'ra', '#7a3040')]:
            m = H.mesh(wall); vs, af = H.motion_at(np.asarray(m.points), 'heart'); m.points = m.points + w * (vs + af)
            pl.add_mesh(m, color=colr, smooth_shading=True)
        z = np.load(f'work/parts/{pid}.npz'); V = z['v'] + w * (z['vsys'] + z['afill'])
        pl.add_mesh(pv.PolyData(V, np.hstack([np.full((len(z['f']), 1), 3), z['f']]).ravel()), color='#e0c0a8', smooth_shading=True)
        for k in [k for k in VM if VM[k]['valve'] == valve]:
            X = VAL[k + '_closed']; vs, _ = H.motion_at(X, valve)
            pl.add_mesh(pv.PolyData(X + w * vs, np.hstack([np.full((len(VAL[k + '_f']), 1), 3), VAL[k + '_f']]).ravel()), color='#f0e6c8')
        side = np.cross(ax, [0, 0, 1.0]); side /= np.linalg.norm(side)
        pl.camera_position = [tuple(c + side * 110 - ax * 40 - np.array([0, 70, 0])), tuple(c - ax * 15), tuple(ax)]
        pl.add_text(f'{name} {"squeezed" if w else "at rest"}', font_size=11)
pl.screenshot('review/joins.png')
