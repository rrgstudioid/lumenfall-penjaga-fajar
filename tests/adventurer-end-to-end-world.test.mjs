// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.ADVENTURER_E2E_CHECKPOINT;
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
const reference = await load('adventurer-ranks-reference-v2');
const basic = await load('basic-attack-reference-v2');
const { ADVENTURER_V3_RUNTIME_SKILLS } = await load('adventurer-v3');
const {resolveSkillPresentation}=await load('skill-presentation-v3');
const {ADVENTURER_V3_SKILLS}=await load('adventurer-v3');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {}, reset() {} }, ready: Promise.resolve(true), dispose() {} };
  this.testAnimations = [];
};
let serial = 0;
const quickId='v3-adventurer-quick-slash',powerId='v3-adventurer-power-strike';
const levels={quick:[1,3,6,9,13],power:[2,7,10,12,14]};
const table={quick:[[1.05,.02,3,3.2],[1.08,.03,3,3.1],[1.12,.04,4,3],[1.16,.05,4,2.9],[1.20,.06,5,2.8]],
 power:[[1.20,.04,5,6],[1.26,.05,5,5.75],[1.32,.06,6,5.5],[1.38,.07,6,5.25],[1.45,.08,7,5]]};
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
function rejected(g, draws = []) {
  const before = commitment(g), random = rng(g, draws), accepted = g.castSkill(reference.ADVENTURER_RANKS_REFERENCE.skills[1]);
  const result = g.getDevelopmentAdventurerRanksResult(); assert.equal(accepted, false);
  assert.deepEqual(commitment(g), before, 'rejection cannot commit actor/resources/presentation');
  assert.equal(random.length, draws.length);
  return result;
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);



