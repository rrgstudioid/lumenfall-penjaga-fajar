import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
function read(path) { const bytes=readFileSync(path); return bytes[0]===255&&bytes[1]===254 ? bytes.toString('utf16le') : bytes.toString('utf8'); }
const aliases={
 'public creation is V3 Adventurer; explicit V2 fixture remains separate':'new character creation is V2 Adventurer and does not auto-promote',
 'FINAL A: Lv15 controlled Warrior Strike raw follows weighted sword contribution':'FINAL A: Lv15 controlled Warrior Strike raw is exactly 45.04',
 'unconfigured manual reset preserves Mastery and equipped Off Hand atomically':'refunding Mastery removes capability and safely returns the Off Hand item to inventory',
 'failed enhancement preserves its level and spends attempt material':'failed low enhancement downgrades once, never below zero, and spends material',
 'Eternal Seal is preserved on success and failure':'Eternal Seal is only consumed on failure and protects +8 equipment',
 'unprotected +8 failure retains equipment and its equipped reference':'unprotected +8 failure removes only target equipment and clears its equipped reference',
 'progression caps at level 100 and grants skill points':'progression caps at level 50 and grants skill points',
 '2B progression: explicit canonical caps and SP199, original XP formula, incremental rewards and locked jobs':'2B progression: explicit legacy/test caps, original XP formula, incremental rewards and locked jobs',
 'enhancement reaches +12 with opt-in Rune; incomplete +13 blocks and failed +8 stays intact':'enhancement reaches +12 and consumes rune, seal protects failed +8',
};
const identity=name=>aliases[name]??name;
function failures(text){return text.split(/\r?\ntest at /).slice(1).map(block=>{
 const [location,title,...body]=block.split(/\r?\n/);
 const name=title.replace(/^\u2716 /,'').replace(/\s*\([\d.]+ms\)$/,'');
 return {name,identity:identity(name),location:location.replaceAll('\\','/'),diagnostic:body.join('\n').trim().slice(0,2100)};
});}
function counts(text){return Object.fromEntries(['tests','pass','fail'].map(key=>[key,Number(text.match(new RegExp('\\u2139 '+key+' (\\d+)'))?.[1])]));}
const baselineText=read('outputs/gameplay-migration/baseline-gameplay-tests.log');
const initialText=read('outputs/gameplay-migration/closure-initial-regression.log');
const currentText=read('outputs/gameplay-migration/regression.log');
const baseline=failures(baselineText),initial=failures(initialText),current=failures(currentText);
for(const [text,entries] of [[baselineText,baseline],[initialText,initial],[currentText,current]])assert.equal(entries.length,counts(text).fail,'Failure parser must match runner count');
const passing=new Set(currentText.split(/\r?\n/).filter(s=>s.startsWith('\u2714 ')).map(s=>identity(s.replace(/^\u2714 /,'').replace(/\s*\([\d.]+ms\)$/,''))));
const before=new Map(baseline.map(x=>[x.identity,x])),first=new Map(initial.map(x=>[x.identity,x])),after=new Map(current.map(x=>[x.identity,x]));
const obsolete=new Set(initial.filter(x=>!before.has(x.identity)).map(x=>x.identity));
obsolete.add('2B progression: explicit legacy/test caps, original XP formula, incremental rewards and locked jobs');
obsolete.add('enhancement reaches +12 and consumes rune, seal protects failed +8');
function reason(name,entry){
 if(obsolete.has(name)){
  if(/enhancement|Eternal Seal|unprotected \+8|material descriptions/.test(name))return 'Canonical enhancement keeps permanent item and level on failure; Seal unused; Fate Rune opt-in. Cap15 schema with incomplete +13..15, no guessed probabilities/costs.';
  if(/reset|refund|paid Rank|scoped investment|ambiguous old save|capstone/.test(name))return 'Manual reset has no approved conditions/cost and is disabled atomically; paid ownership preserved. Job-change refunds remain independently tested.';
  if(/registry|presentation|sidebar/.test(name))return 'Assassin display spelling and alias; unresolved names retained only as legacyName. Canonical IDs/relations and inactive advanced paths asserted.';
  if(/weapon|CFV3-1 starter/.test(name))return 'Sword raw contribution .9; offhand raw .5 of weighted value, bonus and unique layers retained once.';
  if(/STA/.test(name))return 'Old fixture allocated 13 points at level4 (budget6). Legal level8 fixture retains STA->VIT coverage; canonical save tests cover refund of invalid allocation.';
  return 'Canonical cap100, SP199 by80, no SP81..100 and two stat points per level replace legacy cap50/80 and SP278 assertions.';
 }
 const file=entry.location.split(':')[0];
 if(/accuracy-evasion|berserker-v3|blade-master|warrior-v3|warrior-lineage|skill-presentation-v3|live-job-integration/.test(file))return 'Baseline fixture/promotion gate fails before subject assertions: initial equipment is still equipped when transition requires empty slots. No migration change to this gate. Downstream assertions remain unverified.';
 if(/city-layout|rune-forge|forge.test/.test(file))return 'Existing city/NPC fixture mismatch, including empty/missing Forge Master data. Map/NPC data is outside this closure scope.';
 if(/character-ui/.test(file)||name==='all ten specializations receive legal equipment and four skills')return 'Legacy loop sends RuntimeCoreJobId thief into legacy chooseCoreJob and/or PASSIVES indexing. Baseline registry/fixture mismatch, also recorded as lint type errors.';
 if(/mana-potions/.test(file)||/primary-stat and \+2/.test(name))return 'Existing legacy mana/capacity expected values conflict with baseline runtime; see retained exact baseline and current diagnostics. No new mana curve or inventory balance introduced.';
 if(/clean-break|public creation|versioned collisions|all five Core/.test(name+' '+file))return 'Existing V2-versus-V3 creation/registry-count assumptions fail in baseline; no new kits or legacy removal introduced.';
 if(/golden damage|Rank1 deterministic|legacy skill damage/.test(name))return 'Legacy damage golden differs already in baseline; canonical weapon budget also changes numeric damage. Baseline failure is not evidence of downstream parity; exact diagnostics preserved.';
 if(/character-model|drag-drop/.test(file))return 'Existing model/visual lookup mismatch. Assets remain untouched per scope.';
 return 'Failure exists in pre-migration baseline and remains a release blocker. Exact location, assertion and baseline/current diagnostics retained; no claim that unexecuted assertions pass.';
}
const records=[...new Set([...before.keys(),...first.keys(),...after.keys()])].sort((a,b)=>a.localeCompare(b)).map(name=>{
 const b=before.get(name),i=first.get(name),a=after.get(name),entry=a??i??b;
 const category=obsolete.has(name)?'obsolete_canonical_assertion':b?'pre_existing_baseline':'uncertain';
 const status=a?'failing':passing.has(name)?'passing':'not_observed';
 assert.notEqual(status,'not_observed','A historical test must not disappear: '+name);
 return {name,currentName:a?.name??Object.entries(aliases).find(([,v])=>v===name)?.[0]??name,category,status,reason:reason(name,entry),
  failedBeforeMigration:!!b,failedAtLastValidation:!!i,baseline:b??null,lastValidation:i??null,current:a??null};
});
const countBy=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(value=>[value,rows.filter(r=>r[key]===value).length]));
const result={baseline:counts(baselineText),lastValidation:counts(initialText),current:counts(currentText),
 classificationLegend:{migration_regression:'Reproducible new behavior violating canonical contract',obsolete_canonical_assertion:'Expected result superseded by approved canonical rule',pre_existing_baseline:'Observed failing before migration, not dismissed as passing',uncertain:'Insufficient evidence'},
 lastValidationCategories:countBy(records.filter(r=>r.failedAtLastValidation),'category'),currentCategories:countBy(records.filter(r=>r.status==='failing'),'category'),
 newlyFailing:current.filter(r=>!before.has(r.identity)).map(r=>r.name),previouslyFailingNowPassing:records.filter(r=>r.failedBeforeMigration&&r.status==='passing').map(r=>r.name),
 parserCorrection:'Parse only test-at failure blocks and reconcile runner count; never count the failing tests header. Renamed tests retain explicit identity aliases.',
 additionalClosedDefects:[{id:'ASSASSIN-ECLIPSE-CRIT',category:'migration_regression',status:'fixed',evidence:'Venom Eclipse description identifies Assassin poison over time; all three profiles now forward narrow exception to production world sink. All five Venom profiles and all three Eclipse ranks tested.'},
 {id:'SIMULATION-FIDELITY',status:'improved-not-live-tuning-evidence',evidence:'Sorted impacts, capped effective damage, impact hit/crit rolls, combo/hand alternation, legal purchases, mana budget, lock, poison, scripted uptime and incoming sensitivity. Full scene/AI/transient paths remain unmodeled.'}],
 phase14Passed:false,records};
writeFileSync('docs/gameplay-regression-delta.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({baseline:result.baseline,current:result.current,initialCategories:result.lastValidationCategories,currentCategories:result.currentCategories,newlyFailing:result.newlyFailing},null,2));
