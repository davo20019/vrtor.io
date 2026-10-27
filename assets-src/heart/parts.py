"""Every part of the heart in one bundle for assembly: walls and valve leaflets join the parts the other
builders wrote (papillary muscles, chordae, coronary vessels). Each part: vertices (mm, CT frame), faces, and its
morph displacements: vsys (ventricles at end-systole), afill (atria full), open_<valve> (for that valve's parts).

Out: work/heart_parts.npz, work/heart_parts.json (id -> name, tissue, group, morph names)
"""
import json, glob, os, numpy as np
from scipy.spatial import cKDTree
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
    if k in CUTS: continue   # replaced whole by its vessel, which starts at its foot through its own sections (vessels.py)
    if False:
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
    m['targets'] = [t for t in m['targets'] if t != 'act']
# how each part looks (surface.py): colour per vertex, and the epicardial fat raising the walls' outside
import pyvista as pv, surface
m = pv.read('work/average.vtu'); t = np.isin(m.cell_data['ID'], [1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24, 7, 8, 9, 10])
o = m.extract_cells(t).extract_surface(algorithm='dataset_surface').triangulate().connectivity('largest')
o = o.extract_surface(algorithm='dataset_surface').compute_normals(auto_orient_normals=True)
looks = surface.paint({k: {'v': out[k + '_v'].astype('f8'), 'f': out[k + '_f'], 'meta': meta[k]} for k in meta},
                      (np.asarray(o.points), np.asarray(o.point_normals)))
for k, (col, X) in looks.items():
    out[k + '_v'] = X.astype('f4'); out[k + '_col'] = col.astype('f4')
# the electrical activation (conduction.py) on every vertex, on the app's clock (ms in the 800 ms cycle, whose 0
# is the start of the ventricles' contraction; the QRS starts 30 ms before it and the SA node fires a PR interval
# earlier); and the contraction following it: a ventricle's squeeze (vsys) and an atrium's (afill) are split into
# bands by when the muscle under each vertex is activated, each band a morph target the app plays with its delay
import cycle_bands as CB
A = np.load('work/activation.npz'); act_all = A['act']; qrs = float(A['qrs_onset'])
TP = cKDTree(np.asarray(m.points)); lab = np.load('work/motion.npz')['label']
# every part's ventricular motion follows the activation of the ventricular muscle nearest it, and its atrial
# motion the atrial muscle's: so a valve, a vessel or a coronary artery moves on the same beat as the wall it is on
VEN_P = np.where(np.isin(lab, [1, 2]))[0]; ATR_P = np.where(np.isin(lab, [3, 4, 18, 19, 20, 21, 22, 23, 24]))[0]
TV_, TA_ = cKDTree(np.asarray(m.points)[VEN_P]), cKDTree(np.asarray(m.points)[ATR_P])
for k in list(meta):
    X = out[k + '_v']; _, i = TP.query(X); a = out.pop(k + '_t_act', None)
    a = act_all[i] if a is None else a
    out[k + '_act'] = ((CB.SA_AT + a) % CB.RR).astype('f4')
    rel_v = act_all[VEN_P[TV_.query(X)[1]]] - qrs; rel_a = act_all[ATR_P[TA_.query(X)[1]]]
    for field, rel, centres in [('vsys', rel_v, CB.VENT_BANDS), ('afill', rel_a, CB.ATR_BANDS)]:
        key = f'{k}_t_{field}'
        if key not in out or not np.abs(out[key]).max() > 1e-6: continue
        w = CB.weights(rel, centres); D = out.pop(key)
        for b in range(len(centres)): out[f'{k}_t_{field}_{b}'] = (D * w[:, b:b + 1]).astype('f4')
        meta[k]['targets'] = [t for t in meta[k]['targets'] if t != field] + [f'{field}_{b}' for b in range(len(centres))]
# the model's origin: the middle of the walls' bounds
allv = np.vstack([W[k + '_v'] for k in WALLS]); centre = (allv.min(0) + allv.max(0)) / 2
np.savez_compressed('work/heart_parts.npz', **out)
json.dump({'centre_mm': centre.tolist(), 'parts': meta}, open('work/heart_parts.json', 'w'), indent=1)
tris = sum(len(out[k]) for k in out if k.endswith('_f')); verts = sum(len(out[k]) for k in out if k.endswith('_v'))
print(f'{len(meta)} parts, {tris} triangles, {verts} vertices')
