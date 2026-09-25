import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THIEF_V2_ACTIVE as skills,
  THIEF_V2_PASSIVES as passives,
  THIEF_TREE,
} from './thief-v2.ts';
import { ALL_SKILLS, ALL_PASSIVES as _ALL_PASSIVES } from './skills.ts';
import {
  createV2CoreFoundationHero,
  createV2TestHero,
  authorizeV2Thief,
  chooseV2CoreJob,
  derivedStats,
  resolveHeroSkill,
  learnSkill,
  learnPassive,
  canLearnSkill,
  resetSkillPoints,
  parseSave,
  activeSkills,
} from './rules.ts';
import { createItem } from './items.ts';
import { rankSource, paidTreeInvestment } from './rank-ownership.ts';
import { skillHitDamage, SkillHitQueue } from './skill-action.ts';
import { PersonalMarks, markedBySelf, personalMark } from './personal-mark.ts';
import { directionalVector, moveDirectional } from './directional-movement.ts';
import {
  resolveTargetHit,
  addTemporaryModifier,
  tickTemporaryModifiers,
} from './combat-modifiers.ts';
import { forwardFromYaw } from './combat-position.ts';
import { criticalChance } from './combat-mechanics.ts';
import { getJobSkillNodes } from './character-view.ts';
import { assignPrimaryHotbarSlot } from './hotbar.ts';
import { buildCombatPowerProfile, getCombatPower } from './combat-power.ts';
const id = (s: string) => `v2-thief-${s}`;
const skill = (s: string) => skills.find((x) => x.id === id(s))!;
const near = (a: number, b: number) =>
  assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function hero() {
  const h = createV2CoreFoundationHero('thief', 59);
  h.skillPoints = 200;
  h.inventory = [];
  h.equipment.mainHand = h.equipment.offHand = null;
  for (const hand of ['mainHand', 'offHand'] as const) {
    const d = {
      ...createItem('field-verdant-plains-dagger', { id: hand }),
      allowedJobs: [],
      requiredCoreJob: null,
    };
    h.inventory.push(d);
    h.equipment[hand] = d.id;
  }
  return h;
}
const source = { sourceActorId: 'A', sourceGeneration: 1 };
const target = { marked: false };
const rear = {
  attackerPosition: { x: 0, z: 2 },
  targetPosition: { x: 0, z: 0 },
  targetForward: forwardFromYaw(0),
};

await test('4C FINAL melee range is exactly 3.5m at every rank; Mark and Lunge keep explicit ranges', () => {
  const h = hero();
  for (const slug of ['quick-stab', 'twin-fang', 'crippling-cut', 'venom-edge', 'marked-strike', 'blade-flurry', 'silent-opening', 'rear-rend', 'weakpoint-assault']) {
    const definition = skill(slug);
    assert.equal(definition.range, 3.5, slug);
    for (let rank = 1; rank <= definition.maxLevel; rank++) {
      assert.equal(resolveHeroSkill(h, definition, rank).range, 3.5, `${slug} R${rank}`);
      assert.equal(definition.rankValues?.[rank - 1]?.range, undefined, 'no per-rank melee range scaling');
    }
  }
  for (let rank = 1; rank <= 5; rank++) {
    assert.equal(resolveHeroSkill(h, skill('mark-prey'), rank).range, 8);
    assert.equal(resolveHeroSkill(h, skill('shadow-lunge'), rank).range, [6.5, 6.75, 7, 7.5, 8][rank - 1]);
  }
});

await test('4C registry: exact 16+14, 140 total/139 paid, development root grant idempotent and public locked', () => {
  assert.equal(skills.length, 16);
  assert.equal(passives.length, 14);
  assert.equal(
    [...skills, ...passives].reduce((s, n) => s + n.maxLevel, 0),
    140,
  );
  assert.equal(new Set([...skills, ...passives].map((n) => n.id)).size, 30);
  const h = hero();
  assert.deepEqual(rankSource(h, 'active', id('quick-stab')), {
    granted: 1,
    paid: 0,
  });
  assert(authorizeV2Thief(h));
  assert.equal(paidTreeInvestment(h, THIEF_TREE, [...skills, ...passives]), 0);
  assert(
    !chooseV2CoreJob(
      Object.assign(createV2TestHero(), { level: 15 }),
      'thief' as never,
    ),
  );
  assert(
    activeSkills(h).every((s) => s.job === 'adventurer' || s.job === 'thief'),
  );
  assert.equal(getJobSkillNodes(h, 'core').active.length, 16);
  assert.equal(getJobSkillNodes(h, 'core').passive.length, 14);
  assert.equal(parseSave(JSON.stringify(h))!.coreJob, 'thief');
});

