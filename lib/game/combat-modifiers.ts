import type { DerivedStats } from './rules.ts';
import type { WeaponType } from './skills.ts';
import type { TreeScope } from './rank-ownership.ts';
import type { ResolvedSkillAction, ResolvedSkillHit } from './skill-action.ts';
import { hasActiveStatusFromSource, hasStatus, type StatusTarget } from './combat-status.ts';
import {relativePosition,type PositionContext,type PositionRelation,type PositionAngles} from './combat-position.ts';
import {markedBySelf,type MarkSource} from './personal-mark.ts';

export type CounterContext = Readonly<{
  result: 'none' | 'blocked' | 'parried';
  timestamp?: number;
  sourceId?: string;
}>;
export const NO_COUNTER: CounterContext = Object.freeze({ result: 'none' });
export type ModifierStat =
  | 'physicalAttack'
  | 'magicAttack'
  | 'physicalDefense'
  | 'magicDefense'
  | 'maxHP'
  | 'maxMana'
  | 'accuracy'
  | 'criticalRate'
  | 'criticalDamage'
  | 'attackSpeed'
  | 'movementSpeed'
  | 'skillPower'
  | 'healingPower'
  | 'hpRecovery'
  | 'manaRecovery'
  | 'blockRate'
  | 'evasion'
  | 'damageReduction';
export type CombatModifier = {
  id: string;
  /** Normal V2 bonuses add; explicit payoff bonuses multiply total raw damage. */
  layer?: 'normal' | 'payoff';
  /** Same named payoff adds before multiplying; separate groups still multiply. */
  payoffGroup?: string;
  stage?: 'passive' | 'weapon' | 'temporary' | 'context';
  /** Target/stealth predicates default to per-impact evaluation; cast is explicitly frozen. */
  conditionTiming?: 'cast' | 'impact';
  selector?: { tags?: string[]; tree?: TreeScope; weaponStyles?: WeaponType[] };
  condition?: {
    hpAtOrBelow?: number;
    /** Opt-in: include unconditional Max HP bonuses; legacy predicates keep baseline semantics. */
    hpThresholdBasis?: 'unconditional_final';
    counter?: Array<'blocked' | 'parried'>;
    targetStatuses?: string[];
    targetStatusesFromSource?: string[];
    guardingOrBuff?: string;
    attackerStealthed?: boolean;
    targetPosition?: PositionRelation;
    markedBySelf?: boolean;
    positionAngles?: PositionAngles;
  };
  stats?: {
    flat?: Partial<Record<ModifierStat, number>>;
    percent?: Partial<Record<ModifierStat, number>>;
  };
  action?: {
    damagePercent?: number;
    knockbackPercent?: number;
    cooldownPercent?: number;
    manaPercent?: number;
    /** Action-local percentage points, not a second global stat contribution. */
    criticalRateBonus?: number;
    criticalDamageBonus?: number;
    accuracyBonus?: number;
    durationPercent?: number;
    durationBonus?: number;
    statusDurationBonus?: number;
    movementDistanceBonus?: number;
  };
  incoming?: {
    damageMultiplier?: number;
    knockbackMultiplier?: number;
  };
};
export type TimedCombatModifier = {
  modifier: CombatModifier;
  remaining: number;
};
export type ModifierHost = {
  /** Transient context only; copied into stat/equipment previews, stripped on save. */
  manualGuardActive?: boolean;
  temporaryModifiers?: TimedCombatModifier[];
  combatStateModifiers?: CombatModifier[];
};
export type ModifierContext = {
  impact?: ImpactContext;
  manualGuard?: boolean;
  activeModifierIds?: string[];
  weaponStyle: WeaponType;
  hp: number;
  maxHP: number;
  counter?: CounterContext;
};
export type ImpactContext = { source?: MarkSource; attackerStealthed?: boolean; position?: PositionContext; target?: StatusTarget; now?:number };
const hasImpactCondition = (mod:CombatModifier) => !!(mod.condition?.markedBySelf!==undefined || mod.condition?.targetStatuses?.length || mod.condition?.targetStatusesFromSource?.length || mod.condition?.attackerStealthed!==undefined || mod.condition?.targetPosition);
function impactMatches(mod:CombatModifier,ctx:ImpactContext) {
  const c=mod.condition;
  return (!c?.targetStatuses?.length || !!ctx.target&&c.targetStatuses.every(id=>hasStatus(ctx.target!,id))) &&
    (!c?.targetStatusesFromSource?.length || !!ctx.target&&!!ctx.source?.sourceActorId&&ctx.now!==undefined&&c.targetStatusesFromSource.every(id=>hasActiveStatusFromSource(ctx.target!,id,ctx.source!.sourceActorId,ctx.now))) &&
    (c?.markedBySelf===undefined || !!ctx.target&&!!ctx.source&&markedBySelf(ctx.target,ctx.source)===c.markedBySelf) &&
    (c?.attackerStealthed===undefined || ctx.attackerStealthed===c.attackerStealthed) &&
    (!c?.targetPosition || !!ctx.position&&relativePosition(ctx.position,c.positionAngles)===c.targetPosition);
}
export function setManualGuard(host: ModifierHost, active: boolean) {
  if (active) host.manualGuardActive = true;
  else delete host.manualGuardActive;
}
export const isManualGuarding = (host: ModifierHost) =>
  host.manualGuardActive === true;
