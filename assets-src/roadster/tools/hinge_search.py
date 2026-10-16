"""Search door hinges that swing clear (Blender): pivots and axes tried on the left door of out/roadster.glb; prints the best by
fewest crossings, with where the door's rear top corner and front bottom corner end at 80 degrees.
  blender -b --factory-startup --python tools/hinge_search.py"""
import bpy, sys, json, math, itertools
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='out/roadster.glb')
FIX = Matrix.Rotation(-math.pi / 2, 4, 'X')
def under(o, n):
    while o:
        if o.name == n: return True
        o = o.parent
    return False
def world(o):
    m = o.data; vs = [FIX @ o.matrix_world @ v.co * 1000.0 for v in m.vertices]
    m.calc_loop_triangles(); return vs, [tuple(t.vertices) for t in m.loop_triangles]
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
fixed={o.name: BVHTree.FromPolygons(*world(o)) for o in meshes if not under(o,'door_l') and not under(o,'door_r') and not o.name.startswith(('tyre','rim','spokes','glass_ws'))}
parts=[world(o) for o in meshes if under(o,'door_l')]
res=[]
for px,py,pz in itertools.product((900,),(300,550,800),(900,1000,1100)):
  for wy,wz in itertools.product((0,-0.2,-0.4,-0.6,-0.9),(0,-0.2,-0.4,-0.6,-0.9)):
    a=Vector((1,wy,wz)).normalized(); piv=Vector((px,py,pz)); tot=0; first=None
    for deg in (10,25,45,65,80):
        q=Matrix.Translation(piv)@Quaternion(a,math.radians(deg)).to_matrix().to_4x4()@Matrix.Translation(-piv)
        n=0
        for vs,tris in parts:
            t=BVHTree.FromPolygons([q@v for v in vs],tris)
            for fb in fixed.values(): n+=len(t.overlap(fb))
        tot+=n
        if n and first is None: first=deg
    q=Matrix.Translation(piv)@Quaternion(a,math.radians(80)).to_matrix().to_4x4()@Matrix.Translation(-piv)
    rt=q@Vector((500,1200,-700)); fb_=q@Vector((950,280,850))
    res.append((tot,first,(px,py,pz),(round(a.x,2),round(a.y,2),round(a.z,2)),tuple(round(c) for c in rt),tuple(round(c) for c in fb_)))
res.sort(key=lambda r:r[0])
for r in res[:20]: print('HS',r)
