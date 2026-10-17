# Copies the built body into the app (apps/bdy/public/models): the GLBs and body.json, which is tree.json with the
# list of files to load and their sizes (for the loading bar). Run after tree.py and build.py.
#   body-<system>.glb  BodyParts3D's parts of that system (CC BY 4.0)
#   body-za.glb        Z-Anatomy's additions, whatever their system (CC BY-SA 4.0)
import json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
DEST = os.path.join(HERE, '..', '..', 'apps', 'bdy', 'public', 'models')
os.makedirs(DEST, exist_ok=True)
tree = json.load(open(os.path.join(OUT, 'tree.json')))
files = [s['id'] for s in tree['systems']] + (['za'] if any(n.get('src') == 'za' for n in tree['nodes']) else [])
sizes = {}
for f in files:
    src = os.path.join(OUT, f'body-{f}.glb')
    if not os.path.exists(src):
        continue
    shutil.copy(src, DEST)
    sizes[f] = os.path.getsize(src)
tree['files'] = list(sizes)
tree['sizes'] = sizes
json.dump(tree, open(os.path.join(DEST, 'body.json'), 'w'), separators=(',', ':'))
print('shipped', len(sizes), 'files,', round(sum(sizes.values()) / 1e6, 1), 'MB')
