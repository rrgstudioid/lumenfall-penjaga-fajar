// Animation-only conversion from the three approved saved Cena Run actions.
// Input sampling: Blender background --python scripts/sample-cena-run.py -- <checkpoint>.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { balanceCenaRunNeck, balanceCenaRunTorso } from '../lib/game/cena-run-posture.ts';

const sampled = JSON.parse(await readFile('work/cena-character/run-samples.json', 'utf8'));
const bytes = await readFile('public/assets/characters/cena/cena-rigged.glb');
const targetSHA256 = createHash('sha256').update(bytes).digest('hex');
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
scene.updateMatrixWorld(true);
const bones = [];
scene.traverse(o => {
  if (o instanceof T.Bone && !/thumb|index|middle|ring|pinky/.test(o.name)) bones.push(o);
});
const depth = o => o.parent ? depth(o.parent) + 1 : 0;
bones.sort((a, b) => depth(a) - depth(b));
const q = data => new T.Quaternion().fromArray(data);
const p = data => new T.Vector3().fromArray(data);
const bindings = bones.map(bone => ({ bone,
  sourceRestInverse: q(sampled.rest[bone.name].q).invert(),
  targetRest: bone.getWorldQuaternion(new T.Quaternion()),
  targetPosition: bone.getWorldPosition(new T.Vector3()),
  localPosition: bone.position.clone(), localRotation: bone.quaternion.clone(),
}));
const pelvis = bindings.find(b => b.bone.name === 'pelvis');
const neck = bindings.find(b => b.bone.name === 'neck_01');
const head = bindings.find(b => b.bone.name === 'head');
const spine = ['spine_01', 'spine_02', 'spine_03'].map(name => scene.getObjectByName(name));
const clips = [], diagnostics = [];
for (const source of sampled.clips) {
  const name = source.name === 'Loop' ? 'Run' : 'Run_' + source.name;
  const times = [], rotations = bindings.map(() => []), positions = [];
  for (let index = 0; index < source.frames.length; index++) {
    const frame = source.frames[index];
    for (const b of bindings) { b.bone.position.copy(b.localPosition); b.bone.quaternion.copy(b.localRotation); }
    scene.updateMatrixWorld(true);
    for (const b of bindings) {
      const desired = q(frame[b.bone.name].q).multiply(b.sourceRestInverse).multiply(b.targetRest);
      b.bone.quaternion.copy(b.bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(desired)).normalize();
      if (b === pelvis) {
        const delta = p(frame.pelvis.p).sub(p(sampled.rest.pelvis.p));
        b.bone.position.copy(b.bone.parent.worldToLocal(b.targetPosition.clone().add(delta)));
      }
      b.bone.updateWorldMatrix(false, true);
    }
    // Owner-requested natural running posture: first undo excessive torso fold,
    // then distribute cervical correction, keeping gaze, stride and timing.
    balanceCenaRunTorso(spine, neck.bone, head.bone);
    balanceCenaRunNeck(neck.bone, head.bone, neck.targetRest, head.targetRest);
    times.push(index / source.fps);
    positions.push(...pelvis.bone.position.toArray());
    bindings.forEach((b, i) => {
      const rotation = b.bone.quaternion.clone(), values = rotations[i];
      if (values.length && rotation.dot(q(values.slice(-4))) < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
      values.push(...rotation.toArray());
    });
  }
  // Seal the source's tiny (<0.06 degree) cyclic seam, not Start/Stop endpoints.
  if (name === 'Run') {
    rotations.forEach(values => values.splice(-4, 4, ...values.slice(0, 4)));
    positions.splice(-3, 3, ...positions.slice(0, 3));
  }
  const tracks = bindings.map((b, i) => new T.QuaternionKeyframeTrack(b.bone.name + '.quaternion', times, rotations[i]));
  tracks.push(new T.VectorKeyframeTrack('pelvis.position', times, positions));
  const clip = T.AnimationClip.toJSON(new T.AnimationClip(name, source.duration, tracks));
  const id = createHash('sha256').update(sampled.sourceSHA256 + targetSHA256 + source.sourceAction + ':natural-run-posture-v2').digest('hex');
  clip.uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
  clips.push(clip);
  diagnostics.push({ name, sourceAction: source.sourceAction, frames: times.length, duration: source.duration });
}
const pack = { version: 1, source: sampled.source, sourceSHA256: sampled.sourceSHA256, targetSHA256,
  policy: 'Approved Run F 0 Start/Loop/Stop, in-place, 60 FPS; natural torso lean and cervical balance; gaze, stride, bone lengths, finger grip and body geometry preserved.',
  diagnostics, clips };
await writeFile('public/assets/characters/cena/cena-run-f0.json', JSON.stringify(pack, (_key, value) => typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
console.log(JSON.stringify({ sourceUnchanged: sampled.sourceUnchanged, diagnostics }, null, 2));
