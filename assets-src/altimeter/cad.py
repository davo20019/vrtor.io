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
    front_round=3.5,     # rounding of the front edge
    back_round=1.5,      # rounding of the back edge
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

def case_solid(p=P):
    """The case: a square block with flat corner facets, rounded front and back edges, a concave scoop
    down each strap side (x) with the webbing window in its floor, a dial pocket and a lens seat."""
    z0, z1 = p['scoop_back'], D - p['scoop_front']          # the scoop spans z0..z1 on each side
    half, d = (z1 - z0) / 2, p['scoop_depth']
    r = (half**2 + d**2) / (2 * d)                          # cylinder radius through both lips
    zc = (z0 + z1) / 2
    with BuildPart() as case:
        with BuildSketch():
            Rectangle(W, W)
        extrude(amount=D)
        chamfer(case.edges().filter_by(Axis.Z), length=p['corner'])
        fillet(case.edges().filter_by(Axis.Z), radius=p['corner_round'])
        fillet(case.faces().sort_by(Axis.Z)[-1].edges(), radius=p['front_round'])
        fillet(case.faces().sort_by(Axis.Z)[0].edges(), radius=p['back_round'])
        for sx in (1, -1):
            with Locations(Location((sx * (W / 2 + r - d), 0, zc), (90, 0, 0))):
                Cylinder(r, W + 2, mode=Mode.SUBTRACT)
        with Locations((0, 0, zc)):
            Box(W + 2, SLOT_W, SLOT_T, mode=Mode.SUBTRACT)
        with Locations((0, 0, D - LENS_T)):
            Cylinder(LENS_D / 2, LENS_T, align=(Align.CENTER, Align.CENTER, Align.MIN), mode=Mode.SUBTRACT)
        with Locations((0, 0, DIAL_Z)):
            Cylinder(DIAL_D / 2, D - LENS_T - DIAL_Z, align=(Align.CENTER, Align.CENTER, Align.MIN), mode=Mode.SUBTRACT)
    return case.part

if __name__ == '__main__':
    save(case_solid(), 'case')

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
