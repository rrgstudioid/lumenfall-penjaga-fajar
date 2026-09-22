import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  derivedStats,
  calculateFinalCharacterStats,
  resolveHeroSkill,
  skillDamagePreview,
  skillHealingPreview,
  equipItem,
  parseSave,
} from './rules.ts';
import {
  ALL_SKILLS,
  CORE_JOBS,
  SPECIALIZATIONS,
  skillCombatScaling,
  type SkillDefinition,
} from './skills.ts';
import { createItem } from './items.ts';
import { skillHitDamage } from './skill-action.ts';
import {
  calculateCombatPower,
  calculateCombatPowerFromStats,
  buildCombatPowerProfile,
} from './combat-power.ts';
import {
  JOB_V2_REGISTRY,
  getJobV2,
  resolveJobMetadata,
  resolveJobV2Lineage,
  type JobV2Identity,
} from './job-registry-v2.ts';

const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const action = (extra: Partial<SkillDefinition> = {}): SkillDefinition => ({
  ...ALL_SKILLS[0],
  progressionMode: 'rank_values',
  baseDamage: 0,
  physicalCoefficient: 0,
  magicCoefficient: 0,
  skillPowerCoefficient: 0,
  ...extra,
});

void test('1B SP: INT +100 preserves magic/MP/healing benefits but contributes zero Skill Power', () => {
  const a = freshHero(),
    b = structuredClone(a);
  b.allocatedStats.int += 100;
  const sa = derivedStats(a),
    sb = derivedStats(b);
  assert.equal(sa.skillPower, 0);
  assert.equal(sb.skillPower, sa.skillPower);
  near(sb.magicAttack - sa.magicAttack, 200);
  near(sb.magicDefense - sa.magicDefense, 50);
  near(sb.maxMana - sa.maxMana, 300);
  near(sb.healingPower - sa.healingPower, 25);
  assert.equal(calculateFinalCharacterStats, derivedStats);
  const heal = ALL_SKILLS.find((s) => s.effect === 'heal')!;
  assert(skillHealingPreview(b, heal) > skillHealingPreview(a, heal));
});
void test('1B SP: physical/magic/optional Skill Power are independent explicit damage channels', () => {
  const a = freshHero(),
    b = structuredClone(a);
  b.allocatedStats.int += 100;
  const physical = action({ physicalCoefficient: 1.2 }),
    magic = action({ damageType: 'magic', magicCoefficient: 1.2 }),
    sp = action({ skillPowerCoefficient: 2 });
  near(skillDamagePreview(a, physical, 1), skillDamagePreview(b, physical, 1));
  assert(skillDamagePreview(b, magic, 1) > skillDamagePreview(a, magic, 1));
  near(skillDamagePreview(a, sp, 1), skillDamagePreview(b, sp, 1));
  const item = createItem('arunika-ring1', {
    baseStats: { skillPower: 30 },
    bonusStats: {},
    uniqueStatsLocked: false,
    enhancementLevel: 0,
  });
  a.inventory.push(item);
  assert(equipItem(a, item.id, 'ring1').ok);
  assert.equal(derivedStats(a).skillPower, 30);
  near(skillDamagePreview(a, sp, 1) - skillDamagePreview(b, sp, 1), 60);
  near(skillDamagePreview(a, physical, 1), skillDamagePreview(b, physical, 1));
  const loaded = parseSave(JSON.stringify(a))!;
  assert(loaded);
  assert.equal(derivedStats(loaded).skillPower, 30);
  assert(Number.isFinite(calculateCombatPower(loaded).total));
});
void test('1B SP: existing explicit passive Skill Power survives independently of INT', () => {
  const hero = freshHero();
  hero.coreJob = 'wizard';
  hero.job = 'wizard';
  hero.level = 50;
  hero.passiveLevels['wizard-foundation'] = 2;
  assert.equal(derivedStats(hero).skillPower, 4);
  hero.allocatedStats.int += 100;
  assert.equal(derivedStats(hero).skillPower, 4);
});
void test('1B SP: all 64 legacy skills have zero SP scaling; old/new damage, heal and CP match', () => {
  assert.equal(ALL_SKILLS.filter(s=>s.tree?.architecture!=='v2').length, 64);
  const hero = freshHero();
  hero.level = 50;
  hero.allocatedStats.int = 100;
  const stats = derivedStats(hero),
    old = { ...stats, skillPower: stats.skillPower + 45 };
  for (const skill of ALL_SKILLS.filter(s=>s.tree?.architecture!=='v2')) {
    assert.equal(skillCombatScaling(skill).skillPower, 0, skill.id);
    assert.equal(skill.skillPowerCoefficient ?? 0, 0, skill.id);
    for (let rank = 0; rank <= skill.maxLevel; rank++) {
      const current = resolveHeroSkill(hero, skill, rank, stats),
        previous = resolveHeroSkill(hero, skill, rank, old);
      near(
        current.hitSequence.reduce((n, h) => n + skillHitDamage(h, stats), 0),
        previous.hitSequence.reduce((n, h) => n + skillHitDamage(h, old), 0),
      );
      if (skill.effect === 'heal') {
        const raw =
          Math.max(35, skill.baseDamage || 35) +
          stats.magicAttack * 0.25 +
          stats.healingPower * Math.max(0.1, skill.damageCoefficient || 0.65);
        assert.equal(
          skillHealingPreview(hero, skill, rank),
          Math.round(raw * (1 + (rank - 1) * 0.12)),
        );
      }
    }
  }
  for (const [id, spec] of Object.entries(SPECIALIZATIONS)) {
    hero.coreJob = spec.coreJob;
    hero.job = spec.coreJob;
    hero.specialization = id as typeof hero.specialization;
    for (const skill of ALL_SKILLS) hero.skillLevels[skill.id] = 3;
    const current = derivedStats(hero),
      previous = { ...current, skillPower: current.skillPower + 45 };
    assert.deepEqual(
      calculateCombatPowerFromStats(
        current,
        buildCombatPowerProfile(hero, current),
      ),
      calculateCombatPowerFromStats(
        previous,
        buildCombatPowerProfile(hero, previous),
      ),
    );
  }
});
const expectedBranches = [
  [
    'warrior',
    'Warrior',
    'berserker',
    'Berserker',
    'executioner',
    'Executioner',
    'blade_master',
    'Blade Master',
    'crimson_blade',
    'Crimson Blade',
  ],
  [
    'thief',
    'Thief',
    'rogue',
    'Rogue',
    'spectre',
    'Spectre',
    'assasin',
    'Assasin',
    'reaper',
    'Reaper',
  ],
  [
    'acolyte',
    'Acolyte',
    'luminary',
    'Luminary',
    'stellar',
    'Stellar',
    'sacred_fist',
    'Sacred Fist',
    'warmonk',
    'Warmonk',
  ],
  [
    'archer',
    'Archer',
    'ranger',
    'Ranger',
    'astral_ranger',
    'Astral Ranger',
    'marksman',
    'Marksman',
    'sniper',
    'Sniper',
  ],
  [
    'knight',
    'Knight',
    'vanguard',
    'Vanguard',
    'royal_guard',
    'Royal Guard',
    'phalanx',
    'Phalanx',
    'gladiator',
    'Gladiator',
  ],
  [
    'mage',
    'Mage',
    'summoner',
    'Summoner',
    'warlock',
    'Warlock',
    'sorcerer',
    'Sorcerer',
    'arcanist',
    'Arcanist',
  ],
  [
    'smith',
    'Smith',
    'blacksmith',
    'Blacksmith',
    'mastersmith',
    'Mastersmith',
    'specialist',
    'Specialist',
    'siege',
    'Siege',
  ],
];
void test('1B registry: all 36 exact canonical IDs/names/tiers/relations exist but no V2 job is playable', () => {
  assert.equal(Object.keys(JOB_V2_REGISTRY).length, 36);
  assert.equal(getJobV2('adventurer')?.name, 'Adventurer');
  for (const row of expectedBranches) {
    for (let i = 0; i < row.length; i += 2) {
      const job = getJobV2(row[i])!;
      assert(job);
      assert.equal(job.name, row[i + 1]);
      assert.equal(job.playable, false);
      assert.equal(job.tier, i === 0 ? 1 : i === 4 || i === 8 ? 3 : 2);
      assert.equal(
        job.parent,
        i === 0 ? 'adventurer' : i === 4 || i === 8 ? row[i - 2] : row[0],
      );
      assert.equal(
        job.activation,
        job.tier === 3 ? 'future_locked' : 'inactive',
      );
    }
  }
  assert.equal(
    Object.values(JOB_V2_REGISTRY).filter((j) => j.tier === 2).length,
    14,
  );
  assert.equal(
    Object.values(JOB_V2_REGISTRY).filter((j) => j.tier === 3).length,
    14,
  );
  assert.equal(getJobV2('assassin'), undefined);
  assert.equal(getJobV2('Assasin'), undefined);
  assert.equal(getJobV2('toString'), undefined);
});
void test('1B registry: versioned collisions remain distinct; all legacy specializations/saves remain valid with no V2 mapping', () => {
  assert.equal(Object.keys(CORE_JOBS).length, 5);
  assert.equal(Object.keys(SPECIALIZATIONS).length, 10);
  for (const [id, spec] of Object.entries(SPECIALIZATIONS)) {
    assert.equal(resolveJobMetadata(id)?.name, spec.name);
    assert.equal(getJobV2(id), undefined);
    const hero = freshHero();
    hero.level = 50;
    hero.job = spec.coreJob;
    hero.coreJob = spec.coreJob;
    hero.specialization = id as typeof hero.specialization;
    hero.skillPoints = 11;
    hero.skillLevels[`${id}-1`] = 2;
    const loaded = parseSave(JSON.stringify(hero))!;
    assert(loaded);
    assert.equal(loaded.specialization, id);
    assert.equal(loaded.coreJob, spec.coreJob);
    assert.equal(loaded.skillPoints, 11);
    assert.equal(loaded.skillLevels[`${id}-1`], 2);
    assert.equal('jobArchitectureVersion' in loaded, false);
    assert.equal('combatGauge' in loaded, false);
  }
  assert.equal(resolveJobMetadata('rogue', 1)?.tier, 1);
  assert.equal(resolveJobMetadata('rogue', 2)?.tier, 2);
  assert.equal(resolveJobMetadata('ranger', 1)?.name, 'Penjaga Rimba');
  assert.equal(resolveJobMetadata('ranger', 2)?.name, 'Ranger');
  assert.equal(resolveJobMetadata('arcanist', 1)?.tier, 1);
  assert.equal(resolveJobMetadata('arcanist', 2)?.tier, 3);
  assert.equal(resolveJobMetadata('berserker'), undefined);
});
void test('1B registry: metadata inheritance validates parent chain without registering or activating skills', () => {
  for (const specialization of ['berserker', 'blade_master'] as const) {
    const identity: JobV2Identity = {
      jobArchitectureVersion: 2,
      coreJob: 'warrior',
      specialization,
    };
    assert.deepEqual(
      resolveJobV2Lineage(identity)?.map((j) => j.id),
      ['adventurer', 'warrior', specialization],
    );
    assert(resolveJobV2Lineage(identity)?.every((j) => !j.playable));
  }
  assert.deepEqual(
    resolveJobV2Lineage({
      jobArchitectureVersion: 2,
      coreJob: 'warrior',
      specialization: 'berserker',
      advancedJob: 'executioner',
    })?.map((j) => j.id),
    ['adventurer', 'warrior', 'berserker', 'executioner'],
  );
  assert.equal(
    resolveJobV2Lineage({
      jobArchitectureVersion: 2,
      coreJob: 'mage',
      specialization: 'berserker',
    }),
    null,
  );
  assert.equal(
    resolveJobV2Lineage({
      jobArchitectureVersion: 2,
      coreJob: null,
      specialization: 'berserker',
    }),
    null,
  );
  assert.equal(
    ALL_SKILLS.some(
      (s) => s.id.startsWith('berserker') || s.id.startsWith('blade_master'),
    ),
    false,
  );
});
