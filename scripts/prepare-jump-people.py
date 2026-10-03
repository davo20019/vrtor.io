"""The people of the jump (apps/jump), from Microsoft Rocketbox avatars (MIT,
https://github.com/microsoft/Microsoft-Rocketbox): you, the other jumper, the pilot and the co-pilot,
dressed for the day. Their army uniforms are the base: one-piece cut, pockets, boots; the
camouflage (with its flags, rank patches and name tapes) is painted out into a plain suit colour
that keeps the cloth's broad shading (the folds are in the normal maps). The vest of the
female avatar is removed and her helmet painted as a skydiving helmet.

Download the avatars (Export/<name>.fbx and Textures/*color*, *normal*) into
~/vrtor-data/rocketbox/<name>/, then:
  python3 scripts/prepare-jump-people.py      (numpy, scipy and Pillow; then it runs Blender)

Output:
  apps/jump/public/models/jumper.glb            you: skinned, posed live by src/body.js
  ~/vrtor-data/rocketbox/out/<role>.glb         the others, for prepare-jump-helicopter.py
"""
import subprocess,sys,json
from pathlib import Path

repo=Path(__file__).resolve().parent.parent
SRC=Path.home()/'vrtor-data/rocketbox'
WORK=SRC/'out'
OUT=repo/'apps/jump/public/models'
PEOPLE={
  'jumper':{'avatar':'Military_Male_05','suit':'#1d2c58'},
  'copilot':{'avatar':'Military_Male_02','suit':'#545d4a'},
  'jumper-2':{'avatar':'Military_Female_01','suit':'#2c5d68','drop':['equipment'],'helmet':'#16181c'},
  'pilot':{'avatar':'Military_Male_06','suit':'#5f6852'},
}

def repaint():
  import numpy as np
  from PIL import Image
  from scipy import ndimage
  Image.MAX_IMAGE_PIXELS=None
  WORK.mkdir(parents=True,exist_ok=True)
  def hexrgb(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
  def suit(path,colour,out,whole=False,below=0):
    img=np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    mx=img.max(axis=2);mn=img.min(axis=2);sat=(mx-mn)/np.maximum(mx,1)
    lum=img@[0.299,0.587,0.114]
    r,g,b=img[...,0],img[...,1],img[...,2]
    # Pure black is unused texture space, except thin black marks inside the cloth (a removed vest's straps).
    used=ndimage.binary_closing(mx>18,iterations=6)
    if whole:cloth=used
    else:
      # Camouflage: grey-green, unsaturated. Patches, flags and name tapes sit inside it: fill them.
      camo=used&((sat<0.24)|(mx<=18))&~((r>g+8)&(g>b+4)&(sat>0.16))
      # Close the gaps left by straps and stitching baked into the cloth, then fill what it encloses.
      camo=ndimage.binary_closing(ndimage.binary_opening(camo,iterations=1),iterations=4)
      cloth=ndimage.binary_fill_holes(camo)&used
      # Drop specks: keep only regions the size of a garment piece.
      labels,n=ndimage.label(cloth)
      sizes=ndimage.sum(cloth,labels,range(1,n+1))
      cloth=np.isin(labels,1+np.flatnonzero(sizes>4000))
      # On a head texture the hair and face fill the top: dark hair isn't camouflage.
      cloth[:int(below*cloth.shape[0])]=False
    # The cloth's broad light and shade (the camouflage pattern is far finer than this).
    weight=cloth.astype(float)
    broad=ndimage.gaussian_filter(lum*weight,48)/np.maximum(ndimage.gaussian_filter(weight,48),1e-3)
    mean=lum[cloth].mean() if cloth.any() else 128
    shade=np.clip(0.55+0.45*broad/mean,0.85,1.1)[...,None]
    fine=np.clip(1+0.12*(ndimage.gaussian_filter(lum,1.2)-ndimage.gaussian_filter(lum,4))/mean,0.9,1.1)[...,None]
    painted=np.clip(hexrgb(colour)*shade*fine,0,255)
    alpha=ndimage.gaussian_filter(cloth.astype(float),1.2)[...,None]
    result=img*(1-alpha)+painted*alpha
    Image.fromarray(result.astype(np.uint8)).resize((1024,1024),Image.LANCZOS).save(out)
  def shrink(path,out):
    Image.open(path).convert('RGB').resize((1024,1024),Image.LANCZOS).save(out)
  for role,p in PEOPLE.items():
    tex=SRC/p['avatar']/'Textures'
    for f in tex.glob('*_color*.tga'):
      part=f.stem.split('_')[1]  # body, head, helmet, equipment
      if part in p.get('drop',[]):continue
      out=WORK/f'{role}-{part}-color.png'
      if part=='helmet':suit(f,p['helmet'],out,whole=True)
      else:suit(f,p['suit'],out,below=0.45 if part=='head' else 0)
    for f in tex.glob('*_normal.tga'):
      part=f.stem.split('_')[1]
      if part in p.get('drop',[]):continue
      shrink(f,WORK/f'{role}-{part}-normal.png')
    print('painted',role,flush=True)

def blender_stage():
  import bpy,bmesh
  for role,p in PEOPLE.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(SRC/p['avatar']/'Export'/f"{p['avatar']}.fbx"))
    for o in list(bpy.context.scene.objects):
      if o.type=='EMPTY':bpy.data.objects.remove(o)
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    # Remove dropped parts (the vest).
    drop=[i for i,m in enumerate(mesh.data.materials) if m.name.split('_')[-1] in p.get('drop',[])]
    if drop:
      bm=bmesh.new();bm.from_mesh(mesh.data)
      bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index in drop],context='FACES')
      bm.to_mesh(mesh.data);bm.free()
      for i in sorted(drop,reverse=True):mesh.data.materials.pop(index=i)
    # Fresh materials: the painted colour and the normal map.
    for slot in mesh.material_slots:
      part=slot.material.name.split('_')[-1]
      m=bpy.data.materials.new(f'{role}-{part}');m.use_nodes=True
      nt=m.node_tree;bsdf=nt.nodes['Principled BSDF']
      bsdf.inputs['Roughness'].default_value=0.42 if part=='helmet' else 0.82
      col=nt.nodes.new('ShaderNodeTexImage');col.image=bpy.data.images.load(str(WORK/f'{role}-{part}-color.png'))
      nt.links.new(col.outputs['Color'],bsdf.inputs['Base Color'])
      nrm=nt.nodes.new('ShaderNodeTexImage');nrm.image=bpy.data.images.load(str(WORK/f'{role}-{part}-normal.png'));nrm.image.colorspace_settings.name='Non-Color'
      nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(nrm.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
      slot.material=m
    mesh.name=role
    out=OUT/'jumper.glb' if role=='jumper' else WORK/f'{role}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_skins=True,export_animations=False,
      export_image_format='WEBP',export_image_quality=82,export_draco_mesh_compression_enable=role=='jumper')
    print('exported',role,out.stat().st_size,flush=True)

if '--blender' in sys.argv:
  blender_stage()
else:
  repaint()
  if '--paint-only' in sys.argv:sys.exit()
  subprocess.run(['blender','-b','--factory-startup','--python',str(Path(__file__).resolve()),'--','--blender'],check=True)
