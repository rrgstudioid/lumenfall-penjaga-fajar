type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Viewport coordinates, independent of source CSS scale or window position. */
export function dragPreviewPosition(
  pointer: Point,
  viewport: Size,
  preview: Size,
  gap = 14,
): Point {
  const margin = 8;
  const axis = (value: number, extent: number, size: number) => {
    const preferred =
      value + gap + size <= extent - margin ? value + gap : value - gap - size;
    return Math.max(margin, Math.min(preferred, extent - size - margin));
  };
  return {
    x: axis(pointer.x, viewport.width, preview.width),
    y: axis(pointer.y, viewport.height, preview.height),
  };
}
