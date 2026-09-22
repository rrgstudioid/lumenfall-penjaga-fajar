import test from 'node:test';
import assert from 'node:assert/strict';
import { FOLLOW_CAMERA as C, createFollowCamera, stepFollowCamera, followWheelDistance, followImpactShake } from './camera-follow.ts';

test('follow smoothing gives the same pose at 30, 60 and 144 FPS', () => {
  const run = (fps: number) => {
    let state = { ...createFollowCamera(3.1), targetYaw: -3.1, targetPitch: 0.8, targetDistance: 3 };
    for (let i = 0; i < fps; i++) state = stepFollowCamera(state, 1 / fps);
    return state;
  };
  const baseline = run(60);
  for (const fps of [30, 144]) for (const key of ['yaw', 'pitch', 'distance'] as const) {
    assert.ok(Math.abs(run(fps)[key] - baseline[key]) < 1e-8);
  }
  assert.ok(baseline.yaw > 3.1 && baseline.yaw < 3.2, 'crosses the angle seam by the short path');
});

test('manual orbit stays selected indefinitely without automatic recentering', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    let state = createFollowCamera(yaw);
    for (let i = 0; i < 600; i++) state = stepFollowCamera(state, 1 / 60);
    assert.equal(state.targetYaw, yaw);
    assert.equal(state.yaw, yaw);
    assert.equal(state.pitch, C.defaultPitch);
    const orbit = stepFollowCamera({ ...state, targetYaw: yaw + .6 }, .1);
    assert.ok(orbit.yaw > yaw && orbit.yaw < yaw + .6, 'RMB target still moves smoothly');
    assert.equal(orbit.targetYaw, yaw + .6);
  }
});

test('wheel is responsive, bounded, reversible and does not alter pitch/yaw', () => {
  const d = followWheelDistance(10, -100);
  assert.ok(d < 10 && d > 9);
  assert.ok(Math.abs(followWheelDistance(d, 100) - 10) < 1e-10);
  assert.equal(followWheelDistance(10, -1, 1), followWheelDistance(10, -16));
  assert.equal(followWheelDistance(C.minDistance, -10000), C.minDistance);
  assert.equal(followWheelDistance(C.maxDistance, 10000), C.maxDistance);
  const start = createFollowCamera(1);
  const next = stepFollowCamera({ ...start, targetDistance: d }, 1/60);
  assert.equal(next.pitch, start.pitch);
  assert.equal(next.yaw, start.yaw);
  assert.ok(next.distance < 10 && next.distance > d);
});

test('impact shake is brief, bounded and returns exactly to rest', () => {
  let peak = 0;
  for (let i = 0; i <= 100; i++) {
    const shake = followImpactShake(C.shakeDuration * i / 100);
    peak = Math.max(peak, Math.abs(shake.x), Math.abs(shake.y));
    assert.ok(Math.abs(shake.x) < .012 && Math.abs(shake.y) < .008);
  }
  assert.ok(peak > .001);
  for (const remaining of [0, C.shakeDuration]) {
    const shake = followImpactShake(remaining);
    assert.equal(Math.hypot(shake.x, shake.y), 0);
  }
});
