"""Papillary muscles and chordae tendineae of the mitral and tricuspid valves, with their beat.

Papillary muscles (sizes and placement in subvalve_params.json, sources in spec.md):
  LV: anterolateral and posteromedial. Each stands on the LV's inner surface at the angle the anatomy gives
  (phi, guessed from the qualitative description: no published clock-face position), at the level along the
  wall solved so its tip lies the published distance from the midpoint of the anterior mitral ring; its
  published length and width; heads at the tip.
  RV: anterior and posterior where BodyParts3D's stand (warped onto this heart), at their published sizes; the
  small septal (medial) one by the outflow tract.
Chordae: from each head, trunks that fan into branches (published counts per leaflet and diameters by order)
  to the half of each leaflet on that muscle's side: marginal ones to the free edge, rough-zone ones a little
  in from it, two struts to the anterior mitral leaflet. Closed they are taut and straight; open they keep
  their length and bow.

The beat: a muscle's base moves with the wall under it; its tip keeps its distance to its valve ring (muscles
shorten as the ring descends, the chordae stay taut), so the tip moves as the ring does.

Out: work/parts/<id>.npz (v, f, and the morph displacements vsys, afill, open_<valve>), work/parts/<id>.json
"""
import json, os, numpy as np, pyvista as pv
import heartgeo as H
from scipy.spatial import cKDTree

S = json.load(open('subvalve_params.json'))
os.makedirs('work/parts', exist_ok=True)
VAL = dict(np.load('work/valves.npz')); VMETA = json.load(open('work/valves.json'))
W = H.walls()
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- mesh helpers

def frames(path):
    """Parallel-transport frames along a polyline."""
    T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    a = np.array([1.0, 0, 0]) if abs(T[0, 0]) < 0.9 else np.array([0, 1.0, 0])
    N = [np.cross(T[0], a)]; N[0] /= np.linalg.norm(N[0])
    for i in range(1, len(T)):
        b = np.cross(T[i - 1], T[i]); s = np.linalg.norm(b)
        if s < 1e-9: N.append(N[-1]); continue
        b /= s; ang = np.arccos(np.clip(T[i - 1] @ T[i], -1, 1)); v = N[-1]
        N.append(v * np.cos(ang) + np.cross(b, v) * np.sin(ang) + b * (b @ v) * (1 - np.cos(ang)))
    N = np.array(N); B = np.cross(T, N)
    return T, N, B

def tube(path, radius, sides=8, cap=True):
    """A closed tube along path with a radius per path point."""
    T, N, B = frames(path); r = np.broadcast_to(radius, (len(path),))
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    V = (path[:, None, :] + r[:, None, None] * (np.cos(a)[None, :, None] * N[:, None, :] + np.sin(a)[None, :, None] * B[:, None, :])).reshape(-1, 3)
    F = []
    for i in range(len(path) - 1):
        for j in range(sides):
            p, q = i * sides + j, i * sides + (j + 1) % sides
            F += [[p, q, q + sides], [p, q + sides, p + sides]]
    if cap:
        c0, c1 = len(V), len(V) + 1; V = np.vstack([V, path[0], path[-1]]); e = (len(path) - 1) * sides
        F += [[c0, (j + 1) % sides, j] for j in range(sides)] + [[c1, e + j, e + (j + 1) % sides] for j in range(sides)]
    return V, np.array(F, 'i4')

def merge(parts):
    V, F, off = [], [], 0
    for v, f in parts: V.append(v); F.append(f + off); off += len(v)
    return np.vstack(V), np.vstack(F)

# ---------------------------------------------------------------- where things are

def endo_point(side, phi, Z):
    """The inner surface of a ventricle at (phi, Z) and its normal into the cavity."""
    v, u = W[side + '_v'], W[side + '_uvc']; m = H.mesh(side).compute_normals(auto_orient_normals=True)
    inner = u[:, 0] < 0.03
    d = np.abs(np.angle(np.exp(1j * (u[:, 1] - phi)))) * 20 + np.abs(u[:, 2] - Z) * 80   # ~mm-ish metric
    d[~inner] = 1e9; i = np.argmin(d)
    return v[i], -m.point_normals[i]     # mesh normals point out of the wall solid; on the inner face that's into the cavity

