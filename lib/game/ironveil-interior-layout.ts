/** Shared, deterministic interior topology. No Three.js or browser dependencies. */
export const MINE_ID = 'ironveil-mines-interior-v1';
export type MinePoint = { x: number; z: number };
export const minePoint = (u: number, v: number): MinePoint => ({
  x: u - 500,
  z: v - 500,
});
export const MINE_ENTRY = minePoint(500, 936);
export const MINE_EXIT = minePoint(500, 950);
export const MINE_GRID = 4;
export const MINE_CELLS = 250;
export const MINE_SAFE_RADIUS = 28;
export const MINE_ROOMS = [
  ['A', 'Receiving Chamber', 500, 840, 120, 90, 34],
  ['W1', 'West Excavation', 230, 790, 180, 130, 46],
  ['W2', 'Old Quarry Hall', 150, 500, 180, 150, 48],
  ['W3', 'Broken Timber Chamber', 230, 240, 140, 110, 34],
  ['C1', 'Rail Junction Cavern', 480, 430, 180, 140, 48],
  ['N1', 'Deep Extraction Hall', 470, 170, 210, 150, 54],
  ['D', 'Deep Mineral Cavern', 800, 170, 240, 180, 60],
  ['E1', 'East Haulage Hall', 820, 480, 190, 160, 48],
  ['E2', 'Abandoned Camp', 800, 770, 150, 110, 34],
  ['N2', 'Ore Sorting Chamber', 680, 340, 120, 95, 34],
  ['S1', 'Collapsed Survey Pocket', 130, 105, 70, 60, 26],
  ['S2', 'West Supply Pocket', 110, 890, 80, 65, 26],
  ['S3', 'East Survey Pocket', 915, 900, 80, 65, 26],
  ['S4', 'Mineral Seam Pocket', 680, 70, 80, 60, 26],
].map(([id, name, u, v, w, d, h]) => ({
  id: id as string,
  name: name as string,
  ...minePoint(u as number, v as number),
  width: w as number,
  depth: d as number,
  ceiling: h as number,
}));
const junction = {
  id: 'J0',
  name: 'Lower Junction',
  ...minePoint(500, 680),
  width: 70,
  depth: 60,
  ceiling: 32,
};
export const MINE_AREAS = [...MINE_ROOMS, junction];
const pts = (a: number[][]) => a.map(([u, v]) => minePoint(u, v));
export const MINE_ROUTES = [
  {
    id: 'main',
    width: 32,
    rail: true,
    points: pts([
      [500, 950],
      [500, 840],
      [500, 680],
      [490, 550],
      [480, 430],
      [470, 300],
      [470, 170],
      [600, 120],
      [700, 135],
      [800, 170],
    ]),
  },
  {
    id: 'west',
    width: 24,
    rail: false,
    points: pts([
      [500, 840],
      [370, 855],
      [230, 790],
      [130, 640],
      [150, 500],
      [300, 510],
      [390, 470],
      [480, 430],
    ]),
  },
  {
    id: 'east',
    width: 24,
    rail: false,
    points: pts([
      [500, 840],
      [650, 855],
      [800, 770],
      [850, 640],
      [820, 480],
      [670, 465],
      [480, 430],
    ]),
  },
  {
    id: 'northwest',
    width: 24,
    rail: false,
    points: pts([
      [480, 430],
      [330, 370],
      [300, 290],
      [230, 240],
      [350, 195],
      [470, 170],
    ]),
  },
  {
    id: 'deep',
    width: 24,
    rail: false,
    points: pts([
      [480, 430],
      [570, 380],
      [680, 340],
      [730, 260],
      [800, 170],
    ]),
  },
  {
    id: 'east-deep',
    width: 24,
    rail: false,
    points: pts([
      [800, 170],
      [845, 315],
      [820, 480],
    ]),
  },
  {
    id: 'shortcut-west',
    width: 18,
    rail: false,
    points: pts([
      [500, 680],
      [350, 630],
      [270, 565],
      [150, 500],
    ]),
  },
  {
    id: 'shortcut-east',
    width: 18,
    rail: false,
    points: pts([
      [500, 680],
      [635, 665],
      [650, 650],
      [665, 635],
      [730, 570],
      [820, 480],
    ]),
  },
  {
    id: 'S1',
    width: 18,
    rail: false,
    points: pts([
      [230, 240],
      [175, 180],
      [130, 105],
    ]),
  },
  {
    id: 'S2',
    width: 18,
    rail: false,
    points: pts([
      [230, 790],
      [160, 850],
      [110, 890],
    ]),
  },
  {
    id: 'S3',
    width: 18,
    rail: false,
    points: pts([
      [800, 770],
      [880, 840],
      [915, 900],
    ]),
  },
  {
    id: 'S4',
    width: 18,
    rail: false,
    points: pts([
      [800, 170],
      [735, 100],
      [680, 70],
    ]),
  },
];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Round corners inside each capsule union, so smoothing cannot cut a new connection. */
function rounded(points: MinePoint[]) {
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const len1 = Math.hypot(b.x - a.x, b.z - a.z),
      len2 = Math.hypot(c.x - b.x, c.z - b.z);
    const d = Math.min(8, len1 * 0.12, len2 * 0.12);
    const p = {
      x: b.x + ((a.x - b.x) * d) / len1,
      z: b.z + ((a.z - b.z) * d) / len1,
    };
    const q = {
      x: b.x + ((c.x - b.x) * d) / len2,
      z: b.z + ((c.z - b.z) * d) / len2,
    };
    for (let j = 0; j <= 4; j++) {
      const t = j / 4,
        s = 1 - t;
      result.push({
        x: s * s * p.x + 2 * s * t * b.x + t * t * q.x,
        z: s * s * p.z + 2 * s * t * b.z + t * t * q.z,
      });
    }
  }
  result.push(points.at(-1)!);
  return result;
}
export const MINE_CURVES = MINE_ROUTES.map((r) => ({
  ...r,
  points: rounded(r.points),
}));
// Turnouts start tangent to the main rail, then curve through the open chambers.
function railTurnout(start: MinePoint, control: MinePoint, end: MinePoint) {
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24,
      s = 1 - t;
    return {
      x: s * s * start.x + 2 * s * t * control.x + t * t * end.x,
      z: s * s * start.z + 2 * s * t * control.z + t * t * end.z,
    };
  });
}
const westRail = MINE_CURVES[1].points.filter((p) => p.x >= -270 && p.z >= 280);
const eastRail = MINE_CURVES[2].points
  .slice()
  .reverse()
  .filter((p) => p.z < 30);
