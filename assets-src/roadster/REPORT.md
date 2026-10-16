# Roadster: first build report (2026-10-16, the night after the reveal)

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
