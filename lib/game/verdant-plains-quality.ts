// Uniform full-detail coverage: twice the previous near density across 108².
// 16,000 / 48² * 2 * 108² = 162,000 Balanced tufts. No distance LOD.
export const PLAINS_GRASS_SPAN = 108;
export const PLAINS_QUALITY = {
  light: { grass: 81000, dpr: 1, shadow: 0 },
  balanced: { grass: 162000, dpr: 1.25, shadow: 1024 },
  high: { grass: 324000, dpr: 1.5, shadow: 2048 },
} as const;
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
