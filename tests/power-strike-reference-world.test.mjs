// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.POWER_STRIKE_CHECKPOINT;
const storage = new Map();
const memory = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), remove() {},
  getContext: () => ({ clearRect() {}, fillRect() {} }) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline-basic' }, addEventListener() {}, removeEventListener() {} },
  document: { createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {} });
const server = await createServer({ configFile: false, appType: 'custom',
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'power-strike-vite-cache'),
  server: { middlewareMode: true }, resolve: { alias: { '@': process.cwd() } },
  plugins: [{ name: 'offline-basic-renderer-only', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:basic-test-three') return '\0basic-test-three'; },
    load(id) { if (id === '\0basic-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      setPixelRatio(){} setSize(){} dispose(){} forceContextLoss(){} }`; },
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
const reference = await load('power-strike-reference-v2');
const basic = await load('basic-attack-reference-v2');
const { ADVENTURER_V3_RUNTIME_SKILLS } = await load('adventurer-v3');
const foundation = await load('attack-range-v2');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args) }, ready: Promise.resolve(true), dispose() {} };
  this.testAnimations = [];
};
let serial = 0;
function game({ optIn = true } = {}) {
  const h = rules.createV3AdventurerHero('basic-world-' + (++serial));
  storage.clear(); rules.saveCharacter(h, true);
  const g = new Game(element(), element(), element(), () => {}, () => {}, h.slotId);
  // placeActor is render-stubbed; synchronize its normal x/z postcondition.
  g.actor.position.set(g.hero.x, 0, g.hero.z);
  g.started = true;
  g.testFloats = [];
  g.float = (...args) => g.testFloats.push({ text: args[1], kind: args[2] });
  for (const name of ['sound', 'effect', 'ring', 'pulse', 'arc']) g[name] = () => {};
  // createItem's template leaves can be shared. Isolate mutable mechanical
  // fixtures before testing malicious/malformed mutations; do not alter catalog.
  const fresh = g.hero;
  assert.equal(fresh.level, 1); assert.equal(fresh.skillPoints, 0);
  assert.equal(fresh.skillProgressionV3.totalEarnedSP, 0);
  assert.equal(fresh.skillProgressionV3.grantedRanks['v3-adventurer-quick-slash'], 1);
  assert.equal(fresh.skillLevels[reference.POWER_STRIKE_REFERENCE.skillId], 0);
  assert.equal(rules.gainXP(g.hero, rules.xpNeeded(g.hero.level)), 1);
  assert.equal(g.hero.level, 2); assert.equal(g.hero.statPoints, 2); assert.equal(g.hero.skillPoints, 1);
  assert.equal(g.hero.skillProgressionV3.totalEarnedSP, 1);
  assert(g.learnSkill(reference.POWER_STRIKE_REFERENCE.skillId));
  assert.notEqual(g.hero, fresh, 'Game.learnSkill replaces Hero; bind AFTER this consumer');
  assert.equal(g.hero.skillLevels[reference.POWER_STRIKE_REFERENCE.skillId], 1);
  assert.equal(g.hero.skillProgressionV3.skillRanks[reference.POWER_STRIKE_REFERENCE.skillId], 1);
  assert.equal(g.hero.skillProgressionV3.grantedRanks[reference.POWER_STRIKE_REFERENCE.skillId] ?? 0, 0);
  assert.equal(g.hero.skillPoints, 0); assert.equal(g.hero.statPoints, 2);
  const sword = structuredClone(items.createItem(basic.BASIC_REFERENCE_B.templateId, { id: g.hero.slotId + '-training' }));
  g.hero.inventory.push(sword);
  assert(g.equipItem(sword.id, 'mainHand'));
  assert.notEqual(g.hero.inventory.find(i => i.id === sword.id), sword, 'equip clones inventory; bind current instance');
  if (optIn) assert(g.enableDevelopmentPowerStrikeReference().ok);
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
  const before = commitment(g), random = rng(g, draws), accepted = g.castSkill(reference.POWER_STRIKE_REFERENCE.skillId);
  const result = g.getDevelopmentPowerStrikeResult(); assert.equal(accepted, false);
  assert.deepEqual(commitment(g), before, 'rejection cannot commit actor/resources/presentation');
  assert.equal(random.length, draws.length);
  return result;
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);


const skillId = reference.POWER_STRIKE_REFERENCE.skillId;
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
    const accepted = g.castSkill(skillId), result = g.getDevelopmentPowerStrikeResult();
    assert.equal(accepted, result.ok); return result;
  });
}
function deferRealQueue(g) {
  const original = g.skillHits.schedule.bind(g.skillHits), entries = [];
  g.skillHits.schedule = (...args) => { entries.push(args); };
  return { entries, flush: () => { for (const args of entries.splice(0)) original(...args); } };
}

