/** Owner-approved reconstruction of the reference, in world units (north = -Z). */
export const METEORFALL_ID = 'meteorfall-citadel';
export const METEORFALL_LAYOUT_VERSION = 1;
export type MeteorPoint = { x: number; z: number };
export type MeteorPlatform = MeteorPoint & {
  id: string;
  name: string;
  width: number;
  depth: number;
  y: number;
  polygon: MeteorPoint[];
};
export const METEORFALL_ENTRY = { x: 0, z: 380 };
export const METEORFALL_NPC = { x: 25, z: 375 };
export const METEORFALL_EXIT = {
  x: 0,
  z: 425,
  destination: 'jayantara',
  name: 'Jayantara',
};
export const METEORFALL_BOSS = { x: 0, z: -350, radius: 55 };
export const METEORFALL_BOUNDS = {
  minX: -500,
  maxX: 500,
  minZ: -500,
  maxZ: 500,
};
const rows: [string, string, number, number, number, number, number][] = [
  ['S', 'Arrival Bastion', 500, 855, 280, 170, 0],
  ['L', 'Lower Crossing', 500, 690, 220, 100, 8],
  ['C', 'Crucible Plaza', 500, 530, 300, 180, 16],
  ['A', 'Meteor Forecourt', 500, 350, 200, 100, 24],
  ['N', 'Citadel Crown', 500, 150, 300, 220, 40],
  ['SW', 'Ashen Reach', 155, 720, 220, 200, 4],
  ['W', 'Basalt Hunting Grounds', 200, 465, 220, 190, 16],
  ['NW', 'Rune Overlook', 170, 220, 220, 180, 24],
  ['SE', 'Cinder Terrace', 830, 790, 230, 180, 4],
  ['E', 'Ember Hunting Grounds', 800, 490, 230, 190, 16],
  ['NE', 'Impact Crater', 830, 230, 230, 190, 24],
];
export const METEORFALL_PLATFORMS: MeteorPlatform[] = rows.map(
  ([id, name, u, v, width, depth, y]) => {
    const x = u - 500,
      z = v - 500,
      a = width / 2,
      b = depth / 2,
      c = 0.15 * Math.min(width, depth);
    return {
      id,
      name,
      x,
      z,
      width,
      depth,
      y,
      polygon: [
        [-a + c, -b],
        [a - c, -b],
        [a, -b + c],
        [a, b - c],
        [a - c, b],
        [-a + c, b],
        [-a, b - c],
        [-a, -b + c],
      ].map(([dx, dz]) => ({ x: x + dx, z: z + dz })),
    };
  },
);
export const meteorPlatform = (id: string) =>
  METEORFALL_PLATFORMS.find((p) => p.id === id)!;
