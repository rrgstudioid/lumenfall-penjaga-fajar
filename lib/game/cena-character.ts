import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneCharacterSource, type CharacterVisualProfile } from './revision02-character.ts';
import { loadCenaLegacyMotion } from './cena-motion.ts';
import { applyCenaChinContour } from './cena-chin.ts';

export const CENA_CHARACTER_ASSET = '/assets/characters/cena/cena-rigged.glb';
export const CENA_CHARACTER_TRIANGLES = 374735;
export const CENA_CHARACTER_PROFILE: CharacterVisualProfile = {
  assetKind: 'cena', visualName: 'CenaVisual', triangles: CENA_CHARACTER_TRIANGLES,
  jointNames: {
    hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'head',
    rightUpperArm: 'upperarm_r', rightLowerArm: 'lowerarm_r', rightHand: 'hand_r',
    leftUpperArm: 'upperarm_l', leftLowerArm: 'lowerarm_l', leftHand: 'hand_l',
    rightUpperLeg: 'thigh_r', rightLowerLeg: 'calf_r', rightFoot: 'foot_r',
    leftUpperLeg: 'thigh_l', leftLowerLeg: 'calf_l', leftFoot: 'foot_l',
  },
  useWeaponSocketOrientation: true,
  // Relax the exported A-stance without touching its skin bind matrices.
  // Small elbow bend, upper arms beside torso, hip-width feet with flat soles.
  restPose: {
    rightUpperArm: [-.05, 0, -.34], leftUpperArm: [-.05, 0, .34],
    rightLowerArm: [-.16, 0, 0], leftLowerArm: [-.16, 0, 0],
    rightHand: [0, -.4, 0], leftHand: [0, .4, 0],
    rightUpperLeg: [0, 0, -.085], leftUpperLeg: [0, 0, .085],
    rightFoot: [0, 0, .085], leftFoot: [0, 0, -.085],
  },
  preserveRestFootHeight: true,
};
let source: ReturnType<GLTFLoader['loadAsync']> | undefined;

export async function loadCenaCharacter() {
  source ??= new GLTFLoader().loadAsync(CENA_CHARACTER_ASSET).catch(error => {
    source = undefined;
    throw error;
  });
  const [loaded, legacyMotion] = await Promise.all([source, loadCenaLegacyMotion().catch(error => {
    console.warn('Animasi lama Cena gagal dimuat; gerak procedural tetap tersedia.', error);
    return [];
  })]);
  const result = cloneCharacterSource(loaded.scene);
  applyCenaChinContour(result);
  // Blender's grip +Y becomes local -Z on an exported glTF empty (bones use
  // a different basis). The equipment contract expects the blade along +Y.
  // Normalize the cloned sockets once, never the cached source or hand bones.
  for (const side of ['R', 'L']) {
    const socket = result.getObjectByName('WeaponSocket' + side);
    if (!socket) throw new Error(`Cena missing WeaponSocket${side}`);
    socket.rotateX(-Math.PI / 2);
  }
  result.userData.characterVisualProfile = CENA_CHARACTER_PROFILE;
  result.userData.preserveAuthoredAppearance = true;
  // This rig's grip makes the procedural blade width upright already. Meteor
  // must not add the legacy rig's extra quarter-turn and flatten its broad face.
  result.userData.importedSwordGripRoll = 0;
  // Ignore ALL actions embedded in Cena. Only the separately retargeted old
  // gameplay Walk / Army Run / three attacks are approved for this rig.
  result.userData.cenaSourceAnimationsDisabled = true;
  result.userData.lumenfallAnimations = legacyMotion;
  result.userData.runningAnimationSource = 'army-man-running-blender';
  result.userData.motionSource = 'astra-retargeted-to-cena';
  return result;
}
