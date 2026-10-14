// Actual Game/rules/save/Core consumers; DOM/WebGL/audio are OFFLINE render stubs.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const output=process.env.WARRIOR_CORE_CHECKPOINT; assert(output);
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/warrior-world'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const {Game}=await load('world'),rules=await load('rules'),{CITIES}=await load('regions');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const evidence=[];let serial=0;
function game(level=15){
 storage.clear();const h=rules.createV3AdventurerHero('core-game-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;
 while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(const [id,n] of [['v3-adventurer-quick-slash',5],['v3-adventurer-power-strike',5],['v3-adventurer-minor-heal',3]])
  while((g.hero.skillLevels[id]??0)<n)assert(g.learnSkill(id));
 for(let i=0;i<2*(level-1);i++)assert(g.allocateStatPoint(['str','vit','dex','int'][i%4]));
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');
 // Mechanical positioning at a real registered trainer; consumer range gate untouched.
 g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));return g;
}
const snapshot=g=>({hero:structuredClone(g.hero),seed:g.seed,cd:{...g.skillCooldowns},queue:g.skillHits.size});
await test('actual Game.chooseCoreJob: legal Lv15 paid ledger + mixed allocation refund, inventory/identity preserved',()=>{
 const g=game(),before=snapshot(g);g.hero.hp=42;g.hero.mana=12;
 g.skillCooldowns['v3-adventurer-quick-slash']=2;
 assert(g.chooseCoreJob('warrior'));const after=snapshot(g);
 assert.equal(g.hero.statPoints,28);assert.deepEqual(g.hero.allocatedStats,{str:0,vit:0,dex:0,int:0});
 assert.equal(g.hero.skillPoints,14);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,14);
 assert.deepEqual(g.hero.skillProgressionV3.skillRanks,{'v3-adventurer-quick-slash':1});
 assert.equal(g.hero.characterId,before.hero.characterId);assert.deepEqual(g.hero.inventory,before.hero.inventory);
 assert.equal(g.hero.hp,42);assert.equal(g.hero.mana,12);assert.equal(g.seed,before.seed);
 assert.equal(g.skillHits.size,0);assert.equal(g.getDevelopmentAdventurerRange(),null);
 evidence.push({case:'ORIGINAL_CORE_TRANSACTION',before,after,cooldownDisposition:'existing retainFamilyCooldowns consumer, unchanged'});g.dispose();
});
await test('actual rejected equipped/below15/wrong trainer and reselect have no Hero/resource/RNG/queue writes',()=>{
 const g=game(14),before=snapshot(g);assert.equal(g.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(g),before);g.dispose();
 const h=game();h.closeNpcMenu();const wrong=snapshot(h);assert.equal(h.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(h),wrong);
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');assert(h.openNpc(npc.id));
 const sword=h.hero.inventory.find(i=>i.weaponType==='one_hand_sword');assert(sword);assert(h.equipItem(sword.id,'mainHand'));
 const equipped=snapshot(h);assert.equal(h.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(h),equipped);
 assert(h.unequipItem('mainHand'));assert(h.chooseCoreJob('warrior'));
 const chosen=snapshot(h);assert.equal(h.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(h),chosen);
 evidence.push({case:'ORIGINAL_CORE_REJECTIONS',level:true,trainer:true,equipment:true,reselect:true});h.dispose();
});
await test('actual purchase/allocate/save -> new Game preserves paid Warrior state; load/reselect cannot refund again',()=>{
 const g=game();assert(g.chooseCoreJob('warrior'));assert(g.learnSkill('v3-warrior-strike'));assert(g.allocateStatPoint('str'));
 assert(g.assignPrimaryHotbarSlot(0,'v3-warrior-strike'));g.save();
 const stored=[...storage],fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);fresh.started=true;
 assert.equal(fresh.hero.coreJob,'warrior');assert.equal(fresh.hero.statPoints,27);assert.equal(fresh.hero.allocatedStats.str,1);
 assert.equal(fresh.hero.skillPoints,12);assert.equal(fresh.hero.skillProgressionV3.totalEarnedSP,14);
 assert.equal(fresh.hero.skillLevels['v3-warrior-strike'],1);assert.equal(fresh.hero.primaryHotbar[0],'v3-warrior-strike');
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');fresh.hero.x=npc.x;fresh.hero.z=npc.z;fresh.actor.position.set(npc.x,0,npc.z);assert(fresh.openNpc(npc.id));
 const before=snapshot(fresh);assert.equal(fresh.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(fresh),before);
 assert.equal(fresh.getDevelopmentAdventurerRange(),null);
 evidence.push({case:'ORIGINAL_SAVE_NEW_GAME',fixtureStorageOnly:true,keys:stored.map(x=>x[0]),after:before});fresh.dispose();g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'actual-core-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});});
