import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), stage=path.join(root,'sites-reconcile-v2');
const live='00d04c0833aa37afbc8676009a1c261c7f37724e';
const folders=['app','components','lib','hooks','data','public'];
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const files=folders.flatMap(dir=>walk(path.join(root,dir)));
const git=(...args)=>execFileSync('git',['-C',stage,...args],{encoding:'utf8',maxBuffer:16e6});
const tree=Object.fromEntries(git('ls-tree','-r',live,'--',...folders).trim().split('\n').filter(Boolean).map(line=>{const [meta,name]=line.split('\t');return [name,meta.split(' ')[2]]}));
const changes=[];
for(const file of files){const name=path.relative(root,file).replaceAll('\\','/');let data=fs.readFileSync(file);if(/\.(tsx?|css|json|mjs)$/.test(name))data=Buffer.from(data.toString().replaceAll('\r\n','\n'));const sha=crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');if(tree[name]!==sha)changes.push({name,status:tree[name]?'changed':'added'});delete tree[name]}
const hashes=new Map();
for(const file of walk(path.join(root,'public'))){const data=fs.readFileSync(file),h=crypto.createHash('sha256').update(data).digest('hex');const list=hashes.get(h)??[];list.push({path:path.relative(root,file),bytes:data.length});hashes.set(h,list)}
const duplicateAssets=[...hashes.values()].filter(v=>v.length>1);
const report={liveCommit:live,comparedFiles:files.length,changedOrAdded:changes,removedFromLive:Object.keys(tree),duplicateAssets};
fs.mkdirSync('output/release-audit',{recursive:true});
fs.writeFileSync('output/release-audit/source-comparison.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({comparedFiles:files.length,changedOrAdded:changes.length,removed:Object.keys(tree).length,duplicateAssets},null,2));
