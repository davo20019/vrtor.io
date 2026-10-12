# Tesla Cybertruck (production, 2024 onward), standard configuration

A test of the building-3d-replicas skill on a large, metallic object. Once it is built and approved it may
become a vrtor subject (David, 2026-10-03), so the GLB is our own geometry and textures only: nothing
from refs/ is shipped, and the "T" badge, the CYBERTRUCK/CYBRTRK wordmarks and every other logo are left
out. Nothing is committed or published during the test.

Configuration: Premium All-Wheel Drive (the volume trim), air suspension at the **Medium** setting (the
normal driving height), factory 20" wheels with LT285/65R20 all-terrain tyres, tonneau closed, no
accessories. Frame and units: millimetres, front facing +z, up +y, origin on the ground under the
midpoint between the axles.

## Dimensions (mm)

Primary source: Tesla Cybertruck Owner's Manual, "Dimensions, Weights, and Cargo Capacity"
(tesla.com/ownersmanual/cybertruck/en_us/GUID-12A976DD-EB60-431B-AFF1-5A37E95006DB.html; tesla.com
refuses scripted requests, so it was read from Tesla's own mirror at tesla.cn, same path; saved as
refs/tesla/manual-dimensions.html). Tesla states them to the nearest hundredth of an inch.

| What | Value | Source |
|---|---|---|
| Overall length | 5,682.9 (223.74 in) | Manual, A |
| Width, mirrors out | 2,413.3 (95.01 in) | Manual, B |
| Width, mirrors folded | 2,200.7 (86.64 in) | Manual, B |
| Width, body without mirrors | 2,031.6 (79.98 in) | Manual, B |
| Height, Medium air setting | 1,793.8 (70.62 in) | Manual, C (AWD and Cyberbeast) |
| Height range, Entry/Exit to Extract | 1,738.8 to 1,943.8 | Manual, C |
| Wheelbase | 3,635.0 (143.11 in) | Manual, D |
| Front overhang | 878.3 (34.58 in) | Manual, E |
| Rear overhang | 1,169.6 (46.05 in) | Manual, F (878.3 + 3,635.0 + 1,169.6 = 5,682.9, consistent) |
| Ground clearance, Medium | 257.0 (10.12 in) | Manual, G |
| Ground clearance range | 202.0 to 407.0 | Manual, G |
| Track, front and rear | 1,772.0 (69.76 in), at the wheel centre | Manual, H |
| Bed floor length x width | 1,824.6 x 1,295.4 | Manual, cargo bed C, D |
| Bed height front / rear (inside) | 727.9 / 503.8 | Manual, cargo bed A, B |
| Wheel | 20 x 9.0J, ET58.5 (rim 508 dia, 228.6 wide, offset 58.5) | Manual, "Wheel and Tire Specifications" (refs/tesla/manual-wheels.html) |
| Tyre | LT285/65R20 Goodyear Wrangler Territory RT (all terrain) | Manual, same page |
| Tyre outer diameter | 878.5 nominal (508 + 2 x 0.65 x 285) | derived from the tyre size |
| Tyre section width | 285 nominal | derived from the tyre size |
| Lug nuts | 6, 21 mm socket | Manual, same page (six on the photos too) |

Derived checks: wheel centre height = 878.5 / 2 = 439 mm minus tyre squash under load (unknown, about
10 to 20 mm). The track (1,772) plus a 285 mm tyre gives 2,057 across the tyre outer faces, wider than
the stated body width (2,031.6), by about 13 mm a side. Either the published width is taken above the
tyres (across the flares) and the tyre sidewalls bulge slightly past it, or the nominal 285 is wider
than the real tyre. Open: to be read off the straight front photo (c150) in the fit.

## Evidence

- **Tesla diagrams** (refs/tesla/): the manual's dimension drawing (orthographic front and side, with
  callouts A to H), the bed drawing (side and top views, the only top view), two exterior renders
  (front three-quarter, rear three-quarter) and the wheel and tyre render. They are Tesla's renders, so
  close to CAD, but only 760 px wide.
- **41 photos from Wikimedia Commons** (refs/web/, licence and author per file in refs/web/SOURCES.md):
  - straight side: c058, c059, c086, c091, c106, c130, c163 (left side: front points to the left of the frame),
    c003, c022, c090, c108, c109 (right side)
  - straight front: c150 (long lens, best), c094, c032 (close, wide angle)
  - straight rear: c069; rear three-quarter: c006, c010, c068, c080, c089, c095
  - from above: c134, c137, c140 (front, from a building: roof, windshield, tonneau top)
  - three-quarter front: c000, c008, c012, c019, c021, c027, c084, c085, c147, c155
  - close-ups: c025, c143 (bare wheel and Goodyear tyre), c001, c055 (lit light bar), c056 (bed open,
    tailgate down), c057 (sail, arch flare, wheel cover)
- **3 walkaround videos, 45 frames** (refs/video/, list in refs/video/SOURCES.md): a studio walkaround
  with even light, a showroom close-up review, and a close-up details video (tonneau slats, sail edge,
  door seams, flare and cladding steps, tread).

## Seen in the evidence (for the structure step)

- Wheels appear two ways: with Tesla's black six-segment aero covers (Tesla's own renders, c057, c106,
  c108, c163, the studio video) and bare (c000, c008, c022, c025, c130, c143: black 20" rim, ten split
  spokes). The covers come with the truck and clip onto the rim; many owners take them off.
- Some photos show the Pirelli Scorpion ATR all-season tyre instead of the Goodyear; tread only, the
  silhouette is the same size.

## Unknowns (no source shows them; they stay marked guesses)

- **Underside**: no photo or drawing. Will be a flat dark pan between the sills, with the suspension
  arms and half-shafts only where they show in side photos behind the wheels.
- **Inside the wheel wells**: only glimpsed (c025, c143, video close-ups). Liner shape and depth guessed.
- **Back faces of the wheels**, brake calipers and discs beyond what shows between the spokes.
- **Interior**: measured on the Owner's Manual's CAD renders where they show it; what they don't show is
  listed under "Interior, measured", "Still guesses".
- **Bed interior**: built from the manual's bed drawing and Cargo Bed page (see "Bed and tonneau,
  measured"); what they don't show is listed there.
- **Exact cross-sections of small parts**: the light bar's lens profile, the mirror housing, the door
  handles (there are none: buttons, see the manual's exterior page), the wiper at rest, the cladding step
  depths. Sizes will come from the photos with a parameter each; their depths are only partly visible.
- **Panel gaps and stainless grain direction**: seen in the close-ups, but their exact widths are
  guesses (about 4 mm gaps).
- **Tyre squash** under the truck's weight: not published.
- **Front door trim at the dash** (dgRcedIkNOM 6:16, 7:13): the door's white panel, cap and ambient line run
  forward past the seam to the dash's rear face, 4 mm behind it (the gap is a guess); the white's lower edge
  falls from the dash's bottom corner (1,028) to the armrest's front, read on those frames, not measured.
- **Roof apex x position and the sail facet angles**: no published number; measured from the side
  drawing and photos in the fit.

## Budget

Vehicle on Quest: under 60k triangles, textures up to 2048 px, GLB under 3 MB after build.sh.

## Structure (step 2)

Coordinates for this section: s = distance back from the front light bar (0 to 5,682.9), h = height
above the ground, w = half-width from the centreline. cad.py turns them into the model frame (front +z,
up +y). Start values were measured on Tesla's side drawing (11.41 mm/px, its sill and apex agree with
the published 257 clearance and 1,793.8 height to 1%) and on c022 (side, 3.0 mm/px from the wheelbase),
c150 (front) and c069 (rear). Tesla's front drawing is a perspective render (its tyres come out 2,265
wide), so widths are not taken from it.

### Body shell: planar facets with a bounded hood and windshield

The steel facets are flat. The side planes clip the shell; the hood applies ahead of the cowl and the
windshield plane behind it. The documented 19.9-degree windshield is steeper than the hood, so their
concave junction cannot be modelled by intersecting both infinite planes. Named corner points and
facet planes remain mirrored left/right. Facets, front to back:

1. **Front face**: a centre panel below the light bar, leaning back to the bumper top, plus an angled
   corner facet on each side (the face is chamfered in plan, c032, c150).
2. **Light bar edge**: the sharpest edge on the truck, where the front face meets the hood, running the
   full width; its outer ends turn down and back along the corner facets (c150, c001).
3. **Hood**: one plane from the light bar up to the windshield base; a narrow **shoulder facet** on each
   side drops to the fender line (c150).
4. **Windshield and glass roof**: a 19.9-degree plane, from NHTSA's real-vehicle measurement, up to
   the **roof apex**, a straight transverse edge at full height.
5. **Rear deck**: from the apex a single plane falls to the top of the tailgate (drawing: 0.14 rise per
   run). It holds the rear roof glass, then the **tonneau** (a black slatted cover sunk between the
   sails).
6. **Flanks**: flat vertical body sides from a lower crease up to the beltline. Above it the **greenhouse
   and sail facets** lean inward: narrow at the apex (roof edge now 1,486 wide around the documented 1,433 mm pane), almost full width at
   the tail (c069). The hull splits this into a window facet and a sail facet.
