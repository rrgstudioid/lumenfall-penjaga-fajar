// Actual Game combat/progression/lifecycle; only rendering/audio/DOM are OFFLINE stubs.
// Enemy numeric and forced RNG probes are MECHANICAL; they are not balance approval.
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
const output=process.env.WARRIOR_REFERENCE_CHECKPOINT;assert(output);
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/warrior-reference'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
// Load the new leaf first to avoid concurrent SSR transport fetching the same map graph.
await server.ssrLoadModule('/lib/game/underwater-contour.ts');
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items'),{CITIES}=await load('regions');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const {WARRIOR_V3_SKILL_MAP:definitionMap}=await load('warrior-v3');
let serial=0;
function game(level=15,ranks={},optIn=true) {
 storage.clear();const h=rules.createV3AdventurerHero('warrior-approved-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;g.actor.position.set(g.hero.x,0,g.hero.z);
 while(g.hero.level<15)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));assert(g.chooseCoreJob('warrior'));g.closeNpcMenu();
 while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 const buy=(id,count)=>{for(const p of definitionMap[id]?.prerequisiteSkills??[])buy(p.skillId,p.requiredRank);while((g.hero.skillLevels[id]??0)<count)assert(g.learnSkill(id),id+': '+JSON.stringify(rules.canLearnSkill(id,g.hero)));};
 for(const [id,count] of Object.entries(ranks))buy(id,count);
 const sword=items.createItem('field-ironveil-mines-sword',{id:g.hero.slotId+'-iron'});g.hero.inventory.push(sword);assert(g.equipItem(sword.id,'mainHand'));assert.notEqual(g.hero.inventory.find(i=>i.id===sword.id),sword);
 g.floats=[];g.float=(_p,text,kind)=>g.floats.push({text,kind});for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};
 if(optIn){const enabled=g.enableDevelopmentWarriorReference({lifecycleRenewal:true});assert(enabled.ok,JSON.stringify(enabled));}
 return g;
}

