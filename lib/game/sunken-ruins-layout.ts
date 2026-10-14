/** Reference image is 1254 square; design space is 1000 square, north = -Z.
 * This module is data/math only: registry/save validation must not import Three. */
import { DEEP_OCEAN_ID, DEEP_OCEAN_GATE } from './underwater-regions.ts';
import { shelfContour } from './underwater-contour.ts';
import {
  SUNKEN_ARTIFACTS,
  SUNKEN_ARTIFACT_COLLIDERS,
} from './sunken-ruins-artifact-layout.ts';
export const SUNKEN_ID = 'sunken-ruins';
export const SUNKEN_PREVIEW_ID = 'sunken-ruins-underwater-v1';
export const SUNKEN_LAYOUT_VERSION = 2;
export const SUNKEN_SIZE = 1000;
export type SunkenPoint = { x: number; z: number };
export const sunkenPoint = (u: number, v: number): SunkenPoint => ({
  x: u - 500,
  z: v - 500,
});
export const SUNKEN_BOUNDS = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
export const SUNKEN_WALL_HEIGHT = 18;
export const SUNKEN_WALL_CONTOUR = 18;
export const SUNKEN_ZONES = [
  {
    ...sunkenPoint(545, 725),
    id: 1,
    name: 'Coral Entrance',
    rx: 145,
    rz: 125,
    color: '#6bdcd1',
  },
  {
    ...sunkenPoint(400, 600),
    id: 2,
    name: 'Sunken Pathway',
    rx: 140,
    rz: 125,
    color: '#37b8b6',
  },
  {
    ...sunkenPoint(545, 410),
    id: 3,
    name: 'Ancient Ruins',
    rx: 180,
    rz: 155,
    color: '#5fc9cc',
  },
  {
    ...sunkenPoint(255, 280),
    id: 4,
    name: 'Deep Abyss Section',
    rx: 170,
    rz: 150,
    color: '#6c81b6',
  },
  {
    ...sunkenPoint(545, 130),
    id: 5,
    name: 'Abyssal Throne',
    rx: 148,
    rz: 118,
    color: '#78ced5',
  },
] as const;
export const SUNKEN_ENTRY = sunkenPoint(545, 725);
export const SUNKEN_PORTALS = [
  {
    ...sunkenPoint(545, 850),
    id: 'south',
    destination: 'jayantara',
    name: 'Kembali ke Kota Jayantara',
    yaw: 0,
  },
  {
    ...sunkenPoint(150, 700),
    id: 'south-west',
    destination: 'jayantara',
    name: 'Warp ke Kota Jayantara',
    yaw: Math.atan2(80, -20),
  },
  {
    ...sunkenPoint(840, 175),
    id: 'north-east',
    destination: 'whispering-wilds-v2',
    name: 'Warp to Whispering Wilds',
    yaw: Math.atan2(-55, 35),
  },
  {
    ...DEEP_OCEAN_GATE,
    id: 'deep-ocean-g7',
    destination: DEEP_OCEAN_ID,
    name: 'Deep Ocean · G7',
    yaw: 0,
  },
] as const;
// Arch feet share the portal transform; the opening itself remains walkable.
export const SUNKEN_PORTAL_SUPPORTS = SUNKEN_PORTALS.flatMap((g) =>
  [-1, 1].map((side) => ({
    x: g.x + side * 2.8 * Math.cos(g.yaw),
    z: g.z - side * 2.8 * Math.sin(g.yaw),
    radius: 1.5,
  })),
);
const points = (p: number[][]) => p.map(([u, v]) => sunkenPoint(u, v));
export const SUNKEN_PATHS = [
  {
    width: 80,
    points: points([
      [545, 850],
      [545, 790],
      [545, 725],
      [535, 650],
      [535, 555],
      [545, 470],
      [545, 410],
      [545, 315],
      [550, 245],
      [545, 185],
      [545, 130],
    ]),
  },
  {
    width: 72,
    points: points([
      [545, 725],
      [470, 665],
      [400, 600],
      [380, 535],
      [365, 460],
      [400, 395],
      [455, 370],
      [545, 410],
    ]),
  },
  {
    width: 72,
    points: points([
      [400, 600],
      [325, 580],
      [260, 620],
      [230, 680],
      [150, 700],
    ]),
  },
  {
    width: 48,
    points: points([
      [365, 460],
      [340, 395],
      [285, 355],
      [255, 280],
      [195, 225],
      [160, 190],
    ]),
  },
  {
    width: 48,
    points: points([
      [340, 395],
      [400, 320],
      [475, 290],
      [550, 245],
    ]),
  },
  {
    width: 72,
    points: points([
      [545, 725],
      [620, 720],
      [710, 660],
      [750, 565],
      [820, 490],
      [865, 405],
      [840, 335],
      [775, 300],
      [745, 255],
      [785, 210],
      [840, 175],
    ]),
  },
  {
    width: 48,
    points: points([
      [535, 555],
      [615, 550],
      [700, 585],
      [750, 565],
    ]),
  },
  {
    width: 48,
    points: points([
      [545, 315],
      [640, 310],
      [690, 350],
      [775, 300],
    ]),
  },
  {
    width: 48,
    points: points([
      [700, 585],
      [715, 485],
      [685, 420],
      [650, 355],
      [640, 310],
    ]),
  },
] as const;
export function sunkenSegmentDistance(
  p: SunkenPoint,
  a: SunkenPoint,
  b: SunkenPoint,
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
export function sunkenPathDistance(p: SunkenPoint) {
  let d = Infinity;
  for (const path of SUNKEN_PATHS)
    for (let i = 1; i < path.points.length; i++)
      d = Math.min(
        d,
        sunkenSegmentDistance(p, path.points[i - 1], path.points[i]) -
          path.width * 0.5,
      );
  return d;
}
/** Wide sand avenues may contain reef islands; a 36/24-unit through lane stays open. */
export function sunkenRouteClearance(p: SunkenPoint) {
  let d = Infinity;
  for (const path of SUNKEN_PATHS)
    for (let i = 1; i < path.points.length; i++)
      d = Math.min(
        d,
        sunkenSegmentDistance(p, path.points[i - 1], path.points[i]) -
          (path.width >= 72 ? 18 : 12),
      );
  return d;
}
// Broad sand shelves open the unused spaces inside the reference's east and SW loops.
export const SUNKEN_SHELVES = [
  { x: 257, z: -45, rx: 165, rz: 218 },
  { x: -277, z: 110, rx: 142, rz: 158 },
  { x: 15, z: 318, rx: 212, rz: 112 },
] as const;
const SUNKEN_FLOOR_REGIONS = [...SUNKEN_ZONES, ...SUNKEN_SHELVES];
// Preserve the established heightfield when moving a portal. These are terrain
// pads, not active portal positions (the former G7 pad is ordinary sand now).
const SUNKEN_TERRAIN_PADS = [
  { x: 45, z: 350 },
  { x: -350, z: 200 },
  { x: 340, z: -325 },
  { x: 150, z: 150 },
];
const smoothMin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Signed depth contour for terrain, habitat placement and minimap tint; not a movement wall. */
export function sunkenFloorDistance(p: SunkenPoint) {
  let d = sunkenPathDistance(p) - 22;
  for (const z of SUNKEN_FLOOR_REGIONS)
    d = smoothMin(
      d,
      (Math.hypot((p.x - z.x) / z.rx, (p.z - z.z) / z.rz) - 1) *
        Math.min(z.rx, z.rz),
      24,
    );
  for (const gate of SUNKEN_TERRAIN_PADS)
    d = smoothMin(d, Math.hypot(p.x - gate.x, p.z - gate.z) - 56, 20);
  // Rounded outer enclosure leaves enough room to render the inaccessible sand bank.
  const qx = Math.abs(p.x) - 427,
    qz = Math.abs(p.z) - 427;
  const enclosure =
    Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) +
    Math.min(Math.max(qx, qz), 0) -
    45;
  return -smoothMin(-d, -enclosure, 12);
}
export function sunkenGroundHeight(x: number, z: number) {
  const throne = SUNKEN_ZONES[4],
    r = Math.hypot(x - throne.x, z - throne.z);
  // Low ceremonial platform with a smooth walk ramp, no vertical navigation.
  const platform = Math.max(0, Math.min(1, (68 - r) / 12)) * 0.8;
  return (
    0.55 * Math.sin(x * 0.019) * Math.sin(z * 0.016) +
    0.22 * Math.cos(z * 0.028) +
    0.18 * Math.sin(x * 0.032 + z * 0.021) +
    platform +
    sunkenBankHeight(x, z)
  );
}
/** Smooth continental slope into deep water, traversable up to the square map bounds. */
export function sunkenBankHeight(x: number, z: number) {
  const d = sunkenFloorDistance({ x, z });
  const offshore = smoothstep(490, 760, Math.max(Math.abs(x), Math.abs(z)));
  return (
    -smoothstep(-4, 85, d) * (48 + 3 * Math.sin(x * 0.013 + z * 0.009)) -
    smoothstep(50, 140, d) *
      (18 + 2 * Math.sin(x * 0.033) * Math.cos(z * 0.025)) -
    offshore * (155 + 12 * Math.sin(x * 0.006) * Math.cos(z * 0.008))
  );
}
export const sunkenSafe = (p: SunkenPoint, margin = 0) =>
  [SUNKEN_ENTRY, ...SUNKEN_PORTALS].some(
    (q) => Math.hypot(p.x - q.x, p.z - q.z) < 32 + margin,
  );
