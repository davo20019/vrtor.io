# Khafre (G2), Menkaure (G3), the queens' pyramids and the Sphinx, placed relative to Khufu

Compiled 2026-10-27. Companion to `survey.md` (same source keys, same conventions). Every number cites its source; **derived** marks values I computed from a cited number; second-hand values are marked as such.

## Frame

Origin = centre of Khufu's casing base square at its pavement level (Petrie's zero, P §23). x = east, z = north, y = up, metres, x and z along Khufu's mean sides, which are -3' 43" (anticlockwise) of true north (P §93 [p. 125]). 1 in = 0.0254 m.

Note: this file uses **z = north**, as asked. `survey.md` writes the same frame with y = north, z = up.

## Sources

| Key | Source | Where read |
|---|---|---|
| **P** | W. M. F. Petrie, *The Pyramids and Temples of Gizeh*, 1883. Ch. 5 "Co-ordinates" §18-19 pp. 34-36; Ch. 8 "Outside of Second Pyramid" §65-72 pp. 96-103; Ch. 9 §73 p. 104; Ch. 10 "Outside of Third Pyramid" §79-83 pp. 110-116; Ch. 4 §16 pp. 31-32; Ch. 12 §90-91 pp. 121-124; Ch. 13 "Positions and Orientation" §92-93 pp. 125-126 | Birdsall edition via Wayback: `http://web.archive.org/web/2015id_/http://www.ronaldbirdsall.com/gizeh/petrie/c5.html` (and c4, c8, c9, c10, c12, c13) |
| **V** | H. Vyse, *Operations carried on at the Pyramids of Gizeh in 1837*, vol. II (1840), Appendix: Perring's levels and tables of dimensions | archive.org full text, `https://archive.org/download/operationscarrie02howa/operationscarrie02howa_djvu.txt`; the table of the Second Pyramid's sizes is OCR-garbled there and was read from the second scan `https://archive.org/download/operationscarri02vysegoog/operationscarri02vysegoog_djvu.txt` |
| **NR** | E. Nell & C. Ruggles, "The Orientations of the Giza pyramids and associated structures", accepted for *Archaeoastronomy* 25 (2012); arXiv v2 2013. Total-station survey, Tables 1-5 | arXiv 1302.5622, `https://arxiv.org/pdf/1302.5622` |
| **D14** | G. Dash, "How the Pyramid Builders May Have Found Their True North", *AERAGRAM* 14-1 (Spring 2013) pp. 8-14; tables on p. 12 of the azimuths Spence 2000 used (citing Dorner) | `https://irp.cdn-website.com/ef20729f/files/uploaded/AG14_1_True_North_singles.pdf` |
| **W** | English Wikipedia, read 2026-10-27: "Pyramid of Khafre", "Pyramid of Menkaure", "Pyramid G1-a/-b/-c", "Great Sphinx of Giza", "Great Pyramid of Giza". **Second-hand.** | `https://en.wikipedia.org/w/index.php?title=<page>&action=raw` |

Not obtained: Glen Dash's "Giza Pyramids Corners and Centers" KMZ (listed at `https://glendash.com/archaeology/survey.html`, but no download link in the page source); AERAGRAM 26-1/2 (2024), "Beaming in on Khafre", the first laser survey of G2 (not online); GPMP elevation data; Lehner, *The Complete Pyramids*; Maragioglio & Rinaldi V-VI. Heritage Science 8:8 (2020), "Sustainability problems of the Giza pyramids", is quoted by a search engine as giving bases at "+60 m, +70 m, +80 m" for Khufu, Khafre and Menkaure (and elsewhere "2.5 m" for Menkaure above Khafre). Its page was not reachable, so those figures are **unverified** and are not used.

---

## 1. Petrie's coordinate system and the conversion

P §19 [p. 34]: the coordinates are counted "from a line beyond the N. side of the whole area, and from a line beyond the E. side" (so "From North" grows southwards and "From East" grows westwards). True north lies **+1° 12' 22" ± 6"** east of the system's north. The unit is 1/196.750 British inch ("number of units in the inch 196.750 ± .001").

Petrie's table "Resulting co-ordinates of points of ancient construction" (P §19, p. 36), in units:

