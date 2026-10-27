"""Bake a CAST survey area into a light mesh for the connected citadel walk, keeping its stones in textures.
Run: blender --factory-startup -b --python scripts/bake-machu-scan.py -- SOURCE.obj NAME UNIT FACES SIZE
  SOURCE.obj  CAST's published OBJ (apps/mpc/public/models/CREDITS.md); UNIT 1 (metres) or .001 (millimetres)
  FACES       triangles to keep; SIZE texture size in pixels
Writes apps/mpc/public/models/<NAME>-walk.glb, and the maps <NAME>-walk-normal.png and -gray.png to
assets-src/machu/.cache/maps for scripts/encode-machu-ktx2.py, which ships them as KTX2.
The full mesh's relief (block joints, arrises) is baked to a tangent-space normal map and its laser grey values to a
greyscale map, on one atlas; the light mesh keeps the shapes. Centred as scripts/prepare-machu.py centres the
closeups (bounds centre, lowest point at 0), so the two share one frame. CC BY-NC 3.0, as the source.
"""
import bpy, sys, math
import numpy as np
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
source, name, unit, faces, size = Path(args[0]), args[1], float(args[2]), int(args[3]), int(args[4])
root = Path(__file__).resolve().parent.parent / 'apps/mpc/public'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(source), forward_axis='Y', up_axis='Z')
hi = bpy.context.selected_objects[0]
hi.name = name + '-full'
verts = hi.data.vertices
co = np.empty(len(verts) * 3, np.float32)
verts.foreach_get('co', co)
co = co.reshape(-1, 3)
lo, up = co.min(0), co.max(0)
centre = np.array([(lo[0] + up[0]) / 2, (lo[1] + up[1]) / 2, lo[2]])
verts.foreach_set('co', ((co - centre) * unit).ravel())
gray = np.fromiter((float(line.split()[4]) / 255 for line in source.open() if line.startswith('v ')), dtype=np.float32)
assert len(gray) == len(verts)
colors = np.ones((len(gray), 4), np.float32)
colors[:, :3] = gray[:, None]
attr = hi.data.color_attributes.new(name='SurveyGray', type='FLOAT_COLOR', domain='POINT')
attr.data.foreach_set('color', colors.ravel())
for p in hi.data.polygons:
    p.use_smooth = True
if name == 'condor-temple':
    hi.data.flip_normals()  # this archive's faces wind inwards (scripts/prepare-machu.py)
hi.data.update()
full = len(hi.data.polygons)

# The light copy: collapse to the face budget, then one atlas.
low = hi.copy()
low.data = hi.data.copy()
low.name = name + '-walk'
bpy.context.collection.objects.link(low)
mod = low.modifiers.new('decimate', 'DECIMATE')
mod.ratio = min(1.0, faces / full)
bpy.context.view_layer.objects.active = low
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.ops.object.modifier_apply(modifier='decimate')
# Drop floaters (vegetation, debris, stray returns): parts of fewer than 200 faces.
import bmesh
bm = bmesh.new()
bm.from_mesh(low.data)
seen, drop = set(), []
for f in bm.faces:
    if f.index in seen:
        continue
    part, stack = [], [f]
    seen.add(f.index)
    while stack:
        g = stack.pop()
        part.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index)
                    stack.append(h)
    if len(part) < 200:
        drop.extend(part)
bmesh.ops.delete(bm, geom=list(set(drop)), context='FACES')
bm.to_mesh(low.data)
bm.free()
print('floaters dropped', len(drop), flush=True)
# Trim the ground the scanners caught round the building: its level rarely matches the model's there, and it
# would hang over the model's own ground. Flat faces more than 0.5 m outside the walls' outline (their convex
# hull in plan) go; rooms and courts within it keep their floors.
fc = np.empty(len(low.data.polygons) * 3, np.float32)
fnm = np.empty(len(low.data.polygons) * 3, np.float32)
low.data.polygons.foreach_get('center', fc)
low.data.polygons.foreach_get('normal', fnm)
fc, fnm = fc.reshape(-1, 3), fnm.reshape(-1, 3)
wall = np.abs(fnm[:, 2]) < .4
pts = sorted(set(map(tuple, np.round(fc[wall, :2], 2))))
def half(points):
    out = []
    for p in points:
        while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
            out.pop()
        out.append(p)
    return out
