# Contributing to vrtor.io

Thanks for helping. vrtor.io is maintained by one person in spare time, so small, focused changes
get reviewed fastest.

## Good ways to help

- **Headset testing.** Most subjects have only been checked on a desktop. If you have a Quest or another
  WebXR headset, open a subject, and file a **Headset report** issue: frame rate, comfort, anything
  out of reach or hard to read. This is the most useful thing you can do.
- **Bugs.** Use the **Bug report** template; include the browser, device and subject address.
- **Accuracy.** The subjects aim to be exact. If a part is the wrong size, in the wrong place or
  mislabelled, say so with a source (a paper, a survey, a museum page).
- **Fixes and improvements** to a subject or to `packages/xr-shell`.
- **New subjects.** Open a **New subject** issue first; [docs/adding-a-subject.md](docs/adding-a-subject.md)
  has the steps.

## Setup

Node 22.12 or newer (`.nvmrc`).

```bash
npm install
npm run dev -- mpc     # serve one subject at http://localhost:8790/mpc/
npm test               # unit tests (aif, snd)
npm run build          # build every app
```

No Cloudflare account is needed to develop: wrangler simulates everything locally. Read
[docs/architecture.md](docs/architecture.md) for how the pieces fit.

Asset pipelines in `scripts/` and `assets-src/` need extra tools: [Blender](https://www.blender.org/)
4.x on your `PATH` as `blender`, Python 3.11+ with the packages each script imports, and for the
code-CAD replicas a venv with build123d (see the comment at the top of each `build.sh`). You only
need these to rebuild models; the built files are committed.

## Pull requests

- One topic per pull request. Describe what a visitor will notice, and how you checked it.
- `npm test` and `npm run build` pass (CI runs both).
- Match the style around you: plain ES modules, 2-space indent, single quotes, comments that explain
  why rather than what. There is no TypeScript and no linter yet.
- Keep headset performance in mind: new geometry and textures cost frame rate on a standalone headset.
  Mention triangle counts and texture sizes for anything heavy.
- New third-party assets need a licence that allows redistribution, a line in [ASSETS.md](ASSETS.md),
  and a credit next to the file. Don't commit copyrighted reference photos, manuals or video frames.
- By submitting a pull request you agree that your code is released under the MIT licence and that you
  have the right to contribute any asset you add under the licence you state for it.

## Conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
