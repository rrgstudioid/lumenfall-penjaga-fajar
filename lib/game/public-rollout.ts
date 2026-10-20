/** OWNER: prepare approved equipment/combat/quest rollout, Preview first.
 * Candidate only: publishing/production promotion still requires separate approval.
 * No numeric, capability, class, source, CP or Forge permission is supplied here. */
export const PUBLIC_ROLLOUT = Object.freeze({
  version: 'APPROVED_EQUIPMENT_COMBAT_QUEST_PUBLIC_V1',
  equipment: true,
  quests: true,
  combat: true,
});
export const approvedEquipmentEnabled = () => process.env.NODE_ENV === 'development' || PUBLIC_ROLLOUT.equipment;
export const approvedQuestsEnabled = () => process.env.NODE_ENV !== 'production' || PUBLIC_ROLLOUT.quests;
export const publicCombatEnabled = () => process.env.NODE_ENV === 'production' && PUBLIC_ROLLOUT.combat;
