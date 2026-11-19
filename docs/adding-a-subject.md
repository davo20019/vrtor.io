# Adding a subject

A subject is one app in `apps/<code>/` with its own Worker. `<code>` is three or four lowercase
letters: it is the address people type with a controller (`vrtor.io/<code>`).

Before building, open an issue with the **New subject** template: what a visitor learns, the 3D
sources you plan to use and their licences. Assets need a licence that allows redistribution
(see [ASSETS.md](../ASSETS.md)); that question settles more proposals than any other.

## 1. Copy a small subject

`apps/spc` is the smallest Babylon.js subject. Copy it and rename:

```bash
cp -r apps/spc apps/xyz
rm -rf apps/xyz/dist apps/xyz/public/*   # keep the structure, not Space's assets
```

Then in `apps/xyz/`:

- `package.json`: `"name": "@vrtor/xyz"`
- `vite.config.js`: `base: '/xyz/'`, `outDir: 'dist/xyz'`
- `wrangler.jsonc`: `"name": "vrtor-xyz"`
- `worker/index.js`: the cached path prefix `/xyz/assets/`
- `index.html`, `src/main.js`: your scene

Run `npm install` at the root so the workspace links `@vrtor/xr-shell`.

## 2. Register it

| File | Change |
|---|---|
| `scripts/apps.js` | add `{ code: 'xyz', port: <next free port> }`; build, deploy and dev pick it up |
| `apps/home/src/subjects.js` | `const XYZ = { name: '...', code: 'xyz', service: 'XYZ' }` plus `xyz: XYZ` and any aliases |
| `apps/home/wrangler.jsonc` | `{ "binding": "XYZ", "service": "vrtor-xyz" }` under `services` |

Now `npm run dev -- xyz` serves it at <http://localhost:8790/xyz/>.

## 3. Use the shell

Most of what makes a subject comfortable in a headset is already in `@vrtor/xr-shell`:

```js
import { createXr, createCard, createPresence, mountPresenceControls, xrPose } from '@vrtor/xr-shell';
```

`apps/taj/src/main.js` is a readable example of an orbit-camera subject with teleporting,
cards and visitors; `apps/mpc/src/main.js` has its own walker. See [visitors.md](visitors.md) to let
people see and talk to each other in your subject.

## 4. Assets

- Put shipped files in `apps/xyz/public/` (served at `/xyz/...`).
- Compress: Draco or meshopt for meshes, KTX2 for big textures (the decoders are self-hosted; copy
  `public/draco` or `public/ktx2` with its `LICENSE.txt` from another subject).
- Credit every third-party file in `apps/xyz/public/models/CREDITS.md` (source link, author, licence,
  what you changed) and add a line to [ASSETS.md](../ASSETS.md). Show credits in the app's About panel
  when the licence asks for attribution.
- If you converted or built the asset, commit the script (`scripts/prepare-xyz.py` or
  `assets-src/xyz/`) so others can reproduce it. Don't commit downloaded inputs or copyrighted
  reference photos; list them in a `SOURCES.md` instead.

## 5. Put it on the site

When it is ready to be listed:

- a card in `apps/home/public/index.html` with an image in `apps/home/public/assets/cards/`
- `apps/home/public/sitemap.xml`
- `ROOMS` in `packages/xr-shell/src/rooms.js`, so it appears in the headset room switcher

Unlisted subjects (like `geo`) skip this step and are reachable only by their address.

## 6. Check it

- `npm run build -- xyz` (or `node scripts/each.js build xyz`) builds cleanly.
- It works on a desktop browser and a phone.
- In a headset if you have one: enter VR, move, read the cards, and note the frame rate. If you don't
  have one, say so in the pull request; someone who does can test it.
