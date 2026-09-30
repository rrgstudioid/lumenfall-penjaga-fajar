"""Build deterministic lightweight derivatives in an isolated Blender process.
Input is the selected staging copy produced by build-modular-male-character.py.
No source asset is overwritten. Exported candidates require browser visual QA.
"""
import bpy, bmesh, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]; WORK=ROOT/'work/modular-male'
OUT=ROOT/'public/assets/characters/male-v2'
for folder in ['body','hair','textures','thumbnails','animations']:(OUT/folder).mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(WORK/'selected-source.blend'),load_ui=False,use_scripts=False)
source=bpy.data.objects['MaleV2_SelectedSource']; scene=bpy.context.scene
scene.cycles.samples=4
base=next(n.image for n in source.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'base' in n.image.name.lower())
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(base.size[1],base.size[0],4)
uv=source.data.uv_layers.active.data
# Weld UV seams for semantic connectivity; loop UVs remain intact.
bm=bmesh.new();bm.from_mesh(source.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.to_mesh(source.data);bm.free();source.data.update()
uv=source.data.uv_layers.active.data
colors=[]; hairfaces=[]
for p in source.data.polygons:
    t=uv[p.loop_indices[0]].uv; c=pixels[int(t.y*base.size[1])%base.size[1],int(t.x*base.size[0])%base.size[0],:3]
    x,y,z=p.center; r,g,b=c
    brown=r<.72 and r>g*1.30 and b<.40
    face_protected=abs(x)<.165 and y<.035 and z<1.735
    hair=z>1.86 or (brown and not face_protected and (z>1.50 or (y>.035 and z>1.41)))
    colors.append(c); hairfaces.append(hair)

# Keep only brown regions connected to the crown. Dark eyes, brows, and leather
# can have similar colors but are separate surface regions, not hair.
neighbors=[[] for _ in source.data.vertices]
for p in source.data.polygons:
    if hairfaces[p.index]:
        for vi in p.vertices:neighbors[vi].append(p.index)
seeds=[p.index for p in source.data.polygons if hairfaces[p.index] and p.center.z>1.82]
connected=set(seeds);queue=list(seeds)
while queue:
    i=queue.pop()
    for vi in source.data.polygons[i].vertices:
        for j in neighbors[vi]:
            if j not in connected:connected.add(j);queue.append(j)
hairfaces=[p.index in connected for p in source.data.polygons]

def select(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
def subset(name,keep):
    o=source.copy();o.data=source.data.copy();scene.collection.objects.link(o);o.name=name
    bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for i,f in enumerate(bm.faces) if not keep[i]],context='FACES')
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.to_mesh(o.data);bm.free();o.data.update()
    return o
hair=subset('Hair_01',[bool(v) for v in hairfaces]);body=subset('Body',[not v for v in hairfaces])
source.hide_render=True;source.hide_set(True)

def simple_material(name,color):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.8
    mat.diffuse_color=(*color,1);return mat

# The crew-cut reference is the same source character with a complete forehead.
# Reuse that clean head surface instead of inventing the hidden face under bangs.
with bpy.data.libraries.load(str(WORK/'reference-heads.blend'),link=False) as (src,dst):
    dst.objects=['ReferenceHead_02']
