'use client';
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { INTERFACE_SCALE_EVENT } from '@/lib/game/interface-settings';

type Point = { x: number; y: number };
/** Pointer-capture lifecycle shared by HUD windows; layout/storage stay with the caller. */
export function useWindowPointerGesture<T>(
  element: RefObject<HTMLElement | null>,
  options: {
    enabled: boolean;
    start: (resize: boolean) => T;
    move: (origin: T, delta: Point, resize: boolean) => void;
    finish: (
      origin: T,
      cancelled: boolean,
      moved: boolean,
      resize: boolean,
    ) => void;
  },
) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const session = useRef<{
    id: number;
    point: Point;
    origin: T;
    resize: boolean;
    moved: boolean;
  } | null>(null);
  const frame = useRef(0),
    delta = useRef<Point>({ x: 0, y: 0 }),
    suppressClick = useRef(false);
  useEffect(() => {
    const finish = (cancelled: boolean) => {
      const current = session.current;
      if (!current) return;
      cancelAnimationFrame(frame.current);
      if (!cancelled && current.moved)
        latest.current.move(current.origin, delta.current, current.resize);
      session.current = null;
      document.body.removeAttribute('data-hud-dragging');
      latest.current.finish(
        current.origin,
        cancelled,
        current.moved,
        current.resize,
      );
      suppressClick.current = current.moved;
      if (element.current?.hasPointerCapture(current.id))
        element.current.releasePointerCapture(current.id);
    };
    const move = (event: PointerEvent) => {
      const current = session.current;
      if (!current || event.pointerId !== current.id) return;
      delta.current = {
        x: event.clientX - current.point.x,
        y: event.clientY - current.point.y,
      };
      if (!current.moved && Math.hypot(delta.current.x, delta.current.y) < 5)
        return;
      current.moved = true;
      event.preventDefault();
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() =>
        latest.current.move(current.origin, delta.current, current.resize),
      );
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === session.current?.id) finish(false);
    };
    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === session.current?.id) finish(true);
    };
    const cancel = () => finish(true);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && session.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    const click = (event: MouseEvent) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const down = () => {
      suppressClick.current = false;
    };
    window.addEventListener('pointermove', move, {
      capture: true,
      passive: false,
    });
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancelPointer, true);
    window.addEventListener('lostpointercapture', cancelPointer, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('click', click, true);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener(INTERFACE_SCALE_EVENT, cancel);
    window.addEventListener('lumenfall:hud-cancel', cancel);
    return () => {
      cancel();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancelPointer, true);
      window.removeEventListener('lostpointercapture', cancelPointer, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.removeEventListener(INTERFACE_SCALE_EVENT, cancel);
      window.removeEventListener('lumenfall:hud-cancel', cancel);
    };
  }, [element]);
  return (event: ReactPointerEvent<HTMLElement>, resize = false) => {
    if (
      !options.enabled ||
      event.button !== 0 ||
      session.current ||
      !element.current
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    session.current = {
      id: event.pointerId,
      point: { x: event.clientX, y: event.clientY },
      origin: options.start(resize),
      resize,
      moved: false,
    };
    delta.current = { x: 0, y: 0 };
    document.body.setAttribute('data-hud-dragging', 'true');
    // Window listeners also cover browsers which decline capture during focus changes.
    try {
      element.current.setPointerCapture(event.pointerId);
    } catch {
      /* Continue the gesture using the registered window listeners. */
    }
  };
}
