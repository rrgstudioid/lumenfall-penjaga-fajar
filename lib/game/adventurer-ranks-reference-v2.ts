import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution, type AttackExecutionSnapshot,
  type AttackOwner, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { BASIC_REFERENCE_B } from './basic-attack-reference-v2.ts';
import { IRON_SWORD_RANGE_V2, ironSwordAuthoredRange } from './iron-sword-range-v2.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS, ADVENTURER_V3_SKILLS, ADVENTURER_V3_SKILL_MAP } from './adventurer-v3.ts';
import { availableSkillPointsV3, spentSkillPointsV3 } from './skill-progression-v3.ts';
import { resolveSkillAction, type ResolvedSkillAction } from './skill-action.ts';
import type { SkillDefinition } from './skills.ts';
import { ITEM_CATALOG, canEquipItem, emptyEquipment, type ItemData } from './items.ts';
import { BASE_PRIMARY_STAT, basePhysicalAttackForLevel, calculateBaseStats, derivedStats,
  type DerivedStats, type Hero } from './rules.ts';

/** Adventurer development context; shared B metadata is authoring data only,
 * never a Basic/standalone R1 token. */
export const ADVENTURER_RANKS_REFERENCE = Object.freeze({
  version: 'Q2_Q4_ADVENTURER_IRON_BASE_5' as const,
  skills: Object.freeze(['v3-adventurer-quick-slash', 'v3-adventurer-power-strike']),
});
const approved = [
  [[1.05,.02,3,3.2,1],[1.08,.03,3,3.1,3],[1.12,.04,4,3,6],[1.16,.05,4,2.9,9],[1.20,.06,5,2.8,13]],
  [[1.20,.04,5,6,1],[1.26,.05,5,5.75,7],[1.32,.06,6,5.5,10],[1.38,.07,6,5.25,12],[1.45,.08,7,5,14]],
] as const;
const rankSignature = (hero: Hero) => JSON.stringify([hero.level, hero.skillProgressionV3, hero.skillLevels, hero.skillPoints, hero.allocatedStats, hero.statPoints]);
const healId = 'v3-adventurer-minor-heal';
const primaryKeys = ['str', 'vit', 'dex', 'int'] as const;

/** Static approved rank information only; no gear-derived damage preview or RNG. */
export function adventurerReferenceSkillMetadata(id: string, rank: number) {
  const index=ADVENTURER_RANKS_REFERENCE.skills.indexOf(id);
  if(index>=0 && Number.isInteger(rank) && rank>=1 && rank<=5) {
    const [coefficient,bonusSTRCoefficient,mana,cooldown,gate]=approved[index][rank-1];
    return Object.freeze({version:ADVENTURER_RANKS_REFERENCE.version,id,rank,coefficient,bonusSTRCoefficient,mana,cooldown,gate,healPercent:null,range:3.8,hits:1});
  }
  if(id===healId && Number.isInteger(rank) && rank>=1 && rank<=3) {
    const definition=ADVENTURER_V3_RUNTIME_SKILLS[2],values=definition.rankValues![rank-1];
    return Object.freeze({version:ADVENTURER_RANKS_REFERENCE.version,id,rank,coefficient:null,bonusSTRCoefficient:null,mana:values.manaCost!,cooldown:values.cooldown!,gate:ADVENTURER_V3_SKILLS[2].rankLevelRequirements![rank-1],healPercent:[6,8,10][rank-1],range:0,hits:0});
  }
  return null;
}
type Host = { hero: Hero };
// Opaque, local development authorization. IDs/DTOs cannot recreate this binding.
export type AdventurerRanksBinding = Readonly<{ version: typeof ADVENTURER_RANKS_REFERENCE.version }>;
type BindingState = { host: Host; hero: Hero; item: ItemData; owner: AttackOwner;
  slotId: string; itemId: string; serial: number; stale: boolean; signature: string };
