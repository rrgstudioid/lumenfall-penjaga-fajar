import { CITIES } from './regions.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_JOBS, SPECIALIZATIONS, PASSIVES } from './skills.ts';
import {
  allocateStatPoint,
  activeSkills,
  canLearnSkill,
  calculatePassiveEffects,
  characterStatBreakdown,
  chooseCoreJob,
  chooseSpecialization,
  chooseMastery,
  createItem,
  derivedStats,
  equipItem,
  freshHero,
  gainXP,
  getSkillStatus,
  learnPassive,
  learnSkill,
  parseSave,
  refundableSkillPoints,
  resetSkillPoints,
  skillDamagePreview,
  socketRune,
  unlockUniqueStats,
  unequipItem,
} from './rules.ts';
import { createRuneItem, ITEM_CATALOG } from './items.ts';
import {
  CHARACTER_SLOTS,
  getCharacterEquipmentLayers,
  getJobProgression,
  getJobSkillNodes,
  previewEquipmentChange,
} from './character-view.ts';

function trained(spec: keyof typeof SPECIALIZATIONS = 'resi') {
  const hero = freshHero();
  gainXP(hero, 999999);
  hero.gold = 5000;
  unequipItem(hero, 'mainHand');
  chooseCoreJob(hero, SPECIALIZATIONS[spec].coreJob);
  chooseSpecialization(hero, spec);
  return hero;
}
await test('stat allocation changes shared derived stats immutably and rejects empty pool', () => {
  const original = freshHero();
  original.statPoints = 4;
  let hero = original;
  for (const stat of ['str', 'vit', 'dex', 'int'] as const) {
    const old = hero,
      oldJSON = JSON.stringify(old),
      before = derivedStats(old);
    const result = allocateStatPoint(old, stat);
    assert.ok(result.ok);
    hero = result.hero;
    assert.notEqual(hero, old);
    assert.notEqual(hero.allocatedStats, old.allocatedStats);
    assert.equal(JSON.stringify(old), oldJSON);
    assert.notDeepEqual(derivedStats(hero), before);
  }
  assert.equal(hero.statPoints, 0);
  assert.deepEqual(original.allocatedStats, { str: 0, vit: 0, dex: 0, int: 0 });
  assert.equal(allocateStatPoint(hero, 'str').ok, false);
  assert.ok(
    derivedStats(hero).magicAttack > derivedStats(original).magicAttack,
  );
});
await test('all core and specialization trees use the correct registry and exactly four active nodes', () => {
  for (const core of Object.keys(CORE_JOBS) as Array<keyof typeof CORE_JOBS>) {
    const hero = freshHero();
    gainXP(hero, 999999);
    unequipItem(hero, 'mainHand');
    chooseCoreJob(hero, core);
    const nodes = getJobSkillNodes(hero, 'core');
    assert.equal(nodes.active.length, 4);
    assert.ok(nodes.active.every((s) => s.job === core));
    assert.equal(nodes.passive.length, 1);
  }
  for (const spec of Object.keys(SPECIALIZATIONS) as Array<
    keyof typeof SPECIALIZATIONS
  >) {
    const hero = trained(spec);
    const nodes = getJobSkillNodes(hero, 'specialization');
    assert.equal(nodes.active.length, 4);
    assert.ok(nodes.active.every((s) => s.specialization === spec));
    assert.equal(nodes.passive.length, 1);
    assert.equal(getJobSkillNodes(hero, 'mastery').active.length, 4);
    assert.equal(getJobSkillNodes(hero, 'capstone').passive.length, 1);
  }
});
await test('active skill upgrades spend SP, increase actual effect, stop at maximum and forbid foreign job', () => {
  const hero = trained('garda'),
    skill = activeSkills(hero)[0],
    before = skillDamagePreview(hero, skill),
    points = hero.skillPoints;
  assert.ok(learnSkill(hero, skill.id));
  assert.equal(hero.skillPoints, points - 1);
  assert.ok(skillDamagePreview(hero, skill) > before);
  while (learnSkill(hero, skill.id)) {}
  assert.equal(hero.skillLevels[skill.id], skill.maxLevel);
  assert.equal(getSkillStatus(skill.id, hero), 'maxed');
  assert.equal(canLearnSkill('resi-1', hero).ok, false);
});
await test('passive effects apply to all ten jobs and reset refunds investments but not job grants', () => {
  for (const spec of Object.keys(SPECIALIZATIONS) as Array<
    keyof typeof SPECIALIZATIONS
  >) {
    const hero = trained(spec),
      skill = activeSkills(hero)[0],
      passive = PASSIVES[spec];
    const before = derivedStats(hero);
    assert.ok(learnPassive(hero, passive.id));
    assert.notDeepEqual(derivedStats(hero), before);
    assert.ok(learnSkill(hero, skill.id));
    assert.ok(learnPassive(hero, 'adventurer-resolve'));
    // The Adventurer Rank 1 was bought after core promotion reset: all three purchases are paid.
    assert.equal(refundableSkillPoints(hero), 3);
    const state = JSON.stringify(hero),
      inventory = JSON.stringify(hero.inventory),
      points = hero.skillPoints;
    const result = resetSkillPoints(hero);
    assert.ok(result.ok);
    assert.equal(JSON.stringify(hero), state);
    assert.equal(result.hero.gold, 4500);
    assert.equal(result.hero.skillPoints, points + 3);
    assert.equal(result.hero.skillLevels[skill.id], 0);
    assert.equal(result.hero.passiveLevels[passive.id], 1);
    assert.equal(result.hero.passiveLevels['adventurer-resolve'], 0);
    assert.equal(result.hero.specialization, spec);
    assert.equal(JSON.stringify(result.hero.inventory), inventory);
    assert.equal(resetSkillPoints(result.hero).ok, false);
  }
});
await test('reset skill insufficient GOLD is atomic and unspent free skills are never refunded', () => {
  const hero = trained();
  assert.equal(refundableSkillPoints(hero), 0);
  assert.equal(resetSkillPoints(hero).ok, false);
  learnSkill(hero, activeSkills(hero)[0].id);
  hero.gold = 499;
  const before = JSON.stringify(hero);
  assert.equal(resetSkillPoints(hero).ok, false);
  assert.equal(JSON.stringify(hero), before);
});
await test('capstone requires level50, Mastery and main passive rank3; reset cannot duplicate points', () => {
  const hero = trained();
  const cap = 'resi-capstone';
  assert.equal(canLearnSkill(cap, hero).ok, false);
  chooseMastery(hero, activeSkills(hero)[0].id, 'power');
  assert.equal(canLearnSkill(cap, hero).ok, false);
  learnPassive(hero, 'five-elements');
  learnPassive(hero, 'five-elements');
  assert.equal(canLearnSkill(cap, hero).ok, true);
  const before = calculatePassiveEffects(hero);
  assert.ok(learnPassive(hero, cap));
  assert.ok(calculatePassiveEffects(hero).skillDamage! > before.skillDamage!);
  const result = resetSkillPoints(hero);
  assert.ok(result.ok);
  assert.equal(result.returnedPoints, 3);
  assert.equal(result.hero.masteryQuestClaimed, true);
  assert.equal(getSkillStatus(cap, result.hero), 'locked');
  assert.equal(canLearnSkill(cap, result.hero).ok, false);
});
await test('breakdown reconciles exactly with combat stats including enhancement, Rune, optimizer, passive and buff', () => {
  const hero = trained();
  const weapon = hero.inventory.find((i) => i.id === hero.equipment.mainHand)!;
  weapon.enhancementLevel = 4;
  weapon.bonusStats = { int: 3 };
  weapon.sockets = [{ id: 'qa-socket', rune: null }];
  hero.inventory.push(createRuneItem('arcana', 'rare', { id: 'qa-rune' }));
  hero.x=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!.x;hero.z=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!.z;
  assert.ok(socketRune(hero, weapon.id, 'qa-rune', 0,'aruna-3').ok);
  weapon.affixes = [
    {
      id: 'qa-affix',
      stat: 'attackPercent',
      label: 'Attack Power',
      value: 8,
      unit: 'percent',
      quality: 'high',
      source: 'runeOptimizer',
      locked: false,
    },
  ];
  hero.activeBuffs.damageReduction = 30;
  const breakdown = characterStatBreakdown(hero);
  assert.deepEqual(breakdown.final, derivedStats(hero));
  for (const key of Object.keys(breakdown.final) as Array<
    keyof typeof breakdown.final
  >) {
    const sum =
      breakdown.base[key] +
      breakdown.columns.reduce((n, c) => n + c.stats[key], 0);
    assert.ok(Math.abs(sum - breakdown.final[key]) < 0.0001, key);
  }
  assert.ok(
    breakdown.columns.find((c) => c.label === 'Rune')!.stats.skillPower >= 0,
  );
});
await test('equipment preview is read-only, validates slots/hands, and matches final equipped stats', () => {
  const hero = freshHero();
  hero.level = 50;
  const sword = createItem('legacy-fajar-blade'),
    bowTemplate = Object.values(ITEM_CATALOG).find(
      (i) => i.equipmentType === 'bow' && !i.requiredSpecialJob,
    )!;
  const bow = createItem(bowTemplate.templateId),
    shield = createItem('garda-shield');
  shield.requiredSpecialJob = null;
  shield.requiredCoreJob = null;
  sword.requiredCoreJob = null;
  hero.inventory.push(sword, shield, bow);
  assert.ok(equipItem(hero, sword.id).ok);
  assert.ok(equipItem(hero, shield.id).ok);
  const before = JSON.stringify(hero);
  assert.equal(
    previewEquipmentChange(hero, bow, 'offHand').validation.ok,
    false,
  );
  const preview = previewEquipmentChange(hero, bow, 'mainHand');
  assert.ok(preview.validation.ok);
  assert.equal(JSON.stringify(hero), before);
  assert.ok(equipItem(hero, bow.id, 'mainHand').ok);
  assert.deepEqual(derivedStats(hero), preview.after);
  assert.equal(hero.equipment.offHand, null);
  assert.ok(hero.inventory.some((i) => i.id === shield.id));
  assert.equal(
    previewEquipmentChange(hero, shield, 'offHand').validation.ok,
    false,
  );
  assert.equal(
    getCharacterEquipmentLayers(hero).find((l) => l.slot === 'mainHand')!.visual
      .itemId,
    bow.id,
  );
  unequipItem(hero, 'mainHand');
  assert.equal(
    getCharacterEquipmentLayers(hero).some((l) => l.slot === 'mainHand'),
    false,
  );
  assert.equal(CHARACTER_SLOTS.length, 11);
});
await test('Magnifier unlocks only locked Unique Stats once and preserves Rune/Optimizer', () => {
  const hero = trained(),
    item = hero.inventory.find((i) => i.id === hero.equipment.mainHand)!;
  item.bonusStats = { hp: 123 };
  item.uniqueStatsLocked = true;
  const before = derivedStats(hero).maxHP;
  assert.equal(unlockUniqueStats(hero, item.id).ok, false);
  hero.inventory.push(createItem('magnifier'));
  assert.ok(unlockUniqueStats(hero, item.id).ok);
  assert.equal(derivedStats(hero).maxHP, before + 123);
  assert.equal(unlockUniqueStats(hero, item.id).ok, false);
  assert.equal(
    hero.inventory.some((i) => i.itemType === 'magnifier'),
    false,
  );
});
await test('new UI changes survive save reload and legacy equipment remains unlocked', () => {
  let hero = trained('anom');
  hero = allocateStatPoint(hero, 'dex').hero;
  learnSkill(hero, activeSkills(hero)[0].id);
  learnPassive(hero, 'rogue-foundation');
  chooseMastery(hero, activeSkills(hero)[0].id, 'utility');
  const restored = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(restored.allocatedStats, hero.allocatedStats);
  assert.deepEqual(restored.skillLevels, hero.skillLevels);
  assert.deepEqual(restored.passiveLevels, hero.passiveLevels);
  assert.deepEqual(restored.jobHistory, hero.jobHistory);
  assert.equal(restored.gold, hero.gold);
  assert.deepEqual(restored.equipment, hero.equipment);
  assert.equal(getJobProgression(restored).length, 5);
  assert.equal(
    getJobProgression(restored).find((s) => s.id === 'mastery')!.status,
    'Current',
  );
  const legacy = {
    ...hero,
    jobHistory: undefined,
    inventory: hero.inventory.map((i) => ({
      ...i,
      uniqueStatsLocked: undefined,
    })),
  };
  assert.ok(
    parseSave(JSON.stringify(legacy))!.inventory.every(
      (i) => !i.uniqueStatsLocked,
    ),
  );
});
