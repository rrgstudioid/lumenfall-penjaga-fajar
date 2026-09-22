'use client';

import * as React from 'react';
import { AlertDialogContent } from '@/components/ui/alert-dialog';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { INTERFACE_SCALE_EVENT } from '@/lib/game/interface-settings';
import {
  clampWindowPosition,
  readUILayout,
  resetUILayout,
  saveWindowPosition,
  saveWindowSize,
  UI_LAYOUT_RESET_EVENT,
  WindowFocusManager,
  type WindowPosition,
  type WindowSize,
} from '@/lib/game/ui-layout';

const focusManager = new WindowFocusManager();
const dragHandleSelector =
  '[data-window-drag-handle], .dialog-heading, [data-slot="alert-dialog-title"]';
const interactiveSelector = [
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'a',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[data-window-no-drag]',
  '.inventory-slot',
  '.equipment-slot',
  '.js-node',
].join(',');

export function resetDraggableUILayout(): void {
  if (typeof window === 'undefined') return;
  resetUILayout(window.localStorage);
  window.dispatchEvent(new Event(UI_LAYOUT_RESET_EVENT));
}

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  origin: WindowPosition;
  position: WindowPosition;
  width: number;
  height: number;
  moved: boolean;
};

type ResizeSession = {
  pointerId: number;
  startX: number;
  startY: number;
  edge: 'left' | 'right' | 'top' | 'bottom';
  origin: WindowPosition;
  originSize: WindowSize;
  position: WindowPosition;
  size: WindowSize;
  moved: boolean;
};

type OriginalInlinePosition = {
  left: string;
  top: string;
  right: string;
  bottom: string;
  translate: string;
  zIndex: string;
  willChange: string;
  userSelect: string;
  width: string;
  height: string;
};

function findOverlay(element: HTMLElement): HTMLElement | null {
  const candidate = element.previousElementSibling;
  return candidate instanceof HTMLElement &&
    candidate.matches(
      '[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]',
    )
    ? candidate
    : null;
}

