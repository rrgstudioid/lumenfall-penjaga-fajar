import {
  FROSTFIRE_ENTRY,
  FrostNavigation,
  frostCoastDistance,
  frostIce,
  frostPropFootprint,
  frostProps,
  frostSurface,
  type FrostPoint,
} from './frostfire-highlands-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';

export function frostSafe(p: FrostPoint, margin = 0) {
  return (
    Math.hypot(p.x - FROSTFIRE_ENTRY.x, p.z - FROSTFIRE_ENTRY.z) < 45 + margin
  );
}
type Home = FrostPoint & { id: number; species: number; elite: boolean };
let population:
  | { snowArea: number; normalCount: number; eliteCount: number; homes: Home[]; bossHome: FrostPoint }
  | undefined;
export function frostPopulation() {
  if (population) return population;
  const nav = new FrostNavigation(),
    props = frostProps();
  const candidates: (FrostPoint & { nearest: number })[] = [];
  // A 20 m survey counts usable snow, excluding steep terrain, ice, props and entry.
  for (let z = -460; z <= 460; z += 20)
    for (let x = -460; x <= 460; x += 20) {
      const p = {
        x: x + Math.sin(x * 0.37 + z * 0.13) * 4,
        z: z + Math.sin(z * 0.31 - x * 0.17) * 4,
      };
      if (
        frostSafe(p, 25) ||
        frostCoastDistance(p) < 100 ||
        frostIce(p).distance < 10 ||
        frostSurface(p.x, p.z).kind !== 'snow' ||
        !nav.valid(p, 2) ||
        props.some(
          (prop) =>
            Math.hypot(p.x - prop.x, p.z - prop.z) <
            frostPropFootprint(prop) + 5,
        )
      )
        continue;
      candidates.push({ ...p, nearest: Infinity });
    }
  const snowArea = candidates.length * 400;
  const normalTarget = Math.min(320, Math.floor(snowArea / 1600 / 4) * 4);
  const eliteTarget = Math.ceil(normalTarget / 16);
  const selected: FrostPoint[] = [];
  while (selected.length < normalTarget + eliteTarget && candidates.length) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++)
      if (candidates[i].nearest > candidates[best].nearest) best = i;
    if (candidates[best].nearest < 20) break;
    const p = candidates.splice(best, 1)[0];
    selected.push({ x: p.x, z: p.z });
    for (const q of candidates)
      q.nearest = Math.min(q.nearest, Math.hypot(q.x - p.x, q.z - p.z));
  }
  // Reserve spread-out elite homes, then grade normal species south-to-north.
  const elites = selected.splice(0, Math.min(eliteTarget, selected.length));
  selected.sort((a, b) => b.z - a.z || a.x - b.x);
  const homes: Home[] = selected.map((p, i) => {
    const species = Math.min(3, Math.floor((i * 4) / selected.length));
    return {
      ...p,
      id: species * 1000 + (i % Math.ceil(selected.length / 4)),
      species,
      elite: false,
    };
  });
  homes.push(
    ...elites.map((p, i) => ({ ...p, id: 10000 + i, species: 0, elite: true })),
  );
  // Add a northern boss clearing after selecting the existing population, so
  // normal/elite homes and their persisted spawn IDs remain unchanged.
  const bossCandidate = candidates
    .filter(p => p.z < -160 && p.nearest >= 20 && frostIce(p).distance >= 25 &&
      nav.valid(p, 4) && props.every(prop =>
        Math.hypot(p.x - prop.x, p.z - prop.z) >= frostPropFootprint(prop) + 12))
    .sort((a, b) => b.nearest - a.nearest || a.z - b.z || a.x - b.x)[0];
  if (!bossCandidate) throw new Error('Frostfire needs a clear northern boss spawn');
  population = {
    snowArea,
    normalCount: selected.length,
    eliteCount: elites.length,
    homes,
    bossHome: { x: bossCandidate.x, z: bossCandidate.z },
  };
  return population;
}
export function frostMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const population = frostPopulation();
  const spawns = population.homes.flatMap((home) => {
    const definition = (
      home.elite ? field.eliteMonsters : field.normalMonsters
    )[home.species];
    return definition
      ? [{ id: home.id, x: home.x, z: home.z, definition }]
      : [];
  });
  if (field.fieldBoss)
    spawns.push({ id: 20000, ...population.bossHome, definition: field.fieldBoss });
  return spawns;
}
