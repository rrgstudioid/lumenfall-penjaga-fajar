// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.ADVENTURER_RANKS_CHECKPOINT;
const storage = new Map();
const memory = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), remove() {},
  getContext: () => ({ clearRect() {}, fillRect() {} }) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline-basic' }, addEventListener() {}, removeEventListener() {} },
  document: { createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {}, requestAnimationFrame: () => 0 });
const server = await createServer({ configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] },
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
const reference = await load('adventurer-ranks-reference-v2');
const basic = await load('basic-attack-reference-v2');
const { ADVENTURER_V3_RUNTIME_SKILLS } = await load('adventurer-v3');
const foundation = await load('attack-range-v2');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {} }, ready: Promise.resolve(true), updateVisual() {}, dispose() {} };
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


const skillId = reference.ADVENTURER_RANKS_REFERENCE.skills[1];
function withoutLegacyRandom(work) {
  const saved = Math.random;
  Math.random = () => {
    const stack = new Error().stack;
    // UI snapshot previews remain legacy and Three uses random UUIDs. Neither
    // produces combat damage. Reject any BaseRoll in the CAST/IMPACT resolver.
    if (stack.includes('resolveSkillAction') && !stack.includes('Game.snapshot'))
      throw new Error('Legacy BaseRoll draw forbidden on reference combat path');
    return saved();
  };
  try { return work(); } finally { Math.random = saved; }
}
function cast(g) {
  return withoutLegacyRandom(() => {
    const accepted = g.castSkill(skillId), result = g.getDevelopmentAdventurerRanksResult();
    assert.equal(accepted, result.ok); return result;
  });
}
function deferRealQueue(g) {
  const original = g.skillHits.schedule.bind(g.skillHits), entries = [];
  g.skillHits.schedule = (...args) => { entries.push(args); };
  return { entries, flush: () => { for (const args of entries.splice(0)) original(...args); } };
}

