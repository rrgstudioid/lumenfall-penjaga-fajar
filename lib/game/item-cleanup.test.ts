import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_CATALOG,
  RETIRED_NORMAL_MATERIALS,
  createItem,
  normalizeItem,
  isRetiredNormalMaterial,
  type ItemData,
} from './items.ts';
import {
  freshHero,
  parseSave,
  parseSaveCollection,
  grantLoot,
  retireUnusedNormalItems,
  RUNE_OPTIMIZER_CRAFT_RECIPES,
} from './rules.ts';
import { FIELDS, getQuestRegistry } from './regions.ts';
import { shopStock, fieldShopStock } from './city-services.ts';

const retiredIds = Object.keys(RETIRED_NORMAL_MATERIALS);
const oldItem = (templateId: string, overrides: Partial<ItemData> = {}) =>
  normalizeItem({
    id: `old-${templateId}`,
    templateId,
    quantity: 7,
    rarity: 'normal',
    category: 'material',
    ...overrides,
  })!;

await test('only eight audited unused Normal materials leave the catalog; useful items remain', () => {
  assert.equal(retiredIds.length, 8);
  for (const id of retiredIds) {
    assert.equal(ITEM_CATALOG[id], undefined);
    assert.throws(() => createItem(id), /tidak lagi tersedia/);
    assert.ok(isRetiredNormalMaterial(oldItem(id)));
  }
  for (const id of [
    'iron',
    'titanium',
    'vibranium',
    'meteorite-core',
    'lumut-fiber',
    'magnifier',
    'arrows',
    'rice-meal',
    'adventurer-pet-egg',
    'fate-rune-fragment',
    'eternal-seal',
    'mana-potion-1',
    'health-potion-1',
  ])
    assert.ok(ITEM_CATALOG[id], id);
});

await test('all field, monster, shop, crafting and quest references remain valid', () => {
  const hero = freshHero();
  for (const field of Object.values(FIELDS)) {
    const ids = [
      ...field.dropTable,
      ...field.materialTable.map((item) => item.id),
      ...field.normalMonsters.flatMap((monster) => monster.lootTable),
      ...field.eliteMonsters.flatMap((monster) => monster.lootTable),
      ...field.fieldBoss.lootTable,
    ];
    for (const id of ids) assert.ok(ITEM_CATALOG[id], id);
    assert.ok(field.materialTable[0]);
    assert.ok(
      fieldShopStock(field.id).every(
        (item) => !retiredIds.includes(item.templateId),
      ),
    );
  }
  for (const [field, id] of [
    ['ironveil-mines', 'titanium'],
    ['frostfire-highlands', 'vibranium'],
    ['meteorfall-citadel', 'meteorite-core'],
  ])
    assert.equal(
      FIELDS[field].materialTable.find((item) => item.id === id)!.chance,
      0.15,
    );
  for (const quest of getQuestRegistry())
    for (const item of quest.rewards.items)
      assert.ok(ITEM_CATALOG[item.templateId]);
  for (const recipe of RUNE_OPTIMIZER_CRAFT_RECIPES)
    assert.ok(ITEM_CATALOG[recipe.materialId]);
  for (const service of ['consumable', 'equipment', 'seal'])
    assert.ok(
      shopStock(hero, service).every(
        (item) => !retiredIds.includes(item.templateId),
      ),
    );
});

await test('normal, elite, boss and stale loot tables no longer produce retired materials', () => {
  for (const field of Object.values(FIELDS))
    for (const monster of [
      field.normalMonsters[0],
      field.eliteMonsters[0],
      field.fieldBoss,
    ]) {
      for (const roll of [
        0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.48, 0.494, 0.52, 0.56, 0.61, 0.66, 0.71,
        0.8, 0.95, 0.99,
      ]) {
        const hero = freshHero();
        hero.currentField = field.id;
        const loot = grantLoot(
          hero,
          monster.variant === 'boss',
          roll,
          monster.lootTable,
          monster.variant,
        );
        assert.ok(!retiredIds.includes(loot.templateId));
        assert.ok(ITEM_CATALOG[loot.templateId]);
      }
    }
  assert.equal(grantLoot(freshHero(), false, 0, [], 'normal', () => 0).templateId, 'iron');
  assert.equal(
    grantLoot(freshHero(), false, 0, ['enhancement-dust'], 'normal', () => 0).templateId,
    'iron',
  );
});

