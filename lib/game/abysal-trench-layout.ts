import { ABYSAL_TRENCH_ENTRY, ABYSAL_TRENCH_GATE, DEEP_OCEAN_ID, underwaterGridCoordinate } from './underwater-regions.ts';
export { ABYSAL_TRENCH_ENTRY } from './underwater-regions.ts';

export const ABYSAL_TRENCH_PORTALS = [
  {
    x: 0,
    z: 350,
    id: 'return-deep-ocean-f1',
    name: `Kembali ke Deep Ocean · ${underwaterGridCoordinate(ABYSAL_TRENCH_GATE)}`,
    destination: DEEP_OCEAN_ID,
    yaw: 0,
  },
];

type Point = { x: number; z: number };
/** Stable spanning maze with a few loops; all hunt pockets lead back to the landing. */
export const ABYSAL_TRENCH_ARENA = { x: 60, z: -355, radius: 95 };
type Node = Point & { radius: number; id: number };
const nodes: Node[] = [];
for (let row = 0; row < 7; row++)
  for (let col = 0; col < 7; col++) {
    const p = { x: -390 + col * 130, z: 390 - row * 130 };
    if (Math.hypot(p.x - 60, p.z + 355) < 177) continue;
    nodes.push({ ...p, id: row * 7 + col, radius: 31 + ((row + col) % 3) * 3 });
  }
const byId = new Map(nodes.map((p) => [p.id, p]));
const neighbours = (p: Node) =>
  nodes.filter((q) => Math.abs(q.x - p.x) + Math.abs(q.z - p.z) === 130);
let seed = 73119;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const edges: [Node, Node][] = [],
  visited = new Set<number>([3]),
  stack = [byId.get(3)!];
while (stack.length) {
  const a = stack[stack.length - 1],
    options = neighbours(a).filter((p) => !visited.has(p.id));
  if (!options.length) {
    stack.pop();
    continue;
  }
  const b = options[Math.floor(random() * options.length)];
  edges.push([a, b]);
  visited.add(b.id);
  stack.push(b);
}
// A handful of loops provide hunting circuits while retaining maze dead ends.
for (const a of nodes)
  for (const b of neighbours(a)) {
    if (
      a.id >= b.id ||
      edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))
    )
      continue;
    if (random() < 0.12) edges.push([a, b]);
  }
const landing = { ...ABYSAL_TRENCH_ENTRY, radius: 32, id: 100 };
const gate = { x: 0, z: 350, radius: 32, id: 101 };
const mouth = { x: 60, z: -250, radius: 25, id: 102 };
const arena = { ...ABYSAL_TRENCH_ARENA, id: 103 };
edges.push(
  [gate, landing],
  [landing, byId.get(3)!],
  [byId.get(32)!, mouth],
  [mouth, arena],
);
export const ABYSAL_TRENCH_HUNT_POCKETS = nodes;
export const ABYSAL_TRENCH_PATHS = edges.map(
  ([a, b]) =>
    [
      { ...a, radius: a.id >= 100 ? a.radius : 24 },
      { ...b, radius: b.id === 103 ? 30 : b.id >= 100 ? b.radius : 24 },
    ] as const,
);
// Keep a main-route export for runtime traversal fixtures and layout review.
const parents = new Map<number, number>([[100, 100]]),
  queue = [100];
for (let i = 0; i < queue.length; i++)
  for (const [a, b] of edges) {
    const q = a.id === queue[i] ? b : b.id === queue[i] ? a : undefined;
    if (q && !parents.has(q.id)) {
      parents.set(q.id, queue[i]);
      queue.push(q.id);
    }
  }
