# Connected Machu Picchu architectural model

**Machupicchu** by **Ministerio de Cultura Perú**, published 2020-12-17 on [Sketchfab](https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Downloaded 2026-10-01 through the publisher's offered GLB download.

The publisher identifies this [3D Warehouse model](https://3dwarehouse.sketchup.com/model/8f9b368b9bf996b8cf7954975c0b336f/Machu-Picchu-Peru-english-description) as its original source. Credit and links are retained; no institutional endorsement is implied.

## Changes by VRtor

- Preserved all **32,759 triangles**; flattened the export hierarchy, centred the layout, and converted its coordinate scale by 0.01 for approximate human scale. The model is an architectural reconstruction, not a measured whole-site laser scan. Exact dimensions and present-day visitor routes are not verified.
- Removed the original generic surface images (a fabricated brick grid) and replaced them with photo scans of real surfaces, sampled in world space at their real size; see [Photographed surfaces](#photographed-surfaces). The whole model remains an architectural reconstruction.
- Compressed the geometry with Draco (16-bit positions, 12-bit normals), without further mesh reduction.
- Derived landing surfaces from supported ground surfaces, excluding cliff edges and body intersections with walls. Teleport and click-to-travel use these surfaces. Continuous desktop/mobile movement can additionally follow narrow treads with five local foot-support checks, a 31 cm step limit, and body clearance checks. Unsupported areas remain inaccessible.
- `citadel.json` records the source GLB hash, scale, bounds, triangle count, navigation surface corners and start position. Regenerate with `scripts/prepare-machu-site.py` and Blender.

The primary experience uses this single connected model. The six detailed **CAST survey closeups** remain separate optional learning studies, retaining their [CC BY-NC 3.0 attribution and restrictions](./CREDITS.md). They are not geographically merged into this reconstruction.

The elevation backdrop remains Mapzen Terrain Tiles, SRTM/GMTED2010 courtesy of USGS, now coloured with Sentinel-2 cloudless 2016 imagery by EOX (CC BY 4.0); see [survey and terrain credits](./CREDITS.md). To fit the connected model, the illustrative local join now flattens a 350 m radius and blends to the elevation relief by 600 m. Neither archaeological model is registered to that terrain.

## Photographed surfaces

The citadel's surfaces are CC0 photo scans (albedo and normal map), regraded so their mean colour is the colour measured on photographs of Machu Picchu. Vertical faces of every material are stone, since the source groups terrace walls with the lawns.

| Surface | Scan | Size of one tile | Colour measured on the photographs (sRGB) |
| --- | --- | ---: | --- |
| Walls and wall tops | Poly Haven, [Stone Wall](https://polyhaven.com/a/stone_wall) (`stone_wall`): rough fieldstone in mud, like the citadel's pirka masonry | 2.0 m | 144, 134, 126 (7 photographs) |
| Lawns | ambientCG, [Grass 004](https://ambientcg.com/view?id=Grass004) | 1.4 m | 117, 125, 42 (sunlit half, 4 photographs) |
| Earth floors | Poly Haven, [Dirt Floor](https://polyhaven.com/a/dirt_floor) (`dirt_floor`) | 2.07 m | 181, 158, 138 (the Main Temple floor, 2 photographs) |
| Laser-survey closeups | Poly Haven, [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) (`rock_boulder_dry`), over the scans' own grey values | 1.8 m | as the walls |

Poly Haven and ambientCG publish these under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). The photographs (Wikimedia Commons; CC BY, CC BY-SA and public domain, listed in `assets-src/machu/photo_textures.py`) are used only to measure colour and are not shipped. In the scene a gain per surface brings the rendered colour, under the scene's sun and sky, to the photographs' mean, checked by sampling rendered pixels the same way. Every wall is the same rough masonry: the scene does not tell the fine ashlar of the temples from the rough walls, and the stones do not follow the model's courses. Regenerate with `python3 -I assets-src/machu/photo_textures.py`.

## Baked shading

`../materials/citadel-ao.ktx2` (from `citadel-ao.jpg`) is ambient occlusion baked in Blender Cycles from this architectural model alone, onto a second UV set added to `citadel.glb` (`TEXCOORD_1`; geometry, normals and the 32,759 triangles are unchanged). Many source faces point into their walls, so both orientations are baked and the brighter kept; faces sealed behind other faces use a neutral value. `citadel-ao.json` records the GLB hash and settings. Regenerate with `scripts/bake-machu-ao.py` after `prepare-machu-site.py`, then `scripts/encode-machu-ktx2.py`. It is illustrative shading, not measured appearance; the terrain is not included.

`citadel-grass.bin` contains 62,016 root positions verified against grass faces of the delivered architectural model. Short opaque 3D blades appear only in nine nearby 20 m tiles, with no alpha cards. They are illustrative vegetation, not a vegetation survey. Regenerate with `scripts/prepare-machu-grass.py`.
