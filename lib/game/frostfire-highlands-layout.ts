/** Permanent Frostfire replacement: open snow highlands with a mountain rim. */
export const FROSTFIRE_ID = 'frostfire-highlands';
export const FROSTFIRE_PREVIEW_ID = 'frostfire-highlands-v2';
export const FROSTFIRE_LAYOUT_VERSION = 1;
export const FROSTFIRE_SIZE = 1000;
export const FROSTFIRE_RESOLUTION = 513;
export const FROSTFIRE_STEP = 1000 / 512;
export type FrostPoint = { x: number; z: number };
export type FrostSurface = 'snow' | 'packedSnow' | 'ice' | 'rock' | 'water';
export const frostPoint = (u: number, v: number): FrostPoint => ({
  x: u - 500,
  z: v - 500,
});
export const FROSTFIRE_ENTRY = frostPoint(760, 800);
const points = (list: number[][]) => list.map(([u, v]) => frostPoint(u, v));
const coastAnchors = points([
  [155, 65],
  [295, 55],
  [355, 105],
  [510, 72],
  [650, 25],
  [805, 35],
  [935, 105],
  [957, 245],
  [920, 330],
  [964, 415],
  [944, 560],
  [913, 675],
  [948, 765],
  [880, 893],
  [769, 946],
  [665, 896],
  [560, 899],
  [433, 861],
  [324, 877],
  [229, 816],
  [151, 763],
  [177, 662],
  [107, 605],
  [135, 505],
  [72, 443],
  [104, 338],
  [63, 250],
  [105, 167],
]);
// Closed Catmull-Rom coastline retains the authored bays without polygon corners.
export const FROSTFIRE_COAST = coastAnchors.flatMap((q, i, list) => {
  const p = list[(i + list.length - 1) % list.length],
    r = list[(i + 1) % list.length],
    s = list[(i + 2) % list.length];
  return Array.from({ length: 4 }, (_, j) => {
    const t = j / 4;
    const axis = (k: 'x' | 'z') =>
      0.5 *
      (2 * q[k] +
        (-p[k] + r[k]) * t +
        (2 * p[k] - 5 * q[k] + 4 * r[k] - s[k]) * t * t +
        (-p[k] + 3 * q[k] - 3 * r[k] + s[k]) * t * t * t);
    return { x: axis('x'), z: axis('z') };
  });
});
const closedCoast = [...FROSTFIRE_COAST, FROSTFIRE_COAST[0]];
export const FROSTFIRE_PATHS = [
  {
    width: 12,
    points: points([
      [760, 800],
      [790, 720],
      [758, 653],
      [820, 589],
      [800, 515],
      [780, 435],
      [719, 347],
      [695, 299],
      [535, 278],
      [400, 241],
      [285, 201],
    ]),
  },
  {
    width: 8,
    points: points([
      [758, 653],
      [633, 637],
      [502, 675],
      [378, 649],
      [280, 575],
      [231, 483],
      [222, 383],
      [290, 319],
      [400, 241],
    ]),
  },
  {
    width: 7,
    points: points([
      [231, 483],
      [335, 466],
      [412, 406],
      [531, 378],
      [650, 364],
      [780, 435],
    ]),
  },
  {
    width: 7,
    points: points([
      [790, 720],
      [677, 768],
      [559, 751],
      [502, 675],
    ]),
  },
];
export const FROSTFIRE_LAKES = [
  // The former tall northern waterfall is now a broad, walkable frozen basin.
  {
    ...frostPoint(700, 190),
    rx: 100,
    rz: 82,
    level: 51,
    name: 'Glacier Basin',
  },
  {
    ...frostPoint(557, 408),
    rx: 90,
    rz: 63,
    level: 31,
    name: 'Mirrorfrost Lake',
  },
  {
    ...frostPoint(547, 573),
    rx: 105,
    rz: 97,
    level: 15,
    name: 'Southern Ice Valley',
  },
  {
    ...frostPoint(843, 528),
    rx: 64,
    rz: 58,
    level: 28,
    name: 'Eastern Ice Shelf',
  },
];
export const FROSTFIRE_RIVER = points([
  [545, 612],
  [566, 685],
  [535, 733],
  [538, 788],
  [495, 829],
  [483, 879],
]);
export const FROSTFIRE_GLACIERS = [
  { x: 30, z: -15, w: 74, top: 35, bottom: 15 },
  { x: 342, z: -25, w: 55, top: 46, bottom: 28 },
];
export function frostGlacierAt(p: FrostPoint, margin = 0) {
  return FROSTFIRE_GLACIERS.find(
    (f) =>
      Math.abs(p.x - f.x) < f.w / 2 + margin &&
      p.z > f.z - 34 - margin &&
      p.z < f.z + 3 + margin,
  );
}
export function frostCameraFloor(x: number, z: number) {
  // Falls now belong to the same heightfield as the surrounding land.
  return frostHeight(x, z);
}
export const FROSTFIRE_ZONES = [
  { name: 'Northern Snowfields', ...frostPoint(365, 195) },
  { name: 'Central Highlands', ...frostPoint(365, 365) },
  { name: 'Eastern Shelf', ...frostPoint(810, 685) },
  { name: 'Southern Snowfields', ...frostPoint(390, 725) },
  { name: 'Glacier Basin', ...frostPoint(700, 202) },
];
export const frostClamp = (v: number, a = 0, b = 1) =>
  Math.min(b, Math.max(a, v));
