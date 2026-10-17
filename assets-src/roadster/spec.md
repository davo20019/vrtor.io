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

Round 6 (16 October): the features the outline can't see are measured (measure/README.md, cad.py MEAS), from the press
photos and frames of the reveal stream (refs/video/).

- **Front** (cad.py front_section): the hood is one flat panel between two straight side seams, each from the light
  bar's end (the nose corner, 606 out, 481 up, 2,281 ahead of the axles' midpoint) to the windshield's base corner
  (472, 754, 1,582); the windshield's base runs straight across between those corners. Outboard of each seam a flat
  facet up to the fender ridge, which runs from the nose corner to the windshield's wrap corner (827, 797, 1,342): the
  facet is the plane through the three (front photo, front three-quarter and top views each see it as a triangle). Its
  lower point, below a line 0.47 of the way up, is the headlight (lit in the front photos, hidden in the others). Outboard
  of the ridge the fender rolls over to its widest point. The light bar is level and curves back in plan from the body's front
  at the centre to its ends; nothing stands ahead of the nose (side photo). Below the bar, between the white legs, the
  face is flat, carbon and black back to the end of the intake; the splitter is a lip 160 to 230 up under the bar's
  curve (side photo).
- **Rear deck** (cad.py rear_section): the rear glass is a shield between two narrow fins (crest 424 out, 30 over the
  glass edge): straight sides 372 out, tapering to its lower corners (259, 947, -1,920) at the stowed wing's seam.
  The side window's tail runs back between each fin and the haunch, to its point (545, 1,073, -1,137). Outboard the
  haunch is one plane from the fin down to the widest point (rear_high: evenly lit); the model's first build had a
  high deck out to 714 there, 130 mm too high.
- **Tail**: the gloss black light housing from the tail's top edge (the corner 848 out, 873 up) down to 770, the red
  bar 829 up to 834 out, a white trim line under it; the pale rear face below, inside 780, down to 670, the plate on
  its lower edge; black below that, and carbon on the corners behind the rear wheels, up to a line rising from the arch
  (560) to the housing, with a red reflector along it. The diffuser: a shelf, the nozzle panel (four, bronze rings),
  four open bays with a fan each, split by three strakes between end plates.
- **Doors**: scissor doors (the reveal, 18:55 to 19:10: the rear edge rises first about a pivot near the door's
  front, ending nearly vertical, leaning out a little), carrying the side panel, the side glass and their half of the
  roof glass. Open 80 degrees about cad.py hinge()'s axis; the hinge itself is not seen. The photo's front shut line
  leans forward from 846 at the sill to 947 at the shoulder crease (round 6, side photo); the model's runs straight up
  from the A-pillar's foot, 55 to 150 mm behind it, because with any hinge that stands the door as in the reveal the
  door's front below the crease lifts into the fender over it (tried in round 6: 160 hinges near the A-pillar's foot
  swing clear only with the door floating above the roof when open). The real hinge must swing the door's front out
  first; a video of the door from the front would show how.
- **Side trim**: a black strip under the shoulder crease from the front arch to the door, the amber marker a wedge
  in its front half (side photo, measured through its camera).
- **Active wing**: the deck panel from the seam to the tail's top edge is the wing (top view: one seam straight across;
  rear_high: it runs out to the body's edges). Raised on two swan-neck struts in the reveal (19:38 to 19:40); the
  struts' path is not published, so one turn stands in for it (cad.py wing_hinge(): 30 degrees about a cross axis at
  the deck's height 550 ahead of the seam, the trailing edge highest).
- **Wheels**: six spokes, each an open frame of two satin gunmetal arms widening from the hub to the rim with a bronze
  blade inside, light satin grey aero discs between, a six-lobed hub under a round cap (Roadster_70; the T badge left
  out). Pirelli P Zero Trofeo RS "Elect"; no size is legible or published.
- **Cabin** (cad.py interior, tub): a black lining up to the beltline, two one-piece light grey buckets with
  integrated headrests on dark shells, a long low black dash, the yoke on its column ahead of the driver (left-hand
  drive), the touchscreen on a stalk to its right, a light console between the seats (Roadster_63 to 69, reveal 19:00
  to 19:10). No interior size is published: every size there is an estimate.
- **Black**: carbon rocker under the doors, the carbon nose face and splitter, the carbon rear corners, the diffuser.
- **Lights**: front light bar along the hood's front edge; headlights in the facets; rear light housing; amber side
  markers ahead of the doors; red reflectors on the rear corners.

## Glass and doors

The windshield's base: straight across the hood at its rear corners (measured, 1,582 ahead of the axles' midpoint,
472 out), then out along the facet's top edge to the wrap corner (1,342, 827 out); round 5 had it 1,725 at the
centre and 1,615 at the corners, read from the top view alone. At the sides the windshield wraps down to the
crest ahead of the A-pillar line, (z, h) = (803, 826) to (349, 1,157), traced on the side photo; the doors' roof
glass from 560 back to -700, between the spine (half width 114) and the roof edge; the rear glass from -700 back to
the wing's seam at -1,920, ending square (round 5: a point at -1,760); a 50 mm white rail outside the roof edge,
then the side glass. Door shut lines (side photo, back-projected): front 834 at the sill, 889 at the beltline, then
up the A-pillar line to the roof; rear -192 at the sill, -340 at the beltline, -700 at the roof. Sill top: 272 at
1,031 rising to 437 at -955.

## Unknowns (guessed, not sourced)

- Every size depends on the plate being a standard 12 x 6 in US plate.
- The door hinge's position and axis (the doors' motion is from the reveal; the hinge is never seen).
- The wing's struts and their path (one turn stands in for them).
- The tyre sizes (fitted from outlines the arches half hide), the rims' offset, the track (set flush with the body).
- The underside and the wheel wells (no photo shows them).
- Every size in the cabin (its layout is from the photos).
- The paint, glass and trim colours are sampled from the photos, not calibrated.

## Budget

Vehicle: under 60k triangles, textures up to 2048 px, GLB under 3 MB after build.sh.
