import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createItem } from './items.ts';
import { shopStock, buyShopItem } from './city-services.ts';
import { createNewCharacter, derivedStats, equipItem, unequipItem, parseSave, characterStatBreakdown, enhancementPreview, enhanceItem } from './rules.ts';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { fitDragonVeilWings } from './dragon-veil-wings.ts';
import { equipmentDropPool } from './monster-loot.ts';
import { FIELDS } from './regions.ts';

await test('developer NPC gives Dragon Veil Wings; exact +500% speed works and persists without raising other gear caps', () => {
  const hero = createNewCharacter('slot-1', 'Wings Test'); hero.inCity = true; hero.gold = 0;
  assert(shopStock('developer-materials').some(i => i.templateId === 'dragon-veil-wings'));
  assert(!shopStock('equipment').some(i => i.templateId === 'dragon-veil-wings'));
  for (const field of Object.keys(FIELDS)) assert(!equipmentDropPool(field).some(i => i.value === 'dragon-veil-wings'));
  const baseline = derivedStats(hero).movementSpeed;
  assert.equal(buyShopItem(hero, 'dragon-veil-wings', 'developer-materials').ok, true);
  assert.equal(hero.gold, 0);
  const wings = hero.inventory.find(i => i.templateId === 'dragon-veil-wings')!;
  assert.equal(wings.baseStats.movementSpeed, 500);
  assert.equal(wings.maxEnhancementLevel, 12);
  assert.equal(equipItem(hero, wings.id, 'chest').ok, false);
  assert.equal(equipItem(hero, wings.id, 'accessory').ok, true);
  assert.equal(derivedStats(hero).movementSpeed, baseline + 500);
  const breakdown = characterStatBreakdown(hero);
  assert.equal(breakdown.base.movementSpeed + breakdown.columns.reduce((sum, c) => sum + c.stats.movementSpeed, 0), breakdown.final.movementSpeed);
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(restored.equipment.accessory, wings.id);
  assert.equal(derivedStats(restored).movementSpeed, baseline + 500);
  assert.equal(unequipItem(restored, 'accessory').ok, true);
  assert.equal(derivedStats(restored).movementSpeed, baseline);
  const normal = createItem('arunika-boots', {levelRequirement:1, baseStats:{movementSpeed:500}});
  restored.inventory.push(normal); equipItem(restored, normal.id);
  assert.equal(derivedStats(restored).movementSpeed, 135);
});

await test('old Wings migrate to +12 and use standard Forge costs, caps, locks and failure handling', () => {
  const hero = createNewCharacter('slot-1', 'Wings Forge');
  const wings = createItem('dragon-veil-wings', { id: 'owned-wings', maxEnhancementLevel: 0 });
  hero.inventory.push(wings);
  assert(equipItem(hero, wings.id).ok);
  hero.storage.push({ ...wings, id: 'stored-wings', enhancementLevel: 3 });
  hero.pendingLoot.push({ ...wings, id: 'pending-wings', enhancementLevel: 4 });
  const loaded = parseSave(JSON.stringify(hero))!;
  for (const location of ['inventory', 'storage', 'pendingLoot'] as const) {
    const restored = loaded[location].find(i => i.templateId === 'dragon-veil-wings')!;
    assert.equal(restored.maxEnhancementLevel, 12);
    assert.equal(restored.enhancementLevel, hero[location].find(i => i.id === restored.id)!.enhancementLevel);
  }
  for (const id of ['iron', 'titanium', 'vibranium', 'meteorite-core']) loaded.inventory.push(createItem(id, { quantity: 99 }));
  for (let level = 0; level < 12; level++) {
    const preview = enhancementPreview(loaded, wings.id)!;
    assert.equal(preview.materialId, ['iron', 'titanium', 'vibranium', 'meteorite-core'][Math.floor(level / 3)]);
    assert.equal(preview.materialRequired, 1 + Math.floor(level / 3));
    assert(enhanceItem(loaded, wings.id, 0, level).ok);
    assert(derivedStats(loaded).movementSpeed <= 635, 'existing movement cap remains enforced');
  }
  assert.equal(enhancementPreview(loaded, wings.id), null);
  assert.equal(enhanceItem(loaded, wings.id, 0).attempted, false);
  const restored = parseSave(JSON.stringify(loaded))!;
  assert.equal(restored.equipment.accessory, wings.id);
  assert.equal(restored.inventory.find(i => i.id === wings.id)!.enhancementLevel, 12);
  assert.equal(derivedStats(restored).movementSpeed, 635);
  const failure = createNewCharacter('slot-2', 'Wings failure');
  const risk = createItem('dragon-veil-wings', { enhancementLevel: 8, isLocked: true });
  failure.inventory.push(risk, createItem('vibranium', { quantity: 3 }));
  assert(equipItem(failure, risk.id).ok);
  assert.equal(enhanceItem(failure, risk.id, 1).attempted, false);
  failure.inventory.find(i => i.id === risk.id)!.isLocked = false;
  assert.equal(enhanceItem(failure, risk.id, 1).attempted, true);
  assert.equal(failure.equipment.accessory, null);
  assert(!failure.inventory.some(i => i.id === risk.id));
});

