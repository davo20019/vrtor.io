"""Make the Wright Flyer for /fly from the Smithsonian's 3D scan of the 1903 Wright Flyer.

The scan's web parts (wings, "filler" and engine; about 166k triangles) carry normal and
occlusion maps but no color, so this colors every piece of it by what it is made of, from the
Smithsonian's record and curators' articles: unbleached muslin, spruce and ash, steel wire,
cast aluminum and steel. The two propellers become their own meshes, with their origin at the
hub, so they can turn. Writes one Draco-compressed apps/fly/public/models/flyer.glb in metres,
in the scan's own frame (the frame of the curators' annotations, in cm there).

Run: blender -b --python scripts/prepare-flyer.py

Source: Smithsonian Institution, National Air and Space Museum, "1903 Wright Flyer"
(A19610048000), CC0, https://3d.si.edu/object/3d/1903-wright-flyer:d8c62e5e-4ebc-11ea-b77f-2e728ce88125
"""
import subprocess
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'apps/fly/public/models/flyer.glb'
CACHE = Path('/tmp/vrtor-flyer')
CDN = 'https://cdn.3d-api.si.edu/d8c62e5e-4ebc-11ea-b77f-2e728ce88125/'
PARTS = {
  'wings': 'wright_flyer_wings_mesh-49k-4096-high.glb',
  'frame': 'wright_flyer_filler_mesh-48k-4096-high.glb',
  'engine': 'wright_flyer_engine_mesh-53k-4096-high.glb',
}
TEXTURE = 2048
# sRGB. Muslin: "fine-weave unbleached", no varnish. Spruce and ash, unpainted.
COLORS = {
  'fabric': '#d9cfb8',
  'wood': '#c8a679',
  'wire': '#56565a',
  'steel': '#34363a',
  'aluminum': '#a3a39e',
}
# Two curator annotations (scan frame, cm) that must land on the mesh: a check on the frame.
CHECKS = {'Hip Cradle': (60.57, -29.32, -11.12), 'Fuel Tank': (119.92, 109.65, 22.49)}


def fetch():
  CACHE.mkdir(exist_ok=True)
  for name in PARTS.values():
    path = CACHE / name
    if not path.exists():
      subprocess.run(['curl', '-sfL', '--retry', '3', '-o', str(path), CDN + name], check=True)


def pieces(obj):
  """Faces of `obj` grouped into its physical pieces (the scan's triangles come unwelded)."""
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  fid = bm.faces.layers.int.new('fid')
  for f in bm.faces:
    f[fid] = f.index
  bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.005)
  bm.faces.ensure_lookup_table()
  seen, out = set(), []
  for f0 in bm.faces:
    if f0.index in seen:
      continue
    stack, faces = [f0], []
    seen.add(f0.index)
    while stack:
      f = stack.pop()
      faces.append(f)
      for v in f.verts:
        for g in v.link_faces:
          if g.index not in seen:
            seen.add(g.index)
            stack.append(g)
    co = [v.co for f in faces for v in f.verts]
    dims = sorted(max(c[i] for c in co) - min(c[i] for c in co) for i in range(3))
    area = sum(f.calc_area() for f in faces)
    length = sum(e.calc_length() for e in {e for f in faces for e in f.edges})
    # Surface per length of edge: about 0.02-0.07 for wire, 0.5 for struts, over 1 for fabric.
    # Surface per area of its two longest sides: about 2 for a fabric panel (both faces), well
    # under 1 for a strut, even one lying diagonally across its box.
    cover = area / max(dims[1] * dims[2], 1e-6)
    out.append({'faces': [f[fid] for f in faces], 'dims': dims, 'thick': area / length, 'cover': cover})
  bm.free()
  return out


def material_of(part, p):
  d, thick = p['dims'], p['thick']
  if part == 'engine':
    return 'aluminum' if d[2] >= 20 else 'steel'
  if thick < 0.1:
    return 'wire'
  if part == 'wings':
    return 'fabric' if d[1] >= 45 and p['cover'] > 0.5 else 'wood'
  return 'steel' if d[2] < 50 else 'wood'


def is_propeller(part, p):
  # The propellers are 8 ft 6 in (2.59 m) across.
  return part == 'frame' and 240 < p['dims'][2] < 275 and p['thick'] > 0.4


def srgb(hex_):
  return [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1.0]


def paint(obj, face_colors):
  attr = obj.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
  for poly in obj.data.polygons:
    c = face_colors[poly.index]
    for li in poly.loop_indices:
      attr.data[li].color_srgb = c
  obj.data.color_attributes.active_color = attr


