#!/bin/sh
# Build the Roadster end to end: CAD parts, Blender assembly, the door swing check, then compression for the headset.
#   assets-src/roadster/build.sh
#   (first time: uv venv -p 3.12 .venv && uv pip install --python .venv/bin/python build123d pillow numpy opencv-python-headless scipy)
set -e
cd "$(dirname "$0")"
mkdir -p out
.venv/bin/python cad.py
blender -b --factory-startup --python-exit-code 1 --python assemble.py > out/assemble.log 2>&1 || { grep -E -A5 'Error|Traceback' out/assemble.log; exit 1; }
grep -E 'Error|assemble:' out/assemble.log || true
# The doors must swing clear of everything fixed: the build stops if one passes through anything.
blender -b --factory-startup --python-exit-code 1 --python check_doors.py -- out/roadster.glb out/roadster.json > out/check_doors.log 2>&1 || { grep -E 'check_doors|Error' out/check_doors.log; exit 1; }
grep 'check_doors' out/check_doors.log | tail -1
cp out/roadster.glb out/roadster_raw.glb      # uncompressed, for review.py (Blender before 4.3 cannot read meshopt)
npx -y @gltf-transform/cli@4.5.1 optimize out/roadster.glb out/roadster.glb \
  --compress meshopt --texture-compress webp --texture-size 2048 --simplify false \
  --flatten false --join false --instance false --palette false
ls -l out/roadster.glb
