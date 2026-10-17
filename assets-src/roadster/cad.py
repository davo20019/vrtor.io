"""Rigid parts of the Tesla Roadster (second generation, as revealed 15 October 2026), in millimetres, exported as
STL to parts/, plus parts/geometry.json (wheel centres, door hinges) and parts/mounts.json for assemble.py.

Frame: front faces +z, up +y, +x is the car's left side. Origin on the ground, midway between the axles.

No dimension is published. Every size here comes from Tesla's press photos (spec.md, "Dimensions"): the side
profile, the top-down drone shot and the straight front and rear views, read in pixels and put in mm by one scale.
The scale is the rear licence plate, a US plate (12 x 6 in), the only object of known size in the photos. The
global scales sx, sy, sz and the wheel sizes are in P and are fitted to the photos by scripts/3d/fit_silhouette.py,
which writes params.json.

The body is a loft through cross-sections (STATIONS), each a polygon of named points read from the views:
  bottom centre, bottom edge (tucked under), widest point, shoulder crease, crest (fender top in front, beltline in
  the cabin, buttress top at the back), roof or hood edge, top centre.
The glass is a second loft through the sections' top part (2 mm proud of the body), cut into the windshield and
roof, the side glass and the rear glass by regions read off the top and side views. The doors are cut from the
body's shell (the cabin is hollowed by a loft through inset sections) with a 3 mm gap all round.
"""
import json, math
from pathlib import Path
import numpy as np
from build123d import *

HERE = Path(__file__).parent
OUT = HERE / 'parts'

P = dict(
    # Overall sizes, in mm (the first read: spec.md, "Scale"). The sections are scaled to them.
    nose_z=2370.0,                   # front of the nose face, ahead of the midpoint between the axles
    tail_z=-2222.0,                  # rear face of the tail (top of the light bar)
    half_w=1000.0,                   # widest half width (rear hips)
    roof_h=1227.0,                   # roof peak
    nose_h=512.0,                    # top edge of the nose face (the front light bar)
    tail_h=942.0,                    # top of the tail
    hood_drop=0.0,                   # hood and windshield base lowered below the first read, at the windshield base
    wheelbase=2960.0,                # side view: 1,256 px between the wheel centres
    r_f=380.0, r_r=392.0,            # tyre outer radii (side view: 323 and 337 px across); the rear reads larger
    w_f=285.0, w_r=335.0,            # tyre section widths (rear view: the rear tread ~ 360 px at the plate's 0.917 mm/px)
    track_f=1650.0, track_r=1643.0,  # tyre centre to tyre centre: tyres' outer faces flush with the body (top view: no tyre shows past it)
    rim_ratio=0.80,                  # rim flange diameter / tyre diameter (rear 3/4 view, the tyre's vertical axis)
    arch_gap=30.0,                   # wheel arch radius over the tyre's
)
PARAMS = HERE / 'params.json'
if PARAMS.exists():
    P.update(json.loads(PARAMS.read_text()))

# Cross-sections, read from the side view (heights, z) and the top-down view (half-widths), in mm at the first
# scale (spec.md, "Sections"). Columns:
#   z, xs (half width, widest), ymid (its height: above the wheel arches over the wheels, as the rear and front views show), xsh, ysh (shoulder crease), xe, ye (crest), xr, yr (roof or hood
#   edge), yc (top centre), yb (underside)
COLS = ('z', 'xs', 'ymid', 'xsh', 'ysh', 'xe', 'ye', 'xr', 'yr', 'yc', 'yb')
# The nose curves back in plan (top view: half width 181 at 2,335, 394 at 2,300, 545 at 2,265), and the front light bar
# follows its top edge round to the corners (front three-quarter photo, Roadster-08-End).
STATIONS = [
    (2370, 200, 400, 195, 470, 190, 505, 180, 512, 512, 300),
    (2330, 400, 410, 395, 480, 380, 520, 360, 520, 518, 280),
    (2290, 545, 420, 535, 490, 500, 545, 420, 528, 525, 260),
    (2250, 610, 430, 600, 500, 580, 565, 440, 535, 530, 240),
    (2100, 745, 480, 730, 560, 690, 640, 470, 585, 572, 190),
    (1900, 870, 560, 850, 650, 790, 735, 500, 650, 640, 160),
    (1700, 950, 600, 925, 720, 850, 800, 520, 725, 715, 140),
    (1500, 975, 610, 950, 760, 845, 828, 560, 815, 790, 130),
    (1300, 978, 600, 955, 790, 860, 845, 640, 880, 857, 125),
    (1000, 968, 560, 945, 805, 850, 850, 620, 975, 960, 120),
    (600, 960, 520, 937, 815, 820, 862, 580, 1105, 1112, 120),
    (200, 959, 520, 935, 830, 800, 880, 540, 1185, 1218, 120),
    (-200, 958, 530, 935, 845, 790, 900, 520, 1200, 1227, 120),
    (-600, 956, 560, 935, 860, 780, 960, 480, 1175, 1206, 125),
    (-1000, 965, 650, 945, 880, 760, 1060, 430, 1150, 1160, 130),
    (-1300, 997, 760, 980, 900, 720, 1119, 380, 1080, 1070, 140),
    (-1600, 998, 790, 980, 900, 680, 1063, 330, 1020, 1010, 150),
    (-1850, 947, 790, 930, 890, 640, 1003, 280, 975, 965, 200),
    (-2050, 880, 780, 865, 880, 600, 970, 250, 945, 940, 380),
    (-2222, 850, 760, 840, 870, 580, 942, 240, 930, 925, 560),
]
TUCK = 80.0                      # the underside's edge sits this far inside the widest point
GLASS_PROUD = 5.0
SHELL_T = 35.0                   # the cabin's skin, where the doors are cut
GAP = 6.0                        # door shut lines (wider than a production car's 3 to 4 mm: the hinge is guessed, and 6 mm lets it clear)

def scales(p):
    sx = p['half_w'] / 1000.0
    sy = p['roof_h'] / 1227.0
    return sx, sy

# Features measured in mm (tools/bundle.py on measure/ba.json: marked in two to six photos, the photos' cameras refined
# with them, anchored by the plate corners and the wheel hubs; errors in px are in measure/ba.md). They were measured
# with the sizes in REF and scale with P's sizes from there, so a refit of the overall sizes carries them along.
REF = dict(half_w=994.84, roof_h=1185.41, nose_z=2334.26, tail_z=-2246.58)
MEAS = {
    'nose_corner': (606.0, 481.0, 2281.0),     # the front light bar's end: the hood's front corner (front, front_q34, side, top
                                               # on both sides)
    'nose_centre': (0.0, 481.0, None),         # the light bar at the centre: level with its ends (front photo: straight), at
                                               # the body's front (side: nothing ahead of the corners by more than ~25 mm)
    'ws_corner': (472.0, 754.0, 1582.0),       # the hood's rear corner, where the windshield's base meets the fender facet
    'ws_wrap': (827.0, 797.0, 1342.0),         # the windshield's lower front corner on the fender ridge (the facet's apex)
    'leg_front': (633.0, 289.0, 2242.0),       # the white front leg's lower front corner (front, front_q34)
    'tail_corner': (848.0, 873.0, -2221.0),    # the tail panel's top outer corner (q34, rear_high, top)
    'rearbar_end': (834.0, 829.0, -2210.0),    # the rear light bar's end (q34, rear_high)
    'rear_glass_corner': (259.0, 947.0, -1920.0),   # the rear glass's lower outer corner, at the stowed wing's seam
    'side_glass_tip': (545.0, 1073.0, -1137.0),     # the side window's rear point (side, q34, top)
}