hull = np.array(half(pts)[:-1] + half(pts[::-1])[:-1])  # counter-clockwise
edge = np.roll(hull, -1, 0) - hull
normal = np.c_[edge[:, 1], -edge[:, 0]] / np.linalg.norm(edge, axis=1, keepdims=True)  # outward
outside = ((fc[:, None, :2] - hull[None]) * normal[None]).sum(2).max(1)
apron = np.where(~wall & (outside > .5))[0]
bm = bmesh.new()
bm.from_mesh(low.data)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in apron], context='FACES')
bm.to_mesh(low.data)
bm.free()
print('ground trimmed', len(apron), flush=True)
# Unwrap for a scan: smart projection splits noisy faces into thousands of specks, so each face is labelled by
# the axis its smoothed surface faces, small patches join their neighbours, and each region is projected flat at
# real scale (even texel density), then packed.
smooth = low.copy()
smooth.data = low.data.copy()
bpy.context.collection.objects.link(smooth)
sm = smooth.modifiers.new('smooth', 'SMOOTH')
sm.factor, sm.iterations = .8, 40
bpy.context.view_layer.objects.active = smooth
bpy.ops.object.select_all(action='DESELECT')
smooth.select_set(True)
bpy.ops.object.modifier_apply(modifier='smooth')
fn = np.empty(len(smooth.data.polygons) * 3, np.float32)
smooth.data.polygons.foreach_get('normal', fn)
fn = fn.reshape(-1, 3)
bpy.data.objects.remove(smooth)
axis = np.argmax(np.abs(fn), 1) * 2 + (np.take_along_axis(fn, np.argmax(np.abs(fn), 1)[:, None], 1)[:, 0] < 0)
bm = bmesh.new()
bm.from_mesh(low.data)
bm.faces.ensure_lookup_table()
label = axis.copy()
for _ in range(6):
    seen = np.zeros(len(label), bool)
    changed = 0
    for f in bm.faces:
        if seen[f.index]:
            continue
        part, stack, border = [], [f], {}
        seen[f.index] = True
        while stack:
            g = stack.pop()
            part.append(g.index)
            for e in g.edges:
                for h in e.link_faces:
                    if label[h.index] == label[f.index]:
                        if not seen[h.index]:
                            seen[h.index] = True
                            stack.append(h)
                    else:
                        border[label[h.index]] = border.get(label[h.index], 0) + 1
        if len(part) < 60 and border:
            label[part] = max(border, key=border.get)
            changed += 1
    if not changed:
        break
uv = bm.loops.layers.uv.verify()
plane = {0: (1, 2), 1: (1, 2), 2: (0, 2), 3: (0, 2), 4: (0, 1), 5: (0, 1)}
for f in bm.faces:
    a, b = plane[int(label[f.index])]
    flip = -1 if label[f.index] % 2 else 1
    for l in f.loops:
        l[uv].uv = (l.vert.co[a] * flip, l.vert.co[b])
bm.to_mesh(low.data)
bm.free()
# Split the UVs where labels change, so each region is its own island.
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.seams_from_islands()
bpy.ops.uv.pack_islands(margin=.002, rotate=True, scale=True)
bpy.ops.object.mode_set(mode='OBJECT')
print('islands from', len(set(label.tolist())), 'directions', flush=True)
for legacy in list(low.data.color_attributes):
    low.data.color_attributes.remove(legacy)

# Bake from the full mesh: tangent-space normals, and the grey values through an emission shader.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
bake = scene.render.bake
bake.use_selected_to_active = True
bake.use_cage = False
bake.cage_extrusion = .04
bake.max_ray_distance = .3
bake.margin = 4
images = {}
for kind in ('normal', 'gray'):
    # Texels no ray reaches keep a neutral value (flat normal, the scan's mean grey), not black.
    img = bpy.data.images.new(f'{name}-walk-{kind}', size, size, alpha=False, float_buffer=False)
    fill = (.5, .5, 1, 1) if kind == 'normal' else (float(np.mean(gray)) ** 2.2,) * 3 + (1,)
    img.pixels.foreach_set(np.tile(np.array(fill, np.float32), size * size))
    img.colorspace_settings.name = 'Non-Color' if kind == 'normal' else 'sRGB'
    images[kind] = img
src_mat = bpy.data.materials.new('full')
src_mat.use_nodes = True
nt = src_mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
emit = nt.nodes.new('ShaderNodeEmission')
vc = nt.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'SurveyGray'
nt.links.new(vc.outputs['Color'], emit.inputs['Color'])
nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
hi.data.materials.clear()
hi.data.materials.append(src_mat)
low_mat = bpy.data.materials.new('survey-granite')
low_mat.use_nodes = True
tex = low_mat.node_tree.nodes.new('ShaderNodeTexImage')
low.data.materials.clear()
low.data.materials.append(low_mat)
for kind, bake_type in (('normal', 'NORMAL'), ('gray', 'EMIT')):
    tex.image = images[kind]
    low_mat.node_tree.nodes.active = tex
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type=bake_type, normal_space='TANGENT', use_selected_to_active=True, cage_extrusion=.06, max_ray_distance=.3, margin=8)
    maps = root.parents[2] / 'assets-src/machu/.cache/maps'
    maps.mkdir(parents=True, exist_ok=True)
    path = maps / f'{name}-walk-{kind}.png'
    images[kind].filepath_raw = str(path)
    images[kind].file_format = 'PNG'
    images[kind].save()
    print('BAKED', kind, path, flush=True)

# Export the light mesh alone: positions, normals, the atlas UVs and tangents for the normal map.
low_mat.node_tree.nodes.remove(tex)
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low
glb = root / 'models' / f'{name}-walk.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, export_tangents=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=16, export_draco_normal_quantization=12,
                          export_draco_texcoord_quantization=14, export_materials='PLACEHOLDER')
print('SCAN', name, 'full', full, 'walk', len(low.data.polygons), 'bytes', glb.stat().st_size, flush=True)
