import type { CoreJobId, RuntimeCoreJobId, SpecializationId, WeaponType } from './skills.ts';
import { STAMINA_ENABLED } from './gameplay-config.ts';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'ancient' | 'normal' | 'unique' | 'legacy';
export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'ancient';
export type RuneRarity = 'cracked' | 'simple' | 'refined' | 'rare' | 'epic' | 'legendary' | 'ancient';
export type RuneTheme = 'might' | 'precision' | 'swiftness' | 'vitality' | 'arcana' | 'focus' | 'elements' | 'fortune' | 'guardian' | 'shadows';
export type AffixQuality = 'minimum' | 'low' | 'normal' | 'high' | 'perfect';
export type AffixSource = 'equipment' | 'rune' | 'runeOptimizer';
export type RuneOptimizerTier = 'basic' | 'chromatic' | 'greaterChromatic' | 'perfectChromatic';

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'pet'
  | 'consumable'
  | 'potion'
  | 'material'
  | 'rune'
  | 'quest';
export type InventoryFilter = 'all' | ItemCategory;
export type InventorySort = 'manual' | 'name' | 'rarity' | 'type' | 'level' | 'combined';
export type EquipSlot =
  | 'mainHand'
  | 'offHand'
  | 'head'
  | 'chest'
  | 'gloves'
  | 'legs'
  | 'boots'
  | 'necklace'
  | 'ring1'
  | 'ring2'
  | 'earring1'
  | 'earring2'
  | 'pet';

export type EquipmentType =
  | 'one_hand_sword' | 'two_hand_sword' | 'dagger' | 'bow' | 'knuckle'
  | 'staff' | 'wand' | 'mace' | 'shield' | 'off_hand_dagger'
  | 'tome' | 'orb' | 'quiver' | 'talisman' | 'helmet' | 'armor'
  | 'gloves' | 'legs' | 'boots' | 'necklace' | 'ring' | 'earring' | 'pet';
export type Handedness = 'one_hand' | 'two_hand' | 'off_hand' | 'none';
export type AttackType = 'melee' | 'ranged' | 'magic' | 'hybrid' | 'none';
export type EquipmentAsset = { icon: string; sprite: string; model: string | null; fallback: string };

export type StatBlock = {
  str?: number;
  dex?: number;
  int?: number;
  /** Canonical vitality stat. `sta` is retained only for old-save migration. */
  vit?: number;
  sta?: number;
  attack?: number;
  defense?: number;
  magicDefense?: number;
  hp?: number;
  stamina?: number;
  critRate?: number;
  critDamage?: number;
  attackSpeed?: number;
  movementSpeed?: number;
  evasion?: number;
  blockRate?: number;
  healingPower?: number;
  skillPower?: number;
  resourceEfficiency?: number;
  maxMana?: number;
  attackPercent?: number;
  physicalDamage?: number;
  magicAttack?: number;
  skillDamage?: number;
  bossDamage?: number;
  eliteDamage?: number;
  rangedDamage?: number;
  projectileDamage?: number;
  weakPointDamage?: number;
  accuracy?: number;
  damageReduction?: number;
  parryRate?: number;
  cooldownReduction?: number;
  hpRecovery?: number;
  mpRecovery?: number;
  manaCostReduction?: number;
  expGain?: number;
  goldDropRate?: number;
  itemDropRate?: number;
  materialDropRate?: number;
  elementalDamage?: number;
  elementalResistance?: number;
  physicalPenetration?: number;
  magicPenetration?: number;
};

/** Converts legacy stat keys at the data boundary without changing item IDs. */
export const normalizeStatBlock = (raw: unknown): StatBlock => {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const result: StatBlock = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const canonical = key === 'sta' ? 'vit' : key;
    if (canonical === 'elementalResistance') {
      result.magicDefense = (result.magicDefense ?? 0) + value;
      continue;
    }
    (result as Record<string, number>)[canonical] = ((result as Record<string, number>)[canonical] ?? 0) + value;
  }
  return result;
};

export type ItemAffix = { id: string; stat: keyof StatBlock; label: string; value: number; unit: 'flat' | 'percent'; quality?: AffixQuality; source?: AffixSource; locked?: boolean };
export type UniqueEffectData = { id: string; magnitude?: number; priority?: number; stackable?: boolean };
/** Socket owns the complete Rune item instance. */
// Legacy unknown Runes remain owned/readable even when their theme cannot be recovered.
export type SocketedRune = ItemData & {sourceLabel:string};
export type EquipmentSocket = { id: string; rune: SocketedRune | null };
export type ItemSource = { type: 'starter' | 'shop' | 'monster' | 'elite' | 'field_boss' | 'high_boss' | 'world_boss' | 'quest' | 'legacy'; sourceId: string | null; label: string };
export type RuneOptimizerHistory = { rerollCount: number; lastOptimizerAt: number | null };

export type SkillModifierMap = Record<string, number>;
export type ItemUseEffect = { type: 'heal' | 'mana' | 'resource' | 'stamina' | 'buff' | 'ammunition' | 'mount'; amount?: number; percentage?: number; duration?: number; buffId?: string; mountId?: string };

export const POTION_ALIASES: Record<string,string> = {
  'potion-light':'health-potion-1', 'minor-health-potion':'health-potion-1', 'small-health-potion':'health-potion-1',
  'potion-mana':'mana-potion-1', 'minor-mana-potion':'mana-potion-1', 'small-mana-potion':'mana-potion-1',
};
export const canonicalItemTemplateId = (id:string) => POTION_ALIASES[id] ?? id;
export const itemCooldownKey = (item:Pick<ItemData,'templateId'|'potionType'>) => item.potionType ? `potion:${item.potionType}` : item.templateId;
export const getItemCooldownRemaining = (cooldowns:Record<string,number>,item:Pick<ItemData,'templateId'|'potionType'>,now=Date.now()) => Math.max(0,((cooldowns[itemCooldownKey(item)] ?? 0)-now)/1000);
export const potionRestoreAmount = (item:Pick<ItemData,'restoreType'|'restoreValue'>,maximum:number) => item.restoreType==='percentage' ? Math.ceil(maximum*(item.restoreValue??0)/100) : Math.max(0,item.restoreValue??0);

export type ItemData = {
  id: string;
  templateId: string;
  /** Compatibility ownership marker: equipped instances are hidden from the Inventory UI. */
  isEquipped?: boolean;
  name: string;
  description: string;
  category: ItemCategory;
  itemType: string;
  usableFromHotbar?: boolean;
  hotbarCategory?: 'primary' | 'utility';
  useEffect?: ItemUseEffect;
  useCooldown?: number;
  potionType?: 'health' | 'mana';
  tier?: 1 | 2 | 3;
  restoreType?: 'percentage' | 'flat';
  restoreValue?: number;
  rarity: ItemRarity;
  icon: string;
  levelRequirement: number;
  jobRequirement: string | null;
  stackable: boolean;
  maxStack: number;
  quantity: number;
  sellValue: number;
  buyValue: number;
  baseStats: StatBlock;
  bonusStats: StatBlock;
  enhancementLevel: number;
  maxEnhancementLevel: number;
  weaponType: WeaponType | null;
  equipmentType: EquipmentType | null;
  handedness: Handedness;
  attackType: AttackType;
  allowedJobs: CoreJobId[];
  asset: EquipmentAsset | null;
  mainHand: boolean;
  offHand: boolean;
  equipSlot: EquipSlot | null;
  skillModifiers: SkillModifierMap;
  requiredCoreJob: CoreJobId | null;
  requiredSpecialJob: SpecializationId | null;
  isQuestItem: boolean;
  isSellable: boolean;
  isTradable: boolean;
  isSoulbound: boolean;
  isLocked: boolean;
  uniqueStatsLocked?: boolean;
  twoHanded: boolean;
  petPassive: string | null;
  affixes: ItemAffix[];
  sockets: EquipmentSocket[];
  source: ItemSource;
  runeRarity: RuneRarity | null;
  runeTheme: RuneTheme | null;
  runeSource: string | null;
  runeJobRequirement: CoreJobId | null;
  uniqueEffect: string | null;
  uniqueEffectData?: UniqueEffectData;
  optimizerTier: RuneOptimizerTier | null;
  runeSchemaVersion?: 2;
  runeQualityFixed?: boolean;
  optimizerHistory: RuneOptimizerHistory;
};

/** Maximum quantity for every item that is allowed to stack in one slot. */
export const MAX_STACK_QUANTITY = 100;

export type EquipmentLoadout = Record<EquipSlot, string | null>;

export const RARITY_META: Record<
  ItemRarity,
  { label: string; color: string; rank: number }
> = {
  normal: { label: 'Normal', color: '#B8B8B8', rank: 1 },
  common: { label: 'Common', color: '#B8B8B8', rank: 1 },
  uncommon: { label: 'Uncommon', color: '#55C96B', rank: 2 },
  rare: { label: 'Rare', color: '#4EA5FF', rank: 3 },
  epic: { label: 'Epic', color: '#B36BFF', rank: 4 },
  legendary: { label: 'Legendary', color: '#FFAA3B', rank: 5 },
  mythic: { label: 'Mythic', color: '#FF4F81', rank: 6 },
  ancient: { label: 'Ancient', color: '#E6D37A', rank: 7 },
  unique: { label: 'Unique (Legacy)', color: '#B36BFF', rank: 4 },
  legacy: { label: 'Legacy', color: '#FF4F81', rank: 6 },
};

const EQUIPMENT_TYPE_ALIASES: Record<string, EquipmentType> = {
  sword: 'one_hand_sword', oneHandSword: 'one_hand_sword', twoHandSword: 'two_hand_sword',
  dagger: 'dagger', dualDagger: 'dagger', bow: 'bow', bowTrap: 'bow',
  twoHandedKnuckle: 'knuckle', holyKnuckle: 'knuckle', staff: 'staff', wand: 'wand',
  mace: 'mace', shield: 'shield', offHandDagger: 'off_hand_dagger', tome: 'tome',
  orb: 'orb', quiver: 'quiver', talisman: 'talisman', relic: 'talisman',
  head: 'helmet', chest: 'armor', gloves: 'gloves', legs: 'legs', boots: 'boots',
  necklace: 'necklace', ring1: 'ring', ring2: 'ring', earring1: 'earring', earring2: 'earring', petEgg: 'pet',
};

export const inferEquipmentType = (item: Pick<ItemData, 'itemType' | 'equipSlot' | 'category'>): EquipmentType | null =>
  EQUIPMENT_TYPE_ALIASES[item.itemType] ?? (item.equipSlot ? EQUIPMENT_TYPE_ALIASES[item.equipSlot] : null) ?? (item.category === 'armor' ? 'armor' : null);

export const inferHandedness = (type: EquipmentType | null, twoHanded = false): Handedness =>
  twoHanded || ['bow', 'two_hand_sword', 'staff', 'knuckle'].includes(type ?? '') ? 'two_hand' :
  ['shield', 'off_hand_dagger', 'tome', 'orb', 'quiver', 'talisman'].includes(type ?? '') ? 'off_hand' :
  ['one_hand_sword', 'dagger', 'wand', 'mace'].includes(type ?? '') ? 'one_hand' : 'none';

export const inferAttackType = (type: EquipmentType | null): AttackType =>
  type === 'bow' ? 'ranged' : ['staff', 'wand', 'tome', 'orb', 'talisman'].includes(type ?? '') ? 'magic' :
  ['mace'].includes(type ?? '') ? 'hybrid' : ['one_hand_sword', 'two_hand_sword', 'dagger', 'knuckle'].includes(type ?? '') ? 'melee' : 'none';

