import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES } from './regions.ts';
import {
  ITEM_CATALOG,
  LEGACY_OPTIMIZER_MIGRATION,
  createItem,
  createRuneItem,
  normalizeItem,
  RUNE_OPTIMIZER_TIER_RULES,
  RUNE_QUALITY_ORDER,
  RUNE_RARITY_RULES,
  RUNE_THEME_POOLS,
  rollRuneAffixes,
  stableItemRandom,
  type RuneRarity,
  type RuneTheme,
  type ItemData,
} from './items.ts';
import {
  freshHero,
  socketRune,
  removeSocketedRune,
  beginRuneForge,
  resolveRuneForge,
  runeReforgeDistribution,
  craftRuneOptimizer,
  RUNE_OPTIMIZER_CRAFT_RECIPES,
  parseSave,
  derivedStats,
  unlockUniqueStats,
  type Hero,
} from './rules.ts';

const forgeId = 'aruna-3';
function atForge(hero: Hero, city: keyof typeof CITIES = 'arunika') {
  const npc = CITIES[city].npcList.find((n) => n.service === 'forge')!;
  hero.currentCity = city;
  hero.inCity = true;
  hero.x = npc.x;
  hero.z = npc.z;
  return npc.id;
}
function fixture(quality: RuneRarity = 'rare', theme: RuneTheme = 'focus') {
  const hero = freshHero();
  hero.gold = 100000;
  hero.level = 40;
  hero.coreJob = 'wizard';
  atForge(hero);
  const equipment = createItem('field-meteorfall-citadel-staff', {
    id: 'meteor-qa',
    sockets: [
      { id: 's1', rune: null },
      { id: 's2', rune: null },
    ],
  });
  const rune = createRuneItem(theme, quality, {
    id: 'rune-qa',
    affixes: rollRuneAffixes(theme, quality, stableItemRandom('qa')),
  });
  const optimizer = createItem('rune-optimizer-basic', {
    id: 'basic-qa',
    quantity: 10,
  });
  hero.inventory = [
    equipment,
    rune,
    optimizer,
    createItem('rune-stabilizer', { id: 'stabilizer-qa', quantity: 10 }),
  ];
  hero.equipment.mainHand = equipment.id;
  assert.ok(socketRune(hero, equipment.id, rune.id, 0, forgeId).ok);
  const request = {
    equipmentId: equipment.id,
    socketIndex: 0,
    optimizerItemId: optimizer.id,
    stabilize: false,
  };
  return { hero, request, equipment, rune };
}
const gear = (hero: Hero) => hero.inventory.find((i) => i.id === 'meteor-qa')!;
const installed = (hero: Hero) => gear(hero).sockets[0].rune!;
function chromatic(
  hero: Hero,
  request: ReturnType<typeof fixture>['request'],
  tier: 'chromatic' | 'greaterChromatic' | 'perfectChromatic' = 'chromatic',
) {
  const item = createItem(RUNE_OPTIMIZER_TIER_RULES[tier].templateId, {
    id: tier + '-qa',
    quantity: 20,
  });
  hero.inventory.push(item);
  request.optimizerItemId = item.id;
}
function checkRange(item: ItemData) {
  const rule = RUNE_RARITY_RULES[item.runeRarity!],
    pool = RUNE_THEME_POOLS[item.runeTheme!];
  assert.ok(
    item.affixes.length >= rule.minAffixes &&
      item.affixes.length <= Math.min(rule.maxAffixes, pool.length),
  );
  assert.equal(
    new Set(item.affixes.map((a) => a.stat)).size,
    item.affixes.length,
  );
  for (const a of item.affixes) {
    assert.ok(pool.includes(a.stat), item.runeTheme + ':' + a.stat);
    const lo =
      a.unit === 'flat'
        ? a.stat === 'hp'
          ? 60
          : 1
        : a.stat === 'physicalDamage'
          ? 4.5
          : 2;
    const hi =
      a.unit === 'flat'
        ? a.stat === 'hp'
          ? 120
          : 4
        : a.stat === 'physicalDamage'
          ? 6.25
          : 6;
    assert.ok(
      a.value >= Math.round(lo * rule.power * 10) / 10 &&
        a.value <= Math.round(hi * rule.power * 10) / 10,
      a.stat + ':' + a.value,
    );
  }
}
await test('Meteor Staff + Rune of Focus uses only Focus pool; Basic preserves quality/count and equipment identity', () => {
  const { hero, request } = fixture(),
    before = structuredClone(gear(hero)),
    current = structuredClone(installed(hero)),
    gold = hero.gold;
  assert.ok(
    beginRuneForge(hero, request, forgeId, stableItemRandom('focus-roll')).ok,
  );
  assert.deepEqual(
    gear(hero),
    before,
    'generating a paid candidate must not mutate equipment',
  );
  assert.equal(hero.gold, gold - 250);
  assert.equal(hero.inventory.find((i) => i.id === 'basic-qa')!.quantity, 9);
  const pending = hero.runeForgePending!;
  assert.equal(pending.candidate.runeRarity, current.runeRarity);
  assert.equal(pending.candidate.affixes.length, current.affixes.length);
  checkRange(pending.candidate);
  assert.notDeepEqual(pending.candidate.affixes, current.affixes);
  assert.ok(resolveRuneForge(hero, pending.id, true, forgeId).ok);
  const after = gear(hero);
  assert.deepEqual({ ...after, sockets: before.sockets }, before);
  assert.equal(installed(hero).id, current.id);
  assert.equal(installed(hero).templateId, current.templateId);
  assert.equal(installed(hero).runeTheme, 'focus');
  assert.deepEqual(after.affixes, []);
});
await test('every theme and quality rerolls in the existing runtime ranges; Fortune never exceeds its pool', () => {
  for (const theme of Object.keys(RUNE_THEME_POOLS) as RuneTheme[])
    for (const quality of RUNE_QUALITY_ORDER) {
      const { hero, request } = fixture(quality, theme);
      const count = installed(hero).affixes.length;
      for (let n = 0; n < 5; n++) {
        assert.ok(
          beginRuneForge(
            hero,
            request,
            forgeId,
            stableItemRandom(theme + quality + n),
          ).ok,
        );
        const result = hero.runeForgePending!;
        checkRange(result.candidate);
        assert.equal(result.candidate.affixes.length, count);
        assert.ok(resolveRuneForge(hero, result.id, true, forgeId).ok);
      }
    }
});
await test('Chromatic supports downgrade, same, upgrade and all seven qualities using result count/ranges', () => {
  const seen = new Set<RuneRarity>();
  for (const quality of RUNE_QUALITY_ORDER) {
    const { hero, request } = fixture();
    chromatic(hero, request);
    const distribution = runeReforgeDistribution('rare', 'chromatic');
    const index = RUNE_QUALITY_ORDER.indexOf(quality);
    const roll =
      RUNE_QUALITY_ORDER.slice(0, index).reduce(
        (sum, q) => sum + distribution[q],
        0,
      ) +
      distribution[quality] / 2;
    let first = true;
    const rng = () => {
      if (first) {
        first = false;
        return roll;
      }
      return 0.6;
    };
    assert.ok(beginRuneForge(hero, request, forgeId, rng).ok);
    const candidate = hero.runeForgePending!.candidate;
    assert.equal(candidate.runeRarity, quality);
    checkRange(candidate);
    seen.add(quality);
  }
  assert.equal(seen.size, 7);
});
await test('Greater and Perfect improve odds, stay normalized at boundaries, and do not guarantee Ancient', () => {
  for (const q of RUNE_QUALITY_ORDER) {
    const qualities = RUNE_QUALITY_ORDER.indexOf(q),
      up: number[] = [],
      down: number[] = [];
    for (const tier of [
      'chromatic',
      'greaterChromatic',
      'perfectChromatic',
    ] as const) {
      const odds = runeReforgeDistribution(q, tier);
      assert.ok(
        Math.abs(Object.values(odds).reduce((a, b) => a + b, 0) - 1) < 1e-12,
      );
      assert.ok(odds.ancient < 1);
      up.push(
        RUNE_QUALITY_ORDER.slice(qualities + 1).reduce(
          (n, key) => n + odds[key],
          0,
        ),
      );
      down.push(
        RUNE_QUALITY_ORDER.slice(0, qualities).reduce(
          (n, key) => n + odds[key],
          0,
        ),
      );
    }
    if (q !== 'ancient') assert.ok(up[2] > up[1] && up[1] > up[0]);
    if (q !== 'cracked') assert.ok(down[2] < down[1] && down[1] < down[0]);
  }
});
await test('Stabilizer clamps downgrades to current quality; consumes exactly one with roll, not on validation', () => {
  const { hero, request } = fixture('epic');
  chromatic(hero, request);
  request.stabilize = true;
  const oldGold = hero.gold;
  assert.ok(beginRuneForge(hero, request, forgeId, () => 0).ok);
  assert.equal(hero.runeForgePending!.candidate.runeRarity, 'epic');
  assert.equal(
    hero.inventory.find((i) => i.id === 'stabilizer-qa')!.quantity,
    9,
  );
  assert.equal(hero.gold, oldGold - 1200);
  for (const q of RUNE_QUALITY_ORDER)
    for (const tier of [
      'chromatic',
      'greaterChromatic',
      'perfectChromatic',
    ] as const) {
      const odds = runeReforgeDistribution(q, tier, true);
      for (const lower of RUNE_QUALITY_ORDER.slice(
        0,
        RUNE_QUALITY_ORDER.indexOf(q),
      ))
        assert.equal(odds[lower], 0);
    }
});
await test('Stabilizer is independent from optimizer availability and consumes only on explicit ON transactions', () => {
  {
    const { hero, request } = fixture();
    hero.inventory = hero.inventory.filter((item) => item.id !== 'basic-qa');
    const stabilizerBefore = hero.inventory.find((item) => item.id === 'stabilizer-qa')!.quantity;
    assert.equal(beginRuneForge(hero, request, forgeId).ok, false);
    assert.equal(hero.inventory.find((item) => item.id === 'stabilizer-qa')!.quantity, stabilizerBefore);
  }
  {
    const { hero, request } = fixture();
    const basic = hero.inventory.find((item) => item.id === 'basic-qa')!;
    const stabilizer = hero.inventory.find((item) => item.id === 'stabilizer-qa')!;
    basic.quantity = 12;
    stabilizer.quantity = 6;
    request.stabilize = false;
    assert.ok(beginRuneForge(hero, request, forgeId).ok);
    assert.equal(hero.inventory.find((item) => item.id === basic.id)!.quantity, 11);
    assert.equal(hero.inventory.find((item) => item.id === stabilizer.id)!.quantity, 6);
  }
  {
    const { hero, request } = fixture();
    chromatic(hero, request);
    const stabilizer = hero.inventory.find((item) => item.id === 'stabilizer-qa')!;
    const before = stabilizer.quantity;
    request.stabilize = false;
    assert.ok(beginRuneForge(hero, request, forgeId).ok);
    assert.equal(hero.inventory.find((item) => item.id === stabilizer.id)!.quantity, before);
  }
  {
    const { hero, request } = fixture();
    chromatic(hero, request);
    const stabilizer = hero.inventory.find((item) => item.id === 'stabilizer-qa')!;
    request.stabilize = true;
    assert.ok(beginRuneForge(hero, request, forgeId).ok);
    assert.equal(hero.inventory.find((item) => item.id === stabilizer.id)!.quantity, 9);
  }
  {
    const { hero, request } = fixture();
    chromatic(hero, request);
    hero.inventory.find((item) => item.id === 'stabilizer-qa')!.quantity = 0;
    request.stabilize = true;
    assert.equal(beginRuneForge(hero, request, forgeId).ok, false);
  }
});
await test('Keep Current costs stay spent; repeat clicks, stale receipt and second pending roll cannot duplicate', () => {
  const { hero, request } = fixture(),
    before = structuredClone(installed(hero));
  assert.ok(beginRuneForge(hero, request, forgeId).ok);
  const pending = hero.runeForgePending!,
    afterRoll = JSON.stringify(hero);
  assert.equal(beginRuneForge(hero, request, forgeId).ok, false);
  assert.equal(JSON.stringify(hero), afterRoll);
  assert.ok(resolveRuneForge(hero, pending.id, false, forgeId).ok);
  assert.deepEqual(installed(hero), before);
  assert.equal(hero.gold, 99750);
  const after = JSON.stringify(hero);
  assert.equal(resolveRuneForge(hero, pending.id, true, forgeId).ok, false);
  assert.equal(JSON.stringify(hero), after);
});
await test('Rune removal and reinstallation preserve entire optimized instance, enhancement and unique effect', () => {
  const { hero, request } = fixture();
  installed(hero).uniqueEffect = 'Existing immutable effect';
  installed(hero).isSoulbound = true;
  assert.ok(beginRuneForge(hero, request, forgeId).ok);
  assert.ok(
    resolveRuneForge(hero, hero.runeForgePending!.id, true, forgeId).ok,
  );
  const optimized = structuredClone(installed(hero)),
    gold = hero.gold;
  assert.ok(removeSocketedRune(hero, 'meteor-qa', 0, forgeId).ok);
  assert.equal(hero.gold, gold - 250);
  const returned = hero.inventory.find((i) => i.id === optimized.id)!;
  assert.deepEqual(returned, optimized);
  assert.ok(socketRune(hero, 'meteor-qa', returned.id, 1, forgeId).ok);
  assert.deepEqual(gear(hero).sockets[1].rune, optimized);
  assert.equal(
    hero.inventory.some((i) => i.id === returned.id),
    false,
  );
  assert.equal(gear(hero).sockets[0].rune, null);
});
await test('all unique boss Rune identities, fixed Ancient quality and unique effects survive Basic and Chromatic', () => {
  for (const template of Object.values(ITEM_CATALOG).filter(
    (i) => i.runeQualityFixed,
  )) {
    const { hero, request } = fixture();
    hero.coreJob = template.runeJobRequirement ?? 'wizard';
    const boss = createRuneItem(template.runeTheme!, 'ancient', {
      templateId: template.templateId,
      id: 'boss-qa',
    });
    hero.inventory.push(boss);
    assert.ok(socketRune(hero, 'meteor-qa', boss.id, 1, forgeId).ok);
    request.socketIndex = 1;
    for (const tier of [
      'basic',
      'chromatic',
      'greaterChromatic',
      'perfectChromatic',
    ] as const) {
      if (tier !== 'basic') chromatic(hero, request, tier);
      assert.ok(beginRuneForge(hero, request, forgeId, () => 0).ok);
      const p = hero.runeForgePending!;
      assert.equal(p.candidate.runeRarity, 'ancient');
      assert.equal(p.candidate.uniqueEffect, template.uniqueEffect);
      assert.equal(p.candidate.templateId, template.templateId);
      assert.ok(resolveRuneForge(hero, p.id, true, forgeId).ok);
    }
  }
});
await test('forge validation rejects no Rune, missing item/GOLD, locked equipment/Rune/optimizer and wrong job atomically', () => {
  const variants = [
    (h: Hero) => {
      gear(h).sockets[0].rune = null;
    },
    (h: Hero) => {
      h.gold = 0;
    },
    (h: Hero) => {
      gear(h).isLocked = true;
    },
    (h: Hero) => {
      installed(h).isLocked = true;
    },
    (h: Hero) => {
      h.inventory.find((i) => i.id === 'basic-qa')!.isLocked = true;
    },
    (h: Hero) => {
      h.inventory = h.inventory.filter((i) => i.id !== 'basic-qa');
    },
    (h: Hero) => {
      installed(h).runeJobRequirement = 'rogue';
    },
    (h: Hero) => {
      h.hp = 0;
    },
  ];
  for (const change of variants) {
    const { hero, request } = fixture();
    change(hero);
    const before = JSON.stringify(hero);
    assert.equal(beginRuneForge(hero, request, forgeId).ok, false);
    assert.equal(JSON.stringify(hero), before);
  }
});
await test('both city Forge Masters permit actions; remote field, missing session and wrong NPC are rejected', () => {
  for (const city of Object.keys(CITIES) as Array<keyof typeof CITIES>) {
    const { hero, request } = fixture();
    const id = atForge(hero, city);
    assert.ok(beginRuneForge(hero, request, id).ok);
    assert.ok(resolveRuneForge(hero, hero.runeForgePending!.id, true, id).ok);
  }
  for (const npcId of [null, 'aruna-1', 'jaya-2', forgeId]) {
    const { hero, request } = fixture();
    if (npcId === forgeId) hero.inCity = false;
    const before = JSON.stringify(hero);
    assert.equal(beginRuneForge(hero, request, npcId).ok, false);
    assert.equal(removeSocketedRune(hero, 'meteor-qa', 0, npcId).ok, false);
    assert.equal(
      craftRuneOptimizer(hero, 'rune-optimizer-basic', npcId).ok,
      false,
    );
    assert.equal(JSON.stringify(hero), before);
  }
});
await test('installation rejects lock/job/full socket and removal rejects full Inventory, safely', () => {
  const { hero } = fixture();
  const extra = createRuneItem('might', 'rare', {
    id: 'other',
    runeJobRequirement: 'rogue',
  });
  hero.inventory.push(extra);
  assert.equal(socketRune(hero, 'meteor-qa', extra.id, 1, forgeId).ok, false);
  extra.runeJobRequirement = null;
  extra.isLocked = true;
  assert.equal(socketRune(hero, 'meteor-qa', extra.id, 1, forgeId).ok, false);
  extra.isLocked = false;
  assert.equal(socketRune(hero, 'meteor-qa', extra.id, 0, forgeId).ok, false);
  hero.inventoryCapacity = hero.inventory.length;
  const before = JSON.stringify(hero);
  assert.equal(removeSocketedRune(hero, 'meteor-qa', 0, forgeId).ok, false);
  assert.equal(JSON.stringify(hero), before);
});
await test('stale changed Rune cannot accept old result and closing keeps cost without overwriting item', () => {
  const { hero, request } = fixture();
  assert.ok(beginRuneForge(hero, request, forgeId).ok);
  const id = hero.runeForgePending!.id;
  installed(hero).affixes[0].value += 1;
  const before = JSON.stringify(hero);
  assert.equal(resolveRuneForge(hero, id, true, forgeId).ok, false);
  assert.equal(JSON.stringify(hero), before);
  assert.ok(resolveRuneForge(hero, id, false, forgeId).ok);
});
await test('accepted and paid pending Rune transactions survive parse/save/reload without reroll or double spend', () => {
  const { hero, request } = fixture();
  assert.ok(
    beginRuneForge(hero, request, forgeId, stableItemRandom('save')).ok,
  );
  let loaded = parseSave(JSON.stringify(hero))!;
  assert.ok(loaded);
  assert.deepEqual(loaded.runeForgePending, hero.runeForgePending);
  assert.deepEqual(installed(loaded), installed(hero));
  assert.ok(
    resolveRuneForge(loaded, loaded.runeForgePending!.id, true, forgeId).ok,
  );
  const accepted = structuredClone(installed(loaded));
  loaded = parseSave(JSON.stringify(loaded))!;
  assert.deepEqual(installed(loaded), accepted);
  assert.equal(loaded.gold, hero.gold);
  assert.deepEqual(
    derivedStats(loaded),
    derivedStats(parseSave(JSON.stringify(loaded))!),
  );
});
await test('legacy optimizer table preserves every instance/quantity in inventory, storage and pending loot', () => {
  const hero = freshHero();
  const old = Object.keys(LEGACY_OPTIMIZER_MIGRATION).map((templateId, n) => ({
    ...createItem('rune-optimizer-basic'),
    id: 'legacy-' + n,
    templateId,
    quantity: n + 1,
    optimizerFocus: 'red',
  }));
  const loaded = parseSave(
    JSON.stringify({ ...hero, inventory: old, storage: old, pendingLoot: old }),
  )!;
  for (const list of [loaded.inventory, loaded.storage, loaded.pendingLoot])
    for (let n = 0; n < old.length; n++) {
      const item = list.find((i) => i.id === old[n].id)!;
      assert.ok(item);
      assert.equal(item.quantity, n + 1);
      assert.equal(
        item.templateId,
        LEGACY_OPTIMIZER_MIGRATION[old[n].templateId],
      );
      assert.equal('optimizerFocus' in item, false);
      assert.deepEqual(normalizeItem(item), item);
    }
  assert.equal(loaded.level, hero.level);
  assert.deepEqual(loaded.completedQuests, hero.completedQuests);
});
await test('very old generic Rune Optimizer saves recover as Basic without losing quantity', () => {
  const legacy = normalizeItem({
    id: 'old-generic-optimizer',
    templateId: 'rune-optimizer',
    name: 'Rune Optimizer',
    category: 'rune',
    itemType: 'runeOptimizer',
    quantity: 6,
  });
  assert.ok(legacy);
  assert.equal(legacy.templateId, 'rune-optimizer-basic');
  assert.equal(legacy.itemType, 'runeOptimizer');
  assert.equal(legacy.optimizerTier, 'basic');
  assert.equal(legacy.quantity, 6);
});
await test('only five optimizer-related active templates and recipes; old IDs cannot generate new items', () => {
  assert.equal(
    Object.values(ITEM_CATALOG).filter((i) =>
      ['runeOptimizer', 'runeStabilizer'].includes(i.itemType),
    ).length,
    5,
  );
  assert.equal(RUNE_OPTIMIZER_CRAFT_RECIPES.length, 5);
  for (const id of Object.keys(LEGACY_OPTIMIZER_MIGRATION)) {
    assert.equal(ITEM_CATALOG[id], undefined);
    assert.throws(() => createItem(id));
  }
  for (const recipe of RUNE_OPTIMIZER_CRAFT_RECIPES) {
    const hero = freshHero();
    atForge(hero);
    hero.gold = 10000;
    hero.inventory = [
      createItem(recipe.materialId, { quantity: recipe.materialRequired }),
    ];
    assert.ok(craftRuneOptimizer(hero, recipe.templateId, forgeId).ok);
    assert.equal(hero.gold, 10000 - recipe.goldCost);
    assert.equal(hero.inventory[0].templateId, recipe.templateId);
  }
});
await test('obsolete equipment options disappear without contributing; base/Unique stats and sockets persist', () => {
  const { hero } = fixture();
  const item = gear(hero);
  item.bonusStats = { maxMana: 15 };
  item.uniqueStatsLocked = false;
  const expected = derivedStats(hero);
  const input = {
    ...item,
    affixes: [
      {
        id: 'bad',
        stat: 'physicalDamage',
        label: 'Wrong',
        value: 900,
        unit: 'percent',
        source: 'runeOptimizer',
      },
    ],
    additionalOptions: [{ stat: 'str', value: 999 }],
    equipmentOptions: [1],
    optimizerOptions: [2],
  };
  hero.inventory = hero.inventory.map((i) =>
    i.id === item.id ? (input as ItemData) : i,
  );
  assert.deepEqual(derivedStats(hero), expected);
  const loaded = parseSave(JSON.stringify(hero))!,
    migrated = gear(loaded);
  assert.deepEqual(migrated.affixes, []);
  for (const key of [
    'additionalOptions',
    'equipmentOptions',
    'optimizerOptions',
  ])
    assert.equal(key in migrated, false);
  assert.deepEqual(migrated.baseStats, item.baseStats);
  assert.deepEqual(migrated.bonusStats, item.bonusStats);
  assert.deepEqual(migrated.sockets, item.sockets);
});
await test('Unique/Unique Legacy backfill is deterministic, once only, persisted, and revealed only by Magnifier', () => {
  for (const rarity of [
    'unique',
    'legacy',
    'Unique',
    'Unique (Legacy)',
    'Unique Legacy',
  ]) {
    const { hero } = fixture(),
      old = { ...gear(hero), rarity, bonusStats: {}, uniqueStatsLocked: false };
    const item = normalizeItem(old)!;
    assert.ok(Object.keys(item.bonusStats).length > 0);
    assert.equal(item.uniqueStatsLocked, true);
    assert.deepEqual(normalizeItem(old)!.bonusStats, item.bonusStats);
    assert.deepEqual(normalizeItem(item), item);
    hero.inventory = hero.inventory.map((i) => (i.id === old.id ? item : i));
    hero.inventory.push(createItem('magnifier', { id: 'glass' }));
    const runes = structuredClone(item.sockets),
      before = structuredClone(item.bonusStats);
    assert.ok(unlockUniqueStats(hero, item.id).ok);
    assert.equal(
      hero.inventory.some((i) => i.id === 'glass'),
      false,
    );
    assert.deepEqual(gear(hero).sockets, runes);
    assert.deepEqual(gear(hero).bonusStats, before);
    assert.equal(unlockUniqueStats(hero, item.id).ok, false);
    const loaded = parseSave(JSON.stringify(hero))!;
    assert.equal(gear(loaded).uniqueStatsLocked, false);
    assert.deepEqual(gear(loaded).bonusStats, before);
  }
});


