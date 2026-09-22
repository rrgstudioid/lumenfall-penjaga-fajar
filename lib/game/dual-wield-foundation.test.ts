import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from './items.ts';
import { equipItem, freshHero, parseSave, unequipItem } from './rules.ts';
import { aggregateEquipmentStatOnce, resolveUniqueEffects, resolveWeaponAttackContext, type WeaponHitDefinition } from './dual-wield.ts';

function weapon(id: string, attack: number, bonusStats = {}, extra = {}) {
  return createItem('legacy-fajar-blade', {
    id, name: id, baseStats: { attack }, bonusStats, enhancementLevel: 0,
    uniqueEffectData: undefined, ...extra,
    equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false,
    equipSlot: 'mainHand', mainHand: true, offHand: false, ...extra,
  });
}
function greatsword(id: string) { return createItem('jayantara-two-hand-sword', { id, name: id, baseStats: { attack: 120 }, equipSlot: 'mainHand' }); }
function shield(id: string) { return createItem('ironveil-shield', { id, equipSlot: 'offHand' }); }

await test('Dual Wield capability is false by default and rejects the second sword atomically', () => {
  const hero = freshHero(); hero.skillArchitectureVersion = 3;
  const main = weapon('dw-main', 100), off = weapon('dw-off', 70);
  hero.inventory.push(main, off); hero.equipment.mainHand = main.id; hero.inventory.forEach(i => { i.isEquipped = i.id === main.id; });
  const before = JSON.stringify(hero.equipment);
  const result = equipItem(hero, off.id, 'offHand');
  assert.equal(result.ok, false); assert.equal((result as { code?: string }).code, 'DUAL_WIELD_CAPABILITY_REQUIRED'); assert.equal(JSON.stringify(hero.equipment), before);
});

await test('development capability accepts two real one-hand swords and preserves full layers', () => {
  const hero = freshHero(); hero.skillArchitectureVersion = 3; hero.level = 10; hero.canDualWieldOneHandSwords = true; unequipItem(hero, 'mainHand');
  const main = weapon('dw-main-2', 100, { str: 8, critRate: 2 }, { uniqueEffectData: { id: 'effect-x', magnitude: 10, priority: 0, stackable: false } });
  const off = weapon('dw-off-2', 70, { str: 7, critRate: 3 }, { uniqueEffectData: { id: 'effect-x', magnitude: 6, priority: 0, stackable: false }, equipSlot: 'offHand' });
  hero.inventory.push(main, off);
  assert.equal(equipItem(hero, main.id, 'mainHand').ok, true); assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
  const context = resolveWeaponAttackContext(main, off, 'DUAL_COMBINED', 200);
  assert.equal(context.mainHandWeaponAttack, 100); assert.equal(context.offHandWeaponAttack, 70); assert.equal(context.totalWeaponAttack, 170);
  const stats = aggregateEquipmentStatOnce(main, off); assert.equal(stats.str, 15); assert.equal(stats.critRate, 5);
  assert.equal(resolveUniqueEffects(main, off).find(e => e.id === 'effect-x')?.magnitude, 10);
});

await test('weapon modes keep SINGLE_MAIN isolated and sequence shares character core once', () => {
  const main = weapon('dw-context-main', 100), off = weapon('dw-context-off', 70);
  assert.equal(resolveWeaponAttackContext(main, off, 'SINGLE_MAIN', 200).totalWeaponAttack, 100);
  assert.equal(resolveWeaponAttackContext(main, { ...off, baseStats: { attack: 170 } }, 'SINGLE_MAIN', 200).totalWeaponAttack, 100);
  const sequence: WeaponHitDefinition[] = [
    { weaponHand: 'MAIN', sharedContributionWeight: .6, weaponContributionCoefficient: 1, skillCoefficient: .8 },
    { weaponHand: 'OFF', sharedContributionWeight: .4, weaponContributionCoefficient: 1, skillCoefficient: .8 },
  ]; assert.equal(sequence.reduce((sum, hit) => sum + hit.sharedContributionWeight, 0), 1);
  const resolved = resolveWeaponAttackContext(main, off, 'DUAL_SEQUENCE', 200);
  assert.equal(resolved.mainHandWeaponAttack, 100); assert.equal(resolved.offHandWeaponAttack, 70); assert.equal(resolved.totalWeaponAttack, 0);
});

await test('two-hand conflicts reject without deleting either item; shield remains a valid normal off-hand', () => {
  const hero = freshHero(); hero.skillArchitectureVersion = 3; hero.level = 10; hero.canDualWieldOneHandSwords = true; unequipItem(hero, 'mainHand');
  const main = weapon('dw-main-3', 100), off = weapon('dw-off-3', 70), two = greatsword('dw-two'), guard = shield('dw-shield');
  hero.inventory.push(main, off, two, guard); assert.equal(equipItem(hero, main.id, 'mainHand').ok, true); assert.equal(equipItem(hero, off.id, 'offHand').ok, true);
  const rejected = equipItem(hero, two.id, 'mainHand'); assert.equal(rejected.ok, false); assert.equal((rejected as { code?: string }).code, 'TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON');
  assert.ok(hero.inventory.some(i => i.id === off.id)); assert.equal(hero.equipment.offHand, off.id);
  assert.equal(unequipItem(hero, 'offHand').ok, true); assert.equal(equipItem(hero, guard.id, 'offHand').ok, true); assert.equal(hero.equipment.offHand, guard.id);
});

await test('duplicate unique effects are non-stacking unless explicitly stackable and save keeps both instances', () => {
  const main = weapon('dw-save-main', 100, {}, { uniqueEffectData: { id: 'x', magnitude: 10, priority: 0, stackable: false } });
  const off = weapon('dw-save-off', 70, {}, { uniqueEffectData: { id: 'x', magnitude: 6, priority: 0, stackable: false } });
  assert.equal(resolveUniqueEffects(main, off).filter(e => e.id === 'x').length, 1);
  const stacked = resolveUniqueEffects(main, { ...off, uniqueEffectData: { id: 'x', magnitude: 6, priority: 0, stackable: true } }); assert.equal(stacked.filter(e => e.id === 'x').length, 2);
  const hero = freshHero(); hero.skillArchitectureVersion = 3; hero.level = 10; hero.canDualWieldOneHandSwords = true; unequipItem(hero, 'mainHand'); hero.inventory.push(main, off); equipItem(hero, main.id, 'mainHand'); equipItem(hero, off.id, 'offHand');
  const restored = parseSave(JSON.stringify(hero), 'dual-wield-save'); assert.equal(restored?.equipment.mainHand, main.id); assert.equal(restored?.equipment.offHand, off.id); assert.equal(restored?.inventory.find(i => i.id === off.id)?.uniqueEffectData?.id, 'x');
});