function meshSource() {
  const scene = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(1, .713, .572), new T.MeshStandardMaterial());
  mesh.position.y = .713 / 2; scene.add(mesh); return scene;
}
await test('wings fit the male body and remain attached during movement; actor disposal releases assets', async () => {
  for (const gender of ['male'] as const) {
    const hero = createNewCharacter('slot-1', 'Wings Test', {gender});
    const item = createItem('dragon-veil-wings'); hero.inventory.push(item); equipItem(hero, item.id);
    const source = meshSource(); let disposed = 0;
    (source.children[0] as T.Mesh).geometry.addEventListener('dispose', () => disposed++);
    const m = createCharacterModel(hero, {accessoryAssetSource:async()=>source});
    assert(await m.accessoryReady);
    const wings = m.actor.getObjectByName('DragonVeilWings')!;
    assert.equal(wings.parent?.parent, m.sockets.accessory);
    m.actor.updateMatrixWorld(true);
    const local = wings.matrix.clone();
    const before = m.sockets.accessory.getWorldPosition(new T.Vector3());
    m.animator.update(.1, {moving:true}); m.actor.rotation.y = .7; m.actor.updateMatrixWorld(true);
    assert(wings.matrix.equals(local));
    assert(before.distanceTo(m.sockets.accessory.getWorldPosition(new T.Vector3())) > .01);
    assert.equal(wings.userData.fittedWidth, 2.8);
    disposeCharacterModel(m.actor); assert.equal(disposed, 1);
  }
});
await test('female characters cannot equip wings and never request the wings mesh', async () => {
  const hero = createNewCharacter('slot-1', 'Wings Test', {gender:'female'});
  const item = createItem('dragon-veil-wings'); hero.inventory.push(item);
  assert.equal(equipItem(hero, item.id, 'accessory').ok, false);
  // Defend the visual path even against a stale or hand-edited loadout.
  hero.equipment.accessory = item.id;
  let loaded = false;
  const m = createCharacterModel(hero, {accessoryAssetSource:async()=>{loaded=true;return meshSource();}});
  await m.accessoryReady;
  assert.equal(loaded, false); assert.equal(m.actor.getObjectByName('DragonVeilWings'), undefined);
  disposeCharacterModel(m.actor);
});
await test('wings arriving after actor disposal release resources without reattaching', async () => {
  const hero = createNewCharacter('slot-1', 'Wings Test');
  const item = createItem('dragon-veil-wings'); hero.inventory.push(item); equipItem(hero, item.id);
  let resolve!: (scene:T.Group)=>void;
  const m = createCharacterModel(hero, {accessoryAssetSource:()=>new Promise(r=>{resolve=r;})});
  disposeCharacterModel(m.actor);
  const source = meshSource(); let disposed = false;
  (source.children[0] as T.Mesh).geometry.addEventListener('dispose',()=>{disposed=true;});
  resolve(source); assert.equal(await m.accessoryReady, false); assert(disposed);
  assert.equal(m.actor.getObjectByName('DragonVeilWings'), undefined);
  assert.throws(()=>fitDragonVeilWings(new T.Group()));
});
