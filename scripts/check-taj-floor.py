"""Verify teleport height against the actual GLB surface.
Run: blender --factory-startup -b --python scripts/check-taj-floor.py
"""
import bpy
import re
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parent.parent
height = float(re.search(r'TERRACE_Y = ([\d.]+)', (root / 'apps/taj/src/world.js').read_text()).group(1))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / 'apps/taj/public/models/taj-mahal.glb'))
graph = bpy.context.evaluated_depsgraph_get()
for x, y in [(0, -36), (-35, -32), (0, -34), (-34, 0), (34, 0), (0, 34)]:
    hit, point, normal, *_ = bpy.context.scene.ray_cast(graph, Vector((x, y, 100)), Vector((0, 0, -1)))
    assert hit and normal.z > .9, f'No terrace at {(x, y)}'
    assert 0 <= height - point.z < .04, f'Teleport floor differs from marble surface: {height} versus {point.z}'
    print(f'FLOOR PASS {(x, y)}: surface {point.z:.3f}m, teleport {height:.3f}m')
