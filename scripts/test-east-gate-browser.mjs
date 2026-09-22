// Isolated disposable profile. Only local development responses receive a QA handle.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {freshHero,SAVE_KEY} from '../lib/game/rules.ts';
import {EAST_GATE_TERRAIN as t,terrainWalkable,terrainRiverZ} from '../lib/game/field-terrain.ts';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=resolve('work/east-gate');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const hero=freshHero();hero.characterName='East Gate QA';hero.inCity=true;hero.gold=3000;
await context.addInitScript(({key,hero})=>{if(!localStorage.getItem('east-qa-seeded')){localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',characters:{'slot-1':hero}}));localStorage.setItem('east-qa-seeded','1');}},{key:SAVE_KEY,hero});
const page=await context.newPage(),errors=[],failedAssets=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)failedAssets.push(`${r.status()} ${r.url()}`);});
await page.route('**/lib/game/world.ts*',async route=>{const r=await route.fetch();const body=(await r.text()).replace('this.renderer = new T.WebGLRenderer','window.__terrainQA = this; this.renderer = new T.WebGLRenderer');await route.fulfill({response:r,body});});
const check=name=>{checks.push(name);console.log('PASS',name);};
async function resume(){await page.getByRole('button',{name:/^(Lanjutkan perjalanan|Buat karakter & mulai)$/}).click();await page.waitForFunction(()=>window.__terrainQA?.started);await page.waitForTimeout(300);}
async function place(x,z){await page.evaluate(({x,z})=>{const g=window.__terrainQA;g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);g.dead=false;g.invincible=0;g.actor.visible=true;g.zoom=20;g.cameraZoom.halfHeight=20;g.pause(false);},{x,z});await page.waitForTimeout(220);}
async function clickWorld(x,z,height){const p=await page.evaluate(({x,z,height})=>{const g=window.__terrainQA,p=g.actor.position.clone().set(x,g.groundHeight(x,z)+height,z).project(g.camera),r=g.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};},{x,z,height});await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);}
async function npcOpen(){await place(t.camp.x,t.camp.z+1.7);await clickWorld(t.camp.x,t.camp.z,1.1);await page.getByRole('dialog').getByRole('heading',{name:'Penjaga Pos Timur',exact:true}).waitFor();}
async function snap(name){await page.screenshot({path:resolve(out,`${name}.png`)});}
try{
  await page.goto('http://localhost:3001/',{waitUntil:'networkidle'});await resume();
  assert(await page.evaluate(()=>window.__terrainQA.hero.inCity));
  await page.keyboard.press('m');
  const eastCard=page.locator('.region-card').filter({has:page.getByRole('heading',{name:'East Gate Arunika',exact:true})});
  await eastCard.getByRole('button',{name:'Teleport field',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.__terrainQA.hero.currentField),t.id);check('Kota Arunika map menu travels to new East Gate at level 1');
  const spawns=await page.evaluate(()=>{const g=window.__terrainQA;return g.enemies.map(e=>({id:e.id,x:e.home.x,z:e.home.z,y:e.home.y,hp:e.hp,max:e.max,ground:g.groundHeight(e.home.x,e.home.z)}));});
  assert.equal(spawns.length,42);assert.equal(spawns.filter(e=>e.id<36).length,36);assert.equal(spawns.filter(e=>e.id>=90&&e.id<100).length,5);assert.equal(spawns.filter(e=>e.id===100).length,1);
  for(const e of spawns){assert(terrainWalkable(t,e,.55,true));assert(Math.abs(e.y-e.ground)<.001);assert.equal(e.hp,e.max);}check('all 36 normals, 5 elite and 1 boss spawn above valid surfaces');
  const before=await page.evaluate(()=>({x:window.__terrainQA.hero.x,z:window.__terrainQA.hero.z}));
  await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
  const after=await page.evaluate(()=>({x:window.__terrainQA.hero.x,z:window.__terrainQA.hero.z}));assert(Math.hypot(after.x-before.x,after.z-before.z)>.5);check('WASD movement remains responsive');
  for(const [name,x,z] of [['entry',-43,20],['village',-20,24],['wetland',3,25],['harbor',20,43],['bridge',30,terrainRiverZ(t,30)],['boss',12,-23],['portal',49,-5]]){
    await place(x,z);await page.evaluate(()=>window.__terrainQA.pause(true));await snap(name);
  }
  const metrics=await page.evaluate(()=>{const g=window.__terrainQA;return {draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,hiddenSquare:!g.terrain.visible};});
  assert(metrics.hiddenSquare);check('new organic renderer hides rectangular legacy terrain');
  await place(0,0);await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);g.zoom=63;g.cameraZoom.halfHeight=63;});await page.waitForTimeout(300);await snap('overview');
  if(process.env.EAST_GATE_VISUAL_ONLY==='1'){console.log(JSON.stringify(metrics));process.exitCode=0;}else{
    const river=terrainRiverZ(t,10);await place(10,river+8);
    const blocked=await page.evaluate(()=>{const g=window.__terrainQA;g.move(0,-30);return {x:g.hero.x,z:g.hero.z};});assert(blocked.z>river+2.7);check('runtime water collision blocks crossing without bridge');
    for(const b of t.bridges.filter(b=>b.kind!=='dock')){
      await place(b.x,b.z+10);const end=await page.evaluate(()=>{const g=window.__terrainQA;g.move(0,-20);return {x:g.hero.x,z:g.hero.z,y:g.actor.position.y,ground:g.groundHeight(g.hero.x,g.hero.z)};});
      assert(Math.abs(end.z-(b.z-10))<.1);assert.equal(end.y,end.ground);
    }check('both bridges cross their visible collision decks');
    const b=t.bridges[1];
    const ai=await page.evaluate(({x,z})=>{const g=window.__terrainQA;g.pause(true);const e=g.enemies.find(e=>e.id===0),home=e.home.clone();e.group.position.set(x,g.groundHeight(x,z+7),z+7);e.navigation=undefined;const points=[];for(let i=0;i<420;i++){g.elapsed+=1/30;g.followTerrain(e,{x,z:z-10},e.movementSpeed,1/30);points.push({x:e.group.position.x,z:e.group.position.z,y:e.group.position.y,ground:g.groundHeight(e.group.position.x,e.group.position.z)});}e.group.position.copy(home);e.navigation=undefined;return points;},b);
    for(const p of ai){assert(terrainWalkable(t,p,.55,true));assert(Math.abs(p.y-p.ground)<.001);}assert(ai.at(-1).z<b.z-8);check('monster AI navigates bridge without sinking or entering water');
    for(const p of [t.bridges[0],t.arena,{x:-20,z:24},t.exit]){
      await place(p.x,p.z);await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);g.zoom=12;});await page.waitForTimeout(1200);
      const camera=await page.evaluate(()=>{const g=window.__terrainQA;return {blend:g.cameraZoom.blend,y:g.camera.position.y,floor:g.groundHeight(g.camera.position.x,g.camera.position.z)};});
      assert(camera.blend>.95);assert(camera.y>=camera.floor+1.19);
    }check('eye-level camera remains above bridge, hills, village and portal terrain');
    await npcOpen();const npc=page.getByRole('dialog');check('clicking Penjaga Pos Timur opens existing camp panel');
    const gold=await page.evaluate(()=>window.__terrainQA.hero.gold);
    await npc.locator('[data-shop-item="health-potion-1"]').getByRole('button',{name:'Buy',exact:true}).click();assert((await page.evaluate(()=>window.__terrainQA.hero.gold))<gold);check('camp Buy spends GOLD and adds existing item');
    await npc.getByRole('button',{name:'Sell',exact:true}).click();const sellGold=await page.evaluate(()=>window.__terrainQA.hero.gold);
    await npc.locator('.sell-row').filter({hasText:'Health Potion I'}).first().click();await npc.getByRole('button',{name:'Jual',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Confirm',exact:true}).click();assert((await page.evaluate(()=>window.__terrainQA.hero.gold))>sellGold);check('camp Sell confirmation credits GOLD');
    assert(!(await npc.innerText()).includes('Padang Arunika · Easy'));
    await npc.locator('.shop-row').filter({hasText:'East Gate Arunika · Easy'}).getByRole('button',{name:'Ambil Quest',exact:true}).click();
    assert(await page.evaluate(()=>window.__terrainQA.hero.activeQuests.includes('field-east-gate-arunika-easy')));check('camp accepts only its unique East Gate quest');
    await npc.getByRole('button',{name:'Close',exact:true}).first().click();
    await page.evaluate(()=>{const g=window.__terrainQA,e=g.enemies.find(e=>e.id===0);g.hero.x=e.home.x+1.5;g.hero.z=e.home.z;g.placeActor();g.attackTimer=0;g.pause(false);g.attack(true);});
    assert(await page.evaluate(()=>{const e=window.__terrainQA.enemies.find(e=>e.id===0);return e.hp<e.max;}));check('basic combat damages shared Small Slime template');
    const deaths=await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);for(const id of [0,1,2,3,4,90,100]){const e=g.enemies.find(e=>e.id===id);if(e.hp>0)g.hurtEnemy(e,100000,0);}g.save();return {deadlines:g.enemies.filter(e=>[0,90,100].includes(e.id)).map(e=>[e.id,e.respawnDeadline,e.respawn]),progress:g.hero.fieldProgress['east-gate-arunika'],oldProgress:g.hero.fieldProgress['verdant-plains']??0};});
    assert(deaths.progress>=5);assert.equal(deaths.oldProgress,0);assert.deepEqual(deaths.deadlines.map(e=>e[2]),[25,60,120]);check('kills advance East quest only and keep normal/elite/boss timers');
    await npcOpen();await npc.getByRole('button',{name:'Selesaikan Quest',exact:true}).first().click();assert(await page.evaluate(()=>window.__terrainQA.hero.completedQuests.includes('field-east-gate-arunika-easy')));check('quest reward button completes the East quest');
    await npc.getByRole('button',{name:'Close',exact:true}).first().click();await page.evaluate(()=>window.__terrainQA.save());
    await page.reload({waitUntil:'networkidle'});await resume();
    const restored=await page.evaluate(()=>{const g=window.__terrainQA;return {boss:g.enemies.find(e=>e.id===100).respawnDeadline,hp:g.enemies.find(e=>e.id===100).hp,quest:g.hero.completedQuests.includes('field-east-gate-arunika-easy'),field:g.hero.currentField};});
    assert.equal(restored.boss,deaths.deadlines[2][1]);assert.equal(restored.hp,0);assert(restored.quest);assert.equal(restored.field,t.id);check('reload retains East field, completed quest and boss deadline');
    await page.evaluate(()=>window.__terrainQA.changeRegion('verdant-plains'));
    assert.equal(await page.evaluate(()=>window.__terrainQA.enemies.find(e=>e.id===100).hp),1900);check('Padang Ancient Treant is unaffected by East boss death');
    await page.evaluate(()=>window.__terrainQA.changeRegion('east-gate-arunika'));
    assert.equal(await page.evaluate(()=>window.__terrainQA.enemies.find(e=>e.id===100).hp),0);check('returning to East restores its own dead boss state');
    const respawned=await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);return [0,90,100].map(id=>{const e=g.enemies.find(e=>e.id===id);e.respawnDeadline=Date.now()-1;g.updateEnemy(e,.02);return {hp:e.hp,max:e.max,y:e.group.position.y,ground:g.groundHeight(e.home.x,e.home.z)};});});
    for(const e of respawned){assert.equal(e.hp,e.max);assert(Math.abs(e.y-e.ground)<.01);}check('expired timers respawn normal, elite and boss on safe terrain');
    await place(20,43);const respawn=await page.evaluate(()=>{const g=window.__terrainQA;g.dead=true;g.respawn();return {x:g.hero.x,z:g.hero.z};});assert.deepEqual(respawn,t.entry);check('player respawn returns safely to Gerbang Timur');
    await npcOpen();await npc.getByRole('button',{name:'Teleport',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Kembali ke kota'}).click();assert(await page.evaluate(()=>window.__terrainQA.hero.inCity));await page.keyboard.press('Escape');check('camp Teleport returns to Kota Arunika');
    await page.evaluate(()=>window.__terrainQA.changeRegion('east-gate-arunika'));await place(t.exit.x,t.exit.z+2);
    await page.evaluate(()=>{window.__terrainQA.hero.level=1;});await clickWorld(t.exit.x,t.exit.z,2.8);
    assert.equal(await page.evaluate(()=>window.__terrainQA.hero.currentField),t.id);assert((await page.locator('body').innerText()).includes('Membutuhkan level 8'));check('visible blue portal explains locked Ironveil requirement');
    await page.evaluate(()=>{window.__terrainQA.hero.level=8;});await clickWorld(t.exit.x,t.exit.z,2.8);
    assert.equal(await page.evaluate(()=>window.__terrainQA.hero.currentField),'ironveil-mines');assert(await page.evaluate(()=>window.__terrainQA.terrain.visible&&!window.__terrainQA.terrainSurface));check('blue Portal Travel enters untouched Ironveil at level 8');
    const fields=await page.evaluate(()=>{const g=window.__terrainQA;g.hero.level=50;return ['verdant-plains','ironveil-mines','whispering-wilds','frostfire-highlands','sunken-ruins','meteorfall-citadel','east-gate-arunika'].map(id=>{g.changeRegion(id);return {id,actual:g.hero.currentField,count:g.enemies.length,organic:!g.terrain.visible};});});
    for(const f of fields){assert.equal(f.id,f.actual);assert.equal(f.count,42);assert.equal(f.organic,['verdant-plains',t.id].includes(f.id));}check('all seven fields transition with original or opt-in renderer and 42 spawns');
    await place(t.cityGate.x+2,t.cityGate.z);await clickWorld(t.cityGate.x,t.cityGate.z,1.9);assert(await page.evaluate(()=>window.__terrainQA.hero.inCity));check('western gate physically returns to Kota Arunika');
    await page.evaluate(()=>{const g=window.__terrainQA;g.changeRegion('east-gate-arunika');g.hero.x=3;g.hero.z=18;g.save();});await page.reload({waitUntil:'networkidle'});await resume();
    const migrated=await page.evaluate(()=>{const g=window.__terrainQA;return {x:g.hero.x,z:g.hero.z,quest:g.hero.completedQuests.includes('field-east-gate-arunika-easy')};});assert(terrainWalkable(t,migrated));assert(migrated.quest);check('invalid saved water position relocates without wiping quest');
    for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);await place(t.entry.x,t.entry.z);await page.waitForTimeout(250);assert(await page.evaluate(()=>window.__terrainQA.renderer.domElement.width>0));await snap(`entry-${size.width}`);}check('field and HUD render at 1366×768 and 1920×1080');
    assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);check('no runtime/hydration/console errors or failed HTTP assets');
    await writeFile(resolve(out,'browser-results.json'),JSON.stringify({checks,metrics,errors,failedAssets},null,2));console.log(JSON.stringify(metrics));
  }
}catch(e){await snap('failure');await writeFile(resolve(out,'failure.json'),JSON.stringify({checks,errors,failedAssets,text:await page.locator('body').innerText()},null,2));throw e;}finally{await browser.close();}
