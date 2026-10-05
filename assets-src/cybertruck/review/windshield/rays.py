"""Check the lower-corner sight lines on the delivered GLB (including all object transforms).
blender -b --factory-startup --python rays.py -- model.glb result.json
Opaque glass-border/steel/trim hits count; transparent glass is also intersected to verify its presence.
The result is written before assertions, so a failed build remains inspectable.
"""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:];glb,out=args
base=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(glb).resolve()))
fix=Matrix.Rotation(-math.pi/2,4,'X')
for o in bpy.context.scene.objects:
 if o.parent is None:o.matrix_world=fix@o.matrix_world
bpy.context.view_layer.update()
trees=[];glass_trees=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 is_glass=any(m.name.startswith(('glass_tinted','windshield_clear')) for m in o.data.materials)
 verts=[o.matrix_world@v.co for v in o.data.vertices]
 (glass_trees if is_glass else trees).append((o.name,BVHTree.FromPolygons(verts,[list(f.vertices) for f in o.data.polygons])))
# Probes near the strip on both cabin photos, including adjacent trim and dash controls.
samples={'athens1':[(700,470),(700,480),(720,480),(740,490),(760,500),(800,490)],
         'athens2-f921':[(500,1000),(550,1020),(600,1040),(650,1060)]}
report={}
for name,pxs in samples.items():
 c=json.loads((base/'measure/console'/f'{name}.camera.json').read_text())
 R=Matrix(c['R']);C=Vector(c['centreMm'])/1000;pp=c['principalPx'];f=c['focalPx'];rows=[]
 for x,y in pxs:
  d=(R.transposed()@Vector(((x-pp[0])/f,(y-pp[1])/f,1))).normalized();hits=[]
  for n,t in trees:
   loc,normal,idx,dist=t.ray_cast(C,d)
   if loc is not None and dist>.001:hits.append((dist,n,list(loc*1000)))
  glass_hits=[]
  for n,t in glass_trees:
   loc,normal,idx,dist=t.ray_cast(C,d)
   if loc is not None and dist>.001:glass_hits.append((dist,n,list(loc*1000)))
  glass_hit=min(glass_hits) if glass_hits else None
  hit=min(hits) if hits else None
  rows.append({'px':[x,y],'glass':None if glass_hit is None else glass_hit[1],
               'glassPointMm':None if glass_hit is None else [round(v,1) for v in glass_hit[2]],
               'firstOpaque':None if hit is None else hit[1],
               'pointMm':None if hit is None else [round(v,1) for v in hit[2]],
               'distanceMm':None if hit is None else round(hit[0]*1000,1)})
 report[name]=rows
Path(out).write_text(json.dumps(report,indent=1))
print(json.dumps(report,indent=1))

for name, rows in report.items():
 for row in rows:
  support = name == 'athens2-f921' and row['px'][0] < 650
  if support:
   assert row['firstOpaque'] == 'int_a_pillar_inner', (name, row)
  else:
   assert row['glass'] == 'windshield_glass' and row['firstOpaque'] is None, (name, row)
print('PASS: seven clear-glass rays and three adjacent support rays')