def meas(name, p=P):
    """A measured feature (MEAS) scaled from REF to p's sizes."""
    x, y, z = MEAS[name]
    if z is None:                                  # at the body's front
        return np.array([x * p['half_w'] / REF['half_w'], y * p['roof_h'] / REF['roof_h'], p['nose_z']])
    return np.array([x * p['half_w'] / REF['half_w'], y * p['roof_h'] / REF['roof_h'],
                     z * (p['nose_z'] / REF['nose_z'] if z > 0 else p['tail_z'] / REF['tail_z'])])

NOSE_RAKE = 0.0                  # the nose face is flat under the bar (front photos: a straight band); the 39 mm lean of the
                                 # corner over 168 mm is the legs' outer edge (leg_front), which the sections behind carry

def bar_x(z, p=P):
    """Half width of the front light bar at z: it curves back in plan from the centre to the corners (z = zc - dz (x/xn)^2)."""
    c, n = meas('nose_centre', p), meas('nose_corner', p)
    t = (c[2] - z) / (c[2] - n[2])
    return float(n[0] * math.sqrt(min(max(t, 0.0), 1.0)))

FIN_X = 424.0                    # the fins' crest, each side of the rear glass (rear_high: 1,560 and 2,256 px; plate scale)
REAR_GLASS_X = 372.0             # the rear glass's straight sides, before they taper to its lower corners
FIN_H = 30.0                     # how far the fins stand over the glass edge (rear_high: the wing seam steps up 12 px at them)

def rear_section(d, p):
    """The rear deck (spec.md, "Rear"; rear_high, q34, top, side): the rear glass a shield between two narrow fins; the
    side window's tail runs back between each fin and the haunch, to its point (measured); outboard the haunch slopes
    straight down from the fin to the widest point (rear_high: one evenly lit plane); behind the glass the stowed wing,
    from the seam at the glass's lower corners to the tail's top edge, flat across, the fins fading out on it."""
    T, G, C = meas('side_glass_tip', p), meas('rear_glass_corner', p), meas('tail_corner', p)
    C[2] = p['tail_z']                             # the deck reaches the corner's height at the body's end
    sx = p['half_w'] / REF['half_w']
    rz = lambda z: z * p['tail_z'] / REF['tail_z']
    z = d['z']
    Z0, Z_TAPER, Z_SAG = rz(-600.0), rz(-1500.0), rz(-1400.0)
    if z > Z0:
        return d
    fin, gx = FIN_X * sx, REAR_GLASS_X * sx
    if z >= T[2]:                                   # ahead of the side window's point: the beltline runs in to it
        u = (Z0 - z) / (Z0 - T[2])
        d['xe'] += u * (T[0] - d['xe'])
        d['ye'] += u * (T[1] - d['ye'])
        d['xr'] = min(d['xr'], d['xe'] - 40)
    elif z >= G[2]:                                 # the rear glass between the fins
        u = min(1.0, (T[2] - z) / 280.0)            # behind the window's point the beltline turns into the fin
        t = max(0.0, min(1.0, (Z_TAPER - z) / (Z_TAPER - G[2])))
        d['xr'] = gx + t * (G[0] - gx)
        if z < Z_SAG:                               # the glass runs down to its lower corners' height at the seam
            v = (Z_SAG - z) / (Z_SAG - G[2])
            d['yc'] += v * (G[1] + 3 - d['yc'])
        d['yr'] = d['yc'] - 6
        d['xe'] = T[0] + u * (fin - T[0])
        d['ye'] = T[1] + u * (d['yr'] + FIN_H - T[1])
    else:                                           # the stowed wing, from the seam to the tail's top edge
        v = (G[2] - z) / (G[2] - C[2])
        d['yc'] = (G[1] + 3) + v * (C[1] + 2 - (G[1] + 3))
        d['yr'] = d['yc'] - 6 * (1 - v)
        d['xr'] = G[0] + v * (fin - G[0])
        d['xe'] = fin + v * (C[0] - 6 - fin)
        d['ye'] = d['yr'] + FIN_H * (1 - v) + v * (C[1] - d['yr'])
    d['xs'] = max(d['xs'], d['xe'] + 10)
    w = min(1.0, (Z0 - z) / (Z0 - T[2]))            # the haunch: one plane from the fin down to the widest point, a little
    xsh, ysh = d['xe'] + 0.8 * (d['xs'] - d['xe']), d['ye'] + 0.8 * (d['ymid'] - d['ye']) + 15    # full; eased in
    d['xsh'] += w * (xsh - d['xsh'])                # from the cabin's shoulder over the same stretch as the beltline
    d['ysh'] += w * (ysh - d['ysh'])
    return d

def front_section(d, p):
    """The front of a station (spec.md, "Front"): the flat hood between its two side seams, each running from the light
    bar's end to the windshield's base corner; outboard of the seam a flat facet up to the fender ridge, which runs from
    the same corner to the windshield's wrap corner (the facet is the plane through the three: front photo, front
    three-quarter and top views all see it as a triangle); outboard of the ridge the fender rolls over to its widest point.
    Ahead of the light bar's corners the section is the nose cap, the bar's plan curve at the top."""
    N, W, A, C = meas('nose_corner', p), meas('ws_corner', p), meas('ws_wrap', p), meas('nose_centre', p)
    z = d['z']
    BLEND = 250.0                                   # behind the wrap corner the ridge runs on into the cabin's beltline crest
    if A[2] - BLEND < z < A[2]:
        u = (A[2] - z) / BLEND
        for kx, ky in (('xe', 'ye'), ('xr', 'yr')):
            d[kx] = A[0] + u * (d[kx] - A[0]) if kx == 'xe' else min(d[kx], A[0] + u * (d[kx] - A[0]))
            d[ky] = A[1] + u * (d[ky] - A[1])
        return d
    if z < A[2]:
        return d
    if z > N[2]:                                    # the nose cap, ahead of the corners
        xb = max(bar_x(z, p), 2.0)
        lo = lambda y: max(bar_x(z + (N[1] - y) * NOSE_RAKE, p), 1.0)
        d.update(xe=xb, ye=N[1], xr=xb * 0.98, yr=N[1], yc=C[1])
        d['xsh'], d['ysh'] = xb, N[1] - 5
        d['xs'], d['ymid'] = lo(380.0), 380.0
        d['yb'] = 230.0 * p['roof_h'] / REF['roof_h']    # down to the splitter's top
        return d
    t = (N[2] - z) / (N[2] - A[2])
    ridge = N + t * (A - N)
    if z >= W[2]:
        s = (N[2] - z) / (N[2] - W[2])
        edge = N + s * (W - N)
        yc = edge[1]
    else:                                           # the windshield's base, from its corner out to the wrap corner
        s = (W[2] - z) / (W[2] - A[2])
        edge = W + s * (A - W)
        yc = max(d['yc'], edge[1])
    d.update(xe=ridge[0], ye=ridge[1], xr=min(edge[0], ridge[0] - 1), yr=edge[1], yc=yc)
    d['xs'] = max(d['xs'], ridge[0] + 5 + 55 * min(1.0, (N[2] - z) / 200))
    d['xsh'], d['ysh'] = ridge[0] + 0.72 * (d['xs'] - ridge[0]), ridge[1] - 0.3 * (ridge[1] - d['ymid'])
    if z > N[2] - 60:                               # the white leg under the corner: its foot 300 up
        d['yb'] = max(d['yb'], 230.0 * p['roof_h'] / REF['roof_h'])
    return d

