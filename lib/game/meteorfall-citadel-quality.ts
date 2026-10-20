import type { GraphicsQuality } from "./graphics-quality.ts";
export const METEORFALL_QUALITY: Record<
  GraphicsQuality,
  { embers: number; smoke: number; cloudLayers: number; detailDistance: number }
> = {
  office: { embers: 256, smoke: 8, cloudLayers: 2, detailDistance: 140 },
  light: { embers: 512, smoke: 12, cloudLayers: 2, detailDistance: 200 },
  balanced: { embers: 768, smoke: 20, cloudLayers: 3, detailDistance: 300 },
  high: { embers: 1024, smoke: 28, cloudLayers: 3, detailDistance: 400 },
};
export const METEORFALL_LIGHT = {
  background: "#3a0b16",
  fogNear: 300,
  fogFar: 2400,
  exposure: 1.05,
  ambientSky: "#b6b4bc",
  ambientGround: "#543632",
  ambientIntensity: 1.6,
  sunColor: "#ffe4ca",
  sunIntensity: 2,
};
