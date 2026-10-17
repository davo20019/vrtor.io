# Z-Anatomy's ligaments and joint capsules, lymph nodes, peripheral nerves, fascia, bursae and tendon sheaths,
# placed in our body by the bones they hang on. Each vertex moves with its nearest fitted bones (bonefit.py), blended
# by distance, as skinning moves a mesh: a ligament with the two bones it joins, the sciatic nerve along the femur.
# A part that lands on a surface BodyParts3D already has (its cranial nerves, discs, the flexor retinaculum...) is
# left out. Writes raw/zextra/ZB0001.obj... with the part's kind and Z-Anatomy group in the header, and
# out/zplace.json. Plain Python 3 with numpy and scipy; run after bonefit.py.
import json, os, re
import numpy as np
from scipy.spatial import cKDTree

np.seterr(all='ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
OUT = os.path.join(HERE, 'raw', 'zextra')
d = np.load(os.path.join(HERE, 'raw', 'zdump.npz'))
fits = json.load(open(os.path.join(HERE, 'out', 'bonefit.json')))
tree = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']

# Left out: anything of the inner ear (Z-Anatomy adapted it from a NonCommercial model), and labels.
# Its ossicles are left out too: the Dundee inner-ear model (CC BY-NC-SA 4.0) has the malleus, incus and stapes.
NC = re.compile(r'cochle|vestibul|semicircular|utricle|saccule|spiral ganglion|endolymph|perilymph', re.I)
# Z-Anatomy's collections that only say where a part is, not what it belongs to.
PLACE = re.compile(r'^(\d+:|Trunk|Head|Neck|Thorax|Abdomen|Back|Pelvis|Left |Right |Lymphoid system|Bursae|Fascia$|Tendon sheaths|'
                   r'Muscles|Superficial muscles|Peripheral nervous system|Nervous system|Joints$|Bonus collection|Lymphoid organs)')

objs = []
for i in range(len(d.files) // 3):
    name, kind, colls = (str(x) for x in d[f'm{i}'])
    objs.append((name, kind, colls.split('|'), d[f'v{i}'].astype(np.float64) * 1000, d[f'f{i}']))

# Every fitted bone's vertices (Z-Anatomy's frame) labelled with the bone, for "which bones is this point near".
bones = [(n, v) for n, k, c, v, f in objs if k == 'bone' and n in fits]
T = {n: (fits[n]['s'], np.array(fits[n]['R']), np.array(fits[n]['t'])) for n, _ in bones}
pts = np.concatenate([v[::2] for _, v in bones])
lab = np.concatenate([np.full(len(v[::2]), i) for i, (_, v) in enumerate(bones)])
kd = cKDTree(pts)
names = [n for n, _ in bones]


# Each bone's fit as one 3x4 matrix (s R | t), stacked: carrying a point by bone b is M[b] @ [p, 1].
M = np.stack([np.hstack([T[n][0] * T[n][1], T[n][2][:, None]]) for n in names])


def carry(v):
    """Each vertex moved by its nearest bones' fits (up to three, within 40 mm of the nearest), weighted 1/(d+5 mm)^2."""
    dist, idx = kd.query(v, k=48)
    L = lab[idx]                                         # (n, 48) bone of each neighbour, nearest first
    n = len(v)
    picks, dists = [], []
    taken = np.full((n, 0), -1)
    for _ in range(3):
        free = ~np.any(L[:, :, None] == taken[:, None, :], axis=2) if taken.shape[1] else np.ones_like(L, dtype=bool)
        first = np.argmax(free, axis=1)
        ok = free[np.arange(n), first]
        b = np.where(ok, L[np.arange(n), first], -1)
        dd = np.where(ok, dist[np.arange(n), first], np.inf)
        picks.append(b)
        dists.append(dd)
        taken = np.hstack([taken, b[:, None]])
    B, Dd = np.stack(picks, 1), np.stack(dists, 1)
    use = (B >= 0) & (Dd <= Dd[:, :1] + 40)
    W = np.where(use, 1 / (Dd + 5) ** 2, 0)
    W /= W.sum(1, keepdims=True)
    h = np.hstack([v, np.ones((n, 1))])
    out = np.zeros_like(v)
    for j in range(3):
        bj = np.where(B[:, j] >= 0, B[:, j], 0)
        moved = np.einsum('nij,nj->ni', M[bj], h)
        out += W[:, j:j + 1] * moved
    return out


# What BodyParts3D has of the same kinds, to leave out what it already shows.
SAME_KIND = {'bone': {'skeleton'}, 'joint': {'skeleton', 'muscles', 'lungs'}, 'nerve': {'nerves', 'senses'}, 'lymph': {'gut', 'glands'},
             'fascia': {'muscles', 'skeleton'}, 'muscle': {'muscles', 'gut', 'lungs', 'senses'}}
ours = []
for n in tree:
    if 'el' in n and n.get('src') != 'za':
        v = np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(OBJ, n['el'] + '.obj')) if l.startswith('v ')])
        ours.append((n['name'], n['system'], v, v.min(0), v.max(0), cKDTree(v)))


