import type { DamageType } from './combat-mechanics.ts';
import type {TreeScope,TreeInvestmentRequirement} from './rank-ownership.ts';
import type {CombatModifier} from './combat-modifiers.ts';
import type {CombatSupport} from './combat-transient.ts';
import { WARRIOR_V2_ACTIVE, WARRIOR_V2_PASSIVES } from './warrior-v2.ts';
import { THIEF_V2_ACTIVE, THIEF_V2_PASSIVES } from './thief-v2.ts';
import type { DirectionalMovement } from './directional-movement.ts';
import type { CoreJobV2Id } from './job-registry-v2.ts';
import type { StealthPolicy } from './stealth.ts';
export type CoreJobId = 'warrior' | 'rogue' | 'hunter' | 'wizard' | 'acolyte';
/** Legacy registry keys stay unchanged; runtime/definitions can also name canonical V2 cores. */
export type RuntimeCoreJobId = CoreJobId | CoreJobV2Id;
export type SpecializationId =
  | 'berserker'
  | 'blade_master'
  | 'gatotkaca'
  | 'garda'
  | 'caroq'
  | 'anom'
  | 'srikandi'
  | 'jagawana'
  | 'resi'
  | 'pujangga'
  | 'pandita'
  | 'bajra';
export type ResourceId = 'mana';
export type WeaponType =
  | 'dagger'
  | 'one_hand_sword' | 'two_hand_sword' | 'greatsword' | 'dual_sword' | 'shield'
  | 'none'
  | 'knuckle'
  | 'mace'
  | 'sword_shield'
  | 'dual_dagger'
  | 'sword_dagger'
  | 'bow'
  | 'bow_trap'
  | 'staff'
  | 'wand'
  | 'talisman'
  | 'relic'
  | 'holy_knuckle';
export type SkillEffect =
  | 'movement'
  | 'damage'
  | 'dash_damage'
  | 'rapid_damage'
  | 'aoe_damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'poison'
  | 'slow'
  | 'root'
  | 'stun'
  | 'mark'
  | 'stealth'
  | 'barrier'
  | 'parry'
  | 'execute'
  | 'elemental'
  | 'chain'
  | 'illusion'
  | 'ultimate';
export type MasteryChoice = 'power' | 'control' | 'utility';
export type SkillActionType = 'basic' | 'skill' | 'dot' | 'heal' | 'buff' | 'debuff' | 'barrier' | 'movement' | 'counter' | 'channel' | 'summon' | 'deployable';
export type SkillPrerequisite = { skillId: string; requiredRank?: number };
export type SkillStatusApplication = { id: string; duration: number; potency?: number; rearDurationBonus?: number };
export type SkillStunProfile = {
  chance: number[];
  pveDuration: number;
  pvpDuration: number;
  minimumTravelDistance: number;
  targetPolicy: 'NORMAL' | 'REDUCED' | 'IMMUNE';
};
export type SkillHit = {
  delay: number;
  baseDamage?: number;
  physicalCoefficient?: number;
  magicCoefficient?: number;
  skillPowerCoefficient?: number;
  statusEffect?: SkillStatusApplication;
  knockbackStrength?: number;
  weaponHand?: 'MAIN' | 'OFF' | 'BOTH';
  sharedContributionWeight?: number;
  weaponContributionCoefficient?: number;
};
export type SkillRankValues = Partial<{
  baseDamage: number; physicalCoefficient: number; magicCoefficient: number;
  skillPowerCoefficient: number; manaCost: number; cooldown: number; castingTime: number;
  range: number; radius: number; maxTargets: number; duration: number;
  knockbackStrength: number; movementDistance: number;
  statScaling: Partial<{ str: number; vit: number; dex: number; int: number }>;
}>;
export type SkillRankMechanic = {
  values?: SkillRankValues;
  addStatuses?: SkillStatusApplication[];
  addTags?: string[];
  hitSequence?: SkillHit[];
};
/** One production authority for skill stat scaling and its mitigation channel. */
export function skillCombatScaling(skill: SkillDefinition) {
  if (skill.combatScaling) return { ...skill.combatScaling, skillPower: skill.combatScaling.skillPower ?? skill.skillPowerCoefficient ?? 0 };
  const damageType = skill.job === 'adventurer' ? 'physical' : legacyCoreJob(skill.job)?.skillDamageType ?? 'physical';
  return { physical: damageType === 'physical' ? 1 : 0, magic: damageType === 'magic' ? 1 : 0, skillPower: skill.skillPowerCoefficient ?? 0, damageType };
}
export type StatusEffectId =
  | 'knockup'
  | 'taunt'
  | 'defenseDown'
  | 'critical'
  | 'weakPoint'
  | 'slow'
  | 'root'
  | 'poison'
  | 'curse'
  | 'stealth'
  | 'barrier'
  | 'stun'
  | 'holy';

