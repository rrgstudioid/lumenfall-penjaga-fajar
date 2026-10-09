import { IRONVEIL_ID, IRONVEIL_ENTRY, IRONVEIL_ENTRANCE, IRONVEIL_POCKETS } from './ironveil-mines-layout.ts';
import { PLAINS_ID, PLAINS_ENTRY, PLAINS_EXIT } from './verdant-plains-layout.ts';
import { WILDS_ID, WILDS_ENTRY, WILDS_LANDMARKS } from './whispering-wilds-layout.ts';
import { FROSTFIRE_ID, FROSTFIRE_ENTRY, FROSTFIRE_ZONES } from './frostfire-highlands-layout.ts';
import type { Hero } from './rules.ts';
import { SUNKEN_ID, SUNKEN_ENTRY, SUNKEN_PORTALS, SUNKEN_ZONES } from './sunken-ruins-layout.ts';
import { DEEP_OCEAN_ID, DEEP_OCEAN_ENTRY, DEEP_OCEAN_RETURN, ABYSAL_TRENCH_ID, ABYSAL_TRENCH_ENTRY, ABYSAL_TRENCH_RETURN } from './underwater-regions.ts';
import { DEEP_OCEAN_PORTALS } from './deep-ocean-layout.ts';
import { ABYSAL_TRENCH_PORTALS } from './abysal-trench-layout.ts';
import { SERPENT_GUARDIAN_ID, SERPENT_BOSS_ID } from './sea-serpent-combat.ts';
import { getVisibleJobArchitecture, showJobQuest } from './job-presentation.ts';
import { STAMINA_ENABLED } from './gameplay-config.ts';
import { VERDANT_TERRAIN, EAST_GATE_TERRAIN } from './field-terrain.ts';

export const WORLD_CONFIG = { levelCap: 50, chapterCap: 1, inventoryCapacity: 60, storageCapacity: 120, cityScale: 1.5 };
export type MonsterVariant = 'normal' | 'elite' | 'boss';
export const MONSTER_VARIANTS: Record<MonsterVariant, { hpMultiplier:number; damageMultiplier:number; defenseMultiplier:number; expMultiplier:number; respawnTime:number; visualScale:number; nameColor:string; statusLabel:string }> = {
 normal:{hpMultiplier:1,damageMultiplier:1,defenseMultiplier:1,expMultiplier:1,respawnTime:25,visualScale:1,nameColor:'#d6e5bd',statusLabel:'Normal'},
 elite:{hpMultiplier:2.5,damageMultiplier:1.5,defenseMultiplier:1.25,expMultiplier:2,respawnTime:60,visualScale:1.5,nameColor:'#f0b66b',statusLabel:'Elite'},
 boss:{hpMultiplier:10,damageMultiplier:2,defenseMultiplier:1.5,expMultiplier:5,respawnTime:120,visualScale:2.35,nameColor:'#e8a4ee',statusLabel:'Field Boss'},
};
export type MonsterDefinition = { id: string; name: string; level: number; rank: MonsterVariant; variant: MonsterVariant; exp: number; maxHP:number; attack:number; defense:number; magicDefense:number; attackSpeed:number; movementSpeed:number; attackRange:number; dropRate:number; lootTable:string[]; respawnTime:number; visualScale:number; nameColor:string; statusLabel:string; respawn:number };
export type NpcDefinition = { id: string; name: string; type: string; service: string; services: string[]; description: string; interactionRange: number; shopInventory: string[]; x: number; z: number; fieldId?: string };
export type CityDefinition = { id: string; displayName: string; chapter: number; minLevel: number; recommendedLevel: string; npcList: NpcDefinition[]; connectedFields: string[]; unlockQuest: string | null; musicId: string; ambientId: string };
export type FieldDefinition = { id: string; cityId: string; displayName: string; codename: string; chapter: number; minLevel: number; recommendedLevel: string; maxLevel: number; subAreas: string[]; normalMonsters: MonsterDefinition[]; eliteMonsters: MonsterDefinition[]; fieldBoss: MonsterDefinition | null; dropTable: string[]; materialTable: { id: string; chance: number }[]; unlockQuest: string | null; previousField: string | null; nextMap: string | null; musicId: string; ambientId: string; isUnlocked: boolean; color: string; questList: string[]; entry: {x:number;z:number}; exit: {x:number;z:number}; contentFamilyId?:string; cityDirection?:'north'|'east'; regionType?:'field'; warpOnly?:boolean };
export type RegionQuestStatus = 'locked'|'active'|'ready_to_complete'|'completed'|'cooldown'|'available';
export type QuestReward = { xp: number; gold: number; items: Array<{ templateId: string; quantity: number }> };
export type QuestJournalEntry = {
 id: string; title: string; chapter: number; category: 'main'|'side'|'daily'|'class';
 giverNpcId: string; giverNpcName: string; giverNpcRole: string; giverMapId: string; giverMapName: string;
 recommendedLevel: number; requiredLevel: number; requiredQuestIds: string[]; requiredMapId: string|null; requiredJob: string|null;
 targetMapId: string; targetMapName: string; description: string; objectives: Array<{type:string;targetId:string;targetName:string;required:number}>;
 rewards: QuestReward; repeatable: boolean; cooldownHours: number; status: RegionQuestStatus; progress: Array<{current:number;required:number}>;
};

