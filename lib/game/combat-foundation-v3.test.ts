import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PRIMARY_STAT,
  basePhysicalAttackForLevel,
  basicAttackPower,
  calculateTotalStatPoints,
  createV2TestHero,
  createItem,
  derivedStats,
  authorizeV2Warrior,
  freshHero,
} from './rules.ts';

await test('CFV3-1 uses the canonical primary-stat and +2-per-level foundations', () => {
  const hero = freshHero();
  assert.deepEqual(hero.allocatedStats, { str: 0, vit: 0, dex: 0, int: 0 });
  assert.equal(derivedStats(hero).maxMana, 100 + BASE_PRIMARY_STAT * 3);
  assert.equal(calculateTotalStatPoints(1), 0);
  assert.equal(calculateTotalStatPoints(15, 'v2_test'), 28);
  assert.equal(calculateTotalStatPoints(59, 'v2_test'), 116);
  assert.equal(calculateTotalStatPoints(60, 'v2_test'), 118);
  assert.equal(calculateTotalStatPoints(100, 'v2_test'), 198);
});

await test('CFV3-1 base physical attack table is independent from legacy job attack profiles', () => {
  const expected: Record<number, number> = {
    1: 8, 5: 12, 10: 18, 14: 22, 15: 23,
    20: 29, 30: 40, 40: 51, 50: 62, 59: 71, 60: 73,
  };
  for (const [level, value] of Object.entries(expected))
    assert.equal(basePhysicalAttackForLevel(Number(level)), value);
});

await test('CFV3-1 starter allocation scenarios use weapon-configured STR contribution', () => {
  const make = (level: number, str: number, vit: number, dex: number) => {
    const hero = freshHero();
    hero.level = level;
    hero.allocatedStats = { str, vit, dex, int: 0 };
    return hero;
  };
  assert.equal(derivedStats(make(15, 28, 0, 0)).physicalAttack, 23 + 8 + 28);
  assert.equal(derivedStats(make(15, 14, 14, 0)).physicalAttack, 23 + 8 + 14);
  assert.equal(derivedStats(make(15, 0, 0, 28)).physicalAttack, 23 + 8);
  const unarmed = make(15, 28, 0, 0);
  unarmed.equipment.mainHand = null;
  assert.equal(derivedStats(unarmed).physicalAttack, 23);
});

await test('CFV3-2.1 retires the legacy hero.weapon combat contribution', () => {
  const hero = freshHero();
  hero.level = 61;
  hero.allocatedStats = { str: 120, vit: 0, dex: 0, int: 0 };
  hero.equipment.mainHand = null;
  hero.weapon = 999;
  assert.equal(derivedStats(hero).physicalAttack, 74);
});

await test('CFV3-2.1 applies raw ATK to magic only for a Staff or Wand', () => {
  const hero = freshHero();
  hero.level = 30;
  hero.equipment.mainHand = null;
  const unarmedMagic = derivedStats(hero).magicAttack;

  const sword = hero.inventory.find(item => item.templateId === 'legacy-fajar-blade');
  assert.ok(sword);
  hero.equipment.mainHand = sword.id;
  assert.equal(derivedStats(hero).magicAttack, unarmedMagic);

  const staff = createItem('resi-staff', { id: 'cfv3-21-staff', baseStats: { attack: 20 } });
  hero.inventory.push(staff);
  hero.equipment.mainHand = staff.id;
  assert.equal(derivedStats(hero).magicAttack, unarmedMagic + 20);
});

await test('CFV3-2.1 treats magicAttack Rune affixes as flat and resourceEfficiency as percent metadata', () => {
  const hero = freshHero();
  const rune = createItem('rune-arcana', {
    id: 'cfv3-21-rune',
    runeTheme: 'arcana',
    runeRarity: 'simple',
    affixes: [
      { id: 'magic', stat: 'magicAttack', label: 'Magic Attack', value: 7, unit: 'flat', source: 'rune', locked: false },
      { id: 'efficiency', stat: 'resourceEfficiency', label: 'Resource Efficiency', value: 12, unit: 'percent', source: 'rune', locked: false },
    ],
  });
  const necklace = createItem('fajar-necklace', {
    id: 'cfv3-21-necklace',
    sockets: [{ id: 'socket-1', rune: { ...rune, sourceLabel: 'CFV3-2.1 test' } }],
  });
  hero.inventory.push(necklace);
  hero.equipment.necklace = necklace.id;
  const stats = derivedStats(hero);
  assert.equal(stats.magicAttack, derivedStats(freshHero()).magicAttack + 7);
  assert.equal(stats.maxMana, derivedStats(freshHero()).maxMana);
});

await test('CFV3-1 first V2 Core Job change refunds all earned allocation points', () => {
  const hero = createV2TestHero();
  hero.level = 15;
  hero.allocatedStats = { str: 5, vit: 4, dex: 3, int: 2 };
  hero.statPoints = 0;
  assert.equal(authorizeV2Warrior(hero), true);
  assert.deepEqual(hero.allocatedStats, { str: 0, vit: 0, dex: 0, int: 0 });
  assert.equal(hero.statPoints, 28);
});

await test('basic attacks read the central physical attack foundation', () => {
  const hero = freshHero();
  hero.equipment.mainHand = null;
  assert.equal(basicAttackPower(hero), derivedStats(hero).physicalAttack);
});
