import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution, type AttackExecutionSnapshot,
  type AttackOwner, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { BASIC_REFERENCE_B } from './basic-attack-reference-v2.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS, ADVENTURER_V3_SKILL_MAP } from './adventurer-v3.ts';
import { availableSkillPointsV3, spentSkillPointsV3 } from './skill-progression-v3.ts';
import { resolveSkillAction, type ResolvedSkillAction } from './skill-action.ts';
import type { SkillDefinition } from './skills.ts';
import { ITEM_CATALOG, canEquipItem, emptyEquipment, type ItemData } from './items.ts';
import { BASE_PRIMARY_STAT, basePhysicalAttackForLevel, calculateBaseStats, derivedStats,
  type DerivedStats, type Hero } from './rules.ts';

/** Independent paid-rank authorization; shared B metadata is authoring data only,
 * never a Basic/Quick token or permission to use their Lv1 route. */
export const POWER_STRIKE_REFERENCE = Object.freeze({
  version: 'Q2_Q4_POWER_STRIKE_R1_1' as const, skillId: 'v3-adventurer-power-strike',
  coefficient: 1.20, bonusSTRCoefficient: .04, mana: 5, cooldown: 6, range: 3.8,
});
type Host = { hero: Hero };
// Opaque, local development authorization. IDs/DTOs cannot recreate this binding.
export type PowerStrikeBinding = Readonly<{ version: typeof POWER_STRIKE_REFERENCE.version }>;
type BindingState = { host: Host; hero: Hero; item: ItemData; owner: AttackOwner;
  slotId: string; itemId: string; serial: number; stale: boolean };
const bindings = new WeakMap<PowerStrikeBinding, BindingState>();
const catalogSource = ITEM_CATALOG[BASIC_REFERENCE_B.templateId];
const catalogScalar = catalogSource?.baseStats.attack;
const catalogEquipmentSlots = Object.freeze(emptyEquipment());
let epoch = 0;
const failure = (code: string, path: string): FoundationResult<never> =>
  Object.freeze({ ok: false, code, path, reason: `Power Strike reference rejected: ${code} (${path})` });
const dataObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const zeroStats = (value: unknown) => dataObject(value) && Object.values(value).every(n => n === 0);

function paidReferenceRank(hero: Hero): boolean {
  const state = hero.skillProgressionV3;
  const quick = 'v3-adventurer-quick-slash', minor = 'v3-adventurer-minor-heal';
  if (!state || !dataObject(state.skillRanks) || !dataObject(state.grantedRanks) || !dataObject(hero.skillLevels) ||
      state.skillArchitectureVersion !== 3 || state.totalEarnedSP !== 1 ||
      state.chosenCoreJob !== null || state.chosenSpecialization !== null || state.chosenAdvancedJob !== null ||
      state.skillRanks[POWER_STRIKE_REFERENCE.skillId] !== 1 || hero.skillLevels[POWER_STRIKE_REFERENCE.skillId] !== 1 ||
      (state.grantedRanks[POWER_STRIKE_REFERENCE.skillId] !== undefined && state.grantedRanks[POWER_STRIKE_REFERENCE.skillId] !== 0) ||
      state.skillRanks[quick] !== 1 || state.grantedRanks[quick] !== 1 || hero.skillLevels[quick] !== 1 ||
      (state.skillRanks[minor] ?? 0) !== 0 || (hero.skillLevels[minor] ?? 0) !== 0 || hero.skillPoints !== 0 ||
      Object.entries(state.skillRanks).some(([id, rank]) => id !== quick && id !== POWER_STRIKE_REFERENCE.skillId && rank !== 0) ||
      Object.entries(state.grantedRanks).some(([id, rank]) => id !== quick && rank !== 0) ||
      Object.entries(hero.skillLevels).some(([id, rank]) => id !== quick && id !== POWER_STRIKE_REFERENCE.skillId && rank !== 0))
    return false;
  return spentSkillPointsV3(state, ADVENTURER_V3_SKILL_MAP) === 1 &&
    availableSkillPointsV3(state, ADVENTURER_V3_SKILL_MAP) === 0;
}

/** Higher coherent paid ranks remain legacy; malformed R1 authority never falls back. */
export function coherentHigherPowerRank(hero: Hero): boolean {
  const state = hero.skillProgressionV3, rank = state?.skillRanks?.[POWER_STRIKE_REFERENCE.skillId];
  if (!state || !dataObject(state.skillRanks) || !dataObject(state.grantedRanks) || !dataObject(hero.skillLevels) ||
      Object.values(state.skillRanks).some(value => !Number.isSafeInteger(value) || value < 0) ||
      Object.values(state.grantedRanks).some(value => !Number.isSafeInteger(value) || value < 0) ||
      state.skillArchitectureVersion !== 3 || !Number.isInteger(rank) || rank! < 2 || rank! > 5 ||
      hero.skillLevels[POWER_STRIKE_REFERENCE.skillId] !== rank || (state.grantedRanks[POWER_STRIKE_REFERENCE.skillId] ?? 0) !== 0 ||
      !Number.isSafeInteger(state.totalEarnedSP) || state.totalEarnedSP < spentSkillPointsV3(state, ADVENTURER_V3_SKILL_MAP))
    return false;
  return hero.skillPoints === availableSkillPointsV3(state, ADVENTURER_V3_SKILL_MAP);
}

