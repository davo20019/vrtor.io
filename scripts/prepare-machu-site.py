"""Prepare the connected architectural model, independently of CAST's scans.
Run: blender --factory-startup -b --python scripts/prepare-machu-site.py -- SOURCE.glb
Source/license: apps/mpc/public/models/SITE-CREDITS.md. No further decimation.
"""
import bpy,sys,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
source=Path(sys.argv[sys.argv.index('--')+1]);out=Path(__file__).resolve().parent.parent/'apps/mpc/public/models'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=.01
for o in objects:
 transform=o.matrix_world.copy()
 for v in o.data.vertices:v.co=(transform@v.co-center)*scale
 o.parent=None;o.matrix_world=Matrix.Identity(4)
 original=o.data.materials[0].name
 ground='Groundcover' in original or 'Vegetation' in original
 category='grass' if 'Vegetation' in original else 'earth' if ground else 'stone'
 o.name='site-'+category+'-'+original.split('_')[0];o.data.name=o.name
 o['walkGround']=ground
 mat=bpy.data.materials.new(o.name);mat.use_nodes=True
 shader=mat.node_tree.nodes.get('Principled BSDF')
 color={'grass':(.18,.25,.085,1),'earth':(.3,.26,.18,1),'stone':(.6,.57,.48,1)}[category]
 shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=.94
 o.data.materials.clear();o.data.materials.append(mat)
 o.data.update()
# Keep every architectural face, with flat architectural edges.
triangles=sum(len(o.data.polygons) for o in objects)
assert triangles==32759, f'Unexpected published triangle count: {triangles}'
verts=[];polys=[]
for o in objects:
 if not o['walkGround']:continue
 base=len(verts);verts.extend(v.co.copy() for v in o.data.vertices)
 polys.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
bvh=BVHTree.FromPolygons(verts,polys,all_triangles=True)
width=(hi.x-lo.x)*scale;depth=(hi.y-lo.y)*scale;height=(hi.z-lo.z)*scale;step=.75;half=step*.42
# Add short stone treads connected to ground. Never use isolated roofs as paths.
candidates=[]
for o in objects:
 if o['walkGround']:continue
 for p in o.data.polygons:
  if p.normal.z<.82 or p.area>8 or p.area<.025:continue
  ps=[o.data.vertices[i].co.copy() for i in p.vertices]
  candidates.append((ps,sum(ps,Vector())/3))
for iteration in range(24):
 accepted=[];remaining=[]
 for ps,c in candidates:
  supported=False
  for dx,dy in [(0,0),(.7,0),(-.7,0),(0,.7),(0,-.7),(1.1,0),(-1.1,0),(0,1.1),(0,-1.1)]:
   hit,n,_,_=bvh.ray_cast(Vector((c.x+dx,c.y+dy,height+2)),Vector((0,0,-1)))
   if hit is not None and abs(n.z)>.72 and abs(hit.z-c.z)<.38:supported=True;break
  (accepted if supported else remaining).append((ps,c))
 if not accepted:break
 for ps,c in accepted:
  base=len(verts);verts.extend(ps);polys.append((base,base+1,base+2))
 bvh=BVHTree.FromPolygons(verts,polys,all_triangles=True);candidates=remaining
 print('STEP FACES',iteration,len(accepted),flush=True)

nav=[]
def floor(x,y):
 hit,n,_,_=bvh.ray_cast(Vector((x,y,height+2)),Vector((0,0,-1)))
 return hit if hit is not None and abs(n.z)>.72 else None
for ix in range(math.ceil(width/step)):
 for iy in range(math.ceil(depth/step)):
  x=-width/2+(ix+.5)*step;y=-depth/2+(iy+.5)*step;p=floor(x,y)
  if p is None:continue
  corners=[]
  for dx,dy in [(1,1),(-1,1),(-1,-1),(1,-1)]:
   q=floor(x+dx*half,y+dy*half)
   if q is None or abs(q.z-p.z)>.38:break
   corners.append(round(q.z+.012,4))
  if len(corners)==4:nav.append([round(-x,4),round(p.z+.012,4),round(-y,4),*corners])
