import { composeAttackCore, prepareRawAttackExecution, type AttackExecutionSnapshot,
  type AttackOwner, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { ITEM_CATALOG, canEquipItem, emptyEquipment, type ItemData } from './items.ts';
import { BASE_PRIMARY_STAT, basePhysicalAttackForLevel, calculateBaseStats, derivedStats,
  type DerivedStats, type Hero } from './rules.ts';

/** Owner-approved Checkpoint B adapter. This does not remap the scalar catalog.
 * Sword reference .90 was applied at AUTHORING, including endpoint rounding once.
 * These BASE endpoints receive neutral +0 factors at execution, never .90 again. */
export const BASIC_REFERENCE_B = Object.freeze({
  version: 'Q2_Q4_BASIC_REFERENCE_B_1' as const,
  templateId: 'field-verdant-plains-sword',
  baseRange: Object.freeze({ min: 9, max: 11 }),
  authoring: Object.freeze({ budgetMin: 10, budgetMax: 12, swordReference: .90,
    endpoints: 'NEAREST_INTEGER_ONCE_AUTHORING' }),
});
type Host = { hero: Hero };
// Opaque, local development authorization. IDs/DTOs cannot recreate this binding.
export type BasicReferenceBinding = Readonly<{ version: typeof BASIC_REFERENCE_B.version }>;
type BindingState = { host: Host; hero: Hero; item: ItemData; owner: AttackOwner;
  slotId: string; itemId: string; serial: number; stale: boolean };
const bindings = new WeakMap<BasicReferenceBinding, BindingState>();
const catalogSource = ITEM_CATALOG[BASIC_REFERENCE_B.templateId];
const catalogScalar = catalogSource?.baseStats.attack;
const catalogEquipmentSlots = Object.freeze(emptyEquipment());
let epoch = 0;
const failure = (code: string, path: string): FoundationResult<never> =>
  Object.freeze({ ok: false, code, path, reason: `Reference B rejected: ${code} (${path})` });
const dataObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const zeroStats = (value: unknown) => dataObject(value) && Object.values(value).every(n => n === 0);

/** Internal game data, not an observer/Proxy trust adapter. No enrollment from save. */
function admittedItem(hero: Hero): FoundationResult<ItemData> {
  if (hero.job !== 'adventurer' || hero.jobTier !== 'adventurer' || hero.coreJob !== null ||
      hero.specialization !== null || hero.level !== 1 || hero.skillArchitectureVersion !== 3 ||
      hero.progressionArchitecture !== 'v3_adventurer' || typeof hero.characterId !== 'string' || !hero.characterId.trim() ||
      typeof hero.slotId !== 'string' || !hero.slotId.trim() || hero.canDualWieldOneHandSwords !== false)
    return failure('UNSUPPORTED_ACTOR', 'hero');
  if (BASE_PRIMARY_STAT !== 15 || basePhysicalAttackForLevel(hero.level) !== 8 ||
      !zeroStats(hero.allocatedStats) || ['str', 'vit', 'dex', 'int'].some(key => !Object.hasOwn(hero.allocatedStats, key) || hero.allocatedStats[key as keyof Hero['allocatedStats']] !== 0) ||
      Object.keys(hero.allocatedStats).some(key => !['str', 'vit', 'dex', 'int'].includes(key)) || hero.statPoints !== 0)
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

export function openBasicReferenceBinding(host: Host): FoundationResult<BasicReferenceBinding> {
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  const owner = Object.freeze({ actorId: host.hero.characterId, epoch: ++epoch });
  const binding = Object.freeze({ version: BASIC_REFERENCE_B.version });
  bindings.set(binding, { host, hero: host.hero, item: checked.value, owner, slotId: host.hero.slotId,
    itemId: checked.value.id, serial: 0, stale: false });
  return Object.freeze({ ok: true, value: binding });
}

export type PreparedBasicReference = Readonly<{ snapshot: AttackExecutionSnapshot; stats: Readonly<DerivedStats> }>;
export function prepareBasicReferenceAttack(binding: BasicReferenceBinding, host: Host, nextCombo: number,
  reference: unknown = BASIC_REFERENCE_B): FoundationResult<PreparedBasicReference> {
  const state = bindings.get(binding);
  if (!state || state.host !== host) return failure('BINDING_IDENTITY_MISMATCH', 'host');
  if (state.stale || state.hero !== host.hero || state.owner.actorId !== host.hero.characterId || state.slotId !== host.hero.slotId) {
    state.stale = true;
    return failure('STALE_ACTOR_EPOCH', 'hero');
  }
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  if (checked.value !== state.item || checked.value.id !== state.itemId) { state.stale = true; return failure('STALE_ITEM_INSTANCE', 'MAIN'); }
  if (nextCombo !== 1) return failure('UNSUPPORTED_COMBO', 'combo');
  // No caller-provided catalog override/fallback. Missing or forged data is rejected.
  if (reference !== BASIC_REFERENCE_B) return failure('REFERENCE_PROVENANCE_MISMATCH', 'reference');
  const owner = state.owner;
  const source = (category: AttackSource['category'], suffix: string): AttackSource =>
    Object.freeze({ category, sourceId: `${owner.actorId}:${owner.epoch}:B:${suffix}`, owner });
  const core = composeAttackCore({ damageType: 'physical', owner,
    base: { value: basePhysicalAttackForLevel(host.hero.level), source: source('BASE', 'base-lv1') },
    primary: { stat: 'STR', effective: calculateBaseStats(host.hero).str, source: source('PRIMARY_STAT', 'bonus-str') }, globalFlat: [] });
  if (!core.ok) return core;
  const identity = Object.freeze({ instanceId: state.item.id, kind: 'weapon' as const, owner });
  const prepared = prepareRawAttackExecution({
    context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: `${owner.actorId}:${owner.epoch}:B:${++state.serial}`,
      owner, mode: 'SINGLE_MAIN', dualWeaponAuthorized: false, thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } },
    core: core.value,
    layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON', state.item.id),
      composition: { stage: 'BASE', range: BASIC_REFERENCE_B.baseRange, enhancementMultiplier: 1, contributionMultiplier: 1 } } },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
    rankBudget: { coefficient: 1, scaling: 0, source: source('SKILL_RANK', 'basic-first') }, hits: [{ hand: 'MAIN', weight: 1 }],
  });
  if (!prepared.ok) return prepared;
  // Existing derivedStats reconciles transient fields. Evaluate an identical
  // neutral clone so a later rejected RNG sample cannot mutate the live Hero.
  const stats = Object.freeze(derivedStats({ ...host.hero, activeBuffs: { ...host.hero.activeBuffs },
    temporaryModifiers: host.hero.temporaryModifiers?.slice() }));
  if ([stats.str, stats.vit, stats.dex, stats.int].some(n => n !== 15) ||
      [stats.bossDamage, stats.eliteDamage, stats.physicalPenetration, stats.magicPenetration, stats.skillDamage].some(n => n !== 0))
    return failure('UNSUPPORTED_RESOLVED_BONUS', 'resolvedStats');
  return Object.freeze({ ok: true, value: Object.freeze({ snapshot: prepared.value, stats }) });
}
