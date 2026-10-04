# Before open-sourcing this skill

The plan: keep using it inside vrtor, then extract it into its own public repo once these hold.
Prepare the repo locally; David decides when it goes public.

**Status 2026-10-04:** the standalone repo is prepared locally at `~/projects/building-3d-replicas` (one commit,
no remote): SKILL.md without vrtor specifics, scripts, a CC0 cowbell example graded against the museum's
scan, a template, docs, MIT, pinned dependencies, 9 tests. What is left is below, unchecked. Script changes
made there were ported back to scripts/3d/ (exclude, satMax, focalPx, compare_mesh.py, and two fit bug
fixes: model renders' holes now filled like the cut-outs', and each tilt-search start aligned by bounding
box). The Cybertruck's and the altimeter's fits predate the bug fixes and have not been rerun.

## Proven
- [ ] The altimeter is approved in the headset. Rebuilt 2026-10-04 with its `needle` node; refitted, the outline and the dial landmark now agree on one camera (pitch -10.2, landmark 0.13 mm, IoU 0.947). Mounted on the left hand in /jump (apps/jump/src/altimeter.js), needle driven by height: waiting for a headset test.
- [ ] Two or three more objects built with it, approved in the headset, including a dark or metallic one and a bigger one.
  - Cowbell (2026-10-04, ~/projects/building-3d-replicas/examples/cowbell, REPORT.md): CC0 photo and scan, painted steel. Graded against the scan: 1.37 mm mean, 4.4 mm p95 after alignment. Cameras from the real scan views are 10-15 degrees off (the model is simpler than the bell); on the model's own renders within 2 degrees. Not yet in any app or headset.
  - Cybertruck (2026-10-03, assets-src/cybertruck, REPORT.md): large and bare stainless steel. Built, fitted on three photos (IoU 0.91 to 0.92, outline 41 to 69 mm), interior added, served at dev.vrtor.io/cyb/. Waiting for headset approval. Its front-photo fit is unreliable (camera at the height prior's limit).

## General
- [x] Cut-out that doesn't depend on colour (dark or silver objects on dark straps or backgrounds). Done 2026-10-03 on the Cybertruck: GrabCut from a rectangle and a ground line, then GrabCut again seeded by the model's own outline through the solved camera (`mask.refine`); dark parts inside by a fixed brightness limit, not Otsu. Still open: a cut-out that touches other objects (cars beside it, a sign post on the roof) leaks into them; a per-photo "exclude" polygon would fix it.
- [x] Fit across several photos at once, not one. Done: shared shape parameters, one camera per photo, alternating shape and cameras (`rounds`), per-photo pose values (`rideOffset`), a camera height prior.
- [ ] Faster fitting. Rendering is cheap (10 ms per photo); the CAD rebuild and tessellation are ~0.7 s per shape step and dominate, and Powell over 29 parameters needs hundreds of steps. Ideas: tessellation cache (done, helps only for parts a parameter doesn't touch), fewer parameters per stage (outline ones first, inner ones after), a gradient from finite differences on the rendered masks.
- [ ] Inner edges, not only the outline: the dark-parts channel helps (arches, windows, bumpers) but needs objects with clear dark and light parts. An edge channel (the photo's strong edges against the model's crease lines) would work on any object.
- [ ] Review renders apply the fit's per-photo pose (ride offset), and calibrate metal: today steel renders near white against a sky and can't be compared with each photo's surroundings.
- [x] Tests for the fit and review scripts: in the standalone repo, compare_mesh and measure against exact synthetic answers, the fit against renders of its own model (cameras within 3 degrees), and the cowbell against the scan. The review script runs in the cowbell example but has no test of its own.
- [x] Measuring what silhouettes can't see (interiors, details): scripts/3d/measure.py, from known reference points; checked against Tesla's published height (6 mm off). Next: re-measure the Cybertruck interior with it.

## Standalone
- [x] Skill and its scripts in one folder (the repo root is the skill); models live anywhere, scripts take the folder.
- [x] No vrtor app names or rules in the skill; WebXR notes, budgets and headset tips moved to docs/webxr.md.
- [x] README with install steps (uv, Blender, Node) and the cowbell walkthrough.
- [x] Frames documented in docs/frames.md. In the repo both renderers default to `glbFrame: "y-up"` (vrtor's render_views.py still defaults to "front+y" for the altimeter).

## Legal
- [x] No shop photos or video frames in the repo: a fresh repo, not vrtor's history; the example's CC0 files are fetched by fetch_refs.sh, not stored.
- [x] Evidence step says your own footage is best and flags YouTube's terms.
- [x] Museums' open access and Wikimedia Commons named as sources, with refs/SOURCES.md per model.
- [x] Example object we may publish, no trademarks: the NMAH cowbell (CC0). Altimeter and Cybertruck stay out.
- [x] MIT licence (copyright David Loor).
- [ ] Before publishing: pick the GitHub owner for the README's clone URL, and read the repo once more.
