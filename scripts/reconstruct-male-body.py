"""Reconstruct a separate adult male from the supplied female topology in Blender.
Never changes the female source, existing game assets, saves, or a user's open scene.
"""
import bpy,bmesh,math,os,json
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK=os.path.join(ROOT,'work','male-reconstruction');os.makedirs(WORK,exist_ok=True)
OUT=os.path.join(ROOT,'exports','characters','male-reconstructed');os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'work','female-character','female-rpg-rigged.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['FemaleRig'];rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(0)
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
body=bpy.data.objects['Body_LP_body_0'];head=bpy.data.objects['Body_LP_head_0']
original_body=[v.co.copy() for v in body.data.vertices]

def smooth(a,b,t):
    t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def gauss(v,c,w):return math.exp(-((v-c)/w)**2)
def profile(z,keys):
    if z<=keys[0][0]:return keys[0][1]
    for (a,x),(b,y)in zip(keys,keys[1:]):
        if z<=b:return x+(y-x)*smooth(a,b,z)
    return keys[-1][1]
def torso(v):
    x,y,z=v;ax=abs(x)
    sx=profile(z,[(.85,.97),(1.00,.83),(1.12,.79),(1.25,1.02),(1.38,1.22),(1.51,1.32),(1.64,1.37),(1.72,1.25),(1.80,1.25)])
    xx=x*sx
    yy=y*profile(z,[(.85,1),(1.05,.73),(1.16,.80),(1.3,1.07),(1.5,1.05),(1.68,1.06),(1.8,1.16)])
    # Rebuild front ribcage: eliminate breast projection and replace it with
    # broad shallow pectorals, a sternum, and a straight abdominal plane.
    chest=smooth(1.34,1.425,z)*(1-smooth(1.62,1.71,z))
    front=smooth(.008,.04,-y)
    radius=profile(z,[(1.37,.17),(1.47,.207),(1.56,.22),(1.67,.20)])
    section=max(0,1-(abs(xx)/radius)**4)**.5
    pec=.026*gauss(abs(xx),.105,.070)*gauss(z,1.535,.077)
    sternum=.008*gauss(xx,0,.025)
    target=-.100*section-pec+sternum
    yy=yy*(1-chest*front)+target*chest*front
    abs_zone=smooth(1.18,1.25,z)*(1-smooth(1.42,1.48,z))*front
    # Actual small muscle volumes, not added primitive objects.
    abs_bulge=sum(.005*gauss(abs(xx),.049,.032)*gauss(z,c,.035)for c in [1.28,1.35,1.42])
    yy-=abs_zone*abs_bulge
    # Thicker trapezius/neck; lower pelvic projection softened.
    return Vector((xx,yy,z))
def arm(v,side):
    x,y,z=v;sign=1 if side=='L' else -1
    cx=profile(z,[(1.05,.453),(1.19,.425),(1.405,.305),(1.63,.18),(1.70,.14)])*sign
    cy=profile(z,[(1.05,.008),(1.19,.008),(1.405,.005),(1.63,0),(1.7,0)])
    width=profile(z,[(1.05,1.12),(1.19,1.10),(1.30,1.24),(1.405,1.13),(1.50,1.30),(1.63,1.26),(1.70,1.15)])
    shift=profile(z,[(1.05,.087),(1.19,.086),(1.405,.081),(1.63,.068),(1.7,.05)])*sign
    return Vector((cx+(x-cx)*width+shift,cy+(y-cy)*width,z))
def leg(v,side):
    x,y,z=v;sign=1 if side=='L'else -1
    cx=profile(z,[(0,.205),(.1,.205),(.615,.16),(1.12,.135)])*sign
    cy=profile(z,[(0,-.05),(.1,.005),(.615,-.015),(1.12,.025)])
    width=profile(z,[(0,1.10),(.13,1.1),(.35,1.13),(.59,1.03),(.76,.98),(.98,.92),(1.15,.90)])
    shift=profile(z,[(0,-.018),(.6,-.013),(1.12,-.025)])*sign
    xx=cx+(x-cx)*width+shift;yy=cy+(y-cy)*width
    yy-=.012*gauss(z,.88,.13)*smooth(0,.08,-y)
    return Vector((xx,yy,z))
