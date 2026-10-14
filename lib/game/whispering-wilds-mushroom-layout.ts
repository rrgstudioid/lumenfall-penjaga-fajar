import {
  WILDS_BRIDGES,
  WILDS_CLEARINGS,
  WILDS_ENTRY,
  WILDS_LAKE_ISLAND,
  WILDS_PORTALS,
  wildsTerrainHeight,
  wildsWater,
  wildsWalkable,
  wildsPathDistance,
  wildsProps,
  wildsArchitectureObstacles,
  type WildsProp,
} from './whispering-wilds-layout.ts';

export const WILDS_MUSHROOM_NAMES = [
  'Violet',
  'Emerald',
  'Ember',
  'Frost',
  'Magenta',
] as const;
export type WildsMushroom = WildsProp & { variant: number };
let placements: WildsMushroom[] | undefined;

/** Thirty deterministic, widely separated decorations; six of each source mesh. */
export function wildsMushrooms(): WildsMushroom[] {
  if (placements) return placements;
  let seed = 18731;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const candidates: { x: number; z: number }[] = [];
  const obstacles = [...wildsProps(), ...wildsArchitectureObstacles()];
  for (let z = -380; z <= 380; z += 38)
    for (let x = -380; x <= 380; x += 38) {
      const p = { x: x + (random() - 0.5) * 24, z: z + (random() - 0.5) * 24 };
      if (
        !wildsWalkable(p, 8) ||
        wildsWater(p).distance < 18 ||
        wildsPathDistance(p) < 14
      )
        continue;
      if (
        Math.hypot(p.x - WILDS_LAKE_ISLAND.x, p.z - WILDS_LAKE_ISLAND.z) < 115
      )
        continue;
      if (
        WILDS_CLEARINGS.some(
          (c) => Math.hypot((p.x - c.x) / c.rx, (p.z - c.z) / c.rz) < 0.9,
        )
      )
        continue;
      if (
        [WILDS_ENTRY, ...WILDS_PORTALS, ...obstacles].some(
          (c) => Math.hypot(p.x - c.x, p.z - c.z) < 24,
        )
      )
        continue;
      if (
        WILDS_BRIDGES.some(
          (b) => Math.hypot(p.x - b.x, p.z - b.z) < b.length / 2 + 22,
        )
      )
        continue;
      const h = wildsTerrainHeight(p.x, p.z);
      if (
        [
          [5, 0],
          [-5, 0],
          [0, 5],
          [0, -5],
        ].some(
          ([dx, dz]) =>
            Math.abs(wildsTerrainHeight(p.x + dx, p.z + dz) - h) > 0.75,
        )
      )
        continue;
      candidates.push(p);
    }
  const result: WildsMushroom[] = [];
  for (let i = 0; i < 30; i++) {
    let best = -1,
      separation = -Infinity;
    for (let j = 0; j < candidates.length; j++) {
      const p = candidates[j];
      const distance = result.length
        ? Math.min(...result.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))
        : 500 - Math.hypot(p.x + 280, p.z - 260);
      if (distance > separation) {
        best = j;
        separation = distance;
      }
    }
    if (best < 0 || (i > 0 && separation < 70))
      throw new Error('Cannot place thirty well-separated mushrooms');
    const p = candidates.splice(best, 1)[0],
      height = 12 + (i % 3) * 1.25;
    result.push({
      ...p,
      variant: i % 5,
      kind: 'oak',
      height,
      radius: height * 0.18,
      yaw: random() * Math.PI * 2,
    });
  }
  placements = result;
  return placements;
}
