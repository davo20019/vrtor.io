"""Reject the mirrored PnP branch and document the remaining exterior calibration error.
Run with assets-src/cybertruck/.venv/bin/python measure/windshield/c134-cowl.py.
The reference dimensions do not support an accurate camera: query values are not accepted measurements.
"""
import json,numpy as np,cv2
from pathlib import Path
from scipy.optimize import least_squares
from PIL import Image,ImageDraw
jobpath=Path(__file__).with_name('c134-cowl.json');job=json.loads(jobpath.read_text());W,H=Image.open(jobpath.parent/job['photo']).size
obj=np.array([r['mm'] for r in job['refs'].values()]);pix=np.array([r['px'] for r in job['refs'].values()]);look=obj.mean(axis=0)
def initial(eye,f):
 fw=look-eye;fw/=np.linalg.norm(fw);right=np.cross(fw,[0,1,0]);right/=np.linalg.norm(right);down=np.cross(fw,right);R=np.stack([right,down,fw]);return np.r_[cv2.Rodrigues(R)[0].ravel(),-R@eye,np.log(f)]
def residual(v):
 R=cv2.Rodrigues(v[:3])[0];C=-R.T@v[3:6];f=np.exp(v[6]);K=np.array([[f,0,W/2],[0,f,H/2],[0,0,1]])
 uv=cv2.projectPoints(obj,v[:3],v[3:6],K,None)[0].reshape(-1,2)
 return np.r_[(uv-pix).ravel(),min(0,C[1]-2000)*.01,min(0,C[2]-5000)*.01]
best=None
for f in [2000,4000,8000,11000]:
 for sx in [-1,1]:
  eye=np.array([sx*5000,10000,14000.])*f/4000
  opt=least_squares(residual,initial(eye,f),max_nfev=2000, bounds=(np.r_[np.full(6,-np.inf),np.log(W)], np.r_[np.full(6,np.inf),np.log(6*W)]))
  rms=np.linalg.norm(residual(opt.x))/np.sqrt(len(obj))
  R=cv2.Rodrigues(opt.x[:3])[0];C=-R.T@opt.x[3:6]
  if best is None or rms<best[0]:best=(rms,opt.x)
rms,v=best;R=cv2.Rodrigues(v[:3])[0];C=-R.T@v[3:6];f=np.exp(v[6]);pp=np.array([W/2,H/2]);K=np.array([[f,0,W/2],[0,f,H/2],[0,0,1]])
uv=cv2.projectPoints(obj,v[:3],v[3:6],K,None)[0].reshape(-1,2)
c={'name':'c134-cowl','size':[W,H],'R':R.tolist(),'centreMm':C.tolist(),'focalPx':f,'principalPx':pp.tolist(),'rmsPx':rms}
jobpath.with_suffix('.camera.json').write_text(json.dumps(c,indent=1))
lines=['# Exterior c134 calibration attempt: rejected for dimensions','',f'Camera {C.round(1).tolist()}, focal {f:.1f} px; RMS {rms:.2f} px.','',
'An unconstrained PnP solution placed the camera behind the truck because these references are almost coplanar. Rejected. This solve keeps the camera above and ahead of the truck. The physically constrained solution has a 34 px RMS residual, errors over 50 px at the roof, and focal length at its upper bound. Its queried points are diagnostic only; no body dimensions were taken from them.','', '| Reference | Error px |','|---|---|']
for name,a,b in zip(job['refs'],pix,uv):lines.append(f'| {name} | {np.linalg.norm(a-b):.1f} |')
lines+=['','| Query | Point mm | s back mm |','|---|---|---|']
for name,q in job['queries'].items():
 n=np.array(q['plane']['normal']);P=np.array(q['plane']['point']);d=R.T@np.r_[(np.array(q['px'])-pp)/f,1];X=C+d*((P-C)@n)/(d@n)
 lines.append(f'| {name} | {X.round(1).tolist()} | {2695.8-X[2]:.1f} |')
jobpath.with_suffix('.md').write_text('\n'.join(lines)+'\n')
im=Image.open(jobpath.parent/job['photo']);d=ImageDraw.Draw(im)
for a,b in zip(pix,uv):d.ellipse((a[0]-8,a[1]-8,a[0]+8,a[1]+8),outline='green',width=3);d.ellipse((b[0]-3,b[1]-3,b[0]+3,b[1]+3),fill='red')
for q in job['queries'].values():x,y=q['px'];d.ellipse((x-5,y-5,x+5,y+5),fill='blue')
im.save(jobpath.with_suffix('.png'))
