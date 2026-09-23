import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURER_V3_SKILL_MAP, adventurerV3RankValues } from './adventurer-v3.ts';
import {
  BERSERKER_MASTERY_MANA_SKILLS,
  BERSERKER_TRANCE_AOE_SKILLS,
  BERSERKER_TRANCE_DAMAGE_SKILLS,
  BERSERKER_V3_RUNTIME_MAP,
  BERSERKER_V3_SKILL_MAP,
} from './berserker-v3.ts';
import {
  BLADE_FOCUS_FLOW_DURATION,
  BLADE_MASTER_V3_RUNTIME_MAP,
  BLADE_MASTER_V3_SKILL_MAP,
} from './blade-master-v3.ts';
import { BladeMasterImpactSession } from './blade-master-impact.ts';
import { addTemporaryModifier } from './combat-modifiers.ts';
import { counterContextAllowed, DefenseEvents } from './combat-status.ts';
import { TransientCombatState } from './combat-transient.ts';
import { moveCollisionSafeTo, passThroughEndpoint } from './directional-movement.ts';
import { createItem } from './items.ts';
import {
  activeSkills,
  basicAttackPower,
  chooseV3Berserker,
  chooseV3BladeMaster,
  chooseV3Warrior,
  createV3AdventurerHero,
  derivedStats,
  parseSave,
  resolveHeroSkill,
  warriorLineageSkillPointsAtLevel,
} from './rules.ts';
import { selectSkillTargets, skillHitDamage } from './skill-action.ts';
import { WARRIOR_V3_RUNTIME_MAP, WARRIOR_V3_SKILL_MAP } from './warrior-v3.ts';

function warrior(level = 80) {
  const hero = createV3AdventurerHero('final-warrior', 'Final Warrior');
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 500;
  assert.equal(chooseV3Warrior(hero), true);
  return hero;
}

function oneHandSword(id: string, attack: number) {
  return createItem('legacy-fajar-blade', {
    id,
    baseStats: { attack },
    bonusStats: {},
    equipmentType: 'one_hand_sword',
    weaponType: 'one_hand_sword',
    handedness: 'one_hand',
    twoHanded: false,
    equipSlot: 'mainHand',
    mainHand: true,
    offHand: false,
  });
}

test('FINAL A: Lv15 controlled Warrior Strike raw is exactly 45.04', () => {
  const hero = createV3AdventurerHero('controlled-l15', 'Controlled Lv15');
  hero.level = 15;
  hero.allocatedStats = { ...hero.allocatedStats, str: 13 };
  assert.equal(chooseV3Warrior(hero), true);
  const stats = derivedStats(hero);
  assert.equal(stats.physicalAttack, 44);
  const action = resolveHeroSkill(hero, WARRIOR_V3_RUNTIME_MAP['v3-warrior-strike'], 1, stats);
  assert.equal(skillHitDamage(action.hitSequence[0], stats), 45.04);
});

test('FINAL B: canonical normal SP milestones are exact', () => {
  assert.deepEqual(
    [14,29,30,59,60,70,75,80].map((level) => [level, warriorLineageSkillPointsAtLevel(level)]),
    [[14,13],[29,28],[30,30],[59,88],[60,90],[70,120],[75,135],[80,150]],
  );
});

test('FINAL C: Adventurer canonical gates, scaling, Mana and cooldown arrays are exact', () => {
  assert.equal(ADVENTURER_V3_SKILL_MAP['v3-adventurer-quick-slash'].rankLevelRequirements?.[0], 1);
  assert.equal(ADVENTURER_V3_SKILL_MAP['v3-adventurer-power-strike'].rankLevelRequirements?.[0], 1);
  assert.equal(ADVENTURER_V3_SKILL_MAP['v3-adventurer-minor-heal'].rankLevelRequirements?.[0], 1);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-quick-slash').map((rank) => rank.statScaling?.str), [.02,.03,.04,.05,.06]);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-quick-slash').map((rank) => rank.manaCost), [3,3,4,4,5]);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-power-strike').map((rank) => rank.statScaling?.str), [.04,.05,.06,.07,.08]);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-power-strike').map((rank) => rank.manaCost), [5,5,6,6,7]);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-minor-heal').map((rank) => rank.manaCost), [8,10,12]);
  assert.deepEqual(adventurerV3RankValues('v3-adventurer-minor-heal').map((rank) => rank.cooldown), [30,28,26]);
});