await test('C01 legal Lv2 paid R1/equip/cast/apply/queue: raw22.8, HP/feedback20, MP5/CD6 once, SP unchanged', () => {
  const g = game(), e = target(g), calls = ledger(g), draws = rng(g, [.5, 0, .99]);
  const originalQueue = g.skillHits.schedule.bind(g.skillHits), queues = [];
  g.skillHits.schedule = (...args) => { queues.push(args[0]); return originalQueue(...args); };
  const before = { hp: e.hp, mana: g.hero.mana, sp: g.hero.skillPoints, progression: structuredClone(g.hero.skillProgressionV3) };
  const result = cast(g); assert(result.ok); close(result.sample.totalRaw, 22.8);
  assert.deepEqual(result.execution.weaponRanges.MAIN, { min: 9, max: 11 });
  assert.deepEqual(result.execution.hits[0].attack, { min: 18, max: 20 });
  assert.equal(result.execution.coefficientBudget, 1.20); assert.equal(result.execution.scalingBudget, 0);
  assert.equal(calls[0].attackerLevel, 2);
  assert.deepEqual(g.hero.allocatedStats, { str:0, vit:0, dex:0, int:0 });
  assert.equal(g.hero.statPoints, 2);
  assert.equal(result.execution.instances.MAIN.instanceId, g.hero.equipment.mainHand);
  assert.equal(result.execution.owner.actorId, g.hero.characterId);
  assert.equal(queues.length, 1); assert.equal(queues[0].length, 1); assert.equal(queues[0][0].delay, 0);
  assert.equal(queues[0][0].baseDamage, 0); assert.equal(queues[0][0].physicalCoefficient, 0);
  assert.equal(queues[0][0].damageMultiplier, 1); assert.equal(queues[0][0].knockbackStrength, 0);
  close(calls[0].raw, 22.8); assert.equal(calls.length, 1); assert.equal(calls[0].policy, 'REFERENCE_B_FINAL');
  const expected = Math.round(22.8 * 520 / 590);
  assert.equal(before.hp - e.hp, expected); assert.equal(expected, 20);
  assert(g.testFloats.some(f => f.kind === 'damage' && f.text === String(expected)));
  assert.deepEqual(draws, [.5, 0, .99]); assert.equal(g.hero.mana, before.mana - 5);
  assert.equal(g.skillCooldowns[skillId], 6); assert.equal(g.hero.skillPoints, before.sp);
  assert.deepEqual(g.hero.skillProgressionV3, before.progression);
  assert.equal(g.skillHits.size, 0); g.skillHits.update(10); assert.equal(calls.length, 1);
  evidence.push({ case: 'C01', result, draws, calls, feedback: g.testFloats, manaDelta: 5, cooldown: g.skillCooldowns[skillId] });
});
await test('C02 u=.25 preserves raw22.2 through defense, final21 distinguishes early round20', () => {
  const g = game(), e = target(g, { defense: 40 }), calls = ledger(g); rng(g, [.25, 0, .99]);
  const hp = e.hp, result = cast(g); assert(result.ok); close(result.sample.totalRaw, 22.2);
  close(calls[0].raw, 22.2); const expected = Math.round(22.2 * 520 / 560);
  assert.equal(expected, 21); assert.notEqual(expected, Math.round(Math.round(22.2) * 520 / 560));
  assert.equal(hp - e.hp, expected); assert(g.testFloats.some(f => f.text === '21' && f.kind === 'damage'));
  evidence.push({ case: 'C02', result, calls, expected });
});
await test('C03 allowed physical Crit once; raw34.2 then normal mitigation/final30', () => {
  const g = game(), e = target(g, { defense: 70 }), calls = ledger(g), draws = rng(g, [.5, 0, 0]);
  const hp = e.hp; assert(cast(g).ok); close(calls[0].raw, 22.8 * 1.5);
  assert.equal(hp - e.hp, Math.round(22.8 * 1.5 * 520 / 590)); assert.equal(calls.length, 1);
  assert.equal(draws.length, 3); assert(g.testFloats.some(f => f.text === '30' && f.kind === 'damage'));
  evidence.push({ case: 'C03', draws, calls, feedback: g.testFloats });
});
await test('C04 evade pays one cast but no Crit/HP/status/proc/death and no attack reroll', () => {
  const g = game(), e = target(g, { evasion: 50 }), calls = ledger(g), draws = rng(g, [.5, .99]);
  const hp = e.hp, kills = g.hero.kills, status = structuredClone(e.statusEffects), mana = g.hero.mana;
  assert(cast(g).ok); assert.equal(e.hp, hp); assert.equal(calls.length, 0); assert.equal(g.hero.kills, kills);
  assert.deepEqual(e.statusEffects, status); assert.equal(draws.length, 2); assert.equal(g.hero.mana, mana - 5);
  assert.equal(g.skillCooldowns[skillId], 6); assert(g.testFloats.some(f => f.text === 'EVADE'));
  evidence.push({ case: 'C04', draws, calls, hpDelta: 0 });
});
await test('C05 lethal actual death/reward consumer once; overkill feedback23, HP clamp1', () => {
  const g = game(), e = target(g, { hp: 1 }), calls = ledger(g); delete e.definition;
  const draws = rng(g, [.5, 0, .99]), kills = g.hero.kills;
  assert(cast(g).ok); assert.equal(e.hp, 0); assert.equal(g.hero.kills, kills + 1); assert.equal(e.group.visible, false);
  assert.equal(calls.length, 1); assert.equal(calls[0].hpDelta, 1); assert.equal(draws.length, 3);
  assert(g.testFloats.some(f => f.text === '23' && f.kind === 'damage'));
  g.skillHits.update(10); assert.equal(g.hero.kills, kills + 1);
  assert.equal(g.hurtEnemy(e, 100), 0); assert.equal(g.hero.kills, kills + 1);
  evidence.push({ case: 'C05', draws, calls, killsDelta: g.hero.kills - kills, feedback: g.testFloats });
});
await test('C06 immutable snapshot: gear/stat mutate after commitment; original real impact still raw22.8 once', () => {
  const g = game(), e = target(g), calls = ledger(g), queue = deferRealQueue(g);
  const draws = rng(g, [.5, 0, .99]), result = cast(g); assert(result.ok); assert.equal(queue.entries.length, 1);
  const sword = g.hero.inventory.find(i => i.id === g.hero.equipment.mainHand);
  sword.baseStats.attack = 999; g.hero.allocatedStats.str = 50;
  assert(Object.isFrozen(result.execution)); assert(Object.isFrozen(result.sample.hits[0]));
  assert.throws(() => { result.execution.weaponRanges.MAIN.min = 99; }, TypeError);
  queue.flush(); close(calls[0].raw, 22.8); assert.equal(draws.length, 3); assert(e.hp < e.max);
  evidence.push({ case: 'C06', result, draws, calls, note: 'Forwarding queue spy defers original schedule; production callback/consumer unchanged' });
});
const badContexts = {
  'job': g => { g.hero.job = 'warrior'; }, 'core': g => { g.hero.coreJob = 'warrior'; },
  'specialization': g => { g.hero.specialization = 'berserker'; }, 'level': g => { g.hero.level = 1; },
  'allocated-primary': g => { g.hero.allocatedStats.str = 1; }, 'missing-primary': g => { delete g.hero.allocatedStats.int; },
  'equipment-primary': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.str = 1; },
  'global-flat': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.attack = 10; },
  'outgoing-percent': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.physicalDamage = 1; },
  'enhancement': g => { g.hero.inventory.find(i => i.isEquipped).enhancementLevel = 1; },
  'quantity': g => { g.hero.inventory.find(i => i.isEquipped).quantity = 2; },
  'extra-equipped-slot': g => { g.hero.equipment.armor = g.hero.equipment.mainHand; },
  'advanced-lineage': g => { g.hero.skillProgressionV3.chosenAdvancedJob = 'gladiator'; },
  'paid-ledger-negative': g => { g.hero.skillProgressionV3.totalEarnedSP = -1; },
  'wrong-template': g => { g.hero.inventory.find(i => i.isEquipped).templateId = 'legacy-fajar-blade'; },
  'wrong-hand': g => { g.hero.inventory.find(i => i.isEquipped).handedness = 'two_hand'; },
  'support': g => { g.hero.inventory.find(i => i.isEquipped).equipmentType = 'tome'; },
  'off-filled': g => { g.hero.equipment.offHand = g.hero.equipment.mainHand; },
  'missing-instance': g => { g.hero.inventory = []; },
  'duplicate-instance': g => { g.hero.inventory.push({ ...g.hero.inventory.find(i => i.isEquipped) }); },
  'wrong-owner': g => { g.hero.characterId = 'different-owner'; },
  'stale-epoch': g => { g.hero = { ...g.hero }; },
  'stale-item': g => { g.hero.inventory = g.hero.inventory.map(i => ({ ...i })); },
  'temporary-buff': g => { g.hero.temporaryModifiers = [{ modifier: { id: 'mechanical-buff', stats: { flat: { physicalAttack: 1 } } }, remaining: 1 }]; },
  'passive': g => { g.hero.passiveLevels['mechanical-passive'] = 1; },
  'rune': g => { g.hero.inventory.find(i => i.isEquipped).sockets.push({ id: 'mechanical', rune: null }); },
  'unique': g => { g.hero.inventory.find(i => i.isEquipped).uniqueEffect = 'mechanical'; },
  'forged-free-grant': g => { g.hero.skillProgressionV3.grantedRanks[skillId] = 1; },
  'missing-canonical-rank': g => { delete g.hero.skillProgressionV3.skillRanks[skillId]; },
  'mirror-mismatch': g => { g.hero.skillLevels[skillId] = 2; },
  'rank-mismatch': g => { g.hero.skillProgressionV3.skillRanks[skillId] = 2; },
  'unsupported-rank': g => { g.hero.skillLevels[skillId] = g.hero.skillProgressionV3.skillRanks[skillId] = 99; },
  'earned-SP': g => { g.hero.skillProgressionV3.totalEarnedSP = 2; },
  'unspent-stat-points': g => { g.hero.statPoints = 0; },
  'Quick-grant': g => { g.hero.skillProgressionV3.grantedRanks['v3-adventurer-quick-slash'] = 0; },
  'Minor-owned': g => { g.hero.skillProgressionV3.skillRanks['v3-adventurer-minor-heal'] = g.hero.skillLevels['v3-adventurer-minor-heal'] = 1; },
  'SP-state': g => { g.hero.skillPoints = 1; },
  'malformed-rank-map': g => { g.hero.skillProgressionV3.skillRanks = null; },
  'malformed-grant-map': g => { g.hero.skillProgressionV3.grantedRanks = null; },
  'null-grant': g => { g.hero.skillProgressionV3.grantedRanks[skillId] = null; },
  'malformed-bonus': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.attack = NaN; },
};
for (const [name, change] of Object.entries(badContexts)) await test('C07 reject ' + name + ' no RNG/Mana/cooldown/movement/facing/queue', () => {
  const g = game(); target(g); change(g); const result = rejected(g); assert.equal(result.ok, false);
});
await test('C08 guards: Stun/lock/death/pause/hotbar/start/Mana/cooldown/target no sample or commitment', () => {
  const cases = [
    g => { g.hero.stunState = { expiresAt: 10 }; }, g => { g.actionLock.start(0, 1); },
    g => { g.paused = true; }, g => { g.started = false; }, g => { g.dead = true; },
    g => { g.disposed=true; }, g => { g.transitioning=true; }, g => { g.regionLoadError='mechanical'; },
    g => { g.hotbarInteracting = true; }, g => { g.hero.hp = 0; }, g => { g.thiefMovement = {}; },
    g => { g.hero.mana = 4; }, g => { g.hero.mana = NaN; },
    g => { g.skillCooldowns[skillId] = 1; }, g => { g.skillCooldowns[skillId] = NaN; },
    g => { g.clearCurrentTarget(); }, (g, e) => { e.hp = 0; }, (g, e) => { e.spawnGeneration++; },
    (g,e) => { e.id++; }, (g,e) => { g.enemies = g.enemies.filter(item=>item!==e); },
    (g, e) => { e.group.position.x = NaN; },
  ];
  for (const change of cases) { const g = game(), e = target(g); change(g, e); assert.equal(rejected(g).ok, false); }
});
await test('C09 invalid RNG values and original exception: attempted draw1 but no committed state', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 1, undefined]) {
    const g = game(); target(g); assert.equal(rejected(g, [value]).code, 'RNG_INVALID');
  }
  const g = game(); target(g); const before = commitment(g), error = new Error('original RNG exception'), draws = rng(g, [error]);
  assert.throws(() => cast(g), e => e === error); assert.equal(draws.length, 1); assert.deepEqual(commitment(g), before);
});
await test('C10 blocked approach preserves position; valid existing collision approach occurs only after sample/commit', () => {
  const blocked = game(), e = target(blocked); e.group.position.z -= 6;
  blocked.moveHeroOnGround = from => ({ ...from }); assert.equal(rejected(blocked).code, 'TARGET_OUT_OF_RANGE');
  const g = game(), t = target(g), before = g.actor.position.clone(); t.group.position.z -= 4;
  const original = g.rand.bind(g); let attempts = 0;
  g.rand = () => { assert(g.actor.position.equals(before), 'no early movement at attack draw'); attempts++; return NaN; };
  const snapshot = commitment(g); assert.equal(cast(g).code, 'RNG_INVALID'); assert.equal(attempts, 1);
  assert.deepEqual(commitment(g), snapshot); g.rand = original;
  const draws = rng(g, [.5, 0, .99]); assert(cast(g).ok);
  assert(!g.actor.position.equals(before)); assert(g.groundDistance(g.actor.position, t.group.position) <= 3.8001);
  assert.equal(draws.length, 3);
});
await test('C11 target/lifecycle invalidation at real deferred queue prevents stale damage without attack reroll', () => {
  const changes = [(g,e) => { e.hp = 0; }, (g,e) => { e.spawnGeneration++; }, g => { g.regionBuildToken++; },
    (g,e) => { e.id++; }, (g,e) => { e.group.uuid+='-stale'; }, (g,e) => { e.respawnDeadline=123; },
    (g,e) => { g.enemies = g.enemies.filter(x => x !== e); }, g => { g.hero = { ...g.hero }; },
    g => { g.hero.characterId += '-changed'; }, g => { g.hero.slotId+='-stale'; }, g => { g.dead = true; }];
  for (const change of changes) {
    const g = game(), e = target(g), calls = ledger(g), queue = deferRealQueue(g), draws = rng(g, [.5]);
    assert(cast(g).ok); change(g,e); const hp = e.hp; queue.flush();
    assert.equal(e.hp, hp); assert.equal(calls.length, 0); assert.equal(draws.length, 1);
    assert.equal(g.skillHits.size, 0);
  }
});
await test('C13 default OFF legacy Power R1 preserves two BaseRolls/scalarPATK16/early rounding', () => {
  const g = game({ optIn:false }), e = target(g), calls = ledger(g), hp = e.hp;
  const result = legacyCast(g,skillId); assert.equal(result.result,true); assert.equal(result.rolls.length,2);
  const expectedRaw = Math.round((12 + 6 * .25) * 4 + 16 * 1.20);
  assert.equal(calls[0].raw,expectedRaw); assert.equal(calls[0].policy,'LEGACY');
  close(hp-e.hp,expectedRaw*520/590); assert.equal(result.draws.length,2);
  evidence.push({case:'C13',result,calls,scope:'legacy isolation, NOT balance parity'});
});
await test('C15 authoritative original Game.rand advances attack/hit/Crit exactly once each', () => {
  const g = game(), e = target(g), hp = e.hp; g.seed = 1;
  const original = Game.prototype.rand.bind(g), draws = [];
  g.rand = () => { const value = original(); draws.push(value); return value; };
  const next = seed => (Math.imul(1664525, seed) + 1013904223) >>> 0;
  const seeds = [next(1)]; seeds.push(next(seeds[0]), next(next(seeds[0])));
  const result = cast(g); assert(result.ok); close(result.sample.totalRaw, (18 + 2 * seeds[0] / 4294967296) * 1.20);
  assert.deepEqual(draws, seeds.map(s => s / 4294967296)); assert.equal(g.seed, seeds[2]);
  assert.equal(hp - e.hp, Math.round(result.sample.totalRaw * 520 / 590));
  evidence.push({ case: 'C15', draws, result, finalSeed: g.seed, hpDelta: hp - e.hp });
});
await test('C17 missing source provenance and injected registry mechanics reject via actual cast before sampling', () => {
  const g = game(); target(g);
  const template = items.ITEM_CATALOG[basic.BASIC_REFERENCE_B.templateId];
  try {
    delete items.ITEM_CATALOG[basic.BASIC_REFERENCE_B.templateId];
    assert.equal(rejected(g).code, 'CATALOG_PROVENANCE_MISMATCH');
  } finally { items.ITEM_CATALOG[basic.BASIC_REFERENCE_B.templateId] = template; }
  const definition = ADVENTURER_V3_RUNTIME_SKILLS[1];
  try {
    definition.modifiers = [];
    assert.equal(rejected(g).code, 'SKILL_PROVENANCE_MISMATCH');
  } finally { delete definition.modifiers; }
  assert(Object.isFrozen(basic.BASIC_REFERENCE_B.baseRange));
  assert.deepEqual(basic.BASIC_REFERENCE_B.baseRange, { min:9, max:11 });
});
await test('C19 current impact defense/evasion remain live; snapshot budget remains frozen', () => {
  const g = game(), e = target(g), calls = ledger(g), queue = deferRealQueue(g), hp = e.hp;
  rng(g,[.5,0,.99]); const result = cast(g); assert(result.ok); e.definition.defense = 200;
  queue.flush(); close(calls[0].raw,22.8); assert.equal(hp-e.hp,Math.round(22.8*520/720));
  const other = game(), t = target(other), noDamage = ledger(other), deferred = deferRealQueue(other);
  const draws = rng(other,[.5,.99]); assert(cast(other).ok); t.evasion=50; deferred.flush();
  assert.equal(noDamage.length,0); assert.equal(t.hp,t.max); assert.equal(draws.length,2);
});
await test('C20 slot2 and current hotbar consumer keep boolean acceptance; success and cooldown rejection remain distinct', () => {
  const g = game(); target(g); rng(g,[.5,0,.99]);
  assert.equal(withoutLegacyRandom(()=>g.castSkill(2)),true);
  assert(g.getDevelopmentAdventurerRanksResult().ok);
  const before=commitment(g); rng(g,[]); assert.equal(g.castSkill(2),false);
  assert.equal(g.getDevelopmentAdventurerRanksResult().code,'CAST_NOT_ALLOWED'); assert.deepEqual(commitment(g),before);
});


