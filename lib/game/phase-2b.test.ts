import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  createV2TestHero,
  gainXP,
  xpNeeded,
  parseSave,
  chooseCoreJob,
  chooseSpecialization,
  unequipItem,
  equipItem,
  learnSkill,
  learnPassive,
  refundableSkillPoints,
  resetSkillPoints,
  derivedStats,
  resetCharacterStats,
  canLearnSkill,
  resolveHeroSkill,
  saveCharacter,
  SAVE_KEY,
} from './rules.ts';
import {
  ALL_SKILLS,
  ALL_PASSIVES,
  type PassiveDefinition,
  type SkillDefinition,
} from './skills.ts';
import { ABSOLUTE_MAX_LEVEL, progressionRules } from './progression.ts';
import { rankSource, grantRank, paidTreeInvestment } from './rank-ownership.ts';
import {
  addTemporaryModifier,
  tickTemporaryModifiers,
  resolveTargetHit,
  receivedMultiplier,
  type CombatModifier,
} from './combat-modifiers.ts';
import {
  TransientCombatState,
  type CombatSupport,
} from './combat-transient.ts';
import { DefenseEvents, applyStatus } from './combat-status.ts';
import { JOB_V2_REGISTRY } from './job-registry-v2.ts';
import { createItem } from './items.ts';
import {
  getCombatPower,
  buildCombatPowerProfile,
  clearCombatPowerCache,
} from './combat-power.ts';
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const fixture = (patch: Partial<SkillDefinition> = {}): SkillDefinition => ({
  ...ALL_SKILLS[0],
  id: 'test-2b-only',
  progressionMode: 'rank_values',
  baseDamage: 0,
  physicalCoefficient: 1,
  magicCoefficient: 0,
  skillPowerCoefficient: 0,
  weaponRequirement: [],
  maxLevel: 5,
  unlockLevel: 1,
  ...patch,
});
const ctx = { weaponStyle: 'greatsword' as const, hp: 100, maxHP: 100 };
void test('2B cached CP respects skill-local HP predicates and inactive weapon-gated stack previews', () => {
  const hero = freshHero(),
    skill = fixture({
      manaCost: 0,
      modifiers: [
        {
          id: 'skill-lowhp',
          condition: { hpAtOrBelow: 0.5 },
          action: { damagePercent: 50 },
        },
      ],
    });
  hero.skillLevels[skill.id] = 1;
  ALL_SKILLS.push(skill);
  try {
    clearCombatPowerCache();
    hero.hp = derivedStats(hero).maxHP;
    const healthy = getCombatPower(hero);
    hero.hp = 1;
    assert(getCombatPower(hero).offensivePower > healthy.offensivePower);
    const state = new TransientCombatState(),
      support: CombatSupport = {
        stacks: [
          {
            id: 'dual-only',
            duration: 5,
            maxStacks: 3,
            weaponStyle: 'dual_sword',
            modifier: {
              id: 'dual-bonus',
              stats: { flat: { physicalAttack: 99 } },
            },
          },
        ],
      };
    state.successfulCast(1, 0, 'dual_sword', support);
    hero.combatStateModifiers = state.stackModifiers(support);
    assert.equal(
      derivedStats(hero).physicalAttack,
      derivedStats({ ...hero, combatStateModifiers: [] }).physicalAttack,
    );
  } finally {
    ALL_SKILLS.splice(ALL_SKILLS.indexOf(skill), 1);
    clearCombatPowerCache();
  }
});
void test('2B save writes ownership but strips ephemeral combat modifiers without mutating the live hero', () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    },
  });
  try {
    const hero = freshHero();
    hero.skillPoints = 2;
    hero.level = 15;
    assert(learnSkill(hero, ALL_SKILLS[0].id));
    addTemporaryModifier(
      hero,
      { id: 'transient', stats: { flat: { physicalAttack: 20 } } },
      2,
    );
    hero.combatStateModifiers = [{ id: 'stack', action: { damagePercent: 5 } }];
    hero.manualGuardActive=true;
    saveCharacter(hero, true);
    const saved = JSON.parse(memory.get(SAVE_KEY)!).characters[hero.slotId];
    assert.equal(saved.temporaryModifiers, undefined);
    assert.equal(saved.combatStateModifiers, undefined);
    assert.equal(saved.manualGuardActive,undefined);
    assert.equal(hero.manualGuardActive,true);
    const loaded = parseSave(JSON.stringify(saved))!;
    assert.deepEqual(rankSource(loaded, 'active', ALL_SKILLS[0].id), {
      granted: 1,
      paid: 1,
    });
    assert.equal(hero.temporaryModifiers?.length, 1);
    assert.equal(hero.combatStateModifiers.length, 1);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
void test('2B progression: explicit legacy/test caps, original XP formula, incremental rewards and locked jobs', () => {
  const legacy = freshHero(),
    v2 = createV2TestHero();
  gainXP(legacy, 9999999);
  gainXP(v2, 9999999);
  assert.equal(legacy.level, 50);
  assert.equal(v2.level, 80);
  assert.equal(legacy.skillPoints, 49);
  assert.equal(v2.skillPoints, 79);
  assert.equal(v2.statPoints, 158);
  gainXP(v2, 9999999);
  assert.equal(v2.level, 80);
  assert.equal(v2.skillPoints, 79);
  assert.equal(ABSOLUTE_MAX_LEVEL, 100);
  assert.equal(xpNeeded(79), 90 + 79 * 40);
  assert.equal(progressionRules(v2).coreLevel, 15);
  assert.equal(progressionRules(v2).specializationLevel, 60);
  assert(Object.values(JOB_V2_REGISTRY).every((j) => !j.playable));
  unequipItem(v2, 'mainHand');
  assert.equal(chooseCoreJob(v2, 'warrior'), false);
  assert.equal(chooseSpecialization(v2, 'gatotkaca'), false);
  for (const [hero, expected] of [
    [legacy, 50],
    [v2, 80],
  ] as const) {
    const saved = JSON.parse(JSON.stringify(hero));
    saved.level = 100;
    const loaded = parseSave(JSON.stringify(saved))!;
    assert.equal(loaded.level, expected);
  }
  const loaded = parseSave(JSON.stringify(v2))!;
  assert.equal(loaded.progressionArchitecture, 'v2_test');
  assert.equal(loaded.statPoints, 158);
  v2.gold = 500;
  v2.allocatedStats.str = 20;
  v2.statPoints -= 20;
  assert.equal(resetCharacterStats(v2).hero.statPoints, 158);
});
void test('CFV3-1 legacy promotion uses level 15/25 and records genuine grants', () => {
  const hero = freshHero();
  unequipItem(hero, 'mainHand');
  hero.level = 14;
  assert(!chooseCoreJob(hero, 'warrior'));
  hero.level = 15;
  assert(chooseCoreJob(hero, 'warrior'));
  hero.level = 24;
  assert(!chooseSpecialization(hero, 'gatotkaca'));
  hero.level = 25;
  assert(chooseSpecialization(hero, 'gatotkaca'));
  assert.equal(rankSource(hero, 'active', 'gatotkaca-1').granted, 1);
  assert.equal(refundableSkillPoints(hero), 0);
});
void test('2B paid Rank 1 after promotion is refundable, GOLD required, and reset is atomic', () => {
  const hero = freshHero();
  gainXP(hero, 999999);
  unequipItem(hero, 'mainHand');
  chooseCoreJob(hero, 'warrior');
  const before = hero.skillPoints;
  assert(learnSkill(hero, 'warrior-breaker'));
  assert.equal(rankSource(hero, 'active', 'warrior-breaker').paid, 1);
  assert.equal(refundableSkillPoints(hero), 1);
  assert(!resetSkillPoints(hero).ok);
  hero.gold = 500;
  const original = JSON.stringify(hero),
    reset = resetSkillPoints(hero);
  assert(reset.ok);
  assert.equal(JSON.stringify(hero), original);
  assert.equal(reset.hero.skillPoints, before);
  assert.equal(reset.hero.skillLevels['warrior-breaker'], 0);
  assert.equal(refundableSkillPoints(reset.hero), 0);
});
void test('2B one granted plus two paid refunds exactly two; promotion does not lose paid points', () => {
  const hero = freshHero();
  hero.level = 15;
  hero.skillPoints = 10;
  hero.gold = 500;
  const id = ALL_SKILLS[0].id;
  learnSkill(hero, id);
  learnSkill(hero, id);
  assert.deepEqual(rankSource(hero, 'active', id), { granted: 1, paid: 2 });
  assert.equal(resetSkillPoints(hero).returnedPoints, 2);
  unequipItem(hero, 'mainHand');
  assert(chooseCoreJob(hero, 'warrior'));
  assert.equal(hero.skillPoints, 10);
  grantRank(hero, 'active', 'warrior-breaker', 1);
  assert.equal(refundableSkillPoints(hero), 0);
  assert(learnSkill(hero, 'warrior-breaker'));
  assert.equal(refundableSkillPoints(hero), 1);
  assert.equal(
    rankSource(parseSave(JSON.stringify(hero))!, 'active', 'warrior-breaker')
      .paid,
    1,
  );
});
void test('2B ambiguous old save conservatively retains/refunds ranks once, including unknown future data', () => {
  const raw = JSON.parse(JSON.stringify(freshHero()));
  delete raw.rankOwnership;
  raw.skillLevels['future-unknown'] = 2;
  raw.skillLevels[ALL_SKILLS[0].id] = 3;
  raw.gold = 1000;
  const loaded = parseSave(JSON.stringify(raw))!;
  assert.equal(rankSource(loaded, 'active', ALL_SKILLS[0].id).paid, 3);
  assert.equal(
    rankSource(loaded, 'active', ALL_SKILLS[0].id).legacyUncertain,
    true,
  );
  const reset = resetSkillPoints(loaded);
  assert(reset.ok);
  assert.equal(reset.hero.skillLevels['future-unknown'], 2);
  const reloaded = parseSave(JSON.stringify(reset.hero))!;
  assert.equal(refundableSkillPoints(reloaded), 0);
});
void test('2B scoped investment and passive ranked AND prerequisites are generic and ignore free/self/other-version ranks', () => {
  const hero = createV2TestHero();
  hero.level = 80;
  hero.skillPoints = 79;
  hero.gold = 1000;
  const tree = { id: 'test-tree', architecture: 'v2' as const };
  const nodes: PassiveDefinition[] = Array.from({ length: 5 }, (_, i) => ({
    id: `test-2b-node-${i}`,
    name: 'Fixture',
    description: 'Test only',
    specialization: null,
    job: 'adventurer',
    tier: 'adventurer',
    unlockLevel: 1,
    maxLevel: 5,
    tree,
  }));
  const target: PassiveDefinition = {
    ...nodes[0],
    id: 'test-2b-investment',
    investmentRequirement: { tree, paidRanks: 25 },
    prerequisites: [
      { skillId: nodes[0].id, requiredRank: 3 },
      { skillId: nodes[1].id, requiredRank: 2 },
    ],
  };
  ALL_PASSIVES.push(...nodes, target);
  try {
    assert(!canLearnSkill(target.id, hero).ok);
    for (const node of nodes)
      for (let i = 0; i < 5; i++) assert(learnPassive(hero, node.id));
    assert.equal(paidTreeInvestment(hero, tree, [...nodes, ...nodes]), 25);
    assert(canLearnSkill(target.id, hero).ok);
    assert(learnPassive(hero, target.id));
    assert.equal(
      paidTreeInvestment(hero, tree, [...nodes, target], target.id),
      25,
    );
    assert.equal(
      paidTreeInvestment(hero, { ...tree, architecture: 'legacy' }, nodes),
      0,
    );
    const reset = resetSkillPoints(hero);
    assert(reset.ok);
    assert.equal(paidTreeInvestment(reset.hero, tree, nodes), 0);
    grantRank(reset.hero, 'passive', nodes[0].id, 5);
    assert.equal(paidTreeInvestment(reset.hero, tree, nodes), 0);
  } finally {
    ALL_PASSIVES.splice(ALL_PASSIVES.length - nodes.length - 1);
  }
});
void test('2B temporary flat/percentage stats are real, expire and keep low-HP evaluation nonrecursive', () => {
  const hero = freshHero(),
    before = derivedStats(hero);
  addTemporaryModifier(
    hero,
    {
      id: 'test-stats',
      stats: { flat: { physicalAttack: 10 }, percent: { physicalAttack: 20 } },
    },
    2,
  );
  near(derivedStats(hero).physicalAttack, (before.physicalAttack + 10) * 1.2);
  tickTemporaryModifiers(hero, 2);
  assert.deepEqual(derivedStats(hero), before);
  addTemporaryModifier(
    hero,
    {
      id: 'test-adrenaline',
      condition: { hpAtOrBelow: 0.5 },
      stats: { flat: { damageReduction: 10 } },
    },
    5,
  );
  hero.hp = before.maxHP;
  assert.equal(derivedStats(hero).damageReduction, before.damageReduction);
  hero.hp = before.maxHP * 0.5;
  assert.equal(derivedStats(hero).damageReduction, before.damageReduction + 10);
});
void test('2B actual greatsword/dual weapon swaps select modifiers without globally baking stats', () => {
  const hero = freshHero();
  hero.level = 50;
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  unequipItem(hero, 'mainHand');
  const great = createItem('jayantara-two-hand-sword'),
    one = createItem('field-meteorfall-citadel-sword'),
    off = createItem('field-meteorfall-citadel-sword');
  hero.inventory.push(great, one, off);
  assert(equipItem(hero, great.id, 'mainHand').ok);
  const base = derivedStats(hero).accuracy;
  addTemporaryModifier(
    hero,
    {
      id: 'test-great',
      selector: { weaponStyles: ['greatsword'] },
      stats: { flat: { accuracy: 11 } },
    },
    10,
  );
  assert.equal(derivedStats(hero).accuracy, base + 11);
  unequipItem(hero, 'mainHand');
  equipItem(hero, one.id, 'mainHand');
  equipItem(hero, off.id, 'offHand');
  const without = derivedStats({ ...hero, temporaryModifiers: [] }).accuracy;
  assert.equal(derivedStats(hero).accuracy, without);
  addTemporaryModifier(
    hero,
    {
      id: 'test-twin',
      selector: { weaponStyles: ['dual_sword'] },
      stats: { flat: { accuracy: 7 } },
    },
    10,
  );
  assert.equal(derivedStats(hero).accuracy, without + 7);
  unequipItem(hero, 'offHand');
  assert.equal(
    derivedStats(hero).accuracy,
    derivedStats({ ...hero, temporaryModifiers: [] }).accuracy,
  );
});
void test('2B heavy, tree and target predicates modify copied hits, never registry or unrelated knockback', () => {
  const hero = freshHero();
  const skill = fixture({
    tree: { id: 'warrior', architecture: 'v2' },
    tags: ['heavy'],
    knockbackStrength: 2,
  });
  addTemporaryModifier(
    hero,
    {
      id: 'test-heavy',
      selector: { tags: ['heavy'] },
      action: { knockbackPercent: 50 },
    },
    10,
  );
  addTemporaryModifier(
    hero,
    {
      id: 'test-awakening',
      selector: { tree: { id: 'warrior', architecture: 'v2' } },
      action: { damagePercent: 20 },
    },
    10,
  );
  const original = JSON.stringify(skill),
    action = resolveHeroSkill(hero, skill, 1);
  assert.equal(action.hitSequence[0].knockbackStrength, 3);
  near(action.hitSequence[0].damageMultiplier, 1.2);
  const adventurer = resolveHeroSkill(
    hero,
    { ...skill, tree: { id: 'adventurer', architecture: 'v2' } },
    1,
  );
  near(adventurer.hitSequence[0].damageMultiplier, 1);
  assert.equal(JSON.stringify(skill), original);
  const conditional = fixture({
    modifiers: [
      {
        id: 'test-target',
        condition: { targetStatuses: ['armor_break'] },
        action: { damagePercent: 50 },
      },
    ],
  });
  const a = resolveHeroSkill(hero, conditional, 1),
    target = {};
  applyStatus(target, 'armor_break', 1);
  near(
    resolveTargetHit(a.hitSequence[0], a.targetModifiers, target)
      .damageMultiplier,
    1.5,
  );
  near(
    resolveTargetHit(a.hitSequence[0], a.targetModifiers, {}).damageMultiplier,
    1,
  );
});
void test('2B counter snapshots are immutable, non-consuming previews and consumable once', () => {
  const events = new DefenseEvents(),
    hero = freshHero();
  events.record(hero, true, 1000, 'source');
  const first = events.snapshot(['blocked', 'parried'], 1000, 1200);
  assert.equal(first.result, 'blocked');
  assert(Object.isFrozen(first));
  assert.equal(events.snapshot(['parried'], 1000, 1200).result, 'none');
  assert(events.consume('blocked', 1000, 1200));
  assert.equal(events.snapshot(['blocked'], 1000, 1200).result, 'none');
  assert.equal(first.result, 'blocked');
  applyStatus(hero, 'parry', 1);
  events.record(hero, false, 2000);
  assert.equal(events.snapshot(['parried'], 1000, 2100).result, 'parried');
  assert.equal(events.snapshot(['parried'], 1000, 4000).result, 'none');
});
void test('2B guard/anti-disruption reductions share strongest-wins group and never add accidental immunity', () => {
  const mods: CombatModifier[] = [
    {
      id: 'a',
      incoming: {
        damageMultiplier: 0.6,
        knockbackMultiplier: 0.4,
      },
    },
    { id: 'b', incoming: { damageMultiplier: 0.7 } },
  ];
  near(receivedMultiplier(mods, ctx, 'damageMultiplier', 0.3), 0.3);
  near(receivedMultiplier(mods, ctx, 'damageMultiplier'), 0.6);
  near(receivedMultiplier(mods, ctx, 'knockbackMultiplier'), 0.4);
  assert(
    receivedMultiplier(
      [{ id: 'bad', incoming: { damageMultiplier: 0 } }],
      ctx,
      'damageMultiplier',
    ) > 0,
  );
});
void test('2B transient stacks cap/expire, weapon gate and windows consume only next eligible cast', () => {
  const state = new TransientCombatState(),
    hero = freshHero();
  const support: CombatSupport = {
    stacks: [
      {
        id: 'test-stack',
        duration: 5,
        maxStacks: 3,
        weaponStyle: 'dual_sword',
        modifier: { id: 'stack-mod', action: { damagePercent: 10 } },
      },
    ],
    windows: [
      {
        id: 'test-window',
        duration: 3,
        tags: ['heavy'],
        weaponStyle: 'greatsword',
        modifier: { id: 'window-mod', action: { damagePercent: 20 } },
      },
    ],
  };
  state.successfulCast(1, 0, 'greatsword', support);
  assert.equal(state.stacks.size, 0);
  for (let i = 1; i <= 5; i++) {
    state.successfulCast(i, i, 'dual_sword', support);
    state.successfulCast(i, i, 'dual_sword', support);
  }
  assert.equal(state.stacks.get('test-stack')!.stackCount, 3);
  state.update(10, 'dual_sword', support);
  assert.equal(state.stacks.size, 0);
  const action = {
    ...resolveHeroSkill(hero, fixture({ tags: ['heavy'] }), 1),
    resolvedWeaponStyle: 'greatsword' as const,
  };
  assert.equal(state.windowModifiers(action, support, 0).length, 0);
  state.commitWindows(action, support, 0);
  assert.equal(state.windowModifiers(action, support, 1).length, 1);
  assert.equal(state.windowModifiers(action, support, 1).length, 1);
  state.commitWindows(action, support, 1);
  assert.equal(state.windowModifiers(action, support, 1).length, 0);
});
void test('2B CP cache responds to conditional HP, temporary toggles and stack payload without invented uptime', () => {
  clearCombatPowerCache();
  const hero = freshHero();
  hero.hp = derivedStats(hero).maxHP;
  addTemporaryModifier(
    hero,
    {
      id: 'test-lowhp',
      condition: { hpAtOrBelow: 0.5 },
      stats: { flat: { physicalDefense: 50 } },
    },
    4,
  );
  const healthy = getCombatPower(hero);
  hero.hp = 1;
  const low = getCombatPower(hero);
  assert(low.defensivePower > healthy.defensivePower);
  assert(
    buildCombatPowerProfile(hero).unsupportedEffects.some((e) =>
      e.includes('test-lowhp'),
    ),
  );
  tickTemporaryModifiers(hero, 4);
  assert.notEqual(getCombatPower(hero).total, low.total);
  hero.combatStateModifiers = [
    { id: 'stack', stats: { flat: { physicalAttack: 20 } } },
  ];
  const one = getCombatPower(hero);
  hero.combatStateModifiers[0].stats!.flat!.physicalAttack = 40;
  assert(getCombatPower(hero).offensivePower > one.offensivePower);
});
