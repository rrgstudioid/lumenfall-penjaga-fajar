import * as T from 'three';

export { SANDS_MAP_SCALE, SANDS_MAP_ANCHOR, sandsWorldPoint } from './sands-coordinates.ts';

/** Clone disposable containers, retaining the GLTF primitive's material shape. */
export function cloneImportedMap(source: T.Group) {
  const map = source.clone(true);
  map.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    object.geometry = object.geometry.clone();
    // Single-material GLTF primitives usually have no geometry groups. An
    // array here would make WebGLRenderer silently skip those primitives.
    object.material = Array.isArray(object.material)
      ? object.material.map(material => material.clone())
      : object.material.clone();
  });
  return map;
}

type Point = { x: number; z: number };
type GroundTriangle = { a: T.Vector3; b: T.Vector3; c: T.Vector3; denominator: number; bridge: boolean };

/** Read-only collision data: the visible GLB is never flattened or remeshed. */
export class ImportedMapGround {
  private cells = new Map<string, GroundTriangle[]>();
  private cellSize = 2;
  readonly surfaces: T.Mesh[];

  constructor(map: T.Group, materialNames: readonly string[]) {
    this.surfaces = [];
    map.updateWorldMatrix(true, true);
    map.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some(material => materialNames.includes(material.name))) return;
      const bridge = materials.some(material => material.name === 'map_2_object1');
      this.surfaces.push(object);
      const positions = object.geometry.getAttribute('position');
      const indices = object.geometry.index;
      const count = indices?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const vertices = [0, 1, 2].map(offset => new T.Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld));
        const [a, b, c] = vertices;
        const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(denominator) < 1e-8) continue;
        const triangle = { a, b, c, denominator, bridge };
        const minX = Math.floor(Math.min(a.x, b.x, c.x) / this.cellSize);
        const maxX = Math.floor(Math.max(a.x, b.x, c.x) / this.cellSize);
        const minZ = Math.floor(Math.min(a.z, b.z, c.z) / this.cellSize);
        const maxZ = Math.floor(Math.max(a.z, b.z, c.z) / this.cellSize);
        for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${z}`;
          const cell = this.cells.get(key) ?? [];
          cell.push(triangle);
          this.cells.set(key, cell);
        }
      }
    });
  }

  heightAt(x: number, z: number): number | undefined {
    return this.heightInfoAt(x, z)?.height;
  }

  private heightInfoAt(x: number, z: number): { height: number; bridge: boolean } | undefined {
    const triangles = this.cells.get(`${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`);
    let result: { height: number; bridge: boolean } | undefined;
    for (const { a, b, c, denominator, bridge } of triangles ?? []) {
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      const y = u * a.y + v * b.y + w * c.y;
      if (result === undefined || y > result.height) result = { height: y, bridge };
    }
    return result;
  }

  nearestPoint(point: Point, fallback: Point): Point {
    if (this.heightAt(point.x, point.z) !== undefined) return { x: point.x, z: point.z };
    for (let radius = .5; radius <= 6; radius += .5) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const x = point.x + Math.cos(angle) * radius, z = point.z + Math.sin(angle) * radius;
        if (this.heightAt(x, z) !== undefined) return { x, z };
      }
    }
    return { ...fallback };
  }

  move(point: Point, dx: number, dz: number): Point {
    let x = point.x, z = point.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
    const stepX = dx / steps, stepZ = dz / steps;
    const canMove = (nextX: number, nextZ: number) => {
      const next = this.heightInfoAt(nextX, nextZ), current = this.heightInfoAt(x, z);
      // No invisible floor outside the GLB, or teleporting up/down its cliffs.
      const maxStep = next?.bridge || current?.bridge ? 8 : .14 + Math.hypot(nextX - x, nextZ - z) * 1.7;
      return next !== undefined && current !== undefined && Math.abs(next.height - current.height) <= maxStep;
    };
    for (let i = 0; i < steps; i++) {
      if (canMove(x + stepX, z + stepZ)) { x += stepX; z += stepZ; }
      else if (stepX && canMove(x + stepX, z)) x += stepX;
      else if (stepZ && canMove(x, z + stepZ)) z += stepZ;
    }
    return { x, z };
  }
}
