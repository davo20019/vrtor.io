"""Blood volume of each chamber of the CT heart, at rest or moved by a displacement of the tetrahedra's points:
the cavity is the closed hole left inside the union of the chamber's wall, its valve planes and its vein caps."""
import numpy as np, pyvista as pv

CHAMBER = {'LV': [1, 7, 9], 'RV': [1, 2, 7, 8, 9, 10], 'LA': [3, 18, 19, 20, 21, 22, 7, 11, 12, 13, 14, 15],
           'RA': [4, 23, 24, 8, 16, 17]}
_m = None
def tets():
    global _m
    if _m is None: _m = pv.read('work/average.vtu')
    return _m

def volumes(disp=None, which=CHAMBER):
    m = tets().copy() if disp is not None else tets()
    if disp is not None: m.points = m.points + disp
    out = {}
    for name, tags in which.items():
        s = m.extract_cells(np.isin(m.cell_data['ID'], tags)).extract_surface(algorithm='dataset_surface').triangulate()
        c = s.connectivity('all'); ids = c.cell_data['RegionId']
        comps = [c.extract_cells(ids == k).extract_surface(algorithm='dataset_surface') for k in np.unique(ids)]
        comps.sort(key=lambda x: -x.n_cells)
        # the outer boundary is the biggest; the cavity is the largest of the others (inside it)
        inner = [k for k in comps[1:] if k.n_cells > 500]
        if name == 'RV':   # the septum is LV muscle: both cavities are inside; take the one on the RV's side
            rv = m.extract_cells(m.cell_data['ID'] == 2).points.mean(0)
            inner.sort(key=lambda k: np.linalg.norm(np.asarray(k.points).mean(0) - rv))
        out[name] = abs(inner[0].volume) / 1000 if inner else float('nan')
    return out

if __name__ == '__main__':
    print({k: round(v, 1) for k, v in volumes().items()})

_faces = {}
def cavity_faces(name):
    """The cavity's boundary triangles as indices into the CT points (computed once)."""
    if name not in _faces:
        m = tets(); tags = CHAMBER[name]
        sub = m.extract_cells(np.isin(m.cell_data['ID'], tags))
        s = sub.extract_surface(algorithm='dataset_surface').triangulate()
        orig = sub.point_data['vtkOriginalPointIds'][s.point_data['vtkOriginalPointIds']]
        c = s.connectivity('all'); ids = c.cell_data['RegionId']
        F = s.faces.reshape(-1, 4)[:, 1:]
        comps = sorted(np.unique(ids), key=lambda k: -(ids == k).sum())
        inner = [k for k in comps[1:] if (ids == k).sum() > 500]
        if name == 'RV':
            rv = m.extract_cells(m.cell_data['ID'] == 2).points.mean(0)
            inner.sort(key=lambda k: np.linalg.norm(s.points[F[ids == k].ravel()].mean(0) - rv))
        _faces[name] = orig[F[ids == inner[0]]]
    return _faces[name]

def fast_volumes(D=None, names=('LV', 'RV', 'LA', 'RA')):
    X = np.asarray(tets().points, 'f8') + (0 if D is None else D)
    out = {}
    for nm in names:
        F = cavity_faces(nm); a, b, c = X[F[:, 0]], X[F[:, 1]], X[F[:, 2]]
        out[nm] = abs(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6) / 1000
    return out

def tet_volume(D, tagval):
    m = tets(); X = np.asarray(m.points, 'f8') + D
    T = m.cells.reshape(-1, 5)[:, 1:][m.cell_data['ID'] == tagval]
    a, b, c, d = X[T[:, 0]], X[T[:, 1]], X[T[:, 2]], X[T[:, 3]]
    return np.abs(np.einsum('ij,ij->i', b - a, np.cross(c - a, d - a))).sum() / 6 / 1000
