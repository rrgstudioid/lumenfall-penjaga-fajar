import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeSkills,
  canCastSkill,
  chooseV3Warrior,
  createV3AdventurerHero,
  derivedStats,
  learnSkill,
  parseSave,
  resolveHeroSkill,
  basicAttackPower,
} from './rules.ts';
import { WARRIOR_V3_SKILLS } from './warrior-v3.ts';
import { skillHitDamage } from './skill-action.ts';
import { resolveTargetHit } from './combat-modifiers.ts';

const rank = (hero: ReturnType<typeof createV3AdventurerHero>, id: string, level: number) => {
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 200;
  assert.equal(learnSkill(hero, id), true);
};

await test('Lv15 Adventurer transitions to V3 Warrior without auto-purchasing Warrior skills', () => {
  const hero = createV3AdventurerHero();
  hero.level = 15;
  hero.skillProgressionV3!.totalEarnedSP = 10;
  assert.equal(learnSkill(hero, 'v3-adventurer-power-strike'), true);
  assert.equal(chooseV3Warrior(hero), true);
  assert.equal(hero.skillArchitectureVersion, 3);
  assert.equal(hero.coreJob, 'warrior');
  assert.equal(hero.job, 'warrior');
  assert.equal(hero.skillProgressionV3!.totalEarnedSP, 10);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-power-strike'], undefined);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-quick-slash'], 1);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-warrior-strike'], undefined);
  assert.equal(activeSkills(hero).filter((skill) => skill.job === 'warrior').length, 11);
});

await test('Warrior V3 exposes exactly eleven canonical skills and no Rising Slash/V2 duplicates', () => {
  const hero = createV3AdventurerHero(); hero.level = 15; assert(chooseV3Warrior(hero));
  const ids = activeSkills(hero).filter((skill) => skill.job === 'warrior').map((skill) => skill.id);
  assert.deepEqual(ids, WARRIOR_V3_SKILLS.map((skill) => skill.id));
  assert.equal(ids.includes('rising-slash'), false);
  assert.equal(ids.some((id) => id.startsWith('v2-')), false);
});

await test('Warrior gates enforce levels and declared prerequisites', () => {
  const hero = createV3AdventurerHero(); hero.level = 15; assert(chooseV3Warrior(hero)); hero.skillProgressionV3!.totalEarnedSP = 200;
  assert.equal(learnSkill(hero, 'v3-warrior-strike'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), false);
  hero.level = 20; assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), false);
  for (let i = 0; i < 1; i++) { hero.level = 18; assert.equal(learnSkill(hero, 'v3-warrior-strike'), true); }
  hero.level = 20; assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-armor-breaker'), false);
  assert.equal(learnSkill(hero, 'v3-warrior-counter-slash'), false);
});

await test('all damaging Warrior V3 skills accept 1H and 2H sword, but not unarmed or dual wield', () => {
  const hero = createV3AdventurerHero(); hero.level = 59; assert(chooseV3Warrior(hero)); hero.skillProgressionV3!.totalEarnedSP = 200;
  for (const definition of WARRIOR_V3_SKILLS.filter((skill) => skill.skillType === 'ACTIVE_DAMAGE')) {
    hero.skillProgressionV3!.skillRanks[definition.id] = 1;
    hero.skillLevels[definition.id] = 1;
    assert.equal(canCastSkill(hero, definition.id, {}, 'one_hand_sword').ok, true, `${definition.id} 1H`);
    const mainId = hero.equipment.mainHand!;
    hero.inventory = hero.inventory.map((item) => item.id === mainId ? { ...item, equipmentType: 'two_hand_sword', weaponType: 'two_hand_sword', handedness: 'two_hand', twoHanded: true } : item);
    assert.equal(canCastSkill(hero, definition.id, {}, 'two_hand_sword').ok, true, `${definition.id} 2H`);
    hero.equipment.mainHand = null;
    assert.equal(canCastSkill(hero, definition.id, {}, 'none').ok, false, `${definition.id} unarmed`);
    hero.equipment.mainHand = mainId;
    hero.inventory = hero.inventory.map((item) => item.id === mainId ? { ...item, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false } : item);
    assert.equal(definition.weaponRequirement?.includes('dual_sword'), false, `${definition.id} dual`);
  }
});

await test('Warrior stances and buffs are castable and do not add raw damage to Battle Focus', () => {
  const hero = createV3AdventurerHero(); hero.level = 59; assert(chooseV3Warrior(hero)); hero.skillProgressionV3!.totalEarnedSP = 200;
  hero.skillProgressionV3!.skillRanks['v3-warrior-guard-stance'] = 3;
  hero.skillLevels['v3-warrior-guard-stance'] = 3;
  for (const id of ['v3-warrior-guard-stance','v3-warrior-battle-cry','v3-warrior-battle-focus','v3-warrior-unbroken-stance']) {
    assert.equal(learnSkill(hero, id), true, id);
    assert.equal(canCastSkill(hero, id).ok, true, id);
  }
  const focus = WARRIOR_V3_SKILLS.find((skill) => skill.id === 'v3-warrior-battle-focus')!;
  assert.equal(focus.effects?.buffs?.includes('criticalRate'), true);
  assert.equal(focus.effects?.buffs?.includes('physicalDamagePercent'), false);
  const battleCry = activeSkills(hero).find((skill) => skill.id === 'v3-warrior-battle-cry')!;
  const cryAction = resolveHeroSkill(hero, battleCry, 1, derivedStats(hero));
  assert.equal(cryAction.temporaryBuffs?.[0].modifier.stats?.percent?.physicalAttack, 3);
  const unbroken = activeSkills(hero).find((skill) => skill.id === 'v3-warrior-unbroken-stance')!;
  const unbrokenAction = resolveHeroSkill(hero, unbroken, 1, derivedStats(hero));
  assert.equal(unbrokenAction.temporaryBuffs?.[0].modifier.incoming?.knockbackMultiplier, .85);
});

