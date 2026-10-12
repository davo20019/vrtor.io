"""The doors swing clear: each door turned through its opening, every part it carries tested against every fixed part.
  blender -b --factory-startup --python check_doors.py -- out/cybertruck.glb out/cybertruck.json

Each door turns about its own vertical axis (glTF +y) by up to its openDeg, its frameless glass first dropped by its
glassDropMm down its slant, as the app does (apps/cyb: down the pane's slant in the door's frame). A crossing is a
place where a door's surface passes through a fixed one; faces that only rest on one another (every point of the
contact on one plane) are not. Prints each crossing with its extent in mm (x out, h, s back); exits 1 if anything
crosses once the door has started to open (at 1 degree or more). With the door shut, crossings are listed only:
there, parts may rest against each other where they are fitted (the mirror's base against the glass triangle).
"""
import bpy, sys, json, math
from mathutils import Vector, Quaternion, geometry
from mathutils.bvhtree import BVHTree

glb, info_path = sys.argv[sys.argv.index('--') + 1:][:2]
INFO = json.load(open(info_path))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
O = bpy.data.objects
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
DOORS = INFO['doors']

def under(o, n):
    while o:
        if o.name == n:
            return True
        o = o.parent
    return False

def world(o):
    dg = bpy.context.evaluated_depsgraph_get()
    e = o.evaluated_get(dg)
    m = e.to_mesh()
    vs = [o.matrix_world @ v.co for v in m.vertices]
    m.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in m.loop_triangles]
    e.to_mesh_clear()
    return vs, tris

def box(vs, grow=0.0):
    return [min(v.x for v in vs) - grow, min(v.y for v in vs) - grow, min(v.z for v in vs) - grow,
            max(v.x for v in vs) + grow, max(v.y for v in vs) + grow, max(v.z for v in vs) + grow]

def overlaps(a, b):
    return all(a[i] <= b[i + 3] and b[i] <= a[i + 3] for i in range(3))

fixed = {}
for o in meshes:
    if any(under(o, d['node']) for d in DOORS.values()):
        continue
    vs, tris = world(o)
    if tris:
        fixed[o.name] = (vs, tris, BVHTree.FromPolygons(vs, tris), box(vs))

def crossing(vs, tris, name):
    """The extent in mm of where this mesh passes through fixed part name, or None (no contact, or only resting)."""
    fv, ft, fb, _ = fixed[name]
    pts = []
    for i, j in BVHTree.FromPolygons(vs, tris).overlap(fb):
        a = [vs[k] for k in tris[i]]
        b = [fv[k] for k in ft[j]]
        for p, q in ((a, b), (b, a)):
            for e0, e1 in ((p[0], p[1]), (p[1], p[2]), (p[2], p[0])):
                x = geometry.intersect_ray_tri(q[0], q[1], q[2], e1 - e0, e0, True)
                if x and (x - e0).length <= (e1 - e0).length:
                    pts.append(x)
    if not pts:
        return None
    if min(max(getattr(q, ax) for q in pts) - min(getattr(q, ax) for q in pts) for ax in 'xyz') <= 0.001:
        return None
    mm = [(v.x * 1000, v.z * 1000, -v.y * 1000) for v in pts]      # Blender z-up, -y = glTF +z (front)
    rng = lambda i: f'{min(q[i] for q in mm):.0f}..{max(q[i] for q in mm):.0f}'
    return f'x {rng(0)} h {rng(1)} z {rng(2)}'

failed = 0
for key, d in DOORS.items():
    node = O[d['node']]
    node.rotation_mode = 'QUATERNION'
    rest = node.rotation_quaternion.copy()
    parts = [o for o in meshes if under(o, d['node'])]
    pane = O.get(f"{d['node']}_glass")
    # The app's slide for the glass: the pane's slant in the door's frame, along the door no part (glTF z is
    # Blender's local -y), so it is taken out.
    shift_local = Vector()
    if pane and d.get('glassDropMm'):
        inv = node.matrix_world.inverted()
        pts = [inv @ (pane.matrix_world @ v.co) for v in pane.data.vertices]
        z0, z1 = min(q.z for q in pts), max(q.z for q in pts)
        lo = [q for q in pts if q.z < z0 + (z1 - z0) * 0.02]
        hi = [q for q in pts if q.z > z1 - (z1 - z0) * 0.02]
        down = sum(lo, Vector()) / len(lo) - sum(hi, Vector()) / len(hi)
        down.y = 0
        down.normalize()
        unit = 1.0 if (z1 - z0) > 5 else 0.001                         # the door's frame in mm or in m
        shift_local = down * d['glassDropMm'] * unit
    pane_rest = pane.matrix_world.copy() if pane else None
    sign = 1 if d['openDeg'] > 0 else -1
    steps = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, abs(d['openDeg'])]
    for deg in sorted(set(s for s in steps if s <= abs(d['openDeg']))):
        node.rotation_quaternion = rest
        bpy.context.view_layer.update()
        if pane:
            mw = pane_rest.copy()
            mw.translation += node.matrix_world.to_3x3() @ shift_local
            pane.matrix_world = mw
        node.rotation_quaternion = rest @ Quaternion(Vector((0, 0, 1)), math.radians(sign * deg))
        bpy.context.view_layer.update()
        rows = []
        for part in parts:
            vs, tris = world(part)
            if not tris:
                continue
            pb = box(vs, 0.002)
            for name, (_, _, _, fbox) in fixed.items():
                if overlaps(pb, fbox):
                    r = crossing(vs, tris, name)
                    if r:
                        rows.append(f"{part.name} / {name}: {r}")
        if rows:
            label = 'shut, resting' if deg == 0 else 'CROSSES'
            failed += deg > 0
            print(f'check_doors: {key} at {deg:>2} deg {label}: ' + '; '.join(rows))
    node.rotation_quaternion = rest
    if pane:
        pane.matrix_world = pane_rest
print(f'check_doors: {"FAIL" if failed else "PASS"}: {failed} door angles with crossings')
if failed:
    raise SystemExit('check_doors: a door passes through a fixed part as it opens')
