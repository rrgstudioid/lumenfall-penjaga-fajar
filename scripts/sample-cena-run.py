"""Read only a saved Cena rig/actions in a separate background Blender process.

No scene save, geometry export, or interaction with the artist's live Blender.
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[sys.argv.index('--') + 1])
digest = hashlib.sha256(source.read_bytes()).hexdigest()
names = {kind: 'Cena_SS_Run_' + kind + '_F_0_InPlace' for kind in ('Start', 'Loop', 'Stop')}
with bpy.data.libraries.load(str(source), link=False) as (src, dst):
    assert all(name in src.actions for name in names.values())
    dst.objects = ['Cena_Combo03_Rig']
    dst.actions = list(names.values())
rig = dst.objects[0]
bpy.context.scene.collection.objects.link(rig)
rig.animation_data_clear()
# Fingers retain the runtime's fitted grip; they are intentionally not exported.
for bone in rig.pose.bones:
    for constraint in list(bone.constraints):
        bone.constraints.remove(constraint)
    bone.matrix_basis = Matrix.Identity(4)
rig.animation_data_create()
convert = Matrix.Rotation(-math.pi / 2, 4, 'X')
def pose(matrix):
    matrix = convert @ matrix
    q = matrix.to_quaternion().normalized()
    return {'q': [q.x, q.y, q.z, q.w], 'p': list(matrix.translation)}
rest = {b.name: pose(b.matrix_local) for b in rig.data.bones}
clips = []
for kind, name in names.items():
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    first, last = [int(f) for f in action.frame_range]
    assert action.get('fps') == 60
    frames = []
    for frame in range(first, last + 1):
        bpy.context.scene.frame_set(frame)
        frames.append({b.name: pose(b.matrix) for b in rig.pose.bones})
    clips.append({'name': kind, 'sourceAction': name, 'fps': 60,
                  'duration': (last - first) / 60, 'frames': frames})
assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
output = root / 'work/cena-character/run-samples.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'source': source.name, 'sourceSHA256': digest,
                             'sourceUnchanged': True, 'rest': rest, 'clips': clips}), encoding='utf-8')
print('CENA_RUN_SAMPLED', str(output), [(c['name'], len(c['frames'])) for c in clips], flush=True)
