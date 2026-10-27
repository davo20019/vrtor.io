"""The four valves, built on the CT average heart's own valve rings, closed and open with the same vertices.

Atrioventricular valves (mitral, tricuspid): each leaflet hangs from its arc of the ring. Closed, its free edge
lies on the coaptation line, a path across the orifice through a meeting point O, and the leaflets then run
together into the ventricle for the rest of their length (the coaptation zone): each leaflet's length from
ring to free edge is its published height, so the depth they close at follows from the numbers. Open, each
leaflet swings into the ventricle about its ring until the free edges bound the published orifice area.

Semilunar valves (aortic, pulmonary): three cusps, each attached along a crown-shaped line from one commissure
down to its nadir at the ring and up to the next. Closed, the free edges meet along three lines in the centre
(the Y seen from above) and the lunulae stand together; open, the free edges stand back near the wall.

Where each leaflet sits on its ring comes from this heart's own landmarks (sector_angles), never by eye.
Sizes are in P with their sources in spec.md.

Out: work/valves.npz (<id>_closed, <id>_open: vertices of a closed thin solid; <id>_f; <id>_grid: nu, nw),
     work/valves.json (each leaflet's name, valve, and its ventricular-side chordal insertion points)
"""
import json, numpy as np, pyvista as pv
import heartgeo as H

P = json.load(open('valves_params.json'))

# ---------------------------------------------------------------- where the leaflets sit

def ostium(el):
    """Where a coronary trunk leaves the aorta: its end nearest the aortic valve's centre."""
    w, _ = H.bp3d_warped(); v = w[el + '_v']; c = H.valve_frame('av')[0]
    return v[np.argsort(np.linalg.norm(v - c, axis=1))[:30]].mean(0)

def sector_angles(v, frame):
    """Commissure angles (radians, about the valve's own axis), leaflet by leaflet, in ring order."""
    c, n, e1, e2 = frame
    ang = lambda p: float(H.angle_of(p, frame)[0])
    if v == 'mv':   # the anterior leaflet faces the aortic valve (aortomitral continuity), a third of the ring
        a0 = ang(H.valve_frame('av')[0]); half = np.pi * P['mv']['anterior_share']
        return [('anterior', a0 - half, a0 + half), ('posterior', a0 + half, a0 - half + 2 * np.pi)]
    if v == 'tv':   # the septal leaflet lies on the septum (towards the LV's septal wall)
        w = H.walls(); uvc = w['lv_uvc']; sel = (np.abs(uvc[:, 1]) < 0.3) & (uvc[:, 0] < 0.1) & (uvc[:, 2] > 0.7)
        s0 = ang(w['lv_v'][sel].mean(0)); sh = P['tv']['share']; ss = np.pi * sh['septal']
        front = ang(c + np.array([0, -30.0, 0]))           # towards the front of the body (-y)
        e = s0 + ss                                          # septal leaflet's end, going round one way
        ant_first = np.cos(e + np.pi * sh['anterior'] - front) > np.cos(e + np.pi * sh['posterior'] - front)
        first, second = ('anterior', 'posterior') if ant_first else ('posterior', 'anterior')
        m = e + 2 * np.pi * sh[first]
        return [('septal', s0 - ss, e), (first, e, m), (second, m, s0 - ss + 2 * np.pi)]
    if v == 'av':   # left and right coronary cusps centred on their coronary ostia
        L = ang(ostium('FJ2737')); R = ang(ostium('FJ2723'))
        clr = np.angle(np.exp(1j * L) + np.exp(1j * R))       # commissure between left and right cusps
        # the two other commissures 120 degrees either side; name the sectors by which ostium they hold
        cs = [clr, clr + 2 * np.pi / 3, clr + 4 * np.pi / 3]
        out = []
        for k in range(3):
            a, b = cs[k], cs[k] + 2 * np.pi / 3; mid = (a + b) / 2
            name = 'left coronary' if np.cos(mid - L) > 0.5 else 'right coronary' if np.cos(mid - R) > 0.5 else 'non-coronary'
            out.append((name, a, b))
        return out
    if v == 'pv':   # the commissure between left and right cusps faces the aortic valve
        cf = ang(H.valve_frame('av')[0]); cs = [cf, cf + 2 * np.pi / 3, cf + 4 * np.pi / 3]
        out = []
        for k in range(3):
            a, b = cs[k], cs[k] + 2 * np.pi / 3; mid = (a + b) / 2
            # facing the aorta's front-left or front-right; the third faces forward (anterior cusp)
            side = np.array([1.0, 0, 0]) @ (np.cos(mid) * e1 + np.sin(mid) * e2)
            name = 'anterior' if k == 1 else ('left' if side > 0 else 'right')
            out.append((name, a, b))
        return out

