# altimeter, round-8

Rounds 1 to 7 fixed: blank dial (review lighting), lens z-fighting on its seat, washed-out colours (tone mapping, exposure calibrated to the dial cream), case hue, chamfer and edge sizes, tick weights, lens rim band, O-ring triangle count (14k to 1.3k), GLB size (677 to 94 KB).

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| case | [63.5, 63.5, 28.0] | [63.5, 63.5, 28.0] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 8620 | 10000 | yes |
| GLB KB | 94 | 500 | yes |
| largest texture px | 1024 | 1024 | yes |

Automatic checks: PASS

## Differences from the reference

- Case reads as glossy paint, not anodised metal: the reference has bright and dark metallic reflections. Kept non-metallic on purpose (the apps have no environment map; metallic renders black there).
- No ALTI-2 logo or ALTIMASTER GALAXY wordmark: omitted on purpose (trademarks).
- Reference is shot slightly from above, so its case looks taller than 63.5 mm; the render is straight on. Sizes are from the manufacturer.
- Webbing has a fine rib normal map but no visible weave or stitching; strap shape when worn is a guess (no photo of it worn).
- Back, sides and the strap slot are guesses: no side or back photo found.
