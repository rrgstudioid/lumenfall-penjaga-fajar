import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RARITY_META, type ItemData } from './items.ts';
import type { Hero } from './rules.ts';
import { getCharacterEquipmentLayers } from './character-view.ts';
import { createProceduralAnimator } from './character-animation.ts';
import { createRevision02Binding } from './revision02-character.ts';
import { loadHunyuanCharacter } from './hunyuan-character.ts';
import { armyRunningCadence } from './army-running.ts';
import {loadFemaleCharacter,FEMALE_CHARACTER_TRIANGLES} from './female-character.ts';
import { attachSwordAura, fitSwordAuraToBlade, updateSwordAuras } from './sword-aura.ts';
import { alignCrimsonSword, setupCrimsonSwordGlow, updateCrimsonSwordGlow } from './special-sword-model.ts';

const specialSwordLoader = new GLTFLoader();
// Keep the existing asset URL; item assignment is independent of its original folder.
const CRIMSON_SWORD_MODEL = '/assets/equipment/jayantara-two-hand-sword/altiverse_crimson_sword_optimized.glb';

function loadCrimsonSword(holder: T.Group, placeholder: T.Object3D[], actor: T.Group, targetLength: number) {
  specialSwordLoader.load(CRIMSON_SWORD_MODEL, gltf => {
    if (!holder.parent || actor.userData.disposed) {
      disposeCharacterModel(gltf.scene);
      return;
    }
    try {
      const model = alignCrimsonSword(gltf.scene, targetLength);
      setupCrimsonSwordGlow(model);
      const glowingWeapons = (actor.userData.glowingWeapons ??= []) as T.Object3D[];
      glowingWeapons.push(model);
      for (const object of placeholder) {
        holder.remove(object);
        // Placeholder materials are shared with other equipment; keep those alive.
        if (object instanceof T.Mesh) object.geometry.dispose();
      }
      holder.add(model);
      const bladeSocket = model.getObjectByName('CrimsonBladeAuraSocket')!;
      const flame = holder.getObjectByName('EnhancedSwordFlame13') as T.Group | undefined;
      if (flame) fitSwordAuraToBlade(flame, bladeSocket,
        bladeSocket.userData.bladeLength, bladeSocket.userData.bladeWidth);
    } catch (error) {
      disposeCharacterModel(gltf.scene);
      console.warn('Crimson sword alignment failed; retaining default sword.', error);
    }
  }, undefined, error => console.warn('Crimson sword unavailable; retaining default sword.', error));
}

// The male body is the rigged Hunyuan GLB; female characters use their own rig.
// These lightweight pivots remain only as the gameplay/animation attachment
// hierarchy for equipment, sockets, and procedural combat poses.
// Keep the flipbook assets and attachment code for reactivation later.
export const CHARACTER_AURA_ENABLED = false;

const HAIR_COLORS: Record<string, string> = {
  black: '#171719', dark_brown: '#3b2419', brown: '#6a4024',
  light_brown: '#b48762', blonde: '#e3c27e', white: '#f0eee3',
  silver: '#aeb8c6', dark_red: '#6e252d',
};
const SKIN_TONES: Record<string, string> = {
  tone_01: '#f5d6bd', tone_02: '#e8b18f', tone_03: '#c9825d', tone_04: '#8d543f',
};

function applyCharacterAppearance(scene: T.Group, hero: Hero) {
  const appearance = hero.appearance ?? {
    gender: hero.gender, hairColorId: 'light_brown', skinToneId: 'tone_02',
    hairStyleId: 'hair_default', faceStyleId: 'face_default',
  };
  const hairColor = new T.Color(HAIR_COLORS[appearance.hairColorId] ?? HAIR_COLORS.light_brown);
  const skinColor = new T.Color(SKIN_TONES[appearance.skinToneId] ?? SKIN_TONES.tone_02);
  scene.userData.appearance = { ...appearance };
  scene.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const materialName = material.name.toLowerCase();
      const objectName = object.name.toLowerCase();
      if (materialName.includes('hair') || objectName.includes('hair')) {
        material.color?.copy(hairColor);
        if ('roughness' in material) material.roughness = 0.72;
      } else if (materialName.includes('skin') || materialName.includes('body') || objectName.includes('skin')) {
        material.color?.copy(skinColor);
      }
    }
  });
}

