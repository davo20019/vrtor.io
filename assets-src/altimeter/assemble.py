"""Assemble the altimeter from parts/ (cad.py, textures.py) into out/altimeter.glb and out/altimeter.json.
  blender -b --factory-startup --python assemble.py

Built in millimetres with the dial facing +z and 12 o'clock at +y, then scaled to metres. glTF is y-up,
so in the GLB the dial faces +y and 12 o'clock points to -z (toward the fingers when worn).

The case is metallic (anodised aluminium): it needs a scene with environment lighting, as /jump has
(its sky probe). In a scene without one, metallic surfaces render black.
"""
import bpy, bmesh, json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARTS, OUT = HERE / 'parts', HERE / 'out'
OUT.mkdir(exist_ok=True)

# Webbing window height: mid-scoop, from the same parameters cad.py uses.
_P = {'scoop_front': 7.0, 'scoop_back': 3.0}
if (HERE / 'params.json').exists():
    _P.update(json.loads((HERE / 'params.json').read_text()))
SLOT_Z = (_P['scoop_back'] + 28.0 - _P['scoop_front']) / 2
STRAP_W, STRAP_T = 38.0, 1.4
DIAL_D = 56.0

bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, rough, coat=0.0, alpha=1.0, normal_map=None, image=None, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.08
    if image:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(image))
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if normal_map:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(normal_map))
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m

def srgb(r, g, b):
    f = lambda c: (c / 255) ** 2.2
    return f(r), f(g), f(b)

M = {
    'case': material('anodised_orange', srgb(236, 104, 28), 0.3, coat=0.2, metallic=1.0),
    'dial': material('dial', (1, 1, 1), 0.6, image=PARTS / 'dial.png'),
    'lens': material('lens', (1, 1, 1), 0.03, alpha=0.025),
    'black': material('needle_black', srgb(20, 20, 20), 0.45),
    'white': material('needle_white', srgb(240, 240, 235), 0.4),
    'pin': material('pin', srgb(90, 60, 40), 0.4),
    'rubber': material('rubber', srgb(18, 18, 18), 0.55),
    'webbing': material('webbing', srgb(22, 22, 22), 0.85, normal_map=PARTS / 'webbing_normal.png'),
}

def stl(name, mat, smooth_angle=35):
    bpy.ops.wm.stl_import(filepath=str(PARTS / f'{name}.stl'))
    o = bpy.context.selected_objects[0]
    o.name = o.data.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return o

case = stl('case', M['case'])
dial = stl('dial', M['dial'])
lens = stl('lens', M['lens'], smooth_angle=60)
pointer = stl('needle_pointer', M['black'])
tail = stl('needle_tail', M['white'])
pin = stl('needle_pin', M['pin'])
oring = stl('oring', M['rubber'], smooth_angle=80)

# Dial UVs: the texture spans the 56 mm disc, seen from the front.
bm = bmesh.new(); bm.from_mesh(dial.data)
uv = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    for l in f.loops:
        x, y = l.vert.co.x, l.vert.co.y
        l[uv].uv = (x / DIAL_D + 0.5, y / DIAL_D + 0.5)
bm.to_mesh(dial.data); bm.free()

# Needle: one node pivoting on the dial axis, so the app can turn it.
needle = bpy.data.objects.new('needle', None)
bpy.context.scene.collection.objects.link(needle)
for o in (pointer, tail, pin):
    o.parent = needle

def sweep(name, path, closed, mat, tile=8.0):
    """A flat strap of webbing along a path of (x, z) points, STRAP_W wide in y.
    A closed path repeats its first section at the end, so the texture has one clean seam."""
    n = len(path)
    pts = path + [path[0]] if closed else path
    verts, faces, uvs = [], [], []
    run = 0.0
    for i, (x, z) in enumerate(pts):
        if i:
            run += math.dist(pts[i - 1], pts[i])
        a = path[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        b = path[(i + 1) % n] if closed else pts[min(i + 1, len(pts) - 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        k = math.hypot(tx, tz) or 1
        nx, nz = -tz / k, tx / k
        for s in (1, -1):                                # one face of the strap, then the other
            for y in (-STRAP_W / 2, STRAP_W / 2):
                verts.append((x + s * nx * STRAP_T / 2, y, z + s * nz * STRAP_T / 2))
                uvs.append((run / tile, (y + STRAP_W / 2) / STRAP_W))
    for i in range(len(pts) - 1):
        o, p = 4 * i, 4 * (i + 1)
        faces += [(o, p, p + 1, o + 1), (o + 3, p + 3, p + 2, o + 2),
                  (o + 2, p + 2, p, o), (o + 1, p + 1, p + 3, o + 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.materials.append(mat)
    uvl = me.uv_layers.new(name='UVMap')
    for li, loop in enumerate(me.loops):
        uvl.data[li].uv = uvs[loop.vertex_index]
    me.validate(); me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.shade_smooth()
    return o

def rounded_rect(x0, x1, z0, z1, r, steps=8):
    pts = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 90), (x1 - r, z0 + r, 0), (x0 + r, z0 + r, -90), (x0 + r, z1 - r, -180)):
        for k in range(steps + 1):
            a = math.radians(a0 - 90 * k / steps)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts

# Hand loop: through the case's slot and around the hand (about 88 x 36 mm in section), as worn.
loop = sweep('strap', rounded_rect(-44, 44, -33, SLOT_Z, 11), True, M['webbing'])

# Pull tab out of the thumb side, folded around the O-ring.
tab = sweep('strap_tab', [(x, SLOT_Z + STRAP_T) for x in (30, 38, 46, 54)], False, M['webbing'])
oring.location = (54 + 15.25, 0, SLOT_Z + STRAP_T)

# To metres.
root = bpy.data.objects.new('altimeter', None)
bpy.context.scene.collection.objects.link(root)
for o in bpy.context.scene.objects:
    if o is not root and o.parent is None:
        o.parent = root
root.scale = (0.001,) * 3

bpy.ops.export_scene.gltf(filepath=str(OUT / 'altimeter.glb'), export_format='GLB',
                          export_cameras=False, export_lights=False, export_apply=True,
                          export_image_format='AUTO')

info = {
    'units': 'metres; glTF frame: dial faces +y, 12 o\'clock toward -z, origin at the case back centre',
    'needle': {'node': 'needle', 'axis': [0, 1, 0],
               'radiansPerMetre': -2 * math.pi / 4000,
               'note': 'needle.rotation.y = altitude_m * radiansPerMetre (clockwise seen from the front)'},
    'caseSize': [0.0635, 0.028, 0.0635],
}
(OUT / 'altimeter.json').write_text(json.dumps(info, indent=2))
print('assemble: wrote', OUT / 'altimeter.glb')
