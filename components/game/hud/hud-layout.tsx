'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Grip } from 'lucide-react';
import { INTERFACE_SCALE_EVENT } from '@/lib/game/interface-settings';
import { clampWindowPosition } from '@/lib/game/ui-layout';
import {
  createHUDLayoutPersistence,
  defaultHUDLayout,
  resolveHUDLayout,
  normalizeHUDPosition,
  normalizeChatSize,
  resizeHUDRect,
  type HUDCorner,
  HUD_RESET_EVENT,
  hudMargin,
  hudBottomClearance,
  hudViewportScale,
  type HUDId,
  type HUDLayout,
  type HUDRect,
} from '@/lib/game/hud-layout';
import { useWindowPointerGesture } from '@/hooks/use-window-pointer-gesture';

type LayoutContext = {
  layout: HUDLayout;
  rects: Record<HUDId, HUDRect>;
  viewport: { width: number; height: number };
  ready: boolean;
  scale: number;
  update: (next: HUDLayout) => void;
  focused: HUDId | null;
  focus: (id: HUDId) => void;
  draggable: boolean;
  onInteraction: (active: boolean) => void;
};
const Context = createContext<LayoutContext | null>(null);
export function HUDLayoutProvider({
  buffCount,
  draggable,
  onInteraction,
  chatCollapsed,
  children,
}: {
  buffCount: number;
  draggable: boolean;
  onInteraction: (active: boolean) => void;
  chatCollapsed: boolean;
  children: ReactNode;
}) {
  const [layout, setLayout] = useState(defaultHUDLayout),
    [ready, setReady] = useState(false);
  const [focused, focus] = useState<HUDId | null>(null);
  const [environment, setEnvironment] = useState({
    viewport: { width: 1920, height: 1080 },
    scale: 1,
  });
  const persistence = useMemo(
    () =>
      createHUDLayoutPersistence(
        typeof window !== 'undefined'
          ? (() => {
              try {
                return window.localStorage;
              } catch {
                return undefined;
              }
            })()
          : undefined,
      ),
    [],
  );
  // Restore device preferences and measure the browser before revealing the HUD.
  /* oxlint-disable react/react-compiler */
  useLayoutEffect(() => {
    setLayout(persistence.load());
    const measure = () => {
      document.documentElement.style.setProperty(
        '--hud-viewport-scale',
        String(
          hudViewportScale({
            width: window.innerWidth,
            height: window.innerHeight,
          }),
        ),
      );
      setEnvironment({
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scale:
          Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              '--lumenfall-ui-scale',
            ),
          ) || 1,
      });
    };
    measure();
    setReady(true);
    const reset = () => {
      window.dispatchEvent(new Event('lumenfall:hud-cancel'));
      persistence.reset();
      setLayout(defaultHUDLayout());
    };
    window.addEventListener('resize', measure);
    window.addEventListener(INTERFACE_SCALE_EVENT, measure);
    window.addEventListener(HUD_RESET_EVENT, reset);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener(INTERFACE_SCALE_EVENT, measure);
      window.removeEventListener(HUD_RESET_EVENT, reset);
    };
  }, [persistence]);
  /* oxlint-enable react/react-compiler */
  const update = useCallback(
    (next: HUDLayout) => {
      setLayout(next);
      persistence.save(next);
    },
    [persistence],
  );
  const rects = resolveHUDLayout(
    environment.viewport,
    environment.scale,
    layout,
    buffCount,
    chatCollapsed,
  );
  return (
    <Context.Provider
      value={{
        layout,
        rects,
        viewport: environment.viewport,
        scale: environment.scale,
        ready,
        update,
        focused,
        focus,
        draggable,
        onInteraction,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function HUDFrame({
  id,
  label,
  children,
  className = '',
  resizable = true,
}: {
  id: HUDId;
  label: string;
  children: ReactNode;
  className?: string;
  resizable?: boolean;
}) {
  const context = useContext(Context);
  if (!context) throw new Error('HUDFrame requires HUDLayoutProvider');
  return (
    <HUDFrameBody
      id={id}
      label={label}
      className={className}
      resizable={resizable}
      context={context}
    >
      {children}
    </HUDFrameBody>
  );
}
function HUDFrameBody({
  id,
  label,
  children,
  className,
  resizable,
  context,
}: {
  id: HUDId;
  label: string;
  children: ReactNode;
  className: string;
  resizable: boolean;
  context: LayoutContext;
}) {
  const element = useRef<HTMLDivElement>(null),
    finalRect = useRef<HUDRect | null>(null);
  const corner = useRef<HUDCorner>('se');
  const { rects, viewport, layout, ready, update } = context,
    rect = rects[id];
  const paint = (value: HUDRect) => {
    if (!element.current) return;
    element.current.style.left = `${value.x}px`;
    element.current.style.top = `${value.y}px`;
    element.current.style.width = `${value.width / value.scale}px`;
    element.current.style.height = `${value.height / value.scale}px`;
    element.current.style.scale = String(value.scale);
  };
  const begin = useWindowPointerGesture(element, {
    enabled: context.draggable,
    start: (resize) => {
      if (resize)
        document.body.setAttribute('data-hud-resizing', corner.current);
      context.onInteraction(true);
      const bounds = element.current?.getBoundingClientRect();
      const origin = bounds
        ? {
            ...rect,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          }
        : { ...rect };
      finalRect.current = origin;
      context.focus(id);
      element.current?.setAttribute('data-hud-gesture', 'true');
      return origin;
    },
    move: (origin, delta, resize) => {
      if (resize) {
        const next = resizeHUDRect(
          origin,
          delta,
          corner.current,
          viewport,
          context.scale * hudViewportScale(viewport),
          id === 'chat',
        );
        finalRect.current = next;
        paint(next);
        return;
      }
      const size = resize
        ? normalizeChatSize({
            width: origin.width / origin.scale + delta.x / origin.scale,
            height: origin.height / origin.scale + delta.y / origin.scale,
          })
        : {
            width: origin.width / origin.scale,
            height: origin.height / origin.scale,
          };
      const margin = hudMargin(viewport);
      const visual = {
        width: Math.min(
          size.width * origin.scale,
          viewport.width - margin - (resize ? origin.x : margin),
        ),
        height: Math.min(
          size.height * origin.scale,
          viewport.height -
            hudBottomClearance(context.scale * hudViewportScale(viewport)) -
            (resize ? origin.y : margin),
        ),
      };
      const next = {
        ...origin,
        ...visual,
        ...clampWindowPosition(
          {
            x: origin.x + (resize ? 0 : delta.x),
            y: origin.y + (resize ? 0 : delta.y),
          },
          {
            ...viewport,
            height:
              viewport.height -
              hudBottomClearance(context.scale * hudViewportScale(viewport)) +
              margin,
          },
          visual,
          margin,
        ),
      };
      finalRect.current = next;
      paint(next);
    },
    finish: (origin, cancelled, moved, resize) => {
      document.body.removeAttribute('data-hud-resizing');
      context.onInteraction(false);
      element.current?.removeAttribute('data-hud-gesture');
      if (cancelled || !moved || !finalRect.current) {
        paint(origin);
        return;
      }
      const next = finalRect.current;
      update({
        ...layout,
        positions: {
          ...layout.positions,
          [id]: normalizeHUDPosition(id, next, viewport, next),
        },
        scales:
          resize && id !== 'chat'
            ? {
                ...layout.scales,
                [id]: next.scale / (context.scale * hudViewportScale(viewport)),
              }
            : layout.scales,
        chatSize:
          resize && id === 'chat'
            ? normalizeChatSize({
                width: next.width / next.scale,
                height: next.height / next.scale,
              })
            : layout.chatSize,
      });
    },
  });
  useEffect(() => {
    if (!context.draggable)
      window.dispatchEvent(new Event('lumenfall:hud-cancel'));
  }, [context.draggable]);
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    corner.current = event.currentTarget.dataset.corner as HUDCorner;
    begin(event, true);
  };
  return (
    <div
      ref={element}
      data-hud-id={id}
      className={`hud-frame ${className}`}
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.width / rect.scale,
          height: rect.height / rect.scale,
          scale: rect.scale,
          visibility: ready ? undefined : 'hidden',
          zIndex: context.focused === id ? 2 : undefined,
        } as CSSProperties
      }
    >
      {children}
      {context.draggable && (
        <button
          type="button"
          className="hud-grip"
          aria-label={`Geser ${label}`}
          onPointerDown={(event) => begin(event)}
        >
          <Grip size={14} />
        </button>
      )}
      {id === 'quest' && (
        <>
          <i className="hud-panel-jewel" aria-hidden="true" />
          <i
            className="hud-panel-jewel hud-panel-jewel-bottom"
            aria-hidden="true"
          />
        </>
      )}
      {context.draggable && (
        <button
          type="button"
          className="hud-frame-handle"
          aria-label={`Tarik panel ${label}`}
          onPointerDown={(event) => begin(event)}
        />
      )}
      {context.draggable &&
        resizable &&
        !className.includes('hud-empty-buffs') &&
        (['nw', 'ne', 'sw', 'se'] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            className="hud-resize-handle"
            data-corner={direction}
            aria-label={
              id === 'chat' && direction === 'se'
                ? 'Ubah ukuran chat'
                : `Ubah ukuran ${label} ${direction}`
            }
            onPointerDown={beginResize}
          />
        ))}
    </div>
  );
}
