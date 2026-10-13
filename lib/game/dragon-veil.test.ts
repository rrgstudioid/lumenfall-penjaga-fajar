import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  DRAGON_VEIL_PIECES,
  dragonVeilLoadout,
  resolveDragonVeilTemplateId,
} from './dragon-veil.ts';
import {
  createItem,
  canEquipItem,
  emptyEquipment,
  normalizeItem,
} from './items.ts';
import {
  createNewCharacter,
  derivedStats,
  equipItem,
  unequipItem,
  parseSave,
  enhanceItem,
  enhancementPreview,
  isEnhanceableEquipment,
  removeSocketedRune,
} from './rules.ts';
import { buyShopItem, sellInventoryItem, shopStock } from './city-services.ts';
import { equipmentDropPool } from './monster-loot.ts';
import { CITIES, FIELDS } from './regions.ts';
import { getItemIconPath } from './item-icons.ts';
import { bindDragonVeilMesh } from './dragon-veil-model.ts';
import { getCharacterEquipmentLayers } from './character-view.ts';

await test('legacy Dragon Veil Pants resolve the actual Legs model/icon and migrate without losing owned item data', () => {
  for (const templateId of ['dragon-veil-pants', 'legacy-owned-pants']) {
    const hero = createNewCharacter('slot-1', 'Owned Pants');
    const pants = {
      ...createItem('dragon-veil-legs', {
        id: 'owned-pants',
        enhancementLevel: 7,
        sockets: [
          {
            id: 'pants-rune-slot',
            rune: { ...createItem('rune-might'), sourceLabel: 'Owned rune' },
          },
        ],
      }),
      templateId,
      name: 'Dragon Veil Pants',
      asset: {
        icon: '/obsolete-pants.png',
        sprite: '/obsolete-pants.png',
        model: '/obsolete-pants.glb',
        fallback: 'legs',
      },
    };
    // Also handle a still-running session before its next save migration.
    hero.inventory.push(pants);
    hero.equipment.legs = pants.id;
    assert.equal(
      getItemIconPath(templateId, pants),
      getItemIconPath('dragon-veil-legs'),
    );
    assert.deepEqual(dragonVeilLoadout(getCharacterEquipmentLayers(hero)), {
      legs: 'dragon-veil-legs',
    });
    for (const [location, id] of [
      ['storage', 'stored-pants'],
      ['pendingLoot', 'pending-pants'],
    ] as const)
      hero[location].push({ ...pants, id });
    const loaded = parseSave(JSON.stringify(hero))!;
    for (const [location, id] of [
      ['inventory', 'owned-pants'],
      ['storage', 'stored-pants'],
      ['pendingLoot', 'pending-pants'],
    ] as const) {
      const item = loaded[location].find((i) => i.id === id)!;
      assert.equal(item.templateId, 'dragon-veil-legs');
      assert.equal(item.name, 'Dragon Veil Pants');
      assert.equal(item.enhancementLevel, pants.enhancementLevel);
      assert.deepEqual(item.sockets, pants.sockets);
      assert.deepEqual(item.baseStats, pants.baseStats);
      assert.deepEqual(item.bonusStats, pants.bonusStats);
      assert.equal(item.asset?.icon, getItemIconPath('dragon-veil-legs'));
      assert.match(item.asset!.model!, /dragon-veil\/legs-lod0\.glb/);
      assert.equal(item.equipSlot, 'legs');
    }
    assert.equal(loaded.equipment.legs, pants.id);
    const twice = parseSave(JSON.stringify(loaded))!;
    assert.deepEqual(twice.inventory, loaded.inventory);
    assert.deepEqual(twice.storage, loaded.storage);
    assert.deepEqual(twice.pendingLoot, loaded.pendingLoot);
    assert(unequipItem(loaded, 'legs').ok);
    assert.deepEqual(
      dragonVeilLoadout(getCharacterEquipmentLayers(loaded)),
      {},
    );
    assert(equipItem(loaded, pants.id, 'legs').ok);
    assert.deepEqual(dragonVeilLoadout(getCharacterEquipmentLayers(loaded)), {
      legs: 'dragon-veil-legs',
    });
  }
  assert.equal(createItem('dragon-veil-pants').templateId, 'dragon-veil-legs');
  assert.equal(
    getItemIconPath('dragon-veil-pants'),
    getItemIconPath('dragon-veil-legs'),
  );
  assert.equal(
    resolveDragonVeilTemplateId({
      templateId: 'unrelated',
      name: 'Dragon Veil Pants Replica',
      category: 'armor',
      equipSlot: 'legs',
    }),
    'unrelated',
  );
  assert.equal(
    resolveDragonVeilTemplateId({
      templateId: 'unrelated',
      name: 'Dragon Veil Pants',
      category: 'material',
    }),
    'unrelated',
  );
});

