import {approvedEquipmentEnabled} from './public-rollout';
import type { ItemData, StatBlock } from './items.ts';
import { WEAPON_VALUES, weaponProfileId, type WeaponFamily } from './weapon-progression-v1.ts';

/** Versioned core authoring. Metadata is never equip/cast authority. */
export const EQUIPMENT_AUTHORING_VERSION = 'EQUIPMENT_CORE_4_PERCENT_V1' as const;
export const TRAINING_DAGGER_PROFILE = 'TRAINING_DAGGER_LV1_BASE_V1' as const;
export const TRAINING_DAGGER_TEMPLATE = 'field-verdant-plains-dagger' as const;
export type BodySlot = 'head' | 'chest' | 'gloves' | 'legs' | 'boots';
export type BodyFrame = 'balanced' | 'physical' | 'magic';
export type EquipmentProfile = Readonly<{
  id: string; version: typeof EQUIPMENT_AUTHORING_VERSION; kind: 'WEAPON' | 'BODY' | 'SHIELD';
  requiredLevel: number; slot: 'mainHand' | 'offHand' | BodySlot; frame?: BodyFrame;
  PATK?: Readonly<{ min: number; max: number }>;
  MATK?: Readonly<{ min: number; max: number }>;
  PDEF?: number; MDEF?: number; referenceAppliedAtAuthoring: true;
}>;
type Unavailable = Readonly<{ok: false; reason: string}>;
const fail = (reason: string): Unavailable => Object.freeze({ok: false, reason});

export const TRAINING_DAGGER_CORE: EquipmentProfile = Object.freeze({
  id: TRAINING_DAGGER_PROFILE, version: EQUIPMENT_AUTHORING_VERSION,
  kind: 'WEAPON', requiredLevel: 1, slot: 'mainHand',
  PATK: Object.freeze({min: 8, max: 11}), referenceAppliedAtAuthoring: true,
});