clean_head=dst.objects[0];scene.collection.objects.link(clean_head)
a,b=json.loads((WORK/'reference-heads.json').read_text())[1]['skinBounds']
origin=Vector(((a[0]+b[0])/2,a[1],a[2]))
for v in clean_head.data.vertices:v.co=(v.co-origin)*5.5+Vector((0,-.1895,1.4311))
bm=bmesh.new();bm.from_mesh(clean_head.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.34],context='VERTS');bm.to_mesh(clean_head.data);bm.free()
# Reconstruct a bald cranium. Preserve the reference face/ears, but replace the
# crew-cut silhouette with a smooth anatomical surface and skin over the ENTIRE
# scalp (crown, temples and occiput), not just a Z-based paint band.
def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
center=Vector((0,.025,1.642));radii=Vector((.183,.207,.211))
scalp_weights=[]
scalp_paint=[]
for v in clean_head.data.vertices:
    x,y,z=v.co
    weight=max(smoothstep(1.625,1.735,z),
        smoothstep(-.03,.07,y)*smoothstep(1.575,1.64,z),
        smoothstep(.10,.17,y)*smoothstep(1.395,1.485,z))
    # Above the ear the temples belong to the skull; the protruding ear itself
    # remains untouched below 1.59 m.
    weight=max(weight,smoothstep(.115,.175,abs(x))*smoothstep(1.59,1.675,z))
    delta=v.co-center
    local=Vector((delta.x/radii.x,delta.y/radii.y,delta.z/radii.z))
    if local.length:
        local.normalize();target=center+Vector((local.x*radii.x,local.y*radii.y,local.z*radii.z))
        v.co=v.co.lerp(target,weight)
    scalp_weights.append(weight)
    # Pigment cleanup is wider than the geometry blend. A geometric transition
    # must not leave the original dark crew-cut texture at its temples/hairline.
    angle=math.acos(max(-1,min(1,-math.sin(math.atan2(y-.025,x)))))
    knots=[(0,1.635),(.65,1.625),(.95,1.55),(1.2,1.55),(1.5,1.575),(1.7,1.55),(2,1.415),(math.pi,1.395)]
    edge=knots[-1][1]
    for (a,h),(b,k) in zip(knots,knots[1:]):
        if angle<=b:
            edge=h+(k-h)*smoothstep(a,b,angle);break
    scalp_paint.append(max(weight,smoothstep(edge-.012,edge+.005,z)))
clean_head.data.update()
blend=clean_head.data.color_attributes.new(name='BaldScalp',type='FLOAT_COLOR',domain='CORNER')
for loop in clean_head.data.loops:
    w=scalp_paint[loop.vertex_index];blend.data[loop.index].color=(w,w,w,1)
for p in clean_head.data.polygons:p.use_smooth=True
headmat=clean_head.data.materials[0].copy();headmat.name='CleanHead';clean_head.data.materials[0]=headmat
ns=headmat.node_tree.nodes;ls=headmat.node_tree.links
bsdf=next(n for n in ns if n.type=='BSDF_PRINCIPLED');original=bsdf.inputs['Base Color'].links[0].from_socket
for link in list(bsdf.inputs['Normal'].links):ls.remove(link)
attribute=ns.new('ShaderNodeVertexColor');attribute.layer_name='BaldScalp';mix=ns.new('ShaderNodeMixRGB')
ls.new(attribute.outputs['Color'],mix.inputs[0]);ls.new(original,mix.inputs[1])
mix.inputs[2].default_value=(.815,.319,.175,1);ls.new(mix.outputs[0],bsdf.inputs['Base Color'])
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>1.35],context='VERTS');bm.to_mesh(body.data);bm.free()
select(body);clean_head.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()

scalpMat=simple_material('ScalpSource',(.815,.319,.175))
# Closed neck sleeve bridges the head's authoring seam below the jaw.
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.078,radius2=.083,depth=.23,location=(0,.035,1.355))
neck=bpy.context.object;neck.data.materials.append(scalpMat)
select(neck);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()

# Rebuild the starter body/outfit in this isolated staging scene.
import runpy
body=runpy.run_path(str(ROOT/'scripts/starter-male-outfit.py'))['rebuild_starter_outfit'](body,scene,simple_material)

def decimate(o,target):
    select(o);n=sum(len(p.vertices)-2 for p in o.data.polygons)
    if n>target:
        mod=o.modifiers.new('BudgetReduction','DECIMATE');mod.ratio=target/n;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        n=sum(len(p.vertices)-2 for p in o.data.polygons)
        if n>target*1.02:
            mod=o.modifiers.new('BudgetReductionFinal','DECIMATE');mod.ratio=target/n;mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    return sum(len(p.vertices)-2 for p in o.data.polygons)

# Semantic skin mask is baked once, independent from the tint chosen by players.
def skin_mask(o):
    previous=o.data.color_attributes.get('SkinMask')
    if previous:o.data.color_attributes.remove(previous)
    attr=o.data.color_attributes.new(name='SkinMask',type='BYTE_COLOR',domain='CORNER')
    image_pixels={}
    for material in o.data.materials:
        image=next((n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'base' in n.image.name.lower()),None)
        if image:image_pixels[material.name]=(np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4),image.size[:])
    for p in o.data.polygons:
        material=o.data.materials[p.material_index];name=material.name
        for li in p.loop_indices:
            v=o.data.vertices[o.data.loops[li].vertex_index];x,y,z=v.co
            data,size=image_pixels.get(name,(pixels,base.size[:]))
            t=o.data.uv_layers.active.data[li].uv
            r,g,b=data[int(t.y*size[1])%size[1],int(t.x*size[0])%size[0],:3]
            if name.startswith(('ScalpSource','StarterSkin')):value=1.
            elif name.startswith('CleanHead'):
                value=1.
            else:
                value=0. # Authored cloth/pants/rope, never a brightness heuristic.
            # Separate semantic feature coverage from skin coverage. Feature
            # pigment is resolved per texel in the shader, avoiding coarse
            # per-vertex colour classifications that tear up eyes and brows.
            feature=float(name.startswith('CleanHead') and y<-.055 and .024<abs(x)<.175 and 1.475<z<1.654)
            attr.data[li].color=(value,feature,0,1)
    return attr
