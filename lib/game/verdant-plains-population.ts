import { PLAINS_SPAWN_LAYOUT } from './verdant-plains-spawn-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';
export const PLAINS_POPULATION = { normal: 480, elite: 16, boss: 1 } as const;
/** Frozen homes avoid a spawn/navigation dependency cycle when vegetation changes. */
export function plainsMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const definitions = new Map(
    [
      ...field.normalMonsters,
      ...field.eliteMonsters,
      ...(field.fieldBoss ? [field.fieldBoss] : []),
    ].map((definition) => [definition.id, definition]),
  );
  return PLAINS_SPAWN_LAYOUT.flatMap((home) => {
    const definition = definitions.get(home.speciesId);
    return definition
      ? [{ id: home.id, x: home.x, z: home.z, definition }]
      : [];
  });
}