/** Internal game data, not an observer/Proxy trust adapter. No enrollment from save. */
function admittedItem(hero: Hero): FoundationResult<ItemData> {
  if (hero.job !== 'adventurer' || hero.jobTier !== 'adventurer' || hero.coreJob !== null ||
      hero.specialization !== null || hero.level !== 2 || hero.skillArchitectureVersion !== 3 ||
      hero.progressionArchitecture !== 'v3_adventurer' || typeof hero.characterId !== 'string' || !hero.characterId.trim() ||
      typeof hero.slotId !== 'string' || !hero.slotId.trim() || hero.canDualWieldOneHandSwords !== false)
    return failure('UNSUPPORTED_ACTOR', 'hero');
  if (!paidReferenceRank(hero)) return failure('UNSUPPORTED_PAID_RANK_OR_LEDGER', 'hero.skillProgressionV3');
  if (BASE_PRIMARY_STAT !== 15 || basePhysicalAttackForLevel(hero.level) !== 9 ||
      !zeroStats(hero.allocatedStats) || ['str', 'vit', 'dex', 'int'].some(key => !Object.hasOwn(hero.allocatedStats, key) || hero.allocatedStats[key as keyof Hero['allocatedStats']] !== 0) ||
      Object.keys(hero.allocatedStats).some(key => !['str', 'vit', 'dex', 'int'].includes(key)) || hero.statPoints !== 2)
    return failure('UNSUPPORTED_PRIMARY', 'hero.allocatedStats');
  if (hero.pet !== null || hero.fateRune !== null || hero.eternalSeal !== null || hero.barrier !== 0 ||
      !zeroStats(hero.passiveLevels) || !dataObject(hero.masteryChoices) || Object.keys(hero.masteryChoices).length ||
      !zeroStats(hero.activeBuffs) || !zeroStats(hero.statusEffects) ||
      (hero.temporaryModifiers !== undefined && (!Array.isArray(hero.temporaryModifiers) || hero.temporaryModifiers.length !== 0)) ||
      (hero.combatStateModifiers !== undefined && (!Array.isArray(hero.combatStateModifiers) || hero.combatStateModifiers.length !== 0)))
    return failure('UNSUPPORTED_BONUS_SOURCE', 'hero.modifiers');
  if (!dataObject(hero.equipment) || hero.equipment.offHand !== null || !hero.equipment.mainHand ||
      Object.keys(hero.equipment).length !== Object.keys(catalogEquipmentSlots).length ||
      Object.entries(hero.equipment).some(([slot, id]) => !Object.hasOwn(catalogEquipmentSlots, slot) || slot !== 'mainHand' && id !== null))
    return failure('UNSUPPORTED_EQUIPMENT', 'hero.equipment');
  if (!Array.isArray(hero.inventory)) return failure('AMBIGUOUS_OR_MISSING_INSTANCE', 'hero.inventory');
  const matches = hero.inventory.filter(item => item.id === hero.equipment.mainHand);
  if (matches.length !== 1) return failure('AMBIGUOUS_OR_MISSING_INSTANCE', 'hero.inventory');
  const item = matches[0];
  if (!catalogSource || ITEM_CATALOG[BASIC_REFERENCE_B.templateId] !== catalogSource ||
      catalogScalar !== 8 || catalogSource.baseStats.attack !== catalogScalar)
    return failure('CATALOG_PROVENANCE_MISMATCH', 'catalog');
  if (typeof item.id !== 'string' || !item.id.trim() || item.templateId !== BASIC_REFERENCE_B.templateId || item.name !== 'Training Sword' ||
      item.category !== 'weapon' || item.equipmentType !== 'one_hand_sword' || item.handedness !== 'one_hand' ||
      item.attackType !== 'melee' || item.itemType !== catalogSource.itemType || item.weaponType !== catalogSource.weaponType ||
      item.rarity !== 'common' || item.levelRequirement !== 1 || item.enhancementLevel !== 0 ||
      item.quantity !== 1 || item.isEquipped !== true || item.mainHand !== true || item.offHand !== false ||
      item.twoHanded !== false || item.equipSlot !== 'mainHand' ||
      item.requiredCoreJob !== null || item.requiredSpecialJob !== null || item.jobRequirement !== null ||
      !canEquipItem(item, hero, 'mainHand').ok)
    return failure('UNSUPPORTED_WEAPON', 'MAIN');
  // Inspect actual normal sources. The compatibility scalar is checked, then
  // deliberately excluded from core; only the authored range owns raw weapon ATK.
  if (!dataObject(item.baseStats) || item.baseStats.attack !== catalogScalar || Object.entries(item.baseStats).some(([key, n]) => key !== 'attack' && n !== 0) ||
      !zeroStats(item.bonusStats) || !Array.isArray(item.affixes) || item.affixes.length || !Array.isArray(item.sockets) || item.sockets.length ||
      !dataObject(item.skillModifiers) || Object.keys(item.skillModifiers).length || item.uniqueEffect !== null || item.uniqueEffectData !== undefined ||
      item.runeRarity !== null || item.runeTheme !== null || item.runeSource !== null || item.runeJobRequirement !== null)
    return failure('UNSUPPORTED_ITEM_BONUS', 'MAIN.options');
  const base = calculateBaseStats(hero);
  if ([base.str, base.vit, base.dex, base.int].some(n => n !== 15))
    return failure('UNSUPPORTED_PRIMARY', 'hero.effectivePrimary');
  return Object.freeze({ ok: true, value: item });
}