await test('C21 mitigation uses actual attackerLevel2, not copied Quick Lv1 constant',()=>{
  const g=game(), e=target(g,{defense:31}), calls=ledger(g), hp=e.hp; rng(g,[.5,0,.99]);
  assert(cast(g).ok); assert.equal(calls[0].attackerLevel,2);
  assert.equal(Math.round(22.8*520/551),22); assert.equal(Math.round(22.8*510/541),21);
  assert.equal(hp-e.hp,22); assert(g.testFloats.some(f=>f.text==='22'&&f.kind==='damage'));
  evidence.push({case:'C21',calls,hpDelta:hp-e.hp,expectedLevel2:22,rejectedLevel1:21});
});
await test('C23 post-RNG identity/resource/target guards reject without commitment; attempted draw cannot roll back',()=>{
  const changes=[g=>{g.hero={...g.hero};},g=>{g.hero.slotId+='-changed';},g=>{g.paused=true;},
    g=>{g.hero.mana=0;},g=>{g.skillCooldowns[skillId]=1;},(g,e)=>{e.spawnGeneration++;},
    g=>{g.hero.inventory=g.hero.inventory.map(item=>({...item}));},
    (g,e)=>{e.group.position.x+=10;},(g,e)=>{e.id++;}];
  for(const change of changes){
    const g=game(),e=target(g);let draws=0, changed;g.rand=()=>{draws++;change(g,e);changed=commitment(g);return .5;};
    assert.equal(cast(g).code,'STALE_COMMITMENT');assert.equal(draws,1);
    assert.deepEqual(commitment(g),changed);
    assert.equal(g.skillHits.size,0);assert.equal(g.testAnimations.length,0);assert.equal(e.hp,e.max);
  }
});
function legacyCast(g, id, values = [.5, .25]) {
  const saved = Math.random, rolls = [], draws = rng(g, [0, .99]);
  Math.random = () => {
    const stack = new Error().stack;
    if (!stack.includes('resolveSkillAction') || stack.includes('Game.snapshot')) return saved();
    const n = rolls.length; assert(n < values.length); rolls.push(values[n]); return values[n];
  };
  try { const result = g.castSkill(id); return { result, rolls, draws }; } finally { Math.random = saved; }
}
await test('Quick R5 representative Crit/Evade/lethal and fractional final-rounding, real consumers',()=>{
 for(const outcome of ['normal','crit','evade','lethal']){
  const g=game({kind:'quick',rank:5}),e=target(g,{defense:40,hp:outcome==='lethal'?1:1000,evasion:outcome==='evade'?50:0}),calls=ledger(g);
  if(outcome==='lethal')Object.assign(e.definition,{id:'mechanical-offline',level:13,variant:'normal',exp:0,dropRate:0});
  const values=outcome==='evade'?[.25,.99]:[.25,0,outcome==='crit'?0:.99,...(outcome==='lethal'?[.99]:[])],draws=rng(g,values),mana=g.hero.mana,kills=g.hero.kills;
  assert(g.castSkill(quickId));const raw=36.6,expected=Math.round(raw*(outcome==='crit'?1.5:1)*630/670);
  close(g.getDevelopmentAdventurerRanksResult().sample.totalRaw,raw);assert.equal(mana-g.hero.mana,5);assert.equal(g.skillCooldowns[quickId],2.8);
  if(outcome==='evade'){assert.equal(e.hp,1000);assert.equal(calls.length,0);assert.equal(draws.length,2);assert.equal(g.hero.kills,kills);}
  else{assert.equal(calls.length,1);assert.equal(calls[0].hpDelta,outcome==='lethal'?1:expected);assert(g.testFloats.some(f=>f.kind==='damage'&&f.text===String(expected)));
   if(outcome==='lethal'){assert.equal(g.hero.kills,kills+1);g.skillHits.update(10);assert.equal(g.hero.kills,kills+1);}
   if(outcome==='normal')assert.notEqual(expected,Math.round(Math.round(raw)*630/670));
  }
  evidence.push({case:'QuickR5-'+outcome,calls,draws,raw,expected});
 }
});
await test('committed R3 rank/MP/CD/raw budget stays frozen despite later in-place attacker changes',()=>{
 const g=game({kind:'power',rank:3}),e=target(g),calls=ledger(g),queue=deferRealQueue(g);
 rng(g,[.5,0,.99]);assert(g.castSkill(powerId));const result=g.getDevelopmentAdventurerRanksResult(),raw=28*1.32;
 g.hero.skillProgressionV3.skillRanks[powerId]=4;g.hero.skillLevels[powerId]=4;g.hero.allocatedStats.str=99;
 queue.flush();close(calls[0].raw,raw);assert.equal(calls.length,1);assert(e.hp<e.max);assert.equal(g.skillCooldowns[powerId],5.5);
 assert.equal(result.execution.coefficientBudget,1.32);assert.equal(result.execution.scalingBudget,0);
 evidence.push({case:'R3-frozen-rank',result,calls});
});
await test('malformed owned ranks/grants/definition reject at new admission, not just stale signature',()=>{
 for(const change of [
  g=>{g.hero.skillProgressionV3.skillRanks[powerId]=null;g.hero.skillLevels[powerId]=null;},
  g=>{g.hero.skillProgressionV3.grantedRanks[powerId]=null;},
  g=>{g.hero.skillLevels[quickId]=99;},g=>{g.hero.skillProgressionV3.skillRanks[quickId]=6;}
 ]){const g=game({optIn:false});change(g);assert.equal(g.enableDevelopmentAdventurerRanksReference().ok,false);target(g);rng(g,[]);assert.equal(g.castSkill(powerId),false);}
 const g=game(),definition=ADVENTURER_V3_RUNTIME_SKILLS[1],saved=definition.rankValues;
 try{definition.rankValues=[];target(g);assert.equal(rejected(g).code,'SKILL_PROVENANCE_MISMATCH');}finally{definition.rankValues=saved;}
});

