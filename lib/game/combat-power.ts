import {
  activeSkills, calculateFinalCharacterStats, combatProfile, equippedWeaponType,
  getEquippedItems, isSkillUnlocked,
  skillHealingPreview, type DerivedStats, type Hero,
  resolveHeroSkill,
  combatModifiersFor,combatSupportFor,
} from './rules.ts';
import { skillHitDamage, resolvedDamageParts, type ResolvedSkillHit } from './skill-action.ts';
import { canonicalStatus } from './combat-status.ts';
import { targetRequirement } from './targeting.ts';
import {resolveTargetHit,isManualGuarding,type CombatModifier} from './combat-modifiers.ts';
import { itemById } from './items.ts';
import type { MonsterVariant } from './regions.ts';
import { COMBAT_POWER_CONFIG as CONFIG } from './combat-power-config.ts';
import {
  COMBAT_MECHANICS as MECHANICS, barrierAmount, blockChance, criticalChance,
  evasionChance, mitigateDamage, type DamageType,
} from './combat-mechanics.ts';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const positive = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
export type PowerAction = {
  targetModifiers?:CombatModifier[];
  id: string;
  physicalCoefficient: number;
  magicCoefficient: number;
  skillPowerCoefficient: number;
  flat: number;
  damageType: DamageType;
  rate: number;
  manaCost: number;
  critical: boolean;
  attackSpeed: boolean;
  healing: number;
  shield: number;
  poisonDuration: number;
  hits?: ResolvedSkillHit[];
  expectedTargets?: number;
};
export type PowerProfile = {
  level: number;
  actions: PowerAction[];
  targets: Array<{ defense: number; magicDefense: number; variant: MonsterVariant; weight: number }>;
  unsupportedEffects: string[];
};
export type CombatPowerResult = {
  total: number;
  totalCombatPower: number;
  offensivePower: number;
  defensivePower: number;
  sustainPower: number;
  utilityPower: number;
  specialEffectPower: number;
  contributions: ReadonlyArray<{ label: string; value: number }>;
  details: {
    physicalRelevance: number; magicRelevance: number;
    physicalContribution: number; magicContribution: number;
    physicalEHP: number; magicEHP: number; coreDefensiveEHP: number; magicDefenseActive: boolean;
    expectedDPS: number; critContribution: number; speedContribution: number;
    criticalFactor: number; speedFactor: number; accuracyFactor: number;
    dodgeChance: number; expectedBlockReduction: number;
    resourceFactor: number; manaPerSecondDemand: number;
    healingPerSecond: number; shieldPerSecond: number; poisonDPS: number;
    evaluatedSkillIds: string[]; unsupportedEffects: string[];
  };
};

const targetCache = new Map<number, ReadonlyArray<Readonly<PowerProfile['targets'][number]>>>();
/** A stable level-matched benchmark; never reads the mutable world roster. */
export function combatPowerTargets(level: number): PowerProfile['targets'] {
  const cached = targetCache.get(level);
  if (cached) return cached.map(target => ({ ...target }));
  const reference = CONFIG.referenceTarget;
  const normalDefense = Math.max(0, Math.round(reference.normalPhysicalDefenseBase + level * reference.normalPhysicalDefensePerLevel));
  const normalMagicDefense = Math.max(0, Math.round(reference.normalMagicDefenseBase + level * reference.normalMagicDefensePerLevel));
  const targets = (Object.keys(reference.rankMix) as MonsterVariant[]).map(variant => {
    const multiplier = variant === 'boss' ? reference.bossMultiplier : variant === 'elite' ? reference.eliteMultiplier : 1;
    return { variant, weight: reference.rankMix[variant], defense: normalDefense * multiplier, magicDefense: normalMagicDefense * multiplier };
  });
  const stableTargets = Object.freeze(targets.map(target => Object.freeze(target)));
  targetCache.set(level, stableTargets);
  return stableTargets.map(target => ({ ...target }));
}

function hasBasicAttack(hero: Hero) {
  const main = itemById(hero.inventory, hero.equipment.mainHand);
  const bow = main?.equipmentType === 'bow' || main?.attackType === 'ranged';
  return !bow || hero.inventory.some(i => i.templateId === (hero.selectedAmmo ?? 'arrows') && i.quantity > 0);
}

