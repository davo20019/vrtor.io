# Rear-view mirror, measured in ../../refs/web/int-athens-3.jpg

Camera: athens3b.camera.json (23 px RMS over 7 references; the mirror is at the top edge, so allow about that).

Marked: the glass's lower corners, where the glossy black face meets the light behind it: left [1291, 116],
right [1697, 122] (the right corner is rounded; its edges extended).

Solved (least squares on the two corners): the glass centred on the
truck (x = 0), its lower edge level, its width the dash render's at the solved depth (the render, from
2,360 back, looks along the mirror: it fixes the ray, not the distance, so width and height scale with depth).
Iterated to a fixed point:

| What | Value |
|---|---|
| Width x height | 187 x 48 (195 x 50 in the render at 1,636 back) |
| Lower edge | 1,449 high (the render's ray at this depth: 1,454; built 1,450) |
| Face | 1,664 back (centre of the lower edge) |
| Turn | 18 degrees toward the driver (the driver's end forward) |
| Residual | 4.8 to 10.5 px |

Freeing x fits exactly at x = -51, 23 degrees; held centred it costs 10 px, inside the camera's error, so the
mirror stays on the centreline. Before: 1,621 back (box centre), square to the truck, read on the x = 0 plane
from the dash render, where depth is barely constrained.

Check: review/mirror/athens3_mirror.png (red: the built glass, yellow: housing and stem, green: the marked
corners).
