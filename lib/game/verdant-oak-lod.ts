const THRESHOLDS = [500, 200, 70];
/** Screen-height hysteresis; quality limits geometry, never placement count. */
export function oakLod(pixels: number, previous: number, light: boolean) {
  let lod = previous;
  while (lod > 0 && pixels > THRESHOLDS[lod - 1] * 1.15) lod--;
  while (lod < 3 && pixels < THRESHOLDS[lod] * 0.85) lod++;
  return Math.max(light ? 1 : 0, lod);
}