skin_mask(body)

def emission_mode(o,mask=False):
    # Copy source materials so toggling bake mode cannot modify other candidates.
    for i,mat in enumerate(o.data.materials):
        mat=mat.copy();o.data.materials[i]=mat;nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        emit=nodes.new('ShaderNodeEmission')
        if mask:
            color=nodes.new('ShaderNodeVertexColor');color.layer_name='SkinMask';links.new(color.outputs['Color'],emit.inputs['Color'])
        elif bsdf.inputs['Base Color'].is_linked:links.new(bsdf.inputs['Base Color'].links[0].from_socket,emit.inputs['Color'])
        else:emit.inputs['Color'].default_value=bsdf.inputs['Base Color'].default_value
        links.new(emit.outputs[0],output.inputs['Surface'])

def bake_body():
    low=body.copy();low.data=body.data.copy();scene.collection.objects.link(low);low.name='MaleBody'
    low.data.validate(clean_customdata=True);low.data.update()
    decimate(low,24800)
    select(low);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT')
    low.data.materials.clear();mat=simple_material('MAT_Body',(.8,.8,.8));low.data.materials.append(mat)
    for p in low.data.polygons:p.material_index=0
    result={}
    for label,size,mask in [('basecolor',2048,False),('skin-mask',1024,True),('normal',2048,False)]:
        image=bpy.data.images.new('Body_'+label,width=size,height=size,alpha=False)
        if mask or label=='normal':image.colorspace_settings.name='Non-Color'
        nodes=mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image;nodes.active=tex
        if label=='normal':
            for source_material in body.data.materials:
                ns=source_material.node_tree.nodes
                source_material.node_tree.links.new(next(n for n in ns if n.type=='BSDF_PRINCIPLED').outputs[0],next(n for n in ns if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
        else:emission_mode(body,mask)
        select(body);low.select_set(True);bpy.context.view_layer.objects.active=low
        body.hide_render=False;low.hide_render=False
        scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.016;scene.render.bake.max_ray_distance=.035;scene.render.bake.margin=8
        bpy.ops.object.bake(type='NORMAL' if label=='normal' else 'EMIT')
        image.filepath_raw=str(OUT/'textures'/('body-'+label+'.png'));image.file_format='PNG';image.save()
        result[label]=image
    p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');color=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image==result['basecolor'])
    mat.node_tree.links.new(color.outputs['Color'],p.inputs['Base Color'])
    normal=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image==result['normal']);normalNode=mat.node_tree.nodes.new('ShaderNodeNormalMap')
    mat.node_tree.links.new(normal.outputs['Color'],normalNode.inputs['Color']);mat.node_tree.links.new(normalNode.outputs['Normal'],p.inputs['Normal'])
    # Export only the strict semantic region attribute. UV feature detail uses
    # the existing mask texture; unrelated authoring colours must not ship.
    for name in [attr.name for attr in low.data.color_attributes if attr.name!='SkinRegion']:
        low.data.color_attributes.remove(low.data.color_attributes[name])
    low.data.color_attributes.active_color=low.data.color_attributes['SkinRegion']
    assert len(low.data.uv_layers)>0, 'Removing authoring colors must preserve baked UVs'
    body.hide_render=True;body.hide_set(True)
    return low

low=bake_body()
# Geometry is smooth; the retained source normal is not baked twice into detail.
hairMat=simple_material('MAT_Hair',(.43,.245,.15))
hair.data.materials.clear();hair.data.materials.append(hairMat)
decimate(hair,4800)

# Canonical anatomical bones; no independent feather/strand or physics chains.
data=bpy.data.armatures.new('MaleV2Skeleton');rig=bpy.data.objects.new('MaleV2Rig',data);scene.collection.objects.link(rig)
select(rig);bpy.ops.object.mode_set(mode='EDIT')
positions={
 'root':((0,0,0),(0,0,.15),None),'pelvis':((0,.035,.78),(0,.025,.99),'root'),
 'spine_01':((0,.025,.99),(0,.020,1.18),'pelvis'),'spine_03':((0,.020,1.18),(0,.018,1.34),'spine_01'),
 'neck_01':((0,.018,1.34),(0,.015,1.46),'spine_03'),'head':((0,.015,1.46),(0,.015,1.87),'neck_01'),
}
for suffix,sign in [('l',1),('r',-1)]:
    def p(x,y,z):return(sign*x,y,z)
    positions.update({
      'clavicle_'+suffix:(p(.04,.02,1.31),p(.19,.02,1.29),'spine_03'),
      'upperarm_'+suffix:(p(.19,.02,1.29),p(.285,.005,1.045),'clavicle_'+suffix),
      'lowerarm_'+suffix:(p(.285,.005,1.045),p(.365,-.015,.84),'upperarm_'+suffix),
      'hand_'+suffix:(p(.365,-.015,.84),p(.38,-.02,.71),'lowerarm_'+suffix),
      'thigh_'+suffix:(p(.13,.035,.79),p(.17,.015,.46),'pelvis'),
      'calf_'+suffix:(p(.17,.015,.46),p(.185,.04,.17),'thigh_'+suffix),
      'foot_'+suffix:(p(.185,.04,.17),p(.19,-.19,.065),'calf_'+suffix),
    })
for name,(head,tail,parent) in positions.items():
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=data.edit_bones[parent]
    b.use_deform=name!='root'
bpy.ops.object.mode_set(mode='OBJECT')

# Deterministic anatomical distance weights prevent bone-heat failures on source seams.
segments={n:(Vector(h),Vector(t)) for n,(h,t,_) in positions.items() if n!='root'}
def bind(o,rigid=False):
    groups={n:o.vertex_groups.new(name=n) for n in segments}
    for v in o.data.vertices:
        x,y,z=v.co
        if rigid or z>1.46: choices=[('head',1.)]
        else:
            suffix='l' if x>0 else 'r'
            if z<.77 and abs(x)>.06:names=['thigh_'+suffix,'calf_'+suffix,'foot_'+suffix,'pelvis']
            elif abs(x)>.22 and .64<z<1.31:names=['upperarm_'+suffix,'lowerarm_'+suffix,'hand_'+suffix]
            else:names=['pelvis','spine_01','spine_03','neck_01','head']
            ds=[]
            for n in names:
                a,b=segments[n];d=b-a;t=max(0,min(1,(v.co-a).dot(d)/d.length_squared));distance=(v.co-(a+d*t)).length
                ds.append((n,distance))
            ds.sort(key=lambda e:e[1]);nearest=ds[0][1]
            weights=[(n,math.exp(-max(0,d-nearest)**2/.003)) for n,d in ds[:3]]
            total=sum(w for _,w in weights);choices=[(n,w/total) for n,w in weights if w/total>.015]
        total=sum(w for _,w in choices)
        for n,w in choices:groups[n].add([v.index],w/total,'REPLACE')
    mod=o.modifiers.new('MaleSkin','ARMATURE');mod.object=rig;o.parent=rig
# Heat weighting provides continuous transitions across shoulder/hip boundaries.
# Rigid skull attachment is restored explicitly after heat solve.
# Bind a watertight voxel proxy rather than asking bone heat to solve the open
# hair/scalp seams. Only its weights transfer back; runtime topology/UVs stay intact.
proxy=low.copy();proxy.data=low.data.copy();scene.collection.objects.link(proxy);proxy.name='WeightProxy';proxy.modifiers.clear();proxy.vertex_groups.clear()
select(proxy);proxy.data.remesh_voxel_size=.018;bpy.ops.object.voxel_remesh()
rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for v in proxy.data.vertices:
    if v.co.z>1.435:
        for group in proxy.vertex_groups:group.remove([v.index])
        proxy.vertex_groups['head'].add([v.index],1,'REPLACE')
missing=[v for v in proxy.data.vertices if sum(g.weight for g in v.groups)<.00001]
print('PROXY_UNWEIGHTED',len(missing),'of',len(proxy.data.vertices),flush=True)
# Detached belt/boot islands occasionally have no heat solution. Transfer only
# from the successfully solved body surface; reject a globally failed solve.
assert len(missing)<len(proxy.data.vertices)*.12,'Watertight proxy heat bind failed'
solved=KDTree(len(proxy.data.vertices)-len(missing));index=0
for v in proxy.data.vertices:
    if sum(g.weight for g in v.groups)>.00001:solved.insert(v.co,v.index);index+=1
solved.balance()
for v in missing:
    _,nearest,distance=solved.find(v.co)
    assert distance<.07,'Unweighted island too far from body'
    for weight in proxy.data.vertices[nearest].groups:proxy.vertex_groups[weight.group].add([v.index],weight.weight,'REPLACE')
tree=KDTree(len(proxy.data.vertices))
for v in proxy.data.vertices:tree.insert(v.co,v.index)
tree.balance()
for group in proxy.vertex_groups:low.vertex_groups.new(name=group.name)
for v in low.data.vertices:
    weights={}
    for _,i,d in tree.find_n(v.co,4):
        for g in proxy.data.vertices[i].groups:weights[g.group]=weights.get(g.group,0)+g.weight/max(.00001,d*d)
    selected=sorted(weights.items(),key=lambda p:-p[1])[:4];total=sum(w for _,w in selected)
    for index,w in selected:low.vertex_groups[index].add([v.index],w/total,'REPLACE')
low.parent=rig;arm=low.modifiers.new('MaleSkin','ARMATURE');arm.object=rig
bpy.data.objects.remove(proxy,do_unlink=True)
for v in low.data.vertices:
    if v.co.z>1.435:
        for group in low.vertex_groups:group.remove([v.index])
        low.vertex_groups['head'].add([v.index],1,'REPLACE')
unweighted=[v for v in low.data.vertices if sum(g.weight for g in v.groups)<.00001]
print('UNWEIGHTED',len(unweighted),[list(v.co) for v in unweighted[:8]],flush=True)
assert not unweighted,'Heat bind produced unweighted vertices outside rigid skull'
select(low);bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bind(hair,True)
for name,bone,point in [('HeadSocket','head',(0,.015,1.72)),('WeaponSocketR','hand_r',(-.38,-.05,.765)),('WeaponSocketL','hand_l',(.38,-.05,.765)),('BackSocket','spine_03',(0,.15,1.20))]:
    socket=bpy.data.objects.new(name,None);scene.collection.objects.link(socket);socket.parent=rig;socket.parent_type='BONE';socket.parent_bone=bone
    bpy.context.view_layer.update();socket.matrix_world=Matrix.Translation(Vector(point))

def export(o,path):
    select(rig);o.select_set(True)
    for child in rig.children:
        if child.type=='EMPTY':child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_extras=True,export_vertex_color='NAME' if o.data.color_attributes.get('SkinRegion') else 'NONE',export_vertex_color_name='SkinRegion',export_all_vertex_colors=False)

