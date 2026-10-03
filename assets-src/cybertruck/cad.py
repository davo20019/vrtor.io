"""Rigid parts of the Cybertruck, in millimetres, exported as STL to parts/, plus parts/geometry.json for assemble.py.

Frame: front faces +z, up +y, +x is the truck's left side. Origin on the ground, midway between the axles.
spec.md's s (distance back from the light bar), h (height) and w (half-width) map to z = ZF - s, y = h, x = w.

Every steel face of the truck is flat and the shell is convex apart from the arches and the bumpers, so the
shell is the intersection of half-spaces, one per facet (see spec.md, "Structure"). Uncertain sizes live in P
and are fitted to the photos by scripts/3d/fit_silhouette.py, which writes params.json.
"""
import json, math
from pathlib import Path
import numpy as np
from build123d import *

HERE = Path(__file__).parent
OUT = HERE / 'parts'
OUT.mkdir(exist_ok=True)

# Fixed, from Tesla's Owner's Manual (spec.md).
L, H = 5682.9, 1793.8
WB, OH_F = 3635.0, 878.3
CLEAR = 257.0
TRACK = 1772.0
HALF_W = 2031.6 / 2              # across the flares
MIRROR_HALF = 2413.3 / 2
TYRE_R, TYRE_W = 878.5 / 2, 285.0
RIM_R, RIM_W, RIM_ET = 254.0, 228.6, 58.5
ZF = OH_F + WB / 2               # light bar, z
ZR = ZF - L                      # rearmost point (the rear bumper), z; the tailgate is bumper_r_out further forward
AXLES = {'f': WB / 2, 'r': -WB / 2}

P = dict(
    nose_h=950.0, face_rake=60.0, bumper_f_h=520.0,
    cowl_s=1150.0, cowl_h=1410.0, apex_s=2400.0, tail_h=1337.0,
    belt_h_front=1150.0, belt_h_rear=1285.0, crease_h=480.0, tuck=60.0,
    flare_proud=35.0, nose_flat_half=760.0, corner_s=200.0, shoulder_drop=80.0,
    roof_half=650.0, tail_half=960.0,
    arch_top_h=980.0, arch_top_half=310.0, arch_knee_h=660.0, arch_foot_half=590.0, flare_band=75.0,
    bumper_r_h=600.0, bumper_r_out=60.0,
    rear_bar_h=60.0, front_bar_h=22.0,
    roofglass_end_s=3000.0, a_pillar_s=1420.0, c_pillar_s=3617.0,
    seam_1=1503.0, seam_2=2636.0, seam_3=3638.0,
    squash=15.0, cover_dish=15.0,
    win_margin=40.0, rocker_h=110.0, tab_drop=45.0, bumper_f_bot=330.0, bumper_r_bot=400.0,
)
PARAMS = HERE / 'params.json'
if PARAMS.exists():
    P.update(json.loads(PARAMS.read_text()))

def V(w, h, s):
    return np.array([w, h, ZF - s], float)

def save(part, name, tolerance=0.5, angular=0.3):
    export_stl(part, str(OUT / f'{name}.stl'), tolerance=tolerance, angular_tolerance=angular)

# ---------------------------------------------------------------- planes and the shell

INSIDE = V(0, 900, 2800)         # a point inside the cabin, to orient every plane outward

def plane3(a, b, c):
    """(point, outward normal) of the plane through a, b, c."""
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n)
    if np.dot(INSIDE - a, n) > 0:
        n = -n
    return a, n

def mirror(pl):
    p, n = pl
    return p * [-1, 1, 1], n * [-1, 1, 1]

def body_w(p):
    return HALF_W - p['flare_proud']

def planes(p):
    """The facets of the shell, as half-spaces. Named so other parts can sit on them."""
    BW = body_w(p)
    nh, nfh = p['nose_h'], p['nose_flat_half']
    LT = L - p['bumper_r_out']                     # tailgate, back from the light bar
    pl = {
        'bottom': (V(0, CLEAR, 0), np.array([0, -1.0, 0])),
        'rear': (V(0, 0, LT), np.array([0, 0, -1.0])),
        'face': plane3(V(0, nh, 0), V(1, nh, 0), V(0, p['bumper_f_h'], p['face_rake'])),
        'hood': plane3(V(0, nh, 0), V(1, nh, 0), V(0, p['cowl_h'], p['cowl_s'])),
        'roof': plane3(V(0, p['cowl_h'], p['cowl_s']), V(1, p['cowl_h'], p['cowl_s']), V(0, H, p['apex_s'])),
        'deck': plane3(V(0, H, p['apex_s']), V(1, H, p['apex_s']), V(0, p['tail_h'], LT)),
    }
    side = {
        'side': (V(BW, 0, 0), np.array([1.0, 0, 0])),
        'tuck': plane3(V(BW, p['crease_h'], 0), V(BW, p['crease_h'], 1), V(BW - p['tuck'], CLEAR, 0)),
        'window': plane3(V(BW, p['belt_h_front'], p['a_pillar_s']), V(BW, p['belt_h_rear'], p['c_pillar_s']),
                         V(p['roof_half'], H, p['apex_s'])),
        # The sail shares the crease from the roof corner at the apex down to the C-pillar base with the
        # window facet, so the two meet on that line: glass ahead of it, the steel sail behind.
        'sail': plane3(V(p['roof_half'], H, p['apex_s']), V(BW, p['belt_h_rear'], p['c_pillar_s']),
                       V(p['tail_half'], p['tail_h'], LT)),
        'corner': plane3(V(nfh, nh, 0), V(BW, nh, p['corner_s']), V(nfh, p['bumper_f_h'], p['face_rake'])),
        'shoulder': plane3(V(nfh, nh, 0), V(nfh, p['cowl_h'], p['cowl_s']), V(BW, nh - p['shoulder_drop'], 0)),
    }
    for k, v in side.items():
        pl[k + '_l'] = v
        pl[k + '_r'] = mirror(v)
    return pl

def halfspace_cut(part, pt, n, inset=0.0):
    return part.split(Plane(origin=tuple(pt - n * inset), z_dir=tuple(n)), keep=Keep.BOTTOM)

def hull(p, inset=0.0):
    """The convex shell: a big box cut by every facet plane (moved inward by inset)."""
    part = Box(2400, 2200, 6400, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, 0, (ZF + ZR) / 2)))
    for pt, n in planes(p).values():
        part = halfspace_cut(part, pt, n, inset)
    return part

def on_plane(pl, x=None, y=None, z=None):
    """Complete a point on a plane given two of its coordinates."""
    (p0, n), q = pl, [x, y, z]
    i = q.index(None)
    known = [k for k in range(3) if k != i]
    q[i] = p0[i] - sum(n[k] * (q[k] - p0[k]) for k in known) / n[i]
    return np.array(q, float)

def edge_point(a, b, z):
    """The point at depth z on the line where planes a and b meet."""
    (pa, na), (pb, nb) = a, b
    A = np.array([[na[0], na[1]], [nb[0], nb[1]]])
    r = np.array([np.dot(na, pa) - na[2] * z, np.dot(nb, pb) - nb[2] * z])
    x, y = np.linalg.solve(A, r)
    return np.array([x, y, z])

# ---------------------------------------------------------------- polygons on facets: pockets and panels

def basis(n):
    u = np.cross([0, 1, 0], n) if abs(n[1]) < 0.9 else np.cross([1, 0, 0], n)
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)

def inset_polygon(pts, n, d):
    """Move every edge of a convex planar polygon inward by d (a scalar or one value per edge)."""
    u, v = basis(n)
    q = [np.array([np.dot(p, u), np.dot(p, v)]) for p in pts]
    c = sum(q) / len(q)
    d = [d] * len(q) if np.isscalar(d) else d
    lines = []
    for i in range(len(q)):
        a, b = q[i], q[(i + 1) % len(q)]
        t = (b - a) / np.linalg.norm(b - a)
        m = np.array([-t[1], t[0]])
        if np.dot(c - a, m) < 0:
            m = -m
        lines.append((a + m * d[i], t))
    out = []
    for i in range(len(lines)):
        (a1, t1), (a2, t2) = lines[i - 1], lines[i]
        s = np.linalg.solve(np.array([t1, -t2]).T, a2 - a1)
        out.append(a1 + s[0] * t1)
    off = np.dot(pts[0], n)
    return [x[0] * u + x[1] * v + off * n for x in out]

def prism(pts, n, out=5.0, depth=10.0):
    """A solid from a planar polygon, from `out` outside its plane to `depth` inside."""
    w = Wire.make_polygon([tuple(p + n * out) for p in pts], close=True)
    return extrude(Face(w), amount=out + depth, dir=tuple(-n))

def recess(body, shell_in, pts, n, depth, gap=0.5, inset=1.0):
    """Cut a pocket of `pts` into the body and return (body, panel): the panel fills the pocket to `inset`
    below the surface, `gap` smaller all round, so no face of the panel lies on a face of the body."""
    body = body - prism(pts, n, depth=depth)
    panel = prism(inset_polygon(pts, n, gap), n, depth=depth - 0.2) & shell_in
    return body, panel