export type SunkenObstacle = SunkenPoint & {
  radius: number;
  height: number;
  kind: 'pillar' | 'rock';
  yaw: number;
};
export const SUNKEN_LANDMARKS = [
  { name: 'trident', ...sunkenPoint(545, 69), scale: 3, yaw: 0, radius: 1 },
  {
    name: 'broken_pillar',
    ...sunkenPoint(400, 650),
    scale: 2,
    yaw: 0.4,
    radius: 2.7,
  },
] as const;
/** Former statue/masonry locations stay open: no render, player or camera collider.
 * Retain these gardens' empty space and existing monster homes when removing props. */
export const SUNKEN_CLEARINGS = [
  { ...sunkenPoint(491, 345), radius: 2.9 },
  { ...sunkenPoint(605, 391), radius: 2.9 },
  { ...sunkenPoint(510, 475), radius: 7.8 },
  { ...sunkenPoint(609, 451), radius: 7.8 },
  { ...sunkenPoint(253, 237), radius: 3.2 },
  { ...sunkenPoint(202, 310), radius: 6.2 },
] as const;
/** Same structural footprints drive render and collision. All path cores remain clear. */
export const SUNKEN_OBSTACLES: SunkenObstacle[] = [];
for (const zone of [SUNKEN_ZONES[2], SUNKEN_ZONES[4]])
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14,
      rad = zone.id === 3 ? 81 : 74;
    const p = { x: zone.x + Math.cos(a) * rad, z: zone.z + Math.sin(a) * rad };
    if (sunkenPathDistance(p) > 10)
      SUNKEN_OBSTACLES.push({
        ...p,
        radius: 2.6,
        height: 8 + (i % 4) * 2.5,
        kind: 'pillar',
        yaw: a,
      });
  }
