import test from 'node:test';
import assert from 'node:assert/strict';
import {
  height,
  perimeter,
  roads,
  gateToPlaza,
  plazaToCastle,
  pathLength,
} from './kingdom-capital-layout.ts';

test('castle courtyard is filled terrain, not a floating corner slab', () => {
  for (const [x, z] of [
    [-20, -250],
    [90, -250],
    [35, -282],
    [6, -301],
    [64, -301],
  ])
    assert.ok(height(x, z) >= 127.5, `${x},${z}`);
});
test('six stair centre-lines remain continuous at road/landing joins', () => {
  for (const road of roads.filter((r) => r.stairs)) {
    const [a, b] = road.points,
      n = Math.ceil(pathLength([a, b]) / 0.1);
    let previous = height(a[0], a[1]);
    for (let k = 1; k <= n; k++) {
      const t = k / n,
        y = height(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      assert.ok(Math.abs(y - previous) < 0.26, `${road.name} at ${t}`);
      previous = y;
    }
  }
});
test('capital footprint and principal travel cannot regress to a small arena', () => {
  const xs = perimeter.map((p) => p[0]),
    zs = perimeter.map((p) => p[1]);
  assert.equal(Math.max(...xs) - Math.min(...xs), 680);
  assert.equal(Math.max(...zs) - Math.min(...zs), 710);
  for (const points of [gateToPlaza, plazaToCastle]) {
    const seconds = pathLength(points) / 7.564;
    assert.ok(seconds >= 45 && seconds <= 90);
  }
});
