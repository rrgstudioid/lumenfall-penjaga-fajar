"""Background Blender only, on extracted staging copies; never saves a .blend."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/maps/verdant-plains-v2'
STAGE=ROOT/'output/verdant-plains/source'
report=[]
for name,target,height in [('shrub',450,1.5),('pier',1500,0)]:
    bpy.ops.wm.open_mainfile(filepath=str(next((STAGE/name).glob('*.blend'))))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
    print('SOURCE',name,[(o.name,len(o.data.polygons),list(o.dimensions)) for o in meshes],flush=True)
    # Use one complete tree, not the variants/gallery packaged beside it.
    if name!='pier':
        candidates=[o for o in meshes if len(o.data.polygons)>100]
        if candidates: meshes=[max(candidates,key=lambda o:o.dimensions.z if name in ('fir','tree','shrub') else len(o.data.polygons))]
    else:
        candidates=[o for o in meshes if 'plank' in o.name.lower() or 'floor' in o.name.lower()]
        meshes=[max(candidates or meshes,key=lambda o:o.dimensions.x*o.dimensions.y)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    # Applied modifiers live only in this unsaved process.
    for o in meshes:
        for mod in list(o.modifiers):
            if mod.type in ('SUBSURF','DISPLACE'):o.modifiers.remove(mod)
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH')
        tris=sum(max(1,len(p.vertices)-2) for p in o.data.polygons)
        if tris>target:
            dec=o.modifiers.new('Runtime reduction','DECIMATE');dec.ratio=target/tris
            bpy.context.view_layer.objects.active=o
            bpy.ops.object.modifier_apply(modifier=dec.name)
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bounds=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    low=Vector(tuple(min(p[i] for p in bounds) for i in range(3)));high=Vector(tuple(max(p[i] for p in bounds) for i in range(3)))
    center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    factor=height/max(.01,high.z-low.z) if height else 1
    for o in meshes:
        o.location=(o.location-center)*factor;o.scale*=factor
    # Keep only base colour/alpha, one compact shared image per source material.
    for mat in {m for o in meshes for m in o.data.materials if m}:
        if not mat.use_nodes:continue
        nodes=mat.node_tree.nodes
        bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf:continue
        bsdf.inputs['Roughness'].default_value=.9
        for socket in ('Normal','Roughness','Metallic'):
            for link in list(bsdf.inputs[socket].links):mat.node_tree.links.remove(link)
        for node in list(nodes):
            if node.type!='TEX_IMAGE' or not node.image:continue
            im=node.image
            if any(tag in im.name.lower() for tag in ('_nor_','_rough_','_disp_','_metal_')):
                nodes.remove(node);continue
            try:
                path=bpy.path.abspath(im.filepath)
                if not Path(path).exists():
                    match=list((STAGE/name/'textures').glob(Path(path).name))
                    if match:im.filepath=str(match[0]);im.reload()
                im.scale(min(512,im.size[0]),min(512,im.size[1]))
                image_dir=STAGE/name/'runtime-images';image_dir.mkdir(exist_ok=True)
                image_path=image_dir/(str(len(list(image_dir.iterdir())))+'.png')
                im.file_format='PNG';im.filepath_raw=str(image_path);im.save()
                node.image=bpy.data.images.load(str(image_path),check_existing=False)
            except Exception as e:print('IMAGE',im.name,str(e))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    report.append({'name':name,'sourceObjects':[o.name for o in meshes],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'bytes':(OUT/(name+'.glb')).stat().st_size})
(OUT/'model-report.json').write_text(json.dumps(report,indent=2))
print('VERDANT_EXPORT',json.dumps(report),flush=True)
