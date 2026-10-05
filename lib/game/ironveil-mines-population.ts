import {
  IRONVEIL_ENTRY,
  IronveilNavigation,
  ironveilPathDistance,
  type IronveilPoint,
} from './ironveil-mines-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';

export const IRONVEIL_POPULATION = { normal: 120, elite: 8, boss: 1 } as const;
export const IRONVEIL_BOSS_HOME = { x: 345, z: 105 };
export function ironveilSafe(p: IronveilPoint, margin = 0) {
  return (
    Math.hypot(p.x - IRONVEIL_ENTRY.x, p.z - IRONVEIL_ENTRY.z) < 32 + margin ||
    (p.x >= 160 - margin && p.x <= 280 + margin && p.z <= 18 + margin)
  );
}
const navigation = new IronveilNavigation();
/** Every forced or AI movement substep respects the same props and cliff domain. */
export function moveIronveilMonster(
  from: IronveilPoint,
  dx: number,
  dz: number,
  radius = 0.55,
) {
  const p = { x: from.x, z: from.z };
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  for (let i = 0; i < steps; i++) {
    const q = navigation.move(p, dx / steps, dz / steps, radius);
    if (ironveilSafe(q, radius)) break;
    Object.assign(p, q);
  }
  return p;
}
let homes:
  | Array<IronveilPoint & { id: number; species: number; elite: boolean }>
  | undefined;
export function ironveilPopulation() {
  if (homes) return homes;
  const candidates: Array<IronveilPoint & { nearest: number }> = [];
  for (let z = 40; z <= 450; z += 22)
    for (let x = -450; x <= 450; x += 22) {
      const p = {
        x: x + Math.sin(x * 0.37 + z * 0.13) * 5,
        z: z + Math.cos(x * 0.19 - z * 0.31) * 5,
      };
      if (
        !navigation.valid(p, 4) ||
        ironveilSafe(p, 28) ||
        ironveilPathDistance(p) < 19 ||
        Math.hypot(p.x - 345, p.z - 105) < 65
      )
        continue;
      candidates.push({ ...p, nearest: Infinity });
    }
  const selected: IronveilPoint[] = [];
  while (selected.length < 128 && candidates.length) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++)
      if (candidates[i].nearest > candidates[best].nearest) best = i;
    const p = candidates.splice(best, 1)[0];
    if (p.nearest < 28)
      throw new Error('Ironveil monster homes are too crowded.');
    selected.push({ x: p.x, z: p.z });
    for (const q of candidates)
      q.nearest = Math.min(q.nearest, Math.hypot(q.x - p.x, q.z - p.z));
  }
  if (selected.length !== 128 || !navigation.valid(IRONVEIL_BOSS_HOME, 4))
    throw new Error('Ironveil population has blocked homes.');
  const elites = selected.splice(0, 8);
  selected.sort((a, b) => b.z - a.z || a.x - b.x);
  homes = selected.map((p, i) => ({
    ...p,
    id: 1000 + i,
    species: Math.min(3, Math.floor(i / 30)),
    elite: false,
  }));
  homes.push(
    ...elites.map((p, i) => ({ ...p, id: 10000 + i, species: 0, elite: true })),
  );
  return homes;
}
export function ironveilMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  return [
    ...ironveilPopulation().map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      definition: (p.elite ? field.eliteMonsters : field.normalMonsters)[
        p.species
      ],
    })),
    ...(field.fieldBoss
      ? [{ id: 100, ...IRONVEIL_BOSS_HOME, definition: field.fieldBoss }]
      : []),
  ];
}