export const defaultAllowedJobs = (type: EquipmentType | null): CoreJobId[] => {
  if (type === 'one_hand_sword') return ['warrior','rogue'];
  if (['two_hand_sword','shield'].includes(type ?? '')) return ['warrior'];
  if (['mace','knuckle'].includes(type ?? '')) return ['warrior','acolyte'];
  if (['dagger', 'off_hand_dagger'].includes(type ?? '')) return ['rogue'];
  if (['bow', 'quiver'].includes(type ?? '')) return ['hunter'];
  if (['wand', 'tome', 'orb'].includes(type ?? '')) return ['wizard'];
  if (type === 'staff') return ['wizard', 'acolyte'];
  if (type === 'talisman') return ['wizard', 'acolyte'];
  return [];
};

export const resolveEquipmentAsset = (item: Pick<ItemData, 'templateId' | 'itemType' | 'equipSlot' | 'category' | 'equipmentType' | 'asset'>): EquipmentAsset => {
  const id = item.templateId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const type = item.equipmentType ?? inferEquipmentType(item) ?? 'armor';
  return item.asset ?? { icon: `/assets/equipment/${id}/icon.png`, sprite: `/assets/equipment/${id}/sprite.png`, model: null, fallback: type };
};

const base = (
  data: Partial<ItemData> &
    Pick<ItemData, 'templateId' | 'name' | 'category' | 'itemType'>,
): Omit<ItemData, 'id' | 'quantity'> => ({
  templateId: data.templateId,
  name: data.name,
  description: data.description ?? 'Perlengkapan perjalanan Lumenfall.',
  category: data.category,
  itemType: data.itemType,
  usableFromHotbar: data.usableFromHotbar ?? false,
  hotbarCategory: data.hotbarCategory ?? 'utility',
  useEffect: data.useEffect,
  useCooldown: data.useCooldown ?? 0,
  potionType: data.potionType,
  tier: data.tier,
  restoreType: data.restoreType,
  restoreValue: data.restoreValue,
  rarity: data.rarity ?? 'normal',
  icon: data.icon ?? '✦',
  levelRequirement: data.levelRequirement ?? 1,
  jobRequirement: data.jobRequirement ?? null,
  stackable: data.stackable ?? false,
  maxStack: data.stackable ? MAX_STACK_QUANTITY : 1,
  sellValue: data.sellValue ?? 5,
  buyValue: data.buyValue ?? 0,
  baseStats: normalizeStatBlock(data.baseStats),
  bonusStats: normalizeStatBlock(data.bonusStats),
  enhancementLevel: data.enhancementLevel ?? 0,
  maxEnhancementLevel: data.maxEnhancementLevel ?? 12,
  weaponType: data.weaponType ?? null,
  equipmentType: data.equipmentType ?? inferEquipmentType({ itemType: data.itemType, equipSlot: data.equipSlot ?? null, category: data.category }),
  handedness: data.handedness ?? inferHandedness(data.equipmentType ?? EQUIPMENT_TYPE_ALIASES[data.itemType] ?? null, data.twoHanded),
  attackType: data.attackType ?? inferAttackType(data.equipmentType ?? EQUIPMENT_TYPE_ALIASES[data.itemType] ?? null),
  allowedJobs: data.allowedJobs ?? defaultAllowedJobs(data.equipmentType ?? EQUIPMENT_TYPE_ALIASES[data.itemType] ?? null),
  asset: data.asset ?? (['weapon','armor','accessory'].includes(data.category) ? {
    icon:`/assets/equipment/${data.templateId}/icon.png`,
    sprite:`/assets/equipment/${data.templateId}/sprite.png`,
    model:null,
    fallback:String(data.equipmentType ?? EQUIPMENT_TYPE_ALIASES[data.itemType] ?? inferEquipmentType({itemType:data.itemType,equipSlot:data.equipSlot??null,category:data.category}) ?? 'armor'),
  } : null),
  mainHand: data.mainHand ?? false,
  offHand: data.offHand ?? false,
  equipSlot: data.equipSlot ?? null,
  skillModifiers: data.skillModifiers ?? {},
  requiredCoreJob: data.requiredCoreJob ?? null,
  requiredSpecialJob: data.requiredSpecialJob ?? null,
  isQuestItem: data.isQuestItem ?? false,
  isSellable: data.isSellable ?? !(data.isQuestItem || data.isSoulbound),
  isTradable: data.isTradable ?? true,
  isSoulbound: data.isSoulbound ?? false,
  isLocked: data.isLocked ?? false,
  twoHanded: data.twoHanded ?? false,
  petPassive: data.petPassive ?? null,
  affixes: data.affixes ?? [],
  sockets: data.sockets ?? [],
  source: data.source ?? { type: 'shop', sourceId: null, label: 'Perlengkapan standar' },
  runeRarity: data.runeRarity ?? null,
  runeTheme: data.runeTheme ?? null,
  runeSource: data.runeSource ?? null,
  runeJobRequirement: data.runeJobRequirement ?? null,
  uniqueEffect: data.uniqueEffect ?? null,
  uniqueEffectData: data.uniqueEffectData ?? undefined,
  uniqueStatsLocked: data.uniqueStatsLocked ?? false,
  optimizerTier: data.optimizerTier ?? null,
  runeSchemaVersion: 2,
  runeQualityFixed: data.runeQualityFixed ?? false,
  optimizerHistory: data.optimizerHistory ?? { rerollCount: 0, lastOptimizerAt: null },
});



export const RUNE_RARITY_RULES: Record<RuneRarity,{minAffixes:number;maxAffixes:number;power:number;color:string}> = {
 cracked:{minAffixes:1,maxAffixes:1,power:.3,color:'#8f9698'},simple:{minAffixes:1,maxAffixes:1,power:.5,color:'#c3c8c9'},refined:{minAffixes:1,maxAffixes:2,power:1,color:'#57bd78'},rare:{minAffixes:2,maxAffixes:2,power:1.5,color:'#4e9df5'},epic:{minAffixes:2,maxAffixes:3,power:2.2,color:'#b369e8'},legendary:{minAffixes:3,maxAffixes:3,power:3,color:'#e9bd4e'},ancient:{minAffixes:3,maxAffixes:4,power:4,color:'#fc6c3d'},
};

export const RUNE_THEME_POOLS: Record<RuneTheme, Array<keyof StatBlock>> = {
 might:['physicalDamage','str','critDamage','bossDamage'],precision:['critRate','accuracy','critDamage','weakPointDamage'],swiftness:['attackSpeed','movementSpeed','cooldownReduction','evasion'],vitality:['hp','hpRecovery','defense','damageReduction'],arcana:['magicAttack','resourceEfficiency','skillDamage','magicPenetration'],focus:['mpRecovery','critRate','manaCostReduction','accuracy'],elements:['elementalDamage','magicDefense','skillDamage','magicAttack'],fortune:['expGain','goldDropRate','itemDropRate'],guardian:['blockRate','parryRate','damageReduction'],shadows:['evasion','critRate','critDamage','attackSpeed'],
};
export const RUNE_QUALITY_ORDER: RuneRarity[] = ['cracked','simple','refined','rare','epic','legendary','ancient'];
export const RUNE_OPTIMIZER_TIER_RULES: Record<RuneOptimizerTier,{label:string;goldCost:number;rarity:ItemRarity;templateId:string}> = {
 basic:{label:'Basic Rune Optimizer',goldCost:250,rarity:'common',templateId:'rune-optimizer-basic'},
 chromatic:{label:'Chromatic Rune Optimizer',goldCost:1200,rarity:'legendary',templateId:'rune-optimizer-chromatic'},
 greaterChromatic:{label:'Greater Chromatic Rune Optimizer',goldCost:2500,rarity:'mythic',templateId:'rune-optimizer-greater-chromatic'},
 perfectChromatic:{label:'Perfect Chromatic Rune Optimizer',goldCost:5000,rarity:'ancient',templateId:'rune-optimizer-perfect-chromatic'},
};
/** Load-time conversion only; colored copies become one Basic each, preserving quantities. */
export const LEGACY_OPTIMIZER_MIGRATION: Readonly<Record<string,string>> = Object.freeze({
 'rune-optimizer-refined':'rune-stabilizer',
 'rune-optimizer-rare':'rune-optimizer-chromatic',
 'rune-optimizer-epic':'rune-optimizer-greater-chromatic',
 'rune-optimizer-legendary':'rune-optimizer-perfect-chromatic',
 'rune-optimizer-grey':'rune-optimizer-basic','rune-optimizer-red':'rune-optimizer-basic',
 'rune-optimizer-magenta':'rune-optimizer-basic','rune-optimizer-yellow':'rune-optimizer-basic',
 'rune-optimizer-blue-arcana':'rune-optimizer-basic','rune-optimizer-blue-vitality':'rune-optimizer-basic',
});

/**
 * A few very old saves stored the optimizer only as an itemType/name and did
 * not persist a template id or tier.  It is safe to recover those items as a
 * Basic optimizer: this preserves the owned quantity while avoiding a silent
 * premium upgrade.  This applies to optimizers only; unknown socket Runes are
 * deliberately left untouched for the player to inspect.
 */
const isLegacyGenericOptimizer = (value: Record<string, unknown>, templateId: string) =>
  value.itemType === 'runeOptimizer' &&
  !ITEM_CATALOG[templateId]?.optimizerTier &&
  (typeof value.optimizerTier !== 'string' ||
    !Object.hasOwn(RUNE_OPTIMIZER_TIER_RULES, value.optimizerTier));

export const RUNE_REFORGE_WEIGHTS = {
 chromatic:{downgrade:45,same:45,upgrade:10},
 greaterChromatic:{downgrade:25,same:55,upgrade:20},
 perfectChromatic:{downgrade:10,same:60,upgrade:30},
} as const;
/** Each extra quality step has one fifth of the previous step's weight. */
export const RUNE_REFORGE_STEP_WEIGHT = 0.2;
export const RUNE_STABILIZER_RULE = 'clamp-to-current-quality' as const;
export const RUNE_REMOVAL_GOLD_COST = 250;
export const MYTHIC_EQUIPMENT_EFFECTS=['Serangan memiliki peluang memulihkan 2% HP.','Skill ultimate memperoleh 5% damage tambahan.','Serangan kritis memulihkan sedikit Mana.'];

/** Rare, hidden equipment stats revealed by Arcane Magnifier. These are kept
 * separate from Rune affixes so the Rune Optimizer cannot reroll
 * them and the Character/combat calculator can keep one source of truth. */
export type UniqueStatDefinition = {
  stat: keyof StatBlock;
  label: string;
  unit: 'flat' | 'percent';
  min: number;
  max: number;
  slots: Array<'weapon' | 'shield' | 'armor' | 'accessory'>;
};
export const UNIQUE_STAT_POOL: UniqueStatDefinition[] = [
  { stat: 'attackPercent', label: 'Attack Power', unit: 'percent', min: 3, max: 8, slots: ['weapon'] },
  { stat: 'critDamage', label: 'Critical Damage', unit: 'percent', min: 4, max: 10, slots: ['weapon', 'accessory'] },
  { stat: 'bossDamage', label: 'Damage terhadap Boss', unit: 'percent', min: 2, max: 6, slots: ['weapon', 'accessory'] },
  { stat: 'skillDamage', label: 'Skill Damage', unit: 'percent', min: 2, max: 6, slots: ['weapon', 'accessory'] },
  { stat: 'hp', label: 'Max HP', unit: 'flat', min: 35, max: 120, slots: ['shield', 'armor', 'accessory'] },
  { stat: 'defense', label: 'Defense', unit: 'flat', min: 4, max: 14, slots: ['shield', 'armor'] },
  { stat: 'damageReduction', label: 'Damage Reduction', unit: 'percent', min: 1, max: 4, slots: ['shield', 'armor'] },
  { stat: 'blockRate', label: 'Block Rate', unit: 'percent', min: 1, max: 4, slots: ['shield'] },
  { stat: 'critRate', label: 'Critical Rate', unit: 'percent', min: 1, max: 3, slots: ['accessory'] },
  { stat: 'maxMana', label: 'Max MP', unit: 'flat', min: 10, max: 35, slots: ['accessory'] },
  { stat: 'cooldownReduction', label: 'Cooldown Reduction', unit: 'percent', min: 1, max: 3, slots: ['accessory'] },
  { stat: 'itemDropRate', label: 'Item Drop Rate', unit: 'percent', min: 1, max: 3, slots: ['accessory'] },
];
const uniqueStatKind = (item: Pick<ItemData, 'category' | 'itemType'>): 'weapon' | 'shield' | 'armor' | 'accessory' | null =>
  item.category === 'weapon' ? 'weapon' : item.itemType === 'shield' ? 'shield' : item.category === 'armor' ? 'armor' : item.category === 'accessory' ? 'accessory' : null;
