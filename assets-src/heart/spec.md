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

## Built since

- Great vessels (vessels.py): BodyParts3D's vessels as voxel skeletons (centreline and radius), splined, joined
  to the CT stubs on square cuts 22 mm above the valve rings; radii scaled to the CT stub where they meet (one
  adult to another: clamped to 0.8-2.2x), branches no wider than 0.9x their parent.
- Look (surface.py, apps/hrt/src/tissue.js): colours of fresh tissue per vertex; epicardial fat as geometry
  (up to 1.3 mm) along the main coronary vessels; creases darker; a clear coat, fine relief on rest positions.
- Inside the walls (endo.py): trabeculae as columns with cross links, moderator band 20.3 mm (published
  16.2 +- 2.3, 11.3-24.3), crista terminalis 6.2-4.2 mm, pectinate muscles, fossa ovalis rim.
- Electricity (conduction.py): eikonal activation; atrial muscle 0.88 m/s for a 105 ms P wave, ventricular
  0.39 m/s for a 95 ms QRS (both within textbook ranges); last activated: the LV's anterior base (Durrer:
  posterior base). Contraction follows it: vsys and afill in four bands by activation time (cycle_bands.py).
- Checks: check_inside.py (nothing inside the heart comes out through its walls), motion volumes.

## Known differences and open work

- The pulmonary ring is oval (36 x 22 mm) in the averaged CT; a real one is round. Built as measured.
- Trabecular and pectinate sizes, the fossa's size and vessel wall thicknesses are guesses (not found).
- The LV's last activated region comes out anterobasal; Durrer reports posterobasal.
- A faint seam where the aortic tube meets the trimmed CT root.
- Not yet tested on a headset (budget: 300k triangles, 4.4 MB GLB).
