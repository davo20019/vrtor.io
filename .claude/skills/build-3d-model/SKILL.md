---
name: build-3d-model
description: Use when a subject needs a 3D object that doesn't exist with an acceptable license, and it should be an exact replica of a real object. Gathers evidence from every available view, builds the object with parametric code-CAD, drawn textures and headless Blender, fits uncertain dimensions to the photos by numbers, and reviews it through each photo's solved camera.
---

# Build an exact replica of a real object

Worked examples, copy the closer one as the starting point:
- `assets-src/altimeter/` (Alti-2 Galaxy altimeter): small, coloured, one photo, colour cut-out.
- `assets-src/cybertruck/` (Tesla Cybertruck): large, bare stainless steel, three photos fitted together,
  planar facets as half-spaces, wheels on steer and spin nodes, an interior to sit in. Its REPORT.md lists
  what went wrong and how it was fixed.

Realism is the goal: the object should be indistinguishable from the real one. Judge by numbers first, eyes second.

## Layout

```
assets-src/<name>/
  spec.md        real dimensions, each with a source; guesses listed under "Unknowns"; the structure and parameter list
  refs/          photos and video frames, comparison only, never shipped (refs/web, refs/video/frames), with SOURCES.md
  cad.py         parametric rigid parts in mm (build123d) -> parts/*.stl; uncertain sizes live in P
  params.json    fitted values of P (written by fit_silhouette.py)
  textures.py    drawn textures (dials, labels, decals, normal maps) -> parts/*.png
  assemble.py    headless Blender: import, materials, UVs, pivots, soft parts -> out/<name>.glb + .json
  build.sh       runs all of the above, then gltf-transform (meshopt + webp), keeping the node tree
  review.json    expected sizes, budget, exposure, frame, and the "fit" block
  fit/           one photo: camera.json, target.png, overlay.png, report.md; several photos: fit/<photo>/ each
  review/round-N/  sheet.png + report.md per round
scripts/3d/fit_silhouette.py   fit shape parameters and each photo's camera by silhouette (one photo or several)
scripts/3d/measure.py          measure points in mm in one photo from 6+ known reference points (interiors, details)
scripts/3d/review.py, render_views.py   review rounds (renders through every solved photo camera)
```

Setup per model: `uv venv .venv && uv pip install --python .venv/bin/python build123d pillow numpy opencv-python-headless scipy`. Blender and ffmpeg must be on PATH; run yt-dlp as `uvx yt-dlp@latest` (an old pip yt-dlp gets HTTP 403 from YouTube).

## Process

