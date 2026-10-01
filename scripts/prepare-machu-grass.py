"""Place illustrative 3D grass only on verified grass faces of the delivered model.
Run: blender --factory-startup -b --python scripts/prepare-machu-grass.py
No photos or extra claims of measured vegetation. Ministry geometry: CC BY 4.0.
"""
import bpy,json,struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parent.parent/'apps/mpc/public/models'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'citadel.glb'))
verts=[];faces=[];grass=[]
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 base=len(verts);verts.extend(o.matrix_world@v.co for v in o.data.vertices)
 for p in o.data.polygons:
  faces.append(tuple(base+i for i in p.vertices));grass.append('grass' in o.name)
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
meta=json.loads((root/'citadel.json').read_text());points=[]
for x,y,z,*_ in meta['nav']:
 # Alternating cells limit density; every retained root matches the delivered mesh.
 if (round(x/meta['step'])+round(z/meta['step']))%2:continue
 hit,n,face,d=bvh.ray_cast(Vector((-x,-z,y+.15)),Vector((0,0,-1)),.3)
 if hit is not None and grass[face] and abs(n.z)>.9:
  points.append((x,hit.z,z))
assert len(points)>1000
(root/'citadel-grass.bin').write_bytes(b''.join(struct.pack('<fff',*p) for p in points))
print('GRASS ROOTS PASS',len(points),'verified against delivered geometry; bytes',len(points)*12)
