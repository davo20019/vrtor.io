# BodyParts3D's "Sacrum" is the sacrum and the coccyx as one mesh (its lowest 30 mm, 605 vertices, lie within a
# millimetre of Z-Anatomy's coccyx). Cut in two at the sacrococcygeal joint, so the coccyx is its own part: each
# vertex goes to whichever of Z-Anatomy's sacrum and coccyx (moved by the sacrum's fit, bonefit.py) is nearer, and
# each side's open cut is closed with a fan. The meshes stay BodyParts3D's own; Z-Anatomy's only says where to cut.
# Writes raw/cut/FJ3393.obj (the sacrum, which build.py takes over the original) and the coccyx over zplace.py's
# copy of Z-Anatomy's (raw/zextra/ZB....obj), so the coccyx keeps its card, names and place in the tree.
# Plain Python 3 with numpy and scipy; run after zplace.py.
import json, os
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
OBJ = os.path.join(HERE, 'raw', 'objisa', 'isa_BP3D_4.0_obj_99')
CUT = os.path.join(HERE, 'raw', 'cut')
ZEXTRA = os.path.join(HERE, 'raw', 'zextra')
SACRUM = 'FJ3393'


def read(path):
    head, vs, fs = [], [], []
    for l in open(path, encoding='utf-8', errors='ignore'):
        if l.startswith('#'):
            if not vs:
                head.append(l)
        elif l.startswith('v '):
            vs.append(l.split()[1:4])
        elif l.startswith('f '):
            fs.append([p.split('/')[0] for p in l.split()[1:4]])
    return head, np.array(vs, dtype=np.float64), np.array(fs, dtype=np.int64) - 1


def closed(v, f):
    """The faces' own vertices only, and each boundary loop closed by a fan to its centre, wound like the faces."""
    used = np.unique(f)
    remap = np.full(len(v), -1)
    remap[used] = np.arange(len(used))
    v, f = v[used], remap[f]
    edges = {}
    for a, b, c in f:
        for e in ((a, b), (b, c), (c, a)):
            edges[e] = edges.get(e, 0) + 1
    nxt = {}
    for (a, b) in edges:
        if (b, a) not in edges:
            nxt[b] = a                      # the cap runs the boundary the other way round
    v, caps, loops = list(v), [], 0
    while nxt:
        start = next(iter(nxt))
        loop, p = [start], nxt.pop(start)
        while p != start and p in nxt:
            loop.append(p)
            p = nxt.pop(p)
        if len(loop) < 3:
            continue
        c = len(v)
        v.append(np.mean([v[i] for i in loop], axis=0))
        caps += [(loop[i], loop[(i + 1) % len(loop)], c) for i in range(len(loop))]
        loops += 1
    return np.array(v), np.vstack([f, np.array(caps, dtype=np.int64)]) if caps else f, loops


def write(path, head, v, f):
    lo, hi = v.min(0), v.max(0)
    with open(path, 'w') as out:
        for l in head:
            out.write('# Bounds(mm): ({:.6f},{:.6f},{:.6f})-({:.6f},{:.6f},{:.6f})\n'.format(*lo, *hi) if l.startswith('# Bounds') else l)
        out.write(''.join(f'v {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n' for p in v))
        out.write(''.join(f'f {t[0] + 1} {t[1] + 1} {t[2] + 1}\n' for t in f))


# Z-Anatomy's sacrum and coccyx, in our frame by the sacrum's fit
d = np.load(os.path.join(HERE, 'raw', 'zdump.npz'))
fit = json.load(open(os.path.join(HERE, 'out', 'bonefit.json')))['Sacrum']
s, R, t = fit['s'], np.array(fit['R']), np.array(fit['t'])
z = {}
for i in range(len(d.files) // 3):
    name = str(d[f'm{i}'][0])
    if name in ('Sacrum', 'Coccyx'):
        z[name] = np.einsum('ij,nj->ni', s * R, d[f'v{i}'].astype(np.float64) * 1000) + t
assert all(np.isfinite(p).all() for p in z.values())

head, v, f = read(os.path.join(OBJ, SACRUM + '.obj'))
head = [l for l in head if not l.startswith('# Volume')]
# Its 5,293 vertices are 4,947 points, each seam drawn twice: welded, it is one closed surface, so a cut has one rim.
v, inv = np.unique(v.round(3), axis=0, return_inverse=True)
f = inv.ravel()[f]
near_c = cKDTree(z['Coccyx']).query(v)[0]
near_s = cKDTree(z['Sacrum']).query(v)[0]
is_c = near_c < near_s
# Where the nearer one changes is the joint: a plane through it, and the mesh cut along that plane (each triangle it
# crosses split where it crosses), so both cut faces are flat, not a zigzag along the triangles' edges.
rim = v[np.unique(f[is_c[f].any(1) & ~is_c[f].all(1)])]
c = rim.mean(0)
n = np.linalg.svd(rim - c)[2][2]
n = n if n[2] > 0 else -n                   # towards the sacrum
d = np.einsum('ij,j->i', v - c, n)
assert ((d < 0) == is_c).mean() > 0.98      # the plane parts what the two surfaces part

v = list(v)
mid = {}
def cross(a, b):
    """The point where edge a-b meets the plane, made once for both triangles that share the edge."""
    k = (min(a, b), max(a, b))
    if k not in mid:
        t = d[a] / (d[a] - d[b])
        mid[k] = len(v)
        v.append(v[a] + t * (v[b] - v[a]))
    return mid[k]

up, down = [], []
for tri in f:
    below = d[tri] < 0
    if below.all() or not below.any():
        (down if below.all() else up).append(tuple(tri))
        continue
    lone = int(np.flatnonzero(below if below.sum() == 1 else ~below)[0])
    a, b, e = tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]
    p, q = cross(a, b), cross(e, a)
    one, two = (down, up) if below.sum() == 1 else (up, down)
    one.append((a, p, q))                   # the corner on its own side
    two += [(p, b, e), (p, e, q)]           # the rest, a quad in two
v = np.array(v)
sv, sf, sl = closed(v, np.array(up))
cv, cf, cl = closed(v, np.array(down))
capped = np.unique(cf[(cf == len(cv) - 1).any(1)])          # the coccyx's cut face: its rim and its centre
rim_off = np.abs(np.einsum('ij,j->i', cv[capped] - c, n)).max()

zp = json.load(open(os.path.join(HERE, 'out', 'zplace.json')))
el = next(p[0] for p in zp['placed'] if p[1] == 'Coccyx')
os.makedirs(CUT, exist_ok=True)
write(os.path.join(CUT, SACRUM + '.obj'), head + ['# Cut : the coccyx taken off, its own part (cut.py)\n'], sv, sf)
chead = [l for l in head if not l.startswith(('# File ID', '# Representation ID', '# Build-up', '# Concept ID', '# English name'))]
chead = chead[:-1] + [f'# File ID : {el}\n', '# English name : Coccyx\n', '# Kind : bone\n', '# Group : Vertebral column\n',
                      '# Cut : from BodyParts3D\'s sacrum (FJ3393) at the sacrococcygeal joint, where Z-Anatomy puts it (cut.py)\n'] + chead[-1:]
write(os.path.join(ZEXTRA, el + '.obj'), chead, cv, cf)
gap = cKDTree(z['Coccyx']).query(cv)[0]
print(f'[cut] sacrum {len(sf)} tris ({sl} cut closed), coccyx {len(cf)} tris ({cl}) as {el}; '
      f'coccyx within {np.median(gap):.2f} mm of Z-Anatomy\'s (median), {gap.max():.1f} mm worst; '
      f'cut flat to {rim_off:.3f} mm')
