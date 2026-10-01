# vrtor.io

VR learning rooms that open in a headset's web browser. Each room has a short
address (`vrtor.io/ac`) because typing with a VR controller is painful.

## Stack

One repo, one Cloudflare Worker per app (npm workspaces):

```
apps/home/       vrtor.io itself: the catalog site + the router Worker ("vrtor")
apps/spc/        Space: Perseverance on Mars (Babylon.js WebXR, Vite), Worker "vrtor-spc"
packages/xr-shell/  shared WebXR pieces for every subject (Quest-tuned session setup,
                 teleport, comfort fade, frame-rate governor, floating info card)
```

- **apps/home** (`wrangler.jsonc`): Workers Static Assets from `public/` (plain HTML/CSS/JS, no build step).
  - `public/journey.js`: the scroll-driven 3D catalog (three.js via import map). Asset licenses in `public/assets/CREDITS.md`.
  - `src/index.js` runs first for every request:
    - `/<code>/*` for subjects built here (`service` in `src/subjects.js`) → forwarded to that subject's Worker through a **service binding** (same origin: one WebXR permission prompt, shared storage and, later, one sign-in)
    - other subject links → 302 to where that app lives (Communication stays on the Acento site)
    - `POST /api/waitlist` → `WAITLIST` KV
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

## Visitors: seeing and talking to each other

Anyone with a subject open can choose **Join others** to appear to everyone else in it as a simple avatar with a random name, and hear people near them. The mic stays off until they choose **Talk**; voices are spatial and fade out by 30m; tapping someone (or pointing and pulling the trigger) mutes them for you only.

- Server: `apps/home/src/presence.js`, a Durable Object per room at `vrtor.io/api/presence/<code>` (WebSocket). Rooms hold 12 people; more open `<code>:1`, `<code>:2`, ... Names are assigned by the server.
- Client: `packages/xr-shell/src/presence.js` (socket, avatars), `voice.js` (peer-to-peer WebRTC audio, signaled through the room), `presenceUi.js` (bar buttons and the headset card page).
- Kill switches: set `PRESENCE` or `VOICE` to `"off"` in `apps/home/wrangler.jsonc` (or the dashboard) and deploy; connected rooms restart under the new setting.
- Debug: `?xrdebug` exposes `window.vrtorPresence`; `vrtorPresence.stats()` shows each voice connection and its audio level.
- No TURN relay yet, so a few network pairs (strict NATs) won't hear each other; Cloudflare Realtime TURN fixes that if it shows up in testing.

Adding it to a subject (see `apps/mpc/src/main.js`):

```js
const presence = createPresence(scene, { subject: 'xyz', getPose, onChange });
const updateBar = mountPresenceControls(presence, document.querySelector('.presence-controls'));
// getPose() → { area, head, forward, left?, right? } or null; in the headset, show presenceCard(presence, action, back)
```

## Adding a subject

1. Copy `apps/spc` to `apps/<code>`: set `base`/`outDir` in `vite.config.js` and `name` in `wrangler.jsonc`.
2. In `apps/home`: add `{ code, service }` to `src/subjects.js` and the service binding to `wrangler.jsonc`.
3. Add it to `scripts/dev.js` and the root `deploy` script, and update its card in `apps/home/public/index.html`.
4. Optional: visitors (see above). The presence route accepts any subject with a `service`.

## How Accent (accent.learnenglishsounds.com/vr) plugs in

Accent is a Babylon.js WebXR scene living at `/vr` inside the Acento React app
(Firebase Hosting + Cloud Run API). It signs in with a Firebase ID token or a
paired-headset device token stored in `localStorage`. Because that storage is
per-origin, the integration is staged:

| Phase | What | Effort | Notes |
|---|---|---|---|
| **1 (now)** | `vrtor.io/ac` → 302 to `accent.learnenglishsounds.com/vr?ref=vrtor` | done | Existing logins and paired headsets keep working. `ref=vrtor` lets Acento attribute signups. |
| **2** | Serve the same build at `accent.vrtor.io` | small | Add custom domain in Firebase Hosting, CNAME in Cloudflare, add `accent.vrtor.io` to Firebase Auth authorized domains and to the API's CORS list. Switch `rooms.js` to the new URL. Users re-pair the headset once (new origin). |
| **3** | One vrtor account + one subscription across rooms | medium | Reuse the `lescoach` Firebase project as the identity provider for every room; move the Acento premium check (`/vr/me` → `is_premium`) to a shared entitlement ("vrtor Plus"). |
| **4** | Rooms as packages | larger | Extract the VR shell (controller input, menus, perf tuning, audio capture, AI live client) from `frontend/src/vr` into a shared package so new rooms (Interview, Café…) start from it. Interview is the closest: it's the presentation-rehearsal flow with a different scene and brief. |

Why not proxy Accent under `vrtor.io/ac/*` with a Worker? The app uses
root-relative assets and routes (`/assets/*`, `/vr`), Firebase Auth's redirect
handler, and origin-scoped storage; a path proxy would need rewriting all of
that for no user-facing gain over a subdomain.

## Monetization ideas (in order of effort)