export const rollUniqueStats = (item: Pick<ItemData, 'category' | 'itemType' | 'rarity'>, rng = Math.random): StatBlock => {
  const kind = uniqueStatKind(item);
  if (!kind) return {};
  const rarity = canonicalEquipmentRarity(item.rarity);
  const quality = rarity === 'mythic' || rarity === 'ancient' ? 1.2 : rarity === 'legendary' ? 1 : .8;
  const pool = UNIQUE_STAT_POOL.filter(definition => definition.slots.includes(kind));
  if (!pool.length) return {};
  const definition = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(.999999, rng())) * pool.length))];
  const value = randomBetween(definition.min * quality, definition.max * quality, rng);
  return { [definition.stat]: value };
};
export const isUniqueStatDropEligible = (source: ItemSource, rarity: ItemRarity) =>
  ['field_boss', 'high_boss', 'world_boss', 'quest'].includes(source.type) &&
  ['legendary', 'mythic', 'ancient', 'legacy'].includes(rarity);

const STAT_LABELS: Partial<Record<keyof StatBlock,string>> = {
  "attackPercent": "Attack Power",
  "physicalDamage": "Physical Damage",
  "str": "Strength",
  "vit": "Vitality",
  "magicAttack": "Magic Attack",
  "critRate": "Critical Rate",
  "critDamage": "Critical Damage",
  "attackSpeed": "Attack Speed",
  "accuracy": "Accuracy",
  "weakPointDamage": "Weak Point Damage",
  "skillDamage": "Skill Damage",
  "bossDamage": "Damage terhadap Boss",
  "eliteDamage": "Damage terhadap Elite",
  "hp": "Max HP",
  "defense": "Defense",
  "magicDefense": "Magic Defense",
  "damageReduction": "Damage Reduction",
  "blockRate": "Block Rate",
  "parryRate": "Parry Rate",
  "hpRecovery": "HP Recovery",
  "evasion": "Evasion",
  "movementSpeed": "Movement Speed",
  "resourceEfficiency": "Resource Efficiency",
  "cooldownReduction": "Cooldown Reduction",
  "expGain": "EXP Gain",
  "goldDropRate": "GOLD Drop Rate",
  "itemDropRate": "Item Drop Rate",
  "materialDropRate": "Material Drop Rate",
  "elementalDamage": "Elemental Damage",
  "physicalPenetration": "Physical Penetration",
  "magicPenetration": "Magic Penetration",
  "maxMana": "Max MP",
  "mpRecovery": "MP Recovery",
  "manaCostReduction": "Mana Cost Reduction"
};
const FLAT_STATS = new Set<keyof StatBlock>(['str','vit','dex','int','attack','defense','magicDefense','hp','stamina','magicAttack','maxMana','hpRecovery','mpRecovery']);
const randomBetween=(min:number,max:number,rng:()=>number)=>Math.round((min+(max-min)*rng())*10)/10;
export const canonicalEquipmentRarity=(rarity:ItemRarity):EquipmentRarity=>rarity==='normal'?'common':rarity==='unique'?'epic':rarity==='legacy'?'mythic':rarity as EquipmentRarity;


export function rollEquipmentSockets(source:ItemSource,rng=Math.random):EquipmentSocket[] {
 const chances=source.type==='world_boss'?{one:.18,two:.05}:source.type==='high_boss'?{one:.12,two:.03}:source.type==='field_boss'?{one:.08,two:.015}:null;
 if(!chances)return [];
 const two=rng()<chances.two;if(two)return [{id:'socket-1',rune:null},{id:'socket-2',rune:null}];
 return rng()<chances.one?[{id:'socket-1',rune:null}]:[];
}

export function affixStats(affixes:ItemAffix[]):StatBlock {const result:StatBlock={};for(const affix of affixes)result[affix.stat]=(result[affix.stat]??0)+affix.value;return result;}

// Audited obsolete materials. This is migration metadata, not a drop/shop catalog.
export const RETIRED_NORMAL_MATERIALS: Readonly<Record<string,string>> = Object.freeze({
  'enhancement-dust': "Blacksmith's Dust",
  'ore-fragment': 'Ore Fragment',
  herbal: 'Wildwood Herb',
  'poison-material': 'Venom Resin',
  'frost-core': 'Frost Core',
  'ancient-relic': 'Ancient Relic',
  'water-core': 'Water Core',
  'meteor-fragment': 'Meteor Fragment',
});

export function isRetiredNormalMaterial(item:ItemData):boolean {
  return Object.hasOwn(RETIRED_NORMAL_MATERIALS,item.templateId)
    && item.rarity==='normal' && item.category==='material'
    && !item.isQuestItem && !item.isSoulbound && !item.isLocked
    && !item.equipSlot && !item.weaponType && !item.equipmentType
    && !item.mainHand && !item.offHand && !item.useEffect && !item.usableFromHotbar
    && !item.petPassive && !item.uniqueEffect && !item.runeTheme && !item.optimizerTier
    && item.affixes.length===0 && item.sockets.length===0
    && !Object.values(item.baseStats).some(Boolean) && !Object.values(item.bonusStats).some(Boolean)
    && Object.keys(item.skillModifiers).length===0;
}

function legacyRetiredMaterial(templateId:string,id?:string):ItemData {
  return {...base({templateId,name:RETIRED_NORMAL_MATERIALS[templateId],category:'material',itemType:'enhancementMaterial',icon:'◆',stackable:true,maxStack:99,sellValue:templateId==='enhancement-dust'?3:8,description:'Material lama tanpa fungsi gameplay; tidak lagi tersedia sebagai drop.'}),id:id??uniqueItemId(),quantity:1};
}

export const ITEM_CATALOG: Record<string, Omit<ItemData, 'id' | 'quantity'>> = {
  'lumut-fiber': base({
    templateId: 'lumut-fiber',
    name: 'Arunika Moss Fiber',
    category: 'material',
    itemType: 'craftingMaterial',
    icon: '❖',
    stackable: true,
    maxStack: 99,
    sellValue: 4,
    description: 'Material crafting dari Lumut Liar.',
  }),
  'fate-rune-fragment': base({
    templateId: 'fate-rune-fragment',
    name: 'Fate Rune Fragment',
    category: 'rune',
    itemType: 'fateRune',
    icon: '◈',
    rarity: 'unique',
    stackable: true,
    maxStack: 20,
    sellValue: 35,
    description: 'Meningkatkan peluang enhancement sebesar 8% saat dipakai.',
  }),
  'eternal-seal': base({
    templateId: 'eternal-seal',
    name: 'Eternal Seal: Duskroot',
    category: 'rune',
    itemType: 'eternalSeal',
    icon: '⬡',
    rarity: 'legendary',
    stackable: true,
    maxStack: 10,
    sellValue: 250,
    description: 'Pelindung enhancement, bukan Rune untuk socket. Jika diaktifkan di panel Forge, mencegah equipment hancur atau turun enhancement saat tempa gagal. Satu seal hanya terpakai ketika gagal; tidak terpakai ketika berhasil dan tidak menambah peluang sukses.',
    isSoulbound: true,
  }),
  'legacy-fajar-blade': base({
    templateId: 'legacy-fajar-blade',
    name: 'Dawnblade',
    category: 'weapon',
    itemType: 'sword',
    icon: '⚔',
    rarity: 'legacy',
    levelRequirement: 1,
    weaponType: 'sword_dagger',
    mainHand: true,
    equipSlot: 'mainHand',
    baseStats: { attack: 8 },
    description: 'Senjata lama yang tetap kompatibel dengan save sebelumnya.',
    isSoulbound: true,
  }),
  'guntur-knuckle': base({
    templateId: 'guntur-knuckle',
    name: 'Thunder Knuckle',
    category: 'weapon',
    itemType: 'twoHandedKnuckle',
    icon: '✹',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'knuckle',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'warrior',
    requiredSpecialJob: 'gatotkaca',
    baseStats: { attack: 22, str: 3 },
    description: '2H Knuckle untuk bruiser Gatotkaca.',
  }),
  'garda-mace': base({
    templateId: 'garda-mace',
    name: 'Gatewarden Mace',
    category: 'weapon',
    itemType: 'mace',
    icon: '⚒',
    rarity: 'rare',
    levelRequirement: 10,
    weaponType: 'mace',
    mainHand: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'warrior',
    requiredSpecialJob: 'garda',
    baseStats: { attack: 18, sta: 2, blockRate: 2 },
    description: 'Gada untuk Garda.',
  }),
  'garda-shield': base({
    templateId: 'garda-shield',
    name: 'Nusantara Aegis',
    category: 'armor',
    itemType: 'shield',
    icon: '◉',
    rarity: 'unique',
    levelRequirement: 10,
    offHand: true,
    equipSlot: 'offHand',
    requiredCoreJob: 'warrior',
    requiredSpecialJob: 'garda',
    baseStats: { defense: 14, blockRate: 8, sta: 2 },
    description: 'Shield Garda dengan block kuat.',
  }),
  'caroq-daggers': base({
    templateId: 'caroq-daggers',
    name: 'Caroq Twin Blades',
    category: 'weapon',
    itemType: 'dualDagger',
    icon: '✣',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'dual_dagger',
    mainHand: true,
    offHand: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'rogue',
    requiredSpecialJob: 'caroq',
    baseStats: { attack: 17, dex: 4, critRate: 3, attackSpeed: 2 },
    description: 'Dual Dagger berkecepatan tinggi.',
  }),
  'anom-sword': base({
    templateId: 'anom-sword',
    name: 'Silent Markblade',
    category: 'weapon',
    itemType: 'oneHandSword',
    icon: '⚔',
    rarity: 'rare',
    levelRequirement: 10,
    weaponType: 'sword_dagger',
    mainHand: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'rogue',
    requiredSpecialJob: 'anom',
    baseStats: { attack: 20, dex: 2, critDamage: 5 },
    description: 'Main-hand Anom untuk serangan eksekusi.',
  }),
  'anom-dagger': base({
    templateId: 'anom-dagger',
    name: 'Veilless Shadow Dagger',
    category: 'weapon',
    itemType: 'dagger',
    equipmentType: 'off_hand_dagger',
    handedness: 'off_hand',
    attackType: 'melee',
    allowedJobs: ['rogue'],
    icon: '⌁',
    rarity: 'rare',
    levelRequirement: 10,
    weaponType: 'sword_dagger',
    offHand: true,
    equipSlot: 'offHand',
    requiredCoreJob: 'rogue',
    requiredSpecialJob: 'anom',
    baseStats: { attack: 11, dex: 3, critRate: 4 },
    description: 'Off-hand dagger Anom.',
  }),
  'srikandi-bow': base({
    templateId: 'srikandi-bow',
    name: "Srikandi's Eagleeye Bow",
    category: 'weapon',
    itemType: 'bow',
    icon: '⌒',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'bow',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'hunter',
    requiredSpecialJob: 'srikandi',
    baseStats: { attack: 21, dex: 4, critRate: 4, attackSpeed: 1 },
    description: 'Bow presisi untuk weak point.',
  }),
  'jagawana-bow': base({
    templateId: 'jagawana-bow',
    name: 'Wildsnare Bow',
    category: 'weapon',
    itemType: 'bowTrap',
    icon: '⌁',
    rarity: 'rare',
    levelRequirement: 10,
    weaponType: 'bow_trap',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'hunter',
    requiredSpecialJob: 'jagawana',
    baseStats: { attack: 18, dex: 3, skillPower: 3 },
    skillModifiers: { 'jagawana-3': 0.2 },
    description: 'Bow dan trap untuk kontrol area.',
  }),
  'resi-staff': base({
    templateId: 'resi-staff',
    name: 'Fivefold Element Staff',
    category: 'weapon',
    itemType: 'staff',
    icon: '☄',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'staff',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'wizard',
    requiredSpecialJob: 'resi',
    baseStats: { attack: 20, int: 5, skillPower: 5 },
    description: 'Staff elemental Resi.',
  }),
  'pujangga-wand': base({
    templateId: 'pujangga-wand',
    name: 'Hexscript Wand',
    category: 'weapon',
    itemType: 'wand',
    icon: '☽',
    rarity: 'rare',
    levelRequirement: 10,
    weaponType: 'wand',
    mainHand: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'wizard',
    requiredSpecialJob: 'pujangga',
    baseStats: { attack: 15, int: 4, skillPower: 7 },
    description: 'Wand untuk curse dan debuff.',
  }),
  'pandita-relic': base({
    templateId: 'pandita-relic',
    name: 'Relic of Compassion',
    category: 'weapon',
    itemType: 'relic',
    icon: '✧',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'relic',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'acolyte',
    requiredSpecialJob: 'pandita',
    baseStats: { attack: 15, int: 4, healingPower: 12, skillPower: 3 },
    description: 'Relic untuk heal dan barrier.',
  }),
  'bajra-knuckle': base({
    templateId: 'bajra-knuckle',
    name: 'Bajra Sanctfist',
    category: 'weapon',
    itemType: 'holyKnuckle',
    icon: '✹',
    rarity: 'unique',
    levelRequirement: 10,
    weaponType: 'holy_knuckle',
    mainHand: true,
    twoHanded: true,
    equipSlot: 'mainHand',
    requiredCoreJob: 'acolyte',
    requiredSpecialJob: 'bajra',
    baseStats: { attack: 22, str: 3, healingPower: 4 },
    description: 'Holy Knuckle untuk holy melee.',
  }),
  'forest-vest': base({
    templateId: 'forest-vest',
    name: 'Wildwarden Vest',
    category: 'armor',
    itemType: 'chest',
    icon: '▣',
    rarity: 'rare',
    levelRequirement: 1,
    equipSlot: 'chest',
    baseStats: { defense: 10, dex: 2, evasion: 2 },
    description: 'Armor ringan untuk penjaga lapangan.',
  }),
  'fajar-necklace': base({
    templateId: 'fajar-necklace',
    name: 'Dawnfire Necklace',
    category: 'accessory',
    itemType: 'necklace',
    icon: '◇',
    rarity: 'unique',
    levelRequirement: 1,
    equipSlot: 'necklace',
    baseStats: { hp: 24, critRate: 1, healingPower: 2 },
    description: 'Aksesori cahaya yang seimbang.',
  }),
  'adventurer-pet-egg': base({
    templateId: 'adventurer-pet-egg',
    name: 'Arunika Fawn Egg',
    category: 'pet',
    itemType: 'petEgg',
    icon: '🥚',
    rarity: 'rare',
    levelRequirement: 1,
    equipSlot: 'pet',
    petPassive: 'Menambah 2% movement speed.',
    baseStats: { movementSpeed: 2, evasion: 1 },
    description: 'Pet egg. Equip pada Pet Slot.',
  }),
};

