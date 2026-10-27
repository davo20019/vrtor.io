# The Great Pyramid of Giza (Khufu, G1): spec

Served at vrtor.io/giza (apps/giza). Unlike the other subjects there is no GLB: the pyramid is generated in the
browser from `apps/giza/src/survey.js` and `levels.js`, which hold every size with its source. The survey itself,
with page references, is `refs/survey.md`; Petrie's course table is `refs/petrie_courses.csv`.

Frame: Petrie's own (P §35 note 1). Origin at the centre of the base on the pavement; x east, y up, z north, metres;
axes along the pyramid's sides (3' 43" anticlockwise of true north, P §21).

## Measured (used as published)

| What | Value | Source |
|---|---|---|
| Base, casing at the pavement | 230.348 m (9068.8 in) | P §21; Dash 2015: 230.363 m |
| Face angle | 51° 52' | P §25 (adopted mean) |
| Original height | 146.71 m | P §25 |
| Course levels, all 203 | N.E. corner tops | P Pl. viii via Birdsall 2003 (`levels.js`) |
| Core recess behind the casing | 0.856 m at the corners on the pavement; 1.81 m mean at course 201 | P §26, §25 |
| Hollowing of the faces | 0.94 m deeper at mid-face (north face) | P §26 |
| Casing stones in place | 1.495 m high, 1.575 m deep on top, 2.743 m at the foot | P §26 |
| Pavement | 0.53 m thick | P §27 |
| Entrance (doorway floor) | 16.972 m up, 101.854 m N, 7.290 m E | P §35, §64 |
| Chevrons | 50° 28', 0.838 m deep; lengths below 107.6 / 119.25 in, on top 167.7 / 185 in | P §34 |
| Descending passage | to -29.997 m at 7.772 m N; 1.055 x 1.200 m | P §30, §36 |
| Lower passage, subterranean chamber, dead end | walls, roof -26.82 m, floor 155 in below roof | P §37, §64 |
| Ascending passage | 4.569 m at 76.614 m N to 21.656 m at 41.321 m N; 1.057 x 1.201 m | P §38, §39 |
| Plugs | from 74.19 to 252.7 in up the passage; 1.57, 1.67, 1.0 m | P §38; W (Dormion) |
| Girdle stones | every 10 cubits | P §38 |
| Queen's passage | floor 856 to 854 in, roof 902 in, step to 834.9 in at 319.8 in N | P §40 |
| Queen's Chamber | 5.229 x 5.752 m, walls 4.686 m, ridge 6.226 m, N.E. corner 2.591 m N, 7.823 m E | P §41, §42, §64 |
| Niche | 1.041 m deep, 5 stages, 0.640 m S of the ridge | P §43 |
| Grand Gallery | 41.321 m N / 21.656 m to 1.567 m S / 42.901 m; 2.093 m wide; ramps 0.606 m; 7 laps of 20.55 in in all; 8.6 m high; roof slabs at 28° 11' | P §30, §45, §46; W |
| Great step | face 1 cm S of centre, top 43.030 m | P §46 |
| Antechamber | 2.954 x 1.651 x 3.793 m; granite from 126.6 in S; leaf 0.4 m thick, 1.4 m below the ceiling | P §47, §48, §50 |
| King's Chamber | walls N 8.397 m S, S 13.640 m S, E 7.750 m E, W 2.736 m W; floor 42.997 m; ceiling 48.836 m; 5 courses of 1.195 m; 9 beams | P §52, §53, §55 |
| Coffer | outside 2.276 x 0.978 x 1.049 m, inside 1.983 x 0.681 x 0.874 m; N.W. corner 49.5 in from N, 53.3 in from W | P §58, §59 |
| King's Chamber shafts | inlets 21 x 14 cm, 2.48 / 2.49 m from the E wall, 0.91 m above the floor; N level 2.63 m then 32.6°, S 45° | G; W (Dormion) |
| North Face Corridor | 2.02 x 2.18 x 9.06 m, 0.84 m behind the chevron, floor about 20 m | SP23 |

## Estimated (Unknowns)

- **Core blocks.** Lengths 0.9 to 2 times the course height plus 0.3 m, recesses, wear (5 to 22 cm on the top
  arris), joints (1 to 6 cm), lean and bulge are seeded random within ranges read off photographs; which blocks are
  missing follows a noise field, more often low down and at the ridges. Not measured block by block.
