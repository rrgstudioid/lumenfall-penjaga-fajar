export const ROGUE_SMOKE_VEIL_ID = 'v3-rogue-smoke-veil';
export const ROGUE_VANISH_ID = 'v3-rogue-vanish';
export const canonicalVanishSkillId = (id: string) => id === ROGUE_SMOKE_VEIL_ID ? ROGUE_VANISH_ID : id;

/** Rename only the old V3 Rogue node, before rank/SP normalization. Idempotent;
 * no new ranks, SP charge or refund, no conversion of legacy Thief V2 skills. */
export function migrateVanishSkillMap<T>(map: Record<string, T>): Record<string, T> {
  if (!(ROGUE_SMOKE_VEIL_ID in map)) return map;
  const result = { ...map }, old = result[ROGUE_SMOKE_VEIL_ID], current = result[ROGUE_VANISH_ID];
  result[ROGUE_VANISH_ID] = typeof old === 'number' && typeof current === 'number'
    ? Math.max(old, current) as T : current ?? old;
  delete result[ROGUE_SMOKE_VEIL_ID];
  return result;
}
