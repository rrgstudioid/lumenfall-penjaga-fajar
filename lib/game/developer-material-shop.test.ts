import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from './items.ts';
import { shopItemPrice, shopStock, buyShopItem, sellInventoryItem } from './city-services.ts';
import { CITIES } from './regions.ts';
import { freshHero, parseSave } from './rules.ts';

void test('Kota Arunika has one developer material NPC with a complete active material stock', () => {
  const developerNpcs = CITIES.arunika.npcList.filter(npc => npc.service === 'developer-materials');
  assert.equal(developerNpcs.length, 1);
  assert.deepEqual(developerNpcs[0].services, ['buy', 'sell']);

  const hero = freshHero();
  const materials = Object.values(ITEM_CATALOG).filter(item => item.category === 'material' || item.itemType === 'eternalSeal');
  const stock = shopStock(hero, 'developer-materials');
  assert.ok(materials.length > 0);
  assert.deepEqual(stock.map(item => item.templateId), materials.map(item => item.templateId));
  assert.ok(stock.every(item => shopItemPrice(item, 'developer-materials') === 0));
  const midas = stock.find(item => item.templateId === 'gold-of-midas');
  assert.ok(midas);
  assert.equal(midas.name, 'Gold of Midas');
  assert.equal(midas.description, 'A touch of gold that transforms everything into fortune. A symbol of ambition, prosperity, and limitless power.');
  assert.equal(midas.sellValue, 999999999);
  const seal = stock.find(item => item.itemType === 'eternalSeal');
  assert.ok(seal);
  assert.equal(shopItemPrice(seal, 'developer-materials'), 0);
});

void test('developer material NPC grants materials without changing GOLD and rejects non-materials', () => {
  const hero = freshHero();
  hero.inCity = true;
  hero.currentCity = 'arunika';
  hero.gold = 0;
  const material = shopStock(hero, 'developer-materials')[0];

  const bought = buyShopItem(hero, material.templateId, 'developer-materials');
  assert.equal(bought.ok, true);
  assert.equal(hero.gold, 0);
  assert.equal(hero.inventory.some(item => item.templateId === material.templateId), true);

  const midasPurchase = buyShopItem(hero, 'gold-of-midas', 'developer-materials');
  assert.equal(midasPurchase.ok, true);
  const midas = hero.inventory.find(item => item.templateId === 'gold-of-midas');
  assert.ok(midas);
  const sold = sellInventoryItem(hero, midas!.id, 1);
  assert.equal(sold.ok, true);
  assert.equal(sold.earned, 999999999);
  assert.equal(hero.gold, 999999999);
  assert.equal(parseSave(JSON.stringify(hero))?.gold, 999999999);

  const rejected = buyShopItem(hero, 'health-potion-1', 'developer-materials');
  assert.equal(rejected.ok, false);
  assert.equal(hero.gold, 999999999);
});
