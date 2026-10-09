"""Normalize copies of two approved Tripo results, preserve PBR and create local LODs.
Usage: blender --background --factory-startup --python this.py -- column.glb reef.glb
Raw downloaded models are read-only; no paid API calls occur here.
"""
import bpy, bmesh, sys, json, math, hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dev-assets/sunken-ruins-underwater-v1/revision3'
WORK=ROOT/'work/sunken-ruins/revision3'
TARGET=WORK/'Sunken_Ruins_Tripo_Staging.blend'
assert not bpy.data.filepath or Path(bpy.data.filepath).resolve()==TARGET.resolve()
column_path,reef_path=[Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]]
for p in [column_path,reef_path]:
    assert p.is_relative_to(WORK.resolve()) and p.suffix=='.glb',p
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.context.scene.name='Sunken Ruins - approved Tripo PBR staging'
models=[]; records=[]
processed_images=set()
for name,source,height,radius in [('pillar',column_path,6.475,1.49),('reef_cluster',reef_path,1.65,1.)]:
    previous=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported=set(bpy.data.objects)-previous
    parts=[o for o in imported if o.type=='MESH']
    assert parts
    for o in parts:
        transform=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(transform)
    for o in imported:
        if o not in parts:bpy.data.objects.remove(o,do_unlink=True)
    removed_artifact_vertices=0
    if name=='reef_cluster':
        # This task has one straight reconstruction needle above a sponge.
        # Bounds were inspected in the raw mesh, then mapped from glTF Y-up to Blender Z-up.
        # Edit only the staged copy; preserve the organic branches and original UVs.
        for o in parts:
            bm=bmesh.new();bm.from_mesh(o.data)
            needle=[v for v in bm.verts if .326<v.co.x<.343 and -.073<v.co.y<-.056 and v.co.z>-.10]
            removed_artifact_vertices+=len(needle)
            bmesh.ops.delete(bm,geom=needle,context='VERTS')
            rim=[e for e in bm.edges if e.is_boundary and all(.31<v.co.x<.36 and -.09<v.co.y<-.04 and -.13<v.co.z<-.07 for v in e.verts)]
            if rim:bmesh.ops.holes_fill(bm,edges=rim,sides=32)
            bm.to_mesh(o.data);bm.free();o.data.update()
        assert 300<removed_artifact_vertices<5000,removed_artifact_vertices
    verts=[v.co for o in parts for v in o.data.vertices]
    min_x,min_y,min_z=[min(v[i] for v in verts) for i in range(3)]
    max_x,max_y,max_z=[max(v[i] for v in verts) for i in range(3)]
    cx=(max_x+min_x)/2;cy=(max_y+min_y)/2
    original_radius=max(math.hypot(v.x-cx,v.y-cy) for v in verts)
    sz=height/(max_z-min_z)
    xy=radius/original_radius if name=='reef_cluster' else min(sz,radius/original_radius)
    for o in parts:
        for v in o.data.vertices:v.co=((v.co.x-cx)*xy,(v.co.y-cy)*xy,(v.co.z-min_z)*sz)
        for mat in o.data.materials:
            if mat:mat.name=name+'_PBR'
    # Keep the detailed source, but stage 2K textures for this browser map.
    for o in parts:
        for mat in o.data.materials:
            if not mat or not mat.use_nodes:continue
            for node in mat.node_tree.nodes:
                if node.type!='TEX_IMAGE' or not node.image or node.image in processed_images:continue
                image=node.image;processed_images.add(image)
                w,h=image.size
                if max(w,h)>2048:
                    ratio=2048/max(w,h);image.scale(round(w*ratio),round(h*ratio));image.pack()
    triangles=[]
    for o in parts:o.data.calc_loop_triangles();triangles.append(len(o.data.loop_triangles))
    budget=16000 if name=='pillar' else 14000
    if sum(triangles)>budget:
        for o in parts:
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('Enforce browser mesh budget','DECIMATE');mod.ratio=budget/sum(triangles)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    # One root per prototype; multiple material primitives remain distinct under it in glTF.
    root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);models.append(root)
    for i,o in enumerate(parts):o.name=f'{name}_surface_{i}';o.parent=root;models.append(o)
    for suffix,ratio in [('_lod',.32),('_far',.10)]:
        low_root=bpy.data.objects.new(name+suffix,None);bpy.context.collection.objects.link(low_root);models.append(low_root)
        for i,o in enumerate(parts):
            low=o.copy();low.data=o.data.copy();low.name=f'{name}{suffix}_surface_{i}';low.parent=low_root
            bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
            mod=low.modifiers.new('Local distance LOD','DECIMATE');mod.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=mod.name);models.append(low)
    raw=(source.parent/'task.json').read_bytes()
    task=json.loads(raw.decode('utf-16' if raw[:2] in (b'\xff\xfe',b'\xfe\xff') else 'utf-8-sig'))
    records.append({'name':name,'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'taskId':task['task_id'],'status':task['status'],'creditsConsumed':task['credits_consumed'],'model':'v3.1-20260211','createdAt':task['created_at'],'removedArtifactVertices':removed_artifact_vertices,'normalization':{'height':height,'maxHorizontalRadius':radius,'scaleXY':xy,'scaleZ':sz}})
    reference=WORK/'ruin-reference.png' if name=='pillar' else ROOT/'work/sunken-ruins/coral-reference-higgsfield.png'
    records[-1]['reference']={'provider':'Higgsfield','job':'f92fe60c-7b94-4f5e-8400-8fba119344a1' if name=='pillar' else 'f3278113-7245-488e-a3c8-b6d692576d17','file':str(reference.relative_to(ROOT)),'sha256':hashlib.sha256(reference.read_bytes()).hexdigest()}
    records[-1]['approvedRequest']={'endpoint':'/v3/generation/image-to-model','cliModel':'tripo-v3.1','model':'v3.1-20260211','smart_low_poly':True,'face_limit':budget,'texture':True,'pbr':True,'texture_quality':'detailed'}
bpy.ops.object.select_all(action='DESELECT')
for o in models:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'tripo-kit.glb'),export_format='GLB',use_selection=True,export_apply=True)
meshes=[]
for o in models:
    if o.type!='MESH':continue
    o.data.calc_loop_triangles();meshes.append({'name':o.name,'triangles':len(o.data.loop_triangles),'materials':len(o.data.materials)})
for i,o in enumerate([o for o in models if not o.parent]):o.location=((i%3)*7,(i//3)*8,0)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
manifest={'file':'tripo-kit.glb','bytes':(OUT/'tripo-kit.glb').stat().st_size,'sha256':hashlib.sha256((OUT/'tripo-kit.glb').read_bytes()).hexdigest(),'sources':records,'meshes':meshes,'modifications':'Copies normalized to shared collision footprints; local decimation LODs retain source PBR materials and UVs. Raw files unchanged.','author':'Tripo v3.1 generation from Higgsfield references in the project owner account; local staging for LUMENFALL','license':'Generated outputs subject to Tripo and Higgsfield terms; not represented as CC0.','sourceAssetsModified':False}
manifest['creditsConsumed']=sum(r['creditsConsumed'] for r in records)
manifest['textureLimit']=2048
manifest['licenseReferences']=['https://www.tripo3d.ai/blog/commercial-use-ai-3d-models','https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially']
manifest['licenseChecked']='2026-10-09'
(OUT/'tripo-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