export const MINE_RAILS = [
  MINE_CURVES[0].points,
  [
    ...railTurnout({ x: 0, z: 362 }, { x: 0, z: 344 }, { x: -48, z: 346 }),
    ...westRail.filter((p) => p.x < -48),
  ],
  [
    ...railTurnout({ x: -22, z: -96 }, { x: -20, z: -70 }, { x: 32, z: -59 }),
    ...eastRail.filter((p) => p.x > 32),
  ],
];
export function segmentDistance(p: MinePoint, a: MinePoint, b: MinePoint) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
const segments = MINE_CURVES.flatMap((r) =>
  r.points
    .slice(1)
    .map((b, i) => ({ a: r.points[i], b, radius: r.width / 2 + 1.8 })),
);
function rawDistance(x: number, z: number) {
  const p = { x, z };
  let best = -1000;
  for (const r of MINE_AREAS) {
    const dx = x - r.x,
      dz = z - r.z;
    const theta = Math.atan2(dz / r.depth, dx / r.width);
    const bulge =
      1.6 +
      1.2 * Math.sin(theta * 5 + r.x * 0.03) +
      0.7 * Math.sin(theta * 9 + r.z * 0.02);
    const s =
      ((1 - Math.hypot(dx / (r.width / 2), dz / (r.depth / 2))) *
        Math.min(r.width, r.depth)) /
        2 +
      bulge;
    best = Math.max(best, s);
  }
  for (const s of segments)
    best = Math.max(best, s.radius - segmentDistance(p, s.a, s.b));
  best +=
    0.55 * Math.sin(x * 0.075 + Math.sin(z * 0.04)) +
    0.35 * Math.sin(z * 0.11 + x * 0.021);
  // The single southern recess narrows to the 16-unit threshold.
  if (z > 414)
    best = Math.min(
      best,
      8 + 8 * (1 - smooth(414, 444, z)) - Math.abs(x),
      450 - z,
    );
  const bridge = bridgeLocal(p);
  if (Math.abs(bridge.along) < 14 && Math.abs(bridge.across) < 32)
    best = Math.min(best, 9 - Math.abs(bridge.across));
  return best;
}
function rawHeight(x: number, z: number) {
  const v = z + 500;
  const knots = [
    [0, -22],
    [170, -16],
    [430, -10],
    [680, -4],
    [840, -2],
    [950, 0],
    [1000, 0],
  ];
  let h = 0;
  for (let i = 1; i < knots.length; i++)
    if (v <= knots[i][0]) {
      const [a, y] = knots[i - 1],
        [b, w] = knots[i];
      h = y + (w - y) * smooth(a, b, v);
      break;
    }
  h -= 6 * smooth(640, 800, x + 500) * (1 - smooth(170, 500, v));
  return h + 0.08 * Math.sin(x * 0.025) * Math.sin(z * 0.032);
}
const stride = MINE_CELLS + 1;
let cached: { distance: Float32Array; height: Float32Array } | undefined;
export function mineGrid() {
  if (cached) return cached;
  const distance = new Float32Array(stride * stride),
    height = new Float32Array(stride * stride);
  for (let j = 0; j < stride; j++)
    for (let i = 0; i < stride; i++) {
      const k = j * stride + i,
        x = i * MINE_GRID - 500,
        z = j * MINE_GRID - 500;
      distance[k] = rawDistance(x, z);
      height[k] = rawHeight(x, z);
    }
  return (cached = { distance, height });
}
/** Same diagonal and linear interpolant used by the clipped render triangles. */
function sample(values: Float32Array, x: number, z: number) {
  if (!Number.isFinite(x + z) || Math.abs(x) > 500 || Math.abs(z) > 500)
    return -1000;
  const u = clamp((x + 500) / MINE_GRID, 0, MINE_CELLS - 1e-8),
    v = clamp((z + 500) / MINE_GRID, 0, MINE_CELLS - 1e-8);
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * stride + i;
  return a + b <= 1
    ? values[k] +
        (values[k + 1] - values[k]) * a +
        (values[k + stride] - values[k]) * b
    : values[k + stride + 1] +
        (values[k + stride] - values[k + stride + 1]) * (1 - a) +
        (values[k + 1] - values[k + stride + 1]) * (1 - b);
}
export const mineDistance = (x: number, z: number) =>
  sample(mineGrid().distance, x, z);