// Exact approved run-02 authored values, generated from its byte-pinned table.
// Table insertion below keeps rounding at authoring, never per actor/level/frame runtime.
const BODY_VALUES: readonly (readonly [number, BodyFrame, BodySlot, number, number])[] = [
  [1,'balanced','head',3,3],
  [1,'balanced','chest',10,10],
  [1,'balanced','gloves',3,3],
  [1,'balanced','legs',3,3],
  [1,'balanced','boots',3,3],
  [1,'physical','head',4,2],
  [1,'physical','chest',13,8],
  [1,'physical','gloves',4,2],
  [1,'physical','legs',4,2],
  [1,'physical','boots',4,2],
  [1,'magic','head',2,4],
  [1,'magic','chest',8,13],
  [1,'magic','gloves',2,4],
  [1,'magic','legs',2,4],
  [1,'magic','boots',2,4],
  [5,'balanced','head',4,4],
  [5,'balanced','chest',15,15],
  [5,'balanced','gloves',3,3],
  [5,'balanced','legs',4,4],
  [5,'balanced','boots',4,4],
  [5,'physical','head',5,3],
  [5,'physical','chest',19,11],
  [5,'physical','gloves',4,2],
  [5,'physical','legs',5,3],
  [5,'physical','boots',5,3],
  [5,'magic','head',3,5],
  [5,'magic','chest',11,19],
  [5,'magic','gloves',2,4],
  [5,'magic','legs',3,5],
  [5,'magic','boots',3,5],
  [10,'balanced','head',6,6],
  [10,'balanced','chest',19,19],
  [10,'balanced','gloves',4,4],
  [10,'balanced','legs',6,6],
  [10,'balanced','boots',6,6],
  [10,'physical','head',8,5],
  [10,'physical','chest',24,14],
  [10,'physical','gloves',5,3],
  [10,'physical','legs',8,5],
  [10,'physical','boots',8,5],
  [10,'magic','head',5,8],
  [10,'magic','chest',14,24],
  [10,'magic','gloves',3,5],
  [10,'magic','legs',5,8],
  [10,'magic','boots',5,8],
  [15,'balanced','head',8,8],
  [15,'balanced','chest',23,23],
  [15,'balanced','gloves',6,6],
  [15,'balanced','legs',8,8],
  [15,'balanced','boots',8,8],
  [15,'physical','head',10,6],
  [15,'physical','chest',29,17],
  [15,'physical','gloves',8,5],
  [15,'physical','legs',10,6],
  [15,'physical','boots',10,6],
  [15,'magic','head',6,10],
  [15,'magic','chest',17,29],
  [15,'magic','gloves',5,8],
  [15,'magic','legs',6,10],
  [15,'magic','boots',6,10],
  [25,'balanced','head',11,11],
  [25,'balanced','chest',34,34],
  [25,'balanced','gloves',8,8],
  [25,'balanced','legs',11,11],
  [25,'balanced','boots',11,11],
  [25,'physical','head',14,8],
  [25,'physical','chest',43,26],
  [25,'physical','gloves',10,6],
  [25,'physical','legs',14,8],
  [25,'physical','boots',14,8],
  [25,'magic','head',8,14],
  [25,'magic','chest',26,43],
  [25,'magic','gloves',6,10],
  [25,'magic','legs',8,14],
  [25,'magic','boots',8,14],
  [40,'balanced','head',16,16],
  [40,'balanced','chest',49,49],
  [40,'balanced','gloves',12,12],
  [40,'balanced','legs',16,16],
  [40,'balanced','boots',16,16],
  [40,'physical','head',20,12],
  [40,'physical','chest',61,37],
  [40,'physical','gloves',15,9],
  [40,'physical','legs',20,12],
  [40,'physical','boots',20,12],
  [40,'magic','head',12,20],
  [40,'magic','chest',37,61],
  [40,'magic','gloves',9,15],
  [40,'magic','legs',12,20],
  [40,'magic','boots',12,20],
  [60,'balanced','head',22,22],
  [60,'balanced','chest',71,71],
  [60,'balanced','gloves',16,16],
  [60,'balanced','legs',22,22],
  [60,'balanced','boots',22,22],
  [60,'physical','head',28,17],
  [60,'physical','chest',89,53],
  [60,'physical','gloves',20,12],
  [60,'physical','legs',28,17],
  [60,'physical','boots',28,17],
  [60,'magic','head',17,28],
  [60,'magic','chest',53,89],
  [60,'magic','gloves',12,20],
  [60,'magic','legs',17,28],
  [60,'magic','boots',17,28],
  [67,'balanced','head',24,24],
  [67,'balanced','chest',79,79],
  [67,'balanced','gloves',18,18],
  [67,'balanced','legs',24,24],
  [67,'balanced','boots',24,24],
  [67,'physical','head',30,18],
  [67,'physical','chest',99,59],
  [67,'physical','gloves',23,14],
  [67,'physical','legs',30,18],
  [67,'physical','boots',30,18],
  [67,'magic','head',18,30],
  [67,'magic','chest',59,99],
  [67,'magic','gloves',14,23],
  [67,'magic','legs',18,30],
  [67,'magic','boots',18,30],
  [74,'balanced','head',26,26],
  [74,'balanced','chest',87,87],
  [74,'balanced','gloves',20,20],
  [74,'balanced','legs',26,26],
  [74,'balanced','boots',26,26],
  [74,'physical','head',33,20],
  [74,'physical','chest',109,65],
  [74,'physical','gloves',25,15],
  [74,'physical','legs',33,20],
  [74,'physical','boots',33,20],
  [74,'magic','head',20,33],
  [74,'magic','chest',65,109],
  [74,'magic','gloves',15,25],
  [74,'magic','legs',20,33],
  [74,'magic','boots',20,33],
  [80,'balanced','head',28,28],
  [80,'balanced','chest',93,93],
  [80,'balanced','gloves',21,21],
  [80,'balanced','legs',28,28],
  [80,'balanced','boots',28,28],
  [80,'physical','head',35,21],
  [80,'physical','chest',116,70],
  [80,'physical','gloves',26,16],
  [80,'physical','legs',35,21],
  [80,'physical','boots',35,21],
  [80,'magic','head',21,35],
  [80,'magic','chest',70,116],
  [80,'magic','gloves',16,26],
  [80,'magic','legs',21,35],
  [80,'magic','boots',21,35],
  [87,'balanced','head',31,31],
  [87,'balanced','chest',98,98],
  [87,'balanced','gloves',23,23],
  [87,'balanced','legs',31,31],
  [87,'balanced','boots',31,31],
  [87,'physical','head',39,23],
  [87,'physical','chest',123,74],
  [87,'physical','gloves',29,17],
  [87,'physical','legs',39,23],
  [87,'physical','boots',39,23],
  [87,'magic','head',23,39],
  [87,'magic','chest',74,123],
  [87,'magic','gloves',17,29],
  [87,'magic','legs',23,39],
  [87,'magic','boots',23,39],
  [95,'balanced','head',33,33],
  [95,'balanced','chest',108,108],
  [95,'balanced','gloves',25,25],
  [95,'balanced','legs',33,33],
  [95,'balanced','boots',33,33],
  [95,'physical','head',41,25],
  [95,'physical','chest',135,81],
  [95,'physical','gloves',31,19],
  [95,'physical','legs',41,25],
  [95,'physical','boots',41,25],
  [95,'magic','head',25,41],
  [95,'magic','chest',81,135],
  [95,'magic','gloves',19,31],
  [95,'magic','legs',25,41],
  [95,'magic','boots',25,41],
];
export const BODY_CORE_PROFILES: readonly EquipmentProfile[] = Object.freeze(BODY_VALUES.map(([level,frame,slot,PDEF,MDEF]) => Object.freeze({
  id: `BODY_LV${level}_${frame}_${slot}_V1`, version: EQUIPMENT_AUTHORING_VERSION,
  kind: 'BODY' as const, requiredLevel: level, slot, frame, PDEF, MDEF,
  referenceAppliedAtAuthoring: true as const,
})));
export const WEAPON_CORE_PROFILES: readonly EquipmentProfile[] = Object.freeze(WEAPON_VALUES.map(([family,level,pmin,pmax,mmin,mmax]) => Object.freeze({
  id:weaponProfileId(family,level),version:EQUIPMENT_AUTHORING_VERSION,kind:'WEAPON' as const,requiredLevel:level,slot:'mainHand' as const,
  PATK:Object.freeze({min:pmin,max:pmax}),...(mmin === null || mmax === null ? {} : {MATK:Object.freeze({min:mmin,max:mmax})}),referenceAppliedAtAuthoring:true as const,
})));
const profiles = new Map([...WEAPON_CORE_PROFILES, ...BODY_CORE_PROFILES].map(p => [p.id,p]));
export const getEquipmentProfile = (id: string) => profiles.get(id) ?? null;

