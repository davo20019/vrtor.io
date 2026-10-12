"""Rigid parts of the Cybertruck, in millimetres, exported as STL to parts/, plus parts/geometry.json for assemble.py.

Frame: front faces +z, up +y, +x is the truck's left side. Origin on the ground, midway between the axles.
spec.md's s (distance back from the light bar), h (height) and w (half-width) map to z = ZF - s, y = h, x = w.

The steel faces are flat. The side facets use half-spaces; the hood and windshield are bounded to
their own regions because their documented junction is concave (see spec.md, "Structure"). Uncertain sizes live in P
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
    roof_half=650.0, tail_half=930.5, side_tail_h=1259.1,
    arch_top_h=980.0, arch_top_half=310.0, arch_knee_h=660.0, arch_foot_half=590.0, flare_band=75.0,
    bumper_r_h=600.0, bumper_r_out=60.0,
    front_bar_h=22.0,
    roofglass_end_s=3000.0, a_pillar_s=1420.0, c_pillar_s=3617.0,
    seam_1=1503.0, seam_2=2636.0, seam_3=3638.0,
    squash=15.0, cover_dish=15.0,
    win_margin=40.0, rocker_h=110.0, tab_drop=45.0, bumper_f_bot=330.0, bumper_r_bot=400.0,
)
# The cargo bed and the powered tonneau, in spec.md's s and h (see "Bed and tonneau, measured").
BED = dict(
    floor_below_tail=503.8,     # Manual, cargo bed B: floor to the top of the tailgate
    front_s=3720.0,             # foot of the front wall (drawing: 3,651; held 20 mm behind the cab's back wall)
    canister_s=3925.0,          # the canister's rear face, where the slats come out (drawing: the bed's top front, 3,913)
    canister_h=1350.0,          # the canister's rear face is vertical down to here, then the wall slopes to the floor
    tailgate_s=5511.0,          # inside face of the tailgate (drawing)
    half=735.0,                 # side walls, inside (manual's top view: 1,470 between them, all along)
    floor_half=1295.4 / 2,      # Manual, cargo bed C: width at the floor, between the wheel-well humps
    hump=(3970.0, 4188.0, 4876.0, 5085.0), hump_h=1074.0,      # wheel-well humps (drawing): foot, top, top, foot
    cover_half=760.0,           # the slats, across: 25 mm over each wall into the rails' tracks
    slat_pitch=100.0, slat_t=10.0, slat_gap=2.0,                # slats every ~100 mm (close-up video), 10 mm thick
    coil_s=3810.0, coil_r=100.0, coil_step=13.0,                # the canister's coil: centre s, outer radius, growth a turn
    # The tailgate (c069, rear, tonneau shut; c056, open): the steel panel nearly the truck's width, from
    # just above the red corner lights to the light band, and the band's middle above it, between the
    # pillars' corner blocks. Hinged on its outer face so that open, its inside lies level with the floor.
    gate_half=926.0, gate_bottom=735.0, band_h=1200.0, band_half=806.0,
    # The under-bed compartment (manual: 97 L, lid hinged at its front edge, handle at the back).
    tub=(5095.0, 5480.0, 540.0, 590.0),        # s0, s1, half-width, bottom h
    lid=(5080.0, 5495.0, 560.0),               # s0 (hinge), s1, half-width
    # The outlet cover on the left wall (manual, Cargo Bed Outlets: two 120 V over one 240 V; pull its back edge).
    outlets=(5350.0, 5455.0, 920.0, 1130.0),   # s0 (hinge), s1, h0, h1
)

PARAMS = HERE / 'params.json'
if PARAMS.exists():
    P.update(json.loads(PARAMS.read_text()))
# The front corner, measured on c059 through its solved camera (long lens, checked on the front wheel centre within
# 20 mm; spec.md, "Front corner, measured"). These replace fitted values the outline couldn't see (the fit's dark
# cut-out merges the bumper, the flare and the tyre), so a refit doesn't move them.
P.update(
    # The nose, from the manual's side and top views (refs/tesla, the dimensions page; scaled by the tyre and the
    # length) and c059: the light bar 1,050 high (side view 1,061; c059 1,024 to 1,084), the face nearly vertical
    # (side view: 10 to 20 mm), flat to 625 either side of the centreline, then the corner facets back to 290 behind
    # the light bar at the sides (top view: 628 and 620; 285 at 945 out), the bar dropping ~25 mm round them (c059).
    nose_h=1050.0, face_rake=20.0, nose_flat_half=625.0, corner_s=290.0, shoulder_drop=73.0,
    bumper_f_h=650.0,                # bumper top at the corner (c059: 652 to 664)
    lamp_h=32.0,                     # the lower lamp strip between the bumper and the steel at the sides (c059: steel ends at 684)
    lamp_h_centre=67.0,              # and across the centre face (c150 at its crease scale: 717; the manual's front view: 719)
    arch_top_h=1030.0,               # outer face top of the flares; their bevel rises another flare_bevel to the body
    flare_band=42.0,                 # flare face seen from the side; opening top at 988 (c059: 990)
    flare_bevel=30.0,                # the bevelled upper edge (c059: lit strip up to 1,042 to 1,060)
    arch_f_foot_half=588.0,          # the front flare's leg ends on the bumper top, 290 behind the light bar (c059: 283 to 307)
    bumper_side_s=352.0,             # the bumper's side face ends just ahead of the tyre (c059: 341 to 352 at the top)
    spat=(300.0, 285.0),             # its lower rear tip in front of the tyre, s and h (c059: 300, 285)
    bumper_side_front_s=140.0,       # where its side face starts, behind the corner chamfer (c059: 105 to 129)
)
# Windshield measurements from the real 2024 Cybertruck, NHTSA O20244500 (TR-P44392-01-NC,
# data sheets 3 and 15): 19.9 degrees from horizontal, 1,433 top width, 1,785 bottom width,
# 1,780 height in the glass plane. These override the silhouette fit's undersized, 15.9-degree pane.
# Its top remains 40 mm ahead of the fitted roof apex; that absolute placement is still photo-derived.
PILLAR_REFERENCE = dict(P)  # preserve the camera-measured cabin trim location while correcting the pane
WS_MEASURED = dict(angle_deg=19.9, top_width=1433.0, bottom_width=1785.0, slant_height=1780.0)
_ws_angle = math.radians(WS_MEASURED['angle_deg'])
_ws_corner_s = P['apex_s'] - 40 - WS_MEASURED['slant_height'] * math.cos(_ws_angle)
P.update(shoulder_cowl_s=P['cowl_s'], shoulder_cowl_h=P['cowl_h'])
P.update(cowl_s=_ws_corner_s - 30,
         cowl_h=H - (P['apex_s'] - (_ws_corner_s - 30)) * math.tan(_ws_angle),
         roof_half=743.0)   # pane's 716.5 half-width plus the surrounding steel at its top

# The rear, measured on c069 through its solved camera (measure/rear/: 7.6 px RMS, about 5 mm; the licence plate comes
# out 305 x 151 at its depth, centred) and checked on c006 and c080 (spec.md, "Rear, measured"). The bumper's top is
# 650 at its rear face; the dark the side fit read up to 679 is the black strip under the tailgate (its steel ends at
# 692), with the red lamps in it.
P.update(bumper_r_h=650.0, bumper_r_bot=490.0)
BED['gate_bottom'] = 692.0
REAR = dict(
    upper_out=(917.0, 877.0),        # the upper tier's rear face: half-width at its top and at its bottom (outer ends fall inward)
    pocket_half=330.0, pocket_depth=186.0, pocket_floor=500.0,     # the plate pocket: plate wall 186 in from the rear face; its floor
                                     # at the wall under the plate's foot (c069: the step's far edge, 499), its rear lip 526
    lower=(657.0, 624.0, 370.0), lower_set=40.0,  # lower tier: half-width at its top (490) and bottom, its bottom; set in (guess)
    hitch=(0.0, 435.0, 64.0),        # receiver mouth: x, centre height, size (c069 62 x 68 on the rear face; a 2.5 in tube)
    reverse=(156.0, 276.0, 590.0, 610.0),          # reverse lamps on the pocket wall either side of the plate: x from (c069 147, at the plate's edge), to, h from, to
    plate=(581.5, 305.0, 152.0),     # the licence plate on the pocket wall: centre height (c069: 506 to 657), US size
    band_bot=1205.0, band_top_gap=8.0,              # the smoked band: bottom; its top under the face's top edge
    strip=(1280.0, 1299.0),          # tail strip: bottom, top (c006 lit; c069 shows its top edge as a line at 1,299)
    cap_x=806.0,                     # end caps from here out (c069: the seam at 801; band_half)
    brake=(350.0, 1259.0, 1277.0),   # braking: the middle bar's half-width, bottom, top (c080, foreshortening not undone)
    low=(690.0, 810.0, 658.0, 690.0),               # red lamps under the tailgate: x from, to, h from, to
    camera=(25.0, 1214.0, 1250.0),   # the rear camera's housing in the band's middle: half-width at its foot, foot, apex
)

# The front bumper's face, measured on c150 (measure/bumper/): widths at its crease scale (1.445 mm/px, the
# centre face's creases at +-625, and its tyres agree once their 870 mm greater depth is allowed for), heights
# on the manual's front view (bumper top 650, as c059 measured). spec.md, "Front bumper face".
BUMPER_F = dict(
    intake_half=640.0, intake_bot=414.0, intake_top=564.0, intake_depth=60.0,
    lip_bot=265.0, lip_chamfer=(300.0, 35.0),     # the lip's lower front edge chamfered from 300 high, 35 back at the bottom
    block_bot=245.0,                              # the corner blocks reach lower than the lip
    plate=(160.0, 570.0, 640.0), plate_depth=8.0, # plate recess: half-width, bottom, top
    grille_set=25.0, grille_pitch=163.0,          # the grille's face behind the bumper's; its vertical bars' spacing
    tow=(510.0, 617.0, 416.0, 446.0),             # tow-hook covers: x from, x to, bottom, top
    camera=(-176.0, 16.0),                        # the front camera at the intake's top: x, housing radius
    front_plate=(-8.0, 469.0, 305.0, 152.0),      # the licence plate: centre x, foot, width, height
    chamfer_a=(640.0, 404.0), chamfer_b=(864.0, 438.0), chamfer_p=(720.0, 245.0),
    chamfer_depth=120.0,                          # how far back the chamfer is at the block's outer edge: guess
    lamp_head=(386.0, 625.0), lamp_cells=4,       # the headlamps' projector row on the centre face: x from and to, cells (c150 px 1,000 to 1,165)
)

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
    window = plane3(V(BW, p['belt_h_front'], p['a_pillar_s']), V(BW, p['belt_h_rear'], p['c_pillar_s']),
                    V(p['roof_half'], H, p['apex_s']))
    side = {
        'side': (V(BW, 0, 0), np.array([1.0, 0, 0])),
        'tuck': plane3(V(BW, p['crease_h'], 0), V(BW, p['crease_h'], 1), V(BW - p['tuck'], CLEAR, 0)),
        'window': window,
        # The sail: its crease with the window facet stands upright at the C-pillar, from the base up to the deck
        # edge, as the rear side window's rear edge does on the truck (c022, c010: the window is a tall
        # quadrilateral, not a wedge); out to the deck's corner at the tail (tail_half, from the manual's top
        # view). Its crease with the side at the tail comes out at 1,273 (the side fit's 1,259 was for a crease
        # running from the C-pillar base up to the apex, which no photo shows). Ahead of the C-pillar the window
        # facet bounds the deck.
        'sail': plane3(V(BW, p['belt_h_rear'], p['c_pillar_s']), edge_point(pl['deck'], window, ZF - p['c_pillar_s']),
                       V(p['tail_half'], p['tail_h'], LT)),
        'corner': plane3(V(nfh, nh, 0), V(BW, nh, p['corner_s']), V(nfh, p['bumper_f_h'], p['face_rake'])),
        'shoulder': plane3(V(nfh, nh, 0), V(nfh, p.get('shoulder_cowl_h', p['cowl_h']), p.get('shoulder_cowl_s', p['cowl_s'])), V(BW, nh - p['shoulder_drop'], 0)),
    }
    for k, v in side.items():
        pl[k + '_l'] = v
        pl[k + '_r'] = mirror(v)
    return pl

def halfspace_cut(part, pt, n, inset=0.0):
    return part.split(Plane(origin=tuple(pt - n * inset), z_dir=tuple(n)), keep=Keep.BOTTOM)

def hull(p, inset=0.0):
    """The faceted shell, with hood and roof bounded to their own regions (planes inset normally)."""
    part = Box(2400, 2200, 6400, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, 0, (ZF + ZR) / 2)))
    pl = planes(p)
    for key, (pt, n) in pl.items():
        if key not in ('hood', 'roof'):
            part = halfspace_cut(part, pt, n, inset)
    # The documented windshield is steeper than the hood. Their junction is concave in side view,
    # so intersecting both infinite planes clips the nose away and can erase the windshield pocket.
    # Limit each facet to its own longitudinal region, with their common edge at the cowl.
    cut = np.array([0.0, 0.0, ZF - p['cowl_s']])
    front = halfspace_cut(halfspace_cut(part, *pl['hood'], inset), cut, np.array([0.0, 0.0, -1.0]))
    back = halfspace_cut(halfspace_cut(part, *pl['roof'], inset), cut, np.array([0.0, 0.0, 1.0]))
    return front + back

def on_plane(pl, x=None, y=None, z=None):
    """Complete a point on a plane given two of its coordinates."""
    (p0, n), q = pl, [x, y, z]
    i = q.index(None)
    known = [k for k in range(3) if k != i]
    q[i] = p0[i] - sum(n[k] * (q[k] - p0[k]) for k in known) / n[i]
    return np.array(q, float)

def crease_at_x(a, b, x):
    """The point at x on the line where planes a and b meet."""
    (pa, na), (pb, nb) = a, b
    A = np.array([[na[1], na[2]], [nb[1], nb[2]]])
    r = np.array([np.dot(na, pa) - na[0] * x, np.dot(nb, pb) - nb[0] * x])
    y, z = np.linalg.solve(A, r)
    return np.array([x, y, z])

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
    """Outer outline of the arch flare in (z, y): flat top, angled sides, vertical legs to below the sill. The
    front arch's front leg is steeper and ends on the bumper (knee at the steel's lower edge; c059)."""
    a, t, k, f = axle_z, p['arch_top_half'], p['arch_knee_h'], p['arch_foot_half']
    F, K = (p['arch_f_foot_half'], p['bumper_f_h'] + p['lamp_h']) if axle_z > 0 else (f, k)
    return [(a + F + grow, CLEAR - 120), (a + F + grow, K), (a + t + grow, p['arch_top_h'] + grow),
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
    zf = AXLES['f'] + p['arch_f_foot_half'] - 80        # back into the arch, so no steel shows behind the bumper
    body -= below_steel(p, zf, ZF + 100)
    zr = AXLES['r'] - p['arch_foot_half'] + 10
    body -= Box(2400, p['bumper_r_h'] - 6, zr - ZR + 100, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, 0, zr)))
    return body


def below_steel(p, z0, z1, drop=0.0):
    """Everything under the steel's lower edge at the front, from z0 to z1: level across the centre face at
    bumper_f_h + lamp_h_centre, falling along the corner facets to bumper_f_h + lamp_h at the sides
    (spec.md, "Front bumper face"). drop lowers the edge (to keep the lamp strip just under the steel)."""
    yc, ys, nfh = p['bumper_f_h'] + p['lamp_h_centre'] - drop, p['bumper_f_h'] + p['lamp_h'] - drop, p['nose_flat_half']
    out = [(-1300, 0), (1300, 0), (1300, ys), (body_w(p), ys), (nfh, yc), (-nfh, yc), (-body_w(p), ys), (-1300, ys)]
    return front_prism(out, z0, z1)

def flare_solid(p, az, x0):
    """The flare's outer outline as a solid from x0 to the published width, its outer edges bevelled: the
    outline is flare_bevel bigger where it meets the body (x = body_w) than at its face (c059, c085, c147)."""
    BW, b = body_w(p), p['flare_bevel']
    inner = side_prism(arch_polygon(p, az, grow=b), x0, BW)
    pts = [np.array([BW, y, z]) for z, y in arch_polygon(p, az, grow=b)]
    w = Wire.make_polygon([tuple(q) for q in pts], close=True)
    taper = math.degrees(math.atan2(b, HALF_W - BW))
    outer = extrude(Face(w), amount=HALF_W - BW, dir=(1, 0, 0), taper=taper)
    return inner + outer

def cladding_parts(p):
    """Black parts by name: arch flares and sill rockers per side (with their end tabs), front and rear bumpers."""
    BW = body_w(p)
    out = {}
    above_ground = Box(2 * HALF_W + 20, 2000, 6400, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, CLEAR, 0)))
    for a, az in AXLES.items():
        band = flare_solid(p, az, BW - 40) - side_prism(arch_opening(p, az), BW - 60, HALF_W + 10)
        band = band & above_ground
        if a == 'f':                                     # the front leg stands on the bumper
            band -= Box(400, 1000, 700, align=(Align.CENTER, Align.MAX, Align.MIN)).moved(Location((BW, p['bumper_f_h'] + 1, az + 150)))
        out[f'flare_{a}_l'], out[f'flare_{a}_r'] = band, band.mirror(Plane.YZ)
    zf = AXLES['f'] - p['arch_foot_half'] + p['flare_band'] * 0.5   # rocker runs between the arch legs
    zr = AXLES['r'] + p['arch_foot_half'] - p['flare_band'] * 0.5
    rb = CLEAR + p['tab_drop']
    rocker = [(zf, rb + p['rocker_h']), (zf, CLEAR), (zf - 120, rb), (zr + 120, rb), (zr, CLEAR), (zr, rb + p['rocker_h'])]
    xo = BW - p['tuck'] + 20
    r = side_prism(rocker, xo - 140, xo)
    out['rocker_l'], out['rocker_r'] = r, r.mirror(Plane.YZ)
    # Front bumper: the plan of the front face, below its bottom edge, with a chin raked back. Its corners are
    # blocks whose side faces stand out to the flares and run back to just ahead of the tyre, the lower rear tip
    # (a spat) reaching down in front of the tyre (c059, c085, c147).
    nfh, fr = p['nose_flat_half'], p['face_rake']
    xs = HALF_W - 12
    zb = ZF - p['bumper_side_s']
    # Its top corner follows the steel's corner facet just proud of it (c001, c147: the lamp strip and its amber
    # end sit right under the steel's corner, not behind a ledge), out to the flares' width.
    pl = planes(p)
    a, b = (on_plane(pl['corner_l'], x=x, y=p['bumper_f_h']) for x in (nfh, BW))
    d = (b - a) / np.linalg.norm(b - a)
    n = np.array([d[2], 0, -d[0]])                       # outward in plan (toward +x and forward)
    if n[2] < 0:
        n = -n
    c0 = a + n * 8
    side_z = c0[2] + d[2] * (xs - c0[0]) / d[0]          # where that line reaches the side face
    side_z = max(side_z, zb + 12)
    plan = [(-xs, zb), (xs, zb), (xs, side_z), (c0[0], c0[2]), (nfh, ZF - fr + 10), (-nfh, ZF - fr + 10), (-c0[0], c0[2]), (-xs, side_z)]
    bot = min(p['spat'][1] - 10, BUMPER_F['block_bot'])
    w = Wire.make_polygon([(x, bot, z) for x, z in plan], close=True)
    bf = extrude(Face(w), amount=p['bumper_f_h'] - bot - 1, dir=(0, 1, 0))
    ss, sh = p['spat']
    F = BUMPER_F
    prof = [(ZF + 100, p['bumper_f_h'] + 10), (zb, p['bumper_f_h'] + 10), (ZF - ss, sh), (ZF - ss + 70, F['block_bot']), (ZF + 100, F['block_bot'])]
    bf = bf & side_prism(prof, -HALF_W - 50, HALF_W + 50)
    # The face (spec.md, "Front bumper face"): a top band with a shallow plate recess, the intake across the
    # centre with a grille and a tow-hook cover at each end, a lip under it, and the corner blocks either side
    # reaching lower, their lower outer corners chamfered back (c150, c094, the manual's front view).
    zf = ZF - fr + 10                                          # the centre face
    def face_z(x):
        return float(np.interp(abs(x), [nfh, c0[0], xs], [zf, c0[2], side_z]))
    ih, i0, i1 = F['intake_half'], F['intake_bot'], F['intake_top']
    bf -= Box(2 * ih, i1 - i0, F['intake_depth'] + 100, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, i0, zf + 100)))
    bf -= Box(2 * ih, F['lip_bot'] - F['block_bot'] + 20, 1000, align=(Align.CENTER, Align.MAX, Align.CENTER)).moved(Location((0, F['lip_bot'], zf)))
    lip_chin = [(zf + 5, F['lip_chamfer'][0]), (zf + 5, F['lip_bot'] - 5), (zf - F['lip_chamfer'][1], F['lip_bot'] - 5)]
    bf -= side_prism(lip_chin, -ih, ih)
    px, p0, p1 = F['plate']
    bf -= Box(2 * px, p1 - p0, 50, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, p0, zf - F['plate_depth'] + 50)))
    # The corner chamfer: the facet runs back from the front face along A (the intake's lower inner corner) to
    # P (on the block's bottom), and back outward to B (the block's outer edge), set back there by its depth;
    # only below the line A-B.
    ax, ay = F['chamfer_a']; bx, by = F['chamfer_b']; cx, cy = F['chamfer_p']
    for sx in (1, -1):
        A = np.array([sx * ax, ay, face_z(ax)])
        P = np.array([sx * cx, cy, face_z(cx)])
        B = np.array([sx * bx, by, face_z(bx) - F['chamfer_depth']])
        n = np.cross(P - A, B - A); n /= np.linalg.norm(n)
        if n[2] < 0:
            n = -n                                             # outward: forward
        under = np.cross(B - A, np.array([0, 0, 1.0])); under /= np.linalg.norm(under)
        if under[1] > 0:
            under = -under                                     # pointing down, away from the face above A-B
        wedge = Box(400, 500, 600, align=(Align.MIN if sx > 0 else Align.MAX, Align.MIN, Align.CENTER)).moved(Location((sx * (ih - 5), 0, zf - 200)))
        wedge = halfspace_cut(wedge, A, -n)                    # keep what lies in front of the facet
        wedge = halfspace_cut(wedge, A, -under)                # and below A-B
        bf -= wedge
    out['bumper_f'] = bf
    # In the intake: the grille (vertical bars at its pitch, two horizontal bars), the tow-hook covers at its
    # ends, and the camera at its top left (c150).
    gz = zf - F['grille_set']
    g = [Box(2 * ih, 5, 15).moved(Location((0, i0 + (i1 - i0) * f, gz - 10))) for f in (1 / 3, 2 / 3)]
    nbar = int(ih // F['grille_pitch'])
    g += [Box(5, i1 - i0, 15).moved(Location((k * F['grille_pitch'], (i0 + i1) / 2, gz - 10))) for k in range(-nbar, nbar + 1)]
    out['bumper_f_grille'] = Compound(g)
    # The tow-hook covers: thin flat caps standing on the intake's floor at its outer ends, lighter than the
    # bumper (c147, c085: about 108 x 30, their faces 5 behind the bumper's). The front camera: a round lens in
    # a small housing under the intake's top edge, at the plate recess's left end (c147, c150).
    tx0, tx1, ty0, ty1 = F['tow']
    caps = [Box(tx1 - tx0, ty1 - ty0, 30, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((sx * (tx0 + tx1) / 2, ty0, zf - 5)))
            for sx in (1, -1)]
    out['bumper_f_tow'] = [fillet(c.edges().filter_by(Axis.Z), 8.0) for c in caps]
    cxm, cr = F['camera']
    housing = Cylinder(cr, 25, align=(Align.CENTER, Align.CENTER, Align.MAX)).moved(Location((cxm, i1 - cr - 2, zf - 12)))
    out['bumper_f_camera'] = housing
    out['bumper_f_lens'] = Cylinder(cr * 0.45, 2, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((cxm, i1 - cr - 2, zf - 12 - 0.5)))
    # The front plate (c094, c150): US size, centred on the seat's middle (c150 -8), standing 2 mm proud of the
    # face. Its foot is at the c150 seat's lower edge (469) and its top at 621 (c094: its top 57 px over the
    # intake's top, at 0.9 mm per px of the plate's own width); it hangs over the intake's top edge, as on the truck.
    fx, fb, fw, fh = F['front_plate']
    fplate = Box(fw, fh, 2.0, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((fx, fb, zf + 2.0)))
    out['front_plate'] = fillet(fplate.edges().filter_by(Axis.Z), radius=10.0)
    # the intake's back, near black so it reads as an opening
    out['bumper_f_intake'] = Box(2 * ih - 1, i1 - i0 - 1, 1, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(
        Location((0, i0 + 0.5, zf - F['intake_depth'] + 0.1)))
    xo = BW + 6                                              # stands just proud of the steel it covers
    # Rear bumper (REAR; c069, c006, c080): two tiers. The upper stands out past the tailgate and wraps forward to
    # the rear arch; its rear face's outer ends fall inward, a facet cut back from the corner chamfer to the bottom.
    # A pocket across its middle holds the plate on its back wall, floored by the step. The lower tier, set in under
    # it, narrows to its bottom and holds the hitch receiver.
    R = REAR
    zt, top, bot = ZR, p['bumper_r_h'], p['bumper_r_bot']
    ot, ob = R['upper_out']
    za = AXLES['r'] - p['arch_foot_half'] + 20               # wraps the corner forward to the rear arch
    ch = xo - ot                                             # the corner chamfer, 45 degrees, to the rear face's measured top corner
    plan = [(-xo, za), (xo, za), (xo, zt + ch), (ot, zt), (-ot, zt), (-xo, zt + ch)]
    w = Wire.make_polygon([(x, bot, z) for x, z in plan], close=True)
    br = extrude(Face(w), amount=top - bot, dir=(0, 1, 0))
    inside = np.array([0.0, (top + bot) / 2, zt + 100])
    for sx in (1, -1):
        a, b = np.array([sx * ot, top, zt]), np.array([sx * ob, bot, zt])
        br = plane_cut(br, a, b, a + np.array([sx * ch, 0, ch]), inside)
    ph, pd, pf = R['pocket_half'], R['pocket_depth'], R['pocket_floor']
    br = br - Box(2 * ph, top - pf + 10, pd + 1, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, pf, zt - 1)))
    lt, lb, lbot = R['lower']
    zl = zt + R['lower_set']
    low = XH([(-lt, bot + 1), (lt, bot + 1), (lb, lbot), (-lb, lbot)], ZF - (zl + 300), ZF - zl)
    hx, hh, hs = R['hitch']
    low = low - Box(hs, hs, 120).moved(Location((hx, hh, zl)))
    out['bumper_r'] = br + low
    out['rear_hitch'] = Box(hs - 2, hs - 2, 2).moved(Location((hx, hh, zl + 58)))       # the receiver's dark inside
    r0, r1, h0, h1 = R['reverse']
    ph_c, pw_, ph_ = R['plate']
    plate = Box(pw_, ph_, 2.0).moved(Location((0, ph_c, zt + pd - 2.0)))         # 1 mm off the wall
    out['rear_plate'] = fillet(plate.edges().filter_by(Axis.Z), radius=10.0)
    out['rear_reverse'] = Compound([Box(r1 - r0, h1 - h0, 3, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((sx * (r0 + r1) / 2, h0, zt + pd + 0.5)))
                                    for sx in (1, -1)])
    return out

def cladding(p):
    return [v for k, v in cladding_parts(p).items() if not k.startswith(('bumper_f_', 'rear_'))]

def wheel_centre(p, axle, side):
    return np.array([side * TRACK / 2, TYRE_R - p['squash'], AXLES[axle]])

def mirror_frame(p):
    """The left mirror, unfolded as it is when driving (spec.md, "Door mirrors"). Parked Cybertrucks fold their
    mirrors when locked, and most street photos show them folded (c022, c059, c086, c150, c163: long and low,
    the glass turned toward the window). c003 (an open Ride & Drive truck) shows them out, and was measured
    through its solved camera, corrected by its door seam (70 mm) and ride height (26 mm). Width from c134 (a
    moving truck), the outer edge on the published span; the fold check is in spec.md."""
    xo = MIRROR_HALF
    xi = xo - 190.0                                   # c134: housing 188 wide, the arm inboard of it
    zf = ZF - (p['seam_1'] + 99.0)                    # the front tip, ~95 behind the door seam (c003, c059; overlay)
    zr = zf - 254.0                                   # the glass face at its foot
    belt = belt_h(p, ZF - (zf + zr) / 2)
    ylo = belt + 10.0                                 # the base's underside, just clear of the door top
    yb = ylo + 63.0                                   # the base's top: the shell's grey faces start here
    ytop = ylo + 190.0                                # 1,421 at the spec ride height (c003, corrected; c059 1,431)
    return dict(xo=xo, xi=xi, zf=zf, zr=zr, belt=belt, ylo=ylo, yb=yb, ytop=ytop)

def mirror_profiles(f, inset=0.0):
    """Side and front outlines (c003; c134, c137): the side a flat top over the glass, falling 38 degrees to a
    low tip at the front, the glass face leaning 45 mm forward at the top; the front a tall inner edge, a short
    flat top, and the outer face falling to a short outer end (both the front and the glass face are triangles,
    tall at the inner edge: c134, c068, dgRcedIkNOM-11). inset shrinks both, for the glass inside its frame."""
    xo, xi, zf, zr, ylo, ytop = (f[k] for k in ('xo', 'xi', 'zf', 'zr', 'ylo', 'ytop'))
    i = inset
    side = [(zr - 60.0, ylo + i), (zf - i, ylo + i), (zf - i, ylo + 66.0), (zr + 112.0, ytop - i), (zr - 60.0, ytop - i)]
    front = [(xi + i, ylo + i), (xo - i, ylo + i), (xo - i, ylo + 95.0 - i * 0.4), (xi + 30.0, ytop - i), (xi + i, ytop - i)]
    return side, front

def front_prism(poly_xy, z0, z1):
    """Extrude an (x, y) outline along z from z0 to z1."""
    w = Wire.make_polygon([(x, y, z0) for x, y in poly_xy], close=True)
    return extrude(Face(w), amount=z1 - z0, dir=(0, 0, 1))

def mirror_part(p):
    """Left mirror: the housing as its side outline across its front outline (flat facets, as on the truck),
    cut off behind by the glass face, the base's lower edges chamfered, and the arm from the base's inner front
    down onto the door top (c134)."""
    f = mirror_frame(p)
    side, front = mirror_profiles(f)
    housing = side_prism(side, f['xi'], f['xo']) & front_prism(front, f['zr'] - 50, f['zf'] + 50)
    housing = halfspace_cut(housing, *glass_plane(f))
    housing = halfspace_cut(housing, np.array([f['xo'], f['ylo'] + 12.0, 0.0]), np.array([0.7071, -0.7071, 0.0]))
    housing = halfspace_cut(housing, np.array([0.0, f['ylo'] + 12.0, f['zf']]), np.array([0.0, -0.7071, 0.7071]))
    win = planes(p)['window_l']
    xw = on_plane(win, y=f['belt'] + 10.0, z=f['zf'] - 60.0)[0]
    arm = Box(f['xi'] + 40.0 - (xw - 5.0), f['ylo'] + 25.0 - (f['belt'] - 3.0), 90.0,
              align=(Align.MIN, Align.MIN, Align.MAX)).moved(Location((xw - 5.0, f['belt'] - 3.0, f['zf'] - 15.0)))
    # its top falls from the base to the door top at the window: a tapered foot, not a block (dgRcedIkNOM-04)
    a0, a1 = np.array([f['xi'] + 40.0, f['ylo'] + 25.0, 0.0]), np.array([xw, f['belt'] + 12.0, 0.0])
    d = a1 - a0; n = np.array([d[1], -d[0], 0.0]); n = n / np.linalg.norm(n)
    arm = halfspace_cut(arm, a0, n if n[1] > 0 else -n)
    part = housing + arm
    try:
        part = fillet(part.edges().filter_by(lambda e: e.length > 20), 3.0)
    except Exception:
        pass
    return part

def glass_plane(f):
    """The glass face: turned 12 degrees toward the driver (its inner end 40 mm further forward than its outer end,
    from where c003's 16-degree view from behind puts its edge) and leaning 45 mm forward at the top.
    (point, outward normal)."""
    a = np.array([f['xo'], f['ylo'], f['zr']])
    b = np.array([f['xi'], f['ylo'], f['zr'] + 40.0])
    c = np.array([f['xo'], f['ytop'], f['zr'] + 45.0])
    n = np.cross(b - a, c - a); n = n / np.linalg.norm(n)
    if n[2] > 0: n = -n
    return a, n

def mirror_glass_part(p):
    """The left mirror's glass: the whole glass face inside an 8 mm black frame (dgRcedIkNOM-11), 1 mm proud,
    above the base."""
    f = mirror_frame(p)
    _, front = mirror_profiles(f, inset=8.0)
    a, n = glass_plane(f)
    slab = front_prism(front, f['zr'] - 60, f['zr'] + 120)
    slab = halfspace_cut(slab, a + n * 1.0, n)
    slab = halfspace_cut(slab, a - n * 1.0, -n)
    return halfspace_cut(slab, np.array([0.0, f['yb'] + 6.0, 0.0]), np.array([0.0, -1.0, 0.0]))

def wiper(p):
    """The single wiper, parked up the driver's (left) A-pillar (c150, c027, c085): the pivot housing at the
    cowl in the glass's lower corner, the blade lying on the glass close along the pillar toward the roof's
    apex, the arm over its lower half. Blade 48 in (1,220 mm, Tesla part 1853252, per notateslaapp's blade
    table); the arm about 50 in (Auto Connected Car News, measured)."""
    pl = planes(p)
    n = pl['roof'][1]
    def at(s, inboard, lift):                            # on the glass plane, `inboard` of the pillar crease
        z = ZF - s
        e = edge_point(pl['roof'], pl['window_l'], z)
        return on_plane(pl['roof'], x=e[0] - inboard, z=z) + n * lift
    s0 = p['cowl_s'] + 60
    s1 = s0 + 1220 * abs(n[1])                           # the blade's 1,220 along the slope
    # The glass's face is 1 mm under the facet: the blade's rubber sits 0.1 mm above it, 22 wide, 18 tall.
    blade = rod(at(s0, 64, 8.1), at(s1, 48, 8.1), n, 22, 18)
    arm = rod(at(p['cowl_s'] + 20, 66, 24), at(s0 + 0.5 * (s1 - s0), 58, 24), n, 26, 14)
    housing = rod(at(p['cowl_s'] - 45, 68, 12), at(p['cowl_s'] + 70, 66, 12), n, 46, 52)
    return housing, arm + blade

def wiper_pivot(p):
    """Where the arm turns: the housing's middle on the glass, about the glass's normal; and how far one wipe
    goes, from parked up the pillar to horizontal along the cowl (the manual: in rain the blade "may pause
    in the horizontal position"), in degrees."""
    pl = planes(p)
    n = pl['roof'][1]
    def at(s, inboard):
        z = ZF - s
        e = edge_point(pl['roof'], pl['window_l'], z)
        return on_plane(pl['roof'], x=e[0] - inboard, z=z)
    pivot = at(p['cowl_s'] + 12, 67)
    s1 = p['cowl_s'] + 60 + 1220 * abs(n[1])
    tip = at(s1, 48) - pivot
    across = np.array([-1.0, 0, 0])                       # toward the passenger's side, along the cowl
    sweep = math.degrees(math.acos(np.dot(tip, across) / np.linalg.norm(tip)))
    return pivot, n / np.linalg.norm(n), sweep

def side_glass_tip(p):
    """Where the side glass's front tip sits along the truck. c003 through its fitted camera
    (measure/windshield/c003-sidetip.md): the glass runs past the mirror and the door's front edge to a point
    about over the front wheel, 799 back, where the A-pillar's lower edge comes down to the beltline."""
    return 800.0

SIDE_TOP_SEEN = [(865.0, 1235.0), (1084.0, 1310.0), (1228.0, 1357.0)]     # (s, h) from int-athens-1 with its EXIF focal (measure/console/athens1-stripx.md), see side_glass_seen

# Bow and frit proportions from Tesla's windshield service drawing (GUID-CAFA82BC).
# Absolute glass dimensions and slope are measured on NHTSA's real test vehicle, above.
WINDSHIELD = dict(bottom_bow=60.0, bottom_segments=12,
                  side_band=75.0, top_band=280.0, bottom_band=65.0,
                  corner_along_bottom=250.0, corner_along_side=110.0)

def windshield_outline(p):
    """Planar glass with a sampled bowed bottom; first four points are the four main corners.

    The remaining points run from the right bottom corner back to the left, so existing pillar
    attachment code can keep using the first four corners. The service drawing's wiper notch is
    hidden by the separate wiper housing and is not reproduced here.
    """
    roof, win = planes(p)['roof'], planes(p)['window_l']
    sc = p['cowl_s'] + 30.0
    zc, zt = ZF - sc, ZF - p['apex_s'] + 40
    xc = WS_MEASURED['bottom_width'] / 2
    xt = WS_MEASURED['top_width'] / 2
    xz = [(xc, zc), (xt, zt), (-xt, zt), (-xc, zc)]
    for t in np.linspace(-1.0, 1.0, WINDSHIELD['bottom_segments'] + 1)[1:-1]:
        s = sc - WINDSHIELD['bottom_bow'] * (1 - t * t)
        xz.append((xc * t, ZF - s))
    return [on_plane(roof, x=x, z=z) for x, z in xz]

def windshield_clear(p):
    """The frit's clear opening, following the bow and trimming each lower corner along the edge."""
    ws, wn = windshield_outline(p), planes(p)['roof'][1]
    w = WINDSHIELD
    clear = inset_polygon(ws, wn, [w['side_band'], w['top_band'], w['side_band']] +
                          [w['bottom_band']] * (len(ws) - 3))
    def along(path, distance):
        for i, (a, b) in enumerate(zip(path, path[1:])):
            length = np.linalg.norm(b - a)
            if distance <= length:
                return a + (b - a) * distance / length, i + 1
            distance -= length
        raise ValueError('Windshield corner cutoff exceeds the lower edge')
    # Walk both ways along the sampled bottom; the 250 mm cutoff spans multiple segments.
    bottom = clear[3:] + [clear[0]]
    r, ri = along(bottom, w['corner_along_bottom'])
    l, li = along(bottom[::-1], w['corner_along_bottom'])
    left_side = clear[0] + (clear[1] - clear[0]) / np.linalg.norm(clear[1] - clear[0]) * w['corner_along_side']
    right_side = clear[3] + (clear[2] - clear[3]) / np.linalg.norm(clear[2] - clear[3]) * w['corner_along_side']
    return [left_side, clear[1], clear[2], right_side, r, *bottom[ri:len(bottom) - li], l]

def side_glass_seen(p, s):
    """Where int-athens-1 sees the side glass end from the driver's seat, from the tip up along the A-pillar
    strip's lower edge: 1,254 high at 947 back, 1,321 at 1,136, 1,363 at 1,260 (measure/console/athens1-strip.md),
    then to the 60-deep steel band at the door's front seam (c003: 40 to 45 px at 1.45 mm/px) and on to the apex.
    That is the trim's edge, which covers the glass from inside. The A-pillar strip's sight planes pivot on it;
    the glass itself is side_glass_top."""
    pl = planes(p)
    def belt(q):
        return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (q - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    def crease(q):
        z = ZF - q
        return min(edge_point(pl['roof'], pl['window_l'], z)[1], edge_point(pl['deck'], pl['window_l'], z)[1])
    t, sm = side_glass_tip(p), 1553.0
    pts = [(t, belt(t) + 12), *SIDE_TOP_SEEN, (sm, crease(sm) - 60), (p['apex_s'], crease(p['apex_s']) - p['win_margin'])]
    return float(np.interp(s, [q for q, _ in pts], [h for _, h in pts]))

def side_glass_top(p, s):
    """The side glass's own top edge at s: one straight line from the front tip to the roof edge less the margin
    at the apex, as on the real truck (c003: the window is a long wedge whose top edge runs straight from the roof's
    peak to its tip, over a straight beltline). The int-athens-1 readings (side_glass_seen) are the A-pillar trim's
    edge, which hides the glass from inside, so they don't bend this edge."""
    pl = planes(p)
    def belt(q):
        return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (q - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    def crease(q):
        z = ZF - q
        return min(edge_point(pl['roof'], pl['window_l'], z)[1], edge_point(pl['deck'], pl['window_l'], z)[1])
    t, a = side_glass_tip(p), p['apex_s']
    h0, h1 = belt(t) + 12, crease(a) - p['win_margin']
    return h0 + (h1 - h0) * (s - t) / (a - t)

def panels(p):
    """Polygons sunk into the facets: name -> (points, outward normal, pocket depth, inset under the steel, kind)."""
    pl = planes(p)
    BW = body_w(p)
    m = p['win_margin']
    out = {}
    # Windshield and glass roof: the roof facet from the cowl to the apex, inside the A-pillars.
    out['windshield'] = (windshield_outline(p), pl['roof'][1], 8, 1.0, 'glass')
    # Rear roof glass and the tonneau on the deck, between the sails.
    def deck_poly(s0, s1, margin):
        q = []
        for s in (s0, s1):
            z = ZF - s
            x = min(edge_point(pl['deck'], pl['sail_l'], z)[0], edge_point(pl['deck'], pl['window_l'], z)[0]) - margin
            q.append((x, z))
        return [on_plane(pl['deck'], x=x, z=z) for x, z in (q[0], q[1], (-q[1][0], q[1][1]), (-q[0][0], q[0][1]))]
    out['rear_glass'] = (deck_poly(p['apex_s'] + 40, p['roofglass_end_s'], m), pl['deck'][1], 8, 1.0, 'glass')
    # The tonneau: a fixed lid over the canister, then the bay the slats run in (cut, no panel: the slats are
    # their own parts), between dark rails that fill the taper out to the sails (the manual's top view).
    s_can, s_end = BED['canister_s'], L - p['bumper_r_out'] - 25
    out['tonneau'] = (deck_poly(p['roofglass_end_s'] + 30, s_can, 30), pl['deck'][1], 14, 2.0, 'tonneau')
    out['tonneau_bay'] = (deck_poly(s_can, s_end, 30), pl['deck'][1], 14, 2.0, 'bay')
    rail = [(BED['cover_half'] + 1, s_can), (BED['cover_half'] + 1, s_end)]
    rail += [(deck_poly(s, s, 30)[0][0], s) for s in (s_end, s_can)]
    rail = [on_plane(pl['deck'], x=x, z=ZF - s) for x, s in rail]
    out['tonneau_rail_l'] = (rail[::-1], pl['deck'][1], 14, 2.0, 'tonneau')
    out['tonneau_rail_r'] = ([q * [-1, 1, 1] for q in rail], pl['deck'][1], 14, 2.0, 'tonneau')
    # Side glass (both windows and the black B-pillar, one panel): beltline up to the roof edge.
    def belt(s):
        return p['belt_h_front'] + (p['belt_h_rear'] - p['belt_h_front']) * (s - p['a_pillar_s']) / (p['c_pillar_s'] - p['a_pillar_s'])
    def top(s):
        z = ZF - s
        return min(edge_point(pl['roof'], pl['window_l'], z)[1], edge_point(pl['deck'], pl['window_l'], z)[1]) - m
    s0 = side_glass_tip(p)
    side_pts = [(s0, belt(s0) + 12), (p['apex_s'], top(p['apex_s'])), (p['c_pillar_s'], top(p['c_pillar_s'])),
                (p['c_pillar_s'], belt(p['c_pillar_s']) + 12)]
    for key, sx in (('window_l', 1), ('window_r', -1)):
        pts = [on_plane(pl[key], y=h, z=ZF - s) for s, h in side_pts]
        out['side_glass_' + key[-1]] = (pts if sx > 0 else pts[::-1], pl[key][1], 8, 1.0, 'glass')
    # Front light strip: across the face just under the light bar edge, and down each corner facet.
    fb, nh, nfh = p['front_bar_h'], p['nose_h'], p['nose_flat_half']
    def face_pt(y, x):
        return on_plane(pl['face'], x=x, y=y)
    out['light_f'] = ([face_pt(nh - 3, -nfh), face_pt(nh - 3, nfh), face_pt(nh - 3 - fb, nfh), face_pt(nh - 3 - fb, -nfh)], pl['face'][1], 6, 1.0, 'light_w')
    for key, sx in (('corner_l', 1), ('corner_r', -1)):
        # On the crease where the corner facet meets the shoulder, 3 mm under it, from the face's crease out to
        # 15 mm short of the side: the bar wraps the corner along the edge, as on the truck (c001, c055).
        top_in = crease_at_x(pl[key], pl['shoulder_' + key[-1]], sx * nfh) - [0, 3, 0]
        top_out = crease_at_x(pl[key], pl['shoulder_' + key[-1]], sx * (BW - 15)) - [0, 3, 0]
        pts = [top_in, top_out, top_out - [0, fb, 0], top_in - [0, fb, 0]]
        pts = [on_plane(pl[key], x=q[0], y=q[1]) for q in pts]
        out['light_f_' + key[-1]] = (pts if sx > 0 else pts[::-1], pl[key][1], 6, 1.0, 'light_w')
    # The smoked band across the top of the rear face, its edges under the face's outline (the lamps sit on it:
    # rear_lights), and the black strip under the tailgate down to the bumper, which holds the red lamps.
    out['band_r'] = (band_outline(p), pl['rear'][1], 8, 1.0, 'band')
    zt = ZR + p['bumper_r_out']
    y0, y1, ph = p['bumper_r_h'] + 2, BED['gate_bottom'] - 3, REAR['pocket_half'] + 3
    for side, sx in (('l', 1), ('r', -1)):          # either side of the pocket, which runs up to the tailgate
        q = [(ph, y1), (BW - 6, y1), (BW - 6, y0), (ph, y0)]
        q = [np.array([sx * x, y, zt]) for x, y in q]
        out['band_low_' + side] = (q if sx > 0 else q[::-1], pl['rear'][1], 8, 1.0, 'band')
    return out

def band_outline(p):
    """The smoked band on the rear face (REAR): from band_bot up to band_top_gap under the face's top edge (the
    deck across the middle, the sails at the corners), band_top_gap in from the sides."""
    pl = planes(p)
    BW, g = body_w(p), REAR['band_top_gap']
    zt = ZR + p['bumper_r_out']
    ys = on_plane(pl['sail_l'], x=BW - g, z=zt)[1] - g                  # at the side, under the sail
    xc = on_plane(pl['sail_l'], y=p['tail_h'] - g, z=zt)[0] - g         # where the sail meets the deck, moved in
    yb = REAR['band_bot']
    q = [(-xc, p['tail_h'] - g), (xc, p['tail_h'] - g), (BW - g, ys), (BW - g, yb), (-BW + g, yb), (-BW + g, ys)]
    return [np.array([x, y, zt]) for x, y in q]

def rear_lights(p):
    """The rear lamps (REAR), each its own part so the app can light them by function, standing 0.6 mm proud of
    the smoked band and clipped to it: the tail strip in three (gate_light across the tailgate's middle,
    light_rear_l and _r in the end caps), the end caps around the strip (brake and turn signal), the brake bar in
    the middle under the strip, the red lamps under the tailgate, and the camera's housing in the band's middle."""
    R = REAR
    zt = ZR + p['bumper_r_out']
    n = np.array([0.0, 0.0, -1.0])
    clip = prism(band_outline(p), n, out=5.0, depth=5.0)
    def rect(x0, x1, y0, y1, out=-0.4, depth=1.0, clipped=True):
        pts = [np.array(q) for q in ((min(x0, x1), y1, zt), (max(x0, x1), y1, zt), (max(x0, x1), y0, zt), (min(x0, x1), y0, zt))]
        part = prism(pts, n, out=out, depth=depth)
        return part & clip if clipped else part
    s0, s1 = R['strip']
    cx, edge = R['cap_x'], body_w(p)
    out = {'gate_light': rect(-cx + 3, cx - 3, s0, s1)}
    for side, sx in (('l', 1), ('r', -1)):
        out[f'light_rear_{side}'] = rect(sx * (cx + 3), sx * edge, s0, s1)
        out[f'light_cap_{side}'] = rect(sx * (cx + 3), sx * edge, R['band_bot'] + 2, s0 - 2) + rect(sx * (cx + 3), sx * edge, s1 + 2, 2000)
    bx, b0, b1 = R['brake']
    out['gate_brake'] = rect(-bx, bx, b0, b1)
    x0, x1, h0, h1 = R['low']
    out['light_low'] = Compound([rect(sx * x0, sx * x1, h0, h1, out=-0.4, depth=9.0, clipped=False) for sx in (1, -1)])   # on the strip under the gate
    w, c0, c1 = R['camera']
    tri = [np.array(q) for q in ((0, c1, zt), (w, c0, zt), (-w, c0, zt))]
    out['gate_camera'] = prism(tri, n, out=2.0, depth=1.0)
    return out

def tyre_cylinder(p, axle, side):
    return Cylinder(TYRE_R, TYRE_W, rotation=(0, 90, 0)).moved(Location(tuple(wheel_centre(p, axle, side))))

# Which dark parts each kind of photo sees on the steel (fit_silhouette.py paints steel, then these on top).
VIEW_DARK = {
    'left': ['flare_f_l', 'flare_r_l', 'rocker_l', 'bumper_f', 'bumper_r', 'side_glass_l', 'windshield', 'rear_glass',
             'tyre_fl', 'tyre_rl', 'mirror_l', 'well_f_l', 'well_r_l'],
    'front': ['bumper_f', 'windshield', 'side_glass_l', 'side_glass_r', 'flare_f_l', 'flare_f_r', 'tyre_fl', 'tyre_fr',
              'mirror_l', 'mirror_r'],
    'rear': ['bumper_r', 'tonneau', 'tonneau_bay', 'tonneau_rail_l', 'tonneau_rail_r', 'band_r', 'band_low_l', 'band_low_r', 'rear_glass', 'flare_r_l', 'flare_r_r', 'tyre_rl', 'tyre_rr'],
}
VIEW_DARK['right'] = ['flare_f_r', 'flare_r_r', 'rocker_r', 'bumper_f', 'bumper_r', 'side_glass_r', 'windshield', 'rear_glass',
                      'tyre_fr', 'tyre_rr', 'mirror_r', 'well_f_r', 'well_r_r']

def fit_parts(p=P):
    """Named solids for fit_silhouette.py: the steel shell and every dark part, unioned nowhere."""
    parts = {'steel': shell(p)}
    parts.update(cladding_parts(p))
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        if kind in ('glass', 'tonneau', 'bay', 'band'):
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
    body = revolve(Face(w), Axis.X, 360)
    # Shoulder lugs: the all-terrain blocks wrap from the tread over the shoulder onto the upper sidewall,
    # alternating long and short, 40 a side (c025, c085, c143, c147). Each is one flat-faced prism whose
    # profile follows the sidewall a few mm proud, so it stays cheap in triangles.
    def skin_x(r):                                   # the lug faces: 3 to 11 mm over the sidewall
        if r <= r1 - 30:
            return hw + 11 - 8 * (r - (r1 - 95)) / 65
        return hw + 3 - 27 * (r - (r1 - 30)) / 30
    lugs = []
    n = 40
    for k in range(n):
        r_in = r1 - (100 if k % 2 else 70)
        prof = [(r_in, hw - 26), (r_in, skin_x(r_in)), (r1 - 30, skin_x(r1 - 30)), (r1 - 16, skin_x(r1 - 16)), (r1 - 16, hw - 26)]
        for sx in (1, -1):
            w = Wire.make_polygon([(sx * x, r, -13) for r, x in prof], close=True)
            lug = extrude(Face(w), amount=26, dir=(0, 0, 1))
            lugs.append(lug.rotate(Axis.X, 360 * k / n))
    return Compound([body, *lugs])

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
           h_front=(2200.0, 771.0), h_rear=(3150.0, None), seat_x=390.0, dash_h=1207.0, dash_s=1435.0,
           yoke=(1683.0, 1150.0), yoke_w=318.0, yoke_hgt=215.3, yoke_tilt=22.0, screen_y=1160.0, screen_s=1510.0,
           screen_tilt=7.0, console_end_s=2600.0, pedal_s=1348.0, door_arm_h=943.0, back_h=940.0,
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
        return roof_inner_h(p, s + run * math.sin(a), c['wall']) - run * math.cos(a)
    # Over the back seat the ceiling is the deck's inner face (no headliner there): the line ends on it.
    # (measure/cabin/audit.py checks the result on the built parts.)
    return from_head_room(s, c['head_rear'])

def pillar_planes(sx, p=None):
    """Sight planes bounding the A-pillar trim on one side (sx 1 left, -1 right), from
    measure/console/pillar_hull.json: each passes through a solved camera and the trim's outline in that photo,
    so the trim drawn up to it shows that outline from that camera. name -> (point, normal away from the trim)."""
    M = np.diag([sx, 1.0, 1.0])
    data = json.loads((HERE / 'measure' / 'console' / 'pillar_hull.json').read_text())
    out = {k: (M @ np.array(v['point']), M @ np.array(v['normal'])) for k, v in data.items()}
    if p is not None:
        # The two independently solved still cameras disagree by ~13 mm at the strip's lower face.
        # Allow 18 mm on Athens 1's front envelope (about 10 px here); Athens 2 still bounds the face.
        # This is calibration tolerance, not an exact trim-depth measurement.
        pt, n = out['strip upper athens1']
        out['strip upper athens1'] = (pt + n * 18.0, n)
        # The strip's lower sight planes pivot on its edge on the glass (the glass's top edge, which int-athens-1
        # reads directly; less 3, the opening's inset): each passes through that edge and its camera. The
        # passenger-seat camera sets only the underside's tilt (its outline meets the glass up to 25 mm off).
        pl = planes(p)
        key = 'window_l' if sx > 0 else 'window_r'
        wn = np.array(pl[key][1], float); wn = wn if np.dot(wn, [sx, 0, 0]) > 0 else -wn
        L1, L2 = (on_plane(pl[key], y=side_glass_seen(p, q) - 3, z=ZF - q) - wn * 10 for q in (1260.0, 947.0))
        for k in ('strip athens1', 'strip passenger seat'):
            C, n0 = out[k]
            n = np.cross(L2 - L1, C - L1); n /= np.linalg.norm(n)
            out[k] = (L1, n if np.dot(n, n0) > 0 else -n)
    return out

def pillar_carve(p):
    """Steel ahead of the firewall under the A-pillar strip's face: the glass openings leave a wedge of shell
    there that the real pillar doesn't have (it stands inside the trim), and it showed under the strip."""
    pl = planes(p)
    out = []
    for sx in (1, -1):
        key = 'window_l' if sx > 0 else 'window_r'
        blk = Box(500, 400, 620, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((sx * 850.0, 1215.0, ZF - 1110)))
        wn = np.array(pl[key][1], float); wn = wn if np.dot(wn, [sx, 0, 0]) > 0 else -wn
        g = lambda s, h: on_plane(pl[key], y=h, z=ZF - s) - wn * 10
        blk = plane_cut(blk, g(900, 1200), g(1300, 1200), g(1100, 1500), np.array([0.0, 1300.0, ZF - 1100]))   # inside the glass
        rp = pl['roof']; rn = np.array(rp[1], float); rn = rn if rn[1] > 0 else -rn
        r0 = np.array(rp[0], float) - rn * 12
        blk = plane_cut(blk, r0, r0 + np.cross(rn, [1, 0, 0]) * 100, r0 + np.array([100.0, 0, 0]), np.array([0.0, 1200.0, ZF - 1100]))
        keep = blk
        for k in ('strip athens1', 'strip passenger seat'):
            pt, n = pillar_planes(sx, p)[k]
            keep = halfspace_cut(keep, pt - n * 2, n)                    # 2 into the strip, so its faces cover the cut
        out.append(blk - keep)
    return Compound(out)

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
    pl = planes(p)
    holes = []
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        if kind == 'glass':
            hole = prism(inset_polygon(pts, n, 3.0), n, out=-(depth - 1.0), depth=320)   # starts above the pocket floor, so it removes it
            if name.startswith('side_glass_'):
                # The hull clips the glass at the window/sail crease. Stop the hole there too (3 mm in, like its
                # other edges), or it takes the sail's skin behind the rear window with it and the cabin shows through.
                win = pl['window_' + name[-1]]
                a = on_plane(win, y=p['belt_h_rear'], z=ZF - p['c_pillar_s'])      # the crease stands at the C-pillar
                b = edge_point(pl['deck'], win, ZF - p['c_pillar_s'])
                c = np.cross(b - a, win[1])
                c /= np.linalg.norm(c)
                if np.dot(sum(pts) / len(pts) - a, c) > 0:
                    c = -c                               # toward the sail, away from the glass
                hole = halfspace_cut(hole, a, c, 3.0)
            holes.append(hole)
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

def rod(a, b, up, w, t):
    """A strip from model point a to b, w wide and t thick, its thickness along `up` (made square to the strip):
    piping, seams, webbing."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a
    L = float(np.linalg.norm(d))
    d /= L
    y = np.asarray(up, float) - np.dot(up, d) * d
    y /= np.linalg.norm(y)
    x = np.cross(y, d)
    pl = Plane(origin=tuple((a + b) / 2), x_dir=tuple(x), z_dir=tuple(d))
    return Box(w, t, L).moved(Location(pl))

def rods(pts, up, w, t):
    """Strips along a polyline of model points, overlapping at the joints."""
    return [rod(pts[i], pts[i + 1], up, w, t) for i in range(len(pts) - 1)]

def inner_x(p, s, h, inset):
    """The cabin wall's half-width at (s, h): the nearest left-side facet, moved in by inset."""
    pl = planes(p)
    xs = []
    for k in ('side_l', 'tuck_l', 'window_l', 'sail_l'):
        pt, n = pl[k]
        if n[0] > 0.1:
            xs.append(on_plane((pt - n * inset, n), y=h, z=Z(s))[0])
    return min(xs)

def pillow(a, b, normal, xc, half, sag, region):
    """A padded crown on a flat face: the face runs from a to b in (s, h) at lateral centre xc; `normal` (s, h)
    points out of it. Returns the part of `region` (the space in front of the face) inside a cylinder along
    the face that stands `sag` mm proud on the centreline and meets the face `half` mm either side."""
    R = (half ** 2 + sag ** 2) / (2 * sag)
    a, b, nrm = np.asarray(a, float), np.asarray(b, float), np.asarray(normal, float)
    nrm /= np.linalg.norm(nrm)
    m = (a + b) / 2 - nrm * (R - sag)                  # the axis, behind the face
    to3 = lambda q: np.array([xc, q[1], ZF - q[0]])
    axis = to3(b) - to3(a)
    L = float(np.linalg.norm(axis)) + 400
    cyl = Cylinder(R, L).moved(Location(Plane(origin=tuple(to3(m)), z_dir=tuple(axis / np.linalg.norm(axis)))))
    return cyl & region

def crown_depth(xoff, half, sag):
    """How far a pillow stands proud of its face at xoff from its centreline."""
    R = (half ** 2 + sag ** 2) / (2 * sag)
    return max(0.0, math.sqrt(max(R ** 2 - xoff ** 2, 0)) - (R - sag))

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
    # The side bolsters wrap round the shoulders: each bolster's front face turns in toward the occupant, its
    # inner edge (at the insert) 25 mm behind its outer edge (dgRcedIkNOM-13, manual-seats-71D65904).
    for sd in (1, -1):
        A, B = V(xc + sd * 262, 760, 2300), V(xc + sd * 268, 1225, 2425)
        C = V(xc + sd * 150, 760, 2300 + 25)
        strip = SH([(2200, 700), (2600, 700), (2600, 1240), (2200, 1240)], min(xc + sd * 150, xc + sd * 280), max(xc + sd * 150, xc + sd * 280))
        wedge = plane_cut(strip, A, B, C, V(xc + sd * 200, 990, 2150))       # the part in front of the turned face
        back = back - wedge
    # The insert is padded: a crown 15 mm proud on its centreline, meeting the face at the bolsters.
    INS_SAG = 15.0
    back = back + pillow((2345, 760), (2470, 1225), (-465, 125), xc, 150, INS_SAG, insert)
    # The insert's seams (dgRcedIkNOM-13): a V from the shoulders down to the lumbar, then straight down.
    def ins_s(h):                                        # the insert's face, 45 mm behind the bolsters
        return 2345 + (h - 760) * 125 / 465
    fwd = (0, math.sin(math.atan2(125, 465)), -math.cos(math.atan2(125, 465)))   # out of the insert's face, toward the front
    for sd in (1, -1):
        fw = lambda xo: crown_depth(xo, 150, INS_SAG) * 465 / math.hypot(125, 465)        # the crown, along s
        seam = [V(xc + sd * 148, 1225, ins_s(1225) - fw(148)), V(xc + sd * 55, 1010, ins_s(1010) - fw(55)), V(xc + sd * 55, 770, ins_s(770) - fw(55))]
        for r in rods(seam, fwd, 5, 8):
            back = back - r
    # The map pocket on the back (dgRcedIkNOM-37): a panel standing 10 mm off the back's rear face over its
    # lower part, its top edge piped.
    def rear_s(h):
        return 2493 + (h - 812) * 133 / 504
    out_n = np.array([504.0, -133.0]) / math.hypot(504, 133)                    # rearward, square to the back
    pk = [(rear_s(830), 830), (rear_s(1180), 1180), (rear_s(1180) + out_n[0] * 12, 1180 + out_n[1] * 12),
          (rear_s(830) + out_n[0] * 12, 830 + out_n[1] * 12)]
    pocket = SH([(a - out_n[0] * 6, b - out_n[1] * 6) for a, b in pk[:2]] + pk[2:], xc - 215, xc + 215)
    cushion_side = [(1765, 645), (1765, 742), (1800, 760), (2300, 716), (2310, 645)]
    cushion_front = [(-262, 645), (262, 645), (266, 752), (228, 772), (196, 738), (-196, 738), (-228, 772), (-266, 752)]
    cushion = SH(cushion_side, xc - 300, xc + 300) & XH([(xc + x, h) for x, h in cushion_front], 1750, 2320)
    # The cushion's centre is padded too: 14 mm proud between the side bolsters.
    above = XH([(xc - 196, 737), (xc + 196, 737), (xc + 196, 800), (xc - 196, 800)], 1750, 2320) & SH(cushion_side, xc - 300, xc + 300)
    cushion = cushion + pillow((1765, 738), (2300, 738), (0, 1), xc, 196, 14.0, above)
    # Under the cushion's rear half the base is lifted and the seat stands on two rails, so the feet of the
    # passenger behind slide under it as far as the published rear leg room has them (L51, 1,038.8: the ankle
    # at s 2,393, measure/cabin/audit.py): the toes stop on the mechanism's block under the front half, which
    # ends at 2,138 for that. Shapes: guesses.
    base = SH([(1785, 646), (1800, 495), (2138, 489), (2195, 580), (2460, 580), (2470, 646)], xc - 250, xc + 250)
    fl = CAB['floor'] - 2
    stand = [XS([(xc - 180, 1850), (xc + 180, 1850), (xc + 180, 2138), (xc - 180, 2138)], fl, 492)]
    for x0 in (xc - 180, xc + 140):
        stand.append(XS([(x0, 1850), (x0 + 40, 1850), (x0 + 40, 2420), (x0, 2420)], fl, fl + 42))
        stand.append(XS([(x0, 2380), (x0 + 40, 2380), (x0 + 40, 2420), (x0, 2420)], fl, 584))
    stand = Compound(stand)
    knobs = []                                            # the three adjustment controls on the outboard side
    xo = xc + outboard * 251
    for s0, s1, h0, h1 in ((1880, 1940, 585, 600), (1955, 1972, 570, 610), (1980, 2010, 575, 605)):
        knobs.append(Box(10, h1 - h0, s1 - s0).moved(Location((xo + outboard * 3, (h0 + h1) / 2, Z((s0 + s1) / 2)))))
    # Light grey piping along every bolster's outer edge (dgRcedIkNOM-13, -26, -45): up the back's front
    # corners to the headrest, along the cushion's side bolsters, across the pocket's top.
    def back_front_s(h):
        return 2300 + (h - 760) * 125 / 465 if h <= 1225 else 2425 + (h - 1225) * 11 / 365
    widths = [(760, 258), (1000, 262), (1150, 268), (1420, 185), (1560, 160)]
    def half_w(h):
        return float(np.interp(h, [a for a, _ in widths], [b for _, b in widths]))
    piping = []
    for sd in (1, -1):
        pts = [V(xc + sd * (half_w(h) - 16), h, back_front_s(h) - 2 + (3.6 if h <= 1225 else 0)) for h in (775, 1000, 1150, 1225, 1420, 1555)]
        piping += rods(pts, (0, 0, -1), 6, 6)
        cpts = [V(xc + sd * 236, 770, 1795), V(xc + sd * 236, 728, 2280)]
        piping += rods(cpts, (0, 1, 0), 6, 6)
    tp = (rear_s(1180) + out_n[0] * 12, 1180 + out_n[1] * 12)
    piping.append(rod(V(xc - 215, tp[1], tp[0]), V(xc + 215, tp[1], tp[0]), (0, 1, 0), 6, 6))
    return {'seat': [back, cushion, pocket], 'seat_base': [base, stand], 'switch': knobs, 'piping': piping}

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
            ins = SH([tuple(q0 + nrm * 30), tuple(q1 + nrm * 30), tuple(q1 + [-200, 0]), tuple(q0 + [-200, 0])], xc - hw_in, xc + hw_in)
            back -= ins
            back += pillow(tuple(q0 + nrm * 30), tuple(q1 + nrm * 30), tuple(-nrm), xc, hw_in, 14.0, ins)
        if xc == 0:                                        # the stowed armrest fills a slot in the centre back
            slot_lo, slot_hi = A[1] + 5, A[1] + 420
            pa, pb = A + d * ((slot_lo - A[1]) / d[1]), A + d * ((slot_hi - A[1]) / d[1])
            slot = SH([tuple(pa + [-60, 0]), tuple(pb + [-60, 0]), tuple(pb + nrm * 75), tuple(pa + nrm * 75)], -153, 153)
            back = back - slot
            # Folded down onto the centre cushion, as in manual-interior-E5BB028D, with its two cupholders
            # (rounded hexagons) near the front. 105 thick, so it folds up into the 110 mm back.
            cush_top = hR - 26
            arm = SH([(sR + 60, cush_top), (sR - 360, cush_top), (sR - 360, cush_top + 90), (sR - 345, cush_top + 105), (sR + 60, cush_top + 105)], -150, 150)
            for xh in (-62, 62):
                arm = arm - XS(ngon(xh, sR - 290, 44, 6, math.pi / 6), cush_top + 40, cush_top + 120)
            out['armrest_r'].append(arm)
        out['seat'].append(back)
        cush = SH([(sR - 430, hR - 130), (sR - 430, hR - 28), (sR - 400, hR - 18), (sR + 90, hR - 45), (sR + 100, hR - 130)],
                  xc - hw, xc + hw)
        out['seat'].append(cush)
    out['seat_base'].append(SH([(sR - 410, c['floor'] - 2), (sR - 410, hR - 128), (sR + 300, hR - 128), (sR + 300, c['floor'] - 2)], -700, 700))
    return out, hR

YOKE_OUTLINE = json.loads((HERE / 'measure/yoke/outline.json').read_text())
YOKE_WHEELS = (-85.2, 16.0)                                   # scroll wheel centres at +-85.2, 16 high (left one measured)
# The keys the app works (icon centres, as drawn in textures.py): right and left turn signals, high beam.
YOKE_KEYS = {'signal_right': (-98.1, 25.3), 'signal_left': (-104.0, 9.8), 'high_beam': (-74.2, 27.8),
             'wiper': (98.1, 25.3)}                     # and on the right pod, the wiper

def yoke_parts():
    """The yoke, built facing +z (toward the driver) around its centre, x to the driver's right: the outer
    edge and three openings traced from the manual's straight-on render (measure/yoke/outline.py, 0.844
    mm/px), everything else read off the same render on a 10 mm grid (spec.md). The rim is the traced plate,
    rounded front and back; the centre pad stands proud with its recessed horn face; the silver chin joins it
    to the bottom of the rim; the two button pods sit on the spokes with a silver strip along their upper
    outer edge and a knurled scroll wheel in a ring. Depths are guesses (spec.md, Unknowns). No logo."""
    T = 30.0                                            # rim depth; assemble.py rounds its front and back edges (OCC's fillet stalls on the traced curves)
    def spline_face(pts):
        return Face(Wire([Spline(*[(x, y, 0) for x, y in pts], periodic=True)]))
    def poly(pts, r=0.0, z0=0.0, z1=1.0):
        with BuildSketch(Plane.XY.offset(z0)) as sk:
            Polygon(*pts, align=None)
            if r:
                fillet(sk.vertices(), r)
        return extrude(sk.sketch, amount=z1 - z0, dir=(0, 0, 1))
    o = YOKE_OUTLINE
    plate = extrude(spline_face(o['outer']), amount=T, dir=(0, 0, 1))
    for k in ('top', 'lower_left', 'lower_right'):
        plate -= extrude(spline_face(o[k]).moved(Location((0, 0, -1))), amount=T + 2, dir=(0, 0, 1))
    # Centre pad: wide at the top, its sides bowing in to the chin; top corners round into the hub's top.
    pad_pts = [(-68.6, 36), (-64, 10), (-59.4, -14), (-51, -38), (-42.5, -61), (42.5, -61), (51, -38), (59.4, -14),
               (64, 10), (68.6, 36), (52, 52), (-52, 52)]
    pz = T + 16
    pad = poly(pad_pts, 6, T - 4, pz)
    try:
        pad = fillet(pad.edges().group_by(Axis.Z)[-1], radius=6)
    except Exception as e:
        print('yoke: pad not rounded:', e)
    face_pts = [(-42.5, 27.8), (42.5, 27.8), (27.3, -39.6), (-27.3, -39.6)]
    pad -= poly(face_pts, 6, pz - 1.5, pz + 5)
    face = poly([(x * 0.99, y * 0.99 - 0.1) for x, y in face_pts], 5.6, pz - 1.4, pz - 0.6)
    chin = poly([(-40, -58), (40, -58), (27.3, -90), (-27.3, -90)], 2, T - 6, T + 9)
    try:
        chin = chamfer(chin.edges().group_by(Axis.Z)[-1], length=1.5)
    except Exception as e:
        print('yoke: chin not chamfered:', e)
    # Pods on the spokes, 7 mm proud; their inner ends run under the pad.
    pods, trims, wheels = [], [], []
    tip, low = (-123.0, 6.7), (-59.0, -15.2)
    pod_pts = [(-60, 42), (-69.5, 41.3), (-104.9, 33.7), (-123.0, 6.7), (-111.6, -5.0), (-59.0, -15.2)]
    knurl = [(7.4 if i % 2 == 0 else 6.9) * np.array([math.cos(i * math.pi / 16), math.sin(i * math.pi / 16)]) for i in range(32)]
    for sx in (1, -1):
        pts = [(sx * x, y) for x, y in pod_pts]
        pod = poly(pts if sx > 0 else pts[::-1], 3, T - 4, T + 7)
        try:
            pod = chamfer(pod.edges().group_by(Axis.Z)[-1], length=1.2)
        except Exception as e:
            print('yoke: pod not chamfered:', e)
        cx, cy = sx * YOKE_WHEELS[0], YOKE_WHEELS[1]
        pod -= Cylinder(7.4, 20).moved(Location((cx, cy, T + 7)))
        ring = Cylinder(8.8, 2.0).moved(Location((cx, cy, T + 7.4))) - Cylinder(7.4, 4).moved(Location((cx, cy, T + 7.4)))
        pods += [pod, ring]
        # The silver strip: a 1.6 mm band round the pod, kept above the line from its tip to its inner bottom.
        big = poly([(sx * x, y) for x, y in [(-58, 43.6), (-69.5, 42.9), (-105.6, 35.2), (-124.8, 6.7), (-112.2, -6.5), (-58, -16.8)]][::(1 if sx > 0 else -1)],
                   3, T - 3, T + 5.5)
        a, b = sorted([(sx * tip[0], tip[1]), (sx * low[0], low[1])])     # left to right, so the box's +y side is above the line
        keep = Box(400, 400, 100).moved(Location((0, 200, 0)))
        keep = keep.rotate(Axis.Z, math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))).moved(Location((a[0], a[1], 0)))
        trims.append((big - pod) & keep)
        # A knurled roller turning about x, trimmed to a ball: round from the driver's seat, 4 mm proud.
        drum = extrude(Face(Wire.make_polygon([(0, y, z) for y, z in knurl], close=True)).moved(Location((-8, 0, 0))), amount=16, dir=(1, 0, 0))
        drum = drum.moved(Location((cx, cy, T + 4))) & Sphere(7.1).moved(Location((cx, cy, T + 4)))
        wheels.append(drum)
    # Each key the app works: a 0.3 mm patch over its symbol, carrying the same texture, so it can glow alone.
    keys = {k: poly([(x - 4.5, y - 3.8), (x + 4.5, y - 3.8), (x + 4.5, y + 3.8), (x - 4.5, y + 3.8)], 1.5, T + 7.05, T + 7.35)
            for k, (x, y) in YOKE_KEYS.items()}
    return plate, pad, chin, face, Compound(pods), Compound(trims), Compound(wheels), keys

def yoke_place(s):
    """From the yoke's own frame (yoke_parts) to the cabin: turned to face the driver, tilted, on the column."""
    c = CAB
    return s.rotate(Axis.Y, 180).rotate(Axis.X, c['yoke_tilt']).moved(Location((c['seat_x'], c['yoke'][1], ZF - c['yoke'][0])))

def yoke_decal():
    """The pods' icon texture (textures.py, yoke_icons.png) spans x -130..130, y -20..45 in the yoke's frame;
    its centre and axes in the cabin, for assemble.py's planar mapping (u to the driver's right, v up)."""
    p0, px, py = (yoke_place(Vertex(*q)).center() for q in ((0, 12.5, 0), (1, 12.5, 0), (0, 13.5, 0)))
    return {'centre': list(p0), 'u': list(px - p0), 'v': list(py - p0), 'size': [260, 65]}

# The white block's pointed end at each door in (x out, h): top corner, tip, bottom corner (int-athens-1, measure/console/athens1-whiteend.md).
DASH_POINT = ((783.0, 1162.0), (832.0, 1120.0), (750.0, 1027.0))
# The nose is rounded 12 mm (assemble.py), which pulls its outline in from the block's end faces by about that; the
# end faces and the door's panel therefore sit NOSE_STEP outboard of the measured point, so the rounded nose's
# outline lands on it and the panel meets the nose behind its rounding. Radius: guess, read on those frames.
NOSE_STEP = 12.0

# The rear edge of the dash's white block and lower dash in (s, h), top to bottom, where the front door's trim meets them.
# The block is padded, not faceted (dgRcedIkNOM-32, 6:16, int-athens-3: one soft highlight over its upper half, no
# crease between chamfers and face): its measured corners, top 1,467 / 1,159, 1,488 / 1,118, 1,492 / 1,062 and the
# bottom 1,462 / 1,028, are rounded off by corner cutting, keeping its top, bottom and depth.
def corner_cut(pts, rounds=2):
    for _ in range(rounds):
        cut = [pts[0]]
        for (s0, h0), (s1, h1) in zip(pts, pts[1:]):
            cut += [(0.75 * s0 + 0.25 * s1, 0.75 * h0 + 0.25 * h1), (0.25 * s0 + 0.75 * s1, 0.25 * h0 + 0.75 * h1)]
        pts = cut[:1] + cut[2:-1] + [pts[-1]]
    return [(round(s, 1), round(h, 1)) for s, h in pts]
DASH_END = corner_cut([(1467.0, 1159.0), (1488.0, 1118.0), (1492.0, 1062.0), (1462.0, 1028.0)])

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
    # The sill under the glass is ~52 deep, the white panel starting under it (dgRcedIkNOM 6:16: 40 px against the
    # white panel's 175; int-athens-3 about the same), dark grey like the pillar trim
    bt0, bt1 = belt_h(p, s0) - 52, belt_h(p, s1) - 52
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
    if d == 'f':
        # With the door shut its trim runs forward past the seam to the dash, 2 mm behind its rear face (dgRcedIkNOM
        # 6:16 and 7:13): the white block's point butts onto the door's white panel, whose top meets the block's top
        # corner, and whose lower edge leaves the block's bottom corner (1,028) and falls back to the armrest's front;
        # under it the dark panel. The dash's lip and face end there, the door's cap and ambient line carrying on.
        # The profile is the white block's and the lower dash's rear edge (interior(), 'dash_white', 'dash_lower').
        wf = [(sw + 2, hw) for sw, hw in DASH_END]
        front_profile = wf + [(arm_s0 + 70, ya - 2), (s1, ya - 2), (s1, bt1)]
        white = SH(front_profile, hip - 40, xw)
        out['door_lower'].append(XH([(xw, 866), (hip, 866), (hip, 1100), (xw, 1100)], 1400, arm_s0 + 72)
                                 & SH([(1434, 866), (arm_s0, 866), (arm_s0 + 70, ya - 1), wf[-1], (1434, 880)], 0, 2000))
    # Crease: front door from high at the front to low at the back; rear door the other way (a chevron).
    hc_hi, hc_lo = (lambda s: belt_h(p, s) - 70), ya + 25
    c0 = np.array([sh, hc_hi(s0) if d == 'f' else hc_lo, Z(s0)])
    c1 = np.array([sh, hc_lo if d == 'f' else hc_hi(s1), Z(s1)])
    # Each facet's third point is the corner the crease leaves: bottom-front and top-rear on the front door.
    lo_s, hi_s = (s0, s1) if d == 'f' else (s1, s0)
    out_pt = np.array([2000, 1000, Z((s0 + s1) / 2)])
    if d != 'f':
        white = plane_cut(white, c0, c1, np.array([sh + 32, ya, Z(lo_s)]), out_pt)                   # lower facet
        white = plane_cut(white, c0, c1, np.array([sh + 60, belt_h(p, hi_s) - 34, Z(hi_s)]), out_pt)   # upper facet
    if d == 'f':
        # The shut door has one moulded return matching the dash's pointed end (int-athens-3,
        # dgRcedIkNOM-376s). Rebuild the panel as one solid BEFORE rounding; detached filler wedges
        # left internal faces and protruded ahead of the dash's sloping seam in the seated view.
        # The block's rounded nose stands proud of the door's panel (dgRcedIkNOM-32, 6:16, int-athens-3: the panel
        # meets it behind the nose's rounding, not flush with its point): the return starts on the block's end faces.
        (tcx, tch), (tpx, tph), (bcx, bch) = [(x + NOSE_STEP, h) for x, h in DASH_POINT]
        sf0, sf1 = min(sw for sw, _ in DASH_END), s1
        face_planes = [plane3(c0, c1, np.array(q)) for q in
                       ([sh + 32, ya, Z(lo_s)], [sh + 60, belt_h(p, hi_s) - 34, Z(hi_s)])]
        def face_x(h, s):
            return max(pt[0] - (n[1] * (h - pt[1]) + n[2] * (Z(s) - pt[2])) / n[0]
                       for pt, n in face_planes)
        top_h, low_h = DASH_END[0][1], ya - 2
        # Carry the return into the full door's two broad facets. A short transition
        # creates a folded triangular patch; the real crease runs down the whole door.
        low_x = bcx + (low_h - bch) * (tpx - bcx) / (tph - bch)
        front = [(tcx + (top_h - tch) * (tpx - tcx) / (tph - tch), top_h), (tpx, tph), (low_x, low_h), (xw, low_h), (xw, top_h)]
        back_top = belt_h(p, sf1) - 52
        back_crease = c0[1] + (c1[1] - c0[1]) * (sf1 - s0) / (s1 - s0)
        back = [(face_x(h, sf1), h) for h in (back_top, back_crease, low_h)] + [(xw, low_h), (xw, back_top)]
        sections = [Face(Wire.make_polygon([(x, h, Z(s)) for x, h in profile], close=True))
                    for s, profile in ((sf0, front), (sf1, back))]
        return_panel = loft(sections, ruled=True) & SH(front_profile, hip - 40, xw)
        white = return_panel.clean()
    out['trim_white'] = [white]
    c0s = DASH_END[0][0] + 3 if d == 'f' else s0
    ct0 = DASH_END[0][1] if d == 'f' else belt_h(p, c0s) - 52
    out['cap'] = [SH([(c0s, ct0 + 3), (s1, bt1 + 3), (s1, belt_h(p, s1) + 6), (c0s, belt_h(p, c0s) + 6)], sh + 10, xw)]
    out['ambient'] = [SH([(c0s, ct0 - 0.5), (s1 - 4, bt1 - 0.5), (s1 - 4, bt1 + 3.5), (c0s, ct0 + 3.5)], sh + 12, sh + 40)]
    if d == 'f':
        # The cap and light turn inward with the dash end. A constant shoulder-room
        # width left a 30 mm black notch between the two ambient strips.
        x0 = tcx + (ct0 - tch) * (tpx - tcx) / (tph - tch)
        out['cap'] = [SH([(c0s, ct0 + 3), (s1, bt1 + 3), (s1, belt_h(p, s1) + 6), (c0s, belt_h(p, c0s) + 6)], 0, xw)
                      & XS([(x0 + 2, c0s), (sh + 10, s1), (xw, s1), (xw, c0s)], 1000, 1400)]
        out['ambient'] = [SH([(c0s, ct0 - 0.5), (s1 - 4, bt1 - 0.5), (s1 - 4, bt1 + 3.5), (c0s, ct0 + 3.5)], 0, xw)
                          & XS([(x0 + 2, c0s), (sh + 12, s1 - 4), (sh + 40, s1 - 4), (x0 + 25, c0s)], 1000, 1400)]
    if d == 'f':
        g = [(s0 + 50, 470), (s0 + 330, 470), (s0 + 300, 640), (s0 + 50, 640)]
    else:
        g = [(s0 + 40, 480), (s0 + 230, 480), (s0 + 210, 600), (s0 + 40, 600)]
    out['grilles'] = [SH(g, hip + 30, hip + 36)]
    if sx < 0:
        out = {k: [q.mirror(Plane.YZ) for q in v] for k, v in out.items()}
    return out

# The door window's frame on the body: a black rounded upright where the fixed glass triangle ends and the front
# door's frameless glass begins, right behind the mirror's tip, curving round into a rail along the top of the window
# opening back to the B-pillar (c003, window down; dgRcedIkNOM-11). With the door open (c166, dgRcedIkNOM-12) the
# door's top is bare: the triangle and the frame stay on the body. The upright, measured in two photos: c003 through
# its solved camera, 1,722 to 1,797 after its seam bias (measure/doorframe/c003-post.md), and c165 (Hong Kong, side,
# scaled from the two front-door seams) where it shows through the door glass as a dark band at 1,731 to 1,807;
# c164 and c165 put the glass's own front edge at 1,730 and 1,763. The rail 72 deep below the roof edge, the corner
# about 85 round (c003, 1.45 mm/px). Its depth into the cabin (50) no photo shows: the side views see it edge-on
# (c003's 12 degree view gives the same 72 to 75 width as c165's square one) and the cabin photos don't reach it.
DASH_TOP = [(1435.0, 1207.0), (1398.0, 1231.0), (1045.0, 1246.0), (975.0, 1263.0)]   # the dash top's profile (s, h), lip to crest (see interior())
GRILLE_POST = dict(x=(765.0, 830.0), h=(1233.0, 1295.0))   # the post's speaker grille (int-athens-1, cast onto the post)
APOST = dict(span=67.0, depth=30.0)       # the A-pillar strip's wedge section: across the windshield from the crease, and its bottom corner's depth
WINDOW_EDGE = dict(s_front=1727.0, width=75.0, rail=72.0, corner=85.0, depth=50.0, inset=14.0)

def window_edge(p, sx):
    """The frame from the belt up and round into the rail under the roof edge, back to the B-pillar; in the window
    plane, inside the glass; on the body."""
    pl = planes(p)
    key = 'window_l' if sx > 0 else 'window_r'
    wn = np.array(pl[key][1], float); wn = wn if np.dot(wn, [sx, 0, 0]) > 0 else -wn
    f = WINDOW_EDGE
    s0, s1, sb = f['s_front'], f['s_front'] + f['width'], p['seam_2'] - PILLAR_HALF
    R, ri = f['corner'], 15.0
    def top(s):
        z = ZF - s
        return min(edge_point(pl['roof'], pl[key], z)[1], edge_point(pl['deck'], pl[key], z)[1]) - 20.0
    sh = []                                                    # the outline in (s, h), round the outside, back along the inside
    sh.append((s0, belt_h(p, s0) - 8.0))
    for a in np.linspace(math.pi, math.pi / 2, 9):             # the outer corner
        sh.append((s0 + R + R * math.cos(a), top(s0 + R) - R + R * math.sin(a)))
    for q in np.linspace(s0 + R + 50, sb, 12):
        sh.append((q, top(q)))
    for q in np.linspace(sb, s1 + ri + 50, 12):
        sh.append((q, top(q) - f['rail']))
    for a in np.linspace(math.pi / 2, math.pi, 5):             # the inner corner
        sh.append((s1 + ri + ri * math.cos(a), top(s1 + ri) - f['rail'] - ri + ri * math.sin(a)))
    sh.append((s1, belt_h(p, s1) - 8.0))
    pts = [on_plane(pl[key], y=h, z=ZF - q) - wn * f['inset'] for q, h in sh]
    edge = extrude(Face(Wire.make_polygon([tuple(q) for q in pts], close=True)), amount=f['depth'], dir=tuple(-wn))
    try:
        edge = fillet(edge.edges().filter_by(lambda e: e.length > 20 and e.length < 400), 8.0)
    except Exception:
        pass
    return edge

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
    # ---- dash. The shelf: a dark slab rising from its lip (1,207 high, 1,435 back) to its crest under the windshield.
    d0, d1 = 900.0, c['dash_s']
    # The top's profile (s, h), DASH_TOP: from the lip a short rounded nose up to 1,228, the long main top rising
    # gently to 1,246 at 1,045, then a steeper facet up to the crest under the glass. Read on dgRcedIkNOM-32 through
    # its solved camera, from the shading steps down the dash: the nose is the brighter band between rows 180 and the
    # lip at 217, the main top rows 108 to 176, the front facet rows 66 to 104, ending where the view out begins; the
    # crest agrees with the manual's seat side view (1,265 high near 1,019; 4.58 mm/px). Ahead of the crest the top
    # stays 8 under the glass. It was one plane from the lip to the crest (and before that level at 1,224 to 1,218,
    # meeting the glass at 900, so it looked half as deep from the driver's seat). The shelf is ~40 thick under it.
    under = (np.array(pl['roof'][0], float) - np.array([0, 8.0, 0]), np.array(pl['roof'][1], float))
    if under[1][1] < 0:
        under = (under[0], -under[1])
    prof = [(d1, c['dash_h'] - 12), *DASH_TOP, (d0, DASH_TOP[-1][1]), (d0, 1200.0), (1045.0, 1206.0), (1400.0, 1186.0)]
    shelf = halfspace_cut(SH(prof, -1300, 1300), *under)
    # Clipped to 10 under the outer skin rather than the cabin's 62 (inner), which held the top 62 under the windshield and
    # flattened its front; its ends stay 62 inside the side glass and the flanks, as before.
    shelf = shelf & hull(p, inset=10.0)
    for key, sx in (('window_l', 1), ('window_r', -1)):
        wn = np.array(pl[key][1], float); wn = wn if np.dot(wn, [sx, 0, 0]) > 0 else -wn
        shelf = halfspace_cut(shelf, np.array(pl[key][0], float) - wn * (c['wall'] + 2), wn)
    shelf = shelf & Box(2 * (body_w(p) - c['wall'] - 2), 3000, 8000)
    out['dash_top'] = fixed(shelf)
    # Under the lip (video frames dgRcedIkNOM-14, -16; manual dash render): a recessed grey face holding the
    # vent slot, the ambient line, then the white block (chamfered top, front face, chamfered bottom; 130 high,
    # spec.md), then the dark lower dash with the glovebox on the passenger side.
    def across(poly):
        return fixed((SH(poly, -1300, 1300) & inner) - well)
    # The lip, the vent slot and the face (2026-10-11): the lip edge 12 thick at 1,435 back, 1,207 high (dgRcedIkNOM-32
    # through its solved camera: its edge on row 216, which the manual side view's 1,431 back puts at 1,205; the face
    # can only lean back toward the cabin, as it does in that side view, if the lip stands ahead of the white block);
    # under it the dark vent slot (rows 226 to 232); then the face in the top's suede, leaning back to the ambient line
    # on the white block (rows 238 to 262, as light as the top: it faces up toward the cabin; side view: down and back
    # to 1,164 at 1,477). The face's lean and the slot's depth: read on those two pictures, not measured to the mm.
    shelf = out['dash_top']
    out['dash_top'] = shelf - SH([(1395, 1100), (1445, 1100), (1445, c['dash_h'] - 12), (1395, c['dash_h'] - 12)], -1300, 1300)
    # The face starts just behind the lip, past the slot, nearly level (in the frame it is brightest there, as light as
    # the top, and darkens downward), then turns down to the ambient line: a rounded nose, drawn as two facets.
    out['dash_face'] = across([(1400, 1180), (1440, 1180), (1441, 1190), (1452, 1188), (1466, 1167), (1466, 1160), (1400, 1160)])
    out['dash_vent'] = across([(1396, 1180), (1404, 1180), (1404, c['dash_h'] - 11), (1396, c['dash_h'] - 11)])
    out['ambient'] = across([(1452, 1159.5), (1471, 1159.5), (1471, 1163.5), (1452, 1163.5)])
    white = across([*DASH_END, (1300, 1028), (1300, 1159)])
    # At each door the block ends in a point, measured on its face through int-athens-1's solved camera
    # (measure/console/athens1-whiteend.md): the top corner 783 out at 1,162, the tip 832 out at 1,120, the
    # bottom corner 750 out at 1,027 (its top and bottom read 1,167 and 1,027 there, the model's 1,159 and 1,028).
    # The end faces run straight back along the truck (dgRcedIkNOM 3:14: the end is flat toward the door).
    def line_h(p0, p1, x):
        return p0[1] + (x - p0[0]) * (p1[1] - p0[1]) / (p1[0] - p0[0])
    TC, TIP, BC = [(x + NOSE_STEP, h) for x, h in DASH_POINT]       # the end faces, outside the rounded nose's outline
    cuts = []
    for sx in (1, -1):
        up = [(sx * 770, line_h(TC, TIP, 770)), (sx * 1000, line_h(TC, TIP, 1000)), (sx * 1000, 1250), (sx * 770, 1250)]
        lo = [(sx * 740, line_h(BC, TIP, 740)), (sx * 1000, line_h(BC, TIP, 1000)), (sx * 1000, 980), (sx * 740, 980)]
        cuts += [XH(up, 1250, 1550), XH(lo, 1250, 1550), XH([(sx * TIP[0], 980), (sx * 1000, 980), (sx * 1000, 1250), (sx * TIP[0], 1250)], 1250, 1550)]
    out['dash_white'] = white - Compound(cuts)
    lower = across([(1462, 1029), (1430, 880), (1390, 700), (1170, 700), (1170, 1029)])
    # The glovebox: a slim drawer face right under the white block, from just outboard of the screen to near the
    # door (CC015C4E, 18, through the dash camera on the lower face: x -236 to -612 at the top, -212 to -604 at
    # the bottom, 968 high; measure/int/glove.md). B379A2C2 shows the same leaning inner edge.
    gl = [(-236, 1024), (-612, 1024), (-604, 968), (-212, 968)]
    gi = [(-237.5, 1021), (-609, 1021), (-601.5, 971), (-215.5, 971)]
    glove = XH(gl, 1300, 1530) - XH(gi, 1290, 1540)
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
    place = yoke_place
    rim, pad, chin, face, pods, trims, wheels, keys = yoke_parts()
    t = math.radians(c['yoke_tilt'])
    col_dir = np.array([0, -math.sin(t), math.cos(t)])
    col = Cylinder(30, 300).rotate(Axis.X, c['yoke_tilt']).moved(Location(tuple(np.array(yc) + col_dir * 175)))
    shroud = Box(110, 90, 200).rotate(Axis.X, c['yoke_tilt']).moved(Location(tuple(np.array(yc) + col_dir * 230)))
    out['yoke'] = place(rim)
    out['yoke_pad'] = place(pad)
    out['yoke_column'] = col + shroud
    out['yoke_chin'] = place(chin)
    out['yoke_face'] = place(face)
    out['yoke_pods'] = place(pods)
    out['yoke_trim'] = place(trims)
    out['yoke_keys'] = place(wheels)
    for k, key in keys.items():
        out[f'yoke_btn_{k}'] = place(key)
    # ---- centre console (refs/web/int-athens-3.jpg, a real truck seen from the driver's seat; manual-storage-34C29DB3,
    # -electronics-2298443C, -886D0FDA, -D54DBA46). Front to back: a deep well lined in dark felt (its front wall
    # sloping back, a felt-covered rib down the slope between the two chargers under it, a lip at their foot),
    # the cupholder pod (one figure-eight pocket, pinched between the cups by faceted wedges from its front and
    # back walls), the padded grey armrest lid, the rear section, and the rear face with the rear screen in its
    # vent surround. The top is a satin silver band that wraps 20 down the black sides; under it the body steps
    # in 10 (2298443C) and narrows to the floor, its front face leaning back. Front measured at 1,614 back, 918
    # high (dash camera); the rest scaled from the pictures (spec.md, "Console top").
    se = c['console_end_s']
    # The tray holds a charger well about as long as the cupholder pod (2298443C, int-athens-3), and the lid is
    # about twice as long as it is wide (34C29DB3, open): the lid starts 1,795 back, right behind the pod.
    # Front and lid measured on the dash render through its camera on their own heights (rim 918, lid 943;
    # measure/int/glove.md): the rim's front edge 1,614 back, the lid's front 1,897. (Taken before as 1,494 on the
    # x = 0 plane, a near-grazing ray, at the pixel of the dash's lower edge.) The lid keeps its 535 length.
    cf = 1614.0
    lid0, lid1 = 1897.0, 2432.0
    rim_h, band, step = 918.0, 20.0, 10.0
    crease = rim_h - band
    # The lid's top is level with the door armrests (943): from the driver's eye the whole pod shows in front of
    # it (int-athens-3), which a lid more than ~25 above the rim would hide.
    ah = c['door_arm_h']
    side = [(cf + 66, c['floor'] - 2), (cf, 690), (cf, rim_h), (lid0, rim_h), (lid0, ah), (lid1, ah), (lid1 + 15, ah + 12),
            (se, ah + 12), (se, 640), (se - 90, 560), (se - 120, c['floor'] - 2)]
    frontl = [(-112, c['floor'] - 2), (112, c['floor'] - 2), (146 - step, crease), (146, crease), (146, rim_h), (132, ah + 12),
              (-132, ah + 12), (-146, rim_h), (-146, crease), (-146 + step, crease)]
    shell = SH(side, -160, 160) & XH(frontl, cf - 14, se + 10)
    # the charger well: its front wall slopes back 34 degrees from vertical from just under the rim to the floor
    wf, wfl, ww = cf + 20, 785.0, 124.0
    A, B = np.array([wf, 904.0]), np.array([cf + 96, 790.0])
    d = (B - A) / np.linalg.norm(B - A)
    n = np.array([-d[1], d[0]])                           # normal pointing back and up, off the slope into the well
    if n[0] < 0:
        n = -n
    # The cupholders are chamfered octagons, 80 across and 87 along the truck, their pair spanning 0.89 of the
    # width (886D0FDA, near top-down; the along-truck size corrected for the view's ~50 degree tilt), right in
    # front of the lid with a 15 wall. Between the cups the pocket narrows to a 36 passage: the front and back
    # walls come in as wedges whose tops slope down 40 into it (int-athens-3).
    cups_s, cup_x, ca, cb, cc = lid0 - 15 - 43.5, 90.0, 40.0, 43.5, 13.0
    def octagon(xc):
        return [(xc - ca + cc, cups_s - cb), (xc + ca - cc, cups_s - cb), (xc + ca, cups_s - cb + cc), (xc + ca, cups_s + cb - cc),
                (xc + ca - cc, cups_s + cb), (xc - ca + cc, cups_s + cb), (xc - ca, cups_s + cb - cc), (xc - ca, cups_s - cb + cc)]
    cups = Compound([XS(octagon(xc), 800, 1000) for xc in (-cup_x, cup_x)])
    gx = cup_x - ca + cc                                  # the pinch spans between the cups' straight sides
    passage = XS([(-gx, cups_s - 18), (gx, cups_s - 18), (gx, cups_s + 18), (-gx, cups_s + 18)], 800, 1000)
    pinch = SH([(cups_s - 18, rim_h - 40), (cups_s + 18, rim_h - 40), (cups_s + cb - cc, rim_h + 1), (cups_s - cb + cc, rim_h + 1)], -gx, gx)
    wb = cups_s - cb - 18                                 # the well's back wall, 18 thick, just ahead of the cupholders (886D0FDA)
    well = SH([(wf, 1000), tuple(A), tuple(B), (B[0], wfl), (wb, wfl), (wb, 1000)], -ww, ww)
    hollow = well + cups + passage + pinch
    top = SH([(cf - 14, crease), (se + 20, crease), (se + 20, rim_h), (cf - 14, rim_h)], -200, 200)
    lid = SH([(lid0, rim_h), (lid1, rim_h), (lid1, ah + 1), (lid0, ah + 1)], -200, 200)
    con = shell - top - lid - hollow
    out['console'] = con
    out['console_lid'] = shell & lid
    # the band, with the grip tabs (small wedges) on each cup's inboard and outboard walls
    rim = (shell & top) - hollow
    tabs = []
    for xc in (-cup_x, cup_x):
        for sd in (-1, 1):
            x0 = xc + sd * (ca - 0.5)
            tabs.append(XS([(x0, cups_s - 10), (x0, cups_s + 10), (x0 - sd * 13, cups_s)], rim_h - 70, rim_h - 36))
    out['console_rim'] = rim + Compound(tabs)
    # the felt lining over the chargers, one piece across the slope; the rib down its middle and the lip at its foot
    def on_slope(t0, t1, off0, off1):
        return [tuple(A + d * t0 + n * off0), tuple(A + d * t1 + n * off0), tuple(A + d * t1 + n * off1), tuple(A + d * t0 + n * off1)]
    L = float(np.linalg.norm(B - A))
    out['chargers'] = SH(on_slope(0, L, 0.05, 3), -ww + 0.5, ww - 0.5)
    rib = SH(on_slope(2, L, 0.0, 12), -4, 4)
    lip = SH([(B[0] - 4, wfl - 0.1), (B[0] + 20, wfl - 0.1), (B[0] + 20, wfl + 37), (B[0] + 8, wfl + 37)], -ww, ww)     # stands ~12 proud of the pads' foot
    out['charger_trim'] = rib + lip
    rs = se + 7                                          # the surround stands 7 mm proud of the rear face
    out['rear_vents'] = SH([(se - 5, 760), (rs, 760), (rs, 935), (se - 5, 935)], -125, 125)
    out['rear_screen'] = SH([(rs - 1, 783), (rs + 1, 783), (rs + 1, 900), (rs - 1, 900)], -104, 104)
    # Two USB-C ports under the rear screen's surround (manual-interior-E5BB028D, item 3): dark slots 9 x 3.5.
    out['usb'] = Compound([SH([(se - 4, 741), (se + 1.5, 741), (se + 1.5, 744.5), (se - 4, 744.5)], xu - 4.5, xu + 4.5) for xu in (-22, 22)])
    # ---- seats
    seats = {'seat': [], 'seat_base': [], 'switch': [], 'piping': []}
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
    out['piping'] = Compound(seats['piping'])
    # ---- seat belts. Front: the D-ring on its height adjuster on the B-pillar (manual-seatbelts-0EF5959F), the
    # belt hanging down the pillar's trim to the retractor at its foot (-25FB8DBC), the buckle on a stalk inboard
    # of the cushion (-F460CA2E). Rear outboard: from the cab's back wall at the shoulder down beside the cushion;
    # the buckles between the places. Heights of the D-ring and anchors: guesses from those pictures.
    belts, hw = [], []
    sb = p['seam_2']
    hR = rear_h_point(p)
    sR = c['h_rear'][0]
    for sd in (1, -1):
        xr = lambda h, inset: sd * (inner_x(p, sb, h, c['wall'] + inset))
        top, foot = 1330.0, 470.0
        hw.append(rod(V(xr(top + 50, 46), top + 50, sb), V(xr(top - 40, 46), top - 40, sb), (sd, 0, 0), 44, 10))       # adjuster plate
        hw.append(rod(V(xr(top, 50), top, sb), V(xr(top - 30, 50), top - 30, sb), (sd, 0, 0), 56, 14))                  # D-ring
        belts += rods([V(xr(h, 52), h, sb) for h in (top - 20, 1150, 900, foot + 70)], (sd, 0, 0), 48, 2.5)
        hw.append(rod(V(xr(foot + 60, 75), foot + 60, sb), V(xr(foot - 30, 75), foot - 30, sb), (sd, 0, 0), 80, 50))    # retractor
        # rear outboard: shoulder anchor on the back wall, down beside the cushion
        xa = sd * 640
        sa = c['cab_rear_s'] - 30
        belts += rods([V(xa, hR + 560, sa), V(sd * 700, hR + 200, sa - 10), V(sd * 712, hR - 20, sR + 80)], (0, 0, -1), 48, 2.5)
        hw.append(rod(V(xa, hR + 600, sa + 2), V(xa, hR + 540, sa + 2), (0, 0, -1), 60, 16))
    for xc in (c['seat_x'], -c['seat_x']):                # front buckles, on the console side of each seat
        xi = xc - math.copysign(285, xc)
        hw.append(rod(V(xi, 600, 2240), V(xi, 700, 2215), (1, 0, 0), 28, 22))                  # stalk
        hw.append(rod(V(xi, 700, 2215), V(xi, 775, 2196), (1, 0, 0), 34, 22))                  # buckle
    for xb in (-215, -160, 160, 215):                    # rear buckles, between the places
        hw.append(rod(V(xb, hR - 40, sR + 70), V(xb, hR + 30, sR + 50), (1, 0, 0), 30, 20))
    out['belts'] = Compound(belts)
    out['belt_hw'] = Compound(hw)
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
    # The beam across the roof at the apex: its front face is where the front head room's line (8 degrees
    # behind vertical from the measured H-point, 1,058.8 - 102 long) meets the ceiling, so the published head
    # room holds; under the glass ahead of it the line would run 43 mm further. Its rear edge is a guess.
    a8 = math.radians(8)
    apex_front = c['h_front'][0] + (c['head_front'] - 102.0) * math.sin(a8)
    # It fills up to the glass (10 mm inside the skin), so nothing shows between them.
    # Behind the header the suede headliner runs on, under the windshield's upper part, back to this beam
    # (dgRcedIkNOM-31: dark suede behind the lowered visor, no glass overhead; c134: from above, the clear glass
    # shows nothing behind the mirror housing). Before, bare glass there showed the seats from outside.
    beams = [band & sband(h0, apex_front + 5) & roof_only, ceiling_band(p, 10 - c['wall'], 24) & sband(apex_front, p['apex_s'] + 40) & roof_only]
    rails = []
    # The windshield bar already carries the front roof-edge trim. A second ceiling-band
    # rail intersected it at a different depth and made two open slits over the quarter glass.
    for ka, kb, s0, s1, reach in (('deck', 'window_l', p['apex_s'], c['cab_rear_s'] - 10, 45),
                                  ('deck', 'window_r', p['apex_s'], c['cab_rear_s'] - 10, 45)):
        rails.append(band & sband(s0, s1) & edge_wedge(p, ka, kb, reach))
    head = Compound(beams + rails)
    out['headliner'] = fixed(head & Box(2400, 2400, 8000, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, c['dash_h'] + 40, 0))))
    # B-pillar trim between the doors (fixed), the cab's back wall above the rear seat.
    b0, b1 = p['seam_2'] - PILLAR_HALF + 2, p['seam_2'] + PILLAR_HALF - 2
    bpil = SH([(b0, c['floor']), (b1, c['floor']), (b1, 2000), (b0, 2000)], -1300, 1300) & (hull(p, inset=c['wall'] - 3) - hull(p, inset=c['wall'] + 40))
    out['pillar_trim'] = bpil - Box(1520, 3000, 8000)                 # only the sides, outboard of 760
    # The A-pillar's inner trim (int-athens-1, -2; dgRcedIkNOM 6:16, 7:13, -32): a suede post at the door's front
    # edge and, ahead of it, a strip down the windshield's edge to the dash, with a triangle of the side glass
    # showing between them. The post's rear face is the window opening's edge, through int-athens-1's solved camera
    # (5.9 px RMS, measure/console/athens1-pillar.md): 1,410 back at the dash, 1,470 at 1,370 high, the rounded
    # corner at 1,496 and 1,399.
    apil, grilles = [], []
    # The post's camera-fitted rear face remains in its measured position. Widening
    # the glass must not widen the visible cabin face with it.
    trim_pl = planes(PILLAR_REFERENCE)
    for key in ('window_l', 'window_r'):
        sx = 1 if key == 'window_l' else -1
        wn = np.array(trim_pl[key][1], float)
        wn = wn if np.dot(wn, [sx, 0, 0]) > 0 else -wn                  # outward
        def wpt(s, h, off=0.0):
            return on_plane(trim_pl[key], y=h, z=ZF - s) - wn * off
        inside = np.array([0.0, 1200.0, ZF - 1600])
        blk = Box(1200, 900, 1200).moved(Location((sx * 700, 1500, ZF - 1100)))
        A, B = wpt(1395, 1219, 10), wpt(1496, 1401, 10)       # int-athens-1 with its EXIF focal (measure/console/athens1-pillarx.md)
        inward = -wn
        col = plane_cut(blk, wpt(1200, 1200, 10), wpt(1600, 1200, 10), wpt(1400, 1500, 10), inside)            # inside the glass
        # Its front and inner sides: drawn up to the sight planes through its outline in int-athens-1 (5.9 px
        # RMS), dgRcedIkNOM-32 (9 px) and, mirrored, dgRcedIkNOM at 6:16 (measure/console/pillar_hull.py), so it
        # shows those outlines from those cameras. Its faces are rounded, so each camera's outline is a different
        # line on them (crossing two outlines as if one edge put it outside the glass).
        hull_pl = pillar_planes(sx, p)
        for k in ('post athens1', 'post athens2', 'post d32'):
            col = halfspace_cut(col, *hull_pl[k])
        rp = planes(p)['roof']
        rn = np.array(rp[1], float); rn = rn if rn[1] > 0 else -rn
        r0 = np.array(rp[0], float) - rn * 12
        col = plane_cut(col, r0, r0 + np.cross(rn, [1, 0, 0]) * 100, r0 + np.array([100.0, 0, 0]), inside)        # under the windshield
        col = plane_cut(col, A, B, A + inward * 100, np.array([sx * 700.0, 1300.0, ZF - 1200]))                  # ahead of the opening
        # below the dash it carries on as a dark foot beside the white block's end, down to 850 (dgRcedIkNOM 3:12,
        # int-athens-1: dark between the block's end and the door's white panel)
        col = col & Box(2400, 1500, 8000, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, 850.0, 0)))
        col = col & Box(2400, 3000, 1600, align=(Align.CENTER, Align.CENTER, Align.MAX)).moved(Location((0, 0, ZF - 950)))
        # under the glass the window plane leans out past the steel: below the belt the foot stays inside the
        # shell's inner face (it stood 90 proud of the fender above the front wheel)
        b0, b1 = (np.array([0.0, belt_h(p, s), ZF - s]) for s in (950.0, 1410.0))
        above = plane_cut(Box(2400, 3000, 8000), b0, b1, b0 + np.array([100.0, 0, 0]), np.array([0.0, 2500.0, ZF - 1200]))
        col = (col & above) + ((col - above) & inner)
        # The rear upright terminates in the diagonal bar, rather than continuing as a separate
        # slab toward the roof. An 18 mm overlap under its moulded return keeps their union closed.
        post_join, post_join_n = hull_pl['strip athens1']
        col = halfspace_cut(col, post_join - post_join_n * 18.0, -post_join_n)
        # The strip: a rounded suede bar over the steel between the two glasses, under the windshield, drawn up to
        # the sight planes through its two outlines in int-athens-1 (measure/console/pillar_hull.py): the lower
        # one on the side glass's top edge (athens1-strip.md), the upper one hanging under the windshield (its
        # ray meets the windshield 20 outboard of the crease, so the bar's edge is below the glass), with a dark
        # lip between it and the clear windshield, which is the windshield's black band; and through its lower
        # outline at 6:16, from the passenger's seat, which sets how far its underside rises inboard.
        # Now one even bar along the crease from the dash up to the apex, as dgRcedIkNOM-31 shows it (its face an even
        # width all the way, meeting the dash at the windshield's lower corner); the sight planes above made it a
        # wedge hanging over the glass triangle with a gap behind it. Its depth from the crease is a guess (APOST).
        # Built on the truck's own glass planes (the sight planes above were on PILLAR_REFERENCE's, from before the
        # pane was widened), 10 under the side glass and 12 under the windshield.
        act = planes(p)
        an = np.array(act[key][1], float); an = an if np.dot(an, [sx, 0, 0]) > 0 else -an
        arn = np.array(act['roof'][1], float); arn = arn if arn[1] > 0 else -arn
        ar0 = np.array(act['roof'][0], float) - arn * 12
        def apt(s, h, off=0.0):
            return on_plane(act[key], y=h, z=ZF - s) - an * off
        strip = plane_cut(Box(1200, 900, 2600).moved(Location((sx * 700, 1500, ZF - 1500))), apt(1200, 1200, 10), apt(1600, 1200, 10), apt(1400, 1500, 10), inside)
        strip = plane_cut(strip, ar0, ar0 + np.cross(arn, [1, 0, 0]) * 100, ar0 + np.array([100.0, 0, 0]), inside)
        # Its section is a wedge (2026-10-11): from the crease it runs APOST['span'] in under the windshield (its edge on the
        # glass 71 to 82 in from the side glass through dgRcedIkNOM-32's solved camera, which puts the clear glass's edge
        # within 3 mm of the model's), meets the side glass at the crease itself (2 to 10 below the windshield there), and
        # its bottom corner lies half way across (int-athens-1: the dark underside and the lit inner face meet at 0.47 to
        # 0.50 of the way between the two edges, a ratio its camera's near-field offset doesn't change), APOST['depth']
        # under the windshield.
        def wedge_pts(sq):
            base = edge_point(act['roof'], act[key], ZF - sq) - arn * 12
            step = np.cross(arn, np.cross(an, arn)); step = -step / np.linalg.norm(step)       # along the windshield, inboard
            d0 = np.dot(np.array(act[key][0], float) - base, an)
            per = np.dot(-step, an)                     # distance from the side glass gained per mm inboard
            K = base + step * ((10 - d0) / per)
            W = base + step * ((10 + APOST['span'] - d0) / per)
            return K, W, (K + W) / 2 - arn * APOST['depth']
        (K1, W1, P1), (K2, W2, P2) = wedge_pts(1000.0), wedge_pts(2000.0)
        glass_pt = (K1 + W1) / 2 + arn * 2
        strip = plane_cut(strip, K1, K2, P1, glass_pt)                                            # its underside
        strip = plane_cut(strip, W1, W2, P1, glass_pt)                                            # its face toward the cabin
        # It runs on up the windshield's edge to the roof's apex, covering the glass's black band (its inner edge
        # 75 in from the glass's edge, as c134 shows it from outside): int-athens-2 shows suede right up to clear
        # glass all the way up, post and strip one surface above the glass triangle. Behind the window opening it
        # keeps to the crease (no deeper than the roof-edge rail), so it doesn't stand out over the side window.
        # The strip's measured inner face is independent of the newly corrected pane width.
        strip = strip & Box(2400, 3000, p['apex_s'] - 800, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, ZF - p['apex_s'])))
        # Ahead of the post's rear face (the door opening's edge, A-B above) the strip keeps its full section; behind
        # it only the rail along the crease.
        fwd = plane_cut(Box(2400, 4000, 8000), A, B, A + inward * 100, np.array([sx * 700.0, 1300.0, ZF - 1200]))
        strip = (strip & fwd) + ((strip - fwd) & edge_wedge(p, 'roof', key, 45))
        strip = strip & Box(2400, 1500, 8000, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, 1254.0, 0)))   # ends on the dash, where its lower edge meets it
        strip = strip & Box(2400, 3000, 1600, align=(Align.CENTER, Align.CENTER, Align.MAX)).moved(Location((0, 0, ZF - 800)))
        # The speaker grille on the post's face toward the seats (its rear face, the door opening's edge), just above the
        # dash end: its corners in int-athens-1 cast through its solved camera onto the post, which lands on the photo's
        # (measure/console/athens1-grille.md): 1,233 to 1,295 high, 765 to 830 out from the centreline, about 65 x 62. A skin
        # 2.5 proud of the post there.
        back = np.array([0.0, 0.0, -1.0])
        skin = col.moved(Location(tuple(back * 2.5))) - col
        gx0, gx1 = GRILLE_POST['x']
        grilles.append(skin & sband(1380, 1480) & Box(gx1 - gx0, GRILLE_POST['h'][1] - GRILLE_POST['h'][0], 8000, align=(Align.MIN, Align.MIN, Align.CENTER)).moved(Location((gx0 if sx > 0 else -gx1, GRILLE_POST['h'][0], 0))))
        # The tweeter grille on the bar's underside just ahead of the post's top (dgRcedIkNOM-31, the only picture that shows
        # it; no solved camera): the same square part as the post's grille in that frame, so 65 along the bar, across its
        # underside from 10 to 55 in from the side glass; its rear edge one grille ahead of the post, as there.
        gz = strip.moved(Location(tuple(-arn * 2.5))) - strip
        gz = halfspace_cut(gz, apt(1400, 1300, 10 + 10), an)
        gz = halfspace_cut(gz, apt(1400, 1300, 10 + 55), -an)
        grilles.append(gz & sband(1310, 1375))
        col = col + strip
        # The measured post is capped below the current windshield before joining
        # the bar; subtracting the pane footprint afterwards left thin shards.
        apil.append(col)
    out['a_pillar_inner'] = Compound(apil)
    out['tweeters'] = fixed(Compound(grilles))         # the speaker grilles on the post and the strip (both drawn above)
    out['window_edge'] = Compound([window_edge(p, 1), window_edge(p, -1)])
    out['rear_wall'] = (SH([(c['cab_rear_s'] - 26, c['floor']), (c['cab_rear_s'] + 5, c['floor']), (c['cab_rear_s'] + 5, 2000), (c['cab_rear_s'] - 26, 2000)], -1300, 1300) & inner)
    # Sun visors, stowed flat under the header (dgRcedIkNOM-31; the manual's dash render shows none over the
    # glass). Sizes are guesses.
    vis = ceiling_band(p, 24.5, 40) & sband(h0 + 10, h1 - 10) & roof_only
    out['visors'] = vis & (Box(640, 3000, 8000).moved(Location((370, 1500, 0))) + Box(640, 3000, 8000).moved(Location((-370, 1500, 0))))
    # Overhead console: a plate from the header down to the rear-view mirror (dash render: its lower corners
    # ±136 wide at 1,490 high, 1,578 back; the mirror below, measured in int-athens-3).
    hy = roof_inner_h(p, h0 + 60, c['wall'] + 20)
    oc = [np.array([30, hy + 30, Z(h0 + 60)]), np.array([-30, hy + 30, Z(h0 + 60)]), np.array([-136, 1490, Z(1578)]), np.array([136, 1490, Z(1578)])]
    ocp = Wire.make_polygon([tuple(q) for q in oc], close=True)
    nrm = np.cross(oc[1] - oc[0], oc[2] - oc[0]); nrm /= np.linalg.norm(nrm)
    up_n = nrm if nrm[1] > 0 else -nrm
    # That plate is the mirror mount's light grey housing. In front of it (dash render, zoomed): a dark strip
    # down from the header with the drive-mode buttons (P R N D, the hazard light above them), the pod with
    # the cabin camera at its foot, and two thin arms from the header's ends meeting the strip: the V.
    out['overhead'] = extrude(Face(ocp), amount=24, dir=tuple(up_n))
    # On the housing's cabin-side face (it lies along the windshield glass, so it's seen at a grazing angle).
    top_mid, bot_mid = (oc[0] + oc[1]) / 2, (oc[2] + oc[3]) / 2
    top_c = top_mid - up_n * 4
    bot_c = bot_mid + (top_mid - bot_mid) * 0.12 - up_n * 4
    strip = rod(top_c, bot_c, -up_n, 78, 16)
    pod = rod(bot_c + (top_c - bot_c) * 0.02, bot_c - (top_c - bot_c) / np.linalg.norm(top_c - bot_c) * 55, -up_n, 92, 30)
    out['overhead_strip'] = strip + pod
    keys = []
    dirv = (bot_c - top_c) / np.linalg.norm(bot_c - top_c)
    for i in range(5):                                   # hazard light, then P R N D, down the strip
        q = top_c + dirv * (30 + 22 * i) - up_n * 9
        keys.append(rod(q - dirv * 5, q + dirv * 5, -up_n, 12, 3))
    lens = bot_c + dirv * 30 - up_n * 26
    keys.append(rod(lens - dirv * 9, lens + dirv * 9, -up_n, 18, 4))
    out['overhead_keys'] = Compound(keys)
    hx = roof_inner_h(p, h0 + 5, c['wall'] + 26)
    arms = []
    for sd in (1, -1):
        a0 = np.array([sd * 235, hx, Z(h0 + 5)])
        a1 = top_c + dirv * 60 + np.array([sd * 36, 0, 0])
        arms.append(rod(a0, a1, -up_n, 18, 14))
    out['overhead_arms'] = Compound(arms)
    # The rear-view mirror, turned 18 degrees toward the driver as it is driven: the glass's lower corners through
    # int-athens-3's camera (measure/console/athens3-mirror.md) with the glass centred on the truck, level, and
    # as wide as the dash render shows it at that depth (the render looks along it, so it fixes the ray to the
    # mirror but hardly its depth): 187 x 48, its lower edge 1,450 high (the render's ray: 1,454), the face
    # 1,664 back. It hung 43 further forward, square to the truck.
    mw, mh, md, m_face, m_yaw = 187.0, 48.0, 28.0, 1664.0, 18.0
    fc = np.array([0.0, 1450.0 + mh / 2, Z(m_face)])
    m_ax = Axis(tuple(fc), (0, 1, 0))                              # turned about the face's centre, the driver's end forward
    fwd = np.array([-math.sin(math.radians(m_yaw)), 0.0, math.cos(math.radians(m_yaw))])
    stem = rod((0.0, 1525.0, Z(1600)), fc + fwd * md + np.array([0.0, mh / 2 - 12, 0.0]), (1, 0, 0), 26, 22)
    out['rear_mirror'] = Box(mw, mh, md).moved(Location(tuple(fc + [0, 0, md / 2]))).rotate(m_ax, -m_yaw) + stem
    out['mirror_glass'] = Box(mw - 8, mh - 8, 2).moved(Location(tuple(fc - [0, 0, 0.6]))).rotate(m_ax, -m_yaw)     # its face, toward the cabin: bright in the dash render
    # ---- floor: carpet over the cabin floor, mats on it, pedals (brake outboard of the accelerator, x
    # measured in the dash render; their depth along the truck is a guess).
    out['carpet'] = (Box(2400, 12, c['cab_rear_s'] - 1170, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, c['floor'] + 0.5, Z(1170)))) & inner) - well
    mats = [XS([(140, 1330), (640, 1330), (690, 1420), (690, 2080), (140, 2080)], c['floor'] + 13, c['floor'] + 22),
            XS([(-140, 1330), (-640, 1330), (-690, 1420), (-690, 2080), (-140, 2080)], c['floor'] + 13, c['floor'] + 22),
            XS([(-690, 2690), (690, 2690), (690, 2700 + 300), (640, 3050), (-640, 3050), (-690, 3000)], c['floor'] + 13, c['floor'] + 22)]
    out['mats'] = Compound(mats) - out['console']
    # Each mat's edge is bound with a smoother band, 25 wide and 2 proud (dgRcedIkNOM-25). Outlines: guess.
    def binding(pts):
        w = Wire.make_polygon([(x, 0, Z(s)) for x, s in pts], close=True)
        ring = Face(w) - Face(w.offset_2d(-25, kind=Kind.INTERSECTION))
        return extrude(ring.moved(Location((0, c['floor'] + 13, 0))), amount=11, dir=(0, 1, 0))
    outlines = [[(140, 1330), (640, 1330), (690, 1420), (690, 2080), (140, 2080)],
                [(-140, 1330), (-640, 1330), (-690, 1420), (-690, 2080), (-140, 2080)],
                [(-690, 2690), (690, 2690), (690, 3000), (640, 3050), (-640, 3050), (-690, 3000)]]
    out['mat_edges'] = Compound([binding(o) for o in outlines]) - out['console']
    # Between the footwells, ahead of the console: a panel of brushed aluminium ribs along the truck, black between
    # them, from the dash's lower edge down to the floor (dgRcedIkNOM-16, -25, int-athens-3). Measured through the
    # dash camera (CC015C4E, the ribs' ends showing above the console, measure/int/glove.md): top at 881 high,
    # 1,444 back, about +-125 across; six ribs (CC015C4E: five dark gaps). It slopes down to the floor ahead of the console's lower
    # front, reaching the floor at 1,640, then along the floor under the console's front (1,614 at the rim, its
    # foot 1,680). Rib height, the ramp's slope and its foot: guess.
    fl = c['floor'] + 12.5
    P0, P1, P2 = np.array([1444.0, 884.0]), np.array([1640.0, fl]), np.array([1780.0, fl])
    d = (P1 - P0) / np.linalg.norm(P1 - P0)
    nr = np.array([-d[1], d[0]])                          # off the ramp, back and up
    if nr[0] < 0:
        nr = -nr
    def offset_profile(t):
        """The ramp-then-floor line moved t off its face; the corner where the two offset lines meet."""
        a = P0 + nr * t
        hh = fl + t
        corner = a + d * ((hh - a[1]) / d[1])
        return [tuple(a), tuple(corner), (P2[0], hh)]
    base_line, rib_line = offset_profile(0.0), offset_profile(10.0)
    back = offset_profile(-8.0)
    out['center_rib_base'] = SH(base_line + back[::-1], -125, 125)
    pitch, rw = 250.0 / 6, 28.0
    ribs = [SH(rib_line + base_line[::-1], xc - rw / 2, xc + rw / 2) for xc in (-pitch * 2.5 + k * pitch for k in range(6))]
    out['center_ribs'] = Compound(ribs)
    # Shapes from the manual's cabin render (CC015C4E, 14 and 15): sizes from the pads' widths against their
    # 170 mm spacing (47 px, 3.6 mm/px). The brake is a hanging pedal, a rounded aluminium pad 130 wide with
    # eight black rubber strips running up it, on a thin arm rising inboard into the dash. The accelerator is
    # floor-hinged, 50 wide with a rounded top and four strips down its upper two thirds.
    def pad(w, h, t, r, n, gw, top, bot):
        """A pad facing the driver (-z) in its own frame, centred; n strips gw wide, from top to bot below its top."""
        body = Box(w, h, t)
        body = fillet(body.edges().filter_by(Axis.Z), r)
        pitch = (w - 2 * 10) / n
        strips = [Box(gw, h - top - bot, 2).moved(Location((-w / 2 + 10 + pitch * (i + 0.5), (bot - top) / 2, -t / 2 - 0.6)))
                  for i in range(n)]
        return body, strips
    bp, bg = pad(130, 80, 14, 9, 8, 7, 9, 9)
    ap, ag = pad(50, 220, 12, 14, 4, 5, 14, 80)
    # Along the truck they're placed by the published front leg room (L34: ankle to H-point + 254 = 1,043.6),
    # with the heel on the mat against the accelerator's hinge block and the ankle 95 above it
    # (measure/cabin/audit.py): 58 behind where they were guessed. The brake 40 behind the accelerator.
    sa = c['pedal_s']
    bloc = Location((460, c['floor'] + 150, Z(sa + 40)))
    aloc = Location((290, c['floor'] + 100, Z(sa)))
    out['pedals'] = Compound([bp.rotate(Axis.X, 35).moved(bloc), ap.rotate(Axis.X, 40).moved(aloc)])
    out['pedal_grips'] = Compound([g.rotate(Axis.X, 35).moved(bloc) for g in bg] + [g.rotate(Axis.X, 40).moved(aloc) for g in ag])
    # the brake arm, from the pad's back near its inboard edge up and forward into the dash; the accelerator's
    # hinge block on the floor at its foot
    r35 = math.radians(35)
    a0 = (420, c['floor'] + 150 + 30 * math.cos(r35) - 7 * math.sin(r35), Z(sa + 40) + 30 * math.sin(r35) + 7 * math.cos(r35))
    out['pedal_arms'] = Compound([
        rod(a0, (395, c['floor'] + 470, Z(1210)), (0, 0, 1), 18, 8),
        Box(56, 22, 40).moved(Location((290, c['floor'] + 11, Z(sa) - 110 * math.sin(math.radians(40)) + 6)))])
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
    out = {'pillars': [], 'marker_red': []}
    # The lower lamp strip: smoked lens in the gap between the bumper top and the steel's lower edge, across
    # the front and round each corner to the flare, its outer ends amber (c059, c085, c147).
    nfh, fr = p['nose_flat_half'], p['face_rake']
    xs, y0 = BW + 4, p['bumper_f_h'] + 0.3
    plan = [(-xs, ZF - 340), (xs, ZF - 340), (xs, ZF - p['corner_s'] - fr - 8), (nfh - 4, ZF - fr - 4), (-nfh + 4, ZF - fr - 4), (-xs, ZF - p['corner_s'] - fr - 8)]
    w = Wire.make_polygon([(x, y0, z) for x, z in plan], close=True)
    strip = extrude(Face(w), amount=p['lamp_h_centre'] - 0.6, dir=(0, 1, 0)) & below_steel(p, ZF - 1500, ZF + 100, drop=0.3)
    ends = both_sides(Box(400, 200, 800, align=(Align.MIN, Align.CENTER, Align.MAX)).moved(Location((BW - 75, y0 + 50, ZF - fr + 50))))
    # The headlamps (c150, c147, c085, c001): one lens from lamp_head's inner end round the crease to the amber
    # end. Under the corner facet it is clear over a silver reflector; on the centre face a row of projector
    # cells sits behind it. Between the two headlamps the strip is smoked black.
    centre = Box(2 * nfh, 400, 800, align=(Align.CENTER, Align.MIN, Align.MAX)).moved(Location((0, y0 - 50, ZF + 100)))
    head = (strip - ends) - centre
    lip = Box(2400, 10, 1500, align=(Align.CENTER, Align.MAX, Align.MAX)).moved(Location((0, y0 + 10, ZF + 100)))
    out['lamp_lower'] = [(strip - ends) & centre, head & lip]     # the headlamp's lower edge is a dark lip (c147)
    out['lamp_head'] = [head - lip]
    h0, h1 = BUMPER_F['lamp_head']
    n, gap = BUMPER_F['lamp_cells'], 6.0
    cw = (h1 - h0 - (n + 1) * gap) / n
    cells = []
    for sx in (1, -1):
        for k in range(n):
            xa = h0 + gap + k * (cw + gap)
            cells.append(Box(cw, p['lamp_h_centre'] - 26, 1.0, align=(Align.MIN if sx > 0 else Align.MAX, Align.MIN, Align.MIN)).moved(
                Location((sx * xa, y0 + 10, ZF - fr - 4 - 0.4))))
    out['lamp_cells'] = cells
    # The windshield's black frit: an opaque band printed on the glass's inner face, so the A-pillar and dash
    # trim don't show through at its edges (c134). Measured on c134 against the glass's 1,581 mm bottom
    # width and 1,472 mm slant: about 75 wide down the sides, 65 along the cowl, 280 under the roof edge.
    # The bowed bottom and smaller corner cutoffs now follow Tesla's service drawing (GUID-CAFA82BC),
    # scaled to this pane: 250 along the bottom, 110 up the side (the former 380 was too broad).
    ws, wn = panels(p)['windshield'][:2]
    clear = windshield_clear(p)
    # Inside the glass (its outer face 1 mm under the facet, its inner face 7.8 mm under): a 0.6 mm layer
    # near the inner face, so the tinted glass lies over it seen from outside.
    out['frit'] = [prism(inset_polygon(ws, wn, 0.6), wn, out=-6.8, depth=7.4) - prism(clear, wn, out=-6.0, depth=9.0)]
    amber = strip & ends                                    # one per side, so each turn signal blinks alone
    half = Box(2000, 2000, 8000, align=(Align.MIN, Align.CENTER, Align.CENTER))
    out['marker_amber_l'] = [amber & half]
    out['marker_amber_r'] = [amber & half.mirror(Plane.YZ)]
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

