import * as T from 'three';
import {
  sunkenGroundHeight,
  sunkenFloorDistance,
  sunkenPathDistance,
} from './sunken-ruins-layout.ts';

/** Continuous indexed seabed plus an inaccessible sand apron, with seam-free normals. */
export function createSunkenTerrain(
  material: T.Material,
  covered: (x: number, z: number) => boolean,
  heightAt = sunkenGroundHeight,
  distanceAt = sunkenFloorDistance,
  pathDistanceAt = sunkenPathDistance,
  rockWeight?: (x: number, z: number) => number,
) {
  const meshes: T.Mesh[] = [];
  const height = new Map<string, number>();
  const sample = (x: number, z: number) => {
    const key = `${x},${z}`;
    let value = height.get(key);
    if (value === undefined) {
      value = heightAt(x, z);
      height.set(key, value);
    }
    return value;
  };
  // Extend beyond the longest fog/camera reach so the descending seabed has no visible cut edge.
  for (let cz = -800; cz < 800; cz += 50)
    for (let cx = -800; cx < 800; cx += 50) {
      if (!covered(cx + 25, cz + 25)) continue;
      const positions: number[] = [],
        normals: number[] = [],
        colors: number[] = [],
        indices: number[] = [],
        rockWeights: number[] = [];
      for (let j = 0; j <= 20; j++)
        for (let i = 0; i <= 20; i++) {
          const x = cx + i * 2.5,
            z = cz + j * 2.5;
          positions.push(x, sample(x, z), z);
          if (rockWeight) rockWeights.push(rockWeight(x, z));
          const n = new T.Vector3(
            sample(x - 1.25, z) - sample(x + 1.25, z),
            2.5,
            sample(x, z - 1.25) - sample(x, z + 1.25),
          ).normalize();
          normals.push(n.x, n.y, n.z);
          const bank = T.MathUtils.smoothstep(distanceAt({ x, z }), -4, 85);
          const silt =
            T.MathUtils.smoothstep(pathDistanceAt({ x, z }), -15, 35) * 0.06;
          const offshore = T.MathUtils.smoothstep(
            Math.max(Math.abs(x), Math.abs(z)),
            490,
            760,
          );
          colors.push(
            (1 - silt - bank * 0.76) * (1 - offshore * 0.65),
            (1 - silt - bank * 0.54) * (1 - offshore * 0.45),
            (0.96 - silt - bank * 0.34) * (1 - offshore * 0.22),
          );
          if (i < 20 && j < 20) {
            const a = j * 21 + i;
            indices.push(a, a + 21, a + 1, a + 1, a + 21, a + 22);
          }
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      if (rockWeight)
        geometry.setAttribute(
          'sunkenRockWeight',
          new T.Float32BufferAttribute(rockWeights, 1),
        );
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, material);
      mesh.name = `Continuous sand ${cx},${cz}`;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }
  return meshes;
}