const healId='v3-adventurer-minor-heal';
function deferRealQueue(g){const original=g.skillHits.schedule.bind(g.skillHits),entries=[];g.skillHits.schedule=(...args)=>{entries.push(args);};return {flush(){for(const args of entries.splice(0))original(...args);}};}
function allocate(g,stat,count){for(let i=0;i<count;i++)assert(g.allocateStatPoint(stat));}
function readmit(g){const r=g.enableDevelopmentAdventurerRanksReference();assert(r.ok,JSON.stringify(r));return r;}
function observed(g){return {level:g.hero.level,allocated:{...g.hero.allocatedStats},points:g.hero.statPoints,ranks:{...g.hero.skillLevels},earned:g.hero.skillProgressionV3.totalEarnedSP,available:g.hero.skillPoints};}
for(const kind of ['quick','power'])for(let rank=1;rank<=5;rank++){
 for(const allocation of ['neutral','STR'])await test('E-DAMAGE '+kind+' R'+rank+' '+allocation+': legal progression, allocation, hotbar, actual HP/feedback/resources',()=>{
  const g=game({kind,rank}),id=kind==='quick'?quickId:powerId;
  const points=g.hero.statPoints;if(allocation==='STR')allocate(g,'str',points);
  readmit(g);assert(g.assignPrimaryHotbarSlot(0,id));readmit(g);
  const e=target(g,{defense:37}),calls=ledger(g),draws=rng(g,[.25,0,.99]);
  const [c,s,mp,cd]=table[kind][rank-1],bonus=allocation==='STR'?points:0;
  const expectedRaw=(7+Math.floor(g.hero.level*1.1)+bonus+9.5)*c+bonus*s;
  const beforeMP=g.hero.mana,beforeHP=e.hp,sp=g.hero.skillPoints;
  assert(g.usePrimaryHotbarSlot(0));const result=g.getDevelopmentAdventurerRanksResult();assert(result.ok);
  close(result.sample.totalRaw,expectedRaw);assert.equal(calls.length,1);assert.equal(calls[0].attackerLevel,g.hero.level);
  const final=Math.round(expectedRaw*(500+10*g.hero.level)/(537+10*g.hero.level));
  assert.equal(beforeHP-e.hp,final);assert(g.testFloats.some(f=>f.text===String(final)&&f.kind==='damage'));
  assert.equal(beforeMP-g.hero.mana,mp);assert.equal(g.skillCooldowns[id],cd);assert.equal(g.hero.skillPoints,sp);
  assert.deepEqual(draws,[.25,0,.99]);assert.equal(g.skillHits.size,0);
  const committed=commitment(g);assert.equal(g.usePrimaryHotbarSlot(0),false);assert.deepEqual(commitment(g),committed);assert.equal(draws.length,3);
  evidence.push({case:'damage',kind,rank,allocation,actor:observed(g),raw:expectedRaw,final,mp,cd,calls,draws});
 });
}
for(const stat of ['str','vit','dex','int','mixed'])await test('E-CONTRAST '+stat+': legal allocation and resolved primary/resource effects',()=>{
 const g=game({kind:'quick',rank:5}),points=g.hero.statPoints,base=rules.derivedStats(structuredClone(g.hero));
 if(stat==='mixed'){for(let i=0;i<points;i++)allocate(g,['str','vit','dex','int'][i%4],1);}else allocate(g,stat,points);
 readmit(g);target(g);rng(g,[.5,0,.99]);const stats=rules.derivedStats(structuredClone(g.hero));
 assert(g.castSkill(quickId));const result=g.getDevelopmentAdventurerRanksResult();
 const str=g.hero.allocatedStats.str;close(result.sample.totalRaw,(7+Math.floor(g.hero.level*1.1)+str+10)*1.2+str*.06);
 assert.equal(g.hero.statPoints,0);assert.equal(stats.str,15+g.hero.allocatedStats.str);assert.equal(stats.vit,15+g.hero.allocatedStats.vit);
 if(stat==='vit')assert(stats.maxHP>base.maxHP);if(stat==='int')assert(stats.maxMana>base.maxMana);if(stat==='dex'){assert(stats.accuracy>base.accuracy);assert(stats.criticalRate>base.criticalRate);}
 evidence.push({case:'contrast',stat,allocation:g.hero.allocatedStats,raw:result.sample.totalRaw,baseStats:base,derived:stats});
});
function healGame(rank,{vit=false}={}){
 const g=game({kind:'quick',rank:1,level:[2,8,14][rank-1]});
 for(let i=0;i<rank;i++)assert(g.learnSkill(healId));
 if(vit)allocate(g,'vit',g.hero.statPoints);readmit(g);assert(g.assignPrimaryHotbarSlot(2,healId));readmit(g);
 return g;
}
for(let rank=1;rank<=3;rank++)for(const variant of ['full-amount','clamp','full-HP'])await test('E-HEAL R'+rank+' '+variant+': original incoming damage/self-heal, no attack/Crit',()=>{
 const g=healGame(rank,{vit:true}),max=rules.maxHP(g.hero),amount=Math.round(max*[6,8,10][rank-1]/100),enemy=target(g),calls=ledger(g);
 if(variant!=='full-HP'){
  rng(g,[.99,.99]);g.hurtHero(variant==='clamp'?1:amount*3,'MECHANICAL_INCOMING');assert(!g.dead);assert(g.hero.hp<max);
 }
 const before=g.hero.hp,enemyHP=enemy.hp,mp=g.hero.mana,draws=rng(g,[]);
 const expected=Math.min(amount,max-before);g.clearCurrentTarget();
 assert(g.usePrimaryHotbarSlot(2));close(g.hero.hp-before,expected);
 assert.equal(mp-g.hero.mana,[8,10,12][rank-1]);assert.equal(g.skillCooldowns[healId],[30,28,26][rank-1]);
 assert.equal(draws.length,0);assert.equal(calls.length,0);assert.equal(enemy.hp,enemyHP);
 const state=commitment(g);assert.equal(g.castSkill(healId),false);assert.deepEqual(commitment(g),state);
 evidence.push({case:'heal',rank,variant,max,amount,hpGain:expected,mpDelta:mp-g.hero.mana,actor:observed(g)});
});
await test('E-FULL-KIT Lv14 Q5/P5/H3 paid ledger, allocation, hotbar and actual save/NEW Game roundtrip',()=>{
 const g=game({level:14,combined:true});for(let i=0;i<3;i++)assert(g.learnSkill(healId));
 for(let i=0;i<26;i++)allocate(g,['str','vit','dex','int'][i%4],1);
 for(const [i,id]of [quickId,powerId,healId].entries())assert(g.assignPrimaryHotbarSlot(i,id));
 readmit(g);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,13);assert.equal(g.hero.skillPoints,1);
 const state=observed(g),hotbar=[...g.hero.primaryHotbar],itemId=g.hero.equipment.mainHand,oldHero=g.hero;g.save();
 const collectionBytes=storage.get(rules.SAVE_KEY);assert(collectionBytes&&rules.parseSaveCollection(collectionBytes));
 const loaded=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);loaded.started=true;loaded.actor.position.set(loaded.hero.x,0,loaded.hero.z);
 for(const name of ['sound','effect','ring','pulse','arc'])loaded[name]=()=>{};
 loaded.testFloats=[];loaded.float=(...args)=>loaded.testFloats.push({text:args[1],kind:args[2]});
 assert.notEqual(loaded.hero,oldHero);assert.deepEqual(observed(loaded),state);assert.deepEqual(loaded.hero.primaryHotbar,hotbar);
 assert.equal(loaded.hero.equipment.mainHand,itemId);const item=loaded.hero.inventory.find(i=>i.id===itemId);assert(item?.isEquipped&&item.mainHand);
 assert.equal(loaded.getDevelopmentAdventurerSkillMetadata(quickId),null);assert.equal(loaded.getDevelopmentAdventurerRanksResult(),undefined);
 readmit(loaded);const e=target(loaded),calls=ledger(loaded);rng(loaded,[.5,0,.99,.5,0,.99]);
 assert(loaded.usePrimaryHotbarSlot(0));assert(loaded.usePrimaryHotbarSlot(1));assert.equal(calls.length,2);assert(e.hp<e.max);
 assert.equal(loaded.hero.skillPoints,1);assert.equal(loaded.hero.skillLevels[healId],3);
 evidence.push({case:'roundtrip',state,itemId,hotbar,storageKeys:[...storage.keys()],bytes:collectionBytes.length,loaded:observed(loaded),calls});
});
await test('E-DEATH original hurtHero / respawn clears queue/input; keeps rank/stat/item/hotbar, requires readmission',()=>{
 const g=healGame(1),e=target(g);assert(g.assignPrimaryHotbarSlot(0,quickId));readmit(g);g.keys.add('w');
 const h=observed(g),item=g.hero.equipment.mainHand,bar=[...g.hero.primaryHotbar],mp=g.hero.mana;
 rng(g,[.99,.99]);g.hurtHero(100000,'MECHANICAL_LETHAL');assert(g.dead);assert.equal(g.hero.hp,0);assert.equal(g.keys.size,0);assert.equal(g.skillHits.size,0);
 const deadState=commitment(g);rng(g,[]);assert.equal(g.castSkill(healId),false);assert.equal(g.castSkill(quickId),false);assert.deepEqual(commitment(g),deadState);
 g.respawn();assert.equal(g.dead,false);assert.equal(g.hero.hp,rules.maxHP(g.hero));assert.equal(g.hero.mana,mp);
 assert.deepEqual(observed(g),h);assert.equal(g.hero.equipment.mainHand,item);assert.deepEqual(g.hero.primaryHotbar,bar);
 rng(g,[]);assert.equal(g.castSkill(quickId),false);assert.equal(g.getDevelopmentAdventurerRanksResult().code,'REFERENCE_REBIND_REQUIRED');
 readmit(g);g.actor.position.set(g.hero.x,0,g.hero.z);e.group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));assert(g.setCurrentTarget(e));rng(g,[.5,0,.99]);assert(g.castSkill(quickId));
 evidence.push({case:'death-respawn',actor:observed(g),hp:g.hero.hp,mana:g.hero.mana,hotbar:bar});
});
for(const [name,change]of Object.entries({
 negative:g=>g.hero.allocatedStats.str=-1,fraction:g=>g.hero.allocatedStats.str=.5,missing:g=>delete g.hero.allocatedStats.int,
 budget:g=>g.hero.statPoints++,foreign:g=>g.hero.allocatedStats.luck=0,overflow:g=>g.hero.allocatedStats.str=Number.MAX_SAFE_INTEGER+1,
 healGrant:g=>g.hero.skillProgressionV3.grantedRanks[healId]=1,healMirror:g=>g.hero.skillLevels[healId]=3,
 staleAllocation:g=>{assert(g.allocateStatPoint('str'));},bonus:g=>g.hero.activeBuffs['MECHANICAL_UNKNOWN']=1,
})){await test('E-INVALID '+name+': no draw/resource/commit',()=>{const g=game();target(g);change(g);rejected(g);});}
await test('E-CD/readmission after legitimate allocation cannot bypass CD; heal lowMana/dead/action reject',()=>{
 const g=game();target(g);rng(g,[.5,0,.99]);assert(g.castSkill(powerId));const cd=g.skillCooldowns[powerId];assert(g.allocateStatPoint('str'));readmit(g);
 assert.equal(g.skillCooldowns[powerId],cd);rejected(g);
 for(const issue of ['mana','dead','action']){const h=healGame(1);if(issue==='mana')h.hero.mana=0;if(issue==='dead')h.dead=true;if(issue==='action')h.actionLock.start(h.combatTime,10,false);
  const state=commitment(h);rng(h,[]);assert.equal(h.castSkill(healId),false);assert.deepEqual(commitment(h),state);}
});
await test('E-PRESENTATION static selected-version coeff/heal percent, no BaseRoll/current damage preview; default remains legacy',()=>{
 const g=game({kind:'quick',rank:5});for(let i=0;i<3;i++){while(g.hero.level<14)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));assert(g.learnSkill(healId));}readmit(g);
 for(const i of [0,2]){const def=ADVENTURER_V3_SKILLS[i],runtime=ADVENTURER_V3_RUNTIME_SKILLS[i],meta=g.getDevelopmentAdventurerSkillMetadata(def.id),detail=resolveSkillPresentation(g.hero,def,runtime,meta);
 assert(!detail.damage.some(row=>row.label==='Base Damage'));assert(!JSON.stringify(detail).includes('Current Damage'));assert.equal(meta.version,reference.ADVENTURER_RANKS_REFERENCE.version);assert(!detail.specialMechanics.some(row=>row.value===meta.version));assert(detail.specialMechanics.some(row=>row.label==='Formula'));
 if(i===0)assert(detail.damage.some(row=>row.value==='×1.20'));else assert(detail.damage.some(row=>row.value.startsWith('10% MaxHP')));}
 const ordinary=game({optIn:false});assert.equal(ordinary.getDevelopmentAdventurerSkillMetadata(quickId),null);
 assert(resolveSkillPresentation(ordinary.hero,ADVENTURER_V3_SKILLS[0],ADVENTURER_V3_RUNTIME_SKILLS[0]).damage.some(row=>row.label==='Base Damage'));
});

