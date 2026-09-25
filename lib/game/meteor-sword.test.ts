import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG, RARITY_META, createItem, normalizeItem } from './items.ts';
import { freshHero, parseSave } from './rules.ts';

const meteorId = 'field-meteorfall-citadel-sword';

await test('Meteor Sword is Legacy in the catalog and new items, including loot rarity overrides', () => {
  const template = ITEM_CATALOG[meteorId];
  assert.equal(template.rarity, 'legacy');
  assert.equal(RARITY_META[template.rarity].label, 'Legacy');
  assert.equal(template.equipmentType, 'one_hand_sword');
  assert.equal(template.twoHanded, false);
  assert.equal(template.levelRequirement, 42);
  assert.deepEqual(template.baseStats, { attack: 41 });
  assert.equal(template.buyValue, 836);
  assert.equal(template.sellValue, 188);
  for (const overrides of [{}, { rarity: 'common' as const }, { rarity: 'mythic' as const }]) {
    const item = createItem(meteorId, overrides);
    assert.equal(item.rarity, 'legacy');
    assert.deepEqual(item.baseStats, template.baseStats);
    assert.equal(item.equipmentType, 'one_hand_sword');
  }
});

await test('saved Meteor Swords become Legacy without losing ownership, enhancement, runes or existing stats', () => {
  const hero = freshHero();
  const meteor = {
    ...createItem(meteorId, {
      id: 'saved-meteor', enhancementLevel: 5, baseStats: { attack: 41 },
      bonusStats: { attackPercent: 7 }, uniqueStatsLocked: false,
      sockets: [{ id: 'saved-socket', rune: null }],
    }),
    rarity: 'common' as const,
  };
  const before = JSON.stringify(meteor);
  hero.inventory.push(meteor);
  hero.equipment.mainHand = meteor.id;
  hero.storage.push({ ...meteor, id: 'stored-meteor' });
  hero.pendingLoot.push({ ...meteor, id: 'pending-meteor' });
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(restored.equipment.mainHand, meteor.id);
  for (const [items, id] of [
    [restored.inventory, meteor.id],
    [restored.storage, 'stored-meteor'],
    [restored.pendingLoot, 'pending-meteor'],
  ] as const) {
    const item = items.find(entry => entry.id === id)!;
    assert.ok(item);
    assert.equal(item.rarity, 'legacy');
    assert.equal(item.enhancementLevel, 5);
    assert.deepEqual(item.baseStats, meteor.baseStats);
    assert.deepEqual(item.bonusStats, meteor.bonusStats);
    assert.equal(item.uniqueStatsLocked, false);
    assert.deepEqual(item.sockets, meteor.sockets);
    assert.deepEqual(normalizeItem(item), item, 'migration remains stable after another reload');
  }
  assert.equal(JSON.stringify(meteor), before, 'normalization does not mutate the original save');
});

await test('other Meteor weapons and Jayantara keep their existing rarities and random overrides', () => {
  for (const templateId of ['field-meteorfall-citadel-dagger', 'field-sunken-ruins-sword', 'jayantara-two-hand-sword']) {
    const originalRarity = templateId === 'jayantara-two-hand-sword' ? 'epic' : 'common';
    assert.equal(ITEM_CATALOG[templateId].rarity, originalRarity);
    assert.equal(createItem(templateId).rarity, originalRarity);
    const item = createItem(templateId, { rarity: 'rare' });
    assert.equal(item.rarity, 'rare');
    assert.equal(normalizeItem(item)!.rarity, 'rare');
  }
});
