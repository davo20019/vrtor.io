# The same network check on what ships: the built GLBs' simplified meshes (Blender), so a join that simplifying
# opened again shows. Run: blender -b -P vcheck_built.py
import bpy, json, os, glob
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
want = {n['el']: n for n in N if 'el' in n and n.get('tissue') in ('vein', 'artery', 'heart', 'blood', 'valve')}
out = {}
for f in glob.glob(os.path.join(HERE, 'out', 'body-*.glb')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name in want:
            M = np.array(o.matrix_world)
            co = np.empty(len(o.data.vertices) * 3)
            o.data.vertices.foreach_get('co', co)
            out[o.name] = (co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]).tolist()
json.dump(out, open(os.path.join(HERE, 'raw', 'vessels_built.json'), 'w'))
print('[built]', len(out), 'vessel meshes')
