# Cybertruck: building-3d-replicas test report (skill then called build-3d-model) (2026-10-03)

A test of the building-3d-replicas skill on a large, metallic object. Evidence, structure and parameters are
in spec.md; the last review round is review/round-2 (sheet.png, report.md); the fit is fit/report.md.

## Fit per photo

Three photos fitted together: shared shape parameters (29), one camera per photo, plus a ride offset per
photo (see "Structure added during the fit").

| Photo | View | IoU | Outline error (mm) | Landmark error (mm) | Dark parts IoU | Camera height (mm) | Ride offset (mm) |
|---|---|---|---|---|---|---|---|
| c059 | left side, bare wheels, street | 0.912 | 51 | 16 (wheel centres, tyre contacts) | 0.66 | 363 | -53 |
| c003 | right side, aero covers, show floor | 0.910 | 69 | 27 (wheel centres, tyre contacts) | 0.63 | 543 | -60 |
| c150 | front, car park | 0.923 | 41 | 0 (light bar) | 0.46 | 2994 (at the prior's limit) | +6 |

Before the shape fit (same cameras, start parameters) the IoUs were 0.903, 0.904 and 0.929; the outline
errors 57, 69 and 38 mm. The fit improved the side photos a little and the front one not at all.

## Size against Tesla's published numbers

The fixed dimensions are Tesla's, so the model matches them by construction:

| | Tesla (Owner's Manual) | Model |
|---|---|---|
| Length | 5,682.9 | 5,682.9 (light bar to rear bumper) |
| Width with mirrors | 2,413.3 | 2,413.3 |
| Width without mirrors | 2,031.6 | 2,031.6 across the flares; 2,065 across the tyre sidewalls (see below) |
| Height, Medium | 1,793.8 | 1,793.9 |
| Wheelbase, track | 3,635.0, 1,772.0 | same |
| Ground clearance, Medium | 257.0 | 257.0 |

What the photos say about those numbers, independently:

- **Ride height.** Both side photos solve to the body sitting 53 and 60 mm lower on its wheels than the
  Medium setting. Tesla's Entry/Exit height is 55 mm below Medium, the height a parked truck kneels to.
  The fit found it without being told, from the outline alone.
- **Scale.** With the wheelbase fixed, the measured wheel centres and tyre contacts land within 16 to 27 mm
  in both side photos, so the photos agree with Tesla's wheelbase, wheel size and ride height to about 1%.
- **Track versus width.** Track (1,772) plus the 285 mm tyre gives 2,057 to 2,065 mm across the sidewalls,
  wider than the published 2,031.6. The front photo shows the tyres just inside the flares. Unresolved:
  either Tesla's width is taken across the flares above the tyres, or the real sidewall is narrower than
  its nominal 285 mm. Left as is and written down.

## Remaining differences, and which are guesses

Measured or fitted (from the photos):

- Windshield base 954 mm behind the light bar at 1,374 mm high (start value from Tesla's drawing: 1,150
  and 1,410). It sits at the edge of its range: the windshield may start further forward still, or the
  hood and windshield are one plane with a smaller break than modelled. Needs a top view to settle.
- Roof apex 2,426 mm back; tailgate top 1,320; beltline 1,209 to 1,337; roof 1,215 wide at the apex,
  deck 1,819 wide at the tail; arches 1,003 high with a 659 mm flat top; flares stand 54 mm proud.
- The front photo's camera came out 3 m up and pitched 9 degrees down, which the photo doesn't support
  (the hood is seen almost edge-on). Its cut-out includes a sign post touching the roof, and cars on both
  sides touch the outline. **Treat the widths it fitted (roof_half, nose_flat_half, tuck, shoulder_drop)
  as unreliable.**

Guesses (no photo constrains them):

- Underside, inner wheel wells, back of the wheels, brakes: placeholders.
- Parts of the interior: see spec.md, "Interior, measured", "Still guesses".
- Aero cover: six raised blades and a hex boss; the real cover's facets are only roughly matched.
- Rim: seven Y-spokes counted on c025 and c143; spoke widths are by eye.
- Panel gaps (4 mm), light bar cross-sections, mirror depth, wiper, tyre tread pattern.
- Tyre squash 15 mm (fitted, but only through the wheel landmarks).

Known faults in the model:

- The rear bumper was a prism; measured and rebuilt on 2026-10-04 (spec.md, "Rear, measured"): two tiers, the
  plate pocket and step, reverse lamps, hitch. Still guessed: how far the lower tier is set in, the pocket's
  side walls (vertical here; c069 hints they slant). (The front bumper's face was measured on 2026-10-04.)
- The cladding steps on the flares (their bevelled outer faces) are flat bands.
- The tonneau's rails are dark panels on the deck either side of the slats; the band's end caps are built (2026-10-04).
- Review renders through the photo cameras don't apply the per-photo ride offset, so the side pairs on
  the sheet show the body 50 to 60 mm higher than the fit did.

## Added after the first headset test (2026-10-03)

- Exterior: the door-release buttons at the foot of each window's rear pillar (Owner's Manual, Doors), an
  opaque black B-pillar between the windows (it was see-through glass), amber and red side markers.
- Interior: bolstered seats with pointed headrests and a three-place rear bench, door armrests and pull
  handles with the door-open button on top, window switches, speaker grilles, a yoke with a wide centre pad
  and button pads, the centre and rear screens showing a drawn display (no logos), a console with
  cupholders and an armrest, pedals, floor mats and a rear-view mirror. All placed by eye from the video
  frames: guesses, not measurements.

## Budget (vehicle on Quest)

26,240 triangles after the interior rebuild (limit 60,000; it was 41,196), GLB 372 KB after build.sh (limit 3 MB),
textures up to 2,048 px. The flat-faceted interior costs far less than the filleted blocks it replaced.

## Bare stainless steel: how the cut-out was solved

Colour can't separate it: the steel takes the colour of whatever it reflects (teal wall, red carpet, sky),
and the HSV cut-out the skill used had nothing to hold on to. What worked, in fit_silhouette.py's
`grabcut` mask:

1. A first GrabCut from a rectangle round the truck, with everything below a ground line through the tyre
   contacts marked background. This gets most of the truck but loses the sail where it reflects the sky,
   and keeps the shadow under the truck.
2. The camera is solved on that rough cut-out, held by measured landmarks (wheel centres and tyre
   contacts, weighted 5x) so the rough outline can't drag it.
3. GrabCut again, seeded by the model's own silhouette through that camera: inside it shrunk by 2.5% of
   the truck's size is sure truck, outside it grown by the same is sure background, the band between is
   decided by the photo's colour statistics and edges. Twice. This recovers the sail and drops the shadow.
4. Inside the outline, the dark parts (cladding, tyres, glass) are cut out by brightness to match the
   model's dark parts. Otsu's threshold failed for the same reason as colour (it split the steel itself,
   which goes dark where it reflects shade); a fixed limit worked: black parts read below 40, steel above
   90 in every photo, limit 60.

## Measuring the interior (2026-10-03): what worked and what didn't

- scripts/3d/measure.py was checked on c059 from the wheels alone: roof peak 1,732.9 against Tesla's
  Entry/Exit 1,738.8 (measure/c059-check.json, a test with an expect block).
- With c003's fitted camera, the near-side wheel centre lands within 4 mm (measure/c003-camcheck.json).
  Its roof peak showed the truck in that photo sits 34 mm below Medium, not the fit's 60.
- Measuring the cabin through c003's open windows failed: the fitted camera's height is loose, so points on
  the far side of the cabin came out 300 mm too high, and the features seen through the window could not be
  identified with confidence. Those numbers were discarded.
- The walkaround video frames are from a wide phone lens close to the parts, with few known references in
  view. Published interior sizes beyond the manual's head, leg, hip and shoulder room are scarce (the 18.5 in
  screen is the only firm one).
- What worked: the Owner's Manual's interior renders (Tesla's CAD). A near-orthographic seat side view,
  scaled by the manual's head room, and the dash view, scaled by the 18.5 in screen, gave the seat, yoke,
  screen, armrests and console positions (spec.md, "Interior, measured"). The model's dash, rendered from a
  similar camera, matches the manual's picture in layout.

## Interior rebuilt part by part (2026-10-03, second pass)

Every part was rebuilt as flat facets (intersections of side and front outlines, prisms on measured planes),
then rendered through matching cameras and compared side by side with the manual's pictures and the video
frames (scripts/3d/render_cams.py, review/interior/cams.json; rounds r1 to r5 in review/interior/). Numbers
and sources are in spec.md, "Interior, measured".

Differences found and fixed:

| Round | Compared with | Difference | Fix |
|---|---|---|---|
| r1 | dash render | yoke: one lower opening, no pad or pods | extrusions went down from faces wound the other way; every extrude now gets an explicit direction |
| r1 | dash render | white dash block hid the screen | the block stood behind the screen; its front set 10 mm proud of the shelf lip, the screen 10 mm further back |
| r1 | dash render | two dark bands across the windshield; the manual shows clear glass to the header | the header measured at 1,739 (not 1,826, which is the dome light), visors stowed under it |
| r1 | frame dgRcedIkNOM-17 | door switches light grey | black, as on the truck |
| r2 | dash render | dash faces reached 150 mm toward the driver | their hidden depth was on the wrong side of the face; now into the dash |
| r2 | yoke render | lower openings too small, wrong band | the openings' inner edge follows the V pad, the spoke band's lower edge at -8 to -12 |
| r2 | dash render | A-pillar trim too wide | its reach from the crease 75 to 45 mm |
| r3 | console render | one long armrest-height box | low cupholder tray, lid, taller rear block in the render's proportions |
| r3 | rear bench render | integral headrests, flat backs | separate headrests 25 mm above the backs, recessed inserts |
| r3 | rear seat | rear H-point at the front's height | computed from the rear head room (738) |
| r4 | seat 3/4 render | shoulders stepped in to the headrest | straight taper from the shoulders into the headrest |

Remaining differences (seen in review/interior/r5):

- Cushions and backs are flat slabs with sharp edges; the real ones are padded with rounded front edges
  and stitched panels (normal maps would carry the stitching cheaply; not done).
- The front seat backs seen from behind are plain; the real ones have a moulded back panel with a pocket.
- The rear centre armrest is stowed; the manual shows it down with two cupholders.
- The console's lower body: the manual's is narrower at the bottom with a horizontal crease; ours has one
  flare.
- The overhead console is a plate; the real one is a V of two arms with the drive-mode buttons and the
  cabin camera.
- No seat belts, A-pillar tweeter grille, coat hooks or USB ports.
- Headset test of this pass: not yet done (the page loads in a headless browser without errors, 120 fps
  on the desktop, doors open with their trim).

## Third pass: light, rounding, materials, seat details (2026-10-03)

After the first headset test the cabin looked crude. In the app it was lit evenly everywhere (sky light, sun and
probe don't know the cabin is enclosed) and every part was a sharp-edged flat colour, so blocks read as
silhouettes. Fixed:

- **Baked light** (assemble.py, `bake_cabin`): Cycles DIFFUSE bake, direct and indirect, from a white sky with
  the glass hidden, 512 samples, into one 2,048 map on a `light` UV set (smart project, packed concave, 38%
  coverage), smoothed within each island (blurred light over blurred coverage, so the empty space round an island
  doesn't darken its edges) and remapped by a square root. Exported as the glTF occlusion map; the app sets
  `ambientTextureImpactOnAnalyticalLights = 1` so it dims the sun and sky light too.
- **Rounded edges** on padded and moulded parts (Bevel, 3 segments, 25 degree limit, hardened normals; the
  smooth-by-angle modifier is removed first or it marks the bevels sharp again).
- **Materials** from the walkaround frames: leather, suede, carpet normal maps (textures.py); the dash top
  lighter. `gltf-transform optimize` now runs with `--palette false`: the palette step merged textured materials
  and renamed the glass, so the app's see-through-from-inside rule stopped finding it.
- **Seats**: piping, V seams, the map pocket; the rear armrest down with cupholders; seat belts.

Budget: 30,721 triangles (limit 60,000), GLB 1.74 MB (limit 3 MB; the normal maps and the light map are most of it).

Then: padded crowns on the seat inserts (cushions and backs, front and rear; their parts are tessellated at
4.6 degrees a facet so the curve survives), and the overhead console's V (strip with the drive-mode keys, camera
pod, arms) on the mirror-mount housing, with a reflective mirror face. Review: review/interior/r7 and the
dash render pair. The strip was first built through a point 22 mm inside the housing and vanished; it is now
placed on the housing's cabin-side face.

Budget: 32,941 triangles, GLB 1.77 MB.

Then: the front seats' bolsters turned in toward the occupant, tweeter grilles on the A-pillars, the rear USB-C
ports, the dash shelf's woven finish (review/interior/r9). 33,405 triangles, GLB 1.94 MB.

Remaining differences (before the bolster pass):
the housing reads thinner than in the dash render because the windshield header sits about 20 px lower in our
render of that camera (the header measurement may be slightly off); no coat hooks, USB ports or tweeter grille.
Headset test of this pass: not yet done.

## Console top (review/console)

A headset screenshot showed the console as a flat slab with two separate 8-sided holes and the charger pads
standing up from it like tombstones. Compared with the manual renders through cameras near theirs
(`review/console/cams.json`; r1 to r6 beside `before`), it was rebuilt:
- r1 to r3: a deep charger well with the pads lying on its sloped front wall, a rib between them and a lip at
  their foot; the cupholders joined into one pocket over a lower bridge, with grip tabs.
- r4: the real cupholders are chamfered octagons, not round (886D0FDA, read wrongly at first), 80 x 87 and
  spread to 0.89 of the width. The top is an upper band in the white trim wrapping 60 down the sides; the dark
  body steps in 10 under it (the crease). The lid is a thick box (0.38 of its width): 90 above the rim.
- r5, r6: the cupholder pod sits right in front of the lid, and the well is about as long as the pod, so the
  lid starts at 1,795 (was 1,880) and is about twice as long as wide, as in 34C29DB3.
- r7: in the headset, from the driver's seat the 90 lid hid the whole cupholder pod and the white band read
  as a white box. A CC0 photo of a real truck from the driver's seat (refs/web/int-athens-3.jpg, Wikimedia
  Commons, Mpelas199) showed what the renders could not: the top is satin silver with only a thin edge down
  the black sides, the well is lined in dark felt (no separate pads show), the cupholders are one pocket
  pinched by faceted wedges, and the lid is light grey padded leather standing only ~25 above the rim, level
  with the door armrests. The manual's white band is a white-trim version; the 90 lid came from the open
  lid's thickness, part of which drops into the bin when closed. Lesson: a photo of the real object from
  where the visitor sits beats renders read for ratios.
Still open: every console size scales from its width (+-146), a guess; no picture with known reference points
shows it, so none is a solved measurement.
