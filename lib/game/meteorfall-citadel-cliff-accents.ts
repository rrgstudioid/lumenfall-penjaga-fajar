import {
  METEORFALL_DECKS,
  type MeteorPlatform,
} from './meteorfall-citadel-layout.ts';

/** Normalized rock geometry has a unit bounding box. Keep its entire top below every
 * overlapping landing, including the low end of inclined decks and rotated corners. */
export function meteorCliffAccents(p: MeteorPlatform, type: number) {
  return p.polygon.flatMap((a, i) => {
    const b = p.polygon[(i + 1) % p.polygon.length];
    return Array.from({ length: 3 }, (_, j) => {
      const t = (j + 0.5) / 3;
      const x = p.x + (a.x + (b.x - a.x) * t - p.x) * (type ? 1.015 : 0.9),
        z = p.z + (a.z + (b.z - a.z) * t - p.z) * (type ? 1.015 : 0.9),
        sx = 18 + (i % 3) * 4,
        sy = type ? 18 : 44,
        sz = 16;
      // Include one terrain cell diagonal: interpolation can sample just outside the bound.
      const radius = Math.hypot(sx, sz) / 2 + 6;
      let ceiling = p.y;
      for (const deck of METEORFALL_DECKS) {
        const dx = x - deck.a.x,
          dz = z - deck.a.z;
        const along = dx * deck.axis.x + dz * deck.axis.z;
        const side = Math.abs(dx * deck.axis.z - dz * deck.axis.x);
        if (
          side > deck.deckWidth / 2 + radius + 8 ||
          along < -radius ||
          along > deck.length + radius
        )
          continue;
        const lo = Math.max(0, (along - radius) / deck.length),
          hi = Math.min(1, (along + radius) / deck.length);
        ceiling = Math.min(
          ceiling,
          deck.yA + (deck.yB - deck.yA) * lo,
          deck.yA + (deck.yB - deck.yA) * hi,
        );
      }
      return {
        x,
        z,
        sx,
        sy,
        sz,
        yaw: i * 1.7 + j,
        y: Math.min(p.y - (type ? 7 : 47) - (i % 3) * 3, ceiling - sy / 2 - 2),
      };
    });
  });
}
