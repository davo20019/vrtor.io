"""Run with Blender: blender --factory-startup -b --python scripts/prepare-taj.py -- SOURCE.glb OUTPUT.glb.
Download the CC BY original converted GLB from the model link in CREDITS.md first.
Keeps the geometry intact; bakes the hierarchy and normalizes the plinth width.
"""
import bpy
import sys
from mathutils import Vector
source, output = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
lo = Vector([min(v[i] for v in points) for i in range(3)])
hi = Vector([max(v[i] for v in points) for i in range(3)])
center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
scale = 95.4 / (hi.x - lo.x)
for obj in objects:
    matrix = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = matrix
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
for obj in objects:
    obj.location = (obj.location - center) * scale
    obj.scale *= scale
bpy.ops.export_scene.gltf(
    filepath=output, export_format='GLB', use_selection=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=16,
    export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
)
