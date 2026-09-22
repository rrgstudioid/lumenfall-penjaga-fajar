import bpy, json, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'work', 'army-running')
SOURCE = r'C:\ProgramData\Epic\EpicGamesLauncher\VaultCache\FabLibrary\Army_man_Running-3a6c17b7\VaultCache\FabLibrary\Army_man_Running-3a6c17b7\glb\converted\army_man_running.glb'
TARGET = os.path.join(ROOT, 'public', 'assets', 'characters', 'male-revision-02', 'male-revision-02-dual-sword.glb')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps = 60
report = {'blender': bpy.app.version_string}
for label, path in [('source', SOURCE), ('target', TARGET)]:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objects=set(bpy.data.objects)-before
    armatures=[o for o in objects if o.type=='ARMATURE']
    info=[]
    for arm in armatures:
        arm.animation_data_create()
        # Imported NLA/actions must not affect the skeleton rest measurements.
        action=arm.animation_data.action
        tracks=[{'name': t.name, 'strips': [{'name':s.name,'action':s.action.name,'range':list(s.action.frame_range)} for s in t.strips]} for t in arm.animation_data.nla_tracks]
        for t in arm.animation_data.nla_tracks: t.mute=True
        bones=[]
        for b in arm.data.bones:
            if 'Hand' in b.name and any(str(i) in b.name.split('_')[0] for i in range(1,5)):continue
            mat=arm.matrix_world@b.matrix_local
            bones.append({'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(arm.matrix_world@b.head_local),'tail':list(arm.matrix_world@b.tail_local),'quaternion':list(mat.to_quaternion())})
        samples=[]
        if label=='source':
            if action is None and arm.animation_data.nla_tracks:
                action=arm.animation_data.nla_tracks[0].strips[0].action
            if action:
                arm.animation_data.action=action
                first,last=action.frame_range
                for frame in range(round(first),round(last)+1):
                    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
                    chosen={}
                    for pb in arm.pose.bones:
                        if any(token in pb.name for token in [':Hips',':LeftFoot',':RightFoot',':LeftUpLeg',':RightUpLeg',':LeftArm',':RightArm',':Spine2']):
                            m=arm.matrix_world@pb.matrix
                            chosen[pb.name]={'p':list(m.translation),'q':list(m.to_quaternion())}
                    samples.append({'frame':frame,'bones':chosen})
        info.append({'name':arm.name,'matrix':[list(row) for row in arm.matrix_world], 'bones':bones,'action':action.name if action else None,'nla':tracks,'samples':samples})
    report[label]={'armatures':info,'meshes':[{'name':o.name,'vertices':len(o.data.vertices)} for o in objects if o.type=='MESH']}
    for o in objects:bpy.data.objects.remove(o,do_unlink=True)
with open(os.path.join(OUT,'inspection.json'),'w') as f:json.dump(report,f,indent=2)
print('ARMY_INSPECTION_DONE',os.path.join(OUT,'inspection.json'),flush=True)