def st(p=P, step=120.0):
    """The stations as dicts, resampled every `step` mm or less (linear between the read stations: a ruled loft
    between far-apart sections has twisted faces that tessellate differently for the body and the glass 5 mm on
    it), then scaled to P: z ahead of the axles' midpoint to nose_z, behind it to tail_z; x to half_w; y to roof_h,
    and further at the ends, so the nose's top is at nose_h and the tail's at tail_h (blending to the first read
    by z = 1,500 and -1,000); hood_drop lowers the hood and windshield base, most at z = 1,700."""
    raw = np.array(STATIONS, float)
    zs = []
    for a, b in zip(raw[:-1, 0], raw[1:, 0]):
        n = max(1, int(math.ceil((a - b) / step)))
        zs += list(np.linspace(a, b, n + 1)[:-1])
    zs.append(raw[-1, 0])
    # extra sections where the front's creases turn (the nose cap, the windshield's corners), in first-read z
    k = 2370.0 / p['nose_z']
    extra = [meas('nose_centre', p)[2] - 1] + list(np.linspace(meas('nose_centre', p)[2] - 6, meas('nose_corner', p)[2], 5)) + \
        [meas('ws_corner', p)[2], meas('ws_wrap', p)[2], meas('side_glass_tip', p)[2], meas('rear_glass_corner', p)[2]]
    kr = -2222.0 / p['tail_z']
    zs = sorted(set(round(z, 3) for z in zs) | {round(z * (k if z > 0 else kr), 3) for z in extra}, reverse=True)
    zs = [z for z in zs if z <= raw[0, 0]]
    sx, sy = scales(p)
    out = []
    for z in zs:
        row = {k: np.interp(z, raw[::-1, 0], raw[::-1, i]) for i, k in enumerate(COLS)}
        # end factors on heights above the underside
        if z > 1500:
            t = (z - 1500) / (2370 - 1500)
            f = 1 + t * (p['nose_h'] / (512.0 * sy) - 1)
        elif z < -1000:
            t = (-1000 - z) / (2222 - 1000)
            f = 1 + t * (p['tail_h'] / (942.0 * sy) - 1)
        else:
            f = 1.0
        drop = p['hood_drop'] * max(0.0, 1 - abs(z - 1700) / 900) if z > 800 else 0.0
        d = {}
        for k, v in row.items():
            if k == 'z':
                d[k] = v * (p['nose_z'] / 2370.0 if v > 0 else -p['tail_z'] / 2222.0)
            elif k.startswith('y'):
                y = row['yb'] + (v - row['yb']) * f if k != 'yb' else v
                if k in ('yr', 'yc', 'ye') and drop:
                    y -= drop * (1.0 if k != 'ye' else 0.5)
                d[k] = y * sy
            else:
                d[k] = v * sx
        out.append(rear_section(front_section(d, p), p))
    return out

def zf(z, p):
    """A first-read z (mm) scaled like the sections."""
    return z * (p['nose_z'] / 2370.0 if z > 0 else -p['tail_z'] / 2222.0)

def yat(y, z, p):
    """A first-read height y (mm) at a scaled z, moved as the sections' heights are (for parts placed by height)."""
    z0 = z / (p['nose_z'] / 2370.0 if z > 0 else -p['tail_z'] / 2222.0)
    raw = np.array(STATIONS, float)
    yb = np.interp(z0, raw[::-1, 0], raw[::-1, COLS.index('yb')])
    sx, sy = scales(p)
    if z0 > 1500:
        f = 1 + (z0 - 1500) / (2370 - 1500) * (p['nose_h'] / (512.0 * sy) - 1)
    elif z0 < -1000:
        f = 1 + (-1000 - z0) / (2222 - 1000) * (p['tail_h'] / (942.0 * sy) - 1)
    else:
        f = 1.0
    return (yb + (y - yb) * f) * sy

def at(z, key, p=P):
    """A station value at any z, linear between stations."""
    S = st(p)
    zs = [s['z'] for s in S][::-1]
    return float(np.interp(z, zs, [s[key] for s in S][::-1]))

def half_section(s):
    return [(s['xs'] - min(TUCK, 0.3 * s['xs']), s['yb']), (s['xs'], s['ymid']), (s['xsh'], s['ysh']), (s['xe'], s['ye']),
            (s['xr'], s['yr'])]

def full_poly(s):
    h = half_section(s)
    return [(0.0, s['yb'])] + h + [(0.0, s['yc'])] + [(-x, y) for x, y in reversed(h)]

def top_poly(s, proud=GLASS_PROUD, depth=60.0):
    """The section's top part, from crest to crest, pushed proud of the body by `proud`, closed by a chord `depth`
    below its lowest point (inside the body), so the polygon keeps one winding at every station."""
    base = min(s['ye'], s['yr'], s['yc']) - depth
    return [(s['xe'] + proud, base), (s['xe'] + proud, s['ye']), (s['xr'] + proud, s['yr'] + proud),
            (0.0, s['yc'] + proud), (-s['xr'] - proud, s['yr'] + proud), (-s['xe'] - proud, s['ye']),
            (-s['xe'] - proud, base)]

def inset(poly, d):
    """Mitre-inset a closed polygon (counter-clockwise or not) by d: each edge moved inward, corners re-intersected."""
    pts = np.array(poly, float)
    n = len(pts)
    area = 0.5 * sum(pts[i, 0] * pts[(i + 1) % n, 1] - pts[(i + 1) % n, 0] * pts[i, 1] for i in range(n))
    sgn = 1.0 if area > 0 else -1.0
    lines = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        t = (b - a) / np.linalg.norm(b - a)
        nrm = sgn * np.array([-t[1], t[0]])          # inward normal
        lines.append((a + nrm * d, t))
    out = []
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        A = np.array([t1, -t2]).T
        if abs(np.linalg.det(A)) < 1e-9:
            out.append(tuple(p2))
            continue
        u = np.linalg.solve(A, p2 - p1)[0]
        out.append(tuple(p1 + t1 * u))
    return out

def wire_at(poly, z):
    return Wire.make_polygon([Vector(x, y, z) for x, y in poly], close=True)

def loft_polys(polys_z):
    return Solid.make_loft([wire_at(pl, z) for pl, z in polys_z], ruled=True)

def save(part, name, tolerance=0.3, angular=0.25):
    export_stl(part, str(OUT / f'{name}.stl'), tolerance=tolerance, angular_tolerance=angular)

def prism_zy(poly_zy, x0, x1):
    """A prism from a side-view polygon (z, y), across x0..x1."""
    w = Wire.make_polygon([Vector(x0, y, z) for z, y in poly_zy], close=True)
    return Solid.extrude(Face(w), Vector(x1 - x0, 0, 0))

def prism_xz(poly_xz, y0, y1):
    """A prism from a top-view polygon (x, z), from y0 to y1."""
    w = Wire.make_polygon([Vector(x, y0, z) for x, z in poly_xz], close=True)
    return Solid.extrude(Face(w), Vector(0, y1 - y0, 0))

def both(shape):
    return shape + shape.mirror(Plane.YZ)

def axles(p=P):
    return {'f': p['wheelbase'] / 2, 'r': -p['wheelbase'] / 2}

def wheel_centres(p=P):
    a = axles(p)
    c = {}
    for side, sg in (('l', 1), ('r', -1)):
        c['f' + side] = [sg * p['track_f'] / 2, p['r_f'], a['f']]
        c['r' + side] = [sg * p['track_r'] / 2, p['r_r'], a['r']]
    return c

# ------------------------------------------------------------------ body

def body_solid(p=P):
    S = st(p)
    return loft_polys([(full_poly(s), s['z']) for s in S])

