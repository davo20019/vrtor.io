# Machu Picchu survey assets — noncommercial educational use

Source: [Machu Picchu, Peru — CAST](https://gmv.cast.uark.edu/scanning-2/data/machu-picchu-3d-data/).
License: [Creative Commons Attribution–NonCommercial 3.0 Unported](https://creativecommons.org/licenses/by-nc/3.0/).

Credit: **Instituto Nacional de Cultura (Peru)**, **Center for Advanced Spatial Technologies (University of Arkansas)**, and **Cotsen Institute for Archaeology (UCLA)**.

Data developed under the authority of Instituto Nacional de Cultura, Vladimir Dávila (Arquitecto del P.A.N. Machu Picchu, Director del P.A.N. Machu Picchu, Dirección Regional de Cultura Cusco) and Fernando Astete (National Archaeological Park of Machu Picchu).

Data acquired, processed and distributed by CAST staff Snow Winters, Malcolm Williamson and Katie Simon, and by students in the 2009 Cotsen Institute for Archaeology (UCLA) Cuzco/Machu Picchu Field School, Alexei Vranich, Director. CAST describes survey campaigns in 2005 and 2009.

## Published downloads and delivered geometry

| Delivered asset | Original archive | Triangles retained |
| --- | --- | ---: |
| main-temple.glb | [Main_Temple_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Main_Temple_50.zip) | 224,445 |
| sun-temple.glb | [Temple_Sun_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Temple_Sun_50.zip) | 546,137 |
| intihuatana.glb | [Intiwatana_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Intiwatana_50.zip) | 484,105 |
| condor-temple.glb | [Temple_Condor_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Temple_Condor_50.zip) | 1,999,964 |
| water-room.glb | [Water_Room_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Water_Room_50.zip) | 481,215 |
| knob-room.glb | [Knob_Room_50.zip](https://cast.uark.edu/assets/images/Education/Geomatics_Archaeology/Knob_Room_50.zip) | 328,205 |

All **4,064,071 triangles** in the published OBJ meshes are retained. These archives were already reduced by the provider; “full detail” here refers to these downloads, not the original unreduced survey. The linked archives are available from the blue map markers on the source page. The whole-site download is a PolyWorks point-cloud project, not a ready textured city mesh.

## Adaptations by VRtor

- Converted OBJ to self-hosted GLB; converted the Temple of the Sun and Temple of the Condor millimetre coordinates to metres.
- Centred each area independently, with no change to its proportions. Areas are **not** registered into a continuous whole-site reconstruction.
- Preserved every published triangle; smooth normals and Draco compression (16-bit positions, 12-bit normals), without additional decimation.
- Preserved and normalized the original 8-bit grayscale vertex values; repaired reversed face winding in the Condor archive.
- The source OBJ meshes contain no photographic textures. Their grey values are multiplied by a CC0 photo scan of weathered granite, graded to the stone colour measured on photographs of the site ([Photographed surfaces](./SITE-CREDITS.md#photographed-surfaces)). Lighting, sky and local outdoor ground are illustrative.
- Derived restricted teleport surfaces from supported, relatively level scan surfaces. Gaps, walls and steep surfaces remain excluded.
- The catalog image is a rendering of this adapted noncommercial educational experience and carries the same source attribution and noncommercial restriction.

The experience is offered for free educational use, with no advertising, subscriptions, purchase links or paid-product promotion within it. These assets and their adapted versions must not be incorporated into paid products or commercial promotional material without separate permission from the rights holders. Free access alone does not determine whether other reuse is noncommercial.

This file, the experience’s About panel, and the headset introduction identify the source and adaptations. The adapted survey assets remain CC BY-NC 3.0. No endorsement by the credited institutions is implied.

## Andean terrain backdrop

Background heights are resampled from [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), accessed 2026-10-01. **SRTM/GMTED2010 data courtesy of the U.S. Geological Survey**, via Mapzen. These source datasets are public domain; see the provider’s [attribution and source terms](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

`andes-height.bin` is a 513×513 grid over a 10 km square centred at approximately 13.1635°S, 72.5462°W, with heights relative to the centre elevation. `andes.json` records tile URLs, hashes, access date and processing. Produced by `scripts/prepare-machu-terrain.py` from Terrarium height tiles using the [documented encoding](https://github.com/tilezen/joerd/blob/master/docs/formats.md). Scene colors are illustrative; the central 350 m is flattened, blending to the resampled relief at 600 m. The independent survey meshes are not georeferenced to the terrain. This backdrop conveys the surrounding topography; it must not be presented as a measured registration of the archaeological structures or used for navigation.

### Distant ranges and mountain colour

`andes-far-height.bin` is a 257×257 grid over a 40 km square on the same centre and reference elevation, resampled from Terrarium zoom 12 tiles (same Mapzen/USGS sources). The scene removes its central 10 km square, where the finer grid is used.

Mountain colour: **Sentinel-2 cloudless 2016** by **EOX IT Services GmbH** (contains modified Copernicus Sentinel data 2016), [s2maps.eu](https://s2maps.eu), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `../materials/andes-near.jpg` (10 km, zoom 14) and `andes-far.jpg` (40 km, zoom 13), shipped as GPU-compressed `.ktx2` copies, are reprojected from Web Mercator to the local square, bilinearly resampled and brightened in the shader to a canopy-like albedo. Viewed from the ground, steep slopes show the stretching expected from overhead imagery. Within about 800 m of the citadel the imagery fades to the illustrative cover, since the reconstruction is not georeferenced. `andes-landscape.json` records tile URLs, hashes, access date and processing. Regenerate with `python3 scripts/prepare-machu-landscape.py`.