test('FINAL D: DOCX R1 gates and Warrior buff rank Mana/cooldown are exact', () => {
  const warriorGates: Record<string, number> = {
    'v3-warrior-strike':15,'v3-warrior-iron-charge':15,'v3-warrior-sweeping-slash':15,
    'v3-warrior-guard-stance':15,'v3-warrior-armor-breaker':17,'v3-warrior-battle-cry':20,
    'v3-warrior-counter-slash':17,'v3-warrior-battle-focus':20,'v3-warrior-ground-breaker':20,
    'v3-warrior-unbroken-stance':25,'v3-warrior-crushing-finale':20,
  };
  for (const [id, gate] of Object.entries(warriorGates))
    assert.equal(WARRIOR_V3_SKILL_MAP[id].rankLevelRequirements?.[0], gate, id);
  for (const [id, mana, cooldown] of [
    ['v3-warrior-guard-stance',[10,11,12,13,14],[18,17.5,17,16.5,16]],
    ['v3-warrior-battle-cry',[14,15,16,17,18],[35,35,35,35,35]],
    ['v3-warrior-battle-focus',[14,15,16,17,18],[35,35,35,35,35]],
    ['v3-warrior-unbroken-stance',[16,18,20,22,24],[28,27.5,27,26.5,26]],
  ] as const) {
    assert.deepEqual(WARRIOR_V3_RUNTIME_MAP[id].rankValues?.map((rank) => rank.manaCost), mana, `${id} Mana`);
    assert.deepEqual(WARRIOR_V3_RUNTIME_MAP[id].rankValues?.map((rank) => rank.cooldown), cooldown, `${id} cooldown`);
  }
});

test('FINAL E: Battle Cry raises outgoing physical damage but leaves PATK unchanged', () => {
  const hero = warrior(59);
  const strike = WARRIOR_V3_RUNTIME_MAP['v3-warrior-strike'];
  const statsBefore = derivedStats(hero);
  const skillBefore = skillHitDamage(resolveHeroSkill(hero, strike, 1, statsBefore).hitSequence[0], statsBefore);
  const basicBefore = basicAttackPower(hero);
  const cry = resolveHeroSkill(hero, WARRIOR_V3_RUNTIME_MAP['v3-warrior-battle-cry'], 5, statsBefore);
  assert.equal(addTemporaryModifier(hero, cry.temporaryBuffs![0].modifier, cry.temporaryBuffs![0].duration), true);
  const statsDuring = derivedStats(hero);
  const skillDuring = skillHitDamage(resolveHeroSkill(hero, strike, 1, statsDuring).hitSequence[0], statsDuring);
  assert.equal(statsDuring.physicalAttack, statsBefore.physicalAttack);
  assert.ok(Math.abs(skillDuring / skillBefore - 1.07) < 1e-10);
  assert.ok(Math.abs(basicAttackPower(hero) / basicBefore - 1.07) < 1e-10);
});

test('FINAL F/G: canonical selector enforces current rank radius/cap and fixture-equivalent behavior', () => {
  const hero = warrior(59);
  const entries = [1,2,3,3.8,4.2,4.6,5].map((x, index) => ({ target: `T${index + 1}`, id: `T${index + 1}`, position: { x, z: 0 }, alive: true }));
  const sweepingR1 = resolveHeroSkill(hero, WARRIOR_V3_RUNTIME_MAP['v3-warrior-sweeping-slash'], 1);
  const sweepingR5 = resolveHeroSkill(hero, WARRIOR_V3_RUNTIME_MAP['v3-warrior-sweeping-slash'], 5);
  assert.equal(sweepingR1.areaRadius, 4);
  assert.equal(selectSkillTargets({ action: sweepingR1, origin:{x:0,z:0}, forward:{x:1,z:0}, candidates:entries }).length, 3);
  assert.equal(sweepingR5.areaRadius, 4.4);
  assert.equal(selectSkillTargets({ action: sweepingR5, origin:{x:0,z:0}, forward:{x:1,z:0}, candidates:entries }).length, 4);
  const groundR5 = resolveHeroSkill(hero, WARRIOR_V3_RUNTIME_MAP['v3-warrior-ground-breaker'], 5);
  assert.equal(selectSkillTargets({ action: groundR5, origin:{x:0,z:0}, forward:{x:1,z:0}, candidates:entries }).length, 6);
});

