# The paths of the vessels BodyParts3D has only in pieces (zdump's curves, as centre lines): the internal carotid and
# vertebral arteries through the skull base, the internal pudendal arteries. Run in Blender with scripts off:
#   blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zpaths.py
# Writes raw/zpaths.json: {name: [[x, y, z] (m, Z-Anatomy's frame), ...]} sampled every millimetre or so.
import bpy, json, os
from mathutils import Vector
from mathutils.geometry import interpolate_bezier

HERE = os.path.dirname(os.path.abspath(__file__))
WANT = ['Internal carotid artery.l', 'Internal carotid artery.r', 'Vertebral artery.l', 'Vertebral artery.r',
        'Internal pudendal artery.l', 'Internal pudendal artery.r']
out = {}
for name in WANT:
    o = bpy.data.objects.get(name)
    if o is None or o.type != 'CURVE':
        continue
    M = o.matrix_world
    pts = []
    for sp in o.data.splines:
        if sp.type == 'BEZIER':
            bp = sp.bezier_points
            for a, b in zip(bp[:-1], bp[1:]):
                seg = interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, 24)
                pts += [M @ p for p in (seg if not pts else seg[1:])]
        else:
            pts += [M @ Vector(p.co[:3]) for p in sp.points]
    out[name] = [list(p) for p in pts]
json.dump(out, open(os.path.join(HERE, 'raw', 'zpaths.json'), 'w'))
print('[zpaths]', {k: len(v) for k, v in out.items()})
