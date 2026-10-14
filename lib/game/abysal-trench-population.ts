import {
  ABYSAL_TRENCH_ARENA,
  ABYSAL_TRENCH_HUNT_POCKETS,
  ABYSAL_TRENCH_PATHS,
  abysalTrenchSafe,
  abysalTrenchWalkable,
} from './abysal-trench-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';
export const SERPENT_GUARDIAN_LENGTH = 14;
export const SERPENT_BOSS_LENGTH = 42;
export const TRENCH_GUARDIAN_CLEARANCE = 8;
export const TRENCH_HOME_SPACING = 24;
export function trenchMonsterWalkable(
  p: { x: number; z: number },
  radius = TRENCH_GUARDIAN_CLEARANCE,
  boss = false,
) {
  const d = Math.hypot(
    p.x - ABYSAL_TRENCH_ARENA.x,
    p.z - ABYSAL_TRENCH_ARENA.z,
  );
  return (
    abysalTrenchWalkable(p, radius) &&
    !abysalTrenchSafe(p, radius) &&
    (boss
      ? d <= ABYSAL_TRENCH_ARENA.radius - radius - 4
      : d >= ABYSAL_TRENCH_ARENA.radius + radius + 12)
  );
}
/** Stable IDs per maze node/edge, independent of selection order and respawn state. */
export function trenchGuardianHomes() {
  const homes: { id: number; x: number; z: number }[] = [];
  const add = (p: (typeof homes)[number]) => {
    if (
      !trenchMonsterWalkable(p, TRENCH_GUARDIAN_CLEARANCE + 2) ||
      abysalTrenchSafe(p, 24)
    )
      return;
    if (
      homes.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < TRENCH_HOME_SPACING)
    )
      return;
    homes.push(p);
  };
  for (const p of ABYSAL_TRENCH_HUNT_POCKETS)
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + p.id * 0.43;
      add({
        id: 1000 + p.id * 10 + i,
        x: p.x + Math.cos(a) * 16,
        z: p.z + Math.sin(a) * 16,
      });
    }
  for (const [a, b] of ABYSAL_TRENCH_PATHS)
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      add({
        id: 10000 + Math.min(a.id, b.id) * 1000 + Math.max(a.id, b.id) * 4 + i,
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  return homes;
}
export function trenchMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const result: MonsterSpawn[] = field.eliteMonsters[0]
    ? trenchGuardianHomes().map((p) => ({
        ...p,
        definition: field.eliteMonsters[0],
      }))
    : [];
  if (field.fieldBoss)
    result.push({
      id: 100,
      x: ABYSAL_TRENCH_ARENA.x,
      z: ABYSAL_TRENCH_ARENA.z,
      definition: field.fieldBoss,
    });
  return result;
}