7. **Lower tuck**: below the crease, a facet leaning inward to the sill (the darker band at the bottom
   of the doors in c022).
8. **Rear face**: vertical tailgate with bevelled top corners (c069).

Cuts and fittings on the shell:

- **Wheel arches**: half-hexagon cut-outs (flat top, steep angled sides, vertical lower legs; c022),
  centred on the axles. The front arch's front leg is steeper and ends on the bumper (see "Front corner,
  measured").
- **Arch flares**: black cladding bands around each arch, standing proud of the steel, their outer edges
  bevelled back to the body. The published body width (2,031.6) is taken across the flares.
- **Sill rockers**: black cladding between the arches, with the downward tab at each end (behind the
  front wheel, ahead of the rear wheel; c022).
- **Front bumper**: black, with its grille band; its corners are blocks flush with the flares that run back
  to just ahead of the tyre, with a lower rear tip (c032, c150, c059). A smoked lower lamp strip runs between
  its top and the steel, amber at its outer ends.
- **Rear bumper**: black, standing out past the tailgate, in two tiers: the upper with a plate pocket
  across its middle, floored by the step, the lower set in under it with the hitch (c069, c006, c080;
  "Rear, measured").
- **Window pockets**: front and rear side windows, the windshield and glass roof, and the rear roof
  glass. Each is a shallow pocket holding a dark glass panel 1 mm below the steel (no coplanar faces).
  Black trim and pillars are the same panel.
- **Glass tint** (2026-10-04): each glass passes the light the new truck's does, from a calibrated meter (+-2%)
  on a factory truck (rb92gt, Cybertruck Owners Club, "Window Tint VLT From Factory"): windshield 76%, front side
  windows and A-pillar triangles 72%, rear side windows 23%, glass roof 3%, rear bed window 26% (24.9% at a tint
  shop, SCTesla). One owner's truck, no model year given. The model has no bed window. `GLASS_VLT` in assemble.py
  turns each into an alpha of 1 - T^(1/2.2), since the app tone-maps before it blends. The B-pillar glass between
  the doors is opaque black. In a seat the app lifts the darker panes to alpha 0.35 so the view out stays usable.
  This replaces the single alpha-0.3 glass, which the app drew fully opaque from outside.
- **Tonneau pocket**: from the end of the rear glass to the tail, between the sails, holding the black
  tonneau panel. Its slats come from a normal map.
- **Light bars**: front, a thin white emissive strip on the light bar edge; rear, a smoked black band
  across the full width under the tonneau with end caps over the pillars, a thin red tail strip in it,
  red lamps under the tailgate and reverse lamps in the plate pocket ("Rear, measured"); amber marker
  lights at the front corners.
- **Panel seams**: 4 mm grooves for the front door, B-pillar and rear door seams, the tailgate and the
  frunk lid.
- **Mirrors**: black faceted housings on a dark base, at the front lower corner of each front window,
  unfolded as when driving; the span is 2,413.3 across them. See "Door mirrors, measured".
- **Wiper**: the single wiper parked up the driver's A-pillar (c150, c027, c085): pivot housing at the cowl in the glass's lower corner; the blade lies on the glass 50 to 65 mm inboard of the pillar crease, toward the apex; the arm covers its lower half. Blade 48 in = 1,220 mm (Tesla part 1853252; notateslaapp.com blade-size table); arm about 50 in (Auto Connected Car News, measured). A 62 in figure (theautopian.com) is unsourced and longer than the glass from cowl to apex (1,530 along the slope).
  It turns: the arm and blade are their own node (wiper_arm) pivoting at the housing's middle about the glass's normal; one wipe (the yoke's wiper key: "press and quickly release", Owner's Manual, Windshield Wiper and Washers, refs/tesla/manual-wipers.html) sweeps 82.6 deg, from parked to horizontal along the cowl (the manual's rain pause "in the horizontal position"), and back in 1.4 s (estimate).
- Not modelled: cameras, the charge port door and the body-side antennae (too small for the budget,
  and not visible beyond a few metres).

### Wheels: separate parts, each its own node

Node tree (glTF), all pivots on the axle:

    body
    steer_fl > wheel_fl > (tyre, rim, cover_fl)     steer_fl turns about the vertical axis through the wheel centre
    steer_fr > wheel_fr > (...)                     wheel_* spins about its axle (model x)
    steer_rl > wheel_rl > (...)                     the production truck also steers its rear wheels;
    steer_rr > wheel_rr > (...)                     the rear steer nodes are there, limits marked unknown
    each steer_* also holds its brake disc and caliper, so they turn but don't spin

- **Tyre**: a turned profile, 878.5 OD, 285 wide, on the 508 mm rim seat. Tread blocks and the shoulder
  lugs come from a drawn normal map (all-terrain pattern; c025, c143). Wordmarks on the sidewall left out.
- **Rim**: 20 x 9J, black satin, five Y-spokes (ten spoke ends), six lug nuts, centre cap (c025, c143).
  Its centre plane sits on the track line: wheel centres at w = 886.
- **Aero cover** (`cover_*`): Tesla's black six-segment cover, about the rim's diameter, a flat faceted
  disc (c057, c106, studio video). Its own node, so it can be hidden to show the bare rim.

## Front corner, measured (2026-10-03)

Measured on c059 (left side, long lens, 18.7 m away) through its solved camera, back-projecting marked pixels
onto the flare's plane and adding back the photo's ride offset (-53 mm). Check first: the front wheel centre
came out 18 mm from its known place, the ground under the tyre at 57 mm with the tyre squash and the tyre's
bulge. c003's camera is close and its height loose (it put the same points 60 to 130 mm higher), so it was
not used. These override the fitted values in cad.py (after params.json), so a refit can't move them; the
fit's dark cut-out merges bumper, flare and tyre and never constrained them.

| What | Value | c059 | Before (fitted or guessed) |
|---|---|---|---|
| Bumper top at the corner (bumper_f_h) | 650 | 652 to 664 | 571 |
| Steel's lower edge at the corner (bumper_f_h + lamp_h) | 682 | 684 (the amber light just below it) | 571 |
| Front flare leg, outer, lower end | s 290, h 682 | s 283 to 307, h 690 to 722 | vertical leg to below the sill at s 237 |
| Flare outer face top (arch_top_h) | 1,030 | 1,042 to 1,060 to the top of its lit bevel | 1,002 |
| Flare bevel (flare_bevel) | 30 | the lit strip above the dark face | none |
| Arch opening top (arch_top_h - flare_band) | 988 | 990 | 949 |
| Bumper side face, rear end at the top (bumper_side_s) | 352 | 341 to 352 | 257 |
| Bumper's lower rear tip (spat) | s 300, h 285 | s 300, h 285 | flat bottom at 314 |
| Bumper side face starts (behind its corner chamfer) | 140 | 105 to 129 | 211 |

The face rake is scaled with the higher bumper top so the front face keeps its fitted slope. The 35-degree
approach line (tangent to the tyre) passes 292 mm high at the spat's s, consistent with the 285 measured.

Also changed at the same time: tyre shoulder lugs as geometry (40 a side, alternating long and short, up to
11 mm proud of the sidewall; c025, c085, c147), cheap flat prisms following the sidewall.

The nose and the corner facets, from the manual's dimensions page (refs/tesla, the bed drawing's side and top
views: CAD renders, scaled by the tyre's 878.5 and the published length) and c059, after a review against c001
and c055 showed the light bar's corner sections far too short and steep:

| What | Value | Source | Before (fitted, from c150, flagged unreliable) |
|---|---|---|---|
| Light bar height (nose_h) | 1,050 | side view 1,061; c059 1,024 to 1,084 | 950 |
| Front face rake (face_rake) | 20 | side view: the face nearly vertical, 10 to 20 | 79 |
| Flat front face, half-width (nose_flat_half) | 625 | top view 628 and 620 | 852 |
| Corner facet reaches the side at (corner_s) | 290 | top view: 285 at 945 out | 159 |
| Light bar drop round the corner (shoulder_drop) | 73 at the face plane; ~25 along the bar | c059: the corner section 1,011 to 1,086 | 135 |

The top view also shows the flat face slightly vee'd (its centre 68 mm ahead of its ends); not modelled.

Not changed, and why:
- **Aero covers**: the six-blade covers match c003 (show floor). Other photos (c085, c147) show a different
  wheel with a hexagonal cap; which one is the default is open.

## Front bumper face, measured (2026-10-04)

The bumper was a block with a shallow slot. c150 (straight on, sunlit, no plate), c094 (with a plate) and the
manual's front view show its face. Widths are read on c150 at the scale of the centre face's creases
(+-625 at px 1,000 and 1,865: 1.445 mm/px). The tyres give the same scale once their 870 mm greater depth
is allowed for. c150's fitted camera can't be used for this: it rolls 3.5 degrees where the photo's edges
roll 1.4, which puts the left side 60 mm above the right. Heights are read on the manual's front view. It
is a perspective render, so its widths are off, but its heights agree with the bumper top that c059
measured (650). Jobs and crops are in measure/bumper/.

| What | Value | Source |
|---|---|---|
| Steel's lower edge across the centre face | 717 (lamp_h_centre 67) | manual front view 719; c150, light bar to steel 227 px = 328 mm under 1,047 |
| Steel's lower edge at the side | 682 (lamp_h 32, unchanged) | c059 684; c150 shows it falling along the corner facets |
| Top band | 650 to 564 | manual 564; c150 58 px |
| Plate recess | 320 x 70, 570 to 640, 8 deep | c150 314 wide, 71 high; manual 340 to 360 wide (perspective) |
| Front plate | 305 x 152, centre x -8, 469 to 621, 2 thick, 2 proud of the face; the same Virginia BELLA plate as the rear (Virginia issues two) | foot from c150's plate seat (469); top from c094 (57 px over the intake's top at 0.9 mm per px of the plate's width, 621). It hangs over the intake's top edge. Open: c150's seat (469 to 565) and the built recess (570 to 640) disagree, left as is |
| Intake | +-640, 414 to 564, 60 deep | at the creases in c150 (px 990, 1,877); manual 414 |
| Grille | vertical bars every 163 mm, two horizontal at thirds | c150 113 px pitch |
| Tow-hook covers | 510 to 617 out, 422 to 490 high | c150 px 1,005 to 1,080, at 0.49 to 0.95 of the intake's height |
| Front camera housing | x -176, at the intake's top | c150 px 1,310 |
| Lip bottom | 265, its front edge chamfered from 300 | manual 259 |
| Corner blocks' bottom | 245 | manual 244; c150 below the lip |
| Corner chamfer | from (640, 404) at the intake's corner to (864, 438) at the block's outer edge, down to (720, 245) | c150 R: px (1,875, 1,527), (2,030, 1,507), (1,930, 1,590); lit by the pavement, so facing down |
| Headlamps in the lower strip | 387 to 614 out | c150 px 1,005 to 1,160 and 1,695 to 1,855 |

Close-up details (second pass, from c147, c085 and c001 at full resolution, and c150 zoomed to 4x):

| What | Built | Source |
|---|---|---|
| Headlamp | one lens from 386 out, round the crease, to the amber end: on the centre face a row of 4 projector cells (satin, darker than the lens beside them); under the corner facet a grey reflector over a dark lip 10 mm tall | c150 (lens px 835 to 1,165, crease at 1,000, cells inboard); c147, c085, c001 (clear lens on the corner facet, silver inside, dark lower edge) |
| Amber end | the strip's outer 75 mm, a dark amber lens unlit | c147 close-up, c085 |
| Tow-hook covers | thin flat caps 107 x 30 standing on the intake floor at its outer ends, lighter satin grey, rounded ends, 5 behind the bumper face | c147, c085 (lighter than the bumper, about a quarter of the intake's height) |
| Front camera | a round lens (radius 7) in a round housing (radius 16) under the intake's top edge at the plate recess's left end | c147, c150 |
| Cladding edges | rounded 9 mm (bumpers, flares, rockers); grille bars 1.5 | c147, c085: the bumper's top edge and corners are soft |

Guesses: how far back the chamfer goes at the block's outer edge (120), the intake's depth (60), the grille's
setback (25), the bars' thickness (5).

Conflict, written down and not forced: at its crease scale c150 measures 328 mm between the light bar's
top and the steel's lower edge, and 1.61 mm/px from those two heights against 1.445 across. The model takes
the widths (nose_flat_half 625, from the top view) and the drawing's 717.

Materials: the amber corner lamps no longer glow at rest. Unlit, they are a dark amber lens; the app lights
them only while a turn signal blinks. The headlamps are a slightly lighter lens than the strip. The steel's
roughness streaks are a third as strong: at full strength they read as wood grain from a few metres away.

## Rear, measured (2026-10-04)

c069 (straight rear, CC0, iPhone 15 Pro Max, 24 mm equivalent: focal 3,028 px at the 3,840 copy, from its EXIF
on Commons) through a camera solved by `measure/rear/solve_c069.py`: the deck's tail corners (tail_half 930.5,
tail_h 1,319.5) fix the scale, the tailgate's side edges (x = +-926) fix the pitch through their convergence, and
the gate's two heights are left free. 7.6 px RMS over six points (about 5 mm; gate_half 900 or 945 gives 12 and
18 px). The solve puts the gate's top at 1,198 (the model had 1,200) and its bottom at 692 (it had 735). Points in
`measure/rear/c069-rear.md`, on the bumper's rear face (z = ZR) or the tailgate's (ZT).

