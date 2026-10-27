#!/bin/sh
# The heart, from the downloads to apps/hrt/public/models/heart.glb. Each step's inputs are in its docstring.
set -e
cd "$(dirname "$0")"
PY=.venv/bin/python
./fetch.sh
[ -f work/average.vtu ] || $PY -c "import pyvista as pv; pv.read('raw/average.vtk').save('work/average.vtu')"
$PY surfaces.py
$PY bp3d.py && $PY register.py && $PY warp.py
$PY walls.py
$PY valves.py
$PY motion.py
rm -rf work/parts
$PY subvalve.py
# Nothing that lives inside the heart may come out through its walls, at rest or squeezed: the build stops.
$PY check_inside.py
$PY coronaries.py
$PY vessels.py
$PY parts.py
blender -b --factory-startup --python-exit-code 1 --python assemble.py > out/assemble.log 2>&1 || { grep -E 'Error|assemble' out/assemble.log; exit 1; }
grep '\[assemble\]' out/assemble.log
npx -y @gltf-transform/cli optimize out/heart.glb out/heart.glb --compress meshopt --simplify false --flatten false \
  --join false --instance false --palette false --prune-attributes false
cp out/heart.glb ../../apps/hrt/public/models/heart.glb
cp work/heart_parts.json ../../apps/hrt/public/models/heart.json
ls -l ../../apps/hrt/public/models/
