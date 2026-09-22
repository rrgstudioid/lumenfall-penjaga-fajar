import type { Object3D } from 'three';

export type CharacterRig = Record<
  'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head' |
  'rightUpperArm' | 'rightLowerArm' | 'rightHand' |
  'leftUpperArm' | 'leftLowerArm' | 'leftHand' |
  'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot' |
  'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot', Object3D>;
export type CharacterAction = 'basic_attack' | 'ranged_attack' | 'magic_cast' | 'dash' | 'hit';
export type CharacterMotion = { moving?: boolean; sprinting?: boolean; blocking?: boolean; dead?: boolean; speed?:number };

// The joints are Object3D pivots, not Bones or a SkinnedMesh skeleton.
// All pose offsets are local to the visual root; gameplay owns actor movement.
export function createProceduralAnimator(rig: CharacterRig) {
  const rest = Object.values(rig).map(joint => ({ joint, position: joint.position.clone(), rotation: joint.rotation.clone() }));
  const state = { time: 0, phase: 0, walk: 0, run: 0, death: 0, action: null as CharacterAction | null, actionTime: 0, duration: .3 };
  function update(dt: number, motion: CharacterMotion = {}) {
    dt = Math.max(0, dt);
    state.time += dt;
    const alpha = 1 - Math.exp(-12 * dt);
    state.walk += ((motion.moving && !motion.dead ? 1 : 0) - state.walk) * alpha;
    state.run += ((motion.sprinting ? 1 : 0) - state.run) * alpha;
    state.death += ((motion.dead ? 1 : 0) - state.death) * (1 - Math.exp(-5 * dt));
    state.phase += dt * (10 + state.run * 4);
    state.actionTime = Math.min(state.duration, state.actionTime + dt);
    if (state.actionTime >= state.duration) state.action = null;
    for (const { joint, position, rotation } of rest) { joint.position.copy(position); joint.rotation.copy(rotation); }

    const stride = Math.sin(state.phase) * state.walk * (.5 + state.run * .18);
    const alive = 1 - state.death;
    rig.rightUpperLeg.rotation.x += stride * alive;
    rig.leftUpperLeg.rotation.x -= stride * alive;
    rig.rightLowerLeg.rotation.x -= Math.max(0, -Math.sin(state.phase)) * state.walk * (.55 + state.run * .3) * alive;
    rig.leftLowerLeg.rotation.x -= Math.max(0, Math.sin(state.phase)) * state.walk * (.55 + state.run * .3) * alive;
    rig.rightFoot.rotation.x -= rig.rightLowerLeg.rotation.x * .35;
    rig.leftFoot.rotation.x -= rig.leftLowerLeg.rotation.x * .35;
    rig.rightUpperArm.rotation.x -= stride * .65 * alive;
    rig.leftUpperArm.rotation.x += stride * .65 * alive;
    rig.rightLowerArm.rotation.x += .12 + state.run * .45;
    rig.leftLowerArm.rotation.x += .12 + state.run * .45;
    rig.hips.position.y += (Math.sin(state.time * 2.2) * .008 + (1 - Math.cos(state.phase * 2)) * .018 * state.walk) * alive;
    rig.hips.rotation.z += Math.sin(state.phase) * .025 * state.walk * alive;
    rig.chest.rotation.y -= stride * .08;
    rig.spine.rotation.x += .06 * state.run * state.walk;
    rig.chest.scale.y = 1 + Math.sin(state.time * 2.2) * .006 * alive;
    if (motion.blocking) {
      rig.leftUpperArm.rotation.x += 1.1;
      rig.leftLowerArm.rotation.x += .45;
      rig.chest.rotation.y += .15;
    }
    if (state.action && !motion.dead) {
      const p = state.actionTime / state.duration;
      const pulse = Math.sin(Math.PI * p);
      if (state.action === 'basic_attack' || state.action === 'dash') {
        rig.chest.rotation.y += Math.sin(p * Math.PI * 2) * .5;
        rig.spine.rotation.x += pulse * .12;
        rig.rightUpperArm.rotation.x += pulse * 1.65;
        rig.rightUpperArm.rotation.z += pulse * .38;
        rig.rightLowerArm.rotation.x += pulse * .55;
        rig.rightHand.rotation.x -= pulse * .85;
        rig.rightHand.rotation.z -= pulse * .65;
        rig.leftUpperArm.rotation.x += pulse * .25;
        rig.root.position.z -= pulse * (state.action === 'dash' ? .16 : .07);
      } else if (state.action === 'ranged_attack') {
        rig.chest.rotation.y -= pulse * .35;
        rig.rightUpperArm.rotation.x += pulse * 1.25;
        rig.leftUpperArm.rotation.x += pulse * 1.3;
        rig.leftLowerArm.rotation.x += pulse * .8;
      } else if (state.action === 'magic_cast') {
        rig.rightUpperArm.rotation.x += pulse * 1.45;
        rig.leftUpperArm.rotation.x += pulse * 1.1;
        rig.rightLowerArm.rotation.x += pulse * .55;
        rig.leftLowerArm.rotation.x += pulse * .4;
        rig.chest.rotation.y += Math.sin(p * Math.PI * 2) * .15;
        rig.root.position.y += pulse * .025;
      } else if (state.action === 'hit') {
        rig.spine.rotation.x -= pulse * .14;
        rig.head.rotation.x -= pulse * .08;
      }
    }
    // A local crouch on defeat leaves the world anchor and collision unchanged.
    rig.hips.position.y -= state.death * .38;
    rig.rightUpperLeg.rotation.x += state.death * .7;
    rig.leftUpperLeg.rotation.x += state.death * .7;
    rig.rightLowerLeg.rotation.x -= state.death * 1.1;
    rig.leftLowerLeg.rotation.x -= state.death * 1.1;
    rig.spine.rotation.x += state.death * .65;
    rig.head.rotation.x += state.death * .3;
  }
  return {
    update,
    play(action: CharacterAction, duration = .3) {
      if (action === 'hit' && state.action) return;
      state.action = action; state.actionTime = 0; state.duration = Math.max(.1, duration);
    },
    reset() { Object.assign(state, { time: 0, phase: 0, walk: 0, run: 0, death: 0, action: null, actionTime: 0, duration: .3 }); update(0); },
    snapshot: () => ({ ...state }),
    restore(saved: typeof state) { Object.assign(state, saved); update(0); },
  };
}
