# Cabin corner review — 2026-10-11

The first corner update still left duplicate roof-edge rails over the quarter glass,
a post cut against incompatible windshield geometry, and a notch where the door cap
and ambient strip failed to turn in toward the dash.

The windshield bar now supplies the front edge trim without an overlapping headliner
rail. The photo-fitted post is capped below the current windshield before joining the
bar; the subsequent pane-footprint subtraction is removed. Long moulded edges receive
a 14 mm bevel without tiny boolean seams clamping the rounding to zero.

The front door starts at the dash's 1,159 mm white-panel height, follows its pointed
profile with a 2 mm seam, and carries the cap and light inward to that point. The joint
rounds by 0.7 mm while the dash's long chamfers retain their 12 mm rounding.

`before.png` and `after.png` use the existing solved v376f838 camera, rather than a
guessed view. `reference_pair.png` shows the real photograph on the left and rebuilt
model on the right. `cams.json` also checks the independently solved Athens views.
The camera fit and trim radii remain estimates; these comparisons do not certify an
exact replica or surveyed trim dimensions.

Validation: changed CAD solids are valid, with one solid per white door panel and one
post/bar solid per side. The lighting was rebuilt at 512 samples; the compressed GLB
loads in the app with no console errors. Desktop and 390 × 844 phone views were checked,
including opening and closing the doors. The door panel and cap travel with the door;
the post and windshield bar stay on the body. The Vite production build passes.

Model SHA-256: `85e6fee23e1588051000cf11e0b85966f155ade59cc8baded258c728d3bef8df`.
Source, public and production copies match. The app requests the new version explicitly
to avoid the stable model URL's one-hour cache.