def arch_cuts(p=P):
    """Wheel wells: a cylinder over each tyre, from inside the tyre's inner face out past the body."""
    cuts = []
    for k, (x, y, z) in wheel_centres(p).items():
        r = (p['r_f'] if k[0] == 'f' else p['r_r']) + p['arch_gap']
        w = p['w_f'] if k[0] == 'f' else p['w_r']
        x_in = abs(x) - w / 2 - 45
        cyl = Solid.make_cylinder(r, 700, Plane(origin=(math.copysign(x_in, x), y, z),
                                               z_dir=(math.copysign(1, x), 0, 0)))
        cuts.append(cyl)
    return cuts

CABIN = (1450.0, -1150.0)        # z range hollowed for the cabin (doors and seats)

def cavity(p=P, t=SHELL_T):
    S = [s for s in st(p) if zf(CABIN[1], p) - 1 <= s['z'] <= zf(CABIN[0], p) + 1]
    polys = []
    for s in S:
        pl = inset(full_poly(s), t)
        floor = s['yb'] + 60
        pl = [(x, max(y, floor)) for x, y in pl]
        polys.append((pl, s['z']))
    return loft_polys(polys)

def greenhouse(p=P):
    """The glass envelope over the cabin and the rear deck: the sections' top part, 2 mm proud."""
    S = [s for s in st(p) if zf(-1850, p) - 1 <= s['z'] <= zf(1700, p) + 1]
    return loft_polys([(top_poly(s), s['z']) for s in S])

# Regions (spec.md, "Glass and doors"), in z (front +) and y, at the first scale; scaled with the body.
SPINE = 114.0                                             # half width of the fixed roof spine between the doors (top view)
ROOF_FRONT, ROOF_REAR = 560.0, -700.0                     # the doors' roof glass, top view
SIDE_GLASS = [(803, 826), (-358, 907), (-1076, 1112), (-1000, 1320), (349, 1320), (349, 1157)]
# side window (z, y): traced on the side photo and back-projected through its solved camera onto the glass (x = 820 at
# the beltline, 600 at the top); generous above the roof edge, where the greenhouse cuts it
SILL_TOP = [(1150, 270), (1031, 272), (-144, 309), (-955, 437), (-1150, 445)]     # white body's lower edge, side view (back-projected)
DOOR = [(834, 282), (889, 761), (889, 836), (349, 1157), (560, 1250), (560, 1500), (-700, 1500), (-700, 1150), (-340, 910),
        (-192, 321)]
# door shut lines (z, y): back-projected from the side photo (x = 950 on the body, 820 on the glass); the door is cut
# behind the A-pillar line (build()), so its visible front edge is the line's foot; measured in round 6 the photo's shut
# line leans forward from 846 at the sill to 947 at the shoulder crease, not reachable with the guessed hinge; the roof glass's
# front and rear edges (560, -700) from the top view

def zy(poly, p):
    return [(zf(z, p), yat(y, zf(z, p), p)) for z, y in poly]

def xz(poly, p):
    sx, sy = scales(p)
    return [(x * sx, zf(z, p)) for x, z in poly]

A_PILLAR = [(803, 826), (349, 1157)]     # side window's front edge (side photo, back-projected): windshield ahead of it

def glass_regions(p=P):
    """The glass regions: the windshield (side view: everything of the glass envelope ahead of the A-pillar line, so it
    wraps down to the crest as the side photo shows; top view: back to the roof glass's front edge, 560), the left door's
    roof glass between the spine and the roof edge (mirror for the right), the rear glass, and the band outside the roof
    edge's 50 mm white rail where the side glass is (top view, Roadster_92: canopy half width 560 at z = 250)."""
    rr = lambda z, d=0.0: at(z, 'xr', p) + d
    (za, ya), (zb, yb) = zy(A_PILLAR, p)
    ahead = prism_zy([(za, ya), (zb, yb), (zb, 2000), (zf(2600, p), 2000), (zf(2600, p), 300), (za, 300)], -1500, 1500)
    zs_roof = np.linspace(zf(ROOF_FRONT - 8, p), zf(ROOF_REAR + 8, p), 8)
    roof_l = prism_xz([(0.0, zs_roof[0])] + [(rr(z), z) for z in zs_roof] + [(0.0, zs_roof[-1])], 500, 1600)
    behind_roof_front = prism_xz([(-1500, zf(ROOF_FRONT, p)), (1500, zf(ROOF_FRONT, p)), (1500, -3000), (-1500, -3000)], 500, 1600)
    inside_rail = prism_xz([(-rr(z), z) for z in np.linspace(zf(1800, p), zf(ROOF_FRONT, p), 8)] +
                           [(rr(z), z) for z in np.linspace(zf(ROOF_FRONT, p), zf(1800, p), 8)], 500, 1600)
    W, A = meas('ws_corner', p), meas('ws_wrap', p)       # the windshield's base: straight across the hood (front three-
    base = [(0.0, W[2]), (W[0], W[2]), (A[0], A[2])]       # quarter: the hood's rear edge is one line), then out to the wrap
    behind_base = prism_xz([(-1500.0, base[-1][1])] + [(-x, z) for x, z in reversed(base[1:])] + base +
                           [(1500.0, base[-1][1]), (1500.0, -3000.0), (-1500.0, -3000.0)], 300, 1600)
    windshield = (ahead + (inside_rail - behind_roof_front)) & behind_base
    zg = meas('rear_glass_corner', p)[2]                 # the rear glass ends square at the stowed wing's seam
    zs_rear = np.linspace(zf(ROOF_REAR - 8, p), zg, 14)
    side = [(rr(z), z) for z in zs_rear]
    rear = prism_xz(side + [(-x, z) for x, z in reversed(side)], 500, 1600)
    zs_out = np.linspace(zf(1700, p), zf(-1150, p), 14)
    outer_l = prism_xz([(rr(z, 50), z) for z in zs_out] + [(1400, zs_out[-1]), (1400, zs_out[0])], 500, 1600)
    return windshield, roof_l, rear, outer_l

DOOR_DRAFT = 20.0                # the door's edges lean in by this much from its outer skin to the cabin side

def door_region(p, grow=0.0, side=1):
    """The left door's region, grown or shrunk by `grow` mm: the side-view outline (DOOR) at the outside, shrunk by
    DOOR_DRAFT at the inside (from the spine at the roof, x = 700 down the sides), so the shut faces have the draft that
    lets a door turning out and up clear its opening."""
    out_pl = inset(zy(DOOR, p), -grow) if grow else zy(DOOR, p)
    in_pl = inset(zy(DOOR, p), DOOR_DRAFT - grow)
    x_in, x_out = SPINE * scales(p)[0] + 6 - grow, 1400.0
    w_in = Wire.make_polygon([Vector(x_in, y, z) for z, y in in_pl], close=True)
    w_mid = Wire.make_polygon([Vector(700.0, y, z) for z, y in in_pl], close=True)
    w_out = Wire.make_polygon([Vector(1000.0, y, z) for z, y in out_pl], close=True)
    w_far = Wire.make_polygon([Vector(x_out, y, z) for z, y in out_pl], close=True)
    reg = Solid.make_loft([w_in, w_mid, w_out, w_far], ruled=True)
    return reg if side > 0 else reg.mirror(Plane.YZ)