const npcServices = ['story','tutorial','core','forge','equipment','consumable','storage','healer','pet','teleport','quests'];
export const NPC_SERVICE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  story: 'Main Story', tutorial: 'Beginner Guide', core: 'Core Job Trainer',
  special: 'Specialization & Mastery', forge: 'Forge Master',
  seal: 'Runes & Seals', equipment: 'Equipment Merchant',
  consumable: 'General Merchant', storage: 'Storage Keeper', healer: 'Healer',
  pet: 'Pet Keeper', teleport: 'Teleport', quests: 'Quest Board',
  'developer-materials': 'Developer Materials',
  'field-camp': 'Field Shop · Teleport · Quests',
});
export const getNpcServiceLabel = (npc: Pick<NpcDefinition, 'service'>, hero?: Hero) => {
  const architecture = hero ? getVisibleJobArchitecture(hero) : null;
  if (architecture?.v2 && ['core','special'].includes(npc.service)) return 'Job Architecture · preview only';
  if (architecture?.v3 && npc.service === 'core') return 'Core Job Trainer · V3';
  if (architecture?.v3 && npc.service === 'special') return 'Specialization Trainer · V3';
  return NPC_SERVICE_LABELS[npc.service] ?? 'NPC Services';
};
export const getNpcDescription = (npc: NpcDefinition, hero: Hero) => {
  const architecture = getVisibleJobArchitecture(hero);
  if (architecture.v2 && ['core','special'].includes(npc.service))
    return 'Job V2 development preview. Specialization belum tersedia; tidak ada promotion melalui layanan ini.';
  if (architecture.v3 && npc.service === 'core') return 'Pilih Warrior mulai Level 15 melalui Skill Progression V3.';
  if (architecture.v3 && npc.service === 'special') return 'Pilih Berserker atau Blade Master mulai Level 60. Pilihan specialization bersifat eksklusif.';
  return npc.description;
};
// Resolve the actual city registry entry; a caller cannot grant forge access by
// passing a merchant/field NPC that merely advertises a similar service.
export function forgeAccessReason(hero: Hero, npcId: string | null | undefined): string {
  if (!hero.inCity) return 'Tempa hanya tersedia di NPC Forge Master dalam kota.';
  const npc = CITIES[hero.currentCity]?.npcList.find(n => n.id === npcId);
  if (!npc || npc.service !== 'forge' || !npc.services.includes('forge'))
    return 'Buka menu Tempa melalui NPC Forge Master.';
  if (Math.hypot(hero.x - npc.x, hero.z - npc.z) > npc.interactionRange)
    return 'Terlalu jauh dari Forge Master. Dekati NPC untuk menempa.';
  return '';
}
const serviceDescriptions: Record<string,string> = {story:'Terima dan selesaikan perjalanan utama Chapter 1.', tutorial:'Pelajari kontrol dan ambil Berkah Pijar selama 5 menit.',core:'Core Job Quest level 10.',special:'Specialization level 25 dan Mastery level 40.',forge:'Tempa equipment; tinjau bahan, peluang, dan risiko.',seal:'Fate Rune menambah peluang; Eternal Seal melindungi kegagalan.',equipment:'Semua weapon, armor, dan accessory tersedia. Syarat job dan level tetap berlaku saat dipasang.',consumable:'Ramuan dan perbekalan perjalanan.',storage:'Simpan atau ambil item di lumbung bersama kedua kota.',healer:STAMINA_ENABLED?'Pulihkan HP, Mana, dan stamina sepenuhnya.':'Pulihkan HP dan Mana sepenuhnya.',pet:'Kelola pet, passive, dan evolusi.',teleport:'Pilih field atau kota yang sudah terbuka.',quests:'Misi cerita, berburu, mengumpulkan, dan harian.'};
const servicesFor = (service:string) => service==='equipment'||service==='consumable'?['buy','sell']:service==='developer-materials'?['buy']:service==='storage'?['storage']:service==='healer'?['heal','revive']:service==='teleport'?['teleport']:service==='forge'||service==='seal'?['forge']:service==='pet'?['pet']:service==='core'||service==='special'?['job']:service==='tutorial'?['tutorial']:['quest'];
function makeNpcs(names:string[], second=false):NpcDefinition[] { return names.map((name,i) => { const service = second && i===1 ? 'special' : second && i===2 ? 'forge' : second && i===3 ? 'seal' : npcServices[i]; return {id:`${second?'jaya':'aruna'}-${i}`,name,type:service==='equipment'||service==='consumable'?'merchant':service,service,services:servicesFor(service),description:serviceDescriptions[service],interactionRange:2.5,shopInventory:[],x:(i%4-1.5)*8*WORLD_CONFIG.cityScale,z:(-5-Math.floor(i/4)*9)*WORLD_CONFIG.cityScale}; }); }
const arunikaNpcs = makeNpcs(['Adipati Aruna','Pemandu Pijar','Mahaguru Aksara','Empu Wira','Pande Gana','Nyi Raras','Juru Simpan Lumbung','Tabib Sekar','Pawang Lestari','Penjaga Gerbang Bayu','Papan Warta Arunika']);
arunikaNpcs.push({id:'aruna-developer-materials',name:'Developer Material Lab',type:'developer',service:'developer-materials',services:['buy','sell'],description:'Developer-only material shop. Semua material aktif tersedia untuk pengujian dengan harga 0 GOLD.',interactionRange:2.5,shopInventory:[],x:18,z:-34.5});
export const CITIES: Record<string,CityDefinition> = {
  averion:{id:'averion',displayName:'Averion',chapter:1,minLevel:1,recommendedLevel:'1+',npcList:[],connectedFields:[],unlockQuest:null,musicId:'city-arunika',ambientId:'river-market'},
  arunika:{id:'arunika',displayName:'Kota Arunika',chapter:1,minLevel:1,recommendedLevel:'1–24',npcList:arunikaNpcs,connectedFields:['verdant-plains','ironveil-mines','whispering-wilds'],unlockQuest:null,musicId:'city-arunika',ambientId:'river-market'},
  jayantara:{id:'jayantara',displayName:'Kota Jayantara',chapter:1,minLevel:24,recommendedLevel:'24–50',npcList:makeNpcs(['Adipati Jayan','Mahaguru Silsilah','Empu Niskala','Juru Segel','Pande Jayantara','Saudagar Puncak','Juru Simpan Candi','Tabib Amerta','Pawang Niskala','Penjaga Gerbang Langit','Papan Titah Jayantara'],true),connectedFields:['frostfire-highlands','sunken-ruins','meteorfall-citadel'],unlockQuest:'story-whispering-wilds',musicId:'city-jayantara',ambientId:'mountain-wind'},
};
// Early forge/core roles differ from the shared service order.
CITIES.arunika.npcList[2].service = 'core';
CITIES.arunika.npcList[3].service = 'forge';
const seeds: Array<[string,string,string,number,number,string[],string[],number[],string[],string,number[]]> = [
 ['verdant-plains','Padang Arunika','Verdant Plains',1,8,['Gerbang Fajar','Padang Lumbung','Kuil Akar Tua'],['Small Slime','Wild Boar','Forest Piya','Stoneback Beetle','Giant Rootling','Ancient Treant'],[1,3,5,7,8,10],['iron','lumut-fiber'],'#729349',[10,52,112,185,452,1580]],
 ['ironveil-mines','Tambang Selubung Besi','Ironveil Mines',8,16,['Pos Tambang Barat','Lorong Bijih Dalam','Galeri Runtuh'],['Cave Bat','Ore Grub','Ironfang Bat','Tunnel Marauder','Ironhide Golem','Mine Tyrant'],[9,10,12,14,16,18],['iron','titanium'],'#685c51',[270,400,520,650,900,3820]],
 ['whispering-wilds','Rimba Bisik','Whispering Wilds',16,24,['Jalur Bambu','Hutan Kabut','Kanopi Leluhur'],['Moss Sprite','Thorn Wolf','Whispering Wisp','Vineshade Panther','Elder Vine','Forest Warden'],[16,17,20,22,24,26],['titanium'],'#315d50',[640,701,894,1030,1500,6630]],
 [FROSTFIRE_ID,'Frostfire Highlands','Frozen Highlands',24,32,FROSTFIRE_ZONES.map(z=>z.name),['Ember Yak','Frost Wolf','Magma Imp','Frostfire Wyrm','Cinderhorn','Twin Elemental Lord'],[24,25,28,30,32,34],['titanium','vibranium'],'#ccdfe9',[1180,1250,1490,1700,2300,9915]],
 [SUNKEN_ID,'Sunken Ruins','Underwater Hunting Field',32,42,SUNKEN_ZONES.map(z=>z.name),['Drowned Warrior','Drowned Soldier','Leech Wraith','Ruin Guardian','Sunken Sentinel','Abyssal Leviathan'],[32,33,37,40,42,42],['vibranium'],'#11647d',[1700,1896,2300,2700,3600,Math.round(14595*42/44)]],
 ['meteorfall-citadel','Benteng Hujan Meteor','Meteorfall Citadel',42,50,['Gerbang Bintang Jatuh','Padang Meteor','Inti Benteng Meteorfall'],['Meteor Wisp','Meteor Hound','Astral Golem','Void Knight','Meteor Titan','Meteorfall Overlord'],[42,43,46,48,49,50],['vibranium','meteorite-core'],'#584465',[2500,2820,3200,3700,4700,17680]],
];
const fieldDefinitions: Record<string,FieldDefinition> = Object.fromEntries(seeds.map(([id,displayName,codename,minLevel,maxLevel,subAreas,names,levels,materials,color,expValues],index) => {
 const monsters=names.map((name,i):MonsterDefinition => { const variant:MonsterVariant=i===5?'boss':i===4?'elite':'normal'; const tuning=MONSTER_VARIANTS[variant]; const level=levels[i]; return {id:`${id}-${i}`,name,level,rank:variant,variant,exp:expValues[i],maxHP:Math.round((30+level*16)*tuning.hpMultiplier),attack:Math.round((8+level*2.2)*tuning.damageMultiplier),defense:Math.round((4+level*1.1)*tuning.defenseMultiplier),magicDefense:Math.round((3+level)*tuning.defenseMultiplier),attackSpeed:variant==='boss'?1.2:variant==='elite'?1.45:1.8,movementSpeed:variant==='boss'?1.3:variant==='elite'?1.7:2.1,attackRange:variant==='boss'?5.6:1.8,dropRate:variant==='boss'?.95:variant==='elite'?.7:.35,lootTable:['health-potion-1',...materials],respawnTime:tuning.respawnTime,visualScale:tuning.visualScale,nameColor:tuning.nameColor,statusLabel:tuning.statusLabel,respawn:tuning.respawnTime}; });
 return [id,{id,displayName,codename,cityId:index<3?'arunika':'jayantara',chapter:1,minLevel,maxLevel,recommendedLevel:`${minLevel}–${maxLevel}`,subAreas,normalMonsters:monsters.slice(0,4),eliteMonsters:[monsters[4]],fieldBoss:monsters[5],dropTable:['health-potion-1','forest-vest','adventurer-pet-egg'],materialTable:materials.map((id,i)=>({id,chance:i>0&&['titanium','vibranium','meteorite-core'].includes(id)?0.15:0.65})),unlockQuest:null,previousField:index?seeds[index-1][0]:null,nextMap:seeds[index+1]?.[0]??null,musicId:`field-${id}`,ambientId:`ambient-${id}`,isUnlocked:index===0,color,questList:[`field-${id}-easy`,`field-${id}-veteran`,`field-${id}-elite`],entry:{x:0,z:30},exit:{x:0,z:34}}];
}));