await test('4C every active: exact locks, rank ceilings, physical/zero INT and skill-power coefficients; target-free actions distinct', () => {
  const locks = [
    0.22, 0.3, 0.2, 0.3, 0.42, 0.35, 0.35, 0.25, 0.45, 0.32, 0.68, 0.45, 0.5,
    0.3, 0.65, 0.4,
  ];
  const levels = [
    15, 17, 19, 21, 23, 25, 28, 31, 34, 37, 40, 43, 46, 49, 54, 59,
  ];
  const h = hero(),
    stats = derivedStats(h);
  skills.forEach((s, i) => {
    assert.equal(s.unlockLevel, levels[i]);
    assert.equal(s.maxLevel, i >= 14 ? 3 : 5);
    assert.equal(s.actionLockDuration, locks[i]);
    for (let r = 1; r <= s.maxLevel; r++) {
      const a = resolveHeroSkill(h, s, r, stats);
      assert.equal(a.rank, r);
      assert.equal(a.damageType, 'physical');
      assert(
        a.hitSequence.every(
          (h) =>
            h.magicCoefficient === 0 &&
            h.skillPowerCoefficient === 0 &&
            h.knockbackStrength === 0,
        ),
      );
      assert.equal(
        a.movementAllowedDuringLock,
        ['mark-prey', 'smoke-veil', 'evasive-feint', 'instinct'].some(
          (x) => s.id === id(x),
        ),
      );
    }
  });
});

