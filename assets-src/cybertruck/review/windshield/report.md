# Windshield, lower corner and black support

The pane now uses real-vehicle measurements rather than the undersized exterior silhouette fit. The lower
corner has continuous tinted glass where the previous steel ledge blocked the Athens views. The black
support retains the photographed post and diagonal strip, with a rounded return and a closed junction.

[Comparison](comparison.png): reference photograph, previous delivered model, updated model. Both cabin
rows use their solved cameras. The exterior camera is approximate and must not be read as a dimensional fit.

## Measurements and provenance

NHTSA test vehicle O20244500 (2024 Cybertruck Beast), report TR-P44392-01-NC, printed pp.10 and 25:

| Nominal pane measurement | Previous model | Real vehicle / update |
| --- | ---: | ---: |
| Angle from horizontal | 15.92 degrees | 19.9 degrees |
| Width at top | 1,158.83 mm | 1,433 mm |
| Width at lower corners | 1,581.10 mm | 1,785 mm |
| Height in the glass plane | 1,457.14 mm | 1,780 mm |

The rendered export has its normal 0.5 mm panel-edge clearance. The table is the nominal CAD outline, not
an assertion of sub-millimetre manufacturing accuracy. [Dimension audit](../../measure/windshield/documented.json)
and its script verify the coordinate conventions against the measurement diagram.
[NHTSA source and saved two-page excerpt](../../refs/nhtsa/SOURCES.md).

Tesla's service drawing supplies the bowed lower edge and black-border corner shape; removed trim photos
show the moulded support's faces and return. [Tesla reference sources](../../refs/tesla/service-windshield/SOURCES.md).
Tesla's collision-repair body widths are between marked structural holes, not visible trim outlines.
[Body-dimension references](../../refs/tesla/body-dimensions/SOURCES.md).

## Geometry and appearance

- The documented steeper windshield and larger widths require a lower, earlier cowl and a broader roof edge.
  The hood and windshield are built in separate longitudinal regions, so the concave junction does not clip
  away the nose. Material classification uses the active facet in each region as well.
- The dash keeps its measured rear lip and reaches below the lower glass instead of forming an opaque ledge
  across the photographed corner. The pane is its own continuous glass mesh, with a faint blue-green tint
  and clear alpha material; the fired black border stays opaque. Approximate thickness is 7 mm. CYB applies linear alpha Fresnel for stronger reflections at shallow viewing angles and culls back faces to avoid double transparency through the closed slab.
- The black support is bounded by both solved Athens still photos. The cross-cab video's post plane no longer
  controls depth. Its lower outline supplies only the underside tilt. The upright ends within the diagonal
  strip, with an 18 mm overlap at the join. The complete support is clipped inside the corrected body. A 100 mm return envelope replaces the narrower 75 mm limit; the
  photo sight planes determine the visible outline. Rounded edges use 14 mm and four segments.
- Athens 1's upper envelope has 18 mm of tolerance, approximately 10 px at this depth, because the two solved
  cameras disagree by about 13 mm at the lower face. Athens 2 bounds the face independently. This is an
  acknowledged calibration limit, not a newly documented trim measurement.

## Verification

[Previous opaque hits](before-rays.json), [updated hits and actual glass intersections](after-rays.json).
All six Athens 1 clear-corner probes and Athens 2 at (650,1060) intersect the windshield glass and have no
opaque obstruction. The three adjacent Athens 2 support probes at (500,1000), (550,1020), (600,1040) hit
`int_a_pillar_inner`. The audit checks the delivered GLB, including its object transforms, rather than only
the source outline. Thus a missing glass mesh or an enlarged empty opening cannot count as passing.

Full CAD, texture generation, Blender assembly/light bake and Meshopt/WebP build are required. CYB's public
GLB and metadata must match the source output, and the app build must pass. Final sizes/checks are recorded
in `validation.json`: 2,861,372 bytes, 73,174 unique-mesh triangles. The 3 MB size budget passes; the
60,000-triangle target was already exceeded at the 71,488-triangle baseline and remains unmet. The
desktop driver view renders without browser errors; no headset validation was performed.

## Limits

The pane's top placement at roof-apex minus 40 mm remains photo-derived. The bow, frit proportions, glass
tint/thickness, trim return and rounding are estimates. No exact dimensioned trim cross-section was found
in the service documentation. Scaled removed-trim views or direct measurements are still needed to certify
post depth. The c134 camera remains rejected for absolute dimensions. No headset test has been performed.

## Reproduce

Run `measure/windshield/documented.py`, `scripts/3d/render_cams.py` with `cams.json`, and `rays.py` on the public
GLB. Use `compare.py` with matching before/after render directories to regenerate the comparison. The comparison's previous model is the delivered model before this dimensional rework.