for(const kind of ['quick','power'])for(let rank=1;rank<=5;rank++){
 await test('RANK '+kind+' R'+rank+' legal consumers/ledger/raw/full precision/HP/feedback/Mana/CD/one queue',()=>{
  const level=levels[kind][rank-1],[coefficient,str,cost,cd]=table[kind][rank-1],id=kind==='quick'?quickId:powerId;
  const g=game({kind,rank}),e=target(g,{defense:37}),calls=ledger(g),draws=rng(g,[.25,0,.99]);
  const before={mana:g.hero.mana,hp:e.hp,ledger:structuredClone(g.hero.skillProgressionV3),sp:g.hero.skillPoints};
  const queues=[],original=g.skillHits.schedule.bind(g.skillHits);g.skillHits.schedule=(...args)=>{queues.push(args[0]);return original(...args);};
  assert(withoutLegacyRandom(()=>g.castSkill(id)));const result=g.getDevelopmentAdventurerRanksResult();
  const base=7+Math.floor(level*1.1),raw=(base+9+.5)*coefficient,den=500+10*level,expected=Math.round(raw*den/(den+37));
  close(result.sample.totalRaw,raw);assert.equal(result.execution.coefficientBudget,coefficient);
  assert.equal(result.execution.scalingBudget,0);assert.deepEqual(result.execution.weaponRanges.MAIN,{min:9,max:11});
  assert.equal(calls.length,1);assert.equal(calls[0].attackerLevel,level);close(calls[0].raw,raw);assert.equal(calls[0].policy,'REFERENCE_B_FINAL');
  assert.equal(before.hp-e.hp,expected);assert(g.testFloats.some(f=>f.kind==='damage'&&f.text===String(expected)));
  assert.equal(before.mana-g.hero.mana,cost);assert.equal(g.skillCooldowns[id],cd);
  assert.equal(queues.length,1);assert.equal(queues[0].length,1);assert.equal(queues[0][0].delay,0);assert.equal(queues[0][0].baseDamage,0);
  assert.deepEqual(draws,[.25,0,.99]);assert.equal(g.hero.statPoints,2*(level-1));
  const paid=kind==='quick'?rank-1:rank;assert.equal(g.hero.skillProgressionV3.totalEarnedSP,level-1);assert.equal(g.hero.skillPoints,level-1-paid);
  assert.deepEqual(g.hero.skillProgressionV3,before.ledger);assert.equal(g.hero.skillPoints,before.sp);
  const mechanical=foundation.composeBonusScaling({STR:25,VIT:15,DEX:15,INT:15},{STR:str});assert(mechanical.ok);close(mechanical.value,10*str);
  const atCommit=commitment(g);rng(g,[]);assert.equal(g.castSkill(id),false);assert.deepEqual(commitment(g),atCommit);
  evidence.push({case:'rank-matrix',kind,rank,level,paid,earned:level-1,available:g.hero.skillPoints,str,coefficient,cost,cd,raw,expected,result,calls});
 });
}
await test('UPGRADE legal purchase invalidates binding, rebind preserves existing CD, rank2 budget new',()=>{
 const g=game({kind:'quick',rank:1,level:3}),e=target(g),calls=ledger(g);rng(g,[.5,0,.99]);
 assert(g.castSkill(quickId));const prior=g.skillCooldowns[quickId];assert.equal(prior,3.2);
 assert(g.learnSkill(quickId));const before=commitment(g);rng(g,[]);
 assert.equal(g.castSkill(quickId),false);assert.deepEqual(commitment(g),before);
 assert(g.enableDevelopmentAdventurerRanksReference().ok);assert.equal(g.skillCooldowns[quickId],prior);
 const reb=commitment(g);assert.equal(g.castSkill(quickId),false);assert.deepEqual(commitment(g),reb);
 // Offline clock consumer, not manual cooldown field replacement.
 // Actual tick cooldown loop with offline visual/AI surroundings stubbed only.
 g.crystal=new T.Group();g.aura=new T.Group();g.updateEnemy=()=>{};g.updateFloating=()=>{};
 g.updateCamera=()=>{};g.drawMap=()=>{};g.lastTime=1000;
 for(let frame=1;frame<=84;frame++)g.tick(1000+frame*40);
 assert.equal(g.skillCooldowns[quickId],0);
 rng(g,[.5,0,.99]);assert(g.castSkill(quickId));const result=g.getDevelopmentAdventurerRanksResult();
 close(result.sample.totalRaw,(7+Math.floor(3*1.1)+10)*1.08);assert.equal(g.skillCooldowns[quickId],3.1);
 assert.equal(g.hero.skillProgressionV3.totalEarnedSP,2);assert.equal(g.hero.skillPoints,1);assert.equal(calls.length,2);assert(e.hp<e.max);
 evidence.push({case:'upgrade',cooldownBeforeRebind:prior,result});
});
await test('COMBINED Lv14 Quick5 Power5 distinct CD/results and ledger13/9/4 points26',()=>{
 const g=game({level:14,combined:true}),e=target(g),calls=ledger(g);assert.equal(g.hero.statPoints,26);assert.equal(g.hero.skillPoints,4);
 const ranks=structuredClone(g.hero.skillProgressionV3);rng(g,[.5,0,.99]);assert(g.castSkill(1));const q=g.getDevelopmentAdventurerRanksResult();
 rng(g,[.5,0,.99]);assert(g.castSkill(2));const p=g.getDevelopmentAdventurerRanksResult();
 close(q.sample.totalRaw,32*1.2);close(p.sample.totalRaw,32*1.45);assert.equal(g.skillCooldowns[quickId],2.8);assert.equal(g.skillCooldowns[powerId],5);
 assert.equal(g.hero.skillPoints,4);assert.deepEqual(g.hero.skillProgressionV3,ranks);assert.equal(calls.length,2);assert(e.hp<e.max);
 evidence.push({case:'combined',q,p,ranks,available:4,statPoints:26,calls});
});
await test('purchase rejects under-level rank; malformed imported rank still fails reference admission',()=>{
 const g=game({optIn:false,level:3}),legalBefore=commitment(g);
 assert.equal(g.learnSkill(powerId),false);assert.deepEqual(commitment(g),legalBefore);
 // MECHANICAL INVALID IMPORT only, not a legal progression setup. Retains the
 // original independent assertion that reference admission rejects under-level ownership.
 g.hero.skillProgressionV3.skillRanks[powerId]=2;g.hero.skillLevels[powerId]=2;g.hero.skillPoints=0;
 assert.equal(g.enableDevelopmentAdventurerRanksReference().ok,false);target(g);const before=commitment(g);rng(g,[]);
 assert.equal(g.castSkill(powerId),false);assert.deepEqual(commitment(g),before);
});
await test('bindings forged/rehosted and legacy tokens fail; reference data cannot be overridden',()=>{
 const g=game(),opened=reference.openAdventurerRanksBinding(g),definition=ADVENTURER_V3_RUNTIME_SKILLS[1];assert(opened.ok);
 for(const host of [{hero:g.hero},game()])assert.equal(reference.prepareAdventurerRanks(opened.value,host,definition).code,'BINDING_IDENTITY_MISMATCH');
 assert.equal(reference.prepareAdventurerRanks({version:opened.value.version},g,definition).ok,false);
 assert.equal(reference.prepareAdventurerRanks(opened.value,g,{...definition}).code,'SKILL_PROVENANCE_MISMATCH');
 assert.equal(reference.prepareAdventurerRanks(opened.value,g,definition,{...basic.BASIC_REFERENCE_B}).code,'REFERENCE_PROVENANCE_MISMATCH');
});
await test('ambiguous old/new activation rejected, toggling never removes CD; Minor Heal remains existing',()=>{
 const g=game({kind:'quick'});assert(g.enableDevelopmentQuickSlashReference().ok);target(g);rng(g,[]);
 const before=commitment(g);assert.equal(g.castSkill(1),false);assert.equal(g.getDevelopmentAdventurerRanksResult().code,'AMBIGUOUS_REFERENCE_ROUTE');assert.deepEqual(commitment(g),before);
 const h=game({kind:'quick',level:2,optIn:false});assert(h.enableDevelopmentQuickSlashReference().ok===false);
 assert.equal(h.enableDevelopmentAdventurerRanksReference().code,'AMBIGUOUS_REFERENCE_ROUTE');
 const minor=game({optIn:false,level:3});assert(minor.learnSkill('v3-adventurer-minor-heal'));minor.hero.hp-=20;
 // Selected combined cannot enroll Minor, but does not intercept this unrelated skill.
 minor.enableDevelopmentAdventurerRanksReference();rng(minor,[]);assert(minor.castSkill(3));
 assert.equal(minor.getDevelopmentAdventurerRanksResult(),undefined);
});
await test('production cannot opt in; no saved route; existing registry math stays historical',()=>{
 const g=game({optIn:false}),saved=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try{assert.equal(g.enableDevelopmentAdventurerRanksReference().code,'DEVELOPMENT_ONLY');}finally{process.env.NODE_ENV=saved;}
 assert.equal(ADVENTURER_V3_RUNTIME_SKILLS[0].skillPowerFactor,4);assert.equal(ADVENTURER_V3_RUNTIME_SKILLS[1].castingTime,.35);
});