export type SkillDefinition = {
  directionalMovement?: DirectionalMovement;
  movementDistance?: number;
  personalMark?: boolean;
  branch?: string;
  dash?: {stopDistance:number;impactRange:number};
  rankEffects?: {modifiers?:CombatModifier[];temporaryBuffs?:{duration:number;modifier:CombatModifier}[];statuses?:SkillStatusApplication[];hitSequence?:SkillHit[]}[];
  /** V3 source-owned status strength by rank; consumed by the runtime status adapter. */
  armorBreakStrengthByRank?: number[];
  /** Opt-in gameplay lock, independent of casting/animation duration. */
  actionLockDuration?:number;
  movementAllowedDuringLock?:boolean;
  modifierComposition?:'legacy'|'scoped_additive';
  tree?:TreeScope;
  investmentRequirement?:TreeInvestmentRequirement;
  modifiers?:CombatModifier[];
  temporaryBuffs?:{duration:number;modifier:CombatModifier}[];
  counterPolicy?:{accepted:Array<'blocked'|'parried'>;windowMs:number};
  id: string;
  name: string;
  description: string;
  job: RuntimeCoreJobId | 'adventurer';
  stealthPolicy?: StealthPolicy;
  specialization: SpecializationId | null;
  slot: 1 | 2 | 3 | 4;
  unlockLevel: number;
  maxLevel: number;
  manaCost: number;
  cooldown: number;
  castingTime: number;
  baseDamage: number;
  scalingStat: 'attack' | 'hp' | 'none';
  /** Optional mixed scaling; absent entries preserve existing job damage behavior. */
  combatScaling?: { physical: number; magic: number; skillPower?: number; damageType: DamageType };
  /** Optional secondary scaling; zero by default so INT is never implicit skill damage. */
  skillPowerCoefficient?: number;
  /** Explicit V3 primary-stat contribution, applied once by the resolver. */
  statScaling?: Partial<{ str: number; vit: number; dex: number; int: number }>;
  baseDamageMinByRank?: number[];
  baseDamageMaxByRank?: number[];
  skillPowerFactor?: number;
  rankPowerFactorByRank?: number[];
  stunProfile?: SkillStunProfile;
  damageCoefficient: number;
  targetType: 'single' | 'area' | 'self' | 'line' | 'frontal_arc';
  progressionMode?: 'legacy' | 'rank_values';
  rankValues?: SkillRankValues[];
  rankMechanics?: Partial<Record<number, SkillRankMechanic>>;
  physicalCoefficient?: number;
  magicCoefficient?: number;
  damageType?: DamageType;
  hitSequence?: SkillHit[];
  statuses?: SkillStatusApplication[];
  knockbackStrength?: number;
  angle?: number;
  maxTargets?: number;
  canCrit?: boolean;
  range: number;
  areaRadius: number;
  duration: number;
  statusEffect: StatusEffectId | null;
  effect: SkillEffect;
  animation: string;
  visualEffect: string;
  soundEffect: string;
  weaponRequirement: WeaponType[];
  masteryOptions: MasteryChoice[];
  prerequisiteSkillIds?: string[];
  prerequisites?: SkillPrerequisite[];
  tags?: string[];
  actionType?: SkillActionType;
  usableFromHotbar?: boolean;
  hotbarCategory?: 'primary';
  skillType?: 'active';
};

type JobDefinition = {
  skillDamageType?: DamageType;
  id: CoreJobId;
  name: string;
  role: string;
  weapon: WeaponType;
  resource: ResourceId;
  resourceName: string;
  color: string;
  hp: number;
  hpGrowth: number;
  attack: number;
  attackGrowth: number;
  cooldown: number;
  range: number;
  specializations: SpecializationId[];
  passiveName: string;
  description: string;
};
type SpecializationDefinition = JobDefinition & {
  coreJob: CoreJobId;
  passiveId: string;
};

export const CORE_JOBS: Record<CoreJobId, JobDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    role: 'Bruiser / Protector',
    weapon: 'mace',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#b66f4a',
    hp: 140,
    hpGrowth: 22,
    attack: 24,
    attackGrowth: 6,
    cooldown: 0.42,
    range: 3.4,
    specializations: ['gatotkaca', 'garda'],
    passiveName: 'Otot Baja',
    description: 'Pertarungan jarak dekat dan perlindungan.',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    role: 'Critical / Stealth',
    weapon: 'dual_dagger',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#a65d88',
    hp: 100,
    hpGrowth: 13,
    attack: 26,
    attackGrowth: 6,
    cooldown: 0.32,
    range: 3.5,
    specializations: ['caroq', 'anom'],
    passiveName: 'Naluri Bayangan',
    description: 'Serangan cepat, critical, mark, dan stealth.',
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    role: 'Ranged / Control',
    weapon: 'bow',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#6c9b5b',
    hp: 105,
    hpGrowth: 14,
    attack: 23,
    attackGrowth: 5,
    cooldown: 0.38,
    range: 7,
    specializations: ['srikandi', 'jagawana'],
    passiveName: 'Mata Pemburu',
    description: 'Jarak jauh, weak point, trap, dan poison.',
  },
  wizard: {
    skillDamageType: 'magic',
    id: 'wizard',
    name: 'Wizard',
    role: 'Elemental / AoE',
    weapon: 'staff',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#6e65b2',
    hp: 90,
    hpGrowth: 12,
    attack: 29,
    attackGrowth: 7,
    cooldown: 0.48,
    range: 7,
    specializations: ['resi', 'pujangga'],
    passiveName: 'Ilmu Unsur',
    description: 'Sihir elemen, AoE, curse, dan DoT.',
  },
  acolyte: {
    skillDamageType: 'magic',
    id: 'acolyte',
    name: 'Acolyte',
    role: 'Heal / Holy Melee',
    weapon: 'staff',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#d2b86d',
    hp: 115,
    hpGrowth: 17,
    attack: 20,
    attackGrowth: 5,
    cooldown: 0.44,
    range: 4,
    specializations: ['pandita', 'bajra'],
    passiveName: 'Welas Asih',
    description: 'Heal, buff, barrier, dan holy sustain solo.',
  },
};

