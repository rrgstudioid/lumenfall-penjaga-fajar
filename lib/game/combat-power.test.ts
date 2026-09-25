import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeSkills, calculateFinalCharacterStats, chooseCoreJob, chooseSpecialization,
  equipItem, freshHero, getEquippedItems, parseSave, skillDamageParts, skillDamagePreview, skillHealingPreview,
  unequipItem, socketRune, enhanceItem, unlockUniqueStats, type Hero,
} from './rules.ts';
import { CITIES } from './regions.ts';
import { createItem, createRuneItem, type StatBlock } from './items.ts';
import { ALL_SKILLS, MASTERY_EFFECTS, skillCombatScaling, type CoreJobId } from './skills.ts';
import { previewEquipmentChange } from './character-view.ts';
import { COMBAT_POWER_CONFIG as CONFIG } from './combat-power-config.ts';
import { blockChance, criticalChance, evasionChance, mitigateDamage } from './combat-mechanics.ts';
import {
  buildCombatPowerProfile, calculateCombatPower, calculateCombatPowerFromStats,
  clearCombatPowerCache, evaluateSpecialEffectPower, formatCombatPowerDebug,
  getCombatPower, previewStatCombatPower, type PowerProfile,
} from './combat-power.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function build(job: CoreJobId = 'warrior') {
  const hero = freshHero();
  hero.level = 50;
  hero.gold = 999999;
  unequipItem(hero, 'mainHand');
  assert(chooseCoreJob(hero, job));
  const training = hero.inventory.find(i => i.requiredCoreJob === job && i.mainHand)!;
  assert(training && equipItem(hero, training.id, 'mainHand').ok);
  if (job === 'hunter') hero.inventory.push(createItem('arrows', { quantity: 100 }));
  for (const skill of activeSkills(hero)) hero.skillLevels[skill.id] = 3;
  hero.allocatedStats = job === 'wizard' || job === 'acolyte'
    ? { str: 0, vit: 30, dex: 0, int: 100 }
    : { str: 100, vit: 30, dex: 20, int: 0 };
  return hero;
}
function addStats(hero: Hero, stats: StatBlock) {
  const ring = createItem('arunika-ring1', { baseStats: stats, bonusStats: {}, uniqueStatsLocked: false, enhancementLevel: 0 });
  hero.inventory.push(ring);
  assert(equipItem(hero, ring.id, 'ring1').ok);
  return hero.inventory.find(item => item.id === ring.id)!;
}
const withStats = (hero: Hero, overrides: Partial<ReturnType<typeof calculateFinalCharacterStats>>) => {
  const stats = { ...calculateFinalCharacterStats(hero), ...overrides };
  return calculateCombatPowerFromStats(stats, buildCombatPowerProfile(hero, stats));
};

