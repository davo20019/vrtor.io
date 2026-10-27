"""Headless Blender: the Coronation of Napoleon as it is made, to out/sacre.glb and out/sacre.json.

    blender -b --factory-startup --python assemble.py

In:  params.json (sizes, spec.md gives each one's source), work/*.png (textures.py).
Out: out/sacre.glb, y-up, front +z, metres, origin at the middle of the canvas's front. Nodes:
     painting > canvas (paint_<row><col> tiles, rim, tacking, lining), stretcher (member_*, bar_*), frame (frame,
     plaque). Each painted tile carries a 512 px stand-in; the app swaps in the KTX2 tiles (1k, then 4k near you).

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
W, H, T = P['canvas_w'] * MM, P['canvas_h'] * MM, P['canvas_t'] * MM
RB = P['rebate'] * MM
SW, SH = W - 2 * RB, H - 2 * RB          # the sight opening: what the frame shows
NX, NY = P['tiles_x'], P['tiles_y']

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- materials

def image(name, linear=False):
    img = bpy.data.images.load(os.path.join(WORK, name))
    if linear:
        img.colorspace_settings.name = 'Non-Color'
    return img


def material(name, color=None, normal=None, orm=None, roughness=0.6, metallic=0.0, base=None):
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
        nm = nt.nodes.new('ShaderNodeNormalMap')
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
    'lining': material('lining', 'lining_color.png', 'lining_normal.png', roughness=0.95),
    'ground': material('ground', base=(0.33, 0.25, 0.17), roughness=0.85),
    'pine': material('pine', 'pine_color.png', 'pine_normal.png', roughness=0.8),
    'leaf': material('gilt_leaf', 'leaf_color.png', 'leaf_normal.png', 'leaf_orm.png'),
    'egg': material('gilt_egg', 'egg_color.png', 'egg_normal.png', 'egg_orm.png'),
    'plain': material('gilt', 'giltplain_color.png', 'giltplain_normal.png', 'giltplain_orm.png'),
    'back': material('frame_back', base=(0.18, 0.12, 0.08), roughness=0.9),
    'plaque': material('plaque', 'plaque_color.png', roughness=0.35, metallic=0.85),
}
for r in range(NY):
    for c in range(NX):
        MAT[f'paint_{r}{c}'] = material(f'paint_{r}{c}', f'tile_{r}{c}_512.png', roughness=0.4)


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


def quad(bm, uv, vs, uvs, mat=0):
    f = bm.faces.new(vs)
    f.material_index = mat
    for loop, t in zip(f.loops, uvs):
        loop[uv].uv = t
    return f


def plane(name, x0, x1, z0, z1, y, mat, parent, facing=-1, nx=1, nz=1, uv_box=None):
    """A grid in the x-z plane at depth y, facing -Y (front) or +Y (back). uv_box: (u0, v0, u1, v1) over the grid,
    else metres / 0.25."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    g = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y, z0 + (z1 - z0) * j / nz)) for j in range(nz + 1)] for i in range(nx + 1)]

    def t(i, j):
        if uv_box:
            u0, v0, u1, v1 = uv_box
            return (u0 + (u1 - u0) * i / nx, v0 + (v1 - v0) * j / nz)
        return (g[i][j].co.x / 0.25, g[i][j].co.z / 0.25)
    for i in range(nx):
        for j in range(nz):
            vs = [g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]]
            ts = [t(i, j), t(i + 1, j), t(i + 1, j + 1), t(i, j + 1)]
            if facing > 0:
                vs, ts = vs[::-1], ts[::-1]
            quad(bm, uv, vs, ts)
    return obj(name, bm, [mat], parent)


def box(name, x0, x1, y0, y1, z0, z1, mat, parent, uv_scale=0.25):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    uv = bm.loops.layers.uv.new('UVMap')
    long_is_z = (z1 - z0) >= (x1 - x0)
    for f in bm.faces:
        nx, ny, nz = (abs(c) for c in f.normal)
        for loop in f.loops:
            c = loop.vert.co
            if long_is_z:   # grain along z
                loop[uv].uv = ((c.x if ny > 0.5 else c.y) / uv_scale * 4, c.z / uv_scale)
            else:           # grain along x
                loop[uv].uv = ((c.y if nz > 0.5 else c.z) / uv_scale * 4, c.x / uv_scale) if nx < 0.5 else (c.y / uv_scale, c.z / uv_scale)
    return obj(name, bm, [mat], parent, smooth=False)


# ---------------------------------------------------------------- the canvas