test('FINAL H: Offhand +100 raw ATK does not change inherited Warrior SINGLE_MAIN damage', () => {
  const hero = warrior(80);
  assert.equal(chooseV3BladeMaster(hero), true);
  const main = oneHandSword('final-main', 100);
  const off = oneHandSword('final-off', 70);
  hero.inventory.push(main, off);
  hero.equipment.mainHand = main.id;
  hero.equipment.offHand = off.id;
  hero.skillProgressionV3!.skillRanks['v3-blade-master-twin-blade-mastery'] = 1;
  const skill = activeSkills(hero).find((entry) => entry.id === 'v3-warrior-strike')!;
  const beforeStats = derivedStats(hero);
  const before = skillHitDamage(resolveHeroSkill(hero, skill, 1, beforeStats).hitSequence[0], beforeStats);
  off.baseStats.attack = 170;
  const afterStats = derivedStats(hero);
  const after = skillHitDamage(resolveHeroSkill(hero, skill, 1, afterStats).hitSequence[0], afterStats);
  assert.equal(afterStats.physicalAttack - beforeStats.physicalAttack, 100);
  assert.equal(after, before);
});

test('FINAL I: Counterflow requires a fresh Block/Parry CounterContext', () => {
  const policy = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-counterflow'].counterPolicy!;
  const events = new DefenseEvents();
  assert.equal(counterContextAllowed(events.snapshot(policy.accepted, policy.windowMs, 0), policy.accepted), false);
  events.lastDefenseEvent = { result:'hit', timestamp:0, sourceId:'unrelated', consumed:false };
  assert.equal(counterContextAllowed(events.snapshot(policy.accepted, policy.windowMs, 1), policy.accepted), false);
  events.lastDefenseEvent = { result:'blocked', timestamp:1000, sourceId:'enemy-A', consumed:false };
  assert.equal(counterContextAllowed(events.snapshot(policy.accepted, policy.windowMs, 2000), policy.accepted), true);
  assert.equal(counterContextAllowed(events.snapshot(policy.accepted, policy.windowMs, 4000), policy.accepted), false);
  events.lastDefenseEvent = { result:'parried', timestamp:4000, sourceId:'enemy-B', consumed:true };
  assert.equal(counterContextAllowed(events.snapshot(policy.accepted, policy.windowMs, 4001), policy.accepted), false);
});