export function createCharacterModel(hero: Hero, options: { aura?: boolean; assetSource?: () => Promise<T.Group> } = {}) {
  const female=hero.gender==='female';
  const actor = new T.Group();
  actor.name = 'LUMENFALL_Character';
  actor.userData = { assetKind: female?'female-rpg-loading':'astra-hunyuan-loading', gender:female?'female':'male', animationType: 'skinned-procedural-retarget' };
  const root = new T.Group(); root.name = 'Root'; actor.add(root);
  const hips = new T.Group(); hips.name = 'Hips'; hips.position.y = 0.95; root.add(hips);
  const spine = new T.Group(); spine.name = 'Spine'; spine.position.y = 0.12; hips.add(spine);
  const chest = new T.Group(); chest.name = 'Chest'; chest.position.y = 0.3; spine.add(chest);
  const neck = new T.Group(); neck.name = 'Neck'; neck.position.y = 0.53; chest.add(neck);
  const head = new T.Group(); head.name = 'Head'; head.position.y = 0.17; neck.add(head);
  const rightShoulder = new T.Group(); rightShoulder.name = 'RightShoulder'; rightShoulder.position.set(0.38, 0.42, 0); chest.add(rightShoulder);
  const leftShoulder = new T.Group(); leftShoulder.name = 'LeftShoulder'; leftShoulder.position.set(-0.38, 0.42, 0); chest.add(leftShoulder);
  const rightUpperArm = new T.Group(); rightUpperArm.name = 'RightUpperArm'; rightUpperArm.position.y = -0.08; rightShoulder.add(rightUpperArm);
  const rightLowerArm = new T.Group(); rightLowerArm.name = 'RightLowerArm'; rightLowerArm.position.y = -0.43; rightUpperArm.add(rightLowerArm);
  const rightHand = new T.Group(); rightHand.name = 'RightHand'; rightHand.position.y = -0.4; rightLowerArm.add(rightHand);
  const leftUpperArm = new T.Group(); leftUpperArm.name = 'LeftUpperArm'; leftUpperArm.position.y = -0.08; leftShoulder.add(leftUpperArm);
  const leftLowerArm = new T.Group(); leftLowerArm.name = 'LeftLowerArm'; leftLowerArm.position.y = -0.43; leftUpperArm.add(leftLowerArm);
  const leftHand = new T.Group(); leftHand.name = 'LeftHand'; leftHand.position.y = -0.4; leftLowerArm.add(leftHand);
  const rightUpperLeg = new T.Group(); rightUpperLeg.name = 'RightUpperLeg'; rightUpperLeg.position.x = 0.18; hips.add(rightUpperLeg);
  const rightLowerLeg = new T.Group(); rightLowerLeg.name = 'RightLowerLeg'; rightLowerLeg.position.y = -0.43; rightUpperLeg.add(rightLowerLeg);
  const rightFoot = new T.Group(); rightFoot.name = 'RightFoot'; rightFoot.position.y = -0.43; rightLowerLeg.add(rightFoot);
  const leftUpperLeg = new T.Group(); leftUpperLeg.name = 'LeftUpperLeg'; leftUpperLeg.position.x = -0.18; hips.add(leftUpperLeg);
  const leftLowerLeg = new T.Group(); leftLowerLeg.name = 'LeftLowerLeg'; leftLowerLeg.position.y = -0.43; leftUpperLeg.add(leftLowerLeg);
  const leftFoot = new T.Group(); leftFoot.name = 'LeftFoot'; leftFoot.position.y = -0.43; leftLowerLeg.add(leftFoot);
  rightUpperArm.rotation.z = .08; leftUpperArm.rotation.z = -.08;

  const layers = getCharacterEquipmentLayers(hero);
  const bySlot = (slot: string) => layers.find((layer) => layer.slot === slot)?.item;
  const material = (color: string, metal = false) => new T.MeshStandardMaterial({ color, roughness: metal ? 0.45 : 0.84, metalness: metal ? 0.6 : 0 });
  const leather = material('#35423d'), metal = material('#d8dfd0', true), gold = material('#d5b96c', true);
  const equipmentMaterials = new Map<string, T.MeshStandardMaterial>();
  const rarityMaterial = (item: ItemData) => {
    let mat = equipmentMaterials.get(item.id);
    if (!mat) { mat = new T.MeshStandardMaterial({ color: RARITY_META[item.rarity].color, emissive: RARITY_META[item.rarity].color, emissiveIntensity: 0.12, metalness: 0.5, roughness: 0.4 }); equipmentMaterials.set(item.id, mat); }
    return mat;
  };
  function mesh(geometry: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) {
    const object = new T.Mesh(geometry, mat); object.name = `${parent.name || 'Body'}:mesh-${parent.children.length}`; object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const capsule = (radius: number, length: number, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) => mesh(new T.CapsuleGeometry(radius, length, 4, 8), mat, parent, x, y, z);
  const layerFor = (slot: string, parent: T.Object3D, part = '') => { const group = new T.Group(); const layer = layers.find((entry) => entry.slot === slot); group.name = `equipment:${slot}${part ? `:${part}` : ''}`; group.userData = { slot, asset: layer?.visual, templateId: layer?.item.templateId ?? null }; parent.add(group); return group; };

  // Keep the same gameplay scale for the incoming GLB without creating the
  // retired blue procedural body while the asset is loading.
  actor.userData.heightMeters = 2.4;

  const headLayer = layerFor('head', head); if (bySlot('head')) mesh(new T.SphereGeometry(0.31, 10, 7), rarityMaterial(bySlot('head')!), headLayer, 0, 0.02, 0);
  const armor = layerFor('chest', chest); if (bySlot('chest')) capsule(0.38, 0.5, rarityMaterial(bySlot('chest')!), armor, 0, 0.02, 0);
  for (const [side, upper, lower, hand, thigh, shin, foot] of [
    ['right', rightUpperArm, rightLowerArm, rightHand, rightUpperLeg, rightLowerLeg, rightFoot],
    ['left', leftUpperArm, leftLowerArm, leftHand, leftUpperLeg, leftLowerLeg, leftFoot],
  ] as const) {
    if (bySlot('chest')) mesh(new T.SphereGeometry(.17, 8, 6), metal, layerFor('chest', upper, side), 0, .02, 0);
    if (bySlot('gloves')) {
      mesh(new T.SphereGeometry(.13, 8, 6), rarityMaterial(bySlot('gloves')!), layerFor('gloves', hand, side));
      capsule(.113, .12, rarityMaterial(bySlot('gloves')!), layerFor('gloves', lower, `${side}-cuff`), 0, -.3, 0);
    }
    if (bySlot('boots')) mesh(new T.BoxGeometry(.3, .18, .52), rarityMaterial(bySlot('boots')!), layerFor('boots', foot, side), 0, -.02, -.1);
    if (bySlot('legs')) {
      capsule(.17, .35, rarityMaterial(bySlot('legs')!), layerFor('legs', thigh, side), 0, -.23, 0);
      capsule(.13, .32, rarityMaterial(bySlot('legs')!), layerFor('legs', shin, `${side}-shin`), 0, -.22, 0);
    }
  }
  const backSocket = new T.Group(); backSocket.name = 'BackWeaponSocket'; backSocket.position.set(0, .08, .28); chest.add(backSocket);
  const arm = new T.Group(); arm.name = 'RightHandSocket'; arm.userData = { attachmentPoint: 'RightHandSocket', orientation: 'grip along local Y' }; rightHand.add(arm);
  const leftSocket = new T.Group(); leftSocket.name = 'LeftHandSocket'; leftSocket.userData = { attachmentPoint: 'LeftHandSocket', orientation: 'off-hand face forward' }; leftHand.add(leftSocket);

  const swordFlames: T.Group[] = [];
  function weapon(slot: 'mainHand' | 'offHand') {
    const item = bySlot(slot); if (!item) return; const holder = layerFor(slot, slot === 'mainHand' ? arm : leftSocket); const mat = rarityMaterial(item); holder.name = `equipment:${slot}`; const type = item.equipmentType;
    if (type === 'bow') { const arc = mesh(new T.TorusGeometry(0.42, 0.045, 5, 20, Math.PI), mat, holder, 0, 0.3, 0); arc.rotation.z = -Math.PI / 2; holder.rotation.z = Math.PI / 2; }
    else if (type === 'shield') { const shield = mesh(new T.CylinderGeometry(0.32, 0.28, 0.09, 8), mat, holder, 0, 0.12, -0.05); shield.rotation.x = Math.PI / 2; mesh(new T.SphereGeometry(0.09, 6, 4), gold, holder, 0, 0.12, -0.12); }
    else if (type === 'staff' || type === 'wand') { mesh(new T.CylinderGeometry(0.04, 0.045, type === 'staff' ? 1.55 : 0.75, 6), leather, holder, 0, 0.32, 0); mesh(new T.OctahedronGeometry(type === 'staff' ? 0.17 : 0.1), mat, holder, 0, type === 'staff' ? 1.1 : 0.72, 0); }
    else if (type === 'knuckle') mesh(new T.TorusGeometry(0.14, 0.07, 5, 8), mat, holder, 0, 0.02, -0.1);
    else if (type === 'mace') { mesh(new T.CylinderGeometry(0.04, 0.05, 0.62, 6), leather, holder, 0, 0.28, 0); mesh(new T.DodecahedronGeometry(0.18), mat, holder, 0, 0.62, 0); }
    else if (type === 'orb') mesh(new T.SphereGeometry(0.2, 10, 8), mat, holder, 0, 0.1, 0);
    else if (type === 'tome' || type === 'talisman') { mesh(new T.BoxGeometry(0.3, 0.4, 0.12), mat, holder, 0, 0.1, 0); mesh(new T.BoxGeometry(0.23, 0.33, 0.13), gold, holder, 0, 0.1, 0); }
    else {
      const dagger = type === 'dagger' || type === 'off_hand_dagger';
      const sword = type === 'one_hand_sword' || type === 'two_hand_sword';
      const bladeLike = sword || dagger;
      const length = type === 'two_hand_sword' ? 1.55 : dagger ? 0.58 : 1.1;
      // Every blade uses the same hand contract: its grip centre is the palm,
      // while its cutting edge points along the character's forward -Z axis.
      // Daggers previously skipped this transform and pointed up the forearm.
      const guardY = bladeLike ? 0.12 : 0;
      if (bladeLike) holder.rotation.x = -Math.PI / 2;
      mesh(new T.BoxGeometry(type === 'two_hand_sword' ? 0.17 : 0.09, length, 0.06), mat, holder, 0, guardY + length / 2, 0);
      const tip = mesh(new T.ConeGeometry(0.07, 0.18, 4), mat, holder, 0, guardY + length + 0.08, 0);
      const guard = mesh(new T.BoxGeometry(0.34, 0.07, 0.1), gold, holder, 0, guardY, 0);
      const grip = mesh(new T.CylinderGeometry(0.045, 0.045, 0.2, 6), leather, holder, 0, guardY - 0.12, 0);
      if (bladeLike) {
        tip.name = sword ? 'SwordTip' : 'DaggerTip';
        guard.name = sword ? 'SwordGuard' : 'DaggerGuard';
        grip.name = sword ? 'SwordGrip' : 'DaggerGrip';
      }
      if (type === 'one_hand_sword' && item.templateId === 'field-meteorfall-citadel-sword') {
        // Fit around the calibrated grip; aura follows the resulting blade size.
        loadCrimsonSword(holder, holder.children.slice(), actor, length * 2.25);
      }
      if (sword && item.enhancementLevel >= 5) swordFlames.push(attachSwordAura(holder, length, guardY));
    }
  }
  weapon('mainHand'); weapon('offHand');
  for (const slot of ['necklace', 'ring1', 'ring2', 'earring1', 'earring2']) { const item = bySlot(slot); if (!item) continue; const ring = slot.startsWith('ring'); const ear = slot.startsWith('earring'); const side = slot.endsWith('2') ? -1 : 1; const group = layerFor(slot, ear ? head : ring ? (side === 1 ? rightHand : leftHand) : chest); mesh(new T.TorusGeometry(ear ? 0.06 : ring ? 0.055 : 0.13, 0.02, 5, 12), rarityMaterial(item), group, ear ? side * 0.28 : 0, ear ? -.12 : ring ? -.035 : .13, ear ? 0 : ring ? -.09 : -.36); }
  const circle = mesh(new T.RingGeometry(0.65, 0.72, 36), new T.MeshBasicMaterial({ color: '#d8efb6', transparent: true, opacity: 0.65, side: T.DoubleSide }), actor, 0, 0.025, 0); circle.rotation.x = -Math.PI / 2;
  const aura = new T.Group();
  aura.name = 'RedAuraFlipbook';
  const auraEnabled = CHARACTER_AURA_ENABLED && options.aura !== false;
  aura.visible = auraEnabled;
  aura.userData = { auraId: 'footagecrate-red-aura', followsCharacter: true, style: 'flipbook-flame', enabled: auraEnabled, bodyEnabled: auraEnabled, weaponEnabled: auraEnabled, frame: 0, fps: 30, columns: 15, rows: 10 };
  // Enhancement VFX is independent of the temporarily disabled body aura.
  aura.userData.swordFlames = swordFlames;
  aura.userData.glowingWeapons = (actor.userData.glowingWeapons ??= []) as T.Object3D[];
  if (auraEnabled) {
  const auraTextures: T.Texture[] = [];
  const flipbook = new T.TextureLoader().load('/assets/vfx/red-aura-flipbook.png', () => {
    for (const texture of auraTextures) if (!actor.userData.disposed) texture.needsUpdate = true;
  });
  const copyTexture = (texture: T.Texture) => {
    // Share the atlas source; upload only when the asynchronous image is ready.
    const copy = new T.Texture(); copy.source = texture.source;
    copy.colorSpace = texture.colorSpace; copy.wrapS = texture.wrapS; copy.wrapT = texture.wrapT;
    copy.repeat.copy(texture.repeat); copy.offset.copy(texture.offset);
    auraTextures.push(copy); return copy;
  };
  flipbook.colorSpace = T.SRGBColorSpace;
  flipbook.wrapS = T.ClampToEdgeWrapping;
  flipbook.wrapT = T.ClampToEdgeWrapping;
  flipbook.repeat.set(1 / 15, 1 / 10);
  flipbook.offset.set(0, 0.9);
  const flipbookMaterial = new T.MeshBasicMaterial({ map: flipbook, transparent: true, opacity: 0.72, blending: T.AdditiveBlending, depthWrite: false, depthTest: true, side: T.DoubleSide, toneMapped: false });
  const bodyAura = new T.Group();
  bodyAura.name = 'RedAuraBodyFlipbook';
  bodyAura.position.y = 1.05;
  bodyAura.scale.setScalar(3);
  aura.add(bodyAura);
  const bodyAuraPlanes: T.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const material = i === 0 ? flipbookMaterial : flipbookMaterial.clone();
    if (i !== 0 && material.map) material.map = copyTexture(material.map);
    const plane = new T.Mesh(new T.PlaneGeometry(1.65, 2.15), material);
    plane.name = `RedAuraBodyFlipbook_${i + 1}`;
    plane.position.set(Math.sin(angle) * 0.22, 0, Math.cos(angle) * 0.22);
    plane.rotation.y = angle;
    plane.userData = { isAuraFlipbook: true, frame: 0, frameOffset: i * 7, fps: 30, columns: 15, rows: 10, mode: 'body', billboard: false };
    bodyAura.add(plane);
    bodyAuraPlanes.push(plane);
  }
  // A smaller second layer follows the weapon hand and can be hidden independently.
  const weaponMaterial = flipbookMaterial.clone();
  if (weaponMaterial.map) weaponMaterial.map = copyTexture(weaponMaterial.map);
  const weaponAura = mesh(new T.PlaneGeometry(0.72, 1.0), weaponMaterial, aura, 0.5, 0.95, -0.08);
  weaponAura.name = 'RedAuraWeaponFlipbook';
  weaponAura.userData = { isAuraFlipbook: true, frame: 0, fps: 30, columns: 15, rows: 10, mode: 'weapon', billboard: true };
  (weaponAura.material as T.MeshBasicMaterial).opacity = 0.48;
  weaponAura.visible = Boolean(bySlot('mainHand') || bySlot('offHand'));
  weaponAura.userData.hasEquipment = weaponAura.visible;
  aura.remove(weaponAura);
  weaponAura.position.set(0, 0.28, 0);
  arm.add(weaponAura);
  const flameColors = ['#ff5a20', '#ffb52e', '#ffe36b'];
  for (let i = 0; i < 14; i++) {
    const ember = mesh(new T.OctahedronGeometry(0.018 + (i % 3) * 0.009, 0), new T.MeshBasicMaterial({ color: flameColors[i % flameColors.length], transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), aura);
    const angle = (i / 14) * Math.PI * 2;
    const radius = 0.34 + (i % 3) * 0.09;
    ember.position.set(Math.cos(angle) * radius, 0.28 + (i % 7) * 0.25, Math.sin(angle) * radius);
    ember.userData.orbitAngle = angle;
    ember.userData.orbitRadius = radius;
    ember.userData.orbitHeight = ember.position.y;
    ember.userData.flamePhase = i * 0.8;
  }
  aura.userData.flipbookMeshes = [...bodyAuraPlanes, weaponAura];
  }
  actor.add(aura);
  const rig = { root, hips, spine, chest, neck, head, rightUpperArm, rightLowerArm, rightHand, leftUpperArm, leftLowerArm, leftHand, rightUpperLeg, rightLowerLeg, rightFoot, leftUpperLeg, leftLowerLeg, leftFoot };
  const procedural = createProceduralAnimator(rig);
  const binding = createRevision02Binding(rig, actor, [], new Set(layers.map(l => l.slot)),female?{assetKind:'female-rpg',visualName:'FemaleRPGVisual',triangles:FEMALE_CHARACTER_TRIANGLES}:undefined);
  let nativeMixer: T.AnimationMixer | undefined;
  let nativeActions = new Map<string, T.AnimationAction>();
  let nativeActive: T.AnimationAction | undefined;
  let nativeActiveName = '';
  const nativeAttackNames = [
    'DualSword_Attack_01',
    'DualSword_Attack_02',
    'DualSword_Attack_03',
  ];
  const nativeLocomotionNames = new Set(['Walk', 'Run']);
  let nativeComboIndex = 0;
  let nativeComboIdleTime = 0;
  let nativeReleasing: T.AnimationAction | undefined;
  let nativeReleaseRemaining = 0;
  const releaseNative = (duration: number) => {
    if (!nativeActive) return;
    nativeActive.fadeOut(duration);
    nativeReleasing = nativeActive;
    nativeReleaseRemaining = duration;
    nativeActive = undefined;
    nativeActiveName = '';
  };
  const playNative = (name: string, loop: boolean) => {
    const next = nativeActions.get(name);
    if (!next || nativeActive === next) return;
    nativeReleasing?.stop();
    nativeReleasing = undefined;
    nativeReleaseRemaining = 0;
    if (nativeActive) {
      nativeActive.fadeOut(.2);
      nativeReleasing = nativeActive;
      nativeReleaseRemaining = .2;
    }
    next.reset();
    next.setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1);
    // Keep the final attack pose alive while its weight fades back to the
    // procedural pose. This prevents a one-frame snap at the attack end.
    next.clampWhenFinished = !loop;
    next.zeroSlopeAtStart = true;
    next.zeroSlopeAtEnd = true;
    next.fadeIn(.2).play();
    nativeActive = next;
    nativeActiveName = name;
  };
  const animator = {
    ...procedural,
    update(dt: number, motion?: Parameters<typeof procedural.update>[1]) {
      procedural.update(dt, motion);
      binding.update();
      if (!nativeMixer) return;
      nativeComboIdleTime += Math.max(0, dt);
      if (nativeReleasing) {
        nativeReleaseRemaining -= Math.max(0, dt);
        if (nativeReleaseRemaining <= 0) {
          nativeReleasing.stop();
          nativeReleasing = undefined;
        }
      }
      if (nativeActiveName.startsWith('DualSword_Attack_') && nativeActive && !nativeActive.isRunning()) {
        // Blend the finished native attack back into the original procedural
        // idle/walk pose instead of replacing it with Dual Sword combat idle.
        releaseNative(.24);
      }
      const locomotionName = motion?.moving && !motion.dead
        ? motion.sprinting ? 'Run' : 'Walk'
        : '';
      if (nativeLocomotionNames.has(nativeActiveName)) {
        if (locomotionName && locomotionName !== nativeActiveName) playNative(locomotionName, true);
        else if (!locomotionName) releaseNative(.16);
      } else if (!nativeActive && !nativeReleasing && locomotionName) {
        // The supplied Walk/Run clips give the skinned feet a real planted
        // gait. The old procedural pose remains the idle pose when stopped.
        playNative(locomotionName, true);
      }
      if(nativeActiveName==='Run'&&nativeActive&&actor.userData.runningAnimationSource==='army-man-running-blender') {
        const cadence=armyRunningCadence(motion?.speed);
        nativeActive.setEffectiveTimeScale(T.MathUtils.lerp(nativeActive.getEffectiveTimeScale(),cadence,1-Math.exp(-10*Math.max(0,dt))));
      }
      nativeMixer.update(Math.max(0, dt));
      actor.userData.activeNativeAnimation=nativeActiveName;
      // The imported clip owns the skinned bones; re-solve the equipment
      // sockets after the mixer so swords and effects stay in the hands.
      binding.syncAttachments();
    },
    play(action: Parameters<typeof procedural.play>[0], duration?: number) {
      procedural.play(action, duration);
      if (action === 'basic_attack') {
        if (nativeComboIdleTime > 1) nativeComboIndex = 0;
        const attackName = nativeAttackNames[nativeComboIndex] ?? nativeAttackNames[0];
        nativeComboIndex = (nativeComboIndex + 1) % nativeAttackNames.length;
        nativeComboIdleTime = 0;
        playNative(attackName, false);
      }
    },
    reset() { procedural.reset(); nativeActions.forEach(action => action.stop()); nativeActive = undefined; nativeActiveName = ''; nativeReleasing = undefined; nativeReleaseRemaining = 0; nativeComboIndex = 0; nativeComboIdleTime = 0; binding.update(); },
    restore(saved: Parameters<typeof procedural.restore>[0]) { procedural.restore(saved); nativeActions.forEach(action => action.stop()); nativeActive = undefined; nativeActiveName = ''; nativeReleasing = undefined; nativeReleaseRemaining = 0; nativeComboIndex = 0; nativeComboIdleTime = 0; binding.update(); },
  };
  animator.update(0);
  const source = options.assetSource ?? (typeof window !== 'undefined' ? female?loadFemaleCharacter:loadHunyuanCharacter : undefined);
  actor.visible = !source;
  actor.userData.modelStatus = source ? 'loading' : 'fallback';
  const ready = source ? source().then(scene => {
    if (actor.userData.disposed) { disposeCharacterModel(scene); return false; }
    try {
      applyCharacterAppearance(scene, hero);
      binding.attach(scene);
      const clips = (scene.userData.lumenfallAnimations ?? []) as T.AnimationClip[];
      nativeMixer = new T.AnimationMixer(scene);
      actor.userData.animationMixer = nativeMixer;
      nativeActions = new Map(clips.filter(clip => nativeAttackNames.includes(clip.name) || nativeLocomotionNames.has(clip.name)).map(clip => [
        clip.name,
        nativeMixer!.clipAction(clip),
      ]));
      animator.update(0);
      actor.userData.modelStatus = 'ready';
      actor.userData.animationType = 'dual-sword-native-retarget';
      actor.userData.runningAnimationSource=scene.userData.runningAnimationSource??'legacy-run';
      actor.userData.nativeAnimations = [...nativeActions.keys()];
      actor.visible = true;
      return true;
    }
    catch (error) { scene.removeFromParent(); disposeCharacterModel(scene); throw error; }
  }).catch(error => {
    if (!actor.userData.disposed) {
      actor.userData.modelStatus = 'fallback';
      actor.visible = true;
      console.warn('Model karakter gagal dimuat.', error);
    }
    return false;
  }) : Promise.resolve(false);
  return { actor, arm, legs: [leftUpperLeg, rightUpperLeg], aura, rig, animator, ready, sockets: { rightHand: arm, leftHand: leftSocket, back: backSocket } };
}
export type CharacterModel = ReturnType<typeof createCharacterModel>;

