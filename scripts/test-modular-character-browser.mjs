import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../work/character-tools/package.json',import.meta.url));
const {chromium}=require('playwright');
const sharp=require('sharp');
const out=resolve('work/modular-male/browser'),built=resolve(out,'build');await mkdir(out,{recursive:true});
await build({configFile:false,publicDir:false,logLevel:'warn',build:{outDir:built,emptyOutDir:false,minify:false,chunkSizeWarningLimit:5000,rolldownOptions:{input:resolve('tests/browser/modular-character-fixture.html')}}});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname,root=/^\/assets\/(characters|decoders)\//.test(path)?resolve('public'):built;
  if(path==='/favicon.ico'){res.writeHead(204).end();return;}
  const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'\\')){res.writeHead(403).end();return;}
  try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(bytes);}catch{console.log('404',path);res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[],requests=[];
page.on('request',r=>requests.push(r.url()));
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/modular-character-fixture.html`);
  await page.waitForFunction(()=>window.maleV2?.snapshot().actors===1&&document.querySelector('#status').textContent.includes('acceptance'),null,{timeout:30000});
  const results=[];
  await page.evaluate(()=>window.maleV2.appearance({},0));
  for(const name of ['front','side','back','face']){await page.evaluate(n=>window.maleV2.view(n),name);await page.screenshot({path:resolve(out,name+'.png')});}
  await page.evaluate(()=>window.maleV2.freeze(true));
  // Exercise custom scalp depth shaders with both original and fitted hair.
  await page.evaluate(()=>window.maleV2.shadows(true));
  await page.evaluate(()=>window.maleV2.appearance({hairStyleId:'hair_03'},0));
  await page.evaluate(()=>window.maleV2.appearance({hairStyleId:'hair_01'},0));
  await page.evaluate(()=>window.maleV2.shadows(false));
  const toneImages=[];
  for(const tone of ['skin_01','skin_03','skin_05']){
    await page.evaluate(tone=>window.maleV2.appearance({skinToneId:tone},0),tone);
    for(const name of ['front','back','quarter']){
      await page.evaluate(n=>window.maleV2.view(n),name);
      await page.screenshot({path:resolve(out,`outfit-${tone}-${name}.png`)});
      if(name==='front')toneImages.push(await page.screenshot());
    }
  }
  const pixelChecks=[];
  for(const [name,left,top,width,height]of [['tunic',630,420,20,12],['shorts',597,559,12,12],['arm',568,446,8,8]]){
    const buffers=await Promise.all([toneImages[0],toneImages[2]].map(b=>sharp(b).extract({left,top,width,height}).removeAlpha().raw().toBuffer()));
    const difference=buffers[0].reduce((sum,v,i)=>sum+Math.abs(v-buffers[1][i]),0)/buffers[0].length;
    pixelChecks.push({name,difference});
    if(name!=='arm'&&difference>.1)throw Error(`Skin tone changed ${name}: ${difference}`);
    if(name==='arm'&&difference<10)throw Error(`Skin tone did not change exposed arm: ${difference}`);
  }
  await writeFile(resolve(out,'skin-isolation.json'),JSON.stringify(pixelChecks,null,2));
  for(const lod of [1,2,3]){
    await page.evaluate(lod=>window.maleV2.appearance({},lod),lod);
    await page.evaluate(()=>window.maleV2.view('front'));
    await page.screenshot({path:resolve(out,`outfit-lod${lod}.png`)});
  }
  await page.evaluate(()=>window.maleV2.appearance({skinToneId:'skin_02'},0));
  await page.evaluate(()=>window.maleV2.freeze(false));
  // Inspect the base without its attachment: skin must stay bald at every angle.
  await page.evaluate(()=>window.maleV2.hairVisible(false));
  for(const name of ['face','headRight','headBack','headLeft']){
    await page.evaluate(n=>window.maleV2.view(n),name);
    await page.screenshot({path:resolve(out,'bald-'+name+'.png')});
  }
  await page.evaluate(()=>{window.maleV2.hairVisible(true);window.maleV2.view('face');});
  results.push(await page.evaluate(()=>window.maleV2.snapshot()));
  for(let i=1;i<=10;i++){
    await page.evaluate(i=>window.maleV2.appearance({hairStyleId:`hair_${String(i).padStart(2,'0')}`,hairColor:'#6a4024'}),i);
    if((await page.evaluate(()=>window.maleV2.snapshot())).hairAttachments.some(n=>n!==1))throw Error('Hairstyles accumulated while switching');
    await page.screenshot({path:resolve(out,`hair-${i}.png`)});
    for(const view of ['headRight','headBack','headLeft']){await page.evaluate(v=>window.maleV2.view(v),view);await page.screenshot({path:resolve(out,`hair-${i}-${view}.png`)});}
    await page.evaluate(()=>window.maleV2.view('face'));
  }
  await page.evaluate(()=>window.maleV2.view('front'));await page.evaluate(()=>window.maleV2.move(true));
  await page.waitForTimeout(500);await page.screenshot({path:resolve(out,'run.png')});
  await page.evaluate(()=>window.maleV2.move(false));
  // Real rendered thumbnails, never placeholders or unrelated drawings.
  await page.setViewportSize({width:320,height:320});
  await page.addStyleTag({content:'#status{display:none}'});
  await page.evaluate(()=>window.maleV2.view('face'));
  for(const [prefix,count]of [['hair',10]])for(let i=prefix==='hair'?1:0;i<(prefix==='hair'?11:count);i++){
    const id=`${prefix}_${String(i).padStart(2,'0')}`;
    await page.evaluate(id=>window.maleV2.appearance({hairStyleId:id}),id);
    const bytes=await page.screenshot();await sharp(bytes).resize(192,192).webp({quality:88}).toFile(resolve('public/assets/characters/male-v2/thumbnails',id+'.webp'));
  }
  const bodyRequestsBefore=requests.filter(u=>u.includes('/body/')).length;
  await page.evaluate(()=>Promise.all([
    window.maleV2.appearance({hairStyleId:'hair_03',skinToneId:'skin_01'}),
    window.maleV2.appearance({hairStyleId:'hair_09',skinToneId:'skin_05'}),
    window.maleV2.appearance({hairStyleId:'hair_04',hairColor:'#aa2244'}),
  ]));
  if(requests.filter(u=>u.includes('/body/')).length!==bodyRequestsBefore)throw Error('Appearance reloaded the base body');
  const cycles=[];
  for(let i=0;i<10;i++){await page.evaluate(()=>window.maleV2.crowd(1));cycles.push(await page.evaluate(()=>window.maleV2.reset()));}
  if(cycles.some(c=>c.cache.users||c.cache.entries||c.memory.textures))throw Error('Character resources leaked after disposal');
  await writeFile(resolve(out,'lifecycle.json'),JSON.stringify({cycles,bodyRequestsBefore,requests},null,2));
  if(process.argv.includes('--benchmark')){
    const benchmark=[];
    for(const [width,height]of [[1920,1080],[2560,1440]]){
      await page.setViewportSize({width,height});
      for(const count of [1,10,25,50,100]){
        await page.evaluate(c=>window.maleV2.crowd(c),count);
        await page.evaluate(()=>{window.maleV2.manage(true);window.maleV2.move(true);});
        await page.waitForTimeout(750);
        benchmark.push({width,height,kind:'male-v2',...await page.evaluate(()=>window.maleV2.sample(2000))});
      }
      await page.evaluate(()=>window.maleV2.crowd(1,true));await page.evaluate(()=>window.maleV2.move(true));
      await page.waitForTimeout(500);benchmark.push({width,height,kind:'legacy-cena',...await page.evaluate(()=>window.maleV2.sample(2000))});
    }
    await writeFile(resolve(out,'benchmark.json'),JSON.stringify(benchmark,null,2));
  }
  await writeFile(resolve(out,'smoke.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));if(errors.length)process.exitCode=1;
}catch(e){console.log('BROWSER_FAILURE',errors,await page.locator('#status').textContent());await page.screenshot({path:resolve(out,'failure.png')});throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
