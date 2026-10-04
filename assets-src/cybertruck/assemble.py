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
    # The dash top and pillars are mid-grey suede in the walkaround frames (dgRcedIkNOM-14, -30, -31), not charcoal.
    'dash_top': material('dash_suede', srgb(78, 78, 80), 0.97, normal_map=PARTS / 'suede_normal.png', normal_strength=0.5),
    'ambient': material('ambient_light', srgb(240, 240, 255), 0.3, emit=(0.85, 0.9, 1.0), emit_strength=3.0),
    'seat': material('seat_black', srgb(30, 30, 31), 0.5, normal_map=PARTS / 'leather_normal.png', normal_strength=0.6),
    'yoke': material('yoke_black', srgb(22, 22, 22), 0.45),
    'yoke_pod': material('yoke_pod', (1, 1, 1), 0.3, image=PARTS / 'yoke_icons.png'),     # gloss black with the printed symbols
    'yoke_face': material('yoke_horn_face', srgb(62, 62, 64), 0.4),                          # the recessed face on the pad, lighter in the manual render
    'screen': material('screen_off', srgb(6, 7, 8), 0.08),
    'bezel': material('screen_bezel', srgb(15, 15, 15), 0.4),
    'console': material('console_grey', srgb(70, 70, 72), 0.6),
    'screen_on': material('screen_on', (1, 1, 1), 0.12, emit=(1, 1, 1), emit_strength=0.0, image=PARTS / 'screen.png'),
    'armrest': material('armrest_grey', srgb(52, 52, 54), 0.55, normal_map=PARTS / 'leather_normal.png', normal_strength=0.5),
    'switch': material('switch_grey', srgb(150, 150, 152), 0.35),
    'piping': material('seat_piping', srgb(176, 176, 174), 0.45),          # the light grey piping on the seats (dgRcedIkNOM-13)
    'belt': material('belt_webbing', srgb(34, 34, 36), 0.8),
    # The shelf in front of the driver is a fine woven finish, like carbon fibre (dgRcedIkNOM-14), not suede.
    'dash_shelf': material('dash_weave', srgb(70, 70, 72), 0.75, normal_map=PARTS / 'weave_normal.png', normal_strength=0.7),
    'overhead': material('mirror_mount_grey', srgb(118, 118, 120), 0.6),
    'mirror_glass': material('mirror_glass', srgb(235, 235, 235), 0.04, metallic=1.0),    # the mirror mount's housing, light grey in the dash render
    'grille': material('speaker_grille', srgb(28, 28, 30), 0.9),
    # brushed aluminium, light in the manual render; fully metallic it mirrored the dark footwell and read black
    'pedal': material('pedal_metal', srgb(176, 176, 178), 0.4, metallic=0.6),
    'silver': material('satin_silver', srgb(168, 168, 170), 0.35, metallic=0.6),
    'carpet': material('carpet_black', srgb(26, 26, 27), 1.0, normal_map=PARTS / 'carpet_normal.png', normal_strength=0.8),
    'door_dark': material('door_panel_dark', srgb(34, 34, 36), 0.7),
    'mat': material('floor_mat', srgb(30, 30, 31), 0.95, normal_map=PARTS / 'carpet_normal.png', normal_strength=0.5),
    'pillar': material('pillar_black', srgb(14, 14, 15), 0.45),
    'door_button': material('door_button', srgb(10, 10, 11), 0.15),
    'marker_amber': material('marker_amber', srgb(230, 120, 20), 0.2, emit=(1.0, 0.45, 0.05), emit_strength=0.5),
    'lamp_lower': material('lamp_lower_smoked', srgb(22, 22, 24), 0.12),
    'marker_red': material('marker_red', srgb(150, 15, 12), 0.2, emit=(1.0, 0.05, 0.03), emit_strength=0.4),
    'clad': material('cladding_black', srgb(32, 32, 34), 0.72),
    'tonneau': material('tonneau_black', srgb(26, 26, 28), 0.5, normal_map=PARTS / 'tonneau_normal.png', normal_strength=0.6),
    'slat': material('tonneau_slat', srgb(26, 26, 28), 0.5),
    'bed': material('bed_liner', srgb(34, 34, 36), 0.8),
    'bed_floor': material('bed_floor', srgb(34, 34, 36), 0.8, normal_map=PARTS / 'bedfloor_normal.png', normal_strength=0.8),
    'bed_light': material('bed_light', srgb(235, 238, 245), 0.2, emit=(1, 1, 1), emit_strength=4.0),
    'switch_key': material('switch_key', srgb(40, 40, 42), 0.3),
    'tiedown': material('tiedown_metal', srgb(70, 70, 72), 0.45, metallic=0.7),
    'outlets': material('bed_outlets', (1, 1, 1), 0.5, image=PARTS / 'outlets.png'),
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
wiper_blade = stl('wiper_blade', M['wiper'])           # the arm and blade, on their own node (wiper_arm)
# The bed: its liner (the floor faces ribbed, along the truck), the LED strips, the switch on the left sail.
liner = stl('bed_liner', M['bed'])
liner.data.materials.append(M['bed_floor'])
bm = bmesh.new(); bm.from_mesh(liner.data)
floor_h = min(v.co.y for v in bm.verts)
for f in bm.faces:
    if f.normal.y > 0.9 and f.calc_center_median().y < floor_h + 10:
        f.material_index = 1
