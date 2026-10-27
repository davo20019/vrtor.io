"""Headless Blender: the heart's parts to out/heart.glb, every part its own mesh with its morph targets.

blender -b --factory-startup --python assemble.py
The CT frame (x left, y back, z up; mm) is Blender's own (z up): glTF's y-up export turns it into x left, y up,
z front, vrtor's frame. Centred on the walls' bounds and scaled to metres.
Morph targets: vsys (ventricles at end-systole; vsys_0-3 in bands by activation time), afill (atria full;
afill_0-3 likewise), open_<valve> (valve parts). UV u: each vertex's activation time (s on the cycle's clock).
"""
import bpy, json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
D = np.load(os.path.join(HERE, 'work', 'heart_parts.npz')); META = json.load(open(os.path.join(HERE, 'work', 'heart_parts.json')))
C = np.array(META['centre_mm'])
bpy.ops.wm.read_factory_settings(use_empty=True)

# One material per tissue; its colour is in the vertices (surface.py), the material carries how it reflects:
# all wet and glossy (the app adds the clear coat), valves a little translucent.
COLOR = {   # each tissue's roughness differs a little, so the GLB optimiser can't merge two tissues' materials
    'ventricle': ((1, 1, 1), 0.42), 'atrium': ((1, 1, 1), 0.43), 'heart': ((1, 1, 1), 0.45),
    'artery_wall': ((1, 1, 1), 0.40), 'vein_wall': ((1, 1, 1), 0.38), 'valve': ((1, 1, 1), 0.35),
    'chordae': ((1, 1, 1), 0.30), 'artery': ((1, 1, 1), 0.36), 'vein': ((1, 1, 1), 0.37), 'conduction': ((1, 1, 1), 0.41),
}
mats = {}
def material(t):
    if t not in mats:
        m = bpy.data.materials.new(t); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        col, rough = COLOR[t]; b.inputs['Roughness'].default_value = rough
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        m.node_tree.links.new(vc.outputs['Color'], b.inputs['Base Color'])
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
    if pid + '_col' in D.files:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); c4 = np.c_[D[pid + '_col'], np.ones(len(v))]
        ca.data.foreach_set('color', c4.ravel())
    if pid + '_act' in D.files:   # activation time (ms on the cycle's clock) as the first UV channel's u
        uvl = me.uv_layers.new(name='act'); vi = np.zeros(len(me.loops), 'i4'); me.loops.foreach_get('vertex_index', vi)
        act = D[pid + '_act'] / 1000.0; uv = np.c_[act[vi], np.zeros(len(vi))]
        uvl.data.foreach_set('uv', uv.ravel())
    ob.shape_key_add(name='Basis')
    for t in m['targets']:
        k = ob.shape_key_add(name=t); d = D[f'{pid}_t_{t}']
        k.data.foreach_set('co', (v + d).ravel())
    ob['part'] = pid
for ob in bpy.data.objects: ob.select_set(True)
out = os.path.join(HERE, 'out', 'heart.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=False,
                          export_normals=True, export_texcoords=True, export_vertex_color='ACTIVE', export_materials='EXPORT', export_extras=True,
                          export_morph=True, export_morph_normal=True, export_try_sparse_sk=False)
print('[assemble]', len(META['parts']), 'parts ->', out, f'{os.path.getsize(out) / 1e6:.1f} MB')
