// Offline animation-only bake. Both input GLBs remain read-only.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCharacterModel, disposeCharacterModel } from '../lib/game/character-model.ts';
import { CENA_CHARACTER_PROFILE } from '../lib/game/cena-character.ts';
import { freshHero } from '../lib/game/rules.ts';

async function parse(path) {
  const bytes = await readFile(path), loader = new GLTFLoader();
  loader.register(() => ({ name: 'offline-material', loadMaterial: () => Promise.resolve(new T.MeshBasicMaterial()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { ...gltf, hash: createHash('sha256').update(bytes).digest('hex') };
}
const old = await parse('public/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb');
const cena = await parse('public/assets/characters/cena/cena-rigged.glb');
cena.scene.userData.characterVisualProfile = CENA_CHARACTER_PROFILE;
cena.scene.userData.nativeAnimationsDisabled = true;
const target = createCharacterModel(freshHero(), { assetSource: async () => cena.scene });
await target.ready;
target.animator.reset(); target.actor.updateMatrixWorld(true);
const wrapper = new T.Group(), box = new T.Box3().setFromObject(old.scene);
wrapper.rotation.y = Math.PI; wrapper.scale.setScalar(2.4 / box.getSize(new T.Vector3()).y);
wrapper.position.y = -box.min.y * wrapper.scale.y; wrapper.add(old.scene); wrapper.updateMatrixWorld(true);
const names = {
  Hips: 'pelvis', Spine: 'spine_01', Chest: 'spine_03', Neck: 'neck_01', Head: 'head',
  UpperArmR: 'upperarm_r', LowerArmR: 'lowerarm_r', HandR: 'hand_r',
  UpperArmL: 'upperarm_l', LowerArmL: 'lowerarm_l', HandL: 'hand_l',
  ThighR: 'thigh_r', ShinR: 'calf_r', FootR: 'foot_r',
  ThighL: 'thigh_l', ShinL: 'calf_l', FootL: 'foot_l',
};
const wp = o => o.getWorldPosition(new T.Vector3());
const wq = o => o.getWorldQuaternion(new T.Quaternion());
const depth = o => o.parent ? 1 + depth(o.parent) : 0;
const bindings = Object.entries(names).map(([from, to]) => {
  const s = old.scene.getObjectByName(from), t = cena.scene.getObjectByName(to);
  if (!s || !t) throw Error(`Missing bone: ${from}/${to}`);
  const sourceQ = wq(s), targetQ = wq(t);
  if (!['Hips', 'Spine', 'Chest', 'Neck', 'Head'].includes(from)) {
    // Match anatomical swing axes, not only local quaternion names. Otherwise
    // Cena's narrower relaxed leg spread turns a straight run into crossed feet.
    const swing = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0).applyQuaternion(targetQ),
      new T.Vector3(0, 1, 0).applyQuaternion(sourceQ));
    targetQ.premultiply(swing);
  }
  return { s, t, sourceQ: sourceQ.invert(), targetQ, q: t.quaternion.clone(), p: t.position.clone() };
}).sort((a, b) => depth(a.t) - depth(b.t));
const hips = bindings.find(b => b.t.name === 'pelvis');
const sourceHip = wp(hips.s), targetHip = wp(hips.t);
const legLength = (root, names) => wp(root.getObjectByName(names[0])).distanceTo(wp(root.getObjectByName(names[1])))
  + wp(root.getObjectByName(names[1])).distanceTo(wp(root.getObjectByName(names[2])));
const ratio = legLength(cena.scene, ['thigh_r', 'calf_r', 'foot_r']) / legLength(old.scene, ['ThighR', 'ShinR', 'FootR']);

// Sample actual foot skin, not bone origins, to preserve contact/Run flight.
function footSamples(root) {
  const entries = [];
  root.traverse(o => {
    if (!(o instanceof T.SkinnedMesh)) return;
    const ids = new Set(o.skeleton.bones.flatMap((b, i) => /foot/i.test(b.name) ? [i] : []));
    const indices = [], si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count; i++) {
      let weight = 0;
      for (let c = 0; c < 4; c++) if (ids.has(si.getComponent(i, c))) weight += sw.getComponent(i, c);
      if (weight > .5) indices.push(i);
    }
    if (indices.length) entries.push({ mesh: o, indices });
  });
  if (!entries.length) throw Error('No foot skin samples');
  return entries;
}
const sourceFeet = footSamples(old.scene), targetFeet = footSamples(cena.scene), vertex = new T.Vector3();
function lowest(entries) {
  let y = Infinity;
  for (const { mesh, indices } of entries) {
    mesh.skeleton.update();
    for (const i of indices) y = Math.min(y, mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).y);
  }
  return y;
}
const mixer = new T.AnimationMixer(old.scene), clips = [], diagnostics = [];
for (const name of ['Walk', 'Run', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03']) {
  const source = old.animations.find(c => c.name === name);
  if (!source) throw Error(`Missing animation ${name}`);
  const frames = Math.round(source.duration * 60), times = [], rotations = bindings.map(() => []), positions = [];
  const action = mixer.clipAction(source).setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  let maxCorrection = 0;
  for (let i = 0; i <= frames; i++) {
    const time = i / frames * source.duration;
    mixer.setTime(time); wrapper.updateMatrixWorld(true);
    for (const b of bindings) { b.t.quaternion.copy(b.q); b.t.position.copy(b.p); }
    target.actor.updateMatrixWorld(true);
    for (const b of bindings) {
      const desired = wq(b.s).multiply(b.sourceQ).multiply(b.targetQ);
      b.t.quaternion.copy(wq(b.t.parent).invert().multiply(desired)).normalize();
      if (b === hips) b.t.position.copy(b.t.parent.worldToLocal(wp(b.s).sub(sourceHip).multiplyScalar(ratio).add(targetHip)));
      b.t.updateWorldMatrix(false, true);
    }
    const flight = name === 'Run' ? Math.max(0, lowest(sourceFeet)) * ratio : 0;
    const correction = flight - lowest(targetFeet); maxCorrection = Math.max(maxCorrection, Math.abs(correction));
    const corrected = wp(hips.t); corrected.y += correction;
    hips.t.position.copy(hips.t.parent.worldToLocal(corrected)); target.actor.updateMatrixWorld(true);
    times.push(time); positions.push(...hips.t.position.toArray());
    bindings.forEach((b, j) => {
      const q = b.t.quaternion.clone(), previous = rotations[j];
      if (previous.length && q.dot(new T.Quaternion().fromArray(previous, previous.length - 4)) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      previous.push(...q.toArray());
    });
  }
  if (name === 'Walk' || name === 'Run') {
    rotations.forEach(r => r.splice(r.length - 4, 4, ...r.slice(0, 4)));
    positions.splice(positions.length - 3, 3, ...positions.slice(0, 3));
  }
  const tracks = bindings.map((b, i) => new T.QuaternionKeyframeTrack(b.t.name + '.quaternion', times, rotations[i]));
  tracks.push(new T.VectorKeyframeTrack('pelvis.position', times, positions));
  const serialized = T.AnimationClip.toJSON(new T.AnimationClip(name, source.duration, tracks));
  const id = createHash('sha256').update(old.hash + cena.hash + name).digest('hex');
  serialized.uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
  clips.push(serialized);
  diagnostics.push({ name, frames: frames + 1, duration: source.duration, maxGroundCorrection: maxCorrection });
  mixer.stopAllAction(); console.log(name, diagnostics.at(-1));
}
const output = 'public/assets/characters/cena/cena-legacy-motion.json';
const pack = { version: 1, source: 'astra-hunyuan-rigged.glb', sourceSHA256: old.hash, targetSHA256: cena.hash,
  policy: 'Old game clips retargeted to Cena relaxed rest pose; no Cena source actions, mesh, finger or scale tracks.', clips };
// Canonical generated data, rounded deterministically to keep the pack compact.
await writeFile(output, JSON.stringify(pack, (_key, value) => typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value));
await mkdir('work/cena-character', { recursive: true });
await writeFile('work/cena-character/motion-retarget-report.json', JSON.stringify({ output, bytes: (await readFile(output)).length, ratio, diagnostics }, null, 2));
disposeCharacterModel(target.actor); disposeCharacterModel(old.scene);
