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

# Factory visible-light transmission of each glass, measured on a new truck with a calibrated meter (+-2%): windshield
# 76, front side windows and A-pillar triangles 72, rear side windows 23, roof glass 3 (rb92gt, Cybertruck Owners
# Club, "Window Tint VLT From Factory"; the rear bed window 26 there, 24.9 by SCTesla at a tint shop; the model has
# no bed window). Blended in the display's gamma space (the app tone-maps before it blends), a pane of
# transmission T passes T^(1/2.2) of what is behind it, so its alpha is 1 - T^(1/2.2).
GLASS_VLT = {'windshield': 0.76, 'front_side': 0.72, 'rear_side': 0.23, 'roof': 0.03}

def glass_alpha(vlt):
    return round(1 - vlt ** (1 / 2.2), 3)

M = {
    'steel': material('brushed_stainless', srgb(196, 196, 192), 0.33, metallic=1.0, rough_map=PARTS / 'steel_rough.png'),
    'liner': material('wheel_well_black', srgb(22, 22, 23), 0.85),
    # Glass is neutral-density black at the opacity that passes the real truck's light. The B-pillar between the
    # doors is black glass, opaque.
    'glass': material('glass_pillar', srgb(8, 9, 10), 0.04),
    'glass_front': material('glass_front', srgb(8, 9, 10), 0.04, alpha=glass_alpha(GLASS_VLT['front_side'])),
    'glass_rear': material('glass_rear', srgb(8, 9, 10), 0.04, alpha=glass_alpha(GLASS_VLT['rear_side'])),
    'glass_roof': material('glass_roof', srgb(8, 9, 10), 0.04, alpha=glass_alpha(GLASS_VLT['roof'])),
    'windshield': material('windshield_clear', srgb(65, 79, 80), 0.035, alpha=glass_alpha(GLASS_VLT['windshield'])),
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
    # the console's top band: satin silver-grey, about as light as the white dash in int-athens-3 (163 against 180)
    'console_rim': material('console_rim_silver', srgb(200, 200, 196), 0.35, metallic=0.3),
    # the armrest lid: light warm grey leather (int-athens-3: 167, 157, 147 against the dash's 180, 179, 158)
    'console_lid': material('console_lid_leather', srgb(172, 166, 158), 0.55, normal_map=PARTS / 'leather_normal.png', normal_strength=0.5),
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
    'carpet': material('carpet_black', srgb(26, 26, 27), 1.0, normal_map=PARTS / 'carpet_normal.png', normal_strength=0.5),
    'door_dark': material('door_panel_dark', srgb(34, 34, 36), 0.7),
    'mat': material('floor_mat', srgb(30, 30, 31), 0.95, normal_map=PARTS / 'mat_normal.png', normal_strength=0.4),
    'mat_edge': material('mat_binding', srgb(22, 22, 23), 0.7),
    'pillar': material('pillar_black', srgb(14, 14, 15), 0.45),
    # the windshield's black band seen from the cabin: fired enamel on the glass's inner face, matte (int-athens-1:
    # a dark lip beside the A-pillar strip); the gloss was reflecting the sky as a light sliver at the lower corner
    'frit': material('frit_black', srgb(12, 12, 13), 0.85),
    'door_button': material('door_button', srgb(10, 10, 11), 0.15),
    # unlit, an amber lens under smoked plastic (c085, c147); the app lights it when its turn signal blinks
    'marker_amber': material('marker_amber', srgb(96, 50, 14), 0.1),
    # the headlamps under the corner facets: a clear lens over a silver reflector (c147, c085); their projector
    # cells on the centre face a lighter satin silver behind the smoked strip (c150)
    'lamp_head': material('headlamp_reflector', srgb(128, 130, 134), 0.2, metallic=0.9),
    'lamp_cell': material('headlamp_cells', srgb(78, 80, 84), 0.3, metallic=0.5),
    'tow_cap': material('tow_cover', srgb(58, 58, 60), 0.6),
    'lens_black': material('camera_lens', srgb(4, 4, 5), 0.05),
    'intake': material('intake_black', srgb(6, 6, 7), 0.9),
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
    # The rear band is smoked black; its lamps are dark red lenses under it, lit by the app by function (main.js):
    # the tail strip glows with the lights on (its emission here), the caps, brake bar and reverse lamps only
    # when braking, signalling or reversing (c069 unlit, c006 tail lights, c080 braking).
    'band': material('rear_band_smoked', srgb(9, 9, 10), 0.1),
    'light_r': material('light_rear', srgb(34, 5, 5), 0.1, emit=(1, 0.04, 0.02), emit_strength=0.8),
    'light_cap': material('light_rear_cap', srgb(22, 6, 6), 0.1),
    'light_low': material('light_rear_low', srgb(120, 14, 12), 0.15, emit=(1, 0.04, 0.02), emit_strength=0.5),
    'light_rev': material('light_reverse', srgb(150, 150, 154), 0.1),
    # Virginia's standard plate, personalised BELLA (textures.py); printed, not lit
    'plate': material('licence_plate', (1, 1, 1), 0.4, image=PARTS / 'plate.png'),
    'mirror': material('mirror_black', srgb(20, 20, 21), 0.35),
    'mirror_cap': material('mirror_cap_grey', srgb(78, 80, 84), 0.4),     # the door mirrors' satin grey cap (c003, dgRcedIkNOM-04)
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
PLANES = {k: (Vector(pt), Vector(n)) for k, (pt, n) in GEO['facetPlanes'].items()}
def depth(c):
    """Distance under the active outer facets (mm), respecting the concave cowl junction."""
    inactive = 'roof' if c.z >= GEO['cowlZ'] else 'hood'
    return min(-(c - pt).dot(n) for k, (pt, n) in PLANES.items() if k != inactive)
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
quarter_glass = [stl(f'quarter_glass__{s}', M['glass_front']) for s in 'lr']   # the triangles ahead of the window edge, on the body
roof_glass = stl('roof_glass', M['glass_roof'])
windshield_glass = stl('windshield_glass', M['windshield'])
tonneau = stl('tonneau', M['tonneau']); box_uv(tonneau, tile_mm=800)
lf = stl('light_front', M['light_w'])
# The rear band and its lamps (cad.py rear_lights; the gate_* ones ride on the tailgate, below).
rear_parts = [stl('rear_band', M['band']), stl('light_rear_l', M['light_r']), stl('light_rear_r', M['light_r']),
              stl('light_cap_l', M['light_cap']), stl('light_cap_r', M['light_cap']), stl('light_low', M['light_low']),
              stl('light_reverse', M['light_rev']), stl('rear_hitch', M['intake'])]
M['plate'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
clad = [stl(f.stem, M['clad']) for f in sorted(PARTS.glob('cladding__*.stl'))]   # each flare and rocker
intake = stl('intake_back', M['intake'])
intake_grille = stl('intake_grille', M['grille'])
front_bits = [stl('tow_covers', M['tow_cap']), stl('front_camera', M['clad'], smooth_angle=40), stl('front_camera_lens', M['lens_black'])]
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
hinged = {'tailgate': [gate_steel, gate_liner, stl('gate_band', M['band']), stl('gate_light', M['light_r']), stl('gate_brake', M['light_cap']),
                       stl('gate_camera', M['clad'], smooth_angle=10), stl('gate_release', M['door_button'])]}
if (PARTS / 'gate_tonneau.stl').exists():
    o = stl('gate_tonneau', M['tonneau']); box_uv(o, tile_mm=800); hinged['tailgate'].append(o)
lid = stl('lid_liner', M['bed_floor']); box_uv(lid, tile_mm=800)
hinged['bedlid'] = [lid, stl('lid_under', M['bed']), stl('lid_grip', M['door_button'])]
plate = stl('outlet_plate', M['outlets']); planar_uv(plate, (2, 1))
bed_parts.append(plate)
licence = stl('rear_plate', M['plate'], smooth_angle=10)
planar_uv(licence, (0, 1), flip_u=True)             # seen from behind, the truck's left (+x) is the plate's left
rear_parts.append(licence)
front_licence = stl('front_plate', M['plate'], smooth_angle=10)
planar_uv(front_licence, (0, 1))                    # seen from the front, the truck's left (+x) is the plate's right
front_bits.append(front_licence)
cover_panel = stl('outlet_cover', M['bed'])
cover_panel.name = cover_panel.data.name = 'outlet_cover_panel'      # the node is 'outlet_cover'
hinged['outlet_cover'] = [cover_panel]
INTERIOR = {'trim_white': 'trim_white', 'dash_top': 'dash_shelf', 'dash_face': 'dash_top', 'dash_vent': 'grille', 'ambient': 'ambient',
            'dash_white': 'trim_white', 'dash_lower': 'armrest', 'screen_bezel': 'bezel', 'screen': 'screen_on', 'screen_stand': 'bezel',
            'yoke': 'yoke', 'yoke_pad': 'yoke', 'yoke_column': 'yoke', 'yoke_chin': 'silver', 'yoke_face': 'yoke_face',
            'yoke_pods': 'yoke_pod', 'yoke_trim': 'silver', 'yoke_keys': 'switch_key',
            'yoke_btn_signal_right': 'yoke_pod', 'yoke_btn_signal_left': 'yoke_pod', 'yoke_btn_high_beam': 'yoke_pod', 'yoke_btn_wiper': 'yoke_pod',
            'console': 'console', 'console_rim': 'console_rim', 'console_lid': 'console_lid', 'charger_trim': 'dash_top', 'chargers': 'dash_top', 'rear_vents': 'silver', 'rear_screen': 'screen_on',
            'seats_front': 'seat', 'seats_rear': 'seat', 'seat_base': 'armrest', 'seat_knobs': 'switch', 'rear_armrest': 'seat',
            'headliner': 'dash_top', 'pillar_trim': 'dash_top', 'a_pillar_inner': 'dash_top', 'rear_wall': 'dash_top', 'visors': 'dash_top',
            'overhead': 'overhead', 'rear_mirror': 'yoke', 'carpet': 'carpet', 'mats': 'mat', 'mat_edges': 'mat_edge', 'center_ribs': 'pedal', 'center_rib_base': 'pillar', 'pedals': 'pedal', 'pedal_grips': 'yoke', 'pedal_arms': 'tiedown',
            'piping': 'piping', 'belts': 'belt', 'belt_hw': 'bezel',
            'overhead_strip': 'bezel', 'overhead_keys': 'switch', 'overhead_arms': 'overhead', 'mirror_glass': 'mirror_glass', 'tweeters': 'grille', 'window_edge': 'bezel', 'usb': 'screen',
            # on the doors (door_<k>_int_<name>)
            'armrest': 'armrest', 'door_lower': 'door_dark', 'switch_pod': 'bezel', 'switch': 'door_button', 'open': 'door_button',
            'cap': 'dash_top', 'grilles': 'grille'}
# A part split into individual ones ('seats_front__l', 'seats_front__r') takes its material by the name before '__'.
cabin_parts = [stl(f.stem, M[INTERIOR[f.stem[4:].split('__')[0]]], smooth_angle=25)
               for f in sorted(PARTS.glob('int_*.stl')) if f.stem[4:].split('__')[0] in INTERIOR]
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
DETAILS = {'pillars': 'pillar', 'frit': 'frit', 'lamp_lower': 'lamp_lower', 'lamp_head': 'lamp_head', 'lamp_cells': 'lamp_cell', 'marker_amber_l': 'marker_amber', 'marker_amber_r': 'marker_amber', 'marker_red': 'marker_red'}
detail_parts = [stl(f'det_{n}', M[m], smooth_angle=20) for n, m in DETAILS.items()]
# The outside door-release buttons, one object each (btn_fl...), so the app can tell which was pressed.
button_parts = []
for k in GEO['doors']:
    o = stl(f'det_btn_{k}', M['door_button'], smooth_angle=20)
    o.name = o.data.name = f'btn_{k}'
    button_parts.append(o)
# Doors: everything each door carries, as cad.py declares it (parts/mounts.json: part -> what it's fixed to), by
# the part's material.
DOOR_PARTS = {'steel': 'steel', 'mirror': 'mirror', 'mirrorcap': 'mirror_cap', 'mirrorglass': 'mirror_glass'}
MOUNTS = json.loads((PARTS / 'mounts.json').read_text())
door_parts = {}
for k in GEO['doors']:
    door_parts[k] = []
    for stem in sorted(n for n, m in MOUNTS.items() if m == f'door_{k}'):
        suffix = stem[len(f'door_{k}_'):]
        mat = (M['glass_front' if k[0] == 'f' else 'glass_rear'] if suffix == 'glass'          # front doors 72%, rear 23%
               else M[INTERIOR[suffix[4:]]] if suffix.startswith('int_') else M[DOOR_PARTS[suffix]])
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
for o in [x for x in (body, glass, roof_glass, windshield_glass, tonneau, lf, intake, intake_grille, mirrors, wiper, wiper_blade, slat) if x] + [*quarter_glass, *clad, *front_bits, *rear_parts, *cabin_parts, *detail_parts, *button_parts, *bed_parts, *all_door_parts, *templates, *[q for v in hinged.values() for q in v]]:
    o.data.transform(TO_BLENDER)         # UVs and materials were set in the model frame; now move to Blender's

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.parent = parent
    return e

root = empty('cybertruck')
body_node = empty('body', parent=root)
for o in [x for x in (body, glass, roof_glass, windshield_glass, tonneau, lf, intake, intake_grille, mirrors, wiper) if x] + [*quarter_glass, *clad, *front_bits, *rear_parts, *detail_parts, *button_parts, *bed_parts]:
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
ROUND = {'seats_front': 24, 'seats_rear': 24, 'rear_armrest': 14, 'dash_white': 12, 'console': 10, 'console_rim': 3, 'console_lid': 16, 'seat_base': 8,
         'dash_top': 6, 'dash_lower': 6, 'dash_face': 4, 'yoke': 9, 'yoke_column': 5, 'visors': 8, 'screen_bezel': 3, 'overhead': 6,
         'armrest': 14, 'door_lower': 6, 'trim_white': 14, 'cap': 6,
         # The removed trim in Tesla's windshield service photos has rolled edges. The sight-plane
         # hull in cad.py fixes the silhouettes; a small inward bevel softens its angular section.
         # Radius is an approximation, not a depth measurement from the unsolved cross-cab video.
         'a_pillar_inner': 14}
NO_BAKE = ('screen', 'rear_screen', 'ambient', 'open', 'switch', 'mirror_glass',
           'yoke_btn_signal_right', 'yoke_btn_signal_left', 'yoke_btn_high_beam', 'yoke_btn_wiper')     # the yoke's keys: baked alone they came out darker than the pod round them

def part_key(o):
    """The part's kind, for its material, rounding and baking: a split part's name before '__' (seats_front__l)."""
    n = o.name.split('__')[0]
    if n.startswith('open_'):
        return 'open'
    return n.split('_int_', 1)[1] if '_int_' in n else n[4:] if n.startswith('int_') else n

ROUND_SEGMENTS = {'yoke': 3, 'a_pillar_inner': 4}

def round_edges(o, width, segments=3):
    for m in list(o.modifiers):          # smooth-by-angle would mark the rounded edges sharp again; hardened normals shade instead
        o.modifiers.remove(m)
    mod = o.modifiers.new('round', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(25)
    if part_key(o) == 'a_pillar_inner':
        # Tiny boolean seam edges used to clamp the entire post's bevel to almost
        # zero. Round the long moulded edges without beveling those internal joins.
        bm = bmesh.new(); bm.from_mesh(o.data)
        weights = bm.edges.layers.float.new('bevel_weight_edge')
        for edge in bm.edges:
            if edge.is_manifold and edge.calc_length() > 25 and edge.calc_face_angle() > math.radians(25):
                edge[weights] = 1.0
        bm.to_mesh(o.data); bm.free()
        mod.limit_method = 'WEIGHT'
    if part_key(o) == 'dash_white' or o.name.startswith(('door_fl_int_trim_white', 'door_fr_int_trim_white')):
        # Keep the 2 mm shut-door joint crisp. A full-width bevel on these seam edges
        # retracts the dash's point and the door's return into two mismatched scallops.
        # The long padded dash edges and the rest of the door retain their usual rounding.
        bpy.context.view_layer.update()
        to_mm = root.matrix_world.inverted() @ o.matrix_world
        bm = bmesh.new(); bm.from_mesh(o.data)
        weights = bm.edges.layers.float.new('bevel_weight_edge')
        for edge in bm.edges:
            if not edge.is_manifold or edge.calc_face_angle() < math.radians(25):
                continue
            pts = [to_mm @ v.co for v in edge.verts]
            seam = (all(abs(v.x) > 740 and v.y > -1240.8 for v in pts) if part_key(o) == 'dash_white'
                    else all(v.y < -1128.8 for v in pts))  # model z > ZF - 1567 mm
            # The block's own end is a rounded nose standing off the door panel (dgRcedIkNOM-32, 6:16, int-athens-3:
            # soft corners at its top, tip and bottom, the door's panel meeting it behind them); 12 mm (cad.py,
            # NOSE_STEP), read on those frames, not measured. The door's side of the joint stays crisp.
            edge[weights] = (min(12.0 / width, 1.0) if part_key(o) == 'dash_white' else min(0.7 / width, 1.0)) if seam else 1.0
        bm.to_mesh(o.data); bm.free()
        mod.limit_method = 'WEIGHT'
    mod.harden_normals = True
    mod.use_clamp_overlap = part_key(o) != 'a_pillar_inner'
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)

def flat_faces(o):
    """Merge each flat face's STL triangles into one polygon, so a bevel only rounds the real creases (on raw
    triangles it cut wedges into the bumper's band)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(o.data); bm.free()

# The black cladding (bumpers, flares, rockers) is moulded plastic with softened edges (c147, c085: the bumper's
# top edge and corners read as rounded, not knife-sharp); the grille's bars a little too.
for o in clad:
    flat_faces(o)
    round_edges(o, 9.0, segments=2)
round_edges(intake_grille, 1.5, segments=2)

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
        flat_faces(o)                    # one polygon per flat face first: the bevel then rounds only real creases, with far fewer triangles
        round_edges(o, w, ROUND_SEGMENTS.get(part_key(o), 2))
bake_cabin([o for o in inside_parts if part_key(o) not in NO_BAKE],
           [o for o in bpy.context.scene.objects if o.type == 'MESH' and ('glass' in o.name or part_key(o) in ('ambient', 'screen', 'rear_screen'))])

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
    'lights': {'front': 'light_front (emissive white)',
               'tail': ['light_rear_l', 'gate_light', 'light_rear_r', 'light_low'],
               'brake': ['light_cap_l', 'light_cap_r', 'gate_brake', 'light_rear_l', 'light_rear_r', 'light_low'],
               'turn': {'left': ['light_cap_l', 'light_rear_l'], 'right': ['light_cap_r', 'light_rear_r']},
               'reverse': ['light_reverse'],
               'note': 'tail: the thin strip across the band and the red lamps under the tailgate, lit with the lights (their emission in the GLB). Braking (c080; The Drive, The Autopian): the middle of the strip goes out and the end caps fill solid red with a shorter bar under it in the middle. The turn signals are the end caps, red on US trucks. Reverse: white lamps either side of the plate. gate_* parts ride on the tailgate node'},
    'material': 'brushed stainless is metallic: the scene needs environment lighting',
    'seatEyes': {k: [v * 0.001 for v in c] for k, c in GEO['seatEyes'].items()},
    'doors': {k: {'node': f'door_{k}', 'hinge': [v * 0.001 for v in d['hinge']], 'openDeg': d['openDeg'], 'glassDropMm': d['glassDropMm'],
                  'buttons': [f'btn_{k}', f'open_{k}'],
                  'note': 'door_*.rotation about its own +y by openDeg opens it (front-hinged, swings outward); before it swings, its frameless glass (door_*_glass) drops glassDropMm down its slant, and rises once the door is shut; btn_* is the outside release button on the pillar behind the door, open_* the button on the inside handle'}
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
    'cabin': 'node "cabin": seats, dash, yoke, screens, trim (placed from the manual cabin sizes and video frames, not a replica); glass alpha from the factory light transmission: windshield 76%, front side 72%, rear side 23%, roof 3% (GLASS_VLT in assemble.py); the B-pillar glass is opaque',
}
# The parts as a technician takes them off (disassembly.py, the Service Manual's): every node the list names must
# be in the model, or the build stops.
import sys
sys.path.insert(0, str(HERE))
import disassembly
_graph = json.loads((HERE / 'refs' / 'tesla' / 'servicemanual' / 'removal-graph.json').read_text())
_parts = disassembly.resolved(_graph)
_missing = [(q['id'], n) for q in _parts for n in q['nodes'] if n not in bpy.data.objects]
if _missing:
    raise SystemExit(f'assemble: disassembly names nodes the model lacks: {_missing}')
info['disassembly'] = {
    'parts': _parts,
    'note': 'each part: its nodes (meshes or transform nodes) come off together, along dir (glTF frame), once every part in after is off; on: the part it is fixed to (absent: the body), which carries it when that comes off; manual: its name in the Service Manual, procedure and page: the documented procedure it follows (mirrored: its left-hand or front twin)',
}
(OUT / 'cybertruck.json').write_text(json.dumps(info, indent=2))
print('assemble: wrote', OUT / 'cybertruck.glb')
