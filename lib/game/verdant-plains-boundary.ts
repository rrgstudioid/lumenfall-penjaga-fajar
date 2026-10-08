/** Positive on the meadow side of the visible escarpment's foot. */
export function plainsBoundaryClearance(x: number, z: number) {
  const qx = Math.abs(x) - 453;
  const qz = Math.abs(z) - 453;
  const rounded = 38 - Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
    - Math.min(Math.max(qx, qz), 0);
  const folds = 2.8 * Math.sin(x * 0.021 + z * 0.015)
    + 1.8 * Math.sin(z * 0.063 - x * 0.041);
  return rounded - folds;
}

/** Same contour for clipping terrain pixels and grass roots behind the rock. */
export const PLAINS_BOUNDARY_GLSL = `
float plainsBoundaryClearance(vec2 p) {
  vec2 q=abs(p)-vec2(453.0);
  float rounded=38.0-length(max(q,vec2(0.0)))-min(max(q.x,q.y),0.0);
  float folds=2.8*sin(p.x*.021+p.y*.015)+1.8*sin(p.y*.063-p.x*.041);
  return rounded-folds;
}
`;

/** Shared contour for collision and rock geometry, including rounded corners. */
export function plainsBoundaryPoint(angle: number, clearance = 0) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  let low = 0, high = 1200;
  for (let i = 0; i < 24; i++) {
    const radius = (low + high) / 2;
    if (plainsBoundaryClearance(dx * radius, dz * radius) > clearance)
      low = radius;
    else high = radius;
  }
  const radius = (low + high) / 2;
  return { x: dx * radius, z: dz * radius };
}

export function plainsBoundaryWalkable(x: number, z: number, radius: number) {
  // Account for the small fold gradient when offsetting a circular actor.
  const distance = plainsBoundaryClearance(x, z);
  if (distance < radius) return false;
  if (distance > radius + 0.3) return true;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    if (plainsBoundaryClearance(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) < 0)
      return false;
  }
  return true;
}
