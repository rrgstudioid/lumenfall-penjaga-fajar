import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateStatPoint, chooseV3Warrior, createV3AdventurerHero, derivedStats,
  gainXP, learnSkill, parseSave, xpNeeded, unequipItem,
} from './rules.ts';

// Positive actors use actual progression/purchase/allocation; no rank/SP injection.
function ready(level = 15) {
  let hero = createV3AdventurerHero('warrior-core-contract');
  while (hero.level < level) assert.equal(gainXP(hero, xpNeeded(hero.level)), 1);
  for (const [id, count] of [
    ['v3-adventurer-quick-slash', 5], ['v3-adventurer-power-strike', 5],
    ['v3-adventurer-minor-heal', 3],
  ] as const) for (let i = hero.skillLevels[id] ?? 0; i < count; i++) assert(learnSkill(hero, id));
  for (let i = 0; i < 2 * (level - 1); i++) {
    const result = allocateStatPoint(hero, (['str', 'vit', 'dex', 'int'] as const)[i % 4]);
    assert(result.ok); hero = result.hero;
  }
  for (const slot of Object.keys(hero.equipment) as Array<keyof typeof hero.equipment>)
    if (hero.equipment[slot]) assert(unequipItem(hero, slot).ok);
  return hero;
}

await test('legal Lv15: refund 28 primary points and 12 paid SP, retain free Quick1 and earned14', () => {
  const h = ready();
  assert.deepEqual(h.allocatedStats, {str: 7, vit: 7, dex: 7, int: 7});
  assert.equal(h.statPoints, 0); assert.equal(h.skillProgressionV3!.totalEarnedSP, 14);
  assert.equal(h.skillPoints, 2);
  const identity = [h.characterId, h.slotId], inventory = structuredClone(h.inventory);
  assert(chooseV3Warrior(h));
  assert.deepEqual(h.allocatedStats, {str: 0, vit: 0, dex: 0, int: 0});
  assert.equal(h.statPoints, 28); assert.equal(h.skillPoints, 14);
  assert.equal(h.skillProgressionV3!.totalEarnedSP, 14);
  assert.deepEqual(h.skillProgressionV3!.skillRanks, {'v3-adventurer-quick-slash': 1});
  assert.deepEqual(h.skillProgressionV3!.grantedRanks, {'v3-adventurer-quick-slash': 1});
  assert.equal(h.skillLevels['v3-adventurer-power-strike'], 0);
  assert.equal(h.skillLevels['v3-adventurer-minor-heal'], 0);
  assert.equal(h.skillLevels['v3-warrior-strike'], 0);
  assert.deepEqual([h.characterId, h.slotId], identity); assert.deepEqual(h.inventory, inventory);
  assert(h.primaryHotbar.every(x => x === null)); assert.deepEqual(h.primaryHotbarOverflow, []);
});

await test('Core resource policy: preserve absolute current then clamp, no free refill', () => {
  const low = ready(); low.hp = 42; low.mana = 12;
  assert(chooseV3Warrior(low)); assert.equal(low.hp, 42); assert.equal(low.mana, 12);
  assert.equal(low.maxMana, derivedStats(low).maxMana);
  const high = ready(); const before = derivedStats(high); high.hp = before.maxHP; high.mana = before.maxMana;
  const hp = high.hp, mana = high.mana; assert(chooseV3Warrior(high));
  const after = derivedStats(high); // Resource numbers remain LEGACY_CLASS_COMPATIBILITY, not new balance ACC.
  assert.equal(high.hp, Math.min(hp, after.maxHP)); assert.equal(high.mana, Math.min(mana, after.maxMana));
});

await test('reselect and real save parser never refund purchased Warrior rank or newly allocated points twice', () => {
  let h = ready(); assert(chooseV3Warrior(h)); assert(learnSkill(h, 'v3-warrior-strike'));
  const allocated = allocateStatPoint(h, 'str'); assert(allocated.ok); h = allocated.hero;
  assert.equal(h.statPoints, 27); assert.equal(h.skillPoints, 12);
  const before = JSON.stringify(h); assert.equal(chooseV3Warrior(h), false); assert.equal(JSON.stringify(h), before);
  const loaded = parseSave(before); assert(loaded);
  assert.equal(loaded.statPoints, 27); assert.equal(loaded.allocatedStats.str, 1);
  assert.equal(loaded.skillPoints, 12); assert.equal(loaded.skillProgressionV3!.totalEarnedSP, 14);
  const reloadBefore = JSON.stringify(loaded); assert.equal(chooseV3Warrior(loaded), false);
  assert.equal(JSON.stringify(loaded), reloadBefore);
});

await test('rejected level and equipped gear leave complete Hero unchanged', () => {
  const below = ready(14), equipped = createV3AdventurerHero('equipped-core-reject');
  while (equipped.level < 15) gainXP(equipped, xpNeeded(equipped.level));
  for (const h of [below, equipped]) {
    const before = JSON.stringify(h); assert.equal(chooseV3Warrior(h), false); assert.equal(JSON.stringify(h), before);
  }
});

await test('base primary remains15 and all28 returned points can be legally allocated after Core', () => {
  let h = ready(); assert(chooseV3Warrior(h));
  for (let i = 0; i < 28; i++) { const result = allocateStatPoint(h, 'str'); assert(result.ok); h = result.hero; }
  const stats = derivedStats(h); assert.equal(stats.str, 43); assert.equal(stats.vit, 15);
  assert.equal(stats.dex, 15); assert.equal(stats.int, 15); assert.equal(h.statPoints, 0);
  const before = JSON.stringify(h), rejected = allocateStatPoint(h, 'str'); assert.equal(rejected.ok, false);
  assert.equal(JSON.stringify(h), before);
});