const runeNames:Record<RuneTheme,string>={might:'Might',precision:'Precision',swiftness:'Swiftness',vitality:'Vitality',arcana:'Arcana',focus:'Focus',elements:'Elements',fortune:'Fortune',guardian:'the Guardian',shadows:'Shadows'};
for(const theme of Object.keys(runeNames) as RuneTheme[]){
 const templateId=`rune-${theme}`;
 ITEM_CATALOG[templateId]=base({templateId,name:`Rune of ${runeNames[theme]}`,category:'rune',itemType:'socketRune',icon:'◉',rarity:'rare',stackable:false,maxStack:1,sellValue:45,runeRarity:'simple',runeTheme:theme,runeSource:'Monster field, elite, dan boss.',description:`Rune ${runeNames[theme]} untuk socket equipment.`});
}

for(const [tier,rule] of Object.entries(RUNE_OPTIMIZER_TIER_RULES)){
 ITEM_CATALOG[rule.templateId]=base({templateId:rule.templateId,name:rule.label,category:'rune',itemType:'runeOptimizer',icon:'✣',rarity:rule.rarity,stackable:true,maxStack:99,buyValue:0,sellValue:Math.round(rule.goldCost*.2),optimizerTier:tier as RuneOptimizerTier,source:{type:tier==='basic'?'monster':'field_boss',sourceId:null,label:tier==='basic'?'Monster field dan crafting Forge Master':'Field Boss atau crafting material langka'}});
}
ITEM_CATALOG['rune-stabilizer']=base({templateId:'rune-stabilizer',name:'Rune Stabilizer',category:'rune',itemType:'runeStabilizer',icon:'✧',rarity:'rare',stackable:true,maxStack:99,sellValue:80,source:{type:'elite',sourceId:null,label:'Elite, Field Boss atau crafting Forge Master'},description:'Pelindung quality Rune untuk Chromatic, Greater Chromatic, atau Perfect Chromatic. Hasil di bawah quality saat ini menjadi quality yang sama. Aktifkan di Forge Master. Terpakai 1 bersama optimizer saat roll dikonfirmasi; tidak menjamin upgrade.'});
ITEM_CATALOG['gold-of-midas']=base({templateId:'gold-of-midas',name:'Gold of Midas',category:'material',itemType:'developerMaterial',icon:'✦',rarity:'legendary',stackable:true,maxStack:99,buyValue:0,sellValue:999999999,description:'A touch of gold that transforms everything into fortune. A symbol of ambition, prosperity, and limitless power.',source:{type:'shop',sourceId:'aruna-developer-materials',label:'Developer Material Lab'}});

const uniqueBossRunes:Array<{id:string;name:string;theme:RuneTheme;source:string;job:CoreJobId|null;effect:string}>=[
 {id:'rune-inti-bara',name:'Embercore Rune',theme:'elements',source:'Twin Elemental Lord · Dataran Bara-Beku',job:null,effect:'Serangan api memiliki peluang meninggalkan bara.'},
 {id:'rune-akar-purba',name:'Primordial Root Rune',theme:'vitality',source:'Ancient Treant · Padang Arunika',job:null,effect:'Pemulihan HP meningkat saat HP rendah.'},
 {id:'rune-bayangan-caroq',name:'Caroq Shadow Rune',theme:'shadows',source:'Field Boss Rimba Bisik',job:'rogue',effect:'Sinergi maksimum untuk Rogue dan serangan dari bayangan.'},
 {id:'rune-penjaga-langit',name:'Skywarden Rune',theme:'guardian',source:'Field Boss Tambang Selubung Besi',job:'warrior',effect:'Perfect guard memperkuat pertahanan singkat.'},
 {id:'rune-mata-jayantara',name:"Jayantara's Eye Rune",theme:'arcana',source:'Field Boss Reruntuhan Tenggelam',job:'wizard',effect:'Skill elemental memperoleh penetrasi ringan.'},
 {id:'rune-raja-meteor',name:'Meteor King Rune',theme:'might',source:'Meteorfall Overlord · Benteng Hujan Meteor',job:null,effect:'Peluang mengabaikan sebagian defense boss.'},
];
for(const rune of uniqueBossRunes)ITEM_CATALOG[rune.id]=base({templateId:rune.id,name:rune.name,category:'rune',itemType:'socketRune',icon:'✺',rarity:'mythic',stackable:false,maxStack:1,sellValue:900,runeRarity:'ancient',runeQualityFixed:true,runeTheme:rune.theme,runeSource:rune.source,runeJobRequirement:rune.job,uniqueEffect:rune.effect,source:{type:'field_boss',sourceId:null,label:rune.source},description:`Rune unik Field Boss. Sumber: ${rune.source}.`});

for (const [slot, name] of Object.entries({
  head: 'Arunika Dawn Circlet',
  gloves: 'Bronzegrip Gauntlets',
  legs: 'Woven Trailguards',
  boots: 'Wildwood Striders',
  ring1: 'Dawnfire Ring',
  ring2: 'Duskveil Ring',
  earring1: 'Suncrest Earring',
  earring2: 'Moonveil Earring',
})) {
  const templateId = `arunika-${slot}`;
  ITEM_CATALOG[templateId] = base({
    templateId,
    name,
    category: slot.startsWith('ring') || slot.startsWith('earring') ? 'accessory' : 'armor',
    itemType: slot,
    equipSlot: slot as EquipSlot,
    rarity: 'rare',
    icon: slot.startsWith('ring') ? '◌' : slot.startsWith('earring') ? '◐' : slot === 'head' ? '⌃' : slot === 'gloves' ? '✋' : slot === 'boots' ? '◒' : '▥',
    baseStats: { defense: 3, hp: 8 },
    bonusStats: { sta: 1 },
  });
}

for (const [id,name] of Object.entries({iron:'Iron',titanium:'Titanium',vibranium:'Vibranium','meteorite-core':'Meteorite Core'})) {
  ITEM_CATALOG[id]=base({templateId:id,name,category:'material',itemType:'enhancementMaterial',stackable:true,maxStack:99,icon:'◆',buyValue:40,sellValue:8,rarity:id==='meteorite-core'?'legendary':id==='vibranium'?'unique':'normal',description:`Material ${name} dari field Chapter 1.`});
}
ITEM_CATALOG['rice-meal']=base({templateId:'rice-meal',name:'Blessed Rice Meal',category:'consumable',itemType:'food',stackable:true,maxStack:20,buyValue:30,icon:'◉',description:'Memulihkan stamina sepenuhnya.',usableFromHotbar:true,useEffect:{type:'stamina'},useCooldown:8});
ITEM_CATALOG.magnifier=base({templateId:'magnifier',name:'Arcane Magnifier',category:'consumable',itemType:'magnifier',stackable:true,maxStack:99,icon:'⌕',description:'Mengungkap Unique Stats equipment yang masih terkunci.',isSellable:false});
export const POTION_TIERS = [
  {tier:1,roman:'I',restore:30,manaPrice:25,healthPrice:20},
  {tier:2,roman:'II',restore:60,manaPrice:50,healthPrice:40},
  {tier:3,roman:'III',restore:100,manaPrice:75,healthPrice:60},
] as const;
export const POTION_IDS: string[] = [];
for (const type of ['mana','health'] as const) for (const config of POTION_TIERS) {
  const templateId=`${type}-potion-${config.tier}`;
  const price=type==='mana'?config.manaPrice:config.healthPrice;
  POTION_IDS.push(templateId);
  ITEM_CATALOG[templateId]=base({templateId,name:`${type==='mana'?'Mana':'Health'} Potion ${config.roman}`,category:'potion',itemType:type==='mana'?'manaPotion':'potion',potionType:type,tier:config.tier,restoreType:'percentage',restoreValue:config.restore,description:`Memulihkan ${config.restore}% ${type==='mana'?'Max Mana':'Max HP'}. Cooldown bersama semua tier ${type==='mana'?'Mana':'Health'} Potion: 3 detik.`,stackable:true,maxStack:20,icon:type==='mana'?'🔷':'♥',buyValue:price,sellValue:price*.4,isSellable:true,isQuestItem:false,isSoulbound:false,usableFromHotbar:true,useCooldown:3,useEffect:{type:type==='mana'?'mana':'heal',percentage:config.restore}});
}
ITEM_CATALOG['arrows']=base({templateId:'arrows',name:'Hunter Arrows',category:'consumable',itemType:'ammunition',stackable:true,maxStack:99,icon:'➶',buyValue:12,description:'Pilih amunisi untuk Bow. Anak panah dikurangi saat menyerang, bukan saat dipilih.',usableFromHotbar:true,useEffect:{type:'ammunition'}});

