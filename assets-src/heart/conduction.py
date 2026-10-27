"""The electrical system: when each point of the heart is activated, and the conduction tissue that carries it.

Activation (eikonal: earliest arrival over the CT tetrahedra's edges, each edge's time its length over the local
conduction velocity), times in ms from the SA node's firing:
  atria      from the SA node (at the junction of the superior vena cava and the right atrium, at the head of the
             crista terminalis), through atrial muscle, with Bachmann's bundle a fast path over the roof to the left
             atrium. The atrial muscle's velocity is solved so the atria finish in the published P-wave duration.
  ventricles after the PR interval, from Durrer's earliest sites (central left septum, high anterior and posterior
             paraseptal LV, and the RV where the moderator band brings the right bundle), through the fast
             subendocardial Purkinje layer and out through the wall; the muscle's velocity is solved so the
             ventricles finish in the published QRS duration.
The conduction system itself (SA node, Bachmann's bundle, AV node, His bundle, left bundle with its anterior,
posterior and septal fascicles, right bundle through the moderator band, a Purkinje net) is built as parts.

Out: work/activation.npz (act per CT point, ms; the sites), work/parts/cond_*.npz (+ .json)
"""
import json, glob, os, numpy as np, pyvista as pv
from scipy import sparse
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
import heartgeo as H
from subvalve import tube, merge

C = json.load(open('conduction_params.json'))
m = pv.read('work/average.vtu'); P = np.asarray(m.points, 'f8'); n = len(P)
uvc = np.stack([m.point_data[k] for k in ['RHO.dat', 'PHI.dat', 'Z.dat', 'V.dat']], 1)
cells = m.cells.reshape(-1, 5)[:, 1:]; tag = m.cell_data['ID']
label = np.load('work/motion.npz')['label']
ATR = np.isin(label, [3, 4, 18, 19, 20, 21, 22, 23, 24]); VEN = np.isin(label, [1, 2])
e = np.vstack([cells[:, [i, j]] for i in range(4) for j in range(i + 1, 4)]); e = np.unique(np.sort(e, 1), axis=0)
L = np.linalg.norm(P[e[:, 0]] - P[e[:, 1]], axis=1)

def solve(mask, speed, sources):
    """Earliest arrival (ms) over edges inside mask; speed per edge (mm/ms); sources: list of (point index, t0)."""
    ok = mask[e[:, 0]] & mask[e[:, 1]]
    G = sparse.coo_matrix((L[ok] / speed[ok], (e[ok, 0], e[ok, 1])), (n, n)).tocsr(); G = G + G.T
    idx = [s for s, _ in sources]; t0 = np.array([t for _, t in sources])
    D = dijkstra(G, indices=idx, min_only=False) if len(idx) > 1 else dijkstra(G, indices=idx)[None]
    return np.min(D + t0[:, None], axis=0)

def nearest(mask, x):
    i = np.where(mask)[0]; return i[np.argmin(np.linalg.norm(P[i] - x, axis=1))]

# ---------------------------------------------------------------- sites
svc = P[np.isin(np.arange(n), np.unique(cells[tag == 16].ravel()))].mean(0)
ra_c = P[label == 4].mean(0); la_c = P[label == 3].mean(0)
lateral = ra_c - la_c; lateral /= np.linalg.norm(lateral)
SA = nearest(np.isin(label, [4, 23]), svc + lateral * 12 - np.array([0, 0, 6]))     # lateral to the SVC-RA junction
LAA = P[np.unique(cells[tag == 11].ravel())].mean(0)
BB_LA = nearest(label == 3, la_c + (LAA - la_c) * 0.5 + np.array([0, -6, 12]))      # where Bachmann's bundle reaches the LA roof
# AV node: apex of Koch's triangle, on the septal RA just above the tricuspid ring's septal part and anterior
# to the coronary sinus's mouth
cs = np.load('work/parts/cor_FJ2655.npz')['v']; cs_os = cs[np.argmin(np.linalg.norm(cs - ra_c, axis=1))]
tvr = H.ring('tv')[0]; sep_tv = tvr[np.argmin(np.linalg.norm(tvr - la_c, axis=1))]
AVN = nearest(label == 4, cs_os * 0.35 + sep_tv * 0.65 + np.array([0, -4, 4]))

def uvc_point(V_, phi, Z, rho=0.0):
    sel = VEN & (np.sign(uvc[:, 3]) == V_) & (np.abs(uvc[:, 0] - rho) < 0.05)
    i = np.where(sel)[0]
    d = np.abs(np.angle(np.exp(1j * (uvc[i, 1] - phi)))) * 20 + np.abs(uvc[i, 2] - Z) * 80
    return i[np.argmin(d)]

