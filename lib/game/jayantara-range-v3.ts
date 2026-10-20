import type { ItemData } from './items.ts';

/** Owner approval 16 October: reference 1.40 is already in the integer endpoints.
 * This metadata is not actor, equipment or execution permission. */
export const JAYANTARA_RANGE_V3 = Object.freeze({
  templateId: 'jayantara-two-hand-sword',
  version: 'JAYANTARA_LV45_BASE_V1',
  requiredLevel: 45,
  compatibilityScalar: 46,
  baseRange: Object.freeze({ min: 196, max: 204 }),
  stage: 'BASE',
  referenceAppliedAtAuthoring: true,
} as const);

export function jayantaraAuthoredRange(item: Partial<ItemData>) {
  return item.templateId === JAYANTARA_RANGE_V3.templateId &&
    item.authoredAttackVersion === JAYANTARA_RANGE_V3.version &&
    item.levelRequirement === 45 && item.name === 'Jayantara Greatsword' &&
    item.category === 'weapon' && item.itemType === 'twoHandSword' &&
    item.equipmentType === 'two_hand_sword' && item.handedness === 'two_hand' &&
    item.attackType === 'melee' && item.equipSlot === 'mainHand' &&
    item.mainHand === true && item.offHand === false && item.twoHanded === true &&
    item.rarity === 'epic' && item.enhancementLevel === 0 &&
    item.baseStats?.attack === 46 && item.baseStats.str === 4
    ? JAYANTARA_RANGE_V3.baseRange : null;
}
