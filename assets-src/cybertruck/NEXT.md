# Cybertruck: what's left to make the take-apart truck exact (handoff, 2026-10-12)

The truck comes apart into 192 parts in the showroom's parts space (vrtor.io/cyb, Menu > Take it apart), in the
order Tesla's Service Manual removes them, by tap, by grab-and-pull in VR, shared with everyone who has joined.
Background: spec.md ("Disassembly", "Doors: each its own assembly", the door, seat and dash paragraphs).
This file is the list of what is still not exact, and how to close each item. Rule: no guesses. A value comes from
a measurement or a source, or it stays marked as unmeasured in spec.md.

## How things fit together

- Model: assets-src/cybertruck. cad.py (parts, mm) -> assemble.py (Blender, GLB) -> check_doors.py (every door swung
  0..65 deg against every fixed part; build fails on any crossing) -> gltf-transform. Run `./build.sh`.
- The parts list: disassembly.py (manual names, nodes, way off, `after`, `on`), checked against the model and the
  manual's removal graph (refs/tesla/servicemanual/removal-graph.json, PARTS.md, procedures/GUID-*.json, each with
  its title, section, steps and photo URLs) by assemble.py, written to out/cybertruck.json (disassembly).
- Door parts: cad.py Door, door_assembly, door_inside (DOOR_INSIDE: openings traced on the manual's drawings),
  door_hardware (DOOR_HW). Seats: front_seat, rear_bench. Dash: interior() after "The dash as the manual takes it
  apart". Mounts: parts/mounts.json.
- App: apps/cyb/src/disassembly.js (rules, layout on the plinth, grab/hold/release, multiplayer apply),
  main.js (setUpParts, setUpGrab, sharePart/partsFromRoom, MODEL_V: the model's version, bump it with each new GLB).
  Shared state: apps/home/src/presence.js (room `state` and `event` messages), packages/xr-shell/src/presence.js.
- Tests: review/apptests/*.mjs (Playwright with the cached Chromium, against the running dev stack at
  http://localhost:8790/cyb/): test2 (take everything off and back), taps (the order), grab (pull, free, let go),
  stuck (parts take-all can't reach), place (layout warnings), multi (three visitors), multi-prod (production, only
  in an empty room). Run from a folder with playwright-core 1.58 installed (`npm i playwright-core@1.58.2`).
- The manual's photos: every procedure's images are listed in refs/tesla/servicemanual/procedures/*.json ("images");
  fetch one from https://service.tesla.com/docs/Cybertruck/ServiceManual/en-us/<name> (2026-10-12: the interior
  sections' ~2,150 were cached in ~/.cache/cyb-manual, not committed). The photos of a part taken off settle what is
  one part and what isn't (the bench's centre back turned out to be the armrest).
- Never start another `wrangler dev` in apps/*: the io.vrtor.headset LaunchAgent already serves every app on
  8790..8799 and 4179 (dev.vrtor.io); a second one breaks it (fix: `launchctl kickstart -k gui/$(id -u)/io.vrtor.headset`).
- Deploy apps/cyb (and apps/home if presence changed) from a clean `git worktree` at the pushed commit, node_modules
  symlinked; then check the live JS carries MODEL_V and the live JSON has the parts.

## Open items

### 1. Precision of the read sizes (about +-25 mm)
What: door openings, closeout panels and their parts, hardware sizes, seat cover/foam/frame thicknesses, dash panel
splits (quarter panels at 700 out), airbags, footwell cover, gap hider: read from the manual's drawings and photos
scaled to the model, not surveyed.
Close it with: measurements on a real Cybertruck (a door with its trim off; a seat out; the dash's panel seams), or
solved cameras: a photo with 6+ known points solved with scripts/3d/measure.py, then the feature's points measured
on known planes. The manual's photos have no scale bar; they can only be solved where known model points show.
Record each value with its source in spec.md and replace the constant in cad.py.

### 2. Front door latch height
What: DOOR_HW['f']['latch'] = 954 is the rear door's striker height (the C-pillar holes in Tesla's body dimensions,
figure 1). Nothing marks the front door's.
Close it with: a photo of the B-pillar's front striker or the front door's rear face with known points (door seams,
belt line, sill) solved with measure.py, or a measurement on a truck.
Checked 2026-10-12 without result: Door Latch - Front - LH and Door - Front - LH (Remove and Replace, 99 photos) show
the latch and its three screws only in close-ups with no scale; c166 shows the open doors' outsides, not their rear
faces; Tesla's body dimensions mark no front striker holes.

### 3. Door hinge axis (position and tilt) and the hinges' real place
What: Door.hinge stands 2 mm outside the skin at the front seam, vertical; it makes the doors swing clear but is not
the real pin. The service manual's hinge photos show pin hinges inside the door's front gap, behind the fender.
The hinge hardware is drawn as plates flush in the pillar and the door's front face, around that axis.
Tried and failed: c166 (both doors open, from the front) solves to 41 px RMS at best (measure/hinge/c166_hinge.py);
a 5 deg tilt moves the door's corner only ~55 mm, so that photo can't measure it.
Checked 2026-10-12: the manual's door removal photos show the hinge bolts in close-up only; no published pin
position (web search).
Close it with: the hinge pins measured on a truck (height from the ground, behind the front seam, in from the skin,
for upper and lower), or two open-door photos with solvable cameras (fit the door's pose as a rotation from shut).
Then move Door.hinge (and the axis's tilt: the app turns each door about its node's +y; a tilted axis needs the
node turned to the axis), rebuild the hinge hardware round the real pins, and keep check_doors passing.

### 4. Frameless glass drop
What: GLASS_DROP = 12 mm is the least that clears the roof's edge in the model. Owners confirm it drops on opening
with the window up; nobody gives the distance. Not modelled: with the window fully down it rises slightly on opening
(Tesla update, Sept 2026, per basenor.com citing @TeslaNewswire).
Checked 2026-10-12: no published figure (web search; the manual's glass adjustment has none).
Close it with: a close video of a door opening with the window up (glass top edge against the roof seal, frame by
frame, scaled from the glass's known height) or a measurement on a truck.

### 5. Parts the manual doesn't name: done (2026-10-12)
The bench's centre back is the 2nd row armrest (the centre headrest sits on it), and the centre cushion is half of
the LH cushion assembly; the front fender flare is the manual's "front fender flare cover". See spec.md, Disassembly.
Still left over from that pass: the A-pillar's forward, mid and upper trims and the B-pillar's upper and lower trims
are one piece each per side in the model (their seams are not measured); the rear header and the rear wall's trims
are not built; the 2nd row armrest doesn't fold down in the app (its hinge point and fold aren't measured).

### 6. Structure behind the dash (not built)
What: aerobracket, super cowl, supercarrier, defrost panel, demist and floor ducts, airwave modules, display and
downleg brackets, HVAC: procedures with no section in the crawl (find them by title), the "down to structure" depth the user did not choose (2026-10-12). The dash panels are solid now.
Close it, if wanted: hollow the dash panels (top pad, mid, lower) to shells, then build each from its procedure's
photos (procedures/*.json), placed behind the panels in the manual's order.

### 7. Seat foam showing through its cover: fixed
The front seat back's foam (cad.py front_seat: core eroded 14 mm, 22 across, 30 from the front) no longer shows
with the cover on (review/seats/sheet.png). Check the same on any new padded part.

## Budget (decide before adding much more)

68,110 triangles drawn (GLB index counts per node; review.py undercounts: Blender drops degenerate triangles the
GPU still draws), 309 meshes, 2.97 MB against the 3 MB limit (2026-10-12, 192 parts). The 60,000-triangle budget is already exceeded. Measure the frame rate
on the Quest in the showroom with every part laid out on the plinth before adding more, then set the budget from
that measurement.
