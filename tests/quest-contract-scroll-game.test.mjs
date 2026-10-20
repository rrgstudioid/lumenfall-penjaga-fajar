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
const regions=await load('regions');
// OFFLINE rendered-map readiness only; quest, reward, save and parser consumers stay original.

// Original failed cityAction still saves its timestamp; all gameplay fields must be identical.
const gameplay=h=>({...structuredClone(h),lastPlayedAt:0});


const contract=await load('map-scroll-contract');
const place=(g,n)=>{g.hero.x=n.x;g.hero.z=n.z;g.actor.position.set(n.x,0,n.z);g.actor.visible=true;};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const camp=(g,region)=>{assert(regions.travel(g.hero,region).ok);const npc=regions.FIELD_NPCS[region];place(g,npc);assert(g.openNpc(npc.id));return npc;};
const intro='field-meteorfall-citadel-easy',region='meteorfall-citadel';
const quantity=g=>g.hero.inventory.filter(i=>i.templateId===contract.MAP_SCROLLS.find(s=>s.region===region).templateId).reduce((n,i)=>n+i.quantity,0);
for(const [region,suffix,requiredLevel,target,xp,gold,quantity] of [['sunken-ruins','easy',32,5,1120,515,2],['sunken-ruins','veteran',35,10,2016,927,3],['sunken-ruins','elite',39,15,3360,1545,5],['meteorfall-citadel','easy',42,5,1470,665,2],['meteorfall-citadel','veteran',44,10,2646,1197,3],['meteorfall-citadel','elite',47,15,4410,1995,5]])for(const q of [{id:'field-'+region+'-'+suffix,region,requiredLevel,target,reward:{xp,gold,items:[{templateId:'vibranium',quantity}]}}])await test(q.id+': gate, ALL kills, isolated receipt, source label independence, save',()=>{
 const h=rules.createV3AdventurerHero('contract');while(h.level<q.requiredLevel-1)rules.gainXP(h,rules.xpNeeded(h.level));h.inCity=false;h.currentField=q.region;
 assert(!regions.acceptRegionQuest(h,q.id));rules.gainXP(h,rules.xpNeeded(h.level));assert(regions.travel(h,q.region).ok);h.unlockedFields=[];assert(regions.acceptRegionQuest(h,q.id));h.fieldProgress[q.region]=q.target-1;
 let restored=rules.parseSave(JSON.stringify(h));assert.equal(regions.regionQuestProgress(restored,q.id).current,q.target-1);assert.equal(regions.regionQuestStatus(restored,q.id),'active');
 const f=regions.FIELDS[q.region],old={minLevel:f.minLevel,maxLevel:f.maxLevel,questList:f.questList};
 try{Object.assign(f,{minLevel:80,maxLevel:100,questList:[]});assert.equal(regions.fieldQuestInfo(f,q.id).requiredLevel,q.requiredLevel);assert.deepEqual(regions.regionQuestReward(q.id),{xp:q.reward.xp,gold:q.reward.gold,items:q.reward.items.map(x=>({...x}))});assert(regions.getQuestRegistry().some(e=>e.id===q.id));}finally{Object.assign(f,old);}
 restored.fieldProgress[q.region]++;assert(regions.completeRegionQuest(restored,q.id).ok);restored=rules.parseSave(JSON.stringify(restored));assert(!regions.completeRegionQuest(restored,q.id).ok);assert(!regions.acceptRegionQuest(restored,q.id));
});
await test('actual claim capacity + pack once per map, not per difficulty; native consumer NPC range and identity',()=>{
 const g=game(47,{},false),npc=camp(g,region);assert(g.cityAction('accept',intro));g.hero.fieldProgress[region]=5;
 const inv=g.hero.inventory;g.hero.inventoryCapacity=0;const before=JSON.stringify(gameplay(g.hero));assert(!g.cityAction('complete',intro));assert.equal(JSON.stringify(gameplay(g.hero)),before);g.hero.inventoryCapacity=60;g.hero.inventory=inv;
 place(g,{x:npc.x+10,z:npc.z});assert(!g.cityAction('complete',intro));place(g,npc);const gold=g.hero.gold;assert(g.cityAction('complete',intro));assert.equal(g.hero.gold,gold+665);assert.equal(quantity(g),5);assert(!g.cityAction('scroll-pack',region));
 assert(g.cityAction('accept','field-meteorfall-citadel-veteran'));g.hero.fieldProgress[region]+=10;assert(g.cityAction('complete','field-meteorfall-citadel-veteran'));assert.equal(quantity(g),5);assert.equal(g.hero.gold,gold+665+1197);
 g.save();const restored=rules.parseSave(JSON.stringify(g.hero));assert.equal(restored.cityProgress[contract.mapScrollReceipt(region)],1);assert.equal(restored.inventory.find(i=>contract.mapScroll(i.templateId)).quantity,5);g.dispose();
});
await test('old completed intro catch-up preserves XP and other quest rights; full inventory retry',()=>{
 const g=game(47,{},false);camp(g,region);assert(regions.acceptRegionQuest(g.hero,intro));g.hero.fieldProgress[region]=5;assert(regions.completeRegionQuest(g.hero,intro).ok);
 const xp=g.hero.xp,gold=g.hero.gold;g.hero.inventoryCapacity=0;assert(!g.cityAction('scroll-pack',region));assert.equal(quantity(g),0);g.hero.inventoryCapacity=60;assert(g.cityAction('scroll-pack',region));assert.equal(quantity(g),5);assert.equal(g.hero.xp,xp);assert.equal(g.hero.gold,gold);assert(!g.cityAction('scroll-pack',region));assert(g.cityAction('accept','field-meteorfall-citadel-elite'));g.dispose();
});
async function scrollGame(){const g=game(47,{},false);g.waitForRegionLoads=async()=>{};assert(g.changeRegion(region));await settle();const npc=regions.FIELD_NPCS[region];place(g,npc);assert(g.openNpc(npc.id));assert(g.cityAction('accept',intro));g.hero.fieldProgress[region]=5;assert(g.cityAction('complete',intro));assert(g.changeRegion('jayantara'));await settle();return g;}
await test('original travel records legal visit; scroll consumes only successful async completion; no double input/refill/activation',async()=>{
 const g=await scrollGame(),item=g.hero.inventory.find(i=>contract.mapScroll(i.templateId));g.hero.hp-=20;g.hero.mana-=10;g.skillCooldowns['mechanical-existing-cooldown']=17;const cd={...g.skillCooldowns},seed=g.seed;let release;g.waitForRegionLoads=()=>new Promise(r=>release=r);const hp=g.hero.hp,mana=g.hero.mana;
 assert(g.useItem(item.id));assert.equal(quantity(g),5);assert(!g.useItem(item.id));release();await settle();assert.equal(quantity(g),4);assert.equal(g.activeLocationId,region);assert.equal(g.hero.hp,hp);assert.equal(g.hero.mana,mana);assert.deepEqual(g.skillCooldowns,cd);assert.equal(g.seed,seed);assert.equal(g.getDevelopmentWarriorAvailability(),null);assert(!g.useItem(item.id));g.dispose();
});
for(const mode of ['failure','cancel','item-replacement','actor-replacement','disposal'])await test('original scroll transaction '+mode+' never debits',async()=>{
 const g=await scrollGame(),original=g.hero,item=g.hero.inventory.find(i=>contract.mapScroll(i.templateId));let release,reject;g.waitForRegionLoads=()=>new Promise((a,b)=>{release=a;reject=b});assert(g.useItem(item.id));
 if(mode==='failure')reject(new Error('MECHANICAL_LOAD_FAILURE'));
 else {if(mode==='cancel')g.clearSkillRuntime();if(mode==='item-replacement')g.hero.inventory=g.hero.inventory.map(i=>i===item?{...i}:i);if(mode==='actor-replacement')g.hero={...g.hero};if(mode==='disposal')g.dispose();release();}
 await settle();assert.equal(original.inventory.find(i=>i.id===item.id).quantity,5);if(mode==='failure'||mode==='cancel'||mode==='item-replacement')assert(g.hero.inCity);if(!g.disposed)g.dispose();
});
await test('unvisited and locked scrolls rejected; rules consumer cannot spend outside travel; shop price HOLD',()=>{
 const g=game(47,{},false),row=contract.MAP_SCROLLS.find(r=>r.region===region),item=items.createItem(row.templateId,{quantity:5});g.hero.inventory.push(item);assert(!g.useItem(item.id));assert.equal(item.quantity,5);assert(!rules.consumeInventoryItem(g.hero,item.id).ok);g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'quest-contract-game-evidence.json'),JSON.stringify({render:'OFFLINE_STUBS',questAndTravelConsumers:'ORIGINAL',mechanical:'XP setup through gainXP, objective counter setup, deferred map readiness'},null,2));});
