# vrtor.io

Free 3D learning experiences, one per subject, that open in a headset's web browser.
Each subject has a short address (`vrtor.io/mpc`) because typing with a VR controller
is painful. In every 3D subject, visitors can also see and talk to each other (see Visitors below).

## Stack

One repo, one Cloudflare Worker per app (npm workspaces):

```
apps/home/       vrtor.io itself: the catalog site + the router Worker ("vrtor")
apps/spc/        Space: Perseverance on Mars (Babylon.js WebXR, Vite), Worker "vrtor-spc"
apps/taj/        Taj Mahal, Worker "vrtor-taj"
apps/mpc/        Machu Picchu (with visitors), Worker "vrtor-mpc"
apps/apo/        Apollo 11: inside Columbia in lunar orbit, Worker "vrtor-apo"
apps/fly/        Wright Flyer: the 1903 Flyer at Kill Devil Hills, Worker "vrtor-fly"
apps/orca/       Orca: a killer whale skeleton, inside out, Worker "vrtor-orca"
apps/snd/        Sound Lab: English sound contrasts and the LES sound library, Worker "vrtor-snd"
apps/geo/        Earth (unlisted experiment): open imagery, terrain and buildings from orbit to
                 street level (three.js + 3d-tiles-renderer, not Babylon), Worker "vrtor-geo"
packages/xr-shell/  shared WebXR pieces for every subject (Quest-tuned session setup,
                 teleport, comfort fade, frame-rate governor, floating info card)
```

