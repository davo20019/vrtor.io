#!/bin/sh
# Downloads BodyParts3D 4.0 (DBCLS, CC BY 4.0) into raw/: the element meshes and the tables of the IS-A and
# PART-OF trees. About 200 MB to download, 600 MB unpacked.
set -e
cd "$(dirname "$0")"
mkdir -p raw && cd raw
B=https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST
for f in README_e.html isa_parts_list_e.txt partof_parts_list_e.txt isa_inclusion_relation_list.txt partof_inclusion_relation_list.txt \
         isa_element_parts.txt partof_element_parts.txt isa_BP3D_4.0_obj_99.zip partof_BP3D_4.0_obj_99.zip; do
  [ -f "$f" ] || curl -sSfLO "$B/$f"
done
mkdir -p objisa obj
unzip -q -o isa_BP3D_4.0_obj_99.zip -d objisa
unzip -q -o partof_BP3D_4.0_obj_99.zip -d obj

# Z-Anatomy (CC BY-SA 4.0): the face's and the jaw's muscles, the lungs' lobes and two glands BodyParts3D lacks
# (zexport.py takes them out of its Blender file). About 90 MB.
mkdir -p zanatomy && cd zanatomy
Z=https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master
for f in Z-Anatomy.zip License.txt Readme.md; do
  [ -f "$f" ] || curl -sSfLo "$f" "$Z/$f"
done
mkdir -p x && unzip -q -o Z-Anatomy.zip -d x
