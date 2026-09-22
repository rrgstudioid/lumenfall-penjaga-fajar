import bpy,os,json,math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'work','female-character');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\USER\Downloads\female_body_base_for_rpg.glb')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
report=[]
for o in meshes:
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    report.append({'name':o.name,'verts':len(vs),'min':[min(v[i] for v in vs)for i in range(3)],'max':[max(v[i]for v in vs)for i in range(3)]})
with open(os.path.join(OUT,'source-inspection.json'),'w')as f:json.dump(report,f,indent=2)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='Standard'
for position,power,size in [((3,4,5),600,4),((-3,1,3),350,3),((0,-4,4),500,3)]:
    bpy.ops.object.light_add(type='AREA',location=position);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,5,1.2));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.5;scene.camera=camera
for name,position in [('positive-y',(0,5,1.1)),('negative-y',(0,-5,1.1)),('side',(5,0,1.1))]:
    camera.location=position;camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)
camera.location=(3,5,2.3);camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'female-original-inspected.blend'))
print('FEMALE_INSPECTION',json.dumps(report),flush=True)
