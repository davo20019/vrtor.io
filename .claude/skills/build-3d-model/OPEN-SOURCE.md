# Before open-sourcing this skill

The plan: keep using it inside vrtor, then extract it into its own public repo once these hold.
Prepare the repo locally; David decides when it goes public.

## Proven
- [ ] The altimeter is finished: the outline and the dial landmark agree on one camera (now about -19° vs -7°), and it is approved in the headset. Rebuild it first: its GLB lost the `needle` node to gltf-transform's flattening (build.sh fixed 2026-10-03, not rebuilt yet).
- [ ] Two or three more objects built with it, approved in the headset, including a dark or metallic one and a bigger one.
  - Cybertruck (2026-10-03, assets-src/cybertruck, REPORT.md): large and bare stainless steel. Built, fitted on three photos (IoU 0.91 to 0.92, outline 41 to 69 mm), interior added, served at dev.vrtor.io/cyb/. Waiting for headset approval. Its front-photo fit is unreliable (camera at the height prior's limit).

## General
- [x] Cut-out that doesn't depend on colour (dark or silver objects on dark straps or backgrounds). Done 2026-10-03 on the Cybertruck: GrabCut from a rectangle and a ground line, then GrabCut again seeded by the model's own outline through the solved camera (`mask.refine`); dark parts inside by a fixed brightness limit, not Otsu. Still open: a cut-out that touches other objects (cars beside it, a sign post on the roof) leaks into them; a per-photo "exclude" polygon would fix it.
- [x] Fit across several photos at once, not one. Done: shared shape parameters, one camera per photo, alternating shape and cameras (`rounds`), per-photo pose values (`rideOffset`), a camera height prior.
- [ ] Faster fitting. Rendering is cheap (10 ms per photo); the CAD rebuild and tessellation are ~0.7 s per shape step and dominate, and Powell over 29 parameters needs hundreds of steps. Ideas: tessellation cache (done, helps only for parts a parameter doesn't touch), fewer parameters per stage (outline ones first, inner ones after), a gradient from finite differences on the rendered masks.
- [ ] Inner edges, not only the outline: the dark-parts channel helps (arches, windows, bumpers) but needs objects with clear dark and light parts. An edge channel (the photo's strong edges against the model's crease lines) would work on any object.
- [ ] Review renders apply the fit's per-photo pose (ride offset), and calibrate metal: today steel renders near white against a sky and can't be compared with each photo's surroundings.
- [ ] Tests for the fit and review scripts. At least: the altimeter's single-photo fit and a small multi-photo case, both reproducing their reported numbers. measure.py has one: `assets-src/cybertruck/measure/c059-check.json` (expect block, exits 1 on a miss).
- [x] Measuring what silhouettes can't see (interiors, details): scripts/3d/measure.py, from known reference points; checked against Tesla's published height (6 mm off). Next: re-measure the Cybertruck interior with it.

## Standalone
- [ ] Skill and its scripts in one folder; config instead of vrtor paths (`assets-src/`, `scripts/3d/`).
- [ ] No vrtor app names or rules (`/jump`, reflection probes, Quest budgets) in the skill; those become examples or config.
- [ ] README with install steps (Blender, ffmpeg, uv) and a walkthrough.
- [ ] The scripts assume the object frame (front +z, up +y) and two GLB conventions (`glbFrame`); document them, or detect the frame from the GLB.

## Legal
- [ ] No shop photos or video frames in the repo; reference material stays local.
- [ ] Evidence step tells people to use their own footage, or flags YouTube's terms before downloading.
- [ ] Wikimedia Commons is a good evidence source with clear licences (refs/web/SOURCES.md records each file's); the example could ship a few CC BY photos with attribution instead of none.
- [ ] Example object with photos we may publish (public domain or our own), no trademarks. The Cybertruck is a trademarked product shape even without logos: keep it out of the public example.
- [ ] MIT licence.