def leaflet_mid(key, state):
    """Mid-surface grid (nu, nw, 3) of a leaflet in a state."""
    nu, nw = VMETA[key]['grid']; X = VAL[f'{key}_{state}']; n = nu * nw
    return ((X[:n] + X[n:2 * n]) / 2).reshape(nu, nw, 3)

def ring_mid(v):
    pts, angs, fr = H.ring(v); return pts, fr

# ---------------------------------------------------------------- papillary muscles

def papillary(base, inward, toward, length, width, heads, name, root=3.0):
    """A finger of muscle growing out of the wall: its centreline starts 3 mm inside the wall at base, leaves
    along the wall's normal (inward) and curves towards its valve (toward); a root flared where it meets
    the wall; heads at the tip. Returns mesh, head tips, and each vertex's fraction along it (0 wall, 1 tip)."""
    inward = inward / np.linalg.norm(inward); toward = toward / np.linalg.norm(toward)
    p0 = base - inward * root; p1 = base + inward * (width * 0.6)
    tip = p1 + toward * length * 0.85
    t = np.linspace(0, 1, 18)[:, None]
    path = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * (p1 + toward * 2) + t ** 2 * tip   # quadratic Bezier
    tt = t.ravel()
    r = width / 2 * (1 + 0.6 * np.exp(-((tt - 0.12) / 0.1) ** 2)) * (1 - 0.2 * tt)   # flared root where it meets the wall
    parts, tips = [tube(path, r, sides=14)], []
    T, N, B = frames(path)
    for k in range(heads):
        ang = 2 * np.pi * k / heads + 0.4; out = (np.cos(ang) * N[-1] + np.sin(ang) * B[-1]) * (0.0 if heads == 1 else 0.45)
        d = T[-1] + out; d /= np.linalg.norm(d)
        h0 = path[-1] - T[-1] * 1.0; ht = h0 + d * (length * 0.15 + 2.5)
        hp = np.linspace(0, 1, 6)[:, None] * (ht - h0) + h0
        parts.append(tube(hp, np.linspace(width / 2 * (0.7 if heads == 1 else 0.5), 0.9, 6), sides=10)); tips.append(ht)
    V, F = merge(parts)
    L = np.cumsum(np.r_[0, np.linalg.norm(np.diff(path, axis=0), axis=1)]); i = cKDTree(path).query(V)[1]
    return V, F, np.array(tips), L[i] / L[-1]

# ---------------------------------------------------------------- chordae

def chorda_paths(head, inserts, trunk_frac=0.35, n=10):
    """One trunk from head that fans to several insertions after trunk_frac of the way."""
    fan = head + (inserts.mean(0) - head) * trunk_frac
    trunk = head + np.linspace(0, 1, 5)[:, None] * (fan - head)
    branches = [fan + np.linspace(0, 1, n)[:, None] * (q - fan) for q in inserts]
    return trunk, branches

def bowed(p0, p1, length, sag_dir, n):
    """A path from p0 to p1 of a given length: straight if taut, else a bow towards sag_dir."""
    d = np.linalg.norm(p1 - p0); t = np.linspace(0, 1, n)
    straight = p0 + np.outer(t, p1 - p0)
    if length <= d * 1.001: return straight
    # sagitta of a circular arc with chord d and arc length 'length' (small-sag approximation, then clipped)
    h = np.sqrt(max(0.0, 3 * d * (length - d) / 8)); h = min(h, 0.15 * d)   # slack chordae bow, they don't loop
    s = sag_dir - (sag_dir @ (p1 - p0)) / d**2 * (p1 - p0); s /= np.linalg.norm(s) + 1e-9
    return straight + np.outer(4 * h * t * (1 - t), s)

# ---------------------------------------------------------------- build

