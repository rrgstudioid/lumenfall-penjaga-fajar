// Actual Game/rules/save/Core consumers; DOM/WebGL/audio are OFFLINE render stubs.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const output=process.env.RESOURCE_PROFILE_CHECKPOINT; assert(output);
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
await test('actual Game Core resource profile, current clamp, primary/SP refund once and original save/new Game',()=>{
 const g=game(),before=snapshot(g);const current=[g.hero.hp,g.hero.mana];
 assert(g.chooseCoreJob('warrior'));assert.equal(rules.derivedStats(g.hero).maxHP,791);assert.equal(g.hero.maxMana,89);
 assert.equal(g.hero.hp,Math.min(current[0],791));assert.equal(g.hero.mana,Math.min(current[1],89));
 assert.equal(g.hero.statPoints,28);assert.equal(g.hero.skillPoints,14);assert.equal(g.hero.characterId,before.hero.characterId);
 assert(g.allocateStatPoint('vit'));assert(g.allocateStatPoint('int'));
 const saved=snapshot(g);g.save();const next=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);next.started=true;
 assert.equal(next.hero.hp,g.hero.hp);assert.equal(next.hero.mana,g.hero.mana);assert.equal(next.hero.statPoints,26);
 assert.deepEqual(next.hero.allocatedStats,g.hero.allocatedStats);assert.deepEqual(next.hero.inventory,g.hero.inventory);
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');next.actor.position.set(npc.x,0,npc.z);assert(next.openNpc(npc.id));
 const atTrainer=snapshot(next);assert.equal(next.chooseCoreJob('warrior'),false);assert.deepEqual(snapshot(next),atTrainer);
 evidence.push({case:'LEGAL_CORE_SAVE_LOAD',before,after:saved,loaded:snapshot(next)});next.dispose();g.dispose();
});
for(const spec of ['berserker','blade_master'])await test('actual Game legal '+spec+' transition without new refill/reset',async()=>{
 const g=game();assert(g.chooseCoreJob('warrior'));
 while(g.hero.level<60)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(let j=0;j<28;j++)assert(g.allocateStatPoint(j%2?'int':'vit'));
 assert(g.changeRegion('jayantara'));
 while(g.transitioning)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(g.hero.currentCity,'jayantara');assert.equal(g.regionLoadError,null);
 const npc=CITIES.jayantara.npcList.find(n=>n.service==='special');assert(npc);
 g.closeNpcMenu();g.actor.position.set(npc.x,0,npc.z);g.hero.x=npc.x;g.hero.z=npc.z;assert(g.openNpc(npc.id));
 const before=snapshot(g);assert(g.chooseSpecialization(spec));const after=snapshot(g);
 const hp=Math.round((spec==='berserker'?1.4:1.15)*(230+28.75*59)+14*(8+.05*59));
 const mp=Math.floor((spec==='berserker'?.85:1)*(60+2.5*60+.01*3600)+42);
 assert.equal(rules.derivedStats(g.hero).maxHP,hp);assert.equal(g.hero.maxMana,mp);
 assert.equal(g.hero.hp,Math.min(before.hero.hp,hp));assert.equal(g.hero.mana,Math.min(before.hero.mana,mp));
 assert.deepEqual(g.hero.allocatedStats,before.hero.allocatedStats);assert.equal(g.hero.statPoints,before.hero.statPoints);
 assert.equal(g.hero.skillProgressionV3.totalEarnedSP,before.hero.skillProgressionV3.totalEarnedSP);
 const keep=snapshot(g);assert.equal(g.chooseSpecialization(spec),false);assert.deepEqual(snapshot(g),keep);
 evidence.push({case:'LEGAL_SPEC_'+spec,before,after,expected:{hp,mp}});g.dispose();
});
await test('actual Warrior equip/unequip and death/respawn preserve approved maxima and paid state',()=>{
 const g=game();assert(g.chooseCoreJob('warrior'));assert(g.allocateStatPoint('vit'));assert(g.allocateStatPoint('int'));
 const sword=g.hero.inventory.find(i=>i.weaponType==='one_hand_sword');assert(sword);
 const before=snapshot(g);assert(g.equipItem(sword.id,'mainHand'));
 assert.equal(g.hero.hp,before.hero.hp);assert.equal(g.hero.mana,before.hero.mana);
 assert(g.unequipItem('mainHand'));const prior=snapshot(g);
 assert.equal(g.invincible,0);g.hurtHero(1_000_000,'MECHANICAL_RESOURCE_DEATH');
 assert(g.dead);assert.equal(g.hero.hp,0);assert.equal(g.skillHits.size,0);
 const mana=g.hero.mana;g.respawn();assert.equal(g.dead,false);
 assert.equal(g.hero.hp,799);assert.equal(g.hero.maxMana,92);assert.equal(g.hero.mana,mana);
 assert.deepEqual(g.hero.allocatedStats,prior.hero.allocatedStats);assert.equal(g.hero.statPoints,26);
 assert.deepEqual(g.hero.skillProgressionV3,prior.hero.skillProgressionV3);
 evidence.push({case:'ORIGINAL_EQUIP_DEATH_RESPAWN',before:prior,after:snapshot(g),mechanicalDamage:1_000_000});g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'actual-resource-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});});
