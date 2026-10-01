import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  derivedStats,
  equipItem,
  unequipItem,
  parseSave,
  characterStatBreakdown,
  calculateEquipmentStats,
  calculatePassiveEffects,
  BASE_PRIMARY_STAT,
} from './rules.ts';
import { createItem } from './items.ts';
import { canDrop, commitDrop, getInventorySlots } from './drag-drop.ts';
import {
  PAPER_DOLL_SLOTS,
  PRIMARY_ATTRIBUTES,
  CHARACTER_STAT_ROWS,
  characterAttributes,
  attributeEffects,
  readCharacterPower,
} from './character-screen.ts';
import { getEquipmentCandidatesForSlot, previewEquipmentChange } from './character-view.ts';

await test('dashboard exposes every production equipment slot exactly once', () => {
  assert.deepEqual(
    PAPER_DOLL_SLOTS.map((s) => s.id).sort(),
    Object.keys(freshHero().equipment).sort(),
  );
  assert.equal(new Set(PAPER_DOLL_SLOTS.map((s) => s.id)).size, 14);
  assert(!CHARACTER_STAT_ROWS.some((s) => s.id === 'elementalResistance'));
});
await test('accessory slot supports preview, drag equip, replacement, save migration and unequip', () => {
  const hero = freshHero();
  const oldSave = JSON.parse(JSON.stringify(hero));
  delete oldSave.equipment.accessory;
  assert.equal(parseSave(JSON.stringify(oldSave))?.equipment.accessory, null);
  const wings = createItem('fajar-necklace', {
    id: 'test-wings', name: 'Test Wings', itemType: 'wings',
    equipmentType: 'accessory', equipSlot: 'accessory', levelRequirement: 1,
    baseStats: {}, bonusStats: {}, sockets: [], uniqueStatsLocked: false,
  });
  const replacement = { ...wings, id: 'test-accessory', name: 'Test Accessory' };
  hero.inventory.push(wings, replacement);
  assert.deepEqual(getEquipmentCandidatesForSlot(hero, 'accessory').map(item => item.id), [wings.id, replacement.id]);
  const before = JSON.stringify(hero);
  const preview = previewEquipmentChange(hero, wings, 'accessory');
  assert.equal(preview.validation.ok, true);
  assert.equal(preview.hero.equipment.accessory, wings.id);
  assert.equal(JSON.stringify(hero), before);
  assert.deepEqual(preview.before, preview.after);
  assert.equal(equipItem(hero, wings.id, 'necklace').ok, false);
  const source = { dragType: 'item' as const, refId: wings.id, inventorySlot: getInventorySlots(hero).indexOf(wings.id) };
  const target = { type: 'equipment' as const, slot: 'accessory' as const, expectedId: null };
  const dropped = commitDrop(hero, source, target, false);
  assert.equal(dropped.ok, true);
  assert.equal(dropped.hero.equipment.accessory, wings.id);
  assert.equal(JSON.stringify(hero), before);
  const restored = parseSave(JSON.stringify(dropped.hero))!;
  assert.equal(restored.equipment.accessory, wings.id);
  assert.equal(restored.inventory.find(item => item.id === wings.id)?.isEquipped, true);
  assert.equal(equipItem(restored, replacement.id).ok, true);
  assert.equal(restored.equipment.accessory, replacement.id);
  assert.equal(restored.inventory.find(item => item.id === wings.id)?.isEquipped, false);
  assert.equal(unequipItem(restored, 'accessory').ok, true);
  assert.equal(restored.equipment.accessory, null);
  assert.equal(restored.inventory.find(item => item.id === replacement.id)?.isEquipped, false);
});
await test('CP uses the production calculator by default and supports an explicit adapter', () => {
  const hero = freshHero();
  assert.ok(readCharacterPower(hero)!.total > 0);
  const reading = {
    total: 321,
    contributions: [{ label: 'Production', value: 321 }],
  };
  assert.equal(
    readCharacterPower(hero, (input) => {
      assert.equal(input, hero);
      return reading;
    }),
    reading,
  );
  assert.equal(
    readCharacterPower(hero, () => ({ total: NaN, contributions: [] })),
    null,
  );
});
await test('attribute totals and per-point tooltip use the live calculator without changing hero', () => {
  const hero = freshHero();
  hero.level = 30;
  hero.allocatedStats = { str: 12, vit: 8, dex: 4, int: 3 };
  const ring = createItem('arunika-ring1');
  hero.inventory.push(ring);
  equipItem(hero, ring.id, 'ring1');
  const before = JSON.stringify(hero),
    gear = calculateEquipmentStats(hero),
    passive = calculatePassiveEffects(hero);
  for (const { id } of PRIMARY_ATTRIBUTES) {
    assert.equal(
      characterAttributes(hero)[id],
      BASE_PRIMARY_STAT + (hero.allocatedStats[id] ?? 0) + (gear[id] ?? 0) + (passive[id] ?? 0),
    );
    const next = derivedStats({
      ...hero,
      allocatedStats: {
        ...hero.allocatedStats,
        [id]: (hero.allocatedStats[id] ?? 0) + 1,
      },
    });
    for (const effect of attributeEffects(hero, id))
      assert.equal(
        effect.delta,
        Number((next[effect.id] - derivedStats(hero)[effect.id]).toFixed(4)),
      );
  }
  assert.equal(JSON.stringify(hero), before);
  const breakdown = characterStatBreakdown(hero);
  for (const stat of CHARACTER_STAT_ROWS)
    assert(
      Math.abs(
        breakdown.base[stat.id] +
          breakdown.columns.reduce(
            (sum, column) => sum + column.stats[stat.id],
            0,
          ) -
          breakdown.final[stat.id],
      ) < 0.0001,
    );
});
await test('equipment drag validates slot, stale target, job and commits an immutable canonical equip', () => {
  const hero = freshHero();
  hero.level = 30;
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  const ring = createItem('arunika-ring1');
  hero.inventory.push(ring);
  const source = {
    dragType: 'item' as const,
    refId: ring.id,
    inventorySlot: getInventorySlots(hero).indexOf(ring.id),
  };
  const target = {
    type: 'equipment' as const,
    slot: 'ring2' as const,
    expectedId: null,
  };
  const before = JSON.stringify(hero);
  assert.equal(canDrop(hero, source, target, false).ok, true);
  assert.equal(canDrop(hero, source, { ...target, slot: 'head' }).ok, false);
  assert.equal(
    canDrop(hero, source, { ...target, expectedId: 'stale' }).ok,
    false,
  );
  assert.equal(
    canDrop(hero, { dragType: 'skill', refId: 'warrior-1' }, target).ok,
    false,
  );
  const result = commitDrop(hero, source, target, false);
  assert.equal(result.ok, true);
  assert.equal(result.hero.equipment.ring2, ring.id);
  assert.equal(JSON.stringify(hero), before);
  assert.deepEqual(
    derivedStats(result.hero),
    previewEquipmentChange(hero, ring, 'ring2').after,
  );
  const restored = parseSave(JSON.stringify(result.hero));
  assert(restored);
  assert.equal(restored.equipment.ring2, ring.id);
});
await test('two-hand drag does not silently remove offhand and read-only preview preserves items', () => {
  const hero = freshHero();
  hero.level = 50;
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  const shield = createItem('ironveil-shield'),
    sword = createItem('jayantara-two-hand-sword');
  hero.inventory.push(shield, sword);
  assert(equipItem(hero, shield.id, 'offHand').ok);
  const before = JSON.stringify(hero);
  const source = {
    dragType: 'item' as const,
    refId: sword.id,
    inventorySlot: getInventorySlots(hero).indexOf(sword.id),
  };
  const target = {
    type: 'equipment' as const,
    slot: 'mainHand' as const,
    expectedId: hero.equipment.mainHand,
  };
  assert.equal(canDrop(hero, source, target).ok, false);
  const preview = previewEquipmentChange(hero, sword, 'mainHand');
  assert(preview.validation.ok);
  assert.equal(preview.hero.equipment.offHand, null);
  assert.equal(JSON.stringify(hero), before);
  unequipItem(hero, 'offHand');
  assert.equal(
    canDrop(
      hero,
      { ...source, inventorySlot: getInventorySlots(hero).indexOf(sword.id) },
      target,
    ).ok,
    true,
  );
});
