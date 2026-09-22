export type CameraMode = 'free' | 'follow';

export const FOLLOW_CAMERA = {
  fov: 45,
  minDistance: 2.2,
  maxDistance: 28,
  defaultDistance: 10,
  defaultPitch: 0.38,
  minPitch: 0.08,
  maxPitch: 1.25,
  damping: 7,
  shakeDuration: 0.2,
} as const;

export function createFollowCamera(yaw: number) {
  return {
    yaw, targetYaw: yaw,
    pitch: FOLLOW_CAMERA.defaultPitch as number,
    targetPitch: FOLLOW_CAMERA.defaultPitch as number,
    distance: FOLLOW_CAMERA.defaultDistance as number,
    targetDistance: FOLLOW_CAMERA.defaultDistance as number,
  };
}
export type FollowCameraState = ReturnType<typeof createFollowCamera>;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function followWheelDistance(distance: number, delta: number, mode = 0, pageHeight = 800) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return clamp(distance * Math.exp(clamp(pixels * 0.001, -2, 2)), FOLLOW_CAMERA.minDistance, FOLLOW_CAMERA.maxDistance);
}

export function stepFollowCamera(state: FollowCameraState, dt: number) {
  const alpha = 1 - Math.exp(-FOLLOW_CAMERA.damping * Math.max(0, dt));
  // Follow character position only. Orbit orientation belongs exclusively to RMB
  // input, never character facing, movement keys, or a recenter timeout.
  const targetYaw = state.targetYaw;
  const deltaYaw = Math.atan2(Math.sin(targetYaw - state.yaw), Math.cos(targetYaw - state.yaw));
  return {
    ...state, targetYaw,
    yaw: state.yaw + deltaYaw * alpha,
    pitch: state.pitch + (state.targetPitch - state.pitch) * alpha,
    distance: state.distance + (state.targetDistance - state.distance) * alpha,
  };
}

// Bounded visual rotation only: never feeds movement or stored orbit state.
export function followImpactShake(remaining: number) {
  const t = clamp(1 - remaining / FOLLOW_CAMERA.shakeDuration, 0, 1);
  const envelope = Math.sin(Math.PI * t) * (1 - t) ** 2;
  return {
    x: Math.sin(t * Math.PI * 8) * envelope * 0.012,
    y: Math.sin(t * Math.PI * 11) * envelope * 0.008,
  };
}
