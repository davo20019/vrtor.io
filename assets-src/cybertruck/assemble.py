"""Assemble the Cybertruck from parts/ (cad.py, textures.py) into out/cybertruck.glb and out/cybertruck.json.
  blender -b --factory-startup --python assemble.py

cad.py builds in millimetres with the front on +z, up +y, +x on the truck's left. Blender's glTF exporter
turns Blender's z-up into glTF's y-up, (x, y, z) -> (x, z, -y), so every mesh and node position is moved into
Blender's frame as (x, -z, y) on import. The GLB then stands y-up with its front on +z, the usual frame for
a vehicle, and every node has identity rotation: steer_* turns about its own +y, wheel_* spins about its +x.
The .json writes the frame.

The steel is metallic brushed stainless: it needs a scene with environment lighting (a sky or a reflection
probe, as /jump has). Without one, metallic surfaces render black.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PARTS, OUT = HERE / 'parts', HERE / 'out'
OUT.mkdir(exist_ok=True)
GEO = json.loads((PARTS / 'geometry.json').read_text())

bpy.ops.wm.read_factory_settings(use_empty=True)

def srgb(r, g, b):
    f = lambda c: (c / 255) ** 2.2
    return f(r), f(g), f(b)

def material(name, color, rough, metallic=0.0, emit=None, emit_strength=0.0, normal_map=None, rough_map=None, normal_strength=1.0, alpha=1.0, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_strength
    if image:                            # a lit display: the picture is both its colour and its glow
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(image))
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        nt.links.new(t.outputs['Color'], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = 0.8
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if rough_map:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(rough_map))
        t.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(t.outputs['Color'], p.inputs['Roughness'])
    if normal_map:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(normal_map))
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m

M = {
    'steel': material('brushed_stainless', srgb(196, 196, 192), 0.33, metallic=1.0, rough_map=PARTS / 'steel_rough.png'),
    'liner': material('wheel_well_black', srgb(22, 22, 23), 0.85),
    'glass': material('glass_tinted', srgb(8, 9, 10), 0.04, alpha=0.3),      # see-through, so the cabin shows and a visitor inside sees out
    'cabin': material('cabin_charcoal', srgb(38, 38, 40), 0.85),
    'trim_white': material('trim_white', srgb(222, 222, 216), 0.5),
    'dash_top': material('dash_suede', srgb(48, 48, 50), 0.95),
    'ambient': material('ambient_light', srgb(240, 240, 255), 0.3, emit=(0.85, 0.9, 1.0), emit_strength=3.0),
    'seat': material('seat_black', srgb(30, 30, 31), 0.55),
    'yoke': material('yoke_black', srgb(22, 22, 22), 0.45),
    'screen': material('screen_off', srgb(6, 7, 8), 0.08),
    'bezel': material('screen_bezel', srgb(15, 15, 15), 0.4),
    'console': material('console_grey', srgb(70, 70, 72), 0.6),
    'screen_on': material('screen_on', (1, 1, 1), 0.12, emit=(1, 1, 1), emit_strength=0.0, image=PARTS / 'screen.png'),
    'armrest': material('armrest_grey', srgb(52, 52, 54), 0.6),
    'switch': material('switch_grey', srgb(150, 150, 152), 0.35),
    'grille': material('speaker_grille', srgb(28, 28, 30), 0.9),
    'pedal': material('pedal_metal', srgb(140, 140, 142), 0.35, metallic=1.0),
    'silver': material('satin_silver', srgb(168, 168, 170), 0.35, metallic=0.6),
    'carpet': material('carpet_black', srgb(20, 20, 21), 1.0),
    'door_dark': material('door_panel_dark', srgb(34, 34, 36), 0.7),
    'mat': material('floor_mat', srgb(24, 24, 25), 0.95),
    'pillar': material('pillar_black', srgb(14, 14, 15), 0.45),
    'door_button': material('door_button', srgb(10, 10, 11), 0.15),
    'marker_amber': material('marker_amber', srgb(230, 120, 20), 0.2, emit=(1.0, 0.45, 0.05), emit_strength=0.5),
    'marker_red': material('marker_red', srgb(150, 15, 12), 0.2, emit=(1.0, 0.05, 0.03), emit_strength=0.4),
    'clad': material('cladding_black', srgb(32, 32, 34), 0.72),
    'tonneau': material('tonneau_black', srgb(26, 26, 28), 0.5, normal_map=PARTS / 'tonneau_normal.png', normal_strength=0.6),
    'light_w': material('light_front', srgb(235, 238, 245), 0.2, emit=(1, 1, 1), emit_strength=6.0),
    'light_r': material('light_rear', srgb(70, 8, 8), 0.15, emit=(1, 0.05, 0.03), emit_strength=0.6),
    'mirror': material('mirror_black', srgb(20, 20, 21), 0.35),
    'wiper': material('wiper_black', srgb(18, 18, 18), 0.6),
    'tyre': material('rubber', srgb(30, 30, 30), 0.88, normal_map=PARTS / 'tyre_normal.png'),
    'rim': material('rim_satin_black', srgb(38, 38, 40), 0.45),
    'lug': material('lug_chrome', srgb(220, 220, 220), 0.2, metallic=1.0),
    'cover': material('aero_cover_black', srgb(28, 28, 30), 0.6),
    'disc': material('brake_disc', srgb(70, 68, 66), 0.6, metallic=1.0),
    'caliper': material('caliper_silver', srgb(175, 175, 175), 0.4, metallic=0.6),
}

TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # model (x, y, z) -> Blender (x, -z, y)

def to_blender(v):
    return (v[0], -v[2], v[1])

def stl(name, mat, smooth_angle=20):
    bpy.ops.wm.stl_import(filepath=str(PARTS / f'{name}.stl'))
    o = bpy.context.selected_objects[0]
    o.name = o.data.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return o

def box_uv(o, tile_mm=600.0):
    """Planar projection per face along its dominant axis; u runs along the truck where it can (brush grain)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            x, y, z = l.vert.co
            l[uv].uv = {0: (z, y), 1: (z, x), 2: (x, y)}[ax]
            l[uv].uv = (l[uv].uv[0] / tile_mm, l[uv].uv[1] / tile_mm)
    bm.to_mesh(o.data); bm.free()

