import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragPreviewPosition } from './drag-geometry.ts';

void test('drag preview uses viewport pixels, flipping beside bottom/right edges', () => {
  const viewport = { width: 1108, height: 912 };
  const size = { width: 190, height: 140 };
  assert.deepEqual(dragPreviewPosition({ x: 400, y: 300 }, viewport, size), {
    x: 414,
    y: 314,
  });
  for (const point of [
    { x: 856, y: 813 },
    { x: 1090, y: 900 },
    { x: 10, y: 900 },
  ]) {
    const p = dragPreviewPosition(point, viewport, size);
    assert.ok(p.x >= 8 && p.y >= 8);
    assert.ok(p.x + size.width <= viewport.width - 8);
    assert.ok(p.y + size.height <= viewport.height - 8);
  }
});

void test('preview bounds hold at supported desktop sizes and source scales', () => {
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ]) {
    for (const scale of [0.75, 1, 1.5]) {
      const point = { x: 600 * scale, y: height - 70 };
      const p = dragPreviewPosition(
        point,
        { width, height },
        { width: 190, height: 200 },
      );
      assert.equal(p.x, point.x + 14);
      assert.equal(p.y, point.y - 14 - 200);
    }
  }
});
