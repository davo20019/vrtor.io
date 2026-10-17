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

## What BodyParts3D lacks, from Z-Anatomy

BodyParts3D has no muscles of facial expression and none of chewing (no frontalis, orbicularis, zygomaticus,
buccinator, masseter, temporalis or pterygoids, as meshes or in its tables), no lung surfaces (only the airways and
vessels) and no thyroid or parotid gland. These 62 parts come from **Z-Anatomy, the libre 3D atlas of anatomy**
(https://github.com/Z-Anatomy/Models-of-human-anatomy), **CC BY-SA 4.0**, credited as "Z-Anatomy - The libre 3D
atlas of anatomy - CC-BY-SA 4.0". They are shipped in their own file, `body-za.glb`, under the same licence.
Not taken: Z-Anatomy's NonCommercial models (the kidney, the inner ear) and its brain (from a source with no stated
licence).

Z-Anatomy's skeleton is BodyParts3D's, moved and lightly reposed, so its parts are placed by fitting the bones the
two share, region by region (`regfit.py`): the head on 16 skull bones to 0.7 mm rms (2.7 mm worst), the chest on
the ribs and spine to 3.3 mm. Each lung's lobes are then fitted to that lung's own airway tree (`lungfit.py`): 86 to
97 % of each lobe's airways lie inside it, the rest within a few millimetres of its fissures, where the two models
draw the lobes' borders differently.

### Ligaments, joint capsules, nerves, lymph nodes and fascia

980 more parts from Z-Anatomy: 377 ligaments, joint capsules, menisci and labra, 241 peripheral and cranial nerves
(Z-Anatomy's curves, as their tubes), 160 lymph nodes and tonsils, and 192 pieces of fascia, bursae and tendon
sheaths (their own system, off by default). Their bones aren't placed alike from region to region, so each part rides
on its own bones: each of Z-Anatomy's bones is fitted onto the same bone of ours surface to surface (`bonefit.py`,
ICP with rotation and scale: 186 bones, 0.9 mm rms median; the leg bones, which Z-Anatomy remodelled, 3.5 to 4 mm),
and every vertex of a part moves with its nearest bones, blended by distance (`zplace.py`). Every ligament and
capsule touches bone (closest gap 0.4 mm median, 4 mm at most). Left out: what BodyParts3D already has (its discs,
interosseous membranes, optic, ophthalmic and trochlear nerves; 48 parts by place or name), and the inner ear's
nerves (Z-Anatomy adapted them from a NonCommercial model). Z-Anatomy's lateral temporomandibular ligaments are
named for the wrong side: swapped.

## Names and descriptions on the cards

- **Latin and translated names** (Spanish, French, Portuguese, Italian): Terminologia Anatomica 2, as tabulated in
  Z-Anatomy's `TA2.csv` (CC BY-SA 4.0), matched by name (`learn_names.py`): 1,139 names, about 60 % of the parts;
  the rest are mostly BodyParts3D's numbered vessel segments, which have no standard term.
- **What each part is**: the lead of its English Wikipedia article (CC BY-SA 4.0, by its contributors), credited
  with a link on every card (`learn_wiki.py`). Only articles about anatomy are taken ("Atlas (anatomy)", not the
  titan). Where Wikipedia sends a name to an article titled otherwise, a synonym is shown as the part's own text, an
  article on something related is introduced by its title ("From the article on the rib cage"), and wrong ones are
  left out (read through by hand; lists in `ship.py`). A part with no article of its own shares what it is part of
  ("Part of the tricuspid valve"), or, last, what kind of thing it is ("About lymph nodes").

### Muscles BodyParts3D lacks

