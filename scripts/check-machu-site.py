"""Check the delivered connected model's landing geometry and standing room.
Run: blender --factory-startup -b --python scripts/check-machu-site.py
"""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parent.parent/'apps/mpc/public/models';m=json.loads((root/'citadel.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'citadel.glb'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];verts=[];polys=[]
for o in objects:
 base=len(verts);verts.extend(o.matrix_world@v.co for v in o.data.vertices);polys.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
assert len(polys)==m['triangles']==32759
bvh=BVHTree.FromPolygons(verts,polys,all_triangles=True)
def check(x,y,z):
 origin=Vector((-x,-z,m['bounds'][1]+2));found=False
 for _ in range(16):
  hit,n,_,_=bvh.ray_cast(origin,Vector((0,0,-1)))
  if hit is None:break
  if abs(hit.z-y)<.065 and abs(n.z)>.65:found=True;break
  if hit.z<y-.065:break
  origin=hit-Vector((0,0,.005))
 assert found,f'Unsupported landing at {(x,y,z)}'
check(*m['stand']);half=m['step']*.42
for x,y,z,a,b,c,d in m['nav']:
 for dx,dz,h in [(-half,-half,a),(half,-half,b),(half,half,c),(-half,half,d)]:check(x+dx,h,z+dz)
print('SITE FLOOR PASS:',len(m['nav'])*4,'corners and start; all',m['triangles'],'architectural triangles retained',flush=True)
