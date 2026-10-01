import {
  WILDS_ID,
  WILDS_RETIRED_ID,
  WILDS_ENTRY,
} from './whispering-wilds-layout.ts';

/** Retire the small field without changing items, species IDs or v2 respawn keys. */
export function migrateWildsSave(
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...saved };
  const canonical = (id: unknown) => (id === WILDS_RETIRED_ID ? WILDS_ID : id);
  result.currentField = canonical(saved.currentField);
  for (const key of ['unlockedFields', 'defeatedFieldBosses'] as const)
    if (Array.isArray(saved[key]))
      result[key] = [...new Set(saved[key].map(canonical))];
  if (
    typeof saved.level === 'number' &&
    saved.level < 16 &&
    Array.isArray(result.unlockedFields)
  )
    result.unlockedFields = result.unlockedFields.filter(
      (id) => id !== WILDS_ID,
    );
  for (const key of ['fieldProgress', 'defeatedBossTimestamp'] as const) {
    const source = saved[key];
    if (!source || typeof source !== 'object' || Array.isArray(source))
      continue;
    const record = { ...source } as Record<string, unknown>;
    if (typeof record[WILDS_RETIRED_ID] === 'number')
      record[WILDS_ID] = Math.max(
        typeof record[WILDS_ID] === 'number' ? record[WILDS_ID] : 0,
        record[WILDS_RETIRED_ID],
      );
    delete record[WILDS_RETIRED_ID];
    result[key] = record;
  }
  if (
    saved.monsterRespawnState &&
    typeof saved.monsterRespawnState === 'object'
  )
    result.monsterRespawnState = Object.fromEntries(
      Object.entries(saved.monsterRespawnState).filter(
        ([key]) => !/^whispering-wilds-[0-5](?::spawn:\d+)?$/.test(key),
      ),
    );
  // The retired camp no longer exists; retain completed history, retire its open objectives.
  for (const key of ['activeQuests', 'acceptedQuests'] as const)
    if (Array.isArray(saved[key]))
      result[key] = saved[key].filter(
        (id) =>
          id !== 'story-whispering-wilds' &&
          !(
            typeof id === 'string' &&
            /^field-whispering-wilds-(easy|veteran|elite)$/.test(id)
          ),
      );
  if (saved.inCity === false && result.currentField === WILDS_ID) {
    result.currentCity = 'arunika';
    if (typeof saved.level === 'number' && saved.level < 16) {
      Object.assign(result, {
        inCity: true,
        x: 0,
        z: 8,
        lastSafePosition: { x: 0, z: 8 },
      });
    } else if (saved.currentField === WILDS_RETIRED_ID) {
      Object.assign(result, WILDS_ENTRY, {
        lastSafePosition: { ...WILDS_ENTRY },
      });
    }
  }
  return result;
}
