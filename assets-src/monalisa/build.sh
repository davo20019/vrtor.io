#!/bin/sh
# The Mona Lisa, from the C2RMF scan to apps/mona/public. Each step's inputs are in its docstring.
set -e
cd "$(dirname "$0")"
PY=.venv/bin/python
./fetch.sh
$PY textures.py
blender -b --factory-startup --python-exit-code 1 --python assemble.py > out/assemble.log 2>&1 || { grep -E 'Error|assemble' out/assemble.log; exit 1; }
grep '\[assemble\]' out/assemble.log
# The painted face as KTX2 (UASTC + Zstandard), so it stays GPU-compressed on the headset. The 4k colour must
# stay under Cloudflare's 25 MiB per-file limit: raise its -uastc_rdo_l if it grows.
mkdir -p out/ktx2
enc() { basisu -uastc -uastc_level 2 -mipmap -ktx2 "$@" > /dev/null; }
enc -uastc_rdo_l 2.5 -output_file out/ktx2/front_2k_color.ktx2 work/front_2k_color.png &
enc -uastc_rdo_l 3 -normal_map -output_file out/ktx2/front_2k_normal.ktx2 work/front_2k_normal.png &
enc -uastc_rdo_l 5 -linear -output_file out/ktx2/front_2k_orm.ktx2 work/front_2k_orm.png &
enc -uastc_rdo_l 3 -output_file out/ktx2/front_4k_color.ktx2 work/front_4k_color.png &
enc -uastc_rdo_l 4 -normal_map -output_file out/ktx2/front_4k_normal.ktx2 work/front_4k_normal.png &
wait
APP=../../apps/mona/public
mkdir -p $APP/models $APP/scan
cp out/monalisa.glb out/monalisa.json $APP/models/
cp out/ktx2/*.ktx2 $APP/scan/
ls -l $APP/models $APP/scan
