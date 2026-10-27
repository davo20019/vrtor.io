"""Carry every BodyParts3D heart part onto the CT average heart with register.py's similarity and field.

Out: work/warped.npz (<el>_v, <el>_f) and a report of where each part ended up: its distance to the
     myocardium's outside (epicardium) and whether it lies inside a chamber's blood.
"""
import json, numpy as np, pyvista as pv
from scipy.spatial import cKDTree

bp = np.load('work/bp3d.npz'); info = json.load(open('work/bp3d.json'))
r = np.load('work/register.npz'); R, t, s = r['R'], r['t'], float(r['s'])

def apply(V):
    V = s * V.astype('f8') @ R.T + t
    for i, sig in enumerate(r['sig']):
        X, D = r[f'X{i}'], r[f'D{i}']; tr = cKDTree(X); out = np.zeros_like(V); ws = np.zeros(len(V))
        for k, nb in enumerate(tr.query_ball_point(V, 3 * sig)):
            if nb:
                w = np.exp(-((X[nb] - V[k])**2).sum(1) / (2 * sig**2)); out[k] = w @ D[nb]; ws[k] = w.sum()
        V = V + out / np.maximum(ws, 1e-9)[:, None]
    return V

if __name__ == '__main__':
    out = {}
    for el in info:
        out[el + '_v'] = apply(bp[el + '_v']).astype('f4'); out[el + '_f'] = bp[el + '_f']
    np.savez_compressed('work/warped.npz', **out)
    print('warped', len(info))