def ring_at(pts, angs, a):
    """Ring point at angle a (interpolated round the ring)."""
    a = np.angle(np.exp(1j * a)); i = np.searchsorted(angs, a) % len(angs); j = (i - 1) % len(angs)
    da = np.angle(np.exp(1j * (angs[i] - angs[j]))); t = np.angle(np.exp(1j * (a - angs[j]))) / da if da else 0
    return pts[j] * (1 - t) + pts[i] * t

def profile(spec, u):
    """Leaflet height along its ring arc: piecewise-linear through (u, height) knots."""
    k = np.array(spec); return np.interp(u, k[:, 0], k[:, 1])

# ---------------------------------------------------------------- atrioventricular valves

def mitral_curve(pts, angs, frame, sectors, p, ns=64):
    """The mitral closure line, chord by chord across the commissural axis: each chord perpendicular to the
    axis meets the anterior and posterior arcs; the two leaflets' published heights, less the coaptation
    zone, and the tenting depth split it (|AC|^2 + h^2 = (La - c)^2, |CB|^2 + h^2 = (Lp - c)^2).
    Returns s -> 2D closure point, and each ring point's s."""
    c, n, e1, e2 = frame
    to2 = lambda q: np.stack([(np.atleast_2d(q) - c) @ e1, (np.atleast_2d(q) - c) @ e2], -1)
    (_, a0, a1), (_, b0, b1) = sectors
    ua = np.linspace(0, 1, 300); ub = np.linspace(0, 1, 600)
    A = to2(np.array([ring_at(pts, angs, a0 + (a1 - a0) * u) for u in ua]))
    B = to2(np.array([ring_at(pts, angs, b0 + (b1 - b0) * u) for u in ub]))
    K0, K1 = A[0], A[-1]; ax = (K1 - K0) / np.linalg.norm(K1 - K0); L = np.linalg.norm(K1 - K0)
    perp = np.array([-ax[1], ax[0]])
    if (A[len(A) // 2] - K0) @ perp > 0: perp = -perp          # perp points from anterior to posterior
    sA, sB = (A - K0) @ ax / L, (B - K0) @ ax / L
    tB = (B - K0) @ perp
    S = np.linspace(0, 1, ns); C = []
    for s_ in S:
        ia = np.argmin(np.abs(sA - s_)); far = tB > tB.max() * 0.2
        ib = np.where(far)[0][np.argmin(np.abs(sB[far] - s_))] if 0.02 < s_ < 0.98 else (len(B) - 1 if s_ <= 0.02 else 0)
        Pa, Pb = A[ia], B[ib]; D = np.linalg.norm(Pb - Pa)
        La = profile(p['height']['anterior'], ua[ia]); Lb = profile(p['height']['posterior'], ub[ib])
        h = p['tenting'] * np.sin(np.pi * s_) ** 0.5; cz = p['coaptation'] * np.sin(np.pi * s_) ** 0.5
        la, lb = max(La - cz, 0.5), max(Lb - cz, 0.5)
        if la + lb < D: la, lb = la * D / (la + lb), lb * D / (la + lb)   # can't reach: meet where they can
        f = lambda x: np.sqrt(max(la**2 - h**2, 0)) * 0 + np.hypot(x, h) - np.hypot(D - x, h) - (la - lb)
        lo, hi = 0.0, D
        for _ in range(50):
            mid = (lo + hi) / 2; lo, hi = (mid, hi) if f(mid) < 0 else (lo, mid)
        C.append(Pa + (Pb - Pa) * (lo / max(D, 1e-6)))
    C = np.array(C)
    def at(q):
        s_ = np.clip((to2(q)[0] - K0) @ ax / L, 0, 1)
        return np.array([np.interp(s_, S, C[:, 0]), np.interp(s_, S, C[:, 1])]), s_
    return at


def av_valve(v, nu=40, nw=18):
    pts, angs, frame = H.ring(v); c, n, e1, e2 = frame
    sectors = sector_angles(v, frame); p = P[v]
    to2 = lambda q: np.stack([(q - c) @ e1, (q - c) @ e2], -1)
    K = [ring_at(pts, angs, a) for _, a, _ in sectors]             # commissures, in ring order
    # the meeting point O: for the mitral, on the line between the leaflets' midpoints, where the two
    # published heights split the chord; for the tricuspid, the centroid of the commissures pulled
    # towards the smallest leaflet as the published heights require
    mids = [ring_at(pts, angs, (a + b) / 2) for _, a, b in sectors]
    hts = [max(np.array(p['height'][nm])[:, 1]) for nm, _, _ in sectors]
    if len(sectors) == 2:
        A, B = mids; D = np.linalg.norm(to2(A) - to2(B)); h = p['tenting']; c_ = p['coaptation']
        la, lb = hts[0] - c_, hts[1] - c_
        f = lambda x: np.hypot(x, h) - np.hypot(D - x, h) - (la - lb)
        lo, hi = 0.0, D
        for _ in range(60):
            mid = (lo + hi) / 2; lo, hi = (mid, hi) if f(mid) < 0 else (lo, mid)
        O2 = to2(A) + (to2(B) - to2(A)) * (lo / D)
    else:
        w_ = 1 / np.array(hts); O2 = (np.array([to2(k) for k in K]) * 0 + np.array([to2(m) for m in mids])).T @ (1 / w_) / (1 / w_).sum()
        O2 = 0.5 * O2 + 0.5 * np.mean([to2(k) for k in K], 0)
    ring_h = lambda q: (q - c) @ n
    curve = mitral_curve(pts, angs, frame, sectors, p) if len(sectors) == 2 else None
    leaflets = []
    for li, (nm, a, b) in enumerate(sectors):
        Ka, Kb = K[li], K[(li + 1) % len(K)]
        L = profile(p['height'][nm], np.linspace(0, 1, nu))
        closed, opened = np.zeros((nu, nw, 3)), np.zeros((nu, nw, 3))
        # coaptation path for this leaflet: Ka -> O -> Kb, by arc length
        path = [to2(Ka), O2, to2(Kb)]; seg = [np.linalg.norm(path[1] - path[0]), np.linalg.norm(path[2] - path[1])]
        side = 1 if li == 0 else -1                               # which face of the coaptation zone it lies on
        for i, u in enumerate(np.linspace(0, 1, nu)):
            ang = a + (b - a) * u; Ap = ring_at(pts, angs, ang)
            if len(sectors) == 2:
                F2, sc = curve(Ap); hz = ring_h(Ka) * (1 - sc) + ring_h(Kb) * sc if li == 0 else ring_h(Kb) * (1 - sc) + ring_h(Ka) * sc
                tent = p['tenting'] * np.sin(np.pi * sc) ** 0.5
            else:
                s = u * sum(seg)
                F2 = path[0] + (path[1] - path[0]) * (s / seg[0]) if s <= seg[0] else path[1] + (path[2] - path[1]) * ((s - seg[0]) / seg[1])
                hz = ring_h(Ka) * (1 - u) + ring_h(Kb) * u
                tent = p['tenting'] * np.sin(np.pi * u) ** 0.5
            F = c + F2[0] * e1 + F2[1] * e2 + (hz + tent) * n
            span = np.linalg.norm(F - Ap)
            coapt = max(L[i] - span, p['min_coaptation'])
            # closed: ring -> free-edge line (slight belly towards the atrium), then straight into the ventricle
            ws = np.linspace(0, 1, nw); body = span / (span + coapt)
            for j, wv in enumerate(ws):
                if wv <= body:
                    t = wv / body; q = Ap + (F - Ap) * t - n * p['billow'] * np.sin(np.pi * t)
                else:
                    t = (wv - body) / (1 - body); q = F + n * coapt * t
                off = (Ap - F) - ((Ap - F) @ n) * n; off /= np.linalg.norm(off) + 1e-9   # towards its own ring
                closed[i, j] = q + off * (p['thickness'] / 2 + 0.15) * min(1.0, wv / body)
            # open: the leaflet hangs from its ring towards the apex, leaning in so the free edges bound the
            # published orifice
            radial = Ap - c - ((Ap - c) @ n) * n; radial /= np.linalg.norm(radial)
            lean = p['open_lean']
            d = n * np.cos(lean) - radial * np.sin(lean)
            Ltot = span + coapt
            for j, wv in enumerate(ws):
                bow = p['open_bow'] * np.sin(np.pi * wv)
                opened[i, j] = Ap + d * Ltot * wv + radial * bow
        # keep the two leaflets off each other in the coaptation zone: push each along its own face normal
        leaflets.append((nm, closed, opened, side))
    # orifice area of the open state (free-edge polygon projected on the valve plane) to tune open_lean
    edge = np.vstack([o[:, -1] for _, _, o, _ in leaflets]); e2d = to2(edge)
    order = np.argsort(np.arctan2(*(e2d - e2d.mean(0)).T[::-1])); poly = e2d[order]
    area = 0.5 * abs(np.dot(poly[:, 0], np.roll(poly[:, 1], 1)) - np.dot(poly[:, 1], np.roll(poly[:, 0], 1))) / 100
    return leaflets, sectors, area, (nu, nw)

# ---------------------------------------------------------------- semilunar valves

def wall_radius_map(v, frame, zmax):
    """The inside of the root's wall as a radius over (angle, height above the ring): for each bin, the
    nearest of the vessel's (and its ventricle's) surface points to the valve axis, smoothed round and up."""
    c, n, e1, e2 = frame
    q = np.vstack([H.walls()[k + '_v'] for k in (('aorta', 'lv') if v == 'av' else ('pa', 'rv'))]) - c
    z = q @ n; x, y = q @ e1, q @ e2; th = np.arctan2(y, x); r = np.hypot(x, y)
    na, nz = 48, int(zmax) + 3; R = np.full((na, nz), np.nan)
    ia = ((th + np.pi) / (2 * np.pi) * na).astype(int) % na; iz = np.round(z).astype(int)
    ok = (iz >= 0) & (iz < nz) & (r > 5) & (r < 30)
    for a_, z_, r_ in zip(ia[ok], iz[ok], r[ok]):
        if not (R[a_, z_] <= r_): R[a_, z_] = r_
    for j in range(nz):                                   # fill empty bins round each height, then up
        col = R[:, j]; good = ~np.isnan(col)
        if good.sum() > 3:
            ang = np.arange(na); R[~good, j] = np.interp(ang[~good], ang[good], col[good], period=na)
    for i in range(na):
        row = R[i]; good = ~np.isnan(row)
        if good.any(): R[i, ~good] = np.interp(np.where(~good)[0], np.where(good)[0], row[good])
    from scipy.ndimage import gaussian_filter
    R = gaussian_filter(np.r_[R[-4:], R, R[:4]], (2.0, 1.5))[4:-4]
    def f(a, z):
        u = (np.angle(np.exp(1j * a)) + np.pi) / (2 * np.pi) * na - 0.5
        i0 = int(np.floor(u)) % na; i1 = (i0 + 1) % na; t = u - np.floor(u)
        zz = np.clip(z, 0, nz - 1)
        return (1 - t) * np.interp(zz, np.arange(nz), R[i0]) + t * np.interp(zz, np.arange(nz), R[i1])
    return f

def sl_valve(v, nu=34, nw=16):
    pts, angs, frame = H.ring(v); c, n, e1, e2 = frame; p = P[v]
    wr = wall_radius_map(v, frame, p['commissure_height'] + 4)
    sectors = sector_angles(v, frame)
    zc, zcoapt = p['commissure_height'], p['coaptation_height']
    cusps = []
    for nm, a, b in sectors:
        closed, opened = np.zeros((nu, nw, 3)), np.zeros((nu, nw, 3))
        for i, u in enumerate(np.linspace(0, 1, nu)):
            ang = a + (b - a) * u
            z = zc * (2 * u - 1) ** 2 * 0.999                      # crown: commissures high, nadir on the ring
            r = wr(ang, z)
            dirr = np.cos(ang) * e1 + np.sin(ang) * e2
            A = c + n * z + dirr * (r + 0.3)                       # 0.3 mm into the wall
            # closed free edge: commissure -> centre -> commissure, along the two radial lines
            ca, cb = np.cos(a) * e1 + np.sin(a) * e2, np.cos(b) * e1 + np.sin(b) * e2
            rk = min(wr(a, zcoapt), wr(b, zcoapt))
            F = c + n * zcoapt + (ca * (1 - 2 * u) if u < 0.5 else cb * (2 * u - 1)) * rk * 0.97
            Lc = F - n * p['lunula']                               # bottom of the lunula, on the same line
            # open free edge: back near the wall, a little under the commissures
            Fo = c + n * (zc - p['open_drop']) + dirr * (r * p['open_radius'])
            Lo = Fo - n * p['lunula'] * 0.5
            ws = np.linspace(0, 1, nw); body = 0.78
            for j, wv in enumerate(ws):
                if wv <= body:
                    t = wv / body; sag = p['belly'] * np.sin(np.pi * t) * np.sin(np.pi * u)
                    closed[i, j] = A + (Lc - A) * t - n * sag
                    opened[i, j] = A + (Lo - A) * t + dirr * sag * 0.6
                else:
                    t = (wv - body) / (1 - body)
                    closed[i, j] = Lc + (F - Lc) * t; opened[i, j] = Lo + (Fo - Lo) * t
        cusps.append((nm, closed, opened, 0))
    return cusps, sectors, (nu, nw)

# ---------------------------------------------------------------- build

NAMES = {'mv': 'mitral valve', 'tv': 'tricuspid valve', 'av': 'aortic valve', 'pv': 'pulmonary valve'}
if __name__ == '__main__':
    out, meta = {}, {}
    for v in ['mv', 'tv', 'av', 'pv']:
        if v in ('mv', 'tv'):
            parts, sectors, area, (nu, nw) = av_valve(v)
            print(f'{v}: open orifice {area:.1f} cm2 (target {P[v]["open_area"]})')
        else:
            parts, sectors, (nu, nw) = sl_valve(v)
        print(f'{v}: sectors ' + ', '.join(f'{nm} {np.degrees((b - a) % (2 * np.pi)):.0f} deg' for nm, a, b in sectors))
        t = P[v]['thickness']
        for nm, closed, opened, side in parts:
            key = f'{v}_{nm.replace(" ", "_").replace("-", "_")}'
            vc, f = H.thicken(closed.reshape(-1, 3), t, nu, nw)
            vo, _ = H.thicken(opened.reshape(-1, 3), t, nu, nw)
            out[key + '_closed'], out[key + '_open'], out[key + '_f'] = vc.astype('f4'), vo.astype('f4'), f
            # chordal insertions (AV valves): free edge and rough zone on the ventricular face, every few columns
            ins = []
            if v in ('mv', 'tv'):
                for i in range(2, nu - 2, 3):
                    for j in (nw - 1, int(nw * 0.7)):
                        ins.append([i, j])
            meta[key] = {'name': f'{nm} {"leaflet" if v in ("mv", "tv") else "cusp"} of the {NAMES[v]}',
                         'valve': v, 'grid': [nu, nw], 'insertions': ins}
    np.savez_compressed('work/valves.npz', **out)
    json.dump(meta, open('work/valves.json', 'w'), indent=1)