export const SPECIALIZATIONS: Record<
  SpecializationId,
  SpecializationDefinition
> = {
  gatotkaca: {
    ...CORE_JOBS.warrior,
    id: 'warrior',
    name: 'Gatotkaca',
    role: 'Bruiser / AoE',
    weapon: 'knuckle',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#c97748',
    coreJob: 'warrior',
    specializations: ['gatotkaca', 'garda'],
    passiveName: 'Otot Baja',
    passiveId: 'iron-muscle',
    description: '2H knuckle, shockwave, leap, dan super armor.',
  },
  garda: {
    ...CORE_JOBS.warrior,
    id: 'warrior',
    name: 'Garda',
    role: 'Tank / Protector / Taunt',
    weapon: 'sword_shield',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#779a9b',
    coreJob: 'warrior',
    specializations: ['gatotkaca', 'garda'],
    passiveName: 'Penjaga Gerbang',
    passiveId: 'gatekeeper',
    description: 'Shield, block, barrier, taunt, dan counterattack.',
  },
  caroq: {
    ...CORE_JOBS.rogue,
    id: 'rogue',
    name: 'Caroq',
    role: 'Attack Speed / Critical',
    weapon: 'dual_dagger',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#b86187',
    coreJob: 'rogue',
    specializations: ['caroq', 'anom'],
    passiveName: 'Ritme Caroq',
    passiveId: 'caroq-rhythm',
    description: 'Dual dagger, rapid combo, critical, dan vanish.',
  },
  anom: {
    ...CORE_JOBS.rogue,
    id: 'rogue',
    name: 'Anom',
    role: 'Mark / Stealth / Execute',
    weapon: 'sword_dagger',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#5e6c9f',
    coreJob: 'rogue',
    specializations: ['caroq', 'anom'],
    passiveName: 'Naluri Eksekutor',
    passiveId: 'execution-instinct',
    description: 'Mark, back attack, stealth, dan critical execution.',
  },
  srikandi: {
    ...CORE_JOBS.hunter,
    id: 'hunter',
    name: 'Srikandi',
    role: 'Precision / Weak Point',
    weapon: 'bow',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#829d5d',
    coreJob: 'hunter',
    specializations: ['srikandi', 'jagawana'],
    passiveName: 'Mata Srikandi',
    passiveId: 'srikandi-eye',
    description: 'Bow presisi, weak point, mark, dan controlled AoE.',
  },
  jagawana: {
    ...CORE_JOBS.hunter,
    id: 'hunter',
    name: 'Jagawana',
    role: 'Trap / Poison / Control',
    weapon: 'bow_trap',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#4e8064',
    coreJob: 'hunter',
    specializations: ['srikandi', 'jagawana'],
    passiveName: 'Penjaga Rimba',
    passiveId: 'forest-warden',
    description: 'Trap, poison, slow, root, dan area control.',
  },
  resi: {
    ...CORE_JOBS.wizard,
    id: 'wizard',
    name: 'Resi',
    role: 'Elemental / High Damage',
    weapon: 'staff',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#637dcc',
    coreJob: 'wizard',
    specializations: ['resi', 'pujangga'],
    passiveName: 'Lima Unsur',
    passiveId: 'five-elements',
    description: 'Staff, Fire, Water, Wind, Earth, dan Lightning.',
  },
  pujangga: {
    ...CORE_JOBS.wizard,
    id: 'wizard',
    name: 'Pujangga',
    role: 'Curse / Debuff / Illusion',
    weapon: 'wand',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#9474b5',
    coreJob: 'wizard',
    specializations: ['resi', 'pujangga'],
    passiveName: 'Ilmu Mantra',
    passiveId: 'mantra-lore',
    description: 'Wand, curse, debuff, illusion, dan DoT.',
  },
  pandita: {
    ...CORE_JOBS.acolyte,
    id: 'acolyte',
    name: 'Pandita',
    role: 'Heal / Buff / Barrier',
    weapon: 'relic',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#d3b86e',
    coreJob: 'acolyte',
    specializations: ['pandita', 'bajra'],
    passiveName: 'Welas Asih',
    passiveId: 'compassion',
    description: 'Relic, heal, buff, cleanse, dan barrier solo.',
  },
  bajra: {
    ...CORE_JOBS.acolyte,
    id: 'acolyte',
    name: 'Bajra',
    role: 'Holy Melee / Sustain',
    weapon: 'holy_knuckle',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#d28b56',
    coreJob: 'acolyte',
    specializations: ['pandita', 'bajra'],
    passiveName: 'Tekad Dharma',
    passiveId: 'dharma-will',
    description: 'Holy knuckle, stun, self-heal, dan holy aura.',
  },
  berserker: {
    ...CORE_JOBS.warrior,
    id: 'warrior',
    name: 'Berserker',
    role: 'Two-Hand Damage / Fury',
    weapon: 'two_hand_sword',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#b65347',
    coreJob: 'warrior',
    specializations: ['berserker', 'blade_master'],
    passiveName: 'Battle Fury',
    passiveId: 'berserker-fury',
    description: 'Heavy two-hand attacks, armor break, dan controlled fury.',
  },
  blade_master: {
    ...CORE_JOBS.warrior,
    id: 'warrior',
    name: 'Blade Master',
    role: 'Dual-Wield Damage / Tempo',
    weapon: 'sword_dagger',
    resource: 'mana',
    resourceName: 'Mana',
    color: '#c28b56',
    coreJob: 'warrior',
    specializations: ['berserker', 'blade_master'],
    passiveName: 'Blade Tempo',
    passiveId: 'blade-master-tempo',
    description: 'Dual wield, combo tempo, counter, dan sequence damage.',
  },
};

