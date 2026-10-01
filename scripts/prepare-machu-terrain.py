"""Build background elevation data (not imagery) from Mapzen Terrain Tiles.
Run with Blender: blender --factory-startup -b --python scripts/prepare-machu-terrain.py
SRTM/GMTED2010 data courtesy USGS, via Mapzen; public domain source datasets.
Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
"""
import bpy,math,json,urllib.request,hashlib
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent.parent/'apps/mpc/public/models'
cache=Path('/tmp/vrtor-machu-elevation');cache.mkdir(exist_ok=True)
lat=-13.1635;lon=-72.5462;zoom=13;tiles=2**zoom
cx=(lon+180)/360*tiles;cy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*tiles
ix=int(cx);iy=int(cy);mosaic=np.zeros((768,768),dtype=np.float32);sources=[]
for dy in [-1,0,1]:
 for dx in [-1,0,1]:
  x=ix+dx;y=iy+dy;url=f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{zoom}/{x}/{y}.png';path=cache/f'{x}-{y}.png'
  if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=30).read())
  im=bpy.data.images.load(str(path));im.colorspace_settings.name='Non-Color'
  pixels=np.empty(256*256*4,dtype=np.float32);im.pixels.foreach_get(pixels)
  # Blender stores image pixels from the bottom; map tiles are north at the top.
  rgb=np.rint(pixels.reshape(256,256,4)[::-1,:,:3]*255)
  heights=rgb[:,:,0]*256+rgb[:,:,1]+rgb[:,:,2]/256-32768
  mosaic[(dy+1)*256:(dy+2)*256,(dx+1)*256:(dx+2)*256]=heights
  sources.append({'url':url,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
  bpy.data.images.remove(im)
mpp=40075016.68557849*math.cos(math.radians(lat))/(tiles*256)
px=(cx-(ix-1))*256-.5;py=(cy-(iy-1))*256-.5

def sample(x,y):
 assert 0<=x<767 and 0<=y<767
 a=int(x);b=int(y);tx=x-a;ty=y-b
 return float((mosaic[b,a]*(1-tx)+mosaic[b,a+1]*tx)*(1-ty)+(mosaic[b+1,a]*(1-tx)+mosaic[b+1,a+1]*tx)*ty)
base=sample(px,py);size=513;extent=10000
field=np.empty((size,size),dtype='<f4')
for row in range(size):
 for col in range(size):
  east=(col/(size-1)-.5)*extent;north=(row/(size-1)-.5)*extent
  field[row,col]=sample(px+east/mpp,py-north/mpp)-base
assert np.isfinite(field).all() and field.max()-field.min()>500
(root/'andes-height.bin').write_bytes(field.tobytes())
meta={'center':[lat,lon],'resolution':size,'extent':extent,'referenceElevation':round(base,3),'elevationRange':[round(float(field.min()+base),3),round(float(field.max()+base),3)],'format':'little-endian float32, relative metres; rows south to north, columns west to east','sources':sources,'accessed':'2026-10-01','adaptation':'Bilinearly resampled. Scene flattens the central 350 metres and blends to original relief by 600 metres. Survey placement/orientation relative to terrain is approximate, not georeferenced.'}
(root/'andes.json').write_text(json.dumps(meta,indent=2)+'\n')
print('TERRAIN',size,extent,'reference',base,'elevation range',meta['elevationRange'],'bytes',field.nbytes)
