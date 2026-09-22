import { BERSERKER_V3_RUNTIME_MAP, EARTH_SPLITTER_STUN_CHANCE, FURY_HARVEST_RECOVERY_PERCENT } from './berserker-v3.ts';
import { WARRIOR_V3_RUNTIME_MAP } from './warrior-v3.ts';
import { resolveSkillAction, skillHitDamage } from './skill-action.ts';
import { resolveTargetHit } from './combat-modifiers.ts';
import { mitigateDamage } from './combat-mechanics.ts';
import { applyStun, isStunned, remainingStun, stunChanceForRank, type StunState, type StunTarget } from './stun.ts';
import { TransientCombatState } from './combat-transient.ts';

type FixtureStats = {
  physicalAttack: number; magicAttack: number; skillPower: number; physicalPenetration: number;
  magicPenetration: number; criticalRate: number; criticalDamage: number; accuracy: number;
  physicalDefense: number; magicDefense: number; defense: number; maxHP: number; maxMana: number;
  attack: number; elementalResistance: number; attackSpeed: number; movementSpeed: number; evasion: number;
  blockRate: number; healingPower: number; hpRecovery: number; staminaMax: number; manaCostReduction: number;
  manaRecovery: number; damageReduction: number; cooldownReduction: number; bossDamage: number; eliteDamage: number;
  skillDamage: number; expGain: number; goldDropRate: number; itemDropRate: number; materialDropRate: number;
};

export type BerserkerFixtureTarget = StunTarget & { id: string; hp: number; maxHP: number; armorBreak: boolean; stunImmune: boolean; stunState?: StunState };

/** Clean development-only specialization fixture. It never imports world.ts or any map/runtime renderer. */
export class BerserkerV3RuntimeFixture {
  readonly hero = { characterId: 'spv3-5-fixture', level: 80, hp: 1000, maxHP: 1000 };
  readonly targets: BerserkerFixtureTarget[] = [];
  readonly transient = new TransientCombatState();
  time = 0;
  trace: Array<Record<string, unknown>> = [];
  private rng = 0;

  private stats(): FixtureStats {
    return { physicalAttack: 199, attack: 199, magicAttack: 0, skillPower: 0, physicalPenetration: 0, magicPenetration: 0, criticalRate: 0, criticalDamage: 150, accuracy: 149, physicalDefense: 75, magicDefense: 75, defense: 75, maxHP: 1000, maxMana: 999, elementalResistance: 0, attackSpeed: 100, movementSpeed: 1, evasion: 0, blockRate: 0, healingPower: 0, hpRecovery: 0, staminaMax: 0, manaCostReduction: 0, manaRecovery: 0, damageReduction: 0, cooldownReduction: 0, bossDamage: 0, eliteDamage: 0, skillDamage: 0, expGain: 0, goldDropRate: 0, itemDropRate: 0, materialDropRate: 0 };
  }

  setTargets(count: number, armorBreak = false, stunImmuneIds: string[] = []) {
    this.targets.length = 0;
    for (let i = 0; i < count; i++) this.targets.push({ id: `target-${i + 1}`, hp: 10000, maxHP: 10000, armorBreak, stunImmune: stunImmuneIds.includes(`target-${i + 1}`) });
  }

  private action(id: string, rank = 1) {
    const definition = id === 'v3-warrior-iron-charge' ? WARRIOR_V3_RUNTIME_MAP[id] : BERSERKER_V3_RUNTIME_MAP[id];
    return resolveSkillAction(definition, { stats: this.stats() as never, rank, masteryPower: 1, masteryCooldown: 1, equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'two_hand_sword', primaryStats: { str: 135, vit: 15, dex: 15, int: 15 } });
  }

  private hit(id: string, rank: number, target: BerserkerFixtureTarget, damageMultiplier = 1) {
    const action = this.action(id, rank);
    const hit = resolveTargetHit(action.hitSequence[0], action.targetModifiers, target, this.time);
    const amount = Math.round(mitigateDamage(skillHitDamage(hit, this.stats()) * damageMultiplier, 0, this.hero.level));
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    return { amount, hpBefore: before, hpAfter: target.hp, hit };
  }

  ironChargeImpact() {
    this.transient.openBreakerEntry(this.time, 4);
    this.trace.push({ stage: 'iron_charge_impact', breakerEntryExpiresAt: this.transient.breakerEntryExpiresAt });
    return { impact: true, breakerEntryActive: this.transient.breakerEntryActive(this.time) };
  }

  breakerEntry(rank = 1) {
    const available = this.transient.breakerEntryActive(this.time);
    if (!available) return { accepted: false, reason: 'NO_BREAKER_ENTRY_WINDOW' };
    const target = this.targets[0] ?? (this.setTargets(1), this.targets[0]);
    const result = this.hit('v3-berserker-breaker-entry', rank, target);
    this.transient.consumeBreakerEntry(this.time);
    return { accepted: true, consumed: !this.transient.breakerEntryActive(this.time), ...result };
  }

  earthSplitter(rank = 1, rng = 0) {
    this.rng = rng;
    const action = this.action('v3-berserker-earth-splitter', rank);
    const cap = action.maxTargets ?? this.targets.length;
    const selected = this.targets.slice(0, cap);
    const results = selected.map((target) => {
      const result = this.hit('v3-berserker-earth-splitter', rank, target);
      const chance = stunChanceForRank(EARTH_SPLITTER_STUN_CHANCE, rank);
      const eligible = this.rng < chance;
      const stunned = eligible && applyStun(target, { sourceActorId: this.hero.characterId, sourceSkillId: action.skillId, chance, pveDuration: 1.5, pvpDuration: .75, targetPolicy: 'NORMAL', now: this.time });
      return { id: target.id, ...result, eligible, stunned, remainingStun: remainingStun(target, this.time), knockback: 0 };
    });
    return { targetCap: cap, actualTargetsHit: selected.length, results };
  }

  furyHarvest(rank = 1) {
    const action = this.action('v3-berserker-fury-harvest', rank);
    const selected = this.targets.slice(0, action.maxTargets ?? this.targets.length);
    const hits = selected.map((target) => this.hit('v3-berserker-fury-harvest', rank, target));
    const heal = Math.round(this.hero.maxHP * FURY_HARVEST_RECOVERY_PERCENT[rank - 1] / 100 * Math.min(5, hits.length));
    this.hero.hp = Math.min(this.hero.maxHP, this.hero.hp + heal);
    return { actualTargetsHit: hits.length, heal, hp: this.hero.hp, hits };
  }

  trance(rank = 1) {
    const duration = [0, 12, 14, 16][rank];
    this.transient.activateBerserkerTrance(this.time, rank, duration);
    const action = this.action('v3-berserker-raging-cleave', 8);
    const bonus = [0, .06, .08, .10][rank];
    const targetCap = (action.maxTargets ?? 0) + 1;
    const selected = this.targets.slice(0, targetCap);
    const hits = selected.map((target) => this.hit('v3-berserker-raging-cleave', 8, target, 1 + bonus));
    if (hits.length >= 3) this.transient.triggerFrenzyGuard(this.time, [0, 4, 5, 6][rank], 2);
    return { duration, finalDamageBonus: bonus, targetCap, actualTargetsHit: hits.length, frenzyGuard: this.transient.frenzyGuard, hits };
  }

  advance(seconds: number) { this.time += seconds; this.transient.updateBerserker(this.time); for (const target of this.targets) if (!isStunned(target, this.time)) delete target.stunState; }
}
