import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:950}});
try{
 await page.goto('http://127.0.0.1:3004/terrain-prototype.html');await page.waitForFunction(()=>window.terrainQA?.state().ready);
 const inputs=[];for(const key of ['w','a','s','d']){await page.locator('#spawn').click();await page.locator('#world canvas').focus();const a=await page.evaluate(()=>window.terrainQA.state().position);await page.keyboard.down(key);await page.waitForTimeout(500);await page.keyboard.up(key);const b=await page.evaluate(()=>window.terrainQA.state().position);inputs.push({key,dx:b.x-a.x,dz:b.z-a.z});}
 const zoomBefore=await page.evaluate(()=>window.terrainQA.g.followView.targetDistance);await page.mouse.move(800,500);await page.mouse.wheel(0,300);await page.waitForTimeout(500);const zoomAfter=await page.evaluate(()=>window.terrainQA.g.followView.targetDistance);
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.terrainQA.g.paused);await page.keyboard.press('Escape');const resumed=await page.evaluate(()=>!window.terrainQA.g.paused);
 const result={headed:true,inputs,zoomBefore,zoomAfter,paused,resumed};fs.writeFileSync('dev-prototypes/lumenfall-terrain-prototype-01/evidence/input-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(inputs[0].dz>=-2||inputs[1].dx>=-2||inputs[2].dz<=2||inputs[3].dx<=2||zoomAfter<=zoomBefore||!paused||!resumed)process.exitCode=1;
}finally{await browser.close();}
