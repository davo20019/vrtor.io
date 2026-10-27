"""The heart's parts from BodyParts3D (CC BY 4.0), as the body subject (/bdy) names them.

In:  ../body/out/tree.json (node 'Heart' and everything under it), ../body/raw/obj/.../<el>.obj (mm)
Out: work/bp3d.npz: one entry per element (vertices, faces), and work/bp3d.json: element -> name, tissue, path
     of group names from the heart down. Coordinates stay BodyParts3D's own (mm).
"""
import json, os, glob, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BODY = os.path.join(HERE, '..', 'body')
tree = json.load(open(os.path.join(BODY, 'out', 'tree.json')))
N = {n['id']: n for n in tree['nodes']}
heart = next(n for n in tree['nodes'] if n['name'] == 'Heart')
OBJ = glob.glob(os.path.join(BODY, 'raw', 'objisa', '*'))[0]

def read_obj(p):
    v, f = [], []
    for line in open(p):
        if line.startswith('v '): v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('f '): f.append([int(x.split('/')[0]) - 1 for x in line.split()[1:4]])
    return np.array(v, 'f4'), np.array(f, 'i4')

arrays, info = {}, {}
def walk(i, path):
    n = N[i]
    if 'el' in n:
        v, f = read_obj(os.path.join(OBJ, n['el'] + '.obj'))
        arrays[n['el'] + '_v'], arrays[n['el'] + '_f'] = v, f
        info[n['el']] = {'name': n['name'], 'tissue': n.get('tissue'), 'path': path}
    for k in n.get('kids', []): walk(k, path + [n['name']])
walk(heart['id'], [])
np.savez_compressed(os.path.join(HERE, 'work', 'bp3d.npz'), **arrays)
json.dump(info, open(os.path.join(HERE, 'work', 'bp3d.json'), 'w'), indent=1)
for el in ['FJ2428', 'FJ2438', 'FJ2439', 'FJ2422', 'FJ2423']:
    v = arrays[el + '_v']; print(el, info[el]['name'], v.mean(0).round(1), (v.max(0) - v.min(0)).round(1))
print(len(info), 'elements')
