"""Make the skeletons for /orca from the University of Pisa Natural History Museum's 3D scans.

Two scans from Wikimedia Commons, both CC BY-SA 4.0: the museum's adult male killer whale
(Orcinus orca, C 301) and a common bottlenose dolphin (Tursiops truncatus, C 281). Each is one
binary STL of a couple of million triangles with no color. This turns each into a light, colored
skeleton for the browser:

- turns it so the snout points along glTF +Z (Blender -Y), the backbone level and the dorsal side
  up, the lowest bone at y = 0 and the middle of its length at z = 0;
- scales it to metres. The dolphin scan is in millimetres. The orca scan has no stated unit:
  it is scaled so its skull (about 1.0 m long and 0.6 m wide in adult males) comes out that
  size, which makes the skeleton about 6.3 m long;
- reduces it to a triangle budget a Quest browser can draw (DECIMATE below);
- colors the bone an aged ivory, darkened in crevices by baked ambient occlusion (vertex colors);
- writes one Draco-compressed glb per animal to apps/orca/public/models/, plus orca-shape.json,
  slices of the orca skeleton's outline that src/body.js wraps the whole animal around.

Run: blender -b --python scripts/prepare-orca.py

Sources: https://commons.wikimedia.org/wiki/File:Orcinus_orca_3d_scan_Natural_History_Museum_University_of_Pisa_C_301.stl
https://commons.wikimedia.org/wiki/File:Tursiops_truncatus_3d_scan_Natural_History_Museum_University_of_Pisa_C_281.stl
"""
import json
import math
import subprocess
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'apps/orca/public/models'
CACHE = Path('/tmp/vrtor-orca')
COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
ANIMALS = {
  'orca': {
    'file': 'Orcinus_orca_3d_scan_Natural_History_Museum_University_of_Pisa_C_301.stl',
    'cache': 'orca.stl',
    # Scan units to metres, from the skull (see the docstring).
    'scale': 0.6,
    'triangles': 220_000,
  },
  'dolphin': {
    'file': 'Tursiops_truncatus_3d_scan_Natural_History_Museum_University_of_Pisa_C_281.stl',
    'cache': 'Tursiops_truncatus.stl',
    'scale': 0.001,
    'triangles': 60_000,
  },
}
# sRGB: old, slightly yellowed bone, as mounted skeletons are.
BONE = '#d9ccb0'
SLICES = 64


def fetch(animal):
  CACHE.mkdir(exist_ok=True)
  path = CACHE / animal['cache']
  if not path.exists():
    subprocess.run(['curl', '-sfL', '--retry', '3', '-A', 'vrtor-prepare/1.0', '-o', str(path), COMMONS + animal['file']], check=True)
  return path


def points(obj):
  co = np.empty(len(obj.data.vertices) * 3)
  obj.data.vertices.foreach_get('co', co)
  return co.reshape(-1, 3)


