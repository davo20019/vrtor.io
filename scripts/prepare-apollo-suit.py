"""Make the visitors' spacesuit for the Apollo 11 room from the Smithsonian's scan of
Neil Armstrong's A7-L suit, in two pieces: the suit (origin at the middle of the neck ring,
about 20,000 triangles) and the helmet with its gold visor down (origin at the wearer's eyes,
about 6,000 triangles, so it can turn with where they look). Each has its scan textures baked
into one, stands upright with its front toward +Z, in metres.

Run: blender -b --python scripts/prepare-apollo-suit.py
Writes apps/apo/public/models/suit.glb and helmet.glb.

Source: Smithsonian Institution, National Air and Space Museum, "Pressure Suit, A7-L,
Armstrong, Apollo 11, Flown" (A19730040000), 3D scan by the Smithsonian Digitization Program
Office, https://3d.si.edu/object/3d/armstrong-space-suit:d8c63ba6-4ebc-11ea-b77f-2e728ce88125
Used under the Smithsonian's terms for non-commercial, educational use; unlike Columbia, it
is not marked CC0 (see apps/apo/public/models/CREDITS.md).
"""
import math
import subprocess
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'apps/apo/public/models/suit.glb'
HELMET_OUT = REPO / 'apps/apo/public/models/helmet.glb'
CACHE = Path('/tmp/vrtor-apollo-suit')
SRC = 'https://3d-api.si.edu/content/document/3d_package:d8c63ba6-4ebc-11ea-b77f-2e728ce88125/'
PARTS = ['suit-p1-web-medium.glb', 'suit-p2-web-medium.glb', 'suit-p3-web-medium.glb']
# In the scan's imported frame (Blender, millimetres) the suit lies along -Y, helmet at -1845,
# boots near 0; +X is its front. The helmet sits on the neck ring above this height:
NECK_CUT = -1570.0
SUIT_TRIANGLES = 20000
SUIT_TEXTURE = 2048
HELMET_TRIANGLES = 6000
HELMET_TEXTURE = 1024
# The wearer's eyes, above the middle of the neck ring (mm; avatar.js SUIT_NECK is the same in metres).
EYES_ABOVE_RING = 140.0


def fetch():
  CACHE.mkdir(exist_ok=True)
  for name in PARTS:
    path = CACHE / name
    if not path.exists():
      subprocess.run(['curl', '-sfL', '--retry', '3', '-o', str(path), SRC + name], check=True)
  return [CACHE / n for n in PARTS]


def darken_visor(image):
  """The scan has a flat orange surface inside the neck opening (the helmet's visor, seen
  through the ring); paint it the dark of the suit's inside. Reds (connectors, flag) and the
  beige of the fabric are left alone: they're not orange."""
  import numpy as np
  px = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
  r, g, b = px[:, 0], px[:, 1], px[:, 2]
  orange = (r > 0.5) & (g > 0.28) & (g < 0.8 * r) & (b < 0.45 * r)
  px[orange, :3] = (0.09, 0.09, 0.1)
  image.pixels[:] = px.ravel()
  image.update()
  print('VISOR pixels darkened', int(orange.sum()))


def main():
  bpy.ops.wm.read_factory_settings(use_empty=True)
  for path in fetch():
    bpy.ops.import_scene.gltf(filepath=str(path))
  parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
  for o in parts:
    o.select_set(True)
  bpy.context.view_layer.objects.active = parts[0]
  bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.join()
  scan = bpy.context.view_layer.objects.active
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  # Where the helmet meets the suit: the middle of the neck ring, and the eyes above it.
  ring = [v.co.copy() for v in scan.data.vertices if NECK_CUT <= v.co.y < NECK_CUT + 40]
  centre = sum(ring, Vector()) / max(1, len(ring))
  centre.y = NECK_CUT
  eyes = centre + Vector((0, -EYES_ABOVE_RING, 0))

  build(scan, 'suit', lambda y: y >= NECK_CUT, SUIT_TRIANGLES, SUIT_TEXTURE, centre, OUT, darken=True)
  build(scan, 'helmet', lambda y: y < NECK_CUT + 6, HELMET_TRIANGLES, HELMET_TEXTURE, eyes, HELMET_OUT, darken=False)


def build(scan, name, keep, triangles, size, origin, out, darken):
  """One piece of the scan (vertices whose height passes `keep`), cut down, baked and exported."""
  hi = scan.copy()
  hi.data = scan.data.copy()
  bpy.context.collection.objects.link(hi)
  bm = bmesh.new()
  bm.from_mesh(hi.data)
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co.y)], context='VERTS')
  bm.to_mesh(hi.data)
  bm.free()

  # The light copy, with fresh UVs for one baked texture.
  lo = hi.copy()
  lo.data = hi.data.copy()
  bpy.context.collection.objects.link(lo)
  dec = lo.modifiers.new('decimate', 'DECIMATE')
  dec.ratio = min(1.0, triangles / max(1, len(hi.data.polygons)))
  bpy.ops.object.select_all(action='DESELECT')
  bpy.context.view_layer.objects.active = lo
  lo.select_set(True)
  bpy.ops.object.modifier_apply(modifier='decimate')
  while lo.data.uv_layers:
    lo.data.uv_layers.remove(lo.data.uv_layers[0])
  lo.data.uv_layers.new(name='bake')
  bpy.ops.object.mode_set(mode='EDIT')
  bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
  bpy.ops.object.mode_set(mode='OBJECT')

  image = bpy.data.images.new(name, size, size)
  mat = bpy.data.materials.new(name)
  mat.use_nodes = True
  nodes = mat.node_tree.nodes
  tex = nodes.new('ShaderNodeTexImage')
  tex.image = image
  nodes.active = tex
  mat.node_tree.links.new(tex.outputs['Color'], nodes['Principled BSDF'].inputs['Base Color'])
  nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
  lo.data.materials.clear()
  lo.data.materials.append(mat)

  scene = bpy.context.scene
  scene.render.engine = 'CYCLES'
  scene.cycles.samples = 1
  scene.render.bake.use_selected_to_active = True
  scene.render.bake.cage_extrusion = 12.0
  scene.render.bake.max_ray_distance = 40.0
  scene.render.bake.use_pass_direct = False
  scene.render.bake.use_pass_indirect = False
  scene.render.bake.margin = 6
  bpy.ops.object.select_all(action='DESELECT')
  hi.select_set(True)
  lo.select_set(True)
  bpy.context.view_layer.objects.active = lo
  bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
  bpy.data.objects.remove(hi)
  if darken:
    darken_visor(image)

  # Stand it up: scan -Y (up the body) becomes +Z, its front (+X) becomes -Y, which the glTF
  # exporter turns into Y-up, +Z-forward. Millimetres to metres, origin at `origin`.
  stand = Matrix((
    (0, 0, 1, 0),
    (-1, 0, 0, 0),
    (0, -1, 0, 0),
    (0, 0, 0, 1),
  ))
  lo.data.transform(Matrix.Scale(0.001, 4) @ stand @ Matrix.Translation(-origin))
  lo.name = name
  lo.data.name = name

  out.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.object.select_all(action='DESELECT')
  lo.select_set(True)
  bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format='GLB',
    use_selection=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_yup=True,
  )
  print(name.upper(), out, out.stat().st_size, 'bytes,', len(lo.data.polygons), 'faces')
  bpy.data.objects.remove(lo)


if __name__ == '__main__':
  main()