export type PassiveDefinition = {
  branch?:string;
  rankModifiers?:CombatModifier[][];
  rankCombatSupport?:CombatSupport[];
  tree?:TreeScope;
  investmentRequirement?:TreeInvestmentRequirement;
  prerequisites?:SkillPrerequisite[];
  modifiers?:CombatModifier[];
  combatSupport?:CombatSupport;
  id: string;
  name: string;
  description: string;
  specialization: SpecializationId | null;
  job?: RuntimeCoreJobId | 'adventurer';
  tier?: 'adventurer' | 'core' | 'specialization' | 'capstone';
  prerequisiteSkillIds?: string[];
  maxLevel: number;
  unlockLevel: number;
};

export const PASSIVES: Record<SpecializationId, PassiveDefinition> = {
  gatotkaca: {
    id: 'iron-muscle',
    name: 'Otot Baja',
    description: 'Legacy passive; REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    specialization: 'gatotkaca',
    maxLevel: 3,
    unlockLevel: 25,
  },
  garda: {
    id: 'gatekeeper',
    name: 'Penjaga Gerbang',
    description: 'Meningkatkan block, guard strength, dan perlindungan party.',
    specialization: 'garda',
    maxLevel: 3,
    unlockLevel: 25,
  },
  caroq: {
    id: 'caroq-rhythm',
    name: 'Ritme Caroq',
    description: 'Combo beruntun meningkatkan attack speed dan critical rate.',
    specialization: 'caroq',
    maxLevel: 3,
    unlockLevel: 25,
  },
  anom: {
    id: 'execution-instinct',
    name: 'Naluri Eksekutor',
    description:
      'Meningkatkan critical rate dan critical damage tanpa buff attack speed.',
    specialization: 'anom',
    maxLevel: 3,
    unlockLevel: 25,
  },
  srikandi: {
    id: 'srikandi-eye',
    name: 'Mata Srikandi',
    description: 'Meningkatkan weak point damage dan critical ranged damage.',
    specialization: 'srikandi',
    maxLevel: 3,
    unlockLevel: 25,
  },
  jagawana: {
    id: 'forest-warden',
    name: 'Penjaga Rimba',
    description: 'Meningkatkan durasi trap, poison damage, dan radius control.',
    specialization: 'jagawana',
    maxLevel: 3,
    unlockLevel: 25,
  },
  resi: {
    id: 'five-elements',
    name: 'Lima Unsur',
    description:
      'Meningkatkan elemental damage dan bonus terhadap elemental weakness.',
    specialization: 'resi',
    maxLevel: 3,
    unlockLevel: 25,
  },
  pujangga: {
    id: 'mantra-lore',
    name: 'Ilmu Mantra',
    description: 'Meningkatkan durasi debuff dan damage terhadap target curse.',
    specialization: 'pujangga',
    maxLevel: 3,
    unlockLevel: 25,
  },
  pandita: {
    id: 'compassion',
    name: 'Welas Asih',
    description:
      'Meningkatkan healing power, barrier strength, dan buff duration.',
    specialization: 'pandita',
    maxLevel: 3,
    unlockLevel: 25,
  },
  bajra: {
    id: 'dharma-will',
    name: 'Tekad Dharma',
    description: 'Meningkatkan holy damage, stun resistance, dan self-healing.',
    specialization: 'bajra',
    maxLevel: 3,
    unlockLevel: 25,
  },
  berserker: {
    id: 'berserker-fury',
    name: 'Battle Fury',
    description: 'Meningkatkan efektivitas serangan two-hand dan armor break.',
    specialization: 'berserker',
    maxLevel: 3,
    unlockLevel: 25,
  },
  blade_master: {
    id: 'blade-master-tempo',
    name: 'Blade Tempo',
    description: 'Meningkatkan tempo combo dan efektivitas dual wield.',
    specialization: 'blade_master',
    maxLevel: 3,
    unlockLevel: 25,
  },
};

const skill = (
  data: Partial<SkillDefinition> &
    Pick<
      SkillDefinition,
      'id' | 'name' | 'description' | 'job' | 'slot' | 'effect'
    >,
): SkillDefinition => ({
  usableFromHotbar: true,
  hotbarCategory: 'primary',
  skillType: 'active',
  actionType: data.effect === 'heal' ? 'heal' : data.effect === 'buff' ? 'buff' : data.effect === 'debuff' ? 'debuff' : data.effect === 'barrier' ? 'barrier' : 'skill',
  tags: [],
  skillPowerCoefficient: 0,
  specialization: null,
  unlockLevel: data.slot === 4 ? 45 : data.job === 'adventurer' ? 1 : 10,
  maxLevel: 5,
  manaCost: data.slot === 4 ? 50 : 15 + data.slot * 5,
  cooldown: data.slot === 4 ? 25 : 3 + data.slot * 1.5,
  castingTime: 0,
  baseDamage: 20,
  scalingStat: 'attack',
  damageCoefficient: 1,
  targetType: 'single',
  range: 5,
  areaRadius:
    data.effect === 'aoe_damage' || data.effect === 'ultimate' ? 5 : 0,
  duration: 2,
  statusEffect: null,
  animation: data.effect,
  visualEffect: data.effect,
  soundEffect: 'skill',
  weaponRequirement: [],
  masteryOptions: ['power', 'control', 'utility'],
  ...data,
});

