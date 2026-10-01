/** Authoritative Whispering Wilds terrain layout. Design north is -Z. */
export const WILDS_ID = 'whispering-wilds-v2';
export const WILDS_RETIRED_ID = 'whispering-wilds';
export const WILDS_SIZE = 1000,
  WILDS_RESOLUTION = 513,
  WILDS_STEP = 1000 / 512;
export type WildsPoint = { x: number; z: number };
export const wildsPoint = (u: number, v: number): WildsPoint => ({
  x: u - 500,
  z: v - 500,
});
export const WILDS_BOUNDS = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
export const WILDS_ENTRY = wildsPoint(590, 910);
export const WILDS_PORTALS = [
  { ...wildsPoint(65, 445), destination: 'averion', name: 'Averion City' },
  { ...wildsPoint(590, 930), destination: 'arunika', name: 'Arunika City' },
  { ...wildsPoint(935, 590), destination: 'jayantara', name: 'Jayantara City' },
] as const;
const points = (a: number[][]) => a.map(([u, v]) => wildsPoint(u, v));
function roundedLine(line: WildsPoint[], radius: number) {
  const out = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1],
      b = line[i],
      c = line[i + 1],
      ab = Math.hypot(b.x - a.x, b.z - a.z),
      bc = Math.hypot(c.x - b.x, c.z - b.z),
      r = Math.min(radius, ab * 0.25, bc * 0.25);
    const p = {
        x: b.x + ((a.x - b.x) * r) / ab,
        z: b.z + ((a.z - b.z) * r) / ab,
      },
      q = { x: b.x + ((c.x - b.x) * r) / bc, z: b.z + ((c.z - b.z) * r) / bc };
    out.push(p);
    for (let j = 1; j <= 5; j++) {
      const t = j / 5,
        k = 1 - t;
      out.push({
        x: k * k * p.x + 2 * k * t * b.x + t * t * q.x,
        z: k * k * p.z + 2 * k * t * b.z + t * t * q.z,
      });
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

export const WILDS_LANDMARKS = [
  { ...wildsPoint(245, 285), name: 'Ancient Grove', rx: 70, rz: 55 },
  { ...wildsPoint(515, 445), name: 'Spirit Lake', rx: 180, rz: 145 },
  { ...wildsPoint(875, 190), name: 'Moonlight Falls', rx: 55, rz: 45 },
  { ...wildsPoint(795, 430), name: 'Ruined Sanctuary', rx: 55, rz: 50 },
  { ...wildsPoint(240, 700), name: 'Twilight Clearing', rx: 80, rz: 70 },
  { ...wildsPoint(775, 735), name: 'Faelight Hollow', rx: 60, rz: 50 },
];
// Shared by the rendered circular altar, grounding, minimap and boss home.
export const WILDS_ALTAR = {
  x: WILDS_LANDMARKS[3].x - 9,
  z: WILDS_LANDMARKS[3].z - 29,
  radius: 23,
  rise: 0.2,
};
export const WILDS_LAKE_ISLAND = { x: 15, z: -55, rx: 76, rz: 60, height: 22 };
export function wildsLakeIslandDistance(p: WildsPoint) {
  const i = WILDS_LAKE_ISLAND;
  return (1 - Math.hypot((p.x - i.x) / i.rx, (p.z - i.z) / i.rz)) * i.rz;
}
export const WILDS_CLEARINGS = [
  ...WILDS_LANDMARKS.filter((p) => p.name !== 'Spirit Lake'),
  { ...wildsPoint(470, 170), name: 'Northern Meadow', rx: 75, rz: 50 },
  { ...wildsPoint(390, 825), name: 'Southern Meadow', rx: 65, rz: 50 },
  { ...wildsPoint(750, 550), name: 'Riverbank Meadow', rx: 45, rz: 30 },
];
export const WILDS_RIVER = roundedLine(
  points([
    [825, -220],
    [825, 45],
    [825, 95],
    [790, 180],
    [650, 250],
    [585, 340],
    [515, 445],
    [520, 585],
    [535, 690],
    [535, 800],
    [475, 950],
    [470, 1000],
    [455, 1130],
    [450, 1250],
    [450, 1300],
  ]),
  22,
);
export const WILDS_TRIBUTARIES: WildsPoint[][] = [];
export const WILDS_PATHS = [
  {
    width: 12,
    points: points([
      [555, 820],
      [340, 810],
      [240, 700],
      [190, 480],
      [245, 285],
      [430, 180],
      [620, 230],
      [650, 250],
      [680, 270],
      [790, 290],
      [820, 470],
      [775, 735],
      [555, 820],
    ]),
  },
  {
    width: 8,
    points: points([
      [190, 480],
      [330, 400],
      [340, 525],
      [480, 625],
      [530, 625],
      [580, 625],
      [700, 565],
      [820, 470],
    ]),
  },
  {
    width: 8,
    points: points([
      [245, 285],
      [360, 310],
      [340, 525],
      [340, 810],
    ]),
  },
  {
    width: 8,
    points: points([
      [790, 290],
      [870, 250],
      [850, 190],
      [920, 300],
      [820, 470],
    ]),
  },
  {
    width: 8,
    points: points([
      [820, 470],
      [795, 430],
      [740, 350],
      [790, 290],
    ]),
  },
  {
    width: 8,
    points: points([
      [775, 735],
      [700, 565],
    ]),
  },
  {
    width: 10,
    points: points([
      [65, 445],
      [120, 445],
      [190, 480],
    ]),
  },
  {
    width: 10,
    points: points([
      [935, 590],
      [860, 590],
      [820, 470],
    ]),
  },
  {
    width: 10,
    points: points([
      [590, 930],
      [590, 875],
      [555, 820],
    ]),
  },
];
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function closestSegment(p: WildsPoint, a: WildsPoint, b: WildsPoint) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1));
  const x = a.x + t * dx,
    z = a.z + t * dz;
  return { distance: Math.hypot(p.x - x, p.z - z), x, z, dx, dz };
}
export function lineDistance(p: WildsPoint, line: WildsPoint[]) {
  let d = Infinity;
  for (let i = 1; i < line.length; i++)
    d = Math.min(d, closestSegment(p, line[i - 1], line[i]).distance);
  return d;
}
export function wildsPathDistance(p: WildsPoint) {
  let d = Infinity;
  for (const path of WILDS_PATHS)
    d = Math.min(d, lineDistance(p, path.points) - path.width / 2);
  return d;
}
/** Clear landscape views from approaches; shared by shelves and prop placement. */
export function wildsSightlineDistance(p: WildsPoint) {
  return Math.min(
    lineDistance(p, [wildsPoint(260, 400), wildsPoint(205, 250)]),
    lineDistance(p, [wildsPoint(915, 320), wildsPoint(790, 180)]),
    lineDistance(p, [wildsPoint(820, 810), wildsPoint(815, 710)]),
  );
}
export const WILDS_SOUTH_SEA_LEVEL = -59;
export const WILDS_SOUTH_MOUTH_Z = 750;
// E starts at v=571.4. Keep the lake/outlet level, then descend through E–G
// and finish beyond G as scenery. Zero end derivatives avoid a final cascade.
export const wildsSouthDescent = (z: number) =>
  71 * smooth(610, WILDS_SOUTH_MOUTH_Z + 500, z + 500);
