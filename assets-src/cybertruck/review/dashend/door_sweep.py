import bpy, sys, math
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree
glb = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
def under(o, node):
    p = o
    while p:
        if p.name == node: return True
        p = p.parent
    return False
def world_bvh(o):
    dg = bpy.context.evaluated_depsgraph_get()
    e = o.evaluated_get(dg); m = e.to_mesh()
    mw = o.matrix_world
    vs = [mw @ v.co for v in m.vertices]
    m.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in m.loop_triangles]
    e.to_mesh_clear()
    return BVHTree.FromPolygons(vs, tris, epsilon=0.0), vs
doors = ('door_fl','door_fr','door_rl','door_rr')
static = [o for o in objs if not any(under(o, k) for k in doors) and o.name.startswith(('int_', 'det_', 'a_pillar')) or o.name in ('steel','cladding')]
static = [o for o in objs if not any(under(o, k) for k in doors)]
sb = {o.name: world_bvh(o)[0] for o in static}
for key in sys.argv[sys.argv.index('--') + 2:]:
    node = bpy.data.objects[key]
    node.rotation_mode = 'QUATERNION'
    rest = node.rotation_quaternion.copy()
    door = [o for o in objs if under(o, key)]
    sign = -1 if key.endswith('l') else 1
    base = None
    print(key)
    for deg in [0, 2, 5, 10, 15, 20, 30, 45, 65]:
        # glTF +y is up; Blender's import turns it into +z of the parent space: rotate about the node's local up
        node.rotation_quaternion = rest @ Quaternion(Vector((0, 0, 1)), math.radians(sign * deg))
        bpy.context.view_layer.update()
        hits = {}
        for d in door:
            bd = world_bvh(d)[0]
            for n, bs in sb.items():
                c = len(bd.overlap(bs))
                if c: hits[(d.name.replace(key + '_', ''), n)] = c
        if base is None: base = hits
        new = {k: v for k, v in hits.items() if k not in base}
        print(f'  {deg:>3}: rest-contacts {len(base)}; new {sorted(new.items(), key=lambda kv: -kv[1])[:6]}')
    print('  closed contacts:', sorted(base.items(), key=lambda kv: -kv[1])[:12])
    node.rotation_quaternion = rest
