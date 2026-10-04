# cybertruck, round-7

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| _all | [2413.3, None, 5682.9] | [2413.3, 1809.04, 5682.9] | yes |
| steel | [None, 1536.8, None] | [1924.15, 1536.63, 5569.17] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 82004 | 60000 | NO |
| GLB KB | 2408 | 3072 | yes |
| largest texture px | 2048 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| c003-right | refs/web/c003-side-R.jpg | 0.9101 | 69.053 | 27.03 |
| c059-left | refs/web/c059-side-L.jpg | 0.9121 | 51.255 | 16.3 |
| c150-front | refs/web/c150-front.jpg | 0.9227 | 41.34 | 0.0 |

Automatic checks: FAIL

## Differences from the reference

- Front bumper (c150 pair, and renders from the front, the bumper and the corner): before this round, the bumper was a block with a slot. It now has the top band, plate recess, intake with grille and tow-hook covers, lip and the lower corner chamfers, and matches c150 feature for feature. The c150 camera frames the truck lower than the photo, so the pair is compared feature by feature, not by overlay.
- Lower lamp strip: was 32 mm tall all across; it is now 67 mm across the centre face, with the headlamps in it.
- Amber corner lamps glowed at rest; now dark until signalling.
- Steel streaks read as wood grain on the hood; now faint.
- Mirrors: c150 shows them folded (parked); the model has them out, as driven. Deliberate.
- Triangles 82,004 against 60,000: this was already over before the round (the yoke and seats); the bumper adds 264.
