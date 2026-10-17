# Joining the vessels where BodyParts3D leaves them apart (vessels.py finds the gaps).
#
# 1. Missing stretches: the internal carotid and vertebral arteries through the skull base (without them the brain's
#    151 arteries are cut off from the heart) and the internal pudendal arteries. Their paths come from Z-Anatomy
#    (zpaths.py), carried onto our skeleton by the bones (bonefit.py, as zplace.py does). Where a path runs more than
#    GAP mm from any artery of ours, a tube is laid along it, as thick as the vessel at either end, and joined into
#    the vessel there; a stretch that doesn't meet an artery at both ends is reported, not added.
# 2. Short breaks: a vessel stopping a few millimetres short of the one it comes from (the left common carotid at the
#    aortic arch). Only the pairs below, each the vessel's real parent, are joined, by a short tube from the vessel's
#    open end to the parent's wall.
# Writes raw/zextra/ZV0001.obj... (Kind: vessel) and out/vjoin.json. Plain Python 3 with numpy and scipy.
import json, os, re
import numpy as np
from scipy.spatial import cKDTree

np.seterr(all='ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
OUT = os.path.join(HERE, 'raw', 'zextra')
tree = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
fits = json.load(open(os.path.join(HERE, 'out', 'bonefit.json')))
paths = json.load(open(os.path.join(HERE, 'raw', 'zpaths.json')))
d = np.load(os.path.join(HERE, 'raw', 'zdump.npz'))
GAP = 5.0          # mm: a path point this far from every artery wall is where the vessel is missing
SEG = 14           # sides of a tube


def verts(el):
    return np.array([[float(x) for x in l.split()[1:4]] for l in open(os.path.join(OBJ, el + '.obj')) if l.startswith('v ')])


# ---- the bones' fits, to carry Z-Anatomy's paths (as zplace.py)
bones = []
for i in range(len(d.files) // 3):
    name, kind, _ = (str(x) for x in d[f'm{i}'])
    if kind == 'bone' and name in fits:
        bones.append((name, d[f'v{i}'].astype(np.float64)[::2] * 1000))
names = [n for n, _ in bones]
M = np.stack([np.hstack([fits[n]['s'] * np.array(fits[n]['R']), np.array(fits[n]['t'])[:, None]]) for n in names])
kd_b = cKDTree(np.concatenate([v for _, v in bones]))
lab = np.concatenate([np.full(len(v), i) for i, (_, v) in enumerate(bones)])


def carry(v):
    dist, idx = kd_b.query(v, k=48)
    L = lab[idx]
    n = len(v)
    picks, dists, taken = [], [], np.full((n, 0), -1)
    for _ in range(3):
        free = ~np.any(L[:, :, None] == taken[:, None, :], axis=2) if taken.shape[1] else np.ones_like(L, dtype=bool)
        first = np.argmax(free, axis=1)
        ok = free[np.arange(n), first]
        b = np.where(ok, L[np.arange(n), first], -1)
        picks.append(b)
        dists.append(np.where(ok, dist[np.arange(n), first], np.inf))
        taken = np.hstack([taken, b[:, None]])
    B, Dd = np.stack(picks, 1), np.stack(dists, 1)
    W = np.where((B >= 0) & (Dd <= Dd[:, :1] + 40), 1 / (Dd + 5) ** 2, 0)
    W /= W.sum(1, keepdims=True)
    h = np.hstack([v, np.ones((n, 1))])
    return sum(W[:, j:j + 1] * np.einsum('nij,nj->ni', M[np.where(B[:, j] >= 0, B[:, j], 0)], h) for j in range(3))


# ---- our arteries (and veins), as surfaces
def cloud(tissues):
    parts = [n for n in tree if 'el' in n and n.get('src') != 'za' and n['tissue'] in tissues]
    vs = [verts(n['el']) for n in parts]
    return parts, vs, cKDTree(np.concatenate(vs)), np.concatenate([np.full(len(v), i) for i, v in enumerate(vs)])


art_parts, art_v, art_kd, art_own = cloud({'artery'})


def radius_at(p, kd, allv, around=7.0):
    """The vessel's radius near point p (on or in it): a full ring of its wall there, measured from the ring's centre.
    The vessel's direction is the long axis of its wall within 12 mm; the ring is the wall within 1.5 mm of the plane
    across it through p."""
    idx = kd.query_ball_point(p, 12.0)
    if len(idx) < 12:
        return None
    w = allv[idx]
    axis = np.linalg.svd(w - w.mean(0), full_matrices=False)[2][0]
    ring = w[np.abs((w - p) @ axis) < 1.5]
    if len(ring) < 6:
        return None
    c = ring.mean(0)
    return float(np.median(np.linalg.norm((ring - c) - np.outer((ring - c) @ axis, axis), axis=1)))


def tube(points, radii):
    """A tube along `points` (mm) with radius `radii` at each, as (vertices, triangles), its ends open."""
    P = np.asarray(points)
    n = len(P)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
    N0 = np.cross(T[0], ref)
    N0 /= np.linalg.norm(N0)
    frames = [N0]
    for i in range(1, n):          # parallel transport, so the tube doesn't twist
        v = frames[-1] - T[i] * (frames[-1] @ T[i])
        frames.append(v / np.linalg.norm(v))
    V = []
    for i in range(n):
        Nn = frames[i]
        Bn = np.cross(T[i], Nn)
        for k in range(SEG):
            a = 2 * np.pi * k / SEG
            V.append(P[i] + radii[i] * (np.cos(a) * Nn + np.sin(a) * Bn))
    F = []
    for i in range(n - 1):
        for k in range(SEG):
            a, b = i * SEG + k, i * SEG + (k + 1) % SEG
            c, e = (i + 1) * SEG + k, (i + 1) * SEG + (k + 1) % SEG
            F += [[a, c, b], [b, c, e]]
    return np.array(V), np.array(F)


def write(el, name, kind_name, V, F, note):
    lo, hi = V.min(0), V.max(0)
    with open(os.path.join(OUT, el + '.obj'), 'w') as out:
        out.write('#\n# Joining a vessel BodyParts3D leaves in pieces (vjoin.py): ' + note + '\n')
        out.write(f'# Kind : vessel\n# Group : \n# File ID : {el}\n# English name : {name}\n')
        out.write('# Bounds(mm): ({:.4f},{:.4f},{:.4f})-({:.4f},{:.4f},{:.4f})\n#\n'.format(*lo, *hi))
        out.write(''.join(f'v {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n' for p in V))
        out.write(''.join(f'f {t[0] + 1} {t[1] + 1} {t[2] + 1}\n' for t in F))


for f in os.listdir(OUT):
    if f.startswith('ZV'):
        os.remove(os.path.join(OUT, f))
report = {'stretches': [], 'bridges': [], 'refused': []}
k = 0
allart = np.concatenate(art_v)

# ---- 1. missing stretches: from one of our vessels' end to another's, along Z-Anatomy's path between them, bent so
# it lands exactly on both ends (its curve kept: the carotid's through the skull base, the vertebral's over the atlas)
ALONG = [
    # (from, to, Z-Anatomy path, name of the new stretch)
    # BodyParts3D's common carotids stop about 45 mm below the fork, where Z-Anatomy's internal carotid begins: the new
    # stretch is the top of the common carotid and the neck part of the internal carotid, and may bend further.
    ('Left common carotid artery, main part', 'Left internal carotid artery, main part', 'Internal carotid artery.l', 'Left carotid artery, neck part', 55),
    ('Right common carotid artery', 'Right internal carotid artery', 'Internal carotid artery.r', 'Right carotid artery, neck part', 55),
    ('Left subclavian artery', 'Left vertebral artery', 'Vertebral artery.l', 'Left vertebral artery, cervical part'),
    ('Right subclavian artery', 'Right vertebral artery, main part', 'Vertebral artery.r', 'Right vertebral artery, cervical part'),
    ('Left internal iliac artery', 'Left dorsal artery of penis, 1 of 2', 'Internal pudendal artery.l', 'Left internal pudendal artery'),
    ('Right internal iliac artery', 'Right dorsal artery of penis, 1 of 2', 'Internal pudendal artery.r', 'Right internal pudendal artery'),
]
byname = {n['name']: n for n in tree if 'el' in n}
for frm, to, zname, name, *limit in ALONG:
    limit = limit[0] if limit else 25
    if frm not in byname or to not in byname or zname not in paths:
        report['refused'].append({'stretch': name, 'why': 'a part or the path is missing'})
        continue
    A, B = verts(byname[frm]['el']), verts(byname[to]['el'])
    P = carry(np.array(paths[zname]) * 1000)
    kA, kB = cKDTree(A), cKDTree(B)
    # the ends: where each vessel comes nearest the path's two ends (the parent's at the path's start: a branch leaves it
    # there; the child's own end nearest the path's other end)
    dA, iA = kA.query(P)
    dB, iB = kB.query(P)
    i0 = int(np.argmin(dA[: len(P) // 2 + 1]))                    # the path's start, at the parent
    i1 = len(P) // 2 + int(np.argmin(dB[len(P) // 2:]))           # its end, at the child
    if i1 - i0 < 3:
        report['refused'].append({'stretch': name, 'why': 'the path does not run between them'})
        continue
    endA, endB = A[iA[i0]], B[iB[i1]]
    # each end's centre: the vessel's wall around the end point, averaged
    cA = A[kA.query_ball_point(endA, 4.0)].mean(0)
    cB = B[kB.query_ball_point(endB, 4.0)].mean(0)
    seg = P[i0:i1 + 1]
    t = np.linspace(0, 1, len(seg))[:, None]
    seg = seg + (1 - t) * (cA - seg[0]) + t * (cB - seg[-1])       # bent onto both ends
    if dA[i0] > limit or dB[i1] > limit:
        report['refused'].append({'stretch': name, 'why': f'the path passes {dA[i0]:.0f} / {dB[i1]:.0f} mm from the ends'})
        continue
    rB = radius_at(cB, kB, B, 5.0) or 1.5
    # A continuation (the common carotid going on as the internal carotid) narrows from the parent's width; a branch
    # (the vertebral leaving the subclavian) is its own width all along, not the big vessel's it leaves.
    rA = (radius_at(cA, kA, A, 5.0) or rB) if 'carotid' in name else rB
    length = float(np.linalg.norm(np.diff(seg, axis=0), axis=1).sum())
    V, F = tube(seg, (rA + (rB - rA) * t[:, 0]))
    k += 1
    el = f'ZV{k:04d}'
    write(el, name, 'artery', V, F, f'{frm} to {to} along Z-Anatomy\'s {zname}, {length:.0f} mm, radius {rA:.1f} to {rB:.1f} mm '
          f'(the path passed {dA[i0]:.0f} and {dB[i1]:.0f} mm from the ends)')
    report['stretches'].append({'el': el, 'name': name, 'length_mm': round(length, 1), 'r': [round(rA, 1), round(rB, 1)],
                                'path_off_mm': [round(float(dA[i0]), 1), round(float(dB[i1]), 1)]})

# ---- 2. short breaks, each joined to its real parent
BRIDGES = [
    ('Right suprarenal vein', 'Inferior vena cava, 2 of 2', 'vein'),
    ('Left common carotid artery, main part', 'Arch of aorta', 'artery'),
    ('Left inferior epigastric artery', 'Left external iliac artery, main part', 'artery'),
    ('Right inferior epigastric artery', 'Right external iliac artery, main part', 'artery'),
    ('Posterior segmental branch of left renal artery, 1 of 2', 'Posterior division of left renal artery, 3 of 3', 'artery'),
]
for cut, parent, tissue in BRIDGES:
    if cut not in byname or parent not in byname:
        report['refused'].append({'pair': [cut, parent], 'why': 'no such part'})
        continue
    cv, pv = verts(byname[cut]['el']), verts(byname[parent]['el'])
    pk = cKDTree(pv)
    dd, ii = pk.query(cv)
    j = int(np.argmin(dd))
    gap = float(dd[j])
    if gap > 8:
        report['refused'].append({'pair': [cut, parent], 'gap_mm': round(gap, 1), 'why': 'too far apart to be a break'})
        continue
    # the open end of the cut vessel: its wall near the closest point, and its centre
    ck = cKDTree(cv)
    near = cv[ck.query_ball_point(cv[j], 6.0)]
    c = near.mean(0)
    r = radius_at(c, ck, cv, 6.0) or 1.0
    target = pv[ii[j]]
    axis = target - c
    L = np.linalg.norm(axis)
    seg = np.array([c - axis / L * 1.0, c + axis * 0.5, target + axis / L * min(r, 2.0)])    # into both walls
    V, F = tube(seg, np.full(3, r))
    k += 1
    el = f'ZV{k:04d}'
    write(el, f'{cut.split(",")[0]}, its join', tissue, V, F, f'{cut} to {parent}, {gap:.1f} mm, radius {r:.1f} mm')
    report['bridges'].append({'el': el, 'cut': cut, 'parent': parent, 'gap_mm': round(gap, 1), 'r': round(r, 1)})

print(f"[vjoin] {len(report['stretches'])} stretches, {len(report['bridges'])} joins, {len(report['refused'])} refused")
for s in report['stretches']:
    print('   stretch', s)
for b in report['bridges']:
    print('   join   ', b)
for r in report['refused']:
    print('   refused', r)
json.dump(report, open(os.path.join(HERE, 'out', 'vjoin.json'), 'w'), indent=1)
