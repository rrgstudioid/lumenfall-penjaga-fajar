import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySourceOwnedStatus, clearExpiredSourceStatuses, effectiveArmorBreakStrength, getActiveStatusApplications, hasActiveStatusFromSource } from './combat-status.ts';
import { resolveTargetHit } from './combat-modifiers.ts';
import { ARMOR_BREAK_REDUCTION_BY_RANK, WARRIOR_V3_RUNTIME_MAP } from './warrior-v3.ts';
import { mitigateDamage } from './combat-mechanics.ts';
import { resolveSkillAction } from './skill-action.ts';

const target = () => ({ statusEffects: {}, sourceOwnedStatuses: {} });

test('Armor Break keeps independent source applications and resolves strongest-only', () => {
  const enemy = target();
  applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'A', sourceSkillId: 'armor-breaker', strength: 6, appliedAt: 0, duration: 10 });
  applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'B', sourceSkillId: 'armor-breaker', strength: 12, appliedAt: 1, duration: 5 });
  assert.equal(getActiveStatusApplications(enemy, 'armor_break', 2).length, 2);
  assert.equal(effectiveArmorBreakStrength(enemy, 2), 12);
  assert.equal(hasActiveStatusFromSource(enemy, 'armor_break', 'A', 2), true);
  assert.equal(hasActiveStatusFromSource(enemy, 'armor_break', 'B', 2), true);
  clearExpiredSourceStatuses(enemy, 6);
  assert.equal(effectiveArmorBreakStrength(enemy, 6), 6);
  assert.equal(getActiveStatusApplications(enemy, 'armor_break', 6).length, 1);
});

test('same source refreshes one Armor Break record and source-aware payoff excludes other actors', () => {
  const enemy = target();
  applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'A', sourceSkillId: 'armor-breaker', strength: 6, appliedAt: 0, duration: 4 });
  applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'A', sourceSkillId: 'armor-breaker', strength: 9, appliedAt: 3, duration: 8 });
  assert.equal(getActiveStatusApplications(enemy, 'armor_break', 3).length, 1);
  assert.equal(getActiveStatusApplications(enemy, 'armor_break', 3)[0].expiresAt, 11);
  assert.equal(getActiveStatusApplications(enemy, 'armor_break', 3)[0].strength, 9);
  const hit = { delay: 0, baseDamage: 100, physicalCoefficient: 0, magicCoefficient: 0, skillPowerCoefficient: 0, knockbackStrength: 0, damageMultiplier: 1, damageType: 'physical' as const, canCrit: false, criticalRate: 0, criticalDamage: 150, accuracy: 0, statuses: [], scopedComposition: { base: { damageMultiplier: 1, knockbackStrength: 1 }, normal: { damageMultiplier: 0, knockbackStrength: 0 }, payoff: { damageMultiplier: 1, knockbackStrength: 1 } } };
  const mod = { id: 'finale', layer: 'payoff' as const, payoffGroup: 'finale', condition: { targetStatusesFromSource: ['armor_break'] }, action: { damagePercent: 10 } };
  assert.equal(resolveTargetHit(hit, [mod], enemy, 3, { source: { sourceActorId: 'A', sourceGeneration: 1 }, now: 3 }).damageMultiplier, 1.1);
  assert.equal(resolveTargetHit(hit, [mod], enemy, 3, { source: { sourceActorId: 'B', sourceGeneration: 1 }, now: 3 }).damageMultiplier, 1);
});

test('source-owned Armor Break is runtime-only and expires without stale mitigation', () => {
  const enemy = target();
  applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'A', sourceSkillId: 'armor-breaker', strength: 12, appliedAt: 0, duration: 2 });
  clearExpiredSourceStatuses(enemy, 2);
  assert.equal(effectiveArmorBreakStrength(enemy, 2), 0);
  assert.deepEqual(enemy.sourceOwnedStatuses, {});
});

test('real Warrior V3 Armor Breaker ranks reach mitigation with canonical strength', () => {
  const skill = WARRIOR_V3_RUNTIME_MAP['v3-warrior-armor-breaker'];
  const values: number[] = [];
  for (let rank = 1; rank <= 5; rank++) {
    const action = resolveSkillAction(skill, { stats: {} as never, rank, masteryPower: 1, masteryCooldown: 1, equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'one_hand_sword', primaryStats: { str: 15, vit: 15, dex: 15, int: 15 } });
    const enemy = target();
    applySourceOwnedStatus(enemy, 'armor_break', { sourceActorId: 'A', sourceSkillId: action.skillId, strength: action.armorBreakStrengthByRank![rank - 1], appliedAt: 0, duration: 8 });
    assert.equal(effectiveArmorBreakStrength(enemy, 0), ARMOR_BREAK_REDUCTION_BY_RANK[rank - 1]);
    values.push(mitigateDamage(100, 100 * (1 - effectiveArmorBreakStrength(enemy, 0) / 100), 60));
  }
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.deepEqual(ARMOR_BREAK_REDUCTION_BY_RANK, [6, 7.5, 9, 10.5, 12]);
});
