"""Build the Big Sur drive for the Cybertruck's self-driving ride (apps/cyb): Highway 1 from the
south end of Bixby Creek Bridge south toward Hurricane Point, about 5 km, from US open data.
Run: python3 scripts/prepare-cyb-bigsur.py   (needs numpy, Pillow, curl and basisu)

Road: OpenStreetMap way 121666414 (CA 1, Cabrillo Highway), © OpenStreetMap contributors, ODbL.
Heights: USGS 3D Elevation Program (3DEP) lidar DEM, public domain, near the road; farther out
Mapzen Terrain Tiles (SRTM/GMTED2010 courtesy USGS, public domain sources).
Imagery: USDA NAIP via USGS The National Map, public domain.

Local frame: metres, x east, z north, y up from sea level (NAVD88), centred on CENTER; a plain
equirectangular projection, which is within a few centimetres of true over this small square.
Outputs go to apps/cyb/public/bigsur/.
"""
import math,json,hashlib,subprocess,io,concurrent.futures as cf
from pathlib import Path
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
repo=Path(__file__).resolve().parent.parent;out=repo/'apps/cyb/public/bigsur';out.mkdir(parents=True,exist_ok=True)
cache=Path.home()/'vrtor-data/bigsur-cache';cache.mkdir(parents=True,exist_ok=True)

WAY=121666414
LAT0,LON0=36.3520,-121.8945          # middle of the drive
R=6371008.8;KX=R*math.cos(math.radians(LAT0))*math.pi/180;KZ=R*math.pi/180
def to_local(lat,lon):return (np.asarray(lon)-LON0)*KX,(np.asarray(lat)-LAT0)*KZ
def to_wgs(x,z):return LAT0+np.asarray(z)/KZ,LON0+np.asarray(x)/KX

NAIP='https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage'
DEP='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
TERRARIUM='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
SEA=-25.0     # ground under the sea is pushed down, well clear of the water surface

def download(url,data=None,suffix=''):
  key=url+(data or '')
  path=cache/(hashlib.sha1(key.encode()).hexdigest()+suffix)
  if not path.exists():
    tmp=path.with_suffix(path.suffix+'.part')
    cmd=['curl','-sfL','--retry','6','--retry-all-errors','-m','300','-A','vrtor-educational-terrain/1.0','-o',str(tmp)]
    if data:cmd+=['--data-urlencode',data]
    subprocess.run(cmd+[url],check=True);tmp.rename(path)
  return path
def fetch_all(jobs):
  with cf.ThreadPoolExecutor(3) as pool:return list(pool.map(lambda j:download(*j),jobs))

def bilinear(img,x,y):
  h,w=img.shape[:2];x=np.clip(x,0,w-1.001);y=np.clip(y,0,h-1.001)
  a=x.astype(int);b=y.astype(int);tx=x-a;ty=y-b
  if img.ndim==3:tx=tx[...,None];ty=ty[...,None]
  return (img[b,a]*(1-tx)+img[b,a+1]*tx)*(1-ty)+(img[b+1,a]*(1-tx)+img[b+1,a+1]*tx)*ty

def merc(lat,lon):
  return np.radians(lon)*6378137.0,np.log(np.tan(np.pi/4+np.radians(lat)/2))*6378137.0

