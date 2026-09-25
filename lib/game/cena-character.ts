import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneCharacterSource, type CharacterVisualProfile } from './revision02-character.ts';

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
};
let source: ReturnType<GLTFLoader['loadAsync']> | undefined;

export async function loadCenaCharacter() {
  source ??= new GLTFLoader().loadAsync(CENA_CHARACTER_ASSET).catch(error => {
    source = undefined;
    throw error;
  });
  const loaded = await source;
  const result = cloneCharacterSource(loaded.scene);
  result.userData.characterVisualProfile = CENA_CHARACTER_PROFILE;
  result.userData.preserveAuthoredAppearance = true;
  // Body + rig only. Never attach source Combo actions or old male native clips.
  result.userData.nativeAnimationsDisabled = true;
  result.userData.lumenfallAnimations = [];
  return result;
}
