export type WindowPosition = { x: number; y: number };
export type WindowSize = { width: number; height: number };
export type LayoutScale = { scale: number };
export type ViewportSize = { width: number; height: number };
export type WindowLayout = Record<string, WindowPosition & Partial<WindowSize> & Partial<LayoutScale>>;

export const UI_LAYOUT_VERSION = 2;
export const UI_LAYOUT_STORAGE_KEY = 'lumenfall:ui-layout:v2';
export const UI_LAYOUT_RESET_EVENT = 'lumenfall:ui-layout-reset';

type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type StoredLayout = {
  version: typeof UI_LAYOUT_VERSION;
  windows: WindowLayout;
};

function validPosition(value: unknown): value is WindowPosition {
  if (!value || typeof value !== 'object') return false;
  const position = value as { x?: unknown; y?: unknown };
  return (
    typeof position.x === 'number' &&
    Number.isFinite(position.x) &&
    typeof position.y === 'number' &&
    Number.isFinite(position.y)
  );
}

function validSize(value: unknown): value is WindowSize {
  if (!value || typeof value !== 'object') return false;
  const size = value as { width?: unknown; height?: unknown };
  return (
    typeof size.width === 'number' &&
    Number.isFinite(size.width) &&
    size.width > 0 &&
    typeof size.height === 'number' &&
    Number.isFinite(size.height) &&
    size.height > 0
  );
}

function validScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function readUILayout(storage?: LayoutStorage): WindowLayout {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(UI_LAYOUT_STORAGE_KEY) ?? '{}',
    );
    if (!parsed || typeof parsed !== 'object') return {};
    const stored = parsed as Partial<StoredLayout>;
    if (stored.version !== UI_LAYOUT_VERSION || !stored.windows) return {};
    return Object.fromEntries(
      Object.entries(stored.windows).flatMap(([id, position]) => {
        if (!id || !validPosition(position)) return [];
        const layout: WindowLayout[string] = { x: Math.round(position.x), y: Math.round(position.y) };
        if (validSize(position)) {
          Object.assign(layout, {
            width: Math.round(position.width),
            height: Math.round(position.height),
          });
        }
        if (validScale(position.scale)) layout.scale = position.scale;
        return [[id, layout]];
      }),
    );
  } catch {
    return {};
  }
}

export function saveWindowScale(
  id: string,
  scale: number,
  storage?: LayoutStorage,
): void {
  if (!storage || !id || !validScale(scale)) return;
  try {
    const stored: StoredLayout = {
      version: UI_LAYOUT_VERSION,
      windows: {
        ...readUILayout(storage),
        [id]: {
          ...(readUILayout(storage)[id] ?? { x: 0, y: 0 }),
          scale,
        },
      },
    };
    storage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // UI preferences are optional and must never affect gameplay.
  }
}

export function resetUILayoutEntries(ids: string[], storage?: LayoutStorage): void {
  if (!storage || !ids.length) return;
  try {
    const current = readUILayout(storage);
    ids.forEach((id) => delete current[id]);
    storage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: UI_LAYOUT_VERSION,
      windows: current,
    } satisfies StoredLayout));
  } catch {
    // UI preferences are optional and must never affect gameplay.
  }
}

export function saveWindowPosition(
  id: string,
  position: WindowPosition,
  storage?: LayoutStorage,
): void {
  if (!storage || !id || !validPosition(position)) return;
  try {
    const stored: StoredLayout = {
      version: UI_LAYOUT_VERSION,
      windows: {
        ...readUILayout(storage),
        [id]: {
          ...readUILayout(storage)[id],
          x: Math.round(position.x),
          y: Math.round(position.y),
        },
      },
    };
    storage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // UI preferences are optional and must never affect gameplay.
  }
}

export function saveWindowSize(
  id: string,
  size: WindowSize,
  storage?: LayoutStorage,
): void {
  if (!storage || !id || !validSize(size)) return;
  try {
    const stored: StoredLayout = {
      version: UI_LAYOUT_VERSION,
      windows: {
        ...readUILayout(storage),
        [id]: {
          ...(readUILayout(storage)[id] ?? { x: 0, y: 0 }),
          width: Math.round(size.width),
          height: Math.round(size.height),
        },
      },
    };
    storage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // UI preferences are optional and must never affect gameplay.
  }
}

export function resetUILayout(storage?: LayoutStorage): void {
  if (!storage) return;
  try {
    storage.removeItem(UI_LAYOUT_STORAGE_KEY);
  } catch {
    // UI preferences are optional and must never affect gameplay.
  }
}

export function clampWindowPosition(
  position: WindowPosition,
  viewport: ViewportSize,
  windowSize: WindowSize,
  margin = 12,
  minimumVisibleHeader = 120,
): WindowPosition {
  const availableWidth = Math.max(0, viewport.width - margin * 2);
  const availableHeight = Math.max(0, viewport.height - margin * 2);
  const maxX =
    windowSize.width <= availableWidth
      ? viewport.width - windowSize.width - margin
      : Math.max(margin, viewport.width - minimumVisibleHeader - margin);
  const maxY =
    windowSize.height <= availableHeight
      ? viewport.height - windowSize.height - margin
      : Math.max(margin, viewport.height - 48 - margin);
  return {
    x: Math.round(
      Math.min(Math.max(margin, maxX), Math.max(margin, position.x)),
    ),
    y: Math.round(
      Math.min(Math.max(margin, maxY), Math.max(margin, position.y)),
    ),
  };
}

export type WindowFocusTarget = (zIndex: number) => void;

export class WindowFocusManager {
  private readonly targets = new Map<string, WindowFocusTarget>();
  private order: string[] = [];
  private readonly baseZIndex: number;

  get topZIndex(): number {
    return this.baseZIndex + Math.max(0, this.order.length - 1) * 2;
  }

  // Keep every draggable dialog in the same foreground layer as the
  // character-selection confirmation. The browser dialog primitives default
  // to z-50, which allowed HUD and tooltip stacking contexts to cover panels.
  constructor(baseZIndex = 1000) {
    this.baseZIndex = baseZIndex;
  }

  register(id: string, target: WindowFocusTarget): () => void {
    this.targets.set(id, target);
    this.order = [...this.order.filter((entry) => entry !== id), id];
    this.apply();
    return () => {
      if (this.targets.get(id) !== target) return;
      this.targets.delete(id);
      this.order = this.order.filter((entry) => entry !== id);
      this.apply();
    };
  }

  focus(id: string): void {
    if (!this.targets.has(id)) return;
    this.order = [...this.order.filter((entry) => entry !== id), id];
    this.apply();
  }

  private apply(): void {
    this.order.forEach((id, index) => {
      this.targets.get(id)?.(this.baseZIndex + index * 2);
    });
  }
}