| Point | From North | From East |
|---|---|---|
| G1 casing NE | 1 884 598 | 1 385 776 |
| G1 casing SE | 3 668 168 | 1 421 276 |
| G1 casing SW | 3 632 521 | 3 205 195 |
| G1 casing NW | 1 848 772 | 3 169 668 |
| G1 centre | 2 758 515 | 2 295 478 |
| G2 casing NE | 4 630 771 | 4 089 656 |
| G2 casing SE | 6 297 958 | 4 121 664 |
| G2 casing SW | 6 265 598 | 5 789 181 |
| G2 casing NW | 4 598 359 | 5 756 193 |
| G2 centre | 5 448 171 | 4 939 173 |
| G3 casing NE | 7 998 215 | 6 437 758 |
| G3 casing SE | 8 814 325 | 6 457 924 |
| G3 casing SW | 8 793 987 | 7 275 727 |
| G3 casing NW | 7 976 980 | 7 255 560 **?** (Petrie's query: this corner was never reached, P §80, §16) |
| G3 centre | 8 395 877 (printed "8 395877") | 6 856 742 |

Method (script below, run with python 3): (1) turn units into inches and into a right-handed system (X = system east = -FromEast/196.75, Y = system north = -FromNorth/196.75); (2) take Khufu's centre as the mean of its four corners, which reproduces Petrie's stated centre exactly; (3) take Khufu's axis as the mean azimuth of its four sides, which comes out **+1° 8' 38.9"** in the system, i.e. **-3' 43.1"** from true north, matching Petrie's -3' 43" (P §93); (4) translate and rotate every point into the Khufu frame.

The conversion reproduces Petrie's printed results, which checks the transcription and the method:
- G2 side lengths from the corners: N 8471.9, E 8475.2, S 8476.9, W 8475.6 in. Petrie §66 prints 8471.9, 8475.2, 8476.9, 8475.5.
- G2 side azimuths from true N: -5' 31", -6' 22", -5' 40", -4' 21". Petrie §66: -5' 31", -6' 13", -5' 40", -4' 21". The mean, -5' 29", compares with his -5' 26".
- G3 sides: E 4149.2, S 4157.8, W 4153.8 in; azimuths N +16' 53", E +12' 34", S +13' 07". Petrie §80: 4149.2, 4157.8, 4153.9 in; +16' 48", +12' 23", +12' 57".
- §92 distances measured on parallels at -5': G1 to G2 is 13931.1 S and 13166.4 W, direct 19168.4 in (Petrie 13931.6, 13165.8, 19168.4). G1 to G3 is 29101.2 and 22617.2 (Petrie 29102.0, 22616.0). G2 to G3 is 15170.1 and 9450.8 (Petrie 15170.4, 9450.2).
- Station R, "Staff on top of 1st Pyramid" (Gill's summit mast), lands at x = -0.42, z = +0.25 m.

```python
import math
U=196.750; IN=0.0254
TN=math.radians(1+12/60+22/3600)          # true N is this far clockwise of system N (P §19)
def sx(p): return (-p[1]/U, -p[0]/U)      # (fromN, fromE) -> (X east, Y north) inches
def az(a,b): return math.atan2(b[0]-a[0], b[1]-a[1])   # clockwise from system N
G1={'NE':(1884598,1385776),'SE':(3668168,1421276),'SW':(3632521,3205195),'NW':(1848772,3169668)}
c={k:sx(v) for k,v in G1.items()}
o=tuple(sum(c[k][i] for k in c)/4 for i in (0,1))
th=(az(c['SE'],c['NE'])+az(c['SW'],c['NW'])
    +az(c['NW'],c['NE'])-math.pi/2+az(c['SW'],c['SE'])-math.pi/2)/4   # = +1°08'38.9" (=> -3'43.1" true)
def tofr(p):                               # system inches -> Khufu frame metres (x east, z north)
    dx,dy=p[0]-o[0],p[1]-o[1]
    return ((dx*math.cos(th)-dy*math.sin(th))*IN, (dx*math.sin(th)+dy*math.cos(th))*IN)
```

---

## 2. Khafre (G2)

### (a, b, c) Position, size and orientation (P, converted; **derived**)

| Corner | x (m) | z (m) |
|---|---|---|
| NE | -226.752 | -246.281 |
| SE | -226.586 | -461.551 |
| SW | -441.899 | -461.673 |
| NW | -441.939 | -246.394 |
| **Centre** | **-334.294** | **-353.975** |

- **Base sides** (P §66 [p. 97]): N 8471.9, E 8475.2, S 8476.9, W 8475.5 in. Mean **8474.9 in = 215.262 m**, mean difference 1.5 in. The corners are those of the "raised square of rock" cut to carry the casing foot (P §65-66), at the casing's base line.
  - W (second-hand, citing Verner): 215.25 m. V (Perring): former base 707 ft 9 in = 215.72 m, present base 690 ft 9 in = 210.54 m (V App. p. 117).
- **Azimuth of the sides vs true N** (P §66): N -5' 31", E -6' 13", S -5' 40", W -4' 21", mean **-5' 26" ± 16"** (P §93). **Relative to Khufu's sides: -1' 45"** (derived: the mean rotation of the four converted sides; Petrie's means give -5' 26" - (-3' 43") = -1' 43"). That is, Khafre is turned about 1¾' further anticlockwise than Khufu.
  - Petrie notes the upper casing was skewed **+1' 40"** relative to the base square, so it stands at about -3' 50" from true north higher up (P §66 p. 97).
  - NR (Table 3b, casing foundation base) give N -3.8', E -4.0', S -5.8', W -4.2', mean -4.45'. Their Khufu (Table 1b) is N -3.6', E -3.4', S -0.5', W -3.7', mean -2.8'. **Relative to Khufu: -1.65'** (derived). NR therefore agree with Petrie on the *relative* twist, while both of NR's absolute values are about 1' less negative than Petrie's.
  - D14 (citing Dorner via Spence 2000): E side -6.0'.
- **Centre-to-centre distance** (P §92): 19168.4 in = 486.88 m at 43° 22' 52" from the -5' parallels. Petrie found "no exact relation between their centres, or between the corners".
- **Passage axis** (P §73 [p. 104]): 490.3 in = 12.454 m E of the middle of the N face, so x = -321.84 m (derived). Smyth's passage azimuth was -5' 37".

### (d) Base level relative to Khufu

- **V (Perring's levelling, 1837), App. p. 106:** "The base of the Second is above the base of the Great Pyramid 33 ft. 2 in." = **+10.109 m** (derived conversion). "The base of the Great Pyramid was above high Nile, in 1837, 138 ft. 9 in."
- V App. p. 255, Niebuhr (1761): "Elevation of base of the Second Pyramid above that of the Great, 34 ft" = +10.36 m. This is a rough 18th-century figure.
- W (second-hand): Khafre sits on bedrock "10 m (33 ft) higher" than Khufu.
- Petrie levelled G2's base only locally (P §68: "not levelled together") and gives **no** level between G1 and G2.
- **Adopt y(G2 pavement) = +10.11 m ± ~0.3 m.** The uncertainty is my own estimate: Perring does not say which surface he took as each "base".
- Local detail (P §68 table, p. 99), in inches above G2's pavement = 0:
  - the raised square of rock under the casing lies **-10.5 to -14.5 in** (-0.27 to -0.37 m);
  - the paving bed lies -18 to -23.5 in;
  - the rock core rises to 74.5 in (NE), 78.5 (SE), 142.5 (SW) and 170 (NW).
  - V App. p. 114: the rock "appears at the south-western corner eleven feet ten inches, and at the north-western fourteen feet three inches above the base".
- Pavement width: 528.8 and 527.9 in from the base on N, 530.9 in on W (P §69).

### (e) Face angle and original height

- Angle (P §67 [pp. 97-98]): **53° 10' ± 4'** (granite in situ 53° 12' ± 2'; 24 loose blocks 53° 14' ± 5'). Perring gives 52° 20' (V App. p. 117). W: 53° 10' (Verner, Lehner).
- Original height (P §67): **5664 ± 13 in = 143.87 ± 0.33 m.** V (Perring): former height 454 ft 3 in = 138.46 m.
- Casing (P §65, §68): the lowest course is **granite**, 41.52 ± .05 in high on the slope plus an 11 in vertical foot (measured at SW). Petrie saw only one granite course; Vyse reports two ("about seven or eight feet in height", V App. p. 115). Above that, the casing was Mokattam limestone.

### (f) Present top and the surviving cap of casing

- **V (Perring), App. p. 117, Table of Dimensions:** present height, perpendicular, **447 ft 6 in = 136.40 m**; "Square of platform on the top about 9 ft" (2.74 m); "**From present top to bottom of casing from 130 to 150 ft**" (39.6 to 45.7 m).
  - So the surviving casing runs from about **90.7-96.8 m up to 136.4 m** above G2's base (derived, Perring's figures). The bottom edge is ragged and varies by about 6 m around the pyramid.
  - Add +10.11 m for the Khufu frame: **y ≈ 100.8-106.9 m up to 146.5 m**.
- W (second-hand): present height 136.4 m; "Casing stones cover the top third of the pyramid, but the pyramidion and part of the apex are missing."
- Petrie sighted "the lowest corner of this casing at each edge" in his triangulation (P §66) but **did not publish its height**.
- **Gap:** no modern measured outline of the cap was found. AERAGRAM 26 (2024, laser survey of G2) would be the source.

---

## 3. Menkaure (G3)

### (a, b, c) Position, size and orientation (P, converted; **derived**)

| Corner | x (m) | z (m) |
|---|---|---|
| NE | -521.146 | -686.977 |
| SE | -521.645 | -792.366 |
| SW | -627.253 | -791.849 |
| NW (Petrie "?", not observed) | -626.756 | -686.344 |
| **Centre** | **-574.200** | **-739.384** |

- These corners are at Petrie's **adopted base level**: one mean granite course (40.3 ± 1.5 in) below the first course joint, because G3 has no pavement and its casing foot was left in the rough (P §79-80 [pp. 110-111]).
- **Base sides** (P §80): E 4149.2, S 4157.8, W 4153.9 in (N not obtained). Mean **4153.6 in = 105.50 m.** The N side computed from the coordinates is 4158.0 in (105.61 m) (**derived**; it relies on the unobserved NW corner).
  - V (Perring) App. p. 120: base 354 ft 6 in = 108.05 m, measured on the rough granite. W (second-hand): 102.2 x 104.6 m original, 108.5 m today.
- **Azimuth of the sides vs true N** (P §80): N +16' 48", E +12' 23", S +12' 57", mean **+14' 3"** (W side not obtained). **Relative to Khufu: +17' 46"** (derived, Petrie means). From the converted sides including the computed W: **+17' 28"**. So G3 is turned about 18' *clockwise* relative to Khufu.
  - NR Table 5c (from casing and core courses 3-11, the foundations being buried): N +20', E +12', S +32', W +25', "best estimate" mean **+22'**, which is +24.8' relative to NR's Khufu (derived).
  - D14 (Spence's tabulated value): +14.1'.
  - **Sources disagree by about 7'.** Petrie measured at the base line; NR measured on higher courses, which they find concave.
- **Centre-to-centre** (P §92): G1 to G3 36857.7 in = 936.19 m at 37° 51' 6"; G2 to G3 17873.2 in = 453.98 m at 34° 10' 11".
- Station E, "N. side of 3rd Pyramid" (P §19), lands at x = -572.91, z = -697.57: on the N face, about 1.3 m E of the axis.

### (d) Base level relative to Khufu

- **V (Perring), App. p. 106:** "The base of the Third is above the base of the Great Pyramid **41 ft. 7 in.**" = **+12.675 m** (derived). App. p. 107: the bases of the three small pyramids S of the Third "are lower than the base of the Third, 16 ft. 8 in." (5.08 m), so they sit about +7.60 m in the Khufu frame (derived). "The bases of the three Pyramids east of the Great Pyramid, appear to be on a level with it."
- Petrie gives no level linking G3 to G1.
- **Adopt y(G3 base) = +12.68 m ± ~0.5 m.** My estimate of the uncertainty: Perring's "base" for G3 is undefined, and Petrie's adopted base is a construction, not a surface.

### (e) Face angle and original height

- Angle (P §81 [p. 112]):
  - measured values range from 50° 42' to 51° 58'. Petrie's "best conclusion" is **51° 0' ± 10'**, but he prefers **51° 10' 30" ± 1' 20"** derived from the granite courses (granite top = ¼ of the height).
  - Perring: 51° (V App. p. 120). W (second-hand): 51° 20' 25".
- Original height (P §81-82): **2564 ± 15 in (65.13 m)** by the angle, or **2580.8 ± 2.0 in = 65.55 m** by 4 x the granite height (adopted by Petrie).
  - V (Perring) App. p. 120: former height 218 ft = 66.45 m.

### (f) Present top and surviving granite casing

- **Original granite:** the lowest **16 courses** on all sides, up to **645.2 in = 16.39 m** above the adopted base. "The highest remaining fragments of granite (mere back ends of casing stones) are at the same level on each of the sides" (P §82 [p. 113]).
  - Course levels at the NE corner, courses 1-40, are in P §82: 40.3, 81.5, 122.3, 160.9, 197.7, 233.7, 276.1, 316.4, 359.1, 401.0, 442.4, 481.1, 523.9, 563.8, 606.4, **645.2** (16th), 689.4, ... 1383.5 in.
  - Bottom course full height: NE 45.5, SE 55.3, SW 43.7 in.
  - The casing faces were left in the rough. Only the joint edges are dressed (P §79).
- **1837, V (Perring) App. p. 120:** present height **203 ft = 61.87 m**; platform at top about 16 ft (4.88 m) square.
  - "Present height of granite, perpendicular from the base: On the western side 36 ft 9 in [11.20 m]; On the northern side 25 ft 10 in [7.87 m]".
  - App. p. 119-120: "the eleven or twelve courses towards the bottom are not worked smooth".
- **1880-82, P §16 [p. 32]:** "the casing still remains above the rubbish heaps on every side". The NW foot was buried, and Petrie used "the edge of the fifth course of casing, which stood above ground".
- **Today, NR §3.5 (survey c. 2006-2010):**
  - "Largely intact courses of casing stones are only found on the north and east sides".
  - On the south side "a few casing stones remained", and they surveyed casing and core on the 2nd and 7th courses.
  - "On the west side no casing stones remain"; they surveyed core courses 9 and 11.
  - On the N face they measured casing courses 4, 6, 7 and 9; on the E face, courses 3 and 6.
- W (second-hand, citing Reuters 2024): granite casing "halted at sixteen to eighteen layers ... only seven of which remain today". The 2024 SCA/Waseda project studies the fallen granite for possible reinstallation.
- **Summary for the model:** granite in place on **N and E**, up to about course 7-9. On E the dressed "smooth area" is near the middle. N casing is broken by the large breach above the entrance. A few blocks remain on S; none on W today.
  - Seven courses reach 276.1 in = 7.01 m and nine reach 359.1 in = 9.12 m above the base (P §82). That fits Perring's 7.87 m on N in 1837.
  - **Gap:** an exact count per face was not found in a primary source.
- Entrance (W, second-hand, citing M&R 1967 p. 38): in the 5th casing course, about 4.2 m above the base, in the centre of the N face.

---

## 4. Queens' pyramids G1-a, b, c (east of Khufu) and the Sphinx: cheap, low confidence

Petrie did not survey their bases (P §90: "I had not time to uncover the bases"). Two of his station marks lie on them (P §19; positions derived):

| Station | x (m) | z (m) |
|---|---|---|
| S, "W. side of 7th Pyramid" (Vyse's 7th = G1-a, the northern) | 178.73 | -28.59 |
| A, "S.W. corner of the 9th Pyramid" (9th = G1-c, the southern) | 178.74 | -155.07 |

- These are marks on ruined masonry, not on the original casing line. Note that they lie on the same x, i.e. both pyramids' W sides are 63.6 m E of Khufu's E face (x = 115.17).
- Perring's sizes (V App. pp. 127-129, OCR partly scrambled): 8th (G1-b) original base 172 ft 6 in = 52.6 m, height 111 ft = 33.8 m; 9th (G1-c) original base 160 ft = 48.8 m, height 101 ft 9 in = 31.0 m. Angles 52° 10' assumed for all three.
- **W (second-hand):**
  - G1-a: base 49.5 m, height 30.25 m.
  - G1-b: base 50 m, height 30 m, "ten meters south of" G1-a.
  - G1-c: base 46.25 m, height 29.6 m; its S side is aligned with Khufukhaf I's mastaba, not with Khufu.
- NR Table 2a: G1-b casing foundation E side -15', W side +26'/+50' from true N.
- V App. p. 107: bases "appear to be on a level with" Khufu's, so **y ≈ 0**.
- Centres from Wikipedia's WGS84 coordinates, put into this frame relative to Wikipedia's Khufu coordinate:
  - G1-a (202, -37), G1-b (188, -93), G1-c (201, -146).
  - **Accuracy ±20-30 m only.** Wikipedia gives them to 1"; the same method puts Khafre 12-16 m and Menkaure 10 m off Petrie.
  - A cross-check from Petrie's station S plus half of G1-a's 49.5 m gives x ≈ 203.5 for G1-a's centre, consistent with Wikipedia.
- **Sphinx:** no Petrie station. From Wikipedia's coordinate (29.97526 N, 31.13758 E), x ≈ +329, z ≈ -433 m, **±30 m** (second-hand, low confidence). W gives its size as 73 m long, 20 m high, 19 m wide. Its level was not found in a primary source.

---

## 5. Summary in the Khufu frame (metres; x east, z north, y up; rotation = clockwise-positive turn of the pyramid's sides relative to Khufu's)

| | Centre x | Centre z | Base side | Rotation vs Khufu | Base y | Face angle | Original height | Present top | Casing surviving |
|---|---|---|---|---|---|---|---|---|---|
| **Khufu G1** | 0 | 0 | 230.33 (P §19 corners); 230.35 (P §20, 9068.8 in) | 0 (sides -3' 43" true N) | 0 (pavement) | see survey.md | see survey.md | see survey.md | see survey.md |
| **Khafre G2** | **-334.29** (P, der.) | **-353.97** (P, der.) | **215.26** (P §66); Perring 215.72 | **-1' 45"** (P, der.); NR -1.65' | **+10.11** (Perring, V p.106); Niebuhr +10.36 | **53° 10'** (P §67); Perring 52° 20' | **143.87 ± 0.33** (P §67); Perring 138.46 | 136.40 above own base, i.e. y = 146.5 (Perring, V p.117) | limestone cap from 130-150 ft below the top, i.e. about 90.7-96.8 to 136.4 m above base (y = 100.8-106.9 to 146.5) (V p.117); 1 granite course at foot, 41.52 in slope + 11 in vertical foot (P §68), Vyse says 2 |
| **Menkaure G3** | **-574.20** (P, der.) | **-739.38** (P, der.) | **105.50** (P §80, mean of E, S, W); Perring 108.05 | **+17' 46"** (P, der.); NR +24.8' | **+12.68** (Perring, V p.106) | **51° 10' 30"** (P §82); 51° 0' ± 10' (P §81) | **65.55 ± 0.05** (P §82); 65.13 by angle | 61.87 (Perring 1837, V p.120), i.e. y = 74.6 | originally 16 granite courses to 16.39 m (P §82); 1837: granite to 11.20 m on W, 7.87 m on N (V p.120); today N and E largely intact, few on S, none on W (NR §3.5); "seven" courses (W, second-hand) |
| G1-a | ~202 (W, ±25) | ~-37 (W, ±25) | 49.5 (W) | ? | ≈0 (V p.107) | 52° 10' (Perring, assumed) | 30.25 (W) | ? | none |
| G1-b | ~188 (W, ±25) | ~-93 (W, ±25) | 50 (W); Perring 52.6 | E -15', W +26' true (NR) | ≈0 | 52° 10' (Perring) | 30 (W); Perring 33.8 | ? | none |
| G1-c | ~201 (W, ±25) | ~-146 (W, ±25) | 46.25 (W); Perring 48.8 | ? | ≈0 | 52° 10' (Perring) | 29.6 (W); Perring 31.0 | ? | none |
| Sphinx | ~+329 (W, ±30) | ~-433 (W, ±30) | 73 long, 19 wide (W) | ? | ? | | 20 (W) | | |

Petrie's G2 and G3 positions come from one triangulation that reproduces his own published distances to under 1 in. They are good to centimetres for G2 and to a few cm for G3; G3's NW corner is the exception, since it was projected, not observed. Levels are good to only about ±0.3-0.5 m (Perring 1837), because no modern levelling between the three bases was obtained.