// Separate species/save identities; reuse established rank scaling and starter loot.
const plainsMonster = (slug:string,name:string,level:number,variant:MonsterVariant,exp:number):MonsterDefinition => {
 const tuning=MONSTER_VARIANTS[variant];
 return {id:`${PLAINS_ID}-${slug}`,name,level,rank:variant,variant,exp,
  maxHP:Math.round((30+level*16)*tuning.hpMultiplier),attack:Math.round((8+level*2.2)*tuning.damageMultiplier),
  defense:Math.round((4+level*1.1)*tuning.defenseMultiplier),magicDefense:Math.round((3+level)*tuning.defenseMultiplier),
  attackSpeed:variant==='boss'?1.2:variant==='elite'?1.45:1.8,movementSpeed:variant==='boss'?1.3:variant==='elite'?1.7:2.1,
  attackRange:variant==='boss'?5.6:1.8,dropRate:variant==='boss'?.95:variant==='elite'?.7:.35,
  lootTable:['health-potion-1','iron','lumut-fiber'],respawnTime:tuning.respawnTime,respawn:tuning.respawnTime,
  visualScale:tuning.visualScale,nameColor:tuning.nameColor,statusLabel:tuning.statusLabel};
};
fieldDefinitions[PLAINS_ID] = {id:PLAINS_ID,cityId:'averion',displayName:'Verdant Plains',codename:'Padang Arunika',chapter:1,minLevel:1,recommendedLevel:'1–8',maxLevel:8,
 subAreas:['Arunika Rest','Padang Pemula','Dataran Tengah','Tepi Sungai','Dataran Utara','Pesisir Selatan','Clearing Treant'],
 normalMonsters:[
  plainsMonster('small-slime','Small Slime',1,'normal',10),
  plainsMonster('meadow-slime','Meadow Slime',2,'normal',28),
  plainsMonster('wild-boar','Wild Boar',3,'normal',52),
  plainsMonster('forest-piya','Forest Piya',4,'normal',82),
  plainsMonster('stoneback-beetle','Stoneback Beetle',5,'normal',112),
  plainsMonster('rootling','Rootling',6,'normal',147),
  plainsMonster('thorn-wolf','Thorn Wolf',7,'normal',185),
 ],eliteMonsters:[plainsMonster('giant-rootling','Giant Rootling',7,'elite',370),plainsMonster('alpha-boar','Alpha Boar',8,'elite',452)],
 fieldBoss:plainsMonster('ancient-treant','Ancient Treant',8,'boss',1075),
 dropTable:[...fieldDefinitions['verdant-plains'].dropTable],materialTable:fieldDefinitions['verdant-plains'].materialTable.map(item=>({...item})),
 unlockQuest:null,previousField:null,nextMap:null,musicId:'field-verdant-plains',ambientId:'ambient-verdant-plains',isUnlocked:true,color:'#b8d4df',questList:[],entry:{...PLAINS_ENTRY},exit:{...PLAINS_EXIT},regionType:'field'};
