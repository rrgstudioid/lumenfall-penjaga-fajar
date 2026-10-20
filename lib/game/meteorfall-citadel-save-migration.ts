import {
  METEORFALL_ID,
  METEORFALL_LAYOUT_VERSION,
  METEORFALL_ENTRY,
  meteorWalkable,
  type MeteorPoint,
} from "./meteorfall-citadel-layout.ts";
/** Position-only migration: retain quest baselines, inventory and respawn keys verbatim. */
export function migrateMeteorfallSave(
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const result = {
    ...saved,
    meteorfallLayoutVersion: METEORFALL_LAYOUT_VERSION,
  };
  if (saved.inCity !== false || saved.currentField !== METEORFALL_ID)
    return result;
  const p = { x: saved.x as number, z: saved.z as number },
    last = saved.lastSafePosition as MeteorPoint | undefined;
  if (
    saved.meteorfallLayoutVersion !== METEORFALL_LAYOUT_VERSION ||
    !meteorWalkable(p)
  ) {
    const next =
      saved.meteorfallLayoutVersion === METEORFALL_LAYOUT_VERSION &&
      last &&
      meteorWalkable(last)
        ? last
        : METEORFALL_ENTRY;
    Object.assign(result, next, { lastSafePosition: { ...next } });
  }
  return result;
}