def plain(n):
    """'Left trochlear nerve (IV)' and 'Left trochlear nerve' are one name."""
    return re.sub(r'\s*\([ivxl]+\)', '', re.sub(r', \d+ of \d+$|, main part$', '', n.lower())).strip()


# The same part by name and side as one of ours (the ophthalmic and trochlear nerves are in both): left out too.
ours_by_name = {plain(n['name']): n['name'] for n in tree if 'el' in n and n.get('src') != 'za'}


# Every muscle we have (BodyParts3D's and the face's from zexport.py), as one cloud: a Z-Anatomy muscle mostly lying
# on it is one we have, however the two atlases split it (one deltoid or three parts of one).
_mv = [o[2] for o in ours if o[1] in ('muscles',)]
for f in os.listdir(OUT):
    if f.startswith('ZA'):
        _mv.append(np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(OUT, f)) if l.startswith('v ')]))
muscle_cloud = cKDTree(np.concatenate(_mv))


# Our muscles' names as sets of word stems, by side, for "the same muscle named otherwise".
MUSCLE_WORDS = re.compile(r'[a-z]+')
SKIPW = {'of', 'the', 'muscle', 'muscles', 'abdominal', 'left', 'right', 'part', 'parts', 'set', 'and', 'proper'}
def stems(name):
    return frozenset(w[:5] for w in MUSCLE_WORDS.findall(name.lower()) if w not in SKIPW)
def side(name):
    n = name.lower()
    return 'left' if re.search(r'\bleft\b', n) else 'right' if re.search(r'\bright\b', n) else ''
# (Not the ones this script placed last time, which tree.json now holds: they'd each be left out as their own twin.)
our_muscles = [(stems(n['name']), side(n['name'])) for n in tree
               if n.get('system') in ('muscles', 'lungs', 'gut') and not str(n.get('el', '')).startswith('ZB')]
for f in os.listdir(OUT):
    if f.startswith('ZA'):
        nm = next((l.split(':', 1)[1].strip() for l in open(os.path.join(OUT, f)) if l.startswith('# English name')), '')
        our_muscles.append((stems(nm), side(nm)))


def named_like_ours(name):
    """The same muscle by name: the same words ("external abdominal oblique" and "external oblique"), or one name a
    part of the other's ("External part of left thyro-arytenoid" in "Left thyro-arytenoid"), on the same side."""
    s, sd = stems(name), side(name)
    if len(s) < 1:
        return False
    for o, osd in our_muscles:
        if (osd and osd != sd) or not o:            # a name with no side covers both
            continue
        if s == o or (len(o) >= 2 and o <= s) or (len(s) >= 2 and s <= o):
            return True
    return False