const allNodes = new Map(
  [...nodes, landing, gate, mouth, arena].map((p) => [p.id, p]),
);
const route: Node[] = [];
let cursor = 103;
while (cursor !== 100) {
  route.push(allNodes.get(cursor)!);
  cursor = parents.get(cursor)!;
}
route.push(landing);
export const ABYSAL_TRENCH_PATH = route.reverse();
// Terrain needs exact distance only near a plate edge. Sector lookup avoids
// checking the entire maze at every vertex, collision query and minimap pixel.
const sectors = new Map<string, typeof ABYSAL_TRENCH_PATHS>();
for (const edge of ABYSAL_TRENCH_PATHS) {
  const [a, b] = edge;
  for (
    let z = Math.floor((Math.min(a.z, b.z) - 180) / 128);
    z <= Math.floor((Math.max(a.z, b.z) + 180) / 128);
    z++
  )
    for (
      let x = Math.floor((Math.min(a.x, b.x) - 180) / 128);
      x <= Math.floor((Math.max(a.x, b.x) + 180) / 128);
      x++
    ) {
      const key = `${x},${z}`,
        list = sectors.get(key) ?? [];
      list.push(edge);
      sectors.set(key, list);
    }
}
const pocketSectors = new Map<string, Node[]>();
for (const p of nodes)
  for (
    let z = Math.floor((p.z - 180) / 128);
    z <= Math.floor((p.z + 180) / 128);
    z++
  )
    for (
      let x = Math.floor((p.x - 180) / 128);
      x <= Math.floor((p.x + 180) / 128);
      x++
    ) {
      const key = `${x},${z}`,
        list = pocketSectors.get(key) ?? [];
      list.push(p);
      pocketSectors.set(key, list);
    }
const smooth = (v: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function abysalTrenchPathDistance(p: Point) {
  let distance = Math.min(
    128,
    Math.hypot(p.x - ABYSAL_TRENCH_ARENA.x, p.z - ABYSAL_TRENCH_ARENA.z) -
      ABYSAL_TRENCH_ARENA.radius,
  );
  const key = `${Math.floor(p.x / 128)},${Math.floor(p.z / 128)}`;
  for (const q of pocketSectors.get(key) ?? [])
    distance = Math.min(distance, Math.hypot(p.x - q.x, p.z - q.z) - q.radius);
  for (const [a, b] of sectors.get(key) ?? []) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
    );
    distance = Math.min(
      distance,
      Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) -
        (a.radius + (b.radius - a.radius) * t),
    );
  }
  return distance;
}
export function abysalTrenchFloorHeight(x: number, z: number) {
  const arena = smooth(
    ABYSAL_TRENCH_ARENA.radius -
      Math.hypot(x - ABYSAL_TRENCH_ARENA.x, z - ABYSAL_TRENCH_ARENA.z),
    0,
    14,
  );
  return (
    -1786 -
    14 * smooth(350 - z, 0, 170) +
    2 * arena +
    0.18 * Math.sin(x * 0.014) * Math.cos(z * 0.012)
  );
}
export const abysalTrenchRockWeight = (x: number, z: number) =>
  Math.max(
    smooth(abysalTrenchPathDistance({ x, z }), -3, 4),
    smooth(
      ABYSAL_TRENCH_ARENA.radius -
        Math.hypot(x - ABYSAL_TRENCH_ARENA.x, z - ABYSAL_TRENCH_ARENA.z),
      6,
      14,
    ),
  );
export function abysalTrenchGroundHeight(x: number, z: number) {
  const d = abysalTrenchPathDistance({ x, z });
  // Three uplifted shelves make the enclosing plates readable as fractured rock.
  const plates =
    34 * smooth(d, -3, 8) +
    26 * smooth(d, 9, 20) +
    (30 + 9 * Math.sin(x * 0.024 + z * 0.017)) * smooth(d, 25, 43);
  return abysalTrenchFloorHeight(x, z) + plates;
}
export function abysalTrenchWalkable(p: Point, radius = 0.45) {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    Math.abs(p.x) <= 500 - radius &&
    Math.abs(p.z) <= 500 - radius &&
    abysalTrenchPathDistance(p) <= -2 - radius
  );
}

export const abysalTrenchSafe = (p: { x: number; z: number }, margin = 0) =>
  Math.hypot(p.x - ABYSAL_TRENCH_ENTRY.x, p.z - ABYSAL_TRENCH_ENTRY.z) <
  60 + margin;
