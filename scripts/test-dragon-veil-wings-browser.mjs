// Real shop/equipment flow and isolated fitting; never touches player browser storage.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createNewCharacter, SAVE_KEY } from '../lib/game/rules.ts';
import { CITIES } from '../lib/game/regions.ts';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const origin = process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000';
const out = 'work/dragon-veil-wings'; await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const hero = createNewCharacter('slot-1', 'Dragon Veil'); hero.gold = 0;
await context.addInitScript(({key,hero})=>{
  if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',lastPlayedCharacterId:hero.characterId,characters:{'slot-1':hero}}));
},{key:SAVE_KEY,hero});
const page=await context.newPage(), errors=[], failures=[], checks=[], fitting=[];
page.setDefaultTimeout(30000);
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
await page.route('**/lib/game/world.ts*',async route=>{
  const response=await route.fetch(); await route.fulfill({response,body:(await response.text()).replace('this.renderer = new T.WebGLRenderer','window.__wingsGame = this; this.renderer = new T.WebGLRenderer')});
});
const check=name=>{checks.push(name);console.log('PASS',name);};
const current=()=>page.evaluate(()=>structuredClone(window.__wingsGame.hero));
const dashboard=page.locator('[data-character-dashboard]');
async function enter(){
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();
  await page.waitForFunction(()=>window.__wingsGame?.started,{}, {timeout:120000});
}
try {
  await page.goto(origin); await enter();
  const npc=CITIES.arunika.npcList.find(n=>n.id==='aruna-developer-materials');
  assert(await page.evaluate(npc=>{
    const g=window.__wingsGame;g.hero.x=npc.x;g.hero.z=npc.z+1.7;g.placeActor();g.cameraFocus.copy(g.actor.position);g.pause(false);return g.openNpc(npc.id);
  },npc));
  const row=page.locator('[data-shop-item="dragon-veil-wings"]');
  await row.waitFor();await row.scrollIntoViewIfNeeded();
  assert((await row.innerText()).includes('Dragon Veil Wings'));
  assert.match(await row.innerText(),/0\s*GOLD/);
  const icon=row.locator('img');assert.equal(await icon.getAttribute('src'),'/assets/icons/items/dragon-veil-wings.webp');
  assert(await icon.evaluate(img=>img.complete&&img.naturalWidth===256));
  await page.mouse.move(20,20);
  await page.screenshot({path:`${out}/developer-shop.png`});
  await row.getByRole('button',{name:/^Buy/}).click();
  await page.waitForFunction(()=>window.__wingsGame.hero.inventory.some(i=>i.templateId==='dragon-veil-wings'));
  const owned=(await current()).inventory.find(i=>i.templateId==='dragon-veil-wings');
  assert.equal((await current()).gold,0);check('Developer Material Lab grants Dragon Veil Wings with the generated icon for 0 GOLD');
  await page.keyboard.press('Escape');await page.keyboard.press('c');await dashboard.waitFor();
  await dashboard.locator('[data-equipment-slot="accessory"]').click();
  const popup=page.locator('.cs-equipment-popup');
  await popup.locator('.cs-candidate').filter({hasText:'Dragon Veil Wings'}).click();
  assert.equal((await current()).equipment.accessory,null);
  assert.match(await popup.innerText(),/500/);
  await popup.getByRole('button',{name:'Equip',exact:true}).click();
  await page.waitForFunction(()=>window.__wingsGame.actor.userData.accessoryStatus==='ready');
  assert.equal((await current()).equipment.accessory,owned.id);
  assert.match(await dashboard.locator('[data-character-stat="movementSpeed"]').innerText(),/600/);
  await page.waitForTimeout(1800);await page.screenshot({path:`${out}/character-equipped.png`});
  check('Real Accessories preview and equip load the GLB, showing 600% total movement speed');
  await page.keyboard.press('c');await dashboard.waitFor({state:'hidden'});
  await page.locator('canvas[aria-label="Dunia 3D Lumenfall"]').click({position:{x:700,y:550}});
  await page.waitForFunction(()=>!window.__wingsGame.paused);
  await page.evaluate(({x,z})=>{
    const g=window.__wingsGame;g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);
    const move=g.move.bind(g);let previous=g.elapsed;
    window.__wingsSpeeds=[];
    g.move=(dx,dz)=>{const dt=g.elapsed-previous;previous=g.elapsed;if(dt>0)window.__wingsSpeeds.push(Math.hypot(dx,dz)/dt);return move(dx,dz);};
  },{x:hero.x,z:hero.z});
  await page.keyboard.down('d');await page.waitForTimeout(650);await page.keyboard.up('d');
  const speeds=await page.evaluate(()=>window.__wingsSpeeds.slice(1));
  assert(speeds.length>1,JSON.stringify(speeds));assert(speeds.every(n=>Math.abs(n-6.2*1.22*6)<.01),JSON.stringify(speeds));
  check('Actual movement input uses six times the base movement speed');
  await page.evaluate(({x,z})=>{const g=window.__wingsGame;g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);},{x:hero.x,z:hero.z});
  await page.waitForTimeout(700);await page.screenshot({path:`${out}/world-equipped.png`});
  await page.evaluate(()=>window.__wingsGame.save());await page.reload();await enter();
  await page.waitForFunction(()=>window.__wingsGame.actor.userData.accessoryStatus==='ready');
  assert.equal((await current()).equipment.accessory,owned.id);
  await page.keyboard.press('c');await dashboard.waitFor();
  await dashboard.locator('[data-equipment-slot="accessory"]').click();
  await popup.getByRole('button',{name:'Unequip',exact:true}).click();
  assert.equal((await current()).equipment.accessory,null);
  assert.equal(await page.evaluate(()=>!!window.__wingsGame.actor.getObjectByName('DragonVeilWings')),false);
  assert.match(await dashboard.locator('[data-character-stat="movementSpeed"]').innerText(),/100/);
  check('Save/reload restores the model; unequip removes wings and restores 100% speed');
  await page.setViewportSize({width:1000,height:900});
  await page.goto(`${origin}/tests/browser/dragon-veil-wings-fixture.html`);
  await page.waitForFunction(()=>window.wingsQA?.model()?.actor.userData.modelStatus==='ready');
  for(const gender of ['male']){
    const idle=await page.evaluate(()=>window.wingsQA.build());
    assert.equal(idle.status,'ready');assert.equal(idle.parent,'Chest');assert(idle.bounds.min[1]>.05);
    for(const view of ['front','back','side','quarter']){
      await page.evaluate(v=>window.wingsQA.render(v),view);
      await page.screenshot({path:`${out}/${gender}-${view}.png`});
    }
    for(const pose of ['walk','run','attack']){
      const state=await page.evaluate(p=>window.wingsQA.pose(p,'quarter'),pose);
      assert.deepEqual(state.local,idle.local);assert.equal(state.parent,'Chest');
      fitting.push({gender,pose,...state});
      await page.screenshot({path:`${out}/${gender}-${pose}.png`});
    }
    check(`${gender}: wings fit the back and stay attached during walk, run and attack`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
}catch(error){
  await page.screenshot({path:`${out}/failure.png`});console.error(error);process.exitCode=1;
}finally{
  await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,failures,fitting},null,2));await browser.close();
}
