"""Closed surfaces of each labelled part of the Rodero et al. (2021) average heart.

In:  raw/average.vtk (tetrahedra in mm, cell tag ID, fibres, UVCs RHO/PHI/Z/V on points)
Out: work/surf_<name>.vtp, one closed triangle surface per part, keeping the UVCs and the
     fibre direction of the nearest tetrahedron on each vertex.

Tags 1-6 are tissue; 7-10 are the valve planes (discs that close the chambers in the CT model,
not anatomy: the leaflets replace them); 11-17 caps that close each vein's cut end (dropped, the
vessels stay open); 18-24 thin rings of atrial wall round each vein mouth (joined to their atrium).
"""
import numpy as np, pyvista as pv

TAGS = {
    'lv': [1], 'rv': [2], 'la': [3, 18, 19, 20, 21, 22], 'ra': [4, 23, 24],
    'aorta': [5], 'pa': [6],
    'mv_plane': [7], 'tv_plane': [8], 'av_plane': [9], 'pv_plane': [10],
}

m = pv.read('work/average.vtu') if __import__('os').path.exists('work/average.vtu') else pv.read('raw/average.vtk')
tag = m.cell_data['ID']
centres = m.cell_centers().points
fib = m.cell_data['fibres']
from scipy.spatial import cKDTree
tree = cKDTree(centres)
for name, tags in TAGS.items():
    sub = m.extract_cells(np.isin(tag, tags))
    s = sub.extract_surface(algorithm='dataset_surface').triangulate().clean()
    _, i = tree.query(s.points)
    s.point_data['fibre'] = fib[i]
    s.point_data['tag'] = tag[i]
    s.save(f'work/surf_{name}.vtp')
    print(f'{name:9s} {s.n_cells:7d} tris  closed={s.n_open_edges == 0}  vol={abs(s.volume)/1000:7.1f} cm3')
