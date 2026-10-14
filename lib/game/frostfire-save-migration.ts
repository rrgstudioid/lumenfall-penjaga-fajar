import { FROSTFIRE_ENTRY, FROSTFIRE_ID, FROSTFIRE_LAYOUT_VERSION, FROSTFIRE_PREVIEW_ID } from './frostfire-highlands-layout.ts';

/** Migrate both the retired terrain and preview identity without touching items. */
export function migrateFrostfireSave(saved: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...saved, frostfireLayoutVersion: FROSTFIRE_LAYOUT_VERSION };
  const canonical = (id: unknown) => id === FROSTFIRE_PREVIEW_ID ? FROSTFIRE_ID : id;
  result.currentField = canonical(saved.currentField);
  for (const key of ['unlockedFields', 'defeatedFieldBosses'] as const)
    if (Array.isArray(saved[key])) result[key] = [...new Set(saved[key].map(canonical))];
  for (const key of ['fieldProgress', 'defeatedBossTimestamp'] as const) {
    const source = saved[key];
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const record = { ...source } as Record<string, unknown>;
    if (typeof record[FROSTFIRE_PREVIEW_ID] === 'number')
      record[FROSTFIRE_ID] = Math.max(typeof record[FROSTFIRE_ID] === 'number' ? record[FROSTFIRE_ID] : 0, record[FROSTFIRE_PREVIEW_ID]);
    delete record[FROSTFIRE_PREVIEW_ID];
    result[key] = record;
  }
  if (saved.monsterRespawnState && typeof saved.monsterRespawnState === 'object') {
    const timers: Record<string, number> = {};
    for (const [key, value] of Object.entries(saved.monsterRespawnState)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      // These unnamespaced IDs belonged to the removed small-map spawn layout.
      if (/^frostfire-highlands-[0-5](?::spawn:\d+)?$/.test(key)) continue;
      const next = key.startsWith(`${FROSTFIRE_PREVIEW_ID}:`)
        ? `${FROSTFIRE_ID}:${key.slice(FROSTFIRE_PREVIEW_ID.length + 1)}` : key;
      timers[next] = Math.max(timers[next] ?? 0, value);
    }
    result.monsterRespawnState = timers;
  }
  // The replacement is a hunting map without the retired camp's quest giver.
  // Keep completion history, but remove objectives that can no longer be turned in.
  const retiredQuest = (id: unknown) => id === 'story-frostfire-highlands' ||
    typeof id === 'string' && /^field-frostfire-highlands-(easy|veteran|elite)$/.test(id);
  for (const key of ['activeQuests', 'acceptedQuests'] as const)
    if (Array.isArray(saved[key])) result[key] = saved[key].filter(id => !retiredQuest(id));
  if (saved.inCity === false && result.currentField === FROSTFIRE_ID) {
    result.currentCity = 'jayantara';
    if (saved.currentField === FROSTFIRE_ID && saved.frostfireLayoutVersion !== FROSTFIRE_LAYOUT_VERSION) {
      Object.assign(result, FROSTFIRE_ENTRY);
      result.lastSafePosition = { ...FROSTFIRE_ENTRY };
    }
  }
  return result;
}