await test('Dragon Veil is obtainable for zero gold, male Lv1, with exact capped endgame stats and persistent icons', () => {
  const hero = createNewCharacter('slot-1', 'Dragon Veil');
  hero.inCity = true;
  hero.gold = 0;
  for (const p of DRAGON_VEIL_PIECES) {
    assert(shopStock('developer-materials').some((i) => i.templateId === p.id));
    assert(!shopStock('equipment').some((i) => i.templateId === p.id));
    for (const field of Object.keys(FIELDS))
      assert(!equipmentDropPool(field).some((i) => i.value === p.id));
    assert(buyShopItem(hero, p.id, 'developer-materials').ok);
    const item = hero.inventory.find((i) => i.templateId === p.id)!;
    assert.equal(item.rarity, 'ancient');
    assert.equal(item.levelRequirement, 1);
    assert.equal(item.maxEnhancementLevel, 12);
    assert.equal(item.isTradable, false);
    assert.equal(item.isSellable, false);
    assert.deepEqual(item.sockets, []);
    assert(!canEquipItem(item, { ...hero, gender: 'female' }).ok);
    assert(!canEquipItem(item, { ...hero, level: 0 }).ok);
    assert(!equipItem(hero, item.id, 'accessory').ok);
    assert(equipItem(hero, item.id, p.slot).ok);
    assert.equal(getItemIconPath(p.id), `/assets/icons/items/${p.id}.webp?v=2`);
  }
  assert.equal(hero.gold, 0);
  const stats = derivedStats(hero);
  assert.equal(stats.maxHP, 14630);
  assert.equal(stats.physicalAttack, 1716);
  assert.equal(stats.magicAttack, 1752);
  assert.equal(stats.movementSpeed, 135);
  assert.equal(stats.cooldownReduction, 30);
  assert.equal(stats.bossDamage, 40);
  assert.equal(stats.skillDamage, 45);
  const wings = createItem('dragon-veil-wings');
  hero.inventory.push(wings);
  assert(equipItem(hero, wings.id).ok);
  assert.equal(derivedStats(hero).movementSpeed, 635);
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(derivedStats(loaded), derivedStats(hero));
  for (const p of DRAGON_VEIL_PIECES) {
    const item = loaded.inventory.find((i) => i.templateId === p.id)!;
    assert.equal(item.asset?.icon, getItemIconPath(p.id));
    assert(unequipItem(loaded, p.slot).ok);
    assert(!sellInventoryItem(loaded, item.id, 1).ok);
  }
});

