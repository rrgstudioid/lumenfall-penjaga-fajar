export const INTERFACE_STORAGE_KEY = 'lumenfall-interface-settings-v1';
export const INTERFACE_SCALE_EVENT = 'lumenfall:interface-scale';
export const DEFAULT_UI_SCALE = 100;
export const MIN_UI_SCALE = 50;
export const MAX_UI_SCALE = 150;
export const UI_SCALE_STEP = 5;

export function normalizeUIScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_UI_SCALE;
  return Math.max(MIN_UI_SCALE, Math.min(MAX_UI_SCALE, Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP));
}

export function loadUIScale(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const stored = JSON.parse(storage?.getItem(INTERFACE_STORAGE_KEY) ?? 'null');
    return stored?.version === 1 ? normalizeUIScale(stored.uiScale) : DEFAULT_UI_SCALE;
  } catch { return DEFAULT_UI_SCALE; }
}

export function saveUIScale(value: number, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(INTERFACE_STORAGE_KEY, JSON.stringify({ version: 1, uiScale: normalizeUIScale(value) })); }
  catch { /* Optional preferences must not block the game when storage is unavailable. */ }
}
