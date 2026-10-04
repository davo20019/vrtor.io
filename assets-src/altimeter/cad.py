"""Rigid parts of the altimeter, in millimetres, exported as STL to parts/.

Frame: dial faces +z, 12 o'clock is +y, origin at the centre of the case's back face.
Dimensions come from spec.md.
"""
from pathlib import Path
from build123d import *

OUT = Path(__file__).parent / 'parts'
OUT.mkdir(exist_ok=True)

import json

# Shape parameters of the case. Sourced sizes are fixed; the rest are fitted to the reference photos
# by fit.py, which writes params.json. Defaults are the hand-estimated first guesses.
P = dict(
    corner=7.5,          # chamfer across the four corner facets
    corner_round=2.0,    # rounding where the facets meet the sides
    back_round=1.5,      # rounding of the back edge
    roll=9.0,            # depth over which the front rolls in to the front face (angled photos, by eye)
    roll_in=2.0,         # how far the front face's flat sides sit inside the case's sides
    corner_front=15.0,   # the corner cut at the front face: larger than at the back, the corners dome
    corner_round_front=7.0,  # the rounding of the front face's corners
    scoop_depth=6.0,     # how far the concave strap-side scoops cut into each side
    scoop_front=7.0,     # front lip left between the scoop and the front face
    scoop_back=3.0,      # back lip left between the scoop and the back face
)
PARAMS = Path(__file__).parent / 'params.json'
if PARAMS.exists():
    P.update(json.loads(PARAMS.read_text()))

W, D = 63.5, 28.0                # case width/height, depth (manufacturer)
LENS_D, LENS_T = 58.0, 3.0       # screw-on lens
DIAL_D, DIAL_Z = 56.0, D - 6.0   # dial pocket and the dial's plane
SLOT_W, SLOT_T = 39.0, 3.5       # webbing window in each scoop, through the case

def save(part, name, tolerance=0.02, angular=0.15):
    """Tessellate to STL. Coarser tolerances for small or round parts keep the triangle budget."""
    export_stl(part, str(OUT / f'{name}.stl'), tolerance=tolerance, angular_tolerance=angular)

def section(z, inset, leg, rnd):
    """One cross-section of the case at height z: the square, inset all round, with its corners cut back
    by `leg` along each side and every vertex rounded. Every section has the same 8 sides and 8 arcs, so
    the loft through them is one smooth surface."""
    h = W / 2 - inset
    l = min(leg, h - 1)
    with BuildSketch(Plane.XY.offset(z)) as sk:
        Polygon((h - l, h), (h, h - l), (h, -(h - l)), (h - l, -h), (-(h - l), -h), (-h, -(h - l)),
                (-h, h - l), (-(h - l), h), align=None)
        fillet(sk.vertices(), radius=min(rnd, 1.6 * l))      # up to 1.6 l: the facet becomes one arc
    return sk.sketch

def case_solid(p=P):
    """The case: one loft from the back to the front. The back half keeps the fitted outline (flat corner
    facets with rounded junctions, what the front photo's outline measures); over the front `roll` mm it
    rolls in along a quarter ellipse, so the sides meet the front face tangentially and the corners grow
    rounder toward the front (the angled photos: a narrow front ring round the lens, a broad shoulder).
    Then a concave scoop down each strap side (x) with the webbing window in its floor, the dial pocket and
    the lens seat."""
    import math
    stations = [section(0, p['back_round'] * 0.4, p['corner'], p['corner_round']),
                section(p['back_round'], 0, p['corner'], p['corner_round'])]
    z_roll = D - p['roll']
    for deg in (0, 30, 50, 65, 78, 90):
        t = math.radians(deg)
        k = 1 - math.cos(t)                                    # 0 at the start of the roll, 1 at the front
        stations.append(section(z_roll + p['roll'] * math.sin(t), p['roll_in'] * k,
                                p['corner'] + (p['corner_front'] - p['corner']) * k,
                                p['corner_round'] + (p['corner_round_front'] - p['corner_round']) * k))
    body = loft(stations)

    z0, z1 = p['scoop_back'], D - p['scoop_front']          # the scoop spans z0..z1 on each side
    half, d = (z1 - z0) / 2, p['scoop_depth']
    r = (half**2 + d**2) / (2 * d)                          # cylinder radius through both lips
    zc = (z0 + z1) / 2
    for sx in (1, -1):
        body -= Cylinder(r, W + 2).moved(Location((sx * (W / 2 + r - d), 0, zc), (90, 0, 0)))
    body -= Box(W + 2, SLOT_W, SLOT_T).moved(Location((0, 0, zc)))
    body -= Cylinder(LENS_D / 2, LENS_T, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, D - LENS_T)))
    body -= Cylinder(DIAL_D / 2, D - LENS_T - DIAL_Z, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, DIAL_Z)))
    try:                                                    # soften the scoops' lips, as machined
        lips = [e for e in body.edges() if abs(abs(e.center().X) - (W / 2 - p['roll_in'] * 0)) < 4 and e.length > 20]
        body = fillet(lips, radius=0.8)
    except Exception:
        pass
    return body

if __name__ == '__main__':
    save(case_solid(), 'case', tolerance=0.04, angular=0.25)

    # Dial: a thin disc; its face gets the printed texture.
    dial = Cylinder(DIAL_D / 2 - 0.05, 0.5, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, DIAL_Z)))
    save(dial, 'dial')

    # Lens: clear disc with a slight dome, seated flush with the case front.
    TOP = D - 0.4                    # lens rim height, just below the case front
    r_cap, h_cap = 26.0, 0.8         # dome: a shallow spherical cap, 0.8 mm high over the inner 52 mm
    R = (r_cap**2 + h_cap**2) / (2 * h_cap)
    disc = Cylinder(LENS_D / 2 - 0.3, TOP - (D - LENS_T) - 0.1, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, D - LENS_T + 0.1)))
    cap = Sphere(R).moved(Location((0, 0, TOP + h_cap - R))) & Cylinder(r_cap, h_cap + 0.01, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, TOP - 0.005)))
    save(disc + cap, 'lens')

    # Needle, built pointing to 12 o'clock around the axis; the scene rotates the "needle" node about z.
    NZ = DIAL_Z + 0.7
    with BuildPart() as pointer:            # black pointer, tapering to the scale ring
        with BuildSketch(Plane.XY.offset(NZ)):
            Polygon((-1.05, 0), (1.05, 0), (0.8, 17.6), (-0.8, 17.6), align=None)
        extrude(amount=0.4)
    save(pointer.part, 'needle_pointer')

    with BuildPart() as tail:               # white counterweight tail and hub
        with BuildSketch(Plane.XY.offset(NZ)):
            with Locations((0, -7.3 + 1.5)):
                Circle(1.5)
            Polygon((-1.5, -5.8), (1.5, -5.8), (1.2, 0), (-1.2, 0), align=None)
            Circle(3.0)
        extrude(amount=0.6)
    save(tail.part, 'needle_tail', tolerance=0.05, angular=0.4)

    pin = Cylinder(0.45, 1.0, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, NZ + 0.6)))
    save(pin, 'needle_pin', tolerance=0.05, angular=0.6)

    # Finger loop: black rubber O-ring.
    oring = Torus(33.0 / 2 - 1.25, 1.25)
    save(oring, 'oring', tolerance=0.15, angular=0.5)

    print('cad: wrote', sorted(p.name for p in OUT.glob('*.stl')))
