import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, FIELD_NPCS, forgeAccessReason } from './regions.ts';
import {
  ITEM_CATALOG,
  createItem,
  createRuneItem,
  type ItemData,
} from './items.ts';
import {
  freshHero,
  enhanceItem,
  enhancementPreview,
  isEnhanceableEquipment,
  derivedStats,
  parseSave,
  socketRune,
} from './rules.ts';

function fixture(level = 0) {
  const hero = freshHero();
  const item = createItem('legacy-fajar-blade', { enhancementLevel: level });
  hero.inventory = [
    item,
    ...['iron', 'titanium', 'vibranium', 'meteorite-core'].map((id) =>
      createItem(id, { quantity: 30 }),
    ),
  ];
  hero.equipment.mainHand = item.id;
  return { hero, item };
}
await test('every registered city has a nearby canonical Forge Master and rejects all other NPCs', () => {
  for (const city of Object.values(CITIES)) {
    const hero = freshHero();
    hero.currentCity = city.id;
    const masters = city.npcList.filter((npc) => npc.service === 'forge');
    assert.equal(masters.length, 1);
    for (const npc of city.npcList) {
      hero.x = npc.x;
      hero.z = npc.z;
      assert.equal(
        forgeAccessReason(hero, npc.id) === '',
        npc.service === 'forge',
        npc.name,
      );
    }
    const npc = masters[0];
    hero.x = npc.x;
    hero.z = npc.z;
    assert.equal(forgeAccessReason(hero, npc.id), '');
    hero.x += npc.interactionRange + 0.1;
    assert.match(forgeAccessReason(hero, npc.id), /Terlalu jauh/);
  }
});
await test('forge access rejects field camps, missing sessions and wrong-city NPCs', () => {
  const hero = freshHero();
  assert(forgeAccessReason(hero, null));
  assert(forgeAccessReason(hero, 'jaya-2'));
  hero.inCity = false;
  for (const npc of Object.values(FIELD_NPCS))
    assert(forgeAccessReason(hero, npc.id));
  assert(forgeAccessReason(hero, 'aruna-3'));
});
await test('only equipment can be enhanced, not potions, pets, materials or Rune items', () => {
  const hero = freshHero();
  for (const template of Object.values(ITEM_CATALOG)) {
    const item = createItem(template.templateId);
    hero.inventory = [item, createItem('iron', { quantity: 99 })];
    const expected =
      Boolean(item.equipSlot) &&
      ['weapon', 'armor', 'accessory'].includes(item.category) &&
      item.maxEnhancementLevel > 0;
    assert.equal(isEnhanceableEquipment(item), expected, item.name);
    if (!expected)
      assert.equal(enhanceItem(hero, item.id, 0).attempted, false, item.name);
  }
});
await test('missing item, material shortage, locked gear and max level do not spend anything', () => {
  for (const mode of ['missing', 'shortage', 'locked', 'max']) {
    const { hero, item } = fixture();
    if (mode === 'shortage') hero.inventory = [item];
    if (mode === 'locked') item.isLocked = true;
    if (mode === 'max') item.enhancementLevel = item.maxEnhancementLevel;
    const before = JSON.stringify(hero);
    const result = enhanceItem(
      hero,
      mode === 'missing' ? 'unknown' : item.id,
      0,
    );
    assert.equal(result.attempted, false, mode);
    assert.equal(JSON.stringify(hero), before, mode);
  }
});
await test('locked material stacks, Fate Rune and seals are never consumed', () => {
  const { hero, item } = fixture();
  hero.inventory = [
    item,
    createItem('iron', { quantity: 10, isLocked: true }),
    createItem('fate-rune-fragment', { isLocked: true }),
    createItem('eternal-seal', { isLocked: true }),
  ];
  const preview = enhancementPreview(hero, item.id)!;
  assert.equal(preview.materialOwned, 0);
  assert.equal(preview.runeBonus, 0);
  assert.equal(preview.protectedBySeal, false);
  assert.equal(enhanceItem(hero, item.id, 0).attempted, false);
});
await test('success uses one transaction across multiple material stacks and immutable equipment', () => {
  const { hero, item } = fixture(3);
  hero.inventory = [
    item,
    createItem('titanium', { quantity: 1 }),
    createItem('titanium', { quantity: 1 }),
    createItem('fate-rune-fragment', { quantity: 2 }),
  ];
  const inventory = hero.inventory,
    before = JSON.stringify(inventory),
    gold = hero.gold,
    stats = derivedStats(hero);
  assert.equal(enhancementPreview(hero, item.id)!.materialOwned, 2);
  assert.equal(enhanceItem(hero, item.id, 0, 3).ok, true);
  assert.notEqual(hero.inventory, inventory);
  assert.equal(JSON.stringify(inventory), before);
  assert.equal(
    hero.inventory.find((i) => i.id === item.id)?.enhancementLevel,
    4,
  );
  assert(!hero.inventory.some((i) => i.templateId === 'titanium'));
  assert.equal(
    hero.inventory.find((i) => i.itemType === 'fateRune')?.quantity,
    1,
  );
  assert.equal(hero.gold, gold);
  assert(derivedStats(hero).attack > stats.attack);
});
await test('stale confirmation cannot enhance twice or consume extra materials', () => {
  const { hero, item } = fixture();
  assert(enhanceItem(hero, item.id, 0, 0).ok);
  const before = JSON.stringify(hero);
  assert.equal(enhanceItem(hero, item.id, 0, 0).attempted, false);
  assert.equal(JSON.stringify(hero), before);
});
await test('equipment base stats, Rune, sockets and Unique Stats survive enhancement and save reload', () => {
  const { hero, item } = fixture();
  item.sockets = [{ id: 'forge-test-socket', rune: null }];
  item.bonusStats={attackPercent:4};
  const rune = createRuneItem('might', 'rare');
  hero.inventory.push(rune);
  const forge=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!;hero.x=forge.x;hero.z=forge.z;
  assert(socketRune(hero, item.id, rune.id, 0,'aruna-3').ok);
  const original = hero.inventory.find((i) => i.id === item.id)!;
  const protectedFields = (i: ItemData) => [
    i.name,
    i.rarity,
    i.baseStats,
    i.bonusStats,
    i.sockets,
    i.optimizerHistory,
    i.source,
    i.equipSlot,
  ];
  const before = structuredClone(protectedFields(original));
  assert(enhanceItem(hero, item.id, 0).ok);
  const after = hero.inventory.find((i) => i.id === item.id)!;
  assert.deepEqual(protectedFields(after), before);
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(
    loaded.inventory.find((i) => i.id === item.id)?.enhancementLevel,
    1,
  );
  assert.deepEqual(
    protectedFields(loaded.inventory.find((i) => i.id === item.id)!),
    before,
  );
  assert.equal(loaded.equipment.mainHand, item.id);
});
await test('all registered enhanceable equipment types support successful enhancement', () => {
  const slots = new Set<string>();
  for (const template of Object.values(ITEM_CATALOG).filter(
    isEnhanceableEquipment,
  )) {
    const hero = freshHero(),
      item = createItem(template.templateId);
    slots.add(item.equipSlot!);
    hero.inventory = [item, createItem('iron', { quantity: 10 })];
    assert(enhanceItem(hero, item.id, 0).ok, item.name);
    assert.equal(
      hero.inventory.find((i) => i.id === item.id)?.enhancementLevel,
      1,
    );
  }
  assert(
    slots.has('mainHand') &&
      slots.has('offHand') &&
      slots.has('chest') &&
      slots.has('ring1'),
  );
});
await test('failed low enhancement downgrades once, never below zero, and spends material', () => {
  for (const level of [0, 1, 7]) {
    const { hero, item } = fixture(level),
      p = enhancementPreview(hero, item.id)!;
    const result = enhanceItem(hero, item.id, 1);
    assert.equal(result.ok, false);
    assert.equal(result.attempted, true);
    assert.equal(
      hero.inventory.find((i) => i.id === item.id)?.enhancementLevel,
      Math.max(0, level - 1),
    );
    assert.equal(
      hero.inventory.find((i) => i.templateId === p.materialId)?.quantity,
      30 - p.materialRequired,
    );
  }
});
await test('Eternal Seal is only consumed on failure and protects +8 equipment', () => {
  for (const roll of [0, 1]) {
    const { hero, item } = fixture(8);
    hero.inventory.push(createItem('eternal-seal'));
    enhanceItem(hero, item.id, roll);
    assert.equal(
      hero.inventory.find((i) => i.id === item.id)?.enhancementLevel,
      roll === 0 ? 9 : 8,
    );
    assert.equal(
      hero.inventory.some((i) => i.itemType === 'eternalSeal'),
      roll === 0,
    );
  }
});
await test('Eternal Seal can be disabled for one enhancement decision', () => {
  const { hero, item } = fixture(8);
  hero.enhancementSealEnabled = false;
  hero.inventory.push(createItem('eternal-seal'));
  const preview = enhancementPreview(hero, item.id);
  assert.equal(preview?.protectedBySeal, false);
  const result = enhanceItem(hero, item.id, 1, undefined, false);
  assert.equal(result.ok, false);
  assert.equal(hero.inventory.some((entry) => entry.itemType === 'eternalSeal'), true);
  assert.equal(hero.inventory.some((entry) => entry.id === item.id), false);
});
await test('unprotected +8 failure removes only target equipment and clears its equipped reference', () => {
  const { hero, item } = fixture(8),
    other = createItem('legacy-fajar-blade');
  hero.inventory.push(other);
  const oldEquipment = { ...hero.equipment };
  assert.match(enhanceItem(hero, item.id, 1).reason, /hancur/);
  assert(!hero.inventory.some((i) => i.id === item.id));
  assert(hero.inventory.some((i) => i.id === other.id));
  assert.equal(hero.equipment.mainHand, null);
  assert.equal(oldEquipment.mainHand, item.id);
  assert(hero.hp <= derivedStats(hero).maxHP);
});
