# cybertruck, round-10

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.3, 1809.04, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 92296 | 60000 | NO |
| GLB KB | 2828 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: FAIL

## Differences from the reference

- Rear side window: now a tall quadrilateral with an upright rear edge at the C-pillar, on c003's opening through its solved camera (was a wedge clipped by a diagonal window/sail crease). Fit and sizes unchanged from round 9.
- Triangle budget over (92k of 60k), as in round 9: not from this change.