const damageContract: Record<string, number[][]> = {
  'quick-stab': [
    [14, 0.95, 3, 5, 3],
    [18, 1, 3, 5, 3],
    [22, 1.05, 4, 5, 2.9],
    [26, 1.1, 4, 5, 2.9],
    [30, 1.15, 5, 5, 2.8],
  ],
  'crippling-cut': [
    [18, 1.05, 4, 10, 7],
    [22, 1.1, 4, 10, 6.9],
    [26, 1.15, 5, 10, 6.8],
    [30, 1.22, 5, 10, 6.6],
    [34, 1.3, 6, 10, 6.5],
  ],
  'venom-edge': [
    [18, 1.1, 0, 11, 8],
    [22, 1.16, 0, 11, 7.8],
    [26, 1.22, 0, 11, 7.5],
    [30, 1.28, 0, 11, 7.2],
    [34, 1.35, 0, 11, 7],
  ],
  'shadow-lunge': [
    [16, 0.85, 4, 11, 7.5],
    [19, 0.9, 4, 11, 7.3],
    [22, 0.95, 5, 11, 7],
    [25, 1, 5, 11, 6.8],
    [28, 1.05, 6, 11, 6.5],
  ],
  'marked-strike': [
    [20, 1.1, 0, 10, 6],
    [24, 1.16, 0, 10, 5.9],
    [28, 1.22, 0, 10, 5.8],
    [32, 1.28, 0, 10, 5.6],
    [36, 1.35, 0, 10, 5.5],
  ],
  'silent-opening': [
    [22, 1.2, 0, 14, 10],
    [26, 1.27, 0, 14, 9.8],
    [30, 1.34, 0, 14, 9.5],
    [34, 1.42, 0, 14, 9.2],
    [38, 1.5, 0, 14, 9],
  ],
  'rear-rend': [
    [24, 1.25, 7, 13, 8.5],
    [28, 1.32, 8, 13, 8.3],
    [32, 1.4, 8, 13, 8],
    [36, 1.47, 9, 13, 7.8],
    [40, 1.55, 10, 13, 7.5],
  ],
  'weakpoint-assault': [
    [32, 1.85, 10, 22, 16],
    [40, 2.05, 12, 22, 15],
    [48, 2.25, 14, 22, 14],
  ],
};
await test('4C independent golden damage tables: every rank, no legacy +12% double scaling', () => {
  const h = hero();
  for (const [slug, rows] of Object.entries(damageContract))
    rows.forEach(([base, c, _legacyValue, mp, cd], i) => {
      const a = resolveHeroSkill(h, skill(slug), i + 1);
      assert.deepEqual(
        [
          a.baseDamage,
          a.physicalCoefficient,
          a.manaCost,
          a.cooldown,
        ],
        [base, c, mp, cd],
      );
      near(
        skillHitDamage(a.hitSequence[0], {
          physicalAttack: 200,
          magicAttack: 999,
          skillPower: 999,
        }),
        base + 200 * c,
      );
    });
});
await test('4C Rank1 deterministic 200 attack raw totals, local payoff group Mark+Rear adds not multiplies', () => {
  const h = hero(),
    stats = { ...derivedStats(h), physicalAttack: 200 },
    marks = new PersonalMarks();
  const expected: Record<string, number> = {
    'quick-stab': 204,
    'crippling-cut': 228,
    'venom-edge': 238,
    'shadow-lunge': 186,
    'marked-strike': 240,
    'twin-fang': 262,
    'blade-flurry': 325,
    'silent-opening': 262,
    'rear-rend': 274,
    'weakpoint-assault': 402,
  };
  for (const [slug, n] of Object.entries(expected)) {
    const a = resolveHeroSkill(h, skill(slug), 1, stats);
    near(
      a.hitSequence.reduce((s, hit) => s + skillHitDamage(hit, stats), 0),
      n,
    );
  }
  marks.apply(target, source, 'mark', 10);
  for (const rank of [1, 2, 3]) {
    const a = resolveHeroSkill(h, skill('weakpoint-assault'), rank, stats),
      hit = a.hitSequence[0];
    for (const [marked, rearward] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]) {
      if (marked) marks.apply(target, source, 'mark', 10);
      else marks.clear();
      const resolved = resolveTargetHit(hit, a.targetModifiers, target, 0, {
        source,
        position: {
          ...rear,
          targetForward: forwardFromYaw(rearward ? 0 : Math.PI),
        },
      });
      near(
        skillHitDamage(resolved, stats),
        skillHitDamage(hit, stats) *
          (1 +
            ([8, 12, 16][rank - 1] * (Number(marked) + Number(rearward))) /
              100),
      );
    }
  }
  marks.clear();
});
await test('4C personal mark: source/generation isolation, refresh/move, independent actors, expiry/death/cleanup, no persistence', () => {
  const marks = new PersonalMarks(),
    a = {},
    b = {},
    other = { sourceActorId: 'B', sourceGeneration: 1 };
  let alive = true;
  marks.apply(a, source, 'mark', 10, () => alive);
  assert(markedBySelf(a, source));
  assert(!markedBySelf(a, other));
  assert(!markedBySelf(a, { ...source, sourceGeneration: 2 }));
  marks.apply(a, other, 'mark', 7);
  marks.apply(b, source, 'mark', 8);
  assert(!markedBySelf(a, source));
  assert(markedBySelf(a, other));
  assert(markedBySelf(b, source));
  marks.update(3);
  near(personalMark(b, source)!.remaining, 5);
  marks.apply(b, source, 'mark', 8);
  near(personalMark(b, source)!.remaining, 8);
  assert.equal(JSON.stringify(b), '{}');
  marks.update(8);
  assert(!markedBySelf(b, source));
  assert(!markedBySelf(a, other));
  marks.apply(a, source, 'mark', 5, () => alive);
  alive = false;
  assert(!markedBySelf(a, source));
  marks.update(0);
  marks.clear();
});
await test('4C movement vector: normalized input/facing/backward and collision callback substeps, no facing mutation', () => {
  const face = { x: 0, z: -1 };
  assert.deepEqual(directionalVector('input', face, { x: 1, z: 0 }), {
    x: 1,
    z: 0,
  });
  assert.deepEqual(directionalVector('input', face, { x: 0, z: 0 }), face);
  const back = directionalVector('backward', face, { x: 1, z: 0 });
  near(back.x, 0);
  near(back.z, 1);
  let x = 0,
    calls = 0;
  moveDirectional(4.5, { x: 1, z: 0 }, (dx) => {
    calls++;
    x = Math.min(2, x + dx);
  });
  near(x, 2);
  assert.equal(calls, 18);
  assert.deepEqual(face, { x: 0, z: -1 });
});
await test('4C passive selectors: exact durations, movement, damage/crit scopes, no basic/Adventurer leakage', () => {
  const h = hero();
  for (const p of passives) h.passiveLevels[p.id] = p.maxLevel;
  near(resolveHeroSkill(h, skill('smoke-veil'), 5).duration, 6.875);
  near(resolveHeroSkill(h, skill('mark-prey'), 5).duration, 16.5);
  near(resolveHeroSkill(h, skill('slipstep'), 5).movementDistance!, 5.25);
  near(resolveHeroSkill(h, skill('disengage'), 5).movementDistance!, 5.75);
  near(resolveHeroSkill(h, skill('shadow-lunge'), 5).range, 8);
  const venom = resolveHeroSkill(h, skill('venom-edge'), 5);
  near(venom.hitSequence[0].statuses[0].duration, 8);
  const quick = resolveHeroSkill(h, skill('quick-stab'), 1),
    flurry = resolveHeroSkill(h, skill('blade-flurry'), 1),
    stats = derivedStats(h);
  near(quick.hitSequence[0].damageMultiplier, 1.025);
  near(flurry.hitSequence[0].damageMultiplier, 1.1);
  near(flurry.hitSequence[0].criticalDamage, stats.criticalDamage + 15);
  near(quick.hitSequence[0].criticalDamage, stats.criticalDamage);
  h.equipment.offHand = null;
  const single = resolveHeroSkill(h, skill('quick-stab'), 1);
  near(single.hitSequence[0].damageMultiplier, 1);
  assert(
    !resolveHeroSkill(
      h,
      ALL_SKILLS.find((s) => s.id === 'fajar-strike')!,
    ).targetModifiers.some((m) => m.id.startsWith('v2-thief')),
  );
});
await test('4C Rear Awareness / Opportunist only explicit tags and source-owned mark; rear remains impact-time', () => {
  const h = hero();
  h.passiveLevels[id('rear-awareness')] = 5;
  h.passiveLevels[id('opportunist')] = 5;
  const marks = new PersonalMarks();
  marks.apply(target, source, 'mark', 10);
  for (const s of skills.filter((s) => s.tags?.includes('physical'))) {
    const a = resolveHeroSkill(h, s, 1),
      base = a.hitSequence[0];
    const result = resolveTargetHit(base, a.targetModifiers, target, 0, {
      source,
      position: rear,
    });
    const normal = resolveTargetHit(
      base,
      a.targetModifiers,
      { marked: false },
      0,
      { source, position: { ...rear, targetForward: forwardFromYaw(Math.PI) } },
    );
    if (!s.tags?.includes('mark_synergy') && !s.tags?.includes('rear_synergy'))
      near(result.criticalRate, normal.criticalRate);
  }
  const a = resolveHeroSkill(h, skill('rear-rend'), 1),
    front = { ...rear, targetForward: forwardFromYaw(Math.PI) };
  near(
    resolveTargetHit(a.hitSequence[0], a.targetModifiers, target, 0, {
      source,
      position: front,
    }).damageMultiplier,
    1,
  );
  near(
    resolveTargetHit(a.hitSequence[0], a.targetModifiers, target, 0, {
      source,
      position: rear,
    }).damageMultiplier,
    1.12,
  );
  marks.clear();
});
await test('4C multi-hit every rank: exact time/coefficients and independent queue lifecycle, no ASPD rewrite', () => {
  const h = hero();
  for (let r = 1; r <= 5; r++)
    for (const [slug, delays] of [
      ['twin-fang', [0, 0.2]],
      ['blade-flurry', [0, 0.16, 0.38]],
    ] as const) {
      const a = resolveHeroSkill(h, skill(slug), r);
      assert.deepEqual(
        a.hitSequence.map((h) => h.delay),
        delays,
      );
      assert(a.hitSequence.every((h) => h.canCrit));
      const faster = resolveHeroSkill(h, skill(slug), r, {
        ...derivedStats(h),
        attackSpeed: 999,
      });
      assert.deepEqual(
        faster.hitSequence.map((h) => h.delay),
        delays,
      );
      const q = new SkillHitQueue(),
        hits: number[] = [];
      let alive = true;
      q.schedule(
        a.hitSequence,
        () => alive,
        (h) => hits.push(h.delay),
      );
      q.update(0.2);
      alive = false;
      q.update(1);
      assert(hits.length <= 2);
    }
});
await test('4C exact mana rotations 81/47; Instinct ranks apply only future Thief actions and expire', () => {
  const h = hero(),
    sum = (slugs: string[]) =>
      slugs.reduce((n, s) => n + resolveHeroSkill(h, skill(s), 1).manaCost, 0);
  assert.equal(
    sum([
      'mark-prey',
      'smoke-veil',
      'silent-opening',
      'marked-strike',
      'blade-flurry',
      'weakpoint-assault',
    ]),
    81,
  );
  assert.equal(
    sum([
      'quick-stab',
      'twin-fang',
      'mark-prey',
      'marked-strike',
      'blade-flurry',
    ]),
    47,
  );
  for (let rank = 1; rank <= 3; rank++) {
    h.temporaryModifiers = [];
    const before = resolveHeroSkill(h, skill('blade-flurry'), 1),
      buff = resolveHeroSkill(h, skill('instinct'), rank);
    for (const b of buff.temporaryBuffs!)
      addTemporaryModifier(h, b.modifier, b.duration);
    const after = resolveHeroSkill(h, skill('blade-flurry'), 1);
    near(
      after.hitSequence[0].criticalRate - before.hitSequence[0].criticalRate,
      [5, 7, 10][rank - 1],
    );
    near(
      after.hitSequence[0].criticalDamage -
        before.hitSequence[0].criticalDamage,
      [10, 15, 20][rank - 1],
    );
    assert.equal(after.manaCost, rank === 3 ? 14 : 15);
    near(before.hitSequence[0].criticalRate, derivedStats(h).criticalRate);
    const adventurer = resolveHeroSkill(
      h,
      ALL_SKILLS.find((s) => s.id === 'fajar-strike')!,
    );
    near(adventurer.hitSequence[0].criticalRate, derivedStats(h).criticalRate);
    tickTemporaryModifiers(h, buff.duration);
    assert.equal(resolveHeroSkill(h, skill('blade-flurry'), 1).manaCost, 15);
  }
});
await test('4C prerequisites use paid ownership; 25 gate, reset refund/root/clean transient and legal hotbar', () => {
  const h = hero();
  assert(!canLearnSkill(id('instinct'), h).ok);
  assert(!learnSkill(h, id('blade-flurry')));
  const acquire = (s: string, rank: number) => {
    const node = [...skills, ...passives].find((n) => n.id === id(s))!;
    for (const pre of node.prerequisites ?? [])
      acquire(pre.skillId.replace('v2-thief-', ''), pre.requiredRank ?? 1);
    const active = skills.includes(node as never);
    while (((active ? h.skillLevels : h.passiveLevels)[node.id] ?? 0) < rank)
      assert(active ? learnSkill(h, node.id) : learnPassive(h, node.id));
  };
  for (const s of [
    'quick-stab',
    'slipstep',
    'mark-prey',
    'agile-conditioning',
    'dagger-discipline',
  ])
    acquire(s, 5);
  assert.equal(paidTreeInvestment(h, THIEF_TREE, [...skills, ...passives]), 24);
  assert(!canLearnSkill(id('instinct'), h).ok);
  acquire('keen-instinct', 1);
  assert(canLearnSkill(id('instinct'), h).ok);
  h.level = 58;
  assert(!canLearnSkill(id('instinct'), h).ok);
  h.level = 59;
  assert(learnSkill(h, id('instinct')));
  assert(assignPrimaryHotbarSlot(h, 0, id('quick-stab')).ok);
  assert(!assignPrimaryHotbarSlot(h, 0, id('keen-instinct')).ok);
  h.gold = 499;
  assert(!resetSkillPoints(h).ok);
  h.gold = 1000;
  h.statusEffects.stealth = 3;
  h.activeBuffs[id('instinct')] = 10;
  const before = h.skillPoints,
    reset = resetSkillPoints(h);
  assert(reset.ok);
  assert.equal(reset.hero.gold, 500);
  assert.equal(reset.hero.skillPoints, before + 26);
  assert.equal(reset.hero.skillLevels[id('quick-stab')], 1);
  assert.equal(reset.hero.skillLevels[id('instinct')], 0);
  assert(!reset.hero.statusEffects.stealth);
  assert(!(reset.hero.activeBuffs as Record<string, number>)[id('instinct')]);
});
await test('4C CP uses resolved hits and poison duration, no fictitious Mark hit/positional bonus; INT independent', () => {
  const h = hero();
  for (const s of skills) h.skillLevels[s.id] = s.maxLevel;
  const profile = buildCombatPowerProfile(h);
  assert.deepEqual(
    profile.actions.find((a) => a.id === id('mark-prey'))!.hits,
    [],
  );
  assert.equal(
    profile.actions.find((a) => a.id === id('venom-edge'))!.poisonDuration,
    6,
  );
  assert(Number.isFinite(getCombatPower(h).totalCombatPower));
  const before = resolveHeroSkill(h, skill('quick-stab'), 1),
    stats = derivedStats(h);
  h.allocatedStats.int += 100;
  const after = resolveHeroSkill(h, skill('quick-stab'), 1);
  near(
    skillHitDamage(before.hitSequence[0], stats),
    skillHitDamage(after.hitSequence[0], derivedStats(h)),
  );
});

