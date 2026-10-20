// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.FULL_HOME_CHECKPOINT;
const storage = new Map();
const memory = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), remove() {},
  getContext: () => ({ clearRect() {}, fillRect() {} }) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline-basic' }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
  document: { querySelector: () => null, createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {}, requestAnimationFrame: () => 0 });
const server = await createServer({ configFile: false, appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'power-strike-vite-cache'),
  server: { middlewareMode: true, hmr: false }, resolve: { alias: { '@': process.cwd() } },
  plugins: [{ name: 'offline-basic-renderer-only', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:basic-test-three') return '\0basic-test-three'; },
    load(id) { if (id === '\0basic-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      pixelRatio=1; setPixelRatio(value){this.pixelRatio=value;} getPixelRatio(){return this.pixelRatio;} setSize(){} render(){} dispose(){} forceContextLoss(){} }`; },
    transform(source, id) {
      if (id.replaceAll('\\', '/').endsWith('/lib/game/world.ts'))
        return source.replace("import * as T from 'three';", "import * as T from 'virtual:basic-test-three';");
    },
  }] });
const evidence = [];
after(async () => { await server.close(); if (output) fs.writeFileSync(path.join(output, 'world-evidence.json'), JSON.stringify(evidence, null, 2)); });
const load = name => server.ssrLoadModule('/lib/game/' + name + '.ts');
const { Game } = await load('world');
const rules = await load('rules');
const items = await load('items');
const regions = await load('regions');
const basic = await load('basic-attack-reference-v2');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance', 'drawMap'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {}, reset() {} }, ready: Promise.resolve(true), updateVisual() {}, setQuality() {}, dispose() {} };
  this.testAnimations = [];
};
let serial = 0;
const quickId='v3-adventurer-quick-slash',powerId='v3-adventurer-power-strike';
const levels={quick:[1,3,6,9,13],power:[2,7,10,12,14]};
function game({optIn=true,kind='power',rank=1,level=levels[kind][rank-1],combined=false}={}){
 const h=rules.createV3AdventurerHero('combined-world-'+(++serial));
 storage.clear();rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);
 g.actor.position.set(g.hero.x,0,g.hero.z);g.started=true;
 g.testFloats=[];g.float=(...args)=>g.testFloats.push({text:args[1],kind:args[2]});
 for(const name of ['sound','effect','ring','pulse','arc'])g[name]=()=>{};
 while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 const acquire=(id,r)=>{while((g.hero.skillLevels[id]??0)<r)assert(g.learnSkill(id));};
 if(combined){acquire(quickId,5);acquire(powerId,5);}else acquire(kind==='quick'?quickId:powerId,rank);
 const sword=structuredClone(items.createItem(basic.BASIC_REFERENCE_B.templateId,{id:g.hero.slotId+'-training'}));
 g.hero.inventory.push(sword);assert(g.equipItem(sword.id,'mainHand'));
 assert.notEqual(g.hero.inventory.find(i=>i.id===sword.id),sword);
 if(optIn)assert(g.enableDevelopmentAdventurerRanksReference().ok);
 return g;
}
function target(g, { defense = 70, hp = 1000, evasion = 0 } = {}) {
  const group = new T.Group(); group.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
  group.position.copy(g.actor.position).add(new T.Vector3(0, 0, -1));
  const e = { id: ++serial, group, home: group.position.clone(), hp, max: hp, boss: false, dummy: false,
    spawnGeneration: 0, respawnKey: 'mechanical-basic-' + serial, definition: { defense, magicDefense: 300 },
    ring: new T.Mesh(new T.RingGeometry(), new T.MeshBasicMaterial()),
    windup: 0, cooldown: 0, flash: 0, stun: 0, slow: 0, root: 0, poison: 0, defenseDown: 0,
    statusEffects: {}, attack: 10, attackRange: 2, movementSpeed: 1, evasion, marked: false, weakPoint: false };
  g.scene.add(group); g.enemies.push(e); g.registerTargetEnemy(e); assert(g.setCurrentTarget(e));
  return e;
}
function rng(g, values) {
  const draws = [];
  g.rand = () => { const index = draws.length; assert(index < values.length, 'unexpected RNG draw');
    const value = values[index]; draws.push(value); if (value instanceof Error) throw value; return value; };
  return draws;
}
function commitment(g) {
  return { hero: JSON.stringify(g.hero), temporaryOwn: Object.hasOwn(g.hero, 'temporaryModifiers'),
    signature: g.dualBasicEquipmentSignature, hand: g.dualBasicNextHand,
    direction: g.direction.toArray(), rotation: g.actor.rotation.toArray(), combo: g.combo, comboWindow: g.comboWindow,
    position: g.actor.position.toArray(), lock: g.actionLock.active(g.combatTime), queue: g.skillHits.size,
    timer: g.attackTimer, swing: g.swing, animations: [...g.testAnimations], cooldowns: { ...g.skillCooldowns } };
}





