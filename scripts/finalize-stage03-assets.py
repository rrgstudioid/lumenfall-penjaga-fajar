"""Bake vertex ambient occlusion, author reduced LODs, connect cached surface maps.
Only the runtime working derivative and development assets may be written.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]/'dev-prototypes/mahkota-fajar-stage03-v1'
assert Path(bpy.data.filepath).resolve()==(ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend').resolve()
assets=ROOT/'assets';manifest=json.loads((assets/'manifest.json').read_text());scene=bpy.context.scene
groups={}
for o in scene.objects:
    if o.type=='MESH' and o.get('stage03Group'):groups.setdefault(o['stage03Group'],[]).append(o)
assert groups, 'Build must persist stage03Group metadata'
occluders=[o for g,oo in groups.items() if not g.startswith('module-') and g!='collision' for o in oo]
verts=[];faces=[]
for o in occluders:
    start=len(verts);verts.extend([v.co.copy() for v in o.data.vertices]);faces.extend([tuple(start+i for i in p.vertices) for p in o.data.polygons])
bvh=BVHTree.FromPolygons(verts,faces)
for o in occluders:
    colors=o.data.color_attributes.new(name='BakedAO',type='FLOAT_COLOR',domain='POINT')
    o.data.color_attributes.active_color=colors
    for v in o.data.vertices:
        normal=v.normal.normalized();normal=normal if normal.length>.1 else Vector((0,0,1))
        origin=v.co+normal*.035;hits=0
        for d in [normal,(normal+Vector((.57,.31,.61))).normalized(),(normal+Vector((-.41,-.55,.70))).normalized()]:
            hit=bvh.ray_cast(origin,d,2.2)
            if hit[0] is not None:hits+=1
        shade=1-.13*hits;colors.data[v.index].color=(shade,shade,shade,1)
    print('AO',o.name,flush=True)
def export(id,oo):
    bpy.ops.object.select_all(action='DESELECT')
    for o in oo:o.select_set(True)
    bpy.context.view_layer.objects.active=oo[0]
    path=assets/(id+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    return dict(id=id,url=path.name,triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in oo),bytes=path.stat().st_size)
for chunk in manifest['chunks']:
    oo=groups[chunk['id']];chunk.update(export(chunk['id'],oo))
    # Architecture has authored reduced meshes. Shell and walls remain static silhouette layers.
    if chunk['id']=='shell' or chunk['id'].startswith('wall-'):continue
    chunk['lods']=[]
    for level,ratio,distance in [(1,.26,35),(2,.09,75)]:
        copies=[]
        for source in oo:
            # Remove small secondary detail rather than punch holes in disconnected masonry.
            if any(k in source.name for k in ['_iron','_gold','_Exposed_Joinery','Subtle_Usage']):continue
            if level==2 and source.name.startswith('LF3_') and not any(k in source.name for k in ['Fountain','Guardian','Warp','Crystal','Quest']):continue
            o=bpy.data.objects.new(source.name+'_LOD'+str(level),source.data.copy());scene.collection.objects.link(o);copies.append(o)
            bpy.context.view_layer.objects.active=o;o.select_set(True)
            if len(o.data.polygons)>40 and not source.name.startswith(('LF2_','S03_')):
                m=o.modifiers.new('SilhouetteLOD','DECIMATE');m.ratio=ratio;bpy.ops.object.modifier_apply(modifier=m.name)
            o.data.validate(clean_customdata=False)
            o.select_set(False)
        item=export(chunk['id']+'-lod'+str(level),copies);item['distance']=distance;chunk['lods'].append(item)
        for o in copies:bpy.data.objects.remove(o,do_unlink=True)
manifest['textures']={f:dict(color='textures/'+f+'-color.png',normal='textures/'+f+'-normal.png',orm='textures/shared-orm.png') for f in ['stone','paving','wood','plaster','blue','red']}
manifest['ambientOcclusion']=dict(method='Static vertex AO: 3 hemisphere BVH rays, 2.2 game units; local bake, not global illumination',vertices=sum(len(o.data.vertices) for o in occluders),sourceHash=manifest['sourceSha256'])
manifest['payloadFiles']=[a['url'] for a in manifest['chunks']]+[a['url'] for c in manifest['chunks'] for a in c.get('lods',[])]+[a['url'] for a in manifest['modules']]+[manifest['collision']['url']]+sorted({v for t in manifest['textures'].values() for v in t.values()})
manifest['payloadBytes']=sum((assets/f).stat().st_size for f in manifest['payloadFiles'])
(assets/'manifest.json').write_text(json.dumps(manifest,indent=2))
# Connect the same external texture maps to the working Blender derivative, after GLB export.
for f,files in manifest['textures'].items():
    mat=bpy.data.materials.get('S03_'+f);bs=mat.node_tree.nodes.get('Principled BSDF')
    for kind,filename in files.items():
        image=bpy.data.images.load(str(assets/filename),check_existing=True)
        if kind!='color':image.colorspace_settings.name='Non-Color'
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        if kind=='color':mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
        elif kind=='normal':
            n=mat.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.45;mat.node_tree.links.new(node.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],bs.inputs['Normal'])
        else:
            n=mat.node_tree.nodes.new('ShaderNodeSeparateColor');mat.node_tree.links.new(node.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Green'],bs.inputs['Roughness'])
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/LUMENFALL_Stage03_Runtime_Working.blend'))
print('FINALIZED',manifest['payloadBytes'],flush=True)