# ---------------------------------------------------------------- arches

def arch_polygon(p, axle_z, grow=0.0):
    """Outer outline of the arch flare in (z, y): flat top, angled sides, vertical legs to below the sill."""
    a, t, k, f = axle_z, p['arch_top_half'], p['arch_knee_h'], p['arch_foot_half']
    return [(a + f + grow, CLEAR - 120), (a + f + grow, k), (a + t + grow, p['arch_top_h'] + grow),
            (a - t - grow, p['arch_top_h'] + grow), (a - f - grow, k), (a - f - grow, CLEAR - 120)]

def arch_opening(p, axle_z, grow=0.0):
    """The hole inside the flare band: the outline moved in by flare_band on every edge but the bottom."""
    pts = [np.array([0, y, z]) for z, y in arch_polygon(p, axle_z)]
    b = p['flare_band'] - grow
    q = inset_polygon(pts, np.array([1.0, 0, 0]), [b, b, b, b, b, 0])
    return [(pt[2], pt[1]) for pt in q]

def side_prism(poly_zy, x0, x1):
    """Extrude a (z, y) outline along x from x0 to x1."""
    w = Wire.make_polygon([(x0, y, z) for z, y in poly_zy], close=True)
    return extrude(Face(w), amount=x1 - x0, dir=(1, 0, 0))

def both_sides(part):
    return part + part.mirror(Plane.YZ)

WELL_X = TRACK / 2 - TYRE_W / 2 - 60      # inner wall of the wheel wells

# ---------------------------------------------------------------- the parts

def shell(p):
    """Steel shell with arches cut, and nothing below the bumper tops ahead of the front arch and behind the
    rear arch: there the black bumpers and the underbody take over (c022, c069)."""
    body = hull(p)
    for az in AXLES.values():
        body = body - both_sides(side_prism(arch_opening(p, az, grow=1.0), WELL_X, 1300))
    zf = AXLES['f'] + p['arch_foot_half'] - 10
    body -= Box(2400, p['bumper_f_h'] - 6, ZF - zf + 100, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, 0, zf)))
    zr = AXLES['r'] - p['arch_foot_half'] + 10
    body -= Box(2400, p['bumper_r_h'] - 6, zr - ZR + 100, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, 0, zr)))
    return body


def cladding_parts(p):
    """Black parts by name: arch flares and sill rockers per side (with their end tabs), front and rear bumpers."""
    BW = body_w(p)
    out = {}
    above_ground = Box(2 * HALF_W + 20, 2000, 6400, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, CLEAR, 0)))
    for a, az in AXLES.items():
        band = side_prism(arch_polygon(p, az), BW - 40, HALF_W) - side_prism(arch_opening(p, az), BW - 60, HALF_W + 10)
        band = band & above_ground
        out[f'flare_{a}_l'], out[f'flare_{a}_r'] = band, band.mirror(Plane.YZ)
    zf = AXLES['f'] - p['arch_foot_half'] + p['flare_band'] * 0.5   # rocker runs between the arch legs
    zr = AXLES['r'] + p['arch_foot_half'] - p['flare_band'] * 0.5
    rb = CLEAR + p['tab_drop']
    rocker = [(zf, rb + p['rocker_h']), (zf, CLEAR), (zf - 120, rb), (zr + 120, rb), (zr, CLEAR), (zr, rb + p['rocker_h'])]
    xo = BW - p['tuck'] + 20
    r = side_prism(rocker, xo - 140, xo)
    out['rocker_l'], out['rocker_r'] = r, r.mirror(Plane.YZ)
    # Front bumper: the plan of the front face, below its bottom edge, with a chin raked back.
    nfh, cs, fr = p['nose_flat_half'], p['corner_s'], p['face_rake']
    zb = AXLES['f'] + p['arch_foot_half'] - 20             # wraps the corner back to the front arch
    xo = BW + 6                                              # stands just proud of the steel it covers
    plan = [(-xo, zb), (xo, zb), (xo, ZF - cs - fr + 10), (nfh, ZF - fr + 10), (-nfh, ZF - fr + 10), (-xo, ZF - cs - fr + 10)]
    w = Wire.make_polygon([(x, p['bumper_f_bot'], z) for x, z in plan], close=True)
    bf = extrude(Face(w), amount=p['bumper_f_h'] - p['bumper_f_bot'] - 1, dir=(0, 1, 0))
    chin = (V(0, p['bumper_f_bot'], fr + 60), np.array([0, -0.55, 0.835]))
    bf = halfspace_cut(bf, *chin)
    grille = Box(1250, 70, 60).moved(Location((0, p['bumper_f_bot'] + 110, ZF - fr + 10)))
    out['bumper_f'] = bf - grille
    # Rear bumper: stands out past the tailgate, centre step recess, lower valance with the hitch pocket.
    zt = ZR
    za = AXLES['r'] - p['arch_foot_half'] + 20               # wraps the corner forward to the rear arch
    plan = [(-xo, za), (xo, za), (xo, zt + 40), (xo - 65, zt), (-xo + 65, zt), (-xo, zt + 40)]
    w = Wire.make_polygon([(x, p['bumper_r_bot'], z) for x, z in plan], close=True)
    br = extrude(Face(w), amount=p['bumper_r_h'] - p['bumper_r_bot'], dir=(0, 1, 0))
    br = br - Box(560, 70, 90).moved(Location((0, p['bumper_r_h'] - 34, zt + 44)))
    val = Box(2 * BW - 300, p['bumper_r_bot'] - 300 + 1, 300, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, 300, zt + 210)))
    val = val - Box(180, 80, 60).moved(Location((0, 340, zt + 60)))
    out['bumper_r'] = br + val
    return out

def cladding(p):
    return list(cladding_parts(p).values())

def wheel_centre(p, axle, side):
    return np.array([side * TRACK / 2, TYRE_R - p['squash'], AXLES[axle]])

def mirror_part(p):
    """Left mirror: a black tent-shaped housing (side view: a triangle with rounded-off corners, peak in its
    front third; front view: narrower at the top), about 330 long and 170 tall (c059, c150), on a short
    stalk from the beltline at the front of the side glass. Outer edge on the published mirror span."""
    win = planes(p)['window_l']
    s = p['a_pillar_s'] + 230
    yb = p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    base = on_plane(win, y=yb + 25, z=ZF - s)
    x1, x0 = MIRROR_HALF, MIRROR_HALF - 135
    y0, zc = yb + 45, ZF - s
    side = [(zc + 165, y0), (zc + 150, y0 + 45), (zc + 60, y0 + 170), (zc + 20, y0 + 170), (zc - 165, y0 + 40), (zc - 165, y0)]
    housing = side_prism(side, x0, x1)
    # front view: the top leans inward, so cut the top-inner edge off
    housing = halfspace_cut(housing, np.array([x0, y0 + 170, zc]), np.array([-0.8, 0.6, 0.0]) / 1.0)
    stalk = Box(x0 - base[0] + 40, 45, 90).moved(Location(((x0 + base[0]) / 2, y0 + 15, zc - 40)))
    return housing + stalk

def wiper(p):
    """The single wiper, parked along the driver's (left) A-pillar on the windshield."""
    pl = planes(p)
    a = edge_point(pl['roof'], pl['window_l'], ZF - p['cowl_s'] - 80)
    b = edge_point(pl['roof'], pl['window_l'], ZF - p['cowl_s'] - 1150)
    n = pl['roof'][1]
    a, b = a + [-90, 0, 0], b + [-90, 0, 0]
    a, b = on_plane(pl['roof'], x=a[0], z=a[2]) + n * 14, on_plane(pl['roof'], x=b[0], z=b[2]) + n * 14
    d = b - a
    u = np.cross(d, n); u /= np.linalg.norm(u)
    pts = [a + u * 14, b + u * 9, b - u * 9, a - u * 14]
    return prism(pts, n, out=6, depth=6)

