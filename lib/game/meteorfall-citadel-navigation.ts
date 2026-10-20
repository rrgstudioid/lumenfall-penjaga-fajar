import {
  METEORFALL_ENTRY,
  METEORFALL_PLATFORMS,
  METEORFALL_BRIDGES,
  METEORFALL_MAGMA,
  METEORFALL_OBSTACLES,
  meteorWalkable,
  type MeteorPoint,
} from "./meteorfall-citadel-layout.ts";
const distance = (a: MeteorPoint, b: MeteorPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);
/** Deterministic visibility/portal graph. No world-size grid or per-frame path search. */
export class MeteorfallNavigation {
  valid = meteorWalkable;
  restore(p: MeteorPoint, lastSafe?: MeteorPoint): MeteorPoint {
    return {
      ...(this.valid(p)
        ? p
        : lastSafe && this.valid(lastSafe)
          ? lastSafe
          : METEORFALL_ENTRY),
    };
  }
  move(from: MeteorPoint, dx: number, dz: number, radius = 0.45): MeteorPoint {
    if (!Number.isFinite(dx + dz)) return { ...from };
    const p = this.valid(from, radius) ? { ...from } : this.restore(from),
      n = Math.ceil(Math.hypot(dx, dz) / 0.3);
    for (let i = 0; i < n; i++) {
      const x = p.x + dx / n,
        z = p.z + dz / n;
      if (this.valid({ x, z }, radius)) {
        p.x = x;
        p.z = z;
      } else if (this.valid({ x, z: p.z }, radius)) p.x = x;
      else if (this.valid({ x: p.x, z }, radius)) p.z = z;
    }
    return p;
  }
  clear(a: MeteorPoint, b: MeteorPoint, radius = 0.55) {
    const n = Math.ceil(distance(a, b) / 0.75);
    for (let i = 0; i <= n; i++)
      if (
        !this.valid(
          {
            x: a.x + ((b.x - a.x) * i) / (n || 1),
            z: a.z + ((b.z - a.z) * i) / (n || 1),
          },
          radius,
        )
      )
        return false;
    return true;
  }
  private graphs = new Map<
    number,
    { nodes: MeteorPoint[]; edges: { to: number; cost: number }[][] }
  >();
  clearCache() {
    this.graphs.clear();
  }
  private graph(radius: number) {
    const key = Math.ceil(radius * 10) / 10,
      cached = this.graphs.get(key);
    if (cached) return cached;
    const nodes: MeteorPoint[] = [
      METEORFALL_ENTRY,
      ...METEORFALL_PLATFORMS.map((p) => ({ x: p.x, z: p.z })),
      ...METEORFALL_BRIDGES.flatMap((b) => [b.a, b.b]),
    ].filter((p) => this.valid(p, key));
    const edges: { to: number; cost: number }[][] = nodes.map(() => []);
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const cost = distance(nodes[i], nodes[j]);
        if (cost < 360 && this.clear(nodes[i], nodes[j], key)) {
          edges[i].push({ to: j, cost });
          edges[j].push({ to: i, cost });
        }
      }
    const graph = { nodes, edges };
    this.graphs.set(key, graph);
    return graph;
  }
  route(from: MeteorPoint, to: MeteorPoint, radius = 0.55): MeteorPoint[] {
    if (!this.valid(from, radius) || !this.valid(to, radius)) return [];
    if (this.clear(from, to, radius)) return [{ ...to }];
    const base = this.graph(radius),
      local = [...METEORFALL_MAGMA, ...METEORFALL_OBSTACLES]
        .filter(
          (o) => Math.min(distance(o, from), distance(o, to)) < o.radius + 32,
        )
        .flatMap((o) =>
          Array.from({ length: 12 }, (_, i) => ({
            x: o.x + Math.cos((i * Math.PI) / 6) * (o.radius + radius + 2),
            z: o.z + Math.sin((i * Math.PI) / 6) * (o.radius + radius + 2),
          })),
        )
        .filter((p) => this.valid(p, radius));
    const nodes = [...base.nodes, ...local, from, to],
      start = nodes.length - 2,
      end = start + 1,
      edges = base.edges.map((a) => a.slice());
    edges.push(...Array.from({ length: local.length + 2 }, () => []));
    for (let i = base.nodes.length; i < nodes.length; i++)
      for (let j = 0; j < i; j++)
        if (this.clear(nodes[i], nodes[j], radius)) {
          const cost = distance(nodes[i], nodes[j]);
          edges[i].push({ to: j, cost });
          edges[j].push({ to: i, cost });
        }
    const costs = nodes.map(() => Infinity),
      parents = nodes.map(() => -1),
      open = new Set([start]);
    costs[start] = 0;
    while (open.size) {
      const current = [...open].reduce((a, b) =>
        costs[a] + distance(nodes[a], to) < costs[b] + distance(nodes[b], to)
          ? a
          : b,
      );
      open.delete(current);
      if (current === end) break;
      for (const e of edges[current])
        if (costs[current] + e.cost < costs[e.to]) {
          costs[e.to] = costs[current] + e.cost;
          parents[e.to] = current;
          open.add(e.to);
        }
    }
    if (parents[end] < 0) return [];
    const out: MeteorPoint[] = [];
    for (let i = end; i !== start; i = parents[i]) out.push({ ...nodes[i] });
    out.reverse();
    // Visibility smoothing is bounded by the small graph path, not the world area.
    const smooth: MeteorPoint[] = [];
    let anchor = from;
    for (let i = 0; i < out.length;) {
      let j = out.length - 1;
      while (j > i && !this.clear(anchor, out[j], radius)) j--;
      smooth.push(out[j]);
      anchor = out[j];
      i = j + 1;
    }
    return smooth;
  }
}
