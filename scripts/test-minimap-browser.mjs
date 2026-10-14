// Disposable browser profile: actual map travel and HUD layout, no owner save changes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import { FIELDS, CITIES } from '../lib/game/regions.ts';
const { chromium } = await import(pathToFileURL('C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out = 'output/minimap-coordinates';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage(), errors = [], checks = [];
page.on('pageerror',error=>errors.push(error.message));
await page.route(/\/lib\/game\/world\.ts/,async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text()).replace('this.renderer = new T.WebGLRenderer','window.__mapQA=this;this.renderer = new T.WebGLRenderer')});
});
const hero = createV3AdventurerHero('slot-1');
hero.level=50;
const fixture={version:3,activeSlot:'slot-1',lastPlayedCharacterId:hero.characterId,characters:{'slot-1':hero}};
await context.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:SAVE_KEY,fixture});
const check=(name,value=true)=>{assert(value,name);checks.push(name);console.log('PASS',name);};
async function ready(){await page.waitForFunction(()=>window.__mapQA?.started&&!window.__mapQA.transitioning&&!window.__mapQA.regionLoadError,null,{timeout:120000});}
async function inspect(){
  return page.evaluate(()=>{
    const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
    const canvas=bounds(document.querySelector('.hud-minimap canvas'));
    const rows=[...document.querySelectorAll('.hud-map-rows span')], columns=[...document.querySelectorAll('.hud-map-columns span')];
    const cardinal=Object.fromEntries([...document.querySelectorAll('.hud-cardinal')].map(el=>[el.textContent,bounds(el)]));
    const frame=bounds(document.querySelector('.hud-minimap-frame')), grid=bounds(document.querySelector('.hud-map-grid'));
    const map=bounds(document.querySelector('.hud-minimap'));
    const inside=[...rows,...columns].every(el=>{const r=bounds(el);return r.x>=map.x&&r.y>=map.y&&r.x+r.width<=map.x+map.width&&r.y+r.height<=map.y+map.height;});
    const attached=Math.abs(cardinal.N.y+cardinal.N.height-map.y)<1&&Math.abs(cardinal.S.y-map.y-map.height)<1&&Math.abs(cardinal.W.x+cardinal.W.width-map.x)<1&&Math.abs(cardinal.E.x-map.x-map.width)<1;
    return {
      rows:rows.map(el=>el.textContent).join(''),columns:columns.map(el=>el.textContent).join(''),
      aligned:rows.every((el,i)=>Math.abs((bounds(el).cy-canvas.y)/canvas.height-i/7)<.01)&&columns.every((el,i)=>Math.abs((bounds(el).cx-canvas.x)/canvas.width-(i+1)/7)<.01),
      compass:attached&&inside&&cardinal.N.cy<canvas.y&&cardinal.S.cy>canvas.y+canvas.height&&cardinal.W.cx<canvas.x&&cardinal.E.cx>canvas.x+canvas.width,
      grid:Math.abs(grid.x-canvas.x)<1&&Math.abs(grid.y-canvas.y)<1&&Math.abs(grid.width-canvas.width)<1&&document.querySelectorAll('.hud-map-grid path').length===6,
      visible:[...rows,...columns,...document.querySelectorAll('.hud-cardinal')].every(el=>{const r=bounds(el);return r.x>=0&&r.y>=0&&r.x+r.width<=innerWidth&&r.y+r.height<=innerHeight;}),
      frame,
    };
  });
}
try {
  await page.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await ready();
  for(const id of [...Object.keys(CITIES),...Object.keys(FIELDS)]){
    await page.evaluate(id=>{window.__mapQA.changeRegion(id);},id);await ready();
    const result=await inspect();
    check(`${id}: A-G, 1-7, aligned grid and N/W/E/S`,result.rows==='ABCDEFG'&&result.columns==='1234567'&&result.aligned&&result.compass&&result.grid&&result.visible);
    if(['arunika','verdant-plains-v2','frostfire-highlands'].includes(id))
      await page.locator('.hud-minimap-frame').screenshot({path:`${out}/${id}.png`});
  }
  await page.getByRole('button',{name:'Buka peta',exact:true}).click();
  await page.getByRole('heading',{name:'Peta dunia & teleportasi',exact:true}).waitFor();
  check('minimap still opens world map');await page.keyboard.press('Escape');
  for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(size);
    await page.evaluate(()=>{document.documentElement.style.setProperty('--lumenfall-ui-scale','1.25');window.dispatchEvent(new Event('lumenfall:interface-scale'));});
    await page.waitForTimeout(150);
    const result=await inspect();check(`${size.width}: labels stay visible and aligned at 125% UI`,result.visible&&result.aligned&&result.compass&&result.grid);
  }
  check('no runtime errors',errors.length===0);
  await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
