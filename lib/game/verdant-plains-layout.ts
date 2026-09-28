/** Authoritative, deterministic layout. North is -Z; design coordinates are 0..1000. */
export type PlainsPoint = { x: number; z: number };
export const PLAINS_ID = 'verdant-plains-v2';
export const PLAINS_SIZE = 1000;
export const PLAINS_RESOLUTION = 513;
export const PLAINS_STEP = PLAINS_SIZE / (PLAINS_RESOLUTION - 1);
export const plainsPoint = (u: number, v: number): PlainsPoint => ({
  x: u - 500,
  z: v - 500,
});
export const PLAINS_ENTRY = plainsPoint(120, 480);
export const PLAINS_EXIT = plainsPoint(540, 60);
export const PLAINS_BOUNDS = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const points = (a: number[][]) => a.map(([u, v]) => plainsPoint(u, v));
function curve(a: PlainsPoint[], steps = 12): PlainsPoint[] {
  const result: PlainsPoint[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const p = a[Math.max(0, i - 1)],
      q = a[i],
      r = a[i + 1],
      s = a[Math.min(a.length - 1, i + 2)];
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      const f = (key: 'x' | 'z') =>
        0.5 *
        (2 * q[key] +
          (-p[key] + r[key]) * t +
          (2 * p[key] - 5 * q[key] + 4 * r[key] - s[key]) * t * t +
          (-p[key] + 3 * q[key] - 3 * r[key] + s[key]) * t * t * t);
      result.push({ x: f('x'), z: f('z') });
    }
  }
  return [...result, a[a.length - 1]];
}
export const PLAINS_RIVER = curve(
  points([
    [960, 0],
    [930, 200],
    [870, 380],
    [620, 490],
    [380, 600],
    [220, 720],
    [120, 840],
    [70, 960],
  ]),
);
export const PLAINS_BRIDGE = {
  ...plainsPoint(620, 490),
  dx: 0.4,
  dz: 0.916515,
  halfLength: 32,
  halfWidth: 4,
  height: 6.4,
};
export function bridgeLocal(p: PlainsPoint) {
  const b = PLAINS_BRIDGE,
    x = p.x - b.x,
    z = p.z - b.z;
  return { along: x * b.dx + z * b.dz, across: x * b.dz - z * b.dx };
}
export function onPlainsBridge(p: PlainsPoint, margin = 0) {
  const q = bridgeLocal(p);
  return (
    Math.abs(q.along) <= PLAINS_BRIDGE.halfLength &&
    Math.abs(q.across) <= PLAINS_BRIDGE.halfWidth - margin
  );
}
export const PLAINS_PATHS = [
  {
    width: 9,
    points: [
      ...curve(
        points([
          [120, 480],
          [245, 455],
          [390, 440],
          [500, 430],
          [596, 435],
        ]),
      ),
      ...points([
        [608, 462.5],
        [620, 490],
        [632, 517.5],
        [644, 545],
      ]),
      ...curve(
        points([
          [644, 545],
          [705, 605],
          [790, 690],
        ]),
      ).slice(1),
    ],
  },
  {
    width: 9,
    points: curve(
      points([
        [500, 430],
        [490, 310],
        [525, 190],
        [540, 60],
      ]),
    ),
  },
  {
    width: 5,
    points: curve(
      points([
        [245, 455],
        [230, 325],
        [340, 235],
        [490, 310],
      ]),
    ),
  },
  {
    width: 5,
    points: curve(
      points([
        [245, 455],
        [330, 515],
        [425, 475],
        [500, 430],
      ]),
    ),
  },
  {
    width: 5,
    points: curve(
      points([
        [644, 545],
        [530, 660],
        [425, 760],
        [595, 795],
        [790, 690],
        [810, 545],
        [720, 565],
        [644, 545],
      ]),
    ),
  },
];
export const PLAINS_POCKETS = [
  { id: 'camp-meadow', ...plainsPoint(235, 420), radius: 35 },
  { id: 'central-meadow', ...plainsPoint(400, 390), radius: 50 },
  { id: 'river-meadow', ...plainsPoint(710, 570), radius: 40 },
  { id: 'north-meadow', ...plainsPoint(530, 220), radius: 55 },
  { id: 'coastal-meadow', ...plainsPoint(560, 740), radius: 40 },
];
export const PLAINS_CLEARING = { ...plainsPoint(620, 300), radius: 48 };
export const plainsCoast = (x: number) =>
  352 + 36 * Math.sin(x / 127) + 15 * Math.sin(x / 49);
export function lineDistance(p: PlainsPoint, line: PlainsPoint[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz));
    best = Math.min(
      best,
      (p.x - a.x - t * dx) ** 2 + (p.z - a.z - t * dz) ** 2,
    );
  }
  return Math.sqrt(best);
}
export const riverHalfWidth = (x: number, z: number) =>
  14 + 4 * smooth(-250, 250, -x) + 17 * smooth(220, 440, z);
