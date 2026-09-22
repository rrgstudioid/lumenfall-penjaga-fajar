// Shared adaptive framing for the existing Lumenfall orbit camera.
export const CAMERA_ZOOM = {
  min: 1.15,
  max: 15, // 50% of the previous Free Camera far limit (30).
  // The previous default (20) is outside the new range; start at its far limit.
  default: 15,
  defaultFraming: 0,
  // A typical wheel event is around 100 deltaY pixels. Keep each notch
  // responsive, but small enough that far-to-near takes several steps.
  wheelFramingSpeed: 0.0015,
  farTargetHeight: 1.05,
  nearTargetHeight: 1.82,
  farPitchOffset: 0.55,
  nearPitchOffset: -0.35,
  transitionSpeed: 7,
  wheelTransitionSpeed: 4.5,
} as const;

export type CameraZoomState = {
  targetFraming: number;
  currentFraming: number;
  rmbFramingTarget: number;
  rmbFraming: number;
  rmbFramingActive: boolean;
  manualOrbitPitchOffset: number;
  manualOrbitPitchLocked: boolean;
  pitchOffset: number;
  targetHeight: number;
  yaw: number;
  halfHeight: number;
  distance: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

export function framingFromDistance(distance: number) {
  return clamp01((CAMERA_ZOOM.max - distance) / (CAMERA_ZOOM.max - CAMERA_ZOOM.min));
}

export function wheelCameraFraming(framing: number, delta: number, mode = 0, pageHeight = 800) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return clamp01(framing - pixels * CAMERA_ZOOM.wheelFramingSpeed);
}

export function stepCameraZoom(state: CameraZoomState, followYaw: number, dt: number, freeOrbit = false) {
  const rmbAlpha = 1 - Math.exp(-Math.max(0, dt) * CAMERA_ZOOM.transitionSpeed);
  const wheelAlpha = 1 - Math.exp(-Math.max(0, dt) * CAMERA_ZOOM.wheelTransitionSpeed);
  const currentFraming = state.currentFraming + (state.targetFraming - state.currentFraming) * wheelAlpha;
  const rmbFraming = state.rmbFramingActive
    ? state.rmbFraming + (state.rmbFramingTarget - state.rmbFraming) * rmbAlpha
    : currentFraming;
  const wheelT = smoothstep(currentFraming);
  const wheelDistance = CAMERA_ZOOM.max + (CAMERA_ZOOM.min - CAMERA_ZOOM.max) * wheelT;
  const wheelTargetHeight = CAMERA_ZOOM.farTargetHeight + (CAMERA_ZOOM.nearTargetHeight - CAMERA_ZOOM.farTargetHeight) * wheelT;
  const wheelPitchOffset = CAMERA_ZOOM.farPitchOffset + (CAMERA_ZOOM.nearPitchOffset - CAMERA_ZOOM.farPitchOffset) * wheelT;
  let distance = wheelDistance;
  let targetHeight = wheelTargetHeight;
  let pitchOffset = state.manualOrbitPitchLocked
    ? state.manualOrbitPitchOffset
    : wheelPitchOffset;
  let manualOrbitPitchOffset = state.manualOrbitPitchOffset;
  let manualOrbitPitchLocked = state.manualOrbitPitchLocked;
  if (state.manualOrbitPitchLocked) {
    // After a low-angle RMB orbit, wheel zoom changes distance first. The
    // pivot only rises once the camera is genuinely close to the character.
    const nearPivotBlend = smoothstep(
      Math.max(0, Math.min(1,
        (12 - wheelDistance) / (12 - 3.5))),
    );
    targetHeight = CAMERA_ZOOM.farTargetHeight +
      (CAMERA_ZOOM.nearTargetHeight - CAMERA_ZOOM.farTargetHeight) * nearPivotBlend;
    pitchOffset += -0.1 * nearPivotBlend;
  }
  if (state.rmbFramingActive) {
    // Stage 1 (0..55%) is a far vertical orbit only. Stage 2 is the
    // existing close framing path, blended in continuously from ground level.
    const stageOne = Math.min(1, rmbFraming / 0.55);
    const closeProgress = Math.max(0, (rmbFraming - 0.55) / 0.45);
    const stageT = smoothstep(stageOne);
    const closeT = smoothstep(closeProgress);
    const closeDistanceT = smoothstep(closeT);
    const desiredDistance = CAMERA_ZOOM.max + (CAMERA_ZOOM.min - CAMERA_ZOOM.max) * closeDistanceT;
    // Switching from wheel framing to RMB framing is itself damped, so the
    // camera never jumps when the input method changes.
    distance = state.distance + (desiredDistance - state.distance) * rmbAlpha;
    targetHeight = wheelTargetHeight + (CAMERA_ZOOM.nearTargetHeight - wheelTargetHeight) * closeT;
    const groundPitch = -0.4;
    pitchOffset = stageOne < 1
      ? CAMERA_ZOOM.farPitchOffset + (groundPitch - CAMERA_ZOOM.farPitchOffset) * stageT
      : groundPitch + (CAMERA_ZOOM.nearPitchOffset - groundPitch) * closeT;
    manualOrbitPitchOffset = pitchOffset;
    manualOrbitPitchLocked = true;
  }
  if (state.rmbFramingActive) {
    // Preserve the last wheel-produced pose while the RMB framing path takes
    // over. This prevents a click/drag handoff from immediately falling to
    // the ground-level stage.
    targetHeight = state.targetHeight + (targetHeight - state.targetHeight) * rmbAlpha;
    pitchOffset = state.pitchOffset + (pitchOffset - state.pitchOffset) * rmbAlpha;
  }
  const angleDelta = Math.atan2(Math.sin(followYaw - state.yaw), Math.cos(followYaw - state.yaw));
  const yaw = state.yaw + angleDelta * rmbAlpha;
  return {
    state: {
      ...state,
      currentFraming,
      rmbFraming,
      manualOrbitPitchOffset,
      manualOrbitPitchLocked,
      pitchOffset,
      targetHeight,
      yaw,
      halfHeight: distance,
      distance,
    },
    framing: currentFraming,
    distance,
    targetHeight,
    pitchOffset,
  };
}