def setup_material(obj, part):
  mat = obj.material_slots[0].material
  nodes, links = mat.node_tree.nodes, mat.node_tree.links
  bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
  vc = nodes.new('ShaderNodeVertexColor')
  vc.layer_name = 'Col'
  links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
  bsdf.inputs['Metallic'].default_value = 0.35 if part == 'engine' else 0.0
  bsdf.inputs['Roughness'].default_value = 0.5 if part == 'engine' else 0.88
  mat.name = f'flyer-{part}'
  for n in nodes:
    if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > TEXTURE:
      n.image.scale(TEXTURE, TEXTURE)


def main():
  fetch()
  bpy.ops.wm.read_factory_settings(use_empty=True)
  objs = {}
  for part, name in PARTS.items():
    bpy.ops.import_scene.gltf(filepath=str(CACHE / name))
    obj = next(o for o in bpy.context.selected_objects if o.type == 'MESH')
    obj.name = part
    objs[part] = obj
  # Bake the import's inch-to-cm scale into the meshes: the frame is then the annotations' (cm).
  bpy.ops.object.select_all(action='SELECT')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  for o in list(bpy.data.objects):
    if o.type != 'MESH':
      bpy.data.objects.remove(o)

  # The annotations in glTF axes (x, y, z) are Blender's (x, -z, y).
  kd_all = []
  for obj in objs.values():
    for v in obj.data.vertices:
      kd_all.append(v.co.copy())
  kd = KDTree(len(kd_all))
  for i, c in enumerate(kd_all):
    kd.insert(c, i)
  kd.balance()
  for name, (x, y, z) in CHECKS.items():
    _, _, dist = kd.find(Vector((x, -z, y)))
    print(f'CHECK {name}: {dist:.1f} cm from the mesh')
    assert dist < 15, f'{name} is off the mesh: wrong frame?'

  counts = {}
  props = []
  for part, obj in objs.items():
    # Welding drops a few degenerate triangles; they keep the part's main color.
    main = {'wings': 'fabric', 'frame': 'wood', 'engine': 'aluminum'}[part]
    colors = [srgb(COLORS[main])] * len(obj.data.polygons)
    for p in pieces(obj):
      kind = 'wood' if is_propeller(part, p) else material_of(part, p)
      counts[kind] = counts.get(kind, 0) + len(p['faces'])
      for i in p['faces']:
        colors[i] = srgb(COLORS[kind])
      if is_propeller(part, p):
        props.append(p['faces'])
    paint(obj, colors)
    setup_material(obj, part)
  print('FACES BY MATERIAL', counts)
  assert len(props) == 2, f'expected two propellers, found {len(props)}'

  # Each propeller becomes its own object, its origin at its hub (the middle of its bounds).
  frame = objs['frame']
  bpy.ops.object.select_all(action='DESELECT')
  bpy.context.view_layer.objects.active = frame
  frame.select_set(True)
  for faces in props:
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    want = set(faces)
    for poly in frame.data.polygons:
      poly.select = poly.index in want
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    # Separating renumbers the remaining faces: find the next propeller again.
    if faces is props[0]:
      rest = [p['faces'] for p in pieces(frame) if is_propeller('frame', p)]
      props[1] = rest[0]
  for o in bpy.data.objects:
    if o.name.startswith('frame.'):
      bpy.ops.object.select_all(action='DESELECT')
      o.select_set(True)
      bpy.context.view_layer.objects.active = o
      bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
      # glTF x is Blender x: name by side, as seen from behind the Flyer looking forward (+z).
      o.name = 'propeller-left' if o.location.x > 0 else 'propeller-right'
      print('PROPELLER', o.name, 'hub (glTF m)', [round(v, 3) for v in (o.location.x / 100, o.location.z / 100, -o.location.y / 100)])

  # Metres.
  bpy.ops.object.select_all(action='SELECT')
  for o in bpy.data.objects:
    o.location *= 0.01
    o.scale *= 0.01
  bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
  lowest = min((o.matrix_world @ v.co).z for o in bpy.data.objects for v in o.data.vertices)
  tris = sum(len(p.vertices) - 2 for o in bpy.data.objects for p in o.data.polygons)
  print(f'LOWEST POINT (glTF y, m): {lowest:.4f}   TRIANGLES: {tris}')

  OUT.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.export_scene.gltf(
    filepath=str(OUT),
    export_format='GLB',
    export_yup=True,
    export_vertex_color='ACTIVE',
    export_image_format='JPEG',
    export_jpeg_quality=88,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_draco_color_quantization=8,
  )
  print('WROTE', OUT, OUT.stat().st_size)


if __name__ == '__main__':
  main()
