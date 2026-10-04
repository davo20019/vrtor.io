# Tesla Cybertruck (production, 2024 onward), standard configuration

A test of the build-3d-model skill on a large, metallic object. Once it is built and approved it may
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

### Body shell: one convex solid of planar facets

Every steel surface of the Cybertruck is flat, and the shell is convex apart from the wheel arches and
the black bumpers, which are separate cuts and parts. So the shell is built as the **convex hull of a
small set of named corner points** (mirrored left/right). Each parameter moves a corner; the facets
between them come out flat by construction. Facets, front to back:

1. **Front face**: a centre panel below the light bar, leaning back to the bumper top, plus an angled
   corner facet on each side (the face is chamfered in plan, c032, c150).
2. **Light bar edge**: the sharpest edge on the truck, where the front face meets the hood, running the
   full width; its outer ends turn down and back along the corner facets (c150, c001).
3. **Hood**: one plane from the light bar up to the windshield base; a narrow **shoulder facet** on each
   side drops to the fender line (c150).
4. **Windshield and glass roof**: one plane, slightly flatter than the hood (drawing: hood ~0.38, glass
   ~0.30 rise per run), up to the **roof apex**, a straight transverse edge at full height.
5. **Rear deck**: from the apex a single plane falls to the top of the tailgate (drawing: 0.14 rise per
   run). It holds the rear roof glass, then the **tonneau** (a black slatted cover sunk between the
   sails).
6. **Flanks**: flat vertical body sides from a lower crease up to the beltline. Above it the **greenhouse
   and sail facets** lean inward: narrow at the apex (roof about 1,300 wide, c150), almost full width at
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
- **Rear bumper**: black, standing out past the tailgate, with the centre step recess and the hitch
  pocket below it (c069).
- **Window pockets**: front and rear side windows, the windshield and glass roof, and the rear roof
  glass. Each is a shallow pocket holding a dark glass panel 1 mm below the steel (no coplanar faces).
  Black trim and pillars are the same panel.
- **Tonneau pocket**: from the end of the rear glass to the tail, between the sails, holding the black
  tonneau panel. Its slats come from a normal map.
- **Light bars**: front, a thin white emissive strip on the light bar edge; rear, a dark red strip
  across the full width under the tonneau (c069, c006), plus the small red lights in the rear bumper
  corners and amber marker lights at the front corners.
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
| side_tail_h | 1,259.1 | 1,200-1,320 | height of the sail's crease with the side at the tail | carried over from the side-photo fit | side |
| (tail_bevel) | dropped | | the sail now runs through the window crease (roof corner at the apex to the C-pillar base) and the tail corner, which fixes the rear top corner | c069 | rear |
| arch_top_h | 980 | 900-1,060 | top of the arch flare | c022 981 | side (wheel landmark) |
| arch_top_half | 310 | 250-380 | half-length of the flat arch top | c022 | side |
| arch_knee_h | 660 | 560-760 | where the angled side becomes vertical | c022 | side |
| arch_foot_half | 590 | 520-660 | half-length of the arch at sill level | c022 | side |
| flare_band | 75 | 50-110 | flare width seen from the side | c022 | side |
| bumper_r_h | 600 | 520-680 | top of the rear bumper | c069 | side, rear |
| bumper_r_out | 60 | 20-120 | rear bumper stand-out past the tailgate | c022 | side |
| rear_bar_h | 60 | 40-90 | height of the rear light bar band | c069 | rear (not fitted: inner feature) |
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
| Dome light under the header | 1,826 back | dash camera | (was taken as the header) |
| Overhead console | lower corners +-136 at 1,490 high, 1,578 back | dash camera | none |
| Rear-view mirror | 195 x 50, 1,464 to 1,513 high, 1,621 back | dash camera | 250 x 72 at the apex |
| Console front | 1,494 back, top 918 | dash camera | 1,480 |
| Pedals across | brake w 460, accelerator w 290 (brake outboard) | dash camera | swapped |
| Pedal shapes | brake: hanging, rounded pad 130 x 80 with eight black rubber strips, arm rising inboard into the dash; accelerator: floor-hinged, 50 x 220 with a rounded top, four strips down its upper part, hinge block on the floor | manual-interior-CC015C4E (14, 15), widths against their 170 mm spacing (3.6 mm/px) | plain boxes 120 x 85 and 55 x 220, fully metallic (read black in the footwell) |
| Front seat side profile | back's rear edge (2,447, 675) (2,493, 812) (2,626, 1,316), headrest tip 1,637 high at 2,470; front face (2,300, 760) to (2,425, 1,225); cushion front 1,765, top 742 to 760 front, 716 rear | seat side view at 4.58 | slab and box |
| Rear H-point height | 738 | rear head room (SAE H63: 8 deg line + 102) under the deck, corrected by the front's error (the same rule gives the front 745 against the measured 771) | 771 (the front's) |
| Rear backrest | 21 deg | manual-childseats-D8CE20B2, side view | 25 |
| Door armrest face | w 700 (armrest), lower panel w 727 at hip height | hip room 1,453 | w 792 |
| Door white panel crease | w 806 front, 790 rear | shoulder room 1,608 / 1,576 | flat panel |
| Console proportions | tray 1,494 to 1,795 (charger well 1,514 to 1,665, cupholder pod to 1,795), lid 1,795 to 2,330, rear block to 2,600 | the well about as long as the pod (2298443C, int-athens-3); the open lid about twice as long as wide (34C29DB3) | tray to 1,880, lid 1,880 to 2,330 (35/40/25 by eye) |
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
  dash, glovebox groove on the passenger side (B379A2C2). The face depths and the glovebox outline: **guess**.

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

### Still guesses

- Rear H-point s (3,150): set so the 21 deg backrest fits against the cab's back wall (cab_rear_s 3,700,
  itself a guess). No picture gives the rear seat's position along the truck.
- Seat, cushion and bench widths; cushion thicknesses; the seat base and stand.
- Header depth behind 1,826 (the beam is 1,739 to 1,905), sun visors (stowed under it), the roof rails'
  width, the B-pillar trim.
- Pedal depth along the truck (the dash camera's error grows near the floor), their lean (brake 35, accelerator 40 deg),
  the brake arm's path inside the dash, floor mat outlines, carpet.
- Console width (+-146), on which every console size above is scaled (measure/console/athens3.json tried to
  solve the photo's camera from the screen corners and the console's front, but its references reproject 54 px
  RMS, likely the phone's wide lens, so nothing was taken from it); the charger pads' lean and the well's
  depth; the lower body's taper (+-112 at the floor). No picture with known references shows the console, so
  these are ratios in the manual renders, not solved measurements.
- The yoke's depths: rim 30 deep and rounded 9 mm front and back (in assemble.py), pad 16 proud, pods 7,
  chin 9, scroll wheels 4. No picture shows the yoke edge-on closely enough to measure them.
- The tweeter grille on the A-pillar, seat belts, the drive-mode selector and buttons on the overhead
  console, coat hooks and dome lights: not modelled.

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
sharp), the housing's exact black (the material is the trim black).