def inside(pt, poly, grow=2.0):
    """Point (z, y) inside a convex polygon grown by `grow` mm."""
    n = len(poly)
    cz = sum(p[0] for p in poly) / n; cy = sum(p[1] for p in poly) / n
    for i in range(n):
        (z0, y0), (z1, y1) = poly[i], poly[(i + 1) % n]
        ez, ey = z1 - z0, y1 - y0
        nz, ny = ey, -ez
        k = math.hypot(nz, ny); nz, ny = nz / k, ny / k
        if (cz - z0) * nz + (cy - y0) * ny > 0:
            nz, ny = -nz, -ny
        if (pt[0] - z0) * nz + (pt[1] - y0) * ny > grow:
            return False
    return True

# ---------------------------------------------------------------- body

body = stl('body', M['steel'])
body.name = body.data.name = 'steel'      # the node 'body' is the group holding every body part
box_uv(body)
PLANES = [(Vector(pt), Vector(n)) for pt, n in GEO['planes']]
def depth(c):
    """How far inside the outer skin a point is (mm): the least distance to any facet plane."""
    return min(-(c - pt).dot(n) for pt, n in PLANES)
def classify(o):
    """Steel outside; wheel-well walls and the underside black; the cabin's walls (and seams) dark trim."""
    if len(o.data.materials) < 3:
        o.data.materials.append(M['liner'])
        o.data.materials.append(M['cabin'])
    bm = bmesh.new(); bm.from_mesh(o.data)
    for f in bm.faces:
        c = f.calc_center_median()
        in_arch = abs(c.x) < GEO['bodyHalf'] - 1 and any(inside((c.z, c.y), poly) for poly in GEO['arches'].values())
        if in_arch or f.normal.y < -0.9:
            f.material_index = 1
        elif depth(c) > 15:              # pockets are 8 mm deep; anything deeper is a cut into the cabin or a seam
            f.material_index = 2
    bm.to_mesh(o.data); bm.free()
classify(body)

