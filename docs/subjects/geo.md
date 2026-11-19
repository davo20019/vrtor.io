# Earth experiment (vrtor.io/geo)

Unlisted spike: the whole planet in WebXR from open data only (no keys, no accounts). It starts
as a 3D globe on a table in front of you (globe mode, `src/main.js`): grab it with a grip (or
drag the mouse) to turn it, and zoom into any spot by pulling both grips apart, pushing the
right stick forward, holding a trigger, or the wheel / pinch / + and − on desktop. Zooming in
grows the model around that spot, from the whole planet down to the streets, and once the view
is 300 m up you step into the full-size world there (world mode): walk or fly (hold a trigger
to fly where you point), and B (or zooming out past 30 km) takes you back to the globe. The
places menu (A, X or Y in the headset, `src/vrUi.js`) turns the globe to a place and zooms in.
The left wrist shows where you are, the view height, fps and triangle counts; `?error=2` raises
the terrain error target (fewer tiles). Depth is logarithmic so the near plane can stay at 5 cm
(hands and menus) at every scale.

- Imagery: [Sentinel-2 cloudless 2016](https://s2maps.eu) by EOX, CC BY 4.0, about 10 m per
  pixel (later years are NonCommercial: don't switch layers).
- Terrain: [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Mapzen
  Terrarium), drawn by 3d-tiles-renderer's `TerrariumMeshPlugin`.
- Buildings: [Overture Maps](https://docs.overturemaps.org/examples/overture-tiles/) PMTiles
  (ODbL, mostly OpenStreetMap), extruded per z14 tile in a worker (`src/buildingsWorker.js`)
  below 4 km. The release date is in the URL there: bump it when Overture retires old ones.
- Helsinki, Kalasatama: the City of Helsinki's photo mesh (2017, CC BY 4.0,
  [hri.fi](https://hri.fi/data/en/dataset/helsingin-3d-kaupunkimalli), the 3D Tiles zip at
  3d.hel.ninja/data/mesh/Kalasatama/). We host it ourselves (`src/helsinki.js`):
  1. The download embeds glTF 1.0, which three.js can't read: convert with
     `npx 3d-tiles-tools upgrade -i Kalasatama_Cesium.json -o out/Kalasatama_Cesium.json`
     (Cesium's open tools; about 10 minutes, same 11 GB).
  2. Upload to the `vrtor-geo-data` R2 bucket: set a temporary `UPLOAD_TOKEN` secret on
     vrtor-geo, run `UPLOAD_TOKEN=... node scripts/upload-geo-data.mjs out hel/kalasatama`
     (resumable, about 57,500 requests: mind the Workers free plan's 100,000 a day), then
     `npx wrangler secret delete UPLOAD_TOKEN -c apps/geo/wrangler.jsonc`.
  3. The browser reads it from `https://data.vrtor.io/hel/kalasatama/...`, the bucket's custom
     domain (CORS: vrtor.io and localhost), so tile requests don't run any Worker.
  The mesh needs no height offset (its water is within a metre of the terrain's), and the
  terrain is stencilled out under it. Overture blocks are skipped inside its 250 m tiles.
- Imagery, terrain and buildings are streamed straight from their public hosts; the licenses
  allow copying them to R2 later. The credits must stay on screen (page footer and headset panel).
- Built on three.js with [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS): its
  Babylon adapter is still early (right-handed scenes only, box culling, no memory accounting), so
  presence and xr-shell are not wired in.
