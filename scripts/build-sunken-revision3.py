"""Original eroded ruins and reef colonies, authored in a NEW background Blender file.
Prior .blend/GLB files are read-only inputs. Runtime applies shared world-space materials.
"""
import bpy, bmesh, math, random, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/sunken-ruins/revision3'
OUT = ROOT / 'dev-assets/sunken-ruins-underwater-v1/revision3'
TARGET = WORK / 'Sunken_Ruins_Reef_and_Ruins.blend'
assert not bpy.data.filepath or Path(bpy.data.filepath).resolve() == TARGET.resolve()
WORK.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.scene.name = 'Sunken Ruins - eroded masonry and reef gardens'
random.seed(1945)
parts=[]; models=[]
mat=bpy.data.materials.new('Original marine limestone and tissue');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value=.83
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color'
mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])

def surface(name, verts, faces, color=(.78,.75,.66), smooth=True):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    data=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(mesh.vertices,data.data):
        weather=.87+.13*noise.noise_vector(v.co*3.8+Vector((8,3,1))).x
        c.color=(*(max(.02,min(1,x*weather)) for x in color),1)
    for p in mesh.polygons:p.use_smooth=smooth
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat);parts.append(obj)
    return obj

def block(center, dimensions, seed=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.scale=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('Rounded eroded arris','BEVEL');bevel.width=min(dimensions)*.15;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=2,use_grid_fill=True)
    bm.to_mesh(obj.data);bm.free()
    for v in obj.data.vertices:
        n=noise.noise_vector(v.co*4+Vector((seed*3.1,seed*.7,seed)))
        v.co+=n*.035
    mesh=obj.data
    data=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(mesh.vertices,data.data):
        a=.80+.07*noise.noise_vector(v.co*5+Vector((seed,0,0))).x;c.color=(a,a*.965,a*.85,1)
    mesh.materials.append(mat);parts.append(obj)
    return obj

def lathe(profile, sides=72, flutes=0, seed=0, broken=False):
    verts=[];faces=[]
    for i,(z,r) in enumerate(profile):
        for j in range(sides):
            a=j*math.tau/sides
            flute=(.025+.027*math.cos(a*flutes)) if flutes else 0
            p=Vector((math.cos(a)*r,math.sin(a)*r,z))
            erosion=noise.noise_vector(p*7+Vector((seed,4,7))).x*.018+noise.noise_vector(p*2+Vector((5,seed,0))).y*.025
            # Deeper irregular losses form vertical chips, with fractured crowns on broken drums.
            chip=max(0,noise.noise_vector(p*2.7+Vector((seed,3,2))).z-.22)*.18
            radius=r-flute+erosion-chip
            h=z+(noise.noise_vector(p*5+Vector((seed,1,0))).z*.11 if broken and i==len(profile)-1 else 0)
            verts.append((math.cos(a)*radius,math.sin(a)*radius,h))
            if i and j>=0:
                k=i*sides+j;prev=i*sides+(j+1)%sides;faces.append((k-sides,prev-sides,prev,k))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(profile)-1)*sides+j for j in range(sides)))
    return surface('Carved and eroded limestone',verts,faces)

def leaf(angle, base, height, radius, width):
    verts=[];faces=[]
    for i in range(13):
        t=i/12;r=radius+math.sin(t*math.pi*.7)*.24
        for j in range(9):
            s=(j/8-.5)*2;w=width*math.sin((t*.85+.1)*math.pi)*(1+.12*math.sin(t*25))
            a=angle+s*w/r
            r1=r+.03*math.cos(s*math.pi*5)*(1-t)
            verts.append((math.cos(a)*r1,math.sin(a)*r1,base+t*height+.045*(1-s*s)))
            if i<12 and j<8:
                k=i*9+j;faces.append((k,k+1,k+10,k+9))
    return surface('Carved acanthus relief',verts,faces,(.84,.80,.69))