CITIES.averion.connectedFields.push(PLAINS_ID);

// Permanent terrain replacement, retaining species/item IDs for existing saves.
 fieldDefinitions[FROSTFIRE_ID] = {
  ...fieldDefinitions[FROSTFIRE_ID],
  id:FROSTFIRE_ID,cityId:'jayantara',displayName:'Frostfire Highlands',codename:'Frozen Highlands',contentFamilyId:FROSTFIRE_ID,
  chapter:1,minLevel:24,maxLevel:32,recommendedLevel:'24–32',subAreas:FROSTFIRE_ZONES.map(z=>z.name),
  questList:[],
  unlockQuest:null,isUnlocked:false,musicId:'',ambientId:'',
  color:'#ccdfe9',entry:{...FROSTFIRE_ENTRY},exit:{...FROSTFIRE_ENTRY},regionType:'field',
 };

fieldDefinitions['verdant-plains'].entry = {...VERDANT_TERRAIN.entry};
fieldDefinitions['verdant-plains'].exit = {...VERDANT_TERRAIN.exit};

// A new region identity, but the SAME authoritative monster objects and loot tier.
fieldDefinitions['east-gate-arunika'] = {
 ...fieldDefinitions['verdant-plains'], id:'east-gate-arunika',displayName:'East Gate Arunika',codename:'Sunrise Frontier',
 contentFamilyId:'verdant-plains',cityDirection:'east',regionType:'field',
 subAreas:['Gerbang Timur','Dusun Purnama','Lembah Cahaya'],previousField:null,nextMap:'ironveil-mines',
 musicId:'field-east-gate-arunika',ambientId:'ambient-east-gate-arunika',color:'#83a95c',
 questList:['field-east-gate-arunika-easy','field-east-gate-arunika-veteran','field-east-gate-arunika-elite'],
 entry:{...EAST_GATE_TERRAIN.entry},exit:{...EAST_GATE_TERRAIN.exit},
};
CITIES.arunika.connectedFields.push('east-gate-arunika');
// The retired map is no longer a travel destination. Its shared content remains
// authoritative for East Gate and existing equipment/save identities.
export const STARTER_FIELD_CONTENT = fieldDefinitions['verdant-plains'];
// Content compatibility only: the retired terrain is no longer a destination.
export const WILDS_LEGACY_CONTENT = fieldDefinitions['whispering-wilds'];
const wildsLegacy = WILDS_LEGACY_CONTENT;
const wildsBoss = { ...wildsLegacy.fieldBoss!, level:24,
 maxHP:Math.round((30+24*16)*MONSTER_VARIANTS.boss.hpMultiplier),
 attack:Math.round((8+24*2.2)*MONSTER_VARIANTS.boss.damageMultiplier),
 defense:Math.round((4+24*1.1)*MONSTER_VARIANTS.boss.defenseMultiplier),
 magicDefense:Math.round((3+24)*MONSTER_VARIANTS.boss.defenseMultiplier),
 exp:Math.round(wildsLegacy.fieldBoss!.exp*24/26) };
