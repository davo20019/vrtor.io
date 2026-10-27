# Above the King's Chamber: relieving chambers and the ScanPyramids Big Void

Compiled 2026-10-27. Every number cites its source. "Derived" marks a value I computed; "measured off" marks a value I scaled from a published drawing (with how). Where sources disagree both are given.

## Frame

Replica frame (as specified): origin = centre of the base at pavement level; **x east, z north, y up**, metres.
Anchors used (Petrie 1883 §55, §64, see `survey.md`): King's Chamber (KC) floor y = 42.997, ceiling y = 48.836; N wall z = -8.397, S wall z = -13.640 (so KC centre z = **-11.0185**); E wall x = 7.750, W wall x = -2.736. Queen's Chamber (QC) floor ≈ y 21.19 (Petrie §64, N.E. corner footing +834.4 in). Grand Gallery mid-line x ≈ 7.22-7.29.

Feet are converted at 0.3048 m, Petrie's inches at 0.0254 m.

## Sources

| Key | Source | Where read |
|---|---|---|
| **V1** | R. W. Howard Vyse, *Operations Carried On at the Pyramids of Gizeh in 1837*, vol. 1, London 1840 (public domain) | archive.org `operationscarrie01howa` (OCR text and page images) |
| **V2** | Same, vol. 2, 1840, Appendix pp. 112-113 ("Davison's chamber ... Col. Campbell's chamber") | archive.org `operationscarrie02howa` OCR |
| **PT** | J. S. Perring, *The Pyramids of Gizeh from Actual Survey and Admeasurement*, part I, *The Great Pyramid*, London 1839: "Table of Dimensions of the Great Pyramid" (text p. 4, Heidelberg page 0006) and the description of Plates III-IV (text p. 2, page 0004) | Heidelberg, doi:10.11588/diglit.3557, OCR pages |
| **P3**, **P4** | Perring, same, **Plate III** "King's Chamber and Chambers of Construction No. I" (Fig. 2 section looking west, Fig. 3 section looking east: N-S sections) and **Plate IV** "... No. II" (Fig. 1 plan of Davison's Chamber, Fig. 2 section looking north, Fig. 3 section looking south: E-W sections). Both drawn at the same scale bar, which I measured at **29.52 px per foot** on Heidelberg's full-resolution IIIF images (`perring1839bd1:Tafel_05.jpg`, `Tafel_06.jpg`; 30-ft bar, ticks fitted). Check: KC drawn 563 px high = 19.07 ft (Vyse/Perring 19 ft 1 in) and 1000-1010 px long (34 ft 3 in). | IIIF images, measured by edge detection along rows/columns |
| **Pe** | W. M. F. Petrie, *The Pyramids and Temples of Gizeh*, 1883, §62-63 [pp. 91-94] | Wayback copy of R. Birdsall's edition, `.../petrie/c7.html` |
| **IGP** | A. Ciavatti, Z. Hawass, B. Chazaly, E. Laroze, F. Monnier, "Inside the Great Pyramid (2024)", *Bulletin archéologique des Écoles françaises à l'étranger*, Égypte, 2025, doi:10.4000/14fx6, **Fig. 4** "Vues en coupe de la chambre du roi et des chambres de décharge – version préliminaire" (F. Monnier, from the 2024 laser scan + photogrammetry, 11 M points). Elevations NORD / EST / SUD / OUEST with a 5 m scale bar. | `https://journals.openedition.org/baefe/13556`, figure `docannexe/image/13556/img-4.jpg` (2000 x 848 px). Scale bar 142 px = 5 m → **28.3 px/m** (±1 %: KC drawn 165.5 px high = 5.85 m vs Petrie 5.84; its widths read 1 % short). One pixel ≈ 3.5 cm. The figure is labelled preliminary; the monograph is due 2026. |
| **SP17** | K. Morishima et al., "Discovery of a big void in Khufu's Pyramid by observation of cosmic-ray muons", *Nature* 552 (2017) 386-390, doi:10.1038/nature24647; full text arXiv:1711.01576 | arXiv PDF (13 pp.), Fig. 2g-i rendered at 600 dpi and measured |
| **SP23** | S. Procureur et al., *Nat. Commun.* 14 (2023) 1144, doi:10.1038/s41467-023-36351-0 | Europe PMC full text PMC9981702, Fig. 1 |
| **EGP** | A. Bross et al., "Tomographic Muon Imaging of the Great Pyramid of Giza", arXiv:2202.08184 (2022) | arXiv PDF |
| **W** | English Wikipedia "Great Pyramid of Giza" (wikitext 2026-10-27), only for what it attributes to Maragioglio & Rinaldi | |

Not obtained: Maragioglio & Rinaldi, *L'architettura delle piramidi menfite* IV (1965), except one citation via W; Dormion 2004; Smyth's *Life and Work* measures (his Plate XIII in *Our Inheritance*, 1877, is schematic only).

---

## 1. Relieving chambers ("chambers of construction")

### 1.1 Construction (qualitative, primary)

- Five spaces, lowest to highest: Davison's (1765), Wellington's (30 Mar 1837), Nelson's (25 Apr 1837), Lady Arbuthnot's (6 May 1837), Campbell's (27 May 1837) (V2 p. 112; PT p. 4).
- Each floor is the rough upper side of the granite beams that form the ceiling below; the beams run N-S across the chambers; only the undersides (ceilings) are dressed (V1 pp. 205-206; PT p. 2; Pe §62).
- N and S sides: granite blocks in the lower chambers, limestone in the upper; blocks "two or three feet high" (Pe §62). Wellington's and Davison's N and S walls granite, E and W limestone (V1 p. 206). Nelson's N and S sides "not entirely" granite (V1 p. 235), granite on limestone packing (Pe §63). Arbuthnot's: N and S supports all limestone (Pe §63), "greater proportion of calcareous stone" (V1 p. 256). Campbell's: everything but the floor is limestone (V1 p. 278).
- E and W ends: two great limestone walls, independent of all the granite, between which the chambers stand unbonded (Pe §62). They have sunk up to 3 in relative to the floors at the 4th chamber (Pe §63). Their **thickness is not given by any source read**; IGP Fig. 4 shows the beams ending inside them but does not section the walls. Petrie calls the top chamber's end walls "merely the masonry of the core" (Pe §63).
- Ceiling beams per layer, counted on the IGP Fig. 4 NORD and SUD elevations (my count of joints; confidence medium): KC roof (layer 1) **9**; Davison's roof (2) **8**; Wellington's roof (3) **9** (V1 p. 206 also says "nine blocks of granite" for Wellington's ceiling); Nelson's roof (4) **9**; Arbuthnot's roof (5) **8**.
- Campbell's roof: inclined limestone slabs "like the Queen's", **eleven slabs ... twelve feet three inches long** (3.73 m), resting "upon a low wall about three feet high" (0.91 m) that takes up the floor's unevenness (V1 pp. 277-278). IGP NORD/SUD show 11 slabs along each slope (12 joints; my count). Holes in the floor for temporary timber props (V1 p. 278; Pe §63; PT p. 2 "Y Y, Fig. 3, Plate III"). Slabs separated at the apex by 1.55 in (39 mm) at the E end and 1.0 in (25 mm) at the W end (Pe §63).

### 1.2 Vyse/Perring tabulated dimensions (primary; V2 pp. 112-113 = PT p. 4, identical)

| Chamber | E-W | N-S | Height ("varies from") |
|---|---|---|---|
| King's | 34 ft 3 in (10.44 m) | 17 ft 1 in (5.21 m) | 19 ft 1 in (5.82 m) |
| Davison's | 38 ft 4 in (11.68 m) | 17 ft 1 in (5.21 m) | 2 ft 6 in - 3 ft 6 in (0.76-1.07 m) |
| Wellington's | 38 ft 6 in (11.73 m) | 17 ft 0 in (5.18 m) | 2 ft 2 in - 3 ft 8 in (0.66-1.12 m); V1 p. 206: average about 3 ft 8 in |
| Nelson's | 38 ft 9 in (11.81 m) | 16 ft 8 in (5.08 m) | 2 ft - 4 ft 10 in (0.61-1.47 m) |
| Lady Arbuthnot's | 37 ft 4 in (11.38 m) | 16 ft 4 in (4.98 m) | 1 ft 4 in - 4 ft 5 in (0.41-1.35 m) |
| Campbell's | 37 ft 10 in (11.53 m) | 20 ft 6 in (6.25 m) | "in the centre" 5 ft 10 in - 8 ft 7 in (1.78-2.62 m) |
| KC floor to roof of Campbell's | | | **69 ft 3 in (21.107 m)** perpendicular |
| Passage to Davison's | length 24 ft 9 in (7.54 m) | | |

The secondary summary you had is **confirmed verbatim** against V2 and PT. Vyse's "height varies" is floor roughness (beam tops), not ceiling variation.

Petrie's plan dimensions of the rough masonry, inches (Pe §62 [p. 91]): Top: N 462-470, S 468.4, "W" 247 (between the slab springings, i.e. N-S span); 4th: N 481, E 196, S 467, W 198; 3rd: N 479?, S 472, W 198; 2nd: E 204.65, S 471.8; 1st: N 460.8, E 205.8, S 464.6, W 205.9; KC: 412.8 / 206.4 / 412.5 / 206.1.

### 1.3 Levels in the replica frame (recommended)

Two independent measurements:
- **Perring** (P3 Fig. 2 + Fig. 3, P4 Fig. 2 + Fig. 3; four sections, ceilings found by edge detection, KC floor line as zero). Mean of the four; spread given.
- **IGP 2024** (Fig. 4 EST section for the cut at the E end, NORD/SUD for beam tops along E-W; ~300 columns per layer).

Ceilings (dressed undersides of the beams, flat) and apex:

| Surface | Perring, m above KC floor (spread) | IGP 2024, m | Recommended y | Confidence |
|---|---|---|---|---|
| KC ceiling | 5.82 (±0.04) | 5.86 | **48.836** (Petrie) | high |
| Davison's ceiling (= underside of layer 2) | 8.77 (±0.06) | 8.75 | **51.76** ±0.05 | high |
| Wellington's ceiling (layer 3) | 11.53 (±0.08) | 11.36 | **54.44** ±0.10 | medium-high |
| Nelson's ceiling (layer 4) | 14.32 (±0.06) | 14.23 | **57.27** ±0.08 | medium-high |
| Arbuthnot's ceiling (layer 5) | 17.16 (±0.06) | 17.06 | **60.11** ±0.08 | medium-high |
| Campbell's apex (inner) | 21.09 (plates); **21.107 table (V2)** | 20.97 | **64.05** ±0.08 (V2 alone: 64.10) | high |
| Campbell's slab springing (inner faces meet the N/S sides) | 19.11 (P3 Figs. 2-3: 62.6-62.8 ft) | 18.96 | **62.03** ±0.1 | medium |

IGP sits 0.1-0.17 m lower than Perring above Wellington's; this is within IGP's ±1 % scale reading (±0.2 m at 21 m). Recommended = mean.

Floors (rough tops of the beams; median, with range):

| Floor | Perring median (P4 Fig. 2, ~100 rows) | IGP 2024 median [min-max] along E-W | Recommended y median [range] | Height to ceiling, median |
|---|---|---|---|---|
| Davison's (top of KC roof beams) | 7.83 | 7.72 [7.44-8.04] | **50.75** [50.44-51.04] | 1.0 m |
| Wellington's | 10.46 | 10.39 [10.09-10.80] | **53.42** [53.09-53.80] | 1.0 m |
| Nelson's | 13.12 | 13.04 [12.63-13.55] | **56.07** [55.63-56.55] | 1.2 m |
| Arbuthnot's | 15.93 | 15.76 [15.07-16.66] | **58.84** [58.07-59.66] | 1.3 m |
| Campbell's | 18.87 | 18.58 [18.00-19.28] | **61.72** [61.00-62.28] | 2.3 m to apex |

The IGP ranges reproduce Vyse's "height varies" ranges within ~0.1-0.3 m (e.g. Davison's IGP 0.71-1.31 m vs Vyse 0.76-1.07 m). The IGP N and S elevations agree to 0.04 m on every layer, so the roughness is real beam-to-beam variation (each beam top is a rounded hump; see IGP NORD).

Granite beam layer thickness (ceiling below to floor above), derived from IGP 2024 (median [min-max]): layer 1 (KC roof) **1.82** [1.54-2.14] m; layer 2 **1.61** [1.31-2.02]; layer 3 **1.66** [1.25-2.17]; layer 4 **1.53** [0.84-2.43]; layer 5 **1.50** [0.92-2.20]. From Perring medians: 2.01, 1.69, 1.59, 1.61, 1.71 m. Petrie: "The flooring beams are very unequal in depth" (Pe §63).

Beam lengths N-S (IGP EST/OUEST, at the section; the beam ends are drawn **dashed**, i.e. inferred, so low confidence): layers 1-4 about **7.8-8.1 m** (layer 1: 4.10 m N and 3.96 m S of the KC centre line, i.e. z ≈ -6.92 to -14.98); layer 5 about **5.9 m** (z ≈ -8.12 to -14.06). Perring P3 draws dashed beam outlines about 21.5-22.5 ft (6.6-6.9 m) long (low confidence).

### 1.4 Plan positions

**N and S sides.** Perring P3 Fig. 2 (N-S section looking west) puts all five chambers on the KC's N-S extent, centred on it: Davison's and Wellington's N and S faces within 1-2 px (≤1 in) of the KC walls; Nelson's and Arbuthnot's about 5 px (2 in) inside each wall. Take the chambers as centred on **z = -11.02**, half-widths from Vyse/Petrie:

| Chamber | N-S width (source) | N face z | S face z |
|---|---|---|---|
| Davison's | 205.8-205.9 in = 5.23 m (Pe); 17 ft 1 in (V2) | -8.40 | -13.64 |
| Wellington's | 204.65 in = 5.20 m (Pe, E end); 17 ft (V2) | -8.42 | -13.62 |
| Nelson's | 198 in = 5.03 m (Pe, W end); 16 ft 8 in = 5.08 (V2) | -8.50 | -13.54 |
| Arbuthnot's | 196-198 in = 4.98-5.03 m (Pe); 16 ft 4 in (V2) | -8.51 | -13.53 |
| Campbell's | undefined sides; 247 in = 6.27 m between springings (Pe); 20 ft 6 in = 6.25 m (V2); IGP 6.09 m | springing ≈ -7.89 | ≈ -14.15 |

**E and W ends (faces of the great limestone walls).** Petrie's masons' lines mark the KC length on the upper chambers, so the ends can be placed relative to the KC E wall (x = 7.750) and W wall (x = -2.736):

| Chamber | E end x | W end x | Source |
|---|---|---|---|
| Davison's | 8.38 (0.63 m E of KC) | -3.35 (0.61 m W) | P4 Fig. 2, measured off; length 11.73 m vs Pe 11.70-11.80, V2 11.68 |
| Wellington's | **8.66** (36.0 in E) | **-3.30** (22.3 in W) | Pe §63, S wall lines at 22.3 and 435.8 from the W end, E wall at 471.8 (derived). P4: 8.46 / -3.32 |
| Nelson's | 8.28 | -3.55 | P4 Fig. 2 only (Petrie's N-side line at 10 in from the W end is marked "?") |
| Arbuthnot's | **8.71** (N side, 37.8 in) / **8.58** (S side, 32.6 in) | **-3.51** (N, 30.4 in) / **-3.26** (S, 20.5 in) | Pe §63 lines (derived). P4: 8.22 / -3.25 |
| Campbell's | ≈ 8.42 (W end + 468.4 in, derived) | **-3.48** (29.3 in W, S side) | Pe §63 "line 29.3 from the W. end, apparently one terminal of the 412-inch length". P4: 8.13 / -3.38 |

