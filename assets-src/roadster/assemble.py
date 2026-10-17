"""Assemble the Roadster from parts/ (cad.py) into out/roadster.glb and out/roadster.json.
  blender -b --factory-startup --python assemble.py

cad.py builds in millimetres with the front on +z, up +y, +x on the car's left. Blender is z-up, so each mesh and
node position is moved into Blender's frame as (x, -z, y) on import; the glTF exporter turns it back, so the GLB
stands y-up with its front on +z and every node has identity rotation at rest: steer_* turns about its own +y,
wheel_* spins about its +x, door_* turns about the axis written in the .json (through the node's origin).
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PARTS, OUT = HERE / 'parts', HERE / 'out'
OUT.mkdir(exist_ok=True)
GEO = json.loads((PARTS / 'geometry.json').read_text())
TO_BLENDER = Matrix.Rotation(math.pi / 2, 4, 'X')

bpy.ops.wm.read_factory_settings(use_empty=True)

def srgb(r, g, b):
    f = lambda c: (c / 255) ** 2.2
    return f(r), f(g), f(b)

def material(name, color, rough, metallic=0.0, coat=0.0, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.08
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m

# Colours sampled from the press photos' lit faces (spec.md, "Colours"). The paint is "Ano White", a satin
# silver-white; the glass is the gold-tinted "Gold Glazed" glass, which reads as a dark warm bronze.
M = {
    'paint': material('paint_ano_white', srgb(203, 206, 208), 0.32, coat=0.5),
    'glass': material('glass_gold', srgb(70, 55, 42), 0.06, metallic=0.55, alpha=0.92),
    'black': material('black_trim', srgb(22, 24, 26), 0.55),
    'carbon': material('carbon', srgb(28, 30, 33), 0.35, coat=0.6),
    'tyre': material('tyre', srgb(21, 21, 22), 0.85),
    'disc': material('wheel_disc', srgb(196, 198, 200), 0.4, coat=0.3),             # the aero discs: light satin grey
    'spoke': material('wheel_spoke', srgb(78, 80, 84), 0.32, metallic=0.75),        # satin gunmetal (Roadster_70)
    'light_front': material('light_front', srgb(235, 238, 240), 0.2, emit=(1, 1, 1), strength=6),
    'light_rear': material('light_rear', srgb(200, 20, 25), 0.25, emit=(1, 0.05, 0.05), strength=8),
    'band': material('light_band', srgb(18, 18, 20), 0.15, coat=0.8),
    'bronze': material('nozzle_bronze', srgb(176, 136, 88), 0.25, metallic=1.0),
    'fan': material('fan_dark', srgb(40, 41, 44), 0.45, metallic=0.3),
    'plate': material('plate', srgb(205, 207, 206), 0.5),
    'seat': material('seat_grey', srgb(206, 206, 203), 0.85),                  # the seats' light grey (Roadster_63 to 69)
    'alcantara': material('alcantara', srgb(28, 28, 30), 0.92),
    'screen': material('screen', srgb(8, 10, 12), 0.1, emit=(0.15, 0.2, 0.3), strength=0.6),
    'amber': material('marker_amber', srgb(210, 95, 25), 0.3, emit=(1, 0.4, 0.05), strength=2),
}

def to_blender(v):
    return Vector((v[0], -v[2], v[1]))

def stl(name, mat, smooth_angle=28, origin=None):
    bpy.ops.wm.stl_import(filepath=str(PARTS / f'{name}.stl'))
    o = bpy.context.selected_objects[0]
    o.name = o.data.name = name
    o.data.transform(TO_BLENDER)
    if origin is not None:                              # move the mesh so `origin` (model frame) is its pivot
        o.data.transform(Matrix.Translation(-to_blender(origin)))
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return o

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.parent = parent
    return e

root = empty('roadster')

FIXED = [('body', 'paint'), ('glass_ws', 'glass'), ('glass_roof', 'glass'), ('glass_side', 'glass'),
         ('glass_rear', 'glass'), ('sill', 'carbon'), ('black_rear_corner', 'carbon'), ('splitter', 'black'),
         ('rear_lower', 'black'), ('plate', 'plate'), ('nozzles', 'bronze'), ('fans', 'fan'),
         ('light_front', 'light_front'), ('light_rear', 'light_rear'), ('light_rear_band', 'band'),
         ('markers', 'amber'), ('headlights', 'light_front'), ('nose_face', 'carbon'), ('side_trim', 'black'), ('tail_trim', 'paint'), ('reflectors', 'light_rear'),
         ('tub', 'alcantara'), ('seats', 'seat'), ('seat_shells', 'carbon'), ('dash', 'alcantara'), ('yoke', 'seat'),
         ('screen', 'screen'), ('console', 'seat')]
for name, mat in FIXED:
    if (PARTS / f'{name}.stl').exists():
        stl(name, M[mat], smooth_angle=8 if name == 'body' else 28).parent = root

# Doors: an empty at the hinge, the door's skin and glass under it with the hinge as their origin.
for k in ('l', 'r'):
    h = GEO['hinges'][k]
    d = empty(f'door_{k}', loc=to_blender(h['point']), parent=root)
    stl(f'door_{k}', M['paint'], smooth_angle=8, origin=h['point']).parent = d
    stl(f'door_glass_{k}', M['glass'], origin=h['point']).parent = d
    stl(f'door_card_{k}', M['alcantara'], origin=h['point']).parent = d

# The active wing: an empty at its (guessed) pivot, the stowed panel under it.
wg = GEO['wing']
wnode = empty('wing', loc=to_blender(wg['point']), parent=root)
stl('wing', M['paint'], smooth_angle=8, origin=wg['point']).parent = wnode

# Wheels: steer_* at the wheel centre (turns about its +y), wheel_* under it (spins about +x). The right side's
# rim and spokes are mirror images (their face looks out to -x); tyres are symmetric and shared.
SRC = {}
for ax in ('f', 'r'):
    for part, mat in (('tyre', 'tyre'), ('rim', 'disc'), ('spokes', 'spoke'), ('inserts', 'bronze')):
        o = stl(f'{part}_{ax}', M[mat], smooth_angle=35)
        SRC[(part, ax, 1)] = o.data
        if part != 'tyre':
            m = o.data.copy()
            m.name = f'{part}_{ax}_right'
            m.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
            m.flip_normals()
            SRC[(part, ax, -1)] = m
        bpy.data.objects.remove(o)

for key, c in GEO['wheels'].items():
    ax, side = key[0], (1 if key[1] == 'l' else -1)
    steer = empty(f'steer_{key}', loc=to_blender(c), parent=root)
    wheel = empty(f'wheel_{key}', parent=steer)
    for part in ('tyre', 'rim', 'spokes', 'inserts'):
        data = SRC[(part, ax, 1 if part == 'tyre' else side)]
        o = bpy.data.objects.new(f'{part}_{key}', data)
        bpy.context.scene.collection.objects.link(o)
        o.parent = wheel

root.scale = (0.001,) * 3
bpy.context.view_layer.update()

tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == 'MESH' for p in o.data.polygons)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'roadster.glb'), export_format='GLB',
                          export_cameras=False, export_lights=False, export_apply=True)
info = {
    'units': 'metres; glTF frame: up +y, front +z, +x the car\'s left; origin on the ground midway between the axles',
    'wheels': {k: {'centre': [v * 0.001 for v in c]} for k, c in GEO['wheels'].items()},
    'spin': {'nodes': [f'wheel_{k}' for k in GEO['wheels']], 'axis': [1, 0, 0],
             'note': 'wheel_*.rotation.x += distance_m / radius_m (front %.3f m, rear %.3f m)' % (GEO['P']['r_f'] / 1000, GEO['P']['r_r'] / 1000)},
    'steer': {'nodes': ['steer_fl', 'steer_fr'], 'axis': [0, 1, 0],
              'note': 'steer_*.rotation.y = angle; pivot is the vertical through the wheel centre (the kingpin is not published)'},
    'doors': {f'door_{k}': {'pivot': [v * 0.001 for v in h['point']], 'axis': h['axis'], 'openDeg': h['openDeg'],
                            'note': 'quaternion from axis-angle: angle 0 shut, openDeg open. The hinge is not published (spec.md, "Doors").'}
              for k, h in GEO['hinges'].items()},
    'wing': {'node': 'wing', 'pivot': [v * 0.001 for v in wg['point']], 'axis': wg['axis'], 'openDeg': wg['openDeg'],
             'note': 'quaternion from axis-angle: 0 stowed (road mode), openDeg raised. The struts\' path is not published: one turn standing in for it (spec.md, "Wing").'},
    'triangles': tris,
}
(OUT / 'roadster.json').write_text(json.dumps(info, indent=2))
print('assemble: wrote', OUT / 'roadster.glb', tris, 'triangles')