const bindings = new WeakMap<AdventurerRanksBinding, BindingState>();
const catalogSource = ITEM_CATALOG[BASIC_REFERENCE_B.templateId];
const catalogScalar = catalogSource?.baseStats.attack;
const ironCatalogSource = ITEM_CATALOG[IRON_SWORD_RANGE_V2.templateId];
function weaponRange(item: ItemData) {
  return item.templateId === BASIC_REFERENCE_B.templateId ? BASIC_REFERENCE_B.baseRange : ironSwordAuthoredRange(item)!;
}
const catalogEquipmentSlots = Object.freeze(emptyEquipment());
let epoch = 0;
const failure = (code: string, path: string): FoundationResult<never> =>
  Object.freeze({ ok: false, code, path, reason: `Adventurer ranks reference rejected: ${code} (${path})` });
const dataObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const zeroStats = (value: unknown) => dataObject(value) && Object.values(value).every(n => n === 0);

/** Internal authoritative transaction fingerprint, not a save or enrollment token. */
export function adventurerLifecycleSignature(hero: Hero): string {
  return JSON.stringify([rankSignature(hero), hero.characterId, hero.slotId, hero.job, hero.jobTier,
    hero.coreJob, hero.specialization, hero.equipment, hero.inventory, hero.pet, hero.fateRune,
    hero.eternalSeal, hero.passiveLevels, hero.masteryChoices]);
}

function resolvedReferenceCore(hero: Hero, owner: AttackOwner, prefix: string) {
  const source = (category: AttackSource['category'], suffix: string): AttackSource =>
    Object.freeze({category, sourceId: `${prefix}:${suffix}`, owner});
  return composeAttackCore({damageType:'physical',owner,
    base:{value:basePhysicalAttackForLevel(hero.level),source:source('BASE',`approved-base-lv${hero.level}`)},
    primary:{stat:'STR',effective:calculateBaseStats(hero).str,source:source('PRIMARY_STAT','bonus-str')},globalFlat:[]});
}

/** Pure current presentation. Does not mark bindings stale or allocate an execution. */
export function adventurerRangePresentation(binding: AdventurerRanksBinding | undefined, host: Host) {
  const state=binding && bindings.get(binding);
  if(!state || state.host!==host || state.stale || state.hero!==host.hero || state.signature!==rankSignature(host.hero))
    return failure('REFERENCE_UNAVAILABLE','binding');
  const checked=admittedItem(host.hero);
  if(!checked.ok)return checked;
  if(checked.value!==state.item || host.hero.characterId!==state.owner.actorId || host.hero.slotId!==state.slotId)
    return failure('IDENTITY_MISMATCH','hero.MAIN');
  const core=resolvedReferenceCore(host.hero,state.owner,`${state.owner.actorId}:${state.owner.epoch}:PRESENTATION`);
  if(!core.ok)return core;
  const weapon=weaponRange(checked.value);
  const identity=Object.freeze({instanceId:state.itemId,kind:'weapon' as const,owner:state.owner});
  const composed=prepareRawAttackExecution({context:{validation:'VALIDATED_EXECUTION_CONTEXT',
    executionId:`${state.owner.actorId}:${state.owner.epoch}:READ_ONLY_PRESENTATION`,owner:state.owner,
    mode:'SINGLE_MAIN',dualWeaponAuthorized:false,thrownAuthorized:false,magicSourceHands:[],instances:{MAIN:identity}},
    core:core.value,layers:{MAIN:{hand:'MAIN',identity,damageType:'physical',
      source:{category:'RAW_WEAPON',sourceId:`presentation:${state.itemId}`,owner:state.owner},
      composition:{stage:'BASE',range:weapon,enhancementMultiplier:1,contributionMultiplier:1}}},
    attackModifier:{scope:'ATTACK_RANGE',damageType:'physical',multiplier:1,sources:[]},
    rankBudget:{coefficient:1,scaling:0,source:{category:'SKILL_RANK',sourceId:'presentation:unit',owner:state.owner}},
    hits:[{hand:'MAIN',weight:1}]});
  if(!composed.ok)return composed;
  return Object.freeze({ok:true as const,value:Object.freeze({version:ADVENTURER_RANKS_REFERENCE.version,
    base:basePhysicalAttackForLevel(host.hero.level),bonusSTR:core.value.bonusPrimary,core:core.value.value,
    weapon,MAIN:composed.value.hits[0].attack,itemId:state.itemId})});
}

