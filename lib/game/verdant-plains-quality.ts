// One density profile across the entire field. No near/mid/far grass tiers.
export const PLAINS_GRASS_FIELD = {
  span: 1000,
  tileSize: 62.5,
  outerStart: 200,
  outer: 250,
} as const;
export const PLAINS_QUALITY = {
  office: { grassDensity: 22500 / (80 * 80), dpr: 1, shadow: 0 },
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
// Stable storage IDs preserve existing per-device choices when UI names change.
export const PLAINS_QUALITY_LABELS: Record<PlainsQuality, string> = {
  office: 'Low', light: 'Normal', balanced: 'High', high: 'Ultra',
};
// New devices start conservatively; existing explicit preferences remain intact.
export const DEFAULT_PLAINS_QUALITY: PlainsQuality = 'office';
export function plainsGrassRange(quality: PlainsQuality) {
  return quality === 'office' ? { outerStart: 55, outer: 100 } : PLAINS_GRASS_FIELD;
}
/** Keep the HUD at native resolution; only the 3D drawing buffer is limited. */
export function plainsPixelRatio(quality: PlainsQuality, width: number, height: number, deviceDpr: number) {
  const cap = Math.min(Math.max(0.5, deviceDpr || 1), PLAINS_QUALITY[quality].dpr);
  return quality === 'office'
    ? Math.min(cap, Math.sqrt((1280 * 720) / Math.max(1, width * height)))
    : cap;
}
export const PLAINS_QUALITY_KEY = 'lumenfall:verdant-quality:v1';
export function loadPlainsQuality(): PlainsQuality {
  try {
    const v = localStorage.getItem(PLAINS_QUALITY_KEY);
    if (v && Object.hasOwn(PLAINS_QUALITY, v)) return v as PlainsQuality;
  } catch {
    /* Device preferences are optional, including SSR. */
  }
  return DEFAULT_PLAINS_QUALITY;
}