const producer=await load('adventurer-ranks-reference-v2');
const activate=g=>assert(g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true}).ok);
const range=g=>{const result=g.getDevelopmentAdventurerRange();assert(result?.ok,JSON.stringify(result));return result.value;};
function visitQuestNpc(g,mapId,npcId){
 // Mechanical relocation in an offline render stub; use actual NPC identity,
 // map and interaction range instead of a fabricated {services:['quest']} object.
 const npc=regions.regionNpcs(mapId).find(n=>n.id===npcId);assert(npc);
 g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
}
for(let level=1;level<=14;level++)for(const allocation of ['neutral','STR','mixed'])await test('RANGE Lv'+level+' '+allocation+': shared preparation and getter pure',async()=>{
 const g=game({kind:'quick',rank:1,level});activate(g);
 for(let i=0,n=g.hero.statPoints;i<n&&allocation!=='neutral';i++)assert(g.allocateStatPoint(allocation==='STR'?'str':['str','vit','dex','int'][i%4]));
 const before=commitment(g),seed=g.seed,stored=JSON.stringify([...storage]),r=range(g),core=7+Math.floor(level*1.1)+g.hero.allocatedStats.str;
 assert.deepEqual(r.MAIN,{min:core+9,max:core+11});assert.equal(r.base,7+Math.floor(level*1.1));assert.equal(r.bonusSTR,g.hero.allocatedStats.str);
 for(let i=0;i<100;i++){assert.deepEqual(range(g),r);assert(Object.isFrozen(r)&&Object.isFrozen(r.MAIN));}
 assert.deepEqual(commitment(g),before);assert.equal(seed,g.seed);assert.equal(stored,JSON.stringify([...storage]));
 const token=producer.openAdventurerRanksBinding(g);assert(token.ok);
 const a=producer.prepareAdventurerBasic(token.value,g,1);assert(a.ok);
 for(let i=0;i<100;i++)range(g);
 const b=producer.prepareAdventurerBasic(token.value,g,2);assert(b.ok);assert.deepEqual(a.value.snapshot.hits[0].attack,r.MAIN);assert.deepEqual(b.value.snapshot.hits[0].attack,r.MAIN);
 assert.equal(Number(b.value.snapshot.executionId.split(':').at(-1)),Number(a.value.snapshot.executionId.split(':').at(-1))+1);g.dispose();
});
await test('RENEW: learn/allocation/hotbar/layout/equip/unequip; no manual readmission or cooldown clear',()=>{
 const g=game({kind:'quick',rank:1,level:3});activate(g);target(g);rng(g,[.25,0,.99]);assert(g.castSkill(1));const cd=g.skillCooldowns[quickId];
 assert(g.learnSkill(powerId));assert(g.allocateStatPoint('str'));assert(g.assignPrimaryHotbarSlot(1,powerId));g.swapPrimaryHotbarSlots(0,1);g.removePrimaryHotbarSlot(1);
 g.savePrimaryHotbarLayout({x:50,y:70});assert(g.assignQuickHotbarSlot('q',quickId));g.moveQuickHotbarEntry('q','e');g.removeQuickHotbarSlot('e');g.saveQuickHotbarLayout('q',{x:80,y:90});g.resetHotbarLayouts();
 assert.equal(g.skillCooldowns[quickId],cd);range(g);
 const item=g.hero.equipment.mainHand;assert(g.unequipItem('mainHand'));assert(!g.getDevelopmentAdventurerRange().ok);
 rng(g,[]);assert(!g.castSkill(1));assert(g.equipItem(item,'mainHand'));range(g);assert.equal(g.skillCooldowns[quickId],cd);g.dispose();
});
await test('FAILED operations preserve existing authority; no failed learn clone enrollment',()=>{
 const g=game({kind:'quick',rank:1,level:2});activate(g);const hero=g.hero;
 assert(!g.learnSkill(quickId));assert.equal(g.hero,hero);assert(!g.learnSkill('invalid'));
 assert(!g.equipItem('missing'));assert(!g.assignPrimaryHotbarSlot(-1,quickId));assert(!g.allocateStatPoint('invalid'));
 assert(!g.getDevelopmentAdventurerRenewal());range(g);target(g);rng(g,[.5,0,.99]);assert(g.castSkill(1));g.dispose();
});
await test('NATIVE UI drop transaction renews; rejected drop preserves root authority',()=>{
 const g=game({kind:'quick',rank:1,level:3});activate(g);
 assert(g.commitUIDrop({dragType:'skill',refId:quickId},{type:'hotbar',slot:0}));
 assert.equal(g.getDevelopmentAdventurerRenewal().reason,'commitUIDrop');range(g);
 assert(g.allocateStatPoint('str'));assert.equal(range(g).bonusSTR,1);
 const hero=g.hero;assert(!g.commitUIDrop({dragType:'skill',refId:'invalid'},{type:'hotbar',slot:1}));
 assert.equal(g.hero,hero);range(g);g.dispose();
});
for(const mutate of [g=>g.hero={...g.hero},g=>g.hero.allocatedStats.str++,g=>g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).enhancementLevel=1])await test('FORGED/stale mutation cannot gain authority through successful transaction',()=>{
 const g=game({kind:'quick',rank:1,level:3});activate(g);mutate(g);g.assignPrimaryHotbarSlot(0,quickId);
 assert(!g.getDevelopmentAdventurerRange().ok);target(g);rng(g,[]);assert(!g.castSkill(1));assert(!g.getDevelopmentAdventurerRenewal());g.dispose();
});
await test('DEATH/respawn original policy retains cooldown and renews exact root; load OFF',()=>{
 const g=game({kind:'quick',rank:1,level:2});activate(g);target(g);rng(g,[.5,0,.99]);assert(g.castSkill(1));const cd=g.skillCooldowns[quickId];
 rng(g,[.99,.99]);g.hurtHero(100000,'MECHANICAL_LETHAL');assert(g.dead);assert(!g.getDevelopmentAdventurerRange().ok);
 g.respawn();range(g);assert.equal(g.skillCooldowns[quickId],cd);g.save();
 const loaded=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);assert.equal(loaded.getDevelopmentAdventurerRange(),null);assert.equal(loaded.getDevelopmentAdventurerSkillMetadata(quickId),null);loaded.dispose();g.dispose();
});
await test('REWARD level-up in place renews actual registered lethal consumer',()=>{
 const g=game({kind:'quick',rank:1});activate(g);const e=target(g,{hp:1,defense:0});e.definition.level=1;e.definition.exp=rules.xpNeeded(1);e.definition.dropRate=0;e.definition.lootTable=[];rng(g,[.5,0,.99,.99]);assert(g.attack().ok);
 assert.equal(g.hero.level,2);assert.equal(g.getDevelopmentAdventurerRenewal().reason,'reward gainXP');range(g);g.dispose();
});
await test('AUTHORITATIVE unsupported gear invalidates; valid re-equip recovers without changing cooldown',()=>{
 const g=game({kind:'quick',rank:1,level:3});activate(g);const sword=g.hero.equipment.mainHand;
 const dawn=g.hero.inventory.find(i=>i.templateId==='legacy-dawnblade'||i.name==='Dawnblade');assert(dawn);
 assert(g.equipItem(dawn.id,'mainHand'));assert(!g.getDevelopmentAdventurerRange().ok);
 target(g);rng(g,[]);assert(!g.castSkill(1));assert(g.equipItem(sword,'mainHand'));range(g);g.dispose();
});
await test('QUEST reward renews only after original successful completion; duplicate claim cannot grant authority',()=>{
 const g=game({kind:'quick',rank:1});
 // Existing quest grants 80 XP, not a guaranteed full level from fresh zero XP.
 rules.gainXP(g.hero,rules.xpNeeded(1)-80);activate(g);
 visitQuestNpc(g,'arunika','aruna-0');
 assert(g.cityAction('accept','main-verdant-bisikan'));
 for(let i=0;i<6;i++){
  const e=target(g,{hp:1,defense:0});e.definition.level=1;e.definition.exp=0;e.definition.dropRate=0;e.definition.lootTable=[];
  g.hurtEnemy(e,100,0);
 }
 assert.equal(g.hero.kills,6);assert(g.cityAction('complete','main-verdant-bisikan'));
 assert(g.hero.level>1);assert.equal(g.getDevelopmentAdventurerRenewal().reason,'quest gainXP');range(g);
 const stableState=()=>{const state=commitment(g),hero=JSON.parse(state.hero);
  // cityAction historically saves even a duplicate claim; lastPlayedAt is bookkeeping.
  delete hero.lastPlayedAt;return {...state,hero:JSON.stringify(hero)};};
 const state=stableState(),hero=g.hero,event=g.getDevelopmentAdventurerRenewal();assert(!g.cityAction('complete','main-verdant-bisikan'));
 assert.equal(g.hero,hero);assert.deepEqual(stableState(),state);assert.equal(g.getDevelopmentAdventurerRenewal(),event);range(g);g.dispose();
});
await test('AUTHORITATIVE level15 invalidates selected route; no legacy fallback or RNG',()=>{
 const g=game({kind:'quick',rank:1,level:14});activate(g);const e=target(g,{hp:1,defense:0});
 e.definition.level=14;e.definition.exp=rules.xpNeeded(14);e.definition.dropRate=0;e.definition.lootTable=[];
 rng(g,[.5,0,.99,.99]);assert(g.attack().ok);assert.equal(g.hero.level,15);
 assert.equal(g.getDevelopmentAdventurerRenewal().ok,false);assert(!g.getDevelopmentAdventurerRange().ok);
 target(g);rng(g,[]);assert(!g.castSkill(1));g.dispose();
});
await test('QUEST inventory reward: pre-transaction authority survives actual material admission and completion',()=>{
 const g=game({kind:'quick',rank:1,level:3});
 // A source-existing material quest, offline transaction proof only, not map fidelity.
 const quest=regions.getQuestRegistry().find(q=>q.category==='side'&&q.requiredLevel<=g.hero.level&&q.rewards.items.length>0);
 assert(quest);assert(regions.travel(g.hero,quest.giverMapId).ok);activate(g);
 assert(quest && quest.rewards.items.length>0);visitQuestNpc(g,quest.giverMapId,quest.giverNpcId);
 assert(g.cityAction('accept',quest.id));
 for(let i=0;i<quest.objectives[0].required;i++){
  const e=target(g,{hp:1,defense:0});e.definition.level=1;e.definition.exp=0;e.definition.dropRate=0;e.definition.lootTable=[];g.hurtEnemy(e,100,0);
 }
 const inventory=JSON.stringify(g.hero.inventory);assert(g.cityAction('complete',quest.id));
 assert.notEqual(JSON.stringify(g.hero.inventory),inventory);assert.equal(g.getDevelopmentAdventurerRenewal().reason,'quest gainXP');
 assert(g.getDevelopmentAdventurerRenewal().ok);range(g);g.dispose();
});
await test('MANUAL API still stale after legal clone; default caller not auto-enrolled',()=>{
 const g=game({kind:'quick',rank:1,level:3});assert(g.allocateStatPoint('str'));assert(!g.getDevelopmentAdventurerRange().ok);
 target(g);rng(g,[]);assert(!g.castSkill(1));g.dispose();const off=game({optIn:false,kind:'quick',level:3});off.allocateStatPoint('str');assert.equal(off.getDevelopmentAdventurerRange(),null);off.dispose();
});
await test('ITEM exact identity; templates/clones/+1 do not acquire selected range',()=>{
 const g=game({kind:'quick',rank:1});activate(g);const item=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);
 assert.deepEqual(g.getDevelopmentAdventurerItemRange(item),{min:9,max:11});assert.equal(g.getDevelopmentAdventurerItemRange({...item}),null);
 assert(g.unequipItem('mainHand'));const current=g.hero.inventory.find(i=>i.id===item.id);
 const before=commitment(g),seed=g.seed;assert.deepEqual(g.getDevelopmentAdventurerItemRange(current),{min:9,max:11});
 assert(!g.getDevelopmentAdventurerRange().ok);assert.deepEqual(commitment(g),before);assert.equal(g.seed,seed);
 assert.equal(g.getDevelopmentAdventurerItemRange(item),null);assert.equal(g.getDevelopmentAdventurerItemRange({...current}),null);
 current.enhancementLevel=1;assert.equal(g.getDevelopmentAdventurerItemRange(current),null);g.dispose();
});