export function openPowerStrikeBinding(host: Host): FoundationResult<PowerStrikeBinding> {
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  const owner = Object.freeze({ actorId: host.hero.characterId, epoch: ++epoch });
  const binding = Object.freeze({ version: POWER_STRIKE_REFERENCE.version });
  bindings.set(binding, { host, hero: host.hero, item: checked.value, owner, slotId: host.hero.slotId,
    itemId: checked.value.id, serial: 0, stale: false });
  return Object.freeze({ ok: true, value: binding });
}

export type PreparedPowerStrike = Readonly<{ snapshot: AttackExecutionSnapshot; stats: Readonly<DerivedStats>; action: ResolvedSkillAction; hero: Hero }>;
export function preparePowerStrike(binding: PowerStrikeBinding, host: Host, definition: SkillDefinition,
  reference: unknown = BASIC_REFERENCE_B): FoundationResult<PreparedPowerStrike> {
  const state = bindings.get(binding);
  if (!state || state.host !== host) return failure('BINDING_IDENTITY_MISMATCH', 'host');
  if (state.stale || state.hero !== host.hero || state.owner.actorId !== host.hero.characterId || state.slotId !== host.hero.slotId) {
    state.stale = true;
    return failure('STALE_ACTOR_EPOCH', 'hero');
  }
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  if (checked.value !== state.item || checked.value.id !== state.itemId) { state.stale = true; return failure('STALE_ITEM_INSTANCE', 'MAIN'); }
  if (!validDefinition(definition)) return failure('SKILL_PROVENANCE_MISMATCH', 'skill');
  // No caller-provided catalog override/fallback. Missing or forged data is rejected.
  if (reference !== BASIC_REFERENCE_B) return failure('REFERENCE_PROVENANCE_MISMATCH', 'reference');
  const owner = state.owner;
  const source = (category: AttackSource['category'], suffix: string): AttackSource =>
    Object.freeze({ category, sourceId: `${owner.actorId}:${owner.epoch}:PS:${suffix}`, owner });
  const core = composeAttackCore({ damageType: 'physical', owner,
    base: { value: basePhysicalAttackForLevel(host.hero.level), source: source('BASE', 'approved-base-lv2') },
    primary: { stat: 'STR', effective: calculateBaseStats(host.hero).str, source: source('PRIMARY_STAT', 'bonus-str') }, globalFlat: [] });
  if (!core.ok) return core;
  const primary = calculateBaseStats(host.hero);
  const scaling = composeBonusScaling({ STR: primary.str, VIT: primary.vit, DEX: primary.dex, INT: primary.int },
    { STR: POWER_STRIKE_REFERENCE.bonusSTRCoefficient });
  if (!scaling.ok) return scaling;
  const identity = Object.freeze({ instanceId: state.item.id, kind: 'weapon' as const, owner });
  const prepared = prepareRawAttackExecution({
    context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: `${owner.actorId}:${owner.epoch}:PS:${++state.serial}`,
      owner, mode: 'SINGLE_MAIN', dualWeaponAuthorized: false, thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } },
    core: core.value,
    layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON', state.item.id),
      composition: { stage: 'BASE', range: BASIC_REFERENCE_B.baseRange, enhancementMultiplier: 1, contributionMultiplier: 1 } } },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
    rankBudget: { coefficient: POWER_STRIKE_REFERENCE.coefficient, scaling: scaling.value, source: source('SKILL_RANK', 'paid-power-r1') }, hits: [{ hand: 'MAIN', weight: 1 }],
  });
  if (!prepared.ok) return prepared;
  // Existing derivedStats reconciles transient fields. Evaluate an identical
  // neutral clone so a later rejected RNG sample cannot mutate the live Hero.
  const stats = Object.freeze(derivedStats({ ...host.hero, activeBuffs: { ...host.hero.activeBuffs },
    temporaryModifiers: host.hero.temporaryModifiers?.slice() }));
  if ([stats.str, stats.vit, stats.dex, stats.int].some(n => n !== 15) ||
      [stats.bossDamage, stats.eliteDamage, stats.physicalPenetration, stats.magicPenetration, stats.skillDamage].some(n => n !== 0))
    return failure('UNSUPPORTED_RESOLVED_BONUS', 'resolvedStats');
  const metadata: SkillDefinition = { ...definition, baseDamage: 0, physicalCoefficient: 0, magicCoefficient: 0,
    skillPowerCoefficient: 0, statScaling: {}, baseDamageMinByRank: undefined, baseDamageMaxByRank: undefined,
    skillPowerFactor: 0, rankPowerFactorByRank: [1],
    rankValues: [{ physicalCoefficient: 0, statScaling: {}, manaCost: 5, cooldown: 6 }],
    knockbackStrength: 0 };
  const action = resolveSkillAction(metadata, { stats, rank: 1, masteryPower: 1, masteryCooldown: 1,
    equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'one_hand_sword',
    rng: () => { throw new Error('Power metadata must not draw RNG'); } });
  if (action.manaCost !== 5 || action.cooldown !== 6 || action.range !== 3.8 || action.hitSequence.length !== 1 ||
      action.hitSequence[0].delay !== 0 || action.damageMultiplier !== 1 || action.hitSequence[0].damageMultiplier !== 1 ||
      action.hitSequence[0].baseDamage !== 0 || action.hitSequence[0].knockbackStrength !== 0 ||
      action.statuses.length || action.targetModifiers.length || action.actionLockDuration !== 0)
    return failure('UNSUPPORTED_ACTION_METADATA', 'action');
  return Object.freeze({ ok: true, value: Object.freeze({ snapshot: prepared.value, stats, action, hero: host.hero }) });
}