def head_shape(v):
    x,y,z=v
    jaw=gauss(z,1.82,.06);brow=gauss(z,1.952,.027)
    xx=x*(1.11+.20*jaw)
    yy=y*(1+.075*jaw)
    yy-=.010*gauss(x,0,.044)*gauss(z,1.785,.03)*smooth(.02,.07,-y)
    yy-=.006*brow*smooth(.015,.055,abs(x))*smooth(.015,.06,-y)
    zz=1.901+(z-1.901)*(.92 if 1.877<z<1.925 else 1)
    # A wider nose and less full lips; the original topology stays connected.
    xx+=x*.12*gauss(z,1.87,.04)*gauss(x,0,.035)
    yy+=.007*gauss(z,1.823,.019)*gauss(x,0,.044)*smooth(.04,.09,-y)
    return Vector((xx,yy,zz))

# Soft region masks use the existing skin weights, keeping the shoulder/hip seams continuous.
names={g.index:g.name for g in body.vertex_groups}
for v in body.data.vertices:
    weights={'armL':0,'armR':0,'legL':0,'legR':0,'head':0}
    for g in v.groups:
        name=names[g.group]
        for side in ['L','R']:
            if name in [p+'.'+side for p in ['UpperArm','LowerArm','Hand']]:weights['arm'+side]+=g.weight
            if name in [p+'.'+side for p in ['Thigh','Shin','Foot']]:weights['leg'+side]+=g.weight
        if name in ['Head','Neck']:weights['head']+=g.weight
    base=v.co.copy();total=sum(weights.values());result=torso(base)*max(0,1-total)
    for side in ['L','R']:result+=arm(base,side)*weights['arm'+side]+leg(base,side)*weights['leg'+side]
    result+=head_shape(base)*weights['head'];v.co=result
body.data.update()
# Redistribute the old breast loops across the flatter chest. Moving only their
# depth leaves folded rows near the outer pectoral, despite a flatter silhouette.
neighbors=[set() for _ in body.data.vertices]
for edge in body.data.edges:
    a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
for iteration in range(24):
    coords=[v.co.copy() for v in body.data.vertices]
    for v in body.data.vertices:
        x,y,z=coords[v.index]
        mask=smooth(1.33,1.40,z)*(1-smooth(1.62,1.70,z))*(1-smooth(.19,.26,abs(x)))*smooth(.01,.055,-y)
        if mask>0 and neighbors[v.index]:
            average=sum((coords[n] for n in neighbors[v.index]),Vector())/len(neighbors[v.index])
            v.co=coords[v.index].lerp(average,.48*mask)
    # Restore ribcage volume after relaxing the loops, rather than allowing
    # repeated Laplacian smoothing to collapse the front surface inward.
    for v in body.data.vertices:
        x,y,z=v.co
        mask=smooth(1.33,1.40,z)*(1-smooth(1.62,1.70,z))*smooth(.01,.055,-y)
        radius=profile(z,[(1.37,.17),(1.47,.207),(1.56,.22),(1.67,.20)])
        section=max(0,1-(abs(x)/radius)**4)**.5
        target=-.100*section-.026*gauss(abs(x),.105,.070)*gauss(z,1.535,.077)+.008*gauss(x,0,.025)
        if abs(x)<radius:v.co.y=y+(target-y)*mask
body.data.update()
for obj in list(bpy.data.objects):
    if obj==body or obj.type!='MESH':continue
    if obj.name.startswith('collar') or obj.name.startswith('Body_LP.002'):
        # Remove the choker and eyelash-strip objects from this derivative only.
        bpy.data.objects.remove(obj,do_unlink=True);continue
    if obj==head or obj.name.startswith('eyes'):
        for v in obj.data.vertices:v.co=head_shape(v.co)
    elif obj.name.startswith('Hair_'):
        for v in obj.data.vertices:
            v.co.x*=1.11
            # Keep the scalp shell fitted; shorten only the overhanging front fringe.
            if v.co.z<1.90 and v.co.y<-.065:v.co.z=1.90+(v.co.z-1.90)*.80
    obj.data.update()

