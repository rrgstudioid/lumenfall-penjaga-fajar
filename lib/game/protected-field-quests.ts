/** Existing contracts pinned independently of mutable hunting labels. Not new balance. */
export const PROTECTED_FIELD_QUEST_VERSION = 'LEGACY_SUNKEN_METEOR_CONTRACT_V1';
const rows = [
  ['sunken-ruins','easy',32,5,1120,515,2],
  ['sunken-ruins','veteran',35,10,2016,927,3],
  ['sunken-ruins','elite',39,15,3360,1545,5],
  ['meteorfall-citadel','easy',42,5,1470,665,2],
  ['meteorfall-citadel','veteran',44,10,2646,1197,3],
  ['meteorfall-citadel','elite',47,15,4410,1995,5],
] as const;
export const PROTECTED_FIELD_QUESTS = Object.freeze(rows.map(([region,difficulty,requiredLevel,target,xp,gold,quantity])=>Object.freeze({
  id:`field-${region}-${difficulty}`,region,difficulty,requiredLevel,target,
  reward:Object.freeze({xp,gold,items:Object.freeze([Object.freeze({templateId:'vibranium',quantity})])}),
})));
export const protectedFieldQuest = (id:string)=>PROTECTED_FIELD_QUESTS.find(q=>q.id===id);
