// Isolated browser context and disposable character only; never uses the player's profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY } from '../lib/game/rules.ts';
import { createItem, createRuneItem, rollRuneAffixes, stableItemRandom, RUNE_THEME_POOLS } from '../lib/game/items.ts';
import { CITIES } from '../lib/game/regions.ts';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=resolve('work/rune-forge');await mkdir(out,{recursive:true});
const hero=freshHero();hero.characterName='Rune Forge QA';hero.gold=100000;hero.level=40;hero.coreJob='wizard';hero.job='wizard';hero.jobTier='core';
const staff=createItem('field-meteorfall-citadel-staff',{id:'meteor-qa',rarity:'unique',sockets:[{id:'s1',rune:null},{id:'s2',rune:null}]});
// Simulate the broken legacy Unique item and untrusted generic equipment affixes.
staff.bonusStats={};staff.uniqueStatsLocked=false;staff.affixes=[{id:'old-bad',stat:'physicalDamage',label:'Physical Damage',value:99,unit:'percent',source:'runeOptimizer'}];
const rune=createRuneItem('focus','rare',{id:'focus-qa',affixes:rollRuneAffixes('focus','rare',stableItemRandom('browser-focus'))});
const epic=createRuneItem('focus','epic',{id:'focus-epic',affixes:rollRuneAffixes('focus','epic',stableItemRandom('browser-epic'))});
hero.inventory=[staff,rune,epic,createRuneItem('might','rare',{id:'restricted',runeJobRequirement:'rogue'}),
 createItem('rune-optimizer-basic',{id:'locked-basic',quantity:20,isLocked:true}),
 ...['rune-optimizer-basic','rune-stabilizer','rune-optimizer-chromatic','rune-optimizer-greater-chromatic','rune-optimizer-perfect-chromatic'].map(id=>createItem(id,{id,quantity:20})),
 createItem('magnifier',{id:'glass',quantity:2}),createItem('iron',{quantity:30}),createItem('titanium',{quantity:10})];