class Raster:
  """An ArcGIS ImageServer raster in Web Mercator (square pixels there, so the server keeps the extent
  as asked; it's checked against the server's answer), fetched in chunks, sampled at local x/z."""
  def __init__(self,server,x0,x1,z0,z1,res,kind,chunk=2000):
    (la0,lo0),(la1,lo1)=to_wgs(x0,z0),to_wgs(x1,z1)
    (mx0,my0),(mx1,my1)=merc(la0,lo0),merc(la1,lo1)
    pix=res/math.cos(math.radians(LAT0))           # mercator metres per pixel
    W=int(math.ceil((mx1-mx0)/pix));H=int(math.ceil((my1-my0)/pix))
    self.mx0,self.my1,self.pix=mx0,my0+H*pix,pix
    jobs=[];tiles=[]
    for r0 in range(0,H,chunk):
      for c0 in range(0,W,chunk):
        h=min(chunk,H-r0);w=min(chunk,W-c0)
        bb=f'{mx0+c0*pix:.3f},{self.my1-(r0+h)*pix:.3f},{mx0+(c0+w)*pix:.3f},{self.my1-r0*pix:.3f}'
        common=f'?bbox={bb}&bboxSR=3857&imageSR=3857&size={w},{h}&interpolation=RSP_BilinearInterpolation'
        if kind=='dem':q=common+'&format=tiff&pixelType=F32&noData=-9999&compression=None'
        else:q=common+'&format=jpg&compressionQuality=92'
        jobs.append((server+q+'&f=image',None,'.tif' if kind=='dem' else '.jpg'));tiles.append((r0,c0,h,w,bb))
    # The server's own idea of the first chunk's extent: it must be the one asked for.
    info=json.loads(download(server+jobs[0][0][len(server):].replace('&f=image','&f=json'),None,'.json').read_text())
    e=info['extent'];want=[float(v) for v in tiles[0][4].split(',')]
    assert max(abs(e['xmin']-want[0]),abs(e['ymin']-want[1]),abs(e['xmax']-want[2]),abs(e['ymax']-want[3]))<pix,(e,want)
    self.img=np.zeros((H,W)+(() if kind=='dem' else (3,)),dtype=np.float32)
    for (r0,c0,h,w,_),p in zip(tiles,fetch_all(jobs)):
      im=Image.open(p);a=np.asarray(im if kind=='dem' else im.convert('RGB'),dtype=np.float32)
      assert a.shape[:2]==(h,w),(p,a.shape,h,w)
      self.img[r0:r0+h,c0:c0+w]=a
    if kind=='dem':
      bad=self.img<-1000;self.img[bad]=SEA
      print('  dem',W,'x',H,'nodata',round(bad.mean()*100,1),'%',flush=True)
    else:print('  image',W,'x',H,flush=True)
  def __call__(self,x,z):
    mx,my=merc(*to_wgs(x,z))
    return bilinear(self.img,(mx-self.mx0)/self.pix-.5,(self.my1-my)/self.pix-.5)

