import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const ARMY_RUNNING_ASSET='/assets/animations/army-running/army-running-revision02.glb';
// Measured support-foot travel at 1x playback on the game's 2.4-unit character.
// Matching this stride to actual displacement reduces skating without changing movement speed.
export const ARMY_RUNNING_REFERENCE_SPEED=5.2;
export const armyRunningCadence=(speed=ARMY_RUNNING_REFERENCE_SPEED)=>T.MathUtils.clamp(speed/ARMY_RUNNING_REFERENCE_SPEED,.5,2.4);
let running:Promise<T.AnimationClip>|undefined;

export function prepareArmyRunningClip(clips:T.AnimationClip[]) {
  const source=clips.find(c=>c.name==='Run_Army')??clips[0];
  if(!source)throw new Error('Army running GLB has no animation');
  const clip=source.clone();clip.name='Run';
  // The target bind hierarchy and all child translations stay authoritative.
  // Only rotations + cyclic pelvis movement are needed for the imported motion.
  clip.tracks=clip.tracks.filter(track=>track.name.endsWith('.quaternion')||track.name==='Hips.position');
  if(!['ThighL','ThighR','ShinL','ShinR','UpperArmL','UpperArmR'].every(name=>clip.tracks.some(t=>t.name===name+'.quaternion')))
    throw new Error('Army running animation does not match Revision 02 bones');
  const start=Math.min(...clip.tracks.map(track=>track.times[0]));
  for(const track of clip.tracks)track.shift(-start);
  clip.resetDuration();
  return clip;
}

export function loadArmyRunningClip() {
  running??=new GLTFLoader().loadAsync(ARMY_RUNNING_ASSET).then(gltf=>prepareArmyRunningClip(gltf.animations))
    .catch(error=>{running=undefined;throw error;});
  return running;
}

export function replaceRunningClip(existing:T.AnimationClip[],run:T.AnimationClip) {
  return [...existing.filter(clip=>clip.name!=='Run'),run];
}