def panels(p):
    """Polygons sunk into the facets: name -> (points, outward normal, pocket depth, inset under the steel, kind)."""
    pl = planes(p)
    BW = body_w(p)
    m = p['win_margin']
    out = {}
    # Windshield and glass roof: the roof facet from the cowl to the apex, inside the A-pillars.
    za, zb = ZF - p['cowl_s'] - 30, ZF - p['apex_s'] + 40
    xa, xb = edge_point(pl['roof'], pl['window_l'], za)[0] - m, edge_point(pl['roof'], pl['window_l'], zb)[0] - m
    out['windshield'] = ([on_plane(pl['roof'], x=x, z=z) for x, z in ((xa, za), (xb, zb), (-xb, zb), (-xa, za))], pl['roof'][1], 8, 1.0, 'glass')
    # Rear roof glass and the tonneau on the deck, between the sails.
    def deck_poly(s0, s1, margin):
        q = []
        for s in (s0, s1):
            z = ZF - s
            x = min(edge_point(pl['deck'], pl['sail_l'], z)[0], edge_point(pl['deck'], pl['window_l'], z)[0]) - margin
            q.append((x, z))
        return [on_plane(pl['deck'], x=x, z=z) for x, z in (q[0], q[1], (-q[1][0], q[1][1]), (-q[0][0], q[0][1]))]
    out['rear_glass'] = (deck_poly(p['apex_s'] + 40, p['roofglass_end_s'], m), pl['deck'][1], 8, 1.0, 'glass')
    out['tonneau'] = (deck_poly(p['roofglass_end_s'] + 30, L - p['bumper_r_out'] - 25, 30), pl['deck'][1], 14, 2.0, 'tonneau')
    # Side glass (both windows and the black B-pillar, one panel): beltline up to the roof edge.
    def belt(s):
        return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    def top(s):
        z = ZF - s
        return min(edge_point(pl['roof'], pl['window_l'], z)[1], edge_point(pl['deck'], pl['window_l'], z)[1]) - m
    s0 = p['a_pillar_s']
    while top(s0) < belt(s0) + 15:
        s0 += 5
    side_pts = [(s0, belt(s0) + 12), (p['apex_s'], top(p['apex_s'])), (p['c_pillar_s'], top(p['c_pillar_s'])),
                (p['c_pillar_s'], belt(p['c_pillar_s']) + 12)]
    for key, sx in (('window_l', 1), ('window_r', -1)):
        pts = [on_plane(pl[key], y=h, z=ZF - s) for s, h in side_pts]
        out['side_glass_' + key[-1]] = (pts if sx > 0 else pts[::-1], pl[key][1], 8, 1.0, 'glass')
    # Front light strip: across the face just under the light bar edge, and down each corner facet.
    fb, nh, nfh = p['front_bar_h'], p['nose_h'], p['nose_flat_half']
    def face_pt(y, x):
        return on_plane(pl['face'], x=x, y=y)
    out['light_f'] = ([face_pt(nh - 3, -nfh + 2), face_pt(nh - 3, nfh - 2), face_pt(nh - 3 - fb, nfh - 2), face_pt(nh - 3 - fb, -nfh + 2)], pl['face'][1], 6, 1.0, 'light_w')
    for key, sx in (('corner_l', 1), ('corner_r', -1)):
        top_in = on_plane(pl[key], x=sx * (nfh + 2), y=nh - 3)
        top_out = on_plane(pl[key], x=sx * (BW - 15), y=nh - 3 - p['shoulder_drop'] * (BW - 15 - nfh) / (BW - nfh))
        pts = [top_in, top_out, top_out - [0, fb, 0], top_in - [0, fb, 0]]
        pts = [on_plane(pl[key], x=q[0], y=q[1]) for q in pts]
        out['light_f_' + key[-1]] = (pts if sx > 0 else pts[::-1], pl[key][1], 6, 1.0, 'light_w')
    # Rear light band across the top of the tailgate, and the red corner lights above the bumper.
    rb = p['rear_bar_h']
    zt = ZR + p['bumper_r_out']
    y1 = on_plane(pl['sail_l'], x=BW, z=zt)[1] - 8                 # just under the sail's lower corner
    out['light_r'] = ([np.array(q) for q in ((-BW + 6, y1, zt), (BW - 6, y1, zt), (BW - 6, y1 - rb, zt), (-BW + 6, y1 - rb, zt))], pl['rear'][1], 8, 1.0, 'light_r')
    for sx in (1, -1):
        x0, x1 = sx * (BW - 70), sx * (BW - 260)
        y0 = p['bumper_r_h'] + 12
        pts = [np.array(q) for q in ((x0, y0 + 32, zt), (x1, y0 + 32, zt), (x1, y0, zt), (x0, y0, zt))]
        out['light_r_' + ('l' if sx > 0 else 'r')] = (pts if sx > 0 else pts[::-1], pl['rear'][1], 6, 1.0, 'light_r')
    return out

def tyre_cylinder(p, axle, side):
    return Cylinder(TYRE_R, TYRE_W, rotation=(0, 90, 0)).moved(Location(tuple(wheel_centre(p, axle, side))))

# Which dark parts each kind of photo sees on the steel (fit_silhouette.py paints steel, then these on top).
VIEW_DARK = {
    'left': ['flare_f_l', 'flare_r_l', 'rocker_l', 'bumper_f', 'bumper_r', 'side_glass_l', 'windshield', 'rear_glass',
             'tyre_fl', 'tyre_rl', 'mirror_l', 'well_f_l', 'well_r_l'],
    'front': ['bumper_f', 'windshield', 'side_glass_l', 'side_glass_r', 'flare_f_l', 'flare_f_r', 'tyre_fl', 'tyre_fr',
              'mirror_l', 'mirror_r'],
    'rear': ['bumper_r', 'tonneau', 'light_r', 'rear_glass', 'flare_r_l', 'flare_r_r', 'tyre_rl', 'tyre_rr'],
}
VIEW_DARK['right'] = ['flare_f_r', 'flare_r_r', 'rocker_r', 'bumper_f', 'bumper_r', 'side_glass_r', 'windshield', 'rear_glass',
                      'tyre_fr', 'tyre_rr', 'mirror_r', 'well_f_r', 'well_r_r']

def fit_parts(p=P):
    """Named solids for fit_silhouette.py: the steel shell and every dark part, unioned nowhere."""
    parts = {'steel': shell(p)}
    parts.update(cladding_parts(p))
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        if kind in ('glass', 'tonneau', 'light_r'):
            parts[name] = prism(pts, n, out=1.5, depth=0.5)     # a sheet just proud of the facet, painted over the steel
    m = mirror_part(p)
    parts['mirror_l'], parts['mirror_r'] = m, m.mirror(Plane.YZ)
    BW = body_w(p)
    for a, az in AXLES.items():
        for s, side in ((1, 'l'), (-1, 'r')):
            parts[f'tyre_{a}{side}'] = tyre_cylinder(p, a, s)
            well = side_prism(arch_opening(p, az), BW - 2, BW - 1)  # the dark wheel well seen through the arch
            parts[f'well_{a}_{side}'] = well if s > 0 else well.mirror(Plane.YZ)
    return parts

def silhouette_solid(p=P):
    """Everything that shapes the outline seen in a photo (no union, just a compound)."""
    parts = [shell(p)] + cladding(p) + [both_sides(mirror_part(p))]
    parts += [tyre_cylinder(p, a, s) for a in AXLES for s in (1, -1)]
    return Compound(parts)

def landmarks(p=P):
    """Named points (mm) a photo can pin: wheel centres and the light bar centre."""
    lm = {f'wheel_{a}{"l" if s > 0 else "r"}': wheel_centre(p, a, s).tolist() for a in AXLES for s in (1, -1)}
    for a in AXLES:                  # where each tyre's outer sidewall meets the ground
        for s in (1, -1):
            lm[f'contact_{a}{"l" if s > 0 else "r"}'] = [s * (TRACK / 2 + TYRE_W / 2), 0.0, AXLES[a]]
    lm['lightbar'] = V(0, p['nose_h'] - p['front_bar_h'] / 2, 0).tolist()
    return lm

# ---------------------------------------------------------------- wheels (built for the left side: outboard = +x, centred on the axle)

SPOKES = 7

def tyre():
    r0, r1, hw = RIM_R + 4, TYRE_R, TYRE_W / 2
    prof = [(r0, -hw + 28), (r0 + 70, -hw), (r1 - 95, -hw - 4), (r1 - 30, -hw + 6), (r1, -hw + 30),
            (r1, hw - 30), (r1 - 30, hw - 6), (r1 - 95, hw + 4), (r0 + 70, hw), (r0, hw - 28)]
    w = Wire.make_polygon([(x, r, 0) for r, x in prof], close=True)
    return revolve(Face(w), Axis.X, 360)

def yz_prism(pts, x0, depth):
    """Extrude a polygon given in the wheel's face plane, (y, z) points, from x0 outward by depth."""
    w = Wire.make_polygon([(x0, y, z) for y, z in pts], close=True)
    return extrude(Face(w), amount=depth, dir=(1, 0, 0))

def polar(r, a):
    return (r * math.cos(a), r * math.sin(a))

