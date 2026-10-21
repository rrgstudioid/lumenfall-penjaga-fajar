// Actual Game/rules/queue/HP/save consumers. DOM/WebGL/audio are OFFLINE render stubs.
// Forced RNG and enemy stats below are mechanical unit probes, never browser proof.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
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
const warrior=await load('warrior-v3'),berserker=await load('berserker-v3'),blade=await load('blade-master-v3');
const definitions={...warrior.WARRIOR_V3_SKILL_MAP,...berserker.BERSERKER_V3_SKILL_MAP,...blade.BLADE_MASTER_V3_SKILL_MAP};
/** @type {Array<[string,string,number,Record<string,number>,Record<string,number>]>} */
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
let serial=0;
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
function target(g){const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));const e={id:++serial,group,home:group.position.clone(),hp:10000,max:10000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'FIXTURE-'+serial,definition:{defense:70,magicDefense:300},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion:0,marked:false,weakPoint:false};g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));g.faceTarget(e);return e;}

await test('actual Game reward consumer: actual-level baseline, expGain once, Gold old rewardLevel, save/Continue OFF',()=>{
 const g=game('adventurer',1);const e=target(g);e.hp=e.max=10;e.definition={id:'mechanical-exp-normal',name:'Fixture normal',level:3,rewardLevel:1,rank:'normal',variant:'normal',exp:999,defense:0,magicDefense:0,respawnTime:20,loot:[]};
 // Labeled stat-source fixture tests reward multiplier; not legal gear admission proof.
 const item=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);item.baseStats.expGain=25;
 assert.equal(rules.derivedStats(g.hero).expGain,25);const before=g.hero.xp,gold=[];g.spawnGoldDrop=(amount)=>gold.push(amount);
 g.hurtEnemy(e,100,0);assert.equal(g.hero.xp-before,50);assert.deepEqual(gold,[9]);assert.equal(g.hero.level,1);assert.equal(g.getDevelopmentAdventurerRange(),null);
 const again=rules.loadCharacter(g.hero.slotId);assert.equal(again.xp,50);assert.equal(again.level,1);assert.equal(again.expProgressionVersion,'LUMENFALL_EXP_P1_V1');g.dispose();
});
await test('actual reward level-up preserves allocation/SP contract and resource refill; no selected auto-enable',()=>{
 const g=game('adventurer',1);rules.gainXP(g.hero,150);g.hero.hp=15;g.hero.mana=2;const e=target(g);e.hp=e.max=10;e.definition={id:'mechanical-exp-level1',name:'Fixture',level:1,rewardLevel:1,rank:'normal',variant:'normal',exp:7,defense:0,respawnTime:20,loot:[]};
 g.spawnGoldDrop=()=>{};const points=g.hero.statPoints;g.hurtEnemy(e,100,0);assert.equal(g.hero.level,2);assert.equal(g.hero.xp,10);assert.equal(g.hero.statPoints,points+2);assert.equal(g.hero.hp,rules.maxHP(g.hero));assert.equal(g.hero.mana,rules.derivedStats(g.hero).maxMana);assert.equal(g.getDevelopmentAdventurerRange(),null);g.dispose();
});
after(()=>server.close());
