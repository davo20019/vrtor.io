"""Derive tileable relief maps from CAST's measured Main Temple wall geometry.
Run: blender --factory-startup -b --python scripts/bake-machu-stone.py -- SOURCE_DIRECTORY
CC BY-NC 3.0 attribution/restrictions: apps/mpc/public/models/CREDITS.md.
These maps are an adapted reusable surface sample, not a survey of each facade.
"""
import bpy,sys,math,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parent.parent
source=next(Path(sys.argv[sys.argv.index('--')+1]).rglob('Main_Temple_50dec.obj'))
out=root/'apps/mpc/public/materials';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(source),forward_axis='Y',up_axis='Z')
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');mesh=o.data
bvh=BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get())
angle=math.radians(95);direction=Vector((math.cos(angle),math.sin(angle),0));tangent=Vector((direction.y,-direction.x,0))
w,h=2048,1024;physical_width,physical_height=4.0,1.4
field=np.full((h,w),np.nan,dtype=np.float64)
for j in range(h):
 z=-5.35+((j+.5)/h-.5)*physical_height
 for i in range(w):
  u=-58.5+((i+.5)/w-.5)*physical_width
  hit,n,_,dist=bvh.ray_cast(tangent*u+direction*121+Vector((0,0,z)),direction,3)
  if hit is not None and abs(n.dot(direction))>.35:field[j,i]=-dist
 if j%256==0:print('WALL SAMPLE',j,'/',h,flush=True)
valid=np.isfinite(field);coverage=float(valid.mean())
assert coverage>.995,f'Wall sample includes unmeasured gaps: {coverage}'
# Fill only small capture gaps using supported immediate neighbors.
for _ in range(32):
 if np.isfinite(field).all():break
 sums=np.zeros_like(field);counts=np.zeros_like(field)
 for axis,shift in [(0,1),(0,-1),(1,1),(1,-1)]:
  neighbor=np.roll(field,shift,axis);good=np.isfinite(neighbor)
  sums+=np.where(good,neighbor,0);counts+=good
 missing=~np.isfinite(field)&(counts>0);field[missing]=sums[missing]/counts[missing]
assert np.isfinite(field).all()
y,x=np.mgrid[0:h,0:w];design=np.column_stack((x.ravel()/w,y.ravel()/h,np.ones(w*h)))
plane=design@np.linalg.lstsq(design,field.ravel(),rcond=None)[0]
relief=field-plane.reshape(h,w)
# Periodic-plus-smooth decomposition removes edge mismatch while retaining internal relief.
# Algorithm: Lionel Moisan (2011), https://helios2.mi.parisdescartes.fr/~moisan/papers/2009-11r.pdf
boundary=np.zeros_like(relief)
boundary[0,:]=relief[-1,:]-relief[0,:];boundary[-1,:]=-boundary[0,:]
boundary[:,0]+=relief[:,-1]-relief[:,0];boundary[:,-1]-=relief[:,-1]-relief[:,0]
denominator=2*np.cos(2*np.pi*np.arange(w)/w)[None,:]+2*np.cos(2*np.pi*np.arange(h)/h)[:,None]-4
denominator[0,0]=1;spectrum=np.fft.fft2(boundary)/denominator;spectrum[0,0]=0
relief-=np.fft.ifft2(spectrum).real
# Suppress sub-millimetre scan noise, retaining fitted joints and stone curvature.
def blur(a,radius=1):
 for axis in [0,1]:
  a=sum(np.roll(a,offset,axis)*weight for offset,weight in [(-radius,1),(0,2),(radius,1)])/4
 return a
relief=blur(relief)
du=(np.roll(relief,-1,1)-np.roll(relief,1,1))/(2*physical_width/w)
dv=(np.roll(relief,-1,0)-np.roll(relief,1,0))/(2*physical_height/h)
normals=np.stack((-du,-dv,np.ones_like(du)),axis=2);normals/=np.linalg.norm(normals,axis=2,keepdims=True)
# Cavity and tone are illustrative shading derived from relief, not photographed color.
local=blur(blur(relief,12),24);cavity=np.clip((local-relief)/.018,0,1)
tone=np.clip(.5+relief/.14,0,1);height=np.clip(.5+relief/.24,0,1)
packed=np.stack((1-cavity*.48,tone,height),axis=2)
def save(name,rgb):
 im=bpy.data.images.new(name,width=w,height=h,alpha=False,float_buffer=False)
 im.colorspace_settings.name='Non-Color';rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=rgb
 im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(out/name);im.file_format='PNG';im.save();bpy.data.images.remove(im)
save('survey-stone-normal.png',normals*.5+.5);save('survey-stone-relief.png',packed)
assert np.isfinite(normals).all() and np.max(np.abs(np.linalg.norm(normals,axis=2)-1))<1e-6
assert float(np.std(relief))>.002,'Relief was lost in conversion'
meta={'source':'CAST Main Temple 50% OBJ, CC BY-NC 3.0','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'resolution':[w,h],'sampleMetres':[physical_width,physical_height],'projection':{'wallNormalDegrees':95,'tangentCentre':-58.5,'zCentre':-5.35,'rayStartPlane':121},'measuredCoverage':coverage,'reliefRangeMetres':[round(float(relief.min()),5),round(float(relief.max()),5)],'normalEncoding':'RGB tangent normal, linear; positive G follows increasing sample height','reliefEncoding':'R illustrative cavity shading, G illustrative stone tone, B relative relief; linear','adaptation':'Plane removed, small capture gaps filled, edges made periodic, scan noise filtered. Applied as an illustrative surface sample; not measured geometry or color for each architectural facade.'}
(out/'survey-stone.json').write_text(json.dumps(meta,indent=2)+'\n')
print('STONE MAP PASS',coverage,'measured coverage; relief std',float(np.std(relief)),'metres; maps',sum((out/f).stat().st_size for f in ['survey-stone-normal.png','survey-stone-relief.png']),'bytes',flush=True)
