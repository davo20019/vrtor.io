#!/bin/sh
# Build the altimeter end to end: CAD parts, textures, Blender assembly, then compression for the headset.
#   assets-src/altimeter/build.sh            (first time: uv venv .venv && uv pip install --python .venv/bin/python build123d pillow numpy)
set -e
cd "$(dirname "$0")"
.venv/bin/python cad.py
.venv/bin/python textures.py
blender -b --factory-startup --python assemble.py 2>&1 | grep -E 'Error|assemble:'
npx -y @gltf-transform/cli optimize out/altimeter.glb out/altimeter.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify false \
  --flatten false --join false --instance false --palette false   # keep the needle node and the dial material (optimize flattens and joins by default)
ls -l out/altimeter.glb