def door_regions(p, glass=True):
    """{door: (region solid, hinge point)} for fl, rl, fr, rr. A door is everything between its seams that is
    below the beltline: its skin, trim, armrest and handle; with glass, also what's below the roof and deck
    (minus the glass pockets' depth) outboard of the side window's plane: its window, which is frameless
    (it drops a little as the door opens), so the steel above the belt (the pocket's lip under the roof
    edge) stays on the body and nothing hangs over the door with its window down. Never the roof."""
    pl = planes(p)
    BW = body_w(p)
    c = CAB
    x_in = BW - c['wall'] - c['trim_t'] - 100
    out = {}
    for d, (s0, s1) in door_spans(p).items():
        poly = [(ZF - s0, 480.0), (ZF - s1, 480.0), (ZF - s1, 2100.0), (ZF - s0, 2100.0)]
        prism_l = side_prism(poly, x_in, 1300)
        # the front door's window reaches forward past its seam to the glass's tip, over the fender
        # the front door's glass starts at the window edge: the glass triangle ahead of it stays on the body (c166)
        ga = WINDOW_EDGE['s_front'] + WINDOW_EDGE['width'] if d == 'f' else s0
        prism_a = side_prism([(ZF - ga, 480.0), (ZF - s1, 480.0), (ZF - s1, 2100.0), (ZF - ga, 2100.0)], x_in, 1300)
        a = halfspace_cut(prism_a, pl['roof'][0] - pl['roof'][1] * 12, pl['roof'][1])
        a = halfspace_cut(a, pl['deck'][0] - pl['deck'][1] * 12, pl['deck'][1])
        wp, wn = pl['window_l']
        a = halfspace_cut(a, wp - wn * 120, -wn)
        belt = plane3(V(BW, p['belt_h_front'], p['a_pillar_s']), V(BW, p['belt_h_rear'], p['c_pillar_s']), V(0, p['belt_h_front'], p['a_pillar_s']))
        if belt[1][1] < 0:
            belt = (belt[0], -belt[1])
        # The steel's own top is the side glass's bottom edge (belt + 12), so no sliver of it stays on the body.
        b = halfspace_cut(prism_l, belt[0] + belt[1] * (2 if glass else 13), belt[1])
        region = a + b if glass else b
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

