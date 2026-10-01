import {
  WILDS_ENTRY,
  wildsProps,
  wildsArchitectureObstacles,
  wildsIconTreeObstacles,
  wildsWalkable,
  type WildsPoint,
  type WildsProp,
} from './whispering-wilds-layout.ts';
import { wildsMushrooms } from './whispering-wilds-mushroom-layout.ts';
/** Small swept steps and spatially indexed trunk/rock proxies; no visual-mesh collision. */
export class WildsNavigation {
  private cells = new Map<string, WildsProp[]>();
  constructor() {
    for (const p of [
      ...wildsProps(),
      ...wildsArchitectureObstacles(),
      ...wildsIconTreeObstacles(),
      ...wildsMushrooms(),
    ]) {
      const key = this.key(p.x, p.z),
        list = this.cells.get(key) ?? [];
      list.push(p);
      this.cells.set(key, list);
    }
  }
  private key(x: number, z: number) {
    return `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  }
  valid(p: WildsPoint, radius = 0.45) {
    if (!wildsWalkable(p, radius)) return false;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++)
        for (const b of this.cells.get(this.key(p.x + i * 16, p.z + j * 16)) ??
          [])
          if (Math.hypot(p.x - b.x, p.z - b.z) < b.radius + radius)
            return false;
    return true;
  }
  restore(p: WildsPoint): WildsPoint {
    if (this.valid(p)) return { x: p.x, z: p.z };
    if (Number.isFinite(p.x) && Number.isFinite(p.z))
      for (let r = 1; r <= 20; r++)
        for (let i = 0; i < 32; i++) {
          const q = {
            x: p.x + Math.cos((i * Math.PI) / 16) * r,
            z: p.z + Math.sin((i * Math.PI) / 16) * r,
          };
          if (this.valid(q)) return q;
        }
    return { ...WILDS_ENTRY };
  }
  move(from: WildsPoint, dx: number, dz: number, radius = 0.45) {
    const p = { x: from.x, z: from.z };
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p;
    const count = Math.ceil(Math.hypot(dx, dz) / 0.35);
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
