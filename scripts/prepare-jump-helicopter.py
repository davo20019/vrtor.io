"""The helicopter you jump from (apps/jump): "EC135" by NG (@XRTL),
https://sketchfab.com/3d-models/ec135-09f99c980291406a9b2afffb90e7ad02, CC BY 4.0, with its pilot,
co-pilot and one other jumper: Microsoft Rocketbox avatars (MIT) in flight and jump suits, from
scripts/prepare-jump-people.py (run that first).
Download the original .glb to ~/vrtor-data/ec135-ng/source/EC135.glb, then:
  blender -b --factory-startup --python scripts/prepare-jump-helicopter.py

Changes:
  - The French roundel on the tail boom and the blue square on the fin are removed (no markings).
  - The black paint is made dielectric gloss (the scene has lights but no environment map, so
    metallic surfaces would render flat black); chrome parts are toned down the same way.
  - The main rotor (hub and blades) becomes its own object, "rotor", with its origin on the mast,
    so the scene can spin it. Its blades are lengthened to the real 5.1 m radius (the model's are short).
  - Scaled 1.35x to a real EC135 cabin (1.28 m tall, where seated people fit), turned so the scene sees the nose at +z
    and the open sliding door at +x, origin under the mast at the skids' bottom.
  - Triangles reduced from 662k to about 190k for the headset.
  - The rear bench is taken out (as for skydiving): the other jumper, in a rig, sits on the floor
    against the rear wall, knees up. The pilot is in the front right seat, the co-pilot the left.
Output: apps/jump/public/models/ec135.glb and ec135.json (points in the scene's frame, metres:
x right, y up, z forward).
"""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector as V,Matrix

repo=Path(__file__).resolve().parent.parent
SOURCE=Path.home()/'vrtor-data/ec135-ng/source/EC135.glb'
PEOPLE_DIR=Path.home()/'vrtor-data/rocketbox/out'
OUT=repo/'apps/jump/public/models'
SCALE=1.35
HUB=(0.235,0.02)  # the mast, in the source's frame (x nose, y left, z up)
ROTOR_RADIUS=5.1/SCALE
DOOR_X=0.72  # middle of the open right-hand door
GLASS={'Object_58','Object_59'}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
sc=bpy.context.scene
for name in ('Object_60','Object_62','Object_4'):bpy.data.objects.remove(bpy.data.objects[name])

# --- Measure the cabin (source frame) ---------------------------------------------------------
dg=bpy.context.evaluated_depsgraph_get()
def cast(origin,direction):
  o=V(origin);d=V(direction).normalized()
  while True:
    hit,loc,_,_,ob,_=sc.ray_cast(dg,o,d)
    if not hit:return None
    if ob.name in GLASS:o=loc+d*0.001;continue
    return loc
floor=cast((DOOR_X,0,0),(0,0,-1)).z
# The sill: the fuselage's outer skin at floor level, below the open door (cast in from outside).
sill_y=cast((DOOR_X,-2,floor-0.03),(0,1,0)).y
# The right skid's top, below the door: the highest hit under the sill, out to the skid tube.
skid=None
for i in range(60):
  y=sill_y-i*0.01;hit=cast((DOOR_X,y,floor-0.25),(0,0,-1))
  if hit and (skid is None or hit.z>skid.z):skid=hit
ground=min((o.matrix_world@V(c)).z for o in sc.objects if o.type=='MESH' for c in o.bound_box)