export const ADVENTURER_SKILLS: SkillDefinition[] = [
  skill({
    id: 'fajar-step',
    name: 'Langkah Fajar',
    description: 'Dash pendek ke arah target. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    job: 'adventurer',
    slot: 1,
    effect: 'dash_damage',
    manaCost: 10,
    cooldown: 4,
    baseDamage: 18,
    range: 5,
    visualEffect: 'dash',
  }),
  skill({
    id: 'fajar-strike',
    name: 'Tebasan Fajar',
    description: 'Serangan pedang yang memperkuat basic attack berikutnya.',
    job: 'adventurer',
    slot: 2,
    effect: 'damage',
    manaCost: 15,
    cooldown: 5,
    baseDamage: 30,
    visualEffect: 'slash',
  }),
  skill({
    id: 'guard-stance',
    name: 'Sikap Penjaga',
    description:
      'Mengurangi damage masuk dan membuka parry dasar selama durasi singkat.',
    job: 'adventurer',
    slot: 3,
    effect: 'parry',
    manaCost: 20,
    cooldown: 8,
    duration: 3,
    visualEffect: 'barrier',
  }),
  skill({
    id: 'nova-fajar',
    name: 'Nova Fajar',
    description: 'Ledakan cahaya area yang menyerang semua monster di sekitar.',
    job: 'adventurer',
    slot: 4,
    effect: 'ultimate',
    manaCost: 50,
    cooldown: 25,
    baseDamage: 65,
    damageCoefficient: 1.4,
    visualEffect: 'nova',
  }),
];

const coreSkill = (
  job: CoreJobId,
  slot: 1 | 2 | 3 | 4,
  id: string,
  name: string,
  description: string,
  effect: SkillEffect,
  visualEffect: string = effect,
): SkillDefinition =>
  skill({
    id,
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
    visualEffect,
  });
export const CORE_SKILLS: SkillDefinition[] = [
  coreSkill(
    'warrior',
    1,
    'warrior-breaker',
    'Hantaman Prajurit',
    'Pukulan berat. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    'stun',
    'shockwave',
  ),
  coreSkill(
    'warrior',
    2,
    'warrior-charge',
    'Charge Baja',
    'Terjang ke musuh dan mendorongnya.',
    'dash_damage',
    'dash',
  ),
  coreSkill(
    'warrior',
    3,
    'warrior-guard',
    'Guard Tekad',
    'Bertahan dan mengurangi damage masuk.',
    'barrier',
    'barrier',
  ),
  coreSkill(
    'warrior',
    4,
    'warrior-awakening',
    'Kebangkitan Warrior',
    'Ledakan kekuatan melee area.',
    'ultimate',
    'shockwave',
  ),
  coreSkill(
    'rogue',
    1,
    'rogue-step',
    'Langkah Bayang',
    'Dash melewati target.',
    'dash_damage',
    'dash',
  ),
  coreSkill(
    'rogue',
    2,
    'rogue-flurry',
    'Belati Cepat',
    'Banyak hit dengan peluang critical.',
    'rapid_damage',
    'slash',
  ),
  coreSkill(
    'rogue',
    3,
    'rogue-vanish',
    'Vanish',
    'Menghilang sebentar.',
    'stealth',
    'stealth',
  ),
  coreSkill(
    'rogue',
    4,
    'rogue-awakening',
    'Kebangkitan Rogue',
    'Kombo dual dagger sangat cepat.',
    'ultimate',
    'slash',
  ),
  coreSkill(
    'hunter',
    1,
    'hunter-aim',
    'Bidikan Pemburu',
    'Serangan jarak jauh ke titik lemah.',
    'mark',
    'arrow',
  ),
  coreSkill(
    'hunter',
    2,
    'hunter-volley',
    'Volley',
    'Hujan panah area.',
    'aoe_damage',
    'arrow',
  ),
  coreSkill(
    'hunter',
    3,
    'hunter-bind',
    'Panah Penahan',
    'Memperlambat target.',
    'slow',
    'root',
  ),
  coreSkill(
    'hunter',
    4,
    'hunter-awakening',
    'Kebangkitan Hunter',
    'Hujan anak panah besar.',
    'ultimate',
    'arrow',
  ),
  coreSkill(
    'wizard',
    1,
    'wizard-bolt',
    'Arcane Bolt',
    'Proyektil elemen sederhana.',
    'elemental',
    'thunder',
  ),
  coreSkill(
    'wizard',
    2,
    'wizard-circle',
    'Lingkar Cakrawala',
    'Ledakan sihir area.',
    'aoe_damage',
    'magic',
  ),
  coreSkill(
    'wizard',
    3,
    'wizard-chain',
    'Rantai Unsur',
    'Serangan yang memantul ke target dekat.',
    'chain',
    'thunder',
  ),
  coreSkill(
    'wizard',
    4,
    'wizard-awakening',
    'Kebangkitan Wizard',
    'Ledakan elemen besar.',
    'ultimate',
    'meteor',
  ),
  coreSkill(
    'acolyte',
    1,
    'acolyte-blessing',
    'Berkah Awal',
    'Buff singkat untuk serangan dan pertahanan.',
    'buff',
    'heal',
  ),
  coreSkill(
    'acolyte',
    2,
    'acolyte-heal',
    'Sembuh Seketika',
    'Memulihkan HP diri sendiri.',
    'heal',
    'heal',
  ),
  coreSkill(
    'acolyte',
    3,
    'acolyte-barrier',
    'Perisai Cahaya',
    'Membuat barrier sementara.',
    'barrier',
    'barrier',
  ),
  coreSkill(
    'acolyte',
    4,
    'acolyte-awakening',
    'Kebangkitan Acolyte',
    'Gelombang holy untuk damage dan heal.',
    'ultimate',
    'heal',
  ),
];

