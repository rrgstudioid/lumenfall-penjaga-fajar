import { MINE_RAILS, type MinePoint } from './ironveil-interior-layout.ts';
export type RailSection = MinePoint & {
  nx: number;
  nz: number;
  distance: number;
};
/** Keep every original corner, subdivide long spans, and use a SHARED miter at joins. */
export function railSections(points: MinePoint[]): RailSection[] {
  const dense: MinePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2);
    for (let j = 1; j <= n; j++)
      dense.push({
        x: a.x + ((b.x - a.x) * j) / n,
        z: a.z + ((b.z - a.z) * j) / n,
      });
  }
  let distance = 0;
  return dense.map((p, i) => {
    const a = dense[Math.max(0, i - 1)],
      b = dense[Math.min(dense.length - 1, i + 1)];
    const before = i
      ? Math.hypot(p.x - a.x, p.z - a.z)
      : Math.hypot(b.x - p.x, b.z - p.z);
    const after =
      i < dense.length - 1 ? Math.hypot(b.x - p.x, b.z - p.z) : before;
    const ax = i ? (p.x - a.x) / before : (b.x - p.x) / after,
      az = i ? (p.z - a.z) / before : (b.z - p.z) / after;
    const bx = i < dense.length - 1 ? (b.x - p.x) / after : ax,
      bz = i < dense.length - 1 ? (b.z - p.z) / after : az;
    const divisor = Math.max(0.5, 1 + ax * bx + az * bz);
    if (i) distance += before;
    return {
      ...p,
      nx: -(az + bz) / divisor,
      nz: (ax + bx) / divisor,
      distance,
    };
  });
}
export const MINE_RAIL_SECTIONS = MINE_RAILS.map(railSections);
/** Uniform arc-length spacing never restarts at a bend. */
export function railSleepers(sections: RailSection[], spacing = 2.6) {
  const result: RailSection[] = [];
  let next = 0;
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1],
      b = sections[i];
    while (next <= b.distance) {
      const t = (next - a.distance) / (b.distance - a.distance);
      result.push({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        nx: a.nx + (b.nx - a.nx) * t,
        nz: a.nz + (b.nz - a.nz) * t,
        distance: next,
      });
      next += spacing;
    }
  }
  return result;
}