await test('generic Rune creation and empty legacy Rune instances receive their own deterministic valid rolls', () => {
  const created = createItem('rune-focus');
  assert(created.affixes.length);
  const raw = {
    ...created,
    id: 'empty-legacy-rune',
    runeSchemaVersion: 1,
    affixes: [],
  };
  const first = normalizeItem(raw)!;
  assert(first.affixes.length);
  assert.deepEqual(normalizeItem(raw), first);
  assert.deepEqual(normalizeItem(first), first);
  assert(
    first.affixes.every((affix) => RUNE_THEME_POOLS.focus.includes(affix.stat)),
  );
});

await test('unknown legacy socket Rune ownership is retained, never assigned a guessed theme', () => {
  const { hero, request } = fixture();
  const owned = installed(hero);
  owned.templateId = 'unknown-legacy-rune';
  owned.runeTheme = null;
  owned.runeRarity = null;
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(installed(loaded).id, owned.id);
  assert.deepEqual(installed(loaded).affixes, owned.affixes);
  assert.equal(beginRuneForge(loaded, request, forgeId).ok, false);
  assert.ok(removeSocketedRune(loaded, 'meteor-qa', 0, forgeId).ok);
  assert.equal(
    loaded.inventory.find((item) => item.id === owned.id)?.templateId,
    owned.templateId,
  );
});