_outer = None
def keep_inside(V, clear=0.4):
    """Pull any vertex that reaches the heart's outer surface back in along its normal: a muscle's root is
    inside the wall, never showing on the outside, however thin the wall is."""
    global _outer
    if _outer is None:
        m = pv.read('work/average.vtu'); t = np.isin(m.cell_data['ID'], [1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23, 24, 7, 8, 9, 10])
        o = m.extract_cells(t).extract_surface(algorithm='dataset_surface').triangulate().connectivity('largest')
        _outer = o.extract_surface(algorithm='dataset_surface').compute_normals(auto_orient_normals=True)
    sd = pv.PolyData(V).compute_implicit_distance(_outer)['implicit_distance']
    _, i = cKDTree(_outer.points).query(V); n = _outer.point_normals[i]
    push = np.maximum(sd + clear, 0)
    return V - n * push[:, None]


def chord_motion(V, head, insert, side, valve):
    """A chorda's vertices move as its two ends do, in proportion along it: its head with the cavity (the muscle's
    tip), its insertion with the leaflet (the valve ring's motion)."""
    t = np.clip(((V - head) @ (insert - head)) / max(np.sum((insert - head) ** 2), 1e-9), 0, 1)[:, None]
    h = H.cavity_motion(head[None], side)[0][0]; q = H.motion_at(insert[None], valve)[0][0]
    return h * (1 - t) + q * t


def save(pid, V, F, targets, meta):
    np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F.astype('i4'),
                        **{k: d.astype('f4') for k, d in targets.items()})
    json.dump(meta, open(f'work/parts/{pid}.json', 'w'), indent=1)

def ring_motion(v):
    """Mean vsys and afill of a valve's ring (its plane's points)."""
    pts, fr = ring_mid(v); vs, af = H.motion_at(pts, v); return vs.mean(0), af.mean(0)

