#!/bin/sh
# Build the Cybertruck end to end: CAD parts, textures, Blender assembly, then compression for the headset.
#   assets-src/cybertruck/build.sh
#   (first time: uv venv .venv && uv pip install --python .venv/bin/python build123d pillow numpy opencv-python-headless scipy)
set -e
cd "$(dirname "$0")"
.venv/bin/python cad.py
.venv/bin/python textures.py
blender -b --factory-startup --python-exit-code 1 --python assemble.py > out/assemble.log 2>&1 || { grep -E -A5 'Error|Traceback' out/assemble.log; exit 1; }
grep -E 'Error|assemble:' out/assemble.log || true
# The doors must swing clear of everything fixed (check_doors.py): the build stops if one passes through anything.
blender -b --factory-startup --python-exit-code 1 --python check_doors.py -- out/cybertruck.glb out/cybertruck.json > out/check_doors.log 2>&1 || { grep -E 'check_doors|Error' out/check_doors.log; exit 1; }
grep 'check_doors' out/check_doors.log
# --prune-attributes false: the mirror glass has no texture in the model, but the app draws its live view on its UVs.
npx -y @gltf-transform/cli optimize out/cybertruck.glb out/cybertruck.glb \
  --compress meshopt --texture-compress webp --texture-size 2048 --simplify false \
  --flatten false --join false --instance false --palette false --prune-attributes false
ls -l out/cybertruck.glb
