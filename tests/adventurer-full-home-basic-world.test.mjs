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
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline-basic' }, addEventListener() {}, removeEventListener() {} },
  document: { querySelector: () => null, createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {}, requestAnimationFrame: () => 0 });
const server = await createServer({ configFile: false, appType: 'custom',
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'power-strike-vite-cache'),
  server: { middlewareMode: true, hmr: false }, resolve: { alias: { '@': process.cwd() } },
  plugins: [{ name: 'offline-basic-renderer-only', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:basic-test-three') return '\0basic-test-three'; },
    load(id) { if (id === '\0basic-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      setPixelRatio(){} setSize(){} render(){} dispose(){} forceContextLoss(){} }`; },
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
const basic = await load('basic-attack-reference-v2');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {}, reset() {} }, ready: Promise.resolve(true), dispose() {} };
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
function ledger(g) {
  const calls = [], original = g.hurtEnemy.bind(g);
  g.hurtEnemy = (...args) => { const beforeHP = args[0].hp, value = original(...args);
    calls.push({ raw: args[1], policy: args[7], attackerLevel: args[5], value, hpDelta: beforeHP - args[0].hp }); return value; };
  return calls;
}
function commitment(g) {
  return { hero: JSON.stringify(g.hero), temporaryOwn: Object.hasOwn(g.hero, 'temporaryModifiers'),
    signature: g.dualBasicEquipmentSignature, hand: g.dualBasicNextHand,
    direction: g.direction.toArray(), rotation: g.actor.rotation.toArray(), combo: g.combo, comboWindow: g.comboWindow,
    position: g.actor.position.toArray(), lock: g.actionLock.active(g.combatTime), queue: g.skillHits.size,
    timer: g.attackTimer, swing: g.swing, animations: [...g.testAnimations], cooldowns: { ...g.skillCooldowns } };
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);




const healId='v3-adventurer-minor-heal';
function readmit(g){assert(g.enableDevelopmentAdventurerRanksReference().ok);}
function first(g,e,{u=.25,hit=0,crit=.99}={}){
 const calls=ledger(g),draws=rng(g,[u,hit,crit]),beforeHP=e?.hp,beforeMP=g.hero.mana;
 const result=g.attack();assert(result.ok,JSON.stringify(result));const bonus=g.hero.allocatedStats.str;
 const raw=7+Math.floor(g.hero.level*1.1)+bonus+9+2*u;close(result.sample.totalRaw,raw);
 if(e){assert.equal(calls.length,1);assert.equal(calls[0].attackerLevel,g.hero.level);assert.equal(calls[0].raw,raw);
 const final=Math.round(raw*(500+10*g.hero.level)/(500+10*g.hero.level+e.definition.defense));
 assert.equal(beforeHP-e.hp,final);assert(g.testFloats.some(f=>f.text===String(final)&&f.kind==='damage'));}
 assert.equal(beforeMP,g.hero.mana);assert.equal(g.hero.skillPoints,g.hero.level-1);assert.equal(g.attackTimer>0,true);
 evidence.push({case:'first-basic',level:g.hero.level,allocation:g.hero.allocatedStats,raw,calls,draws,result});return {result,calls,draws};
}
for(let level=1;level<=14;level++)for(const allocation of ['neutral','STR','mixed'])await test('H-BASIC Lv'+level+' '+allocation+': actual first attack / level-aware HP / precision',()=>{
 const g=game({kind:'quick',rank:1,level});const points=g.hero.statPoints;
 for(let i=0;i<points && allocation!=='neutral';i++)assert(g.allocateStatPoint(allocation==='STR'?'str':['str','vit','dex','int'][i%4]));
 readmit(g);first(g,target(g,{defense:40}));g.dispose();
});
for(const stat of ['vit','dex','int'])await test('H-CONTRAST '+stat+': no raw scaling',()=>{
 const g=game({kind:'quick',rank:1,level:14});while(g.hero.statPoints)assert(g.allocateStatPoint(stat));readmit(g);first(g,target(g,{defense:40}));g.dispose();
});
await test('H-COMBO: malformed stored event4 rejects before any commitment',()=>{
 const g=game({kind:'quick',rank:1});target(g);g.combo=4;g.comboWindow=1;const before=commitment(g),draws=rng(g,[]);
 const result=g.attack();assert.equal(result.code,'UNSUPPORTED_COMBO');assert.deepEqual(commitment(g),before);assert.equal(draws.length,0);
 assert.equal(g.combo,4);assert.equal(g.comboWindow,1);g.dispose();
});
await test('H-COHERENT: Lv14 Q5/P5/H3 mixed actor uses one binding for first basic and original skill impacts',()=>{
 const g=game({combined:true,level:14});for(let i=0;i<3;i++)assert(g.learnSkill(healId));for(let i=0;i<26;i++)assert(g.allocateStatPoint(['str','vit','dex','int'][i%4]));
 readmit(g);const e=target(g,{defense:40});let draws=rng(g,[.25,0,.99]);const basicResult=g.attack();assert(basicResult.ok);
 assert.equal(g.hero.skillProgressionV3.totalEarnedSP,13);assert.equal(g.hero.skillPoints,1);
 for(const [id,c,s,mp,cd] of [[quickId,1.2,.06,5,2.8],[powerId,1.45,.08,7,5]]){
 const hp=e.hp,mana=g.hero.mana;draws=rng(g,[.25,0,.99]);assert(g.castSkill(id));const result=g.getDevelopmentAdventurerRanksResult();
 const raw=(7+Math.floor(14*1.1)+g.hero.allocatedStats.str+9.5)*c+g.hero.allocatedStats.str*s;
 close(result.sample.totalRaw,raw);assert.equal(hp-e.hp,Math.round(raw*640/680));assert.equal(mana-g.hero.mana,mp);assert.equal(g.skillCooldowns[id],cd);assert.deepEqual(draws,[.25,0,.99]);}
 g.dispose();
});
for(const state of ['paused','dead','stunned','timer','action','ledger','allocation','item','replacement','combo','target-range'])await test('H-REJECT '+state+': no draw or mutation',()=>{
 const g=game({kind:'quick',rank:1,level:3});target(g);
 if(state==='paused')g.paused=true;if(state==='dead')g.dead=true;
 if(state==='stunned')g.hero.statusEffects.stun=2;
 if(state==='timer')g.attackTimer=1;
 if(state==='action')g.actionLock.start(g.combatTime,2);
 if(state==='ledger')g.hero.skillPoints++;
 if(state==='allocation')g.hero.allocatedStats.str=-1;
 if(state==='item')g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).bonusStats.attack=1;
 if(state==='replacement')g.hero=structuredClone(g.hero);
 if(state==='combo'){g.combo=4;g.comboWindow=1;}
 if(state==='target-range')g.getCurrentTarget().group.position.z-=100;
 const before=commitment(g),draws=rng(g,[]);const result=g.attack();assert(!result?.ok);assert.deepEqual(commitment(g),before);assert.equal(draws.length,0);g.dispose();
});
for(const bad of [NaN,Infinity,-.1,1,new Error('mechanical RNG')])await test('H-RNG '+String(bad)+': attempted draw is not commitment',()=>{
 const g=game({kind:'quick',rank:1});target(g);const before=commitment(g),draws=rng(g,[bad]);
 if(bad instanceof Error)assert.throws(()=>g.attack(),/mechanical RNG/);else assert(!g.attack().ok);
 assert.equal(draws.length,1);assert.deepEqual(commitment(g),before);g.dispose();
});
await test('H-CRIT: physical Crit once / independent roll / real HP',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{defense:40});const calls=ledger(g);rng(g,[.25,0,0]);const hp=e.hp;
 const result=g.attack();assert(result.ok);const stats=rules.derivedStats(structuredClone(g.hero));assert.equal(hp-e.hp,Math.round(17.5*stats.criticalDamage/100*510/550));assert.equal(calls.length,1);g.dispose();
});
await test('H-EVADE: no HP feedback damage / no Crit draw / timer paid',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{evasion:1000});const hp=e.hp,draws=rng(g,[.25,.99]);assert(g.attack().ok);
 assert.equal(e.hp,hp);assert.equal(draws.length,2);assert(!g.testFloats.some(f=>f.kind==='damage'));assert(g.attackTimer>0);g.dispose();
});
await test('H-TARGET: existing hard-target policy only impacts actual selected registered enemy',()=>{
 const g=game({kind:'quick',rank:1});const a=target(g),b=target(g),hp=a.hp;
 first(g,b);assert.equal(a.hp,hp);assert.equal(g.getCurrentTarget(),b);g.dispose();
});
await test('H-LIFECYCLE: allocation clone invalidates binding, explicit rebind preserves cooldown',()=>{
 const g=game({kind:'quick',rank:1,level:3});target(g);rng(g,[.25,0,.99]);assert(g.castSkill(quickId));const cd=g.skillCooldowns[quickId];
 assert(g.allocateStatPoint('str'));const before=commitment(g);rng(g,[]);assert(!g.attack().ok);assert.deepEqual(commitment(g),before);
 readmit(g);assert.equal(g.skillCooldowns[quickId],cd);first(g,g.getCurrentTarget());g.dispose();
});