Checks: the licence plate, on the pocket's back wall, comes out 274 x 136 on the bumper's face, 2.01 to 1 like a
US plate (305 x 152); at 186 mm in it is 305 x 151 and centred (x -7). The hitch receiver mouth 62 x 68 (a 2.5 in
tube). On c080 (another truck, braking) the red lamps under the gate are 0.41 of the plate's width, as on c069;
the pocket is 2.2 plates wide (c069 2.4, c080 seen at an angle).

| Feature | Measured | Notes |
|---|---|---|
| Bumper top at the rear face | 650 (649 at the corner, 645 at the body) | the side fit's 679 read the black strip under the gate as bumper |
| Black strip under the tailgate | 650 to 692 | holds the red lamps, 690 to 810 out, 658 to 690 high |
| Upper tier rear face | 917 out at the top, 877 at its bottom, 490 | a facet cut back from the corner chamfer (c006 shows it) |
| Plate pocket | +-330, back wall 186 in, its floor 500 at the wall (the step's rear lip 526) | open up to the tailgate's lower edge: the plate, 506 to 657, stands above the bumper's top |
| Licence plate | 305 x 152, centred, 1 mm off the pocket wall | Virginia's standard plate, personalised BELLA (David's choice), drawn in textures.py to the DMV specimen's proportions (Commons "Virginia 2016 License Plate.jpg", public domain): VIRGINIA in blue serif capitals, the characters a condensed blue serif, the tourism line with its heart and Virginia.org under them; no decals (Virginia dropped them in 2017). Fonts are macOS's Times New Roman Bold and Gill Sans, near but not the plate's own |
| Reverse lamps | 147 (built 156, clear of the plate) to 276 out, 590 to 610 high, on the pocket wall | white lenses either side of the plate (InsideEVs; c069) |
| Lower tier | 657 out at 490, 624 at its bottom, 370 | set in 40: a guess (c006 shows it in, not by how much) |
| Hitch | centre 435 high | |
| Smoked band | 1,205 to the face's top edge (1,311 at the centre) | end caps from 806 out (seam at 801) |
| Tail strip | 1,280 to 1,299, across the band and both caps | c006 (lit, Moab): about 0.18 of the band high, its top 0.12 down; c069 shows its unlit top edge as a line at 1,299 |
| Rear camera | a small A-shaped housing in the band's middle, 1,214 to 1,250 | |

What the lamps do (two articles plus two photos of different trucks): with the lights on, one long thin strip
(c006; The Drive, The Autopian). Braking, the strip's middle goes out and the end caps fill solid red with a
shorter bar in the middle (c080, stopped at a red light; The Drive: "replaced by a shorter light just beneath
it"; The Autopian: "three very bright segments"). The bar is +-350 and just under the strip: read on c080, whose
angle isn't undone, so its width is approximate. Turn signals: the caps, red on US trucks (The Autopian; the UK
reports on red indicators; The Drive says amber, which matches neither photo). Inside the pillars, red lamps face
the open tailgate (already modelled, pillar_red).

## Parameters (P in cad.py)

Fixed (Tesla): L = 5,682.9, H = 1,793.8, wheelbase 3,635.0, front overhang 878.3, clearance 257.0,
track 1,772.0, width across flares 2,031.6, mirror span 2,413.3, tyre 878.5 x 285, rim 508 x 228.6.

