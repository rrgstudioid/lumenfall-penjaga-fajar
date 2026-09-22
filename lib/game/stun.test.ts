import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARRIOR_V3_RUNTIME_SKILLS, WARRIOR_V3_SKILLS } from './warrior-v3.ts';
import { applyStun, chargeStunEligible, clearExpiredStun, isStunned, remainingStun, stunChanceForRank } from './stun.ts';
import { createV3AdventurerHero, parseSave } from './rules.ts';

await test('Iron Charge owns the only live Warrior V3 Stun profile', () => {
  const source = WARRIOR_V3_SKILLS.find((skill) => skill.id === 'v3-warrior-iron-charge')!;
  const runtime = WARRIOR_V3_RUNTIME_SKILLS.find((skill) => skill.id === source.id)!;
  assert.deepEqual(source.stunProfile?.chance, [.10,.15,.20,.25,.30]);
  assert.equal(source.stunProfile?.pveDuration, 1.5);
  assert.equal(source.stunProfile?.pvpDuration, .75);
  assert.equal(source.stunProfile?.minimumTravelDistance, 3.5);
  assert.equal(runtime.stunProfile?.targetPolicy, 'NORMAL');
  assert.equal(WARRIOR_V3_SKILLS.filter((skill) => skill.stunProfile).length, 1);
  assert.equal(runtime.knockbackStrength, 0);
  assert.deepEqual(runtime.dash, { stopDistance: 1.2, impactRange: 1 });
});

await test('Iron Charge distance threshold and rank chance are deterministic data rules', () => {
  assert.equal(chargeStunEligible(2, 3.5), false);
  assert.equal(chargeStunEligible(3.4, 3.5), false);
  assert.equal(chargeStunEligible(3.5, 3.5), true);
  assert.equal(chargeStunEligible(6, 3.5), true);
  const chances = [.10,.15,.20,.25,.30];
  assert.deepEqual(chances.map((_, index) => stunChanceForRank(chances, index + 1)), chances);
  assert.equal(stunChanceForRank(chances, 99), 0);
});

await test('Stun stores source/profile/expiry fields and refreshes without additive stacking', () => {
  const target: { stunState?: any } = {};
  assert.equal(applyStun(target, { sourceActorId: 'hero-1', sourceSkillId: 'v3-warrior-iron-charge', chance: .2, pveDuration: 1.5, pvpDuration: .75, targetPolicy: 'NORMAL', now: 10 }), true);
  assert.equal(isStunned(target, 10.5), true);
  assert.equal(remainingStun(target, 10.5), 1);
  assert.equal(applyStun(target, { sourceActorId: 'hero-1', sourceSkillId: 'v3-warrior-iron-charge', chance: .2, pveDuration: 1.5, pvpDuration: .75, targetPolicy: 'NORMAL', now: 10.5 }), true);
  assert.equal(target.stunState.expiresAt, 12);
  assert.equal(applyStun(target, { sourceActorId: 'hero-1', sourceSkillId: 'v3-warrior-iron-charge', chance: .2, pveDuration: 1.5, pvpDuration: .75, targetPolicy: 'NORMAL', now: 10.6 }), true);
  assert.equal(target.stunState.expiresAt, 12.1);
  assert.notEqual(target.stunState.expiresAt, 12.5);
  clearExpiredStun(target, 12.1);
  assert.equal(isStunned(target, 12.1), false);
});

await test('Stun immunity rejects control but does not belong to a resistance stat', () => {
  const target: { stunImmune?: boolean; stunState?: unknown } = { stunImmune: true };
  assert.equal(applyStun(target, { sourceActorId: 'hero-1', sourceSkillId: 'v3-warrior-iron-charge', chance: .3, pveDuration: 1.5, pvpDuration: .75, targetPolicy: 'NORMAL', now: 0 }), false);
  assert.equal(target.stunState, undefined);
});

await test('Active Stun is transient and is not restored by save parsing', () => {
  const hero = createV3AdventurerHero();
  const loaded = parseSave(JSON.stringify({ ...hero, stunState: { sourceActorId: 'enemy-1', sourceSkillId: 'x', chance: 1, pveDuration: 1.5, pvpDuration: .75, appliedAt: 1, expiresAt: 2.5, targetPolicy: 'NORMAL' } }));
  assert(loaded);
  assert.equal(loaded!.stunState, undefined);
});