await test('old stacks are archived from inventory, storage and pending loot once, preserving quantity and progress', () => {
  const hero = freshHero();
  hero.gold = 923;
  hero.kills = 6;
  hero.completedQuests = ['main-verdant-bisikan'];
  const kept = hero.inventory.map((item) => item.id);
  hero.inventory.push(...retiredIds.map((id) => oldItem(id)));
  hero.storage = [oldItem('ore-fragment', { id: 'stored-ore', quantity: 43 })];
  hero.pendingLoot = [
    oldItem('water-core', { id: 'pending-water', quantity: 11 }),
  ];
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(
    loaded.inventory.map((item) => item.id),
    kept,
  );
  assert.equal(loaded.storage.length, 0);
  assert.equal(loaded.pendingLoot.length, 0);
  assert.equal(loaded.retiredItems.length, 10);
  assert.equal(
    loaded.retiredItems.find((entry) => entry.location === 'storage')!.item
      .quantity,
    43,
  );
  assert.equal(
    loaded.retiredItems.find((entry) => entry.location === 'pendingLoot')!.item
      .quantity,
    11,
  );
  assert.equal(loaded.gold, 923);
  assert.equal(loaded.level, hero.level);
  assert.deepEqual(loaded.equipment, hero.equipment);
  assert.deepEqual(loaded.completedQuests, hero.completedQuests);
  const second = parseSave(JSON.stringify(loaded))!;
  assert.deepEqual(second.retiredItems, loaded.retiredItems);
  retireUnusedNormalItems(second);
  assert.deepEqual(second.retiredItems, loaded.retiredItems);
});

await test('quest, equipped, non-Normal, locked and effect-bearing variants are never removed', () => {
  const protectedItems = [
    oldItem('ore-fragment', { id: 'quest-flag', isQuestItem: true }),
    oldItem('ore-fragment', { id: 'quest-category', category: 'quest' }),
    oldItem('ore-fragment', {
      id: 'weapon',
      category: 'weapon',
      equipSlot: 'mainHand',
    }),
    oldItem('ore-fragment', { id: 'rare', rarity: 'rare' }),
    oldItem('ore-fragment', { id: 'locked', isLocked: true }),
    oldItem('ore-fragment', { id: 'bound', isSoulbound: true }),
    oldItem('ore-fragment', { id: 'bonus', bonusStats: { hp: 10 } }),
    oldItem('ore-fragment', {
      id: 'usable',
      useEffect: { type: 'heal', amount: 10 },
    }),
    oldItem('ore-fragment', {
      id: 'affix',
      affixes: [
        { id: 'hp', stat: 'hp', label: 'Max HP', value: 5, unit: 'flat' },
      ],
    }),
    oldItem('ore-fragment', { id: 'referenced-equipment' }),
  ];
  const hero = freshHero();
  hero.inventory.push(...protectedItems);
  hero.equipment.offHand = 'referenced-equipment';
  const loaded = parseSave(JSON.stringify(hero))!;
  for (const item of protectedItems)
    assert.ok(
      loaded.inventory.some((entry) => entry.id === item.id),
      item.id,
    );
  assert.equal(loaded.retiredItems.length, 0);
  assert.ok(
    loaded.inventory.some((item) => item.templateId === 'health-potion-1'),
  );
});

await test('cleanup stays per-character and preserves valid bare legacy IDs', () => {
  const first = freshHero('slot-1'),
    second = freshHero('slot-2');
  first.inventory.push(oldItem('enhancement-dust'));
  second.inventory.push(createItem('lumut-fiber', { quantity: 9 }));
  const loaded = parseSaveCollection(
    JSON.stringify({
      version: 3,
      activeSlot: 'slot-2',
      characters: { 'slot-1': first, 'slot-2': second },
    }),
  )!;
  assert.equal(loaded.activeSlot, 'slot-2');
  assert.equal(loaded.characters['slot-1'].retiredItems.length, 1);
  assert.equal(loaded.characters['slot-2'].retiredItems.length, 0);
  assert.equal(
    loaded.characters['slot-2'].inventory.find(
      (item) => item.templateId === 'lumut-fiber',
    )!.quantity,
    9,
  );
  assert.equal(
    normalizeItem({ id: 'ore-fragment', quantity: 2 })!.templateId,
    'ore-fragment',
  );
  assert.equal(parseSave(JSON.stringify(freshHero()))!.retiredItems.length, 0);
});
