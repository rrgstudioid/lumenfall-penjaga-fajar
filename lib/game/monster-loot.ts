import { ITEM_CATALOG, createItem, createRuneItem, type ItemData, type ItemRarity, type ItemSource, type RuneRarity, type RuneTheme } from './items.ts';
import { FIELDS, fieldContent, type MonsterVariant, type MonsterDefinition } from './regions.ts';

export type Weighted<T> = { value: T; weight: number };
export type LootFamily = 'material'|'potion'|'supplies'|'equipment'|'rune'|'uniqueRune'|'pet'|'fate'|'seal'|'optimizer';
const weights = <T extends string>(values:Partial<Record<T,number>>):Weighted<T>[] => Object.entries(values).map(([value,weight])=>({value:value as T,weight:weight as number}));
// These are conditional percentages after the monster's independent drop-chance check.
export const MONSTER_LOOT_PROFILES:Record<MonsterVariant,Weighted<LootFamily>[]> = {
  normal:weights({material:44,potion:25,supplies:8,equipment:18,rune:3,pet:.5,fate:1,optimizer:.5}),
  elite:weights({material:28,potion:15,supplies:5,equipment:35,rune:10,pet:1,fate:3,seal:1,optimizer:2}),
  boss:weights({material:12,potion:4,supplies:1,equipment:50,rune:20,uniqueRune:2,pet:1,fate:3,seal:3,optimizer:4}),
};
export const EQUIPMENT_DROP_RARITIES:Record<MonsterVariant,Weighted<ItemRarity>[]> = {
  normal:weights({common:60,uncommon:28,rare:10,epic:2}),
  elite:weights({uncommon:25,rare:50,epic:23,legendary:2}),
  boss:weights({epic:70,legendary:28,mythic:2}),
};
export const RUNE_DROP_RARITIES:Record<MonsterVariant,Weighted<RuneRarity>[]> = {
  normal:weights({cracked:65,simple:30,refined:5}),
  elite:weights({refined:65,rare:30,epic:5}),
  boss:weights({epic:70,legendary:29,ancient:1}),
};
export const BOSS_RUNE_DROPS:Record<string,string> = {'verdant-plains':'rune-akar-purba','ironveil-mines':'rune-penjaga-langit','whispering-wilds':'rune-bayangan-caroq','frostfire-highlands':'rune-inti-bara','sunken-ruins':'rune-mata-jayantara','meteorfall-citadel':'rune-raja-meteor'};
export function weightedPick<T>(entries:Weighted<T>[],rng:()=>number=Math.random):T {
  const total=entries.reduce((sum,entry)=>sum+Math.max(0,entry.weight),0);
  if(!entries.length||total<=0)throw new Error('Empty loot pool');
  let roll=Math.max(0,Math.min(.999999999,rng()))*total;
  for(const entry of entries){roll-=Math.max(0,entry.weight);if(roll<0)return entry.value;}
  return entries[entries.length-1].value;
}
export function monsterDropChance(monster:Pick<MonsterDefinition,'dropRate'>,itemDropBonus=0){
  return Math.min(1,Math.max(0,monster.dropRate)*(1+Math.max(0,itemDropBonus)/100));
}
export function equipmentDropPool(fieldId:string,specialization:string|null=null):Weighted<string>[] {
  const field=fieldContent(fieldId);
  return Object.values(ITEM_CATALOG).filter(item=>['weapon','armor','accessory'].includes(item.category)&&item.equipSlot&&!item.isQuestItem&&!item.isSoulbound&&
    item.levelRequirement<=field.maxLevel&&(!item.requiredSpecialJob||item.requiredSpecialJob===specialization)&&
    (!item.templateId.startsWith('field-')||item.templateId.startsWith(`field-${field.id}-`)))
    .map(item=>({value:item.templateId,weight:item.templateId.startsWith('field-')?3:1}));
}
export function lootItemPool(fieldId:string,variant:MonsterVariant,family:LootFamily,specialization:string|null=null):Weighted<string>[] {
  const field=fieldContent(fieldId);
  const potionTier=field.minLevel>=32?3:field.minLevel>=16?2:1;
  switch(family){
    case 'material':return field.materialTable.filter(entry=>ITEM_CATALOG[entry.id]).map(entry=>({value:entry.id,weight:entry.chance}));
    case 'potion':return weights({[`health-potion-${potionTier}`]:1,[`mana-potion-${potionTier}`]:1});
    case 'supplies':return weights({arrows:60,'rice-meal':30,magnifier:10});
    case 'equipment':return equipmentDropPool(field.id,specialization);
    case 'rune':return Object.values(ITEM_CATALOG).filter(item=>item.itemType==='socketRune'&&!item.uniqueEffect).map(item=>({value:item.templateId,weight:1}));
    case 'uniqueRune':return [{value:BOSS_RUNE_DROPS[field.id],weight:1}];
    case 'pet':return [{value:'adventurer-pet-egg',weight:1}];
    case 'fate':return [{value:'fate-rune-fragment',weight:1}];
    case 'seal':return [{value:'eternal-seal',weight:1}];
    case 'optimizer':return variant==='boss'?weights({'rune-optimizer-chromatic':60,'rune-stabilizer':25,'rune-optimizer-greater-chromatic':12,'rune-optimizer-perfect-chromatic':3}):[{value:variant==='elite'?'rune-stabilizer':'rune-optimizer-basic',weight:1}];
  }
}
export function rollMonsterItem(fieldId:string,variant:MonsterVariant,specialization:string|null,sourceId:string,rng:()=>number=Math.random,categoryRoll?:number):ItemData {
  const field=FIELDS[fieldId]??FIELDS['verdant-plains'];
  const family=weightedPick(MONSTER_LOOT_PROFILES[variant],categoryRoll===undefined?rng:()=>categoryRoll);
  const templateId=weightedPick(lootItemPool(field.id,variant,family,specialization),rng);
  const template=ITEM_CATALOG[templateId];
  const species=[...field.normalMonsters,...field.eliteMonsters,field.fieldBoss].find(monster=>monster.id===sourceId);
  const source:ItemSource={type:variant==='boss'?(field.id==='meteorfall-citadel'?'high_boss':'field_boss'):variant==='elite'?'elite':'monster',sourceId,label:`${species?.name??variant} · ${field.displayName}`};
  if(family==='rune'||family==='uniqueRune'){
    const rarity=family==='uniqueRune'?template.runeRarity??'ancient':weightedPick(RUNE_DROP_RARITIES[variant],rng);
    return createRuneItem(template.runeTheme as RuneTheme,rarity,{templateId,name:template.name,icon:template.icon,runeSource:template.runeSource,runeJobRequirement:template.runeJobRequirement,requiredCoreJob:template.requiredCoreJob,uniqueEffect:template.uniqueEffect,source});
  }
  const overrides:Partial<ItemData>={source,quantity:templateId==='arrows'?10:templateId==='lumut-fiber'?2:1};
  if(family==='equipment')overrides.rarity=weightedPick(EQUIPMENT_DROP_RARITIES[variant],rng);
  return createItem(templateId,overrides);
}
