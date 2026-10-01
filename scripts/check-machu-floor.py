"""Check shipped GLBs, navigation corners and spawn points against the scan.
Run: blender --factory-startup -b --python scripts/check-machu-floor.py
"""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parent.parent/'apps/mpc/public/models'
for area in json.loads((root/'survey.json').read_text()):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/(area['id']+'.glb')))
 o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
 bpy.context.view_layer.update()
 bvh=BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())
 assert len(o.data.polygons)==area['triangles'], 'Published geometry was reduced'
 assert o.data.color_attributes, 'Survey grayscale data is missing'
 colors=o.data.color_attributes[0].data
 samples=[colors[i].color[0] for i in range(0,len(colors),max(1,len(colors)//200))]
 assert 0<=min(samples)<max(samples)<=1.0001, 'Source grayscale must be varied and normalized'
 def check(x,y,z):
  # Delivered Babylon LH (-OBJx,OBJz,-OBJy) back to Blender's Z-up space.
  hit,normal,_,_=bvh.ray_cast(Vector((-x,-z,area['bounds'][1]+3)),Vector((0,0,-1)))
  assert hit is not None and abs(normal.z)>.85, f"Unsupported floor {area['id']} {(x,y,z)}"
  gap=y-hit.z
  assert -.025<gap<.07, f"Floor height differs by {gap:.4f}m in {area['id']}"
 check(*area['stand'])
 half=area['step']*.46
 for x,y,z,a,b,c,d in area['nav']:
  for dx,dz,h in [(-half,-half,a),(half,-half,b),(half,half,c),(-half,half,d)]:check(x+dx,h,z+dz)
 print(f"FLOOR PASS {area['id']}: spawn and {len(area['nav'])*4} corners; {area['triangles']:,} triangles retained",flush=True)
