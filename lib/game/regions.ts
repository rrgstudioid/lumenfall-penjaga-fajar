import type { Hero } from './rules.ts';
import { getVisibleJobArchitecture, showJobQuest } from './job-presentation.ts';
import { STAMINA_ENABLED } from './gameplay-config.ts';
import { VERDANT_TERRAIN, EAST_GATE_TERRAIN } from './field-terrain.ts';
import { sandsWorldPoint } from './sands-coordinates.ts';

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
export type FieldDefinition = { id: string; cityId: string; displayName: string; codename: string; chapter: number; minLevel: number; recommendedLevel: string; maxLevel: number; subAreas: string[]; normalMonsters: MonsterDefinition[]; eliteMonsters: MonsterDefinition[]; fieldBoss: MonsterDefinition; dropTable: string[]; materialTable: { id: string; chance: number }[]; unlockQuest: string | null; previousField: string | null; nextMap: string | null; musicId: string; ambientId: string; isUnlocked: boolean; color: string; questList: string[]; entry: {x:number;z:number}; exit: {x:number;z:number}; contentFamilyId?:string; cityDirection?:'north'|'east'; regionType?:'field' };
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
 ['frostfire-highlands','Dataran Bara-Beku','Frostfire Highlands',24,32,['Punggung Bara','Jalur Es Beku','Kaldera Abu'],['Ember Yak','Frost Wolf','Magma Imp','Frostfire Wyrm','Cinderhorn','Twin Elemental Lord'],[24,25,28,30,32,34],['titanium','vibranium'],'#728b9b',[1180,1250,1490,1700,2300,9915]],
 ['sunken-ruins','Reruntuhan Tenggelam','Sunken Ruins',32,42,['Halaman Candi Terendam','Ruang Penjaga','Gudang Harta Banjir'],['Drowned Warrior','Drowned Soldier','Leech Wraith','Ruin Guardian','Sunken Sentinel','Leviathan'],[32,33,37,40,42,44],['vibranium'],'#316c7a',[1700,1896,2300,2700,3600,14595]],
 ['meteorfall-citadel','Benteng Hujan Meteor','Meteorfall Citadel',42,50,['Gerbang Bintang Jatuh','Padang Meteor','Inti Benteng Meteorfall'],['Meteor Wisp','Meteor Hound','Astral Golem','Void Knight','Meteor Titan','Meteorfall Overlord'],[42,43,46,48,49,50],['vibranium','meteorite-core'],'#584465',[2500,2820,3200,3700,4700,17680]],
];
export const FIELDS: Record<string,FieldDefinition> = Object.fromEntries(seeds.map(([id,displayName,codename,minLevel,maxLevel,subAreas,names,levels,materials,color,expValues],index) => {
 const monsters=names.map((name,i):MonsterDefinition => { const variant:MonsterVariant=i===5?'boss':i===4?'elite':'normal'; const tuning=MONSTER_VARIANTS[variant]; const level=levels[i]; return {id:`${id}-${i}`,name,level,rank:variant,variant,exp:expValues[i],maxHP:Math.round((30+level*16)*tuning.hpMultiplier),attack:Math.round((8+level*2.2)*tuning.damageMultiplier),defense:Math.round((4+level*1.1)*tuning.defenseMultiplier),magicDefense:Math.round((3+level)*tuning.defenseMultiplier),attackSpeed:variant==='boss'?1.2:variant==='elite'?1.45:1.8,movementSpeed:variant==='boss'?1.3:variant==='elite'?1.7:2.1,attackRange:variant==='boss'?5.6:1.8,dropRate:variant==='boss'?.95:variant==='elite'?.7:.35,lootTable:['health-potion-1',...materials],respawnTime:tuning.respawnTime,visualScale:tuning.visualScale,nameColor:tuning.nameColor,statusLabel:tuning.statusLabel,respawn:tuning.respawnTime}; });
 return [id,{id,displayName,codename,cityId:index<3?'arunika':'jayantara',chapter:1,minLevel,maxLevel,recommendedLevel:`${minLevel}–${maxLevel}`,subAreas,normalMonsters:monsters.slice(0,4),eliteMonsters:[monsters[4]],fieldBoss:monsters[5],dropTable:['health-potion-1','forest-vest','adventurer-pet-egg'],materialTable:materials.map((id,i)=>({id,chance:i>0&&['titanium','vibranium','meteorite-core'].includes(id)?0.15:0.65})),unlockQuest:null,previousField:index?seeds[index-1][0]:null,nextMap:seeds[index+1]?.[0]??null,musicId:`field-${id}`,ambientId:`ambient-${id}`,isUnlocked:index===0,color,questList:[`field-${id}-easy`,`field-${id}-veteran`,`field-${id}-elite`],entry:{x:0,z:30},exit:{x:0,z:34}}];
}));

FIELDS['verdant-plains'].entry = {...VERDANT_TERRAIN.entry};
FIELDS['verdant-plains'].exit = {...VERDANT_TERRAIN.exit};

