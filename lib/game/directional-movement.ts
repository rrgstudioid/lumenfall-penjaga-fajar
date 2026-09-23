export type DirectionalMovement = {
  direction: 'input' | 'facing' | 'backward';
};
export function directionalVector(
  mode: DirectionalMovement['direction'],
  facing: { x: number; z: number },
  input?: { x: number; z: number },
) {
  const chosen =
    mode === 'input' && input && Math.hypot(input.x, input.z) > 1e-6
      ? input
      : facing;
  const length = Math.hypot(chosen.x, chosen.z);
  if (!Number.isFinite(length) || length < 1e-6) return { x: 0, z: 0 };
  const sign = mode === 'backward' ? -1 : 1;
  return { x: (sign * chosen.x) / length, z: (sign * chosen.z) / length };
}
/** Skill-owned motion shares the world's collision callback; no iframe/target/facing mutation. */
export function moveDirectional(
  distance: number,
  direction: { x: number; z: number },
  move: (x: number, z: number) => void,
) {
  if (!Number.isFinite(distance) || distance <= 0) return;
  for (let remaining = distance; remaining > 1e-8;) {
    const step = Math.min(0.25, remaining);
    move(direction.x * step, direction.z * step);
    remaining -= step;
  }
}

export function passThroughEndpoint(
  target: { x: number; z: number },
  direction: { x: number; z: number },
  distance = 1.5,
) {
  const normalized = directionalVector('facing', direction);
  return {
    x: target.x + normalized.x * Math.max(0, distance),
    z: target.z + normalized.z * Math.max(0, distance),
  };
}

/** Reuses the caller's real collision-aware move primitive and stops at the
 * last safe point when the requested endpoint cannot be reached. */
export function moveCollisionSafeTo(
  endpoint: { x: number; z: number },
  position: () => { x: number; z: number },
  move: (x: number, z: number) => void,
  maxStep = .25,
) {
  const start = position();
  let remaining = Math.hypot(endpoint.x - start.x, endpoint.z - start.z);
  while (remaining > 1e-6) {
    const before = position();
    const dx = endpoint.x - before.x;
    const dz = endpoint.z - before.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-6) break;
    const step = Math.min(Math.max(.01, maxStep), length);
    move(dx / length * step, dz / length * step);
    const after = position();
    const progressed = Math.hypot(after.x - before.x, after.z - before.z);
    if (progressed <= 1e-7) break;
    remaining = Math.hypot(endpoint.x - after.x, endpoint.z - after.z);
  }
  const end = position();
  return {
    start,
    end,
    traveled: Math.hypot(end.x - start.x, end.z - start.z),
    reached: Math.hypot(endpoint.x - end.x, endpoint.z - end.z) <= 1e-4,
  };
}