export function wildsWaterLevel(z: number) {
  const v = z + 500;
  if (v < 300) return 48 - 36 * smooth(60, 300, v);
  return 12 - wildsSouthDescent(z);
}
export function wildsWater(p: WildsPoint) {
  let nearest = closestSegment(p, WILDS_RIVER[0], WILDS_RIVER[1]);
  for (let i = 1; i < WILDS_RIVER.length; i++) {
    const q = closestSegment(p, WILDS_RIVER[i - 1], WILDS_RIVER[i]);
    if (q.distance < nearest.distance) nearest = q;
  }
  const flowZ = nearest.z;
  const mainDistance = nearest.distance - wildsRiverHalfWidth(p);
  let distance = mainDistance,
    height = wildsWaterLevel(flowZ),
    source: 'river' | 'lake' | 'tributary' = 'river';
  for (const line of WILDS_TRIBUTARIES) {
    const d = lineDistance(p, line) - 4;
    if (d < distance) {
      distance = d;
      source = 'tributary';
      // Tributaries inherit their confluence level, not unrelated latitude falls.
      const end = line[line.length - 1];
      height = mainDistance < 0 ? wildsWaterLevel(p.z) : wildsWaterLevel(end.z);
    }
  }
  const lake = WILDS_LANDMARKS[1];
  const lakeD =
    (Math.hypot((p.x - lake.x) / lake.rx, (p.z - lake.z) / lake.rz) -
      wildsLakeEdge(
        Math.atan2((p.z - lake.z) / lake.rz, (p.x - lake.x) / lake.rx),
      )) *
    145;
  if (lakeD < distance) {
    distance = lakeD;
    height = 12;
    source = 'lake';
  }
  const isle = wildsLakeIslandDistance(p);
  if (isle > 0) {
    distance = Math.max(distance, isle);
    height = 12;
    source = 'lake';
  }
  if (distance > 0) {
    const dryLevel = wildsWaterLevel(flowZ);
    height += (dryLevel - height) * smooth(0, 12, distance);
  }
  return { distance, height, source };
}
export function wildsRiverHalfWidth(p: WildsPoint) {
  const d = Math.min(
    ...WILDS_BRIDGES.map((b) => Math.hypot(p.x - b.x, p.z - b.z)),
  );
  return (
    11 + 6 * smooth(32, 70, d) + 20 * smooth(500, WILDS_SOUTH_MOUTH_Z, p.z)
  );
}
export function wildsLakeEdge(a: number) {
  return (
    1 +
    0.09 * Math.sin(a * 3 + 0.7) +
    0.06 * Math.sin(a * 5 - 1) +
    0.035 * Math.cos(a * 9)
  );
}
export const WILDS_BRIDGES = [
  wildsPoint(650, 250),
  wildsPoint(535, 800),
  wildsPoint(525, 625),
].map((p, i) => {
  let near = closestSegment(p, WILDS_RIVER[0], WILDS_RIVER[1]);
  for (let j = 1; j < WILDS_RIVER.length; j++) {
    const q = closestSegment(p, WILDS_RIVER[j - 1], WILDS_RIVER[j]);
    if (q.distance < near.distance) near = q;
  }
  const len = Math.hypot(near.dx, near.dz),
    axis = { x: near.dz / len, z: -near.dx / len };
  return {
    x: near.x,
    z: near.z,
    axis,
    width: 10,
    length: 44,
    height: wildsWaterLevel(near.z) + 4.8,
    kind: i === 2 ? 'stone' : 'wood',
  };
});
WILDS_BRIDGES.push({
  x: -122.5,
  z: -55,
  axis: { x: 1, z: 0 },
  width: 10,
  length: 155,
  height: 24,
  kind: 'stone',
});
export function wildsBridge(p: WildsPoint, radius = 0) {
  return WILDS_BRIDGES.find((b) => {
    const dx = p.x - b.x,
      dz = p.z - b.z;
    return (
      Math.abs(dx * b.axis.x + dz * b.axis.z) <= b.length / 2 &&
      Math.abs(-dx * b.axis.z + dz * b.axis.x) <= b.width / 2 - radius
    );
  });
}
// Snap crossings to the same oriented deck used by navigation and rendering.
const north = WILDS_BRIDGES[0],
  south = WILDS_BRIDGES[1],
  outlet = WILDS_BRIDGES[2];
