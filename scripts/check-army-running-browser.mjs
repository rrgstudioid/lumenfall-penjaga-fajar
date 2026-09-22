// Isolated QA profile; never reads or changes the player's save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY, createItem } from '../lib/game/rules.ts';
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=resolve('work/army-running');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const hero=freshHero();hero.characterName='Running QA';hero.kills=1;
const sword=createItem('legacy-fajar-blade');hero.inventory.push(sword);hero.equipment.mainHand=sword.id;
await context.addInitScript(({key,hero})=>localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',characters:{'slot-1':hero}})),{key:SAVE_KEY,hero});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/lib/game/world.ts*',async route=>{
  const response=await route.fetch();const body=(await response.text()).replace('this.renderer = new T.WebGLRenderer','window.__runningQA = this; this.renderer = new T.WebGLRenderer');
  await route.fulfill({response,body});
});
try{
  await page.goto('http://localhost:3001/',{waitUntil:'networkidle',timeout:90000});
  await page.getByRole('button',{name:'Lanjutkan perjalanan',exact:true}).click();
  await page.waitForFunction(()=>window.__runningQA?.started&&window.__runningQA.actor.userData.modelStatus==='ready',null,{timeout:60000});
  const loaded=await page.evaluate(()=>({source:window.__runningQA.actor.userData.runningAnimationSource,animations:window.__runningQA.actor.userData.nativeAnimations}));
  assert.equal(loaded.source,'army-man-running-blender');
  await page.keyboard.down('w');await page.waitForTimeout(650);
  const movement=await page.evaluate(()=>({active:window.__runningQA.actor.userData.activeNativeAnimation,x:window.__runningQA.hero.x,z:window.__runningQA.hero.z}));
  await page.keyboard.up('w');assert.equal(movement.active,'Run');
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__runningQA.actor.userData.activeNativeAnimation),'');
  await page.evaluate(()=>{
    const g=window.__runningQA;g.pause(true);g.updateCamera=()=>{};g.camera=g.freeCamera;
    g.hero.x=0;g.hero.z=20;g.placeActor();g.actor.rotation.y=0;
    g.characterModel.animator.reset();
    const a=g.host.clientWidth/g.host.clientHeight;Object.assign(g.camera,{left:-1.8*a,right:1.8*a,top:1.8,bottom:-1.8});
    g.camera.updateProjectionMatrix();
  });
  await page.addStyleTag({content:'body { visibility:hidden !important; } canvas { visibility:visible !important; }'});
  async function capture(name,offset,frames,moving){
    const pose=await page.evaluate(({offset,frames,moving})=>{
      const g=window.__runningQA;for(let i=0;i<frames;i++)g.characterModel.animator.update(1/60,{moving,sprinting:moving,speed:7.564});
      g.actor.updateMatrixWorld(true);const p=g.actor.position;
      g.camera.position.set(p.x+offset[0],p.y+1.25+offset[1],p.z+offset[2]);g.camera.lookAt(p.x,p.y+1.2,p.z);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);
      return {active:g.actor.userData.activeNativeAnimation,position:p.toArray()};
    },{offset,frames,moving});
    await page.screenshot({path:resolve(out,`${name}.png`)});return pose;
  }
  await capture('idle-before',[4,1,-5],1,false);
  await capture('run-side-00',[6,.2,0],60,true);
  await capture('run-side-12',[6,.2,0],12,true);
  await capture('run-side-24',[6,.2,0],12,true);
  await capture('run-side-36',[6,.2,0],12,true);
  await capture('run-front',[0,.2,-6],12,true);
  await capture('run-three-quarter',[4,1,-5],12,true);
  await capture('idle-after',[4,1,-5],40,false);
  await page.evaluate(()=>window.__runningQA.characterModel.animator.play('basic_attack',.3));
  await capture('attack',[4,1,-5],20,false);
  await capture('idle-after-attack',[4,1,-5],100,false);
  assert.equal(await page.evaluate(()=>window.__runningQA.actor.userData.activeNativeAnimation),'');
  await writeFile(resolve(out,'browser-report.json'),JSON.stringify({loaded,movement,errors},null,2));
  console.log(JSON.stringify({loaded,movement,errors}));assert.deepEqual(errors,[]);
}catch(error){await page.screenshot({path:resolve(out,'qa-failure.png')});console.log('FAILURE',await page.locator('body').innerText(),errors);throw error;}finally{await browser.close();}
