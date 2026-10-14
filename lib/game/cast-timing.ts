import { STAT_TUNING } from './canonical-config.ts';
export type CastTiming = { vct: number; fct: number; chargeTime: number };
export type CastReductionSources = Readonly<{ castStat?: number; variablePercent?: number; fixedPercent?: number; statVariablePercent?: number }>;
/** Shared execution/presentation math. Explicit percentages are points; neither
 * primary nor VCT modifies fixed casting, charge, action lock or metadata. */
export function resolveCastReductions(reduction: CastReductionSources = {}) {
  const value = (n = 0) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const statPercent = Math.min(STAT_TUNING.vctStatReductionCap,
    value(reduction.castStat) * STAT_TUNING.castStatToVct + value(reduction.statVariablePercent));
  return Object.freeze({statPercent,
    variablePercent:Math.min(STAT_TUNING.vctReductionCap,statPercent+value(reduction.variablePercent)),
    fixedPercent:Math.min(STAT_TUNING.fctReductionCap,value(reduction.fixedPercent))});
}
export function resolveCastTiming(timing: Partial<CastTiming> = {}, cooldown = 0, cdr = 0, reduction: CastReductionSources = {}) {
  const value = (n = 0) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const {variablePercent:variable,fixedPercent:fixed} = resolveCastReductions(reduction);
  const vct = value(timing.vct)*(1-variable/100), fct = value(timing.fct)*(1-fixed/100), chargeTime = value(timing.chargeTime);
  return { vct, fct, chargeTime, castDelay: vct + fct + chargeTime,
    cooldown: value(cooldown) * (1 - Math.min(STAT_TUNING.cdrCap, value(cdr)) / 100) };
}