await test('4C Evasive Instinct threshold uses final unconditional Max HP including Agile Conditioning', () => {
  const h = hero();
  h.passiveLevels[id('agile-conditioning')] = 5;
  h.hp = 99999;
  const normal = derivedStats(h);
  h.passiveLevels[id('evasive-instinct')] = 3;
  h.hp = normal.maxHP * 0.35;
  near(derivedStats(h).evasion, normal.evasion + 12);
  h.hp = normal.maxHP * 0.35 + 0.01;
  near(derivedStats(h).evasion, normal.evasion);
});

await test('4C exact full prerequisite graph, no hidden rank dependencies', () => {
  const expected: Record<string, Array<[string, number]>> = {
    slipstep: [['quick-stab', 1]],
    'mark-prey': [['quick-stab', 2]],
    'smoke-veil': [['slipstep', 2]],
    'twin-fang': [['quick-stab', 2]],
    'crippling-cut': [['mark-prey', 1]],
    'venom-edge': [['twin-fang', 2]],
    'evasive-feint': [['slipstep', 2]],
    'shadow-lunge': [
      ['slipstep', 3],
      ['mark-prey', 1],
    ],
    'marked-strike': [['mark-prey', 3]],
    'blade-flurry': [['twin-fang', 3]],
    'silent-opening': [['smoke-veil', 3]],
    'rear-rend': [['crippling-cut', 3]],
    disengage: [
      ['slipstep', 3],
      ['fleet-footing', 2],
    ],
    'weakpoint-assault': [
      ['marked-strike', 3],
      ['rear-rend', 3],
    ],
    'shadow-discipline': [['smoke-veil', 1]],
    'dual-dagger-familiarity': [
      ['dagger-discipline', 2],
      ['twin-fang', 1],
    ],
    'mark-expertise': [['mark-prey', 1]],
    'fleet-footing': [['slipstep', 2]],
    venomcraft: [['venom-edge', 1]],
    'rear-awareness': [['crippling-cut', 2]],
    opportunist: [['mark-expertise', 2]],
    'twin-edge-control': [
      ['dual-dagger-familiarity', 3],
      ['blade-flurry', 2],
    ],
    'rapid-technique': [['blade-flurry', 1]],
    'evasive-instinct': [['evasive-feint', 3]],
    'silent-opportunity': [
      ['smoke-veil', 3],
      ['keen-instinct', 2],
    ],
  };
  for (const n of [...skills, ...passives])
    assert.deepEqual(
      (n.prerequisites ?? []).map((p) => [p.skillId, p.requiredRank]),
      (expected[n.id.replace('v2-thief-', '')] ?? []).map(([s, r]) => [
        id(s),
        r,
      ]),
      n.id,
    );
  assert.deepEqual(skill('instinct').investmentRequirement, {
    tree: THIEF_TREE,
    paidRanks: 25,
  });
});