# Imported split normals still describe the female chest and face. Regenerate
# them from the rebuilt geometry; otherwise their old shading reads as seams.
for obj in [body,head]:
    if obj.data.has_custom_normals:
        obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    obj.data.update()

# Widen and reposition the existing skeleton to the reconstructed anatomy.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:
    name=bone.name
    fn=torso
    if name.startswith(('UpperArm','LowerArm','Hand')):fn=lambda v,side=name[-1]:arm(v,side)
    elif name.startswith(('Thigh','Shin','Foot')):fn=lambda v,side=name[-1]:leg(v,side)
    elif name in ['Head','Neck']:fn=head_shape
    if name!='Root':bone.head=fn(bone.head);bone.tail=fn(bone.tail)
for side in ['L','R']:
    rig.data.edit_bones['Shoulder.'+side].tail=rig.data.edit_bones['UpperArm.'+side].head
bpy.ops.object.mode_set(mode='OBJECT')
rig.name='MaleReconstructedRig';rig.data.name='MaleReconstructedSkeleton'
rig['assetKind']='male-reconstructed';rig['assetVersion']='male-reconstruction-01'
rig['modification']='Adult male anatomy reconstructed from Female Body base for rpg; new skin and shorts, shortened hair.'

def skin_material(name,color):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.52;bsdf.inputs['Subsurface Weight'].default_value=.07
    bsdf.inputs['Base Color'].default_value=(*color,1)
    return mat
body.data.materials.clear();body.data.materials.append(skin_material('Male_Skin_Body',(.52,.285,.185)))
head.data.materials.clear();head.data.materials.append(skin_material('Male_Skin_Face',(.52,.285,.185)))
# Portable vertex skin colors avoid inherited clothing/makeup and out-of-tile UV
# artifacts on the fingers. Original UVs remain available for later texture painting.
for obj in [body,head]:
    colors=obj.data.color_attributes.new(name='MaleSkinColor',type='FLOAT_COLOR',domain='CORNER')
    for loop in obj.data.loops:
        x,y,z=obj.data.vertices[loop.vertex_index].co
        base=Vector((.52,.285,.185))*(1+.016*math.sin(z*14+x*11))
        if obj==head:
            lip=gauss(z,1.824,.012)*gauss(x,0,.037)*smooth(.065,.090,-y)*.48
            base=base.lerp(Vector((.39,.16,.12)),lip)
        colors.data[loop.index].color=(*base,1)
    mat=obj.data.materials[0];node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name=colors.name
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Replace the female chest/underwear shading rather than keeping it on the rebuilt torso.
# Short fitted cloth is a separate skinned shell made from this same body's topology.
shorts=body.copy();shorts.data=body.data.copy();shorts.name='Male_Shorts';bpy.context.collection.objects.link(shorts)
for colors in list(shorts.data.color_attributes):shorts.data.color_attributes.remove(colors)
bm=bmesh.new();bm.from_mesh(shorts.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if abs(v.co.x)>.31 and v.co.z>1.04],context='VERTS')
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,1.22),plane_no=(0,0,1),clear_outer=True)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,.91),plane_no=(0,0,1),clear_inner=True)
bm.normal_update()
for v in bm.verts:v.co+=v.normal*.007
bm.to_mesh(shorts.data);bm.free();shorts.data.update()
cloth=bpy.data.materials.new('Male_Shorts_Cloth');cloth.diffuse_color=(.047,.038,.028,1);cloth.use_nodes=True
cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.047,.038,.028,1)
cloth.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.88
shorts.data.materials.clear();shorts.data.materials.append(cloth)
solid=shorts.modifiers.new('Cloth hem thickness','SOLIDIFY');solid.thickness=.004