fieldDefinitions[WILDS_ID] = {
 id:WILDS_ID,cityId:'arunika',displayName:'Whispering Wilds',codename:'Hunting Field',chapter:1,
 minLevel:16,maxLevel:24,recommendedLevel:'16–24',subAreas:WILDS_LANDMARKS.map(p=>p.name),
 contentFamilyId:'whispering-wilds',normalMonsters:[...wildsLegacy.normalMonsters],eliteMonsters:[...wildsLegacy.eliteMonsters],fieldBoss:wildsBoss,
 dropTable:[...wildsLegacy.dropTable],materialTable:wildsLegacy.materialTable.map(item=>({...item})),questList:[],
 unlockQuest:null,previousField:'ironveil-mines',nextMap:FROSTFIRE_ID,musicId:'',ambientId:'',isUnlocked:false,
 color:'#172b3a',entry:{...WILDS_ENTRY},exit:{...WILDS_ENTRY},regionType:'field',
};
for(const id of ['arunika','averion','jayantara'])CITIES[id].connectedFields.push(WILDS_ID);
// Retain item/species identities only; the old terrain is not a destination.
export const IRONVEIL_LEGACY_CONTENT = fieldDefinitions['ironveil-mines'];
const ironveilSpecies = [...IRONVEIL_LEGACY_CONTENT.normalMonsters, ...IRONVEIL_LEGACY_CONTENT.eliteMonsters, IRONVEIL_LEGACY_CONTENT.fieldBoss!].map((monster,i) => {
 const level=[8,10,12,14,15,16][i], tuning=MONSTER_VARIANTS[monster.variant];
 return {...monster,level,maxHP:Math.round((30+level*16)*tuning.hpMultiplier),attack:Math.round((8+level*2.2)*tuning.damageMultiplier),defense:Math.round((4+level*1.1)*tuning.defenseMultiplier),magicDefense:Math.round((3+level)*tuning.defenseMultiplier),exp:Math.round(monster.exp*level/monster.level)};
});
fieldDefinitions[IRONVEIL_ID] = {
 id:IRONVEIL_ID,cityId:'averion',displayName:'Ironveil Mines',codename:'Hunting Field',contentFamilyId:'ironveil-mines',
 chapter:1,minLevel:8,maxLevel:16,recommendedLevel:'8–16',subAreas:IRONVEIL_POCKETS.map(p=>p.name),
 normalMonsters:ironveilSpecies.slice(0,4),eliteMonsters:[ironveilSpecies[4]],fieldBoss:ironveilSpecies[5],dropTable:[...IRONVEIL_LEGACY_CONTENT.dropTable],materialTable:IRONVEIL_LEGACY_CONTENT.materialTable.map(m=>({...m})),questList:[],
 unlockQuest:null,previousField:PLAINS_ID,nextMap:WILDS_ID,musicId:'',ambientId:'',isUnlocked:false,
 color:'#b4c2bd',entry:{...IRONVEIL_ENTRY},exit:{...IRONVEIL_ENTRANCE},regionType:'field',
};
CITIES.averion.connectedFields.push(IRONVEIL_ID);
const sunkenContent=fieldDefinitions[SUNKEN_ID];
// Permanent replacement: retain species/item identities, replace the old field layout.
fieldDefinitions[SUNKEN_ID]={
 id:SUNKEN_ID,cityId:'jayantara',displayName:'Sunken Ruins',codename:'Underwater Hunting Field',contentFamilyId:'sunken-ruins',
 chapter:1,minLevel:32,maxLevel:42,recommendedLevel:'32–42',subAreas:SUNKEN_ZONES.map(z=>z.name),
 normalMonsters:[...sunkenContent.normalMonsters],eliteMonsters:[...sunkenContent.eliteMonsters],fieldBoss:sunkenContent.fieldBoss,
 dropTable:[...sunkenContent.dropTable],materialTable:sunkenContent.materialTable.map(m=>({...m})),questList:[],
 unlockQuest:null,previousField:sunkenContent.previousField,nextMap:sunkenContent.nextMap,musicId:'',ambientId:'',isUnlocked:false,
 color:'#11647d',entry:{...SUNKEN_ENTRY},exit:{x:SUNKEN_PORTALS[0].x,z:SUNKEN_PORTALS[0].z},regionType:'field',
};
const oceanMonster=(slug:string,name:string,level:number,variant:MonsterVariant,scale=1):MonsterDefinition=>{
 const base=plainsMonster(slug,name,level,variant,Math.round((1700+(level-32)*145)*MONSTER_VARIANTS[variant].expMultiplier));
 return {...base,id:`${DEEP_OCEAN_ID}-${slug}`,visualScale:scale,lootTable:['health-potion-3','vibranium'],movementSpeed:variant==='boss'?2.4:2.8};
};
fieldDefinitions[DEEP_OCEAN_ID]={
 ...fieldDefinitions[SUNKEN_ID], id:DEEP_OCEAN_ID, displayName:'Deep Ocean',codename:'Deep-ocean hunting field',
 recommendedLevel:'38–48',maxLevel:48,subAreas:['Descent Landing','Abyssal Sand Basin','Megalodon Grounds'],
 normalMonsters:[oceanMonster('goblin-shark','Goblin Shark',38,'normal'),oceanMonster('baracuda','Deep Baracuda',40,'normal'),oceanMonster('marlyn','Deep Marlyn',43,'normal'),oceanMonster('giant-squid','Giant Squid',46,'normal')],
 eliteMonsters:[oceanMonster('giant-squid-elite','Giant Squid · Elite',47,'elite',1.35)],
 fieldBoss:oceanMonster('megalodon','Megalodon',48,'boss',4),
 dropTable:[...sunkenContent.dropTable],materialTable:sunkenContent.materialTable.map(m=>({...m})),questList:[],previousField:null,nextMap:null,
 entry:{...DEEP_OCEAN_ENTRY},exit:{x:0,z:350},color:'#164e72',warpOnly:true,contentFamilyId:undefined,
};
fieldDefinitions[ABYSAL_TRENCH_ID]={
 ...fieldDefinitions[DEEP_OCEAN_ID],id:ABYSAL_TRENCH_ID,displayName:'Abysal Trench',codename:'Tectonic passage and boss arena',
 normalMonsters:[],
 eliteMonsters:[{...oceanMonster('serpent-guardian','Sea Serpent "Guardian"',58,'elite'),id:SERPENT_GUARDIAN_ID,visualScale:1}],
 fieldBoss:{...oceanMonster('sea-serpent','Sea Serpent',60,'boss'),id:SERPENT_BOSS_ID,visualScale:1},
 dropTable:[...sunkenContent.dropTable],materialTable:sunkenContent.materialTable.map(m=>({...m})),recommendedLevel:'58–60',maxLevel:60,
 subAreas:['Trench Landing','Tectonic Maze','Tectonic Basin'],entry:{...ABYSAL_TRENCH_ENTRY},exit:{x:0,z:350},color:'#0b2943',
};
export const FIELDS: Record<string, FieldDefinition> = Object.fromEntries([
 [PLAINS_ID, fieldDefinitions[PLAINS_ID]],
 ...Object.entries(fieldDefinitions).filter(([id])=>id!==PLAINS_ID&&id!=='verdant-plains'&&id!==WILDS_ID&&id!==IRONVEIL_ID)
   .map(([id,field])=>id==='whispering-wilds'?[WILDS_ID,fieldDefinitions[WILDS_ID]]:id==='ironveil-mines'?[IRONVEIL_ID,fieldDefinitions[IRONVEIL_ID]]:[id,field]),
]);
for(const city of Object.values(CITIES))city.connectedFields=[...new Set(city.connectedFields.map(id=>id==='verdant-plains'?PLAINS_ID:id==='whispering-wilds'?WILDS_ID:id==='ironveil-mines'?IRONVEIL_ID:id))];
for(const field of Object.values(FIELDS)) {
 if(field.previousField==='ironveil-mines')field.previousField=IRONVEIL_ID;
 if(field.nextMap==='ironveil-mines')field.nextMap=IRONVEIL_ID;
 if(field.previousField==='verdant-plains')field.previousField=PLAINS_ID;
 if(field.previousField==='whispering-wilds')field.previousField=WILDS_ID;
 if(field.nextMap==='whispering-wilds')field.nextMap=WILDS_ID;
}

