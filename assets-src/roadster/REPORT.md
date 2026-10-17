# Roadster: build report

## Round 6 (16 October): every detail against the reveal

Asked to make every detail match what is published. Still no dimension, wheel or tyre size anywhere (searched 16
October: Wikipedia, Electrek, paultan.org, Motor Illustrated, The Autopian, TechCrunch, Top Gear); new evidence was
the reveal's livestream (refs/video/: the walkaround with both doors open, a door opening, the wing raised, front and
rear close-ups) and more coverage photos (refs/news2/: the diffuser close). Measurements: measure/README.md.

What changed, each against its evidence:

- **Measured instead of fitted.** Nine features the outline can't see (the nose corners, the windshield's corners,
  the side window's point, the rear glass's corners, the tail's corners, the rear light bar's ends) marked in two to
  six photos and solved with the photos' cameras (tools/bundle.py, 11.5 px rms). They are cad.py MEAS and landmarks
  for the fit. Two mistakes caught on the way: a misread coarse grid (300 px), and one-sided marks in the top view,
  which made the front 75 to 105 mm too narrow.
- **Front**: a flat hood between two straight seams, flat facets from the seams up to the fender ridges, the
  headlights in the facets' lower points, a flat carbon face under a level light bar, a thin splitter lip, the frunk
  and hood seams cut. Round 5 had a rounded front with its crest 140 mm too wide and 70 mm too high.
- **Rear deck**: the rear glass a shield between narrow fins, the side windows' tails between fins and haunches, the
  haunches one plane down from the fins (round 5: a high deck, 130 mm too high outboard), the glass ending square at
  the stowed wing's seam.
- **Tail**: the gloss light housing, white trim, pale rear face with the plate (round 5: all black below the bar),
  carbon corners with red reflectors, and an open diffuser: shelf, nozzles, four fan bays, strakes, end plates.
- **Side**: the black trim with the amber marker set in it; the doors' shut gaps no longer open a slot.
- **Wheels**: six open spokes of two gunmetal arms with bronze blades, light satin discs, a six-lobed hub.
- **Moving parts**: scissor doors opening 80 degrees as in the reveal (round 5: 65); the active wing as its own part
  on a guessed path; a cabin (seats, dash, yoke, screen, console, lining), its sizes estimated.
- **The side photo's camera height**: the fit had it 1.7 m up; the photo shows it at the hood's height (measure/
  README.md). fit_silhouette.py now takes a per-photo `cameraHeightMm`.

| Photo | Round 5 IoU / outline (mm) | Round 6 IoU / outline (mm) | Landmarks (mm) |
|---|---|---|---|
| side | 0.926 / 32 | 0.933 / 27 | 12 |
| front | 0.920 / 32 | 0.954 / 17 | 15 |
| top | 0.974 / 17 | 0.980 / 14 | 12 |
| q34 | 0.909 / 35 | 0.922 / 34 | 21 |
| rear_high | 0.906 / 55 | 0.880 / 65 | 9 |
| front_q34 | 0.864 / 59 | 0.940 / 24 | 29 |

Sizes (fit, round 6): length 4,589, width 2,005, height 1,184, wheelbase 2,925, tyres 655 front and 722 rear across.
Across the round-6 fits the width moved between 1,990 and 2,010 and the wheelbase between 2,909 and 2,944: good to
about 1 percent. 25,752 triangles; out/roadster.glb 223 KB.

Open after round 6:
- **The door's front shut line**: the photo's leans forward from 846 at the sill to 947 at the shoulder crease; the
  model's stands at the A-pillar's foot, 55 to 150 mm behind it, because with any hinge that stands the door as in the
  reveal the door's front below the crease lifts into the fender (spec.md, "Doors"). A video of a door opening seen
  from the front would show the real hinge's path.
- **The front wheel in the front three-quarter photo**: 60 px from where the other photos put it. Either that photo's
  lens distorts, or the front track or wheelbase differs from the fit's; unresolved.
- **The high rear view's outline** fits less well than in round 5 (0.880): its landmarks fit (9 mm), and the haunches
  and fins inside the outline now match it; the camera search there finds a worse optimum than round 5's.
- **The wing's path** and **the cabin's sizes** are guesses; the paint and glass colours are not calibrated.

## Round 5: the first build (2026-10-16, the night after the reveal)

A test of the building-3d-replicas skill on an object with no published dimensions, built from Tesla's press photos
of the car revealed on 15 October 2026. Evidence and structure are in spec.md; sources in refs/SOURCES.md; the last
review round is review/round-5 (sheet.png, report.md); the fit is fit/<photo>/report.md. Published as vrtor.io/rds
(apps/rds) on 16 October 2026.

## Sizes (fitted; nothing is published)

| | Model | How it was found |
|---|---|---|
| Length | 4,580 | outlines in six photos, scaled by the plate (fit: nose_z 2,334, tail_z -2,246) |
| Width (body) | 1,984 | top view outline (half_w 992) |
| Height (roof) | 1,186 | outlines (roof_h); 1,208 before the front three-quarter photo was added, 1,223 from the side photo alone, so +-20 |
| Wheelbase | 2,965 | side view: hub landmarks (6 mm) and outline |
| Tyres | 676 front, 751 rear across | outlines (r_f 338, r_r 376); the arches hide their tops, so these are weakly measured |
| Track | 1,650 / 1,643 | set so the tyres sit flush with the body, as the top view shows (no tyre outside it) |
| Nose top / tail top | 525 / 929 | outlines |

