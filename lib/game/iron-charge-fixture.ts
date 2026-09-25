import type { StatusTarget } from './combat-status.ts';
import { applyStun, chargeStunEligible, clearExpiredStun, isStunned, remainingStun, stunChanceForRank, type StunState } from './stun.ts';
import { resolveTargetHit } from './combat-modifiers.ts';
import { mitigateDamage } from './combat-mechanics.ts';
import { resolveSkillAction, skillHitDamage } from './skill-action.ts';
import { WARRIOR_V3_RUNTIME_MAP } from './warrior-v3.ts';
import { moveDirectional } from './directional-movement.ts';

type FixtureStats = {
  physicalAttack: number; magicAttack: number; skillPower: number;
  physicalPenetration: number; magicPenetration: number; criticalRate: number;
  criticalDamage: number; accuracy: number; physicalDefense: number;
  magicDefense: number; defense: number; maxHP: number; maxMana: number;
  attack: number; elementalResistance: number; attackSpeed: number;
  movementSpeed: number; evasion: number; blockRate: number; healingPower: number;
  hpRecovery: number; staminaMax: number; manaCostReduction: number;
  manaRecovery: number; damageReduction: number; cooldownReduction: number;
  bossDamage: number; eliteDamage: number; skillDamage: number; expGain: number;
  goldDropRate: number; itemDropRate: number; materialDropRate: number;
};

export type FixtureTrace = { system: 'iron-charge-fixture'; stage: string; time: number; [key: string]: unknown };

export type FixtureTarget = StatusTarget & {
  id: string;
  hp: number;
  max: number;
  defense: number;
  position: { x: number; z: number };
  stunImmune: boolean;
  stunState?: StunState;
};

const TARGET_HP = 30000;

/**
 * Development-only combat fixture. It deliberately imports no World/Game,
 * renderer, map, terrain, GLB, NPC, quest, audio, or asset-loading module.
 * The resolver, V3 skill data, Stun policy, and charge stepping are shared
 * production primitives.
 */
export class IronChargeRuntimeFixture {
  readonly hero = { characterId: 'spv3-4-4-fixture', level: 59, mana: 999, maxMana: 999 };
  readonly target: FixtureTarget = {
    id: 'fixture-target', hp: TARGET_HP, max: TARGET_HP, defense: 0,
    position: { x: 0, z: 6 }, stunImmune: false,
  };
  actor = { x: 0, z: 0 };
  combatTime = 0;
  trace: FixtureTrace[] = [];
  private randomValue = 0;
  private cooldowns: Record<string, number> = {};

  constructor() {
  }

  private stats(): FixtureStats {
    const physicalAttack = 71 + 120 + 8;
    return {
      physicalAttack, attack: physicalAttack, magicAttack: 0, skillPower: 0,
      physicalPenetration: 0, magicPenetration: 0, criticalRate: 0, criticalDamage: 150,
      accuracy: 149, physicalDefense: 75, magicDefense: 75, defense: 75,
      maxHP: 1000, maxMana: 999, elementalResistance: 0, attackSpeed: 100,
      movementSpeed: 1, evasion: 0, blockRate: 0, healingPower: 0, hpRecovery: 0,
      staminaMax: 0, manaCostReduction: 0, manaRecovery: 0, damageReduction: 0,
      cooldownReduction: 0, bossDamage: 0, eliteDamage: 0, skillDamage: 0,
      expGain: 0, goldDropRate: 0, itemDropRate: 0, materialDropRate: 0,
    };
  }

  private emit(stage: string, data: Record<string, unknown> = {}) {
    this.trace.push({ system: 'iron-charge-fixture', stage, time: this.combatTime, ...data });
  }

  private reset(distance: number, immune = false) {
    this.actor = { x: 0, z: 0 };
    this.target.position = { x: 0, z: distance };
    this.target.hp = TARGET_HP;
    this.target.stunState = undefined;
    this.target.stunImmune = immune;
    this.hero.mana = 999;
    this.cooldowns = {};
    this.combatTime = 0;
    this.trace = [];
  }

  private move(dx: number, dz: number) {
    if (isStunned(this.target, this.combatTime)) return false;
    this.actor.x += dx;
    this.actor.z += dz;
    return true;
  }

  private controlAttempt(action: 'movement' | 'basic_attack' | 'active_skill') {
    clearExpiredStun(this.target, this.combatTime);
    return { action, accepted: !isStunned(this.target, this.combatTime) };
  }

