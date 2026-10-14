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
const ready=g=>{g.sunken={dispose(){},metrics:()=>({offline:true}),height:()=>0};};
// Original failed cityAction still saves its timestamp; all gameplay fields must be identical.
const gameplay=h=>({...structuredClone(h),lastPlayedAt:0});
for(const [suffix,required,xp,gold,quantity] of [['easy',5,1120,515,2],['veteran',10,2016,927,3],['elite',15,3360,1545,5]])await test('actual Game quest '+suffix+' original reward once through save/new Game',()=>{
 const g=game(40,{'v3-warrior-strike':1});assert(regions.travel(g.hero,'sunken-ruins').ok);ready(g);
 const npc=regions.FIELD_NPCS['sunken-ruins'];g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
 const id='field-sunken-ruins-'+suffix;assert(g.cityAction('accept',id));g.hero.fieldProgress['sunken-ruins']=required; // mechanical objective only; browser proves original kills
 const initialXP=g.hero.xp,initialGold=g.hero.gold,expected=structuredClone(g.hero);rules.gainXP(expected,xp);
 assert(g.cityAction('complete',id));assert.equal(g.hero.level,expected.level);assert.equal(g.hero.xp,expected.xp);assert.equal(g.hero.gold,initialGold+gold);
 assert.equal(g.hero.inventory.filter(i=>i.templateId==='vibranium').reduce((n,i)=>n+i.quantity,0),quantity);assert(g.getDevelopmentWarriorAvailability().ok);
 const snapshot=gameplay(g.hero);assert(!g.cityAction('complete',id));assert(!g.cityAction('accept',id));for(const key of Object.keys(snapshot))assert.deepEqual(gameplay(g.hero)[key],snapshot[key],key);
 g.save();assert(g.saved);const next=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);next.started=true;ready(next);assert.equal(next.getDevelopmentWarriorAvailability(),null);
 next.actor.position.set(npc.x,0,npc.z);assert(next.openNpc(npc.id));const restored=gameplay(next.hero);assert(!next.cityAction('complete',id));assert(!next.cityAction('accept',id));for(const key of Object.keys(restored))assert.deepEqual(gameplay(next.hero)[key],restored[key],key);
 evidence.push({id,required,xp,gold,quantity,initialXP,actualXP:g.hero.xp,actualLevel:g.hero.level,completed:next.hero.completedQuests,duplicateRejected:true,loadDefaultOFF:true});next.dispose();g.dispose();
});
await test('actual Game inventory-full claim rejects without completion or partial reward',()=>{
 const g=game(40,{'v3-warrior-strike':1});assert(regions.travel(g.hero,'sunken-ruins').ok);const npc=regions.FIELD_NPCS['sunken-ruins'];g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
 const id='field-sunken-ruins-easy';assert(g.cityAction('accept',id));g.hero.fieldProgress['sunken-ruins']=5;
 while(g.hero.inventory.filter(i=>!i.isEquipped).length<g.hero.inventoryCapacity)g.hero.inventory.push(items.createItem('field-verdant-plains-sword',{id:'mechanical-full-'+g.hero.inventory.length}));
 ready(g);assert(g.enableDevelopmentWarriorReference({lifecycleRenewal:true}).ok);g.save();const prior=gameplay(g.hero);assert(!g.cityAction('complete',id));for(const key of Object.keys(prior))assert.deepEqual(gameplay(g.hero)[key],prior[key],key);assert(g.getDevelopmentWarriorAvailability().ok);g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'actual-map-quest-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});});
