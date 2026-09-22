"""Static, watertight character interpretation of the user's front reference.
Blender-only geometry workflow; does not modify any Lumenfall runtime asset.
"""
import bpy,bmesh,math,os,json
from mathutils import Vector,Matrix
from math import sin,cos,pi,exp
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'exports','stl','astra-reference-figure');os.makedirs(OUT,exist_ok=True)
WORK=os.path.join(ROOT,'work','reference-figure-stl');os.makedirs(WORK,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'work','male-base','revision-03','Lumenfall_Male_Reference_03.blend'))
scene=bpy.context.scene
for rig in [o for o in scene.objects if o.type=='ARMATURE']:
    rig.animation_data_clear();rig.data.pose_position='REST'
    for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()

def smooth(a,b,x):
    x=max(0,min(1,(x-a)/(b-a)));return x*x*(3-2*x)
def g(x,c,w):return exp(-((x-c)/w)**2)
def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*color,1);shader.inputs['Roughness'].default_value=.68
    return m
clay=material('STL preview - neutral ivory',(.58,.54,.47))

# Extract the prior reference study as editable anatomical starting geometry.
# The hair and proportions below are rebuilt for the current single-front image.
parts=[]
for obj in list(scene.objects):
    if obj.type!='MESH' or obj.name=='Studio floor':continue
    if obj.name.startswith(('Hair','Eye ','Iris','Pupil','Brow','Mouth crease')):
        bpy.data.objects.remove(obj,do_unlink=True);continue
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.data.materials.clear();obj.data.materials.append(clay)
    parts.append(obj)
for obj in list(scene.objects):
    if obj not in parts:bpy.data.objects.remove(obj,do_unlink=True)
body=next(o for o in parts if o.name=='MaleBody_Skinned')

# Smooth the input topology before sculpting muscular forms into its surface.
bpy.context.view_layer.objects.active=body
sub=body.modifiers.new('Subdivide sculpt base','SUBSURF');sub.levels=2
bpy.ops.object.modifier_apply(modifier=sub.name)
for v in body.data.vertices:
    x,y,z=v.co;side=1 if x>0 else -1
    if .43<z<1.26 and abs(x)<.39:
        center=side*(.18+.105*(1-smooth(.40,1.15,z)))
        volume=1+.15*g(z,1.04,.18)+.17*g(z,.61,.15)
        v.co.x=center+(x-center)*volume;v.co.y=y*volume
    if z>1.62 and z<2.04 and abs(x)<.32:
        mask=smooth(1.62,1.73,z)*(1-smooth(1.93,2.02,z))*smooth(.025,.10,-y)*(1-smooth(.20,.32,abs(x)))
        radius=.32;section=max(0,1-(abs(x)/radius)**4)**.5
        pec=.040*exp(-((abs(x)-.137)/.11)**4)*g(z,1.835,.087)
        target=-.165*section-pec+.007*g(x,0,.025)
        v.co.y=y+(target-y)*mask
    if 1.405<z<1.72 and abs(x)<.23 and y<-.045:
        frontal=smooth(.045,.10,-y)
        v.co.y-=frontal*sum(.008*g(abs(x),.066,.050)*g(z,h,.04)for h in [1.475,1.56,1.65])
body.data.update()
polish_group=body.vertex_groups.new(name='Chest surface polish')
for v in body.data.vertices:
    x,y,z=v.co
    weight=smooth(1.64,1.75,z)*(1-smooth(1.93,2.02,z))*(1-smooth(.25,.35,abs(x)))*smooth(.02,.10,-y)
    if weight>0:polish_group.add([v.index],weight,'REPLACE')
bpy.context.view_layer.objects.active=body
sm=body.modifiers.new('Blend pectoral contours','SMOOTH');sm.vertex_group=polish_group.name;sm.factor=.5;sm.iterations=22
bpy.ops.object.modifier_apply(modifier=sm.name)