export const mineGroundHeight = (x: number, z: number) =>
  sample(mineGrid().height, x, z);
export function mineCeiling(x: number, z: number) {
  let clearance = 30;
  for (const r of MINE_AREAS) {
    const t = Math.hypot((x - r.x) / (r.width / 2), (z - r.z) / (r.depth / 2));
    clearance = Math.max(clearance, r.ceiling - 7 * clamp(t));
  }
  if (z > 416) clearance = 12 + 18 * (1 - smooth(416, 440, z));
  return (
    mineGroundHeight(x, z) +
    clearance +
    Math.min(8, Math.max(0, mineDistance(x, z)) * 0.32)
  );
}
export const MINE_LANDMARKS = MINE_ROOMS.map((r, index) => {
  const radius = ['D', 'S4', 'N1', 'W1', 'W2'].includes(r.id) ? 10 : 6;
  let best = { x: r.x + r.width * 0.3, z: r.z + r.depth * 0.3 },
    score = -Infinity;
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16 + index * 0.17,
      p = {
        x: r.x + Math.cos(a) * r.width * 0.34,
        z: r.z + Math.sin(a) * r.depth * 0.34,
      };
    const clearance = Math.min(
      ...segments.map((s) => segmentDistance(p, s.a, s.b) - s.radius),
    );
    if (clearance > score) {
      best = p;
      score = clearance;
    }
  }
  return { ...best, id: r.id, radius, kind: 'landmark' as const };
});
const MINE_SCATTER = MINE_ROOMS.flatMap((r, index) => {
  // Large props stay on the chamber perimeter and outside every route's clear width.
  const points: {
    x: number;
    z: number;
    radius: number;
    kind: 'crate' | 'rock' | 'barrel';
  }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + index * 0.53,
      p = {
        x: r.x + Math.cos(a) * r.width * 0.39,
        z: r.z + Math.sin(a) * r.depth * 0.39,
      };
    if (
      segments.some((s) => segmentDistance(p, s.a, s.b) < s.radius + 5) ||
      MINE_LANDMARKS.some(
        (l) => Math.hypot(p.x - l.x, p.z - l.z) < l.radius + 4,
      )
    )
      continue;
    points.push({
      ...p,
      radius: i % 3 === 0 ? 3.1 : 1.8,
      kind: i % 3 === 0 ? 'rock' : i % 3 === 1 ? 'crate' : 'barrel',
    });
  }
  return points;
});
export const MINE_BLOCKERS = [...MINE_SCATTER, ...MINE_LANDMARKS];
export const MINE_BRIDGE = {
  ...minePoint(650, 650),
  length: 28,
  width: 18,
  yaw: Math.PI / 4,
};
export function bridgeLocal(p: MinePoint) {
  const dx = p.x - MINE_BRIDGE.x,
    dz = p.z - MINE_BRIDGE.z;
  return { along: (dx - dz) / Math.SQRT2, across: (dx + dz) / Math.SQRT2 };
}
export function mineWalkable(p: MinePoint, radius = 0.45, props = true) {
  if (mineDistance(p.x, p.z) < radius + 0.07) return false;
  // At the fissure only the physical bridge deck is traversable.
  const b = bridgeLocal(p);
  if (
    Math.abs(b.along) < MINE_BRIDGE.length / 2 + radius &&
    Math.abs(b.across) > MINE_BRIDGE.width / 2 - radius &&
    Math.abs(b.across) < 26
  )
    return false;
  return (
    !props ||
    !MINE_BLOCKERS.some(
      (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius,
    )
  );
}
export class MineNavigation {
  valid(p: MinePoint, radius = 0.45) {
    return mineWalkable(p, radius);
  }
  restore(p: MinePoint, radius = 0.45): MinePoint {
    if (this.valid(p, radius)) return { x: p.x, z: p.z };
    if (
      Number.isFinite(p.x + p.z) &&
      Math.abs(p.x) <= 520 &&
      Math.abs(p.z) <= 520
    ) {
      for (let r = 1; r <= 48; r += 1.5)
        for (let a = 0; a < 32; a++) {
          const q = {
            x: p.x + Math.cos((a * Math.PI) / 16) * r,
            z: p.z + Math.sin((a * Math.PI) / 16) * r,
          };
          if (this.valid(q, radius)) return q;
        }
    }
    return { ...MINE_ENTRY };
  }
  move(p: MinePoint, dx: number, dz: number, radius = 0.45): MinePoint {
    let q = this.restore(p, radius);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (let i = 0; i < steps; i++) {
      const x = dx / steps,
        z = dz / steps,
        next = { x: q.x + x, z: q.z + z };
      if (this.valid(next, radius)) q = next;
      else if (this.valid({ x: q.x + x, z: q.z }, radius)) q.x += x;
      else if (this.valid({ x: q.x, z: q.z + z }, radius)) q.z += z;
    }
    return q;
  }
}
export type MineVertex = { x: number; y: number; z: number };
export type MineTriangle = [MineVertex, MineVertex, MineVertex];
export type MineShell = {
  floors: MineTriangle[];
  boundary: [MineVertex, MineVertex][];
  area: number;
};
let shellCache: MineShell | undefined;
export function mineShell(): MineShell {
  if (shellCache) return shellCache;
  const { distance, height } = mineGrid(),
    floors: MineTriangle[] = [],
    boundary: MineShell['boundary'] = [];
  let area = 0;
  for (let j = 0; j < MINE_CELLS; j++)
    for (let i = 0; i < MINE_CELLS; i++) {
      const k = j * stride + i;
      for (const indices of [
        [k, k + stride, k + 1],
        [k + 1, k + stride, k + stride + 1],
      ]) {
        const source = indices.map((n) => ({
          x: (n % stride) * MINE_GRID - 500,
          z: Math.floor(n / stride) * MINE_GRID - 500,
          y: height[n],
          d: distance[n],
        }));
        const clipped: typeof source = [];
        for (let a = 0; a < 3; a++) {
          const p = source[a],
            q = source[(a + 1) % 3];
          if (p.d >= 0) clipped.push(p);
          if (p.d >= 0 !== q.d >= 0) {
            const t = p.d / (p.d - q.d);
            clipped.push({
              x: p.x + (q.x - p.x) * t,
              y: p.y + (q.y - p.y) * t,
              z: p.z + (q.z - p.z) * t,
              d: 0,
            });
          }
        }
        if (clipped.length < 3) continue;
        for (let a = 1; a < clipped.length - 1; a++) {
          const tri = [clipped[0], clipped[a], clipped[a + 1]] as MineTriangle;
          const [p, q, r] = tri,
            ar =
              Math.abs((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)) /
              2;
          if (ar < 1e-7) continue;
          floors.push(tri);
          area += ar;
        }
        for (let a = 0; a < clipped.length; a++) {
          const p = clipped[a],
            q = clipped[(a + 1) % clipped.length];
          if (p.d === 0 && q.d === 0 && Math.hypot(p.x - q.x, p.z - q.z) > 1e-5)
            boundary.push([p, q]);
        }
      }
    }
  return (shellCache = { floors, boundary, area });
}
/** Shared with the shell exporter, so wall brackets touch the rendered strata. */
export function mineWallVertex(p: MineVertex, t: number): MineVertex {
  const gx = mineDistance(p.x + 1, p.z) - mineDistance(p.x - 1, p.z),
    gz = mineDistance(p.x, p.z + 1) - mineDistance(p.x, p.z - 1),
    len = Math.hypot(gx, gz) || 1;
  const bend =
    Math.sin(Math.PI * t) *
    (3.5 + 1.8 * Math.sin(p.x * 0.07 + p.z * 0.055 + t * 9));
  return {
    x: p.x - (gx / len) * bend,
    z: p.z - (gz / len) * bend,
    y: p.y + (mineCeiling(p.x, p.z) - p.y) * t,
  };
}
export function mineTimberFrames() {
  const result: Array<
    MinePoint & { width: number; height: number; yaw: number }
  > = [];
  for (const route of MINE_CURVES) {
    let next = 42;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = next; d < len; d += 78) {
        const p = {
          x: a.x + ((b.x - a.x) * d) / len,
          z: a.z + ((b.z - a.z) * d) / len,
        };
        if (
          MINE_ROOMS.some(
            (r) =>
              Math.hypot(
                (p.x - r.x) / (r.width / 2),
                (p.z - r.z) / (r.depth / 2),
              ) < 1,
          )
        )
          continue;
        result.push({
          ...p,
          width: route.width + 1.2,
          height: Math.min(
            25,
            mineCeiling(p.x, p.z) - mineGroundHeight(p.x, p.z) - 2,
          ),
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
        });
      }
      next = (next - len) % 78;
      if (next < 0) next += 78;
    }
  }
  return result;
}
export type MineLantern = MinePoint & {
  y: number;
  support: 'wall' | 'beam';
  mount: MineVertex;
};
let lanternCache: MineLantern[] | undefined;
export function mineLanterns() {
  if (lanternCache) return lanternCache;
  const result: MineLantern[] = [];
  const boundary = mineShell().boundary.filter(([a,b])=>{
    const bridge=bridgeLocal({x:(a.x+b.x)/2,z:(a.z+b.z)/2});
    return !(Math.abs(bridge.along)<16&&Math.abs(bridge.across)<12);
  });
  function wallLamp(seed: MinePoint) {
    let best = Infinity,
      edge = boundary[0],
      fraction = 0;
    for (const segment of boundary) {
      const [a, b] = segment,
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(
          ((seed.x - a.x) * dx + (seed.z - a.z) * dz) / (dx * dx + dz * dz),
        );
      const d = Math.hypot(seed.x - a.x - dx * t, seed.z - a.z - dz * t);
      if (d < best) {
        best = d;
        edge = segment;
        fraction = t;
      }
    }
    const [a, b] = edge,
      f = Math.max(.05,Math.min(.95,fraction));
    const p = {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      y: a.y + (b.y - a.y) * f,
    };
    const gx = mineDistance(p.x + 1, p.z) - mineDistance(p.x - 1, p.z),
      gz = mineDistance(p.x, p.z + 1) - mineDistance(p.x, p.z - 1),
      n = Math.hypot(gx, gz) || 1;
    const lamp = { x: p.x + (gx / n) * 1.3, z: p.z + (gz / n) * 1.3 };
    if (
      mineDistance(lamp.x, lamp.z) < 0.5 ||
      result.some((l) => Math.hypot(l.x - lamp.x, l.z - lamp.z) < 14)
    )
      return;
    // Interpolate the exact two triangles of the shell's seven wall strata.
    const t = Math.min(0.8, 8.7 / (mineCeiling(p.x, p.z) - p.y)),
      row = Math.floor(t * 7),
      v = t * 7 - row;
    const p0 = mineWallVertex(a, row / 7),
      p1 = mineWallVertex(b, row / 7),
      p2 = mineWallVertex(a, (row + 1) / 7),
      p3 = mineWallVertex(b, (row + 1) / 7);
    const vertices = f + v <= 1 ? [p0, p1, p2] : [p3, p1, p2],
      weights = f + v <= 1 ? [1 - f - v, f, v] : [f + v - 1, 1 - v, 1 - f];
    const mount = { x: 0, y: 0, z: 0 };
    for (let j = 0; j < 3; j++)
      for (const axis of ['x', 'y', 'z'] as const)
        mount[axis] += vertices[j][axis] * weights[j];
    result.push({ ...lamp, y: mount.y - 1.45, support: 'wall', mount });
  }
  // Hang from EXISTING lintels; no new freestanding poles are introduced.
  for (const f of mineTimberFrames()) {
    const p = {
      x: f.x + Math.cos(f.yaw) * f.width * 0.27,
      z: f.z - Math.sin(f.yaw) * f.width * 0.27,
    };
    const mount = { ...p, y: mineGroundHeight(f.x, f.z) + f.height - 0.6 };
    result.push({ ...p, y: mount.y - 2.5, support: 'beam', mount });
  }
  for (const [i, r] of MINE_ROOMS.entries())
    if (['W1', 'W2', 'N1'].includes(r.id)) {
      const p = MINE_LANDMARKS[i];
      for (const side of [-1, 1]) {
        const mount = {
          x: p.x + side * 1.4,
          z: p.z,
          y: mineGroundHeight(p.x, p.z) + 15.4,
        };
        result.push({ ...mount, y: mount.y - 2.5, support: 'beam', mount });
      }
    }
  for (const room of MINE_ROOMS) {
    const n = room.width >= 180 ? 16 : room.width >= 120 ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      wallLamp({
        x: room.x + Math.cos(angle) * room.width * 0.48,
        z: room.z + Math.sin(angle) * room.depth * 0.48,
      });
    }
  }
  for (const route of MINE_CURVES) {
    let count = 0,
      remainder = 0;
    const spacing = route.id === 'main' ? 22 : 26;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        len = Math.hypot(b.x - a.x, b.z - a.z),
        nx = -(b.z - a.z) / len,
        nz = (b.x - a.x) / len;
      for (let d = remainder; d < len; d += spacing) {
        const side = count++ % 2 ? 1 : -1,
          offset = route.width / 2 - 2.5;
        wallLamp({
          x: a.x + ((b.x - a.x) * d) / len + nx * offset * side,
          z: a.z + ((b.z - a.z) * d) / len + nz * offset * side,
        });
      }
      remainder = (remainder - len) % spacing;
      if (remainder < 0) remainder += spacing;
    }
  }
  if (result.length > 280) {
    const source = [...result];
    result.length = 0;
    for (let i = 0; i < 280; i++)
      result.push(source[Math.floor((i * source.length) / 280)]);
  }
  return (lanternCache = result);
}
export function mineLineOfSight(a: MinePoint, b: MinePoint, step = 3) {
  const n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / step);
  for (let i = 1; i < n; i++)
    if (
      mineDistance(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n) <
      -0.2
    )
      return false;
  return true;
}
/** Occlusion-aware static vertex-light bake; shared by staging and the runtime. */
export function mineBakedLight(
  p: MineVertex,
  lanterns = mineLanterns(),
): [number, number, number] {
  let warm = 0;
  for (const l of lanterns) {
    const d2 = (p.x - l.x) ** 2 + (p.z - l.z) ** 2 + (p.y - l.y) ** 2;
    // Let mounted lights reach the middle of broad caverns. A soft outer falloff
    // avoids the old abrupt 72-unit dark circle; occlusion still blocks stone.
    if(d2<140*140&&mineLineOfSight(p,l,4))warm+=1.7/(1+d2/145)*(1-clamp((Math.sqrt(d2)-85)/55));
  }
  const blue = MINE_ROOMS.filter((r) => r.id === 'D' || r.id === 'S4').reduce(
    (v, r) =>
      v + 0.16 * Math.exp(-((p.x - r.x) ** 2 + (p.z - r.z) ** 2) / 2400),
    0,
  );
  return [
    Math.min(1.4, 0.095 + warm * 0.65),
    Math.min(1.1, 0.085 + warm * 0.4 + blue * 0.4),
    Math.min(0.85, 0.078 + warm * 0.19 + blue),
  ];
}
export function drawMineMinimap(
  ctx: CanvasRenderingContext2D,
  size: number,
  player?: MinePoint,
  labels = true,
) {
  const s = size / 1000;
  ctx.fillStyle = '#101215';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#715039';
  ctx.beginPath();
  for (const tri of mineShell().floors) {
    ctx.moveTo((tri[0].x + 500) * s, (tri[0].z + 500) * s);
    for (let i = 1; i < 3; i++)
      ctx.lineTo((tri[i].x + 500) * s, (tri[i].z + 500) * s);
    ctx.closePath();
  }
  ctx.fill();
  ctx.fillStyle = '#8c6549';
  for (const room of MINE_ROOMS) {
    ctx.beginPath();
    ctx.ellipse(
      (room.x + 500) * s,
      (room.z + 500) * s,
      room.width * 0.44 * s,
      room.depth * 0.44 * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.strokeStyle = '#c4a16e';
  ctx.lineWidth = Math.max(0.7, size / 700);
  for (const points of MINE_RAILS) {
    ctx.beginPath();
    points.forEach((p, i) =>
      i
        ? ctx.lineTo((p.x + 500) * s, (p.z + 500) * s)
        : ctx.moveTo((p.x + 500) * s, (p.z + 500) * s),
    );
    ctx.stroke();
  }
  ctx.fillStyle = '#ead3a4';
  ctx.fillRect(494 * s, 942 * s, 12 * s, 12 * s);
  if (size >= 450 && labels) {
    ctx.font = `${Math.max(16, size / 42)}px sans-serif`;
    ctx.textAlign = 'center';
    for (const r of MINE_ROOMS) {
      ctx.fillStyle = '#f4dbb8';
      const words = r.name.split(' '),
        middle = Math.ceil(words.length / 2);
      ctx.fillText(
        words.slice(0, middle).join(' '),
        (r.x + 500) * s,
        (r.z + 500) * s - 5,
      );
      ctx.fillText(
        words.slice(middle).join(' '),
        (r.x + 500) * s,
        (r.z + 500) * s + 20,
      );
    }
    ctx.fillText('EXIT', 500 * s, 976 * s);
    ctx.fillText('N ↑', 950 * s, 28 * s);
  }
  if (player) {
    ctx.beginPath();
    ctx.arc(
      (player.x + 500) * s,
      (player.z + 500) * s,
      Math.max(3, size / 180),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#fff3ac';
    ctx.fill();
  }
}