// Named equipment with a fixed rarity, including old saves and random loot rolls.
/** Training weapons are deliberately Common in every acquisition path. */
const FIXED_ITEM_RARITIES: Readonly<Partial<Record<string, ItemRarity>>> = {
  'field-verdant-plains-sword': 'common',
  'field-verdant-plains-dagger': 'common',
  'field-verdant-plains-staff': 'common',
  'field-verdant-plains-bow': 'common',
  'field-verdant-plains-mace': 'common',
  'field-meteorfall-citadel-sword': 'legacy',
};

const fieldWeaponSets: Record<string, {prefix:string;level:number}> = {
 'verdant-plains':{prefix:'Training',level:1}, 'ironveil-mines':{prefix:'Iron',level:8}, 'whispering-wilds':{prefix:'Wildwood',level:16},
 'frostfire-highlands':{prefix:'Frostfire',level:24}, 'sunken-ruins':{prefix:'Ruin',level:32}, 'meteorfall-citadel':{prefix:'Meteor',level:42},
};
for (const [field, set] of Object.entries(fieldWeaponSets)) {
  for (const weapon of [
    {id:'sword',label:'Sword',type:'sword_dagger' as WeaponType,equipmentType:'one_hand_sword' as EquipmentType,icon:'🗡️',jobs:['warrior','rogue'] as CoreJobId[]},
    {id:'dagger',label:'Dagger',type:'sword_dagger' as WeaponType,equipmentType:'dagger' as EquipmentType,icon:'✦',jobs:['rogue'] as CoreJobId[]},
    {id:'staff',label:'Staff',type:'staff' as WeaponType,equipmentType:'staff' as EquipmentType,icon:'🪄',jobs:['wizard','acolyte'] as CoreJobId[]},
    {id:'bow',label:'Bow',type:'bow' as WeaponType,equipmentType:'bow' as EquipmentType,icon:'🏹',jobs:['hunter'] as CoreJobId[]},
    {id:'mace',label:'Mace',type:'mace' as WeaponType,equipmentType:'mace' as EquipmentType,icon:'🔨',jobs:['warrior','acolyte'] as CoreJobId[]},
  ]) {
    const templateId=`field-${field}-${weapon.id}`;
    ITEM_CATALOG[templateId]=base({templateId,name:`${set.prefix} ${weapon.label}`,category:'weapon',itemType:weapon.id,equipmentType:weapon.equipmentType,icon:weapon.icon,levelRequirement:set.level,weaponType:weapon.type,mainHand:true,twoHanded:weapon.id==='bow'||weapon.id==='staff',handedness:weapon.id==='bow'||weapon.id==='staff'?'two_hand':'one_hand',attackType:weapon.id==='bow'?'ranged':weapon.id==='staff'?'magic':weapon.id==='mace'?'hybrid':'melee',allowedJobs:weapon.jobs,equipSlot:'mainHand',rarity:'common',buyValue:80+set.level*18,sellValue:20+set.level*4,baseStats:{attack:8+Math.floor(set.level*.8)},description:`Senjata basic Common untuk field ${field}.`});
  }
}

for (const [templateId, rarity] of Object.entries(FIXED_ITEM_RARITIES)) {
  ITEM_CATALOG[templateId]!.rarity = rarity ?? 'common';
}

const OFF_HAND_TEMPLATES: Array<Partial<ItemData> & Pick<ItemData,'templateId'|'name'|'category'|'itemType'>> = [
  {templateId:'ironveil-shield',name:'Ironveil Shield',category:'armor',itemType:'shield',equipmentType:'shield',icon:'🛡️',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'none',allowedJobs:['warrior'],baseStats:{defense:12,blockRate:5},rarity:'rare',levelRequirement:8},
  {templateId:'whispering-offhand-dagger',name:'Wildside Dagger',category:'weapon',itemType:'offHandDagger',equipmentType:'off_hand_dagger',icon:'✧',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'melee',allowedJobs:['rogue'],baseStats:{attack:8,critRate:2},rarity:'rare',levelRequirement:16},
  {templateId:'arcana-tome',name:'Arcane Script Tome',category:'accessory',itemType:'tome',equipmentType:'tome',icon:'📖',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'magic',allowedJobs:['wizard'],baseStats:{skillPower:4},rarity:'rare',levelRequirement:16},
  {templateId:'resi-orb',name:'Fivefold Arcana Orb',category:'accessory',itemType:'orb',equipmentType:'orb',icon:'🔮',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'magic',allowedJobs:['wizard'],baseStats:{magicAttack:5},rarity:'epic',levelRequirement:24},
  {templateId:'hunter-quiver',name:"Srikandi's Quiver",category:'accessory',itemType:'quiver',equipmentType:'quiver',icon:'➶',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'ranged',allowedJobs:['hunter'],baseStats:{rangedDamage:4},rarity:'rare',levelRequirement:8},
  {templateId:'pujangga-talisman',name:'Pujangga Hex Talisman',category:'accessory',itemType:'talisman',equipmentType:'talisman',icon:'📜',equipSlot:'offHand',offHand:true,handedness:'off_hand',attackType:'magic',allowedJobs:['wizard','acolyte'],baseStats:{skillDamage:4},rarity:'epic',levelRequirement:24},
];
for (const template of OFF_HAND_TEMPLATES) ITEM_CATALOG[template.templateId]=base(template);
ITEM_CATALOG['jayantara-two-hand-sword']=base({templateId:'jayantara-two-hand-sword',name:'Jayantara Greatsword',category:'weapon',itemType:'twoHandSword',equipmentType:'two_hand_sword',icon:'⚔️',equipSlot:'mainHand',mainHand:true,twoHanded:true,handedness:'two_hand',attackType:'melee',allowedJobs:['warrior'],weaponType:'sword_shield',rarity:'epic',levelRequirement:24,baseStats:{attack:46,str:4},description:'Two-Hand Sword dengan damage besar yang menggunakan kedua tangan.'});

// Keep previous built-in copy only for save compatibility; the catalog remains
// the single source of descriptions used by inventory and newly created items.
const PREVIOUS_ITEM_DESCRIPTIONS = new Map(
  Object.values(ITEM_CATALOG).map(item => [item.templateId, item.description]),
);
const ITEM_USAGE_NOTES: Record<string, string> = {
  'lumut-fiber': 'Bahan evolusi pet. Pasang pet terlebih dahulu, lalu buka Character (C) → slot Pet → Evolusi. Setiap evolusi memakai 3 Arunika Moss Fiber dari satu stack dan menaikkan level pet satu tingkat, hingga level 10. Tidak digunakan langsung dari inventory.',
  iron: 'Bahan tempa untuk mencapai enhancement +1 sampai +3; membutuhkan 1 Iron per percobaan, termasuk jika gagal. Juga digunakan di Forge Master untuk membuat Basic Rune Optimizer: 3 Iron + 150 GOLD. Gunakan melalui menu tempa atau crafting, bukan tombol Use.',
  titanium: 'Bahan tempa untuk mencapai enhancement +4 sampai +6; membutuhkan 2 Titanium per percobaan, termasuk jika gagal. Juga digunakan di Forge Master untuk membuat Rune Stabilizer: 3 Titanium + 400 GOLD. Gunakan melalui menu tempa atau crafting, bukan tombol Use.',
  vibranium: 'Bahan tempa untuk mencapai enhancement +7 sampai +9; membutuhkan 3 Vibranium per percobaan, termasuk jika gagal. Juga digunakan di Forge Master untuk membuat Chromatic Rune Optimizer: 2 Vibranium + 900 GOLD. Gunakan melalui menu tempa atau crafting, bukan tombol Use.',
  'meteorite-core': 'Bahan tempa untuk mencapai enhancement +10 sampai +12; membutuhkan 4 Meteorite Core per percobaan, termasuk jika gagal. Di Forge Master, 1 Core + 2.000 GOLD membuat Greater Chromatic Rune Optimizer; 3 Core + 4.500 GOLD membuat Perfect Chromatic Rune Optimizer. Tidak digunakan langsung dari inventory.',
  'fate-rune-fragment': 'Bahan pendukung tempa, bukan Rune untuk socket. Jika tersedia di inventory, otomatis menambah peluang sukses enhancement sebesar 8 poin persentase, dengan peluang akhir maksimal 98%. Satu fragment terpakai setiap percobaan, baik berhasil maupun gagal. Periksa bonus pada preview sebelum konfirmasi; tidak melindungi item dari kegagalan.',
  'eternal-seal': 'Pelindung enhancement, bukan Rune untuk socket. Jika diaktifkan di panel Forge, mencegah equipment hancur atau turun enhancement saat tempa gagal. Satu seal hanya terpakai ketika gagal; tidak terpakai ketika berhasil dan tidak menambah peluang sukses.',
  magnifier: 'Mengungkap opsi Unique Stats yang masih tersembunyi pada equipment. Klik slot equipment di Character (C), buka Stats, requirements & sockets, lalu tekan Unlock. Membutuhkan 1 Arcane Magnifier dan equipment yang tidak dikunci. Tidak mengacak ulang nilai, menambah opsi, atau mengubah Rune; tidak digunakan langsung melalui tombol Use.',
  'rice-meal': STAMINA_ENABLED ? 'Memulihkan stamina hingga penuh. Gunakan 1 porsi melalui tombol Use di Inventory atau PrimaryHotbar. Cooldown 8 detik. Tidak terpakai jika stamina sudah penuh; tidak memulihkan HP atau Mana.' : 'Sistem stamina sedang dinonaktifkan. Makanan ini tetap tersimpan dan tidak terpakai saat digunakan. Tidak memulihkan HP atau Mana.',
  arrows: 'Amunisi untuk serangan dasar Bow. Gunakan dari Inventory atau PrimaryHotbar untuk memilih amunisi saat Bow terpasang; pemilihan tidak menghabiskan item. Setiap serangan dasar Bow memakai 1 anak panah dari inventory dan gagal jika amunisi habis. Bukan senjata dan tidak dipasang pada slot Off Hand.',
  'adventurer-pet-egg': 'Pasang pada slot Pet melalui Inventory atau slot Pet di Character (C) untuk mengaktifkan pet pendamping beserta bonus Movement Speed dan Evasion. Pet yang hanya disimpan di inventory tidak memberi bonus. Dapat berevolusi menggunakan 3 Arunika Moss Fiber per tahap melalui menu Pet, hingga level 10. Tidak menambah tombol skill aktif.',
};
const DESCRIPTION_SLOT_NAMES: Record<EquipSlot, string> = {
  mainHand:'Main Weapon', offHand:'Off Hand', head:'Head', chest:'Body Armor',
  gloves:'Gloves', legs:'Legs', boots:'Boots', necklace:'Necklace',
  ring1:'Ring 1 / Ring 2', ring2:'Ring 1 / Ring 2',
  earring1:'Earring 1 / Earring 2', earring2:'Earring 1 / Earring 2', pet:'Pet',
};
const usageStatLabel = (stat: keyof StatBlock) => STAT_LABELS[stat]
  ?? ({vit:'Vitality', sta:'Vitality', dex:'Dexterity', int:'Intelligence', attack:'Attack', skillPower:'Skill Power', rangedDamage:'Ranged Damage', healingPower:'Healing Power'} as Partial<Record<keyof StatBlock, string>>)[stat]
  ?? stat;

export function equipmentUsageDescription(item: Omit<ItemData, 'id' | 'quantity'>): string {
  const stats = Object.entries({...item.baseStats, ...item.bonusStats})
    .map(([stat, value]) => `${usageStatLabel(stat as keyof StatBlock)} +${Number(value).toFixed(1)}`)
    .join(' · ');
  const jobs = item.requiredSpecialJob ?? item.requiredCoreJob
    ?? (item.allowedJobs?.length ? item.allowedJobs.join(' / ') : 'Semua job');
  const type = item.equipmentType ?? item.weaponType ?? item.equipSlot ?? item.category;
  const slot = item.equipSlot ? DESCRIPTION_SLOT_NAMES[item.equipSlot] : 'Equipment';
  return [
    stats || 'Tanpa bonus stat',
    `Syarat: ${jobs}`,
    `Level: ${item.levelRequirement}`,
    `Jenis: ${type} · Slot: ${slot}`,
    `Harga jual: ${item.sellValue} GOLD`,
  ].join(' · ');
}

