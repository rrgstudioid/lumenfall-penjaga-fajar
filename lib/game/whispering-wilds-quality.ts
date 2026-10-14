export const WILDS_GRASS_RENDER = {
  outerStart: 200,
  outer: 250,
  cacheCells: 320,
} as const;
export const WILDS_QUALITY = {
  office: {
    label: 'Low',
    fireflies: 700,
    grassRange: WILDS_GRASS_RENDER.outer,
    mist: 24,
    dpr: 1,
    shadow: 0,
    treeRange: 170,
  },
  light: {
    label: 'Medium',
    fireflies: 950,
    grassRange: WILDS_GRASS_RENDER.outer,
    mist: 40,
    dpr: 1,
    shadow: 0,
    treeRange: 230,
  },
  balanced: {
    label: 'High',
    fireflies: 1200,
    grassRange: WILDS_GRASS_RENDER.outer,
    mist: 64,
    dpr: 1.25,
    shadow: 1024,
    treeRange: 320,
  },
  high: {
    label: 'Ultra',
    fireflies: 1600,
    grassRange: WILDS_GRASS_RENDER.outer,
    mist: 96,
    dpr: 1.5,
    shadow: 2048,
    treeRange: 420,
  },
} as const;
export type WildsQuality = keyof typeof WILDS_QUALITY;
export const WILDS_QUALITY_KEY = 'lumenfall:whispering-quality:v1';
export function loadWildsQuality(): WildsQuality {
  try {
    const value = localStorage.getItem(WILDS_QUALITY_KEY);
    if (value && Object.hasOwn(WILDS_QUALITY, value))
      return value as WildsQuality;
  } catch {
    /* Optional device preference. */
  }
  return 'office';
}
