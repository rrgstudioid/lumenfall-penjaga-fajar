import type { ItemData } from './items.ts';

/** Owner-approved authoring, not an actor enrollment or an enhancement policy. */
export const IRON_SWORD_RANGE_V2 = Object.freeze({
  templateId: 'field-ironveil-mines-sword',
  version: 'IRON_SWORD_LV10_BASE_V1',
  requiredLevel: 10,
  compatibilityScalar: 14,
  baseRange: Object.freeze({ min: 32, max: 36 }),
  stage: 'BASE',
  referenceAppliedAtAuthoring: true,
} as const);

/** Exact instance metadata plus shape. A saved marker is not cryptographic trust.
 * Ownership/host/lifecycle/bonus admission remains the consumer's responsibility.
 * An absent marker, even with requirement10, never inherits the new range.
 */
export function ironSwordAuthoredRange(item: Partial<ItemData>) {
  return item.templateId === IRON_SWORD_RANGE_V2.templateId &&
    item.authoredAttackVersion === IRON_SWORD_RANGE_V2.version &&
    item.levelRequirement === IRON_SWORD_RANGE_V2.requiredLevel &&
    item.name === 'Iron Sword' && item.category === 'weapon' &&
    item.equipmentType === 'one_hand_sword' && item.handedness === 'one_hand' &&
    item.attackType === 'melee' && item.equipSlot === 'mainHand' &&
    item.mainHand === true && item.offHand === false && item.twoHanded === false &&
    item.rarity === 'common' && item.enhancementLevel === 0 &&
    item.baseStats?.attack === IRON_SWORD_RANGE_V2.compatibilityScalar
    ? IRON_SWORD_RANGE_V2.baseRange : null;
}