function paidReferenceRank(hero: Hero): boolean {
  const state=hero.skillProgressionV3, [quick,power]=ADVENTURER_RANKS_REFERENCE.skills;
  if (!state || !dataObject(state.skillRanks) || !dataObject(state.grantedRanks) || !dataObject(hero.skillLevels) ||
      state.skillArchitectureVersion!==3 || state.totalEarnedSP!==hero.level-1 ||
      state.chosenCoreJob!==null || state.chosenSpecialization!==null || state.chosenAdvancedJob!==null) return false;
  const q=state.skillRanks[quick], p=state.skillRanks[power]??0, h=state.skillRanks[healId]??0;
  if (state.skillRanks[power] === null || hero.skillLevels[power] === null ||
      state.grantedRanks[power] === null || state.skillRanks[healId] === null || hero.skillLevels[healId] === null || state.grantedRanks[healId] === null) return false;
  if (!Number.isInteger(q)||q<1||q>5||!Number.isInteger(p)||p<0||p>5||
      hero.skillLevels[quick]!==q||(hero.skillLevels[power]??0)!==p||
      !Number.isInteger(h)||h<0||h>3||(hero.skillLevels[healId]??0)!==h||(state.grantedRanks[healId]??0)!==0 ||
      state.grantedRanks[quick]!==1||(state.grantedRanks[power]??0)!==0 ||
      Object.entries(state.skillRanks).some(([id,r])=>id!==quick&&id!==power&&id!==healId&&r!==0) ||
      Object.entries(hero.skillLevels).some(([id,r])=>id!==quick&&id!==power&&id!==healId&&r!==0) ||
      Object.entries(state.grantedRanks).some(([id,r])=>id!==quick&&r!==0)) return false;
  if(hero.level<approved[0][q-1][4] || p>0 && hero.level<approved[1][p-1][4] || h>0 && hero.level<(ADVENTURER_V3_SKILL_MAP[healId].rankLevelRequirements?.[h-1]??1))return false;
  const spent=q-1+p+h;
  return state.totalEarnedSP>=spent && spentSkillPointsV3(state,ADVENTURER_V3_SKILL_MAP)===spent &&
    availableSkillPointsV3(state,ADVENTURER_V3_SKILL_MAP)===state.totalEarnedSP-spent &&
    hero.skillPoints===state.totalEarnedSP-spent;
}
/** Internal game data, not an observer/Proxy trust adapter. No enrollment from save. */
function admittedItem(hero: Hero, presentationItem?: ItemData): FoundationResult<ItemData> {
  if (hero.job !== 'adventurer' || hero.jobTier !== 'adventurer' || hero.coreJob !== null ||
      hero.specialization !== null || (!Number.isInteger(hero.level) || hero.level < 1 || hero.level > 14) || hero.skillArchitectureVersion !== 3 ||
      hero.progressionArchitecture !== 'v3_adventurer' || typeof hero.characterId !== 'string' || !hero.characterId.trim() ||
      typeof hero.slotId !== 'string' || !hero.slotId.trim() || hero.canDualWieldOneHandSwords !== false)
    return failure('UNSUPPORTED_ACTOR', 'hero');
  if (!paidReferenceRank(hero)) return failure('UNSUPPORTED_PAID_RANK_OR_LEDGER', 'hero.skillProgressionV3');
  if (BASE_PRIMARY_STAT !== 15 || basePhysicalAttackForLevel(hero.level) !== 7 + Math.floor(hero.level * 1.1) ||
      !dataObject(hero.allocatedStats) || primaryKeys.some(key => !Object.hasOwn(hero.allocatedStats,key) || typeof hero.allocatedStats[key]!=='number' || !Number.isSafeInteger(hero.allocatedStats[key]) || hero.allocatedStats[key]!<0) ||
      Object.keys(hero.allocatedStats).length!==primaryKeys.length || !Number.isSafeInteger(hero.statPoints) || hero.statPoints<0 ||
      hero.statPoints+primaryKeys.reduce((sum,key)=>sum+hero.allocatedStats[key]!,0)!==2*(hero.level-1))
    return failure('UNSUPPORTED_PRIMARY', 'hero.allocatedStats');
  if (hero.pet !== null || hero.fateRune !== null || hero.eternalSeal !== null || hero.barrier !== 0 ||
      !zeroStats(hero.passiveLevels) || !dataObject(hero.masteryChoices) || Object.keys(hero.masteryChoices).length ||
      !zeroStats(hero.activeBuffs) || !zeroStats(hero.statusEffects) ||
      (hero.temporaryModifiers !== undefined && (!Array.isArray(hero.temporaryModifiers) || hero.temporaryModifiers.length !== 0)) ||
      (hero.combatStateModifiers !== undefined && (!Array.isArray(hero.combatStateModifiers) || hero.combatStateModifiers.length !== 0)))
    return failure('UNSUPPORTED_BONUS_SOURCE', 'hero.modifiers');
  if (!dataObject(hero.equipment) || hero.equipment.offHand !== null || (!presentationItem && !hero.equipment.mainHand) ||
      Object.keys(hero.equipment).length !== Object.keys(catalogEquipmentSlots).length ||
      Object.entries(hero.equipment).some(([slot, id]) => !Object.hasOwn(catalogEquipmentSlots, slot) || slot !== 'mainHand' && id !== null))
    return failure('UNSUPPORTED_EQUIPMENT', 'hero.equipment');
  if (!Array.isArray(hero.inventory)) return failure('AMBIGUOUS_OR_MISSING_INSTANCE', 'hero.inventory');
  const matches = hero.inventory.filter(item => item.id === (presentationItem?.id ?? hero.equipment.mainHand));
  if (matches.length !== 1) return failure('AMBIGUOUS_OR_MISSING_INSTANCE', 'hero.inventory');
  const item = matches[0];
  if(item.authoredEquipmentVersion !== undefined || item.authoredEquipmentProfile !== undefined)return failure('UNSUPPORTED_EQUIPMENT_AUTHORING','item');
  if(presentationItem && item!==presentationItem)return failure('ITEM_IDENTITY_MISMATCH','item');
  const iron=item.templateId===IRON_SWORD_RANGE_V2.templateId;
  const catalog=iron?ironCatalogSource:catalogSource;
  const scalar=iron?IRON_SWORD_RANGE_V2.compatibilityScalar:catalogScalar;
  if (!catalog || ITEM_CATALOG[item.templateId] !== catalog || scalar !== (iron?14:8) || catalog.baseStats.attack !== scalar ||
      iron && (catalog.authoredAttackVersion!==IRON_SWORD_RANGE_V2.version || catalog.levelRequirement!==10))
    return failure('CATALOG_PROVENANCE_MISMATCH', 'catalog');
  if (iron && (!ironSwordAuthoredRange(item) || hero.level<10))
    return failure('IRON_SOURCE_OR_LEVEL_MISMATCH','MAIN.authoredAttackVersion');
  if (typeof item.id !== 'string' || !item.id.trim() || (!iron && item.templateId !== BASIC_REFERENCE_B.templateId) || item.name !== (iron?'Iron Sword':'Training Sword') ||
      item.category !== 'weapon' || item.equipmentType !== 'one_hand_sword' || item.handedness !== 'one_hand' ||
      item.attackType !== 'melee' || item.itemType !== catalog.itemType || item.weaponType !== catalog.weaponType ||
      item.rarity !== 'common' || item.levelRequirement !== (iron?10:1) || item.enhancementLevel !== 0 ||
      item.quantity !== 1 || (!presentationItem && item.isEquipped !== true) || item.mainHand !== true || item.offHand !== false ||
      item.twoHanded !== false || item.equipSlot !== 'mainHand' ||
      item.requiredCoreJob !== null || item.requiredSpecialJob !== null || item.jobRequirement !== null ||
      !canEquipItem(item, hero, 'mainHand').ok)
    return failure('UNSUPPORTED_WEAPON', 'MAIN');
  // Inspect actual normal sources. The compatibility scalar is checked, then
  // deliberately excluded from core; only the authored range owns raw weapon ATK.
  if (!dataObject(item.baseStats) || item.baseStats.attack !== scalar || Object.entries(item.baseStats).some(([key, n]) => key !== 'attack' && n !== 0) ||
      !zeroStats(item.bonusStats) || !Array.isArray(item.affixes) || item.affixes.length || !Array.isArray(item.sockets) || item.sockets.length ||
      !dataObject(item.skillModifiers) || Object.keys(item.skillModifiers).length || item.uniqueEffect !== null || item.uniqueEffectData !== undefined ||
      item.runeRarity !== null || item.runeTheme !== null || item.runeSource !== null || item.runeJobRequirement !== null)
    return failure('UNSUPPORTED_ITEM_BONUS', 'MAIN.options');
  const base = calculateBaseStats(hero);
  if (primaryKeys.some(key=>base[key]!==15+hero.allocatedStats[key]!))
    return failure('UNSUPPORTED_PRIMARY', 'hero.effectivePrimary');
  return Object.freeze({ ok: true, value: item });
}