export const plainsRiverDistance = (p: PlainsPoint) =>
  lineDistance(p, PLAINS_RIVER) - riverHalfWidth(p.x, p.z);
export const plainsRoadDistance = (p: PlainsPoint) =>
  Math.min(
    ...PLAINS_PATHS.map(
      (path) => lineDistance(p, path.points) - path.width / 2,
    ),
  );
export const plainsSafe = (p: PlainsPoint, margin = 0) =>
  Math.hypot(p.x - PLAINS_ENTRY.x, p.z - PLAINS_ENTRY.z) <= 20 + margin;
function rawHeight(x: number, z: number) {
  const river = plainsRiverDistance({ x, z }),
    coast = plainsCoast(x) - z;
  const hills =
    17 +
    8 * Math.sin(x / 180 + 0.7) * Math.cos(z / 145) +
    5 * Math.sin((x + z) / 280);
  let y =
    (6.2 + (hills - 6.2) * smooth(22, 115, river)) * smooth(-12, 65, coast);
  const ridges = [
    [-250, -285, 45, 26, 34],
    [-115, -150, 36, 24, 27],
    [-295, 155, 38, 24, 29],
    [280, -145, 42, 28, 36],
    [315, 255, 34, 26, 26],
  ];
  let ridge = 0;
  for (const [cx, cz, rx, rz, height] of ridges)
    ridge += height * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  if (ridge > 0.01)
    y +=
      ridge *
      smooth(8, 24, plainsRoadDistance({ x, z })) *
      smooth(8, 30, river) *
      smooth(25, 70, coast);
  y +=
    smooth(453, 500, Math.max(Math.abs(x), -z)) *
    28 *
    smooth(4, 30, river) *
    smooth(35, 80, coast);
  y -= 9 * (1 - smooth(-10, 8, river));
  if (coast < 0) y = Math.min(y, coast * 0.16);
  if (river > 7 && coast > 20)
    for (const pocket of [...PLAINS_POCKETS, PLAINS_CLEARING]) {
      const distance = Math.hypot(x - pocket.x, z - pocket.z);
      const level = 8 + Math.max(0, -z - 50) * 0.018;
      y +=
        (level - y) *
        (1 - smooth(pocket.radius * 0.9, pocket.radius + 55, distance));
    }
  // Flatten the camp and both approaches, preserving a gentle transition.
  y =
    y +
    (8 - y) *
      (1 - smooth(19, 48, Math.hypot(x - PLAINS_ENTRY.x, z - PLAINS_ENTRY.z)));
  const b = bridgeLocal({ x, z });
  if (river > 3)
    y =
      y +
      (PLAINS_BRIDGE.height - y) *
        (1 - smooth(32, 70, Math.abs(b.along))) *
        (1 - smooth(8, 32, Math.abs(b.across)));
  if (river > 3 && coast > 20) {
    const road = plainsRoadDistance({ x, z });
    const roadHeight =
      8 +
      Math.max(0, -z - 50) * 0.018 -
      1.6 *
        (1 - smooth(32, 110, Math.abs(b.along))) *
        (1 - smooth(8, 32, Math.abs(b.across)));
    if (road < 90) y += (roadHeight - y) * (1 - smooth(1, 90, road));
  }
  return y;
}
let heights: Float32Array | undefined;
export function plainsHeightfield() {
  if (!heights) {
    heights = new Float32Array(513 * 513);
    for (let z = 0; z < 513; z++)
      for (let x = 0; x < 513; x++)
        heights[z * 513 + x] = rawHeight(
          x * PLAINS_STEP - 500,
          z * PLAINS_STEP - 500,
        );
  }
  return heights;
}
/** Same diagonal and barycentric interpolation as each full-resolution terrain quad. */
export function plainsTerrainHeight(x: number, z: number) {
  const h = plainsHeightfield(),
    u = clamp((x + 500) / PLAINS_STEP, 0, 511.999999),
    v = clamp((z + 500) / PLAINS_STEP, 0, 511.999999),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * 513 + i;
  return a + b <= 1
    ? h[k] + a * (h[k + 1] - h[k]) + b * (h[k + 513] - h[k])
    : h[k + 514] +
        (1 - a) * (h[k + 513] - h[k + 514]) +
        (1 - b) * (h[k + 1] - h[k + 514]);
}
export const plainsGroundHeight = (x: number, z: number) =>
  onPlainsBridge({ x, z }) ? PLAINS_BRIDGE.height : plainsTerrainHeight(x, z);
