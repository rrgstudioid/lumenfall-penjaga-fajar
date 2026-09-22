/** Balance assumptions, NOT replacements for production combat mechanics. */
export const COMBAT_POWER_CONFIG = Object.freeze({
  version: 6,
  // A single-target benchmark: no speculative AoE DPS bonus for melee arcs.
  frontalArcExpectedTargets: 1,
  displayScale: 1.5,
  offensiveWeight: 10,
  sustainPerSecondWeight: 12,
  moveSpeedWeight: 8,
  utilityCoreCap: .1,
  specialCoreCap: .15,
  defensiveScale: .85,
  attackSpeed: Object.freeze({ coefficient: .7, min: .7, max: 1.5 }),
  encounterSeconds: 30,
  // Stable CP benchmark. It is intentionally independent of FIELDS roster.
  referenceTarget: Object.freeze({
    normalPhysicalDefenseBase: 4,
    normalPhysicalDefensePerLevel: 1.1,
    normalMagicDefenseBase: 3,
    normalMagicDefensePerLevel: 1,
    eliteMultiplier: 1.25,
    bossMultiplier: 1.5,
    rankMix: Object.freeze({ normal: .6, elite: .25, boss: .15 }),
  }),
  minimumIncomingMultiplier: .01,
  minimumCooldown: .1,
  cacheEntries: 128,
  debug: false,
});
