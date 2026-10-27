"""The heart with its great vessels, from the front and the back (review/vessels.png)."""
import glob, json, numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
COL = {'lv': '#b0413e', 'rv': '#c96a5a', 'la': '#a85a7a', 'ra': '#9a6a9a', 'aorta': '#d8a070', 'pa': '#7090c0'}
pl = pv.Plotter(shape=(1, 2), window_size=(1800, 1000))
for i, (d, up) in enumerate([((0, -1, 0), (0, 0, 1)), ((0, 1, 0), (0, 0, 1))]):
    pl.subplot(0, i)
    for k, c in COL.items(): pl.add_mesh(H.mesh(k), color=c, smooth_shading=True)
    for p in glob.glob('work/parts/ves_*.npz'):
        z = np.load(p); g = json.load(open(p[:-4] + '.json'))['group']
        pl.add_mesh(pv.PolyData(z['v'], np.hstack([np.full((len(z['f']), 1), 3), z['f']]).ravel()), color='#e0b090' if g == 'great_arteries' else '#6070b0', smooth_shading=True)
    pl.camera_position = [tuple(np.array(d) * 600 + np.array([0, 0, 40])), (0, 0, 40), up]
pl.screenshot('review/vessels.png')
