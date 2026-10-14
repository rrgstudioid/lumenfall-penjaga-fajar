// Isolated creation regression: actual menu, back/side colors, idle GPU work.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../work/character-tools/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1.5});
const baseline=process.argv.includes('--baseline'),out='output/character-hair-volume';
await mkdir(out,{recursive:true});
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
await page.addInitScript(()=>{
  window.__draws=0;window.__triangles=0;
  for(const type of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays']){
    const original=type.prototype[name];type.prototype[name]=function(...args){
      if(this.canvas.closest?.('.character-preview')){window.__draws++;if(args[0]===4)window.__triangles+=(name==='drawElements'?args[1]:args[2])/3;}
      return original.apply(this,args);
    };
  }
});
try{
  await page.goto(process.env.LUMENFALL_TEST_URL??'http://localhost:3000/');
  await page.getByRole('button',{name:'NEW GAME',exact:true}).click();
  await page.getByRole('button',{name:'CREATE CHARACTER',exact:true}).click();
  await page.getByText('Memuat karakter...', {exact:true}).waitFor({state:'hidden',timeout:60000});
  await page.waitForTimeout(1500);
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
  const before=await session.send('Performance.getMetrics');
  await page.evaluate(()=>{window.__draws=0;window.__triangles=0;});
  await page.waitForTimeout(2000);
  const after=await session.send('Performance.getMetrics');
  const stats=await page.evaluate(()=>({draws:window.__draws,triangles:window.__triangles,canvas:{width:document.querySelector('.character-preview canvas').width,height:document.querySelector('.character-preview canvas').height}}));
  stats.taskMs=1000*(after.metrics.find(m=>m.name==='TaskDuration').value-before.metrics.find(m=>m.name==='TaskDuration').value);
  stats.assets=requests.filter(u=>u.includes('/male-v2/'));
  await writeFile(`${out}/${baseline?'before':'after'}.json`,JSON.stringify(stats,null,2));
  if(baseline){console.log(stats);}
  else{
    if(stats.draws>8)throw Error('Creation keeps rendering while idle');
    const names=['Messy Spikes','Crew Cut','Mohawk','Undercut','Ponytail','Bowl Cut','Curtain Bangs','Cornrows','Very Long Hair','Long Hair Tied'];
    for(const [i,name]of names.entries()){
      await page.getByRole('tab',{name:'Hairstyle',exact:true}).click();
      await page.getByRole('button',{name,exact:true}).click();
      await page.getByRole('tab',{name:'Hair Color',exact:true}).click();
      await page.getByRole('textbox',{name:'Hair color hex'}).fill('#33aacc');
      await page.waitForTimeout(600);
      await page.locator('.character-preview').screenshot({path:`${out}/hair-${i+1}-front.png`});
      const surface=page.locator('.character-preview-canvas');const b=await surface.boundingBox();
      for(const label of ['right','back','left']){
        await page.mouse.move(b.x+b.width*.45,b.y+b.height*.5);await page.mouse.down();
        await page.mouse.move(b.x+b.width*.45+(Math.PI/2)/.012,b.y+b.height*.5,{steps:12});await page.mouse.up();
        await page.waitForTimeout(180);
        await page.locator('.character-preview').screenshot({path:`${out}/hair-${i+1}-${label}.png`});
      }
      if(i===2){
        await page.mouse.move(b.x+b.width*.45,b.y+b.height*.5);await page.mouse.down();
        await page.mouse.move(b.x+b.width*.45-(Math.PI/2)/.012,b.y+b.height*.5,{steps:12});await page.mouse.up();
        for(const [label,color]of [['white','#eeeeee'],['red','#a52b35'],['black','#171719']]){
          await page.getByRole('textbox',{name:'Hair color hex'}).fill(color);
          await page.waitForTimeout(150);
          await page.locator('.character-preview').screenshot({path:`${out}/back-${label}.png`});
        }
      }
      await page.getByRole('button',{name:'Reset kamera',exact:true}).click();
    }
    if(errors.length)throw Error(errors.join('\n'));
    console.log(JSON.stringify({stats,errors}));
  }
}finally{await browser.close();}