/** Sources only build the real action kit. Numeric bonuses go through final stats. */
export function buildCombatPowerProfile(hero: Hero, stats = calculateFinalCharacterStats(hero)): PowerProfile {
  const actions: PowerAction[] = [];
  const unscoredSkillEffects:string[]=[];
  for(const mod of combatModifiersFor(hero))if(mod.condition||mod.incoming)unscoredSkillEffects.push(`${mod.id}: conditional/defensive modifier uptime not evaluated`);
  const support=combatSupportFor(hero);
  for(const def of [...(support.stacks??[]),...(support.windows??[])])unscoredSkillEffects.push(`${def.id}: transient trigger uptime not evaluated`);
  if (hasBasicAttack(hero)) {
    const cycle = 3 * combatProfile(hero).cooldown + MECHANICS.comboFinisherDelay;
    for (const [index, coefficient] of [1, 1, MECHANICS.comboFinisherDamage].entries()) {
      actions.push({ id: `basic-${index + 1}`, physicalCoefficient: coefficient,
        magicCoefficient: 0, skillPowerCoefficient: 0, flat: 0, damageType: 'physical', rate: 1 / cycle,
        manaCost: 0, critical: true, attackSpeed: true, healing: 0, shield: 0, poisonDuration: 0 });
    }
  }
  for (const skill of activeSkills(hero)) {
    const action=resolveHeroSkill(hero,skill,hero.skillLevels[skill.id],stats);
    if (!isSkillUnlocked(hero, skill) || !action.weaponAllowed) continue;
    const manaCost = action.manaCost;
    if (manaCost > stats.maxMana) continue;
    if(action.effect==='parry')unscoredSkillEffects.push(`${skill.id}: parry timing/uptime`);
    if(action.counterPolicy||action.modifiers?.some(m=>m.condition)||action.temporaryBuffs?.length)unscoredSkillEffects.push(`${skill.id}: conditional/buff uptime not evaluated`);
    for(const status of action.hitSequence.flatMap(hit=>hit.statuses)){
      if(canonicalStatus(status.id)!=='defenseDown')unscoredSkillEffects.push(`${skill.id}: status ${status.id}`);
    }
    const parts = resolvedDamageParts(action);
    const selfOnly=targetRequirement(action)==='self'||action.personalMark===true;
    if(action.personalMark)unscoredSkillEffects.push(`${skill.id}: personal Mark condition uptime not evaluated`);
    if(action.directionalMovement)unscoredSkillEffects.push(`${skill.id}: directional movement utility not rated`);
    const actionLock=hero.progressionArchitecture==='v2_test'?(action.actionLockDuration??0):0;
    if(actionLock>0)unscoredSkillEffects.push(`${skill.id}: action-lock limits this cast rate; shared rotation occupancy not simulated`);
    actions.push({ id: skill.id, ...parts,
      ...(selfOnly?{physicalCoefficient:0,magicCoefficient:0,skillPowerCoefficient:0,flat:0}:{}),
      hits: selfOnly?[]:action.hitSequence,
      targetModifiers:action.targetModifiers,
      expectedTargets: action.targetType==='frontal_arc' ? Math.min(action.maxTargets??Infinity,CONFIG.frontalArcExpectedTargets) : 1,
      rate: 1 / Math.max(CONFIG.minimumCooldown, action.cooldown, actionLock),
      manaCost, critical: false, attackSpeed: false,
      // Global self semantics have no enemy recipient; do not rate phantom hits.
      healing: skill.effect === 'heal' ? skillHealingPreview(hero, skill) : 0,
      shield: skill.effect === 'barrier' ? barrierAmount(stats.maxHP) : 0,
      poisonDuration: skill.effect === 'poison' || skill.statusEffect === 'poison' ? action.duration + 3 : Math.max(0,...action.hitSequence.flatMap(h=>h.statuses.filter(s=>s.id==='poison').map(s=>s.duration))),
    });
  }
  const unsupportedEffects = getEquippedItems(hero).flatMap(item => [
    item.uniqueEffect,
    ...item.sockets.map(socket => socket.rune?.uniqueEffect),
  ]).filter((effect): effect is string => !!effect);
  return { level: hero.level, actions, targets: combatPowerTargets(hero.level), unsupportedEffects: [...new Set([...unsupportedEffects,...unscoredSkillEffects])] };
}

/** Only metadata backed by a runtime effect evaluator may enter this channel.
 * No production item proc registry exists yet: descriptive strings are NOT ratings.
 * The adapter passes an empty array until a live effect supplies measured value.
 */
