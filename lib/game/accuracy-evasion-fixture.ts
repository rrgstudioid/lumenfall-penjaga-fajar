import { createItem } from './items.ts';
import { chooseV3Berserker, chooseV3BladeMaster, chooseV3Warrior, createV3AdventurerHero, derivedStats, resolveHeroSkill } from './rules.ts';
import { BERSERKER_V3_RUNTIME_MAP } from './berserker-v3.ts';
import { BLADE_MASTER_V3_RUNTIME_MAP } from './blade-master-v3.ts';
import { applySourceOwnedStatus, type StatusTarget } from './combat-status.ts';
import { applyStun, stunChanceForRank } from './stun.ts';
import { resolveHitAgainstEvasion } from './combat-mechanics.ts';
import { BladeMasterImpactSession } from './blade-master-impact.ts';
import { TransientCombatState } from './combat-transient.ts';
import { SkillHitQueue, skillHitDamage } from './skill-action.ts';

type FixtureTarget = StatusTarget & {
  hp: number;
  evasion: number;
  stunImmune?: boolean;
};

const target = (evasion: number): FixtureTarget => ({
  hp: 10000,
  evasion,
  sourceOwnedStatuses: {},
});

function bladeMasterHero() {
  const hero = createV3AdventurerHero('accuracy-evasion-blade-fixture', 'Accuracy Evasion Blade Fixture');
  hero.level = 80;
  hero.skillProgressionV3!.totalEarnedSP = 500;
  if (!chooseV3Warrior(hero) || !chooseV3BladeMaster(hero)) throw new Error('Blade Master fixture transition failed');
  const sword = (id: string, attack: number) => createItem('legacy-fajar-blade', {
    id, baseStats: { attack }, equipSlot: 'mainHand', mainHand: true,
    equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword',
    handedness: 'one_hand', twoHanded: false,
  });
  const main = sword('accuracy-evasion-main', 100);
  const off = sword('accuracy-evasion-off', 70);
  hero.inventory.push(main, off);
  hero.equipment.mainHand = main.id;
  hero.equipment.offHand = off.id;
  hero.skillProgressionV3!.skillRanks = {
    'v3-blade-master-twin-blade-mastery': 5,
    'v3-blade-master-twin-assault': 8,
    'v3-blade-master-piercing-sequence': 5,
    'v3-blade-master-blade-tempest': 3,
  };
  return hero;
}

function berserkerHero() {
  const hero = createV3AdventurerHero('accuracy-evasion-berserker-fixture', 'Accuracy Evasion Berserker Fixture');
  hero.level = 80;
  hero.skillProgressionV3!.totalEarnedSP = 500;
  if (!chooseV3Warrior(hero) || !chooseV3Berserker(hero)) throw new Error('Berserker fixture transition failed');
  const sword = createItem('jayantara-two-hand-sword', {
    id: 'accuracy-evasion-two-hand',
    baseStats: { attack: 120 },
    equipSlot: 'mainHand',
    mainHand: true,
    equipmentType: 'two_hand_sword',
    weaponType: 'two_hand_sword',
    handedness: 'two_hand',
    twoHanded: true,
  });
  hero.inventory.push(sword);
  hero.equipment.mainHand = sword.id;
  hero.skillProgressionV3!.skillRanks = {
    'v3-berserker-two-hand-mastery': 5,
    'v3-berserker-earth-splitter': 5,
    'v3-berserker-fury-harvest': 5,
  };
  return hero;
}

function bladeSequence(
  hero: ReturnType<typeof bladeMasterHero>,
  skillId: keyof typeof BLADE_MASTER_V3_RUNTIME_MAP,
  rank: number,
  fixtureTarget: FixtureTarget,
  rolls: number[],
  state = new TransientCombatState(),
) {
  const stats = derivedStats(hero);
  const action = resolveHeroSkill(hero, BLADE_MASTER_V3_RUNTIME_MAP[skillId], rank, stats);
  const session = new BladeMasterImpactSession(action.skillId, state, 1);
  const queue = new SkillHitQueue();
  const hits: Array<Record<string, unknown>> = [];
  let rollIndex = 0;
  queue.schedule(action.hitSequence, () => fixtureTarget.hp > 0, hit => {
    const index = action.hitSequence.indexOf(hit);
    const prepared = session.prepare(hit, index, action.hitSequence.length - 1, fixtureTarget, 'A', 1);
    const resolution = resolveHitAgainstEvasion({
      attackerAccuracy: prepared.accuracy,
      targetEvasion: fixtureTarget.evasion,
      rng: () => rolls[rollIndex++] ?? 0,
    });
    if (resolution.result === 'EVADED') {
      hits.push({ result: resolution.result, effectiveEvasion: resolution.effectiveEvasion, roll: resolution.roll });
      return;
    }
    const damage = skillHitDamage(prepared, stats);
    fixtureTarget.hp -= damage;
    session.commitDamagingImpact(1, 5, true, true);
    hits.push({
      result: resolution.result,
      damage,
      effectiveEvasion: resolution.effectiveEvasion,
      roll: resolution.roll,
      damageMultiplier: prepared.damageMultiplier,
    });
  });
  queue.update(5);
  return {
    hpBefore: 10000,
    hpAfter: fixtureTarget.hp,
    damage: 10000 - fixtureTarget.hp,
    hits,
    flowActiveAfter: state.bladeFlowActive(1),
    tempoAfter: state.tempoCount(1),
  };
}

