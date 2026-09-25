import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createNewCharacter,SAVE_KEY} from '../lib/game/rules.ts';
import {chromium} from 'file:///C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='work/averion';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const hero=createNewCharacter('slot-1','Averion Tester');hero.lastPlayedAt=Date.now();
await page.addInitScript(({key,hero})=>{if(!localStorage.getItem('averion-qa-seeded')){localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',lastPlayedCharacterId:hero.characterId,characters:{'slot-1':hero}}));localStorage.setItem('averion-qa-seeded','1');}},{key:SAVE_KEY,hero});
await page.route('**/lib/game/world.ts*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('this.renderer = new T.WebGLRenderer','window.__averionQA = this; this.renderer = new T.WebGLRenderer')});});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name)=>{checks.push(name);console.log('PASS',name);};
async function resume(){await page.getByRole('button',{name:/Lanjutkan perjalanan|Continue/i}).first().click();await page.waitForFunction(()=>window.__averionQA?.started,{}, {timeout:120000});}
async function settled(id){await page.waitForFunction(id=>{const g=window.__averionQA;return g?.started&&!g.transitioning&&!g.regionLoadError&&g.hero.currentCity===id&&g.hero.inCity&&(id!=='averion'||g.averion);},id,{timeout:120000});await page.waitForTimeout(400);}
try{
 await page.goto('http://localhost:3000/');await resume();await settled('arunika');
 await page.keyboard.press('m');
 const card=page.locator('.region-card').filter({has:page.getByRole('heading',{name:'Averion',exact:true})});
 await card.getByRole('button',{name:'Masuk kota'}).click();await settled('averion');
 const initial=await page.evaluate(()=>{const g=window.__averionQA;return {name:g.snapshot().cityName,map:g.snapshot().mapId,position:[g.hero.x,g.hero.z],spawn:g.averion.spawn,scale:g.averion.root.scale.toArray(),enemies:g.enemies.length,valid:g.averion.collision.valid(g.hero),far:g.camera.far,metrics:g.averion.metrics()};});
 assert.equal(initial.name,'Averion');assert.equal(initial.map,'averion');assert(initial.valid);assert.deepEqual(initial.position,[initial.spawn.x,initial.spawn.z]);assert.deepEqual(initial.scale,[1,1,1]);assert.equal(initial.enemies,0);assert.equal(initial.far,650);check('Main Map menu enters Averion at Stage03 spawn with same character');
 await page.screenshot({path:`${out}/averion-entry.png`});
 await page.locator('canvas[aria-label="Dunia 3D Lumenfall"]').click({position:{x:700,y:500}});
 await page.keyboard.down('d');await page.waitForTimeout(700);await page.keyboard.up('d');
 const moved=await page.evaluate(()=>{const g=window.__averionQA;return {x:g.hero.x,z:g.hero.z,valid:g.averion.collision.valid(g.hero)};});
 assert(moved.valid&&Math.hypot(moved.x-initial.position[0],moved.z-initial.position[1])>1);check('Actual game WASD moves with Averion collision');
 const boundary=await page.evaluate(()=>{const g=window.__averionQA;const gate=g.averion.move({x:0,z:96},0,30);g.hero.x=NaN;g.hero.z=NaN;g.placeActor();return {gate,recovered:g.hero.x===g.averion.spawn.x&&g.hero.z===g.averion.spawn.z};});assert(boundary.gate.z<104&&boundary.recovered);check('Closed gate and invalid-position spawn recovery retained');
 await page.evaluate(()=>window.__averionQA.save());await page.reload();await resume();await settled('averion');check('Continue reload restores Averion in main game');
 const cycles=[];
 for(let i=0;i<2;i++){
  await page.evaluate(()=>window.__averionQA.changeRegion('arunika'));await settled('arunika');
  assert(await page.evaluate(()=>!window.__averionQA.averion&&window.__averionQA.terrain.visible&&window.__averionQA.enemies.length>0));
  await page.evaluate(()=>window.__averionQA.changeRegion('averion'));await settled('averion');
  cycles.push(await page.evaluate(()=>({roots:window.__averionQA.regionDecor.children.length,canvases:document.querySelectorAll('canvas[aria-label="Dunia 3D Lumenfall"]').length,memory:window.__averionQA.renderer.info.memory})));
 }assert.equal(cycles[0].roots,1);assert.equal(cycles[1].canvases,1);assert.deepEqual(cycles[0].memory,cycles[1].memory);check('Arunika return and two Averion re-entries dispose resources without duplication');
 await page.evaluate(()=>window.__averionQA.changeRegion('arunika'));await settled('arunika');
 await page.route('**/assets/maps/averion/runtime/collision.glb.gz',r=>r.abort());
 await page.evaluate(()=>window.__averionQA.changeRegion('averion'));
 await page.getByRole('alertdialog',{name:'Map gagal dimuat'}).waitFor({timeout:120000});
 const stopped=await page.evaluate(()=>{const g=window.__averionQA;const x=g.hero.x,z=g.hero.z;g.move(10,10);return x===g.hero.x&&z===g.hero.z&&!g.averion;});assert(stopped);check('Failed asset loading blocks movement and shows ERROR/Retry');
 await page.screenshot({path:`${out}/averion-error-retry.png`});
 await page.unroute('**/assets/maps/averion/runtime/collision.glb.gz');await page.getByRole('button',{name:'Retry',exact:true}).click();await settled('averion');check('Retry loads Averion successfully');
 const paths=JSON.parse(await readFile('dev-prototypes/mahkota-fajar-stage03-v1/evidence/pilot-browser.json','utf8')).routes;
 const routes=await page.evaluate(paths=>{const g=window.__averionQA;const results=paths.map(route=>{g.hero.x=route.points[0].x;g.hero.z=route.points[0].z;g.placeActor();let pass=true;for(const p of route.points.slice(1)){for(let step=0;step<100;step++){const dx=p.x-g.hero.x,dz=p.z-g.hero.z,d=Math.hypot(dx,dz);if(d<.02)break;g.move(dx/d*Math.min(.1,d),dz/d*Math.min(.1,d));}if(Math.hypot(p.x-g.hero.x,p.z-g.hero.z)>.1||!g.averion.collision.valid(g.hero)){pass=false;break;}}return {target:route.target,reverse:route.reverse,pass};});g.hero.x=g.averion.spawn.x;g.hero.z=g.averion.spawn.z;g.placeActor();return results;},paths);
 assert.equal(routes.length,18);assert(routes.every(r=>r.pass),JSON.stringify(routes));check('18 district routes traverse both directions through main Game.move');
 await page.waitForTimeout(500);
 const perf=await page.evaluate(async()=>{const g=window.__averionQA,t=[];let last=performance.now(),draws=0,triangles=0;for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();t.push(now-last);last=now;draws=Math.max(draws,g.renderer.info.render.calls);triangles=Math.max(triangles,g.renderer.info.render.triangles);}t.sort((a,b)=>a-b);const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {average:t.reduce((a,b)=>a+b)/t.length,p95:t[Math.floor(t.length*.95)],draws,triangles,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',browser:navigator.userAgent};});
 await page.screenshot({path:`${out}/averion-final.png`});assert.deepEqual(errors,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({checks,initial,cycles,routes,perf,errors},null,2));console.log(perf);
}catch(e){await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify({checks,errors,body:await page.locator('body').innerText(),error:String(e)},null,2));throw e;}finally{await browser.close();}