/** Owned item authoring data only. This never opens a binding or permits a cast. */
export function adventurerOwnedItemRangePresentation(hero: Hero,item: ItemData) {
  const checked=admittedItem(hero,item);
  return checked.ok ? weaponRange(checked.value) : null;
}

/** Diagnostic copy of the CURRENT admitted actor; no binding, serial or epoch.
 * Internal Game data only. This is not hostile-object enrollment/cast authority. */
export function readAdventurerDiagnosticSource(hero: Hero) {
  const checked = admittedItem(hero);
  if (!checked.ok) return checked;
  const stats = Object.freeze(derivedStats({ ...hero, activeBuffs: { ...hero.activeBuffs },
    temporaryModifiers: hero.temporaryModifiers?.slice() }));
  if (primaryKeys.some(key => stats[key] !== 15 + hero.allocatedStats[key]!) ||
      [stats.bossDamage, stats.eliteDamage, stats.physicalPenetration, stats.magicPenetration, stats.skillDamage].some(n => n !== 0))
    return failure('UNSUPPORTED_RESOLVED_BONUS', 'resolvedStats');
  const item = checked.value, state = hero.skillProgressionV3!;
  const authored = Object.freeze({ templateId: item.templateId, authoredAttackVersion: item.authoredAttackVersion,
    levelRequirement: item.levelRequirement, name: item.name, category: item.category,
    equipmentType: item.equipmentType, handedness: item.handedness, attackType: item.attackType,
    equipSlot: item.equipSlot, mainHand: item.mainHand, offHand: item.offHand, twoHanded: item.twoHanded,
    rarity: item.rarity, enhancementLevel: item.enhancementLevel, baseStats: Object.freeze({ attack: item.baseStats.attack }) });
  const quick = state.skillRanks[ADVENTURER_RANKS_REFERENCE.skills[0]],
    power = state.skillRanks[ADVENTURER_RANKS_REFERENCE.skills[1]] ?? 0, heal = state.skillRanks[healId] ?? 0;
  return Object.freeze({ ok: true as const, value: Object.freeze({
    version: ADVENTURER_RANKS_REFERENCE.version, actorId: hero.characterId, slotId: hero.slotId,
    level: hero.level, allocation: Object.freeze({ STR: hero.allocatedStats.str!, VIT: hero.allocatedStats.vit!,
      DEX: hero.allocatedStats.dex!, INT: hero.allocatedStats.int! }), unspentPoints: hero.statPoints,
    ranks: Object.freeze({ quick, power, heal }), ledger: Object.freeze({ earned: state.totalEarnedSP,
      spent: quick - 1 + power + heal, available: hero.skillPoints, quickGranted: 1, powerGranted: 0, healGranted: 0 }),
    weapon: Object.freeze({ templateId: item.templateId, instanceLabel: item.id, hand: 'MAIN' as const,
      enhancement: 0, otherSources: 'NONE' as const,
      ...(item.templateId === IRON_SWORD_RANGE_V2.templateId ? { authored } : {}) }), stats, range: weaponRange(item) }) });
}

