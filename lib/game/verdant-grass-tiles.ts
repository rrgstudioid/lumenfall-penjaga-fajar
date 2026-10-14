import { plainsGrassTileCount, type PlainsQuality } from './verdant-plains-quality.ts';

// Spatial batches only: every quality retains exactly its original random prefix.
// Positions remain relative to the original tile so shader phase and wind do not move.
export function partitionPlainsGrass(patches: Float32Array, tileSize: number) {
  const qualities: PlainsQuality[] = ['office', 'light', 'balanced', 'high'];
  const buckets = Array.from({ length: 4 }, (_, i) => ({
    x: i % 2,
    z: Math.floor(i / 2),
    values: [] as number[],
    counts: { office: 0, light: 0, balanced: 0, high: 0 },
  }));
  const limits = qualities.map(plainsGrassTileCount);
  for (let i = 0; i < patches.length / 4; i++) {
    const x = patches[i * 4], z = patches[i * 4 + 1];
    const bucket = buckets[(x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0)];
    bucket.values.push(x, z, patches[i * 4 + 2], patches[i * 4 + 3]);
    qualities.forEach((quality, q) => {
      if (i < limits[q]) bucket.counts[quality]++;
    });
  }
  return buckets.map(({ x, z, values, counts }) => ({
    x, z, counts,
    patches: new Float32Array(values),
    minX: (x - 1) * tileSize / 2,
    minZ: (z - 1) * tileSize / 2,
    maxX: x * tileSize / 2,
    maxZ: z * tileSize / 2,
  }));
}

/** Squared distance to the roots' rectangle, not its oversized enclosing circle. */
export function grassBatchInRange(
  x: number, z: number, radius: number,
  minX: number, minZ: number, maxX: number, maxZ: number,
) {
  const dx = Math.max(minX - x, 0, x - maxX);
  const dz = Math.max(minZ - z, 0, z - maxZ);
  return dx * dx + dz * dz <= radius * radius;
}