for (const item of Object.values(ITEM_CATALOG)) {
  if (['weapon', 'armor', 'accessory'].includes(item.category)) {
    item.description = equipmentUsageDescription(item);
  } else if (ITEM_USAGE_NOTES[item.templateId]) {
    item.description = ITEM_USAGE_NOTES[item.templateId];
  } else if (item.itemType === 'socketRune' && item.runeTheme) {
    item.description = [
      'Kunjungi NPC Forge Master di kota, buka Rune Forge, lalu Pasang Rune pada socket kosong. Rune berpindah dari inventory ke socket; bonus aktif ketika equipment dipakai.',
      `Opsi yang dapat muncul: ${RUNE_THEME_POOLS[item.runeTheme].map(usageStatLabel).join(', ')}. Jumlah dan kekuatan opsi mengikuti rarity Rune; hanya opsi yang tercantum pada item ini yang diberikan, bukan seluruh daftar.`,
      item.runeJobRequirement ? `Pemasangan khusus Core Job ${item.runeJobRequirement}.` : 'Tidak memiliki pembatasan Core Job untuk pemasangan.',
      'Lepas Rune memerlukan 250 GOLD dan ruang inventory; Rune dikembalikan utuh, tidak dihancurkan.',
      `Sumber: ${item.runeSource ?? item.source.label}`,
    ].join(' ');
  } else if (item.itemType === 'runeOptimizer' && item.optimizerTier) {
    item.description = [
      'Gunakan Reroll Rune di NPC Forge Master. Pilih equipment dan Rune terpasang yang tidak terkunci.',
      item.optimizerTier==='basic'?'Mengacak seluruh pilihan dan nilai stat sesuai tema Rune. Quality serta jumlah affix tetap.':'Mengacak quality, jumlah affix, pilihan dan nilai stat sesuai tema Rune. Quality dapat turun, tetap, atau naik; Ancient tidak dijamin. Rune boss dengan quality tetap tetap Ancient.',
      'Konfirmasi Roll memakai 1 optimizer dan GOLD. Hasil dapat diterima atau tetap memakai Rune lama; biaya tidak dikembalikan. Rune Stabilizer opsional melindungi quality pada Chromatic.',
      'Base stat, enhancement, socket, identitas Rune dan efek unik tetap utuh.',
    ].join(' ');
  } else if (['weapon','armor','accessory'].includes(item.category)
    && (item.description === 'Perlengkapan perjalanan Lumenfall.'
      || item.description.startsWith('Senjata basic Common untuk field ')
      || ['legacy-fajar-blade','forest-vest','fajar-necklace'].includes(item.templateId))) {
    item.description = equipmentUsageDescription(item);
  }
}

function normalizedItemDescription(templateId: string, saved: unknown, fallback: string): string {
  if(!STAMINA_ENABLED && templateId==='rice-meal')return fallback;
  if(typeof saved==='string' && ITEM_CATALOG[templateId]?.itemType==='socketRune' &&
    saved.startsWith('Pasang melalui socket kosong pada detail equipment di Inventory atau Character.'))return fallback;
  if(typeof saved==='string' && ITEM_CATALOG[templateId]?.itemType==='runeOptimizer' &&
    saved.startsWith('Gunakan pada panel Rune Optimizer dari detail equipment.'))return fallback;
  if(typeof saved==='string' && ['titanium','vibranium','meteorite-core'].includes(templateId) &&
    saved.startsWith('Bahan tempa untuk mencapai enhancement') && /(?:Refined|Rare|Epic|Legendary) Rune Optimizer/.test(saved))return fallback;
  if (typeof saved !== 'string' || !saved.trim()) return ITEM_CATALOG[templateId]
    || Object.hasOwn(RETIRED_NORMAL_MATERIALS, templateId) ? fallback
    : 'Item dari save lama. Informasi kegunaannya belum tersedia pada katalog saat ini.';
  if (ITEM_CATALOG[templateId] && (saved.trim() === 'Perlengkapan perjalanan Lumenfall.'
    || saved.trim() === PREVIOUS_ITEM_DESCRIPTIONS.get(templateId)
    || (templateId === 'eternal-seal' && saved.trim() === 'Mencegah destruction atau downgrade enhancement sekali.'))) return fallback;
  // Preserve custom descriptions, including unknown legacy items and quest copy.
  return saved;
}

let itemSequence = 0;
const uniqueItemId = () =>
  `${Date.now().toString(36)}-${++itemSequence}-${Math.random().toString(36).slice(2, 10)}`;
const runeItemRarity:Record<RuneRarity,ItemRarity>={cracked:'common',simple:'uncommon',refined:'uncommon',rare:'rare',epic:'epic',legendary:'legendary',ancient:'mythic'};
export function rollRuneAffixes(theme:RuneTheme,rarity:RuneRarity,rng=Math.random,exactCount?:number):ItemAffix[]{
 const rule=RUNE_RARITY_RULES[rarity];const pool=[...RUNE_THEME_POOLS[theme]];const count=exactCount ?? rule.minAffixes+Math.floor(rng()*(rule.maxAffixes-rule.minAffixes+1));const result:ItemAffix[]=[];
 while(result.length<count&&pool.length){const index=Math.floor(rng()*pool.length);const stat=pool.splice(index,1)[0];const flat=FLAT_STATS.has(stat);const baseMin=flat?(stat==='hp'?60:1):stat==='physicalDamage'?4.5:2;const baseMax=flat?(stat==='hp'?120:4):stat==='physicalDamage'?6.25:6;result.push({id:`rune-affix-${stat}-${result.length+1}`,stat,label:STAT_LABELS[stat]??String(stat),value:randomBetween(baseMin*rule.power,baseMax*rule.power,rng),unit:flat?'flat':'percent',quality:'normal',source:'rune',locked:false});}
 return result;
}

export function createRuneItem(theme:RuneTheme,rarity:RuneRarity='cracked',overrides:Partial<ItemData>={}):ItemData {
 const templateId=overrides.templateId??`rune-${theme}`;const template=ITEM_CATALOG[templateId]??ITEM_CATALOG[`rune-${theme}`];
 return createItem(template.templateId,{...overrides,name:overrides.name??template.name,icon:overrides.icon??template.icon,category:'rune',itemType:'socketRune',stackable:false,maxStack:1,rarity:overrides.rarity??runeItemRarity[rarity],runeRarity:rarity,runeTheme:theme,affixes:overrides.affixes??rollRuneAffixes(theme,rarity),sockets:[]});
}

export function createItem(
  templateId: string,
  overrides: Partial<ItemData> = {},
): ItemData {
  templateId=canonicalItemTemplateId(templateId);
  if(LEGACY_OPTIMIZER_MIGRATION[templateId])throw new Error('Optimizer lama hanya tersedia melalui migrasi save.');
  if(Object.hasOwn(RETIRED_NORMAL_MATERIALS,templateId))throw new Error(`Item tidak lagi tersedia: ${templateId}`);
  const template = ITEM_CATALOG[templateId] ?? ITEM_CATALOG['lumut-fiber'];
  const source=overrides.source??template.source;
  const rarity=FIXED_ITEM_RARITIES[templateId]??overrides.rarity??template.rarity;
  const equipment=['weapon','armor','accessory'].includes(overrides.category??template.category);
  const socketEligible=['epic','legendary','mythic','unique','legacy'].includes(rarity);
  const rolledSource=['monster','elite','field_boss','high_boss','world_boss','quest'].includes(source.type);
  const runeTheme=overrides.runeTheme??template.runeTheme,runeQuality=overrides.runeRarity??template.runeRarity;
  const affixes=equipment?[]:overrides.affixes??(template.itemType==='socketRune'&&runeTheme&&runeQuality?rollRuneAffixes(runeTheme,runeQuality):template.affixes.map(affix=>({...affix})));
  const sockets=overrides.sockets??(equipment&&socketEligible?rollEquipmentSockets(source):[]);
  const uniqueEffect=overrides.uniqueEffect??template.uniqueEffect??(equipment&&rolledSource&&canonicalEquipmentRarity(rarity)==='mythic'&&Math.random()<.2?MYTHIC_EQUIPMENT_EFFECTS[Math.floor(Math.random()*MYTHIC_EQUIPMENT_EFFECTS.length)]:null);
  const explicitUniqueStats = Object.hasOwn(overrides, 'uniqueStatsLocked') || Object.hasOwn(overrides, 'bonusStats');
  const shouldRollUniqueStats = equipment && !explicitUniqueStats && isUniqueStatDropEligible(source, rarity) && Math.random() < (canonicalEquipmentRarity(rarity) === 'mythic' || canonicalEquipmentRarity(rarity) === 'ancient' ? .7 : .3);
  const rolledUniqueStats = shouldRollUniqueStats ? rollUniqueStats({ category: overrides.category ?? template.category, itemType: overrides.itemType ?? template.itemType, rarity }, Math.random) : null;
  const bonusStats = { ...(overrides.bonusStats ?? template.bonusStats) };
  if (rolledUniqueStats) {
    for (const [stat, value] of Object.entries(rolledUniqueStats))
      bonusStats[stat as keyof StatBlock] = (bonusStats[stat as keyof StatBlock] ?? 0) + (value ?? 0);
  }
  const normalizedItem = migrateEquipmentOptions({
    ...template,
    id: overrides.id ?? `${templateId}-${uniqueItemId()}`,
    quantity: overrides.quantity ?? (template.stackable ? 1 : 1),
    ...overrides,
    rarity,
    source:{...source},
    affixes:affixes.map(affix=>({...affix})),
    sockets:sockets.map(socket=>({...socket,rune:socket.rune?{...socket.rune,affixes:socket.rune.affixes.map(affix=>({...affix}))}:null})),
    bonusStats,
    uniqueStatsLocked: shouldRollUniqueStats ? true : overrides.uniqueStatsLocked ?? template.uniqueStatsLocked ?? false,
    uniqueEffect,
  });
  if (equipment) normalizedItem.description = equipmentUsageDescription(normalizedItem);
  return normalizedItem;
}

function legacyCategory(raw: Record<string, unknown>): ItemCategory {
  if (raw.kind === 'weapon') return 'weapon';
  if (raw.kind === 'armor') return 'armor';
  if (raw.kind === 'rune' || raw.kind === 'seal') return 'rune';
  return 'material';
}

