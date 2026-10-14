// Offline ACTUAL Game.attack / equipment / mitigation / HP / death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const output = process.env.BASIC_REFERENCE_CHECKPOINT;
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
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'basic-vite-cache'),
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
const reference = await load('basic-attack-reference-v2');
const foundation = await load('attack-range-v2');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation'])
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
  g.started = true;
  g.testFloats = [];
  g.float = (...args) => g.testFloats.push({ text: args[1], kind: args[2] });
  for (const name of ['sound', 'effect', 'ring', 'pulse', 'arc']) g[name] = () => {};
  // createItem's template leaves can be shared. Isolate mutable mechanical
  // fixtures before testing malicious/malformed mutations; do not alter catalog.
  const sword = structuredClone(items.createItem(reference.BASIC_REFERENCE_B.templateId, { id: g.hero.slotId + '-training' }));
  g.hero.inventory.push(sword);
  assert(rules.equipItem(g.hero, sword.id, 'mainHand').ok);
  assert.notEqual(g.hero.inventory.find(i => i.id === sword.id), sword, 'equip clones inventory; bind current instance');
  if (optIn) assert(g.enableDevelopmentBasicReferenceB().ok);
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
    calls.push({ raw: args[1], policy: args[7], value, hpDelta: beforeHP - args[0].hp }); return value; };
  return calls;
}
function commitment(g) {
  return { hero: JSON.stringify(g.hero), temporaryOwn: Object.hasOwn(g.hero, 'temporaryModifiers'),
    signature: g.dualBasicEquipmentSignature, hand: g.dualBasicNextHand,
    direction: g.direction.toArray(), rotation: g.actor.rotation.toArray(), combo: g.combo, comboWindow: g.comboWindow,
    timer: g.attackTimer, swing: g.swing, animations: [...g.testAnimations], cooldowns: { ...g.skillCooldowns } };
}
function rejected(g, draws = []) {
  const before = commitment(g), random = rng(g, draws), result = g.attack();
  assert.deepEqual(commitment(g), before, 'rejection cannot commit actor/resources/presentation');
  assert.equal(random.length, draws.length);
  return result;
}
const close = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