const cross = (a: MeteorPoint, b: MeteorPoint, c: MeteorPoint) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export function inMeteorPolygon(
  p: MeteorPoint,
  polygon: MeteorPoint[],
  tolerance = 1e-7,
) {
  return polygon.every(
    (a, i) => cross(a, polygon[(i + 1) % polygon.length], p) >= -tolerance,
  );
}
function borderDistance(p: MeteorPlatform, direction: MeteorPoint) {
  let lo = 0,
    hi = 500;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (
      inMeteorPolygon(
        { x: p.x + direction.x * m, z: p.z + direction.z * m },
        p.polygon,
      )
    )
      lo = m;
    else hi = m;
  }
  return lo;
}
export type MeteorBridge = {
  id: string;
  from: string;
  to: string;
  a: MeteorPoint;
  b: MeteorPoint;
  yA: number;
  yB: number;
  length: number;
  axis: MeteorPoint;
  clearWidth: number;
  deckWidth: number;
  polygon: MeteorPoint[];
};
export function meteorStrip(
  a: MeteorPoint,
  b: MeteorPoint,
  width: number,
): MeteorPoint[] {
  const l = Math.hypot(b.x - a.x, b.z - a.z),
    nx = ((-(b.z - a.z) / l) * width) / 2,
    nz = (((b.x - a.x) / l) * width) / 2;
  return [
    { x: a.x + nx, z: a.z + nz },
    { x: a.x - nx, z: a.z - nz },
    { x: b.x - nx, z: b.z - nz },
    { x: b.x + nx, z: b.z + nz },
  ];
}
export const METEORFALL_BRIDGES: MeteorBridge[] = [
  'S-L',
  'L-C',
  'C-A',
  'A-N',
  'S-SW',
  'SW-W',
  'W-C',
  'S-SE',
  'SE-E',
  'E-C',
  'W-NW',
  'NW-A',
  'E-NE',
  'NE-A',
].map((id, i) => {
  const [from, to] = id.split('-'),
    p = meteorPlatform(from),
    q = meteorPlatform(to),
    d = Math.hypot(q.x - p.x, q.z - p.z),
    axis = { x: (q.x - p.x) / d, z: (q.z - p.z) / d };
  const da = borderDistance(p, axis) - 20,
    db = borderDistance(q, { x: -axis.x, z: -axis.z }) - 20;
  const a = { x: p.x + axis.x * da, z: p.z + axis.z * da },
    b = { x: q.x - axis.x * db, z: q.z - axis.z * db },
    clearWidth = i < 4 ? 24 : 18;
  return {
    id,
    from,
    to,
    a,
    b,
    yA: p.y,
    yB: q.y,
    length: Math.hypot(b.x - a.x, b.z - a.z),
    axis,
    clearWidth,
    deckWidth: clearWidth + 6,
    polygon: meteorStrip(a, b, clearWidth),
  };
});
export const METEORFALL_CAUSEWAY: MeteorBridge = {
  id: 'entrance',
  from: 'S',
  to: 'entrance',
  a: { x: 0, z: 420 },
  b: { x: 0, z: 485 },
  yA: 0,
  yB: 0,
  length: 65,
  axis: { x: 0, z: 1 },
  clearWidth: 24,
  deckWidth: 30,
  polygon: meteorStrip({ x: 0, z: 420 }, { x: 0, z: 485 }, 24),
};
export const METEORFALL_DECKS = [...METEORFALL_BRIDGES, METEORFALL_CAUSEWAY];
export const METEORFALL_RAILS = METEORFALL_DECKS.flatMap((b) =>
  [-1, 1].map((side) => ({
    a: meteorBridgePoint(b, 0, side * (b.deckWidth / 2 - 0.55)),
    b: meteorBridgePoint(b, 1, side * (b.deckWidth / 2 - 0.55)),
    radius: 0.5,
  })),
);
export const METEORFALL_CHANNELS = METEORFALL_DECKS.flatMap((b) =>
  [-1, 1].map((side) => ({
    a: meteorBridgePoint(b, 0, side * (b.clearWidth / 2 + 1)),
    b: meteorBridgePoint(b, 1, side * (b.clearWidth / 2 + 1)),
    radius: 0.9,
  })),
);
export const METEORFALL_MAGMA = ['SW', 'SE', 'NW', 'NE'].map((id) => {
  const p = meteorPlatform(id);
  return { id, x: p.x + (p.x < 0 ? -62 : 62), z: p.z - 48, radius: 12 };
});
export const METEORFALL_OUTFALLS = METEORFALL_MAGMA.map((a) => {
  const p = meteorPlatform(a.id);
  return {
    a,
    b: { x: p.x + (p.x < 0 ? -p.width / 2 : p.width / 2), z: a.z },
    radius: 2,
  };
});
// Collision proxies match the perimeter pylons. The south gate stays 36 units clear.
export const METEORFALL_OBSTACLES = Array.from({ length: 12 }, (_, i) => {
  const angle = ((i + 0.5) * Math.PI) / 6;
  return {
    x: Math.sin(angle) * 95,
    z: -350 + Math.cos(angle) * 95,
    radius: 3.8,
    height: 24 + (i % 3) * 4,
  };
});
export const METEORFALL_WALLS = METEORFALL_OBSTACLES.slice(0, -1).map(
  (a, i) => ({ a, b: METEORFALL_OBSTACLES[i + 1], radius: 1.8, height: 9 }),
);
const domains = [
  ...METEORFALL_PLATFORMS.map((p) => p.polygon),
  ...METEORFALL_DECKS.map((b) => b.polygon),
];
const domainBounds = domains.map((poly) => ({
  minX: Math.min(...poly.map((p) => p.x)),
  maxX: Math.max(...poly.map((p) => p.x)),
  minZ: Math.min(...poly.map((p) => p.z)),
  maxZ: Math.max(...poly.map((p) => p.z)),
}));
function segmentDistance(p: MeteorPoint, a: MeteorPoint, b: MeteorPoint) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
/** Split polygon edges at all intersections, retaining only exposed union edges. */
const boundary = domains.flatMap((poly, pi) =>
  poly.flatMap((a, i) => {
    const b = poly[(i + 1) % poly.length],
      ts = [0, 1],
      dx = b.x - a.x,
      dz = b.z - a.z;
    domains.forEach((other, qi) => {
      if (pi === qi) return;
      other.forEach((c, j) => {
        const d = other[(j + 1) % other.length],
          ex = d.x - c.x,
          ez = d.z - c.z,
          den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-8) return;
        const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den,
          u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
      });
    });
    ts.sort((x, y) => x - y);
    const at = (t: number) => ({ x: a.x + dx * t, z: a.z + dz * t });
    return ts.slice(1).flatMap((t, j) => {
      const mid = at((ts[j] + t) / 2);
      return domains.some(
        (other, qi) => qi !== pi && inMeteorPolygon(mid, other, -1e-6),
      )
        ? []
        : [{ a: at(ts[j]), b: at(t) }];
    });
  }),
);
export function meteorWalkable(p: MeteorPoint, radius = 0.45) {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    !Number.isFinite(radius) ||
    radius < 0 ||
    !domains.some((poly, i) => {
      const b = domainBounds[i];
      return (
        p.x >= b.minX &&
        p.x <= b.maxX &&
        p.z >= b.minZ &&
        p.z <= b.maxZ &&
        inMeteorPolygon(p, poly)
      );
    })
  )
    return false;
  if (
    METEORFALL_MAGMA.some(
      (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius,
    ) ||
    METEORFALL_OBSTACLES.some(
      (o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + radius,
    )
  )
    return false;
  if (
    METEORFALL_WALLS.some(
      (o) => segmentDistance(p, o.a, o.b) < o.radius + radius,
    )
  )
    return false;
  if (
    METEORFALL_OUTFALLS.some(
      (o) => segmentDistance(p, o.a, o.b) < o.radius + radius,
    )
  )
    return false;
  if (
    METEORFALL_CHANNELS.some(
      (o) =>
        p.x >= Math.min(o.a.x, o.b.x) - radius - 1 &&
        p.x <= Math.max(o.a.x, o.b.x) + radius + 1 &&
        p.z >= Math.min(o.a.z, o.b.z) - radius - 1 &&
        p.z <= Math.max(o.a.z, o.b.z) + radius + 1 &&
        segmentDistance(p, o.a, o.b) < o.radius + radius,
    )
  )
    return false;
  if (
    METEORFALL_RAILS.some(
      (o) =>
        p.x >= Math.min(o.a.x, o.b.x) - radius - 1 &&
        p.x <= Math.max(o.a.x, o.b.x) + radius + 1 &&
        p.z >= Math.min(o.a.z, o.b.z) - radius - 1 &&
        p.z <= Math.max(o.a.z, o.b.z) + radius + 1 &&
        segmentDistance(p, o.a, o.b) < o.radius + radius,
    )
  )
    return false;
  return !boundary.some(
    (e) =>
      p.x >= Math.min(e.a.x, e.b.x) - radius &&
      p.x <= Math.max(e.a.x, e.b.x) + radius &&
      p.z >= Math.min(e.a.z, e.b.z) - radius &&
      p.z <= Math.max(e.a.z, e.b.z) + radius &&
      segmentDistance(p, e.a, e.b) < radius - 1e-7,
  );
}
export function meteorSafe(p: MeteorPoint, margin = 0) {
  const s = meteorPlatform('S');
  return (
    inMeteorPolygon(p, s.polygon) ||
    inMeteorPolygon(p, METEORFALL_CAUSEWAY.polygon) ||
    Math.hypot(p.x - s.x, p.z - s.z) < margin
  );
}
/** Undefined means void. Bridge landings blend sideways into the platform surface. */
export function meteorDesignHeight(p: MeteorPoint): number | undefined {
  const platform = METEORFALL_PLATFORMS.find((q) =>
    inMeteorPolygon(p, q.polygon),
  );
  let y = platform?.y;
  for (const b of METEORFALL_DECKS) {
    const dx = p.x - b.a.x,
      dz = p.z - b.a.z,
      t = (dx * b.axis.x + dz * b.axis.z) / b.length,
      side = Math.abs(dx * b.axis.z - dz * b.axis.x);
    if (t < -1e-7 || t > 1 + 1e-7 || side > b.deckWidth / 2 + 8) continue;
    const h = b.yA + (b.yB - b.yA) * t;
    if (side <= b.deckWidth / 2) return h;
    if (platform) {
      const blend = 1 - (side - b.deckWidth / 2) / 8;
      y = platform.y + (h - platform.y) * blend;
    }
  }
  return y;
}
/** Shared polygon clipping for rendered top cells and their exact height sampler. */
export function clipMeteorPolygon(
  poly: MeteorPoint[],
  boundary: MeteorPoint[],
) {
  let result = poly;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    const side = (p: MeteorPoint) =>
      (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    const input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length],
        dp = side(p),
        dq = side(q);
      if (dp >= -1e-7) result.push(p);
      if (dp >= 0 !== dq >= 0) {
        const t = dp / (dp - dq);
        result.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
      }
    }
  }
  return result;
}
export function meteorTopCell(p: MeteorPlatform, x: number, z: number) {
  const right = Math.min(x + 4, p.x + p.width / 2),
    bottom = Math.min(z + 4, p.z + p.depth / 2);
  return clipMeteorPolygon(
    [
      { x, z },
      { x: right, z },
      { x: right, z: bottom },
      { x, z: bottom },
    ],
    p.polygon,
  );
}
const polygonArea = (poly: MeteorPoint[]) =>
  Math.abs(
    poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return sum + p.x * q.z - q.x * p.z;
    }, 0),
  ) / 2;
