/** C/K/J are storage groups, independent of the live skill architecture version. */
export type CharacterSaveV2 = { saveVersion: 2; characterId: string;
  C: Record<string, unknown>; K: Record<string, unknown>; J: Record<string, unknown> };
const jobKeys = new Set(['job','jobTier','coreJob','specialization','weaponType','skillArchitectureVersion',
  'skillProgressionV3','rankOwnership','skillPoints','skillLevels','passiveLevels','masteryChoices','jobHistory',
  'primaryHotbar','primaryHotbarOverflow','quickHotbars','coreQuestClaimed','specializationQuestClaimed','masteryQuestClaimed']);
const journalKeys = new Set(['completedQuests','acceptedQuests','activeQuests','questCooldowns','cityProgress',
  'fieldProgress','defeatedFieldBosses','defeatedBossTimestamp','questClaimed','bossDefeated']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function encodeCharacterV2(hero: { characterId: string }): CharacterSaveV2 {
  const result: CharacterSaveV2 = { saveVersion: 2, characterId: hero.characterId, C: {}, K: {}, J: {} };
  for (const [key, value] of Object.entries(hero))
    result[jobKeys.has(key) ? 'K' : journalKeys.has(key) ? 'J' : 'C'][key] = structuredClone(value);
  return result;
}
export function decodeCharacterV2(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null;
  if (!('saveVersion' in value)) return value; // original retained by collection backup
  if (value.saveVersion !== 2 || !record(value.C) || !record(value.K) || !record(value.J) ||
      typeof value.characterId !== 'string' || value.C.characterId !== value.characterId) return null;
  // Reject duplicate group fields rather than silently replacing character data.
  const keys = [...Object.keys(value.C), ...Object.keys(value.K), ...Object.keys(value.J)];
  if (new Set(keys).size !== keys.length) return null;
  return { ...value.C, ...value.K, ...value.J };
}
export function serializeSaveCollection<T extends { characters: Record<string, { characterId: string }>; preservedCharacters?: Record<string, unknown> }>(collection: T) {
  const { preservedCharacters, ...rest } = collection;
  return JSON.stringify({ ...rest, saveVersion: 2, characters: {
    ...preservedCharacters,
    ...Object.fromEntries(Object.entries(collection.characters).map(([id, hero]) => [id, encodeCharacterV2(hero)])),
  } });
}