for(const kind of ['quick','power'])await test('E-ALLOCATED '+kind+' Crit/Evade/lethal through original impact and final rounding',()=>{
 for(const outcome of ['crit','evade','lethal']){
 const g=game({kind,rank:5}),id=kind==='quick'?quickId:powerId;allocate(g,'str',g.hero.statPoints);readmit(g);
 const e=target(g,{defense:40,hp:outcome==='lethal'?1:1000,evasion:outcome==='evade'?50:0}),calls=ledger(g);
 if(outcome==='lethal')Object.assign(e.definition,{id:'mechanical-offline',level:g.hero.level,variant:'normal',exp:0,dropRate:0});
 const draws=rng(g,outcome==='evade'?[.25,.99]:[.25,0,outcome==='crit'?0:.99,...(outcome==='lethal'?[.99]:[])]);
 const mp=g.hero.mana,kills=g.hero.kills,str=g.hero.allocatedStats.str,[c,s,cost]=table[kind][4],raw=(7+Math.floor(g.hero.level*1.1)+str+9.5)*c+str*s;
 assert(g.castSkill(id));close(g.getDevelopmentAdventurerRanksResult().sample.totalRaw,raw);assert.equal(mp-g.hero.mana,cost);
 if(outcome==='evade'){assert.equal(e.hp,1000);assert.equal(calls.length,0);assert.equal(draws.length,2);}
 else{const expected=Math.round(raw*(outcome==='crit'?1.5:1)*(500+10*g.hero.level)/(540+10*g.hero.level));assert.equal(calls.length,1);
 assert.equal(calls[0].hpDelta,outcome==='lethal'?1:expected);assert(g.testFloats.some(f=>f.kind==='damage'&&f.text===String(expected)));
 if(outcome==='lethal'){assert.equal(g.hero.kills,kills+1);g.skillHits.update(20);assert.equal(g.hero.kills,kills+1);}}
 evidence.push({case:'allocated-outcome',kind,outcome,raw,calls,draws});
 }
});
await test('E-FROZEN allocated attacker snapshot and live target defense; no reroll',()=>{
 const g=game({kind:'power',rank:5});allocate(g,'str',5);readmit(g);const e=target(g),calls=ledger(g),queue=deferRealQueue(g),draws=rng(g,[.25,0,.99]);
 assert(g.castSkill(powerId));const raw=(7+Math.floor(14*1.1)+5+9.5)*1.45+5*.08;
 // In-place fixture mutation AFTER commitment is not a newly admitted actor.
 g.hero.allocatedStats.str=99;e.definition.defense=200;queue.flush();
 close(calls[0].raw,raw);assert.equal(calls[0].hpDelta,Math.round(raw*640/840));assert.equal(draws.length,3);assert.equal(g.skillHits.size,0);
});
await test('E-INVALID allocation consumer rejects unknown stat/no points; Minor null/rank/ledger remain fail closed',()=>{
 const g=game();const before=JSON.stringify(g.hero);assert.equal(g.allocateStatPoint('luck'),false);assert.equal(JSON.stringify(g.hero),before);
 allocate(g,'str',2);const exhausted=JSON.stringify(g.hero);assert.equal(g.allocateStatPoint('str'),false);assert.equal(JSON.stringify(g.hero),exhausted);
 for(const value of [null,-1,4,.5]){const bad=game();bad.hero.skillProgressionV3.skillRanks[healId]=value;bad.hero.skillLevels[healId]=value;assert.equal(bad.enableDevelopmentAdventurerRanksReference().ok,false);}
});

