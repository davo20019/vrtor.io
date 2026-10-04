# cybertruck, round-2

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.3, 1809.04, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 23520 | 60000 | yes |
| GLB KB | 226 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: PASS

## Differences from the reference

- Side pairs (c003, c059): outlines agree to 51 to 69 mm; the render shows the body 50 to 60 mm higher than the
  photo because render_views.py doesn't apply the fit's per-photo ride offset (the trucks are kneeling at Entry height).
- Steel renders near white: the review sky isn't calibrated to each photo's surroundings; colours not compared.
- c150 front: the solved camera is too high (3 m, at the prior's limit); the render looks down on the hood and seats
  while the photo sees the hood edge-on. The cut-out includes a sign post on the roof. The front widths are unreliable.
- c059 has bare rims, the model shows the aero covers (they are a toggle).
- Full list, with which differences are guesses: ../../REPORT.md.
