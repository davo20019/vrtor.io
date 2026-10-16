"""Quick orthographic look at the GLB (workbench, material colours): top, side, front, rear and a 3/4.
  blender -b --factory-startup --python tools/views.py -- out/roadster.glb out/views.png [doors_open_deg]
A working aid for checking parts and colours, not a review (review.py renders through the photos' cameras).
"""
import bpy, sys, math, json
from mathutils import Vector, Matrix, Quaternion
args = sys.argv[sys.argv.index('--') + 1:]
glb, out = args[0], args[1]
open_deg = float(args[2]) if len(args) > 2 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
fix = Matrix.Rotation(-math.pi / 2, 4, 'X')        # glTF y-up imported z-up: back to the model frame (y up, z front)
info = json.load(open(glb.replace('_raw', '').replace('.glb', '.json')))
for name, d in info.get('doors', {}).items():
    o = bpy.data.objects.get(name)
    if o and open_deg:
        a = Vector(d['axis'])                      # model frame; Blender frame is (x, -z, y)
        ab = Vector((a.x, -a.z, a.y))
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = Quaternion(ab, math.radians(open_deg))
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_shadows = False
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 1400, 700
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.35, 0.35, 0.37)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam); sc.camera = cam
# Blender frame: x left of car, -y front... model z front -> Blender -y? glTF import: model (x,y,z) -> blender (x,-z,y)
views = {
    'side': ((8000, 0, 600), (0, 0, 600), 5000),     # from +x (car's left)
    'top': ((0, 0, 9000), (0, 0, 0), 5000),
    'front': ((0, -9000, 600), (0, 0, 600), 2600),
    'rear': ((0, 9000, 600), (0, 0, 600), 2600),
    'q34': ((5200, -6000, 2200), (0, 0, 500), 0),
    'q34r': ((4500, 6500, 1500), (0, 0, 500), 0),
}
import os
tiles = []
for name, (loc, tgt, ortho) in views.items():
    cam.location = Vector(loc) * 0.001 * 1
    d = (Vector(tgt) * 0.001 - cam.location)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if name == 'top':
        cam.rotation_euler = (0, 0, -math.pi / 2)
    if ortho:
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho * 0.001
    else:
        cam.data.type = 'PERSP'; cam.data.lens = 50
    p = out.replace('.png', f'_{name}.png')
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    tiles.append(p)
print('views:', tiles)