await test('retired Gloves never equip, sell or drop as new stock; migration preserves owned enhanced/socketed instances', () => {
  assert(!Object.hasOwn(emptyEquipment(), 'gloves'));
  for (const service of ['equipment', 'developer-materials'])
    assert(!shopStock(service).some((i) => i.equipmentType === 'gloves'));
  for (const field of Object.keys(FIELDS))
    assert(!equipmentDropPool(field).some((i) => i.value === 'arunika-gloves'));
  for (const full of [false, true]) {
    const hero = createNewCharacter('slot-1', 'Legacy Gloves');
    hero.inventory = [];
    hero.equipment = emptyEquipment();
    if (full)
      for (let i = 0; i < hero.inventoryCapacity; i++)
        hero.inventory.push(createItem('arunika-head'));
    const rune = createItem('rune-might');
    const glove = createItem('arunika-gloves', {
      id: 'owned-glove',
      enhancementLevel: 7,
      sockets: [
        { id: 'socket-1', rune: { ...rune, sourceLabel: 'Owned rune' } },
      ],
    });
    hero.inventory.push({ ...glove, isEquipped: true });
    const raw = { ...hero, equipment: { ...hero.equipment, gloves: glove.id } };
    const migrated = parseSave(JSON.stringify(raw))!;
    assert(migrated);
    assert(!Object.hasOwn(migrated.equipment, 'gloves'));
    const owned = (full ? migrated.pendingLoot : migrated.inventory).find(
      (i) => i.id === glove.id,
    )!;
    assert(owned);
    assert.equal(owned.enhancementLevel, 7);
    assert.equal(owned.sockets[0].rune?.id, rune.id);
    assert.equal(owned.isEquipped, false);
    assert.equal(owned.equipSlot, null);
    assert(!canEquipItem(owned, migrated).ok);
    const twice = parseSave(JSON.stringify(migrated))!;
    assert.equal(
      [...twice.inventory, ...twice.storage, ...twice.pendingLoot].filter(
        (i) => i.id === glove.id,
      ).length,
      1,
    );
    assert.equal(
      derivedStats(twice).maxHP,
      derivedStats(createNewCharacter('slot-1', 'Baseline')).maxHP,
    );
    if (!full) {
      const forge = CITIES.arunika.npcList.find((n) => n.service === 'forge')!;
      twice.inCity = true;
      twice.currentCity = 'arunika';
      twice.x = forge.x;
      twice.z = forge.z;
      twice.gold = 1000;
      assert(removeSocketedRune(twice, glove.id, 0, forge.id).ok);
      assert(twice.inventory.some((i) => i.id === rune.id));
      assert(sellInventoryItem(twice, glove.id, 1).ok);
    }
  }
  const unknown = normalizeItem({
    id: 'custom-glove',
    templateId: 'custom-glove',
    category: 'armor',
    itemType: 'gloves',
    equipmentType: 'gloves',
    equipSlot: 'gloves',
    baseStats: { defense: 77 },
    enhancementLevel: 9,
  })!;
  assert.equal(unknown.equipSlot, null);
  assert.equal(unknown.baseStats.defense, 77);
  assert.equal(unknown.enhancementLevel, 9);
});

await test('saved Dragon Veil with obsolete enhancement limits returns to the Forge list without losing owned data', () => {
  const hero = createNewCharacter('slot-1', 'Saved Dragon Veil Forge');
  const owned = [
    ...DRAGON_VEIL_PIECES.map((p) => p.id),
    'dragon-veil-pants',
  ].map((id, index) => {
    const item = createItem(id, {
      id: `old-forge-${index}`,
      enhancementLevel: index,
      maxEnhancementLevel: 0,
      sockets: [
        {
          id: `owned-socket-${index}`,
          rune: { ...createItem('rune-might'), sourceLabel: 'Owned rune' },
        },
      ],
      bonusStats: { hp: 123 },
      isLocked: index === 1,
    });
    if (id === 'dragon-veil-pants') {
      item.templateId = id;
      item.name = 'Dragon Veil Pants';
    }
    return item;
  });
  hero.inventory.push(
    ...owned,
    createItem('iron', { quantity: 99 }),
    createItem('titanium', { quantity: 99 }),
  );
  hero.equipment.head = owned[0].id;
  hero.storage.push({ ...owned[2], id: 'stored-forge-legs' });
  hero.pendingLoot.push({ ...owned[3], id: 'pending-forge-boots' });
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.equipment.head, owned[0].id);
  for (const original of owned) {
    const item = loaded.inventory.find((i) => i.id === original.id)!;
    assert.equal(item.maxEnhancementLevel, 12, original.templateId);
    assert(
      isEnhanceableEquipment(item),
      `${original.templateId} must appear in the Forge list`,
    );
    assert.equal(item.enhancementLevel, original.enhancementLevel);
    assert.deepEqual(item.baseStats, original.baseStats);
    assert.deepEqual(item.bonusStats, original.bonusStats);
    assert.deepEqual(item.sockets, original.sockets);
    assert.equal(item.isLocked, original.isLocked);
    if (item.isLocked) {
      const before = JSON.stringify(loaded.inventory);
      assert.match(
        enhancementPreview(loaded, item.id)!.blockedReason,
        /terkunci/,
      );
      assert.equal(enhanceItem(loaded, item.id, 0).attempted, false);
      assert.equal(JSON.stringify(loaded.inventory), before);
    } else {
      assert(enhanceItem(loaded, item.id, 0, item.enhancementLevel).ok);
      assert.equal(
        loaded.inventory.find((i) => i.id === item.id)!.enhancementLevel,
        original.enhancementLevel + 1,
      );
    }
  }
  assert.equal(loaded.storage[0].maxEnhancementLevel, 12);
  assert.equal(loaded.pendingLoot[0].maxEnhancementLevel, 12);
  const twice = parseSave(JSON.stringify(loaded))!;
  for (const collection of ['inventory', 'storage', 'pendingLoot'] as const)
    assert.deepEqual(twice[collection], loaded[collection]);
  const wings = normalizeItem(createItem('dragon-veil-wings'))!;
  assert.equal(wings.maxEnhancementLevel, 12);
  assert.equal(isEnhanceableEquipment(wings), true);
});

