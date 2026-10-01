"""Prepare CAST's CC BY-NC 3.0 survey meshes without further decimation.
Run: blender --factory-startup -b --python scripts/prepare-machu.py -- SOURCE_DIRECTORY
Source archives and attribution are in apps/mpc/public/models/CREDITS.md.
The OBJ millimetre exports are converted to metres; each area is independently
centred, preserving its own proportions (these are not a registered whole site).
Navigation is derived from ray casts and excludes walls, steep slopes and holes.
"""
import bpy, sys, json, math
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from collections import Counter, deque
root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[sys.argv.index('--')+1])
output=root/'apps/mpc/public/models'
output.mkdir(parents=True,exist_ok=True)
areas=[('main-temple','Main_Temple_50dec',1),('sun-temple','Temple_Sun_50dec',.001),('intihuatana','Intiwatana_50dec',1),('condor-temple','Temple_Condor_50dec',.001),('water-room','Water_Room_50dec',1),('knob-room','Knob_Room_50dec',1)]
metadata=[]
for name,original,scale in areas:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 path=next(source.rglob(original+'.obj'))
 bpy.ops.wm.obj_import(filepath=str(path),forward_axis='Y',up_axis='Z')
 o=bpy.context.selected_objects[0];o.name=name
 verts=o.data.vertices
 lo=Vector([min(v.co[i] for v in verts) for i in range(3)])
 hi=Vector([max(v.co[i] for v in verts) for i in range(3)])
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for v in verts: v.co=(v.co-center)*scale
 # The OBJ carries grayscale vertex values (0..255), not photographic UV textures.
 # Normalize them explicitly: the importer otherwise treats 8-bit values as floats.
 gray=np.fromiter((float(line.split()[4])/255 for line in path.open() if line.startswith('v ')),dtype=np.float32)
 assert len(gray)==len(verts)
 colors=np.ones((len(gray),4),dtype=np.float32);colors[:,:3]=gray[:,None]
 for legacy in list(o.data.color_attributes):o.data.color_attributes.remove(legacy)
 attr=o.data.color_attributes.new(name='SurveyGray',type='FLOAT_COLOR',domain='POINT')
 attr.data.foreach_set('color',colors.ravel())
 o.data.color_attributes.active_color=attr
 # Survey stone retains the measured relief; the source has no photographs or UV maps.
 mat=bpy.data.materials.new('survey-granite');mat.diffuse_color=(.48,.47,.43,1);mat.surface_render_method='DITHERED';mat.use_backface_culling=False;mat.use_nodes=True
 p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.48,.47,.43,1);p.inputs['Roughness'].default_value=.86
 vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='SurveyGray'
 mat.node_tree.links.new(vertex.outputs['Color'],p.inputs['Base Color'])
 o.data.materials.clear();o.data.materials.append(mat)
 # Smooth normals avoid shimmering across dense scanned triangles; block joints remain geometry.
 for p in o.data.polygons: p.use_smooth=True
 if name=='condor-temple':
  # This archive has inward winding (its upward surfaces point downward).
  o.data.flip_normals()
 o.data.update();bpy.context.view_layer.update()
 bvh=BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())
 width=(hi.x-lo.x)*scale;depth=(hi.y-lo.y)*scale;height=(hi.z-lo.z)*scale
 step=.35;cells={};nx=math.ceil(width/step);ny=math.ceil(depth/step)
 for ix in range(nx):
  for iy in range(ny):
   x=-width/2+(ix+.5)*step;y=-depth/2+(iy+.5)*step
   hit,n,_,_=bvh.ray_cast(Vector((x,y,height+3)),Vector((0,0,-1)))
   if hit is not None and abs(n.z)>.90: cells[(ix,iy)]=(x,y,hit.z)
 # Find the dominant low, horizontal surface; this avoids horizontal wall tops.
 heights=sorted(v[2] for v in cells.values());limit=heights[int(len(heights)*.65)]
 hist=Counter(round(v[2]/.2) for v in cells.values() if v[2]<=limit)
 mode=hist.most_common(1)[0][0]*.2
 valid={k:v for k,v in cells.items() if abs(v[2]-mode)<.65}
 # A full footprint around each teleport cell must also be supported and level.
 safe={k:v for k,v in valid.items() if all((k[0]+dx,k[1]+dy) in valid and abs(valid[(k[0]+dx,k[1]+dy)][2]-v[2])<.25 for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)])}
 # Retain sizable patches, not isolated tiny ledges.
 remaining=set(safe);components=[]
 while remaining:
  first=remaining.pop();q=deque([first]);comp=[first]
  while q:
   ix,iy=q.popleft()
   for k in [(ix+1,iy),(ix-1,iy),(ix,iy+1),(ix,iy-1)]:
    if k in remaining:remaining.remove(k);q.append(k);comp.append(k)
  if len(comp)>=8:components.append(comp)
 components.sort(key=len,reverse=True)
 assert components, f'No supported walking patch for {name}: mode={mode}, hist={hist.most_common(12)}, safe={len(safe)}'
 nav=[]
 for comp in components:
  for k in comp:
   x,y,z=safe[k]
   # Blender (x,y,z) -> glTF (x,z,-y) -> Babylon LH (-x,z,-y).
   corners=[]
   for dx,dy in [(1,1),(-1,1),(-1,-1),(1,-1)]:
    point,normal,_,_=bvh.ray_cast(Vector((x+dx*step*.46,y+dy*step*.46,height+3)),Vector((0,0,-1)))
    if point is None or abs(normal.z)<.90 or abs(point.z-z)>.25:break
    corners.append(round(point.z+.018,4))
   if len(corners)==4:nav.append([round(-x,4),round(z+.018,4),round(-y,4),*corners])
 largest=[safe[k] for k in components[0]]
 cx=sum(v[0] for v in largest)/len(largest);cy=sum(v[1] for v in largest)/len(largest)
 stand=min(largest,key=lambda v:(v[0]-cx)**2+(v[1]-cy)**2)
 target=[0,round(mode+2.2,4),0]
 assert nav, f'No supported floor corners for {name}'
 stand_world=min(nav,key=lambda v:(v[0]+stand[0])**2+(v[2]+stand[1])**2)[:3]
 entry={'id':name,'triangles':len(o.data.polygons),'bounds':[round(width,4),round(height,4),round(depth,4)],'floorHeight':round(mode,4),'stand':stand_world,'at':target,'step':step,'nav':nav}
 metadata.append(entry)
 bpy.ops.export_scene.gltf(filepath=str(output/(name+'.glb')),export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=16,export_draco_normal_quantization=12)
 print('AREA',name,'triangles',entry['triangles'],'bounds',entry['bounds'],'floor',mode,'stand',entry['stand'],'walkable cells',len(nav),'bytes',(output/(name+'.glb')).stat().st_size,flush=True)
(output/'survey.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n')