  castIronCharge(distance: number, immune = false) {
    this.reset(distance, immune);
    const skill = WARRIOR_V3_RUNTIME_MAP['v3-warrior-iron-charge'];
    const start = { ...this.actor };
    this.emit('target_snapshot', { targetId: this.target.id, targetValid: true, actorPosition: start, targetPosition: { ...this.target.position } });
    const stats = this.stats();
    const action = resolveSkillAction(skill, {
      stats: stats as never, rank: 1, masteryPower: 1, masteryCooldown: 1,
      equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'one_hand_sword',
      primaryStats: { str: 135, vit: 15, dex: 15, int: 15 },
    });
    const accepted = action.weaponAllowed && this.hero.mana >= action.manaCost && !this.cooldowns[skill.id];
    if (!accepted) return { castAccepted: false, trace: this.trace };
    this.hero.mana -= action.manaCost;
    this.cooldowns[skill.id] = action.cooldown;
    this.emit('cast_accepted', { targetId: this.target.id });

    const direction = { x: this.target.position.x - this.actor.x, z: this.target.position.z - this.actor.z };
    const length = Math.hypot(direction.x, direction.z) || 1;
    const unit = { x: direction.x / length, z: direction.z / length };
    const stopDistance = action.dash?.stopDistance ?? 1.2;
    const configuredImpactRange = action.dash?.impactRange ?? 1;
    const effectiveImpactRange = Math.max(stopDistance, configuredImpactRange);
    const requestedDistance = Math.min(Math.max(0, length - stopDistance), action.range);
    this.emit('movement_command', { targetId: this.target.id, start, stopDistance, impactRange: configuredImpactRange, requestedDistance });
    moveDirectional(requestedDistance, unit, (dx, dz) => { this.move(dx, dz); });
    const travelDistance = Math.hypot(this.actor.x - start.x, this.actor.z - start.z);
    const targetDistance = Math.hypot(this.target.position.x - this.actor.x, this.target.position.z - this.actor.z);
    this.emit('movement_complete', { targetId: this.target.id, end: { ...this.actor }, travelDistance, remainingTargetDistance: targetDistance });

    const impactValid = this.target.hp > 0 && targetDistance <= effectiveImpactRange + 1e-6;
    if (!impactValid) return { castAccepted: true, impact: false, travelDistance, targetHpBefore: TARGET_HP, targetHpAfter: TARGET_HP, trace: this.trace };
    this.emit('impact_callback', { targetId: this.target.id, travelDistance, targetDistance });
    const hit = resolveTargetHit(action.hitSequence[0], action.targetModifiers, this.target, this.combatTime);
    const raw = skillHitDamage(hit, stats);
    const amount = Math.round(mitigateDamage(raw, this.target.defense, this.hero.level, stats.physicalPenetration));
    const hpBefore = this.target.hp;
    this.emit('damage_resolver', { targetId: this.target.id, amountBeforeMitigation: raw, hpBefore });
    this.target.hp = Math.max(0, this.target.hp - amount);
    this.emit('target_hp_changed', { targetId: this.target.id, hpBefore, hpAfter: this.target.hp, damage: hpBefore - this.target.hp });
    const stunProfile = skill.stunProfile!;
    const chance = stunChanceForRank(stunProfile.chance, 1);
    const eligible = chargeStunEligible(travelDistance, stunProfile.minimumTravelDistance);
    this.emit('stun_eligibility', { targetId: this.target.id, travelDistance, minimumTravelDistance: stunProfile.minimumTravelDistance, eligible, immune: this.target.stunImmune });
    let stunned = false;
    if (eligible && this.randomValue < chance) {
      stunned = applyStun(this.target, { sourceActorId: this.hero.characterId, sourceSkillId: skill.id, chance, pveDuration: stunProfile.pveDuration, pvpDuration: stunProfile.pvpDuration, targetPolicy: stunProfile.targetPolicy, now: this.combatTime });
      if (stunned) this.emit('stun_applied', { targetId: this.target.id, expiresAt: this.target.stunState?.expiresAt ?? null });
    }
    return { castAccepted: true, impact: true, startDistance: length, travelDistance, targetDistance, targetHpBefore: hpBefore, targetHpAfter: this.target.hp, damage: hpBefore - this.target.hp, stunEligible: eligible, stunned, stunExpiresAt: this.target.stunState?.expiresAt ?? null, trace: this.trace };
  }

  controlLockCase() {
    const result = this.castIronCharge(6);
    const attempts = [this.controlAttempt('movement'), this.controlAttempt('basic_attack'), this.controlAttempt('active_skill')];
    return { ...result, attempts, stunned: isStunned(this.target, this.combatTime) };
  }

  recoveryCase() {
    this.castIronCharge(6);
    this.combatTime = 1.6;
    clearExpiredStun(this.target, this.combatTime);
    return { movement: this.controlAttempt('movement'), basicAttack: this.controlAttempt('basic_attack'), activeSkill: this.controlAttempt('active_skill'), stunned: isStunned(this.target, this.combatTime), remaining: remainingStun(this.target, this.combatTime) };
  }

  basicAttackCase() {
    this.reset(2.5);
    const before = this.target.hp;
    const amount = Math.round(mitigateDamage(this.stats().physicalAttack, this.target.defense, this.hero.level, this.stats().physicalPenetration));
    this.target.hp = Math.max(0, this.target.hp - amount);
    return { damage: before - this.target.hp, stunned: false, knockback: 0, targetPosition: { ...this.target.position } };
  }
}