- **apps/home** (`wrangler.jsonc`): Workers Static Assets from `public/` (plain HTML/CSS/JS, no build step).
  - `public/journey.js`: the scroll-driven 3D catalog (three.js via import map). Asset licenses in `public/assets/CREDITS.md`.
  - `src/index.js` runs first for every request:
    - `/<code>/*` for subjects built here (`service` in `src/subjects.js`) → forwarded to that subject's Worker through a **service binding** (same origin: one WebXR permission prompt, shared storage and, later, one sign-in)
    - other subject links → 302 to where that app lives (Communication stays on the Acento site)
    - `POST /api/waitlist` → `WAITLIST` KV and the Brevo list "vrtor waitlist" (#23, folder vrtor), subjects in the `VRTOR_SUBJECTS` attribute. Needs the `BREVO_API_KEY` secret; without it, signups only go to KV.
      New signups get a welcome email (`src/welcome-email.js`) from `hello@vrtor.io` (`WELCOME_FROM`; empty turns it off). Mail to any @vrtor.io address is forwarded to David's Gmail by Cloudflare Email Routing (catch-all rule).
- **apps/spc**: Vite build with `base: '/spc/'` into `dist/spc/`, served by its own Worker. Not public on its own (`workers_dev: false`); only reachable through vrtor.io/spc. It loads the shared 3D files from `/assets/space/` on the same origin and self-hosts the Draco decoder.

```bash
npm install
npm run dev      # http://localhost:8790 (all Workers, rebuilds on change)
npm run deploy   # deploys vrtor-spc first (the binding needs it), then vrtor
```

Test in a headset: WebXR needs HTTPS, so tunnel the dev server and open the printed URL + `/spc/` in the headset browser:

```bash
cloudflared tunnel --url http://localhost:8790
```

Read the waitlist:

```bash
npx wrangler kv key list --binding WAITLIST --remote -c apps/home/wrangler.jsonc
```

## Earth experiment (vrtor.io/geo)

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

## Visitors: seeing and talking to each other

Anyone with a subject open can choose **Join others** to appear to everyone else in it as a stylized avatar (their mouth moves when they talk), and hear people near them. The mic stays off until they choose **Talk**; voices are spatial and fade out by 30m; tapping someone (or pointing and pulling the trigger) mutes them for you only. A chime and a short notice mark arrivals and departures.

- Names: random by default. On a flat screen, **Change name** (kept in the browser for next time); in the headset, **New name** picks another random one. The server refuses names that pose as staff or contain slurs or profanity (`cleanName` in `apps/home/src/presence.js`).
- Headset first: the walk card has a one-step **Join N here**, and **B or Y** joins, then turns the mic on and off, with a notice floating ahead. If the browser can't ask for the mic inside VR, the card says to tap Talk once outside VR.
- Headset budget: an avatar is 6 draw calls plus its name tag, all sharing one material; faces are dropped beyond 20m and avatars beyond 45m; anyone inside your personal space (0.55m) isn't drawn; HRTF spatial audio only within 8 to 10m.

- Server: `apps/home/src/presence.js`, a Durable Object per room at `vrtor.io/api/presence/<code>` (WebSocket). Rooms hold 12 people; more open `<code>:1`, `<code>:2`, ... Names are assigned by the server.
- Client: `packages/xr-shell/src/presence.js` (socket, avatars), `voice.js` (peer-to-peer WebRTC audio, signaled through the room), `presenceUi.js` (bar buttons and the headset card page).
- Kill switches: set `PRESENCE` or `VOICE` to `"off"` in `apps/home/wrangler.jsonc` (or the dashboard) and deploy; connected rooms restart under the new setting.
- Debug: `?xrdebug` exposes `window.vrtorPresence`; `vrtorPresence.stats()` shows each voice connection and its audio level.
- No TURN relay yet, so a few network pairs (strict NATs) won't hear each other; Cloudflare Realtime TURN fixes that if it shows up in testing.

Adding it to a subject (see `apps/taj/src/main.js` for an orbit-camera subject, `apps/mpc/src/main.js` for one with its own walker):

```js
const presence = createPresence(scene, { subject: 'xyz', getPose, onChange });
const updateBar = mountPresenceControls(presence, document.querySelector('.presence-controls'));
// getPose() → { area, head, forward, left?, right? } or null; in the headset, show presenceCard(presence, action, back)
// xrPose(rig) covers the headset; orbitPose(camera, groundMeshes) stands a flat-screen orbit viewer on the ground below the camera
```

## Adding a subject

1. Copy `apps/spc` to `apps/<code>`: set `base`/`outDir` in `vite.config.js` and `name` in `wrangler.jsonc`.
2. In `apps/home`: add `{ code, service }` to `src/subjects.js` and the service binding to `wrangler.jsonc`.
3. Add it to `scripts/dev.js` and the root `deploy` script, and update its card in `apps/home/public/index.html`.
4. Optional: visitors (see above). The presence route accepts any subject with a `service`.

## Sound Lab (`vrtor.io/snd/`)

A browser and WebXR pronunciation lab connected to Learn English Sounds. Four guided
American English contrasts (ship/sheep, cat/cut, thin/sin, vest/best) follow the same
sequence: compare examples, answer six shuffled listening questions, inspect a schematic
mouth position, then record and compare words and sentences. Listening, mouth exploration,
and speaking occupy separate stations. Lesson steps move between them with a comfort fade.
In VR, squeeze to grab a word and release it in the gold answer ring, or point and tap a
word, then the ring. HTML answer buttons are also available. The enlarged mouth cutaway
rotates, animates between sounds, and lets you highlight tongue, teeth and lips. Live 3D
volume bars respond to the microphone while recording; they do not assess pronunciation.
Station controls keep the lesson playable with the large panel closed. A/X opens the menu;
teleport and snap turns use the shared XR shell. Visitors and spatial voice are optional;
starting a recording mutes your visitor microphone and does not turn it back on automatically.

The library contains the 44 LES guides, including regional entries and the /ju/ sound
pattern. British centering-diphthong guides are labeled and use British examples; core
lessons use American English. Mouth animations cover the eight guided sounds only and
are simplified demonstrations, not anatomical measurements. Every guide offers its
mouth instructions, example audio, private recording playback, and a link to its full
LES page. Deep links from LES can open `/snd/?sound=short-i` or
`/snd/?lesson=ship-sheep`. The LES site itself is not modified here.

Examples are bundled MP3s made with synthesized macOS voices (Samantha for American,
Daniel for British). Recordings remain in memory in the browser tab, stop after eight
seconds, and are discarded on exercise changes, backgrounding, or leaving. Only listening
results and recording counts persist in localStorage. Speaking is self-review, without
automatic pronunciation scores; there is no shared login or cross-site progress sync.

- Build: `npm run build -w @vrtor/snd`; checks: `npm run test:snd`.
- Development: `npm run dev` includes Sound Lab at `/snd/`.
- Deployment: deploy `vrtor-snd` before the home Worker; the root deploy script does this.
- Refresh LES data: `node scripts/import-sound-guides.mjs /path/to/learnenglishsounds`.
- Rebuild audio on macOS with `say` and `ffmpeg`: `node scripts/build-sound-audio.mjs`.

The catalog, `/sounds`, `/sound-lab`, `/english`, sitemap, and headset room menu all
include Sound Lab. Desktop/mobile browser flows, bundled audio, recording lifecycle,
local routing and caching have been checked. Grip/drop acceptance, input fallback, and controller/session cleanup have automated checks.
Physical headset comfort, reach, controller behavior, menu placement,
and microphone permission behavior still require a headset check.

## How Accent (accent.learnenglishsounds.com/vr) plugs in

Accent is a Babylon.js WebXR scene living at `/vr` inside the Acento React app
(Firebase Hosting + Cloud Run API). It signs in with a Firebase ID token or a
paired-headset device token stored in `localStorage`. Because that storage is
per-origin, the integration is staged:

| Phase | What | Effort | Notes |
|---|---|---|---|
| **1 (now)** | `vrtor.io/ac` → 302 to `accent.learnenglishsounds.com/vr?ref=vrtor` | done | Existing logins and paired headsets keep working. `ref=vrtor` lets Acento attribute signups. |
| **2** | Serve the same build at `accent.vrtor.io` | small | Add custom domain in Firebase Hosting, CNAME in Cloudflare, add `accent.vrtor.io` to Firebase Auth authorized domains and to the API's CORS list. Switch `rooms.js` to the new URL. Users re-pair the headset once (new origin). |
| **3** | One VRtor account + one subscription across rooms | medium | Reuse the `lescoach` Firebase project as the identity provider for every room; move the Acento premium check (`/vr/me` → `is_premium`) to a shared entitlement ("VRtor Plus"). |
| **4** | Rooms as packages | larger | Extract the VR shell (controller input, menus, perf tuning, audio capture, AI live client) from `frontend/src/vr` into a shared package so new rooms (Interview, Café…) start from it. Interview is the closest: it's the presentation-rehearsal flow with a different scene and brief. |

Why not proxy Accent under `vrtor.io/ac/*` with a Worker? The app uses
root-relative assets and routes (`/assets/*`, `/vr`), Firebase Auth's redirect
handler, and origin-scoped storage; a path proxy would need rewriting all of
that for no user-facing gain over a subdomain.

## Monetization ideas (in order of effort)

1. **Room Plus subscription**: Acento already has `is_premium` and daily limits. Sell it as "VRtor Plus" across all rooms (Stripe Checkout; one price, monthly/annual).
2. **Bring-your-own Gemini key** tier already exists in Acento: keep it as a free, unlimited power-user option.
3. **Teams / classrooms**: per-seat licences for schools, bootcamps, ESL programs; headset pairing codes already make shared headsets workable.
4. **Sponsored or custom rooms**: companies pay for an Interview room preloaded with their roles, or a sales-pitch rehearsal room.

### Apollo 11 (`/apo/`)

The real command module Columbia, from the Smithsonian's CC0 3D scans (interior hull, couches, panels and graffiti layer, plus the exterior shell), at real size in lunar orbit. Interior and exterior scans share one frame but for a fitted 9.5 cm offset. Columbia is tipped so the crew's line of sight to the main panel is level, so a standing visitor faces it as the crew did, and turned so its heat shield faces the low morning Sun. The Moon (LRO colour and LOLA elevation from NASA's CGI Moon Kit, slope-shaded in a shader with a sharp 80 by 40 degree patch around the Sea of Tranquility) and Earth (July Blue Marble with clouds) are scaled 1:1000 so every angle stays true; Earth hangs where the hatch window looks. Tour stops sit on the curators' annotation points. There is no floor in orbit: in the headset, the left thumbstick floats you where you look and the right one turns and raises or lowers you (`src/float.js`); flat screens turn in place inside. `scripts/prepare-apollo.py` downloads the scans and builds the textures; sources are in `apps/apo/public/models/CREDITS.md`. Visitors here wear Neil Armstrong's scanned A7-L suit and helmet, gold visor down (`scripts/prepare-apollo-suit.py`, run with Blender): `createPresence`'s `outfit: { suit, helmet }` puts instances of them on every avatar, so all suits are one draw call and all helmets another. The helmet turns with where someone looks; with faces hidden, the name tag lighting up shows who's talking. That scan is not CC0 (Smithsonian non-commercial educational terms), so this room must stay free unless the Smithsonian agrees otherwise.

### Taj Mahal (`/taj/`)

The first World Wonders lesson is a detailed exterior reconstruction with four observation-and-answer activities: symmetry, pishtaqs, minarets, and chhatris. It reuses the shared WebXR shell, with terrace teleporting, comfort fades, adaptive eye-buffer resolution, MSAA, and compositor text panels. Morning/afternoon lighting refreshes the static shadow map only when changed.

The downloadable CC BY model retains all 409,419 triangles in the downloaded GLB (29 mesh draws), delivered as a 4.8 MB Draco GLB. Scale is approximate, with the plinth normalized to 95.4m; the garden approach is illustrative and no interior is modeled. Credit and source links are visible in the experience and in `apps/home/public/assets/CREDITS.md`. This was selected over the other accessible free assets for modeled detail and a smaller, texture-independent payload; paid models were not purchased. Actual Quest frame rate and visual clarity require a headset check.

Build: `npm run build -w @vrtor/taj`. Deploy its Worker before the home Worker, which routes through the `TAJ` service binding. `npm run dev`, `npm run build`, and `npm run deploy` include both subject apps. `vrtor.io/taj-mahal` and `vrtor.io/tajmahal` redirect to `/taj/`.

The asset conversion is reproducible with Blender and `scripts/prepare-taj.py`; see its invocation at the top of the script.

### Machu Picchu (`/mpc/`)

The second World Wonders experience is a **free noncommercial educational** walkthrough. Its default scene is one connected architectural reconstruction of the citadel from **Ministerio de Cultura Perú**, licensed **CC BY 4.0**. All 32,759 triangles are preserved in a 0.33 MB Draco GLB. Paths, terraces and courts share one scene, with desktop WASD/arrow movement, mobile movement buttons, click-to-travel on supported ground, and headset teleport/snap turns. There is no area dropdown. Every learning card has a close button, including the shared headset panel. The overview and morning/afternoon controls remain available.

The full model is a simplified architectural reconstruction with approximate human scale, not a complete laser survey or a verified present-day visitor route. Mipmapped stone normal/relief maps baked from a 4 m × 1.4 m CAST Main Temple laser sample replace the fabricated brick grid. All wall mapping and color remain illustrative; the maps carry CC BY-NC 3.0 attribution and restrictions. Short opaque 3D grass blades are rooted on verified grass faces and drawn only in nine nearby 20 m tiles. Outdoor lighting and the cover within about 800 m of the citadel are illustrative; the architecture uses no photographic textures. Ambient occlusion baked in Blender (`scripts/bake-machu-ao.py`, 4096² on a second UV set) darkens corners, doorways and niches. The bake welds a copy of the unwelded export so walls unwrap whole, gives ground islands less resolution, points faces sealed behind other faces at a neutral patch, and fills empty atlas space neutral so mipmaps do not darken seams. Walls keep about half the occlusion because the source's large wall triangles bake unevenly; lawn faces keep it only on their walls because they overlap the earth beneath. A mirrored second read of the stone sample, chosen by metre-scale noise, breaks up its 4 m repeat, and illustrative vertical streaks suggest lichen weathering. The sky is coloured per sun preset, with a horizon haze matching the fog and glow around the sun, and it feeds the reflection probe used for ambient light. Source links, attribution, changes and limitations are in `apps/mpc/public/models/SITE-CREDITS.md` and the About panel. Unsupported terrain and walls block movement; Continuous desktop/mobile walking additionally follows narrow stair treads using five local foot-support probes, a 31 cm step limit, and body clearance checks. Larger gaps still require click-to-travel or headset teleport to other supported landings within the same model.

Learn opens six optional real laser-survey closeups: Main Temple, Temple of the Sun, Intihuatana, Temple of the Condor, Water Mirrors Room and Knob Room. Four observation-and-answer activities compare fitted masonry, curved construction, carved rock and natural bedrock. Back to walk returns to the saved citadel position. These closeups come directly from CAST's public OBJ downloads under **CC BY-NC 3.0**. Keep the experience free without ads, subscriptions or paid-product promotion; being free alone does not establish that a different use is noncommercial. Required institutional/contributor credits, archive links and reuse restrictions are in `apps/mpc/public/models/CREDITS.md` and the About panel. Commercial reuse of the survey assets requires separate permission.

All **4,064,071 triangles** from the provider's six published (already reduced) scan meshes are retained, delivered in roughly **17.2 MB** of Draco GLBs. Only the active model is loaded; its previous geometry/materials are disposed on travel. Temple of the Condor has about two million triangles; physical headset performance still needs verification. Original scan grayscale vertex values are retained; scan materials and lighting are illustrative. The six closeups are independently centred and are not geographically registered into the whole architectural model.

The mountain backdrop uses public Mapzen terrain elevation around Machu Picchu (USGS SRTM/GMTED2010). Its 513×513 grid preserves approximately 19.5 m spacing, adds about 1.05 MB and 524,288 triangles. A 257×257 ring (156 m spacing, about 0.26 MB and 123,000 triangles) continues the real relief out to 20 km, so ranges such as Salkantay sit on the horizon; the near grid's edge follows the ring's grid lines so the meshes meet without cracks. Both are draped with Sentinel-2 cloudless 2016 imagery (EOX, CC BY 4.0; built by `scripts/prepare-machu-landscape.py`). The illustrative join flattens a 350 m radius and blends to the relief by 600 m, and the imagery fades in from 500 to 800 m; archaeological models are not georeferenced to this terrain. Large textures ship as KTX2 (Basis ETC1S, `scripts/encode-machu-ktx2.py`) so they stay compressed in GPU memory: imagery about 0.54 MB near and 0.85 MB far, occlusion about 2.2 MB, roughly 4–8× less GPU memory than decoded JPEGs. The Babylon 9.29.0 KTX2 transcoder is self-hosted in `apps/mpc/public/ktx2`. The citadel uses three shadow cascades (2048 on desktop with medium PCF, 1024 with low PCF on phones and headsets) covering 220 m while walking and 1,200 m in the overview; the scan closeups keep one 2048 map rendered once, since the Condor scan alone has about two million triangles. The loading screen waits until the citadel and terrain shaders are compiled. On desktop and phones, a post-process pipeline adds 4× MSAA (FXAA on WebGL1) and light sharpening; the headset keeps its own MSAA layer. The shared XR shell provides comfort fades, adaptive resolution, MSAA and compositor lesson panels.

`/machu-picchu` and `/machupicchu` redirect to `/mpc/`, preserving queries. Its Worker is `vrtor-mpc`; the home Worker routes via the `MPC` service binding. Deploy this Worker before home. Root build/dev/deploy scripts include it (local port 8793, inspector 9243).

To reproduce assets, download the publisher's original connected GLB and the six archives linked in the model credits, then run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/prepare-machu-site.py -- /path/to/original/citadel.glb
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/check-machu-site.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/prepare-machu.py -- /path/to/extracted/surveys
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/check-machu-floor.py
npm run build -w @vrtor/mpc
```

Navigation is derived from supported ground and adjacent short treads, excluding cliff edges and body intersections with walls. Every delivered landing quad corner and spawn is checked against the decompressed GLB, including the Blender/glTF/Babylon coordinate conversion. The connected site's invisible landing meshes are spatially divided for picking. Desktop movement follows surface height and checks nearby walls; headset teleport uses the same landing surfaces. `node scripts/check-machu-walking.mjs` exercises the actual walker against independent stair, ledge, wall and cliff fixtures, including travel and scan restrictions. The XR shell's optional `moveTo` callback swaps models and updates teleport surfaces while the comfort fade is fully dark.