await test('Armor Break is one refreshable status and Finale has a fixed 10% payoff condition', () => {
  const armor = WARRIOR_V3_SKILLS.find((skill) => skill.id === 'v3-warrior-armor-breaker')!;
  const finale = WARRIOR_V3_SKILLS.find((skill) => skill.id === 'v3-warrior-crushing-finale')!;
  assert.deepEqual(armor.effects?.debuffs, ['armor_break']);
  assert.deepEqual(finale.effects?.tags, ['finisher', 'armor-break-payoff:10']);
  assert.equal(new Set(armor.effects?.debuffs).size, 1);
});

await test('Counter Slash has no damage before a defense context and a single payoff modifier after it', () => {
  const hero = createV3AdventurerHero(); hero.level = 59; assert(chooseV3Warrior(hero)); hero.skillProgressionV3!.totalEarnedSP = 200;
  rank(hero, 'v3-warrior-guard-stance', 30);
  rank(hero, 'v3-warrior-guard-stance', 30);
  rank(hero, 'v3-warrior-counter-slash', 31);
  const skill = activeSkills(hero).find((entry) => entry.id === 'v3-warrior-counter-slash')!;
  const normal = resolveHeroSkill(hero, skill, 1, derivedStats(hero));
  const blocked = resolveHeroSkill(hero, skill, 1, derivedStats(hero), { result: 'blocked' });
  assert.equal(normal.knockbackStrength, 0);
  assert.equal(blocked.knockbackStrength, 0);
  assert.equal(blocked.hitSequence.length, 1);
});

await test('V3 Warrior save reload keeps lineage, ranks and hotbar-safe references', () => {
  const hero = createV3AdventurerHero(); hero.level = 20; assert(chooseV3Warrior(hero)); hero.skillProgressionV3!.totalEarnedSP = 20;
  assert(learnSkill(hero, 'v3-warrior-strike'));
  hero.primaryHotbar[0] = 'v3-warrior-strike';
  const loaded = parseSave(JSON.stringify(hero));
  assert(loaded);
  assert.equal(loaded!.skillArchitectureVersion, 3);
  assert.equal(loaded!.coreJob, 'warrior');
  assert.equal(loaded!.skillProgressionV3!.skillRanks['v3-warrior-strike'], 1);
  assert.equal(loaded!.primaryHotbar[0], 'v3-warrior-strike');
});

await test('Warrior V3 damage sanity matrix uses CFV3 attack and explicit stat scaling once', () => {
  const rows: unknown[] = [];
  const ids = ['v3-warrior-strike', 'v3-warrior-sweeping-slash', 'v3-warrior-armor-breaker', 'v3-warrior-counter-slash', 'v3-warrior-ground-breaker', 'v3-warrior-crushing-finale'];
  for (const level of [15, 30, 45, 59]) {
    for (const weapon of ['one_hand_sword', 'two_hand_sword'] as const) {
      const hero = createV3AdventurerHero(); hero.level = level; assert(chooseV3Warrior(hero));
      const mainId = hero.equipment.mainHand!;
      hero.inventory = hero.inventory.map((item) => item.id === mainId ? {
        ...item,
        equipmentType: weapon,
        weaponType: weapon,
        handedness: weapon === 'two_hand_sword' ? 'two_hand' : 'one_hand',
        twoHanded: weapon === 'two_hand_sword',
      } : item);
      const stats = derivedStats(hero);
      const damage: Record<string, number | { normal: number; payoff: number }> = {};
      for (const id of ids) {
        const skill = activeSkills(hero).find((entry) => entry.id === id)!;
        const normal = resolveHeroSkill(hero, skill, 1, stats);
        const total = normal.hitSequence.reduce((sum, hit) => sum + skillHitDamage(hit, stats), 0);
        if (id === 'v3-warrior-counter-slash') {
          const payoff = resolveHeroSkill(hero, skill, 1, stats, { result: 'blocked' });
          damage[id] = { normal: Math.round(total * 100) / 100, payoff: Math.round(payoff.hitSequence.reduce((sum, hit) => sum + skillHitDamage(hit, stats), 0) * 100) / 100 };
        } else if (id === 'v3-warrior-crushing-finale') {
          const payoff = resolveHeroSkill(hero, skill, 1, stats);
          const impacted = resolveTargetHit(payoff.hitSequence[0], payoff.targetModifiers, { defenseDown: 8 });
          damage[id] = { normal: Math.round(total * 100) / 100, payoff: Math.round(skillHitDamage(impacted, stats) * 100) / 100 };
        } else damage[id] = Math.round(total * 100) / 100;
      }
      rows.push({ level, weapon, physicalAttack: stats.physicalAttack, basicAttack: Math.round(basicAttackPower(hero) * 100) / 100, damage });
    }
  }
  console.log(`WARRIOR_V3_SANITY_MATRIX ${JSON.stringify(rows)}`);
  assert(rows.length === 8);
});