export function frostSmooth(a: number, b: number, v: number) {
  const t = frostClamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}
/** Rounded shoulders and a buried rear apron, shared by geometry and ice shading. */
export function frostGlacierProfile(x: number, z: number) {
  let lift = 0,
    crest = 0,
    ice = 0;
  for (const f of FROSTFIRE_GLACIERS) {
    const across = (x - f.x) / (f.w / 2 + 12);
    if (Math.abs(across) >= 1 || z < f.z - 66 || z > f.z + 20) continue;
    const front = f.z + 1.4 * Math.sin((x - f.x) * 0.12);
    const along = z - front;
    const shoulder = 1 - frostSmooth(0.62, 1, Math.abs(across));
    const weight =
      shoulder *
      frostSmooth(-64, -30, along) *
      (1 - frostSmooth(-12, 14, along));
    if (weight > lift) {
      lift = weight;
      crest =
        f.top -
        4 * across * across +
        0.65 * Math.sin(x * 0.19) +
        0.35 * Math.sin(x * 0.43 + z * 0.06);
    }
    ice = Math.max(
      ice,
      shoulder * frostSmooth(-46, -22, along) * (1 - frostSmooth(7, 19, along)),
    );
  }
  return { lift, crest, ice };
}
export function lineDistance(p: FrostPoint, list: FrostPoint[]) {
  let d = Infinity;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1],
      b = list[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = frostClamp(
      ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz),
    );
    d = Math.min(d, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return d;
}
export function frostCoastDistance(p: FrostPoint) {
  let inside = false;
  for (
    let i = 0, j = FROSTFIRE_COAST.length - 1;
    i < FROSTFIRE_COAST.length;
    j = i++
  ) {
    const a = FROSTFIRE_COAST[i],
      b = FROSTFIRE_COAST[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  const distance = lineDistance(p, closedCoast);
  return inside ? distance : -distance;
}
export function frostPathDistance(p: FrostPoint) {
  return Math.min(
    ...FROSTFIRE_PATHS.map(
      (path) => lineDistance(p, path.points) - path.width / 2,
    ),
  );
}
export function frostIce(p: FrostPoint) {
  let distance = Infinity,
    levelSum = 0,
    weightSum = 0;
  // Blend neighboring basins instead of switching their elevations abruptly
  // at the nearest-shore boundary (notably the 31 m / 15 m terrace).
  const include = (edge: number, elevation: number) => {
    const weight = Math.exp(-frostClamp(edge, -100, 100) / 6);
    distance = Math.min(distance, edge);
    levelSum += elevation * weight;
    weightSum += weight;
  };
  for (const l of FROSTFIRE_LAKES) {
    const edge =
      (Math.hypot((p.x - l.x) / l.rx, (p.z - l.z) / l.rz) - 1) *
      Math.min(l.rx, l.rz);
    const angle = Math.atan2((p.z - l.z) / l.rz, (p.x - l.x) / l.rx);
    const irregular =
      edge +
      (Math.sin(angle * 3 + l.rx) * 0.07 +
        Math.sin(angle * 5 + l.rz) * 0.06 +
        Math.sin(angle * 9) * 0.025) *
        Math.min(l.rx, l.rz) +
      2 * Math.sin(p.x * 0.055) * Math.sin(p.z * 0.071);
    include(irregular, l.level);
  }
  const river =
    lineDistance(p, FROSTFIRE_RIVER) - 17 - 4 * Math.sin(p.z * 0.039);
  include(river, 15 - 12 * frostSmooth(125, 382, p.z));
  return { distance, level: levelSum / weightSum };
}
// Broad, overlapping snow mountains stay on the outer rim. The interior is open.
export const FROSTFIRE_PEAKS = [
  [180, 105, 85, 57],
  [280, 90, 82, 52],
  [437, 115, 96, 66],
  [557, 85, 88, 76],
  [670, 65, 86, 82],
  [790, 72, 100, 90],
  [884, 154, 85, 65],
  [897, 244, 88, 64],
  [882, 327, 80, 57],
  [915, 420, 85, 58],
  [901, 548, 80, 48],
  [885, 635, 83, 52],
  [894, 749, 80, 56],
  [862, 835, 90, 54],
  [780, 880, 84, 43],
  [666, 857, 82, 39],
  [554, 855, 78, 35],
  [440, 818, 78, 38],
  [307, 806, 91, 48],
  [205, 715, 82, 52],
  [161, 585, 86, 48],
  [143, 482, 77, 43],
  [137, 400, 79, 47],
  [141, 269, 87, 55],
  [166, 185, 80, 49],
] as const;
function rawHeight(x: number, z: number) {
  const p = { x, z },
    v =
      z +
      500 +
      12 * Math.sin(x * 0.017) +
      7 * Math.sin(x * 0.043) +
      4 * Math.sin(x * 0.081),
    coast = frostCoastDistance(p),
    path = frostPathDistance(p);
  if (coast < -8) return -7;
  const ramp = 1 - frostSmooth(8, 48, path);
  // Widen terrace transitions only around authored crossings.
  const width = 8 + 62 * ramp;
  let y =
    8 +
    13 * (1 - frostSmooth(688 - width, 688 + width, v)) +
    15 * (1 - frostSmooth(474 - width, 474 + width, v)) +
    20 * (1 - frostSmooth(303 - width, 303 + width, v));
  y +=
    1.1 * Math.sin(x * 0.019) * Math.cos(z * 0.014) +
    0.45 * Math.sin((x + z) * 0.044);
  // A low foothill band connects the edge peaks; its inner edge fades away
  // before reaching the open snowfields, paths and lake shores.
  const rim = 1 - frostSmooth(65, 135, coast);
  let mountains = 0;
  for (const [u, w, r, h] of FROSTFIRE_PEAKS) {
    const dx = x - (u - 500),
      dz = z - (w - 500),
      a = Math.atan2(dz, dx);
    const d =
      Math.hypot(dx, dz) /
      (r * (1 + 0.1 * Math.sin(a * 3 + u) + 0.04 * Math.sin(a * 5 + w)));
    if (d < 1) {
      const ridge = 1 + 0.1 * Math.sin(a * 3 + u) * Math.sin(Math.PI * d);
      // Rounded crowns and zero-slope skirts avoid the former narrow spikes.
      mountains += h * Math.pow(1 - frostSmooth(0, 1, d), 1.35) * ridge;
    }
  }
  const foothills =
    (14 + 4 * Math.sin(x * 0.018) * Math.cos(z * 0.016)) *
    frostSmooth(8, 32, coast) *
    (1 - frostSmooth(50, 115, coast));
  y += (mountains * rim + foothills) * (1 - 0.92 * ramp);
  const ice = frostIce(p),
    blend = 1 - frostSmooth(-2, 20, ice.distance);
  y += (ice.level - y) * blend;
  y -= 0.18 * (1 - frostSmooth(0, 5, path));
  const glacier = frostGlacierProfile(x, z);
  y += Math.max(0, glacier.crest - y) * glacier.lift;
  return -7 + (y + 7) * frostSmooth(-5, 15, coast);
}
let heights: Float32Array | undefined;
export function frostHeightfield() {
  if (!heights) {
    heights = new Float32Array(513 * 513);
    for (let j = 0; j < 513; j++)
      for (let i = 0; i < 513; i++)
        heights[j * 513 + i] = rawHeight(
          i * FROSTFIRE_STEP - 500,
          j * FROSTFIRE_STEP - 500,
        );
  }
  return heights;
}
export function frostHeight(x: number, z: number) {
  const h = frostHeightfield(),
    u = frostClamp((x + 500) / FROSTFIRE_STEP, 0, 511.99999),
    v = frostClamp((z + 500) / FROSTFIRE_STEP, 0, 511.99999);
  const i = Math.floor(u),
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
export function frostSurface(
  x: number,
  z: number,
): {
  kind: FrostSurface;
  height: number;
  normal: { x: number; y: number; z: number };
} {
  const height = frostHeight(x, z),
    nx = frostHeight(x - 0.5, z) - frostHeight(x + 0.5, z),
    nz = frostHeight(x, z - 0.5) - frostHeight(x, z + 0.5),
    length = Math.hypot(nx, 1, nz);
  const kind: FrostSurface =
    frostCoastDistance({ x, z }) < 4
      ? 'water'
      : frostIce({ x, z }).distance < 0
        ? 'ice'
        : 1 / length < 0.78
          ? 'rock'
          : frostPathDistance({ x, z }) < 1
            ? 'packedSnow'
            : 'snow';
  return {
    kind,
    height,
    normal: { x: nx / length, y: 1 / length, z: nz / length },
  };
}
export function frostWalkable(p: FrostPoint, radius = 0.45) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > 497 ||
    Math.abs(p.z) > 497 ||
    frostCoastDistance(p) < 16 + radius
  )
    return false;
  if (frostGlacierAt(p, radius)) return false;
  const h = frostHeight(p.x, p.z);
  return [
    [radius + 1, 0],
    [-radius - 1, 0],
    [0, radius + 1],
    [0, -radius - 1],
  ].every(
    ([x, z]) =>
      Math.abs(frostHeight(p.x + x, p.z + z) - h) / (radius + 1) < 0.55,
  );
}
export type FrostProp = FrostPoint & {
  kind: 'fir' | 'rock';
  scale: number;
  yaw: number;
  radius: number;
};
export const FROST_PROP_GAP = 18;
/** Conservative horizontal bounds of the imported models at their runtime scale. */
export function frostPropFootprint(p: Pick<FrostProp, 'kind' | 'scale'>) {
  return (p.kind === 'fir' ? 1.92 : 0.85) * p.scale;
}
let props: FrostProp[] | undefined;
export function frostProps() {
  if (props) return props;
  props = [];
  let seed = 76321;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const candidates: (FrostPoint & { clearance: number })[] = [];
  // Jittered samples cover all snowfields, rather than a few crowded clusters.
  for (let z = -440; z <= 440; z += 24)
    for (let x = -440; x <= 440; x += 24) {
      const p = { x: x + (random() - 0.5) * 20, z: z + (random() - 0.5) * 20 };
      if (
        !frostWalkable(p, 5) ||
        frostCoastDistance(p) < 110 ||
        frostPathDistance(p) < 10 ||
        frostIce(p).distance < 22 ||
        frostSurface(p.x, p.z).kind !== 'snow' ||
        Math.hypot(p.x - FROSTFIRE_ENTRY.x, p.z - FROSTFIRE_ENTRY.z) < 28
      )
        continue;
      // Check a full 5 m footprint, including shore-facing edges of large rocks.
      if (
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6,
            edge = { x: p.x + Math.cos(a) * 5, z: p.z + Math.sin(a) * 5 };
          return (
            frostIce(edge).distance > 12 &&
            frostSurface(edge.x, edge.z).kind === 'snow'
          );
        }).every(Boolean)
      )
        candidates.push({ ...p, clearance: Infinity });
    }
  const kinds: FrostProp['kind'][] = [
    ...Array(70).fill('fir'),
    ...Array(50).fill('rock'),
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  for (const kind of kinds) {
    const scale = kind === 'fir' ? 0.8 + random() * 0.65 : 1.8 + random() * 3.2;
    const footprint = frostPropFootprint({ kind, scale });
    let best = props.length ? -1 : Math.floor(random() * candidates.length);
    let clearance = FROST_PROP_GAP;
    if (props.length)
      candidates.forEach((candidate, i) => {
        const gap = candidate.clearance - footprint;
        if (gap > clearance) {
          best = i;
          clearance = gap;
        }
      });
    if (best < 0 || !candidates.length) break;
    const p = candidates.splice(best, 1)[0];
    props.push({
      x: p.x,
      z: p.z,
      kind,
      scale,
      yaw: random() * Math.PI * 2,
      radius: kind === 'fir' ? 0.65 * scale : scale,
    });
    // Farthest-point selection fills the biggest remaining gaps naturally.
    for (const candidate of candidates)
      candidate.clearance = Math.min(
        candidate.clearance,
        Math.hypot(candidate.x - p.x, candidate.z - p.z) - footprint,
      );
  }
  return props;
}
export class FrostNavigation {
  valid(p: FrostPoint, radius = 0.45) {
    return (
      frostWalkable(p, radius) &&
      !frostProps().some(
        (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius,
      )
    );
  }
  restore(p: FrostPoint) {
    return this.valid(p) ? { x: p.x, z: p.z } : { ...FROSTFIRE_ENTRY };
  }
  move(from: FrostPoint, dx: number, dz: number, radius = 0.45) {
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
