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

## Adding a subject

1. Copy `apps/spc` to `apps/<code>`: set `base`/`outDir` in `vite.config.js` and `name` in `wrangler.jsonc`.
2. In `apps/home`: add `{ code, service }` to `src/subjects.js` and the service binding to `wrangler.jsonc`.
3. Add it to `scripts/dev.js` and the root `deploy` script, and update its card in `apps/home/public/index.html`.

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
