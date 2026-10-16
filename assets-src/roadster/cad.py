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
        out.append(d)
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
    return [(s['xs'] - TUCK, s['yb']), (s['xs'], s['ymid']), (s['xsh'], s['ysh']), (s['xe'], s['ye']),
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

def cavity(p=P):
    S = [s for s in st(p) if zf(CABIN[1], p) - 1 <= s['z'] <= zf(CABIN[0], p) + 1]
    polys = []
    for s in S:
        pl = inset(full_poly(s), SHELL_T)
        floor = s['yb'] + 60
        pl = [(x, max(y, floor)) for x, y in pl]
        polys.append((pl, s['z']))
    return loft_polys(polys)

def greenhouse(p=P):
    """The glass envelope over the cabin and the rear deck: the sections' top part, 2 mm proud."""
    S = [s for s in st(p) if zf(-1850, p) - 1 <= s['z'] <= zf(1700, p) + 1]
    return loft_polys([(top_poly(s), s['z']) for s in S])

# Regions (spec.md, "Glass and doors"), in z (front +) and y, at the first scale; scaled with the body.
WS_BASE = [(0, 1725), (400, 1705), (740, 1615)]           # windshield's lower edge, top view (x, z)
SPINE = 114.0                                             # half width of the fixed roof spine between the doors (top view)
ROOF_FRONT, ROOF_REAR = 560.0, -700.0                     # the doors' roof glass, top view
REAR_GLASS_TIP = -1760.0
SIDE_GLASS = [(803, 826), (-358, 907), (-1076, 1112), (-1000, 1320), (349, 1320), (349, 1157)]
# side window (z, y): traced on the side photo and back-projected through its solved camera onto the glass (x = 820 at
# the beltline, 600 at the top); generous above the roof edge, where the greenhouse cuts it
SILL_TOP = [(1150, 270), (1031, 272), (-144, 309), (-955, 437), (-1150, 445)]     # white body's lower edge, side view (back-projected)
DOOR = [(834, 282), (889, 761), (889, 836), (349, 1157), (560, 1250), (560, 1500), (-700, 1500), (-700, 1150), (-340, 910),
        (-192, 321)]
# door shut lines (z, y): back-projected from the side photo (x = 950 on the body, 820 on the glass), the front edge
# held 14 mm further back than the photo's line so the door clears the A-pillar as it swings; the roof glass's
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
    base = xz(WS_BASE, p)                                  # the windshield's lower edge across the hood (top view)
    behind_base = prism_xz([(-1500.0, base[-1][1])] + [(-x, z) for x, z in reversed(base[1:])] + base +
                           [(1500.0, base[-1][1]), (1500.0, -3000.0), (-1500.0, -3000.0)], 300, 1600)
    windshield = (ahead + (inside_rail - behind_roof_front)) & behind_base
    zs_rear = np.linspace(zf(ROOF_REAR - 8, p), zf(REAR_GLASS_TIP + 20, p), 8)
    side = [(rr(z), z) for z in zs_rear]
    rear = prism_xz(side + [(0.0, zf(REAR_GLASS_TIP, p))] + [(-x, z) for x, z in reversed(side)], 500, 1600)
    zs_out = np.linspace(zf(1700, p), zf(-1150, p), 14)
    outer_l = prism_xz([(rr(z, 50), z) for z in zs_out] + [(1400, zs_out[-1]), (1400, zs_out[0])], 500, 1600)
    return windshield, roof_l, rear, outer_l

DOOR_DRAFT = 45.0                # the door's edges lean in by this much from its outer skin to the cabin side

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
    """Each door is dihedral: it turns about an axis through the A-pillar's foot, at the top of the front fender
    (pivot), leaning in and back so the door rises with its rear end first and swings out. No photo shows the hinge.
    The axis was chosen among 225 tried (tools/hinge_search.py) as one that swings the door clear of every fixed part
    from shut to 80 degrees, with the door at 65 degrees standing as in Roadster_96 and 99 (its rear end over the
    middle of the cabin, about 2.3 m up). spec.md, "Doors"."""
    sx, sy = scales(p)
    pt = [900.0 * sx, yat(800.0, zf(1100.0, p), p), zf(1100.0, p)]
    ax = np.array([0.93, -0.37, 0.0]); ax /= np.linalg.norm(ax)
    return {'l': {'point': pt, 'axis': ax.tolist(), 'openDeg': 65},
            'r': {'point': [-pt[0], pt[1], pt[2]], 'axis': [ax[0], -ax[1], -ax[2]], 'openDeg': 65}}

# ------------------------------------------------------------------ black and lit parts

def splitter(p=P):
    """Front lower: the black intake under the nose face, as wide as the face (front photo: between the white lower
    corners), widening under the fenders, and the splitter under it (side view: flush with the nose face)."""
    polys = []
    for z, xh, top in ((2368, 190, 300), (2330, 390, 285), (2290, 520, 265), (2250, 560, 250), (2050, 650, 240), (1880, 650, 240)):
        z, xh = zf(z, p), xh * scales(p)[0]
        polys.append(([(-xh, 105 * scales(p)[1]), (xh, 105 * scales(p)[1]), (xh, yat(top, z, p)), (-xh, yat(top, z, p))], z))
    return loft_polys(polys)

def rear_lower(p=P):
    """The black rear lower: the fan box between the wheels under the plate panel (Roadster_91: 1,370 px wide, top 578
    mm up at the plate's 0.917 mm/px), its face 60 mm ahead of the tail's top edge (side view), back to the axle."""
    polys = []
    for z, xh in ((-2162, 630), (-2000, 630), (-1880, 630), (-1750, 600)):
        z, xh = zf(z, p), xh * scales(p)[0]
        top = yat(578, z, p)
        polys.append(([(-xh, 115 * scales(p)[1]), (xh, 115 * scales(p)[1]), (xh, top), (-xh, top)], z))
    return loft_polys(polys)

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
    """Four fan housings below the nozzles (rear view: dark, ~270 across, 300 up), recessed in the diffuser."""
    out = []
    for x in (-346.5, -115.5, 115.5, 346.5):
        c = Plane(origin=(x * scales(p)[0], yat(300, zf(-2162, p), p), zf(-2162, p) - 3), z_dir=(0, 0, 1))
        out.append(Solid.make_cylinder(105, 5, c))
    return out

LIGHT_BAR_F = [(0, 2372), (180, 2369), (360, 2331), (500, 2291)]    # (x, z) along the nose's top edge, first read

def light_front(p=P):
    """The front light bar along the nose's top edge, which curves back to the corners in plan (top view; front
    three-quarter photo: it runs from corner to corner)."""
    sx = scales(p)[0]
    pts = [(-x * sx, zf(z, p)) for x, z in reversed(LIGHT_BAR_F)] + [(x * sx, zf(z, p)) for x, z in LIGHT_BAR_F[1:]]
    segs = []
    for (x0, z0), (x1, z1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0)
        a = math.degrees(math.atan2(z1 - z0, x1 - x0))
        y = yat(493, (z0 + z1) / 2, p)
        b = Box(L + 4, 12, 6).rotate(Axis.Y, -a).moved(Location(((x0 + x1) / 2, y, (z0 + z1) / 2 + 2)))
        segs.append(b)
    out = segs[0]
    for b in segs[1:]:
        out = out + b
    return out

def light_rear(p=P):
    """The rear light bar across the tail (rear view: 834 mm up, nearly the full width), and its dark band below."""
    z = zf(-2222, p) - 2
    w = 2 * 0.98 * at(z + 2, 'xs', p)        # rear view: the red bar is 0.98 of the tail's width at its height
    bar = Box(w, 22, 6).moved(Location((0, yat(834, z, p), z)))
    band = Box(w, 45, 4).moved(Location((0, yat(795, z, p), z + 1)))
    return bar, band

def markers(p=P):
    """Side markers just ahead of the doors (side view: amber, 120 long, at 650 high)."""
    out = []
    for sg in (1, -1):
        z = zf(1000, p)
        x = sg * (at(z, 'xs', p) - 8)
        out.append(Box(14, 22, 120).moved(Location((x, yat(650, z, p), z))))
    return out

def headlights(body, p=P):
    """The headlights: an inverted triangle of lens on each front corner facet, its point at the light bar's end
    (front photo: 68 px wide at the top, 65 px tall, over 580 px of light bar). Cut from the body's own surface:
    the body inside the triangle seen from the front, less the body moved 4 mm back, leaves a 4 mm skin."""
    sx = scales(p)[0]
    z0, z1 = zf(1900, p), zf(2450, p)
    out = []
    for sg in (1, -1):
        tri = [(sg * 500 * sx, yat(493, z1, p)), (sg * 545 * sx, yat(552, z1, p)), (sg * 455 * sx, yat(552, z1, p))]
        w = Wire.make_polygon([Vector(x, y, z0) for x, y in tri], close=True)
        prism = Solid.extrude(Face(w), Vector(0, 0, z1 - z0))
        out.append((body & prism) - body.moved(Location((0, 0, -4))))
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
    """Six dark double spokes standing proud of the disc, and the centre cap."""
    face_x = w / 2 - 18
    out = []
    for i in range(SPOKES):
        a = 2 * math.pi * i / SPOKES
        for off in (-22.0, 22.0):
            L = rim_r - 60
            bar = Box(14, L, 16).moved(Location((face_x - 6, L / 2 + 50, off)))
            out.append(bar.rotate(Axis.X, math.degrees(a)))
    cap = Solid.make_cylinder(75, 20, Plane(origin=(face_x - 14, 0, 0), z_dir=(1, 0, 0)))
    res = cap
    for b in out:
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

def black_rear_corner(p=P):
    """Below the tail light line behind the rear wheels, the body is black (side and rear views)."""
    pl = zy([(-1700, 120), (-1700, 600), (-2240, 640), (-2240, 120)], p)
    return prism_zy(pl, -1300, 1300)

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
    if doors:
        for sg, k in ((1, 'l'), (-1, 'r')):
            reg_in, reg_out = door_region(p, -GAP / 2, sg) - ws, door_region(p, GAP / 2, sg)
            parts[f'door_{k}'] = paint & reg_in
            parts[f'door_glass_{k}'] = (parts['glass_side'] + roof) & reg_in
            paint = paint - reg_out
        ahead = prism_zy([(zf(-300, p), 0), (zf(3000, p), 0), (zf(3000, p), 2000), (zf(-300, p), 2000)], -1500, 1500)
        parts['glass_side'] = parts['glass_side'] - door_region(p, GAP / 2, 1) - door_region(p, GAP / 2, -1) - ahead
        parts['glass_roof'] = roof - door_region(p, GAP / 2, 1) - door_region(p, GAP / 2, -1)
    else:
        parts['glass_roof'] = roof
    parts['body'] = paint
    parts['splitter'] = splitter(p)
    parts['rear_lower'] = rear_lower(p)
    parts['plate'] = plate(p)
    parts['nozzles'] = Compound(nozzles(p))
    parts['fans'] = Compound(fans(p))
    parts['light_front'] = light_front(p)
    parts['light_rear'], parts['light_rear_band'] = light_rear(p)
    parts['markers'] = Compound(markers(p))
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
    L['nose_top'] = [0.0, p['nose_h'], zf(2370, p)]
    zl = zf(2291, p)
    for nm, sg in (('lightbar_f_L', 1), ('lightbar_f_R', -1)):
        L[nm] = [sg * 500 * scales(p)[0], yat(493, zl, p), zl]   # the front light bar's ends, at the nose's corners
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
    geo = {'wheels': wheel_centres(), 'hinges': hinge(), 'P': P}
    for ax in ('f', 'r'):
        r, w = P[f'r_{ax}'], P[f'w_{ax}']
        rr = P['rim_ratio'] * r
        save(tyre(r, w, rr), f'tyre_{ax}', tolerance=0.6, angular=0.3)
        save(rim(r, w, rr), f'rim_{ax}', tolerance=0.5, angular=0.3)
        save(rim_spokes(r, w, rr), f'spokes_{ax}', tolerance=0.5, angular=0.3)
    (OUT / 'geometry.json').write_text(json.dumps(geo, indent=1))
    print(f'cad: {len(parts)} parts -> {OUT} in {time.time() - t0:.0f} s')
