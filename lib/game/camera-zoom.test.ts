import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_ZOOM as C,
  framingFromDistance,
  stepCameraZoom,
  wheelCameraFraming,
  type CameraZoomState,
} from './camera-zoom.ts';

const initial = (yaw = .62): CameraZoomState => ({
  targetFraming: C.defaultFraming,
  currentFraming: C.defaultFraming,
  rmbFramingTarget: C.defaultFraming,
  rmbFraming: C.defaultFraming,
  rmbFramingActive: false,
  manualOrbitPitchOffset: C.farPitchOffset,
  manualOrbitPitchLocked: false,
  pitchOffset: C.farPitchOffset,
  targetHeight: C.farTargetHeight,
  yaw,
  halfHeight: C.default,
  distance: C.default,
});
const near = (a: number, b: number, tolerance = .001) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const step = (state: CameraZoomState, frames = 180) => {
  for (let i = 0; i < frames; i++) state = stepCameraZoom(state, state.yaw, 1 / 60, true).state;
  return state;
};

test('wheel changes one shared framing target and clamps both ends', () => {
  near(wheelCameraFraming(0.5, -100), 0.65);
  near(wheelCameraFraming(0.5, -1000), 1);
  near(wheelCameraFraming(0.5, 1000), 0);
  near(wheelCameraFraming(0.5, -1, 1), wheelCameraFraming(0.5, -16));
  near(wheelCameraFraming(0.5, -1, 2, 800), 1);
});

test('framing continuously maps to far, medium, and near camera parameters', () => {
  const far = stepCameraZoom({ ...initial(), targetFraming: 0, currentFraming: 0 }, .62, 1 / 60, true);
  const mid = stepCameraZoom({ ...initial(), targetFraming: .5, currentFraming: .5 }, .62, 1 / 60, true);
  const nearView = stepCameraZoom({ ...initial(), targetFraming: 1, currentFraming: 1 }, .62, 1 / 60, true);
  assert.equal(C.max, 15, 'Free far limit is half of the previous 30');
  assert.ok(C.default <= C.max, 'initial distance stays within the new limit');
  near(far.distance, 15);
  near(nearView.distance, 1.15, 1e-8);
  assert.ok(far.distance > mid.distance && mid.distance > nearView.distance);
  assert.ok(far.targetHeight < mid.targetHeight && mid.targetHeight < nearView.targetHeight);
  assert.ok(far.pitchOffset > mid.pitchOffset && mid.pitchOffset > nearView.pitchOffset);
});

test('RMB vertical stage one lowers the angle while remaining far, then stage two closes in', () => {
  let state = { ...initial(), rmbFramingActive: true, rmbFramingTarget: 0, rmbFraming: 0 };
  state = step(state, 120);
  const ground = stepCameraZoom({ ...state, rmbFramingTarget: .55 }, state.yaw, 1 / 60, true);
  near(ground.distance, C.max);
  assert.ok(ground.pitchOffset < C.farPitchOffset);
  const close = stepCameraZoom({ ...ground.state, rmbFraming: .55, rmbFramingTarget: 1 }, ground.state.yaw, 1 / 60, true);
  assert.ok(close.distance < ground.distance);
  assert.ok(close.targetHeight > ground.targetHeight);
});

test('wheel-only framing remains unchanged when RMB vertical mode is inactive', () => {
  const state = { ...initial(), targetFraming: 0, currentFraming: 0, rmbFramingActive: false };
  const view = stepCameraZoom(state, state.yaw, 1 / 60, true);
  assert.ok(view.distance > C.max - .01);
  near(view.targetHeight, C.farTargetHeight);
});

test('wheel zoom preserves a ground-level RMB pitch before near pivot blending', () => {
  let state = {
    ...initial(),
    rmbFramingActive: true,
    rmbFramingTarget: 0.55,
    rmbFraming: 0.55,
  };
  state = step(state, 180);
  const groundPitch = stepCameraZoom(state, state.yaw, 1 / 60, true).pitchOffset;
  assert.ok(groundPitch < 0);

  state = stepCameraZoom({
    ...state,
    targetFraming: 0.7,
    rmbFramingActive: false,
  }, state.yaw, 1 / 60, true).state;
  const groundZoom = stepCameraZoom(state, state.yaw, 1 / 60, true);
  assert.ok(groundZoom.pitchOffset < 0.05);
  assert.ok(groundZoom.targetHeight < C.farTargetHeight + 0.1);
});

test('wheel and vertical drag can hand off through the same state without a jump', () => {
  let state = initial();
  state.targetFraming = wheelCameraFraming(state.targetFraming, -175);
  state = step(state, 60);
  const before = state.currentFraming;
  state.rmbFramingActive = true;
  state.rmbFramingTarget = Math.max(0, Math.min(1, state.rmbFramingTarget - 24 * .004));
  const after = stepCameraZoom(state, state.yaw, 1 / 60, true);
  assert.ok(Math.abs(after.framing - before) < .1);
});

test('reverse input smoothly returns from near to high-angle far view', () => {
  let state = { ...initial(), targetFraming: 1, currentFraming: 1, rmbFramingTarget: 1, rmbFraming: 1, rmbFramingActive: true };
  state = step(state, 180);
  assert.ok(state.distance <= C.min + .01);
  state.rmbFramingTarget = 0;
  const first = stepCameraZoom(state, state.yaw, 1 / 60, true);
  assert.ok(first.distance > state.distance);
  state = step(first.state, 180);
  assert.ok(state.distance >= C.max - .01);
});

test('horizontal orbit remains independent while framing changes', () => {
  const state = { ...initial(), targetFraming: 1, currentFraming: .4, rmbFramingTarget: 1, rmbFraming: .4, rmbFramingActive: true };
  const view = stepCameraZoom(state, 2.1, 1 / 60, true);
  assert.ok(view.state.yaw > state.yaw);
  assert.ok(view.state.currentFraming > state.currentFraming);
});

test('distance framing mapping is reversible', () => {
  near(framingFromDistance(C.max), 0);
  near(framingFromDistance(C.min), 1);
  assert.ok(framingFromDistance(12) > 0 && framingFromDistance(12) < 1);
});
