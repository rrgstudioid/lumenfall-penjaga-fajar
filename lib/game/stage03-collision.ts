/** Candidate-only 2.5D collision; visual geometry is never queried. */
export type StagePoint = { x: number; z: number };
export type StageBlocker = { id: string; minY: number; maxY: number } & (
  | { kind: 'circle'; center: number[]; radius: number }
  | { kind: 'polygon'; points: number[][] }
);
export class Stage03Collision {
  readonly radius = 0.45;
  private cells = new Map<string, StageBlocker[]>();
  constructor(
    readonly blockers: StageBlocker[],
    readonly boundary: { center: number[]; radius: number },
    readonly height: (x: number, z: number) => number | undefined,
    readonly spawn: StagePoint,
  ) {
    for (const b of blockers) {
      const points =
        b.kind === 'circle'
          ? [
              [b.center[0] - b.radius, b.center[1] - b.radius],
              [b.center[0] + b.radius, b.center[1] + b.radius],
            ]
          : b.points;
      const lo = [
        Math.min(...points.map((p) => p[0])) - 0.5,
        Math.min(...points.map((p) => p[1])) - 0.5,
      ];
      const hi = [
        Math.max(...points.map((p) => p[0])) + 0.5,
        Math.max(...points.map((p) => p[1])) + 0.5,
      ];
      for (let x = Math.floor(lo[0] / 8); x <= Math.floor(hi[0] / 8); x++)
        for (let z = Math.floor(lo[1] / 8); z <= Math.floor(hi[1] / 8); z++) {
          const key = `${x},${z}`;
          const list = this.cells.get(key) ?? [];
          list.push(b);
          this.cells.set(key, list);
        }
    }
  }
  clearance(p: StagePoint, full = false): number {
    let result =
      this.boundary.radius -
      Math.hypot(p.x - this.boundary.center[0], p.z - this.boundary.center[1]);
    const y = this.height(p.x, p.z);
    if (y === undefined) return -Infinity;
    for (const b of full
      ? this.blockers
      : (this.cells.get(`${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`) ??
        [])) {
      if (y >= b.maxY || y + 2.4 <= b.minY) continue;
      if (b.kind === 'circle') {
        result = Math.min(
          result,
          Math.hypot(p.x - b.center[0], p.z - b.center[1]) - b.radius,
        );
        continue;
      }
      let inside = false,
        distance = Infinity;
      for (let i = 0, j = b.points.length - 1; i < b.points.length; j = i++) {
        const a = b.points[j],
          c = b.points[i],
          vx = c[0] - a[0],
          vz = c[1] - a[1];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / (vx * vx + vz * vz || 1),
          ),
        );
        distance = Math.min(
          distance,
          Math.hypot(p.x - a[0] - t * vx, p.z - a[1] - t * vz),
        );
        if (
          a[1] > p.z !== c[1] > p.z &&
          p.x < ((c[0] - a[0]) * (p.z - a[1])) / (c[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      result = Math.min(result, inside ? -distance : distance);
    }
    return result;
  }
  valid(p: StagePoint) {
    return (
      Number.isFinite(p.x) &&
      Number.isFinite(p.z) &&
      this.clearance(p) >= this.radius
    );
  }
  move(from: StagePoint, dx: number, dz: number): StagePoint {
    if (!this.valid(from)) return { ...this.spawn };
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { ...from };
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    let p = { ...from };
    const can = (q: StagePoint) =>
      this.valid(q) &&
      Math.abs(this.height(q.x, q.z)! - this.height(p.x, p.z)!) <=
        0.15 + Math.hypot(q.x - p.x, q.z - p.z) * 1.7;
    for (let i = 0; i < steps; i++) {
      const x = dx / steps,
        z = dz / steps,
        both = { x: p.x + x, z: p.z + z };
      if (can(both)) p = both;
      else if (x && can({ x: p.x + x, z: p.z })) p.x += x;
      else if (z && can({ x: p.x, z: p.z + z })) p.z += z;
    }
    return p;
  }
}
