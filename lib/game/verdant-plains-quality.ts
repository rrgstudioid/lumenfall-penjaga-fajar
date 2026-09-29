// One density profile across the entire field. No near/mid/far grass tiers.
export const PLAINS_GRASS_FIELD = {
  span: 1000,
  tileSize: 62.5,
  outerStart: 200,
  outer: 250,
} as const;
export const PLAINS_QUALITY = {
  light: { grassDensity: 45000 / (80 * 80), dpr: 1, shadow: 0 },
  balanced: { grassDensity: 90000 / (80 * 80), dpr: 1.25, shadow: 1024 },
  high: { grassDensity: 180000 / (80 * 80), dpr: 1.5, shadow: 2048 },
} as const;
export function plainsGrassTileCount(quality: PlainsQuality) {
  return Math.ceil(
    PLAINS_QUALITY[quality].grassDensity * PLAINS_GRASS_FIELD.tileSize ** 2,
  );
}
export type PlainsQuality = keyof typeof PLAINS_QUALITY;
export const PLAINS_QUALITY_KEY = 'lumenfall:verdant-quality:v1';
export function loadPlainsQuality(): PlainsQuality {
  try {
    const v = localStorage.getItem(PLAINS_QUALITY_KEY);
    if (v && Object.hasOwn(PLAINS_QUALITY, v)) return v as PlainsQuality;
  } catch {
    /* Device preferences are optional, including SSR. */
  }
  return 'balanced';
}
