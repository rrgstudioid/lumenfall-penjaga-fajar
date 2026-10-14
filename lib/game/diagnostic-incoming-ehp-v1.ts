import { mitigateDamage } from './combat-mechanics.ts';
import { basePhysicalAttackForLevel } from './rules.ts';
import { BASIC_REFERENCE_B } from './basic-attack-reference-v2.ts';

/** CP-only OWNER ACC. This is not the live hurtHero Block policy. */
export const PACKAGE_B_POLICY = Object.freeze({
  version: 'CP_PACKAGE_B_DIAGNOSTIC_V1', incoming: 'FRACTIONAL_INCOMING_CURRENT_V1',
  bank: 'B_INCOMING_TRAINING_SCALE_CANDIDATE_1', scenario: 'B_SUSTAIN_LANDED_30S_CANDIDATE_1',
  source: 'CP_PACKAGE_B_DIAGNOSTIC_OWNER_ACC.txt', chanceCap: .6, efficiency: .3,
  evasionCap: .5, horizon: 30, firstPacket: 1, lastPacket: 29,
});
const fail = (code: string, path: string) => Object.freeze({ ok: false as const, code, path, value: null });
export type IncomingEHPInput = Readonly<{
  kind: 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY'; source: string; level: number; maxHP: number;
  physicalDefense: number; magicDefense: number; evasion: number; damageReduction: number;
  block: Readonly<{ source: 'NONE' | 'MECHANICAL_EXPLICIT'; chancePercent: number; efficiencyBonus: 0 }>;
}>;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function data(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(d).length === keys.length && keys.every(k => d[k] && Object.hasOwn(d[k], 'value'));
}
/** Mechanical source validation is arithmetic only, never item enrollment. */
export function diagnosticBlock(block: IncomingEHPInput['block'], channel: 'physical'|'magic',
  delivery: 'direct'|'periodic', blockable: boolean) {
  if (!data(block, ['source','chancePercent','efficiencyBonus']) ||
      !['NONE','MECHANICAL_EXPLICIT'].includes(block.source) || !finite(block.chancePercent) ||
      block.efficiencyBonus !== 0 || block.source === 'NONE' && block.chancePercent !== 0)
    return fail('UNPROVEN_BLOCK_SOURCE', 'block');
  if (!['physical','magic'].includes(channel) || !['direct','periodic'].includes(delivery) || typeof blockable !== 'boolean')
    return fail('UNSUPPORTED_CHANNEL', 'block');
  const eligible = channel === 'physical' && delivery === 'direct' && blockable;
  return Object.freeze({ ok: true as const, value: Object.freeze({ eligible,
    chance: eligible ? Math.min(PACKAGE_B_POLICY.chanceCap, block.chancePercent / 100) : 0,
    efficiency: PACKAGE_B_POLICY.efficiency, authority: 'MATHEMATICAL_ONLY' }) });
}
export function evaluatePassiveEHP(input: IncomingEHPInput) {
  if (!data(input, ['kind','source','level','maxHP','physicalDefense','magicDefense','evasion','damageReduction','block']))
    return fail('INPUT_MISSING_OR_ACCESSOR', 'input');
  if (input.kind !== 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY' || typeof input.source !== 'string' || !input.source.trim())
    return fail('INPUT_MISSING', 'source');
  if (!Number.isSafeInteger(input.level) || input.level < 1 || input.level > 14)
    return fail('UNSUPPORTED_LEVEL', 'level');
  if (![input.maxHP,input.physicalDefense,input.magicDefense,input.evasion,input.damageReduction].every(finite) ||
      input.maxHP === 0 || input.damageReduction > 100) return fail('INVALID_NUMBER', 'stats');
  const block = diagnosticBlock(input.block, 'physical', 'direct', true);
  if (!block.ok) return block;
  // Training authoring is shared; it is an incoming scale, never this actor's weapon/MATK.
  const base = basePhysicalAttackForLevel(input.level);
  const min = base + BASIC_REFERENCE_B.baseRange.min, max = base + BASIC_REFERENCE_B.baseRange.max;
  const mean = min / 2 + max / 2;
  if (!finite(mean) || mean === 0) return fail('NO_EXPOSURE', 'raw');
  const rows = [];
  for (const channel of ['physical','magic'] as const) {
    const defense = channel === 'physical' ? input.physicalDefense : input.magicDefense;
    const hit = channel === 'physical' ? 1 - Math.min(PACKAGE_B_POLICY.evasionCap, input.evasion / 100) : 1;
    const blockFactor = channel === 'physical' ? 1 - block.value.chance * block.value.efficiency : 1;
    const landed = mitigateDamage(mean, defense, input.level, 0) * (1 - input.damageReduction / 100);
    const expected = landed * hit * blockFactor;
    if (!finite(expected)) return fail('ARITHMETIC_OVERFLOW', channel);
    if (expected === 0) return fail('IMMUNITY_OR_ZERO_DENOMINATOR', channel);
    const ehp = input.maxHP * (mean / expected);
    if (!finite(ehp) || ehp === 0) return fail('ARITHMETIC_OVERFLOW', channel + '.ehp');
    rows.push(Object.freeze({ channel, defense, hitProbability: hit, blockProbability: channel === 'physical' ? block.value.chance : 0,
      expectedRaw: mean, expectedInflicted: expected, landedPacket: landed, ehp }));
  }
  // sqrt(P)*sqrt(M) avoids intermediate P*M overflow. Result still checked.
  const geometric = Math.sqrt(rows[0].ehp) * Math.sqrt(rows[1].ehp);
  if (!finite(geometric) || geometric === 0) return fail('ARITHMETIC_OVERFLOW', 'geometric');
  return Object.freeze({ ok: true as const, value: Object.freeze({ policy: PACKAGE_B_POLICY,
    source: input.source, level: input.level, maxHP: input.maxHP,
    bank: Object.freeze({ min, max, mean, distribution: 'CONTINUOUS_UNIFORM', penetration: 0, crit: 0, accuracy: 'NOT_APPLICABLE' }),
    channels: Object.freeze(rows), geometric, totalCombatPower: null,
    assumptions: 'Passive fractional per-event EHP; magic hypothetical; no Guard/parry/iframe/barrier/HP clamp/score floor. Not killrate.' }) });
}