def rim():
    """20 x 9J: barrel and flanges, then a face of seven Y-spokes on a seven-sided hub, six lug nuts.
    Built from positive parts (hub, spokes, outer ring) so every spoke edge is clean (c025, c143)."""
    hw = RIM_W / 2
    barrel = Cylinder(RIM_R + 2, RIM_W, rotation=(0, 90, 0)) - Cylinder(RIM_R - 14, RIM_W + 2, rotation=(0, 90, 0))
    for sx in (1, -1):
        barrel += (Cylinder(RIM_R + 14, 12, rotation=(0, 90, 0)) - Cylinder(RIM_R - 14, 14, rotation=(0, 90, 0))).moved(Location((sx * (hw - 6), 0, 0)))
    xf = RIM_ET + 20                                   # back of the spoke face
    ring = Cylinder(RIM_R - 2, 22, rotation=(0, 90, 0)).moved(Location((xf + 11, 0, 0))) - Cylinder(RIM_R - 34, 30, rotation=(0, 90, 0)).moved(Location((xf + 11, 0, 0)))
    step = 2 * math.pi / SPOKES
    hub_pts = [polar(108, k * step) for k in range(SPOKES)]
    face = ring + yz_prism(hub_pts, xf, 30)
    for k in range(SPOKES):
        a = k * step
        stem = [polar(90, a - 0.24), polar(175, a - 0.16), polar(175, a + 0.16), polar(90, a + 0.24)]
        face += yz_prism(stem, xf + 2, 24)
        for s in (-1, 1):                              # the two arms of the Y, meeting the ring
            arm = [polar(165, a + s * 0.03), polar(165, a + s * 0.17), polar(RIM_R - 26, a + s * 0.27), polar(RIM_R - 26, a + s * 0.12)]
            face += yz_prism(arm, xf + 2, 22)
    lugs = Compound([Cylinder(11, 22, rotation=(0, 90, 0)).moved(Location((xf + 41, *polar(70, i * math.pi / 3)))) for i in range(6)])
    return barrel + face, lugs

COVER_X = RIM_ET + 20 + 30 + 24                        # outboard of the lug nuts

def cover():
    """Aero cover: a flat disc over the whole rim with six raised radial blades and a hexagonal boss
    (c003, c057, the studio video)."""
    disc = Cylinder(RIM_R + 8, 10, rotation=(0, 90, 0)).moved(Location((COVER_X + 5, 0, 0)))
    parts = [disc, yz_prism([polar(78, k * math.pi / 3 + math.pi / 6) for k in range(6)], COVER_X + 10, 14)]
    for k in range(6):
        a = k * math.pi / 3
        blade = [polar(70, a - 0.10), polar(RIM_R - 4, a - 0.07), polar(RIM_R - 4, a + 0.07), polar(70, a + 0.10)]
        parts.append(yz_prism(blade, COVER_X + 10, 8))
    return Compound(parts)

def brake():
    disc = Cylinder(190, 32, rotation=(0, 90, 0)).moved(Location((5, 0, 0))) - Cylinder(80, 40, rotation=(0, 90, 0))
    cal = Box(70, 110, 230).moved(Location((5, 165, -60)))
    return disc, cal

# ---------------------------------------------------------------- interior (so a visitor can sit inside)
# Measured on the Owner's Manual's CAD renders where they show it (spec.md, "Interior, measured"); every
# size that no picture constrains is listed there as a guess. Coordinates in spec.md's s (back from the light
# bar), h (height) and w (half-width, +left); the helpers below turn outlines in those into solids. Shapes
# are flat facets, like the real interior's, and cheap in triangles.

CAB = dict(floor=400.0, wall=60.0, trim_t=110.0, cab_front_s=1250.0, cab_rear_s=3700.0,
           h_front=(2200.0, 771.0), h_rear=(3150.0, None), seat_x=390.0, dash_h=1224.0, dash_s=1480.0,
           yoke=(1683.0, 1150.0), yoke_w=318.0, yoke_hgt=212.0, yoke_tilt=22.0, screen_y=1160.0, screen_s=1510.0,
           screen_tilt=7.0, arm=(1696.0, 2084.0, 940.0), console_end_s=2600.0, door_arm_h=943.0, back_h=940.0,
           head_rear=991.9, head_front=1058.8, hip_half=1453.4 / 2, shoulder_front=1608.0 / 2,
           shoulder_rear=1576.4 / 2, header=(1739.0, 1905.0))

def Z(s):
    return ZF - s

def SH(pts, x0, x1):
    """A polygon in (s, h), extruded across x from x0 to x1."""
    return side_prism([(Z(s), h) for s, h in pts], x0, x1)

def XH(pts, s0, s1):
    """A polygon in (x, h), extruded along the truck from s0 to s1 (s0 < s1)."""
    w = Wire.make_polygon([(x, h, Z(s1)) for x, h in pts], close=True)
    return extrude(Face(w), amount=s1 - s0, dir=(0, 0, 1))

def XS(pts, h0, h1):
    """A polygon in plan (x, s), extruded up from h0 to h1."""
    w = Wire.make_polygon([(x, h0, Z(s)) for x, s in pts], close=True)
    return extrude(Face(w), amount=h1 - h0, dir=(0, 1, 0))

def ngon(xc, sc, r, k=8, rot=0.0):
    return [(xc + r * math.cos(rot + 2 * math.pi * i / k), sc + r * math.sin(rot + 2 * math.pi * i / k)) for i in range(k)]

def plane_cut(part, a, b, c, keep_from):
    """Keep the side of the plane through a, b, c (model-frame points) that holds the point keep_from."""
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n)
    if np.dot(keep_from - a, n) > 0:
        n = -n
    return halfspace_cut(part, a, n)

def belt_h(p, s):
    return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])

def roof_inner_h(p, s, inset):
    """Height of the cabin's ceiling (the roof or deck facet moved in by `inset`) on the centreline at s."""
    pl = planes(p)
    pts = []
    for k in ('roof', 'deck'):
        pt, n = pl[k]
        pts.append(on_plane((pt - n * inset, n), x=0, z=Z(s))[1])
    return min(pts)

def rear_h_point(p):
    """The rear H-point height from the published rear head room (SAE H63): the distance from the H-point to
    the headliner along a line 8 degrees behind vertical, plus 102 mm."""
    c = CAB
    s = c['h_rear'][0]
    a = math.radians(8)
    def from_head_room(s, head):
        run = head - 102.0
        return roof_inner_h(p, s + run * math.sin(a), c['wall'] + 12) - run * math.cos(a)
    # The same rule gives the front H-point 26 mm below the one measured on the seat render (771): correct
    # the rear by the front's error, so both rows share the measured seat.
    return from_head_room(s, c['head_rear']) + (c['h_front'][1] - from_head_room(c['h_front'][0], c['head_front']))

def cavity(p):
    """The cabin volume cut out of the shell: the hull moved in by the wall thickness, from the firewall
    to the cab's back wall, above the floor, minus the front wheel wells."""
    c = CAB
    inner = hull(p, inset=c['wall'])
    box = Box(2400, 2000, c['cab_rear_s'] - c['cab_front_s'], align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, c['floor'], ZF - c['cab_front_s'])))
    cav = inner & box
    well = both_sides(side_prism(arch_polygon(p, AXLES['f'], grow=40), WELL_X - 50, 1300))
    return cav - well

def through_holes(p):
    """Behind every glass panel, open the shell from the glass's inner face into the cabin."""
    holes = []
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        if kind == 'glass':
            holes.append(prism(inset_polygon(pts, n, 3.0), n, out=-(depth - 1.0), depth=320))   # starts above the pocket floor, so it removes it
    return holes

def ceiling_band(p, t0, t1):
    """The layer between t0 and t1 mm inside the shell's inner face (for headliner and pillar trim)."""
    c = CAB
    return hull(p, inset=c['wall'] + t0) - hull(p, inset=c['wall'] + t1)

def edge_wedge(p, ka, kb, reach):
    """The part of space within `reach` of the crease between facets ka and kb, measured inward along their
    bisector: an A-pillar or roof rail's trim follows that crease."""
    pl = planes(p)
    (pa, na), (pb, nb) = pl[ka], pl[kb]
    bis = (na + nb) / np.linalg.norm(na + nb)
    e = edge_point(pl[ka], pl[kb], 0.0)
    big = Box(4000, 4000, 8000).moved(Location((0, 0, 0)))
    return halfspace_cut(big, e - bis * (c_wall() + reach), -bis)

def c_wall():
    return CAB['wall']

def front_seat(xc, outboard):
    """One front seat at lateral centre xc: the shell is the intersection of its side and front outlines
    (manual-seats-170452D8 at 4.58 mm/px, manual-seats-71D65904), so every face is flat as on the real seat."""
    side = [(2290, 690), (2447, 675), (2493, 812), (2626, 1316), (2600, 1408), (2572, 1500), (2531, 1591),
            (2481, 1637), (2462, 1637), (2436, 1590), (2425, 1225), (2300, 760)]
    # Widest at the shoulders, then straight sides tapering into the integrated headrest (71D65904).
    front = [(-245, 680), (245, 680), (262, 1000), (268, 1150), (185, 1420), (160, 1560), (120, 1637),
             (-120, 1637), (-160, 1560), (-185, 1420), (-268, 1150), (-262, 1000)]
    back = SH(side, xc - 300, xc + 300) & XH([(xc + x, h) for x, h in front], 2260, 2650)
    # The centre insert sits 45 mm behind the bolsters' front faces, between them, up to the shoulders.
    insert = SH([(2345, 760), (2470, 1225), (2470, 1250), (2100, 1250), (2100, 700), (2345, 700)], xc - 150, xc + 150)
    back = back - insert
    cushion_side = [(1765, 645), (1765, 742), (1800, 760), (2300, 716), (2310, 645)]
    cushion_front = [(-262, 645), (262, 645), (266, 752), (228, 772), (196, 738), (-196, 738), (-228, 772), (-266, 752)]
    cushion = SH(cushion_side, xc - 300, xc + 300) & XH([(xc + x, h) for x, h in cushion_front], 1750, 2320)
    base = SH([(1785, 646), (1800, 495), (2440, 485), (2470, 646)], xc - 250, xc + 250)
    stand = XS([(xc - 180, 1850), (xc + 180, 1850), (xc + 180, 2420), (xc - 180, 2420)], CAB['floor'] - 2, 488)
    knobs = []                                            # the three adjustment controls on the outboard side
    xo = xc + outboard * 251
    for s0, s1, h0, h1 in ((1880, 1940, 585, 600), (1955, 1972, 570, 610), (1980, 2010, 575, 605)):
        knobs.append(Box(10, h1 - h0, s1 - s0).moved(Location((xo + outboard * 3, (h0 + h1) / 2, Z((s0 + s1) / 2)))))
    return {'seat': [back, cushion], 'seat_base': [base, stand], 'switch': knobs}

