# Connected Machu Picchu architectural model

**Machupicchu** by **Ministerio de Cultura Perú**, published 2020-12-17 on [Sketchfab](https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Downloaded 2026-10-01 through the publisher's offered GLB download.

The publisher identifies this [3D Warehouse model](https://3dwarehouse.sketchup.com/model/8f9b368b9bf996b8cf7954975c0b336f/Machu-Picchu-Peru-english-description) as its original source. Credit and links are retained; no institutional endorsement is implied.

## Changes by VRtor

- Preserved all **32,759 triangles**; flattened the export hierarchy, centred the layout, and converted its coordinate scale by 0.01 for approximate human scale. The model is an architectural reconstruction, not a measured whole-site laser scan. Exact dimensions and present-day visitor routes are not verified.
- Removed the original generic surface images and supplied illustrative stone, earth and vegetation colors with procedural mineral grain and a reusable normal/relief sample derived from CAST’s measured Main Temple geometry. These source-based surface cues replace the fabricated brick grid. Their placement and stone colors are illustrative; the whole model remains an architectural reconstruction.
- Compressed the geometry with Draco (16-bit positions, 12-bit normals), without further mesh reduction.
- Derived landing surfaces from supported ground surfaces, excluding cliff edges and body intersections with walls. Teleport and click-to-travel use these surfaces. Continuous desktop/mobile movement can additionally follow narrow treads with five local foot-support checks, a 31 cm step limit, and body clearance checks. Unsupported areas remain inaccessible.
- `citadel.json` records the source GLB hash, scale, bounds, triangle count, navigation surface corners and start position. Regenerate with `scripts/prepare-machu-site.py` and Blender.

The primary experience uses this single connected model. The six detailed **CAST survey closeups** remain separate optional learning studies, retaining their [CC BY-NC 3.0 attribution and restrictions](./CREDITS.md). They are not geographically merged into this reconstruction.

The elevation backdrop remains Mapzen Terrain Tiles, SRTM/GMTED2010 courtesy of USGS, now coloured with Sentinel-2 cloudless 2016 imagery by EOX (CC BY 4.0); see [survey and terrain credits](./CREDITS.md). To fit the connected model, the illustrative local join now flattens a 350 m radius and blends to the elevation relief by 600 m. Neither archaeological model is registered to that terrain.

## Survey-derived surface detail

`../materials/survey-stone-normal.png` and `survey-stone-relief.png` are derived from the **Main Temple** laser mesh supplied by **Instituto Nacional de Cultura (Peru)**, **Center for Advanced Spatial Technologies (University of Arkansas)**, and **Cotsen Institute for Archaeology (UCLA)**, under **CC BY-NC 3.0**. [Full contributors, source archive and restrictions](./CREDITS.md). These adapted maps retain the noncommercial restriction; the Ministry architectural geometry separately remains CC BY 4.0.

`../materials/survey-stone.json` records the source OBJ hash, 4 m × 1.4 m sample, projection, 100% measured coverage, and adaptations. Reproduce with `scripts/bake-machu-stone.py` and Blender. Plane removal, periodic boundary correction and scan-noise filtering produce a mipmapped surface normal; depth supplies illustrative cavity shading and tone. This is not measured color, added geometric detail, or a claim that every facade matches this sample. No photographs or AI-generated images are used.

## Baked shading

`../materials/citadel-ao.ktx2` (from `citadel-ao.jpg`) is ambient occlusion baked in Blender Cycles from this architectural model alone, onto a second UV set added to `citadel.glb` (`TEXCOORD_1`; geometry, normals and the 32,759 triangles are unchanged). Many source faces point into their walls, so both orientations are baked and the brighter kept; faces sealed behind other faces use a neutral value. `citadel-ao.json` records the GLB hash and settings. Regenerate with `scripts/bake-machu-ao.py` after `prepare-machu-site.py`, then `scripts/encode-machu-ktx2.py`. It is illustrative shading, not measured appearance; the terrain is not included.

`citadel-grass.bin` contains 62,016 root positions verified against grass faces of the delivered architectural model. Short opaque 3D blades appear only in nine nearby 20 m tiles, with no alpha cards. They are illustrative vegetation, not a vegetation survey. Regenerate with `scripts/prepare-machu-grass.py`.