const special = (
  job: CoreJobId,
  specialization: SpecializationId,
  values: Array<
    [string, string, string, SkillEffect, string, Partial<SkillDefinition>?]
  >,
) =>
  values.map(([id, name, description, effect, visualEffect, extra]) =>
    skill({
      id,
      name,
      description,
      job,
      specialization,
      slot: Number(
        id.endsWith('-4')
          ? 4
          : id.endsWith('-3')
            ? 3
            : id.endsWith('-2')
              ? 2
              : 1,
      ) as 1 | 2 | 3 | 4,
      unlockLevel: id.endsWith('-4') ? 45 : 25,
      effect,
      visualEffect,
      ...extra,
    }),
  );
export const SPECIAL_SKILLS: SkillDefinition[] = [
  ...special('warrior', 'gatotkaca', [
    [
      'gatotkaca-1',
      'Lompatan Guntur',
      'Melompat ke target dan menghantam area. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
      'dash_damage',
      'thunder',
    ],
    [
      'gatotkaca-2',
      'Tinju Bumi',
      'Pukulan berat ke tanah dengan physical AoE.',
      'aoe_damage',
      'shockwave',
    ],
    [
      'gatotkaca-3',
      'Hantaman Langit',
      'Shockwave besar dengan knock-up.',
      'stun',
      'shockwave',
      { areaRadius: 5.5, statusEffect: 'knockup' },
    ],
    [
      'gatotkaca-4',
      'Amukan Gatotkaca',
      'Super armor, damage reduction, dan serangan AoE beruntun.',
      'ultimate',
      'thunder',
      { baseDamage: 95 },
    ],
  ]),
  ...special('warrior', 'garda', [
    [
      'garda-1',
      'Charge Perisai',
      'Menerjang musuh dan taunt. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
      'dash_damage',
      'barrier',
      { statusEffect: 'taunt', weaponRequirement: ['sword_shield'] },
    ],
    [
      'garda-2',
      'Tumbukan Gada',
      'Serangan berat yang menurunkan defense target.',
      'debuff',
      'shockwave',
      { statusEffect: 'defenseDown' },
    ],
    [
      'garda-3',
      'Benteng Nusantara',
      'Zona perlindungan yang mengurangi damage.',
      'barrier',
      'barrier',
      { targetType: 'self', areaRadius: 4 },
    ],
    [
      'garda-4',
      'Sumpah Garda',
      'Barrier, taunt area, damage reduction, dan pemulihan HP.',
      'ultimate',
      'barrier',
      { baseDamage: 45 },
    ],
  ]),
  ...special('rogue', 'caroq', [
    [
      'caroq-1',
      'Langkah Caroq',
      'Dash ke belakang target dengan bonus damage.',
      'dash_damage',
      'slash',
      { weaponRequirement: ['dual_dagger'] },
    ],
    [
      'caroq-2',
      'Badai Belati',
      'Serangan cepat beruntun dengan peluang critical tinggi.',
      'rapid_damage',
      'slash',
    ],
    [
      'caroq-3',
      'Hilang Sekejap',
      'Menghilang sementara; serangan berikutnya critical.',
      'stealth',
      'stealth',
    ],
    [
      'caroq-4',
      'Tarian Caroq',
      'Serangan dual dagger sangat cepat dengan critical.',
      'ultimate',
      'slash',
      { baseDamage: 100 },
    ],
  ]),
  ...special('rogue', 'anom', [
    [
      'anom-1',
      'Tanda Senyap',
      'Memberi Mark dan bonus damage dari belakang.',
      'mark',
      'curse',
      { statusEffect: 'critical' },
    ],
    [
      'anom-2',
      'Tebasan Anom',
      'Damage meningkat terhadap target ber-Mark.',
      'damage',
      'slash',
      { damageCoefficient: 1.35 },
    ],
    [
      'anom-3',
      'Bayang Tanpa Jejak',
      'Stealth singkat dengan bonus critical damage.',
      'stealth',
      'stealth',
    ],
    [
      'anom-4',
      'Vonis Anom',
      'Eksekusi single-target terhadap target ber-HP rendah atau ber-Mark.',
      'execute',
      'slash',
      { baseDamage: 120, targetType: 'single' },
    ],
  ]),
  ...special('hunter', 'srikandi', [
    [
      'srikandi-1',
      'Panah Bidik',
      'Serangan presisi yang menandai weak point.',
      'mark',
      'arrow',
      { statusEffect: 'weakPoint', weaponRequirement: ['bow'] },
    ],
    [
      'srikandi-2',
      'Hujan Srikandi',
      'Volley panah area, lebih kuat terhadap Weak Point.',
      'aoe_damage',
      'arrow',
    ],
    [
      'srikandi-3',
      'Panah Penahan',
      'Memperlambat atau mengikat target.',
      'slow',
      'root',
      { statusEffect: 'slow' },
    ],
    [
      'srikandi-4',
      'Badai Anak Panah',
      'Hujan panah besar ke area luas.',
      'ultimate',
      'arrow',
      { baseDamage: 105 },
    ],
  ]),
  ...special('hunter', 'jagawana', [
    [
      'jagawana-1',
      'Jerat Rimba',
      'Trap yang memberi slow atau root.',
      'root',
      'root',
      { statusEffect: 'root', weaponRequirement: ['bow_trap'] },
    ],
    [
      'jagawana-2',
      'Panah Racun',
      'Panah dengan poison damage berkala.',
      'poison',
      'poison',
      { statusEffect: 'poison' },
    ],
    [
      'jagawana-3',
      'Jaring Hutan',
      'Mengikat beberapa musuh di area.',
      'root',
      'root',
      { targetType: 'area', areaRadius: 4 },
    ],
    [
      'jagawana-4',
      'Kawasan Perburuan',
      'Zona trap, poison, slow, dan damage berkala.',
      'ultimate',
      'poison',
      { baseDamage: 70 },
    ],
  ]),
  ...special('wizard', 'resi', [
    [
      'resi-1',
      'Elemental Invocation',
      'Serangan elemen yang dapat mengeksploitasi weakness.',
      'elemental',
      'thunder',
      { weaponRequirement: ['staff'] },
    ],
    [
      'resi-2',
      'Lingkar Cakrawala',
      'AoE elemental damage.',
      'aoe_damage',
      'magic',
    ],
    [
      'resi-3',
      'Rantai Unsur',
      'Menggabungkan efek elemen dan memantul.',
      'chain',
      'thunder',
      { statusEffect: 'stun' },
    ],
    [
      'resi-4',
      'Murka Lima Unsur',
      'Gabungan lima elemen dengan damage area besar.',
      'ultimate',
      'meteor',
      { baseDamage: 125 },
    ],
  ]),
  ...special('wizard', 'pujangga', [
    [
      'pujangga-1',
      'Mantra Tanda',
      'Memberi curse mark kepada target.',
      'mark',
      'curse',
      { statusEffect: 'curse', weaponRequirement: ['wand', 'talisman'] },
    ],
    [
      'pujangga-2',
      'Kutuk Aksara',
      'Mengurangi defense dan memberikan DoT.',
      'debuff',
      'curse',
      { statusEffect: 'defenseDown' },
    ],
    [
      'pujangga-3',
      'Bayang Ilusi',
      'Area gangguan yang memberi slow dan mengacaukan target.',
      'illusion',
      'illusion',
      { statusEffect: 'slow', targetType: 'area' },
    ],
    [
      'pujangga-4',
      'Kidung Kehancuran',
      'Damage meningkat berdasarkan jumlah debuff target.',
      'ultimate',
      'curse',
      { baseDamage: 115 },
    ],
  ]),
  ...special('acolyte', 'pandita', [
    [
      'pandita-1',
      'Berkah Pandita',
      'Buff attack dan defense untuk pertarungan solo.',
      'buff',
      'heal',
      { weaponRequirement: ['relic', 'staff'] },
    ],
    [
      'pandita-2',
      'Sembuh Seketika',
      'Memulihkan HP diri sendiri.',
      'heal',
      'heal',
      { targetType: 'self' },
    ],
    [
      'pandita-3',
      'Perisai Dharma',
      'Barrier dan pembersihan debuff.',
      'barrier',
      'barrier',
      { statusEffect: 'barrier' },
    ],
    [
      // LEGACY_SEMANTIC_MISMATCH: owner-approved offensive caster-area ultimate;
      // healing/protection wording is retained pending future Job V2 content.
      'pandita-4',
      'Doa Keselamatan',
      'AoE heal, damage reduction, dan perlindungan.',
      'ultimate',
      'heal',
      { baseDamage: 45 },
    ],
  ]),
  ...special('acolyte', 'bajra', [
    [
      'bajra-1',
      'Pukulan Bajra',
      'Holy melee. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
      'stun',
      'holy',
      { weaponRequirement: ['holy_knuckle', 'mace'] },
    ],
    [
      'bajra-2',
      'Ritus Cahaya',
      'AoE holy damage, bonus melawan dark.',
      'aoe_damage',
      'holy',
    ],
    [
      'bajra-3',
      'Telapak Penolak',
      'Parry atau knockback dan self-heal.',
      'parry',
      'holy',
      {},
    ],
    [
      'bajra-4',
      'Amarah Dharma',
      'Aura holy dengan damage area dan self-healing.',
      'ultimate',
      'holy',
      { baseDamage: 85 },
    ],
  ]),
];

