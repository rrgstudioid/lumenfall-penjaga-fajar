// Fresh browser contexts: no access to the owner's browser profile or saves.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNewCharacter, chooseV3Warrior, chooseV3Berserker, SAVE_KEY } from '../lib/game/rules.ts';
const runtime=process.env.CODEX_NODE_MODULES || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(pathToFileURL(`${runtime}/playwright/index.mjs`).href);
const url=process.env.RELEASE_TEST_URL || 'http://127.0.0.1:3010/';
const out=resolve('output/release-audit',process.env.RELEASE_TEST_LABEL || 'production-preview');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],warnings=[],failedRequests=[];
const check=(name,ok,detail)=>{assert.ok(ok,name);results.push({name,detail});console.log(`PASS ${name}`);};
async function scenario(label,hero,run){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.tracing.start({screenshots:true,snapshots:true});
 if(hero) await context.addInitScript(({key,hero})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',lastPlayedCharacterId:hero.characterId,characters:{'slot-1':hero}}));
 },{key:SAVE_KEY,hero});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text());});
 page.on('pageerror',e=>{errors.push(`${label}: ${e.message}`);console.error('PAGEERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error')errors.push(`${label}: ${m.text()}`);if(m.type()==='warning')warnings.push(`${label}: ${m.text()}`);});
 page.on('requestfailed',r=>failedRequests.push({label,url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${label}: HTTP ${r.status()} ${r.url()}`);});
 try{
 const response=await page.goto(url,{waitUntil:'networkidle',timeout:90000});check(`${label}: HTTP200`,response.status()===200);
 await page.getByRole('button',{name:'NEW GAME',exact:true}).waitFor();
 await run(page);
 await page.screenshot({path:resolve(out,`${label}.png`),fullPage:true});
 }catch(error){console.error('SCENARIO FAILED',error.message);await writeFile(resolve(out,`${label}-diagnostics.json`),JSON.stringify({errors,warnings,failedRequests}));await page.screenshot({path:resolve(out,`${label}-failure.png`),fullPage:true,timeout:10000}).catch(()=>{});throw error;}
 finally{await context.tracing.stop({path:resolve(out,`${label}-trace.zip`)});await context.close();}
}
async function world(page){console.log('Waiting for world');await page.locator('.game-shell.in-world [data-world-surface] canvas').waitFor({timeout:60000});await page.waitForTimeout(1500);console.log('World visible');}
async function panel(page,key,heading){
 await page.keyboard.press(key);
 const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:heading,exact:true})});
 await dialog.waitFor();
 const rect=await dialog.boundingBox();
 check(`${heading} visible inside viewport`,rect && rect.x>=-1 && rect.y>=-1 && rect.x+rect.width<=1441 && rect.y+rect.height<=901,rect);
 return dialog;
}
const save=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
try{
 await scenario('new-v3',null,async page=>{
  console.log('Main menu ready');await page.getByRole('button',{name:'NEW GAME',exact:true}).click();console.log('New game selected');
  await page.locator('.menu-slot.is-empty').first().click();console.log('Empty slot selected');
  await page.getByLabel('CHARACTER NAME',{exact:true}).fill('Release V3 Test');
  await page.getByRole('button',{name:'JALUR KARAKTER: V3 · Warrior / Berserker',exact:true}).click();
  console.log('V3 selected');await page.getByRole('button',{name:'CREATE CHARACTER',exact:true}).click();
  await page.getByRole('button',{name:'ENTER WORLD',exact:true}).click();await world(page);
  const h=(await save(page)).characters['slot-1'];
  check('New creation uses V3',h.skillArchitectureVersion===3);
  check('New primary hotbar empty',h.primaryHotbar.every(s=>s===null));
  await panel(page,'k','Job Skill');check('Adventurer has exactly 3 V3 nodes',await page.locator('.js-node[data-skill-id^="v3-adventurer-"]').count()===3);
  await page.keyboard.press('k');await panel(page,'c','Character');await page.keyboard.press('c');
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await world(page);
  check('New V3 persists after reload',(await save(page)).characters['slot-1'].skillArchitectureVersion===3);
 });
 const berserker=createNewCharacter('slot-1','Release Berserker',{},'v3_adventurer');
 berserker.level=80;berserker.skillProgressionV3.totalEarnedSP=200;chooseV3Warrior(berserker);chooseV3Berserker(berserker);
 await scenario('berserker',berserker,async page=>{
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await world(page);await panel(page,'k','Job Skill');
  check('Exactly 9 Berserker nodes',await page.locator('.js-node[data-skill-id^="v3-berserker-"]').count()===9);
  await page.locator('.js-node[data-skill-id="v3-berserker-two-hand-mastery"]').click();
  const buttons=await page.locator('.js-detail button').allTextContents();console.log('DETAIL BUTTONS',buttons);
  await page.getByRole('button',{name:/Learn|Pelajari|Upgrade/i}).last().click();
  await page.waitForTimeout(300);
  check('Berserker mastery purchased through UI',(await save(page)).characters['slot-1'].skillProgressionV3.skillRanks['v3-berserker-two-hand-mastery']===1);
  await page.locator('.js-sidebar button').filter({hasText:'Warrior'}).click();check('Exactly 11 ancestral Warrior nodes',await page.locator('.js-node[data-skill-id^="v3-warrior-"]').count()===11);
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await world(page);
  const reloaded=(await save(page)).characters['slot-1'];check('Berserker rank/budget persist',reloaded.skillProgressionV3.skillRanks['v3-berserker-two-hand-mastery']===1&&reloaded.skillProgressionV3.totalEarnedSP===200);
 });
 const legacy=createNewCharacter('slot-1','Release Legacy');legacy.level=12;legacy.gold=6543;
 await scenario('legacy-v2',legacy,async page=>{
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await world(page);await panel(page,'k','Job Skill');
  const h=(await save(page)).characters['slot-1'];check('Existing V2 not migrated',h.progressionArchitecture==='v2_test'&&h.level===12&&h.gold===6543);
  check('V2 nodes remain',await page.locator('.js-node:not([data-skill-id^="v3-"])').count()>0);
 });
 check('No browser runtime or HTTP errors',errors.length===0,errors);
 console.log(JSON.stringify({status:'PASS',results,errors,warnings,failedRequests}));
}catch(error){results.push({failure:error.stack});process.exitCode=1;console.error(error);}
finally{await writeFile(resolve(out,'results.json'),JSON.stringify({url,results,errors,warnings,failedRequests},null,2));await browser.close();}
