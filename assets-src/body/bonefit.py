# Each of Z-Anatomy's bones fitted onto the same bone of BodyParts3D: rotation, scale and shift, surface to surface
# (ICP with the worst tenth of the pairs left out, Umeyama's similarity at each step). Its pose differs a little from
# BodyParts3D's limb by limb, so the parts that hang on the bones (ligaments, nerves, nodes, fascia) are carried by
# them (zplace.py). Bones are paired by place, not name: after the whole-body fit, each Z-Anatomy bone with the
# BodyParts3D bone it overlaps most, of about its size.
# Reads raw/zdump.npz (zdump.py); writes out/bonefit.json. Plain Python 3 with numpy and scipy.
import json, os, re
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
d = np.load(os.path.join(HERE, 'raw', 'zdump.npz'))
tree = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']

zbones = []
for i in range(len(d.files) // 3):
    name, k, colls = d[f'm{i}']
    if k == 'bone':
        zbones.append((str(name), d[f'v{i}'].astype(np.float64) * 1000))       # mm

bp = []
for n in tree:
    if 'el' in n and n.get('src') != 'za' and n['system'] == 'skeleton' and n['tissue'] in ('bone', 'cartilage', 'tooth'):
        v = np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(OBJ, n['el'] + '.obj')) if l.startswith('v ')])
        bp.append((n['name'], n['el'], v))



def umeyama(src, dst):
    """Similarity (s, R, t) minimising |s R src + t - dst|."""
    mu_s, mu_d = src.mean(0), dst.mean(0)
    xs, xd = src - mu_s, dst - mu_d
    cov = xd.T @ xs / len(src)
    U, S, Vt = np.linalg.svd(cov)
    D = np.eye(3)
    if np.linalg.det(U @ Vt) < 0:
        D[2, 2] = -1
    R = U @ D @ Vt
    var = (xs ** 2).sum() / len(src)
    s = np.trace(np.diag(S) @ D) / var
    return s, R, mu_d - s * R @ mu_s


def icp(src, dst, s=1.0, R=np.eye(3), t=np.zeros(3), iters=40):
    kd = cKDTree(dst)
    for _ in range(iters):
        moved = s * src @ R.T + t
        dist, idx = kd.query(moved)
        keep = dist <= np.percentile(dist, 90)
        s2, R2, t2 = umeyama(src[keep], dst[idx[keep]])
        if abs(s2 - s) < 1e-6 and np.abs(t2 - t).max() < 1e-4 and np.abs(R2 - R).max() < 1e-6:
            s, R, t = s2, R2, t2
            break
        s, R, t = s2, R2, t2
    dist, _ = kd.query(s * src @ R.T + t)
    return s, R, t, float(np.sqrt(np.mean(np.minimum(dist, np.percentile(dist, 90)) ** 2))), float(np.median(dist))


np.seterr(all='ignore')       # numpy's Accelerate matmul warns spuriously on macOS


def norm(name):
    """'Third metacarpal bone.l' and 'Left third metacarpal bone' -> 'left third metacarpal'."""
    n = name.lower()
    side = ''
    m = re.match(r'^(.*)\.([lr])$', n)
    if m:
        n, side = m.group(1), {'l': 'left', 'r': 'right'}[m.group(2)]
    n = re.sub(r'\(.*?\)', ' ', n)
    words = [w for w in re.findall(r'[a-z]+', n) if w not in ('bone', 'of', 'the', 'left', 'right')]
    if not side:
        side = 'left' if re.search(r'\bleft\b', name.lower()) else 'right' if re.search(r'\bright\b', name.lower()) else ''
    return ' '.join(([side] if side else []) + sorted(words))


bp_by_name = {}
for j, b in enumerate(bp):
    bp_by_name.setdefault(norm(b[0]), []).append(j)
bp_c = np.array([b[2].mean(0) for b in bp])
bp_size = np.array([np.ptp(b[2], axis=0).max() for b in bp])
kd_c = cKDTree(bp_c)
rng = np.random.default_rng(0)
REG = json.load(open(os.path.join(HERE, 'out', 'z-regions.json')))


def coarse(zc):
    """A first guess from the regional bone-box fits (regfit.py): the head's above the neck, the chest's below."""
    f = REG['head'] if zc[2] > 1450 + 100 else REG['thorax']
    return 1 / f['scale'], np.eye(3), -np.array(f['t']) * 1000 / f['scale']


fits = {}


def try_fit(zn, zv, candidates, s0=None, R0=None, t0=None):
    """With no start given, each candidate starts with the two bones' centres together."""
    src = zv[rng.choice(len(zv), min(len(zv), 2500), replace=False)]
    best = None
    for j in candidates:
        if s0 is None:
            s, R, t, rms, med = icp(src, bp[j][2], 1.0, np.eye(3), bp_c[j] - zv.mean(0))
        else:
            s, R, t, rms, med = icp(src, bp[j][2], s0, R0, t0)
        if best is None or rms < best[3]:
            best = (s, R, t, rms, med, j)
    if best is None:
        return False
    s, R, t, rms, med, j = best
    # Z-Anatomy remodelled some bones (its femur is 15 mm deeper, its tibia 22 mm shorter): up to 4.5 mm is kept.
    if not np.isfinite(rms) or rms > 4.5 or abs(s - 1) > 0.15:
        return False
    fits[zn] = {'bp': bp[j][0], 'el': bp[j][1], 's': s, 'R': R.tolist(), 't': t.tolist(), 'rms_mm': rms, 'median_mm': med,
                'centre': zv.mean(0).tolist()}
    return True


# Pass 1: bones whose names agree.
for zn, zv in zbones:
    js = bp_by_name.get(norm(zn))
    if js:
        try_fit(zn, zv, js)
# Pass 2: the rest, started from the nearest fitted bone's transform, paired with what lies under them then.
for _ in range(3):
    for zn, zv in zbones:
        if zn in fits or not fits:
            continue
        zc = zv.mean(0)
        near = min(fits.values(), key=lambda f: np.linalg.norm(np.array(f['centre']) - zc))
        s0, R0, t0 = near['s'], np.array(near['R']), np.array(near['t'])
        guess = s0 * R0 @ zc + t0
        zsize = np.ptp(zv, axis=0).max()
        cands = [j for j in kd_c.query_ball_point(guess, r=max(25.0, 0.6 * zsize)) if 0.6 < bp_size[j] / zsize < 1.6]
        try_fit(zn, zv, cands, s0, R0, t0)

rms = [f['rms_mm'] for f in fits.values()]
print(f'[bonefit] {len(fits)} of {len(zbones)} bones fitted; rms median {np.median(rms):.2f} mm, 90% {np.percentile(rms, 90):.2f} mm, max {max(rms):.2f} mm')
json.dump(fits, open(os.path.join(HERE, 'out', 'bonefit.json'), 'w'))
