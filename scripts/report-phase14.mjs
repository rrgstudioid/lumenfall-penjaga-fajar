import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = path => { const bytes=readFileSync(path); return bytes[0]===255 && bytes[1]===254 ? bytes.toString('utf16le') : bytes.toString('utf8'); };
const json = path => JSON.parse(read(path));
const previous=json('outputs/gameplay-migration/phase14-start-delta.json');
const delta=json('docs/gameplay-regression-delta.json');
const events=read('outputs/gameplay-migration/gameplay-events.jsonl').trim().split('\n').map(JSON.parse);
assert.equal(events.length,delta.current.tests);
assert(events.every(e=>!e.skip&&!e.todo));
const pending=previous.records.filter(r=>r.status==='failing');
assert.equal(pending.length,87);
const legacyNames=new Set([
 '1B registry: versioned collisions remain distinct; all legacy specializations/saves remain valid with no V2 mapping',
 '3C-PRE every legacy specialization survives save, display, skills and functional progression',
 '4B real dual dagger: distinct one-hand instances only, slot validation and no style-based Attack duplication',
 '4C independent golden damage tables: every rank, no legacy +12% double scaling',
 '4C Rank1 deterministic 200 attack raw totals, local payoff group Mark+Rear adds not multiplies',
 'all core and specialization trees use the correct registry and exactly four active nodes',
 'all five Core Jobs and ten Special Jobs are represented',
 'all legacy skill damage and mitigation remain identical after shared-math extraction',
 'all ten specializations receive legal equipment and four skills',
 'level 15 V2 exposes only Warrior as an available core job',
 'passive effects apply to all ten jobs and reset refunds investments but not job grants',
]);
const outsideNames=new Map([
 ['all sword-like equipment uses the owning hand and points forward, including twin blades','Fixture fixed: legal Thief owner and two distinct equipped Dagger instances reach both existing hand sockets; illegal Adventurer still renders no Dagger. No rig/asset change. PHASE_4B_THIEF_FOUNDATION_REPORT and character-view reconciliation are the evidence.'],
 ['both city dimensions and NPC spacing grow 50%, without changing interaction range','city-layout.test.ts:12 assumes 11 NPCs in every city; registered Averion has an empty NPC list'],
 ['every city and field NPC has an explicit English service label','Obsolete one-camp-per-field assertion fixed: documented Verdant Plains v2 has no field NPC. Actual NPC IDs remain unique, all registered camps and English service labels are asserted; no invented30th NPC.'],
 ['both city Forge Masters permit actions; remote field, missing session and wrong NPC are rejected','rune-forge.test.ts:40 atForge reads coordinates of absent Averion Forge Master'],
 ['every registered city has a nearby canonical Forge Master and rejects all other NPCs','forge.test.ts:37 expects one Forge Master in every city including empty Averion'],
 ['every registry skill has a distinct canonical visual; upgrading a binding needs no reassignment','Four missing legacy passive glyph/motif tuples added using existing UI grammar, no assets or skill activation. Full registry completeness, uniqueness and learned-binding upgrade tests pass.'],
 ['Rune descriptions distinguish possible rolls from granted stats, jobs and extraction','Stale expected terminology aligned with CFV3-2 Rune audit and central stat-presentation: STR and Boss Damage. Rune source, job, extraction and roll-vs-grant assertions retained.'],
 ['equipment descriptions contain the compact gameplay metadata','Stale expected Main Weapon and forced decimal .0 aligned with SPV3-6 Main Hand contract and compact stat-presentation. Exact numeric Attack33/Defense3 and remaining equipment metadata assertions retained.'],
]);
function evidence(name,file){
 if(outsideNames.has(name))return outsideNames.get(name);
 if(name==='all ten specializations receive legal equipment and four skills')return 'Caroq legacy promotion now selects its existing caroq-daggers reward explicitly after V2/V3 early returns; dagger canonicalization still clears requiredSpecialJob. All ten legacy trees reach equipment assertions. Dedicated ISOLATION test proves one reward, repeat-promotion atomic rejection, canonical Thief equipment access and V2/V3 Thief rejection without reward/state/skill/mastery leakage. No job, item or mastery registered.';
 if(name.includes('full Blade Tempest'))return 'Initial promotion fixture hid a real rank presentation defect. rowsForMechanics now reads rankEffects[rank-1].hitSequence before fallback; assertion reaches rank3 and proves five hits.';
 if(name.includes('golden damage')||name.includes('200 attack'))return 'Retained V2 coefficient tests now call the pure skill resolver with an actual 200-PATK context. The old integration call recomposed real dagger power and ignored the pretend downstream stats. Existing +5% per-rank factor asserted independently; integration and V2/V3 isolation tests remain separate.';
 if(name.includes('legacy skill damage'))return 'Legacy golden omitted the existing +5% per-rank factor in skill-action.ts in addition to legacy +12%; numeric comparison now uses 1e-7 tolerance for floating-point operation order. No live formula change.';
 if(/registry: versioned|every legacy specialization|all core and specialization|all five Core|passive effects apply/.test(name))return 'Explicit ten-record legacy roster replaces mixed fourteen-record registry iteration. All fourteen registry IDs are additionally asserted by the ISOLATION contract. Manual reset remains atomically disabled; paid ownership is retained.';
 if(name.startsWith('4B real dual'))return 'Dagger style requires an owner. Positive fixture supplies Thief identity; ownerless style and obsolete off_hand_dagger identity remain rejected. No production capability bypass.';
 if(/public creation|new character creation|level 15 V2|legacy characters remain separate/.test(name))return 'Public factory defaults to V3; historical V2 behavior uses createV2TestHero explicitly. V2 identity/save retention and V3 default are asserted independently.';
 if(name.includes('save writes ownership'))return 'Synthetic in-memory storage now saves a legal V3 hero with an earned SP budget and purchased rank; legacy save attempt explicitly rejected. Transient stripping and nonmutation assertions execute after the save gate.';
 if(name.includes('no stamina'))return 'Source-boundary assertion follows the extracted gameplay-hud.tsx rather than old app/page.tsx; registry resource checks and other production consumer checks retained.';
 if(/resourceEfficiency|flat Max MP|primary-stat/.test(name))return 'Expected mana uses existing floor(60 + level*2.5 + level^2*.01 + bonusINT*3), not obsolete base145. Flat Max MP and resourceEfficiency separation rechecked through derived stats/save.';
 if(/inventory|overflow/.test(name))return 'Capacity fixture counts carried unequipped items, matching addItemToInventory. Save-normalized capacity reset in synthetic fixture before pickup; purchase/overflow assertions now reach intended full-bag condition.';
 if(name.startsWith('job reset'))return 'Synthetic V3 Lv60 Warrior->Berserker promoted through real gates, SP119, legal purchases, empty equipment and Gold1500. Previously legacy architecture plus V3 state never entered the V3 reset branch. Production reset gate unchanged.';
 if(name.includes('core job promotion requires'))return 'Assert rejection while starter sword is equipped, then unequip and run the promotion/refund assertions. Production empty-equipment gate unchanged.';
 if(name.includes('development save reload'))return 'Fixture promotes at legal Lv15 with SP14 through actual gate before purchasing/saving; replaces inconsistent Lv8 Warrior metadata.';
 if(file.includes('blade-master-offhand-ui')||name.includes('NPC copy and development'))return 'Development hero factory now removes starter equipment before calling the unchanged promotion gate and re-equips the legal sword afterwards. UI candidate, sibling and save assertions execute on a real Blade Master.';
 return 'Promotion fixture unequips gear before real transition, then restores legal equipment. Earned SP uses level curve. Downstream assertions run; controlled damage uses fixed RNG, weighted sword .9/offhand .5, current mana/reset policies and sufficient target HP where applicable. Production gates unchanged.';
}
const records=pending.map(old=>{
 const latest=delta.records.find(r=>r.name===old.name);assert(latest,old.name);
 const event=events.find(e=>e.name===latest.currentName)||events.find(e=>e.name===old.name);assert(event,old.name);
 const file=event.file.slice(event.file.indexOf('lib/game/'));
 const category=outsideNames.has(old.name)?4:legacyNames.has(old.name)?3:old.name.includes('full Blade Tempest')?1:2;
 const source=read(file).split(/\r?\n/);
 return {name:old.name,currentName:event.name,category,status:event.status,reason:evidence(old.name,file),
  priorLocation:old.current.location,priorDiagnostic:old.current.diagnostic,baseline:old.baseline,
  currentLocation:`${file}:${event.line}:${event.column}`,currentDiagnostic:event.diagnostic,
  currentTestSource:source.slice(event.line-1,Math.min(source.length,event.line+20)).join('\n')};
});
assert(records.filter(r=>[1,2,5].includes(r.category)).every(r=>r.status==='pass'),'An active/harness/uncertain failure remains');
const legacyFiles=new Set(['phase-1b.test.ts','phase-2b.test.ts','phase-2c.test.ts','thief-foundation.test.ts','thief-v2.test.ts','clean-break.test.ts','job-presentation.test.ts']);
const outsideFiles=new Set(['character-model.test.ts','city-layout.test.ts','field-terrain.test.ts','field-quest-travel.test.ts','verdant-plains.test.ts','imported-map.test.ts','stylized-tree-map.test.ts','tree-models.test.ts']);
// Projection from ALL executed results; no name pattern, skip, test deletion or acceptance-only runner.
const classified=events.map(e=>{
 const file=e.file.split('/').at(-1);
 const scope=outsideFiles.has(file)||outsideNames.has(e.name)?'outside-gameplay-migration':legacyFiles.has(file)||legacyNames.has(e.name)?'legacy-compatibility':'gameplay-acceptance';
 return {...e,file:e.file.slice(e.file.indexOf('lib/game/')),scope,
  scopeReason:scope==='gameplay-acceptance'?'Gameplay behavior or shared contract':outsideNames.get(e.name)??(scope==='legacy-compatibility'?'Explicit legacy/V2 fixture and compatibility suite; isolation contract covers live boundary':'Map, terrain, model or city validation outside requested migration')};
});
const counts=rows=>({tests:rows.length,pass:rows.filter(r=>r.status==='pass').length,fail:rows.filter(r=>r.status==='fail').length});
const suites=Object.fromEntries(['gameplay-acceptance','legacy-compatibility','outside-gameplay-migration'].map(s=>[s,counts(classified.filter(e=>e.scope===s))]));
assert.equal(classified.filter(e=>e.status==='fail').length,delta.current.fail);
const report={date:'2026-10-06',baseline:delta.baseline,previous:previous.current,current:delta.current,
 categoryLegend:{1:'Active gameplay behavior',2:'Fixture/test harness or stale assertion',3:'Separated/inactive legacy compatibility',4:'Outside gameplay migration',5:'Uncertain; blocker'},
 categoryCounts:Object.fromEntries([1,2,3,4,5].map(c=>[c,counts(records.filter(r=>r.category===c))])),suites,
 additionalClosedDefects:[{id:'ASSASSIN-POISON-PRESENTATION',category:1,status:'fixed',evidence:'Venom Mastery and Eclipse tooltip still said no Crit; now derived from the per-rank critException marker. All5 Venom and3 Eclipse rank presentation assertions pass along with narrow damage-policy assertions.'}],
 allTestsExecuted:true,skipped:0,scopeMethod:'Post-run projection; full suite exit remains nonzero. Every result retained in gameplay-suite-results.json. Legacy and outside failures are not acceptance passes.',
 legacyIsolation:'canonical-gameplay.test.ts: ISOLATION contract verifies ten legacy specializations cannot promote or expose legacy skills/mastery in V2/V3; all14 runtime IDs retained',
 phase14Passed:false,blockers:['Field Boss model lacks full AI/distance/status/browser parity and no active Lv60+ boss covers specialists','East Gate public/legacy eligibility awaits ACC; global-map absence does not authorize removal from runtime/travel','Full browser gameplay/input/AI parity remains unverified; full lint/typecheck and outside tests remain nonzero','D-14 configuration candidates remain unapproved and inactive'],records};
writeFileSync('docs/gameplay-phase14-triage.json',JSON.stringify(report,null,2));
writeFileSync('docs/gameplay-suite-results.json',JSON.stringify({suites,allTestsExecuted:true,results:classified},null,2));
delta.phase14={artifact:'gameplay-phase14-triage.json',categoryCounts:report.categoryCounts,suites,phase14Passed:false};
for(const record of delta.records){const row=records.find(r=>r.name===record.name);if(row){record.priorClassificationReason=record.reason;record.reason=row.reason;record.phase14={category:row.category,status:row.status,reason:row.reason};}}
writeFileSync('docs/gameplay-regression-delta.json',JSON.stringify(delta,null,2));
console.log(JSON.stringify({categories:report.categoryCounts,suites,blockers:report.blockers},null,2));
process.exitCode=suites['gameplay-acceptance'].fail?1:0;