function uiScale(): number {
  if (typeof window === 'undefined') return 1;
  const value = Number.parseFloat(
    window.getComputedStyle(document.documentElement)
      .getPropertyValue('--lumenfall-ui-scale'),
  );
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function useDraggableWindow(
  windowId: string,
  enabled = true,
  resizable = false,
  dragHandleSelectorOverride?: string,
) {
  const elementRef = React.useRef<HTMLElement | null>(null);
  const dragRef = React.useRef<DragSession | null>(null);
  const resizeRef = React.useRef<ResizeSession | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const positionedRef = React.useRef(false);
  const originalRef = React.useRef<OriginalInlinePosition | null>(null);
  const [mountedElement, setMountedElement] =
    React.useState<HTMLElement | null>(null);

  const setElement = React.useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
    setMountedElement(element);
  }, []);

  const applyPosition = React.useCallback((position: WindowPosition) => {
    const element = elementRef.current;
    if (!element) return;
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.translate = 'none';
    element.dataset.uiPositioned = 'true';
    positionedRef.current = true;
  }, []);

  const restoreDefaultPosition = React.useCallback(() => {
    const element = elementRef.current;
    const original = originalRef.current;
    if (!element || !original) return;
    element.style.left = original.left;
    element.style.top = original.top;
    element.style.right = original.right;
    element.style.bottom = original.bottom;
    element.style.translate = original.translate;
    delete element.dataset.uiPositioned;
    positionedRef.current = false;
  }, []);

  const completeDrag = React.useCallback(
    (pointerId: number, cancelled = false) => {
      const current = dragRef.current;
      const element = elementRef.current;
      if (!current || current.pointerId !== pointerId || !element) return;
      dragRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const finalPosition = cancelled ? current.origin : current.position;
      applyPosition(finalPosition);
      try {
        if (element.hasPointerCapture?.(pointerId))
          element.releasePointerCapture(pointerId);
      } catch {
        // The browser may have released capture before the global pointer event.
      }
      element.classList.remove('is-window-dragging');
      element.style.willChange = originalRef.current?.willChange ?? '';
      element.style.userSelect = originalRef.current?.userSelect ?? '';
      if (current.moved && !cancelled) {
        try {
          saveWindowPosition(windowId, finalPosition, window.localStorage);
        } catch {
          // UI preferences are optional.
        }
      }
    },
    [applyPosition, windowId],
  );

  const applySize = React.useCallback((size: WindowSize) => {
    const element = elementRef.current;
    if (!element) return;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
  }, []);

  const completeResize = React.useCallback(
    (pointerId: number, cancelled = false) => {
      const current = resizeRef.current;
      const element = elementRef.current;
      if (!current || current.pointerId !== pointerId || !element) return;
      resizeRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (cancelled) {
        applyPosition(current.origin);
        applySize(current.originSize);
      }
      try {
        if (element.hasPointerCapture?.(pointerId))
          element.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      element.classList.remove('is-window-resizing');
      element.style.willChange = originalRef.current?.willChange ?? '';
      element.style.userSelect = originalRef.current?.userSelect ?? '';
      if (current.moved && !cancelled) {
        applyPosition(current.position);
        saveWindowPosition(windowId, current.position, window.localStorage);
        saveWindowSize(windowId, current.size, window.localStorage);
      }
    },
    [applyPosition, applySize, windowId],
  );

  React.useLayoutEffect(() => {
    const element = mountedElement;
    if (!element || !enabled) return;
    originalRef.current = {
      left: element.style.left,
      top: element.style.top,
      right: element.style.right,
      bottom: element.style.bottom,
      translate: element.style.translate,
      zIndex: element.style.zIndex,
      willChange: element.style.willChange,
      userSelect: element.style.userSelect,
      width: element.style.width,
      height: element.style.height,
    };
    const overlay = findOverlay(element);
    const overlayZIndex = overlay?.style.zIndex ?? '';
    const unregister = focusManager.register(windowId, (zIndex) => {
      document.documentElement.style.setProperty('--lumenfall-window-top-z', String(focusManager.topZIndex));
      element.style.zIndex = String(zIndex);
      if (overlay) overlay.style.zIndex = String(zIndex - 1);
    });
    focusManager.focus(windowId);
    // Base UI may retain a closed portal for its exit animation. Reopening it
    // must restore focus order even when the same DOM element is reused.
    const openObserver = new MutationObserver(() => {
      if (element.hasAttribute('data-open')) focusManager.focus(windowId);
    });
    openObserver.observe(element, { attributes: true, attributeFilter: ['data-open'] });

    let restoreTimer: number | null = null;
    try {
      const saved = readUILayout(window.localStorage)[windowId];
      if (saved) {
        const applySavedPosition = () => {
          if (dragRef.current || resizeRef.current) return;
          const rect = element.getBoundingClientRect();
          if (resizable && saved.width && saved.height) {
            const scale = uiScale();
            const maxWidth = Math.max(340, window.innerWidth * 0.9 / scale);
            const maxHeight = Math.max(480, window.innerHeight * 0.9 / scale);
            applySize({
              width: Math.min(Math.max(340, saved.width), maxWidth),
              height: Math.min(Math.max(480, saved.height), maxHeight),
            });
          }
          const nextRect = element.getBoundingClientRect();
          applyPosition(
            clampWindowPosition(
              saved,
              { width: window.innerWidth, height: window.innerHeight },
              { width: nextRect.width || rect.width, height: nextRect.height || rect.height },
            ),
          );
        };
        applySavedPosition();
        restoreTimer = window.setTimeout(applySavedPosition, 120);
      }
    } catch {
      // Blocked storage leaves the existing centered position unchanged.
    }

    const clampCurrentPosition = () => {
      if (!positionedRef.current) return;
      const rect = element.getBoundingClientRect();
      const position = clampWindowPosition(
        { x: rect.left, y: rect.top },
        { width: window.innerWidth, height: window.innerHeight },
        { width: rect.width, height: rect.height },
      );
      applyPosition(position);
      try {
        saveWindowPosition(windowId, position, window.localStorage);
      } catch {
        // UI preferences are optional.
      }
    };
    const observer = new ResizeObserver(clampCurrentPosition);
    observer.observe(element);
    window.addEventListener('resize', clampCurrentPosition);
    const finishPointer = (event: PointerEvent) =>
      (completeDrag(event.pointerId), completeResize(event.pointerId));
    const cancelPointer = (event: PointerEvent) =>
      (completeDrag(event.pointerId, true), completeResize(event.pointerId, true));
    const lostPointerCapture = (event: PointerEvent) =>
      (completeDrag(event.pointerId), completeResize(event.pointerId));
    const cancelDrag = () => {
      if (dragRef.current) completeDrag(dragRef.current.pointerId, true);
      if (resizeRef.current) completeResize(resizeRef.current.pointerId, true);
    };
    const scaleChanged = () => { cancelDrag(); clampCurrentPosition(); };
    window.addEventListener(INTERFACE_SCALE_EVENT, scaleChanged);
    const resetPosition = () => {
      restoreDefaultPosition();
      if (resizable) {
        element.style.width = originalRef.current?.width ?? '';
        element.style.height = originalRef.current?.height ?? '';
      }
    };
    window.addEventListener('pointerup', finishPointer, true);
    window.addEventListener('pointercancel', cancelPointer, true);
    element.addEventListener('lostpointercapture', lostPointerCapture);
    window.addEventListener('blur', cancelDrag);
    window.addEventListener(UI_LAYOUT_RESET_EVENT, resetPosition);

    return () => {
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      dragRef.current = null;
      resizeRef.current = null;
      observer.disconnect();
      openObserver.disconnect();
      window.removeEventListener('resize', clampCurrentPosition);
      window.removeEventListener(INTERFACE_SCALE_EVENT, scaleChanged);
      window.removeEventListener('pointerup', finishPointer, true);
      window.removeEventListener('pointercancel', cancelPointer, true);
      element.removeEventListener('lostpointercapture', lostPointerCapture);
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener(UI_LAYOUT_RESET_EVENT, resetPosition);
      unregister();
      restoreDefaultPosition();
      element.style.zIndex = originalRef.current?.zIndex ?? '';
      element.style.willChange = originalRef.current?.willChange ?? '';
      element.style.userSelect = originalRef.current?.userSelect ?? '';
      element.style.width = originalRef.current?.width ?? '';
      element.style.height = originalRef.current?.height ?? '';
      if (overlay) overlay.style.zIndex = overlayZIndex;
      originalRef.current = null;
    };
  }, [
    applyPosition,
    completeDrag,
    completeResize,
    applySize,
    enabled,
    mountedElement,
    resizable,
    dragHandleSelectorOverride,
    restoreDefaultPosition,
    windowId,
  ]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || !elementRef.current) return;
    const target = event.target;
    // React events from a portaled confirmation still bubble to its parent.
    // Never raise the parent above that dialog (which would hide its buttons).
    if (!(target instanceof Element) || !elementRef.current.contains(target) ||
        elementRef.current.hasAttribute('data-nested-dialog-open')) return;
    focusManager.focus(windowId);
    const resizeHandle = target.closest('[data-window-resize-handle]');
    const edge = resizeHandle instanceof HTMLElement
      ? resizeHandle.dataset.windowResizeEdge
      : undefined;
    if (
      resizable &&
      resizeHandle &&
      elementRef.current.contains(resizeHandle) &&
      (edge === 'left' || edge === 'right' || edge === 'top' || edge === 'bottom')
    ) {
      const rect = elementRef.current.getBoundingClientRect();
      const scale = uiScale();
      const origin = { x: rect.left, y: rect.top };
      const originSize = { width: rect.width / scale, height: rect.height / scale };
      resizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        edge,
        origin,
        originSize,
        position: origin,
        size: originSize,
        moved: false,
      };
      elementRef.current.setPointerCapture?.(event.pointerId);
      elementRef.current.classList.add('is-window-resizing');
      elementRef.current.style.willChange = 'width, height';
      elementRef.current.style.userSelect = 'none';
      event.preventDefault();
      return;
    }
    if (target.closest(interactiveSelector))
      return;
    const handle = target.closest(
      dragHandleSelectorOverride ?? dragHandleSelector,
    );
    if (!handle || !elementRef.current.contains(handle)) return;
    const rect = elementRef.current.getBoundingClientRect();
    const origin = { x: rect.left, y: rect.top };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      position: origin,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    applyPosition(origin);
    elementRef.current.setPointerCapture?.(event.pointerId);
    elementRef.current.classList.add('is-window-dragging');
    elementRef.current.style.willChange = 'left, top';
    elementRef.current.style.userSelect = 'none';
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current;
    if (resize && resize.pointerId === event.pointerId) {
      const scale = uiScale();
      const dx = (event.clientX - resize.startX) / scale;
      const dy = (event.clientY - resize.startY) / scale;
      if (!resize.moved && Math.hypot(dx, dy) < 5) return;
      resize.moved = true;
      const maxWidth = Math.max(340, window.innerWidth * 0.9 / scale);
      const maxHeight = Math.max(480, window.innerHeight * 0.9 / scale);
      const rightEdge = resize.origin.x + resize.originSize.width * scale;
      const bottomEdge = resize.origin.y + resize.originSize.height * scale;
      let width = resize.originSize.width;
      let height = resize.originSize.height;
      let x = resize.origin.x;
      let y = resize.origin.y;
      if (resize.edge === 'right') {
        width = Math.min(Math.max(340, resize.originSize.width + dx), maxWidth);
      } else if (resize.edge === 'left') {
        width = Math.min(
          Math.max(340, resize.originSize.width - dx),
          maxWidth,
          Math.max(340, (rightEdge - 12) / scale),
        );
        x = rightEdge - width * scale;
      } else if (resize.edge === 'bottom') {
        height = Math.min(Math.max(480, resize.originSize.height + dy), maxHeight);
      } else {
        height = Math.min(
          Math.max(480, resize.originSize.height - dy),
          maxHeight,
          Math.max(480, (bottomEdge - 12) / scale),
        );
        y = bottomEdge - height * scale;
      }
      resize.position = { x, y };
      resize.size = { width, height };
      applyPosition(resize.position);
      applySize(resize.size);
      event.preventDefault();
      return;
    }
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true;
    current.position = clampWindowPosition(
      { x: current.origin.x + dx, y: current.origin.y + dy },
      { width: window.innerWidth, height: window.innerHeight },
      { width: current.width, height: current.height },
    );
    try {
      saveWindowPosition(windowId, current.position, window.localStorage);
    } catch {
      // UI preferences are optional.
    }
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (!dragRef.current) return;
        applyPosition(dragRef.current.position);
      });
    }
    event.preventDefault();
  };

  return {
    ref: setElement,
    className: enabled ? 'lumenfall-draggable-window' : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: React.PointerEvent<HTMLElement>) =>
      (completeDrag(event.pointerId), completeResize(event.pointerId)),
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) =>
      (completeDrag(event.pointerId, true), completeResize(event.pointerId, true)),
  };
}