def terrarium_heights(x,z,zoom):
  lat,lon=to_wgs(x,z);n=2**zoom
  X=(lon+180)/360*n*256;Y=(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*n*256
  tx0,tx1=int(X.min()//256),int(X.max()//256);ty0,ty1=int(Y.min()//256),int(Y.max()//256)
  jobs=[(TERRARIUM.format(z=zoom,x=tx,y=ty),None,'.png') for ty in range(ty0,ty1+1) for tx in range(tx0,tx1+1)]
  paths=fetch_all(jobs);w=tx1-tx0+1
  big=np.zeros(((ty1-ty0+1)*256,w*256))
  for i,p in enumerate(paths):
    r,c=divmod(i,w);rgb=np.asarray(Image.open(p).convert('RGB'),dtype=np.float64)
    big[r*256:(r+1)*256,c*256:(c+1)*256]=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
  return bilinear(big,X-tx0*256-.5,Y-ty0*256-.5)

# ---------------------------------------------------------------- the road

osm=json.loads(download('https://overpass-api.de/api/interpreter',f'data=[out:json];way({WAY});out geom;','.json').read_text())
geom=osm['elements'][0]['geometry'];tags=osm['elements'][0]['tags']
lat=np.array([g['lat'] for g in geom])[::-1];lon=np.array([g['lon'] for g in geom])[::-1]  # north to south
px,pz=to_local(lat,lon)
# Densify to 1 m, then smooth away the corners between OSM nodes (sigma 6 m); the ends stay put.
seg=np.hypot(np.diff(px),np.diff(pz));s=np.concatenate([[0],np.cumsum(seg)]);L=s[-1]
S=np.arange(0,L,1.0);X=np.interp(S,s,px);Z=np.interp(S,s,pz)
k=np.exp(-.5*(np.arange(-24,25)/6.0)**2);k/=k.sum()
def smooth(a,k):
  p=len(k)//2;ap=np.concatenate([2*a[0]-a[p:0:-1],a,2*a[-1]-a[-2:-p-2:-1]]);return np.convolve(ap,k,'valid')
X=smooth(X,k);Z=smooth(Z,k)
seg=np.hypot(np.diff(X),np.diff(Z));s=np.concatenate([[0],np.cumsum(seg)]);L=s[-1]
# Resample evenly every 2 m along the smoothed line.
STEP=2.0;S=np.arange(0,L,STEP);X=np.interp(S,s,X);Z=np.interp(S,s,Z)
# Fair the line: real highways bend in smooth transitions (spirals into arcs), but the mapped line
# keeps small kinks every few tens of metres, which a following truck feels as a weave. Move each
# point sideways (at most ~0.4 m) to make the curvature change as smoothly as it can.
def roughness(X,Z):
  h=np.unwrap(np.arctan2(np.gradient(X),np.gradient(Z)));k=np.gradient(h)/STEP;return float(np.sqrt(np.mean((np.diff(k)/STEP)**2))),k
def fair(X,Z,lam):
  n=len(X);d2=np.zeros((n-2,n));i=np.arange(n-2);d2[i,i]=1;d2[i,i+1]=-2;d2[i,i+2]=1;d2/=STEP**2
  d1=np.zeros((n-3,n-2));j=np.arange(n-3);d1[j,j]=-1;d1[j,j+1]=1;d1/=STEP
  for _ in range(3):
    tx=np.gradient(X);tz=np.gradient(Z);l=np.hypot(tx,tz);tx/=l;tz/=l;nx_,nz_=tz,-tx
    _,k=roughness(X,Z);A=d1@d2;b=-d1@k[1:-1]
    M=A.T@A+lam*np.eye(n);M[0,0]+=1e9;M[-1,-1]+=1e9      # the ends stay where they are
    off=np.linalg.solve(M,A.T@b);X=X+nx_*off;Z=Z+nz_*off
  return X,Z
r0,_=roughness(X,Z);X0,Z0=X.copy(),Z.copy()
lo,hi=1e-6,1e3
for _ in range(30):                                   # the gentlest fairing that moves no point more than 0.4 m
  lam=math.sqrt(lo*hi);Xf,Zf=fair(X0,Z0,lam);moved=float(np.hypot(Xf-X0,Zf-Z0).max())
  if moved>0.4:lo=lam
  else:hi=lam
X,Z=fair(X0,Z0,hi);moved=float(np.hypot(X-X0,Z-Z0).max())
print('faired: moved at most',round(moved,2),'m; curvature roughness',round(r0,6),'->',round(roughness(X,Z)[0],6),flush=True)
tx=np.gradient(X);tz=np.gradient(Z);tl=np.hypot(tx,tz);tx/=tl;tz/=tl
nx,nz=tz,-tx                                  # unit normal to the right of travel
heading=np.arctan2(tx,tz)
curv=np.gradient(np.unwrap(heading))/STEP     # 1/m, positive turning right
print('road',tags.get('ref'),tags.get('name'),'length',round(L),'m','min radius',round(1/np.abs(curv).max()),'m',flush=True)

x0,x1=X.min()-500,X.max()+500;z0,z1=Z.min()-500,Z.max()+500
# l0: the near rectangle, on a 40 m lattice so it lines up with l1's grid.
x0=math.floor(x0/40)*40;x1=math.ceil(x1/40)*40;z0=math.floor(z0/40)*40;z1=math.ceil(z1/40)*40
print('l0',x0,x1,z0,z1,'=',x1-x0,'x',z1-z0,'m',flush=True)
dem=Raster(DEP,x0,x1,z0,z1,1.0,'dem')
naip=Raster(NAIP,x0,x1,z0,z1,0.6,'image')

# Road surface: the lidar ground along the centre line, smoothed over ~30 m so the deck is a road, not a texture.
cy=dem(X,Z).astype(np.float64)
k2=np.exp(-.5*(np.arange(-15,16)/5.0)**2);k2/=k2.sum()   # rows are 2 m apart: sigma 10 m
RY=smooth(cy,k2)
grade=np.gradient(RY)/STEP
print('road heights',round(RY.min(),1),'to',round(RY.max(),1),'m; steepest grade',round(np.abs(grade).max()*100,1),'%',flush=True)

# Corridor: a 2 m strip of ground either side of the road, out to CORR m, flat across the paved width.
CORR=24.0;PAVE=4.6;SHOULDER=8.0
d=np.arange(-CORR,CORR+.01,2.0)
cxg=X[:,None]+nx[:,None]*d[None,:];czg=Z[:,None]+nz[:,None]*d[None,:]
ground=dem(cxg,czg).astype(np.float64)
w=np.clip((np.abs(d)-PAVE)/(SHOULDER-PAVE),0,1);w=w*w*(3-2*w)
corr=RY[:,None]*(1-w)+ground*w
corr[:,np.abs(d)<=PAVE]-=0.06                  # just under the road mesh
# The road's own line: each point's lateral distance from the corridor's centre, for the carve below.

# ---------------------------------------------------------------- the levels

def grid(x0,x1,z0,z1,step):
  xs=np.arange(x0,x1+.01,step);zs=np.arange(z0,z1+.01,step)
  gx,gz=np.meshgrid(xs,zs);return gx,gz          # rows south to north

def dist_to_road(gx,gz):
  """Distance (m) from each point to the road's centre line (nearest of the 2 m samples)."""
  from numpy.lib.stride_tricks import sliding_window_view  # noqa: F401
  best=np.full(gx.shape,1e9)
  for i in range(0,len(X),2):
    dd=(gx-X[i])**2+(gz-Z[i])**2;np.minimum(best,dd,out=best)
  return np.sqrt(best)

levels=[]
# l0: 5 m grid from the lidar; under the corridor it's lowered so the corridor strip lies on top.
gx,gz=grid(x0,x1,z0,z1,5.0);h0=dem(gx,gz).astype(np.float64)
dist=dist_to_road(gx,gz)
under=np.clip((CORR-2-dist)/4,0,1)              # none by the strip's outer edge, which meets l0 exactly
h0-=under*1.5
levels.append(dict(name='l0',x0=x0,x1=x1,z0=z0,z1=z1,step=5.0,h=h0))

# l1: 40 m, 20.48 km square centred on the origin.
E1=10240;gx1,gz1=grid(-E1,E1,-E1,E1,40.0)
dem1=Raster(DEP,-E1,E1,-E1,E1,20.0,'dem')
h1=dem1(gx1,gz1).astype(np.float64)
levels.append(dict(name='l1',x0=-E1,x1=E1,z0=-E1,z1=E1,step=40.0,h=h1))
# l2: 320 m, 81.92 km square, the horizon: mountains inland, sea to the west.
E2=40960;gx2,gz2=grid(-E2,E2,-E2,E2,320.0)
h2=terrarium_heights(gx2,gz2,10)
h2[h2<0.5]=SEA
levels.append(dict(name='l2',x0=-E2,x1=E2,z0=-E2,z1=E2,step=320.0,h=h2))

def sample_level(lv,x,z):
  return bilinear(lv['h'],(x-lv['x0'])/lv['step'],(z-lv['z0'])/lv['step'])
# Each finer level's outer two cells bend onto the coarser one, so they meet without cracks.
for inner,outer in ((levels[1],levels[2]),(levels[0],levels[1])):
  gx,gz=grid(inner['x0'],inner['x1'],inner['z0'],inner['z1'],inner['step'])
  gap=np.minimum.reduce([gx-inner['x0'],inner['x1']-gx,gz-inner['z0'],inner['z1']-gz])
  wv=np.clip(gap/(2*outer['step']),0,1);wv=wv*wv*(3-2*wv)
  inner['h']=sample_level(outer,gx,gz)*(1-wv)+inner['h']*wv
# The corridor's outer edge follows l0's surface exactly (its bilinear stand-in).
edge=np.abs(d)>=CORR-.01
corr[:,edge]=sample_level(levels[0],cxg[:,edge],czg[:,edge])
for lv in levels:
  lv['h'][lv['h']<0.3]=np.minimum(lv['h'][lv['h']<0.3],SEA)   # under the sea: well below the water

# Imagery, north at the top.
def image_for(lv,raster,px_per_m,max_px):
  W=int(min(max_px,round((lv['x1']-lv['x0'])*px_per_m)));H=int(min(max_px,round((lv['z1']-lv['z0'])*px_per_m)))
  xs=lv['x0']+(np.arange(W)+.5)/W*(lv['x1']-lv['x0']);zs=lv['z1']-(np.arange(H)+.5)/H*(lv['z1']-lv['z0'])
  rgb=np.empty((H,W,3),np.float32)
  for r0 in range(0,H,512):
    gx,gz=np.meshgrid(xs,zs[r0:r0+512]);rgb[r0:r0+512]=raster(gx,gz)
  return rgb

def ocean_fill(rgb,lv,hfun):
  """Where the photo has no data (black or white past the coast), the sea's colour."""
  H,W=rgb.shape[:2];xs=lv['x0']+(np.arange(W)+.5)/W*(lv['x1']-lv['x0']);zs=lv['z1']-(np.arange(H)+.5)/H*(lv['z1']-lv['z0'])
  gx,gz=np.meshgrid(xs,zs)
  empty=(rgb.max(axis=2)<6)|(rgb.min(axis=2)>250)
  sea=np.array([22,52,72],np.float32)
  rgb[empty]=sea;return rgb

print('imagery l0',flush=True)
img0=image_for(levels[0],naip,1/0.6,8192)
print('imagery l1',flush=True)
naip1=Raster(NAIP,-E1,E1,-E1,E1,5.0,'image')
img1=ocean_fill(image_for(levels[1],naip1,1/5.0,4096),levels[1],None)
print('imagery l2',flush=True)
naip2=Raster(NAIP,-E2,E2,-E2,E2,40.0,'image')
img2=ocean_fill(image_for(levels[2],naip2,1/40.0,2048),levels[2],None)

meta={'center':{'lat':LAT0,'lon':LON0},'levels':[],'seaLevel':0,
  'format':'heights: little-endian float32 metres above sea level; rows south to north, columns west to east. texture: north at the top.'}
for lv,img in zip(levels,(img0,img1,img2)):
  h=lv['h'].astype('<f4');(out/f"{lv['name']}.bin").write_bytes(h.tobytes())
  jpg=cache/f"{lv['name']}.jpg";Image.fromarray(np.clip(img+.5,0,255).astype(np.uint8)).save(jpg,quality=90)
  ktx=out/f"{lv['name']}.ktx2"
  subprocess.run(['basisu','-etc1s','-ktx2','-mipmap','-quality','160','-effort','4',str(jpg),'-output_file',str(ktx)],check=True,capture_output=True)
  meta['levels'].append({'name':lv['name'],'x0':lv['x0'],'x1':lv['x1'],'z0':lv['z0'],'z1':lv['z1'],'step':lv['step'],
    'nx':h.shape[1],'nz':h.shape[0],'heights':f"{lv['name']}.bin",'texture':f"{lv['name']}.ktx2"})
  print(lv['name'],h.shape,'ktx',ktx.stat().st_size,flush=True)

# The road and its corridor strip.
corr32=corr.astype('<f4');(out/'corridor.bin').write_bytes(corr32.tobytes())
meta['road']={'way':WAY,'ref':tags.get('ref'),'name':tags.get('name'),'step':STEP,'length':round(float(S[-1]),1),
  'points':[[round(float(a),2),round(float(b),3),round(float(c),2)] for a,b,c in zip(X,RY,Z)],
  'paveHalfWidth':PAVE,'laneWidth':3.6,
  'corridor':{'file':'corridor.bin','offsets':[float(v) for v in d],'rows':len(X)}}
meta['credit']=('Road: © OpenStreetMap contributors (ODbL). Elevation: USGS 3D Elevation Program, and Mapzen Terrain Tiles '
  '(SRTM/GMTED2010, USGS). Imagery: USDA NAIP via USGS The National Map. All public domain except OpenStreetMap.')
meta['accessed']='2026-10-03'
(out/'bigsur.json').write_text(json.dumps(meta)+'\n')
# A check picture: the photo with the road line drawn on it.
chk=Image.fromarray(np.clip(img0,0,255).astype(np.uint8));from PIL import ImageDraw;dr=ImageDraw.Draw(chk)
W,H=chk.size;lv=levels[0]
pts=[((x-lv['x0'])/(lv['x1']-lv['x0'])*W,(lv['z1']-z)/(lv['z1']-lv['z0'])*H) for x,z in zip(X,Z)]
dr.line(pts,fill=(255,0,0),width=2);chk.save(cache/'check-road.jpg',quality=85)
print('done',cache/'check-road.jpg')
