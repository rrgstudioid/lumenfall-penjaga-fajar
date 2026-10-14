import type { MonsterDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';
import {
  MINE_ID,
  MINE_ENTRY,
  MINE_SAFE_RADIUS,
  MineNavigation,
  type MinePoint,
} from './ironveil-interior-layout.ts';

export const MINE_POPULATION_COUNT = 480;
// Dedicated save identities; existing exterior definitions and progression stay independent.
export const MINE_MONSTERS: MonsterDefinition[] = Array.from(
  { length: 13 },
  (_, i) => {
    const level = 12 + i;
    const name = [
      'Cave Bat',
      'Ore Grub',
      'Ironfang Bat',
      'Tunnel Marauder',
      'Ironhide Golem',
    ][i % 5];
    // Interpolate the existing normal-monster XP curve at levels 12 / 16 / 24.
    const exp = Math.round(
      level <= 16 ? 520 + (level - 12) * 30 : 640 + (level - 16) * 67.5,
    );
    return {
      id: `${MINE_ID}-level-${level}`,
      name,
      level,
      rank: 'normal',
      variant: 'normal',
      exp,
      maxHP: 30 + level * 16,
      attack: Math.round(8 + level * 2.2),
      defense: Math.round(4 + level * 1.1),
      magicDefense: 3 + level,
      attackSpeed: 1.8,
      movementSpeed: 2.1,
      attackRange: 1.8,
      dropRate: 0.35,
      lootTable: ['health-potion-1', 'iron', 'titanium'],
      respawnTime: 25,
      respawn: 25,
      visualScale: 1,
      nameColor: '#d6e5bd',
      statusLabel: 'Normal',
    };
  },
);
export function mineSafe(p: MinePoint, margin = 0) {
  return (
    Math.hypot(p.x - MINE_ENTRY.x, p.z - MINE_ENTRY.z) <
    MINE_SAFE_RADIUS + margin
  );
}
const navigation = new MineNavigation();
let spawns: MonsterSpawn[] | undefined;
export function mineMonsterSpawns(): MonsterSpawn[] {
  if (spawns) return spawns;
  const candidates: Array<MinePoint & { nearest: number }> = [];
  for (let z = -465; z < 420; z += 12)
    for (let x = -465; x < 465; x += 12) {
      const p = {
        x: x + Math.sin(x * 0.17 + z * 0.13) * 2,
        z: z + Math.cos(z * 0.19 - x * 0.11) * 2,
      };
      if (navigation.valid(p, 3) && !mineSafe(p, 16))
        candidates.push({ ...p, nearest: Infinity });
    }
  const selected: MinePoint[] = [];
  // Farthest-point selection spreads the population over chambers AND every connecting tunnel.
  while (selected.length < MINE_POPULATION_COUNT && candidates.length) {
    let best = 0;
    for (let i = 1; i < candidates.length; i++)
      if (candidates[i].nearest > candidates[best].nearest) best = i;
    const p = candidates.splice(best, 1)[0];
    if (p.nearest < 10) throw new Error('Interior monster homes overlap.');
    selected.push({ x: p.x, z: p.z });
    for (const q of candidates)
      q.nearest = Math.min(q.nearest, Math.hypot(p.x - q.x, p.z - q.z));
  }
  if (selected.length !== MINE_POPULATION_COUNT)
    throw new Error('Insufficient interior monster homes.');
  selected.sort((a, b) => b.z - a.z || a.x - b.x);
  spawns = selected.map((p, i) => ({
    ...p,
    id: 20000 + i,
    definition:
      MINE_MONSTERS[Math.max(0, Math.min(12, Math.floor((410 - p.z) / 65)))],
  }));
  return spawns;
}
export function moveMineMonster(
  from: MinePoint,
  dx: number,
  dz: number,
  radius = 0.55,
) {
  const p = { x: from.x, z: from.z };
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  for (let i = 0; i < steps; i++) {
    const q = navigation.move(p, dx / steps, dz / steps, radius);
    if (mineSafe(q, radius)) break;
    Object.assign(p, q);
  }
  return p;
}
