import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_CATALOG,
  RETIRED_NORMAL_MATERIALS,
  createItem,
  createRuneItem,
  equipmentUsageDescription,
  normalizeItem,
} from './items.ts';
import {
  freshHero,
  parseSave,
  enhancementPreview,
  RUNE_OPTIMIZER_CRAFT_RECIPES,
} from './rules.ts';

await test('active item catalog has useful descriptions without the equipment placeholder', () => {
  for (const item of Object.values(ITEM_CATALOG)) {
    assert.ok(item.description.trim(), item.templateId);
    assert.notEqual(
      item.description,
      'Perlengkapan perjalanan Lumenfall.',
      item.templateId,
    );
    assert.doesNotMatch(item.description, /Spring|PENYA/i);
  }
  for (const id of [
    'lumut-fiber',
    'magnifier',
    'adventurer-pet-egg',
    'arrows',
  ]) {
    assert.ok(ITEM_CATALOG[id].description.length > 150, id);
  }
  assert.match(ITEM_CATALOG['lumut-fiber'].description, /3 Arunika Moss Fiber/);
  assert.match(ITEM_CATALOG.magnifier.description, /Unique Stats/);
  assert.match(ITEM_CATALOG['rice-meal'].description, /stamina/i);
  assert.match(ITEM_CATALOG.arrows.description, /1 anak panah/);
});

await test('material descriptions agree with current enhancement tiers and crafting recipes', () => {
  const hero = freshHero();
  const equipment = createItem('legacy-fajar-blade');
  hero.inventory = [equipment];
  for (let current = 0; current < 12; current++) {
    equipment.enhancementLevel = current;
    const preview = enhancementPreview(hero, equipment.id)!;
    const material = ITEM_CATALOG[preview.materialId];
    assert.ok(
      material.description.includes(
        `${preview.materialRequired} ${material.name} per percobaan`,
      ),
    );
    const lower = Math.floor(current / 3) * 3 + 1;
    assert.ok(material.description.includes(`+${lower} sampai +${lower + 2}`));
  }
  for (const recipe of RUNE_OPTIMIZER_CRAFT_RECIPES) {
    assert.ok(
      ITEM_CATALOG[recipe.materialId].description.includes(
        ITEM_CATALOG[recipe.templateId].name,
      ),
    );
    assert.ok(ITEM_CATALOG[recipe.materialId].description.includes('GOLD'));
  }
  assert.match(
    ITEM_CATALOG['fate-rune-fragment'].description,
    /8 poin persentase/,
  );
  assert.match(
    ITEM_CATALOG['fate-rune-fragment'].description,
    /baik berhasil maupun gagal/,
  );
  assert.match(
    ITEM_CATALOG['eternal-seal'].description,
    /hanya terpakai ketika gagal/,
  );
});

await test('Rune descriptions distinguish possible rolls from granted stats, jobs and extraction', () => {
  for (const rune of Object.values(ITEM_CATALOG).filter(
    (item) => item.itemType === 'socketRune',
  )) {
    assert.match(rune.description, /socket kosong/);
    assert.match(rune.description, /bukan seluruh daftar/);
    assert.match(rune.description, /250 GOLD/);
    assert.ok(rune.description.includes(rune.runeSource!));
    if (rune.runeJobRequirement)
      assert.ok(
        rune.description.includes(`Core Job ${rune.runeJobRequirement}`),
      );
  }
  assert.match(
    createRuneItem('might', 'ancient').description,
    /Physical Damage, Strength, Critical Damage, Damage terhadap Boss/,
  );
  assert.match(
    createRuneItem('vitality', 'cracked').description,
    /Max HP, HP Recovery, Defense, Damage Reduction/,
  );
});

await test('Optimizer descriptions explain Forge-only full Rune rerolls and committed costs', () => {
  for (const optimizer of Object.values(ITEM_CATALOG).filter(item=>item.itemType==='runeOptimizer')) {
    assert.match(optimizer.description,/NPC Forge Master/);
    assert.match(optimizer.description,/Rune terpasang/);
    assert.match(optimizer.description,/Konfirmasi Roll memakai 1 optimizer dan GOLD/);
    assert.match(optimizer.description,/biaya tidak dikembalikan/);
    assert.match(optimizer.description,optimizer.optimizerTier==='basic'?/Quality serta jumlah affix tetap/:/Quality dapat turun, tetap, atau naik/);
    assert.match(optimizer.description,/identitas Rune dan efek unik tetap utuh/);
  }
  assert.match(ITEM_CATALOG['rune-stabilizer'].description,/tidak menjamin upgrade/);
});

await test('equipment descriptions contain the compact gameplay metadata', () => {
  assert.match(
    ITEM_CATALOG['field-sunken-ruins-bow'].description,
    /Main Weapon/,
  );
  assert.match(
    ITEM_CATALOG['field-sunken-ruins-bow'].description,
    /Attack \+33\.0/,
  );
  assert.match(
    ITEM_CATALOG['ironveil-shield'].description,
    /Syarat: warrior/,
  );
  assert.match(
    ITEM_CATALOG['whispering-offhand-dagger'].description,
    /Level: 16/,
  );
  assert.match(ITEM_CATALOG['arcana-tome'].description, /Jenis: tome/);
  assert.match(
    ITEM_CATALOG['hunter-quiver'].description,
    /Harga jual: /,
  );
  assert.match(ITEM_CATALOG['arunika-head'].description, /Slot: Head/);
  assert.match(
    ITEM_CATALOG['arunika-head'].description,
    /Defense \+3\.0/,
  );
});

