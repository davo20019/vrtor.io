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

for k, (name, _) in WALLS.items():
    v, f = W[k + '_v'], W[k + '_f']; vs, af = H.motion_at(v, 'heart')
    add(k, v, f, {'vsys': vs, 'afill': af}, {'name': name, 'tissue': TISSUE[k], 'group': 'walls'})
for k, mm in VM.items():
    v = VAL[k + '_closed']; vs, af = H.motion_at(v, mm['valve'])
    add(k, v, VAL[k + '_f'], {'vsys': vs, 'afill': af, 'open_' + mm['valve']: VAL[k + '_open'] - v},
        {'name': mm['name'][0].upper() + mm['name'][1:], 'tissue': 'valve', 'group': mm['valve']})
for p in sorted(glob.glob('work/parts/*.npz')):
    pid = os.path.basename(p)[:-4]; d = dict(np.load(p)); m = json.load(open(p[:-4] + '.json'))
    add(pid, d['v'], d['f'], {k: d[k] for k in d if k not in ('v', 'f')}, m)
# the model's origin: the middle of the walls' bounds
allv = np.vstack([W[k + '_v'] for k in WALLS]); centre = (allv.min(0) + allv.max(0)) / 2
np.savez_compressed('work/heart_parts.npz', **out)
json.dump({'centre_mm': centre.tolist(), 'parts': meta}, open('work/heart_parts.json', 'w'), indent=1)
tris = sum(len(out[k]) for k in out if k.endswith('_f')); verts = sum(len(out[k]) for k in out if k.endswith('_v'))
print(f'{len(meta)} parts, {tris} triangles, {verts} vertices')
