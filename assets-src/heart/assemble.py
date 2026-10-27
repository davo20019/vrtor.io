"""Headless Blender: the heart's parts to out/heart.glb, every part its own mesh with its morph targets.

blender -b --factory-startup --python assemble.py
The CT frame (x left, y back, z up; mm) is Blender's own (z up): glTF's y-up export turns it into x left, y up,
z front, vrtor's frame. Centred on the walls' bounds and scaled to metres.
Morph targets: vsys (ventricles at end-systole), afill (atria full), open_<valve> (valve parts).
"""
import bpy, json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
D = np.load(os.path.join(HERE, 'work', 'heart_parts.npz')); META = json.load(open(os.path.join(HERE, 'work', 'heart_parts.json')))
C = np.array(META['centre_mm'])
bpy.ops.wm.read_factory_settings(use_empty=True)

COLOR = {   # base colour, roughness; colours of fresh tissue (myocardium dark red, vessels' walls pale, valves cream)
    'ventricle': ((0.42, 0.07, 0.06), 0.55), 'atrium': ((0.46, 0.10, 0.10), 0.55), 'heart': ((0.40, 0.06, 0.05), 0.55),
    'artery_wall': ((0.72, 0.52, 0.42), 0.5), 'valve': ((0.86, 0.80, 0.62), 0.45), 'chordae': ((0.92, 0.90, 0.84), 0.4),
    'artery': ((0.62, 0.08, 0.06), 0.4), 'vein': ((0.20, 0.13, 0.35), 0.4),
}
mats = {}
def material(t):
    if t not in mats:
        m = bpy.data.materials.new(t); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        col, rough = COLOR[t]; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
        mats[t] = m
    return mats[t]

root = bpy.data.objects.new('heart', None); bpy.context.scene.collection.objects.link(root)
root.scale = (0.001, 0.001, 0.001)
for pid, m in META['parts'].items():
    v = (D[pid + '_v'] - C).astype('f8'); f = D[pid + '_f']
    me = bpy.data.meshes.new(pid); me.from_pydata(v.tolist(), [], f.tolist()); me.update()
    me.shade_smooth() if hasattr(me, 'shade_smooth') else None
    ob = bpy.data.objects.new(pid, me); bpy.context.scene.collection.objects.link(ob); ob.parent = root
    ob.data.materials.append(material(m['tissue']))
    ob.shape_key_add(name='Basis')
    for t in m['targets']:
        k = ob.shape_key_add(name=t); d = D[f'{pid}_t_{t}']
        k.data.foreach_set('co', (v + d).ravel())
    ob['part'] = pid
for ob in bpy.data.objects: ob.select_set(True)
out = os.path.join(HERE, 'out', 'heart.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=False,
                          export_normals=True, export_texcoords=False, export_materials='EXPORT', export_extras=True,
                          export_morph=True, export_morph_normal=True, export_try_sparse_sk=False)
print('[assemble]', len(META['parts']), 'parts ->', out, f'{os.path.getsize(out) / 1e6:.1f} MB')
