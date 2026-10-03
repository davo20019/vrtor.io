"""The map on the Cybertruck's centre screen during the Big Sur ride (apps/cyb): the real coastline,
roads, creeks and named places around the drive, from OpenStreetMap, in the ride's local frame.
Run after scripts/prepare-cyb-bigsur.py:  python3 scripts/prepare-cyb-bigsur-map.py  (needs shapely)

Data © OpenStreetMap contributors, ODbL. Output: apps/cyb/public/bigsur/map.json
"""
import json,math,subprocess,hashlib
from pathlib import Path
import numpy as np
from shapely.geometry import LineString,Point,box
from shapely.ops import linemerge,split,unary_union
repo=Path(__file__).resolve().parent.parent;out=repo/'apps/cyb/public/bigsur'
cache=Path.home()/'vrtor-data/bigsur-cache';cache.mkdir(parents=True,exist_ok=True)
meta=json.loads((out/'bigsur.json').read_text())
LAT0,LON0=meta['center']['lat'],meta['center']['lon']
R=6371008.8;KX=R*math.cos(math.radians(LAT0))*math.pi/180;KZ=R*math.pi/180
def local(lat,lon):return ((lon-LON0)*KX,(lat-LAT0)*KZ)
S,W,N,E=36.300,-121.960,36.420,-121.830
def overpass(q):
  path=cache/('map-'+hashlib.sha1(q.encode()).hexdigest()+'.json')
  if not path.exists():
    subprocess.run(['curl','-sfL','--retry','6','--retry-all-errors','-m','300','-A','vrtor-educational-map/1.0','-o',str(path),
      '--data-urlencode','data='+q,'https://overpass-api.de/api/interpreter'],check=True)
  return json.loads(path.read_text())['elements']
bb=f'({S},{W},{N},{E})'
els=overpass(f'[out:json][timeout:180];(way["highway"]{bb};way["natural"="coastline"]{bb};way["waterway"~"river|stream"]{bb};'
  f'node["natural"~"peak|cape"]{bb};node["tourism"="viewpoint"]["name"]{bb};node["place"~"locality|islet|hamlet|isolated_dwelling"]{bb};'
  f'node["man_made"="lighthouse"]{bb};);out geom;')

def pts(e):return [local(g['lat'],g['lon']) for g in e['geometry']]
def simp(line,tol):return [[round(x,1),round(z,1)] for x,z in LineString(line).simplify(tol).coords]

# The sea: the frame's box, cut along the coastline; the piece holding a point well offshore.
(x0,z0),(x1,z1)=local(S,W),local(N,E)
frame=box(x0,z0,x1,z1)
coast=linemerge([LineString(pts(e)) for e in els if e['type']=='way' and e.get('tags',{}).get('natural')=='coastline'])
pieces=split(frame,coast)
offshore=Point(*local(36.35,-121.95))
sea=unary_union([g for g in pieces.geoms if g.intersects(offshore) or g.contains(offshore)]).simplify(3)
geoms=getattr(sea,'geoms',[sea])
seaRings=[[[round(x,1),round(z,1)] for x,z in g.exterior.coords] for g in geoms]
print('sea pieces',len(pieces.geoms),'kept',len(seaRings),'area km2',round(sea.area/1e6,1))

RANK={'motorway':0,'trunk':0,'primary':0,'secondary':1,'tertiary':1,'unclassified':2,'residential':2,'service':3,'track':3,'path':4,'footway':4}
roads=[];water=[];places=[]
for e in els:
  t=e.get('tags',{})
  if e['type']=='way' and 'highway' in t and t['highway'] in RANK:
    roads.append({'rank':RANK[t['highway']],'name':t.get('name'),'ref':t.get('ref'),'bridge':t.get('bridge')=='yes','pts':simp(pts(e),1.5)})
  elif e['type']=='way' and t.get('waterway') in ('river','stream'):
    water.append({'name':t.get('name'),'river':t['waterway']=='river','pts':simp(pts(e),3)})
  elif e['type']=='node' and t.get('name'):
    kind=t.get('natural') or t.get('tourism') or t.get('place') or t.get('man_made')
    x,z=local(e['lat'],e['lon']);places.append({'name':t['name'],'kind':kind,'x':round(x,1),'z':round(z,1),'ele':t.get('ele')})

# Along the drive: where it passes each named place within 400 m, for the guidance line.
P=np.array([[p[0],p[2]] for p in meta['road']['points']]);step=meta['road']['step']
along=[]
for pl in places:
  d=np.hypot(P[:,0]-pl['x'],P[:,1]-pl['z']);i=int(d.argmin())
  if d[i]<400 and pl['kind'] in ('viewpoint','cape','peak','locality'):along.append({'name':pl['name'],'s':round(i*step,1),'off':round(float(d[i]))})
for w in water:
  if not w['name']:continue
  L=LineString(w['pts'])
  for i in range(0,len(P),5):
    if L.distance(Point(*P[i]))<25:along.append({'name':w['name'],'s':round(i*step,1),'off':0});break
along.sort(key=lambda a:a['s'])
# One entry per name, the first time it's passed.
seen=set();along=[a for a in along if not (a['name'] in seen or seen.add(a['name']))]
print('along the drive:',[(a['name'],a['s']) for a in along])
print('roads',len(roads),'water',len(water),'places',len(places))
(out/'map.json').write_text(json.dumps({'credit':'© OpenStreetMap contributors (ODbL)','frame':[round(x0),round(z0),round(x1),round(z1)],
  'sea':seaRings,'roads':roads,'water':water,'places':places,'along':along})+'\n')
print('map.json',(out/'map.json').stat().st_size,'bytes')
