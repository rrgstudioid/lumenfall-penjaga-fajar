/** Shared IDs avoid a layout/registry import cycle. */
export const DEEP_OCEAN_ID = 'deep-ocean-underwater-v1';
export const DEEP_OCEAN_ENTRY = { x: 0, z: 320 };
/** 8x8 cells, using Verdant's axes: A-H north to south, 1-8 west to east. */
export const UNDERWATER_GRID_SIZE = 8;
export function underwaterGridCoordinate(point: { x: number; z: number }) {
  const cell = (value: number) =>
    Math.max(
      0,
      Math.min(
        UNDERWATER_GRID_SIZE - 1,
        Math.floor(((value + 500) * UNDERWATER_GRID_SIZE) / 1000),
      ),
    );
  return `${String.fromCharCode(65 + cell(point.z))}${cell(point.x) + 1}`;
}
export const DEEP_OCEAN_GATE = { x: 312.5, z: 312.5 };
export const DEEP_OCEAN_RETURN = { x: 312.5, z: 322.5 };
export const ABYSAL_TRENCH_ID = 'abysal-trench-underwater-v1';
export const ABYSAL_TRENCH_ENTRY = { x: 0, z: 320 };
export const ABYSAL_TRENCH_GATE = { x: 187.5, z: -437.5 };
export const ABYSAL_TRENCH_RETURN = { x: 187.5, z: -427.5 };
export const isUnderwaterSubmap = (id: string) =>
  id === DEEP_OCEAN_ID || id === ABYSAL_TRENCH_ID;
