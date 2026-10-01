# vrtor.io

VR learning rooms that open in a headset's web browser. Each room has a short
address (`vrtor.io/ac`) because typing with a VR controller is painful.

## Stack

- **Cloudflare Worker + Static Assets** (`wrangler.jsonc`)
- `public/`: the static site (plain HTML/CSS/JS, no build step)
  - `journey.js`: the scroll-driven 3D journey (three.js via import map): café, interview, keynote hall, with Rocketbox people playing motion-capture clips. In a WebXR headset, "Walk through it in VR" enters the current scene; the trigger moves to the next.
  - `assets/`: rooms, people and animations copied from the Acento VR asset pipeline. Licenses and attribution in `public/assets/CREDITS.md` (CC BY 4.0 rooms need that credit kept).
- `src/index.js`: runs only for non-static paths:
  - `/<room>` → 302 to the room's app (see `src/rooms.js`), adds `?ref=vrtor`, keeps any query string
  - `POST /api/waitlist` → stores `{ email, rooms[] }` in the `WAITLIST` KV namespace

```bash
npm install
npm run dev      # http://localhost:8787
npm run deploy   # wrangler deploy
```

Read the waitlist:

```bash
npx wrangler kv key list --binding WAITLIST --remote
```

## Adding a room

1. Pick a two-letter slug and add it in `src/rooms.js` (with a `url` once it's live). Add the full name as an alias.
2. Add or update its card in `public/index.html` (`.room.live` for open rooms).

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