BodyParts3D has no latissimus dorsi, rectus abdominis, internal oblique, transversus abdominis, quadratus lumborum or
pyramidalis, and only the left longus colli. These 17 parts (with the inguinal ligaments and iliopectineal arches)
come from Z-Anatomy the same way (`zplace.py`). Of its 489 muscles, the rest were left out as ones we have: by
surface (most of it within 3 mm of one of ours) or by name (the same words, or one name a part of the other's).

### Vessels joined where BodyParts3D leaves them apart

`vessels.py` checks that every vein and artery is connected to the rest (touching within 2 mm, the heart's walls
and chambers counting as vessels, since the venae cavae, the lungs' veins and the aorta meet it there). BodyParts3D's
veins all connected but one; its arteries came in 8 networks: the brain's 151 arteries were cut off from the heart,
because it has the internal carotid and vertebral arteries only inside the skull, and the dorsal arteries of the
penis had no internal pudendal artery to come from.

`vjoin.py` joins them: from one of our vessels' ends to the other's, along Z-Anatomy's path for that vessel carried
onto our skeleton and bent to land exactly on both ends (the carotids' neck part, 175 mm each, including the top of
the common carotid, which BodyParts3D stops 45 mm short of the fork; the vertebral arteries' 200 to 216 mm from the
subclavians; the internal pudendal arteries), as a tube as wide as the vessel it continues (a branch as wide as its
own end, not the big vessel it leaves). Five breaks of 2 to 6 mm (the right suprarenal vein at the inferior vena
cava, the left common carotid at the aortic arch, both inferior epigastric arteries, a renal branch) are closed by a
short tube to the vessel's real parent. Now all 416 veins make one network and all 666 arteries another, also after
simplifying (`vcheck_built.py`, `vkeep.py`: 22 vessels that simplifying parted are kept whole).

## Corrections to BodyParts3D

Found by `audit.py` (where each part lies against its name, parts stored twice, left and right twins) and checked by
hand; listed in `tree.py`:

- Named for the wrong side: the flexor pollicis brevis (each named for the other hand), the ascending lumbar veins.
- "Right fibular vein" (FJ2190) lies in the left thigh, the mirror image of the right thigh's perforating veins:
  renamed.
- The same mesh stored two or three times under different names (the hyoid bone, the cricoid cartilage, the celiac
  trunk, the portal vein, the pancreas, pelvic-floor muscles modelled twice...): 19 copies dropped, one kept.
- Both "superior epigastric vein" meshes are copies of the superficial epigastric veins at the groin: dropped.

## What we changed

- `tree.py`: one tree of every part: body > system > organ > part > ..., from both tables (only the groups that
  nest cleanly), plus a few organs the tables have no single concept for (brain, larynx, skull, a muscle
  from its heads). Each part gets a system and a tissue from its name and what it is.
- `build.py` (Blender): the meshes in metres, the soles at 0, cut from 6.7 million triangles to about 1.3
  million (smaller parts keep more of theirs), one GLB per system, Draco-compressed. Each part keeps its own
  mesh and its BodyParts3D file id as its name.
- `ship.py`: copies the GLBs and the tree (`body.json`) into `apps/bdy/public/models`.

The colours and surfaces are ours (`apps/bdy/src/tissues.js`): the data has none.

## Known gaps

- No fat. No lymph vessels, only nodes.
- The quadrangular membranes and cricopharyngeal ligaments were taken for parts we have and left out.
- No real superior epigastric veins (see above).
- One body (male); no female organs.

## Rebuild

    ./fetch.sh
    blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zinventory.py -- out/z-all.json
    python3 regfit.py
    blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zexport.py
    python3 tree.py && blender -b -P lungfit.py && python3 tree.py
    blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zdump.py
    python3 bonefit.py && python3 zplace.py && python3 tree.py
    blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zpaths.py
    python3 vjoin.py && python3 tree.py && python3 vessels.py
    python3 learn_names.py && python3 learn_wiki.py
    blender -b -P build.py && blender -b -P vcheck_built.py && python3 vkeep.py   # repeat build if vkeep added any
    python3 ship.py && python3 audit.py
