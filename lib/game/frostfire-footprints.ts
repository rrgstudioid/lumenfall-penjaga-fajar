import { frostSurface, type FrostPoint } from './frostfire-highlands-layout.ts';
export const FOOTPRINT_LIMIT = 256,
  FOOTPRINT_LIFETIME = 45;
export type Footprint = {
  x: number;
  z: number;
  y: number;
  nx: number;
  ny: number;
  nz: number;
  yaw: number;
  side: number;
  born: number;
};
/** Distance sampling is independent from render FPS and never alters locomotion. */
export class FrostFootprints {
  readonly slots: Array<Footprint | undefined> = Array(FOOTPRINT_LIMIT);
  readonly activeSlots = new Set<number>();
  readonly expiredSlots: number[] = [];
  private cursor = 0;
  private previous: FrostPoint | undefined;
  private distance = 0;
  private side = 1;
  reset() {
    this.slots.fill(undefined);
    this.activeSlots.clear();
    this.expiredSlots.length = 0;
    this.previous = undefined;
    this.distance = 0;
    this.cursor = 0;
    this.side = 1;
  }
  update(p: FrostPoint, time: number, dt: number, walking: boolean) {
    this.expiredSlots.length = 0;
    for (const i of this.activeSlots) {
      if (time - this.slots[i]!.born >= FOOTPRINT_LIFETIME) {
        this.slots[i] = undefined;
        this.activeSlots.delete(i);
        this.expiredSlots.push(i);
      }
    }
    const from = this.previous;
    this.previous = { x: p.x, z: p.z };
    if (!from || !walking || dt <= 0) {
      this.distance = 0;
      return;
    }
    const dx = p.x - from.x,
      dz = p.z - from.z,
      len = Math.hypot(dx, dz);
    if (len < 0.0001) return;
    if (len > Math.max(2, dt * 14)) {
      this.distance = 0;
      return;
    }
    const speed = len / dt,
      spacing = 0.65 + 0.45 * Math.min(1, speed / 7.5),
      ux = dx / len,
      uz = dz / len;
    let along = spacing - this.distance;
    for (; along <= len; along += spacing) {
      const x = from.x + ux * along + uz * 0.16 * this.side,
        z = from.z + uz * along - ux * 0.16 * this.side;
      const s = frostSurface(x, z);
      if (s.kind === 'snow' || s.kind === 'packedSnow') {
        this.slots[this.cursor] = {
          x,
          z,
          y: s.height + 0.025,
          nx: s.normal.x,
          ny: s.normal.y,
          nz: s.normal.z,
          yaw: Math.atan2(ux, uz),
          side: this.side,
          born: time,
        };
        this.activeSlots.add(this.cursor);
        this.cursor = (this.cursor + 1) % FOOTPRINT_LIMIT;
      }
      this.side *= -1;
    }
    this.distance = (this.distance + len) % spacing;
  }
  opacity(print: Footprint, time: number) {
    return (
      Math.max(
        0,
        Math.min(1, (FOOTPRINT_LIFETIME - (time - print.born)) / 15),
      ) * 0.27
    );
  }
  get count() {
    return this.activeSlots.size;
  }
}