for (const [u, v] of [
  [240, 565],
  [290, 610],
  [825, 440],
  [842, 455],
  [835, 610],
  [475, 568],
  [775, 685],
  [180, 277],
  [315, 260],
]) {
  const p = sunkenPoint(u, v);
  if (sunkenPathDistance(p) > 9 && sunkenFloorDistance(p) < -8)
    SUNKEN_OBSTACLES.push({
      ...p,
      radius: 3.6,
      height: 4,
      kind: 'rock',
      yaw: u,
    });
}
export type SunkenReefPlacement = SunkenPoint & {
  id: string;
  name:
    | 'reef_cluster'
    | 'coral_branch'
    | 'coral_fan'
    | 'coral_plate'
    | 'coral_tube'
    | 'seaweed'
    | 'kelp';
  scale: number;
  yaw: number;
  radius: number;
  height: number;
  color: string;
};
export const sunkenHash = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
/** Reproducible reef gardens: dominant mound, smaller colonies and soft flora fringes.
 * Rendering and collision consume these very same placements, at every quality. */
export const SUNKEN_REEFS: SunkenReefPlacement[] = [];
const reefPalette = ['#f0c4ad', '#d8afc8', '#c9ddd0', '#edbe98', '#bbd5d8'];
for (let gz = -430; gz <= 430; gz += 30)
  for (let gx = -430; gx <= 430; gx += 30) {
    const cx = gx + (sunkenHash(gx, gz) - 0.5) * 15;
    const cz = gz + (sunkenHash(gz, gx) - 0.5) * 15;
    const edge = sunkenFloorDistance({ x: cx, z: cz });
    if (edge > -5 || sunkenHash(gx + 2, gz) < 0.16) continue;
    // Reef ribbons are denser at the edge, with scattered islands on the broad shelves.
    if (
      edge < -55 &&
      sunkenHash(Math.floor(gx / 80), Math.floor(gz / 80)) < 0.4
    )
      continue;
    const rotation = sunkenHash(gz, gx + 17) * Math.PI * 2;
    for (let j = 0; j < 8; j++) {
      const a = rotation + j * 2.39996;
      const distance = j === 0 ? 0 : 3.8 + Math.sqrt(j) * 1.5;
      const x = cx + Math.cos(a) * distance,
        z = cz + Math.sin(a) * distance * 0.78;
      const plant = j >= 6;
      const name: SunkenReefPlacement['name'] = plant
        ? j === 7
          ? 'kelp'
          : 'seaweed'
        : j < 2
          ? 'reef_cluster'
          : (['coral_branch', 'coral_plate', 'coral_tube', 'coral_fan'][
              j - 2
            ] as SunkenReefPlacement['name']);
      const scale =
        (j === 0 ? 2.5 : j === 1 ? 1.75 : 0.9) *
        (0.8 + sunkenHash(gx + j, gz + 5) * 0.5);
      const radius = plant
        ? 0
        : scale *
          (name === 'reef_cluster' ? 1 : name === 'coral_fan' ? 1.05 : 0.9);
      const p = { x, z };
      if (
        sunkenFloorDistance(p) > -radius - 2 ||
        SUNKEN_ARTIFACTS.some(
          (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius + 2,
        ) ||
        sunkenSafe(p, radius + 3) ||
        sunkenRouteClearance(p) < radius + 2
      )
        continue;
      if (
        [SUNKEN_ZONES[2], SUNKEN_ZONES[4]].some(
          (q) => Math.hypot(x - q.x, z - q.z) < 57 + radius,
        )
      )
        continue;
      if (
        [...SUNKEN_OBSTACLES, ...SUNKEN_LANDMARKS, ...SUNKEN_CLEARINGS].some(
          (q) => Math.hypot(x - q.x, z - q.z) < q.radius + radius + 3,
        )
      )
        continue;
      SUNKEN_REEFS.push({
        id: `reef:${gx}:${gz}:${j}`,
        name,
        x,
        z,
        scale,
        yaw: a,
        radius,
        height:
          scale *
          (name === 'reef_cluster' ? 1.65 : name === 'coral_tube' ? 1.4 : 2.4),
        color:
          name === 'reef_cluster'
            ? '#ffffff'
            : plant
              ? '#7e9f73'
              : reefPalette[
                  Math.floor(sunkenHash(gx + 6, gz) * reefPalette.length)
                ],
      });
    }
  }
// Register proxies into every overlapped cell, so query cost stays local to the actor.
export const SUNKEN_WALL: ReturnType<typeof shelfContour> = shelfContour(sunkenFloorDistance, SUNKEN_WALL_CONTOUR);
export const SUNKEN_WALL_COLLIDERS = SUNKEN_WALL.segments.flatMap(
  ({ a, b }) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 2));
    return Array.from({ length: n + 1 }, (_, i) => ({
      x: a.x + ((b.x - a.x) * i) / n,
      z: a.z + ((b.z - a.z) * i) / n,
      radius: 2.35,
      height: SUNKEN_WALL_HEIGHT + 0.25,
    }));
  },
);
type SunkenCollider = SunkenPoint & { radius: number };
export const SUNKEN_COLLIDERS: readonly SunkenCollider[] = [
  ...SUNKEN_OBSTACLES,
  ...SUNKEN_LANDMARKS,
  ...SUNKEN_PORTAL_SUPPORTS,
  ...SUNKEN_REEFS.filter((p) => p.radius > 0),
  ...SUNKEN_WALL_COLLIDERS,
  ...SUNKEN_ARTIFACT_COLLIDERS,
];
const collisionCells = new Map<string, SunkenCollider[]>();
for (const o of SUNKEN_COLLIDERS)
  for (
    let z = Math.floor((o.z - o.radius) / 24);
    z <= Math.floor((o.z + o.radius) / 24);
    z++
  )
    for (
      let x = Math.floor((o.x - o.radius) / 24);
      x <= Math.floor((o.x + o.radius) / 24);
      x++
    ) {
      const key = `${x},${z}`,
        list = collisionCells.get(key) ?? [];
      list.push(o);
      collisionCells.set(key, list);
    }
