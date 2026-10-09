"""Revision 2 organic marine kit. Original kit/source files remain unchanged.
Run through Blender MCP in the isolated Sunken Ruins authoring scene.
"""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/sunken-ruins'
OUT = ROOT / 'dev-assets/sunken-ruins-underwater-v1/realism'
TARGET = WORK / 'Sunken_Ruins_Realism.blend'
allowed = [TARGET.resolve(), (WORK / 'Sunken_Ruins_Kit.blend').resolve()]
assert Path(bpy.data.filepath).resolve() in allowed
assert bpy.context.scene.name.startswith('Sunken Ruins')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
bpy.context.scene.name = 'Sunken Ruins — organic marine revision'
random.seed(721)
models = []
mat = bpy.data.materials.new('Marine tissue vertex albedo')
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = .72
attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'
mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
verts=[]; faces=[]; colors=[]
def vertex(p,c):
    verts.append(tuple(p)); colors.append((*c,1)); return len(verts)-1
def quad(a,b,c,d): faces.append((a,b,c,d))
def tube(points,radii,color,sides=8,cream=False):
    rings=[]
    for i,p in enumerate(points):
        p=Vector(p); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize(); a=tangent.cross(Vector((0,1,0)))
        if a.length<.01:a=tangent.cross(Vector((1,0,0)))
        a.normalize(); b=tangent.cross(a); ring=[]
        for j in range(sides):
            phase=j*math.tau/sides
            k=.88+.12*math.sin(j*4.2+i*1.7)
            c=tuple(min(1,v*k + (max(0,i/(len(points)-1)-.8)*1.9 if cream else 0)) for v in color)
            ring.append(vertex(p+(a*math.cos(phase)+b*math.sin(phase))*radii[i],c))
        rings.append(ring)
    for r,s in zip(rings,rings[1:]):
        for j in range(sides):quad(r[j],r[(j+1)%sides],s[(j+1)%sides],s[j])
    faces.append(tuple(reversed(rings[0])));faces.append(tuple(rings[-1]))
def complete(name):
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    a=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,c in enumerate(colors):a.data[i].color=c
    for p in data.polygons:p.use_smooth=True
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(mat)
    models.append(o);verts.clear();faces.clear();colors.clear();return o

# Acropora: curved tapered branches with pale living tips, without straight conical sticks.
for i in range(16):
    a=i*2.4; radius=.08+math.sqrt(i/16)*.65
    x=math.cos(a)*radius;y=math.sin(a)*radius;h=1.2+(1-radius)*.85+random.random()*.25
    points=[(x*t**.65,y*t**.65,h*t) for t in [0,.2,.4,.6,.8,1]]
    tube(points,[.13,.13,.11,.085,.055,.015],(.8,.57,.43),8,True)
    for j in range(2):
        t=.4+j*.22;s=Vector((x*t**.65,y*t**.65,h*t));end=s+Vector((math.cos(a+j)*.38,math.sin(a+j)*.38,.6))
        tube([s,s.lerp(end,.35),s.lerp(end,.7),end],[.065,.058,.042,.009],(.82,.58,.45),7,True)
complete('coral_branch')

# Hollow tube sponges: actual rim and shaded interior, not a cap glued on a cylinder.
for i in range(7):
    a=i*2.4;x=math.cos(a)*.4;y=math.sin(a)*.4;h=.65+(i%3)*.29
    rings=[]
    for k in range(9):
        t=k/8;z=h*t;r=.11+math.sin(t*2.1)*.095
        rings.append([vertex((x+math.cos(j*math.tau/12)*r+t*.12,y+math.sin(j*math.tau/12)*r,z),(.56+t*.2,.39+t*.18,.54+t*.2)) for j in range(12)])
    for r,s in zip(rings,rings[1:]):
        for j in range(12):quad(r[j],r[(j+1)%12],s[(j+1)%12],s[j])
    inner=[vertex((x+.12+math.cos(j*math.tau/12)*.12,y+math.sin(j*math.tau/12)*.12,h-.025),(.23,.17,.22)) for j in range(12)]
    bottom=vertex((x+.1,y,h-.38),(.08,.055,.075))
    for j in range(12):
        quad(rings[-1][j],rings[-1][(j+1)%12],inner[(j+1)%12],inner[j]);faces.append((inner[j],inner[(j+1)%12],bottom))
complete('coral_tube')

# Layered Montipora cups: rippled, paper-thin organic lobes with a pale growing margin.
for k in range(4):
    rings=[];cx=math.cos(k*2.4)*.28;cy=math.sin(k*2.4)*.28
    for i in range(7):
        t=i/6;ring=[]
        for j in range(40):
            a=j*math.tau/40;r=(.025+t*(.86-k*.10))*(1+.065*math.sin(a*7+k)+.04*math.sin(a*13))
            z=.16+k*.27+t*t*.16+math.sin(a*5+k)*t*.07
            c=(.8,.53,.32) if i<6 else (.94,.83,.63)
            ring.append(vertex((cx+math.cos(a)*r,cy+math.sin(a)*r,z),c))
        rings.append(ring)
    for r,s in zip(rings,rings[1:]):
        for j in range(40):quad(r[j],r[(j+1)%40],s[(j+1)%40],s[j])
