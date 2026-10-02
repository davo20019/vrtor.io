# 3D asset credits

These files come from the Acento VR asset pipeline (accent.learnenglishsounds.com), which converted and optimized them for headsets.

## People and motion capture: Microsoft Rocketbox (MIT)

https://github.com/microsoft/Microsoft-Rocketbox

- `avatars/Female_Adult_04`, `avatars/Female_Adult_09`, `avatars/Male_Adult_05`
- `animations/*`: Rocketbox animation clips on the shared Bip01 skeleton
- `crowd/crowd.a1a787aa.glb`: seated crowd baked from Rocketbox adult avatars

Copyright (c) Microsoft Corporation. Licensed under the MIT License.

## Rooms and venues (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/)

- `rooms/cafe_misti.22c4cc62.glb`: "Cafe-Misti" by Simit Rajwadi, https://sketchfab.com/3d-models/cafe-misti-419c3293b0e54313be4b1f02845d606a. Cleaned up, walls added, lighting baked under the CC0 Poly Haven sky "kloofendal_48d_partly_cloudy_puresky".
- `venues/keynote_hall.96a1606d.glb` and `venues/keynote_hall.env.f59a7fbf.jpg`: "Keynote hall" (venue stage for great events) by QuarizonStudio, https://sketchfab.com/3d-models/venue-stage-for-great-events-d74b3baa5a74430fb3717cfa3d883476. Cropped, stalls seats removed, gaps backfilled from a panorama of it.

## Space: Mars

- `space/perseverance.glb`: "Mars 2020 Perseverance Rover", NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources. NASA states these assets are free and without copyright. Courtesy NASA/JPL-Caltech. NASA does not endorse VRtor.
- `space/rock_07`, `space/moon_rock_03`, `space/ground/aerial_sand_*`: Poly Haven (https://polyhaven.com), CC0. Tinted for Mars.

## Taj Mahal

- **Taj Mahal 3D Model** by **Dinendra Neyo (@NeyoZ)** — [original model](https://sketchfab.com/3d-models/taj-mahal-3d-model-1eb09052f6cd421caeaa6cb3204cb15d), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Served at `/taj/models/taj-mahal.glb`. Changes: hierarchy baked, square plinth normalized to approximately 95.4 metres, full geometry compressed with Draco (16-bit positions, 12-bit normals), placeholder colors replaced with marble and metal materials. No mesh decimation: all 409,419 triangles in the downloaded GLB are retained. Source is an artistic reconstruction, not a measured survey. Garden approach and educational overlays authored by VRtor.
- **Draco decoders** — Google Draco, Apache 2.0, copied from the existing Space experience. See [Draco license](https://github.com/google/draco/blob/main/LICENSE).
- Educational references: [UNESCO Taj Mahal](https://whc.unesco.org/en/list/252/), [official architecture](https://tajmahal.gov.in/architecture.aspx), [official exteriors](https://tajmahal.gov.in/the-taj-exteriors.aspx), [official outlying buildings](https://tajmahal.gov.in/outlying-building.aspx).

## Machu Picchu — free noncommercial educational walkthrough

The connected architectural reconstruction is **Machupicchu** by **Ministerio de Cultura Perú**, [source on Sketchfab](https://sketchfab.com/3d-models/machupicchu-d59370ac4a444628b95081f5bb7bbd02), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The publisher identifies the [original 3D Warehouse model](https://3dwarehouse.sketchup.com/model/8f9b368b9bf996b8cf7954975c0b336f/Machu-Picchu-Peru-english-description). All 32,759 triangles retained; coordinates centred/scaled, materials adapted with illustrative procedural stonework, compressed with Draco. Dimensions and current visitor routes are approximate. Catalog image `/assets/cards/machu-picchu.jpg` renders this adapted reconstruction. Detailed changes: [`/mpc/models/SITE-CREDITS.md`](/mpc/models/SITE-CREDITS.md).

Six optional laser-scanned learning closeups come from [CAST's Machu Picchu survey](https://gmv.cast.uark.edu/scanning-2/data/machu-picchu-3d-data/), [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/). Credit: Instituto Nacional de Cultura (Peru), Center for Advanced Spatial Technologies (University of Arkansas), and Cotsen Institute for Archaeology (UCLA). Detailed contributors, archive links, changes and restrictions: [`/mpc/models/CREDITS.md`](/mpc/models/CREDITS.md). All 4,064,071 triangles from the six published OBJ downloads are retained. Survey areas are separate captures, not registered into the reconstruction. This experience remains free without ads, subscriptions or paid-product promotion. Commercial reuse of the survey assets requires separate permission.

Learning references: [UNESCO](https://whc.unesco.org/en/list/274/), [Ministry of Culture research publication, volume I](https://www.machupicchu.gob.pe/wp-content/uploads/2024/05/1-6-MACHUPICCHU-INVESTIGACIONES-INTERDISCIPLINARIAS-TOMO-I.pdf), [Temple of the Condor discussion](https://www.machupicchu.gob.pe/wp-content/uploads/2022/02/08-Art.-Machu-Picchu-el-centro-sagrado.pdf).

Machu Picchu mountain backdrop: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), SRTM/GMTED2010 data courtesy of the U.S. Geological Survey. Public-domain source data; [provider attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Heights resampled out to 20 km, local join modified; archaeological meshes are not georeferenced to this backdrop. Tile URLs and processing recorded in `/mpc/models/andes.json`.

Machu Picchu mountain colour: **Sentinel-2 cloudless 2016** by **EOX IT Services GmbH** (contains modified Copernicus Sentinel data 2016), [s2maps.eu](https://s2maps.eu), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reprojected, resampled and brightened; within about 800 m of the citadel it fades to illustrative cover. Tile URLs and processing recorded in `/mpc/models/andes-landscape.json`.

## Wright Flyer

- `cards/wright-flyer.jpg`: rendered from vrtor.io/fly, the Smithsonian National Air and Space Museum's 3D scan of the 1903 Wright Flyer (CC0), colored by VRtor. Sources: [`/fly/models/CREDITS.md`](/fly/models/CREDITS.md).

## Orca

- `cards/orca.jpg`: rendered from vrtor.io/orca: the University of Pisa Natural History Museum's 3D scans of a killer whale (C 301) and a bottlenose dolphin (C 281), CC BY-SA 4.0, adapted by vrtor; the orca's see-through body is drawn by vrtor. This image is shared under CC BY-SA 4.0. Sources: [`/orca/models/CREDITS.md`](/orca/models/CREDITS.md).
