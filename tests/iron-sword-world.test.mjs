// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.IRON_CHECKPOINT;
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
  optimizeDeps: { noDiscovery: true, entries: [] },
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'iron-world-cache'),
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
const { IRONVEIL_ID } = await load('ironveil-mines-layout');
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

const iron=await load('iron-sword-range-v2'),services=await load('city-services');
const ironId=iron.IRON_SWORD_RANGE_V2.templateId,healId='v3-adventurer-minor-heal';
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function equipIron(g){const item=items.createItem(ironId,{id:g.hero.slotId+'-iron'});g.hero.inventory.push(item);assert(g.equipItem(item.id,'mainHand'));return g.hero.inventory.find(i=>i.id===item.id);}
function legalIron({level=10,kind='quick',rank=1,allocation='neutral',heal=0,combined=false}={}){
 const g=game({optIn:false,level,kind,rank,combined});
 while((g.hero.skillLevels[healId]??0)<heal)assert(g.learnSkill(healId));
 for(let i=0,n=g.hero.statPoints;i<n&&allocation!=='neutral';i++)assert(g.allocateStatPoint(allocation==='STR'?'str':['str','vit','dex','int'][i%4]));
 equipIron(g);assert(g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true}).ok);return g;
}
await test('CATALOG exact delta: only new Iron requirement/version; preserved scalar/price/type/Training/starter',()=>{
 const c=items.ITEM_CATALOG[ironId];assert.equal(c.levelRequirement,10);assert.equal(c.authoredAttackVersion,iron.IRON_SWORD_RANGE_V2.version);
 assert.deepEqual(c.baseStats,{attack:14});assert.equal(c.buyValue,224);assert.equal(c.sellValue,52);
 assert.equal(c.rarity,'common');assert.deepEqual(c.allowedJobs,['warrior','rogue']);assert.equal(c.equipmentType,'one_hand_sword');
 assert.equal(items.ITEM_CATALOG[basic.BASIC_REFERENCE_B.templateId].levelRequirement,1);
 assert.equal(items.ITEM_CATALOG['legacy-fajar-blade'].levelRequirement,1);
 assert.equal(items.ITEM_CATALOG['field-ironveil-mines-dagger'].levelRequirement,8);
 assert(services.fieldShopStock('ironveil-mines').some(i=>i.templateId===ironId));
 assert(services.fieldShopStock(IRONVEIL_ID).some(i=>i.templateId===ironId));
});
for(const level of [8,9,10])await test('SHOP buy at Lv'+level+'; new equip gates and old legal re-equip',()=>{
 const g=game({optIn:false,kind:'quick',level});g.hero.inCity=false;g.hero.currentField=IRONVEIL_ID;g.hero.gold=1000; // Mechanical current-map shop location/funding, not quest/travel proof.
 const before=g.hero.gold;assert(services.buyFieldShopItem(g.hero,IRONVEIL_ID,ironId).ok);assert.equal(g.hero.gold,before-224);
 const item=g.hero.inventory.find(i=>i.templateId===ironId),id=item.id;
 const inventory=JSON.stringify(g.hero.inventory);assert.equal(g.equipItem(id,'mainHand'),level>=10);
 if(level<10){assert.equal(JSON.stringify(g.hero.inventory),inventory);assert(g.hero.inventory.some(i=>i.id===id));}
 const historical={...structuredClone(item),id:id+'-old',levelRequirement:8};delete historical.authoredAttackVersion;
 g.hero.inventory.push(historical);assert(g.equipItem(historical.id,'mainHand'));assert(g.unequipItem('mainHand'));assert(g.equipItem(historical.id,'mainHand'));
 assert.equal(g.hero.inventory.find(i=>i.id===historical.id).levelRequirement,8);g.dispose();
});
await test('SAVE mixed old/new inventory+storage+equipment original serializer/parser/New Game defaultOFF',()=>{
 const g=legalIron({level:10}),current=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);
 const old={...structuredClone(current),id:'old-equipped',levelRequirement:8,quantity:1,enhancementLevel:2,bonusStats:{dex:2},isEquipped:false};delete old.authoredAttackVersion;
 old.sockets=[{id:'old-socket',rune:null}];g.hero.inventory.push(old);g.hero.storage.push({...structuredClone(old),id:'old-storage'});
 assert(g.equipItem(old.id,'mainHand'));const before=structuredClone(g.hero);g.save();
 const loaded=rules.loadCharacter(g.hero.slotId);assert(loaded);
 for(const id of [current.id,old.id]){const a=before.inventory.find(i=>i.id===id),b=loaded.inventory.find(i=>i.id===id);
  for(const key of ['id','templateId','levelRequirement','baseStats','bonusStats','enhancementLevel','sockets','quantity','authoredAttackVersion'])assert.deepEqual(b[key],a[key],key);}
 assert.equal(loaded.equipment.mainHand,old.id);assert.equal(loaded.storage.find(i=>i.id==='old-storage').levelRequirement,8);
 assert.equal(loaded.storage.find(i=>i.id==='old-storage').authoredAttackVersion,undefined);
 assert.equal(iron.ironSwordAuthoredRange(loaded.inventory.find(i=>i.id===old.id)),null);
 assert.deepEqual(iron.ironSwordAuthoredRange(loaded.inventory.find(i=>i.id===current.id)),{min:32,max:36});
 const fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);assert.equal(fresh.getDevelopmentAdventurerRange(),null);
 assert(fresh.equipItem(current.id,'mainHand'));assert(fresh.enableDevelopmentAdventurerRanksReference().ok);
 assert.deepEqual(fresh.getDevelopmentAdventurerRange().value.MAIN,{min:50,max:54});fresh.dispose();g.dispose();
});
for(const marker of [undefined,null,'bad','IRON_SWORD_LV10_BASE_V0'])await test('NORMALIZE does not inherit marker '+String(marker),()=>{
 const raw=items.createItem(ironId,{id:'historical-normalize',levelRequirement:8});if(marker===undefined)delete raw.authoredAttackVersion;else raw.authoredAttackVersion=marker;
 const normalized=items.normalizeItem(JSON.parse(JSON.stringify(raw)));assert.equal(normalized.levelRequirement,8);assert.equal(iron.ironSwordAuthoredRange(normalized),null);
 assert.equal(normalized.authoredAttackVersion,marker);
});
await test('NORMALIZE missing requirement/no marker remains legacy8; requirement10 alone not new range',()=>{
 const raw=items.createItem(ironId);delete raw.authoredAttackVersion;delete raw.levelRequirement;
 const old=items.normalizeItem(raw);assert.equal(old.levelRequirement,8);assert.equal(old.authoredAttackVersion,undefined);
 raw.levelRequirement=10;assert.equal(iron.ironSwordAuthoredRange(items.normalizeItem(raw)),null);
});
for(const level of [10,14])for(const allocation of ['neutral','STR','mixed'])for(const kind of ['quick','power'])await test('ACTUAL Iron Lv'+level+' '+allocation+' '+kind+': HP/resources/independent raw/precision',()=>{
 const rank=level===14?5:3,g=legalIron({level,allocation,kind,rank}),e=target(g,{defense:40}),calls=ledger(g),draws=rng(g,[.25,0,.99]);
 const before={hp:e.hp,mana:g.hero.mana,sp:g.hero.skillPoints},[c,s,mp,cd]=table[kind][rank-1],core=7+Math.floor(level*1.1)+g.hero.allocatedStats.str;
 const expectedRaw=(core+33)*c+g.hero.allocatedStats.str*s;
 const id=kind==='quick'?quickId:powerId;assert(g.castSkill(id));const result=g.getDevelopmentAdventurerRanksResult();assert(result.ok);
 close(result.sample.totalRaw,expectedRaw);assert.deepEqual(result.execution.weaponRanges.MAIN,{min:32,max:36});close(calls[0].raw,expectedRaw);
 assert.equal(calls[0].attackerLevel,level);assert.equal(calls[0].policy,'REFERENCE_B_FINAL');assert.equal(calls.length,1);
 const final=Math.round(expectedRaw*(500+10*level)/(540+10*level));assert.equal(before.hp-e.hp,final);assert(g.testFloats.some(f=>f.kind==='damage'&&f.text===String(final)));
 assert.equal(g.hero.mana,before.mana-mp);assert.equal(g.skillCooldowns[id],cd);assert.equal(g.hero.skillPoints,before.sp);assert.equal(draws.length,3);
 const seed=g.seed,state=commitment(g);for(let i=0;i<50;i++)assert.deepEqual(g.getDevelopmentAdventurerRange().value.MAIN,{min:core+32,max:core+36});
 assert.equal(g.seed,seed);assert.deepEqual(commitment(g),state);
 const next=g.getDevelopmentAdventurerRanksResult();assert(!g.castSkill(id));assert.equal(g.hero.mana,before.mana-mp);
 evidence.push({case:level+'-'+allocation+'-'+kind,result:next,calls,draws,expectedRaw,final});g.dispose();
});
await test('CRIT once + Evade costs/no HP + lethal processing once',()=>{
 for(const outcome of ['crit','evade','lethal']){
 const g=legalIron(),e=target(g,{hp:outcome==='lethal'?1:1000,defense:0,evasion:outcome==='evade'?50:0}),calls=ledger(g);
 if(outcome==='lethal')delete e.definition;
 const draws=rng(g,outcome==='evade'?[.5,.99]:[.5,0,outcome==='crit'?0:.99]),before={hp:e.hp,kills:g.hero.kills,mana:g.hero.mana};
 assert(g.castSkill(quickId));const raw=(18+34)*1.05;
 if(outcome==='evade'){assert.equal(e.hp,before.hp);assert.equal(calls.length,0);assert.equal(draws.length,2);}
 else {assert.equal(calls.length,1);close(calls[0].raw,raw*(outcome==='crit'?1.5:1));
 assert.equal(before.hp-e.hp,Math.min(before.hp,Math.round(raw*(outcome==='crit'?1.5:1))));}
 assert.equal(g.hero.mana,before.mana-3);
 if(outcome==='lethal'){assert.equal(g.hero.kills,before.kills+1);g.skillHits.update(100);g.hurtEnemy(e,999);assert.equal(g.hero.kills,before.kills+1);}
 g.dispose();}
});
await test('Equal BASIC1/2/3: range32-36 fresh samples, timers existing, no finisher',()=>{
 const g=legalIron(),e=target(g,{defense:0}),draws=rng(g,[.1,0,.99,.2,0,.99,.3,0,.99]);
 for(let i=0;i<3;i++){const hp=e.hp,result=g.attack();assert(result.ok);close(result.sample.totalRaw,18+32+4*(i+1)/10);assert.equal(hp-e.hp,Math.round(50+4*(i+1)/10));assert.equal(g.combo,i+1);g.attackTimer=0;}
 assert.equal(draws.length,9);g.dispose(); // Timer release is offline mechanical only, not browser clock proof.
});
await test('Frozen attacker/original deferred queue uses live target defense once',()=>{
 const g=legalIron(),e=target(g,{defense:0}),calls=ledger(g);rng(g,[.5,0,.99]);
 const schedule=g.skillHits.schedule.bind(g.skillHits),pending=[];g.skillHits.schedule=(...args)=>pending.push(args);
 assert(g.castSkill(quickId));g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).authoredAttackVersion='bad';g.hero.allocatedStats.str=999;e.definition.defense=600;
 for(const args of pending)schedule(...args);close(calls[0].raw,54.6);assert.equal(1000-e.hp,Math.round(54.6*600/1200));g.dispose();
});
await test('LIFECYCLE Training/Iron/old swaps; unsupported old selected rejects no fallback/CD reset',()=>{
 const g=legalIron();target(g);rng(g,[.5,0,.99]);assert(g.castSkill(quickId));const cd=g.skillCooldowns[quickId],ironInstance=g.hero.equipment.mainHand;
 const training=g.hero.inventory.find(i=>i.templateId===basic.BASIC_REFERENCE_B.templateId);assert(g.equipItem(training.id,'mainHand'));
 assert.deepEqual(g.getDevelopmentAdventurerRange().value.MAIN,{min:27,max:29});assert(g.equipItem(ironInstance,'mainHand'));
 assert.deepEqual(g.getDevelopmentAdventurerRange().value.MAIN,{min:50,max:54});assert.equal(g.skillCooldowns[quickId],cd);
 const old={...structuredClone(g.hero.inventory.find(i=>i.id===ironInstance)),id:'legacy-swap',levelRequirement:8};delete old.authoredAttackVersion;g.hero.inventory.push(old);
 assert(g.equipItem(old.id,'mainHand'));assert(!g.getDevelopmentAdventurerRange().ok);const state=commitment(g);rng(g,[]);assert(!g.castSkill(powerId));assert.deepEqual(commitment(g),state);
 g.dispose();
});
for(const mutation of [
 item=>delete item.authoredAttackVersion,item=>item.authoredAttackVersion='bad',item=>item.levelRequirement=8,
 item=>item.enhancementLevel=1,item=>item.quantity=2,item=>item.bonusStats={str:1}
])await test('Source/shape mismatch fail closed before RNG/cost',()=>{
 const g=legalIron({kind:'power'});target(g);mutation(g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand));const state=commitment(g),draws=rng(g,[]);
 assert(!g.castSkill(powerId));assert.deepEqual(commitment(g),state);assert.equal(draws.length,0);g.dispose();
});
await test('Duplicate/replacement item identity rejects before sampling',()=>{
 for(const replace of [false,true]){const g=legalIron({kind:'power'});target(g);const item=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);
 if(replace)g.hero.inventory=g.hero.inventory.map(i=>i===item?{...item}:i);else g.hero.inventory.push({...item});
 rng(g,[]);const before=commitment(g);assert(!g.castSkill(powerId));assert.deepEqual(commitment(g),before);g.dispose();}
});
for(const u of [NaN,Infinity,1,-.1,new Error('MECHANICAL RNG')])await test('Bad RNG attempted once without payment/queue '+String(u),()=>{
 const g=legalIron();target(g);const before=commitment(g),draws=rng(g,[u]);
 if(u instanceof Error)assert.throws(()=>g.castSkill(quickId),error=>error===u);else assert(!g.castSkill(quickId));
 assert.equal(draws.length,1);assert.deepEqual(commitment(g),before);g.dispose();
});
await test('Full Lv14 Q5/P5/H3 + mixed budget, Heal percent/clamp no attack, death/respawn CD and saveOFF',()=>{
 const g=legalIron({level:14,combined:true,heal:3,allocation:'mixed'}),e=target(g);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,13);assert.equal(g.hero.skillPoints,1);assert.equal(g.hero.statPoints,0);
 rng(g,[.99,.99]);g.hurtHero(40,'MECHANICAL');const hp=g.hero.hp,mp=g.hero.mana,max=rules.derivedStats(structuredClone(g.hero)).maxHP;const draws=rng(g,[]);
 assert(g.castSkill(healId));assert.equal(g.hero.hp-hp,Math.min(Math.round(max*.1),max-hp));assert.equal(g.hero.mana,mp-12);assert.equal(draws.length,0);assert.equal(e.hp,e.max);
 const cd=g.skillCooldowns[healId];
 // A separate original lethal case avoids the prior hit's real invincibility window.
 const death=legalIron({level:14,combined:true,heal:3,allocation:'mixed'});
 target(death);rng(death,[.5,0,.99]);assert(death.castSkill(quickId));const deathCD=death.skillCooldowns[quickId];
 rng(death,[.99,.99]);death.hurtHero(100000,'MECHANICAL_LETHAL');assert(death.dead);death.respawn();
 assert.equal(death.skillCooldowns[quickId],deathCD);assert(death.getDevelopmentAdventurerRange().ok);death.dispose();
 assert.equal(g.skillCooldowns[healId],cd);assert(g.getDevelopmentAdventurerRange().ok);g.save();const loaded=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);
 assert.equal(loaded.getDevelopmentAdventurerRange(),null);assert.equal(loaded.hero.skillLevels[healId],3);assert.deepEqual(loaded.hero.allocatedStats,g.hero.allocatedStats);
 loaded.dispose();g.dispose();
});
await test('DefaultOFF Iron remains legacy; standalone Lv1 Basic/R1 permission unchanged',()=>{
 const g=game({optIn:false,kind:'quick',level:10});equipIron(g);target(g);assert.equal(g.getDevelopmentAdventurerRange(),null);
 assert(!g.enableDevelopmentBasicReferenceB().ok);assert(!g.enableDevelopmentQuickSlashReference().ok);assert(!g.enableDevelopmentPowerStrikeReference().ok);g.dispose();
});
