# The human heart (/hrt): a normal adult heart, every part, beating

A separate subject from /bdy so the heart can be shown in full detail: every part grabbable, a real beat,
valves that open and close, the electrical system. Built with the building-3d-replicas skill. Units mm, CT
frame (x to the patient's left, y to the back, z up) until export.

## Sources

| What | Source | Licence |
|---|---|---|
| Shape of the walls, chambers, aorta and pulmonary trunk roots, valve rings; muscle-fibre directions; ventricular coordinates | Rodero C, Strocchi M, et al. 2021, average of 19 healthy adults' end-diastolic CT (statistical shape model), Zenodo 4593739 | CC BY 4.0 |
| Coronary arteries and cardiac veins; where the RV papillary muscles stand | BodyParts3D 4.0 (DBCLS), the /bdy heart, carried onto the CT shape by register.py and warp.py | CC BY 4.0 |
| Every size and motion number not in those | refs/literature.md (each with its paper) | facts |

## Checks so far

| Check | Built | Reference |
|---|---|---|
| LV muscle volume | 135.3 cm3 | dataset 135.34 |
| LV / RV end-diastolic volume | 126.6 / 149.8 mL | dataset 126.5 / 149.7 |
| Mitral ring | 35.6 x 29.1 mm, perimeter 98.6 | Henry 2022 M 38 AL-PM; Pouch 2014 SL 28.5 |
| Tricuspid ring perimeter | 115.8 mm | Muraru 2022 M 116 +- 12 |
| LV / RV wall thickness | 8.5 / 3.7 mm | KB 2020 LV basal M 9.0 +- 1.4 |
| BodyParts3D onto CT, after the warp | 1.9 to 2.7 mm rms per chamber | |

## Pipeline

fetch.sh -> surfaces.py (closed surface per labelled part) -> bp3d.py, register.py, warp.py (BodyParts3D heart
onto the CT) -> walls.py (triangle budget, coordinates kept) -> valves.py (valves_params.json) -> motion.py
(motion_params.json; cavities.py measures the chambers) -> review_*.py renders in review/.

## Decisions

- Valves are built on the CT's own rings, not taken from BodyParts3D: its leaflets are in one state only, lie
  5 to 11 mm off the CT rings, and its pulmonary cusps landed up to 33 mm off centre. Where each leaflet sits
  comes from this heart's landmarks: the anterior mitral leaflet faces the aortic valve, the aortic coronary
  cusps are centred on the coronary ostia, the septal tricuspid leaflet on the septum, the pulmonary valve's
  facing commissure towards the aortic valve.
- The closed mitral is solved chord by chord: each leaflet's published length, less the coaptation zone, and
  the tenting depth split each chord (the closure line comes out curved close to the posterior ring).
- LV papillary muscles from BodyParts3D are 53 to 62 mm long (chordae included) and one stands near the
  septum: they will be built at their published positions and sizes instead.
- The beat is two displacement fields over the CT points (ventricular systole, atrial filling), calibrated on
  chamber volumes with muscle volume kept; every other part takes its motion from the wall it is mounted on.

## Known differences and open work

- The pulmonary ring is oval (36 x 22 mm) in the averaged CT; a real one is round. Built as measured.
- The CT's great vessels stop just past the valves: extend them along BodyParts3D's paths (arch, pulmonary
  bifurcation, venae cavae, pulmonary veins).
- RV motion: its outflow tract barely contracts (the fade at the pulmonary trunk holds it), so the RV reaches
  67 mL, not the 62.9 mL a 58% ejection fraction needs; it needs its own late, peristaltic contraction. A
  fringe remains along the LV/RV seam at end-systole.
- Still to build: papillary muscles, chordae, coronary vessels laid on the surface, inner-wall detail
  (trabeculae, pectinate muscles, moderator band, crista terminalis, fossa ovalis, Eustachian and Thebesian
  valves), conduction system and activation times, timing curves, Blender assembly to GLB with morph
  targets, the /hrt app.