def hinge(p=P):
    """Each door is a scissor door (the reveal, 18:55 to 19:10: the rear edge rises first, the door ends nearly
    vertical, leaning out a little). No photo shows the hinge. Round 6 chose one among 162 tried near the A-pillar's
    foot (tools/hinge_search.py, extended): the pivot on the skin at the foot of the A-pillar (950 out, 1,050 up,
    1,300 ahead), the axis leaning in, back and up a little, which swings the door with the measured shut line clear of
    every fixed part from 6 to 80 degrees and stands it at 80 as in the reveal. spec.md, "Doors"."""
    sx, sy = scales(p)
    pt = [900.0 * sx, yat(800.0, zf(1100.0, p), p), zf(1100.0, p)]
    ax = np.array([0.93, -0.37, 0.0]); ax /= np.linalg.norm(ax)
    return {'l': {'point': pt, 'axis': ax.tolist(), 'openDeg': 80},
            'r': {'point': [-pt[0], pt[1], pt[2]], 'axis': [ax[0], -ax[1], -ax[2]], 'openDeg': 80}}

# ------------------------------------------------------------------ black and lit parts

def splitter(p=P):
    """The splitter: a carbon lip 160 to 230 up (side photo), its front edge under the light bar's plan curve (nothing
    stands ahead of the nose: side photo), running the full width (front close-up, 19:51) and back under the car."""
    sy = p['roof_h'] / REF['roof_h']
    N, C = meas('nose_corner', p), meas('nose_centre', p)
    xs = np.linspace(0.0, N[0] + 20, 9)
    front = [(x, C[2] - (C[2] - N[2]) * min(1.0, x / N[0]) ** 2) for x in xs]
    back = zf(1880, p)
    poly = [(-x, z) for x, z in reversed(front[1:])] + front + [(N[0] + 20, back), (-(N[0] + 20), back)]
    return prism_xz(poly, 160 * sy, 230 * sy)

def nose_face(shell, p=P):
    """Below the light bar, between the legs, the nose is carbon and black (front photos): the body's skin there, from
    the bar down, inside the bar's ends, back to the end of the intake."""
    N = meas('nose_corner', p)
    z0, z1 = zf(1980, p), N[2] + 160               # back to where the intake ends under the hood (the face is all one
    y0 = 225 * p['roof_h'] / REF['roof_h']        # dark recess between the legs, down to the splitter: front close-up, 19:51)
    box = Box(2 * (N[0] - 6), N[1] - 9 - y0, z1 - z0).moved(Location((0, (N[1] - 9 + y0) / 2, (z0 + z1) / 2)))
    return shell & box, box

DIFF_X = 570.0                   # the diffuser's half width (rear_high: 990 px at the plate's 1.15 mm/px)
DIFF_BACK = -2000.0              # its fan bays' back wall (q34, reveal 19:40: the fans sit well inside)

def rear_lower(p=P):
    """The diffuser under the tail (reveal 19:40 close-up, rear_high, q34): a top shelf under the pale face; the nozzle
    panel below it; four open fan bays split by three vertical strakes between two end plates, the fans on the bays'
    back wall (fans()); a floor that ramps up from under the car to the tail."""
    sx, sy = p['half_w'] / REF['half_w'], p['roof_h'] / REF['roof_h']
    rz = lambda z: z * p['tail_z'] / REF['tail_z']
    X = DIFF_X * sx
    zt, zb = rz(-2195.0), rz(DIFF_BACK)
    box = lambda x0, x1, y0, y1, z0, z1: Box(x1 - x0, (y1 - y0) * sy, z1 - z0).moved(
        Location(((x0 + x1) / 2, (y0 + y1) / 2 * sy, (z0 + z1) / 2)))
    parts = [box(-X, X, 520, 565, zt, rz(-1780.0)),                       # shelf, under the pale face's black band
             box(-X, X, 440, 520, zt, zt + 25),                           # nozzle panel
             box(-X, X, 180, 440, zb - 20, zb),                           # back wall of the fan bays
             box(-X, X, 160, 180, rz(-2010.0), rz(-1700.0))]              # floor (rear_high: the diffuser ends
                                                                          # well clear of the ground)
    for x in (-X, -231 * sx, 0.0, 231 * sx, X):                           # end plates and strakes
        t = 14.0 if abs(x) == X else 8.0
        parts.append(box(x - t / 2, x + t / 2, 200, 520, rz(-2205.0), zb))
    out = parts[0]
    for b in parts[1:]:
        out = out + b
    return out

def plate(p=P):
    """The licence plate, 12 x 6 in (US), the scale reference (rear view: centred, 662 mm up at the first scale)."""
    y = yat(662, zf(-2222, p), p)
    return Box(304.8, 152.4, 4).moved(Location((0, y, zf(-2222, p) - 6)))

def nozzles(p=P):
    """Four thruster outlets in the diffuser's top row (rear view: 231 mm apart, 83 across, 495 up)."""
    out = []
    for x in (-346.5, -115.5, 115.5, 346.5):
        c = Plane(origin=(x * scales(p)[0], yat(495, zf(-2162, p), p), zf(-2162, p) - 30), z_dir=(0, 0, 1))
        ring = Solid.make_cylinder(46, 60, c) - Solid.make_cylinder(38, 61, c)
        out.append(ring)
    return out

def fans(p=P):
    """Four fans on the diffuser bays' back wall, one per bay under each nozzle (reveal 19:40: dark, ~270 across)."""
    sy = p['roof_h'] / REF['roof_h']
    z = DIFF_BACK * p['tail_z'] / REF['tail_z'] - 22
    out = []
    for x in (-346.5, -115.5, 115.5, 346.5):
        c = Plane(origin=(x * scales(p)[0], 290 * sy, z), z_dir=(0, 0, -1))
        out.append(Solid.make_cylinder(105, 18, c) + Solid.make_cylinder(40, 40, c))
    return out

def light_front(p=P):
    """The front light bar: a 10 mm strip along the hood's front edge, from corner to corner along its plan curve
    (measured: level, 468 up, its ends at the nose's corners)."""
    N, C = meas('nose_corner', p), meas('nose_centre', p)
    xs = np.linspace(-N[0], N[0], 15)
    pts = [(x, C[2] - (C[2] - N[2]) * (x / N[0]) ** 2) for x in xs]
    segs = []
    for (x0, z0), (x1, z1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0)
        a = math.degrees(math.atan2(z1 - z0, x1 - x0))
        b = Box(L + 2, 10, 6).rotate(Axis.Y, -a).moved(Location(((x0 + x1) / 2, N[1] - 8, (z0 + z1) / 2 + 1)))
        segs.append(b)
    out = segs[0]
    for b in segs[1:]:
        out = out + b
    return out

def light_rear(p=P):
    """The rear light housing across the tail (rear_high, q34, reveal 19:40): gloss black from the tail's top edge down
    to 770, a red bar 845 up running to 825 out (measured: rearbar_end), and a white trim line along its lower edge."""
    sy = p['roof_h'] / REF['roof_h']
    e = meas('rearbar_end', p)
    tc = meas('tail_corner', p)
    z = p['tail_z']                                # at the body's end (the measured corner is 25 mm inside it, within the
                                                   # fit's error)
    housing = Box(2 * tc[0] - 10, (tc[1] - 4 - 770 * sy), 8).moved(Location((0, (tc[1] - 4 + 770 * sy) / 2, z - 2)))
    bar = Box(2 * e[0], 14, 6).moved(Location((0, e[1], z - 6)))
    trim = Box(2 * tc[0] - 30, 6, 6).moved(Location((0, 773 * sy, z - 4)))
    return bar, housing, trim

SIDE_TRIM = [(1280, 635), (1113, 652), (944, 671), (944, 606), (1067, 601), (1201, 598)]   # (z, y) mm at REF
MARKER = [(1202, 636), (1068, 637), (1090, 603), (1157, 603)]
# the black strip under the shoulder crease from the front arch to the door, and the amber marker set in its front
# half as a wedge (side photo, through its camera onto the fender: round 6)

