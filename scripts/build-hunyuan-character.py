"""Bind the original textured Hunyuan mesh and bake Lumenfall animations in Blender."""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/characters/astra-hunyuan'
WORK = ROOT / 'work/hunyuan-character/rigged'
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'exports/characters/astra-hunyuan-textured/astra-hunyuan-textured.glb'))
body = next(o for o in bpy.data.objects if o.type == 'MESH')
matrix = body.matrix_world.copy()
body.parent = None
body.matrix_world = Matrix.Identity(4)
body.data.transform(matrix)
floor = min(v.co.z for v in body.data.vertices)
body.data.transform(Matrix.Translation((0, 0, -floor)))
body.name = 'AstraHunyuanBody'
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
bm.to_mesh(body.data); bm.free(); body.data.update()
for p in body.data.polygons: p.use_smooth = True
for obj in list(bpy.data.objects):
    if obj != body: bpy.data.objects.remove(obj, do_unlink=True)
print('BODY', len(body.data.vertices), 'vertices', len(body.data.polygons), 'faces', flush=True)

old = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/characters/male-revision-02/male-revision-02-dual-sword.glb'))
source_objects = set(bpy.data.objects) - old
source = next(o for o in source_objects if o.type == 'ARMATURE')
source.animation_data.action = None
for t in source.animation_data.nla_tracks: t.mute = True
for p in source.pose.bones: p.matrix_basis = Matrix.Identity(4)
clips = {a.name: a for a in bpy.data.actions if a.name in ['Walk', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03']}
old = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/animations/army-running/army-running-revision02.glb'))
run_objects = set(bpy.data.objects) - old
run_arm = next(o for o in run_objects if o.type == 'ARMATURE')
clips['Run'] = run_arm.animation_data.action or run_arm.animation_data.nla_tracks[0].strips[0].action
for obj in run_objects: bpy.data.objects.remove(obj, do_unlink=True)

data = bpy.data.armatures.new('AstraHunyuanSkeleton')
rig = bpy.data.objects.new('AstraHunyuanRig', data)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
# Landmarks fitted to this mesh in its own rest pose; forward is Blender -Y.
positions = {
    'Root': ((0, 0, 0), (0, 0, .15), None),
    'Hips': ((0, .005, .91), (0, .005, 1.035), 'Root'),
    'Spine': ((0, .005, 1.035), (0, .005, 1.24), 'Hips'),
    'Chest': ((0, .005, 1.24), (0, .005, 1.47), 'Spine'),
    'Neck': ((0, .005, 1.47), (0, .005, 1.60), 'Chest'),
    'Head': ((0, .005, 1.60), (0, .005, 1.88), 'Neck'),
}
for side, sign in [('L', 1), ('R', -1)]:
    def p(x, y, z): return (sign*x, y, z)
    positions.update({
        'Shoulder.'+side: (p(.035, 0, 1.46), p(.227, 0, 1.435), 'Chest'),
        'UpperArm.'+side: (p(.227, 0, 1.435), p(.307, -.004, 1.205), 'Shoulder.'+side),
        'LowerArm.'+side: (p(.307, -.004, 1.205), p(.388, -.027, .994), 'UpperArm.'+side),
        'Hand.'+side: (p(.388, -.027, .994), p(.414, -.04, .884), 'LowerArm.'+side),
        'Thigh.'+side: (p(.115, .008, .91), p(.165, -.014, .565), 'Hips'),
        'Shin.'+side: (p(.165, -.014, .565), p(.192, .005, .16), 'Thigh.'+side),
        'Foot.'+side: (p(.192, .005, .16), p(.192, -.15, .065), 'Shin.'+side),
    })
for name, (head, tail, parent) in positions.items():
    bone = data.edit_bones.new(name); bone.head = head; bone.tail = tail
    if parent: bone.parent = data.edit_bones[parent]
    bone.align_roll(source.data.bones[name].matrix_local.to_3x3() @ Vector((0, 0, 1)))
    bone.use_deform = name != 'Root'
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert len(body.vertex_groups) > 10, 'Heat binding failed'
if any(sum(g.weight for g in v.groups) <= .001 for v in body.data.vertices):
    # Generated surfaces contain tiny, narrow triangles that can break heat solving.
    # Solve weights on a regular voxel proxy and transfer them to the untouched UV mesh.
    print('REGULAR PROXY SKIN SOLVE', flush=True)
    proxy = body.copy(); proxy.data = body.data.copy(); proxy.name = 'WeightSolveProxy'
    bpy.context.collection.objects.link(proxy); proxy.parent = None
    proxy.modifiers.clear(); proxy.vertex_groups.clear()
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxy
    remesh = proxy.modifiers.new('RegularWeightTopology', 'REMESH')
    remesh.mode = 'VOXEL'; remesh.voxel_size = .014; remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = proxy.modifiers.new('WeightProxySmooth', 'SMOOTH'); smooth.factor = .5; smooth.iterations = 3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    good = [v for v in proxy.data.vertices if sum(g.weight for g in v.groups) > .001]
    assert len(good) > len(proxy.data.vertices)*.95, 'Proxy heat solve failed'
    tree = KDTree(len(good))
    for i, v in enumerate(good): tree.insert(v.co, i)
    tree.balance(); body.vertex_groups.clear()
    for group in proxy.vertex_groups: body.vertex_groups.new(name=group.name)
    for v in body.data.vertices:
        weights = {}
        for _, index, dist in tree.find_n(v.co, 3):
            for g in good[index].groups:
                weights[g.group] = weights.get(g.group, 0) + g.weight / max(dist, .00001)**2
        selected = sorted(weights.items(), key=lambda e:e[1], reverse=True)[:4]
        total = sum(w for _, w in selected)
        for group, weight in selected: body.vertex_groups[group].add([v.index], weight/total, 'REPLACE')
    bpy.data.objects.remove(proxy, do_unlink=True)
assert all(sum(g.weight for g in v.groups) > .001 for v in body.data.vertices), 'Unweighted vertices'
# A solid skull and closed fists must not bend with adjacent upper-arm bones.
for v in body.data.vertices:
    x, y, z = v.co
    rigid = 'Head' if z > 1.63 else ('Hand.L' if x > 0 else 'Hand.R') if abs(x) > .355 and z < .965 else None
    if rigid:
        for group in body.vertex_groups: group.remove([v.index])
        body.vertex_groups[rigid].add([v.index], 1, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
print('SKIN BOUND', flush=True)

for name, bone, point in [
    ('WeaponSocket.L', 'Hand.L', (.410, -.040, .925)),
    ('WeaponSocket.R', 'Hand.R', (-.410, -.040, .925)),
    ('BackSocket', 'Chest', (0, .13, 1.31)),
    ('HairSocket', 'Head', (0, 0, 1.88)),
]:
    socket = bpy.data.objects.new('Astra_'+name, None)
    socket['finalSocketName'] = name; bpy.context.collection.objects.link(socket)
    socket.parent = rig; socket.parent_type = 'BONE'; socket.parent_bone = bone
    bpy.context.view_layer.update(); socket.matrix_world = Matrix.Translation(Vector(point))

def depth(b): return 0 if not b.parent else depth(b.parent)+1
ordered = sorted(data.bones, key=depth)
corrections = {}
for bone in ordered:
    sq = source.data.bones[bone.name].matrix_local.to_quaternion()
    tq = bone.matrix_local.to_quaternion()
    swing = (tq @ Vector((0, 1, 0))).rotation_difference(sq @ Vector((0, 1, 0)))
    corrections[bone.name] = sq.inverted() @ swing @ tq
    if bone.name in ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head']:
        corrections[bone.name] = sq.inverted() @ tq
scale = (data.bones['Thigh.L'].length+data.bones['Shin.L'].length)/(source.data.bones['Thigh.L'].length+source.data.bones['Shin.L'].length)
ground = json.loads((ROOT / 'work/army-running/retarget-report.json').read_text())['ground']
source.animation_data_create(); rig.animation_data_create(); baked = []; ranges = {}
for name, clip in clips.items():
    print('RETARGET', name, flush=True)
    source.animation_data.action = clip; source.animation_data.action_slot = clip.slots[0]
    start, end = clip.frame_range
    frames = int(round(end-start)); poses = []; grounded = []
    for i in range(frames+1):
        f = start+i
        bpy.context.scene.frame_set(math.floor(f), subframe=f % 1)
        for p in rig.pose.bones: p.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        for bone in ordered:
            pb = rig.pose.bones[bone.name]; sp = source.pose.bones[bone.name]
            desired = sp.matrix.to_quaternion() @ corrections[bone.name]
            parent = pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() if pb.parent else Matrix.Identity(4)
            frame = parent @ bone.matrix_local
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = frame.to_quaternion().inverted() @ desired
            if bone.name == 'Hips':
                delta = sp.matrix.translation-source.data.bones['Hips'].matrix_local.translation
                pb.location = frame.to_3x3().inverted() @ (delta*scale)
            bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        posed = evaluated.to_mesh()
        lowest = min((evaluated.matrix_world @ v.co).z for v in posed.vertices)
        evaluated.to_mesh_clear()
        flight = ground[min(round(i/frames*(len(ground)-1)), len(ground)-1)]['flight']*scale if name == 'Run' else 0
        pb = rig.pose.bones['Hips']
        frame = (pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() @ pb.bone.matrix_local).to_3x3()
        pb.location += frame.inverted() @ Vector((0, 0, flight-lowest))
        bpy.context.view_layer.update(); grounded.append(flight)
        poses.append({p.name: (p.rotation_quaternion.copy(), p.location.copy()) for p in rig.pose.bones})
    if name in ['Walk', 'Run']: poses[-1] = poses[0]
    action = bpy.data.actions.new('Astra_'+name)
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots.new('OBJECT', rig.name)
    for i, pose in enumerate(poses):
        for bone, (q, loc) in pose.items():
            pb = rig.pose.bones[bone]; pb.rotation_quaternion = q; pb.location = loc
            pb.keyframe_insert('rotation_quaternion', frame=i, group=bone)
            if bone == 'Hips': pb.keyframe_insert('location', frame=i, group=bone)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for k in curve.keyframe_points: k.interpolation = 'LINEAR'
    baked.append((name, action, frames)); rig.animation_data.action = None
    ranges[name] = [min(grounded), max(grounded)]

for obj in source_objects: bpy.data.objects.remove(obj, do_unlink=True)
for obj in bpy.data.objects:
    if 'finalSocketName' in obj: obj.name = obj['finalSocketName']
for name, action, frames in baked:
    track = rig.animation_data.nla_tracks.new(); track.name = name
    track.strips.new(name, 0, action); track.mute = True
for a in list(bpy.data.actions):
    if a not in [entry[1] for entry in baked]: bpy.data.actions.remove(a, do_unlink=True)
rig['assetKind'] = 'astra-hunyuan'; rig['assetVersion'] = 'astra-hunyuan-rigged-01'
rig.animation_data.action = None
for p in rig.pose.bones: p.matrix_basis = Matrix.Identity(4)
bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(OUT / 'astra-hunyuan-rigged.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
    export_skins=True, export_rest_position_armature=True, export_extras=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'astra-hunyuan-rigged.blend'))
report = {'triangles': sum(len(p.vertices)-2 for p in body.data.polygons), 'vertices': len(body.data.vertices),
    'bones': len(data.bones), 'unweightedVertices': sum(not v.groups for v in body.data.vertices),
    'clips': {name: frames/60 for name, _, frames in baked}, 'groundRanges': ranges,
    'texture': [2048, 2048], 'sourceShapePreserved': True}
(WORK / 'rig-report.json').write_text(json.dumps(report, indent=2))
print('HUNYUAN RIG COMPLETE', json.dumps(report), flush=True)
