// Pure coordinates are shared by server-rendered menus and the browser world.
// Keep this module independent of Three.js and its browser loading manager.
export const SANDS_MAP_SCALE = 1.5;
export const SANDS_MAP_ANCHOR = Object.freeze({ x: 0, z: 35 });
export function sandsWorldPoint(x: number, z: number) {
  return {
    x: SANDS_MAP_ANCHOR.x + (x - SANDS_MAP_ANCHOR.x) * SANDS_MAP_SCALE,
    z: SANDS_MAP_ANCHOR.z + (z - SANDS_MAP_ANCHOR.z) * SANDS_MAP_SCALE,
  };
}