def seat(x_front,x_back,y):
  """Where a seated person's hip joints go: just above the cushion, in front of the backrest."""
  tops=[cast((x,y,0.1),(0,0,-1)) for x in [x_back+(x_front-x_back)*k/10 for k in range(11)]]
  heights=sorted(t.z for t in tops if t and floor+0.1<t.z<floor+0.5)
  cushion=heights[len(heights)//2]
  back=cast((x_front,y,cushion+0.2),(-1,0,0))
  return V((back.x+0.1,y,cushion+0.07))
# The pilot's cushion is deeper than it measures (its raised sides catch the rays).
seats={'pilot':seat(1.75,1.15,-0.31)-V((0,0,0.06)),'copilot':seat(1.75,1.15,0.31)-V((0,0,0.06))}
print('floor',round(floor,3),'sill',round(sill_y,3),'skid',skid,'ground',round(ground,3),'seats',seats)

# --- Paint ------------------------------------------------------------------------------------
def bsdf(m):return next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for m in bpy.data.materials:
  b=bsdf(m)
  if m.name in ('Standard81C8FF',):  # glass
    b.inputs['Metallic'].default_value=0;b.inputs['Roughness'].default_value=0.04;b.inputs['Alpha'].default_value=0.16
  elif m.name=='Standard727272':  # the black paint, glossy
    b.inputs['Base Color'].default_value=(0.022,0.022,0.024,1);b.inputs['Metallic'].default_value=0;b.inputs['Roughness'].default_value=0.3
  elif m.name=='Material.007':  # the cabin's dome light
    b.inputs['Base Color'].default_value=(0.9,0.88,0.8,1)
  else:
    b.inputs['Metallic'].default_value=min(0.4,b.inputs['Metallic'].default_value)
    b.inputs['Roughness'].default_value=max(0.25,b.inputs['Roughness'].default_value)

# --- One body mesh; the rotor split off --------------------------------------------------------
meshes=[o for o in sc.objects if o.type=='MESH']
for o in meshes:
  o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix()
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
body=bpy.context.view_layer.objects.active;body.name='body'
for o in [o for o in sc.objects if o.type!='MESH']:bpy.data.objects.remove(o)

bm=bmesh.new();bm.from_mesh(body.data);bm.faces.ensure_lookup_table()
seen=set();rotor_faces=[];bench_faces=[]
# The rear bench: everything lying wholly between the floor and the bench's top, behind the door.
BENCH=((-0.32,0.5),(-0.66,0.68),(floor+0.012,0.2))
for f in bm.faces:
  if f.index in seen:continue
  stack=[f];comp=[];seen.add(f.index)
  while stack:
    a=stack.pop();comp.append(a)
    for e in a.edges:
      for g in e.link_faces:
        if g.index not in seen:seen.add(g.index);stack.append(g)
  zs=[v.co.z for g in comp for v in g.verts];xs=[v.co.x for g in comp for v in g.verts]
  if min(zs)>=0.86 and (min(xs)+max(xs))/2>-3.0:rotor_faces+=comp
  else:
    ys=[v.co.y for g in comp for v in g.verts]
    if all(lo<=min(c) and max(c)<=hi for (lo,hi),c in zip(BENCH,(xs,ys,zs))):bench_faces+=comp
bmesh.ops.delete(bm,geom=list(set(bench_faces)),context='FACES')
print('bench faces removed',len(set(bench_faces)))
for f in bm.faces:f.select=False
for f in rotor_faces:f.select=True
bm.to_mesh(body.data);bm.free()
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
rotor=next(o for o in sc.objects if o.type=='MESH' and o is not body);rotor.name='rotor'
# Blades out to the real radius (the hub stays as it is).
tip=max(math.hypot(v.co.x-HUB[0],v.co.y-HUB[1]) for v in rotor.data.vertices)
k=(ROTOR_RADIUS-0.5)/(tip-0.5)
for v in rotor.data.vertices:
  dx,dy=v.co.x-HUB[0],v.co.y-HUB[1];r=math.hypot(dx,dy)
  if r>0.5:s=(0.5+(r-0.5)*k)/r;v.co.x=HUB[0]+dx*s;v.co.y=HUB[1]+dy*s
print('rotor',len(rotor.data.polygons),'tip',round(tip,2),'->',round(ROTOR_RADIUS,2))

for o,ratio in ((body,0.28),(rotor,0.35)):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('decimate','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.ops.mesh.customdata_custom_splitnormals_clear()
  bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
  bpy.ops.object.convert(target='MESH')
  print(o.name,'triangles',sum(len(p.vertices)-2 for p in o.data.polygons))

# --- People ------------------------------------------------------------------------------------
def Rx(d):return Matrix.Rotation(math.radians(d),3,'X')
def Ry(d):return Matrix.Rotation(math.radians(d),3,'Y')
def Rz(d):return Matrix.Rotation(math.radians(d),3,'Z')
# Seated, in a reference frame (facing -x, z up, right side +y; each avatar's own facing is measured
# and these turned into it): rotations of each bone from its rest pose. Thighs forward, shins down
# and a little forward, hands on the thighs.
# On the floor, knees up, forearms on the knees.
FLOOR=[('Bip01 L Thigh',Ry(135)@Rx(8)),('Bip01 R Thigh',Ry(135)@Rx(-8)),('Bip01 L Calf',Ry(14)),('Bip01 R Calf',Ry(14)),
  ('Bip01 L UpperArm',Ry(26)@Rx(40)),('Bip01 R UpperArm',Ry(26)@Rx(-40)),
  ('Bip01 L Forearm',Ry(88)@Rx(52)),('Bip01 R Forearm',Ry(88)@Rx(-52))]
SEATED=[('Bip01 L Thigh',Ry(88)),('Bip01 R Thigh',Ry(88)),('Bip01 L Calf',Ry(28)),('Bip01 R Calf',Ry(28)),
  ('Bip01 L UpperArm',Ry(20)@Rx(35)),('Bip01 R UpperArm',Ry(20)@Rx(-35)),
  ('Bip01 L Forearm',Ry(45)@Rx(35)),('Bip01 R Forearm',Ry(45)@Rx(-35))]
PEOPLE=['pilot','copilot','jumper-2']
cordura=bpy.data.materials.new('container');cordura.use_nodes=True
bsdf(cordura).inputs['Base Color'].default_value=(0.012,0.013,0.016,1);bsdf(cordura).inputs['Roughness'].default_value=0.8
def facing(arm):
  """The avatar's forward, right and up (world), from its hips, shoulders and neck as they are now."""
  P=lambda b:arm.matrix_world@arm.pose.bones[b].head
  right=(P('Bip01 R Thigh')-P('Bip01 L Thigh')).normalized();up=(P('Bip01 Neck')-P('Bip01 Pelvis')).normalized()
  return up.cross(right).normalized(),right,up
# The jumpers' places on the floor, backs to the rear wall (measured now the bench is gone).
dg=bpy.context.evaluated_depsgraph_get()
for name,y in (('jumper-2',0.22),):
  wall=cast((0.4,y,floor+0.25),(-1,0,0))
  seats[name]=V((wall.x+0.15,y,floor+0.07))
  print(name,'against the wall at',round(wall.x,3))
for name in PEOPLE:
  path=PEOPLE_DIR/f'{name}.glb'
  before=set(sc.objects)
  bpy.ops.import_scene.gltf(filepath=str(path))
  new=[o for o in sc.objects if o not in before]
  arm=next(o for o in new if o.type=='ARMATURE')
  # Start from the rest pose (a file's own pose may be turned another way).
  for pb in arm.pose.bones:
    pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
  bpy.context.view_layer.update()
  fwd,right,up=facing(arm)
  # From the reference frame (forward -x, right +y, up +z) into this avatar's.
  T=Matrix((fwd,right,up)).transposed()@Matrix(((-1,0,0),(0,1,0),(0,0,1)))
  W=arm.matrix_world.to_3x3().normalized()
  def sit(lean):
    """Seats the avatar, leaning its back and bowing its head forward by `lean` degrees."""
    totals={}
    pose=[('Bip01 Spine1',Ry(-lean)),('Bip01 Neck',Ry(-lean*1.5))]+(FLOOR if name.startswith('jumper') else SEATED)
    for bone,R in pose:
      pb=arm.pose.bones[bone];M=pb.bone.matrix_local.to_3x3()
      parent=pb.parent;Rp=Matrix.Identity(3)
      while parent:
        if parent.name in totals:Rp=totals[parent.name];break
        parent=parent.parent
      Ra=W.inverted()@T@R@T.inverted()@W;totals[bone]=Ra
      pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(M.inverted()@Rp.inverted()@Ra@M).to_quaternion()
    bpy.context.view_layer.update()
  P=lambda b:arm.matrix_world@arm.pose.bones[b].head
  turn=-math.degrees(math.atan2(fwd.y,fwd.x))
  # The cabin is low: lean forward, as people do in it, until the head clears the roof.
  skin=[o for o in new if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
  for o in skin:o.hide_set(True)
  dg=bpy.context.evaluated_depsgraph_get()
  # A natural stoop first (up to 18 degrees); a person who still doesn't fit is a little shorter.
  for lean in range(0,24,6):
    sit(lean)
    hip=(P('Bip01 L Thigh')+P('Bip01 R Thigh'))/2
    place=Matrix.Translation(seats[name])@Rz(turn).to_4x4()@Matrix.Scale(1/SCALE,4)@Matrix.Translation(-hip)
    neck_up=(P('Bip01 Head')-P('Bip01 Neck')).normalized()
    top=place@(P('Bip01 Head')+neck_up*0.2)
    # The highest of five rays round the head: headsets and their cables hang from the ceiling.
    hits=[cast((top.x+dx,top.y+dy,seats[name].z+0.1),(0,0,1)) for dx,dy in ((0,0),(0.07,0),(-0.07,0),(0,0.07),(0,-0.07))]
    roof=max((h for h in hits if h),key=lambda h:h.z,default=None)
    room=(roof.z-top.z) if roof else 1
    if room>0.075:break
  size=1.0
  if room<=0.075:
    size=max(0.8,(roof.z-0.075-seats[name].z)/(top.z-seats[name].z))
    place=Matrix.Translation(seats[name])@Rz(turn).to_4x4()@Matrix.Scale(size/SCALE,4)@Matrix.Translation(-hip)
    room=roof.z-(seats[name].z+(top.z-seats[name].z)*size)
  print(name,'lean',lean,'size',round(size,3),'head room (m)',round(room*SCALE,3))
  for o in skin:o.hide_set(False)
  shoulders=(P('Bip01 L UpperArm')+P('Bip01 R UpperArm'))/2
  tf,tr,tu=facing(arm)
  skin=[o for o in new if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
  bpy.ops.object.select_all(action='DESELECT')
  for o in skin:o.select_set(True)
  bpy.context.view_layer.objects.active=skin[0]
  bpy.ops.object.convert(target='MESH')
  for o in skin:
    o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix()
  if len(skin)>1:bpy.ops.object.join()
  person=bpy.context.view_layer.objects.active;person.name=name
  for o in new:
    if o not in skin:bpy.data.objects.remove(o)
  if name.startswith('jumper'):
    # Their rig: the container on the back, from the shoulder blades down to the belt.
    bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts:
      c=v.co;v.co=shoulders+tr*(c.x*0.34)+tu*(c.z*0.52-0.25)-tf*(0.19+c.y*0.15)
    rig=bpy.data.meshes.new('container');bm.to_mesh(rig);bm.free()
    pack=bpy.data.objects.new('container',rig);sc.collection.objects.link(pack);rig.materials.append(cordura)
    bpy.ops.object.select_all(action='DESELECT');pack.select_set(True);person.select_set(True)
    bpy.context.view_layer.objects.active=person;bpy.ops.object.join()
  # Facing the nose (+x), hips on the seat, sized to the helicopter before it's scaled up (`place`, above).
  person.data.transform(place)
  print(name,'triangles',len(person.data.polygons))

# --- Into the scene's frame ---------------------------------------------------------------------
origin=V((HUB[0],HUB[1],ground))
frame=Rz(-90).to_4x4()@Matrix.Scale(SCALE,4)@Matrix.Translation(-origin)
for o in [o for o in sc.objects if o.type=='MESH']:o.data.transform(frame)
hub_z=max(v.co.z for v in rotor.data.vertices if math.hypot(v.co.x,v.co.y)<0.1)
rotor.data.transform(Matrix.Translation((0,0,-hub_z)));rotor.location=(0,0,hub_z)
def scene_point(p):
  """Source frame to the scene's (Babylon: x right, y up, z forward)."""
  q=V(p)-origin;return [round(-q.y*SCALE,3),round(q.z*SCALE,3),round(q.x*SCALE,3)]
meta={
  'credit':'Helicopter: "EC135" by NG (sketchfab.com/XRTL), CC BY 4.0, modified. People: Microsoft Rocketbox (MIT).',
  'source':'https://sketchfab.com/3d-models/ec135-09f99c980291406a9b2afffb90e7ad02',
  'rotor':[0,round(hub_z,3),0],'rotorRadius':5.1,
  'floor':scene_point((DOOR_X,-0.38,floor)),
  'sill':scene_point((DOOR_X,sill_y,floor)),
  'step':scene_point(skid) if skid else None,
}
(OUT/'ec135.json').write_text(json.dumps(meta,indent=2)+'\n')
bpy.ops.export_scene.gltf(filepath=str(OUT/'ec135.glb'),export_format='GLB',export_apply=True,export_yup=True,
  export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,
  export_image_format='WEBP',export_image_quality=85)
print('meta',meta,'bytes',(OUT/'ec135.glb').stat().st_size)
