"""3D buildings around the Interlaken landing (apps/jump) from swisstopo's swissBUILDINGS3D.
Run after prepare-jump-interlaken.py:
  python3 scripts/prepare-jump-buildings.py   (needs numpy, DracoPy and pyfqmr: pip install DracoPy pyfqmr)

Source: swissBUILDINGS3D 3D Tiles, https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/
(© swisstopo, free geodata OGD). Every building within RADIUS of the landing. swissBUILDINGS3D 3.0
is detailed (dormers, overhangs: about 500 triangles a house), so each building is simplified
to a share of its triangles (KEEP_NEAR by the landing down to KEEP_FAR at the edge): its faces
are flat, so the shape barely changes.
Each one is moved from Earth-centred coordinates into the scene's frame (the Swiss LV95 grid
centred on the landing, x east, y up, z north) and set on the scene's own terrain, so the
two always meet whatever the geoid. The scene paints roofs with the aerial photo above them and
walls in plaster colours.

Output apps/jump/public/terrain/buildings.bin + buildings.json: positions int16 x4 (decimetres,
local), colours uint8 x4 (wall plaster), indices uint32. Roofs and walls are told apart in the
scene by the slope of each face.
"""
import json,math,struct,hashlib,subprocess,concurrent.futures as cf
from pathlib import Path
import numpy as np
import DracoPy
import pyfqmr

repo=Path(__file__).resolve().parent.parent;out=repo/'apps/jump/public/terrain'
cache=Path.home()/'vrtor-data/interlaken-cache/buildings';cache.mkdir(parents=True,exist_ok=True)
BASE='https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/20251121/'
RADIUS=1200
# Share of triangles kept: more near the landing, where you see them up close.
KEEP_NEAR,KEEP_FAR,NEAR=0.45,0.15,350
meta=json.loads((out/'interlaken.json').read_text())
E0,N0=meta['center']['lv95']

def wgs_to_lv95(lat,lon):
  p=(lat*3600-169028.66)/10000;l=(lon*3600-26782.5)/10000
  e=2600072.37+211455.93*l-10938.51*l*p-.36*l*p*p-44.54*l**3
  n=1200147.07+308807.95*p+3745.25*l*l+76.63*p*p-194.56*l*l*p+119.79*p**3
  return e,n

def ecef_to_geodetic(x,y,z):
  a=6378137.0;f=1/298.257223563;e2=f*(2-f);b=a*(1-f);ep2=(a*a-b*b)/(b*b)
  p=np.hypot(x,y);th=np.arctan2(z*a,p*b)
  lat=np.arctan2(z+ep2*b*np.sin(th)**3,p-e2*a*np.cos(th)**3);lon=np.arctan2(y,x)
  n=a/np.sqrt(1-e2*np.sin(lat)**2);h=p/np.cos(lat)-n
  return np.degrees(lat),np.degrees(lon),h

# Terrain heights, to stand each building on the same ground the scene draws.
levels=[]
for l in meta['levels']:
  h=np.fromfile(out/l['heights'],'<f4').reshape(l['size'],l['size']);levels.append((l['extent'],l['size'],h))
def ground(x,z):
  for extent,size,h in reversed(levels):
    if abs(x)<=extent/2 and abs(z)<=extent/2:
      u=(x/extent+.5)*(size-1);v=(z/extent+.5)*(size-1);a=min(size-2,int(u));b=min(size-2,int(v));tu=u-a;tv=v-b
      return (h[b,a]*(1-tu)+h[b,a+1]*tu)*(1-tv)+(h[b+1,a]*(1-tu)+h[b+1,a+1]*tu)*tv
  return 0.

def fetch(uri):
  path=cache/(hashlib.sha1(uri.encode()).hexdigest()+Path(uri).suffix)
  if not path.exists():
    tmp=path.with_suffix('.part')
    subprocess.run(['curl','-sfL','--retry','4','-m','120','-o',str(tmp),BASE+uri],check=True);tmp.rename(path)
  return path.read_bytes()

# Which leaf tiles touch the square around the landing.
lat0,lon0=math.radians(meta['center']['lat']),math.radians(meta['center']['lon'])
dlat=(RADIUS+300)/6378137;dlon=(RADIUS+300)/(6378137*math.cos(lat0))
box=(lon0-dlon,lat0-dlat,lon0+dlon,lat0+dlat)
hit=lambda r:not(r[2]<box[0] or r[0]>box[2] or r[3]<box[1] or r[1]>box[3])
leaves=[]
def walk(node,prefix):
  if not hit(node['boundingVolume']['region']):return
  c=node.get('content')
  if c:
    u=c['uri']
    if u.endswith('.json'):
      t=json.loads(fetch(prefix+u));walk(t['root'],(prefix+u).rsplit('/',1)[0]+'/' if '/' in prefix+u else '')
    elif not node.get('children'):leaves.append(prefix+u)
  for ch in node.get('children',[]):walk(ch,prefix)
walk(json.loads(fetch('tileset.json'))['root'],'')
with cf.ThreadPoolExecutor(8) as pool:blobs=list(pool.map(fetch,leaves))
print('tiles',len(leaves),flush=True)

def quat_matrix(q):
  x,y,z,w=q
  return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

