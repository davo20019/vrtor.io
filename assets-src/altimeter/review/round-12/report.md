# altimeter, round-12

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| case | [63.5, 63.5, 28.0] | [63.5, 63.5, 28.0] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 7964 | 10000 | yes |
| GLB KB | 100 | 500 | yes |
| largest texture px | 1024 | 1024 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| main | refs/FOT-5.jpg | 0.9466 | 0.855 | 0.13 |

Automatic checks: PASS

## Differences from the reference

- Rebuilt after build.sh kept the node tree: the GLB has its `needle` node again (case, dial, lens, needle > pin/pointer/tail, oring, strap, strap_tab).
- Refitted with the current fit_silhouette.py: outline and dial landmark now agree on one camera (pitch -10.2, landmark 0.13 mm, IoU 0.947, outline 0.85 mm). The earlier -19 vs -7 degree disagreement is gone.
- Needle at 0 m in the render, ~300 m in the photo: deliberate, the app drives it.
- No "ALTIMASTER GALAXY" or "ALTI-2" on the dial: deliberate (trademarks).
- Side scoops and back plate still guesses (no side photo), as spec.md says.
