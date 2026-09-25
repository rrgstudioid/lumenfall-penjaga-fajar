import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';
import { softenCenaNeckWeights } from './cena-neck.ts';
import { balanceCenaRunNeck, balanceCenaRunTorso } from './cena-run-posture.ts';
import { cloneCharacterSource } from './revision02-character.ts';

async function body() {
  const b = await readFile(new URL('../../public/assets/characters/cena/cena-rigged.glb', import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
}

await test('cervical weights are smooth, local, normalized and idempotent; source/geometry/face/shoulders remain untouched', async () => {
  const source = await body(), model = cloneCharacterSource(source);
  const original = source.getObjectByName('Cena_OBJ003') as T.SkinnedMesh;
  const skin = model.getObjectByName('Cena_OBJ003') as T.SkinnedMesh;
  const before = new Float32Array(original.geometry.attributes.skinWeight.array);
  const skeleton = skin.skeleton.bones.map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);
  softenCenaNeckWeights(model);
  const a = original.geometry.attributes, b = skin.geometry.attributes;
  let changed = 0;
  const values = (attrs: typeof a, i: number) => {
    const result = new Map<number, number>();
    for (let c = 0; c < 4; c++) if (attrs.skinWeight.getComponent(i, c)) result.set(attrs.skinIndex.getComponent(i, c), attrs.skinWeight.getComponent(i, c));
    return result;
  };
  for (let i = 0; i < a.position.count; i++) {
    const from = values(a, i), to = values(b, i);
    assert.ok(Math.abs([...to.values()].reduce((sum, w) => sum + w, 0) - 1) < 1e-5);
    const delta = Math.max(...[...new Set([...from.keys(), ...to.keys()])].map(id => Math.abs((to.get(id) ?? 0) - (from.get(id) ?? 0))));
    if (delta > 1e-6) {
      changed++;
      assert.ok(a.position.getY(i) > 1.62 && a.position.getY(i) < 1.80 && Math.abs(a.position.getX(i)) < .12);
      for (const id of to.keys()) assert.ok(['spine_03', 'neck_01', 'head'].includes(skin.skeleton.bones[id].name));
    }
  }
  assert.ok(changed > 50 && changed < 1500, `localized vertices: ${changed}`);
  for (const name of ['position', 'normal', 'color']) assert.deepEqual(b[name].array, a[name].array);
  assert.deepEqual(skin.geometry.index!.array, original.geometry.index!.array);
  assert.deepEqual(skeleton, skin.skeleton.bones.map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]));
  assert.deepEqual(original.geometry.attributes.skinWeight.array, before);
  const once = b.skinWeight.array.slice(); softenCenaNeckWeights(model);
  assert.deepEqual(b.skinWeight.array, once);
  console.log({ cervicalVerticesAdjusted: changed });
});

await test('Run neck correction distributes bend without changing gaze, lengths, limbs or mesh', async () => {
  const model = await body(); model.updateMatrixWorld(true);
  const neck = model.getObjectByName('neck_01')!, head = model.getObjectByName('head')!;
  const neckRest = neck.getWorldQuaternion(new T.Quaternion()), headRest = head.getWorldQuaternion(new T.Quaternion());
  const localPositions = [neck.position.clone(), head.position.clone()];
  const chest = model.getObjectByName('spine_03')!;
  chest.rotateX(.5); head.rotateX(-.5); model.updateMatrixWorld(true);
  const gaze = head.getWorldQuaternion(new T.Quaternion());
  const ideal = gaze.clone().multiply(headRest.clone().invert()).multiply(neckRest);
  const priorError = neck.getWorldQuaternion(new T.Quaternion()).angleTo(ideal);
  const arms = ['hand_r', 'hand_l', 'foot_r', 'foot_l'].map(n => model.getObjectByName(n)!.matrixWorld.clone());
  balanceCenaRunNeck(neck, head, neckRest, headRest);
  assert.ok(head.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(gaze.normalize()) < 1e-6);
  assert.ok(neck.getWorldQuaternion(new T.Quaternion()).angleTo(ideal) < priorError * .36);
  assert.deepEqual([neck.position, head.position], localPositions);
  for (const [i, name] of ['hand_r', 'hand_l', 'foot_r', 'foot_l'].entries()) assert.deepEqual(model.getObjectByName(name)!.matrixWorld, arms[i]);
});

await test('natural Run torso correction preserves pelvis/stride, limb articulation, gaze and every bone length', async () => {
  const model = await body(); model.updateMatrixWorld(true);
  const spine = ['spine_01', 'spine_02', 'spine_03'].map(n => model.getObjectByName(n)!);
  const neck = model.getObjectByName('neck_01')!, head = model.getObjectByName('head')!;
  spine[0].rotateX(.6); spine[1].rotateX(.2); model.updateMatrixWorld(true);
  const snapshot = new Map<T.Bone, { p: number[]; scale: number[]; q: number[]; world: number[] }>();
  model.traverse(o => { if (o instanceof T.Bone) snapshot.set(o, { p: o.position.toArray(), scale: o.scale.toArray(), q: o.quaternion.toArray(), world: o.matrixWorld.toArray() }); });
  const gaze = head.getWorldQuaternion(new T.Quaternion());
  balanceCenaRunTorso(spine, neck, head);
  model.updateMatrixWorld(true);
  for (const [bone, before] of snapshot) {
    assert.deepEqual(bone.position.toArray(), before.p);
    assert.deepEqual(bone.scale.toArray(), before.scale);
    if (!spine.includes(bone) && bone !== head) assert.deepEqual(bone.quaternion.toArray(), before.q);
    if (/pelvis|thigh|calf|foot/.test(bone.name)) assert.deepEqual(bone.matrixWorld.toArray(), before.world);
  }
  assert.ok(head.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(gaze.normalize()) < 1e-6);
});

await test('baked Start/Loop/Stop keep moderate torso lean across every sampled gameplay pose', async () => {
  const model = await body();
  const pack = JSON.parse(await readFile(new URL('../../public/assets/characters/cena/cena-run-f0.json', import.meta.url), 'utf8'));
  const mixer = new T.AnimationMixer(model);
  const chain = ['spine_01', 'spine_02', 'spine_03', 'neck_01'].map(n => model.getObjectByName(n)!);
  let maxLean = 0;
  for (const data of pack.clips) {
    const clip = T.AnimationClip.parse(data), action = mixer.clipAction(clip);
    action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    for (let f = 0; f <= Math.round(clip.duration * 60); f++) {
      mixer.setTime(Math.min(f / 60, clip.duration)); model.updateMatrixWorld(true);
      for (let i = 0; i < chain.length - 1; i++) {
        const direction = chain[i + 1].getWorldPosition(new T.Vector3()).sub(chain[i].getWorldPosition(new T.Vector3()));
        const lean = Math.abs(Math.atan2(direction.z, direction.y) * 180 / Math.PI);
        maxLean = Math.max(maxLean, lean);
        assert.ok(lean < 25, `${data.name} frame ${f}: excessive spinal lean ${lean}`);
      }
    }
    mixer.stopAllAction();
  }
  console.log({ maximumSpinalSegmentLeanDegrees: maxLean });
});
