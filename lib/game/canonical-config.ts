/** Gameplay contract 2026-10-05. Existing tuning is retained with provenance;
 * null means not designed and MUST NOT be turned into a live default. */
export const GAMEPLAY_CONTRACT_VERSION = 2 as const;
export const CHARACTER_RULES = Object.freeze({ maxLevel: 100, baseStat: 15, statPointsPerLevel: 2,
  coreJobLevelCap: 15, specializationJobLevelCap: 60, advancedPlayable: false });
export const STAT_TUNING = Object.freeze({
  // Accuracy uses BonusDEX; MDEF uses TotalVIT/TotalINT (MASTER + OWNER 5 Oct).
  // Other retained tuning below is not newly approved by this alignment.
  source: 'existing CFV3 formulas', accuracyBase: 90, accuracyPerDex: 1,
  critBase: 2, critPerDex: .1, criticalDamageBase: 150,
  displayedCritCap: 100, attackSpeedBase: 100, attackSpeedPerDex: .15,
  evasionPerDex: .1, movementSpeedBase: 100, movementSpeedCap: 135,
  defenseBase: 8, defensePerLevel: 1.5, physicalDefensePerVit: .5,
  magicDefensePerVit: .6, magicDefensePerInt: .2,
  magicAttackPerInt: 2, hpRecoveryPerVit: .1, manaRecoveryPerBonusInt: .1, manaRecoveryCap: 30,
  damageReductionThreshold: 25, damageReductionCap: 45, softCapSlope: .35,
  mcrCap: 50, cdrCap: 40, healingPerInt: .25,
  // OWNER final stat closure: CastStat/4 percent, VCT80/100, FCT50, CDR40.
  vctStatReductionCap: 80, vctReductionCap: 100, fctReductionCap: 50,
  castStatToVct: 1 / 4,
});
export const WEAPON_TUNING = Object.freeze({
  contribution: { dagger: .9, off_hand_dagger: .9, one_hand_sword: .9, bow: 1,
    two_hand_sword: 1.4, greatsword: 1.4 } as Readonly<Record<string, number>>,
  offHandBaseline: .5, offHandMasteryCeiling: .6,
  // No approved rank curve exists. Never infer rank -> efficiency.
  rogueMasteryByRank: null as readonly number[] | null,
  bladeMasteryByRank: null as readonly number[] | null,
  enhancementPerLevel: .08, // retained item formula
});
export const MANUAL_SKILL_RESET = Object.freeze({ enabled: false, goldCost: null as number | null });
export const ITEMIZATION_RULES = Object.freeze({ maxEnhancement: 15,
  rarities: ['common','uncommon','rare','epic','legendary','mythic','ancient'] as const,
  setLevels: [5,10,15,25,40,60,80,95] as const, setPieces: 4,
  setThresholds: [2,3,4] as const,
  failure: 'consume_materials_keep_level' as const,
});
export type EnhancementStep = { chance: number; materialId: string; materialRequired: number; gold: number };
/** +1..12 from rules.ts, no extrapolation to +13..15. */
export const ENHANCEMENT_STEPS: Readonly<Record<number, EnhancementStep | null>> = Object.freeze(
  Object.fromEntries(Array.from({ length: 15 }, (_, i) => {
    const level = i + 1;
    const chance = [1,1,1,.7,.6,.5,.4,.36,.32,.25,.2,.15][i];
    return [level, chance === undefined ? null : { chance, gold: 0,
      materialId: i < 3 ? 'iron' : i < 6 ? 'titanium' : i < 9 ? 'vibranium' : 'meteorite-core',
      materialRequired: 1 + Math.floor(i / 3) }];
  })),
);
export const BALANCE_TARGETS = Object.freeze({ fieldBossSeconds: 120,
  otherTTK: null, pvp: null as null | { damageMultiplier: number; maxSingleHitHPFraction: number;
    ccDurationMultiplier: number; maxContinuousCCSeconds: number; ccImmunitySeconds: number } });
export function skillPointsAtLevel(level: number): number {
  if (!Number.isInteger(level) || level < 2 || level > 80) return 0;
  return level <= 20 ? 1 : level <= 40 ? 2 : level <= 60 ? 3 : 4;
}
export function totalSkillPoints(level: number): number {
  if (!Number.isFinite(level)) return 0;
  let total = 0;
  for (let n = 2; n <= Math.min(80, Math.floor(level)); n++) total += skillPointsAtLevel(n);
  return total;
}