await test('B01 approved integer BASE endpoints, real equip, raw18, independent hit/Crit, real HP and same feedback', () => {
  const g = game(), e = target(g), calls = ledger(g), draws = rng(g, [.5, 0, .99]);
  const mana = g.hero.mana, sp = g.hero.skillPoints, hp = e.hp;
  const result = g.attack(); assert(result.ok); assert.deepEqual(result.execution.weaponRanges.MAIN, { min: 9, max: 11 });
  assert.deepEqual(result.execution.hits[0].attack, { min: 17, max: 19 });
  assert.equal(result.sample.totalRaw, 18); assert.equal(result.execution.instances.MAIN.instanceId, g.hero.equipment.mainHand);
  assert.equal(result.execution.owner.actorId, g.hero.characterId); assert(result.execution.owner.epoch > 0);
  assert.deepEqual(draws, [.5, 0, .99]); assert.equal(calls.length, 1); assert.equal(calls[0].raw, 18);
  const expected = Math.round(18 * 510 / (510 + 70)); // Independent Lv1 mitigation, not the resolver under test.
  assert.equal(hp - e.hp, expected); assert.equal(calls[0].hpDelta, expected);
  assert(g.testFloats.some(f => f.kind === 'damage' && f.text === String(expected)));
  assert.equal(g.hero.mana, mana); assert.equal(g.hero.skillPoints, sp); assert(g.attackTimer > 0); assert.equal(g.combo, 1);
  evidence.push({ case: 'B01', result, draws, calls, hpDelta: hp - e.hp, feedback: g.testFloats });
});
await test('B02 continuous u=.25 remains raw17.5 until final mitigation rounding, not discrete or intermediate rounded', () => {
  const g = game(), e = target(g, { defense: 40 }), calls = ledger(g); rng(g, [.25, 0, .99]);
  const hp = e.hp, result = g.attack(); assert.equal(result.sample.totalRaw, 17.5); assert.equal(calls[0].raw, 17.5);
  const expected = Math.round(17.5 * 510 / 550); assert.equal(expected, 16);
  assert.notEqual(expected, Math.round(Math.round(17.5) * 510 / 550)); assert.equal(hp - e.hp, expected);
  assert(g.testFloats.some(f => f.kind === 'damage' && f.text === '16'));
  evidence.push({ case: 'B02', result, calls, hpDelta: hp - e.hp });
});
await test('B03 existing physical Crit resolves once after attack and avoidance, before mitigation', () => {
  const g = game(), e = target(g, { defense: 40 }), calls = ledger(g), draws = rng(g, [.25, 0, 0]);
  const hp = e.hp, result = g.attack(); assert.equal(result.sample.totalRaw, 17.5);
  assert.equal(calls[0].raw, 26.25); assert.equal(calls.length, 1); assert.equal(draws.length, 3);
  const expected = Math.round(26.25 * 510 / 550); assert.equal(hp - e.hp, expected);
  assert(g.testFloats.some(f => f.kind === 'damage' && f.text === String(expected)));
  evidence.push({ case: 'B03', result, calls, draws, hpDelta: hp - e.hp });
});
await test('B04 Evade has attack and hit draw only, no HP mutation or Crit/mitigation', () => {
  const g = game(), e = target(g, { evasion: 50 }), calls = ledger(g), draws = rng(g, [.5, .99]);
  const hp = e.hp, result = g.attack(); assert(result.ok); assert.equal(e.hp, hp); assert.equal(calls.length, 0);
  assert.equal(draws.length, 2); assert(g.testFloats.some(f => f.text === 'EVADE'));
  evidence.push({ case: 'B04', draws, hpDelta: 0, calls });
});
await test('B05 lethal real consumer processes death/rewards once and never damages dead target again', () => {
  const g = game(), e = target(g, { hp: 1 }), calls = ledger(g); delete e.definition;
  const draws = rng(g, [.5, 0, .99]), kills = g.hero.kills; assert(g.attack().ok);
  assert.equal(e.hp, 0); assert.equal(g.hero.kills, kills + 1); assert.equal(e.group.visible, false);
  assert.equal(calls.length, 1); assert.equal(calls[0].hpDelta, 1); assert.equal(draws.length, 3);
  assert(g.testFloats.some(f => f.kind === 'damage' && f.text === '18'));
  assert.equal(g.hurtEnemy(e, 100, 0, 'physical'), 0); assert.equal(g.hero.kills, kills + 1);
  g.attackTimer = 0; g.comboWindow = 0; rejected(g);
  evidence.push({ case: 'B05', draws, killsDelta: g.hero.kills - kills, hp: e.hp, feedback: g.testFloats });
});
await test('B06 immutable snapshot is not rerolled when gear changes after commitment begins', () => {
  const g = game(), e = target(g), calls = ledger(g); let n = 0;
  g.rand = () => { if (++n === 1) { g.hero.inventory.find(i => i.id === g.hero.equipment.mainHand).baseStats.attack = 999; return .5; } return .99; };
  const result = g.attack(); assert(result.ok); assert.equal(result.sample.totalRaw, 18); assert.equal(n, 3);
  assert.equal(calls[0].raw, 18); assert(Object.isFrozen(result.execution)); assert(Object.isFrozen(result.sample.hits[0]));
  assert.throws(() => { result.execution.weaponRanges.MAIN.min = 1; }, TypeError);
  assert(e.hp < e.max);
});

const badContexts = {
  'job': g => { g.hero.job = 'warrior'; }, 'core': g => { g.hero.coreJob = 'warrior'; },
  'specialization': g => { g.hero.specialization = 'berserker'; }, 'level': g => { g.hero.level = 2; },
  'allocated-primary': g => { g.hero.allocatedStats.str = 1; }, 'missing-primary': g => { delete g.hero.allocatedStats.int; },
  'equipment-primary': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.str = 1; },
  'global-flat': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.attack = 10; },
  'outgoing-percent': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.physicalDamage = 1; },
  'enhancement': g => { g.hero.inventory.find(i => i.isEquipped).enhancementLevel = 1; },
  'wrong-template': g => { g.hero.inventory.find(i => i.isEquipped).templateId = 'legacy-fajar-blade'; },
  'wrong-hand': g => { g.hero.inventory.find(i => i.isEquipped).handedness = 'two_hand'; },
  'support-not-physical-weapon': g => { g.hero.inventory.find(i => i.isEquipped).equipmentType = 'tome'; },
  'off-filled': g => { g.hero.equipment.offHand = g.hero.equipment.mainHand; },
  'slot-missing': g => { delete g.hero.equipment.offHand; },
  'other-gear': g => { g.hero.equipment.head = 'unowned-head'; },
  'missing-instance': g => { g.hero.inventory = g.hero.inventory.filter(i => !i.isEquipped); },
  'duplicate-instance': g => { g.hero.inventory.push({ ...g.hero.inventory.find(i => i.isEquipped) }); },
  'wrong-owner': g => { g.hero.characterId = 'other-owner'; },
  'wrong-slot-owner': g => { g.hero.slotId = 'other-slot'; },
  'stale-hero-epoch': g => { g.hero = { ...g.hero }; },
  'stale-item-copy': g => { g.hero.inventory = g.hero.inventory.map(i => ({ ...i })); },
  'changed-instance-id': g => { const item = g.hero.inventory.find(i => i.isEquipped); item.id += '-reidentified'; g.hero.equipment.mainHand = item.id; },
  'inherited-primary': g => { g.hero.allocatedStats = Object.create({ str: 0, vit: 0, dex: 0, int: 0 }); },
  'missing-bonus-context': g => { delete g.hero.inventory.find(i => i.isEquipped).bonusStats; },
  'temporary-buff': g => { g.hero.temporaryModifiers = [{ modifier: { id: 'mechanical-buff', stats: { flat: { physicalAttack: 1 } } }, remaining: 1 }]; },
  'passive': g => { g.hero.passiveLevels['mechanical-passive'] = 1; },
  'rune': g => { g.hero.inventory.find(i => i.isEquipped).sockets.push({ id: 'mechanical-socket', rune: null }); },
  'unique': g => { g.hero.inventory.find(i => i.isEquipped).uniqueEffect = 'mechanical-unique'; },
  'pet': g => { g.hero.pet = { bonusStats: { str: 1 } }; },
  'malformed-bonus': g => { g.hero.inventory.find(i => i.isEquipped).bonusStats.attack = NaN; },
  'combo2': g => { g.combo = 1; g.comboWindow = 1; }, 'combo3': g => { g.combo = 2; g.comboWindow = 1; },
};
for (const [name, change] of Object.entries(badContexts)) await test(`B07 reject ${name} before RNG/facing/cycle/combo/timer/resources/animation`, () => {
  const g = game(); target(g); change(g); const result = rejected(g); assert.equal(result.ok, false);
});

