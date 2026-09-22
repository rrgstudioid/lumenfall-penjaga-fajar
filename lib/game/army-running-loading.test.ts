import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {ARMY_RUNNING_ASSET} from './army-running.ts';
import {loadRevision02Character,REVISION02_ANIMATED_ASSET} from './revision02-character.ts';
import {disposeCharacterModel} from './character-model.ts';
async function local(path:string){const b=await readFile(new URL('../../public'+path,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('optional animation failure preserves the body/old Run and retries on a later load',async()=>{
  const body=await local(REVISION02_ANIMATED_ASSET),motion=await local(ARMY_RUNNING_ASSET);
  const original=GLTFLoader.prototype.loadAsync,warn=console.warn;let attempts=0,bodyLoads=0;
  GLTFLoader.prototype.loadAsync=async(url)=>{
    if(url===ARMY_RUNNING_ASSET){if(++attempts===1)throw Error('simulated motion offline');return motion;}
    assert.equal(url,REVISION02_ANIMATED_ASSET);bodyLoads++;return body;
  };
  console.warn=()=>{};
  try{
    const fallback=await loadRevision02Character();
    assert.equal(fallback.userData.runningAnimationSource,'legacy-run');
    assert.equal(fallback.userData.lumenfallAnimations,body.animations);
    assert.ok(fallback.getObjectByName('MaleRig'));disposeCharacterModel(fallback);
    const recovered=await loadRevision02Character();
    assert.equal(recovered.userData.runningAnimationSource,'army-man-running-blender');
    assert.equal(bodyLoads,1);assert.equal(attempts,2);disposeCharacterModel(recovered);
  }finally{GLTFLoader.prototype.loadAsync=original;console.warn=warn;}
});
