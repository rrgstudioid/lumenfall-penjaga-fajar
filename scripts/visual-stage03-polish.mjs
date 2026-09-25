import { chromium } from 'file:///C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
const phase=process.argv[2]??'final';
const folder=`dev-prototypes/mahkota-fajar-stage03-v1/evidence/polish-${phase}`;
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(phase==='gallery'){
  await page.goto(new URL('../dev-prototypes/mahkota-fajar-stage03-v1/evidence/polish-comparison.html',import.meta.url).href);
  await page.evaluate(async()=>{const images=[...document.images];images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode().catch(()=>{})));});
  const check=await page.evaluate(()=>({images:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),sections:document.querySelectorAll('section').length,overflow:document.documentElement.scrollWidth>innerWidth}));
  await page.screenshot({path:`${folder}/gallery.png`});await writeFile(`${folder}/results.json`,JSON.stringify({check,errors},null,2));console.log(check);await browser.close();process.exit(0);
 }
 await page.goto('http://127.0.0.1:3013/tests/browser/mahkota-fajar-stage03.html');
 await page.waitForFunction(()=>window.stage03?.state().ready,{}, {timeout:120000});
 if(phase==='camera'){
  const result=await page.evaluate(()=>{
   const {game:g,city:c,setView}=window.stage03;setView('player');
   const m=c.manifest, V=g.actor.position.constructor;
   const insidePoly=(x,z,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
   const volumes=m.cameraVolumes??[];
   const inside=(p)=>volumes.some(b=>p.x>b.min[0]+.02&&p.x<b.max[0]-.02&&p.y>b.min[1]+.02&&p.y<b.max[1]-.02&&p.z>b.min[2]+.02&&p.z<b.max[2]-.02)||m.blockers.some(b=>b.kind==='polygon'&&p.y>b.minY+.02&&p.y<b.maxY-.02&&insidePoly(p.x,p.z,b.points));
   const sites=m.records.filter(r=>r.id.startsWith('LF2_')&&r.id.endsWith('_stone')).map(r=>({id:r.id,points:[[r.min[0]-2,-(r.min[1]+r.max[1])/2],[r.max[0]+2,-(r.min[1]+r.max[1])/2],[(r.min[0]+r.max[0])/2,-r.min[1]+2],[(r.min[0]+r.max[0])/2,-r.max[1]-2]]}));
   sites.push(...m.anchors.map(a=>({id:a.id,points:[[a.position[0],a.position[2]]]})),{id:'wall-east',points:[[102,-1.565]]},{id:'wall-west',points:[[-102,-1.565]]},{id:'tight-shop-road',points:[[-63,8]]});
   const rows=[];
   for(const site of sites){let sampled=0,blocked=0,skipped=0;const failures=[];
    for(const [x,z]of site.points){if(!c.collision.valid({x,z})){skipped++;continue;}
     g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);const focus=g.actor.position.clone().add(new V(0,1.65,0));if(inside(focus)){skipped++;continue;}
     for(const pitch of [.15,.45,.85])for(let i=0;i<24;i++){
      Object.assign(g.followView,{yaw:i*Math.PI/12,targetYaw:i*Math.PI/12,pitch,targetPitch:pitch,distance:9,targetDistance:9});g.safeCameraDistance=9;g.updateCamera(1/60);
      sampled++;if(g.camera.position.distanceTo(focus)<8.5)blocked++;
      const w=m.cameraWall,p=g.camera.position;const wallEscape=w&&p.y<w.maxY-.02&&Math.hypot(p.x-w.center[0],p.z-w.center[1])>w.radius+.02;
      if(inside(p)||wallEscape)failures.push({yaw:i,pitch,position:p.toArray(),wallEscape});
     }
    }rows.push({id:site.id,sampled,blocked,skipped,failures});
   }
   window.stage03.teleport('spawn');g.safeCameraDistance=.5;const recovery=[];Object.assign(g.followView,{yaw:0,targetYaw:0,pitch:.45,targetPitch:.45});for(let i=0;i<120;i++){g.updateCamera(1/60);recovery.push(g.safeCameraDistance);}
   return {rows,recovery:{initial:recovery[0],final:recovery.at(-1),monotonic:recovery.every((v,i)=>!i||v>=recovery[i-1]-.001),maxStep:Math.max(...recovery.slice(1).map((v,i)=>v-recovery[i]))}};
  });
  await writeFile(`${folder}/results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
 const views=phase==='camera'?['player']:phase==='landmarks'?['guild','job','overview']:['top','overview','front','guild','job','training','merchant','potion','weapon','armor','forge','bank','inn','residential','warp','edge','street','center','player'];
 const viewMetrics={};
 for(const v of views){await page.evaluate(v=>window.stage03.setView(v),v);await page.waitForTimeout(650);await page.screenshot({path:`${folder}/${v}.png`});viewMetrics[v]=await page.evaluate(()=>window.stage03.state());}
 await writeFile(`${folder}/state.json`,JSON.stringify({state:await page.evaluate(()=>window.stage03.state()),viewMetrics,errors},null,2));
 console.log(folder);
}finally{await browser.close();}
