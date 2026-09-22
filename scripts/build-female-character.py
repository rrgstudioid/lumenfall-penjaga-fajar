"""Rig the supplied female asset in Blender; preserve its surface/UVs/textures.
Retarget the already-working Lumenfall locomotion and combat without editing male assets.
"""
import bpy,bmesh,os,math,json
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets','characters','female-rpg');os.makedirs(OUT,exist_ok=True)
WORK=os.path.join(ROOT,'work','female-character');os.makedirs(WORK,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=r'C:\Users\USER\Downloads\female_body_base_for_rpg.glb')
female_objects=set(bpy.data.objects);meshes=[o for o in female_objects if o.type=='MESH']
rotate=Matrix.Rotation(math.pi,4,'Z')
for obj in meshes:
    matrix=rotate@obj.matrix_world
    obj.parent=None;obj.matrix_world=Matrix.Identity(4);obj.data.transform(matrix)
    # Weld duplicate UV seam vertices before automatic bone heat; UV loop data stays intact.
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(obj.data);bm.free();obj.data.update()
for obj in female_objects:
    if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)

# Use the existing animation skeleton as the retarget source only.
old=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public','assets','characters','male-revision-02','male-revision-02-dual-sword.glb'))
source_objects=set(bpy.data.objects)-old;source=next(o for o in source_objects if o.type=='ARMATURE')
source.animation_data.action=None
for t in source.animation_data.nla_tracks:t.mute=True
for p in source.pose.bones:p.matrix_basis=Matrix.Identity(4)
clips={a.name:a for a in bpy.data.actions if a.name in ['Walk','DualSword_Attack_01','DualSword_Attack_02','DualSword_Attack_03']}
old=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public','assets','animations','army-running','army-running-revision02.glb'))
run_objects=set(bpy.data.objects)-old;run_arm=next(o for o in run_objects if o.type=='ARMATURE')
run=run_arm.animation_data.action or run_arm.animation_data.nla_tracks[0].strips[0].action
clips['Run']=run
for obj in run_objects:bpy.data.objects.remove(obj,do_unlink=True)

data=bpy.data.armatures.new('FemaleRPGSkeleton');rig=bpy.data.objects.new('FemaleRig',data);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
positions={
 'Root':((0,0,0),(0,0,.15),None),
 'Hips':((0,0,1.11),(0,0,1.29),'Root'),
 'Spine':((0,0,1.29),(0,0,1.47),'Hips'),
 'Chest':((0,0,1.47),(0,0,1.67),'Spine'),
 'Neck':((0,0,1.67),(0,0,1.78),'Chest'),
 'Head':((0,0,1.78),(0,0,2.04),'Neck'),
}
for side,sign in [('L',1),('R',-1)]:
    def p(x,y,z):return (x*sign,y,z)
    positions.update({
      'Shoulder.'+side:(p(.035,0,1.665),p(.18,0,1.63),'Chest'),
      'UpperArm.'+side:(p(.18,0,1.63),p(.305,.005,1.405),'Shoulder.'+side),
      'LowerArm.'+side:(p(.305,.005,1.405),p(.425,.008,1.19),'UpperArm.'+side),
      'Hand.'+side:(p(.425,.008,1.19),p(.453,.008,1.09),'LowerArm.'+side),
      'Thigh.'+side:(p(.135,.025,1.12),p(.16,-.015,.615),'Hips'),
      'Shin.'+side:(p(.16,-.015,.615),p(.205,.005,.10),'Thigh.'+side),
      'Foot.'+side:(p(.205,.005,.10),p(.21,-.16,.035),'Shin.'+side),
    })
for name,(head,tail,parent) in positions.items():
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=data.edit_bones[parent]
    if name in source.data.bones:b.align_roll(source.data.bones[name].matrix_local.to_3x3()@Vector((0,0,1)))
    b.use_deform=name!='Root'
bpy.ops.object.mode_set(mode='OBJECT')

# Heat bind the continuous body; head/eyes/hair retain rigid skull attachment.
body=next(o for o in meshes if o.name=='Body_LP_body_0')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert len(body.vertex_groups)>10,'Automatic weights failed'
assert all(sum(g.weight for g in v.groups)>.001 for v in body.data.vertices),'Unweighted body vertices'
for obj in meshes:
    if obj==body:continue
    group=obj.vertex_groups.new(name='Neck' if obj.name.startswith('collar') else 'Head');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('FemaleSkin','ARMATURE');mod.object=rig;obj.parent=rig

# Keep sockets and rest orientations in the same game convention, but fit to the female palms.
for name,bone,point in [('WeaponSocket.L','Hand.L',(.448,-.018,1.125)),('WeaponSocket.R','Hand.R',(-.448,-.018,1.125)),('BackSocket','Chest',(0,.12,1.50)),('HairSocket','Head',(0,0,1.98))]:
    socket=bpy.data.objects.new('Female_'+name,None);socket['finalSocketName']=name;bpy.context.collection.objects.link(socket)
    socket.parent=rig;socket.parent_type='BONE';socket.parent_bone=bone
    # Bone parenting origin uses the tail in Blender; matrix_world setter solves it.
    bpy.context.view_layer.update();socket.matrix_world=Matrix.Translation(Vector(point))

