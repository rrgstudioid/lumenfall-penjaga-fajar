"""Controlled offline conversion of two staged BLENDs; never opens the source vault."""
import bpy, json, sys, pathlib, numpy as np
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]/'dev-assets/kingdom-city-pilot-a3'
ids=['env_package_tree_small_02_2k','env_package_boulder_01_2k']
inspect_only='--inspect' in sys.argv
reports=[]
for asset_id in ids:
    source=next((root/'source-copy'/asset_id).glob('*.blend'))
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    report={'id':asset_id,'file':str(source),'unitSystem':bpy.context.scene.unit_settings.system,'unitScale':bpy.context.scene.unit_settings.scale_length,'objects':[]}
    for o in objects:
        report['objects'].append({'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'dimensions':list(o.dimensions),'location':list(o.location),'scale':list(o.scale),'hidden':o.hide_render,'modifiers':[{'name':m.name,'type':m.type} for m in o.modifiers],'materials':[m.name for m in o.data.materials if m]})
    report['images']=[{'name':im.name,'path':im.filepath,'size':list(im.size)} for im in bpy.data.images]
    report['provenanceMetadata']={'texts':[{'name':t.name,'text':t.as_string()[:12000]} for t in bpy.data.texts], 'sceneProperties':{k:str(v) for k,v in bpy.context.scene.items()},'assetMetadata':[{'name':o.name,'author':o.asset_data.author,'description':o.asset_data.description} for o in objects if o.asset_data]}
    if not inspect_only:
        bpy.ops.object.select_all(action='DESELECT')
        # Source packages may have collection variants; selection is recorded, never silently mass-exported.
        target='tree_small_02_LOD0' if 'tree' in asset_id else 'boulder_01_LOD0'
        chosen=[o for o in objects if o.name==target]
        if len(chosen)!=1:raise RuntimeError('Expected exact complete LOD0 object '+target)
        for o in chosen:o.hide_set(False);o.select_set(True)
        report['exportedObjects']=[o.name for o in chosen]
        for im in list(bpy.data.images):
            candidate=source.parent/'textures'/im.filepath.replace(chr(92),'/').split('/')[-1]
            decoded=root/'decoded-textures'/asset_id/candidate.name
            if decoded.exists():candidate=decoded
            if candidate.is_file():
                replacement=bpy.data.images.load(str(candidate),check_existing=False)
                replacement.colorspace_settings.name=im.colorspace_settings.name
                if not replacement.size[0]:raise RuntimeError('Image decode failed: '+str(candidate))
                im.user_remap(replacement)
                report.setdefault('imageRepairs',[]).append({'old':im.name,'source':str(candidate),'size':list(replacement.size),'channels':replacement.channels})
            # Keep original 2K nature textures here. Blender's in-memory rescale of
            # one-channel source images is not reliable in this build; no silent alpha loss.
        dest=root/'models'/asset_id;dest.mkdir(parents=True,exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(dest/'model.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True)
        if 'tree' in asset_id:
            # Keep structural bark/branches while reducing foliage. Uniform decimation
            # collapsed the trunk at LOD2; split only this derived in-memory copy.
            bpy.context.view_layer.objects.active=chosen[0]
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
            chosen=list(bpy.context.selected_objects)
            original=[]
            for o in chosen:
                material=o.data.materials[0].name if o.data.materials else ''
                modifier=o.modifiers.new('A3_LOD1','DECIMATE');modifier.ratio=.5 if 'trunk' in material else .25 if 'branches' in material else .05;original.append((modifier,material))
            bpy.ops.export_scene.gltf(filepath=str(dest/'lod1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True)
            for modifier,material in original:modifier.ratio=.25 if 'trunk' in material else .15 if 'branches' in material else .015
            bpy.ops.export_scene.gltf(filepath=str(dest/'lod2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True)
        report['status']='EXPORTED'
    reports.append(report)
if not inspect_only:
    for source in (root/'material-source').glob('*/*.exr'):
        im=bpy.data.images.load(str(source),check_existing=False)
        im.colorspace_settings.name='Non-Color'
        factor=min(1,1024/max(im.size));im.scale(int(im.size[0]*factor),int(im.size[1]*factor))
        dest=root/'materials'/source.parent.name/(source.stem+'.png');dest.parent.mkdir(parents=True,exist_ok=True)
        im.filepath_raw=str(dest);im.file_format='PNG';im.save()
(root/('blend-inspect.json' if inspect_only else 'blend-conversion.json')).write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