def already(kind, v, name=''):
    if kind == 'muscle' and named_like_ours(name):
        return 'a muscle we have, by name'
    if kind == 'muscle':
        d = muscle_cloud.query(v[:: max(1, len(v) // 600)])[0]
        return 'a muscle we have' if np.median(d) < 3.0 else None
    lo, hi = v.min(0), v.max(0)
    kv = cKDTree(v)
    for name, system, w, wlo, whi, kw in ours:
        if system not in SAME_KIND[kind] or np.any(np.minimum(hi, whi) - np.maximum(lo, wlo) < -2):
            continue
        a = kw.query(v[:: max(1, len(v) // 400)])[0]
        b = kv.query(w[:: max(1, len(w) // 400)])[0]
        if np.median(a) < 2.5 and np.median(b) < 2.5:
            return name
    return None


def our_name(z):
    if re.search(r'\.[lr]$', z):
        base, side = z[:-2], {'l': 'left', 'r': 'right'}[z[-1]]
        base = re.sub(r'^\((.*)\)$', r'\1', base.strip())
        base = re.sub(r' muscle$', '', base)
        p = re.match(r'^(.*? (?:part|head|branch|branches|layer|portion) of )(.+)$', base, re.I)
        if p:
            return f'{p.group(1)[0].upper()}{p.group(1)[1:]}{side} {p.group(2)}'
        return f'{side.capitalize()} {base[0].lower()}{base[1:]}'
    return re.sub(r'^\((.*)\)$', r'\1', z.strip())


# The bones BodyParts3D lacks, carried like the rest by the bones around them (the coccyx by the sacrum).
EXTRA_BONES = {'Coccyx'}

# Z-Anatomy's own side mix-ups (audit.py: each lies on the other side), by its object names.
SWAP_SIDE = {'Lateral temporomandibular ligament.l': 'Lateral temporomandibular ligament.r',
             'Lateral temporomandibular ligament.r': 'Lateral temporomandibular ligament.l'}

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.startswith('ZB'):
        os.remove(os.path.join(OUT, f))
report = {'placed': [], 'already': [], 'skipped': []}
i = 0
for name, kind, colls, v, f in objs:
    if kind == 'bone' and name not in EXTRA_BONES:
        continue
    if NC.search(name) or len(f) == 0:
        report['skipped'].append(name)
        continue
    name = SWAP_SIDE.get(name, name)
    w = carry(v)
    same = ours_by_name.get(plain(our_name(name))) or already(kind, w, our_name(name))
    if same:
        report['already'].append((name, same))
        continue
    i += 1
    el = f'ZB{i:04d}'
    group = next((c for c in reversed(colls) if not PLACE.search(c)), '')
    lo, hi = w.min(0), w.max(0)
    with open(os.path.join(OUT, el + '.obj'), 'w') as out:
        out.write('#\n# Z-Anatomy, the libre 3D atlas of anatomy, CC BY-SA 4.0 (https://github.com/Z-Anatomy/Models-of-human-anatomy)\n')
        out.write(f'# Z-Anatomy object : {name}\n# Kind : {kind}\n# Group : {group}\n# Placed by : its nearest bones (zplace.py)\n')
        out.write(f'# File ID : {el}\n# English name : {our_name(name)}\n')
        out.write('# Bounds(mm): ({:.4f},{:.4f},{:.4f})-({:.4f},{:.4f},{:.4f})\n#\n'.format(*lo, *hi))
        out.write(''.join(f'v {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n' for p in w))
        out.write(''.join(f'f {t[0] + 1} {t[1] + 1} {t[2] + 1}\n' for t in f))
    report['placed'].append((el, our_name(name), kind, group, int(len(f))))
by = {}
for el, n, k, g, t in report['placed']:
    by.setdefault(k, [0, 0])
    by[k][0] += 1
    by[k][1] += t
print('[zplace] placed', {k: f'{n} parts, {t} tris' for k, (n, t) in by.items()}, '| already ours', len(report['already']), '| left out', len(report['skipped']))
json.dump(report, open(os.path.join(HERE, 'out', 'zplace.json'), 'w'), indent=1)