/** Pure mathematical projection. Does not manufacture an item, permission or receipt. */
export function resolveEquipmentCore(profileId: string, enhancement: number) {
  const profile = profiles.get(profileId);
  if (!profile) return fail('UNKNOWN_PROFILE');
  if (!Number.isSafeInteger(enhancement) || enhancement < 0 || enhancement > 15) return fail('INVALID_ENHANCEMENT');
  const multiplier = 1 + .04 * enhancement;
  const range = (r: Readonly<{min:number;max:number}> | undefined) => r ? Object.freeze({min:r.min*multiplier,max:r.max*multiplier}) : null;
  return Object.freeze({ok:true as const, version:EQUIPMENT_AUTHORING_VERSION, profile,
    enhancement, multiplier, PATK:range(profile.PATK), MATK:range(profile.MATK),
    PDEF:profile.PDEF === undefined ? null : profile.PDEF*multiplier,
    MDEF:profile.MDEF === undefined ? null : profile.MDEF*multiplier,
    authority:'MATHEMATICAL_PROFILE_NOT_EQUIP_OR_CAST_PERMISSION' as const});
}

export const hasEquipmentAuthoring = (item: Partial<ItemData>) =>
  item.authoredEquipmentVersion !== undefined || item.authoredEquipmentProfile !== undefined;

