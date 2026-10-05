"""Audit the nominal pane against the real-vehicle report, without using a fitted image scale.
Run: assets-src/cybertruck/.venv/bin/python assets-src/cybertruck/measure/windshield/documented.py
NHTSA O20244500, TR-P44392-01-NC, printed pages 10 and 25. See refs/nhtsa/SOURCES.md.
"""
from pathlib import Path
import sys,json,math,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import cad
p=cad.P;pts=cad.windshield_outline(p);bl,tl,tr,br=pts[:4]
axis=np.array([0,math.sin(math.radians(19.9)),-math.cos(math.radians(19.9))])
run=tl-bl
actual=dict(angle_deg=math.degrees(math.atan2(run[1],-run[2])),
            top_width=float(np.linalg.norm(tl-tr)),bottom_width=float(np.linalg.norm(bl-br)),
            slant_height=float(run@axis))
old=cad.PILLAR_REFERENCE;roof=cad.planes(old)['roof'];win=cad.planes(old)['window_l']
s0,s1=old['cowl_s']+30,old['apex_s']-40
q0=cad.edge_point(roof,win,cad.ZF-s0);q1=cad.edge_point(roof,win,cad.ZF-s1)
previous=dict(angle_deg=math.degrees(math.atan2(q1[1]-q0[1],s1-s0)),
              top_width=2*(q1[0]-old['win_margin']),bottom_width=2*(q0[0]-old['win_margin']),
              slant_height=math.hypot(s1-s0,q1[1]-q0[1]))
report={'source':'NHTSA O20244500, TR-P44392-01-NC, data sheets 3 and 15',
        'documented':cad.WS_MEASURED,'previous_nominal':{k:round(v,2) for k,v in previous.items()},
        'updated_nominal':{k:round(v,2) for k,v in actual.items()},
        'corner_station_mm':round(cad.ZF-bl[2],2),
        'body_change':'piecewise hood and windshield facets; fitted shoulder retained',
        'estimated':['absolute top placement','lower bow','frit widths and cutoff','glass thickness and tint',
                     'support cross-section and return depth','14 mm support rounding'],
        'trim_camera_tolerance_mm':18}
for k,v in actual.items():
 if abs(v-cad.WS_MEASURED[k])>1e-6:raise ValueError(f'{k}: {v} does not match document')
(Path(__file__).parent/'documented.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