def rear_bench(p):
    """Three places: two outboard and a narrower centre one whose lower back is the fold-down armrest
    (manual-childseats-FF29F441 and -EC916D67 from the front, -D8CE20B2 from the side: backrest 21 degrees)."""
    c = CAB
    sR = c['h_rear'][0]
    hR = rear_h_point(p)
    a = math.radians(21)
    d = np.array([math.sin(a), math.cos(a)])            # up the backrest, (s, h)
    nrm = np.array([math.cos(a), -math.sin(a)])         # into the backrest, rearward
    A = np.array([sR + 95, hR - 45])
    top = hR + 830
    L = (top - A[1]) / d[1]
    t = 110.0
    side = [tuple(A), tuple(A + d * L), tuple(A + d * L + nrm * t), tuple(A + nrm * t + [0, -40]), tuple(A + [0, -40])]
    places = [(-445, 500), (0, 380), (445, 500)]          # centre and width of each place
    out = {'seat': [], 'seat_base': [], 'armrest_r': []}
    for xc, w in places:
        hw, hh = w / 2 - 3, (130 if xc else 100)
        # Back up to the shoulders, then a separate headrest 25 mm above it with chamfered top corners
        # (manual-childseats-FF29F441).
        frontl = [(-hw, A[1] - 40), (hw, A[1] - 40), (hw, hR + 560), (hw - 40, hR + 600), (-hw + 40, hR + 600), (-hw, hR + 560)]
        back = SH(side, xc - hw - 5, xc + hw + 5) & XH([(xc + x, h) for x, h in frontl], sR - 50, sR + 700)
        rest = [(-hh, hR + 625), (hh, hR + 625), (hh, top - 40), (hh - 40, top), (-hh + 40, top), (-hh, top - 40)]
        back += SH(side, xc - hw - 5, xc + hw + 5) & XH([(xc + x, h) for x, h in rest], sR - 50, sR + 700) - SH(
            [tuple(A + d * ((hR + 625 - A[1]) / d[1]) + [-200, 0]), tuple(A + d * L + [-200, 0]), tuple(A + d * L + nrm * 45), tuple(A + d * ((hR + 625 - A[1]) / d[1]) + nrm * 45)],
            xc - hw - 5, xc + hw + 5)                    # the headrest is thinner than the back: 65 mm
        hw_in = hw - 70
        if xc:                                             # outboard places: bolsters either side of a recessed insert
            q0, q1 = A + d * 20, A + d * ((hR + 540 - A[1]) / d[1])
            back -= SH([tuple(q0 + nrm * 30), tuple(q1 + nrm * 30), tuple(q1 + [-200, 0]), tuple(q0 + [-200, 0])], xc - hw_in, xc + hw_in)
        if xc == 0:                                        # the stowed armrest fills a slot in the centre back
            slot_lo, slot_hi = A[1] + 5, A[1] + 420
            pa, pb = A + d * ((slot_lo - A[1]) / d[1]), A + d * ((slot_hi - A[1]) / d[1])
            slot = SH([tuple(pa + [-60, 0]), tuple(pb + [-60, 0]), tuple(pb + nrm * 75), tuple(pa + nrm * 75)], -153, 153)
            back = back - slot
            arm = SH([tuple(pa + [-60, 2]), tuple(pb + [-60, -2]), tuple(pb + nrm * 74 + [0, -2]), tuple(pa + nrm * 74 + [0, 2])], -150, 150)
            out['armrest_r'].append(arm)
        out['seat'].append(back)
        cush = SH([(sR - 430, hR - 130), (sR - 430, hR - 28), (sR - 400, hR - 18), (sR + 90, hR - 45), (sR + 100, hR - 130)],
                  xc - hw, xc + hw)
        out['seat'].append(cush)
    out['seat_base'].append(SH([(sR - 410, c['floor'] - 2), (sR - 410, hR - 128), (sR + 300, hR - 128), (sR + 300, c['floor'] - 2)], -700, 700))
    return out, hR

def yoke_parts():
    """The yoke, built facing +z around its centre (manual-steering-E2AF1DEC straight on, 0.848 mm/px from the
    318 mm width measured through the dash render's camera): rim, spoke band, V-shaped centre pad with its
    lower chin, and the two angled button pods with their scroll wheels. No logo."""
    w, h = CAB['yoke_w'], CAB['yoke_hgt']
    T = 32.0
    with BuildSketch() as sk:
        RectangleRounded(w, h, 58)
        with Locations((0, 61)):
            RectangleRounded(252, 46, 18, mode=Mode.SUBTRACT)
    rim = extrude(sk.sketch, amount=T)
    for sx in (1, -1):                                  # the two openings below the spokes
        hole = [(sx * 128, -10), (sx * 58, -14), (sx * 36, -86), (sx * 120, -88), (sx * 136, -50)]
        rim -= extrude(Face(Wire.make_polygon([(x, y, -1) for x, y in hole], close=True)), amount=T + 2, dir=(0, 0, 1))
    try:
        rim = chamfer(rim.edges().filter_by(Axis.Z, reverse=True), length=7)
    except Exception:
        pass
    # Spoke band across the middle, then the pad on it; the pad is a V: wide at the top, narrow at the chin.
    band = extrude(Face(Wire.make_polygon([(-135, 38, 0), (135, 38, 0), (128, -8, 0), (60, -12, 0), (40, -62, 0),
                                           (-40, -62, 0), (-60, -12, 0), (-128, -8, 0)], close=True)), amount=T + 6, dir=(0, 0, 1))
    pad = extrude(Face(Wire.make_polygon([(-68, 44, 0), (68, 44, 0), (38, -60, 0), (-38, -60, 0)], close=True)), amount=T + 22, dir=(0, 0, 1))
    try:
        pad = chamfer(pad.edges().filter_by(Axis.Z, reverse=True).group_by(Axis.Z)[-1], length=8)
    except Exception:
        pass
    chin = extrude(Face(Wire.make_polygon([(-40, -62, 0), (40, -62, 0), (30, -96, 0), (-30, -96, 0)], close=True)), amount=T + 14, dir=(0, 0, 1))
    pods, wheels = [], []
    for sx in (1, -1):
        pod = [(sx * 62, 34), (sx * 118, 30), (sx * 134, 10), (sx * 122, -10), (sx * 66, -12)]
        pods.append(extrude(Face(Wire.make_polygon([(x, y, 0) for x, y in pod], close=True)), amount=T + 12, dir=(0, 0, 1)))
        wheels.append(Cylinder(8, 11, rotation=(0, 90, 0)).moved(Location((sx * 88, 12, T + 12))))
    return rim + band + pad, chin, Compound(pods), Compound(wheels)

