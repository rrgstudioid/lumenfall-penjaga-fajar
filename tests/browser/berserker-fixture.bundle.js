// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\berserker-v3.ts
var twoHand = ["two_hand_sword"];
var swords = ["one_hand_sword", "two_hand_sword"];
var motion = (motionArchetype, motionNotes, animationNoGo) => ({ motionArchetype, motionNotes, animationNoGo });
var makeDamage = (patch) => ({
  jobId: "berserker",
  jobTier: "specialization",
  spCostPerRank: 3,
  skillType: "ACTIVE_DAMAGE",
  weaponRequirement: twoHand,
  targeting: { targetType: "single", range: 5.2 },
  ...patch
});
var makeArea = (patch) => makeDamage({
  targeting: { targetType: "area", radius: 5, maxTargets: 5 },
  ...patch
});
var BERSERKER_V3_SKILLS = [
  {
    id: "v3-berserker-two-hand-mastery",
    name: "Two-Hand Sword Mastery",
    jobId: "berserker",
    jobTier: "specialization",
    unlockLevel: 60,
    maxRank: 5,
    rankLevelRequirements: [60, 64, 68, 73, 78],
    spCostPerRank: 4,
    skillType: "MASTERY",
    weaponRequirement: twoHand,
    targeting: { targetType: "self" },
    effects: { buffs: ["two_hand_accuracy", "berserker_mana_efficiency"] },
    presentation: { description: "Master the use of Two-Hand Swords, improving your control and efficiency with heavy Berserker techniques." },
    motion: motion("MASTERY_PASSIVE", "Passive heavy-sword control and efficiency.", ["no active attack", "no weapon unlock", "no raw damage multiplier"]),
    status: "DESIGN_LOCKED"
  },
  makeArea({
    id: "v3-berserker-raging-cleave",
    name: "Raging Cleave",
    maxRank: 8,
    rankLevelRequirements: [60, 63, 65, 68, 70, 73, 76, 79],
    damageProfile: { physicalCoefficient: 0.95, statScaling: { str: 0.15 } },
    resourceCost: { mana: 14 },
    cooldown: 7,
    prerequisiteSkills: [{ skillId: "v3-warrior-sweeping-slash", requiredRank: 4 }],
    weaponRequirement: twoHand,
    targeting: { targetType: "frontal_arc", range: 5.5, radius: 4.6, maxTargets: 4 },
    effects: { tags: ["berserker_damage", "no-stun", "no-knockback"] },
    presentation: { description: "Swing your Two-Hand Sword in a massive sweeping arc, striking multiple enemies in front of you with overwhelming force." },
    motion: motion("HEAVY_WIDE_SWEEP", "Heavy wide two-hand sword sweep.", ["no repeated spin", "no jump", "no knockback", "no repeated hit sequence"])
  }),
  makeDamage({
    id: "v3-berserker-crushing-blow",
    name: "Crushing Blow",
    maxRank: 5,
    rankLevelRequirements: [61, 65, 69, 74, 79],
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: 0.22 } },
    resourceCost: { mana: 14 },
    cooldown: 8.5,
    presentation: { description: "Deliver a brutal Two-Hand Sword strike against a single enemy, sacrificing speed for tremendous impact." },
    motion: motion("TWO_HAND_POWER_STRIKE", "Deliberate heavy two-hand power strike.", ["no stun", "no knockback", "no AoE"])
  }),
  {
    id: "v3-berserker-iron-blood",
    name: "Iron Blood",
    jobId: "berserker",
    jobTier: "specialization",
    unlockLevel: 62,
    maxRank: 5,
    rankLevelRequirements: [62, 66, 70, 75, 80],
    spCostPerRank: 3,
    skillType: "ACTIVE_BUFF",
    targeting: { targetType: "self" },
    resourceCost: { mana: 18 },
    cooldown: 34,
    effects: { buffs: ["temporary_max_hp", "damage_reduction"] },
    presentation: { description: "Harden your body through sheer battle fury, temporarily increasing Max HP and reducing incoming damage." },
    motion: motion("BERSERKER_FORTIFY", "Temporary fortification through battle fury.", ["no permanent tankiness", "no hidden VIT scaling", "no free healing"])
  },
  makeArea({
    id: "v3-berserker-breaker-entry",
    name: "Breaker Entry",
    maxRank: 5,
    rankLevelRequirements: [63, 67, 71, 75, 79],
    damageProfile: { physicalCoefficient: 0.75, statScaling: { str: 0.1 } },
    resourceCost: { mana: 12 },
    cooldown: 10,
    weaponRequirement: swords,
    prerequisiteSkills: [{ skillId: "v3-warrior-iron-charge", requiredRank: 3 }],
    targeting: { targetType: "area", radius: 3.5, maxTargets: 3 },
    effects: { tags: ["breaker-entry-consumer", "no-charge", "no-stun", "no-knockback"] },
    presentation: { description: "Follow a successful charge with a crushing sweep, striking nearby enemies as you force your way into the fight." },
    motion: motion("CHARGE_FOLLOWUP_SMASH", "Short impact-area follow-up at the entered target position.", ["no second charge", "no teleport", "no stun", "no knockback"])
  }),
  makeArea({
    id: "v3-berserker-earth-splitter",
    name: "Earth Splitter",
    maxRank: 5,
    rankLevelRequirements: [66, 69, 72, 76, 80],
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: 0.25 } },
    resourceCost: { mana: 22 },
    cooldown: 14,
    prerequisiteSkills: [{ skillId: "v3-berserker-raging-cleave", requiredRank: 3 }],
    targeting: { targetType: "area", radius: 5, maxTargets: 5 },
    stunProfile: { chance: [0.08, 0.1, 0.12, 0.15, 0.18], pveDuration: 1.5, pvpDuration: 0.75, minimumTravelDistance: 0, targetPolicy: "NORMAL" },
    effects: { tags: ["berserker_damage", "per-target-stun", "radial", "no-knockback"] },
    presentation: { description: "Drive your Two-Hand Sword into the earth with tremendous force, damaging nearby enemies and giving the impact a chance to Stun them." },
    motion: motion("EARTH_SPLITTING_SLAM", "One heavy radial earth impact.", ["no repeated shockwaves", "no knockback", "no Stagger", "no spinning attack"])
  }),
  makeArea({
    id: "v3-berserker-ruinous-arc",
    name: "Ruinous Arc",
    maxRank: 5,
    rankLevelRequirements: [68, 71, 74, 77, 80],
    damageProfile: { physicalCoefficient: 1.1, statScaling: { str: 0.2 } },
    resourceCost: { mana: 17 },
    cooldown: 10.5,
    prerequisiteSkills: [{ skillId: "v3-warrior-armor-breaker", requiredRank: 3 }],
    targeting: { targetType: "frontal_arc", range: 5.2, radius: 4.5, maxTargets: 4 },
    effects: { tags: ["berserker_damage", "armor-break-payoff:8", "no-stun", "no-knockback"] },
    presentation: { description: "Carve a devastating arc through enemies in front of you, dealing greater damage to targets already weakened by your Armor Break." },
    motion: motion("RISING_HEAVY_ARC", "Heavy rising two-hand arc.", ["no stun", "no knockback", "no repeated hit sequence"])
  }),
  makeArea({
    id: "v3-berserker-fury-harvest",
    name: "Fury Harvest",
    maxRank: 5,
    rankLevelRequirements: [70, 73, 75, 78, 80],
    damageProfile: { physicalCoefficient: 1, statScaling: { str: 0.15 } },
    resourceCost: { mana: 24 },
    cooldown: 13,
    prerequisiteSkills: [{ skillId: "v3-berserker-earth-splitter", requiredRank: 3 }, { skillId: "v3-berserker-iron-blood", requiredRank: 2 }],
    targeting: { targetType: "area", radius: 4.5, maxTargets: 5 },
    effects: { tags: ["berserker_damage", "fury-harvest-recovery", "controlled-circular", "no-knockback"] },
    presentation: { description: "Sweep through nearby enemies and draw strength from every foe struck, restoring a portion of your HP based on the number of enemies hit." },
    motion: motion("REAPING_CIRCULAR_STRIKE", "One controlled near-360 sweep.", ["no repeated spinning", "no jump", "no knockback"])
  }),
  {
    id: "v3-berserker-trance",
    name: "Berserker Trance",
    jobId: "berserker",
    jobTier: "specialization",
    unlockLevel: 75,
    maxRank: 3,
    rankLevelRequirements: [75, 78, 80],
    spCostPerRank: 5,
    skillType: "ULTIMATE",
    weaponRequirement: twoHand,
    targeting: { targetType: "self" },
    prerequisiteSkills: [{ skillId: "v3-berserker-two-hand-mastery", requiredRank: 3 }],
    jobInvestmentRequirement: { jobId: "berserker", minimumSP: 18 },
    resourceCost: { mana: 30 },
    cooldown: 90,
    effects: { buffs: ["berserker_trance", "frenzy_guard"] },
    presentation: { description: "Enter a state of unrestrained battle fury, empowering your Two-Hand Sword techniques and strengthening your ability to survive while fighting groups of enemies." },
    motion: motion("BERSERKER_TRANSFORMATION", "Temporary battle-fury stance without forced control loss.", ["no giant body transformation", "no invulnerability", "no permanent aura", "no auto-control"])
  }
];
var arrays = {
  "v3-berserker-raging-cleave": { coefficients: [0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3], str: [0.15, 0.17, 0.19, 0.21, 0.24, 0.27, 0.29, 0.32], mana: [14, 15, 16, 17, 18, 19, 20, 21], cooldown: [7, 6.8, 6.6, 6.4, 6.2, 6, 5.9, 5.8], radius: [4.6, 4.7, 4.8, 5, 5.1, 5.25, 5.4, 5.5], maxTargets: [4, 4, 5, 5, 6, 6, 7, 7] },
  "v3-berserker-crushing-blow": { coefficients: [1.2, 1.28, 1.37, 1.46, 1.55], str: [0.22, 0.26, 0.3, 0.34, 0.38], mana: [14, 15, 17, 18, 20], cooldown: [8.5, 8.25, 8, 7.75, 7.5] },
  "v3-berserker-breaker-entry": { coefficients: [0.75, 0.81, 0.87, 0.94, 1], str: [0.1, 0.12, 0.15, 0.17, 0.2], mana: [12, 13, 14, 15, 16], cooldown: [10, 9.6, 9.2, 8.8, 8.5], radius: [3.5, 3.7, 3.9, 4, 4.2], maxTargets: [3, 3, 4, 4, 5] },
  "v3-berserker-earth-splitter": { coefficients: [1.2, 1.28, 1.37, 1.46, 1.55], str: [0.25, 0.3, 0.35, 0.4, 0.45], mana: [22, 24, 26, 28, 30], cooldown: [14, 13.5, 13, 12.5, 12], radius: [5, 5.25, 5.5, 5.75, 6], maxTargets: [5, 6, 6, 7, 8] },
  "v3-berserker-ruinous-arc": { coefficients: [1.1, 1.18, 1.25, 1.32, 1.4], str: [0.2, 0.24, 0.28, 0.31, 0.35], mana: [17, 18, 20, 21, 23], cooldown: [10.5, 10.1, 9.7, 9.3, 9], radius: [4.5, 4.7, 4.9, 5, 5.2], maxTargets: [4, 4, 5, 5, 6] },
  "v3-berserker-fury-harvest": { coefficients: [1, 1.06, 1.12, 1.18, 1.25], str: [0.15, 0.18, 0.21, 0.24, 0.28], mana: [24, 26, 28, 30, 32], cooldown: [13, 12.5, 12, 11.5, 11], radius: [4.5, 4.7, 4.9, 5, 5.2], maxTargets: [5, 5, 6, 6, 7] }
};
var ironBlood = [
  { hp: 5, dr: 2, duration: 8, mana: 18, cooldown: 34 },
  { hp: 6, dr: 2.5, duration: 9, mana: 20, cooldown: 33.5 },
  { hp: 7, dr: 3, duration: 10, mana: 22, cooldown: 33 },
  { hp: 8.5, dr: 4, duration: 11, mana: 24, cooldown: 32.5 },
  { hp: 10, dr: 5, duration: 12, mana: 26, cooldown: 32 }
];
var adapter = (definition) => {
  const values = arrays[definition.id];
  const blood = definition.id === "v3-berserker-iron-blood" ? ironBlood : void 0;
  const coefficients = values?.coefficients ?? (blood ? blood.map(() => 0) : [0]);
  const stats = values?.str ?? coefficients.map(() => 0);
  const rankValues = coefficients.map((coefficient, index) => ({
    physicalCoefficient: coefficient,
    statScaling: { str: stats[index] },
    manaCost: blood?.[index]?.mana ?? values?.mana[index] ?? definition.resourceCost?.mana ?? 0,
    cooldown: blood?.[index]?.cooldown ?? values?.cooldown[index] ?? definition.cooldown ?? 0,
    ...values?.radius ? { radius: values.radius[index] } : {},
    ...values?.maxTargets ? { maxTargets: values.maxTargets[index] } : {}
  }));
  const rankEffects = blood?.map((entry) => ({ temporaryBuffs: [{ duration: entry.duration, modifier: { id: `${definition.id}-buff`, stats: { percent: { maxHP: entry.hp, damageReduction: entry.dr } } } }] })) ?? (definition.id === "v3-berserker-two-hand-mastery" ? [2, 4, 6, 8, 10].map((accuracy) => ({ modifiers: [{ id: `${definition.id}-accuracy`, stats: { flat: { accuracy } } }] })) : void 0);
  const effect = definition.id === "v3-berserker-trance" ? "ultimate" : definition.skillType === "ACTIVE_BUFF" || definition.skillType === "MASTERY" ? "buff" : definition.targeting?.targetType === "area" || definition.targeting?.targetType === "frontal_arc" ? "aoe_damage" : "damage";
  return {
    id: definition.id,
    name: definition.name,
    description: definition.presentation?.description ?? "",
    job: "warrior",
    specialization: "berserker",
    slot: 1,
    unlockLevel: definition.unlockLevel ?? definition.rankLevelRequirements?.[0] ?? 60,
    maxLevel: definition.maxRank,
    manaCost: definition.resourceCost?.mana ?? 0,
    cooldown: definition.cooldown ?? 0,
    castingTime: 0.55,
    baseDamage: 0,
    scalingStat: "attack",
    damageCoefficient: 0,
    combatScaling: { physical: 1, magic: 0, damageType: "physical" },
    physicalCoefficient: definition.damageProfile?.physicalCoefficient ?? 0,
    statScaling: definition.damageProfile?.statScaling,
    magicCoefficient: 0,
    damageType: "physical",
    progressionMode: "rank_values",
    rankValues,
    rankEffects,
    knockbackStrength: 0,
    targetType: definition.targeting?.targetType === "frontal_arc" ? "frontal_arc" : definition.targeting?.targetType === "area" ? "area" : definition.targeting?.targetType === "self" ? "self" : "single",
    range: definition.targeting?.range ?? 0,
    areaRadius: definition.targeting?.radius ?? 0,
    maxTargets: definition.targeting?.maxTargets,
    duration: 0,
    statusEffect: null,
    effect,
    animation: effect === "buff" || effect === "ultimate" ? "magic_cast" : "basic_attack",
    visualEffect: effect === "ultimate" ? "thunder" : effect === "buff" ? "barrier" : "",
    soundEffect: "",
    weaponRequirement: definition.weaponRequirement ?? [],
    masteryOptions: [],
    usableFromHotbar: definition.skillType !== "MASTERY",
    hotbarCategory: "primary",
    // Runtime SkillDefinition remains an actionable shape; usableFromHotbar=false
    // keeps Mastery out of casting/hotbar while the V3 schema retains MASTERY.
    skillType: "active",
    tags: ["v3-berserker", ...definition.effects?.tags ?? []],
    prerequisiteSkillIds: definition.prerequisiteSkills?.map((entry) => entry.skillId),
    stunProfile: definition.stunProfile,
    statuses: []
  };
};
var BERSERKER_V3_RUNTIME_SKILLS = BERSERKER_V3_SKILLS.map(adapter);
var BERSERKER_V3_SKILL_MAP = Object.fromEntries(BERSERKER_V3_SKILLS.map((skill2) => [skill2.id, skill2]));
var BERSERKER_V3_RUNTIME_MAP = Object.fromEntries(BERSERKER_V3_RUNTIME_SKILLS.map((skill2) => [skill2.id, skill2]));
var EARTH_SPLITTER_STUN_CHANCE = [0.08, 0.1, 0.12, 0.15, 0.18];
var FURY_HARVEST_RECOVERY_PERCENT = [0.6, 0.7, 0.8, 0.9, 1];

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\warrior-v3.ts
var swords2 = ["one_hand_sword", "two_hand_sword"];
var motion2 = (motionArchetype, motionNotes, animationNoGo) => ({ motionArchetype, motionNotes, animationNoGo });
var makeDamage2 = (patch) => ({
  jobId: "warrior",
  jobTier: "core",
  spCostPerRank: 2,
  skillType: "ACTIVE_DAMAGE",
  weaponRequirement: swords2,
  targeting: { targetType: "single", range: 3.8 },
  ...patch
});
var WARRIOR_V3_SKILLS = [
  makeDamage2({ id: "v3-warrior-strike", name: "Warrior Strike", maxRank: 10, rankLevelRequirements: [15, 18, 21, 24, 28, 32, 36, 41, 47, 55], damageProfile: { physicalCoefficient: 1, statScaling: { str: 0.08 } }, resourceCost: { mana: 5 }, cooldown: 3.2, presentation: { description: "Deliver a reliable sword strike against a single enemy." }, motion: motion2("QUICK_DIAGONAL_SLASH", "Fast diagonal sword strike with small forward weight shift.", ["no full spin", "no jump", "no knockback", "no ground slam"]) }),
  makeDamage2({ id: "v3-warrior-iron-charge", name: "Iron Charge", maxRank: 5, rankLevelRequirements: [17, 26, 35, 44, 53], damageProfile: { physicalCoefficient: 0.75, statScaling: { str: 0.05 } }, resourceCost: { mana: 8 }, cooldown: 8, targeting: { targetType: "single", range: 6.5 }, stunProfile: { chance: [0.1, 0.15, 0.2, 0.25, 0.3], pveDuration: 1.5, pvpDuration: 0.75, minimumTravelDistance: 3.5, targetPolicy: "NORMAL" }, effects: { movement: "charge", tags: ["stun-after-distance", "no-knockback"] }, presentation: { description: "Rush toward an enemy and strike on impact. Charging from sufficient distance gives the impact a chance to Stun." }, motion: motion2("CHARGE_IMPACT", "Rush toward an enemy and strike on impact.", ["no knockback", "no teleport", "no giant leap", "no repeated hits"]) }),
  makeDamage2({ id: "v3-warrior-sweeping-slash", name: "Sweeping Slash", maxRank: 8, rankLevelRequirements: [20, 24, 29, 34, 40, 46, 51, 56], damageProfile: { physicalCoefficient: 0.88, statScaling: { str: 0.08 } }, resourceCost: { mana: 8 }, cooldown: 6, targeting: { targetType: "frontal_arc", range: 4.8, radius: 4, maxTargets: 3 }, prerequisiteSkills: [{ skillId: "v3-warrior-strike", requiredRank: 2 }], effects: { tags: ["arc:120", "no-knockback"] }, presentation: { description: "Swing your sword in a wide horizontal arc, striking multiple enemies in front of you." }, motion: motion2("HORIZONTAL_SWEEP", "Wide horizontal sword sweep.", ["no full 360 spin", "no jump", "no knockback", "no ground slam"]) }),
  {
    id: "v3-warrior-guard-stance",
    name: "Guard Stance",
    jobId: "warrior",
    jobTier: "core",
    maxRank: 5,
    rankLevelRequirements: [22, 30, 38, 46, 54],
    spCostPerRank: 2,
    skillType: "STANCE",
    weaponRequirement: swords2,
    targeting: { targetType: "self" },
    resourceCost: { mana: 10 },
    cooldown: 18,
    effects: { buffs: ["damageReduction", "blockRate"] },
    presentation: { description: "Assume a defensive sword stance, reducing incoming damage and improving your ability to block attacks for a short time." },
    motion: motion2("DEFENSIVE_GUARD", "Defensive sword guard.", ["no attack", "no giant shield bubble", "no immobility requirement", "no offensive damage"])
  },
  makeDamage2({ id: "v3-warrior-armor-breaker", name: "Armor Breaker", maxRank: 5, rankLevelRequirements: [25, 33, 41, 48, 55], damageProfile: { physicalCoefficient: 1, statScaling: { str: 0.1 } }, resourceCost: { mana: 11 }, cooldown: 10, prerequisiteSkills: [{ skillId: "v3-warrior-strike", requiredRank: 3 }], effects: { debuffs: ["armor_break"], tags: ["refresh-strongest-only"] }, presentation: { description: "Deliver a forceful strike against the enemy's guard, weakening its Defense for a short duration." }, motion: motion2("HEAVY_GUARD_BREAK", "Forceful strike against the enemy guard.", ["no knockback"]) }),
  {
    id: "v3-warrior-battle-cry",
    name: "Battle Cry",
    jobId: "warrior",
    jobTier: "core",
    maxRank: 5,
    rankLevelRequirements: [28, 35, 42, 49, 56],
    spCostPerRank: 2,
    skillType: "ACTIVE_BUFF",
    targeting: { targetType: "self" },
    resourceCost: { mana: 14 },
    cooldown: 35,
    effects: { buffs: ["physicalDamagePercent"] },
    presentation: { description: "Release a powerful battle cry, temporarily increasing your physical offensive strength." },
    motion: motion2("POWER_BUFF", "Battle cry power-up pose.", ["no damage", "no sword attack", "no giant magical explosion"])
  },
  makeDamage2({ id: "v3-warrior-counter-slash", name: "Counter Slash", maxRank: 5, rankLevelRequirements: [31, 37, 44, 50, 57], damageProfile: { physicalCoefficient: 0.9, statScaling: { str: 0.08, dex: 0.08 } }, resourceCost: { mana: 9 }, cooldown: 6.5, prerequisiteSkills: [{ skillId: "v3-warrior-guard-stance", requiredRank: 2 }], effects: { tags: ["counter-payoff:15,18,22,26,30"] }, presentation: { description: "Strike back with a swift retaliatory slash. The attack becomes stronger after a successful defensive action." }, motion: motion2("REACTIVE_COUNTER", "Swift retaliatory slash.", ["no stun", "no knockback"]) }),
  {
    id: "v3-warrior-battle-focus",
    name: "Battle Focus",
    jobId: "warrior",
    jobTier: "core",
    maxRank: 5,
    rankLevelRequirements: [34, 40, 46, 52, 58],
    spCostPerRank: 2,
    skillType: "ACTIVE_BUFF",
    targeting: { targetType: "self" },
    resourceCost: { mana: 14 },
    cooldown: 35,
    effects: { buffs: ["accuracy", "criticalRate"] },
    presentation: { description: "Steady your breathing and sharpen your combat awareness, temporarily improving Accuracy and Critical Rate." },
    motion: motion2("FOCUS_BUFF", "Focused combat awareness pose.", ["no raw physical damage"])
  },
  makeDamage2({ id: "v3-warrior-ground-breaker", name: "Ground Breaker", maxRank: 5, rankLevelRequirements: [38, 43, 48, 53, 58], damageProfile: { physicalCoefficient: 1.05, statScaling: { str: 0.15 } }, resourceCost: { mana: 15 }, cooldown: 11, targeting: { targetType: "area", radius: 4.3, maxTargets: 5 }, prerequisiteSkills: [{ skillId: "v3-warrior-sweeping-slash", requiredRank: 4 }], effects: { tags: ["radial", "no-stagger", "no-stun", "no-knockback"] }, presentation: { description: "Raise your sword overhead and slam it into the ground, releasing a powerful shockwave that strikes nearby enemies." }, motion: motion2("OVERHEAD_GROUND_SLAM", "Overhead sword ground slam.", ["no spinning attack", "no jump-heavy attack", "no knockback", "no repeated shockwave hits"]) }),
  {
    id: "v3-warrior-unbroken-stance",
    name: "Unbroken Stance",
    jobId: "warrior",
    jobTier: "core",
    maxRank: 5,
    rankLevelRequirements: [43, 47, 51, 55, 59],
    spCostPerRank: 2,
    skillType: "ACTIVE_BUFF",
    targeting: { targetType: "self" },
    resourceCost: { mana: 16 },
    cooldown: 28,
    prerequisiteSkills: [{ skillId: "v3-warrior-guard-stance", requiredRank: 3 }],
    effects: { buffs: ["damageReduction", "displacementResistance"] },
    presentation: { description: "Brace yourself against incoming pressure, temporarily increasing your survivability and resistance to displacement." },
    motion: motion2("BRACED_STANCE", "Anchored survival stance.", ["no max HP amplification", "no stun immunity"])
  },
  makeDamage2({ id: "v3-warrior-crushing-finale", name: "Crushing Finale", maxRank: 3, rankLevelRequirements: [52, 56, 59], damageProfile: { physicalCoefficient: 1.45, statScaling: { str: 0.22 } }, resourceCost: { mana: 20 }, cooldown: 14, prerequisiteSkills: [{ skillId: "v3-warrior-armor-breaker", requiredRank: 3 }], effects: { tags: ["finisher", "armor-break-payoff:10"] }, presentation: { description: "Deliver a devastating finishing strike. The attack becomes more powerful against enemies weakened by your Armor Break." }, motion: motion2("HEAVY_FINISHING_SLASH", "Heavy finishing sword slash.", ["no stun", "no knockback"]) })
];
var arrays2 = {
  "v3-warrior-strike": { coefficients: [1, 1.02, 1.04, 1.07, 1.09, 1.11, 1.13, 1.15, 1.18, 1.2], str: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.18], mana: [5, 5, 6, 6, 7, 7, 8, 8, 9, 10], cooldown: [3.2, 3.15, 3.1, 3.05, 3, 2.95, 2.9, 2.85, 2.8, 2.8] },
  "v3-warrior-iron-charge": { coefficients: [0.75, 0.8, 0.85, 0.9, 0.95], str: [0.05, 0.07, 0.08, 0.1, 0.12], range: [6.5, 7, 7.5, 8, 8.5], mana: [8, 9, 10, 11, 12], cooldown: [8, 7.6, 7.2, 6.8, 6.5] },
  "v3-warrior-sweeping-slash": { coefficients: [0.88, 0.92, 0.96, 1, 1.05, 1.1, 1.14, 1.18], str: [0.08, 0.1, 0.11, 0.13, 0.15, 0.17, 0.18, 0.2], radius: [4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.65, 4.8], maxTargets: [3, 3, 4, 4, 4, 5, 5, 5], mana: [8, 9, 10, 11, 12, 13, 14, 15], cooldown: [6, 5.9, 5.8, 5.6, 5.5, 5.3, 5.1, 5] },
  "v3-warrior-armor-breaker": { coefficients: [1, 1.05, 1.1, 1.15, 1.2], str: [0.1, 0.12, 0.14, 0.16, 0.18], mana: [11, 12, 13, 14, 15], cooldown: [10, 9.6, 9.2, 8.8, 8.5] },
  "v3-warrior-counter-slash": { coefficients: [0.9, 0.94, 0.99, 1.03, 1.08], str: [0.08, 0.095, 0.11, 0.125, 0.14], dex: [0.08, 0.105, 0.13, 0.155, 0.18], mana: [9, 10, 11, 12, 13], cooldown: [6.5, 6.25, 6, 5.75, 5.5] },
  "v3-warrior-ground-breaker": { coefficients: [1.05, 1.12, 1.2, 1.27, 1.35], str: [0.15, 0.18, 0.22, 0.26, 0.3], radius: [4.3, 4.5, 4.65, 4.8, 5], maxTargets: [5, 5, 5, 6, 6], mana: [15, 16, 17, 18, 19], cooldown: [11, 10.6, 10.2, 9.8, 9.5] },
  "v3-warrior-crushing-finale": { coefficients: [1.45, 1.58, 1.7], str: [0.22, 0.27, 0.32], mana: [20, 22, 24], cooldown: [14, 13, 12] }
};
var adapter2 = (definition) => {
  const values = arrays2[definition.id];
  const first = values?.coefficients[0] ?? 0;
  const rankValues = values?.coefficients.map((coefficient, index) => ({ physicalCoefficient: coefficient, statScaling: { str: values.str[index], ...values.dex ? { dex: values.dex[index] } : {} }, ...values.range ? { range: values.range[index] } : {}, ...values.radius ? { radius: values.radius[index] } : {}, ...values.maxTargets ? { maxTargets: values.maxTargets[index] } : {}, manaCost: values.mana[index], cooldown: values.cooldown[index] })) ?? [{ manaCost: definition.resourceCost?.mana ?? 0, cooldown: definition.cooldown ?? 0 }];
  const effect = definition.skillType === "STANCE" || definition.skillType === "ACTIVE_BUFF" ? "buff" : definition.skillType === "ACTIVE_MOBILITY" ? "dash_damage" : definition.effects?.debuffs ? "debuff" : "damage";
  const rankEffects = definition.id === "v3-warrior-counter-slash" ? [15, 18, 22, 26, 30].map((damagePercent) => ({ modifiers: [
    { id: `${definition.id}-blocked`, layer: "payoff", condition: { counter: ["blocked"] }, action: { damagePercent } },
    { id: `${definition.id}-parried`, layer: "payoff", condition: { counter: ["parried"] }, action: { damagePercent } }
  ] })) : definition.id === "v3-warrior-crushing-finale" ? [10, 10, 10].map(() => ({ modifiers: [{ id: `${definition.id}-armor-break`, layer: "payoff", payoffGroup: `${definition.id}-armor-break`, condition: { targetStatuses: ["armor_break"] }, action: { damagePercent: 10 } }] })) : void 0;
  const buffRankEffects = definition.id === "v3-warrior-battle-cry" ? [3, 4, 5, 6, 7].map((value, index) => ({ temporaryBuffs: [{ duration: [20, 22, 24, 26, 28][index], modifier: { id: `${definition.id}-buff`, stats: { percent: { physicalAttack: value } } } }] })) : definition.id === "v3-warrior-guard-stance" ? [8, 10, 12, 14, 16].map((value, index) => ({ temporaryBuffs: [{ duration: [5, 5.5, 6, 6.5, 7][index], modifier: { id: `${definition.id}-buff`, stats: { percent: { damageReduction: value }, flat: { blockRate: [4, 6, 8, 10, 12][index] } } } }] })) : definition.id === "v3-warrior-battle-focus" ? [5, 7, 9, 11, 13].map((value, index) => ({ temporaryBuffs: [{ duration: [20, 22, 24, 26, 28][index], modifier: { id: `${definition.id}-buff`, stats: { flat: { accuracy: value, criticalRate: [1, 1.5, 2, 2.5, 3][index] } } } }] })) : definition.id === "v3-warrior-unbroken-stance" ? [3, 4, 5, 6, 7].map((value, index) => ({ temporaryBuffs: [{ duration: [8, 8.5, 9, 9.5, 10][index], modifier: { id: `${definition.id}-buff`, stats: { percent: { damageReduction: value } }, incoming: { knockbackMultiplier: 1 - [15, 20, 25, 30, 35][index] / 100 } } }] })) : void 0;
  return {
    id: definition.id,
    name: definition.name,
    description: definition.presentation?.description ?? "",
    job: "warrior",
    specialization: null,
    slot: 1,
    unlockLevel: definition.unlockLevel ?? definition.rankLevelRequirements?.[0] ?? 15,
    maxLevel: definition.maxRank,
    manaCost: definition.resourceCost?.mana ?? 0,
    cooldown: definition.cooldown ?? 0,
    castingTime: 0.45,
    baseDamage: 0,
    scalingStat: "attack",
    damageCoefficient: 0,
    combatScaling: { physical: 1, magic: 0, damageType: "physical" },
    physicalCoefficient: first,
    statScaling: definition.damageProfile?.statScaling,
    stunProfile: definition.stunProfile,
    magicCoefficient: 0,
    damageType: "physical",
    progressionMode: "rank_values",
    rankValues,
    knockbackStrength: 0,
    targetType: definition.targeting?.targetType === "frontal_arc" ? "frontal_arc" : definition.targeting?.targetType === "area" ? "area" : definition.targeting?.targetType === "self" ? "self" : "single",
    range: definition.targeting?.range ?? 0,
    areaRadius: definition.targeting?.radius ?? 0,
    maxTargets: definition.targeting?.maxTargets,
    dash: definition.id === "v3-warrior-iron-charge" ? { stopDistance: 1.2, impactRange: 1 } : void 0,
    duration: 0,
    statusEffect: definition.id === "v3-warrior-armor-breaker" ? "defenseDown" : null,
    effect,
    animation: effect === "buff" ? "magic_cast" : "basic_attack",
    visualEffect: effect === "buff" ? "barrier" : "",
    soundEffect: "",
    weaponRequirement: definition.weaponRequirement ?? [],
    masteryOptions: [],
    usableFromHotbar: true,
    hotbarCategory: "primary",
    skillType: "active",
    tags: ["v3-warrior"],
    prerequisiteSkillIds: definition.prerequisiteSkills?.map((entry) => entry.skillId),
    counterPolicy: definition.id === "v3-warrior-counter-slash" ? { accepted: ["blocked", "parried"], windowMs: 2500 } : void 0,
    rankEffects: rankEffects ?? buffRankEffects,
    statuses: definition.id === "v3-warrior-armor-breaker" ? [{ id: "armor_break", duration: 8 }] : []
  };
};
var WARRIOR_V3_RUNTIME_SKILLS = WARRIOR_V3_SKILLS.map(adapter2);
var WARRIOR_V3_SKILL_MAP = Object.fromEntries(WARRIOR_V3_SKILLS.map((skill2) => [skill2.id, skill2]));
var WARRIOR_V3_RUNTIME_MAP = Object.fromEntries(WARRIOR_V3_RUNTIME_SKILLS.map((skill2) => [skill2.id, skill2]));

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\warrior-v2.ts
var WARRIOR_TREE = { id: "warrior", architecture: "v2" };
var WARRIOR_STYLES = [
  "one_hand_sword",
  "greatsword",
  "dual_sword"
];
var WARRIOR_COUNTER_WINDOW_MS = 2500;
var id = (name) => `v2-warrior-${name}`;
var req = (name, rank) => ({
  skillId: id(name),
  requiredRank: rank
});
var scoped = { tree: WARRIOR_TREE };
var direct = { tree: WARRIOR_TREE, tags: ["physical"] };
var heavy = { tree: WARRIOR_TREE, tags: ["heavy"] };
function active(slug, name, level, tags, lock, rows2, extra = {}) {
  return {
    id: id(slug),
    name,
    description: "Physical damage pada target terpilih.",
    job: "warrior",
    specialization: null,
    slot: 1,
    tree: WARRIOR_TREE,
    unlockLevel: level,
    maxLevel: rows2.length,
    progressionMode: "rank_values",
    rankValues: rows2,
    manaCost: 0,
    cooldown: 0,
    castingTime: 0,
    baseDamage: 0,
    physicalCoefficient: 0,
    magicCoefficient: 0,
    skillPowerCoefficient: 0,
    damageType: "physical",
    canCrit: true,
    damageCoefficient: 0,
    scalingStat: "attack",
    targetType: "single",
    range: 3.8,
    areaRadius: 0,
    duration: 0,
    knockbackStrength: 0,
    statusEffect: null,
    effect: "damage",
    animation: "basic_attack",
    visualEffect: "damage",
    soundEffect: "attack",
    weaponRequirement: [...WARRIOR_STYLES],
    masteryOptions: [],
    tags: ["warrior", ...tags],
    actionType: "skill",
    actionLockDuration: lock,
    movementAllowedDuringLock: false,
    modifierComposition: "scoped_additive",
    usableFromHotbar: true,
    hotbarCategory: "primary",
    skillType: "active",
    ...extra
  };
}
var damageRows = (rows2) => rows2.map(
  ([baseDamage, physicalCoefficient, _legacyValue, manaCost, cooldown]) => ({
    baseDamage,
    physicalCoefficient,
    manaCost,
    cooldown
  })
);
function buff(slug, name, level, lock, rows2, mods, extra = {}) {
  return active(
    slug,
    name,
    level,
    ["buff"],
    lock,
    rows2.map(([duration, manaCost, cooldown]) => ({
      duration,
      manaCost,
      cooldown
    })),
    {
      description: "Buff sementara pada diri sendiri.",
      targetType: "self",
      effect: "buff",
      actionType: "buff",
      canCrit: false,
      range: 0,
      movementAllowedDuringLock: true,
      rankEffects: rows2.map(([duration], r) => ({
        temporaryBuffs: mods(r).map((modifier) => ({ duration, modifier }))
      })),
      ...extra
    }
  );
}
var single = ["physical", "melee", "single_target"];
var area = ["physical", "melee", "aoe"];
var counter = (slug, blocked, parried, normal, _blockLegacy, _parryLegacy) => normal.map((_, r) => ({
  modifiers: [
    ...blocked ? [
      {
        id: `${id(slug)}-block`,
        layer: "payoff",
        condition: { counter: ["blocked"] },
        action: { damagePercent: blocked[r] }
      }
    ] : [],
    {
      id: `${id(slug)}-parry`,
      layer: "payoff",
      condition: { counter: ["parried"] },
      action: { damagePercent: parried[r] }
    }
  ]
}));
var WARRIOR_V2_ACTIVE = [
  active(
    "strike",
    "Warrior Strike",
    15,
    [...single],
    0.3,
    damageRows([
      [18, 1.05, 7, 6, 3.5],
      [22, 1.1, 8, 6, 3.5],
      [26, 1.15, 10, 6, 3.4],
      [30, 1.2, 11, 6, 3.3],
      [34, 1.25, 13, 6, 3.2]
    ]),
    { branch: "assault" }
  ),
  active(
    "iron-charge",
    "Iron Charge",
    17,
    [...single, "mobility"],
    0.55,
    damageRows([
      [15, 0.9, 8, 8, 7],
      [18, 0.95, 9, 8, 6.8],
      [21, 1, 10, 8, 6.6],
      [24, 1.05, 11, 8, 6.3],
      [27, 1.1, 13, 8, 6]
    ]).map((r, i) => ({
      ...r,
      range: [7, 7, 7.5, 8, 8.5][i],
      knockbackStrength: 0.3
    })),
    {
      branch: "control",
      prerequisites: [req("strike", 1)],
      effect: "dash_damage",
      dash: { stopDistance: 2.5, impactRange: 2.5 },
      description: "Charge ke target; damage hanya bila berhasil mencapai jarak impact."
    }
  ),
  active(
    "sweeping-slash",
    "Sweeping Slash",
    20,
    [...area, "frontal_arc"],
    0.45,
    damageRows([
      [18, 1.05, 8, 10, 6],
      [22, 1.12, 9, 10, 6],
      [26, 1.18, 10, 10, 5.8],
      [30, 1.25, 11, 10, 5.8],
      [34, 1.32, 12, 10, 5.5]
    ]),
    {
      branch: "assault",
      prerequisites: [req("strike", 2)],
      targetType: "frontal_arc",
      range: 4.5,
      angle: 120,
      maxTargets: 5,
      description: "Physical cleave di depan karakter, maksimal 5 target."
    }
  ),
  buff(
    "guard-stance",
    "Guard Stance",
    20,
    0.25,
    [
      [5, 10, 14],
      [5.5, 10, 14],
      [6, 10, 13.5],
      [6.5, 10, 13],
      [7, 10, 12.5]
    ],
    (r) => [
      {
        id: id("guard-stance-buff"),
        stats: { flat: { blockRate: [4, 5, 7, 8, 10][r] } },
        incoming: { damageMultiplier: 1 - [12, 13.5, 15, 16.5, 18][r] / 100 }
      }
    ],
    {
      branch: "guard",
      prerequisites: [req("strike", 2)],
      tags: ["warrior", "guard", "buff"],
      description: "Mengurangi incoming damage dan meningkatkan Block Rate sementara. Bukan Parry."
    }
  ),
  active(
    "rising-slash",
    "Rising Slash",
    23,
    [...single, "heavy"],
    0.5,
    damageRows([
      [22, 1.25, 20, 11, 7],
      [26, 1.33, 22, 11, 7],
      [30, 1.4, 24, 11, 6.8],
      [34, 1.48, 27, 11, 6.5],
      [38, 1.55, 30, 11, 6.3]
    ]),
    {
      branch: "control",
      prerequisites: [req("iron-charge", 2)],
      knockbackStrength: 0.15,
      description: "Physical strike dengan knockback ringan. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT."
    }
  ),
  active(
    "armor-breaker",
    "Armor Breaker",
    26,
    [...single, "debuff", "armor_break"],
    0.55,
    damageRows([
      [24, 1.3, 12, 12, 9],
      [28, 1.36, 12, 12, 9],
      [32, 1.42, 13, 12, 8.8],
      [36, 1.48, 14, 12, 8.5],
      [40, 1.55, 16, 12, 8.5]
    ]).map((r, i) => ({ ...r, duration: [4, 4.5, 5, 5.5, 6][i] })),
    {
      branch: "assault",
      prerequisites: [req("sweeping-slash", 2)],
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration) => ({
        statuses: [{ id: "armor_break", duration }]
      })),
      description: "Physical strike, lalu Armor Break: defense target menjadi 80% selama durasi efek."
    }
  ),
  buff(
    "battle-cry",
    "Battle Cry",
    29,
    0.3,
    [
      [8, 14, 24],
      [9, 14, 24],
      [10, 14, 23],
      [10, 14, 23],
      [11, 14, 22]
    ],
    (r) => [
      {
        id: id("battle-cry-buff"),
        stats: {
          percent: { physicalAttack: [2.5, 3.5, 4.5, 5.5, 6.5][r] }
        }
      }
    ],
    {
      branch: "control",
      prerequisites: [req("iron-charge", 2)],
      description: "Meningkatkan Physical Attack diri sendiri sementara."
    }
  ),
  active(
    "counter-slash",
    "Counter Slash",
    32,
    [...single, "counter"],
    0.35,
    damageRows([
      [15, 0.85, 7, 9, 6],
      [18, 0.9, 8, 9, 6],
      [21, 0.95, 9, 9, 5.8],
      [24, 1, 10, 9, 5.7],
      [27, 1.05, 11, 9, 5.5]
    ]),
    {
      branch: "guard",
      prerequisites: [req("guard-stance", 3)],
      counterPolicy: {
        accepted: ["blocked", "parried"],
        windowMs: WARRIOR_COUNTER_WINDOW_MS
      },
      rankEffects: counter(
        "counter-slash",
        [55, 60, 65, 70, 75],
        [85, 90, 100, 110, 120],
        [7, 8, 9, 10, 11],
        [11, 12, 13, 14, 16],
        [14, 15, 17, 18, 20]
      ),
      description: "Lebih kuat setelah Block atau Parry dalam 2,5 detik; mengonsumsi satu kesempatan counter."
    }
  ),
  active(
    "ground-breaker",
    "Ground Breaker",
    35,
    [...area, "heavy"],
    0.65,
    damageRows([
      [24, 1.1, 24, 15, 11],
      [28, 1.15, 26, 15, 11],
      [32, 1.2, 28, 15, 10.5],
      [36, 1.26, 30, 15, 10.5],
      [40, 1.32, 34, 15, 10]
    ]).map((r, i) => ({ ...r, radius: [4, 4, 4.25, 4.25, 4.5][i] })),
    {
      branch: "control",
      prerequisites: [req("rising-slash", 3)],
      targetType: "area",
      range: 0,
      description: "Physical damage di sekitar karakter, tanpa knockback. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT."
    }
  ),
  buff(
    "battle-focus",
    "Battle Focus",
    38,
    0.25,
    [
      [8, 14, 24],
      [8.5, 14, 24],
      [9, 14, 23],
      [9.5, 14, 23],
      [10, 14, 22]
    ],
    (r) => [
      {
        id: id("battle-focus-buff"),
        stats: {
          flat: {
            accuracy: [6, 8, 10, 11, 12][r],
            criticalRate: [1.5, 1.8, 2.2, 2.6, 3][r]
          }
        }
      }
    ],
    {
      branch: "precision",
      prerequisites: [req("battle-cry", 2)],
      description: "Meningkatkan Accuracy dan Critical Rate sementara."
    }
  ),
  active(
    "severing-arc",
    "Severing Arc",
    41,
    [...area, "frontal_arc", "heavy"],
    0.6,
    damageRows([
      [28, 1.55, 16, 15, 9],
      [32, 1.65, 17, 15, 9],
      [36, 1.75, 18, 15, 8.8],
      [40, 1.85, 20, 15, 8.5],
      [44, 1.95, 22, 15, 8.5]
    ]),
    {
      branch: "assault",
      prerequisites: [req("armor-breaker", 3)],
      targetType: "frontal_arc",
      range: 5,
      angle: 70,
      maxTargets: 3,
      description: "Physical cleave sempit dan kuat di depan karakter, maksimal 3 target."
    }
  ),
  active(
    "relentless-assault",
    "Relentless Assault",
    44,
    [...single, "multi_hit"],
    0.75,
    [10, 10, 9.8, 9.7, 9.5].map((cooldown) => ({ manaCost: 18, cooldown })),
    {
      branch: "precision",
      prerequisites: [req("battle-focus", 2), req("combat-instinct", 2)],
      effect: "rapid_damage",
      description: "Tiga hit berurutan; hit terakhir paling kuat. Momentum/Rhythm maksimal satu trigger per cast.",
      rankEffects: [
        [
          [4, 0.5, 3],
          [4, 0.55, 4],
          [12, 0.85, 11]
        ],
        [
          [5, 0.54, 3],
          [5, 0.59, 5],
          [14, 0.9, 12]
        ],
        [
          [6, 0.58, 4],
          [6, 0.63, 5],
          [16, 0.96, 13]
        ],
        [
          [7, 0.62, 4],
          [7, 0.67, 6],
          [18, 1.02, 14]
        ],
        [
          [8, 0.66, 5],
          [8, 0.72, 6],
          [20, 1.1, 16]
        ]
      ].map((hits) => ({
        hitSequence: hits.map(
          ([baseDamage, physicalCoefficient], i) => ({
            delay: [0, 0.18, 0.42][i],
            baseDamage,
            physicalCoefficient,
            knockbackStrength: 0
          })
        )
      }))
    }
  ),
  buff(
    "unbroken-stance",
    "Unbroken Stance",
    47,
    0.3,
    [
      [6, 16, 26],
      [6.5, 16, 26],
      [7, 16, 25.5],
      [7.5, 16, 25.5],
      [8, 16, 25]
    ],
    (r) => [
      {
        id: id("unbroken-stance-buff"),
        incoming: {
          damageMultiplier: 1 - [4, 5, 6, 6.5, 7][r] / 100,
          knockbackMultiplier: 1 - [20, 25, 30, 35, 40][r] / 100
        }
      }
    ],
    {
      branch: "guard",
      prerequisites: [req("guard-stance", 3), req("battle-cry", 2)],
      tags: ["warrior", "guard", "buff"],
      description: "Mengurangi incoming damage dan knockback sementara; bukan immunity."
    }
  ),
  active(
    "iron-reversal",
    "Iron Reversal",
    50,
    [...single, "counter"],
    0.5,
    damageRows([
      [22, 1.05, 14, 14, 10],
      [28, 1.15, 16, 14, 9.5],
      [34, 1.25, 18, 14, 9]
    ]),
    {
      branch: "guard",
      prerequisites: [req("counter-slash", 3), req("guard-training", 3)],
      counterPolicy: {
        accepted: ["parried"],
        windowMs: WARRIOR_COUNTER_WINDOW_MS
      },
      rankEffects: counter(
        "iron-reversal",
        void 0,
        [80, 95, 115],
        [14, 16, 18],
        void 0,
        [28, 34, 42]
      ),
      description: "Sangat diperkuat oleh Parry dalam 2,5 detik. Block tidak memberikan payoff khusus."
    }
  ),
  active(
    "crushing-finale",
    "Crushing Finale",
    55,
    [...single, "heavy", "finisher"],
    0.85,
    damageRows([
      [36, 2.2, 30, 24, 18],
      [44, 2.4, 34, 24, 17],
      [52, 2.6, 38, 24, 16]
    ]),
    {
      branch: "assault",
      range: 4,
      prerequisites: [req("armor-breaker", 4), req("ground-breaker", 3)],
      description: "Bonus damage terhadap target dengan Armor Break. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
      rankEffects: [0, 1, 2].map((r) => ({
        modifiers: [
          {
            id: id("finale-armor"),
            layer: "payoff",
            payoffGroup: id("finale-payoff"),
            condition: { targetStatuses: ["armor_break"] },
            action: { damagePercent: [10, 15, 20][r] }
          }
        ]
      }))
    }
  ),
  buff(
    "awakening",
    "Warrior Awakening",
    59,
    0.45,
    [
      [12, 32, 50],
      [13, 32, 48],
      [14, 32, 46]
    ],
    (r) => [
      {
        id: id("awakening-damage"),
        selector: direct,
        action: {
          damagePercent: [6, 8, 10][r]
        }
      },
      ...r === 2 ? [
        {
          id: id("awakening-mana"),
          selector: scoped,
          action: { manaPercent: -10 }
        }
      ] : []
    ],
    {
      branch: "general",
      investmentRequirement: { tree: WARRIOR_TREE, paidRanks: 25 },
      tags: ["warrior", "buff", "awakening"],
      description: "Memperkuat skill Warrior V2 berikutnya sementara. Tidak memengaruhi basic attack, Adventurer, atau hit yang sudah berjalan."
    }
  )
];
function passive(slug, name, level, rankModifiers, extra = {}) {
  return {
    id: id(slug),
    name,
    description: "Passive Warrior.",
    job: "warrior",
    specialization: null,
    tier: "core",
    tree: WARRIOR_TREE,
    unlockLevel: level,
    maxLevel: rankModifiers.length,
    rankModifiers,
    ...extra
  };
}
var ranks = (n, fn) => Array.from({ length: n }, (_, r) => fn(r));
var empty = (n) => ranks(n, () => []);
var WARRIOR_V2_PASSIVES = [
  passive(
    "conditioning",
    "Warrior Conditioning",
    15,
    ranks(5, (r) => [
      {
        id: id("conditioning"),
        stats: { percent: { maxHP: 2 * (r + 1), physicalDefense: r + 1 } }
      }
    ]),
    {
      branch: "general",
      description: "Per rank: Max HP +2%, Physical Defense +1%."
    }
  ),
  passive(
    "weapon-discipline",
    "Weapon Discipline",
    18,
    ranks(5, (r) => [
      {
        id: id("weapon-discipline"),
        selector: { weaponStyles: WARRIOR_STYLES },
        stats: { percent: { physicalAttack: 0.8 * (r + 1) } }
      }
    ]),
    {
      branch: "general",
      description: "Per rank: Physical Attack +0,8% dengan senjata Warrior yang sesuai."
    }
  ),
  passive(
    "firm-footing",
    "Firm Footing",
    21,
    empty(5),
    {
      branch: "guard",
      description: "REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT."
    }
  ),
  passive(
    "guard-training",
    "Guard Training",
    24,
    ranks(5, (r) => [
      {
        id: id("guard-training"),
        condition: { guardingOrBuff: id("guard-stance-buff") },
        stats: { flat: { blockRate: 3 * (r + 1) } }
      }
    ]),
    {
      branch: "guard",
      prerequisites: [req("guard-stance", 1)],
      description: "Per rank: Block Rate +3 selama manual guard atau Guard Stance aktif. Tidak memberi Parry."
    }
  ),
  passive(
    "combat-instinct",
    "Combat Instinct",
    27,
    ranks(5, (r) => [
      {
        id: id("combat-instinct"),
        stats: { flat: { accuracy: 2 * (r + 1), criticalRate: 0.5 * (r + 1) } }
      }
    ]),
    {
      branch: "precision",
      description: "Per rank: Accuracy +2 dan Critical Rate +0,5."
    }
  ),
  passive(
    "heavy-impact",
    "Heavy Impact",
    30,
    empty(5),
    {
      branch: "general",
      description: "REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT."
    }
  ),
  passive("battle-momentum", "Battle Momentum", 34, empty(5), {
    branch: "general",
    description: "Cast skill Warrior yang menghasilkan damage membangun maksimal 3 stack, kedaluwarsa setelah 6 detik tanpa trigger. Bonus per stack 0,5/0,75/1/1,25/1,5%.",
    rankCombatSupport: [0.5, 0.75, 1, 1.25, 1.5].map((damagePercent) => ({
      stacks: [
        {
          id: id("battle-momentum"),
          duration: 6,
          maxStacks: 3,
          triggerTree: WARRIOR_TREE,
          modifier: {
            id: id("battle-momentum-bonus"),
            selector: direct,
            action: { damagePercent }
          }
        }
      ]
    }))
  }),
  passive(
    "counter-training",
    "Counter Training",
    38,
    ranks(5, (r) => [
      {
        id: id("counter-training"),
        selector: { tree: WARRIOR_TREE, tags: ["counter"] },
        condition: { counter: ["blocked", "parried"] },
        action: { damagePercent: 2 * (r + 1) }
      }
    ]),
    {
      branch: "guard",
      prerequisites: [req("guard-training", 2)],
      description: "Per rank: counter damage +2% bila kesempatan defense diterima skill tersebut."
    }
  ),
  passive(
    "adrenaline",
    "Adrenaline",
    43,
    ranks(3, (r) => [
      {
        id: id("adrenaline"),
        condition: { hpAtOrBelow: 0.35 },
        incoming: { damageMultiplier: 1 - [5, 7.5, 10][r] / 100 }
      }
    ]),
    {
      branch: "guard",
      description: "Saat HP \u226435% Max HP: incoming damage berkurang 5/7,5/10%. Tidak menambah damage serangan."
    }
  ),
  passive("indomitable-will", "Indomitable Will", 48, empty(3), {
    branch: "guard",
    description: "REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT."
  }),
  passive(
    "great-weapon-familiarity",
    "Great Weapon Familiarity",
    25,
    ranks(5, (r) => [
      {
        id: id("great-weapon-familiarity"),
        selector: { ...heavy, weaponStyles: ["greatsword"] },
        action: { damagePercent: 0.8 * (r + 1) }
      }
    ]),
    {
      branch: "great_weapon",
      description: "Dengan greatsword, per rank: heavy skill damage +0,8%."
    }
  ),
  passive("great-weapon-momentum", "Great Weapon Momentum", 40, empty(3), {
    branch: "great_weapon",
    prerequisites: [req("great-weapon-familiarity", 3)],
    description: "Heavy Warrior yang mengenai target membuka bonus untuk heavy berikutnya selama 5 detik. Damage +3/4,5/6%; cast pemakai tidak membuka ulang window.",
    rankCombatSupport: [0, 1, 2].map((r) => ({
      windows: [
        {
          id: id("great-weapon-momentum"),
          duration: 5,
          tags: ["heavy"],
          weaponStyle: "greatsword",
          triggerTree: WARRIOR_TREE,
          openOnSuccess: true,
          modifier: {
            id: id("great-weapon-momentum-bonus"),
            selector: heavy,
            action: {
              damagePercent: [3, 4.5, 6][r]
            }
          }
        }
      ]
    }))
  }),
  passive(
    "twin-blade-familiarity",
    "Twin Blade Familiarity",
    25,
    ranks(5, (r) => [
      {
        id: id("twin-blade-familiarity"),
        selector: { weaponStyles: ["dual_sword"] },
        stats: { flat: { accuracy: r + 1, criticalRate: 0.5 * (r + 1) } }
      }
    ]),
    {
      branch: "twin_blade",
      description: "Dengan dua one-hand sword, per rank: Accuracy +1 dan Critical Rate +0,5."
    }
  ),
  passive("twin-blade-rhythm", "Twin Blade Rhythm", 40, empty(3), {
    branch: "twin_blade",
    prerequisites: [req("twin-blade-familiarity", 3)],
    description: "Dengan dual sword, cast skill Warrior yang menghasilkan damage membangun maksimal 3 stack selama 5 detik. Bonus damage multi-hit per stack 1/1,5/2%; bukan per hit.",
    rankCombatSupport: [1, 1.5, 2].map((damagePercent) => ({
      stacks: [
        {
          id: id("twin-blade-rhythm"),
          duration: 5,
          maxStacks: 3,
          weaponStyle: "dual_sword",
          triggerTree: WARRIOR_TREE,
          modifier: {
            id: id("twin-blade-rhythm-bonus"),
            selector: { ...direct, tags: ["physical", "multi_hit"] },
            action: { damagePercent }
          }
        }
      ]
    }))
  })
];

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\thief-v2.ts
var THIEF_TREE = { id: "thief", architecture: "v2" };
var THIEF_STYLES = ["dagger", "dual_dagger"];
var id2 = (s) => `v2-thief-${s}`;
var req2 = (s, requiredRank) => ({
  skillId: id2(s),
  requiredRank
});
var single2 = ["physical", "melee", "single_target"];
var scope = { tree: THIEF_TREE };
var direct2 = { ...scope, tags: ["physical"] };
var descriptions = {
  "quick-stab": "Serangan physical singkat pada target pilihan. Rank 1 diberikan gratis saat otorisasi Thief development.",
  "twin-fang": "Dua hit nyata, hit kedua lebih kuat. Memerlukan dua dagger; bukan double basic attack.",
  "marked-strike": "Personal Mark milikmu menambah Crit Rate dan Crit Damage action ini. Tidak mengonsumsi Mark.",
  "silent-opening": "Snapshot Stealth pada cast valid menambah Crit Rate dan Crit Damage; commit mengakhiri Stealth.",
  "rear-rend": "Serangan dari sektor belakang 90\xB0 memperkuat total raw damage. Posisi diperiksa saat impact.",
  "weakpoint-assault": "Personal Mark dan posisi belakang menambah payoff dalam satu kelompok aditif. Mark tidak dikonsumsi.",
  "agile-conditioning": "Setiap rank: Max HP +1.5% dan Evasion +1 percentage point.",
  "dagger-discipline": "Setiap rank: Physical Attack +0.8% saat menggunakan dagger atau dual dagger.",
  "keen-instinct": "Setiap rank: Critical Rate +0.5 percentage point.",
  "shadow-discipline": "Setiap rank: durasi skill Stealth Thief +5%. Bukan invisibility terhadap AI.",
  "dual-dagger-familiarity": "Dengan dual dagger, tiap rank: damage action physical Thief +0.5% dan Crit Rate +0.5 point. Tidak mengubah basic attack.",
  "mark-expertise": "Setiap rank: durasi personal Mark +0.5 detik; bukan bonus damage.",
  "fleet-footing": "Setiap rank: jarak Slipstep/Disengage +0.15m. Tidak menambah range targeted dash.",
  venomcraft: "Setiap rank: durasi Poison skill Thief +0.4 detik. Formula tick tetap.",
  "rear-awareness": "Setiap rank: Crit Rate +1 point hanya untuk skill rear-synergy saat benar-benar menyerang dari belakang.",
  opportunist: "Setiap rank: Crit Rate +1 point hanya pada skill mark-synergy terhadap personal Mark milikmu.",
  "twin-edge-control": "Dengan dual dagger: Crit Damage multi-hit Thief +5 / +10 / +15 points.",
  "rapid-technique": "Setiap rank: damage multi-hit Thief +1.5%. Timing hit tidak dipercepat.",
  "evasive-instinct": "Saat HP \u226435% Max HP efektif: Evasion +5 / +8 / +12 points, tetap mengikuti cap existing.",
  "silent-opportunity": "Satu cast offensive Thief dari Stealth: Crit Damage +5 / +10 / +15 points. Satu snapshot berlaku pada seluruh hit cast itu, bukan trigger ulang atau bonus cast berikutnya."
};
function active2(slug, name, level, lock, rows2, extra = {}) {
  return {
    id: id2(slug),
    name,
    description: descriptions[slug] ?? name,
    job: "thief",
    specialization: null,
    tree: THIEF_TREE,
    slot: 1,
    unlockLevel: level,
    maxLevel: rows2.length,
    progressionMode: "rank_values",
    rankValues: rows2,
    manaCost: 0,
    cooldown: 0,
    castingTime: 0,
    baseDamage: 0,
    physicalCoefficient: 0,
    magicCoefficient: 0,
    skillPowerCoefficient: 0,
    damageType: "physical",
    canCrit: true,
    damageCoefficient: 0,
    scalingStat: "attack",
    targetType: "single",
    range: 3.5,
    areaRadius: 0,
    duration: 0,
    knockbackStrength: 0,
    statusEffect: null,
    effect: "damage",
    animation: "basic_attack",
    visualEffect: "damage",
    soundEffect: "attack",
    weaponRequirement: [...THIEF_STYLES],
    masteryOptions: [],
    tags: ["thief", ...single2],
    actionType: "skill",
    actionLockDuration: lock,
    movementAllowedDuringLock: false,
    modifierComposition: "scoped_additive",
    usableFromHotbar: true,
    hotbarCategory: "primary",
    skillType: "active",
    ...extra
  };
}
var rows = (values) => values.map(
  ([baseDamage, physicalCoefficient, _legacyValue, manaCost, cooldown]) => ({
    baseDamage,
    physicalCoefficient,
    manaCost,
    cooldown
  })
);
var tag = (...tags) => ["thief", ...single2, ...tags];
var marked = (slug, crit, damage = 0) => ({
  id: id2(slug),
  condition: { markedBySelf: true },
  action: { criticalRateBonus: crit, criticalDamageBonus: damage }
});
function self(slug, name, level, lock, values, extra = {}) {
  return active2(
    slug,
    name,
    level,
    lock,
    values.map(([duration, manaCost, cooldown]) => ({
      duration,
      manaCost,
      cooldown
    })),
    {
      targetType: "self",
      effect: "buff",
      actionType: "buff",
      canCrit: false,
      range: 0,
      weaponRequirement: [],
      tags: ["thief", "buff"],
      movementAllowedDuringLock: true,
      ...extra
    }
  );
}
var THIEF_V2_ACTIVE = [
  active2(
    "quick-stab",
    "Quick Stab",
    15,
    0.22,
    rows([
      [14, 0.95, 3, 5, 3],
      [18, 1, 3, 5, 3],
      [22, 1.05, 4, 5, 2.9],
      [26, 1.1, 4, 5, 2.9],
      [30, 1.15, 5, 5, 2.8]
    ])
  ),
  active2(
    "slipstep",
    "Slipstep",
    17,
    0.3,
    [3.5, 3.75, 4, 4.25, 4.5].map((movementDistance, i) => ({
      movementDistance,
      manaCost: 6,
      cooldown: [6.5, 6.2, 6, 5.8, 5.5][i]
    })),
    {
      prerequisites: [req2("quick-stab", 1)],
      targetType: "self",
      effect: "movement",
      actionType: "movement",
      canCrit: false,
      weaponRequirement: [],
      range: 0,
      tags: ["thief", "mobility", "directional"],
      directionalMovement: { direction: "input" },
      description: "Gerak sesuai input, atau arah hadap tanpa input. Tanpa invulnerability."
    }
  ),
  active2(
    "mark-prey",
    "Mark Prey",
    19,
    0.2,
    [10, 11, 12, 13, 14].map((duration) => ({
      duration,
      manaCost: 8,
      cooldown: 6
    })),
    {
      prerequisites: [req2("quick-stab", 2)],
      range: 8,
      effect: "mark",
      actionType: "debuff",
      canCrit: false,
      personalMark: true,
      weaponRequirement: [],
      tags: ["thief", "mark"],
      movementAllowedDuringLock: true,
      description: "Satu personal Mark milik caster. Recast refresh; target baru memindahkan Mark sendiri."
    }
  ),
  self(
    "smoke-veil",
    "Smoke Veil",
    21,
    0.3,
    [
      [3.5, 12, 18],
      [4, 12, 17.5],
      [4.5, 12, 17],
      [5, 12, 16.5],
      [5.5, 12, 16]
    ],
    {
      prerequisites: [req2("slipstep", 2)],
      effect: "stealth",
      tags: ["thief", "buff", "stealth"],
      stealthPolicy: {
        breakOn: ["basic_attack", "offensive_skill", "received_damage"]
      },
      description: "Stealth combat sementara; bukan invisibility terhadap AI. Serangan valid atau HP damage mengakhirinya."
    }
  ),
  active2(
    "twin-fang",
    "Twin Fang",
    23,
    0.42,
    [5.5, 5.4, 5.3, 5.1, 5].map((cooldown) => ({ manaCost: 9, cooldown })),
    {
      prerequisites: [req2("quick-stab", 2)],
      weaponRequirement: ["dual_dagger"],
      tags: tag("multi_hit", "dual_dagger"),
      effect: "rapid_damage",
      rankEffects: [
        [
          [4, 0.5, 2],
          [8, 0.75, 4]
        ],
        [
          [5, 0.54, 2],
          [10, 0.79, 4]
        ],
        [
          [6, 0.58, 2],
          [12, 0.84, 5]
        ],
        [
          [7, 0.62, 3],
          [14, 0.89, 5]
        ],
        [
          [8, 0.65, 3],
          [16, 0.95, 6]
        ]
      ].map((hits) => ({
        hitSequence: hits.map(
          ([baseDamage, physicalCoefficient], i) => ({
            delay: [0, 0.2][i],
            baseDamage,
            physicalCoefficient,
            knockbackStrength: 0
          })
        )
      }))
    }
  ),
  active2(
    "crippling-cut",
    "Crippling Cut",
    25,
    0.35,
    rows([
      [18, 1.05, 4, 10, 7],
      [22, 1.1, 4, 10, 6.9],
      [26, 1.15, 5, 10, 6.8],
      [30, 1.22, 5, 10, 6.6],
      [34, 1.3, 6, 10, 6.5]
    ]),
    {
      prerequisites: [req2("mark-prey", 1)],
      tags: tag("rear_synergy", "debuff"),
      rankEffects: [2.5, 3, 3.5, 4, 4.5].map((duration, i) => ({
        statuses: [
          {
            id: "slow",
            duration,
            potency: 0.2,
            rearDurationBonus: [0.75, 0.9, 1.1, 1.3, 1.5][i]
          }
        ]
      })),
      description: "Slow 20%; serangan dari belakang hanya memperpanjang Slow."
    }
  ),
  active2(
    "venom-edge",
    "Venom Edge",
    28,
    0.35,
    rows([
      [18, 1.1, 0, 11, 8],
      [22, 1.16, 0, 11, 7.8],
      [26, 1.22, 0, 11, 7.5],
      [30, 1.28, 0, 11, 7.2],
      [34, 1.35, 0, 11, 7]
    ]),
    {
      prerequisites: [req2("twin-fang", 2)],
      tags: tag("poison"),
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration) => ({
        statuses: [{ id: "poison", duration }]
      })),
      description: "Direct physical damage + Poison dengan formula tick existing."
    }
  ),
  self(
    "evasive-feint",
    "Evasive Feint",
    31,
    0.25,
    [
      [4, 10, 18],
      [4.5, 10, 17.5],
      [5, 10, 17],
      [5.5, 10, 16.5],
      [6, 10, 16]
    ],
    {
      prerequisites: [req2("slipstep", 2)],
      tags: ["thief", "buff", "evasion"],
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration, i) => ({
        temporaryBuffs: [
          {
            duration,
            modifier: {
              id: id2("evasive-feint-buff"),
              stats: { flat: { evasion: [8, 10, 12, 14, 16][i] } }
            }
          }
        ]
      })),
      description: "Evasion sementara, tetap mengikuti combat cap. Bukan iframe."
    }
  ),
  active2(
    "shadow-lunge",
    "Shadow Lunge",
    34,
    0.45,
    rows([
      [16, 0.85, 4, 11, 7.5],
      [19, 0.9, 4, 11, 7.3],
      [22, 0.95, 5, 11, 7],
      [25, 1, 5, 11, 6.8],
      [28, 1.05, 6, 11, 6.5]
    ]).map((r, i) => ({ ...r, range: [6.5, 6.75, 7, 7.5, 8][i] })),
    {
      prerequisites: [req2("slipstep", 3), req2("mark-prey", 1)],
      tags: tag("mobility", "mark_synergy"),
      effect: "dash_damage",
      dash: { stopDistance: 2.5, impactRange: 2.5 },
      rankEffects: [6, 7, 8, 9, 10].map((c) => ({
        modifiers: [marked("lunge-mark", c)]
      })),
      description: "Charge collision-aware ke target pilihan; personal Mark menambah Crit Rate."
    }
  ),
  active2(
    "marked-strike",
    "Marked Strike",
    37,
    0.32,
    rows([
      [20, 1.1, 0, 10, 6],
      [24, 1.16, 0, 10, 5.9],
      [28, 1.22, 0, 10, 5.8],
      [32, 1.28, 0, 10, 5.6],
      [36, 1.35, 0, 10, 5.5]
    ]),
    {
      prerequisites: [req2("mark-prey", 3)],
      tags: tag("mark_synergy"),
      rankEffects: [8, 9, 10, 12, 14].map((c, i) => ({
        modifiers: [marked("strike-mark", c, [8, 10, 12, 14, 16][i])]
      }))
    }
  ),
  active2(
    "blade-flurry",
    "Blade Flurry",
    40,
    0.68,
    [9, 8.8, 8.5, 8.2, 8].map((cooldown) => ({ manaCost: 15, cooldown })),
    {
      prerequisites: [req2("twin-fang", 3)],
      tags: tag("multi_hit", "dual_dagger"),
      weaponRequirement: ["dual_dagger"],
      effect: "rapid_damage",
      rankEffects: [
        [
          [3, 0.4],
          [4, 0.45],
          [8, 0.7]
        ],
        [
          [4, 0.42],
          [5, 0.49],
          [9, 0.74]
        ],
        [
          [5, 0.45],
          [6, 0.53],
          [10, 0.79]
        ],
        [
          [6, 0.48],
          [7, 0.56],
          [12, 0.84]
        ],
        [
          [7, 0.5],
          [8, 0.6],
          [14, 0.9]
        ]
      ].map((hits, r) => ({
        hitSequence: hits.map(([baseDamage, physicalCoefficient], i) => ({
          delay: [0, 0.16, 0.38][i],
          baseDamage,
          physicalCoefficient,
          knockbackStrength: 0
        }))
      })),
      description: "Tiga hit nyata; ASPD tidak mengubah timing."
    }
  ),
  active2(
    "silent-opening",
    "Silent Opening",
    43,
    0.45,
    rows([
      [22, 1.2, 0, 14, 10],
      [26, 1.27, 0, 14, 9.8],
      [30, 1.34, 0, 14, 9.5],
      [34, 1.42, 0, 14, 9.2],
      [38, 1.5, 0, 14, 9]
    ]),
    {
      prerequisites: [req2("smoke-veil", 3)],
      tags: tag("stealth_opener"),
      rankEffects: [12, 15, 18, 21, 24].map((c, i) => ({
        modifiers: [
          {
            id: id2("opening-stealth"),
            conditionTiming: "cast",
            condition: { attackerStealthed: true },
            action: {
              criticalRateBonus: c,
              criticalDamageBonus: [10, 12, 14, 16, 18][i]
            }
          }
        ]
      }))
    }
  ),
  active2(
    "rear-rend",
    "Rear Rend",
    46,
    0.5,
    rows([
      [24, 1.25, 7, 13, 8.5],
      [28, 1.32, 8, 13, 8.3],
      [32, 1.4, 8, 13, 8],
      [36, 1.47, 9, 13, 7.8],
      [40, 1.55, 10, 13, 7.5]
    ]),
    {
      prerequisites: [req2("crippling-cut", 3)],
      tags: tag("rear_synergy"),
      rankEffects: [12, 15, 18, 21, 25].map((damagePercent) => ({
        modifiers: [
          {
            id: id2("rend-rear"),
            layer: "payoff",
            condition: {
              targetPosition: "rear",
              positionAngles: { rearAngle: 90 }
            },
            action: { damagePercent }
          }
        ]
      }))
    }
  ),
  active2(
    "disengage",
    "Disengage",
    49,
    0.3,
    [4, 4.25, 4.5, 4.75, 5].map((movementDistance, i) => ({
      movementDistance,
      manaCost: 8,
      cooldown: [10, 9.6, 9.2, 8.8, 8.5][i]
    })),
    {
      prerequisites: [req2("slipstep", 3), req2("fleet-footing", 2)],
      targetType: "self",
      effect: "movement",
      actionType: "movement",
      canCrit: false,
      weaponRequirement: [],
      range: 0,
      tags: ["thief", "mobility", "directional"],
      directionalMovement: { direction: "backward" },
      description: "Mundur relatif arah hadap saat cast, tanpa berputar atau iframe."
    }
  ),
  active2(
    "weakpoint-assault",
    "Weakpoint Assault",
    54,
    0.65,
    rows([
      [32, 1.85, 10, 22, 16],
      [40, 2.05, 12, 22, 15],
      [48, 2.25, 14, 22, 14]
    ]),
    {
      prerequisites: [req2("marked-strike", 3), req2("rear-rend", 3)],
      tags: tag("mark_synergy", "rear_synergy", "finisher"),
      rankEffects: [8, 12, 16].map((damagePercent) => ({
        modifiers: [
          {
            id: id2("weakpoint-mark"),
            layer: "payoff",
            payoffGroup: id2("weakpoint-payoff"),
            condition: { markedBySelf: true },
            action: { damagePercent }
          },
          {
            id: id2("weakpoint-rear"),
            layer: "payoff",
            payoffGroup: id2("weakpoint-payoff"),
            condition: {
              targetPosition: "rear",
              positionAngles: { rearAngle: 90 }
            },
            action: { damagePercent }
          }
        ]
      }))
    }
  ),
  self(
    "instinct",
    "Thief Instinct",
    59,
    0.4,
    [
      [10, 28, 50],
      [11, 28, 48],
      [12, 28, 46]
    ],
    {
      investmentRequirement: { tree: THIEF_TREE, paidRanks: 25 },
      tags: ["thief", "buff", "major_state"],
      rankEffects: [10, 11, 12].map((duration, r) => ({
        temporaryBuffs: [
          {
            duration,
            modifier: {
              id: id2("instinct-buff"),
              selector: scope,
              action: {
                criticalRateBonus: [5, 7, 10][r],
                criticalDamageBonus: [10, 15, 20][r],
                manaPercent: r === 2 ? -10 : 0
              }
            }
          }
        ]
      })),
      description: "Memperkuat action Thief V2 yang baru di-resolve, bukan basic/Adventurer/hit yang sudah dijadwalkan."
    }
  )
];
function passive2(slug, name, level, max, mods, extra = {}) {
  return {
    id: id2(slug),
    name,
    description: descriptions[slug] ?? name,
    job: "thief",
    specialization: null,
    tier: "core",
    tree: THIEF_TREE,
    unlockLevel: level,
    maxLevel: max,
    rankModifiers: Array.from({ length: max }, (_, i) => mods(i + 1)),
    ...extra
  };
}
var THIEF_V2_PASSIVES = [
  passive2("agile-conditioning", "Agile Conditioning", 15, 5, (r) => [
    {
      id: id2("agile-conditioning"),
      stats: { percent: { maxHP: 1.5 * r }, flat: { evasion: r } }
    }
  ]),
  passive2("dagger-discipline", "Dagger Discipline", 18, 5, (r) => [
    {
      id: id2("dagger-discipline"),
      selector: { weaponStyles: THIEF_STYLES },
      stats: { percent: { physicalAttack: 0.8 * r } }
    }
  ]),
  passive2("keen-instinct", "Keen Instinct", 21, 5, (r) => [
    { id: id2("keen-instinct"), stats: { flat: { criticalRate: 0.5 * r } } }
  ]),
  passive2(
    "shadow-discipline",
    "Shadow Discipline",
    24,
    5,
    (r) => [
      {
        id: id2("shadow-discipline"),
        selector: { ...scope, tags: ["stealth"] },
        action: { durationPercent: 5 * r }
      }
    ],
    { prerequisites: [req2("smoke-veil", 1)] }
  ),
  passive2(
    "dual-dagger-familiarity",
    "Dual Dagger Familiarity",
    25,
    5,
    (r) => [
      {
        id: id2("dual-dagger-familiarity"),
        selector: { ...direct2, weaponStyles: ["dual_dagger"] },
        action: { damagePercent: 0.5 * r, criticalRateBonus: 0.5 * r }
      }
    ],
    { prerequisites: [req2("dagger-discipline", 2), req2("twin-fang", 1)] }
  ),
  passive2(
    "mark-expertise",
    "Mark Expertise",
    27,
    5,
    (r) => [
      {
        id: id2("mark-expertise"),
        selector: { ...scope, tags: ["mark"] },
        action: { durationBonus: 0.5 * r }
      }
    ],
    { prerequisites: [req2("mark-prey", 1)] }
  ),
  passive2(
    "fleet-footing",
    "Fleet Footing",
    30,
    5,
    (r) => [
      {
        id: id2("fleet-footing"),
        selector: { ...scope, tags: ["directional"] },
        action: { movementDistanceBonus: 0.15 * r }
      }
    ],
    { prerequisites: [req2("slipstep", 2)] }
  ),
  passive2(
    "venomcraft",
    "Venomcraft",
    33,
    5,
    (r) => [
      {
        id: id2("venomcraft"),
        selector: { ...scope, tags: ["poison"] },
        action: { statusDurationBonus: 0.4 * r }
      }
    ],
    { prerequisites: [req2("venom-edge", 1)] }
  ),
  passive2(
    "rear-awareness",
    "Rear Awareness",
    36,
    5,
    (r) => [
      {
        id: id2("rear-awareness"),
        selector: { ...scope, tags: ["rear_synergy"] },
        condition: {
          targetPosition: "rear",
          positionAngles: { rearAngle: 90 }
        },
        action: { criticalRateBonus: r }
      }
    ],
    { prerequisites: [req2("crippling-cut", 2)] }
  ),
  passive2(
    "opportunist",
    "Opportunist",
    39,
    5,
    (r) => [
      {
        id: id2("opportunist"),
        selector: { ...scope, tags: ["mark_synergy"] },
        condition: { markedBySelf: true },
        action: { criticalRateBonus: r }
      }
    ],
    { prerequisites: [req2("mark-expertise", 2)] }
  ),
  passive2(
    "twin-edge-control",
    "Twin Edge Control",
    40,
    3,
    (r) => [
      {
        id: id2("twin-edge-control"),
        selector: {
          ...scope,
          tags: ["multi_hit"],
          weaponStyles: ["dual_dagger"]
        },
        action: { criticalDamageBonus: 5 * r }
      }
    ],
    {
      prerequisites: [
        req2("dual-dagger-familiarity", 3),
        req2("blade-flurry", 2)
      ]
    }
  ),
  passive2(
    "rapid-technique",
    "Rapid Technique",
    42,
    5,
    (r) => [
      {
        id: id2("rapid-technique"),
        selector: { ...scope, tags: ["multi_hit"] },
        action: { damagePercent: 1.5 * r }
      }
    ],
    { prerequisites: [req2("blade-flurry", 1)] }
  ),
  passive2(
    "evasive-instinct",
    "Evasive Instinct",
    45,
    3,
    (r) => [
      {
        id: id2("evasive-instinct"),
        condition: {
          hpAtOrBelow: 0.35,
          hpThresholdBasis: "unconditional_final"
        },
        stats: { flat: { evasion: [5, 8, 12][r - 1] } }
      }
    ],
    { prerequisites: [req2("evasive-feint", 3)] }
  ),
  // Owner-final: resolve once from cast-time Stealth; every queued hit keeps
  // this snapshot. Offensive commit breaks Stealth, so later casts get no bonus.
  passive2(
    "silent-opportunity",
    "Silent Opportunity",
    48,
    3,
    (r) => [
      {
        id: id2("silent-opportunity"),
        selector: direct2,
        conditionTiming: "cast",
        condition: { attackerStealthed: true },
        action: { criticalDamageBonus: 5 * r }
      }
    ],
    { prerequisites: [req2("smoke-veil", 3), req2("keen-instinct", 2)] }
  )
];

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\skills.ts
function skillCombatScaling(skill2) {
  if (skill2.combatScaling) return { ...skill2.combatScaling, skillPower: skill2.combatScaling.skillPower ?? skill2.skillPowerCoefficient ?? 0 };
  const damageType = skill2.job === "adventurer" ? "physical" : legacyCoreJob(skill2.job)?.skillDamageType ?? "physical";
  return { physical: damageType === "physical" ? 1 : 0, magic: damageType === "magic" ? 1 : 0, skillPower: skill2.skillPowerCoefficient ?? 0, damageType };
}
var CORE_JOBS = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    role: "Bruiser / Protector",
    weapon: "mace",
    resource: "mana",
    resourceName: "Mana",
    color: "#b66f4a",
    hp: 140,
    hpGrowth: 22,
    attack: 24,
    attackGrowth: 6,
    cooldown: 0.42,
    range: 3.4,
    specializations: ["gatotkaca", "garda"],
    passiveName: "Otot Baja",
    description: "Pertarungan jarak dekat dan perlindungan."
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Critical / Stealth",
    weapon: "dual_dagger",
    resource: "mana",
    resourceName: "Mana",
    color: "#a65d88",
    hp: 100,
    hpGrowth: 13,
    attack: 26,
    attackGrowth: 6,
    cooldown: 0.32,
    range: 3.5,
    specializations: ["caroq", "anom"],
    passiveName: "Naluri Bayangan",
    description: "Serangan cepat, critical, mark, dan stealth."
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    role: "Ranged / Control",
    weapon: "bow",
    resource: "mana",
    resourceName: "Mana",
    color: "#6c9b5b",
    hp: 105,
    hpGrowth: 14,
    attack: 23,
    attackGrowth: 5,
    cooldown: 0.38,
    range: 7,
    specializations: ["srikandi", "jagawana"],
    passiveName: "Mata Pemburu",
    description: "Jarak jauh, weak point, trap, dan poison."
  },
  wizard: {
    skillDamageType: "magic",
    id: "wizard",
    name: "Wizard",
    role: "Elemental / AoE",
    weapon: "staff",
    resource: "mana",
    resourceName: "Mana",
    color: "#6e65b2",
    hp: 90,
    hpGrowth: 12,
    attack: 29,
    attackGrowth: 7,
    cooldown: 0.48,
    range: 7,
    specializations: ["resi", "pujangga"],
    passiveName: "Ilmu Unsur",
    description: "Sihir elemen, AoE, curse, dan DoT."
  },
  acolyte: {
    skillDamageType: "magic",
    id: "acolyte",
    name: "Acolyte",
    role: "Heal / Holy Melee",
    weapon: "staff",
    resource: "mana",
    resourceName: "Mana",
    color: "#d2b86d",
    hp: 115,
    hpGrowth: 17,
    attack: 20,
    attackGrowth: 5,
    cooldown: 0.44,
    range: 4,
    specializations: ["pandita", "bajra"],
    passiveName: "Welas Asih",
    description: "Heal, buff, barrier, dan holy sustain solo."
  }
};
var SPECIALIZATIONS = {
  gatotkaca: {
    ...CORE_JOBS.warrior,
    id: "warrior",
    name: "Gatotkaca",
    role: "Bruiser / AoE",
    weapon: "knuckle",
    resource: "mana",
    resourceName: "Mana",
    color: "#c97748",
    coreJob: "warrior",
    specializations: ["gatotkaca", "garda"],
    passiveName: "Otot Baja",
    passiveId: "iron-muscle",
    description: "2H knuckle, shockwave, leap, dan super armor."
  },
  garda: {
    ...CORE_JOBS.warrior,
    id: "warrior",
    name: "Garda",
    role: "Tank / Protector / Taunt",
    weapon: "sword_shield",
    resource: "mana",
    resourceName: "Mana",
    color: "#779a9b",
    coreJob: "warrior",
    specializations: ["gatotkaca", "garda"],
    passiveName: "Penjaga Gerbang",
    passiveId: "gatekeeper",
    description: "Shield, block, barrier, taunt, dan counterattack."
  },
  caroq: {
    ...CORE_JOBS.rogue,
    id: "rogue",
    name: "Caroq",
    role: "Attack Speed / Critical",
    weapon: "dual_dagger",
    resource: "mana",
    resourceName: "Mana",
    color: "#b86187",
    coreJob: "rogue",
    specializations: ["caroq", "anom"],
    passiveName: "Ritme Caroq",
    passiveId: "caroq-rhythm",
    description: "Dual dagger, rapid combo, critical, dan vanish."
  },
  anom: {
    ...CORE_JOBS.rogue,
    id: "rogue",
    name: "Anom",
    role: "Mark / Stealth / Execute",
    weapon: "sword_dagger",
    resource: "mana",
    resourceName: "Mana",
    color: "#5e6c9f",
    coreJob: "rogue",
    specializations: ["caroq", "anom"],
    passiveName: "Naluri Eksekutor",
    passiveId: "execution-instinct",
    description: "Mark, back attack, stealth, dan critical execution."
  },
  srikandi: {
    ...CORE_JOBS.hunter,
    id: "hunter",
    name: "Srikandi",
    role: "Precision / Weak Point",
    weapon: "bow",
    resource: "mana",
    resourceName: "Mana",
    color: "#829d5d",
    coreJob: "hunter",
    specializations: ["srikandi", "jagawana"],
    passiveName: "Mata Srikandi",
    passiveId: "srikandi-eye",
    description: "Bow presisi, weak point, mark, dan controlled AoE."
  },
  jagawana: {
    ...CORE_JOBS.hunter,
    id: "hunter",
    name: "Jagawana",
    role: "Trap / Poison / Control",
    weapon: "bow_trap",
    resource: "mana",
    resourceName: "Mana",
    color: "#4e8064",
    coreJob: "hunter",
    specializations: ["srikandi", "jagawana"],
    passiveName: "Penjaga Rimba",
    passiveId: "forest-warden",
    description: "Trap, poison, slow, root, dan area control."
  },
  resi: {
    ...CORE_JOBS.wizard,
    id: "wizard",
    name: "Resi",
    role: "Elemental / High Damage",
    weapon: "staff",
    resource: "mana",
    resourceName: "Mana",
    color: "#637dcc",
    coreJob: "wizard",
    specializations: ["resi", "pujangga"],
    passiveName: "Lima Unsur",
    passiveId: "five-elements",
    description: "Staff, Fire, Water, Wind, Earth, dan Lightning."
  },
  pujangga: {
    ...CORE_JOBS.wizard,
    id: "wizard",
    name: "Pujangga",
    role: "Curse / Debuff / Illusion",
    weapon: "wand",
    resource: "mana",
    resourceName: "Mana",
    color: "#9474b5",
    coreJob: "wizard",
    specializations: ["resi", "pujangga"],
    passiveName: "Ilmu Mantra",
    passiveId: "mantra-lore",
    description: "Wand, curse, debuff, illusion, dan DoT."
  },
  pandita: {
    ...CORE_JOBS.acolyte,
    id: "acolyte",
    name: "Pandita",
    role: "Heal / Buff / Barrier",
    weapon: "relic",
    resource: "mana",
    resourceName: "Mana",
    color: "#d3b86e",
    coreJob: "acolyte",
    specializations: ["pandita", "bajra"],
    passiveName: "Welas Asih",
    passiveId: "compassion",
    description: "Relic, heal, buff, cleanse, dan barrier solo."
  },
  bajra: {
    ...CORE_JOBS.acolyte,
    id: "acolyte",
    name: "Bajra",
    role: "Holy Melee / Sustain",
    weapon: "holy_knuckle",
    resource: "mana",
    resourceName: "Mana",
    color: "#d28b56",
    coreJob: "acolyte",
    specializations: ["pandita", "bajra"],
    passiveName: "Tekad Dharma",
    passiveId: "dharma-will",
    description: "Holy knuckle, stun, self-heal, dan holy aura."
  }
};
var PASSIVES = {
  gatotkaca: {
    id: "iron-muscle",
    name: "Otot Baja",
    description: "Legacy passive; REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
    specialization: "gatotkaca",
    maxLevel: 3,
    unlockLevel: 25
  },
  garda: {
    id: "gatekeeper",
    name: "Penjaga Gerbang",
    description: "Meningkatkan block, guard strength, dan perlindungan party.",
    specialization: "garda",
    maxLevel: 3,
    unlockLevel: 25
  },
  caroq: {
    id: "caroq-rhythm",
    name: "Ritme Caroq",
    description: "Combo beruntun meningkatkan attack speed dan critical rate.",
    specialization: "caroq",
    maxLevel: 3,
    unlockLevel: 25
  },
  anom: {
    id: "execution-instinct",
    name: "Naluri Eksekutor",
    description: "Meningkatkan critical rate dan critical damage tanpa buff attack speed.",
    specialization: "anom",
    maxLevel: 3,
    unlockLevel: 25
  },
  srikandi: {
    id: "srikandi-eye",
    name: "Mata Srikandi",
    description: "Meningkatkan weak point damage dan critical ranged damage.",
    specialization: "srikandi",
    maxLevel: 3,
    unlockLevel: 25
  },
  jagawana: {
    id: "forest-warden",
    name: "Penjaga Rimba",
    description: "Meningkatkan durasi trap, poison damage, dan radius control.",
    specialization: "jagawana",
    maxLevel: 3,
    unlockLevel: 25
  },
  resi: {
    id: "five-elements",
    name: "Lima Unsur",
    description: "Meningkatkan elemental damage dan bonus terhadap elemental weakness.",
    specialization: "resi",
    maxLevel: 3,
    unlockLevel: 25
  },
  pujangga: {
    id: "mantra-lore",
    name: "Ilmu Mantra",
    description: "Meningkatkan durasi debuff dan damage terhadap target curse.",
    specialization: "pujangga",
    maxLevel: 3,
    unlockLevel: 25
  },
  pandita: {
    id: "compassion",
    name: "Welas Asih",
    description: "Meningkatkan healing power, barrier strength, dan buff duration.",
    specialization: "pandita",
    maxLevel: 3,
    unlockLevel: 25
  },
  bajra: {
    id: "dharma-will",
    name: "Tekad Dharma",
    description: "Meningkatkan holy damage, stun resistance, dan self-healing.",
    specialization: "bajra",
    maxLevel: 3,
    unlockLevel: 25
  }
};
var skill = (data) => ({
  usableFromHotbar: true,
  hotbarCategory: "primary",
  skillType: "active",
  actionType: data.effect === "heal" ? "heal" : data.effect === "buff" ? "buff" : data.effect === "debuff" ? "debuff" : data.effect === "barrier" ? "barrier" : "skill",
  tags: [],
  skillPowerCoefficient: 0,
  specialization: null,
  unlockLevel: data.slot === 4 ? 45 : data.job === "adventurer" ? 1 : 10,
  maxLevel: 5,
  manaCost: data.slot === 4 ? 50 : 15 + data.slot * 5,
  cooldown: data.slot === 4 ? 25 : 3 + data.slot * 1.5,
  castingTime: 0,
  baseDamage: 20,
  scalingStat: "attack",
  damageCoefficient: 1,
  targetType: "single",
  range: 5,
  areaRadius: data.effect === "aoe_damage" || data.effect === "ultimate" ? 5 : 0,
  duration: 2,
  statusEffect: null,
  animation: data.effect,
  visualEffect: data.effect,
  soundEffect: "skill",
  weaponRequirement: [],
  masteryOptions: ["power", "control", "utility"],
  ...data
});
var ADVENTURER_SKILLS = [
  skill({
    id: "fajar-step",
    name: "Langkah Fajar",
    description: "Dash pendek ke arah target. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
    job: "adventurer",
    slot: 1,
    effect: "dash_damage",
    manaCost: 10,
    cooldown: 4,
    baseDamage: 18,
    range: 5,
    visualEffect: "dash"
  }),
  skill({
    id: "fajar-strike",
    name: "Tebasan Fajar",
    description: "Serangan pedang yang memperkuat basic attack berikutnya.",
    job: "adventurer",
    slot: 2,
    effect: "damage",
    manaCost: 15,
    cooldown: 5,
    baseDamage: 30,
    visualEffect: "slash"
  }),
  skill({
    id: "guard-stance",
    name: "Sikap Penjaga",
    description: "Mengurangi damage masuk dan membuka parry dasar selama durasi singkat.",
    job: "adventurer",
    slot: 3,
    effect: "parry",
    manaCost: 20,
    cooldown: 8,
    duration: 3,
    visualEffect: "barrier"
  }),
  skill({
    id: "nova-fajar",
    name: "Nova Fajar",
    description: "Ledakan cahaya area yang menyerang semua monster di sekitar.",
    job: "adventurer",
    slot: 4,
    effect: "ultimate",
    manaCost: 50,
    cooldown: 25,
    baseDamage: 65,
    damageCoefficient: 1.4,
    visualEffect: "nova"
  })
];
var coreSkill = (job, slot, id3, name, description, effect, visualEffect = effect) => skill({
  id: id3,
  name,
  description,
  job,
  slot,
  effect,
  unlockLevel: 10,
  manaCost: slot === 4 ? 50 : 15 + slot * 5,
  cooldown: slot === 4 ? 25 : 3 + slot * 1.4,
  baseDamage: slot === 3 ? 30 : slot === 4 ? 70 : 24,
  damageCoefficient: slot === 4 ? 1.5 : 1,
  visualEffect
});
var CORE_SKILLS = [
  coreSkill(
    "warrior",
    1,
    "warrior-breaker",
    "Hantaman Prajurit",
    "Pukulan berat. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
    "stun",
    "shockwave"
  ),
  coreSkill(
    "warrior",
    2,
    "warrior-charge",
    "Charge Baja",
    "Terjang ke musuh dan mendorongnya.",
    "dash_damage",
    "dash"
  ),
  coreSkill(
    "warrior",
    3,
    "warrior-guard",
    "Guard Tekad",
    "Bertahan dan mengurangi damage masuk.",
    "barrier",
    "barrier"
  ),
  coreSkill(
    "warrior",
    4,
    "warrior-awakening",
    "Kebangkitan Warrior",
    "Ledakan kekuatan melee area.",
    "ultimate",
    "shockwave"
  ),
  coreSkill(
    "rogue",
    1,
    "rogue-step",
    "Langkah Bayang",
    "Dash melewati target.",
    "dash_damage",
    "dash"
  ),
  coreSkill(
    "rogue",
    2,
    "rogue-flurry",
    "Belati Cepat",
    "Banyak hit dengan peluang critical.",
    "rapid_damage",
    "slash"
  ),
  coreSkill(
    "rogue",
    3,
    "rogue-vanish",
    "Vanish",
    "Menghilang sebentar.",
    "stealth",
    "stealth"
  ),
  coreSkill(
    "rogue",
    4,
    "rogue-awakening",
    "Kebangkitan Rogue",
    "Kombo dual dagger sangat cepat.",
    "ultimate",
    "slash"
  ),
  coreSkill(
    "hunter",
    1,
    "hunter-aim",
    "Bidikan Pemburu",
    "Serangan jarak jauh ke titik lemah.",
    "mark",
    "arrow"
  ),
  coreSkill(
    "hunter",
    2,
    "hunter-volley",
    "Volley",
    "Hujan panah area.",
    "aoe_damage",
    "arrow"
  ),
  coreSkill(
    "hunter",
    3,
    "hunter-bind",
    "Panah Penahan",
    "Memperlambat target.",
    "slow",
    "root"
  ),
  coreSkill(
    "hunter",
    4,
    "hunter-awakening",
    "Kebangkitan Hunter",
    "Hujan anak panah besar.",
    "ultimate",
    "arrow"
  ),
  coreSkill(
    "wizard",
    1,
    "wizard-bolt",
    "Arcane Bolt",
    "Proyektil elemen sederhana.",
    "elemental",
    "thunder"
  ),
  coreSkill(
    "wizard",
    2,
    "wizard-circle",
    "Lingkar Cakrawala",
    "Ledakan sihir area.",
    "aoe_damage",
    "magic"
  ),
  coreSkill(
    "wizard",
    3,
    "wizard-chain",
    "Rantai Unsur",
    "Serangan yang memantul ke target dekat.",
    "chain",
    "thunder"
  ),
  coreSkill(
    "wizard",
    4,
    "wizard-awakening",
    "Kebangkitan Wizard",
    "Ledakan elemen besar.",
    "ultimate",
    "meteor"
  ),
  coreSkill(
    "acolyte",
    1,
    "acolyte-blessing",
    "Berkah Awal",
    "Buff singkat untuk serangan dan pertahanan.",
    "buff",
    "heal"
  ),
  coreSkill(
    "acolyte",
    2,
    "acolyte-heal",
    "Sembuh Seketika",
    "Memulihkan HP diri sendiri.",
    "heal",
    "heal"
  ),
  coreSkill(
    "acolyte",
    3,
    "acolyte-barrier",
    "Perisai Cahaya",
    "Membuat barrier sementara.",
    "barrier",
    "barrier"
  ),
  coreSkill(
    "acolyte",
    4,
    "acolyte-awakening",
    "Kebangkitan Acolyte",
    "Gelombang holy untuk damage dan heal.",
    "ultimate",
    "heal"
  )
];
var special = (job, specialization, values) => values.map(
  ([id3, name, description, effect, visualEffect, extra]) => skill({
    id: id3,
    name,
    description,
    job,
    specialization,
    slot: Number(
      id3.endsWith("-4") ? 4 : id3.endsWith("-3") ? 3 : id3.endsWith("-2") ? 2 : 1
    ),
    unlockLevel: id3.endsWith("-4") ? 45 : 25,
    effect,
    visualEffect,
    ...extra
  })
);
var SPECIAL_SKILLS = [
  ...special("warrior", "gatotkaca", [
    [
      "gatotkaca-1",
      "Lompatan Guntur",
      "Melompat ke target dan menghantam area. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
      "dash_damage",
      "thunder"
    ],
    [
      "gatotkaca-2",
      "Tinju Bumi",
      "Pukulan berat ke tanah dengan physical AoE.",
      "aoe_damage",
      "shockwave"
    ],
    [
      "gatotkaca-3",
      "Hantaman Langit",
      "Shockwave besar dengan knock-up.",
      "stun",
      "shockwave",
      { areaRadius: 5.5, statusEffect: "knockup" }
    ],
    [
      "gatotkaca-4",
      "Amukan Gatotkaca",
      "Super armor, damage reduction, dan serangan AoE beruntun.",
      "ultimate",
      "thunder",
      { baseDamage: 95 }
    ]
  ]),
  ...special("warrior", "garda", [
    [
      "garda-1",
      "Charge Perisai",
      "Menerjang musuh dan taunt. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
      "dash_damage",
      "barrier",
      { statusEffect: "taunt", weaponRequirement: ["sword_shield"] }
    ],
    [
      "garda-2",
      "Tumbukan Gada",
      "Serangan berat yang menurunkan defense target.",
      "debuff",
      "shockwave",
      { statusEffect: "defenseDown" }
    ],
    [
      "garda-3",
      "Benteng Nusantara",
      "Zona perlindungan yang mengurangi damage.",
      "barrier",
      "barrier",
      { targetType: "self", areaRadius: 4 }
    ],
    [
      "garda-4",
      "Sumpah Garda",
      "Barrier, taunt area, damage reduction, dan pemulihan HP.",
      "ultimate",
      "barrier",
      { baseDamage: 45 }
    ]
  ]),
  ...special("rogue", "caroq", [
    [
      "caroq-1",
      "Langkah Caroq",
      "Dash ke belakang target dengan bonus damage.",
      "dash_damage",
      "slash",
      { weaponRequirement: ["dual_dagger"] }
    ],
    [
      "caroq-2",
      "Badai Belati",
      "Serangan cepat beruntun dengan peluang critical tinggi.",
      "rapid_damage",
      "slash"
    ],
    [
      "caroq-3",
      "Hilang Sekejap",
      "Menghilang sementara; serangan berikutnya critical.",
      "stealth",
      "stealth"
    ],
    [
      "caroq-4",
      "Tarian Caroq",
      "Serangan dual dagger sangat cepat dengan critical.",
      "ultimate",
      "slash",
      { baseDamage: 100 }
    ]
  ]),
  ...special("rogue", "anom", [
    [
      "anom-1",
      "Tanda Senyap",
      "Memberi Mark dan bonus damage dari belakang.",
      "mark",
      "curse",
      { statusEffect: "critical" }
    ],
    [
      "anom-2",
      "Tebasan Anom",
      "Damage meningkat terhadap target ber-Mark.",
      "damage",
      "slash",
      { damageCoefficient: 1.35 }
    ],
    [
      "anom-3",
      "Bayang Tanpa Jejak",
      "Stealth singkat dengan bonus critical damage.",
      "stealth",
      "stealth"
    ],
    [
      "anom-4",
      "Vonis Anom",
      "Eksekusi single-target terhadap target ber-HP rendah atau ber-Mark.",
      "execute",
      "slash",
      { baseDamage: 120, targetType: "single" }
    ]
  ]),
  ...special("hunter", "srikandi", [
    [
      "srikandi-1",
      "Panah Bidik",
      "Serangan presisi yang menandai weak point.",
      "mark",
      "arrow",
      { statusEffect: "weakPoint", weaponRequirement: ["bow"] }
    ],
    [
      "srikandi-2",
      "Hujan Srikandi",
      "Volley panah area, lebih kuat terhadap Weak Point.",
      "aoe_damage",
      "arrow"
    ],
    [
      "srikandi-3",
      "Panah Penahan",
      "Memperlambat atau mengikat target.",
      "slow",
      "root",
      { statusEffect: "slow" }
    ],
    [
      "srikandi-4",
      "Badai Anak Panah",
      "Hujan panah besar ke area luas.",
      "ultimate",
      "arrow",
      { baseDamage: 105 }
    ]
  ]),
  ...special("hunter", "jagawana", [
    [
      "jagawana-1",
      "Jerat Rimba",
      "Trap yang memberi slow atau root.",
      "root",
      "root",
      { statusEffect: "root", weaponRequirement: ["bow_trap"] }
    ],
    [
      "jagawana-2",
      "Panah Racun",
      "Panah dengan poison damage berkala.",
      "poison",
      "poison",
      { statusEffect: "poison" }
    ],
    [
      "jagawana-3",
      "Jaring Hutan",
      "Mengikat beberapa musuh di area.",
      "root",
      "root",
      { targetType: "area", areaRadius: 4 }
    ],
    [
      "jagawana-4",
      "Kawasan Perburuan",
      "Zona trap, poison, slow, dan damage berkala.",
      "ultimate",
      "poison",
      { baseDamage: 70 }
    ]
  ]),
  ...special("wizard", "resi", [
    [
      "resi-1",
      "Elemental Invocation",
      "Serangan elemen yang dapat mengeksploitasi weakness.",
      "elemental",
      "thunder",
      { weaponRequirement: ["staff"] }
    ],
    [
      "resi-2",
      "Lingkar Cakrawala",
      "AoE elemental damage.",
      "aoe_damage",
      "magic"
    ],
    [
      "resi-3",
      "Rantai Unsur",
      "Menggabungkan efek elemen dan memantul.",
      "chain",
      "thunder",
      { statusEffect: "stun" }
    ],
    [
      "resi-4",
      "Murka Lima Unsur",
      "Gabungan lima elemen dengan damage area besar.",
      "ultimate",
      "meteor",
      { baseDamage: 125 }
    ]
  ]),
  ...special("wizard", "pujangga", [
    [
      "pujangga-1",
      "Mantra Tanda",
      "Memberi curse mark kepada target.",
      "mark",
      "curse",
      { statusEffect: "curse", weaponRequirement: ["wand", "talisman"] }
    ],
    [
      "pujangga-2",
      "Kutuk Aksara",
      "Mengurangi defense dan memberikan DoT.",
      "debuff",
      "curse",
      { statusEffect: "defenseDown" }
    ],
    [
      "pujangga-3",
      "Bayang Ilusi",
      "Area gangguan yang memberi slow dan mengacaukan target.",
      "illusion",
      "illusion",
      { statusEffect: "slow", targetType: "area" }
    ],
    [
      "pujangga-4",
      "Kidung Kehancuran",
      "Damage meningkat berdasarkan jumlah debuff target.",
      "ultimate",
      "curse",
      { baseDamage: 115 }
    ]
  ]),
  ...special("acolyte", "pandita", [
    [
      "pandita-1",
      "Berkah Pandita",
      "Buff attack dan defense untuk pertarungan solo.",
      "buff",
      "heal",
      { weaponRequirement: ["relic", "staff"] }
    ],
    [
      "pandita-2",
      "Sembuh Seketika",
      "Memulihkan HP diri sendiri.",
      "heal",
      "heal",
      { targetType: "self" }
    ],
    [
      "pandita-3",
      "Perisai Dharma",
      "Barrier dan pembersihan debuff.",
      "barrier",
      "barrier",
      { statusEffect: "barrier" }
    ],
    [
      // LEGACY_SEMANTIC_MISMATCH: owner-approved offensive caster-area ultimate;
      // healing/protection wording is retained pending future Job V2 content.
      "pandita-4",
      "Doa Keselamatan",
      "AoE heal, damage reduction, dan perlindungan.",
      "ultimate",
      "heal",
      { baseDamage: 45 }
    ]
  ]),
  ...special("acolyte", "bajra", [
    [
      "bajra-1",
      "Pukulan Bajra",
      "Holy melee. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.",
      "stun",
      "holy",
      { weaponRequirement: ["holy_knuckle", "mace"] }
    ],
    [
      "bajra-2",
      "Ritus Cahaya",
      "AoE holy damage, bonus melawan dark.",
      "aoe_damage",
      "holy"
    ],
    [
      "bajra-3",
      "Telapak Penolak",
      "Parry atau knockback dan self-heal.",
      "parry",
      "holy",
      {}
    ],
    [
      "bajra-4",
      "Amarah Dharma",
      "Aura holy dengan damage area dan self-healing.",
      "ultimate",
      "holy",
      { baseDamage: 85 }
    ]
  ])
];
var ALL_SKILLS = [
  ...ADVENTURER_SKILLS,
  ...CORE_SKILLS,
  ...SPECIAL_SKILLS,
  ...WARRIOR_V2_ACTIVE,
  ...THIEF_V2_ACTIVE
];
var PASSIVE_EFFECTS = {
  "iron-muscle": { physicalDamage: 2 },
  gatekeeper: { blockRate: 3, defense: 4 },
  "caroq-rhythm": { attackSpeed: 2, critRate: 1 },
  "execution-instinct": { critRate: 2, critDamage: 4 },
  "srikandi-eye": { critDamage: 3, attackPercent: 2 },
  "forest-warden": { skillDamage: 3, evasion: 1 },
  "five-elements": { magicAttack: 3, skillDamage: 2 },
  "mantra-lore": { skillDamage: 3, skillPower: 2 },
  compassion: { healingPower: 4, defense: 2 },
  "dharma-will": { healingPower: 2, physicalDamage: 3 },
  "adventurer-resolve": { hp: 10, defense: 1 },
  "warrior-foundation": { attack: 2, defense: 2 },
  "rogue-foundation": { critRate: 1, evasion: 1 },
  "hunter-foundation": { attackPercent: 2, accuracy: 1 },
  "wizard-foundation": { magicAttack: 2, skillPower: 2 },
  "acolyte-foundation": { healingPower: 3, defense: 1 }
};
var ALL_PASSIVES = [
  ...WARRIOR_V2_PASSIVES,
  ...THIEF_V2_PASSIVES,
  { id: "adventurer-resolve", name: "Tekad Petualang", description: "Setiap level memberi +10 HP dan +1 Defense.", specialization: null, job: "adventurer", tier: "adventurer", maxLevel: 3, unlockLevel: 1 },
  ...Object.values(CORE_JOBS).map((job) => ({ id: `${job.id}-foundation`, name: job.passiveName, description: `Latihan dasar ${job.name} memperkuat atribut utama job.`, specialization: null, job: job.id, tier: "core", maxLevel: 3, unlockLevel: 10 })),
  ...Object.values(PASSIVES).map((passive3) => ({ ...passive3, job: SPECIALIZATIONS[passive3.specialization].coreJob, tier: "specialization" })),
  ...Object.entries(SPECIALIZATIONS).map(([id3, job]) => ({ id: `${id3}-capstone`, name: `Warisan ${job.name}`, description: `Puncak latihan ${job.name}: memperkuat passive utama. Memerlukan Mastery dan passive utama level 3.`, specialization: id3, job: job.coreJob, tier: "capstone", maxLevel: 1, unlockLevel: 50, prerequisiteSkillIds: [PASSIVES[id3].id] }))
];
for (const [id3] of Object.entries(SPECIALIZATIONS)) {
  PASSIVE_EFFECTS[`${id3}-capstone`] = Object.fromEntries(Object.entries(PASSIVE_EFFECTS[PASSIVES[id3].id]).map(([stat, value]) => [stat, value * 2]));
}
var legacyCoreJob = (id3) => CORE_JOBS[id3];

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\combat-status.ts
var aliases = {
  armor_break: "defenseDown",
  mark: "marked",
  weak_point: "weakPoint"
};
var legacyFields = /* @__PURE__ */ new Set([
  "stun",
  "slow",
  "root",
  "poison",
  "defenseDown",
  "marked",
  "weakPoint"
]);
var canonicalStatus = (id3) => aliases[id3] ?? id3;
function getStatus(target, id3) {
  const key2 = canonicalStatus(id3);
  if (key2 === "marked" || key2 === "weakPoint") return target[key2] || target.statusEffects?.[key2];
  if (legacyFields.has(key2) && key2 in target)
    return target[key2];
  return target.statusEffects?.[key2];
}
function hasStatus(target, id3) {
  return Number(getStatus(target, id3) ?? 0) > 0;
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\combat-position.ts
function relativePosition(context, angles = {}) {
  const { attackerPosition: a, targetPosition: t, targetForward: f } = context;
  const x = a.x - t.x, z = a.z - t.z, d = Math.hypot(x, z), length = Math.hypot(f.x, f.z);
  if (!Number.isFinite(d + length) || d < 1e-8 || length < 1e-8) return void 0;
  const cone = (value) => Number.isFinite(value) ? Math.min(180, Math.max(0, value)) : 90;
  const dot = Math.min(1, Math.max(-1, (x * f.x + z * f.z) / (d * length)));
  if (dot >= Math.cos(cone(angles.frontAngle) * Math.PI / 360) - 1e-10) return "front";
  if (-dot >= Math.cos(cone(angles.rearAngle) * Math.PI / 360) - 1e-10) return "rear";
  return "side";
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\personal-mark.ts
var marks = /* @__PURE__ */ new WeakMap();
var key = (source) => JSON.stringify([source.sourceActorId, source.sourceGeneration]);
function personalMark(target, source) {
  const entry = marks.get(target)?.get(key(source));
  return entry && entry.mark.remaining > 0 && entry.valid() ? entry.mark : void 0;
}
var markedBy = (target, source) => !!personalMark(target, source);
var markedBySelf = markedBy;

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\combat-modifiers.ts
var NO_COUNTER = Object.freeze({ result: "none" });
var hasImpactCondition = (mod) => !!(mod.condition?.markedBySelf !== void 0 || mod.condition?.targetStatuses?.length || mod.condition?.attackerStealthed !== void 0 || mod.condition?.targetPosition);
function impactMatches(mod, ctx) {
  const c = mod.condition;
  return (!c?.targetStatuses?.length || !!ctx.target && c.targetStatuses.every((id3) => hasStatus(ctx.target, id3))) && (c?.markedBySelf === void 0 || !!ctx.target && !!ctx.source && markedBySelf(ctx.target, ctx.source) === c.markedBySelf) && (c?.attackerStealthed === void 0 || ctx.attackerStealthed === c.attackerStealthed) && (!c?.targetPosition || !!ctx.position && relativePosition(ctx.position, c.positionAngles) === c.targetPosition);
}
var finite = (n) => Number.isFinite(n) ? n : 0;
var stages = { passive: 0, weapon: 1, temporary: 2, context: 3 };
var orderedModifiers = (mods) => [...mods].sort(
  (a, b) => stages[a.stage ?? "passive"] - stages[b.stage ?? "passive"]
);
function modifierMatches(mod, ctx, action) {
  const s = mod.selector, c = mod.condition;
  if (c?.guardingOrBuff && !ctx.manualGuard && !ctx.activeModifierIds?.includes(c.guardingOrBuff))
    return false;
  if (s?.weaponStyles && !s.weaponStyles.includes(ctx.weaponStyle))
    return false;
  if (s?.tags && !s.tags.every((tag2) => action?.tags?.includes(tag2)))
    return false;
  if (s?.tree && (action?.tree?.id !== s.tree.id || action.tree.architecture !== s.tree.architecture))
    return false;
  if (c?.hpAtOrBelow !== void 0 && (!(ctx.maxHP > 0) || ctx.hp / ctx.maxHP > c.hpAtOrBelow))
    return false;
  if (c?.counter && !c.counter.some((result) => result === ctx.counter?.result))
    return false;
  return true;
}
function modifiedHit(hit, mod) {
  const a = mod.action;
  const factor = (n) => Math.max(0, 1 + finite(n) / 100);
  return {
    ...hit,
    criticalRate: Math.min(100, Math.max(0, hit.criticalRate + finite(a?.criticalRateBonus))),
    criticalDamage: Math.max(0, hit.criticalDamage + finite(a?.criticalDamageBonus)),
    accuracy: Math.max(0, hit.accuracy + finite(a?.accuracyBonus)),
    damageMultiplier: hit.damageMultiplier * factor(a?.damagePercent),
    knockbackStrength: hit.knockbackStrength * factor(a?.knockbackPercent)
  };
}
function scopedHit(hit, mods) {
  const composition = structuredClone(
    hit.scopedComposition ?? {
      base: {
        damageMultiplier: hit.damageMultiplier,
        knockbackStrength: hit.knockbackStrength
      },
      normal: { damageMultiplier: 0, knockbackStrength: 0 },
      payoff: { damageMultiplier: 1, knockbackStrength: 1 }
    }
  );
  for (const mod of mods)
    for (const [key2, property] of [
      ["damageMultiplier", "damagePercent"],
      ["knockbackStrength", "knockbackPercent"]
    ]) {
      const bonus = finite(mod.action?.[property]) / 100;
      if (mod.layer === "payoff" && mod.payoffGroup) {
        composition.groups ??= {};
        const group = composition.groups[mod.payoffGroup] ??= {
          damageMultiplier: 0,
          knockbackStrength: 0
        };
        group[key2] += bonus;
      } else if (mod.layer === "payoff")
        composition.payoff[key2] *= Math.max(0, 1 + bonus);
      else composition.normal[key2] += bonus;
    }
  const result = {
    ...hit,
    scopedComposition: composition,
    criticalRate: Math.min(100, Math.max(0, hit.criticalRate + mods.reduce((s, m) => s + finite(m.action?.criticalRateBonus), 0))),
    criticalDamage: Math.max(0, hit.criticalDamage + mods.reduce((s, m) => s + finite(m.action?.criticalDamageBonus), 0)),
    accuracy: Math.max(0, hit.accuracy + mods.reduce((s, m) => s + finite(m.action?.accuracyBonus), 0))
  };
  for (const key2 of [
    "damageMultiplier",
    "knockbackStrength"
  ])
    result[key2] = composition.base[key2] * Math.max(0, 1 + composition.normal[key2]) * composition.payoff[key2] * Object.values(composition.groups ?? {}).reduce(
      (factor, g) => factor * Math.max(0, 1 + g[key2]),
      1
    );
  return result;
}
function applyActionModifiers(action, mods, ctx) {
  const result = structuredClone(action);
  result.targetModifiers = [];
  result.counterContext = Object.freeze({ ...action.counterContext });
  const immediate = [];
  for (const mod of orderedModifiers(mods)) {
    if (!mod.action || !modifierMatches(mod, ctx, result)) continue;
    if (hasImpactCondition(mod)) {
      if (mod.conditionTiming !== "cast") {
        result.targetModifiers.push(structuredClone(mod));
        continue;
      }
      if (!impactMatches(mod, ctx.impact ?? {})) continue;
    }
    if (result.modifierComposition === "scoped_additive") {
      immediate.push(mod);
      continue;
    }
    result.hitSequence = result.hitSequence.map((hit) => modifiedHit(hit, mod));
    result.cooldown *= Math.max(
      0,
      1 + finite(mod.action.cooldownPercent) / 100
    );
    result.manaCost = Math.max(
      0,
      Math.ceil(
        result.manaCost * Math.max(0, 1 + finite(mod.action.manaPercent) / 100)
      )
    );
  }
  if (result.modifierComposition === "scoped_additive") {
    result.hitSequence = result.hitSequence.map(
      (hit) => scopedHit(hit, immediate)
    );
    for (const [key2, property] of [
      ["cooldown", "cooldownPercent"],
      ["manaCost", "manaPercent"]
    ]) {
      const normal = immediate.filter((m) => m.layer !== "payoff").reduce((sum, m) => sum + finite(m.action?.[property]) / 100, 0);
      const payoff = immediate.filter((m) => m.layer === "payoff").reduce(
        (product, m) => product * Math.max(0, 1 + finite(m.action?.[property]) / 100),
        1
      );
      result[key2] *= Math.max(0, 1 + normal) * payoff;
    }
    result.manaCost = Math.ceil(result.manaCost);
    result.duration = Math.max(0, result.duration * (1 + immediate.reduce((s, m) => s + finite(m.action?.durationPercent), 0) / 100) + immediate.reduce((s, m) => s + finite(m.action?.durationBonus), 0));
    result.movementDistance = Math.max(0, (result.movementDistance ?? 0) + immediate.reduce((s, m) => s + finite(m.action?.movementDistanceBonus), 0));
    const statusBonus = immediate.reduce((s, m) => s + finite(m.action?.statusDurationBonus), 0);
    if (statusBonus) result.hitSequence = result.hitSequence.map((hit) => ({ ...hit, statuses: hit.statuses.map((status2) => ({ ...status2, duration: Math.max(0, status2.duration + statusBonus) })) }));
  }
  return result;
}
function resolveTargetHit(hit, mods, target, now, context = {}) {
  let result = { ...hit };
  const eligible = mods.filter((mod) => impactMatches(mod, { ...context, target, now }));
  if (hit.scopedComposition) return scopedHit(hit, eligible);
  for (const mod of eligible) result = modifiedHit(result, mod);
  return result;
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\skill-action.ts
var safe = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;
var valueKeys = [
  "baseDamage",
  "physicalCoefficient",
  "magicCoefficient",
  "skillPowerCoefficient",
  "manaCost",
  "cooldown",
  "castingTime",
  "range",
  "radius",
  "maxTargets",
  "duration",
  "knockbackStrength",
  "movementDistance"
];
function resolveSkillAction(definition, context) {
  const skill2 = structuredClone(definition);
  if (skill2.counterPolicy && context.combat?.counter?.result && (context.combat.counter.result === "none" || !skill2.counterPolicy.accepted.includes(context.combat.counter.result)))
    context = {
      ...context,
      combat: { ...context.combat, counter: NO_COUNTER }
    };
  const explicit = skill2.progressionMode === "rank_values";
  const rank = Math.min(
    Math.max(explicit ? 1 : 0, Math.floor(safe(context.rank, 1))),
    Math.max(1, skill2.maxLevel)
  );
  const legacy = skillCombatScaling(skill2);
  const values = {
    baseDamage: skill2.baseDamage,
    physicalCoefficient: explicit ? skill2.physicalCoefficient ?? 0 : legacy.physical * skill2.damageCoefficient,
    magicCoefficient: explicit ? skill2.magicCoefficient ?? 0 : legacy.magic * skill2.damageCoefficient,
    skillPowerCoefficient: explicit ? skill2.skillPowerCoefficient ?? 0 : legacy.skillPower * skill2.damageCoefficient,
    manaCost: skill2.manaCost,
    cooldown: skill2.cooldown,
    castingTime: skill2.castingTime,
    range: skill2.range,
    radius: skill2.areaRadius,
    duration: skill2.duration,
    knockbackStrength: skill2.knockbackStrength ?? (skill2.effect === "stun" || skill2.effect === "ultimate" ? 1.4 : 0.45),
    movementDistance: skill2.movementDistance ?? 0
  };
  let statScaling = skill2.statScaling ?? {};
  for (const key2 of valueKeys) values[key2] = safe(values[key2]);
  const applyValues = (patch) => {
    for (const key2 of valueKeys)
      if (patch?.[key2] !== void 0 && Number.isFinite(patch[key2]))
        values[key2] = safe(patch[key2]);
    if (patch?.statScaling) statScaling = { ...statScaling, ...patch.statScaling };
  };
  if (explicit)
    for (const entry of (skill2.rankValues ?? []).slice(0, rank))
      applyValues(entry);
  const rankEffect = explicit ? skill2.rankEffects?.[rank - 1] : void 0;
  if (rankEffect) {
    if (rankEffect.modifiers)
      skill2.modifiers = structuredClone(rankEffect.modifiers);
    if (rankEffect.temporaryBuffs)
      skill2.temporaryBuffs = structuredClone(rankEffect.temporaryBuffs);
    if (rankEffect.statuses)
      skill2.statuses = structuredClone(rankEffect.statuses);
    if (rankEffect.hitSequence)
      skill2.hitSequence = structuredClone(rankEffect.hitSequence);
    const counter2 = context.combat?.counter?.result;
  }
  const statuses = [...skill2.statuses ?? []];
  const tags = [...skill2.tags ?? []];
  let sequence = skill2.hitSequence;
  if (explicit)
    for (let threshold = 1; threshold <= rank; threshold++) {
      const mechanic = skill2.rankMechanics?.[threshold];
      applyValues(mechanic?.values);
      statuses.push(...mechanic?.addStatuses ?? []);
      tags.push(...mechanic?.addTags ?? []);
      if (mechanic?.hitSequence) sequence = mechanic.hitSequence;
    }
  const damageType = skill2.damageType ?? (explicit ? "physical" : legacy.damageType);
  const damageMultiplier = (explicit ? 1 : 1 + (rank - 1) * 0.12) * context.masteryPower * (1 + context.equipmentDamage) * (1 + safe(context.stats.skillDamage) / 100);
  const hits = sequence?.length ? sequence : [{ delay: 0, ...values }];
  const hitSequence = hits.map((hit) => ({
    delay: safe(hit.delay),
    // Explicit V3 stat scaling is resolved exactly once into the hit's flat
    // portion. This keeps it separate from CFV3 physical weapon attack.
    baseDamage: safe(hit.baseDamage) + (statScaling.str ?? 0) * (context.primaryStats?.str ?? 0) + (statScaling.vit ?? 0) * (context.primaryStats?.vit ?? 0) + (statScaling.dex ?? 0) * (context.primaryStats?.dex ?? 0) + (statScaling.int ?? 0) * (context.primaryStats?.int ?? 0),
    physicalCoefficient: safe(hit.physicalCoefficient),
    magicCoefficient: safe(hit.magicCoefficient),
    skillPowerCoefficient: safe(hit.skillPowerCoefficient),
    knockbackStrength: safe(hit.knockbackStrength, values.knockbackStrength),
    damageType,
    damageMultiplier,
    canCrit: skill2.canCrit ?? false,
    criticalRate: context.stats.criticalRate,
    criticalDamage: context.stats.criticalDamage,
    accuracy: context.stats.accuracy,
    statuses: [...statuses, ...hit.statusEffect ? [hit.statusEffect] : []]
  })).sort((a, b) => a.delay - b.delay);
  const result = {
    ...skill2,
    modifierComposition: context.v2 ? "scoped_additive" : skill2.modifierComposition ?? "legacy",
    actionLockDuration: safe(skill2.actionLockDuration),
    movementAllowedDuringLock: skill2.movementAllowedDuringLock ?? true,
    targetModifiers: [],
    counterContext: context.combat?.counter ?? NO_COUNTER,
    ...values,
    areaRadius: values.radius,
    skillId: skill2.id,
    rank,
    damageType,
    manaCost: Math.max(
      0,
      Math.ceil(values.manaCost * (1 - context.stats.manaCostReduction / 100))
    ),
    cooldown: values.cooldown * context.masteryCooldown * (1 - Math.min(0.3, context.stats.cooldownReduction / 100)),
    tags: [...new Set(tags)],
    statuses,
    damageMultiplier,
    hitSequence,
    angle: safe(skill2.angle, 90),
    maxTargets: values.maxTargets !== void 0 ? Math.floor(safe(values.maxTargets)) : skill2.maxTargets === void 0 ? void 0 : Math.floor(safe(skill2.maxTargets)),
    weaponAllowed: context.weaponAllowed,
    resolvedWeaponStyle: context.weaponStyle,
    // Legacy casts impact immediately. Explicit sequences are anchored to cast start too.
    timing: {
      castStart: 0,
      impact: hitSequence[0].delay,
      castEnd: Math.max(values.castingTime, hitSequence.at(-1).delay)
    }
  };
  const modified = applyActionModifiers(
    result,
    [...context.modifiers ?? [], ...skill2.modifiers ?? []],
    context.combat ?? {
      weaponStyle: context.weaponStyle,
      hp: context.stats.maxHP,
      maxHP: context.stats.maxHP
    }
  );
  modified.statuses = modified.hitSequence[0].statuses;
  return modified;
}
function skillHitDamage(hit, stats) {
  return (hit.baseDamage + hit.physicalCoefficient * stats.physicalAttack + hit.magicCoefficient * stats.magicAttack + hit.skillPowerCoefficient * stats.skillPower) * hit.damageMultiplier;
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\combat-mechanics.ts
var COMBAT_MECHANICS = Object.freeze({
  criticalChanceCap: 0.8,
  evasionChanceCap: 0.5,
  blockChanceCap: 0.5,
  blockDamageReduction: 0.3,
  armorBreakDefenseMultiplier: 0.8,
  comboFinisherDamage: 1.65,
  comboFinisherDelay: 0.22,
  poisonInterval: 0.6,
  poisonAttackCoefficient: 0.08,
  poisonMinimumDamage: 2
});
function mitigateDamage(rawDamage, defense, attackerLevel, penetration = 0) {
  const effectiveDefense = Math.max(0, defense * (1 - Math.max(0, penetration) / 100));
  const reduction = effectiveDefense / (effectiveDefense + 500 + Math.max(1, attackerLevel) * 10);
  return Math.max(0, rawDamage * (1 - reduction));
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\stun.ts
var stunChanceForRank = (chanceByRank, rank) => Math.max(0, chanceByRank[Math.max(1, Math.floor(rank)) - 1] ?? 0);
function isStunned(target, now) {
  return Boolean(target.stunState && target.stunState.expiresAt > now);
}
function remainingStun(target, now) {
  return Math.max(0, (target.stunState?.expiresAt ?? 0) - now);
}
function applyStun(target, application) {
  const targetPolicy = target.stunPolicy?.(application) ?? application.targetPolicy;
  if (target.stunImmune || targetPolicy === "IMMUNE") return false;
  const duration = Math.max(0, application.pvp ? application.pvpDuration : application.pveDuration);
  if (!duration) return false;
  const expiresAt = application.now + duration;
  if (target.stunState && target.stunState.expiresAt >= expiresAt) return false;
  target.stunState = {
    sourceActorId: application.sourceActorId,
    sourceSkillId: application.sourceSkillId,
    chance: application.chance,
    pveDuration: application.pveDuration,
    pvpDuration: application.pvpDuration,
    appliedAt: application.now,
    expiresAt,
    targetPolicy
  };
  return true;
}

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\combat-transient.ts
var scaleModifier = (mod, n) => {
  const result = structuredClone(mod);
  const scale = (record) => record ? Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      k,
      typeof v === "number" ? v * n : v
    ])
  ) : void 0;
  result.action = scale(result.action);
  if (result.stats)
    result.stats = {
      flat: scale(result.stats.flat),
      percent: scale(result.stats.percent)
    };
  return result;
};
var TransientCombatState = class {
  stacks = /* @__PURE__ */ new Map();
  windows = /* @__PURE__ */ new Map();
  /** V3 Berserker transient states; never serialized into Hero saves. */
  breakerEntryExpiresAt = 0;
  berserkerTrance = null;
  frenzyGuard = null;
  nextId = 0;
  nextCastId() {
    return ++this.nextId;
  }
  clear() {
    this.stacks.clear();
    this.windows.clear();
    this.breakerEntryExpiresAt = 0;
    this.berserkerTrance = null;
    this.frenzyGuard = null;
  }
  openBreakerEntry(now, duration = 4) {
    this.breakerEntryExpiresAt = now + duration;
  }
  breakerEntryActive(now) {
    return this.breakerEntryExpiresAt > now;
  }
  consumeBreakerEntry(now) {
    if (!this.breakerEntryActive(now)) return false;
    this.breakerEntryExpiresAt = 0;
    return true;
  }
  activateBerserkerTrance(now, rank, duration) {
    this.berserkerTrance = { rank, expiresAt: now + duration };
  }
  updateBerserker(now) {
    if (this.breakerEntryExpiresAt <= now) this.breakerEntryExpiresAt = 0;
    if (this.berserkerTrance && this.berserkerTrance.expiresAt <= now) this.berserkerTrance = null;
    if (this.frenzyGuard && this.frenzyGuard.expiresAt <= now) this.frenzyGuard = null;
  }
  triggerFrenzyGuard(now, reductionPercent, duration = 2) {
    this.frenzyGuard = { reductionPercent, expiresAt: now + duration };
  }
  update(now, style, support) {
    for (const [id3, s] of this.stacks) {
      const def = support.stacks?.find((d) => d.id === id3);
      if (!def || s.expiresAt <= now || def.weaponStyle && def.weaponStyle !== style)
        this.stacks.delete(id3);
    }
    for (const [id3, w] of this.windows) {
      const def = support.windows?.find((d) => d.id === id3);
      if (!def || w.expiresAt <= now || def.weaponStyle !== style)
        this.windows.delete(id3);
    }
  }
  successfulCast(castId, now, style, support, action, consumedWindows = []) {
    this.update(now, style, support);
    for (const def of support.stacks ?? []) {
      if (!(def.duration > 0) || !Number.isFinite(def.duration) || def.weaponStyle && def.weaponStyle !== style || def.triggerTree && (!action || !sameTree(def.triggerTree, action.tree)))
        continue;
      const previous = this.stacks.get(def.id);
      if (previous?.lastEligibleCastId === castId) continue;
      this.stacks.set(def.id, {
        id: def.id,
        stackCount: Math.min(def.maxStacks, 3, (previous?.stackCount ?? 0) + 1),
        maxStacks: Math.min(3, def.maxStacks),
        expiresAt: now + def.duration,
        lastEligibleCastId: castId,
        weaponStyle: def.weaponStyle
      });
    }
    for (const def of support.windows ?? [])
      if (def.openOnSuccess && action && this.eligible(def, action) && def.weaponStyle === style && !consumedWindows.includes(def.id) && def.duration > 0 && Number.isFinite(def.duration))
        this.windows.set(def.id, { expiresAt: now + def.duration });
  }
  stackModifiers(support) {
    return (support.stacks ?? []).flatMap((def) => {
      const s = this.stacks.get(def.id);
      if (!s) return [];
      const mod = scaleModifier(def.modifier, s.stackCount);
      if (def.weaponStyle)
        mod.selector = { ...mod.selector, weaponStyles: [def.weaponStyle] };
      return [mod];
    });
  }
  eligible(def, action) {
    return action.resolvedWeaponStyle === def.weaponStyle && (!def.triggerTree || sameTree(def.triggerTree, action.tree)) && def.tags.every((tag2) => action.tags.includes(tag2));
  }
  windowModifiers(action, support, now) {
    return (support.windows ?? []).filter(
      (def) => this.eligible(def, action) && (this.windows.get(def.id)?.expiresAt ?? 0) > now
    ).map((def) => structuredClone(def.modifier));
  }
  commitWindows(action, support, now) {
    const consumed = [];
    for (const def of support.windows ?? [])
      if (this.eligible(def, action)) {
        if ((this.windows.get(def.id)?.expiresAt ?? 0) > now) {
          this.windows.delete(def.id);
          consumed.push(def.id);
        } else if (!def.openOnSuccess && def.duration > 0 && Number.isFinite(def.duration))
          this.windows.set(def.id, { expiresAt: now + def.duration });
      }
    return consumed;
  }
};
var sameTree = (a, b) => a.id === b?.id && a.architecture === b.architecture;

// safe:C:\Users\USER\Documents\ChatGPT\PROJECT GAME NGEMPER\lib\game\berserker-v3-fixture.ts
var BerserkerV3RuntimeFixture = class {
  hero = { characterId: "spv3-5-fixture", level: 80, hp: 1e3, maxHP: 1e3 };
  targets = [];
  transient = new TransientCombatState();
  time = 0;
  trace = [];
  rng = 0;
  stats() {
    return { physicalAttack: 199, attack: 199, magicAttack: 0, skillPower: 0, physicalPenetration: 0, magicPenetration: 0, criticalRate: 0, criticalDamage: 150, accuracy: 149, physicalDefense: 75, magicDefense: 75, defense: 75, maxHP: 1e3, maxMana: 999, elementalResistance: 0, attackSpeed: 100, movementSpeed: 1, evasion: 0, blockRate: 0, healingPower: 0, hpRecovery: 0, staminaMax: 0, manaCostReduction: 0, manaRecovery: 0, damageReduction: 0, cooldownReduction: 0, bossDamage: 0, eliteDamage: 0, skillDamage: 0, expGain: 0, goldDropRate: 0, itemDropRate: 0, materialDropRate: 0 };
  }
  setTargets(count, armorBreak = false, stunImmuneIds = []) {
    this.targets.length = 0;
    for (let i = 0; i < count; i++) this.targets.push({ id: `target-${i + 1}`, hp: 1e4, maxHP: 1e4, armorBreak, stunImmune: stunImmuneIds.includes(`target-${i + 1}`) });
  }
  action(id3, rank = 1) {
    const definition = id3 === "v3-warrior-iron-charge" ? WARRIOR_V3_RUNTIME_MAP[id3] : BERSERKER_V3_RUNTIME_MAP[id3];
    return resolveSkillAction(definition, { stats: this.stats(), rank, masteryPower: 1, masteryCooldown: 1, equipmentDamage: 0, weaponAllowed: true, weaponStyle: "two_hand_sword", primaryStats: { str: 135, vit: 15, dex: 15, int: 15 } });
  }
  hit(id3, rank, target, damageMultiplier = 1) {
    const action = this.action(id3, rank);
    const hit = resolveTargetHit(action.hitSequence[0], action.targetModifiers, target, this.time);
    const amount = Math.round(mitigateDamage(skillHitDamage(hit, this.stats()) * damageMultiplier, 0, this.hero.level));
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    return { amount, hpBefore: before, hpAfter: target.hp, hit };
  }
  ironChargeImpact() {
    this.transient.openBreakerEntry(this.time, 4);
    this.trace.push({ stage: "iron_charge_impact", breakerEntryExpiresAt: this.transient.breakerEntryExpiresAt });
    return { impact: true, breakerEntryActive: this.transient.breakerEntryActive(this.time) };
  }
  breakerEntry(rank = 1) {
    const available = this.transient.breakerEntryActive(this.time);
    if (!available) return { accepted: false, reason: "NO_BREAKER_ENTRY_WINDOW" };
    const target = this.targets[0] ?? (this.setTargets(1), this.targets[0]);
    const result = this.hit("v3-berserker-breaker-entry", rank, target);
    this.transient.consumeBreakerEntry(this.time);
    return { accepted: true, consumed: !this.transient.breakerEntryActive(this.time), ...result };
  }
  earthSplitter(rank = 1, rng = 0) {
    this.rng = rng;
    const action = this.action("v3-berserker-earth-splitter", rank);
    const cap = action.maxTargets ?? this.targets.length;
    const selected = this.targets.slice(0, cap);
    const results = selected.map((target) => {
      const result = this.hit("v3-berserker-earth-splitter", rank, target);
      const chance = stunChanceForRank(EARTH_SPLITTER_STUN_CHANCE, rank);
      const eligible = this.rng < chance;
      const stunned = eligible && applyStun(target, { sourceActorId: this.hero.characterId, sourceSkillId: action.skillId, chance, pveDuration: 1.5, pvpDuration: 0.75, targetPolicy: "NORMAL", now: this.time });
      return { id: target.id, ...result, eligible, stunned, remainingStun: remainingStun(target, this.time), knockback: 0 };
    });
    return { targetCap: cap, actualTargetsHit: selected.length, results };
  }
  furyHarvest(rank = 1) {
    const action = this.action("v3-berserker-fury-harvest", rank);
    const selected = this.targets.slice(0, action.maxTargets ?? this.targets.length);
    const hits = selected.map((target) => this.hit("v3-berserker-fury-harvest", rank, target));
    const heal = Math.round(this.hero.maxHP * FURY_HARVEST_RECOVERY_PERCENT[rank - 1] / 100 * Math.min(5, hits.length));
    this.hero.hp = Math.min(this.hero.maxHP, this.hero.hp + heal);
    return { actualTargetsHit: hits.length, heal, hp: this.hero.hp, hits };
  }
  trance(rank = 1) {
    const duration = [0, 12, 14, 16][rank];
    this.transient.activateBerserkerTrance(this.time, rank, duration);
    const action = this.action("v3-berserker-raging-cleave", 8);
    const bonus = [0, 0.06, 0.08, 0.1][rank];
    const targetCap = (action.maxTargets ?? 0) + 1;
    const selected = this.targets.slice(0, targetCap);
    const hits = selected.map((target) => this.hit("v3-berserker-raging-cleave", 8, target, 1 + bonus));
    if (hits.length >= 3) this.transient.triggerFrenzyGuard(this.time, [0, 4, 5, 6][rank], 2);
    return { duration, finalDamageBonus: bonus, targetCap, actualTargetsHit: hits.length, frenzyGuard: this.transient.frenzyGuard, hits };
  }
  advance(seconds) {
    this.time += seconds;
    this.transient.updateBerserker(this.time);
    for (const target of this.targets) if (!isStunned(target, this.time)) delete target.stunState;
  }
};

// tests/browser/berserker-fixture.ts
var output = document.querySelector("#output");
var status = document.querySelector("#status");
var run = () => {
  const fixture = new BerserkerV3RuntimeFixture();
  fixture.setTargets(8, true, ["target-8"]);
  const raging = fixture.earthSplitter(5, 0);
  fixture.advance(2);
  const fury = fixture.furyHarvest(5);
  const trance = fixture.trance(3);
  const breaker = fixture.ironChargeImpact();
  const breakerFollowup = fixture.breakerEntry(1);
  const payload = {
    name: "SPV3-5 Berserker V3 clean runtime fixture",
    worldImported: false,
    cases: { raging, fury, trance, breaker, breakerFollowup },
    trace: fixture.trace,
    browserErrors: []
  };
  window.__berserkerFixture = payload;
  output.textContent = JSON.stringify(payload, null, 2);
  status.textContent = "BERSERKER_FIXTURE_READY";
};
run();
