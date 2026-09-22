import * as T from 'three';
import type { GroundPoint } from './field-terrain.ts';

export type TreeCollider = GroundPoint & { radius: number; minY: number; maxY: number };
type GroundMove = (from: GroundPoint, dx: number, dz: number) => GroundPoint;

/** Sample only lower bark cross-sections after the final world transform.
 * Leaves, canopy bounds and upper branches never become invisible walls. */
export function createTreeTrunkCollider(tree: T.Group, groundY: number): TreeCollider {
  tree.updateWorldMatrix(true, true);
  const bounds = new T.Box3().setFromObject(tree);
  const height = bounds.max.y - bounds.min.y;
  const cuts = [.25, .65, 1.05].map(y => groundY + Math.min(y, height * .3));
  const samples: T.Vector3[] = [];
  const vertices = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  tree.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const geometry = object.geometry, positions = geometry.attributes.position, indices = geometry.index;
    if (!positions) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const groups = Array.isArray(object.material) ? geometry.groups : [{ start: 0, count: indices?.count ?? positions.count, materialIndex: 0 }];
    for (const group of groups) {
      if (!materials[group.materialIndex ?? 0]?.name.toLowerCase().includes('bark')) continue;
      for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
        for (let k = 0; k < 3; k++) vertices[k].fromBufferAttribute(positions, indices ? indices.getX(i + k) : i + k).applyMatrix4(object.matrixWorld);
        for (const y of cuts) for (let edge = 0; edge < 3; edge++) {
          const a = vertices[edge], b = vertices[(edge + 1) % 3];
          if (Math.abs(b.y - a.y) < 1e-8 || y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue;
          samples.push(new T.Vector3().lerpVectors(a, b, (y - a.y) / (b.y - a.y)));
        }
      }
    }
  });
  const center = samples.length ? new T.Box3().setFromPoints(samples).getCenter(new T.Vector3()) : tree.getWorldPosition(new T.Vector3());
  const radius = samples.length
    ? Math.max(.12, ...samples.map(p => Math.hypot(p.x - center.x, p.z - center.z))) + .025
    : Math.max(.12, height * .035);
  return { x: center.x, z: center.z, radius, minY: groundY, maxY: groundY + Math.min(height, 2.4) };
}

/** A small per-region list, swept in short steps, composed with the existing
 * ground/water/bridge resolver. No mesh raycasts or physics simulation per frame. */
export function moveWithTreeCollisions(from: GroundPoint, dx: number, dz: number, colliders: readonly TreeCollider[], moveOnGround: GroundMove, heightAt: (x: number, z: number) => number, actorRadius = .45): GroundPoint {
  if (!colliders.length) return moveOnGround(from, dx, dz);
  const skin = .002;
  const verticalOverlap = (p: GroundPoint, c: TreeCollider) => {
    const y = heightAt(p.x, p.z);
    return y < c.maxY - skin && y + 2.4 > c.minY + skin;
  };
  const overlaps = (p: GroundPoint, c: TreeCollider) => verticalOverlap(p, c) && Math.hypot(p.x - c.x, p.z - c.z) < c.radius + actorRadius - skin;
  const blocked = (p: GroundPoint) => colliders.some(c => overlaps(p, c));
  const sweepBlocked = (a: GroundPoint, b: GroundPoint) => colliders.some(c => {
    const vx = b.x - a.x, vz = b.z - a.z, lengthSq = vx * vx + vz * vz;
    const t = lengthSq ? T.MathUtils.clamp(((c.x - a.x) * vx + (c.z - a.z) * vz) / lengthSq, 0, 1) : 0;
    const closest = { x: a.x + vx * t, z: a.z + vz * t };
    // A save/load inside a newly loaded trunk must still allow outward motion.
    if (overlaps(a, c)) return Math.hypot(b.x - c.x, b.z - c.z) < Math.hypot(a.x - c.x, a.z - c.z) - skin;
    return overlaps(closest, c);
  });
  let p = { x: from.x, z: from.z };
  // Recover a character whose saved position was occupied before async trees
  // loaded. Use only exits that the existing terrain resolver can reach.
  for (let pass = 0; pass < colliders.length; pass++) {
    const collider = colliders.find(c => overlaps(p, c));
    if (!collider) break;
    let best: GroundPoint | undefined, distance = Infinity;
    const angle = Math.atan2(p.z - collider.z, p.x - collider.x);
    const radius = collider.radius + actorRadius + skin;
    for (let i = 0; i < 16; i++) {
      const a = angle + i * Math.PI / 8;
      const target = { x: collider.x + Math.cos(a) * radius, z: collider.z + Math.sin(a) * radius };
      const candidate = moveOnGround(p, target.x - p.x, target.z - p.z);
      const d = Math.hypot(candidate.x - p.x, candidate.z - p.z);
      if (!blocked(candidate) && !sweepBlocked(p, candidate) && d < distance) { best = candidate; distance = d; }
    }
    if (!best) break;
    p = best;
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15)), sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    const target = moveOnGround(p, sx, sz);
    if (!sweepBlocked(p, target)) { p = target; continue; }
    const hit = colliders.find(c => overlaps(target, c));
    const candidates: GroundPoint[] = [];
    if (hit) {
      const nx = p.x - hit.x, nz = p.z - hit.z, length = Math.hypot(nx, nz) || 1;
      const inward = Math.min(0, (sx * nx + sz * nz) / length);
      candidates.push(moveOnGround(p, sx - inward * nx / length, sz - inward * nz / length));
    }
    candidates.push(moveOnGround(p, sx, 0), moveOnGround(p, 0, sz));
    let best = p, progress = 0;
    for (const candidate of candidates) {
      const advance = (candidate.x - p.x) * sx + (candidate.z - p.z) * sz;
      if (advance > progress && !sweepBlocked(p, candidate)) { best = candidate; progress = advance; }
    }
    p = best;
  }
  return p;
}