export function plainsWalkable(p: PlainsPoint, radius = 0.45) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > 498 - radius ||
    Math.abs(p.z) > 498 - radius
  )
    return false;
  if (onPlainsBridge(p, radius)) return true;
  if (
    p.z > plainsCoast(p.x) - 4 - radius ||
    plainsRiverDistance(p) < 4 + radius
  )
    return false;
  const h = plainsTerrainHeight(p.x, p.z);
  return (
    Math.abs(plainsTerrainHeight(p.x + 1, p.z) - h) < 0.65 &&
    Math.abs(plainsTerrainHeight(p.x, p.z + 1) - h) < 0.65
  );
}
export function restorePlainsPosition(p: PlainsPoint) {
  return plainsWalkable(p) ? { x: p.x, z: p.z } : { ...PLAINS_ENTRY };
}
export type PlainsProp = PlainsPoint & {
  kind: 'fir' | 'tree' | 'rock' | 'shrub';
  scale: number;
  yaw: number;
  radius: number;
};
let props: PlainsProp[] | undefined;
export function plainsProps() {
  if (props) return props;
  props = [];
  let seed = 71943;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let cluster = 0; cluster < 110; cluster++) {
    const cx = rnd() * 950 - 475,
      cz = rnd() * 810 - 460;
    for (let j = 0; j < 16; j++) {
      const x = cx + (rnd() - 0.5) * 75,
        z = cz + (rnd() - 0.5) * 65,
        p = { x, z },
        r = rnd();
      if (
        !plainsWalkable(p, 3) ||
        plainsRoadDistance(p) < 6 ||
        plainsSafe(p, 15) ||
        Math.hypot(x - PLAINS_EXIT.x, z - PLAINS_EXIT.z) < 15 ||
        PLAINS_POCKETS.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius) ||
        Math.hypot(x - PLAINS_CLEARING.x, z - PLAINS_CLEARING.z) <
          PLAINS_CLEARING.radius
      )
        continue;
      const kind =
          r < 0.38 ? 'fir' : r < 0.62 ? 'tree' : r < 0.82 ? 'rock' : 'shrub',
        scale =
          kind === 'rock'
            ? 2 + rnd() * 3
            : kind === 'shrub'
              ? 1 + rnd()
              : 0.75 + rnd() * 0.75;
      props.push({
        x,
        z,
        kind,
        scale,
        yaw: rnd() * Math.PI * 2,
        radius:
          kind === 'rock' ? scale * 0.55 : kind === 'shrub' ? 0 : 0.55 * scale,
      });
    }
  }
  // Keep roughly 42% of the authored trees, without reseeding or moving rocks/shrubs.
  // Navigation consumes the same result so removed trees leave no invisible trunks.
  props = props.filter(
    (p) =>
      (p.kind !== 'fir' && p.kind !== 'tree') ||
      ((Math.imul(Math.round(p.x * 100), 73856093) ^
        Math.imul(Math.round(p.z * 100), 19349663)) >>>
        0) %
        100 <
        42,
  );
  return props;
}
/** Props are indexed once; dash and ordinary movement share swept collision. */
export class PlainsNavigation {
  private grid = new Map<string, PlainsProp[]>();
  constructor() {
    const campProps: PlainsProp[] = [-8, 8].map((x) => ({
      x: PLAINS_ENTRY.x + x,
      z: PLAINS_ENTRY.z - 5,
      kind: 'rock',
      scale: 1,
      yaw: 0,
      radius: 2.3,
    }));
    campProps.push({
      x: PLAINS_ENTRY.x,
      z: PLAINS_ENTRY.z - 7,
      kind: 'rock',
      scale: 1,
      yaw: 0,
      radius: 1.6,
    });
    for (const p of [...plainsProps(), ...campProps])
      if (p.radius) {
        const k = this.key(p.x, p.z);
        this.grid.set(k, [...(this.grid.get(k) ?? []), p]);
      }
  }
  private key(x: number, z: number) {
    return `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  }
  valid(p: PlainsPoint, radius = 0.45) {
    if (!plainsWalkable(p, radius)) return false;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const o of this.grid.get(this.key(p.x + dx * 16, p.z + dz * 16)) ??
          [])
          if (Math.hypot(p.x - o.x, p.z - o.z) < radius + o.radius)
            return false;
    return true;
  }
  move(from: PlainsPoint, dx: number, dz: number, radius = 0.45) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { ...from };
    const count = Math.ceil(Math.hypot(dx, dz) / 0.4),
      p = { ...from };
    for (let i = 0; i < count; i++) {
      const x = p.x + dx / count,
        z = p.z + dz / count;
      if (this.valid({ x, z }, radius)) {
        p.x = x;
        p.z = z;
      } else if (this.valid({ x, z: p.z }, radius)) p.x = x;
      else if (this.valid({ x: p.x, z }, radius)) p.z = z;
    }
    return p;
  }
}