glass = stl('glass', M['glass'])
tonneau = stl('tonneau', M['tonneau']); box_uv(tonneau, tile_mm=800)
lf = stl('light_front', M['light_w'])
lr = stl('light_rear', M['light_r'])
clad = stl('cladding', M['clad'])
mirrors = stl('mirrors', M['mirror'], smooth_angle=30) if (PARTS / 'mirrors.stl').exists() else None
wiper = stl('wiper', M['wiper'])
INTERIOR = {'trim_white': 'trim_white', 'dash_top': 'dash_top', 'dash_face': 'console', 'dash_vent': 'grille', 'ambient': 'ambient',
            'dash_white': 'trim_white', 'dash_lower': 'armrest', 'screen_bezel': 'bezel', 'screen': 'screen_on', 'screen_stand': 'bezel',
            'yoke': 'yoke', 'yoke_chin': 'silver', 'yoke_pods': 'bezel', 'yoke_keys': 'pedal',
            'console': 'console', 'chargers': 'screen', 'rear_vents': 'silver', 'rear_screen': 'screen_on',
            'seats_front': 'seat', 'seats_rear': 'seat', 'seat_base': 'armrest', 'seat_knobs': 'switch', 'rear_armrest': 'seat',
            'headliner': 'dash_top', 'pillar_trim': 'dash_top', 'rear_wall': 'dash_top', 'visors': 'dash_top',
            'overhead': 'yoke', 'rear_mirror': 'yoke', 'carpet': 'carpet', 'mats': 'mat', 'pedals': 'pedal',
            # on the doors (door_<k>_int_<name>)
            'armrest': 'armrest', 'door_lower': 'door_dark', 'switch_pod': 'bezel', 'switch': 'door_button', 'open': 'door_button',
            'cap': 'pillar', 'grilles': 'grille'}
cabin_parts = [stl(f'int_{n}', M[m], smooth_angle=25) for n, m in INTERIOR.items() if (PARTS / f'int_{n}.stl').exists()]
for o in cabin_parts:                    # the screens: the picture spans each screen's face
    sc_ = GEO['screens'].get(o.name[4:])
    if not sc_:
        continue
    c0, u, v, (w, h) = Vector(sc_['centre']), Vector(sc_['u']), Vector(sc_['v']), sc_['size']
    bm = bmesh.new(); bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            q = l.vert.co - c0
            l[uvl].uv = (q.dot(u) / w + 0.5, q.dot(v) / h + 0.5)
    bm.to_mesh(o.data); bm.free()
DETAILS = {'pillars': 'pillar', 'marker_amber': 'marker_amber', 'marker_red': 'marker_red'}
detail_parts = [stl(f'det_{n}', M[m], smooth_angle=20) for n, m in DETAILS.items()]
# The outside door-release buttons, one object each (btn_fl...), so the app can tell which was pressed.
button_parts = []
for k in GEO['doors']:
    o = stl(f'det_btn_{k}', M['door_button'], smooth_angle=20)
    o.name = o.data.name = f'btn_{k}'
    button_parts.append(o)
# Doors: everything that swings with each door, by the part's material.
DOOR_PARTS = {'steel': 'steel', 'glass': 'glass', 'mirror': 'mirror'}
door_parts = {}
for k in GEO['doors']:
    door_parts[k] = []
    files = [(sfx, M[m]) for sfx, m in DOOR_PARTS.items()]
    files += sorted((f.stem[len(f'door_{k}_'):], M[INTERIOR[f.stem[len(f'door_{k}_int_'):]]]) for f in PARTS.glob(f'door_{k}_int_*.stl'))
    for suffix, mat in files:
        f = PARTS / f'door_{k}_{suffix}.stl'
        if not f.exists():
            continue
        o = stl(f'door_{k}_{suffix}', mat, smooth_angle=20 if suffix == 'steel' else 25)
        if suffix == 'steel':
            box_uv(o); classify(o)
        if suffix == 'int_open':
            o.name = o.data.name = f'open_{k}'          # the door-open button on the inside handle
        door_parts[k].append(o)

# ---------------------------------------------------------------- wheels

tyre = stl('tyre', M['tyre'], smooth_angle=50)
bm = bmesh.new(); bm.from_mesh(tyre.data)
uv = bm.loops.layers.uv.verify()
HW, R0, R1 = 142.5, 258.0, 439.25
for f in bm.faces:                       # tread: u round the tyre, v across; sidewall: v from bead to shoulder
    n = f.normal
    tread = abs(n.x) < 0.5
    for l in f.loops:
        x, y, z = l.vert.co
        a = math.atan2(z, y) / (2 * math.pi) % 1.0
        r = math.hypot(y, z)
        v = 0.6 * (x + HW) / (2 * HW) if tread else 0.6 + 0.4 * min(max((r - R0) / (R1 - R0), 0), 1)
        l[uv].uv = (a, v)