await test('B08 stun/action lock/timer/inactive/dead/missing/dead/stale/out-of-range targets cannot sample or commit', () => {
  const cases = [g => { g.hero.stunState = { expiresAt: 10 }; }, g => { g.actionLock.start(0, 1); },
    g => { g.attackTimer = 1; }, g => { g.thiefMovement = {}; }, g => { g.paused = true; }, g => { g.started = false; },
    g => { g.dead = true; }, g => { g.hotbarInteracting = true; }, g => { g.hero.hp = 0; },
    g => { g.clearCurrentTarget(); }, (g, e) => { e.hp = 0; }, (g, e) => { e.spawnGeneration++; },
    (g, e) => { e.group.position.z -= 100; }];
  for (const change of cases) { const g = game(), e = target(g); change(g, e); rejected(g); }
});
await test('B09 invalid attack RNG is structured failure; exceptions forwarded, both before any commitment', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 1, undefined]) {
    const g = game(); target(g); const result = rejected(g, [value]); assert.equal(result.code, 'RNG_INVALID');
  }
  const g = game(); target(g); const before = commitment(g), error = new Error('mechanical RNG error'), draws = rng(g, [error]);
  assert.throws(() => g.attack(), e => e === error); assert.equal(draws.length, 1); assert.deepEqual(commitment(g), before);
});
await test('B10 same-ID replacement cannot regain stale binding; re-equip needs an explicit new epoch', () => {
  const g = game(), original = g.hero; target(g); g.hero = { ...original };
  assert.equal(rejected(g).code, 'STALE_ACTOR_EPOCH'); g.hero = original;
  assert.equal(rejected(g).code, 'STALE_ACTOR_EPOCH'); assert(g.enableDevelopmentBasicReferenceB().ok);
  const first = g.attack.bind(g); rng(g, [.5, 0, .99]); const result = first();
  g.attackTimer = 0; g.comboWindow = 0; assert(rules.equipItem(g.hero, g.hero.equipment.mainHand, 'mainHand').ok);
  assert.equal(rejected(g).code, 'STALE_ITEM_INSTANCE'); assert(g.enableDevelopmentBasicReferenceB().ok);
  rng(g, [.5, 0, .99]); const next = g.attack(); assert(next.execution.owner.epoch > result.execution.owner.epoch);
  assert.notEqual(next.execution.executionId, result.execution.executionId);
});
await test('B11 forged binding/host and missing/malformed reference rejected, not silently normalized or legacy fallback', () => {
  const g = game(), binding = reference.openBasicReferenceBinding(g); assert(binding.ok);
  assert.equal(reference.prepareBasicReferenceAttack({ version: reference.BASIC_REFERENCE_B.version }, g, 1).code, 'BINDING_IDENTITY_MISMATCH');
  assert.equal(reference.prepareBasicReferenceAttack(binding.value, { hero: g.hero }, 1).code, 'BINDING_IDENTITY_MISMATCH');
  for (const metadata of [null, {}, { ...reference.BASIC_REFERENCE_B, baseRange: undefined },
    { ...reference.BASIC_REFERENCE_B, baseRange: { min: 11, max: 9 } }, { ...reference.BASIC_REFERENCE_B, baseRange: { min: NaN, max: 11 } }])
    assert.equal(reference.prepareBasicReferenceAttack(binding.value, g, 1, metadata).code, 'REFERENCE_PROVENANCE_MISMATCH');
  assert(Object.isFrozen(reference.BASIC_REFERENCE_B.baseRange));
  assert.throws(() => { reference.BASIC_REFERENCE_B.baseRange.min = 0; }, TypeError);
  // Missing catalog provenance is rejected THROUGH actual world, not a callback replacement.
  target(g); const catalog = items.ITEM_CATALOG[reference.BASIC_REFERENCE_B.templateId];
  try { delete items.ITEM_CATALOG[reference.BASIC_REFERENCE_B.templateId]; assert.equal(rejected(g).code, 'CATALOG_PROVENANCE_MISMATCH'); }
  finally { items.ITEM_CATALOG[reference.BASIC_REFERENCE_B.templateId] = catalog; }
});
await test('B12 prepared snapshot correlates epoch/instance, expectation pure and default setup/save does not opt in', () => {
  const g = game({ optIn: false }), binding = reference.openBasicReferenceBinding(g); assert(binding.ok);
  const prepared = reference.prepareBasicReferenceAttack(binding.value, g, 1); assert(prepared.ok);
  assert.equal(prepared.value.snapshot.instances.MAIN.instanceId, g.hero.equipment.mainHand);
  assert.deepEqual(prepared.value.snapshot.instances.MAIN.owner, prepared.value.snapshot.owner);
  assert.equal(foundation.expectedRawAttackExecution(prepared.value.snapshot).value.totalRaw, 18);
  target(g); const draws = rng(g, [0, .99]), calls = ledger(g); const result = g.attack();
  assert.equal(result, undefined); assert.equal(draws.length, 2); assert.equal(calls[0].raw, 15);
  assert.equal(calls[0].policy, 'LEGACY'); close(calls[0].hpDelta, 15 * 510 / 580);
  evidence.push({ case: 'B12', scope: 'non-opt-in Training Sword scalar prototype', draws, calls });
});
await test('B13 legacy combo finisher and target/timer behavior unchanged, no reference1 contribution or final rounding', () => {
  const g = game({ optIn: false }), e = target(g), calls = ledger(g); g.combo = 2; g.comboWindow = 1;
  const hp = e.hp, draws = rng(g, [0, .99]); g.attack(); assert.equal(g.combo, 3);
  assert.equal(draws.length, 2); assert.equal(calls[0].raw, Math.round(15 * 1.65));
  close(hp - e.hp, 25 * 510 / 580); assert.equal(calls[0].policy, 'LEGACY');
  const raw = rules.basicAttackPower(g.hero); assert.equal(raw, 15, '8 + scalar8*.90 rounds to15 on unchanged legacy path');
  const before = commitment(g); g.attack(); assert.deepEqual(commitment(g), before);
});
await test('B14 selected-but-invalid route fails closed rather than using existing V3 on attack', () => {
  const g = game({ optIn: false }); target(g); g.hero.level = 2;
  assert.equal(g.enableDevelopmentBasicReferenceB().ok, false); assert.equal(rejected(g).code, 'UNSUPPORTED_ACTOR');
});
await test('B15 original Game RNG advances once for attack, once for hit and once for allowed Crit', () => {
  const g = game(), e = target(g, { defense: 40 });
  g.seed = 1;
  const original = Game.prototype.rand.bind(g), draws = [];
  g.rand = () => { const value = original(); draws.push(value); return value; };
  const next = seed => (Math.imul(1664525, seed) + 1013904223) >>> 0;
  const attackSeed = next(1), hitSeed = next(attackSeed), critSeed = next(hitSeed);
  const u = attackSeed / 4294967296, raw = 17 + 2 * u, hp = e.hp;
  const result = g.attack(); assert(result.ok); assert.equal(result.sample.u, u); assert.equal(result.sample.totalRaw, raw);
  assert.deepEqual(draws, [u, hitSeed / 4294967296, critSeed / 4294967296]); assert.equal(g.seed, critSeed);
  assert.equal(hp - e.hp, Math.round(raw * 510 / 550));
  evidence.push({ case: 'B15', origin: 'original Game.prototype.rand with forwarding spy', draws, initialSeed: 1,
    finalSeed: g.seed, raw, hpDelta: hp - e.hp, result });
});
