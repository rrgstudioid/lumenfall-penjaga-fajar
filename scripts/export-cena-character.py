"""Offline body-only export. Run in a separate Blender background process.

The input .blend is read-only; never run this in the artist's live scene.
Animations and sword meshes are deliberately excluded. Procedural base colors
are baked to corner colors; grip pose and corrective geometry become bind pose.
"""
import bpy
import hashlib
import json
import sys
import numpy as np
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
OUT = ROOT / 'public/assets/characters/cena'
WORK = ROOT / 'work/cena-character'
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
before = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False, use_scripts=False)
rig = bpy.data.objects['Cena_Combo03_Rig']
body = bpy.data.objects['Cena_Animated']
grips = [bpy.data.objects['Meteor_Grip.' + side] for side in ('L', 'R')]
source_actions = [a.name for a in bpy.data.actions]
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
    # Fitted finger constraints are the static weapon grip, not action playback.
    for constraint in bone.constraints:
        if constraint.name == 'Meteor fitted grip':
            try:
                constraint.driver_remove('influence')
            except TypeError:
                pass
            constraint.influence = 1.0
        else:
            constraint.mute = True
rig.hide_set(False)
rig.hide_viewport = False
body.hide_set(False)
body.hide_viewport = False
body.hide_render = False
bpy.context.view_layer.update()
grip_matrices = [g.matrix_world.copy() for g in grips]

# Bake actual shader colors without lights/shadows or UV overlap. Dense source
# geometry retains the stylized variation, iris mask, and material boundaries.
color = body.data.color_attributes.new(name='CenaColor', type='FLOAT_COLOR', domain='CORNER')
body.data.color_attributes.active_color = color
roughness = []
for slot in body.material_slots:
    mat = slot.material
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    roughness.append(float(bsdf.inputs['Roughness'].default_value))
    output = next(n for n in mat.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    emission = mat.node_tree.nodes.new('ShaderNodeEmission')
    base = bsdf.inputs['Base Color']
    if base.is_linked:
        mat.node_tree.links.new(base.links[0].from_socket, emission.inputs['Color'])
    else:
        emission.inputs['Color'].default_value = base.default_value
    mat.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
for o in bpy.context.selected_objects:
    o.select_set(False)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 1
bpy.context.scene.render.bake.target = 'VERTEX_COLORS'
print('CENA: baking procedural base colors', flush=True)
bpy.ops.object.bake(type='EMIT')
# Store one averaged, byte-precision color per original vertex. This avoids
# splitting every triangle into separate vertices for tiny bake differences.
corner_colors = np.empty(len(color.data) * 4, dtype=np.float32)
color.data.foreach_get('color', corner_colors)
indices = np.empty(len(body.data.loops), dtype=np.int32)
body.data.loops.foreach_get('vertex_index', indices)
sums = np.zeros((len(body.data.vertices), 4), dtype=np.float32)
np.add.at(sums, indices, corner_colors.reshape(-1, 4))
counts = np.bincount(indices, minlength=len(sums)).clip(min=1)
averages = (sums / counts[:, None]).astype(np.float32)
body.data.color_attributes.remove(color)
color = body.data.color_attributes.new(name='CenaColor', type='BYTE_COLOR', domain='POINT')
color.data.foreach_set('color', averages.ravel())
body.data.color_attributes.active_color = color

# Evaluate shape keys + neck correction + static finger grip ONCE, then retain
# skin weights and all 52 joints using this evaluated pose as the new bind pose.
evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True,
                                     depsgraph=bpy.context.evaluated_depsgraph_get())
assert len(mesh.vertices) == len(body.data.vertices), 'Correction changed topology; weight transfer unsafe'
body.modifiers.clear()
body.data = mesh
rig.select_set(True)
body.select_set(False)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
for p in rig.pose.bones:
    p.matrix = p.matrix.copy()
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
for p in rig.pose.bones:
    for constraint in list(p.constraints):
        p.constraints.remove(constraint)
    p.matrix_basis = Matrix.Identity(4)
modifier = body.modifiers.new('Cena Runtime Skin', 'ARMATURE')
modifier.object = rig
body.name = 'CenaBody'
body.animation_data_clear()

for i, slot in enumerate(body.material_slots):
    material = bpy.data.materials.new(slot.material.name + ' Runtime')
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Roughness'].default_value = roughness[i]
    attr = material.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'CenaColor'
    material.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    slot.material = material

sockets = []
for side, matrix in zip(('L', 'R'), grip_matrices):
    socket = bpy.data.objects.new('WeaponSocket' + side, None)
    bpy.context.scene.collection.objects.link(socket)
    socket.parent = rig
    socket.parent_type = 'BONE'
    socket.parent_bone = 'hand_' + side.lower()
    bpy.context.view_layer.update()
    socket.matrix_world = matrix
    sockets.append(socket)

keep = {rig, body, *sockets}
for obj in list(bpy.data.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
rig.name = 'CenaRig'
for o in keep:
    o.hide_set(False)
    o.hide_render = False
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
assert all(sum(g.weight for g in v.groups) > .99 for v in body.data.vertices)
body.data.calc_loop_triangles()
triangles = len(body.data.loop_triangles)
rig['assetVersion'] = 'cena-body-only-01'
rig['sourceAnimationsEnabled'] = False
rig['sourceSHA256'] = before
export = OUT / 'cena-rigged.glb'
print('CENA: export', triangles, 'triangles', flush=True)
bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB', use_selection=True,
    export_animations=False, export_skins=True, export_morph=False,
    export_apply=False, export_yup=True, export_texcoords=False)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == before
report = dict(source=str(SOURCE), sourceSHA256=before, sourceUnchanged=True,
              output=str(export), bytes=export.stat().st_size, vertices=len(mesh.vertices),
              triangles=triangles, bones=len(rig.data.bones), animationsExported=0,
              excludedSourceActions=len(source_actions), embeddedWeapons=0,
              materials=[s.material.name for s in body.material_slots],
              colorPolicy='Procedural base color baked to averaged vertex colors; roughness retained. Micro-bump not exported.',
              gripPolicy='Static fitted finger grip baked as bind pose; 52 bones retained',
              geometryPolicy='Neck/chin corrections evaluated in neutral body pose; no decimation')
(WORK / 'export-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report), flush=True)
