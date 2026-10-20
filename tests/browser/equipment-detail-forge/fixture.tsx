import {equipmentDetail} from '../../../lib/game/equipment-detail-presentation';
import {readEquipmentDetail} from '../../../components/game/equipment-detail';
import {DetailExamples} from './examples';
import {createRoot} from 'react-dom/client';
import Home from '../../../app/page';
import {registerDevelopmentHomeLifecycle} from '../../../lib/game/development-home-lifecycle';
import type {Game} from '../../../lib/game/world';
import * as rules from '../../../lib/game/rules';
import {createItem,addItemToInventory} from '../../../lib/game/items';
import {CITIES} from '../../../lib/game/regions';
import {BODY_CORE_PROFILES,JEWELRY_COVERAGE_TIERS,resolveEquipmentCore,resolveAuthoredEquipmentItem} from '../../../lib/game/equipment-authoring-v1';
let game:Game|null=null,generation=0;
const state=(g:Game)=>({generation,level:g.hero.level,job:g.hero.coreJob,spec:g.hero.specialization,HP:g.hero.hp,Mana:g.hero.mana,maxHP:rules.maxHP(g.hero),maxMana:rules.derivedStats(g.hero).maxMana,points:g.hero.statPoints,allocation:{...g.hero.allocatedStats},equipment:{...g.hero.equipment},gold:g.hero.gold,forge:g.forgeNpcId,items:g.hero.inventory.map(i=>({id:i.id,template:i.templateId,version:i.authoredEquipmentVersion,profile:i.authoredEquipmentProfile,level:i.levelRequirement,N:i.enhancementLevel,quantity:i.quantity,base:i.baseStats,bonus:i.bonusStats,sockets:i.sockets})),seed:g.seed,queue:g.skillHits.size,cd:{...g.skillCooldowns},paused:g.paused,dead:g.dead,transition:g.transitioning,region:g.activeLocationId,policy:{warrior:g.getDevelopmentWarriorAvailability(),spec:g.getDevelopmentSpecializationAvailability()},webgl:g.renderer.getContext().constructor.name});
const send=(v:object)=>{void fetch('/checkpoint-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({UTC:new Date().toISOString(),...v})}).catch(()=>{});};
const record=(type:string,extra:object={})=>{const entry={type,...extra,state:game?state(game):null};document.querySelector('#readout')!.textContent=JSON.stringify(entry,null,2);send(entry);};
registerDevelopmentHomeLifecycle(event=>{
 if(event.type==='disposed'){if(game===event.game)game=null;record('ACTUAL_HOME_DISPOSED');return;}
 const g=event.game;
 game=g;generation++;record('ACTUAL_HOME_GAME');
 for(const key of ['chooseCoreJob','allocateStatPoint','equipItem','unequipItem','npcBuy','respawn','changeRegion','attack','castSkill','enhanceItem','openForge','closeForge'] as const){
  const original=g[key].bind(g);(g[key] as unknown)=(...args:unknown[])=>{const before=state(g),result=Reflect.apply(original,g,args);record('ORIGINAL_'+key,{args,before,result});return result;};
 }
 const incoming=g.hurtHero.bind(g);g.hurtHero=(...args)=>{const before=state(g);const result=Reflect.apply(incoming,g,args);record('ORIGINAL_INCOMING',{args,before});return result;};
});
const button=(label:string,action:()=>void|Promise<void>)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{void Promise.resolve().then(action).catch(e=>record('FIXTURE_ERROR',{message:String(e)}));};document.querySelector('#controls')!.appendChild(b);};
button('Setup XP15 and original Core trainer',()=>{
 const g=game;if(!g?.started)throw Error('Start Home first');while(g.hero.level<15)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));
 for(const slot of Object.keys(g.hero.equipment) as (keyof typeof g.hero.equipment)[])if(g.hero.equipment[slot])g.unequipItem(slot);
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core')!;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Original trainer unavailable');record('MECHANICAL_XP_TRAINER');
});
button('Setup equipment merchant and fixture GOLD',()=>{
 const g=game;if(!g?.started||!g.hero.inCity)throw Error('Own city actor required');g.hero.gold+=2000;
 const npc=CITIES[g.hero.currentCity].npcList.find(n=>n.service==='equipment')!;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Original merchant unavailable');record('MECHANICAL_GOLD_MERCHANT');
});
button('Supply existing old armor for clamp proof',()=>{
 const g=game;if(!g?.started)throw Error('Start Home first');const item=createItem('arunika-head',{id:g.hero.slotId+'-existing-head'}),a=addItemToInventory(g.hero.inventory,item,g.hero.inventoryCapacity);if(a.remaining)throw Error('Inventory full');g.hero.inventory=a.inventory;g.emit();record('MECHANICAL_EXISTING_ARMOR_NOT_NEW_BODY_MAPPING');
});
// Mechanical fixture setup only; original region and NPC consumers still validate access.
button('Setup original travel to Arunika',()=>{const g=game;if(!g?.started)throw Error('Start Home');if(!g.changeRegion('arunika'))throw Error('Original travel rejected');record('MECHANICAL_ORIGINAL_CITY_TRAVEL');});
button('Stand at existing Forge NPC',()=>{const g=game;if(!g?.started||g.transitioning||!g.hero.inCity)throw Error('Wait for original city load');const npc=CITIES[g.hero.currentCity].npcList.find(n=>n.service==='forge')!;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Original NPC rejected');record('MECHANICAL_POSITION_ORIGINAL_NPC');});
button('Supply one existing Iron material',()=>{const g=game;if(!g?.started)throw Error('Start Home');const item=createItem('iron',{id:'forge-proof-iron',quantity:1});const a=addItemToInventory(g.hero.inventory,item,g.hero.inventoryCapacity);if(a.remaining)throw Error('Inventory full');g.hero.inventory=a.inventory;g.emit();record('MECHANICAL_EXISTING_MATERIAL');});
button('Original incoming physical100',()=>{game?.hurtHero(100,'MECHANICAL_PHYSICAL_DIRECT');record('INCOMING_OUTCOME');});
button('Original lethal incoming',()=>{game?.hurtHero(1e9,'MECHANICAL_PHYSICAL_DIRECT');record('DEATH_OUTCOME');});
button('Observe profiles and read purity',()=>{
 const g=game;if(!g)return;const before=JSON.stringify(g.hero),seed=g.seed,cd=JSON.stringify(g.skillCooldowns),queue=g.skillHits.size;
 for(let n=0;n<20;n++){for(const p of BODY_CORE_PROFILES)resolveEquipmentCore(p.id,15);for(const i of g.hero.inventory)resolveAuthoredEquipmentItem(i);}
 const passed=before===JSON.stringify(g.hero)&&seed===g.seed&&cd===JSON.stringify(g.skillCooldowns)&&queue===g.skillHits.size;
 if(!passed)throw Error('Pure reads mutated actual state');
 record('PROFILE_PURITY',{passed,bodyProfiles:BODY_CORE_PROFILES.length,scope:'Pure profile read, not catalog/equip proof',body95:['balanced','physical','magic'].map(f=>resolveEquipmentCore(`BODY_LV95_${f}_chest_V1`,15)),jewelry:JEWELRY_COVERAGE_TIERS});
});
button('Original save and own isolated reload',async()=>{
 const g=game;if(!g)return;record('BEFORE_SAVE');g.save();const own=(window as unknown as {__equipmentStorage:{local:Map<string,string>}}).__equipmentStorage;
 const entries=[...own.local].filter(([key])=>key===rules.SAVE_KEY);if(entries.length!==1)throw Error('Own collection missing');
 const response=await fetch('/fixture-handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries})});if(!response.ok)throw Error('Handoff failed');location.reload();
});
button('Observe current state',()=>record('CURRENT_STATE'));
button('Dispose own Game',()=>{homeRoot.unmount();examplesRoot.unmount();game=null;record('CLEANUP');});
button('Equipment detail purity',()=>{
 const g=game;if(!g)return;const take=()=>JSON.stringify({hero:g.hero,seed:g.seed,queue:g.skillHits.size,cd:g.skillCooldowns,storage:[...(window as unknown as {__equipmentStorage:{local:Map<string,string>}}).__equipmentStorage.local],availability:[g.getDevelopmentWarriorAvailability(),g.getDevelopmentSpecializationAvailability()]});
 const before=take();for(let n=0;n<50;n++)for(const item of g.hero.inventory){equipmentDetail(item,{owner:g.hero,development:true});readEquipmentDetail(item,g);}const after=take();
 if(before!==after)throw Error('Presentation mutated live state');record('DETAIL_PURITY',{passed:true,repeatedReads:50});
});
const examples=document.createElement('div');document.body.appendChild(examples);const examplesRoot=createRoot(examples);examplesRoot.render(<DetailExamples/>);
const homeRoot=createRoot(document.querySelector('#root')!);
homeRoot.render(<Home/>);
