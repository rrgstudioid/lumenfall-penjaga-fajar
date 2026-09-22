import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  parseSave,
  createItem,
  consumeInventoryItem,
  chooseCoreJob,
  resetSkillPoints,
  unequipItem,
} from './rules.ts';
import {
  assignQuickHotbarSlot,
  assignPrimaryHotbarSlot,
  removeQuickHotbarSlot,
  moveQuickHotbarEntry,
  resolveQuickHotbarEntry,
  quickHotbarKey,
  primaryHotbarKeyIndex,
  resetHotbarLayouts,
  validateQuickHotbarAssignments,
  clampPrimaryHotbarLayout,
  defaultPrimaryHotbar,
} from './hotbar.ts';
import { commitDrop } from './drag-drop.ts';

await test('old saves preserve all ten primary slots and gain two empty independent quick slots', () => {
  const hero = freshHero(),
    old = { ...hero, quickHotbars: undefined };
  const loaded = parseSave(JSON.stringify(old))!;
  assert.equal(loaded.primaryHotbar.length, 10);
  assert.deepEqual(loaded.primaryHotbar, hero.primaryHotbar);
  assert.deepEqual(loaded.quickHotbars, {
    q: { assignment: null, position: null },
    e: { assignment: null, position: null },
  });
});
await test('Q and E move unique references from primary, then swap or return without changing ownership', () => {
  const original = freshHero(),
    before = JSON.stringify(original);
  let hero = assignQuickHotbarSlot(original, 'q', 'fajar-step').hero;
  hero = assignQuickHotbarSlot(hero, 'e', 'health-potion-1').hero;
  assert.equal(hero.primaryHotbar[0], null);
  assert.equal(hero.primaryHotbar[6], null);
  hero = moveQuickHotbarEntry(hero, 'q', 'e');
  assert.equal(hero.quickHotbars.q.assignment, 'health-potion-1');
  assert.equal(hero.quickHotbars.e.assignment, 'fajar-step');
  hero = assignPrimaryHotbarSlot(hero, 0, 'fajar-step').hero;
  assert.equal(hero.quickHotbars.e.assignment, null);
  assert.equal(hero.inventory, original.inventory);
  assert.equal(hero.skillLevels, original.skillLevels);
  assert.equal(JSON.stringify(original), before);
  assert.equal(removeQuickHotbarSlot(hero, 'q').inventory, original.inventory);
});
await test('invalid quick entries, passive, locked skills and incompatible displaced skills are rejected', () => {
  const hero = freshHero();
  hero.primaryHotbar = defaultPrimaryHotbar(hero);
  for (const id of [
    'adventurer-resolve',
    'nova-fajar',
    'unknown',
    hero.inventory[1].id,
  ])
    assert.equal(assignQuickHotbarSlot(hero, 'q', id).ok, false, id);
  const bound = assignQuickHotbarSlot(hero, 'q', 'fajar-step').hero;
  const result = commitDrop(
    bound,
    { dragType: 'hotbar-binding', refId: 'fajar-step', hotbarSlot: 'q' },
    { type: 'hotbar', slot: 3 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.hero, bound);
});
await test('Edit Mode gates both primary and quick mutations, not normal inventory rearrangement', () => {
  const hero = freshHero();
  for (const slot of [0, 'q', 'e'] as const) {
    assert.equal(
      commitDrop(
        hero,
        { dragType: 'skill', refId: 'fajar-step' },
        { type: 'hotbar', slot },
        false,
      ).ok,
      false,
    );
  }
  assert.equal(
    commitDrop(
      hero,
      { dragType: 'hotbar-binding', refId: 'fajar-step', hotbarSlot: 0 },
      { type: 'empty' },
      false,
    ).ok,
    false,
  );
  const item = hero.inventory[0];
  assert.equal(
    commitDrop(
      hero,
      { dragType: 'item', refId: item.id, inventorySlot: 0 },
      { type: 'inventory', slot: 29, expectedId: null },
      false,
    ).ok,
    true,
  );
});
await test('quick invalid drop and stale source do not mutate; intentional background release unbinds only', () => {
  const hero = assignQuickHotbarSlot(freshHero(), 'q', 'fajar-step').hero;
  const source = {
    dragType: 'hotbar-binding',
    refId: 'fajar-step',
    hotbarSlot: 'q',
  } as const;
  assert.equal(commitDrop(hero, source, { type: 'invalid' }).hero, hero);
  const cleared = commitDrop(hero, source, { type: 'empty' });
  assert.equal(cleared.hero.quickHotbars.q.assignment, null);
  assert.equal(cleared.hero.skillLevels['fajar-step'], 1);
  assert.equal(
    commitDrop(cleared.hero, source, { type: 'hotbar', slot: 'e' }).ok,
    false,
  );
});
await test('quick potion quantity, depletion, shared cooldown and restocking use the existing inventory', () => {
  let hero = freshHero();
  hero.inventory = [createItem('mana-potion-1', { quantity: 2 })];
  hero.mana = 0;
  hero = assignQuickHotbarSlot(hero, 'e', 'mana-potion-1').hero;
  assert.equal(resolveQuickHotbarEntry(hero, 'e')?.hotbarCategory, 'quick');
  assert.equal(
    consumeInventoryItem(hero, hero.inventory[0].id, 10000).ok,
    true,
  );
  assert.equal(resolveQuickHotbarEntry(hero, 'e')?.quantity, 1);
  hero.mana = 0;
  assert.equal(
    consumeInventoryItem(hero, hero.inventory[0].id, 10001).ok,
    false,
  );
  assert.equal(
    consumeInventoryItem(hero, hero.inventory[0].id, 15000).ok,
    true,
  );
  hero = parseSave(JSON.stringify(hero))!;
  assert.equal(hero.quickHotbars.e.assignment, 'mana-potion-1');
  assert.equal(resolveQuickHotbarEntry(hero, 'e')?.quantity, 0);
  hero.inventory.push(createItem('mana-potion-1', { quantity: 4 }));
  assert.equal(resolveQuickHotbarEntry(hero, 'e')?.quantity, 4);
});
await test('reset layout preserves assignments/items; positions and assignments survive save reload', () => {
  let hero = assignQuickHotbarSlot(freshHero(), 'q', 'fajar-step').hero;
  hero = assignQuickHotbarSlot(hero, 'e', 'health-potion-1').hero;
  hero.quickHotbars.q.position = { x: 200, y: 100 };
  hero.quickHotbars.e.position = { x: 400, y: 120 };
  hero.primaryHotbarLayout = { x: 30, y: 600 };
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(loaded.quickHotbars, hero.quickHotbars);
  assert.deepEqual(loaded.primaryHotbar, hero.primaryHotbar);
  const reset = resetHotbarLayouts(loaded);
  assert.equal(reset.primaryHotbarLayout, null);
  assert.equal(reset.quickHotbars.q.position, null);
  assert.equal(reset.quickHotbars.e.position, null);
  assert.equal(reset.quickHotbars.e.assignment, 'health-potion-1');
  assert.equal(reset.inventory, loaded.inventory);
});
await test('job change and reset cannot leave inaccessible skill grants in quick slots', () => {
  const hero = assignQuickHotbarSlot(freshHero(), 'q', 'fajar-step').hero;
  hero.level = 15;
  unequipItem(hero, 'mainHand');
  assert.equal(chooseCoreJob(hero, 'wizard'), true);
  assert.equal(hero.quickHotbars.q.assignment, null);
  hero.quickHotbars.q.assignment = 'fajar-step';
  assert.equal(
    validateQuickHotbarAssignments(hero).quickHotbars.q.assignment,
    null,
  );
  const adventurer = assignQuickHotbarSlot(freshHero(), 'q', 'fajar-step').hero;
  adventurer.skillLevels['fajar-step'] = 2;
  adventurer.gold = 500;
  const reset = resetSkillPoints(adventurer);
  assert.equal(reset.ok, true);
  assert.equal(reset.hero.quickHotbars.q.assignment, 'fajar-step');
  assert.equal(reset.hero.skillLevels['fajar-step'], 1);
});
await test('quick save migration drops invalid IDs/duplicates and invalid positions, never inventory', () => {
  const hero = freshHero();
  hero.primaryHotbar = defaultPrimaryHotbar(hero);
  hero.quickHotbars = {
    q: { assignment: 'fajar-step', position: { x: NaN, y: 3 } },
    e: { assignment: 'bad-id', position: null },
  };
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.quickHotbars.q.assignment, null);
  assert.equal(loaded.quickHotbars.q.position, null);
  assert.equal(loaded.quickHotbars.e.assignment, null);
  assert.equal(loaded.inventory.length, hero.inventory.length);
});
await test('Q/E mappings are isolated from 1–0/C/J/K and modifier/repeat keys', () => {
  const event = {
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
  for (const [code, id] of [
    ['KeyQ', 'q'],
    ['KeyE', 'e'],
  ] as const) {
    assert.equal(quickHotbarKey({ ...event, code }), id);
    assert.equal(primaryHotbarKeyIndex({ ...event, code }), -1);
  }
  for (const code of ['KeyC', 'KeyJ', 'KeyK', 'KeyW', 'Digit1', 'Digit0'])
    assert.equal(quickHotbarKey({ ...event, code }), null);
  for (const prop of ['repeat', 'ctrlKey', 'altKey', 'metaKey'])
    assert.equal(
      quickHotbarKey({ ...event, code: 'KeyQ', [prop]: true }),
      null,
    );
});
await test('quick panels use the same viewport-pixel clamp at desktop and small viewports', () => {
  for (const width of [390, 1366, 1920, 2560]) {
    const p = clampPrimaryHotbarLayout(
      { x: 99999, y: 99999 },
      { width, height: 768 },
      { width: 76, height: 109 },
    );
    assert.ok(p.x + 76 <= width - 8);
    assert.ok(p.y + 109 <= 760);
  }
});
