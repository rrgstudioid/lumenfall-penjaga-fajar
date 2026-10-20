// Actual Game/rules/queue/HP/save consumers. DOM/WebGL/audio are OFFLINE render stubs.
// Forced RNG and enemy stats below are mechanical unit probes, never browser proof.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import * as T from 'three';
const output=process.env.LOADOUT_CHECKPOINT;assert(output);
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1280,clientHeight:720,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/specialization'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'loadout-cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const {Game}=await load('world'),rules=await load('rules'),items=await load('items'),{CITIES}=await load('regions');
const ref=await load('warrior-specialization-reference-v3');
const warrior=await load('warrior-v3'),berserker=await load('berserker-v3'),blade=await load('blade-master-v3');
const definitions={...warrior.WARRIOR_V3_SKILL_MAP,...berserker.BERSERKER_V3_SKILL_MAP,...blade.BLADE_MASTER_V3_SKILL_MAP};
const core=await load('equipment-authoring-v1'),view=await load('character-view'),detail=await load('equipment-detail-presentation');
const foundation=await load('attack-range-v2');
/** @type {Array<[string,string,number,Record<string,number>,Record<string,number>]>} */
const body=[['arunika-head','head',3,{defense:3,hp:8},{vit:1}],['forest-vest','chest',10,{defense:10,dex:2,evasion:2},{}],['arunika-gloves','gloves',3,{defense:3,hp:8},{vit:1}],['arunika-legs','legs',3,{defense:3,hp:8},{vit:1}],['arunika-boots','boots',3,{defense:3,hp:8},{vit:1}]];
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
let serial=0;const evidence=[];
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function game(scope='adventurer',level=14,dual=true) {
 storage.clear();const h=rules.createV3AdventurerHero('loadout-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;g.actor.position.set(g.hero.x,0,g.hero.z);
 while(g.hero.level<level)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
 if(scope!=='adventurer'){
  const n=CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=n.x;g.hero.z=n.z;g.actor.position.set(n.x,0,n.z);assert(g.openNpc(n.id));assert(g.chooseCoreJob('warrior'));g.closeNpcMenu();
  if(scope!=='warrior')assert(scope==='berserker'?rules.chooseV3Berserker(g.hero):rules.chooseV3BladeMaster(g.hero));
 }
 const learn=(id,rank=1)=>{for(const p of definitions[id]?.prerequisiteSkills??[])learn(p.skillId,p.requiredRank);while((g.hero.skillLevels[id]??0)<rank)assert(g.learnSkill(id),id);};
 if(scope==='adventurer'&&level>=3){assert(g.learnSkill('v3-adventurer-power-strike'));assert(g.learnSkill('v3-adventurer-minor-heal'));}
 else if(scope!=='adventurer')learn('v3-warrior-strike');
 if(scope==='blade_master'&&dual)learn('v3-blade-master-twin-blade-mastery');
 own(g,scope==='berserker'?'jayantara-two-hand-sword':level<10?'field-verdant-plains-sword':'field-ironveil-mines-sword','mainHand');
 if(scope==='blade_master'&&dual)own(g,'field-ironveil-mines-sword','offHand');
 g.float=()=>{};for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};
 return g;
}
function own(g,id,slot){const item=items.createItem(id);const added=items.addItemToInventory(g.hero.inventory,item,g.hero.inventoryCapacity);assert.equal(added.remaining,0);g.hero.inventory=added.inventory;if(slot)assert(g.equipItem(item.id,slot));return g.hero.inventory.find(i=>i.id===item.id);}
function activate(g){const r=g.hero.specialization?g.enableDevelopmentWarriorSpecializationReference({lifecycleRenewal:true}):g.hero.coreJob?g.enableDevelopmentWarriorReference({lifecycleRenewal:true}):g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true});assert(r.ok,JSON.stringify(r));}
function buyBody(g){
 g.hero.gold=10000; // MECHANICAL funds; unchanged original NPC transaction and prices.
 const n=CITIES.arunika.npcList.find(n=>n.service==='equipment');g.hero.x=n.x;g.hero.z=n.z;g.actor.position.set(n.x,0,n.z);assert(g.openNpc(n.id));
 for(const [id,slot] of body){assert(g.npcBuy(id,1),id);const item=g.hero.inventory.find(i=>i.templateId===id);assert(item);assert(g.equipItem(item.id,slot));}
 g.closeNpcMenu();
}
function target(g){const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));const e={id:++serial,group,home:group.position.clone(),hp:10000,max:10000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'FIXTURE-'+serial,definition:{defense:70,magicDefense:300},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion:0,marked:false,weakPoint:false};g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));g.faceTarget(e);return e;}
function probe(g,values){let count=0;g.rand=()=>{assert(count<values.length,'unexpected draw');return values[count++];};return()=>count;}
await test('pickup cannot repair a stale source or opt-in an invalid actor; full inventory retains source',()=>{
 const g=game();buyBody(g);activate(g);const item=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);item.baseStats.attack+=1;
 assert(!g.getDevelopmentAdventurerRange().ok);g.spawnGroundLoot(items.createItem('iron'),g.actor.position.clone());assert(g.pickupGroundLoot());assert(!g.getDevelopmentAdventurerRange().ok);g.dispose();
 const h=game();buyBody(h);activate(h);h.hero.inventoryCapacity=0;h.spawnGroundLoot(items.createItem('iron'),h.actor.position.clone());const seed=h.seed;
 assert(!h.pickupGroundLoot());assert.equal(h.groundLoot.length,1);assert.equal(h.seed,seed);assert(h.getDevelopmentAdventurerRange().ok);h.dispose();
});
for(const scope of ['adventurer','warrior'])for(const enabled of [true,false])await test(`quest hunting pickup/potion preserves ${scope} ${enabled?'prior active':'OFF'} without refill/RNG/CD changes`,()=>{
 const g=game(scope,scope==='warrior'?16:14);buyBody(g);
 own(g,'health-potion-1');const potion=g.hero.inventory.find(i=>i.templateId==='health-potion-1');assert(potion);g.hero.hp=rules.maxHP(g.hero)-50;
 if(enabled)activate(g);
 const seed=g.seed,mana=g.hero.mana,hp=g.hero.hp;g.skillCooldowns['quest-ux-probe']=3.5;
 const drop=items.createItem('iron');g.spawnGroundLoot(drop,g.actor.position.clone());
 assert(g.pickupGroundLoot());assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);assert.equal(g.seed,seed);assert.equal(g.skillCooldowns['quest-ux-probe'],3.5);
 assert.equal(g.getDevelopmentAdventurerRange()?.ok??null,enabled?true:null);
 assert(g.useItem(potion.id));assert.equal(g.hero.hp,Math.min(rules.maxHP(g.hero),hp+Math.round(rules.maxHP(g.hero)*.30)));assert.equal(g.hero.mana,mana);assert.equal(g.seed,seed);assert.equal(g.skillCooldowns['quest-ux-probe'],3.5);
 assert.equal(g.getDevelopmentAdventurerRange()?.ok??null,enabled?true:null);g.dispose();
});
for(const [id,slot,def,base,bonus] of body)await test('exact balanced acquisition '+id+'; core only enhancement; old/new/locked/empty socket',()=>{
 const i=items.createItem(id),snapshot=JSON.stringify(i);assert.equal(i.authoredEquipmentProfile,`BODY_LV1_balanced_${slot}_V1`);assert.deepEqual(i.baseStats,base);assert.deepEqual(i.bonusStats,bonus);assert.equal(i.uniqueStatsLocked,false);
 for(const n of [0,5,10,15]){const fixture={...i,enhancementLevel:n};const stats=items.calculateEnhancedBaseStats(fixture);close(stats.defense,def*(1+.04*n));close(stats.magicDefense,def*(1+.04*n));for(const [k,v] of Object.entries(base))if(k!=='defense')assert.equal(stats[k],v);}
 const old={...i,enhancementLevel:6};delete old.authoredEquipmentVersion;delete old.authoredEquipmentProfile;
 const loaded=items.normalizeItem(old);assert.equal(loaded.authoredEquipmentVersion,undefined);assert.equal(loaded.enhancementLevel,6);assert.deepEqual(loaded.baseStats,base);assert.deepEqual(loaded.bonusStats,bonus);
 const locked=items.normalizeItem({...i,uniqueStatsLocked:true});assert.deepEqual(items.calculateEquipmentUniqueStats(locked),{});assert.equal(locked.uniqueStatsLocked,true);assert.equal(items.normalizeItem(i).authoredEquipmentProfile,i.authoredEquipmentProfile);assert.equal(JSON.stringify(i),snapshot);
});
for(const [scope,level] of [['adventurer',1],['adventurer',14],['warrior',16],['warrior',61],['berserker',60],['berserker',80],['blade_master',60],['blade_master',80]])await test('actual shop/equip selected '+scope+level+' with full balanced loadout; independent stats and damage',()=>{
 const g=game(scope,level);activate(g);const before=rules.derivedStats(g.hero);g.hero.hp=Math.min(100,g.hero.hp);const hp=g.hero.hp,mana=g.hero.mana;buyBody(g);
 const r=g.getDevelopmentAdventurerRange();assert(r.ok,JSON.stringify(r));assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);
 const stats=rules.derivedStats(g.hero),n=level-1;assert.equal(stats.vit,19);assert.equal(stats.dex,17);assert.equal(stats.accuracy,before.accuracy+2);assert.equal(stats.evasion,2.2);
 close(stats.physicalDefense-before.physicalDefense,22+4*.5);close(stats.magicDefense-before.magicDefense,22+4*.6);
 assert.equal(stats.maxHP,Math.round(rules.resourceProfileFor(g.hero).baseHP+n*rules.resourceProfileFor(g.hero).hpPerLevel+19*(8+.05*n)+32));
 const great=scope==='berserker',dual=scope==='blade_master',baseAttack=7+Math.floor(1.1*level),weapon=great?[196,204]:level<10?[9,11]:[32,36];
 assert.equal(r.value.MAIN.min,baseAttack+(great?4:0)+weapon[0]+(dual?16:0));assert.equal(r.value.MAIN.max,baseAttack+(great?4:0)+weapon[1]+(dual?18:0));
 const beforeRead=JSON.stringify(g.hero),seed=g.seed,cd=JSON.stringify(g.skillCooldowns);for(let t=0;t<8;t++){assert(g.getDevelopmentAdventurerRange().ok);for(const [id,slot] of body){const item=g.hero.inventory.find(i=>i.templateId===id);const p=view.previewEquipmentChange(g.hero,item,slot);assert(p.validation.ok);detail.equipmentDetail(item,{development:true,owner:g.hero,selected:true});}}
 assert.equal(JSON.stringify(g.hero),beforeRead);assert.equal(g.seed,seed);assert.equal(JSON.stringify(g.skillCooldowns),cd);
 if(level>=14){const e=target(g),draws=probe(g,[.25,0,.99]);const skill=scope==='adventurer'?'v3-adventurer-power-strike':'v3-warrior-strike';assert(g.castSkill(skill));const result=scope==='adventurer'?g.getDevelopmentAdventurerRanksResult():scope==='warrior'?g.getDevelopmentWarriorResult():g.getDevelopmentSpecializationResult();assert(result.ok,JSON.stringify(result));const c=scope==='adventurer'?1.20:1.00;const raw=(baseAttack+(great?4:0)+weapon[0]+.25*(weapon[1]-weapon[0]))*c+(great?4*.08:0);close(result.sample.totalRaw,raw);assert.equal(10000-e.hp,Math.round(raw*(500+10*level)/(570+10*level)));assert.equal(draws(),3);}
 g.invincible=0;g.blocking=false;probe(g,[.99,.99]);const previous=g.hero.hp;g.hurtHero(50,'MECHANICAL_PHYSICAL_DIRECT');const factor=(500+10*level)/(500+10*level+stats.physicalDefense);close(previous-g.hero.hp,50*factor);
 evidence.push({scope,level,range:r.value,stats,HP:g.hero.hp});g.dispose();
});
for(const [id,range] of [['field-whispering-wilds-sword',[48,53]],['field-frostfire-highlands-sword',[69,75]],['field-sunken-ruins-sword',[91,96]]])await test('mapped Warrior Sword permission, continuous enhancement and source readout '+id,()=>{
 const g=game('warrior',40);const item=own(g,id,'mainHand');buyBody(g);activate(g);const source=core.resolveAuthoredEquipmentItem(item);assert(source.ok);
 // Independent source equation table values checked below by exact literal approved rows.
 const r=g.getDevelopmentAdventurerRange();assert(r.ok);assert.deepEqual(r.value.weapon,source.PATK);
 const literal=range;assert.deepEqual(source.profile.PATK,{min:literal[0],max:literal[1]});
 const current=g.hero.inventory.find(i=>i.id===item.id);current.enhancementLevel=5;assert.equal(g.getDevelopmentAdventurerRange().ok,false); // no getter rebind
 activate(g);close(g.getDevelopmentAdventurerRange().value.weapon.min,literal[0]*1.2);assert.match(rules.enhancementPreview(g.hero,current.id).blockedReason,/HOLD/);g.dispose();
});
for(const kind of ['unknownVersion','wrongProfile','extraPrimary','wrongLink','duplicate','appliedRune','unlockedExtra','oldUnmarked','wrongPermission'])await test('full source rejection '+kind+'; no stripping, payment, RNG or partial equip side effect',()=>{
 const g=game();buyBody(g);activate(g);const item=g.hero.inventory.find(i=>i.templateId==='arunika-head');
 if(kind==='unknownVersion')item.authoredEquipmentVersion='unknown';if(kind==='wrongProfile')item.authoredEquipmentProfile='BODY_LV5_balanced_head_V1';if(kind==='extraPrimary')item.baseStats.str=1;if(kind==='wrongLink')g.hero.equipment.gloves=item.id;if(kind==='duplicate')g.hero.inventory.push(structuredClone(item));if(kind==='appliedRune')item.sockets=[{id:'s',rune:items.createRuneItem('might','cracked')}];if(kind==='unlockedExtra')item.bonusStats.str=1;if(kind==='oldUnmarked'){delete item.authoredEquipmentVersion;delete item.authoredEquipmentProfile;}if(kind==='wrongPermission')item.allowedJobs=['rogue'];
 const hero=JSON.stringify(g.hero),seed=g.seed,cd=JSON.stringify(g.skillCooldowns);assert.equal(g.getDevelopmentAdventurerRange().ok,false);const r=g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true});assert.equal(r.ok,false);assert.equal(JSON.stringify(g.hero),hero);assert.equal(g.seed,seed);assert.equal(JSON.stringify(g.skillCooldowns),cd);evidence.push({case:kind,reason:r});g.dispose();
});
await test('lawful equip/unequip, allocation, locked fixed bonus, travel, death/respawn, save/Continue and OFF',async()=>{
 const g=game();buyBody(g);activate(g);const head=g.hero.inventory.find(i=>i.templateId==='arunika-head');g.hero.hp=100;g.hero.mana=20;
 assert(g.unequipItem('head'));assert(g.getDevelopmentAdventurerRange().ok);assert.equal(g.hero.hp,100);assert(g.equipItem(head.id,'head'));assert(g.getDevelopmentAdventurerRange().ok);assert.equal(g.hero.hp,100);assert(g.allocateStatPoint('vit'));assert(g.getDevelopmentAdventurerRange().ok);
 g.waitForRegionLoads=async()=>{};assert(g.changeRegion('verdant-plains-v2'));await new Promise(r=>setTimeout(r,30));assert(g.getDevelopmentAdventurerRange().ok,JSON.stringify(g.getDevelopmentAdventurerRange()));assert.equal(g.hero.mana,20);
 const ids={...g.hero.equipment},inventory=JSON.stringify(g.hero.inventory);g.save();const slot=g.hero.slotId;g.dispose();const reload=new Game(element(),element(),element(),()=>{},()=>{},slot);reload.started=true;assert.deepEqual(reload.hero.equipment,ids);assert.deepEqual(JSON.parse(JSON.stringify(reload.hero.inventory)),JSON.parse(inventory));assert.equal(reload.getDevelopmentAdventurerRange(),null);activate(reload);
 probe(reload,[.99,.99]);reload.invincible=0;reload.hurtHero(1e6,'MECHANICAL_LETHAL');assert(reload.dead);assert.equal(reload.getDevelopmentAdventurerRange().ok,false);reload.respawn();assert(!reload.dead);assert(reload.getDevelopmentAdventurerRange().ok);reload.dispose();
 const off=game();buyBody(off);assert.equal(off.getDevelopmentAdventurerRange(),null);assert(off.unequipItem('head'));assert.equal(off.getDevelopmentAdventurerRange(),null);off.dispose();
});
await test('locked fixed VIT stays inactive and empty socket admitted; raw combined Basic all three indices',()=>{
 const g=game('blade_master',80);buyBody(g);const head=g.hero.inventory.find(i=>i.templateId==='arunika-head');head.uniqueStatsLocked=true;head.sockets=[{id:'empty',rune:null}];activate(g);assert.equal(rules.derivedStats(g.hero).vit,18);
 const s=ref.openSpecializationBinding(g);assert(s.ok);for(const combo of [1,2,3]){const p=ref.prepareSpecializationBasic(s.value,g,combo);assert(p.ok);const sample=foundation.sampleRawAttackExecution(p.value.snapshot,()=>.25);assert(sample.ok);assert.equal(sample.value.totalRaw,144.5);assert.equal(p.value.snapshot.hits.length,1);}
 g.dispose();
});
await test('full-loadout Minor Heal R3 uses actual MaxHP once, no attack draw; lower max clamps without refill',()=>{
 const g=game();buyBody(g);activate(g);assert(g.learnSkill('v3-adventurer-minor-heal'));assert(g.learnSkill('v3-adventurer-minor-heal'));
 assert.equal(rules.derivedStats(g.hero).maxHP,670);g.hero.hp=570;const mana=g.hero.mana,draws=probe(g,[]);
 assert(g.castSkill('v3-adventurer-minor-heal'));assert.equal(g.hero.hp,637);assert.equal(g.hero.mana,mana-12);assert.equal(g.skillCooldowns['v3-adventurer-minor-heal'],26);assert.equal(draws(),0);
 const hp=g.hero.hp,mp=g.hero.mana;assert.equal(g.castSkill('v3-adventurer-minor-heal'),false);assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mp);
 g.hero.hp=670;assert(g.unequipItem('head'));assert.equal(g.hero.hp,654);assert.equal(g.hero.mana,mp);assert(g.getDevelopmentAdventurerRange().ok);g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'LOADOUT_CONSUMER_EVIDENCE.json'),JSON.stringify(evidence,null,2));});