const finite = (n: number | undefined) => (Number.isFinite(n) ? n! : 0);
const stages = { passive: 0, weapon: 1, temporary: 2, context: 3 };
export const orderedModifiers = (mods: readonly CombatModifier[]) =>
  [...mods].sort(
    (a, b) => stages[a.stage ?? 'passive'] - stages[b.stage ?? 'passive'],
  );
export function modifierMatches(
  mod: CombatModifier,
  ctx: ModifierContext,
  action?: { tags?: string[]; tree?: TreeScope },
) {
  const s = mod.selector,
    c = mod.condition;
  if (
    c?.guardingOrBuff &&
    !ctx.manualGuard &&
    !ctx.activeModifierIds?.includes(c.guardingOrBuff)
  )
    return false;
  if (s?.weaponStyles && !s.weaponStyles.includes(ctx.weaponStyle))
    return false;
  if (s?.tags && !s.tags.every((tag) => action?.tags?.includes(tag)))
    return false;
  if (
    s?.tree &&
    (action?.tree?.id !== s.tree.id ||
      action.tree.architecture !== s.tree.architecture)
  )
    return false;
  if (
    c?.hpAtOrBelow !== undefined &&
    (!(ctx.maxHP > 0) || ctx.hp / ctx.maxHP > c.hpAtOrBelow)
  )
    return false;
  if (c?.counter && !c.counter.some((result) => result === ctx.counter?.result))
    return false;
  return true;
}
export function addTemporaryModifier(
  host: ModifierHost,
  modifier: CombatModifier,
  duration: number,
) {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  const entry = {
    modifier: { ...structuredClone(modifier), stage: 'temporary' as const },
    remaining: duration,
  };
  host.temporaryModifiers = [
    ...(host.temporaryModifiers ?? []).filter(
      (e) => e.modifier.id !== modifier.id,
    ),
    entry,
  ];
  return true;
}
export function tickTemporaryModifiers(host: ModifierHost, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (host.temporaryModifiers)
    host.temporaryModifiers = host.temporaryModifiers
      .map((e) => ({ ...e, remaining: e.remaining - dt }))
      .filter((e) => e.remaining > 0);
}
export function hostModifiers(host: ModifierHost): CombatModifier[] {
  return [
    ...(host.temporaryModifiers ?? [])
      .filter((e) => e.remaining > 0)
      .map((e) => e.modifier),
    ...(host.combatStateModifiers ?? []),
  ];
}
/** Secondary-stat extension on the existing calculator, not a second stat formula.
 * HP predicates use baseline resolved maxHP, avoiding recursive/circular evaluation. */
