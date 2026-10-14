// Offline integration: real Game constructor, casts, schedulers, tick consumers,
// mitigation and HP/death. Only DOM/WebGL/audio are synthetic. Not browser parity.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import * as T from 'three';

const storage = new Map();
const memory = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), remove() {},
  getContext: () => ({ clearRect() {}, fillRect() {} }) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline' }, addEventListener() {}, removeEventListener() {} },
  document: { createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {} });
const server = await createServer({ configFile: false, appType: 'custom',
  cacheDir: path.resolve(process.env.POISON_CRIT_CHECKPOINT ?? 'outputs/gameplay-migration/assasin-poison-crit-runtime-fix', 'offline-vite-cache'),
  server: { middlewareMode: true }, resolve: { alias: { '@': process.cwd() } },
  plugins: [{ name: 'offline-poison-renderer-only', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:poison-test-three') return '\0poison-test-three'; },
    load(id) { if (id === '\0poison-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      setPixelRatio(){} setSize(){} dispose(){} forceContextLoss(){} }`; },
    transform(source, id) {
      if (id.replaceAll('\\', '/').endsWith('/lib/game/world.ts'))
        return source.replace("import * as T from 'three';", "import * as T from 'virtual:poison-test-three';");
    },
  }] });
after(async () => { await server.close(); });
const load = name => server.ssrLoadModule('/lib/game/' + name + '.ts');
const { Game } = await load('world');
const rules = await load('rules');
const { createItem } = await load('items');
const { VENOM_PROFILES, ECLIPSE_PROFILES } = await load('assasin-v3');
const { poisonTickRaw } = await load('assasin-poison');
const { resolveCriticalDamage, resolveCombatDamage } = await load('combat-resolver');

// No combat, state, constructor, cast, tick callback or mitigation method is replaced.
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play() {} }, ready: Promise.resolve(true), dispose() {} };
};
let serial = 0;
function game() {
  const h = rules.createV3AdventurerHero('poison-world-' + (++serial));
  h.level = 70; h.skillProgressionV3.totalEarnedSP = rules.getTotalSkillPointsForLevel(h.level);
  for (const slot of Object.keys(h.equipment)) if (h.equipment[slot]) rules.unequipItem(h, slot);
  assert(rules.chooseV3Thief(h)); assert(rules.chooseV3Assasin(h));
  for (const [slug, ranks] of Object.entries({ 'venom-mastery': 3, 'poison-dagger': 3, 'crippling-dagger': 1, 'backstep-fang': 1, 'venom-eclipse': 1, vanish: 1 }))
    for (let i = 0; i < ranks; i++) assert(rules.learnSkill(h, 'v3-assasin-' + slug), 'legal rank ' + slug);
  for (const slot of ['mainHand', 'offHand']) {
    // Synthetic unlocked option uses the existing weapon Crit Damage minimum.
    // This exercises non-default resolved Crit without changing any live template.
    const item = createItem('whispering-offhand-dagger', { id: h.slotId + '-' + slot,
      bonusStats: { critDamage: 4 }, uniqueStatsLocked: false });
    h.inventory.push(item); assert(rules.equipItem(h, item.id, slot).ok);
  }
  h.hp = rules.derivedStats(h).maxHP; h.mana = rules.derivedStats(h).maxMana;
  storage.clear(); rules.saveCharacter(h, true);
  const g = new Game(element(), element(), element(), () => {}, () => {}, h.slotId);
  g.started = true;
  g.float = () => {}; g.sound = () => {}; g.effect = () => {}; g.ring = () => {}; g.pulse = () => {}; g.arc = () => {};
  return g;
}
function target(g, { boss = false, defense = 70, magicDefense = 300, hp = 100000, dummy = false } = {}) {
  const group = new T.Group(); group.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
  group.position.copy(g.actor.position).add(new T.Vector3(0, 0, -1));
  const e = { id: ++serial, group, home: group.position.clone(), hp, max: hp, boss, dummy,
    spawnGeneration: 0, respawnKey: 'synthetic-' + serial,
    definition: { defense, magicDefense },
    ring: new T.Mesh(new T.RingGeometry(), new T.MeshBasicMaterial()),
    windup: 0, cooldown: 0, flash: 0, stun: 0, slow: 0, root: 0, poison: 0, defenseDown: 0,
    statusEffects: {}, attack: 10, attackRange: 2, movementSpeed: 1, marked: false, weakPoint: false };
  g.scene.add(group); g.enemies.push(e); g.registerTargetEnemy(e);
  assert(g.setCurrentTarget(e)); return e;
}
const owner = g => g.hero.characterId ?? g.hero.slotId;
function cast(g, id = 'v3-assasin-poison-dagger') {
  assert(g.castSkill(id), JSON.stringify({ id, notice: g.notice, failure: g.lastActionFailure }));
  g.stepSkillRuntime(1);
}
function ledger(g) {
  const calls = [], original = g.hurtEnemy.bind(g);
  // A forwarding spy preserves the actual world mitigation/HP/death consumer.
  g.hurtEnemy = (...args) => { const result = original(...args); calls.push({ args, result }); return result; };
  return calls;
}
function rng(g, value) {
  let count = 0;
  // Deterministic offline fixture only; no live/browser RNG is overridden.
  g.rand = () => { count++; return value; };
  return () => count;
}
function expectedDamage(e, snapshot, raw, damageType = 'physical') {
  return resolveCombatDamage({ rawDamage: raw, damageType, attackerLevel: snapshot.level,
    physicalDefense: e.definition.defense, magicDefense: e.definition.magicDefense,
    physicalPenetration: snapshot.physicalPenetration, magicPenetration: 0,
    targetBonusPercent: e.boss ? snapshot.bossDamage : 0 });
}
function close(actual, expected) { assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

await test('P01 actual Game cast stores resolved caster Crit in normal Poison snapshot', () => {
  const g = game(), e = target(g); rng(g, 0); const stats = rules.derivedStats(g.hero);
  e.criticalRate = 0; e.criticalDamage = 999; // Target stats must not enter caster snapshot.
  cast(g); const r = g.assasinPoison.getRecord(owner(g), e, 0);
  assert.equal(r.casterActorId, owner(g));
  assert.equal(r.targetActorId, `${e.group.uuid}:${e.spawnGeneration}`);
  assert.equal(r.snapshot.criticalRate, stats.criticalRate);
  assert.equal(r.snapshot.criticalDamage, stats.criticalDamage);
});
await test('P02 marked normal Poison uses original world callback, one Crit and one mitigation', () => {
  const g = game(), e = target(g, { boss: true }); rng(g, 0); cast(g);
  const r = g.assasinPoison.getRecord(owner(g), e, 0), calls = ledger(g), count = rng(g, 0), hp = e.hp;
  const raw = poisonTickRaw(r.profile, r.snapshot, r.stackCount, r.profile.baseDamageMin);
  g.assasinPoison.advanceTarget(e, 1);
  assert.equal(count(), 2, 'one base roll, one Crit roll through Game.rand');
  assert.equal(calls.length, 1); close(calls[0].args[1], raw * r.snapshot.criticalDamage / 100);
  close(hp - e.hp, expectedDamage(e, r.snapshot, raw * r.snapshot.criticalDamage / 100));
  assert.equal(calls[0].args[6], 'poison_dot');
  g.assasinPoison.advanceTarget(e, 1); assert.equal(calls.length, 1, 'same clock cannot duplicate tick');
});
await test('P03 failed Crit roll leaves normal tick potency unchanged', () => {
  const g = game(), e = target(g); rng(g, 0); cast(g);
  const r = g.assasinPoison.getRecord(owner(g), e, 0), calls = ledger(g), count = rng(g, .999), hp = e.hp;
  const roll = r.profile.baseDamageMin + (r.profile.baseDamageMax - r.profile.baseDamageMin) * .999;
  const raw = poisonTickRaw(r.profile, r.snapshot, r.stackCount, roll);
  g.assasinPoison.advanceTarget(e, 1); assert.equal(count(), 2); close(calls[0].args[1], raw);
  close(hp - e.hp, expectedDamage(e, r.snapshot, raw));
});
await test('P04 application and refresh snapshot Crit at existing successful-impact boundary', () => {
  const g = game(), e = target(g); rng(g, 0);
  assert(g.castSkill('v3-assasin-poison-dagger'));
  rules.unequipItem(g.hero, 'offHand');
  const impact = rules.derivedStats(g.hero); g.stepSkillRuntime(1);
  const first = g.assasinPoison.getRecord(owner(g), e, 0);
  assert.equal(first.snapshot.criticalRate, impact.criticalRate);
  assert.equal(first.snapshot.criticalDamage, impact.criticalDamage);
  const off = g.hero.inventory.find(i => i.id === g.hero.slotId + '-offHand');
  assert(rules.equipItem(g.hero, off.id, 'offHand').ok);
  const refreshed = rules.derivedStats(g.hero);
  assert(refreshed.criticalRate > impact.criticalRate, 'equipped dagger changes resolved Crit Rate');
  assert(refreshed.criticalDamage > impact.criticalDamage, 'unlocked option changes resolved Crit Damage');
  g.skillCooldowns['v3-assasin-poison-dagger'] = 0; cast(g);
  const second = g.assasinPoison.getRecord(owner(g), e, 0);
  assert.equal(second.stackCount, 2); assert.equal(second.nextTickAt, first.nextTickAt);
  assert.equal(second.snapshot.criticalRate, refreshed.criticalRate);
  assert.equal(second.snapshot.criticalDamage, refreshed.criticalDamage);
  rules.unequipItem(g.hero, 'offHand'); const calls = ledger(g);
  const betweenRates = (impact.criticalRate + refreshed.criticalRate) / 200;
  rng(g, betweenRates); // Crit with refreshed snapshot, not the current unequipped caster.
  g.assasinPoison.advanceTarget(e, 1);
  const roll = second.profile.baseDamageMin + (second.profile.baseDamageMax - second.profile.baseDamageMin) * betweenRates;
  const raw = poisonTickRaw(second.profile, second.snapshot, 2, roll);
  close(calls[0].args[1], raw * refreshed.criticalDamage / 100);
});
await test('P05 actual Eclipse cast uses snapshotted caster Crit and original world mitigation', () => {
  const g = game(), e = target(g); rng(g, 0); const stats = rules.derivedStats(g.hero);
  cast(g, 'v3-assasin-venom-eclipse');
  rules.unequipItem(g.hero, 'offHand');
  const current = rules.derivedStats(g.hero), betweenRates = (stats.criticalRate + current.criticalRate) / 200;
  assert(stats.criticalRate > current.criticalRate);
  const calls = ledger(g), count = rng(g, betweenRates), hp = e.hp, p = ECLIPSE_PROFILES[0];
  const roll = p.min + (p.max - p.min) * betweenRates;
  const raw = roll * 10 + stats.physicalAttack * p.physical + Math.max(0, stats.dex - 15) * p.dex;
  g.assasinCombat.advanceTarget(e, 1);
  assert.equal(count(), 2); assert.equal(calls.length, 1);
  assert.equal(calls[0].args[4].criticalRate, stats.criticalRate);
  assert.equal(calls[0].args[4].criticalDamage, stats.criticalDamage);
  close(calls[0].args[1], raw * stats.criticalDamage / 100);
  close(hp - e.hp, expectedDamage(e, { ...stats, level: g.hero.level }, raw * stats.criticalDamage / 100));
  g.assasinCombat.advanceTarget(e, 1); assert.equal(calls.length, 1);
});
await test('P06 unmarked Poison scheduler reaches original world callback without a Crit roll', () => {
  const g = game(), e = target(g), stats = rules.derivedStats(g.hero), profile = { ...VENOM_PROFILES[0], critException: undefined };
  const snapshot = { ...stats, effectiveDex: stats.dex, level: g.hero.level };
  assert(g.assasinPoison.applyPoisonStack(g.hero, e, { sourceSkillId: profile.id, targetActorId: e.group.uuid,
    profile, snapshot, successfulDamage: 1 }, 0));
  const calls = ledger(g), count = rng(g, 0), hp = e.hp;
  g.assasinPoison.advanceTarget(e, 1);
  const raw = poisonTickRaw(profile, snapshot, 1, profile.baseDamageMin);
  assert.equal(count(), 1, 'only base roll, no Crit roll'); close(calls[0].args[1], raw);
  close(hp - e.hp, expectedDamage(e, snapshot, raw));
});
await test('P07 shared policy rejects generic DoT and marked magic; actual world magic sink remains non-Crit', () => {
  const noRoll = () => { throw Error('non-eligible damage must not roll Crit'); };
  const policy = { damageKind: 'dot', canCrit: true, criticalRate: 100, criticalDamage: 300 };
  assert.equal(resolveCriticalDamage(100, { ...policy, damageType: 'physical' }, noRoll), 100);
  assert.equal(resolveCriticalDamage(100, { ...policy, damageType: 'magic', critException: 'assassin_skill_poison' }, noRoll), 100);
  const g = game(), e = target(g), stats = rules.derivedStats(g.hero), hp = e.hp;
  g.rand = noRoll;
  g.hurtEnemy(e, 100, 0, 'magic', stats, g.hero.level, 'poison_dot');
  close(hp - e.hp, expectedDamage(e, { ...stats, level: g.hero.level }, 100, 'magic'));
});
await test('P08 pending toxins keep caster snapshot after Hero replacement or caster death', () => {
  for (const mode of ['replacement', 'death']) {
    const g = game(), e = target(g); rng(g, 0); cast(g); cast(g, 'v3-assasin-venom-eclipse');
    const r = g.assasinPoison.getRecord(owner(g), e, 0), calls = ledger(g);
    if (mode === 'replacement') g.hero = rules.createV3AdventurerHero('other-caster');
    else { g.hero.hp = 0; g.dead = true; }
    g.assasinPoison.advanceTarget(e, 1); g.assasinCombat.advanceTarget(e, 1);
    assert.equal(calls.length, 2);
    for (const c of calls) { assert.equal(c.args[4].criticalRate, r.snapshot.criticalRate); assert.equal(c.args[4].criticalDamage, r.snapshot.criticalDamage); }
  }
});
await test('P09 Crit ticks preserve Vanish, cadence, Slow, expiry and separate normal/Eclipse schedules', () => {
  const g = game(), e = target(g); rng(g, 0); cast(g, 'v3-assasin-crippling-dagger');
  const before = g.assasinPoison.getRecord(owner(g), e, 0), slow = g.assasinPoison.getPoisonSlow(owner(g), e, 0);
  cast(g, 'v3-assasin-venom-eclipse'); assert(g.castSkill('v3-assasin-vanish'));
  const calls = ledger(g), normal = g.assasinPoison.getRecord(owner(g), e, 0);
  assert.equal(normal.stackCount, before.stackCount); assert.equal(normal.expiresAt, 10);
  g.assasinPoison.advanceTarget(e, 1); g.assasinCombat.advanceTarget(e, 1);
  assert.equal(calls.length, 2); assert(g.vanish.status(g.hero));
  assert.equal(g.assasinPoison.getPoisonSlow(owner(g), e, 1), slow);
  g.assasinPoison.advanceTarget(e, 10); g.assasinCombat.advanceTarget(e, 10);
  assert.equal(calls.length, 20, 'ten ticks each, including final expiry tick');
  assert(!g.assasinPoison.hasPending(e)); assert(!g.assasinCombat.hasPending(e));
  g.assasinPoison.advanceTarget(e, 20); g.assasinCombat.advanceTarget(e, 20); assert.equal(calls.length, 20);
  assert(g.vanish.status(g.hero));
});
await test('P10 lethal Crit reaches real death once and clears both pending stores', () => {
  for (const killer of ['normal', 'eclipse']) {
    const g = game(), e = target(g); rng(g, 0); cast(g); cast(g, 'v3-assasin-venom-eclipse');
    // Target fixture starts nonlethal for applications; the lethal assertion uses
    // the unmodified Game death/reward/save path with a minimal synthetic monster.
    delete e.definition; e.hp = 1; const kills = g.hero.kills, calls = ledger(g), count = rng(g, 0);
    const first = killer === 'normal' ? g.assasinPoison : g.assasinCombat;
    const second = killer === 'normal' ? g.assasinCombat : g.assasinPoison;
    first.advanceTarget(e, 10); second.advanceTarget(e, 10);
    assert.equal(e.hp, 0); assert.equal(g.hero.kills, kills + 1); assert.equal(calls.length, 1); assert.equal(count(), 2);
    assert(!g.assasinPoison.hasPending(e)); assert(!g.assasinCombat.hasPending(e)); assert.equal(e.group.visible, false);
    first.advanceTarget(e, 20); second.advanceTarget(e, 20);
    assert.equal(g.hero.kills, kills + 1); assert.equal(calls.length, 1);
  }
});
await test('P11 runtime RNG advances exactly once for base roll and once for qualifying Crit', () => {
  const g = game(), e = target(g); rng(g, 0); cast(g);
  const record = g.assasinPoison.getRecord(owner(g), e, 0), calls = ledger(g);
  g.rand = Game.prototype.rand.bind(g); g.seed = 1;
  const next = seed => (Math.imul(1664525, seed) + 1013904223) >>> 0;
  const first = next(1), second = next(first);
  const roll = record.profile.baseDamageMin + (record.profile.baseDamageMax - record.profile.baseDamageMin) * first / 4294967296;
  const raw = poisonTickRaw(record.profile, record.snapshot, record.stackCount, roll);
  const critical = second / 4294967296 < Math.min(.8, record.snapshot.criticalRate / 100);
  g.assasinPoison.advanceTarget(e, 1);
  assert.equal(g.seed, second); close(calls[0].args[1], raw * (critical ? record.snapshot.criticalDamage / 100 : 1));
});
await test('P12 real REFRESH_OR_APPLY skill replaces caster Crit snapshot without adding a stack', () => {
  const g = game(), e = target(g); rng(g, 0); cast(g);
  const before = g.assasinPoison.getRecord(owner(g), e, 0);
  rules.unequipItem(g.hero, 'offHand'); const stats = rules.derivedStats(g.hero);
  cast(g, 'v3-assasin-backstep-fang');
  const refreshed = g.assasinPoison.getRecord(owner(g), e, 0);
  assert.equal(refreshed.stackCount, before.stackCount); assert.equal(refreshed.nextTickAt, before.nextTickAt);
  assert.equal(refreshed.snapshot.criticalRate, stats.criticalRate);
  assert.equal(refreshed.snapshot.criticalDamage, stats.criticalDamage);
  assert.notEqual(refreshed.snapshot.criticalDamage, before.snapshot.criticalDamage);
  const calls = ledger(g); g.assasinPoison.advanceTarget(e, 1);
  const raw = poisonTickRaw(refreshed.profile, refreshed.snapshot, refreshed.stackCount, refreshed.profile.baseDamageMin);
  close(calls[0].args[1], raw * stats.criticalDamage / 100);
});
await test('P13 actual Eclipse reapplication replaces Crit snapshot after settling old due ticks', () => {
  const g = game(), e = target(g); rng(g, 0); cast(g, 'v3-assasin-venom-eclipse');
  const old = rules.derivedStats(g.hero); rules.unequipItem(g.hero, 'offHand');
  const current = rules.derivedStats(g.hero), calls = ledger(g);
  g.poisonTime = 2; g.skillCooldowns['v3-assasin-venom-eclipse'] = 0;
  cast(g, 'v3-assasin-venom-eclipse');
  const oldTicks = calls.filter(c => c.args[6] === 'poison_dot');
  assert.equal(oldTicks.length, 2);
  for (const c of oldTicks) assert.equal(c.args[4].criticalDamage, old.criticalDamage);
  calls.length = 0; g.assasinCombat.advanceTarget(e, 3);
  assert.equal(calls.length, 1); assert.equal(calls[0].args[4].criticalDamage, current.criticalDamage);
  assert.equal(calls[0].args[4].criticalRate, current.criticalRate);
  assert.notEqual(current.criticalDamage, old.criticalDamage);
});
