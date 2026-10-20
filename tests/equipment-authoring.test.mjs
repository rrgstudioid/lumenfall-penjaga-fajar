// OFFLINE render stubs only. Original Game/rules/save consumers; synthetic options labelled.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
const output=process.env.EQUIPMENT_CHECKPOINT;assert(output);
const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const element=()=>({style:{},clientWidth:1280,clientHeight:720,appendChild(){},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:storage,devicePixelRatio:1,window:{localStorage:storage,location:{hostname:'localhost',pathname:'/equipment'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(output,'offline-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:equipment-three')return '\0equipment-three';},load(id){if(id==='\0equipment-three')return `export * from 'three';export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:equipment-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const core=await load('equipment-authoring-v1'),items=await load('items'),rules=await load('rules'),{Game}=await load('world'),{CITIES}=await load('regions'),dual=await load('dual-wield');
const table=JSON.parse(fs.readFileSync(new URL('./fixtures/equipment-body-approved-run02.json',import.meta.url)));
const ui=await server.ssrLoadModule('/components/game/item-hover.tsx');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
let serial=0;const evidence=[];
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function game(job='thief'){
 memory.clear();const h=rules.createV3AdventurerHero('equipment-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;
 while(g.hero.level<15)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(const s of Object.keys(g.hero.equipment))if(g.hero.equipment[s])assert(g.unequipItem(s));
 const npc=CITIES.arunika.npcList.find(x=>x.service==='core');g.actor.position.set(npc.x,0,npc.z);g.hero.x=npc.x;g.hero.z=npc.z;
 assert(g.openNpc(npc.id));if(job!==null)assert(g.chooseCoreJob(job));g.closeNpcMenu();
 return g;
}
function own(g,item){const a=items.addItemToInventory(g.hero.inventory,item,g.hero.inventoryCapacity);assert.equal(a.remaining,0);g.hero.inventory=a.inventory;return item;}
for(const frame of ['balanced','physical','magic'])await test('approved body '+frame+' exact table, all milestones and fractional enhancement',()=>{
 for(const row of table.rows.filter(x=>x.frame===frame))for(const n of [0,5,10,15]){
  const p=core.resolveEquipmentCore(`BODY_LV${row.level}_${frame}_${row.slot}_V1`,n);assert(p.ok);assert.equal(p.profile.PDEF,row.corePDEF);assert.equal(p.profile.MDEF,row.coreMDEF);
  close(p.PDEF,row.corePDEF*(100+4*n)/100);close(p.MDEF,row.coreMDEF*(100+4*n)/100);assert.equal(p.PATK,null);assert.equal(p.MATK,null);
  assert(Object.isFrozen(p)&&Object.isFrozen(p.profile));
 }
});
await test('independent armor authoring/Gloves oracle, no runtime frame or class multiplier',()=>{
 assert.equal(core.BODY_CORE_PROFILES.length,180);
 for(const L of table.selectedMilestones){const A=2*L+17,s=Math.floor((8*A+25)/50),gl=Math.max(3,Math.floor((6*A+25)/50));
  const p=slot=>core.resolveEquipmentCore(`BODY_LV${L}_balanced_${slot}_V1`,0);
  assert.equal(p('head').PDEF,s);assert.equal(p('chest').PDEF,A-3*s);assert.equal(p('gloves').PDEF,gl);
  assert.equal(p('head').PDEF+p('chest').PDEF+p('legs').PDEF+p('boots').PDEF,A);
 }
 const p=core.resolveEquipmentCore('BODY_LV95_physical_chest_V1',15);close(p.PDEF,216);close(p.MDEF,129.6);
});
await test('Training Dagger exact new mapping and no duplicate reference; +5/+10/+15 mechanical only',()=>{
 const i=items.createItem(core.TRAINING_DAGGER_TEMPLATE);assert.equal(i.levelRequirement,1);assert.equal(i.authoredEquipmentProfile,core.TRAINING_DAGGER_PROFILE);
 for(const [N,min,max] of [[0,8,11],[5,9.6,13.2],[10,11.2,15.4],[15,12.8,17.6]]){
  const p=core.resolveAuthoredEquipmentItem({...i,enhancementLevel:N});assert(p.ok);close(p.PATK.min,min);close(p.PATK.max,max);assert.equal(p.profile.PATK.min,8);
 }
 assert.equal(i.allowedJobFamily,'THIEF_LINEAGE');assert.deepEqual(i.bonusStats,{});
});
await test('core-only versus legacy all-base enhancement, options/Rune once; synthetic option fixture',()=>{
 const fixture=items.createItem(core.TRAINING_DAGGER_TEMPLATE,{enhancementLevel:10,baseStats:{attack:8,str:4,hp:20},bonusStats:{vit:3,maxMana:10},sockets:[{id:'mechanical',rune:{affixes:[{stat:'vit',value:2}]}}]});
 const stats=items.calculateEquipmentStats(fixture);close(stats.attack,11.2);assert.equal(stats.str,4);assert.equal(stats.hp,20);assert.equal(stats.vit,5);assert.equal(stats.maxMana,10);
 const legacy={...fixture};delete legacy.authoredEquipmentProfile;delete legacy.authoredEquipmentVersion;
 const old=items.calculateEquipmentStats(legacy);close(old.attack,14.4);close(old.str,7.2);close(old.hp,36);assert.equal(old.vit,5);
 close(dual.weaponAttack(fixture),11.2*.9); // explicit scalar compatibility, NOT new authored-range combat
});
await test('unknown/malformed/contradictory authoring visibly unavailable, no guessed shield or MATK',()=>{
 const i=items.createItem(core.TRAINING_DAGGER_TEMPLATE);
 for(const patch of [{authoredEquipmentVersion:'unknown'},{authoredEquipmentProfile:'unknown'},{levelRequirement:2},{baseStats:{attack:9}},{enhancementLevel:NaN},{enhancementLevel:16},{authoredAttackVersion:'forged'}])assert.equal(core.resolveAuthoredEquipmentItem({...i,...patch}).ok,false);
 for(const n of [-1,.5,16,NaN,Infinity])assert.equal(core.resolveEquipmentCore(core.TRAINING_DAGGER_PROFILE,n).ok,false);
 assert.equal(core.resolveEquipmentCore('SHIELD_GUESS',0).ok,false);
 assert.equal(core.resolveAuthoredEquipmentItem({...i,authoredEquipmentProfile:'BODY_LV1_balanced_head_V1'}).reason,'ITEM_MAPPING_NOT_APPROVED');
 assert.equal(core.resolveEquipmentCore(core.TRAINING_DAGGER_PROFILE,0).MATK,null);
});
await test('old/new mixed original parser retains old identity and never inherits markers',()=>{
 const modern=items.createItem(core.TRAINING_DAGGER_TEMPLATE,{id:'new-own'}),old={...modern,id:'old-own',enhancementLevel:6,baseStats:{attack:8,str:2},bonusStats:{vit:1},quantity:1};delete old.authoredEquipmentVersion;delete old.authoredEquipmentProfile;
 const a=items.normalizeItem(JSON.parse(JSON.stringify(old))),b=items.normalizeItem(JSON.parse(JSON.stringify(modern)));
 assert.equal(a.id,'old-own');assert.equal(a.enhancementLevel,6);assert.equal(a.authoredEquipmentVersion,undefined);assert.equal(a.authoredEquipmentProfile,undefined);assert.deepEqual(a.baseStats,old.baseStats);assert.deepEqual(a.bonusStats,old.bonusStats);assert.equal(a.quantity,1);assert.equal(core.resolveAuthoredEquipmentItem(a).reason,'LEGACY_UNMARKED');
 assert.equal(b.id,modern.id);assert(core.resolveAuthoredEquipmentItem(b).ok);
 const malformed=items.normalizeItem({...modern,authoredEquipmentVersion:'unknown'});assert.equal(malformed.authoredEquipmentVersion,'unknown');assert(!core.resolveAuthoredEquipmentItem(malformed).ok);
});
await test('jewelry coverage reuse only, catalog and option values not manufactured',()=>{
 assert.deepEqual(core.JEWELRY_COVERAGE_TIERS.map(x=>x.blueprintTier),[1,1,32,32,60,80,95]);
 assert(core.JEWELRY_COVERAGE_TIERS.every(x=>Object.isFrozen(x)&&x.numericOptions==='HOLD'&&!x.duplicateTemplateRequired));
 assert.equal(items.createItem('fajar-necklace').authoredEquipmentVersion,undefined);
 assert.equal(items.createItem('dragon-veil-wings').maxEnhancementLevel,0);
});
await test('actual legal Thief Core/equip/resource clamp and original save/new Game defaultOFF',()=>{
 const g=game(),i=own(g,items.createItem(core.TRAINING_DAGGER_TEMPLATE,{id:'own-new'}));assert(g.equipItem(i.id,'mainHand'));
 const old=items.normalizeItem({...i,id:'own-old',authoredEquipmentVersion:undefined,authoredEquipmentProfile:undefined,enhancementLevel:6});own(g,old);
 assert(g.equipItem(old.id,'mainHand'));assert(g.equipItem(i.id,'mainHand'));
 g.rand=()=>.99;g.hurtHero(100,'MECHANICAL_LANDED_PHYSICAL');const current=g.hero.hp,mana=g.hero.mana;
 const hat=own(g,items.createItem('arunika-head',{id:'existing-hat'})),before=rules.maxHP(g.hero);assert(g.equipItem(hat.id,'head'));
 assert(rules.maxHP(g.hero)>before);assert.equal(g.hero.hp,current);assert.equal(g.hero.mana,mana);assert(g.unequipItem('head'));assert.equal(g.hero.hp,Math.min(current,rules.maxHP(g.hero)));
 const seed=g.seed,hero=JSON.stringify(g.hero),cd=JSON.stringify(g.skillCooldowns),queue=g.skillHits.size;
 for(let n=0;n<30;n++){core.resolveAuthoredEquipmentItem(i);ui.equipmentPresentation(i,g);core.resolveEquipmentCore('BODY_LV95_magic_chest_V1',15);}
 assert.equal(JSON.stringify(g.hero),hero);assert.equal(g.seed,seed);assert.equal(JSON.stringify(g.skillCooldowns),cd);assert.equal(g.skillHits.size,queue);
 const hpBeforeSave=g.hero.hp,manaBeforeSave=g.hero.mana;g.save();const slot=g.hero.slotId,equip=g.hero.equipment.mainHand;g.dispose();const reloaded=new Game(element(),element(),element(),()=>{},()=>{},slot);reloaded.started=true;
 const saved=reloaded.hero.inventory.find(x=>x.id===equip);assert(saved&&core.resolveAuthoredEquipmentItem(saved).ok);assert.equal(reloaded.hero.inventory.find(x=>x.id==='own-old').authoredEquipmentVersion,undefined);
 // Existing parser integer() floors persisted currentHP (rules.ts), distinct
 // from in-session absolute-current reconciliation and fractional range math.
 assert.equal(reloaded.hero.hp,Math.floor(hpBeforeSave));assert(reloaded.hero.hp<rules.maxHP(reloaded.hero));close(reloaded.hero.mana,manaBeforeSave);
 assert.equal(reloaded.getDevelopmentSpecializationAvailability(),null);assert.equal(reloaded.getDevelopmentWarriorAvailability(),null);
 evidence.push({type:'original-equip-save-load',level:reloaded.hero.level,job:reloaded.hero.coreJob,equip,marker:saved.authoredEquipmentVersion,HP:reloaded.hero.hp,Mana:reloaded.hero.mana});reloaded.dispose();
});
await test('new-version forge economy held; old forge and Wings compatibility retained',()=>{
 const g=game(),i=own(g,items.createItem(core.TRAINING_DAGGER_TEMPLATE));assert.match(rules.enhancementPreview(g.hero,i.id).blockedReason,/HOLD/);
 const before=JSON.stringify(g.hero);const result=rules.enhanceItem(g.hero,i.id,0);assert.equal(result.attempted,false);assert.equal(JSON.stringify(g.hero),before);
 const w=items.normalizeItem({...items.createItem('dragon-veil-wings'),enhancementLevel:6});assert.equal(w.enhancementLevel,6);assert.equal(w.maxEnhancementLevel,0);g.dispose();
});
await test('Warrior bounded route preserved; unsupported new metadata cannot borrow admission',()=>{
 const g=game('warrior'),i=own(g,items.createItem('field-ironveil-mines-sword',{sockets:[]}));assert(g.equipItem(i.id,'mainHand'));
 assert(g.enableDevelopmentWarriorReference({lifecycleRenewal:true}).ok);assert(g.getDevelopmentWarriorAvailability().ok);
 g.hero.inventory.find(x=>x.id===i.id).authoredEquipmentVersion='unknown';assert.equal(g.getDevelopmentWarriorAvailability().ok,false);g.dispose();
});
await test('original death/respawn and travel retain authored item, do not auto-enable',async()=>{
 const g=game(),i=own(g,items.createItem(core.TRAINING_DAGGER_TEMPLATE));assert(g.equipItem(i.id,'mainHand'));g.rand=()=>.99;g.hurtHero(1e9,'MECHANICAL_LETHAL');assert(g.dead);g.respawn();assert(!g.dead);assert.equal(g.hero.equipment.mainHand,i.id);
 // Actual transition consumer; terrain/appearance are OFFLINE render stubs.
 g.waitForRegionLoads=async()=>{};
 assert(g.changeRegion('verdant-plains-v2'));await new Promise(r=>setImmediate(r));assert.equal(g.hero.equipment.mainHand,i.id);assert.equal(g.getDevelopmentSpecializationAvailability(),null);g.dispose();
});
for(const [job,template,level] of [['thief','field-ironveil-mines-dagger',15],['warrior','field-whispering-wilds-sword',16],[null,'field-ironveil-mines-staff',15]])await test('new weapon progression original shop/equip/save: '+(job??'pre-Core compatibility, not magic class migration'),()=>{
 const g=game(job);while(g.hero.level<level)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));
 g.hero.gold=2000; // Explicit mechanical funds only; original NPC transaction below.
 const npc=CITIES.arunika.npcList.find(n=>n.service==='equipment');g.actor.position.set(npc.x,0,npc.z);g.hero.x=npc.x;g.hero.z=npc.z;assert(g.openNpc(npc.id));
 assert(g.npcBuy(template,1));const item=g.hero.inventory.find(i=>i.templateId===template);assert(item&&core.resolveAuthoredEquipmentItem(item).ok);g.closeNpcMenu();
 assert(g.equipItem(item.id,'mainHand'));const hp=g.hero.hp,mana=g.hero.mana,seed=g.seed,snapshot=JSON.stringify(g.hero);
 for(let n=0;n<20;n++){core.resolveAuthoredEquipmentItem(item);ui.equipmentPresentation(item,g);}
 assert.equal(JSON.stringify(g.hero),snapshot);assert.equal(g.seed,seed);assert.equal(g.getDevelopmentWarriorAvailability(),null);
 assert.match(rules.enhancementPreview(g.hero,item.id).blockedReason,/HOLD/);
 g.save();const slot=g.hero.slotId;g.dispose();const reload=new Game(element(),element(),element(),()=>{},()=>{},slot);assert.equal(reload.hero.equipment.mainHand,item.id);assert(core.resolveAuthoredEquipmentItem(reload.hero.inventory.find(i=>i.id===item.id)).ok);assert.equal(reload.hero.hp,Math.floor(hp));assert.equal(reload.hero.mana,mana);assert.equal(reload.getDevelopmentWarriorAvailability(),null);
 evidence.push({type:'new-profile-original-Core-NPC-buy-equip-save-load',job,template,level,profile:item.authoredEquipmentProfile});reload.dispose();
});
await test('Acolyte legal Core consumer remains unavailable; profile is not unlock authority',()=>{
 const g=game(null),npc=CITIES.arunika.npcList.find(n=>n.service==='core');assert(g.openNpc(npc.id));const before=JSON.stringify(g.hero);assert.equal(g.chooseCoreJob('acolyte'),false);assert.equal(JSON.stringify(g.hero),before);g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'actual-equipment-consumer-evidence.json'),JSON.stringify(evidence,null,2));});
