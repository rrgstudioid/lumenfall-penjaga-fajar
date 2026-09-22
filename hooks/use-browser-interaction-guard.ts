'use client';

import { useEffect } from 'react';

export const ENABLE_BROWSER_HARDENING = true;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]',
  ) !== null;
}

export function isDevtoolsShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  if (event.key === 'F12') return true;
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key)) {
    return true;
  }
  if ((event.ctrlKey || event.metaKey) && key === 'u') {
    return true;
  }
  return false;
}

export function useBrowserInteractionGuard() {
  useEffect(() => {
    if (!ENABLE_BROWSER_HARDENING) return;

    const handleContextMenu = (event: MouseEvent) => {
      // Prevent only the browser default. Do not stop propagation: the game
      // canvas still receives the same right-click/pointer interaction.
      event.preventDefault();
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]')) {
        return;
      }
      // LUMENFALL drag-and-drop is pointer-based. Only suppress browser
      // dragging of media; never cancel the custom data-drag-source flow.
      if (target.closest('img, video, canvas, svg')) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDevtoolsShortcut(event)) {
        event.preventDefault();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'F12') {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}