function berserkerArea(
  hero: ReturnType<typeof berserkerHero>,
  skillId: keyof typeof BERSERKER_V3_RUNTIME_MAP,
  rank: number,
  targets: FixtureTarget[],
  rolls: number[],
) {
  const stats = derivedStats(hero);
  const action = resolveHeroSkill(hero, BERSERKER_V3_RUNTIME_MAP[skillId], rank, stats);
  const results = targets.map((fixtureTarget, index) => {
    const hit = action.hitSequence[0]!;
    const resolution = resolveHitAgainstEvasion({
      attackerAccuracy: hit.accuracy,
      targetEvasion: fixtureTarget.evasion,
      rng: () => rolls[index] ?? 0,
    });
    if (resolution.result === 'EVADED') return { result: resolution.result, damage: 0, stunned: false };
    const damage = skillHitDamage(hit, stats);
    fixtureTarget.hp -= damage;
    let stunned = false;
    if (action.stunProfile && action.skillId === 'v3-berserker-earth-splitter') {
      stunned = applyStun(fixtureTarget, {
        sourceActorId: 'A',
        sourceSkillId: action.skillId,
        chance: stunChanceForRank(action.stunProfile.chance, rank),
        pveDuration: action.stunProfile.pveDuration,
        pvpDuration: action.stunProfile.pvpDuration,
        targetPolicy: action.stunProfile.targetPolicy,
        now: 1,
      });
    }
    return { result: resolution.result, damage, stunned };
  });
  return { results, successfulTargets: results.filter(result => result.result === 'HIT').length };
}

export function runAccuracyEvasionFixture() {
  const formula = [
    resolveHitAgainstEvasion({ attackerAccuracy: 105, targetEvasion: 1.5, rng: () => 0.999 }),
    resolveHitAgainstEvasion({ attackerAccuracy: 105, targetEvasion: 5.5, rng: () => 0.96 }),
    resolveHitAgainstEvasion({ attackerAccuracy: 145, targetEvasion: 5.5, rng: () => 0.999 }),
    resolveHitAgainstEvasion({ attackerAccuracy: 90, targetEvasion: 50, rng: () => 0.5 }),
    resolveHitAgainstEvasion({ attackerAccuracy: 80, targetEvasion: 10, rng: () => 0.89 }),
  ];

  const basic = {
    targetEvasion0: resolveHitAgainstEvasion({ attackerAccuracy: 105, targetEvasion: 0, rng: () => 0.999 }),
    targetEvasion50: resolveHitAgainstEvasion({ attackerAccuracy: 105, targetEvasion: 50, rng: () => 0.999 }),
  };

  const twinState = new TransientCombatState();
  twinState.openBladeFlow(1, 3);
  const twinOneLands = bladeSequence(bladeMasterHero(), 'v3-blade-master-twin-assault', 8, target(50), [0.999, 0], twinState);
  const twinBothEvadeState = new TransientCombatState();
  twinBothEvadeState.openBladeFlow(1, 3);
  const twinBothEvade = bladeSequence(bladeMasterHero(), 'v3-blade-master-twin-assault', 8, target(50), [0.999, 0.999], twinBothEvadeState);

  const piercingHero = bladeMasterHero();
  const piercingNoOwner = bladeSequence(piercingHero, 'v3-blade-master-piercing-sequence', 5, target(10), [0.93, 0.93, 0.93]);
  const otherArmor = target(10);
  applySourceOwnedStatus(otherArmor, 'armor_break', { sourceActorId: 'B', sourceSkillId: 'v3-warrior-armor-breaker', strength: 12, appliedAt: 0, duration: 8 });
  const piercingOtherOwner = bladeSequence(piercingHero, 'v3-blade-master-piercing-sequence', 5, otherArmor, [0.93, 0.93, 0.93]);
  const ownArmor = target(10);
  applySourceOwnedStatus(ownArmor, 'armor_break', { sourceActorId: 'A', sourceSkillId: 'v3-warrior-armor-breaker', strength: 6, appliedAt: 0, duration: 8 });
  const piercingOwnOwner = bladeSequence(piercingHero, 'v3-blade-master-piercing-sequence', 5, ownArmor, [0.93, 0.93, 0.93]);

  const tempestState = new TransientCombatState();
  tempestState.openBladeFlow(1, 3);
  for (let i = 0; i < 3; i++) tempestState.gainBladeTempo(1, 7);
  const tempest = bladeSequence(bladeMasterHero(), 'v3-blade-master-blade-tempest', 3, target(50), [0, 0.999, 0, 0.999, 0], tempestState);

  const berserker = berserkerHero();
  const earth = berserkerArea(berserker, 'v3-berserker-earth-splitter', 5, [target(0), target(50)], [0, 0.999]);
  const fury = berserkerArea(berserker, 'v3-berserker-fury-harvest', 5, [target(0), target(50), target(0)], [0, 0.999, 0]);

  return {
    status: 'PASS',
    worldImported: false,
    mapLoaded: false,
    formula,
    basic,
    twinOneLands,
    twinBothEvade,
    piercingNoOwner,
    piercingOtherOwner,
    piercingOwnOwner,
    tempest,
    earth,
    fury,
  };
}
