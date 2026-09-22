'use client';
import { JobText } from './job-presentation-context';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  canDrop,
  type DragSource,
  type DropTarget,
} from '@/lib/game/drag-drop';
import { resolvePrimaryHotbarEntry, isQuickHotbarId } from '@/lib/game/hotbar';
import { dragPreviewPosition } from '@/lib/game/drag-geometry';
import { INTERFACE_SCALE_EVENT } from '@/lib/game/interface-settings';
import { ALL_PASSIVES, ALL_SKILLS } from '@/lib/game/skills';
import { RARITY_META, type EquipSlot } from '@/lib/game/items';
import type { Game } from '@/lib/game/world';
import { EntryIcon, ItemIcon } from './entry-icon';
import { SkillIcon } from './skill-icon';

type Point = { x: number; y: number };
type Session = {
  source: DragSource;
  element: HTMLElement;
  pointerId: number;
  origin: Point;
  position: Point;
  sourcePosition: Point;
  width: number;
  height: number;
  heroId: string;
  active: boolean;
  capture: boolean;
};
type DragContext = {
  begin: (event: ReactPointerEvent<HTMLElement>, source: DragSource) => void;
  isDragging: boolean;
};
const Context = createContext<DragContext>({
  begin: () => {},
  isDragging: false,
});
export const useGameDrag = () => useContext(Context);
const subscribeToMount = () => () => {};

