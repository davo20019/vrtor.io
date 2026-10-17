# The body's GLBs, headless in Blender: blender -b -P build.py [-- --budget 1200000 --only skeleton]
#
# Reads out/tree.json (tree.py) and BodyParts3D's element OBJs (mm, Z up, the body facing -Y, its right side at -X),
# and writes out/body-<system>.glb, one per system, plus out/body.json for the app.
#   - metres, the soles at 0 and the body's midline at x = y = 0
#   - every element its own object, named by its file id (FJ1807), origin at its centre, so in the hand it
#     turns about itself; the tree in body.json says what it belongs to
#   - cut to a triangle budget shared by size: small parts keep their shape (a valve leaflet, the ossicles),
#     the big smooth ones (the skin, the intercostals at 100k each) lose most
#   - one material per tissue, named t_<tissue>; the app gives each its look (src/tissues.js)
import bpy, bmesh, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
OUT = os.path.join(HERE, 'out')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
BUDGET = arg('--budget', 1200000)       # triangles, the whole body
MIN_TRIS = arg('--min', 240)             # no part cut below this (or its own count, if smaller)
ONLY = arg('--only', '')

tree = json.load(open(os.path.join(OUT, 'tree.json')))
leaves = [n for n in tree['nodes'] if 'el' in n]
if ONLY:
    leaves = [n for n in leaves if n['system'] in ONLY.split(',')]


def read_obj(path):
    vs, fs = [], []
    with open(path, encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith('v '):
                vs.append(line.split()[1:4])
            elif line.startswith('f '):
                fs.append([p.split('/')[0] for p in line.split()[1:4]])
    return np.array(vs, dtype=np.float64), np.array(fs, dtype=np.int64) - 1


# ---- read everything first: the triangle budget is shared out by count
parts = []
for n in leaves:
    v, f = read_obj(os.path.join(OBJ, n['el'] + '.obj'))
    parts.append({'node': n, 'v': v, 'f': f})

# Placed: soles at 0, midline (the skeleton's centre in x and y) at 0. From all the parts, so --only keeps the frame.
allv = np.concatenate([p['v'] for p in parts])
lo, hi = allv.min(0), allv.max(0)
frame = json.load(open(os.path.join(OUT, 'frame.json'))) if ONLY and os.path.exists(os.path.join(OUT, 'frame.json')) else None
if not frame:
    frame = {'offset_mm': [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]], 'height_mm': float(hi[2] - lo[2])}
    json.dump(frame, open(os.path.join(OUT, 'frame.json'), 'w'))
off = np.array(frame['offset_mm'])
print(f"[body] {len(parts)} parts, height {frame['height_mm']:.0f} mm")

# Budget: each part keeps tris ~ total^0.7 share, so small parts keep proportionally more.
# Some tissues are looked at closer than others: the skin and the bones keep more of their shape, the
# thousand-odd vessel branches (thin tubes, mostly seen in passing) less.
DETAIL = {'skin': 5.0, 'bone': 2.0, 'tooth': 1.5, 'brain': 1.6, 'whitematter': 1.3, 'liver': 1.6, 'heart': 1.8, 'valve': 1.5,
          'kidney': 1.5, 'gut': 1.3, 'stomach': 1.3, 'muscle': 1.0, 'artery': 0.6, 'vein': 0.6, 'bronchus': 0.7}
counts = np.array([len(p['f']) for p in parts], dtype=np.float64)
weights = counts ** 0.7 * np.array([DETAIL.get(p['node']['tissue'], 1.0) for p in parts])
target = np.maximum(np.minimum(counts, MIN_TRIS), BUDGET * weights / weights.sum())
for _ in range(8):                         # parts that can't use their share give it back
    target = np.minimum(target, counts)
    spare = BUDGET - target.sum()
    free = target < counts
    if spare <= 1 or not free.any():
        break
    target[free] += spare * weights[free] / weights[free].sum()
target = np.minimum(target, counts)