export function applyStatModifiers(
  stats: DerivedStats,
  mods: readonly CombatModifier[],
  ctx: ModifierContext,
): DerivedStats {
  const result = { ...stats };
  const ordered = orderedModifiers(mods);
  let thresholdMaxHP = stats.maxHP;
  if (ordered.some(m => m.condition?.hpThresholdBasis === 'unconditional_final')) {
    for (const mod of ordered) {
      if (!mod.stats || mod.condition?.hpAtOrBelow !== undefined || hasImpactCondition(mod) || !modifierMatches(mod, ctx)) continue;
      thresholdMaxHP = Math.max(1, (thresholdMaxHP + finite(mod.stats.flat?.maxHP)) * (1 + Math.max(-100, finite(mod.stats.percent?.maxHP)) / 100));
    }
  }
  for (const mod of ordered) {
    if (
      !mod.stats ||
      hasImpactCondition(mod) ||
      !modifierMatches(mod, mod.condition?.hpThresholdBasis === 'unconditional_final' ? {...ctx, maxHP:thresholdMaxHP} : ctx)
    )
      continue;
    const keys = new Set([
      ...Object.keys(mod.stats.flat ?? {}),
      ...Object.keys(mod.stats.percent ?? {}),
    ] as ModifierStat[]);
    for (const key of keys)
      result[key] = Math.max(
        0,
        (result[key] + finite(mod.stats.flat?.[key])) *
          (1 + Math.max(-100, finite(mod.stats.percent?.[key])) / 100),
      );
  }
  result.criticalRate = Math.min(100, result.criticalRate);
  result.blockRate = Math.min(100, result.blockRate);
  result.maxHP = Math.max(1, result.maxHP);
  result.maxMana = Math.max(1, result.maxMana);
  result.damageReduction = Math.min(99.99, result.damageReduction);
  result.attack = result.physicalAttack;
  result.defense = result.physicalDefense;
  return result;
}
function modifiedHit(
  hit: ResolvedSkillHit,
  mod: CombatModifier,
): ResolvedSkillHit {
  const a = mod.action;
  const factor = (n: number | undefined) => Math.max(0, 1 + finite(n) / 100);
  return {
    ...hit,
    criticalRate: Math.min(100,Math.max(0,hit.criticalRate+finite(a?.criticalRateBonus))),
    criticalDamage: Math.max(0,hit.criticalDamage+finite(a?.criticalDamageBonus)),
    accuracy: Math.max(0,hit.accuracy+finite(a?.accuracyBonus)),
    damageMultiplier: hit.damageMultiplier * factor(a?.damagePercent),
    knockbackStrength: hit.knockbackStrength * factor(a?.knockbackPercent),
  };
}
type HitValues = {
  damageMultiplier: number;
  knockbackStrength: number;
};
export type ScopedHitComposition = {
  base: HitValues;
  normal: HitValues;
  payoff: HitValues;
  groups?: Record<string, HitValues>;
};
function scopedHit(
  hit: ResolvedSkillHit,
  mods: readonly CombatModifier[],
): ResolvedSkillHit {
  const composition: ScopedHitComposition = structuredClone(
    hit.scopedComposition ?? {
      base: {
        damageMultiplier: hit.damageMultiplier,
        knockbackStrength: hit.knockbackStrength,
      },
      normal: { damageMultiplier: 0, knockbackStrength: 0 },
      payoff: { damageMultiplier: 1, knockbackStrength: 1 },
    },
  );
  for (const mod of mods)
    for (const [key, property] of [
      ['damageMultiplier', 'damagePercent'],
      ['knockbackStrength', 'knockbackPercent'],
    ] as const) {
      const bonus = finite(mod.action?.[property]) / 100;
      if (mod.layer === 'payoff' && mod.payoffGroup) {
        composition.groups ??= {};
        const group = (composition.groups[mod.payoffGroup] ??= {
          damageMultiplier: 0,
          knockbackStrength: 0,
        });
        group[key] += bonus;
      } else if (mod.layer === 'payoff')
        composition.payoff[key] *= Math.max(0, 1 + bonus);
      else composition.normal[key] += bonus;
    }
  const result = { ...hit, scopedComposition: composition,
    criticalRate:Math.min(100,Math.max(0,hit.criticalRate+mods.reduce((s,m)=>s+finite(m.action?.criticalRateBonus),0))),
    criticalDamage:Math.max(0,hit.criticalDamage+mods.reduce((s,m)=>s+finite(m.action?.criticalDamageBonus),0)),
    accuracy:Math.max(0,hit.accuracy+mods.reduce((s,m)=>s+finite(m.action?.accuracyBonus),0)),
  };
  for (const key of [
    'damageMultiplier',
    'knockbackStrength',
  ] as const)
    result[key] =
      composition.base[key] *
      Math.max(0, 1 + composition.normal[key]) *
      composition.payoff[key] *
      Object.values(composition.groups ?? {}).reduce(
        (factor, g) => factor * Math.max(0, 1 + g[key]),
        1,
      );
  return result;
}
export function applyActionModifiers(
  action: ResolvedSkillAction,
  mods: readonly CombatModifier[],
  ctx: ModifierContext,
): ResolvedSkillAction {
  const result = structuredClone(action);
  result.targetModifiers = [];
  result.counterContext = Object.freeze({ ...action.counterContext });
  const immediate: CombatModifier[] = [];
  for (const mod of orderedModifiers(mods)) {
    if (!mod.action || !modifierMatches(mod, ctx, result)) continue;
    if (hasImpactCondition(mod)) {
      if(mod.conditionTiming!=='cast') {
        result.targetModifiers.push(structuredClone(mod));
        continue;
      }
      if(!impactMatches(mod,ctx.impact??{}))continue;
    }
    if (result.modifierComposition === 'scoped_additive') {
      immediate.push(mod);
      continue;
    }
    result.hitSequence = result.hitSequence.map((hit) => modifiedHit(hit, mod));
    result.cooldown *= Math.max(
      0,
      1 + finite(mod.action.cooldownPercent) / 100,
    );
    result.manaCost = Math.max(
      0,
      Math.ceil(
        result.manaCost * Math.max(0, 1 + finite(mod.action.manaPercent) / 100),
      ),
    );
  }
  if (result.modifierComposition === 'scoped_additive') {
    result.hitSequence = result.hitSequence.map((hit) =>
      scopedHit(hit, immediate),
    );
    for (const [key, property] of [
      ['cooldown', 'cooldownPercent'],
      ['manaCost', 'manaPercent'],
    ] as const) {
      const normal = immediate
        .filter((m) => m.layer !== 'payoff')
        .reduce((sum, m) => sum + finite(m.action?.[property]) / 100, 0);
      const payoff = immediate
        .filter((m) => m.layer === 'payoff')
        .reduce(
          (product, m) =>
            product * Math.max(0, 1 + finite(m.action?.[property]) / 100),
          1,
        );
      result[key] *= Math.max(0, 1 + normal) * payoff;
    }
    result.manaCost = Math.ceil(result.manaCost);
    result.duration=Math.max(0,result.duration*(1+immediate.reduce((s,m)=>s+finite(m.action?.durationPercent),0)/100)+immediate.reduce((s,m)=>s+finite(m.action?.durationBonus),0));
    result.movementDistance=Math.max(0,(result.movementDistance??0)+immediate.reduce((s,m)=>s+finite(m.action?.movementDistanceBonus),0));
    const statusBonus=immediate.reduce((s,m)=>s+finite(m.action?.statusDurationBonus),0);
    if(statusBonus)result.hitSequence=result.hitSequence.map(hit=>({...hit,statuses:hit.statuses.map(status=>({...status,duration:Math.max(0,status.duration+statusBonus)}))}));
  }
  return result;
}
/** Called at actual impact (and by CP for explicitly modeled target statuses). */
export function resolveTargetHit(
  hit: ResolvedSkillHit,
  mods: readonly CombatModifier[],
  target: StatusTarget,
  now?: number,
  context: ImpactContext = {},
): ResolvedSkillHit {
  let result = { ...hit };
  const eligible = mods.filter(mod=>impactMatches(mod,{...context,target,now}));
  if (hit.scopedComposition) return scopedHit(hit, eligible);
  for (const mod of eligible) result = modifiedHit(result, mod);
  return result;
}
/** Same reduction group: stronger of existing defense and added buff wins; buffs do
 * not multiply manual guard/block/DR toward immunity. Positive floor is a safety invariant. */
export function receivedMultiplier(
  mods: readonly CombatModifier[],
  ctx: ModifierContext,
  key: 'damageMultiplier' | 'knockbackMultiplier',
  existing = 1,
) {
  let value = existing;
  for (const mod of mods)
    if (
      !hasImpactCondition(mod) &&
      modifierMatches(mod, ctx) &&
      Number.isFinite(mod.incoming?.[key])
    )
      value = Math.min(value, Math.max(0.0001, mod.incoming![key]!));
  return value;
}