const deckEnds = (b: typeof north) =>
  [-1, 1].map((s) => ({
    x: b.x + b.axis.x * (b.length / 2 + 8) * s,
    z: b.z + b.axis.z * (b.length / 2 + 8) * s,
  }));
const [nw, ne] = deckEnds(north);
WILDS_PATHS[0].points.splice(6, 3, nw, ne);
const [sw, se] = deckEnds(south);
WILDS_PATHS[0].points.splice(1, 0, se, sw);
const [ow, oe] = deckEnds(outlet);
WILDS_PATHS[1].points.splice(3, 3, ow, oe);
for (const path of WILDS_PATHS) {
  const result: WildsPoint[] = [path.points[0]];
  for (let i = 1; i < path.points.length - 1; i++) {
    const p = path.points[i];
    if (WILDS_BRIDGES.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < 55))
      result.push(p);
    else
      result.push(
        ...roundedLine([path.points[i - 1], p, path.points[i + 1]], 14).slice(
          1,
          -1,
        ),
      );
  }
  result.push(path.points[path.points.length - 1]);
  path.points = result;
}

/** No waterfall drops: the full river now follows continuous grades. */
export const WILDS_FALLS: readonly WildsPoint[] = [];
/** Broad northern upland descends toward the southern lowlands. */
export function wildsUplandHeight(z: number) {
  const v = z + 500;
  return (
    10 +
    26 * (1 - smooth(130, 870, v)) +
    20 * (1 - smooth(60, 180, v)) -
    wildsSouthDescent(z)
  );
}
export const WILDS_NORTH_SEA_LEVEL = 48;
export function wildsRawHeight(x: number, z: number) {
  const p = { x, z };
  let h =
    wildsUplandHeight(z) + 1.2 * Math.sin(x * 0.016) * Math.cos(z * 0.013);
  h += 20 * Math.exp(-((x - 325) ** 2 + (z + 415) ** 2) / 16000);
  const water = wildsWater(p),
    d = water.distance;
  const bankLevel = water.height;
  const bankTarget = Math.max(h, bankLevel + 4);
  // A rounded, short cut bank: submerged bed -> waterline -> four-unit rim.
  // The lip and bed have zero cross-slope derivatives at their joins.
  const shore = water.height - 3 + 7 * smooth(-5, 6, d);
  const dryBank =
    bankLevel + 4 + (bankTarget - bankLevel - 4) * smooth(6, 42, d);
  h = d <= 6 ? shore : dryBank + (h - dryBank) * smooth(42, 100, d);
  const islandDistance = wildsLakeIslandDistance(p);
  const lake = WILDS_LANDMARKS[1];
  const lakeRadius = Math.hypot((x - lake.x) / lake.rx, (z - lake.z) / lake.rz);
  if (islandDistance <= 0 && water.distance > 0) {
    const rimBlend =
      (1 - smooth(1.05, 1.55, lakeRadius)) * smooth(0, 32, water.distance);
    h += Math.max(0, 28 - h) * rimBlend;
  }
  let clearingHeight = h,
    clearingWeight = 1,
    bridgeClearingBlend = 1;
  for (const c of WILDS_CLEARINGS) {
    const d = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
    bridgeClearingBlend = Math.min(bridgeClearingBlend, smooth(0.75, 2.4, d));
    const clearingEdge = c.z > 100 || c.name === 'Northern Meadow' ? 3.0 : 1.8;
    if (d < clearingEdge) {
      const base = Math.max(
        c.name === 'Moonlight Falls' ? 50 : wildsUplandHeight(c.z),
        wildsWaterLevel(c.z - c.rz) + 6,
      );
      const blend =
        (1 - smooth(0.95, clearingEdge, d)) * smooth(8, 24, water.distance);
      if (blend >= 1 - 1e-8) {
        clearingHeight = base;
        clearingWeight = 1;
        break;
      }
      // Normalized weights keep each flat core intact while overlapping broad
      // shoulders share the descent instead of sequentially creating ridges.
      const weight = blend / (1 - blend);
      clearingHeight += base * weight;
      clearingWeight += weight;
    }
  }
  h = clearingHeight / clearingWeight;
  if (islandDistance > 0)
    h = 9 + (WILDS_LAKE_ISLAND.height - 9) * smooth(-3, 18, islandDistance);
  if (d > 0) {
    // Clearing grading must not push dry ground below the adjacent water.
    // Compact smooth maximum avoids a hard normal seam at the minimum rim.
    // Use the continuous latitude grade inland: the nearest river segment can
    // switch at bends and must not stamp its Voronoi edges into distant terrain.
    const inlandLevel = wildsWaterLevel(z);
    const floor = bankLevel + (inlandLevel - bankLevel) * smooth(12, 70, d) + 4;
    const raised =
      Math.max(h, floor) + Math.max(2 - Math.abs(h - floor), 0) ** 2 / 8;
    h += (raised - h) * smooth(0, 6, d);
  }
  for (const b of WILDS_BRIDGES) {
    const dx = x - b.x,
      dz = z - b.z,
      along = Math.abs(dx * b.axis.x + dz * b.axis.z),
      across = Math.abs(-dx * b.axis.z + dz * b.axis.x);
    const blend =
      (1 -
        smooth(
          b.length / 2,
          b.length / 2 + (b.length > 100 ? 35 : 170),
          along,
        )) *
      (1 - smooth(5, b.length > 100 ? 24 : 100, across));
    if (water.distance > 0)
      h +=
        (b.height - h) *
        blend *
        smooth(0, 8, water.distance) *
        bridgeClearingBlend;
  }
  // Horizontal decks may grade their approaches, but cannot drag upstream
  // banks down to downstream deck elevation.
  if (d > 0) {
    const floor = bankLevel + 3.5;
    const raised =
      Math.max(h, floor) + Math.max(0.5 - Math.abs(h - floor), 0) ** 2 / 2;
    h += (raised - h) * smooth(0, 6, d) * (1 - smooth(35, 70, d));
  }
  const edge = wildsIslandDistance(p);
  const land = 1 - smooth(230, 410, z);
  const ridge =
    (48 +
      24 * Math.sin(x * 0.009 + z * 0.005) ** 2 +
      20 * Math.cos(z * 0.014 - x * 0.004) ** 2) *
    land;
  const ridgeWeight = smooth(-80, 22, edge) * (1 - smooth(55, 230, edge));
  const routeClear = smooth(8, 35, wildsPathDistance(p));
  const waterClear = smooth(6, 35, water.distance);
  let clearingClear = 1;
  for (const c of WILDS_CLEARINGS)
    clearingClear = Math.min(
      clearingClear,
      smooth(0.95, 1.6, Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz)),
    );
  h += ridge * ridgeWeight * routeClear * waterClear * clearingClear;
  // The southern valley continues beyond G instead of dropping off the old rim.
  // Outside the valley, retain the irregular coast. The mouth lowers gently into sea.
  const valley = 1 - smooth(100, 240, Math.abs(x + 40));
  const coastFade =
    smooth(-12, 40, edge) * (1 - valley) +
    smooth(WILDS_SOUTH_MOUTH_Z - 15, 900, z) * valley;
  const mountainFade = smooth(90, 245, edge);
  h += (-65 - h) * (coastFade * (1 - land) + mountainFade * land);
  return h;
}
/** Shared irregular island rim: render and movement use the same boundary. */
export function wildsIslandDistance(p: WildsPoint) {
  const angle = Math.atan2(p.z, p.x);
  const radius =
    450 /
      Math.pow(
        Math.pow(Math.abs(Math.cos(angle)), 2.5) +
          Math.pow(Math.abs(Math.sin(angle)), 2.5),
        0.4,
      ) +
    100 * Math.exp(-Math.pow((angle + 0.8) / 0.4, 2)) +
    20 * Math.exp(-Math.pow((Math.abs(angle) - 3.0) / 0.3, 2)) +
    9 * Math.sin(angle * 9) +
    7 * Math.cos(angle * 17);
  return Math.hypot(p.x, p.z) - radius;
}
let heights: Float32Array | undefined;
export function wildsHeightfield() {
  if (!heights) {
    heights = new Float32Array(513 * 513);
    for (let j = 0; j < 513; j++)
      for (let i = 0; i < 513; i++)
        heights[j * 513 + i] = wildsRawHeight(
          i * WILDS_STEP - 500,
          j * WILDS_STEP - 500,
        );
  }
  return heights;
}
export function wildsTerrainHeight(x: number, z: number) {
  const g = wildsHeightfield(),
    u = clamp((x + 500) / WILDS_STEP, 0, 511.99999),
    v = clamp((z + 500) / WILDS_STEP, 0, 511.99999),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const h00 = g[j * 513 + i],
    h10 = g[j * 513 + i + 1],
    h01 = g[(j + 1) * 513 + i],
    h11 = g[(j + 1) * 513 + i + 1];
  return a + b <= 1
    ? h00 + (h10 - h00) * a + (h01 - h00) * b
    : h11 + (h01 - h11) * (1 - a) + (h10 - h11) * (1 - b);
}
export const wildsGroundHeight = (x: number, z: number) => {
  if (Math.hypot(x - WILDS_ALTAR.x, z - WILDS_ALTAR.z) <= WILDS_ALTAR.radius)
    return Math.max(
      wildsTerrainHeight(x, z),
      wildsTerrainHeight(WILDS_ALTAR.x, WILDS_ALTAR.z) + WILDS_ALTAR.rise,
    );
  return wildsBridge({ x, z })?.height ?? wildsTerrainHeight(x, z);
};
export function wildsWalkable(p: WildsPoint, radius = 0.45) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > 470 - radius ||
    Math.abs(p.z) > 470 - radius
  )
    return false;
  if (wildsIslandDistance(p) > -radius - 6) return false;
  if (wildsBridge(p, radius)) return true;
  if (wildsWater(p).distance < radius + 1.5) return false;
  const s = 2,
    h = wildsTerrainHeight(p.x, p.z),
    slope =
      Math.max(
        Math.abs(h - wildsTerrainHeight(p.x + s, p.z)),
        Math.abs(h - wildsTerrainHeight(p.x, p.z + s)),
      ) / s;
  return slope < 0.55;
}
export type WildsProp = WildsPoint & {
  kind: 'oak' | 'willow' | 'pine' | 'rock';
  height: number;
  radius: number;
  yaw: number;
  anchor?: boolean;
};
/** Only the island landmark has tree collision; no ordinary forest is restored. */
export function wildsIconTreeObstacles(): WildsProp[] {
  const center = WILDS_LAKE_ISLAND;
  const obstacles: WildsProp[] = [
    {
      x: center.x,
      z: center.z,
      kind: 'oak',
      radius: 8.5,
      height: 122,
      yaw: 0,
      anchor: true,
    },
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 + 0.075;
    obstacles.push({
      x: center.x + Math.cos(a) * 10.5,
      z: center.z + Math.sin(a) * 10.5,
      kind: 'oak',
      radius: 1.6,
      height: 3,
      yaw: a,
    });
  }
  return obstacles;
}
export function wildsArchitectureObstacles(): WildsProp[] {
  const out: WildsProp[] = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i * Math.PI) / 3;
    for (const side of [-1, 1])
      out.push({
        x: WILDS_ALTAR.x + Math.cos(a) * 19 - Math.sin(a) * side * 5,
        z: WILDS_ALTAR.z + Math.sin(a) * 19 + Math.cos(a) * side * 5,
        radius: 1.7,
        height: 14,
        kind: 'rock',
        yaw: 0,
      });
  }
  return out;
}
const CLUSTERS = points([
  [135, 210],
  [230, 140],
  [325, 100],
  [570, 70],
  [710, 70],
  [925, 160],
  [110, 300],
  [350, 200],
  [470, 285],
  [905, 390],
  [90, 580],
  [310, 480],
  [690, 405],
  [900, 515],
  [120, 770],
  [340, 650],
  [655, 680],
  [875, 790],
  [195, 860],
  [320, 875],
  [705, 865],
  [800, 860],
  [420, 735],
  [620, 865],
]);
export const WILDS_CLUSTERS = CLUSTERS;
export const WILDS_CLUSTER_RADIUS = 49;
let props: WildsProp[] | undefined;
export function wildsProps() {
  if (props) return props;
  const result: WildsProp[] = [];
  let seed = 17291;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let tries = 0, count = 0; tries < 10000 && count < 76; tries++) {
    const p = { x: random() * 900 - 450, z: random() * 900 - 450 };
    if (
      !wildsWalkable(p, 3) ||
      wildsPathDistance(p) < 7 ||
      wildsSightlineDistance(p) < 14 ||
      WILDS_CLEARINGS.some(
        (a) => Math.hypot((p.x - a.x) / a.rx, (p.z - a.z) / a.rz) < 1,
      ) ||
      WILDS_PORTALS.some((a) => Math.hypot(p.x - a.x, p.z - a.z) < 18)
    )
      continue;
    const height = 3 + random() * 6;
    result.push({
      ...p,
      kind: 'rock',
      height,
      radius: height * 0.65,
      yaw: random() * 6.28,
    });
    count++;
  }
  const boss = WILDS_LANDMARKS.find((p) => p.name === 'Twilight Clearing')!;
  props = result.filter(
    (p) =>
      Math.hypot((p.x - boss.x) / boss.rx, (p.z - boss.z) / boss.rz) < 1.65,
  );
  return props;
}
/** Sample authored playable clearings, route shoulders and woodland footprints.
 * Open means a clearing/route outside obstructing props, not total-map empty area. */
export function wildsOpenAreaStats() {
  let total = 0,
    open = 0;
  const list = wildsProps();
  for (let z = -465; z < 465; z += 5)
    for (let x = -465; x < 465; x += 5) {
      const p = { x, z };
      if (!wildsWalkable(p)) continue;
      const clearing = WILDS_CLEARINGS.some(
          (c) => Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz) < 1,
        ),
        path = wildsPathDistance(p) < 5,
        woodland = CLUSTERS.some(
          (c) => Math.hypot(x - c.x, z - c.z) < WILDS_CLUSTER_RADIUS,
        );
      if (clearing || path || woodland) {
        total++;
        if (!list.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius + 1.8))
          open++;
      }
    }
  return {
    sampleStep: 5,
    gameplayArea: total * 25,
    openArea: open * 25,
    openFraction: open / total,
    definition:
      'Tree-free review: unblocked ground in authored gameplay zones; excludes water and inaccessible border',
  };
}