# ---------------------------------------------------------------- the cargo bed and the powered tonneau

def deck_h(p, s):
    return on_plane(planes(p)['deck'], x=0, z=Z(s))[1]

def bed_floor(p):
    return p['tail_h'] - BED['floor_below_tail']

def bed_outline(p, t=0.0):
    """The bed's side outline in (z, h), moved in by t: the floor, the tailgate's inside, the canister's
    vertical rear face and the sloped wall under it, open far above the deck."""
    b, f = BED, bed_floor(p)
    pts = [(b['front_s'], f), (b['tailgate_s'], f), (b['tailgate_s'], 2100.0), (b['canister_s'], 2100.0), (b['canister_s'], b['canister_h'])]
    q = inset_polygon([np.array([0.0, h, Z(s)]) for s, h in pts], np.array([1.0, 0, 0]), [t, t, -50, t, t])
    return [(v[2], v[1]) for v in q]

def bed_humps(p, grow=0.0):
    """The wheel-well humps standing in from each side wall, grown by `grow` (the liner's thickness)."""
    b = BED
    s0, s1, s2, s3 = b['hump']
    f, top = bed_floor(p), b['hump_h']
    k = (s1 - s0) / (top - f)                        # the sloped ends, run per rise
    lo = f - 120
    pts = [np.array([0.0, h, Z(s)]) for s, h in ((s0 - (f - lo) * k, lo), (s1, top), (s2, top), (s3 + (f - lo) * k, lo))]
    q = inset_polygon(pts, np.array([1.0, 0, 0]), [-grow, -grow, -grow, 0])
    poly = [(v[2], v[1]) for v in q]
    return both_sides(side_prism(poly, b['floor_half'] - grow, b['half'] + 50))