bm.to_mesh(tyre.data); bm.free()
rim = stl('rim', M['rim'], smooth_angle=35)
lugs = stl('lugs', M['lug'], smooth_angle=50)
cover = stl('cover', M['cover'], smooth_angle=10)
disc = stl('brake_disc', M['disc'], smooth_angle=50)
caliper = stl('caliper', M['caliper'])
templates = (tyre, rim, lugs, cover, disc, caliper)
all_door_parts = [o for v in door_parts.values() for o in v]
for o in [x for x in (body, glass, tonneau, lf, lr, clad, mirrors, wiper) if x] + [*cabin_parts, *detail_parts, *button_parts, *all_door_parts, *templates]:
    o.data.transform(TO_BLENDER)         # UVs and materials were set in the model frame; now move to Blender's

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.parent = parent
    return e

root = empty('cybertruck')
body_node = empty('body', parent=root)
for o in [x for x in (body, glass, tonneau, lf, lr, clad, mirrors, wiper) if x] + [*detail_parts, *button_parts]:
    o.parent = body_node
# Each door hangs on a node at its hinge (its front edge); turning that node about its own +y swings it.
for k, d in GEO['doors'].items():
    hinge = Vector(to_blender(d['hinge']))
    node = empty(f'door_{k}', loc=hinge, parent=root)
    for o in door_parts[k]:
        o.parent = node
        o.location = -hinge                              # meshes are in the truck's frame; the node holds the hinge
cabin_node = empty('cabin', parent=root)
for o in cabin_parts:
    o.parent = cabin_node

def linked(src, name, parent, flip):
    o = src.copy()                       # shares the mesh: stored once in the GLB
    o.name = name
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    o.location = (0, 0, 0)
    o.rotation_euler = (0, 0, math.pi if flip else 0)   # half a turn about the truck's up (Blender z)
    return o

for key, c in GEO['wheels'].items():
    flip = key.endswith('r')             # parts are built for the left side (outboard +x)
    steer = empty(f'steer_{key}', loc=to_blender(c), parent=root)
    wheel = empty(f'wheel_{key}', parent=steer)
    linked(tyre, f'tyre_{key}', wheel, flip)
    linked(rim, f'rim_{key}', wheel, flip)
    linked(lugs, f'lugs_{key}', wheel, flip)
    linked(cover, f'cover_{key}', wheel, flip)
    linked(disc, f'brake_disc_{key}', steer, flip)
    linked(caliper, f'caliper_{key}', steer, flip)
for t in templates:
    bpy.data.objects.remove(t)

root.scale = (0.001,) * 3

bpy.ops.export_scene.gltf(filepath=str(OUT / 'cybertruck.glb'), export_format='GLB',
                          export_cameras=False, export_lights=False, export_apply=True,
                          export_image_format='AUTO')

info = {
    'units': 'metres',
    'frame': 'glTF y-up: the truck stands on y = 0 with its up on +y, its front on +z and its left side on +x; origin midway between the axles',
    'wheels': {k: {'centre': [v * 0.001 for v in c]} for k, c in GEO['wheels'].items()},
    'spin': {'nodes': [f'wheel_{k}' for k in GEO['wheels']], 'axis': [1, 0, 0],
             'note': 'wheel_*.rotation.x += distance_m / 0.424 (rolling radius 0.424 m; positive rolls forward)'},
    'steer': {'nodes': ['steer_fl', 'steer_fr', 'steer_rl', 'steer_rr'], 'axis': [0, 1, 0],
              'note': 'steer_*.rotation.y = angle; pivot is the vertical line through the wheel centre (the real kingpin axis is not published). Rear steer limits are not published either.'},
    'covers': {'nodes': [f'cover_{k}' for k in GEO['wheels']], 'note': 'aero covers: set visible = false to show the bare rims'},
    'lights': {'front': 'light_front (emissive white)', 'rear': 'light_rear (emissive red, low)'},
    'material': 'brushed stainless is metallic: the scene needs environment lighting',
    'seatEyes': {k: [v * 0.001 for v in c] for k, c in GEO['seatEyes'].items()},
    'doors': {k: {'node': f'door_{k}', 'hinge': [v * 0.001 for v in d['hinge']], 'openDeg': d['openDeg'],
                  'buttons': [f'btn_{k}', f'open_{k}'],
                  'note': 'door_*.rotation about its own +y by openDeg opens it (front-hinged, swings outward); btn_* is the outside release button on the pillar behind the door, open_* the button on the inside handle'}
              for k, d in GEO['doors'].items()},
    'cabin': 'node "cabin": seats, dash, yoke, screens, trim (placed from the manual cabin sizes and video frames, not a replica); the glass is see-through (alpha 0.3)',
}
(OUT / 'cybertruck.json').write_text(json.dumps(info, indent=2))
print('assemble: wrote', OUT / 'cybertruck.glb')
