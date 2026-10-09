import {
  SUNKEN_ENTRY,
  sunkenWalkable,
  type SunkenPoint,
} from './sunken-ruins-layout.ts';
/** Swept horizontal collision, matching the existing large-field move contract. */
export class SunkenNavigation {
  constructor(
    private readonly walkable: typeof sunkenWalkable = sunkenWalkable,
    private readonly entry: SunkenPoint = SUNKEN_ENTRY,
  ) {}
  valid(p: SunkenPoint, radius = 0.45) {
    return this.walkable(p, radius);
  }
  restore(p: SunkenPoint): SunkenPoint {
    if (this.valid(p)) return { x: p.x, z: p.z };
    if (Number.isFinite(p.x) && Number.isFinite(p.z))
      for (let r = 1; r <= 24; r++)
        for (let i = 0; i < 32; i++) {
          const q = {
            x: p.x + Math.cos((i * Math.PI) / 16) * r,
            z: p.z + Math.sin((i * Math.PI) / 16) * r,
          };
          if (this.valid(q)) return q;
        }
    return { ...this.entry };
  }
  move(from: SunkenPoint, dx: number, dz: number, radius = 0.45): SunkenPoint {
    const p = { ...from };
    if (!Number.isFinite(dx + dz)) return p;
    const count = Math.ceil(Math.hypot(dx, dz) / 0.3);
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
  clear(from: SunkenPoint, to: SunkenPoint, radius = 0.55) {
    // Small coral colonies also obstruct routes; sample finer than their solid diameter.
    const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5);
    for (let i = 0; i <= n; i++)
      if (
        !this.valid(
          {
            x: from.x + ((to.x - from.x) * i) / (n || 1),
            z: from.z + ((to.z - from.z) * i) / (n || 1),
          },
          radius,
        )
      )
        return false;
    return true;
  }
  /** Bounded local A* for fixture combatants' existing 20-unit home leash. */
  route(from: SunkenPoint, to: SunkenPoint, radius = 0.55): SunkenPoint[] {
    if (this.clear(from, to, radius)) return [{ ...to }];
    const step = 2,
      key = (x: number, z: number) => `${x},${z}`;
    const open = [{ x: 0, z: 0, g: 0, f: 0 }],
      cost = new Map([[key(0, 0), 0]]),
      parent = new Map<string, string>();
    let best = key(0, 0),
      distance = Infinity;
    for (let visited = 0; open.length && visited < 1600; visited++) {
      open.sort((a, b) => a.f - b.f);
      const c = open.shift()!,
        id = key(c.x, c.z),
        p = { x: from.x + c.x * step, z: from.z + c.z * step };
      const d = Math.hypot(p.x - to.x, p.z - to.z);
      if (d < distance) {
        distance = d;
        best = id;
      }
      if (d < 3 && this.clear(p, to, radius)) {
        best = id;
        break;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const x = c.x + dx,
          z = c.z + dz,
          q = { x: from.x + x * step, z: from.z + z * step },
          g = c.g + Math.hypot(dx, dz) * step,
          k = key(x, z);
        if (
          Math.abs(x) > 28 ||
          Math.abs(z) > 28 ||
          g >= (cost.get(k) ?? Infinity) ||
          !this.clear(p, q, radius)
        )
          continue;
        cost.set(k, g);
        parent.set(k, id);
        open.push({ x, z, g, f: g + Math.hypot(q.x - to.x, q.z - to.z) });
      }
    }
    const out: SunkenPoint[] = [];
    let id = best;
    while (parent.has(id)) {
      const [x, z] = id.split(',').map(Number);
      out.push({ x: from.x + x * step, z: from.z + z * step });
      id = parent.get(id)!;
    }
    out.reverse();
    if (out.length && this.clear(out.at(-1)!, to, radius)) out.push({ ...to });
    return out;
  }
}