await test('A / G: physical kit uses physical coefficients, unused magic gives no offensive CP', () => {
  const hero = build(), cp = calculateCombatPower(hero);
  assert.equal(cp.details.physicalRelevance, 1);
  assert.equal(cp.details.magicRelevance, 0);
  assert(cp.details.physicalContribution > 0);
  assert.equal(withStats(hero, { magicAttack: 99999 }).offensivePower, cp.offensivePower);
  assert(withStats(hero, { physicalAttack: 999 }).offensivePower > cp.offensivePower);
});
await test('B: real Wizard uses magic spells but still has physical basics; no false pure-magic job rule', () => {
  const hero = build('wizard'), cp = calculateCombatPower(hero);
  assert(cp.details.magicRelevance > 0 && cp.details.physicalRelevance > 0);
  assert(cp.details.magicContribution > 0);
  assert(withStats(hero, { magicAttack: 999 }).offensivePower > cp.offensivePower);
  const profile = buildCombatPowerProfile(hero);
  const pure: PowerProfile = { ...profile, actions: profile.actions.filter(a => a.magicCoefficient > 0 && !a.physicalCoefficient) };
  assert(pure.actions.length);
  const stats = calculateFinalCharacterStats(hero);
  const result = calculateCombatPowerFromStats(stats, pure);
  assert.equal(result.details.magicRelevance, 1);
  assert.equal(result.offensivePower, calculateCombatPowerFromStats({ ...stats, physicalAttack: 999999 }, pure).offensivePower);
});
await test('C: mixed scaling is shared by actual damage and CP, including a magic-capable physical job', () => {
  const hero = build();
  const skill = { ...activeSkills(hero).find(s => s.job === 'warrior')!, combatScaling: { physical: .65, magic: .35, damageType: 'physical' as const } };
  const stats = calculateFinalCharacterStats(hero);
  const old = skillDamagePreview(hero, skill);
  const changed = structuredClone(hero);
  addStats(changed, { magicAttack: 50 });
  assert(skillDamagePreview(changed, skill) > old);
  const profile = buildCombatPowerProfile(hero);
  profile.actions = [{ ...profile.actions[0], physicalCoefficient: .65, magicCoefficient: .35, flat: 0, critical: false, attackSpeed: false, rate: 1 }];
  const cp = calculateCombatPowerFromStats(stats, profile);
  near(cp.details.physicalRelevance, .65);
  near(cp.details.magicRelevance, .35);
  assert(calculateCombatPowerFromStats({ ...stats, magicAttack: stats.magicAttack + 50 }, profile).offensivePower > cp.offensivePower);
  assert(calculateCombatPowerFromStats({ ...stats, physicalAttack: stats.physicalAttack + 50 }, profile).offensivePower > cp.offensivePower);
});
await test('D: same All Job item has build-dependent delta and no rarity points', () => {
  const deltas = ['warrior', 'wizard'].map(job => {
    const hero = build(job as CoreJobId);
    const ring = createItem('arunika-ring1', { baseStats: { str: 8, int: 8, attack: 20, magicAttack: 20, defense: 50 }, bonusStats: {} });
    hero.inventory.push(ring);
    const p = previewEquipmentChange(hero, ring, 'ring1');
    assert(p.validation.ok && p.combatPower);
    assert(p.combatPower.delta > 0);
    const equipped = p.hero;
    const before = calculateCombatPower(equipped);
    equipped.inventory.find(i => i.id === ring.id)!.rarity = 'legacy';
    assert.deepEqual(calculateCombatPower(equipped), before);
    return p.combatPower.delta;
  });
  assert.notEqual(deltas[0], deltas[1]);
});
await test('E / F: defense and magic defense both increase balanced global EHP for every job', () => {
  for (const job of ['warrior', 'wizard', 'rogue', 'hunter', 'acolyte'] as CoreJobId[]) {
    const hero = build(job), stats = calculateFinalCharacterStats(hero), before = calculateCombatPower(hero);
    const defense = withStats(hero, { physicalDefense: stats.physicalDefense + 100 });
    assert(defense.details.physicalEHP > before.details.physicalEHP);
    assert(defense.total > before.total);
    const magic = withStats(hero, { magicDefense: stats.magicDefense + 100 });
    assert(magic.details.magicEHP > before.details.magicEHP);
    assert(magic.total > before.total);
    assert.equal(magic.details.magicDefenseActive, true);
    const incoming = mitigateDamage(1, stats.physicalDefense, hero.level) * (1 - stats.damageReduction / 100) * (1 - evasionChance(stats.evasion)) * (1 - blockChance(stats.blockRate) * .3);
    near(before.details.physicalEHP, stats.maxHP / incoming);
  }
});
await test('balanced defensive coverage beats an extreme one-channel build', () => {
  const hero = build(), profile = buildCombatPowerProfile(hero), stats = calculateFinalCharacterStats(hero);
  const balanced = calculateCombatPowerFromStats({ ...stats, maxHP: 10000, physicalDefense: 10000, magicDefense: 10000 }, profile);
  const extreme = calculateCombatPowerFromStats({ ...stats, maxHP: 10000, physicalDefense: 18000, magicDefense: 2000 }, profile);
  assert(balanced.details.coreDefensiveEHP > extreme.details.coreDefensiveEHP);
  assert(balanced.defensivePower > extreme.defensivePower);
});
await test('geometric defensive EHP is symmetric and numerically safe', () => {
  const hero = build(), profile = buildCombatPowerProfile(hero), stats = calculateFinalCharacterStats(hero);
  const ab = calculateCombatPowerFromStats({ ...stats, maxHP: 10000, physicalDefense: 9000, magicDefense: 2000 }, profile);
  const ba = calculateCombatPowerFromStats({ ...stats, maxHP: 10000, physicalDefense: 2000, magicDefense: 9000 }, profile);
  near(ab.details.coreDefensiveEHP, ba.details.coreDefensiveEHP);
  for (const value of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = calculateCombatPowerFromStats({ ...stats, magicDefense: value }, profile);
    assert(Number.isFinite(result.total) && result.total >= 0);
  }
});
await test('magic-only defensive gear increases CP without changing live combat rules', () => {
  const hero = build(), stats = calculateFinalCharacterStats(hero);
  const base = calculateCombatPower(hero);
  const magicOnly = withStats(hero, { magicDefense: stats.magicDefense + 250 });
  assert(magicOnly.details.magicEHP > base.details.magicEHP);
  assert(magicOnly.defensivePower > base.defensivePower);
  assert(magicOnly.total > base.total);
  // The production damage helper remains the source of truth for live combat;
  // this test intentionally changes only the CP input snapshot.
  assert.equal(mitigateDamage(100, stats.physicalDefense, hero.level),
    100 * (1 - Math.max(0, stats.physicalDefense) /
      (Math.max(0, stats.physicalDefense) + 500 + Math.max(1, hero.level) * 10)));
});
await test('standard reference target is independent of mutable field roster and map', () => {
  const hero = build(), before = calculateCombatPower(hero), profile = buildCombatPowerProfile(hero);
  const snapshot = JSON.stringify(profile.targets);
  profile.targets[0].defense += 99999;
  assert.notEqual(calculateCombatPowerFromStats(calculateFinalCharacterStats(hero), profile).total, before.total);
  assert.equal(JSON.stringify(buildCombatPowerProfile(hero).targets), snapshot);
  hero.currentField = 'east-gate'; hero.x = 999; hero.z = -999;
  assert.equal(calculateCombatPower(hero).total, before.total);
});
await test('H: socket STR flows through final stats once, identical to the same base stat', () => {
  const hero = build(), ring = addStats(hero, {}), before = calculateCombatPower(hero);
  const rune = createRuneItem('might', 'rare');
  rune.affixes = [{ id: 'str', stat: 'str', label: 'STR', value: 8, unit: 'flat', quality: 'normal', source: 'rune', locked: false }];
  ring.sockets = [{ id: 'socket', rune: { ...rune, sourceLabel: 'QA' } }];
  const runed = calculateCombatPower(hero);
  assert(runed.total > before.total);
  ring.sockets = []; ring.baseStats = { str: 8 };
  assert.deepEqual(calculateCombatPower(hero), runed);
});
await test('I: enhancement uses actual stat multiplier, never a level score', () => {
  const hero = build(), ring = addStats(hero, { attack: 80 });
  const before = calculateCombatPower(hero);
  ring.enhancementLevel = 8;
  const enhanced = calculateCombatPower(hero);
  assert(enhanced.total > before.total);
  ring.enhancementLevel = 0; ring.baseStats.attack = 80 * (1 + 8 * .08);
  assert.deepEqual(calculateCombatPower(hero), enhanced);
  ring.baseStats = {}; const empty = calculateCombatPower(hero);
  ring.enhancementLevel = 12;
  assert.deepEqual(calculateCombatPower(hero), empty);
});
await test('J: preview never mutates state and equals actual equip; invalid slot has no After Equip', () => {
  const hero = build(), ring = createItem('arunika-ring1', { baseStats: { str: 20, defense: 80 } });
  hero.inventory.push(ring);
  const original = JSON.stringify(hero);
  const preview = previewEquipmentChange(hero, ring, 'ring2');
  assert(preview.combatPower);
  assert.equal(JSON.stringify(hero), original);
  assert.equal(previewEquipmentChange(hero, ring, 'head').combatPower, null);
  assert.equal(JSON.stringify(hero), original);
  assert(equipItem(hero, ring.id, 'ring2').ok);
  assert.deepEqual(calculateCombatPower(hero), preview.combatPower.after);
});
await test('stat preview is immutable and reconciliation/display rounding are exact', () => {
  const hero = build(), original = JSON.stringify(hero);
  const preview = previewStatCombatPower(hero, { str: 101 });
  assert(preview.delta > 0);
  assert.equal(JSON.stringify(hero), original);
  const cp = preview.after;
  assert.equal(cp.total, Math.round(CONFIG.displayScale * (cp.offensivePower + cp.defensivePower + cp.sustainPower + cp.utilityPower + cp.specialEffectPower)));
  assert.equal(cp.contributions.reduce((sum, c) => sum + c.value, 0), cp.total);
});
await test('critical expected damage uses percent format, cap80; skills do not crit', () => {
  const hero = build(), stats = calculateFinalCharacterStats(hero), profile = buildCombatPowerProfile(hero);
  near(criticalChance(12.5), .125);
  const cp = calculateCombatPowerFromStats({ ...stats, criticalRate: 12.5, criticalDamage: 200 }, profile);
  near(cp.details.criticalFactor, 1.125);
  assert(cp.details.critContribution > 0);
  assert.equal(withStats(hero, { criticalRate: 80 }).total, withStats(hero, { criticalRate: 1000 }).total);
  const spells = { ...profile, actions: profile.actions.filter(a => !a.critical) };
  assert.equal(calculateCombatPowerFromStats({ ...stats, criticalRate: 0 }, spells).offensivePower, calculateCombatPowerFromStats({ ...stats, criticalRate: 100 }, spells).offensivePower);
});
await test('speed controlled; inactive accuracy, HP regen, loot and text-only procs do not inflate CP', () => {
  const hero = build(), before = calculateCombatPower(hero);
  assert.equal(withStats(hero, { accuracy: 99999, hpRecovery: 99999, expGain: 9999 }).total, before.total);
  assert.equal(withStats(hero, { attackSpeed: 300 }).total, withStats(hero, { attackSpeed: 9999 }).total);
  const ring = addStats(hero, {}), base = calculateCombatPower(hero);
  ring.uniqueEffect = 'Chance to reset cooldown';
  const effect = calculateCombatPower(hero);
  assert.equal(effect.total, base.total);
  assert.equal(effect.specialEffectPower, 0);
  assert(effect.details.unsupportedEffects.includes(ring.uniqueEffect));
});
await test('block/evasion use expected damage reduction and live caps', () => {
  const hero = build(), before = calculateCombatPower(hero);
  const block = withStats(hero, { blockRate: 50 });
  assert(block.defensivePower > before.defensivePower);
  near(block.details.expectedBlockReduction, .15);
  assert.equal(block.total, withStats(hero, { blockRate: 999 }).total);
  assert.equal(withStats(hero, { evasion: 50 }).total, withStats(hero, { evasion: 999 }).total);
});
await test('healing power only enters usable heal; MP and CDR have no duplicate raw-stat awards', () => {
  const warrior = build();
  assert.equal(withStats(warrior, { healingPower: 9999 }).sustainPower, calculateCombatPower(warrior).sustainPower);
  const healer = build('acolyte'), cp = calculateCombatPower(healer);
  assert(cp.details.healingPerSecond > 0);
  const profile = buildCombatPowerProfile(healer);
  for (const skill of activeSkills(healer).filter(s => s.effect === 'heal')) {
    const action = profile.actions.find(a => a.id === skill.id);
    if (action) assert.equal(action.healing, skillHealingPreview(healer, skill));
  }
  const bare = build(); bare.skillLevels = {};
  const before = calculateCombatPower(bare);
  assert.equal(withStats(bare, { maxMana: 9999, manaRecovery: 9999, manaCostReduction: 50, cooldownReduction: 30 }).total, before.total);
});
await test('resource budget is shared once across spells, MP and regen improve only a resource-limited rotation', () => {
  const hero = build('wizard'), stats = calculateFinalCharacterStats(hero), profile = buildCombatPowerProfile(hero);
  for (const a of profile.actions) if (!a.critical) { a.manaCost = 100; a.rate = 1; }
  const low = calculateCombatPowerFromStats({ ...stats, maxMana: 100, manaRecovery: 8 }, profile);
  const high = calculateCombatPowerFromStats({ ...stats, maxMana: 100, manaRecovery: 30 }, profile);
  assert(low.details.resourceFactor < 1);
  assert(high.offensivePower > low.offensivePower);
  const spent = profile.actions.reduce((sum, a) => sum + a.rate * a.manaCost, 0) * low.details.resourceFactor;
  near(spent, 100 / CONFIG.encounterSeconds + 8);
});
await test('job advancement invalidates CP and reads newly granted specialization kit/passive', () => {
  const hero = build(), before = getCombatPower(hero);
  for (const slot of Object.keys(hero.equipment) as Array<keyof Hero['equipment']>) if (slot !== 'pet') unequipItem(hero, slot);
  assert(chooseSpecialization(hero, 'gatotkaca'));
  const next = getCombatPower(hero);
  assert.notEqual(next, before);
  assert(next.details.evaluatedSkillIds.some(id => id.startsWith('gatotkaca-')));
  assert.deepEqual(next, calculateCombatPower(hero));
});
await test('locked Unique Stats excluded until Magnifier; ignored generic affixes stay excluded', () => {
  const hero = build(), ring = addStats(hero, {});
  const baseline = calculateCombatPower(hero);
  ring.bonusStats = { attack: 99 }; ring.uniqueStatsLocked = true;
  assert.equal(calculateCombatPower(hero).total, baseline.total);
  ring.uniqueStatsLocked = false;
  assert(calculateCombatPower(hero).total > baseline.total);
  ring.bonusStats = {}; ring.affixes = [{ id: 'retired', stat: 'attack', value: 9999, unit: 'flat', label: 'retired' }];
  assert.equal(calculateCombatPower(hero).total, baseline.total);
});
await test('cache reacts to in-place stat/equipment/rune/skill/passive/buff changes but not frame data', () => {
  clearCombatPowerCache();
  const hero = build(), before = getCombatPower(hero);
  hero.hp--; hero.mana--; hero.x++; hero.z++;
  assert.equal(getCombatPower(hero), before);
  hero.allocatedStats.str++;
  assert.notEqual(getCombatPower(hero), before);
  const mutations = [
    () => { getEquippedItems(hero)[0].enhancementLevel++; },
    () => { hero.passiveLevels['adventurer-resolve'] = 2; },
    () => { hero.skillLevels[activeSkills(hero)[0].id]++; },
    () => { hero.activeBuffs.damageReduction = 3; },
  ];
  for (const mutate of mutations) { const old = getCombatPower(hero); mutate(); assert.notEqual(getCombatPower(hero), old); assert.deepEqual(getCombatPower(hero), calculateCombatPower(hero)); }
  const buffed = getCombatPower(hero); hero.activeBuffs.damageReduction = 2;
  assert.equal(getCombatPower(hero), buffed);
  delete hero.activeBuffs.damageReduction;
  assert.notEqual(getCombatPower(hero), buffed);
});
await test('save/load re-derives CP; no persistent CP property is written', () => {
  const hero = build(), state = JSON.stringify(hero);
  getCombatPower(hero);
  assert.equal(JSON.stringify(hero), state);
  const loaded = parseSave(state); assert(loaded);
  assert.equal(getCombatPower(loaded).total, calculateCombatPower(loaded).total);
  assert(!Object.keys(loaded).some(key => /combatpower/i.test(key)));
});
await test('all legacy skill damage and mitigation remain identical after shared-math extraction', () => {
  const hero = build('wizard'), stats = calculateFinalCharacterStats(hero);
  for (const skill of ALL_SKILLS.filter(s=>s.tree?.architecture!=='v2')) {
    const level = hero.skillLevels[skill.id] ?? 1;
    const modifier = getEquippedItems(hero).reduce((sum, item) => sum + (item.skillModifiers[skill.id] ?? 0), 0);
    const scaling = skillCombatScaling(skill);
    const attack = stats.physicalAttack * scaling.physical + stats.magicAttack * scaling.magic;
    const raw = skill.baseDamage + attack * skill.damageCoefficient + stats.skillPower * scaling.skillPower * skill.damageCoefficient;
    const expected = raw * (1 + (level - 1) * .12) * (hero.masteryChoices[skill.id] === 'power' ? MASTERY_EFFECTS.power.damage : 1) * (1 + modifier) * (1 + Math.max(0, stats.skillDamage) / 100);
    assert.equal(skillDamagePreview(hero, skill), expected);
    assert.equal(skillCombatScaling(skill).damageType, ['wizard', 'acolyte'].includes(skill.job) ? 'magic' : 'physical');
  }
  for (const defense of [0, 50, 500, 99999]) for (const pen of [0, 20, 100, 150]) {
    const effective = Math.max(0, defense * (1 - pen / 100));
    assert.equal(mitigateDamage(300, defense, 50, pen), 300 * (1 - effective / (effective + 1000)));
  }
});
await test('physical skill does not implicitly scale from INT', () => {
  const warrior = build('warrior');
  const physical = activeSkills(warrior).find(skill => skill.job === 'warrior' && skill.effect !== 'heal')!;
  const baseline = skillDamagePreview(warrior, physical);
  const highInt = { ...warrior, allocatedStats: { ...warrior.allocatedStats, int: 100 } };
  assert.equal(skillDamagePreview(highInt, physical), baseline);
});
await test('magic skill responds to Magic Attack, while explicit Skill Power is opt-in', () => {
  const wizard = build('wizard');
  const magic = activeSkills(wizard).find(skill => skill.job === 'wizard' && skill.effect !== 'heal')!;
  const baseline = skillDamagePreview(wizard, magic);
  const highInt = { ...wizard, allocatedStats: { ...wizard.allocatedStats, int: 140 } };
  assert.ok(skillDamagePreview(highInt, magic) > baseline);
  const explicit = { ...magic, skillPowerCoefficient: 1 };
  const parts = skillDamageParts(wizard, explicit, 1, { ...calculateFinalCharacterStats(wizard), skillPower: 10 });
  assert.ok(parts.skillPowerCoefficient > 0);
});
await test('hybrid skill exposes separate physical and magic coefficients', () => {
  const hero = build('warrior');
  const source = activeSkills(hero).find(skill => skill.job === 'warrior' && skill.effect !== 'heal')!;
  const hybrid = { ...source, combatScaling: { physical: .5, magic: .5, skillPower: 0, damageType: 'physical' as const } };
  const parts = skillDamageParts(hero, hybrid);
  assert.ok(parts.physicalCoefficient > 0);
  assert.ok(parts.magicCoefficient > 0);
});
await test('special evaluator de-duplicates actual effects and caps; debug off by default', () => {
  assert.equal(evaluateSpecialEffectPower([{ id: 'x', power: 20 }, { id: 'x', power: 20 }], 1000), 20);
  assert.equal(evaluateSpecialEffectPower([{ id: 'x', power: 999999 }], 1000), 150);
  assert.equal(CONFIG.debug, false);
  assert(JSON.parse(formatCombatPowerDebug(getCombatPower(build()))).physicalEHP > 0);
});
await test('additional inefficient skills do not force mana away from a stronger usable rotation', () => {
  const hero = build('wizard'), stats = calculateFinalCharacterStats(hero), profile = buildCombatPowerProfile(hero);
  profile.actions = [{ ...profile.actions[0], id: 'strong', critical: false, attackSpeed: false,
    physicalCoefficient: 0, magicCoefficient: 2, manaCost: 100, rate: 1 }];
  const limited = { ...stats, maxMana: 100, manaRecovery: 8 };
  const before = calculateCombatPowerFromStats(limited, profile);
  profile.actions.push({ ...profile.actions[0], id: 'weak', magicCoefficient: .01 });
  assert.equal(calculateCombatPowerFromStats(limited, profile).total, before.total);
});
await test('one instance in both hands and pet bonus stats are never counted twice', () => {
  const hero = build();
  const before = calculateCombatPower(hero);
  hero.equipment.offHand = hero.equipment.mainHand;
  assert.deepEqual(calculateCombatPower(hero), before);
  addStats(hero, { attack: 20 });
  const gear = calculateCombatPower(hero);
  const ring = hero.inventory.find(i => i.id === hero.equipment.ring1)!;
  ring.baseStats = {};
  hero.pet = { id: 'qa', level: 1, exp: 0, maxExp: 100, rarity: 'rare', passive: '', bonusStats: { attack: 20 } };
  assert.equal(calculateCombatPower(hero).total, gear.total);
});
await test('real socket, successful enhancement and Magnifier operations each refresh derived CP', () => {
  const hero = build(), npc = CITIES.arunika.npcList.find(n => n.id === 'aruna-3')!;
  hero.inCity = true; hero.currentCity = 'arunika'; hero.x = npc.x; hero.z = npc.z;
  const ring = addStats(hero, { attack: 80 });
  ring.sockets = [{ id: 'live-socket', rune: null }];
  ring.bonusStats = { attack: 25 }; ring.uniqueStatsLocked = true;
  const rune = createRuneItem('might', 'rare', { id: 'live-rune' });
  rune.affixes = [{ id: 'live-str', stat: 'str', value: 8, unit: 'flat', label: 'STR' }];
  hero.inventory.push(rune, createItem('iron', { quantity: 10 }), createItem('magnifier', { quantity: 1 }));
  let before = getCombatPower(hero);
  assert(socketRune(hero, ring.id, rune.id, 0, npc.id).ok);
  assert(getCombatPower(hero).total > before.total);
  before = getCombatPower(hero);
  assert(enhanceItem(hero, ring.id, 0, 0).ok);
  assert(getCombatPower(hero).total > before.total);
  before = getCombatPower(hero);
  const unlocked = unlockUniqueStats(hero, ring.id);
  assert(unlocked.ok);
  assert(getCombatPower(hero).total > before.total);
});
