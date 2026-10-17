# Checks every part of the body for mistakes our pipeline could make or the data could carry:
#   side       a part named Left that lies on the body's right (BodyParts3D: the right side is -x), or the reverse
#   twin       two parts with the same shape in the same place (they flicker against each other)
#   cut        a part simplified so far it may have lost its shape (build.json: triangles kept)
#   pair       a Left part and its Right twin that aren't mirror images (size or height differ a lot)
# Writes out/audit.json and prints a summary.
import json, os, re, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
B = json.load(open(os.path.join(HERE, 'out', 'build.json')))['parts']
DIRS = {'bp': os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99'), 'za': os.path.join(HERE, 'raw', 'zextra')}


def bounds(n):
    h = open(os.path.join(DIRS[n.get('src', 'bp')], n['el'] + '.obj'), errors='ignore').read(1500)
    v = [float(x) for x in re.findall(r'-?\d+\.?\d*', re.search(r'Bounds\(mm\): (.*)', h).group(1))]
    return np.array(v[:3]), np.array(v[3:])


leaves = [n for n in N if 'el' in n]
box = {n['el']: bounds(n) for n in leaves}
issues = collections.defaultdict(list)
MID = 8.0           # mm either side of the midline counts as the middle

for n in leaves:
    lo, hi = box[n['el']]
    cx = (lo[0] + hi[0]) / 2
    name = n['name'].lower()
    side = 'left' if re.search(r'\bleft\b', name) else 'right' if re.search(r'\bright\b', name) else None
    # "Left X" parts lie at +x, "Right X" at -x. Some cross the midline by nature (the left gastric artery, a left
    # coronary branch): only parts entirely on the other side are flagged.
    if side == 'left' and hi[0] < -MID or side == 'right' and lo[0] > MID:
        issues['side'].append((n['name'], n['el'], round(cx, 1)))

# twins: same size and place within 0.5 mm
key = collections.defaultdict(list)
for n in leaves:
    lo, hi = box[n['el']]
    key[tuple(np.round(np.concatenate([lo, hi]) / 1.0).astype(int))].append(n)
for k, ns in key.items():
    if len(ns) > 1:
        issues['twin'].append([(n['name'], n['el']) for n in ns])

# cut: kept under 15% of the triangles and fewer than 300
for n in leaves:
    b = B.get(n['el'])
    if b and b['from'] > 0 and b['tris'] / b['from'] < 0.15 and b['tris'] < 300:
        issues['cut'].append((n['name'], n['el'], b['from'], b['tris']))

# pairs: Left X vs Right X, mirrored sizes
byname = {n['name']: n for n in leaves}
for n in leaves:
    m = re.match(r'^(.*)\bLeft\b(.*)$', n['name'])
    if not m:
        continue
    other = byname.get(f"{m.group(1)}Right{m.group(2)}")
    if not other:
        continue
    (l1, h1), (l2, h2) = box[n['el']], box[other['el']]
    s1, s2 = h1 - l1, h2 - l2
    dz = abs((l1[2] + h1[2]) / 2 - (l2[2] + h2[2]) / 2)
    if np.any(np.abs(s1 - s2) > np.maximum(0.25 * np.maximum(s1, s2), 5)) or dz > 25:
        issues['pair'].append((n['name'], other['name'], np.round(s1).tolist(), np.round(s2).tolist(), round(dz)))

for k in ('side', 'twin', 'cut', 'pair'):
    print(f'{k}: {len(issues[k])}')
    for x in issues[k][:40]:
        print('   ', x)
json.dump(issues, open(os.path.join(HERE, 'out', 'audit.json'), 'w'), indent=1, default=str)
