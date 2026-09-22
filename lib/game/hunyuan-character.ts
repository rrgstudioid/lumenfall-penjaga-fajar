import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneCharacterSource } from './revision02-character.ts';

export const HUNYUAN_CHARACTER_ASSET = '/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb';
export const HUNYUAN_CHARACTER_TRIANGLES = 159660;
export const HUNYUAN_CHARACTER_PROFILE = {
  assetKind: 'astra-hunyuan',
  visualName: 'AstraHunyuanVisual',
  triangles: HUNYUAN_CHARACTER_TRIANGLES,
};
let source: ReturnType<GLTFLoader['loadAsync']> | undefined;

export async function loadHunyuanCharacter() {
  source ??= new GLTFLoader().loadAsync(HUNYUAN_CHARACTER_ASSET).catch(error => {
    source = undefined;
    throw error;
  });
  const loaded = await source;
  const result = cloneCharacterSource(loaded.scene);
  // These clips are baked to Astra's own bind pose, including its grounded Army Run.
  // Replacing Run with raw revision-02 transforms would distort this shorter skeleton.
  result.userData.lumenfallAnimations = loaded.animations;
  result.userData.runningAnimationSource = 'army-man-running-blender';
  result.userData.characterVisualProfile = HUNYUAN_CHARACTER_PROFILE;
  return result;
}
