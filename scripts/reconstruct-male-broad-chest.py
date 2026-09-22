"""Sculpt a broader stylized male torso; preserve the prior .blend and game files."""
import bpy,os,json,math
from mathutils import Vector,Matrix

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'exports','characters','male-reconstructed')
WORK=os.path.join(ROOT,'work','male-broad-chest');os.makedirs(WORK,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'male-reconstructed.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['MaleReconstructedRig']
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(0)
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
body=bpy.data.objects['Body_LP_body_0']
original=[v.co.copy() for v in body.data.vertices]

def smooth(a,b,t):
    t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def gauss(v,c,w):return math.exp(-((v-c)/w)**2)
def profile(z,keys):
    if z<=keys[0][0]:return keys[0][1]
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if z<=b:return x+(y-x)*smooth(a,b,z)
    return keys[-1][1]

def broad_torso(v):
    x,y,z=v
    width=profile(z,[(1.20,1),(1.30,1.02),(1.40,1.14),(1.50,1.32),(1.59,1.31),(1.66,1.22),(1.73,1.06),(1.79,1)])
    depth=profile(z,[(1.20,1),(1.36,1.06),(1.49,1.24),(1.60,1.24),(1.70,1.08),(1.79,1)])
    xx=x*width;yy=y*depth
    front=smooth(.01,.055,-y)
    chest=smooth(1.34,1.425,z)*(1-smooth(1.62,1.70,z))
    radius=profile(z,[(1.35,.205),(1.45,.252),(1.53,.285),(1.61,.285),(1.70,.24)])
    section=max(0,1-(abs(xx)/radius)**4)**.5
    # Wide pectoral planes with a fairly straight lower border, a shallow
    # sternum groove and continuous volume into the ribcage/shoulder.
    pec=smooth(1.43,1.475,z)*(1-smooth(1.585,1.66,z))
    pec*=.025*math.exp(-((abs(xx)-.135)/.11)**4)
    sternum=.008*gauss(xx,0,.026)*gauss(z,1.54,.115)
    target=-.137*section-pec+sternum
    yy+=(target-yy)*front*chest
    # Trapezius and upper-back volume finish the broadened shoulder silhouette.
    yy+=.009*gauss(z,1.59,.12)*gauss(abs(xx),.15,.12)*smooth(0,.055,y)
    return Vector((xx,yy,z))

centers={}
for side in ['L','R']:
    centers[side]=[(rig.data.bones[n+'.'+side].head_local.z,rig.data.bones[n+'.'+side].head_local.x)for n in ['Hand','LowerArm','UpperArm']]
    centers[side].sort()
def broad_arm(v,side):
    x,y,z=v;sign=1 if side=='L'else -1
    shift=profile(z,[(1.05,0),(1.19,.019),(1.40,.041),(1.58,.069),(1.69,.060),(1.77,0)])*sign
    width=profile(z,[(1.05,1),(1.19,1.02),(1.40,1.07),(1.53,1.14),(1.64,1.12),(1.75,1)])
    cx=profile(z,centers[side])
    return Vector((cx+(x-cx)*width+shift,y*width,z))

group_names={g.index:g.name for g in body.vertex_groups}
for v in body.data.vertices:
    arm_weights={'L':0,'R':0};head_weight=0
    for g in v.groups:
        name=group_names[g.group]
        for side in ['L','R']:
            if name in [p+'.'+side for p in ['UpperArm','LowerArm','Hand']]:arm_weights[side]+=g.weight
        if name in ['Head','Neck']:head_weight+=g.weight
    base=v.co.copy();core=max(0,1-sum(arm_weights.values())-head_weight)
    v.co=broad_torso(base)*core+base*head_weight
    for side in ['L','R']:v.co+=broad_arm(base,side)*arm_weights[side]
if body.data.has_custom_normals:body.data.normals_split_custom_set([(0,0,0)]*len(body.data.loops))
body.data.update()

# Retain the same skeleton and clips while matching bind points to the new shoulders.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:
    name=bone.name
    if name.startswith(('UpperArm','LowerArm','Hand')):
        bone.head=broad_arm(bone.head,name[-1]);bone.tail=broad_arm(bone.tail,name[-1])
    elif name in ['Hips','Spine','Chest'] or name.startswith('Shoulder'):
        bone.head=broad_torso(bone.head);bone.tail=broad_torso(bone.tail)
for side in ['L','R']:rig.data.edit_bones['Shoulder.'+side].tail=rig.data.edit_bones['UpperArm.'+side].head
bpy.ops.object.mode_set(mode='OBJECT')
rig['assetVersion']='male-broad-chest-02'
rig['modification']='Broader stylized pectorals, ribcage, shoulders and upper arms; Albion Online male body used as a visual direction, not an imported game asset.'

def torso_measure(coords):
    band=[v for v in coords if 1.47<v.z<1.60 and abs(v.x)<.31 and v.y<-.035]
    return {'frontChestWidth':max(v.x for v in band)-min(v.x for v in band),'frontDepth':-min(v.y for v in band)}
before=torso_measure(original);after=torso_measure([v.co for v in body.data.vertices])
assert after['frontChestWidth']>before['frontChestWidth']*1.12,(before,after)
assert all((v.co-original[v.index]).length<1e-5 for v in body.data.vertices if original[v.index].z<1.20 and abs(original[v.index].x)<.3),'Lower body changed'

# Render from identical cameras as the previous revision for a fair visual comparison.
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.camera.data.ortho_scale=2.55
def camera(pos):
    scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,1.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
def render(name,pos):
    camera(pos);scene.render.filepath=os.path.join(WORK,name+'.png');bpy.ops.render.render(write_still=True)
render('male-front',(0,-5,1.08));render('male-side',(5,0,1.08))
render('male-three-quarter',(3,-5,2.2));render('male-back',(0,5,1.08))
camera((3,-5,2.2))
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
blend=os.path.join(OUT,'male-broad-chest.blend');bpy.ops.wm.save_as_mainfile(filepath=blend)

for obj in list(bpy.data.objects):
    if obj.type!='MESH':continue
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):
        if mod.type!='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
exported=[o for o in bpy.data.objects if o==rig or o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for obj in exported:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=os.path.join(OUT,'male-broad-chest.glb')
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_rest_position_armature=True,export_extras=True)
triangles=sum(len(p.vertices)-2 for o in exported if o.type=='MESH' for p in o.data.polygons)
report={'blend':blend,'glb':glb,'triangles':triangles,'bones':len(rig.data.bones),'before':before,'after':after,'separateFromGame':True,'previousRevisionPreserved':True}
with open(os.path.join(WORK,'report.json'),'w')as f:json.dump(report,f,indent=2)
print('BROAD_CHEST_COMPLETE',json.dumps(report),flush=True)