def side_trim(paint, p=P):
    """The side trim and marker, cut from the fender's skin (a 35 mm patch of shell, black or amber through)."""
    trim = prism_zy(mm_zy(SIDE_TRIM, p), -1400, 1400)
    mark = prism_zy(mm_zy(MARKER, p), -1400, 1400)
    return paint & (trim - mark), paint & mark, trim

HEADLIGHT = 0.47                 # the lens is the facet's lower part: its top edge 0.47 of the way up (front photo: 526 to 537 px)

def headlights(body, p=P):
    """The headlights: the lower point of each fender facet (the triangle nose corner, windshield corner, wrap corner),
    a lens 3 mm proud of it, cut by a line across the facet 0.47 of the way up (front photo, lit; hidden behind the
    facet's skin when off, the front three-quarter photo shows only its seams)."""
    N, W, A = meas('nose_corner', p), meas('ws_corner', p), meas('ws_wrap', p)
    nrm = np.cross(W - N, A - N); nrm /= np.linalg.norm(nrm)
    if nrm[1] < 0:
        nrm = -nrm
    out = []
    for sg in (1, -1):
        m = np.array([sg, 1, 1])
        tri = [N * m, (N + HEADLIGHT * (W - N)) * m, (N + HEADLIGHT * (A - N)) * m]
        n = nrm * m
        w = Wire.make_polygon([Vector(*(q + n * 0.5)) for q in tri], close=True)
        out.append(Solid.extrude(Face(w), Vector(*(n * 3))))
    return out

# ------------------------------------------------------------------ wheels (built at the origin, axis +x outward)

SPOKES = 6

def tyre(r, w, rim_r):
    """Section revolved about x: flat tread, rounded shoulders, sidewalls down to the rim flange."""
    sk = r - rim_r
    pts = [(rim_r, -w / 2 + 12), (rim_r + sk * 0.55, -w / 2), (r - 22, -w / 2 + 4), (r, -w / 2 + 25),
           (r, w / 2 - 25), (r - 22, w / 2 - 4), (rim_r + sk * 0.55, w / 2), (rim_r, w / 2 - 12)]
    # profile in the (radius, axial) plane: axial on x, radius on y, revolved about x
    prof = Wire.make_polygon([Vector(ax, rad, 0) for rad, ax in pts], close=True)
    return Solid.revolve(Face(prof), 360, Axis.X)

def rim(r, w, rim_r):
    """The aero disc (light, between the spokes) and the flange; the six double spokes are rim_spokes()."""
    face_x = w / 2 - 18
    disc = Solid.make_cylinder(rim_r - 8, 16, Plane(origin=(face_x - 30, 0, 0), z_dir=(1, 0, 0)))
    barrel = Solid.make_cylinder(rim_r, w - 30, Plane(origin=(-w / 2 + 15, 0, 0), z_dir=(1, 0, 0))) - \
        Solid.make_cylinder(rim_r - 14, w, Plane(origin=(-w / 2, 0, 0), z_dir=(1, 0, 0)))
    return disc + barrel

def rim_spokes(r, w, rim_r):
    """Six spokes, each an open frame of two gunmetal arms (Roadster_70, the wheel close-up): 26 mm apart at the hub,
    widening to 76 at the rim, faceted, standing 16 proud of the disc; a six-lobed hub joins them under a round cap
    (the T badge left out)."""
    face_x = w / 2 - 18
    res = Solid.make_cylinder(92, 26, Plane(origin=(face_x - 20, 0, 0), z_dir=(1, 0, 0)))
    res = res + Solid.make_cylinder(62, 12, Plane(origin=(face_x + 4, 0, 0), z_dir=(1, 0, 0)))
    r0, r1 = 70.0, rim_r - 14
    for i in range(SPOKES):
        a = 2 * math.pi * i / SPOKES
        for sg in (-1, 1):
            p0, p1 = (r0, sg * 16.0), (r1, sg * 42.0)          # (radius, sideways) along the arm's centre line
            L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            tilt = math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))
            arm = Box(18, L, 24).rotate(Axis.X, -tilt).moved(Location((face_x - 4, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)))
            res = res + arm.rotate(Axis.X, math.degrees(a))
    return res

def rim_inserts(r, w, rim_r):
    """The bronze blade inside each spoke's frame, set 14 mm back (Roadster_70: from 0.35 to 0.9 of the rim's radius)."""
    face_x = w / 2 - 18
    out = []
    for i in range(SPOKES):
        a = 2 * math.pi * i / SPOKES
        r0, r1 = 0.35 * rim_r, 0.9 * rim_r
        b = Box(14, r1 - r0, 14).moved(Location((face_x - 18, (r0 + r1) / 2, 0)))
        out.append(b.rotate(Axis.X, math.degrees(a)))
    res = out[0]
    for b in out[1:]:
        res = res + b
    return res

# ------------------------------------------------------------------ assembly of the parts

VIEW_DARK = {
    'side': ['tyre_fl', 'tyre_rl', 'sill', 'splitter', 'rear_lower', 'glass'],
    'front': ['tyre_fl', 'tyre_fr', 'splitter', 'glass'],
    'rear': ['tyre_rl', 'tyre_rr', 'rear_lower', 'sill', 'glass'],
    'top': ['glass'],
    'all': [],
}

def mm_zy(poly, p):
    """A side-view polygon (z, y) given in mm at REF's sizes, scaled to p's."""
    return [(z * (p['nose_z'] / REF['nose_z'] if z > 0 else p['tail_z'] / REF['tail_z']), y * p['roof_h'] / REF['roof_h'])
            for z, y in poly]

REAR_FACE_X = 780.0              # the pale rear face's outer edges (rear_high: 37 px inside the light housing's ends; q34)
REAR_FACE_LOW = 670.0            # its lower edge (rear_high, by the plate: 7 mm over the plate's centre); black below
CORNER_TOP = [(-1880, 560), (-2090, 668), (-2300, 770)]   # the carbon rear corner's top edge, from behind the rear arch up
                                                          # to the light housing (side photo; reveal frame 19:40)

def black_rear_corner(p=P):
    """Black below the tail's pale face: the carbon corners behind the rear wheels (outboard of the pale face, up to a
    line rising from the arch to the light housing) and the band under the pale face across the whole tail (rear_high,
    q34, reveal 19:40). The pale face itself, with the plate on its lower edge, is paint."""
    corner = prism_zy(mm_zy([(CORNER_TOP[0][0], 0)] + CORNER_TOP + [(CORNER_TOP[-1][0], 0)], p), -1400, 1400)
    sx = p['half_w'] / REF['half_w']
    outside = Box(1400, 2000, 3000).moved(Location((REAR_FACE_X * sx + 700, 1000, -1500)))
    outside = outside + outside.mirror(Plane.YZ)
    low = prism_zy(mm_zy([(-1950, 0), (-1950, REAR_FACE_LOW), (-2300, REAR_FACE_LOW), (-2300, 0)], p), -1400, 1400)
    return (corner & outside) + low

def reflectors(p=P):
    """Red reflector strips along the carbon corners' top edge, behind the rear arches (q34: 2,470 to 2,575 px)."""
    sx = p['half_w'] / REF['half_w']
    (z0, y0), (z1, y1) = mm_zy(CORNER_TOP[:2], p)
    out = []
    for sg in (1, -1):
        x = sg * (at(0.5 * (z0 + z1), 'xs', p) - 6)
        L = math.hypot(z1 - z0, y1 - y0) * 0.75
        a = math.degrees(math.atan2(y1 - y0, z0 - z1))
        b = Box(10, 16, L).rotate(Axis.X, a).moved(Location((x, 0.5 * (y0 + y1) + 10, 0.5 * (z0 + z1))))
        out.append(b)
    return out

