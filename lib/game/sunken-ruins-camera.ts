import {
  SUNKEN_OBSTACLES,
  SUNKEN_LANDMARKS,
  SUNKEN_PORTAL_SUPPORTS,
  sunkenGroundHeight,
} from './sunken-ruins-layout.ts';
export type SunkenCameraBlocker = {
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
};
type Point3 = { x: number; y: number; z: number };
export const SUNKEN_CAMERA_BLOCKERS: SunkenCameraBlocker[] = [
  ...SUNKEN_OBSTACLES.map((o) => ({
    ...o,
    minY: sunkenGroundHeight(o.x, o.z),
    maxY: sunkenGroundHeight(o.x, o.z) + o.height,
  })),
  ...SUNKEN_LANDMARKS.map((o) => ({
    ...o,
    minY: sunkenGroundHeight(o.x, o.z),
    maxY:
      sunkenGroundHeight(o.x, o.z) +
      o.scale * (o.name === 'broken_pillar' ? 3.6 : 5),
  })),
  ...SUNKEN_PORTAL_SUPPORTS.map((o) => ({
    ...o,
    minY: sunkenGroundHeight(o.x, o.z),
    maxY: sunkenGroundHeight(o.x, o.z) + 8,
  })),
];
/** Segment/cylinder test, no raycasts against coral, fish or render meshes. */
export function sunkenCameraDistance(
  focus: Point3,
  desired: Point3,
  blockers: readonly SunkenCameraBlocker[] = SUNKEN_CAMERA_BLOCKERS,
  heightAt = sunkenGroundHeight,
) {
  const dx = desired.x - focus.x,
    dy = desired.y - focus.y,
    dz = desired.z - focus.z,
    length = Math.hypot(dx, dy, dz),
    a = dx * dx + dz * dz;
  let allowed = length;
  if (a < 1e-8) return allowed;
  for (const o of blockers) {
    const x = focus.x - o.x,
      z = focus.z - o.z,
      r = o.radius + 0.2;
    if (Math.abs(x) > length + r || Math.abs(z) > length + r) continue;
    const b = x * dx + z * dz,
      discriminant = b * b - a * (x * x + z * z - r * r);
    if (discriminant < 0) continue;
    const root = Math.sqrt(discriminant);
    let enter = (-b - root) / a,
      exit = (-b + root) / a;
    if (Math.abs(dy) > 1e-8) {
      const y1 = (o.minY - focus.y) / dy,
        y2 = (o.maxY - focus.y) / dy;
      enter = Math.max(enter, Math.min(y1, y2));
      exit = Math.min(exit, Math.max(y1, y2));
    } else if (focus.y < o.minY || focus.y > o.maxY) continue;
    if (enter <= exit && exit >= 0 && enter <= 1)
      allowed = Math.min(
        allowed,
        Math.max(0.4, Math.max(0, enter) * length - 0.35),
      );
  }
  // Keep camera orbits above the visible seabed, including the descending slope.
  const steps = Math.ceil(allowed / 0.75);
  for (let i = 1; i <= steps; i++) {
    const distance = (allowed * i) / steps,
      t = distance / length;
    if (
      focus.y + dy * t <
      heightAt(focus.x + dx * t, focus.z + dz * t) + 0.25
    ) {
      allowed = Math.max(0.4, distance - 0.8);
      break;
    }
  }
  return allowed;
}
