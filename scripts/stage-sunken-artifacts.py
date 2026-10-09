"""Stage only approved Tripo copies in a fresh Blender scene.
Usage: blender --background --factory-startup --python scripts/stage-sunken-artifacts.py -- NAME SOURCE [revision6|revision12]
Never opens or changes original city/assets. Local normalization, image resizing and LODs are free.
"""
import bpy, bmesh, sys, json, hashlib, math
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:]
name,source=args[:2]
revision=args[2] if len(args)>2 else 'revision6'
assert revision in ['revision6','revision12']
WORK=ROOT/'work/sunken-ruins'/revision
OUT=ROOT/'dev-assets/sunken-ruins-underwater-v1'/revision
source=Path(source).resolve()
assert source.is_relative_to(WORK.resolve()) and source.suffix=='.glb'
assert not bpy.data.filepath
OUT.mkdir(parents=True,exist_ok=True)
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(source))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in parts:
    mat=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(mat)
for o in list(bpy.context.scene.objects):
    if o not in parts:bpy.data.objects.remove(o,do_unlink=True)
removed=0
if name=='sunken-shipwreck':
    # Isolated fragments above the coherent hull are reconstruction debris, not mast supports.
    for o in parts:
        bm=bmesh.new();bm.from_mesh(o.data)
        unseen=set(bm.verts);components=[]
        while unseen:
            seed=unseen.pop();group={seed};stack=[seed]
            while stack:
                for e in stack.pop().link_edges:
                    for v in e.verts:
                        if v in unseen:unseen.remove(v);group.add(v);stack.append(v)
            components.append(group)
        main=max(components,key=len);roof=max(v.co.z for v in main)
        debris=[v for c in components if min(v.co.z for v in c)>roof+.01 for v in c]
        removed+=len(debris)
        bmesh.ops.delete(bm,geom=debris,context='VERTS');bm.to_mesh(o.data);bm.free()
verts=[v.co for o in parts for v in o.data.vertices]
lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
dimensions=[hi[i]-lo[i] for i in range(3)]
target={'sunken-shipwreck':54,'neptune-statue':16,'ancient-amphora':2.8,'sunken-astrolabe':5}[name]
scale=target/(max(dimensions[:2]) if name=='sunken-shipwreck' else dimensions[2])
# Orient ship's long axis along local X; Three uses X/Z for the horizontal plane.
swap=name=='sunken-shipwreck' and dimensions[1]>dimensions[0]
for o in parts:
    for v in o.data.vertices:
        x=(v.co.x-(lo[0]+hi[0])/2)*scale;y=(v.co.y-(lo[1]+hi[1])/2)*scale
        v.co=(y if swap else x,-x if swap else y,(v.co.z-lo[2])*scale)
    for m in o.data.materials:
        if m:m.name=name+'_PBR'
budget=next(j['faces'] for j in json.loads((WORK/'assets.json').read_text()) if j['name']==name)
for o in parts:o.data.calc_loop_triangles()
source_triangles=sum(len(o.data.loop_triangles) for o in parts)
if source_triangles>budget:
    for o in parts:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Enforce approved browser face budget','DECIMATE');mod.ratio=(budget-4)/source_triangles
        bpy.ops.object.modifier_apply(modifier=mod.name)
images=set()
texture_limit=1024 if name in ['ancient-amphora','sunken-astrolabe'] else 2048
for o in parts:
    for m in o.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type=='TEX_IMAGE' and n.image and n.image not in images:
                    im=n.image;images.add(im);w,h=im.size
                    if max(w,h)>texture_limit:ratio=texture_limit/max(w,h);im.scale(round(w*ratio),round(h*ratio));im.pack()
models=[]
root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);models.append(root)
for i,o in enumerate(parts):o.parent=root;o.name=f'{name}_surface_{i}';models.append(o)
for suffix,ratio in [('_lod',.32),('_far',.10)]:
    parent=bpy.data.objects.new(name+suffix,None);bpy.context.collection.objects.link(parent);models.append(parent)
    for i,o in enumerate(parts):
        low=o.copy();low.data=o.data.copy();low.parent=parent;low.name=f'{name}{suffix}_surface_{i}'
        bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
        mod=low.modifiers.new('Local distance LOD','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name);models.append(low)
bpy.ops.object.select_all(action='DESELECT')
for o in models:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True)
vertices=[v.co for o in parts for v in o.data.vertices]
bounds={k:[min(v[i] for v in vertices),max(v[i] for v in vertices)] for i,k in enumerate(['x','z','y'])}
# Tight lower-body footprint for navigation; tall tridents and hanging spars do not create walls.
foot=[v for v in vertices if v.z<=2.8]
footprint={'x':[min(v.x for v in foot),max(v.x for v in foot)],'z':[-max(v.y for v in foot),-min(v.y for v in foot)]}
meshes=[]
for o in models:
    if o.type=='MESH':o.data.calc_loop_triangles();meshes.append({'name':o.name,'triangles':len(o.data.loop_triangles)})
task=json.loads((source.parent/'task.json').read_text(encoding='utf-8-sig'))
manifest={'name':name,'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'taskId':task['task_id'],'creditsConsumed':task['credits_consumed'],'model':'v3.1-20260211','prompt':next(j['prompt'] for j in json.loads((WORK/'assets.json').read_text()) if j['name']==name),'author':'Tripo v3.1 from project prompt','license':'Generated with the owner-authorized Tripo account; subject to that account service terms, no third-party asset download.','removedDebrisVertices':removed,'sourceTriangles':source_triangles,'faceBudget':budget,'bounds':bounds,'footprint':footprint,'meshes':meshes,'modifications':'Staged copy centered at seabed, uniformly scaled, ship long axis along X; 2K PBR images, enforced face budget and local 32%/10% LODs. Original source unchanged.','bytes':(OUT/f'{name}.glb').stat().st_size}
manifest['modifications']=manifest['modifications'].replace('2K PBR images',f'{texture_limit}px PBR images')
manifest['operation']=task['type']
if task['type']=='image_to_model':
    manifest.pop('prompt',None)
    manifest['reference']=next(j.get('reference','work/sunken-ruins/revision6/tripo-out/neptune-statue-aa32e485/generated_image.jpeg') for j in json.loads((WORK/'assets.json').read_text()) if j['name']==name)
    manifest['author']='Tripo v3.1 from the project-generated reference image'
(OUT/f'{name}.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'{name}-staging.blend'))
print(json.dumps(manifest))