function validDefinition(definition: SkillDefinition): boolean {
  return !(definition !== ADVENTURER_V3_RUNTIME_SKILLS[1] || definition.id !== POWER_STRIKE_REFERENCE.skillId ||
      definition.name !== 'Power Strike' || definition.slot !== 2 || definition.job !== 'adventurer' || definition.specialization !== null ||
      definition.unlockLevel !== 1 || definition.maxLevel !== 5 || definition.castingTime !== .35 ||
      definition.rankValues?.[0].physicalCoefficient !== POWER_STRIKE_REFERENCE.coefficient ||
      definition.rankValues?.[0].statScaling?.str !== POWER_STRIKE_REFERENCE.bonusSTRCoefficient ||
      definition.rankValues?.[0].manaCost !== 5 || definition.rankValues?.[0].cooldown !== 6 ||
      !dataObject(definition.rankValues?.[0].statScaling) ||
      Object.keys(definition.rankValues![0].statScaling!).some(key => key !== 'str') ||
      definition.physicalCoefficient !== POWER_STRIKE_REFERENCE.coefficient ||
      definition.statScaling?.str !== POWER_STRIKE_REFERENCE.bonusSTRCoefficient ||
      definition.manaCost !== 5 || definition.cooldown !== 6 || definition.range !== 3.8 ||
      definition.targetType !== 'single' || definition.effect !== 'damage' || definition.castTiming !== undefined ||
      definition.hitSequence !== undefined || definition.statusEffect !== null || definition.canCrit !== true ||
      definition.damageType !== 'physical' || definition.progressionMode !== 'rank_values' ||
      definition.weaponRequirement?.length !== 1 || definition.weaponRequirement[0] !== 'one_hand_sword' ||
      definition.modifiers !== undefined || definition.statuses !== undefined || definition.rankMechanics !== undefined ||
      definition.temporaryBuffs !== undefined || definition.weaponMode !== undefined || definition.nonDamaging ||
      definition.tags?.length !== 1 || definition.tags[0] !== 'v3-adventurer');

}

/** Identity-only recheck after sampling; never recomposes the immutable budget. */
export function currentPowerStrikeBinding(binding: PowerStrikeBinding, host: Host): boolean {
  const state = bindings.get(binding);
  if (!state || state.host !== host || state.stale) return false;
  if (host.hero !== state.hero || host.hero.characterId !== state.owner.actorId || host.hero.slotId !== state.slotId ||
      host.hero.equipment.mainHand !== state.itemId ||
      host.hero.inventory.filter(item => item.id === state.itemId).length !== 1 ||
      host.hero.inventory.find(item => item.id === state.itemId) !== state.item) {
    state.stale = true; return false;
  }
  return true;
}

