import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createV3AdventurerHero, SAVE_KEY, createItem } from '../lib/game/rules.ts';
import { CITIES } from '../lib/game/regions.ts';
const out=process.env.PHASE14_BROWSER_OUTPUT??'outputs/gameplay-migration/runtime';mkdirSync(out,{recursive:true});
if(existsSync(out+'/results.json'))copyFileSync(out+'/results.json',out+'/attempt-'+Date.now()+'.json');
const report={kind:'actual-Home-and-Game-local-Vite',checks:[],errors:[],warnings:[],failedResponses:[],blockedRequests:[],fullParity:false};
let server,browser;
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS '+name);};
try{
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
 server=await createServer({configFile:false,root:process.cwd(),plugins:[react()],resolve:{alias:{'@':process.cwd()}},server:{host:'127.0.0.1',port:3029,strictPort:true}});await server.listen();
 const origin='http://127.0.0.1:3029';
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(origin+'/')||/^(data|blob):/.test(u))return route.continue();report.blockedRequests.push(u);return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.failedResponses.push({url:r.url(),status:r.status()});});
 // Observation handle injected into response only, not into shipped source.
 await page.route('**/lib/game/world.ts*',async route=>{const r=await route.fetch();const body=(await r.text()).replace('this.renderer = new T.WebGLRenderer','window.__phase14 = this; this.renderer = new T.WebGLRenderer');await route.fulfill({response:r,body});});
 const hero=createV3AdventurerHero('slot-1','Phase14 Synthetic');hero.characterId='phase14-runtime-synthetic';hero.gold=1000;hero.currentCity='arunika';hero.inCity=true;
 hero.inventory.push(createItem('iron',{quantity:20}),createItem('health-potion-1',{quantity:5}));hero.primaryHotbar[0]='v3-adventurer-quick-slash';
 await context.addInitScript(({key,hero})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:3,activeSlot:'slot-1',lastPlayedCharacterId:hero.characterId,characters:{'slot-1':hero}}));},{key:SAVE_KEY,hero});
 await page.goto(origin+'/tests/browser/phase14-runtime.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('button',{name:'CONTINUE',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>window.__phase14?.started,{},{timeout:60000});
 check('Actual Home CONTINUE starts real Game/WebGL',await page.locator('canvas[aria-label="Dunia 3D Lumenfall"]').count()===1);
 const start=await page.evaluate(()=>({x:window.__phase14.hero.x,z:window.__phase14.hero.z,time:window.__phase14.combatTime}));
 await page.keyboard.down('d');await page.waitForFunction(p=>Math.hypot(window.__phase14.hero.x-p.x,window.__phase14.hero.z-p.z)>.5,start,{timeout:10000});await page.keyboard.up('d');
 const end=await page.evaluate(()=>({x:window.__phase14.hero.x,z:window.__phase14.hero.z,time:window.__phase14.combatTime}));report.movement={start,end};
 check('Keyboard D moves actual actor and simulation clock advances',Math.hypot(end.x-start.x,end.z-start.z)>.5&&end.time>start.time);
 await page.keyboard.press('i');await page.locator('[role="dialog"]').waitFor();check('Inventory opens through runtime keyboard',await page.locator('.hud-binding-layer').count()===1);await page.keyboard.press('Escape');
 const from=page.locator('[data-primary-slot="0"]'),to=page.locator('[data-primary-slot="4"]');
 const a=await from.boundingBox(),b=await to.boundingBox();assert(a&&b);
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:18});await page.mouse.up();
 check('Actual pointer drag moves learned skill binding',await page.evaluate(()=>window.__phase14.hero.primaryHotbar[4]==='v3-adventurer-quick-slash'));
 await page.keyboard.press('c');await page.getByRole('button',{name:'Advanced Stats',exact:true}).click();check('Runtime Character panel renders advanced stats',await page.getByRole('button',{name:'Close advanced stats'}).isVisible());await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 // Set synthetic position only; call actual NPC interaction and real UI service.
 const master=CITIES.arunika.npcList.find(n=>n.service==='forge');
 await page.evaluate(n=>{const g=window.__phase14;g.hero.x=n.x;g.hero.z=n.z;g.placeActor();g.openNpc(n.id);},master);
 report.npcButtons=await page.getByRole('button').allTextContents();
 await page.locator('[data-forge-choice="enhancement"]').click();await page.locator('.forge-dialog').waitFor();
 check('Real NPC menu opens Forge service',await page.evaluate(()=>window.__phase14.forgeNpcId==='aruna-3'));
 const forgeResult=await page.evaluate(()=>{const g=window.__phase14,id=g.hero.equipment.mainHand;const result=g.enhanceItem(id,0,false,false);const item=g.hero.inventory.find(i=>i.id===id);g.hero.x+=10;const before=JSON.stringify(g.hero);const rejected=g.enhanceItem(id,1,false,false);return {ok:result.ok,level:item.enhancementLevel,remoteRejected:!rejected.ok&&JSON.stringify(g.hero)===before};});report.forge=forgeResult;
 check('Live Game Forge commits configured +1 and rejects remote retry atomically',forgeResult.ok&&forgeResult.level===1&&forgeResult.remoteRejected);
 await page.keyboard.press('Escape');await page.screenshot({path:out+'/runtime.png',fullPage:true});
 await page.evaluate(()=>window.__phase14.changeRegion('verdant-plains-v2'));
 await page.waitForFunction(()=>!window.__phase14.transitioning&&!window.__phase14.hero.inCity&&window.__phase14.enemies.length>0,{},{timeout:60000});
 await page.locator('[role="dialog"]').waitFor({state:'hidden'});
 report.targetSetup=await page.evaluate(()=>{const g=window.__phase14,e=g.enemies.find(e=>e.hp>0&&!e.boss);window.__phase14Enemy=e;const initiallyVisible=e.group.visible;g.hero.x=e.group.position.x;g.hero.z=e.group.position.z+1;g.placeActor();return {initiallyVisible};});
 // Visibility/culling updates on the actual frame after positioning. Do not
 // bypass validTarget by forcing visibility or registering a replacement enemy.
 await page.waitForFunction(()=>window.__phase14Enemy.group.visible,{},{timeout:10000});
 check('Existing field entity becomes targetable after real visibility update',await page.evaluate(()=>window.__phase14.setCurrentTarget(window.__phase14Enemy)));
 const castBefore=await page.evaluate(()=>{const g=window.__phase14,e=window.__phase14Enemy;return {hp:e.hp,sequence:g.hotbarUseSequence,mana:g.hero.mana,paused:g.paused,hotbar:g.hero.primaryHotbar,allowed:g.canCastSkill('v3-adventurer-quick-slash'),focus:document.activeElement?.outerHTML.slice(0,160),interacting:g.hotbarInteracting};});
 await page.keyboard.press('5');
 await page.waitForFunction(sequence=>window.__phase14.hotbarUseSequence>sequence,castBefore.sequence,{timeout:10000}).catch(()=>{});
 await page.waitForTimeout(1500);
 const castAfter=await page.evaluate(()=>{const g=window.__phase14;return {hp:window.__phase14Enemy.hp,sequence:g.hotbarUseSequence,mana:g.hero.mana,lastFailure:g.lastActionFailure,dead:g.dead,position:{x:g.hero.x,z:g.hero.z},actor:g.actor.position.toArray(),target:window.__phase14Enemy.group.position.toArray(),blocked:g.uiInputBlockers.blocked,transitioning:g.transitioning,regionError:String(g.regionLoadError),selected:g.currentTargetId};});report.cast={before:castBefore,after:castAfter};
 check('Real skill hotkey damages active field enemy after actual map load',castAfter.hp<castBefore.hp&&castAfter.sequence>castBefore.sequence);
 await page.screenshot({path:out+'/runtime-combat.png',fullPage:true});
 check('No browser page errors',report.errors.length===0);report.status='passed-limited-runtime';report.browser=browser.version();
 report.limitations=['Actual Home/Game served through local Vite entry, not deployed SSR/build route','Synthetic position used for NPC approach; NPC menu/Forge and proximity gate are actual code','No exhaustive AI/status/projectile/collision or boss120s parity measurement','Single Chrome viewport; no claim of cross-device visual parity'];
}catch(e){report.status='failed';report.failure=String(e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(out+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
