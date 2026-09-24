import { isResourceEnabled, staminaDerivedValue } from './gameplay-config.ts';
import { getVisibleJobArchitecture } from './job-presentation.ts';
import {progressionRules,LEGACY_CONTENT_CAP,type ProgressionArchitecture} from './progression.ts';
import {rankSource,normalizedRankOwnership,buyRank,grantRank,paidTreeInvestment,type RankOwnership} from './rank-ownership.ts';
import {hostModifiers,applyStatModifiers,isManualGuarding,actionDamageMultiplier,type ModifierHost,type CombatModifier,type CounterContext,type ModifierContext,type ImpactContext} from './combat-modifiers.ts';
import { getJobV2, type CoreJobV2Id } from './job-registry-v2.ts';
import type {CombatSupport} from './combat-transient.ts';
import { resolveSkillAction, skillHitDamage, resolvedDamageParts } from './skill-action.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS, ADVENTURER_V3_SKILL_MAP, adventurerV3StartingState } from './adventurer-v3.ts';
import { WARRIOR_V3_RUNTIME_SKILLS, WARRIOR_V3_SKILL_MAP, warriorV3StateAfterCoreChange } from './warrior-v3.ts';
import { BERSERKER_V3_RUNTIME_SKILLS, BERSERKER_V3_SKILL_MAP, BERSERKER_MASTERY_MANA_SKILLS, BERSERKER_TRANCE_DAMAGE_SKILLS, BERSERKER_TRANCE_AOE_SKILLS, berserkerV3StateAfterSpecialization } from './berserker-v3.ts';
import { BLADE_MASTER_V3_RUNTIME_SKILLS, BLADE_MASTER_V3_SKILL_MAP, BLADE_MASTER_DUAL_MANA_SKILLS, BLADE_MASTER_MASTERY_MANA_SKILLS, BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK, bladeMasterV3StateAfterSpecialization, bladeMasterDualWieldActive, composeBladeWeaponHits } from './blade-master-v3.ts';
import type { StunState } from './stun.ts';
import { canPurchaseSkillRank, normalizeSkillProgressionV3, purchaseSkillRankV3, refundAllSkillPointsForJobChange, spentSkillPointsV3, type SkillProgressionV3State } from './skill-progression-v3.ts';
import { meetsWeaponRequirement, resolveWeaponStyle } from './weapon-style.ts';
import {
  ALL_SKILLS,
  ALL_PASSIVES,
  PASSIVE_EFFECTS,
  MASTERY_EFFECTS,
  CORE_JOBS,
  PASSIVES,
  SPECIALIZATIONS,
  skillsFor,
  activeSkillsFor,
  skillArchitectureAllowed,
  type CoreJobId, type RuntimeCoreJobId, legacyCoreJob,
  type MasteryChoice,
  type SpecializationId,
  type SkillDefinition,
  type WeaponType,
} from './skills.ts';
import {
  addItemToInventory,
  canEquipItem,
  createItem,
  ITEM_CATALOG,
  RUNE_OPTIMIZER_TIER_RULES,
  RUNE_RARITY_RULES,
  RUNE_QUALITY_ORDER,
  RUNE_REFORGE_WEIGHTS,
  RUNE_REFORGE_STEP_WEIGHT,
  RUNE_REMOVAL_GOLD_COST,
  rollRuneAffixes,
  normalizeSocketedRune,
  type RuneRarity,
  RUNE_THEME_POOLS,
  emptyEquipment,
  itemById,
  itemStats,
  calculateBaseEquipmentStats,
  calculateEquipmentUniqueStats,
  calculateEquipmentStats as calculateItemEquipmentStats,
  calculateRuneStats as calculateItemRuneStats,
  normalizeItem,
  normalizeStatBlock,
  isRetiredNormalMaterial,
  removeItemQuantity,
  validateOffHandCompatibility,
  type EquipSlot,
  type EquipmentLoadout,
  type ItemData,
  type ItemRarity,
  type RuneOptimizerTier,
  type SocketedRune,
  type StatBlock,
} from './items.ts';
import { WORLD_CONFIG, FIELDS, CITIES, forgeAccessReason, startingFieldIds, migrateFieldQuestId, type MonsterDefinition } from './regions.ts';
import { regionHalfExtent } from './field-layout.ts';
import { FIELD_TERRAINS, nearestTerrainPoint } from './field-terrain.ts';
import { monsterDropChance, rollMonsterItem } from './monster-loot.ts';
import { PRIMARY_HOTBAR_SIZE, emptyQuickHotbars, loadPrimaryHotbar, validateQuickHotbarAssignments, remapPrimaryHotbarForJob, type PrimaryHotbarState } from './hotbar.ts';
import { canonicalItemTemplateId, itemCooldownKey, getItemCooldownRemaining, potionRestoreAmount } from './items.ts';
import { composeSingleMainWeaponHits, validateDualWieldEquip, type DualWieldEquipReason } from './dual-wield.ts';

export const SAVE_KEY = 'lumenfall-saves-v3';
export const LEGACY_SAVE_KEY = 'lumenfall-saves-v2';
export const OLDER_SAVE_KEY = 'lumenfall-save-v1';
/** Character-owned data boundary for the development-only V2 player path. */
export const CURRENT_CHARACTER_SCHEMA_VERSION = 2 as const;
export const MAX_LEVEL = LEGACY_CONTENT_CAP;

export const DEFAULT_APPEARANCE = {
  gender: 'male' as const,
  faceStyleId: 'face_default',
  hairStyleId: 'hair_default',
  hairColorId: 'light_brown',
  skinToneId: 'tone_02',
} as const;
export const FACE_STYLE_PRESETS = [
  { id: 'face_default', label: 'Classic' },
  { id: 'face_soft', label: 'Soft' },
  { id: 'face_sharp', label: 'Sharp' },
] as const;
export const HAIR_STYLE_PRESETS = [
  { id: 'hair_default', label: 'Layered' },
  { id: 'hair_short', label: 'Short' },
  { id: 'hair_wild', label: 'Wild' },
  { id: 'hair_swept', label: 'Swept' },
] as const;
export const HAIR_COLOR_PRESETS = [
  { id: 'black', label: 'Black', color: '#171719' },
  { id: 'dark_brown', label: 'Dark Brown', color: '#3b2419' },
  { id: 'brown', label: 'Brown', color: '#6a4024' },
  { id: 'light_brown', label: 'Light Brown', color: '#b48762' },
  { id: 'blonde', label: 'Blonde', color: '#e3c27e' },
  { id: 'white', label: 'White', color: '#f0eee3' },
  { id: 'silver', label: 'Silver', color: '#aeb8c6' },
  { id: 'dark_red', label: 'Dark Red', color: '#6e252d' },
] as const;
export const SKIN_TONE_PRESETS = [
  { id: 'tone_01', label: 'Porcelain', color: '#f5d6bd' },
  { id: 'tone_02', label: 'Warm', color: '#e8b18f' },
  { id: 'tone_03', label: 'Honey', color: '#c9825d' },
  { id: 'tone_04', label: 'Deep', color: '#8d543f' },
] as const;

export type CharacterAppearance = {
  gender: CharacterGender;
  faceStyleId: string;
  hairStyleId: string;
  hairColorId: string;
  skinToneId: string;
};
export type SavedPosition = { x: number; z: number };

export type LegacyJobId = 'guardian' | 'ranger' | 'arcanist';
export type JobId = 'adventurer' | LegacyJobId | RuntimeCoreJobId;
export type JobTier = 'adventurer' | 'core' | 'specialization' | 'mastery';

type CombatProfile = {
  label: string;
  title: string;
  description: string;
  hp: number;
  hpGrowth: number;
  attack: number;
  attackGrowth: number;
  cooldown: number;
  range: number;
  color: string;
  weapon: WeaponType;
  resourceName: string;
};

/** CFV3-1 canonical primary-stat and physical-attack foundations. */
export const BASE_PRIMARY_STAT = 15;
export const STAT_POINTS_PER_LEVEL = 2;
export const BASIC_ATTACK_COEFFICIENT = 1;
export const PHYSICAL_WEAPON_STAT_FACTORS: Readonly<Partial<Record<WeaponType, number>>> = {
  none: 0, dagger: 1, dual_dagger: 1, one_hand_sword: 1, two_hand_sword: 1,
  greatsword: 1, dual_sword: 1, sword_dagger: 1, shield: 1, knuckle: 1,
  mace: 1, bow: 1, bow_trap: 1,
};
export const VIT_HP_BASE_FACTOR = 8;
export const VIT_HP_LEVEL_FACTOR = 0.05;
export const INT_MP_FACTOR = 3;
export const basePhysicalAttackForLevel = (level: number) =>
  7 + Math.floor(Math.max(1, Math.floor(level)) * 1.1);
export const vitalityHPContribution = (level: number, effectiveVit: number) =>
  Math.max(0, effectiveVit) * (VIT_HP_BASE_FACTOR + Math.max(0, level - 1) * VIT_HP_LEVEL_FACTOR);

const LEGACY_JOBS: Record<LegacyJobId, CombatProfile> = {
  guardian: {
    label: 'Penjaga Fajar',
    title: 'Pendekar',
    description: 'Pertahanan kuat, serangan seimbang.',
    hp: 120,
    hpGrowth: 18,
    attack: 22,
    attackGrowth: 5,
    cooldown: 0.43,
    range: 3.3,
    color: '#237f85',
    weapon: 'mace',
    resourceName: 'Mana',
  },
  ranger: {
    label: 'Penjaga Rimba',
    title: 'Pemanah',
    description: 'Serangan cepat dengan jangkauan lebih jauh.',
    hp: 105,
    hpGrowth: 14,
    attack: 27,
    attackGrowth: 6,
    cooldown: 0.34,
    range: 4.5,
    color: '#6c9b5b',
    weapon: 'bow',
    resourceName: 'Mana',
  },
  arcanist: {
    label: 'Penjaga Astral',
    title: 'Arcanist',
    description: 'Serangan paling kuat, tetapi tubuh lebih rapuh.',
    hp: 95,
    hpGrowth: 12,
    attack: 31,
    attackGrowth: 7,
    cooldown: 0.52,
    range: 4,
    color: '#8667a9',
    weapon: 'staff',
    resourceName: 'Mana',
  },
};

export type InventoryItem = ItemData;
export type AllocatedStats = {
  str: number;
  vit?: number;
  dex: number;
  int: number;
  /** Read-only compatibility alias accepted only while loading old saves. */
  sta?: number;
};
export type PetState = {
  id: string;
  level: number;
  exp: number;
  maxExp: number;
  rarity: ItemRarity;
  passive: string;
  bonusStats: StatBlock;
};

export type CharacterGender = 'male' | 'female';
export type Hero = PrimaryHotbarState & {
  /** Development-only capability gate. False/absent for every normal character until Blade Master grants it. */
  canDualWieldOneHandSwords?: boolean;
  /** Missing on pre-clean-break saves; those saves are intentionally incompatible. */
  characterSchemaVersion?: typeof CURRENT_CHARACTER_SCHEMA_VERSION;
  progressionArchitecture?:ProgressionArchitecture;
  skillArchitectureVersion?: 3;
  skillProgressionV3?: SkillProgressionV3State;
  rankOwnership?:RankOwnership;
  temporaryModifiers?:ModifierHost['temporaryModifiers'];
  manualGuardActive?:boolean;
  combatStateModifiers?:CombatModifier[];
  gender: CharacterGender;
  appearance: CharacterAppearance;
  characterId: string;
  runeForgePending?: RuneForgePending | null;
  runeSystemVersion?: 2;
  retiredItems: Array<{location:'inventory'|'storage'|'pendingLoot';item:ItemData}>;
  itemCooldowns: Record<string,number>;
  selectedAmmo: string | null;
  currentCity: string;
  currentField: string;
  inCity: boolean;
  unlockedCities: string[];
  unlockedFields: string[];
  completedQuests: string[];
  acceptedQuests: string[];
  activeQuests: string[];
  questCooldowns: Record<string, number>;
  cityProgress: Record<string,number>;
  fieldProgress: Record<string,number>;
  defeatedFieldBosses: string[];
  defeatedBossTimestamp: Record<string, number>;
  monsterRespawnState: Record<string, number>;
  storage: ItemData[];
  version: 3;
  slotId: string;
  characterName: string;
  createdAt: number;
  lastPlayedAt: number;
  playTimeSeconds: number;
  lastSafePosition: SavedPosition;
  spawnPointId: string;
  job: JobId;
  jobTier: JobTier;
  coreJob: RuntimeCoreJobId | null;
  specialization: SpecializationId | null;
  weaponType: WeaponType;
  level: number;
  xp: number;
  gold: number;
  kills: number;
  hp: number;
  potions: number;
  weapon: number;
  questClaimed: boolean;
  bossDefeated: boolean;
  x: number;
  z: number;
  skillPoints: number;
  skillLevels: Record<string, number>;
  passiveLevels: Record<string, number>;
  masteryChoices: Record<string, MasteryChoice>;
  mana: number;
  maxMana: number;
  stamina: number;
  barrier: number;
  activeBuffs: Record<string, number>;
  statusEffects: Record<string, number>;
  /** Transient combat-only CC; intentionally excluded from saves. */
  stunState?: StunState;
  coreQuestClaimed: boolean;
  specializationQuestClaimed: boolean;
  masteryQuestClaimed: boolean;
  jobHistory: Record<string, { level: number; chapter: number; acquiredAt: number }>;
  inventory: InventoryItem[];
  inventoryLayout?: Array<string | null>;
  inventoryCapacity: number;
  pendingLoot: ItemData[];
  petRecords: Record<string, PetState>;
  equipment: EquipmentLoadout;
  pet: PetState | null;
  statPoints: number;
  allocatedStats: AllocatedStats;
  fateRune: { id: string; level: number } | null;
  eternalSeal: { id: string; level: number } | null;
  /** Forge preference; omitted legacy saves keep the safe default (enabled). */
  enhancementSealEnabled?: boolean;
};

export type CharacterSlot = { id: string; hero: Hero | null };
export type SaveCollection = {
  version: 3;
  activeSlot: string;
  lastPlayedCharacterId: string | null;
  characters: Record<string, Hero>;
};

const oldJob = (job: JobId): CombatProfile | null =>
  job in LEGACY_JOBS ? LEGACY_JOBS[job as LegacyJobId] : null;

export function combatProfile(hero: Hero): CombatProfile {
  if (hero.specialization) {
    if (hero.skillArchitectureVersion === 3 && hero.specialization === 'berserker') {
      const core = CORE_JOBS.warrior;
      return { label: 'Berserker', title: 'Heavy Physical Mobber', description: 'Specialisasi pedang dua tangan dengan AOE berat dan survivability aktif.', hp: core.hp, hpGrowth: core.hpGrowth, attack: core.attack, attackGrowth: core.attackGrowth, cooldown: core.cooldown, range: core.range, color: '#b85b3f', weapon: 'two_hand_sword', resourceName: 'Mana' };
    }
    if (hero.skillArchitectureVersion === 3 && hero.specialization === 'blade_master') {
      const core = CORE_JOBS.warrior;
      return { label: 'Blade Master', title: 'Technical Dual-Wield Swordsman', description: 'Spesialisasi pedang presisi, mobilitas, counterplay, dan Dual Wield.', hp: core.hp, hpGrowth: core.hpGrowth, attack: core.attack, attackGrowth: core.attackGrowth, cooldown: core.cooldown, range: core.range, color: '#c48c45', weapon: 'dual_sword', resourceName: 'Mana' };
    }
    const spec = SPECIALIZATIONS[hero.specialization];
    return {
      label: spec.name,
      title: spec.role,
      description: spec.description,
      hp: spec.hp,
      hpGrowth: spec.hpGrowth,
      attack: spec.attack,
      attackGrowth: spec.attackGrowth,
      cooldown: spec.cooldown,
      range: spec.range,
      color: spec.color,
      weapon: spec.weapon,
      resourceName: spec.resourceName,
    };
  }
  const core = hero.coreJob ? legacyCoreJob(hero.coreJob) : undefined;
  if (core) {
    return {
      label: core.name,
      title: core.role,
      description: core.description,
      hp: core.hp,
      hpGrowth: core.hpGrowth,
      attack: core.attack,
      attackGrowth: core.attackGrowth,
      cooldown: core.cooldown,
      range: core.range,
      color: core.color,
      weapon: core.weapon,
      resourceName: core.resourceName,
    };
  }
  return (
    oldJob(hero.job) ?? {
      label: 'Adventurer',
      title: 'Penjelajah',
      description: 'Petualang yang sedang mencari takdirnya.',
      hp: 110,
      hpGrowth: 28,
      attack: 22,
      attackGrowth: 5,
      cooldown: 0.46,
      range: 3.4,
      color: '#9b8b6e',
      weapon: 'none',
      resourceName: 'Mana',
    }
  );
}

export function jobProfile(job: JobId) {
  const hero = freshHero('profile', job);
  return combatProfile(hero);
}

const slotNumber = (slotId: string) => slotId.replace('slot-', '');
const appearanceValue = <T extends readonly { id: string }[]>(items: T, value: unknown, fallback: T[number]['id']) =>
  typeof value === 'string' && items.some(item => item.id === value) ? value : fallback;

export function normalizeAppearance(value: unknown, gender: CharacterGender = 'male'): CharacterAppearance {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const selectedGender = source.gender === 'female' || gender === 'female' ? 'female' : 'male';
  return {
    gender: selectedGender,
    faceStyleId: appearanceValue(FACE_STYLE_PRESETS, source.faceStyleId, DEFAULT_APPEARANCE.faceStyleId),
    hairStyleId: appearanceValue(HAIR_STYLE_PRESETS, source.hairStyleId, DEFAULT_APPEARANCE.hairStyleId),
    hairColorId: appearanceValue(HAIR_COLOR_PRESETS, source.hairColorId, DEFAULT_APPEARANCE.hairColorId),
    skinToneId: appearanceValue(SKIN_TONE_PRESETS, source.skinToneId, DEFAULT_APPEARANCE.skinToneId),
  };
}

