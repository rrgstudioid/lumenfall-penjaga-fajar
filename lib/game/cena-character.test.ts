/* oxlint-disable typescript/unbound-method */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero, createItem } from './rules.ts';
import { CENA_CHARACTER_ASSET, CENA_CHARACTER_TRIANGLES, loadCenaCharacter } from './cena-character.ts';
import { CRIMSON_SWORD_GRIP, setCrimsonSwordGripRoll } from './special-sword-model.ts';
import { cloneCharacterSource } from './revision02-character.ts';
import { CENA_RUNTIME_CLIPS, CENA_LEGACY_MOTION_ASSET, CENA_RUN_ASSET } from './cena-motion.ts';

await test('Cena keeps rig/grips with legacy walk/attacks and only approved Run F0 source actions', async t => {
  const motionBytes = await readFile(new URL('../../public' + CENA_LEGACY_MOTION_ASSET, import.meta.url), 'utf8');
  const runBytes = await readFile(new URL('../../public' + CENA_RUN_ASSET, import.meta.url), 'utf8');
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.ok(url === CENA_LEGACY_MOTION_ASSET || url === CENA_RUN_ASSET);
    return new Response(url === CENA_RUN_ASSET ? runBytes : motionBytes, { status: 200 });
  });
  const bytes = await readFile(new URL('../../public' + CENA_CHARACTER_ASSET, import.meta.url));
  const pack = JSON.parse(motionBytes);
  assert.equal(pack.targetSHA256, createHash('sha256').update(bytes).digest('hex'), 'motion baked for this exact body');
  const runPack = JSON.parse(runBytes);
  assert.equal(runPack.targetSHA256, pack.targetSHA256);
  assert.equal(runPack.source, 'Cena_Textured_RunLibrary.blend');
  assert.deepEqual(runPack.diagnostics.map((c: { sourceAction: string }) => c.sourceAction), [
    'Cena_SS_Run_Start_F_0_InPlace', 'Cena_SS_Run_Loop_F_0_InPlace', 'Cena_SS_Run_Stop_F_0_InPlace',
  ]);
  for (const clip of [...pack.clips, ...runPack.clips]) for (const track of clip.tracks) {
    assert.ok(track.name.endsWith('.quaternion') || track.name === 'pelvis.position');
    assert.ok(!/finger|thumb|index|middle|ring|pinky|scale/i.test(track.name), 'do not overwrite static finger grip or body proportions');
  }
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.equal(gltf.animations.length, 0);
  let triangles = 0;
  gltf.scene.traverse(o => {
    assert.ok(!o.name.startsWith('Meteor_'), 'no baked-in sword props');
    if (o instanceof T.SkinnedMesh) {
      triangles += o.geometry.index!.count / 3;
      assert.equal(o.skeleton.bones.length, 52);
      assert.ok(o.geometry.attributes.color, 'baked procedural color');
      const w = o.geometry.attributes.skinWeight;
      for (let i = 0; i < w.count; i++) assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-4);
    }
  });
  assert.equal(triangles, CENA_CHARACTER_TRIANGLES);
  const original = GLTFLoader.prototype.loadAsync;
  const sourceRotations = ['R', 'L'].map(side => gltf.scene.getObjectByName('WeaponSocket' + side)!.quaternion.toArray());
  // Deliberately inject a named native clip; the Cena loader must still ignore it.
  gltf.animations.push(new T.AnimationClip('DualSword_Attack_01', 1, []));
  GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const hero = freshHero();
    const main = createItem('legacy-fajar-blade'), off = createItem('legacy-fajar-blade');
    main.equipmentType = off.equipmentType = 'one_hand_sword';
    hero.inventory.push(main, off);
    hero.equipment.mainHand = main.id; hero.equipment.offHand = off.id;
    const saved = JSON.stringify(hero);
    const model = createCharacterModel(hero, { assetSource: loadCenaCharacter });
    model.actor.position.set(12, 3, -17); model.actor.rotation.y = 1.2;
    assert.equal(await model.ready, true);
    assert.equal(JSON.stringify(hero), saved);
    assert.equal(model.actor.userData.assetKind, 'cena');
    assert.deepEqual(new Set(model.actor.userData.nativeAnimations), new Set(CENA_RUNTIME_CLIPS));
    assert.equal(model.actor.userData.runningAnimationSource, 'cena-run-f0');
    assert.ok(model.actor.userData.animationMixer);
    const loadedClips = model.actor.userData.animationMixer.getRoot().userData.lumenfallAnimations as T.AnimationClip[];
    assert.ok(loadedClips.find(c => c.name === 'DualSword_Attack_01')!.duration > 1, 'source injected empty 1-second clip ignored');
    assert.equal(new Set(loadedClips.map(c => c.uuid)).size, 7, 'distinct mixer action identities');
    for (const name of ['Walk', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03']) {
      assert.deepEqual(T.AnimationClip.toJSON(loadedClips.find(c => c.name === name)!),
        T.AnimationClip.toJSON(T.AnimationClip.parse(pack.clips.find((c: { name: string }) => c.name === name))), 'unrelated clips unchanged');
    }
    const visual = model.actor.getObjectByName('CenaVisual')!;
    const pos = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
    const axis = (o: T.Object3D) => new T.Vector3(0, 1, 0).transformDirection(o.matrixWorld);
    const bones = new Map<string, T.Object3D>();
    visual.traverse(o => bones.set(o.name.replace(/[. _]/g, ''), o));
    function checkRelaxedStance() {
      model.actor.updateMatrixWorld(true);
      const local = (name: string) => model.actor.worldToLocal(pos(bones.get(name)!));
      for (const side of ['r', 'l']) {
        const upper = local('upperarm' + side), elbow = local('lowerarm' + side), hand = local('hand' + side);
        assert.ok(Math.abs(elbow.x - upper.x) < .09, 'upper arm lowered beside torso, not A-pose');
        assert.ok(Math.abs(hand.x - upper.x) < .16, 'relaxed forearm stays near torso');
        assert.ok(elbow.y > hand.y && upper.y > elbow.y);
      }
      const width = local('footr').distanceTo(local('footl'));
      assert.ok(width > .38 && width < .48, `hip-width stance: ${width}`);
      for (const [slot, side] of [['mainHand', 1], ['offHand', -1]] as const) {
        const direction = axis(model.actor.getObjectByName('equipment:' + slot)!)
          .transformDirection(model.actor.matrixWorld.clone().invert());
        assert.ok(direction.x * side >= 0 && direction.z < -.8, 'relaxed wrists keep dual blades forward/outward, not crossed');
      }
      let sole = Infinity;
      visual.traverse(o => {
        if (!(o instanceof T.SkinnedMesh)) return;
        o.skeleton.update();
        const v = new T.Vector3();
        for (let i = 0; i < o.geometry.attributes.position.count; i++) {
          o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
          sole = Math.min(sole, model.actor.worldToLocal(v).y);
        }
      });
      assert.ok(Math.abs(sole) < .003, `resting sole stays on floor: ${sole}`);
    }
    checkRelaxedStance();
    function check() {
      model.actor.updateMatrixWorld(true);
      for (const [side, slot, pivot] of [['R', 'mainHand', model.sockets.rightHand], ['L', 'offHand', model.sockets.leftHand]] as const) {
        const socket = bones.get('WeaponSocket' + side)!;
        const holder = model.actor.getObjectByName('equipment:' + slot)!;
        assert.ok(pos(socket).distanceTo(pos(pivot)) < 1e-5, `${slot} grip position`);
        const alignment = axis(socket).dot(axis(holder));
        assert.ok(alignment > .999, `${slot} fitted grip orientation: ${alignment}`);
        // Independent anatomy landmark, not socket-to-socket self-consistency:
        // the hilt must cross all four fingers from pinky toward index/thumb.
        const suffix = side.toLowerCase();
        const knuckles = pos(bones.get('index01' + suffix)!).sub(pos(bones.get('pinky01' + suffix)!)).normalize();
        assert.ok(axis(holder).dot(knuckles) > .96, `${slot}: blade exits thumb side of the fist`);
      }
      visual.traverse(o => {
        if (!(o instanceof T.SkinnedMesh)) return;
        o.skeleton.update();
        const vertex = new T.Vector3();
        for (let i = 0; i < o.geometry.attributes.position.count; i += 503) {
          o.getVertexPosition(i, vertex).applyMatrix4(o.matrixWorld);
          assert.ok(vertex.toArray().every(Number.isFinite));
          assert.ok(vertex.distanceTo(model.actor.position) < 5, 'bounded skin deformation');
        }
      });
    }
    check();
    const first = pos(bones.get('WeaponSocketR')!);
    const restRotations = ['handr', 'handl', 'thighr', 'thighl'].map(name => bones.get(name)!.quaternion.clone());
    for (const [clip, moving, sprinting] of [['Walk', true, false], ['Run', true, true]] as const) {
      model.animator.reset();
      for (let i = 0; i < 120; i++) {
        model.animator.update(1 / 60, { moving, sprinting, speed: 5.2 });
        if (i % 10 === 0) check();
      }
      const mixer = model.actor.userData.animationMixer as T.AnimationMixer;
      assert.ok(mixer.existingAction(loadedClips.find(c => c.name === clip)!)!.getEffectiveWeight() > .99, `${clip} actual mixer action, not label only`);
    }
    // Real lifecycle, not manually selecting a loop in the fixture.
    model.animator.reset();
    const tick = (count: number, moving = false, sprinting = false, dead = false) => {
      for (let i = 0; i < count; i++) { model.animator.update(1 / 60, { moving, sprinting, dead, speed: 5.2 }); if (i % 10 === 0) check(); }
    };
    tick(1, true, true);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Start');
    tick(49, true, true);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Start');
    tick(18, true, true);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run');
    const run = loadedClips.find(c => c.name === 'Run')!;
    assert.ok(Math.abs(run.duration - 2 / 3) < 1e-6);
    for (const track of run.tracks) {
      const size = track.getValueSize();
      assert.deepEqual(Array.from(track.values.slice(0, size)), Array.from(track.values.slice(-size)), 'closed loop seam');
    }
    tick(1);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Stop');
    tick(80);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Stop', 'stop is not cut off at one frame');
    tick(30);
    assert.equal(model.actor.userData.activeNativeAnimation, '');
    checkRelaxedStance();
    tick(5, true, true); tick(1);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Stop', 'short input can stop during start');
    tick(1, true, true);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Run_Start', 'restart can interrupt stop');
    tick(1, true, false);
    assert.equal(model.actor.userData.activeNativeAnimation, 'Walk');
    tick(2, true, true); tick(1, false, false, true);
    assert.equal(model.actor.userData.activeNativeAnimation, '', 'death interrupts locomotion');
    model.animator.reset(); tick(5, true, true); tick(1);
    model.animator.play('basic_attack'); tick(1);
    assert.equal(model.actor.userData.activeNativeAnimation, 'DualSword_Attack_01', 'stop does not lock combat');
    model.animator.reset();
    for (let combo = 1; combo <= 3; combo++) {
      const name = `DualSword_Attack_0${combo}`;
      model.animator.play('basic_attack', .6);
      model.animator.update(.25);
      assert.equal(model.actor.userData.activeNativeAnimation, name);
      assert.ok((model.actor.userData.animationMixer as T.AnimationMixer).existingAction(loadedClips.find(c => c.name === name)!)!.getEffectiveWeight() > .99);
      for (let i = 0; i < 84; i++) { model.animator.update(1 / 60); if (i % 10 === 0) check(); }
    }
    for (let i = 0; i < 90; i++) model.animator.update(1 / 60);
    assert.equal(model.actor.userData.activeNativeAnimation, '');
    ['handr', 'handl', 'thighr', 'thighl'].forEach((name, i) => assert.ok(Math.abs(bones.get(name)!.quaternion.dot(restRotations[i])) > .99999, 'returns to natural rest after animation'));
    model.animator.play('basic_attack'); model.animator.update(.25);
    assert.equal(model.actor.userData.activeNativeAnimation, 'DualSword_Attack_01', 'long idle resets combo');
    for (const action of ['basic_attack', 'dash', 'magic_cast', 'hit'] as const) {
      model.animator.reset(); model.animator.play(action, .6);
      for (let i = 0; i < 45; i++) {
        model.animator.update(1 / 60, { moving: true, sprinting: i > 20 });
        if (i % 5 === 0) check();
      }
    }
    assert.ok(pos(bones.get('WeaponSocketR')!).distanceTo(first) > .01);
    assert.deepEqual(model.actor.position.toArray(), [12, 3, -17]);
    assert.ok(CENA_RUNTIME_CLIPS.includes(model.actor.userData.activeNativeAnimation));
    model.animator.reset();
    checkRelaxedStance();
    const copy = await loadCenaCharacter();
    for (const [index, side] of ['R', 'L'].entries()) {
      assert.deepEqual(gltf.scene.getObjectByName('WeaponSocket' + side)!.quaternion.toArray(), sourceRotations[index], 'cached source is not rotated repeatedly');
      assert.deepEqual(copy.getObjectByName('WeaponSocket' + side)!.quaternion.toArray(), bones.get('WeaponSocket' + side)!.quaternion.toArray(), 'world and preview get identical grip basis');
    }
    const meshA: T.SkinnedMesh[] = [], meshB: T.SkinnedMesh[] = [];
    visual.traverse(o => { if (o instanceof T.SkinnedMesh) meshA.push(o); });
    copy.traverse(o => { if (o instanceof T.SkinnedMesh) meshB.push(o); });
    assert.notEqual(meshA[0].skeleton, meshB[0].skeleton);
    assert.notEqual(meshA[0].geometry, meshB[0].geometry);
    assert.notEqual(meshA[0].material, meshB[0].material);
    disposeCharacterModel(model.actor);
    assert.ok(meshB[0].skeleton.bones.every(b => b.parent));
    disposeCharacterModel(copy);
  } finally { GLTFLoader.prototype.loadAsync = original; }
});