// Exact Common field definitions only. Protected Training/Iron Sword and named Meteor
// Sword retain their original authoring. Named weapons are not inferred from their type.
const fields = [['verdant-plains','Training',1],['ironveil-mines','Iron',8],['whispering-wilds','Wildwood',16],['frostfire-highlands','Frostfire',24],['sunken-ruins','Ruin',32],['meteorfall-citadel','Meteor',42]] as const;
const fieldTypes = [['sword','Sword','one_hand_sword','sword_dagger','melee'],['dagger','Dagger','dagger','dagger','melee'],['staff','Staff','staff','staff','magic'],['bow','Bow','bow','bow','ranged'],['mace','Mace','mace','mace','hybrid']] as const;
export const DEVELOPMENT_WEAPON_MAPPINGS = Object.freeze(fields.flatMap(([field,prefix,level]) => fieldTypes.flatMap(([type,label,family,weaponType,attackType]) => {
  if(type==='sword' && ![16,24,32].includes(level))return [];
  return [Object.freeze({templateId:`field-${field}-${type}`,name:`${prefix} ${label}`,level,type,family:family as WeaponFamily,weaponType,attackType,
    jobs:Object.freeze(type==='sword'?['warrior','rogue']:type==='dagger'?['rogue']:type==='staff'?['wizard','acolyte']:type==='bow'?['hunter']:['warrior','acolyte']),
    twoHanded:type==='staff'||type==='bow',scalar:8+Math.floor(level*.8),profile:weaponProfileId(family,level)})];
})));
const mappedItem = (item:Partial<ItemData>) => DEVELOPMENT_WEAPON_MAPPINGS.find(m=>m.templateId===item.templateId);
/** OWNER: five existing identities, balanced Lv1 only; fixed bonuses remain item sources. */
export const DEVELOPMENT_BODY_MAPPINGS = Object.freeze([
  ['arunika-head','Arunika Dawn Circlet','head'],
  ['forest-vest','Wildwarden Vest','chest'],
  ['arunika-gloves','Bronzegrip Gauntlets','gloves'],
  ['arunika-legs','Woven Trailguards','legs'],
  ['arunika-boots','Wildwood Striders','boots'],
].map(([templateId,name,slot])=>Object.freeze({templateId,name,slot:slot as BodySlot,profile:`BODY_LV1_balanced_${slot}_V1`})));
const mappedBody = (item:Partial<ItemData>) => DEVELOPMENT_BODY_MAPPINGS.find(m=>m.templateId===item.templateId);
function bodyMappingMatches(item:Partial<ItemData>,m:typeof DEVELOPMENT_BODY_MAPPINGS[number]) {
  const expected=m.slot==='chest'?{defense:10,dex:2,evasion:2}:{defense:3,hp:8};
  return item.name===m.name && item.category==='armor' && item.itemType===m.slot && item.equipSlot===m.slot &&
    item.levelRequirement===1 && item.rarity==='rare' && item.authoredAttackVersion===undefined &&
    Object.entries(expected).every(([k,v])=>item.baseStats?.[k as keyof StatBlock]===v) &&
    Object.entries(item.baseStats??{}).every(([k,v])=>v===0||expected[k as keyof typeof expected]===v);
}
function mappingMatches(item:Partial<ItemData>,m:typeof DEVELOPMENT_WEAPON_MAPPINGS[number]) {
  return item.name===m.name && item.category==='weapon' && item.itemType===m.type && item.equipmentType===m.family && item.weaponType===m.weaponType &&
    item.handedness===(m.twoHanded?'two_hand':'one_hand') && item.attackType===m.attackType && item.mainHand===true && item.offHand===false &&
    item.twoHanded===m.twoHanded && item.equipSlot==='mainHand' && item.levelRequirement===m.level && item.rarity==='common' &&
    item.baseStats?.attack===m.scalar && item.authoredAttackVersion===undefined &&
    item.requiredCoreJob==null && item.requiredSpecialJob==null &&
    item.allowedJobs?.length===m.jobs.length && m.jobs.every(job=>item.allowedJobs?.includes(job as ItemData['allowedJobs'][number])) &&
    (m.type==='dagger'?item.allowedJobFamily==='THIEF_LINEAGE':item.allowedJobFamily==null);
}

