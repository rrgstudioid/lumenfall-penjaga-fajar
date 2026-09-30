// Use a fresh browser context: this never opens or changes the user's saves.
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(new URL('../work/character-tools/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const out='work/modular-male/browser';await mkdir(out,{recursive:true});
try{
  await page.goto(process.env.LUMENFALL_TEST_URL??'http://localhost:3000/');
  await page.getByRole('button',{name:'NEW GAME',exact:true}).click();
  await page.getByRole('button',{name:'CREATE CHARACTER',exact:true}).click();
  await page.locator('.character-preview canvas').waitFor();
  await page.locator('.character-preview canvas').evaluate(el=>el.dataset.qaRenderer='retained');
  await page.getByText('Memuat karakter...', {exact:true}).waitFor({state:'hidden',timeout:30000});
  if(await page.getByText('Preview 3D belum dapat dimuat.').count())throw Error('Preview did not load');
  const bodyLoads=requests.filter(u=>u.includes('/male-v2/body/')).length;
  await page.getByRole('button',{name:'Mohawk',exact:true}).click();
  if(await page.getByRole('tab',{name:'Facial Hair',exact:true}).count())throw Error('Facial hair menu still exists');
  await page.getByRole('tab',{name:'Skin',exact:true}).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  await page.getByRole('tab',{name:'Hair Color',exact:true}).click();
  await page.getByRole('textbox',{name:'Hair color hex'}).fill('#33aacc');
  await page.getByLabel('CHARACTER NAME',{exact:true}).fill('MaleV2QA');
  await page.waitForTimeout(1000);
  if(requests.filter(u=>u.includes('/male-v2/body/')).length!==bodyLoads)throw Error('Creation options reloaded body');
  if(await page.locator('.character-preview canvas').getAttribute('data-qa-renderer')!=='retained')throw Error('Appearance recreated the WebGL canvas');
  await page.screenshot({path:out+'/creation-customized.png'});
  await page.getByRole('button',{name:'CREATE CHARACTER',exact:true}).click();
  await page.waitForTimeout(800);
  const saved=await page.evaluate(()=>{
    function find(v){if(v&&typeof v==='object'){if(v.characterName==='MaleV2QA'&&v.appearance)return v.appearance;for(const x of Object.values(v)){const result=find(x);if(result)return result;}}}
    for(const key of Object.keys(localStorage)){try{const a=find(JSON.parse(localStorage.getItem(key)));if(a)return a;}catch{}}
  });
  if(saved?.hairStyleId!=='hair_03'||saved?.hairColor!=='#33aacc'||Object.hasOwn(saved??{},'facialHairId')||saved?.skinToneId!=='skin_05')throw Error('Appearance not saved: '+JSON.stringify(saved));
  await page.reload();await page.waitForTimeout(1000);
  await page.screenshot({path:out+'/creation-saved.png'});
  if(process.argv.includes('--world')){
    await page.getByRole('button',{name:'CONTINUE',exact:true}).click();
    await page.locator('.gameplay-hud:not([hidden])').waitFor({timeout:90000});
    await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
    await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');
    await page.screenshot({path:out+'/world-male-v2.png'});
    for(let i=0;i<3;i++){await page.keyboard.press('c');await page.waitForTimeout(500);await page.keyboard.press('Escape');}
  }
  await writeFile(out+'/creation.json',JSON.stringify({saved,bodyLoads,errors,requests:requests.filter(u=>u.includes('/characters/'))},null,2));
  const retry=await browser.newPage({viewport:{width:1440,height:1000}});
  await retry.route('**/male-v2/hair/hair_01-lod0.glb*',route=>route.fulfill({status:503,body:'intentional fixture failure'}));
  await retry.goto(process.env.LUMENFALL_TEST_URL??'http://localhost:3000/');
  await retry.getByRole('button',{name:'NEW GAME',exact:true}).click();
  await retry.getByRole('button',{name:'CREATE CHARACTER',exact:true}).click();
  await retry.getByRole('button',{name:'Coba lagi',exact:true}).waitFor({timeout:30000});
  await retry.unroute('**/male-v2/hair/hair_01-lod0.glb*');
  await retry.getByRole('button',{name:'Coba lagi',exact:true}).click();
  await retry.getByRole('button',{name:'Coba lagi',exact:true}).waitFor({state:'hidden',timeout:30000});
  await retry.getByText('Memuat karakter...', {exact:true}).waitFor({state:'hidden',timeout:30000});
  if(await retry.getByRole('button',{name:'Coba lagi',exact:true}).count())throw Error('Asset retry failed');
  await retry.close();
  console.log(JSON.stringify({saved,bodyLoads,errors}));if(errors.length)process.exitCode=1;
}catch(e){await page.screenshot({path:out+'/creation-failure.png'});console.error((await page.locator('body').innerText()).slice(0,2500));throw e;}
finally{await browser.close();}