# More compact face; retain an actual nose, lips and ears under the swept fringe.
for obj in parts:
    if obj.name.startswith(('Head','Ear','Upper eyelid','Lower lip')):
        for v in obj.data.vertices:
            v.co.x*=.95
            # Subtle chin/jaw definition, not a projected photograph.
            v.co.y-=.006*g(v.co.z,2.135,.044)*g(v.co.x,0,.060)
        if obj.name=='Head_Skinned':
            bpy.context.view_layer.objects.active=obj
            sub=obj.modifiers.new('Smooth face surface','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
    if obj.name.startswith(('Boot','Wrist cuff','Waistband')):
        bpy.context.view_layer.objects.active=obj
        bevel=obj.modifiers.new('Soft printable edges','BEVEL');bevel.width=.006;bevel.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    if obj.name.startswith('Shorts'):
        bpy.context.view_layer.objects.active=obj
        sub=obj.modifiers.new('Smooth shorts','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)

def mesh(name,verts,faces):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(clay);parts.append(obj)
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    return obj
def sphere(name,loc,scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(clay);parts.append(o);return o

# Closed scalp dome: roots of every hair lock overlap this solid and the head.
hc=Vector((0,.025,2.395));rx=.237;ry=.216;rz=.310
vs=[];fs=[];N=40;rows=14
for k in range(rows):
    theta=.015+(1.50-.015)*k/(rows-1)
    for j in range(N):
        phi=2*pi*j/N;vs.append((rx*sin(theta)*cos(phi),.025+ry*sin(theta)*sin(phi),2.395+rz*cos(theta)))
for k in range(rows-1):
    for j in range(N):
        a=k*N+j;b=k*N+(j+1)%N;fs.append((a,b,b+N,a+N))
fs.extend([tuple(reversed(range(N))),tuple((rows-1)*N+j for j in range(N))])
mesh('Scalp - closed',vs,fs)

def lock(name,points,widths,depth=.028):
    verts=[];faces=[];sides=6
    for i,(point,width) in enumerate(zip(points,widths)):
        p=Vector(point);tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        outward=(p-hc).normalized();across=tangent.cross(outward).normalized()
        if across.length<.01:across=Vector((1,0,0))
        normal=across.cross(tangent).normalized()
        if normal.dot(outward)<0:normal=-normal
        thick=depth*min(1,width/.035)
        for j in range(sides):
            a=j*2*pi/sides;verts.append(tuple(p+across*(width*cos(a))+normal*(thick*sin(a))))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
    return mesh(name,verts,faces)

# Layered front locks sweep from the upper-right part across the eyes to the left.
fringes=[
    ([(.07,-.095,2.679),(.01,-.198,2.622),(-.105,-.236,2.526),(-.203,-.212,2.417)],[.025,.060,.059,.003]),
    ([(.088,-.095,2.665),(.054,-.205,2.584),(-.038,-.259,2.463),(-.12,-.247,2.343)],[.028,.068,.068,.003]),
    ([(.03,-.068,2.682),(-.089,-.173,2.617),(-.177,-.205,2.529),(-.275,-.136,2.463)],[.028,.071,.059,.003]),
    ([(-.035,-.025,2.692),(-.122,-.106,2.66),(-.238,-.137,2.59),(-.31,-.065,2.56)],[.030,.070,.051,.003]),
    ([(-.093,-.035,2.662),(-.189,-.133,2.592),(-.244,-.175,2.501),(-.30,-.098,2.416)],[.025,.062,.047,.003]),
    ([(.10,-.035,2.661),(.153,-.150,2.57),(.172,-.217,2.448),(.205,-.17,2.342)],[.030,.068,.062,.003]),
    ([(.135,.008,2.653),(.207,-.072,2.553),(.243,-.121,2.444),(.258,-.049,2.375)],[.028,.063,.049,.003]),
    ([(.075,-.072,2.671),(.113,-.186,2.602),(.117,-.258,2.495),(.133,-.230,2.417)],[.025,.048,.044,.003]),
]
for i,(p,w)in enumerate(fringes):lock('Front fringe %02d'%i,p,w,.031)
for row,count in [(0,10),(1,12)]:
    for j in range(count):
        phi=2*pi*j/count+.16*row
        if sin(phi)<-.45:continue
        points=[]
        for theta,extra in [(0.5+row*.3,0),(.95+row*.25,.02),(1.45+row*.18,.012),(1.69+row*.25,.008)]:
            points.append(( (rx+extra)*sin(theta)*cos(phi),.025+(ry+extra)*sin(theta)*sin(phi),2.395+(rz+extra)*cos(theta)))
        lock('Side and back lock %d %d'%(row,j),points,[.035,.071,.05,.003],.026)
lock('Crown tuft',[(.085,.032,2.651),(.035,.045,2.728),(-.013,.050,2.767),(-.024,.045,2.795)],[.05,.043,.023,.003],.024)

# Additional closed finger forms join the fists, preserving knuckle definition in STL.
for s in [-1,1]:
    for j in range(3):sphere('Folded finger', (s*(.485+j*.022),-.102,1.171-.009*j),(.024,.027,.034))

# Build a single solid from intersecting forms. Source components are retained in
# a hidden collection inside the .blend, not in the exported STL.
source_collection=bpy.data.collections.new('Editable component sources');scene.collection.children.link(source_collection)
duplicates=[]
for obj in parts:
    dup=obj.copy();dup.data=obj.data.copy();scene.collection.objects.link(dup);duplicates.append(dup)
    for collection in list(obj.users_collection):collection.objects.unlink(obj)
    source_collection.objects.link(obj)
source_collection.hide_render=True;source_collection.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for o in duplicates:o.select_set(True)
bpy.context.view_layer.objects.active=duplicates[0];bpy.ops.object.join()
figure=bpy.context.object;figure.name='Astra - solid printable figure'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
rem=figure.modifiers.new('Watertight solid union','REMESH');rem.mode='VOXEL';rem.voxel_size=.0036;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=figure.modifiers.new('Surface polish','SMOOTH');sm.factor=.28;sm.iterations=2;bpy.ops.object.modifier_apply(modifier=sm.name)

bm=bmesh.new();bm.from_mesh(figure.data)
remaining=set(bm.verts);components=[]
while remaining:
    todo=[remaining.pop()];component=[]
    while todo:
        v=todo.pop();component.append(v)
        for e in v.link_edges:
            other=e.other_vert(v)
            if other in remaining:remaining.remove(other);todo.append(other)
    components.append(component)
components.sort(key=len,reverse=True)
detached=sum(len(c)for c in components[1:])
assert detached<.005*len(bm.verts),('Detached major parts',list(map(len,components)))
if detached:bmesh.ops.delete(bm,geom=[v for c in components[1:]for v in c],context='VERTS')
# Slice a tiny amount off both soles and cap their perimeter. Unlike clamping
# vertices to a plane, this does not leave collapsed/zero-area triangles.
sole_plane=min(v.co.z for v in bm.verts)+.007
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,sole_plane),plane_no=(0,0,1),clear_inner=True)
boundary=[e for e in bm.edges if e.is_boundary]
if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
assert sum(not e.is_manifold for e in bm.edges)==0,'Non-manifold edges after solid union'
if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(figure.data);bm.free()

# Numeric STL units are millimetres; both boot soles are already on the same plane.
bottom=min(v.co.z for v in figure.data.vertices);top=max(v.co.z for v in figure.data.vertices)
scale=150/(top-bottom)
for v in figure.data.vertices:
    v.co.x*=scale;v.co.y*=scale;v.co.z=(v.co.z-bottom)*scale
figure.data.update()
# Remove microscopic edges left by the planar sole cut before STL's float32
# serialization. Explicit triangulation makes the exported topology testable.
bm=bmesh.new();bm.from_mesh(figure.data)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bmesh.ops.dissolve_degenerate(bm,dist=.0001,edges=list(bm.edges))
bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>3])
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
assert sum(not e.is_manifold for e in bm.edges)==0,'Non-manifold solid after sole cleanup'
assert all(f.calc_area()>1e-10 for f in bm.faces),'Degenerate face before export'
bm.to_mesh(figure.data);bm.free();figure.data.update()
figure.data.materials.clear();figure.data.materials.append(clay)
for p in figure.data.polygons:p.use_smooth=True
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS'