def door_trim(p, d, sx, driver):
    """Trim on one door's inside (d 'f' or 'r', sx +1 left / -1 right), from the video frames
    (dgRcedIkNOM-12, -17, -45) and the manual (Windows: four switches on the driver's door): a black cap under
    the glass with the ambient line beneath it, a white upper panel of two facets meeting on a diagonal crease
    (the front door's falls toward the back, the rear door's toward the front), the armrest with its pull
    pocket and switch pod, and the dark lower panel with its speaker grille. The armrest's face is set by the
    published hip room, the crease by the shoulder room."""
    c = CAB
    s0, s1 = door_spans(p)[d]
    s0, s1 = s0 + 12, s1 - 12
    xw = body_w(p) - c['wall'] + 3                      # 3 mm into the shell's inner face
    hip = c['hip_half']
    sh = c['shoulder_front'] if d == 'f' else c['shoulder_rear']
    ya = c['door_arm_h']
    out = {}
    bt0, bt1 = belt_h(p, s0) - 34, belt_h(p, s1) - 34
    lower = XH([(xw, c['floor'] + 25), (hip + 33, c['floor'] + 25), (hip + 33, 640), (hip, 720), (hip, 872), (xw, 872)], s0, s1)
    out['door_lower'] = [lower]
    arm_s0 = s0 + (110 if d == 'f' else 70)
    arm_s1 = s1 - (60 if d == 'f' else 250)
    arm = XH([(xw, 868), (hip, 868), (hip - 27, 892), (hip - 27, ya - 8), (hip - 19, ya), (xw, ya)], arm_s0, arm_s1)
    arm = arm & SH([(arm_s0, 860), (arm_s1, 860), (arm_s1, ya + 1), (arm_s0 + 70, ya + 1)], 0, 2000)
    pocket = XS([(hip - 15, arm_s0 + 190), (hip + 40, arm_s0 + 190), (hip + 40, arm_s0 + 360), (hip - 15, arm_s0 + 360)], 900, ya + 5)
    out['armrest'] = [arm - pocket]
    pod_s0 = arm_s0 + 75
    pod = SH([(pod_s0, ya - 2), (pod_s0 + 105, ya - 2), (pod_s0 + 105, ya + 16), (pod_s0 + 12, ya + 12)], hip - 22, hip + 70)
    out['switch_pod'] = [pod]
    keys = []
    cols = (hip - 4, hip + 30) if driver else (hip + 13,)
    rows = (pod_s0 + 25, pod_s0 + 68) if driver else (pod_s0 + 45,)
    for x in cols:
        for s in rows:
            hk = ya + 12 + 4 * (s - pod_s0) / 105 + 3
            keys.append(Box(26, 6, 34).moved(Location((x, hk, Z(s)))))
    out['switch'] = keys
    out['open'] = [Box(24, 8, 30).moved(Location((hip + 15, ya + 3, Z(arm_s0 + 160))))]   # the door-open button, ahead of the pull pocket
    white = SH([(s0, ya - 2), (s1, ya - 2), (s1, bt1), (s0, bt0)], hip - 40, xw)
    # Crease: front door from high at the front to low at the back; rear door the other way (a chevron).
    hc_hi, hc_lo = (lambda s: belt_h(p, s) - 70), ya + 25
    c0 = np.array([sh + 2, hc_hi(s0) if d == 'f' else hc_lo, Z(s0)])
    c1 = np.array([sh + 2, hc_lo if d == 'f' else hc_hi(s1), Z(s1)])
    # Each facet's third point is the corner the crease leaves: bottom-front and top-rear on the front door.
    lo_s, hi_s = (s0, s1) if d == 'f' else (s1, s0)
    out_pt = np.array([2000, 1000, Z((s0 + s1) / 2)])
    white = plane_cut(white, c0, c1, np.array([sh + 32, ya, Z(lo_s)]), out_pt)                       # lower facet
    white = plane_cut(white, c0, c1, np.array([sh + 60, belt_h(p, hi_s) - 34, Z(hi_s)]), out_pt)       # upper facet
    out['trim_white'] = [white]
    out['cap'] = [SH([(s0, bt0 + 3), (s1, bt1 + 3), (s1, belt_h(p, s1) + 6), (s0, belt_h(p, s0) + 6)], sh + 10, xw)]
    out['ambient'] = [SH([(s0 + 4, bt0 - 0.5), (s1 - 4, bt1 - 0.5), (s1 - 4, bt1 + 3.5), (s0 + 4, bt0 + 3.5)], sh + 12, sh + 40)]
    if d == 'f':
        g = [(s0 + 50, 470), (s0 + 330, 470), (s0 + 300, 640), (s0 + 50, 640)]
    else:
        g = [(s0 + 40, 480), (s0 + 230, 480), (s0 + 210, 600), (s0 + 40, 600)]
    out['grilles'] = [SH(g, hip + 30, hip + 36)]
    if sx < 0:
        out = {k: [q.mirror(Plane.YZ) for q in v] for k, v in out.items()}
    return out

