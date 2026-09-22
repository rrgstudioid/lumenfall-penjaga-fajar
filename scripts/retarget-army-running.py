"""Blender-only motion bake. Source and existing game character files are read-only.

Retarget a verified 50-frame repeating segment of the supplied Mixamo rig to
Revision 02, retain the actual character bind skeleton, and export motion only.
"""
import bpy, math, os, json, statistics
from mathutils import Matrix, Quaternion, Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK=os.path.join(ROOT,'work','army-running')
OUTPUT=os.path.join(ROOT,'public','assets','animations','army-running')
SOURCE=r'C:\ProgramData\Epic\EpicGamesLauncher\VaultCache\FabLibrary\Army_man_Running-3a6c17b7\VaultCache\FabLibrary\Army_man_Running-3a6c17b7\glb\converted\army_man_running.glb'
TARGET=os.path.join(ROOT,'public','assets','characters','male-revision-02','male-revision-02-dual-sword.glb')
FPS=60
START=12.5
PERIOD=50
COUNT=50
os.makedirs(WORK,exist_ok=True);os.makedirs(OUTPUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=FPS

def load(path):
    old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=path)
    objects=set(bpy.data.objects)-old
    arm=next(o for o in objects if o.type=='ARMATURE')
    return arm,objects

source,source_objects=load(SOURCE)
source_action=source.animation_data.action
if source_action is None:source_action=source.animation_data.nla_tracks[0].strips[0].action
for t in source.animation_data.nla_tracks:t.mute=True
source.animation_data.action=source_action
target,target_objects=load(TARGET)
target.animation_data_clear()
for p in target.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
source_names={b.name.split(':')[-1].rsplit('_',1)[0]:b.name for b in source.data.bones}
mapping={
    'Hips':'Hips','Spine':'Spine','Spine2':'Chest','Neck':'Neck','Head':'Head',
    'LeftShoulder':'Shoulder.L','LeftArm':'UpperArm.L','LeftForeArm':'LowerArm.L','LeftHand':'Hand.L',
    'RightShoulder':'Shoulder.R','RightArm':'UpperArm.R','RightForeArm':'LowerArm.R','RightHand':'Hand.R',
    'LeftUpLeg':'Thigh.L','LeftLeg':'Shin.L','LeftFoot':'Foot.L',
    'RightUpLeg':'Thigh.R','RightLeg':'Shin.R','RightFoot':'Foot.R',
}
assert all(s in source_names and t in target.data.bones for s,t in mapping.items())

def world(obj,name,pose=False):return obj.matrix_world@(obj.pose.bones[name].matrix if pose else obj.data.bones[name].matrix_local)
def depth(b):return 0 if b.parent is None else depth(b.parent)+1
ordered=sorted(mapping.items(),key=lambda p:depth(target.data.bones[p[1]]))
corrections={}
for src,dst in ordered:
    sq=world(source,source_names[src]).to_quaternion();tq=world(target,dst).to_quaternion()
    # Match anatomical longitudinal directions despite T-pose vs lowered A-pose.
    # Swing calibration preserves target roll and the original source's animated twist.
    swing=(tq@Vector((0,1,0))).rotation_difference(sq@Vector((0,1,0)))
    corrections[dst]=sq.inverted()@swing@tq
    if dst in ['Hips','Spine','Chest','Neck','Head']:
        corrections[dst]=sq.inverted()@tq

src_leg=sum((world(source,source_names[b]).translation-world(source,source_names[a]).translation).length for a,b in [('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot')])
dst_leg=sum((world(target,b).translation-world(target,a).translation).length for a,b in [('Thigh.L','Shin.L'),('Shin.L','Foot.L')])
scale=dst_leg/src_leg
sole_objects=[o for o in target_objects if o.type=='MESH' and o.name.startswith('Boot sole.')]
assert len(sole_objects)==2
def lowest_soles():
    dg=bpy.context.evaluated_depsgraph_get();heights=[]
    for obj in sole_objects:
        evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh()
        heights.append(min((evaluated.matrix_world@v.co).z for v in mesh.vertices))
        evaluated.to_mesh_clear()
    return heights
floor=min(lowest_soles())
rest_hips=world(target,'Hips').translation.copy()

samples=[]
for i in range(COUNT+1):
    frame=START+i*PERIOD/COUNT
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
    poses={dst:world(source,source_names[src],True).copy() for src,dst in ordered}
    contacts=[]
    for side in ['Left','Right']:
        contacts.append(min(world(source,source_names[side+b],True).translation.z for b in ['Foot','ToeBase']))
    samples.append({'poses':poses,'contacts':contacts})