const regions=await load('regions'),early=await load('early-quest-contract'),sc=await load('map-scroll-contract'),shops=await load('city-services');
const {MINE_ID:I,MINE_ROOMS,MineNavigation}=await load('ironveil-interior-layout'),{IRONVEIL_ID:E,IRONVEIL_TRANSITION,ironveilWalkable}=await load('ironveil-mines-layout'),{PLAINS_ID:V,plainsWalkable}=await load('verdant-plains-layout');
const {MINE_MONSTERS,mineMonsterSpawns}=await load('ironveil-interior-population'),nav=await load('quest-navigation-game'),{questMineRoute}=await load('quest-mine-route');
const prefix='dev-quest-v1-',quantity=(h,id)=>h.inventory.filter(i=>i.templateId===id).reduce((n,i)=>n+i.quantity,0);
for(const enabled of [true,false])await test(`legacy once-map pack ${enabled?'renews prior Warrior':'leaves OFF'}; no EXP duplication`,()=>{
 const g=game(24,{},enabled);g.hero.questClaimed=true;const n=CITIES.arunika.npcList.find(n=>n.id==='aruna-0');g.hero.x=n.x;g.hero.z=n.z;g.actor.position.set(n.x,0,n.z);assert(g.openNpc(n.id));
 const xp=g.hero.xp,mana=g.hero.mana,hp=g.hero.hp,seed=g.seed;assert(g.cityAction('scroll-pack',V));assert.equal(quantity(g.hero,'map-scroll-v1-'+V),5);
 assert.equal(g.hero.xp,xp);assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);assert.equal(g.seed,seed);assert.equal(g.getDevelopmentAdventurerRange()?.ok??null,enabled?true:null);
 assert(!g.cityAction('scroll-pack',V));assert.equal(quantity(g.hero,'map-scroll-v1-'+V),5);g.dispose();
});
await test('checkpoint button keeps actual reach, living/current region and mine wall validity; read is pure',()=>{
 const g=game(24,{},false),npc=early.EARLY_NPCS[2],navigation=new MineNavigation();g.hero.inCity=false;g.hero.currentField=E;g.hero.interiorId=I;g.mineInterior={move:(...args)=>navigation.move(...args),dispose(){}};
 g.hero.x=npc.x+1;g.hero.z=npc.z;g.actor.position.set(g.hero.x,0,g.hero.z);
 const before=JSON.stringify({hero:g.hero,seed:g.seed,cd:g.skillCooldowns,queue:g.skillHits.size});
 assert(g.canInteractDevelopmentQuestNpc(npc));assert.equal(JSON.stringify({hero:g.hero,seed:g.seed,cd:g.skillCooldowns,queue:g.skillHits.size}),before);
 g.hero.x=npc.x+3;assert(!g.canInteractDevelopmentQuestNpc(npc));g.hero.x=npc.x;g.dead=true;assert(!g.canInteractDevelopmentQuestNpc(npc));g.dead=false;g.transitioning=true;assert(!g.canInteractDevelopmentQuestNpc(npc));g.transitioning=false;
 const move=g.moveHeroOnGround;g.moveHeroOnGround=from=>({...from});g.hero.x=npc.x+1;assert(!g.canInteractDevelopmentQuestNpc(npc));g.moveHeroOnGround=move;delete g.hero.interiorId;assert(!g.canInteractDevelopmentQuestNpc(npc));g.dispose();
});
const place=(g,p)=>{Object.assign(g.hero,{x:p.x,z:p.z});g.actor.position.set(p.x,0,p.z);g.actor.visible=true;};
const settle=()=>new Promise(r=>setImmediate(r));
const expected=[
 ['verdant-hunt-1',3,'main-verdant-bisikan',53,25,1,[['small-slime',1,5],['meadow-slime',3,5]]],
 ['verdant-hunt-2',5,'verdant-hunt-1',73,40,1,[['wild-boar',5,5],['forest-piya',7,5]]],
 ['verdant-hunt-3',9,'verdant-hunt-2',113,60,1,[['stoneback-beetle',9,5],['rootling',11,5]]],
 ['verdant-finale',13,'verdant-hunt-3',244,100,2,[['thorn-wolf',13,8]]],
 ['iron-exterior-intro',12,null,114,0,0,[['normal-region',null,5]]],
 ['iron-exterior-grub',16,'iron-exterior-intro',183,90,1,[['ironveil-mines-1',16,6]]],
 ['iron-exterior-bat',20,'iron-exterior-grub',223,120,1,[['ironveil-mines-2',20,6]]],
 ['iron-exterior-finale',25,'iron-exterior-bat',436,180,2,[['ironveil-mines-3',25,8]]],
 ['iron-interior-intro',20,null,178,0,0,[['normal-region',null,5]]],
 ['iron-interior-survey',24,'iron-interior-intro',263,140,1,[['W1',null,1],['W2',null,1],['level-13',21,5]]],
 ['iron-interior-security',30,'iron-interior-survey',323,180,1,[['level-14',30,6]]],
 ['iron-interior-finale',36,'iron-interior-security',580,240,2,[['level-18',36,5],['level-19',38,5]]],
];
for(const [suffix,level,previous,xp,gold,potions,objectives] of expected)await test('literal contract '+suffix,()=>{
 const q=early.earlyQuest(prefix+suffix);assert(q);assert.equal(q.requiredLevel,level);assert.deepEqual(q.requiredQuestIds,previous?[previous.startsWith('main-')?previous:prefix+previous]:[]);
 assert.deepEqual(q.rewards,{xp,gold,items:potions?[{templateId:'health-potion-1',quantity:potions},{templateId:'mana-potion-1',quantity:potions}]:[]});
 assert.equal(q.objectives.length,objectives.length);q.objectives.forEach((o,i)=>{const [id,l,n]=objectives[i];assert(o.targetId.endsWith(id));assert.equal(o.level??null,l);assert.equal(o.required,n);if(o.type!=='visit')assert.equal(o.variant,'normal');});
 const h=rules.createV3AdventurerHero('gate');while(h.level<level-1)rules.gainXP(h,rules.xpNeeded(h.level));regions.refreshUnlocks(h);
 assert.equal(regions.acceptRegionQuest(h,q.id),false);
 // Synthetic completed prerequisites are negative/positive requirement fixtures, not legal chain proof.
 h.completedQuests=[...q.requiredQuestIds];rules.gainXP(h,rules.xpNeeded(h.level));regions.refreshUnlocks(h);assert(regions.acceptRegionQuest(h,q.id));
 const high=rules.createV3AdventurerHero('overlevel');while(high.level<80)rules.gainXP(high,rules.xpNeeded(high.level));high.completedQuests=[...q.requiredQuestIds];regions.refreshUnlocks(high);assert(regions.acceptRegionQuest(high,q.id));
});
await test('retier changes level only; prototype combat/reward/population preserved',()=>{
 // Independent numeric formulas are the PRE-edit prototype generator, not output of the retier provider.
 // Literal pre-retier identities/levels are retained here so a checkout needs no ignored checkpoint files.
 const preRetierLevels=[
  ...[['small-slime',1],['meadow-slime',2],['wild-boar',3],['forest-piya',4],['stoneback-beetle',5],['rootling',6],['thorn-wolf',7]].map(([id,level])=>[V+'-'+id,level]),
  ['ironveil-mines-1',10],['ironveil-mines-2',12],['ironveil-mines-3',14],
  ...[13,14,18,19].map(level=>[I+'-level-'+level,level]),
 ];
 const selected=[...regions.FIELDS[V].normalMonsters,...regions.FIELDS[E].normalMonsters,...MINE_MONSTERS].filter(m=>m.rewardLevel!==undefined);
 assert.equal(selected.length,14); // seven Verdant, three exterior, four interior
 assert.deepEqual(selected.map(m=>[m.id,m.rewardLevel]),preRetierLevels);
 for(const m of selected){const l=m.rewardLevel;assert.equal(m.maxHP,30+16*l);assert.equal(m.attack,Math.round(8+2.2*l));assert.equal(m.defense,Math.round(4+1.1*l));assert.equal(m.magicDefense,3+l);assert.equal(m.respawnTime,25);assert.equal(m.dropRate,.35);
  assert.equal(regions.monsterXP(m,50),Math.max(1,Math.floor(m.exp*Math.max(.05,1-Math.max(0,50-l-5)*.08))));}
 assert.equal(mineMonsterSpawns().length,480);assert.equal(regions.FIELDS['east-gate-arunika'].normalMonsters[1].level,3);
});
await test('exact region definition level variant; visit and sample quota capacity',()=>{
 const h=rules.createV3AdventurerHero('synthetic objective filter'),q=early.earlyQuest(prefix+'iron-interior-survey');h.activeQuests=[q.id];h.inCity=false;h.currentField=E;h.interiorId=I;
 let calls=0;const grant=()=>{calls++;const result=items.addItemToInventory(h.inventory,items.createItem(early.MINE_SAMPLE_ID),h.inventoryCapacity);if(result.remaining)return false;h.inventory=result.inventory;return true;};
 const m=MINE_MONSTERS.find(m=>m.id===I+'-level-13');for(const [region,monster] of [[E,m],[I,{...m,id:'wrong'}],[I,{...m,level:20}],[I,{...m,variant:'elite'}],[I,{...m,variant:'boss'}]])early.recordEarlyKill(h,region,monster,grant);
 assert.equal(calls,0);h.inventoryCapacity=0;early.recordEarlyKill(h,I,m,grant);assert.equal(quantity(h,early.MINE_SAMPLE_ID),0);assert.equal(early.earlyProgress(h,q)[2].current,0);
 h.inventoryCapacity=60;for(let n=0;n<8;n++)early.recordEarlyKill(h,I,m,grant);assert.equal(quantity(h,early.MINE_SAMPLE_ID),5);assert.equal(calls,6);
 Object.assign(h,MINE_ROOMS.find(r=>r.id==='W1'));assert(early.recordEarlyVisits(h));Object.assign(h,MINE_ROOMS.find(r=>r.id==='W2'));assert(early.recordEarlyVisits(h));assert.equal(regions.regionQuestStatus(h,q.id),'ready_to_complete');
 const loaded=rules.parseSave(JSON.stringify(h));assert.equal(quantity(loaded,early.MINE_SAMPLE_ID),5);assert.equal(regions.regionQuestStatus(loaded,q.id),'ready_to_complete');
 assert(!shops.sellInventoryItem(h,h.inventory.find(i=>i.templateId===early.MINE_SAMPLE_ID).id,1).ok);assert(!shops.transferStorage(h,h.inventory.find(i=>i.templateId===early.MINE_SAMPLE_ID).id).ok);
});
await test('NPC placement, mine route follows walkable corridors, no state mutation',()=>{
 const [p,f,s]=early.EARLY_NPCS;assert(plainsWalkable(p,3));assert(ironveilWalkable(f,3));const mine=new MineNavigation();assert(mine.valid(s,3));
 assert(Math.min(...mineMonsterSpawns().map(m=>Math.hypot(m.x-s.x,m.z-s.z)))>20);
 const from={x:0,z:436},to={x:s.x,z:s.z},before=JSON.stringify([from,to]);const route=questMineRoute(from,to);assert(route.length>1);assert.deepEqual(route.at(-1),to);assert.equal(JSON.stringify([from,to]),before);
 let a=from;for(const b of route){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.3);for(let i=0;i<=n;i++)assert(mine.valid({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},.55));a=b;}
});
async function travelTo(g,region){g.waitForRegionLoads=async()=>{};if(g.hero.interiorId){g.mineInterior={dispose(){}};place(g,{x:0,z:450});g.interactIronveilExit();await settle();}
 if(region===I){if(g.activeLocationId!==E){assert(g.changeRegion(E));await settle();}g.ironveil={dispose(){}};place(g,IRONVEIL_TRANSITION.anchor);g.interactIronveilEntrance();await settle();}
 else if(g.activeLocationId!==region){assert(g.changeRegion(region));await settle();}}
