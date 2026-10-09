import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';
import { deepOceanSafe, deepOceanWalkable } from './deep-ocean-layout.ts';
export const DEEP_OCEAN_BOSS_HOME = { x: -240, z: -280 };
/** One spaced home per 50-unit cell, stable IDs and a clear boss/portal buffer. */
export function deepOceanMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const result: MonsterSpawn[] = [];
  for (let row = 0; row < 19; row++)
    for (let col = 0; col < 19; col++) {
      const id = row * 19 + col,
        x = -450 + col * 50 + Math.sin(id * 7.13) * 6,
        z = 450 - row * 50 + Math.cos(id * 4.91) * 6;
      const p = { x, z };
      if (
        !deepOceanWalkable(p, 25) ||
        deepOceanSafe(p, 28) ||
        Math.hypot(x - DEEP_OCEAN_BOSS_HOME.x, z - DEEP_OCEAN_BOSS_HOME.z) < 95
      )
        continue;
      const elite = id % 19 === 7 && row > 2;
      const species = z > 160 ? id % 2 : z > -140 ? 1 + (id % 3) : id % 4;
      const definition = elite
        ? field.eliteMonsters[0]
        : field.normalMonsters[species];
      if (definition) result.push({ id: 1000 + id, ...p, definition });
    }
  if (field.fieldBoss)
    result.push({
      id: 100,
      ...DEEP_OCEAN_BOSS_HOME,
      definition: field.fieldBoss,
    });
  return result;
}
