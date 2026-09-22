import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resourcePolicy,
  isResourceEnabled,
  STAMINA_ENABLED,
} from './gameplay-config.ts';
import {
  freshHero,
  createV2TestHero,
  derivedStats,
  parseSave,
  consumeInventoryItem,
} from './rules.ts';
import {
  ITEM_CATALOG,
  RUNE_THEME_POOLS,
  UNIQUE_STAT_POOL,
  createItem,
  normalizeStatBlock,
} from './items.ts';
import { ALL_SKILLS, ALL_PASSIVES, PASSIVE_EFFECTS } from './skills.ts';
import { CHARACTER_STAT_ROWS, attributeEffects } from './character-screen.ts';
import {
  getCombatPower,
  buildCombatPowerProfile,
  calculateCombatPowerFromStats,
} from './combat-power.ts';
import { healAtCity } from './city-services.ts';

void test('2C policy: HP/Mana universal; V2 stamina stays off even under an enabled legacy policy', () => {
  const legacy = freshHero(),
    v2 = createV2TestHero();
  assert.equal(isResourceEnabled(legacy, 'stamina'), STAMINA_ENABLED);
  for (const legacyEnabled of [false, true]) {
    assert.equal(resourcePolicy(legacy, legacyEnabled).stamina, legacyEnabled);
    assert.equal(resourcePolicy(v2, legacyEnabled).stamina, false);
    assert.equal(resourcePolicy(v2, legacyEnabled).mana, true);
    assert.equal(resourcePolicy(v2, legacyEnabled).hp, true);
  }
});
void test('2C VIT remains useful without V2 stamina stat or compensation; legacy formula unchanged', () => {
  const v2 = createV2TestHero(),
    before = derivedStats(v2);
  v2.allocatedStats.vit = 10;
  const after = derivedStats(v2);
  assert.equal(before.staminaMax, 0);
  assert.equal(after.staminaMax, 0);
  assert.equal(after.maxHP - before.maxHP, 80);
  assert.equal(after.physicalDefense - before.physicalDefense, 5);
  assert(!CHARACTER_STAT_ROWS.some((row) => row.id === 'staminaMax'));
  assert(!attributeEffects(v2, 'vit').some((row) => row.id === 'staminaMax'));
  const legacy = freshHero();
  const original = derivedStats(legacy, legacy.allocatedStats, {});
  assert.equal(
    derivedStats(legacy, legacy.allocatedStats, { stamina: 50 }).staminaMax,
    original.staminaMax + 50,
  );
  legacy.allocatedStats.vit = 10;
  assert.equal(
    derivedStats(legacy, legacy.allocatedStats, {}).staminaMax,
    original.staminaMax + 40,
  );
});
void test('2C stamina item modifiers are retained as data but have no V2 stat or CP effect', () => {
  const hero = createV2TestHero();
  const item = hero.inventory.find((i) => i.id === hero.equipment.mainHand)!;
  hero.stamina = 0;
  const before = derivedStats(hero),
    cp = getCombatPower(hero);
  item.bonusStats = {
    ...item.bonusStats,
    ...normalizeStatBlock({
      stamina: 999,
      staminaRegen: 99,
      staminaCostReduction: 90,
    }),
  };
  hero.stamina = 9999;
  assert.deepEqual(derivedStats(hero), before);
  assert.deepEqual(getCombatPower(hero), cp);
  const profile = buildCombatPowerProfile(hero, before);
  assert.deepEqual(
    calculateCombatPowerFromStats({ ...before, staminaMax: 99999 }, profile),
    calculateCombatPowerFromStats(before, profile),
  );
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(
    restored.inventory.find((i) => i.id === item.id)!.bonusStats.stamina,
    999,
  );
  assert.equal(derivedStats(restored).staminaMax, 0);
});
void test('2C old/current saves accept stamina and extra legacy aliases without V2 gameplay dependency', () => {
  for (const hero of [freshHero(), createV2TestHero()]) {
    const raw = {
      ...hero,
      stamina: 17,
      maxStamina: 220,
      staminaMax: 220,
      staminaRegen: 18,
    };
    const loaded = parseSave(JSON.stringify(raw))!;
    assert(loaded);
    assert.equal(loaded.stamina, 17);
    assert.equal(loaded.characterId, hero.characterId);
    assert.equal(loaded.level, hero.level);
    assert.deepEqual(loaded.skillLevels, hero.skillLevels);
    assert.equal(parseSave(JSON.stringify(loaded))!.stamina, 17);
    const { stamina: _unused, ...without } = raw;
    void _unused;
    assert(parseSave(JSON.stringify(without)));
  }
});
void test('2C healer and stamina food cannot activate V2 stamina or consume the inactive item', () => {
  const hero = createV2TestHero();
  hero.inCity = true;
  hero.hp = 1;
  hero.mana = 0;
  hero.stamina = 17;
  assert(healAtCity(hero));
  assert.equal(hero.hp, derivedStats(hero).maxHP);
  assert.equal(hero.mana, derivedStats(hero).maxMana);
  assert.equal(hero.stamina, 17);
  const food = createItem('rice-meal', { quantity: 2 });
  hero.inventory.push(food);
  const original = JSON.stringify(hero);
  assert.equal(consumeInventoryItem(hero, food.id, 1000).ok, false);
  assert.equal(JSON.stringify(hero), original);
});
void test('2C full registries contain no stamina equipment/passive/skill/rune/unique bonus; one retained consumable', () => {
  const mentions = (value: unknown) => /stamina/i.test(JSON.stringify(value));
  assert.deepEqual(
    Object.values(ITEM_CATALOG)
      .filter(mentions)
      .map((i) => i.templateId),
    ['rice-meal'],
  );
  assert.deepEqual(ALL_SKILLS.filter(mentions), []);
  assert.deepEqual(ALL_PASSIVES.filter(mentions), []);
  assert(!mentions(PASSIVE_EFFECTS));
  assert(!mentions(RUNE_THEME_POOLS));
  assert(!mentions(UNIQUE_STAT_POOL));
  // Character player-resource surfaces must consume the policy rather than the legacy global toggle.
  for (const file of [
    '../../app/page.tsx',
    './world.ts',
    './webmcp.ts',
    './city-services.ts',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert(source.includes('isResourceEnabled('));
    assert(!source.includes('STAMINA_ENABLED'));
  }
});
