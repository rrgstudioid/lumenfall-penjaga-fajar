import {
  SUNKEN_ENTRY,
  SUNKEN_ID,
  SUNKEN_LAYOUT_VERSION,
  SUNKEN_PREVIEW_ID,
} from './sunken-ruins-layout.ts';

/** Replace the retired field and preview identity, retaining character progression. */
export function migrateSunkenSave(
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...saved,
    sunkenLayoutVersion: SUNKEN_LAYOUT_VERSION,
  };
  const canonical = (id: unknown) =>
    id === SUNKEN_PREVIEW_ID ? SUNKEN_ID : id;
  result.currentField = canonical(saved.currentField);
  for (const key of ['unlockedFields', 'defeatedFieldBosses'] as const)
    if (Array.isArray(saved[key]))
      result[key] = [...new Set(saved[key].map(canonical))];
  for (const key of ['fieldProgress', 'defeatedBossTimestamp'] as const) {
    const source = saved[key];
    if (!source || typeof source !== 'object' || Array.isArray(source))
      continue;
    const record = { ...source } as Record<string, unknown>;
    if (typeof record[SUNKEN_PREVIEW_ID] === 'number')
      record[SUNKEN_ID] = Math.max(
        typeof record[SUNKEN_ID] === 'number' ? record[SUNKEN_ID] : 0,
        record[SUNKEN_PREVIEW_ID],
      );
    delete record[SUNKEN_PREVIEW_ID];
    result[key] = record;
  }
  if (
    saved.monsterRespawnState &&
    typeof saved.monsterRespawnState === 'object'
  ) {
    const timers: Record<string, number> = {};
    for (const [key, value] of Object.entries(saved.monsterRespawnState)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (/^sunken-ruins-[0-5](?::spawn:\d+)?$/.test(key)) continue;
      const next = key.startsWith(`${SUNKEN_PREVIEW_ID}:`)
        ? `${SUNKEN_ID}:${key.slice(SUNKEN_PREVIEW_ID.length + 1)}`
        : key;
      timers[next] = Math.max(timers[next] ?? 0, value);
    }
    result.monsterRespawnState = timers;
  }
  const retiredQuest = (id: unknown) =>
    id === 'story-sunken-ruins' ||
    (typeof id === 'string' &&
      /^field-sunken-ruins-(easy|veteran|elite)$/.test(id));
  for (const key of ['activeQuests', 'acceptedQuests'] as const)
    if (Array.isArray(saved[key]))
      result[key] = saved[key].filter((id) => !retiredQuest(id));
  if (saved.inCity === false && result.currentField === SUNKEN_ID) {
    result.currentCity = 'jayantara';
    if (
      saved.currentField === SUNKEN_ID &&
      saved.sunkenLayoutVersion !== SUNKEN_LAYOUT_VERSION
    ) {
      Object.assign(result, SUNKEN_ENTRY);
      result.lastSafePosition = { ...SUNKEN_ENTRY };
    }
  }
  return result;
}