test('FINAL J/K: Blade Focus Flow durations and Twin Assault one-Tempo-per-cast are exact', () => {
  assert.deepEqual([...BLADE_FOCUS_FLOW_DURATION], [3.5,3.75,4,4.25,4.5]);
  assert.deepEqual(BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-blade-focus'].rankValues?.map((rank) => rank.duration), [20,22,24,26,28]);
  const state = new TransientCombatState();
  const target = { hp:100, sourceOwnedStatuses:{} };
  const session = new BladeMasterImpactSession('v3-blade-master-twin-assault', state, 0);
  session.commitDamagingImpact(0, 5, true, true);
  session.commitDamagingImpact(.18, 5, true, true);
  assert.equal(state.tempoCount(.18), 1);
  assert.equal(session.prepare({ ...resolveHeroSkill(warrior(80), WARRIOR_V3_RUNTIME_MAP['v3-warrior-strike'], 1).hitSequence[0] }, 0, 0, target, 'A', 0).damageMultiplier > 0, true);
});

test('FINAL L/M: Berserker Mastery whitelist and Trance resource arrays are exact', () => {
  assert.deepEqual([...BERSERKER_MASTERY_MANA_SKILLS], [
    'v3-berserker-raging-cleave','v3-berserker-crushing-blow','v3-berserker-earth-splitter',
    'v3-berserker-ruinous-arc','v3-berserker-fury-harvest','v3-berserker-trance',
  ]);
  assert.equal(BERSERKER_MASTERY_MANA_SKILLS.has('v3-berserker-iron-blood'), false);
  assert.equal(BERSERKER_MASTERY_MANA_SKILLS.has('v3-berserker-breaker-entry'), false);
  assert.equal(BERSERKER_MASTERY_MANA_SKILLS.has('v3-warrior-strike'), false);
  assert.deepEqual([...BERSERKER_TRANCE_DAMAGE_SKILLS].includes('v3-berserker-breaker-entry'), false);
  assert.deepEqual([...BERSERKER_TRANCE_AOE_SKILLS].includes('v3-berserker-breaker-entry'), true);
  assert.deepEqual(BERSERKER_V3_RUNTIME_MAP['v3-berserker-trance'].rankValues?.map((rank) => rank.manaCost), [30,34,38]);
  assert.deepEqual(BERSERKER_V3_RUNTIME_MAP['v3-berserker-trance'].rankValues?.map((rank) => rank.cooldown), [90,88,85]);
  assert.deepEqual(BERSERKER_V3_RUNTIME_MAP['v3-berserker-trance'].rankValues?.map((rank) => rank.duration), [12,14,16]);
  const berserkerGates: Record<string, number> = {
    'v3-berserker-two-hand-mastery':60,'v3-berserker-raging-cleave':60,'v3-berserker-crushing-blow':60,
    'v3-berserker-iron-blood':60,'v3-berserker-breaker-entry':60,'v3-berserker-earth-splitter':66,
    'v3-berserker-ruinous-arc':66,'v3-berserker-fury-harvest':70,'v3-berserker-trance':70,
  };
  for (const [id, gate] of Object.entries(berserkerGates)) assert.equal(BERSERKER_V3_SKILL_MAP[id].rankLevelRequirements?.[0], gate, id);
});

test('FINAL N: Blade Rush reaches a safe pass-through endpoint behind target', () => {
  const target = { x: 2.5, z: 0 };
  const endpoint = passThroughEndpoint(target, { x: 1, z: 0 });
  assert.deepEqual(endpoint, { x: 4, z: 0 });
  const actor = { x: 1.2, z: 0 };
  const result = moveCollisionSafeTo(endpoint, () => ({ ...actor }), (x, z) => { actor.x += x; actor.z += z; });
  assert.equal(result.reached, true);
  assert.ok(actor.x > target.x);
  assert.ok(Math.abs(actor.x - 4) < 1e-10);
});

test('FINAL DOCX R1 Blade Master gates and prerequisite graph are exact', () => {
  const gates: Record<string, number> = {
    'v3-blade-master-twin-blade-mastery':60,'v3-blade-master-twin-assault':60,'v3-blade-master-blade-rush':60,
    'v3-blade-master-counterflow':63,'v3-blade-master-blade-focus':63,'v3-blade-master-cross-sever':65,
    'v3-blade-master-piercing-sequence':65,'v3-blade-master-tempo-drive':65,'v3-blade-master-blade-tempest':67,
  };
  for (const [id, gate] of Object.entries(gates)) assert.equal(BLADE_MASTER_V3_SKILL_MAP[id].rankLevelRequirements?.[0], gate, id);
  assert.deepEqual(BLADE_MASTER_V3_SKILL_MAP['v3-blade-master-blade-focus'].prerequisiteSkills, [{ skillId:'v3-warrior-battle-focus', requiredRank:3 }]);
});

test('FINAL save keeps lineage/ranks but clears every Warrior-lineage combat transient', () => {
  const hero = warrior(80);
  assert.equal(chooseV3BladeMaster(hero), true);
  hero.skillProgressionV3!.skillRanks['v3-blade-master-twin-blade-mastery'] = 3;
  hero.skillLevels['v3-blade-master-twin-blade-mastery'] = 3;
  hero.activeBuffs['v3-blade-master-blade-focus'] = 20;
  hero.activeBuffs['v3-blade-master-tempo-drive'] = 8.5;
  hero.statusEffects.stun = 1.5;
  hero.statusEffects.superArmor = 2;
  hero.stunState = { sourceActorId:'enemy', sourceSkillId:'test', chance:1, pveDuration:1.5, pvpDuration:.75, appliedAt:0, expiresAt:1.5, targetPolicy:'NORMAL' };
  hero.temporaryModifiers = [{ id:'transient-test', source:'test', expiresAt:99 } as never];
  hero.combatStateModifiers = [{ id:'combat-test', source:'test' } as never];
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.coreJob, 'warrior');
  assert.equal(loaded.specialization, 'blade_master');
  assert.equal(loaded.skillProgressionV3!.skillRanks['v3-blade-master-twin-blade-mastery'], 3);
  assert.deepEqual(Object.keys(loaded.activeBuffs).filter((id) => id.startsWith('v3-')), []);
  assert.equal(loaded.statusEffects.stun, undefined);
  assert.equal(loaded.statusEffects.superArmor, undefined);
  assert.equal(loaded.stunState, undefined);
  assert.equal(loaded.temporaryModifiers, undefined);
  assert.equal(loaded.combatStateModifiers, undefined);
});
