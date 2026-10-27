#!/bin/sh
# The Coronation of Napoleon, from the photograph to apps/sacre/public. Each step's inputs are in its docstring.
set -e
cd "$(dirname "$0")"
PY=.venv/bin/python
./fetch.sh
$PY textures.py
blender -b --factory-startup --python-exit-code 1 --python assemble.py > out/assemble.log 2>&1 || { grep -E 'Error|assemble' out/assemble.log; exit 1; }
grep '\[assemble\]' out/assemble.log
# The painted tiles as KTX2 (UASTC + Zstandard), so they stay GPU-compressed on the headset. Each 4k tile must
# stay under Cloudflare's 25 MiB per-file limit: raise its -uastc_rdo_l if one grows.
mkdir -p out/ktx2
enc() { basisu -uastc -uastc_level 2 -mipmap -ktx2 "$@" > /dev/null; }
for t in 00 01 02 10 11 12; do
  enc -uastc_rdo_l 3 -output_file out/ktx2/tile_${t}_4k.ktx2 work/tile_${t}_4k.png &
  enc -uastc_rdo_l 2.5 -output_file out/ktx2/tile_${t}_1k.ktx2 work/tile_${t}_1k.png &
  enc -uastc_rdo_l 4 -normal_map -output_file out/ktx2/tile_${t}_normal.ktx2 work/tile_${t}_normal.png &
  wait
done
enc -uastc_rdo_l 2 -linear -output_file out/ktx2/weave_detail.ktx2 work/weave_detail.png
APP=../../apps/sacre/public
mkdir -p $APP/models $APP/scan
cp out/sacre.glb out/sacre.json $APP/models/
cp out/ktx2/*.ktx2 $APP/scan/
ls -l $APP/models $APP/scan
