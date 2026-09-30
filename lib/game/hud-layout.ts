import {
  clampWindowPosition,
  type WindowPosition,
  type WindowSize,
  type ViewportSize,
} from './ui-layout.ts';

export const HUD_LAYOUT_KEY = 'lumenfall:hud-layout:v1';
export const HUD_RESET_EVENT = 'lumenfall:hud-reset';
export const HUD_IDS = [
  'player',
  'quest',
  'right',
  'chat',
  'hotbar',
  'buff',
  'fps',
] as const;
export type HUDId = (typeof HUD_IDS)[number];
export type HUDAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
export const HUD_ANCHORS: Record<HUDId, HUDAnchor> = {
  player: 'top-left',
  quest: 'top-left',
  right: 'top-right',
  chat: 'bottom-left',
  hotbar: 'bottom-center',
  buff: 'bottom-right',
  fps: 'bottom-left',
};
export type HUDPlacement = { anchor: HUDAnchor; dx: number; dy: number };
export type HUDLayout = {
  version: 1;
  positions: Partial<Record<HUDId, HUDPlacement>>;
  chatSize: WindowSize;
  scales: Partial<Record<HUDId, number>>;
};
export type HUDRect = WindowPosition & WindowSize & { scale: number };
export const defaultHUDLayout = (): HUDLayout => ({
  version: 1,
  positions: {},
  scales: {},
  chatSize: { width: 454, height: 226 },
});
export function normalizeChatSize(size: WindowSize): WindowSize {
  return {
    width: Math.max(340, Math.min(640, size.width)),
    height: Math.max(180, Math.min(420, size.height)),
  };
}
export type HUDCorner = 'nw' | 'ne' | 'sw' | 'se';
/** Keep the opposite corner fixed, fit full bounds, and scale icon panels uniformly. */
export function resizeHUDRect(
  origin: HUDRect,
  delta: { x: number; y: number },
  corner: HUDCorner,
  viewport: ViewportSize,
  baseScale: number,
  chat = false,
): HUDRect {
  const west = corner.includes('w'),
    north = corner.includes('n');
  const sx = west ? -1 : 1,
    sy = north ? -1 : 1;
  const fixedX = origin.x + (west ? origin.width : 0);
  const fixedY = origin.y + (north ? origin.height : 0);
  const margin = hudMargin(viewport);
  const availableWidth = Math.max(
    1,
    west ? fixedX - margin : viewport.width - margin - fixedX,
  );
  const availableHeight = Math.max(
    1,
    north
      ? fixedY - margin
      : viewport.height - hudBottomClearance(baseScale) - fixedY,
  );
  let width: number,
    height: number,
    scale = origin.scale;
  if (chat) {
    const size = normalizeChatSize({
      width: (origin.width + sx * delta.x) / scale,
      height: (origin.height + sy * delta.y) / scale,
    });
    width = Math.min(size.width * scale, availableWidth);
    height = Math.min(size.height * scale, availableHeight);
  } else {
    const w = origin.width / origin.scale,
      h = origin.height / origin.scale;
    const requested =
      origin.scale + (sx * delta.x * w + sy * delta.y * h) / (w * w + h * h);
    scale = Math.min(
      Math.max(baseScale * 0.5, requested),
      baseScale * 1.8,
      availableWidth / w,
      availableHeight / h,
    );
    width = w * scale;
    height = h * scale;
  }
  return {
    x: fixedX - (west ? width : 0),
    y: fixedY - (north ? height : 0),
    width,
    height,
    scale,
  };
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface HUDLayoutPersistence {
  load(scope?: string): HUDLayout;
  save(layout: HUDLayout, scope?: string): void;
  reset(scope?: string): void;
}
export function createHUDLayoutPersistence(
  storage?: StorageLike,
): HUDLayoutPersistence {
  const key = (scope?: string) =>
    scope ? `${HUD_LAYOUT_KEY}:${encodeURIComponent(scope)}` : HUD_LAYOUT_KEY;
  return {
    load(scope) {
      const fallback = defaultHUDLayout();
      try {
        const raw = JSON.parse(storage?.getItem(key(scope)) ?? 'null');
        if (raw?.version !== 1) return fallback;
        for (const id of HUD_IDS) {
          const scale = raw.scales?.[id];
          if (Number.isFinite(scale))
            fallback.scales[id] = Math.max(0.5, Math.min(1.8, scale));
          const p = raw.positions?.[id];
          if (
            p?.anchor === HUD_ANCHORS[id] &&
            Number.isFinite(p.dx) &&
            Number.isFinite(p.dy) &&
            Math.abs(p.dx) <= 2 &&
            Math.abs(p.dy) <= 2
          )
            fallback.positions[id] = { anchor: p.anchor, dx: p.dx, dy: p.dy };
        }
        if (
          Number.isFinite(raw.chatSize?.width) &&
          Number.isFinite(raw.chatSize?.height)
        )
          fallback.chatSize = normalizeChatSize(raw.chatSize);
        return fallback;
      } catch {
        return fallback;
      }
    },
    save(layout, scope) {
      try {
        storage?.setItem(key(scope), JSON.stringify(layout));
      } catch {
        /* Optional device preference. */
      }
    },
    reset(scope) {
      try {
        storage?.removeItem(key(scope));
      } catch {
        /* Keep the session reset. */
      }
    },
  };
}
export function hudMargin(viewport: ViewportSize) {
  return Math.min(34, Math.max(8, viewport.width * (34 / 1920)));
}
export function hudBottomClearance(uiScale: number) {
  return Math.max(32, 20 + 24 * uiScale);
}
/** The reference is a desktop composition. Compact it uniformly on smaller screens,
 * without altering the player's UI-scale preference or growing it on ultrawide. */
export function hudViewportScale(viewport: ViewportSize) {
  return Math.min(1, viewport.width / 1920, viewport.height / 1080);
}
function anchorOrigin(
  anchor: HUDAnchor,
  viewport: ViewportSize,
  size: WindowSize,
  margin: number,
): WindowPosition {
  return {
    x: anchor.endsWith('right')
      ? viewport.width - margin - size.width
      : anchor.endsWith('center')
        ? (viewport.width - size.width) / 2
        : margin,
    y: anchor.startsWith('bottom')
      ? viewport.height - margin - size.height
      : margin,
  };
}
export function normalizeHUDPosition(
  id: HUDId,
  position: WindowPosition,
  viewport: ViewportSize,
  size: WindowSize,
): HUDPlacement {
  const margin = hudMargin(viewport),
    anchor = HUD_ANCHORS[id],
    origin = anchorOrigin(anchor, viewport, size, margin);
  return {
    anchor,
    dx: (position.x - origin.x) / Math.max(1, viewport.width - margin * 2),
    dy: (position.y - origin.y) / Math.max(1, viewport.height - margin * 2),
  };
}
export function hudOverlaps(
  a: WindowPosition & WindowSize,
  b: WindowPosition & WindowSize,
  gap = 16,
) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}
/** Sizes are unscaled CSS pixels; positions and collision bounds are visual viewport pixels. */
export function resolveHUDLayout(
  viewport: ViewportSize,
  uiScale: number,
  layout: HUDLayout,
  buffCount = 1,
  chatCollapsed = false,
): Record<HUDId, HUDRect> {
  uiScale *= hudViewportScale(viewport);
  const margin = hudMargin(viewport),
    width = Math.max(1, viewport.width - margin * 2),
    bottom = hudBottomClearance(uiScale),
    height = Math.max(1, viewport.height - margin - bottom);
  const sizes: Record<HUDId, WindowSize> = {
    fps: { width: 112, height: 28 },
    player: { width: 396, height: 120 },
    quest: { width: 300, height: 274 },
    right: { width: 260, height: 444 },
    chat: chatCollapsed ? { width: 300, height: 44 } : layout.chatSize,
    hotbar: { width: 1140, height: 156 },
    buff: {
      width:
        Math.min(4, Math.max(1, buffCount)) * 172 +
        Math.max(0, Math.min(4, buffCount) - 1) * 8,
      height:
        Math.max(1, Math.ceil(buffCount / 4)) * 96 +
        Math.max(0, Math.ceil(buffCount / 4) - 1) * 8,
    },
  };
  const result = {} as Record<HUDId, HUDRect>;
  for (const id of HUD_IDS) {
    const size = sizes[id],
      scale = Math.min(
        uiScale * (layout.scales?.[id] ?? 1),
        width / size.width,
        height / size.height,
      );
    const visual = { width: size.width * scale, height: size.height * scale };
    const origin = anchorOrigin(HUD_ANCHORS[id], viewport, visual, margin),
      saved = layout.positions[id];
    const position = saved
      ? {
          x: origin.x + saved.dx * width,
          y: origin.y + saved.dy * Math.max(1, viewport.height - margin * 2),
        }
      : {
          x: origin.x,
          y:
            id === 'quest'
              ? margin +
                120 *
                  Math.min(
                    uiScale * (layout.scales?.player ?? 1),
                    width / 396,
                    height / 120,
                  ) +
                24 * uiScale
              : id === 'chat'
                ? viewport.height - 60 * uiScale - visual.height
                : id === 'hotbar'
                  ? viewport.height -
                    Math.max(bottom, 60 * uiScale) -
                    visual.height
                  : id === 'buff'
                    ? viewport.height - 96 * uiScale - visual.height
                    : origin.y,
        };
    result[id] = {
      ...clampWindowPosition(
        position,
        { ...viewport, height: viewport.height - bottom + margin },
        visual,
        margin,
      ),
      ...visual,
      scale,
    };
  }
  // At reference width the bottom row shares space with the chat. Keep the
  // combat cluster centered when there is room; otherwise place it beside chat.
  // Large UI scales fall back to docking chat above, without changing preferences.
  if (!layout.positions.hotbar && !layout.positions.chat && !chatCollapsed) {
    const besideChat = result.chat.x + result.chat.width + 26 * uiScale;
    const rightLimit = result.buff.x - 56 * uiScale;
    if (besideChat + result.hotbar.width <= rightLimit)
      result.hotbar.x = Math.max(result.hotbar.x, besideChat);
  }
  for (const id of ['chat', 'buff'] as const) {
    if (!layout.positions[id] && hudOverlaps(result[id], result.hotbar))
      result[id].y = Math.max(margin, result.hotbar.y - result[id].height - 16);
  }
  if (!layout.positions.quest && !layout.positions.player)
    result.quest.y = result.player.y + result.player.height + 24 * uiScale;
  // At large user scales an expanded chat and the taller quest frame share the
  // left column. Fit chat uniformly into the remaining gap without saving it.
  if (
    !chatCollapsed &&
    !layout.positions.chat &&
    !layout.positions.quest &&
    result.chat.y < result.quest.y + 96 &&
    result.chat.x < result.quest.x + result.quest.width
  ) {
    const availableHeight = result.hotbar.y - 16 - (result.quest.y + 96);
    if (availableHeight > 0) {
      const fit = Math.min(1, availableHeight / result.chat.height);
      result.chat.width *= fit;
      result.chat.height *= fit;
      result.chat.scale *= fit;
      result.chat.y = result.hotbar.y - 16 - result.chat.height;
    }
  }
  // Until explicitly moved, FPS follows the resolved chat position and size.
  if (!layout.positions.fps) {
    const fps = result.fps, chat = result.chat;
    const above = chat.y - fps.height - 8 * uiScale;
    Object.assign(fps, clampWindowPosition(
      above >= margin ? { x: chat.x, y: above } : { x: chat.x + chat.width + 8, y: chat.y },
      { ...viewport, height: viewport.height - bottom + margin }, fps, margin,
    ));
  }
  if (!layout.positions.quest) {
    const limit =
      result.chat.x < result.quest.x + result.quest.width
        ? Math.min(result.chat.y - 16, !layout.positions.fps ? result.fps.y - 8 : result.chat.y - 16)
        : viewport.height - 48;
    result.quest.height = Math.max(
      80,
      Math.min(result.quest.height, limit - result.quest.y),
    );
    result.quest.y = Math.max(
      margin,
      Math.min(result.quest.y, viewport.height - 48 - result.quest.height),
    );
  }
  return result;
}