assert len(nav)>1000,'No supported paths in complete model'
# Start in a broad central court, away from wall edges and cliff boundaries.
stand=min(nav,key=lambda p:p[0]**2+p[2]**2)[:3]
# Prefer cells with clear standing room: stonework must not intersect the body.
stone=[o for o in objects if not o['walkGround']];sv=[];sp=[]
for o in stone:
 base=len(sv);sv.extend(v.co.copy() for v in o.data.vertices);sp.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
sbvh=BVHTree.FromPolygons(sv,sp,all_triangles=True)
for p in sorted(nav,key=lambda p:p[0]**2+p[2]**2):
 x,y,z=p[:3];origin=Vector((-x,-z,y+1))
 if all(sbvh.ray_cast(origin,Vector(d),.7)[0] is None for d in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0)]):stand=p[:3];break
# Exclude body-sized wall intersections; a floor below a wall is not a landing.
filtered=[]
for cell in nav:
 x,y,z=cell[:3];clear=True
 for h in [.65,1.4]:
  origin=Vector((-x,-z,y+h))
  if any(sbvh.ray_cast(origin,Vector(d),.3)[0] is not None for d in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0)]):clear=False;break
 if clear:filtered.append(cell)
nav=filtered
assert len(nav)>1000
stand=min(nav,key=lambda p:(p[0]-stand[0])**2+(p[2]-stand[2])**2)[:3]
meta={'id':'citadel','triangles':triangles,'bounds':[round(width,4),round(height,4),round(depth,4)],'stand':stand,'at':[stand[0],round(stand[1]+1.65,4),round(stand[2]-30,4)],'step':step,'nav':nav,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'unitScale':scale,'adaptation':'Connected architectural reconstruction, with illustrative procedural materials. Human scale is approximate; not a registered laser survey.'}
(out/'citadel.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'citadel.glb'),export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_image_format='NONE')
print('SITE',triangles,'triangles; bounds',meta['bounds'],'walk cells',len(nav),'start',stand,'bytes',(out/'citadel.glb').stat().st_size,flush=True)
# Validate against the delivered quantized mesh, not just the source geometry.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(out/'citadel.glb'))
dv=[];dp=[]
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 base=len(dv);dv.extend(o.matrix_world@v.co for v in o.data.vertices);dp.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
delivered=BVHTree.FromPolygons(dv,dp,all_triangles=True)
def supported(x,y,z):
 origin=Vector((-x,-z,height+2))
 for _ in range(16):
  hit,n,_,_=delivered.ray_cast(origin,Vector((0,0,-1)))
  if hit is None:return False
  if abs(hit.z-y)<.065 and abs(n.z)>.65:return True
  if hit.z<y-.065:return False
  origin=hit-Vector((0,0,.005))
 return False
verified=[]
for cell in nav:
 x,y,z,a,b,c,d=cell
 if supported(x,y,z) and all(supported(x+dx,h,z+dz) for dx,dz,h in [(-half,-half,a),(half,-half,b),(half,half,c),(-half,half,d)]):verified.append(cell)
assert len(verified)>1000
meta['nav']=verified
# Start with room to walk in every direction, rather than at the nearest path edge.
anchor=verified[0];grid={(round((c[0]-anchor[0])/step),round((c[2]-anchor[2])/step)):c for c in verified}
def spacious(c):
 ix,iz=round((c[0]-anchor[0])/step),round((c[2]-anchor[2])/step)
 neighbors=[grid.get((ix+dx,iz+dz)) for dx in range(-3,4) for dz in range(-3,4)]
 return all(n is not None and abs(n[1]-c[1])<.25 for n in neighbors)
meta['stand']=next((c[:3] for c in sorted(verified,key=lambda p:p[0]**2+p[2]**2) if spacious(c)),stand)
meta['at']=[meta['stand'][0],meta['stand'][1]+1.65,meta['stand'][2]-30]
(out/'citadel.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
print('DELIVERED NAV',len(verified),'cells; excluded',len(nav)-len(verified),'quantized boundary cells',flush=True)
