"""Stage/rig the supplied Dragon Veil meshes. Run in an isolated Blender process.
Never opens or saves the owner's live scene or writes source assets.
Prerequisite: node scripts/pack-dragon-veil.mjs --prepare
"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/dragon-veil'
SOURCE = Path('D:/Item Lumenfall')
FILES = ['Head DV.glb', 'Armor Full DV.glb', 'Pants and Boots DV.glb']
hashes = {n: hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in FILES}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(WORK/'body-lod0.glb'))
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
body = next(o for o in scene.objects if o.type == 'MESH')
for o in list(scene.objects):
    if o not in [rig, body]: bpy.data.objects.remove(o, do_unlink=True)

def select(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o

def load(name):
    before = set(scene.objects); bpy.ops.import_scene.gltf(filepath=str(SOURCE/name))
    obj = next(o for o in set(scene.objects)-before if o.type == 'MESH')
    select(obj); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def subset(source, name, predicate):
    obj = source.copy(); obj.data = source.data.copy(); scene.collection.objects.link(obj); obj.name = name
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not predicate(f.calc_center_median())], context='FACES')
    # Remove disconnected loose points left by face selection.
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return obj

def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a))); return t*t*(3-2*t)

def bind(obj, weights):
    obj.vertex_groups.clear()
    groups = {b.name: obj.vertex_groups.new(name=b.name) for b in rig.data.bones}
    for v in obj.data.vertices:
        ws = weights(v); total = sum(ws.values())
        for name, value in ws.items():
            if value > 1e-6: groups[name].add([v.index], value/total, 'REPLACE')
    obj.parent = rig
    mod = obj.modifiers.new('DragonVeilSkin', 'ARMATURE'); mod.object = rig
    for p in obj.data.polygons: p.use_smooth = True
    for mat in obj.data.materials:
        mat.use_backface_culling = False

head = load('Head DV.glb'); head.name = 'DragonVeilHead'
for v in head.data.vertices:
    x,y,z = v.co; v.co = (x*.63, y*.80-.015, z*.66+1.47)
bind(head, lambda v: {'head': 1})

armor_source = load('Armor Full DV.glb')
def is_sleeve(p):
    return abs(p.x)>.235 and -.15<p.y<.035 and .24<p.z<.79
armor = subset(armor_source, 'DragonVeilArmor', lambda p: not is_sleeve(p))
sleeves = [subset(armor_source, 'Sleeve'+side, lambda p,sign=sign: is_sleeve(p) and p.x*sign>0) for side,sign in [('L',1),('R',-1)]]
for obj in sleeves:
    group=obj.vertex_groups.new(name='SOURCE_SLEEVE'); group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
select(armor)
for obj in sleeves: obj.select_set(True)
bpy.ops.object.join()
bpy.data.objects.remove(armor_source, do_unlink=True)
sleeve_group=armor.vertex_groups.get('SOURCE_SLEEVE').index
sleeve_vertices={v.index for v in armor.data.vertices if any(g.group==sleeve_group for g in v.groups)}
# Connected ornamental plates keep one rigid attachment instead of shearing
# across coordinate thresholds. Weld only the connectivity graph, never source UVs.
parents=list(range(len(armor.data.vertices)))
def find(i):
    while parents[i]!=i: parents[i]=parents[parents[i]]; i=parents[i]
    return i
def union(a,b): parents[find(a)]=find(b)
points={}
for v in armor.data.vertices:
    key=tuple(round(c,5) for c in v.co)
    if key in points: union(v.index,points[key])
    else: points[key]=v.index
for edge in armor.data.edges: union(*edge.vertices)
components={}
for v in armor.data.vertices: components.setdefault(find(v.index),[]).append(v)
shoulder_vertices=set()
for vertices in components.values():
    if min(v.co.z for v in vertices)>.63 and abs(sum(v.co.x for v in vertices)/len(vertices))>.15:
        shoulder_vertices.update(v.index for v in vertices)
armor_weights = {}
for v in armor.data.vertices:
    x,y,z = v.co; ax = abs(x); side = 'l' if x > 0 else 'r'; sign = 1 if x > 0 else -1
    # Unfold the authored hanging sleeves into the existing T-pose. The shoulders
    # remain broad/rigid; the lower sleeves are centered on elbow, wrist and hand.
    arm = 1 if v.index in sleeve_vertices else 0
    if v.index in shoulder_vertices: arm=0
    shoulder = Vector((sign*.20, .005, 1.375))
    torso = Vector((x*1.17, y*1.20, z*1.16+.31))
    length = max(0, (.79-z)) * 1.13
    sleeve = Vector((sign*(.22+length), y*1.15, 1.37+(ax-.275)*1.55))
    v.co = torso.lerp(sleeve, arm)
    px,py,pz = v.co; pax = abs(px)
    if v.index in shoulder_vertices:
        ws = {'clavicle_'+side: 1}
    elif arm > .5:
        elbow = smooth(.41,.51,pax); hand = smooth(.705,.77,pax)
        ws = {'upperarm_'+side: (1-elbow), 'lowerarm_'+side: elbow*(1-hand), 'hand_'+side: elbow*hand}
    elif z > .69 and ax > .19:
        ws = {'upperarm_'+side: 1}
    elif y > .04 and z < .68:
        # Cape follows torso/pelvis, never the nearest hand or opposite leg.
        t = smooth(.35,.70,z); ws = {'pelvis': 1-t, 'spine_03': t}
    else:
        chest = smooth(1.07,1.25,pz); hip = 1-smooth(.91,1.08,pz)
        ws = {'pelvis': hip, 'spine_01': (1-hip)*(1-chest), 'spine_03': (1-hip)*chest}
    armor_weights[v.index] = ws
bind(armor, lambda v: armor_weights[v.index])

lower = load('Pants and Boots DV.glb')
legs = subset(lower, 'DragonVeilLegs', lambda p: p.x < -.17 and p.z > .42)
# Cut below the complete kneecap, not through its center. Bisect preserves UV
# interpolation and makes an even open cuff instead of dropping crossing faces.
bm = bmesh.new(); bm.from_mesh(legs.data)
bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
    dist=1e-7, plane_co=(0,0,.65), plane_no=(0,0,1), clear_inner=True)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(legs.data); bm.free(); legs.data.update()
boots = subset(lower, 'DragonVeilBoots', lambda p: p.x < -.17 and p.z < .40)
for v in legs.data.vertices:
    x,y,z = v.co
    # Match waist, knee and cuff landmarks independently. Keep the waistband
    # above the base tunic hem and give the rear fabric enough depth to wrap hips.
    height = .46+(z-.65)*(.09/.07) if z<.72 else .55+(z-.72)*(.485/.276582)
    # Extend the uneven upper rim beneath the tunic so side/back views remain
    # closed during spine flexion; the knee and cuff landmarks stay unchanged.
    height += .045 * smooth(.85,1.035,height)
    center = x+.315
    spread = .022 * (1-smooth(.80,.95,z)) * math.tanh(center/.035)
    v.co = (center*1.88+spread, y*1.75+.012, height)
for v in boots.data.vertices:
    x,y,z = v.co; t=x+.315; sign=1 if t>0 else -1
    v.co = (sign*.205+(t-sign*.077)*2.3, y*2.05-.015, z*1.40+.007)
bpy.data.objects.remove(lower, do_unlink=True)
def leg_weights(v):
    x,y,z = v.co; side = 'l' if x > 0 else 'r'
    hip = smooth(.80,.97,z); knee = 1-smooth(.45,.55,z)
    # Match the canonical body's pelvis/spine blend at the waistband. A rigid
    # pelvis-only waist separates from the tunic when the torso bends in attacks.
    spine = smooth(.94,1.10,z)
    return {'pelvis': hip*(1-spine), 'spine_01': hip*spine,
            'thigh_'+side: (1-hip)*(1-knee), 'calf_'+side: (1-hip)*knee}
def boot_weights(v):
    x,y,z = v.co; side = 'l' if x > 0 else 'r'; ankle = 1-smooth(.10,.22,z)
    return {'calf_'+side: 1-ankle, 'foot_'+side: ankle}
bind(legs, leg_weights); bind(boots, boot_weights)
pieces = {'head': head, 'armor': armor, 'legs': legs, 'boots': boots}

report = {'version': 2, 'sources': hashes, 'target': 'male-v2', 'pieces': {}}
for name,obj in pieces.items():
    count = sum(len(p.vertices)-2 for p in obj.data.polygons)
    report['pieces'][name] = {'sourceTriangles': count}
    for lod,ratio in enumerate([1,.60,.35,.20]):
        copy = obj.copy(); copy.data = obj.data.copy(); scene.collection.objects.link(copy); select(copy)
        if lod:
            # Imported UV seams duplicate vertices. Collapse only after welding
            # their positions; simplifying isolated UV islands opens visible cracks.
            bm=bmesh.new(); bm.from_mesh(copy.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
            bm.to_mesh(copy.data); bm.free(); copy.data.update()
            mod = copy.modifiers.new('LOD', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        rig.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(WORK/f'{name}-lod{lod}.glb'), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_extras=True)
        bpy.data.objects.remove(copy, do_unlink=True)

# Staging scene includes the canonical body for fitting review, never runtime duplication.
mat = bpy.data.materials.new('InspectionBody'); mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(ROOT/'public/assets/characters/male-v2/textures/body-basecolor-2048.webp'))
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value=.8
body.data.materials.clear(); body.data.materials.append(mat)
scene.render.engine='CYCLES'; scene.cycles.samples=16
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('DragonVeilStudio'); scene.world.use_nodes=True
background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'); background.inputs[0].default_value=(.23,.26,.3,1); background.inputs[1].default_value=.7
for loc,power,size in [((3,-4,5),550,4),((-3,-2,3),300,3),((1,3,4),550,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); lamp=bpy.context.object; lamp.data.energy=power; lamp.data.shape='DISK'; lamp.data.size=size
    lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; cam.data.type='ORTHO'; scene.camera=cam
def render(path,loc,target,scale,size):
    scene.render.resolution_x=size[0]; scene.render.resolution_y=size[1]; scene.render.resolution_percentage=100
    cam.location=loc; cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=scale
    scene.render.filepath=str(WORK/path); bpy.ops.render.render(write_still=True)
for name,obj in pieces.items():
    body.hide_render=True
    for p in pieces.values(): p.hide_render=p!=obj
    # Armor icon uses the same bound mesh in the natural arms-down pose.
    for side,angle in [('l',1.22),('r',-1.22)]:
        b=rig.pose.bones['upperarm_'+side]; b.rotation_mode='QUATERNION'; q=b.bone.matrix_local.to_quaternion()
        b.rotation_quaternion=q.inverted() @ Quaternion((0,1,0),angle) @ q
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get(); evaluated=obj.evaluated_get(deps)
    box=[obj.matrix_world@Vector(p) for p in evaluated.bound_box]; low=Vector([min(v[k]for v in box)for k in range(3)]); high=Vector([max(v[k]for v in box)for k in range(3)])
    center=(low+high)*.5; span=max(high.x-low.x,high.z-low.z)*1.22
    render(f'icon-{name}.png',center+Vector((0,-5,.12)),center,span,(512,512))
for p in pieces.values(): p.hide_render=False
body.hide_render=False
for b in rig.pose.bones: b.rotation_quaternion=(1,0,0,0); b.rotation_euler=(0,0,0)
render('fit-tpose.png',(2.7,-5,2.25),(0,0,1.05),2.6,(900,900))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'dragon-veil-staging.blend'))
for n,h in hashes.items(): assert hashlib.sha256((SOURCE/n).read_bytes()).hexdigest()==h
(WORK/'build-report.json').write_text(json.dumps(report,indent=2))
print('DRAGON_VEIL_BUILD',json.dumps(report))
