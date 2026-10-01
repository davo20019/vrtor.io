# Connected Machu Picchu architectural model

**Machupicchu** by **Ministerio de Cultura Perú**, published 2020-12-17 on [Sketchfab](https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Downloaded 2026-10-01 through the publisher's offered GLB download.

The publisher identifies this [3D Warehouse model](https://3dwarehouse.sketchup.com/model/8f9b368b9bf996b8cf7954975c0b336f/Machu-Picchu-Peru-english-description) as its original source. Credit and links are retained; no institutional endorsement is implied.

## Changes by vrtor

- Preserved all **32,759 triangles**; flattened the export hierarchy, centred the layout, and converted its coordinate scale by 0.01 for approximate human scale. The model is an architectural reconstruction, not a measured whole-site laser scan. Exact dimensions and present-day visitor routes are not verified.
- Removed the original generic surface images and supplied illustrative stone, earth and vegetation colors with procedural mineral grain and illustrative masonry joints. Appearance is not measured or photographic.
- Compressed the geometry with Draco (16-bit positions, 12-bit normals), without further mesh reduction.
- Derived landing surfaces from supported ground surfaces, excluding cliff edges and body intersections with walls. Locomotion uses these surfaces; unsupported areas remain inaccessible.
- `citadel.json` records the source GLB hash, scale, bounds, triangle count, navigation surface corners and start position. Regenerate with `scripts/prepare-machu-site.py` and Blender.

The primary experience uses this single connected model. The six detailed **CAST survey closeups** remain separate optional learning studies, retaining their [CC BY-NC 3.0 attribution and restrictions](./CREDITS.md). They are not geographically merged into this reconstruction.

The elevation backdrop remains Mapzen Terrain Tiles, SRTM/GMTED2010 courtesy of USGS; see [survey and terrain credits](./CREDITS.md). To fit the connected model, the illustrative local join now flattens a 350 m radius and blends to the elevation relief by 600 m. Neither archaeological model is registered to that terrain.
