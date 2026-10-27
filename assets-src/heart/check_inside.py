"""Fails if anything that lives inside the heart (papillary muscles, chordae, valve leaflets) comes out through
its walls during the beat: each part's vertices at end-diastole, end-systole and with the valves open are tested
against the heart's outer surface moved the same way. Exit 1 and the worst parts if any vertex is outside."""
import glob, json, sys, numpy as np, pyvista as pv
m = pv.read('work/average.vtu'); mo = np.load('work/motion.npz')
tissue = np.isin(m.cell_data['ID'], [1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24, 7, 8, 9, 10])
bad = []
for state, w in [('end-diastole', 0), ('end-systole', 1)]:
    mm = m.copy(); mm.points = m.points + w * (mo['vsys'] + mo['afill'])
    outer = mm.extract_cells(tissue).extract_surface(algorithm='dataset_surface').triangulate().connectivity('largest').extract_surface(algorithm='dataset_surface')
    for p in sorted(glob.glob('work/parts/*_pm_*.npz') + glob.glob('work/parts/*_chordae_*.npz')):
        d = np.load(p); X = d['v'] + w * (d['vsys'] + d['afill'])
        sd = pv.PolyData(X).compute_implicit_distance(outer)['implicit_distance']
        n_out = int((sd > 0.3).sum())
        if n_out: bad.append((state, p.split('/')[-1][:-4], n_out, float(sd.max())))
for b in bad: print(f'check_inside: {b[0]:13s} {b[1]:22s} {b[2]:5d} vertices outside the heart, up to {b[3]:.1f} mm')
print('check_inside:', 'FAIL' if bad else 'ok, nothing inside the heart comes out through its walls')
sys.exit(1 if bad else 0)
