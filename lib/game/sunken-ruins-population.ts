import {
  SUNKEN_ZONES,
  SUNKEN_CLEARINGS,
  sunkenInsideWall,
  sunkenSafe,
  sunkenWalkable,
  sunkenHash,
  type SunkenPoint,
} from './sunken-ruins-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';

export const SUNKEN_BOSS_HOME = { x: SUNKEN_ZONES[4].x, z: SUNKEN_ZONES[4].z };
type Home = SunkenPoint & {
  id: number;
  zone: number;
  species: number;
  elite: boolean;
};
export const SUNKEN_HOME_SPACING = 24;
export const SUNKEN_AREA_PER_HOME = 1200;
let homes: Home[] | undefined;
let usableArea = 0;
const areaByZone = new Map<number, number>();
const zoneAt = (p: SunkenPoint) =>
  p.z > 125
    ? 1
    : p.z > -5
      ? 2
      : p.x < -145 && p.z < -80
        ? 4
        : p.z < -270
          ? 5
          : 3;

/** Stable, spaced hunting homes on the actual floor, outside arrival areas and the boss arena. */
export function sunkenPopulation() {
  if (homes) return homes;
  const candidates: Array<SunkenPoint & { zone: number; clearance: number }> =
    [];
  for (let z = -450; z <= 450; z += 16)
    for (let x = -450; x <= 450; x += 16) {
      const p = {
        x: x + (sunkenHash(x, z) - 0.5) * 8,
        z: z + (sunkenHash(z, x) - 0.5) * 8,
      };
      if (
        sunkenSafe(p, 24) ||
        !sunkenInsideWall(p, 24) ||
        !sunkenWalkable(p, 3) ||
        SUNKEN_CLEARINGS.some(
          (q) => Math.hypot(p.x - q.x, p.z - q.z) < q.radius + 3,
        ) ||
        Math.hypot(p.x - SUNKEN_BOSS_HOME.x, p.z - SUNKEN_BOSS_HOME.z) < 85
      )
        continue;
      const zone = zoneAt(p);
      candidates.push({ ...p, zone, clearance: 1000 });
      areaByZone.set(zone, (areaByZone.get(zone) ?? 0) + 16 * 16);
      usableArea += 16 * 16;
    }
  const selected: Home[] = [];
  function select(zone: number, count: number, elite: boolean) {
    for (let i = 0; i < count; i++) {
      let best: (typeof candidates)[number] | undefined,
        clearance = -1;
      for (const p of candidates) {
        if (p.zone !== zone) continue;
        const distance = p.clearance;
        if (distance > clearance) {
          best = p;
          clearance = distance;
        }
      }
      if (!best || clearance < SUNKEN_HOME_SPACING)
        throw Error(`Sunken zone ${zone} fits ${i}/${count} hunting homes`);
      selected.push({
        ...best,
        id: elite
          ? 10000 + selected.filter((p) => p.elite).length
          : 1000 + selected.filter((p) => !p.elite).length,
        elite,
        species: elite
          ? 0
          : zone === 1
            ? 0
            : zone === 2
              ? i % 2
              : zone === 3
                ? 1 + (i % 3)
                : zone === 4
                  ? 2 + (i % 2)
                  : 3,
      });
      candidates.splice(candidates.indexOf(best), 1);
      for (const p of candidates)
        p.clearance = Math.min(
          p.clearance,
          Math.hypot(p.x - best.x, p.z - best.z),
        );
    }
  }
  // Density follows collision-free hunting area in each zone, not the square's
  // inaccessible margins. Keep the original level/species progression and one boss.
  const counts = Array.from({ length: 5 }, (_, i) => {
    const zone = i + 1,
      total = Math.floor((areaByZone.get(zone) ?? 0) / SUNKEN_AREA_PER_HOME);
    const elite = Math.floor(
      total * (zone === 4 ? 0.2 : zone === 3 ? 0.08 : 0),
    );
    return { zone, total, elite };
  });
  for (const p of counts) select(p.zone, p.elite, true);
  for (const p of counts) select(p.zone, p.total - p.elite, false);
  if (!sunkenWalkable(SUNKEN_BOSS_HOME, 6))
    throw Error('Sunken boss arena is blocked');
  return (homes = selected);
}

export function sunkenMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const result = sunkenPopulation()
    .map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      definition: (p.elite ? field.eliteMonsters : field.normalMonsters)[
        p.species
      ],
    }))
    .filter((p) => !!p.definition);
  if (field.fieldBoss)
    result.push({ id: 100, ...SUNKEN_BOSS_HOME, definition: field.fieldBoss });
  return result;
}

export function sunkenPopulationMetrics() {
  const all = sunkenPopulation();
  return {
    usableArea,
    areaPerHome: SUNKEN_AREA_PER_HOME,
    minSpacing: SUNKEN_HOME_SPACING,
    normals: all.filter((p) => !p.elite).length,
    elites: all.filter((p) => p.elite).length,
    bosses: 1,
    zones: [...areaByZone]
      .sort((a, b) => a[0] - b[0])
      .map(([zone, area]) => ({
        zone,
        area,
        count: all.filter((p) => p.zone === zone).length,
      })),
  };
}
