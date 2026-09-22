"""Round-trip validation of the standalone reconstructed male GLB in Blender."""
import bpy,os,json,math,sys
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BROAD_CHEST='--broad-chest' in sys.argv
WORK=os.path.join(ROOT,'work','male-broad-chest' if BROAD_CHEST else 'male-reconstruction')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'exports','characters','male-reconstructed','male-broad-chest.glb' if BROAD_CHEST else 'male-reconstructed.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH']
clips={t.name:t.strips[0].action for t in rig.animation_data.nla_tracks}
if rig.animation_data.action:clips.setdefault(rig.animation_data.action.name,rig.animation_data.action)
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.color=(.17,.17,.17)
for pos,power in [((3,-4,5),675),((-3,-2,3),405),((0,4,4),608)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,2.2));scene.camera=bpy.context.object;scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=2.7;scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=os.path.join(WORK,'roundtrip-rest.png');bpy.ops.render.render(write_still=True)
results={}
for name in ['Run','Walk','DualSword_Attack_01','DualSword_Attack_02','DualSword_Attack_03']:
    action=next((a for n,a in clips.items()if name in n),None);assert action,name
    rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    start,end=action.frame_range;max_span=0
    for frame in range(int(start),int(end)+1,4):
        scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
        points=[]
        for obj in meshes:
            evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh()
            for v in mesh.vertices:
                p=evaluated.matrix_world@v.co
                assert all(math.isfinite(a)for a in p),obj.name
                points.append(p)
            evaluated.to_mesh_clear()
        span=max(max(p[i]for p in points)-min(p[i]for p in points)for i in range(3));max_span=max(max_span,span)
        assert span<3.5,(name,frame,span)
    results[name]={'frames':[float(start),float(end)],'maxSpan':max_span}
    if name in ['Run','DualSword_Attack_01']:
        scene.frame_set(12 if name=='Run'else 20);scene.render.filepath=os.path.join(WORK,'roundtrip-'+name+'.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(WORK,'validation.json'),'w')as f:json.dump(results,f,indent=2)
print('MALE_GLTF_VALIDATED',json.dumps(results),flush=True)