/** Convex difference, returned as non-overlapping convex pieces. */
export function subtractMeteorPolygon(poly: MeteorPoint[], cut: MeteorPoint[]) {
  if (polygonArea(clipMeteorPolygon(poly, cut)) < 1e-8) return [poly];
  let inside = poly;
  const result: MeteorPoint[][] = [];
  for (let i = 0; i < cut.length && inside.length; i++) {
    const a = cut[i],
      b = cut[(i + 1) % cut.length];
    // Retain the outside piece, then continue clipping the inside remainder.
    const half = (positive: boolean) => {
      const out: MeteorPoint[] = [];
      for (let j = 0; j < inside.length; j++) {
        const p = inside[j],
          q = inside[(j + 1) % inside.length];
        const dp = cross(a, b, p) * (positive ? 1 : -1),
          dq = cross(a, b, q) * (positive ? 1 : -1);
        if (dp >= 0) out.push(p);
        if (dp >= 0 !== dq >= 0) {
          const t = dp / (dp - dq);
          out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
        }
      }
      return out;
    };
    const outside = half(false),
      next = half(true);
    if (polygonArea(outside) > 1e-8) result.push(outside);
    inside = next;
  }
  return result;
}
const surfaceBounds = (poly: MeteorPoint[]) => ({
  minX: Math.min(...poly.map((p) => p.x)),
  maxX: Math.max(...poly.map((p) => p.x)),
  minZ: Math.min(...poly.map((p) => p.z)),
  maxZ: Math.max(...poly.map((p) => p.z)),
});
const deckCuts = METEORFALL_DECKS.map((b) => {
  const poly = meteorStrip(b.a, b.b, b.deckWidth);
  return { poly, ...surfaceBounds(poly) };
});
const roadCuts = new Map(
  METEORFALL_PLATFORMS.map((p) => [
    p.id,
    METEORFALL_DECKS.filter((b) => b.from === p.id || b.to === p.id).map(
      (b) => {
        const poly = meteorStrip(p, b.from === p.id ? b.a : b.b, b.clearWidth);
        return { poly, ...surfaceBounds(poly) };
      },
    ),
  ]),
);
type MeteorTopPatch = { polygon: MeteorPoint[]; road: boolean };
const topPatchCache = new Map<string, MeteorTopPatch[]>();
/** One surface at each XZ: bridge holes and a disjoint union of roads, never overlay planes. */
export function meteorTopPatches(
  p: MeteorPlatform,
  x: number,
  z: number,
): MeteorTopPatch[] {
  const key = `${p.id}:${x}:${z}`,
    cached = topPatchCache.get(key);
  if (cached) return cached;
  const overlaps = (b: ReturnType<typeof surfaceBounds>) =>
    b.maxX > x && b.minX < x + 4 && b.maxZ > z && b.minZ < z + 4;
  let remaining = [meteorTopCell(p, x, z)].filter(
    (poly) => polygonArea(poly) > 1e-8,
  );
  for (const cut of deckCuts.filter(overlaps))
    remaining = remaining.flatMap((poly) =>
      subtractMeteorPolygon(poly, cut.poly),
    );
  const result: MeteorTopPatch[] = [];
  for (const road of (roadCuts.get(p.id) ?? []).filter(overlaps)) {
    for (const poly of remaining) {
      const intersection = clipMeteorPolygon(poly, road.poly);
      if (polygonArea(intersection) > 1e-8)
        result.push({ polygon: intersection, road: true });
    }
    remaining = remaining.flatMap((poly) =>
      subtractMeteorPolygon(poly, road.poly),
    );
  }
  result.push(...remaining.map((polygon) => ({ polygon, road: false })));
  topPatchCache.set(key, result);
  return result;
}
/** Identical partition and triangle fans to the rendered surface. */
export function meteorGroundHeight(p: MeteorPoint): number | undefined {
  for (const bridge of METEORFALL_DECKS) {
    const dx = p.x - bridge.a.x,
      dz = p.z - bridge.a.z,
      t = (dx * bridge.axis.x + dz * bridge.axis.z) / bridge.length;
    if (
      t >= -1e-7 &&
      t <= 1 + 1e-7 &&
      Math.abs(dx * bridge.axis.z - dz * bridge.axis.x) <=
        bridge.deckWidth / 2 + 1e-7
    )
      return bridge.yA + (bridge.yB - bridge.yA) * t;
  }
  const platform = METEORFALL_PLATFORMS.find((q) =>
    inMeteorPolygon(p, q.polygon),
  );
  if (!platform) return meteorDesignHeight(p);
  const minX = platform.x - platform.width / 2,
    minZ = platform.z - platform.depth / 2;
  const x = Math.min(platform.x + platform.width / 2 - 1e-8, p.x),
    z = Math.min(platform.z + platform.depth / 2 - 1e-8, p.z);
  const patches = meteorTopPatches(
    platform,
    minX + Math.floor((x - minX) / 4) * 4,
    minZ + Math.floor((z - minZ) / 4) * 4,
  );
  for (const { polygon: poly } of patches)
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = poly[0],
        b = poly[i],
        c = poly[i + 1];
      const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(den) < 1e-10) continue;
      const u = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / den,
        v = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / den,
        w = 1 - u - v;
      if (u >= -1e-7 && v >= -1e-7 && w >= -1e-7) {
        return (
          u * (meteorDesignHeight(a) ?? platform.y) +
          v * (meteorDesignHeight(b) ?? platform.y) +
          w * (meteorDesignHeight(c) ?? platform.y)
        );
      }
    }
  return meteorDesignHeight(p);
}
export function meteorBridgePoint(
  b: MeteorBridge,
  t: number,
  offset = 0,
): MeteorPoint {
  return {
    x: b.a.x + (b.b.x - b.a.x) * t - b.axis.z * offset,
    z: b.a.z + (b.b.z - b.a.z) * t + b.axis.x * offset,
  };
}