report={'body':[],'hair':[],'joints':len(data.bones),'sourceSHA256':json.loads((WORK/'source-audit.json').read_text())['sourceSHA256']}
for kind,o,targets in [('body',low,[24800,13500,5700,1700]),('hair',hair,[4800,2800,1400,550])]:
    for lod,target in enumerate(targets):
        copy=o.copy();copy.data=o.data.copy();scene.collection.objects.link(copy);copy.name=o.name
        copy.data.validate(clean_customdata=True);copy.data.update()
        if kind=='body' and lod==3:
            # Weld atlas seams only within the same semantic region. Never join
            # cloth to skin: interpolated region tags would leak tint at seams.
            bm=bmesh.new();bm.from_mesh(copy.data)
            region=bm.loops.layers.color.get('SkinRegion')
            for skin in (False,True):
                verts=[v for v in bm.verts if v.link_loops and all((loop[region][0]>.5)==skin for loop in v.link_loops)]
                bmesh.ops.remove_doubles(bm,verts=verts,dist=.00001)
            bm.to_mesh(copy.data);bm.free();copy.data.update()
        n=decimate(copy,target)
        path=OUT/kind/('body-lod%d.glb'%lod if kind=='body' else 'hair_01-lod%d.glb'%lod)
        export(copy,path);report[kind].append({'lod':lod,'triangles':n,'bytes':path.stat().st_size})
        bpy.data.objects.remove(copy,do_unlink=True)
(WORK/'derivative-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'male-v2-master.blend'))
print('MALE_BUILD',json.dumps(report),flush=True)