# ------------------------------------------------------------------ cabin
# No interior size is published. The layout is read from Tesla's interior photos (Roadster_63 to 69) and the reveal's
# open-door frames (19:00 to 19:10); the sizes are a two-seat sports car's (SAE J1100 ranges: hip point ~ 250 above the
# floor, back angle ~ 30 degrees), so every size below is an estimate (spec.md, "Cabin").
BELT = 820.0                     # the tub's black lining runs up to here (the side glass's lower edge is higher)
SEAT_X = 340.0                   # seat centre lines (left-hand drive: the driver on the car's left, +x)

def tub(p=P):
    """The cabin's black lining (alcantara and carbon in the photos): an 8 mm skin 1 mm inside the body's inner surface,
    up to the beltline (above it is glass, and the black roof spine)."""
    lining = cavity(p, SHELL_T + 1) - cavity(p, SHELL_T + 9)
    return lining & Box(3000, BELT, 6000).moved(Location((0, BELT / 2, 0)))

def interior(p=P):
    """Seats, dash, yoke, screen and console (Roadster_63 to 69): one-piece buckets with integrated headrests, light
    grey, on dark shells; a long low dash; the yoke on a column ahead of the driver; the touchscreen on a stalk to its
    right; a light console between the seats."""
    sy = p['roof_h'] / REF['roof_h']
    fl = 185.0 * sy                                          # the floor's top (the tub's lining over the body's floor)
    out = {'seats': [], 'seat_shells': [], 'dash': [], 'yoke': [], 'screen': [], 'console': []}
    def plate(pts, x0, x1):
        w = Wire.make_polygon([Vector(x0, y, z) for z, y in pts], close=True)
        return Solid.extrude(Face(w), Vector(x1 - x0, 0, 0))
    for sg in (1, -1):
        x = sg * SEAT_X
        cushion = plate([(400, fl + 60), (380, fl + 150), (-180, fl + 120), (-240, fl + 40)], x - 250, x + 250)
        back = plate([(-180, fl + 120), (-240, fl + 40), (-500, fl + 520), (-360, fl + 560)], x - 245, x + 245) + \
            plate([(-360, fl + 560), (-500, fl + 520), (-640, fl + 860), (-560, fl + 900)], x - 150, x + 150)   # the
        # headrest is the back's narrow top (Roadster_64): the cabin narrows overhead
        bolsters = plate([(350, fl + 140), (330, fl + 230), (-200, fl + 200), (-200, fl + 120)], x - 265, x - 195) + \
            plate([(350, fl + 140), (330, fl + 230), (-200, fl + 200), (-200, fl + 120)], x + 195, x + 265) + \
            plate([(-260, fl + 120), (-470, fl + 520), (-400, fl + 560), (-200, fl + 200)], x - 265, x - 200) + \
            plate([(-260, fl + 120), (-470, fl + 520), (-400, fl + 560), (-200, fl + 200)], x + 200, x + 265)
        out['seats'] += [cushion + back + bolsters]
        out['seat_shells'] += [plate([(-250, fl + 30), (-520, fl + 540), (-570, fl + 530), (-300, fl + 10)], x - 230, x + 230) +
                               plate([(-520, fl + 540), (-650, fl + 870), (-700, fl + 860), (-570, fl + 530)], x - 140, x + 140)]
    dash = plate([(1300, 520 * sy), (1300, 760 * sy), (1010, 760 * sy), (880, 690 * sy), (880, 560 * sy), (1100, 380 * sy)], -760, 760)
    out['dash'] = [dash]
    col = Solid.make_cylinder(32, 300, Plane(origin=(SEAT_X, 600 * sy, 1000), z_dir=(0, -0.25, -1)))
    yz = 1000 - 290
    rim = Box(300, 150, 30) - Box(220, 70, 40)
    rim = rim.moved(Location((SEAT_X, 600 * sy - 70, yz)))
    out['yoke'] = [col + rim]
    scr = Box(320, 200, 18).rotate(Axis.X, 20).moved(Location((40, 790 * sy, 930)))
    out['screen'] = [scr + Box(30, 120, 30).moved(Location((40, 700 * sy, 960)))]
    out['console'] = [plate([(620, fl), (620, fl + 160), (300, fl + 260), (-380, fl + 300), (-420, fl), ], -110, 110)]
    return {k: Compound(v) if len(v) > 1 else v[0] for k, v in out.items()}

FRUNK_SEAM = 1803.0              # the frunk lid's rear seam, straight across the hood (top view: 1,405 px; front photo)

def seams(p=P):
    """Panel gaps cut into the paint, 4 mm wide and 6 deep: the hood's two side seams (top view: dark lines from the
    light bar's ends to the windshield's corners) and the frunk lid's seam across the hood."""
    N, W = meas('nose_corner', p), meas('ws_corner', p)
    zs = FRUNK_SEAM * p['nose_z'] / REF['nose_z']
    t = (N[2] - zs) / (N[2] - W[2])
    E = N + t * (W - N)
    cuts = []
    def groove(a, b):
        a, b = np.asarray(a, float), np.asarray(b, float)
        L = float(np.linalg.norm(b - a))
        d = (b - a) / L
        up = np.array([0.0, 1.0, 0.0]); side = np.cross(d, up); side /= np.linalg.norm(side); up = np.cross(side, d)
        loc = Location(Plane(origin=tuple((a + b) / 2), x_dir=tuple(side), z_dir=tuple(d)))
        return Box(4, 12, L).moved(loc)
    for sg in (1, -1):
        m = np.array([sg, 1, 1])
        cuts.append(groove(N * m + [0, 0, -4], W * m + [0, 0, 8]))
    cuts.append(groove([-E[0] + 4, E[1], zs], [E[0] - 4, E[1], zs]))
    out = cuts[0]
    for c in cuts[1:]:
        out = out + c
    return out

WING_T = 40.0                    # the stowed wing's skin: the deck panel from the seam to the tail's top edge

def wing_region(p, grow=0.0):
    """The stowed wing (top view: a seam straight across at the rear glass's lower corners, the panel back to the tail's
    top edge; rear_high: the seam runs out to the body's edges, stepping up over the fins), as a region of the deck."""
    G, C = meas('rear_glass_corner', p), meas('tail_corner', p)
    C[2] = p['tail_z']                             # the wing ends at the body's end
    z0, z1 = G[2] - grow, C[2] - 30
    zs = np.linspace(z0, C[2] + 5, 6)
    lo = [(z, at(z, 'yc', p) - WING_T + grow) for z in zs]
    poly = [(z0, 1600.0)] + [(z1, 1600.0)] + [(z1, lo[-1][1])] + lo[::-1]
    reg = prism_zy(poly, -(C[0] + 20), C[0] + 20)
    return reg

def wing_hinge(p=P):
    """The wing rises on two swan-neck struts and tilts (reveal 19:38 to 19:40, Roadster_76, 91, 94, 99). The struts'
    path is not published; one turn stands in for it: about a cross axis at the deck's height 550 mm ahead of the seam,
    30 degrees, which lifts the panel's front edge 0.28 m and its trailing edge 0.43 m, as the raised photos stand
    (clear of the deck, trailing edge highest). A guess (spec.md, "Wing")."""
    G = meas('rear_glass_corner', p)
    return {'point': [0.0, G[1] + 10.0, G[2] + 550.0], 'axis': [1.0, 0.0, 0.0], 'openDeg': 30}