await test('4C independent full multi-hit coefficient tables, not full cast coefficient per hit', () => {
  const contract = {
    'twin-fang': [
      [
        [4, 0.5],
        [8, 0.75],
      ],
      [
        [5, 0.54],
        [10, 0.79],
      ],
      [
        [6, 0.58],
        [12, 0.84],
      ],
      [
        [7, 0.62],
        [14, 0.89],
      ],
      [
        [8, 0.65],
        [16, 0.95],
      ],
    ],
    'blade-flurry': [
      [
        [3, 0.4],
        [4, 0.45],
        [8, 0.7],
      ],
      [
        [4, 0.42],
        [5, 0.49],
        [9, 0.74],
      ],
      [
        [5, 0.45],
        [6, 0.53],
        [10, 0.79],
      ],
      [
        [6, 0.48],
        [7, 0.56],
        [12, 0.84],
      ],
      [
        [7, 0.5],
        [8, 0.6],
        [14, 0.9],
      ],
    ],
  };
  const h = hero();
  for (const [slug, ranks] of Object.entries(contract))
    ranks.forEach((hits, i) =>
      assert.deepEqual(
        resolveHeroSkill(h, skill(slug), i + 1).hitSequence.map((h) => [
          h.baseDamage,
          h.physicalCoefficient,
        ]),
        hits,
      ),
    );
});

