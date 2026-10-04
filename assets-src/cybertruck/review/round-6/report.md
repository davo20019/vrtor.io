# cybertruck, round-6

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.3, 1809.04, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 56141 | 60000 | yes |
| GLB KB | 2081 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: PASS

## Differences from the reference

Nose and corner facets measured on the manual's side and top views (spec.md, "Front corner, measured"):
light bar 1,050 high, face nearly vertical, flat to 625 either side, corner facets back to 290. Against c001 and
c055 the light bar now wraps the corner over a wide facet as on the truck (it dropped steeply over a 110 mm
sliver). Through c059's camera the nose matches the photo's height. Fit numbers above are from the last fit
(not rerun); the front is measured, not fitted.