complete('coral_plate')

# Gorgonian fan with branching lattice and naturally curved outline.
tube([(0,0,0),(0,0,.25),(0,0,.5)],[.08,.05,.03],(.6,.31,.25))
for i in range(17):
    a=(i/16-.5)*2.65;px=math.sin(a);pz=.45+math.cos(a)*1.45
    points=[(px*t,math.sin(t*3+i)*.06,.32+(pz-.32)*t) for t in [0,.2,.4,.6,.8,1]]
    tube(points,[.026,.024,.021,.017,.012,.005],(.72,.42,.31),5)
    for j in range(2,6):
        t=j/6;s=Vector((px*t,0,.32+(pz-.32)*t));end=s+Vector((.12 if px>0 else -.12,.02,.12))
        tube([s,s.lerp(end,.5),end],[.013,.009,.002],(.8,.48,.35),5)
for k in range(4):
    t=.38+k*.15;pts=[]
    for i in range(17):
        a=(i/16-.5)*2.65;pts.append((math.sin(a)*t,math.sin(t*3+i)*.06,.32+(.13+math.cos(a)*1.45)*t))
    tube(pts,[.009]*17,(.68,.38,.31),4)
complete('coral_fan')

# Reef rock has eroded smooth lobes and mineral variation rather than flat polyhedral faces.
for k in range(2):
    rings=[]
    for i in range(13):
        t=i*math.pi/12;ring=[]
        for j in range(24):
            a=j*math.tau/24;noise=1+.10*math.sin(a*5+t*7)+.055*math.sin(a*9-t*4)
            x=math.sin(t)*math.cos(a)*(1.1-k*.35)*noise+k*.4;y=math.sin(t)*math.sin(a)*(.9-k*.3)*noise
            z=.65+k*.45+math.cos(t)*(.7-k*.27)*noise
            shade=.62+.13*math.sin(a*8+t*11)*math.sin(t*13)
            ring.append(vertex((x,y,z),(shade*.85,shade*.89,shade*.77)))
        rings.append(ring)
    for r,s in zip(rings,rings[1:]):
        for j in range(24):quad(r[j],r[(j+1)%24],s[(j+1)%24],s[j])
faces[:]=[tuple(reversed(f)) for f in faces]
complete('reef_rock')

# Soft ribbon leaves with a midrib and curved taper, authored as actual surfaces.
for name, blades, height in [('seaweed',11,1.2),('kelp',7,3.1)]:
    for k in range(blades):
        a=k*2.4;h=height*(.6+random.random()*.65);rows=[]
        for i in range(13):
            t=i/12;w=(.04 if name=='seaweed' else .14)*math.sin(math.pi*(t*.85+.08))
            cx=math.cos(a)*t*.35;cy=math.sin(a)*t*.35+math.sin(t*4+k)*.08
            rows.append([vertex((cx+side*w,cy+(1-abs(side))*.025,h*t),(.45,.66,.36)) for side in [-1,0,1]])
        for r,s in zip(rows,rows[1:]):
            for j in range(2):quad(r[j],r[j+1],s[j+1],s[j])
    complete(name)

# Streamlined reef fish, fins, gill stripe and both eyes. Faces -X, tail +X.
rings=[]
for i in range(21):
    t=i/20;x=-.62+t*1.08;thickness=math.sin(math.pi*t)**.8
    rings.append([vertex((x,math.cos(a)*.125*thickness,math.sin(a)*.3*thickness),(.10+.25*max(0,-math.sin(a)),.36+.30*max(0,-math.sin(a)),.57+.20*max(0,-math.sin(a)))) for a in [j*math.tau/16 for j in range(16)]])
for r,s in zip(rings,rings[1:]):
    for j in range(16):quad(r[j],r[(j+1)%16],s[(j+1)%16],s[j])
def fin(points,c):
    # Fan rays have subtly ridged triangulated membrane.
    origin=Vector(points[0]);last=None
    for p in points[1:]:
        tip=vertex(p,c)
        if last is not None:faces.append((vertex(origin,tuple(v*.8 for v in c)),last,tip))
        last=tip
fin([(.38,0,0),(.77,0,.33),(.68,0,.16),(.6,0,0),(.68,0,-.16),(.77,0,-.33)],(.95,.69,.13))
fin([(-.18,0,.22),(-.26,0,.45),(0,0,.4),(.28,0,.17)],(.20,.44,.55))
for side in [-1,1]:
    fin([(-.28,side*.09,-.03),(-.06,side*.32,-.18),(.13,side*.13,-.13)],(.83,.66,.28))
    tube([(-.35,side*.115,-.12),(-.40,side*.125,0),(-.36,side*.09,.13)],[.015,.015,.008],(.045,.08,.12),5)
    center=Vector((-.44,side*.09,.075));ids=[]
    for j in range(12):
        a=j*math.tau/12;ids.append(vertex(center+Vector((math.cos(a)*.035,0,math.sin(a)*.035)),(.008,.018,.025)))
    faces.append(tuple(ids if side<0 else reversed(ids)))