export function openAdventurerRanksBinding(host: Host): FoundationResult<AdventurerRanksBinding> {
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  const owner = Object.freeze({ actorId: host.hero.characterId, epoch: ++epoch });
  const binding = Object.freeze({ version: ADVENTURER_RANKS_REFERENCE.version });
  bindings.set(binding, { host, hero: host.hero, item: checked.value, owner, slotId: host.hero.slotId,
    itemId: checked.value.id, serial: 0, stale: false, signature: rankSignature(host.hero) });
  return Object.freeze({ ok: true, value: binding });
}

export type PreparedAdventurerRanks = Readonly<{ snapshot: AttackExecutionSnapshot; stats: Readonly<DerivedStats>; action: ResolvedSkillAction; hero: Hero; rank: number }>;
/** Owner-approved equal-power Basic events 1/2/3, each with a fresh execution.
 * Uses the same exact admitted context as skills, never the standalone Basic token. */
export function prepareAdventurerBasic(binding: AdventurerRanksBinding, host: Host, nextCombo: number):
  FoundationResult<Readonly<{ snapshot: AttackExecutionSnapshot; stats: Readonly<DerivedStats>; hero: Hero; level: number }>> {
  if (!currentAdventurerRanksBinding(binding, host)) return failure('STALE_ACTOR_EPOCH', 'hero');
  const state = bindings.get(binding)!;
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  if (checked.value !== state.item) return failure('STALE_ITEM_INSTANCE', 'MAIN');
  if (!Number.isInteger(nextCombo) || nextCombo < 1 || nextCombo > 3) return failure('UNSUPPORTED_COMBO', 'basic.nextCombo');
  const owner=state.owner;
  const source=(category: AttackSource['category'],suffix: string): AttackSource =>
    Object.freeze({category,sourceId:`${owner.actorId}:${owner.epoch}:BASIC:${suffix}`,owner});
  const core=resolvedReferenceCore(host.hero,owner,`${owner.actorId}:${owner.epoch}:BASIC`);
  if(!core.ok)return core;
  const identity=Object.freeze({instanceId:state.item.id,kind:'weapon' as const,owner});
  const prepared=prepareRawAttackExecution({
    context:{validation:'VALIDATED_EXECUTION_CONTEXT',executionId:`${owner.actorId}:${owner.epoch}:BASIC:${++state.serial}`,
      owner,mode:'SINGLE_MAIN',dualWeaponAuthorized:false,thrownAuthorized:false,magicSourceHands:[],instances:{MAIN:identity}},
    core:core.value,layers:{MAIN:{hand:'MAIN',identity,damageType:'physical',source:source('RAW_WEAPON',state.item.id),
      composition:{stage:'BASE',range:weaponRange(checked.value),enhancementMultiplier:1,contributionMultiplier:1}}},
    attackModifier:{scope:'ATTACK_RANGE',damageType:'physical',multiplier:1,sources:[]},
    rankBudget:{coefficient:1,scaling:0,source:source('SKILL_RANK','owner-basic-equal-event')},hits:[{hand:'MAIN',weight:1}]});
  if(!prepared.ok)return prepared;
  const stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs},temporaryModifiers:host.hero.temporaryModifiers?.slice()}));
  if(primaryKeys.some(key=>stats[key]!==15+host.hero.allocatedStats[key]!) ||
    [stats.bossDamage,stats.eliteDamage,stats.physicalPenetration,stats.magicPenetration,stats.skillDamage].some(n=>n!==0))
    return failure('UNSUPPORTED_RESOLVED_BONUS','resolvedStats');
  return Object.freeze({ok:true,value:Object.freeze({snapshot:prepared.value,stats,hero:host.hero,level:host.hero.level})});
}
export function prepareAdventurerRanks(binding: AdventurerRanksBinding, host: Host, definition: SkillDefinition,
  reference: unknown = BASIC_REFERENCE_B): FoundationResult<PreparedAdventurerRanks> {
  const state = bindings.get(binding);
  if (!state || state.host !== host) return failure('BINDING_IDENTITY_MISMATCH', 'host');
  if (state.stale || state.hero !== host.hero || state.owner.actorId !== host.hero.characterId || state.slotId !== host.hero.slotId || state.signature !== rankSignature(host.hero)) {
    state.stale = true;
    return failure('STALE_ACTOR_EPOCH', 'hero');
  }
  const checked = admittedItem(host.hero);
  if (!checked.ok) return checked;
  if (checked.value !== state.item || checked.value.id !== state.itemId) { state.stale = true; return failure('STALE_ITEM_INSTANCE', 'MAIN'); }
  const skillIndex=ADVENTURER_RANKS_REFERENCE.skills.indexOf(definition.id);
  const rank=host.hero.skillProgressionV3!.skillRanks[definition.id];
  if (skillIndex<0 || !Number.isInteger(rank) || rank<1 || rank>5 || !validDefinition(definition, skillIndex, rank)) return failure('SKILL_PROVENANCE_MISMATCH', 'skill');
  // No caller-provided catalog override/fallback. Missing or forged data is rejected.
  if (reference !== BASIC_REFERENCE_B) return failure('REFERENCE_PROVENANCE_MISMATCH', 'reference');
  const [coefficient, bonusSTRCoefficient, mana, cooldown]=approved[skillIndex][rank-1];
  const owner = state.owner;
  const source = (category: AttackSource['category'], suffix: string): AttackSource =>
    Object.freeze({ category, sourceId: `${owner.actorId}:${owner.epoch}:QP:${suffix}`, owner });
  const core = resolvedReferenceCore(host.hero,owner,`${owner.actorId}:${owner.epoch}:QP`);
  if (!core.ok) return core;
  const primary = calculateBaseStats(host.hero);
  const scaling = composeBonusScaling({ STR: primary.str, VIT: primary.vit, DEX: primary.dex, INT: primary.int },
    { STR: bonusSTRCoefficient });
  if (!scaling.ok) return scaling;
  const identity = Object.freeze({ instanceId: state.item.id, kind: 'weapon' as const, owner });
  const prepared = prepareRawAttackExecution({
    context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: `${owner.actorId}:${owner.epoch}:QP:${++state.serial}`,
      owner, mode: 'SINGLE_MAIN', dualWeaponAuthorized: false, thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } },
    core: core.value,
    layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON', state.item.id),
      composition: { stage: 'BASE', range: weaponRange(checked.value), enhancementMultiplier: 1, contributionMultiplier: 1 } } },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
    rankBudget: { coefficient: coefficient, scaling: scaling.value, source: source('SKILL_RANK', `${definition.id}:rank${rank}`) }, hits: [{ hand: 'MAIN', weight: 1 }],
  });
  if (!prepared.ok) return prepared;
  // Existing derivedStats reconciles transient fields. Evaluate an identical
  // admitted clone so a later rejected RNG sample cannot mutate the live Hero.
  const stats = Object.freeze(derivedStats({ ...host.hero, activeBuffs: { ...host.hero.activeBuffs },
    temporaryModifiers: host.hero.temporaryModifiers?.slice() }));
  if (primaryKeys.some(key=>stats[key]!==15+host.hero.allocatedStats[key]!) ||
      [stats.bossDamage, stats.eliteDamage, stats.physicalPenetration, stats.magicPenetration, stats.skillDamage].some(n => n !== 0))
    return failure('UNSUPPORTED_RESOLVED_BONUS', 'resolvedStats');
  const metadata: SkillDefinition = { ...definition, baseDamage: 0, physicalCoefficient: 0, magicCoefficient: 0,
    skillPowerCoefficient: 0, statScaling: {}, baseDamageMinByRank: undefined, baseDamageMaxByRank: undefined,
    skillPowerFactor: 0, rankPowerFactorByRank: [1,1,1,1,1],
    rankValues: approved[skillIndex].map(([, , mp, cd]) => ({physicalCoefficient: 0, statScaling: {}, manaCost: mp, cooldown: cd})),
    knockbackStrength: 0 };
  const action = resolveSkillAction(metadata, { stats, rank, masteryPower: 1, masteryCooldown: 1,
    equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'one_hand_sword',
    rng: () => { throw new Error('Power metadata must not draw RNG'); } });
  if (action.manaCost !== mana || action.cooldown !== cooldown || action.range !== 3.8 || action.hitSequence.length !== 1 ||
      action.hitSequence[0].delay !== 0 || action.damageMultiplier !== 1 || action.hitSequence[0].damageMultiplier !== 1 ||
      action.hitSequence[0].baseDamage !== 0 || action.hitSequence[0].knockbackStrength !== 0 ||
      action.statuses.length || action.targetModifiers.length || action.actionLockDuration !== 0)
    return failure('UNSUPPORTED_ACTION_METADATA', 'action');
  return Object.freeze({ ok: true, value: Object.freeze({ snapshot: prepared.value, stats, action, hero: host.hero, rank }) });
}

