import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createV3JobDevelopmentHero,
  equipItem,
  parseSave,
  reconcileBladeMasterEquipment,
} from './rules.ts';
import { createItem } from './items.ts';
import { getEquipmentCandidatesForSlot } from './character-view.ts';
import { resolveWeaponStyle, weaponRequirementLabel } from './weapon-style.ts';

const masteryId = 'v3-blade-master-twin-blade-mastery';

function bladeMasterHero() {
  const hero = createV3JobDevelopmentHero('blade-master-60');
  hero.skillProgressionV3!.skillRanks[masteryId] = 1;
  hero.skillLevels[masteryId] = 1;
  return hero;
}

function secondSword(hero: ReturnType<typeof bladeMasterHero>) {
  return hero.inventory.find((item) => item.id.endsWith('-fajar-blade-offhand'))!;
}

await test('Blade Master mastery exposes second One-Hand Sword and legal Shield in Off Hand candidates', () => {
  const hero = bladeMasterHero();
  const shield = createItem('ironveil-shield', { id: 'bm-ui-shield' });
  hero.inventory.push(shield);
  const main = hero.inventory.find((item) => item.id === hero.equipment.mainHand)!;
  const off = secondSword(hero);
  assert.equal(main.equipmentType, 'one_hand_sword');
  assert.equal(main.equipSlot, 'mainHand');
  assert.equal(main.handedness, 'one_hand');
  assert.equal(off.equipmentType, 'one_hand_sword');
  assert.equal(off.equipSlot, 'mainHand');
  assert.equal(off.handedness, 'one_hand');
  assert.notEqual(main.id, off.id);
  const candidates = getEquipmentCandidatesForSlot(hero, 'offHand');
  assert.deepEqual(candidates.map((item) => item.id).sort(), [
    'bm-ui-shield',
    secondSword(hero).id,
  ].sort());
  assert(!candidates.some((item) => item.id === hero.equipment.mainHand));
});

await test('same Main Hand instance is never an Off Hand candidate', () => {
  const hero = bladeMasterHero();
  const candidates = getEquipmentCandidatesForSlot(hero, 'offHand');
  assert(!candidates.some((item) => item.id === hero.equipment.mainHand));
  assert(candidates.some((item) => item.id === secondSword(hero).id));
});

await test('Mastery is required and Warrior/Berserker do not leak sword candidates', () => {
  const bladeMaster = createV3JobDevelopmentHero('blade-master-60');
  const noMasteryCandidates = getEquipmentCandidatesForSlot(bladeMaster, 'offHand');
  assert(!noMasteryCandidates.some((item) => item.id.endsWith('-fajar-blade-offhand')));

  for (const stage of ['warrior-60', 'berserker-60'] as const) {
    const hero = createV3JobDevelopmentHero(stage);
    hero.inventory.push(createItem('legacy-fajar-blade', { id: `${stage}-second-sword` }));
    assert(!getEquipmentCandidatesForSlot(hero, 'offHand').some((item) => item.id === `${stage}-second-sword`));
  }
});

await test('Two-Hand Main Hand rejects a second sword candidate', () => {
  const hero = bladeMasterHero();
  const greatsword = createItem('jayantara-two-hand-sword', { id: 'bm-ui-greatsword' });
  hero.inventory.push(greatsword);
  assert.equal(equipItem(hero, greatsword.id, 'mainHand').ok, true);
  assert(!getEquipmentCandidatesForSlot(hero, 'offHand').some((item) => item.id.endsWith('-fajar-blade-offhand')));
});

await test('equipping Sword B resolves dual_sword without learning skills', () => {
  const hero = bladeMasterHero();
  const off = secondSword(hero);
  assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
  assert.equal(hero.equipment.offHand, off.id);
  assert.equal(resolveWeaponStyle(
    hero.inventory.find((item) => item.id === hero.equipment.mainHand)!,
    off,
  ), 'dual_sword');
  assert.equal(hero.skillLevels['v3-blade-master-twin-assault'] ?? 0, 0);
});

await test('save/reload preserves both sword instances and mastery loss safely unequips Sword B', () => {
  const hero = bladeMasterHero();
  const off = secondSword(hero);
  off.enhancementLevel = 3;
  off.bonusStats = { dex: 4 };
  assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
  const mainId = hero.equipment.mainHand;
  const restored = parseSave(JSON.stringify(hero), 'blade-master-offhand-ui');
  assert(restored);
  assert.equal(restored.equipment.mainHand, mainId);
  assert.equal(restored.equipment.offHand, off.id);
  assert.equal(restored.inventory.find((item) => item.id === off.id)?.enhancementLevel, 3);
  assert.deepEqual(restored.inventory.find((item) => item.id === off.id)?.bonusStats, { dex: 4 });

  restored.skillProgressionV3!.skillRanks[masteryId] = 0;
  restored.skillLevels[masteryId] = 0;
  assert.equal(reconcileBladeMasterEquipment(restored), true);
  assert.equal(restored.equipment.mainHand, mainId);
  assert.equal(restored.equipment.offHand, null);
  assert(restored.inventory.some((item) => item.id === off.id));
  assert.equal(restored.inventory.find((item) => item.id === off.id)?.enhancementLevel, 3);
});

await test('Dual Sword requirement uses a player-facing label without renaming the internal value', () => {
  assert.equal(weaponRequirementLabel('dual_sword'), 'Dual One-Hand Swords');
  assert.equal(weaponRequirementLabel('one_hand_sword'), 'one_hand_sword');
});
