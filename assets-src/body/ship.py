# Copies the built body into the app (apps/bdy/public/models): the GLBs and body.json, which is tree.json with
# each system's file size (for the loading bar). Run after tree.py and build.py.
import json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
DEST = os.path.join(HERE, '..', '..', 'apps', 'bdy', 'public', 'models')
os.makedirs(DEST, exist_ok=True)
tree = json.load(open(os.path.join(OUT, 'tree.json')))
sizes = {}
for s in tree['systems']:
    src = os.path.join(OUT, f"body-{s['id']}.glb")
    shutil.copy(src, DEST)
    sizes[s['id']] = os.path.getsize(src)
tree['sizes'] = sizes
json.dump(tree, open(os.path.join(DEST, 'body.json'), 'w'), separators=(',', ':'))
print('shipped', len(sizes), 'files,', round(sum(sizes.values()) / 1e6, 1), 'MB')
