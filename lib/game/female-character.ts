import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {cloneCharacterSource} from './revision02-character.ts';
export const FEMALE_CHARACTER_ASSET='/assets/characters/female-rpg/female-rpg-rigged.glb';
export const FEMALE_CHARACTER_TRIANGLES=9389;
let source:ReturnType<GLTFLoader['loadAsync']>|undefined;
export async function loadFemaleCharacter(){
  source??=new GLTFLoader().loadAsync(FEMALE_CHARACTER_ASSET).catch(error=>{source=undefined;throw error;});
  const loaded=await source,result=cloneCharacterSource(loaded.scene);
  // These clips are baked to the female bind pose in Blender, not copied as raw male transforms.
  result.userData.lumenfallAnimations=loaded.animations;
  result.userData.runningAnimationSource='army-man-running-blender';
  return result;
}
