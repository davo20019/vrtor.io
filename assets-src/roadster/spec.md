# Tesla Roadster (second generation), as revealed on 15 October 2026

The production-intent car Tesla showed in Waco on 15 October 2026, in its **Performance** form (the road car: two
seats, no thrusters, active wing stowed), Ano White paint, Gold Glazed glass, the six-double-spoke wheels on
Pirelli P Zero Trofeo RS "Elect" tyres. Frame and units: millimetres, front facing +z, up +y, +x the car's left,
origin on the ground midway between the axles.

A test of the building-3d-replicas skill on an object with **no published dimensions**. If it becomes a vrtor
subject, the GLB is our own geometry and colours only: nothing from refs/ is shipped, and the T badge on the
wheel caps, the ROADSTER wordmarks and the plate's lettering are left out. Published as vrtor.io/rds (apps/rds) on 16 October 2026; refs/ stays in the repo only.

## Scale: the licence plate

Tesla has published no length, width, height, wheelbase or tyre size (Tesla North, Engadget, Basenor, the
reservation page on tesla.cn, and tesla.com/roadster itself: none). The tyre sidewalls carry the model
(P Zero Trofeo RS, Elect, "T0", treadwear 180, traction AA) but the size moulding is too small in every photo.

The only object of known size in the photos is the rear licence plate: a US plate, 12 x 6 in (304.8 x 152.4 mm),
with the standard embossed blank's rounded corners and lettering height (the "RDSTR" letters are 0.43 of the
plate's height, as on a standard plate). Its aspect in the photos is 2.07 to 2.11 (tilted back a little). The
plate is a landmark in two photos (q34, rear_high); every other size is a ratio to it, through the fit.

First read, before fitting (side view in px, scaled to the plate through the top view's width-to-length ratio):

| What | First read | Source |
|---|---|---|
| Length | 4,600 | side view 1,955 px; top view 1,310 px; scaled by the width |
| Width (rear hips) | 2,000 | top view 569 px; rear view: tyre outer faces 1,917 mm apart at the plate's depth (further, so more) |
| Width (front fenders) | 1,958 | top view 557 px |
| Width (doors) | 1,906 | top view 542 px (narrowest, between the arches) |
| Height | 1,230 | side view, roof peak 25% of the wheelbase behind the middle |
| Wheelbase | 2,960 | side view, hub to hub 1,256 px |
| Front overhang / rear overhang | 890 / 740 | side view |
| Tyres | ~760 front, ~790 rear across | side view (rear reads larger: staggered sizes, or perspective; fitted) |
| Rear tread | ~335 wide | rear view, 360 px at the plate's 0.917 mm/px, the tyres a little further away |
| Track | ~1,700 | rear view, tyre centres 1,732 px apart at the plate's depth |

These are the inputs; the fitted values (length 4,580, width 1,984, height 1,186 +-20, wheelbase 2,965) and how
well the photos measure them are in REPORT.md.

## Sections

The body is a loft through cross-sections (cad.py STATIONS), read from the views: half-widths from the top-down
drone shot (Roadster_92, from 30+ m up, near orthographic; the car cut out by GrabCut, its width measured every
50 px), heights from the side view (ek-roadster-02, the top edge traced by brightness every 50 px; the white
body's lower edge by its strongest bright-to-dark step), feature heights from the front (ek-roadster-03), rear
(Roadster_91, 77) and the open-door shots. Each section names: underside (tucked 80 mm in), widest point,
shoulder crease, crest (fender top in front, beltline under the side glass, buttress top at the back), roof or
hood edge, top centre. Resampled every 120 mm (ruled lofts between far-apart sections twist and tessellate
differently for the body and the glass on it).

## Structure

- **Body:** one shell, Ano White. Hood: a flat centre panel (the frunk lid, with a transverse seam), fender tops
  as flat facets rising to a crest above the hood, a small triangular facet at each front corner over the
  headlight (Roadster_74, 79). Nose: a short face that curves back to its corners in plan (top view), the light bar along its top edge from
  corner to corner (front three-quarter, Roadster-08-End).
- **Glass (gold):** windshield running into a glass roof; a fixed spine down the middle of the roof (Roadster_78,
  98: what stays when the doors are open); the doors' roof glass either side of it; side glass from the A-pillar
  to a point over the rear wheel; rear glass recessed between two buttresses (Roadster_77).
- **Doors:** dihedral doors that carry the side panel, the side glass and the roof glass on their side; they
  rise rear end first and swing out (Roadster_96, 98, 99). Shut lines traced on the side photo and back-projected
  through its solved camera. The hinge is not seen in any photo: cad.py hinge() is chosen to swing clear (REPORT.md).
- **Black:** carbon rocker under the doors (rising from 260 mm behind the front wheel to 420 before the rear one),
  the black lower nose and splitter, the rear corners below the tail light line, the diffuser with four
  thruster nozzles (bronze rings, 231 mm apart, 83 mm across) and four fan housings under them.
- **Lights:** front light bar along the nose; rear light bar across nearly the whole tail with a dark band under
  it; amber side markers ahead of the doors.
- **Wheels:** light grey aero disc with six dark double spokes standing proud, centre cap (badge left out);
  tyres with rounded shoulders.
- **Moving parts:** wheels (spin, front steer), doors (hinge). The active wing is not modelled yet.

## Glass and doors

Read from the top view (Roadster_92): windshield's lower edge 1,725 at the centre, 1,615 at the corners
(half width 740); at the sides it wraps down to the crest ahead of the A-pillar line, (z, h) = (803, 826) to
(349, 1,157), traced on the side photo and back-projected through its camera; the doors' roof glass from 560
back to -700, between the spine (half width 114, the two seams 65 px apart) and the roof edge; the rear glass
from -700 to its tip at -1,760; a 50 mm white rail outside the roof edge, then the side glass. Door shut lines
(side photo, back-projected): front 834 at the sill, 889 at the beltline, then up the A-pillar line to the roof;
rear -192 at the sill, -340 at the beltline, -700 at the roof. Sill top: 272 at 1,031 rising to 437 at -955.

## Unknowns (guessed, not sourced)

- Every size depends on the plate being a standard 12 x 6 in US plate.
- The door hinge's position and axis (no photo shows it; chosen so the door swings clear, REPORT.md).
- The tyre sizes (fitted from outlines the arches half hide), the rims' offset, the track (set flush with the body).
- The underside, the wheel wells, the interior (no photo shows the underside; the interior is not modelled).
- The active wing's shape and pivots.

## Budget

Vehicle: under 60k triangles, textures up to 2048 px, GLB under 3 MB after build.sh.