def interior(p):
    """Fixed interior parts by name -> solid, and door-mounted ones as 'door_<k>_<name>'. assemble.py gives
    each name its material (INTERIOR there)."""
    c = CAB
    out = {}
    inner = hull(p, inset=c['wall'] + 2)
    well = both_sides(side_prism(arch_polygon(p, AXLES['f'], grow=40), WELL_X - 60, 1300))
    regions = door_regions(p)
    pl = planes(p)
    def fixed(part):
        rest, _ = split_doors(part, regions)               # whatever reaches into a door's opening stays out of it
        return rest
    # ---- dash. The shelf: a dark slab rising from its front lip (1,224 high, 1,480 back) to the windshield.
    d0, d1 = c['cab_front_s'] - 80, c['dash_s']
    front = on_plane(pl['roof'], x=0, z=ZF - p['cowl_s'] - 40)[1] - c['wall'] - 25
    top = plane3(V(0, c['dash_h'], d1), V(1, c['dash_h'], d1), V(0, front, d0))
    if top[1][1] < 0:
        top = (top[0], -top[1])
    slab = Box(2400, 600, d1 - d0, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, 700, ZF - d0)))
    shelf = halfspace_cut(slab, *top) - halfspace_cut(slab, top[0] - top[1] * 40, top[1])
    out['dash_top'] = fixed(shelf & inner)
    # Under the lip (video frames dgRcedIkNOM-14, -16; manual dash render): a recessed grey face holding the
    # vent slot, the ambient line, then the white block (chamfered top, front face, chamfered bottom; 130 high,
    # spec.md), then the dark lower dash with the glovebox on the passenger side.
    def across(poly):
        return fixed((SH(poly, -1300, 1300) & inner) - well)
    grey = across([(1468, 1205), (1300, 1205), (1300, 1158), (1468, 1158)])
    grey -= SH([(1446, 1180), (1500, 1180), (1500, 1190), (1446, 1190)], -1300, 1300)       # the vent slot, 22 deep
    out['dash_face'] = grey
    out['dash_vent'] = across([(1430, 1179.5), (1447, 1179.5), (1447, 1190.5), (1430, 1190.5)])
    out['ambient'] = across([(1440, 1157.5), (1469, 1157.5), (1469, 1161.5), (1440, 1161.5)])
    out['dash_white'] = across([(1467, 1159), (1488, 1118), (1492, 1062), (1462, 1028), (1300, 1028), (1300, 1159)])
    lower = across([(1462, 1029), (1430, 880), (1390, 700), (1170, 700), (1170, 1029)])
    glove = SH([(1300, 1012), (1520, 1012), (1520, 860), (1300, 860)], -700, -262) - SH([(1290, 1009), (1530, 1009), (1530, 863), (1290, 863)], -697, -265)
    out['dash_lower'] = lower - glove                    # the glovebox's outline, a 3 mm groove
    # 18.5 in screen, landscape, centred on the truck, leaning back 7 degrees (seat side view; the dash render's
    # camera fits better with it than with 15); its face carries screen.png.
    a = c['screen_tilt']
    scr_c = np.array([0.0, c['screen_y'], ZF - c['screen_s']])
    out['screen_bezel'] = Box(412, 242, 16).rotate(Axis.X, a).moved(Location(tuple(scr_c)))
    out['screen'] = Box(398, 226, 2).rotate(Axis.X, a).moved(Location(tuple(scr_c + screen_offset(a))))
    out['screen_stand'] = Box(150, 80, 70).moved(Location(tuple(scr_c + [0, -35, 38])))     # the neck into the white block
    # ---- yoke on its column, driver on the left (+x), tilted 22 degrees (seat side view).
    yc = (c['seat_x'], c['yoke'][1], ZF - c['yoke'][0])
    def place(s):
        return s.rotate(Axis.Y, 180).rotate(Axis.X, c['yoke_tilt']).moved(Location(yc))
    rim, chin, pods, wheels = yoke_parts()
    t = math.radians(c['yoke_tilt'])
    col_dir = np.array([0, -math.sin(t), math.cos(t)])
    col = Cylinder(30, 300).rotate(Axis.X, c['yoke_tilt']).moved(Location(tuple(np.array(yc) + col_dir * 175)))
    shroud = Box(110, 90, 200).rotate(Axis.X, c['yoke_tilt']).moved(Location(tuple(np.array(yc) + col_dir * 230)))
    out['yoke'] = place(rim) + col + shroud
    out['yoke_chin'] = place(chin)
    out['yoke_pods'] = place(pods)
    out['yoke_keys'] = place(wheels)
    # ---- centre console (manual-storage-34C29DB3, -electronics-2298443C, -886D0FDA, -D54DBA46): front wall
    # and the two wireless chargers leaning on it, two cupholders, the armrest lid, the rear section, and the
    # rear face with the rear screen in its vent surround. Front measured at 1,494 back, 918 high (dash render).
    a0, a1, ah = c['arm']
    se = c['console_end_s']
    lid0, lid1 = 1880.0, 2330.0                           # the proportions of manual-storage-34C29DB3: tray 35%, lid 40%, rear block 25%
    side = [(1494, c['floor'] - 2), (1494, 918), (1512, 918), (1516, 872), (lid0 - 25, 872), (lid0, ah), (lid1, ah), (lid1 + 15, ah + 12),
            (se, ah + 12), (se, 640), (se - 90, 560), (se - 120, c['floor'] - 2)]
    frontl = [(-138, c['floor'] - 2), (138, c['floor'] - 2), (146, 820), (146, ah - 25), (124, ah), (-124, ah), (-146, ah - 25), (-146, 820)]
    con = SH(side, -160, 160) & XH(frontl, 1480, se + 10)
    for xc in (-56, 56):
        con -= XS(ngon(xc, 1700, 44, 8, math.pi / 8), 790, 900)
    con -= SH([(lid1 - 2, ah - 6), (lid1 + 2, ah - 6), (lid1 + 2, ah + 20), (lid1 - 2, ah + 20)], -200, 200)     # the lid's seam at its hinge
    out['console'] = con
    chg = []
    for xc in (-62, 62):                                 # two pads, leaning back 25 degrees on the front wall
        chg.append(Box(108, 100, 8).rotate(Axis.X, 25).moved(Location((xc, 912, Z(1512 + 38)))))
    out['chargers'] = Compound(chg) & XS([(-160, 1500), (160, 1500), (160, 1700), (-160, 1700)], 873, 1000)
    rs = se + 7                                          # the surround stands 7 mm proud of the rear face
    out['rear_vents'] = SH([(se - 5, 760), (rs, 760), (rs, 935), (se - 5, 935)], -125, 125)
    out['rear_screen'] = SH([(rs - 1, 783), (rs + 1, 783), (rs + 1, 900), (rs - 1, 900)], -104, 104)
    # ---- seats
    seats = {'seat': [], 'seat_base': [], 'switch': []}
    for sx in (1, -1):
        for k, v in front_seat(sx * c['seat_x'], sx).items():
            seats[k] += v
    rear, _ = rear_bench(p)
    seats['seat_base'] += rear['seat_base']
    out['seats_front'] = Compound(seats['seat'])
    out['seats_rear'] = Compound(rear['seat'])
    out['seat_base'] = Compound(seats['seat_base'])
    out['seat_knobs'] = Compound(seats['switch'])
    out['rear_armrest'] = Compound(rear['armrest_r'])
    # ---- doors: each door's trim rides on it
    for d in ('f', 'r'):
        for sx, side_k in ((1, 'l'), (-1, 'r')):
            for name, parts in door_trim(p, d, sx, driver=(d == 'f' and sx > 0)).items():
                out[f'door_{d}{side_k}_{name}'] = Compound(parts)
    # ---- pillars, headliner, roof beams (dgRcedIkNOM-31: suede trim, the header beam with the sun visors;
    # the windshield's top edge measured through the dash render's camera at 1,739 back, the dome light under
    # the header at 1,826; the header's rear edge is a guess).
    band = ceiling_band(p, 2, 24)
    def sband(s0, s1):
        return Box(2400, 2400, s1 - s0, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, 0, Z(s0))))
    h0, h1 = c['header']
    roof_only = Box(1300, 700, 8000).moved(Location((0, 1650, 0)))       # |x| < 650, above 1,300: the roof's layer only
    beams = [band & sband(h0, h1) & roof_only, band & sband(p['apex_s'] - 40, p['apex_s'] + 40) & roof_only]
    rails = []
    for ka, kb, s0, s1, reach in (('roof', 'window_l', 1000, p['apex_s'], 45), ('deck', 'window_l', p['apex_s'], c['cab_rear_s'] - 10, 45),
                                  ('roof', 'window_r', 1000, p['apex_s'], 45), ('deck', 'window_r', p['apex_s'], c['cab_rear_s'] - 10, 45)):
        rails.append(band & sband(s0, s1) & edge_wedge(p, ka, kb, reach))
    head = Compound(beams + rails)
    out['headliner'] = fixed(head & Box(2400, 2400, 8000, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, c['dash_h'] + 40, 0))))
    # B-pillar trim between the doors (fixed), the cab's back wall above the rear seat.
    b0, b1 = p['seam_2'] - PILLAR_HALF + 2, p['seam_2'] + PILLAR_HALF - 2
    bpil = SH([(b0, c['floor']), (b1, c['floor']), (b1, 2000), (b0, 2000)], -1300, 1300) & (hull(p, inset=c['wall'] - 3) - hull(p, inset=c['wall'] + 40))
    out['pillar_trim'] = bpil - Box(1520, 3000, 8000)                 # only the sides, outboard of 760
    out['rear_wall'] = (SH([(c['cab_rear_s'] - 26, c['floor']), (c['cab_rear_s'] + 5, c['floor']), (c['cab_rear_s'] + 5, 2000), (c['cab_rear_s'] - 26, 2000)], -1300, 1300) & inner)
    # Sun visors, stowed flat under the header (dgRcedIkNOM-31; the manual's dash render shows none over the
    # glass). Sizes are guesses.
    vis = ceiling_band(p, 24.5, 40) & sband(h0 + 10, h1 - 10) & roof_only
    out['visors'] = vis & (Box(640, 3000, 8000).moved(Location((370, 0, 0))) + Box(640, 3000, 8000).moved(Location((-370, 0, 0))))
    # Overhead console: a plate from the header down to the rear-view mirror (dash render: its lower corners
    # ±136 wide at 1,490 high, 1,578 back; the mirror 195 x 50, 1,464 to 1,513 high, 1,621 back).
    hy = roof_inner_h(p, h0 + 60, c['wall'] + 20)
    oc = [np.array([30, hy + 30, Z(h0 + 60)]), np.array([-30, hy + 30, Z(h0 + 60)]), np.array([-136, 1490, Z(1578)]), np.array([136, 1490, Z(1578)])]
    ocp = Wire.make_polygon([tuple(q) for q in oc], close=True)
    nrm = np.cross(oc[1] - oc[0], oc[2] - oc[0]); nrm /= np.linalg.norm(nrm)
    out['overhead'] = extrude(Face(ocp), amount=24, dir=tuple(nrm if nrm[1] > 0 else -nrm))
    out['rear_mirror'] = Box(195, 50, 28).moved(Location((0, 1489, Z(1621)))) + Box(26, 40, 26).moved(Location((0, 1525, Z(1600))))
    # ---- floor: carpet over the cabin floor, mats on it, pedals (brake outboard of the accelerator, x
    # measured in the dash render; their depth along the truck is a guess).
    out['carpet'] = (Box(2400, 12, c['cab_rear_s'] - 1170, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, c['floor'] + 0.5, Z(1170)))) & inner) - well
    mats = [XS([(140, 1330), (640, 1330), (690, 1420), (690, 2080), (140, 2080)], c['floor'] + 13, c['floor'] + 22),
            XS([(-140, 1330), (-640, 1330), (-690, 1420), (-690, 2080), (-140, 2080)], c['floor'] + 13, c['floor'] + 22),
            XS([(-690, 2690), (690, 2690), (690, 2700 + 300), (640, 3050), (-640, 3050), (-690, 3000)], c['floor'] + 13, c['floor'] + 22)]
    out['mats'] = Compound(mats) - out['console']
    out['pedals'] = Compound([
        Box(120, 85, 16).rotate(Axis.X, 35).moved(Location((460, c['floor'] + 150, Z(1330)))),
        Box(55, 220, 14).rotate(Axis.X, 35).moved(Location((290, c['floor'] + 140, Z(1300))))])
    return out

def screen_offset(a):
    """From the screen's centre to its display face's centre (2 mm proud of the bezel), tilted a degrees."""
    r = math.radians(a)
    return np.array([0, 9.2 * math.sin(r), -9.2 * math.cos(r)])

def screens(p=P):
    """The two screens' faces for texture mapping: centre, in-plane axes (u right, v up) and size, mm."""
    c = CAB
    a = math.radians(c['screen_tilt'])
    v = [0, math.cos(a), math.sin(a)]
    ctr = np.array([0.0, c['screen_y'], ZF - c['screen_s']]) + screen_offset(c['screen_tilt'])
    # Both faces look back (-z); for someone facing +z, right is -x.
    return {'screen': {'centre': ctr.tolist(), 'u': [-1, 0, 0], 'v': v, 'size': [398, 226]},
            'rear_screen': {'centre': [0.0, 841.5, ZF - c['console_end_s'] - 8], 'u': [-1, 0, 0], 'v': [0, 1, 0], 'size': [208, 117]}}

