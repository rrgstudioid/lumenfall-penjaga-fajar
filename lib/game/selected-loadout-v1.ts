import { ITEM_CATALOG, canEquipItem, type ItemData } from './items.ts';
import type { Hero } from './rules.ts';
import { DEVELOPMENT_BODY_MAPPINGS, DEVELOPMENT_WEAPON_MAPPINGS, hasEquipmentAuthoring, resolveAuthoredEquipmentItem } from './equipment-authoring-v1.ts';
import { ironSwordAuthoredRange } from './iron-sword-range-v2.ts';
import { jayantaraAuthoredRange } from './jayantara-range-v3.ts';

export const SELECTED_LOADOUT_VERSION='BALANCED_FIVE_OWNED_LOADOUT_V1';
const bodySlots=new Set(DEVELOPMENT_BODY_MAPPINGS.map(m=>m.slot));
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const catalogProof=new Map([...DEVELOPMENT_BODY_MAPPINGS,...DEVELOPMENT_WEAPON_MAPPINGS].map(m=>[m.templateId,JSON.stringify(ITEM_CATALOG[m.templateId])]));
const failure=(code:string,path:string)=>Object.freeze({ok:false as const,code,path,reason:`${code} (${path})`});
const zero=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(n=>n===0);

/** Empty sockets are inert. Applied sources are rejected explicitly, never stripped. */
export function selectedItemSources(item:ItemData,allowFixedBonus=false) {
  if(!Array.isArray(item.sockets)||item.sockets.some(s=>!s||s.rune!==null))return failure('UNSUPPORTED_APPLIED_RUNE','item.sockets');
  if(!Array.isArray(item.affixes)||item.affixes.length)return failure('UNSUPPORTED_ITEM_AFFIX','item.affixes');
  if(!item.skillModifiers||Object.keys(item.skillModifiers).length||item.uniqueEffect!==null||item.uniqueEffectData!==undefined||item.runeRarity!==null||item.runeTheme!==null||item.runeSource!==null||item.runeJobRequirement!==null)return failure('UNSUPPORTED_ITEM_EFFECT','item');
  const template=ITEM_CATALOG[item.templateId];
  if(!allowFixedBonus&&!zero(item.bonusStats)||allowFixedBonus&&(!template||!equal(item.bonusStats,template.bonusStats)))return failure('UNSUPPORTED_ITEM_BONUS','item.bonusStats');
  if(typeof item.uniqueStatsLocked!=='boolean')return failure('INVALID_BONUS_LOCK','item.uniqueStatsLocked');
  return Object.freeze({ok:true as const});
}

/** Full owned equipment-link validation, without changing equipment or opening a binding. */
export function validateSelectedBodyLoadout(hero:Hero,allowedWeaponSlots:readonly string[]) {
  const linked=new Set<string>();
  for(const [slot,id] of Object.entries(hero.equipment)) {
    if(id===null)continue;
    if(typeof id!=='string'||!id.trim()||linked.has(id))return failure('DUPLICATE_OR_INVALID_EQUIPMENT_LINK',slot);
    linked.add(id);
    if(allowedWeaponSlots.includes(slot))continue;
    if(!bodySlots.has(slot as typeof DEVELOPMENT_BODY_MAPPINGS[number]['slot']))return failure('UNSUPPORTED_EQUIPMENT_SLOT',slot);
    const matches=hero.inventory.filter(i=>i.id===id);
    if(matches.length!==1)return failure('AMBIGUOUS_BODY_INSTANCE',slot);
    const item=matches[0],mapping=DEVELOPMENT_BODY_MAPPINGS.find(m=>m.templateId===item.templateId),template=ITEM_CATALOG[item.templateId];
    if(!mapping||mapping.slot!==slot)return failure('BODY_IDENTITY_NOT_APPROVED',slot);
    if(!hasEquipmentAuthoring(item))return failure('LEGACY_BODY_COMPATIBILITY',slot);
    const authored=resolveAuthoredEquipmentItem(item);if(!authored.ok)return failure(authored.reason,slot);
    if(catalogProof.get(item.templateId)!==JSON.stringify(template))return failure('CATALOG_PROVENANCE',slot);
    if(!item.isEquipped||item.quantity!==1||!canEquipItem(item,hero,mapping.slot).ok)return failure('ILLEGAL_BODY_EQUIP',slot);
    const keys=['equipmentType','handedness','attackType','mainHand','offHand','twoHanded','allowedJobs','allowedJobFamily','allowedSlots','requiredCoreJob','requiredSpecialJob','jobRequirement','requiredGender'] as const;
    if(keys.some(k=>!equal(item[k],template[k])))return failure('CONTRADICTORY_BODY_PERMISSION',slot);
    const sources=selectedItemSources(item,true);if(!sources.ok)return sources;
  }
  if(hero.inventory.some(i=>i.isEquipped&&!linked.has(i.id)))return failure('ORPHAN_EQUIPPED_INSTANCE','inventory');
  return Object.freeze({ok:true as const});
}

/** Resolved continuous weapon layer; this readout alone grants no actor permission. */
export function selectedPhysicalWeaponRange(item:ItemData) {
  const anchor=ironSwordAuthoredRange(item)??jayantaraAuthoredRange(item);if(anchor)return anchor;
  const authored=resolveAuthoredEquipmentItem(item);return authored.ok?authored.PATK:null;
}

export function validateMappedWarriorSword(hero:Hero,item:ItemData) {
  const mapping=DEVELOPMENT_WEAPON_MAPPINGS.find(m=>m.templateId===item.templateId&&m.type==='sword');
  if(!mapping)return failure('WEAPON_MAPPING_NOT_IN_SCOPE','MAIN');
  const authored=resolveAuthoredEquipmentItem(item);if(!authored.ok)return failure(authored.reason,'MAIN');
  if(catalogProof.get(item.templateId)!==JSON.stringify(ITEM_CATALOG[item.templateId]))return failure('CATALOG_PROVENANCE','MAIN');
  if(!item.id.trim()||item.quantity!==1||!item.isEquipped||!canEquipItem(item,hero,'mainHand').ok)return failure('ILLEGAL_WEAPON_EQUIP','MAIN');
  if(Object.entries(item.baseStats).some(([key,value])=>key!=='attack'&&value!==0))return failure('UNSUPPORTED_WEAPON_PRIMARY','MAIN');
  return selectedItemSources(item);
}