if __name__ == '__main__':
    report = []
    for valve, side, pms in [('mv', 'lv', S['lv']), ('tv', 'rv', S['rv'])]:
        leaflets = [k for k in VMETA if VMETA[k]['valve'] == valve]
        pts, fr = ring_mid(valve); c, nrm, e1, e2 = fr
        ring_vs, ring_af = ring_motion(valve)
        # every leaflet column (u) knows its free-edge and rough-zone points, closed and open
        cols = []
        for key in leaflets:
            mc, mo = leaflet_mid(key, 'closed'), leaflet_mid(key, 'open'); nu, nw = mc.shape[:2]
            for i in range(1, nu - 1):
                cols.append(dict(key=key, i=i, nu=nu, closed=mc[i], open=mo[i]))
        placed = {}
        if valve == 'mv':
            # the anterior ring's midpoint: the ring point facing the aortic valve
            angs_ = H.ring('mv')[1]; amid = H.ring('mv')[0][np.argmin(np.abs(np.angle(np.exp(1j * (angs_ - H.angle_of(H.valve_frame('av')[0], fr)[0])))))]
            target = c + nrm * 8
            def tip_of(pm, phi, Z):
                b, inw = endo_point(side, phi, Z)
                return b, inw, papillary(b, inw, target - b, pm['length'], pm['width'], pm['heads'], '')[2].mean(0)
            cand = {}
            for pm in pms:
                cand[pm['id']] = [(ph, Z) + tip_of(pm, np.radians(ph), Z)
                                  for ph in np.arange(pm['phi'] - 60, pm['phi'] + 61, 6) for Z in np.linspace(0.55, 0.9, 15)]
            p1, p2 = pms; best = None
            for c1 in cand[p1['id']]:
                e1 = (np.linalg.norm(c1[4] - amid) - p1['tip_to_anterior_ring']) ** 2 + ((c1[0] - p1['phi']) / 60) ** 2
                for c2 in cand[p2['id']]:
                    e = e1 + (np.linalg.norm(c2[4] - amid) - p2['tip_to_anterior_ring']) ** 2 + ((c2[0] - p2['phi']) / 60) ** 2 \
                        + (np.linalg.norm(c1[4] - c2[4]) - S['lv_tip_distance']) ** 2
                    if best is None or e < best[0]: best = (e, c1, c2)
            lv_fit = {p1['id']: (best[1][2], best[1][3], best[1][1]), p2['id']: (best[2][2], best[2][3], best[2][1])}
            report.append(f'LV muscles fitted at phi {best[1][0]:.0f} and {best[2][0]:.0f} deg (guessed {p1["phi"]}, {p2["phi"]})')
        for pm in pms:
            if 'bp3d' in pm:   # RV: stand where BodyParts3D's does (its root: the part of it nearest the wall)
                w, info = H.bp3d_warped(); bv = w[pm['bp3d'] + '_v']
                t = cKDTree(W[side + '_v']); d, i = t.query(bv)
                base = bv[d < np.percentile(d, 15)].mean(0); _, bi = t.query(base)
                m = H.mesh(side).compute_normals(auto_orient_normals=True); inward = -m.point_normals[bi]
                base = W[side + '_v'][bi]; Zs = None
            else:              # LV: both muscles' angle and level solved together (below)
                base, inward, Zs = lv_fit[pm['id']]
            target = c + nrm * 8                                   # towards the middle of the orifice, below the ring
            V, F, tips, frac = papillary(base, inward, target - base, pm['length'], pm['width'], pm['heads'], pm['name'],
                                         root=3.0 if side == 'lv' else 1.2)   # the RV wall is under 4 mm thick
            V = keep_inside(V)
            # carried by the walls round it (its root is in the wall, so it moves with the wall there)
            vs, af = H.cavity_motion(V, side)
            pid = f'{side}_pm_{pm["id"]}'
            save(pid, V, F, {'vsys': vs, 'afill': af}, {'name': pm['name'], 'tissue': 'heart', 'group': f'{side}_papillary',
                                                         'mount': side})
            placed[pm['id']] = dict(tips=tips, base=base, Z=Zs, pid=pid)
            report.append(f'{pm["name"]}: base Z {Zs if Zs is None else round(Zs, 2)}, length {pm["length"]}, tip to anterior ring '
                          f'{np.linalg.norm(tips.mean(0) - (amid if valve == "mv" else c)):.1f} mm')
        if valve == 'mv':
            a, b = [placed[p['id']]['tips'].mean(0) for p in pms]; report.append(f'  tips apart {np.linalg.norm(a - b):.1f} mm')
        # each leaflet column goes to the nearest muscle; per muscle and leaflet, group the columns into trunks
        allheads = {p['id']: placed[p['id']]['tips'] for p in pms}
        chord_parts = {p['id']: [] for p in pms}; chord_vs = {p['id']: [] for p in pms}; chord_op = {p['id']: [] for p in pms}
        counts = {}
        for key in leaflets:
            kc = [cl for cl in cols if cl['key'] == key]
            # marginal: free edge; rough zone: a quarter of the way back from it
            for order, jf, radius, per in [('marginal', 1.0, S['marginal_d'] / 2, S['marginal_per_leaflet']),
                                           ('rough', 0.72, S['rough_d'] / 2, S['rough_per_leaflet'])]:
                sel = np.linspace(0, len(kc) - 1, per).round().astype(int)
                ins = []
                for s_ in sel:
                    cl = kc[s_]; nw = cl['closed'].shape[0]; j = min(nw - 1, int(round(jf * (nw - 1))))
                    if order == 'rough':   # rough zone on the closed leaflet: where the body meets the coaptation zone
                        j = int(nw * 0.62)
                    ins.append((cl['closed'][j], cl['open'][j]))
                ins_c = np.array([p for p, _ in ins]); ins_o = np.array([q for _, q in ins])
                serves = [p['id'] for p in pms if any(lf in key for lf in p.get('leaflets', [key.split('_', 1)[1]]))] or list(allheads)
                # by angle round the valve's axis, not by distance (a deep muscle would never win)
                pang = {k: H.angle_of(allheads[k].mean(0), fr)[0] for k in serves}
                owner = np.array([min(serves, key=lambda k: abs(np.angle(np.exp(1j * (H.angle_of(p, fr)[0] - pang[k]))))) for p in ins_c])
                for pmid in allheads:
                    mask = owner == pmid
                    if not mask.any(): continue
                    heads = allheads[pmid]; idx = np.where(mask)[0]
                    # fans of 3-4 insertions per trunk, each trunk from its nearest head
                    for g in np.array_split(idx, max(1, int(np.ceil(len(idx) / S['branches_per_trunk'])))):
                        h = heads[np.argmin(np.linalg.norm(heads - ins_c[g].mean(0), axis=1))]
                        tr, brs = chorda_paths(h, ins_c[g])
                        _, brs_o = chorda_paths(h, ins_o[g])
                        parts = [tube(tr, radius * 1.6, sides=6, cap=False)]
                        vs_list, op_list = [], []
                        L = [np.sum(np.linalg.norm(np.diff(b, axis=0), axis=1)) for b in brs]
                        vs_list.append(chord_motion(parts[0][0], h, ins_c[g].mean(0), side, valve)); op_list.append(np.zeros((len(tr) * 6, 3)))
                        for b, bo, Lb, q_c, q_o in zip(brs, brs_o, L, ins_c[g], ins_o[g]):
                            bv, bf = tube(b, radius, sides=6, cap=False); parts.append((bv, bf))
                            fan = b[0]; bow = bowed(fan, q_o, Lb, nrm, len(b))
                            Vo, _ = tube(bow, radius, sides=6, cap=False)
                            vs_list.append(chord_motion(bv, h, q_c, side, valve)); op_list.append(Vo - bv)
                        V, F = merge(parts)
                        chord_parts[pmid].append((V, F)); chord_vs[pmid].append(np.vstack(vs_list)); chord_op[pmid].append(np.vstack(op_list))
                        counts[order] = counts.get(order, 0) + len(g)
            if valve == 'mv' and 'anterior' in key:   # two strut chordae, one from each muscle, to the anterior leaflet's body
                mc, mo = leaflet_mid(key, 'closed'), leaflet_mid(key, 'open'); nu, nw = mc.shape[:2]
                for pmid, ui in zip(allheads, [int(nu * 0.3), int(nu * 0.7)]):
                    q_c, q_o = mc[ui, int(nw * 0.45)], mo[ui, int(nw * 0.45)]
                    h = allheads[pmid][np.argmin(np.linalg.norm(allheads[pmid] - q_c, axis=1))]
                    p = h + np.linspace(0, 1, 10)[:, None] * (q_c - h)
                    if np.linalg.norm(H.motion_at(q_c[None], 'mv')[0]) < 0: pass
                    V, F = tube(p, S['strut_d'] / 2, sides=8, cap=False)
                    Vo, _ = tube(bowed(h, q_o, np.linalg.norm(q_c - h), nrm, 10), S['strut_d'] / 2, sides=8, cap=False)
                    chord_parts[pmid].append((V, F)); chord_vs[pmid].append(chord_motion(V, h, q_c, side, valve)); chord_op[pmid].append(Vo - V)
                    counts['strut'] = counts.get('strut', 0) + 1
        for pm in pms:
            if not chord_parts[pm['id']]: continue
            V, F = merge(chord_parts[pm['id']]); vs = np.vstack(chord_vs[pm['id']]); op = np.vstack(chord_op[pm['id']])
            # the end at the head goes with the muscle's tip, which goes with the ring: vsys is the ring's all along
            save(f'{side}_chordae_{pm["id"]}', V, F, {'vsys': vs, 'afill': np.zeros_like(vs), f'open_{valve}': op},
                 {'name': f'Chordae tendineae of the {pm["name"].lower()}', 'tissue': 'chordae', 'group': f'{valve}_chordae', 'mount': side})
        report.append(f'{valve} chordae insertions: {counts}')
    print('\n'.join(report))