await test('Dragon Veil uses the existing enhancement materials and stops at +12', () => {
  const hero = createNewCharacter('slot-1', 'Dragon Veil Forge');
  for (const id of ['iron', 'titanium', 'vibranium', 'meteorite-core'])
    hero.inventory.push(createItem(id, { quantity: 99 }));
  for (const p of DRAGON_VEIL_PIECES) {
    const item = createItem(p.id);
    hero.inventory.push(item);
    for (let level = 0; level < 12; level++) {
      assert.equal(
        enhancementPreview(hero, item.id)!.materialId,
        ['iron', 'titanium', 'vibranium', 'meteorite-core'][
          Math.floor(level / 3)
        ],
      );
      assert(enhanceItem(hero, item.id, 0, level).ok);
    }
    assert.equal(
      hero.inventory.find((i) => i.id === item.id)!.enhancementLevel,
      12,
    );
    assert.equal(enhancementPreview(hero, item.id), null);
    assert.equal(enhanceItem(hero, item.id, 0).attempted, false);
  }
});

async function geometryOnly(path: string) {
  const bytes = await readFile(path),
    length = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  json.materials = [];
  json.textures = [];
  json.images = [];
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) delete p.material;
  const encoded = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(padded);
  const binary = bytes.subarray(20 + length);
  const result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20);
  binary.copy(result, 20 + padded.length);
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      result.buffer.slice(
        result.byteOffset,
        result.byteOffset + result.byteLength,
      ),
      '',
    );
  const meshes: T.SkinnedMesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  return meshes;
}
await test('all 16 Dragon Veil derivatives bind to the canonical Male V2 skeleton with valid skin weights', async () => {
  const [body] = await geometryOnly(
    'public/assets/characters/male-v2/body/body-lod0.glb',
  );
  for (const p of DRAGON_VEIL_PIECES) {
    let previous = Infinity;
    for (let lod = 0; lod < 4; lod++) {
      const meshes = await geometryOnly(
        `public/assets/equipment/dragon-veil/${p.piece}-lod${lod}.glb`,
      );
      assert(meshes.length);
      let triangles = 0;
      for (const mesh of meshes) {
        const bound = bindDragonVeilMesh(mesh, body);
        assert(
          bound.skeleton.bones.every((b) => body.skeleton.bones.includes(b)),
        );
        const w = mesh.geometry.getAttribute('skinWeight');
        for (let i = 0; i < w.count; i++)
          assert(
            Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 0.001,
          );
        triangles += mesh.geometry.index!.count / 3;
        bound.skeleton.dispose();
      }
      assert(triangles > 0 && triangles <= previous);
      previous = triangles;
    }
    const icon = await readFile(`public/assets/icons/items/${p.id}.webp`);
    assert.equal(icon.toString('ascii', 0, 4), 'RIFF');
    assert.equal(icon.toString('ascii', 8, 12), 'WEBP');
  }
});
