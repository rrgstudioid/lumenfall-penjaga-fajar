/** Ironveil exterior. Design pixels map 1:1 to world units; north is -Z. */
export type IronveilPoint = { x: number; z: number };
export const IRONVEIL_ID = 'ironveil-mines-exterior-v1';
export const IRONVEIL_SIZE = 1000;
export const IRONVEIL_STEP = 1000 / 256;
export const IRONVEIL_RESOLUTION = { columns: 257, rows: 129 };
export const ironveilPoint = (u: number, v: number): IronveilPoint => ({
  x: u - 500,
  z: v - 500,
});
export const IRONVEIL_BOUNDS = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
export const IRONVEIL_ENTRY = ironveilPoint(500, 940);
export const IRONVEIL_ENTRANCE = ironveilPoint(720, 450);
export const IRONVEIL_TRANSITION = {
  available: true,
  label: 'To Inside Mines',
  destination: 'ironveil-mines-interior-v1',
  anchor: ironveilPoint(720, 448),
  returnAnchor: ironveilPoint(720, 465),
  interiorArrival: { x: 0, z: 436 },
  interiorReturnDoor: { x: 0, z: 450 },
  reach: 4.5,
  volume: { minX: 212, maxX: 228, minZ: -54, maxZ: -48, floor: 12, height: 12 },
} as const;
const points = (a: number[][]) => a.map(([u, v]) => ironveilPoint(u, v));
/** Outline of the UNION, so the staging and vestibule joins have no internal walls. */
export const IRONVEIL_BOUNDARY = points([
  [20, 500],
  [680, 500],
  [680, 450],
  [712, 450],
  [712, 438],
  [728, 438],
  [728, 450],
  [760, 450],
  [760, 500],
  [980, 500],
  [980, 980],
  [20, 980],
]);
export const IRONVEIL_PATHS = [
  {
    width: 14,
    points: points([
      [500, 940],
      [480, 840],
      [540, 740],
      [640, 630],
      [720, 540],
      [720, 475],
      [720, 450],
    ]),
  },
  {
    width: 8,
    points: points([
      [480, 840],
      [410, 860],
      [300, 870],
    ]),
  },
  {
    width: 8,
    points: points([
      [540, 740],
      [400, 720],
      [310, 680],
      [200, 640],
    ]),
  },
];
export const IRONVEIL_POCKETS = [
  { name: 'South Clearing', minU: 180, maxU: 420, minV: 800, maxV: 930 },
  { name: 'Central Field', minU: 300, maxU: 610, minV: 650, maxV: 790 },
  { name: 'Rockside Pocket', minU: 100, maxU: 280, minV: 550, maxV: 710 },
  { name: 'Mineward Clearing', minU: 760, maxU: 930, minV: 530, maxV: 680 },
];
export function ironveilSegmentDistance(
  p: IronveilPoint,
  a: IronveilPoint,
  b: IronveilPoint,
) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function ironveilDomain(p: IronveilPoint, radius = 0.45) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    !Number.isFinite(radius) ||
    radius < 0
  )
    return false;
  let inside = false;
  for (
    let i = 0, j = IRONVEIL_BOUNDARY.length - 1;
    i < IRONVEIL_BOUNDARY.length;
    j = i++
  ) {
    const a = IRONVEIL_BOUNDARY[i],
      b = IRONVEIL_BOUNDARY[j];
    if (ironveilSegmentDistance(p, a, b) < radius) return false;
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function ironveilPathDistance(p: IronveilPoint) {
  let d = Infinity;
  for (const path of IRONVEIL_PATHS)
    for (let i = 1; i < path.points.length; i++)
      d = Math.min(
        d,
        ironveilSegmentDistance(p, path.points[i - 1], path.points[i]),
      );
  return d;
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function rawHeight(x: number, z: number) {
  const north = 1 - smooth(0, 450, z);
  const roll =
    0.75 *
    Math.sin(x * 0.025) *
    Math.sin(z * 0.019) *
    smooth(0, 65, z) *
    (1 - smooth(370, 465, z));
  return 2 + 10 * north + roll;
}
let heightfield: Float32Array | undefined;
export function ironveilHeightfield() {
  if (!heightfield) {
    heightfield = new Float32Array(257 * 129);
    for (let j = 0; j < 129; j++)
      for (let i = 0; i < 257; i++)
        heightfield[j * 257 + i] = rawHeight(
          i * IRONVEIL_STEP - 500,
          j * IRONVEIL_STEP,
        );
  }
  return heightfield;
}
/** Same diagonal as renderer triangles: a,c,b / b,c,d. Vestibule is a separate floor. */
export function ironveilGroundHeight(x: number, z: number) {
  if (z <= 0) return 12;
  const u = Math.max(0, Math.min(255.999999, (x + 500) / IRONVEIL_STEP)),
    v = Math.max(0, Math.min(127.999999, z / IRONVEIL_STEP));
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * 257 + i,
    h = ironveilHeightfield();
  return a + b <= 1
    ? h[k] + a * (h[k + 1] - h[k]) + b * (h[k + 257] - h[k])
    : h[k + 258] +
        (1 - a) * (h[k + 257] - h[k + 258]) +
        (1 - b) * (h[k + 1] - h[k + 258]);
}
export type IronveilProp = IronveilPoint & {
  kind: 'rock' | 'cypress';
  height: number;
  radius: number;
  yaw: number;
  variant: number;
};
export const IRONVEIL_BOXES = [
  { name: 'shelter post', x: 185, z: -36, hx: 0.45, hz: 0.45 },
  { name: 'shelter post', x: 195, z: -36, hx: 0.45, hz: 0.45 },
  { name: 'shelter post', x: 185, z: -44, hx: 0.45, hz: 0.45 },
  { name: 'shelter post', x: 195, z: -44, hx: 0.45, hz: 0.45 },
  ...[
    [-17, -28],
    [-21, -28],
    [-26, -22],
    [20, -36],
  ].map(([x, z]) => ({ name: 'crate', x: 220 + x, z, hx: 1.35, hz: 1.35 })),
  { name: 'barrel', x: 246, z: -28, hx: 0.9, hz: 0.9 },
  { name: 'barrel', x: 246, z: -31, hx: 0.9, hz: 0.9 },
  { name: 'cart', x: 234, z: -20, hx: 2.2, hz: 3 },
];
let placements: IronveilProp[] | undefined;
export function ironveilProps() {
  if (placements) return placements;
  let seed = 90317;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: IronveilProp[] = [];
  // Stratified placement covers the full outdoor area rather than attaching
  // vegetation to perimeter rocks. Every sector gets one rock and a tree.
  const cells = Array.from({ length: 24 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const add = (kind: IronveilProp['kind'], index: number, cell: number) => {
    const height = kind === 'cypress' ? 32 + rand() * 14 : 3 + rand() * 6;
    const variant = kind === 'rock' ? index % 2 : 0;
    const radius =
      height * (kind === 'cypress' ? 0.09 : variant === 0 ? 0.835 : 1.181);
    const visualRadius = kind === 'cypress' ? height * 0.21 : radius;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const p = {
        x: -450 + (cell % 6) * 150 + 15 + rand() * 120,
        z: 20 + Math.floor(cell / 6) * 110 + 10 + rand() * 90,
      };
      if (
        !ironveilDomain(p, visualRadius + 2) ||
        Math.hypot(p.x - IRONVEIL_ENTRY.x, p.z - IRONVEIL_ENTRY.z) <
          26 + visualRadius ||
        ironveilPathDistance(p) < 15 + visualRadius ||
        IRONVEIL_POCKETS.some(
          (q) =>
            Math.hypot(
              p.x - (q.minU + q.maxU) / 2 + 500,
              p.z - (q.minV + q.maxV) / 2 + 500,
            ) <
            22 + radius,
        ) ||
        out.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 50)
      )
        continue;
      out.push({
        ...p,
        kind,
        height,
        radius,
        yaw: rand() * Math.PI * 2,
        variant,
      });
      return;
    }
    throw new Error(
      `Ironveil distributed placement capacity: ${kind} sector ${cell}`,
    );
  };
  cells.forEach((cell, i) => add('rock', i, cell));
  for (let i = 0; i < 42; i++) add('cypress', i, cells[i % 24]);
  placements = out;
  return out;
}
/** Bury the root tips and seat the trunk against the lowest nearby ground. */
export function ironveilCypressBaseHeight(
  p: IronveilPoint & { height: number },
) {
  let ground = ironveilGroundHeight(p.x, p.z);
  const rootRadius = p.height * 0.09;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ground = Math.min(
      ground,
      ironveilGroundHeight(
        p.x + Math.cos(angle) * rootRadius,
        p.z + Math.sin(angle) * rootRadius,
      ),
    );
  }
  return ground - p.height * 0.045;
}
export function ironveilWalkable(p: IronveilPoint, radius = 0.45) {
  return (
    ironveilDomain(p, radius) &&
    !IRONVEIL_BOXES.some(
      (b) =>
        Math.hypot(
          Math.max(0, Math.abs(p.x - b.x) - b.hx),
          Math.max(0, Math.abs(p.z - b.z) - b.hz),
        ) < radius,
    ) &&
    !ironveilProps().some(
      (o) =>
        o.radius > 0 && Math.hypot(p.x - o.x, p.z - o.z) < radius + o.radius,
    )
  );
}
export class IronveilNavigation {
  valid(p: IronveilPoint, radius = 0.45) {
    return ironveilWalkable(p, radius);
  }
  restore(p: IronveilPoint, radius = 0.45): IronveilPoint {
    if (this.valid(p, radius)) return { x: p.x, z: p.z };
    if (Number.isFinite(p.x) && Number.isFinite(p.z))
      for (let r = 0.5; r <= 10; r += 0.5)
        for (let i = 0; i < 32; i++) {
          const q = {
            x: p.x + Math.cos((i * Math.PI) / 16) * r,
            z: p.z + Math.sin((i * Math.PI) / 16) * r,
          };
          if (this.valid(q, radius)) return q;
        }
    return { ...IRONVEIL_ENTRY };
  }
  move(from: IronveilPoint, dx: number, dz: number, radius = 0.45) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { ...from };
    const p = this.valid(from, radius)
      ? { x: from.x, z: from.z }
      : this.restore(from, radius);
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (let i = 0; i < n; i++) {
      const x = p.x + dx / n,
        z = p.z + dz / n;
      if (this.valid({ x, z }, radius)) {
        p.x = x;
        p.z = z;
      } else if (this.valid({ x, z: p.z }, radius)) p.x = x;
      else if (this.valid({ x: p.x, z }, radius)) p.z = z;
    }
    return p;
  }
}