export function disposeCharacterModel(model: T.Object3D) {
  model.userData.disposed = true;
  const mixer = model.userData.animationMixer as T.AnimationMixer | undefined;
  mixer?.stopAllAction();
  if (mixer) mixer.uncacheRoot(model);
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const geometries = new Set<T.BufferGeometry>();
  const skeletons = new Set<T.Skeleton>();
  model.traverse(object => { if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
  model.traverse((object) => { if (object instanceof T.Mesh || object instanceof T.Line) { geometries.add(object.geometry); for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat); } });
  materials.forEach(material => { for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value); });
  textures.forEach(texture => texture.dispose());
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function updateCharacterAura(aura: T.Group, time: number, dt: number) {
  updateSwordAuras(aura.userData.swordFlames ?? [], time);
  for (const weapon of (aura.userData.glowingWeapons ?? []) as T.Object3D[]) {
    if (weapon.parent) updateCrimsonSwordGlow(weapon, time);
  }
  const data = aura.userData;
  const columns = data.columns ?? 15, rows = data.rows ?? 10;
  const frame = Math.floor(time * (data.fps ?? 30)) % (columns * rows);
  data.frame = frame;
  for (const flipbook of (data.flipbookMeshes ?? []) as T.Mesh[]) {
    const material = flipbook.material as T.MeshBasicMaterial;
    const weapon = flipbook.userData.mode === 'weapon';
    flipbook.visible = data.enabled !== false && (weapon ? data.weaponEnabled !== false && flipbook.userData.hasEquipment : data.bodyEnabled !== false);
    if (material.map) {
      const displayFrame = (frame + (flipbook.userData.frameOffset ?? 0)) % (columns * rows);
      material.map.offset.set((displayFrame % columns) / columns, 1 - (Math.floor(displayFrame / columns) + 1) / rows);
    }
  }
  for (const part of aura.children) {
    const radius = part.userData.orbitRadius;
    if (radius === undefined) continue;
    const angle = part.userData.orbitAngle + time * .9;
    part.position.x = Math.cos(angle) * radius; part.position.z = Math.sin(angle) * radius;
    const phase = part.userData.flamePhase;
    if (phase !== undefined) {
      part.position.y = part.userData.orbitHeight + Math.sin(time * 5.5 + phase) * .045;
      const pulse = 1 + Math.sin(time * 7 + phase) * .12;
      part.scale.set(1 + pulse * .04, pulse, 1 + pulse * .04);
    }
    part.rotation.x += dt * 1.8; part.rotation.y += dt * 2.2;
  }
}

export function updateCharacterBillboards(aura: T.Group, camera: T.Camera) {
  const parentRotation = new T.Quaternion();
  for (const flipbook of (aura.userData.flipbookMeshes ?? []) as T.Mesh[]) {
    if (!flipbook.userData.billboard) continue;
    // Weapon aura is nested under animated hands: cancel the parent world rotation.
    flipbook.parent!.getWorldQuaternion(parentRotation);
    flipbook.quaternion.copy(parentRotation.invert()).multiply(camera.quaternion);
  }
}

export function setCharacterAuraEnabled(aura: T.Group, enabled: boolean, target: 'all' | 'body' | 'weapon' = 'all') {
  const state = aura.userData as { enabled?: boolean; bodyEnabled?: boolean; weaponEnabled?: boolean };
  if (target === 'all') state.enabled = enabled;
  if (target === 'body' || target === 'all') state.bodyEnabled = enabled;
  if (target === 'weapon' || target === 'all') state.weaponEnabled = enabled;
}
