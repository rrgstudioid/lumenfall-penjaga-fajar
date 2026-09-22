import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEquipmentUniqueStats,
  createItem,
  isUniqueStatDropEligible,
  rollUniqueStats,
} from './items.ts';
import {
  derivedStats,
  freshHero,
  parseSave,
  unlockUniqueStats,
} from './rules.ts';

const bossSource = {
  type: 'field_boss' as const,
  sourceId: 'ancient-treant',
  label: 'Ancient Treant · Padang Arunika',
};

await test('Unique Stats uses a data-driven pool with equipment-compatible values', () => {
  const weapon = rollUniqueStats({ category: 'weapon', itemType: 'sword', rarity: 'legendary' }, () => 0);
  const armor = rollUniqueStats({ category: 'armor', itemType: 'armor', rarity: 'mythic' }, () => 0);
  const accessory = rollUniqueStats({ category: 'accessory', itemType: 'ring', rarity: 'legendary' }, () => 0);
  assert(Object.keys(weapon).length === 1 && weapon.attackPercent !== undefined);
  assert(Object.keys(armor).length === 1 && armor.hp !== undefined);
  assert(Object.keys(accessory).length === 1 && accessory.critDamage !== undefined);
  assert.deepEqual(rollUniqueStats({ category: 'material', itemType: 'enhancementMaterial', rarity: 'legendary' }, () => 0), {});
});

await test('eligible boss equipment can roll a locked Unique Stat while ordinary drops do not qualify', () => {
  assert.equal(isUniqueStatDropEligible(bossSource, 'legendary'), true);
  assert.equal(isUniqueStatDropEligible({ ...bossSource, type: 'monster' }, 'legendary'), false);
  assert.equal(isUniqueStatDropEligible(bossSource, 'epic'), false);
  const oldRandom = Math.random;
  Math.random = () => 0;
  try {
    const drop = createItem('legacy-fajar-blade', { rarity: 'legendary', source: bossSource });
    assert.equal(drop.uniqueStatsLocked, true);
    assert.equal(Object.keys(drop.bonusStats).length, 1);
  } finally {
    Math.random = oldRandom;
  }
});

await test('Arcane Magnifier unlocks a real inventory item immutably and recalculates stats', () => {
  const hero = freshHero();
  const hidden = createItem('legacy-fajar-blade', {
    id: 'hidden-unique-sword',
    uniqueStatsLocked: true,
    bonusStats: { attackPercent: 7 },
    source: bossSource,
  });
  const magnifier = createItem('magnifier', { id: 'qa-magnifier', quantity: 2 });
  hero.inventory = [hidden, magnifier];
  hero.equipment.mainHand = hidden.id;
  const before = derivedStats(hero).attack;
  const originalInventory = hero.inventory;
  const result = unlockUniqueStats(hero, hidden.id);
  assert.equal(result.ok, true);
  assert.notEqual(hero.inventory, originalInventory);
  assert.equal(hero.inventory.find(item => item.id === hidden.id)?.uniqueStatsLocked, false);
  assert.equal(hero.inventory.find(item => item.id === magnifier.id)?.quantity, 1);
  assert(derivedStats(hero).attack > before);
  assert.equal(unlockUniqueStats(hero, hidden.id).ok, false);
  assert.equal(unlockUniqueStats(hero, hidden.id).reason, 'Unique Stats sudah terbuka atau item ini tidak memiliki Unique Stats.');
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(restored.inventory.find(item => item.id === hidden.id)?.uniqueStatsLocked, false);
  assert.equal(restored.inventory.find(item => item.id === magnifier.id)?.quantity, 1);
});

await test('obsolete equipment affixes do not contribute before or after revealing Unique Stats', () => {
  const item = createItem('legacy-fajar-blade', {
    id: 'hidden-with-affix',
    uniqueStatsLocked: true,
    bonusStats: { attackPercent: 7 },
    affixes: [{
      id: 'ordinary-affix',
      stat: 'attack',
      label: 'Attack',
      value: 3,
      unit: 'flat',
      quality: 'normal',
      source: 'equipment',
      locked: false,
    }],
  });
  assert.deepEqual(calculateEquipmentUniqueStats(item), {});
  item.uniqueStatsLocked = false;
  assert.deepEqual(calculateEquipmentUniqueStats(item), { attackPercent: 7 });
});

await test('unlock rejects locked equipment, missing Magnifier and non-equipment without mutating the save', () => {
  const lockedHero = freshHero();
  const locked = createItem('legacy-fajar-blade', { id: 'locked-unique', uniqueStatsLocked: true, bonusStats: { attackPercent: 5 }, isLocked: true });
  lockedHero.inventory = [locked];
  const lockedBefore = JSON.stringify(lockedHero);
  assert.equal(unlockUniqueStats(lockedHero, locked.id).ok, false);
  assert.equal(JSON.stringify(lockedHero), lockedBefore);

  const noMagnifier = freshHero();
  const hidden = createItem('legacy-fajar-blade', { id: 'no-magnifier', uniqueStatsLocked: true, bonusStats: { attackPercent: 5 } });
  noMagnifier.inventory = [hidden];
  assert.equal(unlockUniqueStats(noMagnifier, hidden.id).ok, false);

  const material = createItem('iron', { id: 'not-equipment' });
  noMagnifier.inventory.push(material, createItem('magnifier', { id: 'unused-magnifier' }));
  const before = JSON.stringify(noMagnifier);
  assert.equal(unlockUniqueStats(noMagnifier, material.id).ok, false);
  assert.equal(JSON.stringify(noMagnifier), before);
});
