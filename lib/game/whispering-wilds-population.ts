import {
  WILDS_ENTRY,
  WILDS_PORTALS,
  WILDS_LANDMARKS,
  WILDS_ALTAR,
  WILDS_LAKE_ISLAND,
  wildsWater,
  wildsBridge,
  type WildsPoint,
} from './whispering-wilds-layout.ts';
import { WildsNavigation } from './whispering-wilds-navigation.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';

export const WILDS_BOSS_HOME = WILDS_ALTAR;
export function wildsSafe(p: WildsPoint, margin = 0) {
  return [WILDS_ENTRY, ...WILDS_PORTALS].some(
    (q) => Math.hypot(p.x - q.x, p.z - q.z) < 32 + margin,
  );
}
type Home = WildsPoint & { id: number; species: number; elite: boolean };
let population:
  | {
      huntableArea: number;
      normalCount: number;
      eliteCount: number;
      homes: Home[];
    }
  | undefined;
/** Survey usable land, then spread stable homes using the large-field density. */
export function wildsPopulation() {
  if (population) return population;
  const nav = new WildsNavigation();
  const candidates: (WildsPoint & { nearest: number })[] = [];
  for (let z = -440; z <= 440; z += 20)
    for (let x = -440; x <= 440; x += 20) {
      const p = {
        x: x + Math.sin(x * 0.37 + z * 0.13) * 4,
        z: z + Math.sin(z * 0.31 - x * 0.17) * 4,
      };
      if (
        wildsSafe(p, 24) ||
        wildsWater(p).distance < 12 ||
        wildsBridge(p, -10) ||
        // Preserve the established normal/elite home IDs when moving the boss.
        Math.hypot(p.x - WILDS_LANDMARKS[4].x, p.z - WILDS_LANDMARKS[4].z) <
          90 ||
        Math.hypot(p.x - WILDS_LAKE_ISLAND.x, p.z - WILDS_LAKE_ISLAND.z) <
          100 ||
        !nav.valid(p, 3)
      )
        continue;
      candidates.push({ ...p, nearest: Infinity });
    }
  const huntableArea = candidates.length * 400;
  // One ordinary monster per ~40 x 40 m of usable land; not raw map area.
  const normalTarget = Math.min(320, Math.floor(huntableArea / 1600 / 4) * 4);
  const eliteTarget = Math.ceil(normalTarget / 16);
  const selected: WildsPoint[] = [];
  while (selected.length < normalTarget + eliteTarget && candidates.length) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++)
      if (candidates[i].nearest > candidates[best].nearest) best = i;
    if (candidates[best].nearest < 24) break;
    const p = candidates.splice(best, 1)[0];
    selected.push({ x: p.x, z: p.z });
    for (const q of candidates)
      q.nearest = Math.min(q.nearest, Math.hypot(q.x - p.x, q.z - p.z));
  }
  const elites = selected.splice(0, eliteTarget);
  selected.sort((a, b) => b.z - a.z || a.x - b.x);
  const homes: Home[] = selected.map((p, i) => ({
    ...p,
    id: 1000 + i,
    species: Math.min(3, Math.floor((i * 4) / selected.length)),
    elite: false,
  }));
  homes.push(
    ...elites.map((p, i) => ({ ...p, id: 10000 + i, species: 0, elite: true })),
  );
  // Relocate only homes encroaching on the altar; all other spawn saves stay put.
  for (const home of homes) {
    if (
      Math.hypot(home.x - WILDS_BOSS_HOME.x, home.z - WILDS_BOSS_HOME.z) >= 90
    )
      continue;
    const replacement = candidates
      .filter(
        (p) =>
          Math.hypot(p.x - WILDS_BOSS_HOME.x, p.z - WILDS_BOSS_HOME.z) >= 90 &&
          homes.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 24),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - home.x, a.z - home.z) -
          Math.hypot(b.x - home.x, b.z - home.z),
      )[0];
    if (!replacement)
      throw new Error(
        'No clear replacement for an altar-adjacent monster home',
      );
    home.x = replacement.x;
    home.z = replacement.z;
  }
  if (!nav.valid(WILDS_BOSS_HOME, 4))
    throw new Error('Circular altar boss home is blocked');
  return (population = {
    huntableArea,
    normalCount: selected.length,
    eliteCount: elites.length,
    homes,
  });
}
export function wildsMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const spawns = wildsPopulation().homes.flatMap((home) => {
    const definition = (
      home.elite ? field.eliteMonsters : field.normalMonsters
    )[home.species];
    return definition
      ? [{ id: home.id, x: home.x, z: home.z, definition }]
      : [];
  });
  if (field.fieldBoss)
    spawns.push({
      id: 100,
      x: WILDS_BOSS_HOME.x,
      z: WILDS_BOSS_HOME.z,
      definition: field.fieldBoss,
    });
  return spawns;
}