await test('P01 legal Lv2 paid R1/equip/cast/apply/queue: raw22.8, HP/feedback20, MP5/CD6 once, SP unchanged', () => {
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
  evidence.push({ case: 'P01', result, draws, calls, feedback: g.testFloats, manaDelta: 5, cooldown: g.skillCooldowns[skillId] });
});
await test('P02 u=.25 preserves raw22.2 through defense, final21 distinguishes early round20', () => {
  const g = game(), e = target(g, { defense: 40 }), calls = ledger(g); rng(g, [.25, 0, .99]);
  const hp = e.hp, result = cast(g); assert(result.ok); close(result.sample.totalRaw, 22.2);
  close(calls[0].raw, 22.2); const expected = Math.round(22.2 * 520 / 560);
  assert.equal(expected, 21); assert.notEqual(expected, Math.round(Math.round(22.2) * 520 / 560));
  assert.equal(hp - e.hp, expected); assert(g.testFloats.some(f => f.text === '21' && f.kind === 'damage'));
  evidence.push({ case: 'P02', result, calls, expected });
});
await test('P03 allowed physical Crit once; raw34.2 then normal mitigation/final30', () => {
  const g = game(), e = target(g, { defense: 70 }), calls = ledger(g), draws = rng(g, [.5, 0, 0]);
  const hp = e.hp; assert(cast(g).ok); close(calls[0].raw, 22.8 * 1.5);
  assert.equal(hp - e.hp, Math.round(22.8 * 1.5 * 520 / 590)); assert.equal(calls.length, 1);
  assert.equal(draws.length, 3); assert(g.testFloats.some(f => f.text === '30' && f.kind === 'damage'));
  evidence.push({ case: 'P03', draws, calls, feedback: g.testFloats });
});
await test('P04 evade pays one cast but no Crit/HP/status/proc/death and no attack reroll', () => {
  const g = game(), e = target(g, { evasion: 50 }), calls = ledger(g), draws = rng(g, [.5, .99]);
  const hp = e.hp, kills = g.hero.kills, status = structuredClone(e.statusEffects), mana = g.hero.mana;
  assert(cast(g).ok); assert.equal(e.hp, hp); assert.equal(calls.length, 0); assert.equal(g.hero.kills, kills);
  assert.deepEqual(e.statusEffects, status); assert.equal(draws.length, 2); assert.equal(g.hero.mana, mana - 5);
  assert.equal(g.skillCooldowns[skillId], 6); assert(g.testFloats.some(f => f.text === 'EVADE'));
  evidence.push({ case: 'P04', draws, calls, hpDelta: 0 });
});
await test('P05 lethal actual death/reward consumer once; overkill feedback23, HP clamp1', () => {
  const g = game(), e = target(g, { hp: 1 }), calls = ledger(g); delete e.definition;
  const draws = rng(g, [.5, 0, .99]), kills = g.hero.kills;
  assert(cast(g).ok); assert.equal(e.hp, 0); assert.equal(g.hero.kills, kills + 1); assert.equal(e.group.visible, false);
  assert.equal(calls.length, 1); assert.equal(calls[0].hpDelta, 1); assert.equal(draws.length, 3);
  assert(g.testFloats.some(f => f.text === '23' && f.kind === 'damage'));
  g.skillHits.update(10); assert.equal(g.hero.kills, kills + 1);
  assert.equal(g.hurtEnemy(e, 100), 0); assert.equal(g.hero.kills, kills + 1);
  evidence.push({ case: 'P05', draws, calls, killsDelta: g.hero.kills - kills, feedback: g.testFloats });
});
await test('P06 immutable snapshot: gear/stat mutate after commitment; original real impact still raw22.8 once', () => {
  const g = game(), e = target(g), calls = ledger(g), queue = deferRealQueue(g);
  const draws = rng(g, [.5, 0, .99]), result = cast(g); assert(result.ok); assert.equal(queue.entries.length, 1);
  const sword = g.hero.inventory.find(i => i.id === g.hero.equipment.mainHand);
  sword.baseStats.attack = 999; g.hero.allocatedStats.str = 50;
  assert(Object.isFrozen(result.execution)); assert(Object.isFrozen(result.sample.hits[0]));
  assert.throws(() => { result.execution.weaponRanges.MAIN.min = 99; }, TypeError);
  queue.flush(); close(calls[0].raw, 22.8); assert.equal(draws.length, 3); assert(e.hp < e.max);
  evidence.push({ case: 'P06', result, draws, calls, note: 'Forwarding queue spy defers original schedule; production callback/consumer unchanged' });
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
for (const [name, change] of Object.entries(badContexts)) await test('P07 reject ' + name + ' no RNG/Mana/cooldown/movement/facing/queue', () => {
  const g = game(); target(g); change(g); const result = rejected(g); assert.equal(result.ok, false);
});
await test('P08 guards: Stun/lock/death/pause/hotbar/start/Mana/cooldown/target no sample or commitment', () => {
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
await test('P09 invalid RNG values and original exception: attempted draw1 but no committed state', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 1, undefined]) {
    const g = game(); target(g); assert.equal(rejected(g, [value]).code, 'RNG_INVALID');
  }
  const g = game(); target(g); const before = commitment(g), error = new Error('original RNG exception'), draws = rng(g, [error]);
  assert.throws(() => cast(g), e => e === error); assert.equal(draws.length, 1); assert.deepEqual(commitment(g), before);
});
await test('P10 blocked approach preserves position; valid existing collision approach occurs only after sample/commit', () => {
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
await test('P11 target/lifecycle invalidation at real deferred queue prevents stale damage without attack reroll', () => {
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
await test('P12 Power binding cannot authorize Basic; bindings cannot be forged/rehosted', () => {
  const g = game(), binding = reference.openPowerStrikeBinding(g); assert(binding.ok);
  const d = ADVENTURER_V3_RUNTIME_SKILLS[1];
  assert.equal(reference.preparePowerStrike({ version: binding.value.version }, g, d).code, 'BINDING_IDENTITY_MISMATCH');
  assert.equal(reference.preparePowerStrike(binding.value, { hero: g.hero }, d).code, 'BINDING_IDENTITY_MISMATCH');
  assert.equal(reference.preparePowerStrike(binding.value, g, { ...d }).code, 'SKILL_PROVENANCE_MISMATCH');
  target(g); const calls = ledger(g), draws = rng(g, [0, .99]); g.attack();
  assert.equal(calls[0].raw, 16); assert.equal(calls[0].policy, 'LEGACY'); assert.equal(draws.length, 2);
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
await test('P13 default OFF legacy Power R1 preserves two BaseRolls/scalarPATK16/early rounding', () => {
  const g = game({ optIn:false }), e = target(g), calls = ledger(g), hp = e.hp;
  const result = legacyCast(g,skillId); assert.equal(result.result,true); assert.equal(result.rolls.length,2);
  const expectedRaw = Math.round((12 + 6 * .25) * 4 + 16 * 1.20);
  assert.equal(calls[0].raw,expectedRaw); assert.equal(calls[0].policy,'LEGACY');
  close(hp-e.hp,expectedRaw*520/590); assert.equal(result.draws.length,2);
  evidence.push({case:'P13',result,calls,scope:'legacy isolation, NOT balance parity'});
});
await test('P14 coherent PowerR2/Quick/Minor/save remain legacy and do not enroll Power opt-in', () => {
  for (const id of [skillId,'v3-adventurer-quick-slash','v3-adventurer-minor-heal']) {
    const g = game(), e = target(g), calls = ledger(g);
    if (id !== 'v3-adventurer-quick-slash') {
      assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
      if(id===skillId){
        // Central rank-level repair requires Power R2 at its declared Lv7.
        const points=g.hero.skillPoints;assert.equal(g.learnSkill(id),false);assert.equal(g.hero.skillPoints,points);
        while(g.hero.level<7)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
      }
      assert(g.learnSkill(id));
    }
    if (id === 'v3-adventurer-minor-heal') {
      g.hero.hp-=20; const hp=g.hero.hp; rng(g,[]);
      assert(g.castSkill(id)); assert.equal(g.hero.hp-hp,Math.round(rules.maxHP(g.hero)*.06));
    } else {
      const result=legacyCast(g,id); assert(result.result); assert.equal(result.rolls.length,2);
      assert.equal(calls[0].policy,'LEGACY'); assert(e.hp<e.max);
      if (id===skillId) assert(reference.coherentHigherPowerRank(g.hero));
    }
    assert.equal(g.getDevelopmentPowerStrikeResult(),undefined);
  }
  const g=game(); g.save();
  const loaded=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId); loaded.started=true;
  loaded.actor.position.set(loaded.hero.x,0,loaded.hero.z); target(loaded); loaded.testFloats=[]; loaded.float=()=>{};
  for(const name of ['sound','effect','ring','pulse','arc'])loaded[name]=()=>{};
  assert(legacyCast(loaded,skillId).result); assert.equal(loaded.getDevelopmentPowerStrikeResult(),undefined);
});
await test('P15 authoritative original Game.rand advances attack/hit/Crit exactly once each', () => {
  const g = game(), e = target(g), hp = e.hp; g.seed = 1;
  const original = Game.prototype.rand.bind(g), draws = [];
  g.rand = () => { const value = original(); draws.push(value); return value; };
  const next = seed => (Math.imul(1664525, seed) + 1013904223) >>> 0;
  const seeds = [next(1)]; seeds.push(next(seeds[0]), next(next(seeds[0])));
  const result = cast(g); assert(result.ok); close(result.sample.totalRaw, (18 + 2 * seeds[0] / 4294967296) * 1.20);
  assert.deepEqual(draws, seeds.map(s => s / 4294967296)); assert.equal(g.seed, seeds[2]);
  assert.equal(hp - e.hp, Math.round(result.sample.totalRaw * 520 / 590));
  evidence.push({ case: 'P15', draws, result, finalSeed: g.seed, hpDelta: hp - e.hp });
});
await test('P16 mechanical BonusSTR scaling=.04, base15 not repeated; unsupported core/weapon context never world-admitted', () => {
  const scaling = foundation.composeBonusScaling({ STR: 25, VIT: 50, DEX: 50, INT: 50 }, { STR: .04 });
  assert(scaling.ok); assert.equal(scaling.value, .4);
  const neutral = foundation.composeBonusScaling({ STR:15,VIT:15,DEX:15,INT:15 },{STR:.04});
  assert(neutral.ok); assert.equal(neutral.value, 0);
});
await test('P17 missing source provenance and injected registry mechanics reject via actual cast before sampling', () => {
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
await test('P18 selected invalid route never falls back; stale binding stays stale until explicit rebind', () => {
  const invalid = game({ optIn:false }); target(invalid); invalid.hero.level = 1;
  assert.equal(invalid.enableDevelopmentPowerStrikeReference().ok, false); assert.equal(rejected(invalid).code, 'UNSUPPORTED_ACTOR');
  const g = game(), hero = g.hero; target(g); g.hero = {...hero};
  assert.equal(rejected(g).code, 'STALE_ACTOR_EPOCH'); g.hero = hero;
  assert.equal(rejected(g).code, 'STALE_ACTOR_EPOCH'); assert(g.enableDevelopmentPowerStrikeReference().ok);
  const first = castWithValues(g);
  g.skillCooldowns[skillId] = 0;
  assert(rules.equipItem(g.hero, g.hero.equipment.mainHand, 'mainHand').ok);
  assert.equal(rejected(g).code, 'STALE_ITEM_INSTANCE'); assert(g.enableDevelopmentPowerStrikeReference().ok);
  const next = castWithValues(g);
  assert(next.execution.owner.epoch > first.execution.owner.epoch);
  assert.notEqual(next.execution.executionId, first.execution.executionId);
});
function castWithValues(g) { rng(g,[.5,0,.99]); const result = cast(g); assert(result.ok); return result; }
await test('P19 current impact defense/evasion remain live; snapshot budget remains frozen', () => {
  const g = game(), e = target(g), calls = ledger(g), queue = deferRealQueue(g), hp = e.hp;
  rng(g,[.5,0,.99]); const result = cast(g); assert(result.ok); e.definition.defense = 200;
  queue.flush(); close(calls[0].raw,22.8); assert.equal(hp-e.hp,Math.round(22.8*520/720));
  const other = game(), t = target(other), noDamage = ledger(other), deferred = deferRealQueue(other);
  const draws = rng(other,[.5,.99]); assert(cast(other).ok); t.evasion=50; deferred.flush();
  assert.equal(noDamage.length,0); assert.equal(t.hp,t.max); assert.equal(draws.length,2);
});
await test('P20 slot2 and current hotbar consumer keep boolean acceptance; success and cooldown rejection remain distinct', () => {
  const g = game(); target(g); rng(g,[.5,0,.99]);
  assert.equal(withoutLegacyRandom(()=>g.castSkill(2)),true);
  assert(g.getDevelopmentPowerStrikeResult().ok);
  const before=commitment(g); rng(g,[]); assert.equal(g.castSkill(2),false);
  assert.equal(g.getDevelopmentPowerStrikeResult().code,'CAST_NOT_ALLOWED'); assert.deepEqual(commitment(g),before);
});


await test('P21 mitigation uses actual attackerLevel2, not copied Quick Lv1 constant',()=>{
  const g=game(), e=target(g,{defense:31}), calls=ledger(g), hp=e.hp; rng(g,[.5,0,.99]);
  assert(cast(g).ok); assert.equal(calls[0].attackerLevel,2);
  assert.equal(Math.round(22.8*520/551),22); assert.equal(Math.round(22.8*510/541),21);
  assert.equal(hp-e.hp,22); assert(g.testFloats.some(f=>f.text==='22'&&f.kind==='damage'));
  evidence.push({case:'P21',calls,hpDelta:hp-e.hp,expectedLevel2:22,rejectedLevel1:21});
});
await test('P22 independent authority excludes Basic/Quick tokens and catalog overrides',()=>{
  const g=game(), binding=reference.openPowerStrikeBinding(g); assert(binding.ok);
  assert.equal(basic.openBasicReferenceBinding(g).ok,false);
  assert.equal(reference.preparePowerStrike({version:basic.BASIC_REFERENCE_B.version},g,ADVENTURER_V3_RUNTIME_SKILLS[1]).ok,false);
  assert.equal(reference.preparePowerStrike(binding.value,g,ADVENTURER_V3_RUNTIME_SKILLS[1],undefined).ok,true);
  assert.equal(reference.preparePowerStrike(binding.value,g,ADVENTURER_V3_RUNTIME_SKILLS[1],null).code,'REFERENCE_PROVENANCE_MISMATCH');
  assert.equal(reference.preparePowerStrike(binding.value,g,ADVENTURER_V3_RUNTIME_SKILLS[1],{...basic.BASIC_REFERENCE_B}).code,'REFERENCE_PROVENANCE_MISMATCH');
});
await test('P23 post-RNG identity/resource/target guards reject without commitment; attempted draw cannot roll back',()=>{
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
await test('P24 production activation denied, and authority metadata preserved',()=>{
  const g=game({optIn:false}), saved=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{assert.equal(g.enableDevelopmentPowerStrikeReference().code,'DEVELOPMENT_ONLY');}finally{process.env.NODE_ENV=saved;}
  const definition=ADVENTURER_V3_RUNTIME_SKILLS[1];
  assert.equal(definition.castingTime,.35);assert.deepEqual(definition.baseDamageMinByRank,[12,15,18,21,24]);
  assert.equal(definition.skillPowerFactor,4);assert.equal(definition.knockbackStrength,undefined);
});
