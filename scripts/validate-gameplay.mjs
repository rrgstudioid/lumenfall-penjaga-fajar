import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
const directory = 'outputs/gameplay-migration';
mkdirSync(directory, {recursive:true});
/** @type {Array<[string, string[]]>} */
const jobs = [
  ['contract', ['--disable-warning=ExperimentalWarning','--experimental-transform-types','--test','lib/game/canonical-gameplay.test.ts']],
  ['regression', ['--disable-warning=ExperimentalWarning','--experimental-transform-types','--test','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=./scripts/gameplay-events.mjs','--test-reporter-destination=outputs/gameplay-migration/gameplay-events.jsonl',...readdirSync('lib/game').filter(f=>f.endsWith('.test.ts')).map(f=>'lib/game/'+f)]],
  ['simulator', ['--disable-warning=ExperimentalWarning','--experimental-transform-types','scripts/simulate-gameplay.ts']],
  ['world-runtime', ['scripts/verify-gameplay-world.mjs']],
  ['full-types', ['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']],
  ['types', ['scripts/check-gameplay-types.mjs']],
  ['build', ['node_modules/vinext/dist/cli.js','build']],
  ['lint-full', ['node_modules/oxlint/bin/oxlint']],
  ['lint', ['node_modules/oxlint/bin/oxlint','lib/game','components/game','scripts/check-gameplay-types.mjs','scripts/simulate-gameplay.ts','tests/browser/canonical-gameplay.tsx']],
];
if (process.env.PLAYWRIGHT_MODULE) jobs.push(['browser-fixture', ['scripts/verify-gameplay-browser.mjs']]);
const results = await Promise.all(jobs.map(([name,args]) => new Promise(resolve => {
  let output='';
  const child=spawn(process.execPath,args,{windowsHide:true,env:process.env});
  child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
  child.on('close',code=>{
    writeFileSync(`${directory}/${name}.log`,output);
    const summary=output.split('\n').filter(line=>/^(ℹ (tests|pass|fail)|Found \d|Finished in)/.test(line));
    const result={name,exitCode:code,summary}; console.log(JSON.stringify(result));resolve(result);
  });
})));
// Reconcile historical identities, then classify every executed test without filtering.
for(const [name,command,args] of [
 ['reconciliation',process.execPath,['scripts/report-gameplay-regression.mjs']],
 ['acceptance-projection',process.execPath,['scripts/report-phase14.mjs']],
 ['diff-check','git',['-c','core.safecrlf=false','diff','--check']],
]){
 const result=await new Promise(resolve=>{
  let output='';const child=spawn(command,args,{windowsHide:true,env:process.env});
  child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
  child.on('close',exitCode=>{writeFileSync(directory+'/'+name+'.log',output);resolve({name,exitCode,summary:[]});});
 });results.push(result);console.log(JSON.stringify(result));
}
if (!process.env.PLAYWRIGHT_MODULE) results.push({name:'browser-fixture',exitCode:null,status:'not-run',summary:['No local PLAYWRIGHT_MODULE supplied; no browser fixture executed in this run.']});
results.push({name:'browser-full-gameplay-parity',exitCode:null,status:'not-run',summary:['Fixture and world-method checks do not validate world AI, movement/combat input or boss TTK parity.']});
writeFileSync(`${directory}/validation.json`,JSON.stringify(results,null,2));
process.exitCode=results.some(result=>result.exitCode!==0&&result.exitCode!==null)?1:0;
