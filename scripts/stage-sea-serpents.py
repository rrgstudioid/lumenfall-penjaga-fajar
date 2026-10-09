"""Rig/animate approved downloaded copies in a NEW Blender scene; no paid APIs.
blender --background --factory-startup --python scripts/stage-sea-serpents.py -- NAME SOURCE
Animation timing comes from the runtime combat manifest, not a second combat clock.
"""
import bpy, sys, json, math, hashlib
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector, Euler
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/sunken-ruins/revision13'
OUT=ROOT/'dev-assets/sunken-ruins-underwater-v1/revision13'
name,source=sys.argv[sys.argv.index('--')+1:]
source=Path(source).resolve()
assert name in ['serpent-guardian','sea-serpent-boss'] and source.is_relative_to(WORK.resolve()) and not bpy.data.filepath
boss=name=='sea-serpent-boss';length=42 if boss else 14;budget=20000 if boss else 12000
OUT.mkdir(parents=True,exist_ok=True)
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(source))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in parts:
    matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(matrix)
for o in list(bpy.data.objects):
    if o not in parts:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=name
coords=np.array([v.co[:] for v in mesh.data.vertices]);xy=coords[:,:2];center=xy.mean(axis=0)
_,vectors=np.linalg.eigh(np.cov((xy-center).T));axis=vectors[:,-1];along=(xy-center)@axis;side=(xy-center)@np.array([-axis[1],axis[0]])
# Head/neck is substantially thicker than the tail; orient head toward Blender +Y / runtime -Z.
span=along.max()-along.min();lo=along<along.min()+span*.2;hi=along>along.max()-span*.2
def thickness(mask):return np.ptp(coords[mask,2])+np.ptp(side[mask])
if thickness(lo)>thickness(hi):along=-along;side=-side
scale=length/(along.max()-along.min());along=(along-(along.max()+along.min())*.5)*scale
side=(side-(side.max()+side.min())*.5)*scale;vertical=(coords[:,2]-coords[:,2].min())*scale+.35
for i,v in enumerate(mesh.data.vertices):v.co=(float(side[i]),float(along[i]),float(vertical[i]))
mesh.data.calc_loop_triangles();source_triangles=len(mesh.data.loop_triangles)
if source_triangles>budget:
    d=mesh.modifiers.new('Browser budget','DECIMATE');d.ratio=(budget-5)/source_triangles;bpy.ops.object.modifier_apply(modifier=d.name)
# Keep authored PBR, compact textures, and add an actual emissive red-eye mask.
images=set();emissive_pixels=0
for m in mesh.data.materials:
    if not m or not m.use_nodes:continue
    principled=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    for n in list(m.node_tree.nodes):
        if n.type!='TEX_IMAGE' or not n.image:continue
        im=n.image
        if im not in images:
            images.add(im);w,h=im.size
            if max(w,h)>2048:im.scale(round(w*2048/max(w,h)),round(h*2048/max(w,h)));im.pack()
        if boss and principled and any(l.to_node==principled and l.to_socket.name=='Base Color' for l in n.outputs['Color'].links):
            w,h=im.size;rgba=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4)
            r,g,b=rgba[:,0],rgba[:,1],rgba[:,2];mask=(r>.28)&(r>g*1.65)&(r>b*1.4)
            # Restrict red emission to upper head UVs, excluding belly seams and mouth.
            allowed=np.zeros((h,w),dtype=bool);uv=mesh.data.uv_layers.active.data
            head=[v.co.z for v in mesh.data.vertices if v.co.y>length*.35]
            eye_floor=min(head)+(max(head)-min(head))*.48
            mesh.data.calc_loop_triangles()
            for tri in mesh.data.loop_triangles:
                vs=[mesh.data.vertices[i].co for i in tri.vertices]
                if min(v.y for v in vs)<length*.34 or sum(v.z for v in vs)/3<eye_floor:continue
                pts=np.array([[uv[i].uv.x*w,uv[i].uv.y*h] for i in tri.loops]);xmin,ymin=np.maximum(0,np.floor(pts.min(axis=0)).astype(int));xmax,ymax=np.minimum([w-1,h-1],np.ceil(pts.max(axis=0)).astype(int))
                if xmax<xmin or ymax<ymin:continue
                xx,yy=np.meshgrid(np.arange(xmin,xmax+1)+.5,np.arange(ymin,ymax+1)+.5);a,b,c=pts
                den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
                if abs(den)<1e-8:continue
                u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
                allowed[ymin:ymax+1,xmin:xmax+1]|=(u>=-.02)&(v>=-.02)&(u+v<=1.02)
            mask &= allowed.ravel()
            output=np.zeros_like(rgba);output[:,3]=1;output[mask,0]=1;output[mask,1]=.008;output[mask,2]=.018
            emissive_pixels+=int(mask.sum());em=bpy.data.images.new(name+'-red-eyes',width=w,height=h);em.pixels.foreach_set(output.ravel());em.pack()
            tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=em
            m.node_tree.links.new(tex.outputs['Color'],principled.inputs['Emission Color']);principled.inputs['Emission Strength'].default_value=3.5
    if principled:principled.inputs['Roughness'].default_value=.4