/** Validated source range, not owned-item/actor permission. Options and Rune remain separate. */
export function resolveAuthoredEquipmentItem(item: Partial<ItemData>) {
  if (!hasEquipmentAuthoring(item)) return fail('LEGACY_UNMARKED');
  if (item.authoredEquipmentVersion !== EQUIPMENT_AUTHORING_VERSION) return fail('UNKNOWN_AUTHORING_VERSION');
  const body=mappedBody(item);
  if(body) {
    if(item.authoredEquipmentProfile!==body.profile)return fail('ITEM_MAPPING_NOT_APPROVED');
    if(!bodyMappingMatches(item,body))return fail('CONTRADICTORY_ITEM_MAPPING');
    const core=resolveEquipmentCore(body.profile,item.enhancementLevel!);if(!core.ok)return core;
    const retainedBase:StatBlock={...item.baseStats};delete retainedBase.defense;delete retainedBase.magicDefense;
    return Object.freeze({...core,retainedBase:Object.freeze(retainedBase),
      compatibilityBase:Object.freeze({...retainedBase,defense:core.PDEF!,magicDefense:core.MDEF!}),
      legacyCombat:'SCALAR_COMPATIBILITY_NOT_AUTHORED_RANGE' as const,
      bonusLayers:'OPTIONS_RUNE_SET_CONDITIONAL_RETAIN_SEPARATE' as const});
  }
  const mapping=mappedItem(item);
  if (!mapping || item.authoredEquipmentProfile !== mapping.profile) return fail('ITEM_MAPPING_NOT_APPROVED');
  if (!mappingMatches(item,mapping)) return fail('CONTRADICTORY_ITEM_MAPPING');
  const core = resolveEquipmentCore(mapping.profile,item.enhancementLevel!);
  if (!core.ok) return core;
  const retainedBase: StatBlock = {...item.baseStats};
  // Compatibility scalar is explicitly separate from authored PATK range.
  // Generic legacy combat has not become an authored physical/magic range sampler.
  const compatibilityBase: StatBlock = {...retainedBase, attack:mapping.scalar*core.multiplier};
  delete retainedBase.attack;
  return Object.freeze({...core, retainedBase:Object.freeze(retainedBase), compatibilityBase:Object.freeze(compatibilityBase),
    legacyCombat:'SCALAR_COMPATIBILITY_NOT_AUTHORED_RANGE' as const,
    bonusLayers:'OPTIONS_RUNE_SET_CONDITIONAL_RETAIN_SEPARATE' as const});
}

/** New acquisition only. Does not enroll an actor or change weapon permissions. */
export function developmentEquipmentAuthoring(item: ItemData): ItemData {
  if (!approvedEquipmentEnabled() || hasEquipmentAuthoring(item)) return item;
  const body=mappedBody(item);
  if(body&&bodyMappingMatches(item,body))return {...item,authoredEquipmentVersion:EQUIPMENT_AUTHORING_VERSION,authoredEquipmentProfile:body.profile};
  const mapping=mappedItem(item);
  if(!mapping || !mappingMatches(item,mapping))return item;
  return {...item, authoredEquipmentVersion:EQUIPMENT_AUTHORING_VERSION, authoredEquipmentProfile:mapping.profile};
}

/** Progression density only: no wallet, bonus values, catalog IDs or requirements. */
export const JEWELRY_COVERAGE_TIERS = Object.freeze([1,15,32,40,60,80,95].map(coverageLevel => Object.freeze({
  coverageLevel, blueprintTier:coverageLevel === 15 ? 1 : coverageLevel === 40 ? 32 : coverageLevel,
  duplicateTemplateRequired:false, numericOptions:'HOLD' as const,
})));