| Parameter | Start | Range | What it sets | Seen in | Fitted on |
|---|---|---|---|---|---|
| nose_h | 950 | 880-1020 | light bar height | side drawing | side |
| face_rake | 60 | 0-150 | how far the front face leans back by the bumper top | c022 | side |
| bumper_f_h | 520 | 420-600 | top of the front bumper | drawing 527 | side, front |
| cowl_s | 1,150 | 950-1,400 | windshield base, back from the light bar | drawing | side |
| cowl_h | 1,410 | 1,300-1,500 | windshield base height | drawing | side |
| apex_s | 2,400 | 2,200-2,600 | roof apex position | drawing 2,330-2,470 | side |
| tail_h | 1,337 | 1,250-1,420 | top of the tailgate | drawing | side, rear |
| belt_h_front | 1,150 | 1,050-1,250 | beltline at the A-pillar | c022 1,148 | side |
| belt_h_rear | 1,285 | 1,180-1,380 | beltline at the tail | c022 1,283 | side |
| crease_h | 480 | 380-600 | lower crease (top of the tuck facet) | c022 | side |
| tuck | 60 | 20-120 | how far the tuck facet leans in at the sill | c150 | front |
| flare_proud | 35 | 15-60 | flare thickness past the steel; body half-width = 1,015.8 - this | c150 | front |
| nose_flat_half | 760 | 600-900 | half-width of the front face's centre panel | c150 | front |
| corner_s | 200 | 80-350 | how far back the front corner facets reach | c134, c147 | front (+ three-quarter) |
| shoulder_drop | 80 | 30-160 | drop of the hood's shoulder facet at the corners | c150 | front |
| roof_half | 650 | 560-760 | half-width of the roof at the apex | c150 | front |
| tail_half | 930.5 | fixed | half-width of the deck at the tail top | manual top view (the sail's crease with the deck, s 3,700 to 5,500) | not fitted |
| (side_tail_h) | 1,273 (derived) | | height of the sail's crease with the side at the tail; was 1,259.1 from the side-photo fit, now set by the upright C-pillar crease ("Rear side window, 2026-10-11") | c022, c003 | not fitted |
| (tail_bevel) | dropped | | the sail now runs through the window crease (roof corner at the apex to the C-pillar base) and the tail corner, which fixes the rear top corner | c069 | rear |
| arch_top_h | 980 | 900-1,060 | top of the arch flare | c022 981 | side (wheel landmark) |
| arch_top_half | 310 | 250-380 | half-length of the flat arch top | c022 | side |
| arch_knee_h | 660 | 560-760 | where the angled side becomes vertical | c022 | side |
| arch_foot_half | 590 | 520-660 | half-length of the arch at sill level | c022 | side |
| flare_band | 75 | 50-110 | flare width seen from the side | c022 | side |
| bumper_r_h | 600 | 520-680 | top of the rear bumper (fitted 679; replaced by the measured 650: "Rear, measured") | c069 | side, rear |
| bumper_r_out | 60 | 20-120 | rear bumper stand-out past the tailgate | c022 | side |
| front_bar_h | 22 | 15-35 | height of the front light strip | c150, c001 | not fitted: inner feature |
| roofglass_end_s | 3,000 | 2,600-3,400 | end of the rear roof glass, start of the tonneau | c134, c140 | not fitted (no straight top view); measured |
| a_pillar_s | 1,420 | 1,300-1,550 | front tip of the side glass on the beltline | c022 | measured on c022 |
| c_pillar_s | 3,617 | 3,450-3,750 | rear edge of the rear side window | c022 | measured on c022 |
| seam_s | 1,503 / 2,636 / 3,638 | ±60 | door seams | c022 | measured on c022 |
| squash | 15 | 5-30 | tyre squash; wheel centre height = 439.25 - squash | c022 | side (wheel landmark) |
| mirror size | 190 x 254 x 190 (w x l x h) | measured | mirror housing, unfolded | c003, c134 | see "Door mirrors, measured" |
| cover_dish | 15 | 0-30 | aero cover depth inside the rim lip | c057 | measured |

The measured (not fitted) entries are inner features the silhouette can't see. They are measured on the
straight photos through the camera the fit solves, so they share the fit's scale.

## Interior, measured (2026-10-03)

Sources: the Owner's Manual's interior renders, drawn from Tesla's CAD (refs/tesla/manual-*.png; fetched from
tesla.cn: Interior, Seats, Steering, Storage, Seat Belts, Child Safety Seats, Airbags, Mirrors, Windows,
Interior Electronics, Opening Doors with No Power), the walkaround video frames (refs/video/frames), and the
manual's cabin table (refs/tesla/manual-dimensions.html): head room 1,058.8 / 991.9, leg room 1,043.6 /
1,038.8, shoulder room 1,608.0 / 1,576.4, hip room 1,453.3 / 1,453.5 (front / rear). Coordinates: s back from
the light bar, h height, w half-width. Jobs in measure/int/; the comparison renders in review/interior/.

### Two scaled views

- **Seat side view** (manual-seats-170452D8, near-orthographic). Its scale is **4.58 mm/px**, from the
  H-point (771) to the heel's floor (400) = 81 px. The earlier 5.28 mm/px put the dummy's crown 40 mm
  through the roof; at 4.58 the crown sits 60 mm under the ceiling the head room gives, and the yoke centre
  lands at 1,156 high, 1,650 back (placed: 1,150 and 1,683). The placed H-point, floor, yoke, armrest
  heights all stand; the seat's shape below is read at 4.58.
- **Dash render** (manual-interior-CC015C4E, perspective). Camera solved by scripts/3d/measure.py from the
  screen's four corners, the yoke centre and the windshield glass's two lower corners
  (measure/int/dash-cam.json): 4.9 px RMS, eye at w 129, h 1,209, s 2,360, focal 370 px. Points are then
  measured on known planes through that camera.

### Measured (and changed)

| What | Value | Source | Was |
|---|---|---|---|
| Yoke size | 318 x 216 | width through the dash camera on the yoke's plane; height on the straight-on render (manual-steering-E2AF1DEC) at the same scale, 0.844 mm/px | 318 x 212 (the render's 0.667 ratio, read by eye) |
| Yoke tilt | 22 deg from vertical | seat side view, the rim seen edge-on | 20 |
| Yoke outline | outer edge and the three openings traced from the render's alpha, averaged with its mirror image (measure/yoke/outline.py -> outline.json); top opening 251 x 51, lower openings 95 x 80 | straight-on render | rounded box with polygon holes |
| Yoke details | pad +-68.6 at 36 high to +-42.5 at -61, sides bowing in; recessed horn face +-42.5 at 27.8 to +-27.3 at -39.6; silver chin +-40 at -58 to +-27.3 at -90; pods from the pad to a tip at 123 out, 6.7 high (top corner 104.9, 33.7; bottom 111.6, -5 to 59, -15.2), silver strip on their upper outer edge; scroll wheels at +-85.2, 16, 14 across; icons: left pod right/left turn signals with a line between, high beam, four-way; right pod custom (hexagon), gauge, wipers, line, voice | the render on a 10 mm grid; icons from the left and right scroll button pictures (D13A2862, 477E18D7) | pad, chin, pods placed by eye; no icons |