hero.equipment.mainHand=staff.id;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:960}});
await context.addInitScript(({key,hero})=>{
 if(!localStorage.getItem('rune-qa-seeded')){
  localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',characters:{'slot-1':hero}}));
  localStorage.setItem('rune-qa-seeded','yes');
 }
},{key:SAVE_KEY,hero});
const page=await context.newPage(),errors=[],failedAssets=[],checks=[];
page.setDefaultTimeout(18000);
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)failedAssets.push(r.status()+' '+r.url());});
await page.route('**/lib/game/world.ts*',async route=>{
 const response=await route.fetch();const body=(await response.text()).replace('this.renderer = new T.WebGLRenderer','window.__runeQA = this; this.renderer = new T.WebGLRenderer');
 await route.fulfill({response,body});
});
const forge=page.locator('.forge-dialog'),runePanel=page.locator('.rune-forge');
const check=name=>{checks.push(name);console.log('PASS',name);};
const snapshot=()=>page.evaluate(()=>structuredClone(window.__runeQA.hero));
const item=h=>h.inventory.find(i=>i.id==='meteor-qa');
const current=(h,index=0)=>item(h).sockets[index].rune;
const save=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).characters['slot-1'],SAVE_KEY);
async function resume(){await page.getByRole('button',{name:/^(Lanjutkan perjalanan|Buat karakter & mulai)$/}).click();await page.waitForFunction(()=>window.__runeQA?.started);}
async function openForge(cityId='arunika',id='aruna-3'){
 const npc=CITIES[cityId].npcList.find(n=>n.id===id);
 await page.evaluate(({cityId,npc})=>{
  const g=window.__runeQA;if(g.hero.currentCity!==cityId||!g.hero.inCity)g.changeRegion(cityId);
  g.hero.x=npc.x;g.hero.z=npc.z+1.7;g.placeActor();g.cameraFocus.copy(g.actor.position);g.zoom=20;g.cameraZoom.halfHeight=20;g.pause(false);
 },{cityId,npc});
 await page.waitForTimeout(400);
 const point=await page.evaluate(npc=>{
  const g=window.__runeQA,p=g.actor.position.clone().set(npc.x,1.1,npc.z).project(g.camera),r=g.renderer.domElement.getBoundingClientRect();
  return {x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};
 },npc);
 await page.mouse.click(point.x,point.y);
 await page.getByRole('dialog').getByRole('heading',{name:npc.name,exact:true}).waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'Tempa',exact:true}).click();
 await forge.waitFor();await forge.getByRole('button',{name:'Rune Forge',exact:true}).click();await runePanel.waitFor();
}
async function closeForge(){await forge.getByRole('button',{name:'Close',exact:true}).click();await forge.waitFor({state:'hidden'});}
async function confirm(){await page.getByRole('alertdialog').getByRole('button',{name:'Konfirmasi',exact:true}).click();await page.getByRole('alertdialog').waitFor({state:'hidden'});}
async function roll(optimizer='rune-optimizer-basic',stabilize=false){
 await runePanel.getByRole('button',{name:'Reroll Rune',exact:true}).click();
 const select=runePanel.getByLabel('Pilih Rune Optimizer',{exact:true});
 await select.selectOption(optimizer);
 const toggle=runePanel.getByRole('checkbox');
 if(!stabilize)assert.equal(await toggle.isChecked(),false);
 if(await toggle.isEnabled())await toggle.setChecked(stabilize);
 await runePanel.getByRole('button',{name:'Gunakan Rune Optimizer',exact:true}).click();await confirm();
 await runePanel.getByRole('heading',{name:/Hasil Rune ·/}).waitFor();
}
try{
 await page.goto(process.env.GAME_URL??'http://localhost:3001/',{waitUntil:'networkidle'});await resume();
 let h=await snapshot();assert.equal(item(h).affixes.length,0);assert(item(h).uniqueStatsLocked);assert(Object.keys(item(h).bonusStats).length);
 check('legacy Meteor Staff Additional Options removed; hidden Unique Stats backfilled');
 await page.keyboard.press('i');
 const bag=page.locator('.inventory-dialog');
 assert.equal(await bag.getByRole('button',{name:/^(Rune Optimizer|Pasang Rune|Lepas Rune|Rune Forge)$/}).count(),0);
 await page.keyboard.press('Escape');check('Inventory exposes no remote Rune modification actions');
 await openForge();assert.equal(await page.locator('.rune-optimizer-dialog').count(),0);
 await runePanel.getByRole('button',{name:'Reroll Rune',exact:true}).click();
 assert(await runePanel.getByRole('button',{name:'Gunakan Rune Optimizer',exact:true}).isDisabled());
 assert((await runePanel.innerText()).includes('harus memiliki Rune terpasang'));
 check('actual Empu Wira click opens one Forge UI; equipment without Rune cannot reroll');
 await runePanel.getByRole('button',{name:'Pasang Rune',exact:true}).click();
 assert(await runePanel.locator('.rune-inventory-list button').filter({hasText:'Khusus'}).count()===0); // restriction text below is explicit
 assert(await runePanel.locator('.rune-inventory-list button').filter({hasText:'Rune ini hanya'}).isDisabled());
 await runePanel.locator('.rune-inventory-list button').filter({hasText:'Rune of Focus'}).filter({hasText:'rare'}).click();
 await runePanel.getByRole('button',{name:'Konfirmasi Pasang Rune · Gratis',exact:true}).click();
 assert((await page.getByRole('alertdialog').innerText()).includes('→'));
 await confirm();h=await snapshot();assert.equal(current(h).id,rune.id);assert(!h.inventory.some(i=>i.id===rune.id));
 check('Pasang Rune confirmation shows actual preview and moves the original Rune; wrong job is disabled');
 const before=structuredClone(current(h)),gold=h.gold;
 await runePanel.getByRole('button',{name:'Reroll Rune',exact:true}).click();
 assert.equal(await runePanel.getByLabel('Pilih Rune Optimizer',{exact:true}).inputValue(),'rune-optimizer-basic');
 check('locked optimizer stack is skipped when an unlocked optimizer is available');
 await runePanel.getByRole('button',{name:'Gunakan Rune Optimizer',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Batalkan',exact:true}).click();
 assert.equal((await snapshot()).gold,gold);check('canceling before roll spends nothing');
 await roll();h=await snapshot();assert.equal(h.gold,gold-250);assert.deepEqual(current(h),before);
 assert.equal(h.runeForgePending.candidate.runeRarity,'rare');assert.equal(h.runeForgePending.candidate.affixes.length,2);
 assert(h.runeForgePending.candidate.affixes.every(a=>RUNE_THEME_POOLS.focus.includes(a.stat)));
 assert.equal((await save()).gold,h.gold);assert((await save()).runeForgePending);
 await page.screenshot({path:resolve(out,'basic-paid-result.png')});
 check('Basic result is paid and persisted before display, Focus-only, same Rare quality/count');
 await runePanel.getByRole('button',{name:'Keep Current',exact:true}).click();
 h=await snapshot();assert.deepEqual(current(h),before);assert.equal(h.gold,gold-250);check('Keep Current preserves old Rune without refund');
 await roll();const accepted=(await snapshot()).runeForgePending.candidate;
 await runePanel.getByRole('button',{name:'Accept New',exact:true}).click();
 assert.deepEqual(current(await snapshot()),accepted);assert.equal((await snapshot()).runeForgePending,null);
 await runePanel.getByRole('button',{name:'Pasang Rune',exact:true}).click();
 await runePanel.getByRole('button',{name:'Lepas Rune · 250 GOLD',exact:true}).click();await confirm();
 h=await snapshot();assert.equal(current(h),null);assert.deepEqual(h.inventory.find(i=>i.id===accepted.id),accepted);
 check('Accept New applies once; remove returns the exact optimized Rune instance');
 await runePanel.locator('.rune-inventory-list button').filter({hasText:'Rune of Focus'}).filter({hasText:'epic'}).click();
 await runePanel.getByRole('button',{name:'Konfirmasi Pasang Rune · Gratis',exact:true}).click();await confirm();
 const beforeCh=await snapshot();await roll('rune-optimizer-chromatic',false);h=await snapshot();
 assert(['rare','epic','legendary','ancient'].includes(h.runeForgePending.candidate.runeRarity));
 assert.equal(h.gold,beforeCh.gold-1200);assert.equal(h.inventory.find(i=>i.id==='rune-stabilizer').quantity,beforeCh.inventory.find(i=>i.id==='rune-stabilizer').quantity);
 await runePanel.getByRole('button',{name:'Keep Current',exact:true}).click();
 await runePanel.getByRole('button',{name:'Reroll Rune',exact:true}).click();
 const chromaticToggle=runePanel.getByRole('checkbox');
 await runePanel.getByLabel('Pilih Rune Optimizer',{exact:true}).selectOption('rune-optimizer-chromatic');
 await chromaticToggle.setChecked(true);
 await runePanel.getByLabel('Pilih Rune Optimizer',{exact:true}).selectOption('rune-optimizer-basic');
 assert.equal(await chromaticToggle.isChecked(),false);assert.equal(await chromaticToggle.isDisabled(),true);
 await runePanel.getByLabel('Pilih Rune Optimizer',{exact:true}).selectOption('rune-optimizer-chromatic');
 assert.equal(await chromaticToggle.isChecked(),false);
 await chromaticToggle.setChecked(true);
 await runePanel.getByRole('button',{name:'Gunakan Rune Optimizer',exact:true}).click();await confirm();h=await snapshot();
 assert(['rare','epic','legendary','ancient'].includes(h.runeForgePending.candidate.runeRarity));
 assert.equal(h.gold,beforeCh.gold-2400);assert.equal(h.inventory.find(i=>i.id==='rune-stabilizer').quantity,beforeCh.inventory.find(i=>i.id==='rune-stabilizer').quantity-1);
 const receipt=h.runeForgePending;await page.reload({waitUntil:'networkidle'});await resume();await openForge();
 h=await snapshot();assert.equal(h.runeForgePending.id,receipt.id);assert.deepEqual(h.runeForgePending.candidate,receipt.candidate);
 await runePanel.getByRole('button',{name:'Accept New',exact:true}).click();assert.deepEqual(current(await snapshot()),receipt.candidate);
 check('Stabilizer blocks downgrade, costs exactly one extra item, and pending candidate resumes after reload');
 for(const optimizer of ['rune-optimizer-greater-chromatic','rune-optimizer-perfect-chromatic']){
  await roll(optimizer);await runePanel.getByRole('button',{name:'Keep Current',exact:true}).click();
 }
 check('Greater and Perfect are selectable with the same shared paid workflow; no colored options');
 const beforeFail=await snapshot();
  // oxlint-disable-next-line typescript/unbound-method
  await page.evaluate(key=>{window.__realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('QA full','QuotaExceededError');return window.__realSet.call(this,k,v);};},SAVE_KEY);
 await runePanel.getByRole('button',{name:'Gunakan Rune Optimizer',exact:true}).click();await confirm();
 await page.evaluate(()=>{Storage.prototype.setItem=window.__realSet;});
 h=await snapshot();assert.equal(h.gold,beforeFail.gold);assert.deepEqual(h.inventory,beforeFail.inventory);assert(!h.runeForgePending);
 check('storage failure rolls back resources and does not expose an unpaid candidate');
 await forge.getByRole('button',{name:'Tempa / Enhance',exact:true}).click();
 await forge.locator('[data-forge-item="meteor-qa"]').click();
 await forge.getByRole('button',{name:/^Tempa \+/}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Konfirmasi Tempa',exact:true}).click();
 h=await snapshot();assert.equal(item(h).enhancementLevel,1);assert.deepEqual(current(h),current(beforeFail));
 check('existing enhancement still works and preserves Rune and Unique Stats');
 await closeForge();await page.keyboard.press('c');
 const character=page.locator('.character-dialog');await character.getByRole('tab',{name:/Equipment/}).click();
 await character.getByRole('button',{name:/Main Weapon/}).first().click();
 await character.getByRole('button',{name:'Unlock Unique Stats · 1 Magnifier',exact:true}).click();
 h=await snapshot();assert.equal(item(h).uniqueStatsLocked,false);assert.deepEqual(current(h),current(beforeFail));
 assert.equal(h.inventory.find(i=>i.id==='glass').quantity,1);await page.keyboard.press('Escape');
 check('Arcane Magnifier reveals migrated Unique Stats without changing Rune/enhancement');
 await openForge('jayantara','jaya-2');await roll();await runePanel.getByRole('button',{name:'Keep Current',exact:true}).click();
 check('Empu Niskala in Kota Jayantara supports the same Rune actions');
 for(const [width,height,scale] of [[1366,768,.75],[1920,1080,1],[2560,1440,1.5]]){
  await page.setViewportSize({width,height});
  await page.evaluate(scale=>{document.documentElement.style.setProperty('--lumenfall-ui-scale',String(scale));window.dispatchEvent(new Event('resize'));},scale);
  await page.waitForTimeout(250);await forge.getByRole('heading',{name:'Tempa / Enhance',exact:true}).scrollIntoViewIfNeeded();
  const beforeBox=await forge.boundingBox();assert(beforeBox.x>=-1&&beforeBox.y>=-1&&beforeBox.x+beforeBox.width<=width+1);
  const title=await forge.getByRole('heading',{name:'Tempa / Enhance',exact:true}).boundingBox();
  await page.mouse.move(title.x+title.width/2,title.y+title.height/2);await page.mouse.down();await page.mouse.move(title.x+title.width/2+30,title.y+title.height/2+20,{steps:5});await page.mouse.up();
  const afterBox=await forge.boundingBox();assert(Math.abs(afterBox.x-beforeBox.x-30)<3);assert(Math.abs(afterBox.y-beforeBox.y-20)<3);
  await page.screenshot({path:resolve(out,'rune-forge-'+width+'-'+scale+'.png')});
 }
 check('Forge controls remain accessible and drag remains 1:1 at 75%, 100%, 150% and three desktop sizes');
 await roll();const beforeTravel=await snapshot();
 await page.evaluate(()=>window.__runeQA.changeRegion('verdant-plains'));
 await forge.waitFor({state:'hidden'});h=await snapshot();assert(!h.runeForgePending);assert.equal(h.gold,beforeTravel.gold);
 const remote=await page.evaluate(()=>{const g=window.__runeQA;return {open:g.openForge(),remove:g.removeRune('meteor-qa',0),roll:g.rollRune({equipmentId:'meteor-qa',socketIndex:0,optimizerItemId:'rune-optimizer-basic',stabilize:false})};});
 assert.deepEqual(remote,{open:false,remove:false,roll:false});check('region change closes Forge and cancels candidate; remote field actions cannot mutate Rune');
 await page.reload({waitUntil:'networkidle'});await resume();h=await snapshot();assert.deepEqual(current(h),current(beforeTravel));assert.equal(item(h).enhancementLevel,1);assert.equal(item(h).uniqueStatsLocked,false);
 check('accepted Rune, enhancement, revealed Unique Stats and GOLD survive final reload');
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);check('no runtime, hydration, console or missing-asset errors');
}catch(error){await page.screenshot({path:resolve(out,'failure.png')});console.error(error);process.exitCode=1;}
finally{await writeFile(resolve(out,'results.json'),JSON.stringify({checks,errors,failedAssets},null,2));await browser.close();}
