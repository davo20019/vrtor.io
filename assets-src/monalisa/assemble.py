"""Headless Blender: the Mona Lisa as it is made, to out/monalisa.glb and out/monalisa.json.

    blender -b --factory-startup --python assemble.py

In:  params.json (sizes, spec.md gives each one's source), work/*.png (textures.py).
Out: out/monalisa.glb, y-up, front +z, metres, origin at the middle of the panel's front edges. Nodes:
     painting > panel (front, back, edges, key, socket, crack_lining), chassis (frame, crossbar_1..4), frame.
     The painted face carries a 512 px stand-in; the app swaps in the KTX2 scan (2k, then 4k).

Built in Blender's frame (front -Y, up +Z); the exporter turns it to glTF's y-up with the front on +z.
"""
import json
import math
import os

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, 'params.json')))
WORK = os.path.join(HERE, 'work')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
MM = 0.001
W, H, T = P['panel_w'] * MM, P['panel_h'] * MM, P['panel_t'] * MM

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- materials

def image(name, linear=False):
    img = bpy.data.images.load(os.path.join(WORK, name))
    if linear:
        img.colorspace_settings.name = 'Non-Color'
    return img


def material(name, color=None, normal=None, orm=None, roughness=0.6, metallic=0.0, base=None, normal_strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if base:
        bsdf.inputs['Base Color'].default_value = (*base, 1)
    if color:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(color)
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(normal, True)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if orm:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(orm, True)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    return m


MAT = {
    'painting': material('painting', 'front_512_color.png', roughness=P['varnish_roughness']),
    'poplar': material('poplar', 'back_color.png', 'back_normal.png', roughness=0.85),
    'endgrain': material('endgrain', 'edge_color.png', roughness=0.9),
    'walnut': material('walnut', 'walnut_color.png', roughness=0.7),
    'canvas': material('canvas', 'canvas_color.png', roughness=0.95),
    'oak': material('oak', 'oak_color.png', 'oak_normal.png', roughness=0.75),
    'metal': material('steel', base=(0.55, 0.55, 0.56), roughness=0.45, metallic=1.0),
    'gilt': material('gilt', 'gilt_color.png', 'gilt_normal.png', 'gilt_orm.png'),
    'giltplain': material('gilt_plain', 'giltplain_color.png', roughness=0.46, metallic=1.0),
    'giltback': material('frame_back', base=(0.16, 0.11, 0.07), roughness=0.9),
}


def obj(name, bm, mats, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(MAT[m])
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    for p in me.polygons:
        p.use_smooth = smooth
    return o


def empty(name, parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    return o


# ---------------------------------------------------------------- the warp

def warp_raw(u, v):
    a, b, bias = P['warp_across'], P['warp_along'], P['warp_left_bias']
    return a * (1 - u * u) * (1 - bias * u) + b * (1 - v * v)


_peak = max(warp_raw(i / 50 - 1, j / 50 - 1) for i in range(101) for j in range(101))
# The edges' most forward point (the middle of the top and bottom edges, the plank cupping across its grain).
_rim = max(max(warp_raw(i / 50 - 1, s) for i in range(101) for s in (-1, 1)),
           max(warp_raw(s, j / 50 - 1) for j in range(101) for s in (-1, 1))) / _peak * P['warp_max']
RIM = _rim * MM


def warp(x, z):
    """How far forward (m) the panel's front stands at (x, z) of the plane its edges rest against (the châssis
    lip, y = 0): doubly curved toward the front, 11 mm at most above its corners, most on the left (Mona Lisa
    Project). The edges' most forward point touches the lip and the corners stand back from it, as a cupped
    panel sits in a straight rebate. Measured from the corners instead, the edges came through the frame."""
    return (warp_raw(2 * x / W, 2 * z / H) / _peak * P['warp_max']) * MM - RIM


# ---------------------------------------------------------------- the panel

NX, NY = 48, 72


def panel(parent):
    """Front, back and edges as one solid, separate materials. Front faces -Y (toward the viewer)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = {}
    for side in ('front', 'back'):
        for i in range(NX + 1):
            for j in range(NY + 1):
                x = -W / 2 + W * i / NX
                z = -H / 2 + H * j / NY
                y = -warp(x, z) + (T if side == 'back' else 0.0)
                grid[side, i, j] = bm.verts.new((x, y, z))

    def quad(vs, mat, uvs):
        f = bm.faces.new(vs)
        f.material_index = mat
        for loop, t in zip(f.loops, uvs):
            loop[uv].uv = t
        return f

    for i in range(NX):
        for j in range(NY):
            u0, u1, v0, v1 = i / NX, (i + 1) / NX, j / NY, (j + 1) / NY
            # front: seen from -Y, counter-clockwise from the viewer
            quad([grid['front', i, j], grid['front', i + 1, j], grid['front', i + 1, j + 1], grid['front', i, j + 1]],
                 0, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
            # back: seen from +Y; its texture mirrored so the grain reads from behind
            quad([grid['back', i, j], grid['back', i, j + 1], grid['back', i + 1, j + 1], grid['back', i + 1, j]],
                 1, [(1 - u0, v0), (1 - u0, v1), (1 - u1, v1), (1 - u1, v0)])
    # edges: around the rim, end grain top and bottom, side grain left and right
    rim = [(i, 0) for i in range(NX)] + [(NX, j) for j in range(NY)] + [(i, NY) for i in range(NX, 0, -1)] + [(0, j) for j in range(NY, 0, -1)]
    s = 0.0
    for k, (i, j) in enumerate(rim):
        i2, j2 = rim[(k + 1) % len(rim)]
        a, b = grid['front', i, j], grid['front', i2, j2]
        d = (b.co - a.co).length
        quad([a, grid['back', i, j], grid['back', i2, j2], b], 2, [(s, 0), (s, T / 0.06), (s + d / 0.06, T / 0.06), (s + d / 0.06, 0)])
        s += d / 0.06
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj('panel_wood', bm, ['painting', 'poplar', 'endgrain'], parent)


def back_y(x, z, lift=0.0003):
    return -warp(x, z) + T + lift


def patch(name, outline, mat, parent, lift=0.0003, scale_uv=0.08):
    """A flat piece lying on the back (a key, a lining): outline in (x, z) m, following the warp."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((x, back_y(x, z, lift), z)) for x, z in outline]
    f = bm.faces.new(vs[::-1])
    for loop in f.loops:
        loop[uv].uv = (loop.vert.co.x / scale_uv, loop.vert.co.z / scale_uv)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return obj(name, bm, [mat], parent)


def butterfly(cx, cz):
    """A butterfly key across the crack, its long axis horizontal: wide ends, narrow waist."""
    L, wst, e = P['key_len'] * MM / 2, P['key_waist'] * MM / 2, P['key_end'] * MM / 2
    return [(cx - L, cz - e), (cx, cz - wst), (cx + L, cz - e), (cx + L, cz + e), (cx, cz + wst), (cx - L, cz + e)]


def crack_x(dz):
    """The crack's x (m, front's frame) dz below the top edge (scan: 215 mm from the left at the top, 220 at its end)."""
    f = min(1.0, dz / (P['crack_len'] * MM))
    return (P['crack_x_top'] + f * (P['crack_x_bottom'] - P['crack_x_top'])) * MM - W / 2


def keys(parent):
    top = H / 2
    zu = top - P['key_upper_y'] * MM
    zl = top - P['key_lower_y'] * MM
    # The upper key fell out (1888 to 1905, or in the 1911 theft): its socket lined with canvas, sunk to a third
    # of the panel's thickness. Drawn as the lining at the socket's floor with its walls.
    depth = P['panel_t'] * P['key_depth_frac'] * MM
    out = butterfly(crack_x(P['key_upper_y'] * MM), zu)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rim = [bm.verts.new((x, back_y(x, z, 0.00005), z)) for x, z in out]
    floor = [bm.verts.new((x, back_y(x, z, 0) - depth, z)) for x, z in out]
    f = bm.faces.new(floor[::-1])
    for loop in f.loops:
        loop[uv].uv = (loop.vert.co.x / 0.04, loop.vert.co.z / 0.04)
    n = len(out)
    for k in range(n):
        a, b = k, (k + 1) % n
        f = bm.faces.new([rim[a], rim[b], floor[b], floor[a]])
        for loop, t in zip(f.loops, [(k, 1), (k + 1, 1), (k + 1, 0), (k, 0)]):
            loop[uv].uv = (t[0] * 0.5, t[1] * 0.1)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    socket = obj('socket', bm, ['canvas'], parent)
    # Layers on the back stand 0.5 mm apart at least: closer, a headset can't tell which is in front and they
    # flicker. The key is let in flush (drawn 0.5 mm proud); the canvas lies over the crack and the key (1 mm).
    key = patch('key', butterfly(crack_x(P['key_lower_y'] * MM), zl), 'walnut', parent, lift=0.0005, scale_uv=P['key_len'] * MM)
    # Canvas glued along the crack, from the top edge down past its end.
    strip = []
    zs = [top - k * 0.01 for k in range(int(P['crack_len'] / 10) + 3)]
    for z in zs:
        strip.append((crack_x(top - z) - 0.009, z))
    for z in zs[::-1]:
        strip.append((crack_x(top - z) + 0.009, z))
    lining = patch('crack_lining', strip, 'canvas', parent, lift=0.001, scale_uv=0.04)
    return socket, key, lining


# ---------------------------------------------------------------- the châssis-cadre

def box(name, x0, x1, y0, y1, z0, z1, mat, parent, uv_scale=0.2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        nx, ny, nz = (abs(c) for c in f.normal)
        for loop in f.loops:
            c = loop.vert.co
            # grain along the longest side
            long_is_z = (z1 - z0) >= (x1 - x0)
            if nz > 0.5:
                loop[uv].uv = (c.x / uv_scale, c.y / uv_scale)
            elif long_is_z:
                loop[uv].uv = ((c.x if ny > 0.5 else c.y) / uv_scale * 4, c.z / uv_scale)
            else:
                loop[uv].uv = ((c.y if nx > 0.5 else c.z) / uv_scale * 4, c.x / uv_scale)
    return obj(name, bm, [mat], parent, smooth=False)


def chassis(parent):
    """The oak frame (1951) the panel sits in, pressed against its front lip by four crossbars. Member sizes
    are guesses (spec.md, Unknowns)."""
    cw, cd, rb = P['chassis_w'] * MM, P['chassis_d'] * MM, P['chassis_rebate'] * MM
    lip = 0.006
    gap = 0.001
    ox, oz = W / 2 + cw - rb, H / 2 + cw - rb     # outer half sizes
    ix, iz = W / 2 - rb, H / 2 - rb               # lip opening
    y0, y1 = -lip, cd - lip
    parts = []
    # Lip (in front of the panel's edges) and the deeper rails behind it, beside the panel.
    parts.append(box('chassis_top', -ox, ox, y0, 0, iz, oz, 'oak', parent))
    parts.append(box('chassis_bottom', -ox, ox, y0, 0, -oz, -iz, 'oak', parent))
    parts.append(box('chassis_left', -ox, -ix, y0, 0, -iz, iz, 'oak', parent))
    parts.append(box('chassis_right', ix, ox, y0, 0, -iz, iz, 'oak', parent))
    rx, rz = W / 2 + gap, H / 2 + gap
    parts.append(box('chassis_top_rail', -ox, ox, 0, y1, rz, oz, 'oak', parent))
    parts.append(box('chassis_bottom_rail', -ox, ox, 0, y1, -oz, -rz, 'oak', parent))
    parts.append(box('chassis_left_rail', -ox, -rx, 0, y1, -rz, rz, 'oak', parent))
    parts.append(box('chassis_right_rail', rx, ox, 0, y1, -rz, rz, 'oak', parent))
    for p in parts:
        p.parent = parent
    bars = []
    n = P['crossbars']
    bw, bt = P['crossbar_w'] * MM, P['crossbar_t'] * MM
    # Straight bars resting on the back at the panel's corners, where the back is furthest back.
    yb = T + RIM
    for k in range(n):
        z = -H / 2 + H * (k + 0.5) / n
        b = box(f'crossbar_{k + 1}', -ox + 0.01, ox - 0.01, yb, yb + bt, z - bw / 2, z + bw / 2, 'oak', parent)
        bars.append(b)
    return parts, bars


# ---------------------------------------------------------------- the frame

def frame(parent):
    """The gilt frame (given 1909), its outside 1010 x 770 mm (Louvre, 'with accessory'). The profile and
    ornament are not measured (spec.md): a sight-edge bead, a cove, a carved frieze and an outer torus."""
    lip = P['frame_lip'] * MM
    sx, sz = W / 2 - lip, H / 2 - lip               # sight opening
    reach = (P['frame_outer_w'] * MM / 2) - sx      # sight edge to outside, across
    reach_z = (P['frame_outer_h'] * MM / 2) - sz
    depth = P['frame_depth'] * MM
    front_z = 0.05                                  # its highest point stands this far in front of the panel
    back_y = depth - front_z
    # (r, height in front of the panel's plane), r from the sight edge outward as a fraction of the reach;
    # 'frieze' marks the carved band.
    prof = [
        (0.00, 0.004, 'p'), (0.00, 0.018, 'p'), (0.03, 0.026, 'p'), (0.06, 0.024, 'p'), (0.08, 0.020, 'p'),
        (0.16, 0.030, 'p'), (0.24, 0.036, 'f'), (0.62, 0.036, 'f'), (0.66, 0.040, 'p'), (0.74, 0.050, 'p'),
        (0.84, 0.052, 'p'), (0.93, 0.044, 'p'), (1.00, 0.020, 'p'), (1.00, -back_y, 'b'),
        (0.40, -back_y, 'b'), (0.40, -0.006, 'b'), (0.00, -0.006, 'b'),
    ]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    rings = []
    for r, hgt, _ in prof:
        ring = []
        for cx, cz in corners:
            x = cx * (sx + r * reach); z = cz * (sz + r * reach_z)
            ring.append(bm.verts.new((x, -hgt, z)))
        rings.append(ring)
    mats = {'p': 0, 'f': 1, 'b': 2}
    bay = 0.06
    for k in range(len(prof)):
        k2 = (k + 1) % len(prof)
        kind = prof[k][2] if prof[k][2] == prof[k2][2] or prof[k2][2] == 'b' else prof[k2][2]
        if prof[k][2] == 'f' and prof[k2][2] == 'f':
            kind = 'f'
        elif 'f' in (prof[k][2], prof[k2][2]):
            kind = 'p'
        for c in range(4):
            c2 = (c + 1) % 4
            a, b, cc, d = rings[k][c], rings[k][c2], rings[k2][c2], rings[k2][c]
            f = bm.faces.new([a, b, cc, d])
            f.material_index = mats[kind]
            length = (b.co - a.co).length
            if kind == 'f':
                # the scroll runs along the side, one bay every 6 cm, centred
                n = max(1, round(length / bay))
                uvs = [(0, 0), (n / 8, 0), (n / 8, 1), (0, 1)]
            else:
                uvs = [(0, k / 10), (length / 0.3, k / 10), (length / 0.3, k2 / 10), (0, k2 / 10)]
            for loop, t in zip(f.loops, uvs):
                loop[uv].uv = t
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj('frame', bm, ['giltplain', 'gilt', 'giltback'], parent)
    for p in o.data.polygons:
        p.use_smooth = False
    o.data.shade_smooth_by_angle(angle=math.radians(35)) if hasattr(o.data, 'shade_smooth_by_angle') else None
    return o


root = empty('painting')
pan = empty('panel', root)
panel(pan)
keys(pan)
ch = empty('chassis', root)
chassis(ch)
frame(root)

meta = {
    'frame': 'y-up, front +z, metres; origin at the middle of the plane through the panel front corners',
    'panel_mm': [P['panel_w'], P['panel_h'], P['panel_t']],
    'warp_max_mm': P['warp_max'],
    'front_material': 'painting',
}
json.dump(meta, open(os.path.join(OUT, 'monalisa.json'), 'w'), indent=1)
out = os.path.join(OUT, 'monalisa.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True,
                          export_image_format='JPEG', export_image_quality=88, export_materials='EXPORT')
tris = sum(len(o.data.loop_triangles) if (o.data.calc_loop_triangles() or True) else 0 for o in bpy.data.objects if o.type == 'MESH')
print('[assemble]', len([o for o in bpy.data.objects if o.type == 'MESH']), 'meshes,', tris, 'triangles ->', out, f'{os.path.getsize(out) / 1e6:.2f} MB')
