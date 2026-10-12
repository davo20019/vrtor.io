# cybertruck, round-13

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.3, 1809.24, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 59046 | 60000 | yes |
| GLB KB | 2583 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: PASS

## Differences from the reference

- Exterior fit unchanged. Within the triangle budget (59,046) after lighter tessellation and 2-segment bevels; no visible change in close renders.
- Cabin: A-pillar bar now the measured wedge section (dgRcedIkNOM-32, int-athens-1), grilles at their measured places (review/pillar/athens1-grille.jpg).
