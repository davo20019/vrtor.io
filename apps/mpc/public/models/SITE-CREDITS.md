# Connected Machu Picchu architectural model

**Machupicchu** by **Ministerio de Cultura Perú**, published 2020-12-17 on [Sketchfab](https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Downloaded 2026-10-01 through the publisher's offered GLB download.

The publisher identifies this [3D Warehouse model](https://3dwarehouse.sketchup.com/model/8f9b368b9bf996b8cf7954975c0b336f/Machu-Picchu-Peru-english-description) as its original source. Credit and links are retained; no institutional endorsement is implied.

## Changes by VRtor

- Preserved all **32,759 triangles**; flattened the export hierarchy, centred the layout, and converted its coordinate scale by 0.01 for approximate human scale. The model is an architectural reconstruction, not a measured whole-site laser scan. Exact dimensions and present-day visitor routes are not verified.
- Removed the original generic surface images (a fabricated brick grid) and replaced them with photo scans of real surfaces, sampled in world space at their real size, and with masonry laid along each wall at sizes measured on CAST's laser scans; see [Photographed surfaces](#photographed-surfaces) and [Masonry](#masonry). The whole model remains an architectural reconstruction.
- Compressed the geometry with Draco (16-bit positions, 12-bit normals), without further mesh reduction.
- Derived landing surfaces from supported ground surfaces, excluding cliff edges and body intersections with walls. Teleport and click-to-travel use these surfaces. Continuous desktop/mobile movement can additionally follow narrow treads with five local foot-support checks, a 31 cm step limit, and body clearance checks. Unsupported areas remain inaccessible.
- `citadel.json` records the source GLB hash, scale, bounds, triangle count, navigation surface corners and start position. Regenerate with `scripts/prepare-machu-site.py` and Blender.

The primary experience uses this single connected model. The six detailed **CAST survey closeups** remain separate optional learning studies, retaining their [CC BY-NC 3.0 attribution and restrictions](./CREDITS.md). They are not geographically merged into this reconstruction.

The elevation backdrop remains Mapzen Terrain Tiles, SRTM/GMTED2010 courtesy of USGS, now coloured with Sentinel-2 cloudless 2016 imagery by EOX (CC BY 4.0); see [survey and terrain credits](./CREDITS.md). To fit the connected model, the illustrative local join now flattens a 350 m radius and blends to the elevation relief by 600 m. Neither archaeological model is registered to that terrain.

## Photographed surfaces

The citadel's surfaces are CC0 photo scans (albedo and normal map), regraded so their mean colour is the colour measured on photographs of Machu Picchu. Vertical faces of every material are stone, since the source groups terrace walls with the lawns.

| Surface | Scan | Size of one tile | Colour measured on the photographs (sRGB) |
| --- | --- | ---: | --- |
| Stones of the walls, wall tops | Poly Haven, [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) (`rock_boulder_dry`), a different patch on every stone | 1.8 m | 144, 134, 126 (7 photographs) |
| Lawns | ambientCG, [Grass 004](https://ambientcg.com/view?id=Grass004) | 1.4 m | 117, 125, 42 (sunlit half, 4 photographs) |
| Earth floors, mud mortar | Poly Haven, [Dirt Floor](https://polyhaven.com/a/dirt_floor) (`dirt_floor`) | 2.07 m | 181, 158, 138 (the Main Temple floor, 2 photographs) |
| Laser-survey closeups | Poly Haven, [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) (`rock_boulder_dry`), over the scans' own grey values | 1.8 m | as the walls |

Poly Haven and ambientCG publish these under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). The photographs (Wikimedia Commons; CC BY, CC BY-SA and public domain, listed in `assets-src/machu/photo_textures.py`) are used only to measure colour and are not shipped. In the scene a gain per surface brings the rendered colour, under the scene's sun and sky, to the photographs' mean, checked by sampling rendered pixels the same way: stone 141, 131, 124 at eye level and 162, 149, 141 from above. Lawns and floors use stochastic tiling (three shifted reads blended on a triangle grid), so the scans don't show a repeat. Regenerate with `python3 -I assets-src/machu/photo_textures.py`.

## Masonry

The stones are laid out in the scene along each wall, in that wall's own frame: courses run level, start at its base and the last one finishes at its top, and a building's courses meet round its corners. Each stone takes a different patch of the granite scan and its own tone, so nothing repeats. Course and stone sizes are measured on CAST's laser scans (CC BY-NC 3.0, [credits](./CREDITS.md)), read as relief images at 1 cm a pixel. The scans' mesh (31 mm edges on the Torreón, 47 mm on the Principal Temple) is too coarse for the rounded arrises and splits the Principal Temple's long blocks, so those come from full-size photographs (Wikimedia Commons: Peru-174 by Dennis G. Jarvis, CC BY-SA 2.0; Machu Picchu, Peru (116) by Laslovarga, CC BY-SA 4.0; not shipped), measured across the joints and scaled by the scans' course heights (about ±15%):

| Masonry | Measured on | Courses | Stones | Joints |
| --- | --- | --- | --- | --- |
| Coursed ashlar | Torreón (curved wall, 4.50 m radius) | 0.20-0.32 m, about 0.25 | 0.28-0.60 m, median about 0.40 | hairline; arrises rounded over about 17 mm |
| Megalithic ashlar | Principal Temple | about 0.80 m at the base to 0.30 m at the top | 1.8-3 course heights long | hairline; arrises rounded over about 35 mm |
| Rustic, roughly coursed (pirka) | Knob Room, Water Mirrors | 0.24-0.36 m, about 0.28 | 0.22-0.60 m, median about 0.40 | mud, a few cm (taken as 3 cm) |

Which walls are ashlar is in `citadel-masonry.json`, made by `assets-src/machu/masonry_zones.py`. The model carries no building names, so it is registered to the ruins mapped in [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL) through four landmarks: the Sacred Rock and House of the Guardian pads, the Intihuatana stone and the Torreón, the model's only curved building. The fit has residuals of 10 to 25 m (the model is schematic), so each building is matched to the walls standing there and checked by its shape. Ashlar: the Torreón, the Royal Residence beside it and the Intihuatana (coursed), and the Sacred Plaza court (megalithic). Every other wall, the Water Mirrors and the Condor included, is rustic; on site some of them have finer stretches the model can't place. The stones are generated to the measured sizes, not copied stone by stone from the real walls.

## Baked shading

`../materials/citadel-ao.ktx2` (from `citadel-ao.jpg`) is ambient occlusion baked in Blender Cycles from this architectural model alone, onto a second UV set added to `citadel.glb` (`TEXCOORD_1`; geometry, normals and the 32,759 triangles are unchanged). Many source faces point into their walls, so both orientations are baked and the brighter kept; faces sealed behind other faces use a neutral value. `citadel-ao.json` records the GLB hash and settings. Regenerate with `scripts/bake-machu-ao.py` after `prepare-machu-site.py`, then `scripts/encode-machu-ktx2.py`. It is illustrative shading, not measured appearance; the terrain is not included.

`citadel-grass.bin` contains 62,016 root positions verified against grass faces of the delivered architectural model. Short opaque 3D blades appear only in nine nearby 20 m tiles, with no alpha cards. They are illustrative vegetation, not a vegetation survey. Regenerate with `scripts/prepare-machu-grass.py`.