def select_figure():
    bpy.ops.object.select_all(action='DESELECT');figure.select_set(True);bpy.context.view_layer.objects.active=figure
select_figure()
stlpath=os.path.join(OUT,'astra-reference-150mm.stl')
bpy.ops.wm.stl_export(filepath=stlpath,export_selected_objects=True,apply_modifiers=True,ascii_format=False,use_scene_unit=False,forward_axis='Y',up_axis='Z')

# Studio in millimetres. Preview the actual untextured STL surface, not a photo.
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.world.color=(.15,.15,.15)
for location,power,size in [((150,-220,260),1400000,180),((-180,-70,170),650000,170),((0,130,210),1050000,140)]:
    bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,80))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,0,-.08));floor=bpy.context.object;floor.name='Studio floor - not exported';floor.data.materials.append(material('Backdrop',(.12,.135,.15)))
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=173
camera.data.clip_end=5000
def render(name,pos):
    camera.location=pos;camera.rotation_euler=(Vector((0,0,76))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)
render('preview-front',(0,-350,90));render('preview-three-quarter',(195,-340,135));render('preview-back',(0,350,90))
camera.location=(195,-340,135);camera.rotation_euler=(Vector((0,0,76))-camera.location).to_track_quat('-Z','Y').to_euler()
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL';area.spaces.active.clip_end=5000
select_figure();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'astra-reference-figure.blend'))
report={'stl':stlpath,'heightMillimeters':150,'triangles':sum(len(p.vertices)-2 for p in figure.data.polygons),'connectedComponents':1,'nonManifoldEdges':0,'removedDetachedVertices':detached,'interpretation':'Sculpted interpretation of a single front image; side and back are inferred; STL has no colors or textures.','gameFilesModified':False}
with open(os.path.join(OUT,'report.json'),'w')as f:json.dump(report,f,indent=2)
print('STL_CREATED',json.dumps(report),flush=True)