buildings=[]
for blob in blobs:
  _,_,_,ftj,ftb,btj,btb=struct.unpack('<4sIIIIII',blob[:28])
  ft=json.loads(blob[28:28+ftj]);rtc=np.array(ft.get('RTC_CENTER',[0,0,0]))
  glb=blob[28+ftj+ftb+btj+btb:]
  jl=struct.unpack('<I',glb[12:16])[0];g=json.loads(glb[20:20+jl]);binary=glb[20+jl+8:]
  for node in g['nodes']:
    if 'mesh' not in node:continue
    R=quat_matrix(node.get('rotation',[0,0,0,1]));T=np.array(node.get('translation',[0,0,0]));S=np.array(node.get('scale',[1,1,1]))
    pos=[];idx=[];bid=[];count=0
    for prim in g['meshes'][node['mesh']]['primitives']:
      ext=prim['extensions']['KHR_draco_mesh_compression'];bv=g['bufferViews'][ext['bufferView']]
      m=DracoPy.decode(binary[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])
      p=np.asarray(m.points,dtype=np.float64).reshape(-1,3);f=np.asarray(m.faces,dtype=np.int64).reshape(-1,3)
      batch=np.asarray(m.get_attribute_by_unique_id(ext['attributes']['_BATCHID'])['data']).reshape(-1).astype(int)
      p=(R@(p*S).T).T+T
      # glTF is y-up; 3D Tiles turn it z-up, then add the tile's centre: Earth-centred metres.
      p=np.stack([p[:,0],-p[:,2],p[:,1]],axis=1)+rtc
      pos.append(p);idx.append(f+count);bid.append(batch);count+=len(p)
    if not pos:continue
    p=np.concatenate(pos);faces=np.concatenate(idx);batch=np.concatenate(bid)
    lat,lon,h=ecef_to_geodetic(p[:,0],p[:,1],p[:,2])
    e,n=wgs_to_lv95(lat,lon)
    local_all=np.stack([e-E0,h,n-N0],axis=1)
    face_batch=batch[faces[:,0]]
    for b in np.unique(face_batch):
      f=faces[face_batch==b]
      used,inv=np.unique(f,return_inverse=True)
      local=local_all[used].copy();f=inv.reshape(-1,3)
      cx,cz=local[:,0].mean(),local[:,2].mean()
      if math.hypot(cx,cz)>RADIUS:continue
      # Stand it on the scene's ground: its lowest point 30 cm into the lowest terrain under it.
      corners=[(local[:,0].min(),local[:,2].min()),(local[:,0].max(),local[:,2].min()),(local[:,0].min(),local[:,2].max()),(local[:,0].max(),local[:,2].max()),(cx,cz)]
      base=min(ground(x,z) for x,z in corners)
      local[:,1]+=base-0.3-local[:,1].min()
      # Weld the faces' copies of each corner (to a centimetre), so the simplifier sees one surface.
      _,first,weld=np.unique(np.round(local*100).astype(np.int64),axis=0,return_index=True,return_inverse=True)
      local=local[first];f=weld.reshape(-1)[f]
      f=f[(f[:,0]!=f[:,1])&(f[:,1]!=f[:,2])&(f[:,0]!=f[:,2])]
      # Every face comes twice, once per side: keep one (the scene lights faces from the side you see).
      _,once=np.unique(np.sort(f,axis=1),axis=0,return_index=True);f=f[np.sort(once)]
      if len(f)>24:
        simp=pyfqmr.Simplify();simp.setMesh(local,f)
        keep=KEEP_NEAR+(KEEP_FAR-KEEP_NEAR)*min(1,max(0,(math.hypot(cx,cz)-NEAR)/(RADIUS-NEAR)))
        simp.simplify_mesh(target_count=max(12,int(len(f)*keep)),aggressiveness=5,preserve_border=False,verbose=False)
        local,f,_=simp.getMesh()
      buildings.append((np.asarray(local,dtype=np.float64),np.asarray(f,dtype=np.int64)))
print('buildings',len(buildings),flush=True)

# Shared vertices; the scene works out each face's flat normal in its shader. Per building, a
# plaster colour for the walls (the roofs take the aerial photo).
rng=np.random.default_rng(7)
PLASTER=np.array([[236,230,218],[228,222,206],[242,238,229],[219,208,190],[232,224,210],[214,214,208],[226,214,196],[240,232,214]])
P=[];C=[];F=[];count=0
for local,f in buildings:
  plaster=np.clip(PLASTER[rng.integers(len(PLASTER))]*rng.uniform(.9,1.04),0,255)
  P.append(local);C.append(np.tile(np.append(plaster,255),(len(local),1)));F.append(f+count);count+=len(local)
P=np.concatenate(P);C=np.concatenate(C);F=np.concatenate(F)
assert np.abs(P).max()<3276,'positions overflow int16 decimetres'
pos16=np.zeros((len(P),4),dtype='<i2');pos16[:,:3]=np.round(P*10)
col8=C.astype('u1');idx32=F.astype('<u4')
blob=pos16.tobytes()+col8.tobytes()+idx32.tobytes()
(out/'buildings.bin').write_bytes(blob)
(out/'buildings.json').write_text(json.dumps({'vertices':len(P),'triangles':len(F),'buildings':len(buildings),'radius':RADIUS,
  'layout':'int16 x4 positions (decimetres, local; 4th unused) | uint8 x4 wall colour | uint32 x3 indices',
  'source':BASE+'tileset.json','credit':'Buildings: swissBUILDINGS3D © swisstopo','accessed':'2026-10-02'},indent=2)+'\n')
print('vertices',len(P),'triangles',len(F),'bytes',len(blob))