bm.to_mesh(liner.data); bm.free()
box_uv(liner, tile_mm=800)
bed_lights = stl('bed_lights', M['bed_light'])
bed_parts = [liner, bed_lights, stl('det_tonneau_switch', M['door_button'])]
for k in ('tonneau_open', 'tonneau_close', 'tailgate'):
    o = stl(f'det_btn_{k}', M['switch_key'], smooth_angle=20)
    o.name = o.data.name = f'btn_{k}'
    bed_parts.append(o)
M['outlets'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0   # printed, not lit
bed_parts += [stl('bed_tub', M['bed']), stl('bed_plug', M['clad']), stl('bed_tiedowns', M['tiedown'], smooth_angle=30),
              stl('pillar_black', M['clad']), stl('pillar_red', M['light_r'])]
slat = stl('slat', M['slat'])

def planar_uv(o, axes, flip_u=False):
    """UVs spanning a flat part: u, v along the model axes given (0 x, 1 y, 2 z), 0 to 1 across it."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    lo = [min(v.co[a] for v in bm.verts) for a in axes]; hi = [max(v.co[a] for v in bm.verts) for a in axes]
    for f in bm.faces:
        for l in f.loops:
            u, v = ((l.vert.co[a] - lo[i]) / (hi[i] - lo[i]) for i, a in enumerate(axes))
            l[uvl].uv = (1 - u if flip_u else u, v)
    bm.to_mesh(o.data); bm.free()

# Hinged parts (GEO['hinges']): the tailgate with its steel, liner, light band, rail ends and emergency
# release; the under-bed compartment's lid; the outlet cover on the left wall.
gate_steel = stl('gate_steel', M['steel'])
box_uv(gate_steel); classify(gate_steel)
gate_liner = stl('gate_liner', M['bed_floor'])
bm = bmesh.new(); bm.from_mesh(gate_liner.data)            # ribs run up the gate: along the floor once it's down
uvl = bm.loops.layers.uv.verify()
for f in bm.faces:
    for l in f.loops:
        l[uvl].uv = (l.vert.co.y / 800, l.vert.co.x / 800)
bm.to_mesh(gate_liner.data); bm.free()
hinged = {'tailgate': [gate_steel, gate_liner, stl('gate_light', M['light_r']), stl('gate_release', M['door_button'])]}
if (PARTS / 'gate_tonneau.stl').exists():
    o = stl('gate_tonneau', M['tonneau']); box_uv(o, tile_mm=800); hinged['tailgate'].append(o)
lid = stl('lid_liner', M['bed_floor']); box_uv(lid, tile_mm=800)
hinged['bedlid'] = [lid, stl('lid_under', M['bed']), stl('lid_grip', M['door_button'])]
plate = stl('outlet_plate', M['outlets']); planar_uv(plate, (2, 1))
bed_parts.append(plate)
cover_panel = stl('outlet_cover', M['bed'])
cover_panel.name = cover_panel.data.name = 'outlet_cover_panel'      # the node is 'outlet_cover'
hinged['outlet_cover'] = [cover_panel]
INTERIOR = {'trim_white': 'trim_white', 'dash_top': 'dash_shelf', 'dash_face': 'console', 'dash_vent': 'grille', 'ambient': 'ambient',
            'dash_white': 'trim_white', 'dash_lower': 'armrest', 'screen_bezel': 'bezel', 'screen': 'screen_on', 'screen_stand': 'bezel',
            'yoke': 'yoke', 'yoke_pad': 'yoke', 'yoke_column': 'yoke', 'yoke_chin': 'silver', 'yoke_face': 'yoke_face',
            'yoke_pods': 'yoke_pod', 'yoke_trim': 'silver', 'yoke_keys': 'switch_key',
            'yoke_btn_signal_right': 'yoke_pod', 'yoke_btn_signal_left': 'yoke_pod', 'yoke_btn_high_beam': 'yoke_pod', 'yoke_btn_wiper': 'yoke_pod',
            'console': 'console', 'chargers': 'screen', 'rear_vents': 'silver', 'rear_screen': 'screen_on',
            'seats_front': 'seat', 'seats_rear': 'seat', 'seat_base': 'armrest', 'seat_knobs': 'switch', 'rear_armrest': 'seat',
            'headliner': 'dash_top', 'pillar_trim': 'dash_top', 'rear_wall': 'dash_top', 'visors': 'dash_top',
            'overhead': 'overhead', 'rear_mirror': 'yoke', 'carpet': 'carpet', 'mats': 'mat', 'pedals': 'pedal', 'pedal_grips': 'yoke', 'pedal_arms': 'tiedown',
            'piping': 'piping', 'belts': 'belt', 'belt_hw': 'bezel',
            'overhead_strip': 'bezel', 'overhead_keys': 'switch', 'overhead_arms': 'overhead', 'mirror_glass': 'mirror_glass', 'tweeters': 'grille', 'usb': 'screen',
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
for o in cabin_parts:                    # printed symbols: the texture spans its rectangle on the part's face
    dc = GEO.get('decals', {}).get(o.name[4:])
    if not dc:
        continue
    c0, u, v, (w, h) = Vector(dc['centre']), Vector(dc['u']).normalized(), Vector(dc['v']).normalized(), dc['size']
    bm = bmesh.new(); bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            q = l.vert.co - c0
            l[uvl].uv = (q.dot(u) / w + 0.5, q.dot(v) / h + 0.5)
    bm.to_mesh(o.data); bm.free()
DETAILS = {'pillars': 'pillar', 'frit': 'pillar', 'lamp_lower': 'lamp_lower', 'marker_amber_l': 'marker_amber', 'marker_amber_r': 'marker_amber', 'marker_red': 'marker_red'}
detail_parts = [stl(f'det_{n}', M[m], smooth_angle=20) for n, m in DETAILS.items()]
# The outside door-release buttons, one object each (btn_fl...), so the app can tell which was pressed.
button_parts = []
for k in GEO['doors']:
    o = stl(f'det_btn_{k}', M['door_button'], smooth_angle=20)
    o.name = o.data.name = f'btn_{k}'
    button_parts.append(o)
# Doors: everything that swings with each door, by the part's material.
DOOR_PARTS = {'steel': 'steel', 'glass': 'glass', 'mirror': 'mirror', 'mirrorglass': 'mirror_glass'}
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

def face_uv(o):
    """UVs spanning a flat pane seen from behind: u across it along +x, v up."""
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    bm = bmesh.new(); bm.from_mesh(o.data)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            l[uvl].uv = ((l.vert.co.x - x0) / (x1 - x0), (l.vert.co.y - y0) / (y1 - y0))
    bm.to_mesh(o.data); bm.free()

# The mirrors' glass: the app shows a live view behind each (apps/cyb), on these UVs.
for o in [*cabin_parts, *[q for v in door_parts.values() for q in v]]:
    if o.name.endswith('mirror_glass') or o.name.endswith('mirrorglass'):
        face_uv(o)

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
for o in [x for x in (body, glass, tonneau, lf, lr, clad, mirrors, wiper, wiper_blade, slat) if x] + [*cabin_parts, *detail_parts, *button_parts, *bed_parts, *all_door_parts, *templates, *[q for v in hinged.values() for q in v]]:
    o.data.transform(TO_BLENDER)         # UVs and materials were set in the model frame; now move to Blender's

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.parent = parent
    return e

root = empty('cybertruck')
body_node = empty('body', parent=root)
for o in [x for x in (body, glass, tonneau, lf, lr, clad, mirrors, wiper) if x] + [*detail_parts, *button_parts, *bed_parts]:
    o.parent = body_node
wiper_pivot = Vector(to_blender(GEO['wiper']['pivot']))
wiper_node = empty('wiper_arm', loc=wiper_pivot, parent=root)
wiper_blade.parent = wiper_node
wiper_blade.location = -wiper_pivot
for k, h in GEO['hinges'].items():
    hinge = Vector(to_blender(h['hinge']))
    node = empty(k, loc=hinge, parent=root)
    for o in hinged[k]:
        o.parent = node
        o.location = -hinge
# The tonneau's slats, one mesh shared, each on its own node at its closed place: the app moves each one
# along the track (GEO['tonneau']['path']) and turns it to the track's direction there.
TON = GEO['tonneau']
cover_node = empty('tonneau_cover', parent=root)
for i, (z, h) in enumerate(TON['slats']):
    (z0, h0), (z1, h1) = TON['path'][0], TON['path'][1]
    o = slat.copy()
    o.name = f'slat_{i:02d}'
    bpy.context.scene.collection.objects.link(o)
    o.parent = cover_node
    o.location = to_blender((0, h, z))
    o.rotation_euler = (math.atan2(-(h1 - h0), z1 - z0), 0, 0)    # its front edge along the deck, toward the cab
bpy.data.objects.remove(slat)
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
bpy.context.view_layer.update()

# ---------------------------------------------------------------- the cabin: rounded edges, baked light
# Padded and moulded parts get rounded edges (width in mm; only creases sharper than 25 degrees), with
# hardened normals so their flat faces stay flat. Then the light each cabin surface gets through the glass
# from an even sky (direct and bounced) is baked into one texture, exported as the glTF occlusion map on a
# second UV set: the app multiplies its lights by it, so corners, footwells and the underside of the roof
# go dark and the faces open to the windows stay bright, as in the real cabin.
ROUND = {'seats_front': 24, 'seats_rear': 24, 'rear_armrest': 14, 'dash_white': 28, 'console': 10, 'seat_base': 8,
         'dash_top': 6, 'dash_lower': 6, 'dash_face': 4, 'yoke': 9, 'yoke_column': 5, 'visors': 8, 'screen_bezel': 3, 'overhead': 6,
         'armrest': 14, 'door_lower': 6, 'trim_white': 14, 'cap': 6}
NO_BAKE = ('screen', 'rear_screen', 'ambient', 'chargers', 'open', 'switch', 'mirror_glass',
           'yoke_btn_signal_right', 'yoke_btn_signal_left', 'yoke_btn_high_beam', 'yoke_btn_wiper')     # the yoke's keys: baked alone they came out darker than the pod round them

def part_key(o):
    n = o.name
    if n.startswith('open_'):
        return 'open'
    return n.split('_int_', 1)[1] if '_int_' in n else n[4:] if n.startswith('int_') else n

ROUND_SEGMENTS = {'yoke': 5}             # the rim: a padded grip, round in section, not a bevelled plate

def round_edges(o, width, segments=3):
    for m in list(o.modifiers):          # smooth-by-angle would mark the rounded edges sharp again; hardened normals shade instead
        o.modifiers.remove(m)
    mod = o.modifiers.new('round', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(25)
    mod.harden_normals = True
    mod.use_clamp_overlap = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)

def gltf_output():
    g = bpy.data.node_groups.get('glTF Material Output')
    if not g:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        g.nodes.new('NodeGroupInput')
    return g

def bake_cabin(objs, hide, size=2048):
    for o in objs:
        if not o.data.uv_layers:         # the exporter numbers UV sets in order: the light map must be the second
            box_uv(o, tile_mm=250)       # the leather, suede and carpet maps tile every 250 mm
        o.data.uv_layers[0].active_render = True
        o.data.uv_layers.new(name='light')
        o.data.uv_layers.active = o.data.uv_layers['light']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(shape_method='CONCAVE', margin_method='FRACTION', margin=0.002, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('cabin_light', size, size, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    copies = {}
    for o in objs:                       # the cabin's own copies of its materials: others (outside, buttons) have no light map
        for slot in o.material_slots:
            m = slot.material
            if m.name not in copies:
                c = m.copy()
                c.name = f'{m.name}_cabin'
                nt = c.node_tree
                uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'light'
                t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.name = 'cabin_light'
                nt.links.new(uvn.outputs['UV'], t.inputs['Vector'])
                for n in nt.nodes:
                    n.select = False
                t.select = True
                nt.nodes.active = t
                copies[m.name] = c
            slot.material = copies[m.name]
    sc = bpy.context.scene
    world = bpy.data.worlds.new('bake_sky'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sc.world = world
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 512
    try:
        sc.cycles.device = 'GPU'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
    except Exception:
        pass
    for o in hide:                       # the light comes in through the windows; the screens and strips don't light it
        o.hide_render = True
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, use_clear=True)
    for o in hide:
        o.hide_render = False
    # As light it's right but too dark to show: inside a cabin the eye adapts. Faces getting 45% of the open
    # sky become 1, the rest follow a square root, so a footwell (1%) stays at 0.15 and the median face (9%) 0.45.
    import numpy as np
    a = np.array(img.pixels[:]).reshape(size, size, 4)
    # The bake's sampling noise, smoothed within each piece (blurred light over blurred coverage, so the
    # empty space round a piece doesn't darken its edges).
    light = a[:, :, 0].copy()
    cover = (light > 1e-6).astype(float)         # the bake sets alpha everywhere; empty space stays exactly 0
    def blur(x, r=3, sigma=1.6):
        k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma ** 2)); k /= k.sum()
        for axis in (0, 1):
            x = sum(np.roll(x, i - r, axis=axis) * k[i] for i in range(2 * r + 1))
        return x
    smooth = np.where(cover > 0, blur(light * cover) / np.maximum(blur(cover), 1e-4), 0)
    a[:, :, :3] = np.minimum(1.0, np.sqrt(np.maximum(smooth, 0) / 0.45))[:, :, None]
    a[:, :, 3] = 1.0
    a = a.reshape(-1, 4)
    img.pixels[:] = a.ravel()
    img.filepath_raw = str(PARTS / 'cabin_light.png')
    img.file_format = 'PNG'
    img.save()
    for c in copies.values():            # exported as the occlusion map, from the second UV set
        nt = c.node_tree
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(nt.nodes['cabin_light'].outputs['Color'], sep.inputs['Color'])
        out = nt.nodes.new('ShaderNodeGroup'); out.node_tree = gltf_output()
        nt.links.new(sep.outputs['Red'], out.inputs['Occlusion'])

inside_parts = cabin_parts + [o for o in all_door_parts if '_int_' in o.name or o.name.startswith('open_')]
for o in inside_parts:
    w = ROUND.get(part_key(o))
    if w:
        round_edges(o, w, ROUND_SEGMENTS.get(part_key(o), 3))
bake_cabin([o for o in inside_parts if part_key(o) not in NO_BAKE],
           [o for o in bpy.context.scene.objects if o.type == 'MESH' and ('glass' in o.name or part_key(o) in ('ambient', 'screen', 'rear_screen', 'chargers'))])

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
    'hinged': {k: {'node': k, 'hinge': [v * 0.001 for v in h['hinge']], 'axis': h['axis'], 'openDeg': h['openDeg']} for k, h in GEO['hinges'].items()},
    'struts': {side: {'body': a['body'], 'gate': [a['gate'][i] - GEO['hinges']['tailgate']['hinge'][i] for i in range(3)]} for side, a in GEO['struts'].items()},
    'strutsNote': 'the tailgate struts, l and r: body is in the root node cybertruck\'s own frame, gate in the tailgate node\'s (both millimetres, glTF axes); draw each strut between the two',
    'hingedNote': 'each node turns about its own axis (glTF frame) by openDeg to open: tailgate (drops to level with the bed floor; struts strut_body_<l|r> to strut_gate_<l|r>), bedlid (the under-bed compartment, lifts from its front edge), outlet_cover (the left wall: two 120 V and one 240 V outlets behind it)',
    'tonneau': {'node': 'tonneau_cover', 'slats': [f'slat_{i:02d}' for i in range(len(TON['slats']))],
                'path': [[z * 0.001, h * 0.001] for z, h in TON['path']], 'arc': [a * 0.001 for a in TON['arc']],
                'closedArc': [a * 0.001 for a in TON['closedArc']], 'travel': TON['travel'] * 0.001,
                'buttons': {'open': 'btn_tonneau_open', 'close': 'btn_tonneau_close', 'tailgate': 'btn_tailgate'},
                'lights': 'bed_lights',
                'note': 'path is [z, y] in metres on the centreline, arc its length from the first point. Opening by u metres puts slat i at arc closedArc[i] + u, with x = 0 and its rotation about +x so its +z follows the path forward (rotation.x = atan2(-dy, dz)). travel opens it fully. The switch is on the left sail by the tail light: open, close, tailgate (front to back). bed_lights: the LED strips along the bed walls.'},
    'yoke': {'parts': ['int_yoke', 'int_yoke_pad', 'int_yoke_chin', 'int_yoke_face', 'int_yoke_pods', 'int_yoke_trim', 'int_yoke_keys',
                       'int_yoke_btn_signal_right', 'int_yoke_btn_signal_left', 'int_yoke_btn_high_beam', 'int_yoke_btn_wiper'],
             'column': 'int_yoke_column',
             'controls': {'horn': ['int_yoke_pad', 'int_yoke_face'], 'signal_right': ['int_yoke_btn_signal_right'],
                          'signal_left': ['int_yoke_btn_signal_left'], 'high_beam': ['int_yoke_btn_high_beam'], 'wiper': ['int_yoke_btn_wiper']},
             'signals': {'left': 'det_marker_amber_l', 'right': 'det_marker_amber_r'},
             'note': 'parts turn together about the column; the column stays. controls: press the centre pad for the horn (manual, Steering: "press and hold the center pad"); the left pod\'s keys are the turn signals (right above, left below) and the high beam, the right pod\'s top outer key the wiper (a quick press: one wipe), each its own mesh over its printed symbol. signals: the amber corner lamps (lower lamp strip ends) on each side, which blink with that turn signal'},
    'wiper': {'node': 'wiper_arm', 'pivot': [v * 0.001 for v in GEO['wiper']['pivot']], 'axis': GEO['wiper']['axis'], 'sweepDeg': GEO['wiper']['sweepDeg'],
              'note': 'wiper_arm turns about axis (the windshield glass normal, glTF frame) through its pivot; parked it lies up the driver\'s A-pillar; one wipe turns it sweepDeg toward the passenger side, to horizontal along the cowl, and back (Owner\'s Manual, Windshield Wiper and Washers)'},
    'cabin': 'node "cabin": seats, dash, yoke, screens, trim (placed from the manual cabin sizes and video frames, not a replica); the glass is see-through (alpha 0.3)',
}
(OUT / 'cybertruck.json').write_text(json.dumps(info, indent=2))
print('assemble: wrote', OUT / 'cybertruck.glb')