export function evaluateSpecialEffectPower(evaluated: readonly { id: string; power: number }[], corePower: number) {
  const unique = new Map(evaluated.map(effect => [effect.id, positive(effect.power)]));
  return Math.min([...unique.values()].reduce((sum, value) => sum + value, 0), positive(corePower) * CONFIG.specialCoreCap);
}

/** Pure: final effective stats -> expected combat values -> CP. Never changes a Hero. */
export function calculateCombatPowerFromStats(stats: DerivedStats, profile: PowerProfile): CombatPowerResult {
  const speedFactor = clamp(1 + CONFIG.attackSpeed.coefficient * (stats.attackSpeed / 100 - 1), CONFIG.attackSpeed.min, CONFIG.attackSpeed.max);
  const crit = clamp(criticalChance(stats.criticalRate), 0, 1);
  const criticalFactor = 1 + crit * (stats.criticalDamage / 100 - 1);
  const demand = profile.actions.reduce((sum, a) => sum + positive(a.manaCost) * positive(a.rate), 0);
  const manaBudget = positive(stats.maxMana) / CONFIG.encounterSeconds + positive(stats.manaRecovery);
  const targetDamage = (damage: number, type: DamageType, defenseMultiplier=1) => profile.targets.reduce((sum, t) => {
    const bonus = t.variant === 'boss' ? stats.bossDamage : t.variant === 'elite' ? stats.eliteDamage : 0;
    const defense = type === 'physical' ? t.defense : t.magicDefense;
    const penetration = type === 'physical' ? stats.physicalPenetration : stats.magicPenetration;
    return sum + t.weight * mitigateDamage(damage * (1 + bonus / 100), defense*defenseMultiplier, profile.level, penetration);
  }, 0);
  // Allocate the shared mana budget to effective casts, within actual cooldown
  // limits. Learning an inefficient spell must not lower character strength by
  // forcing it into the rotation. This benchmark never changes player hotbars.
  const rates = new Map<PowerAction, number>();
  // Round, crit and mitigate each actual hit before summing; casts still pay mana once.
  const actionDamage = (a:PowerAction, withCritical=true) => {
    let armorBreakUntil=-1;
    return a.hits ? a.hits.reduce((sum,snapshotHit)=>{
        const hit=resolveTargetHit(snapshotHit,a.targetModifiers??[],{statusEffects:{defenseDown:snapshotHit.delay<armorBreakUntil?armorBreakUntil-snapshotHit.delay:0}});
        const raw=positive(skillHitDamage(hit,stats));
        const hitCrit=criticalChance(hit.criticalRate);
        const defenseMultiplier=hit.delay<armorBreakUntil?MECHANICS.armorBreakDefenseMultiplier:1;
        const damage=withCritical&&hit.canCrit
          ? (1-hitCrit)*targetDamage(Math.round(raw),hit.damageType,defenseMultiplier)+hitCrit*targetDamage(Math.round(raw*hit.criticalDamage/100),hit.damageType,defenseMultiplier)
          : targetDamage(Math.round(raw),hit.damageType,defenseMultiplier);
        for(const status of hit.statuses)if(canonicalStatus(status.id)==='defenseDown')armorBreakUntil=Math.max(armorBreakUntil,hit.delay+status.duration);
        return sum+damage;
      },0)*(a.expectedTargets??1)
    : targetDamage(withCritical&&a.critical
        ? (1-crit)*Math.round(positive(a.flat+a.physicalCoefficient*stats.physicalAttack+a.magicCoefficient*stats.magicAttack+a.skillPowerCoefficient*stats.skillPower))+crit*Math.round(positive(a.flat+a.physicalCoefficient*stats.physicalAttack+a.magicCoefficient*stats.magicAttack+a.skillPowerCoefficient*stats.skillPower)*stats.criticalDamage/100)
        : Math.round(positive(a.flat+a.physicalCoefficient*stats.physicalAttack+a.magicCoefficient*stats.magicAttack+a.skillPowerCoefficient*stats.skillPower)),a.damageType);
  };
  let remainingMana = manaBudget;
  const efficiency = (a: PowerAction) => (
    actionDamage(a,false) * CONFIG.offensiveWeight +
    (positive(a.healing) + positive(a.shield)) * CONFIG.sustainPerSecondWeight
  ) / Math.max(1, a.manaCost);
  for (const a of [...profile.actions].sort((a, b) => efficiency(b) - efficiency(a) || a.id.localeCompare(b.id))) {
    const frequency = a.manaCost > 0 ? Math.min(positive(a.rate), remainingMana / a.manaCost) : positive(a.rate);
    rates.set(a, frequency);
    remainingMana = Math.max(0, remainingMana - frequency * positive(a.manaCost));
  }
  const resourceFactor = demand ? Math.min(1, (manaBudget - remainingMana) / demand) : 1;
  const rate = (a: PowerAction) => rates.get(a) ?? 0;
  let physicalDPS = 0, magicDPS = 0, physicalCoefficient = 0, magicCoefficient = 0;
  let critDPS = 0, speedDPS = 0, healingPerSecond = 0, shieldPerSecond = 0, poisonUptime = 0;
  for (const a of profile.actions) {
    const baseDPS = actionDamage(a) * rate(a);
    const dps = baseDPS * (a.attackSpeed ? speedFactor : 1);
    if (a.damageType === 'physical') physicalDPS += dps; else magicDPS += dps;
    const relevanceRate = rate(a) * (a.attackSpeed ? speedFactor : 1) * (a.critical ? criticalFactor : 1);
    physicalCoefficient += positive(a.physicalCoefficient) * relevanceRate;
    magicCoefficient += positive(a.magicCoefficient) * relevanceRate;
    if (a.critical||a.hits?.some(hit=>hit.canCrit)) critDPS += (actionDamage(a)-actionDamage(a,false))*rate(a)*(a.attackSpeed?speedFactor:1);
    if (a.attackSpeed) speedDPS += baseDPS * (speedFactor - 1);
    healingPerSecond += positive(a.healing) * rate(a);
    shieldPerSecond += positive(a.shield) * rate(a);
    poisonUptime += positive(a.poisonDuration) * rate(a);
  }
  // The world has a single non-stacking poison timer per target.
  const poisonRate = Math.min(1, poisonUptime) / MECHANICS.poisonInterval;
  const poisonDPS = targetDamage(Math.max(MECHANICS.poisonMinimumDamage, stats.physicalAttack * MECHANICS.poisonAttackCoefficient), 'physical') * poisonRate;
  physicalDPS += poisonDPS;
  physicalCoefficient += MECHANICS.poisonAttackCoefficient * poisonRate;
  const coefficientTotal = physicalCoefficient + magicCoefficient;
  const physicalRelevance = coefficientTotal ? physicalCoefficient / coefficientTotal : 1;
  const dodge = clamp(evasionChance(stats.evasion), 0, 1);
  const expectedBlockReduction = clamp(blockChance(stats.blockRate), 0, 1) * MECHANICS.blockDamageReduction;
  const incoming = (defense: number) => {
    // Derived data can be edited/imported externally. Keep CP finite even when
    // a malformed defense value reaches the pure calculator.
    const safeDefense = Number.isNaN(defense) || defense === Number.NEGATIVE_INFINITY
      ? 0 : defense === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : defense;
    const mitigated = mitigateDamage(1, safeDefense, profile.level);
    const rawIncoming = Number.isFinite(mitigated) ? mitigated : 1;
    return Math.max(CONFIG.minimumIncomingMultiplier,
      rawIncoming * (1 - clamp(stats.damageReduction / 100, 0, 1)) * (1 - dodge) * (1 - expectedBlockReduction));
  };
  const physicalEHP = positive(stats.maxHP) / incoming(stats.physicalDefense);
  const magicEHP = positive(stats.maxHP) / incoming(stats.magicDefense);
  const offensivePower = positive((physicalDPS + magicDPS) * CONFIG.offensiveWeight);
  const coreDefensiveEHP = Math.sqrt(physicalEHP * magicEHP);
  const defensivePower = CONFIG.defensiveScale * coreDefensiveEHP;
  // MP, MP regen, mana-cost reduction and CDR already affect frequency above.
  // Do not award them a second raw-stat sustain/utility bonus.
  const sustainPower = (healingPerSecond + shieldPerSecond) * CONFIG.sustainPerSecondWeight;
  const core = offensivePower + defensivePower + sustainPower;
  const utilityPower = Math.min(positive(stats.movementSpeed - 100) * CONFIG.moveSpeedWeight, core * CONFIG.utilityCoreCap);
  const specialEffectPower = evaluateSpecialEffectPower([], core + utilityPower);
  const components = [offensivePower, defensivePower, sustainPower, utilityPower, specialEffectPower];
  const total = Math.round(CONFIG.displayScale * components.reduce((sum, value) => sum + value, 0));
  const displayed = components.map(value => Math.round(value * CONFIG.displayScale));
  // Tooltip integer rows reconcile exactly with the rounded header total.
  const largest = components.indexOf(Math.max(...components));
  displayed[largest] += total - displayed.reduce((sum, value) => sum + value, 0);
  return {
    total, totalCombatPower: total, offensivePower, defensivePower, sustainPower, utilityPower, specialEffectPower,
    contributions: ['Offensive Power', 'Defensive Power', 'Sustain Power', 'Utility Power', 'Special Effects'].map((label, i) => ({ label, value: displayed[i] })),
    details: { physicalRelevance, magicRelevance: 1 - physicalRelevance,
      physicalContribution: physicalDPS * CONFIG.offensiveWeight, magicContribution: magicDPS * CONFIG.offensiveWeight,
      physicalEHP, magicEHP, coreDefensiveEHP, magicDefenseActive: true,
      expectedDPS: physicalDPS + magicDPS, critContribution: critDPS * CONFIG.offensiveWeight,
      speedContribution: speedDPS * CONFIG.offensiveWeight, criticalFactor, speedFactor, accuracyFactor: 1,
      dodgeChance: dodge, expectedBlockReduction, resourceFactor, manaPerSecondDemand: demand,
      healingPerSecond, shieldPerSecond, poisonDPS,
      evaluatedSkillIds: profile.actions.filter(a => !a.id.startsWith('basic-')).map(a => a.id),
      unsupportedEffects: [...profile.unsupportedEffects],
    },
  };
}

