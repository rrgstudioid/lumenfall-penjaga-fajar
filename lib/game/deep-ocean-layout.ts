import {
  SUNKEN_ID,
  SUNKEN_BOUNDS,
  type SunkenPoint,
} from './sunken-ruins-layout.ts';
import {
  DEEP_OCEAN_ENTRY,
  ABYSAL_TRENCH_ID,
  ABYSAL_TRENCH_GATE,
} from './underwater-regions.ts';
export { DEEP_OCEAN_ENTRY } from './underwater-regions.ts';
export const DEEP_OCEAN_PORTALS = [
  {
    ...ABYSAL_TRENCH_GATE,
    id: 'abysal-trench-f1',
    name: 'Abysal Trench · F1',
    destination: ABYSAL_TRENCH_ID,
    yaw: 0,
  },
  {
    x: 0,
    z: 350,
    id: 'return-sunken',
    name: 'Kembali ke Sunken Ruins · G7',
    destination: SUNKEN_ID,
    yaw: 0,
  },
];
export const DEEP_OCEAN_ZONES = [
  { x: 0, z: 300, id: 1, name: 'Descent Landing' },
  { x: -170, z: 0, id: 2, name: 'Abyssal Sand Basin' },
  { x: 160, z: -220, id: 3, name: 'Silent Trench' },
];
const smooth = (value: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};
export function deepOceanGroundHeight(x: number, z: number) {
  // Arrive at abyssal depth, descend just 14 units, then reach a broad plain.
  const landingDescent = 14 * smooth(350 - z, 0, 170);
  // The trench begins beyond the playable
  // north edge; its broad E/F lip and steep walls remain visible from F1.
  const trenchWidth = Math.exp(-(((x - 125) / 160) ** 4));
  const trench = 900 * trenchWidth * smooth(-z, 500, 720);
  const offshore = 120 * smooth(Math.max(Math.abs(x), Math.abs(z)), 500, 800);
  return (
    -766 -
    landingDescent +
    0.25 * Math.sin(x * 0.012) * Math.cos(z * 0.003) -
    trench -
    offshore
  );
}
export const deepOceanSafe = (p: SunkenPoint, margin = 0) =>
  Math.hypot(p.x, p.z - DEEP_OCEAN_ENTRY.z) < 60 + margin ||
  DEEP_OCEAN_PORTALS.some(
    (g) => Math.hypot(p.x - g.x, p.z - g.z) < 35 + margin,
  );
// Sand only. The functional return gate is energy, with no masonry or collision.
export const DEEP_OCEAN_REEFS: import('./sunken-ruins-layout.ts').SunkenReefPlacement[] =
  [];
export const DEEP_OCEAN_COLLIDERS: { x: number; z: number; radius: number }[] =
  [];
export function deepOceanWalkable(p: SunkenPoint, radius = 0.45) {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    p.x >= SUNKEN_BOUNDS.minX + radius &&
    p.x <= SUNKEN_BOUNDS.maxX - radius &&
    p.z >= SUNKEN_BOUNDS.minZ + radius &&
    p.z <= SUNKEN_BOUNDS.maxZ - radius &&
    DEEP_OCEAN_COLLIDERS.every(
      (o) => Math.hypot(p.x - o.x, p.z - o.z) >= o.radius + radius,
    )
  );
}
