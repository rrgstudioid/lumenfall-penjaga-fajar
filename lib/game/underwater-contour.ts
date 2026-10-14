type Point = { x: number; z: number };
export type ContourSegment = { a: Point; b: Point };
/** Marching triangles follows the actual shelf contour, including concave bays. */
export function shelfContour(distance: (p: Point) => number, level = 18) {
  const segments: ContourSegment[] = [];
  const openings: Point[] = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    let edge = { x: 0, z: -50 };
    for (let r = 0; r < 650; r += 2) {
      const p = { x: Math.cos(angle) * r, z: -50 + Math.sin(angle) * r };
      if (distance(p) < level) edge = p;
    }
    openings.push(edge);
  }
  for (let z = -496; z < 496; z += 16)
    for (let x = -496; x < 496; x += 16) {
      const corners = [
        { x, z },
        { x: x + 16, z },
        { x: x + 16, z: z + 16 },
        { x, z: z + 16 },
      ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const crosses: Point[] = [];
        for (let i = 0; i < 3; i++) {
          const a = corners[ids[i]],
            b = corners[ids[(i + 1) % 3]];
          const da = distance(a) - level,
            db = distance(b) - level;
          if (da < 0 === db < 0) continue;
          const t = da / (da - db);
          crosses.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
        if (crosses.length !== 2) continue;
        const [a, b] = crosses;
        if (
          openings.some(
            (o) =>
              Math.hypot(o.x - (a.x + b.x) / 2, o.z - (a.z + b.z) / 2) < 22,
          )
        )
          continue;
        segments.push({ a, b });
      }
    }
  return { segments, openings };
}
