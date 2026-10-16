#!/bin/sh
# Can the photos measure the overall scale? Scale every size in params.json by k, solve only the cameras of the
# photos that see the plate, and print the plate and wheel landmark errors. Usage: tools/scale_test.sh 0.95 1.0 1.05
set -e
cd "$(dirname "$0")/.."
for k in "$@"; do
  T=/tmp/scale_test_$k; rm -rf $T; mkdir -p $T
  cp cad.py $T/; cp -r refs $T/refs 2>/dev/null || ln -s "$(pwd)/refs" $T/refs
  .venv/bin/python - "$k" "$T" <<'PY'
import json, sys
k, T = float(sys.argv[1]), sys.argv[2]
sys.path.insert(0, '.')
import cad
p = dict(cad.P)
keys = ['nose_z', 'tail_z', 'half_w', 'roof_h', 'nose_h', 'tail_h', 'wheelbase', 'r_f', 'r_r', 'w_f', 'w_r', 'track_f', 'track_r']
json.dump({kk: p[kk] * k for kk in keys}, open(f'{T}/params.json', 'w'))
cfg = json.load(open('review.json'))
cfg['fit']['params'] = {}
cfg['fit']['photos'] = [ph for ph in cfg['fit']['photos'] if ph['name'] in ('q34', 'rear_high')]
json.dump(cfg, open(f'{T}/review.json', 'w'))
PY
  (cd /home/claude/vrtor && assets-src/roadster/.venv/bin/python scripts/3d/fit_silhouette.py $T | grep -E "^\| (q34|rear_high)" | awk -v k=$k -F'|' '{print "k=" k, $2, "IoU", $5, "outline", $6, "landmark", $7}')
done
