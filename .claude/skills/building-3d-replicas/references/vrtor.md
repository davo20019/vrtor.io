# vrtor specifics

## Worked examples

- `assets-src/altimeter/` (Alti-2 Galaxy altimeter): small, coloured, one front photo plus angled ones; the
  case is a smooth loft (spec.md, "Case shape"). Mounted on the left hand in /jump.
- `assets-src/cybertruck/` (Tesla Cybertruck): large, bare stainless steel, three photos fitted together,
  planar facets as half-spaces, wheels on steer and spin nodes, an interior audited against the published room
  dimensions (measure/cabin/audit.py). REPORT.md lists what went wrong and how it was fixed.
- The standalone repo's `examples/cowbell/` (CC0): five photos, graded against the museum's scan.

## Frame

Model in mm with the front facing +z and up +y; scale the root by 0.001 at export. Hand-held objects keep the
altimeter's convention (the GLB's front on +y, up on -z; vrtor's render_views.py defaults to it). Vehicles and
scenes are y-up in the GLB (front +z): convert the mesh data and node positions to Blender's frame on import
(`(x, -z, y)`), never rotate the root. Set `glbFrame` in `review.json` and write the frame in the `.json`.

## Headset test

Serve it at dev.vrtor.io (`node scripts/headset.js`, every subject, or `node scripts/headset.js <code>`) and
read `output/headset/<code>.log` while the human tests: fps, presses, errors. Start the page's log before
`createXr`, or the rig's own start wins and the page's state is never reported. Done means the human approved
it in the headset.

## Apps

- Metal: apps with a sky or reflection probe (`/jump`, `/spc`, `/taj`, `/mpc`, `/cyb`) can show real metal;
  elsewhere use metallic 0 with a clear coat, or add a probe like `/cyb`'s.
- `vite build --watch` ignores `public/`: after copying a new GLB into an app's `public/models/`, touch a
  source file so the watcher rebuilds, and check the served file's size.
- Budget for Quest: hand-held objects under 10k triangles, textures up to 1024 px, GLB under 500 KB;
  vehicles under 60k triangles, textures up to 2048 px, GLB under 3 MB, after build.sh.
