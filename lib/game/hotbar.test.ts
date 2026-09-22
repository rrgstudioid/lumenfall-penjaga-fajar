import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHero,
  parseSave,
  activeSkills,
  chooseCoreJob,
  chooseSpecialization,
  gainXP,
  consumeInventoryItem,
  consumePotion,
  resetSkillPoints,
  learnSkill,
  derivedStats,
  createItem,
  equipItem,
} from './rules.ts';
import {
  primaryHotbarKeys,
  primaryHotbarKeyIndex,
  loadPrimaryHotbar,
  validatePrimaryHotbar,
  resolvePrimaryHotbarEntry,
  canPlaceInPrimaryHotbar,
  primaryHotbarAssignmentReason,
  assignPrimaryHotbarSlot,
  swapPrimaryHotbarSlots,
  removePrimaryHotbarSlot,
  clampPrimaryHotbarLayout,
  getPrimaryHotbarEntries,
  defaultPrimaryHotbar,
} from './hotbar.ts';

await test('new level-one characters start with an empty PrimaryHotbar', () => {
  const hero = freshHero();
  assert.equal(hero.primaryHotbar.length, 10);
  assert.ok(hero.primaryHotbar.every((entry) => entry === null));
  assert.deepEqual(primaryHotbarKeys, [
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
  ]);
});
await test('only top-row keyboard codes activate slots; repeats/modifiers/numpad are ignored', () => {
  const key = { repeat: false, altKey: false, ctrlKey: false, metaKey: false };
  primaryHotbarKeys.forEach((code, index) =>
    assert.equal(primaryHotbarKeyIndex({ ...key, code }), index),
  );
  for (const code of [
    'Numpad1',
    'Numpad0',
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyC',
    'KeyJ',
    'KeyZ',
  ])
    assert.equal(primaryHotbarKeyIndex({ ...key, code }), -1);
  for (const property of ['repeat', 'altKey', 'ctrlKey', 'metaKey'])
    assert.equal(
      primaryHotbarKeyIndex({ ...key, code: 'Digit1', [property]: true }),
      -1,
    );
});
await test('assignment/swap/remove are immutable and never duplicate or remove inventory items', () => {
  const original = freshHero();
  original.primaryHotbar = defaultPrimaryHotbar(original);
  const serialized = JSON.stringify(original);
  let hero = swapPrimaryHotbarSlots(original, 0, 6);
  assert.equal(hero.primaryHotbar[6], original.primaryHotbar[0]);
  assert.equal(hero.primaryHotbar[0], 'health-potion-1');
  hero = removePrimaryHotbarSlot(hero, 5);
  assert.equal(hero.primaryHotbar[5], null);
  const assigned = assignPrimaryHotbarSlot(hero, 5, 'basic-attack');
  assert.ok(assigned.ok);
  hero = assigned.hero;
  assert.equal(hero.primaryHotbar[5], 'basic-attack');
  assert.equal(hero.primaryHotbar[4], null);
  assert.equal(
    hero.primaryHotbar.filter((id) => id === 'basic-attack').length,
    1,
  );
  assert.equal(JSON.stringify(original), serialized);
  assert.deepEqual(hero.inventory, original.inventory);
  assert.deepEqual(swapPrimaryHotbarSlots(hero, -1, 90), hero);
});
await test('nonusable equipment, Rune, Optimizer, Magnifier, material and passive are rejected', () => {
  const hero = freshHero();
  for (const id of [
    'legacy-fajar-blade',
    'rune-optimizer-basic',
    'magnifier',
    'iron',
    'fate-rune',
  ]) {
    const item = createItem(id);
    hero.inventory.push(item);
    assert.equal(
      canPlaceInPrimaryHotbar(resolvePrimaryHotbarEntry(hero, id)),
      false,
    );
    assert.equal(assignPrimaryHotbarSlot(hero, 0, id).ok, false);
  }
  assert.equal(
    assignPrimaryHotbarSlot(hero, 0, 'adventurer-resolve').ok,
    false,
  );
  assert.equal(assignPrimaryHotbarSlot(hero, 0, 'missing-skill').ok, false);
});
await test('legacy arrays and object entries merge into vacancies with safe deduplication', () => {
  const hero = freshHero(),
    skill = activeSkills(hero)[0];
  const source = {
    primaryHotbar: ['basic-attack', null],
    ComboSkillActionHotbar: { slots: [{ skillId: skill.id }, 'basic-attack'] },
    UtilityHotbar: [
      {
        itemId: hero.inventory.find(
          (item) => item.templateId === 'health-potion-1',
        )!.id,
      },
      'minor-mana-potion',
      'mount-not-registered',
    ],
  };
  const migrated = loadPrimaryHotbar(hero, source);
  assert.equal(migrated.primaryHotbar[0], 'basic-attack');
  assert.equal(migrated.primaryHotbar[1], skill.id);
  assert.equal(migrated.primaryHotbar[2], 'health-potion-1');
  assert.equal(migrated.primaryHotbar[3], 'mana-potion-1');
  assert.deepEqual(migrated.primaryHotbarOverflow, ['mount-not-registered']);
  assert.equal(migrated.primaryHotbar.length, 10);
});
await test('full hotbar archives legacy overflow and invalid entries without losing originals', () => {
  const hero = freshHero(),
    before = JSON.stringify(hero.inventory);
  hero.primaryHotbar = defaultPrimaryHotbar(hero);
  const result = loadPrimaryHotbar(hero, {
    primaryHotbar: hero.primaryHotbar,
    utilityHotbar: ['arrows', 'mount-basic', 'unknown-item'],
  });
  assert.equal(result.primaryHotbar.length, 10);
  assert.deepEqual(result.primaryHotbarOverflow, [
    'arrows',
    'mount-basic',
    'unknown-item',
  ]);
  const loaded = validatePrimaryHotbar({ ...hero, ...result });
  assert.deepEqual(loaded.primaryHotbarOverflow, result.primaryHotbarOverflow);
  assert.equal(JSON.stringify(hero.inventory), before);
});
await test('core job promotion clears skill assignments so the player can rebuild the hotbar', () => {
  let hero = freshHero();
  gainXP(hero, 999999);
  hero.equipment.mainHand = null;
  hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
  hero = swapPrimaryHotbarSlots(hero, 0, 6);
  assert.ok(chooseCoreJob(hero, 'wizard'));
  assert.ok(hero.primaryHotbar.every((id) => id === null));
  assert.ok(chooseSpecialization(hero, 'resi'));
  assert.ok(hero.primaryHotbar.every((id) => id === null));
});
await test('reset preserves granted skills and assignments while unavailable skills cannot execute', () => {
  const hero = freshHero();
  hero.skillPoints = 3;
  hero.gold = 1000;
  const skill = activeSkills(hero)[0];
  assert.ok(learnSkill(hero, skill.id));
  const assigned = assignPrimaryHotbarSlot(hero, 0, skill.id);
  assert.ok(assigned.ok);
  hero.primaryHotbar = assigned.hero.primaryHotbar;
  const reset = resetSkillPoints(hero);
  assert.ok(reset.ok);
  assert.equal(reset.hero.skillLevels[skill.id], 1);
  assert.deepEqual(reset.hero.primaryHotbar, hero.primaryHotbar);
  reset.hero.skillLevels[skill.id] = 0;
  assert.match(
    primaryHotbarAssignmentReason(
      reset.hero,
      resolvePrimaryHotbarEntry(reset.hero, skill.id),
    ) ?? '',
    /belum dipelajari/,
  );
  assert.equal(validatePrimaryHotbar(reset.hero).primaryHotbar[0], skill.id);
});
await test('HP potion heals, consumes once, applies shared cooldown and rejects spam', () => {
  const hero = freshHero();
  hero.hp = 10;
  const item = hero.inventory.find(
    (item) => item.templateId === 'health-potion-1',
  )!;
  const quantity = item.quantity;
  assert.ok(consumeInventoryItem(hero, item.id, 1000).ok);
  assert.equal(hero.hp, 10 + Math.ceil(derivedStats(hero).maxHP * 0.3));
  assert.equal(
    resolvePrimaryHotbarEntry(hero, 'health-potion-1')!.quantity,
    quantity - 1,
  );
  const snapshot = JSON.stringify(hero);
  assert.equal(consumeInventoryItem(hero, item.id, 1001).ok, false);
  assert.equal(JSON.stringify(hero), snapshot);
  hero.hp = derivedStats(hero).maxHP - 1;
  assert.ok(consumeInventoryItem(hero, item.id, 4000).ok);
  assert.equal(hero.hp, derivedStats(hero).maxHP);
  assert.equal(consumeInventoryItem(hero, item.id, 8000).ok, false);
});
await test('Mana Potion is not HP Potion, its legacy type is corrected without changing quantity', () => {
  const hero = freshHero();
  hero.hp = 20;
  hero.mana = 0;
  const mana = createItem('mana-potion-1', { quantity: 5 });
  hero.inventory.push(mana);
  assert.ok(consumeInventoryItem(hero, mana.id, 1000).ok);
  assert.equal(hero.mana, Math.ceil(derivedStats(hero).maxMana * 0.3));
  assert.equal(hero.hp, 20);
  const restored = parseSave(
    JSON.stringify({
      ...hero,
      inventory: hero.inventory.map((item) =>
        item.id === mana.id ? { ...item, itemType: 'potion' } : item,
      ),
    }),
  )!;
  assert.equal(
    restored.inventory.find((item) => item.id === mana.id)?.itemType,
    'manaPotion',
  );
  assert.equal(
    restored.inventory.find((item) => item.id === mana.id)?.quantity,
    4,
  );
  assert.equal(restored.itemCooldowns['potion:mana'], 4000);
});
await test('legacy potion API delegates to inventory and cannot bypass item cooldown', () => {
  const hero = freshHero();
  hero.hp = 1;
  const quantity = resolvePrimaryHotbarEntry(
    hero,
    'health-potion-1',
  )!.quantity!;
  assert.ok(consumePotion(hero));
  assert.equal(
    resolvePrimaryHotbarEntry(hero, 'health-potion-1')!.quantity,
    quantity - 1,
  );
  assert.equal(hero.potions, quantity - 1);
  assert.equal(consumePotion(hero), false);
});
await test('disabled stamina food is retained without a cooldown; buff consumables still work', () => {
  const hero = freshHero();
  hero.stamina = 20;
  const food = createItem('rice-meal', { quantity: 2 });
  hero.inventory.push(food);
  const cooldowns = { ...hero.itemCooldowns };
  const result = consumeInventoryItem(hero, food.id, 1000);
  assert.equal(result.ok, false);
  assert.match(result.reason, /stamina sedang dinonaktifkan/);
  assert.equal(hero.stamina, 20);
  assert.equal(hero.inventory.find((item) => item.id === food.id)?.quantity, 2);
  assert.deepEqual(hero.itemCooldowns, cooldowns);
  food.description = 'Memulihkan stamina sepenuhnya.';
  const restored = parseSave(JSON.stringify(hero))!;
  const restoredFood = restored.inventory.find(item => item.id === food.id)!;
  assert.equal(restored.stamina, 20);
  assert.equal(restoredFood.quantity, 2);
  assert.match(restoredFood.description, /stamina sedang dinonaktifkan/);
  assert.deepEqual(restored.primaryHotbar, hero.primaryHotbar);
  assert.deepEqual(restored.equipment, hero.equipment);
  const buff = createItem('rice-meal', {
    id: 'qa-buff',
    templateId: 'qa-buff',
    useEffect: { type: 'buff', buffId: 'damageReduction', duration: 10 },
    useCooldown: 15,
  });
  hero.inventory.push(buff);
  assert.ok(consumeInventoryItem(hero, buff.id, 1000).ok);
  assert.equal(hero.activeBuffs.damageReduction, 10);
  assert.ok(derivedStats(hero).damageReduction > 0);
});
await test('ammunition selection uses existing Bow and does not spend arrows before an attack', () => {
  const hero = freshHero();
  gainXP(hero, 999999);
  hero.equipment.mainHand = null;
  hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
  chooseCoreJob(hero, 'hunter');
  const trainingBow = hero.inventory.find((item) => item.equipmentType === 'bow');
  assert.ok(trainingBow);
  assert.ok(equipItem(hero, trainingBow!.id).ok);
  const arrow = createItem('arrows', { quantity: 20 });
  hero.inventory.push(arrow);
  assert.ok(consumeInventoryItem(hero, arrow.id, 1000).ok);
  assert.equal(hero.selectedAmmo, 'arrows');
  assert.equal(arrow.quantity, 20);
  const sword = createItem('legacy-fajar-blade');
  hero.inventory.push(sword);
  hero.coreJob = null;
  assert.ok(equipItem(hero, sword.id).ok);
  assert.equal(consumeInventoryItem(hero, arrow.id, 1000).ok, false);
});
await test('an unimplemented mount is retained as legacy assignment, not replaced by an invented system', () => {
  const hero = freshHero();
  const result = loadPrimaryHotbar(hero, { utilityHotbar: ['mount-basic'] });
  assert.ok(result.primaryHotbar.every((id) => id === null));
  assert.deepEqual(result.primaryHotbarOverflow, ['mount-basic']);
});
await test('empty slots, layout and item exhaustion survive save reload without item duplication', () => {
  let hero = freshHero();
  hero = removePrimaryHotbarSlot(hero, 5);
  hero.primaryHotbarLayout = { x: 123, y: 234 };
  const potion = hero.inventory.find(
    (item) => item.templateId === 'health-potion-1',
  )!;
  potion.quantity = 1;
  hero.potions = 1;
  hero.hp = 1;
  assert.ok(consumeInventoryItem(hero, potion.id, 1000).ok);
  const restored = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(restored.primaryHotbar, hero.primaryHotbar);
  assert.deepEqual(restored.primaryHotbarLayout, hero.primaryHotbarLayout);
  assert.equal(
    resolvePrimaryHotbarEntry(restored, 'health-potion-1')?.quantity,
    0,
  );
  assert.equal(restored.potions, 0);
  assert.deepEqual(restored.equipment, hero.equipment);
  assert.equal(restored.gold, hero.gold);
});
await test('invalid saved references empty safely; layout reset preserves all assignments', () => {
  const hero = freshHero();
  const next = loadPrimaryHotbar(hero, {
    primaryHotbar: ['bad', null, 'basic-attack'],
    primaryHotbarLayout: { x: Infinity, y: -42 },
  });
  assert.equal(next.primaryHotbar[0], null);
  assert.ok(next.primaryHotbarOverflow.includes('bad'));
  assert.equal(next.primaryHotbarLayout, null);
  assert.deepEqual(
    validatePrimaryHotbar({ ...hero, primaryHotbarLayout: null }).primaryHotbar,
    hero.primaryHotbar,
  );
});
await test('panel positions clamp to viewport on desktop/mobile and keep the handle reachable', () => {
  assert.deepEqual(
    clampPrimaryHotbarLayout(
      { x: -100, y: 2000 },
      { width: 1000, height: 800 },
      { width: 880, height: 140 },
    ),
    { x: 8, y: 652 },
  );
  assert.deepEqual(
    clampPrimaryHotbarLayout(
      { x: 999, y: 999 },
      { width: 390, height: 844 },
      { width: 374, height: 130 },
    ),
    { x: 8, y: 706 },
  );
  assert.equal(
    clampPrimaryHotbarLayout(
      null,
      { width: 390, height: 100 },
      { width: 374, height: 130 },
    ).y,
    8,
  );
  const hero = freshHero();
  assert.ok(
    getPrimaryHotbarEntries(hero).some(
      (entry) => entry.id === 'health-potion-1',
    ),
  );
});
