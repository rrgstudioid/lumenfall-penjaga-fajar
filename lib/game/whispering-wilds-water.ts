import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WILDS_RESOLUTION,
  WILDS_STEP,
  WILDS_SOUTH_SEA_LEVEL,
  wildsHeightfield,
  wildsWater,
} from './whispering-wilds-layout.ts';

type Vertex = {
  x: number;
  z: number;
  y: number;
  wet: number;
  depth: number;
  flow: number;
};
/** Clip against both the shoreline and the exact authoritative terrain triangles.
 * No independent ribbons/circles, stacked surfaces, or disconnected water surfaces. */
export function buildWildsWaterGeometry(terrain?: T.BufferGeometry) {
  const heights = wildsHeightfield(),
    n = WILDS_RESOLUTION,
    vertices: Vertex[] = [];
  const addVertex = (px: number, pz: number, ground: number) => {
    const w = wildsWater({ x: px, z: pz }),
      depth = w.height - ground;
    vertices.push({
      x: px,
      z: pz,
      y: w.height,
      depth,
      wet: Math.min(
        -w.distance,
        depth - 0.04,
        w.height - WILDS_SOUTH_SEA_LEVEL - 0.005,
      ),
      flow: w.source === 'lake' ? 0 : 1,
    });
  };
  if (terrain) {
    const p = terrain.getAttribute('position');
    for (let i = 0; i < p.count; i++)
      addVertex(p.getX(i), p.getZ(i), p.getY(i));
  } else
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const px = x * WILDS_STEP - 500,
          pz = z * WILDS_STEP - 500;
        addVertex(px, pz, heights[z * n + x]);
      }
  const positions: number[] = [],
    uv: number[] = [],
    depths: number[] = [],
    flows: number[] = [];
  const interpolate = (a: Vertex, b: Vertex): Vertex => {
    const t = a.wet / (a.wet - b.wet);
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      y: a.y + (b.y - a.y) * t,
      wet: 0,
      depth: a.depth + (b.depth - a.depth) * t,
      flow: a.flow + (b.flow - a.flow) * t,
    };
  };
  function emit(a: Vertex, b: Vertex, c: Vertex) {
    const input = [a, b, c],
      polygon: Vertex[] = [];
    for (let i = 0; i < 3; i++) {
      const v = input[i],
        previous = input[(i + 2) % 3];
      if (v.wet > 0 !== previous.wet > 0)
        polygon.push(interpolate(previous, v));
      if (v.wet > 0) polygon.push(v);
    }
    for (let i = 1; i < polygon.length - 1; i++)
      for (const v of [polygon[0], polygon[i], polygon[i + 1]]) {
        positions.push(v.x, v.y, v.z);
        uv.push(v.x / 18, v.z / 18);
        depths.push(v.depth);
        flows.push(v.flow);
      }
  }
  if (terrain) {
    const indices = terrain.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
      const a = vertices[indices.getX(i)],
        b = vertices[indices.getX(i + 1)],
        c = vertices[indices.getX(i + 2)];
      if (a.wet > 0 || b.wet > 0 || c.wet > 0) emit(a, b, c);
    }
  } else
    for (let z = 0; z < n - 1; z++)
      for (let x = 0; x < n - 1; x++) {
        const a = z * n + x,
          b = a + 1,
          c = a + n,
          d = c + 1;
        if (
          vertices[a].wet <= 0 &&
          vertices[b].wet <= 0 &&
          vertices[c].wet <= 0 &&
          vertices[d].wet <= 0
        )
          continue;
        emit(vertices[a], vertices[c], vertices[b]);
        emit(vertices[b], vertices[c], vertices[d]);
      }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('waterDepth', new T.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('waterFlow', new T.Float32BufferAttribute(flows, 1));
  // Share normals at clipped triangle edges so slopes do not show faceted
  // specular triangles. Keep the established non-indexed surface contract.
  const welded = mergeVertices(geometry, 0.001);
  welded.computeVertexNormals();
  const result = welded.toNonIndexed();
  geometry.dispose();
  welded.dispose();
  result.computeBoundingSphere();
  return result;
}