Scale. The only object of known size is the rear plate (US, 12 x 6 in). Two checks:
- Straight rear (Roadster_91, 3,840 px): the plate is 332.5 px wide, so 0.917 mm/px at the tail; the tail is 1,846 px
  across at the light bar, i.e. 1,692 mm. The model's tail there is 1,690 mm, from the top view's proportions alone.
- Scale test (tools/scale_test.sh): every size x 0.92, 1.00, 1.08, cameras re-solved for the two photos with the plate
  as a landmark. The plate error is flat in q34 (32, 25, 26 mm) and the outline prefers 1.0 to 1.08 in q34 and 1.0 in
  rear_high (IoU 0.75 at 0.92). So the scale is good to a few percent, not to the millimetre. Only Tesla's figures can
  do better: when they publish length, width, height or wheelbase, fix them in cad.py P and refit the rest.

## Fit per photo (fit/, round 5)

| Photo | View | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| side | left side, studio (ek-roadster-02) | 0.926 | 32 | 6 (hubs, contacts) |
| front | front, studio (ek-roadster-03) | 0.920 | 32 | 0 (light bar ends) |
| top | drone, straight down (Roadster_92) | 0.974 | 17 | – |
| q34 | rear left three-quarter, desert (Roadster_90) | 0.909 | 35 | 19 (plate, hubs) |
| rear_high | rear from high (Roadster_77) | 0.906 | 55 | 18 (plate) |
| front_q34 | front left three-quarter, studio (tesla.com Roadster-08-End) | 0.864 | 59 | 25 (front hub, light bar ends) |

What went wrong along the way, and the fix:
- **Cut-outs.** GrabCut merged the studio's dark floor and background with the car's dark lower half (side) and the lit
  floor (rear_high). Fixed with a traced side cut-out (top edge by brightness, wheels and rocker from the enhanced
  shadows) and an outline traced on Roadster_77 and snapped by GrabCut in a band (tools/snapmask.py).
- **Plate corners swapped.** Seen from behind, the car's left is on the photo's left; labelled the other way, the
  rear_high camera solved to 200 m away with a 134 degree roll.
- **The top view solved end for end.** The drone shot's outline is nearly the same both ways round; with roll +90 the
  car fitted reversed (IoU 0.95 even so). Roll -90 puts the nose on the photo's left: IoU 0.976 before the shape fit.
- **The front camera yawed 8 to 10 degrees** to trade outline errors. The front light bar's two ends as landmarks hold
  it straight (now 2.9 degrees, roll 0).
- **Glass under the body.** Ruled lofts between stations 400 mm apart twist, and the body and the glass 2 mm above it
  tessellated differently, so paint showed through the glass. Sections are resampled every 120 mm and the glass is
  5 mm proud.
- **The nose was flat in plan.** Added on 16 October, the front three-quarter shot from tesla.com put the front
  light bar's ends 100 and 160 mm outside the model's. The nose curves back to its corners in plan (the top view
  had said so: half width 181 at 2,335, 394 at 2,300, 545 at 2,265), and the light bar follows its top edge from
  corner to corner. With the nose and light bar curved, that photo's landmark error fell from 106 to 18 mm and the
  top view's outline error from 22 to 16 mm.
- **Scale parameters didn't move.** Powell's 1.0 step tolerance is in parameter units: dimensionless scales stayed at
  1.0. The sizes are now parameters in mm.

## Differences still open (round 4)

- **Rear deck.** The buttresses are lower and rounder than the photo's sharp fins; their dark vents are missing; the
  deck behind the rear glass is flat where the photo has a V of facets (Roadster_74, 75, 77).
- **Nose.** The model's nose is a little sharper and its hood corners rounder than the photo's flat facets (Roadster_79).
- **Rear lower.** The fan box is a plain box; the photo has a shaped diffuser with strakes and end plates. Its black
  reads larger in the q34 render than in the photo.
- **Wheels.** Six double spokes on a light disc, simplified; the gold inserts are left out.
- **Interior.** Not modelled: the glass is tinted enough that the cabin reads dark. The interior photos (63–69) are
  enough to build it, but no interior size is known.
- **Active wing.** Not modelled (stowed in every photo used here; raised in 76, 91, 94, 99).
- **Review render, front photo.** review.py's render through the front camera looks zoomed against the photo,
  while fit/front/overlay.png (the same camera, through the fit's projection) lines up. Not investigated.

## Open items

- **The door hinge is guessed.** The doors are dihedral, carrying the side panel, side glass and their half of the
  roof glass (Roadster_78, 96, 98, 99). No photo shows the hinge. cad.py hinge(): pivot at the A-pillar foot, axis
  (0.93, -0.37, 0), open 65 degrees, chosen among 225 tried as one that swings clear of everything fixed from 10 to 80
  degrees (tools/hinge_search.py) and stands like the photos. Through the first 5 degrees the door's front edge still
  passes into the A-pillar and the fixed roof glass at its front; check_doors.py fails the build only from 6 degrees
  on (FROM_DEG). The shut lines are 6 mm with a 45 mm draft, wider than a production car's. A video of a door opening
  would settle the hinge.
- The front three-quarter photo still sees the model's lower edge (splitter, tyre bottoms) lower than the photo's,
  and the side photo's fit got worse when it was added (IoU 0.954 to 0.926; its camera's yaw moved from -88 to -82):
  the photos disagree a little on the heights, which is why the roof is +-20 mm.
- The paint, glass and trim colours are sampled from the photos but not calibrated against a neutral (review.json
  exposure -1.6 is by eye).
- Headset test at dev.vrtor.io/roadster (apps/rds) with David: not done.

## Budget

18,152 triangles; out/roadster.glb 153 KB after build.sh (meshopt); no textures. out/roadster_raw.glb is the
uncompressed build for review.py (Blender 4.2 cannot read meshopt).