export function newCharacterId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return `character_${crypto.randomUUID()}`;
  return `character_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCharacterName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateCharacterName(value: string, excludeCharacterId?: string): string | null {
  const name = normalizeCharacterName(value);
  if (name.length < 3) return 'Nama minimal 3 karakter.';
  if (name.length > 16) return 'Nama maksimal 16 karakter.';
  if (!/^[\p{L}\p{N} _'-]+$/u.test(name)) return 'Nama hanya boleh berisi huruf, angka, spasi, apostrof, atau tanda hubung.';
  const normalized = name.toLocaleLowerCase();
  if (listCharacters().some(slot => slot.hero && slot.hero.characterId !== excludeCharacterId && normalizeCharacterName(slot.hero.characterName).toLocaleLowerCase() === normalized))
    return 'Nama tersebut sudah digunakan karakter lain.';
  return null;
}

const displayLabel = (
  hero: Pick<Hero, 'coreJob' | 'specialization' | 'job'> & Partial<Pick<Hero, 'progressionArchitecture'>>,
) => {
  if (getVisibleJobArchitecture(hero).v2) return getVisibleJobArchitecture(hero).currentName;
  if (hero.specialization === 'berserker') return 'Berserker';
  if (hero.specialization === 'blade_master') return 'Blade Master';
  if (hero.specialization) return SPECIALIZATIONS[hero.specialization].name;
  if (hero.coreJob) return legacyCoreJob(hero.coreJob)?.name ?? hero.coreJob;
  return hero.job === 'adventurer'
    ? 'Adventurer'
    : (oldJob(hero.job)?.label ?? 'Adventurer');
};

export function freshHero(
  slotId = 'slot-1',
  job: JobId = 'adventurer',
  characterName = `${job === 'adventurer' ? 'Adventurer' : (oldJob(job)?.label ?? job)} ${slotNumber(slotId)}`,
  gender: CharacterGender = 'male',
): Hero {
  const legacyProfile = oldJob(job);
  const appearance = normalizeAppearance({ gender }, gender);
  const profile = legacyProfile ?? {
    hp: 110,
    hpGrowth: 28,
    attack: 22,
    attackGrowth: 5,
    weapon: 'none' as WeaponType,
  };
  const starterBlade = createItem('legacy-fajar-blade', {
    id: `${slotId}-fajar-blade`,
    isEquipped: true,
  });
  const starterEquipment = emptyEquipment();
  starterEquipment.mainHand = starterBlade.id;
  return {
    canDualWieldOneHandSwords: false,
    version: 3,
    primaryHotbarVersion: 1,
    retiredItems: [],
    primaryHotbar: Array(PRIMARY_HOTBAR_SIZE).fill(null),
    primaryHotbarLayout: null,
    primaryHotbarOverflow: [],
    quickHotbars: emptyQuickHotbars(),
    itemCooldowns: {},
    selectedAmmo: null,
    currentCity: 'arunika', currentField: 'verdant-plains', inCity: true,
    unlockedCities: ['arunika'], unlockedFields: startingFieldIds(),
    completedQuests: [], acceptedQuests: [], activeQuests: [], questCooldowns: {}, cityProgress: {}, fieldProgress: {}, defeatedFieldBosses: [], defeatedBossTimestamp: {}, monsterRespawnState: {}, storage: [],
    characterId: `${slotId}-character`,
    slotId,
    characterName,
    gender: appearance.gender,
    appearance,
    createdAt: 0,
    lastPlayedAt: 0,
    playTimeSeconds: 0,
    lastSafePosition: { x: 0, z: 7 },
    spawnPointId: 'arunika-start',
    job,
    jobTier: 'adventurer',
    coreJob: null,
    specialization: null,
    weaponType: profile.weapon,
    level: 1,
    xp: 0,
    gold: 0,
    kills: 0,
    hp: profile.hp + vitalityHPContribution(1, BASE_PRIMARY_STAT),
    potions: 3,
    weapon: 0,
    questClaimed: false,
    bossDefeated: false,
    x: 0,
    z: 7,
    skillPoints: 0,
    rankOwnership:{version:1,active:Object.fromEntries(skillsFor(null,null).map(skill=>[skill.id,{granted:skill.slot===4?0:1,paid:0}])),passive:{}},
    statPoints: 0,
    allocatedStats: { str: 0, vit: 0, dex: 0, int: 0 },
    skillLevels: Object.fromEntries(
      skillsFor(null, null).map((skill) => [
        skill.id,
        skill.slot === 4 ? 0 : 1,
      ]),
    ),
    passiveLevels: {},
    masteryChoices: {},
    mana: 100 + BASE_PRIMARY_STAT * INT_MP_FACTOR,
    maxMana: 100 + BASE_PRIMARY_STAT * INT_MP_FACTOR,
    stamina: 100,
    barrier: 0,
    activeBuffs: {},
    statusEffects: {},
    coreQuestClaimed: false,
    specializationQuestClaimed: false,
    masteryQuestClaimed: false,
    jobHistory: {},
    inventoryCapacity: WORLD_CONFIG.inventoryCapacity,
    pendingLoot: [],
    petRecords: {},
    inventory: [
      createItem('health-potion-1', { id: `${slotId}-potion-light`, quantity: 3 }),
      starterBlade,
      createItem('adventurer-pet-egg', { id: `${slotId}-pet-egg` }),
    ],
    equipment: starterEquipment,
    pet: null,
    fateRune: null,
    eternalSeal: null,
    enhancementSealEnabled: true,
  };
}

/** Explicit fixture/developer factory, not exposed by character creation or promotion UI. */
export function createV2TestHero():Hero {return {...freshHero('v2-development-only'),characterSchemaVersion:CURRENT_CHARACTER_SCHEMA_VERSION,progressionArchitecture:'v2_test'};}

/** Explicit development-only Adventurer V3 path. Existing V2 characters are not converted. */
export function createV3AdventurerHero(slotId = 'v3-adventurer-development', characterName = 'Adventurer V3'): Hero {
  const hero = freshHero(slotId, 'adventurer', characterName);
  hero.characterSchemaVersion = CURRENT_CHARACTER_SCHEMA_VERSION;
  hero.progressionArchitecture = 'v3_adventurer';
  hero.skillArchitectureVersion = 3;
  hero.skillProgressionV3 = adventurerV3StartingState();
  hero.inventory = hero.inventory.map((item) => item.id === hero.equipment.mainHand
    ? { ...item, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false }
    : item);
  hero.skillLevels = Object.fromEntries(ADVENTURER_V3_RUNTIME_SKILLS.map((skill) => [skill.id, skill.id === 'v3-adventurer-quick-slash' ? 1 : 0]));
  return hero;
}

/** Explicit development-only Core transition; legacy Warrior V2 is untouched. */
export function chooseV3Warrior(hero: Hero): boolean {
  if (hero.skillArchitectureVersion !== 3 || hero.level < 15 || hero.coreJob || !hero.skillProgressionV3) return false;
  hero.skillProgressionV3 = warriorV3StateAfterCoreChange(hero.skillProgressionV3);
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  hero.jobTier = 'core';
  hero.weaponType = 'one_hand_sword';
  hero.skillLevels = Object.fromEntries([...ADVENTURER_V3_RUNTIME_SKILLS, ...WARRIOR_V3_RUNTIME_SKILLS].map((skill) => [skill.id, hero.skillProgressionV3!.skillRanks[skill.id] ?? 0]));
  hero.primaryHotbar = hero.primaryHotbar.map(() => null);
  hero.primaryHotbarOverflow = [];
  hero.quickHotbars = emptyQuickHotbars();
  hero.coreQuestClaimed = true;
  hero.jobHistory = { ...hero.jobHistory, core: { level: hero.level, chapter: 1, acquiredAt: Date.now() } };
  return true;
}

/** Development-only V3 specialization transition; legacy V2 promotion is untouched. */
export function chooseV3Berserker(hero: Hero): boolean {
  if (hero.skillArchitectureVersion !== 3 || hero.level < 60 || hero.coreJob !== 'warrior' || hero.specialization || !hero.skillProgressionV3) return false;
  hero.skillProgressionV3 = berserkerV3StateAfterSpecialization(hero.skillProgressionV3);
  hero.specialization = 'berserker';
  hero.job = 'warrior';
  hero.jobTier = 'specialization';
  hero.weaponType = 'two_hand_sword';
  hero.skillLevels = Object.fromEntries([...ADVENTURER_V3_RUNTIME_SKILLS, ...WARRIOR_V3_RUNTIME_SKILLS, ...BERSERKER_V3_RUNTIME_SKILLS].map((skill) => [skill.id, hero.skillProgressionV3!.skillRanks[skill.id] ?? 0]));
  hero.primaryHotbar = hero.primaryHotbar.map(() => null);
  hero.primaryHotbarOverflow = [];
  hero.quickHotbars = emptyQuickHotbars();
  hero.specializationQuestClaimed = true;
  hero.jobHistory = { ...hero.jobHistory, specialization: { level: hero.level, chapter: 1, acquiredAt: Date.now() } };
  return true;
}

/** Development-only V3 Blade Master transition; V2 promotion remains separate. */
export function chooseV3BladeMaster(hero: Hero): boolean {
  if (hero.skillArchitectureVersion !== 3 || hero.level < 60 || hero.coreJob !== 'warrior' || hero.specialization || !hero.skillProgressionV3) return false;
  hero.skillProgressionV3 = bladeMasterV3StateAfterSpecialization(hero.skillProgressionV3);
  hero.specialization = 'blade_master'; hero.job = 'warrior'; hero.jobTier = 'specialization'; hero.weaponType = 'dual_sword';
  hero.skillLevels = Object.fromEntries([...ADVENTURER_V3_RUNTIME_SKILLS, ...WARRIOR_V3_RUNTIME_SKILLS, ...BLADE_MASTER_V3_RUNTIME_SKILLS].map((skill) => [skill.id, hero.skillProgressionV3!.skillRanks[skill.id] ?? 0]));
  hero.primaryHotbar = hero.primaryHotbar.map(() => null); hero.primaryHotbarOverflow = []; hero.quickHotbars = emptyQuickHotbars();
  hero.specializationQuestClaimed = true;
  hero.jobHistory = { ...hero.jobHistory, specialization: { level: hero.level, chapter: 1, acquiredAt: Date.now() } };
  return true;
}

export type V3JobDevelopmentStage = 'warrior-15' | 'warrior-60' | 'berserker-60' | 'blade-master-60';
/** Development/test-save helper only. It is intentionally not wired to production UI. */
export function createV3JobDevelopmentHero(stage: V3JobDevelopmentStage): Hero {
  const hero = createV3AdventurerHero(`v3-job-${stage}`, `V3 ${stage}`);
  hero.level = stage === 'warrior-15' ? 15 : 60;
  if (hero.skillProgressionV3) hero.skillProgressionV3.totalEarnedSP = 500;
  if (!chooseV3Warrior(hero)) throw new Error(`Unable to create development stage ${stage}`);
  if (stage === 'berserker-60' && !chooseV3Berserker(hero)) throw new Error(`Unable to create development stage ${stage}`);
  if (stage === 'blade-master-60' && !chooseV3BladeMaster(hero)) throw new Error(`Unable to create development stage ${stage}`);
  if (stage === 'blade-master-60') {
    hero.inventory.push(createItem('legacy-fajar-blade', {
      id: `${hero.slotId}-fajar-blade-offhand`,
      isEquipped: false,
    }));
  }
  return hero;
}

/** Reconciles equipment with the progression-derived Blade Master capability. */
export function reconcileBladeMasterEquipment(hero: Hero) {
  if (bladeMasterDualWieldActive(hero)) return false;
  const off = hero.inventory.find((item) => item.id === hero.equipment.offHand);
  const main = hero.inventory.find((item) => item.id === hero.equipment.mainHand);
  if (off && main && off.equipmentType === 'one_hand_sword' && main.equipmentType === 'one_hand_sword') {
    hero.equipment.offHand = null;
    hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: Object.values(hero.equipment).includes(item.id) }));
    hero.hp = Math.min(hero.hp, maxHP(hero));
    hero.maxMana = derivedStats(hero).maxMana;
    hero.mana = Math.min(hero.mana, hero.maxMana);
    return true;
  }
  return false;
}

const dualWieldCapabilityForHero = (hero: Hero) => hero.specialization === 'blade_master'
  ? bladeMasterDualWieldActive(hero)
  : hero.canDualWieldOneHandSwords === true;

/** Memory-only foundation fixture. No promotion route, save migration or legacy skill grants.
 * Thief development content retains the approved Adventurer stat baseline, NOT Rogue balance. */
export function createV2CoreFoundationHero(coreJob: 'thief', level = 15): Hero {
  if(coreJob!=='thief')throw new Error('Only the approved Thief foundation fixture is available.');
  const hero = createV2TestHero();
  hero.level = Math.max(15, Math.min(59, Math.floor(Number.isFinite(level) ? level : 15)));
  hero.coreJob = coreJob; hero.job = coreJob; hero.jobTier = 'core';
  authorizeV2Thief(hero);
  return hero;
}

/** Controlled development entry only. Public promotion explicitly continues to reject Thief. */
export function authorizeV2Thief(hero:Hero) {
  if(hero.progressionArchitecture!=='v2_test'||hero.level<15||(hero.coreJob&&hero.coreJob!=='thief')||hero.specialization)return false;
  if (!hero.coreJob) resetPlayerAllocationForCoreJob(hero);
  hero.coreJob='thief';hero.job='thief';hero.jobTier='core';
  if(!(hero.skillLevels['v2-thief-quick-stab']>0)){
    hero.rankOwnership=normalizedRankOwnership(hero);
    hero.rankOwnership.active['v2-thief-quick-stab']={granted:0,paid:0};
  }
  grantRank(hero,'active','v2-thief-quick-stab',1);
  return true;
}

/** CFV3-1: the first Core Job change reopens all earned points for allocation. */
export function resetPlayerAllocationForCoreJob(hero: Hero) {
  hero.allocatedStats = { str: 0, vit: 0, dex: 0, int: 0 };
  hero.statPoints = calculateTotalStatPoints(hero.level, hero.progressionArchitecture);
  hero.hp = Math.min(hero.hp, maxHP(hero));
  hero.maxMana = derivedStats(hero).maxMana;
  hero.mana = Math.min(hero.mana, hero.maxMana);
}

function isLocalhostMemoryHarness(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname } = window.location ?? {};
  return ['localhost', '127.0.0.1'].includes(hostname ?? '')
    && typeof pathname === 'string'
    && pathname.includes('warrior-world')
    || ['localhost', '127.0.0.1'].includes(hostname ?? '')
    && typeof pathname === 'string'
    && pathname.includes('thief-world');
}

export function isCompatibleCharacterSave(hero: Pick<Hero, 'characterSchemaVersion' | 'progressionArchitecture' | 'skillArchitectureVersion'> | null | undefined): boolean {
  if (hero?.characterSchemaVersion === CURRENT_CHARACTER_SCHEMA_VERSION
    && hero.progressionArchitecture === 'v3_adventurer'
    && hero.skillArchitectureVersion === 3) {
    return true;
  }
  return Boolean(
    hero &&
    hero.characterSchemaVersion === CURRENT_CHARACTER_SCHEMA_VERSION &&
    hero.progressionArchitecture === 'v2_test' &&
    isLocalhostMemoryHarness(),
  );
}

/** The only player-facing core-job promotion path after the development clean break. */
export function chooseV2CoreJob(hero: Hero, coreJob: CoreJobId) {
  if (hero.progressionArchitecture !== 'v2_test' || coreJob !== 'warrior') return false;
  return authorizeV2Warrior(hero);
}

/** Explicit development authorization only. Never called by live trainer/creation/load. */
export function authorizeV2Warrior(hero:Hero){
  if(hero.progressionArchitecture!=='v2_test'||hero.level<15||(hero.coreJob&&hero.coreJob!=='warrior')||hero.specialization)return false;
  if (!hero.coreJob) resetPlayerAllocationForCoreJob(hero);
  hero.coreJob='warrior';hero.job='warrior';hero.jobTier='core';
  if(!(hero.skillLevels['v2-warrior-strike']>0)){
    hero.rankOwnership=normalizedRankOwnership(hero);
    hero.rankOwnership.active['v2-warrior-strike']={granted:0,paid:0};
  }
  grantRank(hero,'active','v2-warrior-strike',1);
  return true;
}

export function createNewCharacter(
  slotId: string,
  characterName: string,
  appearanceInput: Partial<CharacterAppearance> = {},
  architecture: 'v3_adventurer' = 'v3_adventurer',
): Hero {
  const normalizedName = normalizeCharacterName(characterName);
  const appearance = normalizeAppearance({ ...appearanceInput, gender: appearanceInput.gender ?? 'male' });
  const hero = freshHero(slotId, 'adventurer', normalizedName, appearance.gender);
  hero.characterSchemaVersion = CURRENT_CHARACTER_SCHEMA_VERSION;
  hero.progressionArchitecture = architecture;
  if (architecture === 'v3_adventurer') {
    hero.skillArchitectureVersion = 3;
    hero.skillProgressionV3 = adventurerV3StartingState();
    hero.inventory = hero.inventory.map((item) => item.id === hero.equipment.mainHand
      ? { ...item, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false }
      : item);
    hero.skillLevels = Object.fromEntries(ADVENTURER_V3_RUNTIME_SKILLS.map((skill) => [skill.id, skill.id === 'v3-adventurer-quick-slash' ? 1 : 0]));
  }
  hero.characterId = newCharacterId();
  hero.characterName = normalizedName;
  hero.gender = appearance.gender;
  hero.appearance = appearance;
  hero.createdAt = Date.now();
  hero.lastPlayedAt = 0;
  hero.lastSafePosition = { x: hero.x, z: hero.z };
  return hero;
}

const sumStats = (target: StatBlock, source: StatBlock) => {
  for (const key of Object.keys(source) as Array<keyof StatBlock>) {
    target[key] = (target[key] ?? 0) + (source[key] ?? 0);
  }
  return target;
};

/** CFV3-2.1: only Staff/Wand raw ATK is compatible with the generic magic foundation. */
const compatibleMagicWeaponAttack = (hero: Hero): number => {
  const mainHand = itemById(hero.inventory, hero.equipment.mainHand);
  if (!mainHand || !['staff', 'wand'].includes(mainHand.equipmentType ?? '')) return 0;
  return mainHand.baseStats.attack ?? 0;
};

export const calculateBaseStats = (hero: Hero, allocated: AllocatedStats = hero.allocatedStats) => {
  const profile=combatProfile(hero);const level=hero.level-1;
  return {profile,level,str:BASE_PRIMARY_STAT+(allocated.str??0),vit:BASE_PRIMARY_STAT+(allocated.vit??allocated.sta??0),dex:BASE_PRIMARY_STAT+(allocated.dex??0),int:BASE_PRIMARY_STAT+(allocated.int??0)};
};

export const calculateEquipmentStats = (hero: Hero) => {
  const result: StatBlock = {};
  for (const itemId of new Set(Object.values(hero.equipment))) {
    const item = itemById(hero.inventory, itemId);
    if (item) sumStats(result, calculateItemEquipmentStats(item));
  }
  if (hero.pet) sumStats(result, hero.pet.bonusStats);
  return result;
};

export const calculateRuneStats = (hero: Hero) => {
  const result:StatBlock={};for(const itemId of new Set(Object.values(hero.equipment))){const item=itemById(hero.inventory,itemId);if(item)sumStats(result,calculateItemRuneStats(item));}return result;
};
export const getEquippedItems = (hero: Hero) => [...new Set(Object.values(hero.equipment))].map(id => itemById(hero.inventory, id)).filter((item): item is ItemData => Boolean(item));
export function calculateUniqueStats(hero: Hero): StatBlock {
  return getEquippedItems(hero).reduce((result, item) => sumStats(result, calculateEquipmentUniqueStats(item)), {} as StatBlock);
}
export function calculatePassiveEffects(hero: Hero): StatBlock {
  const result: StatBlock = {};
  for (const passive of ALL_PASSIVES) {
    if(!skillArchitectureAllowed(hero,passive))continue;
    if (passive.job && passive.job !== 'adventurer' && passive.job !== hero.coreJob) continue;
    if (passive.specialization && passive.specialization !== hero.specialization) continue;
    if (hero.level < passive.unlockLevel || (passive.tier === 'capstone' && !hero.masteryQuestClaimed)) continue;
    const level = Math.min(passive.maxLevel, hero.passiveLevels[passive.id] ?? 0);
    for (const [key, value] of Object.entries(PASSIVE_EFFECTS[passive.id] ?? {})) result[key as keyof StatBlock] = (result[key as keyof StatBlock] ?? 0) + value * level;
  }
  return result;
}
export function calculateBuffStats(hero: Hero): StatBlock {
  return hero.activeBuffs.damageReduction > 0 ? { damageReduction: 45 } : {};
}

export type DerivedStats = {
  maxHP: number;
  physicalAttack: number;
  attack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
  accuracy: number;
  elementalResistance: number;
  defense: number;
  criticalRate: number;
  criticalDamage: number;
  attackSpeed: number;
  movementSpeed: number;
  evasion: number;
  blockRate: number;
  healingPower: number;
  hpRecovery: number;
  staminaMax: number;
  maxMana: number;
  skillPower: number;
  manaCostReduction: number;
  manaRecovery: number;
  damageReduction: number;
  cooldownReduction: number;
  physicalPenetration: number;
  magicPenetration: number;
  bossDamage: number;
  eliteDamage: number;
  skillDamage: number;
  expGain: number;
  goldDropRate: number;
  itemDropRate: number;
  materialDropRate: number;
};
export function learnedPassiveDefinitions(hero:Hero){
  return ALL_PASSIVES.filter(p=>skillArchitectureAllowed(hero,p)&&(!p.job||p.job==='adventurer'||p.job===hero.coreJob)&&(!p.specialization||p.specialization===hero.specialization)&&hero.level>=p.unlockLevel&&(hero.passiveLevels[p.id]??0)>0&&(p.tier!=='capstone'||hero.masteryQuestClaimed));
}
export function combatModifiersFor(hero:Hero):CombatModifier[]{return [...learnedPassiveDefinitions(hero).flatMap(p=>p.rankModifiers?.[Math.min(p.maxLevel,hero.passiveLevels[p.id])-1]??p.modifiers??[]),...hostModifiers(hero)];}
export function combatSupportFor(hero:Hero):CombatSupport {
  const sources=learnedPassiveDefinitions(hero).map(p=>p.rankCombatSupport?.[Math.min(p.maxLevel,hero.passiveLevels[p.id])-1]??p.combatSupport);
  return {stacks:sources.flatMap(s=>s?.stacks??[]),windows:sources.flatMap(s=>s?.windows??[])};
}
export function modifierContextFor(hero:Hero,stats:DerivedStats,counter?:CounterContext):ModifierContext {
  return {hp:hero.hp,maxHP:stats.maxHP,weaponStyle:resolveWeaponStyle(itemById(hero.inventory,hero.equipment.mainHand),itemById(hero.inventory,hero.equipment.offHand)),counter,manualGuard:isManualGuarding(hero),activeModifierIds:hostModifiers(hero).map(m=>m.id)};
}

export function derivedStats(
  hero: Hero,
  allocated: AllocatedStats = hero.allocatedStats,
  contributions?: StatBlock,
  includeBuffs = true,
): DerivedStats {
  const base=calculateBaseStats(hero,allocated);const {profile,level}=base;
  const gear = contributions ?? sumStats(calculateEquipmentStats(hero), calculatePassiveEffects(hero));
  const str = base.str + (gear.str ?? 0);
  const dex = base.dex + (gear.dex ?? 0);
  const int = base.int + (gear.int ?? 0);
  const vit = base.vit + (gear.vit ?? gear.sta ?? 0);
  const weaponStyle = resolveWeaponStyle(itemById(hero.inventory, hero.equipment.mainHand), itemById(hero.inventory, hero.equipment.offHand));
  const berserkerMasteryRank = hero.skillArchitectureVersion === 3 && hero.specialization === 'berserker' && weaponStyle === 'two_hand_sword'
    ? hero.skillProgressionV3?.skillRanks['v3-berserker-two-hand-mastery'] ?? 0
    : 0;
  const bladeMasteryRank = hero.skillArchitectureVersion === 3 && hero.specialization === 'blade_master' && weaponStyle === 'dual_sword'
    ? hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0
    : 0;
  const masteryAccuracy = (weaponStyle === 'two_hand_sword' ? [0, 2, 4, 6, 8, 10][Math.min(5, berserkerMasteryRank)] : 0)
    + (weaponStyle === 'dual_sword' ? [0, 2, 4, 6, 8, 10][Math.min(5, bladeMasteryRank)] : 0);
  const physicalStatFactor = PHYSICAL_WEAPON_STAT_FACTORS[weaponStyle] ?? 0;
  const physicalStatContribution = Math.max(0, str - BASE_PRIMARY_STAT) * physicalStatFactor;
  const basePhysicalAttack = basePhysicalAttackForLevel(hero.level);
  // `hero.weapon` is a legacy progression field and is intentionally excluded
  // from the live CFV3 resolver. Raw weapon power comes from equipped item data.
  const physicalAttack=Math.round((basePhysicalAttack+physicalStatContribution+(gear.attack??0))*(1+((gear.attackPercent??0)+(gear.physicalDamage??0))/100));
  const baseJobAttack=profile.attack+level*profile.attackGrowth;
  const magicAttack=Math.round((baseJobAttack+compatibleMagicWeaponAttack(hero)+(gear.magicAttack??0)+int*2));
  const physicalDefense=Math.round((8+level*1.5+vit*.5+(gear.defense??0))*10)/10;
  const softCap=(value:number,threshold:number,cap:number)=>Math.min(cap,value<=threshold?value:threshold+(value-threshold)*.35);
  const result:DerivedStats = {
    maxHP: Math.round(
      profile.hp + level * profile.hpGrowth + vitalityHPContribution(hero.level, vit) + (gear.hp ?? 0),
    ),
    physicalAttack,
    attack: physicalAttack,
    magicAttack,
    physicalDefense,
    magicDefense: Math.round((8 + level * 1.5 + int * .5 + (gear.magicDefense ?? 0))*10)/10,
    accuracy: Math.round((90 + dex + (gear.accuracy ?? 0) + masteryAccuracy) * 10) / 10,
    elementalResistance: 0,
    defense: physicalDefense,
    criticalRate: Math.round(Math.min(100,2+dex*.1+(gear.critRate??0))*10)/10,
    criticalDamage: Math.round((150 + (gear.critDamage ?? 0)) * 10) / 10,
    attackSpeed:Math.round((100+dex*.15+(gear.attackSpeed??0))*100)/100,
    movementSpeed:Math.round(Math.min(135,100+(gear.movementSpeed??0))*10)/10,
    evasion: Math.round((dex * 0.1 + (gear.evasion ?? 0)) * 10) / 10,
    blockRate: Math.round((gear.blockRate ?? 0) * 10) / 10,
    healingPower: Math.round((int * .25 + (gear.healingPower ?? 0)) * 100) / 100,
    hpRecovery: Math.round((vit * .1 + (gear.hpRecovery ?? 0)) * 100) / 100,
    staminaMax: staminaDerivedValue(hero, Math.round(100 + vit * 4 + (gear.stamina ?? 0))),
    maxMana: Math.max(1,Math.round(100 + int * INT_MP_FACTOR + (gear.maxMana ?? 0))),
    manaCostReduction: Math.round(Math.min(50,Math.max(0,int*.1+(gear.manaCostReduction??0)))*10)/10,
    // No passive MP regeneration at the base INT value. Additional effective
    // INT grants recovery, while equipment MP Recovery remains an explicit
    // bonus. This keeps the starting mana pool stable without free sustain.
    manaRecovery: Math.round(
      Math.min(
        30,
        Math.max(0, Math.max(0, int - BASE_PRIMARY_STAT) * 0.1 + (gear.mpRecovery ?? 0)),
      ) * 100,
    ) / 100,
    // Optional secondary skill stat: primary attributes never supply generic Skill Power.
    skillPower: Math.round((gear.skillPower ?? 0) * 10) / 10,
    damageReduction:Math.round((1 - (1 - softCap(gear.damageReduction??0,25,45)/100) * (includeBuffs && hero.activeBuffs.damageReduction > 0 ? .55 : 1)) * 1000)/10,
    cooldownReduction:Math.round(Math.min(30,Math.max(0,gear.cooldownReduction??0))*10)/10,
    physicalPenetration: Math.max(0, gear.physicalPenetration ?? 0),
    magicPenetration: Math.max(0, gear.magicPenetration ?? 0),
    bossDamage:Math.min(40,gear.bossDamage??0),
    eliteDamage:Math.min(45,gear.eliteDamage??0),
    skillDamage:Math.min(45,gear.skillDamage??0),
    expGain:Math.min(30,gear.expGain??0),
    goldDropRate:Math.min(40,gear.goldDropRate??0),
    itemDropRate:Math.min(25,gear.itemDropRate??0),
    materialDropRate:Math.min(15,gear.materialDropRate??0),
  };
  const modifiers=includeBuffs?combatModifiersFor(hero):learnedPassiveDefinitions(hero).flatMap(p=>p.modifiers??[]);
  return modifiers.length?applyStatModifiers(result,modifiers,modifierContextFor(hero,result)):result;
}

export const calculateFinalCharacterStats = derivedStats;

export { mitigateDamage } from './combat-mechanics.ts';

// Reuse the combat formula for every column; differences also include soft caps and rounding.
export function characterStatBreakdown(hero: Hero) {
  const groups: Array<{ label: string; stats: StatBlock }> = ['Equipment', 'Rune', 'Unique Stats'].map(label => ({ label, stats: {} }));
  for (const item of getEquippedItems(hero)) {
    const blocks = [calculateBaseEquipmentStats(item), calculateItemRuneStats(item), calculateEquipmentUniqueStats(item)];
    blocks.forEach((block, index) => {
      for (const [key, value] of Object.entries(block)) groups[index].stats[key as keyof StatBlock] = (groups[index].stats[key as keyof StatBlock] ?? 0) + value * (1 + item.enhancementLevel * .08);
    });
  }
  if (hero.pet) sumStats(groups[0].stats, hero.pet.bonusStats);
  groups.push({label:'Passive', stats:calculatePassiveEffects(hero)});
  const base = derivedStats(hero, hero.allocatedStats, {}, false);
  let previous = base;
  const total: StatBlock = {};
  const columns = groups.map(group => {
    sumStats(total, group.stats);
    const next = derivedStats(hero, hero.allocatedStats, total, false);
    const delta = Object.fromEntries(Object.keys(next).map(key => [key, next[key as keyof DerivedStats] - previous[key as keyof DerivedStats]])) as DerivedStats;
    previous = next;
    return {label:group.label, stats:delta};
  });
  const final = derivedStats(hero);
  columns.push({label:'Buff', stats:Object.fromEntries(Object.keys(final).map(key => [key, final[key as keyof DerivedStats] - previous[key as keyof DerivedStats]])) as DerivedStats});
  return {base, columns, final};
}

export const maxHP = (hero: Hero) => derivedStats(hero).maxHP;
export const attackPower = (hero: Hero) => derivedStats(hero).attack;
/** Central basic-attack physical power before combo/critical/defense handling. */
export const basicAttackPower = (hero: Hero) => {
  const stats = derivedStats(hero);
  return stats.physicalAttack * BASIC_ATTACK_COEFFICIENT * actionDamageMultiplier(
    combatModifiersFor(hero),
    modifierContextFor(hero, stats),
    { tags: ['physical-damage', 'basic-attack'] },
  );
};

export const xpNeeded = (level: number) => 90 + level * 40;
export const forgeCost = (weapon: number) => 60 + weapon * 50;
export const manaResourceName = () => 'Mana';
export const activeSkills = (hero: Hero): SkillDefinition[] =>
  hero.skillArchitectureVersion === 3
    ? [...ADVENTURER_V3_RUNTIME_SKILLS, ...(hero.coreJob === 'warrior' ? WARRIOR_V3_RUNTIME_SKILLS : []), ...(hero.specialization === 'berserker' ? BERSERKER_V3_RUNTIME_SKILLS : []), ...(hero.specialization === 'blade_master' ? BLADE_MASTER_V3_RUNTIME_SKILLS : [])]
    : activeSkillsFor(hero.coreJob, hero.specialization, hero.progressionArchitecture === 'v2_test' ? 'v2_test' : 'legacy');
/** Same weapon availability for live casting and read-only build evaluation. */
export function equippedWeaponType(hero: Hero): WeaponType {
  const main = itemById(hero.inventory, hero.equipment.mainHand);
  const off = itemById(hero.inventory, hero.equipment.offHand);
  if (hero.specialization === 'garda') return main && off?.itemType === 'shield' ? 'sword_shield' : 'none';
  if (hero.specialization === 'anom') return main && off?.itemType === 'dagger' ? 'sword_dagger' : 'none';
  return main?.weaponType ?? 'none';
}
export const skillLevel = (hero: Hero, skill: SkillDefinition) =>
  hero.skillArchitectureVersion === 3
    ? hero.skillProgressionV3?.skillRanks[skill.id] ?? hero.skillLevels[skill.id] ?? 0
    : hero.skillLevels[skill.id] ?? 0;
export const isSkillUnlocked = (hero: Hero, skill: SkillDefinition) =>
  activeSkills(hero).some(entry => entry.id === skill.id) && hero.level >= skill.unlockLevel && skillLevel(hero, skill) > 0;

export const calculateActiveSkills = activeSkills;
export function getSkillManaCost(hero:Hero, skillId:string) {
  const skill=activeSkills(hero).find(entry=>entry.id===skillId);
  if(!skill)return 0;
  return resolveHeroSkill(hero,skill).manaCost;
}
export function canCastSkill(hero:Hero,skillId:string,cooldowns:Record<string,number>={},weapon?:WeaponType,resolvedManaCost?:number) {
  const skill=activeSkills(hero).find(entry=>entry.id===skillId);
  if(!skill)return {ok:false,reason:'Skill tidak terdaftar.'};
  if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup untuk menggunakan skill.'};
  if(!isSkillUnlocked(hero,skill))return {ok:false,reason:`${skill.name} terbuka pada level ${skill.unlockLevel} dan harus dipelajari.`};
  if((cooldowns[skillId]??0)>0)return {ok:false,reason:`${skill.name} masih cooldown ${Math.ceil(cooldowns[skillId])} dtk.`};
  if(hero.mana<(resolvedManaCost??getSkillManaCost(hero,skillId)))return {ok:false,reason:'Mana tidak cukup.'};
  if(weapon!==undefined&&!skillWeaponAllowed(hero,skill,weapon))return {ok:false,reason:`${skill.name} membutuhkan senjata yang sesuai.`};
  return {ok:true,reason:''};
}
export function consumeMana(hero:Hero,amount:number) {
  if(!Number.isFinite(amount)||amount<0||!Number.isFinite(hero.mana)||hero.mana<amount)return false;
  hero.mana-=amount;
  return true;
}
export function restoreMana(hero:Hero,amount:number) {
  if(!Number.isFinite(amount)||amount<=0)return 0;
  const maximum=derivedStats(hero).maxMana;
  const previous=Math.min(maximum,Math.max(0,hero.mana));
  hero.maxMana=maximum;
  hero.mana=Math.min(maximum,previous+amount);
  return hero.mana-previous;
}
export function skillCosts(hero: Hero, skill: SkillDefinition) {
  const action=resolveHeroSkill(hero,skill);
  return {manaCost:action.manaCost,cooldown:action.cooldown};
}
export function skillWeaponAllowed(hero:Hero, skill:SkillDefinition, legacy=equippedWeaponType(hero)) {
  return meetsWeaponRequirement(skill.weaponRequirement,itemById(hero.inventory,hero.equipment.mainHand),itemById(hero.inventory,hero.equipment.offHand),legacy);
}
export function resolveHeroSkill(hero:Hero, skill:SkillDefinition, rank=hero.skillLevels[skill.id]??1, stats=derivedStats(hero),counter?:CounterContext,extraModifiers:CombatModifier[]=[],impact?:ImpactContext,bladeTempoManaReduction=0) {
  const base = calculateBaseStats(hero);
  const gear = calculateEquipmentStats(hero);
  const berserkerSkill = hero.skillArchitectureVersion === 3 && hero.specialization === 'berserker' && skill.tags?.includes('v3-berserker');
  const masteryRank = hero.skillArchitectureVersion === 3 && hero.specialization === 'berserker' ? (hero.skillProgressionV3?.skillRanks['v3-berserker-two-hand-mastery'] ?? 0) : 0;
  const bladeSkill = hero.skillArchitectureVersion === 3 && hero.specialization === 'blade_master' && skill.tags?.includes('v3-blade-master');
  const bladeMasteryRank = bladeSkill ? (hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0) : 0;
  const weaponStyle = resolveWeaponStyle(itemById(hero.inventory, hero.equipment.mainHand), itemById(hero.inventory, hero.equipment.offHand));
  const masteryActive = masteryRank > 0 && weaponStyle === 'two_hand_sword' && BERSERKER_MASTERY_MANA_SKILLS.has(skill.id);
  const tranceRank = hero.specialization === 'berserker' ? (hero.skillProgressionV3?.skillRanks['v3-berserker-trance'] ?? 0) : 0;
  const tranceActive = tranceRank > 0 && Number(hero.activeBuffs['v3-berserker-trance'] ?? 0) > 0;
  const dualSkill = BLADE_MASTER_DUAL_MANA_SKILLS.has(skill.id);
  const masteryManaSkill = BLADE_MASTER_MASTERY_MANA_SKILLS.has(skill.id);
  const bladeManaReduction = bladeMasteryRank > 0 && masteryManaSkill && weaponStyle === 'dual_sword' ? BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK[Math.min(BLADE_MASTER_MASTERY_MANA_REDUCTION_BY_RANK.length, bladeMasteryRank) - 1] : 0;
  const reduction = Math.max(stats.manaCostReduction, masteryActive ? [0,2,4,6,8,10][Math.min(5, masteryRank)] : 0, bladeManaReduction, dualSkill && weaponStyle === 'dual_sword' ? bladeTempoManaReduction : 0);
  const skillStats = reduction !== stats.manaCostReduction ? { ...stats, manaCostReduction: reduction } : stats;
  const resolved = resolveSkillAction(skill, {
    v2:hero.progressionArchitecture==='v2_test',
    modifiers:[...combatModifiersFor(hero),...extraModifiers],combat:{...modifierContextFor(hero,stats,counter),impact},
    stats: skillStats, rank, masteryPower: hero.masteryChoices[skill.id]==='power'?MASTERY_EFFECTS.power.damage:1,
    masteryCooldown: hero.masteryChoices[skill.id]==='utility'?MASTERY_EFFECTS.utility.cooldown:1,
    equipmentDamage:getEquippedItems(hero).reduce((sum,item)=>sum+(item.skillModifiers[skill.id]??0),0),
    weaponAllowed:skillWeaponAllowed(hero,skill),
    weaponStyle,
    primaryStats: (() => {
      const effective = {
        str: base.str + (gear.str ?? 0),
        vit: base.vit + (gear.vit ?? gear.sta ?? 0),
        dex: base.dex + (gear.dex ?? 0),
        int: base.int + (gear.int ?? 0),
      };
      const warriorLineageV3Skill = hero.skillArchitectureVersion === 3 && skill.tags?.some((tag) =>
        tag === 'v3-adventurer' || tag === 'v3-warrior' || tag === 'v3-berserker' || tag === 'v3-blade-master');
      return warriorLineageV3Skill
        ? { str: Math.max(0, effective.str - 15), vit: Math.max(0, effective.vit - 15), dex: Math.max(0, effective.dex - 15), int: Math.max(0, effective.int - 15) }
        : effective;
    })(),
  });
  if (bladeSkill && resolved.hitSequence.some(hit => hit.weaponHand)) {
    const main = itemById(hero.inventory,hero.equipment.mainHand);
    const off = itemById(hero.inventory,hero.equipment.offHand);
    composeBladeWeaponHits(resolved,stats.physicalAttack,main,off,1+((gear.attackPercent??0)+(gear.physicalDamage??0))/100);
  }
  if (hero.specialization === 'blade_master' && weaponStyle === 'dual_sword' && skill.tags?.includes('v3-warrior') && resolved.hitSequence.some((hit) => hit.physicalCoefficient > 0)) {
    composeSingleMainWeaponHits(
      resolved,
      stats.physicalAttack,
      itemById(hero.inventory,hero.equipment.mainHand),
      itemById(hero.inventory,hero.equipment.offHand),
      1+((gear.attackPercent??0)+(gear.physicalDamage??0))/100,
    );
  }
  if (tranceActive && berserkerSkill && BERSERKER_TRANCE_DAMAGE_SKILLS.has(skill.id) && weaponStyle === 'two_hand_sword') {
    const bonus = [0, 6, 8, 10][Math.min(3, tranceRank)] / 100;
    resolved.hitSequence = resolved.hitSequence.map((hit) => ({ ...hit, damageMultiplier: hit.damageMultiplier * (1 + bonus) }));
    resolved.damageMultiplier *= 1 + bonus;
  }
  if (tranceActive && berserkerSkill && BERSERKER_TRANCE_AOE_SKILLS.has(skill.id) && resolved.maxTargets !== undefined)
    resolved.maxTargets += 1;
  return resolved;
}
function skillProgressionMultiplier(hero: Hero, skill: SkillDefinition, level: number) {
  const modifier=getEquippedItems(hero).reduce((total,item)=>total+(item.skillModifiers[skill.id]??0),0);
  return (1+(level-1)*.12)*(hero.masteryChoices[skill.id]==='power'?MASTERY_EFFECTS.power.damage:1)*(1+modifier);
}
export function skillDamageParts(hero: Hero, skill: SkillDefinition, level=hero.skillLevels[skill.id]??1, stats=derivedStats(hero)) {
  return resolvedDamageParts(resolveHeroSkill(hero,skill,level,stats));
}
export function skillDamagePreview(hero: Hero, skill: SkillDefinition, level=hero.skillLevels[skill.id]??1) {
  const stats=derivedStats(hero);
  return resolveHeroSkill(hero,skill,level,stats).hitSequence.reduce((sum,hit)=>sum+skillHitDamage(hit,stats),0);
}
export function skillHealingPreview(hero: Hero, skill: SkillDefinition, level=hero.skillLevels[skill.id]??1) {
  if (hero.skillArchitectureVersion === 3 && skill.id === 'v3-adventurer-minor-heal') {
    const percent = [6, 8, 10][Math.max(1, Math.min(3, level)) - 1];
    return Math.round(maxHP(hero) * percent / 100);
  }
  const stats=derivedStats(hero);
  const resolved=resolveHeroSkill(hero,skill,level,stats);
  const coefficient=Math.max(.1, skill.damageCoefficient || .65);
  const baseHeal=Math.max(35, resolved.baseDamage || 35);
  const raw=baseHeal + stats.magicAttack * .25 + stats.healingPower * coefficient + stats.skillPower * resolved.skillPowerCoefficient;
  return Math.round(raw * skillProgressionMultiplier(hero,skill,skill.progressionMode==='rank_values'?1:level));
}
export const recalculateSkillAvailability = (hero: Hero) => activeSkills(hero).map(skill => ({skill, unlocked:isSkillUnlocked(hero,skill)}));
export const RESET_SKILLS_GOLD_COST = 500;
export function refundableSkillPoints(hero: Hero) {
  return ALL_SKILLS.reduce((total, skill) => total + rankSource(hero,'active',skill.id).paid, 0)
    + ALL_PASSIVES.reduce((total, passive) => total + rankSource(hero,'passive',passive.id).paid, 0);
}
export function resetSkillPoints(hero: Hero) {
  if (hero.skillArchitectureVersion === 3 && hero.skillProgressionV3) {
    const returnedPoints = spentSkillPointsV3(hero.skillProgressionV3, { ...ADVENTURER_V3_SKILL_MAP, ...WARRIOR_V3_SKILL_MAP, ...BERSERKER_V3_SKILL_MAP, ...BLADE_MASTER_V3_SKILL_MAP });
    if (!returnedPoints) return { ok: false, hero, returnedPoints, reason: 'Belum ada Skill Point yang digunakan.' };
    if (hero.gold < RESET_SKILLS_GOLD_COST) return { ok: false, hero, returnedPoints: 0, reason: 'GOLD tidak cukup.' };
    const state = refundAllSkillPointsForJobChange(hero.skillProgressionV3);
    const updated = { ...hero, gold: hero.gold - RESET_SKILLS_GOLD_COST, skillProgressionV3: state,
      skillLevels: Object.fromEntries(activeSkills(hero).map(skill => [skill.id, state.skillRanks[skill.id] ?? 0])),
      primaryHotbar: hero.primaryHotbar.map(() => null), primaryHotbarOverflow: [], quickHotbars: emptyQuickHotbars(), activeBuffs: {},
    };
    delete updated.temporaryModifiers; delete updated.combatStateModifiers;
    reconcileBladeMasterEquipment(updated);
    const stats = derivedStats(updated);
    updated.hp = Math.min(updated.hp, stats.maxHP);
    updated.maxMana = stats.maxMana;
    updated.mana = Math.min(updated.mana, stats.maxMana);
    return { ok: true, hero: updated, returnedPoints, reason: `Reset Skill berhasil. ${returnedPoints} Skill Point dikembalikan.` };
  }
  const returnedPoints = refundableSkillPoints(hero);
  if (!returnedPoints) return {ok:false, hero, returnedPoints, reason:'Belum ada Skill Point yang digunakan.'};
  if (hero.gold < RESET_SKILLS_GOLD_COST) return {ok:false, hero, returnedPoints:0, reason:'GOLD tidak cukup.'};
  const skillLevels = {...hero.skillLevels}, passiveLevels = {...hero.passiveLevels};
  for (const skill of ALL_SKILLS) if (skill.id in skillLevels) skillLevels[skill.id] = rankSource(hero,'active',skill.id).granted;
  for (const passive of ALL_PASSIVES) if (passive.id in passiveLevels) passiveLevels[passive.id] = rankSource(hero,'passive',passive.id).granted;
  const updated = {...hero, skillLevels, passiveLevels, gold:hero.gold-RESET_SKILLS_GOLD_COST, skillPoints:hero.skillPoints+returnedPoints};
  updated.rankOwnership=normalizedRankOwnership(updated);
  delete updated.temporaryModifiers;delete updated.combatStateModifiers;delete updated.manualGuardActive;
  updated.statusEffects={...updated.statusEffects};delete updated.statusEffects.stealth;
  updated.activeBuffs=Object.fromEntries(Object.entries(updated.activeBuffs).filter(([id])=>!id.startsWith('v2-thief-')));
  const stats = derivedStats(updated);
  updated.hp = Math.min(updated.hp, stats.maxHP);
  updated.maxMana = stats.maxMana;
  updated.mana = Math.min(updated.mana, stats.maxMana);
  return {ok:true, hero:validateQuickHotbarAssignments(updated), returnedPoints, reason:`Reset Skill berhasil. ${returnedPoints} Skill Point dikembalikan.`};
}

/** Pet companion is managed separately; every gear slot must be empty before promotion. */
export function hasEquippedGear(hero: Pick<Hero, 'equipment'>) {
  return Object.entries(hero.equipment).some(
    ([slot, itemId]) => slot !== 'pet' && Boolean(itemId),
  );
}

function resetPromotionSkills(hero: Hero, returnedPoints: number) {
  hero.skillPoints += returnedPoints;
  hero.skillLevels = {...hero.skillLevels,...Object.fromEntries(ALL_SKILLS.map((skill) => [skill.id, 0]))};
  hero.passiveLevels = {...hero.passiveLevels,...Object.fromEntries(ALL_PASSIVES.map((passive) => [passive.id, 0]))};
  hero.rankOwnership=normalizedRankOwnership(hero);
  hero.masteryChoices = {};
  hero.primaryHotbar = hero.primaryHotbar.map(() => null);
  hero.primaryHotbarOverflow = [];
  hero.quickHotbars = emptyQuickHotbars();
}

export type SkillStatus = 'locked' | 'available' | 'learned' | 'maxed';
export function canLearnSkill(skillId: string, hero: Hero) {
  if (hero.skillArchitectureVersion === 3) {
    const definitions = hero.coreJob === 'warrior' ? { ...ADVENTURER_V3_SKILL_MAP, ...WARRIOR_V3_SKILL_MAP, ...(hero.specialization === 'berserker' ? BERSERKER_V3_SKILL_MAP : {}), ...(hero.specialization === 'blade_master' ? BLADE_MASTER_V3_SKILL_MAP : {}) } : ADVENTURER_V3_SKILL_MAP;
    const definition = definitions[skillId];
    if (!definition) return { ok: false, reason: 'Skill tidak terdaftar pada Adventurer V3.' };
    const state = hero.skillProgressionV3 ?? adventurerV3StartingState();
    const result = canPurchaseSkillRank({
      level: hero.level,
      state,
      jobs: { adventurer: { id: 'adventurer', tier: 'adventurer', parent: null }, warrior: { id: 'warrior', tier: 'core', parent: 'adventurer' }, berserker: { id: 'berserker', tier: 'specialization', parent: 'warrior' }, blade_master: { id: 'blade_master', tier: 'specialization', parent: 'warrior' } },
      skills: definitions,
    }, skillId);
    return {
      ok: result.ok,
      reason: result.ok ? '' : result.reason === 'REQUIRES_LEVEL' ? `Membutuhkan Level ${result.requiredLevel}.` : result.reason === 'INSUFFICIENT_SP' ? 'Skill Point tidak cukup.' : `Skill belum dapat dipelajari: ${result.reason}.`,
    };
  }
  const active = ALL_SKILLS.find(skill => skill.id === skillId);
  const passive = ALL_PASSIVES.find(skill => skill.id === skillId);
  const skill = active ?? passive;
  if (!skill) return {ok:false, reason:'Skill tidak terdaftar.'};
  if (skill.job && skill.job !== 'adventurer' && skill.job !== hero.coreJob) return {ok:false,reason:'Pilih Core Job yang sesuai melalui trainer.'};
  if (skill.specialization && skill.specialization !== hero.specialization) return {ok:false,reason:'Selesaikan Specialization Quest yang sesuai.'};
  if (hero.level < skill.unlockLevel) return {ok:false,reason:`Membutuhkan Level ${skill.unlockLevel}.`};
  if(!skillArchitectureAllowed(hero,skill))return {ok:false,reason:'Skill tidak tersedia pada arsitektur progression karakter ini.'};
  if(skill.investmentRequirement&&paidTreeInvestment(hero,skill.investmentRequirement.tree,[...ALL_SKILLS,...ALL_PASSIVES],skill.id)<skill.investmentRequirement.paidRanks)return {ok:false,reason:`Membutuhkan ${skill.investmentRequirement.paidRanks} paid SP pada tree ${skill.investmentRequirement.tree.id}.`};
  if (active && !activeSkills(hero).some(entry => entry.id === skillId)) return {ok:false,reason:'Skill tahap sebelumnya telah digantikan oleh skill job aktif.'};
  if (passive?.tier === 'capstone' && !hero.masteryQuestClaimed) return {ok:false,reason:'Selesaikan Mastery Quest terlebih dahulu.'};
  for (const prerequisite of skill.prerequisiteSkillIds ?? []) {
    const required = passive?.tier === 'capstone' ? 3 : 1;
    if ((hero.skillLevels[prerequisite] ?? hero.passiveLevels[prerequisite] ?? 0) < required) return {ok:false,reason:`Pelajari ${ALL_PASSIVES.find(entry=>entry.id===prerequisite)?.name ?? ALL_SKILLS.find(entry=>entry.id===prerequisite)?.name ?? prerequisite} level ${required}.`};
  }
  for (const prerequisite of ('prerequisites' in skill ? skill.prerequisites : undefined) ?? []) {
    const required = Math.max(1, prerequisite.requiredRank ?? 1);
    const current = hero.skillLevels[prerequisite.skillId] ?? hero.passiveLevels[prerequisite.skillId] ?? 0;
    if (current < required) return {ok:false,reason:`Pelajari ${ALL_PASSIVES.find(entry=>entry.id===prerequisite.skillId)?.name ?? ALL_SKILLS.find(entry=>entry.id===prerequisite.skillId)?.name ?? prerequisite.skillId} level ${required}.`};
  }
  const level = active ? hero.skillLevels[skillId] ?? 0 : hero.passiveLevels[skillId] ?? 0;
  if (level >= skill.maxLevel) return {ok:false,reason:'Skill sudah maksimal.'};
  if (hero.skillPoints < 1) return {ok:false,reason:'Skill Point tidak cukup.'};
  return {ok:true,reason:''};
}
export function getSkillStatus(skillId: string, hero: Hero): SkillStatus {
  if (hero.skillArchitectureVersion === 3) {
    const skill = activeSkills(hero).find((entry) => entry.id === skillId);
    if (!skill || hero.level < skill.unlockLevel) return 'locked';
    const level = skillLevel(hero, skill);
    return level >= skill.maxLevel ? 'maxed' : level > 0 ? 'learned' : canLearnSkill(skillId, hero).ok ? 'available' : 'locked';
  }
  const active = ALL_SKILLS.find(skill=>skill.id===skillId), passive = ALL_PASSIVES.find(skill=>skill.id===skillId);
  const skill = active ?? passive;
  if (!skill || !skillArchitectureAllowed(hero,skill) || hero.level < skill.unlockLevel || (skill.job && skill.job !== 'adventurer' && skill.job !== hero.coreJob) || (skill.specialization && skill.specialization !== hero.specialization)) return 'locked';
  const level = active ? hero.skillLevels[skillId] ?? 0 : hero.passiveLevels[skillId] ?? 0;
  return level >= skill.maxLevel ? 'maxed' : level > 0 ? 'learned' : canLearnSkill(skillId,hero).ok ? 'available' : 'locked';
}
export function allocateStatPoint(hero: Hero, stat: keyof AllocatedStats) {
  const canonicalStat = stat === 'sta' ? 'vit' : stat;
  if (!['str','vit','dex','int'].includes(canonicalStat) || hero.statPoints < 1) return {ok:false,hero,reason:'Stat Point tidak cukup.'};
  const updated = {...hero, statPoints:hero.statPoints-1, allocatedStats:{...hero.allocatedStats,[canonicalStat]:(hero.allocatedStats[canonicalStat]??0)+1}};
  const stats = derivedStats(updated);
  updated.hp = Math.min(stats.maxHP, hero.hp);
  updated.maxMana = stats.maxMana;
  return {ok:true,hero:updated,reason:`${canonicalStat === 'vit' ? 'VIT' : canonicalStat.toUpperCase()} meningkat.`};
}

export function warriorLineageSkillPointsAtLevel(level: number) {
  const value = Math.max(1, Math.min(80, Math.floor(level)));
  if (value <= 29) return value - 1;
  if (value <= 60) return 28 + (value - 29) * 2;
  return 90 + (value - 60) * 3;
}

export function gainXP(hero: Hero, amount: number) {
  hero.xp += Math.max(0, amount);
  let levels = 0;
  const cap=progressionRules(hero).contentCap;
  while (hero.level < cap && hero.xp >= xpNeeded(hero.level)) {
    hero.xp -= xpNeeded(hero.level);
    hero.level++;
    const earnedSP = hero.skillArchitectureVersion === 3
      ? warriorLineageSkillPointsAtLevel(hero.level) - warriorLineageSkillPointsAtLevel(hero.level - 1)
      : 1;
    hero.skillPoints += earnedSP;
    if (hero.skillArchitectureVersion === 3 && hero.skillProgressionV3)
      hero.skillProgressionV3 = { ...hero.skillProgressionV3, totalEarnedSP: hero.skillProgressionV3.totalEarnedSP + earnedSP };
    hero.statPoints += STAT_POINTS_PER_LEVEL;
    hero.hp = maxHP(hero);
    hero.maxMana = derivedStats(hero).maxMana;
    hero.mana = hero.maxMana;
    levels++;
  }
  if (hero.level >= cap) hero.xp = 0;
  return levels;
}

export function grantKill(hero: Hero, boss = false) {
  if (hero.pet) {
    hero.pet.exp += boss ? 80 : 15;
    while (hero.pet.exp >= hero.pet.maxExp && hero.pet.level < 50) {
      hero.pet.exp -= hero.pet.maxExp;
      hero.pet.level++;
      hero.pet.maxExp += 50;
    }
    hero.petRecords[hero.pet.id] = { ...hero.pet };
  }
  hero.kills++;
  hero.gold += boss ? 150 : 12;
  const levels = gainXP(hero, boss ? 160 : 35);
  if (boss) hero.bossDefeated = true;
  return levels;
}

export function claimQuest(hero: Hero) {
  if (hero.kills < 6 || hero.questClaimed) return false;
  hero.questClaimed = true;
  hero.gold += 80;
  gainXP(hero, 80);
  return true;
}

export function consumePotion(hero: Hero) {
  const potion = hero.inventory.find(item => item.itemType === 'potion' && item.quantity > 0);
  return !!potion && consumeInventoryItem(hero, potion.id).ok;
}

export function allocateStat(hero: Hero, stat: keyof AllocatedStats) {
  const canonicalStat = stat === 'sta' ? 'vit' : stat;
  if (!['str','vit','dex','int'].includes(canonicalStat) || hero.statPoints < 1) return false;
  hero.allocatedStats[canonicalStat] = (hero.allocatedStats[canonicalStat] ?? 0) + 1;
  hero.statPoints--;
  hero.hp = Math.min(maxHP(hero), hero.hp);
  return true;
}

export function applyStatPreview(hero: Hero, preview: AllocatedStats) {
  if (
    Object.entries(preview).some(
      ([key, value]) =>
        !Number.isFinite(value) ||
        value < (hero.allocatedStats[key as keyof AllocatedStats] ?? 0),
    )
  )
    return false;
  const next = {
    str: Math.max(0, Math.floor(preview.str)),
    vit: Math.max(0, Math.floor(preview.vit ?? preview.sta ?? 0)),
    dex: Math.max(0, Math.floor(preview.dex)),
    int: Math.max(0, Math.floor(preview.int)),
  };
  const spentBefore = Object.values(hero.allocatedStats).reduce(
    (sum, value) => sum + value,
    0,
  );
  const spentAfter = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (spentAfter - spentBefore > hero.statPoints) return false;
  hero.statPoints -= spentAfter - spentBefore;
  hero.allocatedStats = next;
  hero.hp = Math.min(maxHP(hero), hero.hp);
  hero.maxMana = derivedStats(hero).maxMana;hero.mana=Math.min(hero.mana,hero.maxMana);
  return true;
}

export const RESET_STATS_GOLD_COST=500;
/** Earned points follow actual levels; content caps belong to progression, not stat math. */
export const calculateTotalStatPoints=(level:number,_architecture:ProgressionArchitecture='legacy')=>Math.max(0,Math.floor(level)-1)*STAT_POINTS_PER_LEVEL;
export function resetCharacterStats(hero: Hero) {
  const spent = Object.values(hero.allocatedStats).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (!spent) return {ok:false,reason:'Belum ada stat yang dialokasikan.',hero,returnedPoints:0,cost:RESET_STATS_GOLD_COST};
  if (hero.gold < RESET_STATS_GOLD_COST) return {ok:false,reason:'GOLD tidak cukup.',hero,returnedPoints:0,cost:RESET_STATS_GOLD_COST};
  const updated:Hero={...hero,gold:hero.gold-RESET_STATS_GOLD_COST,statPoints:calculateTotalStatPoints(hero.level,hero.progressionArchitecture),allocatedStats:{str:0,vit:0,dex:0,int:0},inventory:hero.inventory.map(item=>({...item,affixes:item.affixes.map(affix=>({...affix})),sockets:item.sockets.map(socket=>({...socket,rune:socket.rune?{...socket.rune,affixes:socket.rune.affixes.map(affix=>({...affix}))}:null}))})),equipment:{...hero.equipment},pet:hero.pet?{...hero.pet,bonusStats:{...hero.pet.bonusStats}}:null};
  const nextStats=derivedStats(updated);updated.hp=Math.min(updated.hp,nextStats.maxHP);updated.maxMana=nextStats.maxMana;updated.mana=Math.min(updated.mana,updated.maxMana);
  return {ok:true,reason:`Reset Stats berhasil. ${spent} point dikembalikan dengan biaya ${RESET_STATS_GOLD_COST} GOLD.`,hero:updated,returnedPoints:spent,cost:RESET_STATS_GOLD_COST};
}

/** @deprecated Gunakan resetCharacterStats agar update state tetap immutable. */
export const respecStats=resetCharacterStats;

export function upgradeWeapon(hero: Hero) {
  const id = hero.equipment.mainHand;
  return id ? enhanceItem(hero, id).ok : false;
}

export function buyPotion(hero: Hero) {
  const price=ITEM_CATALOG['health-potion-1'].buyValue;
  if (hero.gold < price) return false;
  const result = addItemToInventory(
    hero.inventory,
    createItem('health-potion-1'),
    hero.inventoryCapacity,
  );
  if (result.remaining) return false;
  hero.inventory = result.inventory;
  hero.gold -= price;
  hero.potions++;
  return true;
}

export function grantLoot(
  hero: Hero,
  boss = false,
  roll = Math.random(),
  lootTable: string[] = [],
  variant: 'normal'|'elite'|'boss' = boss?'boss':'normal',
  rng:()=>number = Math.random,
): InventoryItem {
  // Keep the existing guaranteed reward API; combat uses grantMonsterLoot for chance checks.
  const item = rollMonsterItem(hero.currentField,variant,hero.specialization,hero.currentField,rng,roll);
  // Stale legacy lootTable IDs must never recreate retired materials.
  void lootTable;
  if(item.category==='material'&&rng()<derivedStats(hero).materialDropRate/100)item.quantity++;
  return storeLootReward(hero,item);
}

function storeLootReward(hero:Hero,item:ItemData):InventoryItem {
  const result = addItemToInventory(
    hero.inventory,
    item,
    hero.inventoryCapacity,
  );
  hero.inventory = result.inventory;
  if (result.remaining)
    hero.pendingLoot.push({ ...item, quantity: result.remaining });
  return result.remaining === 0
    ? item
    : {
        ...item,
        description: `${item.description} Inventory penuh; item belum masuk.`,
      };
}

export function grantMonsterLoot(hero:Hero,monster:MonsterDefinition,rng:()=>number=Math.random):InventoryItem|null {
  const item = rollMonsterLoot(hero, monster, rng);
  return item ? storeLootReward(hero, item) : null;
}

export function rollMonsterLoot(hero:Hero,monster:MonsterDefinition,rng:()=>number=Math.random):ItemData|null {
  const stats=derivedStats(hero);
  if(rng()>=monsterDropChance(monster,stats.itemDropRate))return null;
  const item=rollMonsterItem(hero.currentField,monster.variant,hero.specialization,monster.id,rng);
  if(item.category==='material'&&rng()<stats.materialDropRate/100)item.quantity++;
  return item;
}

export function rollMonsterLootDrops(hero:Hero,monster:MonsterDefinition,rng:()=>number=Math.random):ItemData[] {
  const primary = rollMonsterLoot(hero, monster, rng);
  if (!primary) return [];
  const drops = [primary];
  const material = () => {
    const item = rollMonsterItem(hero.currentField, monster.variant, hero.specialization, monster.id, rng, 0.01);
    if (item.category === 'material' && rng() < derivedStats(hero).materialDropRate / 100) item.quantity++;
    return item;
  };
  if (monster.variant === 'elite' && rng() < 0.65) drops.push(material());
  if (monster.variant === 'boss') {
    drops.push(material());
    if (rng() < 0.8) drops.push(rollMonsterItem(hero.currentField, monster.variant, hero.specialization, monster.id, rng));
  }
  return drops;
}

export function collectPendingLoot(hero: Hero) {
  const pending: ItemData[] = [];
  let collected = 0;
  for (const item of hero.pendingLoot) {
    const result = addItemToInventory(
      hero.inventory,
      item,
      hero.inventoryCapacity,
    );
    hero.inventory = result.inventory;
    collected += result.added;
    if (result.remaining) pending.push({ ...item, quantity: result.remaining });
  }
  hero.pendingLoot = pending;
  return collected;
}

const equipmentContains = (hero: Hero, itemId: string) =>
  Object.values(hero.equipment).some((equippedId) => equippedId === itemId);

export function equipItem(hero: Hero, itemId: string, targetSlot?: EquipSlot) {
  const item = itemById(hero.inventory, itemId);
  if (!item) return { ok: false, reason: 'Item tidak ditemukan.' };
  const requestedSlot=targetSlot??item.equipSlot;
  if (requestedSlot === 'mainHand' || requestedSlot === 'offHand') {
    const currentMain = itemById(hero.inventory, hero.equipment.mainHand);
    const currentOff = itemById(hero.inventory, hero.equipment.offHand);
    // Legacy/V2 keeps its existing dual-weapon compatibility. The new strict
    // capability gate applies only to the V3 equipment path.
    const earlyDualCheck = validateDualWieldEquip(hero.skillArchitectureVersion === 3 ? { ...hero, canDualWieldOneHandSwords: dualWieldCapabilityForHero(hero) } : { canDualWieldOneHandSwords: true }, currentMain, currentOff, item, requestedSlot);
    if (!earlyDualCheck.ok) {
      const earlyMessages: Record<DualWieldEquipReason, string> = {
        DUAL_WIELD_CAPABILITY_REQUIRED: 'Dual Wield belum terbuka untuk karakter ini.',
        TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON: 'Senjata dua tangan tidak dapat dipasang bersama senjata Off Hand.',
        OFFHAND_WEAPON_REQUIRES_ONE_HAND_SWORD: 'Off Hand Sword membutuhkan Main Hand One-Hand Sword.',
        SHIELD_CONFLICT_WITH_OFFHAND_WEAPON: 'Shield dan Off Hand Sword tidak dapat dipakai bersamaan.',
      };
      return { ok: false, reason: earlyDualCheck.reason, message: earlyMessages[earlyDualCheck.reason], code: earlyDualCheck.reason };
    }
  }
  const check = canEquipItem(item, hero, requestedSlot);
  if (!check.ok) return check;
  if (item.category === 'pet') {
    if (hero.pet) hero.petRecords[hero.pet.id] = { ...hero.pet };
    hero.equipment.pet = item.id;
    hero.pet = hero.petRecords[item.id] ?? {
      id: item.id,
      level: hero.pet?.id === item.id ? hero.pet.level : 1,
      exp: hero.pet?.id === item.id ? hero.pet.exp : 0,
      maxExp: hero.pet?.id === item.id ? hero.pet.maxExp : 100,
      rarity: item.rarity,
      passive: item.petPassive ?? 'Tidak ada passive.',
      bonusStats: {},
    };
    hero.inventory = hero.inventory.map(entry => ({
      ...entry,
      isEquipped: entry.id === item.id || Object.values(hero.equipment).includes(entry.id),
    }));
    return { ok: true, reason: 'Pet dipasang.' };
  }
  const slot = requestedSlot as EquipSlot;
  const main = itemById(hero.inventory, hero.equipment.mainHand);
  const off = itemById(hero.inventory, hero.equipment.offHand);
  const dualCheck = (slot === 'mainHand' || slot === 'offHand') && (item.equipmentType === 'one_hand_sword' || item.twoHanded || item.handedness === 'two_hand' || item.equipmentType === 'shield')
    ? validateDualWieldEquip(hero.skillArchitectureVersion === 3 ? { ...hero, canDualWieldOneHandSwords: dualWieldCapabilityForHero(hero) } : { canDualWieldOneHandSwords: true }, main, off, item, slot)
    : { ok: true as const, reason: null };
  if (!dualCheck.ok) {
    const messages: Record<DualWieldEquipReason, string> = {
      DUAL_WIELD_CAPABILITY_REQUIRED: 'Dual Wield belum terbuka untuk karakter ini.',
      TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON: 'Senjata dua tangan tidak dapat dipasang bersama senjata Off Hand.',
      OFFHAND_WEAPON_REQUIRES_ONE_HAND_SWORD: 'Off Hand Sword membutuhkan Main Hand One-Hand Sword.',
      SHIELD_CONFLICT_WITH_OFFHAND_WEAPON: 'Shield dan Off Hand Sword tidak dapat dipakai bersamaan.',
    };
    return { ok: false, reason: dualCheck.reason, message: messages[dualCheck.reason], code: dualCheck.reason };
  }
  if (slot === 'offHand') {
    const compatibility=validateOffHandCompatibility(main,item);
    if(!compatibility.ok)return compatibility;
  }
  if(slot==='mainHand'&&hero.equipment.offHand&&hero.equipment.offHand!==item.id&&item.handedness!=='two_hand'&&!item.twoHanded){
    const currentOffHand=itemById(hero.inventory,hero.equipment.offHand);
    if(currentOffHand){const compatibility=validateOffHandCompatibility(item,currentOffHand);if(!compatibility.ok)return compatibility;}
  }
  for (const occupied of Object.keys(hero.equipment) as EquipSlot[]) {
    if (hero.equipment[occupied] === item.id) hero.equipment[occupied] = null;
  }
  if (slot === 'ring1' || slot === 'ring2') {
    const ringSlot:EquipSlot = targetSlot ? slot : hero.equipment.ring1
      ? hero.equipment.ring2
        ? slot
        : 'ring2'
      : 'ring1';
    hero.equipment[ringSlot] = item.id;
  } else if (slot === 'earring1' || slot === 'earring2') {
    const earringSlot:EquipSlot = targetSlot ? slot : hero.equipment.earring1 ? hero.equipment.earring2 ? slot : 'earring2' : 'earring1';
    hero.equipment[earringSlot]=item.id;
  } else {
    if (item.handedness==='two_hand'||item.twoHanded) {
      const offHand=itemById(hero.inventory,hero.equipment.offHand);
      if(!offHand||offHand.equipmentType!=='quiver'||item.equipmentType!=='bow')hero.equipment.offHand=null;
    }
    if (item.mainHand && item.offHand) {
      hero.equipment.mainHand = item.id;
      hero.equipment.offHand = item.id;
    } else {
      hero.equipment[slot] = item.id;
    }
  }
  // Keep one item instance while making its ownership location explicit to UI
  // and inventory-capacity logic. The existing equipment ID schema remains
  // intact for combat, Rune, enhancement, and legacy saves.
  const equippedIds = new Set(Object.values(hero.equipment).filter((id): id is string => Boolean(id)));
  hero.inventory = hero.inventory.map(entry => ({ ...entry, isEquipped: equippedIds.has(entry.id) }));
  hero.hp = Math.min(hero.hp, maxHP(hero));
  hero.maxMana = derivedStats(hero).maxMana;
  hero.mana = Math.min(hero.mana, hero.maxMana);
  return { ok: true, reason: `${item.name} dipasang${slot==='mainHand'&&(item.handedness==='two_hand'||item.twoHanded)?' sebagai senjata dua tangan':''}.` };
}

export function unequipItem(hero: Hero, slot: EquipSlot) {
  const itemId = hero.equipment[slot];
  if (!itemId) return { ok: false, reason: 'Slot sudah kosong.' };
  if (slot === 'mainHand' && hero.equipment.offHand === itemId)
    hero.equipment.offHand = null;
  if (slot === 'offHand' && hero.equipment.mainHand === itemId)
    hero.equipment.mainHand = null;
  hero.equipment[slot] = null;
  if (slot === 'pet') {
    if (hero.pet) hero.petRecords[hero.pet.id] = { ...hero.pet };
    hero.pet = null;
  }
  hero.inventory = hero.inventory.map(entry => ({
    ...entry,
    isEquipped: Object.values(hero.equipment).includes(entry.id),
  }));
  hero.hp = Math.min(hero.hp, maxHP(hero));
  hero.maxMana = derivedStats(hero).maxMana;
  hero.mana = Math.min(hero.mana, hero.maxMana);
  return { ok: true, reason: 'Equipment dilepas.' };
}

export type RuneForgeRequest = {equipmentId:string;socketIndex:number;optimizerItemId:string;stabilize:boolean};
export type RuneForgePending = {id:string;equipmentId:string;socketIndex:number;runeId:string;beforeSignature:string;candidate:SocketedRune;goldCost:number;optimizerName:string;stabilized:boolean;npcId:string};

function updateRuneVitals(hero:Hero){
 hero.hp=Math.min(hero.hp,maxHP(hero));hero.maxMana=derivedStats(hero).maxMana;hero.mana=Math.min(hero.mana,hero.maxMana);
}
const runeSignature=(rune:SocketedRune)=>JSON.stringify(rune);
export function socketRune(hero:Hero,equipmentId:string,runeId:string,socketIndex:number,npcId:string|null=null){
 const access=forgeAccessReason(hero,npcId);if(access)return {ok:false,reason:access};
 if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup.'};
 if(hero.runeForgePending)return {ok:false,reason:'Selesaikan hasil Rune sebelumnya.'};
 const equipment=itemById(hero.inventory,equipmentId),rune=itemById(hero.inventory,runeId),socket=equipment?.sockets[socketIndex];
 if(!equipment||!['weapon','armor','accessory'].includes(equipment.category))return {ok:false,reason:'Equipment tidak ditemukan.'};
 if(equipment.isLocked||rune?.isLocked)return {ok:false,reason:'Item sedang terkunci.'};
 if(!socket||socket.rune)return {ok:false,reason:'Pilih socket kosong.'};
 if(!rune||rune.itemType!=='socketRune'||!rune.runeRarity||!rune.runeTheme||rune.quantity!==1)return {ok:false,reason:'Pilih Rune socket yang valid.'};
 if(hero.inventory.some(item=>item.sockets.some(entry=>entry.rune?.id===rune.id)))return {ok:false,reason:'Rune ini sudah berada pada equipment.'};
 if(rune.runeJobRequirement&&rune.runeJobRequirement!==hero.coreJob)return {ok:false,reason:'Rune ini hanya dapat digunakan oleh job tertentu.'};
 const socketed:SocketedRune={...structuredClone(rune),runeRarity:rune.runeRarity,runeTheme:rune.runeTheme,sourceLabel:rune.runeSource??rune.source.label};
 hero.inventory=hero.inventory.filter(item=>item.id!==rune.id).map(item=>item.id===equipmentId?{...item,sockets:item.sockets.map((entry,index)=>index===socketIndex?{...entry,rune:socketed}:entry)}:item);
 updateRuneVitals(hero);
 return {ok:true,reason:rune.name+' dipasang pada '+equipment.name+'.'};
}
export function removeSocketedRune(hero:Hero,equipmentId:string,socketIndex:number,npcId:string|null=null){
 const access=forgeAccessReason(hero,npcId);if(access)return {ok:false,reason:access};
 if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup.'};
 if(hero.runeForgePending)return {ok:false,reason:'Selesaikan hasil Rune sebelumnya.'};
 const equipment=itemById(hero.inventory,equipmentId),stored=equipment?.sockets[socketIndex]?.rune;
 if(!equipment||!stored)return {ok:false,reason:'Socket tidak berisi Rune.'};
 if(equipment.isLocked||stored.isLocked)return {ok:false,reason:'Item sedang terkunci.'};
 if(hero.gold<RUNE_REMOVAL_GOLD_COST)return {ok:false,reason:'Membutuhkan '+RUNE_REMOVAL_GOLD_COST+' GOLD.'};
 if(hero.inventory.some(item=>item.id===stored.id))return {ok:false,reason:'Identitas Rune sudah ada di Inventory.'};
 const added=addItemToInventory(hero.inventory,structuredClone(stored),hero.inventoryCapacity);
 if(added.remaining)return {ok:false,reason:'Inventory penuh. Kosongkan satu slot sebelum melepas Rune.'};
 hero.inventory=added.inventory.map(item=>item.id===equipmentId?{...item,sockets:item.sockets.map((entry,index)=>index===socketIndex?{...entry,rune:null}:entry)}:item);
 hero.gold-=RUNE_REMOVAL_GOLD_COST;updateRuneVitals(hero);
 return {ok:true,reason:stored.name+' dilepas dengan biaya '+RUNE_REMOVAL_GOLD_COST+' GOLD.'};
}

/** Actual distribution over all seven qualities, including boundary/stabilizer clamping. */
export function runeReforgeDistribution(current:RuneRarity,tier:RuneOptimizerTier,stabilize=false,fixed=false){
 const at=RUNE_QUALITY_ORDER.indexOf(current);
 const result=Object.fromEntries(RUNE_QUALITY_ORDER.map(q=>[q,0])) as Record<RuneRarity,number>;
 if(tier==='basic'||fixed){result[current]=1;return result;}
 const weights=RUNE_REFORGE_WEIGHTS[tier];result[current]=weights.same/100;
 for(const [direction,weight] of [[-1,weights.downgrade],[1,weights.upgrade]] as const){
  const indices=RUNE_QUALITY_ORDER.map((_,i)=>i).filter(i=>direction===1?i>at:i<at);
  if(!indices.length||(stabilize&&direction===-1)){result[current]+=weight/100;continue;}
  const sum=indices.reduce((total,i)=>total+Math.pow(RUNE_REFORGE_STEP_WEIGHT,Math.abs(i-at)-1),0);
  for(const i of indices)result[RUNE_QUALITY_ORDER[i]]+=weight/100*Math.pow(RUNE_REFORGE_STEP_WEIGHT,Math.abs(i-at)-1)/sum;
 }
 return result;
}
export function runeForgeReason(hero:Hero,request:RuneForgeRequest,npcId:string|null){
 const access=forgeAccessReason(hero,npcId);if(access)return access;
 if(hero.hp<=0)return 'Karakter harus hidup.';
 if(hero.runeForgePending)return 'Selesaikan hasil Rune sebelumnya.';
 const equipment=itemById(hero.inventory,request.equipmentId),rune=equipment?.sockets[request.socketIndex]?.rune;
 if(!equipment||!['weapon','armor','accessory'].includes(equipment.category))return 'Equipment tidak ditemukan.';
 if(!rune)return 'Equipment ini harus memiliki Rune terpasang sebelum dapat menggunakan Rune Optimizer.';
 if(equipment.isLocked||rune.isLocked)return 'Item sedang terkunci.';
 if(!rune.runeTheme||!rune.runeRarity||!RUNE_THEME_POOLS[rune.runeTheme]||!RUNE_RARITY_RULES[rune.runeRarity])return 'Data Rune tidak valid. Rune tetap dimiliki; tema atau quality perlu diperbaiki.';
 if(rune.runeJobRequirement&&rune.runeJobRequirement!==hero.coreJob)return 'Rune ini hanya dapat digunakan oleh job tertentu.';
 const optimizer=itemById(hero.inventory,request.optimizerItemId);
 if(!optimizer||optimizer.itemType!=='runeOptimizer'||!optimizer.optimizerTier||!RUNE_OPTIMIZER_TIER_RULES[optimizer.optimizerTier]||optimizer.quantity<1)return 'Rune Optimizer tidak tersedia.';
 if(optimizer.isLocked)return 'Rune Optimizer sedang terkunci. Buka kunci item tersebut terlebih dahulu.';
 if(ITEM_CATALOG[optimizer.templateId]?.optimizerTier!==optimizer.optimizerTier)return 'Rune Optimizer tidak terdaftar.';
 if(!rune.affixes.length||rune.affixes.length>RUNE_THEME_POOLS[rune.runeTheme].length)return 'Jumlah affix Rune tidak valid.';
 if(request.stabilize&&optimizer.optimizerTier==='basic')return 'Rune Stabilizer hanya untuk Chromatic.';
 if(request.stabilize&&!hero.inventory.some(item=>item.templateId==='rune-stabilizer'&&!item.isLocked&&item.quantity>0))return 'Membutuhkan 1 Rune Stabilizer.';
 if(hero.gold<RUNE_OPTIMIZER_TIER_RULES[optimizer.optimizerTier].goldCost)return 'GOLD tidak cukup.';
 return '';
}
/** Costs committed before a candidate becomes visible; only one pending receipt exists per hero. */
export function beginRuneForge(hero:Hero,request:RuneForgeRequest,npcId:string|null,rng:()=>number=Math.random){
 const reason=runeForgeReason(hero,request,npcId);if(reason)return {ok:false,reason};
 const equipment=itemById(hero.inventory,request.equipmentId)!,rune=equipment.sockets[request.socketIndex].rune!,optimizer=itemById(hero.inventory,request.optimizerItemId)!;
 const tier=optimizer.optimizerTier!,rule=RUNE_OPTIMIZER_TIER_RULES[tier];
 const distribution=runeReforgeDistribution(rune.runeRarity!,tier,request.stabilize,Boolean(rune.runeQualityFixed||ITEM_CATALOG[rune.templateId]?.runeQualityFixed));
 let cursor=Math.max(0,Math.min(.999999999,rng())),quality=rune.runeRarity!;
 for(const q of RUNE_QUALITY_ORDER){cursor-=distribution[q];if(cursor<0){quality=q;break;}}
 const candidate:SocketedRune={...structuredClone(rune),runeRarity:quality,
   rarity:({cracked:'common',simple:'uncommon',refined:'uncommon',rare:'rare',epic:'epic',legendary:'legendary',ancient:'mythic'} as const)[quality],
   affixes:rollRuneAffixes(rune.runeTheme!,quality,rng,tier==='basic'?rune.affixes.length:undefined),
   optimizerHistory:{rerollCount:(rune.optimizerHistory?.rerollCount??0)+1,lastOptimizerAt:Date.now()}};
 let inventory=removeItemQuantity(hero.inventory,optimizer.id,1).inventory;
 if(request.stabilize){const stabilizer=inventory.find(item=>item.templateId==='rune-stabilizer'&&!item.isLocked&&item.quantity>0)!;inventory=removeItemQuantity(inventory,stabilizer.id,1).inventory;}
 hero.inventory=inventory;hero.gold-=rule.goldCost;
 hero.runeForgePending={id:crypto.randomUUID(),equipmentId:equipment.id,socketIndex:request.socketIndex,runeId:rune.id,beforeSignature:runeSignature(rune),candidate,goldCost:rule.goldCost,optimizerName:optimizer.name,stabilized:request.stabilize,npcId:npcId!};
 return {ok:true,reason:'Roll selesai. Item dan GOLD sudah terpakai.'};
}
export function resolveRuneForge(hero:Hero,receiptId:string,accept:boolean,npcId:string|null){
 const access=forgeAccessReason(hero,npcId);if(access)return {ok:false,reason:access};
 if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup.'};
 const pending=hero.runeForgePending;
 if(!pending||pending.id!==receiptId||pending.npcId!==npcId)return {ok:false,reason:'Hasil Rune tidak tersedia.'};
 const equipment=itemById(hero.inventory,pending.equipmentId),rune=equipment?.sockets[pending.socketIndex]?.rune;
 if(accept&&(!rune||rune.id!==pending.runeId||runeSignature(rune)!==pending.beforeSignature||equipment?.isLocked||rune.isLocked))return {ok:false,reason:'Rune atau equipment berubah. Pertahankan hasil lama.'};
 if(accept)hero.inventory=hero.inventory.map(item=>item.id===pending.equipmentId?{...item,sockets:item.sockets.map((socket,index)=>index===pending.socketIndex?{...socket,rune:structuredClone(pending.candidate)}:socket)}:item);
 hero.runeForgePending=null;updateRuneVitals(hero);
 return {ok:true,reason:accept?'Rune baru diterapkan.':'Rune lama dipertahankan. Biaya roll sudah terpakai.'};
}
export const RUNE_OPTIMIZER_CRAFT_RECIPES = [
 {templateId:'rune-optimizer-basic',materialId:'iron',materialRequired:3,goldCost:150},
 {templateId:'rune-stabilizer',materialId:'titanium',materialRequired:3,goldCost:400},
 {templateId:'rune-optimizer-chromatic',materialId:'vibranium',materialRequired:2,goldCost:900},
 {templateId:'rune-optimizer-greater-chromatic',materialId:'meteorite-core',materialRequired:1,goldCost:2000},
 {templateId:'rune-optimizer-perfect-chromatic',materialId:'meteorite-core',materialRequired:3,goldCost:4500},
] as const;
export function craftRuneOptimizer(hero:Hero,templateId:string,npcId:string|null=null){
 const access=forgeAccessReason(hero,npcId);if(access)return {ok:false,reason:access};
 if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup.'};
 const recipe=RUNE_OPTIMIZER_CRAFT_RECIPES.find(entry=>entry.templateId===templateId);
 if(!recipe)return {ok:false,reason:'Resep tidak ditemukan.'};
 if(hero.gold<recipe.goldCost)return {ok:false,reason:'GOLD tidak cukup.'};
 const materials=hero.inventory.filter(item=>item.templateId===recipe.materialId&&!item.isLocked);
 if(materials.reduce((sum,item)=>sum+item.quantity,0)<recipe.materialRequired)return {ok:false,reason:'Material tidak cukup atau sedang terkunci.'};
 let inventory=hero.inventory,remaining:number=recipe.materialRequired;
 for(const item of materials){const removed=removeItemQuantity(inventory,item.id,remaining);inventory=removed.inventory;remaining-=removed.removed;if(!remaining)break;}
 const created=createItem(recipe.templateId,{source:{type:'shop',sourceId:npcId,label:'Crafting Forge Master'}});
 const added=addItemToInventory(inventory,created,hero.inventoryCapacity);
 if(added.remaining)return {ok:false,reason:'Inventory penuh.'};
 hero.inventory=added.inventory;hero.gold-=recipe.goldCost;
 return {ok:true,reason:created.name+' berhasil dibuat.'};
}

export function consumeInventoryItem(hero: Hero, itemId: string, now=Date.now()) {
  const item = itemById(hero.inventory, itemId);
  if (!item || item.quantity<1) return { ok: false, reason: 'Item habis atau tidak ditemukan.' };
  if (item.category === 'pet') return equipItem(hero, item.id);
  if(item.isLocked)return {ok:false,reason:'Item sedang terkunci.'};
  if(hero.hp<=0)return {ok:false,reason:'Karakter harus hidup untuk menggunakan item.'};
  if(hero.level<item.levelRequirement)return {ok:false,reason:`Membutuhkan Level ${item.levelRequirement}.`};
  if((item.requiredCoreJob&&item.requiredCoreJob!==hero.coreJob)||(item.requiredSpecialJob&&item.requiredSpecialJob!==hero.specialization))return {ok:false,reason:'Item tidak sesuai job.'};
  const effect=item.useEffect ?? ITEM_CATALOG[item.templateId]?.useEffect ?? (item.itemType==='potion'?{type:'heal' as const,amount:65}:null);
  if(!effect)return {ok:false,reason:'Item ini tidak dapat digunakan langsung.'};
  if(effect.type==='stamina'&&!isResourceEnabled(hero, 'stamina'))return {ok:false,reason:'Sistem stamina sedang dinonaktifkan. Item tidak terpakai.'};
  const remaining=getItemCooldownRemaining(hero.itemCooldowns,item,now);
  if(remaining>0)return {ok:false,reason:`${item.name} masih cooldown ${Math.ceil(remaining)} dtk.`};
  const stats=derivedStats(hero);
  const amount=item.potionType ? potionRestoreAmount(item,item.potionType==='health'?stats.maxHP:stats.maxMana) : Math.max(0,Number.isFinite(effect.amount)?effect.amount!:0);
  let reason=`${item.name} digunakan.`;
  if(effect.type==='heal') {
    if(hero.hp>=stats.maxHP)return {ok:false,reason:'HP sudah penuh.'};
    hero.hp=Math.min(stats.maxHP,hero.hp+amount);reason=item.potionType?'Health Potion digunakan.':`${item.name}: HP dipulihkan +${amount}.`;
  } else if(effect.type==='mana'||effect.type==='resource') {
    if(hero.mana>=stats.maxMana)return {ok:false,reason:'Mana sudah penuh.'};
    restoreMana(hero,amount);reason=item.potionType?'Mana Potion digunakan.':`${item.name}: Mana dipulihkan +${amount}.`;
  } else if(effect.type==='stamina') {
    if(hero.stamina>=stats.staminaMax)return {ok:false,reason:'Stamina masih penuh.'};
    hero.stamina=Math.min(stats.staminaMax,hero.stamina+(amount||stats.staminaMax));
  } else if(effect.type==='buff'&&effect.buffId&&effect.duration&&effect.duration>0) {
    hero.activeBuffs={...hero.activeBuffs,[effect.buffId]:Math.min(3600,effect.duration)};
  } else if(effect.type==='ammunition') {
    const weapon=itemById(hero.inventory,hero.equipment.mainHand);
    if(weapon?.equipmentType!=='bow')return {ok:false,reason:'Amunisi ini membutuhkan Bow.'};
    hero.selectedAmmo=item.templateId;
    return {ok:true,reason:`${item.name} dipilih. Anak panah berkurang saat Bow menyerang.`};
  } else return {ok:false,reason:effect.type==='mount'?'Sistem mount belum tersedia pada project ini.':'Efek item belum didukung.'};
  hero.inventory=removeItemQuantity(hero.inventory,item.id,1).inventory;
  hero.potions=hero.inventory.filter(entry=>entry.itemType==='potion').reduce((sum,entry)=>sum+entry.quantity,0);
  hero.itemCooldowns={...hero.itemCooldowns,[itemCooldownKey(item)]:now+(item.useCooldown??0)*1000};
  return {ok:true,reason};
}

export function discardItem(hero: Hero, itemId: string, quantity = 1) {
  const item = itemById(hero.inventory, itemId);
  if (!item) return { ok: false, reason: 'Item tidak ditemukan.' };
  if (item.isQuestItem)
    return { ok: false, reason: 'Quest Item tidak dapat dibuang.' };
  if (equipmentContains(hero, item.id))
    return { ok: false, reason: 'Lepas equipment terlebih dahulu.' };
  const result = removeItemQuantity(hero.inventory, item.id, quantity);
  hero.inventory = result.inventory;
  if (item.itemType === 'potion')
    hero.potions = Math.max(0, hero.potions - result.removed);
  return result.removed > 0
    ? { ok: true, reason: `${item.name} dibuang.` }
    : { ok: false, reason: 'Tidak ada quantity yang bisa dibuang.' };
}

export type EnhancementPreview = {
  baseChance: number;
  runeBonus: number;
  finalChance: number;
  protectedBySeal: boolean;
  hasSeal: boolean;
  hasFateRune: boolean;
  usingSeal: boolean;
  usingFateRune: boolean;
  materialId: string;
  materialRequired: number;
  materialOwned: number;
  blockedReason: string;
  risk: string;
};

export const isEnhanceableEquipment = (
  item: Pick<ItemData, 'equipSlot' | 'category' | 'maxEnhancementLevel'>,
) => Boolean(item.equipSlot) && ['weapon', 'armor', 'accessory'].includes(item.category) && item.maxEnhancementLevel > 0;

const ENHANCEMENT_CHANCES: Readonly<Record<number, number>> = {
  1: 1, 2: 1, 3: 1, 4: 0.7, 5: 0.6, 6: 0.5,
  7: 0.4, 8: 0.36, 9: 0.32, 10: 0.25, 11: 0.2, 12: 0.15,
};

export function enhancementPreview(
  hero: Hero,
  itemId: string,
  useSeal = hero.enhancementSealEnabled !== false,
  useFateRune = false,
): EnhancementPreview | null {
  const item = itemById(hero.inventory, itemId);
  if (
    !item ||
    !isEnhanceableEquipment(item) ||
    item.enhancementLevel >= item.maxEnhancementLevel
  )
    return null;
  const targetLevel = item.enhancementLevel + 1;
  const baseChance = ENHANCEMENT_CHANCES[targetLevel] ?? 0.15;
  const hasFateRune = hero.inventory.some(
    (candidate) => candidate.itemType === 'fateRune' && candidate.quantity > 0 && !candidate.isLocked,
  );
  const hasSeal = hero.inventory.some(
    (candidate) =>
      candidate.itemType === 'eternalSeal' && candidate.quantity > 0 && !candidate.isLocked,
  );
  const runeBonus = hasFateRune && useFateRune ? 0.08 : 0;
  const protectedBySeal = hasSeal && useSeal;
  const materialId = item.enhancementLevel < 3 ? 'iron' : item.enhancementLevel < 6 ? 'titanium' : item.enhancementLevel < 9 ? 'vibranium' : 'meteorite-core';
  const materialRequired = 1 + Math.floor(item.enhancementLevel / 3);
  const materialOwned = hero.inventory
    .filter(m => m.templateId === materialId && !m.isLocked)
    .reduce((n, m) => n + Math.max(0, m.quantity), 0);
  const blockedReason = item.isLocked
    ? 'Equipment terkunci. Buka kunci sebelum menempa.'
    : useFateRune && !hasFateRune
      ? 'Tidak ada Fate Rune di inventory untuk dipakai.'
      : materialOwned < materialRequired
        ? `Membutuhkan ${materialRequired} ${ITEM_CATALOG[materialId].name} (tersedia ${materialOwned}).`
        : '';
  return {
    baseChance,
    runeBonus,
    finalChance: Math.min(1, baseChance + runeBonus),
    protectedBySeal,
    hasSeal,
    hasFateRune,
    usingSeal: useSeal,
    usingFateRune: useFateRune && hasFateRune,
    materialId,
    materialRequired,
    materialOwned,
    blockedReason,
    risk: protectedBySeal
      ? 'Gagal: level tetap dan Eternal Seal terpakai.'
      : targetLevel === 7
        ? 'Gagal: level kembali ke +3.'
        : targetLevel === 8
          ? 'Gagal: level kembali ke +2.'
          : targetLevel >= 9
            ? 'Gagal: equipment dapat hancur.'
            : 'Gagal: level enhancement tetap.',
  };
}

export function enhanceItem(
  hero: Hero,
  itemId: string,
  roll = Math.random(),
  expectedLevel?: number,
  useSeal = hero.enhancementSealEnabled !== false,
  useFateRune = false,
) {
  const preview = enhancementPreview(hero, itemId, useSeal, useFateRune);
  const item = itemById(hero.inventory, itemId);
  if (!preview || !item)
    return { ok: false, attempted: false, reason: 'Item tidak dapat di-enhance atau sudah mencapai batas maksimal.', preview };
  if (expectedLevel !== undefined && item.enhancementLevel !== expectedLevel)
    return { ok: false, attempted: false, reason: 'Equipment telah berubah. Periksa preview dan konfirmasi ulang.', preview };
  if (preview.blockedReason)
    return { ok: false, attempted: false, reason: preview.blockedReason, preview };
  // Stage all inventory updates before committing. No stale item object survives
  // removeItemQuantity(), which returns a new inventory with copied item records.
  let inventory = hero.inventory;
  const materials = inventory.filter(m => m.templateId === preview.materialId && m.quantity > 0 && !m.isLocked);
  let needed = preview.materialRequired;
  for (const material of materials) {
    const result = removeItemQuantity(inventory, material.id, needed);
    inventory = result.inventory;
    needed -= result.removed;
    if (!needed) break;
  }
  const rune = useFateRune ? inventory.find(m => m.itemType === 'fateRune' && m.quantity > 0 && !m.isLocked) : undefined;
  if (rune && preview.runeBonus) inventory = removeItemQuantity(inventory, rune.id, 1).inventory;
  const ok = roll < preview.finalChance;
  const seal = useSeal ? inventory.find(m => m.itemType === 'eternalSeal' && m.quantity > 0 && !m.isLocked) : undefined;
  const targetLevel = item.enhancementLevel + 1;
  const destroyed = !ok && !seal && targetLevel >= 9;
  const fallbackLevel = targetLevel === 7 ? 3 : targetLevel === 8 ? 2 : item.enhancementLevel;
  const level = ok ? targetLevel : seal ? item.enhancementLevel : fallbackLevel;
  if (!ok && seal) inventory = removeItemQuantity(inventory, seal.id, 1).inventory;
  hero.inventory = destroyed
    ? inventory.filter(m => m.id !== itemId)
    : inventory.map(m => m.id === itemId ? { ...m, enhancementLevel: level } : m);
  if (destroyed) hero.equipment = Object.fromEntries(
    Object.entries(hero.equipment).map(([slot, id]) => [slot, id === itemId ? null : id]),
  ) as EquipmentLoadout;
  // Preserve existing economy: enhancement consumes materials, no GOLD fee.
  const stats = derivedStats(hero);
  hero.hp = Math.min(hero.hp, stats.maxHP);
  hero.maxMana = stats.maxMana;
  hero.mana = Math.min(hero.mana, stats.maxMana);
  const reason = ok ? `${item.name} berhasil menjadi +${level}.`
    : seal ? 'Enhancement gagal, tetapi Eternal Seal melindungi item.'
    : destroyed ? `${item.name} hancur karena enhancement gagal.`
    : `Enhancement gagal. Level item kembali menjadi +${level}.`;
  return { ok, attempted: true, reason, preview };
}

export function evolvePet(hero: Hero) {
  if (!hero.pet) return { ok: false, reason: 'Equip Pet Egg terlebih dahulu.' };
  if (hero.pet.level >= 10)
    return { ok: false, reason: 'Pet sudah mencapai evolusi maksimum.' };
  const material = hero.inventory.find(
    (item) => item.templateId === 'lumut-fiber' && item.quantity >= 3,
  );
  if (!material)
    return { ok: false, reason: 'Membutuhkan 3 Serat Lumut Arunika.' };
  hero.inventory = removeItemQuantity(hero.inventory, material.id, 3).inventory;
  hero.pet.level++;
  hero.pet.exp = 0;
  hero.pet.maxExp += 50;
  hero.pet.bonusStats = {
    movementSpeed: hero.pet.level,
    evasion: Math.round(hero.pet.level * 0.5 * 10) / 10,
  };
  hero.petRecords[hero.pet.id] = { ...hero.pet };
  return { ok: true, reason: `Pet berevolusi ke level ${hero.pet.level}.` };
}

export function chooseCoreJob(hero: Hero, coreJob: CoreJobId) {
  if (hero.skillArchitectureVersion === 3) return coreJob === 'warrior' && chooseV3Warrior(hero);
  if(hero.progressionArchitecture==='v2_test')return false;
  if (hero.level < 15 || hero.coreJob) return false;
  if (hasEquippedGear(hero)) return false;
  resetPlayerAllocationForCoreJob(hero);
  const returnedSkillPoints = refundableSkillPoints(hero);
  const core = CORE_JOBS[coreJob];
  hero.job = coreJob;
  hero.jobTier = 'core';
  hero.coreJob = coreJob;
  hero.specialization = null;
  hero.weaponType = core.weapon;
  hero.equipment = { ...emptyEquipment(), pet: hero.equipment.pet };
  hero.inventory = hero.inventory.map((item) => ({
    ...item,
    isEquipped: item.id === hero.equipment.pet,
  }));
  hero.selectedAmmo = null;
  hero.itemCooldowns = {};
  resetPromotionSkills(hero, returnedSkillPoints);
  hero.mana = Math.min(hero.mana,derivedStats(hero).maxMana);
  hero.coreQuestClaimed = true;
  hero.jobHistory = {...hero.jobHistory, core:{level:hero.level,chapter:1,acquiredAt:Date.now()}};
  const trainingTemplate: Record<CoreJobId,string> = {warrior:'field-verdant-plains-sword',rogue:'field-verdant-plains-dagger',hunter:'field-verdant-plains-bow',wizard:'field-verdant-plains-staff',acolyte:'field-verdant-plains-mace'};
  const weapon = createItem(trainingTemplate[coreJob], {
    name: `${core.name} Training ${coreJob==='hunter'?'Bow':coreJob==='wizard'?'Staff':coreJob==='acolyte'?'Mace':coreJob==='rogue'?'Daggers':'Sword'}`,
    weaponType: core.weapon,
    requiredCoreJob: coreJob,
    rarity: 'common',
    baseStats: {...ITEM_CATALOG['legacy-fajar-blade'].baseStats},
  });
  const reward = addItemToInventory(
    hero.inventory,
    weapon,
    hero.inventoryCapacity,
  );
  hero.inventory = reward.inventory;
  if (reward.remaining) hero.pendingLoot.push(weapon);
  hero.hp = maxHP(hero);
  return true;
}

export function chooseSpecialization(
  hero: Hero,
  specialization: SpecializationId,
) {
  if(hero.progressionArchitecture==='v2_test')return false;
  if (hero.skillArchitectureVersion === 3) return specialization === 'berserker' ? chooseV3Berserker(hero) : specialization === 'blade_master' ? chooseV3BladeMaster(hero) : false;
  const spec = SPECIALIZATIONS[specialization];
  if (
    hero.level < 25 ||
    !hero.coreJob ||
    spec.coreJob !== hero.coreJob ||
    hero.specialization
  )
    return false;
  const previousSkills=activeSkills(hero);
  hero.job = hero.coreJob;
  hero.jobTier = 'specialization';
  hero.specialization = specialization;
  remapPrimaryHotbarForJob(hero,previousSkills);
  hero.weaponType = spec.weapon;
  hero.mana = Math.min(hero.mana,derivedStats(hero).maxMana);
  hero.specializationQuestClaimed = true;
  hero.jobHistory = {...hero.jobHistory, specialization:{level:hero.level,chapter:1,acquiredAt:Date.now()}};
  for (const template of Object.values(ITEM_CATALOG).filter(
    (item) => item.requiredSpecialJob === specialization,
  )) {
    const weapon = createItem(template.templateId);
    const reward = addItemToInventory(
      hero.inventory,
      weapon,
      hero.inventoryCapacity,
    );
    hero.inventory = reward.inventory;
    if (reward.remaining) hero.pendingLoot.push(weapon);
    else equipItem(hero, weapon.id);
  }
  grantRank(hero,'passive',PASSIVES[specialization].id,1);
  for (const skill of skillsFor(hero.coreJob, specialization)) {
    grantRank(hero,'active',skill.id,skill.slot === 4 && hero.level < 45 ? 0 : 1);
  }
  hero.hp = maxHP(hero);
  return true;
}

export function chooseMastery(
  hero: Hero,
  skillId: string,
  choice: MasteryChoice,
) {
  if(hero.progressionArchitecture==='v2_test')return false;
  if (
    hero.level < 40 || !hero.specialization ||
    !['power','control','utility'].includes(choice) ||
    !activeSkills(hero).some((skill) => skill.id === skillId)
  )
    return false;
  hero.masteryChoices[skillId] = choice;
  hero.jobTier = 'mastery';
  hero.masteryQuestClaimed = true;
  if (!hero.jobHistory.mastery) hero.jobHistory = {...hero.jobHistory, mastery:{level:hero.level,chapter:1,acquiredAt:Date.now()}};
  return true;
}

export function learnSkill(hero: Hero, skillId: string) {
  if (hero.skillArchitectureVersion === 3) {
    const skill = activeSkills(hero).find((candidate) => candidate.id === skillId);
    const state = hero.skillProgressionV3 ?? adventurerV3StartingState();
    if (!skill) return false;
    const result = purchaseSkillRankV3({
      level: hero.level,
      state,
      jobs: { adventurer: { id: 'adventurer', tier: 'adventurer', parent: null }, warrior: { id: 'warrior', tier: 'core', parent: 'adventurer' }, berserker: { id: 'berserker', tier: 'specialization', parent: 'warrior' }, blade_master: { id: 'blade_master', tier: 'specialization', parent: 'warrior' } },
      skills: hero.coreJob === 'warrior' ? { ...ADVENTURER_V3_SKILL_MAP, ...WARRIOR_V3_SKILL_MAP, ...(hero.specialization === 'berserker' ? BERSERKER_V3_SKILL_MAP : {}), ...(hero.specialization === 'blade_master' ? BLADE_MASTER_V3_SKILL_MAP : {}) } : ADVENTURER_V3_SKILL_MAP,
    }, skillId);
    if (!result.ok) return false;
    hero.skillProgressionV3 = state;
    hero.skillLevels = { ...hero.skillLevels, [skillId]: state.skillRanks[skillId] };
    return true;
  }
  const skill = activeSkills(hero).find(
    (candidate) => candidate.id === skillId,
  );
  if (!skill || !canLearnSkill(skillId,hero).ok)
    return false;
  const current = skillLevel(hero, skill);
  if (current >= skill.maxLevel) return false;
  hero.skillLevels = {...hero.skillLevels};
  buyRank(hero,'active',skill.id);
  hero.skillPoints--;
  return true;
}

export const upgradeSkill = learnSkill;
export function unlockUniqueStats(hero: Hero, itemId: string) {
  const item = itemById(hero.inventory,itemId);
  const magnifier = hero.inventory.find(entry=>entry.itemType==='magnifier' && entry.quantity>0 && !entry.isLocked);
  if (!item) return {ok:false,reason:'Equipment tidak ditemukan di Inventory.'};
  if (!['weapon','armor','accessory'].includes(item.category) || !item.equipSlot)
    return {ok:false,reason:'Unique Stats hanya dapat dibuka pada equipment.'};
  if (!item.uniqueStatsLocked) return {ok:false,reason:'Unique Stats sudah terbuka atau item ini tidak memiliki Unique Stats.'};
  if (item.isLocked) return {ok:false,reason:'Equipment sedang terkunci.'};
  if (!magnifier) return {ok:false,reason:'Membutuhkan 1 Magnifier.'};
  hero.inventory=hero.inventory.map(entry=>entry.id===itemId?{...entry,uniqueStatsLocked:false,bonusStats:{...entry.bonusStats}}:entry.id===magnifier.id?{...entry,quantity:entry.quantity-1}:entry).filter(entry=>entry.quantity>0);
  return {ok:true,reason:'Unique Stats berhasil dibuka.'};
}
export function learnPassive(hero: Hero, passiveId?: string) {
  const passive = passiveId ? ALL_PASSIVES.find(entry=>entry.id===passiveId) : passiveFor(hero);
  if (!passive || !canLearnSkill(passive.id,hero).ok)
    return false;
  const current = hero.passiveLevels[passive.id] ?? 0;
  if (current >= passive.maxLevel) return false;
  hero.passiveLevels = {...hero.passiveLevels};
  buyRank(hero,'passive',passive.id);
  if(passive.tier==='capstone')hero.jobHistory={...hero.jobHistory,capstone:{level:hero.level,chapter:CITIES[hero.currentCity]?.chapter??1,acquiredAt:Date.now()}};
  hero.skillPoints--;
  return true;
}

function integer(value: unknown, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value as number)))
    : fallback;
}

function recordNumbers(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => [k, Math.max(0, v as number)]),
  );
}

function recordStats(value: unknown): AllocatedStats {
  const record =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    str: integer(record.str, 0, 999, 0),
    vit: integer(record.vit ?? record.sta, 0, 999, 0),
    dex: integer(record.dex, 0, 999, 0),
    int: integer(record.int, 0, 999, 0),
  };
}

function migratedEquipment(value: unknown): EquipmentLoadout {
  const result = emptyEquipment();
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  if (typeof source.weapon === 'string') result.mainHand = source.weapon;
  if (typeof source.armor === 'string') result.chest = source.armor;
  for (const slot of Object.keys(result) as EquipSlot[]) {
    if (typeof source[slot] === 'string') result[slot] = source[slot] as string;
  }
  return result;
}

export function retireUnusedNormalItems(hero:Hero) {
  const archived=[...hero.retiredItems];
  const equipped=new Set(Object.values(hero.equipment));
  for(const location of ['inventory','storage','pendingLoot'] as const){
    hero[location]=hero[location].filter(item=>{
      if(!equipped.has(item.id)&&isRetiredNormalMaterial(item)){
        archived.push({location,item});
        return false;
      }
      return true;
    });
  }
  hero.retiredItems=archived;
}

function normalizedHero(value: Record<string, unknown>, slotId = 'slot-1') {
  if (
    !value ||
    typeof value.level !== 'number' ||
    typeof value.gold !== 'number'
  )
    return null;
  const oldSave = value.version === 1 || value.version === 2;
  const id = typeof value.slotId === 'string' ? value.slotId : slotId;
  const name =
    typeof value.characterName === 'string' && value.characterName.trim()
      ? value.characterName
      : `Adventurer ${slotNumber(id)}`;
  const base = freshHero(id, 'adventurer', name);
  const appearanceBase = normalizeAppearance(value.appearance, value.gender === 'female' ? 'female' : 'male');
  // Preserve the legacy parser contract: an explicitly invalid legacy gender
  // value must fall back to male.  If the field is absent, the new appearance
  // payload may still carry a valid gender choice.
  const normalizedGender = value.gender === 'female'
    ? 'female'
    : typeof value.gender === 'string'
      ? 'male'
      : appearanceBase.gender;
  const appearance = { ...appearanceBase, gender: normalizedGender as CharacterGender };
  const savedSafe = value.lastSafePosition && typeof value.lastSafePosition === 'object'
    ? value.lastSafePosition as Record<string, unknown>
    : {};
  const safePosition = {
    x: integer(savedSafe.x ?? value.x, -10000, 10000, base.lastSafePosition.x),
    z: integer(savedSafe.z ?? value.z, -10000, 10000, base.lastSafePosition.z),
  };
  if (value.progressionArchitecture === 'v2_test') return null;
  const architecture:ProgressionArchitecture=value.progressionArchitecture==='v3_adventurer' || value.skillArchitectureVersion===3
      ? 'v3_adventurer'
      : 'legacy';
  const level = integer(value.level, 1, progressionRules({progressionArchitecture:architecture}).contentCap, 1);
  const allocatedStats = recordStats(value.allocatedStats);
  const normalizedInventory = Array.isArray(value.inventory)
    ? (value.inventory as unknown[])
        .map(normalizeItem)
        .filter((item): item is ItemData => Boolean(item))
    : base.inventory;
  const petValue =
    value.pet && typeof value.pet === 'object'
      ? (value.pet as Record<string, unknown>)
      : null;
  const h: Hero = {
    ...base,
    canDualWieldOneHandSwords: value.canDualWieldOneHandSwords === true,
    ...(value.characterSchemaVersion === CURRENT_CHARACTER_SCHEMA_VERSION ? { characterSchemaVersion: CURRENT_CHARACTER_SCHEMA_VERSION } : {}),
    ...(architecture!=='legacy'?{progressionArchitecture:architecture}:{}),
    ...(value.skillArchitectureVersion === 3 ? { skillArchitectureVersion: 3 as const, skillProgressionV3: normalizeSkillProgressionV3(value.skillProgressionV3) } : {}),
    rankOwnership:value.rankOwnership&&typeof value.rankOwnership==='object'?value.rankOwnership as RankOwnership:undefined,
    characterId: typeof value.characterId === 'string' && value.characterId.trim() ? value.characterId : `${id}-character`,
    gender: appearance.gender,
    appearance,
    createdAt: integer(value.createdAt, 0, Number.MAX_SAFE_INTEGER, 0),
    lastPlayedAt: integer(value.lastPlayedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    playTimeSeconds: integer(value.playTimeSeconds, 0, Number.MAX_SAFE_INTEGER, 0),
    lastSafePosition: safePosition,
    spawnPointId: typeof value.spawnPointId === 'string' ? value.spawnPointId : base.spawnPointId,
    version: 3,
    runeSystemVersion:2,
    runeForgePending:normalizeRuneForgePending(value.runeForgePending),
    retiredItems: Array.isArray(value.retiredItems) ? value.retiredItems.flatMap(entry=>{
      if(!entry||typeof entry!=='object'||!['inventory','storage','pendingLoot'].includes(entry.location))return [];
      const item=normalizeItem(entry.item);
      return item?[{location:entry.location as 'inventory'|'storage'|'pendingLoot',item}]:[];
    }) : [],
    itemCooldowns: Object.fromEntries(Object.entries(recordNumbers(value.itemCooldowns)).filter(([,time])=>Number.isFinite(time)&&time>=0)),
    selectedAmmo: typeof value.selectedAmmo==='string' ? value.selectedAmmo : null,
    currentCity: typeof value.currentCity === 'string' && CITIES[value.currentCity] ? value.currentCity : 'arunika',
    currentField: typeof value.currentField === 'string' && FIELDS[value.currentField] ? value.currentField : 'verdant-plains',
    inCity: typeof value.inCity === 'boolean' ? value.inCity : true,
    unlockedCities: Array.isArray(value.unlockedCities) ? value.unlockedCities.filter((id):id is string=>typeof id==='string'&&Boolean(CITIES[id])) : ['arunika'],
    unlockedFields: Array.isArray(value.unlockedFields) ? value.unlockedFields.filter((id):id is string=>typeof id==='string'&&Boolean(FIELDS[id])) : ['verdant-plains'],
    completedQuests: Array.from(new Set([...(Array.isArray(value.completedQuests) ? value.completedQuests.filter((id):id is string=>typeof id==='string').map(migrateFieldQuestId) : []), ...(value.questClaimed === true ? ['main-verdant-bisikan'] : [])])),
    acceptedQuests: Array.from(new Set([...(Array.isArray(value.acceptedQuests) ? value.acceptedQuests : []), ...(Array.isArray(value.activeQuests) ? value.activeQuests : [])].filter((id):id is string=>typeof id==='string').map(migrateFieldQuestId))),
    activeQuests: Array.from(new Set([...(Array.isArray(value.activeQuests) ? value.activeQuests : []), ...(Array.isArray(value.acceptedQuests) ? value.acceptedQuests : [])].filter((id):id is string=>typeof id==='string').map(migrateFieldQuestId))),
    questCooldowns: recordNumbers(value.questCooldowns),
    defeatedFieldBosses: Array.isArray(value.defeatedFieldBosses) ? value.defeatedFieldBosses.filter((id):id is string=>typeof id==='string') : [],
    defeatedBossTimestamp: recordNumbers(value.defeatedBossTimestamp),
    monsterRespawnState: recordNumbers(value.monsterRespawnState),
    cityProgress: recordNumbers(value.cityProgress), fieldProgress: recordNumbers(value.fieldProgress),
    storage: Array.isArray(value.storage) ? value.storage.map(normalizeItem).filter((item):item is ItemData=>Boolean(item)) : [],
    level,
    xp: integer(value.xp, 0, 1000000, 0),
    gold: integer(value.gold, 0, 999999999, 0),
    kills: integer(value.kills, 0, 999999, 0),
    potions: integer(value.potions, 0, 50, 3),
    weapon: integer(value.weapon, 0, 20, 0),
    questClaimed: value.questClaimed === true,
    bossDefeated: value.bossDefeated === true,
    x: integer(value.x, 1-regionHalfExtent(value.inCity !== false), regionHalfExtent(value.inCity !== false)-1, 0),
    z: integer(value.z, 1-regionHalfExtent(value.inCity !== false), regionHalfExtent(value.inCity !== false)-1, 7),
    skillPoints: integer(value.skillPoints, 0, 500, Math.max(0, level - 1)),
    statPoints: integer(value.statPoints, 0, 999, Math.max(0, level - 1) * STAT_POINTS_PER_LEVEL),
    allocatedStats,
    skillLevels: recordNumbers(value.skillLevels),
    passiveLevels: recordNumbers(value.passiveLevels),
    jobHistory: value.jobHistory && typeof value.jobHistory === 'object' ? Object.fromEntries(Object.entries(value.jobHistory).filter(([,entry])=>entry && typeof entry === 'object' && Number.isFinite((entry as {level:number}).level)).map(([id,entry])=>{const record=entry as {level:number;chapter:number;acquiredAt:number};return [id,{level:integer(record.level,1,progressionRules({progressionArchitecture:architecture}).contentCap,1),chapter:integer(record.chapter,1,WORLD_CONFIG.chapterCap,1),acquiredAt:integer(record.acquiredAt,0,Number.MAX_SAFE_INTEGER,0)}];})) : {},
    masteryChoices:
      value.masteryChoices && typeof value.masteryChoices === 'object'
        ? (value.masteryChoices as Record<string, MasteryChoice>)
        : {},
    mana: integer(value.mana ?? value.mp ?? value.classResource ?? value.aji ?? value.momentum, 0, Number.MAX_SAFE_INTEGER, 100),
    stamina: integer(value.stamina, 0, 9999, 100),
    maxMana: 100,
    barrier: integer(value.barrier, 0, 99999, 0),
    activeBuffs: recordNumbers(value.activeBuffs),
    statusEffects: recordNumbers(value.statusEffects),
    inventoryCapacity: Math.max(
      WORLD_CONFIG.inventoryCapacity,
      integer(
        value.inventoryCapacity,
        10,
        200,
        WORLD_CONFIG.inventoryCapacity,
      ),
    ),
    pendingLoot: Array.isArray(value.pendingLoot)
      ? value.pendingLoot
          .map(normalizeItem)
          .filter((item): item is ItemData => Boolean(item))
      : [],
    petRecords:
      value.petRecords && typeof value.petRecords === 'object'
        ? (value.petRecords as Record<string, PetState>)
        : {},
    inventory: normalizedInventory,
    inventoryLayout: Array.isArray(value.inventoryLayout)
      ? value.inventoryLayout.slice(0, Math.max(normalizedInventory.length, 100)).map(id => typeof id === 'string' ? id : null)
      : undefined,
    equipment: migratedEquipment(value.equipment),
    pet: petValue
      ? {
          id:
            typeof petValue.id === 'string'
              ? petValue.id
              : 'adventurer-pet-egg',
          level: integer(petValue.level, 1, 50, 1),
          exp: integer(petValue.exp, 0, 999999, 0),
          maxExp: integer(petValue.maxExp, 1, 999999, 100),
          rarity:
            typeof petValue.rarity === 'string' &&
            ['normal', 'rare', 'unique', 'legendary', 'legacy'].includes(
              petValue.rarity,
            )
              ? (petValue.rarity as ItemRarity)
              : 'rare',
          passive:
            typeof petValue.passive === 'string'
              ? petValue.passive
              : 'Menambah 2% movement speed.',
          bonusStats: normalizeStatBlock(petValue.bonusStats),
        }
      : null,
    fateRune:
      value.fateRune && typeof value.fateRune === 'object'
        ? (value.fateRune as Hero['fateRune'])
        : null,
    eternalSeal:
      value.eternalSeal && typeof value.eternalSeal === 'object'
        ? (value.eternalSeal as Hero['eternalSeal'])
        : null,
    enhancementSealEnabled: value.enhancementSealEnabled !== false,
  };
  // Saves from v1/v2 intentionally reopen as Adventurer, but retain progress.
  if (
    !oldSave &&
    (value.coreJob === 'warrior' ||
      value.coreJob === 'rogue' ||
      value.coreJob === 'hunter' ||
      value.coreJob === 'wizard' ||
      value.coreJob === 'acolyte')
  ) {
    h.coreJob = value.coreJob;
    h.job = value.coreJob;
    h.jobTier =
      value.jobTier === 'mastery' ||
      value.jobTier === 'specialization' ||
      value.jobTier === 'core'
        ? value.jobTier
        : 'core';
    h.coreQuestClaimed = value.coreQuestClaimed === true;
    h.weaponType =
      (value.weaponType as WeaponType) || CORE_JOBS[h.coreJob].weapon;
  }
  if (
    !oldSave &&
    value.skillArchitectureVersion === 3 &&
    (value.specialization === 'berserker' || value.specialization === 'blade_master') &&
    h.skillArchitectureVersion === 3 &&
    h.coreJob === 'warrior'
  ) {
    h.specialization = value.specialization;
    h.jobTier = 'specialization';
    h.weaponType = value.specialization === 'blade_master' ? 'dual_sword' : 'two_hand_sword';
    h.specializationQuestClaimed = value.specializationQuestClaimed === true;
  } else if (
    !oldSave &&
    typeof value.specialization === 'string' &&
    value.specialization in SPECIALIZATIONS
  ) {
    h.specialization = value.specialization as SpecializationId;
    h.jobTier = value.jobTier === 'mastery' ? 'mastery' : 'specialization';
    h.weaponType = SPECIALIZATIONS[h.specialization].weapon;
    h.specializationQuestClaimed = value.specializationQuestClaimed === true;
  }
  // Identity parsing is not public authorization. Preserve canonical V2 metadata
  // without converting legacy IDs, assigning a tree or borrowing a legacy profile.
  if(!oldSave && h.progressionArchitecture==='v2_test' && typeof value.coreJob==='string' && getJobV2(value.coreJob)?.tier===1 && !legacyCoreJob(value.coreJob)) {
    h.coreJob=value.coreJob as CoreJobV2Id; h.job=h.coreJob; h.jobTier='core'; h.specialization=null;
  }
  if (!oldSave) {
    h.masteryQuestClaimed = value.masteryQuestClaimed === true;
  }
  // Backfill the ownership marker for legacy saves whose equipment is stored
  // as slot IDs alongside the inventory item instance.
  const equippedIds = new Set(
    Object.values(h.equipment).filter((id): id is string => Boolean(id)),
  );
  h.inventory = h.inventory.map(item => ({
    ...item,
    isEquipped: equippedIds.has(item.id),
  }));
  retireUnusedNormalItems(h);
  const currentSkills = activeSkills(h);
  for (const skill of currentSkills) {
    h.skillLevels[skill.id] = integer(
      h.skillLevels[skill.id],
      0,
      skill.maxLevel,
      h.skillArchitectureVersion === 3
        ? h.skillProgressionV3?.skillRanks[skill.id] ?? 0
        : skill.tree?.architecture==='v2' ? 0 : skill.slot === 4 && level < 45 ? 0 : 1,
    );
  }
  h.rankOwnership=normalizedRankOwnership(h);
  h.hp = integer(value.hp, 1, maxHP(h), maxHP(h));
  h.maxMana = derivedStats(h).maxMana;
  h.mana = Math.min(h.mana, h.maxMana);
  const potionItem = h.inventory.find((item) => item.itemType === 'potion');
  if (oldSave && potionItem && typeof value.potions === 'number')
    potionItem.quantity = integer(
      value.potions,
      0,
      potionItem.maxStack,
      potionItem.quantity,
    );
  if (!potionItem && h.potions > 0 && (oldSave || !Array.isArray(value.inventory))) {
    h.inventory = addItemToInventory(
      h.inventory,
      createItem('health-potion-1', {
        id: 'potion-light-migrated',
        quantity: h.potions,
      }),
      h.inventoryCapacity,
    ).inventory;
  }
  h.potions = h.inventory.filter(item=>item.itemType==='potion').reduce((sum,item)=>sum+item.quantity,0);
  if (h.kills < 6) {
    h.questClaimed = false;
    h.bossDefeated = false;
  }
  h.acceptedQuests = h.acceptedQuests.filter(id => !h.completedQuests.includes(id));
  h.activeQuests = h.acceptedQuests;
  Object.assign(h,loadPrimaryHotbar(h,value));
  const cooldowns:Record<string,number>={};
  for(const [id,until] of Object.entries(h.itemCooldowns)) {
    const template=ITEM_CATALOG[canonicalItemTemplateId(id)];
    const key=template?itemCooldownKey(template):id;
    cooldowns[key]=Math.max(cooldowns[key]??0,until);
  }
  h.itemCooldowns=cooldowns;
  h.unlockedFields=Array.from(new Set([...h.unlockedFields,...startingFieldIds()]));
  const terrain=!h.inCity?FIELD_TERRAINS[h.currentField]:undefined;
  if(terrain)Object.assign(h,nearestTerrainPoint(terrain,{x:h.x,z:h.z}));
  if(h.progressionArchitecture==='v2_test')delete h.statusEffects.stealth;
  if(h.skillArchitectureVersion === 3) {
    h.activeBuffs = Object.fromEntries(Object.entries(h.activeBuffs).filter(([id]) => !id.startsWith('v3-')));
    delete h.statusEffects.stun;
    delete h.statusEffects.superArmor;
  }
  return h;
}

export function parseSave(raw: string | null, slotId = 'slot-1'): Hero | null {
  if (!raw) return null;
  try {
    return normalizedHero(JSON.parse(raw) as Record<string, unknown>, slotId);
  } catch {
    return null;
  }
}

export function parseSaveCollection(raw: string | null): SaveCollection | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value.characters || typeof value.characters !== 'object') return null;
    const characters: Record<string, Hero> = {};
    for (const [id, hero] of Object.entries(
      value.characters as Record<string, unknown>,
    )) {
      const parsed = normalizedHero(hero as Record<string, unknown>, id);
      if (parsed) characters[id] = parsed;
    }
    const activeSlot =
      typeof value.activeSlot === 'string' ? value.activeSlot : 'slot-1';
    const referencedId =
      typeof value.lastPlayedCharacterId === 'string'
        ? value.lastPlayedCharacterId
        : characters[activeSlot]?.characterId ?? null;
    const lastPlayedCharacterId = referencedId && Object.values(characters).some(hero => hero.characterId === referencedId)
      ? referencedId
      : null;
    return {
      version: 3,
      activeSlot,
      lastPlayedCharacterId,
      characters,
    };
  } catch {
    return null;
  }
}

function readCollection(): SaveCollection {
  try {
    const current = parseSaveCollection(localStorage.getItem(SAVE_KEY));
    if (current) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(current));
      localStorage.removeItem(LEGACY_SAVE_KEY);
      localStorage.removeItem(OLDER_SAVE_KEY);
      return current;
    }
    const legacyCollection = parseSaveCollection(
      localStorage.getItem(LEGACY_SAVE_KEY),
    );
    if (legacyCollection) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(legacyCollection));
      localStorage.removeItem(LEGACY_SAVE_KEY);
      return legacyCollection;
    }
    const legacy = parseSave(localStorage.getItem(OLDER_SAVE_KEY));
    localStorage.removeItem(OLDER_SAVE_KEY);
    return {
      version: 3,
      activeSlot: legacy?.slotId ?? 'slot-1',
      lastPlayedCharacterId: null,
      characters: legacy ? { [legacy.slotId]: legacy } : {},
    };
  } catch {
    return { version: 3, activeSlot: 'slot-1', lastPlayedCharacterId: null, characters: {} };
  }
}

export function listCharacters(): CharacterSlot[] {
  const collection = readCollection();
  return ['slot-1', 'slot-2', 'slot-3'].map((id) => ({
    id,
    hero: collection.characters[id] ?? null,
  }));
}

export function loadCharacter(slotId: string): Hero {
  return readCollection().characters[slotId] ?? freshHero(slotId);
}

export function saveCharacter(hero: Hero, required = false) {
  const localhostMemoryHarness = isLocalhostMemoryHarness();
  if (!isCompatibleCharacterSave(hero)) {
    if (required && !localhostMemoryHarness) throw new Error('Only V3 characters can be saved.');
    if (!localhostMemoryHarness) return;
    if (hero.progressionArchitecture !== 'v2_test') return;
  }
  const collection = readCollection();
  collection.activeSlot = hero.slotId;
  const saved={...hero,version:3 as const};
  if (hero.skillArchitectureVersion === 3) {
    saved.activeBuffs = Object.fromEntries(Object.entries(saved.activeBuffs).filter(([id]) => !id.startsWith('v3-')));
    saved.statusEffects = { ...saved.statusEffects };
    delete saved.statusEffects.superArmor;
  }
  delete saved.temporaryModifiers;delete saved.combatStateModifiers;delete saved.manualGuardActive;
  delete saved.stunState;
  delete saved.statusEffects.stun;
  collection.characters[hero.slotId] = saved;
  collection.lastPlayedCharacterId = hero.characterId;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(collection));
  } catch (error) {
    if(required)throw error;
  }
}

export function deleteCharacter(slotId: string) {
  const collection = readCollection();
  const existed = Boolean(collection.characters[slotId]);
  delete collection.characters[slotId];
  if (collection.activeSlot === slotId) collection.activeSlot = 'slot-1';
  if (collection.lastPlayedCharacterId && !Object.values(collection.characters).some(hero => hero.characterId === collection.lastPlayedCharacterId))
    collection.lastPlayedCharacterId = null;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(collection));
  } catch {
    /* Local storage is optional. */
  }
  return existed;
}

export const saveCharacterProgress = saveCharacter;

export function getLastPlayedCharacter(): Hero | null {
  const collection = readCollection();
  if (!collection.lastPlayedCharacterId) return null;
  return Object.values(collection.characters).find(hero => hero.characterId === collection.lastPlayedCharacterId) ?? null;
}

export const characterLabel = displayLabel;
export const passiveFor = (hero: Hero) =>
  hero.specialization ? PASSIVES[hero.specialization] : null;
export { ALL_SKILLS, CORE_JOBS, PASSIVES, SPECIALIZATIONS, skillsFor };
export type {
  CoreJobId,
  MasteryChoice,
  SpecializationId,
  SkillDefinition,
  WeaponType,
};
export {
  addItemToInventory,
  canEquipItem,
  createItem,
  emptyEquipment,
  itemById,
  itemStats,
  normalizeItem,
  removeItemQuantity,
};
export type { EquipSlot, EquipmentLoadout, ItemData, ItemRarity, StatBlock };

function normalizeRuneForgePending(raw:unknown):RuneForgePending|null {
 if(!raw||typeof raw!=='object')return null;
 const v=raw as RuneForgePending,candidate=normalizeSocketedRune(v.candidate);
 if(!candidate||typeof v.id!=='string'||typeof v.equipmentId!=='string'||!Number.isInteger(v.socketIndex)||typeof v.beforeSignature!=='string'||typeof v.npcId!=='string')return null;
 return {...v,candidate};
}