1. **Evidence, from every side.** One front photo hides most of the shape (the altimeter's scooped sides and corner facets only showed in a shop's angled photo).
   - Manufacturer pages and manuals for dimensions; write each in `spec.md` with its source. Some makers' sites refuse scripted requests (tesla.com answers 403); their own regional mirrors often don't (tesla.cn served the same Owner's Manual pages). Manuals carry the best numbers: overhangs, track, clearance per suspension setting, wheel offset.
   - Every shop that sells it: each shoots different angles. Shopify stores list all images at `<product-url>.json`.
   - Wikimedia Commons, for anything photographed in public: list a category with the API (`action=query&list=categorymembers&cmtitle=Category:<X>&cmtype=file`), fetch licence and author with `prop=imageinfo&iiprop=url|size|extmetadata`, and download large files at a standard thumbnail width (3840; other widths get HTTP 400). Record each file's licence in `refs/web/SOURCES.md`.
   - Videos: `uvx yt-dlp@latest --flat-playlist --print "%(id)s | %(title)s" "ytsearch15:<product>"`, download candidates at 720p, make contact sheets (`ffmpeg -vf "fps=48/<duration>,scale=320:-1,tile=8x6"`), then pull full-resolution frames at the useful timestamps. Check it is the same product: lookalikes, prototypes and wrapped or modified ones are common.
   - Label views by geometry, not by impression: a side view with the front pointing to the left of the frame shows the object's left side.
   - Write down which surfaces no photo shows. They stay marked guesses.
2. **Decide the structure by looking at all views.** The fitting only tunes the shape you give it; it cannot invent a scoop or a facet. Describe every feature (facets, scoops, windows, lips, bevels) and give each uncertain size a parameter in `cad.py`'s `P`.
   - An object of flat faces (a Cybertruck, a building, a machined block) is best built as the intersection of half-spaces, one plane per face, each plane through named corner points. Every face stays flat whatever the parameters, and convex creases come out by construction. Two neighbouring faces that must both survive have to share their crease line (the Cybertruck's sail plane erased the side window until it was built through the window's own rear edge).
   - Decide what changes between photos and keep it out of the shape: air suspension height, steering, open doors, a lowered antenna. These are per-photo pose values in the fit (see `rideOffset`), not parameters.
   - If visitors will get in or look inside (a vehicle, a cockpit, a room), plan the interior and see-through glass from the start: the shell has to be hollow, and the inside of a solid is invisible in a headset (back faces are culled).
   - Decide which parts move (doors, lids, wheels, needles) here, not after the build: each becomes its own node, cut out of the shell along its seams with a hinge or pivot, and everything mounted on it (glass, trim, handle, mirror) goes with it. The manual says where the controls are (the Cybertruck's door buttons: "on the pillar to the right of each door"); leave a fixed strip where a control sits on the body.
3. **Pick a method per part:**
   - rigid, precise, mechanical: **code-CAD** (`cad.py`)
   - flat printed graphics: **drawn texture** (`textures.py`, PIL, 4x supersampled)
   - simple soft parts (webbing, cables): **swept mesh in Blender** (`assemble.py`, `sweep()`)
   - generic and available under CC0/CC-BY: **library**
4. **Fit by numbers.** `<model>/.venv/bin/python scripts/3d/fit_silhouette.py assets-src/<name>`, configured by `review.json`'s `fit` block (the script's docstring lists every key). It solves each photo's camera, fits the parameters and reports overlap (IoU), mean outline error in mm and landmark error.
   - One photo: the photo, the HSV range that cuts the part out, the parameters it can see, and a landmark inside the part.
   - Several photos (`photos: [...]`): each with a starting `view` (pitch, yaw, roll), a cut-out `mask`, measured pixel `landmarks` for named model points (wheel centres, tyre contacts, the light bar), and the `parts` it sees. The shape parameters are shared, so each photo constrains what it can see and nothing else.
   - **Run it with `params: {}` first**: cut-outs and cameras only. Check every `target.png` (and `target_dark.png`, `overlay.png`) before fitting any shape: a bad cut-out makes every number wrong. A drop shadow or a neighbouring object in the cut-out: mark it with `exclude` polygons.
   - Fix what is published (overall height, width): fit only the uncertain sizes, or the shape absorbs camera errors.
   - Landmarks must be points you can mark to a pixel or two: the end of a handle, a strap's sharp corner, a bolt. Not rounded corners: marked by eye they were 4 to 6 mm off and bent every camera.
   - Large objects: give landmarks that span the height (a wheel centre and the tyre's contact point under it) and `cameraHeightMm`, or the fit trades camera tilt for distance and puts the camera under the ground.
5. **Measure what the outline can't see**: an interior, a handle, a light's height, a seam. Never place these by eye: an interior placed by eye from video frames looked wrong in the headset. Use `scripts/3d/measure.py <job.json>` (its docstring has the format):
   - Look in the manual first: its illustrations are rendered from the maker's CAD, so they have true proportions (the Cybertruck's seat side view and dash view placed the whole interior). Scale each from a published size inside it (head room, screen diagonal), and render the model from a similar camera to compare.
   - Otherwise pick the photo or frame that shows the feature best, from a long lens if there is one.
   - Mark at least 6 reference points whose positions are known in mm, spread over the photo: published sizes, parts already fitted (wheel centres, tyre contacts, the light bar), a part of known size (a screen's corners, with a fixed focal length: then 4 do).
   - Mark each point to measure on a plane you know it lies on (the door's plane, the floor, the dash top).
   - Trust the result when the references reproject within a few px. References near one plane leave the focal length and camera distance loose (the solved focal sits at its limit), but points on planes near them still measure well.
   - A fitted camera (`"camera": "fit/<photo>/camera.json"`) measures points near the outline's plane well, but its height and distance are barely constrained by an outline: points a metre or more behind that plane (the far side of a cabin seen through a window) can be off by hundreds of mm. Measure deep features from a photo taken near them, with references near them.
   - Check that you have marked what you think: measure one feature whose position is already known in the same view first (the far side's beltline, a wheel), and stop if it misses. A through-the-window "door trim" on the Cybertruck turned out to be something 300 mm higher.
   - For a vehicle's body, measure the photo's ride height from the roof peak (`"body": false`, minus the spec height) and pass it as `ride`: the fit's per-photo offset was 26 mm off on c003.
   - Put each measurement in `spec.md` with the job that made it, and give the job an `expect` block when the answer is known: it is then a test. `assets-src/cybertruck/measure/c059-check.json` measured the kneeling truck's roof at 1,732.9 mm from its wheels alone; Tesla publishes 1,738.8.
6. **Build** with `./build.sh`.
7. **Review** with `<model>/.venv/bin/python scripts/3d/review.py assets-src/<name>`. The sheet puts each photo next to the model rendered through that photo's solved camera, so differences are real, not perspective. List every difference in `report.md`, fix, run again. Stop and ask after 5 rounds without progress.
8. **Headset test.** Serve it at dev.vrtor.io (`node scripts/headset.js`, every subject) and read `output/headset/<code>.log` while the human tests: fps, presses, errors. Start the page's log before `createXr`, or the rig's own start wins and the page's state is never reported.
9. **Done** when the automatic checks pass, the remaining differences are deliberate or unknowable (and written down), and the human has approved it in the headset.

## Rules learned the hard way

- **Trust the numbers over your eye.** I read the altimeter photo as shot from above; the dial's position inside the outline proved it was shot from below.
- **Check that a photo can measure a parameter before trusting its value.** Score the outline over a range of the parameter, re-solving the camera each time: if the score is flat, the photo can't tell and the fitted value is arbitrary. A straight-on photo's outline is only the widest section; it couldn't tell a 1.5 mm corner rounding from 14 mm, the fit kept 1.5, and the case came out chamfered where the real one is one soft curve. Angled photos, and the person who has held the object, decide those.
- **Rounded, organic shapes: loft through sections, don't fillet a box.** Sections with the same edges at several depths, inset along a quarter ellipse toward the front, give a roll-off that meets the faces tangentially; a box with chamfers and small fillets reads as machined and angular.
- **Symmetric outlines can't tell up from down.** Always give the fit a landmark inside the part.
- **When cues disagree, the structure is wrong.** If the outline wants one camera and the landmark another, a feature is missing or misplaced (a depth, a taper). Find it; don't average. On the Cybertruck the outline wanted a camera below the ground: the body sat 55 mm lower on its wheels than the spec height (a parked truck kneels), and a per-photo ride offset fixed it.
- **Colour can't cut out bare metal, silver or chrome.** It takes the colour of whatever it reflects. Use the `grabcut` mask: a rectangle and a ground line first, then `refine`, which runs GrabCut again seeded by the model's own outline through the solved camera. Inside the outline, cut dark parts (rubber, plastic, glass) with a fixed brightness limit (`dark: {"valueMax": 60}`): Otsu splits the steel itself where it reflects shade.
- **On a coloured object, cut its neutral parts by saturation** (`dark: {"satMax": 90, "valueMax": 140}`): red enamel in shade is as dark as a black grip, but far more saturated.
- **`refine` only when colour can't separate the object.** It re-cuts the photo along the model's outline through the solved camera, so a poor first camera locks its error in. A coloured object on a plain backdrop needs a rectangle and `exclude` polygons.
- **Give the focal length when you know it** (`focalPx`, from EXIF: focal mm / sensor width mm x image width px). Outlines alone trade tilt for perspective.
- **Grade against a reference mesh when one exists** (a museum scan, a maker's CAD): `scripts/3d/compare_mesh.py <job.json>` gives mm each way, before and after a rigid alignment. Never build from it.
- **Shadows under an object read as part of it** (they are as dark as tyres). The ground line removes what is below the contact points; the refine step removes the rest.
- **Perspective shortens what is further away**, even in a "straight" side view: the Cybertruck's nose is on the centreline, a metre behind the wheels' plane, and looked 150 mm short. Measure through the solved camera, never by scaling pixels.
- **Tools that did not help:** monocular depth (Depth Anything V2 turned the side into a smooth blob, relative only); image-to-3D (TRELLIS returned a flat disc after its background removal deleted a silver part). Don't use them for exact replicas.
- **Frame:** model in mm with the front facing +z and up +y; scale the root by 0.001 at export. Hand-held objects keep the altimeter's convention (the GLB's front on +y, up on -z). Vehicles and scenes are y-up in the GLB (front +z): convert the mesh data and node positions to Blender's frame on import (`(x, -z, y)`), never rotate the root, so every moving node keeps identity rotation and turns about its own axes. Set `glbFrame` in `review.json` and write the frame in the `.json`.
- **`gltf-transform optimize` flattens the scene and joins meshes by default**, which deletes every moving node (wheels, needles, doors). `build.sh` passes `--flatten false --join false --instance false`.
- **Metal only where the scene has environment lighting.** Metallic surfaces render black without it. Apps with a sky or reflection probe (`/jump`, `/spc`, `/taj`, `/mpc`, `/cyb`) can show real metal; elsewhere use metallic 0 with a clear coat, or add a probe like `/cyb`'s (the sky dome and the ground, rendered once).
- **No coplanar faces.** Parts that touch must be offset by at least 0.05 to 0.1 mm (dial on its pocket floor, lens on its seat), or they z-fight into jagged dark artifacts. Inset panels (glass, lights) go in a pocket 1 mm under the surface, 0.5 mm smaller all round. A hole behind a pane has to start above the pocket floor: starting 0.5 mm below it left a 0.5 mm sheet of steel that closed every window.
- **Moving parts get their own node** with the pivot at the origin (`needle`, `rotor`, `steer_*` > `wheel_*`), and the `.json` says how to drive it. Parts that turn but don't spin (brakes) go in the steer node.
- **Tessellation per part:** round parts at fine tolerance explode the triangle count (the O-ring was 14k triangles). Pass coarser `tolerance`/`angular` to `save()` for small or round parts. Identical parts (four wheels) share one mesh in Blender (`object.copy()`), stored once in the GLB.
- **Moving parts: cut them with regions, not by hand.** A door is the shell intersected with a region (between its seams, below the roof, outboard of the window plane or below the beltline), so the roof and windshield never come away with it. Split every part that crosses the region the same way (`split_doors()` in the Cybertruck's cad.py), and expect some parts to end up entirely on a door: skip empty ones and clear `parts/` at the start of each run, or stale STLs come back.
- **Check every face that should look at the visitor.** Screens, yokes and dials built facing +z faced the windshield; render from the seat or the hand before calling it done, and map a screen's texture so its right is the viewer's right.
- **Interaction lives in the app, the model just names it.** Give each pressable part its own named mesh (`btn_fl`, `open_fl`) and each moving part its node, and write in the `.json` how to drive them (`openDeg`, which buttons open what). The app adds pick targets bigger than the real control (a 3 cm button needs a ~12 cm target for a controller ray) and a hover glow.
- **Rounded edges cost triangles.** Filleted interior blocks took the Cybertruck from 23k to 59k triangles; coarser tessellation for the cabin brought it to 42k with no visible change.
- **Build from positive parts, not by cutting windows.** The Cybertruck rim cut from a disc came out as shards; hub, spokes and ring unioned came out clean.
- **Review renders lie unless calibrated.** Khronos PBR Neutral tone mapping (AgX desaturates, Standard clips). Set `exposure` in `review.json` so a neutral in the photo matches the render; compare colours by sampling pixels. Keep the key light off-axis so glass doesn't mirror it into the camera. Metal needs `"environment": "sky"`, and still won't match each photo's surroundings.
- **Blender lens shift moves the view**, so the content moves the other way: shift_x = (W/2 - cx) / max(W, H), shift_y = (cy - H/2) / max(W, H).
- **Trademarks:** leave out logos and wordmarks. Everything else matches the real object.
- **Check a picture's scale against a second known size before measuring with it.** The Cybertruck's seat
  render was scaled at 5.28 mm/px from the head room; the dummy's crown then went 40 mm through the roof. The
  H-point-to-floor span gave 4.58, and at 4.58 the yoke, crown and head room all agreed. One reference makes a
  scale; two make a check.
- **Solve a camera for every perspective picture you compare against, then render the model through it.**
  `measure.py` writes `<job>.camera.json`; `scripts/3d/render_cams.py` renders the GLB through it (or any
  eye/look camera) and puts the picture beside the render (`"photo"`), optionally with only some parts
  (`"only"`), as product shots show one part on a plain background. Side-by-side pairs found every error that
  looking at renders alone missed (a block hiding the screen, faces built on the wrong side).
- **A rectangle seen nearly face-on can't fix the focal length** (the screen's four corners alone let focal
  and distance trade). Add references at a different depth: body points you already fitted (the windshield's
  lower corners) work.
- **Published room dimensions place surfaces, not just people.** Hip room sets the door armrests' faces,
  shoulder room the trim above them, head room the H-point height (SAE: along a line 8 degrees back from
  vertical, plus 102 mm). Calibrate such a rule on the row you measured and apply the same correction to the
  others.
- **Faceted parts from two silhouettes.** Intersect a side outline extruded across the part with a front
  outline extruded along it: both views' outlines come out exactly, every face is flat, and it costs a few
  hundred triangles (the Cybertruck's whole cabin rebuilt this way took the truck from 41k to 26k triangles
  with more detail). Recesses (seat inserts, pockets, vent slots, seams) are boxes subtracted 20 to 45 mm deep.
- **Give every extrusion an explicit direction.** `extrude(face, amount)` follows the face's normal, which
  depends on the polygon's winding: mirrored outlines went the other way and the yoke lost an opening.
- **Profiles drawn in a reversed axis hide mistakes.** With s measured backward (z = front - s), "behind the
  face" is smaller s; two dash faces were built 150 mm toward the driver until a render showed them.
- **Build scripts: module-level names shadow helpers.** A loop variable `belt` in `__main__` replaced the
  function `belt()`; name helpers distinctly.
- **`vite build --watch` ignores `public/`.** After copying a new GLB into an app's `public/models/`, touch a
  source file so the watcher rebuilds, and check the served file's size.
- **Budget for Quest:** per hand-held object under 10k triangles, textures up to 1024 px, GLB under 500 KB; per vehicle under 60k triangles, textures up to 2048 px, GLB under 3 MB, after `build.sh`.
