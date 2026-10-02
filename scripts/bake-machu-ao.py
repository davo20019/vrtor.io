"""Bake ambient occlusion for the connected citadel into a second UV set and a greyscale map.
Run after prepare-machu-site.py: blender --factory-startup -b --python scripts/bake-machu-ao.py
Writes apps/mpc/public/materials/citadel-ao.jpg and re-exports citadel.glb with TEXCOORD_1.
Occlusion is computed from the model's own geometry; it is shading, not measured appearance.
"""
import bpy,json,hashlib
import numpy as np
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'apps/mpc/public';glb=root/'models/citadel.glb';out=root/'materials/citadel-ao.jpg'
SIZE=4096;GROUND_SCALE=.3
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
for o in objects:
  # Keep the occlusion set at TEXCOORD_1 on every mesh, including ones without source UVs.
  if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
  if 'AO' not in o.data.uv_layers:o.data.uv_layers.new(name='AO',do_init=False)
  o.data.attributes.new('aoSource','INT','FACE').data.foreach_set('value',[objects.index(o)]*len(o.data.polygons))
  o.data.attributes.new('aoFace','INT','FACE').data.foreach_set('value',list(range(len(o.data.polygons))))
# Unwrap and bake one joined copy so every face shares a single, tightly packed atlas.
bpy.ops.object.select_all(action='DESELECT')
copies=[]
for o in objects:
  c=o.copy();c.data=o.data.copy();bpy.context.collection.objects.link(c);c.select_set(True);copies.append(c)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();atlas=bpy.context.view_layer.objects.active
for o in objects:o.hide_render=True
# Bake with flat geometric normals: the imported normals are smoothed across corners, which
# tilts each texel's occlusion hemisphere into the adjacent wall. The exported meshes keep theirs.
for p in atlas.data.polygons:p.use_smooth=False
if atlas.data.has_custom_normals:
  bpy.context.view_layer.objects.active=atlas;bpy.ops.mesh.customdata_custom_splitnormals_clear()
atlas.data.uv_layers.active=atlas.data.uv_layers['AO']
# The export is unwelded (every triangle separate), which would make every triangle its own
# island and every wall diagonal a visible seam. Weld the bake copy so walls unwrap whole.
faces_before=len(atlas.data.polygons)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=.0005)
bpy.ops.object.mode_set(mode='OBJECT')
# Welding merges the few exact back-to-back duplicates; those faces share the neutral patch below.
assert faces_before-len(atlas.data.polygons)<32,('weld removed too many faces',faces_before,len(atlas.data.polygons))
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=0,area_weight=1,correct_aspect=True,scale_to_bounds=False)
# Ground is ~85% of the surface but only needs coarse occlusion; shrink its islands so walls,
# niches and doorways get most of the atlas resolution.
import bmesh
from bpy_extras import bmesh_utils
bm=bmesh.from_edit_mesh(atlas.data);layer=bm.loops.layers.uv['AO']
ground={i for i,m in enumerate(atlas.data.materials) if 'earth' in m.name or 'grass' in m.name}
for island in bmesh_utils.bmesh_linked_uv_islands(bm,layer):
  if island[0].material_index not in ground:continue
  loops=[l for f in island for l in f.loops];cu=sum(l[layer].uv.x for l in loops)/len(loops);cv=sum(l[layer].uv.y for l in loops)/len(loops)
  for l in loops:l[layer].uv.x=cu+(l[layer].uv.x-cu)*GROUND_SCALE;l[layer].uv.y=cv+(l[layer].uv.y-cv)*GROUND_SCALE
bmesh.update_edit_mesh(atlas.data)
bpy.ops.uv.pack_islands(margin=.0008,rotate=True,scale=True)
bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('citadel-ao',SIZE,SIZE,alpha=False,float_buffer=False);image.colorspace_settings.name='Non-Color'
for o in [atlas]:
  for mat in o.data.materials:
    mat.use_nodes=True;node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    mat.node_tree.nodes.active=node;node.select=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=96
