import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from './items.ts';
import { activeSkills, chooseV3BladeMaster, chooseV3Warrior, createV3AdventurerHero, derivedStats, equipItem, learnSkill, resetSkillPoints, resolveHeroSkill } from './rules.ts';
import { bladeMasterDualWieldActive } from './blade-master-v3.ts';
import { resolveWeaponAttackContext } from './dual-wield.ts';
import { BLADE_MASTER_V3_RUNTIME_MAP } from './blade-master-v3.ts';

function sword(id: string, attack: number) { return createItem('legacy-fajar-blade', { id, baseStats: { attack }, equipSlot: 'mainHand', mainHand: true, offHand: false, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false }); }

await test('Blade Master V3 transition exposes exactly nine skills and preserves ancestry', () => {
  const hero = createV3AdventurerHero(); hero.level = 60; hero.skillProgressionV3!.totalEarnedSP = 200;
  assert.equal(chooseV3Warrior(hero), true); assert.equal(chooseV3BladeMaster(hero), true);
  assert.equal(hero.coreJob, 'warrior'); assert.equal(hero.specialization, 'blade_master');
  assert.deepEqual(activeSkills(hero).filter(skill => skill.tags?.includes('v3-blade-master')).map(skill => skill.id), [
    'v3-blade-master-twin-blade-mastery','v3-blade-master-twin-assault','v3-blade-master-blade-rush','v3-blade-master-counterflow','v3-blade-master-blade-focus','v3-blade-master-cross-sever','v3-blade-master-piercing-sequence','v3-blade-master-tempo-drive','v3-blade-master-blade-tempest',
  ]);
});

await test('Twin Blade Mastery is the production capability source and gates equipment', () => {
  const hero = createV3AdventurerHero(); hero.level = 60; hero.skillProgressionV3!.totalEarnedSP = 200; chooseV3Warrior(hero); chooseV3BladeMaster(hero);
  const main = sword('bm-main', 100), off = sword('bm-off', 70); hero.inventory.push(main, off); hero.equipment.mainHand = main.id;
  assert.equal(equipItem(hero, off.id, 'offHand').ok, false);
  assert.equal(learnSkill(hero, 'v3-blade-master-twin-blade-mastery'), true); assert.equal(bladeMasterDualWieldActive(hero), true);
  assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
  assert.deepEqual(resolveWeaponAttackContext(main, off, 'DUAL_COMBINED', 200).totalWeaponAttack, 170);
});

await test('refunding Mastery removes capability and safely returns the Off Hand item to inventory', () => {
  const hero = createV3AdventurerHero(); hero.level = 60; hero.gold = 1000; hero.skillProgressionV3!.totalEarnedSP = 200; chooseV3Warrior(hero); chooseV3BladeMaster(hero);
  const main = sword('bm-reset-main', 100), off = sword('bm-reset-off', 70); hero.inventory.push(main, off); hero.equipment.mainHand = main.id; learnSkill(hero, 'v3-blade-master-twin-blade-mastery'); equipItem(hero, off.id, 'offHand');
  const result = resetSkillPoints(hero); assert.equal(result.ok, true); assert.equal(bladeMasterDualWieldActive(result.hero), false); assert.equal(result.hero.equipment.mainHand, main.id); assert.equal(result.hero.equipment.offHand, null); assert.equal(result.hero.inventory.find(item => item.id === off.id)?.baseStats.attack, 70);
});

await test('Blade Master capability is derived, not granted by a stale persisted flag', () => {
  const hero = createV3AdventurerHero(); hero.level = 60; hero.skillProgressionV3!.totalEarnedSP = 200; chooseV3Warrior(hero); chooseV3BladeMaster(hero);
  hero.canDualWieldOneHandSwords = true;
  assert.equal(bladeMasterDualWieldActive(hero), false);
  const mastery = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-blade-mastery'];
  assert.deepEqual(mastery.rankEffects?.map((entry) => entry.modifiers?.[0]?.stats?.flat?.accuracy), [2,4,6,8,10]);
});

await test('Twin Blade Mastery R1–R5 resolves the canonical Mana reduction with no sixth rank', () => {
  const hero = createV3AdventurerHero(); hero.level = 80; hero.skillProgressionV3!.totalEarnedSP = 200;
  assert.equal(chooseV3Warrior(hero), true); assert.equal(chooseV3BladeMaster(hero), true);
  const masteryId = 'v3-blade-master-twin-blade-mastery';
  const mastery = BLADE_MASTER_V3_RUNTIME_MAP[masteryId];
  const twinAssault = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-assault'];
  assert.equal(mastery.maxLevel, 5);
  const main = sword('bm-mana-main', 100), off = sword('bm-mana-off', 70);
  hero.inventory.push(main, off); hero.equipment.mainHand = main.id;

  // Test-only cost of 100 MP exposes each percentage despite integer-MP rounding.
  // The production Twin Assault definition, tags, weapon rules, and resolver are unchanged.
  const diagnosticSkill = {
    ...twinAssault,
    manaCost: 100,
    rankValues: twinAssault.rankValues?.map((values) => ({ ...values, manaCost: 100 })),
  };
  const expectedCost = [100, 98, 96, 94, 92];
  const actualLiveCost = [17, 17, 17, 16, 16];
  for (let rank = 1; rank <= 5; rank++) {
    assert.equal(learnSkill(hero, masteryId), true);
    assert.equal(hero.skillProgressionV3!.skillRanks[masteryId], rank);
    if (rank === 1) assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
    const baselineStats = { ...derivedStats(hero), manaCostReduction: 0 };
    const diagnostic = resolveHeroSkill(hero, diagnosticSkill, 8, baselineStats);
    const live = resolveHeroSkill(hero, twinAssault, 8, baselineStats);
    assert.equal(diagnostic.weaponAllowed, true);
    assert.equal(diagnostic.manaCost, expectedCost[rank - 1], `Mastery R${rank} diagnostic cost`);
    assert.equal(live.manaCost, actualLiveCost[rank - 1], `Mastery R${rank} Twin Assault R8 cost`);
  }
  assert.equal(learnSkill(hero, masteryId), false);
  assert.equal(hero.skillProgressionV3!.skillRanks[masteryId], 5);
});
