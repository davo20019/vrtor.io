"""Build the Interlaken drop zone for the parachute test (apps/jump): nested terrain squares
around the Hohematte, finest at the landing, from swisstopo open data.
Run: python3 scripts/prepare-jump-interlaken.py   (needs numpy, Pillow, curl and basisu)

Heights: swissALTI3D 2 m (swisstopo) within 2 km of the landing; farther out Mapzen Terrain
Tiles (Terrarium; SRTM/GMTED2010 courtesy USGS, public domain sources).
Imagery: SWISSIMAGE (swisstopo) within 32 km; the horizon ring beyond, which leaves
Switzerland, is Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified
Copernicus Sentinel data 2016), CC BY 4.0, https://s2maps.eu
swisstopo data: free geodata (OGD), use with source credit "© swisstopo".

The local frame is the Swiss LV95 grid (metres, within 0.002% of true scale here) centred on
the landing: x east, z north, y up from the landing's elevation.
"""
import math,json,hashlib,subprocess,io,zipfile,concurrent.futures as cf
from pathlib import Path
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
repo=Path(__file__).resolve().parent.parent;out=repo/'apps/jump/public/terrain';out.mkdir(parents=True,exist_ok=True)
cache=Path.home()/'vrtor-data/interlaken-cache';cache.mkdir(parents=True,exist_ok=True)
# Hohematte, the meadow in the middle of Interlaken.
LAT0,LON0=46.6868,7.8580

def wgs_to_lv95(lat,lon):
  p=(lat*3600-169028.66)/10000;l=(lon*3600-26782.5)/10000
  e=2600072.37+211455.93*l-10938.51*l*p-.36*l*p*p-44.54*l**3
  n=1200147.07+308807.95*p+3745.25*l*l+76.63*p*p-194.56*l*l*p+119.79*p**3
  return e,n
def lv95_to_wgs(e,n):
  y=(e-2600000)/1e6;x=(n-1200000)/1e6
  lon=2.6779094+4.728982*y+.791484*y*x+.1306*y*x*x-.0436*y**3
  lat=16.9023892+3.238272*x-.270978*y*y-.002528*x*x-.0447*y*y*x-.0140*x**3
  return lat*100/36,lon*100/36
E0,N0=(round(v) for v in wgs_to_lv95(LAT0,LON0))

# name, extent (m), grid vertices per side, height source, terrarium zoom, imagery, imagery zoom, texture size
LEVELS=[
  ('l4',256000,257,'terrarium',8,'eox',10,2048),
  ('l3',64000,513,'terrarium',11,'swissimage',13,4096),
  ('l2',16000,513,'terrarium',13,'swissimage',15,4096),
  ('l1',4000,257,'alti',None,'swissimage',17,4096),
  ('l0',1000,257,'alti',None,'swissimage',19,4096),
]
IMAGERY={'swissimage':'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
  'eox':'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'}
HEIGHTS='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'

def download(url):
  path=cache/(hashlib.sha1(url.encode()).hexdigest()+Path(url.split('?')[0]).suffix)
  if not path.exists():
    tmp=path.with_suffix(path.suffix+'.part')
    subprocess.run(['curl','-sfL','--retry','4','-m','120','-A','vrtor-educational-terrain/1.0','-o',str(tmp),url],check=True)
    tmp.rename(path)
  return path
def fetch_all(urls):
  with cf.ThreadPoolExecutor(8) as pool:return list(pool.map(download,urls))

def local_grid(extent,size,centred):
  """East/north metres of a size x size grid, rows north to south. centred: pixel centres, else grid vertices."""
  t=((np.arange(size)+.5)/size-.5)*extent if centred else (np.arange(size)/(size-1)-.5)*extent
  east,north=np.meshgrid(t,t[::-1]);return east,north
