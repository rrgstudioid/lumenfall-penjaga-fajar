export type Point = [number, number, number]; // x, z, elevation
export type Road = {
  name: string;
  width: number;
  points: Point[];
  stairs?: boolean;
  kind: 'primary' | 'secondary' | 'alley' | 'outer';
};
export const perimeter = [
  [0, 335],
  [-150, 325],
  [-275, 245],
  [-340, 100],
  [-325, -65],
  [-270, -205],
  [-155, -330],
  [10, -375],
  [185, -345],
  [295, -240],
  [340, -60],
  [325, 115],
  [240, 270],
  [120, 330],
];
export const gateToPlaza: Point[] = [
  [0, 335, 10],
  [-85, 240, 10],
  [-120, 160, 10],
  [-110, 110, 38],
  [-20, 45, 38],
  [0, 40, 38],
];
export const plazaToCastle: Point[] = [
  [0, 40, 38],
  [90, -30, 38],
  [125, -80, 38],
  [80, -170, 82],
  [-30, -190, 82],
  [-60, -280, 128],
  [35, -270, 128],
  [35, -294, 128],
];
export const roads: Road[] = [
  { name: 'Royal approach', width: 12, points: gateToPlaza, kind: 'primary' },
  {
    name: 'Ceremonial climb',
    width: 12,
    points: plazaToCastle,
    kind: 'primary',
  },
  {
    name: 'Grand stair',
    width: 22,
    points: [
      [125, -80, 38],
      [80, -170, 82],
    ],
    kind: 'primary',
    stairs: true,
  },
  {
    name: 'Final royal stair',
    width: 18,
    points: [
      [-30, -190, 82],
      [-60, -280, 128],
    ],
    kind: 'primary',
    stairs: true,
  },
  {
    name: 'Central loop',
    width: 8,
    points: [
      [-110, 110, 38],
      [50, 110, 38],
      [180, 60, 38],
      [210, -30, 38],
      [90, -30, 38],
      [0, 20, 38],
      [-120, -35, 38],
      [-190, 25, 38],
      [-110, 110, 38],
    ],
    kind: 'secondary',
  },
  {
    name: 'Market ring',
    width: 7,
    points: [
      [-85, 240, 10],
      [30, 260, 10],
      [150, 220, 10],
      [215, 155, 10],
      [50, 110, 38],
    ],
    kind: 'secondary',
  },
  {
    name: 'Craft way',
    width: 8,
    points: [
      [0, 20, 38],
      [180, 60, 38],
      [240, 110, 38],
      [260, 205, 10],
      [150, 220, 10],
    ],
    kind: 'secondary',
  },
  {
    name: 'West ascent',
    width: 8,
    points: [
      [-190, 25, 38],
      [-250, -40, 38],
      [-220, -145, 82],
      [-100, -175, 82],
      [-30, -190, 82],
    ],
    kind: 'secondary',
  },
  {
    name: 'High gardens loop',
    width: 8,
    points: [
      [80, -170, 82],
      [195, -150, 82],
      [225, -235, 82],
      [140, -290, 128],
      [35, -270, 128],
    ],
    kind: 'secondary',
  },
  {
    name: 'Market stair',
    width: 8,
    points: [
      [30, 260, 10],
      [50, 110, 38],
    ],
    kind: 'secondary',
    stairs: true,
  },
  {
    name: 'Craft stair',
    width: 8,
    points: [
      [260, 205, 10],
      [240, 110, 38],
    ],
    kind: 'secondary',
    stairs: true,
  },
  {
    name: 'Residential stair',
    width: 8,
    points: [
      [-250, -40, 38],
      [-220, -145, 82],
    ],
    kind: 'secondary',
    stairs: true,
  },
  {
    name: 'Eastern ascent',
    width: 8,
    points: [
      [225, -235, 82],
      [140, -290, 128],
    ],
    kind: 'secondary',
    stairs: true,
  },
  {
    name: 'Forge service lane', width: 6, kind: 'secondary',
    points: [[260,205,10],[200,214,10],[200,230,10]],
  },
  {
    name: 'South approach',
    width: 10,
    points: [
      [0, 335, 10],
      [0, 420, 10],
      [80, 490, 4],
      [140, 700, 4],
    ],
    kind: 'outer',
  },
  {
    name: 'Farm road',
    width: 6,
    points: [
      [0, 420, 10],
      [-190, 450, 8],
      [-380, 400, 4],
      [-650, 550, 7],
    ],
    kind: 'outer',
  },
  {
    name: 'River road',
    width: 6,
    points: [
      [80, 490, 4],
      [330, 410, 8],
      [440, 240, 7],
      [650, 150, 8],
    ],
    kind: 'outer',
  },
  {
    name: 'River crossing',
    width: 8,
    points: [
      [365, 270, 10],
      [405, 270, 10],
      [505, 270, 10],
      [570, 210, 10],
      [650, 150, 8],
    ],
    kind: 'outer',
  },
];
export const districts = [
  { id: 'outer_gate', name: 'Gerbang Mahkota', x: 0, z: 300, tier: 1 },
  { id: 'market', name: 'Pasar Lonceng', x: 50, z: 200, tier: 1 },
  { id: 'craft', name: 'Distrik Bara', x: 200, z: 245, tier: 1 },
  {
    id: 'residential_lower',
    name: 'Permukiman Selatan',
    x: -200,
    z: 175,
    tier: 1,
  },
  { id: 'central', name: 'Alun-alun Mahkota', x: 0, z: 20, tier: 2 },
  {
    id: 'residential_upper',
    name: 'Permukiman Teras',
    x: -165,
    z: -145,
    tier: 3,
  },
  { id: 'upper_city', name: 'Teras Dewan', x: 155, z: -180, tier: 3 },
  {
    id: 'castle',
    name: 'Benteng Fajar · hero placeholder',
    x: 35,
    z: -310,
    tier: 4,
  },
];
export function inside(x: number, z: number) {
  let c = false;
  for (let i = 0, j = perimeter.length - 1; i < perimeter.length; j = i++) {
    const a = perimeter[i],
      b = perimeter[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
export function project(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)),
    );
  return {
    d: Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t),
    t,
    y: a[2] + (b[2] - a[2]) * t,
  };
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function baseHeight(x: number, z: number) {
  const contour = z + 16 * Math.sin(x * 0.008) + 7 * Math.sin(x * 0.018);
  const terrace =
    10 +
    28 * (1 - smooth(120, 145, contour)) +
    44 * (1 - smooth(-135, -100, contour)) +
    46 * (1 - smooth(-265, -230, contour));
  const cityBlend = 1 - smooth(310, 460, Math.hypot(x * 0.96, (z + 20) * 0.88));
  const outer =
    5 +
    18 * Math.pow(Math.sin(x * 0.007) * Math.cos(z * 0.006), 2) +
    38 * Math.exp(-((x + 530) ** 2 + (z + 400) ** 2) / 40000) +
    55 * Math.exp(-((x - 480) ** 2 + (z + 520) ** 2) / 60000);
  let y = outer * (1 - cityBlend) + terrace * cityBlend;
  // A real, filled royal landform under the entire courtyard (not a floating slab).
  const crown =
    1 - smooth(0, 30, Math.max(Math.abs(x - 35) - 68, Math.abs(z + 310) - 64));
  y = y * (1 - crown) + 128 * crown;
  const riverX = 410 + 45 * Math.sin(z * 0.006);
  y -= 22 * Math.exp(-(((x - riverX) / 24) ** 2));
  return y;
}
export function height(x: number, z: number) {
  const base = baseHeight(x, z);
  let best = 1e9,
    result = base;
  for (const r of roads)
    for (let i = 1; i < r.points.length; i++) {
      const p = project(x, z, r.points[i - 1], r.points[i]);
      const edge = p.d - r.width / 2;
      if (edge < 4 && p.d < best) {
        best = p.d;
        const w = 1 - smooth(0, 4, Math.max(0, edge));
        result = base * (1 - w) + p.y * w;
      }
    }
  const landing = 1 - smooth(16, 40, Math.hypot(x + 60, z + 280));
  return result * (1 - landing) + 128 * landing;
}
export function roadDistance(x: number, z: number) {
  let d = 1e9;
  for (const r of roads)
    for (let i = 1; i < r.points.length; i++)
      d = Math.min(
        d,
        project(x, z, r.points[i - 1], r.points[i]).d - r.width / 2,
      );
  return d;
}
export const pathLength = (p: Point[]) =>
  p
    .slice(1)
    .reduce((s, b, i) => s + Math.hypot(b[0] - p[i][0], b[1] - p[i][1]), 0);