def bed_cavity(p, t=0.0):
    """The bed's volume, moved in by t from its walls."""
    b = BED
    return side_prism(bed_outline(p, t), -(b['half'] - t), b['half'] - t) - bed_humps(p, grow=t)

def bed_liner(p):
    """The dark moulded liner on every inside face of the bed, 4 mm thick and 0.1 mm off the steel, up to
    just under the tonneau's rails."""
    return (bed_cavity(p, 0.1) - bed_cavity(p, 4.0)) & hull(p, inset=14.3)

def bed_lights(p):
    """The LED strips along the top of each side wall (manual, Cargo Bed, item 2), parallel to the deck."""
    b = BED
    s0, s1 = b['canister_s'] + 70, b['tailgate_s'] - 60
    x1 = b['half'] - 4.0
    def strip(sx):
        poly = [(Z(s), deck_h(p, s) - dy) for s in (s0, s1) for dy in (60, 78)]
        poly = [poly[0], poly[2], poly[3], poly[1]]
        return side_prism(poly, sx * x1 - (6 if sx > 0 else 0), sx * x1 + (0 if sx > 0 else 6))
    return strip(1) + strip(-1)

def tonneau_slats(p):
    """(slat, centres): one slat built round its own centre (across x, along z, thickness y), and the closed
    position of every slat's centre in (z, h), front first. The slats sit in the bay, 2 to 12 mm under the deck."""
    b = BED
    pl = planes(p)
    n = pl['deck'][1]
    s0, s1 = b['canister_s'] + 1, L - p['bumper_r_out'] - 25
    a, c = on_plane(pl['deck'], x=0, z=Z(s0)), on_plane(pl['deck'], x=0, z=Z(s1))
    run = np.linalg.norm(c - a)
    k = round(run / b['slat_pitch'])
    pitch = run / k
    d = (c - a) / run
    off = -n * (2 + b['slat_t'] / 2)
    centres = [(a + d * pitch * (i + 0.5) + off) for i in range(k)]
    slat = Box(2 * b['cover_half'], b['slat_t'], pitch - b['slat_gap'])
    return slat, [[q[2], q[1]] for q in centres], pitch

