import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  parseSave,
  createItem,
  consumeInventoryItem,
  learnSkill,
} from './rules.ts';
import { commitDrop, getInventorySlots } from './drag-drop.ts';
import { resolvePrimaryHotbarEntry } from './hotbar.ts';
import { ALL_SKILLS, ALL_PASSIVES } from './skills.ts';
import { SKILL_VISUALS } from './skill-visuals.ts';
import { ITEM_CATALOG } from './items.ts';

await test('learned skill assignment is reference-only, deduplicates and survives save/load', () => {
  const hero = freshHero();
  const source = { dragType: 'skill', refId: 'fajar-step' } as const;
  const result = commitDrop(hero, source, { type: 'hotbar', slot: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.hero.primaryHotbar[4], source.refId);
  assert.equal(
    result.hero.primaryHotbar.filter((id) => id === source.refId).length,
    1,
  );
  assert.equal(result.hero.skillLevels, hero.skillLevels);
  assert.equal(result.hero.inventory, hero.inventory);
  assert.deepEqual(
    parseSave(JSON.stringify(result.hero))?.primaryHotbar,
    result.hero.primaryHotbar,
  );
});

await test('locked, unlearned, passive and invalid external skill drops never mutate state', () => {
  const hero = freshHero();
  for (const refId of ['nova-fajar', 'adventurer-resolve', 'unknown']) {
    const result = commitDrop(
      hero,
      { dragType: 'skill', refId },
      { type: 'hotbar', slot: 2 },
    );
    assert.equal(result.ok, false, refId);
    assert.equal(result.hero, hero);
  }
  for (const type of ['empty', 'invalid'] as const) {
    assert.equal(
      commitDrop(hero, { dragType: 'skill', refId: 'fajar-step' }, { type })
        .hero,
      hero,
    );
  }
});

await test('hotbar swaps/moves references; only intentional empty drop unbinds, never invalid UI', () => {
  const hero = freshHero();
  const source = {
    dragType: 'hotbar-binding',
    refId: hero.primaryHotbar[0]!,
    hotbarSlot: 0,
  } as const;
  const swapped = commitDrop(hero, source, { type: 'hotbar', slot: 6 }).hero;
  assert.equal(swapped.primaryHotbar[0], hero.primaryHotbar[6]);
  assert.equal(swapped.primaryHotbar[6], hero.primaryHotbar[0]);
  assert.equal(swapped.inventory, hero.inventory);
  assert.equal(commitDrop(hero, source, { type: 'invalid' }).hero, hero);
  const cleared = commitDrop(hero, source, { type: 'empty' }).hero;
  assert.equal(cleared.primaryHotbar[0], null);
  assert.equal(cleared.skillLevels, hero.skillLevels);
  assert.equal(cleared.inventory, hero.inventory);
  assert.equal(commitDrop(cleared, source, { type: 'empty' }).ok, false);
  assert.equal(
    commitDrop(swapped, source, { type: 'hotbar', slot: 2 }).ok,
    false,
  );
});

await test('inventory binding resolves real quantities, depletion and restocking without duplicated items', () => {
  let hero = freshHero();
  const potion = createItem('mana-potion-1', { quantity: 3 });
  hero.inventory = [potion];
  const source = {
    dragType: 'item',
    refId: potion.id,
    inventorySlot: 0,
  } as const;
  const result = commitDrop(hero, source, { type: 'hotbar', slot: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.hero.inventory, hero.inventory);
  hero = result.hero;
  assert.equal(hero.primaryHotbar[2], 'mana-potion-1');
  for (const expected of [2, 1, 0]) {
    hero.mana = 0;
    assert.equal(
      consumeInventoryItem(hero, potion.id, (3 - expected) * 4000).ok,
      true,
    );
    assert.equal(
      resolvePrimaryHotbarEntry(hero, hero.primaryHotbar[2])?.quantity,
      expected,
    );
  }
  assert.equal(commitDrop(hero, source, { type: 'hotbar', slot: 0 }).ok, false);
  hero.inventory = [createItem('mana-potion-1', { quantity: 4 })];
  assert.equal(
    resolvePrimaryHotbarEntry(hero, hero.primaryHotbar[2])?.quantity,
    4,
  );
});

await test('inventory empty moves and swaps preserve unique equipment, rune, affix and quantity data', () => {
  const hero = freshHero();
  const original = JSON.stringify(hero.inventory);
  const slots = getInventorySlots(hero);
  const source = {
    dragType: 'item',
    refId: slots[0]!,
    inventorySlot: 0,
  } as const;
  const last = slots.length - 1;
  const moved = commitDrop(hero, source, {
    type: 'inventory',
    slot: last,
    expectedId: null,
  });
  assert.equal(moved.ok, true);
  assert.equal(getInventorySlots(moved.hero)[0], null);
  assert.equal(getInventorySlots(moved.hero)[last], source.refId);
  assert.equal(moved.hero.inventory, hero.inventory);
  const swapped = commitDrop(
    moved.hero,
    { ...source, inventorySlot: last },
    { type: 'inventory', slot: 1, expectedId: slots[1] },
  ).hero;
  assert.equal(getInventorySlots(swapped)[1], source.refId);
  assert.equal(getInventorySlots(swapped)[last], slots[1]);
  assert.equal(JSON.stringify(swapped.inventory), original);
  assert.equal(swapped.equipment, hero.equipment);
  const restored = parseSave(JSON.stringify(swapped))!;
  assert.deepEqual(getInventorySlots(restored), getInventorySlots(swapped));
  for (const type of ['empty', 'invalid'] as const)
    assert.equal(commitDrop(hero, source, { type }).hero, hero);
  assert.equal(
    commitDrop(moved.hero, source, {
      type: 'inventory',
      slot: 2,
      expectedId: slots[2],
    }).ok,
    false,
  );
});

await test('legacy layouts repair stale/duplicate IDs and new loot uses an empty slot without losing items', () => {
  const hero = freshHero();
  const ids = hero.inventory.filter((item) => !item.isEquipped).map((item) => item.id);
  hero.inventoryLayout = [ids[0], ids[0], 'removed-item', null];
  const slots = getInventorySlots(hero);
  assert.equal(slots.filter(Boolean).length, ids.length);
  assert.equal(new Set(slots.filter(Boolean)).size, ids.length);
  assert.deepEqual(new Set(slots.filter(Boolean)), new Set(ids));
  hero.inventoryLayout = slots;
  const newLoot = createItem('mana-potion-1');
  hero.inventory = [...hero.inventory, newLoot];
  assert.equal(getInventorySlots(hero)[slots.indexOf(null)], newLoot.id);
});

await test('all legacy and V2 active skills are assignable only while learned in their real job/architecture; passive never assigns', () => {
  for (const skill of ALL_SKILLS) {
    const hero = freshHero();
    hero.progressionArchitecture=skill.tree?.architecture==='v2'?'v2_test':'legacy';
    hero.level = skill.tree?.architecture==='v2'?59:50;
    hero.coreJob = skill.job === 'adventurer' ? null : skill.job;
    hero.specialization = skill.specialization;
    hero.skillLevels = { [skill.id]: 1 };
    const source = { dragType: 'skill', refId: skill.id } as const;
    const result = commitDrop(hero, source, { type: 'hotbar', slot: 9 });
    assert.equal(result.ok, true, skill.id);
    assert.equal(result.hero.primaryHotbar[9], skill.id);
    hero.skillLevels = {};
    assert.equal(
      commitDrop(hero, source, { type: 'hotbar', slot: 9 }).ok,
      false,
      skill.id,
    );
  }
  for (const passive of ALL_PASSIVES)
    assert.equal(
      commitDrop(
        freshHero(),
        { dragType: 'skill', refId: passive.id },
        { type: 'hotbar', slot: 0 },
      ).ok,
      false,
    );
});

await test('every registry skill has a distinct canonical visual; upgrading a binding needs no reassignment', () => {
  const skills = [...ALL_SKILLS, ...ALL_PASSIVES];
  const visuals = skills.map(
    (skill) => SKILL_VISUALS[skill.id as keyof typeof SKILL_VISUALS],
  );
  assert.ok(visuals.every(Boolean));
  assert.equal(
    new Set(visuals.map((visual) => visual.join(':'))).size,
    skills.length,
  );
  const hero = freshHero();
  hero.level = 4;
  hero.skillPoints = 1;
  const bound = commitDrop(
    hero,
    { dragType: 'skill', refId: 'fajar-step' },
    { type: 'hotbar', slot: 4 },
  ).hero;
  assert.ok(learnSkill(bound, 'fajar-step'));
  assert.equal(bound.skillLevels[bound.primaryHotbar[4]!], 2);
  assert.equal(
    resolvePrimaryHotbarEntry(bound, bound.primaryHotbar[4])?.id,
    'fajar-step',
  );
});

await test('catalog usable items bind by template; equipment, quest and materials cannot become actions', () => {
  for (const template of Object.values(ITEM_CATALOG)) {
    const item = createItem(template.templateId);
    const hero = freshHero();
    hero.inventory = [item];
    const result = commitDrop(
      hero,
      { dragType: 'item', refId: item.id, inventorySlot: 0 },
      { type: 'hotbar', slot: 0 },
    );
    assert.equal(
      result.ok,
      !!item.usableFromHotbar &&
        !!item.useEffect &&
        !item.isQuestItem &&
        !item.isLocked,
      item.templateId,
    );
    assert.equal(result.hero.inventory, hero.inventory);
  }
});
