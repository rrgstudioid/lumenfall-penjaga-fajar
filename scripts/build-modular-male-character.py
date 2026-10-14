"""Isolated Blender staging. Never open/save the source or the user's live scene.

Run: blender --background --factory-startup --python this.py -- SOURCE
The initial audit saves the selected source and inspection renders in work/ only.
"""
import bpy, bmesh, hashlib, json, sys, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/modular-male'
WORK.mkdir(parents=True, exist_ok=True)
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new(); bm.from_mesh(obj.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not (v.co.x < -.2 and v.co.z > .25)], context='VERTS')
bm.to_mesh(obj.data); bm.free()
lo = Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
hi = Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
factor = 2.08 / (hi.z - lo.z)
for v in obj.data.vertices:
    v.co = (v.co - Vector(((lo.x + hi.x)/2, (lo.y + hi.y)/2, lo.z))) * factor
obj.name = 'MaleV2_SelectedSource'
obj.data.update()
for p in obj.data.polygons: p.use_smooth = True
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
scene.render.resolution_x = 760; scene.render.resolution_y = 900; scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('StudioWorld'); scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs[0].default_value = (.18,.21,.24,1); background.inputs[1].default_value = .7
for name, pos, power, size in [('Key',(3,-4,5),450,4), ('Fill',(-3,-1,3),220,4),('Rim',(1,3,4),350,3)]:
    light = bpy.data.lights.new(name,'AREA'); light.energy=power; light.shape='DISK'; light.size=size
    o = bpy.data.objects.new(name,light); scene.collection.objects.link(o); o.location=pos
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('AuditCamera'); cam=bpy.data.objects.new('AuditCamera',camdata); scene.collection.objects.link(cam)
scene.camera=cam; camdata.type='ORTHO'; camdata.ortho_scale=2.6
scene.render.film_transparent=False
report={'sourceSHA256':source_hash,'selectedVertices':len(obj.data.vertices),'selectedTriangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'sourceBounds':[list(lo),list(hi)],'height':2.08}
(WORK/'source-audit.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'selected-source.blend'))
for name,pos in [('front',(0,-6,1.15)),('side',(6,0,1.15)),('back',(0,6,1.15)),('three-quarter',(4,-6,2.4))]:
    cam.location=pos; cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(WORK/(name+'.png')); bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
print('MALE_SOURCE_AUDIT',json.dumps(report),flush=True)