await test('Cena Meteor blade is upright with unchanged tip/grip for either asset load order', async t => {
  const bytes = await readFile(new URL('../../public/assets/equipment/jayantara-two-hand-sword/altiverse_crimson_sword_optimized.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'geometry-only-material', loadMaterial: () => Promise.resolve(new T.MeshBasicMaterial()) }));
  const source = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  const pending: Array<() => void> = [];
  t.mock.method(GLTFLoader.prototype, 'load', (_url: string, loaded: (g: { scene: T.Group }) => void) => {
    pending.push(() => loaded({ scene: cloneCharacterSource(source) }));
  });
  for (const order of ['sword-first', 'body-first']) {
    const hero = freshHero();
    for (const slot of ['mainHand', 'offHand'] as const) {
      const item = createItem('field-meteorfall-citadel-sword');
      hero.inventory.push(item); hero.equipment[slot] = item.id;
    }
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const model = createCharacterModel(hero, { assetSource: async () => { await gate; return loadCenaCharacter(); } });
    if (order === 'sword-first') pending.splice(0).forEach(load => load());
    release(); assert.equal(await model.ready, true);
    if (order === 'body-first') pending.splice(0).forEach(load => load());
    model.actor.position.set(7, 2, -9); model.actor.rotation.y = 1.1;
    model.actor.updateMatrixWorld(true);
    for (const slot of ['mainHand', 'offHand']) {
      const holder = model.actor.getObjectByName('equipment:' + slot)!;
      const sword = holder.getObjectByName('AltiverseCrimsonSword')!;
      const blade = sword.getObjectByName('sword_swordTX_0') as T.Mesh;
      const grip = () => blade.localToWorld(CRIMSON_SWORD_GRIP.clone());
      const tip = () => blade.localToWorld(new T.Vector3(0, 0, blade.geometry.boundingBox!.min.z));
      assert.equal(sword.rotation.z, 0, order);
      assert.ok(Math.abs(new T.Vector3(1, 0, 0).transformDirection(blade.matrixWorld).y) > .9, 'actual blade width points up, not sideways');
      assert.ok(grip().distanceTo(holder.getWorldPosition(new T.Vector3())) < 1e-6);
      const correctedTip = tip(), correctedGrip = grip();
      setCrimsonSwordGripRoll(sword); // Previous legacy orientation, for comparison only.
      model.actor.updateMatrixWorld(true);
      assert.ok(tip().distanceTo(correctedTip) < 1e-6, 'roll does not redirect the sword tip');
      assert.ok(grip().distanceTo(correctedGrip) < 1e-6, 'roll does not move the handle');
      assert.ok(Math.abs(new T.Vector3(1, 0, 0).transformDirection(blade.matrixWorld).y) < .4, 'old roll really was horizontal');
      setCrimsonSwordGripRoll(sword, 0);
    }
    disposeCharacterModel(model.actor);
  }
  disposeCharacterModel(source);
});
