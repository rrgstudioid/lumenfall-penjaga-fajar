import { IRONVEIL_ID, IRONVEIL_ENTRY } from './ironveil-mines-layout.ts';

/** Old IDs remain valid item/history identities, never travel destinations. */
export function migrateIronveilSave(
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...saved };
  const canonical = (id: unknown) =>
    id === 'ironveil-mines' ? IRONVEIL_ID : id;
  result.currentField = canonical(saved.currentField);
  for (const key of ['unlockedFields', 'defeatedFieldBosses'] as const)
    if (Array.isArray(saved[key]))
      result[key] = [...new Set(saved[key].map(canonical))];
  for (const key of ['fieldProgress', 'defeatedBossTimestamp'] as const) {
    const source = saved[key];
    if (!source || typeof source !== 'object' || Array.isArray(source))
      continue;
    const record = { ...source } as Record<string, unknown>;
    if (typeof record['ironveil-mines'] === 'number')
      record[IRONVEIL_ID] = Math.max(
        typeof record[IRONVEIL_ID] === 'number' ? record[IRONVEIL_ID] : 0,
        record['ironveil-mines'],
      );
    delete record['ironveil-mines'];
    result[key] = record;
  }
  // The retired camp cannot supply objectives; keep completed history intact.
  for (const key of ['activeQuests', 'acceptedQuests'] as const)
    if (Array.isArray(saved[key]))
      result[key] = saved[key].filter(
        (id) =>
          typeof id !== 'string' ||
          !/^((story-ironveil-mines)|(field-ironveil-mines-(easy|veteran|elite)))$/.test(
            id,
          ),
      );
  const underLevel = typeof saved.level === 'number' && saved.level < 8;
  if (underLevel && Array.isArray(result.unlockedFields))
    result.unlockedFields = result.unlockedFields.filter(
      (id) => id !== IRONVEIL_ID,
    );
  if (saved.inCity === false && result.currentField === IRONVEIL_ID) {
    result.currentCity = 'averion';
    if (underLevel)
      Object.assign(result, {
        inCity: true,
        x: 0,
        z: 8,
        lastSafePosition: { x: 0, z: 8 },
      });
    else if (saved.currentField === 'ironveil-mines')
      Object.assign(result, IRONVEIL_ENTRY, {
        lastSafePosition: { ...IRONVEIL_ENTRY },
      });
  }
  return result;
}