def to_mercator(east,north):
  lat,lon=lv95_to_wgs(E0+east,N0+north)
  return (lon+180)/360*256,(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*256

def bilinear(img,x,y):
  h,w=img.shape[:2];x=np.clip(x,0,w-1.001);y=np.clip(y,0,h-1.001)
  a=x.astype(int);b=y.astype(int);tx=x-a;ty=y-b
  if img.ndim==3:tx=tx[...,None];ty=ty[...,None]
  return (img[b,a]*(1-tx)+img[b,a+1]*tx)*(1-ty)+(img[b+1,a]*(1-tx)+img[b+1,a+1]*tx)*ty

def mercator_sample(template,z,px,py,decode,dtype,channels):
  X=px*2**z;Y=py*2**z
  x0,x1=int(X.min()//256),int(X.max()//256);y0,y1=int(Y.min()//256),int(Y.max()//256)
  urls=[template.format(z=z,x=x,y=y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
  paths=fetch_all(urls);w=x1-x0+1
  big=np.zeros(((y1-y0+1)*256,w*256)+((channels,) if channels>1 else ()),dtype=dtype)
  for i,path in enumerate(paths):
    r,c=divmod(i,w);big[r*256:(r+1)*256,c*256:(c+1)*256]=decode(Image.open(path))
  # Sample in rows so a 4096 x 4096 texture doesn't need gigabytes of float temporaries.
  result=np.empty(px.shape+((channels,) if channels>1 else ()),dtype=np.float32)
  for r0 in range(0,px.shape[0],256):
    sl=slice(r0,r0+256);result[sl]=bilinear(big,X[sl]-x0*256-.5,Y[sl]-y0*256-.5)
  return result,urls

def terrarium(im):
  rgb=np.asarray(im.convert('RGB'),dtype=np.float64);return rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768

def alti_tiles(extent):
  """swissALTI3D 2 m, newest survey of every 1 km tile covering the square; one mosaic in LV95."""
  half=extent/2+4;e0=int((E0-half)//1000);e1=int((E0+half)//1000);n0=int((N0-half)//1000);n1=int((N0+half)//1000)
  lat_a,lon_a=lv95_to_wgs(e0*1000,n0*1000);lat_b,lon_b=lv95_to_wgs((e1+1)*1000,(n1+1)*1000)
  url=f'https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items?bbox={lon_a-.01},{lat_a-.01},{lon_b+.01},{lat_b+.01}&limit=100'
  newest={}
  while url:
    page=json.loads(subprocess.run(['curl','-sfL',url],check=True,capture_output=True).stdout)
    for f in page['features']:
      year,tile=f['id'].split('_')[1:3];key=tuple(int(v) for v in tile.split('-'))
      href=next(a['href'] for k,a in f['assets'].items() if k.endswith('.xyz.zip') and '_2_2056_' in k)
      if key not in newest or year>newest[key][0]:newest[key]=(year,href)
    url=next((l['href'] for l in page.get('links',[]) if l['rel']=='next'),None)
  keys=[(e,n) for e in range(e0,e1+1) for n in range(n0,n1+1)]
  missing=[k for k in keys if k not in newest];assert not missing,missing
  paths=fetch_all([newest[k][1] for k in keys])
  # 2 m cells; the xyz file lists cell centres. Mosaic rows south to north.
  grid=np.full(((n1-n0+1)*500,(e1-e0+1)*500),np.nan,dtype=np.float32)
  for (e,n),path in zip(keys,paths):
    with zipfile.ZipFile(path) as z:
      xyz=np.loadtxt(io.TextIOWrapper(z.open(z.namelist()[0])),skiprows=1,dtype=np.float64)
    c=np.floor((xyz[:,0]-e0*1000)/2).astype(int);r=np.floor((xyz[:,1]-n0*1000)/2).astype(int)
    grid[r,c]=xyz[:,2]
  assert np.isfinite(grid).all()
  def sample(east,north):
    # Cell centres sit at 1 m, 3 m, ... from the tile corner.
    return bilinear(grid,(E0+east-e0*1000-1)/2,(N0+north-n0*1000-1)/2)
  return sample,[newest[k][1] for k in keys]

def coarse_at(level,east,north):
  """Bilinear height of a level's grid (rows north to south here) at local east/north."""
  n=level['size'];h=level['heights']
  u=(east/level['extent']+.5)*(n-1);v=(.5-north/level['extent'])*(n-1)
  return bilinear(h,u,v)

done=[];meta={'center':{'lat':LAT0,'lon':LON0,'lv95':[E0,N0]},'levels':[]}
for name,extent,size,hsrc,hz,isrc,iz,tex in LEVELS:
  east,north=local_grid(extent,size,False)
  if hsrc=='alti':
    sample,hurls=alti_tiles(extent);heights=sample(east,north).astype(np.float64)
  else:
    px,py=to_mercator(east,north);heights,hurls=mercator_sample(HEIGHTS,hz,px,py,terrarium,np.float64,1)
  if done:
    # Meet the next coarser square exactly along its edge: blend the outer two coarse cells.
    outer=done[-1];step=outer['extent']/(outer['size']-1);half=extent/2
    assert abs(half/step-round(half/step))<1e-9,(name,half,step)
    gap=half-np.maximum(abs(east),abs(north));w=np.clip(gap/(2*step),0,1);w=w*w*(3-2*w)
    heights=coarse_at(outer,east,north)*(1-w)+heights*w
  level={'name':name,'extent':extent,'size':size,'heights':heights.astype(np.float64)};done.append(level)
  # Imagery, north at the top.
  ie,inn=local_grid(extent,tex,True);px,py=to_mercator(ie,inn)
  rgb,iurls=mercator_sample(IMAGERY[isrc],iz,px,py,lambda im:np.asarray(im.convert('RGB')),np.uint8,3)
  jpg=cache/f'{name}.jpg';Image.fromarray(np.clip(rgb+.5,0,255).astype(np.uint8)).save(jpg,quality=90)
  level.update(source=hsrc,imagery=isrc,iurls=len(iurls),hurls=len(hurls))
  print(name,extent,'m',size,'grid',hsrc,len(hurls),'height files',isrc,len(iurls),'image tiles',flush=True)

base=float(coarse_at(done[-1],np.array([0.]),np.array([0.]))[0])
for level in done:
  rel=(level['heights']-base)[::-1].astype('<f4')  # rows south to north for the scene
  (out/f"{level['name']}.bin").write_bytes(rel.tobytes())
  ktx=out/f"{level['name']}.ktx2"
  subprocess.run(['basisu','-etc1s','-ktx2','-mipmap','-quality','128','-effort','4',str(cache/f"{level['name']}.jpg"),'-output_file',str(ktx)],check=True,capture_output=True)
  meta['levels'].append({'name':level['name'],'extent':level['extent'],'size':level['size'],'heights':f"{level['name']}.bin",'texture':f"{level['name']}.ktx2",
    'heightSource':level['source'],'imagery':level['imagery'],'elevationRange':[round(float(rel.min()+base),1),round(float(rel.max()+base),1)]})
  print('KTX2',ktx.name,ktx.stat().st_size,'bytes',flush=True)
meta.update(referenceElevation=round(base,2),format='heights: little-endian float32 metres above the landing; rows south to north, columns west to east. texture: north at the top.',
  credit='Terrain and imagery © swisstopo (swissALTI3D, SWISSIMAGE). Distant relief: Mapzen Terrain Tiles (SRTM/GMTED2010, USGS). Distant imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.',
  accessed='2026-10-02')
(out/'interlaken.json').write_text(json.dumps(meta,indent=2)+'\n')
print('BASE',base,'LV95',E0,N0)
