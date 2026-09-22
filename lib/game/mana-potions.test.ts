import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  gainXP,
  chooseCoreJob,
  chooseSpecialization,
  activeSkills,
  derivedStats,
  canCastSkill,
  getSkillManaCost,
  consumeMana,
  restoreMana,
  consumeInventoryItem,
  createItem,
  parseSave,
  characterStatBreakdown,
  skillCosts,
  unequipItem,
  removeSocketedRune,
} from './rules.ts';
import { CORE_JOBS, SPECIALIZATIONS, ALL_SKILLS } from './skills.ts';
import {
  POTION_IDS,
  ITEM_CATALOG,
  filterInventory,
  normalizeItem,
  getItemCooldownRemaining,
} from './items.ts';
import {
  shopStock,
  fieldShopStock,
  buyShopItem,
  sellInventoryItem,
  healAtCity,
} from './city-services.ts';
import { CITIES, FIELDS } from './regions.ts';
import {
  defaultPrimaryHotbar,
  loadPrimaryHotbar,
  resolvePrimaryHotbarEntry,
} from './hotbar.ts';

await test('resourceEfficiency is not treated as flat Max MP when equipment or Rune changes', () => {
  const hero = freshHero();
  let main = hero.inventory.find(
    (item) => item.id === hero.equipment.mainHand,
  )!;
  main.baseStats = { resourceEfficiency: 40 };
  hero.mana = hero.maxMana = 140;
  assert.ok(unequipItem(hero, 'mainHand').ok);
  main = hero.inventory.find((item) => item.id === main.id)!;
  assert.equal(hero.mana, 140);
  assert.equal(hero.maxMana, 145);
  hero.equipment.mainHand = main.id;
  main.sockets = [
    {
      id: 'socket-1',
      rune: {
        ...createItem('rune-arcana'),
        id: 'clamp-rune',
        templateId: 'rune-arcana',
        name: 'Rune of Arcana',
        icon: '◆',
        runeRarity: 'rare',
        runeTheme: 'arcana',
        affixes: [
          {
            id: 'mp',
            stat: 'resourceEfficiency',
            label: 'Max MP',
            value: 20,
            unit: 'flat',
            source: 'rune',
          },
        ],
        sourceLabel: 'Test',
        requiredCoreJob: null,
        uniqueEffect: null,
      },
    },
  ];
  hero.gold = 500;
  hero.mana = hero.maxMana = 160;
  hero.inCity = true;
  const forge=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!;hero.x=forge.x;hero.z=forge.z;
  assert.ok(removeSocketedRune(hero, main.id, 0,'aruna-3').ok);
  assert.equal(hero.maxMana, 145);
  assert.equal(hero.mana, 145);
  assert.equal(parseSave(JSON.stringify(hero))!.mana, 145);
});

