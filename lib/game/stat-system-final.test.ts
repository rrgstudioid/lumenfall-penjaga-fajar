import assert from 'node:assert/strict';
import { test } from 'node:test';
import { derivedStats, freshHero, parseSave } from './rules.ts';
import { RUNE_THEME_POOLS } from './items.ts';

await test('final stat system applies the documented primary-stat increments', () => {
  const hero = freshHero();
  const base = derivedStats(hero);
  const one = (stat: 'str' | 'vit' | 'dex' | 'int') => {
    const next = { ...hero, allocatedStats: { ...hero.allocatedStats, [stat]: 1 } };
    return derivedStats(next);
  };
  assert.equal(one('str').physicalAttack - base.physicalAttack, 1);
  assert.equal(one('vit').maxHP - base.maxHP, 8);
  assert.equal(one('vit').physicalDefense - base.physicalDefense, 0.5);
  assert.ok(Math.abs(one('vit').magicDefense - base.magicDefense - 0.6) < 1e-9);
  assert.ok(Math.abs(one('vit').hpRecovery - base.hpRecovery - 0.1) < 1e-9);
  assert.equal(one('dex').accuracy - base.accuracy, 1);
  assert.ok(Math.abs(one('dex').attackSpeed - base.attackSpeed - 0.15) < 1e-9);
  assert.ok(Math.abs(one('dex').evasion - base.evasion - 0.1) < 1e-9);
  assert.ok(Math.abs(one('dex').criticalRate - base.criticalRate - 0.1) < 1e-9);
  assert.equal(one('int').magicAttack - base.magicAttack, 2);
  assert.equal(one('int').maxMana - base.maxMana, 3);
  assert.ok(Math.abs(one('int').magicDefense - base.magicDefense - 0.2) < 1e-9);
  assert.equal(one('int').healingPower - base.healingPower, 0.25);
  assert.equal(base.manaRecovery, 0);
  assert.ok(Math.abs(one('int').manaRecovery - base.manaRecovery - 0.1) < 1e-9);
});

await test('old STA saves migrate to VIT and removed rune stats are remapped', () => {
  const old = JSON.stringify({
    version: 3,
    level: 8,
    gold: 0,
    allocatedStats: { str: 2, sta: 7, dex: 1, int: 3 },
    inventory: [],
    equipment: {},
  });
  const hero = parseSave(old, 'slot-1');
  assert.ok(hero);
  assert.equal(hero.allocatedStats.vit, 7);
  const invalid=parseSave(JSON.stringify({...JSON.parse(old),level:4}))!;
  assert.deepEqual(invalid.allocatedStats,{str:0,vit:0,dex:0,int:0});
  assert.equal(invalid.statPoints,6);
  assert.deepEqual(invalid.migrationArchive?.overAllocatedStats,{str:2,vit:7,dex:1,int:3});
  assert.equal(hero.allocatedStats.sta, undefined);
  assert.ok(RUNE_THEME_POOLS.arcana.includes('magicPenetration'));
  assert.ok(!RUNE_THEME_POOLS.arcana.includes('cooldownReduction'));
  assert.ok(RUNE_THEME_POOLS.elements.includes('magicDefense'));
  assert.ok(!RUNE_THEME_POOLS.elements.includes('elementalResistance'));
  assert.ok(!RUNE_THEME_POOLS.guardian.some(stat => String(stat) === 'tenacity'));
});
