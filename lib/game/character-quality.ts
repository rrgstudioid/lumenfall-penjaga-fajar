import type { PlainsQuality } from './verdant-plains-quality.ts';
export type CharacterLOD = 0 | 1 | 2 | 3;
export const CHARACTER_QUALITY = {
  office: { minimumLOD: 1, textureSize: 1024, triangles: 250000, shadows: 0 },
  light: { minimumLOD: 0, textureSize: 2048, triangles: 450000, shadows: 2 },
  balanced: { minimumLOD: 0, textureSize: 2048, triangles: 700000, shadows: 4 },
  high: { minimumLOD: 0, textureSize: 2048, triangles: 1000000, shadows: 6 },
} as const;
export function characterLOD(
  pixels: number,
  quality: PlainsQuality,
  previous: CharacterLOD = 3,
): CharacterLOD {
  const limits = [400, 180, 60];
  let lod = (
    pixels >= 400 ? 0 : pixels >= 180 ? 1 : pixels >= 60 ? 2 : 3
  ) as CharacterLOD;
  if (lod < previous && pixels < limits[lod] * 1.15) lod = previous;
  if (lod > previous && pixels > limits[previous] * 0.85) lod = previous;
  return Math.max(CHARACTER_QUALITY[quality].minimumLOD, lod) as CharacterLOD;
}
export function characterPoseInterval(distance: number, self = false) {
  return self ? 0 : distance < 15 ? 1 / 30 : distance < 40 ? 1 / 15 : 1 / 5;
}

/** Geometry allocation for future remote humanoids; does not create network players. */
export function planCharacterCrowd(
  entries: ReadonlyArray<{
    id: number;
    pixels: number;
    distance: number;
    visible: boolean;
    self?: boolean;
    previous: CharacterLOD;
  }>,
  quality: PlainsQuality,
) {
  const costs = [10000, 5500, 2800, 1300]; // source body + most expensive optional hairstyle
  const ordered = [...entries]
    .filter((e) => e.visible || e.self)
    .sort(
      (a, b) => Number(!!b.self) - Number(!!a.self) || a.distance - b.distance,
    );
  const result = ordered.map((e) => ({
    ...e,
    lod: characterLOD(e.pixels, quality, e.previous),
    shadow: false,
    poseInterval: characterPoseInterval(e.distance, e.self),
  }));
  let triangles = result.reduce((n, e) => n + costs[e.lod], 0);
  // Reduce far actors first. The local player's silhouette has priority.
  for (
    let i = result.length - 1;
    i >= 0 && triangles > CHARACTER_QUALITY[quality].triangles;
    i--
  ) {
    const e = result[i];
    if (e.self) continue;
    while (e.lod < 3 && triangles > CHARACTER_QUALITY[quality].triangles) {
      triangles -= costs[e.lod] - costs[e.lod + 1];
      e.lod = (e.lod + 1) as CharacterLOD;
    }
  }
  result.slice(0, CHARACTER_QUALITY[quality].shadows).forEach((e) => {
    e.shadow = e.distance < 30;
  });
  return {
    actors: result,
    triangles,
    overBudget: triangles > CHARACTER_QUALITY[quality].triangles,
  };
}