def tonneau_path(p, centres, pitch):
    """The track every slat's centre follows, from the rearmost slat's closed place forward under the
    canister lid, then round the coil inside the canister: [(z, h)] every 5 mm, with the arc length of each
    point. Opening by u mm moves every slat u mm along it."""
    b = BED
    rear = np.array(centres[-1]) + (np.array(centres[-1]) - np.array(centres[-2])) / 2      # behind the last slat
    hD = deck_h(p, b['coil_s']) - 2 - b['slat_t'] / 2
    D = np.array([Z(b['coil_s']), hD])
    pts = [rear]
    dist = np.linalg.norm(D - rear)
    for i in range(1, int(dist / 5) + 1):
        pts.append(rear + (D - rear) * (i * 5 / dist))
    C = D - [0, b['coil_r']]
    need = len(centres) * pitch + 200
    phi, run = 0.0, 0.0
    while run < need:                                    # an Archimedean spiral, winding inward
        r = b['coil_r'] - b['coil_step'] * phi / (2 * math.pi)
        phi += 5 / r
        r = b['coil_r'] - b['coil_step'] * phi / (2 * math.pi)
        pts.append(C + [r * math.sin(phi), r * math.cos(phi)])   # forward (+z) and down: the coil's front side first
        run += 5
    arc = [0.0]
    for i in range(1, len(pts)):
        arc.append(arc[-1] + float(np.linalg.norm(pts[i] - pts[i - 1])))
    return [[float(q[0]), float(q[1])] for q in pts], arc