await test('4C legal Lv59 58-paid-SP / 174-stat-point crit diagnostic, actual combat cap retained', (t) => {
  const h = hero();
  h.skillPoints = 58;
  h.allocatedStats = { str: 90, vit: 24, dex: 60, int: 0 };
  h.statPoints = 0;
  const acquire = (slug: string, r: number): void => {
    const n = [...skills, ...passives].find((n) => n.id === id(slug))!;
    for (const p of n.prerequisites ?? [])
      acquire(p.skillId.replace('v2-thief-', ''), p.requiredRank ?? 1);
    const a = skills.some((s) => s.id === n.id);
    while (((a ? h.skillLevels : h.passiveLevels)[n.id] ?? 0) < r)
      assert(
        a ? learnSkill(h, n.id) : learnPassive(h, n.id),
        `illegal ${n.id}`,
      );
  };
  for (const [s, r] of [
    ['quick-stab', 2],
    ['slipstep', 3],
    ['mark-prey', 3],
    ['smoke-veil', 3],
    ['twin-fang', 1],
    ['dagger-discipline', 2],
    ['dual-dagger-familiarity', 5],
    ['keen-instinct', 5],
    ['mark-expertise', 2],
    ['opportunist', 5],
    ['crippling-cut', 3],
    ['rear-awareness', 5],
    ['silent-opening', 5],
    ['shadow-lunge', 1],
    ['marked-strike', 5],
    ['rear-rend', 3],
    ['silent-opportunity', 3],
    ['instinct', 3],
  ] as const)
    acquire(s, r);
  assert.equal(paidTreeInvestment(h, THIEF_TREE, [...skills, ...passives]), 58);
  assert.equal(h.skillPoints, 0);
  const stats = derivedStats(h),
    marks = new PersonalMarks();
  marks.apply(target, source, 'mark', 10);
  const actionCrit = (slug: string, stealth = false) => {
    const a = resolveHeroSkill(
      h,
      skill(slug),
      h.skillLevels[id(slug)],
      undefined,
      undefined,
      [],
      { attackerStealthed: stealth },
    );
    return resolveTargetHit(a.hitSequence[0], a.targetModifiers, target, 0, {
      source,
      position: rear,
    }).criticalRate;
  };
  const baseline = stats.criticalRate,
    normal = actionCrit('quick-stab'),
    mark = actionCrit('marked-strike'),
    rearCrit = actionCrit('rear-rend'),
    opener = actionCrit('silent-opening', true);
  for (const b of resolveHeroSkill(h, skill('instinct'), 3).temporaryBuffs!)
    addTemporaryModifier(h, b.modifier, b.duration);
  const empowered = actionCrit('silent-opening', true);
  near(normal - baseline, 2.5);
  near(mark - normal, 19);
  near(rearCrit - normal, 5);
  near(opener - normal, 24);
  near(empowered - opener, 10);
  assert(baseline < 80);
  assert.equal(criticalChance(999), 0.8);
  t.diagnostic(
    JSON.stringify({
      paidSP: 58,
      allocated: h.allocatedStats,
      permanentCrit: baseline,
      dualActionCrit: normal,
      markedStrikeCrit: mark,
      rearRendCrit: rearCrit,
      silentOpeningCrit: opener,
      instinctOpenerCrit: empowered,
      actualCappedPercent: criticalChance(empowered) * 100,
    }),
  );
  marks.clear();
});
