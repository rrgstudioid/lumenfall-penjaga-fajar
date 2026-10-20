import type {Hero} from './rules';
import type {MonsterDefinition,NpcDefinition,QuestJournalEntry} from './regions';
import {MINE_ID,MINE_ROOMS} from './ironveil-interior-layout';
import {IRONVEIL_ID} from './ironveil-mines-layout';
import {PLAINS_ID} from './verdant-plains-layout';

export const EARLY_QUEST_VERSION='VERDANT_IRONVEIL_DEV_V1';
export const MINE_SAMPLE_ID='quest-ironveil-survey-sample-v1';
export type EarlyObjective={type:'kill'|'collect'|'visit';targetId:string;targetName:string;required:number;region:string;level?:number;variant?:'normal';room?:string};
const npc=(id:string,name:string,fieldId:string,x:number,z:number):NpcDefinition=>({id,name,fieldId,x,z,type:'quest',service:'quests',services:['quest'],description:'Pos laporan dan quest wilayah.',interactionRange:2.5,shopInventory:[]});
export const EARLY_NPCS:readonly NpcDefinition[]=Object.freeze([
 npc('dev-padang-warden-v1','Penjaga Padang',PLAINS_ID,-261,-35),
 npc('dev-ironveil-foreman-v1','Mandor Ironveil',IRONVEIL_ID,190,-40),
 npc('dev-ironveil-surveyor-v1','Surveyor Tambang',MINE_ID,-416,51),
]);
export const developmentQuestNpcs=()=>process.env.NODE_ENV==='production'?[]:EARLY_NPCS;
const hunt=(region:string,id:string,name:string,level:number,required:number):EarlyObjective=>({type:'kill',region,targetId:id,targetName:`${name} Lv${level} · Normal`,level,variant:'normal',required});
const normal=(region:string):EarlyObjective=>({type:'kill',region,targetId:'normal-region',targetName:'Monster normal wilayah ini',variant:'normal',required:5});
const V=PLAINS_ID,E=IRONVEIL_ID,I=MINE_ID;
const rows:Array<[string,string,number,string|null,number,number,number,string,string,EarlyObjective[]]>=[
 ['verdant-hunt-1','Verdant · Hunt I',3,'main-verdant-bisikan',53,25,1,EARLY_NPCS[0].id,EARLY_NPCS[0].id,[hunt(V,V+'-small-slime','Small Slime',1,5),hunt(V,V+'-meadow-slime','Meadow Slime',3,5)]],
 ['verdant-hunt-2','Verdant · Hunt II',5,'dev-quest-v1-verdant-hunt-1',73,40,1,EARLY_NPCS[0].id,EARLY_NPCS[0].id,[hunt(V,V+'-wild-boar','Wild Boar',5,5),hunt(V,V+'-forest-piya','Forest Piya',7,5)]],
 ['verdant-hunt-3','Verdant · Hunt III',9,'dev-quest-v1-verdant-hunt-2',113,60,1,EARLY_NPCS[0].id,EARLY_NPCS[0].id,[hunt(V,V+'-stoneback-beetle','Stoneback Beetle',9,5),hunt(V,V+'-rootling','Rootling',11,5)]],
 ['verdant-finale','Verdant · Penutup',13,'dev-quest-v1-verdant-hunt-3',244,100,2,EARLY_NPCS[0].id,EARLY_NPCS[0].id,[hunt(V,V+'-thorn-wolf','Thorn Wolf',13,8)]],
 ['iron-exterior-intro','Ironveil Exterior · Pengenalan',12,null,114,0,0,EARLY_NPCS[1].id,EARLY_NPCS[1].id,[normal(E)]],
 ['iron-exterior-grub','Ironveil Exterior · Hunt I',16,'dev-quest-v1-iron-exterior-intro',183,90,1,EARLY_NPCS[1].id,EARLY_NPCS[1].id,[hunt(E,'ironveil-mines-1','Ore Grub',16,6)]],
 ['iron-exterior-bat','Ironveil Exterior · Hunt II',20,'dev-quest-v1-iron-exterior-grub',223,120,1,EARLY_NPCS[1].id,EARLY_NPCS[1].id,[hunt(E,'ironveil-mines-2','Ironfang Bat',20,6)]],
 ['iron-exterior-finale','Ironveil Exterior · Penutup',25,'dev-quest-v1-iron-exterior-bat',436,180,2,EARLY_NPCS[1].id,EARLY_NPCS[1].id,[hunt(E,'ironveil-mines-3','Tunnel Marauder',25,8)]],
 ['iron-interior-intro','Ironveil Interior · Pengenalan',20,null,178,0,0,EARLY_NPCS[1].id,EARLY_NPCS[2].id,[normal(I)]],
 ['iron-interior-survey','Ironveil Interior · Survei',24,'dev-quest-v1-iron-interior-intro',263,140,1,EARLY_NPCS[2].id,EARLY_NPCS[2].id,[
  {type:'visit',region:I,targetId:'W1',targetName:'West Excavation (W1)',room:'W1',required:1},
  {type:'visit',region:I,targetId:'W2',targetName:'Old Quarry Hall (W2)',room:'W2',required:1},
  {...hunt(I,I+'-level-13','Ore Grub',21,5),type:'collect',targetName:'Sampel tambang · Ore Grub Lv21 Normal'}]],
 ['iron-interior-security','Ironveil Interior · Pengamanan',30,'dev-quest-v1-iron-interior-survey',323,180,1,EARLY_NPCS[2].id,EARLY_NPCS[2].id,[hunt(I,I+'-level-14','Ironfang Bat',30,6)]],
 ['iron-interior-finale','Ironveil Interior · Penutup',36,'dev-quest-v1-iron-interior-security',580,240,2,EARLY_NPCS[2].id,EARLY_NPCS[2].id,[hunt(I,I+'-level-18','Ore Grub',36,5),hunt(I,I+'-level-19','Ironfang Bat',38,5)]],
];
export type EarlyQuest=Omit<QuestJournalEntry,'objectives'> & {objectives:EarlyObjective[]};
const mapName=(id:string)=>id===V?'Verdant Plains':id===E?'Ironveil Exterior':'Ironveil Interior';
const definitions:EarlyQuest[]=rows.map(([id,title,requiredLevel,previous,xp,gold,potions,giver,report,objectives])=>{
 const a=EARLY_NPCS.find(n=>n.id===giver)!,b=EARLY_NPCS.find(n=>n.id===report)!;
 return {id:'dev-quest-v1-'+id,title,chapter:1,category:'side',requiredLevel,recommendedLevel:requiredLevel,requiredQuestIds:previous?[previous]:[],requiredMapId:a.fieldId===I?E:a.fieldId!,requiredJob:null,
 giverNpcId:a.id,giverNpcName:a.name,giverNpcRole:'Quest Checkpoint',giverMapId:a.fieldId!,giverMapName:mapName(a.fieldId!),
 reportNpcId:b.id,reportNpcName:b.name,reportMapId:b.fieldId!,reportMapName:mapName(b.fieldId!),
 targetMapId:objectives[0].region,targetMapName:mapName(objectives[0].region),description:objectives.map(o=>`${o.required} ${o.targetName}`).join(' + '),
 objectives,rewards:{xp,gold,items:potions?[{templateId:'health-potion-1',quantity:potions},{templateId:'mana-potion-1',quantity:potions}]:[]},repeatable:false,cooldownHours:0,status:'locked',progress:[]};
});
export const earlyQuests=():EarlyQuest[]=>process.env.NODE_ENV==='production'?[]:structuredClone(definitions);
export const earlyQuest=(id:string)=>earlyQuests().find(q=>q.id===id);
export const objectiveKey=(id:string,index:number)=>`${id}:objective:${index}`;
export const earlyProgress=(h:Hero,q:EarlyQuest)=>q.objectives.map((o,i)=>({required:o.required,current:h.completedQuests.includes(q.id)?o.required:Math.min(o.required,Math.max(0,o.type==='collect'?h.inventory.filter(it=>it.templateId===MINE_SAMPLE_ID).reduce((n,it)=>n+it.quantity,0):h.cityProgress[objectiveKey(q.id,i)]??0))}));
export const questRegion=(h:Hero)=>h.inCity?h.currentCity:h.interiorId??h.currentField;
export function eligibleEarlyKill(o:EarlyObjective,region:string,m:Pick<MonsterDefinition,'id'|'variant'|'level'>) {
 return o.type!=='visit'&&o.region===region&&m.variant==='normal'&&(o.targetId==='normal-region'||m.id===o.targetId&&m.level===o.level);
}
/** Only called by the original accepted death consumer; not from UI/navigation. */
export function recordEarlyKill(h:Hero,region:string,m:MonsterDefinition,grantSample:()=>boolean) {
 for(const q of earlyQuests())if(h.activeQuests.includes(q.id)&&!h.completedQuests.includes(q.id))q.objectives.forEach((o,i)=>{
  if(!eligibleEarlyKill(o,region,m))return;
  if(o.type==='collect'){if(earlyProgress(h,q)[i].current<o.required)grantSample();}
  else {const key=objectiveKey(q.id,i);h.cityProgress[key]=Math.min(o.required,(h.cityProgress[key]??0)+1);}
 });
}
export function recordEarlyVisits(h:Hero) {
 if(process.env.NODE_ENV==='production'||h.hp<=0)return false;
 let changed=false;
 for(const q of earlyQuests())if(h.activeQuests.includes(q.id)&&!h.completedQuests.includes(q.id))q.objectives.forEach((o,i)=>{
  const r=o.type==='visit'&&o.region===questRegion(h)?MINE_ROOMS.find(r=>r.id===o.room):undefined,key=objectiveKey(q.id,i);
  if(r&&Math.abs(h.x-r.x)<=r.width/2&&Math.abs(h.z-r.z)<=r.depth/2&&!h.cityProgress[key]){h.cityProgress[key]=1;changed=true;}
 });
 return changed;
}
/** Change only quest-visible level AFTER prototype stats are authored. Preserve reward level. */
export function questTargetLevel<T extends {id:string;level:number;variant:string}>(m:T,region:string):T & {rewardLevel?:number} {
 if(process.env.NODE_ENV==='production'||m.variant!=='normal')return m;
 const target=definitions.flatMap(q=>q.objectives).find(o=>o.region===region&&o.targetId===m.id&&o.level!==undefined);
 return target?{...m,level:target.level!,rewardLevel:m.level}:m;
}