def tonneau_switch(p):
    """The exterior cargo bed switch (manual, Cargo Bed, item 3 and "Accessing the Cargo Bed"): a black pad on
    the left sail by the tail light with three keys in a row, front to back: tonneau open, tonneau close,
    tailgate. {name: solid}."""
    pl = planes(p)
    sail = pl['sail_l']
    n = sail[1]
    s_c = L - p['bumper_r_out'] - 150
    e0, e1 = edge_point(pl['deck'], sail, Z(s_c + 100)), edge_point(pl['deck'], sail, Z(s_c - 100))
    u = (e0 - e1) / np.linalg.norm(e0 - e1)              # along the sail's top edge, forward
    v = np.cross(n, u)                                   # in the face, perpendicular to the edge
    if v[1] > 0:
        v = -v                                           # down the face
    edge = edge_point(pl['deck'], sail, Z(s_c))
    ctr = edge + v * 48
    def quad(c, hu, hv):
        q = [c + u * hu * a + v * hv * b for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        return q if np.dot(np.cross(q[1] - q[0], q[2] - q[0]), n) > 0 else q[::-1]
    out = {'tonneau_switch': prism(quad(ctr, 78, 26), n, out=1.5, depth=1)}
    for i, name in enumerate(('btn_tonneau_open', 'btn_tonneau_close', 'btn_tailgate')):
        out[name] = prism(quad(ctr + u * (48 - 48 * i), 21, 18), n, out=3.0, depth=1.0)
    return out

def gate_hinge(p):
    """The tailgate's hinge line (along x): on its outer face, 58 mm (its thickness) under the floor
    liner's top, so that turned down 90 degrees its inside lies level with the floor (c056)."""
    LT = L - p['bumper_r_out']
    return np.array([0.0, bed_floor(p) + 4.3 - (LT - BED['tailgate_s']), Z(LT)])

def gate_region(p):
    """Everything that drops with the tailgate: the steel panel and the light band's middle."""
    b = BED
    LT = L - p['bumper_r_out']
    lo = SH([(b['tailgate_s'], b['gate_bottom']), (LT + 5, b['gate_bottom']), (LT + 5, b['band_h']), (b['tailgate_s'], b['band_h'])], -b['gate_half'], b['gate_half'])
    hi = SH([(b['tailgate_s'], b['band_h']), (LT + 5, b['band_h']), (LT + 5, 2000.0), (b['tailgate_s'], 2000.0)], -b['band_half'], b['band_half'])
    return lo + hi

def gate_liner_region(p):
    """The liner's face on the tailgate: inside its edges, above the floor liner."""
    b = BED
    return SH([(b['tailgate_s'] - 6, bed_floor(p) + 4.5), (b['tailgate_s'] + 1, bed_floor(p) + 4.5), (b['tailgate_s'] + 1, 2000.0), (b['tailgate_s'] - 6, 2000.0)], -b['half'] + 4.5, b['half'] - 4.5)

def pillar_backs(p):
    """The pillars' rear faces behind the tailgate, black (c056, the manual's bed render), with a red light
    near the top of each, under the band's corner block. Just inside the gate while it's shut."""
    b = BED
    s0 = b['tailgate_s'] + 0.3
    out = {'black': [], 'red': []}
    for sx in (1, -1):
        def box(x0, x1, h0, h1, t=1.0):
            return SH([(s0, h0), (s0 + t, h0), (s0 + t, h1), (s0, h1)], min(sx * x0, sx * x1), max(sx * x0, sx * x1))
        out['black'].append(box(b['half'] + 0.5, b['gate_half'] - 0.5, b['gate_bottom'] + 0.5, b['band_h'] - 0.5))
        out['black'].append(box(b['half'] + 0.5, b['band_half'] - 0.5, b['band_h'] - 0.5, deck_h(p, s0) - 20))
        out['red'].append(box(b['half'] + 30, b['gate_half'] - 30, b['band_h'] - 70, b['band_h'] - 40, t=2.0))
    return {k: Compound(v) for k, v in out.items()}

def strut_anchors(p):
    """Each tailgate strut, from the pillar's rear face high up to the gate's inside near its hinge (c056)."""
    b = BED
    out = {}
    for side, sx in (('l', 1), ('r', -1)):
        out[side] = {'body': [sx * 905.0, 1110.0, Z(b['tailgate_s'] + 2)], 'gate': [sx * 905.0, gate_hinge(p)[1] + 120.0, Z(b['tailgate_s'] + 6)]}
    return out

def tub_parts(p):
    """(cavity, liner, plug): the under-bed compartment cut out of the body and bumper, its 4 mm liner and the
    drain plug in its floor (manual: turn it and pull it up)."""
    s0, s1, hw, bot = BED['tub']
    top = bed_floor(p) + 1
    cav = SH([(s0, bot), (s1, bot), (s1, top), (s0, top)], -hw, hw)
    inner = SH([(s0 + 4, bot + 4), (s1 - 4, bot + 4), (s1 - 4, top + 10), (s0 + 4, top + 10)], -hw + 4, hw - 4)
    liner = SH([(s0 + 0.1, bot + 0.1), (s1 - 0.1, bot + 0.1), (s1 - 0.1, top - 1.2), (s0 + 0.1, top - 1.2)], -hw + 0.1, hw - 0.1) - inner
    plug = Cylinder(22, 8, rotation=(90, 0, 0)).moved(Location((0, bot + 4 + 3, Z((s0 + s1) / 2))))
    return cav, liner, plug

def lid_parts(p):
    """(lid region in the floor liner, the lid's own under-panel, its handle): the lid is the liner's floor
    there, on a 20 mm panel, with a dark grip at its back edge."""
    s0, s1, hw = BED['lid']
    f = bed_floor(p)
    region = SH([(s0, f - 1), (s1, f - 1), (s1, f + 10), (s0, f + 10)], -hw, hw)
    gap = SH([(s0 - 2, f - 1), (s1 + 2, f - 1), (s1 + 2, f + 10), (s0 - 2, f + 10)], -hw - 2, hw + 2)
    under = SH([(s0, f - 20), (s1, f - 20), (s1, f + 0.05), (s0, f + 0.05)], -hw, hw)
    grip = SH([(s1 - 40, f + 4.1), (s1 - 12, f + 4.1), (s1 - 12, f + 7), (s1 - 40, f + 7)], -70, 70)
    return region, gap, under, grip

def outlet_parts(p):
    """(pocket, plate, cover): on the left wall, a pocket 12 mm deep through the liner, the outlet plate at
    its bottom (its face drawn in textures.py) and the cover over it, flush with the liner."""
    s0, s1, h0, h1 = BED['outlets']
    x_face = BED['half'] - 4                          # the liner's inside face; the wall is outboard (+x)
    pocket = SH([(s0, h0), (s1, h0), (s1, h1), (s0, h1)], x_face - 0.5, BED['half'] + 8)
    plate = SH([(s0 + 0.5, h0 + 0.5), (s1 - 0.5, h0 + 0.5), (s1 - 0.5, h1 - 0.5), (s0 + 0.5, h1 - 0.5)], BED['half'] + 6, BED['half'] + 7.5)
    cover = SH([(s0 + 1, h0 + 1), (s1 - 1, h0 + 1), (s1 - 1, h1 - 1), (s0 + 1, h1 - 1)], x_face + 0.2, BED['half'])
    return pocket, plate, cover

def tiedowns(p):
    """The four tie-down anchors, one at each bottom corner of the bed (manual, Securing Cargo): a pocketed
    plate on each side wall at the floor with a folded ring."""
    f = bed_floor(p)
    out = []
    for s in (BED['front_s'] + 80, BED['tailgate_s'] - 70):
        for sx in (1, -1):
            x = sx * (BED['half'] - 4)
            plate = SH([(s - 35, f + 8), (s + 35, f + 8), (s + 35, f + 60), (s - 35, f + 60)], min(x, x - sx * 6), max(x, x - sx * 6))
            ring = SH([(s - 22, f + 14), (s + 22, f + 14), (s + 22, f + 22), (s - 22, f + 22)], min(x - sx * 6, x - sx * 16), max(x - sx * 6, x - sx * 16))
            out += [plate, ring]
    return Compound(out)

def release(p):
    """The tailgate's emergency release (manual: a flip-up cover over a pull strap), on its inside, low and
    toward the left (the manual's bed render, item 6)."""
    z = Z(BED['tailgate_s'] - 4)
    f = bed_floor(p)
    return Box(70, 45, 6).moved(Location((440.0, f + 90, z + 3)))

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

    body = body - cavity(p) - pillar_carve(p)
    for h in through_holes(p):
        body = body - h

    groups = {'glass': [], 'tonneau': [], 'bay': [], 'light_w': [], 'band': []}
    for name, (pts, n, depth, inset, kind) in panels(p).items():
        body, panel = recess(body, inner if inset == 1.0 else hull(p, inset=inset), pts, n, depth)
        if name == 'windshield':
            save(panel, 'windshield_glass')
        elif name == 'rear_glass':                  # the glass roof: its own tint (assemble.py GLASS_VLT)
            save(panel, 'roof_glass')
        else:
            groups[kind].append(panel)
    # The plate pocket runs up under the tailgate: the plate's top (657) stands above the bumper's (c069, c006).
    zt, ph, pd = ZR + p['bumper_r_out'], REAR['pocket_half'], REAR['pocket_depth']
    body = body - Box(2 * ph, BED['gate_bottom'] - 2 - (p['bumper_r_h'] - 10), ZR + pd - zt + 2, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, p['bumper_r_h'] - 10, zt - 1)))

    # The bed, under the tonneau's bay: its liner, lights, the slats' tracks along the bay's edges (on the
    # pocket floor, under the slats), the slats and the path they run on, and the switch on the left sail.
    body = body - bed_cavity(p)
    tub_cav, tub_liner, plug = tub_parts(p)
    lid_region, lid_gap, lid_under, lid_grip = lid_parts(p)
    pocket, outlet_plate, outlet_cover = outlet_parts(p)
    body = body - tub_cav - pocket
    liner = bed_liner(p) - pocket
    lid_liner = liner & lid_region
    liner = liner - lid_gap
    save(tub_liner, 'bed_tub', tolerance=1.0, angular=0.5)
    save(plug, 'bed_plug', tolerance=1.0, angular=0.5)
    save(lid_liner, 'lid_liner'); save(lid_under, 'lid_under'); save(lid_grip, 'lid_grip')
    save(outlet_plate, 'outlet_plate'); save(outlet_cover, 'outlet_cover')
    save(tiedowns(p), 'bed_tiedowns')
    for k, part in pillar_backs(p).items():
        save(part, f'pillar_{k}')
    save(bed_lights(p), 'bed_lights')
    # The tailgate: the steel, the liner on its inside, the band's middle and the rails' ends over it drop with it.
    def cut(part, region):
        piece = part & region
        return part - region, piece
    gate = gate_region(p)
    body, gate_steel = cut(body, gate)
    liner, gate_liner = cut(liner, gate_liner_region(p))
    save(liner, 'bed_liner', tolerance=1.0, angular=0.5)
    save(gate_steel, 'gate_steel', tolerance=0.5, angular=0.5)
    save(gate_liner, 'gate_liner', tolerance=1.0, angular=0.5)
    save(release(p), 'gate_release')
    deck = planes(p)['deck']
    s_can, s_end = BED['canister_s'], L - p['bumper_r_out'] - 25
    for sx in (1, -1):
        x0, x1 = BED['half'] - 0.5, BED['cover_half'] + 0.5
        pts = [on_plane(deck, x=sx * x, z=Z(s)) for x, s in ((x0, s_can), (x1, s_can), (x1, s_end), (x0, s_end))]
        groups['tonneau'].append(prism(pts, deck[1], out=-12.6, depth=13.9))
    slat, centres, pitch = tonneau_slats(p)
    save(slat, 'slat')
    path, arc = tonneau_path(p, centres, pitch)
    for name, part in tonneau_switch(p).items():
        save(part, f'det_{name}')

    regions = door_regions(p)
    body, door_steel = split_doors(body, door_regions(p, glass=False))
    glass, door_glass = split_doors(Compound(groups['glass']), regions)
    for k, piece in door_steel.items():
        save(piece, f'door_{k}_steel', tolerance=0.5, angular=0.5)
    for k, piece in door_glass.items():
        save(piece, f'door_{k}_glass')
    save(body, 'body', tolerance=0.5, angular=0.5)
    # The glass triangles ahead of the window edge stay on the body but are the front side windows' glass
    # (assemble.py tints them as such); the rest of the body's glass is the black B-pillar glass.
    ahead = Box(2400, 3000, 4000, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, 0, ZF - WINDOW_EDGE['s_front'] - WINDOW_EDGE['width'])))
    save(glass & ahead, 'quarter_glass')
    save(glass - ahead, 'glass')
    ton_rest, ton_gate = cut(Compound(groups['tonneau']), gate)
    save(ton_rest, 'tonneau')
    if ton_gate is not None and ton_gate.volume > 1:
        save(ton_gate, 'gate_tonneau')
    save(Compound(groups['light_w']), 'light_front')
    band_rest, band_gate = cut(Compound(groups['band']), gate)
    save(band_rest, 'rear_band')
    save(band_gate, 'gate_band')
    for name, part in rear_lights(p).items():           # gate_*: on the tailgate's band, they drop with it
        save(part, name)
    save(Compound([c - tub_cav for c in cladding(p)]), 'cladding', tolerance=1.0, angular=0.5)
    cp = cladding_parts(p)
    save(cp['bumper_f_intake'], 'intake_back')
    save(cp['bumper_f_grille'], 'intake_grille')
    save(Compound(cp['bumper_f_tow']), 'tow_covers')
    save(cp['bumper_f_camera'], 'front_camera', tolerance=0.3, angular=0.3)
    save(cp['bumper_f_lens'], 'front_camera_lens', tolerance=0.3, angular=0.3)
    save(cp['rear_hitch'], 'rear_hitch')
    save(cp['rear_reverse'], 'light_reverse')
    save(cp['rear_plate'], 'rear_plate', tolerance=0.3, angular=0.3)
    save(cp['front_plate'], 'front_plate', tolerance=0.3, angular=0.3)
    mirrors_rest, mirror_pieces = split_doors(both_sides(mirror_part(p)), regions)     # the mirrors ride on the front doors
    # Two-tone, as on the truck (c003, dgRcedIkNOM-04): a satin grey cap over the black base and arm, split at
    # the base's top.
    cap_zone = Box(6000, 1000, 8000, align=(Align.CENTER, Align.MIN, Align.CENTER)).moved(Location((0, mirror_frame(p)['yb'], 0)))
    for k, piece in mirror_pieces.items():
        save(piece - cap_zone, f'door_{k}_mirror')
        save(piece & cap_zone, f'door_{k}_mirrorcap')
    _, glass_pieces = split_doors(both_sides(mirror_glass_part(p)), regions)
    for k, piece in glass_pieces.items():
        save(piece, f'door_{k}_mirrorglass')
    if mirrors_rest is not None and mirrors_rest.volume > 1:
        save(mirrors_rest, 'mirrors')
    wiper_housing, wiper_arm = wiper(p)
    save(wiper_housing, 'wiper')
    save(wiper_arm, 'wiper_blade')
    for name, part in interior(p).items():
        if part is None or part.volume < 1:
            continue
        if name.startswith('door_'):                     # door_<k>_<part>: rides on door k
            front_white = name in ('door_fl_trim_white', 'door_fr_trim_white')
            save(part, f'door_{name[5:7]}_int_{name[8:]}', tolerance=1.0 if front_white else 2.5, angular=0.25 if front_white else 0.7)
        else:
            fine = name in ('seats_front', 'seats_rear')       # their padded crowns are shallow curves: 4.6 degrees a facet
            small = name.startswith(('yoke', 'pedal')) and name != 'yoke_column'     # held close: its curves and small round parts need fine facets
            save(part, f'int_{name}', tolerance=0.8 if small else 1.0 if fine else 2.5, angular=0.35 if small else 0.18 if fine else 0.7)     # flat facets; coarse tessellation keeps the few round parts cheap
    for name, part in details(p).items():
        save(part, f'det_{name}')

    # Wheels: one set of meshes, built for the left side around its own centre.
    save(tyre(), 'tyre', tolerance=1.2, angular=0.22)
    rim_body, lugs = rim()
    save(rim_body, 'rim', tolerance=1.5, angular=0.35)
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
        'facetPlanes': {k: [pt.tolist(), n.tolist()] for k, (pt, n) in planes(p).items()},
        'cowlZ': ZF - p['cowl_s'],
        'seatEyes': seat_eyes(p),
        'screens': screens(p),
        'wiper': dict(zip(('pivot', 'axis', 'sweepDeg'), (lambda q: (q[0].tolist(), q[1].tolist(), q[2]))(wiper_pivot(p)))),
        'decals': {n: yoke_decal() for n in ['yoke_pods'] + [f'yoke_btn_{k}' for k in YOKE_KEYS]},
        'doors': {k: {'hinge': h.tolist(), 'openDeg': -65 if k.endswith('l') else 65} for k, (_, h) in regions.items()},
        'hinges': {
            'tailgate': {'hinge': gate_hinge(p).tolist(), 'axis': [1, 0, 0], 'openDeg': -90},
            'bedlid': {'hinge': [0.0, bed_floor(p) + 4.3, Z(BED['lid'][0])], 'axis': [1, 0, 0], 'openDeg': 80},
            'outlet_cover': {'hinge': [BED['half'] - 3.8, (BED['outlets'][2] + BED['outlets'][3]) / 2, Z(BED['outlets'][0] + 1)], 'axis': [0, 1, 0], 'openDeg': 100},
        },
        'struts': strut_anchors(p),
        'tonneau': {'slats': centres, 'path': path, 'arc': arc, 'travel': len(centres) * pitch,
                    'closedArc': [float(np.linalg.norm(np.array(c) - np.array(path[0]))) for c in centres]},
    }
    (OUT / 'geometry.json').write_text(json.dumps(geo, indent=1))
    print('cad: wrote', sorted(q.name for q in OUT.glob('*.stl')))
