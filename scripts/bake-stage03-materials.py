"""Bake actual Stage03 procedural material samples into reusable game surface maps.
Tile construction replaces paving/roof microgeometry; no original scene is saved.
"""
import bpy,json,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
OUT=ROOT/'assets/textures';OUT.mkdir(exist_ok=True)
assert Path(bpy.data.filepath).name=='LUMENFALL_Stage03_Working.blend'
sources={'stone':'LF2_Honey_Limestone_3','paving':'LF_Warm_Flagstone_04','wood':'LF2_Structural_Oak','plaster':'LF2_Lime_Plaster_2','blue':'LF2_Cobalt_Slate_3','red':'LF2_Oxblood_Clay_Tile_3'}
scene=bpy.data.scenes.new('Stage03 material baking');bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=4;scene.cycles.device='CPU';scene.render.bake.margin=0
scene.view_settings.view_transform='Standard'
bpy.ops.mesh.primitive_plane_add(size=3);plane=bpy.context.object
report=[];texture_files={}
for family,name in sources.items():
    source=bpy.data.materials.get(name)
    assert source, name
    material=source.copy();plane.data.materials.clear();plane.data.materials.append(material)
    nodes=material.node_tree.nodes;links=material.node_tree.links;bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    original_color=bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].is_linked else None
    image_node=nodes.new('ShaderNodeTexImage');nodes.active=image_node
    resolution=2048 if family in ['stone','paving'] else 1024
    # Sample the original ColorRamp/Noise network, with light-independent diffuse bake.
    image=bpy.data.images.new('Bake_'+family,width=resolution,height=resolution,alpha=False)
    image_node.image=image
    scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
    bpy.ops.object.bake(type='DIFFUSE')
    values=np.array(image.pixels[:],dtype=np.float32).reshape(resolution,resolution,4)
    # Repeating masonry/tile profile supplies detail formerly modeled as millions of tiny faces.
    yy,xx=np.mgrid[0:resolution,0:resolution]/resolution
    if family in ['stone','paving','blue','red']:
        rows=8 if family in ['blue','red'] else 6
        ycell=yy*rows; xcell=xx*(rows/2)+(np.floor(ycell)%2)*.5
        edge=np.minimum.reduce([xcell%1,1-xcell%1,ycell%1,1-ycell%1])
        bevel=np.clip(edge/.035,0,1)
        shade=.68+.32*bevel
        values[:,:,:3]*=shade[:,:,None]
    else:
        bevel=np.ones((resolution,resolution),dtype=np.float32)
    image.pixels.foreach_set(values.ravel());image.filepath_raw=str(OUT/(family+'-color.png'));image.file_format='PNG';image.save()
    bpy.data.images.remove(image)
    # Tangent normals are baked from the source Bump network, not diffuse fallback.
    normal=bpy.data.images.new('Normal_'+family,width=1024,height=1024,alpha=False);normal.colorspace_settings.name='Non-Color';image_node.image=normal
    bpy.ops.object.bake(type='NORMAL')
    normal.filepath_raw=str(OUT/(family+'-normal.png'));normal.file_format='PNG';normal.save();bpy.data.images.remove(normal)
    texture_files[family]=dict(color='textures/'+family+'-color.png',normal='textures/'+family+'-normal.png',orm='textures/shared-orm.png')
    report.append(dict(family=family,sourceMaterial=name,colorResolution=resolution,normalResolution=1024,method='Cycles diffuse-color and tangent-normal baking; periodic mortar modulation',sceneAO=False))
    bpy.data.materials.remove(material)
# Shared ORM: AO neutral (scene occlusion is not falsely claimed baked), roughness .78, dielectric metalness 0.
image=bpy.data.images.new('Shared_ORM',width=1024,height=1024,alpha=False);image.colorspace_settings.name='Non-Color'
pixels=np.ones((1024,1024,4),dtype=np.float32);pixels[:,:,1]=.78;pixels[:,:,2]=0
image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(OUT/'shared-orm.png');image.file_format='PNG';image.save()
manifest_path=ROOT/'assets/manifest.json';manifest=json.loads(manifest_path.read_text());manifest['textures']=texture_files
manifest_path.write_text(json.dumps(manifest,indent=2));(ROOT/'evidence/material-bake.json').write_text(json.dumps(report,indent=2))
print('MATERIAL_BAKE_DONE',len(report))
