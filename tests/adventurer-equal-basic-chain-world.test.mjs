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
      setPixelRatio(v){this.pixelRatio=v;} getPixelRatio(){return this.pixelRatio??1;} setSize(){} render(){} dispose(){} forceContextLoss(){} }`; },
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
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance', 'drawMap'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {}, reset() {} }, ready: Promise.resolve(true), updateVisual(){}, dispose() {} };
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
// Actual Game.tick advances timers/combat clock. Only rendering/environment seams
// are stubbed offline; no positive case resets a timer or presentation index.
function advance(g,seconds){
 g.crystal??=new T.Mesh();g.testTime??=1000;
 if(!g.lastTime)g.tick(g.testTime);
 for(let remaining=seconds;remaining>1e-10;){const dt=Math.min(.02,remaining);g.testTime+=dt*1000;g.tick(g.testTime);remaining-=dt;}
}
function event(g,e,u=.25,{hit=0,crit=.99}={}){
 if(e.hp===1){e.definition.dropRate=0;e.definition.exp=0;e.definition.lootTable=[];}
 const lethal=e.hp===1;
 const before={hp:e.hp,mana:g.hero.mana,sp:g.hero.skillPoints,clock:g.combatTime},draws=rng(g,lethal?[u,hit,crit,.99]:[u,hit,crit]);
 const floats=g.testFloats.length,calls=ledger(g),result=g.attack();assert(result?.ok,JSON.stringify(result));
 const raw=7+Math.floor(g.hero.level*1.1)+g.hero.allocatedStats.str+9+2*u;
 close(result.sample.totalRaw,raw);const missed=hit===.99&&e.evasion===1000;
 const multiplier=crit===0?rules.derivedStats(structuredClone(g.hero)).criticalDamage/100:1;
 const final=missed?0:Math.round(raw*multiplier*(500+10*g.hero.level)/(500+10*g.hero.level+e.definition.defense));
 assert.equal(before.hp-e.hp,Math.min(before.hp,final));assert.equal(calls.length,missed?0:1);
 if(!missed)assert(g.testFloats.slice(floats).some(f=>f.text===String(final)&&f.kind==='damage'));
 assert.equal(before.mana,g.hero.mana);assert.equal(before.sp,g.hero.skillPoints);assert.equal(draws.length,missed?2:lethal?4:3);
 evidence.push({case:'equal-chain',level:g.hero.level,allocation:{...g.hero.allocatedStats},index:g.combo,raw,final,before,timer:g.attackTimer,window:g.comboWindow,draws,calls,result});
 return {raw,final,timer:g.attackTimer,clock:g.combatTime,result};
}
function ready(g){advance(g,g.attackTimer+.02);assert.equal(g.attackTimer,0);}
for(let level=1;level<=14;level++)for(const allocation of ['neutral','STR','mixed'])await test('E-CYCLE Lv'+level+' '+allocation+': real tick 1/2/3/1; same u equal RAW/HP',()=>{
 const g=game({kind:'quick',rank:1,level});const points=g.hero.statPoints;
 for(let i=0;i<points&&allocation!=='neutral';i++)assert(g.allocateStatPoint(allocation==='STR'?'str':['str','vit','dex','int'][i%4]));readmit(g);
 const e=target(g,{defense:40,hp:10000});e.attack=0;e.movementSpeed=0;
 const rows=[];for(const index of [1,2,3,1,2,3,1]){rows.push(event(g,e));assert.equal(g.combo,index);ready(g);}
 assert(rows.every(r=>r.raw===rows[0].raw&&r.final===rows[0].final));assert(rows[2].timer>rows[1].timer);
 for(let i=1;i<rows.length;i++){close(rows[i].clock-rows[i-1].clock,rows[i-1].timer+.02);assert(rows[i].clock-rows[i-1].clock<1.1);}
 g.dispose();
});
await test('E-INDEPENDENT: different u on each event, no cached roll or finisher; rapid reject and natural expiry',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{defense:40});e.attack=0;e.movementSpeed=0;
 const rows=[];for(const u of [.01,.25,.75,.99]){rows.push(event(g,e,u));const before=commitment(g);rng(g,[]);assert(!g.attack()?.ok);assert.deepEqual(commitment(g),before);ready(g);}
 assert.equal(new Set(rows.map(r=>r.result.execution.executionId)).size,4);assert.equal(new Set(rows.map(r=>r.raw)).size,4);
 advance(g,1.2);event(g,e);assert.equal(g.combo,1);g.dispose();
});
for(const malformed of [0,4,-1,NaN,Infinity,1.5])await test('E-MALFORMED '+malformed+': no modulo repair / no draw or mutation',()=>{
 const g=game({kind:'quick',rank:1});target(g);g.combo=malformed;g.comboWindow=1;const before=commitment(g),draws=rng(g,[]);
 assert.equal(g.attack().code,'UNSUPPORTED_COMBO');assert.deepEqual(commitment(g),before);assert.equal(draws.length,0);g.dispose();
});
for(const outcome of ['crit','evade','lethal'])for(const index of [1,2,3])await test('E-OUTCOME '+outcome+' index'+index+': one actual impact/death or no-hit; no reroll',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{defense:40,hp:10000});e.attack=0;e.movementSpeed=0;
 for(let i=1;i<index;i++){event(g,e);ready(g);}
 if(outcome==='evade')e.evasion=1000;if(outcome==='lethal')e.hp=1;
 const kills=g.hero.kills;event(g,e,.25,{hit:outcome==='evade'?.99:0,crit:outcome==='crit'?0:.99});assert.equal(g.combo,index);
 if(outcome==='lethal'){assert.equal(g.hero.kills,kills+1);assert.equal(e.hp,0);assert.equal(g.hurtEnemy(e,100,0,'physical'),0);assert.equal(g.hero.kills,kills+1);}
 g.dispose();
});
await test('E-POINTER: original hard-target pointer-down / hold / release / switch policy; no tick replay',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{hp:10000});e.attack=0;e.movementSpeed=0;
 // Offline only: ray picking and pointer projection are render lookup stubs.
 // Original pointer handler, selection, attack, tick and HP consumer are real.
 g.pointermove=()=>{};g.tryNpcInteraction=()=>false;g.pickEnemy=()=>e;
 const pointer={target:g.renderer.domElement,defaultPrevented:false,button:0};
 const draws=rng(g,[.25,0,.99]);g.handleWorldPointerDown(pointer);
 assert.equal(g.combo,1);assert.equal(g.attacking,false);advance(g,1.5);
 assert.equal(draws.length,3);assert.equal(g.combo,1);const hp=e.hp;
 g.pointerup(pointer);advance(g,.2);assert.equal(e.hp,hp);
 const other=target(g,{hp:10000});other.attack=0;other.movementSpeed=0;g.pickEnemy=()=>e;
 rng(g,[]);g.handleWorldPointerDown(pointer);assert.equal(g.getCurrentTarget(),e);assert.equal(e.hp,hp);
 const before=commitment(g);g.paused=true;g.handleWorldPointerDown(pointer);g.paused=false;assert.deepEqual(commitment(g),before);
 g.pickEnemy=()=>undefined;g.handleWorldPointerDown(pointer);assert.equal(g.getCurrentTarget(),undefined);g.dispose();
});
await test('E-REWARD-LEVEL: actual lethal XP replaces budget applicability; explicit readmission uses new level once',()=>{
 const g=game({kind:'quick',rank:1}),e=target(g,{defense:40,hp:1});
 Object.assign(e.definition,{level:1,exp:rules.xpNeeded(1),dropRate:0,lootTable:[]});
 const kills=g.hero.kills,calls=ledger(g);rng(g,[.25,0,.99,.99]);const first=g.attack();assert(first.ok);
 close(first.sample.totalRaw,17.5);assert.equal(calls[0].attackerLevel,1);assert.equal(g.hero.level,2);
 assert.equal(g.hero.kills,kills+1);assert.equal(g.hero.statPoints,2);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,1);
 assert.equal(g.hurtEnemy(e,100,0,'physical'),0);assert.equal(g.hero.kills,kills+1);
 const next=target(g,{defense:40,hp:10000});next.attack=0;next.movementSpeed=0;ready(g);
 const before=commitment(g);rng(g,[]);assert(!g.attack().ok);assert.deepEqual(commitment(g),before);
 readmit(g);const second=event(g,next);close(second.raw,18.5);assert.equal(calls.at(-1).attackerLevel,2);g.dispose();
});
await test('E-FULLKIT: original skill/heal consumer between basic events, CDs/SP isolated and clone/rebind/death/load',()=>{
 const g=game({combined:true,level:14});for(let i=0;i<3;i++)assert(g.learnSkill(healId));for(let i=0;i<26;i++)assert(g.allocateStatPoint(['str','vit','dex','int'][i%4]));readmit(g);
 const e=target(g,{defense:40,hp:10000});e.attack=0;e.movementSpeed=0;event(g,e);ready(g);
 rng(g,[.25,0,.99]);assert(g.castSkill(quickId));const cd=g.skillCooldowns[quickId];event(g,e);assert.equal(g.combo,2);assert.equal(g.skillCooldowns[quickId],cd);
 ready(g);rng(g,[.25,0,.99]);assert(g.castSkill(powerId));event(g,e);assert.equal(g.combo,3);ready(g);
 rng(g,[]);assert(g.castSkill(healId));assert.equal(g.hero.skillPoints,1);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,13);event(g,e);assert.equal(g.combo,1);
 g.save();const old=g.hero;g.dispose();const loaded=new Game(element(),element(),element(),()=>{},()=>{},old.slotId);loaded.started=true;loaded.actor.position.set(loaded.hero.x,0,loaded.hero.z);
 loaded.testFloats=[];loaded.float=(...a)=>loaded.testFloats.push({text:a[1],kind:a[2]});for(const n of ['sound','effect','ring','pulse','arc'])loaded[n]=()=>{};
 assert.notEqual(loaded.hero,old);assert.equal(loaded.combo,0);assert.equal(loaded.attackTimer,0);assert.equal(loaded.getDevelopmentAdventurerSkillMetadata(quickId),null);readmit(loaded);
 const b=target(loaded,{hp:10000});b.attack=0;b.movementSpeed=0;for(const index of [1,2,3,1]){event(loaded,b);assert.equal(loaded.combo,index);ready(loaded);}loaded.dispose();
});

