#!/bin/sh
# Build the Cybertruck end to end: CAD parts, textures, Blender assembly, then compression for the headset.
#   assets-src/cybertruck/build.sh
#   (first time: uv venv .venv && uv pip install --python .venv/bin/python build123d pillow numpy opencv-python-headless scipy)
set -e
cd "$(dirname "$0")"
.venv/bin/python cad.py
.venv/bin/python textures.py
blender -b --factory-startup --python assemble.py 2>&1 | grep -E 'Error|assemble:'
npx -y @gltf-transform/cli optimize out/cybertruck.glb out/cybertruck.glb \
  --compress meshopt --texture-compress webp --texture-size 2048 --simplify false \
  --flatten false --join false --instance false
ls -l out/cybertruck.glb