1. **Room Plus subscription**: Acento already has `is_premium` and daily limits. Sell it as "vrtor Plus" across all rooms (Stripe Checkout; one price, monthly/annual).
2. **Bring-your-own Gemini key** tier already exists in Acento: keep it as a free, unlimited power-user option.
3. **Teams / classrooms**: per-seat licences for schools, bootcamps, ESL programs; headset pairing codes already make shared headsets workable.
4. **Sponsored or custom rooms**: companies pay for an Interview room preloaded with their roles, or a sales-pitch rehearsal room.

### Taj Mahal (`/taj/`)

The first World Wonders lesson is a detailed exterior reconstruction with four observation-and-answer activities: symmetry, pishtaqs, minarets, and chhatris. It reuses the shared WebXR shell, with terrace teleporting, comfort fades, adaptive eye-buffer resolution, MSAA, and compositor text panels. Morning/afternoon lighting refreshes the static shadow map only when changed.

The downloadable CC BY model retains all 409,419 triangles in the downloaded GLB (29 mesh draws), delivered as a 4.8 MB Draco GLB. Scale is approximate, with the plinth normalized to 95.4m; the garden approach is illustrative and no interior is modeled. Credit and source links are visible in the experience and in `apps/home/public/assets/CREDITS.md`. This was selected over the other accessible free assets for modeled detail and a smaller, texture-independent payload; paid models were not purchased. Actual Quest frame rate and visual clarity require a headset check.

Build: `npm run build -w @vrtor/taj`. Deploy its Worker before the home Worker, which routes through the `TAJ` service binding. `npm run dev`, `npm run build`, and `npm run deploy` include both subject apps. `vrtor.io/taj-mahal` and `vrtor.io/tajmahal` redirect to `/taj/`.

The asset conversion is reproducible with Blender and `scripts/prepare-taj.py`; see its invocation at the top of the script.

### Machu Picchu (`/mpc/`)

The second World Wonders experience is a **free noncommercial educational** walkthrough. Its default scene is one connected architectural reconstruction of the citadel from **Ministerio de Cultura Perú**, licensed **CC BY 4.0**. All 32,759 triangles are preserved in a 0.33 MB Draco GLB. Paths, terraces and courts share one scene, with desktop WASD/arrow movement, mobile movement buttons, click-to-travel on supported ground, and headset teleport/snap turns. There is no area dropdown. Every learning card has a close button, including the shared headset panel. The overview and morning/afternoon controls remain available.

The full model is a simplified architectural reconstruction with approximate human scale, not a complete laser survey or a verified present-day visitor route. Illustrative masonry joints and mineral grain improve the stone appearance without photographic textures. Source links, attribution, changes and limitations are in `apps/mpc/public/models/SITE-CREDITS.md` and the About panel. Unsupported terrain and walls block movement; where routes lack continuous walkable geometry, click-to-travel or headset teleport reaches other supported landings within the same model.

Learn opens six optional real laser-survey closeups: Main Temple, Temple of the Sun, Intihuatana, Temple of the Condor, Water Mirrors Room and Knob Room. Four observation-and-answer activities compare fitted masonry, curved construction, carved rock and natural bedrock. Back to walk returns to the saved citadel position. These closeups come directly from CAST's public OBJ downloads under **CC BY-NC 3.0**. Keep the experience free without ads, subscriptions or paid-product promotion; being free alone does not establish that a different use is noncommercial. Required institutional/contributor credits, archive links and reuse restrictions are in `apps/mpc/public/models/CREDITS.md` and the About panel. Commercial reuse of the survey assets requires separate permission.

All **4,064,071 triangles** from the provider's six published (already reduced) scan meshes are retained, delivered in roughly **17.2 MB** of Draco GLBs. Only the active model is loaded; its previous geometry/materials are disposed on travel. Temple of the Condor has about two million triangles; physical headset performance still needs verification. Original scan grayscale vertex values are retained; scan materials and lighting are illustrative. The six closeups are independently centred and are not geographically registered into the whole architectural model.

The mountain backdrop uses public Mapzen terrain elevation around Machu Picchu (USGS SRTM/GMTED2010). Its 257×257 grid adds about 0.26 MB and 131,072 triangles. The illustrative join flattens a 350 m radius and blends to the relief by 600 m; archaeological models are not georeferenced to this terrain. Daylight uses a cached shadow map. The shared XR shell provides comfort fades, adaptive resolution, MSAA and compositor lesson panels.

`/machu-picchu` and `/machupicchu` redirect to `/mpc/`, preserving queries. Its Worker is `vrtor-mpc`; the home Worker routes via the `MPC` service binding. Deploy this Worker before home. Root build/dev/deploy scripts include it (local port 8793, inspector 9243).

To reproduce assets, download the publisher's original connected GLB and the six archives linked in the model credits, then run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/prepare-machu-site.py -- /path/to/original/citadel.glb
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/check-machu-site.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/prepare-machu.py -- /path/to/extracted/surveys
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b --python scripts/check-machu-floor.py
npm run build -w @vrtor/mpc
```

Navigation is derived from supported ground and adjacent short treads, excluding cliff edges and body intersections with walls. Every delivered landing quad corner and spawn is checked against the decompressed GLB, including the Blender/glTF/Babylon coordinate conversion. The connected site's invisible landing meshes are spatially divided for picking. Desktop movement follows surface height and checks nearby walls; headset teleport uses the same landing surfaces. The XR shell's optional `moveTo` callback swaps models and updates teleport surfaces while the comfort fade is fully dark.
