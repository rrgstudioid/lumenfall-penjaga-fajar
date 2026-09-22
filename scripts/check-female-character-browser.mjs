// Isolated browser/profile: user's saves are never read or modified.
import assert from 'node:assert/strict';
import {writeFile,mkdir}from'node:fs/promises';
import {resolve}from'node:path';
import {pathToFileURL}from'node:url';
import {freshHero,SAVE_KEY}from'../lib/game/rules.ts';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=resolve('work/female-character');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:960}});
const old=freshHero();old.level=5;old.gold=123;old.characterName='Existing Male';
// Only seed once, so reload verifies actual persisted appearance.
await context.addInitScript(({key,hero})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',characters:{'slot-1':hero}}));},{key:SAVE_KEY,hero:old});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/lib/game/world.ts*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('this.renderer = new T.WebGLRenderer','window.__femaleQA=this; this.renderer = new T.WebGLRenderer')});});
async function ready(kind){await page.waitForFunction(kind=>window.__femaleQA?.actor.userData.modelStatus==='ready'&&window.__femaleQA.actor.userData.assetKind===kind,kind,{timeout:60000});}
try{
  await page.goto('http://localhost:3001/',{waitUntil:'networkidle',timeout:90000});await ready('male-revision-02');
  await page.getByRole('button',{name:/Slot kosong 2/}).click();
  await page.getByRole('button',{name:'Perempuan',exact:true}).click();await ready('female-rpg');
  assert.equal(await page.getByRole('button',{name:'Perempuan',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.primary-hotbar-panel').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await page.screenshot({path:resolve(out,'female-selection.png')});
  await page.getByRole('button',{name:'Buat karakter & mulai',exact:true}).click();await ready('female-rpg');
  await page.waitForFunction(()=>window.__femaleQA.started);
  await page.keyboard.down('w');await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__femaleQA.actor.userData.activeNativeAnimation),'Run');await page.keyboard.up('w');
  await page.waitForTimeout(500);
  const textures=await page.evaluate(()=>{
    const g=window.__femaleQA,result=[];g.actor.traverse(o=>{if(o.isSkinnedMesh){result.push({name:o.name,map:o.material.map?.image?.width,normal:o.material.normalMap?.image?.width});}});return result;
  });assert.ok(textures.length===8&&textures.every(t=>t.map>0));
  await page.evaluate(()=>{const g=window.__femaleQA;g.pause(true);g.updateCamera=()=>{};g.camera=g.freeCamera;g.hero.x=0;g.hero.z=20;g.placeActor();g.actor.rotation.y=0;g.characterModel.animator.reset();const a=g.host.clientWidth/g.host.clientHeight;Object.assign(g.camera,{left:-1.8*a,right:1.8*a,top:1.8,bottom:-1.8});g.camera.updateProjectionMatrix();});
  await page.addStyleTag({content:'body {visibility:hidden!important} canvas {visibility:visible!important}'});
  async function capture(name,offset,frames,moving){
    await page.evaluate(({offset,frames,moving})=>{const g=window.__femaleQA;for(let i=0;i<frames;i++)g.characterModel.animator.update(1/60,{moving,sprinting:moving,speed:7.564});g.actor.updateMatrixWorld(true);const p=g.actor.position;g.camera.position.set(p.x+offset[0],p.y+1.25+offset[1],p.z+offset[2]);g.camera.lookAt(p.x,p.y+1.2,p.z);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);},{offset,frames,moving});
    await page.screenshot({path:resolve(out,name+'.png')});
  }
  await capture('ingame-idle',[4,1,-5],1,false);
  await capture('ingame-run-side',[6,.2,0],60,true);
  await capture('ingame-run-front',[0,.2,-6],12,true);
  await capture('ingame-run-three-quarter',[4,1,-5],12,true);
  await page.evaluate(()=>window.__femaleQA.characterModel.animator.play('basic_attack',.3));
  await capture('ingame-attack',[4,1,-5],20,false);
  await capture('ingame-idle-after-attack',[4,1,-5],100,false);
  await page.reload({waitUntil:'networkidle'});await ready('male-revision-02');
  await page.locator('.save-slot-main').filter({hasText:'Adventurer 2'}).click();await ready('female-rpg');
  assert.equal(await page.evaluate(()=>window.__femaleQA.hero.gender),'female');
  await page.getByRole('button',{name:/Existing Male/}).filter({has:page.locator('strong')}).click();await ready('male-revision-02');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
  assert.equal(saved.characters['slot-1'].gold,123);assert.equal(saved.characters['slot-1'].level,5);
  assert.equal(saved.characters['slot-1'].gender,'male');assert.equal(saved.characters['slot-2'].gender,'female');
  await writeFile(resolve(out,'browser-report.json'),JSON.stringify({textures,oldSavePreserved:true,femaleSavePersisted:true,errors},null,2));
  console.log(JSON.stringify({textures,oldSavePreserved:true,femaleSavePersisted:true,errors}));assert.deepEqual(errors,[]);
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});console.log(await page.locator('body').innerText(),errors);throw error;}finally{await browser.close();}
