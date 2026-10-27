# Mona Lisa (/mona)

Leonardo's Mona Lisa (Louvre INV 779) as the object it is, shown as the Louvre shows it. Built with the
building-3d-replicas skill: `./build.sh` runs fetch.sh, textures.py, assemble.py (Blender) and the KTX2 encode, and
copies the results to apps/mona/public. Sizes in params.json; each one's source below.

## What is measured, what is estimated

| Part | How it was made | Standing |
|---|---|---|
| Painted face, bare wood margins, barbe | C2RMF scan of the whole panel, straightened by its fitted edges onto 794 x 534 mm | Measured: the real thing at 0.07 mm/px (0.13 mm/px in the 4k texture) |
| Craquelure and wood relief | Normal map from the scan's thin dark lines (textures.py `relief`) | Placed exactly, depth inferred (`relief_depth_mm`) |
| Varnish shine | Clear coat over satin paint; roughness map rougher in cracks and on bare wood | Tuned by eye |
| Panel size | 794 x 534 mm (Louvre) | Measured |
| Panel thickness | 13 mm (Mona Lisa Project) | Published, one source |
| Warp | Parametric double curvature toward the front, max 11 mm, most on the left | Shape estimated, maximum published |
| Crack | 215 mm from the left at the top edge, 220 at its end, 119 mm long (measured on the scan) | Measured (Louvre: "about 11 cm", to the hairline) |
| Butterfly keys, socket, canvas lining | On the crack; walnut; a third of the thickness | Positions and sizes estimated (`key_*`) |
| Châssis-cadre, crossbars | Oak frame, 4 bars | Count published, sizes estimated (`chassis_*`, `crossbar_*`) |
| Frame | Outside 1010 x 770 mm (Louvre, "with accessory"); cassetta-style profile and punched frieze | Outer size measured; profile and ornament a period stand-in |
| Case | 2.2 x 4.6 x 0.6 m, steel, anti-reflective laminated glass, front shelf with lights (Goppion) | Size published; how far it stands out, the shelf's size, estimated |
| Room | Midnight-blue wall (Louvre 2019), waxed parquet, two lines of stanchions | Colour by description; the rest generic |
| Hanging height | Panel middle at 1.9 m ("high", Louvre) | Estimated from photos |

## Sizes

| Size | Value | Source |
|---|---|---|
| Panel height x width | 794 x 534 mm | Louvre collections, INV 779 (collections.louvre.fr/en/ark:/53355/cl010062370). The Louvre's 2019 press text says 79.4 x 53 cm |
| Same, older figure | 770 x 530 mm | Wikipedia infobox. Not used: the scan's own ratio is 0.6772 against the Louvre's 0.6725 and Wikipedia's 0.688 |
| Scan scale | 14.56 px/mm across, 14.46 down (0.7 % apart) | work/front.json |
| With accessory (frame) | 1010 x 770 mm | Louvre collections |
| Panel thickness | about 13 mm | Mona Lisa Project papers (Gril, Dionisi-Vici et al.) |
| Warp | 11 to 12 mm max deflection, toward the front, doubly curved, largest on the left | Mona Lisa Project; NRC 2004 laser scan reported 12 mm |
| Crack | about 110 mm, from the top edge to the hairline | Louvre collections; Wikipedia; 119 mm on the scan |
| Butterfly keys | 2, walnut, a third of the thickness; upper one lost (1888 to 1905 or 1911), socket and crack lined with canvas | Louvre collections; Wikipedia |
| Châssis-cadre | flexible oak frame (1951), crossbars: beech (1951), maple (1970), sycamore + one metal (2004 to 05); "four crossbars" | Wikipedia; Mona Lisa Project |
| Edges | never cut down: bare wood margins and a "barbe" | Louvre collections; visible on the scan |
| Case | l 220, h 460, d 60 cm; door 2.2 x 3.5 m; glass and front shelf renewed 2019 | Goppion project page |
| Wall | "a very dense shade of blue enriched with subtle variations of black" | Louvre press release, Oct 2019 |

## Sources and licences

See refs/SOURCES.md. Only the C2RMF scan is shipped; everything else is drawn.

## Unknowns

- The back: drawn (poplar grain, keys, lining, châssis) from descriptions. No shippable photo of it exists.
- The frame's real profile and ornament.
- Craquelure depth.
- Varnish gloss and colour of the case light (the Louvre gives no colour temperature; 3000 K used).
- The case's placement in its wall, the shelf's size, the stanchions' distance.

## Texture budget

Quest 3 resolves about 25 px per degree: about 0.21 mm on the panel at 30 cm, 0.42 mm at 60 cm.

| Front texture | mm per px | Loaded |
|---|---|---|
| 512 (in the GLB) | 1.0 | at once, stand-in |
| 2048 x 3072 KTX2 colour, normal, roughness | 0.26 | at start (11 MB) |
| 4096 x 6144 KTX2 colour, normal | 0.13 | within 0.8 m (37 MB) |

UASTC + Zstandard so the sfumato doesn't band. The 4k colour must stay under Cloudflare's 25 MiB per-file limit
(24.4 MB at `-uastc_rdo_l 3`). If it grows, split it into tiles.
