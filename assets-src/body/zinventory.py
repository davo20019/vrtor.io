# Every Z-Anatomy mesh's bounds and collections, for regfit.py. Run in Blender on Z-Anatomy's Startup.blend with
# scripts off: blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zinventory.py -- out/z-all.json
import bpy, sys, json
import numpy as np
out = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or not len(o.data.polygons):
        continue
    mw = o.matrix_world
    n = len(o.data.vertices)
    co = np.empty(n * 3); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    M = np.array(mw)
    w = co @ M[:3, :3].T + M[:3, 3]
    out[o.name] = {'lo': w.min(0).tolist(), 'hi': w.max(0).tolist(), 'c': w.mean(0).tolist(), 'n': n, 'tris': len(o.data.polygons),
                   'coll': [c.name for c in o.users_collection]}
json.dump(out, open(sys.argv[sys.argv.index('--')+1], 'w'))