function open(g,id){const npc=regions.regionNpcs(g.activeLocationId).find(n=>n.id===id);assert(npc,id);place(g,npc);assert(g.openNpc(id));}
let enemyID=900000;
function kill(g,o){const definitions=o.region===I?MINE_MONSTERS:regions.FIELDS[o.region].normalMonsters;const d=definitions.find(m=>o.targetId==='normal-region'||m.id===o.targetId);assert(d);g.makeEnemy(enemyID++,g.hero.x+1,g.hero.z,false,d);const e=g.enemies.at(-1);g.hurtEnemy(e,1e9,0);}
await test('all regional chains through actual Game consumers, separate Grub/Bat, A->B, consume-before-capacity, save receipts',async()=>{
 const g=game(47,{},false);g.spawnGroundLoot=()=>{};g.spawnGoldDrop=()=>{};g.ring=()=>{};g.sound=()=>{};
 await travelTo(g,'arunika');open(g,'aruna-0');assert(g.cityAction('accept','main-verdant-bisikan'));await travelTo(g,V);
 for(let n=0;n<6;n++)kill(g,{region:V,targetId:V+'-small-slime'});await travelTo(g,'arunika');open(g,'aruna-0');assert(g.cityAction('complete','main-verdant-bisikan'));
 for(const [suffix] of expected){
  const q=early.earlyQuest(prefix+suffix);await travelTo(g,q.giverMapId);open(g,q.giverNpcId);assert(g.cityAction('accept',q.id));g.closeNpcMenu();await travelTo(g,q.targetMapId);
  for(const o of q.objectives)if(o.type==='visit'){place(g,MINE_ROOMS.find(r=>r.id===o.room));early.recordEarlyVisits(g.hero);}else for(let n=0;n<o.required;n++)kill(g,o);
  assert.equal(regions.regionQuestStatus(g.hero,q.id),'ready_to_complete');
  if(q.giverNpcId!==q.reportNpcId){await travelTo(g,q.giverMapId);open(g,q.giverNpcId);assert(!g.cityAction('complete',q.id));}
  await travelTo(g,q.reportMapId);open(g,q.reportNpcId);const gold=g.hero.gold;
  if(suffix==='iron-interior-survey'){
    // Mechanical capacity fixture: sample frees one slot, but TWO new potion stacks need two.
    g.hero.inventory=g.hero.inventory.filter(i=>!['health-potion-1','mana-potion-1'].includes(i.templateId));
    g.hero.inventoryCapacity=g.hero.inventory.filter(i=>!i.isEquipped).length;
    const before=JSON.stringify(g.hero.inventory);
    assert(!g.cityAction('complete',q.id));assert.equal(JSON.stringify(g.hero.inventory),before);assert.equal(g.hero.gold,gold);assert.equal(quantity(g.hero,early.MINE_SAMPLE_ID),5);
    // One existing stack now merges; the other fits only in the consumed sample's slot.
    g.hero.inventory.push(items.createItem('health-potion-1'));
    g.hero.inventoryCapacity=g.hero.inventory.filter(i=>!i.isEquipped).length;
  }
  assert(g.cityAction('complete',q.id),q.id);assert.equal(g.hero.gold,gold+q.rewards.gold);assert(!g.cityAction('complete',q.id));assert.equal(regions.regionQuestStatus(g.hero,q.id),'completed');
  g.hero.inventoryCapacity=60;
 }
 assert.equal(quantity(g.hero,early.MINE_SAMPLE_ID),0);const end=rules.parseSave(JSON.stringify(g.hero));for(const [suffix] of expected)assert(end.completedQuests.includes(prefix+suffix));
 assert.equal(end.cityProgress[sc.mapScrollReceipt(E)],1);assert.equal(end.cityProgress[sc.mapScrollReceipt(I)],1);
 g.save();const continued=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);assert.equal(continued.getDevelopmentWarriorAvailability(),null);assert.deepEqual(continued.hero.completedQuests,g.hero.completedQuests);continued.dispose();g.dispose();
});
await test('approved General price, capacity atomicity, interior first visit and original scroll completion',async()=>{
 const g=game(47,{},false);g.waitForRegionLoads=async()=>{};assert(g.changeRegion('arunika'));await settle();const ids=[V,'east-gate-arunika',E,I],prices=[27,45,78,114];
 for(let i=0;i<ids.length;i++){const row=sc.MAP_SCROLLS.find(r=>r.region===ids[i]);g.hero.cityProgress[sc.mapVisitReceipt(ids[i])]=1;const gold=g.hero.gold=1000;assert.equal(shops.shopItemPrice(items.ITEM_CATALOG[row.templateId],'consumable'),prices[i]);assert(shops.buyShopItem(g.hero,row.templateId,'consumable').ok);assert.equal(g.hero.gold,gold-prices[i]);}
 const row=sc.MAP_SCROLLS.find(r=>r.region===I),item=g.hero.inventory.find(i=>i.templateId===row.templateId);
 const inventory=g.hero.inventory;g.hero.inventory=[];g.hero.inventoryCapacity=0;const gold=g.hero.gold;assert(!shops.buyShopItem(g.hero,row.templateId,'consumable').ok);assert.equal(g.hero.gold,gold);g.hero.inventory=inventory;g.hero.inventoryCapacity=60;
 delete g.hero.cityProgress[sc.mapVisitReceipt(I)];assert(!g.useItem(item.id));await travelTo(g,I);assert.equal(g.hero.cityProgress[sc.mapVisitReceipt(I)],1);await travelTo(g,'arunika');
 const hp=g.hero.hp,mana=g.hero.mana;let release;g.waitForRegionLoads=()=>new Promise(r=>release=r);assert(g.useItem(item.id));assert.equal(quantity(g.hero,row.templateId),1);assert(!g.useItem(item.id));release();await settle();assert.equal(g.activeLocationId,I);assert.equal(quantity(g.hero,row.templateId),0);assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);g.dispose();
});
await test('successful scroll debit renews only prior valid policy, with one item and no resource/clock/RNG refund',async()=>{
 for(const destination of [E,I])for(const enabled of [true,false]){
  const g=game(24,{},false);await travelTo(g,destination);await travelTo(g,'arunika');
  const n=CITIES.arunika.npcList.find(n=>n.service==='consumable');place(g,n);assert(g.openNpc(n.id));g.hero.gold=1000;
  const row=sc.MAP_SCROLLS.find(r=>r.region===destination);assert(g.npcBuy(row.templateId,2));g.closeNpcMenu();
  if(enabled)assert(g.enableDevelopmentWarriorReference({lifecycleRenewal:true}).ok);
  g.hero.hp-=7;g.hero.mana-=3;g.skillCooldowns['v3-warrior-strike']=1.25;
  const hp=g.hero.hp,mana=g.hero.mana,seed=g.seed,clock=g.combatTime;
  const item=g.hero.inventory.find(i=>i.templateId===row.templateId);assert(g.useItem(item.id));assert(!g.getDevelopmentWarriorAvailability()?.ok);await settle();
  assert.equal(g.activeLocationId,destination);assert.equal(quantity(g.hero,row.templateId),1);
  assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);assert.equal(g.seed,seed);assert.equal(g.combatTime,clock);assert.equal(g.skillCooldowns['v3-warrior-strike'],1.25);
  assert.equal(g.getDevelopmentWarriorAvailability()?.ok??null,enabled?true:null,JSON.stringify(g.getDevelopmentWarriorAvailability()));g.dispose();
 }
});
await test('legacy Bisikan receipt catch-up does not require manufactured completed history',()=>{
 const h=rules.createV3AdventurerHero('legacy-bisikan');h.questClaimed=true;
 assert(sc.availableMapScrollPacks(h,'aruna-0').some(r=>r.region===V));assert.deepEqual(h.completedQuests,[]);
 h.cityProgress[sc.mapScrollReceipt(V)]=1;assert(!sc.availableMapScrollPacks(h,'aruna-0').some(r=>r.region===V));
});
for(const mode of ['failure','cancel','replacement'])await test('interior scroll '+mode+' restores city and preserves item',async()=>{
 const g=game(47,{},false);await travelTo(g,I);await travelTo(g,'arunika');
 const row=sc.MAP_SCROLLS.find(r=>r.region===I),item=items.createItem(row.templateId,{quantity:5});g.hero.inventory.push(item);
 let release,reject;g.waitForRegionLoads=()=>new Promise((a,b)=>{release=a;reject=b});assert(g.useItem(item.id));
 if(mode==='failure')reject(Error('MECHANICAL_INTERIOR_LOAD_FAILURE'));
 else{if(mode==='cancel')g.clearSkillRuntime();else g.hero.inventory=g.hero.inventory.map(i=>i===item?{...i}:i);release();}
 await settle();assert.equal(quantity(g.hero,row.templateId),5);assert(g.hero.inCity);assert.equal(g.hero.interiorId,undefined);assert.equal(g.activeLocationId,'arunika');g.dispose();
});
await test('actual sample grant preserves prior Warrior policy; OFF stays OFF, no read enrollment',async()=>{
 for(const enabled of [true,false]){
  const g=game(24,{},enabled);g.spawnGroundLoot=()=>{};g.spawnGoldDrop=()=>{};
  await travelTo(g,E);open(g,'dev-ironveil-foreman-v1');const intro=early.earlyQuest(prefix+'iron-interior-intro');
  assert(g.cityAction('accept',intro.id));g.closeNpcMenu();await travelTo(g,I);
  for(let i=0;i<5;i++)kill(g,intro.objectives[0]);
  open(g,intro.reportNpcId);assert(g.cityAction('complete',intro.id));
  const survey=early.earlyQuest(prefix+'iron-interior-survey');assert(g.cityAction('accept',survey.id));g.closeNpcMenu();
  if(enabled)assert(g.getDevelopmentWarriorAvailability()?.ok);
  const before=quantity(g.hero,early.MINE_SAMPLE_ID);kill(g,survey.objectives[2]);
  assert.equal(quantity(g.hero,early.MINE_SAMPLE_ID),before+1);
  if(enabled)assert(g.getDevelopmentWarriorAvailability()?.ok,JSON.stringify(g.getDevelopmentWarriorAvailability()));
  else assert.equal(g.getDevelopmentWarriorAvailability(),null);
  g.dispose();
 }
});
await test('navigation uses exact unfinished objective, report NPC, visits, and pure reads',async()=>{
 const g=game(47,{},false);await travelTo(g,E);open(g,'dev-ironveil-foreman-v1');const id=prefix+'iron-interior-intro';assert(g.cityAction('accept',id));g.closeNpcMenu();
 const {IronveilNavigation}=await load('ironveil-mines-layout'),ext=new IronveilNavigation();
 g.ironveil={move:(p,x,z)=>ext.move(p,x,z),dispose(){}}; // Real collision, offline visual only.
 assert.equal(nav.readDevelopmentQuestNavigation(g,id).target?.id,'mine-entry');
 await travelTo(g,I);const q=early.earlyQuest(id);for(let i=0;i<5;i++)kill(g,q.objectives[0]);
 const mine=new MineNavigation();g.mineInterior={move:(p,x,z)=>mine.move(p,x,z),dispose(){}};
 const before=JSON.stringify({hero:g.hero,seed:g.seed,cd:g.skillCooldowns,queue:g.skillHits,storage:[...storage]});
 const result=nav.readDevelopmentQuestNavigation(g,id);assert.equal(result.target?.id,'dev-ironveil-surveyor-v1');
 for(let i=0;i<20;i++)nav.readDevelopmentQuestNavigation(g,id);
 assert.equal(JSON.stringify({hero:g.hero,seed:g.seed,cd:g.skillCooldowns,queue:g.skillHits,storage:[...storage]}),before);
 open(g,q.reportNpcId);assert(g.cityAction('complete',id));assert.equal(nav.readDevelopmentQuestNavigation(g,id).status,'complete');
 assert(g.cityAction('accept',prefix+'iron-interior-survey'));g.closeNpcMenu();
 for(const roomId of ['W1','W2']){const r=MINE_ROOMS.find(r=>r.id===roomId);assert(questMineRoute({x:-416,z:51},r).length,roomId);}
 g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'early-quest-evidence.json'),JSON.stringify({consumer:'Original Game/rules/quest/save/travel; offline render stubs',setup:'Original XP/Core; registered mechanical one-shot kills; synthetic prerequisite rows only in isolated contract tests',newTests:23},null,2));});
