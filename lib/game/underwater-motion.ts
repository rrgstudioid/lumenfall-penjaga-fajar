import type {
  CharacterAction,
  CharacterMotion,
  CharacterRig,
} from './character-animation.ts';

/** Presentation only. Never receives or mutates gameplay coordinates or action clocks. */
export function applyUnderwaterPose(
  rig: CharacterRig,
  motion: CharacterMotion,
  time: number,
  swim: number,
  movement: number,
  death: number,
  action: CharacterAction | null,
  actionPhase: number,
) {
  if (swim <= 0) return;
  const alive = 1 - death,
    kick = Math.sin(time * 5.2),
    wave = Math.sin(time * 1.7);
  const active = action !== null && !motion.dead;
  const forward = Math.max(-1, Math.min(1, motion.localForward ?? 1));
  const side = Math.max(-1, Math.min(1, motion.localRight ?? 0));
  // Local -Z is forward. Pivot the visual body around hip height, not the feet.
  const pitch =
    (-0.65 - movement * 0.6 * (forward < -0.2 ? 0.45 : 1) + death * 0.12) *
    swim;
  rig.root.rotation.x += pitch;
  rig.root.rotation.z +=
    (side * movement * 0.15 +
      Math.max(-1, Math.min(1, motion.turn ?? 0)) * 0.12) *
    swim *
    alive;
  rig.root.position.y +=
    (1.55 - Math.cos(pitch) * 0.95 + wave * 0.055 * alive + death * 0.15) *
    swim;
  rig.root.position.z -= Math.sin(pitch) * 0.95;
  rig.hips.position.y += death * 0.38 * swim; // cancel the ground defeat crouch
  rig.rightUpperLeg.rotation.x +=
    (0.3 + kick * (0.09 + movement * 0.18)) * swim * alive - death * 0.5 * swim;
  rig.leftUpperLeg.rotation.x +=
    (0.3 - kick * (0.09 + movement * 0.18)) * swim * alive - death * 0.5 * swim;
  rig.rightLowerLeg.rotation.x +=
    (-0.5 - Math.max(0, -kick) * (0.08 + movement * 0.22)) * swim * alive +
    death * 0.7 * swim;
  rig.leftLowerLeg.rotation.x +=
    (-0.5 - Math.max(0, kick) * (0.08 + movement * 0.22)) * swim * alive +
    death * 0.7 * swim;
  rig.rightFoot.rotation.x -= 0.22 * swim * alive;
  rig.leftFoot.rotation.x -= 0.22 * swim * alive;
  const arms = active || motion.blocking ? 0.18 : 1;
  rig.rightUpperArm.rotation.x -=
    (0.38 + wave * 0.13 + movement * 0.28) * swim * alive * arms;
  rig.leftUpperArm.rotation.x -=
    (0.38 - wave * 0.13 + movement * 0.28) * swim * alive * arms;
  rig.rightUpperArm.rotation.z += 0.28 * swim * alive * arms;
  rig.leftUpperArm.rotation.z -= 0.28 * swim * alive * arms;
  rig.rightLowerArm.rotation.x += 0.22 * swim * alive;
  rig.leftLowerArm.rotation.x += 0.22 * swim * alive;
  rig.head.rotation.x -= pitch * 0.58 * alive;
  if (action === 'dash')
    rig.root.rotation.x -= Math.sin(Math.PI * actionPhase) * 0.2 * swim;
  rig.root.rotation.z += death * 0.2 * swim;
}
