# The Coronation of Napoleon (/sacre)

Jacques-Louis David, *Sacre de l'empereur Napoléon Ier et couronnement de l'impératrice Joséphine*, 1805 to 1807
(Louvre INV 3699), at its real size, shown as the Louvre hangs it in the Salle Daru (room 702). Built with the
building-3d-replicas skill (references/flat.md): `./build.sh` runs fetch.sh, textures.py, assemble.py (Blender) and the
KTX2 encode, and copies the results to apps/sacre/public. Sizes in params.json; each one's source below.

Not the Versailles replica (David, 1808 to 1822): the 46008 x 28664 Google Art Project file on Commons is that one.

## What is measured, what is estimated

| Part | How it was made | Standing |
|---|---|---|
| Painted face | Photograph of the whole painting in its frame (refs/SOURCES.md), cut into 3 x 2 tiles over the sight opening | Measured: the real thing at 0.9 mm/px (0.8 mm/px in the 4k tiles) |
| Canvas size | 9790 x 6210 mm (Louvre, POP Joconde record 000PE000839; Wikipedia) | Measured |
| Sight opening | Canvas less a 17 mm rebate on each side | Rebate estimated (`rebate`) |
| Photograph's extent | Its edges are the frame's sight edges: registered (SIFT + homography) onto three other photographs, it maps to the full canvas inside the frame in each | Checked |
| Photograph's ratio | 1.609 against the sight's 1.580: stretched 1.8 % taller to the published size (the photographer's straightening is the likelier error) | Published size wins |
| Seam | One horizontal seam 34.7 % down the sight, traced as a straight dark line across the photo from x = 1200 to 10800 px | Measured; its ridge's height and width estimated (`seam_*`) |
| Weave | Plain weave, about 1 mm per thread, as a tiling detail map | Estimated |
| Varnish | Satin paint under a thin clear coat | Tuned by eye |
| Lining, tacking margins | Relining canvas behind, canvas wrapped round the stretcher | From practice, not documented for this painting |
| Stretcher | Pine, 4 members 110 x 90 mm, 7 vertical bars and 1 horizontal | Count and sizes estimated (`stretcher_*`, `bar*`) |
| Frame | Visible width 360 mm: measured on the CC BY room photograph rectified into the canvas's plane (35, 37.5, 38, 33.5 cm on the four sides). Profile: water-leaf band at the sight edge, wide plain frieze, egg-and-dart ovolo, plain outer edge (photographs) | Width measured; depths, profile heights and ornament repeats estimated (`frame_*`, `egg_period`, `leaf_period`) |
| Plaque | 830 x 110 mm, centred on the bottom rail; text "DAVID (Jacques-Louis) 1748-1825 / SACRE de NAPOLÉON Ier à NOTRE-DAME de PARIS par le PAPE PIE VII" read from cc0_room.jpg | Size measured (the plaque stands out of the canvas's plane, so roughly) |
| Room | Matte terracotta-red wall with faint horizontal joints, a dark base under the frame (about 30 cm), waxed parquet, low brass posts with a cord, daylight from a glass roof | Colour and elements from photographs; sizes estimated |
| Hanging height | Sight's bottom 1.0 m above the floor | Estimated from photographs |

## Tour

Stops are fractions of the photograph (0,0 top left), located on it by eye on full-resolution crops of the figures
themselves (this is the texture, so they can't drift from what is shown):

| Stop | x, y |
|---|---|
| Napoleon's head | 0.585, 0.593 |
| Joséphine's head | 0.498, 0.724 |
| Pius VII (seated, white zucchetto, hand raised) | 0.675, 0.639 |
| Madame Mère, central box | 0.446, 0.526 |
| The Pietà, right edge | 0.95, 0.30 |
| Signature, bottom right | 0.975, 0.975 |

Facts on the cards: Wikipedia, "The Coronation of Napoleon" (commission September 1804, begun 21 December 1805 at
Cluny, finished January 1808 with Georges Rouget, the self-crowning sketch, the Pope's raised hand, Madame Mère's
absence, Montmorency-Laval holding the mantle, provenance 1819 / Versailles / Louvre 1889).

## Unknowns

- The back: no photograph of it exists that we can use. Lining, stretcher and bars drawn from practice.
- The frame's real profile and carving; its depth off the wall.
- Other seams: only one is visible in the photograph.
- The wall's exact colour (photographs disagree with each other by their white balance), the room's size and the
  skylight's layout.
- Colour of the photograph: the gallery's mixed daylight; not corrected.

## Texture budget

Quest 3 resolves about 25 px per degree: about 0.42 mm on the canvas at 60 cm. The photograph has 0.9 mm/px, so it
softens before the headset does closer than about 1.2 m.

| Per tile (3.25 x 3.09 m) | mm per px | Loaded |
|---|---|---|
| 512 (in the GLB) | 6 | at once, stand-in |
| 1024 KTX2 | 3 | at start (6 MB for all six) |
| 4096 KTX2 + seam normal | 0.8 | when the eye is within 3.5 m of the tile (about 14 MB each, Cloudflare's per-file limit is 25 MiB) |

UASTC + Zstandard so soft gradients don't band.