def depth(b):return 0 if not b.parent else depth(b.parent)+1
ordered=sorted(data.bones,key=depth)
corrections={}
for bone in ordered:
    src=source.data.bones[bone.name];sq=src.matrix_local.to_quaternion();tq=bone.matrix_local.to_quaternion()
    swing=(tq@Vector((0,1,0))).rotation_difference(sq@Vector((0,1,0)))
    corrections[bone.name]=sq.inverted()@swing@tq
    if bone.name in ['Root','Hips','Spine','Chest','Neck','Head']:corrections[bone.name]=sq.inverted()@tq
scale=(data.bones['Thigh.L'].length+data.bones['Shin.L'].length)/(source.data.bones['Thigh.L'].length+source.data.bones['Shin.L'].length)
source.animation_data_create();rig.animation_data_create();baked=[]
for name,clip in clips.items():
    source.animation_data.action=clip;source.animation_data.action_slot=clip.slots[0]
    start,end=clip.frame_range;frames=int(round(end));start=0;poses=[]
    for i in range(frames+1):
        bpy.context.scene.frame_set(math.floor(start+i),subframe=(start+i)%1)
        bpy.context.view_layer.update()
        for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
        for bone in ordered:
            pb=rig.pose.bones[bone.name];sp=source.pose.bones[bone.name]
            desired=sp.matrix.to_quaternion()@corrections[bone.name]
            parent=pb.parent.matrix@pb.parent.bone.matrix_local.inverted() if pb.parent else Matrix.Identity(4)
            frame=parent@bone.matrix_local
            pb.rotation_mode='QUATERNION';pb.rotation_quaternion=frame.to_quaternion().inverted()@desired
            if bone.name=='Hips':
                delta=sp.matrix.translation-source.data.bones['Hips'].matrix_local.translation
                pb.location=frame.to_3x3().inverted()@(delta*scale)
            bpy.context.view_layer.update()
        if name=='Run':
            dg=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(dg);mesh=evaluated.to_mesh()
            lowest=min((evaluated.matrix_world@v.co).z for v in mesh.vertices);evaluated.to_mesh_clear()
            with open(os.path.join(ROOT,'work','army-running','retarget-report.json'))as file:ground=json.load(file)['ground']
            flight=ground[min(i,50)]['flight'];adjust=-.00538957+flight-lowest
            pb=rig.pose.bones['Hips'];frame=(pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local).to_3x3()
            pb.location+=frame.inverted()@Vector((0,0,adjust));bpy.context.view_layer.update()
        poses.append({p.name:(p.rotation_quaternion.copy(),p.location.copy())for p in rig.pose.bones})
    action=bpy.data.actions.new('Female_'+name);rig.animation_data.action=action;rig.animation_data.action_slot=action.slots.new('OBJECT',rig.name)
    if name in ['Walk','Run']:poses[-1]=poses[0]
    for i,pose in enumerate(poses):
        for bone,(q,location)in pose.items():
            pb=rig.pose.bones[bone];pb.rotation_quaternion=q;pb.location=location
            pb.keyframe_insert('rotation_quaternion',frame=i,group=bone)
            if bone=='Hips':pb.keyframe_insert('location',frame=i,group=bone)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    baked.append((name,action,frames));rig.animation_data.action=None

for obj in source_objects:bpy.data.objects.remove(obj,do_unlink=True)
for obj in bpy.data.objects:
    if 'finalSocketName' in obj:obj.name=obj['finalSocketName']
for name,action,frames in baked:
    track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);track.mute=True
for a in list(bpy.data.actions):
    if a not in [entry[1]for entry in baked]:bpy.data.actions.remove(a,do_unlink=True)
for obj in meshes:
    if obj.name.startswith('hair'):obj.name='Hair_'+obj.name
rig['assetKind']='female-rpg';rig['assetVersion']='female-rpg-01';rig['author']='Ilya.Anchouz.Danilov';rig['license']='CC-BY-4.0'
bpy.context.scene.frame_set(0)
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in meshes:obj.select_set(True)
for obj in bpy.data.objects:
    if obj.parent==rig:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
path=os.path.join(OUT,'female-rpg-rigged.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_rest_position_armature=True,export_extras=True)
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
print('FEMALE_EXPORT',path,os.path.getsize(path),flush=True)

# Save an editable project and frame it for opening in the user's Blender.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.world.color=(.18,.18,.18)
for pos,power in [((3,-4,5),500),((-3,-2,3),300),((0,4,4),450)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,2.4));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.5;scene.camera=camera
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
scene.render.filepath=os.path.join(WORK,'rigged-rest.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK,'female-rpg-rigged.blend'))
rig.animation_data.action=next(a for n,a,f in baked if n=='Run');rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(12)
scene.render.filepath=os.path.join(WORK,'rigged-run.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(WORK,'rig-report.json'),'w')as f:json.dump({'clips':[(n,frames)for n,a,frames in baked],'bones':len(data.bones),'bodyUnweighted':sum(not v.groups for v in body.data.vertices),'scale':scale},f,indent=2)