The ends are rough and not square; Petrie's values (where given) are preferred. Confidence medium.

### 1.5 Campbell's gabled roof

- **Slope** of the inner faces: Perring P3 Fig. 2 32.3° and 33.0°, Fig. 3 33.1° and 33.0° (mean **32.9°**, measured off); IGP EST **33.4°** (measured off). Use **33°** (±0.5°).
- **Apex** y = 64.05 (above); ridge runs E-W at z ≈ -11.02 (P3: apex on the chamber centre line within 2 px).
- **Springing** y ≈ 62.03, half-span ≈ 3.13 m (V2/Pe), so rise ≈ 2.0 m (IGP 2.0 m; Perring 1.98 m; consistent with 33°: tan 33° x 3.13 = 2.03, derived).
- Below the springing the chamber sides drop to the floor: IGP shows ≈ 0.54 m of vertical side at the E end; Vyse gives "a low wall about three feet high" (0.91 m) on which the slabs rest. The wall height varies with the floor.
- **Slabs beyond the chamber** (hidden, so inferred): IGP draws the slope lines continuing dashed to at least 4.63 m from the axis, down to 18.0 m above the KC floor (y ≈ 61.0, below Campbell's floor); Perring P3 draws each slab dashed as a block about **5.9 ft (1.79 m) thick** perpendicular to the slope and about **22 ft (6.7 m)** along its inner face, its foot about 18.6 ft (5.67 m) N/S of the axis at 57.4 ft above the KC floor (y ≈ 60.5). Vyse: "the stone, by the side of which the entrance was worked up, was six feet six inches in thickness" (1.98 m) (V1 p. 278). Confidence low (dashed = not seen).

### 1.6 Davison's access passage

- **Mouth** in the E wall of the Grand Gallery at the top of its S end: 26.3 in (0.668 m) wide at top, 26.2 at base; S side formed by the topmost lap of the gallery's S end; top = gallery roof, base = bottom of the topmost lap, so **29.4 in (0.747 m) high measured square to the 26° 17' slope** (Pe §62 [p. 91]). W (citing Maragioglio & Rinaldi p. 24): "originates from the top of the south wall of the Grand Gallery".
- **Passage**: rough, **28½ in (0.724 m) wide, 32 in (0.813 m) high, over 20 ft long** (Pe §62); **24 ft 9 in (7.54 m)** long (V2 p. 112; PT p. 4). Perring calls it "Forced passage into Davison's Chamber" (P4 Fig. 1); Petrie thinks it "apparently an original passage".
- **Route** (P4 Fig. 1 plan, measured off): from the "Top of Great Passage" it runs straight **south**, on the line of the chambers' E ends, entering Davison's at the **E end of its N side**; plan length 740 px = 25.1 ft (matches 24 ft 9 in).
- **Coordinates** (derived, confidence low-medium): the gallery's E wall at roof level is at x = 7.224 + 1.049/2 = **7.75**, the same plane as the KC E wall; the roof meets the S end about 20.9 in (0.53 m) N of the floor-level S wall (Pe §46 lap projection), z ≈ -1.04. Floor of the mouth ≈ roof (≈ 42.90 + 0.26 + 8.6 ≈ 51.76 at the S end, using your 8.6 m height) minus 0.747/cos 26.28° = 0.83 → **y ≈ 50.9**, which matches Davison's floor (median 50.75) within the roughness. So: a level passage, floor y ≈ 50.8-50.9, 0.81 m high, 0.72 m wide, centre x ≈ 7.9-8.4, from z ≈ -1.0 to z ≈ -8.40 (Davison's N face). Smyth 1877 Plate XIII (schematic) also shows it level from the gallery's top S end into Davison's N side.

---

## 2. The ScanPyramids Big Void (SP-BV)

### 2.1 What SP17 actually reports

- Detected by three techniques: nuclear emulsions in the QC (NE1 in the "Niche" corridor on the E side, NE2 near the QC's S-W corner; "5.8 m east from the axis of the Grand Gallery and at 4.5 m west"; 1.1 m apart N-S), KEK scintillator hodoscopes in the QC (H1 S-E corner, H2 S-W corner, 2.9 m apart), and CEA gas telescopes outside in front of the N-face chevrons at 17 and 23 m (SP17 Methods). Significances: emulsions 13.7 σ (NE1) and 12.7 σ (NE2); gas 5.8 σ combined.
- Text values: "estimated length of more than 30 m ... located between 40 m and 50 m away from the detector positions"; "The centre of the void is located between 40 m and 50 m from the floor of the Queen's chamber. Its length is more than 30 m and its cross section is comparable to that of the Grand Gallery." Hodoscopes: "the structure starts almost at the centre of the Pyramid and ends at an angle whose tangent is 0.8 to the North ... the length of the main part ... is approximately 30 m" (SP17 main text and Methods).
- Hypotheses: "the big void could be made of one or several adjacent structures, and it could be inclined or horizontal" (SP17). The horizontal (red) and inclined (green) hypotheses are only drawn in a perspective rendering (SP17 press material, reused as SP23 Fig. 1 "as published in November 2017"); no dimensions are given for them.
- Triangulation uncertainty: half a bin, 0.0125 in tanθx and 0.125 in tanθy (SP17 Methods), i.e. about ±0.5 m E-W and ±5 m N-S at 40 m.

### 2.2 Conversion of SP17 Fig. 2g-i to the replica frame

SP17 Fig. 2g (vertical section, right = north), 2h (vertical section, right = west), 2i (plan): axes in metres, vertical = "Height from the floor of Queen's chamber". I located the plotted known structures to fix the offsets (measured at 10.76 px/m on a 600-dpi render):
- Fig. 2g horizontal: QC walls plotted at -0.03 and +5.18, KC walls at -10.99 and -5.79, gallery S wall at +1.00. Against the replica (QC -2.64/+2.59, KC -13.64/-8.40, gallery S wall -1.57): **z = fig - 2.60** (±0.05).
- Vertical: QC floor = 0; their KC floor is plotted at 21.7 (replica 42.997 - 21.19 = 21.8). **y = fig + 21.25** (±0.1).
- Fig. 2h/2i E-W: origin = the Grand Gallery axis (dashed line), west positive; replica x ≈ 7.25 - fig.

Triangulated void centres (black crosses, four tanθy slices), replica frame (derived):

| Point | z (N-S bar) | y (vertical bar) | x |
|---|---|---|---|
| 1 | **+3.5** (-1.8 to +8.8) | **64.3** (60.4-69.2) | 7.4-7.6 |
| 2 | **+15.0** (+9.5 to +20.5) | **66.3** (62.0-71.7) | " |
| 3 | **+24.3** (+19.1 to +29.5) | **63.1** (59.4-67.8) | " |
| 4 | **+30.9** (+26.3 to +35.5) | **58.7** (55.7-62.2) | " |

E-W: the crosses lie 0.1-0.35 m east of the gallery axis in Figs. 2h and 2i, so **x ≈ 7.45 ± 0.5**: directly over the gallery.

### 2.3 Best estimate for the model (derived; confidence low-medium)

- **N-S extent:** from about **z = 0** (the pyramid's E-W centre plane; hodoscopes "almost at the centre") to about **z = +31** (hodoscope tan 0.8 from H1/H2 at QC level: 0.8 x ~41 m ≈ 33 m north of z ≈ -2; emulsion point 4 at 30.9). Length ≥ 30 m. Both ends are uncertain by about ±5 m.
- **Height:** mean of the four centres **y ≈ 63.1** (QC floor + 41.9); individual centres 58.7-66.3, each ±4-5 m. That is about the level of Campbell's apex (y 64.05), and **15-24 m above the gallery roof** (gallery roof at z = 3.5, 15, 24.3, 30.9: y ≈ 49.0, 43.3, 38.7, 35.5; derived from Petrie's floor line + 8.6 m).
- **Horizontal hypothesis:** a gallery-sized void at y ≈ 63 ± 4 (centre), z 0 to +31, on x ≈ 7.45.
- **Inclined hypothesis:** the last three centres fall at 25.4° (fit), against the gallery's 26.3°: a void parallel to the gallery, centre line y ≈ 66.3 at z = 15 descending to 58.7 at z = 30.9 (about 23 m above the gallery roof, measured vertically). All four points together fit only 11°. The 2017 rendering draws the inclined option somewhat lower (between the gallery and the horizontal option) but gives no numbers.
- **Cross-section:** "comparable to that of the Grand Gallery" (SP17); the Extended Data Fig. 2 excesses for the void and the gallery are "of a similar scale". So take ~8.6 m high x 1.0-2.1 m wide, ≈ 13.5 m² (gallery's own section, derived). EGP (secondary) summarises it as "≃ 30 m long × ≃ 6 m in diameter". The muon data constrain the integrated missing material, not the shape: a tall narrow, a squat wide, or several adjacent voids all fit.

### 2.4 Later work and critiques

- **SP23 (NFC, 2023):** gives no new Big Void geometry. It reproduces the 2017 picture with both hypotheses and says the Degennes telescope was placed "to probe the potential end of the NFC or a hypothetical connexion with the Big Void"; no connection is reported.
- **EGP (Bross et al. 2022):** a proposed very large muon telescope; models the void as ~30 m x ~6 m for simulation only. No new data.
- **IGP (2024 scan of the relieving chambers):** does not address the void.
- No 2024-2026 publication refining the Big Void's position or shape was found (arXiv, Nature/Nat Commun, web searches, 2026-10-27).
- **Critiques:** Z. Hawass: the pyramid is "full of voids", and the team "cannot define the shape, size, or exact position of that void" (New Atlas, Nov 2017, quoting his Ahram Online interview); he proposed construction gaps. The Ministry's oversight committee (with M. Lehner) used "anomalies" rather than voids or cavities. ScanPyramids (M. Tayoubi) replied that it is not a construction gap. The finding is not contested statistically (three techniques, 5.8-13.7 σ); its shape and purpose are.

### 2.5 For the replica

The void is a modelled hypothesis, not a measured object. If shown: a gallery-section prism on x ≈ 7.45 from z ≈ 0 to z ≈ +31, either horizontal with its centre at y ≈ 63 (floor ≈ 58.7, roof ≈ 67.3 for an 8.6 m height) or inclined at ~26° with its centre line through (z 15, y 66.3) and (z 30.9, y 58.7). Label it uncertain (±5 m along and vertically, ±0.5 m E-W).

---

## Gaps

1. Maragioglio & Rinaldi's own sections (with levels) were not read.
2. The IGP monograph (2026) will give the scanned volumes, beam masses and exact levels; the 2025 figure is preliminary and only 2000 px wide.
3. Thickness of the great E and W limestone walls: no source.
4. The exact 3D route of Davison's passage (any bends, its floor level) is only derived here.