await test('all 64 registered active skills use Mana, and all jobs expose the same resource', () => {
  const heroes = [freshHero()];
  for (const job of Object.values(CORE_JOBS)) {
    const hero = freshHero();
    gainXP(hero, 999999);
    unequipItem(hero, 'mainHand');
    chooseCoreJob(hero, job.id);
    heroes.push(hero);
    assert.equal(job.resource, 'mana');
    assert.equal(job.resourceName, 'Mana');
    for (const spec of job.specializations) {
      const specialized = structuredClone(hero);
      chooseSpecialization(specialized, spec);
      heroes.push(specialized);
      assert.equal(SPECIALIZATIONS[spec].resource, 'mana');
      assert.equal(SPECIALIZATIONS[spec].resourceName, 'Mana');
    }
  }
  assert.equal(ALL_SKILLS.filter(s=>s.tree?.architecture!=='v2').length, 64);
  for (const hero of heroes) {
    gainXP(hero, 999999);
    for (const skill of activeSkills(hero)) {
      hero.skillLevels[skill.id] = Math.max(1, hero.skillLevels[skill.id] ?? 0);
      assert.ok(skill.manaCost > 0);
      assert.equal('resourceCost' in skill, false);
      hero.mana = derivedStats(hero).maxMana;
      assert.ok(canCastSkill(hero, skill.id).ok);
      const cost = getSkillManaCost(hero, skill.id),
        before = hero.mana;
      assert.equal(skillCosts(hero, skill).manaCost, cost);
      assert.ok(consumeMana(hero, cost));
      assert.equal(hero.mana, before - cost);
      hero.mana = 0;
      assert.equal(canCastSkill(hero, skill.id).reason, 'Mana tidak cukup.');
      assert.equal(consumeMana(hero, cost), false);
      assert.equal(hero.mana, 0);
    }
  }
});
await test('mana validation respects cooldown, learned skill, job and weapon before consumption', () => {
  const hero = freshHero(),
    skill = activeSkills(hero)[0];
  assert.match(
    canCastSkill(hero, skill.id, { [skill.id]: 2 }).reason,
    /cooldown/,
  );
  hero.skillLevels[skill.id] = 0;
  assert.match(canCastSkill(hero, skill.id).reason, /dipelajari/);
  assert.equal(canCastSkill(hero, 'caroq-dash').ok, false);
  assert.equal(consumeMana(hero, -10), false);
  assert.equal(consumeMana(hero, NaN), false);
  assert.equal(restoreMana(hero, Infinity), 0);
  assert.equal(restoreMana(hero, -1), 0);
});
await test('Mana Cost Reduction from INT and equipment is shared and capped at 50 percent', () => {
  const hero = freshHero(),
    skill = activeSkills(hero)[0];
  hero.allocatedStats.int = 100;
  const main = hero.inventory.find(
    (item) => item.id === hero.equipment.mainHand,
  )!;
  main.bonusStats = { manaCostReduction: 1000 };
  main.uniqueStatsLocked = false;
  assert.equal(derivedStats(hero).manaCostReduction, 50);
  assert.equal(
    getSkillManaCost(hero, skill.id),
    Math.ceil(skill.manaCost * 0.5),
  );
});
await test('six potion prices, tiers, effects, sell values and merchant stock use the item registry', () => {
  const hero = freshHero();
  const prices = [25, 50, 75, 20, 40, 60];
  assert.equal(POTION_IDS.length, 6);
  POTION_IDS.forEach((id, index) => {
    const item = ITEM_CATALOG[id];
    assert.equal(item.buyValue, prices[index]);
    assert.equal(item.sellValue, prices[index] * 0.4);
    assert.equal(item.category, 'potion');
    assert.equal(item.restoreType, 'percentage');
    assert.ok(item.usableFromHotbar && item.stackable);
    assert.equal(item.useCooldown, 3);
  });
  assert.equal(
    shopStock(hero, 'consumable').filter((item) => item.potionType).length,
    6,
  );
  assert.equal(
    shopStock(hero, 'equipment').filter((item) => item.potionType).length,
    0,
  );
  for (const field of Object.keys(FIELDS))
    assert.equal(
      fieldShopStock(field).filter((item) => item.potionType).length,
      6,
    );
});
await test('buy six potions deducts exact GOLD, stacks in inventory, and can sell through existing economy', () => {
  const hero = freshHero();
  hero.gold = 1000;
  const before = hero.inventory.find(
    (item) => item.templateId === 'health-potion-1',
  )!.quantity;
  for (const id of POTION_IDS)
    assert.ok(buyShopItem(hero, id, 'consumable').ok);
  assert.equal(hero.gold, 730);
  assert.equal(
    hero.inventory.find((item) => item.templateId === 'health-potion-1')!
      .quantity,
    before + 1,
  );
  assert.equal(filterInventory(hero.inventory, 'potion').length, 6);
  const mana = hero.inventory.find(
    (item) => item.templateId === 'mana-potion-1',
  )!;
  assert.ok(sellInventoryItem(hero, mana.id, 1).ok);
  assert.equal(hero.gold, 740);
});
await test('insufficient GOLD and full inventory reject purchase atomically', () => {
  const hero = freshHero();
  hero.gold = 24;
  let before = JSON.stringify(hero);
  assert.equal(buyShopItem(hero, 'mana-potion-1', 'consumable').ok, false);
  assert.equal(JSON.stringify(hero), before);
  hero.gold = 1000;
  hero.inventoryCapacity = hero.inventory.length;
  before = JSON.stringify(hero);
  assert.equal(
    buyShopItem(hero, 'mana-potion-2', 'consumable').reason,
    'Inventory penuh.',
  );
  assert.equal(JSON.stringify(hero), before);
});
await test('all potion tiers restore 30/60/100 percent of current max HP or Mana, never above maximum', () => {
  for (const id of POTION_IDS) {
    const hero = freshHero();
    gainXP(hero, 999999);
    hero.allocatedStats.int = 75;
    hero.hp = 1;
    hero.mana = 0;
    const item = createItem(id, { quantity: 2 });
    hero.inventory.push(item);
    const stats = derivedStats(hero);
    const hp = hero.hp;
    assert.ok(consumeInventoryItem(hero, item.id, 1000).ok);
    assert.equal(
      hero.inventory.find((entry) => entry.id === item.id)!.quantity,
      1,
    );
    if (item.potionType === 'health') {
      assert.equal(
        hero.hp,
        Math.min(
          stats.maxHP,
          hp + Math.ceil((stats.maxHP * item.restoreValue!) / 100),
        ),
      );
      assert.equal(hero.mana, 0);
    } else {
      assert.equal(
        hero.mana,
        Math.ceil((stats.maxMana * item.restoreValue!) / 100),
      );
      assert.equal(hero.hp, hp);
    }
  }
});
await test('full HP/Mana, empty and locked potion cannot consume quantity', () => {
  for (const id of POTION_IDS) {
    const hero = freshHero();
    const item = createItem(id, { quantity: 2 });
    hero.inventory.push(item);
    hero.hp = derivedStats(hero).maxHP;
    hero.mana = derivedStats(hero).maxMana;
    const before = JSON.stringify(hero);
    assert.equal(
      consumeInventoryItem(hero, item.id, 1000).reason,
      item.potionType === 'health' ? 'HP sudah penuh.' : 'Mana sudah penuh.',
    );
    assert.equal(JSON.stringify(hero), before);
    item.quantity = 0;
    assert.equal(consumeInventoryItem(hero, item.id, 1000).ok, false);
    item.quantity = 1;
    item.isLocked = true;
    hero.hp = 1;
    hero.mana = 0;
    assert.equal(
      consumeInventoryItem(hero, item.id, 1000).reason,
      'Item sedang terkunci.',
    );
    assert.equal(item.quantity, 1);
  }
});
await test('potion cooldown is shared across tiers, survives reload and does not block the other type', () => {
  const hero = freshHero();
  hero.mana = 0;
  hero.hp = 1;
  const items = ['mana-potion-1', 'mana-potion-2', 'health-potion-2'].map(
    (id) => createItem(id, { quantity: 2 }),
  );
  hero.inventory.push(...items);
  assert.ok(consumeInventoryItem(hero, items[0].id, 1000).ok);
  assert.equal(consumeInventoryItem(hero, items[1].id, 1001).ok, false);
  assert.ok(consumeInventoryItem(hero, items[2].id, 1001).ok);
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(
    getItemCooldownRemaining(restored.itemCooldowns, items[1], 2000),
    2,
  );
  assert.equal(consumeInventoryItem(restored, items[1].id, 3999).ok, false);
  assert.ok(consumeInventoryItem(restored, items[1].id, 4000).ok);
});
await test('spent potion assignment remains unavailable then becomes usable on restock', () => {
  const hero = freshHero();
  hero.primaryHotbar = defaultPrimaryHotbar(hero);
  hero.mana = 0;
  const item = createItem('mana-potion-1');
  hero.inventory.push(item);
  assert.ok(consumeInventoryItem(hero, item.id, 1000).ok);
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.primaryHotbar[7], 'mana-potion-1');
  assert.equal(resolvePrimaryHotbarEntry(loaded, 'mana-potion-1')!.quantity, 0);
  loaded.gold = 100;
  assert.ok(buyShopItem(loaded, 'mana-potion-1', 'consumable').ok);
  assert.equal(resolvePrimaryHotbarEntry(loaded, 'mana-potion-1')!.quantity, 1);
});
await test('legacy Aji, Momentum and classResource migrate to Mana without erasing other progress', () => {
  for (const field of ['aji', 'momentum', 'classResource', 'mp']) {
    const original = freshHero();
    gainXP(original, 999999);
    unequipItem(original, 'mainHand');
    chooseCoreJob(original, 'wizard');
    chooseSpecialization(original, 'resi');
    const raw: Record<string, unknown> = { ...original, [field]: 37 };
    delete raw.mana;
    const loaded = parseSave(JSON.stringify(raw))!;
    assert.equal(loaded.mana, 37);
    assert.equal(field in loaded, false);
    assert.equal(loaded.level, original.level);
    assert.equal(loaded.gold, original.gold);
    assert.deepEqual(loaded.equipment, original.equipment);
    assert.equal(loaded.specialization, 'resi');
    assert.deepEqual(loaded.completedQuests, original.completedQuests);
  }
  const raw = { ...freshHero(), mana: 0, aji: 80, momentum: 90 };
  assert.equal(parseSave(JSON.stringify(raw))!.mana, 0);
});
await test('old potion IDs/names, cooldowns and hotbar assignments migrate without losing quantity or duplicating', () => {
  const hero = freshHero();
  const old = createItem('potion-mana', {
    id: 'legacy-mana-instance',
    quantity: 5,
  });
  const raw = {
    ...hero,
    inventory: [
      ...hero.inventory,
      {
        ...old,
        templateId: 'potion-mana',
        name: 'Aji Mana Elixir',
        category: 'consumable',
        itemType: 'potion',
        buyValue: 35,
        useEffect: { type: 'resource', amount: 45 },
      },
    ],
    primaryHotbar: [
      'potion-mana',
      'potion-light',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    itemCooldowns: { 'potion-mana': 9999 },
  };
  const loaded = parseSave(JSON.stringify(raw))!;
  const item = loaded.inventory.find(
    (entry) => entry.id === 'legacy-mana-instance',
  )!;
  assert.equal(item.name, 'Mana Potion I');
  assert.equal(item.quantity, 5);
  assert.equal(item.templateId, 'mana-potion-1');
  assert.equal(item.buyValue, 25);
  assert.equal(item.category, 'potion');
  assert.equal(loaded.primaryHotbar[0], 'mana-potion-1');
  assert.equal(loaded.primaryHotbar[1], 'health-potion-1');
  assert.equal(loaded.itemCooldowns['potion:mana'], 9999);
  assert.deepEqual(
    parseSave(JSON.stringify(loaded))!.primaryHotbar,
    loaded.primaryHotbar,
  );
  assert.equal(normalizeItem({ ...item, quantity: 0 }), null);
  assert.equal(
    loadPrimaryHotbar(loaded, {
      primaryHotbar: ['potion-mana', 'mana-potion-1'],
    }).primaryHotbar.filter(Boolean).length,
    1,
  );
});
await test('flat Max MP includes maxMana sources while resourceEfficiency remains percentage metadata', () => {
  const hero = freshHero(),
    main = hero.inventory.find((item) => item.id === hero.equipment.mainHand)!;
  main.baseStats = { resourceEfficiency: 20 };
  main.bonusStats = { maxMana: 10 };
  main.uniqueStatsLocked = false;
  main.affixes = [
    {
      id: 'unique-mp',
      stat: 'resourceEfficiency',
      label: 'Max MP',
      value: 10,
      unit: 'flat',
      source: 'equipment',
    },
    {
      id: 'optimizer-mp',
      stat: 'resourceEfficiency',
      label: 'Max MP',
      value: 12,
      unit: 'flat',
      source: 'runeOptimizer',
    },
  ];
  main.sockets = [
    {
      id: 'socket-1',
      rune: {
        ...createItem('rune-arcana'),
        id: 'test-rune',
        templateId: 'rune-arcana',
        name: 'Rune of Arcana',
        icon: '◆',
        runeRarity: 'rare',
        runeTheme: 'arcana',
        affixes: [
          {
            id: 'rune-mp',
            stat: 'resourceEfficiency',
            label: 'Max MP',
            value: 8,
            unit: 'flat',
            source: 'rune',
          },
        ],
        sourceLabel: 'Test',
        requiredCoreJob: null,
        uniqueEffect: null,
      },
    },
  ];
  assert.equal(derivedStats(hero).maxMana, 155);
  const breakdown = characterStatBreakdown(hero);
  assert.equal(
    breakdown.base.maxMana +
      breakdown.columns.reduce((sum, column) => sum + column.stats.maxMana, 0),
    155,
  );
  hero.mana = 137;
  restoreMana(hero, 1000);
  assert.equal(hero.mana, 155);
  assert.equal(parseSave(JSON.stringify(hero))!.mana, 155);
});
await test('city healer restores Mana and HP through existing service without touching GOLD or inventory', () => {
  const hero = freshHero();
  hero.hp = 1;
  hero.mana = 0;
  const inventory = JSON.stringify(hero.inventory),
    gold = hero.gold;
  assert.ok(healAtCity(hero));
  assert.equal(hero.mana, derivedStats(hero).maxMana);
  assert.equal(hero.hp, derivedStats(hero).maxHP);
  assert.equal(hero.gold, gold);
  assert.equal(JSON.stringify(hero.inventory), inventory);
});
