"""Swing each door through its full opening and report every place it passes through a fixed part of the truck.
  blender -b --factory-startup --python door_sweep.py -- <glb> door_fl,door_rl,door_fr,door_rr <glass drop mm>
Each door turns about its own vertical axis (glTF +y), its glass dropped as the app drops it (apps/cyb: down its
slant in the door's frame). A crossing is reported with its extent in mm (x out, h, s back); faces that only touch
along a seam (all the points on one plane) are not. "clear" at an angle means nothing crosses there.
"""
import bpy, sys, math
from mathutils import Vector, Quaternion, geometry
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index('--') + 1:]
DROP = float(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
O = bpy.data.objects
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
def under(o, n):
    while o:
        if o.name == n: return True
        o = o.parent
    return False
def wmesh(o):
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
    vs = [o.matrix_world @ v.co for v in m.vertices]; m.calc_loop_triangles()
    t = [tuple(x.vertices) for x in m.loop_triangles]; e.to_mesh_clear(); return vs, t
DOORS = ('door_fl', 'door_fr', 'door_rl', 'door_rr')
static = {o.name: wmesh(o) for o in objs if not any(under(o, k) for k in DOORS)}
sbvh = {n: BVHTree.FromPolygons(*m) for n, m in static.items()}
def crossing(dv, dt, sn):
    sv, st = static[sn]; pts = []
    for i, j in BVHTree.FromPolygons(dv, dt).overlap(sbvh[sn]):
        A = [dv[k] for k in dt[i]]; B = [sv[k] for k in st[j]]
        for P, Q in ((A, B), (B, A)):
            for e0, e1 in ((P[0], P[1]), (P[1], P[2]), (P[2], P[0])):
                x = geometry.intersect_ray_tri(Q[0], Q[1], Q[2], e1 - e0, e0, True)
                if x and (x - e0).length <= (e1 - e0).length: pts.append(x)
    if not pts: return None
    sp = [max(getattr(q, ax) for q in pts) - min(getattr(q, ax) for q in pts) for ax in 'xyz']
    if min(sp) <= 0.001: return None                         # faces touching on a seam, no depth
    mm = lambda v: (round(v.x * 1000), round(v.z * 1000), round(2695.8 + v.y * 1000))
    W = [mm(q) for q in pts]
    return f"x{min(w[0] for w in W)}..{max(w[0] for w in W)} h{min(w[1] for w in W)}..{max(w[1] for w in W)} s{min(w[2] for w in W)}..{max(w[2] for w in W)}"
bad = 0
for key in a[1].split(','):
    node = O[key]; node.rotation_mode = 'QUATERNION'; rest = node.rotation_quaternion.copy()
    sign = -1 if key.endswith('l') else 1
    g = O[f'{key}_glass']
    # the app's slide: the pane's slant in its door's frame, no longitudinal part (glTF z = Blender local -y)
    inv = node.matrix_world.inverted(); pts = [inv @ (g.matrix_world @ v.co) for v in g.data.vertices]
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    low = sum((p for p in pts if p.z < z0 + 25 / 1000 * 1000 * 0 + (z1 - z0) * 0.02), Vector()); lows = [p for p in pts if p.z < z0 + (z1 - z0) * 0.02]
    highs = [p for p in pts if p.z > z1 - (z1 - z0) * 0.02]
    down = sum(lows, Vector()) / len(lows) - sum(highs, Vector()) / len(highs); down.y = 0; down.normalize()
    # door-local units: millimetres if the door's frame carries the model's mm, else metres
    unit = 1.0 if (z1 - z0) > 5 else 0.001
    g.location = g.location + (g.matrix_parent_inverse.inverted() @ Vector((0, 0, 0))) * 0  # keep
    gl0 = g.matrix_world.copy()
    print(key, 'pane height in door units', round(z1 - z0, 3), 'down', [round(c, 3) for c in down])
    for deg in (0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 65):
        node.rotation_quaternion = rest; bpy.context.view_layer.update()
        g.matrix_world = gl0; bpy.context.view_layer.update()
        shift = node.matrix_world.to_3x3() @ (down * DROP * unit)
        mw = g.matrix_world.copy(); mw.translation += shift; g.matrix_world = mw
        node.rotation_quaternion = rest @ Quaternion(Vector((0, 0, 1)), math.radians(sign * deg)); bpy.context.view_layer.update()
        rows = []
        for d in [o for o in objs if under(o, key)]:
            dv, dt = wmesh(d)
            for sn in static:
                r = crossing(dv, dt, sn)
                if r: rows.append(f"{d.name.replace(key + '_', '')}/{sn} {r}")
        if rows: bad += 1
        print(f'  {deg:>2}:', '; '.join(rows) or 'clear')
    node.rotation_quaternion = rest; g.matrix_world = gl0
print('ANGLES WITH CROSSINGS:', bad)
