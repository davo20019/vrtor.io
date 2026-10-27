"""Every part of the heart in one bundle for assembly: walls and valve leaflets join the parts the other
builders wrote (papillary muscles, chordae, coronary vessels). Each part: vertices (mm, CT frame), faces, and its
morph displacements: vsys (ventricles at end-systole), afill (atria full), open_<valve> (for that valve's parts).

Out: work/heart_parts.npz, work/heart_parts.json (id -> name, tissue, group, morph names)
"""
import json, glob, os, numpy as np
import heartgeo as H

W = H.walls(); VAL = dict(np.load('work/valves.npz')); VM = json.load(open('work/valves.json'))
WALLS = {'lv': ('Left ventricle', 'lv'), 'rv': ('Right ventricle', 'rv'), 'la': ('Left atrium', 'la'),
         'ra': ('Right atrium', 'ra'), 'aorta': ('Aortic root', 'aorta'), 'pa': ('Pulmonary trunk', 'pa')}
TISSUE = {'lv': 'ventricle', 'rv': 'ventricle', 'la': 'atrium', 'ra': 'atrium', 'aorta': 'artery_wall', 'pa': 'artery_wall'}
out, meta = {}, {}
def add(pid, v, f, targets, m):
    out[pid + '_v'] = v.astype('f4'); out[pid + '_f'] = f.astype('i4')
    for k, d in targets.items(): out[f'{pid}_t_{k}'] = d.astype('f4')
    m['targets'] = list(targets); meta[pid] = m

CUTS = json.load(open('work/vessel_cuts.json')) if os.path.exists('work/vessel_cuts.json') else {}
for k, (name, _) in WALLS.items():
    v, f = W[k + '_v'], W[k + '_f']
    if k in CUTS:   # trimmed square where its continuation (vessels.py) starts
        import pyvista as pv
        c, ax = map(np.array, CUTS[k])
        mm = pv.PolyData(v, np.hstack([np.full((len(f), 1), 3), f]).ravel()).clip(normal=ax, origin=c, invert=True).triangulate().clean()
        v, f = np.asarray(mm.points), mm.faces.reshape(-1, 4)[:, 1:]
    vs, af = H.motion_at(v, 'heart')
    add(k, v, f, {'vsys': vs, 'afill': af}, {'name': name, 'tissue': TISSUE[k], 'group': 'walls'})
for k, mm in VM.items():
    v = VAL[k + '_closed']; vs, af = H.motion_at(v, mm['valve'])
    add(k, v, VAL[k + '_f'], {'vsys': vs, 'afill': af, 'open_' + mm['valve']: VAL[k + '_open'] - v},
        {'name': mm['name'][0].upper() + mm['name'][1:], 'tissue': 'valve', 'group': mm['valve']})
for p in sorted(glob.glob('work/parts/*.npz')):
    pid = os.path.basename(p)[:-4]; d = dict(np.load(p)); m = json.load(open(p[:-4] + '.json'))
    add(pid, d['v'], d['f'], {k: d[k] for k in d if k not in ('v', 'f')}, m)
# how each part looks (surface.py): colour per vertex, and the epicardial fat raising the walls' outside
import pyvista as pv, surface
m = pv.read('work/average.vtu'); t = np.isin(m.cell_data['ID'], [1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24, 7, 8, 9, 10])
o = m.extract_cells(t).extract_surface(algorithm='dataset_surface').triangulate().connectivity('largest')
o = o.extract_surface(algorithm='dataset_surface').compute_normals(auto_orient_normals=True)
looks = surface.paint({k: {'v': out[k + '_v'].astype('f8'), 'f': out[k + '_f'], 'meta': meta[k]} for k in meta},
                      (np.asarray(o.points), np.asarray(o.point_normals)))
for k, (col, X) in looks.items():
    out[k + '_v'] = X.astype('f4'); out[k + '_col'] = col.astype('f4')
# the model's origin: the middle of the walls' bounds
allv = np.vstack([W[k + '_v'] for k in WALLS]); centre = (allv.min(0) + allv.max(0)) / 2
np.savez_compressed('work/heart_parts.npz', **out)
json.dump({'centre_mm': centre.tolist(), 'parts': meta}, open('work/heart_parts.json', 'w'), indent=1)
tris = sum(len(out[k]) for k in out if k.endswith('_f')); verts = sum(len(out[k]) for k in out if k.endswith('_v'))
print(f'{len(meta)} parts, {tris} triangles, {verts} vertices')
