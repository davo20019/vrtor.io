# Exterior c134 calibration attempt: rejected for dimensions

Camera [5360.6, 7265.3, 22378.6], focal 11952.0 px; RMS 33.93 px.

An unconstrained PnP solution placed the camera behind the truck because these references are almost coplanar. Rejected. This solve keeps the camera above and ahead of the truck. The physically constrained solution has a 34 px RMS residual, errors over 50 px at the roof, and focal length at its upper bound. Its queried points are diagnostic only; no body dimensions were taken from them.

| Reference | Error px |
|---|---|
| bar inner far | 14.1 |
| bar inner near | 3.9 |
| hood corner far | 27.1 |
| hood corner near | 24.7 |
| roof apex far | 52.0 |
| roof apex near | 51.4 |

| Query | Point mm | s back mm |
|---|---|---|
| lower far | [-836.0, 1284.6, 2055.9] | 639.9 |
| lower near | [901.8, 1277.6, 2080.3] | 615.5 |
| lower centre | [46.7, 1268.6, 2112.0] | 583.8 |
| clear far | [-756.1, 1328.6, 1901.5] | 794.3 |
| clear near | [803.5, 1341.3, 1857.1] | 838.7 |
