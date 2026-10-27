"""Register BodyParts3D's heart onto the CT average heart, so its valves, papillary muscles and coronary
vessels can be carried over onto the measured shape.

Each BodyParts3D wall is matched only to its own CT part: the wall of the ventricles to the LV and RV
myocardium, each atrium's wall to that atrium. First a similarity (rotation, translation, one scale) by
ICP, then a smooth displacement field: Gaussian-weighted closest-point residuals, both ways, with the
kernel narrowing from 24 to 8 mm. The field is what moves the other parts.

Out: work/register.npz (similarity R, t, s; the field's sample points and displacements, sigma), and a
     report of the distances before and after, per part.
"""
import json, numpy as np, pyvista as pv
from scipy.spatial import cKDTree

rng = np.random.default_rng(1)
bp = np.load('work/bp3d.npz')
PAIRS = [('FJ2428', ['lv', 'rv']), ('FJ2438', ['la']), ('FJ2439', ['ra'])]

def sample_surface(v, f, n):
    a = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1)
    i = rng.choice(len(f), n, p=a / a.sum()); r = rng.random((n, 2)); m = r.sum(1) > 1; r[m] = 1 - r[m]
    return v[f[i, 0]] + r[:, :1] * (v[f[i, 1]] - v[f[i, 0]]) + r[:, 1:] * (v[f[i, 2]] - v[f[i, 0]])

src, tgt = [], []
for el, names in PAIRS:
    src.append(sample_surface(bp[el + '_v'].astype('f8'), bp[el + '_f'], 6000))
    ss = [pv.read(f'work/surf_{n}.vtp') for n in names]
    s = ss[0].merge(ss[1:]) if len(ss) > 1 else ss[0]
    tgt.append(sample_surface(np.asarray(s.points, 'f8'), s.faces.reshape(-1, 4)[:, 1:], 6000))
trees = [cKDTree(t) for t in tgt]

def report(label, P):
    out = []
    for (el, names), p, t, tr in zip(PAIRS, P, tgt, trees):
        d1 = tr.query(p)[0]; d2 = cKDTree(p).query(t)[0]
        out.append(f'{"+".join(names)} {np.sqrt((d1**2).mean()):.1f}/{np.sqrt((d2**2).mean()):.1f}')
    print(f'{label:12s} rms mm (BP->CT / CT->BP): ' + ', '.join(out))

# similarity ICP
allS, allT = np.vstack(src), np.vstack(tgt)
s = np.sqrt(((allT - allT.mean(0))**2).sum(1).mean() / ((allS - allS.mean(0))**2).sum(1).mean())
R, t = np.eye(3), allT.mean(0) - s * allS.mean(0)
sim = lambda X: s * X @ R.T + t
report('start', [sim(p) for p in src])
for it in range(60):
    A, B = [], []
    for p, tg, tr in zip(src, tgt, trees):
        q = sim(p); i = tr.query(q)[1]; A.append(p); B.append(tg[i])
        j = cKDTree(q).query(tg)[1]; A.append(p[j]); B.append(tg)
    A, B = np.vstack(A), np.vstack(B)
    ma, mb = A.mean(0), B.mean(0); a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(A)); D = np.diag([1, 1, np.sign(np.linalg.det(U @ Vt))])
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (a**2).sum(1).mean(); t = mb - s * ma @ R.T
report('similarity', [sim(p) for p in src])
ang = np.degrees(np.arccos((np.trace(R) - 1) / 2))
print(f'  rotation {ang:.1f} deg, scale {s:.3f}')

# smooth field: points X (in the similarity-moved space) carry displacements D
def field(X, Dp, sig):
    def f(Q):
        tr = cKDTree(X); out = np.zeros_like(Q); wsum = np.zeros(len(Q))
        for k, nb in enumerate(tr.query_ball_point(Q, 3 * sig)):
            if not nb: continue
            w = np.exp(-((X[nb] - Q[k])**2).sum(1) / (2 * sig**2)); out[k] = w @ Dp[nb]; wsum[k] = w.sum()
        return out / np.maximum(wsum, 1e-9)[:, None] * np.minimum(wsum, 1)[:, None] ** 0  # normalised average
    return f

P = [sim(p) for p in src]
stages = []
for sig in [24, 16, 12, 8]:
    for _ in range(3):
        X, Dp = [], []
        for p, tg, tr in zip(P, tgt, trees):
            i = tr.query(p)[1]; X.append(p); Dp.append(tg[i] - p)
            j = cKDTree(p).query(tg)[1]; X.append(p[j]); Dp.append(tg - p[j])
        X, Dp = np.vstack(X), np.vstack(Dp)
        # thin the samples for speed
        k = rng.choice(len(X), min(len(X), 12000), replace=False); X, Dp = X[k], Dp[k]
        f = field(X, Dp, sig)
        P = [p + 0.7 * f(p) for p in P]
        stages.append((X, 0.7 * Dp, sig))
    report(f'field {sig}mm', P)

np.savez_compressed('work/register.npz', R=R, t=t, s=s,
                    **{f'X{i}': x for i, (x, _, _) in enumerate(stages)}, **{f'D{i}': d for i, (_, d, _) in enumerate(stages)},
                    sig=np.array([g for *_, g in stages]))
