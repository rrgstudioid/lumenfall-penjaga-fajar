import { spawn } from 'node:child_process';
import { readFileSync,writeFileSync,readdirSync,mkdirSync } from 'node:fs';
const out='outputs/gameplay-migration';mkdirSync(out,{recursive:true});
const previous=JSON.parse(readFileSync(out+'/sequential-start/gameplay-suite-results.json','utf8'));
const testArgs=files=>['--disable-warning=ExperimentalWarning','--experimental-transform-types','--test',...files];
const filesFor=scope=>[...new Set(previous.results.filter(r=>r.scope===scope).map(r=>r.file))];
const results=[];
async function run(name,args,command=process.execPath){
 const result=await new Promise(resolve=>{let output='';const child=spawn(command,args,{windowsHide:true,env:process.env});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('close',exitCode=>{writeFileSync(out+'/'+name+'.log',output);resolve({name,exitCode,summary:output.split('\n').filter(s=>/^\u2139 (tests|pass|fail|skipped)/.test(s))});});});
 results.push(result);writeFileSync(out+'/sequential-validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result));return result;
}
await run('sequential-targeted',testArgs(['character-model','city-layout','rune-forge','forge','drag-drop','item-descriptions'].map(n=>'lib/game/'+n+'.test.ts')));
await run('contract',testArgs(['lib/game/canonical-gameplay.test.ts']));
// Entire files run, no test-name filters/skips. Mixed files retain outside failures.
await run('sequential-acceptance-files',testArgs(filesFor('gameplay-acceptance')));
await run('sequential-legacy-files',testArgs([...new Set([...filesFor('legacy-compatibility'),'lib/game/canonical-gameplay.test.ts'])]));
await run('regression',['--disable-warning=ExperimentalWarning','--experimental-transform-types','--test','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=./scripts/gameplay-events.mjs','--test-reporter-destination='+out+'/gameplay-events.jsonl',...readdirSync('lib/game').filter(f=>f.endsWith('.test.ts')).map(f=>'lib/game/'+f)]);
await run('reconciliation',['scripts/report-gameplay-regression.mjs']);
await run('acceptance-projection',['scripts/report-phase14.mjs']);
await run('build',['node_modules/vinext/dist/cli.js','build']);
await run('types',['scripts/check-gameplay-types.mjs']);
await run('full-types',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
await run('lint',['node_modules/oxlint/bin/oxlint','lib/game','components/game','scripts/check-gameplay-types.mjs','scripts/simulate-gameplay.ts','tests/browser/canonical-gameplay.tsx']);
await run('lint-full',['node_modules/oxlint/bin/oxlint']);
await run('simulator',['--disable-warning=ExperimentalWarning','--experimental-transform-types','scripts/simulate-gameplay.ts']);
await run('browser-runtime',['--disable-warning=ExperimentalWarning','--experimental-transform-types','scripts/verify-phase14-runtime.mjs']);
await run('diff-check',['-c','core.safecrlf=false','diff','--check'],'git');
await run('world-runtime',['scripts/verify-gameplay-world.mjs']);
writeFileSync(out+'/validation.json',JSON.stringify(results,null,2));
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
