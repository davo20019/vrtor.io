# roadster, round-6

## Sizes (mm)

| Object | Expected | Measured | OK |
|---|---|---|---|
| body | [2004.7, None, 4588.6] | [2000.69, 1066.12, 4588.58] | yes |

## Budget

| What | Value | Limit | OK |
|---|---|---|---|
| triangles | 25752 | 60000 | yes |
| GLB KB | 751 | 3072 | yes |
| largest texture px | 0 | 2048 | yes |

## Fit per photo

| Photo | File | IoU | Outline error (mm) | Landmark error (mm) |
|---|---|---|---|---|
| front | refs/news/ek-roadster-03-carousel-slide-1-tesla-roadster-2026.jpg | 0.9542 | 17.305 | 14.998 |
| front_q34 | refs/press/tesla-Roadster-08-End-Desktop.jpg | 0.9398 | 24.203 | 29.056 |
| q34 | refs/press/Roadster_90.jpg | 0.9217 | 33.658 | 20.537 |
| rear_high | refs/press/Roadster_77.jpg | 0.8798 | 64.895 | 8.629 |
| side | refs/news/ek-roadster-02-pilot-tesla-roadster-2026.jpg | 0.9328 | 27.112 | 12.137 |
| top | refs/press/Roadster_92.jpg | 0.9795 | 13.793 | 11.771 |

Automatic checks: PASS

## Differences from the reference

Cameras: the round-6 fit (fit/<photo>/camera.json). The sheet's renders are lit by review.py's sky, which leaves
the tail face (it faces back and down) dark; under a studio light it is pale, as in the photos (REPORT.md).

- Front: facets, hood, headlights, carbon face and legs match; the light bar reads dimmer than the photo's.
- Front three-quarter: matches; the front wheel sits 60 px from where this photo puts it (open, REPORT.md).
- Side: the door's front shut line stands 55 to 150 mm behind the photo's (deliberate: the guessed hinge, spec.md
  "Doors"); the rest of the side, the trim and the marker match.
- Rear high: fins, side windows' tails, haunches, rear glass, light housing and plate match; the diffuser's strakes
  and end plates reach lower in the render than the photo shows; the outline fits less well than round 5's (0.880).
- q34: matches; the diffuser reads as a block under the sky light.
