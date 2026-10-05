import * as T from 'three';
import { createPlainsSky } from './verdant-plains-sky';

/** Hot, clear midday; the visible disc and shadow light share this direction. */
export const IRONVEIL_DAYLIGHT = {
  sun: [-0.22, 0.94, -0.26] as const,
  sunColor: '#fff8e6',
  sunIntensity: 4.8,
  ambientSky: '#e5f2ff',
  ambientGround: '#c7a56b',
  ambientIntensity: 1.9,
  horizon: '#badcf5',
  zenith: '#60a7e5',
  exposure: 1.3,
};
export const IRONVEIL_CLOUD_ATLAS =
  '/assets/maps/verdant-plains-v2/sky-clouds.webp';

export function createIronveilSky(atlas: T.Texture) {
  const sky = createPlainsSky(atlas);
  sky.mesh.name = 'Ironveil UDS hot midday sky';
  const uniforms = sky.mesh.material.uniforms;
  uniforms.uClearMidday.value = 1;
  uniforms.uSun.value.set(...IRONVEIL_DAYLIGHT.sun).normalize();
  uniforms.uHorizon.value.set(IRONVEIL_DAYLIGHT.horizon);
  uniforms.uZenith.value.set(IRONVEIL_DAYLIGHT.zenith);
  return sky;
}