def complete(name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if name=='broken_wall':
        radius=max(math.hypot(v.co.x,v.co.y) for v in obj.data.vertices)
        for v in obj.data.vertices:v.co.x*=min(1,2.58/radius);v.co.y*=min(1,2.58/radius)
    obj.data.validate();models.append(obj);parts.clear();return obj

for broken in [False,True]:
    block((0,0,.19),(1.82,1.82,.38),2)
    block((0,0,.48),(1.58,1.58,.23),5)
    lathe([(.55,.71),(.59,.74),(.64,.76),(.70,.72),(.76,.63),(.83,.60),(.89,.62)],seed=1)
    top=3.05 if broken else 5.18
    lathe([(.89+(top-.89)*i/34,.61-.055*i/34) for i in range(35)],flutes=18,seed=2,broken=broken)
    # Deep but tiny seams delineate stacked drums, with chipped beads.
    for z in [1.75,2.69,3.63,4.56]:
        if z>top:continue
        lathe([(z-.018,.577),(z,.582),(z+.018,.575)],seed=int(z*4))
    if not broken:
        lathe([(5.18,.58),(5.24,.62),(5.30,.61),(5.38,.65),(5.65,.76),(5.93,.83),(6.10,.86)],seed=7)
        for i in range(12):leaf(i*math.tau/12,5.30,.70,.64,.17)
        for i in range(8):leaf((i+.5)*math.tau/8,5.70,.56,.77,.22)
        block((0,0,6.25),(1.77,1.77,.28),7)
        block((0,0,6.43),(1.95,1.95,.15),8)
    else:
        block((.75,-.50,.10),(.31,.38,.21),10)
    complete('broken_pillar' if broken else 'pillar')

# Bonded masonry: individual beveled, distorted stones, staggered joints and rubble.
for row in range(4):
    for col in range(5):
        if row==3 and col>1 or row==2 and col==4:continue
        x=(col-2)*.97+(row%2)*.26
        z=.29+row*.57
        obj=block((x,0,z),(.93,.86,.54),row*7+col);obj.rotation_euler.z=(random.random()-.5)*.025
for i in range(6):
    a=i*2.4;obj=block((math.cos(a)*2.15,math.sin(a)*.58,.10),(.23+random.random()*.25,.3,.20),20+i)
    obj.rotation_euler.z=a
complete('broken_wall')

# Voussoir arch keeps the existing portal opening and support transform exactly.
for side in [-1,1]:
    block((side*2,0,.18),(1.45,1.45,.36),side+3)
    for row in range(7):block((side*2,0,.65+row*.46),(1.05,1.22,.44),row+side*5)
for i in range(15):
    a=(i+.5)*math.pi/15
    verts=[]
    for y in [-.64,.64]:
        for r in [1.47,2.52]:
            for j in range(5):
                t=a+(j/4-.5)*(math.pi/15-.008)
                verts.append((r*math.cos(t),y,3.58+r*math.sin(t)))
    faces=[]
    for j in range(4):
        faces.extend([(j,j+1,j+6,j+5),(j+10,j+15,j+16,j+11),(j,j+10,j+11,j+1),(j+5,j+6,j+16,j+15)])
    faces.extend([(0,5,15,10),(4,14,19,9)])
    obj=surface('Eroded voussoir',verts,faces,smooth=False)
    bpy.context.view_layer.objects.active=obj
    b=obj.modifiers.new('Rounded block corners','BEVEL');b.width=.035;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
complete('arch')

block((0,0,.17),(3.95,2.95,.34),81);complete('slab')

# Use copies of the previously original-authored organic meshes to assemble fused reef colonies.
source=ROOT/'work/sunken-ruins/Sunken_Ruins_Realism.blend'
with bpy.data.libraries.load(str(source),link=False) as (available,loaded):
    loaded.objects=[n for n in ['coral_branch','coral_plate','coral_tube','reef_rock'] if n in available.objects]
templates={o.name:o for o in loaded.objects}
def colony_part(name, pos, scale, yaw=0):
    template=templates[name];obj=template.copy();obj.data=template.data.copy()
    bpy.context.collection.objects.link(obj);obj.location=pos;obj.scale=scale;obj.rotation_euler=(0,0,yaw)
    tint={'reef_rock':(.71,.75,.68),'coral_branch':(.95,.53,.52),'coral_plate':(1,.65,.46),'coral_tube':(.76,.53,.90)}[name]
    for color in obj.data.color_attributes['Color'].data:
        color.color=(*(color.color[i]*tint[i] for i in range(3)),color.color[3])
    parts.append(obj)
colony_part('reef_rock',(0,0,0),(.72,.72,.63))
for i in range(5):
    a=i*2.4
    colony_part('coral_plate',(math.cos(a)*.49,math.sin(a)*.4,.24+i*.11),(.53,.53,.55),a)
for i in range(7):
    a=i*2.4
    colony_part('coral_branch',(math.cos(a)*.40,math.sin(a)*.37,.45),(.31,.31,.39+random.random()*.18),a)
colony_part('coral_tube',(.53,-.25,.17),(.42,.42,.62),1.2)
reef=complete('reef_cluster')
rad=max(math.hypot(v.co.x,v.co.y) for v in reef.data.vertices)
for v in reef.data.vertices:v.co.x/=rad;v.co.y/=rad
zmin=min(v.co.z for v in reef.data.vertices);zmax=max(v.co.z for v in reef.data.vertices)
for v in reef.data.vertices:v.co.z=(v.co.z-zmin)/(zmax-zmin)*1.65

# LODs are generated locally; they keep a visible solid silhouette at all presets.
for obj in list(models):
    obj.data.calc_loop_triangles()
    budget={'pillar':14000,'broken_pillar':8000,'broken_wall':12000,'arch':12000,'slab':1000,'reef_cluster':12000}[obj.name]
    if len(obj.data.loop_triangles)>budget:
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Realtime detail budget','DECIMATE');modifier.ratio=budget/len(obj.data.loop_triangles)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for suffix,ratio in [('_lod',.30),('_far',.10)]:
        low=obj.copy();low.data=obj.data.copy();low.name=obj.name+suffix;bpy.context.collection.objects.link(low)
        bpy.context.view_layer.objects.active=low
        modifier=low.modifiers.new('Distance detail','DECIMATE');modifier.ratio=ratio
        bpy.ops.object.modifier_apply(modifier=modifier.name);models.append(low)

bpy.ops.object.select_all(action='DESELECT')
runtime=[o for o in models if '--pbr-runtime' not in sys.argv or not o.name.startswith(('pillar','reef_cluster'))]
for obj in runtime:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ruins-reef-kit.glb'),export_format='GLB',use_selection=True,export_apply=True)
records=[]
for i,obj in enumerate(models):
    obj.data.calc_loop_triangles()
    records.append({'name':obj.name,'triangles':len(obj.data.loop_triangles),'dimensions':list(obj.dimensions),'includedInRuntime':obj in runtime})
    obj.location=((i%7)*6,(i//7)*8,0)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
manifest={'revision':3,'mapId':'sunken-ruins-underwater-v1','source':'scripts/build-sunken-revision3.py','author':'Original LUMENFALL geometry authored for this revision','license':'Original project work; distribution terms remain with the project owner.','modifications':'Eroded fluted columns and carved capitals; rounded bonded masonry, voussoir arch, continuous reef colonies; three local geometry LODs. Runtime supplies material detail, instancing and collision.','originalSourceAssetsModified':False,'file':'ruins-reef-kit.glb','bytes':(OUT/'ruins-reef-kit.glb').stat().st_size,'sha256':hashlib.sha256((OUT/'ruins-reef-kit.glb').read_bytes()).hexdigest(),'models':records,'references':[{'provider':'Higgsfield','model':'gpt_image_2_5','job':'f92fe60c-7b94-4f5e-8400-8fba119344a1','use':'Visual design reference for original authored column, not photogrammetry reconstruction'},{'provider':'Higgsfield','model':'gpt_image_2_5','job':'4e46eb9f-97f0-44b2-9d59-31ddd78d873d','file':'limestone-albedo.png','use':'Generated tiling albedo, subject to provider terms; not represented as CC0'}],'tripo':{'manifest':'tripo-manifest.json','runtimeUsesTripo':'--pbr-runtime' in sys.argv,'note':'Hero pillar and reef are separate approved Tripo assets; authored duplicates excluded from the PBR runtime export.'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