await test('known old descriptions and empty descriptions migrate without touching item data', () => {
  const legacyDescriptions: Record<string, string> = {
    'lumut-fiber': 'Material crafting dari Lumut Liar.',
    iron: 'Material Iron dari field Chapter 1.',
    'eternal-seal': 'Mencegah destruction atau downgrade enhancement sekali.',
    'rune-might': 'Rune Might untuk socket equipment.',
    'rune-akar-purba':
      'Rune unik Field Boss. Sumber: Ancient Treant · Padang Arunika.',
    'arunika-head': 'Perlengkapan perjalanan Lumenfall.',
    'field-sunken-ruins-bow': 'Senjata basic Common untuk field sunken-ruins.',
  };
  for (const [id, description] of Object.entries(legacyDescriptions)) {
    const item = createItem(id, { description, quantity: 1 });
    const original = structuredClone(item);
    const migrated = normalizeItem(item)!;
    assert.equal(migrated.description, ITEM_CATALOG[id].description);
    assert.deepEqual(migrated, {
      ...item,
      description: ITEM_CATALOG[id].description,
    });
    assert.deepEqual(
      item,
      original,
      'migration must not mutate the saved input',
    );
    assert.deepEqual(
      normalizeItem(migrated),
      migrated,
      'migration must be idempotent',
    );
    for (const empty of [undefined, null, '', '   '])
      assert.equal(
        normalizeItem({ ...item, description: empty })!.description,
        ITEM_CATALOG[id].description,
      );
  }
});

await test('custom copy and retired items are preserved; existing potion descriptions stay valid', () => {
  const custom = createItem('iron', {
    description: 'Besi hadiah guild: simpan untuk event pribadi.',
    isQuestItem: true,
  });
  assert.equal(normalizeItem(custom)!.description, custom.description);
  const unknown = {
    ...custom,
    templateId: 'custom-guild-item',
    description: 'Material milik quest khusus.',
  };
  assert.equal(normalizeItem(unknown)!.description, unknown.description);
  assert.match(
    normalizeItem({ ...unknown, description: '' })!.description,
    /Informasi kegunaannya belum tersedia/,
  );
  for (const id of Object.keys(RETIRED_NORMAL_MATERIALS)) {
    assert.equal(ITEM_CATALOG[id], undefined);
    const retired = normalizeItem({
      id,
      templateId: id,
      category: 'material',
      rarity: 'normal',
      description: 'Catatan item lama.',
    })!;
    assert.equal(retired.description, 'Catatan item lama.');
  }
  for (const type of ['mana', 'health'])
    for (let tier = 1; tier <= 3; tier++) {
      const potion = createItem(`${type}-potion-${tier}`);
      assert.ok(potion.description.includes(`${potion.restoreValue}%`));
      assert.equal(normalizeItem(potion)!.description, potion.description);
    }
});

await test('save reload refreshes inventory, storage and pending loot while preserving equipment and progress', () => {
  const hero = freshHero();
  hero.gold = 4321;
  const equipped = createItem('arunika-head', {
    description: 'Perlengkapan perjalanan Lumenfall.',
    enhancementLevel: 4,
  });
  hero.inventory.push(
    equipped,
    createItem('lumut-fiber', {
      quantity: 7,
      description: 'Material crafting dari Lumut Liar.',
    }),
  );
  hero.equipment.head = equipped.id;
  hero.storage.push(
    createItem('iron', {
      quantity: 12,
      description: 'Material Iron dari field Chapter 1.',
    }),
  );
  hero.pendingLoot.push(
    createItem('magnifier', {
      description: 'Mengungkap Unique Stats equipment yang masih terkunci.',
    }),
  );
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.gold, hero.gold);
  assert.equal(loaded.level, hero.level);
  assert.equal(loaded.xp, hero.xp);
  assert.deepEqual(loaded.equipment, hero.equipment);
  for (const key of ['inventory', 'storage', 'pendingLoot'] as const) {
    assert.deepEqual(
      loaded[key].map(({ description: _description, isEquipped: _isEquipped, ...item }) => item),
      hero[key].map(({ description: _description, isEquipped: _isEquipped, ...item }) => item),
    );
    for (const item of loaded[key]) {
      const expected = ['weapon', 'armor', 'accessory'].includes(item.category)
        ? equipmentUsageDescription(item)
        : ITEM_CATALOG[item.templateId].description;
      assert.equal(item.description, expected);
    }
  }
  const reloaded = parseSave(JSON.stringify(loaded))!;
  for (const key of ['inventory', 'storage', 'pendingLoot'] as const)
    assert.deepEqual(reloaded[key], loaded[key]);
});
