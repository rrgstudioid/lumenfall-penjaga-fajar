import * as T from 'three';
import {
  SUNKEN_WALL,
  SUNKEN_WALL_HEIGHT,
  sunkenGroundHeight,
  sunkenFloorDistance,
  type SunkenPoint,
} from './sunken-ruins-layout.ts';
/** Continuous limestone faces, with stratified relief rather than stacks of separate bricks. */
export function createShelfWalls(material: T.Material) {
  const sectors = new Map<string, { positions: number[]; indices: number[] }>();
  const keyAt = (p: SunkenPoint) => `${p.x.toFixed(4)},${p.z.toFixed(4)}`;
  const degree = new Map<string, number>();
  for (const s of SUNKEN_WALL.segments)
    for (const p of [s.a, s.b])
      degree.set(keyAt(p), (degree.get(keyAt(p)) ?? 0) + 1);
  const normalAt = (p: SunkenPoint) => {
    const x =
      sunkenFloorDistance({ x: p.x + 0.1, z: p.z }) -
      sunkenFloorDistance({ x: p.x - 0.1, z: p.z });
    const z =
      sunkenFloorDistance({ x: p.x, z: p.z + 0.1 }) -
      sunkenFloorDistance({ x: p.x, z: p.z - 0.1 });
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  };
  for (const { a, b } of SUNKEN_WALL.segments) {
    const key = `${Math.floor(a.x / 64)},${Math.floor(a.z / 64)}`;
    const data = sectors.get(key) ?? { positions: [], indices: [] };
    sectors.set(key, data);
    const normalA = normalAt(a),
      normalB = normalAt(b);
    const reverse = (b.z - a.z) * normalA.x - (b.x - a.x) * normalA.z < 0;
    const start = data.positions.length / 3;
    for (let row = 0; row <= 4; row++)
      for (const p of [a, b])
        for (const side of [-1, 1]) {
          const relief = 0.12 * Math.sin(p.x * 0.22 + p.z * 0.19 + row * 2);
          const width = 2.5 + relief - (row === 4 ? 0.25 : 0);
          const normal = p === a ? normalA : normalB;
          const top =
            SUNKEN_WALL_HEIGHT + 0.25 * Math.sin(p.x * 0.07 + p.z * 0.09);
          data.positions.push(
            p.x + normal.x * width * side,
            sunkenGroundHeight(p.x, p.z) - 1 + ((top + 1) * row) / 4,
            p.z + normal.z * width * side,
          );
        }
    const quad = (a: number, b: number, c: number, d: number) => {
      const order = reverse ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
      data.indices.push(...order.map((i) => start + i));
    };
    for (let r = 0; r < 4; r++) {
      const k = r * 4;
      quad(k, k + 2, k + 6, k + 4);
      quad(k + 1, k + 5, k + 7, k + 3);
    }
    quad(16, 18, 19, 17);
    if (degree.get(keyAt(a)) === 1) quad(0, 16, 17, 1);
    if (degree.get(keyAt(b)) === 1) quad(2, 3, 19, 18);
  }
  return [...sectors.entries()].map(([key, data]) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(data.positions, 3),
    );
    geometry.setAttribute(
      'color',
      new T.Float32BufferAttribute(
        new Float32Array(data.positions.length).fill(1),
        3,
      ),
    );
    geometry.setIndex(data.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `Shelf retaining wall ${key}`;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  });
}