// Keep old save IDs and custom item data intact while refreshing canonical display names.
// Only the known legacy labels are replaced; generated/custom names remain untouched.
const LEGACY_ITEM_NAME_ALIASES: Record<string, string[]> = {
  'health-potion-1': ['Ramuan Cahaya'],
  'enhancement-dust': ['Debu Pandai Besi'],
  'lumut-fiber': ['Serat Lumut Arunika'],
  'fate-rune-fragment': ['Pecahan Fate Rune'],
  'eternal-seal': ['Eternal Seal: Akar Senja'],
  'legacy-fajar-blade': ['Pedang Fajar'],
  'guntur-knuckle': ['Knuckle Guntur'],
  'garda-mace': ['Gada Penjaga Gerbang'],
  'garda-shield': ['Tameng Nusantara'],
  'caroq-daggers': ['Sepasang Belati Caroq'],
  'anom-sword': ['Pedang Tanda Senyap'],
  'anom-dagger': ['Dagger Bayang Tanpa Jejak'],
  'srikandi-bow': ['Busur Mata Srikandi'],
  'jagawana-bow': ['Busur Jerat Rimba'],
  'resi-staff': ['Staff Lima Unsur'],
  'pujangga-wand': ['Wand Aksara Kutuk'],
  'pandita-relic': ['Relic Welas Asih'],
  'bajra-knuckle': ['Holy Knuckle Bajra'],
  'forest-vest': ['Rompi Penjaga Rimba'],
  'fajar-necklace': ['Kalung Fajar'],
  'adventurer-pet-egg': ['Telur Kancil Arunika'],
  'arunika-head': ['Ikat Kepala Arunika'],
  'arunika-gloves': ['Sarung Tangan Perunggu'],
  'arunika-legs': ['Celana Tenun'],
  'arunika-boots': ['Sepatu Rimba'],
  'arunika-ring1': ['Cincin Fajar'],
  'arunika-ring2': ['Cincin Senja'],
  'arunika-earring1': ['Anting Surya'],
  'arunika-earring2': ['Anting Rembulan'],
  'ironveil-shield': ['Perisai Selubung Besi'],
  'whispering-offhand-dagger': ['Belati Samping Rimba'],
  'arcana-tome': ['Tome Aksara'],
  'resi-orb': ['Orb Lima Unsur'],
  'hunter-quiver': ['Tabung Panah Srikandi'],
  'pujangga-talisman': ['Talisman Pujangga'],
  'rune-inti-bara': ['Rune Inti Bara'],
  'rune-akar-purba': ['Rune Akar Purba'],
  'rune-bayangan-caroq': ['Rune Bayangan Caroq'],
  'rune-penjaga-langit': ['Rune Penjaga Langit'],
  'rune-mata-jayantara': ['Rune Mata Jayantara'],
  'rune-raja-meteor': ['Rune Raja Meteor'],
  herbal: ['Herbal Rimba'],
  'poison-material': ['Getah Racun'],
};

export function normalizeItem(raw: unknown): ItemData | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = {...raw} as Record<string, unknown>;
  const legacyId=typeof value.templateId==='string'?value.templateId:typeof value.id==='string'?value.id:'';
  const conversion=LEGACY_OPTIMIZER_MIGRATION[legacyId];
  if(conversion){const current=ITEM_CATALOG[conversion];Object.assign(value,{templateId:conversion,name:current.name,description:current.description,category:current.category,rarity:current.rarity,itemType:current.itemType,optimizerTier:current.optimizerTier,stackable:true,maxStack:MAX_STACK_QUANTITY,icon:current.icon});}
  delete value.additionalOptions;delete value.equipmentOptions;delete value.optimizerOptions;delete value.optimizerFocus;
  if(value.runeQuality&&!value.runeRarity)value.runeRarity=value.runeQuality;
  if(value.runeAffixes&&!value.affixes)value.affixes=value.runeAffixes;
  delete value.runeQuality;delete value.runeAffixes;
  if(!value.optimizerHistory&&value.springHistory)value.optimizerHistory=value.springHistory;
  delete value.springHistory;
  if(typeof value.runeRarity==='string')value.runeRarity=value.runeRarity.toLowerCase();
  let templateId =
    typeof value.templateId === 'string'
      ? value.templateId
      : typeof value.id === 'string' && (ITEM_CATALOG[canonicalItemTemplateId(value.id)] || Object.hasOwn(RETIRED_NORMAL_MATERIALS,value.id))
        ? value.id
        : value.kind === 'rune'
          ? 'fate-rune-fragment'
          : value.kind === 'seal'
            ? 'eternal-seal'
            : value.kind === 'weapon'
              ? 'legacy-fajar-blade'
              : value.kind === 'armor'
                ? 'forest-vest'
                : `legacy-${typeof value.id === 'string' ? value.id : uniqueItemId()}`;
  templateId=canonicalItemTemplateId(templateId);
  if (isLegacyGenericOptimizer(value, templateId)) {
    templateId = 'rune-optimizer-basic';
    const current = ITEM_CATALOG[templateId];
    Object.assign(value, {
      name: current.name,
      description: current.description,
      category: current.category,
      itemType: current.itemType,
      rarity: current.rarity,
      optimizerTier: current.optimizerTier,
      stackable: true,
      maxStack: current.maxStack,
      icon: current.icon,
    });
  }
  if(ITEM_CATALOG[templateId]?.potionType&&typeof value.quantity==='number'&&value.quantity<=0)return null;
  const template = Object.hasOwn(RETIRED_NORMAL_MATERIALS,templateId) ? legacyRetiredMaterial(templateId,typeof value.id==='string'?value.id:undefined) : createItem(templateId, {
    id: typeof value.id === 'string' ? value.id : undefined,
    affixes: [],
  });
  const rawCategory = typeof value.category === 'string' ? value.category : '';
  const rarityText = typeof value.rarity === 'string' ? value.rarity : '';
  const rawRarity = /^unique(?:\s*\(?legacy\)?)?$/i.test(rarityText.trim()) ? 'unique' : rarityText;
  const normalizedCategory=template.potionType?'potion':(rawCategory&&['weapon','armor','accessory','pet','consumable','potion','material','rune','quest'].includes(rawCategory)?rawCategory as ItemCategory:ITEM_CATALOG[templateId]?.category??legacyCategory(value));
  const isEquipment=['weapon','armor','accessory'].includes(normalizedCategory);
  const rawEquipmentType=typeof value.equipmentType==='string'&&Object.values(EQUIPMENT_TYPE_ALIASES).includes(value.equipmentType as EquipmentType)?value.equipmentType as EquipmentType:null;
  const migratedEquipmentType=rawEquipmentType??template.equipmentType??inferEquipmentType({itemType:typeof value.itemType==='string'?value.itemType:template.itemType,equipSlot:typeof value.equipSlot==='string'?value.equipSlot as EquipSlot:template.equipSlot,category:normalizedCategory});
  const savedName = typeof value.name === 'string' ? value.name : null;
  const canonicalName = savedName && LEGACY_ITEM_NAME_ALIASES[templateId]?.includes(savedName)
    ? template.name
    : savedName ?? template.name;
  const normalizedStackable = ['weapon', 'armor', 'accessory', 'pet'].includes(
    rawCategory || legacyCategory(value),
  )
    ? false
    : typeof value.stackable === 'boolean'
      ? value.stackable
      : template.stackable;
  return migrateEquipmentOptions({
    ...template,
    ...value,
    id: typeof value.id === 'string' ? value.id : template.id,
    templateId,
    name: canonicalName,
    description: normalizedItemDescription(templateId, value.description, template.description),
    itemType: templateId === 'mana-potion-1' ? 'manaPotion' : template.itemType === 'runeOptimizer' ? 'runeOptimizer' : typeof value.itemType==='string' ? value.itemType : template.itemType,
    usableFromHotbar: typeof value.usableFromHotbar==='boolean' ? value.usableFromHotbar : template.usableFromHotbar,
    useEffect: template.useEffect ?? (value.useEffect && typeof value.useEffect==='object' && ['heal','mana','resource','stamina','buff','ammunition','mount'].includes(String((value.useEffect as ItemUseEffect).type)) ? value.useEffect as ItemUseEffect : undefined),
    useCooldown: Math.max(0,Math.min(3600,Number(value.useCooldown ?? template.useCooldown)||0)),
    category:normalizedCategory,
    equipmentType:migratedEquipmentType,
    handedness:['one_hand','two_hand','off_hand','none'].includes(String(value.handedness))?value.handedness as Handedness:inferHandedness(migratedEquipmentType,value.twoHanded===true||template.twoHanded),
    attackType:['melee','ranged','magic','hybrid','none'].includes(String(value.attackType))?value.attackType as AttackType:inferAttackType(migratedEquipmentType),
    allowedJobs:Array.isArray(value.allowedJobs)?value.allowedJobs.filter((entry):entry is CoreJobId=>['warrior','rogue','hunter','wizard','acolyte'].includes(String(entry))):template.allowedJobs??defaultAllowedJobs(migratedEquipmentType),
    asset:value.asset&&typeof value.asset==='object'?value.asset as EquipmentAsset:template.asset,
    rarity: FIXED_ITEM_RARITIES[templateId] ?? (
      rawRarity && Object.hasOwn(RARITY_META, rawRarity)
        ? (rawRarity==='normal'&&isEquipment?'common':rawRarity as ItemRarity)
        : rawRarity === 'epic'
          ? 'unique'
          : rawRarity === 'uncommon'
            ? 'rare'
            : isEquipment?'common':'normal'),
    stackable: normalizedStackable,
    maxStack: normalizedStackable ? MAX_STACK_QUANTITY : 1,
    quantity: Math.max(
      1,
      Math.floor(typeof value.quantity === 'number' ? value.quantity : 1),
    ),
    baseStats: normalizeStatBlock(value.baseStats),
    bonusStats: normalizeStatBlock(value.bonusStats),
    skillModifiers:
      typeof value.skillModifiers === 'object' && value.skillModifiers
        ? (value.skillModifiers as SkillModifierMap)
        : {},
    affixes:!isEquipment&&Array.isArray(value.affixes)?value.affixes.filter((entry):entry is ItemAffix=>Boolean(entry&&typeof entry==='object'&&typeof (entry as ItemAffix).stat==='string'&&typeof (entry as ItemAffix).value==='number')).map(entry=>({...entry,stat:(entry.stat==='sta'?'vit':entry.stat==='elementalResistance'?'magicDefense':entry.stat) as keyof StatBlock,quality:['minimum','low','normal','high','perfect'].includes(entry.quality??'')?entry.quality:'normal',source:['equipment','rune','runeOptimizer'].includes(entry.source??'')?entry.source:'equipment',locked:entry.locked===true})):[],
    sockets:Array.isArray(value.sockets)?value.sockets.slice(0,2).flatMap((entry,index)=>{if(!entry||typeof entry!=='object')return []; const socket=entry as EquipmentSocket;return [{id:typeof socket.id==='string'?socket.id:'socket-'+index,rune:normalizeSocketedRune(socket.rune)}];}):[],
    source:value.source&&typeof value.source==='object'?value.source as ItemSource:{type:'legacy',sourceId:null,label:'Equipment save lama'},
    runeRarity:typeof value.runeRarity==='string'&&Object.hasOwn(RUNE_RARITY_RULES,value.runeRarity)?value.runeRarity as RuneRarity:value.runeRarity==null?template.runeRarity:null,
    runeTheme:typeof value.runeTheme==='string'&&Object.hasOwn(RUNE_THEME_POOLS,value.runeTheme)?value.runeTheme as RuneTheme:value.runeTheme==null?template.runeTheme:null,
    runeSource:typeof value.runeSource==='string'?value.runeSource:null,
    runeJobRequirement:typeof value.runeJobRequirement==='string'?value.runeJobRequirement as CoreJobId:template.runeJobRequirement,
    uniqueEffect:typeof value.uniqueEffect==='string'?value.uniqueEffect:template.uniqueEffect,
    uniqueEffectData:value.uniqueEffectData&&typeof value.uniqueEffectData==='object' ? value.uniqueEffectData as UniqueEffectData : template.uniqueEffectData,
    uniqueStatsLocked:value.uniqueStatsLocked===true,
    optimizerTier:template.optimizerTier,
    runeSchemaVersion:2,
    runeQualityFixed:template.runeQualityFixed??false,
    optimizerHistory:(()=>{const history=value.optimizerHistory&&typeof value.optimizerHistory==='object'?value.optimizerHistory as Record<string,unknown>:value.springHistory&&typeof value.springHistory==='object'?value.springHistory as Record<string,unknown>:{};return {rerollCount:Math.max(0,Math.floor(Number(history.rerollCount)||0)),lastOptimizerAt:typeof history.lastOptimizerAt==='number'?history.lastOptimizerAt:typeof history.lastSpringAt==='number'?history.lastSpringAt:null};})(),
    isLocked:value.isLocked===true,
    isSellable:
      typeof value.isSellable === 'boolean'
        ? value.isSellable
        : !(value.isQuestItem === true || value.isSoulbound === true),
    ...(template.potionType ? {name:template.name,description:template.description,itemType:template.itemType,potionType:template.potionType,tier:template.tier,restoreType:template.restoreType,restoreValue:template.restoreValue,buyValue:template.buyValue,sellValue:template.sellValue,stackable:true,usableFromHotbar:true,useCooldown:3} : {}),
  });
}

