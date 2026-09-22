import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG, createItem, normalizeItem } from './items.ts';

const trainingIds = [
  'field-verdant-plains-sword',
  'field-verdant-plains-dagger',
  'field-verdant-plains-staff',
  'field-verdant-plains-bow',
  'field-verdant-plains-mace',
] as const;

test('every Training template is permanently Common', () => {
  for (const templateId of trainingIds) {
    assert.equal(ITEM_CATALOG[templateId].rarity, 'common');
    assert.equal(createItem(templateId).rarity, 'common');
    assert.equal(createItem(templateId, { rarity: 'rare' }).rarity, 'common');
    assert.equal(createItem(templateId, { rarity: 'legendary' }).rarity, 'common');
  }
});

test('Training remains Common after save normalization and cannot inherit old rarity', () => {
  for (const templateId of trainingIds) {
    const saved = createItem(templateId, { id: `saved-${templateId}`, rarity: 'epic', enhancementLevel: 4 });
    const normalized = normalizeItem({ ...saved, rarity: 'mythic' });
    assert.ok(normalized);
    assert.equal(normalized.rarity, 'common');
    assert.equal(normalized.enhancementLevel, 4);
    assert.equal(normalized.id, saved.id);
  }
});
