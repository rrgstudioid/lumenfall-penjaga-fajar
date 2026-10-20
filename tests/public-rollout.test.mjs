// Production-transform integration. Original Game/rules/admission/queue/HP/save;
// DOM/WebGL/audio stubs and controlled RNG are OFFLINE MECHANICAL PROBES only.
import test,{after} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createServer} from 'vite';import * as T from 'three';
const out=process.env.PUBLIC_ROLLOUT_CHECKPOINT;assert(out);
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1280,clientHeight:720,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{hidden:false,querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,mode:'production',define:{'process.env.NODE_ENV':'"production"'},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(out,'production-transform-cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three';export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){},focus(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const {Game}=await load('world'),rules=await load('rules'),items=await load('items'),regions=await load('regions'),early=await load('early-quest-contract'),scroll=await load('map-scroll-contract'),shops=await load('city-services'),details=await load('equipment-detail-presentation');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const body=[['arunika-head','head',3],['forest-vest','chest',10],['arunika-gloves','gloves',3],['arunika-legs','legs',3],['arunika-boots','boots',3]];
let serial=0;
function own(g,id,slot){const i=items.createItem(id),a=items.addItemToInventory(g.hero.inventory,i,g.hero.inventoryCapacity);assert.equal(a.remaining,0);g.hero.inventory=a.inventory;if(slot)assert(g.equipItem(i.id,slot));return g.hero.inventory.find(x=>x.id===i.id);}
function game(level=1,scope='adventurer'){
 const h=rules.createV3AdventurerHero('public-own-'+(++serial));while(h.level<level)rules.gainXP(h,rules.xpNeeded(h.level));
 for(const slot of Object.keys(h.equipment))h.equipment[slot]=null;for(const i of h.inventory)i.isEquipped=false;
 rules.saveCharacter(h,true);const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.actor.position.set(g.hero.x,0,g.hero.z);
 g.float=()=>{};for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};
 // API position fixture at existing trainer, legal gates/refund consumers unchanged.
 if(scope!=='adventurer') {g.started=true;const n=regions.CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=n.x;g.hero.z=n.z;g.actor.position.set(n.x,0,n.z);assert(g.openNpc(n.id));assert(g.chooseCoreJob('warrior'));g.closeNpcMenu();g.started=false;
  if(scope!=='warrior')assert(scope==='berserker'?rules.chooseV3Berserker(g.hero):rules.chooseV3BladeMaster(g.hero));}
 own(g,scope==='berserker'?'jayantara-two-hand-sword':level<10?'field-verdant-plains-sword':'field-ironveil-mines-sword','mainHand');
 for(const [id,slot]of body)own(g,id,slot);return g;
}
await test('shipping acquisition/range, balanced22/22, PATK/MATK independent, Forge HOLD; old bytes not converted',()=>{
 let p=0,m=0;for(const [id,,n]of body){const i=items.createItem(id);assert.equal(i.authoredEquipmentVersion,'EQUIPMENT_CORE_4_PERCENT_V1');const s=items.calculateEnhancedBaseStats(i);assert.equal(s.defense,n);assert.equal(s.magicDefense,n);p+=s.defense;m+=s.magicDefense;const raw={...i,id:'old-'+id,enhancementLevel:6};delete raw.authoredEquipmentVersion;delete raw.authoredEquipmentProfile;const restored=items.normalizeItem(raw);assert.equal(restored.authoredEquipmentVersion,undefined);assert.equal(restored.enhancementLevel,6);assert.deepEqual(restored.baseStats,raw.baseStats);assert.deepEqual(restored.bonusStats,raw.bonusStats);}
 assert.equal(p,22);assert.equal(m,22);
 const dagger=items.createItem('field-verdant-plains-dagger'),d=details.equipmentDetail(dagger);assert.equal(d.core.find(x=>x.key==='attack').value,'8–11');
 const staff=details.equipmentDetail(items.createItem('field-ironveil-mines-staff'));assert.equal(staff.core.find(x=>x.key==='attack').value,'12–13');assert.equal(staff.core.find(x=>x.key==='magicAttack').value,'33–37');
 const jay=items.createItem('jayantara-two-hand-sword');assert.equal(jay.levelRequirement,45);assert.equal(jay.baseStats.str,4);assert.equal(details.equipmentDetail(jay).core.find(x=>x.key==='attack').value,'196–204');
 const old=items.normalizeItem({...jay,levelRequirement:24,authoredAttackVersion:undefined,enhancementLevel:6});assert.equal(old.levelRequirement,24);assert.equal(old.authoredAttackVersion,undefined);assert.equal(old.enhancementLevel,6);
 const h=rules.createV3AdventurerHero('forge-hold');h.inventory.push(dagger);assert.match(rules.enhancementPreview(h,dagger.id).blockedReason,/HOLD/);
 for(const method of ['enableDevelopmentWarriorSpecializationReference','enableDevelopmentWarriorReference','enableDevelopmentAdventurerRanksReference'])assert.equal(Game.prototype[method].call({}).code,'DEVELOPMENT_ONLY');
});
for(const [scope,level,rawMin]of [['adventurer',1,17],['adventurer',14,54],['warrior',16,56],['berserker',60,273],['blade_master',60,105]])await test(`production start auto-validates ${scope}${level}; pure reads; actual Basic budget`,()=>{
 const g=game(level,scope);g.start();const range=g.getDevelopmentAdventurerRange();assert(range?.ok,JSON.stringify(g.getPublicCombatStatus()));
 // Independent literal: Base7+floor(1.1L), coreBonusSTR (Jay+4), weapon9/32/196, no double core.
 assert.equal(range.value.MAIN.min,rawMin);const before=JSON.stringify(g.hero),seed=g.seed,cooldowns=JSON.stringify(g.skillCooldowns);
 for(let n=0;n<8;n++){assert(g.getDevelopmentAdventurerRange().ok);g.getPublicCombatStatus();}
 assert.equal(JSON.stringify(g.hero),before);assert.equal(g.seed,seed);assert.equal(JSON.stringify(g.skillCooldowns),cooldowns);
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));
 const enemy={id:++serial,group,home:group.position.clone(),hp:10000,max:10000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'MECHANICAL',definition:{defense:70,magicDefense:300},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion:0};
 g.scene.add(group);g.enemies.push(enemy);g.registerTargetEnemy(enemy);assert(g.setCurrentTarget(enemy));g.faceTarget(enemy);
 const draws=[.25,0,.99];let n=0;g.rand=()=>{assert(n<draws.length);return draws[n++];};
 g.attack();g.stepSkillRuntime(1);const width=scope==='berserker'?8:level<10?2:4;
 assert.equal(10000-enemy.hp,Math.round((rawMin+.25*width)*(500+10*level)/(570+10*level)));assert.equal(n,3);g.dispose();
});
await test('legal equip/allocation/Core, transition and Continue admit freshly without refunds, refill or debug opt-in',async()=>{
 const g=game(14);g.start();assert(g.getDevelopmentAdventurerRange()?.ok);g.hero.hp=100;g.hero.mana=20;const seed=g.seed;
 assert(g.unequipItem('head'));assert(g.getDevelopmentAdventurerRange()?.ok);assert(g.allocateStatPoint('vit'));assert.equal(g.hero.hp,100);assert.equal(g.hero.mana,20);assert.equal(g.seed,seed);
 const ids={...g.hero.equipment};g.waitForRegionLoads=async()=>{};assert(g.changeRegion('verdant-plains-v2'));assert(!g.getDevelopmentAdventurerRange()?.ok);await new Promise(r=>setTimeout(r,30));assert(g.getDevelopmentAdventurerRange()?.ok);assert.equal(g.hero.mana,20);
 g.save();const slot=g.hero.slotId;g.dispose();const re=new Game(element(),element(),element(),()=>{},()=>{},slot);re.start();assert(re.getDevelopmentAdventurerRange()?.ok);assert.deepEqual(re.hero.equipment,ids);assert.equal(re.hero.hp,100);assert.equal(re.hero.mana,20);re.dispose();
});
await test('legacy body remains legal compatibility; invalid selected source fails closed; reads never repair',()=>{
 const g=game(14);const head=g.hero.inventory.find(i=>i.id===g.hero.equipment.head);delete head.authoredEquipmentVersion;delete head.authoredEquipmentProfile;g.start();assert.equal(g.getPublicCombatStatus().route,'compatibility');assert.equal(g.getDevelopmentAdventurerRange(),null);assert.equal(head.authoredEquipmentVersion,undefined);g.dispose();
 const selected=game(14);selected.start();const w=selected.hero.inventory.find(i=>i.id===selected.hero.equipment.mainHand);w.baseStats.attack+=1;assert(!selected.getDevelopmentAdventurerRange()?.ok);assert.equal(selected.getPublicCombatStatus().route,'adventurer');selected.dispose();
 const bad=game(14);bad.hero.inventory.find(i=>i.id===bad.hero.equipment.head).authoredEquipmentVersion='UNKNOWN';bad.start();assert.equal(bad.getPublicCombatStatus().route,'adventurer');assert(!bad.getDevelopmentAdventurerRange()?.ok);assert(bad.getPublicCombatStatus().reason);bad.dispose();
});
await test('production registry has12 exact chains, safe NPCs, protected six independent receipts, scroll prices/gates and save preservation',()=>{
 assert.equal(early.earlyQuests().length,12);assert.equal(early.developmentQuestNpcs().length,3);assert.equal(early.earlyQuest('dev-quest-v1-verdant-hunt-1').rewards.xp,53);
 const h=rules.createV3AdventurerHero('quest-public');while(h.level<70)rules.gainXP(h,rules.xpNeeded(h.level));
 const all=regions.getQuestRegistry();for(const map of ['sunken-ruins','meteorfall-citadel'])for(const tier of ['easy','veteran','elite'])assert(all.some(q=>q.id===`field-${map}-${tier}`));
 const row=scroll.MAP_SCROLLS[0],i=items.createItem(row.templateId,{quantity:5});h.inventory.push(i);h.completedQuests.push(row.intro);assert.equal(scroll.availableMapScrollPacks(h,row.npc).length,1);h.cityProgress[scroll.mapScrollReceipt(row.region)]=1;assert.equal(scroll.availableMapScrollPacks(h,row.npc).length,0);
 assert(!shops.shopStock(h,'consumable').some(i=>i.templateId===row.templateId));h.cityProgress[scroll.mapVisitReceipt(row.region)]=1;assert(shops.shopStock(h,'consumable').some(i=>i.templateId===row.templateId));assert.equal(shops.shopItemPrice(items.ITEM_CATALOG[row.templateId],'consumable'),27);
 const before=JSON.stringify(h);assert(!rules.consumeInventoryItem(h,i.id).ok);assert.equal(JSON.stringify(h),before);const save=rules.parseSave(before);assert.equal(save.inventory.find(x=>x.id===i.id).quantity,5);assert.equal(save.cityProgress[scroll.mapScrollReceipt(row.region)],1);
});
await test('production Core transaction refunds primary once, preserves budget and renews legal Warrior equip/learn',()=>{
 const g=game(15);g.start();g.syncCombatModifiers();assert.equal(g.getPublicCombatStatus().route,'compatibility');assert(g.allocateStatPoint('str'));assert(g.allocateStatPoint('vit'));
 const budget=g.hero.statPoints+Object.values(g.hero.allocatedStats).reduce((a,b)=>a+b,0);assert.equal(budget,28);
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
 const npc=regions.CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
 assert(g.chooseCoreJob('warrior'));assert.equal(g.hero.statPoints,28);assert.deepEqual(g.hero.allocatedStats,{str:0,vit:0,dex:0,int:0});
 const h=JSON.stringify(g.hero);assert(!g.chooseCoreJob('warrior'));assert.equal(JSON.stringify(g.hero),h);
 own(g,'field-ironveil-mines-sword','mainHand');assert(g.learnSkill('v3-warrior-strike'));g.stepSkillRuntime(.1);assert(g.getDevelopmentAdventurerRange()?.ok);assert.equal(g.getPublicCombatStatus().route,'warrior');g.dispose();
});
await test('production death/respawn preserves legitimate cooldown and freshly admits; production debug methods remain closed',()=>{
 const g=game(14);g.start();g.skillCooldowns['v3-adventurer-power-strike']=7;g.invincible=0;g.rand=()=>.99;g.hurtHero(1e6,'MECHANICAL_LETHAL');assert(g.dead);assert(!g.getDevelopmentAdventurerRange()?.ok);g.respawn();assert(!g.dead);assert(g.getDevelopmentAdventurerRange()?.ok);assert.equal(g.skillCooldowns['v3-adventurer-power-strike'],7);g.dispose();
});
after(()=>server.close());
await test('legal existing Pet/legacy body switches to compatibility at equip boundary; return revalidates without free resources',()=>{
 const g=game(14);g.start();const pet=g.hero.inventory.find(i=>i.templateId==='adventurer-pet-egg');g.hero.hp=100;g.hero.mana=20;g.skillCooldowns['v3-adventurer-power-strike']=7;const seed=g.seed;
 assert(g.equipItem(pet.id,'pet'));assert.equal(g.getPublicCombatStatus().route,'compatibility');assert.equal(g.getDevelopmentAdventurerRange(),null);assert(g.hero.pet);assert.equal(g.hero.hp,100);assert.equal(g.hero.mana,20);assert.equal(g.skillCooldowns['v3-adventurer-power-strike'],7);assert.equal(g.seed,seed);
 assert(g.unequipItem('pet'));assert(g.getDevelopmentAdventurerRange()?.ok);
 g.dispose();
 // Existing old-save fixture is present BEFORE admission, not injected into a live binding.
 const legacy=game(14),old=own(legacy,'arunika-head');delete old.authoredEquipmentVersion;delete old.authoredEquipmentProfile;legacy.start();
 assert(legacy.equipItem(old.id,'head'));assert.equal(legacy.getPublicCombatStatus().route,'compatibility');assert.equal(old.authoredEquipmentVersion,undefined);assert(legacy.unequipItem('head'));assert(legacy.getDevelopmentAdventurerRange()?.ok);legacy.dispose();
});
