# Where Z-Anatomy's parts go in our body (BodyParts3D's frame). Z-Anatomy's skeleton is BodyParts3D's, moved and
# lightly reposed, so each region is fitted on its own: a similarity (scale + shift) from the bones the two share
# there, by their bounding boxes. Reads out/z-all.json (every Z-Anatomy mesh's bounds, from zinventory) and the
# BodyParts3D OBJs; writes out/z-regions.json.
import json, os, re
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
z = json.load(open(os.path.join(HERE, 'out', 'z-all.json')))

bp = {}
for f in os.listdir(OBJ):
    vs, name = [], None
    for l in open(os.path.join(OBJ, f), errors='ignore'):
        if l.startswith('# English name'):
            name = l.split(':', 1)[1].strip().lower()
        elif l.startswith('v '):
            vs.append(l.split()[1:4])
    if name and vs:
        a = np.array(vs, dtype=float) / 1000
        bp.setdefault(name, []).append((a.min(0), a.max(0)))


def zname(k):
    if '.' in k:
        base, suf = k.rsplit('.', 1)
        side = {'l': 'left ', 'r': 'right '}.get(suf)
        if side:
            return side + base.lower()
    return k.lower()


REGIONS = {
    # the bones each region is fitted on (Z-Anatomy names, regex)
    'head': r'^(frontal bone|occipital bone|parietal bone|temporal bone|sphenoid bone|ethmoid|mandible|maxilla|zygomatic bone|nasal bone|vomer|palatine bone|lacrimal bone|hyoid bone|atlas|axis)',
    'thorax': r'^(sternum|manubrium|.*rib\b|first rib|second rib|.* thoracic vertebra|clavicle|scapula)',
}


def fit(rx):
    pairs = []
    for k, v in z.items():
        if not re.search(rx, k.lower().rsplit('.', 1)[0] if k[-2:] in ('.l', '.r') else k.lower()):
            continue
        n = zname(k)
        c = bp.get(n) or bp.get(re.sub(r'^(left|right) ', '', n))
        if not c or len(c) != 1:
            continue
        lo, hi = c[0]
        zlo, zhi = np.array(v['lo']), np.array(v['hi'])
        if np.any(np.abs((zhi - zlo) / np.maximum(hi - lo, 1e-6) - 1) > 0.15):
            continue
        pairs.append((k, zlo, zhi, lo, hi))
    A, B = [], []
    for _, zlo, zhi, lo, hi in pairs:
        for zb, bb in ((zlo, lo), (zhi, hi)):
            for i in range(3):
                row = [bb[i], 0, 0, 0]
                row[1 + i] = 1
                A.append(row)
                B.append(zb[i])
    A, B = np.array(A), np.array(B)
    sol = np.linalg.lstsq(A, B, rcond=None)[0]
    r = A @ sol - B
    return {'scale': float(sol[0]), 't': sol[1:].tolist(), 'bones': [p[0] for p in pairs],
            'rms_mm': float(np.sqrt((r ** 2).mean()) * 1000), 'max_mm': float(np.abs(r).max() * 1000)}


out = {name: fit(rx) for name, rx in REGIONS.items()}
for name, f in out.items():
    print(f"{name}: {len(f['bones'])} bones, scale {f['scale']:.4f}, shift {np.round(f['t'], 4)} m, rms {f['rms_mm']:.1f} mm, max {f['max_mm']:.1f} mm")
json.dump(out, open(os.path.join(HERE, 'out', 'z-regions.json'), 'w'), indent=1)
