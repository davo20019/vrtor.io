# cybertruck, round-5

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.29, 1809.04, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 56145 | 60000 | yes |
| GLB KB | 2079 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: PASS

## Differences from the reference

Front corner round (spec.md, "Front corner, measured"). Compared with c059, c085 and c147 through close renders:

- Fixed: the front flare's leg is now one diagonal ending on the bumper (it had a vertical leg standing beside
  the bumper); the flares have a bevelled outer edge; the gap over the tyre is 125 mm (was 86).
- Fixed: the bumper corners are flush with the flares and run back to just ahead of the tyre, with the lower
  rear tip; the bumper top is at 650 (was 571).
- Fixed: a smoked lower lamp strip between the bumper and the steel, amber at the corners (the amber marker
  sat on the black bumper).
- Fixed: tyre shoulder lugs as geometry.
- The fit numbers above are from the last fit (not rerun); the front corner is measured, not fitted.
- Open: nose height (see spec), which wheel cover is default.
