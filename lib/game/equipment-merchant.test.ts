import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG, canEquipItem } from './items.ts';
import { buyShopItem, sellInventoryItem, shopStock, shopItemPrice } from './city-services.ts';
import { freshHero, unlockUniqueStats } from './rules.ts';

const catalogEquipment = Object.values(ITEM_CATALOG).filter((item) =>
  ['weapon', 'armor', 'accessory'].includes(item.category),
);

test('Equipment Merchant lists every catalog weapon, armor, and accessory for every job', () => {
  const expected = catalogEquipment.map((item) => item.templateId);
  for (const coreJob of [null, 'warrior', 'rogue', 'hunter', 'wizard', 'acolyte'] as const) {
    const hero = freshHero();
    hero.coreJob = coreJob;
    assert.deepEqual(shopStock(hero, 'equipment').map((item) => item.templateId), expected);
  }
});

test('buying equipment ignores job restriction while equipping still enforces it', () => {
  const hero = freshHero();
  hero.inCity = true;
  hero.coreJob = 'warrior';
  const hunterItem = catalogEquipment.find((item) => item.allowedJobs.includes('hunter'))!;
  const price = shopItemPrice(hunterItem, 'equipment');
  hero.gold = price;

  const bought = buyShopItem(hero, hunterItem.templateId, 'equipment');
  assert.equal(bought.ok, true);
  const owned = hero.inventory.find((item) => item.templateId === hunterItem.templateId)!;
  assert.equal(canEquipItem(owned, { level: hero.level, coreJob: hero.coreJob, specialization: hero.specialization }).ok, false);
});

test('magnified equipment remains sellable when unequipped and socket-free', () => {
  const hero = freshHero();
  const equipment = catalogEquipment.find((item) => item.templateId === 'fajar-necklace')!;
  hero.inventory = [
    { ...equipment, id: 'sale-necklace', quantity: 1 },
    { ...ITEM_CATALOG.magnifier, id: 'sale-magnifier', quantity: 1 },
  ];

  assert.equal(unlockUniqueStats(hero, 'sale-necklace').ok, true);
  assert.equal(sellInventoryItem(hero, 'sale-necklace', 1, ['weapon', 'armor', 'accessory']).ok, true);
});

test('all catalog equipment remains sellable when unequipped and socket-free', () => {
  const hero = freshHero();
  for (const item of catalogEquipment) {
    const equipment = { ...item, id: `sale-${item.templateId}`, quantity: 1 };
    hero.inventory = [equipment];
    assert.equal(
      sellInventoryItem(hero, equipment.id, 1, ['weapon', 'armor', 'accessory']).ok,
      true,
      item.name,
    );
  }
});
