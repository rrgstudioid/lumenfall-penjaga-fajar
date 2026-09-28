import {
  PLAINS_ENTRY,
  PLAINS_EXIT,
  PLAINS_CLEARING,
  PLAINS_POCKETS,
  PlainsNavigation,
  plainsRoadDistance,
  plainsSafe,
  onPlainsBridge,
  type PlainsPoint,
} from './verdant-plains-layout.ts';
import type { FieldDefinition, MonsterDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';

export const PLAINS_POPULATION = { normal: 480, elite: 16, boss: 1 } as const;
type Home = PlainsPoint & {
  id: number;
  species: number;
  rank: 'normal' | 'elite' | 'boss';
};
let cachedHomes: Home[] | undefined;

/** Layout-only cache: stable IDs, independent of saves, frame timing and player level. */
function populationHomes(): Home[] {
  if (cachedHomes) return cachedHomes;
  const nav = new PlainsNavigation(),
    homes: Home[] = [];
  let seed = 718931;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const valid = (p: PlainsPoint, spacing = 5) =>
    nav.valid(p, 2.5) &&
    !plainsSafe(p, 24) &&
    Math.hypot(p.x - PLAINS_EXIT.x, p.z - PLAINS_EXIT.z) > 32 &&
    !onPlainsBridge(p) &&
    plainsRoadDistance(p) > 3 &&
    Math.hypot(p.x - PLAINS_CLEARING.x, p.z - PLAINS_CLEARING.z) > 55 &&
    homes.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= spacing);
  const speciesAt = (p: PlainsPoint) => {
    const nearest = PLAINS_POCKETS.reduce((a, b) =>
      Math.hypot(p.x - a.x, p.z - a.z) < Math.hypot(p.x - b.x, p.z - b.z)
        ? a
        : b,
    );
    const tiers = [0, 2, 3, 5, 4];
    const base = tiers[PLAINS_POCKETS.indexOf(nearest)];
    return Math.min(6, base + Math.floor(random() * 2));
  };
  const addNormal = (p: PlainsPoint, species = speciesAt(p)) =>
    homes.push({ ...p, id: homes.length, species, rank: 'normal' });
  // Twenty packs occupy the five authored hunting pockets. Forty more packs
  // cover the wider landmass; five creatures per pack at distinct homes.
  const centers: PlainsPoint[] = [];
  for (let pack = 0; pack < 60; pack++) {
    let placed = false;
    for (let attempt = 0; attempt < 4000 && !placed; attempt++) {
      const pocket = pack < 20 ? PLAINS_POCKETS[Math.floor(pack / 4)] : null;
      const angle = random() * Math.PI * 2,
        radius = pocket ? 8 + random() * (pocket.radius - 16) : 0;
      const center = pocket
        ? {
            x: pocket.x + Math.cos(angle) * radius,
            z: pocket.z + Math.sin(angle) * radius,
          }
        : { x: -450 + random() * 900, z: -435 + random() * 735 };
      if (
        !valid(center, 12) ||
        centers.some(
          (p) =>
            Math.hypot(p.x - center.x, p.z - center.z) < (pocket ? 15 : 55),
        )
      )
        continue;
      const members = Array.from({ length: 5 }, (_, i) => ({
        x: center.x + Math.cos(angle + (i * Math.PI * 2) / 5) * 7,
        z: center.z + Math.sin(angle + (i * Math.PI * 2) / 5) * 7,
      }));
      if (!members.every((p) => valid(p))) continue;
      const species = speciesAt(center);
      for (const p of members) addNormal(p, species);
      centers.push(center);
      placed = true;
    }
    if (!placed)
      throw new Error(`Verdant Plains: no safe home for pack ${pack}`);
  }
  // Scattered individuals fill the spaces between packs, not the travel lanes.
  for (
    let attempt = 0;
    homes.length < PLAINS_POPULATION.normal && attempt < 100000;
    attempt++
  ) {
    const p = { x: -460 + random() * 920, z: -440 + random() * 755 };
    if (valid(p, 15)) addNormal(p);
  }
  if (homes.length !== PLAINS_POPULATION.normal)
    throw new Error('Verdant Plains: incomplete normal population');
  for (let i = 0; i < PLAINS_POPULATION.elite; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 10000 && !placed; attempt++) {
      const p = { x: -440 + random() * 880, z: -410 + random() * 700 };
      if (
        !valid(p, 20) ||
        Math.hypot(p.x - PLAINS_ENTRY.x, p.z - PLAINS_ENTRY.z) < 150
      )
        continue;
      homes.push({ ...p, id: 1000 + i, species: i % 2, rank: 'elite' });
      placed = true;
    }
    if (!placed) throw new Error(`Verdant Plains: no safe elite home ${i}`);
  }
  if (!nav.valid(PLAINS_CLEARING, 3))
    throw new Error('Verdant Plains boss clearing is blocked');
  homes.push({ ...PLAINS_CLEARING, id: 2000, species: 0, rank: 'boss' });
  return (cachedHomes = homes);
}

export function plainsMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  return populationHomes().flatMap((home) => {
    const definition: MonsterDefinition | null | undefined =
      home.rank === 'boss'
        ? field.fieldBoss
        : (home.rank === 'elite' ? field.eliteMonsters : field.normalMonsters)[
            home.species
          ];
    return definition
      ? [{ id: home.id, x: home.x, z: home.z, definition }]
      : [];
  });
}