scene.world=bpy.data.worlds.new('w') if scene.world is None else scene.world
scene.world.light_settings.distance=6.0
scene.render.bake.margin=16;scene.render.bake.use_selected_to_active=False
# Many source faces point into their walls, which would bake black. Bake both orientations
# and keep the brighter result: a closed wall's interior side is always the darker one.
bpy.ops.object.bake(type='AO',margin=16,use_clear=True)
first=np.empty(SIZE*SIZE*4,dtype=np.float32);image.pixels.foreach_get(first)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.flip_normals();bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.bake(type='AO',margin=16,use_clear=True)
second=np.empty(SIZE*SIZE*4,dtype=np.float32);image.pixels.foreach_get(second)
combined=np.maximum(first,second).reshape(SIZE,SIZE,4)
# Faces sealed just behind other faces bake black, then z-fight with the visible face in the
# browser. Point them (and islands too small to rasterize) at a neutral patch in an empty block.
NEUTRAL=.9;BLOCK=32
empty=[(by,bx) for by in range(SIZE//BLOCK-1,-1,-1) for bx in range(SIZE//BLOCK-1,-1,-1) if combined[by*BLOCK:(by+1)*BLOCK,bx*BLOCK:(bx+1)*BLOCK,0].max()==0]
by,bx=empty[0];combined[by*BLOCK+8:by*BLOCK+24,bx*BLOCK+8:bx*BLOCK+24,:3]=NEUTRAL
patch=((bx*BLOCK+16)/SIZE,(by*BLOCK+16)/SIZE);auv=atlas.data.uv_layers['AO'].data;buried=0
for p in atlas.data.polygons:
  u=sum(auv[i].uv[0] for i in p.loop_indices)/p.loop_total;v=sum(auv[i].uv[1] for i in p.loop_indices)/p.loop_total
  y=min(SIZE-1,int(v*SIZE));x=min(SIZE-1,int(u*SIZE))
  if combined[max(0,y-1):y+2,max(0,x-1):x+2,0].max()<.08:
    buried+=1
    for i in p.loop_indices:auv[i].uv=patch
# Mipmaps average islands with their surroundings; neutral (not black) empty space keeps
# distant triangle seams from darkening.
unbaked=combined[:,:,:3].max(axis=2)==0;combined[unbaked,:3]=NEUTRAL
print('BURIED',buried,'faces use the neutral patch at',patch,flush=True)
image.pixels.foreach_set(combined.ravel())
# A light 3×3 blur removes sampling noise (well inside the 16 px bake margin) so the map compresses.
px=np.empty(SIZE*SIZE*4,dtype=np.float32);image.pixels.foreach_get(px);px=px.reshape(SIZE,SIZE,4)
pad=np.pad(px[:,:,:3],((1,1),(1,1),(0,0)),mode='edge')
px[:,:,:3]=sum(pad[1+dy:1+dy+SIZE,1+dx:1+dx+SIZE] for dy in (-1,0,1) for dx in (-1,0,1))/9
image.pixels.foreach_set(px.ravel())
image.filepath_raw=str(out);image.file_format='JPEG';image.save(filepath=str(out),quality=80)
src=atlas.data.attributes['aoSource'].data;face=atlas.data.attributes['aoFace'].data;uv=atlas.data.uv_layers['AO'].data
for p in atlas.data.polygons:
  o=objects[src[p.index].value];q=o.data.polygons[face[p.index].value];target=o.data.uv_layers['AO'].data
  assert q.loop_total==p.loop_total
  for k in range(p.loop_total):target[q.loop_start+k].uv=uv[p.loop_start+k].uv
present={(src[p.index].value,face[p.index].value) for p in atlas.data.polygons}
for n,o in enumerate(objects):
  for q in o.data.polygons:
    if (n,q.index) not in present:
      for i in q.loop_indices:o.data.uv_layers['AO'].data[i].uv=patch
bpy.data.objects.remove(atlas)
for o in objects:
  o.hide_render=False
  for name in ('aoSource','aoFace'):o.data.attributes.remove(o.data.attributes[name])
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
# Material image nodes are unconnected and image export is off, so the GLB only gains TEXCOORD_1.
for o in objects:o.data.uv_layers.active=o.data.uv_layers[0]
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_image_format='NONE')
check=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
assert all('AO' in o.data.uv_layers for o in objects)
assert check==triangles==32759,(check,triangles)
meta={'file':'citadel-ao.jpg','size':SIZE,'uv':'TEXCOORD_1 of citadel.glb','samples':96,'distance':6.0,'buriedFaces':buried,'neutral':NEUTRAL,'glbSha256':hashlib.sha256(glb.read_bytes()).hexdigest(),
  'adaptation':'Ambient occlusion baked in Blender Cycles from the connected architectural model alone. Illustrative shading; the surrounding terrain is not included.'}
(root/'materials/citadel-ao.json').write_text(json.dumps(meta,indent=2)+'\n')
print('AO',SIZE,'triangles',triangles,'jpg bytes',out.stat().st_size,'glb bytes',glb.stat().st_size,flush=True)