await test('H-LETHAL: original death/reward runs once, HP clamp differs from final feedback',()=>{
 const g=game({kind:'quick',rank:1,level:14}),e=target(g,{hp:1});delete e.definition;
 const kills=g.hero.kills,calls=ledger(g),draws=rng(g,[.25,0,.99]);assert(g.attack().ok);
 assert.equal(e.hp,0);assert.equal(g.hero.kills,kills+1);assert.equal(e.group.visible,false);
 assert.equal(calls.length,1);assert.equal(calls[0].hpDelta,1);assert.deepEqual(draws,[.25,0,.99]);
 assert(g.testFloats.some(f=>f.kind==='damage'&&f.text==='32'));
 assert.equal(g.hurtEnemy(e,100,0,'physical'),0);assert.equal(g.hero.kills,kills+1);g.dispose();
});
for(const invalid of ['absent','dead','generation'])await test('H-TARGET '+invalid+': no attack sample or commitment',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g);
 if(invalid==='absent')g.clearCurrentTarget();if(invalid==='dead')e.hp=0;if(invalid==='generation')e.spawnGeneration++;
 const before=commitment(g),draws=rng(g,[]);assert(!g.attack()?.ok);assert.deepEqual(commitment(g),before);assert.equal(draws.length,0);g.dispose();
});
for(const invalid of ['actor','target'])await test('H-AFTER-SAMPLE '+invalid+': attempted draw retained, no later commitment',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g);const originalHero=g.hero;let draws=0;
 const timer=g.attackTimer,combo=g.combo,animations=g.testAnimations.length,mana=g.hero.mana;
 g.rand=()=>{draws++;if(invalid==='actor')g.hero=structuredClone(g.hero);else e.spawnGeneration++;return .25;};
 assert(!g.attack().ok);assert.equal(draws,1);assert.equal(g.attackTimer,timer);assert.equal(g.combo,combo);
 assert.equal(g.testAnimations.length,animations);assert.equal(g.hero.mana,mana);assert.equal(e.hp,e.max);
 if(invalid==='actor')assert.notEqual(g.hero,originalHero);g.dispose();
});
await test('H-FROZEN: MECHANICAL post-commit attacker mutations cannot re-budget raw or attacker level',()=>{
 const g=game({kind:'quick',rank:1});target(g,{defense:40});const calls=ledger(g);let n=0;
 g.rand=()=>{n++;if(n===2){g.hero.level=14;g.hero.allocatedStats.str=999;g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).baseStats.attack=999;}return [.25,0,.99][n-1];};
 const result=g.attack();assert(result.ok);assert.equal(n,3);assert.equal(result.sample.totalRaw,17.5);
 assert.equal(calls[0].raw,17.5);assert.equal(calls[0].attackerLevel,1);assert.equal(calls[0].hpDelta,Math.round(17.5*510/550));
 assert(Object.isFrozen(result.execution));assert(Object.isFrozen(result.sample));g.dispose();
});
await test('H-DEATH/LOAD: original lifecycle clears binding; original save/new Game is defaultOFF then requires readmission',()=>{
 const g=game({kind:'quick',rank:1,level:3});target(g);rng(g,[.99,.99]);g.hurtHero(100000,'MECHANICAL_LETHAL');
 assert(g.dead);const dead=commitment(g);rng(g,[]);assert(!g.attack()?.ok);assert.deepEqual(commitment(g),dead);
 g.respawn();assert(!g.dead);assert.equal(g.hero.hp,rules.maxHP(g.hero));target(g);rng(g,[]);assert(!g.attack()?.ok);
 readmit(g);first(g,g.getCurrentTarget());const old=g.hero,item=g.hero.equipment.mainHand;g.save();assert(rules.parseSaveCollection(storage.get(rules.SAVE_KEY)));
 const loaded=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);loaded.started=true;loaded.actor.position.set(loaded.hero.x,0,loaded.hero.z);
 loaded.testFloats=[];loaded.float=(...args)=>loaded.testFloats.push({text:args[1],kind:args[2]});for(const name of ['sound','effect','ring','pulse','arc'])loaded[name]=()=>{};
 assert.notEqual(loaded.hero,old);assert.equal(loaded.hero.level,3);assert.equal(loaded.hero.equipment.mainHand,item);
 assert.equal(loaded.getDevelopmentAdventurerSkillMetadata(quickId),null);assert.equal(loaded.getDevelopmentAdventurerRanksResult(),undefined);
 readmit(loaded);first(loaded,target(loaded));g.dispose();loaded.dispose();
});

