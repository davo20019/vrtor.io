"""How every part looks: per-vertex colour (linear RGB) and the epicardial fat, for parts.py.

Colours are those of a fresh adult heart (dissection and surgery photographs), not an atlas's red and blue:
myocardium dark red-brown under a glossy epicardium; epicardial fat yellow and lobulated, in the
atrioventricular and interventricular grooves and along every coronary vessel, where it lies in life; the
inside of the chambers (endocardium) paler and smoother; the great arteries' walls cream-pink; the veins' thin
walls dark purple; valves pale, chordae white. Every tissue varies in tone over a few scales (3D noise in the
tissue's own coordinates, so it moves with it).

Fat is geometry as well as colour: where it lies the outer surface is raised by up to 1.3 mm in lobules, so
the coronary vessels run half buried in it, as they do in a real heart.
"""
import numpy as np
from scipy.spatial import cKDTree

def srgb(h):
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

TISSUE = {
    'muscle_out': srgb('#6e1f1b'), 'muscle_in': srgb('#8c3b36'), 'atrium_out': srgb('#6a2226'),
    'fat': srgb('#c9973f'), 'fat_light': srgb('#ddb663'),
    'artery_wall': srgb('#c09079'), 'vein_wall': srgb('#4e2639'), 'valve': srgb('#e6d6b4'),
    'chordae': srgb('#efe9dc'), 'heart': srgb('#7a2722'), 'artery': srgb('#b9665a'), 'vein': srgb('#4a2445'),
}

def _hash(i, j, k, seed):
    h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0

def noise(X, scale, seed=0):
    """Smooth value noise in [0, 1], cells of `scale` mm."""
    q = X / scale; i = np.floor(q).astype(np.int64); f = q - i; f = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out

def fbm(X, scale, octaves=4, seed=0):
    v, a, tot = 0, 1.0, 0
    for o in range(octaves):
        v = v + a * noise(X, scale / 2 ** o, seed + o); tot += a; a *= 0.5
    return v / tot

def vary(base, X, amount, scale, seed):
    """A tissue's colour with its tone varying over scale mm and finer."""
    n = fbm(X, scale, 4, seed) - 0.5
    return np.clip(base[None] * (1 + amount * 2 * n)[:, None], 0, 1)

def paint(parts, outer_surface):
    """parts: id -> dict(v, meta). Returns id -> (colour n x 3, new vertices). outer_surface: (points, normals) of the
    heart's outside, to tell the outside of a wall from its inside."""
    OP, ON = outer_surface; OT = cKDTree(OP)
    # the fat is thickest along the main vessels in the grooves (atrioventricular and interventricular), thin
    # over the small branches running across the ventricles
    MAIN = ('Trunk', 'Circumflex', 'Coronary sinus', 'Great cardiac', 'Posterior interventricular', 'Middle cardiac',
            'Small cardiac', 'trunk of', 'Right coronary')
    is_main = lambda k: any(w.lower() in parts[k]['meta']['name'].lower() for w in MAIN)
    main = np.vstack([p['v'] for k, p in parts.items() if k.startswith('cor_') and is_main(k)])
    minor = np.vstack([p['v'] for k, p in parts.items() if k.startswith('cor_') and not is_main(k)])
    CTm, CTs = cKDTree(main), cKDTree(minor)
    out = {}
    for pid, p in parts.items():
        X = p['v']; t = p['meta']['tissue']; n = len(X)
        if p['meta']['group'] == 'walls':
            d, i = OT.query(X); outside = ((X - OP[i]) * ON[i]).sum(1) > -0.8
            outside &= d < 1.5
            base_out = TISSUE['atrium_out'] if t == 'atrium' else TISSUE['artery_wall'] if t == 'artery_wall' else TISSUE['muscle_out']
            col = np.where(outside[:, None], vary(base_out, X, 0.18, 14, 1), vary(TISSUE['muscle_in'], X, 0.12, 8, 2))
            # epicardial fat: along the coronary vessels (they run in the grooves) and over the base of the great
            # arteries, lobulated
            near = np.maximum(np.exp(-(CTm.query(X)[0] / 6.5) ** 2), 0.75 * np.exp(-(CTs.query(X)[0] / 2.2) ** 2))
            lob = fbm(X, 4.0, 3, 7)
            fat = np.clip((near * 1.3 + (lob - 0.5) * 0.7) - 0.55, 0, 1) * outside
            if t == 'artery_wall': fat *= 0.6
            fat = fat * fat * (3 - 2 * fat)
            fcol = TISSUE['fat'] * (1 - lob[:, None] * 0.6) + TISSUE['fat_light'] * (lob[:, None] * 0.6)
            col = col * (1 - fat[:, None]) + fcol * fat[:, None]
            Xn = X + ON[i] * (1.3 * fat * (0.6 + 0.8 * lob))[:, None]
            out[pid] = (col, Xn)
            continue
        if t in ('artery', 'vein'): col = vary(TISSUE[t], X, 0.15, 6, 3)
        elif t in ('artery_wall', 'vein_wall'): col = vary(TISSUE[t], X, 0.12, 12, 4)
        elif t == 'valve': col = vary(TISSUE['valve'], X, 0.08, 5, 5)
        elif t == 'chordae': col = vary(TISSUE['chordae'], X, 0.05, 4, 6)
        else: col = vary(TISSUE['muscle_in'] * 0.9, X, 0.12, 6, 8)
        out[pid] = (col, X)
    # creases darker (the light reaches less into them): concave mean curvature on each mesh
    import pyvista as pv
    for pid, (col, X) in out.items():
        f = parts[pid]['f']
        if len(f) < 50: continue
        k = pv.PolyData(X, np.hstack([np.full((len(f), 1), 3), f]).ravel()).curvature('mean')
        k = np.nan_to_num(k); shade = 1 - np.clip(-k * 1.2, 0, 0.35)
        out[pid] = (col * shade[:, None], X)
    return out
