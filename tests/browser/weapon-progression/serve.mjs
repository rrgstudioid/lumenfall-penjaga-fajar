import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {createServer,createLogger} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const fixtureDir=path.resolve(import.meta.dirname),dir=path.resolve(process.env.EQUIPMENT_BROWSER_OUTPUT),root=process.cwd(),relative=path.relative(root,fixtureDir).replaceAll('\\','/');
fs.mkdirSync(dir,{recursive:true});
const files=['lib/game/weapon-progression-v1.ts','lib/game/equipment-detail-presentation.ts','components/game/equipment-detail.tsx','app/equipment-detail.css','app/globals.css','components/game/forge-panel.tsx',relative+'/examples.tsx','lib/game/equipment-authoring-v1.ts','lib/game/dual-wield.ts','lib/game/adventurer-ranks-reference-v2.ts','components/game/item-hover.tsx','lib/game/warrior-specialization-reference-v3.ts','lib/game/jayantara-range-v3.ts','lib/game/items.ts','lib/game/city-services.ts','lib/game/berserker-v3.ts','lib/game/blade-master-v3.ts','lib/game/attack-range-v2.ts','lib/game/warrior-reference-v3.ts','lib/game/skill-presentation-v3.ts','lib/game/resource-profiles.ts','lib/game/warrior-v3.ts','components/game/v3-job-trainer.tsx','lib/game/rules.ts','lib/game/character-view.ts','lib/game/stat-presentation.ts','lib/game/character-screen.ts','components/game/character-screen.tsx','lib/game/world.ts','lib/game/combat-modifiers.ts','lib/game/canonical-config.ts','lib/game/cast-timing.ts','lib/game/skill-action.ts','lib/game/shared-magic-stat-foundation.ts','lib/game/combat-mechanics.ts','app/page.tsx',relative+'/fixture.tsx',relative+'/bootstrap.mjs',relative+'/index.html'];
const sourceHashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const startedUTC=new Date().toISOString(),log=(type,detail={})=>{const entry={UTC:new Date().toISOString(),type,...detail};fs.appendFileSync(path.join(dir,'server-events.jsonl'),JSON.stringify(entry)+'\n');console.log(JSON.stringify(entry));};
const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen({port:0,host:'127.0.0.1'},resolve);});
const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
let handoff={};
// Only an explicitly named own checkpoint handoff; never native browser storage.
if(process.env.EQUIPMENT_OWN_HANDOFF){
 const own=JSON.parse(fs.readFileSync(process.env.EQUIPMENT_OWN_HANDOFF,'utf8').trim().split('\n').at(-1));
 if(own.entries?.length!==1||own.entries[0][0]!=='lumenfall-saves-v3'||typeof own.entries[0][1]!=='string')throw Error('INVALID_OWN_HANDOFF');
 handoff={entries:own.entries};
}
const logger=createLogger(),originalError=logger.error.bind(logger);logger.error=(message,opts)=>{log('vite-error',{message});originalError(message,opts);};
const server=await createServer({root,configFile:false,define:{"process.env.__VINEXT_IMAGE_REMOTE_PATTERNS":"undefined","process.env.__VINEXT_IMAGE_DOMAINS":"undefined","process.env.__VINEXT_IMAGE_DEVICE_SIZES":"undefined","process.env.__VINEXT_IMAGE_SIZES":"undefined","process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_SVG":"undefined","process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_LOCAL_IP":"undefined","process.env.__VINEXT_IMAGE_UNOPTIMIZED":"undefined"},customLogger:logger,cacheDir:path.join(dir,'isolated-cache'),
 optimizeDeps:{entries:[relative+'/index.html'],include:['three','three/examples/jsm/loaders/GLTFLoader.js','react','react-dom/client']},
 resolve:{alias:{'@':root,'next/image':path.join(process.env.LUMENFALL_NODE_MODULES,'vinext/dist/shims/image.js')}},server:{host:'127.0.0.1',port,strictPort:true,watch:{ignored:[dir.replaceAll('\\','/')+'/**']}},
 plugins:[react(),tailwind(),{name:'bounded-e2e-evidence',configureServer(s){s.middlewares.use((req,res,next)=>{
 const start=performance.now();res.once('finish',()=>log('http',{url:req.url,status:res.statusCode,ms:performance.now()-start}));
 const pathname=(req.url??'').split('?')[0].replace(/^\//,'');
 if(files.includes(pathname)||pathname==='app/globals.css'){
  const chunks=[],write=res.write.bind(res),end=res.end.bind(res);
  res.write=function(chunk,...args){if(chunk)chunks.push(Buffer.isBuffer(chunk)?Buffer.from(chunk):Buffer.from(chunk,typeof args[0]==='string'?args[0]:undefined));return Reflect.apply(write,this,[chunk,...args]);};
  res.end=function(chunk,...args){if(chunk)chunks.push(Buffer.isBuffer(chunk)?Buffer.from(chunk):Buffer.from(chunk,typeof args[0]==='string'?args[0]:undefined));const result=Reflect.apply(end,this,[chunk,...args]);
   const bytes=Buffer.concat(chunks),sha256=crypto.createHash('sha256').update(bytes).digest('hex');fs.mkdirSync(path.join(dir,'served-modules'),{recursive:true});const name=pathname.replaceAll('/','_')+'-'+sha256+'.txt';
   fs.writeFileSync(path.join(dir,'served-modules',name),bytes);log('served-module',{url:req.url,path:pathname,status:res.statusCode,bytes:bytes.length,sha256,rawSourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,pathname))).digest('hex'),artifact:'served-modules/'+name});return result;};
 }
 if(req.url==='/fixture-handoff'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(handoff??{}));return;}
 if((req.url==='/checkpoint-evidence'||req.url==='/fixture-handoff')&&req.method==='POST'){
 let body='',invalid=false;req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>262144){invalid=true;res.statusCode=413;res.end();req.destroy();}});
 req.on('end',()=>{if(invalid)return;try{const value=JSON.parse(body);
 if(req.url==='/fixture-handoff'){
 if(!Array.isArray(value.entries)||value.entries.length!==1||typeof value.entries[0][0]!=='string'||typeof value.entries[0][1]!=='string')throw Error('INVALID_OWN_HANDOFF');
 handoff=value;fs.appendFileSync(path.join(dir,'fixture-save-handoff.jsonl'),JSON.stringify({UTC:new Date().toISOString(),...value})+'\n');
 log('handoff',{bytes:Buffer.byteLength(value.entries[0][1]),sha256:crypto.createHash('sha256').update(value.entries[0][1]).digest('hex')});
 }else fs.appendFileSync(path.join(dir,'browser-events.jsonl'),JSON.stringify({receivedUTC:new Date().toISOString(),...value})+'\n');
 res.end('saved');}catch(error){log('evidence-error',{message:String(error)});res.statusCode=400;res.end('invalid');}});return;}next();});}}]});