export const emptyEquipment = (): EquipmentLoadout => ({
  mainHand: null,
  offHand: null,
  head: null,
  chest: null,
  gloves: null,
  legs: null,
  boots: null,
  necklace: null,
  ring1: null,
  ring2: null,
  earring1: null,
  earring2: null,
  pet: null,
});

export function inventorySlotCount(inventory: ItemData[]) {
  return inventory.filter((item) => !item.isEquipped).length;
}

export function stackKey(item: ItemData) {
  return `${item.templateId}:${item.enhancementLevel}:${item.rarity}`;
}

export function addItemToInventory(
  inventory: ItemData[],
  incoming: ItemData,
  capacity: number,
): { inventory: ItemData[]; added: number; remaining: number } {
  const next = inventory.map((item) => ({ ...item }));
  let remaining = Math.max(0, incoming.quantity);
  if (incoming.stackable) {
    for (const item of next) {
      if (
        item.stackable &&
        stackKey(item) === stackKey(incoming) &&
        item.quantity < item.maxStack
      ) {
        const add = Math.min(remaining, item.maxStack - item.quantity);
        item.quantity += add;
        remaining -= add;
        if (!remaining)
          return { inventory: next, added: incoming.quantity, remaining: 0 };
      }
    }
  }
  while (remaining > 0 && next.length < capacity) {
    const quantity = incoming.stackable
      ? Math.min(remaining, incoming.maxStack)
      : 1;
    next.push({
      ...incoming,
      id:
        incoming.stackable && next.some((item) => item.id === incoming.id)
          ? `${incoming.templateId}-${++itemSequence}`
          : incoming.id,
      quantity,
    });
    remaining -= quantity;
  }
  return { inventory: next, added: incoming.quantity - remaining, remaining };
}

export function removeItemQuantity(
  inventory: ItemData[],
  itemId: string,
  quantity = 1,
) {
  const next = inventory.map((item) => ({ ...item }));
  const index = next.findIndex((item) => item.id === itemId);
  if (index < 0) return { inventory, removed: 0 };
  const item = next[index];
  const removed = Math.min(quantity, item.quantity);
  item.quantity -= removed;
  if (item.quantity <= 0) next.splice(index, 1);
  return { inventory: next, removed };
}

export function filterInventory(
  inventory: ItemData[],
  filter: InventoryFilter,
) {
  return filter === 'all'
    ? inventory
    : inventory.filter((item) => item.category === filter);
}

export function sortInventory(inventory: ItemData[], sort: InventorySort) {
  if (sort === 'manual') return [...inventory];
  return [...inventory].sort((a, b) => {
    if (sort === 'combined') {
      return (
        a.category.localeCompare(b.category, 'id') ||
        (a.equipmentType ?? a.itemType).localeCompare(
          b.equipmentType ?? b.itemType,
          'id',
        ) ||
        a.levelRequirement - b.levelRequirement ||
        RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank ||
        a.name.localeCompare(b.name, 'id')
      );
    }
    if (sort === 'name') return a.name.localeCompare(b.name, 'id');
    if (sort === 'rarity')
      return (
        RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank ||
        a.name.localeCompare(b.name, 'id')
      );
    if (sort === 'type')
      return (
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name, 'id')
      );
    return (
      b.levelRequirement - a.levelRequirement ||
      a.name.localeCompare(b.name, 'id')
    );
  });
}

export function itemById(inventory: ItemData[], id: string | null) {
  return id ? (inventory.find((item) => item.id === id) ?? null) : null;
}

export function canEquipItem(
  item: ItemData,
  context: {
    level: number;
    coreJob: RuntimeCoreJobId | null;
    specialization: SpecializationId | null;
  },
  targetSlot: EquipSlot | null = item.equipSlot,
) {
  if (!item.equipSlot)
    return { ok: false, reason: 'Item ini tidak dapat dipasang.' };
  const compatibleSlots: EquipSlot[] = ['one_hand_sword','dagger'].includes(item.equipmentType ?? '') && item.handedness === 'one_hand' && !item.twoHanded ? ['mainHand','offHand'] : item.equipmentType === 'ring' ? ['ring1','ring2'] : item.equipmentType === 'earring' ? ['earring1','earring2'] : [item.equipSlot];
  if (!targetSlot || !compatibleSlots.includes(targetSlot))
    return { ok: false, reason: 'Equipment ini tidak dapat digunakan pada slot tersebut.' };
  if (context.level < item.levelRequirement)
    return { ok: false, reason: `Membutuhkan level ${item.levelRequirement}.` };
  if (item.requiredCoreJob && item.requiredCoreJob !== context.coreJob)
    return { ok: false, reason: `Khusus Core Job ${item.requiredCoreJob}.` };
  if (
    item.requiredSpecialJob &&
    item.requiredSpecialJob !== context.specialization
  )
    return {
      ok: false,
      reason: `Khusus Special Job ${item.requiredSpecialJob}.`,
    };
  if (item.allowedJobs.length && context.coreJob && !item.allowedJobs.some(id => id === context.coreJob))
    return { ok:false, reason:`Equipment ini hanya dapat digunakan oleh ${item.allowedJobs.join(', ')}.` };
  const allowed: Partial<Record<SpecializationId, WeaponType[]>> = {
    gatotkaca: ['knuckle'],
    garda: ['mace', 'sword_shield'],
    caroq: ['dual_dagger'],
    anom: ['sword_dagger'],
    srikandi: ['bow'],
    jagawana: ['bow_trap', 'bow'],
    resi: ['staff'],
    pujangga: ['wand', 'talisman'],
    pandita: ['staff', 'relic'],
    bajra: ['holy_knuckle', 'mace'],
  };
  if (
    context.specialization && item.requiredSpecialJob &&
    item.weaponType && !allowed[context.specialization]?.includes(item.weaponType)
  )
    return {
      ok: false,
      reason: `Senjata tidak sesuai dengan ${context.specialization}.`,
    };
  if (context.specialization === 'gatotkaca' && item.offHand)
    return {
      ok: false,
      reason: 'Gatotkaca tidak menggunakan off-hand atau shield.',
    };
  return { ok: true, reason: '' };
}

export function validateOffHandCompatibility(main: ItemData | null, offHand: ItemData) {
  const sword=offHand.equipmentType==='one_hand_sword'&&offHand.handedness==='one_hand'&&!offHand.twoHanded;
  const dagger=offHand.equipmentType==='dagger'&&offHand.handedness==='one_hand'&&!offHand.twoHanded;
  if (offHand.equipSlot !== 'offHand'&&!sword&&!dagger) return {ok:false,reason:'Equipment ini tidak dapat digunakan pada slot tersebut.'};
  if (!main) return {ok:false,reason:'Pasang Main Weapon yang kompatibel terlebih dahulu.'};
  if (main.id===offHand.id) return {ok:false,reason:'Main Hand dan Off Hand harus memakai instance item berbeda.'};
  const mainType=main.equipmentType??inferEquipmentType(main);const offType=offHand.equipmentType??inferEquipmentType(offHand);
  if (offType==='quiver') return mainType==='bow'?{ok:true,reason:''}:{ok:false,reason:'Quiver hanya dapat digunakan bersama Bow.'};
  if (main.handedness==='two_hand'||main.twoHanded)return {ok:false,reason:'Senjata dua tangan tidak dapat menggunakan Off Hand ini.'};
  if(sword)return main.id!==offHand.id&&mainType==='one_hand_sword'&&main.handedness==='one_hand'?{ok:true,reason:''}:{ok:false,reason:'Dual Sword membutuhkan dua instance One-Hand Sword berbeda.'};
  if(dagger)return mainType==='dagger'&&main.handedness==='one_hand'?{ok:true,reason:''}:{ok:false,reason:'Dual Dagger membutuhkan dua One-Hand Dagger berbeda.'};
  if (offType==='shield')return main.handedness==='one_hand'?{ok:true,reason:''}:{ok:false,reason:'Shield hanya dapat digunakan bersama senjata one-hand.'};
  if (offType==='off_hand_dagger')return ['one_hand_sword','dagger'].includes(mainType??'')?{ok:true,reason:''}:{ok:false,reason:'Off-Hand Dagger membutuhkan Sword atau Dagger yang mendukung dual wield.'};
  if (['tome','orb','talisman'].includes(offType??''))return mainType==='wand'?{ok:true,reason:''}:{ok:false,reason:'Tome, Orb, atau Talisman membutuhkan Wand yang kompatibel.'};
  return {ok:false,reason:'Off Hand tidak kompatibel dengan Main Weapon yang dipakai.'};
}

export function calculateBaseEquipmentStats(item: ItemData): StatBlock { return {...item.baseStats}; }
/** Only retained Bonus/Unique Stats contribute; generic equipment options are obsolete. */
export function calculateEquipmentUniqueStats(item:ItemData):StatBlock{return item.uniqueStatsLocked?{}:{...item.bonusStats};}
export function calculateRuneStats(item: ItemData): StatBlock {
  const result:StatBlock={};for(const socket of item.sockets)if(socket.rune)sumStatBlocks(result,affixStats(socket.rune.affixes));return result;
}
const sumStatBlocks=(target:StatBlock,source:StatBlock)=>{for(const [key,value] of Object.entries(source))target[key as keyof StatBlock]=(target[key as keyof StatBlock]??0)+(value??0);return target;};
export function calculateEquipmentStats(item: ItemData): StatBlock {
  const result=calculateBaseEquipmentStats(item);sumStatBlocks(result,calculateEquipmentUniqueStats(item));sumStatBlocks(result,calculateRuneStats(item));
  const factor=1+item.enhancementLevel*.08;for(const key of Object.keys(result) as Array<keyof StatBlock>)result[key]=(result[key]??0)*factor;return result;
}

export function itemStats(item: ItemData): StatBlock {
  return calculateEquipmentStats(item);
}

/** Item migration v2; deterministic backfill is persisted with the original instance ID. */
export function migrateEquipmentOptions(item:ItemData):ItemData {
 if(item.itemType==='socketRune'&&item.runeTheme&&item.runeRarity&&!item.affixes.length)
  return {...item,affixes:rollRuneAffixes(item.runeTheme,item.runeRarity,stableItemRandom('rune:'+item.id))};
 if(!['weapon','armor','accessory'].includes(item.category))return item;
 const migrated={...item,affixes:[],runeSchemaVersion:2 as const,optimizerHistory:{rerollCount:0,lastOptimizerAt:null}};
 if(['unique','legacy'].includes(item.rarity)&&!Object.values(item.bonusStats).some(v=>Number.isFinite(v)&&v!==0)){
  migrated.bonusStats=rollUniqueStats(item,stableItemRandom(item.id));migrated.uniqueStatsLocked=true;
 }
 return migrated;
}
export function stableItemRandom(id:string){
 let seed=2166136261;for(const char of id)seed=Math.imul(seed^char.charCodeAt(0),16777619);
 return ()=>{seed+=0x6D2B79F5;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
}
export function normalizeSocketedRune(raw:unknown):SocketedRune|null {
 if(!raw||typeof raw!=='object')return null;
 const value=raw as Record<string,unknown>,template=ITEM_CATALOG[String(value.templateId)];
 const item=normalizeItem({...value,category:'rune',itemType:'socketRune',sockets:[],quantity:1,
 runeTheme:value.runeTheme??template?.runeTheme,runeRarity:value.runeRarity??value.runeQuality??template?.runeRarity,
 runeJobRequirement:value.runeJobRequirement??value.requiredCoreJob??template?.runeJobRequirement,
 uniqueEffect:value.uniqueEffect??template?.uniqueEffect,
 source:value.source??{type:'legacy',sourceId:null,label:value.sourceLabel??template?.runeSource??'Rune save lama'}});
 if(!item)return null;
 return {...item,runeTheme:item.runeTheme,runeRarity:item.runeRarity,sourceLabel:typeof value.sourceLabel==='string'?value.sourceLabel:item.runeSource??item.source.label};
}