export function calculateCombatPower(hero: Hero) {
  const stats = calculateFinalCharacterStats(hero);
  return calculateCombatPowerFromStats(stats, buildCombatPowerProfile(hero, stats));
}

const cache = new Map<string, CombatPowerResult>();
/** Content key also catches in-place world mutations. HP included only for conditional modifiers; excludes MP ticks,
 * position, cooldown remaining, playtime, un-equipped loot, and save timestamps. */
function dependencyKey(hero: Hero) {
  const modifiers=combatModifiersFor(hero);
  const conditionalHP=[...modifiers,...activeSkills(hero).flatMap(skill=>skill.modifiers??[])].some(m=>m.condition?.hpAtOrBelow!==undefined);
  return JSON.stringify([CONFIG.version, hero.progressionArchitecture, hero.level, hero.job, hero.coreJob, hero.specialization,
    modifiers,conditionalHP?hero.hp:undefined,isManualGuarding(hero),
    hero.weapon, hero.allocatedStats, hero.skillLevels, hero.masteryChoices, hero.passiveLevels,
    hero.masteryQuestClaimed, (hero.activeBuffs.damageReduction ?? 0) > 0, hasBasicAttack(hero),
    equippedWeaponType(hero), hero.pet?.bonusStats,
    getEquippedItems(hero).map(item => [item.id, item.baseStats, item.bonusStats, item.uniqueStatsLocked,
      item.enhancementLevel, item.skillModifiers, item.uniqueEffect, item.sockets]),
  ]);
}
export const clearCombatPowerCache = () => cache.clear();
export function getCombatPower(hero: Hero): CombatPowerResult {
  const key = dependencyKey(hero), cached = cache.get(key);
  if (cached) return cached;
  const result = calculateCombatPower(hero);
  // Protect cached readings from an accidental caller mutation.
  Object.freeze(result.details.evaluatedSkillIds); Object.freeze(result.details.unsupportedEffects);
  Object.freeze(result.details); result.contributions.forEach(Object.freeze); Object.freeze(result.contributions); Object.freeze(result);
  if (cache.size >= CONFIG.cacheEntries) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  if (CONFIG.debug) console.debug(formatCombatPowerDebug(result));
  return result;
}
export function previewStatCombatPower(hero: Hero, allocation: Partial<Hero['allocatedStats']>) {
  const previewHero = { ...hero, allocatedStats: { ...hero.allocatedStats, ...allocation } };
  const before = getCombatPower(hero), after = getCombatPower(previewHero);
  return { before, after, delta: after.total - before.total };
}
export function formatCombatPowerDebug(result: CombatPowerResult) {
  return JSON.stringify({ combatPower: result.total, offensive: result.offensivePower,
    defensive: result.defensivePower, sustain: result.sustainPower, utility: result.utilityPower,
    special: result.specialEffectPower, ...result.details }, null, 2);
}