def details(p):
    """Small exterior parts by material: the black B-pillars, the door-release buttons at the foot of each
    window's rear pillar (Owner's Manual, Doors: "on the pillar to the right of each door"), and the amber
    and red side markers on the bumper corners (c022, c059)."""
    pl = planes(p)
    BW = body_w(p)
    m = p['win_margin']
    def belt(s):
        return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    def top(s):
        z = ZF - s
        return min(edge_point(pl['roof'], pl['window_l'], z)[1], edge_point(pl['deck'], pl['window_l'], z)[1]) - m
    out = {'pillars': [], 'marker_amber': [], 'marker_red': []}
    for key, sx in (('window_l', 1), ('window_r', -1)):
        win = pl[key]
        b0, b1 = p['seam_2'] - PILLAR_HALF, p['seam_2'] + PILLAR_HALF
        pts = [on_plane(win, y=h, z=ZF - s) for s, h in ((b0, belt(b0) + 10), (b0, top(b0) + 5), (b1, top(b1) + 5), (b1, belt(b1) + 10))]
        if sx < 0:
            pts = pts[::-1]
        out['pillars'].append(prism(pts, win[1], out=1.6, depth=110))      # opaque from both sides
        for door, s in (('f', p['seam_2']), ('r', p['seam_3'] + 18)):      # on the pillar behind each door
            ctr = on_plane(win, y=belt(s) + 24, z=ZF - s)
            u = np.array([0, 0, 1.0]); vv = np.cross(win[1], u); vv /= np.linalg.norm(vv)
            sq = [ctr + u * 14 * a + vv * 9 * b for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            if np.dot(np.cross(sq[1] - sq[0], sq[2] - sq[0]), win[1]) < 0:
                sq = sq[::-1]
            out[f'btn_{door}{key[-1]}'] = [prism(sq, win[1], out=3.5, depth=2)]
        xo = sx * (BW + 6 + 1.5)
        # The front bumper's flat side ends 38 mm ahead of the arch; the marker sits on its raked corner face,
        # from just ahead of that edge, standing 1.5 mm proud like the rear ones.
        a = np.array([sx * (BW + 6), ZF - p['corner_s'] - p['face_rake'] + 10])
        d = np.array([sx * p['nose_flat_half'], ZF - p['face_rake'] + 10]) - a
        d /= np.linalg.norm(d)
        n = np.array([d[1], -d[0]]) * sx                                  # outward and forward
        cx, cz = a + d * 50 + n * 1.5
        out['marker_amber'].append(Box(4, 26, 80).rotate(Axis.Y, math.degrees(math.atan2(d[0], d[1])))
                                   .moved(Location((cx, p['bumper_f_h'] - 55, cz))))
        zr = AXLES['r'] - p['arch_foot_half'] - 40
        out['marker_red'].append(Box(4, 26, 80).moved(Location((xo, p['bumper_r_h'] - 50, zr - 40))))
    return {k: Compound(v) for k, v in out.items()}

def seat_eyes(p=P):
    """Eye points (mm) for a seated visitor: driver, front passenger, rear centre."""
    c = CAB
    sf, hf = c['h_front']
    sr, hr = c['h_rear'][0], rear_h_point(p)
    return {'driver': [c['seat_x'], hf + 640, ZF - sf - 60], 'passenger': [-c['seat_x'], hf + 640, ZF - sf - 60],
            'rear': [0, hr + 620, ZF - sr - 60]}

# ---------------------------------------------------------------- doors (each its own node, hinged at its front edge)

PILLAR_HALF = 35.0          # the fixed B-pillar strip between the doors, where the front door's button sits

def door_spans(p):
    return {'f': (p['seam_1'], p['seam_2'] - PILLAR_HALF), 'r': (p['seam_2'] + PILLAR_HALF, p['seam_3'])}

def door_regions(p):
    """{door: (region solid, hinge point)} for fl, rl, fr, rr. A door is everything between its seams that is
    below the roof and deck (minus the glass pockets' depth) and either outboard of the side window's plane
    or below the beltline: its skin, its window and frame, its trim, armrest and handle. Never the roof."""
    pl = planes(p)
    BW = body_w(p)
    c = CAB
    x_in = BW - c['wall'] - c['trim_t'] - 100
    out = {}
    for d, (s0, s1) in door_spans(p).items():
        poly = [(ZF - s0, 480.0), (ZF - s1, 480.0), (ZF - s1, 2100.0), (ZF - s0, 2100.0)]
        prism_l = side_prism(poly, x_in, 1300)
        a = halfspace_cut(prism_l, pl['roof'][0] - pl['roof'][1] * 12, pl['roof'][1])
        a = halfspace_cut(a, pl['deck'][0] - pl['deck'][1] * 12, pl['deck'][1])
        wp, wn = pl['window_l']
        a = halfspace_cut(a, wp - wn * 120, -wn)
        belt = plane3(V(BW, p['belt_h_front'], p['a_pillar_s']), V(BW, p['belt_h_rear'], p['c_pillar_s']), V(0, p['belt_h_front'], p['a_pillar_s']))
        if belt[1][1] < 0:
            belt = (belt[0], -belt[1])
        b = halfspace_cut(prism_l, belt[0] + belt[1] * 2, belt[1])
        region = a + b
        hinge = np.array([BW - 20, 900.0, ZF - s0])
        out[f'{d}l'] = (region, hinge)
        out[f'{d}r'] = (region.mirror(Plane.YZ), hinge * [-1, 1, 1])
    return out

def split_doors(part, regions):
    """(rest, {door: piece}) of a solid or compound cut by the door regions; empty pieces are dropped."""
    pieces, rest = {}, part
    for k, (reg, _) in regions.items():
        piece = part & reg
        if piece is not None and piece.volume > 1:
            pieces[k] = piece
            rest = rest - reg
    return rest, pieces

# ---------------------------------------------------------------- build

if __name__ == '__main__':
    p = P
    for old in OUT.glob('*.stl'):                    # parts can disappear (moved onto a door); start clean
        old.unlink()
    BW = body_w(p)
    body = shell(p)
    inner = hull(p, inset=1.0)                       # panels are clipped to 1 mm under the steel

    # Door seams: thin slots through the flank, from the rocker up to the glass's bottom edge at that seam
    # (the beltline rises toward the back, so a single height ran the front seam up onto the cowl).
    for s in (p['seam_1'], p['seam_2'] - PILLAR_HALF, p['seam_2'] + PILLAR_HALF, p['seam_3']):
        belt = p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
        h = belt + 12 - CLEAR - 10
        body -= Box(200, h, 4, align=(Align.MIN, Align.MIN, Align.CENTER)).moved(Location((BW - p['tuck'] - 6, CLEAR + 10, ZF - s)))
        body -= Box(200, h, 4, align=(Align.MAX, Align.MIN, Align.CENTER)).moved(Location((-BW + p['tuck'] + 6, CLEAR + 10, ZF - s)))

    body = body - cavity(p)
    for h in through_holes(p):
        body = body - h

    groups = {'glass': [], 'tonneau': [], 'light_w': [], 'light_r': []}
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        body, panel = recess(body, inner if inset == 1.0 else hull(p, inset=inset), pts, n, depth)
        groups[kind].append(panel)

    regions = door_regions(p)
    body, door_steel = split_doors(body, regions)
    glass, door_glass = split_doors(Compound(groups['glass']), regions)
    for k, piece in door_steel.items():
        save(piece, f'door_{k}_steel', tolerance=0.5, angular=0.5)
    for k, piece in door_glass.items():
        save(piece, f'door_{k}_glass')
    save(body, 'body', tolerance=0.5, angular=0.5)
    save(glass, 'glass')
    save(Compound(groups['tonneau']), 'tonneau')
    save(Compound(groups['light_w']), 'light_front')
    save(Compound(groups['light_r']), 'light_rear')
    save(Compound(cladding(p)), 'cladding')
    mirrors_rest, mirror_pieces = split_doors(both_sides(mirror_part(p)), regions)     # the mirrors ride on the front doors
    for k, piece in mirror_pieces.items():
        save(piece, f'door_{k}_mirror')
    if mirrors_rest is not None and mirrors_rest.volume > 1:
        save(mirrors_rest, 'mirrors')
    save(wiper(p), 'wiper')
    for name, part in interior(p).items():
        if part is None or part.volume < 1:
            continue
        if name.startswith('door_'):                     # door_<k>_<part>: rides on door k
            save(part, f'door_{name[5:7]}_int_{name[8:]}', tolerance=2.5, angular=0.7)
        else:
            save(part, f'int_{name}', tolerance=2.5, angular=0.7)     # flat facets; coarse tessellation keeps the few round parts cheap
    for name, part in details(p).items():
        save(part, f'det_{name}')

    # Wheels: one set of meshes, built for the left side around its own centre.
    save(tyre(), 'tyre', tolerance=1.2, angular=0.12)
    rim_body, lugs = rim()
    save(rim_body, 'rim', tolerance=1.0, angular=0.25)
    save(lugs, 'lugs', tolerance=1.0, angular=0.6)
    save(cover(), 'cover', tolerance=1.0, angular=0.5)
    disc, cal = brake()
    save(disc, 'brake_disc', tolerance=1.5, angular=0.4)
    save(cal, 'caliper')

    geo = {
        'arches': {a: arch_opening(p, az, grow=1.0) for a, az in AXLES.items()},
        'wellX': WELL_X, 'bodyHalf': BW,
        'wheels': {f'{a}{"l" if s > 0 else "r"}': wheel_centre(p, a, s).tolist() for a in AXLES for s in (1, -1)},
        'planes': [[pt.tolist(), n.tolist()] for pt, n in planes(p).values()],
        'seatEyes': seat_eyes(p),
        'screens': screens(p),
        'doors': {k: {'hinge': h.tolist(), 'openDeg': -65 if k.endswith('l') else 65} for k, (_, h) in regions.items()},
    }
    (OUT / 'geometry.json').write_text(json.dumps(geo, indent=1))
    print('cad: wrote', sorted(q.name for q in OUT.glob('*.stl')))