complete('fish')

# Translucent umbrella and long undulating tentacles (runtime adds pulsation).
rings=[]
for i in range(9):
    t=i/8;ring=[]
    for j in range(32):
        a=j*math.tau/32;r=math.sin(t*math.pi*.51)*.55;z=math.cos(t*math.pi*.51)*.38
        ring.append(vertex((math.cos(a)*r,math.sin(a)*r,z+math.sin(a*12)*t*.025),(.69,.79,.93)))
    rings.append(ring)
for r,s in zip(rings,rings[1:]):
    for j in range(32):quad(r[j],r[(j+1)%32],s[(j+1)%32],s[j])
for i in range(16):
    a=i*math.tau/16;x=math.cos(a)*.4;y=math.sin(a)*.4
    tube([(x+math.sin(j*.7+i)*.045,y+math.cos(j*.6+i)*.04,-j*.12) for j in range(13)],[.012*(1-j/15) for j in range(13)],(.65,.57,.8),4)
complete('jellyfish')

# Ray: rounded leading edge, broad pectoral wings and fleshy central body.
rings=[]
for i in range(21):
    t=i/20;y=-.72+t*1.45;width=.03+math.sin(t*math.pi)**.9*1.2;row=[]
    for j in range(13):
        s=(j/12-.5)*2;z=(1-s*s)*.16+math.sin(abs(s)*math.pi)*.025
        shade=.25+.05*math.sin(i*2.7+j*4.6)
        row.append(vertex((s*width,y,z),(.12+shade*.3,.19+shade*.35,.23+shade*.37)))
    rings.append(row)
for r,s in zip(rings,rings[1:]):
    for j in range(12):quad(r[j],r[j+1],s[j+1],s[j])
tube([(0,.65,.04),(0,1.1,.015),(.04,1.6,-.02),(.1,2,-.08)],[.065,.038,.015,.002],(.21,.29,.31),8)
complete('ray')

# Local GLB includes near and reduced-detail prototypes, with original structures borrowed at runtime.
for o in list(models):
    if not o.name.startswith('coral') and o.name!='reef_rock':continue
    previous=bpy.data.objects.get(o.name+'_lod')
    if previous:bpy.data.objects.remove(previous,do_unlink=True)
    low=o.copy();low.data=o.data.copy();low.name=o.name+'_lod';bpy.context.collection.objects.link(low)
    bpy.context.view_layer.objects.active=low
    modifier=low.modifiers.new('Distance silhouette','DECIMATE');modifier.ratio=.24
    bpy.ops.object.modifier_apply(modifier=modifier.name);models.append(low)
bpy.ops.object.select_all(action='DESELECT')
for o in models:
    o.data.validate();o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'marine-kit.glb'),export_format='GLB',use_selection=True,export_apply=True)
records=[]
for i,o in enumerate(models):
    o.data.calc_loop_triangles();records.append({'name':o.name,'triangles':len(o.data.loop_triangles)})
    o.location=((i%5)*5,(i//5)*5,0)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
manifest={'revision':2,'source':'scripts/build-sunken-realism.py','author':'Original LUMENFALL geometry authored for this revision','license':'Original project work; distribution terms remain with project owner.','modifications':'Organic surfaces, smooth normals, tissue vertex albedo, reduced detail meshes; runtime supplies PBR detail and marine deformation.','referenceImage':{'provider':'Higgsfield','model':'gpt_image_2_5','job':'f3278113-7245-488e-a3c8-b6d692576d17','use':'Visual reference for original procedural coral geometry, not a reconstructed mesh'},'sandAlbedo':{'provider':'Higgsfield','model':'gpt_image_2_5','job':'4b1a4f6a-b44d-4eb5-9f89-468786901c09','file':'sand-albedo.png','license':'Generated through the project owner account; subject to provider terms, not represented as CC0.'},'file':'marine-kit.glb','bytes':(OUT/'marine-kit.glb').stat().st_size,'sha256':hashlib.sha256((OUT/'marine-kit.glb').read_bytes()).hexdigest(),'models':records,'originalSourceAssetsModified':False}
manifest['coralAlbedo']={'provider':'Higgsfield','model':'gpt_image_2_5','job':'c891573f-7319-4771-b6a6-6843ce28cd7f','file':'coral-albedo.png','license':'Generated through the project owner account; subject to provider terms, not represented as CC0.'}
manifest['generatedAssetTerms']={'url':'https://higgsfield.ai/creator-hub/help-center/account/who-owns-my-generations-and-can-i-use-them-commercially','checked':'2026-10-09','note':'Provider states it does not claim output ownership or restrict commercial output use, subject to its terms.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