if __name__ == '__main__':
    # ---------------- atria: SA node, Bachmann's bundle; muscle velocity for the P wave's duration
    def atria(v):
        speed = np.full(len(e), v)
        t_bb = np.linalg.norm(P[BB_LA] - P[SA]) / C['bachmann_speed']
        return solve(ATR, speed, [(SA, 0.0), (BB_LA, t_bb)])
    lo, hi = 0.3, 3.0
    for _ in range(18):
        mid = (lo + hi) / 2; ta = atria(mid); dur = np.nanmax(np.where(np.isfinite(ta) & ATR, ta, np.nan))
        lo, hi = (mid, hi) if dur > C['p_wave'] else (lo, mid)
    v_atr = (lo + hi) / 2; ta = atria(v_atr)
    print(f'atria: muscle {v_atr:.2f} m/s, Bachmann {C["bachmann_speed"]} m/s -> activated in {np.nanmax(ta[ATR & np.isfinite(ta)]):.0f} ms (P wave {C["p_wave"]})')
    t_avn = ta[AVN]
    # ---------------- ventricles
    q = C['pr'] # QRS onset after the SA node fires
    sites = [(uvc_point(-1, 0.0, 0.5), q), (uvc_point(-1, 0.75, 0.72), q + 2), (uvc_point(-1, -0.75, 0.33), q + 4)]
    mb = np.load('work/parts/endo_moderator_band.npz')['v']; pm = np.load('work/parts/rv_pm_ant.npz')['v']
    rv_site = nearest(VEN & (uvc[:, 3] > 0) & (uvc[:, 0] < 0.08), mb[np.argmin(np.linalg.norm(mb - pm.mean(0), axis=1))])
    sites.append((rv_site, q + C['rv_delay']))
    # the Purkinje network reaches high on the septum and front wall (the anterior fascicle's dense net) but less far
    # up the back wall, so the back of the base is activated last, as Durrer found
    back = (uvc[:, 1] < C['purkinje_back_from']) & (uvc[:, 1] > -np.pi + 0.3)
    purk = VEN & (uvc[:, 0] < C['purkinje_depth']) & (uvc[:, 2] < np.where(back, C['purkinje_top_back'], C['purkinje_top']))
    def vent(v):
        fast = purk[e[:, 0]] & purk[e[:, 1]]
        speed = np.where(fast, C['purkinje_speed'], v)
        return solve(VEN, speed, sites)
    lo, hi = 0.2, 2.0
    for _ in range(18):
        mid = (lo + hi) / 2; tv = vent(mid); dur = np.nanmax(tv[VEN & np.isfinite(tv)]) - q
        lo, hi = (mid, hi) if dur > C['qrs'] else (lo, mid)
    v_ven = (lo + hi) / 2; tv = vent(v_ven)
    last = np.where(VEN)[0][np.nanargmax(tv[VEN])]
    print(f'ventricles: muscle {v_ven:.2f} m/s, Purkinje {C["purkinje_speed"]} m/s -> QRS {np.nanmax(tv[VEN]) - q:.0f} ms (target {C["qrs"]}); '
          f'last activated at Z {uvc[last, 2]:.2f}, phi {np.degrees(uvc[last, 1]):.0f} deg, {"LV" if uvc[last, 3] < 0 else "RV"}')
    act = np.full(n, np.nan); act[ATR] = ta[ATR]; act[VEN] = tv[VEN]
    # valve planes, vessels' stubs: their nearest activated neighbour's time (they don't contract)
    rest = ~np.isfinite(act); good = np.where(np.isfinite(act))[0]
    act[rest] = act[good[cKDTree(P[good]).query(P[rest])[1]]]
    np.savez_compressed('work/activation.npz', act=act.astype('f4'), qrs_onset=q, v_atr=v_atr, v_ven=v_ven,
                        SA=SA, AVN=AVN, BB_LA=BB_LA, t_avn=t_avn)

    # ---------------- the conduction system, as parts
    for f in glob.glob('work/parts/cond_*'): os.remove(f)
    W = H.walls()
    def on_surface(name, pts, inside=True, lift=0.6):
        """Pull points onto a wall's inner (or outer) surface, lifted off it a little."""
        msh = H.mesh(name).compute_normals(auto_orient_normals=True); V_, N_ = np.asarray(msh.points), msh.point_normals
        t = cKDTree(V_); _, i = t.query(pts); return V_[i] + N_[i] * lift * (1 if inside else 1)
    def save(pid, V, F, name):
        vs, af = H.motion_at(V, 'heart')
        a_ = act[cKDTree(P).query(V)[1]]
        np.savez_compressed(f'work/parts/{pid}.npz', v=V.astype('f4'), f=F, vsys=vs.astype('f4'), afill=af.astype('f4'), act=a_.astype('f4'))
        json.dump({'name': name, 'tissue': 'conduction', 'group': 'conduction', 'mount': 'heart'}, open(f'work/parts/{pid}.json', 'w'), indent=1)
    line = lambda a, b, k=12: a + np.linspace(0, 1, k)[:, None] * (b - a)
    # SA node: a crescent, 13.5 mm, along the terminal groove from the SVC junction, just under the epicardium
    sa_dir = P[nearest(np.isin(label, [4]), P[SA] - np.array([0, 0, 14]) - lateral * 2)] - P[SA]
    sa_path = on_surface('ra', line(P[SA] - sa_dir / np.linalg.norm(sa_dir) * 2, P[SA] + sa_dir / np.linalg.norm(sa_dir) * C['sa_length']), lift=-0.6)
    t = np.linspace(0, 1, len(sa_path)); V, F = tube(sa_path, 0.6 + 2.0 * np.sin(np.pi * t) ** 0.7, sides=10)
    save('cond_sa_node', V, F, 'Sinoatrial node')
    # Bachmann's bundle: over the roof of the atria, on their outside, to the LA
    bb = np.vstack([on_surface('ra', line(P[SA], (P[SA] + P[BB_LA]) / 2, 12), lift=0.6), on_surface('la', line((P[SA] + P[BB_LA]) / 2, P[BB_LA], 12), lift=0.6)])
    V, F = tube(bb, np.full(len(bb), 1.6), sides=8)
    save('cond_bachmann', V, F, "Bachmann's bundle")
    # AV node, His bundle (to the crest of the muscular septum under the aortic valve), bundle branches
    avn = P[AVN]
    his_end = P[uvc_point(-1, 0.25, 0.95)]
    V1, F1 = tube(line(avn - np.array([2, 0, 1]), avn + np.array([2, 0, 1]), 8), np.r_[1.2, np.full(6, 2.0), 1.2], sides=10)
    save('cond_av_node', V1, F1, 'Atrioventricular node')
    V2, F2 = tube(line(avn, his_end, 10), np.full(10, 1.0), sides=8)
    save('cond_his', V2, F2, 'Bundle of His')
    ends = {'anterior': P[uvc_point(-1, 1.9, 0.38)], 'posterior': P[uvc_point(-1, -1.7, 0.35)], 'septal': P[uvc_point(-1, 0.0, 0.3)]}
    lbb = []
    for k_, end in ends.items():
        path = on_surface('lv', line(his_end, end, 20), lift=0.5); lbb.append(tube(path, np.linspace(1.0, 0.5, len(path)), sides=8))
    V, F = merge(lbb); save('cond_left_bundle', V, F, 'Left bundle branch (anterior, septal and posterior fascicles)')
    rv_sept = P[uvc_point(-1, 0.1, 0.55, rho=1.0)]       # down the septum's RV face
    mb_start = mb[np.argmax(np.linalg.norm(mb - pm.mean(0), axis=1))]
    path = np.vstack([line(his_end, rv_sept, 10), line(rv_sept, mb_start, 6)[1:], line(mb_start, pm.mean(0), 8)[1:]])
    V, F = tube(path, np.full(len(path), 0.6), sides=8); save('cond_right_bundle', V, F, 'Right bundle branch')
    # Purkinje net: fine branches over both ventricles' inner surfaces, from the fascicles' ends and the RV site
    rng = np.random.default_rng(5); pk = []
    for side, starts in [('lv', list(ends.values())), ('rv', [P[rv_site]])]:
        msh = H.mesh(side).compute_normals(auto_orient_normals=True); V_, N_ = np.asarray(msh.points), msh.point_normals
        u = W[side + '_uvc']; inner = np.where((u[:, 0] < 0.04) & (u[:, 2] < C['purkinje_top']))[0]; T = cKDTree(V_[inner])
        for s0 in starts:
            frontier = [V_[inner[T.query(s0)[1]]]]
            for gen in range(C['purkinje_generations']):
                nxt = []
                for p0 in frontier:
                    for _ in range(2):
                        d = rng.normal(0, 1, 3); p1 = p0 + d / np.linalg.norm(d) * rng.uniform(6, 11)
                        j = inner[T.query(p1)[1]]; p1 = V_[j]
                        seg = line(p0, p1, 6); jj = inner[T.query(seg)[1]]; seg = V_[jj] + N_[jj] * 0.3
                        seg = seg[np.r_[True, np.linalg.norm(np.diff(seg, axis=0), axis=1) > 0.2]]
                        if len(seg) < 3 or np.linalg.norm(seg[-1] - seg[0]) < 2: continue
                        pk.append(tube(seg, np.full(len(seg), 0.25), sides=5)); nxt.append(p1)
                frontier = nxt[:40]
    V, F = merge(pk); save('cond_purkinje', V, F, 'Purkinje fibres')
    print('conduction system: SA node, Bachmann, AV node, His, left and right bundles,', len(pk), 'Purkinje branches')
