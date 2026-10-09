"""Original modular Sunken Ruins kit. Run only in the isolated authoring scene.
No source blend or library asset is opened. Runtime uses instanced prototypes.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work' / 'sunken-ruins'
OUT = ROOT / 'dev-assets' / 'sunken-ruins-underwater-v1'
TARGET = WORK / 'Sunken_Ruins_Kit.blend'
assert not bpy.data.filepath or Path(bpy.data.filepath).resolve() == TARGET.resolve(), 'Refusing to change another Blender file'
assert bpy.context.scene.name.startswith('Sunken Ruins'), 'Use the isolated Sunken Ruins scene'
WORK.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
for o in list(bpy.context.scene.objects):
    bpy.data.objects.remove(o, do_unlink=True)
mat = bpy.data.materials.get('Sunken_Vertex_Color') or bpy.data.materials.new('Sunken_Vertex_Color')
mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value=.82
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color'
mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
parts=[]; models=[]
def finish_part(o,color):
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    a=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for d in a.data:d.color=(*color,1)
    o.data.materials.clear();o.data.materials.append(mat);parts.append(o)
    return o
def orb(p,s,c,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p)
    o=bpy.context.object;o.scale=s;return finish_part(o,c)
def box(p,s,c):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object;o.scale=s
    bevel=o.modifiers.new('soft chipped edges','BEVEL');bevel.width=.08;bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish_part(o,c)
def stem(a,b,r1,r2,c,n=7):
    a,b=Vector(a),Vector(b);d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return finish_part(o,c)
def mesh(name,verts,faces,c):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
    return finish_part(o,c)
def complete(name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    models.append(o);parts.clear();return o

white=(.9,.97,.95);dark=(.53,.68,.69);stone=(.59,.73,.74);trim=(.8,.88,.79);blue=(.24,.66,.74)
stem((0,0,0),(0,0,1.7),.16,.06,white)
for i in range(7):
    a=i*2.4;z=.4+i*.17;end=(math.cos(a)*(.5+i*.055),math.sin(a)*.4,z+.62)
    stem((0,0,z),end,.09,.035,white)
    stem(end,(end[0]*1.18,end[1]*1.25,end[2]+.38),.035,.009,white)
    stem((end[0]*.7,end[1]*.7,end[2]-.2),(end[0]*1.3,end[1]+.17,end[2]+.05),.04,.012,white)
complete('coral_branch')
for i in range(6):
    a=i*2.4;x=math.cos(a)*.38;y=math.sin(a)*.38;h=.65+(i%3)*.25
    stem((x,y,0),(x,y,h),.14,.2,white)
    orb((x,y,h),(.16,.16,.05),(.4,.53,.57))
complete('coral_tube')
stem((0,0,0),(0,0,1.3),.08,.02,white)
for i in range(9):
    a=(i/8-.5)*2.3;x=math.sin(a);z=.55+math.cos(a)*1.3
    stem((0,0,.35),(x,0,z),.045,.01,white,5)
    for j in range(2):stem((x*.6,0,z*.7),(x+(.17 if x>0 else -.17),0,z-.1-j*.25),.025,.005,white,5)
complete('coral_fan')
for i in range(4):orb(((i%2-.5)*.4,(i//2-.5)*.4,.25+i*.19),(.65-i*.07,.48,.12),white,2)
complete('coral_plate')
for kind in ['seaweed','kelp']:
    for j in range(5):
        h=(1.2+j*.19)*(2 if kind=='kelp' else 1);w=.09 if kind=='seaweed' else .19
        v=[]
        for i in range(7):
            t=i/6;x=(j-2)*.13+math.sin(t*4+j)*.16;v.extend([(x-w*(1-t*.85),math.cos(j)*.08,h*t),(x+w*(1-t*.85),math.cos(j)*.08,h*t)])
        mesh(kind,v,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(6)],white)
    complete(kind)
orb((0,0,.6),(1.3,1,.9),stone,1);orb((.5,.1,1.1),(.7,.7,.55),dark,1);complete('reef_rock')
for broken in [False,True]:
    box((0,0,.3),(2,2,.6),dark);box((0,0,.72),(1.55,1.55,.25),trim)
    h=3.4 if broken else 6
    stem((0,0,.8),(0,0,h),.64,.56,stone,8)
    if not broken:
        box((0,0,h),(1.5,1.5,.35),trim);box((0,0,h+.3),(1.8,1.8,.35),stone)
    else:orb((.08,0,h),(.6,.57,.24),dark)
    complete('broken_pillar' if broken else 'pillar')
for s in [-1,1]:
    box((s*2,0,1.9),(1.05,1.3,3.8),stone);box((s*2,0,.25),(1.5,1.6,.5),dark)
for i in range(9):
    a=i*math.pi/8;o=box((math.cos(a)*2,0,3.7+math.sin(a)*2),(.88,1.25,.9),trim if i%2 else stone);o.rotation_euler.y=a-math.pi/2
complete('arch')
box((0,0,.22),(4,3,.44),stone);complete('slab')
for i in range(3):box(((i-1)*1.7,0,.75),(1.6,.85,1.5),stone)
box((-.65,0,1.95),(2.4,.85,.9),dark);complete('broken_wall')
box((0,0,.35),(2.6,2.3,.7),dark);stem((0,0,.7),(0,0,2.6),.75,.5,stone)
orb((0,0,3.35),(.55,.45,.68),trim,2)
for s in [-1,1]:stem((s*.5,0,2.4),(s*1.1,0,1.6),.18,.11,stone)
stem((1.1,0,.65),(1.1,0,4.6),.065,.045,trim)
for s in [-1,0,1]:stem((1.1,0,3.9),(1.1+s*.32,0,4.55),.045,.01,trim)
complete('ocean_statue')
stem((0,0,0),(0,0,4),.075,.06,trim)
for s in [-1,0,1]:
    stem((0,0,3),(s*.75,0,3.5),.075,.06,trim)
    stem((s*.75,0,3.5),(s*.75,0,4.3),.06,.004,trim)
complete('trident')
orb((0,0,0),(.5,.14,.24),white,2)
mesh('tail',[(.4,0,0),(.78,0,.28),(.78,0,-.28)],[(0,1,2)],white)
orb((-.35,-.12,.04),(.04,.04,.04),(.025,.06,.09));complete('fish')
orb((0,0,.1),(.65,.65,.38),white,2)
for i in range(7):
    a=i*math.pi*2/7;x=math.cos(a)*.35;y=math.sin(a)*.35
    stem((x,y,0),(x*.85,y*.85,-.9),.02,.012,white,5)
    stem((x*.85,y*.85,-.9),(x*1.2,y*1.2,-1.5),.012,.002,white,5)
complete('jellyfish')
mesh('ray',[(-1.1,0,0),(0,-.65,.12),(1.1,0,0),(0,.7,.05),(0,0,.17)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],white)
stem((0,.6,0),(0,1.7,-.08),.045,.005,white,5);complete('ray')

bpy.ops.object.select_all(action='DESELECT')
for o in models:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'kit.glb'),export_format='GLB',use_selection=True,export_apply=True)
records=[]
for i,o in enumerate(models):
    o.data.calc_loop_triangles()
    records.append({'name':o.name,'triangles':len(o.data.loop_triangles),'dimensions':list(o.dimensions)})
    o.location=((i%5)*8,(i//5)*8,0)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
manifest={'schemaVersion':1,'mapId':'sunken-ruins-underwater-v1','author':'Original LUMENFALL procedural geometry authored for this task','source':'scripts/build-sunken-kit.py','license':'Original project work; no third-party asset license. Distribution terms remain with the project owner.','modifications':'Blender primitives, bevels, vertex colors, joined prototypes; glTF export. Runtime supplies instancing, shaders and placement.','externalAssets':[],'sourceAssetsModified':False,'file':'kit.glb','bytes':(OUT/'kit.glb').stat().st_size,'models':records}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest))
