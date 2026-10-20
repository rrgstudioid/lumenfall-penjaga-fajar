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
const evidence=[];let serial=0;
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

const nav=await load('quest-navigation-game');
const {METEORFALL_ENTRY,METEORFALL_ID,METEORFALL_EXIT}=await load('meteorfall-citadel-layout');
const {MeteorfallNavigation}=await load('meteorfall-citadel-navigation');
const place=(g,p)=>{g.hero.x=p.x;g.hero.z=p.z;g.actor.position.set(p.x,0,p.z);g.actor.visible=true;};
const prepare=()=>{const g=game(47,{},false);assert(regions.travel(g.hero,METEORFALL_ID).ok);g.meteorfall={navigation:new MeteorfallNavigation(),move:(p,x,z)=>g.meteorfall.navigation.move(p,x,z),dispose(){}};place(g,METEORFALL_ENTRY);const npc=regions.FIELD_NPCS[METEORFALL_ID];place(g,npc);assert(g.openNpc(npc.id));assert(g.cityAction('accept','field-meteorfall-citadel-easy'));g.closeNpcMenu();return g;};
const id='field-meteorfall-citadel-easy';
const fingerprint=g=>JSON.stringify({hero:g.hero,seed:g.seed,queue:g.skillHits.size,cd:g.skillCooldowns,storage:[...storage],target:g.currentTarget,policy:g.getDevelopmentWarriorAvailability()});
await test('actual Game report, purity, no auto-claim, full inventory rejection, reward once and Save/Continue',()=>{
 const g=prepare(),npc=regions.FIELD_NPCS[METEORFALL_ID];
 g.hero.fieldProgress[METEORFALL_ID]=5; // Mechanical objective setup only.
 const before=fingerprint(g);for(let n=0;n<20;n++){const r=nav.readDevelopmentQuestNavigation(g,id);assert.equal(r.target?.id,npc.id);assert.equal(r.target?.kind,'npc');}
 assert.equal(fingerprint(g),before);assert(!g.hero.completedQuests.includes(id));
 assert(g.openNpc(npc.id));const inventory=structuredClone(g.hero.inventory);
 while(g.hero.inventory.filter(i=>!i.isEquipped).length<g.hero.inventoryCapacity)g.hero.inventory.push(items.createItem('field-verdant-plains-sword',{id:'full-'+g.hero.inventory.length}));
 const gold=g.hero.gold;assert(!g.cityAction('complete',id));assert.equal(g.hero.gold,gold);assert.equal(nav.readDevelopmentQuestNavigation(g,id).target?.id,npc.id);
 g.hero.inventory=inventory;assert(g.cityAction('complete',id));assert.equal(g.hero.gold,gold+665);assert.equal(nav.readDevelopmentQuestNavigation(g,id).status,'complete');
 assert(!g.cityAction('complete',id));g.save();const next=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);next.started=true;next.actor.visible=true;
 assert.equal(nav.readDevelopmentQuestNavigation(next,id).status,'complete');place(next,npc);assert(next.openNpc(npc.id));const restored=gameplay(next.hero);assert(!next.cityAction('complete',id));assert.deepEqual(gameplay(next.hero),restored);assert.equal(next.getDevelopmentWarriorAvailability(),null);
 evidence.push({case:'actual-Meteor-claim-and-save',gold:665,objective:'mechanical counter',pure:true,duplicateRejected:true});next.dispose();g.dispose();
});
await test('actual adapter includes render-culled living targets, dead/despawn alternatives and lifecycle guards',()=>{
 const g=prepare();place(g,METEORFALL_ENTRY);const p={x:METEORFALL_ENTRY.x+1,z:METEORFALL_ENTRY.z};
 g.enemies=[{id:100,hp:1,group:{position:p,visible:false},definition:{id:'mechanical',variant:'normal'},dummy:false},{id:101,hp:1,group:{position:{x:p.x+1,z:p.z},visible:true},definition:{id:'mechanical2',variant:'elite'},dummy:false}];
 let r=nav.readDevelopmentQuestNavigation(g,id);assert.equal(r.target?.id,'enemy-100');g.enemies[0].hp=0;
 r=nav.readDevelopmentQuestNavigation(g,id,'enemy-100');assert.equal(r.target?.id,'enemy-101');g.enemies=[];assert.equal(nav.readDevelopmentQuestNavigation(g,id,'enemy-101').status,'unavailable');
 g.dead=true;assert.equal(nav.readDevelopmentQuestNavigation(g,id).target,null);g.dead=false;g.transitioning=true;assert.equal(nav.readDevelopmentQuestNavigation(g,id).target,null);g.transitioning=false;
 assert(regions.travel(g.hero,'arunika').ok);g.meteorfall=null;g.portalLabels=[];assert.equal(nav.readDevelopmentQuestNavigation(g,id,'enemy-101').target,null);
 g.disposed=true;assert.equal(nav.readDevelopmentQuestNavigation(g,id).status,'unavailable');g.disposed=false;g.dispose();
 evidence.push({case:'adapter-lifecycle',render:'offline',targets:'mechanical registered list',noStale:true});
});
await test('legacy elite-named quest remains ANY-KILL; cross-region uses real hub exit',()=>{
 const g=prepare();const p=regions.FIELD_NPCS[METEORFALL_ID];g.enemies=[{id:1,hp:1,group:{position:{x:p.x+1,z:p.z},visible:true},definition:{id:'not-elite',variant:'normal'},dummy:false}];
 assert(g.openNpc(p.id));assert(g.cityAction('accept','field-meteorfall-citadel-elite'));assert.equal(nav.readDevelopmentQuestNavigation(g,'field-meteorfall-citadel-elite').target?.id,'enemy-1');
 g.enemies=[];assert(regions.acceptRegionQuest(g.hero,'main-verdant-bisikan'));g.hero.kills=6;
 g.portalLabels=[{...METEORFALL_EXIT,name:'Jayantara'}];const route=nav.readDevelopmentQuestNavigation(g,'main-verdant-bisikan');assert.equal(route.target?.kind,'portal');assert.equal(route.target?.region,METEORFALL_ID);
 g.portalLabels=[];g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'navigation-game-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});});
