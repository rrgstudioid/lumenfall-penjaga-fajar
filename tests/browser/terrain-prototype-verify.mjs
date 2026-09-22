import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve('dev-prototypes/lumenfall-terrain-prototype-01/evidence');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-swiftshader','--window-size=1600,1000']});
const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=[],warnings=[],failed=[],assets=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()]);if(r.url().includes('/assets/'))assets.push(r.url());});
try{
 await page.goto('http://127.0.0.1:3004/terrain-prototype.html',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.terrainQA?.state().ready,null,{timeout:45000});
 await page.waitForTimeout(1200);
 for(const [view,name] of [['orbit','02-transformed'],['top','03-top-layout'],['player','04-ground-eye']]){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,`${name}.png`)});}
 const initial=await page.evaluate(()=>window.terrainQA.state());
 await page.locator('#world canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');
 const walked=await page.evaluate(()=>window.terrainQA.state());
 await page.mouse.move(800,650);await page.mouse.down({button:'right'});await page.mouse.move(960,630,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,'05-walk-camera.png')});
 // Real keyboard movement on the authored route; steering changes yaw only, not position/speed.
 await page.locator('#spawn').click();
 const travelStart=await page.evaluate(()=>({time:window.terrainQA.g.combatTime,wall:performance.now()}));
 await page.locator('#world canvas').focus();await page.keyboard.down('w');
 for(const [x,z] of [[-70,72],[-52,34]]){
  await page.evaluate(([x,z])=>new Promise((resolve,reject)=>{const start=performance.now();function steer(){const g=window.terrainQA.g,dx=x-g.hero.x,dz=z-g.hero.z;if(Math.hypot(dx,dz)<.2){resolve(true);return;}if(performance.now()-start>12000){reject(Error('Route keyboard timeout'));return;}g.yaw=Math.atan2(-dx,-dz);g.followView.targetYaw=g.yaw;requestAnimationFrame(steer);}steer();}),[x,z]);
 }
 await page.keyboard.up('w');
 const travel=await page.evaluate(s=>({simulationSeconds:window.terrainQA.g.combatTime-s.time,wallSeconds:(performance.now()-s.wall)/1000,arrival:window.terrainQA.state().position}),travelStart);
 await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'06-town-to-field.png')});
 await page.evaluate(()=>{window.terrainQA.teleport(18,-20);window.terrainQA.g.yaw=-Math.PI/2;window.terrainQA.g.followView.targetYaw=-Math.PI/2;});
 await page.locator('#world canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(3300);await page.keyboard.up('w');
 const crossing=await page.evaluate(()=>window.terrainQA.state());
 await page.screenshot({path:path.join(out,'07-river-crossing.png')});
 await page.locator('[data-view="top"]').click();await page.waitForTimeout(300);await page.locator('aside').screenshot({path:path.join(out,'08-road-landmark-plan.png')});
 const checks=await page.evaluate(()=>{
  const {g,terrain:t}=window.terrainQA;
  const routes=t.m.roads.map(r=>{let p={x:r.points[0][0],z:r.points[0][1]},blocked=0,maxGrade=0;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*5),dx=(b[0]-a[0])/steps,dz=(b[1]-a[1])/steps;for(let j=0;j<steps;j++){const before=p,after=g.moveHeroOnGround(p,dx,dz);if(Math.hypot(after.x-p.x-dx,after.z-p.z-dz)>.01)blocked++;const y1=t.ground.heightAt(before.x,before.z),y2=t.ground.heightAt(after.x,after.z);maxGrade=Math.max(maxGrade,Math.abs(y2-y1)/Math.hypot(dx,dz));p=after;}}return{name:r.name,blocked,end:p,expected:r.points.at(-1),maxGrade};});
  const dry={x:160,z:0},edge=t.ground.move(dry,10,0);
  const water=t.ground.heightAt(t.riverX(100),100);
  const bridge=t.ground.heightAt(t.riverX(-20),-20);
  const cliffStart={x:121,z:-165},cliffEnd=t.ground.move(cliffStart,12,0);
  return{routes,edge,water:water??null,bridge,cliffStart,cliffEnd,noEnemies:g.enemies.length===0,noNPC:g.regionNpcs?.length??0,shaderErrors:g.renderer.info.programs?.filter(p=>p.diagnostics?.runnable===false).length??0};
 });
 const result={headed:true,browser:await browser.version(),initial,walked,walkDistance:Math.hypot(walked.position.x-initial.position.x,walked.position.z-initial.position.z),townToFieldTravel:travel,keyboardBridgeCrossing:crossing,checks,errors,warnings,failed,assets:[...new Set(assets)],flyffRuntimeRequests:assets.filter(s=>/flyff|flaris|\.dds|\.o3d|\.lnd/i.test(s))};
 fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(errors.length||failed.length||checks.routes.some(r=>r.blocked)||result.walkDistance<1||crossing.position.x<38||Math.abs(checks.bridge-15.95)>1e-5)process.exitCode=1;
}catch(e){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),errors,failed},null,2));throw e;}finally{await browser.close();}