Check (measure/yoke/compare.py, the model rendered straight on through render_cams.py next to the manual's
render, both scaled to 318 mm): outline IoU 0.965, mean edge distance 1.6 mm, height 214.7 against 215.9.
| Screen lean | 7 deg | seat side view (edge-on screen); the dash camera's error falls from 4.9 to 3.4 px with less lean | 15 |
| Screen depth | 1,510 back | moved 10 mm so it sits in front of the white block, as in every frame | 1,500 |
| Windshield top edge (header front) | 1,739 back, 1,536 high | dash camera, on the roof plane | none |
| Headliner behind the header | dark suede from the header back to the roof beam at the apex, under the windshield's upper part (2026-10-11) | dgRcedIkNOM-31 (suede behind the lowered visor, no glass overhead); c134 (from above, the clear glass shows nothing behind the mirror housing) | bare glass between the header and the beam, which showed the seats from outside |
| Dash top, lip and face | top profile (s, h): lip 1,435 / 1,207, a short nose up to 1,398 / 1,231, the main top rising to 1,045 / 1,246, a front facet up to its crest at 975 / 1,263, then 8 under the glass (DASH_TOP); the lip edge 12 thick, a dark vent slot under it, then the face in the top's suede starting just behind the lip nearly level and turning down to the ambient line on the white block (2026-10-11) | dgRcedIkNOM-32 through its solved camera (yoke, screen and white block within ~6 px): the shading steps down the dash (front facet rows 66 to 104, main top 108 to 176, nose 180 to the lip at 217, slot 226 to 232, face 238 to 262, light at its top and darkening down, ambient 262 to 271, white block from 274); the model now spans 78 to 216 for the top and puts the lip at 216, the face 238 to 275, the white block from 278; the manual's seat side view (4.58 mm/px) for the crest (1,265 near 1,019). The lip was 1,224 / 1,480 from the manual's dash render, which this real photo puts 17 lower and 45 forward | lip 1,224 / 1,480 with a 40 mm dark shelf front over a recessed dark face, top one plane; before that level, meeting the glass at 900 |
| Front door panel at the dash's point | one continuous moulded panel: its front section follows DASH_POINT (top corner 783 out, tip 832, bottom corner 750), then its two broad faces carry the diagonal crease to the rear of the door. Its front is clipped 4 mm behind the dash's actual sloping profile. Joint edges round by 2 mm; dash chamfer edges by 12 mm (2026-10-11) | int-athens-3 (shut-door passenger corner), dgRcedIkNOM-376s (6:16 close-up); front point from int-athens-1. Seam width, rounding radii and interpolation are modelling choices, not surveyed dimensions | Separate 80 mm filler wedges: protruding upper and lower triangles in the seated view; 28 mm dash rounding retracted the end away from the joint |
| Material lightness (2026-10-11) | unchanged: yoke 22 grey, suede 78, white trim 222 | the yoke against the white block's face, both facing the seats, in int-athens-1 and rendered through its camera: 0.078 in the photo, 0.074 to 0.083 rendered (linear). The suede against the white reads 0.046 in that photo and 0.02 rendered, but the door is open there and daylight from the opening falls on the post's face; int-athens-3 (door shut) gives the dash top about 0.10 of the white block, as the model's materials do (0.10). Video frames (dgRcedIkNOM) have a flat tone curve and don't calibrate. render_cams.py takes "sunEnergy": 0 for diffuse showroom light when comparing with indoor photos | none |
| Dome light under the header | 1,826 back | dash camera | (was taken as the header) |
| Overhead console | lower corners +-136 at 1,490 high, 1,578 back | dash camera | none |
| Rear-view mirror | 187 x 48, lower edge 1,450 high, face 1,664 back, turned 18 deg toward the driver | int-athens-3's glass corners with the dash camera's ray (measure/console/athens3-mirror.md) | 195 x 50, 1,464 to 1,513 high, 1,621 back, square (dash camera alone: depth unconstrained) |
| Console front | 1,614 back at the rim (918), lid front 1,897 | dash camera on the rim's and lid's own heights (measure/int/glove.md); 1,494 before was the dash's lower edge, read on the near-grazing x = 0 plane. int-athens-3's camera solves to 23 px RMS with it (54 with 1,494) | 1,494 |
| Pedals across | brake w 460, accelerator w 290 (brake outboard) | dash camera | swapped |
| Pedal shapes | brake: hanging, rounded pad 130 x 80 with eight black rubber strips, arm rising inboard into the dash; accelerator: floor-hinged, 50 x 220 with a rounded top, four strips down its upper part, hinge block on the floor | manual-interior-CC015C4E (14, 15), widths against their 170 mm spacing (3.6 mm/px) | plain boxes 120 x 85 and 55 x 220, fully metallic (read black in the footwell) |
| Front seat side profile | back's rear edge (2,447, 675) (2,493, 812) (2,626, 1,316), headrest tip 1,637 high at 2,470; front face (2,300, 760) to (2,425, 1,225); cushion front 1,765, top 742 to 760 front, 716 rear | seat side view at 4.58 | slab and box |
| Rear H-point height | 724 | rear head room (SAE H63: 8 deg line + 102) to the deck's inner face, which is the ceiling there | 738 (with a correction from the front row, dropped once the front's head room held on the built roof); 771 (the front's) |
| Roof beam at the apex | front face 2,333 back, filling up to 10 under the glass | front head room: the 8 deg line from the measured H-point (771) runs 957 to it; under the bare glass it ran 43 further (1,102) | 2,386 to 2,466, 22 thick |
| Pedal depth | accelerator centre 1,348 back, brake 40 behind it (both 58 further back than guessed) | front leg room (SAE L34: ankle to H-point + 254 = 1,043.6), heel on the mat against the accelerator's hinge block, ankle 95 above it | 1,290 / 1,330 (guess) |
| Front seat base | the mechanism block under the front half ends at 2,138; behind it the base is lifted to 580 on two rails | rear leg room (L51, 1,038.8): the back passenger's toes stop on that block with the ankle at 2,393 | a solid block to 485 over the whole seat, leaving no room for feet (shape still a guess) |
| Door white panel crease | at the shoulder room's half width exactly | shoulder room 1,608 / 1,576 measured 1,609.7 / 1,577.5 | 2 mm outboard of it |
| Rear backrest | 21 deg | manual-childseats-D8CE20B2, side view | 25 |
| Door armrest face | w 700 (armrest), lower panel w 727 at hip height | hip room 1,453 | w 792 |
| Door white panel crease | w 806 front, 790 rear | shoulder room 1,608 / 1,576 | flat panel |
| Console proportions | tray 1,614 to 1,897 (charger well from 1,634, cupholder pod to 1,897), lid 1,897 to 2,432, rear block to 2,600 | the well about as long as the pod (2298443C, int-athens-3); the open lid about twice as long as wide (34C29DB3) | tray to 1,880, lid 1,880 to 2,330 (35/40/25 by eye) |
| Console top | satin silver band, rim 918, wrapping 20 down the black sides the whole length; below it the body steps in 10 (+-136) and narrows to +-112 at the floor | int-athens-3 (a real truck: silver deck, thin silver edge on the side); the step from 2298443C | light grey plate on the tray only; then a 60 white band (2298443C shows a white-trim version) |
| Console lid | light warm grey padded leather, top 943 (25 above the rim), level with the door armrests | int-athens-3: from the driver's seat the whole cupholder pod shows in front of the lid, which a lid more than ~25 above the rim would hide from the eye (s 2,260, h 1,411) | 22, 50, then 90 above the rim; the 90 came from the open lid's thickness, which includes the part that drops into the bin |
| Cupholders | one figure-eight pocket: chamfered octagons 80 across, 87 along, chamfer 13, centres +-90, 15 ahead of the lid; between them a 36 passage, the front and back walls coming in as wedges whose tops slope down 40; grip tabs on the side walls | 886D0FDA (pair spans 0.89 of the width); int-athens-3 (the pinch) | separate octagons with a lowered bridge |
| Charger well | lined in dark felt; front wall sloping 34 deg back, floor 785, back wall 18 thick ahead of the cupholders; a felt-covered rib down the slope, a lip at its foot | int-athens-3, 2298443C, 886D0FDA | black pads standing above a flat top |
| Rear screen | 208 x 117 (9.4 in), in a vent surround, centre 841 high | manual-electronics-D54DBA46, manual-interior-E5BB028D | 220 x 140 |

Shapes taken from pictures, sizes partly guessed:

- Front seat front outline (71D65904): widest at the shoulders (w +-268 at 1,150), straight sides tapering
  into the headrest (+-160 at 1,560, +-120 at the top), centre insert 45 mm behind the bolsters. Widths are
  scaled from the hip room split, not measured: **guess** (seat 536 wide).
- Rear bench (FF29F441, EC916D67): outboard places 500 wide, centre 380, separate headrests 25 mm above the
  backs, recessed inserts on the outboard backs, the centre armrest stowed in its slot (E5BB028D shows it
  down with two cupholders). Place widths: **guess** from the picture's proportions.
- Doors (frames dgRcedIkNOM-12, -17, -45; manual-windows-0C474E0B): black cap under the glass, ambient line,
  two-facet white panel with a diagonal crease (front door high at the front, rear door high at the back), armrest
  with pull pocket, switch pod (four switches on the driver's door, one elsewhere), dark lower panel, speaker
  grille low at the front. Crease heights and the pocket and grille outlines: **guess**.
- Dash profile (frames dgRcedIkNOM-14, -16): shelf lip, grey face 12 mm behind it with the vent slot, ambient
  line, white block (45 deg upper chamfer, front face 10 mm proud of the lip, lower chamfer), dark lower
  dash, glovebox groove on the passenger side (measured since: see "Passenger corner and footwell"). The face depths: **guess**.

- Front seat details (dgRcedIkNOM-13, -26, -37, -45): light grey piping along the back's front corners and the
  cushion's side bolsters, the insert's V seams (shoulders to the lumbar, then straight down), the map pocket on
  the back's rear face (830 to 1,180 high, 430 wide, 12 proud) with its piped top edge. Positions read from the
  frames: **guess** to within a few cm.
- Rear centre armrest folded down (manual-interior-E5BB028D): 420 long, 300 wide, 105 thick, two rounded
  hexagonal cupholders 290 ahead of the rear H-point's s. Thickness chosen so it folds into the 110 mm back.
- Seat belts (manual-seatbelts-0EF5959F, -25FB8DBC, -F460CA2E): front D-ring on its adjuster on the B-pillar at
  1,330, the belt down the pillar trim to the retractor at 470, buckles on stalks inboard of the front cushions;
  rear outboard belts from the back wall at the shoulder down beside the cushion, four buckles between the
  places. All heights and anchor points: **guess** from the pictures.

- Padded inserts: the front backs' and cushions' centre panels and the rear outboard backs' inserts are crowned
  (a cylinder along the panel standing 14 to 15 mm proud on its centreline, meeting the face at the bolsters),
  so the bolsters still stand forward of them. The crown height: **guess**; the real panels are visibly domed in
  dgRcedIkNOM-13 and the manual's seat renders.
- Overhead console (manual-interior-CC015C4E, zoomed): the light grey mirror-mount housing lying along the
  windshield glass (the plate measured before), a dark strip 78 wide down its face from the header with the
  hazard light and P R N D, the camera pod at its foot, and two thin grey arms from the header 235 mm either side
  to the strip (the V). The rear-view mirror's face is reflective (bright in the render). Strip width, arm ends
  and key spacing scaled from the 195 mm mirror in the same picture: **guess** to about 10 mm.

- Front seat bolsters turn in toward the occupant: each one's front face slopes from its outer edge back 25 mm
  to the insert (dgRcedIkNOM-13, manual-seats-71D65904). The 25 mm: **guess**.
- Tweeter grilles on both A-pillars, 1,460 to 1,540 back, 2.5 mm proud of the trim (dgRcedIkNOM-14); two USB-C
  ports under the rear screen's surround, 44 apart at 743 high (manual-interior-E5BB028D, item 3). Sizes and
  positions: **guess** from those pictures.
- The dash shelf is a fine woven finish like carbon fibre (dgRcedIkNOM-14), drawn as a 2 x 2 basket of 4 mm
  blocks; the pillars, header and visors stay suede.
- Coat hooks: no picture shows them, so none are modelled.

### Materials and light (2026-10-03, third pass)

- Seats and armrests pebbled leather, the dash top, pillars and headliner suede (78 grey, lighter than before:
  the frames show mid-grey), carpet with pile: drawn normal maps tiling every 250 mm (textures.py).
- Padded and moulded parts have rounded edges (assemble.py, ROUND: 24 mm on the seats, 28 on the white dash
  block, 14 on armrests and the door's white panel).
- The cabin's light is baked in Cycles (an even white sky through the windows, direct and bounced) into one
  2,048 px map on a second UV set, exported as the occlusion map. Stored as sqrt(light / 0.45): a surface getting
  45% of the open sky shows at full brightness, the median cabin surface (9%) at 0.45, a footwell at 0.15. The
  app (apps/cyb main.js) applies it to its lights as well as its reflections.

### The cabin against the published room dimensions

measure/cabin/audit.py measures the built parts by SAE J1100's definitions (audit.md has the last run). After
the changes above every published figure holds within 2 mm: head room 1,058.8 / 991.9, leg room 1,043.3 /
1,038.8, shoulder room 1,609.7 / 1,577.5, hip room 1,453.4 / 1,453.4. J1100 itself isn't public, so the ankle
point used for leg room (95 above the heel on the mat) is an assumption; head, shoulder and hip room need none.

The windshield: Tesla publishes no rake or size (searched: glass shops, the service manual's windshield
procedure, part 2040106-00-A). The model's comes from the fitted body: the glass rises from the cowl (954 back,
1,374 high) to the roof apex (2,426 back, 1,794 high, the published height) at 15.9 deg from horizontal, 1,530
along the slope, 1,331 wide at its base; its top edge (the header, 1,739 back) and its lower corners were
measured through the dash render's solved camera. Checks:
- Rake. The Owner's Manual's side drawing (manual-dimensions-D2BB952D, 11.39 mm/px along, 11.21 up from L and H):
  the glass line fits at 16.4 deg (0.4 px RMS; about +-0.4 deg at that resolution), the hood at 20.5. The Body
  Repair Manual's side-body drawing (refs/tesla/bodyrepair/dims-side-body.jpg, orthographic: its four labelled
  diagonals all give 3.08 mm/px, the sill level to 1 px) has the body side's roof rail at 17.8 deg, but that is the
  bare steel rail, not the glass. A reader's protractor figure of 18 (theautopian.com) is unsourced. The model's
  15.9 is within about half a degree of Tesla's exterior drawing.
- Cowl (the hood/glass break). Unsettled: the fit put it at its lower bound (950); the manual drawing's
  centreline break is at about 1,153 back, 1,439 high; the corner where the hood crease meets the A-pillar in
  c059 measures 724 back, 1,264 high through that photo's fitted camera (measure/windshield/c059-cowl.json),
  i.e. the side corner may sit well ahead of and below the centreline break, which the model's one transverse
  cowl line can't do. Left as is until a view that shows the cowl line across the hood is measured.
- Top view (dims-top.jpg, 4.11 mm/px; 1,427, 1,549 and the 1,751 diagonal agree to 2 mm) and the A- and
  B-pillar widths (dims-pillars.jpg: 1,543, 1,689, 1,691, 1,629 diagonal) are saved for checking the cab.

### Passenger corner and footwell (2026-10-04)

Checked from the passenger seat against int-athens-3 (camera solved from the screen corners, yoke and console
front: measure/console/athens3b.md), the dash render's camera, and frames dgRcedIkNOM-14, -15, -16, -25.

| What | Built | Source |
|---|---|---|
| Glovebox | slim drawer face under the white block: x -236 to -612 at 1,024, -212 to -604 at 968 (the inner end leans) | CC015C4E item 18 through the dash camera (measure/int/glove.md); B379A2C2 |
| Centre ribs | six brushed aluminium ribs along the truck, 28 wide over +-125, black between, from the dash's lower edge (881 high, 1,444 back) down to the floor at 1,640 and on under the console | dash camera (the ribs' ends above the console); dgRcedIkNOM-16, -25; int-athens-3. Slope and rib height: guess |
| Dash block ends | pointed, on the block's face: top corner 783 out at 1,162, tip 832 out at 1,120, bottom corner 750 out at 1,027; the end faces run straight back | int-athens-1 through its solved camera (measure/console/athens1-whiteend.md; the block's top and bottom read within 8 mm of the model there); int-athens-3, dgRcedIkNOM-15, 3:14 |
| Front door trim | starts 12 behind the door's edge as before (the 20 mm reach forward is undone: the pillar's foot fills the corner) | int-athens-1, dgRcedIkNOM 3:12, 3:14 |
| Side glass tip | 800 back on the beltline, about over the front wheel; the glass's top edge through where it ends seen from the driver's seat (1,254 high at 947 back, 1,321 at 1,136, 1,363 at 1,260), 60 under the roof edge at the door's front seam (1,553), then the margin to the apex | c003 through its fitted camera (measure/windshield/c003-sidetip.md), c022; the three points between: int-athens-1 through its solved camera (measure/console/athens1-strip.md). It was 1,514 with a straight top edge to the apex, which left a steel triangle where the glass is; then a straight line from the tip to the seam, up to 16 low at the front. **Now (2026-10-04):** the glass's own top edge is one straight line from the tip to the roof edge less the margin at the apex (`side_glass_top`, no deviation from the line along its length), as on the real truck, where the window is a wedge with straight top and bottom edges meeting in a sharp tip (c003, c027); the kinked edge through the int-athens-1 points read as a visible bend from outside. Those points are the A-pillar trim's lower edge, which covers the glass from inside, so they now only place the strip (`side_glass_seen`), unchanged. The straight edge runs 23 under them at 947 back, 22 at 1,136 and 20 at 1,260, and 30 over the 1,553 seam point (60 under the roof edge, 1,418): from the driver's seat expect a thin dark sliver between the glass and the strip's lower edge there, which int-athens-1 does not show. Not yet rebuilt or checked against int-athens-1/-2 |
| Front door glass | reaches forward with the glass to the tip, so it opens with the door | as the real truck |
| A-pillar inner trim | a suede post at the door's front edge, standing right over the white block's pointed end, and ahead of it one even bar along the windshield's edge from the dash up to the roof apex, with a triangle of the side glass between them over the dash; behind the post the fixed glass runs on to the black upright at 1,727 where the door glass starts (window frame, below). Post: rear face on the door opening's edge (1,410 back at the dash, 1,470 at 1,370, corner at 1,496, 1,399); front and inner sides on the sight planes of its outline in int-athens-1, dgRcedIkNOM-32 and 6:16 (measure/console/pillar_hull.py). Bar (2026-10-11): a wedge section on the truck's own glass planes. Measured: it runs 67 in under the windshield from the crease (its edge on the glass 71 to 82 in from the side glass, through dgRcedIkNOM-32's solved camera, which puts the windshield's clear edge within 3 mm of the model's: 121 to 127 against 120 to 124), it meets the side glass at the crease itself (2 to 10 below the windshield there), and its bottom corner lies half way across (int-athens-1: the dark underside and lit inner face meet at 0.47 to 0.50 of the way between its edges). Not measurable: the bottom corner's depth, 30 (APOST): in int-athens-1 and dgRcedIkNOM-32 a deeper bar only slides that edge along the bar, and 6:16 shows it all black. Speaker grille on the post's face toward the seats, 765 to 830 out, 1,233 to 1,295 high, about 65 x 62: its corners in int-athens-1 cast onto the post (measure/console/athens1-grille.md; the rendered grille lands on the photo's within a few px). Tweeter grille on the bar's underside, 65 along it from 1,310 to 1,375, 10 to 55 in from the side glass: only dgRcedIkNOM-31 shows it (no solved camera), where it is the same square part as the post's grille | int-athens-1 through its solved camera (screen and yoke within a few px; the post lands on the photo's, x 180 to 345 against 180 to 380 in the crop, standing over the block's point as in the photo, where the door is open). Near the pillar that camera is about 60 mm off: it puts the windshield's clear edge 180 in from the side glass where dgRcedIkNOM-32 and the model agree on 120, so only ratios and positions on the model's own post are taken from it there. A post moved to 1,727 (one build on 2026-10-11) contradicted int-athens-1: the 1,727 edge is the door glass's start, not the post's |
| Windshield black band from the cabin | matte black (it was the exterior pillars' gloss, which reflected the sky as a light sliver at the lower corner) | int-athens-1, -2: a dark lip beside the A-pillar trim |
| Carpet and mats | carpet a fine cut pile; mats a flatter velour with a 25 mm bound edge | dgRcedIkNOM-25. Mat outlines: guess |

Cross-checked on independent real photos (2026-10-04). Sources are Wikimedia Commons photographs with named
authors (auto show, street, Tesla store) and two walkaround videos of a US Foundation Series truck; EXIF, where it
survives the resizing, names phone cameras (c059 iPhone 14 Pro Max, c090 Galaxy S8). The three int-athens photos
are one truck, so each interior change was also checked on the video's truck:
- Side glass tip over the front wheel: all ten side photos (c003, c022, c059, c086, c090, c091, c108, c109,
  c130, c163); the tip reads 0 to 50 px ahead of the front axle on seven of them, 700 to 880 back. 800 is inside.
- Wide suede A-pillar trim with the window opening behind it: int-athens-1, -3; dgRcedIkNOM-14 and its 6:16 frame.
- Pointed dash block end, door trim flush with it: int-athens-1, -3; dgRcedIkNOM-15 and its 6:16 frame.
- Ribs between the footwells, console behind them: int-athens-1, -2, -3; dgRcedIkNOM-16, -25; the dash render.
- Glovebox outline: only Tesla's own CAD renders (CC015C4E, B379A2C2) show it; in the photos the passenger lower
  dash is too dark to see a seam (the screen's "Glovebox, tap to open" button confirms it exists).
- Mats differ between the trucks (Athens: ribbed rubber all-weather; the video's truck and Tesla's render:
  carpet), so they are an option; the model keeps carpet.

| Door sill under the glass | 58 deep (belt - 52 to belt + 6), grey suede like the pillar trim, the white panel starting under it | dgRcedIkNOM 6:16 (40 px against the white panel's 175), int-athens-3 |

The mirror shows through the window opening from the seats (review/footwell/f1). Through int-athens-3's solved
camera it doesn't: that camera (23 px RMS, an ultra-wide lens) sits at 1,910 back, level with the mirror, which
c003 puts where the model has it (front about 1,580 to 1,600).

### Still guesses

- Rear H-point s (3,150): set so the 21 deg backrest fits against the cab's back wall (cab_rear_s 3,700,
  itself a guess). No picture gives the rear seat's position along the truck.
- Seat, cushion and bench widths; cushion thicknesses; the seat base and stand.
- Header depth behind 1,826 (the beam is 1,739 to 1,905), sun visors (stowed under it), the roof rails'
  width, the B-pillar trim.
- Pedals: their lean (brake 35, accelerator 40 deg),
  the brake arm's path inside the dash, floor mat outlines, carpet.
- Console width (+-146), on which every console size above is scaled (measure/console/athens3.json tried to
  solve the photo's camera from the screen corners and the console's front, but its references reproject 54 px
  RMS, likely the phone's wide lens, so nothing was taken from it); the charger pads' lean and the well's
  depth; the lower body's taper (+-112 at the floor). No picture with known references shows the console, so
  these are ratios in the manual renders, not solved measurements.
- The yoke's depths: rim 30 deep and rounded 9 mm front and back (in assemble.py), pad 16 proud, pods 7,
  chin 9, scroll wheels 4. No picture shows the yoke edge-on closely enough to measure them.
- A-pillar post's depth along the truck and the strip's section between the measured outlines. Tesla's
  windshield service photos now show the removed trim and its returns (refs/tesla/service-windshield/),
  so this is no longer hidden in every reference. They support a moulded, rounded return (14 mm rounding),
  but have no reliable scale or solved camera for the depth. The radius is approximate. The video's
  cross-cab frames (7:13, 6:16) still miss by 30 to 50 px on that side, so they cannot establish an exact section.
- Windshield placement relative to the roof apex remains photo-derived. The glass's own width, slant height,
  and slope now follow real-vehicle NHTSA measurements rather than the earlier exterior silhouette fit.
  The bow and black-border corner transitions follow Tesla's service drawing and remain proportional estimates.
  The rejected c134 camera is retained as diagnostic evidence, not as a source of absolute dimensions.
- The tweeter grille on the A-pillar, seat belts, the drive-mode selector and buttons on the overhead
  console, coat hooks and dome lights: not modelled.

### Windshield and support rework (2026-10-04)

The real 2024 Cybertruck NHTSA test report (O20244500, TR-P44392-01-NC) provides measurements missed by the
silhouette fit. Printed page 10, data sheet 3, gives WA = 19.9 degrees from horizontal. Printed page 25,
data sheet 15, gives A = 1,433 mm top width, C = 1,785 mm bottom width and D = 1,780 mm pane height.
The diagram distinguishes these from protected-zone B, E and F. The saved two-page excerpt is
refs/nhtsa/windshield-measurements.pdf; report URL and conventions are in refs/nhtsa/SOURCES.md.

The pane now has those dimensions and slope. Its top stays 40 mm ahead of the fitted roof apex: that absolute
placement is a photo estimate. The larger pane requires a wider roof edge and an earlier, lower cowl. The
hood and windshield meet in a concave side profile, so hull construction bounds each plane to its own
longitudinal region. The fitted shoulder facets remain independent. The dash retains its measured rear lip
and follows the lower glass at the front, removing the former opaque ledge across the photographed corner.

Tesla's windshield service procedure supplies the bowed lower edge, clear-glass boundary and removed
forward-trim shape. The bow remains about 60 mm, using twelve segments; the frit has a 250 mm lower corner
transition. Those small dimensions are estimates from the drawing, not Tesla dimension callouts. The
windshield is its own continuous, roughly 7 mm deep solid pane with a faint blue-green, alpha-blended glass
material; the opaque fired border is a separate mesh. Tint, thickness and border widths are appearance
estimates. No reference image is shipped as a texture.

The black support is bounded by the solved Athens 1 and Athens 2 outlines, with d32 retained for the post
and the cross-cab video's lower outline used only for underside tilt. The passenger-seat video's post plane
is no longer used to set depth. The upright terminates in the diagonal bar instead of leaving an angular
projection into the windshield. Its inboard return reaches 100 mm from the former pane attachment line,
with the two still-photo outlines constraining its visible width. A 14 mm, four-segment rounding softens
its moulded section; these section/return dimensions are estimates, not documented trim measurements.
The assembly is capped below the actual glass only within the glass footprint.

Tesla's Collision Repair Manual gives body widths between marked structural holes; these must not be used
as trim dimensions. Saved diagrams and measurement conventions are in refs/tesla/body-dimensions/.
Review and verification: review/windshield/report.md and comparison.png. Exact post depth still needs
scaled views or direct measurements of the removed trim. The earlier c134 camera is rejected for dimensions.


## Bed and tonneau, measured (2026-10-03)

Sources: the Owner's Manual's Cargo Bed page (refs/tesla/manual-cargobed.html, its overview render and the
switch close-ups, fetched from tesla.cn) and the bed drawing in the dimensions page (side and top views,
measured by pixel at 8.2 mm/px from the truck's length; enlargements in measure/bed/).

| What | Value | Source |
|---|---|---|
| Floor height | tail_h - 503.8 = 815.7 | Manual, cargo bed B (drawing: ~794) |
| Floor length | 1,791 built (spec 1,824.6) | front wall foot held at s 3,720, 20 mm behind the cab's back wall (drawing: 3,651) |
| Tailgate inside face | s 5,511 | drawing |
| Canister rear face | s 3,925, vertical down to h 1,350, then the wall slopes forward to the floor | drawing (bed top front at 3,913), overview render (vertical face under the open cover) |
| Wheel-well humps | foot s 3,970 / 5,085, top s 4,188 / 4,876, top h 1,074 | drawing |
| Width at floor, between humps | 1,295.4 | Manual, cargo bed C |
| Side walls, inside | 1,470 | top view: constant from s 3,950 to 5,450 |
| Slats | 16 at 102 mm, 10 mm thick, 1,520 wide (25 mm over each wall, into the rails) | pitch from the close-up video's slat lines (the old normal map); count from the bay's length |
| Switch | left sail by the tail light, three keys front to back: open, close, tailgate | Manual, Cargo Bed, items 3 and "Accessing the Cargo Bed" |
| LED strips | along the top of each side wall | Manual, Cargo Bed, item 2; lit on Auto when the cover is open (Lights page) |
| Behaviour | full press opens or closes fully; a second press stops it; only in Park; also Controls > Tonneau | Manual, Cargo Bed |

The sail, checked against the manual's top view (the model rendered orthographic at the drawing's scale and
overlaid, 2026-10-03): the outline matched within a few pixels, but the sail's crease with the deck ran 64 to
90 mm a side inside the drawing over the bed. The fit had no rear or top photo, so the side photos fixed the
sail's lower crease and nothing fixed its top. The sail is now the plane through the C-pillar base and that
lower crease at the tail (both as fitted) and the deck's tail corner at 930.5 (drawing). It reproduces the
drawing's crease, 823 to 925 mm off the centreline from s 3,700 to 5,500, within 6 mm, and leaves the side
views as they were. From the C-pillar back to about s 4,040 the window facet now bounds the deck: there the
model sits up to 36 mm inside the drawing.

Rear side window, 2026-10-11: the sail's crease with the window facet ran from the C-pillar base up to the roof
corner at the apex, so the hull clipped the rear side glass to a wedge whose top fell steeply to a point on the
belt. On the truck the window is a tall quadrilateral: its rear edge stands upright at the C-pillar from the belt
to the rail under the roof edge, about 250 tall (c022, c003, c010; the window frame in c003, windows down). The
sail is now the plane through the C-pillar base, the deck edge straight above it on the window facet, and the
deck's tail corner (930.5, drawing). Through c003's solved camera the new opening's rear edge and top lie on the
photo's. Costs: its crease with the side at the tail comes out at 1,273 instead of the fitted 1,259 (14 higher),
and the deck edge sits 29 mm inside the drawing at s 4,200 and 15 at 4,800 (was within 6). No single plane
through the upright crease and the tail corner meets both; the photos of the window win, as the window is what
shows from every side.

Tailgate, compartment, outlets, tie-downs (manual: Cargo Bed and Cargo Bed Outlets pages and their renders;
c069 straight rear, tonneau shut; c056 open bed, tailgate down):

| What | Value | Source |
|---|---|---|
| Tailgate | steel panel to 926 mm off the centreline, from h 735 to 1,200; the light band's middle above it to 806 (the corner blocks stay on the pillars) | c069, scaled from the rear face's width |
| Tailgate hinge | on its outer face, 58 mm under the floor liner's top, so it lies level with the floor when down; 90 degrees | c056 (level with the floor) |
| Struts | one each side, from the pillar's rear face (h 1,110) to the gate's inside near the hinge | c056, the manual's bed render |
| Pillar backs | black, with a red light under each corner block | c056 |
| Emergency release | on the gate's inside, low, 440 mm left of centre | manual's bed render, item 6 |
| Under-bed compartment | tub 1,080 x 385 x 226 (94 L; manual: 97 L), lid 1,120 x 415 hinged at its front edge, lifting 80 degrees, handle at its back edge, drain plug | manual, Under Bed Compartment and its render |
| Outlets | left wall by the tailgate: two 120 V 20 A over one 240 V, behind a cover hinged at its front edge (pull its back edge) | manual, Cargo Bed Outlets; c056 |
| Tie-downs | one at each bottom corner, on the side walls | manual, Securing Cargo and its render |

Behaviour: the switch's third key drops the tailgate (only in Park); it closes when lifted (pressing it). The
bed lights are on while the tonneau or the tailgate is open (manual, Lights). The lid and the outlet cover
open by hand once the bed is open.

Still guesses: the canister's coil (radius 100 mm, hidden in the steel between the cab and the canister
face), the travel time (16 s), the liner's colour, the switch pad's size (156 x 52) and position on the sail
(150 mm ahead of the tailgate, 48 mm down from the sail's top edge), the strut anchors, the outlet cover's
size (105 x 210), the tie-downs' shape. Not modelled: the L-tracks (optional equipment), the charge port's
manual release on the left pillar, the attachment points under the rail appliques.

## Door window frame and A-pillar post, measured (2026-10-05)

On the real truck the front door's frameless glass starts at a black rounded upright right behind the mirror's tip,
which curves round into a rail under the roof edge back to the B-pillar (c003, window down; dgRcedIkNOM-11). Ahead of
it the glass triangle is fixed; the suede A-pillar post stands inside the triangle, near the door seam. With the door
open (c166, dgRcedIkNOM-12) the door's top is bare, so upright, rail and triangle are on the body.

| What | Value | Source |
|---|---|---|
| Upright | 1,727 to 1,802 back, 75 wide, from the belt | c003 through its solved camera, 1,722 to 1,797 after its seam bias (measure/doorframe/c003-post.md); c165 (Hong Kong side, scaled from the two front-door seams) shows it through the door glass at 1,731 to 1,807; c164 and c165 put the glass's own front edge at 1,730 and 1,763 |
| Rail and corner | 72 deep below the roof edge back to the B-pillar; the corner 85 round outside, 15 inside | c003 (1.45 mm/px). Overlay of the built parts on c003 (review/whole/c003_overlay.png): the upright and rail lie on the photo's, the rail ~25 high, the camera's known roof bias |
| A-pillar post | rear face 1,395 at the dash (1,219 high) to 1,496 at its corner (1,401); front and inner sides on the sight planes of its outline in int-athens-1, -2, dgRcedIkNOM-32 and the 6:16 frame | int-athens-1 and -2 re-solved with the focal length from their EXIF (iPhone 16 Pro ultra-wide, 14 mm equivalent: 776.5 px at 1,920 x 1,440, 1,035.4 at 1,920 x 2,560; measure/console/athens1x, athens2x, athens1-pillarx, -postx, -stripx): the cameras move 50 back and the post's planes 4 to 8 mm, so the post fitted before stands. From c003 it is hidden behind the mirror, as in the photo |
| Side glass seen from the driver's seat | 1,235 high at 865 back, 1,310 at 1,084, 1,357 at 1,228 | athens1-stripx (was 947 / 1,136 / 1,260 with the guessed focal) |
| Front door glass | starts at the upright (1,802); the triangle ahead is body glass with the front side windows' tint | c166, dgRcedIkNOM-12 |
| Mirror, rechecked | base underside 0 to 5 above the door top (model 10), base 68 to 70 tall (63), top 194 above the underside (190); tip within 10 to 18 of the photo's from the seam | c003 (measure/doorframe/c003-mirror.md) |

Superseded (2026-10-04): the post moved 250 back to meet the upright. That rested on int-athens-1's camera being
250 too far forward; with its real focal length it moves only 50, so the post went back where the photos put it.
The two are separate: between them, above the mirror, the triangle shows the cabin.

Checked against the whole cabin: the published interior dimensions hold (measure/cabin/audit.md); the head room ties
the seats where they are, and the dash, yoke and screen sit on the interior photos. Still a guess: the upright's and
rail's depth into the cabin (50). The side views see it edge-on (c003 at 12 degrees gives the same 72 to 75 width as
c165 square on) and no cabin photo reaches it (it projects off the side of every interior frame).

## Door mirrors, measured (2026-10-03)

Tesla folds the mirrors when the truck locks, and most parked street photos show them folded: c022, c059,
c086, c090, c108, c130, c150 and c163 show a long low wedge (1.75 to 1.8 times as long as tall), its glass
turned toward the window (so the glass is plain to see from the driver's seat, dgRcedIkNOM-14). Unfolded
(the published 2,413.3 span, and how the truck is driven), c003 (an open Ride & Drive truck) and the moving
trucks c134 and c137. The model is unfolded.

Measured through c003's solved camera with the fit's own bias put back: the door seam there reads 70 mm too
far back and the roof 26 mm too high (measure/c003-camcheck.md), so both were applied, and the projected
outline then lies on the photo's within about 10 mm all round.

| What | Value | Source |
|---|---|---|
| Outer edge | 1,206.65 off the centreline (half the published span) | Manual |
| Width | 190, inner face 1,016.65 off the centreline; an arm from its inner front down onto the door top at the window | c134 (188 at 0.69 px/mm), dgRcedIkNOM-04 |
| Front tip | 99 behind the front door seam (s 1,602) | c003 89, c059 94, refined on the c003 overlay |
| Length | 254 at the base, glass face to tip | c003 |
| Height | base underside 10 above the beltline; base 63; top 190 above the base's underside (1,422 at spec ride) | c003, corrected 26; c059 1,431 |
| Side outline | flat top over the glass, then down 38 degrees to a low tip at the front | c003 |
| Front outline | tall inner edge, 30 mm flat top, the outer face falling to a 95 mm outer end | c134, c137, c150 |
| Glass face | upright, turned 12 degrees toward the driver (inner end 40 forward), leaning 45 forward at the top; same outline as the front (tall inner edge), the glass inside an 8 mm frame | c003 overlay; c068, c089, dgRcedIkNOM-11, -14 |

Fold check: the folded width (2,200.7) brings the outer edge in 106 mm, which a 190 mm wide housing does at
about 64 degrees; folded at that angle the side view lengthens to about 300 to 330, as the street photos show.

Still guesses: the arm's shape under the base (it is mostly hidden), the edge rounding (the facets are left
sharp). The housing is two-tone: a satin grey cap (sRGB 70 to 110 in c003 and dgRcedIkNOM-04; built 78, 80, 84)
over the black base and arm, split at the base's top.

## Triangle budget (2026-10-11)

59,046 triangles against the 60,000 budget (was 93,862). The rounded cabin parts are bevelled with 2 segments
instead of 3 (the yoke 3, the A-pillar trim 3 instead of 4) after merging each flat face into one polygon; the
yoke's parts are tessellated at 0.8 mm and 0.35 rad (were 0.3 and 0.2), the seats at 0.18 rad (0.12), the tyres
at 0.22 rad (0.16), the rims at 1.5 mm and 0.35 rad (1.0, 0.25), the cladding at 1.0 mm and 0.5 rad, and the
scroll wheels have 32 knurl teeth (48). Renders of the yoke close up, the seats, a wheel, the whole truck and the
three interior photo views show no visible change (mean pixel difference 0.5 to 1.4 of 255). meshopt's global
simplify was tried and rejected: it dims the thin ambient strips.
