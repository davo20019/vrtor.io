# Measurements (16 October)

Features no outline can see, measured in mm by marking them in two to six photos and solving them together with the
photos' cameras (tools/bundle.py, a bundle adjustment anchored by the plate corners, the wheel hubs and the tyres'
contact points; each camera may move from its fit, held by a prior). The values are in cad.py MEAS, at the sizes in
cad.py REF, and are landmarks for the fit (review.json, fit.photos[].landmarks).

- `ba.json`: the marks, in each photo's full-resolution pixels (`<photo>:r` marks the car's right-hand twin).
  `.venv/bin/python tools/bundle.py measure/ba.json` prints each point and each mark's error; `--write` saves
  `fit/<photo>/camera_ba.json` and `ba.out.json`. Final: 11.5 px rms, the features within 10 px except the two left
  out of the fit (the white leg's foot in the side photo, 11 px, and the door's rear shut line in the side photo,
  33 px: each marks a different point there than in the other photos), and one anchor: the front wheel's hub in the
  front three-quarter photo, 60 px off (open, REPORT.md).
- **Mark both sides in a view that sees both.** The first solve had the top view's marks on the car's right only;
  that camera slid sideways to absorb their error, and the front features came out 75 to 105 mm too narrow (the nose
  corner 529 out instead of 606). With the left-hand twins marked too, the top view holds the widths: its nose corners
  are 0.72 of the tail corners' spread, as the front photo's proportions also say once its perspective is counted.
- `front.json`, `rear.json`: the same marks for tools/tri.py (plain triangulation through the fitted cameras), kept to
  show why the bundle was needed: through the round-5 cameras the same marks disagree by 20 to 45 px.
- `ba_front.json`: the front's marks alone.

How the pixels were read: tools/grid.py draws a labelled grid on a crop of the photo. Reading a coarse grid by eye
went wrong once (rear_high, 300 px off: caught by the bundle's errors), so read from fine grids, and compute the
position from the crop's scale when the labels are crowded.

## The side photo's camera height

The fit put the side photo's camera 1.7 m up. The photo itself says otherwise: the hood is flat across (the front
three-quarter shows its edge at the windshield as one straight line) and lit, so from 1.7 m a white band of hood would
show above the fender ridge; none does, so the camera is at about the hood plane's height (0.77 m at the camera).
review.json gives the side photo its own camera height range, 0.5 to 0.85 m (fit_silhouette.py: per-photo
`cameraHeightMm`). With the camera too high, the model's front read 50 to 80 mm too high against the photo.