# Real geometry eyebrows follow the face surface. No painted eyeliner/lipstick remains.
bvh=BVHTree.FromPolygons([v.co for v in head.data.vertices],[list(p.vertices)for p in head.data.polygons])
for side in [-1,1]:
    curve=bpy.data.curves.new('Male_Eyebrow','CURVE');curve.dimensions='3D';curve.bevel_depth=.0028;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(3)
    for p,(x,z)in zip(spline.bezier_points,[(.021,1.943),(.042,1.951),(.066,1.948),(.080,1.938)]):
        hit=bvh.ray_cast(Vector((x*side,-1,z)),Vector((0,1,0)))
        p.co=Vector((x*side,(hit[0].y if hit[0] else -.07)-.002,z));p.handle_left_type=p.handle_right_type='AUTO'
    eyebrow=bpy.data.objects.new('Male_Eyebrow_'+str(side),curve);bpy.context.collection.objects.link(eyebrow)
    browmat=bpy.data.materials.get('Male_Brow') or bpy.data.materials.new('Male_Brow');browmat.use_nodes=True;browmat.diffuse_color=(.026,.013,.008,1)
    browmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.026,.013,.008,1)
    browmat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78;curve.materials.append(browmat)
    bpy.ops.object.select_all(action='DESELECT');eyebrow.select_set(True);bpy.context.view_layer.objects.active=eyebrow;bpy.ops.object.convert(target='MESH')
    eyebrow=bpy.context.object;eyebrow.vertex_groups.new(name='Head').add(list(range(len(eyebrow.data.vertices))),1,'REPLACE')
    eyebrow.parent=rig;mod=eyebrow.modifiers.new('Head skin','ARMATURE');mod.object=rig

# Smooth reconstructed surfaces at an editable subdivision level, preserving source UVs.
for obj in [body,head,shorts]:
    for poly in obj.data.polygons:poly.use_smooth=True
    sub=obj.modifiers.new('Reconstructed surface smoothing','SUBSURF');sub.levels=1;sub.render_levels=1
    # Evaluate before armature deformation for a predictable bind mesh.
    bpy.context.view_layer.objects.active=obj
    while obj.modifiers.find(sub.name)>0:bpy.ops.object.modifier_move_up(modifier=sub.name)

# Vertex colors export directly to GLB; surface form is the reconstructed mesh.
scene.render.engine='CYCLES';scene.cycles.samples=16

# Set a neutral standing pose for saved project / default export. Retain existing actions separately.
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
scene.camera.data.ortho_scale=2.55;scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.world.color=(.17,.17,.17)
for obj in bpy.data.objects:
    if obj.type=='LIGHT':obj.data.energy*=1.35
def render(name,pos):
    scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(WORK,name+'.png');bpy.ops.render.render(write_still=True)
render('male-front',(0,-5,1.08));render('male-side',(5,0,1.08));render('male-three-quarter',(3,-5,2.2));render('male-back',(0,5,1.08))

# Save editable source with modifiers; export a separate copy with smooth geometry applied.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
scene.camera.location=(3,-5,2.2);scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
blendpath=os.path.join(OUT,'male-reconstructed.blend');bpy.ops.wm.save_as_mainfile(filepath=blendpath)
for obj in list(bpy.data.objects):
    if obj.type!='MESH':continue
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):
        if mod.type!='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
exported=[o for o in bpy.data.objects if o==rig or o.type=='MESH' or o.parent==rig]
bpy.ops.object.select_all(action='DESELECT')
for obj in exported:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
glbpath=os.path.join(OUT,'male-reconstructed.glb')
bpy.ops.export_scene.gltf(filepath=glbpath,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_rest_position_armature=True,export_extras=True)
triangles=sum(len(p.vertices)-2 for o in exported if o.type=='MESH' for p in o.data.polygons)
with open(os.path.join(WORK,'report.json'),'w')as f:json.dump({'source':'female_body_base_for_rpg.glb','blend':blendpath,'glb':glbpath,'triangles':triangles,'bones':len(rig.data.bones),'maleBodyVertices':len(body.data.vertices),'separateFromGame':True},f,indent=2)
print('MALE_RECONSTRUCTED',blendpath,glbpath,triangles,flush=True)