// A new region identity, but the SAME authoritative monster objects and loot tier.
FIELDS['east-gate-arunika'] = {
 ...FIELDS['verdant-plains'], id:'east-gate-arunika',displayName:'East Gate Arunika',codename:'Sunrise Frontier',
 contentFamilyId:'verdant-plains',cityDirection:'east',regionType:'field',
 subAreas:['Gerbang Timur','Dusun Purnama','Lembah Cahaya'],previousField:null,nextMap:'ironveil-mines',
 musicId:'field-east-gate-arunika',ambientId:'ambient-east-gate-arunika',color:'#83a95c',
 questList:['field-east-gate-arunika-easy','field-east-gate-arunika-veteran','field-east-gate-arunika-elite'],
 entry:{...EAST_GATE_TERRAIN.entry},exit:{...EAST_GATE_TERRAIN.exit},
};
CITIES.arunika.connectedFields.push('east-gate-arunika');
// Optional imported showcase field. It reuses the existing Verdant Plains
// gameplay definitions while keeping its map identity, spawns, and bounds
// isolated from the authored regions above.
FIELDS['sands-location'] = {
 ...FIELDS['verdant-plains'],
 id:'sands-location',
 cityId:'arunika',
 displayName:'Sands Location',
 codename:'Sands Location',
 contentFamilyId:'verdant-plains',
 subAreas:['Pantai Pasir','Kuil Tenggelam','Dataran Oasis'],
 previousField:null,
 nextMap:null,
 musicId:'field-sands-location',
 ambientId:'ambient-sands-location',
 color:'#c8ad73',
 questList:['field-sands-location-easy','field-sands-location-veteran','field-sands-location-elite'],
 // Clear ground in front of the imported entrance, not the chest at z=30.
 entry:sandsWorldPoint(0,35),
 // Put the return gate at the opposite end of the long imported scene so it
 // cannot sit between the follow camera and the player on arrival.
 exit:sandsWorldPoint(0,-36),
 isUnlocked:true,
};
CITIES.arunika.connectedFields.push('sands-location');
export const startingFieldIds = () => Object.values(FIELDS).filter(field=>field.isUnlocked&&field.chapter<=WORLD_CONFIG.chapterCap).map(field=>field.id);
export const fieldContent = (fieldId:string) => {const field=FIELDS[fieldId]??FIELDS['verdant-plains'];return FIELDS[field.contentFamilyId??field.id];};

export const FIELD_NPCS: Record<string, NpcDefinition> = {
 'verdant-plains': {id:'field-npc-verdant',name:'Penjaga Pos Arunika',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Padang Arunika.',x:-26,z:28,fieldId:'verdant-plains'},
 'ironveil-mines': {id:'field-npc-ironveil',name:'Mandor Tambang',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Tambang Selubung Besi.',x:-26,z:28,fieldId:'ironveil-mines'},
 'whispering-wilds': {id:'field-npc-whispering',name:'Pawang Rimba',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Rimba Bisik.',x:-26,z:28,fieldId:'whispering-wilds'},
 'frostfire-highlands': {id:'field-npc-frostfire',name:'Penjaga Bara-Beku',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Dataran Bara-Beku.',x:-26,z:28,fieldId:'frostfire-highlands'},
 'sunken-ruins': {id:'field-npc-sunken',name:'Penjaga Reruntuhan',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Reruntuhan Tenggelam.',x:-26,z:28,fieldId:'sunken-ruins'},
 'meteorfall-citadel': {id:'field-npc-meteor',name:'Penjaga Benteng Meteor',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Quest field, teleport, dan toko kebutuhan farming Benteng Hujan Meteor.',x:-26,z:28,fieldId:'meteorfall-citadel'},
 'sands-location': {id:'field-npc-sands',name:'Penjaga Oasis',type:'merchant',service:'field-camp',services:['buy','sell','teleport','quest'],interactionRange:2.5,shopInventory:[],description:'Perbekalan, perjalanan, dan misi di Sands Location.',...sandsWorldPoint(-7,26),fieldId:'sands-location'},
};

Object.assign(FIELD_NPCS['verdant-plains'], VERDANT_TERRAIN.camp);
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
export function travel(hero:Hero,id:string) {
 const reason=unlockReason(hero,id); if(reason) return {ok:false,reason};
 refreshUnlocks(hero);
 if(CITIES[id]) {hero.currentCity=id;hero.inCity=true;hero.x=0;hero.z=8;}
 else {hero.currentField=id;hero.currentCity=FIELDS[id].cityId;hero.inCity=false;hero.x=FIELDS[id].entry.x;hero.z=FIELDS[id].entry.z;}
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
 for(const field of Object.values(FIELDS)) if(id===`story-${field.id}`) return field.questList[0];
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
  {id:'main-verdant-bisikan',title:'Bisikan di Lembah',chapter:1,category:'main',giverNpcId:'aruna-0',giverNpcName:'Adipati Aruna',giverNpcRole:'Main Story',giverMapId:'arunika',giverMapName:CITIES.arunika.displayName,recommendedLevel:1,requiredLevel:1,requiredQuestIds:[],requiredMapId:null,requiredJob:null,targetMapId:'verdant-plains',targetMapName:FIELDS['verdant-plains'].displayName,description:'Bebaskan lembah dari makhluk yang menyerap cahaya.',objectives:[{type:'kill',targetId:'verdant-plains-normal',targetName:'Lumut Liar',required:6}],rewards:{xp:80,gold:80,items:[]},repeatable:false,cooldownHours:0,status:'available',progress:[]},
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