type DraggableDialogContentProps = React.ComponentProps<
  typeof DialogContent
> & {
  windowId: string;
  dragEnabled?: boolean;
  resizable?: boolean;
  dragHandleSelector?: string;
};

export function DraggableDialogContent({
  windowId,
  dragEnabled = true,
  resizable = false,
  dragHandleSelector: dragHandleSelectorOverride,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: DraggableDialogContentProps) {
  const {
    ref: draggableRef,
    className: draggableClassName,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  } = useDraggableWindow(
    windowId,
    dragEnabled,
    resizable,
    dragHandleSelectorOverride,
  );
  return (
    <DialogContent
      {...props}
      ref={draggableRef}
      data-window-id={windowId}
      className={cn(className, draggableClassName)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) handlePointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented) handlePointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) handlePointerUp(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        if (!event.defaultPrevented) handlePointerCancel(event);
      }}
    />
  );
}

type DraggableOverlayProps = React.HTMLAttributes<HTMLDivElement> & {
  windowId: string;
  dragEnabled?: boolean;
  dragHandleSelector?: string;
};

/** A draggable, non-modal HUD window that uses the same persisted layout and
 * focus manager as the dialog panels. */
export function DraggableOverlay({
  windowId,
  dragEnabled = true,
  dragHandleSelector: dragHandleSelectorOverride,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: DraggableOverlayProps) {
  const {
    ref: draggableRef,
    className: draggableClassName,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  } = useDraggableWindow(
    windowId,
    dragEnabled,
    false,
    dragHandleSelectorOverride,
  );
  return (
    <div
      {...props}
      ref={draggableRef}
      data-window-id={windowId}
      className={cn(className, draggableClassName)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) handlePointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented) handlePointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) handlePointerUp(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        if (!event.defaultPrevented) handlePointerCancel(event);
      }}
    />
  );
}

type DraggableAlertDialogContentProps = React.ComponentProps<
  typeof AlertDialogContent
> & {
  windowId: string;
};

export function DraggableAlertDialogContent({
  windowId,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: DraggableAlertDialogContentProps) {
  const {
    ref: draggableRef,
    className: draggableClassName,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  } = useDraggableWindow(windowId);
  return (
    <AlertDialogContent
      {...props}
      ref={draggableRef}
      data-window-id={windowId}
      className={cn(className, draggableClassName)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) handlePointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented) handlePointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (!event.defaultPrevented) handlePointerUp(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        if (!event.defaultPrevented) handlePointerCancel(event);
      }}
    />
  );
}
