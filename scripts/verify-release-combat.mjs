// Builds current combat fixture source, never uses a stale checked-in bundle.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const runtime=process.env.CODEX_NODE_MODULES || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(pathToFileURL(`${runtime}/playwright/index.mjs`).href);
const out=resolve('output/release-audit/combat');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 for(const name of ['iron-charge','berserker']){
  const built=await build({configFile:false,logLevel:'error',build:{write:false,minify:false,lib:{entry:resolve(`tests/browser/${name}-fixture.ts`),formats:['iife'],name:'ReleaseFixture'}}});
  const chunks=(Array.isArray(built)?built:[built]).flatMap(b=>b.output);const code=chunks.find(c=>c.type==='chunk').code;
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  const html=await readFile(`tests/browser/${name}-fixture.html`,'utf8');
  await page.route('http://release-fixture.test/**',route=>route.fulfill({status:200,contentType:route.request().url().includes('.bundle.js')?'application/javascript':'text/html',body:route.request().url().includes('.bundle.js')?code:html}));
  await page.goto(`http://release-fixture.test/${name}-fixture.html`,{waitUntil:'networkidle'});
  const key=name==='iron-charge'?'__ironChargeFixture':'__berserkerFixture';
  await page.waitForFunction(key=>Boolean(window[key]),key);
  const result=await page.evaluate(key=>window[key],key);
  if(name==='iron-charge'){
   assert(result.a.impact&&result.a.damage>0&&result.a.travelDistance<3.5&&!result.a.stunEligible&&!result.a.stunned);
   assert(result.b.impact&&result.b.damage>0&&result.b.travelDistance>=3.5&&result.b.stunned&&Math.abs(result.b.stunExpiresAt-1.5)<.001);
   assert(result.c.stunned&&result.c.attempts.every(x=>!x.accepted));
   assert(!result.d.stunned&&result.d.movement.accepted&&result.d.basicAttack.accepted&&result.d.activeSkill.accepted);
   assert(result.e.impact&&result.e.damage>0&&result.e.stunEligible&&!result.e.stunned);
   assert(result.basic.damage>0&&!result.basic.stunned&&result.basic.knockback===0);
  }else{
   assert.equal(result.worldImported,false);assert.equal(result.cases.raging.actualTargetsHit,8);
   assert.equal(result.cases.fury.actualTargetsHit,7);assert.equal(result.cases.fury.heal,50);
   assert.equal(result.cases.trance.actualTargetsHit,8);assert.equal(result.cases.trance.frenzyGuard.reductionPercent,6);
   assert(result.cases.breakerFollowup.accepted&&result.cases.breakerFollowup.consumed);
   assert(result.cases.raging.results.some(x=>x.stunned));assert(!result.cases.raging.results.find(x=>x.id==='target-8').stunned);
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:resolve(out,`${name}.png`),fullPage:true});
  results.push({name,status:'PASS',errors,result});await page.close();console.log(`PASS ${name} actual combat fixture`);
 }
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));await browser.close();}
