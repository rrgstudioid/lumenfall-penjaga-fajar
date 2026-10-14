import type { GraphicsQuality } from './graphics-quality.ts';
export const SUNKEN_QUALITY = {
  office: {
    range: 130,
    coral: 0.25,
    plants: 0.35,
    fish: 24,
    particles: 90,
    shafts: 4,
  },
  light: {
    range: 180,
    coral: 0.35,
    plants: 0.6,
    fish: 40,
    particles: 140,
    shafts: 6,
  },
  balanced: {
    range: 250,
    coral: 0.45,
    plants: 0.85,
    fish: 64,
    particles: 220,
    shafts: 8,
  },
  high: {
    range: 330,
    coral: 0.55,
    plants: 1,
    fish: 96,
    particles: 320,
    shafts: 10,
  },
} satisfies Record<
  GraphicsQuality,
  {
    range: number;
    coral: number;
    plants: number;
    fish: number;
    particles: number;
    shafts: number;
  }
>;
export const SUNKEN_LIGHT = {
  background: '#3baecb',
  fogNear: 22,
  fogFar: 240,
  sky: '#b9f0ff',
  ground: '#207c92',
  sun: '#dbf9ff',
  exposure: 1.14,
  ambientIntensity: 2.5,
  sunIntensity: 3.2,
};
export const DEEP_OCEAN_LIGHT = {
  ...SUNKEN_LIGHT,
  background: '#103f5c',
  fogNear: 18,
  fogFar: 200,
  sky: '#70b0cd',
  ground: '#163b68',
  sun: '#b4dff3',
  ambientIntensity: 1.7,
  sunIntensity: 1.45,
  exposure: 1.04,
};
export const SUNKEN_ABYSS_FOG = '#0c3855';
export const DEEP_OCEAN_TRENCH_VIEW = { background: '#031522', fogFar: 650 };
export const ABYSAL_TRENCH_LIGHT = {
  ...DEEP_OCEAN_LIGHT,
  background: '#020a12',
  sky: '#42677e',
  ground: '#081522',
  sun: '#83a8be',
  fogFar: 220,
  ambientIntensity: 0.95,
  sunIntensity: 0.65,
  exposure: 0.9,
};