- **Courses across a face.** Petrie levelled the corners; the courses dip by up to 1° across the faces (P §24).
  Here each course is level at its N.E. corner value.
- **Hollowing on the E, S and W faces**: Petrie gives only the north face's 0.94 m; the same is used for all four.
- **Chevrons**: now measured (refs/entrance.md): their outline from the ScanPyramids 2023 laser-scan drawing and
  Maragioglio & Rinaldi's dimensioned front view, tied to Petrie's frame at the passages' junction (checked three
  ways); face at z 91.1 (M&R's drawing gives 90.1). Still estimated: the blocks' upright outer ends (from the level
  bed, P §34), and the notch's width beside them (one block, 1.1 m) and under them (2.6 m).
- **Al-Ma'mun's tunnel**: its mouth on the axis (Vyse, SP23), 27 m south, east some 20 ft to the descending passage
  (P §177), the cavity west of the plugs (P pl. ix), floor near 6.2 m (the 2023 detectors in it; M&R say above the 7th
  course). Still estimated: its section (1.9 x 2.1 m; the SP23 render suggests up to 2.7 x 3 m) and the exact bend.
- **Today's stair** to the tunnel, the boardwalks, handrails and lamps are modelled after photographs, not measured.
- **Casing stones in place**: their extent along the side (-6.5 to +5.5 m) and the pavement's reach in front.
- **Gallery floor gap**: the floor starts where it clears the Queen's passage roof plus 0.5 m of slab (3.9 m up the
  slope).
- **Ramp holes**: now measured, all 56, from Smyth's survey (refs/gallery-kings.md, measured.js). Still estimated: the
  height of the stones let into the walls above them (not measured by anyone; here at the ramp's top).
- **Antechamber**: portcullis slot widths and spacing; the low passages' height (1.10 m).
- **King's Chamber joints**: now measured on every course of every wall (Smyth; Aiton and Inglis for course 4; Petrie
  for the north and south top courses), each course scaled to the wall. Smyth's tables give 101 blocks, not the
  usual 100; one stone is unaccounted for.
- **Subterranean chamber floor**: rough steps rising west, from Petrie's description (P §37), not a survey.
- **Relieving chambers** (see-through): now measured: levels from Vyse's and Perring's tables, matching the 2024
  laser survey's section to 0.02-0.17 m; plans from Vyse (refs/above-kings.md).
- **Big Void** (see-through): through the four centres triangulated in Morishima et al. 2017 (fig. 2), each uncertain by
  about 5 m; its section ("comparable to the Grand Gallery") and whether level or inclined are not known.
- **Neighbours**: now from Petrie's triangulation of the whole site (P §19), converted to this frame (checked against
  his side lengths and centre distances to under 3 cm), base levels from Perring's levelling (refs/neighbours.md).
  Still estimated: the height of Menkaure's granite casing on its east face (taken as the north's 7.87 m).
- **Not modelled**: the well shaft (only its two mouths), Davison's passage, the Queen's Chamber shafts beyond 3 m,
  the boat pits, the queens' pyramids, the temple and causeway.

## Materials

Photo-scanned CC0 surfaces (refs/SOURCES.md), graded by `photo_textures.py`:

- Core: Poly Haven rock_05, graded to the core's colour measured in a CC0 photograph of the north face
  (159, 131, 97 sRGB in sun), less a quarter of its saturation and at 0.92 of its value for the light.
- Fine limestone (passages, casing stones, Khafre's cap): Poly Haven rock_01 at (214, 202, 180); as built, tinted
  whiter (Tura limestone, fresh).
- Granite (King's Chamber, antechamber, plugs, coffer): ambientCG Granite006B at (138, 100, 88).
- Sand: Poly Haven sandy_gravel_02 at (206, 178, 136). Wood: Poly Haven brown_planks_09.

## Review

- Checked through every tour stop in the browser: exterior from the north, the N.E. corner, the casing stones, the
  entrance, the tunnel, the ascending passage, the gallery, the step, the antechamber, the King's and Queen's
  Chambers, the subterranean chamber and the top; as built; seen through.
- Budget: about 120k triangles in the far shell (one draw), up to about 50k in the blocks near you, 22.5k inside.
- **Headset test still to do.**