def build(p=P, doors=True):
    body = body_solid(p)
    for c in arch_cuts(p):
        body = body - c
    shell = body - cavity(p)
    gh = greenhouse(p) - cavity(p)
    ws, roof_l, rear, outer_l = glass_regions(p)
    side_reg = both(prism_zy(zy(SIDE_GLASS, p), 300, 1400) & outer_l) - ws
    parts = {}
    parts['glass_ws'] = gh & ws
    parts['glass_rear'] = gh & rear
    parts['glass_side'] = gh & side_reg
    roof = gh & (roof_l + roof_l.mirror(Plane.YZ))
    sill = shell & prism_zy(zy(SILL_TOP + [(-1150, 0), (1150, 0)], p), -1300, 1300)
    brc = shell & black_rear_corner(p)
    paint = shell - prism_zy(zy(SILL_TOP + [(-1150, 0), (1150, 0)], p), -1300, 1300) - black_rear_corner(p)
    parts['sill'] = sill
    parts['black_rear_corner'] = brc
    lining = tub(p)
    if doors:
        # Ahead of the A-pillar line (and below its foot, ahead of the foot) stays fender and windshield, with the door's
        # 3 mm gap each side. The photo's shut line runs further forward below the shoulder crease (847 at the sill, 947
        # at the crease: round 6), but with the guessed hinge any door there lifts into the fender over it; the real
        # hinge must swing the door's front out first, which no photo shows (spec.md, "Doors").
        g = GAP / 2
        keep_door, keep_body = ws.moved(Location((0, 0, -g))), ws.moved(Location((0, 0, g)))
        for sg, k in ((1, 'l'), (-1, 'r')):
            reg_in, reg_out = door_region(p, -GAP / 2, sg) - keep_door, door_region(p, GAP / 2, sg) - keep_body
            parts[f'door_card_{k}'] = lining & reg_in          # the door's inside: black, with its red light strip
            lining = lining - reg_out
            parts[f'door_{k}'] = paint & reg_in
            parts[f'door_glass_{k}'] = (parts['glass_side'] + roof) & reg_in
            paint = paint - reg_out
        ahead = prism_zy([(zf(-300, p), 0), (zf(3000, p), 0), (zf(3000, p), 2000), (zf(-300, p), 2000)], -1500, 1500)
        parts['glass_side'] = parts['glass_side'] - door_region(p, GAP / 2, 1) - door_region(p, GAP / 2, -1) - ahead
        parts['glass_roof'] = roof - door_region(p, GAP / 2, 1) - door_region(p, GAP / 2, -1)
    else:
        parts['glass_roof'] = roof
    wing = wing_region(p, -GAP / 2)
    parts['wing'] = paint & wing
    paint = paint - wing_region(p, GAP / 2)
    face, face_region = nose_face(paint, p)
    parts['nose_face'] = face
    parts['body'] = paint - face_region - seams(p)
    parts['tub'] = lining
    parts.update(interior(p))
    parts['splitter'] = splitter(p)
    parts['rear_lower'] = rear_lower(p)
    parts['plate'] = plate(p)
    parts['nozzles'] = Compound(nozzles(p))
    parts['fans'] = Compound(fans(p))
    parts['light_front'] = light_front(p)
    parts['light_rear'], parts['light_rear_band'], parts['tail_trim'] = light_rear(p)
    parts['reflectors'] = Compound(reflectors(p))
    parts['side_trim'], parts['markers'], trim_region = side_trim(parts['body'], p)
    parts['body'] = parts['body'] - trim_region
    parts['headlights'] = Compound([h for h in headlights(body, p) if h])
    return parts

FIT_STEP = 300.0                 # coarser sections for the fit: each evaluation is one build

def fit_parts(p=P):
    """For the fit: the body and glass in one piece (doors shut), the black parts and tyres at their places.
    Coarse sections (FIT_STEP) and one glass part: an evaluation takes ~1 s instead of 4."""
    S = st(p, FIT_STEP)
    body = loft_polys([(full_poly(s), s['z']) for s in S])
    for c in arch_cuts(p):
        body = body - c
    out = {'body': body, 'splitter': splitter(p), 'rear_lower': rear_lower(p)}
    G = [s for s in S if zf(-1850, p) - 1 <= s['z'] <= zf(1700, p) + 1]
    gh = loft_polys([(top_poly(s), s['z']) for s in G])
    ws, roof_l, rear, outer_l = glass_regions(p)
    side = prism_zy(zy(SIDE_GLASS, p), 300, 1400) & outer_l
    out['glass'] = gh & (ws + roof_l + roof_l.mirror(Plane.YZ) + rear + side + side.mirror(Plane.YZ))
    sill_reg = prism_zy(zy(SILL_TOP + [(-1150, 0), (1150, 0)], p), -1300, 1300)
    out['sill'] = body & (sill_reg + black_rear_corner(p))
    for k, (x, y, z) in wheel_centres(p).items():
        r = p['r_f'] if k[0] == 'f' else p['r_r']
        w = p['w_f'] if k[0] == 'f' else p['w_r']
        out[f'tyre_{k}'] = Solid.make_cylinder(r, w, Plane(origin=(x - w / 2, y, z), z_dir=(1, 0, 0)))
    return out

def landmarks(p=P):
    c = wheel_centres(p)
    L = {f'wheel_{k}': v for k, v in c.items()}
    for k, (x, y, z) in c.items():
        L[f'contact_{k}'] = [x, 0.0, z]
    z = zf(-2222, p) - 8
    for nm, sx_, sy_ in (('plate_Lt', 1, 1), ('plate_Rt', -1, 1), ('plate_Lb', 1, -1), ('plate_Rb', -1, -1)):
        L[nm] = [sx_ * 152.4, yat(662, z, p) + sy_ * 76.2, z]     # L: the car's left (+x): on the left of a rear view (seen from behind)
    for nm in MEAS:                                           # the measured features (MEAS), for the fit and the review,
        L[nm] = meas(nm, p).tolist()                          # and their twins on the car's right
        L[nm + '_R'] = (meas(nm, p) * [-1, 1, 1]).tolist()
    L['lightbar_f_L'] = meas('nose_corner', p).tolist()
    L['lightbar_f_R'] = (meas('nose_corner', p) * [-1, 1, 1]).tolist()
    return L

if __name__ == '__main__':
    import shutil, time
    t0 = time.time()
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir()
    parts = build()
    for name, shape in parts.items():
        v = shape.volume if hasattr(shape, 'volume') else 0
        print(f'  {name}: volume {v / 1e6:.1f} L')
        fine = name in ('body',) or name.startswith(('glass', 'door'))
        save(shape, name, tolerance=0.08 if fine else 0.3, angular=0.08 if fine else 0.25)
    # wheels, one per axle size, at the origin
    geo = {'wheels': wheel_centres(), 'hinges': hinge(), 'wing': wing_hinge(), 'P': P}
    for ax in ('f', 'r'):
        r, w = P[f'r_{ax}'], P[f'w_{ax}']
        rr = P['rim_ratio'] * r
        save(tyre(r, w, rr), f'tyre_{ax}', tolerance=0.6, angular=0.3)
        save(rim(r, w, rr), f'rim_{ax}', tolerance=0.5, angular=0.3)
        save(rim_spokes(r, w, rr), f'spokes_{ax}', tolerance=0.5, angular=0.3)
        save(rim_inserts(r, w, rr), f'inserts_{ax}', tolerance=0.5, angular=0.3)
    (OUT / 'geometry.json').write_text(json.dumps(geo, indent=1))
    print(f'cad: {len(parts)} parts -> {OUT} in {time.time() - t0:.0f} s')