def canvas(parent):
    """The painted face in tiles over the sight opening, the rim the frame hides, the canvas wrapped round the
    stretcher's sides and nailed there, and the relining canvas behind."""
    tw, th = SW / NX, SH / NY
    for r in range(NY):
        for c in range(NX):
            x0 = -SW / 2 + c * tw
            z1 = SH / 2 - r * th
            plane(f'paint_{r}{c}', x0, x0 + tw, z1 - th, z1, 0.0, f'paint_{r}{c}', parent, nx=4, nz=4, uv_box=(0, 0, 1, 1))
    # The rim under the frame's lip: ground showing, no paint photographed there.
    ox, oz, ix, iz = W / 2, H / 2, SW / 2, SH / 2
    plane('canvas_rim_top', -ox, ox, iz, oz, 0.0, 'ground', parent)
    plane('canvas_rim_bottom', -ox, ox, -oz, -iz, 0.0, 'ground', parent)
    plane('canvas_rim_left', -ox, -ix, -iz, iz, 0.0, 'ground', parent)
    plane('canvas_rim_right', ix, ox, -iz, iz, 0.0, 'ground', parent)
    # Tacking margins: the canvas turns round the stretcher's outer edges and runs back along its sides.
    depth = T + P['stretcher_d'] * MM
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    cs = [(-ox, -oz), (ox, -oz), (ox, oz), (-ox, oz)]
    front = [bm.verts.new((x, 0.0, z)) for x, z in cs]
    back = [bm.verts.new((x, depth, z)) for x, z in cs]
    for k in range(4):
        k2 = (k + 1) % 4
        L = (front[k2].co - front[k].co).length
        quad(bm, uv, [front[k], back[k], back[k2], front[k2]], [(0, 0), (0, depth / 0.25), (L / 0.25, depth / 0.25), (L / 0.25, 0)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj('tacking', bm, ['lining'], parent)
    plane('lining', -ox, ox, -oz, oz, T, 'lining', parent, facing=+1)


# ---------------------------------------------------------------- the stretcher

def stretcher(parent):
    """The wooden stretcher behind the canvas: four outer members and a grid of crossbars, set back from the canvas
    so it doesn't print through. Count and sizes are estimates (spec.md)."""
    sw, sd = P['stretcher_w'] * MM, P['stretcher_d'] * MM
    bw, bd = P['bar_w'] * MM, P['bar_d'] * MM
    ox, oz = W / 2 - T, H / 2 - T
    y0, y1 = T, T + sd
    box('member_top', -ox, ox, y0, y1, oz - sw, oz, 'pine', parent)
    box('member_bottom', -ox, ox, y0, y1, -oz, -oz + sw, 'pine', parent)
    box('member_left', -ox, -ox + sw, y0, y1, -oz + sw, oz - sw, 'pine', parent)
    box('member_right', ox - sw, ox, y0, y1, -oz + sw, oz - sw, 'pine', parent)
    by0 = y1 - bd
    nv, nh = P['bars_vertical'], P['bars_horizontal']
    inner_x0, inner_x1 = -ox + sw, ox - sw
    xs = [inner_x0 + (inner_x1 - inner_x0) * (k + 1) / (nv + 1) for k in range(nv)]
    for k, x in enumerate(xs):
        box(f'bar_v{k + 1}', x - bw / 2, x + bw / 2, by0, y1, -oz + sw, oz - sw, 'pine', parent)
    # Horizontal bars in pieces between the verticals (half-lapped in the real thing; here they butt, so no faces
    # share a plane).
    edges = [inner_x0] + [x for x in xs] + [inner_x1]
    for j in range(nh):
        z = -oz + sw + (2 * (oz - sw)) * (j + 1) / (nh + 1)
        for k in range(len(edges) - 1):
            a = edges[k] + (bw / 2 if k > 0 else 0)
            b = edges[k + 1] - (bw / 2 if k + 1 < len(edges) - 1 else 0)
            box(f'bar_h{j + 1}_{k + 1}', a, b, by0, y1, z - bw / 2, z + bw / 2, 'pine', parent)


# ---------------------------------------------------------------- the frame

def frame(parent):
    """The gilt frame: a water-leaf band at the sight edge, a wide plain frieze, an egg-and-dart ovolo and a plain
    outer edge, as in the photographs; its visible width (360 mm) measured on them, its depths estimated. Points are
    (mm out from the sight edge, mm in front of the canvas), with each segment's band."""
    reach_back = -P['frame_back']
    r_in = P['rebate'] + 5
    pts = [(r_in, 3), (0, 3), (0, 22), (4, 30), (32, 38), (36, 34), (40, 36), (240, 46), (246, 56), (252, 58),
           (270, 74), (292, 84), (315, 84), (330, 76), (334, 78), (352, 72), (360, 60), (360, reach_back), (r_in, reach_back)]
    kinds = ['back', 'plain', 'plain', 'leaf', 'plain', 'plain', 'plain', 'plain', 'plain',
             'egg', 'egg', 'egg', 'egg', 'plain', 'plain', 'plain', 'plain', 'back', 'back']
    # v across the leaf and egg bands: cumulative length along the profile, 0 at the band's inner edge.
    seglen = [math.dist(pts[k], pts[(k + 1) % len(pts)]) for k in range(len(pts))]
    band_v = {}
    for band in ('leaf', 'egg'):
        idx = [k for k, kd in enumerate(kinds) if kd == band]
        total = sum(seglen[k] for k in idx)
        acc = 0.0
        for k in idx:
            band_v[k] = (acc / total, (acc + seglen[k]) / total)
            acc += seglen[k]
    period = {'leaf': P['leaf_period'] * MM, 'egg': P['egg_period'] * MM}
    mats = ['plain', 'leaf', 'egg', 'back']
    sx, sz = SW / 2, SH / 2
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]       # bottom-left, bottom-right, top-right, top-left
    rings = [[bm.verts.new((cx * (sx + r * MM), -hh * MM, cz * (sz + r * MM))) for cx, cz in corners] for r, hh in pts]
    for k in range(len(pts)):
        k2 = (k + 1) % len(pts)
        kind = kinds[k]
        for c in range(4):
            c2 = (c + 1) % 4
            vs = [rings[k][c], rings[k][c2], rings[k2][c2], rings[k2][c]]
            horizontal = c in (0, 2)   # bottom and top sides run along x
            along = [(v.co.x if horizontal else v.co.z) for v in vs]
            if kind in period:
                v0, v1 = band_v[k]
                # Whole repeats centred on the side's middle.
                uvs = [(a / period[kind] + 0.5, vv) for a, vv in zip(along, (v0, v0, v1, v1))]
            else:
                rr = [pts[k][0], pts[k][0], pts[k2][0], pts[k2][0]]
                uvs = [(a / 0.3, r * MM / 0.3) for a, r in zip(along, rr)]
            quad(bm, uv, vs, uvs, mats.index(kind))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj('frame', bm, mats, parent, smooth=False)
    # The name plaque on the bottom rail's frieze, centred (measured on cc0_room.jpg: 830 x 110 mm).
    pw, ph = P['plaque_w'] * MM, P['plaque_h'] * MM
    zc = -sz - P['plaque_below_sight'] * MM
    r = P['plaque_below_sight']
    hh = (36 + (r - 40) / 200 * 10) * MM       # the frieze's height there
    pl = plane('plaque', -pw / 2, pw / 2, zc - ph / 2, zc + ph / 2, -hh - 0.003, 'plaque', parent, uv_box=(0, 0, 1, 1))
    # Its edge, so it reads as a plate.
    box('plaque_edge', -pw / 2, pw / 2, -hh - 0.0029, -hh + 0.002, zc - ph / 2, zc + ph / 2, 'plain', parent)
    return o


root = empty('painting')
cv = empty('canvas', root)
canvas(cv)
st = empty('stretcher', root)
stretcher(st)
fr = empty('frame', root)
frame(fr)

meta = {
    'frame': 'y-up, front +z, metres; origin at the middle of the canvas front',
    'canvas_mm': [P['canvas_w'], P['canvas_h'], P['canvas_t']],
    'sight_mm': [P['canvas_w'] - 2 * P['rebate'], P['canvas_h'] - 2 * P['rebate']],
    'tiles': [NY, NX],
    'frame_outer_mm': [P['canvas_w'] - 2 * P['rebate'] + 2 * P['frame_reach'], P['canvas_h'] - 2 * P['rebate'] + 2 * P['frame_reach']],
    'frame_front_mm': 84,
}
json.dump(meta, open(os.path.join(OUT, 'sacre.json'), 'w'), indent=1)
out = os.path.join(OUT, 'sacre.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True,
                          export_image_format='JPEG', export_image_quality=88, export_materials='EXPORT')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.data.calc_loop_triangles()
tris = sum(len(o.data.loop_triangles) for o in meshes)
print('[assemble]', len(meshes), 'meshes,', tris, 'triangles ->', out, f'{os.path.getsize(out) / 1e6:.2f} MB')