try{await server.listen();await server.environments.client.depsOptimizer?.scanProcessing;
 for(const name of ['three','three/examples/jsm/loaders/GLTFLoader.js','react','react-dom/client']){const metadata=server.environments.client.depsOptimizer.metadata,dependency=metadata.optimized[name]??metadata.discovered[name];if(!dependency)throw Error('INITIAL_DEPENDENCY_MISSING:'+name);await dependency.processing;}
 const url='http://127.0.0.1:'+port+'/'+relative+'/index.html';
 fs.writeFileSync(path.join(dir,'server-ready.json'),JSON.stringify({startedUTC,readyUTC:new Date().toISOString(),pid:process.pid,cwd:root,host:'127.0.0.1',port,url,cacheDir:path.join(dir,'isolated-cache'),sourceHashes},null,2),{flag:'wx'});log('ready',{url,pid:process.pid});
 let closing=false;const cleanup=async()=>{if(closing)return;closing=true;clearInterval(stop);await server.close();log('closed',{exitCode:0});process.exit(0);};
 const stop=setInterval(()=>{if(fs.existsSync(path.join(dir,'STOP_OWN_SERVER.txt')))void cleanup();},200);process.once('SIGINT',cleanup);
}catch(error){log('startup-failure',{message:String(error),stack:error.stack});await server.close();process.exitCode=1;}
