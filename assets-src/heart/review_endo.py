"""The inside of the walls, cut open: LV, RV and RA (review/endo.png)."""
import glob, json, numpy as np, pyvista as pv, heartgeo as H
pv.OFF_SCREEN = True
mo = np.load('work/motion.npz'); apex, ax = mo['apex'], mo['axis']
pl = pv.Plotter(shape=(1, 3), window_size=(2100, 760))
def add(pattern, color):
    for p in glob.glob(pattern):
        z = np.load(p); pl.add_mesh(pv.PolyData(z['v'], np.hstack([np.full((len(z['f']), 1), 3), z['f']]).ravel()), color=color, smooth_shading=True)
views = [('lv', 'mv'), ('rv', 'tv'), ('ra', 'tv')]
for i, (side, valve) in enumerate(views):
    pl.subplot(0, i)
    c, n, e1, e2, _ = H.valve_frame(valve)
    w = H.mesh(side); centre = w.points.mean(0)
    cut_n = np.cross(ax, n); cut_n /= np.linalg.norm(cut_n)
    if side == 'ra': cut_n = np.array([-1.0, 0, 0])
    pl.add_mesh(w.clip(normal=cut_n, origin=centre), color='#8c3b36', smooth_shading=True)
    add(f'work/parts/endo_{side}_*.npz', '#a0443c')
    if side == 'rv': add('work/parts/endo_moderator_band.npz', '#c0504a'); add('work/parts/rv_pm_*.npz', '#9c2f2c')
    if side == 'lv': add('work/parts/lv_pm_*.npz', '#9c2f2c')
    if side == 'ra': add('work/parts/endo_crista*.npz', '#c0504a'); add('work/parts/endo_ra_*.npz', '#b04840'); add('work/parts/endo_fossa*.npz', '#d06058')
    pl.camera_position = [tuple(centre + cut_n * 150), tuple(centre), tuple(ax)]
    pl.add_text(side.upper(), font_size=12)
pl.screenshot('review/endo.png')