export const MASTERY_EFFECTS = { power: {damage:1.25}, control: {duration:1.45}, utility: {cooldown:.78} } as const;
export const ALL_SKILLS = [
  ...ADVENTURER_SKILLS,
  ...CORE_SKILLS,
  ...SPECIAL_SKILLS,
  ...WARRIOR_V2_ACTIVE,
  ...THIEF_V2_ACTIVE,
];

// All passive nodes live beside the active skill registry, including future tree stages.
export const PASSIVE_EFFECTS: Record<string, import('./items.ts').StatBlock> = {
  'iron-muscle': { physicalDamage: 2 },
  gatekeeper: { blockRate: 3, defense: 4 },
  'caroq-rhythm': { attackSpeed: 2, critRate: 1 },
  'execution-instinct': { critRate: 2, critDamage: 4 },
  'srikandi-eye': { critDamage: 3, attackPercent: 2 },
  'forest-warden': { skillDamage: 3, evasion: 1 },
  'five-elements': { magicAttack: 3, skillDamage: 2 },
  'mantra-lore': { skillDamage: 3, skillPower: 2 },
  compassion: { healingPower: 4, defense: 2 },
  'dharma-will': { healingPower: 2, physicalDamage: 3 },
  'berserker-fury': { physicalDamage: 4, attackPercent: 2 },
  'blade-master-tempo': { attackSpeed: 3, critRate: 2 },
  'adventurer-resolve': { hp: 10, defense: 1 },
  'warrior-foundation': { attack: 2, defense: 2 },
  'rogue-foundation': { critRate: 1, evasion: 1 },
  'hunter-foundation': { attackPercent: 2, accuracy: 1 },
  'wizard-foundation': { magicAttack: 2, skillPower: 2 },
  'acolyte-foundation': { healingPower: 3, defense: 1 },
};
export const ALL_PASSIVES: PassiveDefinition[] = [
  ...WARRIOR_V2_PASSIVES,
  ...THIEF_V2_PASSIVES,
  { id: 'adventurer-resolve', name: 'Tekad Petualang', description: 'Setiap level memberi +10 HP dan +1 Defense.', specialization: null, job: 'adventurer', tier: 'adventurer', maxLevel: 3, unlockLevel: 1 },
  ...Object.values(CORE_JOBS).map(job => ({ id: `${job.id}-foundation`, name: job.passiveName, description: `Latihan dasar ${job.name} memperkuat atribut utama job.`, specialization: null, job: job.id, tier: 'core' as const, maxLevel: 3, unlockLevel: 10 })),
  ...Object.values(PASSIVES).map(passive => ({ ...passive, job: SPECIALIZATIONS[passive.specialization!].coreJob, tier: 'specialization' as const })),
  ...Object.entries(SPECIALIZATIONS).map(([id, job]) => ({ id: `${id}-capstone`, name: `Warisan ${job.name}`, description: `Puncak latihan ${job.name}: memperkuat passive utama. Memerlukan Mastery dan passive utama level 3.`, specialization: id as SpecializationId, job: job.coreJob, tier: 'capstone' as const, maxLevel: 1, unlockLevel: 50, prerequisiteSkillIds: [PASSIVES[id as SpecializationId].id] })),
];
for (const [id] of Object.entries(SPECIALIZATIONS)) {
  const passiveId = PASSIVES[id as SpecializationId]?.id;
  const passiveEffect = passiveId ? PASSIVE_EFFECTS[passiveId] : undefined;
  PASSIVE_EFFECTS[`${id}-capstone`] = Object.fromEntries(
    Object.entries(passiveEffect ?? {}).map(([stat, value]) => [stat, value! * 2]),
  );
}
export const getSkill = (id: string) => ALL_SKILLS.find((s) => s.id === id);
export const skillsFor = (
  coreJob: RuntimeCoreJobId | null,
  specialization: SpecializationId | null,
) =>
  specialization
    ? SPECIAL_SKILLS.filter((s) => s.specialization === specialization)
    : coreJob
      ? CORE_SKILLS.filter((s) => s.job === coreJob)
      : ADVENTURER_SKILLS;
// Active skills remain available after promotion. A specialization adds its
// own skills; it does not revoke learned Adventurer or Core Job skills.
export const activeSkillsFor = (
  coreJob: RuntimeCoreJobId | null,
  specialization: SpecializationId | null,
  architecture:'legacy'|'v2_test'='legacy',
) => ALL_SKILLS.filter(skill => skillArchitectureAllowed({progressionArchitecture:architecture},skill) && (
  skill.job === 'adventurer' ||
  (!!coreJob && skill.job === coreJob && (!skill.specialization || skill.specialization === specialization))),
);
/** V2 reuses Adventurer, but must never blend legacy and V2 core trees. */
export function skillArchitectureAllowed(hero:{progressionArchitecture?:'legacy'|'v2_test'|'v3_adventurer'},skill:{job?:string;tree?:TreeScope}) {
  return hero.progressionArchitecture==='v2_test'
    ? skill.job==='adventurer'||skill.tree?.architecture==='v2'
    : skill.tree?.architecture!=='v2';
}
export const specializationsFor = (job: CoreJobId) =>
  Object.values(SPECIALIZATIONS).filter((s) => s.coreJob === job);
export const legacyCoreJob = (id: string): JobDefinition | undefined => CORE_JOBS[id as CoreJobId];