fieldDefinitions[PLAINS_ID].nextMap=IRONVEIL_ID;

export const startingFieldIds = () => Object.values(FIELDS).filter(field=>field.isUnlocked&&field.chapter<=WORLD_CONFIG.chapterCap).map(field=>field.id);
export function fieldContent(fieldId:string):FieldDefinition {
 const field=FIELDS[fieldId];
 if(fieldId==='ironveil-mines'||field?.contentFamilyId==='ironveil-mines')return IRONVEIL_LEGACY_CONTENT;
 if(fieldId==='verdant-plains'||field?.contentFamilyId==='verdant-plains')return STARTER_FIELD_CONTENT;
 if(fieldId==='whispering-wilds'||field?.contentFamilyId==='whispering-wilds')return WILDS_LEGACY_CONTENT;
 return field ? FIELDS[field.contentFamilyId??field.id] : FIELDS[PLAINS_ID];
}

export const FIELD_NPCS: Record<string, NpcDefinition> = {
 'meteorfall-citadel': {id:'field-npc-meteor',name:'Penjaga Benteng Meteor',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Benteng Hujan Meteor.',x:-26,z:28,fieldId:'meteorfall-citadel'},
};

FIELD_NPCS['east-gate-arunika']={id:'field-npc-east-gate',name:'Penjaga Pos Timur',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Perbekalan, perjalanan, dan misi perbatasan East Gate Arunika.',x:-38,z:28,fieldId:'east-gate-arunika'};
Object.assign(FIELD_NPCS['east-gate-arunika'],EAST_GATE_TERRAIN.camp);
export function monsterXP(monster:MonsterDefinition, playerLevel:number) { return Math.max(1, Math.floor(monster.exp * Math.max(0.05, 1 - Math.max(0, playerLevel-monster.level-5)*0.08))); }
export function unlockReason(hero:Hero, id:string):string {
 const region=FIELDS[id]??CITIES[id];
 if(!region) return 'Wilayah tidak ditemukan.';
 if(region.chapter>WORLD_CONFIG.chapterCap) return 'Chapter belum tersedia.';
 if(hero.level<region.minLevel) return `Membutuhkan level ${region.minLevel}.`;
 // Field access is level-based. Former story/boss unlocks are now local field quests.
 return '';
}
export function refreshUnlocks(hero:Hero) {
 for(const id of Object.keys(CITIES)) if(!unlockReason(hero,id)&&!hero.unlockedCities.includes(id)) hero.unlockedCities.push(id);
 for(const id of Object.keys(FIELDS)) if(!unlockReason(hero,id)&&!hero.unlockedFields.includes(id)) hero.unlockedFields.push(id);
}
export function travel(hero:Hero,id:string,portalId?:string) {
 if(hero.interiorId) return {ok:false,reason:'Walk back to the mine entrance to leave.'};
 if(id==='ironveil-mines-interior-v1') return {ok:false,reason:'Enter through the Ironveil Mines doorway.'};
 if(FIELDS[id]?.warpOnly){
  const portals=hero.currentField===SUNKEN_ID?SUNKEN_PORTALS:hero.currentField===DEEP_OCEAN_ID?DEEP_OCEAN_PORTALS:hero.currentField===ABYSAL_TRENCH_ID?ABYSAL_TRENCH_PORTALS:[];
  const gate=portals.find(p=>p.id===portalId&&p.destination===id);
  if(hero.inCity||!gate||Math.hypot(hero.x-gate.x,hero.z-gate.z)>4.5)return {ok:false,reason:'Gunakan warp yang terhubung untuk memasuki sub-map ini.'};
 }
 const returningFromTrench=!hero.inCity&&hero.currentField===ABYSAL_TRENCH_ID&&id===DEEP_OCEAN_ID;
 const returningFromDeepOcean=!hero.inCity&&hero.currentField===DEEP_OCEAN_ID&&id===SUNKEN_ID;
 const reason=unlockReason(hero,id); if(reason) return {ok:false,reason};
 refreshUnlocks(hero);
 if(CITIES[id]) {hero.currentCity=id;hero.inCity=true;hero.x=0;hero.z=8;}
 else {hero.currentField=id;hero.currentCity=FIELDS[id].cityId;hero.inCity=false;hero.x=FIELDS[id].entry.x;hero.z=FIELDS[id].entry.z;}
 if(returningFromDeepOcean)Object.assign(hero,DEEP_OCEAN_RETURN);
 if(returningFromTrench)Object.assign(hero,ABYSAL_TRENCH_RETURN);
 return {ok:true,reason:`Tiba di ${(CITIES[id]??FIELDS[id]).displayName}.`};
}
export function acceptRegionQuest(hero:Hero,id:string) {
 if(id==='main-verdant-bisikan') {
  if(hero.completedQuests.includes(id)||hero.questClaimed) return false;
  if(!hero.activeQuests.includes(id)) {
   hero.activeQuests=[...hero.activeQuests,id];
   hero.acceptedQuests=Array.from(new Set([...hero.acceptedQuests,id]));
  }
  return true;
 }
 const field=fieldForQuest(id);
 const info=field?fieldQuestInfo(field,id):null;
 // Field quests are only accepted from the camp NPC in their own field.
 if(!field||hero.inCity||hero.currentField!==field.id||!info||hero.level<info.requiredLevel||hero.completedQuests.includes(id)||(hero.questCooldowns[id]??0)>Date.now()) return false;
 if(!hero.acceptedQuests.includes(id)) {
  hero.acceptedQuests=[...hero.acceptedQuests,id];
  hero.activeQuests=[...hero.activeQuests.filter(quest=>quest!==id),id];
  hero.cityProgress[`baseline-${id}`]=hero.fieldProgress[field.id]??0;
 }
 return true;
}
export function regionQuestStatus(hero:Hero,id:string,now=Date.now()):RegionQuestStatus {
 const field=fieldForQuest(id);
 if(!field) return 'completed';
 const info=fieldQuestInfo(field,id);
 if((hero.questCooldowns[id]??0)>now) return 'cooldown';
 if(hero.completedQuests.includes(id)) return 'completed';
 if(!hero.activeQuests.includes(id)&&hero.level<info.requiredLevel) return 'locked';
 if(!hero.activeQuests.includes(id)) return 'available';
 const ready=(hero.fieldProgress[field.id]??0)-(hero.cityProgress[`baseline-${id}`]??0)>=info.target;
 return ready?'ready_to_complete':'active';
}
type FieldQuestDifficulty='easy'|'veteran'|'elite';
function fieldQuestDifficulty(id:string):FieldQuestDifficulty { return id.endsWith('-veteran')?'veteran':id.endsWith('-elite')?'elite':'easy'; }
export function fieldForQuest(id:string) { return Object.values(FIELDS).find(field=>field.questList.includes(id)); }
export function migrateFieldQuestId(id:string) {
 if(id==='story-ironveil-mines')return 'field-ironveil-mines-easy';
 if(id==='story-verdant-plains')return 'field-verdant-plains-easy';
 for(const field of Object.values(FIELDS)) if(field.questList.length&&id===`story-${field.id}`) return field.questList[0];
 return id;
}
export function fieldQuestInfo(field:FieldDefinition,id:string) {
 const difficulty=fieldQuestDifficulty(id), span=Math.max(0,field.maxLevel-field.minLevel);
 const requiredLevel=difficulty==='easy'?field.minLevel:difficulty==='veteran'?Math.min(field.maxLevel,field.minLevel+Math.max(1,Math.floor(span*.35))):Math.min(field.maxLevel,field.minLevel+Math.max(2,Math.floor(span*.7)));
 return {difficulty,requiredLevel,target:difficulty==='easy'?5:difficulty==='veteran'?10:15};
}
export function getQuestStatus(quest:QuestJournalEntry,hero:Hero,now=Date.now()):RegionQuestStatus {
 if(fieldForQuest(quest.id)) return regionQuestStatus(hero,quest.id,now);
 if(quest.id==='main-verdant-bisikan') return hero.questClaimed||hero.completedQuests.includes(quest.id)?'completed':hero.activeQuests.includes(quest.id)?hero.kills>=6?'ready_to_complete':'active':'available';
 if(quest.id==='class-core') return hero.coreQuestClaimed?'completed':hero.level>=10?'available':'locked' as RegionQuestStatus;
 if(quest.id==='class-specialization') return hero.specializationQuestClaimed?'completed':hero.level<25||!hero.coreJob||!hero.unlockedCities.includes('jayantara')?'locked' as RegionQuestStatus:'available';
 if(quest.id==='class-mastery') return hero.masteryQuestClaimed?'completed':hero.level<40||!hero.specialization?'locked' as RegionQuestStatus:'available';
 return 'locked';
}
export function getQuestGiverLocation(quest:QuestJournalEntry) { return {mapId:quest.giverMapId,mapName:quest.giverMapName,npcId:quest.giverNpcId,npcName:quest.giverNpcName}; }
export function getQuestRequirements(quest:QuestJournalEntry,hero:Hero) {
 const unmet:string[]=[];
 if(hero.level<quest.requiredLevel) unmet.push(`Level minimum: ${quest.requiredLevel}`);
 if(quest.requiredJob==='core'&&!hero.coreJob) unmet.push('Pilih Core Job terlebih dahulu');
 if(quest.requiredJob==='specialization'&&!hero.specialization) unmet.push('Pilih Special Job terlebih dahulu');
 if(quest.requiredJob&&![ 'core','specialization' ].includes(quest.requiredJob)&&hero.job!==quest.requiredJob&&hero.specialization!==quest.requiredJob) unmet.push(`Job: ${quest.requiredJob}`);
 for(const id of quest.requiredQuestIds) if(!hero.completedQuests.includes(id)) unmet.push(`Selesaikan quest: ${id}`);
 if(quest.requiredMapId&&!hero.unlockedFields.includes(quest.requiredMapId)&&!hero.unlockedCities.includes(quest.requiredMapId)) unmet.push(`Buka akses: ${quest.requiredMapId}`);
 return unmet;
}
export function getQuestRegistry():QuestJournalEntry[] {
 const registry:QuestJournalEntry[]=[
  {id:'main-verdant-bisikan',title:'Bisikan di Lembah',chapter:1,category:'main',giverNpcId:'aruna-0',giverNpcName:'Adipati Aruna',giverNpcRole:'Main Story',giverMapId:'arunika',giverMapName:CITIES.arunika.displayName,recommendedLevel:1,requiredLevel:1,requiredQuestIds:[],requiredMapId:null,requiredJob:null,targetMapId:PLAINS_ID,targetMapName:FIELDS[PLAINS_ID].displayName,description:'Bebaskan lembah dari makhluk yang menyerap cahaya.',objectives:[{type:'kill',targetId:'verdant-plains-normal',targetName:'Lumut Liar',required:6}],rewards:{xp:80,gold:80,items:[]},repeatable:false,cooldownHours:0,status:'available',progress:[]},
  {id:'class-core',title:'Class Quest: Core Job',chapter:1,category:'class',giverNpcId:'aruna-2',giverNpcName:'Mahaguru Aksara',giverNpcRole:'Job NPC',giverMapId:'arunika',giverMapName:CITIES.arunika.displayName,recommendedLevel:10,requiredLevel:10,requiredQuestIds:[],requiredMapId:null,requiredJob:null,targetMapId:'arunika',targetMapName:CITIES.arunika.displayName,description:'Pilih dan tetapkan Core Job penjaga.',objectives:[{type:'job',targetId:'core-job',targetName:'Core Job',required:1}],rewards:{xp:0,gold:0,items:[]},repeatable:false,cooldownHours:0,status:'locked',progress:[]},
  {id:'class-specialization',title:'Specialization Quest',chapter:1,category:'class',giverNpcId:'jaya-1',giverNpcName:'Mahaguru Silsilah',giverNpcRole:'Job NPC',giverMapId:'jayantara',giverMapName:CITIES.jayantara.displayName,recommendedLevel:25,requiredLevel:25,requiredQuestIds:[],requiredMapId:'jayantara',requiredJob:'core',targetMapId:'jayantara',targetMapName:CITIES.jayantara.displayName,description:'Pilih Special Job dan bentuk identitas utama karakter.',objectives:[{type:'job',targetId:'specialization',targetName:'Special Job',required:1}],rewards:{xp:0,gold:0,items:[]},repeatable:false,cooldownHours:0,status:'locked',progress:[]},
  {id:'class-mastery',title:'Mastery Quest',chapter:1,category:'class',giverNpcId:'jaya-1',giverNpcName:'Mahaguru Silsilah',giverNpcRole:'Job NPC',giverMapId:'jayantara',giverMapName:CITIES.jayantara.displayName,recommendedLevel:40,requiredLevel:40,requiredQuestIds:[],requiredMapId:'jayantara',requiredJob:'specialization',targetMapId:'jayantara',targetMapName:CITIES.jayantara.displayName,description:'Buka pilihan Mastery untuk memodifikasi skill.',objectives:[{type:'job',targetId:'mastery',targetName:'Mastery',required:1}],rewards:{xp:0,gold:0,items:[]},repeatable:false,cooldownHours:0,status:'locked',progress:[]},
 ];
 for(const field of Object.values(FIELDS)) for(const id of field.questList){
  const giver=FIELD_NPCS[field.id], info=fieldQuestInfo(field,id); const difficultyLabel=info.difficulty==='easy'?'Easy':info.difficulty==='veteran'?'Veteran':'Elite';
  registry.push({id,title:`${field.displayName} · ${difficultyLabel}`,chapter:field.chapter,category:'side',giverNpcId:giver.id,giverNpcName:giver.name,giverNpcRole:'Field Quest NPC',giverMapId:field.id,giverMapName:field.displayName,recommendedLevel:field.minLevel,requiredLevel:info.requiredLevel,requiredQuestIds:[],requiredMapId:field.id,requiredJob:null,targetMapId:field.id,targetMapName:field.displayName,description:regionQuestDescription(id),objectives:[{type:'kill',targetId:field.id,targetName:`Monster ${difficultyLabel}`,required:info.target}],rewards:regionQuestReward(id),repeatable:false,cooldownHours:0,status:'locked',progress:[]});
 }
 return registry;
}
export function getAllQuestJournalEntries(hero:Hero,now=Date.now()):QuestJournalEntry[] {
 return getQuestRegistry().filter(quest=>showJobQuest(hero,quest)).map(quest=>{
  const status=getQuestStatus(quest,hero,now);
  let progress=quest.objectives.map(objective=>({current:0,required:objective.required}));
  if(quest.id==='main-verdant-bisikan') {
   progress=[{current:Math.min(6,hero.kills),required:6}];
  } else if(fieldForQuest(quest.id)) {
   const fieldProgress=regionQuestProgress(hero,quest.id);
   progress=[{current:fieldProgress.current,required:fieldProgress.target}];
  }
  return {...quest,status,progress};
 });
}
export function regionQuestDescription(id:string) {
 const field=fieldForQuest(id);
 if(!field) return 'Quest tidak ditemukan.';
 const info=fieldQuestInfo(field,id);
 return `Kalahkan ${info.target} monster di ${field.displayName} pada difficulty ${info.difficulty}.`;
}
export function regionQuestProgress(hero:Hero,id:string) {
 const field=fieldForQuest(id);
 if(!field) return {current:0,target:0};
 const target=fieldQuestInfo(field,id).target;
 return {current:Math.min(target,Math.max(0,(hero.fieldProgress[field.id]??0)-(hero.cityProgress[`baseline-${id}`]??0))),target};
}
export function regionQuestReward(id:string):QuestReward {
 const field=fieldForQuest(id);
 if(!field) return {xp:0,gold:0,items:[]};
 const info=fieldQuestInfo(field,id), multiplier=info.difficulty==='easy'?1:info.difficulty==='veteran'?1.8:3;
 return {xp:Math.floor(field.minLevel*35*multiplier),gold:Math.floor((field.minLevel*15+35)*multiplier),items:[{templateId:field.materialTable[0].id,quantity:info.difficulty==='elite'?5:info.difficulty==='veteran'?3:2}]};
}
export function completeRegionQuest(hero:Hero,id:string,_day=new Date().toISOString().slice(0,10)) {
 if(id==='main-verdant-bisikan') {
  if(!hero.activeQuests.includes(id)||hero.questClaimed||hero.completedQuests.includes(id)) return {ok:false,reason:'Quest belum diambil atau reward sudah diklaim.',reward:{xp:0,gold:0,items:[]}};
  if(hero.kills<6) return {ok:false,reason:'Kalahkan 6 Lumut Liar terlebih dahulu.',reward:{xp:0,gold:0,items:[]}};
  const reward={xp:80,gold:80,items:[]};
  hero.questClaimed=true;
  hero.completedQuests=Array.from(new Set([...hero.completedQuests,id]));
  hero.acceptedQuests=hero.acceptedQuests.filter(quest=>quest!==id);
  hero.activeQuests=hero.activeQuests.filter(quest=>quest!==id);
  return {ok:true,reason:'Quest selesai: Bisikan di Lembah.',reward};
 }
 const field=fieldForQuest(id);
 if(!field||!hero.activeQuests.includes(id)) return {ok:false,reason:'Terima quest terlebih dahulu.',reward:{xp:0,gold:0,items:[]}};
 if(regionQuestStatus(hero,id)!=='ready_to_complete') return {ok:false,reason:'Objective quest belum selesai.',reward:{xp:0,gold:0,items:[]}};
 const reward=regionQuestReward(id);
 hero.completedQuests=Array.from(new Set([...hero.completedQuests,id]));
 hero.acceptedQuests=hero.acceptedQuests.filter(quest=>quest!==id);
 hero.activeQuests=hero.activeQuests.filter(quest=>quest!==id);
 refreshUnlocks(hero);
 return {ok:true,reason:`Quest selesai: ${field.displayName}.`,reward};
}