def orient(obj, scale):
  """Snout to Blender -Y (glTF +Z), dorsal side to +Z, lowest bone at z = 0, centred."""
  v = points(obj)
  c = v.mean(0)
  # The long axis, level: the backbone runs across the scan's XY plane.
  _, _, vt = np.linalg.svd((v - c)[:: max(1, len(v) // 200_000)], full_matrices=False)
  ax = vt[0].copy()
  ax[2] = 0
  ax /= np.linalg.norm(ax)
  t = (v - c) @ ax
  # The skull is the end with the most bone in it.
  span = np.ptp(t)
  head = (t > t.max() - 0.12 * span).sum()
  tail = (t < t.min() + 0.12 * span).sum()
  if tail > head:
    ax = -ax
  # Rotate about Z so `ax` becomes -Y.
  angle = math.atan2(-ax[0], -ax[1])
  obj.data.transform(Matrix.Translation(Vector(-c)))
  obj.data.transform(Matrix.Rotation(angle, 4, 'Z'))
  obj.data.transform(Matrix.Scale(scale, 4))
  v = points(obj)
  # Dorsal side up: the ribs hang below the backbone, so most bone sits under the top's midline.
  lo, hi = v.min(0), v.max(0)
  if np.median(v[:, 2]) > (lo[2] + hi[2]) / 2 + 0.25 * (hi[2] - lo[2]):
    obj.data.transform(Matrix.Rotation(math.pi, 4, 'Y'))
    v = points(obj)
    lo, hi = v.min(0), v.max(0)
  obj.data.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
  v = points(obj)
  print('SIZE', obj.name, np.round(np.ptp(v, 0), 3))


def decimate(obj, triangles):
  ratio = min(1, triangles / len(obj.data.polygons))
  mod = obj.modifiers.new('decimate', 'DECIMATE')
  mod.ratio = ratio
  mod.use_collapse_triangulate = True
  bpy.context.view_layer.objects.active = obj
  bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.ops.object.shade_smooth()
  print('TRIANGLES', obj.name, len(obj.data.polygons))


def bake_bone(obj):
  """Vertex colors: the bone color times baked ambient occlusion."""
  scene = bpy.context.scene
  scene.render.engine = 'CYCLES'
  scene.cycles.device = 'CPU'
  scene.cycles.samples = 48
  mesh = obj.data
  attr = mesh.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
  mesh.color_attributes.active_color = attr
  mat = bpy.data.materials.new('bone')
  obj.data.materials.clear()
  obj.data.materials.append(mat)
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  scene.world = scene.world or bpy.data.worlds.new('world')
  bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
  bone = Vector([srgb_to_linear(int(BONE[i:i + 2], 16) / 255) for i in (1, 3, 5)])
  col = np.empty(len(mesh.vertices) * 4, dtype=np.float32)
  attr.data.foreach_get('color', col)
  col = col.reshape(-1, 4)
  # Keep the deepest crevices from going black: occlusion only takes away 70% of the light.
  ao = 0.3 + 0.7 * col[:, 0]
  out = np.empty_like(col)
  for k in range(3):
    out[:, k] = bone[k] * ao
  out[:, 3] = 1
  attr.data.foreach_set('color', out.ravel())
  # A plain material: the app lights the bone itself.
  mat.use_nodes = True
  nodes = mat.node_tree.nodes
  bsdf = nodes.get('Principled BSDF')
  vc = nodes.new('ShaderNodeVertexColor')
  vc.layer_name = 'Col'
  mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
  bsdf.inputs['Roughness'].default_value = 0.75


def srgb_to_linear(c):
  return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def outline(obj):
  """The skeleton's outline in SLICES slices along its length, in glTF axes (metres)."""
  v = points(obj)
  # Blender (x, y, z) is glTF (x, z, -y).
  x, y, z = v[:, 0], v[:, 2], -v[:, 1]
  edges = np.linspace(z.min(), z.max(), SLICES + 1)
  slices = []
  for i in range(SLICES):
    m = (z >= edges[i]) & (z <= edges[i + 1])
    if not m.any():
      continue
    slices.append({
      'z': round(float((edges[i] + edges[i + 1]) / 2), 4),
      'top': round(float(y[m].max()), 4),
      'bottom': round(float(y[m].min()), 4),
      'left': round(float(x[m].min()), 4),
      'right': round(float(x[m].max()), 4),
    })
  return {'length': round(float(z.max() - z.min()), 4), 'height': round(float(y.max()), 4), 'slices': slices}


def export(obj, name):
  OUT.mkdir(parents=True, exist_ok=True)
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  path = OUT / f'{name}.glb'
  bpy.ops.export_scene.gltf(
    filepath=str(path),
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_normals=True,
    export_vertex_color='ACTIVE',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_color_quantization=8,
  )
  print('WROTE', path, path.stat().st_size)


def main():
  for name, animal in ANIMALS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(fetch(animal)))
    obj = bpy.context.selected_objects[0]
    obj.name = obj.data.name = name
    # The scans come as loose triangles: weld them so decimation keeps the bones whole.
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode='OBJECT')
    orient(obj, animal['scale'])
    decimate(obj, animal['triangles'])
    bake_bone(obj)
    if name == 'orca':
      shape = outline(obj)
      (OUT / 'orca-shape.json').write_text(json.dumps(shape, separators=(',', ':')))
      print('SHAPE', shape['length'], shape['height'])
    export(obj, name)


if __name__ == '__main__':
  main()