function validDefinition(definition: SkillDefinition, index: number, rank: number): boolean {
  const source=ADVENTURER_V3_SKILLS[index], table=approved[index];
  return definition===ADVENTURER_V3_RUNTIME_SKILLS[index] &&
    definition.id===ADVENTURER_RANKS_REFERENCE.skills[index] &&
    definition.name===['Quick Slash','Power Strike'][index] && definition.slot===index+1 &&
    definition.job==='adventurer' && definition.specialization===null &&
    definition.unlockLevel===1 && definition.maxLevel===5 && definition.castingTime===.35 &&
    definition.range===3.8 && definition.targetType==='single' && definition.effect==='damage' &&
    definition.damageType==='physical' && definition.canCrit===true && definition.progressionMode==='rank_values' &&
    source.spCostPerRank===1 && source.rankLevelRequirements?.length===5 &&
    table.every(([c,str,mp,cd,gate],i)=>source.rankLevelRequirements![i]===gate &&
      definition.rankValues?.[i]?.physicalCoefficient===c && definition.rankValues[i]?.statScaling?.str===str &&
      dataObject(definition.rankValues[i].statScaling) && Object.keys(definition.rankValues[i].statScaling!).length===1 &&
      definition.rankValues[i].manaCost===mp && definition.rankValues[i].cooldown===cd) &&
    definition.rankValues?.length===5 && rank>=1 && rank<=5 &&
    definition.physicalCoefficient===table[0][0] && definition.statScaling?.str===table[0][1] &&
    definition.manaCost===table[0][2] && definition.cooldown===table[0][3] &&
    definition.weaponRequirement?.length===1 && definition.weaponRequirement[0]==='one_hand_sword' &&
    definition.hitSequence===undefined && definition.castTiming===undefined && definition.statusEffect===null &&
    definition.modifiers===undefined && definition.statuses===undefined && definition.rankMechanics===undefined &&
    definition.temporaryBuffs===undefined && definition.weaponMode===undefined && !definition.nonDamaging &&
    definition.tags?.length===1 && definition.tags[0]==='v3-adventurer';
}
/** Identity-only recheck after sampling; never recomposes the immutable budget. */
export function currentAdventurerRanksBinding(binding: AdventurerRanksBinding, host: Host): boolean {
  const state = bindings.get(binding);
  if (!state || state.host !== host || state.stale) return false;
  if (host.hero !== state.hero || state.signature !== rankSignature(host.hero) || host.hero.characterId !== state.owner.actorId || host.hero.slotId !== state.slotId ||
      host.hero.equipment.mainHand !== state.itemId ||
      host.hero.inventory.filter(item => item.id === state.itemId).length !== 1 ||
      host.hero.inventory.find(item => item.id === state.itemId) !== state.item) {
    state.stale = true; return false;
  }
  return true;
}
