# Human body: sources

## The parts

**BodyParts3D 4.0** (Release 4.0, 2013-06-19), by the Database Center for Life Science (DBCLS), Japan:
https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html

Licence: **CC BY 4.0** (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html, checked 2026-10-17).
Credit line, as the licensor asks: "BodyParts3D, © The Database Center for Life Science licensed under CC
Attribution 4.0 International". The OBJ files' own headers still carry the older licence (CC BY-SA 2.1 Japan);
the database was relicensed under CC BY 4.0 on 2025-02-27 (README_e.html, update history).

BodyParts3D is a set of 2,234 separate meshes ("elements", one OBJ each, in millimetres) of a whole adult male
body, each tied to its concept in the Foundational Model of Anatomy (FMA). Its source is TARO, a whole-body
MRI voxel model (2 mm) of an adult Japanese man made by Japan's National Institute of Information and
Communications Technology, segmented further and refined by medical illustrators from atlases and textbooks
(Mitsuhashi et al., Nucleic Acids Research 37:D782, 2009, doi:10.1093/nar/gkn613). Two tables say which elements make up each named organ: the PART-OF
tree (the heart is its walls, chambers, valves) and the IS-A tree (a left gastrocnemius is a gastrocnemius).
We use the IS-A download, which has every element (the PART-OF one has 1,258).

## What we changed

- `tree.py`: one tree of every part: body > system > organ > part > ..., from both tables (only the groups that
  nest cleanly), plus a few organs the tables have no single concept for (brain, larynx, skull, a muscle
  from its heads). Each part gets a system and a tissue from its name and what it is.
- `build.py` (Blender): the meshes in metres, the soles at 0, cut from 6.7 million triangles to about 1.3
  million (smaller parts keep more of theirs), one GLB per system, Draco-compressed. Each part keeps its own
  mesh and its BodyParts3D file id as its name.
- `ship.py`: copies the GLBs and the tree (`body.json`) into `apps/bdy/public/models`.

The colours and surfaces are ours (`apps/bdy/src/tissues.js`): the data has none.

## Known gaps in the data

- No lung surfaces: the lungs are their airways and vessels only.
- Few muscles of the face; no fat, fascia between muscles, lymph nodes or most peripheral nerves.
- One body (male); no female organs.

## Rebuild

    ./fetch.sh && python3 tree.py && blender -b -P build.py && python3 ship.py
