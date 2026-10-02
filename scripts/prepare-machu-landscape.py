"""Build the distant elevation ring and satellite surface colour for the Machu Picchu backdrop.
Run: python3 scripts/prepare-machu-landscape.py   (needs numpy and Pillow)
Heights: Mapzen Terrain Tiles; SRTM/GMTED2010 courtesy USGS (public domain sources).
Imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus
Sentinel data 2016), CC BY 4.0, https://s2maps.eu
"""
import math,json,hashlib,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
repo=Path(__file__).resolve().parent.parent;models=repo/'apps/mpc/public/models';materials=repo/'apps/mpc/public/materials'
cache=Path('/tmp/vrtor-machu-landscape');cache.mkdir(exist_ok=True)
near=json.loads((models/'andes.json').read_text())
lat0,lon0=near['center'];base=near['referenceElevation']
R=6378137.0
HEIGHTS='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
IMAGERY='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'

def fetch(template,z,x,y,sources):
  url=template.format(z=z,x=x,y=y);path=cache/(hashlib.sha1(url.encode()).hexdigest()+Path(url).suffix)
  if not path.exists():
    subprocess.run(['curl','-sfL','--retry','3','-m','60','-A','vrtor-educational-terrain/1.0','-o',str(path),url],check=True)
  sources.append({'url':url,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
  return Image.open(path)

def grid(size,extent):
  """Local east/north metres to fractional Web Mercator pixel coordinates at zoom 0 (x 0..256)."""
  t=np.linspace(-.5,.5,size)*extent;east,north=np.meshgrid(t,t)  # rows south to north
  lat=lat0+np.degrees(north/R);lon=lon0+np.degrees(east/(R*math.cos(math.radians(lat0))))
  px=(lon+180)/360*256;py=(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*256
  return px,py

def mosaic(template,z,px,py,decode,sources):
  scale=2**z;X=px*scale;Y=py*scale
  x0,x1=int(X.min()//256),int(X.max()//256);y0,y1=int(Y.min()//256),int(Y.max()//256)
  tiles=[[decode(fetch(template,z,x,y,sources)) for x in range(x0,x1+1)] for y in range(y0,y1+1)]
  big=np.concatenate([np.concatenate(row,axis=1) for row in tiles],axis=0)
  return bilinear(big,X-x0*256-.5,Y-y0*256-.5)

def bilinear(img,x,y):
  h,w=img.shape[:2];x=np.clip(x,0,w-1.001);y=np.clip(y,0,h-1.001)
  a=x.astype(int);b=y.astype(int);tx=x-a;ty=y-b
  if img.ndim==3:tx=tx[...,None];ty=ty[...,None]
  return (img[b,a]*(1-tx)+img[b,a+1]*tx)*(1-ty)+(img[b+1,a]*(1-tx)+img[b+1,a+1]*tx)*ty

def terrarium(im):
  rgb=np.asarray(im.convert('RGB'),dtype=np.float64)
  return rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768

def colour(im):return np.asarray(im.convert('RGB'),dtype=np.float32)

# Distant ring: 40 km square, 156.25 m spacing, so grid lines fall exactly on the near grid's 10 km edge.
far_size,far_extent=257,40000;height_sources=[]
px,py=grid(far_size,far_extent)
far=(mosaic(HEIGHTS,12,px,py,terrarium,height_sources)-base).astype('<f4')
assert np.isfinite(far).all() and far.max()-far.min()>2500
(models/'andes-far-height.bin').write_bytes(far.tobytes())

# Surface colour, north at the top of each image.
image_sources={}
def drape(name,size,extent,z):
  srcs=image_sources.setdefault(name,[])
  px,py=grid(size,extent)
  rgb=mosaic(IMAGERY,z,px,py,colour,srcs)[::-1]
  Image.fromarray(np.clip(rgb+.5,0,255).astype(np.uint8)).save(materials/name,quality=84,optimize=True,progressive=True)
drape('andes-near.jpg',2048,near['extent'],14)
drape('andes-far.jpg',2048,far_extent,13)

meta={'center':[lat0,lon0],'referenceElevation':base,
  'far':{'resolution':far_size,'extent':far_extent,'file':'andes-far-height.bin','format':'little-endian float32, relative metres; rows south to north, columns west to east',
    'elevationRange':[round(float(far.min()+base),3),round(float(far.max()+base),3)],'sources':height_sources},
  'imagery':{'near':{'file':'../materials/andes-near.jpg','texture':'../materials/andes-near.ktx2','extent':near['extent'],'zoom':14,'sources':image_sources['andes-near.jpg']},
    'far':{'file':'../materials/andes-far.jpg','texture':'../materials/andes-far.ktx2','extent':far_extent,'zoom':13,'sources':image_sources['andes-far.jpg']},
    'credit':'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0, https://s2maps.eu'},
  'accessed':'2026-10-01',
  'adaptation':'Heights bilinearly resampled from Terrarium zoom 12; imagery reprojected from Web Mercator to a local east/north square and bilinearly resampled. The scene fades the imagery to illustrative cover within about 800 m of the citadel, where the reconstruction is not georeferenced.'}
(models/'andes-landscape.json').write_text(json.dumps(meta,indent=2)+'\n')
print('FAR',far_size,far_extent,'range',meta['far']['elevationRange'],'tiles',len(height_sources),{k:len(v) for k,v in image_sources.items()})
