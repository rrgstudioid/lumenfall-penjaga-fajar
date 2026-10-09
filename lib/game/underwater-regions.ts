/** Shared IDs avoid a layout/registry import cycle. */
export const DEEP_OCEAN_ID = 'deep-ocean-underwater-v1';
export const DEEP_OCEAN_ENTRY = { x: 0, z: 320 };
/** Owner-confirmed 8x8 grid: A-H west to east, 1-8 north to south. */
export const UNDERWATER_GRID_SIZE = 8;
export const DEEP_OCEAN_GATE = { x: 312.5, z: 312.5 };
export const DEEP_OCEAN_RETURN = { x: 312.5, z: 322.5 };
export const ABYSAL_TRENCH_ID = 'abysal-trench-underwater-v1';
export const ABYSAL_TRENCH_ENTRY = { x: 0, z: 320 };
export const ABYSAL_TRENCH_GATE = { x: 187.5, z: -437.5 };
export const ABYSAL_TRENCH_RETURN = { x: 187.5, z: -427.5 };
export const isUnderwaterSubmap = (id: string) =>
  id === DEEP_OCEAN_ID || id === ABYSAL_TRENCH_ID;