# ---- materials, one per tissue (stand-ins: the app sets the real look)
BASE = {
    'bone': (0.86, 0.80, 0.68), 'cartilage': (0.80, 0.84, 0.86), 'ligament': (0.88, 0.86, 0.80), 'muscle': (0.55, 0.12, 0.10),
    'heart': (0.50, 0.12, 0.10), 'blood': (0.35, 0.03, 0.04), 'valve': (0.90, 0.82, 0.70), 'artery': (0.70, 0.12, 0.10), 'vein': (0.25, 0.14, 0.32),
    'nerve': (0.92, 0.86, 0.60), 'brain': (0.80, 0.62, 0.58), 'whitematter': (0.92, 0.86, 0.80), 'ventricle': (0.55, 0.75, 0.90),
    'bronchus': (0.88, 0.78, 0.74), 'lung': (0.85, 0.55, 0.55), 'liver': (0.38, 0.12, 0.08), 'bile': (0.30, 0.45, 0.15),
    'spleen': (0.35, 0.10, 0.18), 'kidney': (0.45, 0.14, 0.10), 'pancreas': (0.90, 0.72, 0.50), 'gland': (0.62, 0.30, 0.22),
    'tongue': (0.75, 0.38, 0.38), 'stomach': (0.82, 0.55, 0.50), 'gut': (0.85, 0.62, 0.55), 'bladder': (0.85, 0.70, 0.60),
    'repro': (0.80, 0.55, 0.50), 'skin': (0.80, 0.60, 0.48), 'hair': (0.12, 0.08, 0.06), 'tooth': (0.95, 0.93, 0.86),
    'lens': (0.95, 0.95, 0.95), 'sclera': (0.95, 0.94, 0.90), 'eyedark': (0.20, 0.12, 0.10),
}
mats = {}
def material(tissue):
    if tissue not in mats:
        m = bpy.data.materials.new('t_' + tissue)
        bsdf = m.node_tree.nodes['Principled BSDF'] if m.use_nodes else None
        if bsdf is None:
            m.use_nodes = True
            bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*BASE.get(tissue, (0.8, 0.8, 0.8)), 1)
        bsdf.inputs['Roughness'].default_value = 0.5
        mats[tissue] = m
    return mats[tissue]


# ---- cavity shading: creases and hollows a little darker (the brain's sulci, between the vertebrae, the gut's
# folds), baked per part into its vertex colour, so a part keeps it wherever it is taken. From the mesh alone:
# how far a vertex's neighbours rise above its tangent plane, smoothed, mapped to a shade.
CAVITY_DARK = 0.45      # the deepest crease's shade (1 = untouched)
CAVITY_BLUR = 3


def cavity(me):
    n = len(me.vertices)
    if n < 4:
        return
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    nor = np.empty(n * 3)
    me.vertices.foreach_get('normal', nor)
    nor = nor.reshape(-1, 3)
    ed = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get('vertices', ed)
    ed = ed.reshape(-1, 2)
    a, b = ed[:, 0], ed[:, 1]
    d = co[b] - co[a]
    ln = np.linalg.norm(d, axis=1) + 1e-12
    d /= ln[:, None]
    # Concave where the neighbour lies above the tangent plane (along the outward normal).
    acc = np.zeros(n)
    cnt = np.zeros(n)
    np.add.at(acc, a, (d * nor[a]).sum(1))
    np.add.at(acc, b, (-d * nor[b]).sum(1))
    np.add.at(cnt, a, 1)
    np.add.at(cnt, b, 1)
    c = acc / np.maximum(cnt, 1)
    for _ in range(CAVITY_BLUR):
        s = np.zeros(n)
        np.add.at(s, a, c[b])
        np.add.at(s, b, c[a])
        c = 0.5 * c + 0.5 * s / np.maximum(cnt, 1)
    # Scaled by this part's own spread, so a smooth organ and a wrinkled brain both use the range.
    hi = np.percentile(c, 98) if n > 50 else c.max()
    shade = 1 - (1 - CAVITY_DARK) * np.clip(c / max(hi, 1e-6), 0, 1) ** 0.8
    attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    rgba = np.repeat(shade[:, None], 4, axis=1)
    rgba[:, 3] = 1
    attr.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = attr


# ---- objects
bpy.ops.wm.read_factory_settings(use_empty=True)
info = {}
by_system = {}
for p, t in zip(parts, target):
    n = p['node']
    v = (p['v'] + off) / 1000.0
    centre = (v.min(0) + v.max(0)) / 2
    me = bpy.data.meshes.new(n['el'])
    me.from_pydata((v - centre).tolist(), [], p['f'].tolist())
    me.validate(clean_customdata=False)
    ob = bpy.data.objects.new(n['el'], me)
    ob.location = centre.tolist()
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(me)
    bm.free()
    have = len(me.polygons)
    if t < have * 0.98:
        mod = ob.modifiers.new('cut', 'DECIMATE')
        mod.ratio = float(t) / have
        mod.use_collapse_triangulate = True
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in me.polygons:
        poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(60))
    cavity(me)
    me.materials.append(material(n['tissue']))
    by_system.setdefault(n['system'], []).append(ob)
    info[n['el']] = {'tris': len(me.polygons), 'from': have}

print('[body] triangles', sum(i['tris'] for i in info.values()), 'of', sum(i['from'] for i in info.values()))

# ---- export, one GLB per system
for system, obs in by_system.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    path = os.path.join(OUT, f'body-{system}.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE', export_materials='EXPORT', export_extras=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
    )
    print(f'[body] {system}: {len(obs)} parts, {sum(info[o.name]["tris"] for o in obs)} tris, {os.path.getsize(path) / 1e6:.1f} MB')

json.dump({'frame': frame, 'parts': info}, open(os.path.join(OUT, 'build.json' if not ONLY else f'build-{ONLY}.json'), 'w'))