export function sunkenCollisionFree(p: SunkenPoint, radius = 0.45) {
  for (
    let z = Math.floor((p.z - radius) / 24);
    z <= Math.floor((p.z + radius) / 24);
    z++
  )
    for (
      let x = Math.floor((p.x - radius) / 24);
      x <= Math.floor((p.x + radius) / 24);
      x++
    )
      for (const o of collisionCells.get(`${x},${z}`) ?? [])
        if (Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius) return false;
  return true;
}
export function sunkenWalkable(p: SunkenPoint, radius = 0.45) {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    p.x >= SUNKEN_BOUNDS.minX + radius &&
    p.x <= SUNKEN_BOUNDS.maxX - radius &&
    p.z >= SUNKEN_BOUNDS.minZ + radius &&
    p.z <= SUNKEN_BOUNDS.maxZ - radius &&
    sunkenCollisionFree(p, radius)
  );
}
/** The wall's closed contour still bounds monsters at the player-only openings. */
export function sunkenInsideWall(p: SunkenPoint, margin = 0) {
  return sunkenFloorDistance(p) < SUNKEN_WALL_CONTOUR - margin;
}
export function sunkenMonsterWalkable(p: SunkenPoint, radius = 0.55) {
  return (
    sunkenInsideWall(p, radius + 2.5) &&
    !sunkenSafe(p, radius + 1) &&
    sunkenWalkable(p, radius)
  );
}
