// Isolated browser profile; production and the player's saves are never touched.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {freshHero,SAVE_KEY} from '../lib/game/rules.ts';
import {VERDANT_TERRAIN,terrainWalkable,verdantRiverZ} from '../lib/game/field-terrain.ts';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=resolve('work/verdant-terrain');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const hero=freshHero();hero.characterName='Terrain QA';hero.inCity=false;hero.currentField='verdant-plains';Object.assign(hero,VERDANT_TERRAIN.entry);hero.level=10;hero.gold=2000;
await context.addInitScript(({key,hero})=>{if(!localStorage.getItem('terrain-qa-seeded')){localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',characters:{'slot-1':hero}}));localStorage.setItem('terrain-qa-seeded','1');}},{key:SAVE_KEY,hero});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Test-only handle inserted into the served dev module; no debug hook ships in source.
await page.route('**/lib/game/world.ts*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('this.renderer = new T.WebGLRenderer','window.__terrainQA = this; this.renderer = new T.WebGLRenderer');await route.fulfill({response:r,body});});
const check=name=>{checks.push(name);console.log('PASS',name);};
try {
  await page.goto('http://localhost:3001/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Lanjutkan perjalanan',exact:true}).click();
  await page.waitForFunction(()=>window.__terrainQA?.started);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>window.__terrainQA.enemies.length),42);check('real game loads with 42 monsters');
  await page.screenshot({path:resolve(out,'entry.png')});
  const before=await page.evaluate(()=>({x:window.__terrainQA.hero.x,z:window.__terrainQA.hero.z}));
  await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');
  const after=await page.evaluate(()=>({x:window.__terrainQA.hero.x,z:window.__terrainQA.hero.z}));
  assert(Math.hypot(after.x-before.x,after.z-before.z)>1);check('WASD moves on new terrain');
  for(const [name,x,z] of [['farm',-25,24],['bridge',25,-2.55],['temple',2,-28],['exit',40,-28]]) {
    await page.evaluate(({x,z})=>{const g=window.__terrainQA;g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);g.pause(true);},{x,z});
    await page.waitForTimeout(250);await page.screenshot({path:resolve(out,`${name}.png`)});
  }
  const metrics=await page.evaluate(()=>{const g=window.__terrainQA;return {draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,hiddenSquare:!g.terrain.visible};});
  assert(metrics.hiddenSquare);check('old square terrain is hidden only in prototype');
  // Wide landscape overview is captured from this same running scene, not an illustration.
  await page.evaluate(()=>{const g=window.__terrainQA;g.hero.x=0;g.hero.z=0;g.placeActor();g.cameraFocus.copy(g.actor.position);g.zoom=63;g.cameraZoom.halfHeight=63;});
  await page.waitForTimeout(200);await page.screenshot({path:resolve(out,'overview.png')});
  async function place(x,z) {
    await page.evaluate(({x,z})=>{const g=window.__terrainQA;g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);g.dead=false;g.invincible=0;g.actor.visible=true;g.zoom=20;g.cameraZoom.halfHeight=20;g.pause(false);},{x,z});
    await page.waitForTimeout(160);
  }
  async function clickNpc() {
    const p=await page.evaluate(()=>{const g=window.__terrainQA;const p=g.actor.position.clone().set(20,g.groundHeight(20,42)+1.1,42).project(g.camera);const r=g.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};});
    await page.mouse.click(p.x,p.y);
  }
  // Exercise collision through the actual Game adapter, not just the pure helpers.
  await place(8,verdantRiverZ(8)+8);
  const blocked=await page.evaluate(()=>{const g=window.__terrainQA;g.move(0,-30);return {x:g.hero.x,z:g.hero.z};});
  assert(blocked.z>verdantRiverZ(blocked.x)+2.5);assert(terrainWalkable(VERDANT_TERRAIN,blocked));check('runtime movement cannot cross water without a bridge');
  await place(25,verdantRiverZ(25)+10);
  const crossed=await page.evaluate(()=>{const g=window.__terrainQA;g.move(0,-20);return {x:g.hero.x,z:g.hero.z,y:g.actor.position.y,ground:g.groundHeight(g.hero.x,g.hero.z)};});
  assert(crossed.z<verdantRiverZ(25)-8);assert.equal(crossed.y,crossed.ground);check('runtime bridge movement reaches the opposite bank on its visible deck');
  const ai=await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);const e=g.enemies.find(e=>e.id===0);const home=e.home.clone();e.group.position.set(25,g.groundHeight(25,3),3);e.navigation=undefined;const points=[];for(let i=0;i<420;i++){g.elapsed+=1/30;g.followTerrain(e,{x:25,z:-13},e.movementSpeed,1/30);points.push({x:e.group.position.x,z:e.group.position.z,y:e.group.position.y,ground:g.groundHeight(e.group.position.x,e.group.position.z)});}e.group.position.copy(home);e.navigation=undefined;return points;});
  for(const p of ai){assert(terrainWalkable(VERDANT_TERRAIN,p,.55,true));assert(Math.abs(p.y-p.ground)<.001);}assert(ai.at(-1).z<-10);check('enemy terrain navigation crosses bridge without entering water or sinking');
  for(const [x,z] of [[25,-2.55],[-25,24],[2,-28],[40,-28]]) {
    await place(x,z);
    await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);g.zoom=12;});
    await page.waitForTimeout(1200);
    const close=await page.evaluate(()=>{const g=window.__terrainQA;return {blend:g.cameraZoom.blend,y:g.camera.position.y,floor:g.groundHeight(g.camera.position.x,g.camera.position.z),distance:Math.hypot(g.camera.position.x-g.actor.position.x,g.camera.position.z-g.actor.position.z)};});
    assert(close.blend>.95);assert(close.y>=close.floor+1.19);assert(close.distance>3.9);
  }
  check('existing eye-level zoom stays above terrain at bridge, farm, temple and cliff');
  await place(20,43.7);
  const respawn=await page.evaluate(()=>{const g=window.__terrainQA;g.dead=true;g.respawn();return {x:g.hero.x,z:g.hero.z,y:g.actor.position.y,ground:g.groundHeight(g.hero.x,g.hero.z)};});
  assert.equal(respawn.x,VERDANT_TERRAIN.entry.x);assert.equal(respawn.z,VERDANT_TERRAIN.entry.z);assert.equal(respawn.y,respawn.ground);check('player respawn returns to the safe field entry');
  await place(20,43.7);await clickNpc();
  const npc=page.getByRole('dialog');await npc.getByRole('heading',{name:'Penjaga Pos Arunika'}).waitFor();check('manual click opens camp at raised terrain height');
  const goldBefore=await page.evaluate(()=>window.__terrainQA.hero.gold);
  await npc.locator('[data-shop-item="health-potion-1"]').getByRole('button',{name:'Buy',exact:true}).click();
  assert((await page.evaluate(()=>window.__terrainQA.hero.gold))<goldBefore);check('camp Buy updates existing inventory and GOLD');
  await npc.getByRole('button',{name:'Sell',exact:true}).click();
  assert((await npc.innerText()).includes('Health Potion I'));check('camp Sell displays the same inventory');
  const sellGold=await page.evaluate(()=>window.__terrainQA.hero.gold);
  await npc.locator('.sell-row').filter({hasText:'Health Potion I'}).first().click();
  await npc.getByRole('button',{name:'Jual',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Confirm',exact:true}).click();
  assert((await page.evaluate(()=>window.__terrainQA.hero.gold))>sellGold);check('camp Sell confirmation credits GOLD');
  await npc.locator('.shop-row').filter({hasText:'Padang Arunika · Easy'}).getByRole('button',{name:'Ambil Quest',exact:true}).click();
  assert(await page.evaluate(()=>window.__terrainQA.hero.activeQuests.includes('field-verdant-plains-easy')));check('camp accepts the existing field quest through its button');
  await npc.getByRole('button',{name:'Close',exact:true}).first().click();
  await page.evaluate(()=>{const g=window.__terrainQA;const e=g.enemies.find(e=>e.id===0);g.hero.x=e.home.x+1.5;g.hero.z=e.home.z;g.placeActor();g.attackTimer=0;g.pause(false);g.attack(true);});
  assert(await page.evaluate(()=>window.__terrainQA.enemies.find(e=>e.id===0).hp<window.__terrainQA.enemies.find(e=>e.id===0).max));check('basic attack damages a monster on elevated terrain');
  const skill=await page.evaluate(()=>{const g=window.__terrainQA;g.skillCooldowns={};g.hero.mana=g.hero.maxMana;return g.castSkill(2);});assert(skill);check('existing active skill still casts');
  const deaths=await page.evaluate(()=>{const g=window.__terrainQA;g.pause(true);for(const e of g.enemies.filter(e=>e.id<5)){if(e.hp>0)g.hurtEnemy(e,100000,0);}const elite=g.enemies.find(e=>e.id===90);g.hurtEnemy(elite,100000,0);const boss=g.enemies.find(e=>e.id===100);g.hurtEnemy(boss,100000,0);g.save();return {normal:g.enemies[0].respawn,elite:elite.respawn,boss:boss.respawn,deadline:boss.respawnDeadline,inventory:g.hero.inventory.length,gold:g.hero.gold};});
  assert(deaths.normal>23&&deaths.normal<=25);assert.equal(deaths.elite,60);assert.equal(deaths.boss,120);check('Normal, Elite and Ancient Treant deaths use unchanged rewards and timers');
  await place(20,43.7);await clickNpc();
  await npc.getByRole('button',{name:'Selesaikan Quest',exact:true}).first().click();
  assert(await page.evaluate(()=>window.__terrainQA.hero.completedQuests.includes('field-verdant-plains-easy')));check('quest progress and reward turn-in remain functional');
  await npc.getByRole('button',{name:'Close',exact:true}).first().click();
  await page.evaluate(()=>window.__terrainQA.save());
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Lanjutkan perjalanan',exact:true}).click();
  const restored=await page.evaluate(()=>{const g=window.__terrainQA;const b=g.enemies.find(e=>e.boss);return {deadline:b.respawnDeadline,remaining:b.respawn,hp:b.hp,count:g.enemies.filter(e=>e.boss).length,quest:g.hero.completedQuests.includes('field-verdant-plains-easy'),y:g.actor.position.y};});
  assert.equal(restored.deadline,deaths.deadline);assert(restored.remaining>0&&restored.remaining<=120);assert.equal(restored.hp,0);assert.equal(restored.count,1);assert(restored.quest);assert(restored.y>1);check('reload preserves quest and boss deadline without duplicate spawn');
  const resurrected=await page.evaluate(()=>{const g=window.__terrainQA;for(const id of [0,90,100]){const e=g.enemies.find(e=>e.id===id);e.respawnDeadline=Date.now()-1;g.updateEnemy(e,.02);}return g.enemies.filter(e=>[0,90,100].includes(e.id)).map(e=>({hp:e.hp,max:e.max,y:e.group.position.y,ground:g.groundHeight(e.group.position.x,e.group.position.z),visible:e.group.visible}));});
  for(const e of resurrected){assert.equal(e.hp,e.max);assert(e.visible);assert(Math.abs(e.y-e.ground)<.01);}check('elapsed deadlines respawn all variants on valid surfaces');
  await place(20,43.7);await clickNpc();await npc.getByRole('button',{name:'Teleport',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Kembali ke kota'}).click();
  assert(await page.evaluate(()=>window.__terrainQA.hero.inCity&&window.__terrainQA.terrain.visible&&!window.__terrainQA.terrainSurface));check('camp Teleport returns to unchanged Kota Arunika');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__terrainQA.changeRegion('verdant-plains'));await place(40,-26);
  const locked=await page.evaluate(()=>{const g=window.__terrainQA;g.hero.level=1;const moved=g.changeRegion('ironveil-mines');g.hero.level=10;return {moved,field:g.hero.currentField};});
  assert.equal(locked.moved,false);assert.equal(locked.field,'verdant-plains');check('existing next-field level requirement remains enforced');
  const portal=await page.evaluate(()=>{const g=window.__terrainQA;const p=g.actor.position.clone().set(40,g.groundHeight(40,-28)+1.9,-28).project(g.camera);const r=g.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};});
  await page.mouse.click(portal.x,portal.y);await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__terrainQA.hero.currentField),'ironveil-mines');
  assert(await page.evaluate(()=>window.__terrainQA.terrain.visible&&!window.__terrainQA.terrainSurface));check('mining-road portal uses existing travel and untouched next-field renderer');
  const otherFields=await page.evaluate(()=>{const g=window.__terrainQA;g.hero.level=50;return ['ironveil-mines','whispering-wilds','frostfire-highlands','sunken-ruins','meteorfall-citadel'].map(id=>{g.changeRegion(id);return {id,field:g.hero.currentField,legacy:g.terrain.visible&&!g.terrainSurface,count:g.enemies.length,x:g.hero.x,z:g.hero.z};});});
  for(const f of otherFields){assert.equal(f.field,f.id);assert(f.legacy);assert.equal(f.count,42);assert.equal(f.x,0);assert.equal(f.z,30);}check('all five unrelated fields retain the original renderer, entry and population');
  await page.evaluate(()=>{const g=window.__terrainQA;g.changeRegion('verdant-plains');g.hero.x=43;g.hero.z=23;g.save();});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Lanjutkan perjalanan',exact:true}).click();
  const legacy=await page.evaluate(()=>{const g=window.__terrainQA;return {x:g.hero.x,z:g.hero.z,y:g.actor.position.y,ground:g.groundHeight(g.hero.x,g.hero.z),quest:g.hero.completedQuests.includes('field-verdant-plains-easy')};});
  assert(terrainWalkable(VERDANT_TERRAIN,legacy));assert.equal(legacy.y,legacy.ground);assert(legacy.quest);check('reload relocates an old position inside the pond without losing completed quests');
  assert.deepEqual(errors,[]);check('no JavaScript console errors');
  await writeFile(resolve(out,'browser-results.json'),JSON.stringify({checks,metrics,errors},null,2));console.log(JSON.stringify(metrics));
}finally{await browser.close();}