hips_mean=sum((s['poses']['Hips'].translation for s in samples[:-1]),Vector())/COUNT
source_floor=min(min(s['contacts']) for s in samples)

action=bpy.data.actions.new('Run_Army')
target.animation_data_create();target.animation_data.action=action
target.animation_data.action_slot=action.slots.new('OBJECT',target.name)
raw=[];ground=[]
for i,sample in enumerate(samples):
    bpy.context.scene.frame_set(i)
    for pb in target.pose.bones:pb.matrix_basis=Matrix.Identity(4)
    for src,dst in ordered:
        pb=target.pose.bones[dst];desired=sample['poses'][dst].to_quaternion()@corrections[dst]
        parent=pb.parent.matrix@pb.parent.bone.matrix_local.inverted() if pb.parent else Matrix.Identity(4)
        frame=target.matrix_world@parent@pb.bone.matrix_local
        pb.rotation_mode='QUATERNION'
        pb.rotation_quaternion=frame.to_quaternion().inverted()@desired
        if dst=='Hips':
            delta=sample['poses'][dst].translation-hips_mean
            # In-place: no accumulated X/Y root motion and no animation scale tracks.
            delta.x=max(-.028,min(.028,delta.x*scale))
            delta.y=max(-.035,min(.035,delta.y*scale))
            delta.z*=scale
            pb.location=frame.to_3x3().inverted()@delta
        bpy.context.view_layer.update()
    heights=lowest_soles()
    # Keep a brief flight phase but plant the support sole at ground on contact.
    flight=max(0,min(.075,(min(sample['contacts'])-source_floor-.04)*scale))
    correction=floor+flight-min(heights)
    pb=target.pose.bones['Hips'];parent=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()
    local_frame=(target.matrix_world@parent@pb.bone.matrix_local).to_3x3()
    pb.location+=local_frame.inverted()@Vector((0,0,correction))
    bpy.context.view_layer.update()
    ground.append({'sample':i,'soleZ':lowest_soles(),'flight':flight,'pelvisCorrection':correction})
    pose={p.name:{'q':p.rotation_quaternion.copy(),'p':p.location.copy()} for p in target.pose.bones}
    raw.append(pose)

# The inspected source repeats exactly every 50 frames. Close only the numerical
# endpoint, not a mismatched start/end pose, and keep quaternion hemispheres stable.
raw[-1]=raw[0]
for i,pose in enumerate(raw):
    for name,data in pose.items():
        pb=target.pose.bones[name];pb.rotation_mode='QUATERNION'
        q=data['q'].copy()
        if i and q.dot(raw[i-1][name]['q'])<0:q.negate()
        data['q']=q.copy();pb.rotation_quaternion=q;pb.location=data['p']
        pb.keyframe_insert('rotation_quaternion',frame=i,group=name)
        if name=='Hips':pb.keyframe_insert('location',frame=i,group=name)

for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                for k in fc.keyframe_points:k.interpolation='LINEAR'
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=COUNT
bpy.context.scene.frame_set(0)

# Keep an editable Blender project with the actual game character and baked run.
for obj in source_objects:bpy.data.objects.remove(obj,do_unlink=True)
for old_action in list(bpy.data.actions):
    if old_action!=action:bpy.data.actions.remove(old_action,do_unlink=True)
# Remove orphaned soldier mesh/material datablocks from this scratch project,
# so their embedded textures are not unnecessarily packed into the editable file.
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK,'revision02-army-running.blend'))

# Export just the target armature and its baked animation. No soldier/body meshes or textures.
bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
path=os.path.join(OUTPUT,'army-running-revision02.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,
    export_frame_range=True,export_skins=True,export_rest_position_armature=True)
report={'source':SOURCE,'target':TARGET,'blender':bpy.app.version_string,'sourcePeriodFrames':PERIOD,
    'sourcePeriodSeconds':PERIOD/FPS,'outputFrames':COUNT+1,'duration':COUNT/FPS,'mapping':mapping,
    'legScale':scale,'floor':floor,'ground':ground,'file':path,'bytes':os.path.getsize(path)}
with open(os.path.join(WORK,'retarget-report.json'),'w') as f:json.dump(report,f,indent=2)
print('ARMY_RETARGET_DONE',path,os.path.getsize(path),flush=True)
