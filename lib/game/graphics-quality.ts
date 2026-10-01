import {
  DEFAULT_PLAINS_QUALITY,
  PLAINS_QUALITY,
  PLAINS_QUALITY_KEY,
  type PlainsQuality,
} from './verdant-plains-quality.ts';
import { WILDS_QUALITY_KEY } from './whispering-wilds-quality.ts';
export const GRAPHICS_QUALITY_KEY = 'lumenfall:graphics-quality:v1';
export type GraphicsQuality = PlainsQuality;
export function loadGraphicsQuality(): GraphicsQuality {
  try {
    for (const key of [
      GRAPHICS_QUALITY_KEY,
      PLAINS_QUALITY_KEY,
      WILDS_QUALITY_KEY,
    ]) {
      const value = localStorage.getItem(key);
      if (value && Object.hasOwn(PLAINS_QUALITY, value))
        return value as GraphicsQuality;
    }
  } catch {
    /* Device preferences remain optional. */
  }
  return DEFAULT_PLAINS_QUALITY;
}
export function saveGraphicsQuality(quality: GraphicsQuality) {
  try {
    // Keep older map loaders and character previews aligned with the global choice.
    for (const key of [
      GRAPHICS_QUALITY_KEY,
      PLAINS_QUALITY_KEY,
      WILDS_QUALITY_KEY,
    ])
      localStorage.setItem(key, quality);
  } catch {
    /* Applying a preset must work even when storage is blocked. */
  }
}
