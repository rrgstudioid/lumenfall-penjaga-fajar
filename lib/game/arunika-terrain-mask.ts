import { insideBoundary, segmentDistance, terrainHeight, terrainPathDistance, type FieldTerrain } from './field-terrain.ts';

const smooth = (a: number, b: number, x: number) => {
  const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};
function hash(x: number, z: number) {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(0, 1, x - ix), v = smooth(0, 1, z - iz);
  return (hash(ix, iz) * (1-u) + hash(ix+1, iz) * u) * (1-v)
    + (hash(ix, iz+1) * (1-u) + hash(ix+1, iz+1) * u) * v;
}

/** A small, cached surface mask, not geometry or navigation data. R=rock, G=road, B=macro. */
export function buildArunikaTerrainMask(terrain: FieldTerrain, size = 512) {
  const minX = Math.min(...terrain.boundary.map(p => p.x)), minZ = Math.min(...terrain.boundary.map(p => p.z));
  const width = Math.max(...terrain.boundary.map(p => p.x)) - minX;
  const depth = Math.max(...terrain.boundary.map(p => p.z)) - minZ;
  const data = new Uint8Array(size * size * 4), scores = new Float32Array(size * size);
  const eligible: number[] = [], inside = new Uint8Array(size * size);
  const rocks = terrain.props.filter(p => p.kind === 'rock');
  let area = 0;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const i = z * size + x, px = minX + (x + .5) / size * width, pz = minZ + (z + .5) / size * depth;
    const point = { x: px, z: pz }, path = terrainPathDistance(terrain, point);
    const macro = noise(px * .037 + 17, pz * .037 - 9) * .62
      + noise(px * .095 - 31, pz * .095 + 13) * .26 + noise(px * .24, pz * .24) * .12;
    // Same two-unit road half-width as the existing renderer; only soften its visual edge.
    const road = 1 - smooth(1.65, 2.35, path);
    const shoulder = smooth(2.35, 3.4, path) * (1 - smooth(4, 8, path));
    const height = terrainHeight(terrain, px, pz, false);
    const slope = Math.hypot(terrainHeight(terrain, px + .6, pz, false) - height,
      terrainHeight(terrain, px, pz + .6, false) - height) / .6;
    let rockProximity = 0, cliffDistance = Infinity;
    for (const rock of rocks) rockProximity = Math.max(rockProximity, 1 - smooth(rock.radius + 1, rock.radius + 6, Math.hypot(px-rock.x, pz-rock.z)));
    for (let j = 0; j < terrain.boundary.length; j++) cliffDistance = Math.min(cliffDistance,
      segmentDistance(point, terrain.boundary[j], terrain.boundary[(j+1) % terrain.boundary.length]));
    const score = macro + shoulder * .13 + rockProximity * .18
      + (1 - smooth(2, 9, cliffDistance)) * .16 + Math.min(.1, slope * .3) + smooth(3, 9, height) * .025;
    scores[i] = score;
    data[i*4+1] = Math.round(road * 255);
    data[i*4+2] = Math.round(macro * 255);
    data[i*4+3] = 255;
    if (insideBoundary(terrain, point)) {
      inside[i] = 1; area++;
      if (road < .01 && path > 2.6) eligible.push(score);
    }
  }
  // Coverage is spatial area, NOT a cap on layer opacity: patch interiors reach 100%.
  eligible.sort((a, b) => a - b);
  const threshold = eligible[Math.max(0, eligible.length - Math.round(area * .28))] ?? 1;
  let rockArea = 0, roadArea = 0, transitionArea = 0;
  for (let i = 0; i < scores.length; i++) {
    const road = data[i*4+1] / 255;
    const rocky = smooth(threshold - .045, threshold + .045, scores[i]) * (1 - smooth(0, .15, road));
    data[i*4] = Math.round(rocky * 255);
    if (inside[i]) {
      if (road > .5) roadArea++;
      else if (rocky > .5) rockArea++;
      else if (rocky > .03) transitionArea++;
    }
  }
  return { data, size, bounds: [minX, minZ, 1 / width, 1 / depth] as const,
    coverage: { rocky: rockArea / area, road: roadArea / area, transition: transitionArea / area,
      grass: 1 - (rockArea + roadArea + transitionArea) / area } };
}
