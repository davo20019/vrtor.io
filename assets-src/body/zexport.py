# What BodyParts3D doesn't have, from Z-Anatomy (CC BY-SA 4.0): the muscles of the face and of chewing, the scalp's
# aponeurosis, the lungs' lobes, the thyroid and parotid glands. Run in Blender on Z-Anatomy's Startup.blend with
# scripts off:
#   blender -b --disable-autoexec raw/zanatomy/x/Z-Anatomy/Startup.blend -P zexport.py
# Each part is taken as Z-Anatomy shows it (its modifiers applied), moved into BodyParts3D's frame through the fit of
# its region (regfit.py: the head on 16 skull bones, 0.7 mm rms; the chest on the ribs and spine) and written as an
# OBJ like BodyParts3D's own (mm, Z up, a header with its name and bounds) in raw/zextra/, ZA0001.obj and on.
# Not taken: Z-Anatomy's NonCommercial models (the kidney, the inner ear) and its brain (from a source with no
# stated licence); none of them is in the list below.
import bpy, json, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'raw', 'zextra')
reg = json.load(open(os.path.join(HERE, 'out', 'z-regions.json')))

# (Z-Anatomy object name without its side, region, our name pattern). {side}: Left/Right. Checked by hand against
# BodyParts3D's own parts: the eye muscles, tarsal plates, trochleas, tongue muscles and platysma are already ours.
FACE = [
    'Bucinator', 'Corrugator supercilii', 'Deep part of masseter', 'Superficial part of masseter', 'Depressor anguli oris',
    'Depressor labii inferioris', 'Depressor septi nasi', 'Epicranial aponeurosis', 'Frontalis muscle',
    'Inferior head of lateral pterygoid muscle', 'Superior head of lateral pterygoid muscle', 'Medial pterygoid muscle',
    'Levator anguli oris', 'Levator labii superioris', 'Levator nasolabialis', 'Mentalis muscle', 'Nasalis muscle',
    'Occipitalis muscle', 'Orbicularis oris muscle', 'Orbital part of orbicularis oculi', 'Palpebral part of orbicularis oculi',
    'Procerus muscle', 'Risorius muscle', 'Temporalis muscle', 'Temporoparietalis muscle', 'Zygomaticus major muscle',
    'Zygomaticus minor muscle', 'Parotid gland',
]
PARTS = [(f'{n}.{s}', 'head') for n in FACE for s in ('l', 'r')] + [
    ('Thyroid gland', 'head'),
    ('Superior lobe of left lung', 'thorax'), ('Inferior lobe of left lung', 'thorax'),
    ('Superior lobe of right lung', 'thorax'), ('Middle lobe of right lung', 'thorax'), ('Inferior lobe of right lung', 'thorax'),
]
RENAME = {'Bucinator': 'buccinator', 'Levator nasolabialis': 'levator labii superioris alaeque nasi'}


LOBES = {'Superior lobe of left lung': 'Tissue of upper lobe of left lung', 'Inferior lobe of left lung': 'Tissue of lower lobe of left lung',
         'Superior lobe of right lung': 'Tissue of upper lobe of right lung', 'Middle lobe of right lung': 'Tissue of middle lobe of right lung',
         'Inferior lobe of right lung': 'Tissue of lower lobe of right lung'}


def our_name(zname):
    """'Deep part of masseter.l' -> 'Deep part of left masseter'; 'Frontalis muscle.r' -> 'Right frontalis'."""
    if zname in LOBES:
        return LOBES[zname]
    m = re.match(r'^(.*)\.([lr])$', zname)
    if not m:
        return zname
    base, side = m.group(1), {'l': 'left', 'r': 'right'}[m.group(2)]
    base = RENAME.get(base, base)
    base = re.sub(r' muscle$', '', base)
    p = re.match(r'^(.*? (?:part|head) of )(.+)$', base, re.I)
    if p:
        return f'{p.group(1)}{side} {p.group(2)}'
    return f'{side.capitalize()} {base[0].lower()}{base[1:]}'


os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
dg = bpy.context.evaluated_depsgraph_get()
written = []
for i, (zname, region) in enumerate(PARTS, 1):
    ob = bpy.data.objects.get(zname)
    if ob is None or ob.type != 'MESH':
        print('[zexport] missing', zname)
        continue
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    M = np.array(ob.matrix_world)
    w = co @ M[:3, :3].T + M[:3, 3]
    f = reg[region]
    bp = (w - np.array(f['t'])) / f['scale'] * 1000.0          # BodyParts3D's frame, mm
    tris = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', tris)
    tris = tris.reshape(-1, 3)
    # Z-Anatomy's left-side parts are mirror images of the right (scale -1): mirroring turns every triangle inside out,
    # so they are wound back, or the renderer culls their outsides and you see through the left half of the face.
    if np.linalg.det(M[:3, :3]) < 0:
        tris = tris[:, ::-1]
    ev.to_mesh_clear()
    name = our_name(zname)
    el = f'ZA{i:04d}'
    lo, hi = bp.min(0), bp.max(0)
    with open(os.path.join(OUT, el + '.obj'), 'w') as out:
        out.write('#\n# Z-Anatomy, the libre 3D atlas of anatomy, CC BY-SA 4.0 (https://github.com/Z-Anatomy/Models-of-human-anatomy)\n')
        out.write(f'# Z-Anatomy object : {zname}\n# Placed by : {region} fit ({f["rms_mm"]:.1f} mm rms)\n')
        out.write(f'# File ID : {el}\n# English name : {name}\n')
        out.write('# Bounds(mm): ({:.4f},{:.4f},{:.4f})-({:.4f},{:.4f},{:.4f})\n#\n'.format(*lo, *hi))
        for v in bp:
            out.write(f'v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n')
        for t in tris + 1:
            out.write(f'f {t[0]} {t[1]} {t[2]}\n')
    written.append({'el': el, 'name': name, 'z': zname, 'tris': int(len(tris))})
json.dump(written, open(os.path.join(HERE, 'out', 'zextra.json'), 'w'), indent=1)
print('[zexport]', len(written), 'parts,', sum(w['tris'] for w in written), 'tris')
