# Z-Anatomy's skeleton and the parts to add from it, as Z-Anatomy shows them (modifiers applied, curves turned into
# their tubes), in its own frame, metres, Z up, with left-side mirrors wound back. For bonefit.py and zplace.py.
# Run in Blender with scripts off:
#   blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zdump.py
# Writes raw/zdump.npz (large; regenerated, not committed).
import bpy, os, re
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LABEL = re.compile(r'\.(o\d*[lr]?|e\d*[lr]?|i\d*[lr]?|j|t\d*|g|st)$')      # insertions, labels, text, group markers
SOFT = re.compile(r'fascia|bursa|retinacul|sheath|septum|aponeuros', re.I)


def kind(o):
    tops = [c.name for c in o.users_collection]
    top = next((c for c in tops if re.match(r'\d+:', c)), None)
    if top == '1: Skeletal system' and o.type == 'MESH':
        return 'bone'
    if top == '3: Joints' and o.type == 'MESH':
        return 'joint'
    if top == '6: Lymphoid organs' and o.type == 'MESH':
        return 'lymph'
    if top == '7: Nervous system & Sense organs' and (o.type == 'CURVE' or 'Peripheral nervous system' in tops):
        return 'nerve'
    if top == '4: Muscular system' and o.type == 'MESH' and SOFT.search(o.name) and not o.name.startswith('Epicranial'):
        return 'fascia'
    if top == '4: Muscular system' and o.type == 'MESH':
        return 'muscle'
    return None


dg = bpy.context.evaluated_depsgraph_get()
out = {}
count = {}
for o in bpy.data.objects:
    if LABEL.search(o.name):
        continue
    k = kind(o)
    if not k:
        continue
    ev = o.evaluated_get(dg)
    try:
        me = ev.to_mesh()
    except RuntimeError:
        continue
    if me is None or not len(me.polygons):
        ev.to_mesh_clear()
        continue
    me.calc_loop_triangles()
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    M = np.array(o.matrix_world)
    w = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('vertices', tri)
    tri = tri.reshape(-1, 3)
    if np.linalg.det(M[:3, :3]) < 0:
        tri = tri[:, ::-1]
    ev.to_mesh_clear()
    i = len(out) // 3
    out[f'v{i}'] = w.astype(np.float32)
    out[f'f{i}'] = tri
    out[f'm{i}'] = np.array([o.name, k, '|'.join(c.name for c in o.users_collection)])
    count[k] = count.get(k, 0) + 1
np.savez_compressed(os.path.join(HERE, 'raw', 'zdump.npz'), **out)
print('[zdump]', count)