/** Keep the one hotbar above binding windows without duplicating it or changing layout. */
export function HotbarLayer({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  return mounted ? createPortal(children, document.body) : null;
}

function destinationAt(
  x: number,
  y: number,
): { target: DropTarget; element: HTMLElement | null } {
  const hit = document.elementFromPoint(x, y);
  const slot = hit?.closest<HTMLElement>('[data-drop-type]');
  if (slot) {
    if (slot.dataset.dropType === 'equipment')
      return {
        target: { type: 'equipment', slot: slot.dataset.dropSlot as EquipSlot, expectedId: slot.dataset.dropItem || null },
        element: slot,
      };
    if (slot.dataset.dropType === 'hotbar')
      return {
        target: {
          type: 'hotbar',
          slot: isQuickHotbarId(slot.dataset.dropSlot)
            ? slot.dataset.dropSlot
            : Number(slot.dataset.dropSlot),
        },
        element: slot,
      };
    if (slot.dataset.dropType === 'inventory')
      return {
        target: {
          type: 'inventory',
          slot: Number(slot.dataset.dropSlot),
          expectedId: slot.dataset.dropItem || null,
        },
        element: slot,
      };
  }
  const background =
    !!hit &&
    (hit.matches('html, body, .game-shell, [data-slot="dialog-overlay"]') ||
      !!hit.closest('[data-world-surface]'));
  return { target: { type: background ? 'empty' : 'invalid' }, element: null };
}

function sourceMoved(current: Session): boolean {
  const rect = current.element.getBoundingClientRect();
  return (
    Math.abs(rect.left - current.sourcePosition.x) > 1 ||
    Math.abs(rect.top - current.sourcePosition.y) > 1 ||
    Math.abs(rect.width - current.width) > 1 ||
    Math.abs(rect.height - current.height) > 1
  );
}

export function GameDragDropProvider({
  game,
  children,
}: {
  game: Game | null;
  children: ReactNode;
}) {
  const session = useRef<Session | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const targetElement = useRef<HTMLElement | null>(null);
  const suppressClickUntil = useRef(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState<{
    source: DragSource;
    position: Point;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const clearHighlight = useCallback(() => {
    targetElement.current?.removeAttribute('data-drop-feedback');
    targetElement.current = null;
  }, []);

  const placePreview = useCallback(() => {
    const current = session.current;
    const ghost = overlay.current;
    if (!current?.active || !ghost) return;
    const position = dragPreviewPosition(
      current.position,
      { width: window.innerWidth, height: window.innerHeight },
      ghost.getBoundingClientRect(),
    );
    ghost.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }, []);

  useLayoutEffect(() => {
    const ghost = overlay.current;
    if (!preview || !ghost) return;
    // A fast second drag may reuse the preview while its previous fade is ending.
    ghost.style.opacity = '1';
    ghost.style.transition = 'none';
    placePreview();
    const observer = new ResizeObserver(placePreview);
    observer.observe(ghost);
    return () => observer.disconnect();
  }, [preview, placePreview]);

  const finish = useCallback(
    (intentional: boolean, point?: Point) => {
      const current = session.current;
      if (!current) return;
      session.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      const validSource =
        game &&
        current.heroId === game.hero.slotId &&
        current.element.isConnected &&
        !sourceMoved(current);
      const destination = point
        ? destinationAt(point.x, point.y)
        : { target: { type: 'invalid' } as DropTarget };
      let applied = false;
      let message = 'Drag dibatalkan.';
      if (intentional && current.active && validSource && game) {
        const validation = canDrop(
          game.hero,
          current.source,
          destination.target,
          game.hotbarEditMode,
        );
        message = validation.reason;
        applied =
          validation.ok &&
          game.commitUIDrop(current.source, destination.target);
        if (!applied) game.message(message);
      }
      clearHighlight();
      current.element.removeAttribute('data-dragging');
      document.body.removeAttribute('data-game-dragging');
      document.body.removeAttribute('data-game-drag-pending');
      game?.setHotbarInteraction(false);
      try {
        if (
          current.capture &&
          current.element.hasPointerCapture?.(current.pointerId)
        )
          current.element.releasePointerCapture(current.pointerId);
      } catch {
        // The source can unmount or lose capture while a menu is closing.
      }
      if (!current.active) return;
      suppressClickUntil.current = performance.now() + 350;
      setAnnouncement(message);
      const ghost = overlay.current;
      if (ghost) {
        ghost.style.transition =
          'transform 180ms ease-out, opacity 140ms ease-out';
        ghost.style.opacity = '0';
        if (!applied)
          ghost.style.transform = `translate3d(${current.sourcePosition.x}px, ${current.sourcePosition.y}px, 0)`;
      }
      finishTimer.current = setTimeout(() => setPreview(null), 190);
    },
    [clearHighlight, game],
  );

  const begin = useCallback(
    (event: ReactPointerEvent<HTMLElement>, source: DragSource) => {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        !game?.started ||
        (source.dragType === 'hotbar-binding' && !game.hotbarEditMode) ||
        game.dead ||
        session.current ||
        document.querySelector('[role="alertdialog"]')
      )
        return;
      event.stopPropagation();
      if (finishTimer.current) clearTimeout(finishTimer.current);
      setPreview(null);
      const rect = event.currentTarget.getBoundingClientRect();
      session.current = {
        source,
        element: event.currentTarget,
        pointerId: event.pointerId,
        origin: { x: event.clientX, y: event.clientY },
        position: { x: event.clientX, y: event.clientY },
        sourcePosition: { x: rect.left, y: rect.top },
        width: rect.width,
        height: rect.height,
        heroId: game.hero.slotId,
        active: false,
        capture: false,
      };
      document.body.setAttribute('data-game-drag-pending', 'true');
    },
    [game],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (
        !current.element.isConnected ||
        current.heroId !== game?.hero.slotId ||
        sourceMoved(current)
      ) {
        finish(false);
        return;
      }
      current.position = { x: event.clientX, y: event.clientY };
      if (
        !current.active &&
        Math.hypot(
          event.clientX - current.origin.x,
          event.clientY - current.origin.y,
        ) < 6
      )
        return;
      if (!current.active) {
        current.active = true;
        current.element.setAttribute('data-dragging', 'true');
        document.body.setAttribute('data-game-dragging', 'true');
        game?.setHotbarInteraction(true);
        try {
          current.element.setPointerCapture(event.pointerId);
          current.capture = true;
        } catch {
          /* Window listeners still own cancellation. */
        }
        setPreview({ source: current.source, position: current.position });
      }
      event.preventDefault();
      event.stopPropagation();
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (!session.current || !game) return;
        const { x, y } = session.current.position;
        const destination = destinationAt(x, y);
        const validation = canDrop(
          game.hero,
          session.current.source,
          destination.target,
          game.hotbarEditMode,
        );
        clearHighlight();
        targetElement.current = destination.element;
        destination.element?.setAttribute(
          'data-drop-feedback',
          validation.ok ? 'valid' : 'invalid',
        );
        if (feedback.current) feedback.current.textContent = validation.reason;
        placePreview();
      });
    };
    const up = (event: PointerEvent) => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (current.active) {
        event.preventDefault();
        event.stopPropagation();
      }
      finish(true, { x: event.clientX, y: event.clientY });
    };
    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === session.current?.pointerId) finish(false);
    };
    const lostCapture = (event: PointerEvent) => {
      const current = session.current;
      if (
        current &&
        event.target === current.element &&
        event.pointerId === current.pointerId
      )
        finish(false);
    };
    const cancel = () => finish(false);
    const nativeDrag = (event: DragEvent) => {
      if (session.current) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      if (!session.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(false);
      }
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const newPointerGesture = () => {
      // Suppress only the release-click belonging to the finished drag, not a
      // deliberate new click on Close, an item, or another hotbar slot.
      if (!session.current) suppressClickUntil.current = 0;
    };
    const observer = new MutationObserver(() => {
      const current = session.current;
      if (current && (!current.element.isConnected || sourceMoved(current)))
        finish(false);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    window.addEventListener('pointermove', move, {
      capture: true,
      passive: false,
    });
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointerdown', newPointerGesture, true);
    window.addEventListener('pointercancel', cancelPointer, true);
    window.addEventListener('lostpointercapture', lostCapture, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('click', click, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener(INTERFACE_SCALE_EVENT, cancel);
    window.addEventListener('dragstart', nativeDrag, true);
    return () => {
      finish(false);
      if (finishTimer.current) clearTimeout(finishTimer.current);
      observer.disconnect();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointerdown', newPointerGesture, true);
      window.removeEventListener('pointercancel', cancelPointer, true);
      window.removeEventListener('lostpointercapture', lostCapture, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.removeEventListener(INTERFACE_SCALE_EVENT, cancel);
      window.removeEventListener('dragstart', nativeDrag, true);
    };
  }, [game, finish, clearHighlight, placePreview]);

  const context = useMemo(
    () => ({ begin, isDragging: preview !== null }),
    [begin, preview],
  );
  const source = preview?.source;
  const item =
    source?.dragType === 'item'
      ? game?.hero.inventory.find((item) => item.id === source.refId)
      : null;
  const ability =
    source?.dragType === 'skill'
      ? [...ALL_SKILLS, ...ALL_PASSIVES].find(
          (skill) => skill.id === source.refId,
        )
      : null;
  const entry =
    source?.dragType === 'hotbar-binding' && game
      ? resolvePrimaryHotbarEntry(game.hero, source.refId)
      : null;
  const rarity = item?.rarity ?? entry?.item?.rarity;
  return (
    <Context.Provider value={context}>
      {children}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {preview &&
        createPortal(
          <div
            ref={overlay}
            className="game-drag-preview"
            aria-hidden="true"
            style={
              {
                transform: `translate3d(${preview.position.x + 14}px, ${preview.position.y + 14}px, 0)`,
                '--drag-accent': rarity ? RARITY_META[rarity].color : '#d6c48f',
              } as CSSProperties
            }
          >
            <div className="game-drag-icon">
              {item ? (
                <ItemIcon item={item} />
              ) : ability ? (
                <SkillIcon id={ability.id} />
              ) : (
                <EntryIcon entry={entry} />
              )}
            </div>
            <strong>
              <JobText>{item?.name ?? ability?.name ?? entry?.name ?? source?.refId}</JobText>
            </strong>
            <span ref={feedback}>Pilih slot tujuan · Esc untuk batal</span>
          </div>,
          document.body,
        )}
    </Context.Provider>
  );
}