# Eighteen smoothly weighted spine bones. Head is held by the first bone.
count=18;vertices=np.array([v.co[:] for v in mesh.data.vertices]);ys=np.linspace(length*.43,-length*.49,count+1)
centers=[]
for y in ys:
    band=vertices[np.abs(vertices[:,1]-y)<length*.045]
    if len(band)<3:band=vertices[np.argsort(np.abs(vertices[:,1]-y))[:30]]
    centers.append(Vector((float(np.median(band[:,0])),float(y),float(np.median(band[:,2])))))
arm=bpy.data.armatures.new(name+'-spine');rig=bpy.data.objects.new(name+'-rig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
last=None
for i in range(count):
    b=arm.edit_bones.new(f'Spine_{i:02d}');b.head=centers[i];b.tail=centers[i+1]
    if last:b.parent=last;b.use_connect=True
    last=b
bpy.ops.object.mode_set(mode='OBJECT')
groups=[mesh.vertex_groups.new(name=f'Spine_{i:02d}') for i in range(count)]
for v in mesh.data.vertices:
    f=max(0,min(count-1,(ys[0]-v.co.y)/(ys[0]-ys[-1])*count-.5));i=int(f);w=f-i
    groups[i].add([v.index],1-w,'REPLACE')
    if w>0 and i+1<count:groups[i+1].add([v.index],w,'REPLACE')
mesh.parent=rig;modifier=mesh.modifiers.new('Serpentine skin','ARMATURE');modifier.object=rig
lods=[mesh]
for suffix,ratio in [('_LOD1',.32),('_LOD2',.10)]:
    low=mesh.copy();low.data=mesh.data.copy();low.name=name+suffix;bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
    d=low.modifiers.new('Local LOD','DECIMATE');d.ratio=ratio
    bpy.ops.object.modifier_move_up(modifier=d.name);bpy.ops.object.modifier_apply(modifier=d.name);lods.append(low)
bpy.context.scene.render.fps=30;rig.animation_data_create()
plan=json.loads((WORK/'animation-plan.json').read_text());attacks=plan['boss' if boss else 'guardian']
clips=[{'id':'idle','duration':3.2},{'id':'swim','duration':1.8}]+[{**a,'duration':a['windup']+a['recovery']} for a in attacks]
baked=[]
for clip in clips:
    clipname=clip['id'];duration=clip['duration'];frames=round(duration*30)
    action=bpy.data.actions.new(clipname);rig.animation_data.action=action;rig.animation_data.action_slot=action.slots.new('OBJECT',rig.name)
    for frame in range(frames+1):
        t=frame/30;phase=2*math.pi*frame/frames;attack='windup' in clip
        hit=clip.get('windup',1);charge=min(1,t/hit) if t<hit else max(0,1-(t-hit)/clip.get('recovery',1))
        pulse=math.exp(-((t-hit)/.2)**2) if attack else 0
        previous_yaw=previous_pitch=0
        for i,p in enumerate(rig.pose.bones):
            u=i/(count-1);p.rotation_mode='QUATERNION'
            yaw=math.sin(phase-u*5.5)*(.11 if clipname=='idle' else .24)*(.3+.7*u);pitch=math.sin(phase-u*3)*.035
            if attack:
                # Each strike has a separate silhouette and windup/impact pose.
                yaw*=.35;pitch*=.3
                if 'bite' in clipname:pitch+=(-.22*charge+.42*pulse)*(1-u)**2
                elif 'tail' in clipname:yaw+=(-.7*charge+1.4*pulse)*u*u
                elif 'slam' in clipname:pitch+=(-.55*charge+1.0*pulse)*(1-u)**2
                elif 'coil' in clipname:yaw+=math.sin(u*math.pi*2)*(.8*charge-.3*pulse)
                elif 'pressure' in clipname:pitch-=.3*charge*(1-u);yaw+=math.sin(u*7)*.18*charge
                elif 'pulse' in clipname:pitch+=math.sin(u*math.pi)*(.55*charge-.65*pulse);yaw+=math.sin(u*5)*.3*charge
            p.rotation_quaternion=Euler((pitch-previous_pitch,0,yaw-previous_yaw),'XYZ').to_quaternion()
            p.location=Vector((0,0,0))
            if i==0 and attack:p.location.y=length*(.025*charge-.06*pulse) if 'bite' in clipname else 0
            p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
            if i==0:p.keyframe_insert('location',frame=frame,group=p.name)
            previous_yaw=yaw;previous_pitch=pitch
    # Bake visual-only seabed clearance after deformation. Gameplay root, hit
    # timing and X/Z remain unchanged; head/coil poses must not bury the tail.
    root_bone=rig.pose.bones[0];up_local=root_bone.bone.matrix_local.to_3x3().inverted() @ Vector((0,0,1))
    max_lift=0
    for frame in range(frames+1):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
        positions=np.empty(len(posed.vertices)*3,dtype=np.float32);posed.vertices.foreach_get('co',positions)
        minimum=float(positions.reshape(-1,3)[:,2].min());evaluated.to_mesh_clear()
        lift=max(0,.55-minimum);max_lift=max(max_lift,lift)
        root_bone.location+=up_local*lift
        root_bone.keyframe_insert('location',frame=frame,group=root_bone.name)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=clipname;track.strips.new(clipname,0,action);track.mute=True
    baked.append({'name':clipname,'duration':frames/30,'maximumClearanceLift':max_lift})
rig.animation_data.action=None
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in lods:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_rest_position_armature=True)
triangles=[]
for o in lods:o.data.calc_loop_triangles();triangles.append(len(o.data.loop_triangles))
task=json.loads((source.parent/'task.json').read_text(encoding='utf-8-sig'))
manifest={'name':name,'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'taskId':task['task_id'],'creditsConsumed':task['credits_consumed'],'author':'Higgsfield reference + Tripo mesh; local LUMENFALL rig, weights, LOD and animation authoring','license':'Owner-authorized generations, subject to service account terms; no third-party downloaded model.','length':length,'bones':count,'sourceTriangles':source_triangles,'triangles':triangles,'animations':baked,'emissiveMaskPixels':emissive_pixels,'modifications':'Normalize head forward (-Z), center, locally decimate, 2K PBR, 18-bone skin, eight distinct combat clips across two models, two locomotion clips each, two local LODs, baked visual-only seabed clearance; original GLB unchanged.','bytes':(OUT/(name+'.glb')).stat().st_size}
(OUT/(name+'.json')).write_text(json.dumps(manifest,indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-rigged.blend')))
print(json.dumps(manifest))
